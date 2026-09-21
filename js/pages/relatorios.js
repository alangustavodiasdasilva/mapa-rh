Paginas.relatorios = {
  titulo: 'Relatórios',
  render(el) {
    const colLM = [
      { titulo: 'Local', classe: 'direita', render: r => UI.fmtNum(r.local) },
      { titulo: 'Móvel', classe: 'direita', render: r => UI.fmtNum(r.movel) },
      { titulo: 'Total', classe: 'direita', render: r => `<b>${UI.fmtNum(r.total)}</b>` }
    ];
    const km = v => v == null ? '' : Math.round(v);
    const RELATORIOS = [
      { id: 'origem', nome: 'Contratações por cidade de origem', gerar: (regs) => ({
        colunas: [
          { titulo: 'Cidade de origem', render: r => UI.esc(r.cidade.nome) },
          { titulo: 'UF', render: r => `${r.cidade.uf}${r.foraDoEstado ? ' <span class="badge badge-amarelo">fora</span>' : ''}` },
          ...colLM,
          { titulo: '% do total', classe: 'direita', render: r => UI.fmtPct(r.pct) },
          { titulo: 'Cidades de atuação', classe: 'direita', render: r => r.atuacoes },
          { titulo: 'Todo o estado', classe: 'direita', render: r => UI.fmtNum(r.atuacaoMovel) },
          { titulo: 'Dist. média', classe: 'direita', render: r => UI.fmtKm(r.distMedia) }
        ],
        linhas: Analise.porCidadeOrigem(regs),
        csv: l => [l.cidade.nome, l.cidade.uf, l.foraDoEstado ? 'SIM' : 'NAO', l.local, l.movel, l.total, l.pct.toFixed(1), l.atuacoes, l.atuacaoMovel, km(l.distMedia)],
        cabecalhoCsv: ['CIDADE DE ORIGEM', 'UF', 'FORA DO ESTADO', 'LOCAL', 'MOVEL', 'TOTAL', '% DO TOTAL', 'CIDADES DE ATUACAO', 'TODO O ESTADO', 'DIST MEDIA KM']
      }) },
      { id: 'atuacao', nome: 'Contratações por cidade de atuação', gerar: (regs) => ({
        colunas: [
          { titulo: 'Cidade de atuação', render: r => r.movelEstado ? `<span class="badge badge-roxo">${UI.esc(r.rotulo)}</span>` : UI.esc(r.rotulo) },
          ...colLM,
          { titulo: '% do total', classe: 'direita', render: r => UI.fmtPct(r.pct) },
          { titulo: 'Cidades de origem', classe: 'direita', render: r => r.origens },
          { titulo: 'Origem fora do estado', classe: 'direita', render: r => UI.fmtNum(r.foraDoEstado) },
          { titulo: 'Dist. média', classe: 'direita', render: r => UI.fmtKm(r.distMedia) }
        ],
        linhas: Analise.porCidadeAtuacao(regs),
        csv: l => [l.rotulo, l.local, l.movel, l.total, l.pct.toFixed(1), l.origens, l.foraDoEstado, km(l.distMedia)],
        cabecalhoCsv: ['CIDADE DE ATUACAO', 'LOCAL', 'MOVEL', 'TOTAL', '% DO TOTAL', 'CIDADES DE ORIGEM', 'ORIGEM FORA DO ESTADO', 'DIST MEDIA KM']
      }) },
      { id: 'micro', nome: 'Contratações por microrregião', gerar: (regs) => ({
        colunas: [
          { titulo: 'Microrregião', render: r => `<span class="ponto-cor" style="background:${UI.esc(r.cor)}"></span>${r.micro ? UI.esc(r.nome) : `<span class="badge ${r.ordem === 1 ? 'badge-roxo' : 'badge-cinza'}">${UI.esc(r.nome)}</span>`}` },
          { titulo: 'Distrito', render: r => UI.esc(r.distrito || '—') },
          ...colLM,
          { titulo: '% do total', classe: 'direita', render: r => UI.fmtPct(r.pct) },
          { titulo: 'Cidades de atuação', classe: 'direita', render: r => r.cidadesAtuacao },
          { titulo: 'Cidades de origem', classe: 'direita', render: r => r.cidadesOrigem },
          { titulo: 'Moram na própria micro', classe: 'direita', render: r => r.micro ? `${UI.fmtNum(r.propria)} <span class="muted small">(${UI.fmtPct(r.pctPropria, 0)})</span>` : '—' },
          { titulo: 'Origem fora do estado', classe: 'direita', render: r => UI.fmtNum(r.foraDoEstado) },
          { titulo: 'Dist. média', classe: 'direita', render: r => UI.fmtKm(r.distMedia) }
        ],
        linhas: Analise.porMicro(regs),
        csv: l => [l.nome, l.distrito, l.local, l.movel, l.total, l.pct.toFixed(1), l.cidadesAtuacao, l.cidadesOrigem, l.micro ? l.propria : '', l.micro ? l.pctPropria.toFixed(0) : '', l.foraDoEstado, km(l.distMedia)],
        cabecalhoCsv: ['MICRORREGIAO', 'DISTRITO', 'LOCAL', 'MOVEL', 'TOTAL', '% DO TOTAL', 'CIDADES DE ATUACAO', 'CIDADES DE ORIGEM', 'MORAM NA PROPRIA MICRO', '% PROPRIA MICRO', 'ORIGEM FORA DO ESTADO', 'DIST MEDIA KM'],
        nota: 'Microrregião da cidade de atuação (ou da base, no caso de MÓVEL). "Moram na própria micro" = origem em cidade da mesma microrregião.'
      }) },
      { id: 'projeto', nome: 'Resumo por projeto (estado / ano)', gerar: (regs) => ({
        colunas: [
          { titulo: 'Projeto', render: r => `<span class="ponto-cor" style="background:${UI.esc(r.projeto.cor)}"></span>${UI.esc(r.projeto.nome)}` },
          { titulo: 'UF', render: r => r.projeto.uf },
          { titulo: 'Ano', render: r => r.projeto.ano || '—' },
          ...colLM,
          { titulo: '% Local', classe: 'direita', render: r => UI.fmtPct(r.pctLocal) },
          { titulo: 'Cidades de origem', classe: 'direita', render: r => `${r.cidadesOrigem} <span class="muted small">(${r.ufsOrigem} UF)</span>` },
          { titulo: 'Fora do estado', classe: 'direita', render: r => UI.fmtNum(r.foraDoEstado) },
          { titulo: 'Cidades de atuação', classe: 'direita', render: r => r.cidadesAtuacao },
          { titulo: 'Todo o estado', classe: 'direita', render: r => UI.fmtNum(r.atuacaoMovel) },
          { titulo: 'Dist. média', classe: 'direita', render: r => UI.fmtKm(r.distMedia) }
        ],
        linhas: Analise.porProjeto(regs, App.projetosVisiveis().filter(p => !App.filtros.projetoId || p.id === App.filtros.projetoId)),
        csv: l => [l.projeto.nome, l.projeto.uf, l.projeto.ano || '', l.local, l.movel, l.total, l.pctLocal.toFixed(1), l.cidadesOrigem, l.ufsOrigem, l.foraDoEstado, l.cidadesAtuacao, l.atuacaoMovel, km(l.distMedia)],
        cabecalhoCsv: ['PROJETO', 'UF', 'ANO', 'LOCAL', 'MOVEL', 'TOTAL', '% LOCAL', 'CIDADES DE ORIGEM', 'UFS DE ORIGEM', 'FORA DO ESTADO', 'CIDADES DE ATUACAO', 'TODO O ESTADO', 'DIST MEDIA KM']
      }) },
      { id: 'ano', nome: 'Amplitude por ano', gerar: (regs) => ({
        colunas: [
          { titulo: 'Ano', render: r => r.ano },
          { titulo: 'Projetos', classe: 'direita', render: r => r.projetos },
          ...colLM,
          { titulo: 'Cidades de origem', classe: 'direita', render: r => r.cidadesOrigem },
          { titulo: 'Estados de origem', classe: 'direita', render: r => r.ufsOrigem },
          { titulo: 'Fora do estado', classe: 'direita', render: r => UI.fmtNum(r.foraDoEstado) },
          { titulo: 'Todo o estado', classe: 'direita', render: r => UI.fmtNum(r.atuacaoMovel) }
        ],
        linhas: Analise.porAno(regs),
        csv: l => [l.ano, l.projetos, l.local, l.movel, l.total, l.cidadesOrigem, l.ufsOrigem, l.foraDoEstado, l.atuacaoMovel],
        cabecalhoCsv: ['ANO', 'PROJETOS', 'LOCAL', 'MOVEL', 'TOTAL', 'CIDADES DE ORIGEM', 'ESTADOS DE ORIGEM', 'FORA DO ESTADO', 'TODO O ESTADO'],
        nota: 'O ano vem do cadastro do projeto.'
      }) },
      { id: 'fluxo', nome: 'Atuação → cidade de origem (fluxos)', gerar: (regs) => ({
        colunas: [
          { titulo: 'Projeto', render: f => UI.esc(f.projeto.nome) },
          { titulo: 'Atuação', render: f => f.atuacaoMovel ? `<span class="badge badge-roxo">${UI.esc(Analise.rotuloAtuacao(f))}</span>` : UI.esc(Analise.rotuloAtuacao(f)) },
          { titulo: 'Cidade de origem', render: f => `${UI.esc(f.cidadeOrigem.nome)}/${f.cidadeOrigem.uf}${f.foraDoEstado ? ' <span class="badge badge-amarelo">fora</span>' : ''}` },
          ...colLM,
          { titulo: 'Distância', classe: 'direita', render: f => UI.fmtKm(f.dist) }
        ],
        linhas: Analise.fluxos(regs),
        csv: f => [f.projeto.nome, Analise.rotuloAtuacao(f), f.cidadeOrigem.nome + '/' + f.cidadeOrigem.uf, f.local, f.movel, f.total, km(f.dist)],
        cabecalhoCsv: ['PROJETO', 'ATUACAO', 'CIDADE DE ORIGEM', 'LOCAL', 'MOVEL', 'TOTAL', 'DISTANCIA KM']
      }) },
      { id: 'uf', nome: 'Por estado de origem', gerar: (regs) => ({
        colunas: [
          { titulo: 'UF', render: r => r.uf },
          { titulo: 'Estado', render: r => `${UI.esc(r.nome)}${r.foraDoEstado ? ' <span class="badge badge-amarelo">fora do estado do projeto</span>' : ''}` },
          ...colLM,
          { titulo: '% do total', classe: 'direita', render: r => UI.fmtPct(r.pct) },
          { titulo: 'Cidades', classe: 'direita', render: r => r.cidades }
        ],
        linhas: Analise.porUF(regs),
        csv: r => [r.uf, r.nome, r.local, r.movel, r.total, r.pct.toFixed(1), r.cidades],
        cabecalhoCsv: ['UF', 'ESTADO', 'LOCAL', 'MOVEL', 'TOTAL', '% DO TOTAL', 'CIDADES']
      }) },
      { id: 'distancia', nome: 'Deslocamento (faixas de distância)', gerar: (regs) => ({
        colunas: [
          { titulo: 'Faixa', render: r => UI.esc(r.faixa) },
          ...colLM,
          { titulo: '% do total', classe: 'direita', render: r => UI.fmtPct(r.pct) }
        ],
        linhas: Analise.faixasDistancia(regs),
        csv: r => [r.faixa, r.local, r.movel, r.total, r.pct.toFixed(1)],
        cabecalhoCsv: ['FAIXA', 'LOCAL', 'MOVEL', 'TOTAL', '% DO TOTAL']
      }) },
      { id: 'completa', nome: 'Relação completa (todas as linhas)', gerar: (regs) => ({
        colunas: [
          { titulo: 'Projeto', render: r => UI.esc(r.projeto.nome) },
          { titulo: 'MÓVEL/LOCAL', render: r => UI.badgeTipo(r.tipo) },
          { titulo: 'Cidade de origem', render: r => UI.esc(r.cidade.nome) },
          { titulo: 'Estado', render: r => r.cidade.uf },
          { titulo: 'Cidade de atuação', render: r => r.atuacaoMovel ? '<span class="badge badge-roxo">MÓVEL · todo o estado</span>' : UI.esc(r.cidadeAtuacao.nome) },
          { titulo: 'Distância', classe: 'direita', render: r => UI.fmtKm(r.distancia) },
          { titulo: 'Cadastrado em', render: r => UI.fmtDataHora(r.criadoEm) },
          { titulo: 'Por', render: r => UI.esc(r.criadoPor || '—') }
        ],
        linhas: regs.slice().sort((a, b) => a.projeto.nome.localeCompare(b.projeto.nome, 'pt-BR') || a.cidade.nome.localeCompare(b.cidade.nome, 'pt-BR')),
        csv: r => [UI.rotuloTipo(r.tipo), r.cidade.nome, r.cidade.uf, r.atuacaoMovel ? 'MOVEL' : r.cidadeAtuacao.nome, r.projeto.nome, r.projeto.uf, r.projeto.ano || '', km(r.distancia), UI.fmtDataHora(r.criadoEm), r.criadoPor || ''],
        cabecalhoCsv: ['MOVEL/LOCAL', 'CIDADE DE ORIGEM', 'ESTADO', 'CIDADE DE ATUACAO', 'PROJETO', 'UF PROJETO', 'ANO', 'DISTANCIA KM', 'CADASTRADO EM', 'POR']
      }) },
      { id: 'mes', nome: 'Cadastros por mês', gerar: (regs) => ({
        colunas: [{ titulo: 'Mês', render: r => Analise.rotuloMes(r.mes) }, ...colLM],
        linhas: Analise.porMes(regs),
        csv: r => [Analise.rotuloMes(r.mes), r.local, r.movel, r.total],
        cabecalhoCsv: ['MES', 'LOCAL', 'MOVEL', 'TOTAL'],
        nota: 'Considera a data em que cada contratação foi cadastrada no sistema.'
      }) }
    ];

    let atual = localStorage.getItem('maparh:relatorio') || 'origem';
    if (!RELATORIOS.some(r => r.id === atual)) atual = 'origem';

    el.innerHTML = `
      <div class="relatorios-layout">
        <div class="card lista-relatorios nao-imprimir" style="padding:8px">${RELATORIOS.map(r => `<a href="#" data-id="${r.id}">${UI.esc(r.nome)}</a>`).join('')}</div>
        <div class="card" id="rel-conteudo"></div>
      </div>`;
    el.querySelectorAll('.lista-relatorios a').forEach(a => a.addEventListener('click', e => { e.preventDefault(); atual = a.dataset.id; localStorage.setItem('maparh:relatorio', atual); renderRelatorio(); }));

    function renderRelatorio() {
      el.querySelectorAll('.lista-relatorios a').forEach(a => a.classList.toggle('ativo', a.dataset.id === atual));
      const rel = RELATORIOS.find(r => r.id === atual);
      const regs = App.regs();
      const dados = rel.gerar(regs);
      const cont = el.querySelector('#rel-conteudo');
      cont.innerHTML = `
        <div class="cabecalho-impressao"><h2>Mapa RH — ${UI.esc(rel.nome)}</h2><div class="muted">${UI.esc(App.descricaoFiltro())} · gerado em ${UI.fmtDataHora(new Date().toISOString())}</div></div>
        <div class="card-titulo nao-imprimir">
          <div><h2 style="margin:0">${UI.esc(rel.nome)}</h2><div class="muted small">${UI.esc(App.descricaoFiltro())} · ${UI.fmtNum(regs.length)} contratação(ões)${dados.nota ? ' · ' + UI.esc(dados.nota) : ''}</div></div>
          <div class="linha"><button class="btn btn-pequeno" id="rel-csv">Exportar CSV</button><button class="btn btn-pequeno" id="rel-imprimir">Imprimir / PDF</button></div>
        </div>
        ${UI.tabela({ colunas: dados.colunas, linhas: dados.linhas, vazio: 'Nenhum dado para o filtro atual.' })}`;
      cont.querySelector('#rel-csv').addEventListener('click', () => {
        UI.baixarCSV(`relatorio-${rel.id}.csv`, [dados.cabecalhoCsv].concat(dados.linhas.map(dados.csv)));
        Store.auditar('relatorio.exportar', rel.nome, App.usuario);
      });
      cont.querySelector('#rel-imprimir').addEventListener('click', () => window.print());
    }
    renderRelatorio();
  }
};
