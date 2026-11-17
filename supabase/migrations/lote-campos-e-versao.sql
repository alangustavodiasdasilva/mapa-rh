-- 17/11/2026 (avaliação dos 3 agentes): campos novos e "salvar só o que mudou" com trava de versão.
alter table public.maparh_preadmissoes
  add column if not exists aso_local text,
  add column if not exists treinamento_data date,
  add column if not exists treinamento_local text,
  add column if not exists motivo_saida text,
  add column if not exists entrevista_em timestamptz,
  add column if not exists documentos_em timestamptz;

-- datas de entrada em cada etapa (para tempo médio por etapa)
update public.maparh_preadmissoes set entrevista_em = coalesce(entrevista_em, case when etapa in ('entrevista','documentos') then etapa_em end)
  where entrevista_em is null and etapa in ('entrevista','documentos');
update public.maparh_preadmissoes set documentos_em = coalesce(documentos_em, etapa_em) where documentos_em is null and etapa = 'documentos';

-- salvar: só os campos enviados mudam (o que não veio fica como está) e, se vier "versao" (o atualizado_em que a tela leu),
-- recusa quando OUTRA pessoa alterou o candidato depois (o próprio usuário, ex.: anotação com a ficha aberta, não conta): a tela avisa e recarrega, em vez de apagar o que o outro fez.
create or replace function public.maparh_salvar_candidato(p_pessoa jsonb, p_pre jsonb)
returns uuid language plpgsql set search_path to '' as $$
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
end $$;

-- andamento (sem dado pessoal) com o que o Início precisa: motivo de saída e datas de cada etapa
drop function if exists public.maparh_andamento(text);
create function public.maparh_andamento(p_projeto text default null)
returns table(id uuid, projeto_id text, vaga_id text, etapa text, situacao text, tipo text, analista text, analista_login text, distrito_id text,
  dinamica text, aso text, treinamento text, criado_em timestamptz, admitido_em date, chegada_data date, etapa_em timestamptz,
  motivo_saida text, entrevista_em timestamptz, documentos_em timestamptz, atualizado_em timestamptz)
language sql stable security definer set search_path to '' as $$
  select p.id, p.projeto_id, p.vaga_id, p.etapa, p.situacao, p.tipo, p.analista, p.analista_login, p.distrito_id,
    p.dinamica, p.aso, p.treinamento, p.criado_em, p.admitido_em, p.chegada_data, p.etapa_em,
    p.motivo_saida, p.entrevista_em, p.documentos_em, p.atualizado_em
  from public.maparh_preadmissoes p
  where (select maparh_priv.perfil()) is not null and maparh_priv.pode_projeto(p.projeto_id)
    and (p_projeto is null or p.projeto_id = p_projeto)
    and ((select maparh_priv.perfil()) <> 'analista' or p.analista_login = (select maparh_priv.meu_login()) or maparh_priv.rh_da_vaga(p.vaga_id))
$$;
revoke all on function public.maparh_andamento(text) from public, anon;
grant execute on function public.maparh_andamento(text) to authenticated, service_role;
