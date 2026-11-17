-- Lote 3 (17/11/2026): admissão completa e consistente
-- 1) Admitir e desfazer passam a ser UMA operação no banco: a pré-admissão e a contratação (registro do mapa) nascem e somem juntas.
--    O registro da admissão tem id 'adm-<id da pré-admissão>' e ninguém o altera pela sincronização (só por estas funções).
-- 2) Cargo comparado sem acento/maiúsculas (igual à tela). 3) Documento "dispensado" (não se aplica) vale como concluído.
-- 4) ASO "apto" exige data, e não no futuro. 5) Reimportar a planilha não traz de volta quem já saiu do processo.
-- 6) O RH (analista) enxerga a vaga em que tem candidato, mesmo sendo de outro responsável.

create or replace function maparh_priv.norm(t text) returns text language sql immutable set search_path = '' as $$
  select lower(regexp_replace(translate(btrim(coalesce(t, '')),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'), '\s+', ' ', 'g'))
$$;

create or replace function maparh_priv.docs_do_cargo(p_cargo text)
 returns text[] language sql stable security definer set search_path to '' as $function$
  select coalesce(
    (select array(select jsonb_array_elements_text(i.dados->'documentos')) from public.maparh_itens i
      where i.colecao = 'cargos' and not i.removido and maparh_priv.norm(i.dados->>'nome') = maparh_priv.norm(p_cargo)
        and jsonb_array_length(coalesce(i.dados->'documentos', '[]'::jsonb)) > 0 limit 1),
    array['Carteira de Trabalho digital', 'RG e CPF', 'Comprovante de residência', 'Número do PIS/NIS', 'Título de eleitor', 'Certificado de reservista',
      'Certidão de nascimento ou casamento', 'Certidão de nascimento dos filhos', 'Comprovante de escolaridade', 'Exame admissional', 'Foto 3x4',
      'Dados bancários', 'CNH', 'Registro no conselho de classe'])
$function$;

create or replace function maparh_priv.checar_admissao()
 returns trigger language plpgsql security definer set search_path to '' as $function$
declare pe record; v_data date; erros text[] := '{}'; v_falta text[];
begin
  if new.situacao <> 'admitido' or (tg_op = 'UPDATE' and old.situacao = 'admitido') then return new; end if;
  new.admitido_em := (now() at time zone 'America/Sao_Paulo')::date;
  v_data := new.admitido_em;
  -- só pelo botão Admitir (função maparh_admitir), que cria a contratação junto
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
end $function$;

-- contratação da admissão: montada pelo banco a partir da pré-admissão (a tela só informa as cidades de trabalho/base)
create or replace function maparh_priv.registro_da_admissao(p_pre uuid, p_atuacao text, p_base text)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
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
end $function$;

create or replace function maparh_priv.apagar_registro_da_admissao(p_pre uuid, p_reg text)
 returns void language plpgsql security definer set search_path to '' as $function$
begin
  if exists (select 1 from public.maparh_preadmissoes where id = p_pre and situacao = 'admitido') then raise exception 'Ainda está admitido.'; end if;
  if p_reg is null then return; end if;
  update public.maparh_itens set removido = true where colecao = 'registros' and id = p_reg;
end $function$;

-- Admitir: valida tudo (gatilho checar_admissao) e cria a contratação na mesma transação. Permissão = a de alterar o candidato.
create or replace function public.maparh_admitir(p_pre uuid, p_atuacao text, p_base text default null)
 returns jsonb language plpgsql set search_path to '' as $function$
declare v_id uuid;
begin
  update public.maparh_preadmissoes set situacao = 'admitido', registro_id = 'adm-' || p_pre::text
    where id = p_pre and situacao = 'em_andamento' returning id into v_id;
  if v_id is null then raise exception 'Não deu para admitir: o candidato não está em andamento ou você não tem permissão sobre ele.'; end if;
  return maparh_priv.registro_da_admissao(p_pre, p_atuacao, p_base);
end $function$;

-- Desfazer: pede motivo (vai para o histórico) e tira a contratação do mapa junto
create or replace function public.maparh_desfazer_admissao(p_pre uuid, p_motivo text)
 returns void language plpgsql set search_path to '' as $function$
declare v_reg text; v_id uuid;
begin
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Informe o motivo para desfazer a admissão.'; end if;
  select registro_id into v_reg from public.maparh_preadmissoes where id = p_pre and situacao = 'admitido';
  update public.maparh_preadmissoes set situacao = 'em_andamento' where id = p_pre and situacao = 'admitido' returning id into v_id;
  if v_id is null then raise exception 'Não deu para desfazer: a pessoa não está admitida ou você não tem permissão sobre ela.'; end if;
  perform maparh_priv.apagar_registro_da_admissao(p_pre, v_reg);
  perform public.maparh_anotar(p_pre, 'Admissão desfeita: ' || btrim(p_motivo));
end $function$;

grant execute on function public.maparh_admitir(uuid, text, text) to authenticated;
grant execute on function public.maparh_desfazer_admissao(uuid, text) to authenticated;
revoke execute on function public.maparh_admitir(uuid, text, text) from anon;
revoke execute on function public.maparh_desfazer_admissao(uuid, text) from anon;
revoke execute on function maparh_priv.registro_da_admissao(uuid, text, text) from public, anon;
revoke execute on function maparh_priv.apagar_registro_da_admissao(uuid, text) from public, anon;
grant execute on function maparh_priv.registro_da_admissao(uuid, text, text) to authenticated;
grant execute on function maparh_priv.apagar_registro_da_admissao(uuid, text) to authenticated;

-- a contratação da admissão não é criada nem alterada pela sincronização (só pelas funções acima)
alter policy maparh_itens_inserir on public.maparh_itens with check (
  not (colecao = 'registros' and id like 'adm-%') and (
  ((colecao = 'auditoria') and ((select maparh_priv.perfil()) is not null))
  or (((select maparh_priv.perfil()) = any (array['admin', 'gestor'])) and (colecao <> 'auditoria') and maparh_priv.pode_projeto(maparh_priv.projeto_do_item(colecao, id, dados))
      and ((maparh_priv.projeto_do_item(colecao, id, dados) is not null) or (select maparh_priv.irrestrito())))
  or (((select maparh_priv.perfil()) = 'analista') and (colecao = 'registros') and maparh_priv.pode_projeto(dados ->> 'projetoId') and ((dados ->> 'criadoPor') = (select maparh_priv.meu_login())))));

alter policy maparh_itens_alterar on public.maparh_itens using (
  not (colecao = 'registros' and id like 'adm-%') and (
  (((select maparh_priv.perfil()) = any (array['admin', 'gestor'])) and (colecao <> 'auditoria') and maparh_priv.pode_projeto(maparh_priv.projeto_do_item(colecao, id, dados))
      and ((maparh_priv.projeto_do_item(colecao, id, dados) is not null) or (select maparh_priv.irrestrito())))
  or (((select maparh_priv.perfil()) = 'analista') and (colecao = 'registros') and maparh_priv.pode_projeto(dados ->> 'projetoId') and ((dados ->> 'criadoPor') = (select maparh_priv.meu_login())))))
 with check (
  not (colecao = 'registros' and id like 'adm-%') and (
  (((select maparh_priv.perfil()) = any (array['admin', 'gestor'])) and (colecao <> 'auditoria') and (removido or (maparh_priv.pode_projeto(maparh_priv.projeto_do_item(colecao, id, dados))
      and ((maparh_priv.projeto_do_item(colecao, id, dados) is not null) or (select maparh_priv.irrestrito())))))
  or (((select maparh_priv.perfil()) = 'analista') and (colecao = 'registros') and (removido or (maparh_priv.pode_projeto(dados ->> 'projetoId') and ((dados ->> 'criadoPor') = (select maparh_priv.meu_login())))))));

-- o RH (analista) vê as vagas em que é responsável E as vagas em que tem candidato
create index if not exists maparh_pre_vaga_idx on public.maparh_preadmissoes (vaga_id);
alter policy maparh_itens_ler on public.maparh_itens using (
  ((select maparh_priv.perfil()) is not null) and ((colecao <> 'auditoria') or ((select maparh_priv.perfil()) = 'admin'))
  and maparh_priv.pode_projeto(maparh_priv.projeto_do_item(colecao, id, dados))
  and (((select maparh_priv.perfil()) <> 'analista') or (colecao <> 'vagas') or ((dados ->> 'recrutadorLogin') = (select maparh_priv.meu_login()))
       or exists (select 1 from public.maparh_preadmissoes pa where pa.vaga_id = maparh_itens.id and pa.analista_login = (select maparh_priv.meu_login()))));

-- reimportar a planilha (que acumula todas as respostas) não traz de volta quem já saiu do processo neste projeto
do $do$
declare d text; ancora text := $a$    if exists (select 1 from public.maparh_preadmissoes where pessoa_id = v_pessoa and projeto_id = p_projeto and situacao = 'em_andamento') then$a$;
begin
  d := pg_get_functiondef('public.maparh_importar_preadmissoes'::regproc);
  if position('já saiu do processo neste projeto' in d) > 0 then return; end if;
  if position(ancora in d) = 0 then raise exception 'importar: trecho de referência não encontrado'; end if;
  d := replace(d, ancora, $n$    if exists (select 1 from public.maparh_preadmissoes where pessoa_id = v_pessoa and projeto_id = p_projeto and situacao in ('reprovado', 'desistiu')) then
      v_ign := v_ign + 1; v_det := v_det || jsonb_build_object('linha', i, 'cpf', v_cpf, 'nome', l->>'nome', 'motivo', 'já saiu do processo neste projeto (está em Não seguiram: use Retomar)');
      continue;
    end if;
$n$ || ancora);
  execute d;
end $do$;
