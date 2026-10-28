// Início: o fluxo do RH em quatro passos com os números de hoje, e abaixo os indicadores das contratações.
Paginas.dashboard = {
  titulo: 'Início',
  render(el) {
    const regs = App.regs();
    const projetos = App.projetosVisiveis().filter(p => !App.filtros.projetoId || p.id === App.filtros.projetoId);
    const r = Analise.resumo(regs);
    const graficos = [];
    const podeEditar = App.podeEditar();

    if (!Store.projetos().length) {
      el.innerHTML = `
        <div class="card boas-vindas">
          <h2>Bem-vindo ao Mapa RH</h2>
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
    const pendencias = [];
    if (rec.semDivulgacao) pendencias.push(`<a href="#/vagas">${rec.semDivulgacao} vaga(s) aberta(s) sem divulgação</a>`);
    if (rec.emDocumentos) pendencias.push(`<a href="#/candidatos">${rec.emDocumentos} candidato(s) esperando documentos</a>`);
    if (!Store.temIBGE()) pendencias.push(`<a href="#/cidades">baixar a lista de cidades do IBGE</a> (uma vez só, reconhece qualquer cidade do Brasil)`);
    el.innerHTML = `
      <div class="fluxo">
        <a class="fluxo-passo" href="#/vagas">
          <div class="fluxo-num">1</div>
          <div><div class="fluxo-titulo">Vagas abertas</div><div class="fluxo-valor">${UI.fmtNum(rec.vagasAbertas)}</div><div class="fluxo-sub">${UI.fmtNum(rec.posicoes)} posição(ões) a preencher${rec.semDivulgacao ? ` · <span class="erro">${rec.semDivulgacao} sem divulgar</span>` : ''}</div></div>
        </a>
        <div class="fluxo-seta">→</div>
        <a class="fluxo-passo" href="#/candidatos">
          <div class="fluxo-num">2</div>
          <div><div class="fluxo-titulo">Candidatos em processo</div><div class="fluxo-valor">${UI.fmtNum(rec.candidatos)}</div><div class="fluxo-sub">${rec.emDocumentos ? `${rec.emDocumentos} na etapa de documentos` : 'triagem, entrevista e documentos'}</div></div>
        </a>
        <div class="fluxo-seta">→</div>
        <a class="fluxo-passo" href="#/cadastro">
          <div class="fluxo-num">3</div>
          <div><div class="fluxo-titulo">Contratações</div><div class="fluxo-valor">${UI.fmtNum(r.total)}</div><div class="fluxo-sub">${UI.fmtNum(r.local)} local · ${UI.fmtNum(r.movel)} móvel${rec.admitidos ? ` · ${rec.admitidos} vinda(s) da seleção` : ''}</div></div>
        </a>
        <div class="fluxo-seta">→</div>
        <a class="fluxo-passo" href="#/mapa">
          <div class="fluxo-num">4</div>
          <div><div class="fluxo-titulo">No mapa</div><div class="fluxo-valor">${UI.fmtNum(r.cidadesOrigem)}</div><div class="fluxo-sub">cidades de origem · ${UI.fmtNum(r.cidadesAtuacao)} de trabalho</div></div>
        </a>
      </div>
      ${pendencias.length ? `<div class="caixa caixa-aviso mb" style="margin-top:0"><b>Pendências:</b> ${pendencias.join(' · ')}.</div>` : ''}
      <div class="secao-titulo">Indicadores das contratações <span class="muted small">${UI.esc(App.descricaoFiltro())}</span></div>
      <div class="grade kpis mb">
        <div class="card kpi"><div class="rotulo">Contratações</div><div class="valor">${UI.fmtNum(r.total)}</div><div class="sub">${UI.fmtNum(r.projetos)} projeto(s)</div></div>
        <div class="card kpi kpi-local"><div class="rotulo">Local</div><div class="valor">${UI.fmtNum(r.local)}</div><div class="sub">${UI.fmtPct(r.pctLocal)} do total</div></div>
        <div class="card kpi kpi-movel"><div class="rotulo">Móvel</div><div class="valor">${UI.fmtNum(r.movel)}</div><div class="sub">${UI.fmtPct(r.pctMovel)} do total</div></div>
        <div class="card kpi"><div class="rotulo">Cidades de origem</div><div class="valor">${UI.fmtNum(r.cidadesOrigem)}</div><div class="sub">em ${UI.fmtNum(r.ufsOrigem)} estado(s)</div></div>
        <div class="card kpi"><div class="rotulo">Vêm de fora do estado</div><div class="valor">${UI.fmtNum(r.foraDoEstado)}</div><div class="sub">${UI.fmtPct(r.pctForaDoEstado)} do total</div></div>
        <div class="card kpi"><div class="rotulo">Moram onde trabalham</div><div class="valor">${UI.fmtNum(r.mesmaCidade)}</div><div class="sub">de ${UI.fmtNum(r.cidadesAtuacao)} cidades de trabalho</div></div>
        <div class="card kpi"><div class="rotulo">Distância casa → trabalho</div><div class="valor">${UI.fmtKm(r.distMedia)}</div><div class="sub">média · máx. ${UI.fmtKm(r.distMax)}</div></div>
      </div>
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

    return () => graficos.forEach(g => g.destroy());
  }
};
