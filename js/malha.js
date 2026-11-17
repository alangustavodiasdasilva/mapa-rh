// Malha dos municípios (limites oficiais do IBGE), usada para pintar distritos e microrregiões no mapa.
// Baixa UMA vez a malha de cada estado (um único arquivo por UF, ~250 KB) e guarda no navegador (IndexedDB).
// Também guarda a lista [código, nome] dos municípios do estado para achar o código das cidades da base inicial.
const Malha = (() => {
  const URL_MALHA = uf => `https://servicodados.ibge.gov.br/api/v3/malhas/estados/${Store.UF_CODIGO[uf]}?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio`;
  const URL_LISTA = uf => `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`;
  const NOME_DB = 'maparh-malha', LOJA = 'malhas';
  const memoria = new Map(); // uf -> Promise<{ uf, codigos, features }>
  const prontas = new Map(); // uf -> dados já carregados (para consultas imediatas)

  // ---------- cache no IndexedDB (não ocupa o espaço limitado do localStorage) ----------
  function abrirDB() {
    return new Promise(resolve => {
      if (!window.indexedDB) return resolve(null);
      let req;
      try { req = indexedDB.open(NOME_DB, 1); } catch (e) { return resolve(null); }
      req.onupgradeneeded = () => { try { req.result.createObjectStore(LOJA); } catch (e) { /* já existe */ } };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    });
  }
  async function lerDB(chave) {
    const db = await abrirDB();
    if (!db) return null;
    return new Promise(resolve => {
      try {
        const req = db.transaction(LOJA, 'readonly').objectStore(LOJA).get(chave);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    });
  }
  async function gravarDB(chave, valor) {
    const db = await abrirDB();
    if (!db) return;
    return new Promise(resolve => {
      try {
        const tx = db.transaction(LOJA, 'readwrite');
        tx.objectStore(LOJA).put(valor, chave);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      } catch (e) { resolve(); }
    });
  }
  async function limparDB() {
    const db = await abrirDB();
    if (!db) return;
    return new Promise(resolve => {
      try { const tx = db.transaction(LOJA, 'readwrite'); tx.objectStore(LOJA).clear(); tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); }
      catch (e) { resolve(); }
    });
  }

  // ---------- IBGE ----------
  async function listaMunicipios(uf) {
    const chave = 'maparh:ibge:mun:' + uf;
    let lista = null;
    try {
      const bruto = JSON.parse(localStorage.getItem(chave) || 'null');
      if (Array.isArray(bruto) && bruto.length && Array.isArray(bruto[0])) lista = bruto;
    } catch (e) { /* cache inválido: baixa de novo */ }
    if (!lista) {
      const r = await fetch(URL_LISTA(uf));
      if (!r.ok) throw new Error('IBGE HTTP ' + r.status);
      const j = await r.json();
      lista = j.map(m => [String(m.id), m.nome]);
      try { localStorage.setItem(chave, JSON.stringify(lista)); } catch (e) { /* sem espaço: segue sem cache */ }
    }
    return lista;
  }
  async function malhaMunicipios(uf) {
    const chave = 'mun:' + uf;
    let geo = await lerDB(chave);
    if (!geo) {
      const r = await fetch(URL_MALHA(uf));
      if (!r.ok) throw new Error('IBGE HTTP ' + r.status);
      geo = await r.json();
      if (!geo || !Array.isArray(geo.features)) throw new Error('Malha do IBGE em formato inesperado.');
      await gravarDB(chave, geo);
    }
    return geo;
  }

  // Devolve { uf, codigos: Map(nome normalizado -> código IBGE), features: Map(código -> feature GeoJSON) }.
  // A promessa é guardada em memória: várias chamadas para a mesma UF fazem um único download.
  function carregarUF(uf) {
    uf = String(uf || '').toUpperCase();
    if (!Store.UF_CODIGO[uf]) return Promise.reject(new Error('UF inválida: ' + uf));
    if (!memoria.has(uf)) {
      const p = (async () => {
        const [lista, geo] = await Promise.all([listaMunicipios(uf).catch(() => []), malhaMunicipios(uf)]);
        const codigos = new Map(lista.map(([id, nome]) => [Store.normalizar(nome), String(id)]));
        // segunda chance: nomes sem espaços/apóstrofos (ex.: "Sant'Ana do Livramento" x "Santana do Livramento")
        const compactos = new Map(lista.map(([id, nome]) => [Store.normalizar(nome).replace(/\s+/g, ''), String(id)]));
        const features = new Map(geo.features.map(f => [String(f.properties && f.properties.codarea), f]));
        const nomes = new Map(lista.map(([id, nome]) => [String(id), nome]));
        const d = { uf, codigos, compactos, nomes, features };
        prontas.set(uf, d);
        return d;
      })();
      p.catch(() => memoria.delete(uf)); // falhou (sem internet?): permite tentar de novo depois
      memoria.set(uf, p);
    }
    return memoria.get(uf);
  }
  function codigoDaCidade(c, dadosUF) {
    if (c.ibge) return String(c.ibge);
    const n = Store.normalizar(c.nome);
    return dadosUF.codigos.get(n) || dadosUF.compactos.get(n.replace(/\s+/g, '')) || null;
  }
  function featureDaCidade(c, dadosUF) {
    const cod = codigoDaCidade(c, dadosUF);
    return cod ? dadosUF.features.get(cod) || null : null;
  }

  // ---------- qual município está em um ponto do mapa ----------
  function dentroDoAnel(anel, x, y) {
    let dentro = false;
    for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
      const xi = anel[i][0], yi = anel[i][1], xj = anel[j][0], yj = anel[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) dentro = !dentro;
    }
    return dentro;
  }
  // caixa (min/max) do município, calculada uma vez: descarta rápido quase todos antes do teste ponto-no-polígono
  function caixa(f, poligonos) {
    if (f._cx) return f._cx;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of poligonos) for (const pt of (p[0] || [])) { if (pt[0] < x0) x0 = pt[0]; if (pt[0] > x1) x1 = pt[0]; if (pt[1] < y0) y0 = pt[1]; if (pt[1] > y1) y1 = pt[1]; }
    Object.defineProperty(f, '_cx', { value: [x0, y0, x1, y1], enumerable: false });
    return f._cx;
  }
  function pontoEmFeature(f, lng, lat) {
    const g = f && f.geometry;
    if (!g) return false;
    const poligonos = g.type === 'Polygon' ? [g.coordinates] : (g.type === 'MultiPolygon' ? g.coordinates : []);
    const cx = caixa(f, poligonos);
    if (lng < cx[0] || lng > cx[2] || lat < cx[1] || lat > cx[3]) return false;
    for (const p of poligonos) {
      if (!p.length || !dentroDoAnel(p[0], lng, lat)) continue;
      let buraco = false;
      for (let k = 1; k < p.length; k++) if (dentroDoAnel(p[k], lng, lat)) { buraco = true; break; }
      if (!buraco) return true;
    }
    return false;
  }
  // Procura o município que contém o ponto nas malhas das UFs informadas. Devolve { uf, codigo, nome, feature } ou null.
  async function municipioNoPonto(lat, lng, ufs) {
    for (const uf of ufs) {
      let d;
      try { d = await carregarUF(uf); } catch (e) { continue; }
      for (const [codigo, f] of d.features) {
        if (pontoEmFeature(f, lng, lat)) return { uf, codigo, nome: d.nomes.get(codigo) || '', feature: f };
      }
    }
    return null;
  }
  function ufsCarregadas() { return [...memoria.keys()]; }
  // Versão imediata (sem baixar nada): só olha as malhas que já estão na memória. Usada ao passar o mouse.
  function municipioNoPontoCarregado(lat, lng, ufs) {
    for (const uf of ufs) {
      const d = prontas.get(uf);
      if (!d) continue;
      for (const [codigo, f] of d.features) if (pontoEmFeature(f, lng, lat)) return { uf, codigo, nome: d.nomes.get(codigo) || '', feature: f };
    }
    return null;
  }
  function malhaPronta(uf) { return prontas.get(uf) || null; }

  // Versões anteriores guardavam um arquivo por município e a lista completa (objetos) no localStorage.
  // Remove esses restos para liberar espaço; a malha atual fica no IndexedDB.
  function limparCacheAntigo() {
    try {
      const remover = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith('maparh:')) continue;
        if (k.startsWith('maparh:malha:m:')) remover.push(k);
        else if (k.startsWith('maparh:ibge:mun:') && String(localStorage.getItem(k) || '').startsWith('[{')) remover.push(k);
      }
      remover.forEach(k => localStorage.removeItem(k));
    } catch (e) { /* ignora */ }
  }
  async function limparCache() {
    memoria.clear(); prontas.clear();
    await limparDB();
    limparCacheAntigo();
    try {
      for (const uf of Object.keys(Store.UFS)) localStorage.removeItem('maparh:ibge:mun:' + uf);
    } catch (e) { /* ignora */ }
  }

  return { carregarUF, codigoDaCidade, featureDaCidade, municipioNoPonto, municipioNoPontoCarregado, malhaPronta, ufsCarregadas, limparCacheAntigo, limparCache };
})();
