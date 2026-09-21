// Cálculos usados por dashboard, mapa e relatórios. Recebe registros já "enriquecidos" (Store.registrosFiltrados):
// { tipo, cidade (origem), cidadeAtuacao | null, atuacaoMovel, distancia, foraDoEstado, projeto }
const Analise = (() => {
  const media = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const pct = (parte, total) => total ? (parte / total) * 100 : 0;
  const ROTULO_MOVEL = 'MÓVEL — todo o estado';

  function resumo(regs) {
    const total = regs.length;
    const local = regs.filter(r => r.tipo === 'LOCAL').length;
    const movel = total - local;
    const dist = regs.map(r => r.distancia).filter(d => d != null);
    const atuacaoMovel = regs.filter(r => r.atuacaoMovel).length;
    const foraDoEstado = regs.filter(r => r.foraDoEstado).length;
    const mesmaCidade = regs.filter(r => r.cidadeAtuacao && r.cidadeAtuacao.id === r.cidade.id).length;
    return {
      total, local, movel, pctLocal: pct(local, total), pctMovel: pct(movel, total),
      cidadesOrigem: new Set(regs.map(r => r.cidadeId)).size,
      ufsOrigem: new Set(regs.map(r => r.cidade.uf)).size,
      cidadesAtuacao: new Set(regs.filter(r => r.cidadeAtuacao).map(r => r.cidadeAtuacao.id)).size,
      projetos: new Set(regs.map(r => r.projetoId)).size,
      atuacaoMovel, pctAtuacaoMovel: pct(atuacaoMovel, total),
      foraDoEstado, pctForaDoEstado: pct(foraDoEstado, total),
      mesmaCidade, pctMesmaCidade: pct(mesmaCidade, total),
      distMedia: media(dist), distMax: dist.length ? Math.max(...dist) : null
    };
  }

  function porCidadeOrigem(regs) {
    const mapa = new Map();
    for (const r of regs) {
      let it = mapa.get(r.cidadeId);
      if (!it) { it = { cidade: r.cidade, local: 0, movel: 0, total: 0, atuacaoMovel: 0, dists: [], atuacoes: new Set(), projetos: new Set(), foraDoEstado: r.foraDoEstado }; mapa.set(r.cidadeId, it); }
      it[r.tipo === 'LOCAL' ? 'local' : 'movel']++; it.total++;
      if (r.atuacaoMovel) it.atuacaoMovel++; else it.atuacoes.add(r.cidadeAtuacao.id);
      if (r.distancia != null) it.dists.push(r.distancia);
      it.projetos.add(r.projetoId);
    }
    const total = regs.length;
    return [...mapa.values()].map(it => ({ cidade: it.cidade, local: it.local, movel: it.movel, total: it.total, atuacaoMovel: it.atuacaoMovel,
      pct: pct(it.total, total), distMedia: media(it.dists), atuacoes: it.atuacoes.size, projetos: it.projetos.size, foraDoEstado: it.foraDoEstado }))
      .sort((a, b) => b.total - a.total || a.cidade.nome.localeCompare(b.cidade.nome, 'pt-BR'));
  }

  // Cidades de atuação; a linha especial "MÓVEL — todo o estado" agrupa quem pode ir a qualquer lugar do estado.
  function porCidadeAtuacao(regs) {
    const mapa = new Map();
    for (const r of regs) {
      const chave = r.atuacaoMovel ? 'MOVEL:' + r.projeto.uf : r.cidadeAtuacao.id;
      let it = mapa.get(chave);
      if (!it) {
        it = { chave, cidade: r.cidadeAtuacao, movelEstado: r.atuacaoMovel, uf: r.atuacaoMovel ? r.projeto.uf : r.cidadeAtuacao.uf,
          rotulo: r.atuacaoMovel ? `${ROTULO_MOVEL} (${r.projeto.uf})` : `${r.cidadeAtuacao.nome}/${r.cidadeAtuacao.uf}`,
          local: 0, movel: 0, total: 0, origens: new Set(), foraDoEstado: 0, dists: [], projetos: new Set() };
        mapa.set(chave, it);
      }
      it[r.tipo === 'LOCAL' ? 'local' : 'movel']++; it.total++;
      it.origens.add(r.cidadeId); if (r.foraDoEstado) it.foraDoEstado++;
      if (r.distancia != null) it.dists.push(r.distancia);
      it.projetos.add(r.projetoId);
    }
    const total = regs.length;
    return [...mapa.values()].map(it => ({ ...it, origens: it.origens.size, projetos: it.projetos.size, pct: pct(it.total, total), distMedia: media(it.dists) }))
      .sort((a, b) => b.total - a.total);
  }

  function porProjeto(regs, projetos) {
    return projetos.map(p => {
      const rs = regs.filter(r => r.projetoId === p.id);
      const local = rs.filter(r => r.tipo === 'LOCAL').length;
      const dists = rs.map(r => r.distancia).filter(d => d != null);
      return { projeto: p, total: rs.length, local, movel: rs.length - local, pctLocal: pct(local, rs.length),
        cidadesOrigem: new Set(rs.map(r => r.cidadeId)).size,
        ufsOrigem: new Set(rs.map(r => r.cidade.uf)).size,
        cidadesAtuacao: new Set(rs.filter(r => r.cidadeAtuacao).map(r => r.cidadeAtuacao.id)).size,
        atuacaoMovel: rs.filter(r => r.atuacaoMovel).length,
        foraDoEstado: rs.filter(r => r.foraDoEstado).length,
        distMedia: media(dists) };
    }).sort((a, b) => (b.projeto.ano || 0) - (a.projeto.ano || 0) || b.total - a.total);
  }

  function porAno(regs) {
    const mapa = new Map();
    for (const r of regs) {
      const ano = r.projeto.ano || 'sem ano';
      let it = mapa.get(ano);
      if (!it) { it = { ano, local: 0, movel: 0, total: 0, cidadesOrigem: new Set(), ufsOrigem: new Set(), foraDoEstado: 0, atuacaoMovel: 0, projetos: new Set() }; mapa.set(ano, it); }
      it[r.tipo === 'LOCAL' ? 'local' : 'movel']++; it.total++;
      it.cidadesOrigem.add(r.cidadeId); it.ufsOrigem.add(r.cidade.uf); it.projetos.add(r.projetoId);
      if (r.foraDoEstado) it.foraDoEstado++; if (r.atuacaoMovel) it.atuacaoMovel++;
    }
    return [...mapa.values()].map(it => ({ ...it, cidadesOrigem: it.cidadesOrigem.size, ufsOrigem: it.ufsOrigem.size, projetos: it.projetos.size }))
      .sort((a, b) => String(a.ano).localeCompare(String(b.ano)));
  }

  // Contratações por microrregião da cidade de atuação (base, no caso de MÓVEL).
  // Linhas especiais: "MÓVEL — todo o estado" e "Fora das microrregiões" (atuação em cidade sem microrregião cadastrada).
  function porMicro(regs) {
    const mapa = new Map();
    for (const r of regs) {
      let chave, nome, distrito = '', cor, micro = null, ordem = 0;
      if (r.atuacaoMovel) { chave = 'MOVEL:' + r.projeto.uf; nome = `${ROTULO_MOVEL} (${r.projeto.uf})`; cor = '#7c3aed'; ordem = 1; }
      else {
        const info = Store.corDaCidade(r.cidadeAtuacao.id);
        if (info && info.micro) { chave = info.micro.id; nome = info.micro.nome; distrito = info.distrito.nome; cor = info.cor; micro = info.micro; }
        else { chave = 'FORA'; nome = 'Fora das microrregiões'; cor = '#94a3b8'; ordem = 2; }
      }
      let it = mapa.get(chave);
      if (!it) {
        it = { chave, micro, nome, distrito, cor, ordem, local: 0, movel: 0, total: 0, cidadesAtuacao: new Set(), cidadesOrigem: new Set(), foraDoEstado: 0, propria: 0, dists: [] };
        mapa.set(chave, it);
      }
      it[r.tipo === 'LOCAL' ? 'local' : 'movel']++; it.total++;
      if (r.cidadeAtuacao) it.cidadesAtuacao.add(r.cidadeAtuacao.id);
      it.cidadesOrigem.add(r.cidadeId);
      if (r.foraDoEstado) it.foraDoEstado++;
      if (micro && (micro.cidadeIds || []).includes(r.cidadeId)) it.propria++;
      if (r.distancia != null) it.dists.push(r.distancia);
    }
    const total = regs.length;
    return [...mapa.values()].map(it => ({ ...it, cidadesAtuacao: it.cidadesAtuacao.size, cidadesOrigem: it.cidadesOrigem.size,
      pct: pct(it.total, total), pctPropria: pct(it.propria, it.total), distMedia: media(it.dists) }))
      .sort((a, b) => a.ordem - b.ordem || b.total - a.total);
  }

  function porUF(regs) {
    const mapa = new Map();
    for (const r of regs) {
      const uf = r.cidade.uf;
      let it = mapa.get(uf);
      if (!it) { it = { uf, nome: Store.UFS[uf] || uf, local: 0, movel: 0, total: 0, cidades: new Set(), foraDoEstado: uf !== r.projeto.uf }; mapa.set(uf, it); }
      it[r.tipo === 'LOCAL' ? 'local' : 'movel']++; it.total++; it.cidades.add(r.cidadeId);
    }
    const total = regs.length;
    return [...mapa.values()].map(it => ({ ...it, cidades: it.cidades.size, pct: pct(it.total, total) }))
      .sort((a, b) => b.total - a.total);
  }

  const FAIXAS = [
    { rotulo: ROTULO_MOVEL, teste: (r) => r.atuacaoMovel },
    { rotulo: 'Mesma cidade de atuação', teste: (r) => r.cidadeAtuacao && r.cidade.id === r.cidadeAtuacao.id },
    { rotulo: 'Até 50 km', teste: (r) => r.distancia != null && r.distancia <= 50 },
    { rotulo: '50 a 150 km', teste: (r) => r.distancia != null && r.distancia <= 150 },
    { rotulo: '150 a 500 km', teste: (r) => r.distancia != null && r.distancia <= 500 },
    { rotulo: 'Mais de 500 km', teste: () => true }
  ];
  function faixasDistancia(regs) {
    const res = FAIXAS.map(f => ({ faixa: f.rotulo, local: 0, movel: 0, total: 0 }));
    for (const r of regs) {
      const i = FAIXAS.findIndex(f => f.teste(r));
      res[i][r.tipo === 'LOCAL' ? 'local' : 'movel']++; res[i].total++;
    }
    const total = regs.length;
    return res.map(x => ({ ...x, pct: pct(x.total, total) }));
  }

  // Fluxos atuação -> cidade de origem (um por projeto + atuação + origem).
  function fluxos(regs) {
    const mapa = new Map();
    for (const r of regs) {
      const k = r.projetoId + '|' + (r.atuacaoMovel ? 'MOVEL' : r.cidadeAtuacao.id) + '|' + r.cidadeId;
      let it = mapa.get(k);
      if (!it) {
        it = { projeto: r.projeto, cidadeAtuacao: r.cidadeAtuacao, atuacaoMovel: r.atuacaoMovel, uf: r.projeto.uf, cidadeOrigem: r.cidade,
          local: 0, movel: 0, total: 0, dist: r.distancia, foraDoEstado: r.foraDoEstado };
        mapa.set(k, it);
      }
      it[r.tipo === 'LOCAL' ? 'local' : 'movel']++; it.total++;
    }
    return [...mapa.values()].sort((a, b) => b.total - a.total);
  }
  const rotuloAtuacao = f => f.atuacaoMovel ? `${ROTULO_MOVEL} (${f.uf})` : `${f.cidadeAtuacao.nome}/${f.cidadeAtuacao.uf}`;

  function porMes(regs) {
    const mapa = new Map();
    for (const r of regs) {
      const m = (r.criadoEm || '').slice(0, 7);
      if (!m) continue;
      let it = mapa.get(m);
      if (!it) { it = { mes: m, local: 0, movel: 0, total: 0 }; mapa.set(m, it); }
      it[r.tipo === 'LOCAL' ? 'local' : 'movel']++; it.total++;
    }
    return [...mapa.values()].sort((a, b) => a.mes.localeCompare(b.mes));
  }
  function rotuloMes(m) {
    const [a, mes] = m.split('-');
    const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return nomes[parseInt(mes, 10) - 1] + '/' + a.slice(2);
  }

  return { ROTULO_MOVEL, resumo, porCidadeOrigem, porCidadeAtuacao, porMicro, porProjeto, porAno, porUF, faixasDistancia, fluxos, rotuloAtuacao, porMes, rotuloMes };
})();
