-- Aviso na hora (Supabase Realtime) das mudanças do Mapa RH: vagas/cadastros (maparh_itens) e candidatos (maparh_preadmissoes).
-- Cada usuário só recebe o que a regra de acesso (RLS) já deixa ele ler. Aplicada em 17/11/2026.
alter publication supabase_realtime add table public.maparh_itens, public.maparh_preadmissoes;
