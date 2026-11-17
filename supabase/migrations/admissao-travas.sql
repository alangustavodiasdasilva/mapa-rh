-- Travas da admissão no próprio banco: nenhuma tela (nem chamada direta à API) consegue admitir quem não cumpre as regras.
-- Regras: CPF informado; data de nascimento informada e 18 anos completos na data da admissão; todos os documentos
-- entregues (nenhum faltando ou recusado); ASO apto ou dispensado; treinamento feito ou dispensado; estar na Documentação.
create or replace function maparh_priv.checar_admissao() returns trigger language plpgsql security definer set search_path to ''
as $$
declare pe record; v_data date; erros text[] := '{}';
begin
  if new.situacao <> 'admitido' or (tg_op = 'UPDATE' and old.situacao = 'admitido') then return new; end if;
  select cpf, nascimento into pe from public.maparh_pessoas where id = new.pessoa_id;
  v_data := coalesce(new.admitido_em, current_date);
  if pe.cpf is null then erros := erros || 'sem CPF'; end if;
  if pe.nascimento is null then erros := erros || 'sem data de nascimento';
  elsif pe.nascimento > (v_data - interval '18 years')::date then erros := erros || 'menor de 18 anos'; end if;
  if new.dinamica is distinct from 'ok' or coalesce(new.documentos_pendentes, '') <> ''
     or jsonb_typeof(new.documentos) is distinct from 'object' or new.documentos = '{}'::jsonb
     or exists (select 1 from jsonb_each_text(new.documentos) d where d.value <> 'entregue') then erros := erros || 'documento pendente'; end if;
  if new.aso not in ('ok', 'dispensado') then erros := erros || 'ASO não concluído'; end if;
  if new.treinamento not in ('ok', 'dispensado') then erros := erros || 'treinamento não concluído'; end if;
  if new.etapa <> 'documentos' then erros := erros || 'não está na etapa de Documentação'; end if;
  if array_length(erros, 1) > 0 then
    raise exception 'ADMISSAO_BLOQUEADA: %', array_to_string(erros, '; ') using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function maparh_priv.checar_admissao() from public, anon, authenticated;

drop trigger if exists maparh_pre_checar_admissao on public.maparh_preadmissoes;
create trigger maparh_pre_checar_admissao before insert or update on public.maparh_preadmissoes
  for each row execute function maparh_priv.checar_admissao();

-- Admitido não volta a ter documento pendente nem muda de etapa sem antes desfazer a admissão
create or replace function maparh_priv.travar_admitido() returns trigger language plpgsql security definer set search_path to ''
as $$
begin
  if old.situacao = 'admitido' and new.situacao = 'admitido' and (
       new.etapa is distinct from old.etapa or new.documentos is distinct from old.documentos
       or new.aso is distinct from old.aso or new.treinamento is distinct from old.treinamento) then
    raise exception 'ADMITIDO_TRAVADO: para mudar etapa, documentos, ASO ou treinamento, desfaça a admissão primeiro.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function maparh_priv.travar_admitido() from public, anon, authenticated;
drop trigger if exists maparh_pre_travar_admitido on public.maparh_preadmissoes;
create trigger maparh_pre_travar_admitido before update on public.maparh_preadmissoes
  for each row execute function maparh_priv.travar_admitido();

-- Data de nascimento que não faz sentido (futuro ou antes de 1920) não é aceita
alter table public.maparh_pessoas drop constraint if exists maparh_pessoas_nascimento_check;
alter table public.maparh_pessoas add constraint maparh_pessoas_nascimento_check check (nascimento is null or (nascimento > date '1920-01-01' and nascimento <= current_date));

-- Data em que a pessoa entrou na etapa atual (para "parado há X dias")
alter table public.maparh_preadmissoes add column if not exists etapa_em timestamptz not null default now();
update public.maparh_preadmissoes set etapa_em = atualizado_em where etapa_em > atualizado_em;
create or replace function maparh_priv.marcar_etapa() returns trigger language plpgsql set search_path to ''
as $$ begin
  if new.etapa is distinct from old.etapa or new.situacao is distinct from old.situacao then new.etapa_em := now(); end if;
  return new;
end $$;
revoke all on function maparh_priv.marcar_etapa() from public, anon, authenticated;
drop trigger if exists maparh_pre_marcar_etapa on public.maparh_preadmissoes;
create trigger maparh_pre_marcar_etapa before update on public.maparh_preadmissoes for each row execute function maparh_priv.marcar_etapa();
