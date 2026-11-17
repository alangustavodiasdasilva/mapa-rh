-- Regras do Lote A (17/11/2026): admissão só pelas funções, limite da vaga, histórico protegido,
-- trava de versão dos itens, regras da vaga e LGPD. Rodar no SQL Editor do Supabase: tudo é desfeito no fim
-- (a última linha levanta "RESULTADO (tudo desfeito)" com o resumo). Precisa de um RH (analista) e de um admin ativos.
do $$
declare rh uuid; rh_login text; adm uuid; r text := ''; ok boolean; pe uuid; pr uuid; pe2 uuid; pr2 uuid; a jsonb; doc jsonb;
begin
  select user_id, login into rh, rh_login from public.maparh_membros where perfil = 'analista' and ativo limit 1;
  select user_id into adm from public.maparh_membros where perfil = 'admin' and ativo limit 1;
  select coalesce(jsonb_object_agg(d, 'entregue'), '{}'::jsonb) into doc from unnest(maparh_priv.docs_do_cargo('TST CARGO')) d;
  -- dados de teste (como dono do banco)
  insert into public.maparh_itens (colecao, id, dados) values ('projetos', 'tst-proj', '{"id":"tst-proj","nome":"TST","uf":"RS","ufs":["RS"],"ativo":true}');
  insert into public.maparh_itens (colecao, id, dados) values ('vagas', 'tst-vaga', jsonb_build_object('id','tst-vaga','titulo','TST','projetoId','tst-proj','status','aberta',
    'quantidade',1,'distritos',jsonb_build_array(jsonb_build_object('distritoId','tst-d','locais',1,'moveis',0)),'recrutadorLogin',rh_login,'atualizadoEm','2026-11-17T10:00:00.000Z',
    'aprovacao',jsonb_build_object('situacao','aprovada')));
  insert into public.maparh_pessoas (nome, cpf, nascimento, cidade_origem_id) values ('TST UM', '52998224725', '1990-01-01', 'RS:caicara') returning id into pe;
  insert into public.maparh_pessoas (nome, cpf, nascimento, cidade_origem_id) values ('TST DOIS', '11144477735', '1990-01-01', 'RS:caicara') returning id into pe2;
  insert into public.maparh_preadmissoes (pessoa_id, projeto_id, etapa, tipo, vaga_id, distrito_id, cargo, analista_login, dinamica, aso, aso_data, treinamento, documentos)
    values (pe, 'tst-proj', 'documentos', 'LOCAL', 'tst-vaga', 'tst-d', 'TST CARGO', rh_login, 'ok', 'ok', current_date, 'ok', doc) returning id into pr;
  insert into public.maparh_preadmissoes (pessoa_id, projeto_id, etapa, tipo, vaga_id, distrito_id, cargo, analista_login, dinamica, aso, aso_data, treinamento, documentos)
    values (pe2, 'tst-proj', 'documentos', 'LOCAL', 'tst-vaga', 'tst-d', 'TST CARGO', rh_login, 'ok', 'ok', current_date, 'ok', doc) returning id into pr2;

  perform set_config('request.jwt.claims', json_build_object('sub', rh, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin update public.maparh_preadmissoes set situacao = 'admitido', registro_id = 'adm-' || id::text where id = pr; ok := true; exception when others then ok := false; end;
  r := r || 'admitir direto=' || ok || ' (false) | ';
  begin perform public.maparh_admitir(pr, 'RS:caicara', 'RS:caicara'); ok := true; exception when others then ok := false; r := r || '[' || left(sqlerrm, 60) || ']'; end;
  r := r || 'admitir pela funcao=' || ok || ' (true) | ';
  begin perform public.maparh_admitir(pr2, 'RS:caicara', 'RS:caicara'); ok := true; exception when others then ok := false; end;
  r := r || 'passar do pedido=' || ok || ' (false) | ';
  begin update public.maparh_preadmissoes set situacao = 'em_andamento' where id = pr; ok := true; exception when others then ok := false; end;
  r := r || 'desfazer direto=' || ok || ' (false) | ';
  begin perform public.maparh_desfazer_admissao(pr, 'teste'); ok := true; exception when others then ok := false; end;
  r := r || 'desfazer pela funcao=' || ok || ' (true) | ';
  begin update public.maparh_preadmissoes set anotacoes = '[]' where id = pr; ok := true; exception when others then ok := false; end;
  r := r || 'apagar historico=' || ok || ' (false) | ';
  update public.maparh_preadmissoes set anotacoes = anotacoes || '[{"texto":"x","nome":"Outra Pessoa","por":"outro"}]' where id = pr;
  select anotacoes->-1 into a from public.maparh_preadmissoes where id = pr;
  r := r || 'anotacao leva quem esta logado=' || ((a->>'por') = rh_login) || ' (true) | ';
  begin perform public.maparh_anonimizar_pessoa(pe2); ok := true; exception when others then ok := false; end;
  r := r || 'RH anonimizar=' || ok || ' (false) | ';
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin update public.maparh_itens set removido = true where colecao = 'vagas' and id = 'tst-vaga'; ok := true; exception when others then ok := false; end;
  r := r || 'excluir vaga com candidatos=' || ok || ' (false) | ';
  begin update public.maparh_itens set dados = dados || '{"_base":"2000-01-01T00:00:00.000Z","prioridade":"baixa"}' where colecao = 'vagas' and id = 'tst-vaga'; ok := true; exception when others then ok := false; end;
  r := r || 'gravar sobre versao velha=' || ok || ' (false) | ';
  begin update public.maparh_itens set dados = dados || '{"_base":"2026-11-17T10:00:00.000Z","prioridade":"alta"}' where colecao = 'vagas' and id = 'tst-vaga'; ok := true; exception when others then ok := false; end;
  r := r || 'gravar sobre versao certa=' || ok || ' (true) | ';
  begin perform public.maparh_anonimizar_pessoa(pe2); ok := true; exception when others then ok := false; end;
  r := r || 'admin anonimizar=' || ok || ' (true)';
  reset role;
  raise exception 'RESULTADO (tudo desfeito): %', r;
end $$;
