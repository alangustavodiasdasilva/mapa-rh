-- Modelos de mensagem do WhatsApp de cada RH (triagem, entrevista, lembrete, documentos, não seguiu)
alter table public.maparh_membros add column if not exists mensagens jsonb;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'maparh_membros_mensagens_check') then
    alter table public.maparh_membros add constraint maparh_membros_mensagens_check
      check (mensagens is null or (jsonb_typeof(mensagens) = 'object' and length(mensagens::text) <= 20000));
  end if;
end $$;

create or replace function public.maparh_definir_mensagens(p_msgs jsonb)
 returns void language plpgsql security definer set search_path to '' as $function$
begin
  if (select maparh_priv.perfil()) is null then raise exception 'Sem permissão.'; end if;
  if p_msgs is not null and jsonb_typeof(p_msgs) <> 'object' then raise exception 'Formato inválido.'; end if;
  update public.maparh_membros set mensagens = p_msgs where user_id = (select auth.uid());
end $function$;
revoke execute on function public.maparh_definir_mensagens(jsonb) from public, anon;
grant execute on function public.maparh_definir_mensagens(jsonb) to authenticated;
