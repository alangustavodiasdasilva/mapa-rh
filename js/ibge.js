// Dados do município direto do IBGE (API "Cidades"): população, área, ocupação, salário médio, PIB.
// Guarda o resultado no navegador por 30 dias para não consultar toda hora.
const IbgeCidade = (() => {
  const INDICADORES = {
    populacaoEstimada: { id: 29171, rotulo: 'População estimada', unidade: 'hab.' },
    populacaoCenso: { id: 29166, rotulo: 'População no Censo', unidade: 'hab.' },
    area: { id: 29167, rotulo: 'Área', unidade: 'km²' },
    densidade: { id: 29168, rotulo: 'Densidade', unidade: 'hab/km²' },
    popOcupada: { id: 60036, rotulo: 'População ocupada', unidade: '%', ajuda: 'pessoas com trabalho formal ÷ população' },
    salarioMedio: { id: 60038, rotulo: 'Salário médio', unidade: 'salários mín.' },
    rendaMeioSM: { id: 60037, rotulo: 'Renda até ½ salário', unidade: '% da população', ajuda: 'moradores com renda domiciliar per capita de até meio salário mínimo' },
    pibPerCapita: { id: 60047, rotulo: 'PIB per capita', unidade: 'R$' }
  };
  const DIAS_CACHE = 30;
  const memoria = new Map();

  function lerCache(codigo) {
    try {
      const c = JSON.parse(localStorage.getItem('maparh:ibge:dados:' + codigo) || 'null');
      if (c && c.quando && Date.now() - c.quando < DIAS_CACHE * 864e5) return c.dados;
    } catch (e) { /* ignora */ }
    return null;
  }
  function gravarCache(codigo, dados) {
    try { localStorage.setItem('maparh:ibge:dados:' + codigo, JSON.stringify({ quando: Date.now(), dados })); } catch (e) { /* sem espaço */ }
  }
  // Último ano com valor numérico de cada indicador
  function ultimoValor(serie) {
    const anos = Object.keys(serie || {}).filter(a => serie[a] != null && serie[a] !== '-' && serie[a] !== '' && !isNaN(parseFloat(serie[a]))).sort();
    if (!anos.length) return null;
    const ano = anos[anos.length - 1];
    return { valor: parseFloat(serie[ano]), ano };
  }
  // codigo = código IBGE de 7 dígitos. Devolve { populacaoEstimada: {valor, ano}, ... } (só os que existem).
  function dados(codigo) {
    codigo = String(codigo || '').replace(/\D/g, '');
    if (codigo.length !== 7) return Promise.resolve(null);
    if (memoria.has(codigo)) return memoria.get(codigo);
    const p = (async () => {
      const cache = lerCache(codigo);
      if (cache) return cache;
      const ids = Object.values(INDICADORES).map(i => i.id).join('|');
      const r = await fetch(`https://servicodados.ibge.gov.br/api/v1/pesquisas/indicadores/${encodeURIComponent(ids)}/resultados/${codigo}`);
      if (!r.ok) throw new Error('IBGE HTTP ' + r.status);
      const lista = await r.json();
      const out = {};
      for (const [chave, ind] of Object.entries(INDICADORES)) {
        const item = lista.find(x => x.id === ind.id);
        const serie = item && item.res && item.res[0] ? item.res[0].res : null;
        const v = ultimoValor(serie);
        if (v) out[chave] = v;
      }
      if (!out.densidade && out.populacaoEstimada && out.area && out.area.valor > 0) {
        out.densidade = { valor: out.populacaoEstimada.valor / out.area.valor, ano: out.populacaoEstimada.ano };
      }
      gravarCache(codigo, out);
      return out;
    })();
    p.catch(() => memoria.delete(codigo));
    memoria.set(codigo, p);
    return p;
  }
  // Endereço da página do município no IBGE Cidades
  function urlCidades(nome, uf) {
    const slug = Store.normalizar(nome).replace(/\s+/g, '-');
    return `https://cidades.ibge.gov.br/brasil/${String(uf || '').toLowerCase()}/${slug}/panorama`;
  }
  return { INDICADORES, dados, urlCidades };
})();
