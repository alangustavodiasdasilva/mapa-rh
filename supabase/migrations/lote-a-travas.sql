-- 17/11/2026 — Lote A (avaliação): travas para não perder nem falsificar dado.

-- 1) Itens sincronizados (vagas, projetos, cadastros): trava de versão e regras da vaga.
--    O navegador manda dados._base = o atualizadoEm da versão em que ele se baseou; se o banco já tem outra, recusa.
--    Exclusão (removido) guarda o conteúdo antigo para dar para recuperar.
create or replace function maparh_priv.guardar_item() returns trigger
language plpgsql security definer set search_path to '' as $$
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
  -- excluir guarda o conteúdo (recuperável)
  if new.removido and (new.dados is null or new.dados = '{}'::jsonb) and v_old.id is not null then new.dados := v_old.dados; end if;
  if auth.uid() is not null and new.colecao = 'vagas' then
    v_perfil := maparh_priv.perfil();
    -- aprovar/recusar: só administrador
    if coalesce(new.dados->'aprovacao'->>'situacao', '') in ('aprovada', 'recusada')
       and coalesce(new.dados->'aprovacao'->>'situacao', '') is distinct from coalesce(v_old.dados->'aprovacao'->>'situacao', '')
       and v_perfil is distinct from 'admin' then
      raise exception 'REGRA_VAGA: só um administrador pode aprovar ou recusar vagas' using errcode = 'P0001';
    end if;
    -- excluir vaga com candidatos: não (cancele a vaga)
    if new.removido and not coalesce(v_old.removido, true)
       and exists (select 1 from public.maparh_preadmissoes p where p.vaga_id = new.id and p.situacao in ('em_andamento', 'admitido')) then
      raise exception 'REGRA_VAGA: a vaga "%" tem candidatos; use Cancelar vaga em vez de excluir', coalesce(v_old.dados->>'titulo', new.id) using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists maparh_itens_guardar on public.maparh_itens;
create trigger maparh_itens_guardar before insert or update on public.maparh_itens
  for each row execute function maparh_priv.guardar_item();

-- 2) Admissão só pelas funções (Admitir / Desfazer); sem passar do pedido; uma admissão ativa por pessoa.
create or replace function maparh_priv.guardar_admissao() returns trigger
language plpgsql security definer set search_path to '' as $$
begin
  if auth.uid() is null or current_setting('maparh.via_funcao', true) = '1' then return new; end if;
  if (tg_op = 'INSERT' and (new.situacao = 'admitido' or new.registro_id is not null))
     or (tg_op = 'UPDATE' and ((new.situacao = 'admitido') is distinct from (old.situacao = 'admitido')
                               or new.registro_id is distinct from old.registro_id or new.admitido_em is distinct from old.admitido_em)) then
    raise exception 'ADMISSAO_SO_PELO_BOTAO: para admitir ou desfazer a admissão, use os botões Admitir / Desfazer' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists maparh_pre_a_guardar_admissao on public.maparh_preadmissoes;
create trigger maparh_pre_a_guardar_admissao before insert or update on public.maparh_preadmissoes
  for each row execute function maparh_priv.guardar_admissao();

create or replace function public.maparh_admitir(p_pre uuid, p_atuacao text, p_base text default null)
returns jsonb language plpgsql set search_path to '' as $$
declare v_id uuid; r record; v jsonb; v_ped int; v_adm int; v_outro text;
begin
  select * into r from public.maparh_preadmissoes where id = p_pre;
  if r.id is null then raise exception 'Não deu para admitir: candidato não encontrado ou sem permissão.'; end if;
  -- a mesma pessoa não pode estar admitida em outro processo (outro projeto) ao mesmo tempo
  select pr.projeto_id into v_outro from public.maparh_preadmissoes pr where pr.pessoa_id = r.pessoa_id and pr.id <> r.id and pr.situacao = 'admitido' limit 1;
  if v_outro is not null then raise exception 'ADMISSAO_BLOQUEADA: esta pessoa já está admitida em outro projeto; desfaça lá antes'; end if;
  -- não passar do pedido da vaga (por distrito e tipo; vaga antiga sem distritos: pela quantidade)
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
end $$;

create or replace function public.maparh_desfazer_admissao(p_pre uuid, p_motivo text)
returns void language plpgsql set search_path to '' as $$
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
end $$;

-- só apaga a contratação daquela admissão
create or replace function maparh_priv.apagar_registro_da_admissao(p_pre uuid, p_reg text) returns void
language plpgsql security definer set search_path to '' as $$
begin
  if exists (select 1 from public.maparh_preadmissoes where id = p_pre and situacao = 'admitido') then raise exception 'Ainda está admitido.'; end if;
  if p_reg is null then return; end if;
  if p_reg <> 'adm-' || p_pre::text then raise exception 'Contratação não corresponde a esta admissão.'; end if;
  update public.maparh_itens set removido = true where colecao = 'registros' and id = p_reg;
end $$;

-- 3) Histórico: só acrescenta (ninguém apaga nem altera o que já está), e o que entra leva o nome de quem está logado.
--    Também: datas de entrada em Entrevista/Documentação e a saída do processo.
create or replace function maparh_priv.historico_e_autor() returns trigger
language plpgsql security definer set search_path to '' as $$
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
    -- o que foi acrescentado leva quem está logado e a hora do banco
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
        null;  -- desfazer: a função maparh_desfazer_admissao já anota com o motivo
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
end $$;
