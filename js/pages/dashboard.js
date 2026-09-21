Paginas.dashboard = {
  titulo: 'Dashboard',
  render(el) {
    const regs = App.regs();
    const projetos = App.projetosVisiveis().filter(p => !App.filtros.projetoId || p.id === App.filtros.projetoId);
    const r = Analise.resumo(regs);
    const graficos = [];

    if (!Store.projetos().length) {
      el.innerHTML = `
        <div class="card">
          <h2>Bem-vindo ao Mapa RH</h2>
          <p>Ainda não há projetos cadastrados. Um projeto é um <b>estado</b> (com ano opcional, ex.: "Contratações RS 2024"). Depois, cole a planilha de contratações no Cadastro.</p>
          <div class="linha mt">
            ${App.podeEditar() ? `<button class="btn btn-primario" id="btn-novo-projeto">Criar primeiro projeto</button>
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

    const temAno = regs.some(x => x.projeto.ano);
    el.innerHTML = `
      <p class="muted small mb">Filtro atual: <b>${UI.esc(App.descricaoFiltro())}</b></p>
      <div class="grade kpis mb">
        <div class="card kpi"><div class="rotulo">Contratações</div><div class="valor">${UI.fmtNum(r.total)}</div><div class="sub">${UI.fmtNum(r.projetos)} projeto(s)</div></div>
        <div class="card kpi kpi-local"><div class="rotulo">Local</div><div class="valor">${UI.fmtNum(r.local)}</div><div class="sub">${UI.fmtPct(r.pctLocal)} do total</div></div>
        <div class="card kpi kpi-movel"><div class="rotulo">Móvel</div><div class="valor">${UI.fmtNum(r.movel)}</div><div class="sub">${UI.fmtPct(r.pctMovel)} do total</div></div>
        <div class="card kpi"><div class="rotulo">Cidades de origem</div><div class="valor">${UI.fmtNum(r.cidadesOrigem)}</div><div class="sub">em ${UI.fmtNum(r.ufsOrigem)} estado(s)</div></div>
        <div class="card kpi"><div class="rotulo">Origem fora do estado</div><div class="valor">${UI.fmtNum(r.foraDoEstado)}</div><div class="sub">${UI.fmtPct(r.pctForaDoEstado)} do total</div></div>
        <div class="card kpi kpi-roxo"><div class="rotulo">Atuação em todo o estado</div><div class="valor">${UI.fmtNum(r.atuacaoMovel)}</div><div class="sub">${UI.fmtPct(r.pctAtuacaoMovel)} do total</div></div>
        <div class="card kpi"><div class="rotulo">Cidades de atuação</div><div class="valor">${UI.fmtNum(r.cidadesAtuacao)}</div><div class="sub">${UI.fmtNum(r.mesmaCidade)} residem onde atuam</div></div>
        <div class="card kpi"><div class="rotulo">Distância origem → atuação</div><div class="valor">${UI.fmtKm(r.distMedia)}</div><div class="sub">média · máx. ${UI.fmtKm(r.distMax)}</div></div>
      </div>
      <div class="grade grade-2 mb" id="graficos">
        <div class="card"><h2>Top 10 cidades de origem</h2><div class="grafico-wrap"><canvas id="g-origem"></canvas></div></div>
        <div class="card"><h2>Cidades de atuação</h2><div class="grafico-wrap"><canvas id="g-atuacao"></canvas></div></div>
        <div class="card"><h2>Estados de origem</h2><div class="grafico-wrap"><canvas id="g-uf"></canvas></div></div>
        <div class="card"><h2>Faixas de distância (origem → atuação)</h2><div class="grafico-wrap"><canvas id="g-dist"></canvas></div></div>
        ${Store.distritos().length ? `<div class="card" style="grid-column:1/-1"><h2>Contratações por microrregião <span class="muted small" style="font-weight:400">(cidade de atuação)</span></h2><div class="grafico-wrap" id="g-micro-wrap"><canvas id="g-micro"></canvas></div></div>` : ''}
        ${temAno ? '<div class="card" style="grid-column:1/-1"><h2>Amplitude por ano</h2><div class="grafico-wrap"><canvas id="g-ano"></canvas></div></div>' : ''}
      </div>
      <div class="card">
        <h2>Resumo por projeto</h2>
        <div id="resumo-projetos"></div>
      </div>`;

    if (!regs.length) {
      el.querySelector('#graficos').innerHTML = `<div class="card vazio" style="grid-column:1/-1">Nenhuma contratação cadastrada para o filtro atual. ${App.podeEditar() ? '<a href="#/cadastro">Ir para o cadastro</a>.' : ''}</div>`;
    } else if (typeof Chart === 'undefined') {
      el.querySelectorAll('.grafico-wrap').forEach(g => g.innerHTML = '<div class="vazio">Gráficos indisponíveis sem conexão com a internet.</div>');
    } else {
      Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
      Chart.defaults.color = '#475569';
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
        { titulo: 'Estado', render: p => `${p.projeto.uf}` },
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

    return () => graficos.forEach(g => g.destroy());
  }
};
