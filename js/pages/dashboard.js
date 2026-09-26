// Visão geral: um número de destaque com a frase que o explica, quatro números de apoio,
// os gráficos que respondem "de onde vêm / onde trabalham" e o resumo por projeto.
// Cores: terracota = de onde vêm · petróleo = onde trabalham. Cheio = local, hachurado = móvel.
Paginas.dashboard = {
  titulo: 'Visão geral',
  render(el) {
    const regs = App.regs();
    const projetos = App.projetosVisiveis().filter(p => !App.filtros.projetoId || p.id === App.filtros.projetoId);
    const r = Analise.resumo(regs);
    const graficos = [];
    const COR_ORIGEM = '#b4441c', COR_ATUACAO = '#1077a0', TINTA = '#1a1714', TINTA_FRACA = '#6f6a62', LINHA = '#e3dfd7';

    if (!Store.projetos().length) {
      el.innerHTML = `
        <div class="card destaque">
          <h2>Bem-vindo ao Mapa RH</h2>
          <p class="frase">Aqui você acompanha <b>de onde vêm</b> e <b>onde trabalham</b> as pessoas contratadas.
            Para começar, crie um <b>projeto</b> — é o estado e o ano das contratações, por exemplo "Contratações RS 2024".
            Depois cole a planilha de contratações na tela Contratações.</p>
          <div class="linha mt">
            ${App.podeEditar() ? `<button class="btn btn-primario" id="btn-novo-projeto">Criar o primeiro projeto</button>
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
    const temMicro = Store.distritos().length > 0;
    const temOutroEstado = r.ufsOrigem > 1;
    const pctPropria = r.total ? r.mesmaCidade / r.total * 100 : 0;
    const frase = r.total
      ? `São <b>${UI.fmtNum(r.total)}</b> contratações em ${UI.fmtNum(r.projetos)} projeto(s).
         ${UI.fmtNum(r.mesmaCidade)} pessoas (${UI.fmtPct(pctPropria, 0)}) moram na mesma cidade onde trabalham;
         as demais vêm de ${UI.fmtNum(r.cidadesOrigem)} cidades diferentes, a ${UI.fmtKm(r.distMedia)} de distância em média.`
      : 'Nenhuma contratação no filtro atual. Mude o filtro na faixa acima ou cadastre contratações.';

    el.innerHTML = `
      <section>
        <div class="card destaque mb">
          <div class="etiqueta">Contratações</div>
          <div class="valor">${UI.fmtNum(r.total)}</div>
          <div class="frase">${frase}</div>
        </div>
        <div class="grade kpis">
          <div class="card kpi"><div class="rotulo"><span class="tipo tipo-local"></span>Local</div><div class="valor">${UI.fmtNum(r.local)}</div><div class="sub">${UI.fmtPct(r.pctLocal, 0)} do total</div></div>
          <div class="card kpi"><div class="rotulo"><span class="tipo tipo-movel"></span>Móvel</div><div class="valor">${UI.fmtNum(r.movel)}</div><div class="sub">${UI.fmtPct(r.pctMovel, 0)} do total</div></div>
          <div class="card kpi"><div class="rotulo"><span class="bolha-origem mini"></span>Cidades de origem</div><div class="valor">${UI.fmtNum(r.cidadesOrigem)}</div><div class="sub">de onde as pessoas vêm</div></div>
          <div class="card kpi"><div class="rotulo"><span class="marc-atuacao mini"></span>Cidades de trabalho</div><div class="valor">${UI.fmtNum(r.cidadesAtuacao)}</div><div class="sub">onde elas trabalham</div></div>
        </div>
      </section>
      <section id="graficos">
        <div class="grade grade-2">
          <div class="card"><h2>De onde vêm</h2><p class="muted small">As 10 cidades que mais forneceram pessoas.</p><div class="grafico-wrap"><canvas id="g-origem"></canvas></div></div>
          <div class="card"><h2>Onde trabalham</h2><p class="muted small">As 10 cidades com mais pessoas trabalhando.</p><div class="grafico-wrap"><canvas id="g-atuacao"></canvas></div></div>
          <div class="card"><h2>Distância de casa até o trabalho</h2><p class="muted small">Quantas pessoas em cada faixa de distância.</p><div class="grafico-wrap"><canvas id="g-dist"></canvas></div></div>
          ${temOutroEstado ? `<div class="card"><h2>Estados de origem</h2><p class="muted small">De quais estados as pessoas vêm.</p><div class="grafico-wrap"><canvas id="g-uf"></canvas></div></div>` : ''}
          ${temMicro ? `<div class="card" style="grid-column:1/-1"><h2>Por microrregião</h2><p class="muted small">Pessoas que trabalham nas cidades de cada microrregião. O losango marca quantas moram na própria microrregião.</p><div class="grafico-wrap" id="g-micro-wrap"><canvas id="g-micro"></canvas></div></div>` : ''}
          ${temAno ? '<div class="card" style="grid-column:1/-1"><h2>Por ano</h2><div class="grafico-wrap"><canvas id="g-ano"></canvas></div></div>' : ''}
        </div>
      </section>
      <section>
        <div class="card sem-padding">
          <div class="card-titulo" style="padding:var(--e5) var(--e5) 0"><h2>Resumo por projeto</h2></div>
          <div id="resumo-projetos"></div>
        </div>
      </section>`;

    if (!regs.length) {
      el.querySelector('#graficos').innerHTML = `<div class="card vazio">Nenhuma contratação para o filtro atual. ${App.podeEditar() ? '<a href="#/cadastro">Cadastrar contratações</a>.' : ''}</div>`;
    } else if (typeof Chart === 'undefined') {
      el.querySelectorAll('.grafico-wrap').forEach(g => g.innerHTML = '<div class="vazio">Gráficos indisponíveis sem conexão com a internet.</div>');
    } else {
      Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
      Chart.defaults.font.size = 12;
      Chart.defaults.color = TINTA_FRACA;
      Chart.defaults.borderColor = LINHA;

      // Hachura 45°: mesma leitura da etiqueta vazada de MÓVEL (funciona em p&b e no daltonismo)
      const hachura = (cor) => {
        const c = document.createElement('canvas'); c.width = c.height = 8;
        const x = c.getContext('2d');
        x.fillStyle = '#fff'; x.fillRect(0, 0, 8, 8);
        x.strokeStyle = cor; x.lineWidth = 2.5;
        x.beginPath(); x.moveTo(-2, 10); x.lineTo(10, -2); x.moveTo(2, 14); x.lineTo(14, 2); x.moveTo(-6, 6); x.lineTo(6, -6); x.stroke();
        return x.createPattern(c, 'repeat');
      };
      const HACHURA_ATUACAO = hachura(COR_ATUACAO);

      const eixoQtd = { grid: { color: LINHA, drawTicks: false }, border: { display: false }, ticks: { precision: 0 } };
      const eixoNome = { grid: { display: false }, border: { color: LINHA } };
      const base = (horizontal) => ({
        indexAxis: horizontal ? 'y' : 'x', responsive: true, maintainAspectRatio: false,
        scales: horizontal ? { x: eixoQtd, y: eixoNome } : { x: eixoNome, y: eixoQtd },
        plugins: { legend: { display: false }, tooltip: { padding: 10, backgroundColor: TINTA, titleFont: { weight: '600' }, displayColors: false } },
        elements: { bar: { borderRadius: 2 } }, maxBarThickness: 26
      });
      const empilhado = (horizontal) => {
        const o = base(horizontal);
        o.scales = horizontal ? { x: { ...eixoQtd, stacked: true }, y: { ...eixoNome, stacked: true } } : { x: { ...eixoNome, stacked: true }, y: { ...eixoQtd, stacked: true } };
        o.plugins.legend = { display: true, position: 'bottom', labels: { usePointStyle: true, pointStyle: 'rect', boxWidth: 10, boxHeight: 10, padding: 16 } };
        return o;
      };
      const localMovel = (lista) => [
        { label: 'Local', data: lista.map(c => c.local), backgroundColor: COR_ATUACAO, borderWidth: 0, stack: 's' },
        { label: 'Móvel', data: lista.map(c => c.movel), backgroundColor: HACHURA_ATUACAO, borderColor: COR_ATUACAO, borderWidth: 1, stack: 's' }
      ];

      // De onde vêm — uma série só, na cor da origem
      const origem = Analise.porCidadeOrigem(regs).slice(0, 10).reverse();
      graficos.push(new Chart(el.querySelector('#g-origem'), {
        type: 'bar',
        data: { labels: origem.map(c => `${c.cidade.nome}/${c.cidade.uf}`), datasets: [{ data: origem.map(c => c.total), backgroundColor: COR_ORIGEM, borderWidth: 0 }] },
        options: base(true)
      }));

      // Onde trabalham — uma série só, na cor da atuação
      const atuacao = Analise.porCidadeAtuacao(regs).slice(0, 10).reverse();
      graficos.push(new Chart(el.querySelector('#g-atuacao'), {
        type: 'bar',
        data: { labels: atuacao.map(a => a.rotulo), datasets: [{ data: atuacao.map(a => a.total), backgroundColor: COR_ATUACAO, borderWidth: 0 }] },
        options: base(true)
      }));

      // Distância — magnitude em uma cor só (a distância é da viagem de casa até o trabalho)
      const fx = Analise.faixasDistancia(regs);
      graficos.push(new Chart(el.querySelector('#g-dist'), {
        type: 'bar',
        data: { labels: fx.map(f => f.faixa), datasets: [{ data: fx.map(f => f.total), backgroundColor: COR_ORIGEM, borderWidth: 0 }] },
        options: base(false)
      }));

      // Estados de origem — barras (ranking), nunca rosca de 10 fatias
      const cvUF = el.querySelector('#g-uf');
      if (cvUF) {
        const ufs = Analise.porUF(regs).slice(0, 8).reverse();
        graficos.push(new Chart(cvUF, {
          type: 'bar',
          data: { labels: ufs.map(u => `${u.uf} — ${u.nome}`), datasets: [{ data: ufs.map(u => u.total), backgroundColor: ufs.map(u => u.foraDoEstado ? '#d18c63' : COR_ORIGEM), borderWidth: 0 }] },
          options: base(true)
        }));
      }

      const cvMicro = el.querySelector('#g-micro');
      if (cvMicro) {
        const micros = Analise.porMicro(regs);
        const variosDistritos = new Set(micros.map(m => m.distrito).filter(Boolean)).size > 1;
        el.querySelector('#g-micro-wrap').style.height = Math.max(220, 48 + micros.length * 34) + 'px';
        const o = empilhado(true);
        o.plugins.tooltip.callbacks = { afterBody: itens => { const m = micros[itens[0].dataIndex]; return m.micro ? [`${m.propria} moram na própria microrregião (${m.pctPropria.toFixed(0)}%)`, `${m.cidadesOrigem} cidade(s) de origem · ${UI.fmtKm(m.distMedia)} em média`] : []; } };
        graficos.push(new Chart(cvMicro, {
          type: 'bar',
          data: {
            labels: micros.map(m => m.nome + (variosDistritos && m.distrito ? ' · ' + m.distrito : '')),
            datasets: [...localMovel(micros), { label: 'Moram na própria microrregião', data: micros.map(m => m.micro ? m.propria : null), type: 'line', borderColor: TINTA, backgroundColor: TINTA, showLine: false, pointStyle: 'rectRot', pointRadius: 6, stack: 'p' }]
          },
          options: o
        }));
      }

      if (temAno) {
        const anos = Analise.porAno(regs);
        const o = empilhado(false);
        graficos.push(new Chart(el.querySelector('#g-ano'), {
          type: 'bar',
          data: { labels: anos.map(a => String(a.ano)), datasets: localMovel(anos) },
          options: o
        }));
      }
    }

    el.querySelector('#resumo-projetos').innerHTML = UI.tabela({
      vazio: 'Nenhum projeto para exibir.',
      colunas: [
        { titulo: 'Projeto', render: p => `<span class="ponto-cor" style="background:${UI.esc(p.projeto.cor)}"></span>${UI.esc(p.projeto.nome)}${p.projeto.ativo ? '' : ' <span class="badge">inativo</span>'}` },
        { titulo: 'Estado', render: p => `${p.projeto.uf}` },
        { titulo: 'Ano', render: p => p.projeto.ano || '<span class="muted">—</span>' },
        { titulo: 'Total', classe: 'direita', render: p => `<b>${UI.fmtNum(p.total)}</b>` },
        { titulo: 'Local', classe: 'direita', render: p => UI.fmtNum(p.local) },
        { titulo: 'Móvel', classe: 'direita', render: p => UI.fmtNum(p.movel) },
        { titulo: 'Cidades de origem', classe: 'direita', render: p => `${UI.fmtNum(p.cidadesOrigem)} <span class="muted small">(${p.ufsOrigem} UF)</span>` },
        { titulo: 'Vêm de fora do estado', classe: 'direita', render: p => UI.fmtNum(p.foraDoEstado) },
        { titulo: 'Cidades de trabalho', classe: 'direita', render: p => UI.fmtNum(p.cidadesAtuacao) },
        { titulo: 'Atuam em todo o estado', classe: 'direita', render: p => UI.fmtNum(p.atuacaoMovel) },
        { titulo: 'Distância média', classe: 'direita', render: p => UI.fmtKm(p.distMedia) }
      ],
      linhas: Analise.porProjeto(regs, projetos)
    });

    return () => graficos.forEach(g => g.destroy());
  }
};
