// Candidatos: um fluxo só, da candidatura à admissão (antes eram duas telas: Candidatos e Pré-admissão).
//   Triagem → Entrevista → Documentação (documentos do cargo, ASO, treinamento, chegada) → Admitido.
// As candidaturas chegam pela planilha do formulário; o sistema sugere o distrito mais próximo de onde a pessoa mora
// e se ela entra como LOCAL ou MÓVEL; o administrador direciona cada pessoa para um RH, que só enxerga as dele.
// Três jeitos de olhar: Quadro (cartões por etapa), Lista (conferência de documentos/ASO/treinamento) e Por RH (o que cada um tem).
// A exportação sai no modelo da planilha "SEMANA". Os dados ficam em tabelas próprias do banco (têm CPF), fora da cópia local.

// ---------- compartilhado com Contratações (cadastro.js): avaliação de fim de safra e planilha para o DP (eSocial) ----------
window.RhSafra = (() => {
  const ROT = { sim: 'Recontrataria', talvez: 'Talvez', nao: 'Não recontrataria' };
  const CURTO = { sim: 'Sim', talvez: 'Talvez', nao: 'Não' };
  const ICONE = { sim: '✓', talvez: '?', nao: '✗' };
  const limpar = m => String(m || '').replace(/^[A-Z_]+:\s*/, '');
  const dia = d => d ? RH.fmtDataBR(String(d).slice(0, 10)) : '';
  const nomeDe = login => { const u = login && Store.usuarioPorLogin(login); return u ? u.nome : (login || ''); };
  // quem avalia: admin, gestor, RH liberado, o RH responsável ou o RH da vaga (o banco confere de novo)
  function podeAvaliar(p, eu) {
    if (!p || p.situacao !== 'admitido' || !eu) return false;
    if (['admin', 'gestor'].includes(eu.perfil) || Store.rhVeTudo(eu)) return true;
    if (eu.perfil !== 'analista') return false;
    if (p.analista_login === eu.login) return true;
    const v = p.vaga_id && Store.vaga(p.vaga_id);
    return !!(v && (v.recrutadorLogin === eu.login || (v.recrutadores || []).includes(eu.login)));
  }
  const dica = p => [ROT[p.avaliacao_recontrataria], p.avaliacao_nota ? `nota ${p.avaliacao_nota}/5` : '', p.avaliacao_obs || '',
    p.avaliado_em ? `avaliado em ${dia(p.avaliado_em)}${p.avaliado_por ? ' por ' + nomeDe(p.avaliado_por) : ''}` : ''].filter(Boolean).join(' · ');
  // selo da avaliação (Contratações, Lista de admitidos, cartão)
  function selo(p, curto) {
    const r = p.avaliacao_recontrataria; if (!ROT[r]) return '';
    return `<span class="rhs-selo rhs-${r}" title="${UI.esc(dica(p))}">${ICONE[r]} ${curto ? CURTO[r] : ROT[r]}${p.avaliacao_nota ? ` <i aria-label="nota ${p.avaliacao_nota} de 5">${'★'.repeat(p.avaliacao_nota)}</i>` : ''}</span>`;
  }
  // selo "Já trabalhou" (avaliação de outra safra), para quem entrou na safra atual
  function seloJa(x) {
    if (!x || !ROT[x.recontrataria]) return '';
    const t = [`Trabalhou em ${x.projeto_nome || 'outra safra'}${x.cargo ? ' como ' + x.cargo : ''}`, ROT[x.recontrataria], x.nota ? `nota ${x.nota}/5` : '', x.observacao || '', x.avaliado_em ? 'avaliado em ' + dia(x.avaliado_em) : ''].filter(Boolean).join(' · ');
    return `<span class="rhs-ja rhs-ja-${x.recontrataria}" title="${UI.esc(t)}">Já trabalhou: ${x.recontrataria === 'nao' ? 'não recontrataria ✗' : x.recontrataria === 'talvez' ? 'talvez ?' : 'recontrataria ✓'}</span>`;
  }
  // bloco com os 3 botões grandes + estrelas + observação
  function bloco(p, editavel) {
    const dis = editavel ? '' : 'disabled';
    return `<div class="rhs-aval" data-rhs>
      <div class="rhs-pergunta">Recontrataria esta pessoa na próxima safra?</div>
      <div class="rhs-botoes" role="group" aria-label="Recontrataria?">${['sim', 'talvez', 'nao'].map(k => `<button type="button" class="rhs-b rhs-b-${k} ${p.avaliacao_recontrataria === k ? 'on' : ''}" data-rhs-r="${k}" aria-pressed="${p.avaliacao_recontrataria === k}" ${dis}><b>${ICONE[k]}</b>${CURTO[k]}</button>`).join('')}</div>
      <div class="rhs-linha"><span class="rhs-rot">Nota <span class="muted">(opcional)</span></span><span class="fi-estrelas rhs-estrelas">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-rhs-n="${n}" class="${+p.avaliacao_nota >= n ? 'on' : ''}" aria-label="${n} de 5" ${dis}>★</button>`).join('')}</span></div>
      <input class="rhs-obs" data-rhs-obs maxlength="300" aria-label="Observação da avaliação" placeholder="Observação curta (opcional). Ex.: pontual, cuida bem do equipamento" value="${UI.esc(p.avaliacao_obs || '')}" ${dis}>
      <div class="muted small rhs-quando" data-rhs-quando>${p.avaliado_em ? `Avaliado em ${dia(p.avaliado_em)}${p.avaliado_por ? ' por ' + UI.esc(nomeDe(p.avaliado_por)) : ''}.` : editavel ? 'Ainda sem avaliação.' : 'Ainda sem avaliação (só o RH responsável, o gestor ou o administrador avaliam).'}</div>
    </div>`;
  }
  // liga os cliques do bloco; devolve uma função que lê o que está marcado
  function ligar(raiz, p) {
    const st = { r: p.avaliacao_recontrataria || '', n: p.avaliacao_nota || null };
    raiz.addEventListener('click', e => {
      const b = e.target.closest('[data-rhs-r]');
      if (b) { st.r = b.dataset.rhsR; raiz.querySelectorAll('[data-rhs-r]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); }); return; }
      const s = e.target.closest('[data-rhs-n]');
      if (s) { const n = +s.dataset.rhsN; st.n = st.n === n ? null : n; raiz.querySelectorAll('[data-rhs-n]').forEach(x => x.classList.toggle('on', +x.dataset.rhsN <= (st.n || 0))); }
    });
    return () => ({ r: st.r, n: st.n, obs: String(raiz.querySelector('[data-rhs-obs]').value || '').trim().slice(0, 300) });
  }
  // grava pelo salvar_candidato (o banco confere quem pode, carimba autor/hora e anota no histórico); false = nada mudou
  async function salvar(p, v) {
    if (!v.r) throw new Error('Escolha Sim, Talvez ou Não.');
    if (v.r === (p.avaliacao_recontrataria || '') && (v.n || null) === (p.avaliacao_nota || null) && (v.obs || '') === (p.avaliacao_obs || '')) return false;
    try { await Nuvem.rh.salvar({ id: p.pessoa.id }, { id: p.id, avaliacao_recontrataria: v.r, avaliacao_nota: v.n || null, avaliacao_obs: v.obs || null }); }
    catch (e) { throw new Error(limpar(e.message)); }
    Object.assign(p, { avaliacao_recontrataria: v.r, avaliacao_nota: v.n || null, avaliacao_obs: v.obs || null, avaliado_em: new Date().toISOString(), avaliado_por: (App.usuario || {}).login || null });
    return true;
  }
  // janela para avaliar uma pessoa
  function janela(p, aoSalvar) {
    let ler = null;
    const m = UI.modal({ titulo: `Avaliação de fim de safra: ${p.pessoa.nome}`, largura: '520px',
      corpo: `<p class="muted" style="margin-top:0">${UI.esc([p.cargo, p.admitido_em ? 'admitido em ' + dia(p.admitido_em) : ''].filter(Boolean).join(' · '))}. Quem for "Sim" ou "Talvez" entra no banco de talentos da próxima safra.</p>${bloco(p, true)}`,
      botoes: [{ texto: 'Cancelar' }, { texto: 'Salvar avaliação', classe: 'btn-primario', acao: async () => {
        const mudou = await salvar(p, ler());
        if (mudou) UI.toast(`Avaliação de ${p.pessoa.nome} salva.`, 'sucesso');
        if (aoSalvar) aoSalvar(p);
      } }] });
    ler = ligar(m.corpo.querySelector('[data-rhs]'), p);
  }
  // avaliar várias pessoas, uma por vez: clicar em Sim/Talvez/Não grava e já passa para a próxima
  function emLote(lista, aoFim) {
    if (!lista.length) { UI.toast('Ninguém para avaliar neste filtro.', 'aviso'); return; }
    let i = 0, feitos = 0, ocupado = false;
    const m = UI.modal({ titulo: 'Avaliar em lote (fim de safra)', largura: '560px', fecharAoClicarFora: false,
      corpo: `<div class="cd-pap-topo"><b id="rhs-nome"></b><span class="cd-pap-cont" id="rhs-cont"></span></div><div class="muted small" id="rhs-sub" style="margin-bottom:10px"></div>
        <div id="rhs-caixa"></div>
        <p class="muted small" style="margin-bottom:0">Nota e observação são opcionais: preencha antes. Clicar em <b>Sim</b>, <b>Talvez</b> ou <b>Não</b> grava e já mostra a próxima pessoa.</p>`,
      botoes: [{ texto: 'Fechar', acao: () => { fim(); } }, { texto: 'Pular', classe: 'btn-secundario', acao: () => proximo() }] });
    const g = s => m.corpo.querySelector(s);
    let ler = null;
    function pintar() {
      const p = lista[i];
      g('#rhs-nome').textContent = p.pessoa.nome; g('#rhs-cont').textContent = `${i + 1} de ${lista.length}`;
      g('#rhs-sub').textContent = [p.cargo, p.tipo === 'MOVEL' ? 'móvel' : 'local', p.admitido_em ? 'admitido em ' + dia(p.admitido_em) : ''].filter(Boolean).join(' · ');
      g('#rhs-caixa').innerHTML = bloco(p, true);
      ler = ligar(g('[data-rhs]'), p);
    }
    function fim() { if (feitos) UI.toast(`${feitos === 1 ? '1 avaliação salva' : feitos + ' avaliações salvas'}.`, 'sucesso'); if (aoFim) aoFim(feitos); }
    function proximo() { i++; if (i >= lista.length) { fim(); return true; } pintar(); return false; }
    g('#rhs-caixa').addEventListener('click', async e => {
      if (!e.target.closest('[data-rhs-r]') || ocupado) return;
      ocupado = true;
      try { if (await salvar(lista[i], ler())) feitos++; if (proximo()) m.fechar(); }
      catch (err) { UI.toast(err.message, 'erro', 6000); }
      finally { ocupado = false; }
    });
    pintar();
  }

  // ---------- planilha para o DP: pré-cadastro de admissão (eSocial S-2200) ----------
  // Sai o que o sistema tem; o resto vai em branco para o DP completar. Sem dados bancários.
  const COLS_DP = [
    ['NOME COMPLETO', 's'], ['CPF', 's'], ['DATA DE NASCIMENTO', 's'], ['TELEFONE', 's'], ['E-MAIL', 's'], ['MUNICÍPIO DE RESIDÊNCIA', 's'], ['UF DE RESIDÊNCIA', 's'],
    ['CNH (INFORMADA)', 's'], ['CARGO', 's'], ['DATA DE ADMISSÃO', 's'], ['TIPO (LOCAL/MÓVEL)', 's'], ['MUNICÍPIO DE TRABALHO', 's'], ['UF DE TRABALHO', 's'],
    ['DISTRITO', 's'], ['BASE DE CONTRATAÇÃO (MÓVEL)', 's'], ['PROJETO / SAFRA', 's'], ['RH RESPONSÁVEL', 's'],
    ['PIS/NIS', 'dp'], ['RG (NÚMERO)', 'dp'], ['RG - ÓRGÃO EMISSOR/UF', 'dp'], ['RG - DATA DE EMISSÃO', 'dp'], ['NOME DA MÃE', 'dp'], ['NOME DO PAI', 'dp'], ['SEXO', 'dp'],
    ['RAÇA/COR', 'dp'], ['ESTADO CIVIL', 'dp'], ['GRAU DE INSTRUÇÃO', 'dp'], ['NACIONALIDADE', 'dp'], ['MUNICÍPIO DE NASCIMENTO', 'dp'], ['UF DE NASCIMENTO', 'dp'],
    ['ENDEREÇO (LOGRADOURO)', 'dp'], ['NÚMERO', 'dp'], ['COMPLEMENTO', 'dp'], ['BAIRRO', 'dp'], ['CEP', 'dp'], ['CTPS (NÚMERO)', 'dp'], ['CTPS (SÉRIE/UF)', 'dp'],
    ['MATRÍCULA', 'dp'], ['CBO', 'dp'], ['CATEGORIA eSocial', 'dp'], ['TIPO DE CONTRATO (PRAZO)', 'dp'], ['DATA FIM DO CONTRATO', 'dp'], ['SALÁRIO BASE', 'dp'],
    ['UNIDADE DO SALÁRIO', 'dp'], ['JORNADA SEMANAL (HORAS)', 'dp'], ['HORÁRIO DE TRABALHO', 'dp']];
  // mesma pergunta da exportação de Contratações: cancelar não baixa nem registra
  function perguntarCpf(titulo, n, extra) {
    return new Promise(resolve => {
      let r = null;
      UI.modal({ titulo, largura: '480px', fecharAoClicarFora: true, aoFechar: () => resolve(r),
        corpo: `<p style="margin-top:0">A planilha leva dados pessoais de <b>${n === 1 ? '1 pessoa' : n + ' pessoas'}</b>${extra ? ` (${UI.esc(extra)})` : ''}. Como sai o CPF?</p>
          <p class="muted small" style="margin-bottom:0">Para o DP cadastrar no eSocial, o CPF precisa ir completo. Mascarado mostra só parte do número (ex.: ***.982.247-**). A exportação fica registrada na auditoria. Não vão dados bancários.</p>`,
        botoes: [{ texto: 'Cancelar' }, { texto: 'CPF mascarado', classe: 'btn-secundario', acao: () => { r = 'mascarado'; } }, { texto: 'CPF completo', classe: 'btn-primario', acao: () => { r = 'completo'; } }] });
    });
  }
  async function planilhaDP(lista, projetoId, extra) {
    if (!lista.length) { UI.toast('Ninguém admitido para exportar neste filtro.', 'aviso'); return; }
    const escolha = await perguntarCpf('Planilha para o DP (eSocial)', lista.length, extra);
    if (!escolha) return;
    const completo = escolha === 'completo', proj = Store.projeto(projetoId) || {};
    const cpfDe = c => !c ? '' : completo ? RH.fmtCPF(c) : '***.' + RH.fmtCPF(c).slice(4, 11) + '-**';
    const cid = id => (id && Store.cidade(id)) || null;
    const linhas = lista.map(p => {
      const pe = p.pessoa || {}, ori = cid(pe.cidade_origem_id), d = p.distrito_id && Store.distrito(p.distrito_id);
      const trab = cid(p.cidade_atuacao_id) || (p.tipo === 'MOVEL' ? cid(p.base_id) : null) || (d ? Store.poloDoDistrito(d) : null);
      const base = p.tipo === 'MOVEL' ? cid(p.base_id) : null;
      const u = p.analista_login && Store.usuarioPorLogin(p.analista_login);
      const val = [pe.nome || '', cpfDe(pe.cpf), dia(pe.nascimento), pe.telefone || '', pe.email || '', ori ? ori.nome : '', ori ? ori.uf : '',
        pe.cnh || '', p.cargo || '', dia(p.admitido_em), p.tipo === 'MOVEL' ? 'MÓVEL' : 'LOCAL', trab ? trab.nome : '', trab ? trab.uf : '',
        d ? d.nome : '', base ? `${base.nome}/${base.uf}` : '', Store.rotuloProjeto ? Store.rotuloProjeto(proj) : (proj.nome || ''), u ? u.nome : (p.analista || '')];
      return COLS_DP.map((c, j) => j < val.length ? val[j] : '');
    });
    const cab = COLS_DP.map(c => c[0]);
    const nome = `DP eSocial - ${proj.nome || 'projeto'} - ${RH.hoje()}`.replace(/[\\/:*?"<>|]/g, '-');
    if (typeof XLSX !== 'undefined') {
      const wb = XLSX.utils.book_new(), ws = XLSX.utils.aoa_to_sheet([cab].concat(linhas));
      ws['!cols'] = cab.map((c, j) => ({ wch: Math.max(12, Math.min(38, Math.max(c.length, ...linhas.map(l => String(l[j] || '').length)) + 2)) }));
      ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: linhas.length, c: cab.length - 1 } }) };
      XLSX.utils.book_append_sheet(wb, ws, 'Admissões');
      const ajuda = [['COLUNA', 'QUEM PREENCHE', 'OBSERVAÇÃO']].concat(COLS_DP.map(([c, q]) => [c, q === 's' ? 'Já vem do Safra RH' : 'DP completa',
        c === 'CPF' && !completo ? 'Saiu mascarado: exporte de novo com CPF completo para cadastrar' : c === 'DATA DE ADMISSÃO' ? 'Dia em que o RH admitiu no sistema' : '']))
        .concat([[], ['Pré-cadastro de admissão (eSocial S-2200). Dados bancários não saem do sistema.'], [`Gerado em ${RH.fmtDataBR(RH.hoje())} · ${lista.length} pessoa(s)`]]);
      const wa = XLSX.utils.aoa_to_sheet(ajuda); wa['!cols'] = [{ wch: 32 }, { wch: 20 }, { wch: 60 }];
      XLSX.utils.book_append_sheet(wb, wa, 'Como preencher');
      XLSX.writeFile(wb, nome + '.xlsx');
    } else UI.baixarCSV(nome + '.csv', [cab].concat(linhas));
    try { Store.auditar('relatorio.exportar', `Planilha para o DP (eSocial): ${lista.length} admitido(s) de ${proj.nome || projetoId}${completo ? ' (CPF completo)' : ' (CPF mascarado)'}${extra ? ' · ' + extra : ''}`, App.usuario); } catch (e) { /* auditoria não impede a planilha */ }
    UI.toast(`Planilha para o DP gerada (${lista.length === 1 ? '1 pessoa' : lista.length + ' pessoas'}).`, 'sucesso');
  }
  return { ROT, podeAvaliar, selo, seloJa, bloco, ligar, salvar, janela, emLote, planilhaDP, limpar };
})();

Paginas.candidatos = {
  titulo: 'Candidatos',
  semFiltros: true,
  render(el) {
    const projetos = App.projetosVisiveis().filter(p => p.ativo !== false);
    if (!projetos.length) {
      el.innerHTML = '<div class="card"><h2>Nenhum projeto disponível</h2><p>Crie um projeto em Cadastros → Projetos antes de lançar candidatos.</p></div>';
      return;
    }
    const EST = { falta: 'Falta', entregue: 'Entregue', recusado: 'Recusado', dispensado: 'Não se aplica' };
    const ETAPAS = { triagem: 'Triagem', entrevista: 'Entrevista', documentos: 'Documentação' };
    const ORDEM = ['triagem', 'entrevista', 'documentos'];
    const ASO = { pendente: 'Pendente', agendado: 'Agendado', ok: 'Apto', inapto: 'Inapto', dispensado: 'Dispensado' };
    const TRE = { pendente: 'Pendente', agendado: 'Agendado', ok: 'Feito', reprovado: 'Reprovado', dispensado: 'Dispensado' };
    const FORMATOS = { presencial: 'Presencial', video: 'Vídeo', telefone: 'Telefone', whatsapp: 'WhatsApp' };
    const RESULTADOS = { aguardando: 'Aguardando', aprovado: 'Aprovado', reprovado: 'Reprovado', faltou: 'Não compareceu' };
    const SIT = { em_andamento: 'Em andamento', admitido: 'Admitido', reprovado: 'Reprovado', desistiu: 'Desistiu' };
    const OPCOES = { aso: ASO, treinamento: TRE };
    const eu = App.usuario;
    const veTudo = Store.rhVeTudo(eu);                       // administrador e gestor liberado enxergam todos os RHs
    const podeEditar = ['admin', 'gestor', 'analista'].includes(eu.perfil);
    const guardado = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
    const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sem armazenamento: vale só nesta visita */ } };
    // o projeto do filtro geral (topo) vale primeiro; trocar aqui grava de volta nele (igual a Contratações)
    let projetoId = [App.filtros.projetoId, guardado('maparh:cand-projeto')].find(id => projetos.some(p => p.id === id)) || projetos[0].id;
    let vista = ['quadro', 'lista', 'rh', 'agenda'].includes(guardado('maparh:cand-vista')) ? guardado('maparh:cand-vista') : 'quadro';
    let semanaAg = null, colMob = '';   // colMob: etapa mostrada no Quadro do celular                // segunda-feira da semana mostrada na Agenda
    if (vista === 'rh' && !veTudo) vista = 'quadro';
    let vagaId = guardado('maparh:cand-vaga'), distritoId = '', analista = '', semana = 'todas', seg = '', pend = '', busca = '';
    // vindo da tela de Vagas pela contagem de uma etapa: abre a Lista já nessa etapa
    // vindo do Início (pendências, resumo do dia): etapa e filtro de pendência ('agenda' abre a Agenda; pend 'semrh' mostra quem está sem RH)
    try {
      const s = sessionStorage.getItem('maparh:cand-seg') || '', pd = sessionStorage.getItem('maparh:cand-pend') || '';
      sessionStorage.removeItem('maparh:cand-seg'); sessionStorage.removeItem('maparh:cand-pend');
      if (s === 'agenda') vista = 'agenda';
      else if (pd === 'semrh') { analista = '(sem)'; vista = 'quadro'; }
      else if (s) { seg = s; pend = pd; vista = 'lista'; }
    } catch (e) { /* ok */ }
    let buscaIni = ''; try { buscaIni = sessionStorage.getItem('maparh:cand-busca') || ''; sessionStorage.removeItem('maparh:cand-busca'); } catch (e) { /* ok */ }
    let linhas = [], ativo = true;
    const verMais = {};                 // quantos cartões cada coluna do quadro mostra (50 por vez)
    const POR_COLUNA = 50;
    const marcados = new Set();         // seleção da Lista para ações em lote
    let limiteKm = Math.max(0, parseInt(guardado('maparh:cand-km'), 10) || 50);   // até quantos km do distrito ainda conta como LOCAL

    // ---------- quem é o RH de cada pessoa ----------
    // login de usuário que não existe mais (excluído) conta como "sem RH"
    const chaveAnalista = p => p.analista_login && Store.usuarioPorLogin(p.analista_login) ? p.analista_login : '';
    // foto (ou iniciais) do RH de uma pessoa / de um login
    const fotoRh = (login, tam = 24) => { const u = Store.usuarioPorLogin(login); return UI.avatar(u || { nome: login || '?' }, tam); };
    // foto de quem fez a última atualização (o banco grava), com nome e quando; sem registro, o RH responsável
    function ultimoAMexer(p, tam = 26) {
      const login = p.atualizado_por || p.analista_login; if (!login) return '';
      const u = Store.usuarioPorLogin(login), nome = u ? u.nome : login;
      const quando = p.atualizado_por && p.atualizado_em ? ` · ${UI.fmtDataHora(p.atualizado_em)}` : '';
      return `<span class="cd-quem" title="${UI.esc((p.atualizado_por ? 'Última atualização: ' : 'RH: ') + nome + quando)}">${fotoRh(login, tam)}</span>`;
    }
    const nomeAnalista = p => { const u = Store.usuarioPorLogin(p.analista_login); return u ? u.nome : (p.analista_login ? (p.analista || p.analista_login) : ''); };
    const equipe = () => Store.equipeRh().slice().sort((a, b) => (a.perfil !== 'analista') - (b.perfil !== 'analista') || a.nome.localeCompare(b.nome, 'pt-BR'));
    const loginPeloNome = nome => { const n = Store.normalizar(nome); const u = n && equipe().find(x => Store.normalizar(x.nome) === n); return u ? u.login : null; };

    // ---------- documentos (a dinâmica) ----------
    const docsCobrados = cargo => Store.documentosDoCargo(cargo);
    function docsDe(p) {
      const mapa = p.documentos && typeof p.documentos === 'object' ? p.documentos : {};
      const cobrados = docsCobrados(p.cargo);
      const extras = Object.keys(mapa).filter(n => !cobrados.includes(n) && !/^\s*recusado:/i.test(n));
      const antigos = Object.keys(mapa).length ? [] : String(p.documentos_pendentes || '').split(';').map(s => s.replace(/^\s*recusado:\s*/i, '').trim()).filter(n => n && !cobrados.includes(n));
      return [...cobrados, ...extras, ...antigos].map(nome => ({ nome, estado: EST[mapa[nome]] ? mapa[nome] : 'falta' }));
    }
    function dinamicaDe(p) {
      const d = docsDe(p), faltam = d.filter(x => x.estado === 'falta'), recusados = d.filter(x => x.estado === 'recusado');
      return { docs: d, total: d.length, faltam, recusados, pendentes: recusados.concat(faltam), completa: !faltam.length && !recusados.length };
    }
    const textoDinamica = p => { const s = dinamicaDe(p); return s.completa ? 'Completa' : [s.recusados.length ? `${s.recusados.length} recusado${s.recusados.length > 1 ? 's' : ''}` : '', s.faltam.length ? `${s.faltam.length === 1 ? 'falta' : 'faltam'} ${s.faltam.length}` : ''].filter(Boolean).join(', '); };
    const mapaDe = p => Object.fromEntries(docsDe(p).map(d => [d.nome, d.estado]));

    // ---------- onde a pessoa mora, para onde vai ----------
    const projeto = () => Store.projeto(projetoId);
    const cidade = id => id ? Store.cidade(id) : null;
    const nomeCidade = id => { const c = cidade(id); return c ? `${c.nome}/${c.uf}` : ''; };
    const distritosProjeto = () => { const ufs = Store.ufsProjeto(projeto()); return Store.distritos().filter(d => !d.uf || ufs.includes(d.uf)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true })); };
    const vagasProjeto = () => Store.vagasVisiveis(eu, { projetoId }).filter(v => v.aprovada);
    const rotuloVaga = v => v ? `${v.titulo}${v.porDistrito && v.porDistrito.length ? ' · ' + v.porDistrito.map(x => x.distrito.nome).join(', ') : v.cidade ? ' · ' + v.cidade.nome : ''}` : '';
    const distritoUnico = v => v && v.porDistrito && v.porDistrito.length === 1 ? v.porDistrito[0].distrito : null;
    const vagaDe = id => vagaRapida(id);   // pelo cache do desenho (não recalcula as vagas a cada cartão)
    // cidade onde a pessoa vai trabalhar: a informada; no MÓVEL sem cidade, a base; sem nenhuma, a cidade polo do distrito
    const trabalhoId = p => p.cidade_atuacao_id || (p.tipo === 'MOVEL' ? p.base_id : null) || (p.distrito_id && Store.distrito(p.distrito_id) ? (Store.poloDoDistrito(Store.distrito(p.distrito_id)) || {}).id : null) || null;
    const destinoTexto = p => nomeCidade(p.cidade_atuacao_id) || (p.distrito_id && Store.distrito(p.distrito_id) ? Store.distrito(p.distrito_id).nome : '') || nomeCidade(p.tipo === 'MOVEL' ? p.base_id : null);
    // Sugestão para quem mora em `cidadeId`: o distrito mais perto (entre os da vaga, se houver vaga) e LOCAL/MÓVEL pela distância
    function sugerirDestino(cidadeId, vaga) {
      const ids = vaga && vaga.porDistrito.length ? vaga.porDistrito.map(x => x.distrito.id) : distritosProjeto().map(d => d.id);
      const r = cidadeId && ids.length ? Store.distritoMaisProximo(cidadeId, ids) : null;
      if (!r) return null;
      return { distrito: r.distrito, km: Math.round(r.km * 10) / 10, dentro: r.dentro, perto: r.perto, tipo: r.dentro || r.km <= limiteKm ? 'LOCAL' : 'MOVEL' };
    }
    const textoSugestao = s => !s ? '' : s.dentro ? `Mora no distrito ${s.distrito.nome}: entra como LOCAL.` : `Distrito mais perto: ${s.distrito.nome}, a ${UI.fmtKm(s.km)} (de ${s.perto.nome}). ${s.tipo === 'LOCAL' ? `Até ${limiteKm} km conta como LOCAL.` : `Mais de ${limiteKm} km: entra como MÓVEL.`}`;

    // ---------- mensagens do WhatsApp: modelos de cada RH, com marcadores ----------
    const MODELOS = [
      ['triagem', 'Primeiro contato (triagem)', 'Olá, {nome}! Aqui é {rh}, do RH. Recebemos sua candidatura para {cargo}.\nPodemos conversar rapidinho sobre a vaga? Qual o melhor horário para eu te ligar?'],
      ['cobrar', 'Cobrar resposta', 'Oi, {nome}! Conseguiu ver minha mensagem sobre a vaga? Se ainda tiver interesse, me responda por aqui. {rh}'],
      ['entrevista', 'Entrevista marcada', 'Olá, {nome}! Aqui é {rh}, do RH. Sua entrevista para {cargo} ficou para {data} às {hora}.\nLocal: {local}\nPode confirmar?'],
      ['lembrete', 'Lembrete da entrevista', 'Oi, {nome}! Passando para lembrar da sua entrevista: {data} às {hora}.\nLocal: {local}\nQualquer imprevisto, me avise por aqui. {rh}'],
      ['documentos', 'Aprovado: documentos', 'Parabéns, {nome}! Você foi aprovado(a) para {cargo}. Agora vamos para a documentação.\nMe envie por aqui (foto legível): {documentos}'],
      ['cobrardocs', 'Cobrar documentos', 'Oi, {nome}! Para seguir com a sua admissão ainda falta: {documentos}.\nPode me enviar por aqui (foto legível)? {rh}'],
      ['chegada', 'Chegada no campo', 'Olá, {nome}! Sua chegada está marcada para {chegada}.\nDistrito: {distrito}\nQualquer dúvida, fale comigo. {rh}'],
      ['naoseguiu', 'Não seguiu no processo', 'Olá, {nome}. Agradecemos seu interesse na vaga de {cargo}. Neste momento seguimos com outros candidatos, mas seu cadastro fica guardado para as próximas oportunidades. {rh}']];
    const MARCADORES = [['{nome}', 'primeiro nome'], ['{nome_completo}', 'nome completo'], ['{cargo}', 'cargo'], ['{data}', 'data da entrevista'], ['{hora}', 'horário'], ['{local}', 'local ou link'],
      ['{distrito}', 'distrito'], ['{documentos}', 'documentos que faltam'], ['{chegada}', 'data e hora da chegada'], ['{rh}', 'seu nome']];
    const meusModelos = () => { const u = Store.usuarioPorLogin(eu.login) || eu; return Object.assign(Object.fromEntries(MODELOS.map(([k, , txt]) => [k, txt])), (u && u.mensagens) || {}); };
    const primeiroNome = n => { const x = String(n || '').trim().split(/\s+/)[0] || ''; return x.charAt(0).toUpperCase() + x.slice(1).toLowerCase(); };
    const diaExtenso = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }) : '';
    // troca os marcadores; linha com marcador sem valor (ex.: Local vazio) some
    function montarMensagem(txt, p, extra = {}) {
      const e = { ...(p.entrevista || {}), ...extra }, d = p.distrito_id && Store.distrito(p.distrito_id);
      const val = { nome: primeiroNome(p.pessoa.nome), nome_completo: p.pessoa.nome, cargo: String(p.cargo || 'a vaga').toLowerCase(), data: diaExtenso(e.data), hora: e.hora || '',
        local: e.local || (e.formato === 'telefone' ? 'por telefone (vamos te ligar)' : e.formato === 'whatsapp' ? 'por aqui no WhatsApp' : ''), distrito: d ? d.nome : '',
        documentos: (dinamicaDe(p).pendentes || []).map(x => x.nome).join(', '), chegada: p.chegada_data ? diaExtenso(p.chegada_data) + (p.chegada_hora ? ' às ' + String(p.chegada_hora).slice(0, 5) : '') : '',
        rh: primeiroNome(eu.nome) };
      return String(txt).split('\n').filter(l => !(l.match(/\{(\w+)\}/g) || []).some(m => val[m.slice(1, -1)] === '')).map(l => l.replace(/\{(\w+)\}/g, (m, k) => k in val ? val[k] : m)).join('\n').trim();
    }
    const modeloDaEtapa = p => !emAndamento(p) ? (p.situacao === 'admitido' ? 'chegada' : 'naoseguiu') : p.etapa === 'triagem' ? 'triagem'
      : p.etapa === 'entrevista' ? (p.entrevista && p.entrevista.data ? (p.entrevista.data > RH.hoje() ? 'lembrete' : 'entrevista') : 'triagem') : p.chegada_data ? 'chegada' : 'documentos';
    // escolher o modelo, conferir o texto e abrir o WhatsApp do RH; o envio fica no histórico
    function mandarMensagem(p, chave) {
      const tel = RH.soDigitos(p.pessoa.telefone);
      if (tel.length < 10) { UI.toast(`${p.pessoa.nome} está sem telefone válido. Preencha na ficha.`, 'aviso', 5000); return; }
      const mods = meusModelos(); let atual = chave || modeloDaEtapa(p);
      const m = UI.modal({ titulo: `Mensagem para ${p.pessoa.nome}`, largura: '540px',
        corpo: `<div class="msg-tipos" id="ms-tipos">${MODELOS.map(([k, rot]) => `<button type="button" data-mod="${k}" class="${k === atual ? 'ativa' : ''}">${rot}</button>`).join('')}</div>
          <label>Texto (dá para mexer antes de enviar)<textarea id="ms-txt" rows="7"></textarea></label>
          <p class="muted small" style="margin-bottom:0">Abre o WhatsApp no seu celular ou no WhatsApp Web com o texto pronto: é só conferir e enviar. Para mudar o texto padrão, use <b>Minhas mensagens</b>.</p>`,
        botoes: [{ texto: 'Cancelar' }, { texto: 'Abrir no WhatsApp', classe: 'btn-primario', acao: md => {
          const txt = md.corpo.querySelector('#ms-txt').value.trim(); if (!txt) throw new Error('Escreva a mensagem.');
          window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(txt)}`, '_blank', 'noopener');
          anotarAuto(p, `Mensagem pelo WhatsApp: ${(MODELOS.find(x => x[0] === atual) || [, 'mensagem'])[1].toLowerCase()}.`).then(desenhar);
          if (atual === 'triagem' && p.etapa === 'triagem') UI.toast(`${p.pessoa.nome}: primeiro contato anotado. Quando ela responder, é só clicar em "Entrevistar →".`, 'sucesso', 5000);
        } }] });
      const g = s => m.corpo.querySelector(s);
      const pintar = () => { g('#ms-txt').value = montarMensagem(mods[atual], p); g('#ms-tipos').querySelectorAll('[data-mod]').forEach(b => b.classList.toggle('ativa', b.dataset.mod === atual)); };
      g('#ms-tipos').addEventListener('click', e => { const b = e.target.closest('[data-mod]'); if (b) { atual = b.dataset.mod; pintar(); } });
      pintar();
    }
    // mensagem para várias pessoas: uma por vez (o WhatsApp não manda em massa), com o texto pronto e editável
    const modeloLote = p => p.etapa === 'triagem' && emAndamento(p) && contatoEm(p) ? 'cobrar' : modeloDaEtapa(p);
    function mensagemEmLote(pessoas, chave) {
      const fila = pessoas.filter(p => RH.soDigitos(p.pessoa.telefone).length >= 10), semTel = pessoas.length - fila.length;
      if (!fila.length) { UI.toast(pessoas.length === 1 ? 'Esta pessoa está sem telefone válido.' : 'Ninguém da seleção tem telefone válido.', 'aviso', 5000); return; }
      const mods = meusModelos(); let i = 0, enviados = 0, atual = '';
      const m = UI.modal({ titulo: 'Mandar mensagem, uma por vez', largura: '560px', fecharAoClicarFora: false,
        corpo: `${semTel ? `<div class="caixa caixa-aviso" style="margin-top:0">${qtd(semTel, 'pessoa ficou', 'pessoas ficaram')} de fora por estar sem telefone válido.</div>` : ''}
          <div class="cd-pap-topo"><b id="pap-nome"></b><span class="cd-pap-cont" id="pap-cont"></span></div>
          <div class="muted small" id="pap-sub"></div>
          <div class="msg-tipos" id="pap-tipos">${MODELOS.map(([k, rot]) => `<button type="button" data-mod="${k}">${rot}</button>`).join('')}</div>
          <label>Texto (dá para mexer antes de enviar)<textarea id="pap-txt" rows="6"></textarea></label>
          <p class="muted small" style="margin-bottom:0">Cada clique abre o WhatsApp com o texto pronto: confira, envie e volte aqui para a próxima pessoa. O envio fica no histórico de cada um.</p>`,
        botoes: [{ texto: 'Fechar', acao: () => { fim(); } }, { texto: 'Pular', classe: 'btn-secundario', acao: () => proximo() },
          { texto: 'Abrir no WhatsApp e ir para o próximo', classe: 'btn-primario', acao: md => {
            const p = fila[i], txt = md.corpo.querySelector('#pap-txt').value.trim(); if (!txt) throw new Error('Escreva a mensagem.');
            window.open(`https://wa.me/55${RH.soDigitos(p.pessoa.telefone)}?text=${encodeURIComponent(txt)}`, '_blank', 'noopener');
            anotarAuto(p, `Mensagem pelo WhatsApp: ${(MODELOS.find(x => x[0] === atual) || [, 'mensagem'])[1].toLowerCase()}.`);
            enviados++;
            return proximo();
          } }] });
      const g = s => m.corpo.querySelector(s);
      function pintar() {
        const p = fila[i]; atual = chave || modeloLote(p);
        g('#pap-nome').textContent = p.pessoa.nome;
        g('#pap-cont').textContent = `${i + 1} de ${fila.length}`;
        g('#pap-sub').textContent = [p.pessoa.telefone, p.cargo, ETAPAS[p.etapa]].filter(Boolean).join(' · ');
        texto();
      }
      function texto() { g('#pap-txt').value = montarMensagem(mods[atual], fila[i]); g('#pap-tipos').querySelectorAll('[data-mod]').forEach(b => b.classList.toggle('ativa', b.dataset.mod === atual)); }
      function fim() { if (enviados) { UI.toast(`${qtd(enviados, 'mensagem aberta', 'mensagens abertas')} no WhatsApp e anotada${enviados > 1 ? 's' : ''} no histórico.`, 'sucesso', 4000); setTimeout(desenhar, 600); } }
      // false = a janela continua aberta com a próxima pessoa
      function proximo() { i++; if (i >= fila.length) { fim(); return true; } pintar(); return false; }
      g('#pap-tipos').addEventListener('click', e => { const b = e.target.closest('[data-mod]'); if (b) { atual = b.dataset.mod; texto(); } });
      pintar();
    }
    // editor dos modelos do próprio RH
    function editarMensagens() {
      const mods = meusModelos(), exemplo = { pessoa: { nome: 'MARIA DA SILVA', telefone: '' }, cargo: 'AUDITOR', etapa: 'entrevista', situacao: 'em_andamento', documentos: {},
        entrevista: { data: RH.hoje(), hora: '09:00', local: 'escritório de Lagoa Vermelha' }, distrito_id: (distritosProjeto()[0] || {}).id, chegada_data: RH.hoje(), chegada_hora: '07:00' };
      let atual = 'triagem';
      const m = UI.modal({ titulo: 'Minhas mensagens do WhatsApp', largura: '720px',
        corpo: `<p class="muted" style="margin-top:0">Textos que você manda para os candidatos. Os marcadores entre chaves são trocados pelos dados de cada pessoa; uma linha com marcador vazio (ex.: sem local) não aparece.</p>
          <div class="msg-tipos" id="me-tipos">${MODELOS.map(([k, rot]) => `<button type="button" data-mod="${k}" class="${k === atual ? 'ativa' : ''}">${rot}</button>`).join('')}</div>
          <div class="msg-editor">
            <label>Texto<textarea id="me-txt" rows="8"></textarea></label>
            <div><span class="vg-rot">Como fica (exemplo)</span><div class="msg-previa" id="me-previa"></div></div>
          </div>
          <div class="msg-marcadores"><span class="muted small">Clique para inserir:</span> ${MARCADORES.map(([k, d]) => `<button type="button" data-marca="${k}" title="${d}">${k}</button>`).join('')}</div>
          <button type="button" class="btn-link" id="me-padrao">Voltar este texto para o padrão</button>`,
        botoes: [{ texto: 'Cancelar' }, { texto: 'Salvar', classe: 'btn-primario', acao: async md => {
          mods[atual] = md.corpo.querySelector('#me-txt').value;
          const padrao = Object.fromEntries(MODELOS.map(([k, , txt]) => [k, txt]));
          const meus = Object.fromEntries(Object.entries(mods).filter(([k, v]) => padrao[k] !== undefined && v.trim() && v !== padrao[k]));
          await Nuvem.minhasMensagens(Object.keys(meus).length ? meus : null);
          UI.toast('Mensagens salvas.', 'sucesso');
        } }] });
      const g = s => m.corpo.querySelector(s);
      const previa = () => { g('#me-previa').textContent = montarMensagem(g('#me-txt').value, exemplo); };
      const abrir = k => { mods[atual] = g('#me-txt').value || mods[atual]; atual = k; g('#me-txt').value = mods[k]; g('#me-tipos').querySelectorAll('[data-mod]').forEach(b => b.classList.toggle('ativa', b.dataset.mod === k)); previa(); };
      g('#me-txt').value = mods[atual]; previa();
      g('#me-txt').addEventListener('input', previa);
      g('#me-tipos').addEventListener('click', e => { const b = e.target.closest('[data-mod]'); if (b) abrir(b.dataset.mod); });
      m.corpo.querySelector('.msg-marcadores').addEventListener('click', e => {
        const b = e.target.closest('[data-marca]'); if (!b) return; const ta = g('#me-txt'), i = ta.selectionStart || ta.value.length;
        ta.value = ta.value.slice(0, i) + b.dataset.marca + ta.value.slice(ta.selectionEnd || i); ta.focus(); ta.selectionStart = ta.selectionEnd = i + b.dataset.marca.length; previa();
      });
      g('#me-padrao').addEventListener('click', () => { g('#me-txt').value = (MODELOS.find(x => x[0] === atual) || [])[2] || ''; previa(); });
    }

    // ---------- sinais rápidos do cartão ----------
    const NAO_ATENDEU = 'Liguei e não atendeu.';
    const tentativas = p => (p.anotacoes || []).filter(a => a.texto === NAO_ATENDEU).length;
    const CONTATO = 'Mensagem pelo WhatsApp: primeiro contato';
    const contatoEm = p => { const a = (p.anotacoes || []).filter(x => String(x.texto || '').startsWith(CONTATO)).pop(); return a ? (a.em || true) : null; };
    const diaCurto = em => em && em !== true ? RH.fmtDia(String(em).slice(0, 10)) : '';
    // triagem sem resposta: mandou o 1º contato há 2+ dias e a pessoa continua na triagem
    const COBRANCA = 'Mensagem pelo WhatsApp: cobrar resposta';
    const cobrancas = p => (p.anotacoes || []).filter(a => String(a.texto || '').startsWith(COBRANCA)).length;
    const semResposta = p => { if (!emAndamento(p) || p.etapa !== 'triagem') return 0; const em = contatoEm(p); if (!em || em === true) return 0; const d = diasDesde(em); return d >= 2 ? d : 0; };
    // já tentou bastante: sugere encerrar como "não respondeu"
    const sugerirNaoRespondeu = p => emAndamento(p) && p.etapa === 'triagem' && (tentativas(p) + cobrancas(p) >= 3 || semResposta(p) >= 7);
    const MOTIVO_SEM_RESPOSTA = 'Não respondeu / sem contato';
    const seloSemResposta = p => { const d = semResposta(p); return d ? `<span class="cd-chip cd-chip-${d >= 7 ? 'ruim' : 'pend'}" title="Mandou o 1º contato e a pessoa ainda não respondeu">sem resposta há ${d} dias</span>` : ''; };
    // entrevista: a pessoa confirmou que vem?
    const confirmou = p => ((p.entrevista || {}).confirmou) || '';
    const esperaConfirmar = p => { const e = p.entrevista || {}; return emAndamento(p) && p.etapa === 'entrevista' && !!e.data && e.data >= RH.hoje() && (e.resultado || 'aguardando') === 'aguardando'; };
    const seloConfirmou = p => !esperaConfirmar(p) ? '' : confirmou(p) === 'sim' ? '<span class="cd-chip cd-chip-ok" title="A pessoa confirmou que vem">confirmado</span>'
      : confirmou(p) === 'nao' ? '<span class="cd-chip cd-chip-ruim" title="A pessoa avisou que não vem">avisou que não vem</span>' : '<span class="cd-chip cd-chip-pend" title="Ainda não confirmou presença">não confirmou</span>';
    // urgência da vaga da pessoa: atrasada primeiro, depois prioridade, depois a data em que precisa da pessoa
    const PRIOR = { urgente: 0, alta: 1, normal: 2, baixa: 3 };
    // vagas guardadas durante um desenho da tela (ordenar consulta a vaga muitas vezes)
    let cacheVagas = null;
    const vagaRapida = id => { if (!id) return null; if (!cacheVagas) { cacheVagas = new Map(vagasProjeto().map(v => [v.id, v])); setTimeout(() => { cacheVagas = null; }, 0); } return cacheVagas.get(id) || null; };
    const chaveUrgencia = p => { const v = vagaRapida(p.vaga_id); return v ? [v.atrasada ? 0 : 1, PRIOR[v.prioridade] != null ? PRIOR[v.prioridade] : 2, v.dataNecessidade || '9999-12-31'] : [1, 4, '9999-12-31']; };
    const porUrgencia = (x, y) => { const a = chaveUrgencia(x), b = chaveUrgencia(y); return a[0] - b[0] || a[1] - b[1] || a[2].localeCompare(b[2]); };
    const seloPrazo = p => { const v = vagaRapida(p.vaga_id); if (!v || !emAndamento(p)) return '';
      return v.atrasada ? `<span class="cd-prazo cd-prazo-ruim" title="A data em que a vaga precisava da pessoa (${RH.fmtDia(v.dataNecessidade)}) já passou">vaga atrasada</span>`
        : v.dataNecessidade ? `<span class="cd-prazo${PRIOR[v.prioridade] <= 1 ? ' cd-prazo-alta' : ''}" title="Prioridade ${UI.esc(v.prioridade)}">vaga até ${RH.fmtDia(v.dataNecessidade)}</span>` : ''; };
    const chegaDepoisDoPrazo = p => { const v = vagaRapida(p.vaga_id); return !!(v && v.dataNecessidade && p.chegada_data && p.chegada_data > v.dataNecessidade); };
    // última movimentação: a anotação mais recente ou a última alteração, o que vier depois
    const ultimoMovimento = p => { const a = (p.anotacoes || []).map(x => x.em).filter(Boolean).sort().pop(); return [a, p.atualizado_em].filter(Boolean).sort((x, y) => new Date(x) - new Date(y)).pop() || desdeEtapa(p); };
    // botão principal de quem está na triagem ou na entrevista (o mesmo no Quadro e na Lista)
    function acaoPrincipal(p, curto) {   // curto: rótulos menores para caber no cartão do Quadro
      if (p.etapa === 'triagem') return linkWhats(p.pessoa) && !contatoEm(p)
        ? '<button class="btn btn-pequeno btn-wa" data-acao="contato" title="Abre o WhatsApp com a mensagem de primeiro contato">1º contato</button>'
        : `<button class="btn btn-pequeno btn-primario" data-acao="avancar">${curto ? 'Entrevistar' : 'Entrevistar →'}</button>`;
      const res = (p.entrevista && p.entrevista.resultado) || 'aguardando', temData = p.entrevista && p.entrevista.data;
      return res === 'aprovado' ? `<button class="btn btn-pequeno btn-primario" data-acao="avancar" title="Aprovado: vai para a Documentação">${curto ? 'Docs →' : 'Documentação →'}</button>`
        : res === 'faltou' ? '<button class="btn btn-pequeno btn-primario" data-acao="remarcar">Remarcar</button>'
        : !temData ? '<button class="btn btn-pequeno btn-primario" data-acao="agendar">Agendar</button>'
        : `<button class="btn btn-pequeno" data-acao="resultado" title="Marcar o resultado da entrevista">${curto ? 'Resultado' : 'Marcar resultado'}</button>`;
    }
    const diasNaEtapa = p => { const ts = p.etapa_em || p.criado_em; return ts ? Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 86400000)) : 0; };
    const linkWhats = (pe, msg) => { const t = RH.soDigitos(pe.telefone); return t.length >= 10 ? `https://wa.me/55${t}${msg ? '?text=' + encodeURIComponent(msg) : ''}` : ''; };
    // duas entrevistas do mesmo RH no mesmo dia e horário
    // índice analista|data|hora → pessoas, montado uma vez por desenho (antes era uma busca na lista inteira por cartão)
    let indiceConflito = null;
    const chaveConflito = x => `${x.analista_login}|${x.entrevista.data}|${x.entrevista.hora}`;
    const conflitoDe = p => { const e = p.entrevista; if (!e || !e.data || !e.hora || !emAndamento(p) || !p.analista_login) return null;
      if (!indiceConflito) {
        indiceConflito = new Map();
        for (const x of linhas) if (emAndamento(x) && x.analista_login && x.entrevista && x.entrevista.data && x.entrevista.hora) { const k = chaveConflito(x); (indiceConflito.get(k) || indiceConflito.set(k, []).get(k)).push(x); }
        setTimeout(() => { indiceConflito = null; }, 0);
      }
      return (indiceConflito.get(chaveConflito(p)) || []).find(x => x !== p) || null; };
    // vaga cancelada ou que já completou o pedido do tipo/distrito da pessoa
    function avisoVaga(p) {
      const vg = p.vaga_id ? Store.vaga(p.vaga_id) : null; if (!vg) return '';
      if (['cancelada', 'recusada'].includes(vg.status)) return `vaga ${vg.status}`;
      const ve = vagaDe(p.vaga_id); if (!ve || !ve.contagemCarregada) return '';
      const x = p.distrito_id && ve.porDistrito.find(y => y.distrito.id === p.distrito_id);
      if (x) { const ped = p.tipo === 'MOVEL' ? x.moveis : x.locais, adm = p.tipo === 'MOVEL' ? x.admMov : x.admLoc; return ped && adm >= ped ? 'vaga já completa aqui' : ''; }
      return ve.status === 'preenchida' ? 'vaga já completa' : '';
    }
    const rhInativo = p => { const u = Store.usuarioPorLogin(p.analista_login); return !!(u && u.ativo === false); };
    // ---------- possível duplicado: mesmo CPF ou mesmo telefone em outro candidato do projeto (só entre os que este usuário enxerga) ----------
    let indiceDup = null;
    const chavesDup = p => { const k = [], pe = p.pessoa || {}, cpf = RH.soDigitos(pe.cpf), tel = RH.soDigitos(pe.telefone).replace(/^55(?=\d{10,11}$)/, '');
      if (cpf.length === 11) k.push('CPF|' + cpf); if (tel.length >= 10) k.push('telefone|' + tel); return k; };
    // todos = também quem já saiu do processo (a ficha mostra como informação); sem todos = só os que ainda contam (em andamento ou admitido)
    // par marcado como "não é a mesma pessoa" (gravado no banco, nos dois lados quando dá): o aviso some
    const naoDuplicado = (a, b) => (a.nao_duplicado || []).includes(b.id) || (b.nao_duplicado || []).includes(a.id);
    async function marcarNaoDuplicado(p, o) {
      try { await Nuvem.rh.salvar({ id: p.pessoa.id }, { id: p.id, nao_duplicado: [o.id] }); }
      catch (e) { UI.toast(RhSafra.limpar(e.message), 'erro', 6000); return false; }
      p.nao_duplicado = [...new Set([...(p.nao_duplicado || []), o.id])];
      // o outro lado também (se este usuário puder mexer nele; se não puder, o lado gravado já basta para o aviso sumir)
      try { await Nuvem.rh.salvar({ id: o.pessoa.id }, { id: o.id, nao_duplicado: [p.id] }); o.nao_duplicado = [...new Set([...(o.nao_duplicado || []), p.id])]; } catch (e) { /* ok */ }
      UI.toast(`${primeiroNome(p.pessoa.nome)} e ${primeiroNome(o.pessoa.nome)}: marcados como pessoas diferentes. O aviso de duplicado sumiu.`, 'sucesso', 4500);
      desenhar();
      return true;
    }
    function duplicadosDe(p, todos = false) {
      if (!indiceDup) {
        indiceDup = new Map();
        for (const x of linhas) for (const k of chavesDup(x)) (indiceDup.get(k) || indiceDup.set(k, []).get(k)).push(x);
        setTimeout(() => { indiceDup = null; }, 0);
      }
      const r = new Map();
      for (const k of chavesDup(p)) for (const x of indiceDup.get(k) || []) {
        if (x === p || r.has(x.id) || (!todos && !(emAndamento(x) || x.situacao === 'admitido')) || naoDuplicado(p, x)) continue;
        r.set(x.id, { p: x, por: k.split('|')[0], mesma: !!(x.pessoa && p.pessoa && x.pessoa.id && x.pessoa.id === p.pessoa.id) });
      }
      return [...r.values()];
    }
    const temDuplicado = p => emAndamento(p) && duplicadosDe(p).length > 0;
    const ondeEsta = x => x.situacao === 'admitido' ? 'admitido' : emAndamento(x) ? (ETAPAS[x.etapa] || x.etapa).toLowerCase() : (SIT[x.situacao] || '').toLowerCase();
    // botões "mesmo CPF/telefone de Fulano" (abrem a ficha do outro)
    const seloDup = p => { if (!emAndamento(p)) return ''; const d = duplicadosDe(p); if (!d.length) return '';
      return `<div class="rhn-dup">${d.slice(0, 2).map(x => `<button type="button" class="rhn-dup-b" data-acao="dup" data-dup="${x.p.id}" title="Abrir a ficha de ${UI.esc(x.p.pessoa.nome)} (${UI.esc(ondeEsta(x.p))}${x.p.cargo ? ' · ' + UI.esc(x.p.cargo) : ''})">${x.mesma ? 'mesma pessoa em outra vaga' : 'mesmo ' + x.por}: ${UI.esc(primeiroNome(x.p.pessoa.nome))}</button>${!x.mesma && podeEditar ? `<button type="button" class="rhn-dup-nao" data-acao="nao-dup" data-dup="${x.p.id}" title="Não é a mesma pessoa que ${UI.esc(x.p.pessoa.nome)}: tirar o aviso" aria-label="Não é a mesma pessoa que ${UI.esc(x.p.pessoa.nome)}">não é ✕</button>` : ''}`).join('')}${d.length > 2 ? `<span class="muted small">+${d.length - 2}</span>` : ''}</div>`; };

    // ---------- situação de cada pessoa ----------
    const emAndamento = p => p.situacao === 'em_andamento';
    const naEtapa = (p, e) => emAndamento(p) && p.etapa === e;
    const barradaEm = p => p.aso === 'inapto' ? 'inapto no ASO' : p.treinamento === 'reprovado' ? 'reprovado no treinamento' : '';
    // O que ainda impede a admissão. É a mesma regra que o banco aplica: sem nada aqui, pode admitir.
    function bloqueios(p) {
      const b = [], pe = p.pessoa, din = dinamicaDe(p), id = RH.idade(pe.nascimento);
      if (p.etapa !== 'documentos') b.push(`ainda está na ${ETAPAS[p.etapa] || p.etapa}`);
      if (barradaEm(p)) b.push(barradaEm(p));
      if (!pe.cpf) b.push('sem CPF');
      if (!pe.nascimento) b.push('sem data de nascimento'); else if (id < 18) b.push(`menor de idade (${id} anos)`);
      if (din.recusados.length) b.push(`${din.recusados.length} documento${din.recusados.length > 1 ? 's' : ''} recusado${din.recusados.length > 1 ? 's' : ''}`);
      if (din.faltam.length) b.push(`${din.faltam.length === 1 ? 'falta 1 documento' : `faltam ${din.faltam.length} documentos`}`);
      if (!['ok', 'dispensado'].includes(p.aso) && p.aso !== 'inapto') b.push('ASO não concluído');
      else if (p.aso === 'ok' && (!p.aso_data || p.aso_data > RH.hoje())) b.push('ASO apto sem data (preencha a data do exame)');
      if (!['ok', 'dispensado'].includes(p.treinamento) && p.treinamento !== 'reprovado') b.push('treinamento não concluído');
      if (!cidade(pe.cidade_origem_id)) b.push('sem cidade de origem');
      if (!cidade(trabalhoId(p))) b.push('sem distrito ou cidade de trabalho');
      const vg = p.vaga_id ? Store.vaga(p.vaga_id) : null;
      // vaga que este usuário não enxerga (é de outro RH) não trava aqui: o banco confere se ela existe e está aberta
      if (vg && ['cancelada', 'recusada'].includes(vg.status)) b.push(`a vaga foi ${vg.status === 'cancelada' ? 'cancelada' : 'recusada'}: mude a vaga na ficha`);
      return b;
    }
    // CNH: "não tem" (ou parecido) = sem habilitação; em branco = não informada. Fica visível no cartão.
    const semCnh = pe => /^\s*(n[aã]o(\s+(tem|possui|habilitad[oa]))?|nenhuma|sem(\s+cnh)?|n|x|-|0)\s*\.?$/i.test(pe.cnh || '');
    const seloCnh = pe => semCnh(pe) ? '<span class="cd-cnh cd-cnh-sem" title="Não tem carteira de motorista">Sem CNH</span>'
      : !String(pe.cnh || '').trim() ? '<span class="cd-cnh cd-cnh-nd" title="CNH não informada na ficha">CNH?</span>' : `<span class="cd-cnh" title="Carteira de motorista">CNH ${UI.esc(String(pe.cnh).toUpperCase().slice(0, 6))}</span>`;
    const menor = p => { const i = RH.idade(p.pessoa.nascimento); return i != null && i < 18; };
    const pronta = p => naEtapa(p, 'documentos') && !bloqueios(p).length;
    const opcoes = (mapa, sel) => Object.entries(mapa).map(([k, r]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${r}</option>`).join('');
    const classeEstado = (campo, v) => RH.pronto({ dinamica: 'ok', aso: 'ok', treinamento: 'ok', [campo]: v }) ? 'ok' : (['reprovado', 'inapto'].includes(v) ? 'ruim' : (v === 'pendente' ? 'pend' : 'meio'));
    const qtd = (n, um, varios) => `${UI.fmtNum(n)} ${n === 1 ? um : varios}`;

    el.innerHTML = `
      <div class="card sem-padding cd-pagina">
        <div class="cad-barra cd-barra">
          <label class="cad-proj">Projeto<select id="cd-projeto">${projetos.map(p => `<option value="${p.id}" ${p.id === projetoId ? 'selected' : ''}>${UI.esc(Store.rotuloProjeto(p))}</option>`).join('')}</select></label>
          <label class="cad-proj">Vaga<select id="cd-vaga"></select></label>
          <label class="cad-proj">Distrito<select id="cd-distrito"></select></label>
          <label class="cad-proj" ${veTudo ? '' : 'hidden'}>RH responsável<select id="cd-analista"></select></label>
          <span class="espaco"></span>
          <div class="linha nao-imprimir">
            <div class="cd-mais"><button type="button" class="btn" id="cd-planilha" aria-haspopup="menu" aria-expanded="false">Planilha ▾</button><div class="cd-menu" id="cd-planilha-menu" hidden>
              ${podeEditar && veTudo ? '<button type="button" id="cd-importar">Importar planilha do formulário</button>' : ''}
              <button type="button" id="cd-exportar" title="Baixa a lista que está na tela no modelo da planilha SEMANA">Exportar a lista (modelo SEMANA)</button>
            </div></div>
            ${podeEditar ? '<button class="btn" id="cd-banco" title="Quem trabalhou em outras safras e foi avaliado como recontrataria: chame e traga para esta safra">Banco de talentos</button>' : ''}
            ${podeEditar ? '<button class="btn" id="cd-mensagens" title="Textos padrão que você manda pelo WhatsApp">Minhas mensagens</button>' : ''}
            ${podeEditar ? '<button class="btn btn-primario" id="cd-novo">+ Novo candidato</button>' : ''}
          </div>
        </div>
        <div class="cd-faixa">
          <div class="abas cd-abas" id="cd-abas"></div>
          <span class="espaco"></span>
          <input class="busca nao-imprimir" id="cd-busca" placeholder="Procurar por nome, CPF, telefone, cidade ou cargo…" aria-label="Procurar candidatos">
          <button type="button" class="rhn-atalhos-btn nao-imprimir" id="rhn-atalhos" title="Atalhos do teclado (aperte ?)" aria-label="Atalhos do teclado">?</button>
        </div>
        <div id="cd-hoje" class="cd-hoje"></div>
        <div id="cd-aviso"></div>
        <div id="cd-corpo"></div>
      </div>`;
    const q = s => el.querySelector(s);
    if (buscaIni) { busca = buscaIni; q('#cd-busca').value = buscaIni; }
    q('#cd-planilha').addEventListener('click', e => { e.stopPropagation(); const mn = q('#cd-planilha-menu'); if (mn.hidden) { UI.abrirMenu(q('#cd-planilha'), mn); q('#cd-planilha').setAttribute('aria-expanded', 'true'); } else { mn.hidden = true; q('#cd-planilha').setAttribute('aria-expanded', 'false'); } });
    q('#cd-planilha-menu').addEventListener('click', () => { q('#cd-planilha-menu').hidden = true; q('#cd-planilha').setAttribute('aria-expanded', 'false'); });
    // a Lista usa o layout compacto quando o espaço útil (descontada a barra lateral) é pequeno, e não pela largura da janela
    const medirLargura = () => { const c = q('#cd-corpo'); if (c) c.classList.toggle('cd-compacto', c.clientWidth > 0 && c.clientWidth < 1180); };
    if (window.ResizeObserver) new ResizeObserver(medirLargura).observe(q('#cd-corpo'));

    // "já trabalhou": avaliação de outra safra de quem está neste projeto (pela função do banco), por pessoa
    let jaTrab = new Map(), jaTrabProj = '';
    function carregarJaTrabalhou() {
      if (!Nuvem.rh.jaTrabalhou) return;
      const pid = projetoId; if (jaTrabProj !== pid) { jaTrab = new Map(); jaTrabProj = pid; }
      Nuvem.rh.jaTrabalhou(pid).then(l => {
        if (pid !== projetoId) return;
        const novo = new Map(l.map(x => [x.pessoa_id, x])), mudou = novo.size !== jaTrab.size || [...novo].some(([k, x]) => !jaTrab.has(k) || jaTrab.get(k).avaliado_em !== x.avaliado_em);
        jaTrab = novo;
        if (mudou && ativo && !document.querySelector('.modal-overlay')) desenhar();
      }).catch(() => { /* sem a função no banco: só não mostra o selo */ });
    }
    const seloJaTrabalhou = p => jaTrabProj === projetoId && p.pessoa ? RhSafra.seloJa(jaTrab.get(p.pessoa.id)) : '';
    async function carregar() {
      carregarJaTrabalhou();
      try { linhas = await Nuvem.rh.listar(projetoId); contarVagas(); Nuvem.rh.contagemVagas(projetoId).then(m => { Store.definirContagemVagas(m); if (ativo && vista === 'rh') desenhar(); }).catch(() => {}); }
      catch (e) { if (ativo) q('#cd-corpo').innerHTML = `<div class="vazio erro">Não foi possível carregar: ${UI.esc(e.message)}<br><button class="btn btn-pequeno" data-recarregar style="margin-top:10px">Tentar de novo</button></div>`; return; }
      if (ativo) desenhar();
    }

    // ---------- filtros ----------
    // base: filtros da barra de cima (vaga, distrito, RH) + busca. Valem para as três visões.
    function base({ semAnalista = false, semBusca = false } = {}) {
      let l = linhas;
      if (vagaId === '(sem)') l = l.filter(p => !p.vaga_id); else if (vagaId) l = l.filter(p => p.vaga_id === vagaId);
      if (distritoId === '(sem)') l = l.filter(p => !p.distrito_id); else if (distritoId) l = l.filter(p => p.distrito_id === distritoId);
      if (!semAnalista) { if (analista === '(sem)') l = l.filter(p => !chaveAnalista(p)); else if (analista) l = l.filter(p => chaveAnalista(p) === analista); }
      if (!semBusca && busca) {
        const b = Store.normalizar(busca), bd = RH.soDigitos(busca);
        l = l.filter(p => Store.normalizar([p.pessoa.nome, nomeCidade(p.pessoa.cidade_origem_id), destinoTexto(p), nomeAnalista(p), p.cargo, p.unidade].join(' ')).includes(b) || (bd.length >= 3 && (String(p.pessoa.cpf || '').includes(bd) || RH.soDigitos(p.pessoa.telefone).includes(bd))));
      }
      return l;
    }
    // ---------- Lista: uma etapa por vez ----------
    const SEGS = [['triagem', 'Triagem'], ['entrevista', 'Entrevista'], ['documentos', 'Documentação'], ['admitido', 'Admitidos'], ['fora', 'Não seguiram']];
    const noSeg = (p, s) => s === 'admitido' ? p.situacao === 'admitido' : s === 'fora' ? (p.situacao === 'reprovado' || p.situacao === 'desistiu') : naEtapa(p, s);
    // filtros de pendência dentro da Documentação
    const naoOk = (campo, oks) => p => !oks.includes(p[campo]) && !barradaEm(p);
    const PEND = {
      prontas: { rotulo: 'Prontos para admitir', teste: pronta },
      pendentes: { rotulo: 'Com pendência', teste: p => !pronta(p) && !barradaEm(p) },
      docsfalta: { rotulo: 'Documento faltando', teste: p => dinamicaDe(p).faltam.length > 0 },
      docsrec: { rotulo: 'Documento recusado', teste: p => dinamicaDe(p).recusados.length > 0 },
      aso: { rotulo: 'Sem ASO', teste: naoOk('aso', ['ok', 'dispensado']) },
      treinamento: { rotulo: 'Sem treinamento', teste: naoOk('treinamento', ['ok', 'dispensado']) },
      semcpf: { rotulo: 'Sem CPF', teste: p => !p.pessoa.cpf },
      semnasc: { rotulo: 'Sem nascimento', teste: p => !p.pessoa.nascimento },
      menores: { rotulo: 'Menor de idade', teste: menor },
      barradas: { rotulo: 'Inapto/reprovado', teste: p => !!barradaEm(p) },
      asohoje: { rotulo: 'ASO hoje', teste: p => naEtapa(p, 'documentos') && p.aso === 'agendado' && p.aso_data === RH.hoje() },
      asoatraso: { rotulo: 'ASO passou sem resultado', teste: p => naEtapa(p, 'documentos') && p.aso === 'agendado' && !!p.aso_data && p.aso_data < RH.hoje() },
      treamanha: { rotulo: 'Treinamento amanhã', teste: p => naEtapa(p, 'documentos') && p.treinamento === 'agendado' && p.treinamento_data === somarDias(RH.hoje(), 1) },
      // vindos do Início
      prontasparadas: { rotulo: 'Prontos há 2+ dias', teste: p => pronta(p) && diasNaEtapa(p) >= 2, soLink: true },
      docparada: { rotulo: 'Parados há 7+ dias', teste: p => naEtapa(p, 'documentos') && !pronta(p) && diasNaEtapa(p) >= 7, soLink: true },
      chegasemana: { rotulo: 'Chegam esta semana com pendência', teste: p => naEtapa(p, 'documentos') && !!p.chegada_data && RH.segundaDaSemana(p.chegada_data) === RH.segundaDaSemana(RH.hoje()) && !pronta(p), soLink: true },
      // chegada no campo (Documentação e Admitidos)
      chegahoje: { rotulo: 'Chegam hoje', teste: p => chegaHoje(p), segs: ['documentos', 'admitido'] },
      chegavencida: { rotulo: 'Chegada sem confirmação', teste: p => chegadaVencida(p), segs: ['documentos', 'admitido'] },
      faltaram: { rotulo: 'Faltaram na chegada', teste: p => faltouCampo(p), segs: ['documentos', 'admitido'] },
      // avaliação de fim de safra (Admitidos)
      semaval: { rotulo: 'Sem avaliação de fim de safra', teste: p => p.situacao === 'admitido' && !p.avaliacao_recontrataria, segs: ['admitido'] },
      // Triagem e Entrevista
      semresposta: { rotulo: 'Aguardando resposta', teste: p => !!semResposta(p), segs: ['triagem'] },
      parados3: { rotulo: 'Na etapa há 3+ dias', teste: p => emAndamento(p) && diasNaEtapa(p) >= 3, segs: ['triagem', 'entrevista'] },
      semdata: { rotulo: 'Sem data marcada', teste: p => naEtapa(p, 'entrevista') && !(p.entrevista && p.entrevista.data), segs: ['entrevista'] },
      semresultado: { rotulo: 'Passou sem resultado', teste: p => naEtapa(p, 'entrevista') && !!(p.entrevista && p.entrevista.data) && p.entrevista.data < RH.hoje() && (p.entrevista.resultado || 'aguardando') === 'aguardando', segs: ['entrevista'] },
      // mesma pessoa cadastrada duas vezes (CPF ou telefone igual)
      duplicados: { rotulo: 'Possível duplicado', teste: p => temDuplicado(p), segs: ['triagem', 'entrevista', 'documentos'] }
    };
    const pendDaEtapa = (k, s) => !!PEND[k] && (PEND[k].segs || ['documentos']).includes(s);
    // ---------- chegada no campo ----------
    const CHEGADA = { aguardando: 'Aguardando', chegou: 'Chegou', faltou: 'Faltou', remarcou: 'Remarcou' };
    const stChegada = p => p.chegada_status || 'aguardando';
    const temChegada = p => !!p.chegada_data && (naEtapa(p, 'documentos') || p.situacao === 'admitido');
    const chegaHoje = p => temChegada(p) && p.chegada_data === RH.hoje() && !['chegou', 'faltou'].includes(stChegada(p));
    const chegadaVencida = p => temChegada(p) && p.chegada_data < RH.hoje() && stChegada(p) === 'aguardando';
    const faltouCampo = p => temChegada(p) && stChegada(p) === 'faltou';
    // entrevistas de amanhã em que a pessoa ainda não confirmou
    const amanhaSemConfirmar = l => l.filter(p => esperaConfirmar(p) && p.entrevista.data === somarDias(RH.hoje(), 1) && confirmou(p) !== 'sim');
    const diasDesde = ts => ts ? Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 86400000)) : null;
    const desdeEtapa = p => p.etapa_em || p.criado_em;
    function daLista(semPend = false) {
      if (!seg) seg = base().some(p => naEtapa(p, 'documentos')) ? 'documentos' : 'triagem';
      let l = base().filter(p => noSeg(p, seg));
      if (seg === 'documentos' || seg === 'admitido') {
        if (semana === 'sem') l = l.filter(p => !p.chegada_data);
        else if (semana !== 'todas') l = l.filter(p => p.chegada_data && RH.segundaDaSemana(p.chegada_data) === semana);
      }
      if (pend && pendDaEtapa(pend, seg) && !semPend) l = l.filter(PEND[pend].teste);
      return l;
    }
    function desenharFiltros() {
      const vagas = vagasProjeto();
      const contV = id => linhas.filter(p => (id === '(sem)' ? !p.vaga_id : p.vaga_id === id)).length;
      if (vagaId && vagaId !== '(sem)' && !vagas.some(v => v.id === vagaId)) vagaId = '';
      const semVaga = contV('(sem)');
      q('#cd-vaga').innerHTML = `<option value="">Todas (${linhas.length})</option>` + vagas.map(v => `<option value="${v.id}" ${v.id === vagaId ? 'selected' : ''}>${UI.esc(rotuloVaga(v))} (${contV(v.id)})</option>`).join('') +
        (semVaga && vagas.length ? `<option value="(sem)" ${vagaId === '(sem)' ? 'selected' : ''}>Sem vaga (${semVaga})</option>` : '');
      const contD = new Map(); let semD = 0;
      for (const p of linhas) { if (!p.distrito_id) { semD++; continue; } contD.set(p.distrito_id, (contD.get(p.distrito_id) || 0) + 1); }
      if (distritoId && distritoId !== '(sem)' && !contD.has(distritoId)) distritoId = '';
      q('#cd-distrito').innerHTML = `<option value="">Todos</option>` + distritosProjeto().filter(d => contD.has(d.id)).map(d => `<option value="${d.id}" ${d.id === distritoId ? 'selected' : ''}>${UI.esc(d.nome)} (${contD.get(d.id)})</option>`).join('') +
        (semD ? `<option value="(sem)" ${distritoId === '(sem)' ? 'selected' : ''}>Sem distrito (${semD})</option>` : '');
      const contA = new Map(); let semA = 0;
      for (const p of linhas) { const k = chaveAnalista(p); if (!k) { semA++; continue; } const a = contA.get(k) || { nome: nomeAnalista(p), n: 0 }; a.n++; contA.set(k, a); }
      if (analista && analista !== '(sem)' && !contA.has(analista)) analista = '';
      q('#cd-analista').innerHTML = `<option value="">Todos</option>` + [...contA.entries()].sort((a, b) => a[1].nome.localeCompare(b[1].nome, 'pt-BR')).map(([k, a]) => `<option value="${UI.esc(k)}" ${k === analista ? 'selected' : ''}>${UI.esc(a.nome)} (${a.n})</option>`).join('') +
        (semA ? `<option value="(sem)" ${analista === '(sem)' ? 'selected' : ''}>Sem RH responsável (${semA})</option>` : '');
    }

    // estado de arraste que sobra quando o cartão some no meio do arraste (ex.: o banco recusou e a tela redesenhou)
    function limparArraste() {
      arrastando = null;
      const c = q('#cd-corpo'); c.classList.remove('cd-arrastando');
      c.querySelectorAll('.cd-levantado, .cd-pode, .cd-sobre, .cd-arrastando').forEach(x => x.classList.remove('cd-levantado', 'cd-pode', 'cd-sobre', 'cd-arrastando'));
    }
    function desenhar() {
      UI.fecharMenus();
      cacheVagas = null; indiceConflito = null; indiceDup = null;   // dados podem ter mudado desde o último desenho
      // a dinâmica está completa quando todos os documentos do cargo foram entregues (recalculado: o cargo pode ter mudado)
      for (const p of linhas) if (emAndamento(p)) p.dinamica = dinamicaDe(p).completa ? 'ok' : 'pendente';
      desenharFiltros();
      const b = base();
      const abas = [['quadro', 'Quadro', b.filter(emAndamento).length], ['lista', 'Lista', null], ['agenda', 'Agenda de entrevistas', null]].concat(veTudo ? [['rh', 'Por RH', null]] : []);
      q('#cd-abas').innerHTML = abas.map(([id, rot, n]) => `<button class="aba ${vista === id ? 'ativa' : ''}" data-vista="${id}">${rot}${n == null ? '' : ` <span class="aba-num">${UI.fmtNum(n)}</span>`}</button>`).join('');
      // quem ainda não tem RH: é o que o administrador precisa direcionar
      const semRh = veTudo && podeEditar ? base({ semAnalista: true }).filter(p => emAndamento(p) && !chaveAnalista(p)).length : 0;
      q('#cd-aviso').innerHTML = semRh && analista !== '(sem)' ? `<div class="cd-aviso"><span><b>${qtd(semRh, 'candidato', 'candidatos')}</b> em andamento sem RH responsável.</span><button class="btn btn-pequeno" data-direcionar>Direcionar para um RH</button><button class="btn-link" data-ver-sem>Ver quem são</button></div>`
        : semRh ? `<div class="cd-aviso"><span>Mostrando só quem está <b>sem RH responsável</b> (${semRh}).</span><button class="btn btn-pequeno btn-primario" data-direcionar>Direcionar para um RH</button><button class="btn-link" data-ver-todos>Voltar a ver todos</button></div>` : '';
      if (!linhas.length) {
        q('#cd-corpo').innerHTML = `<div class="vazio cd-vazio">Ainda não há candidatos neste projeto.${podeEditar && veTudo ? '<br>Clique em <b>Importar planilha</b> para trazer as respostas do formulário, ou em <b>+ Novo candidato</b> para cadastrar um.' : podeEditar ? '<br>Quando o administrador direcionar candidatos para você, eles aparecem aqui. Para cadastrar um, clique em <b>+ Novo candidato</b>.' : ''}</div>`;
        return;
      }
      // faixa do dia: o que pede atenção hoje (clique leva à agenda)
      const hoje = RH.hoje(), ab = b.filter(emAndamento);
      const entHoje = ab.filter(p => p.entrevista && p.entrevista.data === hoje).length;
      const semRes = ab.filter(p => p.etapa === 'entrevista' && p.entrevista && p.entrevista.data && p.entrevista.data < hoje && (p.entrevista.resultado || 'aguardando') === 'aguardando').length;
      const triVelha = ab.filter(p => p.etapa === 'triagem' && diasNaEtapa(p) >= 3).length;
      const prontos = ab.filter(pronta).length;
      const aguardam = ab.filter(semResposta).length, semConf = amanhaSemConfirmar(ab).length;
      const comAdm = b.filter(p => emAndamento(p) || p.situacao === 'admitido'), chHoje = comAdm.filter(chegaHoje).length, chVenc = comAdm.filter(chegadaVencida).length;
      const asoHoje = ab.filter(PEND.asohoje.teste).length, asoPassou = ab.filter(PEND.asoatraso.teste).length, treAmanha = ab.filter(PEND.treamanha.teste).length;
      const dups = ab.filter(temDuplicado).length;
      const itens = [entHoje && `<button type="button" data-hoje="agenda"><b>${entHoje}</b> ${entHoje === 1 ? 'entrevista hoje' : 'entrevistas hoje'}</button>`,
        semRes && `<button type="button" data-hoje="agenda" class="ruim"><b>${semRes}</b> sem resultado</button>`,
        semConf && `<button type="button" data-hoje="confirmar" class="meio" title="Abre o lembrete para cada uma, uma por vez"><b>${semConf}</b> ${semConf === 1 ? 'entrevista amanhã sem confirmação' : 'entrevistas amanhã sem confirmação'}</button>`,
        aguardam && `<button type="button" data-hoje="pend:semresposta" class="meio" title="Mandou o 1º contato há 2 dias ou mais e a pessoa não respondeu"><b>${aguardam}</b> aguardando resposta</button>`,
        triVelha && `<button type="button" data-hoje="pend:parados3:triagem" class="meio"><b>${triVelha}</b> na triagem há 3+ dias</button>`,
        chHoje && `<button type="button" data-hoje="pend:chegahoje" title="Chegada no campo marcada para hoje"><b>${chHoje}</b> ${chHoje === 1 ? 'chega hoje' : 'chegam hoje'}</button>`,
        chVenc && `<button type="button" data-hoje="pend:chegavencida" class="ruim" title="A data de chegada passou e ninguém marcou se chegou ou faltou"><b>${chVenc}</b> ${chVenc === 1 ? 'chegada passada sem confirmação' : 'chegadas passadas sem confirmação'}</button>`,
        asoHoje && `<button type="button" data-hoje="pend:asohoje"><b>${asoHoje}</b> ASO hoje</button>`,
        asoPassou && `<button type="button" data-hoje="pend:asoatraso" class="ruim"><b>${asoPassou}</b> ASO já passou sem resultado</button>`,
        treAmanha && `<button type="button" data-hoje="pend:treamanha"><b>${treAmanha}</b> ${treAmanha === 1 ? 'treinamento amanhã' : 'treinamentos amanhã'}</button>`,
        prontos && `<button type="button" data-hoje="prontos" class="ok"><b>${prontos}</b> ${prontos === 1 ? 'pronto' : 'prontos'} para admitir</button>`,
        dups && `<button type="button" data-hoje="pend:duplicados" class="meio" title="Mesmo CPF ou telefone em outro candidato deste projeto: confira se é a mesma pessoa"><b>${dups}</b> ${dups === 1 ? 'possível duplicado' : 'possíveis duplicados'}</button>`].filter(Boolean);
      q('#cd-hoje').innerHTML = itens.length && vista !== 'agenda' ? `<span class="cd-hoje-rot">Hoje</span>${itens.join('')}` : '';
      if (vista === 'quadro') desenharQuadro(b); else if (vista === 'lista') desenharLista(); else if (vista === 'agenda') desenharAgenda(b); else desenharPorRh();
    }

    // ---------- AGENDA: entrevistas da semana (o RH vê as dele; quem vê tudo, de todos — e filtra pelo RH no topo) ----------
    const somarDias = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const segundaDe = iso => { const d = new Date(iso + 'T12:00:00'); return somarDias(iso, -((d.getDay() + 6) % 7)); };
    const DIAS_SEM = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const diaMes = iso => `${+iso.slice(8, 10)} ${MESES[+iso.slice(5, 7) - 1]}`;
    function desenharAgenda(b) {
      const hoje = RH.hoje();
      if (!semanaAg) semanaAg = segundaDe(hoje);
      const dias = [0, 1, 2, 3, 4, 5, 6].map(i => somarDias(semanaAg, i));
      const marcadas = b.filter(p => p.entrevista && p.entrevista.data && p.situacao !== 'desistiu');
      const daSemana = marcadas.filter(p => p.entrevista.data >= dias[0] && p.entrevista.data <= dias[6]);
      const semData = b.filter(p => emAndamento(p) && p.etapa === 'entrevista' && !(p.entrevista && p.entrevista.data)).sort((x, y) => x.pessoa.nome.localeCompare(y.pessoa.nome, 'pt-BR'));
      const atrasadas = marcadas.filter(p => emAndamento(p) && p.etapa === 'entrevista' && p.entrevista.data < hoje && (p.entrevista.resultado || 'aguardando') === 'aguardando');
      const mostrarDom = daSemana.some(p => p.entrevista.data === dias[6]);
      const visiveis = mostrarDom ? dias : dias.slice(0, 6);
      const COR = { aprovado: 'ok', reprovado: 'ruim', faltou: 'ruim', aguardando: 'meio' };
      const evento = p => {
        const e = p.entrevista, res = e.resultado || 'aguardando';
        const passou = e.data < hoje && res === 'aguardando' && emAndamento(p);
        const conf = conflitoDe(p);
        return `<button type="button" class="cd-ag-ev cd-ag-${COR[res]}${passou ? ' cd-ag-atraso' : ''}${conf ? ' cd-ag-conf' : ''}" data-id="${p.id}" title="${conf ? 'Mesmo horário que ' + UI.esc(conf.pessoa.nome) + '. ' : ''}Abrir a entrevista de ${UI.esc(p.pessoa.nome)}${e.local ? ' · ' + UI.esc(e.local) : ''}">
          <span class="cd-ag-hora">${e.hora || 'sem hora'}${e.formato ? ' · ' + FORMATOS[e.formato] : ''}${conf ? ' · <em class="cd-ag-conf-tx">conflito</em>' : ''}</span>
          <b class="cd-ag-nome">${UI.esc(p.pessoa.nome)}</b>${semCnh(p.pessoa) ? '<span class="cd-cnh cd-cnh-sem">Sem CNH</span>' : ''}
          <span class="cd-ag-cargo" title="${UI.esc(p.cargo || '')}">${UI.esc(p.cargo || '—')}</span>
          ${seloConfirmou(p) ? `<span class="cd-ag-confirma">${seloConfirmou(p)}</span>` : ''}
          <span class="cd-ag-pe">${veTudo && chaveAnalista(p) ? `<span class="cd-ag-rh">${fotoRh(chaveAnalista(p), 18)}<span>${UI.esc(nomeAnalista(p).split(' ')[0])}</span></span>` : '<span></span>'}<span class="cd-chip cd-chip-${passou ? 'ruim' : COR[res]}">${passou ? 'Sem resultado' : RESULTADOS[res]}</span></span>
        </button>`;
      };
      const ordemHora = (x, y) => String(x.entrevista.hora || '99').localeCompare(String(y.entrevista.hora || '99'));
      const fim = dias[mostrarDom ? 6 : 5];
      q('#cd-corpo').innerHTML = `<div class="cd-ag">
        <div class="cd-ag-topo">
          <div class="cd-ag-nav"><button type="button" class="btn btn-pequeno" data-ag="-7" aria-label="Semana anterior">‹</button><button type="button" class="btn btn-pequeno" data-ag="hoje">Hoje</button><button type="button" class="btn btn-pequeno" data-ag="7" aria-label="Próxima semana">›</button>
            <b class="cd-ag-titulo">${diaMes(dias[0])} – ${diaMes(fim)} ${fim.slice(0, 4)}</b></div>
          <div class="cd-ag-resumo"><span><b>${daSemana.length}</b> ${daSemana.length === 1 ? 'entrevista' : 'entrevistas'} na semana</span>${atrasadas.length ? `<span class="cd-ag-alerta"><b>${atrasadas.length}</b> já passaram sem resultado</span>` : ''}${semData.length ? `<span><b>${semData.length}</b> na Entrevista sem data marcada</span>` : ''}</div>
        </div>
        ${atrasadas.length ? `<div class="cd-aviso cd-ag-aviso"><span><b>${atrasadas.length}</b> ${atrasadas.length === 1 ? 'entrevista passou' : 'entrevistas passaram'} sem resultado — abra e marque Aprovado, Reprovado ou Não compareceu:</span><div class="cd-ag-chips">${atrasadas.sort((x, y) => x.entrevista.data.localeCompare(y.entrevista.data)).map(p => `<button type="button" class="cd-ag-chip cd-ag-chip-ruim" data-id="${p.id}">${UI.esc(p.pessoa.nome)} <span>${RH.fmtDia(p.entrevista.data)}</span></button>`).join('')}</div></div>` : ''}
        <div class="cd-ag-grade" style="--cols:${visiveis.length}">
          ${visiveis.map((d, i) => { const l = daSemana.filter(p => p.entrevista.data === d).sort(ordemHora); return `<div class="cd-ag-dia${d === hoje ? ' hoje' : ''}${d < hoje ? ' passado' : ''}">
            <div class="cd-ag-dcab"><span>${DIAS_SEM[i]}</span><b>${+d.slice(8, 10)}</b>${l.length ? `<em>${l.length}</em>` : ''}</div>
            <div class="cd-ag-lista">${l.map(evento).join('') || '<div class="cd-ag-livre">Livre</div>'}</div></div>`; }).join('')}
        </div>
        ${semData.length ? `<div class="cd-ag-extra"><div class="cd-ag-extra-tit">Na Entrevista sem data marcada <span class="muted">— clique para agendar</span></div><div class="cd-ag-chips">${semData.slice(0, verMais.agenda || 40).map(p => `<button type="button" class="cd-ag-chip" data-id="${p.id}">${veTudo && chaveAnalista(p) ? fotoRh(chaveAnalista(p), 18) : ''}${UI.esc(p.pessoa.nome)}</button>`).join('')}${semData.length > (verMais.agenda || 40) ? `<button type="button" class="btn-link" data-ver-mais="agenda">mostrar mais ${semData.length - (verMais.agenda || 40)}</button>` : ''}</div></div>` : ''}
        ${!marcadas.length && !semData.length ? '<div class="vazio cd-vazio">Nenhuma entrevista ainda. Na ficha do candidato, aba Entrevista, marque a data e o horário — ela aparece aqui.</div>' : ''}
      </div>`;
    }

    // ---------- QUADRO: cartões por etapa ----------
    const DICAS = { triagem: 'Candidaturas recebidas. Ligue, confira o perfil e decida quem segue.', entrevista: 'Agendados ou entrevistados. Aprovou? Avance para a documentação.',
      documentos: 'Aprovados: documentos do cargo, ASO, treinamento e chegada.', admitido: 'Contratados nos últimos 7 dias. A lista completa fica em Contratações.' };
    // Cartão: nome; tipo · cargo · km; rota numa linha; na Documentação a barra dos documentos e os três selos;
    // embaixo o RH (iniciais), UMA ação principal com texto e o menu ⋯ com o resto. Borda esquerda: verde = pronta, vermelha = barrada.
    const iniciais = nome => String(nome || '').trim().split(/\s+/).filter(Boolean).map((x, i, a) => i === 0 || i === a.length - 1 ? x[0] : '').join('').toUpperCase().slice(0, 2);
    function cartao(p) {
      const pe = p.pessoa, origem = nomeCidade(pe.cidade_origem_id), dest = destinoTexto(p), barrada = barradaEm(p);
      const i = ORDEM.indexOf(p.etapa), aberto = emAndamento(p), adm = p.situacao === 'admitido';
      const ent0 = p.entrevista || {};
      const estado = aberto && barrada ? 'cd-st-barrada' : pronta(p) ? 'cd-st-pronta' : adm ? 'cd-st-adm' : !aberto ? 'cd-st-fora'
        : p.etapa === 'triagem' ? (contatoEm(p) ? 'cd-st-contato' : tentativas(p) ? 'cd-st-tentou' : 'cd-st-novo')
        : p.etapa === 'entrevista' ? (ent0.resultado === 'aprovado' ? 'cd-st-pronta' : ent0.resultado === 'faltou' ? 'cd-st-tentou' : ent0.data ? 'cd-st-contato' : '') : '';
      const alertas = [];
      if (aberto && !origem) alertas.push('sem cidade de origem');
      if (aberto && p.etapa === 'documentos' && !pe.cpf) alertas.push('sem CPF');
      if (aberto && veTudo && !chaveAnalista(p)) alertas.push('sem RH');
      if (aberto && rhInativo(p)) alertas.push('RH inativo: redirecione');
      const avV = aberto ? avisoVaga(p) : '', conf = aberto ? conflitoDe(p) : null;
      if (avV) alertas.push(avV);
      const semMov = diasDesde(ultimoMovimento(p));
      if (aberto && p.etapa === 'documentos' && semMov >= 7) alertas.push(`sem movimento há ${semMov} dias`);
      if (aberto && p.etapa === 'documentos' && chegaDepoisDoPrazo(p)) alertas.push('chegada depois do prazo da vaga');
      if (conf) alertas.push(`mesmo horário que ${conf.pessoa.nome.split(' ')[0]}`);
      let doc = '';
      const ent = p.entrevista || {};
      // triagem/entrevista: há quanto tempo está na etapa e tentativas de contato sem resposta
      if (aberto && (p.etapa === 'triagem' || (p.etapa === 'entrevista' && !ent.data))) {
        const d = diasNaEtapa(p), tt = tentativas(p), ct = p.etapa === 'triagem' && contatoEm(p);
        if (d >= 3 || tt || ct) doc = `<div class="cd-chips">${ct ? `<span class="cd-chip cd-chip-ok">1º contato${diaCurto(ct) ? ' ' + diaCurto(ct) : ''}</span>` : ''}${seloSemResposta(p)}${d >= 3 ? `<span class="cd-chip cd-chip-${d >= 7 ? 'ruim' : 'meio'}" title="Há quanto tempo está nesta etapa">há ${d} dias</span>` : ''}${tt ? `<span class="cd-chip cd-chip-meio">${tt === 1 ? '1 ligação sem resposta' : tt + ' ligações sem resposta'}</span>` : ''}</div>`;
      }
      if (aberto && p.etapa === 'entrevista' && ent.data) {
        const cls = { aprovado: 'ok', reprovado: 'ruim', faltou: 'ruim', aguardando: 'meio' }[ent.resultado || 'aguardando'];
        doc = `<div class="cd-chips">${ent.data ? `<span class="cd-chega">Entrevista ${RH.fmtDia(ent.data)}${ent.hora ? ' ' + ent.hora : ''}</span>` : ''}${ent.faltas ? `<span class="cd-chip cd-chip-ruim">${ent.faltas}ª falta</span>` : ''}<span class="cd-chip cd-chip-${cls}">${RESULTADOS[ent.resultado || 'aguardando']}</span>${seloConfirmou(p)}${ent.avaliacao ? `<span class="cd-estrelas" title="Avaliação">${'★'.repeat(+ent.avaliacao)}${'☆'.repeat(5 - ent.avaliacao)}</span>` : ''}</div>`;
      }
      if (aberto && p.etapa === 'documentos') {
        const din = dinamicaDe(p), feitos = din.total - din.pendentes.length, cd = din.completa ? 'ok' : din.recusados.length ? 'ruim' : 'pend';
        doc = `<div class="cd-doc" data-acao="docs" title="${din.completa ? 'Todos os documentos entregues' : UI.esc('Falta: ' + din.pendentes.map(d => d.nome + (d.estado === 'recusado' ? ' (recusado)' : '')).join(', '))}">
            <div class="cd-doc-barra cd-doc-${cd}"><i style="width:${din.total ? Math.round(100 * feitos / din.total) : 0}%"></i></div>
            <div class="cd-chips">
              <button type="button" class="cd-chip cd-chip-${cd}" data-acao="docs">Docs ${feitos}/${din.total}</button>
              <button type="button" class="cd-chip cd-chip-${classeEstado('aso', p.aso)}" data-acao="docs">ASO ${ASO[p.aso].toLowerCase()}</button>
              <button type="button" class="cd-chip cd-chip-${classeEstado('treinamento', p.treinamento)}" data-acao="docs">Treinamento ${TRE[p.treinamento].toLowerCase()}</button>
              ${p.chegada_data ? `<span class="cd-chega">Chega ${RH.fmtDia(p.chegada_data)}</span>` : ''}
            </div></div>${chegadaHtml(p)}`;
      }
      if (adm) doc = chegadaHtml(p, true);
      // ação principal (uma só) e o menu
      let principal = '';
      const menu = [];
      if (podeEditar) {
        if (aberto) {
          if (p.etapa === 'triagem') {
            principal = acaoPrincipal(p, true);
            if (!/data-acao="avancar"/.test(principal)) menu.push('<button type="button" data-acao="avancar">Já falei com a pessoa: Entrevistar →</button>');
            if (semResposta(p) && linkWhats(pe)) menu.push('<button type="button" data-acao="cobrar">Cobrar de novo (WhatsApp)</button>');
          } else if (p.etapa === 'entrevista') {
            const res = (p.entrevista && p.entrevista.resultado) || 'aguardando', temData = p.entrevista && p.entrevista.data;
            principal = acaoPrincipal(p, true);
            if (esperaConfirmar(p)) menu.push(confirmou(p) === 'sim' ? '<button type="button" data-acao="confirmou-desfazer">Ainda não confirmou presença</button>' : '<button type="button" data-acao="confirmou">Confirmou presença</button>');
            if (res !== 'aprovado') menu.push('<button type="button" data-acao="avancar-direto">Aprovado → Documentação</button>');
            if (temData && res === 'aguardando') menu.push('<button type="button" data-acao="agendar">Remarcar entrevista</button>');
          }
          else if (barrada) principal = '<button class="btn btn-pequeno" data-acao="encerrar">Encerrar</button>';
          else principal = pronta(p) ? '<button class="btn btn-pequeno btn-primario" data-acao="admitir" title="Tudo concluído">Admitir</button>' : '<button class="btn btn-pequeno" data-acao="admitir" title="Mostra o que ainda impede a admissão">O que falta</button>';
          if (i > 0) menu.push(`<button type="button" data-acao="voltar">← Voltar para ${ETAPAS[ORDEM[i - 1]]}</button>`);
          if (p.etapa === 'documentos') menu.push('<button type="button" data-acao="docs">Conferir documentos</button>');
          if (p.etapa !== 'documentos' && linkWhats(pe)) menu.push('<button type="button" data-acao="nao-atendeu">Liguei e não atendeu</button>');
          menu.push('<button type="button" data-acao="editar">Abrir a ficha</button>');
          menu.push('<button type="button" class="perigo" data-acao="fora">Não segue no processo</button>');
        } else if (!adm) { principal = '<button class="btn btn-pequeno" data-acao="retomar">Retomar</button>'; menu.push('<button type="button" data-acao="editar">Abrir a ficha</button>'); }
        else menu.push('<button type="button" data-acao="editar">Abrir a ficha</button>', '<button type="button" data-acao="copiar-folha">Copiar dados para a folha (DP)</button>');
        if (adm && RhSafra.podeAvaliar(p, eu)) menu.push(`<button type="button" data-acao="avaliar">${p.avaliacao_recontrataria ? 'Mudar a avaliação de fim de safra' : 'Avaliar (fim de safra)'}</button>`);
      }
      const rh = ultimoAMexer(p);
      const km = p.distancia_km != null && +p.distancia_km > 0 ? `<span class="cd-km">${UI.fmtKm(+p.distancia_km)}</span>` : '';
      const arrasta = podeEditar && !adm;
      // o cartão não é um botão inteiro (tem botões dentro): o nome é o botão que abre a ficha
      return `<div class="cand-card cd-card ${estado} ${arrasta ? 'cd-arrasta' : ''}" data-id="${p.id}" ${arrasta ? 'draggable="true"' : ''}>
        <div class="cd-nome-l"><button type="button" class="cd-nome" data-acao="editar" title="Abrir a ficha de ${UI.esc(pe.nome)}">${UI.esc(pe.nome)}</button>${seloCnh(pe)}${faltouCampo(p) ? '<span class="cd-chip cd-chip-ruim cd-selo-faltou" title="Não chegou ao campo">faltou</span>' : ''}</div>
        ${seloJaTrabalhou(p) || (adm && p.avaliacao_recontrataria) ? `<div class="rhs-selos">${seloJaTrabalhou(p)}${adm ? RhSafra.selo(p) : ''}</div>` : ''}
        <div class="cd-meta">${UI.badgeTipo(p.tipo)}${p.cargo ? `<span class="cd-cargo" title="${UI.esc(p.cargo)}">${UI.esc(p.cargo)}</span>` : ''}${km}</div>
        <div class="cd-rota" title="${UI.esc((origem || 'origem não informada') + ' → ' + (dest || 'destino não definido'))}">${origem ? UI.esc(origem) : '<span class="cd-falta">origem?</span>'} <i>→</i> ${dest ? UI.esc(dest) : '<span class="cd-falta">destino?</span>'}</div>
        ${aberto && seloPrazo(p) ? `<div class="cd-prazo-l">${seloPrazo(p)}</div>` : ''}
        ${adm ? `<div class="cd-sit cd-sit-ok">Admitido em ${RH.fmtDataBR(p.admitido_em)}</div>` : !aberto ? `<div class="cd-sit">${SIT[p.situacao]}${p.motivo_saida || p.observacao ? ': ' + UI.esc(p.motivo_saida || p.observacao) : ''}</div>` : ''}
        ${doc}
        ${podeEditar && sugerirNaoRespondeu(p) ? `<div class="cd-sugere"><span>Já tentou bastante.</span><button type="button" class="btn-link perigo" data-acao="nao-respondeu" title="Abre o 'Não segue no processo' com o motivo: não respondeu">Não segue: não respondeu</button></div>` : ''}
        ${barrada && aberto ? `<div class="cd-sit cd-sit-ruim">${barrada}</div>` : ''}
        ${alertas.length ? `<div class="cd-alertas">${alertas.map(a => `<span>${a}</span>`).join('')}</div>` : ''}
        ${seloDup(p)}
        ${rh || principal || menu.length ? `<div class="cd-pe">${rh}${linkWhats(pe) && podeEditar ? `<button type="button" class="cd-wa" data-acao="mensagem" title="Mandar mensagem pelo WhatsApp" aria-label="Mensagem no WhatsApp"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3a.4.4 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3Z"/></svg></button>` : ''}<span class="espaco"></span>${principal}
          ${menu.length ? `<div class="cd-mais"><button type="button" class="cd-mais-btn" data-acao="menu" aria-label="Mais ações para ${UI.esc(pe.nome)}" aria-haspopup="menu" aria-expanded="false" title="Mais ações">⋯</button><div class="cd-menu" hidden>${menu.join('')}</div></div>` : ''}</div>` : ''}
      </div>`;
    }
    function desenharQuadro(b) {
      const porNome = (x, y) => x.pessoa.nome.localeCompare(y.pessoa.nome, 'pt-BR');
      const col = { triagem: b.filter(p => naEtapa(p, 'triagem')), entrevista: b.filter(p => naEtapa(p, 'entrevista')), documentos: b.filter(p => naEtapa(p, 'documentos')),
        admitido: b.filter(p => p.situacao === 'admitido') };
      // na documentação: quem está pronto para admitir vem primeiro
      col.documentos.sort((x, y) => pronta(y) - pronta(x) || porNome(x, y));
      // triagem e entrevista: a vaga mais urgente primeiro (atrasada, prioridade, data em que precisa)
      for (const k of ['triagem', 'entrevista']) col[k].sort((x, y) => porUrgencia(x, y) || porNome(x, y));
      // Admitidos: no Quadro só quem entrou nos últimos 7 dias (a lista completa fica em Contratações; com a safra seriam centenas)
      const DIAS_ADM = 7, desdeAdm = (() => { const d = new Date(RH.hoje() + 'T12:00:00'); d.setDate(d.getDate() - DIAS_ADM); return d.toISOString().slice(0, 10); })();
      const totalAdm = col.admitido.length;
      col.admitido = col.admitido.filter(p => String(p.admitido_em || '') >= desdeAdm)
        .sort((x, y) => String(y.admitido_em || '').localeCompare(String(x.admitido_em || '')) || porNome(x, y));
      const admNaColuna = col.admitido.slice(0, 6);
      // Não seguiram: os mais recentes primeiro, 30 no Quadro (o resto na Lista)
      const fora = b.filter(p => p.situacao === 'reprovado' || p.situacao === 'desistiu').sort((x, y) => String(y.etapa_em || '').localeCompare(String(x.etapa_em || '')) || porNome(x, y));
      const rot = { ...ETAPAS, admitido: 'Admitidos' };
      // com busca: se a etapa mostrada no celular ficou vazia, pula para a primeira que achou alguém
      if (!colMob || !col[colMob] || (busca && !col[colMob].length)) colMob = ['triagem', 'entrevista', 'documentos', 'admitido'].find(k => col[k].length) || colMob || 'triagem';
      q('#cd-corpo').innerHTML = `<div class="cd-col-sel">${['triagem', 'entrevista', 'documentos', 'admitido'].map(k => `<button type="button" data-col="${k}" class="${k === colMob ? 'ativa' : ''}">${rot[k]} <b>${k === 'admitido' ? totalAdm : col[k].length}</b></button>`).join('')}</div>
        <div class="cd-quadro" data-col="${colMob}">${['triagem', 'entrevista', 'documentos', 'admitido'].map((k, i) => `<div class="coluna cd-coluna" data-etapa="${k}">
          <div class="coluna-cab" title="${UI.esc(DICAS[k])}"><span class="passo-num">${i + 1}</span> ${rot[k]}${k === 'documentos' && col.documentos.some(pronta) ? ` <button type="button" class="cd-prontos" data-ver-prontos title="Ver na Lista quem já pode ser admitido">${col.documentos.filter(pronta).length} pronto${col.documentos.filter(pronta).length > 1 ? 's' : ''} para admitir</button>` : ''}${k === 'admitido' ? ` <span class="muted small cd-adm-sub">últimos ${DIAS_ADM} dias</span>` : ''} <span class="aba-num" ${k === 'admitido' ? 'title="Total de admitidos neste filtro"' : ''}>${k === 'admitido' ? totalAdm : col[k].length}</span></div>
          <div class="cd-coluna-lista">${k === 'admitido'
            ? (admNaColuna.map(cartao).join('') || `<div class="coluna-vazia"><b>${totalAdm ? `Ninguém admitido nos últimos ${DIAS_ADM} dias` : busca || vagaId || distritoId || analista ? 'Ninguém neste filtro' : 'Ninguém aqui'}</b><div class="small">${DICAS[k]}</div></div>`)
              + (totalAdm ? `<div class="cd-adm-rodape">${col.admitido.length > admNaColuna.length ? `+${col.admitido.length - admNaColuna.length} desta semana · ` : ''}${totalAdm === 1 ? '1 admitido' : totalAdm + ' admitidos'} no total${Store.pode(eu, 'cadastro') ? '<button type="button" class="btn btn-pequeno" data-ir-contratacoes>Ver todos em Contratações →</button>' : ''}</div>` : '')
            : (col[k].slice(0, verMais[k] || POR_COLUNA).map(cartao).join('') || `<div class="coluna-vazia"><b>${busca || vagaId || distritoId || analista ? 'Ninguém neste filtro' : 'Ninguém aqui'}</b><div class="small">${DICAS[k]}</div></div>`)
              + (col[k].length > (verMais[k] || POR_COLUNA) ? `<button type="button" class="cd-ver-mais" data-ver-mais="${k}">Mostrar mais ${Math.min(POR_COLUNA, col[k].length - (verMais[k] || POR_COLUNA))} de ${col[k].length - (verMais[k] || POR_COLUNA)} restantes</button>` : '')}</div>
        </div>`).join('')}</div>
        ${podeEditar ? '<div class="cd-solta-fora" data-solta="fora">Solte aqui quem <b>não segue</b> no processo (reprovado ou desistiu)</div>' : ''}
        ${fora.length ? `<details class="cd-fora"><summary>Não seguiram no processo (${fora.length})</summary><div class="kanban kanban-reprovados">${fora.slice(0, 30).map(cartao).join('')}</div>${fora.length > 30 ? `<button type="button" class="cd-ver-mais" data-seg="fora" data-ir-lista>Ver todos os ${fora.length} na Lista</button>` : ''}</details>` : ''}`;
    }

    // ---------- LISTA: conferência de uma etapa por vez ----------
    // Botões de etapa no topo (com contagem). As colunas mudam conforme a etapa; a coluna RH só aparece para quem vê todos.
    function desenharLista() {
      const b = base();
      if (!seg) seg = b.some(p => naEtapa(p, 'documentos')) ? 'documentos' : 'triagem';
      // com busca: se a etapa da Lista ficou vazia, pula para a primeira que achou alguém
      if (busca && !b.some(p => noSeg(p, seg))) { const s1 = SEGS.find(([k]) => b.some(p => noSeg(p, k))); if (s1) { seg = s1[0]; pend = ''; } }
      const todos = daLista(true), lista = daLista(false);
      const segs = `<div class="cd-segs">${SEGS.map(([k, r]) => `<button type="button" class="cd-seg ${seg === k ? 'ativa' : ''}" data-seg="${k}">${r} <span class="aba-num">${UI.fmtNum(b.filter(p => noSeg(p, k)).length)}</span></button>`).join('')}</div>`;
      // segunda linha: pendências (Documentação) e semana de chegada (Documentação e Admitidos)
      let sub = '';
      if (pend && !pendDaEtapa(pend, seg)) pend = '';
      // filtros de pendência da etapa (os "soLink" só aparecem quando vieram do Início)
      const pendsSeg = Object.entries(PEND).filter(([k, f]) => pendDaEtapa(k, seg) && (!f.soLink || pend === k));
      if (pendsSeg.some(([k, f]) => pend === k || todos.some(f.teste))) {
        sub += `<div class="cd-pends"><button type="button" class="cd-pend ${!pend ? 'ativa' : ''}" data-pend="">Todos <b>${todos.length}</b></button>${pendsSeg.map(([k, f]) => { const n = todos.filter(f.teste).length; return n || pend === k ? `<button type="button" class="cd-pend ${pend === k ? 'ativa' : ''} ${['menores', 'barradas', 'docsrec', 'semcpf', 'semnasc', 'asoatraso', 'faltaram', 'chegavencida', 'semresultado'].includes(k) ? 'cd-pend-ruim' : k === 'prontas' ? 'cd-pend-bom' : ''}" data-pend="${k}" aria-pressed="${pend === k}">${f.rotulo} <b>${n}</b></button>` : ''; }).join('')}</div>`;
      }
      if (seg === 'documentos' || seg === 'admitido') {
        const cont = new Map(); let sem = 0;
        for (const p of b.filter(x => noSeg(x, seg))) { if (!p.chegada_data) { sem++; continue; } const s = RH.segundaDaSemana(p.chegada_data); cont.set(s, (cont.get(s) || 0) + 1); }
        if (semana !== 'todas' && semana !== 'sem' && !cont.has(semana)) semana = 'todas';
        const fim = s => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 6); return RH.fmtDia(d.toISOString().slice(0, 10)); };
        if (cont.size) sub += `<label class="cd-filtro cd-filtro-sem">Chegada<select id="cd-semana"><option value="todas">Qualquer data</option>${[...cont.keys()].sort().map(s => `<option value="${s}" ${s === semana ? 'selected' : ''}>${RH.fmtDia(s)} a ${fim(s)} (${cont.get(s)})</option>`).join('')}${sem ? `<option value="sem" ${semana === 'sem' ? 'selected' : ''}>Sem data (${sem})</option>` : ''}</select></label>`;
      }
      // admitidos: a lista da tela vai pronta para a folha/DP (cola no Excel)
      if (seg === 'admitido' && podeEditar && lista.length) {
        const aAvaliar = lista.filter(p => !p.avaliacao_recontrataria && RhSafra.podeAvaliar(p, eu)).length;
        sub += `<span class="rhs-sub-acoes">${aAvaliar ? `<button type="button" class="btn btn-pequeno" data-avaliar-lote title="Uma pessoa por vez: Sim, Talvez ou Não">Avaliar em lote (${aAvaliar})</button>` : ''}`
          + `<button type="button" class="btn btn-pequeno" data-planilha-dp title="Planilha de pré-cadastro de admissão (eSocial) de quem está na tela: o que o sistema tem já vem preenchido, o resto o DP completa. Sem dados bancários.">Planilha para o DP (eSocial)</button>`
          + `<button type="button" class="btn btn-pequeno" data-copiar-folha title="Copia nome, CPF, nascimento, cargo, distrito, admissão e chegada de quem está na tela, em colunas (cole no Excel ou mande para o DP)">Copiar para a folha (${lista.length})</button></span>`;
      }
      // ordenação por etapa
      const ts = x => new Date(x || 0).getTime();
      if (seg === 'triagem' || seg === 'entrevista') lista.sort((x, y) => porUrgencia(x, y) || ts(desdeEtapa(x)) - ts(desdeEtapa(y)) || x.pessoa.nome.localeCompare(y.pessoa.nome, 'pt-BR'));
      else if (seg === 'documentos') lista.sort((x, y) => (x.chegada_data || '9999').localeCompare(y.chegada_data || '9999') || bloqueios(y).length - bloqueios(x).length || x.pessoa.nome.localeCompare(y.pessoa.nome, 'pt-BR'));
      else if (seg === 'admitido') lista.sort((x, y) => String(y.admitido_em || '').localeCompare(String(x.admitido_em || '')) || x.pessoa.nome.localeCompare(y.pessoa.nome, 'pt-BR'));
      else lista.sort((x, y) => ts(desdeEtapa(y)) - ts(desdeEtapa(x)));
      const limite = verMais.lista || 50, vis = lista.slice(0, limite);
      // seleção em lote: só nas etapas em andamento, e só dentro da etapa na tela
      const loteOk = podeEditar && ['triagem', 'entrevista', 'documentos'].includes(seg);
      for (const i of [...marcados]) if (!lista.some(p => p.id === i)) marcados.delete(i);
      const todosMarcados = loteOk && vis.length && vis.every(p => marcados.has(p.id));
      const barraLote = loteOk && marcados.size ? `<div class="cd-lote"><b>${qtd(marcados.size, 'selecionado', 'selecionados')}</b>
          ${seg !== 'documentos' ? `<button class="btn btn-pequeno btn-primario" data-lote="avancar">Avançar para ${ETAPAS[ORDEM[ORDEM.indexOf(seg) + 1]]}</button>` : ''}
          <button class="btn btn-pequeno" data-lote="mensagem" title="Abre o WhatsApp de uma pessoa por vez, com o texto pronto">Mandar mensagem</button>
          ${veTudo ? '<button class="btn btn-pequeno" data-lote="direcionar">Direcionar para um RH</button>' : ''}
          <button class="btn btn-pequeno" data-lote="fora">Não seguem</button>
          <button class="btn-link" data-lote="limpar">Limpar seleção</button></div>` : '';
      // colunas por etapa
      const rhCol = veTudo ? ['RH'] : [];
      const COLS = {
        fila: { cab: ['Pessoa', 'De onde vem → para onde vai', 'Vaga / cargo', seg === 'triagem' ? 'Contato' : 'Entrevista'].concat(rhCol, ['']), grade: `minmax(0,1.5fr) minmax(0,1.3fr) minmax(0,1fr) 150px${veTudo ? ' minmax(90px,.7fr)' : ''} 230px` },
        documentos: { cab: ['Pessoa', 'De onde vem → para onde vai', 'Documentos', 'ASO', 'Treinamento', 'Chegada'].concat(rhCol, ['']), grade: `minmax(0,1.5fr) minmax(0,1.3fr) 150px 130px 130px 128px${veTudo ? ' minmax(80px,.6fr)' : ''} 150px` },
        admitido: { cab: ['Pessoa', 'De onde vem → onde trabalha', 'Vaga / cargo', 'Admitido em', 'Chegada', 'Fim de safra'].concat(rhCol, ['']), grade: `minmax(0,1.5fr) minmax(0,1.3fr) minmax(0,1fr) 100px 120px 118px${veTudo ? ' minmax(80px,.6fr)' : ''} 130px` },
        fora: { cab: ['Pessoa', 'Parou na etapa', 'O que aconteceu', 'Quando'].concat(rhCol, ['']), grade: `minmax(0,1.5fr) 140px minmax(0,1.6fr) 100px${veTudo ? ' minmax(90px,.7fr)' : ''} 150px` }
      };
      const modo = seg === 'triagem' || seg === 'entrevista' ? 'fila' : seg;
      const cfg = COLS[modo];
      const marca = p => loteOk ? `<button type="button" class="cd-marca ${marcados.has(p.id) ? 'on' : ''}" data-marca="${p.id}" aria-label="Selecionar ${UI.esc(p.pessoa.nome)}" aria-pressed="${marcados.has(p.id)}"></button>` : '';
      const vagaTxt = p => { const v = vagaDe(p.vaga_id) || (p.vaga_id && Store.vaga(p.vaga_id)); return `${v ? `<div class="pre-rota">${UI.esc(v.titulo)}</div>` : '<div class="pre-rota muted">sem vaga</div>'}${p.cargo && (!v || p.cargo !== v.titulo) ? `<div class="pre-sub">${UI.esc(p.cargo)}</div>` : ''}${seloPrazo(p) ? `<div class="cd-prazo-l">${seloPrazo(p)}</div>` : ''}`; };
      const celRh = p => veTudo ? `<div class="pre-cel pre-uma pre-analista" data-rot="RH" title="${UI.esc(nomeAnalista(p))}">${chaveAnalista(p) ? `<span class="com-avatar">${fotoRh(p.analista_login, 24)}<span>${UI.esc(nomeAnalista(p).split(' ')[0])}</span></span>` : `<span class="pre-falta" title="${UI.esc(p.analista ? 'Na planilha: ' + p.analista : '')}">sem RH</span>`}</div>` : '';
      const editar = '<button class="btn-link" data-acao="editar">Abrir</button>';
      function quem(p) {
        const pe = p.pessoa, tel = RH.soDigitos(pe.telefone), noDoc = seg === 'documentos';
        const al = [];
        if (!pe.cpf && noDoc) al.push(['sem CPF', 1]);
        if (!pe.nascimento && noDoc) al.push(['sem nascimento', 1]);
        if (menor(p)) al.push([`menor de idade (${RH.idade(pe.nascimento)})`, 1]);
        if (noDoc && emAndamento(p) && chegaDepoisDoPrazo(p)) al.push(['chegada depois do prazo da vaga', 1]);
        if (noDoc && emAndamento(p) && diasDesde(ultimoMovimento(p)) >= 7) al.push([`sem movimento há ${diasDesde(ultimoMovimento(p))} dias`, 0]);
        if (barradaEm(p) && emAndamento(p)) al.push([barradaEm(p), 1]);
        if (!pe.cidade_origem_id) al.push(['sem cidade de origem', 0]);
        if (faltouCampo(p)) al.push(['faltou na chegada', 1]);
        if (pe.ex_colaborador) al.push(['ex-colaborador', 2]);
        if (semCnh(pe)) al.push(['sem CNH', 1]);
        return `<div class="pre-cel pre-quem">
            <div class="pre-nome">${marca(p)}${UI.esc(pe.nome)}</div>
            <div class="pre-sub">${pe.cpf ? RH.fmtCPF(pe.cpf) : '<span class="muted">sem CPF</span>'}${pe.telefone ? ` · ${tel.length >= 10 && podeEditar ? `<button type="button" class="btn-link cd-tel" data-acao="mensagem" title="Mandar mensagem pelo WhatsApp">${UI.esc(pe.telefone)}</button>` : tel.length >= 10 ? `<a href="https://wa.me/55${tel}" target="_blank" rel="noopener">${UI.esc(pe.telefone)}</a>` : UI.esc(pe.telefone)}` : ''}</div>
            ${al.length ? `<div class="cd-alertas">${al.map(([x, g]) => `<span class="${g === 1 ? 'cd-al-ruim' : g === 2 ? 'cd-al-info' : ''}">${UI.esc(x)}</span>`).join('')}</div>` : ''}
            ${seloJaTrabalhou(p) ? `<div class="rhs-selos">${seloJaTrabalhou(p)}</div>` : ''}
            ${seloDup(p)}
          </div>`;
      }
      const rota = p => `<div class="pre-cel pre-onde"><div class="pre-rota">${nomeCidade(p.pessoa.cidade_origem_id) ? UI.esc(nomeCidade(p.pessoa.cidade_origem_id)) : '<span class="pre-falta">falta a origem</span>'} <span class="muted">→</span> ${destinoTexto(p) ? UI.esc(destinoTexto(p)) : '<span class="pre-falta">falta o destino</span>'}</div>
          <div class="pre-sub">${p.tipo === 'MOVEL' ? 'Móvel' : 'Local'}${p.distancia_km != null && +p.distancia_km > 0 ? ` · ${UI.fmtKm(+p.distancia_km)}` : ''}${p.unidade ? ' · ' + UI.esc(p.unidade) : ''}</div></div>`;
      const dias = n => n == null ? '—' : n === 0 ? 'hoje' : n === 1 ? '1 dia' : `${n} dias`;
      function linha(p) {
        const i = ORDEM.indexOf(p.etapa);
        let cel = '', acoes = '', faixa = '';
        if (modo === 'fila') {
          const d = diasDesde(desdeEtapa(p));
          const e = p.entrevista || {}, ct = contatoEm(p), tt = tentativas(p);
          const sit = p.etapa === 'triagem'
            ? (ct ? `<span class="cd-chip cd-chip-ok">1º contato${diaCurto(ct) ? ' ' + diaCurto(ct) : ''}</span>` : '<span class="cd-chip cd-chip-meio">sem contato</span>') + (tt ? `<div class="pre-sub">${tt === 1 ? '1 ligação sem resposta' : tt + ' ligações sem resposta'}</div>` : '')
              + (semResposta(p) ? `<div class="cd-sel-l">${seloSemResposta(p)}${podeEditar && linkWhats(p.pessoa) ? ' <button type="button" class="btn-link" data-acao="cobrar">Cobrar de novo</button>' : ''}</div>` : '')
            : e.data ? `<b>${RH.fmtDia(e.data)}${e.hora ? ' ' + e.hora : ''}</b><div class="pre-sub">${RESULTADOS[e.resultado || 'aguardando']}${e.faltas ? ` · ${e.faltas}ª falta` : ''}</div>${seloConfirmou(p) ? `<div class="cd-sel-l">${seloConfirmou(p)}</div>` : ''}` : '<span class="cd-chip cd-chip-meio">sem data</span>';
          cel = rota(p) + `<div class="pre-cel" data-rot="Vaga">${vagaTxt(p)}</div><div class="pre-cel" data-rot="${p.etapa === 'triagem' ? 'Contato' : 'Entrevista'}">${sit}<div class="pre-sub ${d >= 7 ? 'cd-velho' : ''}">na etapa ${d === 0 ? 'desde hoje' : 'há ' + dias(d)}</div></div>`;
          if (podeEditar) acoes = `${acaoPrincipal(p)}${sugerirNaoRespondeu(p) ? '<button class="btn-link perigo" data-acao="nao-respondeu" title="Já tentou bastante: não segue no processo, com o motivo &quot;não respondeu&quot;">Não respondeu</button>' : '<button class="btn-link perigo" data-acao="fora">Não segue</button>'}${editar}`;
        } else if (modo === 'documentos') {
          const din = dinamicaDe(p), classeDin = din.completa ? 'ok' : din.recusados.length ? 'ruim' : 'pend';
          const rotDocs = din.completa ? 'Completa' : `${din.total - din.pendentes.length} de ${din.total}`;
          const etapaCel = (campo, rotulo) => `<div class="pre-cel" data-rot="${rotulo}">${podeEditar
            ? `<select class="pre-st pre-st-${classeEstado(campo, p[campo])}" data-campo="${campo}" aria-label="${rotulo}">${opcoes(OPCOES[campo], p[campo])}</select>`
            : `<span class="pre-st-txt pre-st-${classeEstado(campo, p[campo])}">${OPCOES[campo][p[campo]]}</span>`}${campo === 'aso' && p.aso_data ? `<span class="pre-nota${p.aso === 'agendado' && p.aso_data < RH.hoje() ? ' cd-velho' : ''}" title="${UI.esc(p.aso_local || '')}">${RH.fmtDia(p.aso_data)}</span>` : ''}${campo === 'treinamento' && p.treinamento === 'agendado' && p.treinamento_data ? `<span class="pre-nota" title="${UI.esc(p.treinamento_local || '')}">${RH.fmtDia(p.treinamento_data)}</span>` : ''}</div>`;
          cel = rota(p) + `<div class="pre-cel" data-rot="Documentos">${podeEditar ? `<button type="button" class="pre-st pre-din pre-st-${classeDin}" data-acao="docs">${rotDocs}${din.completa ? '' : ' entregues'}</button>` : `<span class="pre-st-txt pre-st-${classeDin}">${rotDocs}</span>`}</div>`
            + etapaCel('aso', 'ASO') + etapaCel('treinamento', 'Treinamento')
            + `<div class="pre-cel" data-rot="Chegada">${p.chegada_data ? `${RH.fmtDia(p.chegada_data)}${p.chegada_hora ? ` <span class="muted">${p.chegada_hora.slice(0, 5)}</span>` : ''}${chegadaHtml(p)}` : '<span class="muted">—</span>'}</div>`;
          if (podeEditar) acoes = barradaEm(p) ? `<button class="btn btn-pequeno" data-acao="encerrar">Encerrar</button>${editar}`
            : pronta(p) ? `<button class="btn btn-pequeno btn-primario" data-acao="admitir">Admitir</button>${editar}`
            : `<button class="btn btn-pequeno" data-acao="admitir" title="Mostra o que ainda falta">O que falta</button>${editar}`;
          // o que falta, escrito (não só no passar do mouse)
          const b2 = bloqueios(p).filter(x => !/^ainda está/.test(x));
          const faltaDocs0 = din.pendentes.map(d => d.nome + (d.estado === 'recusado' ? ' (recusado)' : ''));
          const faltaDocs = faltaDocs0.length > 5 ? faltaDocs0.slice(0, 5).concat(`e mais ${faltaDocs0.length - 5} documentos`) : faltaDocs0;
          if (b2.length && !barradaEm(p)) faixa = `<div class="pre-docs-faixa cd-faixa-falta"><b>Falta:</b> ${UI.esc(b2.filter(x => !/documento/.test(x)).concat(faltaDocs).join(' · '))}</div>`;
        } else if (modo === 'admitido') {
          cel = rota(p) + `<div class="pre-cel" data-rot="Vaga">${vagaTxt(p)}</div><div class="pre-cel pre-uma" data-rot="Admitido em">${RH.fmtDataBR(p.admitido_em)}</div>`
            + `<div class="pre-cel" data-rot="Chegada">${p.chegada_data ? RH.fmtDia(p.chegada_data) + chegadaHtml(p) : '<span class="muted">—</span>'}</div>`
            + `<div class="pre-cel" data-rot="Fim de safra">${RhSafra.podeAvaliar(p, eu)
              ? (p.avaliacao_recontrataria ? `<button type="button" class="rhs-selo-b" data-acao="avaliar" title="Mudar a avaliação">${RhSafra.selo(p, true)}</button>` : '<button type="button" class="btn btn-pequeno" data-acao="avaliar" title="Recontrataria na próxima safra?">Avaliar</button>')
              : (RhSafra.selo(p, true) || '<span class="muted">—</span>')}</div>`;
          if (podeEditar) acoes = `<button class="btn-link perigo" data-acao="desfazer">Desfazer</button>${editar}`;
        } else {
          cel = `<div class="pre-cel pre-uma" data-rot="Parou na">${ETAPAS[p.etapa] || '—'}</div><div class="pre-cel" data-rot="O que aconteceu"><b class="${p.situacao === 'desistiu' ? 'cd-desistiu' : 'cd-reprovado'}">${SIT[p.situacao]}</b>${p.motivo_saida ? `<div class="pre-sub">${UI.esc(p.motivo_saida)}</div>` : ''}${p.observacao ? `<div class="pre-sub">${UI.esc(p.observacao)}</div>` : ''}</div>`
            + `<div class="pre-cel pre-uma" data-rot="Quando">${p.etapa_em ? RH.fmtDataBR(String(p.etapa_em).slice(0, 10)) : '—'}</div>`;
          if (podeEditar) acoes = `<button class="btn-link" data-acao="retomar">Retomar</button>${editar}`;
        }
        if (!podeEditar) acoes = editar;
        return `<div class="pre-pessoa ${pronta(p) ? 'cd-l-pronta' : ''} ${barradaEm(p) && emAndamento(p) ? 'cd-l-barrada' : ''}" data-id="${p.id}"><div class="pre-grade">${quem(p)}${cel}${celRh(p)}<div class="pre-cel pre-acoes nao-imprimir">${acoes}</div>${faixa}</div></div>`;
      }
      // na Documentação: blocos Prontos / Com pendência / Inaptos
      let corpo;
      if (modo === 'documentos' && !pend) {
        const blocos = [['Prontos para admitir', vis.filter(pronta), 'bom'], ['Com pendência', vis.filter(p => !pronta(p) && !barradaEm(p)), ''], ['Inaptos ou reprovados: encerrar', vis.filter(p => !!barradaEm(p)), 'ruim']];
        corpo = blocos.filter(x => x[1].length).map(([tit, l, c]) => `<div class="cd-bloco cd-bloco-${c}">${tit} <span class="aba-num">${l.length}</span></div>` + l.map(linha).join('')).join('');
      } else corpo = vis.map(linha).join('');
      q('#cd-corpo').innerHTML = `<div class="cd-lista-top">${segs}${sub ? `<div class="cd-lista-sub">${sub}</div>` : ''}</div>` + barraLote +
        (!lista.length ? `<div class="vazio cd-vazio">${todos.length ? 'Ninguém com esse filtro.' : `Ninguém em ${SEGS.find(x => x[0] === seg)[1]}${busca || vagaId || distritoId || analista ? ' com os filtros de cima' : ''}.`}${busca || vagaId || distritoId || analista || pend ? '<br><button class="btn-link" data-limpar>Limpar filtros e busca</button>' : ''}</div>`
          : `<div class="pre-lista cd-lista" style="--cols:${cfg.grade}"><div class="pre-grade pre-cab">${cfg.cab.map((c, i) => `<span>${i === 0 && loteOk ? `<button type="button" class="cd-marca ${todosMarcados ? 'on' : ''}" data-marca="*" title="Marcar todos desta tela" aria-label="Selecionar todos desta tela" aria-pressed="${!!todosMarcados}"></button>` : ''}${c}</span>`).join('')}</div>${corpo}</div>`
          + (lista.length > limite ? `<button type="button" class="cd-ver-mais cd-ver-mais-lista" data-ver-mais="lista">Mostrar mais ${Math.min(50, lista.length - limite)} de ${lista.length - limite} restantes</button>` : ''));
      const sem = q('#cd-semana'); if (sem) sem.addEventListener('change', e => { semana = e.target.value; desenhar(); });
    }

    // ---------- ações em lote (Lista) ----------
    async function emLote(acao) {
      const sel = linhas.filter(p => marcados.has(p.id) && emAndamento(p));
      if (acao === 'limpar') { marcados.clear(); return desenhar(); }
      if (!sel.length) return;
      if (acao === 'direcionar') { analista = ''; return direcionarIds(sel.map(p => p.id)); }
      if (acao === 'mensagem') return mensagemEmLote(sel);
      if (acao === 'fora') {
        UI.modal({ titulo: `${qtd(sel.length, 'pessoa não segue', 'pessoas não seguem')} no processo`, largura: '460px',
          corpo: `<label>Motivo (vale para todos)<select id="ns-mot">${MOTIVOS_SAIDA.map(([sit, m]) => `<option value="${sit}|${m}">${m}</option>`).join('')}</select></label>
            <label style="margin-top:10px">Detalhe (opcional)<input id="ns-obs" placeholder="Ex.: vaga preenchida por outro candidato"></label>
            <p class="muted small" style="margin-bottom:0">Saem do quadro e ficam em "Não seguiram", com o motivo anotado no histórico de cada um. Dá para retomar depois.</p>`,
          botoes: [{ texto: 'Cancelar' }, { texto: 'Confirmar', classe: 'btn-primario', acao: async md => {
            const [sit, mot] = md.corpo.querySelector('#ns-mot').value.split('|'), det = md.corpo.querySelector('#ns-obs').value.trim(), motivo = mot + (det ? ' — ' + det : '');
            await Nuvem.rh.atualizarVarios(sel.map(p => p.id), { situacao: sit, motivo_saida: motivo }); sel.forEach(p => { p.situacao = sit; p.motivo_saida = motivo; });
            marcados.clear(); desenhar(); UI.toast(`${qtd(sel.length, 'pessoa guardada', 'pessoas guardadas')} em "Não seguiram".`, 'sucesso');
            Promise.all(sel.map(p => anotarAuto(p, `Não segue no processo: ${motivo}`))).then(desenhar);   // histórico de cada um, sem segurar a janela
          } }] });
        return;
      }
      // avançar: cada um vai para a etapa seguinte à sua (quem já está na Documentação fica: a admissão é uma por uma)
      const grupos = {};
      for (const p of sel) { const i = ORDEM.indexOf(p.etapa); if (i >= 0 && i < ORDEM.length - 1) (grupos[ORDEM[i + 1]] = grupos[ORDEM[i + 1]] || []).push(p); }
      const n = Object.values(grupos).reduce((a, l) => a + l.length, 0);
      if (!n) { UI.toast('Quem está na Documentação é admitido um por um, pelo botão Admitir (só quando tudo estiver entregue).', 'aviso', 5000); return; }
      // para a Documentação: define vaga, distrito e LOCAL/MÓVEL de cada um antes
      if (grupos.documentos && !grupos.entrevista) return enquadrarLote(grupos.documentos);
      const soEnt = grupos.entrevista && !grupos.documentos;
      if (!await UI.confirmar(soEnt ? `Avançar ${qtd(n, 'pessoa', 'pessoas')} para a Entrevista? ${n === 1 ? 'Ela entra' : 'Elas entram'} SEM DATA marcada: depois é só agendar cada uma na Agenda de entrevistas.`
        : `Avançar ${qtd(n, 'pessoa', 'pessoas')} para a etapa seguinte? ${Object.entries(grupos).map(([k, l]) => `${l.length} → ${ETAPAS[k]}`).join(', ')}.`, { textoOk: 'Avançar' })) return;
      try {
        for (const [k, l] of Object.entries(grupos)) { await Nuvem.rh.atualizarVarios(l.map(p => p.id), { etapa: k }); l.forEach(p => { p.etapa = k; }); }
        marcados.clear(); UI.toast(`${qtd(n, 'pessoa avançou', 'pessoas avançaram')} de etapa.${soEnt ? ' Agende as entrevistas na lista "sem data marcada", embaixo da Agenda.' : ''}`, 'sucesso', soEnt ? 6000 : 3500);
        if (soEnt) { semanaAg = null; mudarVista('agenda'); } else desenhar();
      } catch (err) { UI.toast(err.message, 'erro', 6000); await carregar(); }
    }

    // ---------- POR RH: uma linha por RH, para o gestor cobrar ----------
    // Vagas (admitidos/pedido das vagas em que ele é o responsável) · pessoas por etapa · pendências · parado há · admitidos · não seguiram · conversão.
    // Cada número abre a Lista daquela etapa já filtrada pelo RH; o nome abre o Quadro.
    function contarVagas() {
      const cont = {};
      for (const p of linhas) {
        if (!p.vaga_id || (p.situacao !== 'admitido' && p.situacao !== 'em_andamento')) continue;
        const c = cont[p.vaga_id] || (cont[p.vaga_id] = { candidatos: 0, admitidos: 0, emProcesso: 0, etapas: { triagem: 0, entrevista: 0, documentos: 0 }, dist: {} });
        const d = c.dist[p.distrito_id || '(sem)'] || (c.dist[p.distrito_id || '(sem)'] = { LOCAL: { adm: 0, proc: 0 }, MOVEL: { adm: 0, proc: 0 } });
        const tp = d[p.tipo === 'MOVEL' ? 'MOVEL' : 'LOCAL'];
        c.candidatos++; if (p.situacao === 'admitido') { c.admitidos++; tp.adm++; } else { c.emProcesso++; tp.proc++; c.etapas[p.etapa]++; }
      }
      if (veTudo) Store.definirContagemVagas(cont);   // só quem vê todos tem a contagem completa
    }
    function desenharPorRh() {
      contarVagas();
      const b = base({ semAnalista: true });
      const grupos = new Map();
      const grupo = (k, nome) => { if (!grupos.has(k)) grupos.set(k, { k, nome, triagem: 0, entrevista: 0, documentos: 0, prontas: 0, pend: 0, admitido: 0, fora: 0, parado: null, pedido: 0, admV: 0, vagas: 0 }); return grupos.get(k); };
      for (const p of b) {
        const g = grupo(chaveAnalista(p) || '(sem)', nomeAnalista(p) || 'Sem RH responsável');
        if (p.situacao === 'admitido') g.admitido++;
        else if (!emAndamento(p)) g.fora++;
        else {
          g[p.etapa]++;
          if (p.etapa === 'documentos') { if (pronta(p)) g.prontas++; else g.pend++; }
          const d = diasDesde(desdeEtapa(p)); if (d != null && (g.parado == null || d > g.parado)) g.parado = d;
        }
      }
      // vagas em que o RH é o responsável (respeitando os filtros de vaga e distrito)
      for (const v of vagasProjeto()) {
        if (!v.recrutadorLogin || v.status === 'cancelada' || (vagaId && vagaId !== '(sem)' && v.id !== vagaId)) continue;
        const partes = distritoId && distritoId !== '(sem)' ? v.porDistrito.filter(x => x.distrito.id === distritoId) : null;
        const ped = partes ? partes.reduce((n, x) => n + x.locais + x.moveis, 0) : v.quantidade;
        if (!ped) continue;
        const adm = partes ? partes.reduce((n, x) => n + Math.min(x.admLoc, x.locais) + Math.min(x.admMov, x.moveis), 0) : Math.min(v.admitidos, v.quantidade);
        const g = grupo(v.recrutadorLogin, (Store.usuarioPorLogin(v.recrutadorLogin) || {}).nome || v.recrutador || v.recrutadorLogin);
        g.pedido += ped; g.admV += adm; g.vagas++;
      }
      const lista = [...grupos.values()].sort((x, y) => (y.k === '(sem)') - (x.k === '(sem)') || x.nome.localeCompare(y.nome, 'pt-BR'));
      if (!lista.length) { q('#cd-corpo').innerHTML = '<div class="vazio cd-vazio">Ninguém neste filtro.</div>'; return; }
      const soma = k => lista.reduce((n, g) => n + (g[k] || 0), 0);
      const n = (val, ir, cls = '') => val ? `<button type="button" class="cd-rh-num ${cls}" data-ir="${ir}" title="Ver na Lista">${UI.fmtNum(val)}</button>` : '<span class="cd-zero">0</span>';
      const conv = g => g.admitido + g.fora >= 5 ? Math.round(100 * g.admitido / (g.admitido + g.fora)) + '%' : '—';
      const vagaCel = g => g.pedido ? `<div class="cd-rh-vaga"><span><b>${g.admV}</b> de ${g.pedido}</span><div class="dr-barra ${g.admV >= g.pedido ? 'dr-ok' : ''}"><i style="width:${Math.max(2, Math.round(100 * g.admV / g.pedido))}%"></i></div><small>${g.admV >= g.pedido ? 'completo' : `faltam ${g.pedido - g.admV}`}</small></div>` : '<span class="cd-zero">—</span>';
      const linha = g => `<div class="cd-rh-grade cd-rh-linha ${g.k === '(sem)' ? 'cd-rh-sem' : ''}" data-rh="${UI.esc(g.k)}">
          <div class="cd-rh-nome"><button type="button" class="cd-rh-quem com-avatar" data-rh-nome title="Ver o quadro deste RH">${g.k === '(sem)' ? '' : fotoRh(g.k, 32)}<span>${UI.esc(g.nome)}</span></button>${g.k === '(sem)' ? (g.triagem + g.entrevista + g.documentos && podeEditar ? '<button class="btn btn-pequeno" data-direcionar>Direcionar</button>' : '') : `<span class="muted small">${g.vagas ? qtd(g.vagas, 'vaga', 'vagas') : 'nenhuma vaga como responsável'}</span>`}</div>
          ${vagaCel(g)}${n(g.triagem, 'triagem')}${n(g.entrevista, 'entrevista')}
          <div class="cd-rh-doc">${n(g.documentos, 'documentos')}${g.prontas ? `<small class="cd-bom">${g.prontas} pronto${g.prontas > 1 ? 's' : ''}</small>` : ''}</div>
          ${n(g.pend, 'pend', 'cd-rh-alerta')}
          <span class="${g.parado >= 7 ? 'cd-velho' : ''}">${g.parado == null ? '—' : g.parado === 0 ? 'hoje' : g.parado + ' d'}</span>
          ${n(g.admitido, 'admitido', 'cd-bom')}${n(g.fora, 'fora')}<span>${conv(g)}</span></div>`;
      const tot = { admitido: soma('admitido'), fora: soma('fora') };
      q('#cd-corpo').innerHTML = `<div class="cd-rh">
        <div class="cd-rh-grade cd-rh-cab"><span>RH</span><span>Vagas: admitidos / pedido</span><span>Triagem</span><span>Entrevista</span><span>Documentação</span><span title="Na Documentação e ainda sem poder admitir">Com pendência</span><span title="Há quanto tempo está na etapa quem está parado há mais tempo">Parado há</span><span>Admitidos</span><span>Não seguiram</span><span title="Admitidos ÷ (admitidos + não seguiram)">Aproveitamento</span></div>
        ${lista.map(linha).join('')}
        <div class="cd-rh-grade cd-rh-total"><div>Total</div>${vagaCel({ pedido: soma('pedido'), admV: soma('admV') })}<span>${soma('triagem')}</span><span>${soma('entrevista')}</span><span>${soma('documentos')}</span><span>${soma('pend')}</span><span></span><span>${tot.admitido}</span><span>${tot.fora}</span><span>${conv(tot)}</span></div>
        <p class="muted small cd-rh-nota">As vagas contam pelo responsável da vaga; as pessoas, pelo RH a quem cada uma foi direcionada. "Parado há" é o tempo na etapa atual de quem está esperando há mais tempo (7 dias ou mais fica em vermelho). Clique num número para ver as pessoas; no nome, para ver o quadro.</p>
      </div>`;
    }

    // ---------- mudanças de etapa ----------
    async function gravar(p, campos, msg) {
      const antes = Object.fromEntries(Object.keys(campos).map(k => [k, p[k]]));
      Object.assign(p, campos); desenhar();
      try { await Nuvem.rh.atualizar(p.id, campos); if (msg) UI.toast(msg, 'sucesso', 3000); return true; }
      catch (err) { Object.assign(p, antes); desenhar(); UI.toast(/unica_aberta|duplicate/.test(err.message) ? 'Esta pessoa já tem outro processo em andamento neste projeto.' : err.message, 'erro', 6000); return false; }
    }
    const avancar = p => { const i = ORDEM.indexOf(p.etapa); if (i < 0 || i >= ORDEM.length - 1) return; if (ORDEM[i + 1] === 'documentos') return enquadrar(p); if (ORDEM[i + 1] === 'entrevista') return agendar(p, false); gravar(p, { etapa: ORDEM[i + 1] }, `${p.pessoa.nome}: ${ETAPAS[ORDEM[i + 1]]}.`); };
    // Agendar a entrevista: data, hora, formato e local; avisa conflito com outra entrevista do mesmo RH e já monta a mensagem do WhatsApp.
    // remarcar = quem faltou: conta a falta e limpa o resultado.
    function agendar(p, remarcar) {
      const e = p.entrevista || {}, faltou = remarcar && e.resultado === 'faltou';
      const m = UI.modal({ titulo: `${remarcar ? 'Remarcar' : 'Agendar'} entrevista de ${p.pessoa.nome}`, largura: '520px',
        corpo: `${faltou ? `<div class="caixa caixa-aviso" style="margin-top:0">Não compareceu em ${RH.fmtDia(e.data)}${e.faltas ? ` (${e.faltas + 1}ª falta)` : ''}. A falta fica anotada no histórico.</div>` : ''}
          <div class="form-linha">
            <label>Data<input id="ag-data" type="date" min="${RH.hoje()}" value="${faltou ? '' : UI.esc(e.data || '')}"></label>
            <label>Horário<input id="ag-hora" type="time" value="${faltou ? '' : UI.esc(e.hora || '')}"></label>
            <label>Formato<select id="ag-formato">${opcoes(FORMATOS, e.formato || 'presencial')}</select></label>
            <label>Local ou link<input id="ag-local" value="${UI.esc(e.local || '')}" placeholder="Ex.: escritório de Lagoa Vermelha; link do Meet"></label>
            <div id="ag-conf" style="grid-column:1/-1"></div>
            <label style="grid-column:1/-1">Mensagem para a pessoa<textarea id="ag-msg" rows="3"></textarea></label>
          </div>`,
        botoes: [{ texto: 'Cancelar' }].concat(remarcar ? [] : [{ texto: 'Agendar depois', classe: 'btn-secundario', acao: async () => { if (p.etapa !== 'entrevista') await gravar(p, { etapa: 'entrevista' }, `${p.pessoa.nome}: Entrevista (sem data ainda).`); } }],
          [{ texto: linkWhats(p.pessoa) ? 'Agendar e mandar WhatsApp' : 'Agendar', classe: 'btn-primario', acao: async md => {
            const g = s => md.corpo.querySelector(s), data = g('#ag-data').value;
            if (!data) { g('#ag-data').focus(); throw new Error('Escolha a data da entrevista.'); }
            const ent = { ...e, data, hora: g('#ag-hora').value || null, formato: g('#ag-formato').value || null, local: g('#ag-local').value.trim() || null, resultado: 'aguardando' };
            if (faltou) ent.faltas = (e.faltas || 0) + 1;
            if (e.data !== data || (e.hora || null) !== ent.hora) ent.confirmou = '';   // data nova: a confirmação volta a valer só depois de a pessoa responder
            const campos = { entrevista: ent }; if (p.etapa !== 'entrevista') campos.etapa = 'entrevista'; if (!emAndamento(p)) campos.situacao = 'em_andamento';
            const msg = g('#ag-msg').value.trim(), wa = linkWhats(p.pessoa, msg);
            const janela = wa ? window.open('about:blank', '_blank') : null;   // abre já no clique (o navegador bloqueia depois do await)
            if (!await gravar(p, campos, `Entrevista de ${p.pessoa.nome}: ${RH.fmtDia(data)}${ent.hora ? ' ' + ent.hora : ''}.`)) { if (janela) janela.close(); return false; }
            if (faltou) anotarAuto(p, `Faltou na entrevista de ${RH.fmtDia(e.data)}${e.hora ? ' ' + e.hora : ''}. Remarcada para ${RH.fmtDia(data)}${ent.hora ? ' ' + ent.hora : ''}.`);
            else if (e.data && (e.data !== data || (e.hora || '') !== (ent.hora || ''))) anotarAuto(p, `Entrevista remarcada de ${RH.fmtDia(e.data)}${e.hora ? ' ' + e.hora : ''} para ${RH.fmtDia(data)}${ent.hora ? ' ' + ent.hora : ''}.`);
            if (janela) { janela.location.href = wa; anotarAuto(p, 'Mensagem pelo WhatsApp: entrevista marcada.'); }
          } }]) });
      const g = s => m.corpo.querySelector(s);
      let msgMexida = false;
      const texto = () => montarMensagem(meusModelos().entrevista, p, { data: g('#ag-data').value, hora: g('#ag-hora').value, formato: g('#ag-formato').value, local: g('#ag-local').value.trim() });
      const textoAntigo = () => {
        const d = g('#ag-data').value, h = g('#ag-hora').value, f = g('#ag-formato').value, l = g('#ag-local').value.trim();
        const dia = d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }) : '___';
        return `Olá, ${p.pessoa.nome.split(' ')[0].charAt(0) + p.pessoa.nome.split(' ')[0].slice(1).toLowerCase()}! Aqui é ${eu.nome.split(' ')[0]}, do RH. Sua entrevista${p.cargo ? ` para ${p.cargo.toLowerCase()}` : ''} ficou para ${dia}${h ? ` às ${h}` : ''}${f === 'presencial' ? (l ? `, em ${l}` : ', presencial') : f === 'video' ? ` por vídeo${l ? `: ${l}` : ''}` : f === 'telefone' ? ', por telefone (vamos te ligar)' : f === 'whatsapp' ? ', por aqui no WhatsApp' : ''}. Pode confirmar?`;
      };
      const atualizar = () => {
        if (!msgMexida) g('#ag-msg').value = texto();
        const d = g('#ag-data').value, h = g('#ag-hora').value;
        const outro = d && h && p.analista_login ? linhas.find(x => x !== p && emAndamento(x) && x.analista_login === p.analista_login && x.entrevista && x.entrevista.data === d && x.entrevista.hora === h) : null;
        g('#ag-conf').innerHTML = outro ? `<div class="caixa caixa-aviso" style="margin:0">Atenção: ${UI.esc(nomeAnalista(p) || 'o RH')} já tem a entrevista de <b>${UI.esc(outro.pessoa.nome)}</b> neste mesmo dia e horário.</div>` : '';
      };
      ['#ag-data', '#ag-hora', '#ag-formato', '#ag-local'].forEach(s => g(s).addEventListener('input', atualizar));
      g('#ag-formato').addEventListener('change', atualizar);
      g('#ag-msg').addEventListener('input', () => { msgMexida = true; });
      atualizar();
    }
    // Enquadrar: aprovado na entrevista, a pessoa vai para a Documentação e aqui se define a vaga e onde vai trabalhar,
    // olhando quanto cada distrito da vaga ainda precisa (locais e móveis) e a distância de onde ela mora.
    // peças do enquadrar, usadas por uma pessoa (enquadrar) e por várias de uma vez (enquadrarLote)
    const falta = (x, t) => Math.max(0, t === 'MOVEL' ? x.moveis - x.admMov : x.locais - x.admLoc);
    const saldoVaga = v => v.porDistrito.length ? v.porDistrito.reduce((a, x) => a + falta(x, 'LOCAL') + falta(x, 'MOVEL'), 0) : Math.max(0, v.quantidade - (v.admitidos || 0));
    const vagasParaEnquadrar = p => vagasProjeto().filter(v => !['preenchida', 'cancelada', 'recusada'].includes(v.status) || v.id === p.vaga_id);
    const vagaInicial = (p, vagasAb) => p.vaga_id && vagasAb.some(v => v.id === p.vaga_id) ? p.vaga_id : (vagasAb.find(v => Store.normalizar(v.titulo) === Store.normalizar(p.cargo || '')) || {}).id || '';
    // distritos possíveis (os da vaga, ou todos do projeto) do mais perto ao mais longe de onde a pessoa mora, e o sugerido:
    // o mais perto que ainda precisa de gente do tipo que a distância indica (usados: o que outros do mesmo lote já ocuparam)
    function opcoesEnquadrar(p, vg, usados = {}) {
      const origem = p.pessoa.cidade_origem_id;
      const lista = vg && vg.porDistrito.length ? vg.porDistrito.map(x => ({ d: x.distrito, x })) : distritosProjeto().map(d => ({ d, x: null }));
      const comKm = lista.map(o => ({ ...o, r: origem ? Store.distritoMaisProximo(origem, [o.d.id]) : null })).sort((a, b) => (a.r ? a.r.km : 1e9) - (b.r ? b.r.km : 1e9) || a.d.nome.localeCompare(b.d.nome, 'pt-BR'));
      const tipoDe = o => o.r && (o.r.dentro || o.r.km <= limiteKm) ? 'LOCAL' : 'MOVEL';
      const resta = (o, t) => o.x ? falta(o.x, t) - (usados[`${vg.id}|${o.d.id}|${t}`] || 0) : 1;
      return { comKm, sug: comKm.find(o => resta(o, tipoDe(o)) > 0) || comKm[0] || null };
    }
    // LOCAL/MÓVEL pela distância de onde mora até o distrito (sem distância, fica o que já tinha)
    const tipoPeloDistrito = (p, dId) => { const r = dId && p.pessoa.cidade_origem_id ? Store.distritoMaisProximo(p.pessoa.cidade_origem_id, [dId]) : null; return { r, tipo: r ? (r.dentro || r.km <= limiteKm ? 'LOCAL' : 'MOVEL') : (p.tipo || 'LOCAL') }; };
    function enquadrar(p) {
      const origem = p.pessoa.cidade_origem_id;
      const vagasAb = vagasParaEnquadrar(p);
      const vIni = vagaInicial(p, vagasAb);
      const m = UI.modal({ titulo: `Onde ${p.pessoa.nome} vai trabalhar?`, largura: '560px',
        corpo: `<p class="muted" style="margin-top:0">${p.pessoa.nome} vai para a <b>Documentação</b>. Escolha a vaga e o distrito; ao lado de cada distrito aparece quanto a vaga ainda precisa.${origem ? ` Mora em <b>${UI.esc(nomeCidade(origem))}</b>.` : ' <span class="cd-falta">Sem cidade de origem: a distância não aparece.</span>'}</p>
          <div class="form-linha">
            <label style="grid-column:1/-1">Vaga<select id="en-vaga"><option value="">Sem vaga por enquanto</option>${vagasAb.map(v => `<option value="${v.id}" ${v.id === vIni ? 'selected' : ''}>${UI.esc(rotuloVaga(v))} — ${saldoVaga(v) ? `faltam ${saldoVaga(v)}` : 'completa'}</option>`).join('')}</select></label>
            <label style="grid-column:1/-1">Distrito<select id="en-dist"></select></label>
            <label>Tipo<select id="en-tipo"><option value="LOCAL">Local (mora na região)</option><option value="MOVEL">Móvel (vem de fora)</option></select></label>
            <div class="cd-sugestao" id="en-sug" style="grid-column:1/-1"></div>
          </div>`,
        botoes: [{ texto: 'Cancelar' }, { texto: 'Definir depois', classe: 'btn-secundario', acao: async () => { await gravar(p, Object.assign({ etapa: 'documentos' }, emAndamento(p) ? {} : { situacao: 'em_andamento' }), `${p.pessoa.nome}: Documentação (destino a definir).`); } },
          { texto: 'Ir para a Documentação', classe: 'btn-primario', acao: async md => {
            const g = s => md.corpo.querySelector(s), vg = vagaDe(g('#en-vaga').value), dId = g('#en-dist').value || null;
            const r = dId && origem ? Store.distritoMaisProximo(origem, [dId]) : null;
            const campos = { etapa: 'documentos', vaga_id: vg ? vg.id : null, distrito_id: dId, tipo: g('#en-tipo').value, distancia_km: r ? Math.round(r.km * 10) / 10 : null };
            if (vg && !p.cargo) campos.cargo = vg.titulo;
            if (!emAndamento(p)) campos.situacao = 'em_andamento';
            if (!await gravar(p, campos, `${p.pessoa.nome}: Documentação${dId ? ' · ' + Store.distrito(dId).nome : ''}.`)) return false;
          } }] });
      const g = s => m.corpo.querySelector(s);
      let mexeuTipo = false;
      function distritos() {
        // sugerido: o mais perto que ainda precisa de gente (do tipo que a distância indica)
        const { comKm, sug } = opcoesEnquadrar(p, vagaDe(g('#en-vaga').value));
        const atual = g('#en-dist').value || (p.distrito_id && comKm.some(o => o.d.id === p.distrito_id) ? p.distrito_id : sug ? sug.d.id : '');
        g('#en-dist').innerHTML = '<option value="">Ainda não definido</option>' + comKm.map(o => `<option value="${o.d.id}" ${o.d.id === atual ? 'selected' : ''}>${UI.esc(o.d.nome)}${o.r ? ` · ${o.r.dentro ? 'mora no distrito' : UI.fmtKm(o.r.km)}` : ''}${o.x ? ` · faltam ${falta(o.x, 'LOCAL')} locais e ${falta(o.x, 'MOVEL')} móveis` : ''}${sug && o.d.id === sug.d.id ? ' (sugerido)' : ''}</option>`).join('');
        atualizarTipo();
      }
      function atualizarTipo() {
        const dId = g('#en-dist').value, { r, tipo: t } = tipoPeloDistrito(p, dId);
        if (!mexeuTipo) g('#en-tipo').value = p.distrito_id === dId && p.tipo ? p.tipo : t;
        const vg = vagaDe(g('#en-vaga').value), x = vg && dId ? vg.porDistrito.find(y => y.distrito.id === dId) : null;
        const tp = g('#en-tipo').value, sem = x && falta(x, tp) === 0;
        g('#en-sug').innerHTML = !dId ? 'Sem distrito: dá para definir depois na ficha (é obrigatório para admitir).'
          : `${r ? (r.dentro ? 'Mora no distrito: LOCAL.' : `A ${UI.fmtKm(r.km)} do distrito: ${t === 'LOCAL' ? `até ${limiteKm} km conta como LOCAL` : `mais de ${limiteKm} km, MÓVEL`}.`) : ''}${sem ? ` <span class="cd-falta">${(tp === 'MOVEL' ? x.moveis : x.locais) ? `Esta vaga já completou os ${tp === 'MOVEL' ? 'móveis' : 'locais'} deste distrito.` : `Esta vaga não pede ${tp === 'MOVEL' ? 'móveis' : 'locais'} neste distrito.`}</span>` : ''}`;
      }
      g('#en-vaga').addEventListener('change', () => { g('#en-dist').value = ''; distritos(); });
      g('#en-dist').addEventListener('change', atualizarTipo);
      g('#en-tipo').addEventListener('change', () => { mexeuTipo = true; atualizarTipo(); });
      distritos();
    }
    // Várias pessoas para a Documentação de uma vez: uma linha por pessoa com vaga, distrito (o sugerido já vem marcado) e LOCAL/MÓVEL
    function enquadrarLote(sel) {
      const usados = {}, conta = (vg, dId, t, n) => { if (vg && dId) { const k = `${vg.id}|${dId}|${t}`; usados[k] = (usados[k] || 0) + n; } };
      // escolha inicial de cada um, descontando do saldo o que os anteriores do lote já ocuparam
      const escolhas = sel.map(p => {
        const vagasAb = vagasParaEnquadrar(p), vg = vagaDe(vagaInicial(p, vagasAb));
        const { sug } = opcoesEnquadrar(p, vg, usados), dId = p.distrito_id || (sug ? sug.d.id : '');
        const tipo = p.distrito_id && p.tipo ? p.tipo : tipoPeloDistrito(p, dId).tipo;
        conta(vg, dId, tipo, 1);
        return { p, vagasAb, vagaId: vg ? vg.id : '', dId, tipo };
      });
      const linhaHtml = (o, i) => `<div class="cd-enq-linha" data-i="${i}">
          <div class="cd-enq-quem"><b>${UI.esc(o.p.pessoa.nome)}</b><span class="muted small">${nomeCidade(o.p.pessoa.cidade_origem_id) ? 'mora em ' + UI.esc(nomeCidade(o.p.pessoa.cidade_origem_id)) : '<span class="cd-falta">sem cidade de origem</span>'}</span></div>
          <label><span class="cd-enq-rot">Vaga</span><select data-c="vaga"><option value="">Sem vaga por enquanto</option>${o.vagasAb.map(v => `<option value="${v.id}" ${v.id === o.vagaId ? 'selected' : ''}>${UI.esc(rotuloVaga(v))} — ${saldoVaga(v) ? `faltam ${saldoVaga(v)}` : 'completa'}</option>`).join('')}</select></label>
          <label><span class="cd-enq-rot">Distrito</span><select data-c="dist"></select></label>
          <label><span class="cd-enq-rot">Tipo</span><select data-c="tipo"><option value="LOCAL">Local</option><option value="MOVEL">Móvel</option></select></label>
        </div>`;
      const m = UI.modal({ titulo: `${qtd(sel.length, 'pessoa vai', 'pessoas vão')} para a Documentação`, largura: '900px', fecharAoClicarFora: false,
        corpo: `<p class="muted" style="margin-top:0">Confira onde cada um vai trabalhar. O distrito sugerido é o mais perto de onde a pessoa mora que ainda precisa de gente; LOCAL ou MÓVEL vem da distância (até ${limiteKm} km conta como LOCAL). Dá para deixar o distrito em branco e definir depois na ficha.</p>
          <div class="cd-enq">${escolhas.map(linhaHtml).join('')}</div>`,
        botoes: [{ texto: 'Cancelar' }, { texto: 'Ir todos para a Documentação', classe: 'btn-primario', acao: async () => {
          let ok = 0; const erros = [];
          for (const o of escolhas) {
            const p = o.p, vg = vagaDe(o.vagaId), dId = o.dId || null, r = dId && p.pessoa.cidade_origem_id ? Store.distritoMaisProximo(p.pessoa.cidade_origem_id, [dId]) : null;
            const campos = { etapa: 'documentos', vaga_id: vg ? vg.id : null, distrito_id: dId, tipo: o.tipo, distancia_km: r ? Math.round(r.km * 10) / 10 : null };
            if (vg && !p.cargo) campos.cargo = vg.titulo;
            try { await Nuvem.rh.atualizar(p.id, campos); Object.assign(p, campos); ok++; }
            catch (err) { erros.push(`${p.pessoa.nome}: ${err.message}`); }
          }
          marcados.clear(); desenhar();
          if (ok) UI.toast(`${qtd(ok, 'pessoa foi', 'pessoas foram')} para a Documentação.`, 'sucesso', 4000);
          if (erros.length) UI.toast(`Não foi possível mover: ${erros.join(' · ')}`, 'erro', 9000);
        } }] });
      const linhaEl = i => m.corpo.querySelector(`.cd-enq-linha[data-i="${i}"]`);
      function pintarDistritos(i) {
        const o = escolhas[i], el2 = linhaEl(i), vg = vagaDe(o.vagaId), { comKm, sug } = opcoesEnquadrar(o.p, vg, usados);
        el2.querySelector('[data-c="dist"]').innerHTML = '<option value="">Ainda não definido</option>' + comKm.map(x => `<option value="${x.d.id}" ${x.d.id === o.dId ? 'selected' : ''}>${UI.esc(x.d.nome)}${x.r ? ` · ${x.r.dentro ? 'mora no distrito' : UI.fmtKm(x.r.km)}` : ''}${x.x ? ` · faltam ${falta(x.x, 'LOCAL')}L/${falta(x.x, 'MOVEL')}M` : ''}${sug && x.d.id === sug.d.id ? ' (sugerido)' : ''}</option>`).join('');
        el2.querySelector('[data-c="tipo"]').value = o.tipo;
      }
      escolhas.forEach((o, i) => pintarDistritos(i));
      m.corpo.querySelector('.cd-enq').addEventListener('change', e => {
        const s = e.target.closest('select[data-c]'), l = s && s.closest('[data-i]'); if (!l) return;
        const i = +l.dataset.i, o = escolhas[i];
        conta(vagaDe(o.vagaId), o.dId, o.tipo, -1);   // tira a escolha antiga do saldo e põe a nova
        if (s.dataset.c === 'vaga') { o.vagaId = s.value; const { sug } = opcoesEnquadrar(o.p, vagaDe(o.vagaId), usados); o.dId = sug ? sug.d.id : ''; o.tipo = tipoPeloDistrito(o.p, o.dId).tipo; }
        else if (s.dataset.c === 'dist') { o.dId = s.value; o.tipo = tipoPeloDistrito(o.p, o.dId).tipo; }
        else o.tipo = s.value;
        conta(vagaDe(o.vagaId), o.dId, o.tipo, 1);
        pintarDistritos(i);
      });
    }
    const voltar = p => { const i = ORDEM.indexOf(p.etapa); if (i > 0) gravar(p, { etapa: ORDEM[i - 1] }, `${p.pessoa.nome} voltou para ${ETAPAS[ORDEM[i - 1]]}.`); };
    // motivoIni: motivo já escolhido (ex.: "não respondeu", vindo da sugestão do cartão)
    function naoSeguiu(p, motivoIni) {
      const marcado = m => motivoIni ? m === motivoIni : (p.entrevista && p.entrevista.resultado === 'reprovado' && m === 'Reprovado na entrevista') || (p.entrevista && p.entrevista.resultado === 'faltou' && m === 'Não compareceu à entrevista');
      UI.modal({ titulo: `${p.pessoa.nome} não segue no processo`, largura: '460px',
        corpo: `<label>Motivo<select id="ns-mot">${MOTIVOS_SAIDA.map(([sit, m]) => `<option value="${sit}|${m}" ${marcado(m) ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
          <label style="margin-top:10px">Detalhe (opcional)<input id="ns-obs" placeholder="Ex.: não tem disponibilidade para viajar"></label>
          <p class="muted small" style="margin-bottom:0">A pessoa sai do quadro e fica guardada em "Não seguiram". Dá para retomar depois.</p>`,
        botoes: [{ texto: 'Cancelar' }, { texto: 'Confirmar', classe: 'btn-primario', acao: async md => {
          const [sit, mot] = md.corpo.querySelector('#ns-mot').value.split('|'), det = md.corpo.querySelector('#ns-obs').value.trim(), motivo = mot + (det ? ' — ' + det : '');
          if (!await gravar(p, { situacao: sit, motivo_saida: motivo })) return false;
          anotarAuto(p, `Não segue no processo: ${motivo}`);
          // depois de guardar: oferece avisar a pessoa
          setTimeout(() => avisarSaida(p), 0);
        } }] });
    }
    function avisarSaida(p) {
      const tem = !!linkWhats(p.pessoa);
      UI.modal({ titulo: 'Guardado em "Não seguiram"', largura: '440px',
        corpo: `<p style="margin-top:0"><b>${UI.esc(p.pessoa.nome)}</b> saiu do processo.${tem ? ' Quer avisar a pessoa pelo WhatsApp? A mensagem já vem pronta.' : ' Ela está sem telefone válido, então não dá para avisar pelo WhatsApp.'}</p>`,
        botoes: [{ texto: tem ? 'Agora não' : 'Fechar' }].concat(tem ? [{ texto: 'Avisar pelo WhatsApp', classe: 'btn-primario', acao: () => { setTimeout(() => mandarMensagem(p, 'naoseguiu'), 0); } }] : []) });
    }
    const MOTIVOS_SAIDA = [['reprovado', 'Reprovado na triagem'], ['reprovado', 'Reprovado na entrevista'], ['desistiu', 'Não compareceu à entrevista'], ['desistiu', 'Não respondeu / sem contato'],
      ['desistiu', 'Salário ou benefícios'], ['desistiu', 'Distância, alojamento ou viagem'], ['reprovado', 'Documentação'], ['desistiu', 'Desistiu (outro motivo)'], ['reprovado', 'Reprovado (outro motivo)']];
    // anotação automática no histórico (quem e quando ficam gravados pelo banco); falha aqui não desfaz a ação
    async function anotarAuto(p, texto) { try { p.anotacoes = await Nuvem.rh.anotar(p.id, texto); } catch (e) { console.warn('anotação automática', e); } }
    // ---------- chegada no campo: selo e botões rápidos (cartão e Lista) ----------
    function chegadaHtml(p) {
      if (!temChegada(p)) return '';
      const st = stChegada(p);
      const selo = st === 'chegou' ? '<span class="cd-chip cd-chip-ok" title="Chegou ao campo">chegou ✓</span>'
        : st === 'faltou' ? '<span class="cd-chip cd-chip-ruim" title="Não chegou ao campo">faltou na chegada</span>'
        : st === 'remarcou' ? '<span class="cd-chip cd-chip-meio" title="A chegada foi remarcada">chegada remarcada</span>'
        : chegadaVencida(p) ? '<span class="cd-chip cd-chip-ruim" title="A data passou e ninguém marcou se chegou">sem confirmação</span>' : '';
      const botoes = podeEditar && st !== 'chegou' && st !== 'faltou' && p.chegada_data <= RH.hoje()
        ? `<button type="button" class="btn btn-pequeno cd-cheg-ok" data-acao="chegou" title="Marcar que ${UI.esc(p.pessoa.nome)} chegou ao campo">Chegou</button><button type="button" class="btn btn-pequeno cd-cheg-falta" data-acao="faltou-campo" title="Marcar que ${UI.esc(p.pessoa.nome)} não chegou">Faltou</button>` : '';
      const reserva = podeEditar && st === 'faltou' ? '<button type="button" class="btn btn-pequeno cd-cheg-reserva" data-acao="reserva" title="Quem pode entrar no lugar">Chamar reserva</button>' : '';
      return selo || botoes || reserva ? `<div class="cd-chegada">${selo}${botoes}${reserva}</div>` : '';
    }
    async function marcarChegada(p, st) {
      if (st === 'faltou' && !await UI.confirmar(`Marcar que ${p.pessoa.nome} não chegou ao campo (${RH.fmtDia(p.chegada_data)})?`, { titulo: 'Faltou na chegada', textoOk: 'Marcar falta' })) return;
      const ok = await gravar(p, { chegada_status: st }, st === 'chegou' ? `${p.pessoa.nome}: chegou ao campo.` : st === 'faltou' ? `${p.pessoa.nome}: faltou na chegada.` : 'Chegada atualizada.');
      if (ok && st === 'faltou') setTimeout(() => chamarReserva(p), 0);
    }
    // Quem pode entrar no lugar de quem faltou: aprovado na entrevista ou na Documentação, mesma vaga (ou cargo), mesmo distrito e tipo, sem chegada marcada
    function chamarReserva(p) {
      const mesmaVaga = x => p.vaga_id && x.vaga_id ? x.vaga_id === p.vaga_id : Store.normalizar(x.cargo || '') === Store.normalizar(p.cargo || '');
      const mesmoLugar = x => !p.distrito_id || x.distrito_id === p.distrito_id || (x.etapa === 'entrevista' && !x.distrito_id);
      const mesmoTipo = x => !p.tipo || x.tipo === p.tipo || (x.etapa === 'entrevista' && !x.distrito_id);
      const cands = linhas.filter(x => x !== p && emAndamento(x) && !x.chegada_data
        && ((x.etapa === 'entrevista' && x.entrevista && x.entrevista.resultado === 'aprovado') || x.etapa === 'documentos')
        && mesmaVaga(x) && mesmoLugar(x) && mesmoTipo(x))
        .sort((a, b) => pronta(b) - pronta(a) || (b.etapa === 'documentos') - (a.etapa === 'documentos') || a.pessoa.nome.localeCompare(b.pessoa.nome, 'pt-BR'));
      const d = p.distrito_id && Store.distrito(p.distrito_id);
      const m = UI.modal({ titulo: `Reserva para o lugar de ${p.pessoa.nome}`, largura: '640px',
        corpo: `<p class="muted" style="margin-top:0">${UI.esc(p.cargo || 'Mesmo cargo')}${d ? ' · ' + UI.esc(d.nome) : ''}${p.tipo ? ' · ' + (p.tipo === 'MOVEL' ? 'móvel' : 'local') : ''}. Aprovados na entrevista ou na Documentação, ainda sem chegada marcada.</p>
          ${cands.length ? `<div class="cd-reserva">${cands.map(x => `<div class="cd-reserva-l" data-id="${x.id}">
              <div><b>${UI.esc(x.pessoa.nome)}</b><div class="muted small">${x.etapa === 'documentos' ? (pronta(x) ? 'Documentação · pronto para admitir' : 'Documentação · ' + UI.esc(textoDinamica(x))) : 'Aprovado na entrevista'}${nomeCidade(x.pessoa.cidade_origem_id) ? ' · mora em ' + UI.esc(nomeCidade(x.pessoa.cidade_origem_id)) : ''}${x.pessoa.telefone ? ' · ' + UI.esc(x.pessoa.telefone) : ''}</div></div>
              <div class="cd-reserva-acoes">${linkWhats(x.pessoa) ? '<button type="button" class="btn btn-pequeno btn-wa" data-res="msg">Mensagem</button>' : ''}<button type="button" class="btn btn-pequeno btn-primario" data-res="chegada">Marcar chegada</button></div>
            </div>`).join('')}</div>` : '<div class="vazio">Ninguém disponível agora com a mesma vaga, distrito e tipo. Veja quem está na Entrevista ou na Triagem.</div>'}`,
        botoes: [{ texto: 'Fechar' }] });
      m.corpo.addEventListener('click', e => {
        const b = e.target.closest('[data-res]'), l = b && b.closest('[data-id]'), x = l && linhas.find(y => y.id === l.dataset.id); if (!x) return;
        if (b.dataset.res === 'msg') mandarMensagem(x, 'chegada');
        else { m.fechar(); setTimeout(() => formulario(x, 'docs'), 0); }
      });
    }
    // de onde veio o candidato (como soube da vaga)
    const FONTES = () => Store.CANAIS.map(c => [c.id, c.nome]).concat([['indicacao', 'Indicação de colaborador'], ['ex_colaborador', 'Ex-colaborador'], ['recontratacao', 'Banco de talentos (recontratação)'], ['outro', 'Outro']]);
    const nomeFonte = f => { const x = FONTES().find(y => y[0] === f); return x ? x[1] : (f || ''); };
    // atalho do cartão: a pessoa confirmou (ou não) que vem na entrevista
    async function marcarConfirmou(p, valor) {
      const e = p.entrevista || {}; if (!e.data) return;
      if (await gravar(p, { entrevista: { ...e, confirmou: valor } }, valor === 'sim' ? `${p.pessoa.nome}: presença confirmada.` : `${p.pessoa.nome}: confirmação desmarcada.`))
        anotarAuto(p, valor === 'sim' ? `Confirmou presença na entrevista de ${RH.fmtDia(e.data)}.` : 'Confirmação da entrevista desmarcada.');
    }
    async function encerrar(p, perguntarSoUmaVez) {
      const motivo = barradaEm(p); if (!motivo) return;
      if (!await UI.confirmar(`${p.pessoa.nome} ficou como ${motivo}. Encerrar o processo agora? A pessoa sai do andamento e fica guardada em "Não seguiram".${perguntarSoUmaVez ? ' Se cancelar, ela continua na lista, sem poder ser admitida, com o botão Encerrar.' : ''}`, { titulo: 'Encerrar processo', textoOk: 'Encerrar' })) return;
      gravar(p, { situacao: 'reprovado' }, 'Processo encerrado. Está em "Não seguiram".');
    }
    async function salvarDocs(p, mapa) {
      const antes = { documentos: p.documentos, documentos_pendentes: p.documentos_pendentes, dinamica: p.dinamica };
      p.documentos = mapa;
      const s = dinamicaDe(p);
      const campos = { documentos: mapa, dinamica: s.completa ? 'ok' : 'pendente', documentos_pendentes: s.pendentes.map(d => (d.estado === 'recusado' ? 'recusado: ' : '') + d.nome).join('; ') || null };
      Object.assign(p, campos); desenhar();
      try { await Nuvem.rh.atualizar(p.id, campos); if (s.completa && antes.dinamica !== 'ok') UI.toast(`Documentos de ${p.pessoa.nome} completos.`, 'sucesso', 3000); }
      catch (err) { Object.assign(p, antes); desenhar(); UI.toast(err.message, 'erro', 6000); throw err; }
    }
    async function admitir(p) {
      const b = bloqueios(p);
      if (b.length) {
        UI.modal({ titulo: `Ainda não dá para admitir ${p.pessoa.nome}`, largura: '480px',
          corpo: `<p style="margin-top:0">Para admitir, tudo precisa estar concluído. Falta:</p><ul class="cd-bloqueios">${b.map(x => `<li>${UI.esc(x)}</li>`).join('')}</ul>`,
          botoes: [{ texto: 'Fechar' }].concat(podeEditar ? [{ texto: 'Abrir a ficha', classe: 'btn-primario', acao: () => { setTimeout(() => formulario(p, /documento|ASO|treinamento/.test(b.join()) && !/CPF|nascimento|idade|cidade|distrito/.test(b.join()) ? 'docs' : 'dados'), 0); } }] : []) });
        return;
      }
      const origem = cidade(p.pessoa.cidade_origem_id);
      const vg = vagaDe(p.vaga_id), parte = vg && vg.porDistrito.find(x => x.distrito.id === p.distrito_id);
      const cheio = parte ? (p.tipo === 'MOVEL' ? parte.admMov >= parte.moveis : parte.admLoc >= parte.locais) : vg ? vg.admitidos >= vg.quantidade : false;
      const avisoVaga = !vg ? ' Atenção: esta pessoa não está ligada a nenhuma vaga.' : cheio ? ` Atenção: a vaga "${vg.titulo}" já completou o que pediu${parte ? ` de ${p.tipo === 'MOVEL' ? 'móveis' : 'locais'} em ${parte.distrito.nome}` : ''}; esta admissão passa do pedido.` : '';
      // cidade onde vai trabalhar: escolhida aqui entre as cidades do distrito (antes ia sempre para o polo, às vezes a cidade errada)
      const dist = p.distrito_id ? Store.distrito(p.distrito_id) : null;
      const mapaCid = new Map();
      (dist ? Store.cidadesDoDistrito(dist) : distritosProjeto().flatMap(d => Store.cidadesDoDistrito(d))).forEach(c => mapaCid.set(c.id, c));
      const cAtual = cidade(p.cidade_atuacao_id), polo = dist ? Store.poloDoDistrito(dist) : null, cTrab = cidade(trabalhoId(p));
      [cAtual, polo, cTrab].forEach(c => { if (c && !mapaCid.has(c.id)) mapaCid.set(c.id, c); });
      const cidadesTrab = [...mapaCid.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      const selIni = (cAtual || polo || cTrab || cidadesTrab[0] || {}).id || '';
      const atuId = await new Promise(resolve => {
        let r = null;
        UI.modal({ titulo: 'Confirmar admissão', largura: '500px', fecharAoClicarFora: true, aoFechar: () => resolve(r),
          corpo: `<p style="margin-top:0">Admitir <b>${UI.esc(p.pessoa.nome)}</b>? Documentos, ASO e treinamento estão concluídos.${UI.esc(avisoVaga)}</p>
            <label>Cidade onde vai trabalhar${dist ? ` <span class="muted small">(cidades do distrito ${UI.esc(dist.nome)})</span>` : ''}<select id="ad-cidade">${cidadesTrab.map(c => `<option value="${c.id}" ${c.id === selIni ? 'selected' : ''}>${UI.esc(c.nome)}/${c.uf}${polo && c.id === polo.id ? ' (polo do distrito)' : ''}</option>`).join('')}</select></label>
            <p class="muted small" style="margin-bottom:0">A contratação (${UI.esc(origem.nome)} → cidade escolhida, ${UI.esc(UI.rotuloTipo(p.tipo))}) entra no mapa e nos relatórios.</p>`,
          botoes: [{ texto: 'Cancelar' }, { texto: 'Admitir', classe: 'btn-primario', acao: md => { const v2 = md.corpo.querySelector('#ad-cidade').value; if (!v2) throw new Error('Escolha a cidade onde a pessoa vai trabalhar.'); r = v2; } }] });
      });
      const atu = atuId && cidade(atuId); if (!atu) return;
      try {
        // o banco confere tudo de novo e cria a contratação junto (não existe admissão sem contratação, nem o contrário)
        const reg = await Nuvem.rh.admitir(p.id, atu.id, p.tipo === 'MOVEL' ? (p.base_id && cidade(p.base_id) ? p.base_id : atu.id) : atu.id);
        Object.assign(p, { situacao: 'admitido', admitido_em: (reg && reg.admitidoEm) || RH.hoje(), registro_id: reg && reg.id }); desenhar();
        UI.toast(`${p.pessoa.nome} admitido. A contratação já está no mapa.`, 'sucesso');
      } catch (err) { UI.toast(err.message, 'erro', 9000); }
    }
    function desfazerAdmissao(p) {
      UI.modal({ titulo: `Desfazer a admissão de ${p.pessoa.nome}`, largura: '480px',
        corpo: `<p style="margin-top:0">A contratação sai do mapa e a pessoa volta para a Documentação. O motivo fica no histórico dela.</p>
          <label>Motivo<input id="dz-mot" placeholder="Ex.: admitido por engano; não se apresentou no campo"></label>`,
        botoes: [{ texto: 'Cancelar' }, { texto: 'Desfazer admissão', classe: 'btn-perigo', acao: async md => {
          const mot = md.corpo.querySelector('#dz-mot').value.trim();
          if (!mot) { md.corpo.querySelector('#dz-mot').focus(); throw new Error('Informe o motivo.'); }
          await Nuvem.rh.desfazerAdmissao(p.id, mot);
          UI.toast(`Admissão de ${p.pessoa.nome} desfeita.`, 'sucesso');
          await carregar();
        } }] });
    }

    // ---------- cliques no quadro e na lista ----------
    const pessoaDe = alvo => { const l = alvo.closest('[data-id]'); return l ? linhas.find(x => x.id === l.dataset.id) : null; };
    // ---------- arrastar o cartão entre as etapas ----------
    // Triagem/Entrevista/Documentação: muda a etapa (quem estava fora volta ao processo). Admitidos: passa pela confirmação
    // da admissão (só a partir da Documentação). Faixa de baixo: "não segue". Admitido não é arrastado (desfazer fica na ficha).
    let arrastando = null;
    const alvoSolta = e => e.target.closest('.cd-coluna[data-etapa], [data-solta]');
    const podeSoltar = (p, alvo) => {
      if (!p || !alvo) return false;
      if (alvo.dataset.solta === 'fora') return emAndamento(p);
      const k = alvo.dataset.etapa;
      if (k === 'admitido') return pronta(p);
      return !(emAndamento(p) && p.etapa === k);
    };
    q('#cd-corpo').addEventListener('dragstart', e => {
      const c = e.target.closest('.cd-arrasta'); if (!c) return;
      arrastando = linhas.find(x => x.id === c.dataset.id) || null;
      e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', c.dataset.id);
      setTimeout(() => { c.classList.add('cd-levantado'); const qd = q('.cd-quadro'); if (qd) qd.classList.add('cd-arrastando'); q('#cd-corpo').classList.add('cd-arrastando'); }, 0);
      q('#cd-corpo').querySelectorAll('.cd-coluna[data-etapa], [data-solta]').forEach(a => a.classList.toggle('cd-pode', podeSoltar(arrastando, a)));
    });
    q('#cd-corpo').addEventListener('dragend', () => {
      arrastando = null;
      q('#cd-corpo').classList.remove('cd-arrastando');
      q('#cd-corpo').querySelectorAll('.cd-levantado, .cd-pode, .cd-sobre, .cd-arrastando').forEach(x => x.classList.remove('cd-levantado', 'cd-pode', 'cd-sobre', 'cd-arrastando'));
    });
    q('#cd-corpo').addEventListener('dragover', e => {
      const a = alvoSolta(e); if (!arrastando || !a || !podeSoltar(arrastando, a)) return;
      e.preventDefault(); e.dataTransfer.dropEffect = 'move';
      q('#cd-corpo').querySelectorAll('.cd-sobre').forEach(x => { if (x !== a) x.classList.remove('cd-sobre'); });
      a.classList.add('cd-sobre');
    });
    q('#cd-corpo').addEventListener('dragleave', e => { const a = alvoSolta(e); if (a && !a.contains(e.relatedTarget)) a.classList.remove('cd-sobre'); });
    q('#cd-corpo').addEventListener('drop', e => {
      const a = alvoSolta(e), p = arrastando; if (!a || !podeSoltar(p, a)) { limparArraste(); return; }
      e.preventDefault();
      limparArraste();
      if (a.dataset.solta === 'fora') return naoSeguiu(p);
      const k = a.dataset.etapa;
      if (k === 'admitido') return admitir(p);
      if (k === 'documentos' && !(emAndamento(p) && p.etapa === 'documentos')) return enquadrar(p);
      const campos = { etapa: k }; if (!emAndamento(p)) campos.situacao = 'em_andamento';
      gravar(p, campos, `${p.pessoa.nome}: ${ETAPAS[k]}.`);
    });
    q('#cd-corpo').addEventListener('click', e => {
      if (e.target.closest('[data-direcionar]')) { e.stopPropagation(); return direcionar(); }
      const cm = e.target.closest('.cd-col-sel [data-col]'); if (cm) { colMob = cm.dataset.col; return desenhar(); }
      if (e.target.closest('[data-recarregar]')) { q('#cd-corpo').innerHTML = '<div class="vazio">Carregando…</div>'; return carregar(); }
      if (e.target.closest('[data-limpar]')) { vagaId = ''; distritoId = ''; analista = ''; busca = ''; pend = ''; q('#cd-busca').value = ''; guardar('maparh:cand-vaga', ''); return desenhar(); }
      if (e.target.closest('[data-ver-prontos]')) { e.stopPropagation(); seg = 'documentos'; pend = 'prontas'; return mudarVista('lista'); }
      if (e.target.closest('[data-ir-contratacoes]')) { App.filtros.projetoId = projetoId; try { localStorage.setItem('maparh:filtros', JSON.stringify(App.filtros)); } catch (er) { /* ok */ } return App.ir('cadastro'); }
      if (e.target.closest('[data-ir-lista]')) { seg = 'fora'; pend = ''; return mudarVista('lista'); }
      if (e.target.closest('[data-planilha-dp]')) return RhSafra.planilhaDP(admitidosDaTela(), projetoId, filtrosDaTela());
      if (e.target.closest('[data-avaliar-lote]')) return RhSafra.emLote(admitidosDaTela().filter(p => !p.avaliacao_recontrataria && RhSafra.podeAvaliar(p, eu)), () => desenhar());
      if (e.target.closest('[data-copiar-folha]')) return copiarParaFolha(daLista().slice().sort((x, y) => String(y.admitido_em || '').localeCompare(String(x.admitido_em || '')) || x.pessoa.nome.localeCompare(y.pessoa.nome, 'pt-BR')));
      const vm = e.target.closest('[data-ver-mais]'); if (vm) { const k = vm.dataset.verMais, passo = k === 'lista' ? 50 : k === 'agenda' ? 40 : POR_COLUNA; verMais[k] = (verMais[k] || passo) + passo; return desenhar(); }
      const sg = e.target.closest('[data-seg]'); if (sg) { seg = sg.dataset.seg; pend = ''; marcados.clear(); verMais.lista = 50; return desenhar(); }
      const pn = e.target.closest('[data-pend]'); if (pn) { pend = pn.dataset.pend; marcados.clear(); return desenhar(); }
      const ir = e.target.closest('[data-ir]'); if (ir) { analista = ir.closest('[data-rh]').dataset.rh; const d = ir.dataset.ir; seg = d === 'pend' ? 'documentos' : d; pend = d === 'pend' ? 'pendentes' : ''; return mudarVista('lista'); }
      const mk = e.target.closest('[data-marca]');
      if (mk) { e.stopPropagation(); if (mk.dataset.marca === '*') { const ids = daLista().slice(0, verMais.lista || 50).map(p => p.id); const todos = ids.every(i => marcados.has(i)); ids.forEach(i => todos ? marcados.delete(i) : marcados.add(i)); } else if (marcados.has(mk.dataset.marca)) marcados.delete(mk.dataset.marca); else marcados.add(mk.dataset.marca); return desenhar(); }
      const lote = e.target.closest('[data-lote]'); if (lote) return emLote(lote.dataset.lote);
      const ag = e.target.closest('[data-ag]'); if (ag) { semanaAg = ag.dataset.ag === 'hoje' ? null : somarDias(semanaAg, +ag.dataset.ag); return desenhar(); }
      const ev = e.target.closest('.cd-ag-ev, .cd-ag-chip'); if (ev) { const pe = linhas.find(x => x.id === ev.dataset.id); if (pe) formulario(pe, 'entrevista'); return; }
      const rh = e.target.closest('[data-rh-nome]');
      if (rh) { analista = rh.closest('[data-rh]').dataset.rh; mudarVista('quadro'); return; }
      const b = e.target.closest('[data-acao]'), p = pessoaDe(e.target);
      const menuAberto = q('#cd-corpo').querySelector('.cd-menu:not([hidden])');
      if (b && b.dataset.acao === 'menu') { const mn = b.nextElementSibling; q('#cd-corpo').querySelectorAll('[data-acao="menu"][aria-expanded="true"]').forEach(x => { if (x !== b) x.setAttribute('aria-expanded', 'false'); }); if (mn.hidden) { UI.abrirMenu(b, mn); b.setAttribute('aria-expanded', 'true'); } else { mn.hidden = true; b.setAttribute('aria-expanded', 'false'); } return; }
      if (menuAberto) { menuAberto.hidden = true; const bm = menuAberto.previousElementSibling; if (bm) bm.setAttribute('aria-expanded', 'false'); if (!b) return; }
      if (!p) return;
      if (!b) { if (e.target.closest('.cd-card') && !e.target.closest('a')) formulario(p); return; }
      if (b.closest('.cd-doc') && b.dataset.acao === 'docs') e.stopPropagation();
      const a = b.dataset.acao;
      if (a === 'editar') formulario(p); else if (a === 'docs') documentos(p); else if (a === 'avancar') avancar(p); else if (a === 'voltar') voltar(p);
      else if (a === 'mensagem') mandarMensagem(p); else if (a === 'contato') mandarMensagem(p, 'triagem');
      else if (a === 'agendar') agendar(p, false); else if (a === 'remarcar') agendar(p, true); else if (a === 'resultado') formulario(p, 'entrevista');
      else if (a === 'avancar-direto') enquadrar(p);
      else if (a === 'nao-atendeu') { anotarAuto(p, NAO_ATENDEU).then(() => { desenhar(); UI.toast(`${p.pessoa.nome}: ${tentativas(p)}ª tentativa sem resposta anotada.`, 'sucesso', 3000); }); }
      else if (a === 'cobrar') mandarMensagem(p, 'cobrar'); else if (a === 'nao-respondeu') naoSeguiu(p, MOTIVO_SEM_RESPOSTA);
      else if (a === 'confirmou' || a === 'confirmou-desfazer') marcarConfirmou(p, a === 'confirmou' ? 'sim' : '');
      else if (a === 'chegou') marcarChegada(p, 'chegou'); else if (a === 'faltou-campo') marcarChegada(p, 'faltou'); else if (a === 'reserva') chamarReserva(p);
      else if (a === 'fora') naoSeguiu(p); else if (a === 'retomar') gravar(p, { situacao: 'em_andamento', motivo_saida: null }, `${p.pessoa.nome} voltou para o processo.`);
      else if (a === 'admitir') admitir(p); else if (a === 'encerrar') encerrar(p, false); else if (a === 'desfazer') desfazerAdmissao(p);
      else if (a === 'dup') { e.stopPropagation(); const o = linhas.find(x => x.id === b.dataset.dup); if (o) formulario(o); }
      else if (a === 'nao-dup') { e.stopPropagation(); const o = linhas.find(x => x.id === b.dataset.dup); if (o) { b.disabled = true; marcarNaoDuplicado(p, o).then(okk => { if (!okk) b.disabled = false; }); } }
      else if (a === 'avaliar') RhSafra.janela(p, () => desenhar());
      else if (a === 'copiar-folha') copiarParaFolha([p]);
    });
    q('#cd-corpo').addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('cd-card')) { e.preventDefault(); const p = pessoaDe(e.target); if (p) formulario(p); }
    });
    q('#cd-corpo').addEventListener('change', async e => {
      const s = e.target.closest('select[data-campo]'), p = s && pessoaDe(s); if (!p) return;
      const campo = s.dataset.campo, antes = p[campo];
      if (await gravar(p, { [campo]: s.value }) && ['reprovado', 'inapto'].includes(s.value) && antes !== s.value) encerrar(p, true);
    });
    q('#cd-aviso').addEventListener('click', e => {
      if (e.target.closest('[data-direcionar]')) direcionar();
      else if (e.target.closest('[data-ver-sem]')) { analista = '(sem)'; desenhar(); }
      else if (e.target.closest('[data-ver-todos]')) { analista = ''; desenhar(); }
    });

    // ---------- ficha: uma janela só ----------
    // Cabeçalho fixo (resumo + trilha das etapas + abas). Aba Dados: quem é, vaga e destino, observação.
    // Aba Documentação: os documentos em cartões + ASO, treinamento e chegada. Trocar de aba não fecha nada; um Salvar grava tudo.
    const documentos = p => formulario(p, 'docs');
    // ---------- salvar só o que mudou ----------
    // valor comparável: vazio = null; objeto com as chaves em ordem e sem as vazias; horário sem os segundos
    function comparavel(x) {
      if (x == null || x === '') return 'null';
      if (typeof x === 'object') { const ks = Object.keys(x).sort().filter(k => x[k] != null && x[k] !== ''); return ks.length ? JSON.stringify(ks.map(k => [k, comparavel(x[k])])) : 'null'; }
      const s = String(x); return /^\d\d:\d\d:\d\d$/.test(s) ? s.slice(0, 5) : s;
    }
    // documento "falta" é o mesmo que não estar no mapa (a ficha completa a lista com os do cargo)
    const semFalta = d => d && typeof d === 'object' ? Object.fromEntries(Object.entries(d).filter(([, e]) => e !== 'falta')) : d;
    const soMudou = (novo, antigo) => Object.fromEntries(Object.entries(novo).filter(([k, val]) => k === 'id'
      || (k === 'documentos' ? comparavel(semFalta(val)) !== comparavel(semFalta(antigo && antigo[k])) : comparavel(val) !== comparavel(antigo ? antigo[k] : null))));
    function formulario(p, abaIni = null) {
      const pe = p ? p.pessoa : {};
      // retrato do que a ficha abriu (para mandar só o que mudou) e a versão lida
      const foto = p ? JSON.parse(JSON.stringify(p)) : null, versaoIni = p ? p.atualizado_em || null : null;
      // anotação que eu fiz com a ficha aberta também muda a versão no banco: não conta como conflito
      const versaoAtual = () => { if (!versaoIni) return null; const minhas = (p.anotacoes || []).filter(a => a.por === eu.login && a.em && new Date(a.em) > new Date(versaoIni)).map(a => a.em).sort((x, y) => new Date(x) - new Date(y)); return minhas.length ? minhas.pop() : versaoIni; };
      const ufs = Store.ufsProjeto(projeto());
      const co = cidade(pe.cidade_origem_id), ca = p ? cidade(p.cidade_atuacao_id) : null, cb = p ? cidade(p.base_id) : null;
      const v = x => UI.esc(x == null ? '' : x);
      const vagas = vagasProjeto().filter(x => !['preenchida', 'cancelada'].includes(x.status) || (p && p.vaga_id === x.id));
      const vagaIni = p ? (p.vaga_id || '') : (vagaId && vagaId !== '(sem)' ? vagaId : '');
      const etapaIni = p ? p.etapa : 'triagem';
      const rhIni = p ? (p.analista_login || '') : (veTudo ? ((vagaDe(vagaIni) || {}).recrutadorLogin || '') : eu.login);
      const nomeSolto = p && !p.analista_login && p.analista ? p.analista : '';
      const aberto = !p || emAndamento(p), adm = p && p.situacao === 'admitido';
      const somenteLeitura = !podeEditar || adm;          // admitido: a ficha só mostra (para mudar, desfazer a admissão)
      const mapa = p ? mapaDe(p) : {};                    // estado de cada documento, editado aqui e gravado junto no Salvar
      let docsMexeu = false;
      const tel = RH.soDigitos(pe.telefone);
      const resumo = p ? [pe.cpf ? RH.fmtCPF(pe.cpf) : '<span class="cd-falta">sem CPF</span>', pe.telefone ? (tel.length >= 10 ? `<a target="_blank" rel="noopener" href="https://wa.me/55${tel}">${UI.esc(pe.telefone)}</a>` : UI.esc(pe.telefone)) : '',
        p.cargo ? UI.esc(p.cargo) : '', p.distrito_id && Store.distrito(p.distrito_id) ? UI.esc(Store.distrito(p.distrito_id).nome) : '', p.analista_login ? `<span class="com-avatar">${fotoRh(p.analista_login, 20)}<span>RH ${UI.esc(nomeAnalista(p))}</span></span>` : '',
        p.fonte ? `<span class="cd-fonte" title="Como soube da vaga${p.indicado_por ? ' · indicado por ' + UI.esc(p.indicado_por) : ''}">${UI.esc(nomeFonte(p.fonte))}${p.fonte === 'indicacao' && p.indicado_por ? ': ' + UI.esc(p.indicado_por) : ''}</span>` : '',
        faltouCampo(p) ? '<span class="cd-chip cd-chip-ruim">faltou na chegada</span>' : '', seloJaTrabalhou(p)].filter(Boolean).join(' · ') : 'Preencha quem é a pessoa. Os documentos são conferidos depois, na etapa de Documentação.';
      // As etapas no topo são também a navegação da ficha: Triagem → dados da pessoa, Entrevista → entrevista, Documentação → documentos.
      // Azul cheio = etapa em que a pessoa está; contorno = o que está aberto na tela. Mudar de etapa é um botão à parte ("Mover para…").
      const trilha = (et, sit) => {
        const fim = sit && sit !== 'em_andamento'
          ? `<div class="fi-sit ${sit === 'admitido' ? 'ok' : 'fora'}">${sit === 'admitido' ? `Admitido em ${RH.fmtDataBR(p.admitido_em)}` : SIT[sit] + ' · fora do processo'}</div>` : '';
        const extra = k => k === 'entrevista' && p && (p.anotacoes || []).length ? ` <span class="aba-num" title="Anotações">${p.anotacoes.length}</span>`
          : k === 'documentos' && p ? ' <span class="aba-num" id="f-docs-n"></span>' : '';
        return fim + `<div class="fi-trilha" id="f-trilha">${ORDEM.map((k, i) => `<button type="button" data-etapa="${k}" class="${k === et ? 'atual' : i < ORDEM.indexOf(et) ? 'feita' : ''}"><b>${i + 1}</b> ${ETAPAS[k]}${extra(k)}</button>`).join('')}<span class="fi-adm ${sit === 'admitido' ? 'atual ok' : ''}" title="A admissão é feita pelo botão Admitir"><b>4</b> Admitido</span></div>
          <div class="fi-mover" id="f-mover" hidden></div>`;
      };
      const corpo = `
        <div class="fi-cab">
          ${p ? '<div id="fi-olhando"></div>' : ''}
          <div class="fi-resumo">${resumo}${p && podeEditar && tel.length >= 10 ? ' <button type="button" class="btn btn-pequeno fi-msg" id="f-msg">Mensagem no WhatsApp</button>' : ''}${p ? `<span class="rhn-ferr">${podeEditar && (adm || pronta(p)) ? '<button type="button" class="btn-link" id="rhn-copiar" title="Copia os dados da admissão em texto pronto para mandar à folha/DP">Copiar para a folha</button>' : ''}<button type="button" class="btn-link" id="rhn-imprimir" title="Ficha em uma folha, para imprimir ou salvar em PDF (vale o que está salvo)">Imprimir ficha</button></span>` : ''}</div>
          ${trilha(etapaIni, p ? p.situacao : null)}
        </div>
        ${p ? '<div id="rhn-pend" class="rhn-pend" hidden></div>' : ''}
        <input type="hidden" id="f-etapa" value="${etapaIni}">
        <section data-painel="dados">
          <div class="pre-form-titulo">Quem é</div>
          <div class="form-linha">
            <label style="grid-column:1/-1">Nome completo<input id="f-nome" value="${v(pe.nome)}"></label>
            <label>CPF<input id="f-cpf" inputmode="numeric" placeholder="Pode ficar em branco até a documentação" value="${pe.cpf ? RH.fmtCPF(pe.cpf) : ''}" ${p && pe.cpf && !(eu.perfil === 'admin' && !adm) ? 'disabled title="Só o administrador corrige um CPF já informado"' : ''}><span class="muted small" id="f-cpf-info"></span></label>
            <label>Telefone / WhatsApp<input id="f-tel" value="${v(pe.telefone)}" placeholder="(54) 99999-9999"></label>
            <label>Cidade onde mora<input id="f-origem" placeholder="Digite e escolha" value="${co ? v(co.nome) : ''}" data-cidade-id="${co ? co.id : ''}"></label>
            <label>Estado<select id="f-uf">${UI.opcoesUF(co ? co.uf : (projeto().uf || ''))}</select></label>
            <label>Data de nascimento<input id="f-nasc" type="date" min="1920-01-02" max="${RH.hoje()}" value="${v(pe.nascimento)}"><span class="small" id="f-idade"></span></label>
            <label>E-mail<input id="f-email" type="email" value="${v(pe.email)}"></label>
            <label>CNH<input id="f-cnh" value="${v(pe.cnh)}" placeholder="Não tem, B, C, D…"></label>
            <label class="cd-check"><input type="checkbox" id="f-ex" ${pe.ex_colaborador ? 'checked' : ''}> Já trabalhou na empresa (ex-colaborador)</label>
            <label>Como soube da vaga<select id="f-fonte"><option value="">Não informado</option>${FONTES().map(([k, r]) => `<option value="${UI.esc(k)}" ${p && p.fonte === k ? 'selected' : ''}>${UI.esc(r)}</option>`).join('')}${p && p.fonte && !FONTES().some(x => x[0] === p.fonte) ? `<option value="${UI.esc(p.fonte)}" selected>${UI.esc(p.fonte)}</option>` : ''}</select></label>
            <label id="f-indicado-w" ${p && p.fonte === 'indicacao' ? '' : 'hidden'}>Indicado por<input id="f-indicado" value="${v(p && p.indicado_por)}" placeholder="Nome de quem indicou"></label>
          </div>
          <div class="pre-form-titulo" id="f-dest-tit">Vaga e destino</div>
          <div class="form-linha">
            <label><span id="f-vaga-rot">Vaga</span><select id="f-vaga"><option value="">Sem vaga definida</option>${p && p.vaga_id && !vagas.some(x => x.id === p.vaga_id) ? `<option value="${UI.esc(p.vaga_id)}" selected>${UI.esc((Store.vaga(p.vaga_id) || {}).titulo || 'Vaga atual')} (fora das suas vagas abertas)</option>` : ''}${vagas.map(x => `<option value="${x.id}" ${x.id === vagaIni ? 'selected' : ''}>${UI.esc(x.titulo)}${x.porDistrito.length ? ' · ' + UI.esc(x.porDistrito.map(d => d.distrito.nome).join(', ')) : ''}</option>`).join('')}</select></label>
            <label>Cargo<input id="f-cargo" value="${v(p ? p.cargo : (vagaDe(vagaIni) || {}).titulo)}" placeholder="Ex.: Operador de secador"></label>
            <label>RH responsável<select id="f-analista" ${veTudo ? '' : 'disabled'}><option value="">Ainda não definido</option>${nomeSolto ? `<option value="n:" selected>${UI.esc(nomeSolto)} (nome da planilha)</option>` : ''}${rhIni && !equipe().some(u => u.login === rhIni) ? `<option value="${UI.esc(rhIni)}" selected>${UI.esc(nomeAnalista(p) || rhIni)} (inativo)</option>` : ''}${equipe().map(u => `<option value="${UI.esc(u.login)}" ${u.login === rhIni ? 'selected' : ''}>${UI.esc(u.nome)}</option>`).join('')}</select></label>
            <div class="fi-dest-aviso" id="f-dest-aviso" style="grid-column:1/-1" hidden></div>
            <div class="fi-destino" id="f-destino">
            <label>Distrito<select id="f-distrito"></select></label>
            <label>Tipo<select id="f-tipo"><option value="LOCAL" ${!p || p.tipo === 'LOCAL' ? 'selected' : ''}>Local (mora na região)</option><option value="MOVEL" ${p && p.tipo === 'MOVEL' ? 'selected' : ''}>Móvel (vem de fora)</option></select></label>
            <div class="cd-sugestao" id="f-sugestao" style="grid-column:1/-1" hidden></div>
            <label>Cidade onde vai trabalhar<input id="f-atuacao" placeholder="Opcional: sem ela vale a cidade polo do distrito" value="${ca ? v(ca.nome) : ''}" data-cidade-id="${ca ? ca.id : ''}"></label>
            <label id="f-base-wrap" ${p && p.tipo === 'MOVEL' ? '' : 'hidden'}>Base de contratação<input id="f-base" placeholder="Vazio = a cidade de trabalho" value="${cb ? v(cb.nome) : ''}" data-cidade-id="${cb ? cb.id : ''}"></label>
            <label>Unidade<input id="f-unidade" value="${v(p && p.unidade)}"></label>
            </div>
            <label style="grid-column:1/-1">Observação<textarea id="f-obs" rows="2" placeholder="Experiência, disponibilidade, quem indicou…">${v(p && p.observacao)}</textarea></label>
          </div>
        </section>
        <section data-painel="entrevista" hidden>
          <div class="pre-form-titulo">Entrevista</div>
          <div class="form-linha fi-linha-3">
            <label>Data<input id="e-data" type="date" value="${v(p && p.entrevista && p.entrevista.data)}"></label>
            <label>Horário<input id="e-hora" type="time" value="${v(p && p.entrevista && p.entrevista.hora)}"></label>
            <label>Formato<select id="e-formato"><option value="">—</option>${opcoes(FORMATOS, p && p.entrevista && p.entrevista.formato)}</select></label>
            <label>Local ou link<input id="e-local" value="${v(p && p.entrevista && p.entrevista.local)}" placeholder="Endereço ou link"></label>
            <label>Quem entrevistou<input id="e-quem" value="${v(p && p.entrevista && p.entrevista.entrevistador)}" placeholder="${UI.esc(eu.nome)}"></label>
            <label>Confirmou presença?<select id="e-conf">${opcoes({ '': 'Sem resposta', sim: 'Sim, confirmou', nao: 'Não, avisou que não vem' }, (p && p.entrevista && p.entrevista.confirmou) || '')}</select></label>
            <label>Resultado<select id="e-res">${opcoes(RESULTADOS, (p && p.entrevista && p.entrevista.resultado) || 'aguardando')}</select></label>
            <div><span class="vg-rot">Avaliação</span><div class="fi-estrelas" id="e-aval">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-nota="${n}" class="${p && p.entrevista && +p.entrevista.avaliacao >= n ? 'on' : ''}" aria-label="${n} de 5">★</button>`).join('')}</div></div>
            <label style="grid-column:1/-1">Observações da entrevista<textarea id="e-notas" rows="4" placeholder="Experiência, disponibilidade (horário, viagem, alojamento), pontos fortes, pontos de atenção…">${v(p && p.entrevista && p.entrevista.notas)}</textarea></label>
          </div>
        </section>
        <section data-painel="docs" hidden>
          <div class="doc-cab"><div class="doc-progresso"><div class="doc-barra"><i id="doc-barra"></i></div><span id="doc-resumo"></span>${somenteLeitura || eu.perfil !== 'admin' ? '' : '<button type="button" class="btn-link" id="doc-todos">Marcar todos como entregues</button>'}</div>
            <div class="doc-cargo" id="doc-cargo"></div></div>
          <div id="doc-lista"></div>
          ${somenteLeitura ? '' : '<div class="doc-novo"><input id="doc-outro" placeholder="Acrescentar documento só desta pessoa (ex.: certificado NR-33)"><button type="button" class="btn btn-pequeno" id="doc-add">Acrescentar</button></div>'}
          <div class="pre-form-titulo" style="margin-top:20px">Exame, treinamento e chegada</div>
          <div class="form-linha fi-linha-3">
            <label>ASO (exame admissional)<select id="f-aso">${opcoes(ASO, p ? p.aso : 'pendente')}</select></label>
            <label><span id="f-aso-data-rot">Data do ASO</span><input id="f-aso-data" type="date" value="${v(p && p.aso_data)}"></label>
            <label id="f-aso-local-w">Local/clínica<input id="f-aso-local" value="${v(p && p.aso_local)}" placeholder="Ex.: Clínica São Lucas, Passo Fundo"></label>
            <label>Treinamento<select id="f-tre">${opcoes(TRE, p ? p.treinamento : 'pendente')}</select></label>
            <label id="f-tre-data-w">Data do treinamento<input id="f-tre-data" type="date" value="${v(p && p.treinamento_data)}"></label>
            <label id="f-tre-local-w">Local do treinamento<input id="f-tre-local" value="${v(p && p.treinamento_local)}" placeholder="Ex.: escritório de Lagoa Vermelha"></label>
            <label>Data de chegada<input id="f-chegada" type="date" value="${v(p && p.chegada_data)}"></label>
            <label>Horário previsto<input id="f-hora" type="time" value="${p && p.chegada_hora ? p.chegada_hora.slice(0, 5) : ''}"></label>
            <label>Grupo do WhatsApp<input id="f-grupo" value="${v(p && p.grupo_whatsapp)}"></label>
            <label>Chegada no campo<select id="f-cheg-st">${opcoes(CHEGADA, (p && p.chegada_status) || 'aguardando')}</select></label>
          </div>
        </section>
        ${adm ? `<section class="fi-aval" id="fi-aval"><div class="pre-form-titulo">Avaliação de fim de safra <span class="muted" style="text-transform:none;letter-spacing:0;font-weight:400">— quem for "Sim" ou "Talvez" entra no banco de talentos da próxima safra</span></div>
          ${RhSafra.bloco(p, RhSafra.podeAvaliar(p, eu))}${RhSafra.podeAvaliar(p, eu) ? '<div class="rhs-salvar-l"><button type="button" class="btn btn-primario btn-pequeno" id="rhs-salvar">Salvar avaliação</button></div>' : ''}</section>` : ''}
        ${p ? `<section class="fi-historico">
          <div class="pre-form-titulo">Histórico <span class="muted" style="text-transform:none;letter-spacing:0;font-weight:400">— cada mudança e anotação, com quem fez e quando</span></div>
          ${somenteLeitura ? '' : '<div class="fi-anotar"><textarea id="e-nova" rows="2" placeholder="Nova anotação (ex.: liguei e não atendeu; pediu para chegar na segunda)"></textarea><button type="button" class="btn" id="e-add">Anotar</button></div>'}
          <div id="e-hist" class="fi-hist"></div>
        </section>` : ''}`;

      const botoes = [];
      // chegada no campo da ficha: "aguardando" sem nada gravado antes continua vazio
      const stDaFicha = gg => { const val = gg('#f-cheg-st') ? gg('#f-cheg-st').value : ''; return !val || (val === 'aguardando' && !(p && p.chegada_status)) ? (p && p.chegada_status && !val ? p.chegada_status : null) : val; };
      // ações raras e perigosas ficam no menu "Mais ⋯" do rodapé (fecha a ficha só quando dão certo)
      const maisAcoes = [];
      if (p && eu.perfil === 'admin' && !adm) maisAcoes.push({ texto: 'Excluir do processo', perigo: true, acao: async () => {
        if (!await UI.confirmar(`Excluir ${pe.nome} deste processo? O cadastro da pessoa continua guardado.`, { perigo: true, textoOk: 'Excluir' })) return false;
        await Nuvem.rh.excluir(p.id); await carregar();
      } });
      // LGPD: a pessoa pediu para apagar os dados dela (só admin; quem está admitido não)
      if (p && eu.perfil === 'admin' && !adm && pe.nome !== 'Dados apagados (LGPD)' && Nuvem.rh.anonimizar) maisAcoes.push({ texto: 'Apagar dados pessoais (LGPD)', perigo: true, acao: async () => {
        if (!await UI.confirmar(`Apagar nome, CPF, telefone, e-mail e nascimento de ${pe.nome}? Use quando a pessoa pedir (LGPD). O histórico do processo fica, sem identificar a pessoa. Não dá para desfazer.`, { perigo: true, textoOk: 'Apagar os dados', titulo: 'Dados pessoais (LGPD)' })) return false;
        await Nuvem.rh.anonimizar(pe.id, 'pedido do titular'); UI.toast('Dados pessoais apagados.', 'sucesso'); await carregar();
      } });
      if (p && podeEditar && aberto) botoes.push({ texto: 'Não segue no processo', classe: 'btn-secundario fi-esq', acao: () => { setTimeout(() => naoSeguiu(p), 0); } });
      if (p && podeEditar && !aberto && !adm) botoes.push({ texto: 'Retomar o processo', classe: 'btn-secundario fi-esq', acao: async () => { await gravar(p, { situacao: 'em_andamento', motivo_saida: null }, `${pe.nome} voltou para o processo.`); } });
      if (p && podeEditar && adm) botoes.push({ texto: 'Desfazer admissão', classe: 'btn-secundario fi-esq', acao: () => { setTimeout(() => desfazerAdmissao(p), 0); } });
      const retrato = () => [...m.corpo.querySelectorAll('input, select, textarea')].filter(x => x.id && x.id !== 'f-etapa').map(x => x.type === 'checkbox' ? x.checked : x.value).join('\u0001') + '|' + notaEntrevista;
      let retratoIni = null;
      botoes.push({ texto: somenteLeitura ? 'Fechar' : 'Cancelar', acao: async () => somenteLeitura || (!docsMexeu && retrato() === retratoIni && g('#f-etapa').value === (p ? p.etapa : g('#f-etapa').value))
        || await UI.confirmar('Você mexeu na ficha e não salvou. Sair e perder as alterações?', { textoOk: 'Sair sem salvar' }) });
      if (adm && podeEditar) botoes.push({ texto: 'Salvar chegada e observação', classe: 'btn-primario', acao: async md => {
        const g = s => md.corpo.querySelector(s);
        const campos = { chegada_data: g('#f-chegada').value || null, chegada_hora: g('#f-hora').value || null, grupo_whatsapp: g('#f-grupo').value.trim() || null, observacao: g('#f-obs').value.trim() || null };
        if (stDaFicha(g) !== (p.chegada_status || null)) campos.chegada_status = stDaFicha(g);
        const ok = await gravar(p, campos, 'Salvo.');
        if (!ok) return false;
      } });
      if (!somenteLeitura) botoes.push({ texto: p ? 'Salvar' : 'Cadastrar', classe: 'btn-primario', acao: async md => {
        const g = s => md.corpo.querySelector(s);
        const cpf = RH.limparCPF(g('#f-cpf').value);
        if (cpf && !RH.cpfValido(cpf)) { aba('dados'); throw new Error('CPF inválido. Confira os números ou deixe em branco por enquanto.'); }
        if (cpfDeOutro) { aba('dados'); throw new Error('Este CPF já está cadastrado com outro RH. Peça ao administrador para direcionar a pessoa para você.'); }
        const nascV = g('#f-nasc').value;
        if (nascV && (nascV <= '1920-01-01' || nascV > RH.hoje())) { aba('dados'); throw new Error('Data de nascimento impossível. Confira.'); }
        if (!g('#f-nome').value.trim()) { aba('dados'); throw new Error('Informe o nome.'); }
        const resolver = (inp, uf, rotulo) => {
          const tx = inp.value.trim(); if (!tx) return null;
          const c = (inp.dataset.cidadeId && Store.cidade(inp.dataset.cidadeId)) || Store.resolverCidade(tx, uf) || Store.cidadeAproximada(tx, uf);
          if (!c) { aba('dados'); throw new Error(`${rotulo}: não achei "${tx}". Escolha na lista de sugestões.`); }
          return c.id;
        };
        const tipo = g('#f-tipo').value, etapa = g('#f-etapa').value;
        const origemId = resolver(g('#f-origem'), g('#f-uf').value, 'Cidade onde mora');
        const pessoa = { id: pessoaId, cpf: cpf || null, nome: g('#f-nome').value.trim().replace(/\s+/g, ' '), nascimento: g('#f-nasc').value || null, telefone: RH.fmtTelefone(g('#f-tel').value) || null,
          email: g('#f-email').value.trim().toLowerCase() || null, cnh: g('#f-cnh').value.trim() || null, cidade_origem_id: origemId, ex_colaborador: g('#f-ex').checked };
        const rh = g('#f-analista').value, uRh = rh && rh !== 'n:' ? Store.usuarioPorLogin(rh) : null;
        // se a lista de distritos não montou, mantém o que já estava (nunca apaga o distrito por engano)
        const distId = g('#f-distrito').options.length ? (g('#f-distrito').value || null) : (p ? p.distrito_id : null);
        const perto = origemId && distId ? Store.distritoMaisProximo(origemId, [distId]) : null;
        const pre = { id: p ? p.id : null, projeto_id: projetoId, etapa, vaga_id: g('#f-vaga').value || null, distrito_id: distId, distancia_km: perto ? Math.round(perto.km * 10) / 10 : null,
          tipo, cidade_atuacao_id: resolver(g('#f-atuacao'), ufs, 'Cidade de trabalho'), base_id: tipo === 'MOVEL' ? resolver(g('#f-base'), ufs, 'Base de contratação') : null,
          cargo: g('#f-cargo').value.trim() || null, unidade: g('#f-unidade').value.trim() || null,
          analista: rh === 'n:' ? nomeSolto : (uRh ? uRh.nome : null), analista_login: uRh ? uRh.login : null,
          aso: g('#f-aso').value, aso_data: g('#f-aso-data').value || null, aso_local: g('#f-aso-local').value.trim() || null,
          treinamento: g('#f-tre').value, treinamento_data: g('#f-tre-data').value || null, treinamento_local: g('#f-tre-local').value.trim() || null,
          chegada_data: g('#f-chegada').value || null, chegada_hora: g('#f-hora').value || null, grupo_whatsapp: g('#f-grupo').value.trim() || null, observacao: g('#f-obs').value.trim() || null,
          chegada_status: stDaFicha(g), fonte: g('#f-fonte').value || null, indicado_por: g('#f-fonte').value === 'indicacao' ? (g('#f-indicado').value.trim() || null) : null };
        const entAntes = (p && p.entrevista) || {};
        if (p) {
          const ent = { ...(p.entrevista || {}), data: g('#e-data').value || null, hora: g('#e-hora').value || null, formato: g('#e-formato').value || null, local: g('#e-local').value.trim() || null, entrevistador: g('#e-quem').value.trim() || null,
            resultado: g('#e-res').value || 'aguardando', avaliacao: notaEntrevista || null, notas: g('#e-notas').value.trim() || null, confirmou: g('#e-conf').value || '' };
          if (ent.resultado !== 'aguardando' && !ent.entrevistador) ent.entrevistador = eu.nome;
          const vazia = !ent.data && !ent.hora && !ent.formato && !ent.local && !ent.entrevistador && ent.resultado === 'aguardando' && !ent.avaliacao && !ent.notas && !ent.confirmou;
          if (!(vazia && !p.entrevista)) pre.entrevista = vazia ? null : ent;
        }
        if (!destinoAberto()) {
          const un = distritoUnico(vagaDe(pre.vaga_id)), pu = un && origemId ? Store.distritoMaisProximo(origemId, [un.id]) : null;
          Object.assign(pre, { distrito_id: un ? un.id : (p ? p.distrito_id : null), distancia_km: un ? (pu ? Math.round(pu.km * 10) / 10 : null) : (p ? p.distancia_km : null),
            tipo: un ? g('#f-tipo').value : (p ? p.tipo : 'LOCAL'), cidade_atuacao_id: p ? p.cidade_atuacao_id : null, base_id: p ? p.base_id : null, unidade: p ? p.unidade : null });
        }
        if (p) {
          // documentos gravados junto, com a mesma conta da conferência (o cargo pode ter mudado agora)
          const s = dinamicaDe({ documentos: { ...mapa }, cargo: pre.cargo });
          Object.assign(pre, { documentos: { ...mapa }, dinamica: s.completa ? 'ok' : 'pendente', documentos_pendentes: s.pendentes.map(d => (d.estado === 'recusado' ? 'recusado: ' : '') + d.nome).join('; ') || null });
        }
        const barrouAgora = p && aberto && ((pre.aso === 'inapto' && p.aso !== 'inapto') || (pre.treinamento === 'reprovado' && p.treinamento !== 'reprovado'));
        const entNova = pre.entrevista || {}, resMudou = p && aberto && entNova.resultado && entNova.resultado !== (entAntes.resultado || 'aguardando');
        // ficha que já existia: manda só o que mudou desde que abriu, com a versão lida (o banco recusa se outra pessoa mexeu depois)
        const preEnvio = p ? soMudou(pre, foto) : pre, pessoaEnvio = p && pessoa.id ? soMudou(pessoa, foto.pessoa) : pessoa;
        const mudouAlgo = !p || Object.keys(preEnvio).length > 1 || Object.keys(pessoaEnvio).length > 1;
        if (p) preEnvio.versao = versaoAtual();
        try { if (mudouAlgo) await Nuvem.rh.salvar(pessoaEnvio, preEnvio); }
        catch (err) {
          const txt = String((err && err.message) || err);
          if (!/CONFLITO_VERSAO/.test(txt)) throw err;
          mostrarConflito(txt.replace(/^[\s\S]*?CONFLITO_VERSAO:\s*/, ''));
          return false;   // a janela fica aberta: nada foi gravado
        }
        // histórico automático: remarcação e anotação digitada que não foi enviada
        if (p) {
          if (entAntes.data && entNova.data && (entAntes.data !== entNova.data || (entAntes.hora || '') !== (entNova.hora || '')))
            await anotarAuto(p, `Entrevista remarcada de ${RH.fmtDia(entAntes.data)}${entAntes.hora ? ' ' + entAntes.hora : ''} para ${RH.fmtDia(entNova.data)}${entNova.hora ? ' ' + entNova.hora : ''}.`);
          if (resMudou) await anotarAuto(p, `Resultado da entrevista: ${RESULTADOS[entNova.resultado]}.`);
          const nova = g('#e-nova'); if (nova && nova.value.trim()) await anotarAuto(p, nova.value.trim());
        }
        UI.toast(p ? 'Salvo.' : `Candidato cadastrado em ${ETAPAS[etapa]}.`, 'sucesso');
        await carregar();
        // mesma regra da lista: inapto no ASO ou reprovado no treinamento pergunta se encerra
        if (barrouAgora) { const nova = linhas.find(x => x.id === p.id); if (nova) setTimeout(() => encerrar(nova, true), 0); }
        // o resultado da entrevista leva ao próximo passo (pergunta antes)
        else if (resMudou && pre.etapa === 'entrevista') {
          const nova = linhas.find(x => x.id === p.id);
          if (nova && entNova.resultado === 'aprovado') setTimeout(async () => { if (await UI.confirmar(`${nova.pessoa.nome} foi aprovado na entrevista. Avançar para a Documentação agora?`, { titulo: 'Próximo passo', textoOk: 'Avançar' })) enquadrar(nova); }, 0);
          else if (nova && entNova.resultado === 'reprovado') setTimeout(() => naoSeguiu(nova), 0);
          else if (nova && entNova.resultado === 'faltou') UI.toast(`${nova.pessoa.nome} não compareceu. Marque uma nova data na Entrevista ou use "Não segue no processo".`, 'aviso', 7000);
        }
      } });
      const m = UI.modal({ titulo: p ? pe.nome : 'Novo candidato', largura: '860px', corpo, botoes, fecharAoClicarFora: false,
        aoFechar: () => { App.olhar('pagina:candidatos'); document.removeEventListener('maparh:presenca', pintarFicha); } });
      // presença: estou com esta ficha aberta; mostra quem mais está nela
      const pintarFicha = () => { const box = m.corpo.querySelector('#fi-olhando'); if (box && p) box.innerHTML = App.olhandoHtml('candidato:' + p.id); };
      if (p) { App.olhar('candidato:' + p.id); pintarFicha(); document.addEventListener('maparh:presenca', pintarFicha); }
      m.el.querySelector('.modal').classList.add('fi-modal');
      if (maisAcoes.length) {
        const rod = m.el.querySelector('.modal-rodape'), caixa = document.createElement('div');
        caixa.className = 'cd-mais fi-mais fi-esq';
        caixa.innerHTML = `<button type="button" class="btn btn-secundario" data-menu aria-haspopup="menu" aria-expanded="false" title="Mais ações">Mais ⋯</button><div class="cd-menu" hidden>${maisAcoes.map((a, i) => `<button type="button" data-mais="${i}" class="${a.perigo ? 'perigo' : ''}">${UI.esc(a.texto)}</button>`).join('')}</div>`;
        rod.prepend(caixa);
        const bt = caixa.firstElementChild, mn = caixa.lastElementChild;
        bt.addEventListener('click', ev => { ev.stopPropagation(); if (mn.hidden) { UI.abrirMenu(bt, mn); bt.setAttribute('aria-expanded', 'true'); } else { mn.hidden = true; bt.setAttribute('aria-expanded', 'false'); } });
        mn.addEventListener('click', async ev => {
          const b = ev.target.closest('[data-mais]'); if (!b) return;
          mn.hidden = true; bt.setAttribute('aria-expanded', 'false');
          try { if (await maisAcoes[+b.dataset.mais].acao() !== false) m.fechar(); } catch (err) { UI.toast(err.message || String(err), 'erro', 6000); }
        });
      }
      const g = s => m.corpo.querySelector(s);
      // outra pessoa salvou esta ficha depois que você abriu: avisa, não fecha e oferece buscar de novo
      function mostrarConflito(txt) {
        let cx = g('#f-conflito');
        if (!cx) { cx = document.createElement('div'); cx.id = 'f-conflito'; cx.className = 'caixa caixa-aviso fi-conflito'; g('.fi-cab').prepend(cx); }
        cx.innerHTML = `<span><b>Não foi salvo.</b> ${UI.esc(txt)}</span><button type="button" class="btn btn-pequeno btn-primario" data-recarregar-ficha>Recarregar a ficha</button>`;
        m.corpo.scrollTop = 0;
        UI.toast('Não foi salvo: outra pessoa alterou esta ficha.', 'aviso', 6000);
        cx.querySelector('[data-recarregar-ficha]').addEventListener('click', async ev => {
          if (!await UI.confirmar('Buscar os dados mais novos? O que você mudou aqui e não salvou se perde (anote antes, se precisar).', { textoOk: 'Recarregar' })) return;
          ev.target.disabled = true;
          await carregar();
          const nova = linhas.find(x => x.id === p.id);
          m.fechar();
          if (nova) formulario(nova, painelAtual); else UI.toast('Esta pessoa não está mais na sua lista (pode ter sido direcionada para outro RH).', 'aviso', 6000);
        });
      }
      let cpfDeOutro = false;
      let destinoAberto = () => true, modoDestino = null;
      let pessoaId = p ? pe.id : null, mexeuDestino = !!(p && (p.distrito_id || p.tipo === 'MOVEL'));

      // ----- abas e trilha -----
      const PAINEL = { triagem: 'dados', entrevista: 'entrevista', documentos: 'docs' };
      const ETAPA_DO_PAINEL = { dados: 'triagem', entrevista: 'entrevista', docs: 'documentos' };
      const tr = g('#f-trilha');
      if (g('#f-msg')) g('#f-msg').addEventListener('click', () => mandarMensagem(p));
      if (g('#rhn-copiar')) g('#rhn-copiar').addEventListener('click', () => copiarParaFolha([p]));
      if (g('#rhn-imprimir')) g('#rhn-imprimir').addEventListener('click', () => imprimirFicha(p));
      // avaliação de fim de safra (admitido): grava na hora, sem fechar a ficha
      if (g('#rhs-salvar')) {
        const lerAval = RhSafra.ligar(g('#fi-aval [data-rhs]'), p);
        g('#rhs-salvar').addEventListener('click', async ev => {
          const bt = ev.currentTarget; bt.disabled = true;
          try {
            const mudou = await RhSafra.salvar(p, lerAval());
            if (mudou) { g('#fi-aval [data-rhs-quando]').textContent = `Avaliado agora por ${eu.nome}.`; UI.toast(`Avaliação de ${pe.nome} salva.`, 'sucesso'); desenhar(); }
            else UI.toast('Nada mudou na avaliação.', 'aviso');
          } catch (err) { UI.toast(err.message, 'erro', 6000); }
          finally { bt.disabled = false; }
        });
      }
      // o que falta para a pessoa avançar (pelo que está salvo) e possíveis duplicados, com o atalho de cada um
      if (g('#rhn-pend')) {
        const box = g('#rhn-pend'), itens = pendenciasDe(p), dups = duplicadosDe(p, true);
        const btn = a => a ? ` <button type="button" class="btn btn-pequeno${/^msg:/.test(a[0]) ? ' btn-wa' : ''}" data-rhn="${a[0]}">${a[1]}</button>` : '';
        box.innerHTML = (itens.length ? `<div class="rhn-pend-tit">Para avançar</div><ul>${itens.map(x => `<li class="${x.grave ? 'rhn-grave' : ''}"><span>${UI.esc(x.texto)}</span>${podeEditar ? btn(x.acao) : ''}</li>`).join('')}</ul>` : '')
          + (dups.length ? `<div class="rhn-pend-tit rhn-dup-tit">Possível duplicado</div><ul>${dups.map(x => `<li><span>${x.mesma ? 'Mesma pessoa' : 'Mesmo ' + x.por} em <b>${UI.esc(x.p.pessoa.nome)}</b> · ${UI.esc(ondeEsta(x.p))}${x.p.cargo ? ' · ' + UI.esc(x.p.cargo) : ''}${veTudo && nomeAnalista(x.p) ? ' · RH ' + UI.esc(nomeAnalista(x.p).split(' ')[0]) : ''}</span> <span class="rhn-dup-acoes"><button type="button" class="btn btn-pequeno" data-rhn="dup:${x.p.id}">Abrir</button>${!x.mesma && podeEditar ? `<button type="button" class="btn btn-pequeno" data-rhn="naodup:${x.p.id}" title="Grava que são pessoas diferentes e tira o aviso (para os dois)">Não é a mesma pessoa</button>` : ''}</span></li>`).join('')}</ul>` : '');
        box.hidden = !box.innerHTML;
        box.addEventListener('click', e => {
          const b = e.target.closest('[data-rhn]'); if (!b) return;
          const [tipo, val] = b.dataset.rhn.split(':');
          if (tipo === 'msg') mandarMensagem(p, val);
          else if (tipo === 'aba') { aba(val); const foco = { dados: '#f-nome', entrevista: '#e-data', docs: '#doc-lista' }[val]; setTimeout(() => { const f = g(foco); if (f && f.focus) f.focus(); }, 30); }
          else if (tipo === 'dup') { const o = linhas.find(x => x.id === val); if (o) formulario(o); }
          else if (tipo === 'naodup') {
            const o = linhas.find(x => x.id === val); if (!o) return;
            b.disabled = true;
            marcarNaoDuplicado(p, o).then(okk => {
              if (!okk) { b.disabled = false; return; }
              // a versão no banco mudou por mim: não conta como conflito ao salvar a ficha
              const li = b.closest('li'), ul = li && li.parentElement; if (li) li.remove();
              if (ul && !ul.children.length) { const tit = ul.previousElementSibling; if (tit && tit.classList.contains('rhn-dup-tit')) tit.remove(); ul.remove(); }
              box.hidden = !box.textContent.trim();
            });
          }
        });
      }
      const marcarEtapa = et => { const k = ORDEM.indexOf(et); tr.querySelectorAll('[data-etapa]').forEach((x, i) => { x.classList.toggle('atual', i === k); x.classList.toggle('feita', i < k); }); if (modoDestino) modoDestino(); };
      let painelAtual = 'dados';
      function aba(n) {
        if (!p) n = 'dados';
        painelAtual = n;
        m.corpo.querySelectorAll('[data-painel]').forEach(x => { x.hidden = x.dataset.painel !== n; });
        tr.querySelectorAll('[data-etapa]').forEach(x => { x.classList.toggle('vendo', PAINEL[x.dataset.etapa] === n); x.setAttribute('aria-pressed', PAINEL[x.dataset.etapa] === n ? 'true' : 'false'); });
        // vendo outra etapa que não a da pessoa: oferece mover (vale ao Salvar)
        const alvo = ETAPA_DO_PAINEL[n], atual = g('#f-etapa').value, mv = g('#f-mover');
        if (g('#f-mover').classList.contains('fi-mover-ok') && atual !== p.etapa) { /* já escolheu mover: mantém o aviso */ }
        else if (p && !somenteLeitura && emAndamento(p) && alvo !== atual) {
          g('#f-mover').classList.remove('fi-mover-ok');
          mv.innerHTML = `<span>A pessoa está em <b>${ETAPAS[atual]}</b>.</span><button type="button" class="btn btn-pequeno btn-primario" data-mover-para="${alvo}">${ORDEM.indexOf(alvo) > ORDEM.indexOf(atual) ? 'Avançar' : 'Voltar'} para ${ETAPAS[alvo]}</button><span class="muted">(vale ao salvar)</span>`;
          mv.hidden = false;
        } else mv.hidden = true;
        m.corpo.scrollTop = 0;
      }
      tr.addEventListener('click', e => {
        const b = e.target.closest('[data-etapa]'); if (!b) return;
        if (!p) { if (somenteLeitura) return; g('#f-etapa').value = b.dataset.etapa; marcarEtapa(b.dataset.etapa); return; }   // cadastro novo: escolhe a etapa
        aba(PAINEL[b.dataset.etapa]);
      });
      g('#f-mover').addEventListener('click', e => {
        if (e.target.closest('[data-ir-destino]')) { aba('dados'); setTimeout(() => { g('#f-destino').scrollIntoView({ block: 'center' }); g('#f-distrito').focus(); }, 30); return; }
        if (e.target.closest('[data-desfazer-mover]')) { g('#f-etapa').value = p.etapa; marcarEtapa(p.etapa); g('#f-mover').classList.remove('fi-mover-ok'); aba(painelAtual); return; }
        const b = e.target.closest('[data-mover-para]'); if (!b) return;
        g('#f-etapa').value = b.dataset.moverPara; marcarEtapa(b.dataset.moverPara);
        g('#f-mover').innerHTML = `<span>✓ Vai para <b>${ETAPAS[b.dataset.moverPara]}</b> quando você clicar em <b>Salvar</b>.</span><button type="button" class="btn-link" data-desfazer-mover>Desfazer</button>`;
        g('#f-mover').classList.add('fi-mover-ok');
        if (b.dataset.moverPara === 'documentos' && !g('#f-distrito').value) {
          g('#f-mover').innerHTML += ' <span>Defina também <b>onde vai trabalhar</b>:</span> <button type="button" class="btn-link" data-ir-destino>ir para Vaga e destino</button>';
        }
      });

      // ----- documentos (aba Documentação) -----
      const ROT = { falta: 'Falta entregar', entregue: 'Entregue', recusado: 'Recusado: precisa reenviar', dispensado: 'Não se aplica a esta pessoa' };
      const SINAL = { falta: '', entregue: '&#10003;', recusado: '!', dispensado: '–' };
      const cobradosAgora = () => docsCobrados(g('#f-cargo').value.trim() || (p && p.cargo));
      const item = k => `<div class="doc-card doc-c-${mapa[k]}" data-doc="${UI.esc(k)}">
          <div class="doc-card-topo"><span class="doc-sinal">${SINAL[mapa[k]]}</span><div><div class="doc-card-nome">${UI.esc(k)}</div><div class="doc-card-est">${ROT[mapa[k]]}</div></div></div>
          ${somenteLeitura ? '' : `<div class="doc-card-acoes">
            <button type="button" class="doc-b-ok ${mapa[k] === 'entregue' ? 'ativa' : ''}" data-doc-est="entregue">Entregue</button>
            <button type="button" class="doc-b-rec ${mapa[k] === 'recusado' ? 'ativa' : ''}" data-doc-est="recusado">Recusado</button>
            <button type="button" class="doc-b-na ${mapa[k] === 'dispensado' ? 'ativa' : ''}" data-doc-est="dispensado" title="Ex.: reservista para mulher, certidão dos filhos para quem não tem filhos">Não se aplica</button>
          </div>`}
          ${somenteLeitura || cobradosAgora().includes(k) ? '' : '<button type="button" class="doc-card-x" data-doc-remover title="Tirar este documento da lista desta pessoa" aria-label="Remover">&times;</button>'}</div>`;
      function listaDocs() {
        if (!p) return;
        for (const n of cobradosAgora()) if (!(n in mapa)) mapa[n] = 'falta';   // cargo trocado: entram os documentos do cargo novo
        const nomes = Object.keys(mapa), de = e => nomes.filter(k => mapa[k] === e);
        const rec = de('recusado'), fal = de('falta'), ent = de('entregue').concat(de('dispensado'));
        g('#doc-barra').style.width = (nomes.length ? Math.round(100 * ent.length / nomes.length) : 0) + '%';
        g('#doc-resumo').innerHTML = nomes.length && ent.length === nomes.length ? '<b>Completa</b>' : `<b>${ent.length} de ${nomes.length}</b> entregues${rec.length ? ` · <span class="doc-res-rec">${rec.length} recusado${rec.length > 1 ? 's' : ''}</span>` : ''}${fal.length ? ` · <span class="doc-res-fal">${fal.length === 1 ? 'falta 1' : 'faltam ' + fal.length}</span>` : ''}`;
        g('#f-docs-n').textContent = `${ent.length}/${nomes.length}`;
        const cg = Store.cargoPorNome(g('#f-cargo').value.trim()), cargoTxt = g('#f-cargo').value.trim();
        g('#doc-cargo').innerHTML = cg ? `Cobrados para o cargo <b>${UI.esc(cg.nome)}</b>` : (cargoTxt ? `Cargo <b>${UI.esc(cargoTxt)}</b> sem documentos definidos: usando a lista padrão. Defina em <a href="#/cargos">Cadastros → Cargos e documentos</a>.` : 'Pessoa sem cargo: usando a lista padrão.');
        g('#doc-lista').innerHTML = nomes.length ? `<div class="doc-cards">${rec.concat(fal, ent).map(item).join('')}</div>` : '<div class="vazio">Nenhum documento na lista.</div>';
        g('#doc-resumo').innerHTML = g('#doc-resumo').innerHTML.replace(' entregues', de('dispensado').length ? ` concluídos <span class="muted">(${de('dispensado').length} não se aplica${de('dispensado').length > 1 ? 'm' : ''})</span>` : ' entregues');
      }
      if (p) {
        g('#doc-lista').addEventListener('click', e => {
          const l = e.target.closest('[data-doc]'); if (!l || somenteLeitura) return;
          if (e.target.closest('[data-doc-remover]')) { delete mapa[l.dataset.doc]; docsMexeu = true; listaDocs(); return; }
          const b = e.target.closest('[data-doc-est]'); if (!b) return;
          mapa[l.dataset.doc] = mapa[l.dataset.doc] === b.dataset.docEst ? 'falta' : b.dataset.docEst; docsMexeu = true;
          listaDocs();
        });
        if (!somenteLeitura) {
          const adicionar = () => { const val = g('#doc-outro').value.replace(/^\s*recusado:\s*/i, '').trim(); if (!val) return; if (!(val in mapa)) mapa[val] = 'falta'; g('#doc-outro').value = ''; docsMexeu = true; listaDocs(); };
          g('#doc-add').addEventListener('click', adicionar);
          g('#doc-outro').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); adicionar(); } });
          if (g('#doc-todos')) g('#doc-todos').addEventListener('click', async () => {
            const n = Object.values(mapa).filter(x => x === 'falta').length; if (!n) return;
            if (!await UI.confirmar(`Marcar os ${n} documentos que faltam como entregues?`, { textoOk: 'Marcar' })) return;
            for (const k of Object.keys(mapa)) if (mapa[k] === 'falta') mapa[k] = 'entregue'; docsMexeu = true; listaDocs();
          });
        }
        g('#f-cargo').addEventListener('change', listaDocs);
        listaDocs();
      }

      const mostrarIdade = () => { const n = g('#f-nasc').value, i = RH.idade(n), el2 = g('#f-idade'); el2.className = 'small ' + (i != null && i < 18 ? 'erro' : 'muted'); el2.textContent = !n ? 'Obrigatória para admitir' : i < 0 || n > RH.hoje() ? 'Data no futuro' : i < 18 ? `${i} anos: menor de idade, não pode ser admitido` : `${i} anos`; };
      g('#f-nasc').addEventListener('input', mostrarIdade); mostrarIdade();
      // ASO / treinamento agendado: aparecem a data e o local (o local fica guardado mesmo se esconder)
      const agendados = () => {
        const aso = g('#f-aso').value === 'agendado', tre = g('#f-tre').value === 'agendado';
        g('#f-aso-data-rot').textContent = aso ? 'Data do exame' : 'Data do ASO';
        g('#f-aso-local-w').hidden = !aso && !g('#f-aso-local').value; g('#f-tre-data-w').hidden = !tre && !g('#f-tre-data').value; g('#f-tre-local-w').hidden = !tre && !g('#f-tre-local').value;
      };
      g('#f-aso').addEventListener('change', agendados); g('#f-tre').addEventListener('change', agendados); agendados();
      UI.sugestoes(g('#f-cargo'), () => Store.cargos().map(c => ({ valor: c.nome, sub: c.documentos.length + ' documentos' })), { vazio: 'Nenhum cargo cadastrado ainda.' });
      UI.sugestoes(g('#f-cnh'), () => ['Não tem', 'A', 'B', 'AB', 'C', 'D', 'E']);
      // ----- destino: distrito sugerido -----
      UI.autocompleteCidade(g('#f-origem'), { uf: () => g('#f-uf').value, aoSelecionar: c => { g('#f-uf').value = c.uf; sugerir(); if (modoDestino) modoDestino(); } });
      UI.autocompleteCidade(g('#f-atuacao'), { uf: () => ufs, aoSelecionar: () => {} });
      UI.autocompleteCidade(g('#f-base'), { uf: () => ufs, aoSelecionar: () => {} });
      function opcoesDistrito(sel, soDaLista = false) {
        const vg = vagaDe(g('#f-vaga').value), lista = vg && vg.porDistrito.length ? vg.porDistrito.map(x => x.distrito) : distritosProjeto();
        let atual = sel && Store.distrito(sel);
        if (soDaLista && atual && !lista.includes(atual)) { atual = null; sel = ''; mexeuDestino = false; }
        if (!sel && lista.length === 1 && vg) sel = lista[0].id;   // vaga de um distrito só: já é ele
        g('#f-distrito').innerHTML = '<option value="">Ainda não definido</option>' + (atual && !lista.includes(atual) ? [atual] : []).concat(lista).map(d => `<option value="${d.id}" ${d.id === sel ? 'selected' : ''}>${UI.esc(d.nome)}</option>`).join('');
      }
      function sugerir() {
        const s = sugerirDestino(g('#f-origem').dataset.cidadeId, vagaDe(g('#f-vaga').value)), cx = g('#f-sugestao');
        cx.hidden = !s; if (!s) return;
        const igual = g('#f-distrito').value === s.distrito.id && g('#f-tipo').value === s.tipo;
        if (!mexeuDestino && !igual && !somenteLeitura) { opcoesDistrito(s.distrito.id); g('#f-tipo').value = s.tipo; g('#f-base-wrap').hidden = s.tipo !== 'MOVEL'; }
        const aplicado = g('#f-distrito').value === s.distrito.id && g('#f-tipo').value === s.tipo;
        cx.innerHTML = `${UI.esc(textoSugestao(s))}${aplicado || somenteLeitura ? '' : ' <button type="button" class="btn-link" id="f-aplicar">Usar esta sugestão</button>'}`;
        const ap = g('#f-aplicar'); if (ap) ap.addEventListener('click', () => { mexeuDestino = false; sugerir(); });
      }
      opcoesDistrito(p ? p.distrito_id : '');
      // Triagem e Entrevista: ainda não se sabe para onde a pessoa vai. Mostra só o interesse e a sugestão;
      // o destino (distrito, tipo, cidade) é definido ao ir para a Documentação.
      let abriuDestino = false;
      destinoAberto = () => abriuDestino || g('#f-etapa').value === 'documentos' || (p && !emAndamento(p));
      modoDestino = () => {
        const ab = destinoAberto(), s = sugerirDestino(g('#f-origem').dataset.cidadeId, vagaDe(g('#f-vaga').value));
        g('#f-destino').hidden = !ab;
        g('#f-dest-tit').textContent = ab ? 'Vaga e destino' : 'Interesse';
        g('#f-vaga-rot').textContent = ab ? 'Vaga' : 'Vaga de interesse (opcional)';
        const av = g('#f-dest-aviso'); av.hidden = ab;
        const un = distritoUnico(vagaDe(g('#f-vaga').value));
        if (!ab && un) av.innerHTML = `<b>Distrito: ${UI.esc(un.nome)}</b> (o da vaga) · ${g('#f-tipo').value === 'MOVEL' ? 'MÓVEL' : 'LOCAL'}${s ? ` <span class="muted small">— ${s.dentro ? 'mora no distrito' : `mora a ${UI.fmtKm(s.km)}`}</span>` : ''}${somenteLeitura ? '' : ' <button type="button" class="btn-link" id="f-dest-abrir">Ajustar</button>'}`;
        else if (!ab) av.innerHTML = `<b>Onde vai trabalhar:</b> fica para quando a pessoa for para a Documentação.${s ? `<div class="muted small" style="margin-top:3px">Só para referência: ${UI.esc(textoSugestao(s))}</div>` : ''}${somenteLeitura ? '' : ' <button type="button" class="btn-link" id="f-dest-abrir">Definir agora</button>'}`;
        const bt = g('#f-dest-abrir'); if (bt) bt.addEventListener('click', () => { abriuDestino = true; modoDestino(); g('#f-distrito').focus(); });
      };
      modoDestino();
      g('#f-vaga').addEventListener('change', () => { if (distritoUnico(vagaDe(g('#f-vaga').value))) mexeuDestino = false; const vg = vagaDe(g('#f-vaga').value); if (vg && !g('#f-cargo').value.trim()) { g('#f-cargo').value = vg.titulo; listaDocs(); } if (vg && veTudo && !g('#f-analista').value && vg.recrutadorLogin) g('#f-analista').value = vg.recrutadorLogin; opcoesDistrito(g('#f-distrito').value, true); sugerir(); modoDestino(); });
      g('#f-distrito').addEventListener('change', () => { mexeuDestino = true; sugerir(); });
      g('#f-tipo').addEventListener('change', () => { mexeuDestino = true; g('#f-base-wrap').hidden = g('#f-tipo').value !== 'MOVEL'; sugerir(); });
      sugerir();
      // CPF já conhecido: traz os dados da pessoa e diz se já passou pela empresa
      if (!somenteLeitura && (!p || !pe.cpf)) g('#f-cpf').addEventListener('blur', async () => {
        const cpf = RH.limparCPF(g('#f-cpf').value), info = g('#f-cpf-info');
        if (!p) pessoaId = null; cpfDeOutro = false;
        info.textContent = ''; info.className = 'muted small';
        if (!cpf) return;
        if (!RH.cpfValido(cpf)) { info.textContent = 'CPF inválido'; info.className = 'erro small'; return; }
        g('#f-cpf').value = RH.fmtCPF(cpf);
        try {
          const ex = await Nuvem.rh.pessoaPorCPF(cpf);
          if (!ex) { info.textContent = 'CPF novo no sistema'; return; }
          if (ex.restrito) { info.textContent = 'Este CPF já está cadastrado com outro RH. Peça ao administrador para direcionar a pessoa para você.'; info.className = 'erro small'; pessoaId = null; cpfDeOutro = true; return; }
          if (p) { if (ex.id !== pe.id) { info.textContent = `Este CPF já é de ${ex.nome}. Confira.`; info.className = 'erro small'; } return; }
          pessoaId = ex.id;
          const set = (s, val) => { if (val != null && val !== '') g(s).value = val; };
          set('#f-nome', ex.nome); set('#f-nasc', ex.nascimento); set('#f-tel', ex.telefone); set('#f-email', ex.email); set('#f-cnh', ex.cnh);
          const c = cidade(ex.cidade_origem_id); if (c) { g('#f-origem').value = c.nome; g('#f-origem').dataset.cidadeId = c.id; g('#f-uf').value = c.uf; sugerir(); }
          const adms = (ex.historico || []).filter(h => h.situacao === 'admitido');
          g('#f-ex').checked = ex.ex_colaborador || adms.length > 0;
          info.textContent = `Já cadastrada${adms.length ? ` · admitida ${adms.length} vez(es), a última em ${RH.fmtDataBR(adms.map(h => h.admitido_em).sort().pop())}` : (ex.historico || []).length ? ` · já passou por aqui ${ex.historico.length} vez(es), sem admissão` : ''}`;
        } catch (err) { info.textContent = 'Não consegui consultar o CPF agora.'; }
      });
      // só leitura de verdade: nenhum campo editável
      if (somenteLeitura) m.corpo.querySelectorAll('section:not(.fi-aval) input, section:not(.fi-aval) select, section:not(.fi-aval) textarea').forEach(x => { x.disabled = true; });
      if (adm && podeEditar) ['#f-chegada', '#f-hora', '#f-grupo', '#f-obs', '#f-cheg-st'].forEach(s => { if (g(s)) g(s).disabled = false; });
      // "Como soube da vaga": Indicação pede o nome de quem indicou
      g('#f-fonte').addEventListener('change', () => { g('#f-indicado-w').hidden = g('#f-fonte').value !== 'indicacao'; if (!g('#f-indicado-w').hidden) g('#f-indicado').focus(); });
      // ----- entrevista: estrelas e histórico de anotações -----
      let notaEntrevista = p && p.entrevista ? +p.entrevista.avaliacao || 0 : 0;
      const quadroNotas = () => g('#e-aval').querySelectorAll('[data-nota]').forEach(b => b.classList.toggle('on', +b.dataset.nota <= notaEntrevista));
      if (p) {
        g('#e-aval').addEventListener('click', e => { const b = e.target.closest('[data-nota]'); if (!b || somenteLeitura) return; notaEntrevista = notaEntrevista === +b.dataset.nota ? 0 : +b.dataset.nota; quadroNotas(); });
        const hist = () => {
          const l = (p.anotacoes || []).slice().reverse();
          g('#e-hist').innerHTML = l.length ? l.map(a => { const u = Store.usuarioPorLogin(a.por); return `<div class="fi-nota ${a.auto ? 'fi-nota-auto' : ''}">${UI.avatar(u || { nome: a.nome || a.por || '?' }, 28)}<div><div class="fi-nota-cab"><b>${UI.esc(a.nome || a.por || '—')}</b> <span class="muted">${UI.fmtDataHora(a.em)}${a.etapa ? ' · ' + (ETAPAS[a.etapa] || a.etapa) : ''}</span></div><div class="fi-nota-txt">${UI.esc(a.texto)}</div></div></div>`; }).join('')
            : '<div class="muted small">Nenhuma anotação ainda.</div>';
        };
        hist();
        const add = g('#e-add');
        if (add) add.addEventListener('click', async () => {
          const tx = g('#e-nova').value.trim(); if (!tx) { g('#e-nova').focus(); return; }
          add.disabled = true;
          try { p.anotacoes = await Nuvem.rh.anotar(p.id, tx); g('#e-nova').value = ''; hist(); UI.toast('Anotação registrada.', 'sucesso', 2000); }
          catch (err) { UI.toast(err.message, 'erro', 6000); }
          finally { add.disabled = false; }
        });
      }
      aba(abaIni || (p ? PAINEL[p.etapa] || 'dados' : 'dados'));
      setTimeout(() => { retratoIni = retrato(); }, 0);   // depois que os campos se ajustam (listas, sugestões)
      setTimeout(() => { if (document.activeElement && m.corpo.contains(document.activeElement)) document.activeElement.blur(); m.corpo.scrollTop = 0; if (!p) g('#f-nome').focus(); }, 80);
    }

    // ---------- o que falta para a pessoa avançar (usado na ficha e na impressão) ----------
    // cada item: { texto, acao: ['msg:<modelo>' | 'aba:<painel>', rótulo] | null, grave }
    function pendenciasDe(p) {
      const r = [], e = p.entrevista || {}, temTel = !!linkWhats(p.pessoa), hoje = RH.hoje();
      if (!emAndamento(p)) return r;
      if (p.etapa === 'triagem') {
        if (!contatoEm(p)) r.push({ texto: tentativas(p) ? `Ainda sem contato (${qtd(tentativas(p), 'ligação', 'ligações')} sem resposta)` : 'Fazer o primeiro contato', acao: temTel ? ['msg:triagem', '1º contato'] : ['aba:dados', 'Preencher telefone'] });
        else if (semResposta(p)) r.push({ texto: `Mandou o 1º contato e está sem resposta há ${semResposta(p)} dias`, acao: temTel ? ['msg:cobrar', 'Cobrar de novo'] : null, grave: semResposta(p) >= 7 });
      } else if (p.etapa === 'entrevista') {
        const res = e.resultado || 'aguardando';
        if (res === 'faltou') r.push({ texto: 'Não compareceu na entrevista: marque outra data ou encerre', acao: ['aba:entrevista', 'Remarcar'], grave: true });
        else if (res === 'aprovado') r.push({ texto: 'Aprovado na entrevista: falta passar para a Documentação', acao: ['aba:docs', 'Avançar'] });
        else if (!e.data) r.push({ texto: 'Entrevista sem data marcada', acao: ['aba:entrevista', 'Marcar data'] });
        else if (e.data < hoje) r.push({ texto: `Entrevista de ${RH.fmtDia(e.data)} ficou sem resultado`, acao: ['aba:entrevista', 'Marcar resultado'], grave: true });
        else if (confirmou(p) === 'nao') r.push({ texto: 'Avisou que não vem na entrevista', acao: ['aba:entrevista', 'Remarcar'], grave: true });
        else if (confirmou(p) !== 'sim') r.push({ texto: `Entrevista ${RH.fmtDia(e.data)}${e.hora ? ' às ' + e.hora : ''}: ainda não confirmou presença`, acao: temTel ? ['msg:lembrete', 'Mandar lembrete'] : null });
      } else if (p.etapa === 'documentos') {
        const din = dinamicaDe(p);
        if (din.pendentes.length) r.push({ texto: `${din.recusados.length ? 'Reenviar' : 'Falta entregar'}: ${din.pendentes.map(d => d.nome + (d.estado === 'recusado' ? ' (recusado)' : '')).join(', ')}`, acao: temTel ? ['msg:cobrardocs', 'Cobrar no WhatsApp'] : ['aba:docs', 'Conferir'], grave: din.recusados.length > 0 });
        for (const b of bloqueios(p)) {
          if (/documento|^ainda está/.test(b)) continue;
          let texto = b.charAt(0).toUpperCase() + b.slice(1);
          if (/^ASO não/.test(b) && p.aso === 'agendado' && p.aso_data) texto = p.aso_data < hoje ? `ASO de ${RH.fmtDia(p.aso_data)} passou sem resultado` : `ASO marcado para ${RH.fmtDia(p.aso_data)}${p.aso_local ? ' · ' + p.aso_local : ''}`;
          if (/^treinamento não/.test(b) && p.treinamento === 'agendado' && p.treinamento_data) texto = `Treinamento marcado para ${RH.fmtDia(p.treinamento_data)}${p.treinamento_local ? ' · ' + p.treinamento_local : ''}`;
          r.push({ texto, acao: /ASO|treinamento/.test(b) ? ['aba:docs', 'Abrir'] : ['aba:dados', 'Preencher'], grave: /menor|inapto|reprovado|cancelada|recusada|passou/.test(b + texto) });
        }
        if (!p.chegada_data && !barradaEm(p)) r.push({ texto: 'Sem data de chegada no campo', acao: ['aba:docs', 'Marcar chegada'] });
      }
      return r;
    }

    // ---------- copiar para a folha / DP (texto pronto; várias pessoas saem em colunas para colar no Excel) ----------
    const CAMPOS_FOLHA = [['Nome', p => p.pessoa.nome], ['CPF', p => p.pessoa.cpf ? RH.fmtCPF(p.pessoa.cpf) : ''], ['Nascimento', p => p.pessoa.nascimento ? RH.fmtDataBR(String(p.pessoa.nascimento).slice(0, 10)) : ''],
      ['Telefone', p => p.pessoa.telefone || ''], ['E-mail', p => p.pessoa.email || ''], ['Cargo', p => p.cargo || ''], ['Tipo', p => p.tipo === 'MOVEL' ? 'Móvel' : 'Local'],
      ['Distrito', p => (p.distrito_id && Store.distrito(p.distrito_id) || {}).nome || ''], ['Cidade onde trabalha', p => nomeCidade(trabalhoId(p))], ['Base de contratação', p => p.tipo === 'MOVEL' ? nomeCidade(p.base_id) : ''],
      ['Cidade de origem', p => nomeCidade(p.pessoa.cidade_origem_id)], ['Admitido em', p => p.admitido_em ? RH.fmtDataBR(String(p.admitido_em).slice(0, 10)) : ''],
      ['Chegada', p => p.chegada_data ? RH.fmtDataBR(p.chegada_data) + (p.chegada_hora ? ' ' + String(p.chegada_hora).slice(0, 5) : '') : ''], ['RH', p => nomeAnalista(p)]];
    async function copiarTexto(txt) {
      try { await navigator.clipboard.writeText(txt); return true; }
      catch (e) {
        const ta = document.createElement('textarea'); ta.value = txt; ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0'; document.body.appendChild(ta); ta.select();
        let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { ok = false; } ta.remove(); return ok;
      }
    }
    // Lista > Admitidos: quem está na tela (filtros de cima, busca, semana de chegada e pendência), na ordem da tela
    const admitidosDaTela = () => daLista().filter(p => p.situacao === 'admitido').sort((x, y) => String(y.admitido_em || '').localeCompare(String(x.admitido_em || '')) || x.pessoa.nome.localeCompare(y.pessoa.nome, 'pt-BR'));
    const filtrosDaTela = () => [vagaId && vagaId !== '(sem)' ? 'vaga ' + ((Store.vaga(vagaId) || {}).titulo || '') : vagaId ? 'sem vaga' : '', distritoId ? 'distrito ' + (distritoId === '(sem)' ? '(sem)' : (Store.distrito(distritoId) || {}).nome || '') : '',
      analista ? 'RH ' + (analista === '(sem)' ? '(sem)' : (Store.usuarioPorLogin(analista) || {}).nome || analista) : '', busca ? 'busca "' + busca + '"' : '', semana !== 'todas' ? 'chegada ' + (semana === 'sem' ? 'sem data' : RH.fmtDia(semana)) : '',
      pend && PEND[pend] ? PEND[pend].rotulo.toLowerCase() : ''].filter(Boolean).join(', ');
    async function copiarParaFolha(lista) {
      if (!lista.length) { UI.toast('Ninguém para copiar neste filtro.', 'aviso'); return; }
      const txt = lista.length === 1
        ? `ADMISSÃO — ${lista[0].pessoa.nome}\n` + CAMPOS_FOLHA.slice(1).filter(([r]) => r !== 'Base de contratação' || lista[0].tipo === 'MOVEL').map(([r, f]) => `${r}: ${f(lista[0]) || '—'}`).join('\n')
        : [CAMPOS_FOLHA.map(c => c[0])].concat(lista.map(p => CAMPOS_FOLHA.map(c => String(c[1](p) || '').replace(/[\t\n]+/g, ' ')))).map(l => l.join('\t')).join('\n');
      if (await copiarTexto(txt)) UI.toast(lista.length === 1 ? `Dados de ${lista[0].pessoa.nome} copiados. Cole no e-mail ou WhatsApp do DP.` : `${qtd(lista.length, 'pessoa copiada', 'pessoas copiadas')} em colunas. Cole numa planilha (Excel).`, 'sucesso', 5000);
      else UI.modal({ titulo: 'Copiar para a folha', largura: '640px', corpo: `<p class="muted" style="margin-top:0">O navegador não deixou copiar sozinho. Selecione o texto abaixo (Ctrl+A) e copie (Ctrl+C).</p><textarea rows="12" style="width:100%" readonly>${UI.esc(txt)}</textarea>`, botoes: [{ texto: 'Fechar' }] });
      try { Store.auditar('relatorio.exportar', `Dados para a folha copiados (${lista.length} pessoa(s), com CPF)`, eu); } catch (e) { /* auditoria não impede a cópia */ }
    }

    // ---------- ficha imprimível (uma folha, também serve para salvar em PDF) ----------
    function imprimirFicha(p) {
      const pe = p.pessoa, din = dinamicaDe(p), e = p.entrevista || {}, d = p.distrito_id && Store.distrito(p.distrito_id), vg = p.vaga_id ? (vagaDe(p.vaga_id) || Store.vaga(p.vaga_id)) : null;
      const lin = (r, v) => `<tr><th>${r}</th><td>${v ? UI.esc(v) : '<span class="rhn-i-vazio">—</span>'}</td></tr>`;
      const sit = p.situacao === 'admitido' ? `Admitido em ${RH.fmtDataBR(String(p.admitido_em || '').slice(0, 10))}` : emAndamento(p) ? `Em andamento · ${ETAPAS[p.etapa]}` : `${SIT[p.situacao]}${p.motivo_saida ? ': ' + p.motivo_saida : ''}`;
      const idade = RH.idade(pe.nascimento), pend = pendenciasDe(p), hist = (p.anotacoes || []).slice(-25).reverse();
      const rotDoc = { falta: 'Falta', entregue: 'Entregue', recusado: 'Recusado', dispensado: 'Não se aplica' };
      let box = document.getElementById('rhn-impressao');
      if (!box) { box = document.createElement('div'); box.id = 'rhn-impressao'; document.body.appendChild(box); }
      box.innerHTML = `<div class="rhn-i-cab"><div><div class="rhn-i-proj">${UI.esc(Store.rotuloProjeto(projeto()))} · Ficha do candidato</div><h1>${UI.esc(pe.nome)}</h1><div class="rhn-i-sit">${UI.esc(sit)}</div></div>
          <div class="rhn-i-quando">Impresso em ${UI.esc(new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }))}<br>por ${UI.esc(eu.nome)}</div></div>
        ${pend.length ? `<div class="rhn-i-bloco rhn-i-pend"><h2>Para avançar</h2><ul>${pend.map(x => `<li>${UI.esc(x.texto)}</li>`).join('')}</ul></div>` : ''}
        <div class="rhn-i-duas">
          <div class="rhn-i-bloco"><h2>Dados pessoais</h2><table>${lin('CPF', pe.cpf ? RH.fmtCPF(pe.cpf) : '')}${lin('Nascimento', pe.nascimento ? `${RH.fmtDataBR(String(pe.nascimento).slice(0, 10))}${idade != null ? ` (${idade} anos)` : ''}` : '')}${lin('Telefone', pe.telefone)}${lin('E-mail', pe.email)}${lin('Cidade onde mora', nomeCidade(pe.cidade_origem_id))}${lin('CNH', pe.cnh)}${lin('Ex-colaborador', pe.ex_colaborador ? 'Sim' : 'Não')}${lin('Como soube da vaga', p.fonte ? nomeFonte(p.fonte) + (p.indicado_por ? ': ' + p.indicado_por : '') : '')}</table></div>
          <div class="rhn-i-bloco"><h2>Vaga e destino</h2><table>${lin('Vaga', vg ? vg.titulo : '')}${lin('Cargo', p.cargo)}${lin('Distrito', d ? d.nome : '')}${lin('Tipo', p.tipo === 'MOVEL' ? 'Móvel' : 'Local')}${lin('Cidade onde trabalha', nomeCidade(trabalhoId(p)))}${p.tipo === 'MOVEL' ? lin('Base de contratação', nomeCidade(p.base_id)) : ''}${lin('Unidade', p.unidade)}${lin('RH responsável', nomeAnalista(p))}</table></div>
        </div>
        <div class="rhn-i-duas">
          <div class="rhn-i-bloco"><h2>Entrevista</h2><table>${lin('Data', e.data ? RH.fmtDataBR(e.data) + (e.hora ? ' às ' + e.hora : '') : '')}${lin('Formato', FORMATOS[e.formato] || '')}${lin('Local', e.local)}${lin('Quem entrevistou', e.entrevistador)}${lin('Resultado', e.data || e.resultado ? RESULTADOS[e.resultado || 'aguardando'] : '')}${lin('Avaliação', e.avaliacao ? '★'.repeat(+e.avaliacao) + '☆'.repeat(5 - e.avaliacao) : '')}</table>${e.notas ? `<p class="rhn-i-notas">${UI.esc(e.notas)}</p>` : ''}</div>
          <div class="rhn-i-bloco"><h2>Exame, treinamento e chegada</h2><table>${lin('ASO', `${ASO[p.aso] || ''}${p.aso_data ? ' · ' + RH.fmtDataBR(p.aso_data) : ''}${p.aso_local ? ' · ' + p.aso_local : ''}`)}${lin('Treinamento', `${TRE[p.treinamento] || ''}${p.treinamento_data ? ' · ' + RH.fmtDataBR(p.treinamento_data) : ''}${p.treinamento_local ? ' · ' + p.treinamento_local : ''}`)}${lin('Chegada', p.chegada_data ? RH.fmtDataBR(p.chegada_data) + (p.chegada_hora ? ' às ' + String(p.chegada_hora).slice(0, 5) : '') : '')}${lin('Situação da chegada', p.chegada_data ? CHEGADA[stChegada(p)] : '')}${lin('Grupo do WhatsApp', p.grupo_whatsapp)}</table></div>
        </div>
        ${din.total ? `<div class="rhn-i-bloco"><h2>Documentos (${din.total - din.pendentes.length} de ${din.total})</h2><ul class="rhn-i-docs">${din.docs.map(x => `<li class="rhn-i-d-${x.estado}"><span class="rhn-i-caixa">${x.estado === 'entregue' ? '✓' : x.estado === 'dispensado' ? '–' : x.estado === 'recusado' ? '!' : ''}</span>${UI.esc(x.nome)} <em>${rotDoc[x.estado]}</em></li>`).join('')}</ul></div>` : ''}
        ${p.observacao ? `<div class="rhn-i-bloco"><h2>Observação</h2><p>${UI.esc(p.observacao)}</p></div>` : ''}
        ${hist.length ? `<div class="rhn-i-bloco"><h2>Histórico${(p.anotacoes || []).length > hist.length ? ` (últimos ${hist.length})` : ''}</h2><table class="rhn-i-hist">${hist.map(a => `<tr><th>${UI.esc(UI.fmtDataHora(a.em))}</th><td><b>${UI.esc(a.nome || a.por || '—')}</b> — ${UI.esc(a.texto)}</td></tr>`).join('')}</table></div>` : ''}`;
      document.body.classList.add('rhn-imprimindo');
      const limpar = () => { document.body.classList.remove('rhn-imprimindo'); window.removeEventListener('afterprint', limpar); };
      window.addEventListener('afterprint', limpar);
      setTimeout(() => window.print(), 30);
    }

    // ---------- atalhos de teclado da tela ----------
    let focoId = '';
    const itensNavegaveis = () => [...q('#cd-corpo').querySelectorAll('.cd-card[data-id], .pre-pessoa[data-id]')].filter(x => x.offsetParent !== null);
    function focar(elx, rolar = true) {
      if (!elx) return;
      q('#cd-corpo').querySelectorAll('.rhn-foco').forEach(x => x.classList.remove('rhn-foco'));
      elx.setAttribute('tabindex', '-1'); elx.classList.add('rhn-foco'); elx.focus({ preventScroll: true }); if (rolar) elx.scrollIntoView({ block: 'nearest' });
      focoId = elx.dataset.id;
    }
    // usou o mouse: esquece o candidato marcado pelo teclado
    q('#cd-corpo').addEventListener('mousedown', () => { if (!focoId) return; focoId = ''; q('#cd-corpo').querySelectorAll('.rhn-foco').forEach(x => x.classList.remove('rhn-foco')); });
    function ajudaAtalhos() {
      const t = [['/', 'Procurar (vai para a busca)'], ['J ou ↓', 'Próximo candidato'], ['K ou ↑', 'Candidato anterior'], ['Enter', 'Abrir a ficha do candidato marcado'], ['W', 'Mensagem no WhatsApp para o candidato marcado'],
        ['1  2  3' + (veTudo ? '  4' : ''), 'Quadro · Lista · Agenda' + (veTudo ? ' · Por RH' : '')], ['N', 'Novo candidato'], ['Esc', 'Limpa a busca / fecha a janela'], ['?', 'Esta ajuda']].filter(([k]) => podeEditar || !/^[WN]$/.test(k));
      UI.modal({ titulo: 'Atalhos do teclado', largura: '440px', fecharAoClicarFora: true, corpo: `<table class="rhn-atalhos">${t.map(([k, d]) => `<tr><td>${k.split(/\s+ou\s+|\s{2}/).map(x => `<kbd>${UI.esc(x.trim())}</kbd>`).join(' ')}</td><td>${UI.esc(d)}</td></tr>`).join('')}</table><p class="muted small" style="margin-bottom:0">Os atalhos não funcionam enquanto você digita num campo.</p>`, botoes: [{ texto: 'Fechar' }] });
    }
    function aoTeclar(e) {
      if (!ativo || !document.body.contains(el) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector('.modal-overlay')) return;
      const alvo = e.target, digitando = alvo && (/^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName) || alvo.isContentEditable);
      if (digitando) { if (e.key === 'Escape' && alvo.id === 'cd-busca') { if (alvo.value) { alvo.value = ''; busca = ''; desenhar(); } alvo.blur(); e.preventDefault(); } return; }
      if (e.defaultPrevented) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key, atual = alvo && alvo.closest && alvo.closest('.cd-card[data-id], .pre-pessoa[data-id]');
      // Enter/W só valem com o cartão em si marcado (num botão dentro dele, o Enter é do botão)
      const pAtual = atual && atual === alvo && linhas.find(x => x.id === atual.dataset.id);
      if (k === '/') { e.preventDefault(); q('#cd-busca').focus(); q('#cd-busca').select(); return; }
      if (k === '?') { e.preventDefault(); ajudaAtalhos(); return; }
      if (k === 'j' || k === 'k' || ((k === 'ArrowDown' || k === 'ArrowUp') && atual)) {
        const l = itensNavegaveis(); if (!l.length) return;
        e.preventDefault();
        const i = atual ? l.indexOf(atual) : -1, prox = k === 'j' || k === 'ArrowDown';
        focar(l[i < 0 ? (prox ? 0 : l.length - 1) : Math.max(0, Math.min(l.length - 1, i + (prox ? 1 : -1)))]);
        return;
      }
      if ((k === 'Enter' || k === 'o') && pAtual) { e.preventDefault(); formulario(pAtual); return; }
      if (k === 'w' && pAtual && podeEditar) { e.preventDefault(); mandarMensagem(pAtual); return; }
      if (k === 'n' && podeEditar) { e.preventDefault(); formulario(null); return; }
      const vistas = ['quadro', 'lista', 'agenda'].concat(veTudo ? ['rh'] : []), n = +k;
      if (n >= 1 && n <= vistas.length) { e.preventDefault(); mudarVista(vistas[n - 1]); return; }
      if (k === 'Escape') { if (busca) { busca = ''; q('#cd-busca').value = ''; desenhar(); } else if (atual) { atual.blur(); atual.classList.remove('rhn-foco'); focoId = ''; } }
    }
    document.addEventListener('keydown', aoTeclar);
    // depois de redesenhar (ex.: atualização que chegou do banco), o candidato marcado continua marcado
    const manterFoco = new MutationObserver(() => {
      if (!focoId || (document.activeElement && document.activeElement !== document.body)) return;
      const elx = q('#cd-corpo').querySelector(`[data-id="${CSS.escape(focoId)}"]`); if (elx && elx.offsetParent !== null) focar(elx, false);
    });
    manterFoco.observe(q('#cd-corpo'), { childList: true });

    // ---------- direcionar candidatos para os RHs ----------
    function direcionarIds(ids) {
      const time = equipe();
      UI.modal({ titulo: `Direcionar ${qtd(ids.length, 'candidato', 'candidatos')}`, largura: '460px',
        corpo: `<label>Para qual RH<select id="d-para"><option value="">Escolha o RH…</option>${time.map(u => `<option value="${UI.esc(u.login)}">${UI.esc(u.nome)} · ${UI.esc(Store.PERFIS[u.perfil])}</option>`).join('')}</select></label>`,
        botoes: [{ texto: 'Cancelar' }, { texto: 'Direcionar', classe: 'btn-primario', acao: async md => {
          const sel = md.corpo.querySelector('#d-para'), u = sel.value && Store.usuarioPorLogin(sel.value);
          if (!u) { sel.focus(); throw new Error('Escolha para qual RH.'); }
          await Nuvem.rh.atualizarVarios(ids, { analista_login: u.login, analista: u.nome });
          marcados.clear(); UI.toast(`${qtd(ids.length, 'candidato direcionado', 'candidatos direcionados')} para ${u.nome}.`, 'sucesso'); await carregar();
        } }] });
    }
    function direcionar() {
      const time = equipe();
      if (!time.length) { UI.toast('Cadastre primeiro quem é do RH em Sistema → Usuários e acesso (perfil RH).', 'aviso', 6000); return; }
      const noFiltro = base({ semAnalista: analista !== '(sem)' }).filter(emAndamento);
      const semRh = noFiltro.filter(p => !chaveAnalista(p));
      const analistas = time.filter(u => u.perfil === 'analista');
      const escopo = [vagaId && vagaId !== '(sem)' ? `vaga ${(vagaDe(vagaId) || {}).titulo || ''}` : '', distritoId && distritoId !== '(sem)' ? (Store.distrito(distritoId) || {}).nome : '', busca ? `busca "${busca}"` : ''].filter(Boolean).join(', ');
      const m = UI.modal({ titulo: 'Direcionar candidatos para o RH', largura: '560px', fecharAoClicarFora: false,
        corpo: `<p class="muted small" style="margin-top:0">Vale para quem está em andamento${escopo ? ` no filtro atual (${UI.esc(escopo)})` : ' neste projeto'}. Para direcionar só um grupo, filtre antes por vaga ou distrito.</p>
          <div class="cd-opcoes">
            <label class="cd-opcao"><input type="radio" name="d-quem" value="sem" ${semRh.length ? 'checked' : 'disabled'}> <span><b>Só quem está sem RH</b><small>${qtd(semRh.length, 'candidato', 'candidatos')}</small></span></label>
            <label class="cd-opcao"><input type="radio" name="d-quem" value="todos" ${semRh.length ? '' : 'checked'}> <span><b>Todos do filtro</b><small>${qtd(noFiltro.length, 'candidato', 'candidatos')}, inclusive quem já tem RH</small></span></label>
          </div>
          <label style="margin-top:14px">Direcionar para<select id="d-para"><option value="">Escolha o RH…</option>${time.map(u => `<option value="${UI.esc(u.login)}">${UI.esc(u.nome)} · ${UI.esc(Store.PERFIS[u.perfil])}</option>`).join('')}
            ${analistas.length > 1 ? `<option value="(dividir)">Dividir igualmente entre os RHs (${UI.esc(analistas.map(u => u.nome).join(', '))})</option>` : ''}</select></label>`,
        botoes: [{ texto: 'Cancelar' }, { texto: 'Direcionar', classe: 'btn-primario', acao: async md => {
          const todosFiltro = md.corpo.querySelector('input[name="d-quem"]:checked').value !== 'sem';
          const alvo = todosFiltro ? noFiltro : semRh;
          if (!alvo.length) throw new Error('Não há candidatos para direcionar neste filtro.');
          const sel = md.corpo.querySelector('#d-para'), para = sel.value;
          if (!para) { sel.focus(); throw new Error('Escolha para qual RH.'); }
          const jaTem = alvo.filter(p => chaveAnalista(p)).length;
          if (todosFiltro && !await UI.confirmar(`Direcionar ${qtd(alvo.length, 'candidato', 'candidatos')}${jaTem ? `, inclusive ${qtd(jaTem, 'que já tem RH', 'que já têm RH')}` : ''}? Quem já tinha RH passa para o novo.`, { titulo: 'Todos do filtro', textoOk: `Direcionar ${alvo.length}` })) return false;
          const destinos = para === '(dividir)' ? analistas : [Store.usuarioPorLogin(para)];
          // divisão igual: um para cada, em rodízio, na ordem alfabética
          const lotes = destinos.map(() => []);
          alvo.slice().sort((a, b) => a.pessoa.nome.localeCompare(b.pessoa.nome, 'pt-BR')).forEach((p, i) => lotes[i % destinos.length].push(p.id));
          for (let i = 0; i < destinos.length; i++) if (lotes[i].length) await Nuvem.rh.atualizarVarios(lotes[i], { analista_login: destinos[i].login, analista: destinos[i].nome });
          UI.toast(`${qtd(alvo.length, 'candidato direcionado', 'candidatos direcionados')}${destinos.length > 1 ? ` (${destinos.map((u, i) => `${u.nome}: ${lotes[i].length}`).join(', ')})` : ` para ${destinos[0].nome}`}.`, 'sucesso', 6000);
          if (analista === '(sem)') analista = '';
          await carregar();
        } }] });
      return m;
    }

    // ---------- importar planilha (respostas do formulário ou planilha da semana) ----------
    function lerPlanilha(arquivo) {
      const nome = arquivo.name.toLowerCase();
      if (!nome.endsWith('.xlsx') && !nome.endsWith('.xls')) return UI.lerArquivo(arquivo).then(l => [{ nome: arquivo.name, linhas: l }]);
      if (typeof XLSX === 'undefined') return Promise.reject(new Error('Leitura de Excel indisponível (sem internet para carregar a biblioteca).'));
      return new Promise((resolve, reject) => {
        const leitor = new FileReader();
        leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
        leitor.onload = e => {
          try {
            // valores brutos: data vem como número de série do Excel e é convertida aqui (evita confundir dia com mês)
            const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
            resolve(wb.SheetNames.map(n => ({ nome: n, linhas: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }) })));
          } catch (err) { reject(err); }
        };
        leitor.readAsArrayBuffer(arquivo);
      });
    }
    function importar() {
      const ufs = Store.ufsProjeto(projeto());
      const resolver = { ufsProjeto: ufs, cidade: (nome, uf) => Store.resolverCidade(nome, uf) || Store.cidadeAproximada(nome, uf) };
      const vagas = vagasProjeto().filter(x => !['preenchida', 'cancelada'].includes(x.status));
      const time = equipe(), analistas = time.filter(u => u.perfil === 'analista');
      const m = UI.modal({ titulo: `Importar candidatos — ${projeto().nome}`, largura: '920px', fecharAoClicarFora: false, botoes: [{ texto: 'Fechar' }], corpo: `
        <p class="muted small" style="margin-top:0">Escolha a planilha com as respostas do formulário de candidatura (ou a planilha da semana, no modelo SEMANA). Nada é gravado antes de você conferir e confirmar.
          Linha com erro não entra; linha com aviso entra com o campo em branco. Quem já está em andamento neste projeto é ignorado. Depois dá para desfazer a importação inteira.</p>
        <input type="file" id="i-arquivo" accept=".xlsx,.xls,.csv">
        <div id="i-config" hidden>
          <div class="cd-imp-config">
            <label id="i-aba-wrap" hidden>Aba da planilha<select id="i-aba"></select></label>
            <label>Estas pessoas entram em<select id="i-etapa"><option value="triagem">Triagem (candidaturas novas)</option><option value="entrevista">Entrevista</option><option value="documentos">Documentação (já aprovadas)</option></select></label>
            <label>Vaga<select id="i-vaga"><option value="">Sem vaga definida</option>${vagas.map(x => `<option value="${x.id}" ${x.id === vagaId ? 'selected' : ''}>${UI.esc(x.titulo)}${x.porDistrito.length ? ' · ' + UI.esc(x.porDistrito.map(d => d.distrito.nome).join(', ')) : ''}</option>`).join('')}</select></label>
            <label>RH responsável<select id="i-rh"></select></label>
            <label>Conta como LOCAL quem mora a até<span class="cd-imp-km"><input id="i-km" type="number" min="0" step="5" value="${limiteKm}"> km do distrito</span></label>
          </div>
          <details class="cd-pre" id="i-colunas-wrap"><summary>Colunas da planilha <span class="muted" id="i-colunas-res"></span></summary><div class="cd-imp-colunas" id="i-colunas"></div></details>
        </div>
        <div id="i-previa" style="margin-top:12px"></div>
        <div class="pre-form-titulo" style="margin-top:18px">Importações recentes deste projeto</div>
        <div id="i-recentes" class="small muted">Carregando…</div>` });
      const g = s => m.corpo.querySelector(s);
      let abas = [], arquivoNome = '', cab = null;
      async function recentes() {
        try {
          const l = await Nuvem.rh.importacoes(projetoId);
          g('#i-recentes').innerHTML = !l.length ? 'Nenhuma ainda.' : l.map(i => `<div class="pre-imp" data-lote="${i.id}">${UI.fmtDataHora(i.criado_em)} · ${UI.esc(i.criado_login || '—')} · ${UI.esc(i.arquivo || 'sem nome')} · <b>${i.importadas}</b> importada(s), ${i.ignoradas} ignorada(s)
            ${i.desfeita_em ? ' · <span class="badge badge-cinza">desfeita</span>' : ' · <button class="btn-link perigo" data-desfazer>Desfazer</button>'}</div>`).join('');
        } catch (e) { g('#i-recentes').textContent = 'Não foi possível carregar.'; }
      }
      g('#i-recentes').addEventListener('click', async e => {
        const b = e.target.closest('[data-desfazer]'); if (!b) return;
        if (!await UI.confirmar('Desfazer esta importação? Saem as pessoas que entraram por ela e que ninguém mexeu ainda. Quem já avançou, teve documento marcado, foi direcionado ou admitido fica.', { perigo: true, textoOk: 'Desfazer' })) return;
        try { const r = await Nuvem.rh.desfazer(b.closest('[data-lote]').dataset.lote); UI.toast(`Importação desfeita: ${r.preadmissoes} linha(s) removida(s)${r.admitidos_mantidos ? `, ${r.admitidos_mantidos} admitido(s) mantido(s)` : ''}${r.mexidos_mantidos ? `, ${r.mexidos_mantidos} mantido(s) porque já tinham sido trabalhados` : ''}.`, 'sucesso', 8000); await recentes(); await carregar(); }
        catch (err) { UI.toast(err.message, 'erro', 7000); }
      });
      function opcoesRh() {
        const vg = vagaDe(g('#i-vaga').value), atual = g('#i-rh').value;
        const doVaga = vg && vg.recrutadorLogin ? Store.usuarioPorLogin(vg.recrutadorLogin) : null;
        g('#i-rh').innerHTML = '<option value="">Não definir agora</option>' + (doVaga ? `<option value="(vaga)">O responsável da vaga (${UI.esc(doVaga.nome)})</option>` : '') +
          (cab && cab.mapa.analista !== undefined ? '<option value="(planilha)">O que está na coluna da planilha</option>' : '') +
          (analistas.length > 1 ? `<option value="(dividir)">Dividir igualmente entre os RHs (${UI.esc(analistas.map(u => u.nome).join(', '))})</option>` : '') +
          time.map(u => `<option value="${UI.esc(u.login)}">${UI.esc(u.nome)}</option>`).join('');
        g('#i-rh').value = [...g('#i-rh').options].some(o => o.value === atual) && atual ? atual : (cab && cab.modelo === 'semana' && cab.mapa.analista !== undefined ? '(planilha)' : doVaga ? '(vaga)' : '');
      }
      function desenharColunas() {
        const tit = cab.titulos;
        g('#i-colunas').innerHTML = Object.entries(RH.CAMPOS).map(([campo, rot]) => `<label>${rot}<select data-campo="${campo}"><option value="">(não tem)</option>${tit.map(x => `<option value="${x.i}" ${cab.mapa[campo] === x.i ? 'selected' : ''}>${UI.esc(x.titulo.length > 60 ? x.titulo.slice(0, 58) + '…' : x.titulo)}</option>`).join('')}</select></label>`).join('');
        const achadas = Object.keys(RH.CAMPOS).filter(c => cab.mapa[c] !== undefined).length;
        g('#i-colunas-res').textContent = `(${achadas} de ${Object.keys(RH.CAMPOS).length} reconhecidas${cab.mapa.origem === undefined ? ' · falta apontar a cidade' : ''})`;
      }
      function previa() {
        const aba = abas[+g('#i-aba').value || 0], alvo = g('#i-previa');
        if (!cab) { alvo.innerHTML = '<div class="caixa caixa-aviso">Não achei a linha de títulos nesta aba (precisa ter pelo menos a coluna do nome).</div>'; return; }
        limiteKm = Math.max(0, parseInt(g('#i-km').value, 10) || 0); guardar('maparh:cand-km', String(limiteKm));
        const etapa = g('#i-etapa').value, vg = vagaDe(g('#i-vaga').value), rh = g('#i-rh').value;
        const res = RH.interpretar(aba.linhas, cab, resolver, { cpfOpcional: etapa !== 'documentos' || cab.modelo === 'forms' });
        const boas = res.filter(r => !r.erros.length), comErro = res.filter(r => r.erros.length), comAviso = boas.filter(r => r.avisos.length);
        const problemas = res.filter(r => r.erros.length || r.avisos.length);
        // destino de cada pessoa: distrito mais próximo e LOCAL/MÓVEL. No modelo SEMANA vale o tipo que já veio na planilha.
        const porDist = new Map(); let semDestino = 0;
        boas.forEach((r, i) => {
          const d = r.dados, s = sugerirDestino(d.cidade_origem_id, vg);
          d.etapa = etapa; d.vaga_id = vg ? vg.id : ''; d.cargo = d.cargo || (vg ? vg.titulo : '');
          // Triagem/Entrevista: o destino é decidido ao ir para a Documentação; aqui só serve de prévia
          const fixo = etapa === 'documentos' || !!distritoUnico(vg);   // vaga de um distrito só: não há o que decidir
          d.distrito_id = s && fixo ? s.distrito.id : ''; d.distancia_km = s && fixo ? String(s.km) : '';
          if (s && cab.mapa.tipo === undefined) d.tipo = s.tipo;
          if (!s) semDestino++; else { const a = porDist.get(s.distrito.id) || { distrito: s.distrito, locais: 0, moveis: 0 }; if (d.tipo === 'MOVEL') a.moveis++; else a.locais++; porDist.set(s.distrito.id, a); }
          let u = null;
          if (rh === '(vaga)') u = vg && Store.usuarioPorLogin(vg.recrutadorLogin); else if (rh === '(dividir)') u = analistas[i % analistas.length];
          else if (rh === '(planilha)') { const l = loginPeloNome(d.analista); u = l ? Store.usuarioPorLogin(l) : null; }
          else if (rh) u = Store.usuarioPorLogin(rh);
          if (u) { d.analista = u.nome; d.analista_login = u.login; } else { d.analista_login = ''; if (rh !== '(planilha)') d.analista = ''; }
        });
        const pedido = id => vg ? vg.porDistrito.find(x => x.distrito.id === id) : null;
        const distLinhas = [...porDist.values()].sort((a, b) => a.distrito.nome.localeCompare(b.distrito.nome, 'pt-BR', { numeric: true }));
        alvo.innerHTML = `
          <div class="cd-imp-resumo"><span><b>${res.length}</b> ${res.length === 1 ? 'linha lida' : 'linhas lidas'}</span><span class="${boas.length ? 'bom' : ''}"><b>${boas.length}</b> prontas para entrar</span>
            <span class="${comAviso.length ? 'alerta' : ''}"><b>${comAviso.length}</b> com aviso</span><span class="${comErro.length ? 'alerta' : ''}"><b>${comErro.length}</b> com erro (não entram)</span></div>
          ${boas.length ? `<div class="cd-imp-dist">
            <div class="cd-imp-grade cd-imp-cab"><span>Para onde vão</span><span>Locais</span><span>Móveis</span>${vg ? '<span>A vaga pede</span>' : '<span></span>'}</div>
            ${distLinhas.map(a => { const pd = pedido(a.distrito.id); return `<div class="cd-imp-grade"><b>${UI.esc(a.distrito.nome)}</b><span>${a.locais}</span><span>${a.moveis}</span><span class="muted">${pd ? `${pd.locais} locais · ${pd.moveis} móveis` : ''}</span></div>`; }).join('')}
            ${semDestino ? `<div class="cd-imp-grade cd-imp-sem"><b>Sem distrito</b><span>${semDestino}</span><span></span><span class="muted">${distritosProjeto().length ? 'cidade não reconhecida ou em branco' : 'nenhum distrito cadastrado neste projeto'}</span></div>` : ''}
          </div>` : ''}
          ${problemas.length ? `<div class="tabela-wrap" style="max-height:220px;overflow:auto;margin-top:10px"><table class="tabela"><thead><tr><th>Linha</th><th>Nome</th><th>Problema</th></tr></thead><tbody>
            ${problemas.slice(0, 200).map(r => `<tr><td>${r.n}</td><td>${UI.esc(r.dados.nome || '—')}</td><td>${r.erros.map(x => `<span class="erro">${UI.esc(x)}</span>`).concat(r.avisos.map(x => `<span class="muted">${UI.esc(x)}</span>`)).join('<br>')}</td></tr>`).join('')}
            </tbody></table></div>` : (res.length ? '<p class="small" style="margin-bottom:0">Nenhum problema encontrado.</p>' : '')}
          <div class="linha" style="margin-top:12px"><button class="btn btn-primario" id="i-confirmar" ${boas.length ? '' : 'disabled'}>Importar ${qtd(boas.length, 'pessoa', 'pessoas')} para ${ETAPAS[etapa]}</button>
            ${problemas.length ? '<button class="btn" id="i-relatorio">Baixar a lista de problemas</button>' : ''}</div>`;
        const rel = g('#i-relatorio'); if (rel) rel.addEventListener('click', () => UI.baixarCSV('problemas-importacao.csv', [['LINHA', 'NOME', 'TIPO', 'PROBLEMA']].concat(problemas.flatMap(r => r.erros.map(x => [r.n, r.dados.nome, 'erro', x]).concat(r.avisos.map(x => [r.n, r.dados.nome, 'aviso', x]))))));
        g('#i-confirmar').addEventListener('click', async ev => {
          ev.target.disabled = true; ev.target.textContent = 'Importando…';
          try {
            const r = await Nuvem.rh.importar(projetoId, `${arquivoNome}${abas.length > 1 ? ' / ' + aba.nome : ''}`, boas.map(x => x.dados));
            const ign = (r.detalhes || []).length;
            alvo.innerHTML = `<div class="caixa caixa-info"><b>${r.importadas}</b> pessoa(s) importada(s) para ${ETAPAS[etapa]}.${ign ? ` ${ign} ignorada(s) por já estarem em andamento neste projeto.` : ''}${comErro.length ? ` ${comErro.length} linha(s) com erro ficaram de fora.` : ''}</div>`;
            g('#i-config').hidden = true;
            await recentes(); await carregar();
          } catch (err) { UI.toast(err.message, 'erro', 8000); ev.target.disabled = false; ev.target.textContent = `Importar ${qtd(boas.length, 'pessoa', 'pessoas')} para ${ETAPAS[etapa]}`; }
        });
      }
      function trocarAba() {
        const aba = abas[+g('#i-aba').value || 0];
        cab = aba ? RH.lerCabecalho(aba.linhas) : null;
        g('#i-config').hidden = !cab;
        if (cab) {
          g('#i-etapa').value = cab.modelo === 'semana' ? 'documentos' : 'triagem';
          g('#i-colunas-wrap').hidden = cab.modelo === 'semana';
          g('#i-colunas-wrap').open = cab.modelo === 'forms' && cab.mapa.origem === undefined;
          desenharColunas(); opcoesRh();
        }
        previa();
      }
      g('#i-arquivo').addEventListener('change', async e => {
        const f = e.target.files[0]; if (!f) return;
        g('#i-previa').innerHTML = '<span class="muted">Lendo…</span>';
        try {
          abas = await lerPlanilha(f); arquivoNome = f.name;
          const comCab = abas.findIndex(a => RH.lerCabecalho(a.linhas));
          g('#i-aba').innerHTML = abas.map((a, i) => `<option value="${i}" ${i === Math.max(0, comCab) ? 'selected' : ''}>${UI.esc(a.nome)}</option>`).join('');
          g('#i-aba-wrap').hidden = abas.length < 2;
          trocarAba();
        } catch (err) { g('#i-previa').innerHTML = `<div class="caixa caixa-aviso">${UI.esc(err.message)}</div>`; }
      });
      g('#i-aba').addEventListener('change', trocarAba);
      g('#i-colunas').addEventListener('change', e => { const s = e.target.closest('select[data-campo]'); if (!s) return; if (s.value === '') delete cab.mapa[s.dataset.campo]; else cab.mapa[s.dataset.campo] = +s.value; desenharColunas(); previa(); });
      g('#i-vaga').addEventListener('change', () => { opcoesRh(); previa(); });
      for (const id of ['#i-etapa', '#i-rh', '#i-km']) g(id).addEventListener('change', previa);
      recentes();
    }

    // ---------- BANCO DE TALENTOS: quem foi avaliado "recontrataria" (ou talvez) em outra safra e ainda não está nesta ----------
    // A lista vem da função do banco (sem CPF). WhatsApp com a mensagem de nova safra; "Trazer" cria o candidato aqui, na Triagem.
    async function bancoTalentos() {
      const proj = projeto(), souRh = eu.perfil === 'analista';
      let lista = null, erro = '', aba = 'sim', bq = '';
      const m = UI.modal({ titulo: `Banco de talentos · ${Store.rotuloProjeto(proj)}`, largura: '920px',
        corpo: `<p class="muted" style="margin-top:0">Quem trabalhou em outras safras, foi avaliado como <b>recontrataria</b> (ou talvez) e ainda não está neste projeto. Chame pelo WhatsApp e, se a pessoa topar, clique em <b>Trazer para esta safra</b>: ela entra na Triagem ${souRh ? 'no seu nome' : 'sem RH (direcione depois)'}, com o cadastro que já existe.</p>
          <div class="rhs-banco-topo"><div class="cd-segs" id="bt-abas"></div><input class="busca" id="bt-busca" placeholder="Procurar por nome, cidade ou cargo…" aria-label="Procurar no banco de talentos"></div>
          <div id="bt-lista" class="rhs-banco"><div class="vazio">Carregando…</div></div>`,
        botoes: [{ texto: 'Fechar' }] });
      const g = s => m.corpo.querySelector(s);
      const msgNovaSafra = x => `Olá, ${primeiroNome(x.nome)}! Aqui é ${primeiroNome(eu.nome)}, do RH. Você trabalhou com a gente na ${x.projeto_nome}${x.cargo ? ' como ' + String(x.cargo).toLowerCase() : ''} e queremos você de volta na nova safra (${proj.nome}).\nTem interesse? Me responde por aqui que eu te passo os detalhes.`;
      function pintar() {
        if (!g('#bt-lista')) return;
        if (erro) { g('#bt-lista').innerHTML = `<div class="vazio erro">Não foi possível carregar: ${UI.esc(erro)}</div>`; g('#bt-abas').innerHTML = ''; return; }
        if (!lista) return;
        const n = k => lista.filter(x => x.recontrataria === k).length;
        if (!n(aba) && n(aba === 'sim' ? 'talvez' : 'sim')) aba = aba === 'sim' ? 'talvez' : 'sim';
        g('#bt-abas').innerHTML = [['sim', 'Recontrataria'], ['talvez', 'Talvez']].map(([k, r]) => `<button type="button" class="cd-seg ${aba === k ? 'ativa' : ''}" data-bt-aba="${k}">${r} <span class="aba-num">${n(k)}</span></button>`).join('');
        const b = Store.normalizar(bq);
        const l = lista.filter(x => x.recontrataria === aba && (!b || Store.normalizar([x.nome, nomeCidade(x.cidade_origem_id), x.cargo, x.projeto_nome].join(' ')).includes(b)))
          .sort((x, y) => (y.nota || 0) - (x.nota || 0) || String(y.avaliado_em || '').localeCompare(String(x.avaliado_em || '')) || String(x.nome).localeCompare(String(y.nome), 'pt-BR'));
        if (!lista.length) { g('#bt-lista').innerHTML = '<div class="vazio">Ninguém no banco de talentos ainda.<br><span class="small">Ele se forma com a avaliação de fim de safra: em Contratações (ou na ficha de quem foi admitido), marque se recontrataria. Quem for "Sim" ou "Talvez" aparece aqui na próxima safra.</span></div>'; return; }
        if (!l.length) { g('#bt-lista').innerHTML = `<div class="vazio">Ninguém ${bq ? 'com essa busca' : 'nesta aba'}.</div>`; return; }
        g('#bt-lista').innerHTML = l.slice(0, 200).map(x => {
          const tel = RH.soDigitos(x.telefone), cid = nomeCidade(x.cidade_origem_id);
          return `<div class="rhs-bl" data-pre="${x.pre_id}">
            <div class="rhs-bl-quem"><b>${UI.esc(x.nome)}</b><div class="muted small">${[cid ? 'mora em ' + UI.esc(cid) : '', x.telefone ? UI.esc(x.telefone) : 'sem telefone'].filter(Boolean).join(' · ')}</div></div>
            <div class="rhs-bl-onde"><div>${UI.esc(x.cargo || 'Cargo não informado')}${x.tipo === 'MOVEL' ? ' <span class="muted small">(móvel)</span>' : ''}</div><div class="muted small">${UI.esc(x.projeto_nome || '')}${x.avaliado_em ? ' · avaliado em ' + RH.fmtDataBR(String(x.avaliado_em).slice(0, 10)) : ''}${x.avaliado_por ? ' por ' + UI.esc(String(x.avaliado_por).split(' ')[0]) : ''}</div></div>
            <div class="rhs-bl-aval">${RhSafra.selo({ avaliacao_recontrataria: x.recontrataria, avaliacao_nota: x.nota, avaliacao_obs: x.observacao, avaliado_em: x.avaliado_em }, true)}${x.observacao ? `<div class="small rhs-bl-obs">${UI.esc(x.observacao)}</div>` : ''}</div>
            <div class="rhs-bl-acoes">${tel.length >= 10 ? `<a class="btn btn-pequeno btn-wa" target="_blank" rel="noopener" href="https://wa.me/55${tel}?text=${encodeURIComponent(msgNovaSafra(x))}" title="Abre o WhatsApp com a mensagem de nova safra">WhatsApp</a>` : ''}<button type="button" class="btn btn-pequeno btn-primario" data-trazer="${x.pre_id}">Trazer para esta safra</button></div>
          </div>`;
        }).join('') + (l.length > 200 ? `<div class="vazio small">Mostrando 200 de ${l.length}. Use a busca para achar os outros.</div>` : '');
      }
      g('#bt-abas').addEventListener('click', e => { const b = e.target.closest('[data-bt-aba]'); if (b) { aba = b.dataset.btAba; pintar(); } });
      g('#bt-busca').addEventListener('input', UI.debounce(e => { bq = e.target.value.trim(); pintar(); }, 150));
      g('#bt-lista').addEventListener('click', async e => {
        const b = e.target.closest('[data-trazer]'); if (!b) return;
        const x = lista.find(y => y.pre_id === b.dataset.trazer); if (!x) return;
        b.disabled = true; b.textContent = 'Trazendo…';
        try {
          await Nuvem.rh.trazerDoBanco(x.pre_id, projetoId);
          lista = lista.filter(y => y.pessoa_id !== x.pessoa_id);
          UI.toast(`${x.nome} entrou na Triagem desta safra${souRh ? '' : ' sem RH: direcione para alguém'}.`, 'sucesso', 5000);
          pintar(); carregar();
        } catch (err) { b.disabled = false; b.textContent = 'Trazer para esta safra'; UI.toast(RhSafra.limpar(err.message), 'erro', 6000); }
      });
      try { lista = await Nuvem.rh.bancoTalentos(projetoId); } catch (e) { erro = RhSafra.limpar(e.message) || 'erro'; }
      pintar();
    }

    // ---------- exportar no modelo da planilha SEMANA ----------
    function exportar() {
      const l = vista === 'lista' ? daLista() : base().filter(p => p.situacao === 'em_andamento' || p.situacao === 'admitido');
      if (!l.length) { UI.toast('Nada para exportar neste filtro.', 'aviso'); return; }
      const ctx = { cidade: id => cidade(id), pendentes: p => dinamicaDe(p).pendentes.map(d => d.nome + (d.estado === 'recusado' ? ' (recusado)' : '')), distrito: id => (Store.distrito(id) || {}).nome || '' };
      const ordem = { triagem: 0, entrevista: 1, documentos: 2 };
      const matriz = l.slice().sort((a, b) => (a.situacao === 'admitido') - (b.situacao === 'admitido') || (b.chegada_data ? 1 : 0) - (a.chegada_data ? 1 : 0) || String(a.chegada_data || '').localeCompare(String(b.chegada_data || '')) || ordem[b.etapa] - ordem[a.etapa] || a.pessoa.nome.localeCompare(b.pessoa.nome, 'pt-BR')).map(p => RH.linhaSemana(p, ctx));
      const nome = `SEMANA - ${projeto().nome}${semana !== 'todas' && semana !== 'sem' && vista === 'lista' ? ' - ' + RH.fmtDia(semana).replace('/', '-') : ''}`.replace(/[\\/:*?"<>|]/g, '-');
      if (typeof XLSX !== 'undefined') XLSX.writeFile(RH.planilhaSemana(XLSX, matriz), nome + '.xlsx');
      else UI.baixarCSV(nome + '.csv', [RH.CAB_SEMANA].concat(matriz.map(r => r.map((v, j) => [1, 8, 14].includes(j) ? RH.fmtDataBR(v) : v))));
      UI.toast(`${qtd(l.length, 'pessoa exportada', 'pessoas exportadas')} no modelo da planilha SEMANA.`, 'sucesso');
      Store.auditar('relatorio.exportar', `Candidatos exportados no modelo SEMANA (${l.length} pessoa(s), com dados pessoais)`, eu);
    }

    q('#cd-hoje').addEventListener('click', e => {
      const b = e.target.closest('[data-hoje]'); if (!b) return;
      if (b.dataset.hoje === 'agenda') { semanaAg = null; return mudarVista('agenda'); }
      if (b.dataset.hoje === 'triagem') { seg = 'triagem'; pend = ''; return mudarVista('lista'); }
      if (b.dataset.hoje === 'confirmar') return mensagemEmLote(amanhaSemConfirmar(base().filter(emAndamento)), 'lembrete');
      if (b.dataset.hoje.startsWith('pend:')) {
        // pend:<filtro>[:<etapa>]; sem etapa, vai para a primeira etapa do filtro que tem alguém
        const [, k, s] = b.dataset.hoje.split(':'), segs = (PEND[k] && PEND[k].segs) || ['documentos'], bb = base();
        pend = k; seg = s || segs.find(x => bb.some(p => noSeg(p, x) && PEND[k].teste(p))) || segs[0]; semana = 'todas'; marcados.clear(); return mudarVista('lista');
      }
      seg = 'documentos'; pend = 'prontas'; mudarVista('lista');
    });
    function mudarVista(v) { vista = v; guardar('maparh:cand-vista', v); desenhar(); }
    q('#cd-abas').addEventListener('click', e => { const b = e.target.closest('[data-vista]'); if (b) mudarVista(b.dataset.vista); });
    q('#cd-projeto').addEventListener('change', e => { projetoId = e.target.value; guardar('maparh:cand-projeto', projetoId);
      App.filtros.projetoId = projetoId; guardar('maparh:filtros', JSON.stringify(App.filtros));
      try { App.atualizarFiltroProjetos(); App.atualizarFiltroDistrito(); if (App.atualizarFiltroUF) App.atualizarFiltroUF(); } catch (er) { /* ok */ }
      vagaId = distritoId = analista = ''; guardar('maparh:cand-vaga', ''); const c = Nuvem.rh.emCache && Nuvem.rh.emCache(projetoId); linhas = c || []; if (c) desenhar(); else q('#cd-corpo').innerHTML = '<div class="vazio">Carregando…</div>'; carregar(); });
    q('#cd-vaga').addEventListener('change', e => { vagaId = e.target.value; guardar('maparh:cand-vaga', vagaId); desenhar(); });
    q('#cd-distrito').addEventListener('change', e => { distritoId = e.target.value; desenhar(); });
    q('#cd-analista').addEventListener('change', e => { analista = e.target.value; desenhar(); });
    q('#cd-busca').addEventListener('input', UI.debounce(e => { busca = e.target.value.trim(); desenhar(); }, 200));
    q('#cd-exportar').addEventListener('click', exportar);
    if (q('#cd-novo')) q('#cd-novo').addEventListener('click', () => formulario(null));
    if (q('#cd-importar')) q('#cd-importar').addEventListener('click', importar);
    if (q('#cd-mensagens')) q('#cd-mensagens').addEventListener('click', editarMensagens);
    if (q('#cd-banco')) q('#cd-banco').addEventListener('click', bancoTalentos);
    q('#rhn-atalhos').addEventListener('click', ajudaAtalhos);
    // abre com o que já tinha (se tiver) e atualiza por trás; "Carregando…" só na primeira vez
    { const c = typeof Nuvem !== 'undefined' && Nuvem.rh.emCache && Nuvem.rh.emCache(projetoId);
      if (c) { linhas = c; contarVagas(); desenhar(); } else q('#cd-corpo').innerHTML = '<div class="vazio">Carregando…</div>'; }
    carregar();
    // mudou algo (aqui ou em outro computador): busca as pessoas de novo e redesenha no lugar; com janela aberta, só guarda e redesenha depois
    // presença: foto de quem está com a ficha aberta, no cartão / linha (sem redesenhar a tela)
    function marcarOlhando() {
      const corpo = q('#cd-corpo'); if (!corpo) return;
      corpo.querySelectorAll('.cd-card[data-id], .pre-pessoa[data-id]').forEach(el => {
        const html = App.olhandoHtml('candidato:' + el.dataset.id, 18);
        let b = el.querySelector('.cd-olhando');
        if (!html) { if (b) b.remove(); return; }
        if (!b) { b = document.createElement('div'); b.className = 'cd-olhando'; el.prepend(b); }
        if (b.innerHTML !== html) b.innerHTML = html;
      });
    }
    let timerOlhando = 0;
    const agendarOlhando = () => { clearTimeout(timerOlhando); timerOlhando = setTimeout(marcarOlhando, 30); };
    document.addEventListener('maparh:presenca', agendarOlhando);
    const aoRedesenhar = new MutationObserver(agendarOlhando);
    aoRedesenhar.observe(q('#cd-corpo'), { childList: true });
    let pendenteRedesenho = false;
    // info: { ids } = candidatos que mudaram (busca só esses); { semCandidatos } = mudou vaga/cadastro (não busca candidatos, só redesenha)
    App.aoAtualizar(async info => {
      if (!ativo) return;
      info = info || {};
      if (!info.semCandidatos) {
        const pid = projetoId;
        try {
          const novas = info.ids && info.ids.length && Nuvem.rh.atualizarIds ? await Nuvem.rh.atualizarIds(pid, info.ids) : await Nuvem.rh.listar(pid);
          if (!ativo || pid !== projetoId) return; linhas = novas; contarVagas();
        } catch (e) { return; }
      }
      if (document.querySelector('.modal-overlay')) { pendenteRedesenho = true; return; }
      desenhar();
    });
    const aoFecharJanela = new MutationObserver(() => { if (pendenteRedesenho && ativo && !document.querySelector('.modal-overlay')) { pendenteRedesenho = false; desenhar(); } });
    aoFecharJanela.observe(document.body, { childList: true });
    return () => { ativo = false; aoFecharJanela.disconnect(); aoRedesenhar.disconnect(); manterFoco.disconnect(); document.removeEventListener('keydown', aoTeclar); document.removeEventListener('maparh:presenca', agendarOlhando); };
  }
};
