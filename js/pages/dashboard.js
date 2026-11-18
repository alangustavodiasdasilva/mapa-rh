// Início: o fluxo do RH em quatro passos com os números de hoje, e abaixo os indicadores das contratações.
Paginas.dashboard = {
  titulo: 'Início',
  // último andamento guardado (ou a lista de Candidatos, que tem os mesmos campos): o Início abre já com números
  cacheDe(pid) {
    const c = this._cache; if (c && c.pid === pid) return c;
    const l = typeof Nuvem !== 'undefined' && Nuvem.rh && Nuvem.rh.emCache && pid ? Nuvem.rh.emCache(pid) : null;
    return l ? { pid, l, j: '' } : null;
  },
  render(el) {
    const regs = App.regs();
    const projetos = App.projetosVisiveis().filter(p => !App.filtros.projetoId || p.id === App.filtros.projetoId);
    const r = Analise.resumo(regs);
    const graficos = [];
    const podeEditar = App.podeEditar();

    if (!Store.projetos().length) {
      el.innerHTML = `
        <div class="card boas-vindas">
          <h2>Bem-vindo ao Safra RH</h2>
          <p>O sistema acompanha o RH do começo ao fim: <b>abrir a vaga</b>, <b>divulgar</b>, <b>selecionar os candidatos</b> e, ao admitir, <b>ver no mapa</b> de onde as pessoas vêm e onde trabalham.</p>
          <ol class="passos-inicio">
            <li><b>Crie um projeto</b> — é o estado e o ano das contratações (ex.: "Contratações RS 2026").</li>
            <li><b>Confira os distritos e microrregiões</b> — o distrito Lagoa Vermelha já vem montado.</li>
            <li><b>Abra as vagas</b> e divulgue nos canais (SINE, LinkedIn, Indeed, WhatsApp, rádio…).</li>
            <li><b>Cadastre os candidatos</b> e avance cada um até a admissão. Quem já foi contratado antes pode ser importado da planilha em Contratações.</li>
          </ol>
          <div class="linha mt">
            ${podeEditar ? `<button class="btn btn-primario" id="btn-novo-projeto">Criar o primeiro projeto</button>
            <button class="btn" id="btn-exemplo">Carregar dados de exemplo</button>` : '<span class="muted">Peça a um gestor ou administrador para cadastrar os projetos.</span>'}
          </div>
        </div>`;
      const b1 = el.querySelector('#btn-novo-projeto'); if (b1) b1.addEventListener('click', () => App.ir('projetos'));
      const b2 = el.querySelector('#btn-exemplo'); if (b2) b2.addEventListener('click', () => {
        try { const n = Store.dadosDeExemplo(App.usuario); UI.toast(`Dados de exemplo carregados (${n} contratações).`, 'sucesso'); App.recarregar(); }
        catch (e) { UI.toast(e.message, 'erro'); }
      });
      return;
    }

    const rec = Store.resumoRecrutamento(App.usuario, App.filtros.projetoId);
    const temAno = regs.some(x => x.projeto.ano);
    // Comparado com a safra passada: contratações dos projetos do ano anterior nos mesmos estados (o total do ano
    // passado contra o que já foi contratado nesta safra). Sem projeto do ano anterior com contratações, não aparece.
    const htmlSafra = (() => {
      const vis = App.projetosVisiveis();
      const anoMax = Math.max(0, ...vis.filter(p => p.ano).map(p => +p.ano));
      const atuais = App.filtros.projetoId ? vis.filter(p => p.id === App.filtros.projetoId) : vis.filter(p => p.ano && +p.ano === anoMax);
      const ant = Analise.safraAnterior(atuais, vis); if (!ant) return '';
      const idsA = new Set(atuais.filter(p => +p.ano === ant.anoAtual).map(p => p.id)), idsP = new Set(ant.projetos.map(p => p.id));
      const todas = App.regs({ projetoId: '' });
      const ra = Analise.resumo(todas.filter(x => idsA.has(x.projetoId))), rp = Analise.resumo(todas.filter(x => idsP.has(x.projetoId)));
      if (!rp.total) return '';
      const pcs = Math.round(100 * ra.total / rp.total);
      const dif = (a, b, un = '') => { const d = Math.round(a) - Math.round(b); return d ? `<em class="in-saf-dif">${d > 0 ? '+' : '−'}${Math.abs(d)}${un}</em>` : ''; };
      const t = (rot, atual, passada, extra = '') => `<div class="in-saf-t"><span class="in-ind-rot">${rot}</span><b>${atual}${extra}</b><small>safra ${ant.ano}: ${passada}</small></div>`;
      return `<section class="card in-safra mb"><div class="in-cab"><h2>Comparado com a safra passada</h2><span class="muted small">${ant.anoAtual} até agora · ${ant.ano} o ano todo (${UI.esc(ant.projetos.map(p => p.nome).join(', '))})</span></div>
        <div class="in-saf">
          <div class="in-saf-t in-saf-principal"><span class="in-ind-rot">Contratados</span><b>${UI.fmtNum(ra.total)} <span>de ${UI.fmtNum(rp.total)} da safra ${ant.ano}</span></b>
            <div class="dr-barra ${pcs >= 100 ? 'dr-ok' : ''}"><i style="width:${ra.total ? Math.max(2, Math.min(100, pcs)) : 0}%"></i></div><small>${pcs}% do total da safra passada</small></div>
          ${t('Locais', ra.total ? UI.fmtPct(ra.pctLocal, 0) : '—', UI.fmtPct(rp.pctLocal, 0), ra.total ? dif(ra.pctLocal, rp.pctLocal, ' p.p.') : '')}
          ${t('Cidades de origem', UI.fmtNum(ra.cidadesOrigem), UI.fmtNum(rp.cidadesOrigem))}
          ${t('De fora do estado', ra.total ? UI.fmtPct(ra.pctForaDoEstado, 0) : '—', UI.fmtPct(rp.pctForaDoEstado, 0), ra.total ? dif(ra.pctForaDoEstado, rp.pctForaDoEstado, ' p.p.') : '')}
          ${t('Distância média', UI.fmtKm(ra.distMedia), UI.fmtKm(rp.distMedia))}
        </div></section>`;
    })();
    const podeCand = Store.pode(App.usuario, 'candidatos');
    const diretoria = Store.rhVeTudo(App.usuario);
    // quem tem o "Seu dia" (RH que vê só o dele) já vê ali o que é de candidato: as pendências ficam só com as vagas
    const temDia = !diretoria && podeCand && typeof Nuvem !== 'undefined' && Nuvem.ativa && !!Nuvem.rh;
    // itens de pendência / do dia: { n, txt, nivel, alvo: { href } | { seg, pend }, dica }; vermelho primeiro, depois hoje, prontos e o resto
    const ORD_NIVEL = { ruim: 0, hoje: 1, ok: 2, meio: 3 };
    const itemP = (n, um, varios, nivel, alvo, dica) => n ? { n, txt: n === 1 ? um : varios, nivel, alvo, dica } : null;
    const linhaItem = o => {
      const miolo = `<b>${UI.fmtNum(o.n)}</b><span>${UI.esc(o.txt)}${o.dica ? `<small>${UI.esc(o.dica)}</small>` : ''}</span>`;
      if (o.alvo && o.alvo.href) return `<a class="in-item in-${o.nivel}" href="${o.alvo.href}">${miolo}<em>Abrir →</em></a>`;
      if (o.alvo && o.alvo.seg !== undefined && podeCand) return `<a class="in-item in-${o.nivel}" href="#/candidatos" data-cand-seg="${o.alvo.seg}" data-cand-pend="${o.alvo.pend || ''}" title="Abre Candidatos já filtrado">${miolo}<em>Abrir →</em></a>`;
      return `<div class="in-item in-${o.nivel}">${miolo}</div>`;
    };
    const ordenarItens = l2 => l2.filter(Boolean).sort((a, b) => ORD_NIVEL[a.nivel] - ORD_NIVEL[b.nivel] || b.n - a.n);
    // pendências (refeitas depois que chega a contagem dos candidatos, para não dizer "sem candidato" nem "nada pendente" sem saber)
    const cardPendencias = (rc, extra = []) => {
      const l2 = ordenarItens([...extra,
        itemP(rc.atrasadas, 'vaga atrasada', 'vagas atrasadas', 'ruim', { href: '#/vagas' }, 'passou da data em que precisava das pessoas'),
        itemP(rc.prazoVencido, 'vaga com prazo de divulgação vencido', 'vagas com prazo de divulgação vencido', 'ruim', { href: '#/vagas' }),
        itemP(rc.aguardandoAprovacao, 'vaga aguardando aprovação', 'vagas aguardando aprovação', 'meio', { href: '#/vagas' }, App.usuario.perfil === 'admin' ? 'aprove ou recuse o pedido' : 'o administrador precisa aprovar'),
        itemP(rc.semDivulgacao, 'vaga aberta sem divulgação', 'vagas abertas sem divulgação', 'meio', { href: '#/vagas' }, 'marque onde foi divulgada'),
        rc.contagemPronta && itemP(rc.semCandidatos, 'vaga divulgada ainda sem candidato', 'vagas divulgadas ainda sem candidato', 'meio', { href: '#/vagas' }, 'divulgue em mais canais')]);
      const ibge = Store.temIBGE() ? '' : `<div class="caixa caixa-aviso mb" style="margin-top:0"><a href="#/cidades">Baixar a lista de cidades do IBGE</a> (uma vez só, reconhece qualquer cidade do Brasil).</div>`;
      const tit = App.usuario.perfil === 'analista' ? 'Pendências das suas vagas' : 'Pendências da diretoria';
      if (!l2.length) return (rc.contagemPronta ? `<div class="card in-pend in-pend-ok mb"><b>✓ ${tit}: nada pendente agora.</b> <span class="muted">Vagas aprovadas e divulgadas, ninguém parado além do normal.</span></div>` : '') + ibge;
      const vermelhos = l2.filter(o => o.nivel === 'ruim').length;
      return `<section class="card in-pend mb"><div class="in-cab"><h2>${tit}</h2><span class="muted small">${l2.length === 1 ? '1 ponto' : l2.length + ' pontos'}${vermelhos ? ` · <span class="in-txt-ruim">${vermelhos} urgente${vermelhos > 1 ? 's' : ''}</span>` : ''}${rc.contagemPronta ? '' : ' · conferindo os candidatos…'}</span></div>
        <div class="in-lista">${l2.map(linhaItem).join('')}</div></section>` + ibge;
    };
    // ----- Metas por RH: admissões da semana (segunda a domingo) contra a meta semanal definida pelo administrador/gestor.
    // A meta é da pessoa, não do projeto: conta o andamento de todos os projetos que o usuário vê (com filtro de projeto
    // no topo, busca o andamento geral à parte). Sem meta definida, mostra só "sem meta".
    const nuvemOn = typeof Nuvem !== 'undefined' && Nuvem.ativa && !!Nuvem.rh;
    const semanaM = (() => { const h = RH.hoje(), seg = RH.segundaDaSemana(h), d = new Date(seg + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 6); return { hoje: h, seg, dom: d.toISOString().slice(0, 10) }; })();
    const diaLocal = ts => { if (!ts) return ''; const s = String(ts); if (s.length <= 10) return s; const d = new Date(s); return isNaN(d) ? s.slice(0, 10) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const admNaSemana = p => { if (p.situacao !== 'admitido') return false; const d = diaLocal(p.admitido_em); return d >= semanaM.seg && d <= semanaM.dom; };
    let geral = null, rhAtual = null;   // andamento de todos os projetos; linhas do "Por RH" já calculadas
    const admSemanaDe = login => geral ? geral.filter(p => p.analista_login === login && admNaSemana(p)).length : null;
    const temMeta = m => m != null && m > 0;
    const podeMeta = nuvemOn && ['admin', 'gestor'].includes(App.usuario.perfil);
    const adms = x => x === 1 ? '1 admissão' : UI.fmtNum(x) + ' admissões';
    // recado da meta: batida, no ritmo (pelo que já devia ter saído até ontem, em dias úteis) ou quanto falta
    const recadoMeta = (feito, meta) => {
      if (feito >= meta) return { cls: 'ok', txt: feito > meta ? `Meta batida, ${feito - meta} a mais` : 'Meta batida' };
      const dSem = (new Date(semanaM.hoje + 'T12:00:00Z').getUTCDay() + 6) % 7;   // 0 = segunda
      const esperado = Math.floor(meta * Math.min(dSem, 5) / 5), falta = meta - feito;
      return feito >= esperado ? { cls: 'ritmo', txt: `No ritmo · ${falta === 1 ? 'falta 1' : 'faltam ' + falta}` } : { cls: 'meio', txt: `${falta === 1 ? 'Falta 1' : 'Faltam ' + falta} até domingo` };
    };
    // barra do "Seu dia" (só para o RH logado)
    const htmlMetaDia = () => {
      const u = Store.usuarios().find(x => x.id === App.usuario.id) || App.usuario, feito = admSemanaDe(u.login);
      if (feito == null) return '';
      const periodo = `${RH.fmtDia(semanaM.seg)} a ${RH.fmtDia(semanaM.dom)}`;
      if (!temMeta(u.metaSemanal)) return `<div class="in-meta in-meta-sem"><span>Nesta semana (${periodo}): <b>${adms(feito)}</b></span><span class="muted small">sem meta definida</span></div>`;
      const meta = u.metaSemanal, r = recadoMeta(feito, meta);
      return `<div class="in-meta" title="Admissões suas de segunda a domingo, em todos os seus projetos. A meta é definida pelo administrador ou gestor.">
        <div class="in-meta-cab"><span>Meta da semana: <b>${UI.fmtNum(feito)} de ${adms(meta)}</b> <span class="muted small">${periodo}</span></span><span class="in-meta-rec in-meta-${r.cls}">${r.cls === 'ok' ? '✓ ' : ''}${UI.esc(r.txt)}</span></div>
        <div class="dr-barra in-meta-barra ${feito >= meta ? 'dr-ok' : ''}" role="progressbar" aria-valuemin="0" aria-valuemax="${meta}" aria-valuenow="${Math.min(feito, meta)}"><i style="width:${feito ? Math.max(3, Math.min(100, Math.round(100 * feito / meta))) : 0}%"></i></div></div>`;
    };
    // "Por RH": colunas ordenáveis (clicar de novo inverte) e a célula da meta
    const ORD_RH = { sem: 'Semana', proc: 'Em proc.', parado: 'Parado', aprov: 'Aprov.', faltam: 'Faltam', meta: 'Meta' };
    const DICA_RH = { sem: 'Admitidos nos últimos 7 dias', proc: 'Candidatos em processo agora', parado: 'O candidato em processo há mais tempo sem mudança', aprov: 'Admitidos ÷ (admitidos + não seguiram)', faltam: 'Pessoas que faltam nas vagas abertas em que ele é responsável', meta: 'Admissões desta semana (segunda a domingo) ÷ meta semanal' };
    const usuarioDaLinha = a => a.u ? Store.usuarioPorLogin(a.u.login) : null;
    const metaDaLinha = a => { const u = usuarioDaLinha(a); if (!u || (!diretoria && u.id !== App.usuario.id)) return null; return { u, meta: temMeta(u.metaSemanal) ? u.metaSemanal : null, feito: admSemanaDe(u.login) }; };
    const htmlPorRh = () => {
      if (!rhAtual) return '';
      const ord = Paginas.dashboard._ordRh || { k: 'sem', inv: false }, pctA = a => a.adm + a.fora ? a.adm / (a.adm + a.fora) : -1;
      const prog = a => { const m = metaDaLinha(a); return m && m.meta != null ? (m.feito || 0) / m.meta : -1; };
      const padrao = (a, b) => b.sem - a.sem || b.faltam - a.faltam || b.proc - a.proc || a.nome.localeCompare(b.nome, 'pt-BR');
      const CMP = { sem: padrao, proc: (a, b) => b.proc - a.proc, parado: (a, b) => (b.proc ? b.parado : -1) - (a.proc ? a.parado : -1), aprov: (a, b) => pctA(b) - pctA(a), faltam: (a, b) => b.faltam - a.faltam,
        meta: (a, b) => prog(b) - prog(a) };
      // quem não tem o dado da coluna (sem meta, sem encerrados…) fica sempre no fim, mesmo invertendo
      const semDado = { meta: a => prog(a) < 0, aprov: a => pctA(a) < 0, parado: a => !a.proc }[ord.k] || (() => false);
      const linhas = [...rhAtual.values()].sort((a, b) => (semDado(a) - semDado(b)) || (ord.inv ? -1 : 1) * CMP[ord.k](a, b) || padrao(a, b));
      const pc = (a, b) => b ? Math.round(100 * a / b) : 0;
      const celMeta = a => {
        const m = metaDaLinha(a); if (!m) return '<span class="in-rhm in-rhm-nada">—</span>';
        const pode = podeMeta && m.u.ativo !== false && (App.usuario.perfil === 'admin' || m.u.id !== App.usuario.id);
        const miolo = m.meta == null ? '<small>sem meta</small>'
          : `<em>${m.feito == null ? '…' : m.feito}/${m.meta}</em><span class="dr-barra in-rhm-barra ${m.feito >= m.meta ? 'dr-ok' : ''}"><i style="width:${m.feito ? Math.max(6, Math.min(100, pc(m.feito, m.meta))) : 0}%"></i></span>`;
        const dica = m.meta == null ? 'Sem meta semanal definida' : `${adms(m.feito || 0)} nesta semana, meta de ${m.meta}`;
        return pode ? `<button type="button" class="in-rhm in-rhm-btn" data-meta="${UI.esc(m.u.login)}" title="${dica}. Clique para ${m.meta == null ? 'definir' : 'mudar'} a meta.">${miolo}</button>` : `<span class="in-rhm" title="${dica}">${miolo}</span>`;
      };
      return `<div class="dr-tab dr-tab-rh in-rh6 in-rh7 dr-tab-cab"><span>RH</span>${Object.keys(ORD_RH).map(k => `<button type="button" class="in-ord ${ord.k === k ? 'ativo' : ''}" data-ord="${k}" title="${DICA_RH[k]}. Clique para ordenar.">${ORD_RH[k]}${ord.k === k ? `<i>${ord.inv ? '▴' : '▾'}</i>` : ''}</button>`).join('')}</div>
        ${linhas.map(a => `<div class="dr-tab dr-tab-rh in-rh6 in-rh7"><b class="com-avatar">${a.u ? UI.avatar(a.u, 22) : ''}<span title="${UI.esc(a.nome)}">${UI.esc(a.nome)}</span></b><span class="${a.sem ? 'ok' : ''}" title="${a.sem} admitido(s) nos últimos 7 dias · ${a.adm} no total">${a.sem}</span><span>${a.proc}</span><span class="${a.parado >= 8 ? 'ruim' : a.parado >= 4 ? 'alerta' : ''}">${a.proc ? a.parado + ' d' : '—'}</span><span title="${a.adm} admitidos, ${a.fora} não seguiram">${a.adm + a.fora ? pc(a.adm, a.adm + a.fora) + '%' : '—'}</span><span class="${a.faltam ? 'ruim' : 'ok'}">${a.faltam}</span>${celMeta(a)}</div>`).join('')}`;
    };
    // redesenha só o que depende da meta (barra do Seu dia e linhas do Por RH), sem mexer no resto da tela
    const pintarMetas = () => {
      if (App.paginaAtual !== 'dashboard' || !document.body.contains(el)) return;
      const bd = el.querySelector('#in-meta-box'); if (bd) bd.innerHTML = htmlMetaDia();
      const br = el.querySelector('#dr-rh-corpo'); if (br) br.innerHTML = htmlPorRh();
    };
    const buscarGeral = lista => {
      if (!nuvemOn) return;
      if (!App.filtros.projetoId) { geral = lista; return; }
      Nuvem.rh.andamento(null).then(n => { geral = n; pintarMetas(); }).catch(() => {});
    };
    const editarMeta = login => {
      const u = Store.usuarioPorLogin(login); if (!u) return;
      const feito = admSemanaDe(u.login);
      UI.modal({ titulo: `Meta semanal — ${u.nome}`, largura: '420px',
        corpo: `<label>Admissões por semana<input type="number" id="mt-valor" min="0" max="999" step="1" inputmode="numeric" placeholder="sem meta" value="${temMeta(u.metaSemanal) ? u.metaSemanal : ''}"></label>
          <p class="muted small" style="margin-bottom:0">A semana vai de segunda a domingo.${feito == null ? '' : ` Nesta semana: ${adms(feito)}.`} Deixe vazio para ficar sem meta.</p>`,
        botoes: [{ texto: 'Cancelar' }, { texto: 'Salvar', classe: 'btn-primario', acao: async md => {
          const inp = md.corpo.querySelector('#mt-valor'), txt = inp.value.trim(), nova = txt === '' ? null : Number(txt);
          if (nova !== null && (!Number.isInteger(nova) || nova < 0 || nova > 999)) { inp.focus(); throw new Error('A meta é um número inteiro de 0 a 999.'); }
          await Nuvem.definirMeta(u.id, nova);
          UI.toast(nova == null ? `${u.nome} ficou sem meta.` : `Meta de ${u.nome}: ${adms(nova)} por semana.`, 'sucesso');
          pintarMetas();
        } }] });
      setTimeout(() => { const i = document.getElementById('mt-valor'); if (i) { i.focus(); i.select(); } }, 50);
    };
    // Recrutamento (para a diretoria): sai do andamento dos candidatos (sem dado pessoal) e das vagas.
    // Vale para todos que veem o Início; o RH (analista) vê só o que é dele. Respeita os filtros de distrito e tipo do topo.
    // desenha o bloco do recrutamento (passo 2, pendências e indicadores) a partir do andamento; chamado de novo quando
    // os candidatos mudam, sem redesenhar o resto da tela (gráficos das contratações ficam como estão)
    const pintarRec = l => {
      const v = document.getElementById('dash-cand'), s = document.getElementById('dash-cand-sub'), alvo = document.getElementById('dash-rec');
      if (!v || !l || !document.body.contains(v)) return;
      // contagem das vagas a partir do mesmo andamento (sem buscar de novo), sem os filtros de distrito e tipo:
      // cada vaga conta todos os distritos dela (os filtros entram depois, no que aparece) — igual à tela Vagas
      const lTodos = l;
      buscarGeral(lTodos); if (!App.filtros.projetoId) pintarMetas();
      Store.definirContagemVagas(Store.contagemDoAndamento(lTodos));
      if (App.filtros.distritoId) l = l.filter(p => p.distrito_id === App.filtros.distritoId);
      if (App.filtros.tipo) l = l.filter(p => p.tipo === App.filtros.tipo);
      const ab = l.filter(p => p.situacao === 'em_andamento'), n = e => ab.filter(p => p.etapa === e).length;
      v.textContent = UI.fmtNum(ab.length);
      s.textContent = ab.length ? `${n('triagem')} na triagem · ${n('entrevista')} em entrevista · ${n('documentos')} na documentação` : 'triagem, entrevista e documentação';
      if (!l.length) {
        const pe = document.getElementById('dash-pend'); if (pe) pe.innerHTML = cardPendencias({ ...Store.resumoRecrutamento(App.usuario, App.filtros.projetoId), contagemPronta: true });
        alvo.innerHTML = '<div class="secao-titulo">Recrutamento</div><div class="card vazio mb">Nenhuma candidatura ainda neste filtro. Quando o RH importar ou cadastrar candidatos, o funil aparece aqui.</div>';
        return;
      }
      // com a contagem, o passo 1 passa a contar o que realmente falta (vaga completa sai das abertas)
      const rec2 = Store.resumoRecrutamento(App.usuario, App.filtros.projetoId), dv = document.getElementById('dash-vagas');
      // o que está travando: prontos parados, documentação parada, chegada da semana com pendência, sem RH
      const DIA2 = 86400000, parado = p => p.etapa_em ? (Date.now() - new Date(p.etapa_em).getTime()) / DIA2 : 0;
      const pronto = p => p.etapa === 'documentos' && p.dinamica === 'ok' && !p.documentos_pendentes && ['ok', 'dispensado'].includes(p.aso) && ['ok', 'dispensado'].includes(p.treinamento);
      const segH = RH.segundaDaSemana(RH.hoje()), fimH = (() => { const d = new Date(segH + 'T12:00:00'); d.setDate(d.getDate() + 6); return d.toISOString().slice(0, 10); })();
      const prParados = ab.filter(p => pronto(p) && parado(p) >= 2).length;
      const docParada = ab.filter(p => p.etapa === 'documentos' && !pronto(p) && parado(p) >= 7).length;
      const chegaPend = ab.filter(p => p.chegada_data && p.chegada_data >= segH && p.chegada_data <= fimH && !pronto(p)).length;
      const semRhN = ab.filter(p => !p.analista_login).length;
      // na entrevista há 3+ dias (o andamento não traz a data da entrevista; conta pela mudança de etapa, igual a Candidatos)
      const diasEtapa = p => { const ts = p.etapa_em || p.criado_em; return ts ? Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / DIA2)) : 0; };
      const entParada = ab.filter(p => p.etapa === 'entrevista' && diasEtapa(p) >= 3).length;
      // chegada que já passou e ninguém marcou se chegou ou faltou (só com o campo chegada_status no andamento)
      const temSt = l.some(p => 'chegada_status' in p), hojeC = RH.hoje();
      const chegVenc = s2 => temSt ? l.filter(p => p.chegada_data && p.chegada_data < hojeC && (p.chegada_status || 'aguardando') === 'aguardando' && (s2 === 'admitido' ? p.situacao === 'admitido' : p.situacao === 'em_andamento' && p.etapa === 'documentos')).length : 0;
      // cada pendência abre Candidatos já filtrado (quem não abre Candidatos vê só o texto)
      const extra = temDia ? [itemP(semRhN, 'candidato sem RH responsável', 'candidatos sem RH responsável', 'meio', { seg: '', pend: 'semrh' }, 'direcionar para um RH')] : [
        itemP(prParados, 'pessoa pronta para admitir há 2+ dias', 'pessoas prontas para admitir há 2+ dias', 'ruim', { seg: 'documentos', pend: 'prontasparadas' }, 'falta só admitir'),
        itemP(chegVenc('admitido'), 'admitido com chegada passada sem confirmação', 'admitidos com chegada passada sem confirmação', 'ruim', { seg: 'admitido', pend: 'chegavencida' }, 'marcar se chegou ou faltou'),
        itemP(chegVenc('documentos'), 'na documentação com chegada passada sem confirmação', 'na documentação com chegada passada sem confirmação', 'ruim', { seg: 'documentos', pend: 'chegavencida' }, 'marcar se chegou ou faltou'),
        itemP(chegaPend, 'chega esta semana com pendência', 'chegam esta semana com pendência', 'hoje', { seg: 'documentos', pend: 'chegasemana' }, 'documento, ASO ou treinamento faltando'),
        itemP(entParada, 'na entrevista há 3+ dias', 'na entrevista há 3+ dias', 'meio', { seg: 'entrevista', pend: 'parados3' }, 'entrevista sem resultado ou sem data'),
        itemP(docParada, 'na documentação parado há 7+ dias', 'na documentação parados há 7+ dias', 'meio', { seg: 'documentos', pend: 'docparada' }),
        itemP(semRhN, 'candidato sem RH responsável', 'candidatos sem RH responsável', 'meio', { seg: '', pend: 'semrh' }, 'direcionar para um RH')];
      if (dv) { dv.textContent = UI.fmtNum(rec2.vagasAbertas); document.getElementById('dash-vagas-sub').innerHTML = `${UI.fmtNum(rec2.posicoes)} ${rec2.posicoes === 1 ? 'pessoa' : 'pessoas'} ainda a contratar${rec2.semDivulgacao ? ` · <span class="erro">${rec2.semDivulgacao} sem divulgar</span>` : ''}`; }
      const vagas = Store.vagasVisiveis(App.usuario, { projetoId: App.filtros.projetoId }).filter(x => x.aprovada && x.status !== 'cancelada');
      // pedido x admitido conta local e móvel separados por distrito (10 locais admitidos não cobrem 5 móveis pedidos)
      // e respeita os filtros de distrito e tipo do topo, igual aos candidatos
      const fD = App.filtros.distritoId, fT = App.filtros.tipo;
      let pedidas = 0, admV = 0;
      for (const x of vagas) {
        if (x.porDistrito && x.porDistrito.length) {
          for (const d of x.porDistrito) {
            if (fD && d.distrito.id !== fD) continue;
            if (fT !== 'MOVEL') { pedidas += d.locais; admV += Math.min(d.admLoc, d.locais); }
            if (fT !== 'LOCAL') { pedidas += d.moveis; admV += Math.min(d.admMov, d.moveis); }
          }
        } else if (!fD) { pedidas += x.quantidade; admV += Math.min(x.admitidos || 0, x.quantidade); }
      }
      const adm = l.filter(p => p.situacao === 'admitido'), fora = l.filter(p => p.situacao === 'reprovado' || p.situacao === 'desistiu');
      // tempo de contratação único (o mesmo da tela Vagas): da aprovação da vaga à admissão, mediana em dias; e até chegar no campo
      const tc = Store.tempoContratacao(Store.vagasVisiveis(App.usuario, { projetoId: App.filtros.projetoId }), l);
      const fmtD = x => x == null ? '—' : x.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' d';
      // aproveitamento histórico do próprio projeto (sem os filtros do topo) e previsão das vagas
      const taxasPorProj = new Map();
      const taxasDe = pid => { if (!taxasPorProj.has(pid)) taxasPorProj.set(pid, Store.taxasAproveitamento(lTodos.filter(p => p.projeto_id === pid))); return taxasPorProj.get(pid); };
      const esperadoDe = lista => lista.reduce((t, p) => t + Store.esperadoDoFunil([p], taxasDe(p.projeto_id)), 0);
      const ORD_SELO = { nao_fecha: 0, risco: 1, no_prazo: 2 };
      const prevs = vagas.filter(x => !fD || x.porDistrito.some(d => d.distrito.id === fD))
        .map(x => ({ v: x, p: Store.previsaoVaga(x, lTodos, taxasDe(x.projetoId)) })).filter(o => o.p);
      const emRisco = prevs.filter(o => o.p.selo !== 'no_prazo')
        .sort((a, b) => ORD_SELO[a.p.selo] - ORD_SELO[b.p.selo] || (b.p.faltam - b.p.cobre) - (a.p.faltam - a.p.cobre) || (a.v.dataNecessidade || '9999').localeCompare(b.v.dataNecessidade || '9999'));
      // vagas que o funil não fecha / em risco entram nas pendências (detalhe no quadro "Vagas em risco")
      const nNaoFecha = emRisco.filter(o => o.p.selo === 'nao_fecha').length, nRisco = emRisco.length - nNaoFecha;
      extra.push(itemP(nNaoFecha, 'vaga que o funil não fecha', 'vagas que o funil não fecha', 'ruim', { href: '#/vagas' }, 'precisa de mais candidatos'),
        itemP(nRisco, 'vaga em risco', 'vagas em risco', 'meio', { href: '#/vagas' }, 'o funil cobre pouco do que falta'));
      const pe = document.getElementById('dash-pend'); if (pe) pe.innerHTML = cardPendencias({ ...rec2, contagemPronta: true }, extra);
      // gargalo: quantos estão parados em cada etapa (pela última mudança: etapa_em ou atualizado_em, o mais recente)
      const desde = p => { const t = [p.etapa_em, p.atualizado_em].filter(Boolean).map(x => new Date(x).getTime()).filter(x => !isNaN(x)); return t.length ? Math.max(...t) : null; };
      const diasParado = p => { const t = desde(p); return t == null ? 0 : Math.max(0, Math.floor((Date.now() - t) / DIA2)); };
      const FAIXAS = [['0-3 d', 0, 3], ['4-7 d', 4, 7], ['8+ d', 8, Infinity]];
      const ETAPAS_G = [['triagem', 'Triagem'], ['entrevista', 'Entrevista'], ['documentos', 'Documentação']];
      const gar = ETAPAS_G.map(([e, rot]) => ({ e, rot, n: FAIXAS.map(([, a, b]) => ab.filter(p => p.etapa === e && diasParado(p) >= a && diasParado(p) <= b).length) }));
      const parados8 = gar.reduce((t, g) => t + g.n[2], 0), pior8 = gar.slice().sort((a, b) => b.n[2] - a.n[2])[0];
      // tempo médio em cada etapa (só quem tem as duas datas)
      const mediaDias = (lista, de, ate) => { const d = lista.filter(p => p[de] && p[ate]).map(p => (new Date(String(p[ate]).length === 10 ? p[ate] + 'T12:00:00' : p[ate]) - new Date(String(p[de]).length === 10 ? p[de] + 'T12:00:00' : p[de])) / DIA2).filter(x => !isNaN(x) && x >= 0); return d.length ? { m: d.reduce((a, b) => a + b, 0) / d.length, n: d.length } : null; };
      const tempoEtapas = [['Triagem até a entrevista', mediaDias(l, 'criado_em', 'entrevista_em')], ['Entrevista até a documentação', mediaDias(l, 'entrevista_em', 'documentos_em')], ['Documentação até a admissão', mediaDias(adm, 'documentos_em', 'admitido_em')]];
      // saídas por motivo, local e móvel separados
      const motivos = new Map();
      for (const p of fora) { const k = (p.motivo_saida || '').trim() || 'não informado'; const a = motivos.get(k) || { motivo: k, LOCAL: 0, MOVEL: 0, rep: 0, des: 0 }; a[p.tipo === 'MOVEL' ? 'MOVEL' : 'LOCAL']++; if (p.situacao === 'desistiu') a.des++; else a.rep++; motivos.set(k, a); }
      const listaMotivos = [...motivos.values()].sort((a, b) => (b.LOCAL + b.MOVEL) - (a.LOCAL + a.MOVEL) || a.motivo.localeCompare(b.motivo, 'pt-BR'));
      // funil: até onde cada pessoa chegou (quem saiu fica na etapa em que saiu)
      const ORD = { triagem: 0, entrevista: 1, documentos: 2 };
      const chegou = k => l.filter(p => p.situacao === 'admitido' || ORD[p.etapa] >= k).length;
      const funil = [['Candidaturas', l.length], ['Chegaram à entrevista', chegou(1)], ['Chegaram à documentação', chegou(2)], ['Admitidos', adm.length]];
      const pct = (a, b) => b ? Math.round(100 * a / b) : 0;
      // por distrito: pedido x admitido (local e móvel), juntando as vagas
      const porD = new Map();
      for (const x of vagas) for (const d of x.porDistrito) {
        if (fD && d.distrito.id !== fD) continue;
        const a = porD.get(d.distrito.id) || { id: d.distrito.id, nome: d.distrito.nome, pl: 0, pm: 0, al: 0, am: 0, proc: 0, esp: 0 };
        a.pl += d.locais; a.pm += d.moveis; a.al += Math.min(d.admLoc, d.locais); a.am += Math.min(d.admMov, d.moveis); a.proc += d.procLoc + d.procMov; porD.set(d.distrito.id, a);
      }
      // falta e cobertura do funil por distrito: admissões esperadas de quem está em processo nas vagas aprovadas, ÷ o que falta
      const idsVagas = new Set(vagas.map(x => x.id));
      for (const a of porD.values()) {
        a.falta = Math.max(0, a.pl - a.al) + Math.max(0, a.pm - a.am);
        a.esp = esperadoDe(lTodos.filter(p => p.situacao === 'em_andamento' && p.distrito_id === a.id && idsVagas.has(p.vaga_id)));
        a.cob = a.falta ? a.esp / a.falta : null;
      }
      const piorD = [...porD.values()].filter(a => a.cob != null).sort((a, b) => a.cob - b.cob)[0];
      // por RH: em processo, parado há (o mais antigo), aproveitamento (admitidos ÷ encerrados) e quanto falta nas vagas dele
      const porRh = new Map();
      const rhDe = (k, u, nome) => porRh.get(k) || (porRh.set(k, { nome: u ? u.nome : (nome || 'Sem RH responsável'), u, proc: 0, adm: 0, sem: 0, fora: 0, total: 0, parado: 0, faltam: 0 }), porRh.get(k));
      // admitidos nos últimos 7 dias (ranking) e nos últimos 14 (ritmo da previsão de fechamento)
      const hojeI = RH.hoje(), somaDias = (iso, nd) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + nd); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
      const admEm = p => String(p.admitido_em || '').slice(0, 10), d7 = somaDias(hojeI, -7), d14 = somaDias(hojeI, -14);
      const naJanela = (p, de) => p.situacao === 'admitido' && admEm(p) > de && admEm(p) <= hojeI;
      for (const p of l) {
        const k = p.analista_login || p.analista || '(sem)';
        const a = rhDe(k, Store.usuarioPorLogin(p.analista_login), p.analista);
        a.total++; if (p.situacao === 'admitido') { a.adm++; if (naJanela(p, d7)) a.sem++; } else if (p.situacao === 'em_andamento') { a.proc++; a.parado = Math.max(a.parado, diasParado(p)); } else a.fora++;
      }
      const ABERTA = ['aberta', 'divulgada', 'selecao'];
      for (const x of vagas.filter(x => ABERTA.includes(x.status) && (!fD || x.porDistrito.some(d => d.distrito.id === fD)))) {
        const rs = x.responsaveis && x.responsaveis.length ? x.responsaveis : ['(sem)'];
        for (const login of rs) rhDe(login, Store.usuarioPorLogin(login === '(sem)' ? '' : login), null).faltam += x.faltam;
      }
      // RH com meta definida aparece mesmo sem candidato nem vaga neste filtro (só para quem acompanha todos os RHs)
      if (diretoria) for (const u of Store.equipeRh()) if (temMeta(u.metaSemanal) && !porRh.has(u.login)) rhDe(u.login, u, null);
      rhAtual = porRh;
      // saídas: em que etapa e por quê
      const saiu = e => fora.filter(p => p.etapa === e).length;
      // chegadas das próximas semanas
      const hoje = RH.hoje(), seg = RH.segundaDaSemana(hoje);
      const semanas = new Map();
      for (const p of l) if (p.chegada_data && p.chegada_data >= seg && (p.situacao === 'em_andamento' || p.situacao === 'admitido')) { const w = RH.segundaDaSemana(p.chegada_data); semanas.set(w, (semanas.get(w) || 0) + 1); }
      const prox = [...semanas.entries()].sort().slice(0, 4);
      const fimSem = w => { const d = new Date(w + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 6); return RH.fmtDia(d.toISOString().slice(0, 10)); };
      // previsão de fechamento: no ritmo das admissões dos últimos 14 dias, quando o que falta fecha; comparado
      // com a data mais distante em que as vagas abertas precisam das pessoas
      const faltamT = Math.max(0, pedidas - admV), adm14 = adm.filter(p => naJanela(p, d14)).length, adm7 = adm.filter(p => naJanela(p, d7)).length;
      const prazoFinal = vagas.filter(x => ABERTA.includes(x.status) && x.faltam > 0 && x.dataNecessidade && (!fD || x.porDistrito.some(d => d.distrito.id === fD))).map(x => x.dataNecessidade).sort().pop() || '';
      let previsao = '';
      if (pedidas && !faltamT) previsao = '<span class="in-txt-ok">Pedido completo.</span>';
      else if (pedidas && !adm14) previsao = 'Sem admissões nos últimos 14 dias: ainda não dá para prever quando o pedido fecha.';
      else if (pedidas) {
        const diasF = Math.ceil(faltamT / (adm14 / 14)), fimF = somaDias(hojeI, diasF);
        const quando = diasF > 365 ? 'em mais de um ano' : `por volta de <b>${RH.fmtDia(fimF)}${fimF.slice(0, 4) !== hojeI.slice(0, 4) ? '/' + fimF.slice(0, 4) : ''}</b>`;
        previsao = `No ritmo atual (${adm14 === 1 ? '1 admissão' : adm14 + ' admissões'} em 14 dias), fecha ${quando}` +
          (prazoFinal ? (fimF > prazoFinal ? ` · <span class="in-txt-ruim">depois do prazo (${RH.fmtDia(prazoFinal)})</span>` : ` · <span class="in-txt-ok">dentro do prazo (${RH.fmtDia(prazoFinal)})</span>`) : '') + '.';
      }
      // semáforo do pedido: o ritmo das últimas 2 semanas dá para fechar o que falta até o prazo?
      const rit = Analise.ritmoNecessario({ faltam: faltamT, prazo: prazoFinal, adm14, hoje: hojeI });
      const SEMAFORO = { completo: ['ok', 'Completo', 'Todas as pessoas pedidas já foram admitidas'], no_ritmo: ['ok', 'No ritmo', 'O ritmo das últimas 2 semanas fecha o pedido dentro do prazo'],
        atencao: ['meio', 'Atenção', 'O ritmo das últimas 2 semanas está um pouco abaixo do necessário'], fora: ['ruim', 'Fora do ritmo', 'O ritmo das últimas 2 semanas não fecha o pedido no prazo'],
        vencido: ['ruim', 'Prazo vencido', 'A data em que as vagas precisavam das pessoas já passou'] };
      const fmtSem = x => x.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
      const sm = pedidas ? SEMAFORO[rit.situacao] : null;
      const seloHero = sm ? `<span class="in-sem in-sem-${sm[0]}" title="${sm[2]}">${sm[1]}</span>` : '';
      const linhaRitmo = !pedidas ? '' : rit.precisa > 0 ? `Para fechar até <b>${RH.fmtDia(prazoFinal)}</b> precisa de <b>${fmtSem(Math.ceil(rit.precisa * 10) / 10)} por semana</b> · hoje ${rit.atual === 1 ? 'sai' : 'saem'} <b>${fmtSem(rit.atual)} por semana</b>.`
        : rit.situacao === 'vencido' ? `O prazo era <b>${RH.fmtDia(prazoFinal)}</b> e ainda ${faltamT === 1 ? 'falta 1 pessoa' : 'faltam ' + UI.fmtNum(faltamT) + ' pessoas'}.` : '';
      // indicadores do processo (o que o diretor olha em 10 segundos), canais e as últimas 8 semanas
      const ind = Analise.indicadoresRecrutamento(l);
      const qtdI = (x, um, varios) => `${UI.fmtNum(x)} ${x === 1 ? um : varios}`;
      const pc1 = x => x == null ? '—' : Math.round(100 * x) + '%';
      const ETQ_E = { triagem: 'triagem', entrevista: 'entrevista', documentos: 'documentação' };
      const podeRel = Store.pode(App.usuario, 'relatorios');
      const tile = (rot, val, sub, rel, dica) => { const miolo = `<span class="in-ind-rot">${rot}</span><b>${val}</b><small>${sub}</small>`;
        return rel && podeRel ? `<a class="in-ind-t" href="#/relatorios" data-rel="${rel}" title="${dica} Clique para abrir o relatório.">${miolo}</a>` : `<div class="in-ind-t" title="${dica}">${miolo}</div>`; };
      const htmlInd = `<div class="in-ind mb">
          ${tile('Aproveitamento', pc1(ind.aproveitamento), ind.encerrados ? `${qtdI(ind.admitidos, 'admitido', 'admitidos')} de ${UI.fmtNum(ind.encerrados)} que encerraram` : 'ninguém encerrou o processo ainda', 'porrh', 'De quem já encerrou o processo (admitido, reprovado ou desistiu), quantos foram admitidos.')}
          ${tile('Desistência', pc1(ind.desistencia), ind.desistencias ? `${qtdI(ind.desistencias, 'desistiu', 'desistiram')}${ind.etapaQueMaisDesiste ? ' · mais na ' + ETQ_E[ind.etapaQueMaisDesiste] : ''}` : (ind.encerrados ? 'nenhuma desistência' : 'ninguém encerrou o processo ainda'), 'saidas', 'De quem já encerrou o processo, quantos desistiram (o candidato saiu por conta própria).')}
          ${tile('Chegaram ao campo', pc1(ind.comparecimento), ind.chegou + ind.faltou ? `${qtdI(ind.chegou, 'chegou', 'chegaram')} · ${qtdI(ind.faltou, 'faltou', 'faltaram')}` : 'nenhuma chegada confirmada ainda', '', 'Das chegadas já confirmadas (chegou ou faltou), quantas pessoas chegaram.')}
          ${tile('Da candidatura à admissão', ind.diasAteAdmitir == null ? '—' : fmtD(ind.diasAteAdmitir), ind.nTempos ? `mediana de ${qtdI(ind.nTempos, 'admissão', 'admissões')}` : 'ainda sem admissão', 'semanal', 'Dias entre o cadastro do candidato e a admissão. Mediana: metade levou menos, metade mais.')}
        </div>`;
      const NOMES_F = Object.fromEntries(Store.CANAIS.map(c => [c.id, c.nome]).concat([['indicacao', 'Indicação de colaborador'], ['ex_colaborador', 'Ex-colaborador'], ['outro', 'Outro']]));
      const canais = Analise.canaisRecrutamento(l, NOMES_F), semF = canais.find(c => !c.fonte), comF = canais.filter(c => c.fonte).sort((a, b) => b.admitidos - a.admitidos || b.conversao - a.conversao || b.inscritos - a.inscritos);
      const melhorC = comF[0] && comF[0].admitidos ? comF[0] : null;
      const maxC = Math.max(1, ...comF.map(c => c.inscritos));
      const semG = Analise.semanasRecrutamento(l, { hoje: hojeI, n: 8 });
      const temSemanas = semG.some(s2 => s2.novos || s2.admitidos);
      const barra = (val, max, cls = '') => `<div class="dr-barra ${cls}"><i style="width:${max ? Math.max(2, Math.round(100 * val / max)) : 0}%"></i></div>`;
      const qtd = (x, um, varios) => `${UI.fmtNum(x)} ${x === 1 ? um : varios}`;
      if (Paginas.dashboard._gSem) { Paginas.dashboard._gSem.destroy(); Paginas.dashboard._gSem = null; }
      alvo.innerHTML = `
        <div class="secao-titulo dr-titulo">Recrutamento ${App.usuario.perfil === 'analista' ? '<span class="muted small">(só o que está com você)</span>' : ''}<span class="espaco"></span><button class="btn btn-pequeno nao-imprimir" id="dr-whats" title="Copia um resumo curto para colar no WhatsApp">Copiar resumo para WhatsApp</button><button class="btn btn-pequeno nao-imprimir" id="dr-imprimir" title="Gera uma versão para imprimir ou salvar em PDF">Imprimir / PDF</button></div>
        <section class="card dr-hero mb">
          <div>
            <div class="dr-hero-rot">Pedido preenchido${fD || fT ? ' <span class="muted small">(com o filtro do topo)</span>' : ''}${seloHero}</div>
            <div class="dr-hero-n"><b>${UI.fmtNum(admV)}</b> de ${UI.fmtNum(pedidas)} pessoas <span>${pct(admV, pedidas)}%</span></div>
            <div class="dr-barra dr-hero-barra dr-ok"><i style="width:${pedidas ? Math.max(1, pct(admV, pedidas)) : 0}%"></i></div>
            <div class="muted small">${qtd(vagas.length, 'vaga aprovada', 'vagas aprovadas')} · ${adm7 === 1 ? '1 admitido' : UI.fmtNum(adm7) + ' admitidos'} nos últimos 7 dias${adm.length > admV ? ` · +${adm.length - admV} admitidos fora do pedido` : ''}</div>
            ${previsao ? `<div class="in-prev" title="Conta as admissões dos últimos 14 dias e divide o que falta por esse ritmo. O prazo é a data mais distante em que as vagas abertas precisam das pessoas.">${previsao}${linhaRitmo ? `<div class="in-prev-ritmo">${linhaRitmo}</div>` : ''}</div>` : ''}
          </div>
          <ul class="dr-hero-fatos">
            <li><b>${UI.fmtNum(Math.max(0, pedidas - admV))}</b>faltam contratar</li>
            <li><b>${UI.fmtNum(ab.length)}</b>em processo agora</li>
            <li><b>${UI.fmtNum(l.filter(p => (p.situacao === 'em_andamento' || p.situacao === 'admitido') && p.chegada_data && p.chegada_data >= seg && p.chegada_data <= (() => { const d = new Date(seg + 'T12:00:00'); d.setDate(d.getDate() + 6); return d.toISOString().slice(0, 10); })()).length)}</b>chegam esta semana</li>
            <li title="Mediana: metade das admissões levou menos que isso, metade mais"><b>${fmtD(tc.admissao)}</b>da aprovação da vaga à admissão${tc.campo != null ? ` · ${fmtD(tc.campo)} até chegar no campo` : ''}</li>
          </ul>
        </section>
        ${htmlInd}
        <div class="grade kpis mb" hidden>
          <div class="card kpi"><div class="rotulo">Pessoas pedidas</div><div class="valor">${UI.fmtNum(pedidas)}</div><div class="sub">${qtd(vagas.length, 'vaga aprovada', 'vagas aprovadas')}${fD || fT ? ' · com o filtro do topo' : ''}</div></div>
          <div class="card kpi kpi-local"><div class="rotulo">Admitidas</div><div class="valor">${UI.fmtNum(admV)}</div><div class="sub">${pedidas ? `${pct(admV, pedidas)}% do pedido preenchido` : 'sem vaga aprovada'}${adm.length > admV ? ` · +${adm.length - admV} fora do pedido` : ''}</div></div>
          <div class="card kpi"><div class="rotulo">Faltam</div><div class="valor">${UI.fmtNum(Math.max(0, pedidas - admV))}</div><div class="sub">${UI.fmtNum(ab.length)} em processo agora</div></div>
          <div class="card kpi"><div class="rotulo">Não seguiram</div><div class="valor">${UI.fmtNum(fora.length)}</div><div class="sub">${pct(fora.length, l.length)}% das candidaturas · ${fora.filter(p => p.situacao === 'desistiu').length} desistências</div></div>
          <div class="card kpi"><div class="rotulo">Da aprovação à admissão</div><div class="valor">${fmtD(tc.admissao)}</div><div class="sub">${tc.admissao == null ? 'ainda sem admissão' : 'mediana de ' + qtd(tc.nAdmissao, 'admissão', 'admissões')}</div></div>
        </div>
        <div class="grade dr-grade mb">
          <div class="card"><h2>Vagas em risco <span class="muted small" style="font-weight:400">${prevs.length ? `${emRisco.length} de ${qtd(prevs.length, 'vaga aberta', 'vagas abertas')}` : ''}</span></h2>
            ${!prevs.length ? '<p class="muted small">Nenhuma vaga aprovada em aberto com posição faltando.</p>'
              : !emRisco.length ? `<p class="dr-tudo-ok">Todas as ${qtd(prevs.length, 'vaga aberta', 'vagas abertas')} estão no prazo: o funil cobre o que falta.</p>`
              : emRisco.slice(0, 8).map(o => `<a class="dr-risco" href="#/vagas"><span class="vg-selo vg-selo-${o.p.selo}">${o.p.rotulo}</span><b>${UI.esc(o.v.titulo)}</b><small>${UI.esc(o.v.porDistrito.map(d => d.distrito.nome).join(', ') || '')}${o.v.dataNecessidade ? ` · precisa até ${RH.fmtDia(o.v.dataNecessidade)}` : ''}</small><span class="dr-risco-frase">${UI.esc(o.p.frase)}</span></a>`).join('') + (emRisco.length > 8 ? `<p class="muted small">+ ${emRisco.length - 8} em Vagas.</p>` : '')}
            <div class="dr-nota">Previsão = prontos + quem está na documentação, entrevista e triagem × o quanto costuma chegar à admissão neste projeto (padrão ${Math.round(Store.TAXAS_PADRAO.documentos * 100)}%, ${Math.round(Store.TAXAS_PADRAO.entrevista * 100)}% e ${Math.round(Store.TAXAS_PADRAO.triagem * 100)}% enquanto houver menos de 10 casos).</div>
          </div>
          <div class="card"><h2>Gargalo por etapa <span class="muted small" style="font-weight:400">tempo parado</span></h2>
            <div class="dr-gar dr-tab-cab"><span>Etapa</span>${FAIXAS.map(f => `<span>${f[0]}</span>`).join('')}<span>Total</span></div>
            ${gar.map(g => `<div class="dr-gar"><b>${g.rot}</b>${g.n.map((x, i) => Store.pode(App.usuario, 'candidatos') && x
              ? `<button type="button" class="dr-gar-n dr-gar-${i} ${x ? 'tem' : ''}" data-seg="${g.e}" title="Ver em Candidatos quem está na ${UI.esc(g.rot.toLowerCase())}">${x}</button>`
              : `<span class="dr-gar-n dr-gar-${i} ${x ? 'tem' : ''}">${x}</span>`).join('')}<span class="dr-gar-tot">${g.n.reduce((a, b) => a + b, 0)}</span></div>`).join('')}
            <div class="dr-nota">Dias desde a última mudança do candidato. Clique no número para abrir a etapa em Candidatos.</div>
          </div>
          <div class="card"><h2>Funil</h2>
            ${funil.map(([rot, val], i) => `<div class="dr-funil"><div class="dr-funil-rot"><span>${rot}</span><b>${UI.fmtNum(val)}</b>${i ? `<em>${pct(val, funil[i - 1][1])}%</em>` : ''}</div>${barra(val, funil[0][1], i === 3 ? 'dr-ok' : '')}</div>`).join('')}
            <div class="dr-nota">Saíram na triagem: <b>${saiu('triagem')}</b> · na entrevista: <b>${saiu('entrevista')}</b> · na documentação: <b>${saiu('documentos')}</b></div>
          </div>
          <div class="card"><h2>Por RH</h2>
            <div id="dr-rh-corpo">${htmlPorRh()}</div>
            <div class="dr-nota">Clique no título da coluna para ordenar. Semana: admitidos nos últimos 7 dias. Parado: o candidato em processo há mais tempo sem mudança. Aprov.: admitidos entre quem já encerrou. Meta: admissões de ${RH.fmtDia(semanaM.seg)} a ${RH.fmtDia(semanaM.dom)} (segunda a domingo), em todos os projetos${podeMeta ? "; clique na meta para mudar" : ""}.</div>
          </div>
          <div class="card in-card-sem"><h2>Por semana <span class="muted small" style="font-weight:400">últimas 8 semanas</span></h2>
            ${!temSemanas ? '<p class="muted small">Nenhuma candidatura nem admissão nas últimas 8 semanas.</p>'
              : typeof Chart === 'undefined' ? `<div class="dr-tab dr-tab-mot dr-tab-cab"><span>Semana</span><span>Novos</span><span>Admit.</span><span>Cheg.</span></div>` + semG.map(s2 => `<div class="dr-tab dr-tab-mot"><b>${RH.fmtDia(s2.ini)} a ${RH.fmtDia(s2.fim)}</b><span>${s2.novos}</span><span>${s2.admitidos}</span><span>${s2.chegadas}</span></div>`).join('')
              : '<div class="in-sem-wrap"><canvas id="g-semanas" role="img" aria-label="Candidaturas novas e admitidos por semana"></canvas></div>'}
            <div class="dr-nota">Semana de segunda a domingo. Candidaturas pela data do cadastro; admitidos pela data da admissão.${rit.precisa > 0 ? ` A linha tracejada é o que precisa sair por semana para fechar até ${RH.fmtDia(prazoFinal)}.` : ''}</div>
          </div>
          <div class="card"><h2>De onde vêm <span class="muted small" style="font-weight:400">como soube da vaga</span></h2>
            ${!comF.length ? `<p class="muted small">Ninguém com "Como soube da vaga" preenchido ainda. Marque na ficha do candidato para saber qual divulgação traz gente que fica.</p>`
              : `<div class="dr-tab in-tab-can dr-tab-cab"><span>Canal</span><span title="Candidatos que vieram por este canal">Cand.</span><span title="Admitidos">Admit.</span><span title="Admitidos ÷ candidatos do canal">Aprov.</span></div>`
                + comF.slice(0, 6).map(c => `<div class="dr-tab in-tab-can ${c === melhorC ? 'in-can-melhor' : ''}"><b title="${UI.esc(c.nome)}">${UI.esc(c.nome)}${c === melhorC ? ' <i title="O canal que mais trouxe admitidos">★</i>' : ''}<span class="dr-barra"><i style="width:${Math.max(2, Math.round(100 * c.inscritos / maxC))}%"></i></span></b><span>${c.inscritos}</span><span class="${c.admitidos ? 'ok' : ''}">${c.admitidos}</span><span>${Math.round(100 * c.conversao)}%</span></div>`).join('')
                + (comF.length > 6 ? `<p class="muted small" style="margin:8px 0 0">+ ${comF.length - 6} no relatório.</p>` : '')}
            <div class="dr-nota">${semF && comF.length ? `${qtd(semF.inscritos, 'candidato', 'candidatos')} sem essa resposta (${Math.round(100 * semF.inscritos / l.length)}%). ` : ''}${podeRel && comF.length ? '<a href="#/relatorios" data-rel="canais">Ver o relatório de canais e indicações →</a>' : ''}</div>
          </div>
          <div class="card" style="grid-column:1/-1;order:9"><h2>Pedido x admitido por distrito</h2>
            ${porD.size ? `<div class="dr-tab dr-tab-dist dr-tab-cab"><span>Distrito</span><span>Locais</span><span>Móveis</span><span>Falta</span><span>Em processo</span><span title="Admissões esperadas do funil ÷ o que falta">Cobertura</span><span>Preenchido</span></div>` + [...porD.values()].sort((a, b) => b.falta - a.falta || a.nome.localeCompare(b.nome, 'pt-BR')).map(a => { const tot = a.pl + a.pm, ad = a.al + a.am;
                const cob = a.cob == null ? '<span class="ok">completo</span>' : `<span class="${a === piorD && a.cob < 1 ? 'ruim dr-pior' : a.cob < 0.5 ? 'ruim' : a.cob < 1 ? 'alerta' : 'ok'}" title="O funil deve render ${a.esp.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} admissões para ${a.falta} que faltam">${Math.round(100 * a.cob)}%</span>`;
                return `<div class="dr-tab dr-tab-dist ${a === piorD && a.cob < 1 ? 'dr-linha-pior' : ''}">
                <b>${UI.esc(a.nome)}</b><span class="${a.al >= a.pl ? 'ok' : ''}">${a.al}/${a.pl}</span><span class="${a.am >= a.pm ? 'ok' : ''}">${a.am}/${a.pm}</span><span class="${a.falta ? '' : 'ok'}">${a.falta}</span><span>${a.proc}</span>${cob}${barra(ad, tot, ad >= tot ? 'dr-ok' : '')}</div>`; }).join('') : '<p class="muted small">Nenhuma vaga aprovada com distritos.</p>'}
            ${porD.size ? '<div class="dr-nota">Cobertura = admissões esperadas de quem está em processo ÷ o que falta. Abaixo de 100% o funil não fecha o pedido: precisa de mais candidatos. O pior distrito fica em vermelho.</div>' : ''}
          </div>
          <div class="card"><h2>Saídas por motivo</h2>
            ${listaMotivos.length ? `<div class="dr-tab dr-tab-mot dr-tab-cab"><span>Motivo</span><span>Local</span><span>Móvel</span><span>Total</span></div>` + listaMotivos.map(a => `<div class="dr-tab dr-tab-mot"><b title="${UI.esc(a.motivo)} · ${a.rep} reprovado(s), ${a.des} desistência(s)">${UI.esc(a.motivo)}</b><span>${a.LOCAL}</span><span>${a.MOVEL}</span><span>${a.LOCAL + a.MOVEL}</span></div>`).join('') : '<p class="muted small">Ninguém saiu do processo neste filtro.</p>'}
            <div class="dr-nota"><b>Tempo médio em cada etapa</b>${tempoEtapas.map(([rot, t]) => `<div class="dr-tempo"><span>${rot}</span><b>${t ? fmtD(t.m) : '—'}</b>${t ? `<em>${qtd(t.n, 'pessoa', 'pessoas')}</em>` : ''}</div>`).join('')}</div>
          </div>
          <div class="card"><h2>Chegadas</h2>
            ${prox.length ? prox.map(([w, n]) => `<div class="dr-tab dr-tab-sem"><b>${RH.fmtDia(w)} a ${fimSem(w)}</b><span>${qtd(n, 'pessoa', 'pessoas')}</span>${barra(n, Math.max(...prox.map(x => x[1])))}</div>`).join('') : '<p class="muted small">Nenhuma chegada marcada a partir desta semana.</p>'}
            <div class="dr-nota">Pela data de chegada marcada na Documentação.</div>
          </div>
        </div>`;
      document.getElementById('dr-imprimir').addEventListener('click', () => window.print());
      // atalhos para os relatórios (indicadores e canais)
      alvo.querySelectorAll('[data-rel]').forEach(a => a.addEventListener('click', () => { try { localStorage.setItem('maparh:relatorio', a.dataset.rel); } catch (e) { /* ok */ } }));
      // gráfico por semana: candidaturas novas x admitidos, com a linha do que precisa sair por semana
      const cvSem = alvo.querySelector('#g-semanas');
      if (cvSem && typeof Chart !== 'undefined') {
        const ds = [
          { label: 'Candidaturas novas', data: semG.map(s2 => s2.novos), backgroundColor: '#93c5fd', borderRadius: 3, order: 2 },
          { label: 'Admitidos', data: semG.map(s2 => s2.admitidos), backgroundColor: '#16a34a', borderRadius: 3, order: 2 }];
        if (rit.precisa > 0) ds.push({ label: 'Precisa admitir por semana', data: semG.map(() => Math.ceil(rit.precisa * 10) / 10), type: 'line', borderColor: '#b45309', backgroundColor: 'rgba(0,0,0,0)', borderDash: [6, 4], borderWidth: 2, pointRadius: 0, pointHitRadius: 8, order: 1 });
        Paginas.dashboard._gSem = new Chart(cvSem, { type: 'bar',
          data: { labels: semG.map(s2 => s2.atual ? 'esta semana' : RH.fmtDia(s2.ini)), datasets: ds },
          options: { responsive: true, maintainAspectRatio: false, animation: false, color: '#475569', interaction: { mode: 'index', intersect: false },
            scales: { x: { grid: { display: false }, ticks: { color: '#475569' } }, y: { beginAtZero: true, ticks: { precision: 0, color: '#475569' } } },
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, color: '#475569' } },
              tooltip: { callbacks: { title: it => { const s2 = semG[it[0].dataIndex]; return `${RH.fmtDia(s2.ini)} a ${RH.fmtDia(s2.fim)}`; },
                afterBody: it => { const s2 = semG[it[0].dataIndex]; return s2.admitidos ? [`${s2.admLocal} local · ${s2.admMovel} móvel`] : []; } } } } } });
      }
      // Por RH: ordenar pela coluna e mudar a meta direto na linha (o miolo é redesenhado, então escuta no cartão)
      const corpoRh = alvo.querySelector('#dr-rh-corpo');
      if (corpoRh) corpoRh.addEventListener('click', e => {
        const o = e.target.closest('[data-ord]'), m = e.target.closest('[data-meta]');
        if (o) { const at = Paginas.dashboard._ordRh || { k: 'sem', inv: false }; Paginas.dashboard._ordRh = { k: o.dataset.ord, inv: at.k === o.dataset.ord ? !at.inv : false }; corpoRh.innerHTML = htmlPorRh(); }
        else if (m) editarMeta(m.dataset.meta);
      });
      // gargalo: o número abre Candidatos na etapa (lista), sem filtro de vaga
      alvo.querySelectorAll('[data-seg]').forEach(b => b.addEventListener('click', () => {
        try { sessionStorage.setItem('maparh:cand-seg', b.dataset.seg); localStorage.setItem('maparh:cand-vaga', ''); if (App.filtros.projetoId) localStorage.setItem('maparh:cand-projeto', App.filtros.projetoId); } catch (e) { /* ok */ }
        App.ir('candidatos');
      }));
      // resumo curto para o WhatsApp (negrito com *)
      document.getElementById('dr-whats').addEventListener('click', async () => {
        const chegam = l.filter(p => (p.situacao === 'em_andamento' || p.situacao === 'admitido') && p.chegada_data && p.chegada_data >= segH && p.chegada_data <= fimH).length;
        const t = [`*Recrutamento ${RH.fmtDia(RH.hoje())}*${App.descricaoFiltro() ? ' — ' + App.descricaoFiltro() : ''}`,
          `Pedido x admitido: *${admV} de ${pedidas}* (${pct(admV, pedidas)}%) · faltam ${Math.max(0, pedidas - admV)}`,
          `Em processo: ${ab.length} (${n('triagem')} triagem, ${n('entrevista')} entrevista, ${n('documentos')} documentação)`];
        if (emRisco.length) {
          t.push(`Vagas em risco: *${emRisco.length}* de ${prevs.length}`);
          for (const o of emRisco.slice(0, 5)) t.push(`• ${o.v.titulo}${o.v.porDistrito.length ? ' (' + o.v.porDistrito.map(d => d.distrito.nome).join(', ') + ')' : ''}: ${o.p.rotulo.toLowerCase()}, ${o.p.frase}`);
        } else if (prevs.length) t.push(`Vagas abertas: ${prevs.length}, todas no prazo`);
        if (rec2.atrasadas) t.push(`Atrasadas: ${rec2.atrasadas}`);
        if (rec2.aguardandoAprovacao) t.push(`Aguardando aprovação: ${rec2.aguardandoAprovacao}`);
        t.push(`Chegam esta semana: ${chegam}`);
        if (parados8) t.push(`Gargalo: ${parados8} parado${parados8 > 1 ? 's' : ''} há 8+ dias (mais na ${pior8.rot.toLowerCase()}: ${pior8.n[2]})`);
        if (tc.admissao != null) t.push(`Da aprovação à admissão: ${fmtD(tc.admissao)} (mediana)`);
        if (sm && rit.precisa > 0) t.push(`Ritmo: *${sm[1]}* — precisa de ${fmtSem(Math.ceil(rit.precisa * 10) / 10)} por semana até ${RH.fmtDia(prazoFinal)}, hoje ${fmtSem(rit.atual)}`);
        else if (sm && rit.situacao === 'vencido') t.push(`Ritmo: *Prazo vencido* (${RH.fmtDia(prazoFinal)}), faltam ${faltamT}`);
        if (ind.encerrados) t.push(`Aproveitamento: ${pc1(ind.aproveitamento)} · desistência: ${pc1(ind.desistencia)}${ind.comparecimento != null ? ` · chegaram ao campo: ${pc1(ind.comparecimento)}` : ''}`);
        const texto = t.join('\n');
        try { await navigator.clipboard.writeText(texto); UI.toast('Resumo copiado. Cole no WhatsApp.', 'sucesso'); }
        catch (e) {
          const ta = document.createElement('textarea'); ta.value = texto; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); UI.toast('Resumo copiado. Cole no WhatsApp.', 'sucesso'); } catch (e2) { UI.toast('Não foi possível copiar.', 'erro'); }
          ta.remove();
        }
      });
    };
    Promise.resolve().then(async () => {   // logo depois de montar a tela, antes de ela aparecer: com o último resultado guardado não pisca
      const v = document.getElementById('dash-cand'), s = document.getElementById('dash-cand-sub'), alvo = document.getElementById('dash-rec'); if (!v) return;
      if (typeof Nuvem === 'undefined' || !Nuvem.ativa) { v.textContent = '—'; s.textContent = 'precisa do banco central'; alvo.innerHTML = ''; return; }
      let l;
      const pid = App.filtros.projetoId || '', cache = Paginas.dashboard.cacheDe(pid);
      if (cache) {
        l = cache.l;   // o que já tinha: aparece na hora; a conferência abaixo só redesenha o recrutamento se mudou
        Nuvem.rh.andamento(App.filtros.projetoId).then(n => { const j = JSON.stringify(n); if (j === cache.j) return; Paginas.dashboard._cache = { pid, l: n, j }; if (App.paginaAtual === 'dashboard') pintarRec(n); }).catch(() => {});
      } else try { l = await Nuvem.rh.andamento(App.filtros.projetoId); Paginas.dashboard._cache = { pid, l, j: JSON.stringify(l) }; } catch (e) {
        v.textContent = '—'; s.textContent = 'não foi possível carregar';
        alvo.innerHTML = '<div class="card vazio mb">Não foi possível carregar o recrutamento. <button class="btn btn-pequeno" id="dr-tentar">Tentar de novo</button></div>';
        document.getElementById('dr-tentar').addEventListener('click', () => App.recarregar()); return;
      }
      pintarRec(l);
    });
    el.innerHTML = `
      <div id="dash-dia"></div>
      <div class="fluxo">
        <a class="fluxo-passo" href="#/vagas">
          <div class="fluxo-num">1</div>
          <div><div class="fluxo-titulo">Vagas abertas</div><div class="fluxo-valor" id="dash-vagas">${UI.fmtNum(rec.vagasAbertas)}</div><div class="fluxo-sub" id="dash-vagas-sub">${UI.fmtNum(rec.posicoes)} ${rec.posicoes === 1 ? 'pessoa' : 'pessoas'} ainda a contratar${rec.semDivulgacao ? ` · <span class="erro">${rec.semDivulgacao} sem divulgar</span>` : ''}</div></div>
        </a>
        <div class="fluxo-seta">→</div>
        <a class="fluxo-passo" ${Store.pode(App.usuario, 'candidatos') ? 'href="#/candidatos"' : 'aria-disabled="true"'}>
          <div class="fluxo-num">2</div>
          <div><div class="fluxo-titulo">Candidatos em processo</div><div class="fluxo-valor" id="dash-cand">…</div><div class="fluxo-sub" id="dash-cand-sub">triagem, entrevista e documentação</div></div>
        </a>
        <div class="fluxo-seta">→</div>
        <a class="fluxo-passo" ${Store.pode(App.usuario, 'cadastro') ? 'href="#/cadastro"' : 'aria-disabled="true"'}>
          <div class="fluxo-num">3</div>
          <div><div class="fluxo-titulo">Contratações</div><div class="fluxo-valor">${UI.fmtNum(r.total)}</div><div class="fluxo-sub">${UI.fmtNum(r.local)} local · ${UI.fmtNum(r.movel)} móvel</div></div>
        </a>
        <div class="fluxo-seta">→</div>
        <a class="fluxo-passo" href="#/mapa">
          <div class="fluxo-num">4</div>
          <div><div class="fluxo-titulo">No mapa</div><div class="fluxo-valor">${UI.fmtNum(r.cidadesOrigem)}</div><div class="fluxo-sub">cidades de origem · ${UI.fmtNum(r.cidadesAtuacao)} de trabalho</div></div>
        </a>
      </div>
      <div id="dash-pend">${cardPendencias({ ...rec, contagemPronta: false })}</div>
      <div id="dash-rec">${Paginas.dashboard.cacheDe(App.filtros.projetoId || '') ? '' : '<div class="card dr-esqueleto mb"></div>'}</div>
      <div class="secao-titulo">Perfil de quem já foi contratado <span class="muted small">${UI.esc(App.descricaoFiltro())}</span></div>
      <div class="grade kpis mb">
        <div class="card kpi"><div class="rotulo">Contratações</div><div class="valor">${UI.fmtNum(r.total)}</div><div class="sub">${UI.fmtNum(r.projetos)} projeto(s)</div></div>
        <div class="card kpi kpi-local"><div class="rotulo">Local</div><div class="valor">${UI.fmtNum(r.local)}</div><div class="sub">${UI.fmtPct(r.pctLocal)} do total</div></div>
        <div class="card kpi kpi-movel"><div class="rotulo">Móvel</div><div class="valor">${UI.fmtNum(r.movel)}</div><div class="sub">${UI.fmtPct(r.pctMovel)} do total</div></div>
        <div class="card kpi"><div class="rotulo">Cidades de origem</div><div class="valor">${UI.fmtNum(r.cidadesOrigem)}</div><div class="sub">em ${UI.fmtNum(r.ufsOrigem)} estado(s)</div></div>
        <div class="card kpi"><div class="rotulo">Vêm de fora do estado</div><div class="valor">${UI.fmtNum(r.foraDoEstado)}</div><div class="sub">${UI.fmtPct(r.pctForaDoEstado)} do total</div></div>
        <div class="card kpi"><div class="rotulo">Moram onde trabalham</div><div class="valor">${UI.fmtNum(r.mesmaCidade)}</div><div class="sub">de ${UI.fmtNum(r.cidadesAtuacao)} cidades de trabalho</div></div>
        <div class="card kpi"><div class="rotulo">Distância casa → trabalho</div><div class="valor">${UI.fmtKm(r.distMedia)}</div><div class="sub">média · máx. ${UI.fmtKm(r.distMax)}</div></div>
      </div>
      ${htmlSafra}
      <div class="grade grade-2 mb" id="graficos">
        <div class="card"><h2>De onde vêm (10 maiores cidades)</h2><div class="grafico-wrap"><canvas id="g-origem"></canvas></div></div>
        <div class="card"><h2>Onde trabalham (10 maiores cidades)</h2><div class="grafico-wrap"><canvas id="g-atuacao"></canvas></div></div>
        <div class="card"><h2>Estados de origem</h2><div class="grafico-wrap"><canvas id="g-uf"></canvas></div></div>
        <div class="card"><h2>Distância de casa até o trabalho</h2><div class="grafico-wrap"><canvas id="g-dist"></canvas></div></div>
        ${Store.distritos().length ? `<div class="card" style="grid-column:1/-1"><h2>Contratações por microrregião <span class="muted small" style="font-weight:400">(pela cidade onde trabalham)</span></h2><div class="grafico-wrap" id="g-micro-wrap"><canvas id="g-micro"></canvas></div></div>` : ''}
        ${temAno ? '<div class="card" style="grid-column:1/-1"><h2>Evolução por ano</h2><div class="grafico-wrap"><canvas id="g-ano"></canvas></div></div>' : ''}
      </div>
      <div class="card">
        <h2>Resumo por projeto</h2>
        <div id="resumo-projetos"></div>
      </div>`;

    // links que abrem Candidatos já filtrado (pendências e resumo do dia)
    if (!el._linksCand) el.addEventListener('click', el._linksCand = e => {
      if (App.paginaAtual !== 'dashboard') return;
      const a = e.target.closest('[data-cand-seg], [data-cand-pend]'); if (!a) return;
      e.preventDefault();
      try {
        sessionStorage.setItem('maparh:cand-seg', a.dataset.candSeg || '');
        sessionStorage.setItem('maparh:cand-pend', a.dataset.candPend || '');
        localStorage.setItem('maparh:cand-vaga', '');
        // "Seu dia" conta o projeto dele (o do filtro ou o primeiro ativo): Candidatos abre nesse mesmo projeto
        const pidLink = App.filtros.projetoId || (a.closest('#dash-dia') ? el._diaPid : '');
        if (pidLink) localStorage.setItem('maparh:cand-projeto', pidLink);
      } catch (er) { /* ok */ }
      App.ir('candidatos');
    });
    // "Seu dia" para quem não vê todos os RHs (o RH vê o que é dele): o que fazer hoje, do mais urgente para o menos,
    // cada item abre Candidatos já filtrado (mesmos filtros da faixa "Hoje" de Candidatos, então os números batem)
    let pintarDia = null, diaPid = '';
    if (temDia) {
      diaPid = el._diaPid = App.filtros.projetoId || ((App.projetosVisiveis().filter(p => p.ativo !== false)[0] || {}).id) || '';
      pintarDia = lista => {
        const box = el.querySelector('#dash-dia'); if (!box || !lista) return;
        const hoje = RH.hoje(), DIA = 86400000;
        const amanha = (() => { const d = new Date(hoje + 'T12:00:00'); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
        const emAnd = p => p.situacao === 'em_andamento', naE = (p, e) => emAnd(p) && p.etapa === e;
        const dias = ts => ts ? Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / DIA)) : 0;
        const naEtapaHa = p => dias(p.etapa_em || p.criado_em);
        const contato = p => { const a = (p.anotacoes || []).filter(x => String(x.texto || '').startsWith('Mensagem pelo WhatsApp: primeiro contato')).pop(); return a && a.em ? a.em : null; };
        const ok2 = v => ['ok', 'dispensado'].includes(v);
        const pronto = p => naE(p, 'documentos') && p.dinamica === 'ok' && !p.documentos_pendentes && ok2(p.aso) && ok2(p.treinamento) && p.aso !== 'inapto';
        const ent = p => p.entrevista || {}, entAguarda = p => (ent(p).resultado || 'aguardando') === 'aguardando';
        const temCheg = p => !!p.chegada_data && (naE(p, 'documentos') || p.situacao === 'admitido');
        const stCheg = p => p.chegada_status || 'aguardando';
        const conta = f => lista.filter(f).length;
        const porSeg = (f, um, varios, nivel, pend, dica) => ['admitido', 'documentos'].map(sg => itemP(conta(p => f(p) && (sg === 'admitido' ? p.situacao === 'admitido' : naE(p, 'documentos'))),
          um + (sg === 'admitido' ? ' (admitido)' : ' (documentação)'), varios + (sg === 'admitido' ? ' (admitidos)' : ' (documentação)'), nivel, { seg: sg, pend }, dica));
        const itens = ordenarItens([
          ...porSeg(p => temCheg(p) && p.chegada_data < hoje && stCheg(p) === 'aguardando', 'chegada passada sem confirmação', 'chegadas passadas sem confirmação', 'ruim', 'chegavencida', 'marque se chegou ou faltou'),
          itemP(conta(p => naE(p, 'entrevista') && ent(p).data && ent(p).data < hoje && entAguarda(p)), 'entrevista que passou sem resultado', 'entrevistas que passaram sem resultado', 'ruim', { seg: 'entrevista', pend: 'semresultado' }, 'marque aprovado, reprovado ou remarque'),
          itemP(conta(p => naE(p, 'documentos') && p.aso === 'agendado' && p.aso_data && p.aso_data < hoje), 'ASO que passou sem resultado', 'ASOs que passaram sem resultado', 'ruim', { seg: 'documentos', pend: 'asoatraso' }, 'lance o resultado do exame'),
          ...porSeg(p => temCheg(p) && p.chegada_data === hoje && !['chegou', 'faltou'].includes(stCheg(p)), 'chega hoje no campo', 'chegam hoje no campo', 'hoje', 'chegahoje', 'confirme a chegada'),
          itemP(conta(p => emAnd(p) && ent(p).data === hoje), 'entrevista hoje', 'entrevistas hoje', 'hoje', { seg: 'agenda' }, 'veja os horários na agenda'),
          itemP(conta(p => naE(p, 'documentos') && p.aso === 'agendado' && p.aso_data === hoje), 'ASO hoje', 'ASOs hoje', 'hoje', { seg: 'documentos', pend: 'asohoje' }),
          itemP(conta(pronto), 'pronto para admitir', 'prontos para admitir', 'ok', { seg: 'documentos', pend: 'prontas' }, 'documentação completa: falta só admitir'),
          itemP(conta(p => naE(p, 'entrevista') && ent(p).data === amanha && entAguarda(p) && ent(p).confirmou !== 'sim'), 'entrevista amanhã sem confirmação', 'entrevistas amanhã sem confirmação', 'meio', { seg: 'agenda' }, 'mande o lembrete'),
          itemP(conta(p => naE(p, 'triagem') && contato(p) && dias(contato(p)) >= 2), 'aguardando resposta há 2+ dias', 'aguardando resposta há 2+ dias', 'meio', { seg: 'triagem', pend: 'semresposta' }, 'cobre de novo ou encerre'),
          itemP(conta(p => naE(p, 'triagem') && naEtapaHa(p) >= 3), 'na triagem há 3+ dias', 'na triagem há 3+ dias', 'meio', { seg: 'triagem', pend: 'parados3' }, 'faça o 1º contato ou avance'),
          itemP(conta(p => naE(p, 'entrevista') && !ent(p).data), 'entrevista sem data marcada', 'entrevistas sem data marcada', 'meio', { seg: 'entrevista', pend: 'semdata' }, 'agende com a pessoa'),
          itemP(conta(p => naE(p, 'documentos') && !pronto(p) && naEtapaHa(p) >= 7), 'documentação parada há 7+ dias', 'documentações paradas há 7+ dias', 'meio', { seg: 'documentos', pend: 'docparada' }, 'cobre os documentos que faltam'),
          itemP(conta(p => naE(p, 'documentos') && p.treinamento === 'agendado' && p.treinamento_data === amanha), 'treinamento amanhã', 'treinamentos amanhã', 'meio', { seg: 'documentos', pend: 'treamanha' })]);
        const proj = Store.projeto(diaPid), urg = itens.filter(o => o.nivel === 'ruim').length;
        box.innerHTML = `<section class="card in-dia mb"><div class="in-cab"><h2>Seu dia <span class="muted small">${RH.fmtDia(hoje)}${proj && App.projetosVisiveis().length > 1 ? ' · ' + UI.esc(proj.nome) : ''}</span></h2>
            <span class="muted small">${itens.length ? `${itens.length === 1 ? '1 coisa' : itens.length + ' coisas'} para resolver${urg ? ` · <span class="in-txt-ruim">${urg} urgente${urg > 1 ? 's' : ''}</span>` : ''}` : ''}</span>
            <a href="#/candidatos" class="btn btn-pequeno in-cab-ir" data-cand-seg="" data-cand-pend="">Abrir Candidatos →</a></div>
          <div id="in-meta-box">${htmlMetaDia()}</div>
          ${itens.length ? `<div class="in-lista">${itens.map(linhaItem).join('')}</div>`
            : `<p class="in-vazio">✓ Tudo em dia: nenhuma entrevista, chegada, ASO ou documento pedindo ação. ${conta(emAnd) ? `Você tem ${conta(emAnd)} em processo.` : 'Quando chegarem candidatos para você, o que fazer aparece aqui.'}</p>`}</section>`;
      };
      if (diaPid) {
        const c = Nuvem.rh.emCache && Nuvem.rh.emCache(diaPid);
        if (c) pintarDia(c);
        else Nuvem.rh.listar(diaPid).then(l => { if (App.paginaAtual === 'dashboard') pintarDia(l); }).catch(() => {});
      }
    }
    // dado novo de outro computador: candidatos mudaram → refaz só o recrutamento e o "Seu dia" (sem redesenhar a tela
    // nem os gráficos); só vaga mudou → refaz o recrutamento com o andamento que já tem; contratação/projeto → tela toda
    App.aoAtualizar(async info => {
      if (App.paginaAtual !== 'dashboard' || !el.querySelector('#dash-rec')) return;
      info = info || {};
      const pidA = App.filtros.projetoId || '';
      if (info.semCandidatos) {
        const cs = info.colecoes ? [...info.colecoes] : null;
        if (cs && cs.every(c => c === 'auditoria')) return;
        if (cs && cs.every(c => c === 'vagas' || c === 'auditoria')) { const c = Paginas.dashboard.cacheDe(pidA); if (c) pintarRec(c.l); return; }
        App.rotear(true); return;
      }
      if (typeof Nuvem === 'undefined' || !Nuvem.ativa || !Nuvem.rh) return;
      Nuvem.rh.andamento(App.filtros.projetoId).then(n => {
        const j = JSON.stringify(n), c = Paginas.dashboard._cache;
        if (c && c.pid === pidA && c.j === j) return;
        Paginas.dashboard._cache = { pid: pidA, l: n, j };
        if (App.paginaAtual === 'dashboard' && (App.filtros.projetoId || '') === pidA) pintarRec(n);
      }).catch(() => {});
      if (pintarDia && diaPid) {
        try {
          const l = info.ids && info.ids.length && Nuvem.rh.atualizarIds ? await Nuvem.rh.atualizarIds(diaPid, info.ids) : await Nuvem.rh.listar(diaPid);
          if (App.paginaAtual === 'dashboard') pintarDia(l);
        } catch (e) { /* fica o que estava */ }
      }
    });

    if (!regs.length) {
      el.querySelector('#graficos').innerHTML = `<div class="card vazio" style="grid-column:1/-1">Nenhuma contratação cadastrada para o filtro atual. ${Store.pode(App.usuario, 'candidatos') ? 'As contratações nascem da admissão: <a href="#/candidatos">ir para Candidatos</a>.' : ''}</div>`;
    } else if (typeof Chart === 'undefined') {
      el.querySelectorAll('.grafico-wrap').forEach(g => g.innerHTML = '<div class="vazio">Gráficos indisponíveis sem conexão com a internet.</div>');
    } else {
      Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
      Chart.defaults.color = '#475569';
      Chart.defaults.animation = false;   // redesenhar com dado novo não pode "piscar" os gráficos
      const empilhado = (horizontal) => ({ indexAxis: horizontal ? 'y' : 'x', responsive: true, maintainAspectRatio: false,
        scales: { x: { stacked: true, ticks: { precision: 0 } }, y: { stacked: true, ticks: { precision: 0 } } }, plugins: { legend: { position: 'bottom' } } });
      const dsLM = (lista) => [
        { label: 'LOCAL', data: lista.map(c => c.local), backgroundColor: '#16a34a', stack: 's' },
        { label: 'MÓVEL', data: lista.map(c => c.movel), backgroundColor: '#ea580c', stack: 's' }];

      const origem = Analise.porCidadeOrigem(regs).slice(0, 10);
      graficos.push(new Chart(el.querySelector('#g-origem'), { type: 'bar',
        data: { labels: origem.map(c => `${c.cidade.nome}/${c.cidade.uf}`), datasets: dsLM(origem) }, options: empilhado(true) }));

      const atuacao = Analise.porCidadeAtuacao(regs).slice(0, 10);
      graficos.push(new Chart(el.querySelector('#g-atuacao'), { type: 'bar',
        data: { labels: atuacao.map(a => a.rotulo), datasets: dsLM(atuacao) }, options: empilhado(true) }));

      const ufs = Analise.porUF(regs);
      const cores = ['#1d4ed8', '#0891b2', '#7c3aed', '#db2777', '#f59e0b', '#65a30d', '#0f766e', '#9333ea', '#dc2626', '#475569'];
      graficos.push(new Chart(el.querySelector('#g-uf'), { type: 'doughnut',
        data: { labels: ufs.map(u => `${u.uf} — ${u.nome}${u.foraDoEstado ? ' (fora)' : ''}`), datasets: [{ data: ufs.map(u => u.total), backgroundColor: ufs.map((_, i) => cores[i % cores.length]) }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } } }));

      const cvMicro = el.querySelector('#g-micro');
      if (cvMicro) {
        const micros = Analise.porMicro(regs);
        const variosDistritos = new Set(micros.map(m => m.distrito).filter(Boolean)).size > 1;
        el.querySelector('#g-micro-wrap').style.height = Math.max(220, 40 + micros.length * 30) + 'px';
        graficos.push(new Chart(cvMicro, { type: 'bar',
          data: { labels: micros.map(m => m.nome + (variosDistritos && m.distrito ? ' · ' + m.distrito : '')), datasets: [
            { label: 'LOCAL', data: micros.map(m => m.local), backgroundColor: '#16a34a', stack: 's' },
            { label: 'MÓVEL', data: micros.map(m => m.movel), backgroundColor: '#ea580c', stack: 's' },
            { label: 'Moram na própria microrregião', data: micros.map(m => m.micro ? m.propria : null), type: 'line', borderColor: '#1d4ed8', backgroundColor: '#1d4ed8', showLine: false, pointStyle: 'rectRot', pointRadius: 6, stack: 'p' }] },
          options: { ...empilhado(true), plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { afterBody: itens => { const m = micros[itens[0].dataIndex]; return m.micro ? [`${m.propria} moram na própria micro (${m.pctPropria.toFixed(0)}%)`, `${m.cidadesOrigem} cidade(s) de origem · dist. média ${UI.fmtKm(m.distMedia)}`] : []; } } } } } }));
      }

      const fx = Analise.faixasDistancia(regs);
      graficos.push(new Chart(el.querySelector('#g-dist'), { type: 'bar',
        data: { labels: fx.map(f => f.faixa), datasets: dsLM(fx) }, options: empilhado(false) }));

      if (temAno) {
        const anos = Analise.porAno(regs);
        graficos.push(new Chart(el.querySelector('#g-ano'), { type: 'bar',
          data: { labels: anos.map(a => String(a.ano)), datasets: [
            { label: 'LOCAL', data: anos.map(a => a.local), backgroundColor: '#16a34a', stack: 's', yAxisID: 'y' },
            { label: 'MÓVEL', data: anos.map(a => a.movel), backgroundColor: '#ea580c', stack: 's', yAxisID: 'y' },
            { label: 'Cidades de origem', data: anos.map(a => a.cidadesOrigem), type: 'line', borderColor: '#1d4ed8', backgroundColor: '#1d4ed8', yAxisID: 'y2', tension: .3 },
            { label: 'Origem fora do estado', data: anos.map(a => a.foraDoEstado), type: 'line', borderColor: '#7c3aed', backgroundColor: '#7c3aed', yAxisID: 'y2', tension: .3, borderDash: [6, 4] }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } },
            scales: { x: { stacked: true }, y: { stacked: true, ticks: { precision: 0 }, title: { display: true, text: 'Contratações' } },
              y2: { position: 'right', grid: { drawOnChartArea: false }, ticks: { precision: 0 }, title: { display: true, text: 'Cidades' } } } } }));
      }
    }

    el.querySelector('#resumo-projetos').innerHTML = UI.tabela({
      vazio: 'Nenhum projeto para exibir.',
      colunas: [
        { titulo: 'Projeto', render: p => `<span class="ponto-cor" style="background:${UI.esc(p.projeto.cor)}"></span>${UI.esc(p.projeto.nome)}${p.projeto.ativo ? '' : ' <span class="badge badge-cinza">inativo</span>'}` },
        { titulo: 'Estado', render: p => Store.ufsProjeto(p.projeto).join('/') },
        { titulo: 'Ano', render: p => p.projeto.ano || '<span class="muted">—</span>' },
        { titulo: 'Total', classe: 'direita', render: p => `<b>${UI.fmtNum(p.total)}</b>` },
        { titulo: 'Local', classe: 'direita', render: p => UI.fmtNum(p.local) },
        { titulo: 'Móvel', classe: 'direita', render: p => UI.fmtNum(p.movel) },
        { titulo: 'Cidades de origem', classe: 'direita', render: p => `${UI.fmtNum(p.cidadesOrigem)} <span class="muted small">(${p.ufsOrigem} UF)</span>` },
        { titulo: 'Fora do estado', classe: 'direita', render: p => UI.fmtNum(p.foraDoEstado) },
        { titulo: 'Cidades de atuação', classe: 'direita', render: p => UI.fmtNum(p.cidadesAtuacao) },
        { titulo: 'Todo o estado', classe: 'direita', render: p => UI.fmtNum(p.atuacaoMovel) },
        { titulo: 'Dist. média', classe: 'direita', render: p => UI.fmtKm(p.distMedia) }
      ],
      linhas: Analise.porProjeto(regs, projetos)
    });

    return () => { graficos.forEach(g => g.destroy()); if (Paginas.dashboard._gSem) { Paginas.dashboard._gSem.destroy(); Paginas.dashboard._gSem = null; } };
  }
};
