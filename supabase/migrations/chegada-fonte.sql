-- 17/11/2026 (aplicada): chegada no campo, "como soube da vaga" e indicação.
-- maparh_salvar_candidato e maparh_priv.historico_e_autor foram ajustadas por troca de texto na própria migração aplicada
-- (aceitam chegada_status/fonte/indicado_por; o histórico anota "Chegou ao campo." / "Não chegou ao campo (faltou)." / "Chegada remarcada.").
-- O texto completo atual das funções está em supabase/esquema-atual.sql (regerar depois desta migração).
alter table public.maparh_preadmissoes
  add column if not exists chegada_status text,
  add column if not exists fonte text,
  add column if not exists indicado_por text;
do $$ begin
  alter table public.maparh_preadmissoes add constraint maparh_pre_chegada_status_check check (chegada_status is null or chegada_status in ('aguardando','chegou','faltou','remarcou'));
exception when duplicate_object then null; end $$;
-- maparh_andamento passou a devolver também chegada_status e fonte (ver andamento-documentos.sql para o formato; colunas a mais no fim).
