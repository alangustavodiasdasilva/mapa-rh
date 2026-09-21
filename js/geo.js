// Geocodificação (busca de coordenadas na internet) e importação da lista oficial de municípios.
const Geo = (() => {
  const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
  const PHOTON = 'https://photon.komoot.io/api/';
  const URL_IBGE = 'https://raw.githubusercontent.com/kelvins/municipios-brasileiros/main/csv/municipios.csv';

  // Fila com intervalo mínimo de 1,1 s entre buscas (política de uso do Nominatim).
  let fila = Promise.resolve();
  let ultimo = 0;
  function agendar(fn) {
    const exec = async () => {
      const espera = 1100 - (Date.now() - ultimo);
      if (espera > 0) await new Promise(r => setTimeout(r, espera));
      try { return await fn(); } finally { ultimo = Date.now(); }
    };
    const p = fila.then(exec, exec);
    fila = p.catch(() => {});
    return p;
  }
  const norm = s => Store.normalizar(s);

  async function nominatim(nome, uf) {
    const nomeUF = Store.UFS[uf] || '';
    const params = new URLSearchParams({ format: 'jsonv2', limit: '5', countrycodes: 'br', 'accept-language': 'pt-BR',
      q: [nome, nomeUF, 'Brasil'].filter(Boolean).join(', ') });
    const r = await fetch(`${NOMINATIM}?${params}`, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) throw new Error('Nominatim HTTP ' + r.status);
    const lista = await r.json();
    const doEstado = x => !nomeUF || norm(x.display_name).includes(norm(nomeUF));
    const ehCidade = x => /city|town|village|municipality|hamlet|administrative/.test((x.type || '') + ' ' + (x.addresstype || ''));
    // só aceita resultados cujo nome corresponde ao que foi digitado (evita "achar" outro lugar qualquer)
    const mesmoNome = x => norm(x.name || '') === norm(nome) || norm(x.display_name).includes(norm(nome));
    const validos = lista.filter(x => doEstado(x) && mesmoNome(x));
    const ok = validos.find(ehCidade) || validos[0];
    if (!ok) return null;
    return { lat: parseFloat(ok.lat), lng: parseFloat(ok.lon), nome: ok.name || '', fonte: 'OpenStreetMap (Nominatim)', descricao: ok.display_name };
  }

  async function photon(nome, uf) {
    const nomeUF = Store.UFS[uf] || '';
    const params = new URLSearchParams({ q: [nome, nomeUF, 'Brasil'].filter(Boolean).join(' '), limit: '8', lang: 'default' });
    const r = await fetch(`${PHOTON}?${params}`);
    if (!r.ok) throw new Error('Photon HTTP ' + r.status);
    const j = await r.json();
    const feats = (j.features || []).filter(f => (f.properties.countrycode || '').toUpperCase() === 'BR');
    const doEstado = f => !nomeUF || norm(f.properties.state || '') === norm(nomeUF);
    const ehCidade = f => /city|town|village|municipality|county/.test((f.properties.osm_value || '') + ' ' + (f.properties.type || ''));
    const mesmoNome = f => norm(f.properties.name || '') === norm(nome) || norm(f.properties.name || '').includes(norm(nome));
    const validos = feats.filter(f => doEstado(f) && mesmoNome(f));
    const ok = validos.find(ehCidade) || validos[0];
    if (!ok) return null;
    return { lat: ok.geometry.coordinates[1], lng: ok.geometry.coordinates[0], nome: ok.properties.name || '', fonte: 'OpenStreetMap (Photon)',
      descricao: [ok.properties.name, ok.properties.state, ok.properties.country].filter(Boolean).join(', ') };
  }

  const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'd']);
  function capitalizar(texto) {
    return String(texto).trim().toLowerCase().split(/\s+/).map((p, i) => MINUSCULAS.has(p) && i > 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
      .replace(/-([a-z])/g, (m, c) => '-' + c.toUpperCase()).replace(/'([a-z])/g, (m, c) => "'" + c.toUpperCase());
  }

  const negativos = new Set();
  // Busca coordenadas de uma cidade. Retorna {lat, lng, fonte, descricao} ou null.
  function geocodificar(nome, uf) {
    const chave = norm(nome) + '|' + (uf || '');
    if (negativos.has(chave)) return Promise.resolve(null);
    return agendar(async () => {
      let res = null;
      try { res = await nominatim(nome, uf); } catch (e) { console.warn('Nominatim falhou', e); }
      if (!res) { try { res = await photon(nome, uf); } catch (e) { console.warn('Photon falhou', e); } }
      if (!res) negativos.add(chave);
      return res;
    });
  }

  // Busca e salva a cidade na base local. Lança erro se não encontrar.
  async function geocodificarESalvar(nome, uf) {
    if (!uf) throw new Error('Informe a UF para buscar a cidade.');
    const res = await geocodificar(nome, uf);
    if (!res) throw new Error(`Não encontrei "${nome}" (${uf}) na internet. Verifique a grafia ou cadastre a cidade manualmente com as coordenadas.`);
    // usa o nome oficial devolvido pela busca quando ele corresponde ao digitado; senão, capitaliza o texto
    const nomeFinal = res.nome && Store.normalizar(res.nome) === Store.normalizar(nome) ? res.nome : capitalizar(nome);
    return Store.salvarCidade({ nome: nomeFinal, uf, lat: res.lat, lng: res.lng, origem: 'geocode' });
  }

  // Baixa a lista completa de municípios (IBGE, com coordenadas) e guarda no navegador.
  async function importarIBGE(aoProgresso = () => {}) {
    aoProgresso('Baixando lista de municípios…');
    const r = await fetch(URL_IBGE, { cache: 'no-store' });
    if (!r.ok) throw new Error('Não foi possível baixar a lista (HTTP ' + r.status + ').');
    const texto = await r.text();
    aoProgresso('Processando…');
    const linhas = UI.csvParse(texto, ',');
    if (linhas.length < 100) throw new Error('Arquivo de municípios inesperado.');
    const cab = linhas[0].map(h => norm(h));
    const col = nomes => { for (const n of nomes) { const i = cab.indexOf(n); if (i >= 0) return i; } return -1; };
    const iNome = col(['nome', 'municipio', 'name']);
    const iLat = col(['latitude', 'lat']);
    const iLng = col(['longitude', 'lng', 'lon']);
    const iUF = col(['codigo uf', 'uf', 'estado']);
    const iCod = col(['codigo ibge', 'codigo', 'id']);
    if (iNome < 0 || iLat < 0 || iLng < 0 || iUF < 0) throw new Error('Colunas esperadas não encontradas no arquivo de municípios.');
    const lista = [];
    for (const l of linhas.slice(1)) {
      const ufBruto = l[iUF];
      const uf = /^\d+$/.test(ufBruto) ? Store.CODIGO_UF[parseInt(ufBruto, 10)] : String(ufBruto || '').toUpperCase();
      const lat = parseFloat(l[iLat]), lng = parseFloat(l[iLng]);
      if (!uf || !Store.UFS[uf] || isNaN(lat) || isNaN(lng) || !l[iNome]) continue;
      lista.push([l[iNome], uf, +lat.toFixed(4), +lng.toFixed(4), iCod >= 0 ? l[iCod] : null]);
    }
    if (lista.length < 5000) throw new Error('A lista veio incompleta (' + lista.length + ' municípios).');
    Store.definirMunicipiosIBGE(lista);
    return lista.length;
  }

  return { geocodificar, geocodificarESalvar, importarIBGE, capitalizar, URL_IBGE };
})();
