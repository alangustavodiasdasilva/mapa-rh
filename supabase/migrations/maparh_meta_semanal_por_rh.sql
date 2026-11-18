-- 18/11/2026 — Metas por RH: meta semanal de admissões em maparh_membros.
-- Aditivo: coluna nova (nullable, sem default) + função nova. Quem define: administrador ou gestor (nunca a própria,
-- a não ser o administrador). O RH (analista) e o visualizador não mudam meta nenhuma: a tabela não tem UPDATE
-- liberado para authenticated, então o único caminho é esta função.
alter table public.maparh_membros add column if not exists meta_semanal integer;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'maparh_membros_meta_semanal_check') then
    alter table public.maparh_membros add constraint maparh_membros_meta_semanal_check
      check (meta_semanal is null or (meta_semanal >= 0 and meta_semanal <= 999));
  end if;
end $$;
comment on column public.maparh_membros.meta_semanal is 'Meta de admissões por semana (segunda a domingo) deste RH. null = sem meta.';

create or replace function public.maparh_definir_meta(p_usuario uuid, p_meta integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v_perfil text := (select maparh_priv.perfil());
begin
  if v_perfil is null or v_perfil not in ('admin', 'gestor') then
    raise exception 'Só administrador ou gestor define a meta.';
  end if;
  if v_perfil <> 'admin' and p_usuario = (select auth.uid()) then
    raise exception 'Você não pode definir a própria meta.';
  end if;
  if p_meta is not null and (p_meta < 0 or p_meta > 999) then
    raise exception 'A meta deve ficar entre 0 e 999.';
  end if;
  update public.maparh_membros set meta_semanal = p_meta where user_id = p_usuario;
  if not found then raise exception 'Usuário não encontrado.'; end if;
end $$;
revoke all on function public.maparh_definir_meta(uuid, integer) from public, anon;
grant execute on function public.maparh_definir_meta(uuid, integer) to authenticated;
