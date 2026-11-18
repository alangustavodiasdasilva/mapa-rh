// Cálculos usados por dashboard, mapa e relatórios. Recebe registros já "enriquecidos" (Store.registrosFiltrados):
// { tipo, cidade (origem), cidadeAtuacao | null, atuacaoMovel, distancia, foraDoEstado, projeto }
const Analise = (() => {
  const media = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const pct = (parte, total) => total ? (parte / total) * 100 : 0;
  const ROTULO_MOVEL = 'Sem cidade definida (todo o estado)';
  // Estados do projeto juntos (ex.: "PR/RS/SC"): o MÓVEL legado vale para todos eles, não só para o estado principal
  const ufsMovel = p => (Store.ufsProjeto(p).join('/') || (p && p.uf) || '');
  // registro MÓVEL que tem base de contratação (a cidade de atuação mostrada é a base)
  const ehBase = r => !!(r.cidadeBase && Store.ehMovel(r.atuacao));

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
      const chave = r.atuacaoMovel ? 'MOVEL:' + ufsMovel(r.projeto) : r.cidadeAtuacao.id;
      let it = mapa.get(chave);
      if (!it) {
        it = { chave, cidade: r.cidadeAtuacao, movelEstado: r.atuacaoMovel, uf: r.atuacaoMovel ? ufsMovel(r.projeto) : r.cidadeAtuacao.uf,
          rotulo: r.atuacaoMovel ? `${ROTULO_MOVEL} — ${ufsMovel(r.projeto)}` : `${r.cidadeAtuacao.nome}/${r.cidadeAtuacao.uf}`,
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
      if (r.atuacaoMovel) { chave = 'MOVEL:' + ufsMovel(r.projeto); nome = `${ROTULO_MOVEL} — ${ufsMovel(r.projeto)}`; cor = '#7c3aed'; ordem = 1; }
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
      if (!it) { it = { uf, nome: Store.UFS[uf] || uf, local: 0, movel: 0, total: 0, cidades: new Set(), foraDoEstado: !Store.ufDoProjeto(r.projeto, uf) }; mapa.set(uf, it); }
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
        // uf: no MÓVEL legado são todos os estados do projeto ("PR/RS/SC"); base: quantos têm a cidade como base de contratação
        it = { projeto: r.projeto, cidadeAtuacao: r.cidadeAtuacao, atuacaoMovel: r.atuacaoMovel, uf: r.atuacaoMovel ? ufsMovel(r.projeto) : r.projeto.uf, cidadeOrigem: r.cidade,
          local: 0, movel: 0, total: 0, base: 0, dist: r.distancia, foraDoEstado: r.foraDoEstado };
        mapa.set(k, it);
      }
      it[r.tipo === 'LOCAL' ? 'local' : 'movel']++; it.total++;
      if (ehBase(r)) it.base++;
    }
    return [...mapa.values()].sort((a, b) => b.total - a.total);
  }
  const rotuloAtuacao = f => f.atuacaoMovel ? `${ROTULO_MOVEL} — ${f.uf}` : `${f.cidadeAtuacao.nome}/${f.cidadeAtuacao.uf}`;

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

  // ---------- Recrutamento: contas sobre o andamento dos candidatos (Nuvem.rh.andamento, sem dado pessoal) ----------
  // { situacao, etapa, tipo, analista_login, criado_em, admitido_em, chegada_data, chegada_status, fonte, motivo_saida }
  const DIA_MS = 86400000;
  const isoLocal = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  // dia (aaaa-mm-dd) de uma data ou de um carimbo com hora (no fuso do computador)
  const diaDe = ts => { if (!ts) return ''; const s = String(ts); if (s.length <= 10) return s; const d = new Date(s); return isNaN(d) ? s.slice(0, 10) : isoLocal(d); };
  const somaDias = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const segundaDe = iso => somaDias(iso, -((new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7));
  const hojeIso = () => isoLocal(new Date());
  const medianaDe = l => { if (!l.length) return null; const s = l.slice().sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const encerrou = p => p.situacao === 'admitido' || p.situacao === 'reprovado' || p.situacao === 'desistiu';

  // As últimas n semanas (segunda a domingo), a atual por último: candidaturas novas, admitidos e chegadas marcadas
  function semanasRecrutamento(andamento, { hoje = hojeIso(), n = 8 } = {}) {
    const seg0 = segundaDe(hoje), lista = [], idx = new Map();
    for (let i = n - 1; i >= 0; i--) {
      const ini = somaDias(seg0, -7 * i), s = { ini, fim: somaDias(ini, 6), atual: i === 0, novos: 0, admitidos: 0, admLocal: 0, admMovel: 0, chegadas: 0 };
      lista.push(s); idx.set(ini, s);
    }
    const da = d => d ? idx.get(segundaDe(d)) : null;
    for (const p of andamento || []) {
      const sn = da(diaDe(p.criado_em)); if (sn) sn.novos++;
      if (p.situacao === 'admitido') { const sa = da(diaDe(p.admitido_em)); if (sa) { sa.admitidos++; sa[p.tipo === 'MOVEL' ? 'admMovel' : 'admLocal']++; } }
      if (p.chegada_data && (p.situacao === 'admitido' || p.situacao === 'em_andamento')) { const sc = da(diaDe(p.chegada_data)); if (sc) sc.chegadas++; }
    }
    return lista;
  }

  // Quantas admissões por semana são precisas para fechar o que falta até o prazo, contra o ritmo dos últimos 14 dias.
  // situacao: completo | sem_prazo | vencido | no_ritmo | atencao | fora
  function ritmoNecessario({ faltam, prazo, adm14 = 0, hoje = hojeIso() }) {
    const atual = adm14 / 2;
    if (!faltam) return { situacao: 'completo', atual, precisa: 0, semanas: 0 };
    if (!prazo) return { situacao: 'sem_prazo', atual, precisa: null, semanas: null };
    const dias = Math.round((new Date(prazo + 'T12:00:00Z') - new Date(hoje + 'T12:00:00Z')) / DIA_MS);
    if (dias < 0) return { situacao: 'vencido', atual, precisa: null, semanas: 0, dias };
    const semanas = Math.max(1, dias) / 7, precisa = faltam / semanas;   // semanas quebradas: bate com a previsão de fechamento
    return { situacao: atual >= precisa ? 'no_ritmo' : atual >= precisa * 0.6 ? 'atencao' : 'fora', atual, precisa, semanas, dias };
  }

  // Indicadores do processo: aproveitamento, desistência (e em que etapa) e comparecimento na chegada ao campo
  function indicadoresRecrutamento(andamento) {
    const l = andamento || [], fim = l.filter(encerrou);
    const adm = fim.filter(p => p.situacao === 'admitido').length, des = fim.filter(p => p.situacao === 'desistiu'), rep = fim.length - adm - des.length;
    const desEtapa = { triagem: 0, entrevista: 0, documentos: 0 };
    for (const p of des) if (desEtapa[p.etapa] != null) desEtapa[p.etapa]++;
    const pior = Object.entries(desEtapa).sort((a, b) => b[1] - a[1])[0];
    const chegou = l.filter(p => p.chegada_status === 'chegou').length, faltou = l.filter(p => p.chegada_status === 'faltou').length;
    const tempos = l.filter(p => p.situacao === 'admitido' && p.criado_em && p.admitido_em)
      .map(p => Math.round((new Date(diaDe(p.admitido_em) + 'T12:00:00Z') - new Date(diaDe(p.criado_em) + 'T12:00:00Z')) / DIA_MS)).filter(x => !isNaN(x) && x >= 0);
    return { total: l.length, encerrados: fim.length, admitidos: adm, reprovados: rep, desistencias: des.length, emProcesso: l.length - fim.length,
      aproveitamento: fim.length ? adm / fim.length : null, desistencia: fim.length ? des.length / fim.length : null,
      desEtapa, etapaQueMaisDesiste: pior && pior[1] ? pior[0] : null,
      chegou, faltou, comparecimento: chegou + faltou ? chegou / (chegou + faltou) : null,
      diasAteAdmitir: medianaDe(tempos), nTempos: tempos.length };
  }

  // De onde vêm: por "Como soube da vaga", quantos se candidataram, chegaram à entrevista e foram admitidos
  function canaisRecrutamento(andamento, nomes = {}) {
    const ORD = { triagem: 0, entrevista: 1, documentos: 2 }, g = new Map();
    for (const p of andamento || []) {
      const k = p.fonte || '';
      const a = g.get(k) || { fonte: k, nome: nomes[k] || k || 'Não informado', inscritos: 0, entrevista: 0, admitidos: 0, campo: 0 };
      a.inscritos++;
      if (p.situacao === 'admitido' || ORD[p.etapa] >= 1) a.entrevista++;
      if (p.situacao === 'admitido') a.admitidos++;
      if (p.chegada_status === 'chegou') a.campo++;
      g.set(k, a);
    }
    return [...g.values()].map(a => ({ ...a, conversao: a.inscritos ? a.admitidos / a.inscritos : 0 }))
      .sort((a, b) => (a.fonte === '') - (b.fonte === '') || b.admitidos - a.admitidos || b.inscritos - a.inscritos || a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  // Resultado por RH (chave: login; sem RH fica em ''): volume, aproveitamento, admitidos em 7 dias e tempo até admitir
  function resultadoPorRh(andamento, { hoje = hojeIso() } = {}) {
    const g = new Map(), d7 = somaDias(hoje, -7);
    for (const p of andamento || []) {
      const k = p.analista_login || '';
      const a = g.get(k) || { login: k, nome: p.analista || '', total: 0, proc: 0, adm: 0, rep: 0, des: 0, sem: 0, tempos: [] };
      if (!a.nome && p.analista) a.nome = p.analista;
      a.total++;
      if (p.situacao === 'admitido') {
        a.adm++; const d = diaDe(p.admitido_em);
        if (d > d7 && d <= hoje) a.sem++;
        if (d && p.criado_em) { const t = Math.round((new Date(d + 'T12:00:00Z') - new Date(diaDe(p.criado_em) + 'T12:00:00Z')) / DIA_MS); if (!isNaN(t) && t >= 0) a.tempos.push(t); }
      } else if (p.situacao === 'desistiu') a.des++; else if (p.situacao === 'reprovado') a.rep++; else a.proc++;
      g.set(k, a);
    }
    return [...g.values()].map(a => { const enc = a.adm + a.rep + a.des; return { ...a, encerrados: enc, aproveitamento: enc ? a.adm / enc : null, dias: medianaDe(a.tempos) }; });
  }

  // Saídas (reprovados e desistências) por motivo, com a etapa em que saíram
  function saidasPorMotivo(andamento) {
    const g = new Map();
    for (const p of andamento || []) {
      if (p.situacao !== 'reprovado' && p.situacao !== 'desistiu') continue;
      const k = (p.motivo_saida || '').trim() || 'não informado';
      const a = g.get(k) || { motivo: k, triagem: 0, entrevista: 0, documentos: 0, rep: 0, des: 0, total: 0 };
      if (a[p.etapa] != null) a[p.etapa]++;
      a[p.situacao === 'desistiu' ? 'des' : 'rep']++; a.total++;
      g.set(k, a);
    }
    const tot = [...g.values()].reduce((t, a) => t + a.total, 0);
    return [...g.values()].map(a => ({ ...a, pct: pct(a.total, tot) })).sort((a, b) => b.total - a.total || a.motivo.localeCompare(b.motivo, 'pt-BR'));
  }

  // Safra passada: os projetos do ano anterior mais próximo, nos mesmos estados dos projetos atuais (para comparar
  // as contratações). Devolve { ano, projetos } ou null se não há.
  function safraAnterior(atuais, projetos) {
    atuais = (atuais || []).filter(p => p && p.ano);
    if (!atuais.length) return null;
    const ano = Math.max(...atuais.map(p => +p.ano)), ufs = new Set(atuais.flatMap(p => Store.ufsProjeto(p))), ids = new Set(atuais.map(p => p.id));
    const cand = (projetos || []).filter(p => !ids.has(p.id) && p.ano && +p.ano < ano && Store.ufsProjeto(p).some(u => ufs.has(u)));
    if (!cand.length) return null;
    const anoAnt = Math.max(...cand.map(p => +p.ano));
    return { ano: anoAnt, anoAtual: ano, projetos: cand.filter(p => +p.ano === anoAnt) };
  }

  return { semanasRecrutamento, ritmoNecessario, indicadoresRecrutamento, canaisRecrutamento, resultadoPorRh, saidasPorMotivo, safraAnterior, ROTULO_MOVEL, ufsMovel, ehBase, resumo, porCidadeOrigem, porCidadeAtuacao, porMicro, porProjeto, porAno, porUF, faixasDistancia, fluxos, rotuloAtuacao, porMes, rotuloMes };
})();
