-- Teste das regras de Colaboradores e desligamentos (vínculos, eventos, desligamentos, admitir/movimentar/desligar, indicadores).
-- Mesmo esquema do regras-preadmissao.sql: cria dados de teste, simula cada login e DESFAZ TUDO no final
-- (termina de propósito com o erro "RESULTADO (tudo desfeito): ..."). O obtido tem que ser igual ao que está entre parênteses.
-- Precisa da migração supabase/migrations/colaboradores.sql já aplicada.
--
-- Caso feito à mão para o turnover (projeto tst-p1, março de 2026):
--   A entra 10/01 e sai 20/03 · B entra 02/02 · C entra 05/03 · E entra 10/03   (D entra 01/02 no projeto tst-p2 e não conta)
--   01/03: A e B = 2 · 31/03: B, C e E = 3 · admissões 2 · desligamentos 1 · médio (2+3)/2 = 2,5 · turnover 1 ÷ 2,5 × 100 = 40,00
do $$
declare
  a uuid := gen_random_uuid(); g uuid := gen_random_uuid(); h uuid := gen_random_uuid(); o uuid := gen_random_uuid(); l uuid := gen_random_uuid();
  pa uuid; pb uuid; pc uuid; pe uuid; pd uuid;            -- pessoas
  qa uuid; qa2 uuid; qb uuid; qc uuid; qe uuid; qd uuid;  -- pré-admissões
  va uuid; vb uuid; vd uuid;                              -- vínculos
  r text := ''; n int; ok boolean; j jsonb; t text;
begin
  insert into auth.users (id, email, aud, role) values (a, 'tst-a@maparh.local', 'authenticated', 'authenticated'), (g, 'tst-g@maparh.local', 'authenticated', 'authenticated'),
    (h, 'tst-h@maparh.local', 'authenticated', 'authenticated'), (o, 'tst-o@maparh.local', 'authenticated', 'authenticated'), (l, 'tst-l@maparh.local', 'authenticated', 'authenticated');
  insert into public.maparh_membros (user_id, login, nome, perfil, projetos, rh) values (a, 'tst-a', 'A', 'admin', null, false), (g, 'tst-g', 'G', 'gestor', '["tst-p1"]', true),
    (h, 'tst-h', 'H', 'gestor', '["tst-p1"]', false), (o, 'tst-o', 'O', 'gestor', '["tst-p2"]', true), (l, 'tst-l', 'L', 'leitor', '["tst-p1"]', true);

  -- ADMIN prepara as pessoas e as pré-admissões (E fica em andamento de propósito) e admite D no projeto 2
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true); set local role authenticated;
  insert into public.maparh_pessoas (cpf, nome) values ('52998224725', 'Teste A') returning id into pa;
  insert into public.maparh_pessoas (cpf, nome) values ('11144477735', 'Teste B') returning id into pb;
  insert into public.maparh_pessoas (cpf, nome) values ('39053344705', 'Teste C') returning id into pc;
  insert into public.maparh_pessoas (cpf, nome) values ('12345678909', 'Teste E') returning id into pe;
  insert into public.maparh_pessoas (cpf, nome) values ('98765432100', 'Teste D') returning id into pd;
  insert into public.maparh_preadmissoes (pessoa_id, projeto_id, tipo, cargo) values (pa, 'tst-p1', 'LOCAL', 'Auxiliar') returning id into qa;
  insert into public.maparh_preadmissoes (pessoa_id, projeto_id, tipo, cargo) values (pb, 'tst-p1', 'LOCAL', 'Auxiliar') returning id into qb;
  insert into public.maparh_preadmissoes (pessoa_id, projeto_id, tipo, cargo) values (pc, 'tst-p1', 'MOVEL', 'Operador') returning id into qc;
  insert into public.maparh_preadmissoes (pessoa_id, projeto_id, tipo, cargo) values (pe, 'tst-p1', 'LOCAL', 'Auxiliar') returning id into qe;
  insert into public.maparh_preadmissoes (pessoa_id, projeto_id, tipo, cargo) values (pd, 'tst-p2', 'LOCAL', 'Auxiliar') returning id into qd;
  update public.maparh_preadmissoes set situacao = 'admitido', registro_id = 'adm-' || id::text where id in (qa, qb, qc, qd);
  -- segunda pré-admissão de A (a primeira já saiu de "em andamento"), também admitida: serve para tentar o segundo vínculo ativo e, depois, a readmissão
  insert into public.maparh_preadmissoes (pessoa_id, projeto_id, tipo, cargo) values (pa, 'tst-p1', 'LOCAL', 'Auxiliar') returning id into qa2;
  update public.maparh_preadmissoes set situacao = 'admitido', registro_id = 'adm-' || id::text where id = qa2;
  j := public.maparh_admitir_colaborador(qd, '2026-02-01'); vd := (j->>'id')::uuid;
  r := r || 'admin admite no p2=' || (j->>'projeto_id') || ' (tst-p2) | ';

  -- GESTOR liberado, restrito ao projeto 1
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', g, 'role', 'authenticated')::text, true); set local role authenticated;
  begin perform public.maparh_admitir_colaborador(qe, '2026-03-10'); ok := true; exception when others then ok := false; end; r := r || 'admite quem ainda esta em andamento=' || ok || ' (false) | ';
  j := public.maparh_admitir_colaborador(qa, '2026-01-10'); va := (j->>'id')::uuid;
  r := r || 'admitir cria=' || ((j->>'ja_existia')::boolean = false and j->>'admissao' = '2026-01-10' and j->>'cargo' = 'Auxiliar') || ' (true) | ';
  j := public.maparh_admitir_colaborador(qa, '2026-05-05');
  r := r || 'admitir de novo devolve o mesmo=' || ((j->>'id')::uuid = va and (j->>'ja_existia')::boolean and j->>'admissao' = '2026-01-10') || ' (true) | ';
  select count(*) into n from public.maparh_vinculos where preadmissao_id = qa; r := r || 'vinculos da pre-admissao=' || n || ' (1) | ';
  select count(*) into n from public.maparh_vinculo_eventos where vinculo_id = va and tipo = 'admissao' and vigencia = '2026-01-10'; r := r || 'evento de admissao=' || n || ' (1) | ';
  j := public.maparh_admitir_colaborador(qb, '2026-02-02'); vb := (j->>'id')::uuid;
  perform public.maparh_admitir_colaborador(qc, '2026-03-05');
  update public.maparh_preadmissoes set situacao = 'admitido', registro_id = 'adm-' || id::text where id = qe;
  perform public.maparh_admitir_colaborador(qe, '2026-03-10');
  begin perform public.maparh_admitir_colaborador(qa2, '2026-03-12'); ok := true; exception when others then ok := false; end; r := r || 'admite quem ja tem vinculo ativo=' || ok || ' (false) | ';
  begin perform public.maparh_admitir_colaborador(qd, '2026-02-01'); ok := true; exception when others then ok := false; end; r := r || 'admite em projeto alheio=' || ok || ' (false) | ';
  select count(*) into n from public.maparh_vinculos where projeto_id = 'tst-p1'; r := r || 'liberado le vinculos do p1=' || n || ' (4) | ';
  select count(*) into n from public.maparh_vinculos where projeto_id = 'tst-p2'; r := r || 'le vinculos de projeto alheio=' || n || ' (0) | ';
  select count(*) into n from public.maparh_vinculo_eventos where vinculo_id = vd; r := r || 'le eventos de projeto alheio=' || n || ' (0) | ';

  -- movimentar: grava de/para e atualiza o valor atual
  perform public.maparh_movimentar_colaborador(va, 'cargo', '2026-02-15', '{"cargo":"Operador"}', 'promovido');
  select count(*) into n from public.maparh_vinculos where id = va and cargo = 'Operador'; r := r || 'cargo atual mudou=' || n || ' (1) | ';
  select count(*) into n from public.maparh_vinculo_eventos where vinculo_id = va and tipo = 'cargo' and vigencia = '2026-02-15' and de->>'cargo' = 'Auxiliar' and para->>'cargo' = 'Operador';
  r := r || 'evento com de/para=' || n || ' (1) | ';
  begin perform public.maparh_movimentar_colaborador(va, 'gestor', '2026-02-20', '{"cargo":"Chefe"}', null); ok := true; exception when others then ok := false; end; r := r || 'muda cargo dizendo que e gestor=' || ok || ' (false) | ';
  begin perform public.maparh_movimentar_colaborador(va, 'cargo', '2026-02-20', '{"cargo":"Operador"}', null); ok := true; exception when others then ok := false; end; r := r || 'movimenta sem mudar nada=' || ok || ' (false) | ';
  begin perform public.maparh_movimentar_colaborador(va, 'gestor', '2026-02-01', '{"gestor":"Fulano"}', null); ok := true; exception when others then ok := false; end; r := r || 'movimenta com data anterior a ultima=' || ok || ' (false) | ';

  -- nada de gravar direto nas tabelas; evento não se altera nem se apaga
  begin insert into public.maparh_vinculos (pessoa_id, projeto_id, admissao) values (pb, 'tst-p1', '2026-06-01'); ok := true; exception when others then ok := false; end; r := r || 'insere vinculo direto=' || ok || ' (false) | ';
  begin update public.maparh_vinculos set cargo = 'Direto' where id = va; ok := true; exception when others then ok := false; end; r := r || 'altera vinculo direto=' || ok || ' (false) | ';
  begin insert into public.maparh_vinculo_eventos (vinculo_id, tipo, vigencia) values (va, 'retorno', '2026-02-16'); ok := true; exception when others then ok := false; end; r := r || 'insere evento direto=' || ok || ' (false) | ';
  begin update public.maparh_vinculo_eventos set observacao = 'mexi' where vinculo_id = va; ok := true; exception when others then ok := false; end; r := r || 'altera evento=' || ok || ' (false) | ';
  begin delete from public.maparh_vinculo_eventos where vinculo_id = va; ok := true; exception when others then ok := false; end; r := r || 'apaga evento=' || ok || ' (false) | ';

  -- desligar: fecha o vínculo, grava o desligamento e o evento, marca ex-colaborador
  begin perform public.maparh_desligar_colaborador(va, '2026-01-05', 'pedido', null, null, false); ok := true; exception when others then ok := false; end; r := r || 'desliga antes da admissao=' || ok || ' (false) | ';
  begin perform public.maparh_desligar_colaborador(va, '2026-03-20', 'inventado', null, null, false); ok := true; exception when others then ok := false; end; r := r || 'desliga com tipo invalido=' || ok || ' (false) | ';
  perform public.maparh_desligar_colaborador(va, '2026-03-20', 'pedido', 'Melhor proposta', 'texto restrito', true);
  select count(*) into n from public.maparh_vinculos where id = va and desligamento = '2026-03-20'; r := r || 'vinculo fechado=' || n || ' (1) | ';
  select count(*) into n from public.maparh_pessoas where id = pa and ex_colaborador; r := r || 'marcou ex-colaborador=' || n || ' (1) | ';
  select count(*) into n from public.maparh_pessoas where id = pb and ex_colaborador; r := r || 'nao marcou quem continua=' || n || ' (0) | ';
  select count(*) into n from public.maparh_desligamentos where vinculo_id = va and tipo = 'pedido' and motivo_categoria = 'Melhor proposta' and precisa_repor and reposicao_situacao = 'nao_iniciada'; r := r || 'desligamento gravado=' || n || ' (1) | ';
  select count(*) into n from public.maparh_vinculo_eventos where vinculo_id = va and tipo = 'desligamento' and vigencia = '2026-03-20' and observacao is null; r := r || 'evento de desligamento sem o texto restrito=' || n || ' (1) | ';
  begin perform public.maparh_desligar_colaborador(va, '2026-03-21', 'pedido', null, null, false); ok := true; exception when others then ok := false; end; r := r || 'desliga duas vezes=' || ok || ' (false) | ';
  begin perform public.maparh_movimentar_colaborador(va, 'gestor', '2026-03-20', '{"gestor":"Fulano"}', null); ok := true; exception when others then ok := false; end; r := r || 'movimenta desligado=' || ok || ' (false) | ';
  update public.maparh_desligamentos set reposicao_situacao = 'em_andamento' where vinculo_id = va; get diagnostics n = row_count; r := r || 'acompanha a reposicao=' || n || ' (1) | ';
  begin update public.maparh_desligamentos set data = '2026-03-01' where vinculo_id = va; ok := true; exception when others then ok := false; end; r := r || 'altera a data do desligamento direto=' || ok || ' (false) | ';
  begin perform public.maparh_desfazer_admissao_colaborador(qa); ok := true; exception when others then ok := false; end; r := r || 'desfaz admissao de quem ja foi desligado=' || ok || ' (false) | ';

  -- depois de desligado, a mesma pessoa pode ser admitida de novo (não entra na conta de março)
  begin perform public.maparh_admitir_colaborador(qa2, '2026-04-01'); ok := true; exception when others then ok := false; end; r := r || 'readmite depois de desligado=' || ok || ' (true) | ';
  select count(*) into n from public.maparh_vinculos where pessoa_id = pa; r := r || 'passagens de A=' || n || ' (2) | ';

  -- turnover de março de 2026 no projeto 1 (caso feito à mão no topo)
  select headcount_inicio || '/' || headcount_fim || '/' || admissoes || '/' || desligamentos || '/' || headcount_medio || '/' || turnover into t
    from public.maparh_indicadores_colaboradores('tst-p1', '2026-03-01', '2026-03-31');
  r := r || 'indicadores de marco=' || coalesce(t, 'nada') || ' (2/3/2/1/2.5/40.00) | ';
  select count(*) into n from public.maparh_indicadores_colaboradores('tst-p2', '2026-03-01', '2026-03-31'); r := r || 'indicadores de projeto alheio=' || n || ' (0) | ';

  -- GESTOR do mesmo projeto, mas NÃO liberado para dados pessoais
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', h, 'role', 'authenticated')::text, true); set local role authenticated;
  select count(*) into n from public.maparh_vinculos; r := r || 'nao liberado le vinculos=' || n || ' (0) | ';
  select count(*) into n from public.maparh_vinculo_eventos; r := r || 'nao liberado le eventos=' || n || ' (0) | ';
  select count(*) into n from public.maparh_desligamentos; r := r || 'nao liberado le desligamentos=' || n || ' (0) | ';
  select count(*) into n from public.maparh_indicadores_colaboradores('tst-p1', '2026-03-01', '2026-03-31'); r := r || 'nao liberado ve indicadores=' || n || ' (0) | ';
  begin perform public.maparh_desligar_colaborador(vb, '2026-03-25', 'pedido', null, null, false); ok := true; exception when others then ok := false; end; r := r || 'nao liberado desliga=' || ok || ' (false) | ';
  begin perform public.maparh_admitir_colaborador(qb, '2026-02-02'); ok := true; exception when others then ok := false; end; r := r || 'nao liberado chama admitir=' || ok || ' (false) | ';

  -- GESTOR liberado, mas de OUTRO projeto
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true); set local role authenticated;
  select count(*) into n from public.maparh_vinculos where projeto_id in ('tst-p1', 'tst-p2'); r := r || 'gestor do p2 le vinculos=' || n || ' (1) | ';
  select count(*) into n from public.maparh_vinculo_eventos where vinculo_id = va; r := r || 'gestor do p2 le eventos do p1=' || n || ' (0) | ';
  select count(*) into n from public.maparh_desligamentos where vinculo_id = va; r := r || 'gestor do p2 le desligamento do p1=' || n || ' (0) | ';
  begin perform public.maparh_desligar_colaborador(vb, '2026-03-25', 'pedido', null, null, false); ok := true; exception when others then ok := false; end; r := r || 'gestor do p2 desliga no p1=' || ok || ' (false) | ';
  update public.maparh_desligamentos set reposicao_situacao = 'reposta' where vinculo_id = va; get diagnostics n = row_count; r := r || 'gestor do p2 mexe na reposicao do p1=' || n || ' (0) | ';

  -- VISUALIZADOR liberado: não grava
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', l, 'role', 'authenticated')::text, true); set local role authenticated;
  begin perform public.maparh_desligar_colaborador(vb, '2026-03-25', 'pedido', null, null, false); ok := true; exception when others then ok := false; end; r := r || 'leitor desliga=' || ok || ' (false) | ';
  update public.maparh_desligamentos set reposicao_situacao = 'reposta' where vinculo_id = va; get diagnostics n = row_count; r := r || 'leitor mexe na reposicao=' || n || ' (0) | ';

  -- ADMIN: vê tudo, a auditoria registrou, e nem ele altera evento
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true); set local role authenticated;
  select count(*) into n from public.maparh_vinculos where projeto_id in ('tst-p1', 'tst-p2'); r := r || 'admin le vinculos=' || n || ' (6) | ';
  select (count(*) > 0) into ok from public.maparh_auditoria where tabela = 'maparh_vinculos' and login = 'tst-g'; r := r || 'auditoria dos vinculos=' || ok || ' (true) | ';
  begin update public.maparh_vinculo_eventos set observacao = 'mexi' where vinculo_id = va; ok := true; exception when others then ok := false; end; r := r || 'admin altera evento=' || ok || ' (false) | ';
  begin delete from public.maparh_vinculo_eventos where vinculo_id = va; ok := true; exception when others then ok := false; end; r := r || 'admin apaga evento=' || ok || ' (false) | ';

  -- o índice do banco recusa o segundo vínculo ativo mesmo para o dono do banco (B continua ativo)
  reset role;
  begin insert into public.maparh_vinculos (pessoa_id, projeto_id, admissao) values (pb, 'tst-p2', '2026-06-01'); ok := true; exception when unique_violation then ok := false; end; r := r || 'indice aceita dois vinculos ativos=' || ok || ' (false)';
  raise exception 'RESULTADO (tudo desfeito): %', r;
end $$;
