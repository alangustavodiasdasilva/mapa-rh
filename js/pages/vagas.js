// Vagas: pedido de vaga com aprovação. Quem precisa de gente pede a vaga: cargo, projeto, para quando, em quais distritos
// e quantas pessoas locais e móveis em cada um, e quem do RH vai cuidar dela (esse RH só enxerga as vagas dele).
// Um administrador aprova ou recusa; só a vaga aprovada pode ser divulgada e receber candidatos.
// Daqui também saem o texto do anúncio e os atalhos para as plataformas de divulgação.
Paginas.vagas = {
  titulo: 'Vagas',
  filtrosUsados: ['projeto', 'regiao', 'tipo'],
  render(el) {
    const podeEditar = App.podeEditar();
    // divulgar e escrever observação: admin, gestor e o RH responsável pela vaga (regra também no banco)
    const podeMexer = v => podeEditar || (App.usuario.perfil === 'analista' && (v.responsaveis || []).includes(App.usuario.login));
    const podeAprovar = Store.podeAprovarVaga(App.usuario);
    const ehAdmin = App.usuario.perfil === 'admin';
    const ABAS = [['abertas', 'Em andamento'], ['aguardando', 'Aguardando aprovação'], ['preenchida', 'Preenchidas'], ['fora', 'Recusadas/canceladas'], ['todas', 'Todas']];
    const guardado = k => { try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; } };
    let aba = localStorage.getItem('maparh:vagas-status') || 'abertas';
    if (!ABAS.some(a => a[0] === aba)) aba = 'abertas';
    let prioridade = guardado('maparh:vagas-prioridade'), recrutador = guardado('maparh:vagas-recrutador'), busca = '';

    const CLASSE_STATUS = { aguardando: 'badge-amarelo', aberta: 'badge-azul', divulgada: 'badge-azul', selecao: 'badge-roxo', preenchida: 'badge-verde', cancelada: 'badge-cinza', recusada: 'badge-vermelho' };
    const CLASSE_PRIORIDADE = { baixa: 'badge-cinza', normal: 'badge-azul', alta: 'badge-amarelo', urgente: 'badge-vermelho' };
    const ORDEM_PRIORIDADE = { urgente: 0, alta: 1, normal: 2, baixa: 3 };
    const fechada = v => ['preenchida', 'cancelada', 'recusada'].includes(v.status);
    const naAba = {
      aguardando: v => v.status === 'aguardando',
      abertas: v => v.status === 'aberta' || v.status === 'divulgada' || v.status === 'selecao',
      preenchida: v => v.status === 'preenchida',
      fora: v => v.status === 'recusada' || v.status === 'cancelada',
      todas: () => true
    };
    // "1 vaga" / "3 vagas": sempre a palavra inteira, sem "(s)"
    const qtd = (n, um, varios) => `${UI.fmtNum(n)} ${n === 1 ? um : varios}`;
    const fmtDia = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '';
    const textoJustificativa = v => v.justificativa && v.justificativa.tipo
      ? Store.JUSTIFICATIVAS[v.justificativa.tipo] + (v.justificativa.texto ? ': ' + v.justificativa.texto : '') : '';
    // onde a vaga é: os distritos do pedido (vaga antiga, sem distrito, mostra a cidade)
    const ondeTexto = v => v.porDistrito.length ? v.porDistrito.map(x => x.distrito.nome).join(', ') : (v.cidade ? v.cidade.nome + '/' + v.cidade.uf : '');
    const podeVerCandidatos = Store.pode(App.usuario, 'candidatos');
    let ativo = true;
    // andamento dos candidatos (sem dado pessoal): previsão de cada vaga e tempo de contratação
    let andam = null, taxasPorProjeto = new Map();
    function previsao(v) {
      if (!andam || !v.contagemCarregada) return null;
      if (!taxasPorProjeto.has(v.projetoId)) taxasPorProjeto.set(v.projetoId, Store.taxasAproveitamento(andam.filter(p => p.projeto_id === v.projetoId)));
      return Store.previsaoVaga(v, andam, taxasPorProjeto.get(v.projetoId));
    }

    // ---------- o que falta em cada vaga (pendências) ----------
    // candidato "parado": em andamento e sem nenhuma mudança há DIAS_PARADO dias ou mais (pelo andamento, sem dado pessoal)
    const DIAS_PARADO = 7;
    const diasDesde = iso => { const t = iso ? new Date(iso).getTime() : NaN; return isNaN(t) ? null : Math.max(0, Math.floor((Date.now() - t) / 86400000)); };
    let paradosPorVaga = new Map();
    function contarParados() {
      paradosPorVaga = new Map();
      for (const p of andam || []) {
        if (!p.vaga_id || p.situacao !== 'em_andamento') continue;
        const d = diasDesde(p.atualizado_em || p.etapa_em || p.criado_em);
        if (d != null && d >= DIAS_PARADO) paradosPorVaga.set(p.vaga_id, (paradosPorVaga.get(p.vaga_id) || 0) + 1);
      }
    }
    const parados = v => paradosPorVaga.get(v.id) || 0;
    // há quantos dias foi a última marcação de divulgação
    const diasUltimaDivulgacao = v => { const ds = Object.values(v.divulgacao || {}).map(d => d && d.em).filter(Boolean).sort(); return ds.length ? diasDesde(ds[ds.length - 1]) : null; };
    const ROT_FOCO = { atrasadas: 'atrasadas', semdiv: 'sem divulgação', semcand: 'sem ninguém em processo', parados: 'com candidatos parados', vence7: 'que vencem em 7 dias', semrh: 'sem RH responsável' };
    const noFoco = {
      atrasadas: v => v.atrasada,
      semdiv: v => v.aprovada && !fechada(v) && !v.canaisDivulgados,
      semcand: v => v.aprovada && !fechada(v) && v.contagemCarregada && !!v.canaisDivulgados && !v.emProcesso && v.faltam > 0,
      parados: v => v.aprovada && !fechada(v) && parados(v) > 0,
      vence7: v => { if (!v.aprovada || fechada(v) || v.atrasada || !v.dataNecessidade || !v.faltam) return false; const n = diasAte(v.dataNecessidade); return n >= 0 && n <= 7; },
      semrh: v => v.aprovada && !fechada(v) && !(v.responsaveis || []).length
    };
    // lista do que falta na vaga, da mais urgente para a menos: [{ tipo, txt, cls, acao, rot }]
    function pendencias(v) {
      if (!v.aprovada || fechada(v)) return [];
      const l = [];
      if (noFoco.atrasadas(v)) l.push({ tipo: 'atrasadas', cls: 'ruim', txt: `atrasada ${qtd(v.diasAtraso, 'dia', 'dias')}`, acao: podeEditar ? 'prazo' : '', rot: 'Nova data', sec: true });
      if (noFoco.vence7(v)) { const n = diasAte(v.dataNecessidade); l.push({ tipo: 'vence7', cls: 'alerta', txt: n === 0 ? 'precisa para hoje' : `vence em ${qtd(n, 'dia', 'dias')}` }); }
      if (noFoco.semdiv(v)) l.push({ tipo: 'semdiv', cls: 'alerta', txt: `sem divulgação${v.diasAberta ? ` há ${qtd(v.diasAberta, 'dia', 'dias')}` : ''}`, acao: 'divulgar', rot: 'Divulgar' });
      if (noFoco.semcand(v)) { const d = diasUltimaDivulgacao(v); l.push({ tipo: 'semcand', cls: 'alerta', txt: `ninguém em processo${d ? ` · divulgada há ${qtd(d, 'dia', 'dias')}` : ''}`, acao: 'divulgar', rot: 'Divulgar de novo' }); }
      if (noFoco.parados(v)) { const n = parados(v); l.push({ tipo: 'parados', cls: 'alerta', txt: `${qtd(n, 'candidato parado', 'candidatos parados')} há ${DIAS_PARADO}+ dias`, acao: 'candidatos', rot: 'Ver candidatos' }); }
      if (noFoco.semrh(v)) l.push({ tipo: 'semrh', cls: 'alerta', txt: 'sem RH responsável', acao: podeEditar ? 'editar' : '', rot: 'Escolher RH' });
      return l;
    }

    // vagas que o usuário enxerga, já com os filtros do topo do sistema (projeto, região, tipo)
    function visiveis() {
      let vagas = Store.vagasVisiveis(App.usuario, { projetoId: App.filtros.projetoId });
      if (App.filtros.distritoId || App.filtros.microId) {
        const reg = App.regiaoFiltrada();
        const ids = new Set(reg.micro ? reg.micro.cidadeIds || [] : Store.cidadesDoDistrito(reg.distrito).map(c => c.id));
        vagas = vagas.filter(v => v.porDistrito.length ? v.porDistrito.some(x => x.distrito.id === reg.distrito.id) : ids.has(v.cidadeId));
      }
      if (App.filtros.tipo) vagas = vagas.filter(v => v.porDistrito.length ? (App.filtros.tipo === 'MOVEL' ? v.moveis > 0 : v.locais > 0) : v.tipo === App.filtros.tipo);
      return vagas;
    }
    // + filtros da própria tela (prioridade e responsável); as contagens das abas e o resumo usam esta lista
    function filtradas(todas) {
      let l = todas;
      if (prioridade) l = l.filter(v => v.prioridade === prioridade);
      if (recrutador === '(sem)') l = l.filter(v => !nomesRh(v).length);
      else if (recrutador) l = l.filter(v => nomesRh(v).some(n => Store.normalizar(n) === recrutador));
      return l;
    }
    // todos os RHs da vaga (o principal e os outros responsáveis), pelo nome
    function nomesRh(v) {
      const logins = v.responsaveis && v.responsaveis.length ? v.responsaveis : [];
      const nomes = logins.map(l => { const u = Store.usuarioPorLogin(l); return u ? u.nome : (l === v.recrutadorLogin && v.recrutador ? v.recrutador : l); });
      if (!nomes.length && v.recrutador) nomes.push(v.recrutador);
      return [...new Set(nomes.filter(Boolean))];
    }
    // ---------- carga de cada RH (para dividir as vagas com justiça) ----------
    // admin e gestor veem; o RH (analista) só enxerga as vagas dele, então não faz sentido
    const verCarga = App.usuario.perfil !== 'analista';
    let cargaAberta = verCarga && guardado('maparh:vagas-carga') === '1';
    // por login: vagas em andamento, pessoas que faltam, atrasadas e candidatos parados
    function cargaPorRh(vagas) {
      const por = new Map(), sem = { vagas: 0, faltam: 0 };
      const pega = l => { let a = por.get(l); if (!a) { a = { login: l, u: Store.usuarioPorLogin(l), vagas: 0, faltam: 0, atrasadas: 0, parados: 0 }; por.set(l, a); } return a; };
      for (const v of vagas.filter(naAba.abertas)) {
        const f = v.contagemCarregada ? v.faltam : v.quantidade;
        if (!(v.responsaveis || []).length) { sem.vagas++; sem.faltam += f; continue; }
        for (const l of v.responsaveis) { const a = pega(l); a.vagas++; a.faltam += f; if (v.atrasada) a.atrasadas++; a.parados += parados(v); }
      }
      return { por, sem };
    }
    function desenharCarga(todas) {
      const box = q('#vg-carga'), btn = q('#vg-carga-btn');
      if (!box) return;
      if (btn) { btn.classList.toggle('on', cargaAberta); btn.setAttribute('aria-expanded', cargaAberta); }
      if (!cargaAberta) { box.hidden = true; box.innerHTML = ''; return; }
      const { por, sem } = cargaPorRh(todas);
      // quem é da equipe e está sem vaga também aparece (é quem pode receber a próxima)
      for (const u of Store.equipeRh()) if (!por.has(u.login)) por.set(u.login, { login: u.login, u, vagas: 0, faltam: 0, atrasadas: 0, parados: 0 });
      const l = [...por.values()].sort((a, b) => b.faltam - a.faltam || b.vagas - a.vagas || String(a.u ? a.u.nome : a.login).localeCompare(String(b.u ? b.u.nome : b.login), 'pt-BR'));
      const max = Math.max(1, ...l.map(a => a.faltam));
      box.hidden = false;
      box.innerHTML = `<div class="vgn-carga-cab"><b>Carga por RH</b><span class="muted small">vagas em andamento${App.filtros.projetoId ? ' neste projeto' : ''}; vaga com mais de um RH conta para cada um</span><button type="button" class="btn-link" data-carga-fechar>Fechar</button></div>
        <div class="vgn-carga-lista">${l.map(a => { const nome = a.u ? a.u.nome : a.login, inativo = a.u && a.u.ativo === false;
          return `<div class="vgn-carga-linha ${a.vagas ? '' : 'livre'}">
            <span class="vgn-carga-rh">${UI.avatar(a.u || { nome }, 24)}<b title="${UI.esc(nome)}">${UI.esc(nome)}</b>${inativo ? '<span class="vg-alerta">inativo</span>' : ''}</span>
            <span class="vgn-carga-num"><b>${a.vagas}</b> ${a.vagas === 1 ? 'vaga' : 'vagas'}</span>
            <span class="vgn-carga-barra" title="${UI.esc(`${nome}: faltam ${a.faltam} ${a.faltam === 1 ? 'pessoa' : 'pessoas'} nas vagas dele`)}"><i style="width:${Math.round(100 * a.faltam / max)}%"></i><em>faltam <b>${a.faltam}</b></em></span>
            <span class="vgn-carga-al">${a.atrasadas ? `<span class="vgn-tag ruim">${qtd(a.atrasadas, 'atrasada', 'atrasadas')}</span>` : ''}${a.parados ? `<span class="vgn-tag">${qtd(a.parados, 'parado', 'parados')}</span>` : ''}${!a.vagas ? '<span class="muted small">sem vaga agora</span>' : ''}</span>
            <span class="vgn-carga-acao">${a.vagas ? `<button type="button" class="btn btn-pequeno" data-carga-rh="${UI.esc(Store.normalizar(nome))}">Ver vagas</button>` : ''}</span>
          </div>`; }).join('')}
          ${sem.vagas ? `<div class="vgn-carga-linha vgn-carga-sem"><span class="vgn-carga-rh"><b>Sem RH responsável</b></span><span class="vgn-carga-num"><b>${sem.vagas}</b> ${sem.vagas === 1 ? 'vaga' : 'vagas'}</span><span class="vgn-carga-barra"><i style="width:${Math.round(100 * Math.min(sem.faltam, max) / max)}%"></i><em>faltam <b>${sem.faltam}</b></em></span><span class="vgn-carga-al"></span><span class="vgn-carga-acao"><button type="button" class="btn btn-pequeno" data-carga-rh="(sem)">Ver vagas</button></span></div>` : ''}
        </div>`;
    }
    // resumo curto da carga de um RH, para quem escolhe o responsável (aprovar / pedir vaga)
    let cargaGeral = null;
    function cargaTexto(login) {
      if (!cargaGeral) cargaGeral = cargaPorRh(Store.vagasVisiveis(App.usuario)).por;
      const a = cargaGeral.get(login);
      return a && a.vagas ? `${qtd(a.vagas, 'vaga', 'vagas')} · faltam ${a.faltam}` : 'sem vaga agora';
    }

    function ordenar(l) {
      return l.slice().sort((a, b) => fechada(a) - fechada(b) || b.atrasada - a.atrasada
        || ORDEM_PRIORIDADE[a.prioridade] - ORDEM_PRIORIDADE[b.prioridade]
        || (a.dataNecessidade || '9999').localeCompare(b.dataNecessidade || '9999')
        || (b.criadoEm || '').localeCompare(a.criadoEm || ''));
    }

    el.innerHTML = `
      <div class="card sem-padding vg-pagina">
        <div class="cad-barra vg-barra-topo">
          <label class="cad-proj">Prioridade<select id="vg-prioridade" style="min-width:150px"></select></label>
          <label class="cad-proj">Responsável (RH)<select id="vg-recrutador" style="min-width:190px"></select></label>
          <label class="cad-proj vg-busca-rot">Procurar<input class="busca nao-imprimir" id="vg-busca" placeholder="Cargo, distrito, quem pediu ou RH…"></label>
          <span class="espaco"></span>
          <div class="linha nao-imprimir">${verCarga ? `<button type="button" class="btn" id="vg-carga-btn" aria-expanded="${cargaAberta}" aria-controls="vg-carga" title="Quantas vagas e quantas pessoas a contratar cada RH tem agora">Carga por RH</button>` : ''}${podeEditar ? '<button class="btn btn-primario" id="vg-nova">+ Pedir vaga</button>' : ''}</div>
        </div>
        <div class="vg-resumo2" id="vg-resumo"></div>
        <div class="vgn-carga nao-imprimir" id="vg-carga" hidden></div>
        <div class="vgn-pend nao-imprimir" id="vg-pend" hidden></div>
        <div class="abas vg-abas" id="vg-abas"></div>
        <b id="vg-titulo" hidden></b>
        <div class="tabela-wrap" id="vg-tabela"></div>
      </div>`;
    const q = s => el.querySelector(s);

    function desenharFiltros(todas) {
      q('#vg-prioridade').innerHTML = '<option value="">Todas</option>' +
        Object.entries(Store.PRIORIDADES).map(([k, r]) => `<option value="${k}" ${k === prioridade ? 'selected' : ''}>${r}</option>`).join('');
      const cont = new Map(); let sem = 0;
      for (const v of todas) { const ns = nomesRh(v); if (!ns.length) { sem++; continue; } for (const nome of ns) { const k = Store.normalizar(nome); const a = cont.get(k) || { nome, n: 0 }; a.n++; cont.set(k, a); } }
      if (recrutador && recrutador !== '(sem)' && !cont.has(recrutador)) recrutador = '';
      if (recrutador === '(sem)' && !sem) recrutador = '';
      q('#vg-recrutador').innerHTML = '<option value="">Todos</option>' +
        [...cont.entries()].sort((a, b) => a[1].nome.localeCompare(b[1].nome, 'pt-BR')).map(([k, a]) => `<option value="${UI.esc(k)}" ${k === recrutador ? 'selected' : ''}>${UI.esc(a.nome)} (${a.n})</option>`).join('') +
        (sem ? `<option value="(sem)" ${recrutador === '(sem)' ? 'selected' : ''}>Sem RH responsável (${sem})</option>` : '');
    }

    let foco = '';   // atrasadas | semdiv | semcand | parados | vence7 | semrh: vindo dos cartões do resumo e do quadro "o que falta"
    let pendFechado = false, pendTudo = false;
    try { pendFechado = localStorage.getItem('maparh:vagas-pend-fechado') === '1'; } catch (e) { /* ok */ }
    // Quadro "o que falta fazer": só as vagas em andamento com alguma pendência, uma linha cada, com a ação na própria linha.
    // Os botões do cabeçalho filtram a lista de vagas logo abaixo.
    function desenharPendencias(base) {
      const box = q('#vg-pend');
      const abertas = ordenar(base.filter(naAba.abertas));
      const itens = abertas.map(v => ({ v, p: pendencias(v) })).filter(x => x.p.length);
      if (!itens.length) { box.hidden = true; box.innerHTML = ''; foco = ''; return; }
      const cont = t => abertas.filter(noFoco[t]).length;
      if (foco && !cont(foco)) foco = '';
      const chips = Object.keys(ROT_FOCO).map(t => [t, cont(t)]).filter(x => x[1]).map(([t, n]) =>
        `<button type="button" class="vgn-chip ${foco === t ? 'on' : ''} ${t === 'atrasadas' ? 'ruim' : ''}" data-foco="${t}" aria-pressed="${foco === t}" title="Mostrar só as vagas ${ROT_FOCO[t]}"><b>${n}</b> ${ROT_FOCO[t]}</button>`).join('');
      const eu = App.usuario.perfil === 'analista';
      const LIM = 5, mostrar = pendTudo ? itens : itens.slice(0, LIM);
      box.hidden = false;
      box.classList.toggle('fechado', pendFechado);
      box.innerHTML = `<div class="vgn-pend-cab">
          <button type="button" class="vgn-pend-tit" data-pend-toggle aria-expanded="${!pendFechado}" title="${pendFechado ? 'Abrir' : 'Recolher'}"><i>${pendFechado ? '▸' : '▾'}</i><b>${eu ? 'Minhas vagas: o que falta fazer' : 'O que falta fazer nas vagas'}</b><span class="aba-num">${itens.length}</span></button>
          <div class="vgn-chips">${chips}</div>
        </div>` + (pendFechado ? '' : `<div class="vgn-pend-lista">${mostrar.map(({ v, p }) => {
          // até duas ações: a principal (divulgar, ver candidatos, escolher RH) e "Nova data" quando a vaga está atrasada
          const validas = p.filter(x => x.acao && (x.acao !== 'divulgar' || podeMexer(v)) && (x.acao !== 'candidatos' || podeVerCandidatos));
          const acoes = [...validas.filter(x => !x.sec).slice(0, 1), ...validas.filter(x => x.sec).slice(0, 1)];
          return `<div class="vgn-pend-linha" data-id="${v.id}">
            <button type="button" class="vgn-pend-vaga" data-ir title="Ir para a vaga na lista"><b>${UI.esc(v.titulo)}</b><span>${UI.esc(ondeTexto(v) || 'sem distrito')}</span></button>
            <span class="vgn-pend-falta">${v.contagemCarregada ? `faltam <b>${v.faltam}</b> de ${v.quantidade}` : `${qtd(v.quantidade, 'pessoa', 'pessoas')}`}</span>
            <span class="vgn-pend-itens">${p.map(x => `<span class="vgn-tag ${x.cls}">${UI.esc(x.txt)}</span>`).join('')}</span>
            <span class="vgn-pend-acao">${acoes.map(a => `<button type="button" class="btn btn-pequeno ${a.acao === 'divulgar' ? 'btn-primario' : ''}" data-acao="${a.acao}" ${a.acao === 'prazo' ? 'title="Mudar a data em que a pessoa precisa estar trabalhando (fica anotado na vaga)"' : ''}>${a.rot}</button>`).join('')}</span>
          </div>`; }).join('')}${itens.length > LIM ? `<button type="button" class="btn-link vgn-pend-mais" data-pend-tudo>${pendTudo ? 'Mostrar menos' : `Mostrar as outras ${itens.length - LIM}`}</button>` : ''}</div>`);
    }
    function desenhar() {
      UI.fecharMenus();
      const todas = visiveis();
      desenharFiltros(todas);
      const base = filtradas(todas);
      const ind = Store.indicadoresVagas(base, undefined, andam);
      // resumo em cartões: os que pedem ação levam para a aba certa
      const cartao = (n, rot, sub, cls, abaAlvo, fc) => `<${abaAlvo ? `button type="button" data-aba="${abaAlvo}" data-foco="${fc || ''}"` : 'div'} class="vg-kpi ${cls || ''} ${abaAlvo ? 'vg-kpi-link' : ''} ${fc && fc === foco ? 'vg-kpi-on' : ''}"><b>${n}</b><span>${rot}</span>${sub ? `<small>${sub}</small>` : ''}</${abaAlvo ? 'button' : 'div'}>`;
      // pedido preenchido: admitidos que valem por distrito e tipo (a mesma conta do Início)
      const pedidas = base.filter(v => v.aprovada && v.status !== 'cancelada' && v.status !== 'recusada').reduce((a, v) => a + v.quantidade, 0);
      const admitidas = base.filter(v => v.aprovada && v.status !== 'cancelada' && v.status !== 'recusada').reduce((a, v) => a + Math.min(v.admitidosValidos || 0, v.quantidade), 0);
      const tp = ind.tempo;
      const diasTxt = n => n.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' d';
      q('#vg-resumo').innerHTML = !todas.length ? '' :
        // em andamento e aguardando aprovação já são as abas logo abaixo: aqui só o que não aparece nelas
        cartao(UI.fmtNum(Math.max(0, pedidas - admitidas)), Math.max(0, pedidas - admitidas) === 1 ? 'pessoa a contratar' : 'pessoas a contratar', `nas vagas aprovadas`, '') +
        cartao(UI.fmtNum(ind.atrasadas), ind.atrasadas === 1 ? 'atrasada' : 'atrasadas', 'passou da data e falta gente', ind.atrasadas ? 'vg-kpi-ruim' : '', ind.atrasadas ? 'abertas' : '', 'atrasadas') +
        cartao(UI.fmtNum(ind.semDivulgacao), 'sem divulgação', ind.semDivulgacao ? 'clique em Divulgar na vaga' : 'todas divulgadas', ind.semDivulgacao ? 'vg-kpi-alerta' : '', ind.semDivulgacao ? 'abertas' : '', 'semdiv') +
        cartao(ind.taxaPreenchimento == null ? '—' : UI.fmtPct(ind.taxaPreenchimento, 0), 'do pedido preenchido', `${UI.fmtNum(admitidas)} de ${UI.fmtNum(pedidas)} pessoas`, '') +
        // tempo de contratação: mediana da aprovação da vaga à admissão (igual ao Início), pelo andamento dos candidatos
        (!tp || tp.admissao == null ? '' : cartao(diasTxt(tp.admissao), 'da aprovação à admissão',
          `mediana de ${qtd(tp.nAdmissao, 'admissão', 'admissões')}${tp.campo != null ? ` · ${diasTxt(tp.campo)} até chegar no campo` : ''}`, ''));

      q('#vg-abas').innerHTML = ABAS.map(([id, rot]) => `<button class="aba ${aba === id ? 'ativa' : ''} ${id === 'aguardando' && podeAprovar && base.filter(naAba[id]).length ? 'vg-aba-alerta' : ''}" data-aba="${id}" ${id === 'aguardando' && podeAprovar && base.filter(naAba[id]).length ? 'title="Pedidos esperando a sua decisão"' : ''}>${rot} <span class="aba-num">${UI.fmtNum(base.filter(naAba[id]).length)}</span></button>`).join('');

      cargaGeral = null;
      desenharCarga(todas);
      desenharPendencias(base);
      let lista = base.filter(naAba[aba]);
      if (foco && noFoco[foco]) lista = lista.filter(noFoco[foco]);
      if (busca) {
        const b = Store.normalizar(busca);
        lista = lista.filter(v => Store.normalizar([v.titulo, ondeTexto(v), v.unidade, v.solicitante, v.recrutador, v.projeto ? v.projeto.nome : ''].join(' ')).includes(b));
      }
      lista = ordenar(lista);
      q('#vg-titulo').innerHTML = `Vagas <span class="aba-num">${UI.fmtNum(lista.length)}</span>`;
      if (!lista.length) { q('#vg-tabela').innerHTML = foco ? `<div class="vazio">Nenhuma vaga ${ROT_FOCO[foco] || ''} nesta aba. <button type="button" class="btn-link" data-foco-limpar>Ver todas</button></div>` : `<div class="vazio">${textoVazio(todas, base, ind)}</div>`; return; }
      q('#vg-tabela').innerHTML = (foco ? `<div class="cd-aviso vg-foco"><span>Mostrando só as vagas <b>${ROT_FOCO[foco] || ''}</b> (${lista.length}).</span><button type="button" class="btn-link" data-foco-limpar>Ver todas</button></div>` : '') + `<div class="vg-lista">${lista.map(linha).join('')}</div>`;
    }

    // estado vazio: sempre diz o que fazer em seguida
    function textoVazio(todas, base, ind) {
      const pedir = podeEditar ? ' Clique em <b>Pedir vaga</b> para abrir um pedido.' : '';
      if (!todas.length) return 'Nenhuma vaga pedida ainda.' + (podeEditar ? ' Clique em <b>Pedir vaga</b> para abrir o primeiro pedido.' : ' Quando alguém pedir uma vaga, ela aparece aqui.');
      if (busca) return 'Nenhuma vaga com esse texto nesta aba. Apague a busca ou troque de aba.';
      if (!base.length) return 'Nenhuma vaga com essa prioridade e esse responsável. Troque os filtros acima.';
      if (aba === 'aguardando') return 'Nenhum pedido aguardando aprovação.' + pedir;
      if (aba === 'abertas' && ind.aguardandoAprovacao) return `Nenhuma vaga em andamento. Há ${qtd(ind.aguardandoAprovacao, 'pedido', 'pedidos')} aguardando aprovação` + (podeAprovar ? ': abra a aba <b>Aguardando aprovação</b> para aprovar.' : ' de um administrador.');
      if (aba === 'abertas') return 'Nenhuma vaga em andamento.' + pedir;
      return 'Nenhuma vaga nesta aba. Veja a aba <b>Todas</b>.';
    }

    // Uma linha por vaga: o pedido e o andamento lado a lado (admitidos / pedido em cada distrito, local e móvel),
    // os candidatos por etapa e UMA ação principal; o resto fica no menu ⋯.
    const ROT_ETAPA = { triagem: 'Triagem', entrevista: 'Entrevista', documentos: 'Documentação' };
    const diasAte = d => Math.round((new Date(d + 'T12:00:00') - new Date(RH.hoje() + 'T12:00:00')) / 86400000);
    function linha(v) {
      const c = v.cidade;
      const pendente = v.status === 'aguardando', emAberto = v.aprovada && !fechada(v);
      const canais = v.canaisDivulgados;
      let detalhe = '';
      if (pendente) {
        const desde = (v.aprovacao && v.aprovacao.pedidoEm) || v.criadoEm, dd = desde ? Math.max(0, Math.floor((Date.now() - new Date(desde).getTime()) / 86400000)) : 0;
        const au = v.aprovacao && v.aprovacao.aumento;
        detalhe = `${podeAprovar ? 'esperando a sua decisão' : 'aguardando um administrador'}${dd ? ` · <span class="${dd >= 3 ? 'vg-alerta' : ''}">há ${qtd(dd, 'dia', 'dias')}</span>` : ''}${au ? ` · aumento de ${au.de} para ${au.para}` : ''}`;
      }
      else if (v.status === 'recusada') detalhe = `<span class="vg-motivo">Motivo: ${UI.esc((v.aprovacao && v.aprovacao.motivo) || 'não informado')}</span>`;
      else if (emAberto) {
        // onde foi divulgada: o nome de cada canal (curto), com quem e quando no passar do mouse
        const curto = n => String(n).split(' / ')[0];
        const lista = Object.entries(v.divulgacao || {}).map(([id, d]) => ({ c: Store.CANAIS.find(k => k.id === id), d: d || {} })).filter(x => x.c)
          .sort((a, b) => String(a.d.em || '').localeCompare(String(b.d.em || '')));
        detalhe = lista.length ? `<span class="vg-canais">Divulgada: ${lista.map(x => { const u = x.d.por && Store.usuarioPorLogin(x.d.por);
          return `<span class="vg-canal" title="${UI.esc(x.c.nome + (x.d.em ? ' · ' + UI.fmtData(x.d.em) : '') + (u ? ' · por ' + u.nome : x.d.por ? ' · por ' + x.d.por : ''))}">${UI.esc(curto(x.c.nome))}</span>`; }).join('')}</span>`
          : `<span class="vg-alerta">ainda não divulgada${v.diasAberta ? ` · há ${qtd(v.diasAberta, 'dia', 'dias')}` : ''}</span>`;
      }
      else if (v.aprovacao && v.aprovacao.situacao === 'aprovada' && v.aprovacao.em) detalhe = `aprovada em ${UI.fmtData(v.aprovacao.em)}`;

      // prazo: data e quanto falta
      let prazo = '<div class="vg-k-rot">Precisa até</div><div class="muted">sem data</div>';
      if (v.dataNecessidade) {
        const n = diasAte(v.dataNecessidade);
        const quando = !emAberto ? '' : v.atrasada ? `atrasada ${qtd(v.diasAtraso, 'dia', 'dias')}` : n === 0 ? 'é hoje' : n > 0 ? `faltam ${qtd(n, 'dia', 'dias')}` : '';
        prazo = `<div class="vg-k-rot">Precisa até</div><div class="vg-k-val">${fmtDia(v.dataNecessidade)}</div>${quando ? `<div class="vg-k-sub ${v.atrasada ? 'vg-atraso' : ''}">${quando}</div>` : ''}`;
      }
      // previsão: o funil (prontos + documentação, entrevista e triagem pelo aproveitamento do projeto) cobre o que falta?
      const pv = previsao(v);
      const selo = pv ? `<span class="vg-selo vg-selo-${pv.selo}" title="${UI.esc('Previsão: ' + pv.frase + '. Conta os prontos e, nas outras etapas, quantos costumam chegar à admissão neste projeto.')}">${pv.rotulo}</span>` : '';
      if (pv) prazo += `<div class="vg-k-sub vg-prev vg-prev-${pv.selo}">${UI.esc(pv.frase)}</div>`;

      // preenchimento: número grande + barra; por distrito uma linha limpa (Locais x/y · Móveis x/y)
      const conta = v.contagemCarregada && podeVerCandidatos && v.aprovada;   // antes da aprovação mostra só o pedido
      // admitidos que valem para o pedido (por distrito e tipo): o mesmo número do Início
      const admOk = v.admitidosValidos || 0, foraPedido = Math.max(0, (v.admitidos || 0) - admOk);
      const pct = v.quantidade ? Math.min(100, Math.round(100 * admOk / v.quantidade)) : 0;
      const par = (adm, ped, rot) => !ped ? '' : `<span class="vg-par ${!conta ? '' : adm >= ped ? 'ok' : ''}"><small>${rot}</small> ${conta ? `<b>${adm}</b>/` : ''}${ped}</span>`;
      const dist = v.porDistrito.length
        ? v.porDistrito.map(x => `<div class="vg-dl"><span class="vg-dl-nome" title="${UI.esc(x.distrito.nome)}">${UI.esc(x.distrito.nome)}</span>${par(x.admLoc, x.locais, 'Locais')}${par(x.admMov, x.moveis, 'Móveis')}</div>`).join('')
        : `<div class="vg-dl"><span class="vg-dl-nome">${c ? UI.esc(c.nome + '/' + c.uf) : '—'}</span><span class="vg-par"><small>${UI.rotuloTipo(v.tipo)}</small> ${v.quantidade}</span></div>`;
      const numero = conta
        ? `<div class="vg-num"><b>${admOk}</b><span>de ${v.quantidade} admitidos</span><em>${pct}%</em></div><div class="vg-barra vg-barra-g"><i style="width:${pct}%"></i></div>${foraPedido ? `<div class="vg-k-sub" title="Admitidos além do pedido do distrito/tipo ou sem distrito: não completam o pedido">+${foraPedido} fora do pedido</div>` : ''}`
        : `<div class="vg-num"><b>${v.quantidade}</b><span>${v.quantidade === 1 ? 'pessoa pedida' : 'pessoas pedidas'}</span></div>`;

      // candidatos por etapa: uma linha de texto (clique abre Candidatos na vaga)
      const etapasTxt = !v.aprovada ? '<span class="muted">Candidatos depois da aprovação</span>' : !v.contagemCarregada ? '<span class="muted">…</span>'
        : !v.emProcesso ? '<span class="muted">Ninguém em processo ainda</span>'
        : `<span class="vg-k-rot2">Em processo</span>${[['triagem', 'triagem'], ['entrevista', 'entrevista'], ['documentos', 'documentação']].filter(([e]) => v.etapas[e]).map(([e, r]) => `<${podeVerCandidatos ? `button type="button" data-acao="candidatos" data-etapa="${e}"` : 'span'} class="vg-et"><b>${v.etapas[e]}</b> na ${r}</${podeVerCandidatos ? 'button' : 'span'}>`).join('')}`;
      const np = emAberto ? parados(v) : 0;
      const paradosTxt = !np ? '' : `<${podeVerCandidatos ? 'button type="button" data-acao="candidatos"' : 'span'} class="vg-et vgn-et-parado" title="Em andamento sem nenhuma mudança há ${DIAS_PARADO} dias ou mais">${qtd(np, 'parado', 'parados')} há ${DIAS_PARADO}+ dias</${podeVerCandidatos ? 'button' : 'span'}>`;
      const semDist = conta && v.semDistrito ? `<span class="vg-alerta" title="Defina o distrito na ficha desses candidatos">${v.semDistrito === 1 ? '1 candidato sem distrito' : v.semDistrito + ' candidatos sem distrito'}</span>` : '';

      // uma ação principal + menu
      let principal = '';
      if (pendente && podeAprovar) principal = '<button class="btn btn-pequeno btn-primario" data-acao="aprovar">Aprovar</button><button class="btn btn-pequeno" data-acao="recusar">Recusar</button>';
      else if (emAberto && podeMexer(v) && !canais) principal = '<button class="btn btn-pequeno btn-primario" data-acao="divulgar">Divulgar</button>';
      else if (v.aprovada && podeVerCandidatos) principal = `<button class="btn btn-pequeno" data-acao="candidatos">Ver candidatos${v.candidatos ? ` (${v.candidatos})` : ''}</button>`;
      const menu = [];
      const it = (acao, rot, extra = '') => `<button type="button" class="${extra}" data-acao="${acao}">${rot}</button>`;
      if (emAberto && podeMexer(v) && canais) menu.push(it('divulgar', 'Divulgar'));
      if (emAberto) menu.push(it('copiar', 'Copiar anúncio (WhatsApp)'));
      if (v.aprovada || podeMexer(v)) menu.push(it('obs', `Observações${(v.anotacoes || []).length ? ` (${v.anotacoes.length})` : ''}`));
      if (v.aprovada && podeVerCandidatos && !principal.includes('candidatos')) menu.push(it('candidatos', 'Ver candidatos'));
      if (emAberto) menu.push(it('procurar', 'Procurar candidatos na internet'));
      menu.push(it('mapa', 'Ver no mapa'));
      menu.push(it('historico', 'Histórico da vaga'));
      if (podeEditar) menu.push(it('editar', 'Editar o pedido'));
      if (podeEditar && !fechada(v)) menu.push(it('prazo', v.dataNecessidade ? 'Mudar a data (precisa até)' : 'Definir a data (precisa até)'));
      if (podeEditar) menu.push(it('duplicar', 'Duplicar (pedir outra igual)'));
      if (podeEditar && !fechada(v)) menu.push(it('cancelar', 'Cancelar a vaga', 'perigo'));
      if (podeEditar && fechada(v)) menu.push(it('reabrir', v.aprovada ? 'Reabrir' : 'Pedir de novo'));
      if (ehAdmin) menu.push(it('excluir', 'Excluir', 'perigo'));

      const prio = v.prioridade && v.prioridade !== 'normal' ? `<span class="badge ${CLASSE_PRIORIDADE[v.prioridade]}">${Store.PRIORIDADES[v.prioridade]}</span>` : '';
      return `<article data-id="${v.id}" class="vg-card ${fechada(v) ? 'vg-fechada' : ''} ${v.atrasada ? 'vg-atrasada' : ''} ${pendente ? 'vg-pendente' : ''}">
        <div class="vg-card-cab">
          <div class="vg-card-tit"><h3>${UI.esc(v.titulo)}</h3>${prio}${selo}<span class="badge ${CLASSE_STATUS[v.status] || 'badge-cinza'}">${UI.esc(Store.STATUS_VAGA[v.status] || v.status)}</span></div>
          <div class="vg-card-sub"><span class="vg-onde">${UI.esc(ondeTexto(v) || 'sem distrito')}</span><span>${UI.esc(v.projeto ? v.projeto.nome : '—')}</span>${v.solicitante ? `<span>pedida por ${UI.esc(v.solicitante)}</span>` : ''}</div>
          ${(() => { const o = (v.anotacoes || [])[(v.anotacoes || []).length - 1]; if (!o) return ''; const u = Store.usuarioPorLogin(o.por);
            return `<button type="button" class="vg-obs" data-acao="obs" title="Ver todas as observações">${UI.avatar(u || { nome: o.nome || o.por || '?' }, 18)}<span class="vg-obs-txt">${UI.esc(o.texto)}</span><span class="vg-obs-quem">${UI.esc(String(o.nome || o.por || '').split(' ')[0])} · ${UI.fmtData(o.em)}${v.anotacoes.length > 1 ? ` · +${v.anotacoes.length - 1}` : ''}</span></button>`; })()}
        </div>
        <div class="vg-card-corpo">
          <div class="vg-bloco vg-bloco-prog">${numero}<div class="vg-dls">${dist}</div></div>
          <div class="vg-bloco vg-bloco-prazo">${prazo}</div>
          <div class="vg-bloco vg-bloco-rh"><div class="vg-k-rot">${(v.responsaveis || []).length > 1 ? 'RHs responsáveis' : 'RH responsável'}</div>
            <div class="vg-rh">${(v.responsaveis || []).length ? `<span class="vg-rh-fotos">${v.responsaveis.map(l => { const u = Store.usuarioPorLogin(l); return `<span title="${UI.esc(u ? u.nome : l)}">${UI.avatar(u || { nome: l }, 26)}</span>`; }).join('')}</span><span class="vg-rh-nome">${UI.esc(v.responsaveis.map(l => { const u = Store.usuarioPorLogin(l); return (u ? u.nome : l).split(' ')[0]; }).join(', '))}</span>${v.responsaveis.some(l => (Store.usuarioPorLogin(l) || {}).ativo === false) ? ' <span class="vg-alerta">RH inativo: troque</span>' : ''}` : '<span class="vg-alerta">sem RH responsável</span>'}</div>
            ${detalhe ? `<div class="vg-k-sub">${detalhe}</div>` : ''}</div>
        </div>
        <div class="vg-card-pe">
          <div class="vg-etapas">${etapasTxt}${paradosTxt}${semDist}</div>
          <div class="vg-acoes nao-imprimir">${principal}${menu.length ? `<div class="vg-mais"><button type="button" class="vg-mais-btn" data-menu aria-label="Mais ações" title="Mais ações">⋯</button><div class="vg-menu" hidden>${menu.join('')}</div></div>` : ''}</div>
        </div>
      </article>`;
    }

    // ---------- ações da tabela ----------
    q('#vg-tabela').addEventListener('click', e => {
      const aberto = q('#vg-tabela').querySelector('.vg-menu:not([hidden])');
      if (e.target.closest('[data-foco-limpar]')) { foco = ''; return desenhar(); }
      const mb = e.target.closest('[data-menu]');
      if (mb) { const mn = mb.nextElementSibling; if (mn.hidden) UI.abrirMenu(mb, mn); else mn.hidden = true; return; }
      if (aberto) aberto.hidden = true;
      const b = e.target.closest('[data-acao]'); if (!b) return;
      const v = Store.vagasVisiveis(App.usuario).find(x => x.id === b.closest('[data-id]').dataset.id);
      if (!v) return;
      fazer(v, b.dataset.acao, b);
    });
    async function copiarTexto(txt, msg) {
      try { await navigator.clipboard.writeText(txt); }
      catch (e) { const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } finally { ta.remove(); } }
      UI.toast(msg, 'sucesso');
    }
    function fazer(v, acao, b) {
      if (acao === 'aprovar') aprovar(v);
      else if (acao === 'copiar') copiarTexto(anuncio(v, 'whatsapp'), 'Anúncio copiado. Cole no WhatsApp ou no grupo.');
      else if (acao === 'recusar') recusar(v);
      else if (acao === 'divulgar') modalDivulgar(v);
      else if (acao === 'candidatos') { try { if (b && b.dataset.etapa) sessionStorage.setItem('maparh:cand-seg', b.dataset.etapa); } catch (err) { /* ok */ } localStorage.setItem('maparh:cand-vaga', v.id); localStorage.setItem('maparh:cand-projeto', v.projetoId); App.ir('candidatos'); }
      else if (acao === 'procurar') { if (v.cidade) UI.modalBuscaCandidatos(v.cidade.nome, v.cidade.uf, v.titulo); }
      else if (acao === 'editar') formVaga(v);
      else if (acao === 'duplicar') formVaga(null, v);
      else if (acao === 'prazo') mudarPrazo(v);
      else if (acao === 'historico') historico(v);
      else if (acao === 'obs') observacoes(v);
      else if (acao === 'mapa') { App.filtros.projetoId = v.projetoId; sessionStorage.setItem('maparh:mapa-foco', JSON.stringify({ cidadeId: v.cidadeId })); App.aoMudarFiltros(); App.ir('mapa'); }
      else if (acao === 'cancelar') mudarStatus(v, 'cancelada');
      else if (acao === 'reabrir') mudarStatus(v, v.aprovada ? 'aberta' : 'aguardando');
      else if (acao === 'excluir') excluir(v);
    }
    // quadro "o que falta": filtros, recolher e a ação da linha
    q('#vg-pend').addEventListener('click', e => {
      const f = e.target.closest('[data-foco]');
      if (f) { foco = foco === f.dataset.foco ? '' : f.dataset.foco; if (foco) { aba = 'abertas'; try { localStorage.setItem('maparh:vagas-status', aba); } catch (err) { /* ok */ } } return desenhar(); }
      if (e.target.closest('[data-pend-toggle]')) { pendFechado = !pendFechado; try { localStorage.setItem('maparh:vagas-pend-fechado', pendFechado ? '1' : '0'); } catch (err) { /* ok */ } return desenhar(); }
      if (e.target.closest('[data-pend-tudo]')) { pendTudo = !pendTudo; return desenhar(); }
      const ln = e.target.closest('[data-id]'); if (!ln) return;
      const v = Store.vagasVisiveis(App.usuario).find(x => x.id === ln.dataset.id); if (!v) return;
      const b = e.target.closest('[data-acao]');
      if (b) return fazer(v, b.dataset.acao, b);
      if (e.target.closest('[data-ir]')) {
        // leva até o cartão da vaga (tira o filtro que a esconderia) e pisca
        let card = q(`#vg-tabela [data-id="${v.id}"]`);
        if (!card) { foco = ''; busca = ''; q('#vg-busca').value = ''; aba = 'abertas'; desenhar(); card = q(`#vg-tabela [data-id="${v.id}"]`); }
        if (card) { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); card.classList.remove('vgn-pisca'); void card.offsetWidth; card.classList.add('vgn-pisca'); }
      }
    });
    q('#vg-resumo').addEventListener('click', e => { const b = e.target.closest('[data-aba]'); if (!b) return; aba = b.dataset.aba; foco = foco === b.dataset.foco ? '' : (b.dataset.foco || ''); try { localStorage.setItem('maparh:vagas-status', aba); } catch (err) { /* ok */ } desenhar(); });
    q('#vg-abas').addEventListener('click', e => {
      const b = e.target.closest('[data-aba]'); if (!b) return; foco = '';
      aba = b.dataset.aba; localStorage.setItem('maparh:vagas-status', aba); desenhar();
    });
    q('#vg-prioridade').addEventListener('change', e => { prioridade = e.target.value; try { sessionStorage.setItem('maparh:vagas-prioridade', prioridade); } catch (err) { /* sem armazenamento: o filtro vale só nesta visita */ } desenhar(); });
    q('#vg-recrutador').addEventListener('change', e => { recrutador = e.target.value; try { sessionStorage.setItem('maparh:vagas-recrutador', recrutador); } catch (err) { /* idem */ } desenhar(); });
    q('#vg-busca').addEventListener('input', UI.debounce(e => { busca = e.target.value.trim(); desenhar(); }, 200));
    if (podeEditar) q('#vg-nova').addEventListener('click', () => formVaga(null));
    const lembrarCarga = () => { try { sessionStorage.setItem('maparh:vagas-carga', cargaAberta ? '1' : '0'); } catch (err) { /* ok */ } };
    if (q('#vg-carga-btn')) q('#vg-carga-btn').addEventListener('click', () => { cargaAberta = !cargaAberta; lembrarCarga(); desenhar(); });
    q('#vg-carga').addEventListener('click', e => {
      if (e.target.closest('[data-carga-fechar]')) { cargaAberta = false; lembrarCarga(); return desenhar(); }
      const b = e.target.closest('[data-carga-rh]'); if (!b) return;
      // filtra a lista pelo RH escolhido, na aba Em andamento
      recrutador = b.dataset.cargaRh; foco = ''; aba = 'abertas';
      try { sessionStorage.setItem('maparh:vagas-recrutador', recrutador); localStorage.setItem('maparh:vagas-status', aba); } catch (err) { /* ok */ }
      desenhar();
      const t = q('#vg-abas'); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // escolha de vários RHs: clica para marcar/desmarcar; o primeiro marcado é o principal
    function seletorRhs(sel) {
      const equipe = Store.equipeRh();
      // cada RH mostra quanto já tem nas mãos, para dividir as vagas com justiça
      cargaGeral = null;
      return `<div class="vg-rhs" data-rhs>${equipe.map(u => `<button type="button" class="vg-rh-op ${sel.includes(u.login) ? 'on' : ''}" data-rh="${UI.esc(u.login)}" title="${UI.esc(u.nome + ': ' + cargaTexto(u.login) + ' (vagas em andamento)')}">${UI.avatar(u, 22)}<span class="vgn-rh-op-txt"><span>${UI.esc(u.nome)}</span><small class="vgn-rh-carga">${UI.esc(cargaTexto(u.login))}</small></span><i class="vg-rh-principal">${sel[0] === u.login ? 'principal' : ''}</i></button>`).join('')}</div>`;
    }
    function ligarSeletorRhs(box, sel, aoMudar) {
      box.addEventListener('click', e => {
        const b = e.target.closest('[data-rh]'); if (!b) return;
        const l = b.dataset.rh, i = sel.indexOf(l);
        if (i >= 0) sel.splice(i, 1); else sel.push(l);
        box.querySelectorAll('[data-rh]').forEach(x => { x.classList.toggle('on', sel.includes(x.dataset.rh)); x.querySelector('.vg-rh-principal').textContent = sel[0] === x.dataset.rh ? 'principal' : ''; });
        if (aoMudar) aoMudar();
      });
    }
    async function passarCandidatos(v, de, para) {
      let l; try { l = (await Nuvem.rh.listar(v.projetoId)).filter(p => p.vaga_id === v.id && p.situacao === 'em_andamento' && p.analista_login === de); } catch (e) { return; }
      if (!l.length) return;
      const uDe = Store.usuarioPorLogin(de), uPara = Store.usuarioPorLogin(para);
      if (!await UI.confirmar(`${l.length === 1 ? '1 candidato em andamento desta vaga está' : l.length + ' candidatos em andamento desta vaga estão'} com ${uDe ? uDe.nome : de}. Passar para ${uPara ? uPara.nome : para}, o novo responsável?`, { titulo: 'Candidatos da vaga', textoOk: 'Passar' })) return;
      try { await Nuvem.rh.atualizarVarios(l.map(p => p.id), { analista_login: para, analista: uPara ? uPara.nome : para }); UI.toast(`${l.length} candidato(s) passados para ${uPara ? uPara.nome : para}.`, 'sucesso'); }
      catch (e) { UI.toast(e.message, 'erro', 7000); }
    }
    function aprovar(v) {
      const selAp = (v.responsaveis || []).slice();
      const onde = ondeTexto(v) ? ` em ${ondeTexto(v)}` : '';
      const au = v.aprovacao && v.aprovacao.aumento;
      const mAp = UI.modal({ titulo: 'Aprovar vaga', largura: '520px',
        corpo: `<p style="margin-top:0">Aprovar <b>${UI.esc(v.titulo)}</b>${UI.esc(onde)}, com ${qtd(v.quantidade, 'pessoa', 'pessoas')}?${au ? ` <span class="vg-alerta">Aumento pedido: de ${au.de} para ${au.para}.</span>` : ''} Ela fica aberta para divulgação e candidatos.</p>
          <span class="vg-rot">RHs responsáveis pelo recrutamento <span class="muted" style="font-weight:400">(pode marcar mais de um)</span></span>${seletorRhs(selAp)}
          <p class="muted small" style="margin-bottom:0">Todos os marcados veem esta vaga e todos os candidatos dela; no cartão aparece a foto de quem mexeu por último.</p>`,
        botoes: [{ texto: 'Cancelar' }, { texto: 'Aprovar', classe: 'btn-primario', acao: md => {
          const rh = selAp.slice();
          if (!rh.length) throw new Error('Escolha pelo menos um RH responsável: sem ele nenhum RH enxerga a vaga.');
          Store.aprovarVaga(v.id, App.usuario, rh); UI.toast('Vaga aprovada. Já pode ser divulgada.', 'sucesso'); App.recarregar();
        } }] });
      ligarSeletorRhs(mAp.corpo.querySelector('[data-rhs]'), selAp);
    }
    function recusar(v) {
      UI.modal({ titulo: `Recusar: ${v.titulo}`, largura: '480px',
        corpo: `<p class="muted small" style="margin-top:0">A vaga fecha como <b>Recusada</b> e quem pediu vê o motivo na lista. Depois dá para pedir de novo.</p>
          <label>Motivo da recusa<textarea id="vg-motivo" rows="3" placeholder="Ex.: sem orçamento neste mês; reposição já coberta por remanejamento"></textarea></label>`,
        botoes: [{ texto: 'Voltar' }, { texto: 'Recusar vaga', classe: 'btn-perigo', acao: md => {
          Store.recusarVaga(v.id, md.corpo.querySelector('#vg-motivo').value, App.usuario);
          UI.toast('Vaga recusada.', 'sucesso'); App.recarregar();
        } }] });
    }
    const emProcessoNa = v => v.etapas ? (v.etapas.triagem || 0) + (v.etapas.entrevista || 0) + (v.etapas.documentos || 0) : 0;
    async function mudarStatus(v, status) {
      const np = emProcessoNa(v);
      if (status === 'cancelada' && !await UI.confirmar(v.status === 'aguardando' ? `Cancelar o pedido da vaga "${v.titulo}"? Ele sai da fila de aprovação.`
        : `Cancelar a vaga "${v.titulo}"?${np ? ` Ela tem ${np === 1 ? '1 candidato' : np + ' candidatos'} em andamento: eles não poderão ser admitidos por esta vaga. Depois, em Candidatos, mude a vaga deles ou marque "Não segue no processo".` : ''}`, { textoOk: 'Cancelar vaga', perigo: true })) return;
      try {
        Store.mudarStatusVaga(v.id, status, App.usuario);
        UI.toast(status === 'aguardando' ? 'Pedido reenviado. Aguardando aprovação de um administrador.' : status === 'cancelada' ? 'Vaga cancelada.' : 'Vaga reaberta.', 'sucesso');
        App.recarregar();
      } catch (e) { UI.toast(e.message, 'erro'); }
    }
    async function excluir(v) {
      // vaga com candidatos não é excluída (eles ficariam presos a uma vaga que não existe e não poderiam ser admitidos)
      if (!v.contagemCarregada) { UI.toast('Aguarde carregar a contagem de candidatos da vaga.', 'aviso'); return; }
      const total = emProcessoNa(v) + (v.admitidos || 0);
      if (total) { UI.alerta ? UI.alerta(`A vaga "${v.titulo}" tem ${total === 1 ? '1 candidato' : total + ' candidatos'}. Para tirar ela da lista, use "Cancelar vaga". Excluir só é possível em vaga sem nenhum candidato.`) : UI.toast(`A vaga tem ${total} candidato(s): use "Cancelar vaga" em vez de excluir.`, 'aviso', 7000); return; }
      if (!await UI.confirmar(`Excluir a vaga "${v.titulo}"? Ela não tem candidatos.`, { textoOk: 'Excluir', perigo: true })) return;
      Store.excluirVaga(v.id, App.usuario); UI.toast('Vaga excluída.', 'sucesso'); App.recarregar();
    }

    // ---------- formulário (pedir vaga / editar) ----------
    // copia: vaga usada como ponto de partida de um pedido novo (Duplicar / Começar de uma vaga anterior)
    function formVaga(v, copia) {
      const projetos = App.projetosVisiveis().filter(p => p.ativo || (v && v.projetoId === p.id));
      if (!projetos.length) { UI.toast('Crie primeiro um projeto (estado/ano) em Cadastros → Projetos.', 'aviso'); return; }
      const projetoIni = v ? v.projetoId : projetos.some(p => p.id === App.filtros.projetoId) ? App.filtros.projetoId
        : copia && projetos.some(p => p.id === copia.projetoId) ? copia.projetoId : projetos[0].id;
      // vagas que servem de ponto de partida: as mais recentes de qualquer projeto que a pessoa enxerga
      const anteriores = v ? [] : Store.vagasVisiveis(App.usuario).filter(x => x.titulo).sort((a, b) => String(b.criadoEm || '').localeCompare(String(a.criadoEm || ''))).slice(0, 80);
      const val = x => UI.esc(x == null ? '' : x);
      const nomes = Store.usuarios().filter(u => u.ativo !== false).map(u => u.nome).filter(Boolean);
      // o pedido completo (quem pede e para quando) é cobrado ao pedir e enquanto a vaga não foi aprovada; vaga antiga pode ficar sem
      const cobrarPedido = !v || !v.aprovada;
      const statusEditaveis = ['aberta', 'divulgada', 'selecao', 'preenchida', 'cancelada'];
      // responsável pelo recrutamento: tem que ser um usuário (é pelo login que o RH enxerga só as vagas dele)
      const equipe = Store.equipeRh();
      const recIni = v ? (v.recrutadorLogin || '') : '';
      const selRh = v ? (v.responsaveis || []).slice() : [];
      // distritos do pedido: [{ distritoId, locais, moveis }]. Vaga antiga (por cidade) começa com o distrito daquela cidade.
      let linhasDist = v && v.porDistrito.length ? v.porDistrito.map(x => ({ distritoId: x.distrito.id, locais: x.locais, moveis: x.moveis })) : [];
      if (v && !linhasDist.length) { const reg = Store.distritoDaCidade(v.cidadeId); if (reg) linhasDist = [{ distritoId: reg.distrito.id, locais: v.tipo === 'MOVEL' ? 0 : v.quantidade, moveis: v.tipo === 'MOVEL' ? v.quantidade : 0 }]; }
      const temAnuncio = v && (v.descricao || v.requisitos || v.salario || v.jornada || v.beneficios);
      const rotAnterior = x => `${x.titulo} · ${ondeTexto(x) || 'sem distrito'} · ${x.projeto ? Store.rotuloProjeto(x.projeto) : '—'} · ${Store.STATUS_VAGA[x.status] || x.status}${x.criadoEm ? ' · ' + UI.fmtData(x.criadoEm) : ''}`;
      const corpo = `
        ${anteriores.length ? `<div class="vgn-copiar"><label>Começar de uma vaga anterior <span class="muted" style="font-weight:400">(copia cargo, distritos, RHs e anúncio; a data fica em branco)</span><select id="v-copiar"><option value="">Não, começar do zero</option>${anteriores.map(x => `<option value="${x.id}" ${copia && copia.id === x.id ? 'selected' : ''}>${UI.esc(rotAnterior(x))}</option>`).join('')}</select></label></div>` : ''}
        <div class="pre-form-titulo">O pedido</div>
        <div class="form-linha">
          <label style="grid-column:1/-1">Cargo<input id="v-titulo" placeholder="Ex.: Operador de secador, Auxiliar de armazém" value="${val(v && v.titulo)}"></label>
          <div class="vgn-modelo" id="v-modelo" hidden></div>
          <label>Projeto (estado · ano)<select id="v-projeto">${projetos.map(p => `<option value="${p.id}" ${p.id === projetoIni ? 'selected' : ''}>${UI.esc(Store.rotuloProjeto(p))}</option>`).join('')}</select></label>
          <label>Quem está pedindo<input id="v-solicitante" value="${val(v ? v.solicitante : App.usuario.nome)}"></label>
          <div><span class="vg-rot">Prioridade</span><div class="vg-prio" id="v-prioridade">${Object.entries(Store.PRIORIDADES).map(([k, r]) => `<label class="vg-prio-${k}"><input type="radio" name="v-prio" value="${k}" ${(v ? v.prioridade : 'normal') === k ? 'checked' : ''}><span>${r}</span></label>`).join('')}</div></div>
          <label>Precisa estar trabalhando até<input id="v-necessidade" type="date" value="${val(v && v.dataNecessidade)}"><span class="muted small" id="v-necessidade-dica"></span></label>
          <div style="grid-column:1/-1"><span class="vg-rot">RHs responsáveis pelo recrutamento <span class="muted" style="font-weight:400">(pode marcar mais de um; o primeiro é o principal)</span></span>${equipe.length ? seletorRhs(selRh) : ''}
            <span class="muted small">${equipe.length ? 'Todos os marcados veem esta vaga e todos os candidatos dela, e cada cartão mostra a foto de quem mexeu por último.' : 'Nenhum usuário com acesso aos candidatos ainda. Cadastre o RH em Sistema → Usuários e acesso.'}</span></div>
        </div>
        <div class="pre-form-titulo">Onde e quantas pessoas</div>
        <div class="vg-dist-add"><select id="v-dist-novo"></select></div>
        <div id="v-dist-lista"></div>
        <details class="vg-anuncio" id="v-anuncio-box" ${temAnuncio ? 'open' : ''}>
          <summary>Dados para o anúncio (opcional)</summary>
          <div class="form-linha">
            <label style="grid-column:1/-1">Atividades<textarea id="v-descricao" rows="3" placeholder="O que a pessoa vai fazer">${val(v && v.descricao)}</textarea></label>
            <label style="grid-column:1/-1">Requisitos<textarea id="v-requisitos" rows="2" placeholder="Escolaridade, experiência, CNH, disponibilidade…">${val(v && v.requisitos)}</textarea></label>
            <label>Salário<input id="v-salario" placeholder="Ex.: R$ 2.400 + horas extras" value="${val(v && v.salario)}"></label>
            <label>Jornada<input id="v-jornada" placeholder="Ex.: 44h semanais, escala 6x1" value="${val(v && v.jornada)}"></label>
            <label style="grid-column:1/-1">Benefícios<input id="v-beneficios" placeholder="Ex.: vale-alimentação, transporte, plano de saúde" value="${val(v && v.beneficios)}"></label>
            <label style="grid-column:1/-1">Como se candidatar<input id="v-contato" placeholder="Link do formulário ou WhatsApp do RH (sai no fim do anúncio)" value="${val(v && v.contato)}"></label>
          </div>
        </details>
        ${v && v.aprovada && statusEditaveis.includes(v.status) ? `<div class="form-linha" style="margin-top:14px"><label>Situação<select id="v-status">${statusEditaveis.map(k => `<option value="${k}" ${v.status === k ? 'selected' : ''}>${Store.STATUS_VAGA[k]}</option>`).join('')}</select></label></div>` : ''}
        ${!v && podeAprovar ? '<label class="check vg-ja-aprovada"><input type="checkbox" id="v-aprovada"> Já aprovada: abrir a vaga agora, sem passar pela fila de aprovação</label>'
          : !v ? '<p class="muted small vg-aviso-form">O pedido fica aguardando aprovação de um administrador. Só depois de aprovada a vaga pode ser divulgada e receber candidatos.</p>'
          : v.status === 'aguardando' ? `<p class="muted small vg-aviso-form">Este pedido ainda está aguardando aprovação${podeAprovar ? '. Para decidir, use Aprovar ou Recusar na lista.' : ' de um administrador.'}</p>`
          : v.status === 'recusada' ? `<p class="muted small vg-aviso-form">Pedido recusado${v.aprovacao && v.aprovacao.motivo ? ': ' + UI.esc(v.aprovacao.motivo) : ''}. Ajuste o que for preciso, salve e use <b>Pedir de novo</b> na lista.</p>` : ''}`;
      const m = UI.modal({
        titulo: v ? 'Editar vaga' : 'Pedir vaga', largura: '760px', corpo, fecharAoClicarFora: false,
        botoes: [{ texto: 'Cancelar' }, { texto: v ? 'Salvar' : 'Enviar pedido', classe: 'btn-primario', acao: (md) => {
          const g = s => md.corpo.querySelector(s);
          if (!g('#v-titulo').value.trim()) throw new Error('Informe o cargo da vaga.');
          if (cobrarPedido) {
            if (!g('#v-solicitante').value.trim()) throw new Error('Informe quem está pedindo a vaga.');
            if (!g('#v-necessidade').value) throw new Error('Informe até quando a pessoa precisa estar trabalhando.');
          }
          lerLinhas();
          const jaAprovada = !!(g('#v-aprovada') && g('#v-aprovada').checked);
          Store.salvarVaga({ id: v ? v.id : null, titulo: g('#v-titulo').value, projetoId: g('#v-projeto').value, distritos: linhasDist, unidade: v ? v.unidade : '',
            descricao: g('#v-descricao').value, requisitos: g('#v-requisitos').value, salario: g('#v-salario').value, jornada: g('#v-jornada').value,
            beneficios: g('#v-beneficios').value, contato: g('#v-contato').value, prazo: v ? v.prazo : null, status: g('#v-status') ? g('#v-status').value : undefined,
            solicitante: g('#v-solicitante').value, prioridade: (md.corpo.querySelector('input[name="v-prio"]:checked') || {}).value || 'normal', dataNecessidade: g('#v-necessidade').value,
            recrutadores: selRh.slice(), jaAprovada }, App.usuario);
          if (!v) { aba = jaAprovada ? 'abertas' : 'aguardando'; localStorage.setItem('maparh:vagas-status', aba); }
          const rhNovo = selRh[0] || '';
          if (v && v.recrutadorLogin && rhNovo && rhNovo !== v.recrutadorLogin && typeof Nuvem !== 'undefined' && Nuvem.ativa && Store.pode(App.usuario, 'candidatos')) setTimeout(() => passarCandidatos(v, v.recrutadorLogin, rhNovo), 0);
          UI.toast(v ? 'Vaga salva.' : jaAprovada ? 'Vaga criada e aprovada. Agora clique em Divulgar.' : podeAprovar ? 'Pedido criado. Aprove na lista para liberar a vaga.' : 'Pedido enviado. Aguardando aprovação de um administrador.', 'sucesso', 5000);
          App.recarregar();
        } }]
      });
      const g = s => m.corpo.querySelector(s);
      if (g('[data-rhs]')) ligarSeletorRhs(g('[data-rhs]'), selRh);
      const ufAtual = () => Store.ufsProjeto(Store.projeto(g('#v-projeto').value));
      // distritos que cabem no projeto escolhido (pelo estado) e ainda não estão no pedido
      const disponiveis = () => Store.distritos().filter(d => (!d.uf || ufAtual().includes(d.uf)) && !linhasDist.some(x => x.distritoId === d.id)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));
      function lerLinhas() {
        m.corpo.querySelectorAll('#v-dist-lista [data-dist]').forEach(l => {
          const x = linhasDist.find(y => y.distritoId === l.dataset.dist); if (!x) return;
          x.locais = Math.max(0, parseInt(l.querySelector('[data-q="locais"]').value, 10) || 0); x.moveis = Math.max(0, parseInt(l.querySelector('[data-q="moveis"]').value, 10) || 0);
        });
      }
      function total() {
        lerLinhas();
        const loc = linhasDist.reduce((n, x) => n + x.locais, 0), mov = linhasDist.reduce((n, x) => n + x.moveis, 0), el = g('#v-dist-total');
        if (el) el.innerHTML = `Total do pedido: <b>${qtd(loc + mov, 'pessoa', 'pessoas')}</b> <span class="muted">(${qtd(loc, 'local', 'locais')} · ${qtd(mov, 'móvel', 'móveis')})</span>`;
      }
      function desenharDist() {
        const livres = disponiveis();
        g('#v-dist-novo').innerHTML = `<option value="">${Store.distritos().length ? (livres.length ? '+ Acrescentar distrito…' : 'Todos os distritos deste projeto já estão no pedido') : 'Nenhum distrito cadastrado'}</option>` + livres.map(d => `<option value="${d.id}">${UI.esc(d.nome)}${d.uf ? ' · ' + d.uf : ''}</option>`).join('');
        g('#v-dist-novo').disabled = !livres.length;
        g('#v-dist-lista').innerHTML = !linhasDist.length
          ? `<div class="vg-dist-vazio">${Store.distritos().length ? 'Escolha acima em quais distritos a vaga é. Para cada um, diga quantas pessoas são <b>locais</b> (moram na região) e quantas são <b>móveis</b> (vêm de fora).' : 'Ainda não há distritos. Cadastre em <a href="#/distritos">Cadastros → Distritos e micros</a>.'}</div>`
          : `<div class="vg-dist-grade vg-dist-cab"><span>Distrito</span><span>Locais</span><span>Móveis</span><span></span></div>` + linhasDist.map(x => { const d = Store.distrito(x.distritoId); return `<div class="vg-dist-grade vg-dist-linha" data-dist="${x.distritoId}">
              <div><b>${UI.esc(d ? d.nome : '—')}</b><span class="muted small">${d ? Store.cidadesDoDistrito(d).length + ' cidades' + (d.uf ? ' · ' + d.uf : '') : ''}</span></div>
              <input type="number" min="0" data-q="locais" value="${x.locais}" aria-label="Pessoas locais em ${UI.esc(d ? d.nome : '')}">
              <input type="number" min="0" data-q="moveis" value="${x.moveis}" aria-label="Pessoas móveis em ${UI.esc(d ? d.nome : '')}">
              <button type="button" class="btn-link perigo" data-dist-tirar title="Tirar este distrito do pedido">Tirar</button></div>`; }).join('') + '<div class="vg-dist-total" id="v-dist-total"></div>';
        total();
      }
      g('#v-dist-novo').addEventListener('change', e => { if (!e.target.value) return; lerLinhas(); linhasDist.push({ distritoId: e.target.value, locais: 1, moveis: 0 }); desenharDist(); const inp = m.corpo.querySelector(`[data-dist="${e.target.value}"] input`); if (inp) inp.select(); });
      g('#v-dist-lista').addEventListener('input', total);
      g('#v-dist-lista').addEventListener('click', e => { const b = e.target.closest('[data-dist-tirar]'); if (!b) return; lerLinhas(); linhasDist = linhasDist.filter(x => x.distritoId !== b.closest('[data-dist]').dataset.dist); desenharDist(); });
      g('#v-projeto').addEventListener('change', desenharDist);
      UI.sugestoes(g('#v-titulo'), () => Store.cargos().map(c => ({ valor: c.nome, sub: c.documentos.length + ' documentos' })), { vazio: 'Nenhum cargo cadastrado. Digite o nome ou cadastre em Cadastros → Cargos e documentos.' });
      UI.sugestoes(g('#v-solicitante'), () => nomes);
      const dicaData = () => { const d = g('#v-necessidade').value; if (!d) { g('#v-necessidade-dica').textContent = ''; return; } const n = diasAte(d); g('#v-necessidade-dica').textContent = n < 0 ? `já passou (${-n} dia${n === -1 ? '' : 's'})` : n === 0 ? 'é hoje' : `daqui a ${n} dia${n === 1 ? '' : 's'}`; };
      g('#v-necessidade').addEventListener('input', dicaData); dicaData();

      // ----- modelo do anúncio do cargo (Cadastros → Cargos): usar no pedido ou guardar o texto deste pedido como modelo -----
      const valores = () => Object.fromEntries(CAMPOS_MODELO.map(([k]) => [k, g('#v-' + k).value.trim()]));
      function atualizarModelo() {
        const box = g('#v-modelo'), nome = g('#v-titulo').value.trim(), cg = nome ? Store.cargoPorNome(nome) : null;
        const mod = modeloDoCargo(cg), atual = valores();
        const vazios = mod ? CAMPOS_MODELO.filter(([k]) => !atual[k] && mod[k]) : [];
        const temAtual = Object.values(atual).some(Boolean);
        const igual = mod && CAMPOS_MODELO.every(([k]) => atual[k] === (mod[k] || ''));
        let html = '';
        if (mod && vazios.length) html = `<span>O cargo <b>${UI.esc(cg.nome)}</b> tem anúncio pronto (${vazios.map(x => x[1]).join(', ')}).</span><button type="button" class="btn btn-pequeno btn-primario" data-modelo-usar>Usar o modelo do cargo</button>`;
        else if (cg && temAtual && !igual) html = `<span class="muted">${mod ? `O anúncio está diferente do modelo do cargo <b>${UI.esc(cg.nome)}</b>.` : `O cargo <b>${UI.esc(cg.nome)}</b> ainda não tem anúncio pronto.`}</span><button type="button" class="btn-link" data-modelo-guardar>${mod ? 'Trocar o modelo do cargo por este texto' : 'Guardar este anúncio como modelo do cargo'}</button>`;
        else if (!cg && nome && Store.cargos().length) html = `<span class="muted">Cargo sem cadastro: a Documentação cobra a lista padrão de documentos. Para ter documentos e anúncio próprios, cadastre em Cadastros → Cargos e documentos.</span>`;
        box.hidden = !html; box.innerHTML = html;
      }
      g('#v-modelo').addEventListener('click', async e => {
        const cg = Store.cargoPorNome(g('#v-titulo').value.trim()); if (!cg) return;
        if (e.target.closest('[data-modelo-usar]')) {
          const mod = modeloDoCargo(cg) || {}; let n = 0;
          for (const [k] of CAMPOS_MODELO) { const el = g('#v-' + k); if (!el.value.trim() && mod[k]) { el.value = mod[k]; n++; } }
          g('#v-anuncio-box').open = true;
          UI.toast(`${n === 1 ? '1 campo do anúncio preenchido' : n + ' campos do anúncio preenchidos'} com o modelo do cargo. Confira antes de enviar.`, 'sucesso', 4000);
          return atualizarModelo();
        }
        if (e.target.closest('[data-modelo-guardar]')) {
          if (modeloDoCargo(cg) && !await UI.confirmar(`Trocar o anúncio pronto do cargo "${cg.nome}" pelo texto deste pedido? As próximas vagas desse cargo vão usar o texto novo.`, { titulo: 'Modelo do cargo', textoOk: 'Trocar' })) return;
          try { guardarModeloCargo(cg, valores()); UI.toast(`Anúncio guardado como modelo do cargo ${cg.nome}.`, 'sucesso'); } catch (err) { UI.toast(err.message, 'erro'); }
          atualizarModelo();
        }
      });
      ['input', 'change', 'blur'].forEach(ev => g('#v-titulo').addEventListener(ev, atualizarModelo));
      CAMPOS_MODELO.forEach(([k]) => g('#v-' + k).addEventListener('input', UI.debounce(atualizarModelo, 250)));

      // ----- começar de uma vaga anterior (ou Duplicar): copia cargo, distritos, RHs, prioridade e anúncio -----
      function aplicarCopia(x) {
        const raw = Store.vaga(x.id) || x;
        g('#v-titulo').value = raw.titulo || '';
        for (const k of ['descricao', 'requisitos', 'salario', 'jornada', 'beneficios', 'contato']) g('#v-' + k).value = raw[k] || '';
        const pr = m.corpo.querySelector(`input[name="v-prio"][value="${raw.prioridade || 'normal'}"]`); if (pr) pr.checked = true;
        const ufs = ufAtual();
        let dist = (Array.isArray(raw.distritos) ? raw.distritos : []).map(d => ({ distritoId: d.distritoId, locais: +d.locais || 0, moveis: +d.moveis || 0 }));
        if (!dist.length && raw.cidadeId) { const reg = Store.distritoDaCidade(raw.cidadeId); if (reg) dist = [{ distritoId: reg.distrito.id, locais: raw.tipo === 'MOVEL' ? 0 : raw.quantidade, moveis: raw.tipo === 'MOVEL' ? raw.quantidade : 0 }]; }
        const cabe = dist.filter(d => { const dd = Store.distrito(d.distritoId); return dd && (!dd.uf || ufs.includes(dd.uf)); });
        linhasDist = cabe;
        // RHs: só quem ainda está na equipe
        const equipeLogins = new Set(equipe.map(u => u.login));
        selRh.splice(0, selRh.length, ...(x.responsaveis || []).filter(l => equipeLogins.has(l)));
        const box = g('[data-rhs]');
        if (box) box.querySelectorAll('[data-rh]').forEach(b => { b.classList.toggle('on', selRh.includes(b.dataset.rh)); b.querySelector('.vg-rh-principal').textContent = selRh[0] === b.dataset.rh ? 'principal' : ''; });
        g('#v-necessidade').value = ''; dicaData();
        g('#v-anuncio-box').open = !!(raw.descricao || raw.requisitos || raw.salario || raw.jornada || raw.beneficios || raw.contato);
        desenharDist(); atualizarModelo();
        const fora = dist.length - cabe.length;
        UI.toast(`Dados de "${raw.titulo}" copiados${fora ? `; ${fora === 1 ? '1 distrito ficou' : fora + ' distritos ficaram'} de fora (outro estado)` : ''}. Informe a data e confira as quantidades.`, 'info', 5000);
        setTimeout(() => g('#v-necessidade').focus(), 30);
      }
      const selCopia = g('#v-copiar');
      if (selCopia) selCopia.addEventListener('change', async () => {
        const x = anteriores.find(a => a.id === selCopia.value); if (!x) return;
        const preenchido = g('#v-titulo').value.trim() || linhasDist.length || Object.values(valores()).some(Boolean);
        if (preenchido && !await UI.confirmar(`Trocar o que já foi preenchido pelos dados de "${x.titulo}"?`, { titulo: 'Começar de uma vaga anterior', textoOk: 'Trocar' })) { selCopia.value = ''; return; }
        aplicarCopia(x);
      });
      desenharDist();
      if (copia) aplicarCopia(copia);
      else atualizarModelo();
      if (!copia) setTimeout(() => g('#v-titulo').focus(), 60);
    }
    // modelo de anúncio guardado no cadastro do cargo ({ descricao, requisitos, salario, jornada, beneficios })
    const CAMPOS_MODELO = [['descricao', 'atividades'], ['requisitos', 'requisitos'], ['salario', 'salário'], ['jornada', 'jornada'], ['beneficios', 'benefícios']];
    function modeloDoCargo(cg) {
      const a = cg && cg.anuncio; if (!a) return null;
      const o = Object.fromEntries(CAMPOS_MODELO.map(([k]) => [k, String(a[k] || '').trim()]));
      return Object.values(o).some(Boolean) ? o : null;
    }
    function guardarModeloCargo(cg, anuncio) {
      const c = Store.salvarCargo({ id: cg.id, nome: cg.nome, documentos: cg.documentos }, App.usuario);
      c.anuncio = Object.fromEntries(CAMPOS_MODELO.map(([k]) => [k, String(anuncio[k] || '').trim()]));
      c.atualizadoEm = Store.agora();
      Store.salvar();
    }

    // ---------- mudar a data em que a pessoa precisa estar trabalhando (fica anotado na vaga) ----------
    function objDaVaga(v, mudar) {
      const r = Store.vaga(v.id); if (!r) throw new Error('Vaga não encontrada.');
      return { id: r.id, titulo: r.titulo, projetoId: r.projetoId, distritos: Array.isArray(r.distritos) && r.distritos.length ? r.distritos : undefined,
        cidadeId: r.cidadeId, tipo: r.tipo, quantidade: r.quantidade, unidade: r.unidade, descricao: r.descricao, requisitos: r.requisitos, salario: r.salario,
        jornada: r.jornada, beneficios: r.beneficios, contato: r.contato, prazo: r.prazo, ...mudar };
    }
    function mudarPrazo(v) {
      const antes = v.dataNecessidade || '';
      const sug = (() => { const d = new Date(RH.hoje() + 'T12:00:00'); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); })();
      const pd = UI.modal({ titulo: `${antes ? 'Mudar a data' : 'Definir a data'}: ${v.titulo}`, largura: '460px',
        corpo: `<p class="muted small" style="margin-top:0">${antes ? `Hoje a vaga precisa de gente até <b>${fmtDia(antes)}</b>${v.atrasada ? ` (atrasada ${qtd(v.diasAtraso, 'dia', 'dias')})` : ''}.` : 'A vaga ainda não tem data.'} A mudança fica registrada nas observações da vaga.</p>
          <label>Nova data<input type="date" id="vp-data" value="${UI.esc(antes && diasAte(antes) >= 0 ? antes : sug)}"><span class="muted small" id="vp-dica"></span></label>
          <label style="margin-top:10px">Motivo <span class="muted" style="font-weight:400">(opcional)</span><input id="vp-motivo" placeholder="Ex.: colheita atrasou por causa da chuva; gestor pediu mais uma semana"></label>`,
        botoes: [{ texto: 'Cancelar' }, { texto: 'Salvar data', classe: 'btn-primario', acao: md => {
          const nova = md.corpo.querySelector('#vp-data').value, motivo = md.corpo.querySelector('#vp-motivo').value.trim();
          if (!nova) throw new Error('Escolha a nova data.');
          if (nova === antes) throw new Error('A data é a mesma de antes.');
          Store.salvarVaga(objDaVaga(v, { dataNecessidade: nova }), App.usuario);
          const txt = `Data "precisa até" ${antes ? `mudou de ${fmtDia(antes)} para ${fmtDia(nova)}` : `definida para ${fmtDia(nova)}`}${motivo ? '. Motivo: ' + motivo : ''}.`;
          if (App.nuvem() && Nuvem.rh.anotarVaga && podeMexer(v)) Nuvem.rh.anotarVaga(v.id, txt).catch(e => UI.toast('A data foi salva, mas a anotação não: ' + e.message, 'aviso', 6000));
          UI.toast('Data salva.', 'sucesso'); App.recarregar();
        } }] });
      const inp = pd.corpo.querySelector('#vp-data');
      const dica = () => { const d = inp.value; const n = d ? diasAte(d) : null; pd.corpo.querySelector('#vp-dica').textContent = n == null ? '' : n < 0 ? `já passou (${qtd(-n, 'dia', 'dias')})` : n === 0 ? 'é hoje' : `daqui a ${qtd(n, 'dia', 'dias')}`; };
      inp.addEventListener('input', dica); dica();
      setTimeout(() => inp.focus(), 50);
    }

    // ---------- histórico da vaga: tudo o que já aconteceu, do pedido até hoje ----------
    function historico(v) {
      const r = Store.vaga(v.id) || v, ev = [];
      const nomeDe = l => { const u = l && Store.usuarioPorLogin(l); return u ? u.nome : (l || ''); };
      const add = (em, por, txt, cls) => { if (em) ev.push({ em, por, txt, cls: cls || '' }); };
      add(r.criadoEm, r.criadoPor, `Pedido criado${r.solicitante ? ` (pedido por ${r.solicitante})` : ''}`, 'criar');
      const ap = r.aprovacao || {};
      if (ap.pedidoEm && ap.aumento) add(ap.pedidoEm, null, `Aumento pedido de ${ap.aumento.de} para ${ap.aumento.para} pessoas: voltou para aprovação`, 'alerta');
      if (ap.situacao === 'aprovada' && ap.em) add(ap.em, ap.por, 'Vaga aprovada', 'ok');
      if (ap.situacao === 'recusada' && ap.em) add(ap.em, ap.por, `Pedido recusado${ap.motivo ? ': ' + ap.motivo : ''}`, 'ruim');
      for (const [id, d] of Object.entries(r.divulgacao || {})) { const c = Store.CANAIS.find(k => k.id === id); if (d && d.em) add(d.em, d.por, `Divulgada em ${c ? c.nome : id}`, 'div'); }
      for (const a of r.anotacoes || []) ev.push({ em: a.em, por: a.por, nome: a.nome, txt: a.texto, cls: 'obs' });
      // registros do sistema (edições e mudanças de situação): só quando o cargo não se repete em outra vaga, para não misturar
      const mesmoNome = Store.vagas().filter(x => Store.normalizar(x.titulo) === Store.normalizar(r.titulo)).length;
      if (mesmoNome === 1) {
        const pre = Store.normalizar('Vaga ' + r.titulo);
        for (const a of Store.auditoria()) {
          if (!/^vaga\.(editar|status)$/.test(a.acao) || !Store.normalizar(a.detalhes).startsWith(pre)) continue;
          if (r.criadoEm && a.quando < r.criadoEm) continue;
          const mq = /de (\d+) para (\d+)/.exec(a.detalhes);
          const txt = a.acao === 'vaga.status' ? 'Situação: ' + String(a.detalhes).split(': ').slice(1).join(': ')
            : 'Pedido editado' + (mq ? ` (de ${mq[1]} para ${mq[2]} pessoas${/voltou para aprova/.test(a.detalhes) ? ', voltou para aprovação' : ''})` : '');
          add(a.quando, a.usuario !== '—' ? a.usuario : null, txt, a.acao === 'vaga.status' ? 'status' : 'editar');
        }
      } else if (r.atualizadoEm && r.atualizadoEm !== r.criadoEm) add(r.atualizadoEm, null, 'Última alteração do pedido', 'editar');
      ev.sort((a, b) => String(b.em).localeCompare(String(a.em)));
      const cab = [`<b>${UI.esc(Store.STATUS_VAGA[v.status] || v.status)}</b>`, v.diasAberta != null ? `aberta há ${qtd(v.diasAberta, 'dia', 'dias')}` : '',
        v.dataNecessidade ? `precisa até ${fmtDia(v.dataNecessidade)}${v.atrasada ? ` (atrasada ${qtd(v.diasAtraso, 'dia', 'dias')})` : ''}` : 'sem data',
        v.contagemCarregada && v.aprovada ? `${v.admitidosValidos || 0} de ${v.quantidade} admitidos` : qtd(v.quantidade, 'pessoa pedida', 'pessoas pedidas')].filter(Boolean).join(' · ');
      UI.modal({ titulo: `Histórico: ${v.titulo}${ondeTexto(v) ? ' — ' + ondeTexto(v) : ''}`, largura: '620px',
        corpo: `<div class="vgn-hist-cab">${cab}</div>${ev.length ? `<ol class="vgn-hist">${ev.map(x => { const nome = x.nome || nomeDe(x.por);
          return `<li class="vgn-hist-${x.cls}"><span class="vgn-hist-quando">${UI.fmtDataHora(x.em)}</span><div><div class="vgn-hist-txt">${UI.esc(x.txt)}</div>${nome ? `<div class="muted small">${UI.esc(nome)}</div>` : ''}</div></li>`; }).join('')}</ol>` : '<div class="muted small">Nada registrado ainda.</div>'}
          <p class="muted small" style="margin-bottom:0">O andamento de cada candidato fica no histórico da ficha dele, em Candidatos.</p>`,
        botoes: [{ texto: 'Fechar' }] });
    }

    // ---------- anúncio pronto, um formato para cada lugar ----------
    const FORMATOS = [['whatsapp', 'WhatsApp'], ['facebook', 'Facebook / grupos'], ['sine', 'SINE'], ['radio', 'Rádio'], ['completo', 'Completo']];
    // o que ainda não foi preenchido no pedido e faz falta no anúncio
    const faltaNoAnuncio = v => [['descricao', 'atividades'], ['requisitos', 'requisitos'], ['salario', 'salário'], ['jornada', 'jornada'], ['beneficios', 'benefícios'], ['contato', 'como se candidatar']].filter(([k]) => !String(v[k] || '').trim()).map(x => x[1]);
    function anuncio(v, formato) {
      if (formato === 'completo') {
        return Store.textoAnuncio(v);
      }
      const t = k => String(v[k] || '').trim();
      const umaLinha = s => s.replace(/\s*\n+\s*/g, '; ').replace(/;\s*;/g, ';');
      const c = v.cidade;
      const eLista = l => l.length > 1 ? l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1] : (l[0] || '');
      const onde = v.porDistrito && v.porDistrito.length ? 'região de ' + eLista(v.porDistrito.map(x => x.distrito.nome)) : (c ? c.nome + '/' + c.uf : '');
      const movel = v.porDistrito && v.porDistrito.length ? v.moveis > 0 : v.tipo === 'MOVEL';
      const n = v.quantidade || 1, vagasTxt = n === 1 ? '1 vaga' : n + ' vagas';
      const contato = t('contato') || 'fale com o RH';
      const prazo = v.prazo ? fmtDia(v.prazo) : '';
      const L = [];
      if (formato === 'whatsapp') {
        L.push('*ESTAMOS CONTRATANDO*', `*${v.titulo}* (${vagasTxt})`);
        if (onde) L.push(`Onde: ${onde}${movel ? ' (há posições com deslocamento)' : ''}`);
        if (t('descricao')) L.push('', '*O que vai fazer:* ' + umaLinha(t('descricao')));
        if (t('requisitos')) L.push('*Requisitos:* ' + umaLinha(t('requisitos')));
        const cond = [t('salario') && 'Salário: ' + t('salario'), t('jornada') && 'Jornada: ' + t('jornada'), t('beneficios') && 'Benefícios: ' + t('beneficios')].filter(Boolean);
        if (cond.length) L.push('', ...cond);
        if (prazo) L.push(`Inscrições até ${prazo}`);
        L.push('', `*Como se candidatar:* ${contato}`, '', 'Conhece alguém? Encaminhe esta mensagem.');
      } else if (formato === 'facebook') {
        L.push(`VAGA DE EMPREGO${onde ? ' — ' + onde.toUpperCase() : ''}`, '', `Estamos contratando: ${v.titulo} (${vagasTxt}).${movel ? ' Há posições com deslocamento.' : ''}`);
        if (t('descricao')) L.push('', 'Atividades:', t('descricao'));
        if (t('requisitos')) L.push('', 'Requisitos:', t('requisitos'));
        const cond = [t('salario') && 'Salário: ' + t('salario'), t('jornada') && 'Jornada: ' + t('jornada'), t('beneficios') && 'Benefícios: ' + t('beneficios')].filter(Boolean);
        if (cond.length) L.push('', ...cond);
        if (prazo) L.push('', `Inscrições até ${prazo}.`);
        L.push('', `Interessados: ${contato}`, '', 'Marque ou compartilhe com quem está procurando trabalho.');
      } else if (formato === 'sine') {
        L.push(`Ocupação: ${v.titulo}`, `Quantidade de vagas: ${n}`, `Local de trabalho: ${onde || '—'}${movel ? ' (com deslocamento / atuação móvel)' : ''}`);
        L.push(`Atividades: ${t('descricao') ? umaLinha(t('descricao')) : '—'}`, `Requisitos: ${t('requisitos') ? umaLinha(t('requisitos')) : '—'}`);
        L.push(`Jornada: ${t('jornada') || '—'}`, `Salário: ${t('salario') || '—'}`, `Benefícios: ${t('beneficios') || '—'}`);
        if (prazo) L.push(`Receber candidatos até: ${prazo}`);
        L.push(`Contato do empregador: ${contato}`);
      } else {   // rádio: frases curtas para ler em voz alta, cerca de 30 segundos
        L.push(`Atenção, ${onde ? 'moradores de ' + onde.replace(/^região de /, '') + ' e região' : 'ouvintes'}: oportunidade de emprego.`);
        L.push(`${n === 1 ? 'Há uma vaga' : 'São ' + vagasTxt} para ${v.titulo}.${movel ? ' Algumas com deslocamento.' : ''}`);
        if (t('requisitos')) L.push(`Requisitos: ${umaLinha(t('requisitos'))}.`);
        if (t('beneficios')) L.push(`Benefícios: ${t('beneficios')}.`);
        L.push(t('contato') ? `Os interessados devem procurar: ${contato}.` : 'Os interessados devem procurar o RH da empresa.', `Repetindo: vaga para ${v.titulo}.${t('contato') ? ' ' + contato + '.' : ''}`);
      }
      return L.join('\n');
    }

    // ---------- divulgação ----------
    async function modalDivulgar(v) {
      if (!v.aprovada || v.status === 'aguardando' || v.status === 'recusada') { UI.toast('Esta vaga ainda não foi aprovada: não pode ser divulgada.', 'aviso'); return; }
      if (v.cidade && Store.BASES_SINE.includes(v.cidade.uf)) await Store.carregarBaseSine(v.cidade.uf);
      let formato = 'whatsapp'; try { const f = localStorage.getItem('maparh:vagas-formato'); if (FORMATOS.some(x => x[0] === f)) formato = f; } catch (e) { /* ok */ }
      const texto = anuncio(v, formato);
      const c = v.cidade;
      // Estado sem base embutida e cidade sem agência: procura na internet aqui mesmo (antes mandava abrir o mapa)
      if (c && !Store.BASES_SINE.includes(c.uf) && !Store.sineDaCidade(c).length && !Store.buscaSineRecente(c.id)) {
        UI.toast(`Procurando a agência do SINE de ${c.nome} na internet…`, 'info', 4000);
        try { await Geo.buscarSineOnline(c); } catch (e) { console.warn('Busca do SINE falhou', e); }
      }
      const sines = c ? Store.sineDaCidade(c) : [];
      const prox = !sines.length && c ? Store.sineMaisProximo(c) : null;
      const info = c ? Store.infoCidade(c.id) : null;
      const enc = encodeURIComponent;
      const nomeCidade = c ? `${c.nome} ${c.uf}` : '';
      const grupos = [...new Set(Store.CANAIS.map(k => k.grupo))];
      const botoesCanal = k => {
        const abrir = (url, rot) => `<a class="btn btn-pequeno" href="${url}" target="_blank" rel="noopener">${rot}</a>`;
        // data-txt: o endereço é refeito no clique com o texto que está na caixa (já editado)
        const comTexto = (base, rot) => `<a class="btn btn-pequeno" href="${base + enc(texto)}" data-txt="${base}" target="_blank" rel="noopener">${rot}</a>`;
        if (k.id === 'whatsapp') return comTexto('https://wa.me/?text=', 'Abrir WhatsApp com o texto');
        if (k.id === 'linkedin') return comTexto('https://www.linkedin.com/feed/?shareActive=true&text=', 'Publicar no feed') + abrir(k.url, 'Anunciar vaga');
        if (k.id === 'facebook') return `<button type="button" class="btn btn-pequeno" data-copiar-abrir="${k.url}">Copiar texto e abrir o Facebook</button>`;
        if (k.id === 'radio') return abrir('https://www.google.com/search?q=' + enc('rádio ' + nomeCidade + ' telefone'), 'Achar a rádio no Google');
        if (k.id === 'prefeitura') return abrir('https://www.google.com/search?q=' + enc('prefeitura ' + nomeCidade + ' assistência social telefone'), 'Achar a prefeitura no Google');
        if (k.id === 'sine') {
          const a = sines[0] || (prox && prox.agencia);
          let extra = '';
          if (a) {
            const tel = (info && info.sineTelefone) || (a.telefones || []).join(' / ');
            extra = `<div class="small muted" style="margin-top:4px">Agência ${UI.esc(a.nome)}${prox ? ` (a ${UI.fmtKm(prox.distancia)}, a mais próxima)` : ''}${tel ? ' · ' + UI.esc(tel) : ''}${a.email ? ` · <a href="mailto:${UI.esc(a.email)}?subject=${enc('Vaga: ' + v.titulo)}&body=${enc(texto)}">enviar por e-mail</a>` : ''}</div>`;
          }
          const portal = c ? Store.portalSine(c.uf) : null;
          if (!a && c) extra = `<div class="small muted" style="margin-top:4px">Não achei agência do SINE para ${UI.esc(c.nome)} nem na base nem na internet. Use o portal do estado ao lado ou anote o contato na ficha da cidade (botão Mapa).</div>`;
          return abrir(k.url, 'Abrir Emprega Brasil') + (portal ? abrir(portal.url, portal.nome) : '') + extra;
        }
        if (k.id === 'cartaz') return `<button class="btn btn-pequeno" data-imprimir>Imprimir cartaz</button>`;
        return k.url ? abrir(k.url, 'Abrir ' + k.nome) : '';
      };
      const corpo = `
        <div class="divulgar">
          <div>
            <div class="vgn-formatos" id="d-formatos" role="tablist" aria-label="Formato do anúncio">${FORMATOS.map(([id, rot]) => `<button type="button" role="tab" class="${id === formato ? 'on' : ''}" aria-selected="${id === formato}" data-formato="${id}">${rot}</button>`).join('')}</div>
            <label>Texto do anúncio (edite à vontade antes de copiar)<textarea id="d-texto" rows="13">${UI.esc(texto)}</textarea></label>
            <div class="vgn-conta muted small" id="d-conta"></div>
            <div class="linha"><button class="btn btn-primario" id="d-copiar">Copiar texto</button>
              <a class="btn" href="https://wa.me/?text=${enc(texto)}" data-txt="https://wa.me/?text=" target="_blank" rel="noopener">Abrir WhatsApp</a>
              <a class="btn" href="mailto:?subject=${enc('Vaga: ' + v.titulo)}&body=${enc(texto)}" data-txt="mailto:?subject=${enc('Vaga: ' + v.titulo)}&body=">E-mail</a>
              <button class="btn" data-imprimir>Imprimir cartaz</button></div>
            ${faltaNoAnuncio(v).length ? `<div class="vgn-falta-anuncio"><span>O anúncio está sem: <b>${faltaNoAnuncio(v).join(', ')}</b>.</span>${podeEditar ? '<button type="button" class="btn-link" id="d-completar">Completar no pedido</button>' : '<span class="muted">Peça ao gestor para completar o pedido.</span>'}</div>` : ''}
            ${info && (info.canais || info.contatos) ? `<div class="caixa caixa-aviso"><b>Anotações do RH sobre ${UI.esc(c.nome)}:</b><br>${UI.esc([info.canais, info.contatos].filter(Boolean).join(' · '))}</div>` : ''}
          </div>
          <div>
            <div class="vgn-prog" id="d-prog"></div>
            <p class="muted small" style="margin-bottom:8px">Marque onde já divulgou. A vaga passa para <b>Em divulgação</b> na primeira marcação.</p>
            ${grupos.map(g => `<div class="etiqueta-grupo">${UI.esc(g)}</div>` + Store.CANAIS.filter(k => k.grupo === g).map(k => {
              const feito = v.divulgacao && v.divulgacao[k.id];
              return `<div class="canal ${feito ? 'feito' : ''}" data-canal="${k.id}">
                <label class="check"><input type="checkbox" ${feito ? 'checked' : ''}> <b>${UI.esc(k.nome)}</b>${feito ? `<span class="muted small"> · ${UI.fmtData(feito.em)}</span>` : ''}</label>
                <div class="small muted">${UI.esc(k.dica)}</div>
                <div class="linha" style="margin-top:6px;gap:6px">${botoesCanal(k)}</div>
              </div>`;
            }).join('')).join('')}
          </div>
        </div>`;
      const m = UI.modal({ titulo: `Divulgar: ${v.titulo}${ondeTexto(v) ? ' — ' + ondeTexto(v) : ''}`, largura: '960px', corpo, botoes: [{ texto: 'Fechar' }], aoFechar: () => App.recarregar() });
      const ta = m.corpo.querySelector('#d-texto');
      m.corpo.querySelector('#d-copiar').addEventListener('click', () => copiarTexto(ta.value, 'Texto copiado. Cole na plataforma.'));
      // formato do anúncio: troca o texto (se já foi editado, pergunta antes de refazer)
      let gerado = texto;
      const conta = () => { const n = ta.value.length; m.corpo.querySelector('#d-conta').textContent = `${UI.fmtNum(n)} caracteres${formato === 'radio' ? ` · cerca de ${Math.max(5, Math.round(ta.value.trim().split(/\s+/).length / 2.5 / 5) * 5)} segundos de locução` : ''}`; };
      ta.addEventListener('input', conta); conta();
      m.corpo.querySelector('#d-formatos').addEventListener('click', async e => {
        const b = e.target.closest('[data-formato]'); if (!b || b.dataset.formato === formato) return;
        if (ta.value !== gerado && !await UI.confirmar('Você editou o texto. Trocar de formato refaz o texto e apaga o que foi editado.', { titulo: 'Trocar o formato', textoOk: 'Trocar' })) return;
        formato = b.dataset.formato; try { localStorage.setItem('maparh:vagas-formato', formato); } catch (err) { /* ok */ }
        gerado = ta.value = anuncio(v, formato); conta();
        m.corpo.querySelectorAll('#d-formatos [data-formato]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); });
      });
      // links que levam o texto (WhatsApp, e-mail, LinkedIn): sempre o que está na caixa agora
      m.corpo.addEventListener('click', e => {
        const a = e.target.closest('a[data-txt]'); if (a) { a.href = a.dataset.txt + enc(ta.value); return; }
        const ca = e.target.closest('[data-copiar-abrir]'); if (ca) { copiarTexto(ta.value, 'Texto copiado. Cole na publicação.'); window.open(ca.dataset.copiarAbrir, '_blank', 'noopener'); }
      });
      const bc = m.corpo.querySelector('#d-completar'); if (bc) bc.addEventListener('click', () => { m.fechar ? m.fechar() : null; formVaga(v); });
      // quanto já foi divulgado
      const prog = () => { const tot = Store.CANAIS.length, n = m.corpo.querySelectorAll('.canal.feito').length;
        m.corpo.querySelector('#d-prog').innerHTML = `<div class="vgn-prog-txt"><b>${n ? `Divulgada em ${n} de ${tot} lugares` : 'Ainda não divulgada'}</b><span class="muted small">${n ? '' : 'comece pelo WhatsApp e pelo SINE'}</span></div><div class="vg-barra"><i style="width:${Math.round(100 * n / tot)}%"></i></div>`; };
      prog();
      m.corpo.querySelectorAll('[data-imprimir]').forEach(b => b.addEventListener('click', () => imprimirCartaz(v, ta.value)));
      m.corpo.querySelectorAll('.canal input[type="checkbox"]').forEach(ch => ch.addEventListener('change', () => {
        const canal = ch.closest('.canal');
        if (App.nuvem() && Nuvem.rh.divulgarVaga) {
          ch.disabled = true;
          Nuvem.rh.divulgarVaga(v.id, canal.dataset.canal, ch.checked).then(() => { canal.classList.toggle('feito', ch.checked); prog(); })
            .catch(e => { UI.toast(e.message, 'erro'); ch.checked = !ch.checked; }).finally(() => { ch.disabled = false; });
          return;
        }
        try { Store.marcarDivulgacao(v.id, canal.dataset.canal, ch.checked, App.usuario); canal.classList.toggle('feito', ch.checked); prog(); }
        catch (e) { UI.toast(e.message, 'erro'); ch.checked = !ch.checked; }
      }));
    }
    // observações da vaga: histórico com quem escreveu e quando; o RH responsável, o gestor e o admin escrevem
    function observacoes(v) {
      const pode = podeMexer(v) && App.nuvem() && Nuvem.rh.anotarVaga;
      const lista = () => { const atual = Store.vagasVisiveis(App.usuario).find(x => x.id === v.id) || v; const l = (atual.anotacoes || []).slice().reverse();
        return l.length ? l.map(a => { const u = Store.usuarioPorLogin(a.por); return `<div class="fi-nota">${UI.avatar(u || { nome: a.nome || a.por || '?' }, 28)}<div><div class="fi-nota-cab"><b>${UI.esc(a.nome || a.por || '—')}</b> <span class="muted">${UI.fmtDataHora(a.em)}</span></div><div class="fi-nota-txt">${UI.esc(a.texto)}</div></div></div>`; }).join('')
          : '<div class="muted small">Nenhuma observação ainda.</div>'; };
      const m = UI.modal({ titulo: `Observações: ${v.titulo}${ondeTexto(v) ? ' — ' + ondeTexto(v) : ''}`, largura: '620px',
        corpo: `${pode ? '<div class="fi-anotar" style="margin-bottom:12px"><textarea id="vo-txt" rows="2" placeholder="Ex.: a rádio de Sarandi só divulga na segunda; o gestor pediu prioridade para quem tem CNH"></textarea><button type="button" class="btn btn-primario" id="vo-add">Anotar</button></div>' : ''}<div id="vo-lista" class="fi-hist">${lista()}</div>`,
        botoes: [{ texto: 'Fechar' }] });
      const add = m.corpo.querySelector('#vo-add');
      if (add) add.addEventListener('click', async () => {
        const ta = m.corpo.querySelector('#vo-txt'), tx = ta.value.trim(); if (!tx) { ta.focus(); return; }
        add.disabled = true;
        try { await Nuvem.rh.anotarVaga(v.id, tx); ta.value = ''; m.corpo.querySelector('#vo-lista').innerHTML = lista(); UI.toast('Observação registrada.', 'sucesso', 2000); }
        catch (e) { UI.toast(e.message, 'erro', 6000); } finally { add.disabled = false; }
      });
    }
    function imprimirCartaz(v, texto) {
      const w = window.open('', '_blank');
      if (!w) { UI.toast('O navegador bloqueou a janela de impressão.', 'erro'); return; }
      w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${UI.esc(v.titulo)}</title>
        <style>body{font-family:Arial,sans-serif;margin:40px;color:#111}h1{font-size:40px;margin:0 0 6px;text-transform:uppercase}h2{font-size:22px;color:#1d4ed8;margin:0 0 24px}pre{white-space:pre-wrap;font:20px/1.5 Arial,sans-serif}</style></head>
        <body><h1>Estamos contratando</h1><h2>${UI.esc(v.titulo)} — ${UI.esc(v.cidade ? v.cidade.nome + '/' + v.cidade.uf : '')}</h2><pre>${UI.esc(texto)}</pre><script>window.print()<\/script></body></html>`);
      w.document.close();
    }


    const contar = () => {
      if (typeof Nuvem === 'undefined' || !Nuvem.ativa) return;
      Nuvem.rh.contagemVagas().then(m => { Store.definirContagemVagas(m); if (ativo) desenhar(); }).catch(() => {});
      if (Nuvem.rh.andamento) Nuvem.rh.andamento(App.filtros.projetoId).then(l => { andam = l || []; taxasPorProjeto = new Map(); contarParados(); if (ativo) desenhar(); }).catch(() => {});
    };
    desenhar(); contar();
    // mudou algo (aqui ou em outro computador): redesenha a lista e recontam os candidatos, sem apagar a tela
    // aviso de vaga/cadastro (semCandidatos): só redesenha; aviso de candidato: conta de novo (busca no banco) e redesenha
    App.aoAtualizar(info => { if (!ativo) return; if (!document.querySelector('.modal-overlay')) desenhar(); if (!(info && info.semCandidatos)) contar(); });
    return () => { ativo = false; };
  }
};
