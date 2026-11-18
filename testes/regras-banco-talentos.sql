-- Teste: avaliação de fim de safra, banco de talentos, "já trabalhou", trazer do banco, "não é a mesma pessoa". DESFAZ TUDO no final.
do $$
declare
  a uuid := gen_random_uuid(); n1 uuid := gen_random_uuid(); n2 uuid := gen_random_uuid(); l uuid := gen_random_uuid();
  r text := ''; ok boolean; err text; p1 uuid; p2 uuid; p3 uuid; pr1 uuid := gen_random_uuid(); pr2 uuid := gen_random_uuid(); pr3 uuid := gen_random_uuid();
  pa1 uuid; novo uuid; n int; t text; arr uuid[]; u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid();
  todos jsonb := '{"Carteira de Trabalho digital":"entregue","RG e CPF":"entregue","Comprovante de residência":"entregue","Número do PIS/NIS":"entregue","Título de eleitor":"entregue","Certificado de reservista":"entregue","Certidão de nascimento ou casamento":"entregue","Certidão de nascimento dos filhos":"entregue","Comprovante de escolaridade":"entregue","Exame admissional":"entregue","Foto 3x4":"entregue","Dados bancários":"entregue","CNH":"entregue","Registro no conselho de classe":"entregue"}';
begin
  -- montagem (sem usuário logado: admissão direta só para preparar)
  insert into auth.users (id, email, aud, role) values (a, 'tst-a@maparh.local', 'authenticated', 'authenticated'), (n1, 'tst-n1@maparh.local', 'authenticated', 'authenticated'),
    (n2, 'tst-n2@maparh.local', 'authenticated', 'authenticated'), (l, 'tst-l@maparh.local', 'authenticated', 'authenticated');
  insert into public.maparh_membros (user_id, login, nome, perfil, projetos) values (a, 'tst-a', 'A', 'admin', null), (n1, 'tst-n1', 'N1', 'analista', '["tst-p1","tst-p2"]'),
    (n2, 'tst-n2', 'N2', 'analista', '["tst-p1","tst-p2"]'), (l, 'tst-l', 'L', 'leitor', null);
  insert into public.maparh_itens (colecao, id, dados) values ('projetos', 'tst-p1', '{"nome":"Tst Safra","ano":2025}'), ('projetos', 'tst-p2', '{"nome":"Tst Safra","ano":2026}');
  insert into public.maparh_pessoas (cpf, nome, nascimento, telefone) values ('52998224725', 'Tst Um', date '1990-01-01', '(54) 90000-0001') returning id into p1;
  insert into public.maparh_pessoas (cpf, nome, nascimento, telefone) values ('11144477735', 'Tst Dois', date '1990-01-01', '(54) 90000-0002') returning id into p2;
  insert into public.maparh_pessoas (cpf, nome, nascimento, telefone) values ('12345678909', 'Tst Tres', date '1990-01-01', '(54) 90000-0003') returning id into p3;
  insert into public.maparh_preadmissoes (id, pessoa_id, projeto_id, etapa, dinamica, aso, treinamento, documentos, cargo, analista_login, situacao, registro_id) values
    (pr1, p1, 'tst-p1', 'documentos', 'ok', 'dispensado', 'dispensado', todos, 'Tst Rural', 'tst-n1', 'admitido', 'adm-' || pr1),
    (pr2, p2, 'tst-p1', 'documentos', 'ok', 'dispensado', 'dispensado', todos, 'Tst Operador', 'tst-n2', 'admitido', 'adm-' || pr2),
    (pr3, p3, 'tst-p1', 'documentos', 'ok', 'dispensado', 'dispensado', todos, 'Tst Rural', 'tst-n2', 'admitido', 'adm-' || pr3);
  insert into public.maparh_preadmissoes (pessoa_id, projeto_id, etapa, analista_login) values (p1, 'tst-p2', 'triagem', 'tst-n1') returning id into pa1;

  -- RH ANALISTA 1
  perform set_config('request.jwt.claims', json_build_object('sub', n1, 'role', 'authenticated')::text, true); set local role authenticated;
  begin perform public.maparh_salvar_candidato(jsonb_build_object('id', p1), jsonb_build_object('id', pr1, 'avaliacao_recontrataria', 'sim', 'avaliacao_nota', 4, 'avaliacao_obs', ' bom ')); ok := true; exception when others then ok := false; end;
  select avaliado_por, anotacoes->-1->>'texto' into err, t from public.maparh_preadmissoes where id = pr1;
  r := r || 'RH avalia o dele=' || ok || ' autor=' || coalesce(err, '-') || ' hist="' || coalesce(t, '-') || '" (true, tst-n1, Avaliado: recontrataria sim · nota 4/5.) | ';
  select avaliacao_obs into t from public.maparh_preadmissoes where id = pr1; r := r || 'obs aparada=' || (t = 'bom') || ' (true) | ';
  begin perform public.maparh_salvar_candidato(jsonb_build_object('id', p2), jsonb_build_object('id', pr2, 'avaliacao_recontrataria', 'nao')); ok := true; exception when others then ok := false; end;
  r := r || 'RH avalia o de outro=' || ok || ' (false) | ';
  update public.maparh_preadmissoes set avaliado_por = 'hack', avaliado_em = now() - interval '9 days' where id = pr1;
  select avaliado_por into t from public.maparh_preadmissoes where id = pr1; r := r || 'autor nao muda a mao=' || (t = 'tst-n1') || ' (true) | ';
  begin update public.maparh_preadmissoes set avaliacao_recontrataria = 'sim' where id = pa1; ok := true; exception when others then ok := false; err := sqlerrm; end;
  r := r || 'avalia quem nao foi admitido=' || ok || ' (false) | ';
  begin perform public.maparh_salvar_candidato(jsonb_build_object('id', p1), jsonb_build_object('id', pr1, 'avaliacao_nota', 9)); ok := true; exception when others then ok := false; end;
  r := r || 'nota 9=' || ok || ' (false) | ';

  -- ADMIN avalia os do RH 2
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true); set local role authenticated;
  begin perform public.maparh_salvar_candidato(jsonb_build_object('id', p2), jsonb_build_object('id', pr2, 'avaliacao_recontrataria', 'talvez')); ok := true; exception when others then ok := false; end;
  r := r || 'admin avalia=' || ok || ' (true) | ';
  perform public.maparh_salvar_candidato(jsonb_build_object('id', p3), jsonb_build_object('id', pr3, 'avaliacao_recontrataria', 'nao', 'avaliacao_obs', 'faltava'));

  -- RH 1 na safra nova: banco e já trabalhou
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', n1, 'role', 'authenticated')::text, true); set local role authenticated;
  select count(*), string_agg(nome || ':' || recontrataria || ':' || projeto_nome, ',') into n, t from public.maparh_banco_talentos('tst-p2');
  r := r || 'banco (RH1)=' || n || ' ' || coalesce(t, '-') || ' (1 Tst Dois:talvez:Tst Safra 2025 — Um já está na safra, Tres é nao) | ';
  select count(*), string_agg(recontrataria, ',') into n, t from public.maparh_ja_trabalhou('tst-p2');
  r := r || 'ja trabalhou (RH1)=' || n || ' ' || coalesce(t, '-') || ' (1 sim) | ';
  begin novo := public.maparh_trazer_do_banco(pr3, 'tst-p2'); ok := true; exception when others then ok := false; end;
  r := r || 'trazer quem e nao=' || ok || ' (false) | ';
  begin novo := public.maparh_trazer_do_banco(pr2, 'tst-p2'); ok := true; exception when others then ok := false; err := sqlerrm; end;
  r := r || 'trazer do banco=' || ok || coalesce(' ' || case when ok then null else err end, '') || ' (true) | ';
  select analista_login || '/' || fonte || '/' || etapa || '/' || (anotacoes->0->>'texto') into t from public.maparh_preadmissoes where id = novo;
  r := r || 'novo=' || coalesce(t, 'nao enxerga') || ' (tst-n1/recontratacao/triagem/Trazido...) | ';
  select count(*) into n from public.maparh_pessoas where id = p2; r := r || 'RH1 enxerga a pessoa trazida=' || n || ' (1) | ';
  select ex_colaborador::text into t from public.maparh_pessoas where id = p2; r := r || 'virou ex-colaborador=' || coalesce(t, '-') || ' (true) | ';
  begin novo := public.maparh_trazer_do_banco(pr2, 'tst-p2'); ok := true; exception when others then ok := false; end;
  r := r || 'trazer 2x=' || ok || ' (false) | ';
  select count(*) into n from public.maparh_banco_talentos('tst-p2'); r := r || 'banco depois=' || n || ' (0) | ';
  select count(*) into n from public.maparh_ja_trabalhou('tst-p2'); r := r || 'ja trabalhou depois=' || n || ' (2) | ';
  -- não é a mesma pessoa: só acrescenta
  perform public.maparh_salvar_candidato(jsonb_build_object('id', p1), jsonb_build_object('id', pa1, 'nao_duplicado', jsonb_build_array(u1)));
  perform public.maparh_salvar_candidato(jsonb_build_object('id', p1), jsonb_build_object('id', pa1, 'nao_duplicado', jsonb_build_array(u2, u1)));
  select nao_duplicado into arr from public.maparh_preadmissoes where id = pa1; r := r || 'nao_duplicado une=' || cardinality(arr) || ' (2) | ';

  -- RH 2 não vê o "já trabalhou" de quem é do RH 1 na safra nova
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', n2, 'role', 'authenticated')::text, true); set local role authenticated;
  select count(*) into n from public.maparh_ja_trabalhou('tst-p2'); r := r || 'ja trabalhou (RH2)=' || n || ' (0) | ';
  -- LEITOR: nada
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', l, 'role', 'authenticated')::text, true); set local role authenticated;
  select count(*) into n from public.maparh_banco_talentos('tst-p1'); r := r || 'leitor banco=' || n || ' (0) | ';
  begin novo := public.maparh_trazer_do_banco(pr2, 'tst-p2'); ok := true; exception when others then ok := false; end; r := r || 'leitor traz=' || ok || ' (false) | ';
  -- ANON: sem permissão
  reset role; perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true); set local role anon;
  begin select count(*) into n from public.maparh_banco_talentos('tst-p1'); ok := true; exception when others then ok := false; end; r := r || 'anon banco=' || ok || ' (false) | ';
  reset role;
  raise exception 'RESULTADO (tudo desfeito): %', r;
end $$;
