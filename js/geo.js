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
    const ufs = Store.conjuntoUF(uf);
    if (!ufs) throw new Error('Informe a UF para buscar a cidade.');
    let res = null;
    for (const u of ufs) { res = await geocodificar(nome, u); if (res) { uf = u; break; } }
    if (!res) throw new Error(`Não encontrei "${nome}" (${[...ufs].join('/')}) na internet. Verifique a grafia ou cadastre a cidade manualmente com as coordenadas.`);
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

  // ---------- agências do SINE pela internet ----------
  const RE_SINE = /\bsine\b|agência do trabalhador|agencia do trabalhador|sistema nacional de emprego|casa do trabalhador|posto de atendimento ao trabalhador|\bpat\b/i;
  // 1) Google Places (API oficial, precisa da chave em Cidades → Agências do SINE)
  async function sineGoogle(c, chave) {
    const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': chave,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.regularOpeningHours.weekdayDescriptions,places.location' },
      body: JSON.stringify({ textQuery: `SINE agência do trabalhador ${c.nome} ${c.uf}`, languageCode: 'pt-BR', regionCode: 'BR', maxResultCount: 8,
        locationBias: { circle: { center: { latitude: c.lat, longitude: c.lng }, radius: 30000 } } })
    });
    if (!r.ok) {
      let msg = 'HTTP ' + r.status;
      try { const e = await r.json(); msg = (e.error && e.error.message) || msg; } catch (x) { /* sem corpo */ }
      throw new Error('Google Places: ' + msg);
    }
    const j = await r.json();
    return (j.places || []).filter(p => RE_SINE.test((p.displayName && p.displayName.text) || '')).map(p => ({
      nome: p.displayName.text, endereco: p.formattedAddress || '', telefones: [p.nationalPhoneNumber || p.internationalPhoneNumber].filter(Boolean),
      email: '', horario: (p.regularOpeningHours && p.regularOpeningHours.weekdayDescriptions || []).join('; '), url: p.websiteUri || '',
      lat: p.location ? p.location.latitude : c.lat, lng: p.location ? p.location.longitude : c.lng
    }));
  }
  // 2) OpenStreetMap (Overpass, sem chave; cobertura menor). Tenta mais de um servidor.
  const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
  async function sineOSM(c) {
    const q = `[out:json][timeout:10];nwr(around:40000,${c.lat},${c.lng})["name"~"SINE|Agência do Trabalhador|Agencia do Trabalhador|Sistema Nacional de Emprego|Casa do Trabalhador",i];out center tags;`;
    let ultimo = null;
    for (const url of OVERPASS) {
      try {
        const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 12000);
        const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctrl.signal });
        clearTimeout(t);
        if (!r.ok) { ultimo = new Error('Overpass HTTP ' + r.status); continue; }
        const j = await r.json();
        return (j.elements || []).map(e => { const tg = e.tags || {}; const lat = e.lat != null ? e.lat : (e.center || {}).lat, lng = e.lon != null ? e.lon : (e.center || {}).lon;
          return { nome: tg.name, endereco: [tg['addr:street'], tg['addr:housenumber'], tg['addr:suburb'], tg['addr:city']].filter(Boolean).join(', '),
            telefones: [tg.phone || tg['contact:phone']].filter(Boolean), email: tg.email || tg['contact:email'] || '', horario: tg.opening_hours || '', url: tg.website || tg['contact:website'] || '', lat, lng }; })
          .filter(a => a.nome && a.lat != null);
      } catch (e) { ultimo = e; }
    }
    throw ultimo || new Error('OpenStreetMap indisponível.');
  }
  // 3) Nominatim (busca por texto no OSM)
  async function sineNominatim(c) {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent('SINE ' + c.nome + ' ' + c.uf)}&format=jsonv2&limit=5&extratags=1&accept-language=pt-BR`);
    if (!r.ok) throw new Error('Nominatim HTTP ' + r.status);
    const j = await r.json();
    return j.filter(x => RE_SINE.test(x.display_name || '') || RE_SINE.test((x.namedetails || {}).name || '')).map(x => ({
      nome: (x.display_name || '').split(',')[0], endereco: (x.display_name || '').split(',').slice(1, 4).join(',').trim(),
      telefones: [(x.extratags || {}).phone || (x.extratags || {})['contact:phone']].filter(Boolean), email: '', horario: (x.extratags || {}).opening_hours || '', url: '', lat: +x.lat, lng: +x.lon }));
  }
  // Procura as agências de uma cidade na internet e guarda na base. Devolve { agencias, origem, aviso }.
  async function buscarSineOnline(c, { forcar = false } = {}) {
    if (!c) return { agencias: [], origem: '', aviso: 'Cidade inválida.' };
    if (!forcar && Store.buscaSineRecente(c.id)) return { agencias: Store.sineDaCidade(c), origem: 'cache', aviso: '' };
    const chave = (Store.config().googleKey || '').trim();
    const avisos = [];
    if (chave) {
      try { const l = await sineGoogle(c, chave); Store.adicionarAgenciasOnline(c, l, 'google'); return { agencias: l, origem: 'google', aviso: l.length ? '' : 'O Google não encontrou agência do SINE nesta cidade.' }; }
      catch (e) { avisos.push(e.message); }
    }
    try { const l = await sineOSM(c); if (l.length) { Store.adicionarAgenciasOnline(c, l, 'osm'); return { agencias: l, origem: 'osm', aviso: avisos.join(' ') }; } }
    catch (e) { avisos.push('OpenStreetMap: ' + e.message); }
    try { const l = await sineNominatim(c); Store.adicionarAgenciasOnline(c, l, 'osm'); return { agencias: l, origem: 'osm', aviso: (l.length ? '' : 'Nada encontrado na internet para esta cidade. ') + avisos.join(' ') }; }
    catch (e) { avisos.push('Nominatim: ' + e.message); }
    return { agencias: [], origem: '', aviso: avisos.join(' ') };
  }

  return { geocodificar, geocodificarESalvar, importarIBGE, capitalizar, URL_IBGE, buscarSineOnline };
})();
