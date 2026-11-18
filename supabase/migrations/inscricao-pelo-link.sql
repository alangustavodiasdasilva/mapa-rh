-- 18/11/2026 — Inscrição própria do candidato (página pública inscricao.html, substitui o Google Forms).
-- Três funções novas, as únicas que o visitante sem login (anon) pode chamar:
--   maparh_vaga_publica(vaga)      -> só os dados públicos de uma vaga (o que já sai no anúncio) + aberta sim/não
--   maparh_vagas_publicas(projeto) -> as vagas abertas de um projeto (mesmo formato)
--   maparh_inscrever(...)          -> valida tudo aqui no servidor e cria a pessoa + a pré-admissão na Triagem
-- Nada devolve dado de pessoa, RH, login ou contagem interna.

-- ---------------------------------------------------------------- vaga pública
create or replace function public.maparh_vaga_publica(p_vaga text)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare d jsonb; pj jsonb; pj_rem boolean; v_motivo text; v_qtd int; v_adm int; v_cid text; v_cid_nome text; v_dist jsonb;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if p_vaga is null or length(p_vaga) > 64 then return null; end if;
  select i.dados into d from public.maparh_itens i where i.colecao = 'vagas' and i.id = p_vaga and not i.removido;
  if d is null then return null; end if;
  -- vaga que ainda não foi aprovada (ou foi recusada) não mostra nada além de "fechada"
  if coalesce(d->'aprovacao'->>'situacao', '') <> 'aprovada' or coalesce(d->>'status', '') in ('aguardando', 'recusada') then
    return jsonb_build_object('id', p_vaga, 'aberta', false, 'motivo', 'nao_aprovada');
  end if;
  select i.dados, i.removido into pj, pj_rem from public.maparh_itens i where i.colecao = 'projetos' and i.id = d->>'projetoId';
  v_qtd := case when coalesce(d->>'quantidade', '') ~ '^[0-9]{1,6}$' then (d->>'quantidade')::int else null end;
  select count(*) into v_adm from public.maparh_preadmissoes p where p.vaga_id = p_vaga and p.situacao = 'admitido';
  v_motivo := case
    when d->>'status' = 'cancelada' then 'cancelada'
    when d->>'status' = 'preenchida' then 'preenchida'
    when coalesce(d->>'status', '') not in ('aberta', 'divulgada', 'selecao') then 'fechada'
    when pj is null or pj_rem or (pj ? 'ativo' and pj->>'ativo' = 'false') then 'fechada'
    when v_qtd is not null and v_qtd > 0 and v_adm >= v_qtd then 'completa'
    when coalesce(d->>'prazo', '') ~ '^\d{4}-\d{2}-\d{2}$' and (d->>'prazo')::date < hoje then 'prazo'
    else null end;
  v_cid := nullif(d->>'cidadeId', '');
  if v_cid is not null then
    select c.dados->>'nome' into v_cid_nome from public.maparh_itens c where c.colecao = 'cidades' and c.id = v_cid and not c.removido;
    v_cid_nome := coalesce(v_cid_nome, initcap(split_part(v_cid, ':', 2)));
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', x.e->>'distritoId', 'nome', di.dados->>'nome', 'uf', di.dados->>'uf') order by x.i), '[]'::jsonb)
    into v_dist
    from jsonb_array_elements(case when jsonb_typeof(d->'distritos') = 'array' then d->'distritos' else '[]'::jsonb end) with ordinality x(e, i)
    join public.maparh_itens di on di.colecao = 'distritos' and di.id = x.e->>'distritoId' and not di.removido;
  return jsonb_build_object(
    'id', p_vaga,
    'aberta', v_motivo is null,
    'motivo', v_motivo,
    'projeto_id', d->>'projetoId',
    'titulo', d->>'titulo',
    'tipo', case when d->>'tipo' = 'MOVEL' then 'MOVEL' else 'LOCAL' end,
    'tem_moveis', exists (select 1 from jsonb_array_elements(case when jsonb_typeof(d->'distritos') = 'array' then d->'distritos' else '[]'::jsonb end) e
                          where coalesce(e->>'moveis', '') ~ '^[0-9]+$' and (e->>'moveis')::int > 0),
    'quantidade', v_qtd,
    'cidade_id', v_cid,
    'cidade_nome', v_cid_nome,
    'uf', case when v_cid is null then null else split_part(v_cid, ':', 1) end,
    'unidade', nullif(btrim(coalesce(d->>'unidade', '')), ''),
    'distritos', v_dist,
    'descricao', nullif(btrim(coalesce(d->>'descricao', '')), ''),
    'requisitos', nullif(btrim(coalesce(d->>'requisitos', '')), ''),
    'jornada', nullif(btrim(coalesce(d->>'jornada', '')), ''),
    'salario', nullif(btrim(coalesce(d->>'salario', '')), ''),
    'beneficios', nullif(btrim(coalesce(d->>'beneficios', '')), ''),
    'prazo', case when coalesce(d->>'prazo', '') ~ '^\d{4}-\d{2}-\d{2}$' then d->>'prazo' else null end,
    'contato', nullif(btrim(coalesce(d->>'contato', '')), ''));
end $$;

-- ---------------------------------------------------------------- vagas abertas de um projeto
create or replace function public.maparh_vagas_publicas(p_projeto text)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare r record; v jsonb; lista jsonb := '[]'::jsonb;
begin
  if p_projeto is null or length(p_projeto) > 64 then return lista; end if;
  for r in select i.id from public.maparh_itens i
           where i.colecao = 'vagas' and not i.removido and i.dados->>'projetoId' = p_projeto
             and i.dados->>'status' in ('aberta', 'divulgada', 'selecao') and i.dados->'aprovacao'->>'situacao' = 'aprovada'
           order by i.dados->>'titulo', i.id limit 100 loop
    v := public.maparh_vaga_publica(r.id);
    if v is not null and (v->>'aberta')::boolean then lista := lista || jsonb_build_array(v); end if;
  end loop;
  return lista;
end $$;

-- ---------------------------------------------------------------- inscrição
create or replace function public.maparh_inscrever(
  p_vaga text, p_nome text, p_telefone text, p_cpf text default null, p_nascimento text default null, p_cidade text default null,
  p_ex_colaborador boolean default false, p_fonte text default null, p_indicado_por text default null, p_distrito text default null,
  p_lgpd boolean default false, p_site text default null)
returns jsonb language plpgsql volatile security definer set search_path to '' as $$
declare v jsonb; d jsonb; v_nome text; v_tel text; v_tel_fmt text; v_cpf text; v_nasc date; v_cid text; v_fonte text; v_ind text; v_dist text;
  v_pes uuid; pe record; v_proj text; v_login text; v_analista text; v_extra text[] := '{}'; v_n int; v_pre uuid; v_admitida boolean;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  agora text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  fontes constant text[] := array['sine','linkedin','indeed','gupy','catho','infojobs','vagascom','whatsapp','facebook','radio','prefeitura','cartaz','indicacao','ex_colaborador','outro'];
  ddds constant text[] := array['11','12','13','14','15','16','17','18','19','21','22','24','27','28','31','32','33','34','35','37','38',
    '41','42','43','44','45','46','47','48','49','51','53','54','55','61','62','63','64','65','66','67','68','69','71','73','74','75','77','79',
    '81','82','83','84','85','86','87','88','89','91','92','93','94','95','96','97','98','99'];
  ja constant jsonb := jsonb_build_object('ok', true, 'codigo', 'ja', 'mensagem', 'Já recebemos sua inscrição. O RH vai te chamar no WhatsApp.');
begin
  -- campo escondido (robô preencheu): finge que deu certo e não grava nada
  if coalesce(p_site, '') <> '' then
    return jsonb_build_object('ok', true, 'codigo', 'recebido', 'mensagem', 'Recebemos sua inscrição.');
  end if;
  if length(coalesce(p_vaga, '')) > 64 or length(coalesce(p_nome, '')) > 200 or length(coalesce(p_telefone, '')) > 30 or length(coalesce(p_cpf, '')) > 20
     or length(coalesce(p_nascimento, '')) > 10 or length(coalesce(p_cidade, '')) > 80 or length(coalesce(p_fonte, '')) > 30
     or length(coalesce(p_indicado_por, '')) > 200 or length(coalesce(p_distrito, '')) > 64 then
    return jsonb_build_object('ok', false, 'mensagem', 'Algum campo está grande demais. Confira e tente de novo.');
  end if;
  if not coalesce(p_lgpd, false) then
    return jsonb_build_object('ok', false, 'campo', 'lgpd', 'mensagem', 'Para enviar, marque que concorda com o uso dos seus dados.');
  end if;

  v := public.maparh_vaga_publica(p_vaga);
  if v is null then return jsonb_build_object('ok', false, 'codigo', 'vaga', 'mensagem', 'Vaga não encontrada. Confira o link.'); end if;
  if not (v->>'aberta')::boolean then
    return jsonb_build_object('ok', false, 'codigo', 'fechada', 'mensagem', 'Esta vaga não está mais recebendo inscrições.');
  end if;
  v_proj := v->>'projeto_id';
  select i.dados into d from public.maparh_itens i where i.colecao = 'vagas' and i.id = p_vaga;

  -- nome: pelo menos duas palavras, sem números nem símbolos
  v_nome := regexp_replace(btrim(coalesce(p_nome, '')), '\s+', ' ', 'g');
  if length(v_nome) > 120 or v_nome ~ '[0-9@#$%&*_=+<>/|{}"!?;:]' or v_nome ~ '[][]' or position(chr(92) in v_nome) > 0
     or (select count(*) from unnest(regexp_split_to_array(v_nome, ' ')) w where length(w) >= 2) < 2 then
    return jsonb_build_object('ok', false, 'campo', 'nome', 'mensagem', 'Escreva seu nome completo (nome e sobrenome).');
  end if;

  -- telefone celular/fixo do Brasil com DDD
  v_tel := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  if length(v_tel) in (12, 13) and left(v_tel, 2) = '55' then v_tel := substr(v_tel, 3); end if;
  if length(v_tel) not in (10, 11) or not (left(v_tel, 2) = any (ddds))
     or (length(v_tel) = 11 and substr(v_tel, 3, 1) <> '9') or (length(v_tel) = 10 and substr(v_tel, 3, 1) not in ('2', '3', '4', '5'))
     or substr(v_tel, 3) ~ '^(.)\1+$' then
    return jsonb_build_object('ok', false, 'campo', 'telefone', 'mensagem', 'WhatsApp inválido. Use DDD + número, por exemplo (54) 99999-1234.');
  end if;
  v_tel_fmt := '(' || left(v_tel, 2) || ') ' || case when length(v_tel) = 11 then substr(v_tel, 3, 5) || '-' || substr(v_tel, 8) else substr(v_tel, 3, 4) || '-' || substr(v_tel, 7) end;

  -- CPF opcional, mas válido se vier
  v_cpf := nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), '');
  if v_cpf is not null and not maparh_priv.cpf_valido(v_cpf) then
    return jsonb_build_object('ok', false, 'campo', 'cpf', 'mensagem', 'CPF inválido. Confira os números ou deixe em branco.');
  end if;

  -- nascimento: obrigatório, 18 anos ou mais
  if coalesce(p_nascimento, '') !~ '^\d{4}-\d{2}-\d{2}$' then
    return jsonb_build_object('ok', false, 'campo', 'nascimento', 'mensagem', 'Informe sua data de nascimento.');
  end if;
  begin v_nasc := p_nascimento::date;
  exception when others then return jsonb_build_object('ok', false, 'campo', 'nascimento', 'mensagem', 'Data de nascimento inválida.'); end;
  if v_nasc <= '1920-01-01'::date or v_nasc > hoje or v_nasc < (hoje - interval '90 years')::date then
    return jsonb_build_object('ok', false, 'campo', 'nascimento', 'mensagem', 'Data de nascimento inválida.');
  end if;
  if v_nasc > (hoje - interval '18 years')::date then
    return jsonb_build_object('ok', false, 'campo', 'nascimento', 'mensagem', 'Para esta vaga é preciso ter 18 anos ou mais.');
  end if;

  -- cidade onde mora: id no formato do sistema (UF:nome-normalizado)
  v_cid := btrim(coalesce(p_cidade, ''));
  if v_cid !~ '^[A-Z]{2}:[a-z0-9]([a-z0-9 ]{0,60}[a-z0-9])?$' then
    return jsonb_build_object('ok', false, 'campo', 'cidade', 'mensagem', 'Escolha a cidade onde você mora na lista.');
  end if;

  -- como soube da vaga
  v_fonte := nullif(btrim(coalesce(p_fonte, '')), '');
  if v_fonte is not null and not (v_fonte = any (fontes)) then v_fonte := 'outro'; end if;
  v_ind := case when v_fonte = 'indicacao' then nullif(left(regexp_replace(btrim(coalesce(p_indicado_por, '')), '\s+', ' ', 'g'), 120), '') else null end;

  -- distrito: um dos distritos da vaga; se a vaga só tem um, é ele
  v_dist := nullif(btrim(coalesce(p_distrito, '')), '');
  if v_dist is not null and not exists (select 1 from jsonb_array_elements(v->'distritos') e where e->>'id' = v_dist) then v_dist := null; end if;
  if v_dist is null and jsonb_array_length(v->'distritos') = 1 then v_dist := v->'distritos'->0->>'id'; end if;

  -- limites contra abuso
  select count(*) into v_n from public.maparh_preadmissoes p
    where p.criado_por is null and p.lote_importacao is null and p.criado_em > now() - interval '10 minutes' and p.anotacoes->0->>'origem' = 'link';
  if v_n >= 200 then
    return jsonb_build_object('ok', false, 'mensagem', 'Muitas inscrições neste momento. Tente de novo em alguns minutos.');
  end if;
  select count(*) into v_n from public.maparh_preadmissoes p
    where p.criado_por is null and p.criado_em > now() - interval '24 hours' and p.anotacoes->0->>'origem' = 'link' and p.anotacoes->0->>'tel' = v_tel;
  if v_n >= 3 then
    return jsonb_build_object('ok', false, 'mensagem', 'Este WhatsApp já fez várias inscrições hoje. Aguarde o contato do RH.');
  end if;
  -- mesmo telefone já inscrito nesta vaga (com ou sem CPF)
  if exists (select 1 from public.maparh_preadmissoes p join public.maparh_pessoas x on x.id = p.pessoa_id
             where p.vaga_id = p_vaga and p.situacao in ('em_andamento', 'admitido')
               and (regexp_replace(coalesce(x.telefone, ''), '\D', '', 'g') = v_tel or p.anotacoes->0->>'tel' = v_tel)) then
    return ja;
  end if;

  -- pessoa: pelo CPF; sem CPF, a mesma pessoa só se nome e telefone baterem
  if v_cpf is not null then
    select x.* into pe from public.maparh_pessoas x where x.cpf = v_cpf;
  else
    select x.* into pe from public.maparh_pessoas x
      where x.cpf is null and regexp_replace(coalesce(x.telefone, ''), '\D', '', 'g') = v_tel and maparh_priv.norm(x.nome) = maparh_priv.norm(v_nome)
      order by x.criado_em desc limit 1;
  end if;
  if pe.id is not null then
    v_pes := pe.id;
    -- já está no processo (ou contratado) neste projeto: não cria outra ficha
    if exists (select 1 from public.maparh_preadmissoes p where p.pessoa_id = v_pes and p.projeto_id = v_proj and p.situacao in ('em_andamento', 'admitido')) then
      return ja;
    end if;
    -- não sobrescreve o cadastro: só completa o que está vazio e anota no histórico o que veio diferente
    v_admitida := exists (select 1 from public.maparh_preadmissoes p where p.pessoa_id = v_pes and p.situacao = 'admitido');
    update public.maparh_pessoas set
      telefone = coalesce(telefone, v_tel_fmt),
      cidade_origem_id = coalesce(cidade_origem_id, v_cid),
      nascimento = case when nascimento is null and not v_admitida then v_nasc else nascimento end
    where id = v_pes and (telefone is null or cidade_origem_id is null or (nascimento is null and not v_admitida));
    if maparh_priv.norm(pe.nome) is distinct from maparh_priv.norm(v_nome) then v_extra := v_extra || ('nome informado: ' || v_nome); end if;
    if pe.telefone is not null and regexp_replace(pe.telefone, '\D', '', 'g') <> v_tel then v_extra := v_extra || ('WhatsApp informado: ' || v_tel_fmt); end if;
    if pe.nascimento is not null and pe.nascimento <> v_nasc then v_extra := v_extra || ('nascimento informado: ' || to_char(v_nasc, 'DD/MM/YYYY')); end if;
    if pe.cidade_origem_id is not null and pe.cidade_origem_id <> v_cid then v_extra := v_extra || ('cidade informada: ' || v_cid); end if;
    if coalesce(p_ex_colaborador, false) and not pe.ex_colaborador then v_extra := v_extra || 'disse que já trabalhou na empresa'::text; end if;
  else
    insert into public.maparh_pessoas (cpf, nome, nascimento, telefone, cidade_origem_id, ex_colaborador)
    values (v_cpf, v_nome, v_nasc, v_tel_fmt, v_cid, coalesce(p_ex_colaborador, false))
    returning id into v_pes;
  end if;

  -- RH principal da vaga (se estiver ativo)
  select m.login, m.nome into v_login, v_analista from public.maparh_membros m where m.login = d->>'recrutadorLogin' and m.ativo;

  begin
    insert into public.maparh_preadmissoes (pessoa_id, projeto_id, etapa, tipo, vaga_id, distrito_id, cargo, unidade, analista, analista_login, fonte, indicado_por, anotacoes)
    values (v_pes, v_proj, 'triagem', 'LOCAL', p_vaga, v_dist, nullif(d->>'titulo', ''), nullif(btrim(coalesce(d->>'unidade', '')), ''),
      coalesce(v_analista, nullif(d->>'recrutador', '')), v_login, v_fonte, v_ind,
      jsonb_build_array(jsonb_build_object('em', agora, 'por', null, 'nome', 'Inscrição pelo link', 'etapa', 'triagem', 'auto', true,
        'origem', 'link', 'tel', v_tel,
        'texto', 'Inscrição pelo link.' || case when array_length(v_extra, 1) > 0 then ' Já tinha cadastro; ' || array_to_string(v_extra, '; ') || '.' else '' end)))
    returning id into v_pre;
  exception when unique_violation then
    return ja;
  end;
  return jsonb_build_object('ok', true, 'codigo', 'recebido', 'mensagem', 'Recebemos! O RH vai te chamar no WhatsApp.');
end $$;

revoke all on function public.maparh_vaga_publica(text) from public;
revoke all on function public.maparh_vagas_publicas(text) from public;
revoke all on function public.maparh_inscrever(text, text, text, text, text, text, boolean, text, text, text, boolean, text) from public;
grant execute on function public.maparh_vaga_publica(text) to anon, authenticated;
grant execute on function public.maparh_vagas_publicas(text) to anon, authenticated;
grant execute on function public.maparh_inscrever(text, text, text, text, text, text, boolean, text, text, text, boolean, text) to anon, authenticated;
