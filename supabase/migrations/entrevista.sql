-- Entrevista e anotações do candidato (aplicada em 17/11/2026 como maparh_entrevista_anotacoes).
-- Colunas: maparh_preadmissoes.entrevista jsonb {data, hora, formato, entrevistador, resultado, avaliacao, notas}
--          maparh_preadmissoes.anotacoes  jsonb [{em, por, nome, etapa, texto}]
-- Funções: maparh_anotar(p_pre, p_texto) — autor e hora gravados pelo banco; maparh_salvar_candidato passa a gravar "entrevista".
-- (o texto completo está na migração aplicada no Supabase; ver o histórico de migrações do projeto)
alter table public.maparh_preadmissoes add column if not exists entrevista jsonb not null default '{}'::jsonb;
alter table public.maparh_preadmissoes add column if not exists anotacoes jsonb not null default '[]'::jsonb;
