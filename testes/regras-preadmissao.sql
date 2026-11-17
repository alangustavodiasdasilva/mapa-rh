-- Teste das regras de acesso da Pré-admissão (pessoas, pré-admissões, importação e desfazer).
-- Mesmo esquema do regras-de-acesso.sql: cria dados de teste, simula cada login e DESFAZ TUDO no final
-- (termina de propósito com o erro "RESULTADO (tudo desfeito): ..."). O obtido tem que ser igual ao que está entre parênteses.
do $$
declare
  a uuid := gen_random_uuid(); g uuid := gen_random_uuid(); h uuid := gen_random_uuid(); l uuid := gen_random_uuid();
  r text := ''; n int; ok boolean; j jsonb; lote uuid;
  linhas jsonb := '[{"cpf":"52998224725","nome":"Teste Um","tipo":"LOCAL","aso_data":"2026-11-20","chegada_data":"2026-11-23","chegada_hora":"08:00"},
                    {"cpf":"52998224725","nome":"Teste Um de novo","tipo":"LOCAL"},
                    {"cpf":"11144477735","nome":"Teste Dois","tipo":"MOVEL","nascimento":"1990-05-10"}]';
begin
  insert into auth.users (id, email, aud, role) values (a, 'tst-a@maparh.local', 'authenticated', 'authenticated'), (g, 'tst-g@maparh.local', 'authenticated', 'authenticated'), (h, 'tst-h@maparh.local', 'authenticated', 'authenticated'), (l, 'tst-l@maparh.local', 'authenticated', 'authenticated');
  insert into public.maparh_membros (user_id, login, nome, perfil, projetos, rh) values (a, 'tst-a', 'A', 'admin', null, false), (g, 'tst-g', 'G', 'gestor', '["tst-p1"]', true), (h, 'tst-h', 'H', 'gestor', '["tst-p1"]', false), (l, 'tst-l', 'L', 'leitor', null, false);

  -- GESTOR com acesso à pré-admissão, restrito ao projeto 1
  perform set_config('request.jwt.claims', json_build_object('sub', g, 'role', 'authenticated')::text, true); set local role authenticated;
  j := public.maparh_importar_preadmissoes('tst-p1', 'teste.xlsx', linhas); lote := (j->>'lote')::uuid;
  r := r || 'importadas=' || (j->>'importadas') || ' (2) | ignoradas=' || (j->>'ignoradas') || ' (1) | ';
  select count(*) into n from public.maparh_preadmissoes where projeto_id = 'tst-p1'; r := r || 'liberado le pre=' || n || ' (2) | ';
  select count(*) into n from public.maparh_preadmissoes where projeto_id = 'tst-p1' and aso = 'agendado' and chegada_hora = '08:00'; r := r || 'aso e chegada gravados=' || n || ' (1) | ';
  begin j := public.maparh_importar_preadmissoes('tst-p2', 'x', linhas); ok := true; exception when others then ok := false; end; r := r || 'importa em projeto alheio=' || ok || ' (false) | ';
  begin insert into public.maparh_pessoas (cpf, nome) values ('12345678900', 'CPF errado'); ok := true; exception when others then ok := false; end; r := r || 'aceita cpf invalido=' || ok || ' (false) | ';
  begin insert into public.maparh_pessoas (cpf, nome) values ('52998224725', 'Repetido'); ok := true; exception when others then ok := false; end; r := r || 'aceita cpf repetido=' || ok || ' (false) | ';
  begin insert into public.maparh_preadmissoes (pessoa_id, projeto_id) select id, 'tst-p1' from public.maparh_pessoas where cpf = '52998224725'; ok := true; exception when others then ok := false; end; r := r || 'duas em andamento no mesmo projeto=' || ok || ' (false) | ';
  begin delete from public.maparh_pessoas; ok := true; exception when others then ok := false; end; r := r || 'apaga pessoa direto=' || ok || ' (false) | ';
  begin perform public.maparh_definir_rh(h, true); ok := true; exception when others then ok := false; end; r := r || 'gestor libera outro usuario=' || ok || ' (false) | ';

  -- GESTOR sem acesso à pré-admissão
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', h, 'role', 'authenticated')::text, true); set local role authenticated;
  select count(*) into n from public.maparh_pessoas; r := r || 'nao liberado le pessoas=' || n || ' (0) | ';
  select count(*) into n from public.maparh_preadmissoes; r := r || 'nao liberado le pre=' || n || ' (0) | ';
  begin insert into public.maparh_pessoas (cpf, nome) values ('39053344705', 'Sem acesso'); ok := true; exception when others then ok := false; end; r := r || 'nao liberado grava=' || ok || ' (false) | ';
  begin perform public.maparh_desfazer_importacao(lote); ok := true; exception when others then ok := false; end; r := r || 'nao liberado desfaz=' || ok || ' (false) | ';

  -- VISUALIZADOR
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', l, 'role', 'authenticated')::text, true); set local role authenticated;
  select count(*) into n from public.maparh_pessoas; r := r || 'leitor le pessoas=' || n || ' (0) | ';

  -- ADMIN: vê tudo, libera o gestor H, e a auditoria registrou as pessoas
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true); set local role authenticated;
  select count(*) into n from public.maparh_pessoas where cpf in ('52998224725', '11144477735'); r := r || 'admin le pessoas=' || n || ' (2) | ';
  perform public.maparh_definir_rh(h, true);
  select count(*) into n from public.maparh_auditoria where tabela = 'maparh_pessoas' and login = 'tst-g'; r := r || 'auditoria das pessoas=' || n || ' (2) | ';
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', h, 'role', 'authenticated')::text, true); set local role authenticated;
  select count(*) into n from public.maparh_preadmissoes where projeto_id = 'tst-p1'; r := r || 'depois de liberado le pre=' || n || ' (2) | ';

  -- desfazer a importação (uma das duas já admitida: essa fica)
  update public.maparh_preadmissoes set situacao = 'admitido', registro_id = 'adm-' || id::text where pessoa_id = (select id from public.maparh_pessoas where cpf = '11144477735');
  j := public.maparh_desfazer_importacao(lote);
  r := r || 'desfeitas=' || (j->>'preadmissoes') || ' (1) | pessoas removidas=' || (j->>'pessoas') || ' (1) | admitidos mantidos=' || (j->>'admitidos_mantidos') || ' (1) | ';
  begin j := public.maparh_desfazer_importacao(lote); ok := true; exception when others then ok := false; end; r := r || 'desfaz duas vezes=' || ok || ' (false)';
  reset role;
  raise exception 'RESULTADO (tudo desfeito): %', r;
end $$;
