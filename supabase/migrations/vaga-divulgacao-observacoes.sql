-- 17/11/2026: o RH responsável pela vaga (além de admin e gestor) marca onde divulgou e escreve observações na vaga.
-- As duas coisas só por estas funções: mexem só nesse pedaço da vaga e gravam quem fez e quando.
create or replace function maparh_priv.pode_mexer_na_vaga(p_vaga text) returns boolean
language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.maparh_itens i where i.colecao = 'vagas' and i.id = p_vaga and not i.removido
    and maparh_priv.pode_projeto(i.dados->>'projetoId'))
  and (maparh_priv.perfil() in ('admin', 'gestor') or maparh_priv.rh_da_vaga(p_vaga))
$$;

create or replace function public.maparh_vaga_divulgacao(p_vaga text, p_canal text, p_marcado boolean)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare d jsonb; agora text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  if not maparh_priv.pode_mexer_na_vaga(p_vaga) then raise exception 'Você não tem permissão para mexer nesta vaga.'; end if;
  if coalesce(btrim(p_canal), '') = '' or length(p_canal) > 40 then raise exception 'Canal inválido.'; end if;
  select dados into d from public.maparh_itens where colecao = 'vagas' and id = p_vaga for update;
  if p_marcado and (coalesce(d->'aprovacao'->>'situacao', '') <> 'aprovada' or d->>'status' in ('aguardando', 'recusada')) then
    raise exception 'Esta vaga ainda não foi aprovada: não pode ser divulgada.';
  end if;
  if p_marcado then
    d := jsonb_set(d, '{divulgacao}', coalesce(d->'divulgacao', '{}'::jsonb) || jsonb_build_object(p_canal, jsonb_build_object('em', agora, 'por', maparh_priv.meu_login())));
    if d->>'status' = 'aberta' then d := jsonb_set(d, '{status}', '"divulgada"'); end if;
  else
    d := jsonb_set(d, '{divulgacao}', coalesce(d->'divulgacao', '{}'::jsonb) - p_canal);
  end if;
  d := jsonb_set(d, '{atualizadoEm}', to_jsonb(agora));
  update public.maparh_itens set dados = d, atualizado_em = now() where colecao = 'vagas' and id = p_vaga;
  insert into public.maparh_auditoria (user_id, login, operacao, tabela, colecao, item_id, antes, depois)
    values (auth.uid(), maparh_priv.meu_login(), case when p_marcado then 'divulgou' else 'tirou divulgação' end, 'maparh_itens', 'vagas', p_vaga, null, jsonb_build_object('canal', p_canal));
  return d;
end $$;

create or replace function public.maparh_vaga_anotar(p_vaga text, p_texto text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare d jsonb; v_nome text; agora text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  if not maparh_priv.pode_mexer_na_vaga(p_vaga) then raise exception 'Você não tem permissão para mexer nesta vaga.'; end if;
  if coalesce(btrim(p_texto), '') = '' then raise exception 'Escreva a observação.'; end if;
  if length(p_texto) > 2000 then raise exception 'Observação muito longa (máximo 2000 letras).'; end if;
  select m.nome into v_nome from public.maparh_membros m where m.user_id = auth.uid();
  select dados into d from public.maparh_itens where colecao = 'vagas' and id = p_vaga for update;
  d := jsonb_set(d, '{anotacoes}', coalesce(d->'anotacoes', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
    'em', agora, 'por', maparh_priv.meu_login(), 'nome', v_nome, 'texto', btrim(p_texto))));
  d := jsonb_set(d, '{atualizadoEm}', to_jsonb(agora));
  update public.maparh_itens set dados = d, atualizado_em = now() where colecao = 'vagas' and id = p_vaga;
  return d;
end $$;

revoke all on function public.maparh_vaga_divulgacao(text, text, boolean) from public, anon;
grant execute on function public.maparh_vaga_divulgacao(text, text, boolean) to authenticated;
revoke all on function public.maparh_vaga_anotar(text, text) from public, anon;
grant execute on function public.maparh_vaga_anotar(text, text) to authenticated;
