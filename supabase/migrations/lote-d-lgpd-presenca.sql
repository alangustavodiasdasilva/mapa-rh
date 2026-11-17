-- 17/11/2026 — Lote D: LGPD (anonimizar a pedido e por prazo) e canal de presença privado.

-- Anonimiza uma pessoa: tira nome, CPF, telefone, e-mail, nascimento e CNH (também das cópias na auditoria).
-- Só administrador; não vale para quem está admitido (vínculo de trabalho).
create or replace function public.maparh_anonimizar_pessoa(p_pessoa uuid, p_motivo text default 'pedido do titular')
returns void language plpgsql security definer set search_path to '' as $$
begin
  if maparh_priv.perfil() is distinct from 'admin' then raise exception 'Só um administrador pode apagar dados pessoais.'; end if;
  if exists (select 1 from public.maparh_preadmissoes where pessoa_id = p_pessoa and situacao = 'admitido') then
    raise exception 'Esta pessoa está admitida: desfaça a admissão antes (os dados de quem trabalha na empresa precisam ficar guardados).';
  end if;
  update public.maparh_pessoas set nome = 'Dados apagados (LGPD)', cpf = null, telefone = null, email = null, nascimento = null, cnh = null
    where id = p_pessoa;
  if not found then raise exception 'Pessoa não encontrada.'; end if;
  update public.maparh_preadmissoes set observacao = null, grupo_whatsapp = null, documentos_pendentes = null where pessoa_id = p_pessoa;
  update public.maparh_auditoria set
      antes = case when antes is null then null else antes - 'nome' - 'cpf' - 'telefone' - 'email' - 'nascimento' - 'cnh' end,
      depois = case when depois is null then null else depois - 'nome' - 'cpf' - 'telefone' - 'email' - 'nascimento' - 'cnh' end
    where tabela = 'maparh_pessoas' and item_id = p_pessoa::text;
  insert into public.maparh_auditoria (user_id, login, operacao, tabela, colecao, item_id, antes, depois)
    values (auth.uid(), maparh_priv.meu_login(), 'anonimizou', 'maparh_pessoas', 'pessoas', p_pessoa::text, null, jsonb_build_object('motivo', coalesce(p_motivo, '')));
end $$;
revoke all on function public.maparh_anonimizar_pessoa(uuid, text) from public, anon;
grant execute on function public.maparh_anonimizar_pessoa(uuid, text) to authenticated;

-- Prazo: quem nunca foi admitido e não tem processo em andamento, sem movimento há N meses (mínimo 6).
-- p_so_contar = true só conta (para mostrar antes de confirmar).
create or replace function public.maparh_anonimizar_antigos(p_meses int, p_so_contar boolean default true)
returns int language plpgsql security definer set search_path to '' as $$
declare v_n int := 0; r record;
begin
  if maparh_priv.perfil() is distinct from 'admin' then raise exception 'Só um administrador pode fazer a limpeza de dados.'; end if;
  if coalesce(p_meses, 0) < 6 then raise exception 'O prazo mínimo é de 6 meses.'; end if;
  for r in
    select pe.id from public.maparh_pessoas pe
    where pe.nome <> 'Dados apagados (LGPD)'
      and not exists (select 1 from public.maparh_preadmissoes p where p.pessoa_id = pe.id and p.situacao in ('admitido', 'em_andamento'))
      and coalesce((select max(p.atualizado_em) from public.maparh_preadmissoes p where p.pessoa_id = pe.id), pe.atualizado_em) < now() - make_interval(months => p_meses)
  loop
    v_n := v_n + 1;
    if not p_so_contar then perform public.maparh_anonimizar_pessoa(r.id, 'prazo de ' || p_meses || ' meses sem contratação'); end if;
  end loop;
  return v_n;
end $$;
revoke all on function public.maparh_anonimizar_antigos(int, boolean) from public, anon;
grant execute on function public.maparh_anonimizar_antigos(int, boolean) to authenticated;

-- Presença ("está olhando") em canal privado: só quem é usuário do Mapa RH lê e escreve nele.
drop policy if exists maparh_presenca_ler on realtime.messages;
create policy maparh_presenca_ler on realtime.messages for select to authenticated
  using (realtime.topic() = 'maparh-presenca' and (select maparh_priv.perfil()) is not null);
drop policy if exists maparh_presenca_escrever on realtime.messages;
create policy maparh_presenca_escrever on realtime.messages for insert to authenticated
  with check (realtime.topic() = 'maparh-presenca' and (select maparh_priv.perfil()) is not null);
