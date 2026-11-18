-- 18/11/2026: banco de talentos / avaliação de fim de safra + "não é a mesma pessoa" (aviso de duplicado).
-- Só acrescenta: colunas novas (nulas), regras novas no trigger de histórico e funções novas.
--   * Avaliação de quem foi admitido (recontrataria sim/talvez/não, nota 1-5, observação), gravada por maparh_salvar_candidato.
--     O trigger maparh_priv.historico_e_autor confere quem pode (admin, gestor, RH liberado, RH responsável / da vaga) e se está admitido,
--     carimba avaliado_por/avaliado_em (o cliente não escolhe) e anota no histórico "Avaliado: recontrataria sim".
--   * nao_duplicado: ids dos candidatos que o RH marcou como "não é a mesma pessoa"; salvar_candidato só ACRESCENTA (une), nunca tira.
--   * maparh_banco_talentos(projeto): avaliados "sim"/"talvez" em outras safras que não estão neste projeto (RH vê todos: precisa chamar;
--     sai só nome, telefone, cidade, cargo, safra e a avaliação — sem CPF, documentos ou nascimento).
--   * maparh_ja_trabalhou(projeto): a avaliação anterior de quem já está neste projeto (só das pessoas que o usuário enxerga).
--   * maparh_trazer_do_banco(pre, projeto): cria o candidato na safra atual reaproveitando a pessoa (o RH analista não consegue pelo
--     salvar_candidato porque a regra de acesso não deixa ele mexer numa pessoa que foi de outro RH).

alter table public.maparh_preadmissoes
  add column if not exists avaliacao_recontrataria text,
  add column if not exists avaliacao_nota smallint,
  add column if not exists avaliacao_obs text,
  add column if not exists avaliado_por text,
  add column if not exists avaliado_em timestamptz,
  add column if not exists nao_duplicado uuid[];

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'maparh_pre_avaliacao_check') then
    alter table public.maparh_preadmissoes add constraint maparh_pre_avaliacao_check check (
      (avaliacao_recontrataria is null or avaliacao_recontrataria in ('sim', 'talvez', 'nao'))
      and (avaliacao_nota is null or avaliacao_nota between 1 and 5)
      and (avaliacao_obs is null or length(avaliacao_obs) <= 300)
      and (nao_duplicado is null or cardinality(nao_duplicado) <= 100));
  end if;
end $$;

create index if not exists maparh_pre_avaliacao_idx on public.maparh_preadmissoes (pessoa_id, avaliado_em desc) where avaliacao_recontrataria is not null;

-- ---------- salvar_candidato: aceita as chaves novas (o resto igual ao que estava no banco) ----------
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
      chegada_status = case when tem ? 'chegada_status' then nullif(tem->>'chegada_status', '') else chegada_status end,
      fonte = case when tem ? 'fonte' then nullif(tem->>'fonte', '') else fonte end,
      indicado_por = case when tem ? 'indicado_por' then nullif(tem->>'indicado_por', '') else indicado_por end,
      motivo_saida = case when tem ? 'motivo_saida' then nullif(tem->>'motivo_saida', '') else motivo_saida end,
      documentos = case when tem ? 'documentos' then coalesce(tem->'documentos', '{}'::jsonb) else documentos end,
      dinamica = case when tem ? 'dinamica' then tem->>'dinamica' else dinamica end,
      documentos_pendentes = case when tem ? 'documentos_pendentes' then nullif(tem->>'documentos_pendentes', '') else documentos_pendentes end,
      entrevista = case when tem ? 'entrevista' then coalesce(tem->'entrevista', '{}'::jsonb) else entrevista end,
      situacao = case when tem ? 'situacao' then tem->>'situacao' else situacao end,
      -- 18/11/2026: avaliação de fim de safra (o trigger confere quem pode e carimba autor e hora)
      avaliacao_recontrataria = case when tem ? 'avaliacao_recontrataria' then nullif(tem->>'avaliacao_recontrataria', '') else avaliacao_recontrataria end,
      avaliacao_nota = case when tem ? 'avaliacao_nota' then nullif(tem->>'avaliacao_nota', '')::smallint else avaliacao_nota end,
      avaliacao_obs = case when tem ? 'avaliacao_obs' then nullif(btrim(tem->>'avaliacao_obs'), '') else avaliacao_obs end,
      -- "não é a mesma pessoa": só acrescenta ids (une com o que já tinha)
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

-- ---------- histórico e autor: + regra e anotação da avaliação (o resto igual ao que estava no banco) ----------
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
    -- 18/11/2026: candidato novo não nasce avaliado
    if auth.uid() is not null then
      new.avaliacao_recontrataria := null; new.avaliacao_nota := null; new.avaliacao_obs := null; new.avaliado_por := null; new.avaliado_em := null;
    end if;
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
    if new.chegada_status is distinct from old.chegada_status and new.chegada_status is not null then
      v_add := v_add || jsonb_build_array(case new.chegada_status when 'chegou' then 'Chegou ao campo.' when 'faltou' then 'Não chegou ao campo (faltou).'
        when 'remarcou' then 'Chegada remarcada.' else 'Chegada aguardando.' end);
    end if;
    if new.chegada_data is distinct from old.chegada_data and new.chegada_data is not null then
      v_add := v_add || jsonb_build_array('Chegada marcada para ' || to_char(new.chegada_data, 'DD/MM') || coalesce(' às ' || to_char(new.chegada_hora, 'HH24:MI'), '') || '.');
    end if;
    -- 18/11/2026: avaliação de fim de safra — só de quem está admitido; só admin, gestor, RH liberado ou o RH responsável (ou da vaga)
    if (new.avaliacao_recontrataria, new.avaliacao_nota, new.avaliacao_obs) is distinct from (old.avaliacao_recontrataria, old.avaliacao_nota, old.avaliacao_obs) then
      if auth.uid() is not null then
        if new.situacao is distinct from 'admitido' then
          raise exception 'AVALIACAO_SO_ADMITIDO: só dá para avaliar quem foi admitido.' using errcode = 'P0001';
        end if;
        if not (coalesce(maparh_priv.perfil() in ('admin', 'gestor'), false) or maparh_priv.rh_ve_tudo()
                or (v_login is not null and old.analista_login = v_login) or maparh_priv.rh_da_vaga(old.vaga_id)) then
          raise exception 'AVALIACAO_SEM_PERMISSAO: só o RH responsável, o gestor ou o administrador avaliam.' using errcode = 'P0001';
        end if;
      end if;
      if new.avaliacao_recontrataria is null then
        new.avaliacao_nota := null; new.avaliacao_obs := null; new.avaliado_por := null; new.avaliado_em := null;
        v_add := v_add || jsonb_build_array('Avaliação de fim de safra apagada.');
      else
        new.avaliado_por := coalesce(v_login, new.avaliado_por); new.avaliado_em := now();
        v_add := v_add || jsonb_build_array('Avaliado: recontrataria ' || case new.avaliacao_recontrataria when 'sim' then 'sim' when 'talvez' then 'talvez' else 'não' end
          || coalesce(' · nota ' || new.avaliacao_nota || '/5', '') || '.');
      end if;
    elsif auth.uid() is not null then
      -- autor e hora da avaliação não se mexem à mão
      new.avaliado_por := old.avaliado_por; new.avaliado_em := old.avaliado_em;
    end if;
  end if;
  if jsonb_array_length(v_add) > 0 then
    new.anotacoes := coalesce(new.anotacoes, '[]'::jsonb) || (
      select jsonb_agg(jsonb_build_object('em', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'por', v_login, 'nome', coalesce(v_nome, 'Sistema'), 'etapa', new.etapa, 'texto', t, 'auto', true))
      from jsonb_array_elements_text(v_add) t);
  end if;
  return new;
end $function$;

-- ---------- banco de talentos ----------
-- nome do projeto (safra) para mostrar
create or replace function maparh_priv.nome_projeto(p_projeto text) returns text
language sql stable security definer set search_path to '' as $$
  select coalesce((select nullif(btrim(coalesce(i.dados->>'nome', '') || coalesce(' ' || nullif(i.dados->>'ano', ''), '')), '')
    from public.maparh_itens i where i.colecao = 'projetos' and i.id = p_projeto), p_projeto)
$$;
revoke all on function maparh_priv.nome_projeto(text) from public, anon, authenticated;

-- RH (qualquer perfil com acesso ao RH) vê o banco inteiro: o trabalho dele é chamar essas pessoas para a safra nova,
-- e elas já foram de outro RH. Sai só o necessário para chamar (sem CPF, nascimento, documentos ou e-mail).
create or replace function public.maparh_banco_talentos(p_projeto text)
returns table (pre_id uuid, pessoa_id uuid, nome text, telefone text, cidade_origem_id text, cargo text, tipo text,
  projeto_id text, projeto_nome text, recontrataria text, nota smallint, observacao text, avaliado_em timestamptz, avaliado_por text)
language sql stable security definer set search_path to '' as $$
  select u.id, u.pessoa_id, u.nome, u.telefone, u.cidade_origem_id, u.cargo, u.tipo, u.projeto_id, maparh_priv.nome_projeto(u.projeto_id),
    u.avaliacao_recontrataria, u.avaliacao_nota, u.avaliacao_obs, u.avaliado_em, coalesce(m.nome, u.avaliado_por)
  from (
    select distinct on (p.pessoa_id) p.id, p.pessoa_id, pe.nome, pe.telefone, pe.cidade_origem_id, p.cargo, p.tipo, p.projeto_id,
      p.avaliacao_recontrataria, p.avaliacao_nota, p.avaliacao_obs, p.avaliado_em, p.avaliado_por
    from public.maparh_preadmissoes p
    join public.maparh_pessoas pe on pe.id = p.pessoa_id
    where maparh_priv.pode_rh() and p_projeto is not null and maparh_priv.pode_projeto(p_projeto)
      and p.avaliacao_recontrataria is not null and p.situacao = 'admitido' and p.projeto_id is distinct from p_projeto
      and pe.nome is distinct from 'Dados apagados (LGPD)'
      and not exists (select 1 from public.maparh_preadmissoes x where x.pessoa_id = p.pessoa_id and x.projeto_id = p_projeto)
    order by p.pessoa_id, p.avaliado_em desc nulls last
  ) u
  left join public.maparh_membros m on m.login = u.avaliado_por
  where u.avaliacao_recontrataria in ('sim', 'talvez')     -- vale a avaliação mais recente: quem foi "não" na última safra não entra
$$;

-- selo "já trabalhou": a avaliação mais recente (de outra safra) de quem está neste projeto e o usuário enxerga
create or replace function public.maparh_ja_trabalhou(p_projeto text)
returns table (pessoa_id uuid, recontrataria text, nota smallint, observacao text, cargo text, projeto_nome text, avaliado_em timestamptz)
language sql stable security definer set search_path to '' as $$
  select distinct on (p.pessoa_id) p.pessoa_id, p.avaliacao_recontrataria, p.avaliacao_nota, p.avaliacao_obs, p.cargo,
    maparh_priv.nome_projeto(p.projeto_id), p.avaliado_em
  from public.maparh_preadmissoes p
  where maparh_priv.pode_rh() and p_projeto is not null and maparh_priv.pode_projeto(p_projeto)
    and p.avaliacao_recontrataria is not null and p.situacao = 'admitido' and p.projeto_id is distinct from p_projeto
    and exists (select 1 from public.maparh_preadmissoes x where x.pessoa_id = p.pessoa_id and x.projeto_id = p_projeto
      and (maparh_priv.rh_ve_tudo() or x.analista_login = maparh_priv.meu_login() or maparh_priv.rh_da_vaga(x.vaga_id)))
  order by p.pessoa_id, p.avaliado_em desc nulls last
$$;

-- "Trazer para esta safra": cria o candidato no projeto atual (triagem, fonte recontratacao), reaproveitando a pessoa.
-- RH analista: fica no nome dele. Admin / RH liberado: entra sem RH, para direcionar.
create or replace function public.maparh_trazer_do_banco(p_pre uuid, p_projeto text)
returns uuid language plpgsql security definer set search_path to '' as $$
declare o record; v_login text; v_nome text; v_id uuid; v_analista boolean;
begin
  if not maparh_priv.pode_rh() then raise exception 'BANCO_SEM_PERMISSAO: só o RH traz pessoas do banco de talentos.' using errcode = 'P0001'; end if;
  if p_projeto is null or not maparh_priv.pode_projeto(p_projeto)
     or not exists (select 1 from public.maparh_itens i where i.colecao = 'projetos' and i.id = p_projeto and not i.removido) then
    raise exception 'BANCO_SEM_PERMISSAO: projeto não encontrado ou sem acesso.' using errcode = 'P0001';
  end if;
  select p.id, p.pessoa_id, p.projeto_id, p.cargo, p.avaliacao_recontrataria, p.avaliado_em into o
    from public.maparh_preadmissoes p join public.maparh_pessoas pe on pe.id = p.pessoa_id
    where p.id = p_pre and p.situacao = 'admitido' and p.avaliacao_recontrataria in ('sim', 'talvez') and p.projeto_id is distinct from p_projeto
      and pe.nome is distinct from 'Dados apagados (LGPD)';
  if not found then raise exception 'BANCO_INVALIDO: esta pessoa não está no banco de talentos (entra quem foi admitido e avaliado "sim" ou "talvez" em outra safra).' using errcode = 'P0001'; end if;
  if exists (select 1 from public.maparh_preadmissoes x where x.pessoa_id = o.pessoa_id and x.avaliacao_recontrataria = 'nao' and x.situacao = 'admitido'
             and x.avaliado_em > o.avaliado_em) then
    raise exception 'BANCO_INVALIDO: a avaliação mais recente desta pessoa é "não recontrataria".' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.maparh_preadmissoes x where x.pessoa_id = o.pessoa_id and x.projeto_id = p_projeto and x.situacao in ('em_andamento', 'admitido')) then
    raise exception 'BANCO_JA_ESTA: esta pessoa já está neste projeto.' using errcode = 'P0001';
  end if;
  select m.login, m.nome into v_login, v_nome from public.maparh_membros m where m.user_id = auth.uid() and m.ativo;
  v_analista := maparh_priv.perfil() = 'analista';
  insert into public.maparh_preadmissoes (pessoa_id, projeto_id, etapa, tipo, cargo, analista, analista_login, fonte, anotacoes)
  values (o.pessoa_id, p_projeto, 'triagem', 'LOCAL', o.cargo, case when v_analista then v_nome end, case when v_analista then v_login end, 'recontratacao',
    jsonb_build_array(jsonb_build_object('em', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'por', v_login, 'nome', coalesce(v_nome, 'Sistema'),
      'etapa', 'triagem', 'auto', true,
      'texto', 'Trazido do banco de talentos: trabalhou em ' || maparh_priv.nome_projeto(o.projeto_id) || coalesce(' como ' || nullif(o.cargo, ''), '')
        || ' (recontrataria ' || case o.avaliacao_recontrataria when 'sim' then 'sim' else 'talvez' end || ').')))
  returning id into v_id;
  update public.maparh_pessoas set ex_colaborador = true where id = o.pessoa_id and not coalesce(ex_colaborador, false);
  return v_id;
end $$;

revoke all on function public.maparh_banco_talentos(text) from public, anon;
revoke all on function public.maparh_ja_trabalhou(text) from public, anon;
revoke all on function public.maparh_trazer_do_banco(uuid, text) from public, anon;
grant execute on function public.maparh_banco_talentos(text) to authenticated;
grant execute on function public.maparh_ja_trabalhou(text) to authenticated;
grant execute on function public.maparh_trazer_do_banco(uuid, text) to authenticated;
