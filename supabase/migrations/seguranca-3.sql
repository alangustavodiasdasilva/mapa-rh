-- Terceira rodada de segurança (auditoria de 17/11/2026).

-- 1) Auditoria gravada pelo navegador: quem fez é sempre o usuário logado (não dá para gravar "admin excluiu X" em nome de outro)
create or replace function maparh_priv.carimbar_auditoria() returns trigger language plpgsql security definer set search_path to ''
as $$
begin
  if new.colecao = 'auditoria' then
    new.dados := jsonb_set(coalesce(new.dados, '{}'::jsonb), '{usuario}', to_jsonb(coalesce(maparh_priv.meu_login(), 'desconhecido')));
    if coalesce(new.dados->>'quando', '') = '' or (new.dados->>'quando')::timestamptz > now() + interval '5 minutes' then
      new.dados := jsonb_set(new.dados, '{quando}', to_jsonb(to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
    end if;
  end if;
  return new;
end $$;
revoke all on function maparh_priv.carimbar_auditoria() from public, anon, authenticated;
drop trigger if exists maparh_itens_carimbar_auditoria on public.maparh_itens;
create trigger maparh_itens_carimbar_auditoria before insert or update on public.maparh_itens for each row execute function maparh_priv.carimbar_auditoria();

-- 2) Itens que valem para todos (distritos, cidades, cargos, mapas de unidades, configurações): só administrador
--    ou gestor sem restrição de projeto alteram. Gestor restrito mexe só no que é dos projetos dele.
create or replace function maparh_priv.irrestrito() returns boolean language sql stable security definer set search_path to ''
as $$ select exists (select 1 from public.maparh_membros m where m.user_id = (select auth.uid()) and m.ativo and (m.perfil = 'admin' or (m.perfil = 'gestor' and m.projetos is null))) $$;
revoke all on function maparh_priv.irrestrito() from public, anon;
grant execute on function maparh_priv.irrestrito() to authenticated;

-- 3) RH (analista): lança e altera só as contratações que ele mesmo criou (na admissão)
drop policy if exists maparh_itens_inserir on public.maparh_itens;
create policy maparh_itens_inserir on public.maparh_itens for insert to authenticated
  with check (((colecao = 'auditoria') and ((select maparh_priv.perfil()) is not null))
    or (((select maparh_priv.perfil()) in ('admin', 'gestor')) and (colecao <> 'auditoria')
        and maparh_priv.pode_projeto(maparh_priv.projeto_do_item(colecao, id, dados))
        and (maparh_priv.projeto_do_item(colecao, id, dados) is not null or (select maparh_priv.irrestrito())))
    or (((select maparh_priv.perfil()) = 'analista') and colecao = 'registros' and maparh_priv.pode_projeto(dados->>'projetoId')
        and dados->>'criadoPor' = (select maparh_priv.meu_login())));
drop policy if exists maparh_itens_alterar on public.maparh_itens;
create policy maparh_itens_alterar on public.maparh_itens for update to authenticated
  using ((((select maparh_priv.perfil()) in ('admin', 'gestor')) and (colecao <> 'auditoria')
        and maparh_priv.pode_projeto(maparh_priv.projeto_do_item(colecao, id, dados))
        and (maparh_priv.projeto_do_item(colecao, id, dados) is not null or (select maparh_priv.irrestrito())))
    or (((select maparh_priv.perfil()) = 'analista') and colecao = 'registros' and maparh_priv.pode_projeto(dados->>'projetoId')
        and dados->>'criadoPor' = (select maparh_priv.meu_login())))
  with check ((((select maparh_priv.perfil()) in ('admin', 'gestor')) and (colecao <> 'auditoria')
        and (removido or (maparh_priv.pode_projeto(maparh_priv.projeto_do_item(colecao, id, dados))
             and (maparh_priv.projeto_do_item(colecao, id, dados) is not null or (select maparh_priv.irrestrito())))))
    or (((select maparh_priv.perfil()) = 'analista') and colecao = 'registros'
        and (removido or (maparh_priv.pode_projeto(dados->>'projetoId') and dados->>'criadoPor' = (select maparh_priv.meu_login())))));

-- 4) Nunca ficar sem administrador ativo (vale também para corrida entre duas alterações)
create or replace function maparh_priv.manter_um_admin() returns trigger language plpgsql security definer set search_path to ''
as $$
begin
  if exists (select 1 from public.maparh_membros) and not exists (select 1 from public.maparh_membros where perfil = 'admin' and ativo) then
    raise exception 'É preciso manter ao menos um administrador ativo.' using errcode = 'P0001';
  end if;
  return null;
end $$;
revoke all on function maparh_priv.manter_um_admin() from public, anon, authenticated;
drop trigger if exists maparh_membros_um_admin on public.maparh_membros;
create constraint trigger maparh_membros_um_admin after update or delete on public.maparh_membros
  deferrable initially deferred for each row execute function maparh_priv.manter_um_admin();

-- 5) Andamento dos candidatos SEM dado pessoal para o painel do Início (qualquer membro do projeto; o RH vê só o dele)
create or replace function public.maparh_andamento(p_projeto text default null)
returns table (id uuid, projeto_id text, vaga_id text, etapa text, situacao text, tipo text, analista text, analista_login text, distrito_id text,
  dinamica text, aso text, treinamento text, criado_em timestamptz, admitido_em date, chegada_data date, etapa_em timestamptz)
language sql stable security definer set search_path to ''
as $$
  select p.id, p.projeto_id, p.vaga_id, p.etapa, p.situacao, p.tipo, p.analista, p.analista_login, p.distrito_id,
    p.dinamica, p.aso, p.treinamento, p.criado_em, p.admitido_em, p.chegada_data, p.etapa_em
  from public.maparh_preadmissoes p
  where (select maparh_priv.perfil()) is not null and maparh_priv.pode_projeto(p.projeto_id)
    and (p_projeto is null or p.projeto_id = p_projeto)
    and ((select maparh_priv.perfil()) <> 'analista' or p.analista_login = (select maparh_priv.meu_login()))
$$;
revoke all on function public.maparh_andamento(text) from public, anon;
grant execute on function public.maparh_andamento(text) to authenticated;
