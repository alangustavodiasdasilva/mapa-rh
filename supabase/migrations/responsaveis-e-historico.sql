-- 17/11/2026: quem mexeu por último, histórico automático e vários RHs responsáveis por vaga.

-- 1) quem fez a última atualização do candidato (login do membro)
alter table public.maparh_preadmissoes add column if not exists atualizado_por text;

-- 2) histórico automático: mudança de etapa, direcionamento, admissão, desfazer e retomada viram anotação com quem e quando
create or replace function maparh_priv.historico_e_autor() returns trigger
language plpgsql security definer set search_path to '' as $$
declare v_login text; v_nome text; v_add jsonb := '[]'::jsonb; v_dest text;
  rot constant jsonb := '{"triagem":"Triagem","entrevista":"Entrevista","documentos":"Documentação"}';
begin
  select m.login, m.nome into v_login, v_nome from public.maparh_membros m where m.user_id = auth.uid();
  if v_login is not null then new.atualizado_por := v_login; end if;
  if tg_op = 'INSERT' then
    if coalesce(jsonb_array_length(new.anotacoes), 0) = 0 then
      v_add := v_add || jsonb_build_array('Cadastrado na ' || coalesce(rot->>new.etapa, new.etapa) || '.');
    end if;
  else
    if new.etapa is distinct from old.etapa then
      v_add := v_add || jsonb_build_array('Passou para ' || coalesce(rot->>new.etapa, new.etapa) || '.');
    end if;
    if new.situacao is distinct from old.situacao then
      if new.situacao = 'admitido' then v_add := v_add || jsonb_build_array('Admitido.');
      elsif old.situacao = 'admitido' then v_add := v_add || jsonb_build_array('Admissão desfeita.');
      elsif new.situacao = 'em_andamento' then v_add := v_add || jsonb_build_array('Voltou para o processo.');
      end if;
    end if;
    if new.analista_login is distinct from old.analista_login and new.analista_login is not null then
      select m.nome into v_dest from public.maparh_membros m where m.login = new.analista_login;
      v_add := v_add || jsonb_build_array('Direcionado para ' || coalesce(v_dest, new.analista_login) || '.');
    end if;
  end if;
  if jsonb_array_length(v_add) > 0 then
    new.anotacoes := coalesce(new.anotacoes, '[]'::jsonb) || (
      select jsonb_agg(jsonb_build_object('em', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'por', v_login, 'nome', coalesce(v_nome, 'Sistema'), 'etapa', new.etapa, 'texto', t, 'auto', true))
      from jsonb_array_elements_text(v_add) t);
  end if;
  return new;
end $$;
drop trigger if exists maparh_pre_historico on public.maparh_preadmissoes;
create trigger maparh_pre_historico before insert or update on public.maparh_preadmissoes
  for each row execute function maparh_priv.historico_e_autor();

-- 3) vários RHs por vaga: dados.recrutadores = ["login1","login2"] (o primeiro é o principal, igual a recrutadorLogin)
create or replace function maparh_priv.rh_da_vaga(p_vaga text) returns boolean
language sql stable security definer set search_path to '' as $$
  select p_vaga is not null and exists (select 1 from public.maparh_itens i
    where i.colecao = 'vagas' and i.id = p_vaga and not i.removido
      and (i.dados->>'recrutadorLogin' = maparh_priv.meu_login() or coalesce(i.dados->'recrutadores', '[]'::jsonb) ? maparh_priv.meu_login()))
$$;

drop policy if exists maparh_pre_ler on public.maparh_preadmissoes;
create policy maparh_pre_ler on public.maparh_preadmissoes for select using (
  (select maparh_priv.pode_rh()) and maparh_priv.pode_projeto(projeto_id)
  and ((select maparh_priv.rh_ve_tudo()) or analista_login = (select maparh_priv.meu_login()) or maparh_priv.rh_da_vaga(vaga_id)));
drop policy if exists maparh_pre_alterar on public.maparh_preadmissoes;
create policy maparh_pre_alterar on public.maparh_preadmissoes for update using (
  (select maparh_priv.pode_rh()) and maparh_priv.pode_projeto(projeto_id)
  and ((select maparh_priv.rh_ve_tudo()) or analista_login = (select maparh_priv.meu_login()) or maparh_priv.rh_da_vaga(vaga_id)))
with check (
  (select maparh_priv.pode_rh()) and maparh_priv.pode_projeto(projeto_id)
  and ((select maparh_priv.rh_ve_tudo()) or analista_login = (select maparh_priv.meu_login()) or maparh_priv.rh_da_vaga(vaga_id)));

drop policy if exists maparh_pessoas_ler on public.maparh_pessoas;
create policy maparh_pessoas_ler on public.maparh_pessoas for select using (
  (select maparh_priv.pode_rh()) and ((select maparh_priv.rh_ve_tudo()) or criado_por = (select auth.uid())
    or exists (select 1 from public.maparh_preadmissoes p where p.pessoa_id = maparh_pessoas.id
      and (p.analista_login = (select maparh_priv.meu_login()) or maparh_priv.rh_da_vaga(p.vaga_id)))));
drop policy if exists maparh_pessoas_alterar on public.maparh_pessoas;
create policy maparh_pessoas_alterar on public.maparh_pessoas for update using (
  (select maparh_priv.pode_rh()) and ((select maparh_priv.rh_ve_tudo()) or criado_por = (select auth.uid())
    or exists (select 1 from public.maparh_preadmissoes p where p.pessoa_id = maparh_pessoas.id
      and (p.analista_login = (select maparh_priv.meu_login()) or maparh_priv.rh_da_vaga(p.vaga_id)))))
with check ((select maparh_priv.pode_rh()));

drop policy if exists maparh_itens_ler on public.maparh_itens;
create policy maparh_itens_ler on public.maparh_itens for select using (
  ((select maparh_priv.perfil()) is not null) and ((colecao <> 'auditoria') or ((select maparh_priv.perfil()) = 'admin'))
  and maparh_priv.pode_projeto(maparh_priv.projeto_do_item(colecao, id, dados))
  and (((select maparh_priv.perfil()) <> 'analista') or (colecao <> 'vagas')
    or (dados->>'recrutadorLogin') = (select maparh_priv.meu_login())
    or coalesce(dados->'recrutadores', '[]'::jsonb) ? (select maparh_priv.meu_login())
    or exists (select 1 from public.maparh_preadmissoes pa where pa.vaga_id = maparh_itens.id and pa.analista_login = (select maparh_priv.meu_login()))));

create or replace function public.maparh_andamento(p_projeto text default null)
returns table(id uuid, projeto_id text, vaga_id text, etapa text, situacao text, tipo text, analista text, analista_login text, distrito_id text,
  dinamica text, aso text, treinamento text, criado_em timestamptz, admitido_em date, chegada_data date, etapa_em timestamptz)
language sql stable security definer set search_path to '' as $$
  select p.id, p.projeto_id, p.vaga_id, p.etapa, p.situacao, p.tipo, p.analista, p.analista_login, p.distrito_id,
    p.dinamica, p.aso, p.treinamento, p.criado_em, p.admitido_em, p.chegada_data, p.etapa_em
  from public.maparh_preadmissoes p
  where (select maparh_priv.perfil()) is not null and maparh_priv.pode_projeto(p.projeto_id)
    and (p_projeto is null or p.projeto_id = p_projeto)
    and ((select maparh_priv.perfil()) <> 'analista' or p.analista_login = (select maparh_priv.meu_login()) or maparh_priv.rh_da_vaga(p.vaga_id))
$$;
