-- Teste das regras de acesso do fluxo único de Candidatos (etapas, candidatura sem CPF e perfil "analista").
-- Mesmo esquema dos outros: cria dados de teste, simula cada login e DESFAZ TUDO no final
-- (termina de propósito com o erro "RESULTADO (tudo desfeito): ..."). O obtido tem que ser igual ao que está entre parênteses.
do $$
declare
  a uuid := gen_random_uuid(); g uuid := gen_random_uuid(); n1 uuid := gen_random_uuid(); n2 uuid := gen_random_uuid(); l uuid := gen_random_uuid();
  r text := ''; n int; ok boolean; j jsonb; pid uuid; meu uuid;
  linhas jsonb := '[{"nome":"Tst Sem CPF","telefone":"(54) 99999-0001","etapa":"triagem","analista":"N1","analista_login":"tst-n1","vaga_id":"tst-v1","distrito_id":"tst-d1","distancia_km":"12.5","cargo":"Operador","tipo":"LOCAL"},
                    {"cpf":"52998224725","nome":"Tst Com CPF","etapa":"triagem","analista_login":"tst-n2","tipo":"MOVEL"},
                    {"nome":"tst sem cpf","telefone":"54999990001","etapa":"triagem"},
                    {"nome":"Tst Sem Dono","etapa":"entrevista"},
                    {"cpf":"11144477735","nome":"Tst Planilha Antiga"}]';
begin
  insert into auth.users (id, email, aud, role) values (a, 'tst-a@maparh.local', 'authenticated', 'authenticated'), (g, 'tst-g@maparh.local', 'authenticated', 'authenticated'),
    (n1, 'tst-n1@maparh.local', 'authenticated', 'authenticated'), (n2, 'tst-n2@maparh.local', 'authenticated', 'authenticated'), (l, 'tst-l@maparh.local', 'authenticated', 'authenticated');
  insert into public.maparh_membros (user_id, login, nome, perfil, projetos, rh) values (a, 'tst-a', 'A', 'admin', null, false), (g, 'tst-g', 'G', 'gestor', '["tst-p1"]', true),
    (n1, 'tst-n1', 'N1', 'analista', '["tst-p1"]', false), (n2, 'tst-n2', 'N2', 'analista', '["tst-p1"]', false), (l, 'tst-l', 'L', 'leitor', null, false);

  -- ADMIN: importa as candidaturas (com e sem CPF) e cria duas vagas, uma para cada analista
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true); set local role authenticated;
  j := public.maparh_importar_preadmissoes('tst-p1', 'forms.xlsx', linhas);
  r := r || 'importadas=' || (j->>'importadas') || ' (4) | ignoradas=' || (j->>'ignoradas') || ' (1) | ';
  select count(*) into n from public.maparh_pessoas where cpf is null and nome like 'Tst%'; r := r || 'pessoas sem cpf=' || n || ' (2) | ';
  select count(*) into n from public.maparh_preadmissoes where projeto_id = 'tst-p1' and etapa = 'triagem' and vaga_id = 'tst-v1' and distrito_id = 'tst-d1' and distancia_km = 12.5 and cargo = 'Operador'; r := r || 'vaga distrito e cargo gravados=' || n || ' (1) | ';
  select count(*) into n from public.maparh_preadmissoes where projeto_id = 'tst-p1' and etapa = 'documentos'; r := r || 'planilha sem etapa cai em documentos=' || n || ' (1) | ';
  insert into public.maparh_itens (colecao, id, dados) values ('vagas', 'tst-v1', '{"projetoId":"tst-p1","recrutadorLogin":"tst-n1"}'), ('vagas', 'tst-v2', '{"projetoId":"tst-p1","recrutadorLogin":"tst-n2"}');
  begin update public.maparh_preadmissoes set etapa = 'qualquer' where projeto_id = 'tst-p1'; ok := true; exception when others then ok := false; end; r := r || 'aceita etapa invalida=' || ok || ' (false) | ';

  -- ANALISTA 1: só o que está no nome dele
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', n1, 'role', 'authenticated')::text, true); set local role authenticated;
  select count(*) into n from public.maparh_preadmissoes; r := r || 'analista le pre=' || n || ' (1) | ';
  select count(*) into n from public.maparh_pessoas; r := r || 'analista le pessoas=' || n || ' (1) | ';
  select count(*) into n from public.maparh_itens where colecao = 'vagas' and id like 'tst-%'; r := r || 'analista le vagas=' || n || ' (1) | ';
  update public.maparh_preadmissoes set etapa = 'entrevista' where projeto_id = 'tst-p1'; get diagnostics n = row_count; r := r || 'analista avanca os dele=' || n || ' (1) | ';
  begin update public.maparh_preadmissoes set analista_login = 'tst-n2' where projeto_id = 'tst-p1'; ok := true; exception when others then ok := false; end; r := r || 'analista passa para outro=' || ok || ' (false) | ';
  insert into public.maparh_pessoas (nome, telefone) values ('Tst Do Analista', '(54) 98888-0000') returning id into meu;
  begin insert into public.maparh_preadmissoes (pessoa_id, projeto_id, analista_login, etapa) values (meu, 'tst-p1', 'tst-n1', 'triagem'); ok := true; exception when others then ok := false; end; r := r || 'analista cadastra no nome dele=' || ok || ' (true) | ';
  begin insert into public.maparh_preadmissoes (pessoa_id, projeto_id, analista_login, etapa) values (meu, 'tst-p2', 'tst-n1', 'triagem'); ok := true; exception when others then ok := false; end; r := r || 'analista cadastra em projeto alheio=' || ok || ' (false) | ';
  begin j := public.maparh_importar_preadmissoes('tst-p1', 'x', linhas); ok := true; exception when others then ok := false; end; r := r || 'analista importa planilha=' || ok || ' (false) | ';
  r := r || 'analista acha pessoa de outro pelo cpf=' || (public.maparh_pessoa_do_cpf('52998224725') is not null) || ' (true) | ';
  begin insert into public.maparh_itens (colecao, id, dados) values ('registros', 'tst-r1', '{"projetoId":"tst-p1"}'); ok := true; exception when others then ok := false; end; r := r || 'analista grava contratacao ao admitir=' || ok || ' (true) | ';
  begin insert into public.maparh_itens (colecao, id, dados) values ('vagas', 'tst-v3', '{"projetoId":"tst-p1","recrutadorLogin":"tst-n1"}'); ok := true; exception when others then ok := false; end; r := r || 'analista cria vaga=' || ok || ' (false) | ';
  begin delete from public.maparh_pessoas where nome like 'Tst%'; ok := true; exception when others then ok := false; end; r := r || 'analista apaga pessoas=' || ok || ' (false) | ';

  -- ANALISTA 2: não vê o que é do 1
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', n2, 'role', 'authenticated')::text, true); set local role authenticated;
  select count(*) into n from public.maparh_preadmissoes; r := r || 'outro analista le pre=' || n || ' (1) | ';
  select count(*) into n from public.maparh_preadmissoes where analista_login = 'tst-n1'; r := r || 'outro analista le os do primeiro=' || n || ' (0) | ';

  -- GESTOR liberado: vê todos os RHs do projeto dele e redistribui
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', g, 'role', 'authenticated')::text, true); set local role authenticated;
  select count(*) into n from public.maparh_preadmissoes where projeto_id = 'tst-p1'; r := r || 'gestor le todos=' || n || ' (5) | ';
  update public.maparh_preadmissoes set analista_login = 'tst-n2', analista = 'N2' where projeto_id = 'tst-p1' and analista_login is null; get diagnostics n = row_count; r := r || 'gestor direciona os sem dono=' || n || ' (2) | ';
  select count(*) into n from public.maparh_itens where colecao = 'vagas' and id like 'tst-%'; r := r || 'gestor le vagas=' || n || ' (2) | ';

  -- VISUALIZADOR: nada de dado pessoal
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', l, 'role', 'authenticated')::text, true); set local role authenticated;
  select count(*) into n from public.maparh_preadmissoes; r := r || 'leitor le pre=' || n || ' (0) | ';
  begin j := public.maparh_pessoa_do_cpf('52998224725'); ok := true; exception when others then ok := false; end; r := r || 'leitor consulta cpf=' || ok || ' (false)';

  reset role;
  raise exception 'RESULTADO (tudo desfeito): %', r;
end $$;
