-- Teste das regras de acesso do Mapa RH, perfil por perfil.
-- Cria usuários e itens de teste, simula cada login, tenta ler e gravar e DESFAZ TUDO no final:
-- o bloco termina de propósito com um erro "RESULTADO (tudo desfeito): ..." — é o erro que faz o banco desfazer.
-- Em cada item, o valor obtido tem que ser igual ao que está entre parênteses.
do $$
declare
  a uuid := gen_random_uuid(); g uuid := gen_random_uuid(); l uuid := gen_random_uuid(); x uuid := gen_random_uuid();
  r text := ''; n int; ok boolean;
begin
  insert into auth.users (id, email, aud, role) values (a, 'tst-a@maparh.local', 'authenticated', 'authenticated'), (g, 'tst-g@maparh.local', 'authenticated', 'authenticated'), (l, 'tst-l@maparh.local', 'authenticated', 'authenticated'), (x, 'tst-x@maparh.local', 'authenticated', 'authenticated');
  insert into public.maparh_membros (user_id, login, nome, perfil, projetos) values (a, 'tst-a', 'A', 'admin', null), (g, 'tst-g', 'G', 'gestor', '["tst-p1"]'), (l, 'tst-l', 'L', 'leitor', '["tst-p1"]');
  insert into public.maparh_itens (colecao, id, dados) values
    ('projetos', 'tst-p1', '{"nome":"P1"}'), ('projetos', 'tst-p2', '{"nome":"P2"}'),
    ('vagas', 'tst-v1', '{"projetoId":"tst-p1"}'), ('vagas', 'tst-v2', '{"projetoId":"tst-p2"}'),
    ('candidatos', 'tst-c1', '{"vagaId":"tst-v1"}'), ('candidatos', 'tst-c2', '{"vagaId":"tst-v2"}'),
    ('registros', 'tst-r1', '{"projetoId":"tst-p1"}'), ('registros', 'tst-r2', '{"projetoId":"tst-p2"}'),
    ('distritos', 'tst-d1', '{"nome":"D"}'), ('auditoria', 'tst-a1', '{"acao":"x"}');

  -- GESTOR restrito ao projeto 1
  perform set_config('request.jwt.claims', json_build_object('sub', g, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.maparh_itens where id like 'tst-%' and colecao in ('projetos','vagas','candidatos','registros'); r := r || 'gestor le itens de projeto=' || n || ' (4) | ';
  select count(*) into n from public.maparh_itens where id = 'tst-d1'; r := r || 'gestor le distrito=' || n || ' (1) | ';
  select count(*) into n from public.maparh_itens where colecao = 'auditoria'; r := r || 'gestor le acoes=' || n || ' (0) | ';
  select count(*) into n from public.maparh_auditoria; r := r || 'gestor le auditoria do banco=' || n || ' (0) | ';
  begin insert into public.maparh_itens (colecao, id, dados) values ('registros', 'tst-r3', '{"projetoId":"tst-p1"}'); ok := true; exception when others then ok := false; end; r := r || 'gestor grava no p1=' || ok || ' (true) | ';
  begin insert into public.maparh_itens (colecao, id, dados) values ('registros', 'tst-r4', '{"projetoId":"tst-p2"}'); ok := true; exception when others then ok := false; end; r := r || 'gestor grava no p2=' || ok || ' (false) | ';
  update public.maparh_itens set dados = '{"projetoId":"tst-p2","x":1}' where id = 'tst-v2'; get diagnostics n = row_count; r := r || 'gestor altera vaga do p2=' || n || ' (0) | ';
  begin update public.maparh_itens set dados = '{"projetoId":"tst-p2"}' where id = 'tst-v1'; ok := true; exception when others then ok := false; end; r := r || 'gestor move vaga p1->p2=' || ok || ' (false) | ';
  begin insert into public.maparh_itens (colecao, id, dados) values ('auditoria', 'tst-a2', '{"acao":"login"}'); ok := true; exception when others then ok := false; end; r := r || 'gestor registra acao=' || ok || ' (true) | ';
  begin update public.maparh_membros set perfil = 'admin' where user_id = g; ok := true; exception when others then ok := false; end; r := r || 'gestor se promove=' || ok || ' (false) | ';
  begin delete from public.maparh_auditoria; ok := true; exception when others then ok := false; end; r := r || 'gestor apaga auditoria=' || ok || ' (false) | ';

  -- VISUALIZADOR restrito ao projeto 1
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', l, 'role', 'authenticated')::text, true); set local role authenticated;
  select count(*) into n from public.maparh_itens where id like 'tst-%' and colecao in ('projetos','vagas','candidatos','registros'); r := r || 'leitor le=' || n || ' (5) | ';
  begin insert into public.maparh_itens (colecao, id, dados) values ('registros', 'tst-r5', '{"projetoId":"tst-p1"}'); ok := true; exception when others then ok := false; end; r := r || 'leitor grava=' || ok || ' (false) | ';
  begin insert into public.maparh_itens (colecao, id, dados) values ('auditoria', 'tst-a3', '{"acao":"login"}'); ok := true; exception when others then ok := false; end; r := r || 'leitor registra acao=' || ok || ' (true) | ';

  -- conta que não é membro
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', x, 'role', 'authenticated')::text, true); set local role authenticated;
  select count(*) into n from public.maparh_itens; r := r || 'nao-membro le itens=' || n || ' (0) | ';
  select count(*) into n from public.maparh_membros; r := r || 'nao-membro le membros=' || n || ' (0) | ';

  -- ADMIN
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true); set local role authenticated;
  select count(*) into n from public.maparh_itens where id like 'tst-%' and colecao in ('projetos','vagas','candidatos','registros'); r := r || 'admin le=' || n || ' (9) | ';
  select count(*) into n from public.maparh_auditoria where item_id like 'tst-%'; r := r || 'admin ve auditoria do banco=' || n || ' (13) | ';
  select count(*) into n from public.maparh_auditoria where item_id = 'tst-r3' and login = 'tst-g' and operacao = 'criou'; r := r || 'auditoria sabe quem criou=' || n || ' (1) | ';
  begin delete from public.maparh_auditoria; ok := true; exception when others then ok := false; end; r := r || 'admin apaga auditoria=' || ok || ' (false)';
  reset role;
  raise exception 'RESULTADO (tudo desfeito): %', r;
end $$;
