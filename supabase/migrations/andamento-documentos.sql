-- 17/11/2026: o andamento (sem dado pessoal) diz também se falta documento do cargo, para o Início saber quem está pronto para admitir.
drop function if exists public.maparh_andamento(text);
create function public.maparh_andamento(p_projeto text default null)
returns table(id uuid, projeto_id text, vaga_id text, etapa text, situacao text, tipo text, analista text, analista_login text, distrito_id text,
  dinamica text, aso text, treinamento text, criado_em timestamptz, admitido_em date, chegada_data date, etapa_em timestamptz,
  motivo_saida text, entrevista_em timestamptz, documentos_em timestamptz, atualizado_em timestamptz, documentos_pendentes text)
language sql stable security definer set search_path to '' as $$
  select p.id, p.projeto_id, p.vaga_id, p.etapa, p.situacao, p.tipo, p.analista, p.analista_login, p.distrito_id,
    p.dinamica, p.aso, p.treinamento, p.criado_em, p.admitido_em, p.chegada_data, p.etapa_em,
    p.motivo_saida, p.entrevista_em, p.documentos_em, p.atualizado_em,
    case when coalesce(p.documentos_pendentes, '') <> '' then p.documentos_pendentes
         when exists (select 1 from unnest(maparh_priv.docs_do_cargo(p.cargo)) d where coalesce(p.documentos->>d, '') not in ('entregue', 'dispensado')) then 'documentos do cargo'
         else null end
  from public.maparh_preadmissoes p
  where (select maparh_priv.perfil()) is not null and maparh_priv.pode_projeto(p.projeto_id)
    and (p_projeto is null or p.projeto_id = p_projeto)
    and ((select maparh_priv.perfil()) <> 'analista' or p.analista_login = (select maparh_priv.meu_login()) or maparh_priv.rh_da_vaga(p.vaga_id))
$$;
revoke all on function public.maparh_andamento(text) from public, anon;
grant execute on function public.maparh_andamento(text) to authenticated, service_role;
