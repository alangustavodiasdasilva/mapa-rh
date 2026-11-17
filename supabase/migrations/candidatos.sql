-- Candidatos e Pré-admissão viram um fluxo só (Triagem -> Entrevista -> Documentação -> Admitido),
-- e entra o perfil "analista" (RH): só enxerga as vagas e as pessoas direcionadas para ele.
-- Tudo aditivo: quem já estava na pré-admissão continua onde estava (etapa "documentos").

-- 1) Pessoa pode entrar sem CPF (candidatura do formulário); o CPF, quando vem, continua único e válido
alter table public.maparh_pessoas alter column cpf drop not null;
alter table public.maparh_pessoas drop constraint if exists maparh_pessoas_cpf_check;
alter table public.maparh_pessoas add constraint maparh_pessoas_cpf_check check (cpf is null or maparh_priv.cpf_valido(cpf));

-- 2) Etapa do processo, vaga, distrito de destino e o login do RH responsável
alter table public.maparh_preadmissoes add column if not exists etapa text not null default 'documentos';
alter table public.maparh_preadmissoes drop constraint if exists maparh_preadmissoes_etapa_check;
alter table public.maparh_preadmissoes add constraint maparh_preadmissoes_etapa_check check (etapa in ('triagem', 'entrevista', 'documentos'));
alter table public.maparh_preadmissoes alter column etapa set default 'triagem';
alter table public.maparh_preadmissoes add column if not exists vaga_id text;
alter table public.maparh_preadmissoes add column if not exists distrito_id text;
alter table public.maparh_preadmissoes add column if not exists distancia_km numeric;
alter table public.maparh_preadmissoes add column if not exists analista_login text;
create index if not exists maparh_pre_analista_login_idx on public.maparh_preadmissoes (projeto_id, analista_login);
create index if not exists maparh_pre_vaga_idx on public.maparh_preadmissoes (vaga_id);
update public.maparh_preadmissoes p set analista_login = m.login from public.maparh_membros m
  where p.analista_login is null and p.analista is not null and lower(btrim(m.nome)) = lower(btrim(p.analista));

-- 3) Perfil novo: analista (RH)
alter table public.maparh_membros drop constraint if exists maparh_membros_perfil_check;
alter table public.maparh_membros add constraint maparh_membros_perfil_check check (perfil in ('admin', 'gestor', 'analista', 'leitor'));

create or replace function maparh_priv.meu_login() returns text language sql stable security definer set search_path to ''
as $$ select m.login from public.maparh_membros m where m.user_id = (select auth.uid()) and m.ativo $$;

-- acessa os dados pessoais: administrador, analista, ou quem o administrador liberou
create or replace function maparh_priv.pode_rh() returns boolean language sql stable security definer set search_path to ''
as $$ select exists (select 1 from public.maparh_membros m where m.user_id = (select auth.uid()) and m.ativo and (m.perfil in ('admin', 'analista') or m.rh)) $$;

-- enxerga as pessoas de todos os RHs (administrador e gestor liberado); o analista só as dele
create or replace function maparh_priv.rh_ve_tudo() returns boolean language sql stable security definer set search_path to ''
as $$ select exists (select 1 from public.maparh_membros m where m.user_id = (select auth.uid()) and m.ativo and (m.perfil = 'admin' or (m.rh and m.perfil <> 'analista'))) $$;

revoke all on function maparh_priv.meu_login() from public, anon;
revoke all on function maparh_priv.rh_ve_tudo() from public, anon;
grant execute on function maparh_priv.meu_login() to authenticated;
grant execute on function maparh_priv.rh_ve_tudo() to authenticated;

-- 4) Pré-admissões: o analista lê e altera só o que está no nome dele
drop policy if exists maparh_pre_ler on public.maparh_preadmissoes;
drop policy if exists maparh_pre_inserir on public.maparh_preadmissoes;
drop policy if exists maparh_pre_alterar on public.maparh_preadmissoes;
create policy maparh_pre_ler on public.maparh_preadmissoes for select to authenticated
  using ((select maparh_priv.pode_rh()) and maparh_priv.pode_projeto(projeto_id)
    and ((select maparh_priv.rh_ve_tudo()) or analista_login = (select maparh_priv.meu_login())));
create policy maparh_pre_inserir on public.maparh_preadmissoes for insert to authenticated
  with check ((select maparh_priv.pode_rh()) and maparh_priv.pode_projeto(projeto_id)
    and ((select maparh_priv.rh_ve_tudo()) or analista_login = (select maparh_priv.meu_login())));
create policy maparh_pre_alterar on public.maparh_preadmissoes for update to authenticated
  using ((select maparh_priv.pode_rh()) and maparh_priv.pode_projeto(projeto_id)
    and ((select maparh_priv.rh_ve_tudo()) or analista_login = (select maparh_priv.meu_login())))
  with check ((select maparh_priv.pode_rh()) and maparh_priv.pode_projeto(projeto_id)
    and ((select maparh_priv.rh_ve_tudo()) or analista_login = (select maparh_priv.meu_login())));

-- 5) Pessoas: o analista vê quem ele cadastrou e quem está em processo no nome dele
drop policy if exists maparh_pessoas_tudo on public.maparh_pessoas;
drop policy if exists maparh_pessoas_ler on public.maparh_pessoas;
drop policy if exists maparh_pessoas_inserir on public.maparh_pessoas;
drop policy if exists maparh_pessoas_alterar on public.maparh_pessoas;
drop policy if exists maparh_pessoas_apagar on public.maparh_pessoas;
create policy maparh_pessoas_ler on public.maparh_pessoas for select to authenticated
  using ((select maparh_priv.pode_rh()) and ((select maparh_priv.rh_ve_tudo()) or criado_por = (select auth.uid())
    or exists (select 1 from public.maparh_preadmissoes p where p.pessoa_id = maparh_pessoas.id and p.analista_login = (select maparh_priv.meu_login()))));
create policy maparh_pessoas_inserir on public.maparh_pessoas for insert to authenticated
  with check ((select maparh_priv.pode_rh()));
create policy maparh_pessoas_alterar on public.maparh_pessoas for update to authenticated
  using ((select maparh_priv.pode_rh()) and ((select maparh_priv.rh_ve_tudo()) or criado_por = (select auth.uid())
    or exists (select 1 from public.maparh_preadmissoes p where p.pessoa_id = maparh_pessoas.id and p.analista_login = (select maparh_priv.meu_login()))))
  with check ((select maparh_priv.pode_rh()));
create policy maparh_pessoas_apagar on public.maparh_pessoas for delete to authenticated
  using ((select maparh_priv.rh_ve_tudo()));

-- Consulta de pessoa pelo CPF para quem cadastra candidato (o analista não lê a tabela inteira, mas precisa
-- reaproveitar o cadastro de quem já passou pela empresa). Devolve a pessoa e o histórico resumido.
create or replace function public.maparh_pessoa_do_cpf(p_cpf text) returns jsonb language plpgsql stable security definer set search_path to ''
as $$
declare v jsonb;
begin
  if not (select maparh_priv.pode_rh()) then raise exception 'Sem permissão.'; end if;
  select to_jsonb(p) || jsonb_build_object('historico', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'projeto_id', x.projeto_id, 'situacao', x.situacao, 'admitido_em', x.admitido_em, 'criado_em', x.criado_em))
    from public.maparh_preadmissoes x where x.pessoa_id = p.id), '[]'::jsonb))
  into v from public.maparh_pessoas p where p.cpf = p_cpf;
  return v;
end $$;
revoke all on function public.maparh_pessoa_do_cpf(text) from public, anon;
grant execute on function public.maparh_pessoa_do_cpf(text) to authenticated;

-- 6) Itens (vagas, contratações…): o analista lê só as vagas em que é o responsável e,
--    para admitir, grava a contratação (registros) do projeto dele. O resto continua só admin/gestor.
drop policy if exists maparh_itens_ler on public.maparh_itens;
create policy maparh_itens_ler on public.maparh_itens for select to authenticated
  using (((select maparh_priv.perfil()) is not null)
    and ((colecao <> 'auditoria') or ((select maparh_priv.perfil()) = 'admin'))
    and maparh_priv.pode_projeto(maparh_priv.projeto_do_item(colecao, id, dados))
    and ((select maparh_priv.perfil()) <> 'analista' or colecao <> 'vagas' or dados->>'recrutadorLogin' = (select maparh_priv.meu_login())));
drop policy if exists maparh_itens_inserir on public.maparh_itens;
create policy maparh_itens_inserir on public.maparh_itens for insert to authenticated
  with check (((colecao = 'auditoria') and ((select maparh_priv.perfil()) is not null))
    or (((select maparh_priv.perfil()) in ('admin', 'gestor')) and (colecao <> 'auditoria') and maparh_priv.pode_projeto(maparh_priv.projeto_do_item(colecao, id, dados)))
    or (((select maparh_priv.perfil()) = 'analista') and colecao = 'registros' and maparh_priv.pode_projeto(dados->>'projetoId')));
drop policy if exists maparh_itens_alterar on public.maparh_itens;
create policy maparh_itens_alterar on public.maparh_itens for update to authenticated
  using ((((select maparh_priv.perfil()) in ('admin', 'gestor')) and (colecao <> 'auditoria') and maparh_priv.pode_projeto(maparh_priv.projeto_do_item(colecao, id, dados)))
    or (((select maparh_priv.perfil()) = 'analista') and colecao = 'registros' and maparh_priv.pode_projeto(dados->>'projetoId')))
  with check ((((select maparh_priv.perfil()) in ('admin', 'gestor')) and (colecao <> 'auditoria') and (removido or maparh_priv.pode_projeto(maparh_priv.projeto_do_item(colecao, id, dados))))
    or (((select maparh_priv.perfil()) = 'analista') and colecao = 'registros' and maparh_priv.pode_projeto(dados->>'projetoId')));

-- 7) Importação: aceita candidatura sem CPF, etapa, vaga, distrito, cargo e RH responsável.
--    Só quem enxerga todos os RHs importa (o analista cadastra um a um, no nome dele).
create or replace function public.maparh_importar_preadmissoes(p_projeto text, p_arquivo text, p_linhas jsonb)
 returns jsonb language plpgsql set search_path to ''
as $function$
declare
  v_lote uuid; l jsonb; v_pessoa uuid; v_ok int := 0; v_ign int := 0; v_det jsonb := '[]'::jsonb; v_login text; i int := 0; v_cpf text; v_tel text;
begin
  if not (select maparh_priv.rh_ve_tudo()) or not maparh_priv.pode_projeto(p_projeto) then raise exception 'Sem permissão para importar neste projeto.'; end if;
  select m.login into v_login from public.maparh_membros m where m.user_id = auth.uid();
  v_lote := gen_random_uuid();
  perform maparh_priv.registrar_importacao(v_lote, p_projeto, p_arquivo, v_login, jsonb_array_length(p_linhas));
  for l in select * from jsonb_array_elements(p_linhas) loop
    i := i + 1;
    v_cpf := nullif(l->>'cpf', ''); v_pessoa := null;
    v_tel := nullif(regexp_replace(coalesce(l->>'telefone', ''), '\D', '', 'g'), '');
    if v_cpf is not null then
      select id into v_pessoa from public.maparh_pessoas where cpf = v_cpf;
    elsif v_tel is not null then
      -- sem CPF: a mesma pessoa é quem tem o mesmo nome e o mesmo telefone
      select id into v_pessoa from public.maparh_pessoas
        where lower(btrim(nome)) = lower(btrim(l->>'nome')) and regexp_replace(coalesce(telefone, ''), '\D', '', 'g') = v_tel
        order by criado_em limit 1;
    end if;
    if v_pessoa is null then
      insert into public.maparh_pessoas (cpf, nome, nascimento, telefone, email, cnh, cidade_origem_id, ex_colaborador, lote_importacao)
      values (v_cpf, l->>'nome', nullif(l->>'nascimento', '')::date, nullif(l->>'telefone', ''), nullif(l->>'email', ''), nullif(l->>'cnh', ''),
        nullif(l->>'cidade_origem_id', ''), coalesce((l->>'ex_colaborador')::boolean, false), v_lote)
      returning id into v_pessoa;
    else
      -- pessoa já conhecida: completa só o que estava vazio, não sobrescreve
      update public.maparh_pessoas set
        nascimento = coalesce(nascimento, nullif(l->>'nascimento', '')::date), telefone = coalesce(telefone, nullif(l->>'telefone', '')),
        email = coalesce(email, nullif(l->>'email', '')), cnh = coalesce(cnh, nullif(l->>'cnh', '')),
        cidade_origem_id = coalesce(cidade_origem_id, nullif(l->>'cidade_origem_id', ''))
      where id = v_pessoa;
    end if;
    if exists (select 1 from public.maparh_preadmissoes where pessoa_id = v_pessoa and projeto_id = p_projeto and situacao = 'em_andamento') then
      v_ign := v_ign + 1; v_det := v_det || jsonb_build_object('linha', i, 'cpf', v_cpf, 'nome', l->>'nome', 'motivo', 'já está em andamento neste projeto');
      continue;
    end if;
    insert into public.maparh_preadmissoes (pessoa_id, projeto_id, tipo, cidade_atuacao_id, base_id, analista, analista_login, status_texto, aso_data, aso,
      chegada_data, chegada_hora, grupo_whatsapp, observacao, lote_importacao, etapa, vaga_id, distrito_id, distancia_km, cargo, unidade)
    values (v_pessoa, p_projeto, coalesce(nullif(l->>'tipo', ''), 'LOCAL'), nullif(l->>'cidade_atuacao_id', ''), nullif(l->>'base_id', ''),
      nullif(l->>'analista', ''), nullif(l->>'analista_login', ''), nullif(l->>'status_texto', ''), nullif(l->>'aso_data', '')::date,
      case when nullif(l->>'aso_data', '') is null then 'pendente' else 'agendado' end,
      nullif(l->>'chegada_data', '')::date, nullif(l->>'chegada_hora', '')::time, nullif(l->>'grupo_whatsapp', ''), nullif(l->>'observacao', ''), v_lote,
      coalesce(nullif(l->>'etapa', ''), 'documentos'), nullif(l->>'vaga_id', ''), nullif(l->>'distrito_id', ''), nullif(l->>'distancia_km', '')::numeric,
      nullif(l->>'cargo', ''), nullif(l->>'unidade', ''));
    v_ok := v_ok + 1;
  end loop;
  perform maparh_priv.fechar_importacao(v_lote, v_ok, v_ign, v_det);
  return jsonb_build_object('lote', v_lote, 'importadas', v_ok, 'ignoradas', v_ign, 'detalhes', v_det);
end $function$;

-- desfazer importação: também só quem enxerga todos os RHs
create or replace function public.maparh_desfazer_importacao(p_lote uuid)
 returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_proj text; v_pre int; v_pes int; v_ficam int;
begin
  select projeto_id into v_proj from public.maparh_importacoes where id = p_lote and desfeita_em is null;
  if v_proj is null then raise exception 'Importação não encontrada ou já desfeita.'; end if;
  if not (select maparh_priv.rh_ve_tudo()) or not maparh_priv.pode_projeto(v_proj) then raise exception 'Sem permissão para desfazer esta importação.'; end if;
  select count(*) into v_ficam from public.maparh_preadmissoes where lote_importacao = p_lote and situacao = 'admitido';
  delete from public.maparh_preadmissoes where lote_importacao = p_lote and situacao <> 'admitido';
  get diagnostics v_pre = row_count;
  delete from public.maparh_pessoas p where p.lote_importacao = p_lote and not exists (select 1 from public.maparh_preadmissoes x where x.pessoa_id = p.id);
  get diagnostics v_pes = row_count;
  update public.maparh_importacoes set desfeita_em = now() where id = p_lote;
  return jsonb_build_object('preadmissoes', v_pre, 'pessoas', v_pes, 'admitidos_mantidos', v_ficam);
end $function$;
