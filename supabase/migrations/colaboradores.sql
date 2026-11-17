-- Mapa RH — Colaboradores e desligamentos.
-- Cria: maparh_vinculos (uma linha por passagem da pessoa pela empresa), maparh_vinculo_eventos (histórico só-insere),
-- maparh_desligamentos, as funções de admitir / movimentar / desligar / desfazer admissão e os indicadores mensais.
-- Depende do que já existe: public.maparh_pessoas, public.maparh_preadmissoes, public.maparh_membros e, no esquema maparh_priv,
-- perfil(), pode_rh(), pode_projeto(text), tocar() e auditar_linha(text).
--
-- Regra de acesso: LER exige pode_rh() e pode_projeto(projeto do vínculo). GRAVAR só acontece pelas funções abaixo, que exigem
-- o mesmo e ainda perfil admin ou gestor. Por isso o usuário comum não recebe INSERT/UPDATE/DELETE direto nas tabelas
-- (a única exceção são quatro colunas de acompanhamento em maparh_desligamentos).
--
-- Convenção de headcount (igual em js/colab.js): a pessoa conta no dia da admissão e NÃO conta no dia do desligamento.
--   ativo em D  <=>  admissao <= D  e  (desligamento é nulo  ou  desligamento > D)

begin;

-- ---------------------------------------------------------------- tabelas
create table if not exists public.maparh_vinculos (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.maparh_pessoas(id) on delete restrict,
  projeto_id text not null,
  preadmissao_id uuid references public.maparh_preadmissoes(id) on delete set null,
  admissao date not null,
  desligamento date,
  tipo_vinculo text,
  -- valores ATUAIS (o histórico de como chegaram aqui fica em maparh_vinculo_eventos)
  cargo text,
  unidade text,
  cidade_atuacao_id text,
  tipo text not null default 'LOCAL' check (tipo in ('LOCAL', 'MOVEL')),
  gestor text,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  constraint maparh_vinculos_datas check (desligamento is null or desligamento >= admissao)
);
-- uma pessoa não pode ter dois vínculos ativos (em nenhum projeto)
create unique index if not exists maparh_vinculos_um_ativo on public.maparh_vinculos (pessoa_id) where desligamento is null;
-- uma pré-admissão gera no máximo um vínculo (é o que torna "admitir" idempotente)
create unique index if not exists maparh_vinculos_preadmissao_unica on public.maparh_vinculos (preadmissao_id) where preadmissao_id is not null;
create index if not exists maparh_vinculos_projeto on public.maparh_vinculos (projeto_id, admissao);

create table if not exists public.maparh_vinculo_eventos (
  id uuid primary key default gen_random_uuid(),
  vinculo_id uuid not null references public.maparh_vinculos(id) on delete cascade,
  tipo text not null check (tipo in ('admissao', 'transferencia', 'cargo', 'gestor', 'afastamento', 'retorno', 'desligamento')),
  vigencia date not null,
  de jsonb,
  para jsonb,
  observacao text,
  criado_por uuid default auth.uid(),
  criado_login text,
  criado_em timestamptz not null default now()
);
create index if not exists maparh_vinculo_eventos_vinculo on public.maparh_vinculo_eventos (vinculo_id, vigencia, criado_em);

create table if not exists public.maparh_desligamentos (
  id uuid primary key default gen_random_uuid(),
  vinculo_id uuid not null unique references public.maparh_vinculos(id) on delete cascade,
  data date not null,
  tipo text not null check (tipo in ('pedido', 'sem_justa_causa', 'justa_causa', 'termino_contrato', 'acordo', 'outro')),
  motivo_categoria text,
  -- texto restrito: pode ter informação sensível; não é copiado para o histórico de eventos nem sai no CSV
  observacao text check (observacao is null or char_length(observacao) <= 2000),
  precisa_repor boolean not null default false,
  reposicao_situacao text not null default 'nao_iniciada' check (reposicao_situacao in ('nao_iniciada', 'em_andamento', 'reposta', 'nao_vai_repor')),
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------- funções de apoio (esquema privado)
-- Eventos e desligamentos herdam o projeto pelo vínculo. Security definer para a política não depender da RLS do vínculo.
create or replace function maparh_priv.pode_vinculo(p_vinculo uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce((select maparh_priv.pode_rh() and maparh_priv.pode_projeto(v.projeto_id)
                   from public.maparh_vinculos v where v.id = p_vinculo), false);
$$;
revoke all on function maparh_priv.pode_vinculo(uuid) from public, anon;
grant execute on function maparh_priv.pode_vinculo(uuid) to authenticated;

-- Quem pode GRAVAR colaboradores de um projeto: liberado para dados pessoais, com acesso ao projeto e perfil admin ou gestor.
create or replace function maparh_priv.exigir_colab(p_projeto text)
returns void language plpgsql stable set search_path = ''
as $$
begin
  if auth.uid() is null
     or not coalesce(maparh_priv.pode_rh(), false)
     or not coalesce(maparh_priv.pode_projeto(p_projeto), false)
     or coalesce(maparh_priv.perfil(), '') not in ('admin', 'gestor') then
    raise exception 'permission denied: sem acesso aos colaboradores deste projeto' using errcode = '42501';
  end if;
end $$;
revoke all on function maparh_priv.exigir_colab(text) from public, anon;
grant execute on function maparh_priv.exigir_colab(text) to authenticated;

-- ---------------------------------------------------------------- gatilhos
drop trigger if exists maparh_vinculos_tocar on public.maparh_vinculos;
create trigger maparh_vinculos_tocar before update on public.maparh_vinculos for each row execute function maparh_priv.tocar();
drop trigger if exists maparh_desligamentos_tocar on public.maparh_desligamentos;
create trigger maparh_desligamentos_tocar before update on public.maparh_desligamentos for each row execute function maparh_priv.tocar();

drop trigger if exists maparh_vinculos_auditar on public.maparh_vinculos;
create trigger maparh_vinculos_auditar after insert or update or delete on public.maparh_vinculos for each row execute function maparh_priv.auditar_linha('maparh_vinculos');
drop trigger if exists maparh_vinculo_eventos_auditar on public.maparh_vinculo_eventos;
create trigger maparh_vinculo_eventos_auditar after insert or update or delete on public.maparh_vinculo_eventos for each row execute function maparh_priv.auditar_linha('maparh_vinculo_eventos');
drop trigger if exists maparh_desligamentos_auditar on public.maparh_desligamentos;
create trigger maparh_desligamentos_auditar after insert or update or delete on public.maparh_desligamentos for each row execute function maparh_priv.auditar_linha('maparh_desligamentos');

-- ---------------------------------------------------------------- RLS e permissões
alter table public.maparh_vinculos enable row level security;
alter table public.maparh_vinculo_eventos enable row level security;
alter table public.maparh_desligamentos enable row level security;

revoke all on table public.maparh_vinculos, public.maparh_vinculo_eventos, public.maparh_desligamentos from public, anon, authenticated;
grant select on table public.maparh_vinculos, public.maparh_vinculo_eventos, public.maparh_desligamentos to authenticated;
-- acompanhamento do desligamento (reposição, motivo, observação) pode ser ajustado depois; data, tipo e vínculo não
grant update (motivo_categoria, observacao, precisa_repor, reposicao_situacao) on table public.maparh_desligamentos to authenticated;

drop policy if exists maparh_vinculos_ler on public.maparh_vinculos;
create policy maparh_vinculos_ler on public.maparh_vinculos for select to authenticated
  using ((select maparh_priv.pode_rh()) and maparh_priv.pode_projeto(projeto_id));

drop policy if exists maparh_vinculo_eventos_ler on public.maparh_vinculo_eventos;
create policy maparh_vinculo_eventos_ler on public.maparh_vinculo_eventos for select to authenticated
  using (maparh_priv.pode_vinculo(vinculo_id));

drop policy if exists maparh_desligamentos_ler on public.maparh_desligamentos;
create policy maparh_desligamentos_ler on public.maparh_desligamentos for select to authenticated
  using (maparh_priv.pode_vinculo(vinculo_id));

drop policy if exists maparh_desligamentos_acompanhar on public.maparh_desligamentos;
create policy maparh_desligamentos_acompanhar on public.maparh_desligamentos for update to authenticated
  using (maparh_priv.pode_vinculo(vinculo_id) and (select maparh_priv.perfil()) in ('admin', 'gestor'))
  with check (maparh_priv.pode_vinculo(vinculo_id) and (select maparh_priv.perfil()) in ('admin', 'gestor'));
-- Sem política nem permissão de INSERT/UPDATE/DELETE para o resto: vínculos e eventos só mudam pelas funções abaixo.

-- ---------------------------------------------------------------- admitir
-- Cria o vínculo e o evento de admissão a partir de uma pré-admissão já marcada como admitida.
-- Idempotente: chamada de novo para a mesma pré-admissão, devolve o vínculo que já existe (com "ja_existia": true).
create or replace function public.maparh_admitir_colaborador(p_preadmissao uuid, p_admissao date default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  pre public.maparh_preadmissoes%rowtype;
  v public.maparh_vinculos%rowtype;
  v_data date;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select * into pre from public.maparh_preadmissoes where id = p_preadmissao;
  if not found then raise exception 'Pré-admissão não encontrada.'; end if;
  perform maparh_priv.exigir_colab(pre.projeto_id);

  select * into v from public.maparh_vinculos where preadmissao_id = p_preadmissao;
  if found then return to_jsonb(v) || jsonb_build_object('ja_existia', true); end if;

  if pre.situacao is distinct from 'admitido' then raise exception 'Esta pré-admissão ainda não está como admitida.'; end if;
  v_data := coalesce(p_admissao, pre.admitido_em, v_hoje);
  if exists (select 1 from public.maparh_vinculos o where o.pessoa_id = pre.pessoa_id and o.desligamento is not null and o.desligamento > v_data and o.admissao <= v_data) then
    raise exception 'A data de admissão cai dentro de uma passagem anterior desta pessoa pela empresa.';
  end if;

  begin
    insert into public.maparh_vinculos (pessoa_id, projeto_id, preadmissao_id, admissao, cargo, unidade, cidade_atuacao_id, tipo)
    values (pre.pessoa_id, pre.projeto_id, pre.id, v_data, nullif(btrim(pre.cargo), ''), nullif(btrim(pre.unidade), ''),
            coalesce(pre.cidade_atuacao_id, case when pre.tipo = 'MOVEL' then pre.base_id end),
            case when pre.tipo = 'MOVEL' then 'MOVEL' else 'LOCAL' end)
    returning * into v;
  exception when unique_violation then
    -- outra chamada chegou primeiro para a mesma pré-admissão: devolve o que ela criou
    select * into v from public.maparh_vinculos where preadmissao_id = p_preadmissao;
    if found then return to_jsonb(v) || jsonb_build_object('ja_existia', true); end if;
    raise exception 'Esta pessoa já tem um vínculo ativo na empresa (maparh_vinculos_um_ativo). Registre o desligamento antes de admitir de novo.';
  end;

  insert into public.maparh_vinculo_eventos (vinculo_id, tipo, vigencia, de, para, criado_login)
  values (v.id, 'admissao', v.admissao, null,
          jsonb_strip_nulls(jsonb_build_object('cargo', v.cargo, 'unidade', v.unidade, 'cidade_atuacao_id', v.cidade_atuacao_id, 'tipo', v.tipo)),
          (select m.login from public.maparh_membros m where m.user_id = auth.uid()));
  return to_jsonb(v) || jsonb_build_object('ja_existia', false);
end $$;

-- Desfaz uma admissão lançada por engano (para a tela de pré-admissão usar em "Desfazer admissão").
-- Só apaga o vínculo se ele ainda não tem movimentação nem desligamento. Devolve true se apagou, false se não havia vínculo.
create or replace function public.maparh_desfazer_admissao_colaborador(p_preadmissao uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v public.maparh_vinculos%rowtype;
begin
  select * into v from public.maparh_vinculos where preadmissao_id = p_preadmissao for update;
  if not found then
    -- sem vínculo: nada a desfazer, mas só responde a quem tem acesso à pré-admissão
    perform maparh_priv.exigir_colab((select p.projeto_id from public.maparh_preadmissoes p where p.id = p_preadmissao));
    return false;
  end if;
  perform maparh_priv.exigir_colab(v.projeto_id);
  if v.desligamento is not null or exists (select 1 from public.maparh_vinculo_eventos e where e.vinculo_id = v.id and e.tipo <> 'admissao') then
    raise exception 'Este colaborador já tem movimentação ou desligamento registrado; a admissão não pode mais ser desfeita.';
  end if;
  delete from public.maparh_vinculos where id = v.id;
  return true;
end $$;

-- ---------------------------------------------------------------- movimentar
-- p_tipo: 'transferencia' (unidade, cidade_atuacao_id, tipo), 'cargo' (cargo, tipo_vinculo) ou 'gestor' (gestor).
-- p_para: objeto só com os campos que mudam. Grava o evento com de/para e atualiza os valores atuais do vínculo.
create or replace function public.maparh_movimentar_colaborador(p_vinculo uuid, p_tipo text, p_vigencia date, p_para jsonb, p_obs text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v public.maparh_vinculos%rowtype;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  permitidos text[];
  atual jsonb; v_de jsonb := '{}'::jsonb; v_para jsonb := '{}'::jsonb;
  k text; novo text;
begin
  select * into v from public.maparh_vinculos where id = p_vinculo for update;
  if not found then raise exception 'Colaborador não encontrado.'; end if;
  perform maparh_priv.exigir_colab(v.projeto_id);
  if v.desligamento is not null then raise exception 'Este colaborador já foi desligado; não dá para movimentar.'; end if;

  permitidos := case p_tipo when 'transferencia' then array['unidade', 'cidade_atuacao_id', 'tipo']
                            when 'cargo' then array['cargo', 'tipo_vinculo']
                            when 'gestor' then array['gestor'] end;
  if permitidos is null then raise exception 'Tipo de movimentação inválido: use transferencia, cargo ou gestor.'; end if;
  if p_vigencia is null then raise exception 'Informe a data em que a mudança passa a valer.'; end if;
  if p_vigencia < v.admissao then raise exception 'A data da mudança não pode ser anterior à admissão.'; end if;
  if p_vigencia > v_hoje then raise exception 'A data da mudança não pode estar no futuro: registre quando ela passar a valer.'; end if;
  if exists (select 1 from public.maparh_vinculo_eventos e where e.vinculo_id = v.id and e.vigencia > p_vigencia) then
    raise exception 'Já existe movimentação deste colaborador com data posterior a essa.';
  end if;
  if p_para is null or jsonb_typeof(p_para) <> 'object' then raise exception 'Informe o que muda.'; end if;

  atual := to_jsonb(v);
  for k in select jsonb_object_keys(p_para) loop
    if not (k = any (permitidos)) then raise exception 'O campo "%" não pode ser alterado numa movimentação do tipo %.', k, p_tipo; end if;
    novo := nullif(btrim(p_para ->> k), '');
    if novo is distinct from (atual ->> k) then
      v_de := v_de || jsonb_build_object(k, atual -> k);
      v_para := v_para || jsonb_build_object(k, novo);
    end if;
  end loop;
  if v_para = '{}'::jsonb then raise exception 'Nada mudou: os valores informados são os atuais.'; end if;
  if v_para ? 'tipo' and coalesce(v_para ->> 'tipo', '') not in ('LOCAL', 'MOVEL') then raise exception 'Tipo inválido: use LOCAL ou MOVEL.'; end if;

  update public.maparh_vinculos set
    cargo = case when v_para ? 'cargo' then v_para ->> 'cargo' else cargo end,
    tipo_vinculo = case when v_para ? 'tipo_vinculo' then v_para ->> 'tipo_vinculo' else tipo_vinculo end,
    unidade = case when v_para ? 'unidade' then v_para ->> 'unidade' else unidade end,
    cidade_atuacao_id = case when v_para ? 'cidade_atuacao_id' then v_para ->> 'cidade_atuacao_id' else cidade_atuacao_id end,
    tipo = case when v_para ? 'tipo' then v_para ->> 'tipo' else tipo end,
    gestor = case when v_para ? 'gestor' then v_para ->> 'gestor' else gestor end
  where id = v.id returning * into v;

  insert into public.maparh_vinculo_eventos (vinculo_id, tipo, vigencia, de, para, observacao, criado_login)
  values (v.id, p_tipo, p_vigencia, v_de, v_para, nullif(btrim(p_obs), ''),
          (select m.login from public.maparh_membros m where m.user_id = auth.uid()));
  return to_jsonb(v);
end $$;

-- ---------------------------------------------------------------- desligar
-- Grava o desligamento, fecha o vínculo, insere o evento e marca a pessoa como ex-colaboradora.
create or replace function public.maparh_desligar_colaborador(p_vinculo uuid, p_data date, p_tipo text, p_motivo text default null, p_obs text default null, p_repor boolean default false)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v public.maparh_vinculos%rowtype;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_motivo text := nullif(btrim(p_motivo), '');
begin
  select * into v from public.maparh_vinculos where id = p_vinculo for update;
  if not found then raise exception 'Colaborador não encontrado.'; end if;
  perform maparh_priv.exigir_colab(v.projeto_id);
  if v.desligamento is not null then raise exception 'Este colaborador já está desligado.'; end if;
  if p_tipo is null or p_tipo not in ('pedido', 'sem_justa_causa', 'justa_causa', 'termino_contrato', 'acordo', 'outro') then
    raise exception 'Tipo de desligamento inválido.';
  end if;
  if p_data is null then raise exception 'Informe a data do desligamento.'; end if;
  if p_data < v.admissao then raise exception 'A data do desligamento não pode ser anterior à admissão.'; end if;
  if p_data > v_hoje then raise exception 'A data do desligamento não pode estar no futuro: registre no dia em que acontecer.'; end if;
  if exists (select 1 from public.maparh_vinculo_eventos e where e.vinculo_id = v.id and e.vigencia > p_data) then
    raise exception 'Já existe movimentação deste colaborador com data posterior a essa.';
  end if;

  insert into public.maparh_desligamentos (vinculo_id, data, tipo, motivo_categoria, observacao, precisa_repor, reposicao_situacao)
  values (v.id, p_data, p_tipo, v_motivo, nullif(btrim(p_obs), ''), coalesce(p_repor, false),
          case when coalesce(p_repor, false) then 'nao_iniciada' else 'nao_vai_repor' end);
  update public.maparh_vinculos set desligamento = p_data where id = v.id returning * into v;
  -- a observação é texto restrito: fica só em maparh_desligamentos, não vai para o histórico
  insert into public.maparh_vinculo_eventos (vinculo_id, tipo, vigencia, de, para, criado_login)
  values (v.id, 'desligamento', p_data, null,
          jsonb_strip_nulls(jsonb_build_object('tipo', p_tipo, 'motivo_categoria', v_motivo, 'precisa_repor', coalesce(p_repor, false))),
          (select m.login from public.maparh_membros m where m.user_id = auth.uid()));
  update public.maparh_pessoas set ex_colaborador = true where id = v.pessoa_id and ex_colaborador is distinct from true;
  return to_jsonb(v);
end $$;

-- ---------------------------------------------------------------- indicadores mensais por projeto
-- Uma linha por projeto e mês (só meses em que o projeto já tinha algum vínculo). Security invoker: vale a RLS de quem chama.
--   headcount_inicio / headcount_fim: ativos no primeiro e no último dia do mês (convenção do topo do arquivo)
--   headcount_medio = (inicio + fim) / 2      turnover = desligamentos / headcount_medio * 100 (nulo se o médio for zero)
-- Sem p_de: 12 meses terminando em p_ate (ou no mês atual). No máximo 120 meses por chamada.
-- Atenção: no mês em andamento, headcount_fim é o quadro previsto para o último dia com o que já está lançado.
create or replace function public.maparh_indicadores_colaboradores(p_projeto text default null, p_de date default null, p_ate date default null)
returns table (projeto_id text, mes date, headcount_inicio integer, headcount_fim integer, admissoes integer, desligamentos integer, headcount_medio numeric, turnover numeric)
language sql stable security invoker set search_path = ''
as $$
  with fim as (
    select date_trunc('month', coalesce(p_ate, (now() at time zone 'America/Sao_Paulo')::date))::date as ultimo
  ), lim as (
    select coalesce(date_trunc('month', p_de)::date, (f.ultimo - interval '11 months')::date) as primeiro, f.ultimo from fim f
  ), meses as (
    select g::date as ini, (g + interval '1 month' - interval '1 day')::date as fim
    from lim l, generate_series(l.primeiro::timestamp, least(l.ultimo, (l.primeiro + interval '119 months')::date)::timestamp, interval '1 month') g
  ), conta as (
    select v.projeto_id as proj, m.ini, m.fim,
      (count(*) filter (where v.admissao <= m.ini and (v.desligamento is null or v.desligamento > m.ini)))::integer as hi,
      (count(*) filter (where v.admissao <= m.fim and (v.desligamento is null or v.desligamento > m.fim)))::integer as hf,
      (count(*) filter (where v.admissao between m.ini and m.fim))::integer as adm,
      (count(*) filter (where v.desligamento between m.ini and m.fim))::integer as desl
    from meses m join public.maparh_vinculos v on v.admissao <= m.fim
    where p_projeto is null or v.projeto_id = p_projeto
    group by v.projeto_id, m.ini, m.fim
  )
  select c.proj, c.ini, c.hi, c.hf, c.adm, c.desl,
    round((c.hi + c.hf) / 2.0, 1),
    case when c.hi + c.hf > 0 then round(c.desl * 100.0 / ((c.hi + c.hf) / 2.0), 2) end
  from conta c order by c.proj, c.ini;
$$;

-- ---------------------------------------------------------------- quem pode chamar
revoke all on function public.maparh_admitir_colaborador(uuid, date) from public, anon;
revoke all on function public.maparh_desfazer_admissao_colaborador(uuid) from public, anon;
revoke all on function public.maparh_movimentar_colaborador(uuid, text, date, jsonb, text) from public, anon;
revoke all on function public.maparh_desligar_colaborador(uuid, date, text, text, text, boolean) from public, anon;
revoke all on function public.maparh_indicadores_colaboradores(text, date, date) from public, anon;
grant execute on function public.maparh_admitir_colaborador(uuid, date) to authenticated;
grant execute on function public.maparh_desfazer_admissao_colaborador(uuid) to authenticated;
grant execute on function public.maparh_movimentar_colaborador(uuid, text, date, jsonb, text) to authenticated;
grant execute on function public.maparh_desligar_colaborador(uuid, date, text, text, text, boolean) to authenticated;
grant execute on function public.maparh_indicadores_colaboradores(text, date, date) to authenticated;

commit;

-- ---------------------------------------------------------------- opcional: trazer quem já foi admitido antes deste módulo
-- NÃO roda sozinho. Confira antes (pessoa admitida em dois projetos ao mesmo tempo bate no índice maparh_vinculos_um_ativo).
-- Rodar como dono do banco, depois da migração:
--
-- with novos as (
--   insert into public.maparh_vinculos (pessoa_id, projeto_id, preadmissao_id, admissao, cargo, unidade, cidade_atuacao_id, tipo)
--   select p.pessoa_id, p.projeto_id, p.id, coalesce(p.admitido_em, p.criado_em::date), nullif(btrim(p.cargo), ''), nullif(btrim(p.unidade), ''),
--          coalesce(p.cidade_atuacao_id, case when p.tipo = 'MOVEL' then p.base_id end), case when p.tipo = 'MOVEL' then 'MOVEL' else 'LOCAL' end
--   from public.maparh_preadmissoes p
--   where p.situacao = 'admitido' and not exists (select 1 from public.maparh_vinculos v where v.preadmissao_id = p.id)
--   returning *
-- )
-- insert into public.maparh_vinculo_eventos (vinculo_id, tipo, vigencia, para, observacao)
-- select n.id, 'admissao', n.admissao,
--        jsonb_strip_nulls(jsonb_build_object('cargo', n.cargo, 'unidade', n.unidade, 'cidade_atuacao_id', n.cidade_atuacao_id, 'tipo', n.tipo)),
--        'Trazido da pré-admissão na instalação do módulo'
-- from novos n;
