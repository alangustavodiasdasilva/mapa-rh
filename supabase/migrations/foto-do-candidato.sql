-- 19/11/2026 — Foto (opcional) do candidato: miniatura JPEG pequena (data URL) em maparh_pessoas.foto.
-- Aparece no cartão e no topo da ficha. Apagar dados pessoais (LGPD) também apaga a foto.

alter table public.maparh_pessoas add column if not exists foto text;
alter table public.maparh_pessoas drop constraint if exists maparh_pessoas_foto_check;
alter table public.maparh_pessoas add constraint maparh_pessoas_foto_check
  check (foto is null or (foto like 'data:image/%' and length(foto) <= 60000));

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
    if v_atual is not null and v_por is distinct from maparh_priv.meu_login() and date_trunc('milliseconds', v_atual) > date_trunc('milliseconds', (tem->>'versao')::timestamptz) then
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
      foto = case when pe ? 'foto' then nullif(pe->>'foto', '') else foto end,
      cpf = coalesce(nullif(pe->>'cpf', ''), cpf)
    where id = v_pes;
    get diagnostics v_n = row_count;
    if v_n = 0 then raise exception 'Sem permissão para alterar os dados desta pessoa.'; end if;
  else
    insert into public.maparh_pessoas (cpf, nome, nascimento, telefone, email, cnh, cidade_origem_id, ex_colaborador, foto)
    values (nullif(pe->>'cpf', ''), pe->>'nome', nullif(pe->>'nascimento', '')::date, nullif(pe->>'telefone', ''), nullif(pe->>'email', ''),
      nullif(pe->>'cnh', ''), nullif(pe->>'cidade_origem_id', ''), coalesce((pe->>'ex_colaborador')::boolean, false), nullif(pe->>'foto', ''))
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
      chegada_status = case when tem ? 'chegada_status' then nullif(tem->>'chegada_status', '') else chegada_status end,
      fonte = case when tem ? 'fonte' then nullif(tem->>'fonte', '') else fonte end,
      indicado_por = case when tem ? 'indicado_por' then nullif(tem->>'indicado_por', '') else indicado_por end,
      motivo_saida = case when tem ? 'motivo_saida' then nullif(tem->>'motivo_saida', '') else motivo_saida end,
      documentos = case when tem ? 'documentos' then coalesce(tem->'documentos', '{}'::jsonb) else documentos end,
      dinamica = case when tem ? 'dinamica' then tem->>'dinamica' else dinamica end,
      documentos_pendentes = case when tem ? 'documentos_pendentes' then nullif(tem->>'documentos_pendentes', '') else documentos_pendentes end,
      entrevista = case when tem ? 'entrevista' then coalesce(tem->'entrevista', '{}'::jsonb) else entrevista end,
      situacao = case when tem ? 'situacao' then tem->>'situacao' else situacao end,
      avaliacao_recontrataria = case when tem ? 'avaliacao_recontrataria' then nullif(tem->>'avaliacao_recontrataria', '') else avaliacao_recontrataria end,
      avaliacao_nota = case when tem ? 'avaliacao_nota' then nullif(tem->>'avaliacao_nota', '')::smallint else avaliacao_nota end,
      avaliacao_obs = case when tem ? 'avaliacao_obs' then nullif(btrim(tem->>'avaliacao_obs'), '') else avaliacao_obs end,
      nao_duplicado = case when tem ? 'nao_duplicado' and jsonb_typeof(tem->'nao_duplicado') = 'array'
        then array(select distinct x from unnest(coalesce(nao_duplicado, '{}'::uuid[])
          || array(select e::uuid from jsonb_array_elements_text(tem->'nao_duplicado') e)) x order by x)
        else nao_duplicado end
    where id = v_pre;
    get diagnostics v_n = row_count;
    if v_n = 0 then raise exception 'Sem permissão para alterar este candidato (ele pode ter sido direcionado para outro RH).'; end if;
  else
    insert into public.maparh_preadmissoes (pessoa_id, projeto_id, etapa, tipo, vaga_id, distrito_id, distancia_km, cidade_atuacao_id, base_id, cargo, unidade,
      analista, analista_login, aso, aso_data, aso_local, treinamento, treinamento_data, treinamento_local, chegada_data, chegada_hora, grupo_whatsapp, observacao, entrevista, fonte, indicado_por)
    values (v_pes, tem->>'projeto_id', coalesce(nullif(tem->>'etapa', ''), 'triagem'), coalesce(nullif(tem->>'tipo', ''), 'LOCAL'), nullif(tem->>'vaga_id', ''), nullif(tem->>'distrito_id', ''),
      nullif(tem->>'distancia_km', '')::numeric, nullif(tem->>'cidade_atuacao_id', ''), nullif(tem->>'base_id', ''), nullif(tem->>'cargo', ''), nullif(tem->>'unidade', ''),
      nullif(tem->>'analista', ''), nullif(tem->>'analista_login', ''), coalesce(nullif(tem->>'aso', ''), 'pendente'), nullif(tem->>'aso_data', '')::date, nullif(tem->>'aso_local', ''),
      coalesce(nullif(tem->>'treinamento', ''), 'pendente'), nullif(tem->>'treinamento_data', '')::date, nullif(tem->>'treinamento_local', ''),
      nullif(tem->>'chegada_data', '')::date, nullif(tem->>'chegada_hora', '')::time,
      nullif(tem->>'grupo_whatsapp', ''), nullif(tem->>'observacao', ''), coalesce(tem->'entrevista', '{}'::jsonb), nullif(tem->>'fonte', ''), nullif(tem->>'indicado_por', ''))
    returning id into v_pre;
  end if;
  return v_pre;
end $function$;

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
  update public.maparh_pessoas set nome = 'Dados apagados (LGPD)', cpf = null, telefone = null, email = null, nascimento = null, cnh = null, foto = null
    where id = p_pessoa;
  if not found then raise exception 'Pessoa não encontrada.'; end if;
  update public.maparh_preadmissoes set observacao = null, grupo_whatsapp = null, documentos_pendentes = null where pessoa_id = p_pessoa;
  update public.maparh_auditoria set
      antes = case when antes is null then null else antes - 'nome' - 'cpf' - 'telefone' - 'email' - 'nascimento' - 'cnh' - 'foto' end,
      depois = case when depois is null then null else depois - 'nome' - 'cpf' - 'telefone' - 'email' - 'nascimento' - 'cnh' - 'foto' end
    where tabela = 'maparh_pessoas' and item_id = p_pessoa::text;
  insert into public.maparh_auditoria (user_id, login, operacao, tabela, colecao, item_id, antes, depois)
    values (auth.uid(), maparh_priv.meu_login(), 'anonimizou', 'maparh_pessoas', 'pessoas', p_pessoa::text, null, jsonb_build_object('motivo', coalesce(p_motivo, '')));
end $function$;
