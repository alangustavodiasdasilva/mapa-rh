-- Esquema do Mapa RH gerado em 17/11/2026 a partir do banco (só leitura). Para recriar: rodar em ordem num banco novo.
-- Projeto Supabase: rmkkmlreqemdtnlhpkgh. Escopo: public.maparh_*, schema maparh_priv, RLS, gatilhos, grants, realtime.
-- Não inclui o schema "saboaria" (outro sistema). Não inclui dados.
-- Ordem: schema, tabelas, constraints, índices, RLS, funções, constraint que usa função, gatilhos, políticas, grants, publicação.

set check_function_bodies = off;

create schema if not exists maparh_priv;
grant usage on schema maparh_priv to authenticated;

-- ============================================================
-- TABELAS
-- ============================================================

create table public.maparh_auditoria (
  id bigint generated always as identity not null,
  quando timestamp with time zone default now() not null,
  user_id uuid,
  login text,
  operacao text not null,
  tabela text not null,
  colecao text,
  item_id text,
  antes jsonb,
  depois jsonb
);

create table public.maparh_importacoes (
  id uuid default gen_random_uuid() not null,
  projeto_id text not null,
  arquivo text,
  criado_em timestamp with time zone default now() not null,
  criado_por uuid default auth.uid(),
  criado_login text,
  linhas integer default 0 not null,
  importadas integer default 0 not null,
  ignoradas integer default 0 not null,
  desfeita_em timestamp with time zone,
  detalhes jsonb
);

create table public.maparh_itens (
  colecao text not null,
  id text not null,
  dados jsonb,
  removido boolean default false not null,
  atualizado_em timestamp with time zone default now() not null,
  atualizado_por uuid
);

create table public.maparh_membros (
  user_id uuid not null,
  login text not null,
  nome text not null,
  perfil text not null,
  projetos jsonb,
  ativo boolean default true not null,
  criado_em timestamp with time zone default now() not null,
  rh boolean default false not null,
  foto text,
  mensagens jsonb
);

create table public.maparh_pessoas (
  id uuid default gen_random_uuid() not null,
  cpf text,
  nome text not null,
  nascimento date,
  telefone text,
  email text,
  cnh text,
  cidade_origem_id text,
  ex_colaborador boolean default false not null,
  lote_importacao uuid,
  criado_em timestamp with time zone default now() not null,
  criado_por uuid default auth.uid(),
  atualizado_em timestamp with time zone default now() not null
);

create table public.maparh_preadmissoes (
  id uuid default gen_random_uuid() not null,
  pessoa_id uuid not null,
  projeto_id text not null,
  tipo text default 'LOCAL'::text not null,
  cidade_atuacao_id text,
  base_id text,
  cargo text,
  unidade text,
  analista text,
  status_texto text,
  dinamica text default 'pendente'::text not null,
  aso text default 'pendente'::text not null,
  aso_data date,
  treinamento text default 'pendente'::text not null,
  chegada_data date,
  chegada_hora time without time zone,
  grupo_whatsapp text,
  observacao text,
  situacao text default 'em_andamento'::text not null,
  admitido_em date,
  registro_id text,
  lote_importacao uuid,
  criado_em timestamp with time zone default now() not null,
  criado_por uuid default auth.uid(),
  atualizado_em timestamp with time zone default now() not null,
  documentos_pendentes text,
  documentos jsonb default '{}'::jsonb not null,
  etapa text default 'triagem'::text not null,
  vaga_id text,
  distrito_id text,
  distancia_km numeric,
  analista_login text,
  etapa_em timestamp with time zone default now() not null,
  entrevista jsonb default '{}'::jsonb not null,
  anotacoes jsonb default '[]'::jsonb not null,
  atualizado_por text,
  aso_local text,
  treinamento_data date,
  treinamento_local text,
  motivo_saida text,
  entrevista_em timestamp with time zone,
  documentos_em timestamp with time zone
);

-- Cópia de segurança pontual de 17/11/2026 (sem RLS, só postgres acessa).
create table maparh_priv.backup_registros_20261117 (
  colecao text,
  id text,
  dados jsonb,
  removido boolean,
  atualizado_em timestamp with time zone,
  atualizado_por uuid
);

-- ============================================================
-- CONSTRAINTS (o CHECK de CPF fica mais abaixo, depois das funções)
-- A constraint maparh_membros_um_admin é criada junto com os gatilhos.
-- ============================================================

alter table public.maparh_auditoria add constraint maparh_auditoria_pkey PRIMARY KEY (id);
alter table public.maparh_importacoes add constraint maparh_importacoes_pkey PRIMARY KEY (id);
alter table public.maparh_itens add constraint maparh_itens_pkey PRIMARY KEY (colecao, id);
alter table public.maparh_membros add constraint maparh_membros_foto_check CHECK (((foto IS NULL) OR ((foto ~ '^data:image/(jpeg|png|webp);base64,'::text) AND (length(foto) <= 120000))));
alter table public.maparh_membros add constraint maparh_membros_login_key UNIQUE (login);
alter table public.maparh_membros add constraint maparh_membros_mensagens_check CHECK (((mensagens IS NULL) OR ((jsonb_typeof(mensagens) = 'object'::text) AND (length((mensagens)::text) <= 20000))));
alter table public.maparh_membros add constraint maparh_membros_perfil_check CHECK ((perfil = ANY (ARRAY['admin'::text, 'gestor'::text, 'analista'::text, 'leitor'::text])));
alter table public.maparh_membros add constraint maparh_membros_pkey PRIMARY KEY (user_id);
alter table public.maparh_pessoas add constraint maparh_pessoas_cpf_key UNIQUE (cpf);
alter table public.maparh_pessoas add constraint maparh_pessoas_nascimento_check CHECK (((nascimento IS NULL) OR ((nascimento > '1920-01-01'::date) AND (nascimento <= CURRENT_DATE))));
alter table public.maparh_pessoas add constraint maparh_pessoas_nome_check CHECK ((length(btrim(nome)) > 1));
alter table public.maparh_pessoas add constraint maparh_pessoas_pkey PRIMARY KEY (id);
alter table public.maparh_preadmissoes add constraint maparh_preadmissoes_aso_check CHECK ((aso = ANY (ARRAY['pendente'::text, 'agendado'::text, 'ok'::text, 'inapto'::text, 'dispensado'::text])));
alter table public.maparh_preadmissoes add constraint maparh_preadmissoes_dinamica_check CHECK ((dinamica = ANY (ARRAY['pendente'::text, 'agendada'::text, 'ok'::text, 'reprovado'::text, 'dispensada'::text])));
alter table public.maparh_preadmissoes add constraint maparh_preadmissoes_etapa_check CHECK ((etapa = ANY (ARRAY['triagem'::text, 'entrevista'::text, 'documentos'::text])));
alter table public.maparh_preadmissoes add constraint maparh_preadmissoes_pkey PRIMARY KEY (id);
alter table public.maparh_preadmissoes add constraint maparh_preadmissoes_situacao_check CHECK ((situacao = ANY (ARRAY['em_andamento'::text, 'admitido'::text, 'reprovado'::text, 'desistiu'::text])));
alter table public.maparh_preadmissoes add constraint maparh_preadmissoes_tipo_check CHECK ((tipo = ANY (ARRAY['LOCAL'::text, 'MOVEL'::text])));
alter table public.maparh_preadmissoes add constraint maparh_preadmissoes_treinamento_check CHECK ((treinamento = ANY (ARRAY['pendente'::text, 'agendado'::text, 'ok'::text, 'reprovado'::text, 'dispensado'::text])));
alter table public.maparh_membros add constraint maparh_membros_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.maparh_pessoas add constraint maparh_pessoas_lote_importacao_fkey FOREIGN KEY (lote_importacao) REFERENCES public.maparh_importacoes(id) ON DELETE SET NULL;
alter table public.maparh_preadmissoes add constraint maparh_preadmissoes_lote_importacao_fkey FOREIGN KEY (lote_importacao) REFERENCES public.maparh_importacoes(id) ON DELETE SET NULL;
alter table public.maparh_preadmissoes add constraint maparh_preadmissoes_pessoa_id_fkey FOREIGN KEY (pessoa_id) REFERENCES public.maparh_pessoas(id) ON DELETE RESTRICT;

-- ============================================================
-- ÍNDICES (os que não vêm de constraint)
-- ============================================================

CREATE INDEX maparh_auditoria_quando_idx ON public.maparh_auditoria USING btree (quando DESC);
CREATE INDEX maparh_itens_atualizado_idx ON public.maparh_itens USING btree (atualizado_em);
CREATE INDEX maparh_itens_projeto_idx ON public.maparh_itens USING btree (((dados ->> 'projetoId'::text))) WHERE (colecao = ANY (ARRAY['registros'::text, 'vagas'::text]));
CREATE INDEX maparh_pre_analista_idx ON public.maparh_preadmissoes USING btree (projeto_id, analista);
CREATE INDEX maparh_pre_analista_login_idx ON public.maparh_preadmissoes USING btree (projeto_id, analista_login);
CREATE INDEX maparh_pre_lote_idx ON public.maparh_preadmissoes USING btree (lote_importacao);
CREATE INDEX maparh_pre_pessoa_idx ON public.maparh_preadmissoes USING btree (pessoa_id);
CREATE INDEX maparh_pre_projeto_idx ON public.maparh_preadmissoes USING btree (projeto_id, chegada_data);
CREATE INDEX maparh_pre_vaga_idx ON public.maparh_preadmissoes USING btree (vaga_id);
CREATE UNIQUE INDEX maparh_pre_unica_aberta ON public.maparh_preadmissoes USING btree (pessoa_id, projeto_id) WHERE (situacao = 'em_andamento'::text);
CREATE UNIQUE INDEX maparh_pre_unica_admitida ON public.maparh_preadmissoes USING btree (pessoa_id, projeto_id) WHERE (situacao = 'admitido'::text);

-- ============================================================
-- RLS
-- ============================================================

alter table public.maparh_auditoria enable row level security;
alter table public.maparh_importacoes enable row level security;
alter table public.maparh_itens enable row level security;
alter table public.maparh_membros enable row level security;
alter table public.maparh_pessoas enable row level security;
alter table public.maparh_preadmissoes enable row level security;
-- (realtime.messages já vem com RLS ligado no Supabase)

-- ============================================================
-- FUNÇÕES: schema maparh_priv
-- ============================================================

CREATE OR REPLACE FUNCTION maparh_priv.apagar_registro_da_admissao(p_pre uuid, p_reg text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if exists (select 1 from public.maparh_preadmissoes where id = p_pre and situacao = 'admitido') then raise exception 'Ainda está admitido.'; end if;
  if p_reg is null then return; end if;
  if p_reg <> 'adm-' || p_pre::text then raise exception 'Contratação não corresponde a esta admissão.'; end if;
  update public.maparh_itens set removido = true where colecao = 'registros' and id = p_reg;
end $function$
;

CREATE OR REPLACE FUNCTION maparh_priv.auditar_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_login text;
  v_op text;
  v_antes jsonb; v_depois jsonb;
  v_col text; v_id text;
begin
  v_col := coalesce(new.colecao, old.colecao); v_id := coalesce(new.id, old.id);
  -- o registro de ações da tela e os carimbos de busca do SINE não são dado de negócio
  if v_col = 'auditoria' or (v_col = 'meta' and v_id in ('sineBusca', 'sineBuscaUF')) then return null; end if;
  if tg_op = 'INSERT' then v_op := 'criou'; v_depois := new.dados;
  elsif tg_op = 'DELETE' then v_op := 'apagou'; v_antes := old.dados;
  else
    if new.dados is not distinct from old.dados and new.removido = old.removido then return null; end if;
    v_op := case when new.removido and not old.removido then 'removeu' else 'alterou' end;
    v_antes := old.dados; v_depois := new.dados;
  end if;
  -- itens muito grandes (mapa de unidades inteiro, base de agências): guarda só que mudou, não o conteúdo
  if v_antes is not null and pg_column_size(v_antes) > 60000 then v_antes := jsonb_build_object('_grande', true, 'nome', v_antes->>'nome'); end if;
  if v_depois is not null and pg_column_size(v_depois) > 60000 then v_depois := jsonb_build_object('_grande', true, 'nome', v_depois->>'nome'); end if;
  select m.login into v_login from public.maparh_membros m where m.user_id = v_uid;
  insert into public.maparh_auditoria (user_id, login, operacao, tabela, colecao, item_id, antes, depois)
  values (v_uid, v_login, v_op, 'maparh_itens', v_col, v_id, v_antes, v_depois);
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION maparh_priv.auditar_linha()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid := auth.uid(); v_login text; v_antes jsonb; v_depois jsonb;
begin
  if tg_op <> 'INSERT' then v_antes := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_depois := to_jsonb(new); end if;
  if tg_op = 'UPDATE' and (v_antes - 'atualizado_em') = (v_depois - 'atualizado_em') then return null; end if;
  select m.login into v_login from public.maparh_membros m where m.user_id = v_uid;
  insert into public.maparh_auditoria (user_id, login, operacao, tabela, colecao, item_id, antes, depois)
  values (v_uid, v_login, case tg_op when 'INSERT' then 'criou' when 'DELETE' then 'apagou' else 'alterou' end, tg_table_name, tg_argv[0],
    coalesce(v_depois->>'id', v_antes->>'id'), v_antes, v_depois);
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION maparh_priv.auditar_membro()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid := auth.uid(); v_login text;
begin
  select m.login into v_login from public.maparh_membros m where m.user_id = v_uid;
  insert into public.maparh_auditoria (user_id, login, operacao, tabela, colecao, item_id, antes, depois)
  values (v_uid, coalesce(v_login, 'servidor'), case tg_op when 'INSERT' then 'criou' when 'DELETE' then 'apagou' else 'alterou' end,
    'maparh_membros', 'usuarios', coalesce(new.login, old.login),
    case when tg_op <> 'INSERT' then jsonb_build_object('login', old.login, 'nome', old.nome, 'perfil', old.perfil, 'ativo', old.ativo, 'projetos', old.projetos) end,
    case when tg_op <> 'DELETE' then jsonb_build_object('login', new.login, 'nome', new.nome, 'perfil', new.perfil, 'ativo', new.ativo, 'projetos', new.projetos) end);
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION maparh_priv.carimbar_auditoria()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.colecao = 'auditoria' then
    new.dados := jsonb_set(coalesce(new.dados, '{}'::jsonb), '{usuario}', to_jsonb(coalesce(maparh_priv.meu_login(), 'desconhecido')));
    if coalesce(new.dados->>'quando', '') = '' or (new.dados->>'quando')::timestamptz > now() + interval '5 minutes' then
      new.dados := jsonb_set(new.dados, '{quando}', to_jsonb(to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
    end if;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION maparh_priv.carimbar()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ begin new.atualizado_em := now(); new.atualizado_por := auth.uid(); return new; end $function$
;

CREATE OR REPLACE FUNCTION maparh_priv.checar_admissao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare pe record; v_data date; erros text[] := '{}'; v_falta text[];
begin
  if new.situacao <> 'admitido' or (tg_op = 'UPDATE' and old.situacao = 'admitido') then return new; end if;
  new.admitido_em := (now() at time zone 'America/Sao_Paulo')::date;
  v_data := new.admitido_em;
  if new.registro_id is null or new.registro_id <> 'adm-' || new.id::text then erros := erros || 'use o botão Admitir'::text; end if;
  select cpf, nascimento into pe from public.maparh_pessoas where id = new.pessoa_id;
  if pe.cpf is null then erros := erros || 'sem CPF'::text; end if;
  if pe.nascimento is null then erros := erros || 'sem data de nascimento'::text;
  elsif pe.nascimento > (v_data - interval '18 years')::date then erros := erros || 'menor de 18 anos'::text; end if;
  select array_agg(r) into v_falta from unnest(maparh_priv.docs_do_cargo(new.cargo)) r where coalesce(new.documentos->>r, '') not in ('entregue', 'dispensado');
  if v_falta is not null then erros := erros || ('documento do cargo pendente: ' || array_to_string(v_falta, ', '))::text; end if;
  if new.dinamica is distinct from 'ok' or coalesce(new.documentos_pendentes, '') <> ''
     or jsonb_typeof(new.documentos) is distinct from 'object'
     or exists (select 1 from jsonb_each_text(new.documentos) d where d.value not in ('entregue', 'dispensado')) then erros := erros || 'documento pendente'::text; end if;
  if new.aso not in ('ok', 'dispensado') then erros := erros || 'ASO não concluído'::text;
  elsif new.aso = 'ok' and (new.aso_data is null or new.aso_data > v_data) then erros := erros || 'ASO apto sem data (ou com data no futuro)'::text; end if;
  if new.treinamento not in ('ok', 'dispensado') then erros := erros || 'treinamento não concluído'::text; end if;
  if new.etapa <> 'documentos' then erros := erros || 'não está na etapa de Documentação'::text; end if;
  if new.vaga_id is not null and exists (select 1 from public.maparh_itens v where v.colecao = 'vagas' and v.id = new.vaga_id and (v.removido or v.dados->>'status' in ('cancelada', 'recusada'))) then
    erros := erros || 'a vaga foi cancelada ou recusada'::text; end if;
  if array_length(erros, 1) > 0 then raise exception 'ADMISSAO_BLOQUEADA: %', array_to_string(erros, '; ') using errcode = 'P0001'; end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION maparh_priv.cpf_valido(p text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare s int; i int; d1 int; d2 int;
begin
  if p is null or p !~ '^[0-9]{11}$' or p ~ '^(.)\1{10}$' then return false; end if;
  s := 0; for i in 1..9 loop s := s + substr(p, i, 1)::int * (11 - i); end loop;
  d1 := (s * 10) % 11; if d1 = 10 then d1 := 0; end if;
  s := 0; for i in 1..10 loop s := s + substr(p, i, 1)::int * (12 - i); end loop;
  d2 := (s * 10) % 11; if d2 = 10 then d2 := 0; end if;
  return d1 = substr(p, 10, 1)::int and d2 = substr(p, 11, 1)::int;
end $function$
;

CREATE OR REPLACE FUNCTION maparh_priv.docs_do_cargo(p_cargo text)
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(
    (select array(select jsonb_array_elements_text(i.dados->'documentos')) from public.maparh_itens i
      where i.colecao = 'cargos' and not i.removido and maparh_priv.norm(i.dados->>'nome') = maparh_priv.norm(p_cargo)
        and jsonb_array_length(coalesce(i.dados->'documentos', '[]'::jsonb)) > 0 limit 1),
    array['Carteira de Trabalho digital', 'RG e CPF', 'Comprovante de residência', 'Número do PIS/NIS', 'Título de eleitor', 'Certificado de reservista',
      'Certidão de nascimento ou casamento', 'Certidão de nascimento dos filhos', 'Comprovante de escolaridade', 'Exame admissional', 'Foto 3x4',
      'Dados bancários', 'CNH', 'Registro no conselho de classe'])
$function$
;

CREATE OR REPLACE FUNCTION maparh_priv.fechar_importacao(p_lote uuid, p_ok integer, p_ign integer, p_det jsonb)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ update public.maparh_importacoes set importadas = p_ok, ignoradas = p_ign, detalhes = p_det where id = p_lote $function$
;

CREATE OR REPLACE FUNCTION maparh_priv.guardar_admissao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or current_setting('maparh.via_funcao', true) = '1' then return new; end if;
  if (tg_op = 'INSERT' and (new.situacao = 'admitido' or new.registro_id is not null))
     or (tg_op = 'UPDATE' and ((new.situacao = 'admitido') is distinct from (old.situacao = 'admitido')
                               or new.registro_id is distinct from old.registro_id or new.admitido_em is distinct from old.admitido_em)) then
    raise exception 'ADMISSAO_SO_PELO_BOTAO: para admitir ou desfazer a admissão, use os botões Admitir / Desfazer' using errcode = 'P0001';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION maparh_priv.guardar_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_old public.maparh_itens; v_base text; v_perfil text;
begin
  if new.colecao = 'auditoria' then return new; end if;
  select * into v_old from public.maparh_itens where colecao = new.colecao and id = new.id;
  if new.dados is not null and new.dados ? '_base' then
    v_base := nullif(new.dados->>'_base', '');
    new.dados := new.dados - '_base';
    if v_old.id is not null and not v_old.removido and v_base is not null and auth.uid() is not null
       and nullif(v_old.dados->>'atualizadoEm', '') is not null and (v_old.dados->>'atualizadoEm') is distinct from v_base then
      raise exception 'CONFLITO_VERSAO_ITEM: outra pessoa alterou "%" antes de você', coalesce(v_old.dados->>'titulo', v_old.dados->>'nome', new.id) using errcode = 'P0001';
    end if;
  end if;
  if new.removido and (new.dados is null or new.dados = '{}'::jsonb) and v_old.id is not null then new.dados := v_old.dados; end if;
  if auth.uid() is not null and new.colecao = 'vagas' then
    v_perfil := maparh_priv.perfil();
    if coalesce(new.dados->'aprovacao'->>'situacao', '') in ('aprovada', 'recusada')
       and coalesce(new.dados->'aprovacao'->>'situacao', '') is distinct from coalesce(v_old.dados->'aprovacao'->>'situacao', '')
       and v_perfil is distinct from 'admin' then
      raise exception 'REGRA_VAGA: só um administrador pode aprovar ou recusar vagas' using errcode = 'P0001';
    end if;
    if new.removido and not coalesce(v_old.removido, true)
       and exists (select 1 from public.maparh_preadmissoes p where p.vaga_id = new.id and p.situacao in ('em_andamento', 'admitido')) then
      raise exception 'REGRA_VAGA: a vaga "%" tem candidatos; use Cancelar vaga em vez de excluir', coalesce(v_old.dados->>'titulo', new.id) using errcode = 'P0001';
    end if;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION maparh_priv.historico_e_autor()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_login text; v_nome text; v_add jsonb := '[]'::jsonb; v_dest text; v_txt text; v_dist text; n_ok int; n_tot int; n_old int;
  rot constant jsonb := '{"triagem":"Triagem","entrevista":"Entrevista","documentos":"Documentação"}';
  aso constant jsonb := '{"pendente":"pendente","agendado":"agendado","ok":"apto","inapto":"inapto","dispensado":"dispensado"}';
  tre constant jsonb := '{"pendente":"pendente","agendado":"agendado","ok":"concluído","reprovado":"reprovado","dispensado":"dispensado"}';
begin
  select m.login, m.nome into v_login, v_nome from public.maparh_membros m where m.user_id = auth.uid();
  if v_login is not null then new.atualizado_por := v_login; end if;
  if tg_op = 'UPDATE' and new.anotacoes is distinct from old.anotacoes and auth.uid() is not null then
    n_old := coalesce(jsonb_array_length(old.anotacoes), 0);
    if coalesce(jsonb_array_length(new.anotacoes), 0) < n_old
       or coalesce((select jsonb_agg(e order by i) from jsonb_array_elements(new.anotacoes) with ordinality t(e, i) where i <= n_old), '[]'::jsonb)
          is distinct from coalesce(old.anotacoes, '[]'::jsonb) then
      raise exception 'HISTORICO_PROTEGIDO: o histórico não pode ser apagado nem alterado; acrescente uma anotação' using errcode = 'P0001';
    end if;
    new.anotacoes := coalesce(old.anotacoes, '[]'::jsonb) || coalesce((select jsonb_agg(e || jsonb_build_object('por', v_login, 'nome', coalesce(v_nome, e->>'nome'),
        'em', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')) order by i)
      from jsonb_array_elements(new.anotacoes) with ordinality t(e, i) where i > n_old), '[]'::jsonb);
  end if;
  if tg_op = 'INSERT' then
    if coalesce(jsonb_array_length(new.anotacoes), 0) = 0 then
      v_add := v_add || jsonb_build_array('Cadastrado na ' || coalesce(rot->>new.etapa, new.etapa) || '.');
    end if;
    if new.etapa in ('entrevista', 'documentos') then new.entrevista_em := coalesce(new.entrevista_em, now()); end if;
    if new.etapa = 'documentos' then new.documentos_em := coalesce(new.documentos_em, now()); end if;
  else
    if new.etapa is distinct from old.etapa then
      v_add := v_add || jsonb_build_array('Passou para ' || coalesce(rot->>new.etapa, new.etapa) || '.');
      if new.etapa in ('entrevista', 'documentos') and new.entrevista_em is null then new.entrevista_em := now(); end if;
      if new.etapa = 'documentos' and new.documentos_em is null then new.documentos_em := now(); end if;
    end if;
    if new.situacao is distinct from old.situacao then
      if new.situacao = 'admitido' then
        select d.dados->>'nome' into v_dist from public.maparh_itens d where d.colecao = 'distritos' and d.id = new.distrito_id;
        v_txt := 'Admitido' || coalesce(' como ' || nullif(new.cargo, ''), '') || coalesce(' · ' || v_dist, '')
          || ' · ' || case when new.tipo = 'MOVEL' then 'móvel' else 'local' end || '.';
        v_add := v_add || jsonb_build_array(v_txt);
      elsif old.situacao = 'admitido' then
        null;
      elsif new.situacao = 'em_andamento' then
        new.motivo_saida := null;
        v_add := v_add || jsonb_build_array('Voltou para o processo.');
      elsif new.situacao in ('reprovado', 'desistiu') and new.motivo_saida is null then
        v_add := v_add || jsonb_build_array('Saiu do processo (' || case when new.situacao = 'reprovado' then 'reprovado' else 'desistiu' end || ').');
      end if;
    end if;
    if new.analista_login is distinct from old.analista_login and new.analista_login is not null then
      select m.nome into v_dest from public.maparh_membros m where m.login = new.analista_login;
      v_add := v_add || jsonb_build_array('Direcionado para ' || coalesce(v_dest, new.analista_login) || '.');
    end if;
    if coalesce(old.entrevista->>'data', '') = '' and coalesce(new.entrevista->>'data', '') <> '' then
      v_add := v_add || jsonb_build_array('Entrevista marcada para ' || to_char((new.entrevista->>'data')::date, 'DD/MM')
        || coalesce(' às ' || nullif(new.entrevista->>'hora', ''), '') || '.');
    end if;
    if coalesce(old.entrevista->>'confirmou', '') is distinct from coalesce(new.entrevista->>'confirmou', '') and coalesce(new.entrevista->>'confirmou', '') <> '' then
      v_add := v_add || jsonb_build_array(case when new.entrevista->>'confirmou' = 'sim' then 'Confirmou presença na entrevista.' else 'Não confirmou presença na entrevista.' end);
    end if;
    if new.aso is distinct from old.aso then
      v_add := v_add || jsonb_build_array('ASO: ' || coalesce(aso->>new.aso, new.aso) || coalesce(' (' || to_char(new.aso_data, 'DD/MM') || ')', '')
        || coalesce(' · ' || nullif(new.aso_local, ''), '') || '.');
    end if;
    if new.treinamento is distinct from old.treinamento then
      v_add := v_add || jsonb_build_array('Treinamento: ' || coalesce(tre->>new.treinamento, new.treinamento)
        || coalesce(' (' || to_char(new.treinamento_data, 'DD/MM') || ')', '') || coalesce(' · ' || nullif(new.treinamento_local, ''), '') || '.');
    end if;
    if new.documentos is distinct from old.documentos then
      select count(*) filter (where value in ('entregue', 'dispensado')), count(*) into n_ok, n_tot from jsonb_each_text(coalesce(new.documentos, '{}'::jsonb));
      if n_tot > 0 then v_add := v_add || jsonb_build_array('Documentos: ' || n_ok || ' de ' || n_tot || ' entregues.'); end if;
    end if;
    if new.chegada_data is distinct from old.chegada_data and new.chegada_data is not null then
      v_add := v_add || jsonb_build_array('Chegada marcada para ' || to_char(new.chegada_data, 'DD/MM') || coalesce(' às ' || to_char(new.chegada_hora, 'HH24:MI'), '') || '.');
    end if;
  end if;
  if jsonb_array_length(v_add) > 0 then
    new.anotacoes := coalesce(new.anotacoes, '[]'::jsonb) || (
      select jsonb_agg(jsonb_build_object('em', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'por', v_login, 'nome', coalesce(v_nome, 'Sistema'), 'etapa', new.etapa, 'texto', t, 'auto', true))
      from jsonb_array_elements_text(v_add) t);
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION maparh_priv.irrestrito()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select exists (select 1 from public.maparh_membros m where m.user_id = (select auth.uid()) and m.ativo and (m.perfil = 'admin' or (m.perfil = 'gestor' and m.projetos is null))) $function$
;

CREATE OR REPLACE FUNCTION maparh_priv.manter_um_admin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if exists (select 1 from public.maparh_membros) and not exists (select 1 from public.maparh_membros where perfil = 'admin' and ativo) then
    raise exception 'É preciso manter ao menos um administrador ativo.' using errcode = 'P0001';
  end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION maparh_priv.marcar_etapa()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ begin
  if new.etapa is distinct from old.etapa or new.situacao is distinct from old.situacao then new.etapa_em := now(); end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION maparh_priv.meu_login()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select m.login from public.maparh_membros m where m.user_id = (select auth.uid()) and m.ativo $function$
;

CREATE OR REPLACE FUNCTION maparh_priv.norm(t text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select lower(regexp_replace(translate(btrim(coalesce(t, '')),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'), '\s+', ' ', 'g'))
$function$
;

CREATE OR REPLACE FUNCTION maparh_priv.perfil()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select m.perfil from public.maparh_membros m where m.user_id = (select auth.uid()) and m.ativo $function$
;

CREATE OR REPLACE FUNCTION maparh_priv.pessoa_minha(p_pessoa uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.maparh_pessoas x where x.id = p_pessoa and x.criado_por = (select auth.uid())
                   and not exists (select 1 from public.maparh_preadmissoes y where y.pessoa_id = x.id and y.analista_login is distinct from maparh_priv.meu_login()))
      or exists (select 1 from public.maparh_preadmissoes y where y.pessoa_id = p_pessoa and y.analista_login = maparh_priv.meu_login())
$function$
;

CREATE OR REPLACE FUNCTION maparh_priv.pode_projeto(p_projeto text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p_projeto is null or exists (
    select 1 from public.maparh_membros m
    where m.user_id = (select auth.uid()) and m.ativo and (m.projetos is null or m.projetos ? p_projeto))
$function$
;

CREATE OR REPLACE FUNCTION maparh_priv.pode_rh()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select exists (select 1 from public.maparh_membros m where m.user_id = (select auth.uid()) and m.ativo and (m.perfil in ('admin', 'analista') or m.rh)) $function$
;

CREATE OR REPLACE FUNCTION maparh_priv.projeto_do_item(p_colecao text, p_id text, p_dados jsonb)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case
    when p_colecao = 'projetos' then p_id
    when p_colecao in ('registros', 'vagas') then p_dados->>'projetoId'
    when p_colecao = 'candidatos' then (select v.dados->>'projetoId' from public.maparh_itens v where v.colecao = 'vagas' and v.id = p_dados->>'vagaId')
    else null end
$function$
;

CREATE OR REPLACE FUNCTION maparh_priv.registrar_importacao(p_lote uuid, p_projeto text, p_arquivo text, p_login text, p_linhas integer)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ insert into public.maparh_importacoes (id, projeto_id, arquivo, criado_login, linhas) values (p_lote, p_projeto, p_arquivo, p_login, p_linhas) $function$
;

CREATE OR REPLACE FUNCTION maparh_priv.registro_da_admissao(p_pre uuid, p_atuacao text, p_base text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r record; v_origem text; d jsonb;
begin
  select * into r from public.maparh_preadmissoes where id = p_pre;
  if r.id is null or r.situacao <> 'admitido' or r.registro_id is distinct from 'adm-' || p_pre::text then raise exception 'Admissão inválida.'; end if;
  if coalesce(p_atuacao, '') !~ '^[A-Z]{2}:.{1,90}$' or (p_base is not null and p_base !~ '^[A-Z]{2}:.{1,90}$') then raise exception 'Cidade de trabalho inválida.'; end if;
  select cidade_origem_id into v_origem from public.maparh_pessoas where id = r.pessoa_id;
  if v_origem is null then raise exception 'Pessoa sem cidade de origem.'; end if;
  d := jsonb_build_object('id', r.registro_id, 'projetoId', r.projeto_id, 'tipo', r.tipo, 'cidadeId', v_origem, 'atuacao', p_atuacao,
    'baseContratacao', coalesce(p_base, p_atuacao), 'criadoEm', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'criadoPor', maparh_priv.meu_login(), 'preadmissaoId', p_pre, 'vagaId', r.vaga_id, 'cargo', r.cargo, 'distritoId', r.distrito_id,
    'admitidoEm', r.admitido_em, 'rhLogin', r.analista_login);
  insert into public.maparh_itens (colecao, id, dados, removido) values ('registros', r.registro_id, d, false)
    on conflict (colecao, id) do update set dados = excluded.dados, removido = false;
  return d;
end $function$
;

CREATE OR REPLACE FUNCTION maparh_priv.rh_da_vaga(p_vaga text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p_vaga is not null and exists (select 1 from public.maparh_itens i
    where i.colecao = 'vagas' and i.id = p_vaga and not i.removido
      and (i.dados->>'recrutadorLogin' = maparh_priv.meu_login() or coalesce(i.dados->'recrutadores', '[]'::jsonb) ? maparh_priv.meu_login()))
$function$
;

CREATE OR REPLACE FUNCTION maparh_priv.rh_ve_tudo()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select exists (select 1 from public.maparh_membros m where m.user_id = (select auth.uid()) and m.ativo and (m.perfil = 'admin' or (m.rh and m.perfil <> 'analista'))) $function$
;

CREATE OR REPLACE FUNCTION maparh_priv.tocar()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ begin new.atualizado_em := now(); return new; end $function$
;

CREATE OR REPLACE FUNCTION maparh_priv.travar_admitido()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if old.situacao <> 'admitido' then return new; end if;
  if new.situacao = 'admitido' then
    if (new.pessoa_id, new.projeto_id, new.etapa, new.documentos, new.aso, new.treinamento, new.admitido_em, new.registro_id, new.tipo,
        new.cidade_atuacao_id, new.base_id, new.distrito_id, new.vaga_id, new.cargo, new.dinamica)
       is distinct from
       (old.pessoa_id, old.projeto_id, old.etapa, old.documentos, old.aso, old.treinamento, old.admitido_em, old.registro_id, old.tipo,
        old.cidade_atuacao_id, old.base_id, old.distrito_id, old.vaga_id, old.cargo, old.dinamica) then
      raise exception 'ADMITIDO_TRAVADO: para mudar os dados da admissão, desfaça a admissão primeiro.' using errcode = 'P0001';
    end if;
  elsif new.situacao = 'em_andamento' then
    new.admitido_em := null; new.registro_id := null;
  else
    raise exception 'ADMITIDO_TRAVADO: quem foi admitido só pode voltar para "em andamento" (desfazer admissão).' using errcode = 'P0001';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION maparh_priv.travar_pessoa_admitida()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (new.cpf is distinct from old.cpf or new.nascimento is distinct from old.nascimento)
     and exists (select 1 from public.maparh_preadmissoes p where p.pessoa_id = old.id and p.situacao = 'admitido') then
    raise exception 'PESSOA_ADMITIDA_TRAVADA: esta pessoa já foi admitida; CPF e data de nascimento não podem mais mudar.' using errcode = 'P0001';
  end if;
  return new;
end $function$
;

-- ============================================================
-- FUNÇÕES: schema public (maparh_*)
-- ============================================================

CREATE OR REPLACE FUNCTION public.maparh_admitir(p_pre uuid, p_atuacao text, p_base text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_id uuid; r record; v jsonb; v_ped int; v_adm int; v_outro text;
begin
  select * into r from public.maparh_preadmissoes where id = p_pre;
  if r.id is null then raise exception 'Não deu para admitir: candidato não encontrado ou sem permissão.'; end if;
  select pr.projeto_id into v_outro from public.maparh_preadmissoes pr where pr.pessoa_id = r.pessoa_id and pr.id <> r.id and pr.situacao = 'admitido' limit 1;
  if v_outro is not null then raise exception 'ADMISSAO_BLOQUEADA: esta pessoa já está admitida em outro projeto; desfaça lá antes'; end if;
  if r.vaga_id is not null then
    perform pg_advisory_xact_lock(hashtext('maparh-vaga-' || r.vaga_id));
    select dados into v from public.maparh_itens where colecao = 'vagas' and id = r.vaga_id and not removido;
    if v is not null then
      if jsonb_typeof(v->'distritos') = 'array' and jsonb_array_length(v->'distritos') > 0 then
        select coalesce(sum(case when r.tipo = 'MOVEL' then (d->>'moveis')::int else (d->>'locais')::int end), 0) into v_ped
          from jsonb_array_elements(v->'distritos') d where d->>'distritoId' = r.distrito_id;
        select count(*) into v_adm from public.maparh_preadmissoes x
          where x.vaga_id = r.vaga_id and x.situacao = 'admitido' and x.distrito_id is not distinct from r.distrito_id and x.tipo = r.tipo;
        if v_ped is not null and v_adm >= v_ped then
          raise exception 'ADMISSAO_BLOQUEADA: a vaga já completou os % deste distrito (% de %); aumente o pedido da vaga ou escolha outro distrito',
            case when r.tipo = 'MOVEL' then 'móveis' else 'locais' end, v_adm, v_ped;
        end if;
      else
        v_ped := nullif(v->>'quantidade', '')::int;
        select count(*) into v_adm from public.maparh_preadmissoes x where x.vaga_id = r.vaga_id and x.situacao = 'admitido';
        if v_ped is not null and v_adm >= v_ped then raise exception 'ADMISSAO_BLOQUEADA: a vaga já está completa (% de %)', v_adm, v_ped; end if;
      end if;
    end if;
  end if;
  perform set_config('maparh.via_funcao', '1', true);
  update public.maparh_preadmissoes set situacao = 'admitido', registro_id = 'adm-' || p_pre::text
    where id = p_pre and situacao = 'em_andamento' returning id into v_id;
  perform set_config('maparh.via_funcao', '', true);
  if v_id is null then raise exception 'Não deu para admitir: o candidato não está em andamento ou você não tem permissão sobre ele.'; end if;
  return maparh_priv.registro_da_admissao(p_pre, p_atuacao, p_base);
end $function$
;

CREATE OR REPLACE FUNCTION public.maparh_andamento(p_projeto text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, projeto_id text, vaga_id text, etapa text, situacao text, tipo text, analista text, analista_login text, distrito_id text, dinamica text, aso text, treinamento text, criado_em timestamp with time zone, admitido_em date, chegada_data date, etapa_em timestamp with time zone, motivo_saida text, entrevista_em timestamp with time zone, documentos_em timestamp with time zone, atualizado_em timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p.id, p.projeto_id, p.vaga_id, p.etapa, p.situacao, p.tipo, p.analista, p.analista_login, p.distrito_id,
    p.dinamica, p.aso, p.treinamento, p.criado_em, p.admitido_em, p.chegada_data, p.etapa_em,
    p.motivo_saida, p.entrevista_em, p.documentos_em, p.atualizado_em
  from public.maparh_preadmissoes p
  where (select maparh_priv.perfil()) is not null and maparh_priv.pode_projeto(p.projeto_id)
    and (p_projeto is null or p.projeto_id = p_projeto)
    and ((select maparh_priv.perfil()) <> 'analista' or p.analista_login = (select maparh_priv.meu_login()) or maparh_priv.rh_da_vaga(p.vaga_id))
$function$
;

CREATE OR REPLACE FUNCTION public.maparh_anonimizar_antigos(p_meses integer, p_so_contar boolean DEFAULT true)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_n int := 0; r record;
begin
  if maparh_priv.perfil() is distinct from 'admin' then raise exception 'Só um administrador pode fazer a limpeza de dados.'; end if;
  if coalesce(p_meses, 0) < 6 then raise exception 'O prazo mínimo é de 6 meses.'; end if;
  for r in
    select pe.id from public.maparh_pessoas pe
    where pe.nome <> 'Dados apagados (LGPD)'
      and not exists (select 1 from public.maparh_preadmissoes p where p.pessoa_id = pe.id and p.situacao in ('admitido', 'em_andamento'))
      and coalesce((select max(p.atualizado_em) from public.maparh_preadmissoes p where p.pessoa_id = pe.id), pe.atualizado_em) < now() - make_interval(months => p_meses)
  loop
    v_n := v_n + 1;
    if not p_so_contar then perform public.maparh_anonimizar_pessoa(r.id, 'prazo de ' || p_meses || ' meses sem contratação'); end if;
  end loop;
  return v_n;
end $function$
;

CREATE OR REPLACE FUNCTION public.maparh_anonimizar_pessoa(p_pessoa uuid, p_motivo text DEFAULT 'pedido do titular'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if maparh_priv.perfil() is distinct from 'admin' then raise exception 'Só um administrador pode apagar dados pessoais.'; end if;
  if exists (select 1 from public.maparh_preadmissoes where pessoa_id = p_pessoa and situacao = 'admitido') then
    raise exception 'Esta pessoa está admitida: desfaça a admissão antes (os dados de quem trabalha na empresa precisam ficar guardados).';
  end if;
  update public.maparh_pessoas set nome = 'Dados apagados (LGPD)', cpf = null, telefone = null, email = null, nascimento = null, cnh = null
    where id = p_pessoa;
  if not found then raise exception 'Pessoa não encontrada.'; end if;
  update public.maparh_preadmissoes set observacao = null, grupo_whatsapp = null, documentos_pendentes = null where pessoa_id = p_pessoa;
  update public.maparh_auditoria set
      antes = case when antes is null then null else antes - 'nome' - 'cpf' - 'telefone' - 'email' - 'nascimento' - 'cnh' end,
      depois = case when depois is null then null else depois - 'nome' - 'cpf' - 'telefone' - 'email' - 'nascimento' - 'cnh' end
    where tabela = 'maparh_pessoas' and item_id = p_pessoa::text;
  insert into public.maparh_auditoria (user_id, login, operacao, tabela, colecao, item_id, antes, depois)
    values (auth.uid(), maparh_priv.meu_login(), 'anonimizou', 'maparh_pessoas', 'pessoas', p_pessoa::text, null, jsonb_build_object('motivo', coalesce(p_motivo, '')));
end $function$
;

CREATE OR REPLACE FUNCTION public.maparh_anotar(p_pre uuid, p_texto text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v jsonb; v_login text; v_nome text;
begin
  if coalesce(btrim(p_texto), '') = '' then raise exception 'Escreva a anotação.'; end if;
  if length(p_texto) > 2000 then raise exception 'Anotação muito longa (máximo 2000 letras).'; end if;
  select m.login, m.nome into v_login, v_nome from public.maparh_membros m where m.user_id = auth.uid();
  update public.maparh_preadmissoes set anotacoes = coalesce(anotacoes, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'em', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'por', v_login, 'nome', v_nome, 'etapa', etapa, 'texto', btrim(p_texto)))
    where id = p_pre returning anotacoes into v;
  if v is null then raise exception 'Sem permissão para anotar neste candidato.'; end if;
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.maparh_contagem_vagas(p_projeto text DEFAULT NULL::text)
 RETURNS TABLE(vaga_id text, distrito_id text, tipo text, situacao text, etapa text, n bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p.vaga_id, p.distrito_id, p.tipo, p.situacao, p.etapa, count(*)
  from public.maparh_preadmissoes p
  where (select maparh_priv.perfil()) is not null and maparh_priv.pode_projeto(p.projeto_id)
    and p.vaga_id is not null and p.situacao in ('admitido', 'em_andamento') and (p_projeto is null or p.projeto_id = p_projeto)
  group by 1, 2, 3, 4, 5
$function$
;

CREATE OR REPLACE FUNCTION public.maparh_definir_foto(p_usuario uuid, p_foto text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (select maparh_priv.perfil()) is null then raise exception 'Sem permissão.'; end if;
  if p_usuario <> (select auth.uid()) and (select maparh_priv.perfil()) is distinct from 'admin' then
    raise exception 'Só o administrador muda a foto de outra pessoa.';
  end if;
  update public.maparh_membros set foto = nullif(p_foto, '') where user_id = p_usuario;
end $function$
;

CREATE OR REPLACE FUNCTION public.maparh_definir_mensagens(p_msgs jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (select maparh_priv.perfil()) is null then raise exception 'Sem permissão.'; end if;
  if p_msgs is not null and jsonb_typeof(p_msgs) <> 'object' then raise exception 'Formato inválido.'; end if;
  update public.maparh_membros set mensagens = p_msgs where user_id = (select auth.uid());
end $function$
;

CREATE OR REPLACE FUNCTION public.maparh_definir_rh(p_usuario uuid, p_rh boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (select maparh_priv.perfil()) is distinct from 'admin' then raise exception 'Somente administradores podem liberar o acesso à pré-admissão.'; end if;
  update public.maparh_membros set rh = p_rh where user_id = p_usuario;
end $function$
;

CREATE OR REPLACE FUNCTION public.maparh_desfazer_admissao(p_pre uuid, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_reg text; v_id uuid;
begin
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Informe o motivo para desfazer a admissão.'; end if;
  select registro_id into v_reg from public.maparh_preadmissoes where id = p_pre and situacao = 'admitido';
  perform set_config('maparh.via_funcao', '1', true);
  update public.maparh_preadmissoes set situacao = 'em_andamento' where id = p_pre and situacao = 'admitido' returning id into v_id;
  perform set_config('maparh.via_funcao', '', true);
  if v_id is null then raise exception 'Não deu para desfazer: a pessoa não está admitida ou você não tem permissão sobre ela.'; end if;
  perform maparh_priv.apagar_registro_da_admissao(p_pre, v_reg);
  perform public.maparh_anotar(p_pre, 'Admissão desfeita: ' || btrim(p_motivo));
end $function$
;

CREATE OR REPLACE FUNCTION public.maparh_desfazer_importacao(p_lote uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_proj text; v_pre int; v_pes int; v_ficam int; v_mexidos int;
begin
  select projeto_id into v_proj from public.maparh_importacoes where id = p_lote and desfeita_em is null;
  if v_proj is null then raise exception 'Importação não encontrada ou já desfeita.'; end if;
  if not (select maparh_priv.rh_ve_tudo()) or not maparh_priv.pode_projeto(v_proj) then raise exception 'Sem permissão para desfazer esta importação.'; end if;
  select count(*) into v_ficam from public.maparh_preadmissoes where lote_importacao = p_lote and situacao = 'admitido';
  select count(*) into v_mexidos from public.maparh_preadmissoes where lote_importacao = p_lote and situacao <> 'admitido' and atualizado_em > criado_em + interval '5 seconds';
  delete from public.maparh_preadmissoes where lote_importacao = p_lote and situacao <> 'admitido' and atualizado_em <= criado_em + interval '5 seconds';
  get diagnostics v_pre = row_count;
  delete from public.maparh_pessoas p where p.lote_importacao = p_lote and not exists (select 1 from public.maparh_preadmissoes x where x.pessoa_id = p.id);
  get diagnostics v_pes = row_count;
  update public.maparh_importacoes set desfeita_em = now() where id = p_lote;
  return jsonb_build_object('preadmissoes', v_pre, 'pessoas', v_pes, 'admitidos_mantidos', v_ficam, 'mexidos_mantidos', v_mexidos);
end $function$
;

CREATE OR REPLACE FUNCTION public.maparh_importar_preadmissoes(p_projeto text, p_arquivo text, p_linhas jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_lote uuid; l jsonb; v_pessoa uuid; v_ok int := 0; v_ign int := 0; v_det jsonb := '[]'::jsonb; v_login text; i int := 0; v_cpf text; v_tel text;
begin
  if not (select maparh_priv.rh_ve_tudo()) or not maparh_priv.pode_projeto(p_projeto) then raise exception 'Sem permissão para importar neste projeto.'; end if;
  select m.login into v_login from public.maparh_membros m where m.user_id = auth.uid();
  v_lote := gen_random_uuid();
  perform maparh_priv.registrar_importacao(v_lote, p_projeto, p_arquivo, v_login, jsonb_array_length(p_linhas));
  for l in select * from jsonb_array_elements(p_linhas) loop
    i := i + 1;
    if coalesce(l->>'situacao_planilha', '') in ('admitido', 'fora') then
      v_ign := v_ign + 1; v_det := v_det || jsonb_build_object('linha', i, 'nome', l->>'nome', 'motivo', case when l->>'situacao_planilha' = 'admitido' then 'já consta como admitido na planilha' else 'consta como fora do processo na planilha' end);
      continue;
    end if;
    v_cpf := nullif(l->>'cpf', ''); v_pessoa := null;
    v_tel := nullif(regexp_replace(coalesce(l->>'telefone', ''), '\D', '', 'g'), '');
    if v_cpf is not null then
      select id into v_pessoa from public.maparh_pessoas where cpf = v_cpf;
    elsif v_tel is not null then
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
      if exists (select 1 from public.maparh_preadmissoes where pessoa_id = v_pessoa and projeto_id = p_projeto and situacao = 'admitido') then
        v_ign := v_ign + 1; v_det := v_det || jsonb_build_object('linha', i, 'cpf', v_cpf, 'nome', l->>'nome', 'motivo', 'já foi admitida neste projeto');
        continue;
      end if;
      update public.maparh_pessoas set
        nascimento = coalesce(nascimento, nullif(l->>'nascimento', '')::date), telefone = coalesce(telefone, nullif(l->>'telefone', '')),
        email = coalesce(email, nullif(l->>'email', '')), cnh = coalesce(cnh, nullif(l->>'cnh', '')),
        cidade_origem_id = coalesce(cidade_origem_id, nullif(l->>'cidade_origem_id', ''))
      where id = v_pessoa;
    end if;
    if exists (select 1 from public.maparh_preadmissoes where pessoa_id = v_pessoa and projeto_id = p_projeto and situacao in ('reprovado', 'desistiu')) then
      v_ign := v_ign + 1; v_det := v_det || jsonb_build_object('linha', i, 'cpf', v_cpf, 'nome', l->>'nome', 'motivo', 'já saiu do processo neste projeto (está em Não seguiram: use Retomar)');
      continue;
    end if;
    if exists (select 1 from public.maparh_preadmissoes where pessoa_id = v_pessoa and projeto_id = p_projeto and situacao = 'em_andamento') then
      v_ign := v_ign + 1; v_det := v_det || jsonb_build_object('linha', i, 'cpf', v_cpf, 'nome', l->>'nome', 'motivo', 'já está em andamento neste projeto');
      continue;
    end if;
    insert into public.maparh_preadmissoes (pessoa_id, projeto_id, tipo, cidade_atuacao_id, base_id, analista, analista_login, status_texto, aso_data, aso, treinamento,
      chegada_data, chegada_hora, grupo_whatsapp, observacao, lote_importacao, etapa, vaga_id, distrito_id, distancia_km, cargo, unidade)
    values (v_pessoa, p_projeto, coalesce(nullif(l->>'tipo', ''), 'LOCAL'), nullif(l->>'cidade_atuacao_id', ''), nullif(l->>'base_id', ''),
      nullif(l->>'analista', ''), nullif(l->>'analista_login', ''), nullif(l->>'status_texto', ''), nullif(l->>'aso_data', '')::date,
      coalesce(nullif(l->>'aso', ''), case when nullif(l->>'aso_data', '') is null then 'pendente' else 'agendado' end), coalesce(nullif(l->>'treinamento', ''), 'pendente'),
      nullif(l->>'chegada_data', '')::date, nullif(l->>'chegada_hora', '')::time, nullif(l->>'grupo_whatsapp', ''), nullif(l->>'observacao', ''), v_lote,
      coalesce(nullif(l->>'etapa', ''), 'documentos'), nullif(l->>'vaga_id', ''), nullif(l->>'distrito_id', ''), nullif(l->>'distancia_km', '')::numeric,
      nullif(l->>'cargo', ''), nullif(l->>'unidade', ''));
    v_ok := v_ok + 1;
  end loop;
  perform maparh_priv.fechar_importacao(v_lote, v_ok, v_ign, v_det);
  return jsonb_build_object('lote', v_lote, 'importadas', v_ok, 'ignoradas', v_ign, 'detalhes', v_det);
end $function$
;

CREATE OR REPLACE FUNCTION public.maparh_pessoa_do_cpf(p_cpf text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v jsonb; v_id uuid;
begin
  if not (select maparh_priv.pode_rh()) then raise exception 'Sem permissão.'; end if;
  select id into v_id from public.maparh_pessoas where cpf = p_cpf;
  if v_id is null then return null; end if;
  if not (select maparh_priv.rh_ve_tudo()) and not maparh_priv.pessoa_minha(v_id) then
    return jsonb_build_object('id', v_id, 'restrito', true);
  end if;
  select to_jsonb(p) || jsonb_build_object('historico', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'projeto_id', x.projeto_id, 'situacao', x.situacao, 'admitido_em', x.admitido_em, 'criado_em', x.criado_em))
    from public.maparh_preadmissoes x where x.pessoa_id = p.id), '[]'::jsonb))
  into v from public.maparh_pessoas p where p.id = v_id;
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.maparh_salvar_candidato(p_pessoa jsonb, p_pre jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_pes uuid := nullif(p_pessoa->>'id', '')::uuid; v_pre uuid := nullif(p_pre->>'id', '')::uuid; v_n int;
  tem constant jsonb := p_pre; pe constant jsonb := p_pessoa; v_atual timestamptz; v_por text; v_nome text;
begin
  if v_pre is not null and tem ? 'versao' and nullif(tem->>'versao', '') is not null then
    select atualizado_em, atualizado_por into v_atual, v_por from public.maparh_preadmissoes where id = v_pre;
    if v_atual is not null and date_trunc('milliseconds', v_atual) > date_trunc('milliseconds', (tem->>'versao')::timestamptz) then
      select nome into v_nome from public.maparh_membros where login = v_por;
      raise exception 'CONFLITO_VERSAO: % alterou esta ficha às % (depois que você abriu). Feche e abra de novo para ver o que mudou; nada foi gravado.',
        coalesce(v_nome, v_por, 'outra pessoa'), to_char(v_atual at time zone 'America/Sao_Paulo', 'HH24:MI') using errcode = 'P0001';
    end if;
  end if;
  if v_pes is not null then
    update public.maparh_pessoas set
      nome = case when pe ? 'nome' then pe->>'nome' else nome end,
      nascimento = case when pe ? 'nascimento' then nullif(pe->>'nascimento', '')::date else nascimento end,
      telefone = case when pe ? 'telefone' then nullif(pe->>'telefone', '') else telefone end,
      email = case when pe ? 'email' then nullif(pe->>'email', '') else email end,
      cnh = case when pe ? 'cnh' then nullif(pe->>'cnh', '') else cnh end,
      cidade_origem_id = case when pe ? 'cidade_origem_id' then nullif(pe->>'cidade_origem_id', '') else cidade_origem_id end,
      ex_colaborador = case when pe ? 'ex_colaborador' then coalesce((pe->>'ex_colaborador')::boolean, false) else ex_colaborador end,
      cpf = coalesce(nullif(pe->>'cpf', ''), cpf)
    where id = v_pes;
    get diagnostics v_n = row_count;
    if v_n = 0 then raise exception 'Sem permissão para alterar os dados desta pessoa.'; end if;
  else
    insert into public.maparh_pessoas (cpf, nome, nascimento, telefone, email, cnh, cidade_origem_id, ex_colaborador)
    values (nullif(pe->>'cpf', ''), pe->>'nome', nullif(pe->>'nascimento', '')::date, nullif(pe->>'telefone', ''), nullif(pe->>'email', ''),
      nullif(pe->>'cnh', ''), nullif(pe->>'cidade_origem_id', ''), coalesce((pe->>'ex_colaborador')::boolean, false))
    returning id into v_pes;
  end if;
  if v_pre is not null then
    update public.maparh_preadmissoes set
      etapa = case when tem ? 'etapa' then coalesce(nullif(tem->>'etapa', ''), etapa) else etapa end,
      tipo = case when tem ? 'tipo' then coalesce(nullif(tem->>'tipo', ''), tipo) else tipo end,
      vaga_id = case when tem ? 'vaga_id' then nullif(tem->>'vaga_id', '') else vaga_id end,
      distrito_id = case when tem ? 'distrito_id' then nullif(tem->>'distrito_id', '') else distrito_id end,
      distancia_km = case when tem ? 'distancia_km' then nullif(tem->>'distancia_km', '')::numeric else distancia_km end,
      cidade_atuacao_id = case when tem ? 'cidade_atuacao_id' then nullif(tem->>'cidade_atuacao_id', '') else cidade_atuacao_id end,
      base_id = case when tem ? 'base_id' then nullif(tem->>'base_id', '') else base_id end,
      cargo = case when tem ? 'cargo' then nullif(tem->>'cargo', '') else cargo end,
      unidade = case when tem ? 'unidade' then nullif(tem->>'unidade', '') else unidade end,
      analista = case when tem ? 'analista' then nullif(tem->>'analista', '') else analista end,
      analista_login = case when tem ? 'analista_login' then nullif(tem->>'analista_login', '') else analista_login end,
      aso = case when tem ? 'aso' then coalesce(nullif(tem->>'aso', ''), aso) else aso end,
      aso_data = case when tem ? 'aso_data' then nullif(tem->>'aso_data', '')::date else aso_data end,
      aso_local = case when tem ? 'aso_local' then nullif(tem->>'aso_local', '') else aso_local end,
      treinamento = case when tem ? 'treinamento' then coalesce(nullif(tem->>'treinamento', ''), treinamento) else treinamento end,
      treinamento_data = case when tem ? 'treinamento_data' then nullif(tem->>'treinamento_data', '')::date else treinamento_data end,
      treinamento_local = case when tem ? 'treinamento_local' then nullif(tem->>'treinamento_local', '') else treinamento_local end,
      chegada_data = case when tem ? 'chegada_data' then nullif(tem->>'chegada_data', '')::date else chegada_data end,
      chegada_hora = case when tem ? 'chegada_hora' then nullif(tem->>'chegada_hora', '')::time else chegada_hora end,
      grupo_whatsapp = case when tem ? 'grupo_whatsapp' then nullif(tem->>'grupo_whatsapp', '') else grupo_whatsapp end,
      observacao = case when tem ? 'observacao' then nullif(tem->>'observacao', '') else observacao end,
      motivo_saida = case when tem ? 'motivo_saida' then nullif(tem->>'motivo_saida', '') else motivo_saida end,
      documentos = case when tem ? 'documentos' then coalesce(tem->'documentos', '{}'::jsonb) else documentos end,
      dinamica = case when tem ? 'dinamica' then tem->>'dinamica' else dinamica end,
      documentos_pendentes = case when tem ? 'documentos_pendentes' then nullif(tem->>'documentos_pendentes', '') else documentos_pendentes end,
      entrevista = case when tem ? 'entrevista' then coalesce(tem->'entrevista', '{}'::jsonb) else entrevista end,
      situacao = case when tem ? 'situacao' then tem->>'situacao' else situacao end
    where id = v_pre;
    get diagnostics v_n = row_count;
    if v_n = 0 then raise exception 'Sem permissão para alterar este candidato (ele pode ter sido direcionado para outro RH).'; end if;
  else
    insert into public.maparh_preadmissoes (pessoa_id, projeto_id, etapa, tipo, vaga_id, distrito_id, distancia_km, cidade_atuacao_id, base_id, cargo, unidade,
      analista, analista_login, aso, aso_data, aso_local, treinamento, treinamento_data, treinamento_local, chegada_data, chegada_hora, grupo_whatsapp, observacao, entrevista)
    values (v_pes, tem->>'projeto_id', coalesce(nullif(tem->>'etapa', ''), 'triagem'), coalesce(nullif(tem->>'tipo', ''), 'LOCAL'), nullif(tem->>'vaga_id', ''), nullif(tem->>'distrito_id', ''),
      nullif(tem->>'distancia_km', '')::numeric, nullif(tem->>'cidade_atuacao_id', ''), nullif(tem->>'base_id', ''), nullif(tem->>'cargo', ''), nullif(tem->>'unidade', ''),
      nullif(tem->>'analista', ''), nullif(tem->>'analista_login', ''), coalesce(nullif(tem->>'aso', ''), 'pendente'), nullif(tem->>'aso_data', '')::date, nullif(tem->>'aso_local', ''),
      coalesce(nullif(tem->>'treinamento', ''), 'pendente'), nullif(tem->>'treinamento_data', '')::date, nullif(tem->>'treinamento_local', ''),
      nullif(tem->>'chegada_data', '')::date, nullif(tem->>'chegada_hora', '')::time,
      nullif(tem->>'grupo_whatsapp', ''), nullif(tem->>'observacao', ''), coalesce(tem->'entrevista', '{}'::jsonb))
    returning id into v_pre;
  end if;
  return v_pre;
end $function$
;

-- ============================================================
-- CONSTRAINT que depende de função (precisa vir depois das funções)
-- ============================================================

alter table public.maparh_pessoas add constraint maparh_pessoas_cpf_check CHECK (((cpf IS NULL) OR maparh_priv.cpf_valido(cpf)));

-- ============================================================
-- GATILHOS (inclui a constraint trigger maparh_membros_um_admin)
-- ============================================================

CREATE TRIGGER maparh_itens_auditoria AFTER INSERT OR DELETE OR UPDATE ON public.maparh_itens FOR EACH ROW EXECUTE FUNCTION maparh_priv.auditar_item();
CREATE TRIGGER maparh_itens_carimbar_auditoria BEFORE INSERT OR UPDATE ON public.maparh_itens FOR EACH ROW EXECUTE FUNCTION maparh_priv.carimbar_auditoria();
CREATE TRIGGER maparh_itens_carimbo BEFORE INSERT OR UPDATE ON public.maparh_itens FOR EACH ROW EXECUTE FUNCTION maparh_priv.carimbar();
CREATE TRIGGER maparh_itens_guardar BEFORE INSERT OR UPDATE ON public.maparh_itens FOR EACH ROW EXECUTE FUNCTION maparh_priv.guardar_item();
CREATE TRIGGER maparh_membros_auditoria AFTER INSERT OR DELETE OR UPDATE ON public.maparh_membros FOR EACH ROW EXECUTE FUNCTION maparh_priv.auditar_membro();
CREATE CONSTRAINT TRIGGER maparh_membros_um_admin AFTER DELETE OR UPDATE ON public.maparh_membros DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION maparh_priv.manter_um_admin();
CREATE TRIGGER maparh_pessoas_auditoria AFTER INSERT OR DELETE OR UPDATE ON public.maparh_pessoas FOR EACH ROW EXECUTE FUNCTION maparh_priv.auditar_linha('pessoas');
CREATE TRIGGER maparh_pessoas_tocar BEFORE UPDATE ON public.maparh_pessoas FOR EACH ROW EXECUTE FUNCTION maparh_priv.tocar();
CREATE TRIGGER maparh_pessoas_travar_admitida BEFORE UPDATE ON public.maparh_pessoas FOR EACH ROW EXECUTE FUNCTION maparh_priv.travar_pessoa_admitida();
CREATE TRIGGER maparh_pre_a_guardar_admissao BEFORE INSERT OR UPDATE ON public.maparh_preadmissoes FOR EACH ROW EXECUTE FUNCTION maparh_priv.guardar_admissao();
CREATE TRIGGER maparh_pre_auditoria AFTER INSERT OR DELETE OR UPDATE ON public.maparh_preadmissoes FOR EACH ROW EXECUTE FUNCTION maparh_priv.auditar_linha('preadmissoes');
CREATE TRIGGER maparh_pre_checar_admissao BEFORE INSERT OR UPDATE ON public.maparh_preadmissoes FOR EACH ROW EXECUTE FUNCTION maparh_priv.checar_admissao();
CREATE TRIGGER maparh_pre_historico BEFORE INSERT OR UPDATE ON public.maparh_preadmissoes FOR EACH ROW EXECUTE FUNCTION maparh_priv.historico_e_autor();
CREATE TRIGGER maparh_pre_marcar_etapa BEFORE UPDATE ON public.maparh_preadmissoes FOR EACH ROW EXECUTE FUNCTION maparh_priv.marcar_etapa();
CREATE TRIGGER maparh_pre_tocar BEFORE UPDATE ON public.maparh_preadmissoes FOR EACH ROW EXECUTE FUNCTION maparh_priv.tocar();
CREATE TRIGGER maparh_pre_travar_admitido BEFORE UPDATE ON public.maparh_preadmissoes FOR EACH ROW EXECUTE FUNCTION maparh_priv.travar_admitido();

-- ============================================================
-- POLÍTICAS RLS
-- ============================================================

CREATE POLICY maparh_auditoria_ler ON public.maparh_auditoria AS PERMISSIVE FOR SELECT TO authenticated
  USING (( SELECT maparh_priv.perfil() AS perfil) = 'admin'::text);

CREATE POLICY maparh_imp_ler ON public.maparh_importacoes AS PERMISSIVE FOR SELECT TO authenticated
  USING (( SELECT maparh_priv.pode_rh() AS pode_rh) AND maparh_priv.pode_projeto(projeto_id));

CREATE POLICY maparh_itens_alterar ON public.maparh_itens AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((NOT ((colecao = 'registros'::text) AND (id ~~ 'adm-%'::text))) AND (((( SELECT maparh_priv.perfil() AS perfil) = ANY (ARRAY['admin'::text, 'gestor'::text])) AND (colecao <> 'auditoria'::text) AND maparh_priv.pode_projeto(maparh_priv.projeto_do_item(colecao, id, dados)) AND ((maparh_priv.projeto_do_item(colecao, id, dados) IS NOT NULL) OR ( SELECT maparh_priv.irrestrito() AS irrestrito))) OR ((( SELECT maparh_priv.perfil() AS perfil) = 'analista'::text) AND (colecao = 'registros'::text) AND maparh_priv.pode_projeto((dados ->> 'projetoId'::text)) AND ((dados ->> 'criadoPor'::text) = ( SELECT maparh_priv.meu_login() AS meu_login)))))
  WITH CHECK ((NOT ((colecao = 'registros'::text) AND (id ~~ 'adm-%'::text))) AND (((( SELECT maparh_priv.perfil() AS perfil) = ANY (ARRAY['admin'::text, 'gestor'::text])) AND (colecao <> 'auditoria'::text) AND (removido OR (maparh_priv.pode_projeto(maparh_priv.projeto_do_item(colecao, id, dados)) AND ((maparh_priv.projeto_do_item(colecao, id, dados) IS NOT NULL) OR ( SELECT maparh_priv.irrestrito() AS irrestrito))))) OR ((( SELECT maparh_priv.perfil() AS perfil) = 'analista'::text) AND (colecao = 'registros'::text) AND (removido OR (maparh_priv.pode_projeto((dados ->> 'projetoId'::text)) AND ((dados ->> 'criadoPor'::text) = ( SELECT maparh_priv.meu_login() AS meu_login)))))));

CREATE POLICY maparh_itens_apagar ON public.maparh_itens AS PERMISSIVE FOR DELETE TO authenticated
  USING (( SELECT maparh_priv.perfil() AS perfil) = 'admin'::text);

CREATE POLICY maparh_itens_inserir ON public.maparh_itens AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT ((colecao = 'registros'::text) AND (id ~~ 'adm-%'::text))) AND (((colecao = 'auditoria'::text) AND (( SELECT maparh_priv.perfil() AS perfil) IS NOT NULL)) OR ((( SELECT maparh_priv.perfil() AS perfil) = ANY (ARRAY['admin'::text, 'gestor'::text])) AND (colecao <> 'auditoria'::text) AND maparh_priv.pode_projeto(maparh_priv.projeto_do_item(colecao, id, dados)) AND ((maparh_priv.projeto_do_item(colecao, id, dados) IS NOT NULL) OR ( SELECT maparh_priv.irrestrito() AS irrestrito))) OR ((( SELECT maparh_priv.perfil() AS perfil) = 'analista'::text) AND (colecao = 'registros'::text) AND maparh_priv.pode_projeto((dados ->> 'projetoId'::text)) AND ((dados ->> 'criadoPor'::text) = ( SELECT maparh_priv.meu_login() AS meu_login)))));

CREATE POLICY maparh_itens_ler ON public.maparh_itens AS PERMISSIVE FOR SELECT TO public
  USING ((( SELECT maparh_priv.perfil() AS perfil) IS NOT NULL) AND ((colecao <> 'auditoria'::text) OR (( SELECT maparh_priv.perfil() AS perfil) = 'admin'::text)) AND maparh_priv.pode_projeto(maparh_priv.projeto_do_item(colecao, id, dados)) AND ((( SELECT maparh_priv.perfil() AS perfil) <> 'analista'::text) OR (colecao <> 'vagas'::text) OR ((dados ->> 'recrutadorLogin'::text) = ( SELECT maparh_priv.meu_login() AS meu_login)) OR (COALESCE((dados -> 'recrutadores'::text), '[]'::jsonb) ? ( SELECT maparh_priv.meu_login() AS meu_login)) OR (EXISTS ( SELECT 1
   FROM public.maparh_preadmissoes pa
  WHERE ((pa.vaga_id = maparh_itens.id) AND (pa.analista_login = ( SELECT maparh_priv.meu_login() AS meu_login)))))));

CREATE POLICY maparh_membros_ler ON public.maparh_membros AS PERMISSIVE FOR SELECT TO authenticated
  USING (( SELECT maparh_priv.perfil() AS perfil) IS NOT NULL);

CREATE POLICY maparh_pessoas_alterar ON public.maparh_pessoas AS PERMISSIVE FOR UPDATE TO public
  USING (( SELECT maparh_priv.pode_rh() AS pode_rh) AND (( SELECT maparh_priv.rh_ve_tudo() AS rh_ve_tudo) OR (criado_por = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.maparh_preadmissoes p
  WHERE ((p.pessoa_id = maparh_pessoas.id) AND ((p.analista_login = ( SELECT maparh_priv.meu_login() AS meu_login)) OR maparh_priv.rh_da_vaga(p.vaga_id)))))))
  WITH CHECK (( SELECT maparh_priv.pode_rh() AS pode_rh));

CREATE POLICY maparh_pessoas_apagar ON public.maparh_pessoas AS PERMISSIVE FOR DELETE TO authenticated
  USING (( SELECT maparh_priv.rh_ve_tudo() AS rh_ve_tudo));

CREATE POLICY maparh_pessoas_inserir ON public.maparh_pessoas AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (( SELECT maparh_priv.pode_rh() AS pode_rh));

CREATE POLICY maparh_pessoas_ler ON public.maparh_pessoas AS PERMISSIVE FOR SELECT TO public
  USING (( SELECT maparh_priv.pode_rh() AS pode_rh) AND (( SELECT maparh_priv.rh_ve_tudo() AS rh_ve_tudo) OR (criado_por = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.maparh_preadmissoes p
  WHERE ((p.pessoa_id = maparh_pessoas.id) AND ((p.analista_login = ( SELECT maparh_priv.meu_login() AS meu_login)) OR maparh_priv.rh_da_vaga(p.vaga_id)))))));

CREATE POLICY maparh_pre_alterar ON public.maparh_preadmissoes AS PERMISSIVE FOR UPDATE TO public
  USING (( SELECT maparh_priv.pode_rh() AS pode_rh) AND maparh_priv.pode_projeto(projeto_id) AND (( SELECT maparh_priv.rh_ve_tudo() AS rh_ve_tudo) OR (analista_login = ( SELECT maparh_priv.meu_login() AS meu_login)) OR maparh_priv.rh_da_vaga(vaga_id)))
  WITH CHECK (( SELECT maparh_priv.pode_rh() AS pode_rh) AND maparh_priv.pode_projeto(projeto_id) AND (( SELECT maparh_priv.rh_ve_tudo() AS rh_ve_tudo) OR (analista_login = ( SELECT maparh_priv.meu_login() AS meu_login)) OR maparh_priv.rh_da_vaga(vaga_id)));

CREATE POLICY maparh_pre_apagar ON public.maparh_preadmissoes AS PERMISSIVE FOR DELETE TO authenticated
  USING (( SELECT maparh_priv.perfil() AS perfil) = 'admin'::text);

CREATE POLICY maparh_pre_inserir ON public.maparh_preadmissoes AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (( SELECT maparh_priv.pode_rh() AS pode_rh) AND maparh_priv.pode_projeto(projeto_id) AND (( SELECT maparh_priv.rh_ve_tudo() AS rh_ve_tudo) OR ((analista_login = ( SELECT maparh_priv.meu_login() AS meu_login)) AND maparh_priv.pessoa_minha(pessoa_id))));

CREATE POLICY maparh_pre_ler ON public.maparh_preadmissoes AS PERMISSIVE FOR SELECT TO public
  USING (( SELECT maparh_priv.pode_rh() AS pode_rh) AND maparh_priv.pode_projeto(projeto_id) AND (( SELECT maparh_priv.rh_ve_tudo() AS rh_ve_tudo) OR (analista_login = ( SELECT maparh_priv.meu_login() AS meu_login)) OR maparh_priv.rh_da_vaga(vaga_id)));

-- Presença em tempo real (realtime.messages)
CREATE POLICY maparh_presenca_escrever ON realtime.messages AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((realtime.topic() = 'maparh-presenca'::text) AND (( SELECT maparh_priv.perfil() AS perfil) IS NOT NULL));

CREATE POLICY maparh_presenca_ler ON realtime.messages AS PERMISSIVE FOR SELECT TO authenticated
  USING ((realtime.topic() = 'maparh-presenca'::text) AND (( SELECT maparh_priv.perfil() AS perfil) IS NOT NULL));

-- ============================================================
-- GRANTS
-- ============================================================

-- Tabelas (postgres e service_role têm tudo; authenticated conforme abaixo)
grant select on public.maparh_auditoria to authenticated;
grant insert, references, select, trigger, truncate, update on public.maparh_importacoes to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.maparh_itens to authenticated;
grant references, select, trigger, truncate on public.maparh_membros to authenticated;
grant insert, references, select, trigger, truncate, update on public.maparh_pessoas to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.maparh_preadmissoes to authenticated;
grant all on public.maparh_auditoria, public.maparh_importacoes, public.maparh_itens, public.maparh_membros, public.maparh_pessoas, public.maparh_preadmissoes to service_role;

-- Execute das funções maparh_priv: só gatilhos/internas ficam restritas ao dono (postgres)
revoke execute on function maparh_priv.auditar_item(), maparh_priv.auditar_linha(), maparh_priv.auditar_membro(),
  maparh_priv.carimbar_auditoria(), maparh_priv.checar_admissao(), maparh_priv.docs_do_cargo(text),
  maparh_priv.manter_um_admin(), maparh_priv.marcar_etapa(), maparh_priv.travar_admitido(), maparh_priv.travar_pessoa_admitida()
  from public, anon, authenticated;

-- Usadas pelas políticas RLS e pelas funções public (authenticated precisa de execute)
revoke execute on function maparh_priv.apagar_registro_da_admissao(uuid, text), maparh_priv.fechar_importacao(uuid, integer, integer, jsonb),
  maparh_priv.irrestrito(), maparh_priv.meu_login(), maparh_priv.perfil(), maparh_priv.pessoa_minha(uuid), maparh_priv.pode_projeto(text),
  maparh_priv.pode_rh(), maparh_priv.projeto_do_item(text, text, jsonb), maparh_priv.registrar_importacao(uuid, text, text, text, integer),
  maparh_priv.registro_da_admissao(uuid, text, text), maparh_priv.rh_ve_tudo()
  from public, anon;
grant execute on function maparh_priv.apagar_registro_da_admissao(uuid, text), maparh_priv.fechar_importacao(uuid, integer, integer, jsonb),
  maparh_priv.irrestrito(), maparh_priv.meu_login(), maparh_priv.perfil(), maparh_priv.pessoa_minha(uuid), maparh_priv.pode_projeto(text),
  maparh_priv.pode_rh(), maparh_priv.projeto_do_item(text, text, jsonb), maparh_priv.registrar_importacao(uuid, text, text, text, integer),
  maparh_priv.registro_da_admissao(uuid, text, text), maparh_priv.rh_ve_tudo()
  to authenticated;
-- (carimbar, cpf_valido, guardar_admissao, guardar_item, historico_e_autor, norm, rh_da_vaga, tocar: sem ACL própria, ficam com o padrão)

-- Execute das funções public.maparh_*: authenticated + service_role
-- maparh_admitir e maparh_desfazer_admissao também têm execute para PUBLIC (como está hoje no banco)
revoke execute on function public.maparh_andamento(text), public.maparh_anonimizar_antigos(integer, boolean), public.maparh_anonimizar_pessoa(uuid, text),
  public.maparh_anotar(uuid, text), public.maparh_contagem_vagas(text), public.maparh_definir_foto(uuid, text), public.maparh_definir_mensagens(jsonb),
  public.maparh_definir_rh(uuid, boolean), public.maparh_desfazer_importacao(uuid), public.maparh_importar_preadmissoes(text, text, jsonb),
  public.maparh_pessoa_do_cpf(text), public.maparh_salvar_candidato(jsonb, jsonb)
  from public, anon;
grant execute on function public.maparh_admitir(uuid, text, text), public.maparh_andamento(text), public.maparh_anonimizar_antigos(integer, boolean),
  public.maparh_anonimizar_pessoa(uuid, text), public.maparh_anotar(uuid, text), public.maparh_contagem_vagas(text), public.maparh_definir_foto(uuid, text),
  public.maparh_definir_mensagens(jsonb), public.maparh_definir_rh(uuid, boolean), public.maparh_desfazer_admissao(uuid, text),
  public.maparh_desfazer_importacao(uuid), public.maparh_importar_preadmissoes(text, text, jsonb), public.maparh_pessoa_do_cpf(text),
  public.maparh_salvar_candidato(jsonb, jsonb)
  to authenticated, service_role;
grant execute on function public.maparh_admitir(uuid, text, text), public.maparh_desfazer_admissao(uuid, text) to public;

-- ============================================================
-- PUBLICAÇÃO REALTIME (tabelas maparh na supabase_realtime)
-- ============================================================

alter publication supabase_realtime add table public.maparh_itens;
alter publication supabase_realtime add table public.maparh_preadmissoes;
