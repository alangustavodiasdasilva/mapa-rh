// Vagas: pedido de vaga com aprovação. Quem precisa de gente pede a vaga: cargo, projeto, para quando, em quais distritos
// e quantas pessoas locais e móveis em cada um, e quem do RH vai cuidar dela (esse RH só enxerga as vagas dele).
// Um administrador aprova ou recusa; só a vaga aprovada pode ser divulgada e receber candidatos.
// Daqui também saem o texto do anúncio e os atalhos para as plataformas de divulgação.
Paginas.vagas = {
  titulo: 'Vagas',
  filtrosUsados: ['projeto', 'regiao', 'tipo'],
  render(el) {
    const podeEditar = App.podeEditar();
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
      if (recrutador === '(sem)') l = l.filter(v => !v.recrutador);
      else if (recrutador) l = l.filter(v => Store.normalizar(v.recrutador) === recrutador);
      return l;
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
          <div class="linha nao-imprimir">${podeEditar ? '<button class="btn btn-primario" id="vg-nova">+ Pedir vaga</button>' : ''}</div>
        </div>
        <div class="vg-resumo2" id="vg-resumo"></div>
        <div class="abas vg-abas" id="vg-abas"></div>
        <b id="vg-titulo" hidden></b>
        <div class="tabela-wrap" id="vg-tabela"></div>
      </div>`;
    const q = s => el.querySelector(s);

    function desenharFiltros(todas) {
      q('#vg-prioridade').innerHTML = '<option value="">Todas</option>' +
        Object.entries(Store.PRIORIDADES).map(([k, r]) => `<option value="${k}" ${k === prioridade ? 'selected' : ''}>${r}</option>`).join('');
      const cont = new Map(); let sem = 0;
      for (const v of todas) { if (!v.recrutador) { sem++; continue; } const k = Store.normalizar(v.recrutador); const a = cont.get(k) || { nome: v.recrutador, n: 0 }; a.n++; cont.set(k, a); }
      if (recrutador && recrutador !== '(sem)' && !cont.has(recrutador)) recrutador = '';
      if (recrutador === '(sem)' && !sem) recrutador = '';
      q('#vg-recrutador').innerHTML = '<option value="">Todos</option>' +
        [...cont.entries()].sort((a, b) => a[1].nome.localeCompare(b[1].nome, 'pt-BR')).map(([k, a]) => `<option value="${UI.esc(k)}" ${k === recrutador ? 'selected' : ''}>${UI.esc(a.nome)} (${a.n})</option>`).join('') +
        (sem ? `<option value="(sem)" ${recrutador === '(sem)' ? 'selected' : ''}>Sem RH responsável (${sem})</option>` : '');
    }

    let foco = '';   // atrasadas | semdiv: vindo dos cartões do resumo
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

      let lista = base.filter(naAba[aba]);
      if (foco === 'atrasadas') lista = lista.filter(v => v.atrasada);
      if (foco === 'semdiv') lista = lista.filter(v => v.aprovada && !fechada(v) && !v.canaisDivulgados);
      if (busca) {
        const b = Store.normalizar(busca);
        lista = lista.filter(v => Store.normalizar([v.titulo, ondeTexto(v), v.unidade, v.solicitante, v.recrutador, v.projeto ? v.projeto.nome : ''].join(' ')).includes(b));
      }
      lista = ordenar(lista);
      q('#vg-titulo').innerHTML = `Vagas <span class="aba-num">${UI.fmtNum(lista.length)}</span>`;
      if (!lista.length) { q('#vg-tabela').innerHTML = `<div class="vazio">${textoVazio(todas, base, ind)}</div>`; return; }
      q('#vg-tabela').innerHTML = (foco ? `<div class="cd-aviso vg-foco"><span>Mostrando só as vagas <b>${foco === 'atrasadas' ? 'atrasadas' : 'sem divulgação'}</b> (${lista.length}).</span><button type="button" class="btn-link" data-foco-limpar>Ver todas</button></div>` : '') + `<div class="vg-lista">${lista.map(linha).join('')}</div>`;
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
          : '<span class="vg-alerta">ainda não divulgada</span>';
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
      const semDist = conta && v.semDistrito ? `<span class="vg-alerta" title="Defina o distrito na ficha desses candidatos">${v.semDistrito === 1 ? '1 candidato sem distrito' : v.semDistrito + ' candidatos sem distrito'}</span>` : '';

      // uma ação principal + menu
      let principal = '';
      if (pendente && podeAprovar) principal = '<button class="btn btn-pequeno btn-primario" data-acao="aprovar">Aprovar</button><button class="btn btn-pequeno" data-acao="recusar">Recusar</button>';
      else if (emAberto && podeEditar && !canais) principal = '<button class="btn btn-pequeno btn-primario" data-acao="divulgar">Divulgar</button>';
      else if (v.aprovada && podeVerCandidatos) principal = `<button class="btn btn-pequeno" data-acao="candidatos">Ver candidatos${v.candidatos ? ` (${v.candidatos})` : ''}</button>`;
      const menu = [];
      const it = (acao, rot, extra = '') => `<button type="button" class="${extra}" data-acao="${acao}">${rot}</button>`;
      if (emAberto && podeEditar && canais) menu.push(it('divulgar', 'Divulgar'));
      if (v.aprovada && podeVerCandidatos && !principal.includes('candidatos')) menu.push(it('candidatos', 'Ver candidatos'));
      if (emAberto) menu.push(it('procurar', 'Procurar candidatos na internet'));
      menu.push(it('mapa', 'Ver no mapa'));
      if (podeEditar) menu.push(it('editar', 'Editar o pedido'));
      if (podeEditar && !fechada(v)) menu.push(it('cancelar', 'Cancelar a vaga', 'perigo'));
      if (podeEditar && fechada(v)) menu.push(it('reabrir', v.aprovada ? 'Reabrir' : 'Pedir de novo'));
      if (ehAdmin) menu.push(it('excluir', 'Excluir', 'perigo'));

      const prio = v.prioridade && v.prioridade !== 'normal' ? `<span class="badge ${CLASSE_PRIORIDADE[v.prioridade]}">${Store.PRIORIDADES[v.prioridade]}</span>` : '';
      return `<article data-id="${v.id}" class="vg-card ${fechada(v) ? 'vg-fechada' : ''} ${v.atrasada ? 'vg-atrasada' : ''} ${pendente ? 'vg-pendente' : ''}">
        <div class="vg-card-cab">
          <div class="vg-card-tit"><h3>${UI.esc(v.titulo)}</h3>${prio}${selo}<span class="badge ${CLASSE_STATUS[v.status] || 'badge-cinza'}">${UI.esc(Store.STATUS_VAGA[v.status] || v.status)}</span></div>
          <div class="vg-card-sub"><span class="vg-onde">${UI.esc(ondeTexto(v) || 'sem distrito')}</span><span>${UI.esc(v.projeto ? v.projeto.nome : '—')}</span>${v.solicitante ? `<span>pedida por ${UI.esc(v.solicitante)}</span>` : ''}</div>
        </div>
        <div class="vg-card-corpo">
          <div class="vg-bloco vg-bloco-prog">${numero}<div class="vg-dls">${dist}</div></div>
          <div class="vg-bloco vg-bloco-prazo">${prazo}</div>
          <div class="vg-bloco vg-bloco-rh"><div class="vg-k-rot">${(v.responsaveis || []).length > 1 ? 'RHs responsáveis' : 'RH responsável'}</div>
            <div class="vg-rh">${(v.responsaveis || []).length ? `<span class="vg-rh-fotos">${v.responsaveis.map(l => { const u = Store.usuarioPorLogin(l); return `<span title="${UI.esc(u ? u.nome : l)}">${UI.avatar(u || { nome: l }, 26)}</span>`; }).join('')}</span><span class="vg-rh-nome">${UI.esc(v.responsaveis.map(l => { const u = Store.usuarioPorLogin(l); return (u ? u.nome : l).split(' ')[0]; }).join(', '))}</span>${v.responsaveis.some(l => (Store.usuarioPorLogin(l) || {}).ativo === false) ? ' <span class="vg-alerta">RH inativo: troque</span>' : ''}` : '<span class="vg-alerta">sem RH responsável</span>'}</div>
            ${detalhe ? `<div class="vg-k-sub">${detalhe}</div>` : ''}</div>
        </div>
        <div class="vg-card-pe">
          <div class="vg-etapas">${etapasTxt}${semDist}</div>
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
      const acao = b.dataset.acao;
      if (acao === 'aprovar') aprovar(v);
      else if (acao === 'recusar') recusar(v);
      else if (acao === 'divulgar') modalDivulgar(v);
      else if (acao === 'candidatos') { try { if (b.dataset.etapa) sessionStorage.setItem('maparh:cand-seg', b.dataset.etapa); } catch (err) { /* ok */ } localStorage.setItem('maparh:cand-vaga', v.id); localStorage.setItem('maparh:cand-projeto', v.projetoId); App.ir('candidatos'); }
      else if (acao === 'procurar') { if (v.cidade) UI.modalBuscaCandidatos(v.cidade.nome, v.cidade.uf, v.titulo); }
      else if (acao === 'editar') formVaga(v);
      else if (acao === 'mapa') { App.filtros.projetoId = v.projetoId; sessionStorage.setItem('maparh:mapa-foco', JSON.stringify({ cidadeId: v.cidadeId })); App.aoMudarFiltros(); App.ir('mapa'); }
      else if (acao === 'cancelar') mudarStatus(v, 'cancelada');
      else if (acao === 'reabrir') mudarStatus(v, v.aprovada ? 'aberta' : 'aguardando');
      else if (acao === 'excluir') excluir(v);
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

    // escolha de vários RHs: clica para marcar/desmarcar; o primeiro marcado é o principal
    function seletorRhs(sel) {
      const equipe = Store.equipeRh();
      return `<div class="vg-rhs" data-rhs>${equipe.map(u => `<button type="button" class="vg-rh-op ${sel.includes(u.login) ? 'on' : ''}" data-rh="${UI.esc(u.login)}">${UI.avatar(u, 22)}<span>${UI.esc(u.nome)}</span><i class="vg-rh-principal">${sel[0] === u.login ? 'principal' : ''}</i></button>`).join('')}</div>`;
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
    function formVaga(v) {
      const projetos = App.projetosVisiveis().filter(p => p.ativo || (v && v.projetoId === p.id));
      if (!projetos.length) { UI.toast('Crie primeiro um projeto (estado/ano) em Cadastros → Projetos.', 'aviso'); return; }
      const projetoIni = v ? v.projetoId : (App.filtros.projetoId || projetos[0].id);
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
      const corpo = `
        <div class="pre-form-titulo">O pedido</div>
        <div class="form-linha">
          <label style="grid-column:1/-1">Cargo<input id="v-titulo" placeholder="Ex.: Operador de secador, Auxiliar de armazém" value="${val(v && v.titulo)}"></label>
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
        <details class="vg-anuncio" ${temAnuncio ? 'open' : ''}>
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
      desenharDist();
      setTimeout(() => g('#v-titulo').focus(), 60);
    }

    // ---------- divulgação ----------
    async function modalDivulgar(v) {
      if (!v.aprovada || v.status === 'aguardando' || v.status === 'recusada') { UI.toast('Esta vaga ainda não foi aprovada: não pode ser divulgada.', 'aviso'); return; }
      if (v.cidade && Store.BASES_SINE.includes(v.cidade.uf)) await Store.carregarBaseSine(v.cidade.uf);
      const texto = Store.textoAnuncio(v);
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
        if (k.id === 'whatsapp') return abrir('https://wa.me/?text=' + enc(texto), 'Abrir WhatsApp com o texto');
        if (k.id === 'linkedin') return abrir('https://www.linkedin.com/feed/?shareActive=true&text=' + enc(texto), 'Publicar no feed') + abrir(k.url, 'Anunciar vaga');
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
            <label>Texto do anúncio (edite à vontade antes de copiar)<textarea id="d-texto" rows="14">${UI.esc(texto)}</textarea></label>
            <div class="linha"><button class="btn btn-primario" id="d-copiar">Copiar texto</button>
              <a class="btn" href="mailto:?subject=${enc('Vaga: ' + v.titulo)}&body=${enc(texto)}">Enviar por e-mail</a>
              <button class="btn" data-imprimir>Imprimir cartaz</button></div>
            ${info && (info.canais || info.contatos) ? `<div class="caixa caixa-aviso"><b>Anotações do RH sobre ${UI.esc(c.nome)}:</b><br>${UI.esc([info.canais, info.contatos].filter(Boolean).join(' · '))}</div>` : ''}
          </div>
          <div>
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
      const m = UI.modal({ titulo: `Divulgar: ${v.titulo} — ${c ? c.nome : ''}`, largura: '960px', corpo, botoes: [{ texto: 'Fechar' }], aoFechar: () => App.recarregar() });
      const ta = m.corpo.querySelector('#d-texto');
      m.corpo.querySelector('#d-copiar').addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(ta.value); UI.toast('Texto copiado. Cole na plataforma.', 'sucesso'); }
        catch (e) { ta.select(); document.execCommand('copy'); UI.toast('Texto copiado.', 'sucesso'); }
      });
      m.corpo.querySelectorAll('[data-imprimir]').forEach(b => b.addEventListener('click', () => imprimirCartaz(v, ta.value)));
      m.corpo.querySelectorAll('.canal input[type="checkbox"]').forEach(ch => ch.addEventListener('change', () => {
        const canal = ch.closest('.canal');
        try { Store.marcarDivulgacao(v.id, canal.dataset.canal, ch.checked, App.usuario); canal.classList.toggle('feito', ch.checked); }
        catch (e) { UI.toast(e.message, 'erro'); ch.checked = !ch.checked; }
      }));
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
      if (Nuvem.rh.andamento) Nuvem.rh.andamento(App.filtros.projetoId).then(l => { andam = l || []; taxasPorProjeto = new Map(); if (ativo) desenhar(); }).catch(() => {});
    };
    desenhar(); contar();
    // mudou algo (aqui ou em outro computador): redesenha a lista e recontam os candidatos, sem apagar a tela
    App.aoAtualizar(() => { if (!ativo) return; if (!document.querySelector('.modal-overlay')) desenhar(); contar(); });
    return () => { ativo = false; };
  }
};
