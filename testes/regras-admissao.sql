-- Teste das travas de admissão no banco. Cria dados, tenta admitir em cada situação proibida e DESFAZ TUDO no final
-- (termina de propósito com "RESULTADO (tudo desfeito): ..."). O obtido tem que ser igual ao que está entre parênteses.
do $$
declare
  a uuid := gen_random_uuid(); r text := ''; ok boolean; pe uuid; pr uuid;
  -- sem cargo cadastrado a admissão cobra a lista padrão inteira (14 documentos)
  docs jsonb := '{"Carteira de Trabalho digital":"entregue","RG e CPF":"entregue","Comprovante de residência":"entregue","Número do PIS/NIS":"entregue","Título de eleitor":"entregue","Certificado de reservista":"entregue","Certidão de nascimento ou casamento":"entregue","Certidão de nascimento dos filhos":"entregue","Comprovante de escolaridade":"entregue","Exame admissional":"entregue","Foto 3x4":"entregue","Dados bancários":"entregue","CNH":"entregue","Registro no conselho de classe":"entregue"}';
begin
  insert into auth.users (id, email, aud, role) values (a, 'tst-a@maparh.local', 'authenticated', 'authenticated');
  insert into public.maparh_membros (user_id, login, nome, perfil, projetos) values (a, 'tst-a', 'A', 'admin', null);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true); set local role authenticated;

  insert into public.maparh_pessoas (cpf, nome, nascimento) values ('52998224725', 'Tst Adulto', date '1990-05-10') returning id into pe;
  insert into public.maparh_preadmissoes (pessoa_id, projeto_id, etapa, dinamica, aso, aso_data, treinamento, documentos) values (pe, 'tst-p1', 'documentos', 'ok', 'ok', current_date - 1, 'ok', docs) returning id into pr;

  -- cada tentativa muda UMA coisa errada e tenta admitir
  begin update public.maparh_preadmissoes set documentos = docs || '{"Foto 3x4":"falta"}', situacao = 'admitido', registro_id = 'adm-' || id::text where id = pr; ok := true; exception when others then ok := false; end; r := r || 'doc faltando=' || ok || ' (false) | ';
  begin update public.maparh_preadmissoes set documentos = docs || '{"RG e CPF":"recusado"}', situacao = 'admitido', registro_id = 'adm-' || id::text where id = pr; ok := true; exception when others then ok := false; end; r := r || 'doc recusado=' || ok || ' (false) | ';
  begin update public.maparh_preadmissoes set documentos = '{}', situacao = 'admitido', registro_id = 'adm-' || id::text where id = pr; ok := true; exception when others then ok := false; end; r := r || 'sem documentos=' || ok || ' (false) | ';
  begin update public.maparh_preadmissoes set dinamica = 'pendente', situacao = 'admitido', registro_id = 'adm-' || id::text where id = pr; ok := true; exception when others then ok := false; end; r := r || 'dinamica pendente=' || ok || ' (false) | ';
  begin update public.maparh_preadmissoes set documentos_pendentes = 'Foto 3x4', situacao = 'admitido', registro_id = 'adm-' || id::text where id = pr; ok := true; exception when others then ok := false; end; r := r || 'texto de pendencia=' || ok || ' (false) | ';
  begin update public.maparh_preadmissoes set aso = 'agendado', situacao = 'admitido', registro_id = 'adm-' || id::text where id = pr; ok := true; exception when others then ok := false; end; r := r || 'aso agendado=' || ok || ' (false) | ';
  begin update public.maparh_preadmissoes set aso = 'inapto', situacao = 'admitido', registro_id = 'adm-' || id::text where id = pr; ok := true; exception when others then ok := false; end; r := r || 'aso inapto=' || ok || ' (false) | ';
  begin update public.maparh_preadmissoes set treinamento = 'pendente', situacao = 'admitido', registro_id = 'adm-' || id::text where id = pr; ok := true; exception when others then ok := false; end; r := r || 'treino pendente=' || ok || ' (false) | ';
  begin update public.maparh_preadmissoes set etapa = 'entrevista', situacao = 'admitido', registro_id = 'adm-' || id::text where id = pr; ok := true; exception when others then ok := false; end; r := r || 'pulando etapa=' || ok || ' (false) | ';
  update public.maparh_pessoas set nascimento = (current_date - interval '17 years 364 days')::date where id = pe;
  begin update public.maparh_preadmissoes set situacao = 'admitido', registro_id = 'adm-' || id::text where id = pr; ok := true; exception when others then ok := false; end; r := r || 'menor de 18 (falta 1 dia)=' || ok || ' (false) | ';
  update public.maparh_pessoas set nascimento = null where id = pe;
  begin update public.maparh_preadmissoes set situacao = 'admitido', registro_id = 'adm-' || id::text where id = pr; ok := true; exception when others then ok := false; end; r := r || 'sem nascimento=' || ok || ' (false) | ';
  begin update public.maparh_pessoas set nascimento = current_date + 1 where id = pe; ok := true; exception when others then ok := false; end; r := r || 'nascimento no futuro=' || ok || ' (false) | ';
  update public.maparh_pessoas set nascimento = (current_date - interval '18 years')::date where id = pe;
  begin insert into public.maparh_preadmissoes (pessoa_id, projeto_id, etapa, dinamica, aso, treinamento, documentos, situacao) values (pe, 'tst-p2', 'triagem', 'pendente', 'pendente', 'pendente', '{}', 'admitido'); ok := true; exception when others then ok := false; end; r := r || 'inserir ja admitido=' || ok || ' (false) | ';
  -- tudo certo (18 anos completos hoje): admite (desde 17/11/2026 só pelas funções; aqui simula o caminho da função)
  perform set_config('maparh.via_funcao', '1', true);
  begin update public.maparh_preadmissoes set situacao = 'admitido', registro_id = 'adm-' || id::text, admitido_em = current_date where id = pr; ok := true; exception when others then ok := false; end; r := r || 'tudo certo, 18 anos hoje=' || ok || ' (true) | ';
  -- admitido não volta a ter pendência sem desfazer
  begin update public.maparh_preadmissoes set documentos = '{"RG e CPF":"falta"}' where id = pr; ok := true; exception when others then ok := false; end; r := r || 'mexer em doc de admitido=' || ok || ' (false) | ';
  begin update public.maparh_preadmissoes set observacao = 'ok' where id = pr; ok := true; exception when others then ok := false; end; r := r || 'observacao de admitido=' || ok || ' (true) | ';
  begin update public.maparh_preadmissoes set situacao = 'em_andamento', admitido_em = null where id = pr; ok := true; exception when others then ok := false; end; r := r || 'desfazer admissao=' || ok || ' (true) | ';
  perform set_config('maparh.via_funcao', '', true);
  -- sem CPF
  update public.maparh_pessoas set cpf = null where id = pe;
  begin update public.maparh_preadmissoes set situacao = 'admitido', registro_id = 'adm-' || id::text where id = pr; ok := true; exception when others then ok := false; end; r := r || 'sem CPF=' || ok || ' (false)';
  reset role;
  raise exception 'RESULTADO (tudo desfeito): %', r;
end $$;
