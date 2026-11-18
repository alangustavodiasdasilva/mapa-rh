Paginas.relatorios = {
  titulo: 'Relatórios',
  render(el) {
    const colLM = [
      { titulo: 'Local', classe: 'direita', render: r => UI.fmtNum(r.local) },
      { titulo: 'Móvel', classe: 'direita', render: r => UI.fmtNum(r.movel) },
      { titulo: 'Total', classe: 'direita', render: r => `<b>${UI.fmtNum(r.total)}</b>` }
    ];
    const km = v => v == null ? '' : Math.round(v);
    let andamento = null;   // andamento dos candidatos (só para "Situação das vagas"), buscado quando o relatório abre
    let indicacoes = null;  // candidatos com nome (só para quem abre Candidatos), para a tabela de indicações
    // andamento com os filtros de distrito e tipo do topo (o de projeto já vem da busca)
    const andamentoFiltrado = () => (andamento || []).filter(p => (!App.filtros.distritoId || p.distrito_id === App.filtros.distritoId) && (!App.filtros.tipo || p.tipo === App.filtros.tipo));
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
          { titulo: 'UF', render: r => Store.ufsProjeto(r.projeto).join('/') },
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
        csv: l => [l.projeto.nome, Store.ufsProjeto(l.projeto).join('/'), l.projeto.ano || '', l.local, l.movel, l.total, l.pctLocal.toFixed(1), l.cidadesOrigem, l.ufsOrigem, l.foraDoEstado, l.cidadesAtuacao, l.atuacaoMovel, km(l.distMedia)],
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
          { titulo: 'Cidade de atuação', render: r => r.atuacaoMovel ? '<span class="badge badge-roxo">MÓVEL · todo o estado</span>' : UI.esc(r.cidadeAtuacao ? r.cidadeAtuacao.nome : '—') },
          { titulo: 'Distância', classe: 'direita', render: r => UI.fmtKm(r.distancia) },
          { titulo: 'Cadastrado em', render: r => UI.fmtDataHora(r.criadoEm) },
          { titulo: 'Por', render: r => UI.esc(r.criadoPor || '—') }
        ],
        linhas: regs.slice().sort((a, b) => a.projeto.nome.localeCompare(b.projeto.nome, 'pt-BR') || a.cidade.nome.localeCompare(b.cidade.nome, 'pt-BR')),
        // mesma ordem da tabela (UF e ano do projeto logo depois do projeto)
        csv: r => [r.projeto.nome, r.projeto.uf, r.projeto.ano || '', UI.rotuloTipo(r.tipo), r.cidade.nome, r.cidade.uf, r.atuacaoMovel ? 'MOVEL' : (r.cidadeAtuacao ? r.cidadeAtuacao.nome : ''), km(r.distancia), UI.fmtDataHora(r.criadoEm), r.criadoPor || ''],
        cabecalhoCsv: ['PROJETO', 'UF PROJETO', 'ANO', 'MOVEL/LOCAL', 'CIDADE DE ORIGEM', 'ESTADO', 'CIDADE DE ATUACAO', 'DISTANCIA KM', 'CADASTRADO EM', 'POR']
      }) },
      // Situação das vagas: uma linha por vaga e distrito, com o andamento dos candidatos (sem dado pessoal)
      { id: 'vagas', nome: 'Situação das vagas', precisaAndamento: true, gerar: () => {
        const l = andamento || [];
        Store.definirContagemVagas(Store.contagemDoAndamento(l));
        const fD = App.filtros.distritoId;
        const vagas = Store.vagasVisiveis(App.usuario, { projetoId: App.filtros.projetoId }).filter(v => v.aprovada && v.status !== 'cancelada')
          .filter(v => !fD || v.porDistrito.some(d => d.distrito.id === fD));
        const taxas = new Map(), taxasDe = pid => { if (!taxas.has(pid)) taxas.set(pid, Store.taxasAproveitamento(l.filter(p => p.projeto_id === pid))); return taxas.get(pid); };
        const etapa = (v, did, e) => l.filter(p => p.vaga_id === v.id && p.situacao === 'em_andamento' && p.etapa === e && (did === null || (p.distrito_id || null) === did)).length;
        const nomeRh = login => { const u = Store.usuarioPorLogin(login); return u ? u.nome : login; };
        const linhas = [], selos = { no_prazo: 0, risco: 0, nao_fecha: 0 };
        for (const v of vagas) {
          const pv = Store.previsaoVaga(v, l, taxasDe(v.projetoId));
          if (pv && selos[pv.selo] != null) selos[pv.selo]++;
          const base = { v, pv, rhs: (v.responsaveis || []).map(nomeRh).join(', ') };
          if (v.porDistrito.length) {
            for (const d of v.porDistrito) if (!fD || d.distrito.id === fD) linhas.push({ ...base, distrito: d.distrito.nome, pl: d.locais, pm: d.moveis, al: d.admLoc, am: d.admMov,
              tri: etapa(v, d.distrito.id, 'triagem'), ent: etapa(v, d.distrito.id, 'entrevista'), doc: etapa(v, d.distrito.id, 'documentos') });
          } else {
            const loc = v.tipo !== 'MOVEL';
            linhas.push({ ...base, distrito: v.cidade ? v.cidade.nome + '/' + v.cidade.uf : '—', pl: loc ? v.quantidade : 0, pm: loc ? 0 : v.quantidade, al: loc ? v.admitidosValidos : 0, am: loc ? 0 : v.admitidosValidos,
              tri: etapa(v, null, 'triagem'), ent: etapa(v, null, 'entrevista'), doc: etapa(v, null, 'documentos') });
          }
        }
        linhas.sort((a, b) => (a.v.dataNecessidade || '9999').localeCompare(b.v.dataNecessidade || '9999') || a.v.titulo.localeCompare(b.v.titulo, 'pt-BR') || a.distrito.localeCompare(b.distrito, 'pt-BR'));
        const dataBR = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '';
        const situacao = r => r.pv ? r.pv.rotulo : (Store.STATUS_VAGA[r.v.status] || r.v.status);
        // resumo no topo (sai também no PDF): pedido x admitido (admitido conta até o pedido, local e móvel separados), em processo e previsão
        const tot = linhas.reduce((t, r) => { t.ped += r.pl + r.pm; t.adm += Math.min(r.al, r.pl) + Math.min(r.am, r.pm); t.proc += r.tri + r.ent + r.doc; t.doc += r.doc; return t; }, { ped: 0, adm: 0, proc: 0, doc: 0 });
        const pctT = tot.ped ? Math.round(100 * tot.adm / tot.ped) : 0;
        const resumo = vagas.length ? `<div class="in-rel-resumo">
            <div><b>${UI.fmtNum(vagas.length)}</b>${vagas.length === 1 ? 'vaga aprovada' : 'vagas aprovadas'}</div>
            <div><b>${UI.fmtNum(tot.adm)} de ${UI.fmtNum(tot.ped)}</b>contratados (${pctT}%)<i class="in-rel-barra"><i style="width:${tot.ped ? Math.max(1, pctT) : 0}%"></i></i></div>
            <div><b>${UI.fmtNum(Math.max(0, tot.ped - tot.adm))}</b>faltam contratar</div>
            <div><b>${UI.fmtNum(tot.proc)}</b>em processo · ${UI.fmtNum(tot.doc)} na documentação</div>
            <div><b><span class="in-txt-ok">${selos.no_prazo}</span> · <span class="in-txt-meio">${selos.risco}</span> · <span class="in-txt-ruim">${selos.nao_fecha}</span></b>no prazo · em risco · não fecha</div>
          </div>` : '';
        return {
          resumo,
          colunas: [
            { titulo: 'Cargo', render: r => `${UI.esc(r.v.titulo)}${r.v.projeto && !App.filtros.projetoId ? `<div class="muted small">${UI.esc(r.v.projeto.nome)}</div>` : ''}` },
            { titulo: 'Distrito', render: r => UI.esc(r.distrito) },
            { titulo: 'Pedido L/M', classe: 'direita', render: r => `${r.pl}/${r.pm}` },
            { titulo: 'Admitidos L/M', classe: 'direita', render: r => `<b>${r.al}/${r.am}</b>` },
            { titulo: 'Triagem', classe: 'direita', render: r => r.tri },
            { titulo: 'Entrevista', classe: 'direita', render: r => r.ent },
            { titulo: 'Documentação', classe: 'direita', render: r => r.doc },
            { titulo: 'Precisa até', render: r => dataBR(r.v.dataNecessidade) || '<span class="muted">—</span>' },
            { titulo: 'Dias aberta', classe: 'direita', render: r => r.v.diasAberta == null ? '—' : r.v.diasAberta },
            { titulo: 'RHs', render: r => UI.esc(r.rhs || '—') },
            { titulo: 'Previsão', render: r => r.pv ? `<span class="vg-selo vg-selo-${r.pv.selo}">${r.pv.rotulo}</span> <span class="muted small">${UI.esc(r.pv.frase)}</span>` : `<span class="muted">${UI.esc(situacao(r))}</span>` }
          ],
          linhas,
          csv: r => [r.v.titulo, r.v.projeto ? r.v.projeto.nome : '', r.distrito, r.pl, r.pm, r.al, r.am, r.tri, r.ent, r.doc, dataBR(r.v.dataNecessidade), r.v.diasAberta == null ? '' : r.v.diasAberta, r.rhs, situacao(r), r.pv ? r.pv.frase : ''],
          cabecalhoCsv: ['CARGO', 'PROJETO', 'DISTRITO', 'PEDIDO LOCAL', 'PEDIDO MOVEL', 'ADMITIDOS LOCAL', 'ADMITIDOS MOVEL', 'EM TRIAGEM', 'EM ENTREVISTA', 'EM DOCUMENTACAO', 'PRECISA ATE', 'DIAS ABERTA', 'RHS', 'PREVISAO', 'DETALHE DA PREVISAO'],
          nota: 'Vagas aprovadas (fora as canceladas). A previsão vale para a vaga inteira: prontos + quem está em processo × o quanto costuma chegar à admissão no projeto.',
          total: `${vagas.length === 1 ? '1 vaga' : vagas.length + ' vagas'}`
        };
      } },
      // Canais e indicações: de onde vieram os candidatos e até onde cada fonte chegou (sem dado pessoal);
      // a tabela de indicações (com nome) só para quem abre Candidatos
      { id: 'canais', nome: 'Canais e indicações', precisaAndamento: true, precisaIndicacoes: true, gerar: () => {
        let l = andamento || [];
        if (App.filtros.distritoId) l = l.filter(p => p.distrito_id === App.filtros.distritoId);
        if (App.filtros.tipo) l = l.filter(p => p.tipo === App.filtros.tipo);
        const NOMES = Object.fromEntries(Store.CANAIS.map(c => [c.id, c.nome]).concat([['indicacao', 'Indicação de colaborador'], ['ex_colaborador', 'Ex-colaborador'], ['outro', 'Outro'], ['', 'Não informado']]));
        const ORD = { triagem: 0, entrevista: 1, documentos: 2 };
        const grupos = new Map();
        for (const p of l) {
          const k = p.fonte || '';
          const g = grupos.get(k) || { fonte: k, nome: NOMES[k] || k, inscritos: 0, entrevista: 0, admitidos: 0, campo: 0 };
          g.inscritos++;
          if (p.situacao === 'admitido' || ORD[p.etapa] >= 1) g.entrevista++;
          if (p.situacao === 'admitido') g.admitidos++;
          if (p.chegada_status === 'chegou') g.campo++;
          grupos.set(k, g);
        }
        const linhas = [...grupos.values()].sort((a, b) => (a.fonte === '') - (b.fonte === '') || b.inscritos - a.inscritos || a.nome.localeCompare(b.nome, 'pt-BR'));
        const pct = (a, b) => b ? Math.round(100 * a / b) + '%' : '—';
        const total = linhas.reduce((t, g) => t + g.inscritos, 0);
        // indicações com nome (Candidatos): quem indicou → quem foi indicado e até onde chegou
        let extra = '';
        if (Store.pode(App.usuario, 'candidatos')) {
          if (!indicacoes) extra = '<div class="vazio">Carregando as indicações…</div>';
          else {
            let ind = indicacoes.filter(p => p.fonte === 'indicacao');
            if (App.filtros.distritoId) ind = ind.filter(p => p.distrito_id === App.filtros.distritoId);
            if (App.filtros.tipo) ind = ind.filter(p => p.tipo === App.filtros.tipo);
            ind.sort((a, b) => String(a.indicado_por || '').localeCompare(String(b.indicado_por || ''), 'pt-BR') || a.pessoa.nome.localeCompare(b.pessoa.nome, 'pt-BR'));
            const ETQ = { triagem: 'Triagem', entrevista: 'Entrevista', documentos: 'Documentação' };
            const sit = p => p.situacao === 'admitido' ? 'Admitido' : p.situacao === 'em_andamento' ? (ETQ[p.etapa] || p.etapa) : 'Não seguiu';
            extra = `<h3 style="margin:18px 0 8px">Indicações de colaboradores</h3>` + UI.tabela({ vazio: 'Nenhuma indicação marcada na ficha dos candidatos ("Como soube da vaga" → Indicação de colaborador).',
              colunas: [{ titulo: 'Indicado por', render: p => UI.esc(p.indicado_por || '—') }, { titulo: 'Candidato', render: p => UI.esc(p.pessoa.nome) },
                { titulo: 'Cargo', render: p => UI.esc(p.cargo || '—') }, { titulo: 'Situação', render: p => sit(p) },
                { titulo: 'Chegou ao campo', render: p => p.chegada_status === 'chegou' ? 'Sim' : p.chegada_status === 'faltou' ? 'Faltou' : '—' }],
              linhas: ind });
          }
        }
        return {
          colunas: [
            { titulo: 'Como soube da vaga', render: g => g.fonte ? UI.esc(g.nome) : `<span class="muted">${UI.esc(g.nome)}</span>` },
            { titulo: 'Inscritos', classe: 'direita', render: g => `<b>${UI.fmtNum(g.inscritos)}</b> <span class="muted small">${pct(g.inscritos, total)}</span>` },
            { titulo: 'Chegaram à entrevista', classe: 'direita', render: g => `${UI.fmtNum(g.entrevista)} <span class="muted small">${pct(g.entrevista, g.inscritos)}</span>` },
            { titulo: 'Admitidos', classe: 'direita', render: g => `${UI.fmtNum(g.admitidos)} <span class="muted small">${pct(g.admitidos, g.inscritos)}</span>` },
            { titulo: 'Chegaram ao campo', classe: 'direita', render: g => `${UI.fmtNum(g.campo)} <span class="muted small">${pct(g.campo, g.admitidos)}</span>` }
          ],
          linhas,
          csv: g => [g.nome, g.inscritos, g.entrevista, g.admitidos, g.campo],
          cabecalhoCsv: ['COMO SOUBE DA VAGA', 'INSCRITOS', 'CHEGARAM A ENTREVISTA', 'ADMITIDOS', 'CHEGARAM AO CAMPO'],
          nota: 'Pela resposta "Como soube da vaga" na ficha do candidato. As porcentagens: inscritos sobre o total; entrevista e admitidos sobre os inscritos; campo sobre os admitidos.',
          total: `${total === 1 ? '1 candidato' : UI.fmtNum(total) + ' candidatos'}`,
          extra
        };
      } },
      // Recrutamento por semana: candidaturas novas, admitidos (local/móvel) e chegadas marcadas, das últimas 12 semanas
      { id: 'semanal', nome: 'Recrutamento por semana', precisaAndamento: true, gerar: () => {
        const l = andamentoFiltrado();
        let sem = Analise.semanasRecrutamento(l, { hoje: RH.hoje(), n: 12 });
        const i0 = sem.findIndex(s => s.novos || s.admitidos || s.chegadas);
        sem = i0 < 0 ? [] : sem.slice(i0).reverse();   // a semana atual primeiro; sem as semanas vazias do começo
        const ind = Analise.indicadoresRecrutamento(l);
        const tot = sem.reduce((t, s) => { t.n += s.novos; t.a += s.admitidos; return t; }, { n: 0, a: 0 });
        const fechadas = sem.filter(s => !s.atual), media = fechadas.length ? fechadas.reduce((t, s) => t + s.admitidos, 0) / fechadas.length : null;
        const melhor = sem.slice().sort((a, b) => b.admitidos - a.admitidos)[0];
        const rot = s => `${RH.fmtDia(s.ini)} a ${RH.fmtDia(s.fim)}`;
        return {
          resumo: sem.length ? `<div class="in-rel-resumo">
              <div><b>${UI.fmtNum(tot.n)}</b>candidaturas novas no período</div>
              <div><b>${UI.fmtNum(tot.a)}</b>admitidos no período</div>
              <div><b>${media == null ? '—' : media.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</b>admitidos por semana (média das semanas fechadas)</div>
              <div><b>${melhor && melhor.admitidos ? rot(melhor) : '—'}</b>${melhor && melhor.admitidos ? `melhor semana: ${melhor.admitidos} ${melhor.admitidos === 1 ? 'admitido' : 'admitidos'}` : 'sem admissão no período'}</div>
              <div><b>${ind.diasAteAdmitir == null ? '—' : Math.round(ind.diasAteAdmitir) + ' d'}</b>da candidatura à admissão (mediana)</div>
            </div>` : '',
          colunas: [
            { titulo: 'Semana', render: s => `${rot(s)}${s.atual ? ' <span class="badge badge-azul">esta semana</span>' : ''}` },
            { titulo: 'Candidaturas novas', classe: 'direita', render: s => UI.fmtNum(s.novos) },
            { titulo: 'Admitidos local', classe: 'direita', render: s => UI.fmtNum(s.admLocal) },
            { titulo: 'Admitidos móvel', classe: 'direita', render: s => UI.fmtNum(s.admMovel) },
            { titulo: 'Admitidos', classe: 'direita', render: s => `<b>${UI.fmtNum(s.admitidos)}</b>` },
            { titulo: 'Chegadas marcadas', classe: 'direita', render: s => UI.fmtNum(s.chegadas) }
          ],
          linhas: sem,
          csv: s => [rot(s), s.novos, s.admLocal, s.admMovel, s.admitidos, s.chegadas],
          cabecalhoCsv: ['SEMANA', 'CANDIDATURAS NOVAS', 'ADMITIDOS LOCAL', 'ADMITIDOS MOVEL', 'ADMITIDOS', 'CHEGADAS MARCADAS'],
          nota: 'Semana de segunda a domingo, últimas 12. Candidaturas pela data do cadastro, admitidos pela data da admissão, chegadas pela data marcada.',
          total: `${sem.length === 1 ? '1 semana' : sem.length + ' semanas'}`
        };
      } },
      // Resultado por RH: em ordem alfabética (não é ranking), com a linha da equipe para comparar
      { id: 'porrh', nome: 'Resultado por RH', precisaAndamento: true, gerar: () => {
        const l = andamentoFiltrado();
        const linhas = Analise.resultadoPorRh(l, { hoje: RH.hoje() }).map(a => { const u = a.login && Store.usuarioPorLogin(a.login); return { ...a, nome: u ? u.nome : (a.nome || (a.login ? a.login : 'Sem RH responsável')) }; })
          .sort((a, b) => (a.login === '') - (b.login === '') || a.nome.localeCompare(b.nome, 'pt-BR'));
        const ind = Analise.indicadoresRecrutamento(l);
        const pc = x => x == null ? '—' : Math.round(100 * x) + '%', dd = x => x == null ? '—' : Math.round(x) + ' d';
        return {
          resumo: linhas.length ? `<div class="in-rel-resumo">
              <div><b>${UI.fmtNum(ind.total)}</b>candidatos da equipe</div>
              <div><b>${UI.fmtNum(ind.emProcesso)}</b>em processo agora</div>
              <div><b>${UI.fmtNum(ind.admitidos)}</b>admitidos</div>
              <div><b>${pc(ind.aproveitamento)}</b>aproveitamento da equipe</div>
              <div><b>${dd(ind.diasAteAdmitir)}</b>da candidatura à admissão (mediana)</div>
            </div>` : '',
          colunas: [
            { titulo: 'RH', render: a => a.login ? UI.esc(a.nome) : `<span class="muted">${UI.esc(a.nome)}</span>` },
            { titulo: 'Candidatos', classe: 'direita', render: a => UI.fmtNum(a.total) },
            { titulo: 'Em processo', classe: 'direita', render: a => UI.fmtNum(a.proc) },
            { titulo: 'Admitidos', classe: 'direita', render: a => `<b>${UI.fmtNum(a.adm)}</b>` },
            { titulo: 'Últimos 7 dias', classe: 'direita', render: a => UI.fmtNum(a.sem) },
            { titulo: 'Reprovados', classe: 'direita', render: a => UI.fmtNum(a.rep) },
            { titulo: 'Desistências', classe: 'direita', render: a => UI.fmtNum(a.des) },
            { titulo: 'Aproveitamento', classe: 'direita', render: a => a.encerrados < 5 && a.encerrados ? `${pc(a.aproveitamento)} <span class="muted small" title="Poucos casos encerrados: a porcentagem ainda muda muito">(${a.encerrados})</span>` : pc(a.aproveitamento) },
            { titulo: 'Até admitir', classe: 'direita', render: a => dd(a.dias) }
          ],
          linhas,
          csv: a => [a.nome, a.total, a.proc, a.adm, a.sem, a.rep, a.des, a.aproveitamento == null ? '' : Math.round(100 * a.aproveitamento), a.dias == null ? '' : Math.round(a.dias)],
          cabecalhoCsv: ['RH', 'CANDIDATOS', 'EM PROCESSO', 'ADMITIDOS', 'ADMITIDOS 7 DIAS', 'REPROVADOS', 'DESISTENCIAS', 'APROVEITAMENTO %', 'DIAS ATE ADMITIR (MEDIANA)'],
          nota: 'Em ordem alfabética. Aproveitamento = admitidos ÷ quem já encerrou (admitido, reprovado ou desistiu); com menos de 5 casos, o número entre parênteses lembra que ainda muda muito. Quem recebe vaga mais difícil tende a ter número menor: compare com os números da equipe, no topo.',
          total: `${linhas.filter(a => a.login).length === 1 ? '1 RH' : linhas.filter(a => a.login).length + ' RHs'}`
        };
      } },
      // Saídas: por que e em que etapa as pessoas saíram do processo (reprovados e desistências)
      { id: 'saidas', nome: 'Saídas por etapa e motivo', precisaAndamento: true, gerar: () => {
        const l = andamentoFiltrado();
        const linhas = Analise.saidasPorMotivo(l), ind = Analise.indicadoresRecrutamento(l);
        const pc = x => x == null ? '—' : Math.round(100 * x) + '%';
        const ETQ = { triagem: 'triagem', entrevista: 'entrevista', documentos: 'documentação' };
        const semMotivo = (linhas.find(a => a.motivo === 'não informado') || {}).total || 0, saidas = ind.reprovados + ind.desistencias;
        return {
          resumo: saidas ? `<div class="in-rel-resumo">
              <div><b>${UI.fmtNum(saidas)}</b>${saidas === 1 ? 'pessoa saiu' : 'pessoas saíram'} do processo</div>
              <div><b>${pc(ind.desistencia)}</b>desistência · ${UI.fmtNum(ind.desistencias)} de ${UI.fmtNum(ind.encerrados)} que encerraram</div>
              <div><b>${ind.etapaQueMaisDesiste ? ETQ[ind.etapaQueMaisDesiste] : '—'}</b>etapa em que mais desistem</div>
              <div><b>${pc(ind.comparecimento)}</b>chegaram ao campo · ${UI.fmtNum(ind.faltou)} ${ind.faltou === 1 ? 'faltou' : 'faltaram'}</div>
              <div><b class="${semMotivo ? 'in-txt-meio' : ''}">${UI.fmtNum(semMotivo)}</b>sem motivo informado</div>
            </div>` : '',
          colunas: [
            { titulo: 'Motivo', render: a => a.motivo === 'não informado' ? '<span class="muted">Não informado</span>' : UI.esc(a.motivo) },
            { titulo: 'Na triagem', classe: 'direita', render: a => UI.fmtNum(a.triagem) },
            { titulo: 'Na entrevista', classe: 'direita', render: a => UI.fmtNum(a.entrevista) },
            { titulo: 'Na documentação', classe: 'direita', render: a => UI.fmtNum(a.documentos) },
            { titulo: 'Reprovados', classe: 'direita', render: a => UI.fmtNum(a.rep) },
            { titulo: 'Desistências', classe: 'direita', render: a => UI.fmtNum(a.des) },
            { titulo: 'Total', classe: 'direita', render: a => `<b>${UI.fmtNum(a.total)}</b>` },
            { titulo: '% das saídas', classe: 'direita', render: a => UI.fmtPct(a.pct) }
          ],
          linhas,
          csv: a => [a.motivo, a.triagem, a.entrevista, a.documentos, a.rep, a.des, a.total, a.pct.toFixed(1)],
          cabecalhoCsv: ['MOTIVO', 'NA TRIAGEM', 'NA ENTREVISTA', 'NA DOCUMENTACAO', 'REPROVADOS', 'DESISTENCIAS', 'TOTAL', '% DAS SAIDAS'],
          nota: 'Quem saiu fica contado na etapa em que estava. O motivo vem do "Não segue" em Candidatos.',
          total: `${saidas === 1 ? '1 saída' : UI.fmtNum(saidas) + ' saídas'}`
        };
      } },
      { id: 'mes', nome: 'Cadastros por mês', gerar: (regs) => ({
        colunas: [{ titulo: 'Mês', render: r => Analise.rotuloMes(r.mes) }, ...colLM],
        linhas: Analise.porMes(regs),
        csv: r => [Analise.rotuloMes(r.mes), r.local, r.movel, r.total],
        cabecalhoCsv: ['MES', 'LOCAL', 'MOVEL', 'TOTAL'],
        nota: 'Considera a data em que cada contratação foi cadastrada no sistema.'
      }) }
    ];

    // planilha do Excel (biblioteca XLSX já carregada no index): título e filtro no topo, números como número,
    // colunas na largura do conteúdo e filtro no cabeçalho. Sem a biblioteca (sem internet), cai para o CSV.
    function baixarPlanilha(nome, titulo, cab, linhas) {
      if (typeof XLSX === 'undefined') { UI.baixarCSV(nome + '.csv', [cab].concat(linhas)); return; }
      const num = v => typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim()) && !/^0\d/.test(v.trim()) ? Number(v) : (v == null ? '' : v);
      const corpo = linhas.map(r => r.map(num));
      const topo = [[`Safra RH — ${titulo}`], [`${App.descricaoFiltro()} · gerado em ${UI.fmtDataHora(new Date().toISOString())}`], []];
      const ws = XLSX.utils.aoa_to_sheet(topo.concat([cab], corpo));
      ws['!cols'] = cab.map((c, i) => { let m = String(c).length; for (const r of corpo) { const t = String(r[i] == null ? '' : r[i]).length; if (t > m) m = t; } return { wch: Math.min(48, m + 2) }; });
      ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: topo.length, c: 0 }, e: { r: topo.length + corpo.length, c: cab.length - 1 } }) };
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, titulo.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
      XLSX.writeFile(wb, nome + '.xlsx');
    }

    let atual = localStorage.getItem('maparh:relatorio') || 'origem';
    if (!RELATORIOS.some(r => r.id === atual)) atual = 'origem';

    el.innerHTML = `
      <div class="relatorios-layout">
        <div class="card lista-relatorios nao-imprimir" style="padding:8px">${[['Recrutamento', RELATORIOS.filter(r => r.precisaAndamento)], ['Contratações', RELATORIOS.filter(r => !r.precisaAndamento)]]
          .map(([g, rs]) => `<div class="in-rel-grupo"><span>${g}</span>${rs.map(r => `<a href="#" data-id="${r.id}">${UI.esc(r.nome)}</a>`).join('')}</div>`).join('')}</div>
        <div class="card" id="rel-conteudo"></div>
      </div>`;
    el.querySelectorAll('.lista-relatorios a').forEach(a => a.addEventListener('click', e => { e.preventDefault(); atual = a.dataset.id; localStorage.setItem('maparh:relatorio', atual); renderRelatorio(); }));

    function renderRelatorio() {
      el.querySelectorAll('.lista-relatorios a').forEach(a => a.classList.toggle('ativo', a.dataset.id === atual));
      const rel = RELATORIOS.find(r => r.id === atual);
      const regs = App.regs();
      const cont = el.querySelector('#rel-conteudo');
      // relatório que usa o andamento dos candidatos: busca uma vez no banco e redesenha
      if (rel.precisaAndamento && andamento === null) {
        if (typeof Nuvem === 'undefined' || !Nuvem.ativa || !Nuvem.rh || !Nuvem.rh.andamento) { andamento = []; }
        else {
          cont.innerHTML = `<h2 style="margin:0">${UI.esc(rel.nome)}</h2><div class="vazio">Carregando o andamento dos candidatos…</div>`;
          Nuvem.rh.andamento(App.filtros.projetoId).then(l => { andamento = l || []; }).catch(() => { andamento = []; UI.toast('Não foi possível carregar o andamento dos candidatos.', 'erro'); })
            .then(() => { if (document.body.contains(cont) && atual === rel.id) renderRelatorio(); });
          return;
        }
      }
      // indicações com nome: lista dos candidatos do projeto do filtro (ou de todos os projetos visíveis), uma vez
      if (rel.precisaIndicacoes && indicacoes === null && Store.pode(App.usuario, 'candidatos') && typeof Nuvem !== 'undefined' && Nuvem.ativa && Nuvem.rh) {
        indicacoes = undefined;   // buscando
        const pids = App.filtros.projetoId ? [App.filtros.projetoId] : App.projetosVisiveis().map(p => p.id);
        Promise.all(pids.map(id => Nuvem.rh.listar(id).catch(() => []))).then(ls => { indicacoes = ls.flat(); })
          .then(() => { if (document.body.contains(cont) && atual === rel.id) renderRelatorio(); });
      }
      const dados = rel.gerar(regs);
      cont.innerHTML = `
        <div class="cabecalho-impressao"><h2>Safra RH — ${UI.esc(rel.nome)}</h2><div class="muted">${UI.esc(App.descricaoFiltro())} · gerado em ${UI.fmtDataHora(new Date().toISOString())}</div></div>
        <div class="card-titulo nao-imprimir">
          <div><h2 style="margin:0">${UI.esc(rel.nome)}</h2><div class="muted small">${UI.esc(App.descricaoFiltro())} · ${dados.total || UI.fmtNum(regs.length) + ' contratação(ões)'}${dados.nota ? ' · ' + UI.esc(dados.nota) : ''}</div></div>
          <div class="linha"><button class="btn btn-pequeno btn-primario" id="rel-xlsx" title="Planilha do Excel, com título, filtro e colunas no tamanho certo">Planilha (Excel)</button><button class="btn btn-pequeno" id="rel-csv" title="Arquivo de texto separado por ponto e vírgula">CSV</button><button class="btn btn-pequeno" id="rel-imprimir">Imprimir / PDF</button></div>
        </div>
        ${dados.resumo || ''}
        ${UI.tabela({ colunas: dados.colunas, linhas: dados.linhas, vazio: rel.id === 'vagas' ? 'Nenhuma vaga aprovada para o filtro atual. Vagas aguardando aprovação ou canceladas não entram neste relatório.' : 'Nenhum dado para o filtro atual.' })}${dados.extra || ''}`;
      cont.querySelector('#rel-csv').addEventListener('click', () => {
        UI.baixarCSV(`relatorio-${rel.id}.csv`, [dados.cabecalhoCsv].concat(dados.linhas.map(dados.csv)));
        Store.auditar('relatorio.exportar', rel.nome, App.usuario);
      });
      cont.querySelector('#rel-xlsx').addEventListener('click', () => {
        if (!dados.linhas.length) { UI.toast('Nada para exportar com o filtro atual.', 'aviso'); return; }
        baixarPlanilha(`relatorio-${rel.id}-${RH.hoje()}`, rel.nome, dados.cabecalhoCsv, dados.linhas.map(dados.csv));
        Store.auditar('relatorio.exportar', rel.nome + ' (planilha)', App.usuario);
      });
      cont.querySelector('#rel-imprimir').addEventListener('click', () => window.print());
    }
    renderRelatorio();
  }
};
