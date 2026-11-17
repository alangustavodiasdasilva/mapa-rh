-- 17/11/2026: histórico mais completo — quem admitiu (com vaga/distrito/tipo), entrevista marcada, ASO, treinamento,
-- documentos entregues e chegada. (Resultado da entrevista e remarcação já são anotados pela tela; desfazer admissão, pela função do banco.)
create or replace function maparh_priv.historico_e_autor() returns trigger
language plpgsql security definer set search_path to '' as $$
declare v_login text; v_nome text; v_add jsonb := '[]'::jsonb; v_dest text; v_txt text; v_dist text; n_ok int; n_tot int;
  rot constant jsonb := '{"triagem":"Triagem","entrevista":"Entrevista","documentos":"Documentação"}';
  aso constant jsonb := '{"pendente":"pendente","agendado":"agendado","ok":"apto","inapto":"inapto","dispensado":"dispensado"}';
  tre constant jsonb := '{"pendente":"pendente","agendado":"agendado","ok":"concluído","reprovado":"reprovado","dispensado":"dispensado"}';
begin
  select m.login, m.nome into v_login, v_nome from public.maparh_membros m where m.user_id = auth.uid();
  if v_login is not null then new.atualizado_por := v_login; end if;
  if tg_op = 'INSERT' then
    if coalesce(jsonb_array_length(new.anotacoes), 0) = 0 then
      v_add := v_add || jsonb_build_array('Cadastrado na ' || coalesce(rot->>new.etapa, new.etapa) || '.');
    end if;
  else
    if new.etapa is distinct from old.etapa then
      v_add := v_add || jsonb_build_array('Passou para ' || coalesce(rot->>new.etapa, new.etapa) || '.');
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
        v_add := v_add || jsonb_build_array('Voltou para o processo.');
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
    if new.aso is distinct from old.aso then
      v_add := v_add || jsonb_build_array('ASO: ' || coalesce(aso->>new.aso, new.aso) || coalesce(' (' || to_char(new.aso_data, 'DD/MM') || ')', '') || '.');
    end if;
    if new.treinamento is distinct from old.treinamento then
      v_add := v_add || jsonb_build_array('Treinamento: ' || coalesce(tre->>new.treinamento, new.treinamento) || '.');
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
