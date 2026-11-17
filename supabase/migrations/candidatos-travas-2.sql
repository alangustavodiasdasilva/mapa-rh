-- Segunda rodada de travas (auditoria de 17/11/2026). Tudo no banco, valendo para qualquer tela ou chamada direta.

-- 1) Admissão: a data é a do servidor (Brasília); documentos conferidos contra a lista do cargo; vaga cancelada não admite.
create or replace function maparh_priv.docs_do_cargo(p_cargo text) returns text[] language sql stable security definer set search_path to ''
as $$
  select coalesce(
    (select array(select jsonb_array_elements_text(i.dados->'documentos')) from public.maparh_itens i
      where i.colecao = 'cargos' and not i.removido and lower(btrim(i.dados->>'nome')) = lower(btrim(p_cargo))
        and jsonb_array_length(coalesce(i.dados->'documentos', '[]'::jsonb)) > 0 limit 1),
    array['Carteira de Trabalho digital', 'RG e CPF', 'Comprovante de residência', 'Número do PIS/NIS', 'Título de eleitor', 'Certificado de reservista',
      'Certidão de nascimento ou casamento', 'Certidão de nascimento dos filhos', 'Comprovante de escolaridade', 'Exame admissional', 'Foto 3x4',
      'Dados bancários', 'CNH', 'Registro no conselho de classe'])
$$;
revoke all on function maparh_priv.docs_do_cargo(text) from public, anon, authenticated;

create or replace function maparh_priv.checar_admissao() returns trigger language plpgsql security definer set search_path to ''
as $$
declare pe record; v_data date; erros text[] := '{}'; v_falta text[];
begin
  if new.situacao <> 'admitido' or (tg_op = 'UPDATE' and old.situacao = 'admitido') then return new; end if;
  -- a data da admissão é sempre a de hoje em Brasília (não a que a tela mandar)
  new.admitido_em := (now() at time zone 'America/Sao_Paulo')::date;
  v_data := new.admitido_em;
  select cpf, nascimento into pe from public.maparh_pessoas where id = new.pessoa_id;
  if pe.cpf is null then erros := erros || 'sem CPF'; end if;
  if pe.nascimento is null then erros := erros || 'sem data de nascimento';
  elsif pe.nascimento > (v_data - interval '18 years')::date then erros := erros || 'menor de 18 anos'; end if;
  select array_agg(r) into v_falta from unnest(maparh_priv.docs_do_cargo(new.cargo)) r where coalesce(new.documentos->>r, '') <> 'entregue';
  if v_falta is not null then erros := erros || ('documento do cargo pendente: ' || array_to_string(v_falta, ', ')); end if;
  if new.dinamica is distinct from 'ok' or coalesce(new.documentos_pendentes, '') <> ''
     or jsonb_typeof(new.documentos) is distinct from 'object'
     or exists (select 1 from jsonb_each_text(new.documentos) d where d.value <> 'entregue') then erros := erros || 'documento pendente'; end if;
  if new.aso not in ('ok', 'dispensado') then erros := erros || 'ASO não concluído'; end if;
  if new.treinamento not in ('ok', 'dispensado') then erros := erros || 'treinamento não concluído'; end if;
  if new.etapa <> 'documentos' then erros := erros || 'não está na etapa de Documentação'; end if;
  if new.vaga_id is not null and exists (select 1 from public.maparh_itens v where v.colecao = 'vagas' and v.id = new.vaga_id and (v.removido or v.dados->>'status' in ('cancelada', 'recusada'))) then
    erros := erros || 'a vaga foi cancelada ou recusada'; end if;
  if array_length(erros, 1) > 0 then raise exception 'ADMISSAO_BLOQUEADA: %', array_to_string(erros, '; ') using errcode = 'P0001'; end if;
  return new;
end $$;

-- 2) Admitido fica congelado; sair da admissão só voltando para "em andamento" (e aí a data e o registro saem juntos)
create or replace function maparh_priv.travar_admitido() returns trigger language plpgsql security definer set search_path to ''
as $$
begin
  if old.situacao <> 'admitido' then return new; end if;
  if new.situacao = 'admitido' then
    if (new.pessoa_id, new.projeto_id, new.etapa, new.documentos, new.aso, new.treinamento, new.admitido_em, new.registro_id, new.tipo,
        new.cidade_atuacao_id, new.base_id, new.distrito_id, new.vaga_id, new.cargo, new.dinamica)
       is distinct from
       (old.pessoa_id, old.projeto_id, old.etapa, old.documentos, old.aso, old.treinamento, old.admitido_em, old.registro_id, old.tipo,
        old.cidade_atuacao_id, old.base_id, old.distrito_id, old.vaga_id, old.cargo, old.dinamica) then
      raise exception 'ADMITIDO_TRAVADO: para mudar os dados da admissão, desfaça a admissão primeiro.' using errcode = 'P0001';
    end if;
  elsif new.situacao = 'em_andamento' then
    new.admitido_em := null; new.registro_id := null;   -- desfazer admissão
  else
    raise exception 'ADMITIDO_TRAVADO: quem foi admitido só pode voltar para "em andamento" (desfazer admissão).' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- 3) Pessoa admitida: CPF e nascimento não mudam mais
create or replace function maparh_priv.travar_pessoa_admitida() returns trigger language plpgsql security definer set search_path to ''
as $$
begin
  if (new.cpf is distinct from old.cpf or new.nascimento is distinct from old.nascimento)
     and exists (select 1 from public.maparh_preadmissoes p where p.pessoa_id = old.id and p.situacao = 'admitido') then
    raise exception 'PESSOA_ADMITIDA_TRAVADA: esta pessoa já foi admitida; CPF e data de nascimento não podem mais mudar.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function maparh_priv.travar_pessoa_admitida() from public, anon, authenticated;
drop trigger if exists maparh_pessoas_travar_admitida on public.maparh_pessoas;
create trigger maparh_pessoas_travar_admitida before update on public.maparh_pessoas for each row execute function maparh_priv.travar_pessoa_admitida();

-- 4) A mesma pessoa não é admitida duas vezes no mesmo projeto
create unique index if not exists maparh_pre_unica_admitida on public.maparh_preadmissoes (pessoa_id, projeto_id) where situacao = 'admitido';

-- 5) O RH (analista) só cadastra processo para pessoa que é dele (cadastrou ou já está no nome dele);
--    pessoa de outro RH passa pelo administrador
create or replace function maparh_priv.pessoa_minha(p_pessoa uuid) returns boolean language sql stable security definer set search_path to ''
as $$
  select exists (select 1 from public.maparh_pessoas x where x.id = p_pessoa and x.criado_por = (select auth.uid())
                   and not exists (select 1 from public.maparh_preadmissoes y where y.pessoa_id = x.id and y.analista_login is distinct from maparh_priv.meu_login()))
      or exists (select 1 from public.maparh_preadmissoes y where y.pessoa_id = p_pessoa and y.analista_login = maparh_priv.meu_login())
$$;
revoke all on function maparh_priv.pessoa_minha(uuid) from public, anon;
grant execute on function maparh_priv.pessoa_minha(uuid) to authenticated;
drop policy if exists maparh_pre_inserir on public.maparh_preadmissoes;
create policy maparh_pre_inserir on public.maparh_preadmissoes for insert to authenticated
  with check ((select maparh_priv.pode_rh()) and maparh_priv.pode_projeto(projeto_id)
    and ((select maparh_priv.rh_ve_tudo()) or (analista_login = (select maparh_priv.meu_login()) and maparh_priv.pessoa_minha(pessoa_id))));

-- consulta pelo CPF: ficha completa só para quem pode ver a pessoa; para o resto, só "já existe"
create or replace function public.maparh_pessoa_do_cpf(p_cpf text) returns jsonb language plpgsql stable security definer set search_path to ''
as $$
declare v jsonb; v_id uuid;
begin
  if not (select maparh_priv.pode_rh()) then raise exception 'Sem permissão.'; end if;
  select id into v_id from public.maparh_pessoas where cpf = p_cpf;
  if v_id is null then return null; end if;
  if not (select maparh_priv.rh_ve_tudo()) and not maparh_priv.pessoa_minha(v_id) then
    return jsonb_build_object('id', v_id, 'restrito', true);
  end if;
  select to_jsonb(p) || jsonb_build_object('historico', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'projeto_id', x.projeto_id, 'situacao', x.situacao, 'admitido_em', x.admitido_em, 'criado_em', x.criado_em))
    from public.maparh_preadmissoes x where x.pessoa_id = p.id), '[]'::jsonb))
  into v from public.maparh_pessoas p where p.id = v_id;
  return v;
end $$;

-- 6) Contagem das vagas para qualquer membro do projeto (sem dado pessoal): admitidos e em processo por vaga, distrito, tipo e etapa
create or replace function public.maparh_contagem_vagas(p_projeto text default null)
returns table (vaga_id text, distrito_id text, tipo text, situacao text, etapa text, n bigint) language sql stable security definer set search_path to ''
as $$
  select p.vaga_id, p.distrito_id, p.tipo, p.situacao, p.etapa, count(*)
  from public.maparh_preadmissoes p
  where (select maparh_priv.perfil()) is not null and maparh_priv.pode_projeto(p.projeto_id)
    and p.vaga_id is not null and p.situacao in ('admitido', 'em_andamento') and (p_projeto is null or p.projeto_id = p_projeto)
  group by 1, 2, 3, 4, 5
$$;
revoke all on function public.maparh_contagem_vagas(text) from public, anon;
grant execute on function public.maparh_contagem_vagas(text) to authenticated;

-- 7) Salvar candidato (pessoa + processo) de uma vez só: ou grava tudo, ou nada. Roda com as permissões de quem chama.
create or replace function public.maparh_salvar_candidato(p_pessoa jsonb, p_pre jsonb) returns uuid language plpgsql set search_path to ''
as $$
declare v_pes uuid := nullif(p_pessoa->>'id', '')::uuid; v_pre uuid := nullif(p_pre->>'id', '')::uuid; v_n int;
  tem constant jsonb := p_pre;
begin
  if v_pes is not null then
    update public.maparh_pessoas set nome = p_pessoa->>'nome', nascimento = nullif(p_pessoa->>'nascimento', '')::date, telefone = nullif(p_pessoa->>'telefone', ''),
      email = nullif(p_pessoa->>'email', ''), cnh = nullif(p_pessoa->>'cnh', ''), cidade_origem_id = nullif(p_pessoa->>'cidade_origem_id', ''),
      ex_colaborador = coalesce((p_pessoa->>'ex_colaborador')::boolean, false), cpf = coalesce(nullif(p_pessoa->>'cpf', ''), cpf)
    where id = v_pes;
    get diagnostics v_n = row_count;
    if v_n = 0 then raise exception 'Sem permissão para alterar os dados desta pessoa.'; end if;
  else
    insert into public.maparh_pessoas (cpf, nome, nascimento, telefone, email, cnh, cidade_origem_id, ex_colaborador)
    values (nullif(p_pessoa->>'cpf', ''), p_pessoa->>'nome', nullif(p_pessoa->>'nascimento', '')::date, nullif(p_pessoa->>'telefone', ''), nullif(p_pessoa->>'email', ''),
      nullif(p_pessoa->>'cnh', ''), nullif(p_pessoa->>'cidade_origem_id', ''), coalesce((p_pessoa->>'ex_colaborador')::boolean, false))
    returning id into v_pes;
  end if;
  if v_pre is not null then
    update public.maparh_preadmissoes set
      etapa = coalesce(nullif(tem->>'etapa', ''), etapa), tipo = coalesce(nullif(tem->>'tipo', ''), tipo),
      vaga_id = nullif(tem->>'vaga_id', ''), distrito_id = nullif(tem->>'distrito_id', ''), distancia_km = nullif(tem->>'distancia_km', '')::numeric,
      cidade_atuacao_id = nullif(tem->>'cidade_atuacao_id', ''), base_id = nullif(tem->>'base_id', ''), cargo = nullif(tem->>'cargo', ''), unidade = nullif(tem->>'unidade', ''),
      analista = nullif(tem->>'analista', ''), analista_login = nullif(tem->>'analista_login', ''),
      aso = coalesce(nullif(tem->>'aso', ''), aso), aso_data = nullif(tem->>'aso_data', '')::date, treinamento = coalesce(nullif(tem->>'treinamento', ''), treinamento),
      chegada_data = nullif(tem->>'chegada_data', '')::date, chegada_hora = nullif(tem->>'chegada_hora', '')::time,
      grupo_whatsapp = nullif(tem->>'grupo_whatsapp', ''), observacao = nullif(tem->>'observacao', ''),
      documentos = case when tem ? 'documentos' then coalesce(tem->'documentos', '{}'::jsonb) else documentos end,
      dinamica = case when tem ? 'dinamica' then tem->>'dinamica' else dinamica end,
      documentos_pendentes = case when tem ? 'documentos_pendentes' then nullif(tem->>'documentos_pendentes', '') else documentos_pendentes end,
      situacao = case when tem ? 'situacao' then tem->>'situacao' else situacao end
    where id = v_pre;
    get diagnostics v_n = row_count;
    if v_n = 0 then raise exception 'Sem permissão para alterar este candidato (ele pode ter sido direcionado para outro RH).'; end if;
  else
    insert into public.maparh_preadmissoes (pessoa_id, projeto_id, etapa, tipo, vaga_id, distrito_id, distancia_km, cidade_atuacao_id, base_id, cargo, unidade,
      analista, analista_login, aso, aso_data, treinamento, chegada_data, chegada_hora, grupo_whatsapp, observacao)
    values (v_pes, tem->>'projeto_id', coalesce(nullif(tem->>'etapa', ''), 'triagem'), coalesce(nullif(tem->>'tipo', ''), 'LOCAL'), nullif(tem->>'vaga_id', ''), nullif(tem->>'distrito_id', ''),
      nullif(tem->>'distancia_km', '')::numeric, nullif(tem->>'cidade_atuacao_id', ''), nullif(tem->>'base_id', ''), nullif(tem->>'cargo', ''), nullif(tem->>'unidade', ''),
      nullif(tem->>'analista', ''), nullif(tem->>'analista_login', ''), coalesce(nullif(tem->>'aso', ''), 'pendente'), nullif(tem->>'aso_data', '')::date,
      coalesce(nullif(tem->>'treinamento', ''), 'pendente'), nullif(tem->>'chegada_data', '')::date, nullif(tem->>'chegada_hora', '')::time,
      nullif(tem->>'grupo_whatsapp', ''), nullif(tem->>'observacao', ''))
    returning id into v_pre;
  end if;
  return v_pre;
end $$;
revoke all on function public.maparh_salvar_candidato(jsonb, jsonb) from public, anon;
grant execute on function public.maparh_salvar_candidato(jsonb, jsonb) to authenticated;

-- 8) Importação: quem a planilha já traz como admitido/não seguiu não entra de novo; ASO e treinamento vêm da planilha
create or replace function public.maparh_importar_preadmissoes(p_projeto text, p_arquivo text, p_linhas jsonb)
 returns jsonb language plpgsql set search_path to ''
as $function$
declare
  v_lote uuid; l jsonb; v_pessoa uuid; v_ok int := 0; v_ign int := 0; v_det jsonb := '[]'::jsonb; v_login text; i int := 0; v_cpf text; v_tel text;
begin
  if not (select maparh_priv.rh_ve_tudo()) or not maparh_priv.pode_projeto(p_projeto) then raise exception 'Sem permissão para importar neste projeto.'; end if;
  select m.login into v_login from public.maparh_membros m where m.user_id = auth.uid();
  v_lote := gen_random_uuid();
  perform maparh_priv.registrar_importacao(v_lote, p_projeto, p_arquivo, v_login, jsonb_array_length(p_linhas));
  for l in select * from jsonb_array_elements(p_linhas) loop
    i := i + 1;
    if coalesce(l->>'situacao_planilha', '') in ('admitido', 'fora') then
      v_ign := v_ign + 1; v_det := v_det || jsonb_build_object('linha', i, 'nome', l->>'nome', 'motivo', case when l->>'situacao_planilha' = 'admitido' then 'já consta como admitido na planilha' else 'consta como fora do processo na planilha' end);
      continue;
    end if;
    v_cpf := nullif(l->>'cpf', ''); v_pessoa := null;
    v_tel := nullif(regexp_replace(coalesce(l->>'telefone', ''), '\D', '', 'g'), '');
    if v_cpf is not null then
      select id into v_pessoa from public.maparh_pessoas where cpf = v_cpf;
    elsif v_tel is not null then
      select id into v_pessoa from public.maparh_pessoas
        where lower(btrim(nome)) = lower(btrim(l->>'nome')) and regexp_replace(coalesce(telefone, ''), '\D', '', 'g') = v_tel
        order by criado_em limit 1;
    end if;
    if v_pessoa is null then
      insert into public.maparh_pessoas (cpf, nome, nascimento, telefone, email, cnh, cidade_origem_id, ex_colaborador, lote_importacao)
      values (v_cpf, l->>'nome', nullif(l->>'nascimento', '')::date, nullif(l->>'telefone', ''), nullif(l->>'email', ''), nullif(l->>'cnh', ''),
        nullif(l->>'cidade_origem_id', ''), coalesce((l->>'ex_colaborador')::boolean, false), v_lote)
      returning id into v_pessoa;
    else
      if exists (select 1 from public.maparh_preadmissoes where pessoa_id = v_pessoa and projeto_id = p_projeto and situacao = 'admitido') then
        v_ign := v_ign + 1; v_det := v_det || jsonb_build_object('linha', i, 'cpf', v_cpf, 'nome', l->>'nome', 'motivo', 'já foi admitida neste projeto');
        continue;
      end if;
      update public.maparh_pessoas set
        nascimento = coalesce(nascimento, nullif(l->>'nascimento', '')::date), telefone = coalesce(telefone, nullif(l->>'telefone', '')),
        email = coalesce(email, nullif(l->>'email', '')), cnh = coalesce(cnh, nullif(l->>'cnh', '')),
        cidade_origem_id = coalesce(cidade_origem_id, nullif(l->>'cidade_origem_id', ''))
      where id = v_pessoa;
    end if;
    if exists (select 1 from public.maparh_preadmissoes where pessoa_id = v_pessoa and projeto_id = p_projeto and situacao = 'em_andamento') then
      v_ign := v_ign + 1; v_det := v_det || jsonb_build_object('linha', i, 'cpf', v_cpf, 'nome', l->>'nome', 'motivo', 'já está em andamento neste projeto');
      continue;
    end if;
    insert into public.maparh_preadmissoes (pessoa_id, projeto_id, tipo, cidade_atuacao_id, base_id, analista, analista_login, status_texto, aso_data, aso, treinamento,
      chegada_data, chegada_hora, grupo_whatsapp, observacao, lote_importacao, etapa, vaga_id, distrito_id, distancia_km, cargo, unidade)
    values (v_pessoa, p_projeto, coalesce(nullif(l->>'tipo', ''), 'LOCAL'), nullif(l->>'cidade_atuacao_id', ''), nullif(l->>'base_id', ''),
      nullif(l->>'analista', ''), nullif(l->>'analista_login', ''), nullif(l->>'status_texto', ''), nullif(l->>'aso_data', '')::date,
      coalesce(nullif(l->>'aso', ''), case when nullif(l->>'aso_data', '') is null then 'pendente' else 'agendado' end), coalesce(nullif(l->>'treinamento', ''), 'pendente'),
      nullif(l->>'chegada_data', '')::date, nullif(l->>'chegada_hora', '')::time, nullif(l->>'grupo_whatsapp', ''), nullif(l->>'observacao', ''), v_lote,
      coalesce(nullif(l->>'etapa', ''), 'documentos'), nullif(l->>'vaga_id', ''), nullif(l->>'distrito_id', ''), nullif(l->>'distancia_km', '')::numeric,
      nullif(l->>'cargo', ''), nullif(l->>'unidade', ''));
    v_ok := v_ok + 1;
  end loop;
  perform maparh_priv.fechar_importacao(v_lote, v_ok, v_ign, v_det);
  return jsonb_build_object('lote', v_lote, 'importadas', v_ok, 'ignoradas', v_ign, 'detalhes', v_det);
end $function$;

-- 9) Desfazer importação: só tira quem ninguém mexeu ainda; quem já teve trabalho fica (e é contado)
create or replace function public.maparh_desfazer_importacao(p_lote uuid)
 returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_proj text; v_pre int; v_pes int; v_ficam int; v_mexidos int;
begin
  select projeto_id into v_proj from public.maparh_importacoes where id = p_lote and desfeita_em is null;
  if v_proj is null then raise exception 'Importação não encontrada ou já desfeita.'; end if;
  if not (select maparh_priv.rh_ve_tudo()) or not maparh_priv.pode_projeto(v_proj) then raise exception 'Sem permissão para desfazer esta importação.'; end if;
  select count(*) into v_ficam from public.maparh_preadmissoes where lote_importacao = p_lote and situacao = 'admitido';
  select count(*) into v_mexidos from public.maparh_preadmissoes where lote_importacao = p_lote and situacao <> 'admitido' and atualizado_em > criado_em + interval '5 seconds';
  delete from public.maparh_preadmissoes where lote_importacao = p_lote and situacao <> 'admitido' and atualizado_em <= criado_em + interval '5 seconds';
  get diagnostics v_pre = row_count;
  delete from public.maparh_pessoas p where p.lote_importacao = p_lote and not exists (select 1 from public.maparh_preadmissoes x where x.pessoa_id = p.id);
  get diagnostics v_pes = row_count;
  update public.maparh_importacoes set desfeita_em = now() where id = p_lote;
  return jsonb_build_object('preadmissoes', v_pre, 'pessoas', v_pes, 'admitidos_mantidos', v_ficam, 'mexidos_mantidos', v_mexidos);
end $function$;

-- 10) Foto dos usuários (avatar): imagem pequena guardada no próprio membro; cada um muda a sua, o administrador muda a de todos
alter table public.maparh_membros add column if not exists foto text;
alter table public.maparh_membros drop constraint if exists maparh_membros_foto_check;
alter table public.maparh_membros add constraint maparh_membros_foto_check check (foto is null or (foto ~ '^data:image/(jpeg|png|webp);base64,' and length(foto) <= 120000));
create or replace function public.maparh_definir_foto(p_usuario uuid, p_foto text) returns void language plpgsql security definer set search_path to ''
as $$
begin
  if (select maparh_priv.perfil()) is null then raise exception 'Sem permissão.'; end if;
  if p_usuario <> (select auth.uid()) and (select maparh_priv.perfil()) is distinct from 'admin' then
    raise exception 'Só o administrador muda a foto de outra pessoa.';
  end if;
  update public.maparh_membros set foto = nullif(p_foto, '') where user_id = p_usuario;
end $$;
revoke all on function public.maparh_definir_foto(uuid, text) from public, anon;
grant execute on function public.maparh_definir_foto(uuid, text) to authenticated;
