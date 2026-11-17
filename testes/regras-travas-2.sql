-- Teste da segunda rodada de travas (documentos do cargo, admitido congelado, pessoa admitida, admissão duplicada,
-- consulta de CPF restrita, contagem de vagas, salvar candidato, importação). DESFAZ TUDO no final.
do $$
declare
  a uuid := gen_random_uuid(); n1 uuid := gen_random_uuid(); n2 uuid := gen_random_uuid(); l uuid := gen_random_uuid();
  r text := ''; ok boolean; pe uuid; pr uuid; pr2 uuid; j jsonb; n int; d date;
  todos jsonb := '{"Carteira de Trabalho digital":"entregue","RG e CPF":"entregue","Comprovante de residência":"entregue","Número do PIS/NIS":"entregue","Título de eleitor":"entregue","Certificado de reservista":"entregue","Certidão de nascimento ou casamento":"entregue","Certidão de nascimento dos filhos":"entregue","Comprovante de escolaridade":"entregue","Exame admissional":"entregue","Foto 3x4":"entregue","Dados bancários":"entregue","CNH":"entregue","Registro no conselho de classe":"entregue"}';
begin
  insert into auth.users (id, email, aud, role) values (a, 'tst-a@maparh.local', 'authenticated', 'authenticated'), (n1, 'tst-n1@maparh.local', 'authenticated', 'authenticated'),
    (n2, 'tst-n2@maparh.local', 'authenticated', 'authenticated'), (l, 'tst-l@maparh.local', 'authenticated', 'authenticated');
  insert into public.maparh_membros (user_id, login, nome, perfil, projetos) values (a, 'tst-a', 'A', 'admin', null), (n1, 'tst-n1', 'N1', 'analista', '["tst-p1"]'), (n2, 'tst-n2', 'N2', 'analista', '["tst-p1"]'), (l, 'tst-l', 'L', 'leitor', null);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true); set local role authenticated;
  insert into public.maparh_itens (colecao, id, dados) values ('cargos', 'tst-c1', '{"nome":"Tst Operador","documentos":["RG e CPF","Foto 3x4"]}');
  insert into public.maparh_pessoas (cpf, nome, nascimento) values ('52998224725', 'Tst Pessoa', date '1990-05-10') returning id into pe;
  insert into public.maparh_preadmissoes (pessoa_id, projeto_id, etapa, dinamica, aso, aso_data, treinamento, documentos, cargo, analista_login, vaga_id)
    values (pe, 'tst-p1', 'documentos', 'ok', 'ok', current_date - 1, 'ok', '{"Foto 3x4":"entregue","Outro":"entregue"}', 'Tst Operador', 'tst-n1', 'tst-v1') returning id into pr;
  insert into public.maparh_itens (colecao, id, dados) values ('vagas', 'tst-v1', '{"projetoId":"tst-p1","status":"aberta","recrutadorLogin":"tst-n1"}');

  -- documentos conferidos contra o cargo (falta "RG e CPF")
  begin update public.maparh_preadmissoes set situacao = 'admitido', registro_id = 'adm-' || id::text where id = pr; ok := true; exception when others then ok := false; end; r := r || 'falta doc do cargo=' || ok || ' (false) | ';
  -- cargo sem cadastro cobra a lista padrão inteira
  begin update public.maparh_preadmissoes set cargo = 'Cargo Inexistente', documentos = '{"RG e CPF":"entregue","Foto 3x4":"entregue"}', situacao = 'admitido' where id = pr; ok := true; exception when others then ok := false; end; r := r || 'cargo sem cadastro so com 2 docs=' || ok || ' (false) | ';
  -- vaga cancelada não admite
  update public.maparh_itens set dados = jsonb_set(dados, '{status}', '"cancelada"') where colecao = 'vagas' and id = 'tst-v1';
  begin update public.maparh_preadmissoes set cargo = 'Tst Operador', documentos = '{"RG e CPF":"entregue","Foto 3x4":"entregue"}', situacao = 'admitido' where id = pr; ok := true; exception when others then ok := false; end; r := r || 'vaga cancelada=' || ok || ' (false) | ';
  update public.maparh_itens set dados = jsonb_set(dados, '{status}', '"aberta"') where colecao = 'vagas' and id = 'tst-v1';
  -- tudo certo: admite e a data é a de hoje em Brasília, mesmo mandando outra
  begin update public.maparh_preadmissoes set cargo = 'Tst Operador', documentos = '{"RG e CPF":"entregue","Foto 3x4":"entregue"}', situacao = 'admitido', admitido_em = date '2030-01-01' where id = pr; ok := true; exception when others then ok := false; end; r := r || 'admite certo=' || ok || ' (true) | ';
  select admitido_em into d from public.maparh_preadmissoes where id = pr; r := r || 'data forcada para hoje=' || (d = (now() at time zone 'America/Sao_Paulo')::date) || ' (true) | ';
  -- admitido congelado
  begin update public.maparh_preadmissoes set distrito_id = 'outro' where id = pr; ok := true; exception when others then ok := false; end; r := r || 'muda distrito de admitido=' || ok || ' (false) | ';
  begin update public.maparh_preadmissoes set admitido_em = date '2020-01-01' where id = pr; ok := true; exception when others then ok := false; end; r := r || 'muda data de admitido=' || ok || ' (false) | ';
  begin update public.maparh_preadmissoes set situacao = 'reprovado' where id = pr; ok := true; exception when others then ok := false; end; r := r || 'admitido vira reprovado=' || ok || ' (false) | ';
  -- pessoa admitida: CPF e nascimento travados
  begin update public.maparh_pessoas set nascimento = date '2015-01-01' where id = pe; ok := true; exception when others then ok := false; end; r := r || 'muda nascimento de admitido=' || ok || ' (false) | ';
  begin update public.maparh_pessoas set telefone = '(54) 90000-0000' where id = pe; ok := true; exception when others then ok := false; end; r := r || 'muda telefone de admitido=' || ok || ' (true) | ';
  -- admissão duplicada no mesmo projeto
  insert into public.maparh_preadmissoes (pessoa_id, projeto_id, etapa, dinamica, aso, aso_data, treinamento, documentos, cargo) values (pe, 'tst-p1', 'documentos', 'ok', 'ok', current_date - 1, 'ok', '{"RG e CPF":"entregue","Foto 3x4":"entregue"}', 'Tst Operador') returning id into pr2;
  begin update public.maparh_preadmissoes set situacao = 'admitido', registro_id = 'adm-' || id::text where id = pr2; ok := true; exception when others then ok := false; end; r := r || 'admite 2x no projeto=' || ok || ' (false) | ';
  delete from public.maparh_preadmissoes where id = pr2;
  -- desfazer limpa data e registro
  update public.maparh_preadmissoes set registro_id = registro_id where id = pr;
  begin update public.maparh_preadmissoes set situacao = 'em_andamento' where id = pr; ok := true; exception when others then ok := false; end;
  select admitido_em into d from public.maparh_preadmissoes where id = pr; r := r || 'desfazer=' || ok || ' e limpa data=' || (d is null) || ' (true/true) | ';

  -- ANALISTA 2: pessoa do analista 1 aparece só como "já existe"; não abre processo para ela
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', n2, 'role', 'authenticated')::text, true); set local role authenticated;
  j := public.maparh_pessoa_do_cpf('52998224725'); r := r || 'cpf de outro restrito=' || coalesce(j->>'restrito', 'false') || ' e sem nome=' || (j->>'nome' is null) || ' (true/true) | ';
  begin insert into public.maparh_preadmissoes (pessoa_id, projeto_id, analista_login, etapa) values (pe, 'tst-p2', 'tst-n2', 'triagem'); ok := true; exception when others then ok := false; end; r := r || 'abre processo p/ pessoa de outro=' || ok || ' (false) | ';
  begin perform public.maparh_salvar_candidato(jsonb_build_object('id', pe, 'nome', 'Hack'), jsonb_build_object('id', pr, 'projeto_id', 'tst-p1')); ok := true; exception when others then ok := false; end; r := r || 'salva pessoa/processo de outro=' || ok || ' (false) | ';
  -- salvar candidato novo (dele) funciona de uma vez
  begin perform public.maparh_salvar_candidato('{"nome":"Tst Novo do N2","telefone":"(54) 98888-1111"}', '{"projeto_id":"tst-p1","analista_login":"tst-n2","etapa":"triagem"}'); ok := true; exception when others then ok := false; end; r := r || 'salva candidato novo=' || ok || ' (true) | ';
  -- ANALISTA 1: vê a própria pessoa por completo
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', n1, 'role', 'authenticated')::text, true); set local role authenticated;
  j := public.maparh_pessoa_do_cpf('52998224725'); r := r || 'cpf da propria pessoa completo=' || (j->>'nome' = 'Tst Pessoa') || ' (true) | ';
  -- VISUALIZADOR: contagem das vagas (sem dado pessoal) funciona
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', l, 'role', 'authenticated')::text, true); set local role authenticated;
  select count(*) into n from public.maparh_contagem_vagas('tst-p1'); r := r || 'leitor ve contagem=' || (n > 0) || ' (true) | ';
  -- ADMIN: importação pula quem a planilha traz como admitido/fora; ASO e treinamento vêm da planilha
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true); set local role authenticated;
  j := public.maparh_importar_preadmissoes('tst-p1', 't.xlsx', '[{"nome":"Tst Ja Admitido","cpf":"11144477735","situacao_planilha":"admitido"},{"nome":"Tst Fora","situacao_planilha":"fora"},{"nome":"Tst Apto","cpf":"39053344705","aso":"ok","treinamento":"ok"}]');
  r := r || 'importa=' || (j->>'importadas') || ' ignora=' || (j->>'ignoradas') || ' (1/2) | ';
  select count(*) into n from public.maparh_preadmissoes p join public.maparh_pessoas x on x.id = p.pessoa_id where x.cpf = '39053344705' and p.aso = 'ok' and p.treinamento = 'ok'; r := r || 'aso e treino da planilha=' || n || ' (1)';
  reset role;
  raise exception 'RESULTADO (tudo desfeito): %', r;
end $$;
