// Camada de dados: tudo fica salvo no navegador (localStorage).
// Faça backups pelo menu "Backup" para guardar/mover os dados.
//
// Modelo:
//   projeto  = um estado (UF) + ano opcional (ex.: "Contratações RS 2024")
//   registro = MÓVEL/LOCAL + cidade de origem (+UF) + cidade de atuação
//              (uma cidade do estado do projeto, ou 'MOVEL' = qualquer lugar do estado)
const Store = (() => {
  const CHAVE = 'maparh:dados';
  const CHAVE_IBGE = 'maparh:municipios';
  const CHAVE_SESSAO = 'maparh:sessao';
  const DURACAO_SESSAO_MS = 12 * 60 * 60 * 1000;
  const VERSAO = 6;

  const UFS = {
    AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal',
    ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais',
    PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
    RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins'
  };
  const CODIGO_UF = { 11: 'RO', 12: 'AC', 13: 'AM', 14: 'RR', 15: 'PA', 16: 'AP', 17: 'TO', 21: 'MA', 22: 'PI', 23: 'CE', 24: 'RN',
    25: 'PB', 26: 'PE', 27: 'AL', 28: 'SE', 29: 'BA', 31: 'MG', 32: 'ES', 33: 'RJ', 35: 'SP', 41: 'PR', 42: 'SC', 43: 'RS',
    50: 'MS', 51: 'MT', 52: 'GO', 53: 'DF' };
  const UF_CODIGO = Object.fromEntries(Object.entries(CODIGO_UF).map(([k, v]) => [v, +k]));
  // Centro aproximado de cada estado (usado para representar "atuação móvel em todo o estado")
  const UF_CENTRO = { AC: [-9.02, -70.81], AL: [-9.57, -36.78], AP: [1.41, -51.77], AM: [-3.47, -65.10], BA: [-12.96, -41.70],
    CE: [-5.20, -39.53], DF: [-15.83, -47.86], ES: [-19.19, -40.34], GO: [-15.98, -49.86], MA: [-5.42, -45.44], MT: [-12.64, -55.42],
    MS: [-20.51, -54.54], MG: [-18.10, -44.38], PA: [-3.79, -52.48], PB: [-7.28, -36.72], PR: [-24.89, -51.55], PE: [-8.38, -37.86],
    PI: [-7.72, -42.73], RJ: [-22.25, -42.66], RN: [-5.81, -36.59], RS: [-30.17, -53.50], RO: [-10.83, -63.34], RR: [1.99, -61.33],
    SC: [-27.45, -50.95], SP: [-22.19, -48.79], SE: [-10.57, -37.45], TO: [-9.46, -48.26] };
  const PERFIS = { admin: 'Administrador', gestor: 'Gestor', leitor: 'Visualizador' };
  const PERMISSOES = {
    admin: ['dashboard', 'mapa', 'cadastro', 'cidades', 'projetos', 'relatorios', 'usuarios', 'auditoria', 'backup', 'distritos', 'pdrs'],
    gestor: ['dashboard', 'mapa', 'cadastro', 'cidades', 'projetos', 'relatorios', 'backup', 'distritos', 'pdrs'],
    leitor: ['dashboard', 'mapa', 'relatorios', 'distritos', 'pdrs']
  };
  const MOVEL = 'MOVEL'; // legado: registros antigos com atuação em todo o estado

  let dados = null;
  let municipiosIBGE = null;      // [[nome, uf, lat, lng, codigo], ...]
  let indiceCidades = new Map();  // id -> cidade
  let listaCidades = [];

  // ---------- utilitários ----------
  const agora = () => new Date().toISOString();
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  function normalizar(s) {
    return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function idCidade(nome, uf) { return String(uf).toUpperCase() + ':' + normalizar(nome); }
  function distanciaKm(a, b) {
    if (!a || !b) return null;
    const R = 6371, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function levenshtein(a, b) {
    if (a === b) return 0;
    let ant = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(ant[j] + 1, cur[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      ant = cur;
    }
    return ant[b.length];
  }
  const ehMovel = v => String(v || '').toUpperCase() === MOVEL;

  // ---------- persistência ----------
  function dadosPadrao() {
    const salt = uid();
    return {
      versao: VERSAO,
      usuarios: [{ id: uid(), nome: 'Administrador', login: 'admin', salt, senhaHash: sha256(salt + 'admin'),
        perfil: 'admin', ativo: true, projetos: null, senhaPadrao: true, criadoEm: agora() }],
      projetos: [], cidades: [], registros: [], auditoria: [], distritos: [], mapasPdr: [], infoCidades: {}
    };
  }
  function carregar() {
    try {
      const bruto = localStorage.getItem(CHAVE);
      dados = bruto ? JSON.parse(bruto) : dadosPadrao();
    } catch (e) { console.error('Falha ao ler dados salvos', e); dados = dadosPadrao(); }
    for (const k of ['usuarios', 'projetos', 'cidades', 'registros', 'auditoria', 'distritos', 'mapasPdr']) if (!Array.isArray(dados[k])) dados[k] = [];
    if (!dados.infoCidades || typeof dados.infoCidades !== 'object') dados.infoCidades = {};
    if (!dados.usuarios.length) dados.usuarios = dadosPadrao().usuarios;
    try {
      const m = localStorage.getItem(CHAVE_IBGE);
      municipiosIBGE = m ? JSON.parse(m) : null;
    } catch (e) { municipiosIBGE = null; }
    reconstruirIndice();
    migrar();
  }
  // Converte dados gravados pela versão anterior para o modelo atual.
  function migrar() {
    let mudou = false;
    const versaoAntiga = Number(dados.versao) || 0;
    for (const p of dados.projetos) {
      if (!p.uf) { p.uf = p.cidadeId ? String(p.cidadeId).split(':')[0] : ''; mudou = true; }
      if (p.ano === undefined) { p.ano = null; mudou = true; }
      if ('metaLocal' in p) { delete p.metaLocal; mudou = true; }
    }
    for (const r of dados.registros) {
      if (r.atuacao === undefined) {
        const p = dados.projetos.find(x => x.id === r.projetoId);
        r.atuacao = p && p.cidadeId ? p.cidadeId : MOVEL; mudou = true;
      }
      // migração v2→v3: garantir campo baseContratacao
      if (r.baseContratacao === undefined) { r.baseContratacao = r.atuacao !== MOVEL ? r.atuacao : null; mudou = true; }
    }
    if (!Array.isArray(dados.distritos)) { dados.distritos = []; mudou = true; }
    for (const d of dados.distritos) {
      if (!Array.isArray(d.micros)) {
        d.micros = [];
        if (Array.isArray(d.cidadeIds) && d.cidadeIds.length) {
          d.micros.push({ id: uid(), nome: d.nome, cor: d.cor || '#059669', cidadeIds: d.cidadeIds });
        }
        delete d.cidadeIds;
        mudou = true;
      }
      for (const m of d.micros) {
        if (!Array.isArray(m.cidadeIds)) { m.cidadeIds = []; mudou = true; }
        if ((!m.poloCidadeId || !m.cidadeIds.includes(m.poloCidadeId)) && m.cidadeIds.length) { m.poloCidadeId = m.cidadeIds[0]; mudou = true; }
      }
      // v3→v4: distrito passa a ter UF (deduzida da primeira cidade) e descrição
      if (d.uf == null) {
        const ids = d.micros.flatMap(m => m.cidadeIds);
        d.uf = ids.length ? String(ids[0]).split(':')[0] : '';
        mudou = true;
      }
      if (d.descricao == null) { d.descricao = ''; mudou = true; }
    }
    if (!Array.isArray(dados.mapasPdr)) { dados.mapasPdr = []; mudou = true; }
    for (const m of dados.mapasPdr) if (!corValida(m.cor)) { m.cor = corSugeridaMapaPdr(); mudou = true; }
    // Carrega uma única vez o mapa de exemplo (Ct- Distrito Lagoa Vermelha 2026). Se o usuário excluir, não volta.
    if (dados.mapasPdr.length && !dados.seedPdrCarregado) { dados.seedPdrCarregado = true; mudou = true; }
    if (!dados.mapasPdr.length && !dados.seedPdrCarregado && window.MAPA_PDR_SEED) {
      dados.mapasPdr.push({
        id: uid(),
        nome: window.MAPA_PDR_SEED.nome || 'Ct- Distrito Lagoa Vermelha 2026',
        criadoEm: agora(),
        pontos: window.MAPA_PDR_SEED.pontos || []
      });
      dados.seedPdrCarregado = true;
      mudou = true;
    }
    // v4→v5: as microrregiões passam a receber tons da cor do distrito (do mais escuro ao mais claro)
    // v5→v6: escala de tons mais espaçada
    if (versaoAntiga < 6) { dados.distritos.forEach(d => { if (!corValida(d.cor)) d.cor = '#16a34a'; aplicarTons(d); }); mudou = true; }
    // Estrutura inicial dos distritos (data/distritos_seed.js): aplicada uma única vez, mesclando com o que já existir
    if (!dados.seedDistritosCarregado && window.DISTRITOS_SEED) { aplicarSeedDistritos(); dados.seedDistritosCarregado = true; mudou = true; }
    if (dados.versao !== VERSAO) { dados.versao = VERSAO; mudou = true; }
    if (mudou) salvar();
  }
  function salvar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(dados)); }
    catch (e) { UI.toast('Não foi possível salvar: espaço do navegador cheio. Faça um backup.', 'erro', 6000); throw e; }
  }

  // ---------- cidades ----------
  const cacheSilos = new Map(); // 'UF|nome' -> cidade | null
  function reconstruirIndice() {
    indiceCidades = new Map();
    cacheSilos.clear();
    const adicionar = (c, origem) => {
      const cid = { id: idCidade(c.nome, c.uf), nome: c.nome, uf: String(c.uf).toUpperCase(), lat: +c.lat, lng: +c.lng,
        origem, ibge: c.ibge || null };
      indiceCidades.set(cid.id, cid);
    };
    (window.CIDADES_SEED || []).forEach(a => adicionar({ nome: a[0], uf: a[1], lat: a[2], lng: a[3], ibge: a[4] || null }, 'seed'));
    dados.cidades.filter(c => c.origem === 'geocode').forEach(c => adicionar(c, 'geocode'));
    (municipiosIBGE || []).forEach(a => adicionar({ nome: a[0], uf: a[1], lat: a[2], lng: a[3], ibge: a[4] }, 'ibge'));
    dados.cidades.filter(c => c.origem === 'manual').forEach(c => adicionar(c, 'manual'));
    listaCidades = [...indiceCidades.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.uf.localeCompare(b.uf));
  }
  function cidades() { return listaCidades; }
  function cidade(id) { return indiceCidades.get(id) || null; }
  function buscarCidades(q, uf = '', limite = 12) {
    const n = normalizar(q);
    if (!n) return [];
    const ufN = String(uf || '').toUpperCase();
    const comeca = [], contem = [];
    for (const c of listaCidades) {
      if (ufN && c.uf !== ufN) continue;
      const nc = normalizar(c.nome);
      if (nc.startsWith(n)) comeca.push(c);
      else if (nc.includes(n)) contem.push(c);
      if (comeca.length >= limite) break;
    }
    return comeca.concat(contem).slice(0, limite);
  }
  // Retorna a cidade exata (nome + UF). Sem UF: só resolve se o nome for único no país.
  function resolverCidade(nome, uf = '') {
    const n = normalizar(nome);
    if (!n) return null;
    if (uf) return indiceCidades.get(String(uf).toUpperCase() + ':' + n) || null;
    const iguais = listaCidades.filter(c => normalizar(c.nome) === n);
    return iguais.length === 1 ? iguais[0] : null;
  }
  function candidatasCidade(nome) {
    const n = normalizar(nome);
    return listaCidades.filter(c => normalizar(c.nome) === n);
  }
  // Tolera pequenos erros de grafia (ex.: "SAO LUIZ" -> São Luís). Só devolve se houver um único candidato próximo.
  function cidadeAproximada(nome, uf = '') {
    const n = normalizar(nome);
    if (!n) return null;
    const ufN = String(uf || '').toUpperCase();
    const limite = n.length >= 8 ? 2 : 1;
    let melhor = null, melhorD = Infinity, empate = false;
    for (const c of listaCidades) {
      if (ufN && c.uf !== ufN) continue;
      const nc = normalizar(c.nome);
      if (Math.abs(nc.length - n.length) > limite) continue;
      const d = levenshtein(n, nc);
      if (d < melhorD) { melhorD = d; melhor = c; empate = false; }
      else if (d === melhorD) empate = true;
    }
    return melhor && melhorD <= limite && !empate ? melhor : null;
  }
  function salvarCidade({ nome, uf, lat, lng, origem = 'manual', ibge = null }) {
    nome = String(nome || '').trim(); uf = String(uf || '').toUpperCase();
    if (!nome || !UFS[uf]) throw new Error('Informe o nome da cidade e uma UF válida.');
    lat = parseFloat(lat); lng = parseFloat(lng);
    if (isNaN(lat) || isNaN(lng) || lat < -34 || lat > 6 || lng < -74 || lng > -34) throw new Error('Coordenadas fora do Brasil ou inválidas.');
    const id = idCidade(nome, uf);
    const existente = cidade(id);
    if (existente && existente.origem === 'ibge' && origem === 'geocode') return existente;
    const nomeFinal = existente && existente.origem === 'ibge' ? existente.nome : nome;
    dados.cidades = dados.cidades.filter(c => c.id !== id);
    dados.cidades.push({ id, nome: nomeFinal, uf, lat, lng, origem, ibge: ibge || (existente && existente.ibge) || null, criadoEm: agora() });
    salvar();
    reconstruirIndice();
    return cidade(id);
  }
  function excluirCidade(id) {
    if (usoCidade(id) > 0) throw new Error('Esta cidade está em uso por registros.');
    const antes = dados.cidades.length;
    dados.cidades = dados.cidades.filter(c => c.id !== id);
    if (dados.cidades.length === antes) throw new Error('Só é possível excluir cidades adicionadas manualmente ou por busca.');
    salvar(); reconstruirIndice();
  }
  function usoCidade(id) {
    return dados.registros.filter(r => r.cidadeId === id || r.atuacao === id).length;
  }
  function definirMunicipiosIBGE(lista) {
    municipiosIBGE = lista;
    try { localStorage.setItem(CHAVE_IBGE, JSON.stringify(lista)); }
    catch (e) { throw new Error('Sem espaço no navegador para guardar a lista de municípios.'); }
    reconstruirIndice();
  }
  function temIBGE() { return Array.isArray(municipiosIBGE) && municipiosIBGE.length > 0; }
  function totalIBGE() { return municipiosIBGE ? municipiosIBGE.length : 0; }

  // ---------- sessão / usuários ----------
  function login(loginTxt, senha) {
    const u = dados.usuarios.find(x => x.login.toLowerCase() === String(loginTxt || '').trim().toLowerCase());
    if (!u || !u.ativo) return null;
    if (sha256(u.salt + senha) !== u.senhaHash) return null;
    localStorage.setItem(CHAVE_SESSAO, JSON.stringify({ usuarioId: u.id, expira: Date.now() + DURACAO_SESSAO_MS }));
    auditar('login', `Entrou no sistema`, u);
    return u;
  }
  function logout() {
    const u = usuarioAtual();
    if (u) auditar('logout', 'Saiu do sistema', u);
    localStorage.removeItem(CHAVE_SESSAO);
  }
  function usuarioAtual() {
    try {
      const s = JSON.parse(localStorage.getItem(CHAVE_SESSAO) || 'null');
      if (!s || s.expira < Date.now()) return null;
      const u = dados.usuarios.find(x => x.id === s.usuarioId);
      if (!u || !u.ativo) return null;
      localStorage.setItem(CHAVE_SESSAO, JSON.stringify({ usuarioId: u.id, expira: Date.now() + DURACAO_SESSAO_MS }));
      return u;
    } catch (e) { return null; }
  }
  function pode(usuario, pagina) { return !!usuario && (PERMISSOES[usuario.perfil] || []).includes(pagina); }
  function usuarios() { return dados.usuarios; }
  function salvarUsuario(obj, autor) {
    const login = String(obj.login || '').trim().toLowerCase();
    if (!obj.nome || !login) throw new Error('Nome e login são obrigatórios.');
    if (!PERFIS[obj.perfil]) throw new Error('Perfil inválido.');
    if (dados.usuarios.some(u => u.login === login && u.id !== obj.id)) throw new Error('Já existe um usuário com este login.');
    let u = obj.id ? dados.usuarios.find(x => x.id === obj.id) : null;
    if (!u) {
      if (!obj.senha || obj.senha.length < 4) throw new Error('Informe uma senha com pelo menos 4 caracteres.');
      u = { id: uid(), criadoEm: agora() };
      dados.usuarios.push(u);
    }
    Object.assign(u, { nome: obj.nome.trim(), login, perfil: obj.perfil, ativo: obj.ativo !== false,
      projetos: obj.perfil === 'admin' ? null : (obj.projetos ?? null) });
    if (obj.senha) {
      if (obj.senha.length < 4) throw new Error('A senha deve ter pelo menos 4 caracteres.');
      u.salt = uid(); u.senhaHash = sha256(u.salt + obj.senha); u.senhaPadrao = false;
    }
    if (!dados.usuarios.some(x => x.perfil === 'admin' && x.ativo)) throw new Error('É preciso manter ao menos um administrador ativo.');
    salvar();
    auditar(obj.id ? 'usuario.editar' : 'usuario.criar', `Usuário ${u.login} (${PERFIS[u.perfil]})`, autor);
    return u;
  }
  function excluirUsuario(id, autor) {
    const u = dados.usuarios.find(x => x.id === id);
    if (!u) return;
    if (autor && autor.id === id) throw new Error('Você não pode excluir o próprio usuário.');
    const restantes = dados.usuarios.filter(x => x.id !== id);
    if (!restantes.some(x => x.perfil === 'admin' && x.ativo)) throw new Error('É preciso manter ao menos um administrador ativo.');
    dados.usuarios = restantes;
    salvar();
    auditar('usuario.excluir', `Usuário ${u.login}`, autor);
  }
  function alterarSenha(usuario, atual, nova) {
    const u = dados.usuarios.find(x => x.id === usuario.id);
    if (sha256(u.salt + atual) !== u.senhaHash) throw new Error('Senha atual incorreta.');
    if (!nova || nova.length < 4) throw new Error('A nova senha deve ter pelo menos 4 caracteres.');
    u.salt = uid(); u.senhaHash = sha256(u.salt + nova); u.senhaPadrao = false;
    salvar();
    auditar('usuario.senha', 'Alterou a própria senha', u);
  }

  // ---------- projetos (um estado + ano opcional) ----------
  function projetos() { return dados.projetos; }
  function projeto(id) { return dados.projetos.find(p => p.id === id) || null; }
  function projetosVisiveis(usuario) {
    if (!usuario) return [];
    const lista = usuario.projetos == null ? dados.projetos : dados.projetos.filter(p => usuario.projetos.includes(p.id));
    return lista.slice().sort((a, b) => (b.ano || 0) - (a.ano || 0) || a.nome.localeCompare(b.nome, 'pt-BR'));
  }
  function rotuloProjeto(p) { return p ? `${p.nome} (${p.uf}${p.ano ? ' · ' + p.ano : ''})` : '—'; }
  function salvarProjeto(obj, autor) {
    if (!obj.nome || !obj.nome.trim()) throw new Error('Informe o nome do projeto.');
    const uf = String(obj.uf || '').toUpperCase();
    if (!UFS[uf]) throw new Error('Selecione o estado (UF) do projeto.');
    let ano = null;
    if (obj.ano !== '' && obj.ano != null) {
      ano = parseInt(obj.ano, 10);
      if (isNaN(ano) || ano < 1990 || ano > 2100) throw new Error('Ano inválido (use 4 dígitos, ex.: 2024).');
    }
    if (dados.projetos.some(p => p.nome.trim().toLowerCase() === obj.nome.trim().toLowerCase() && p.id !== obj.id)) throw new Error('Já existe um projeto com este nome.');
    let p = obj.id ? projeto(obj.id) : null;
    const novo = !p;
    if (!p) { p = { id: uid(), criadoEm: agora() }; dados.projetos.push(p); }
    if (!novo && p.uf !== uf && dados.registros.some(r => r.projetoId === p.id && r.atuacao !== MOVEL && cidade(r.atuacao) && cidade(r.atuacao).uf !== uf)) {
      throw new Error('Este projeto já tem cidades de atuação em ' + p.uf + '. Para mudar o estado, corrija ou exclua esses registros antes.');
    }
    Object.assign(p, { nome: obj.nome.trim(), uf, ano, descricao: (obj.descricao || '').trim(),
      cor: obj.cor || '#2563eb', ativo: obj.ativo !== false, atualizadoEm: agora() });
    delete p.cidadeId; delete p.metaLocal;
    if (novo && autor && autor.projetos) { autor.projetos.push(p.id); }
    salvar();
    auditar(novo ? 'projeto.criar' : 'projeto.editar', `Projeto ${rotuloProjeto(p)}`, autor);
    return p;
  }
  function excluirProjeto(id, autor) {
    const p = projeto(id);
    if (!p) return;
    const qtd = dados.registros.filter(r => r.projetoId === id).length;
    dados.registros = dados.registros.filter(r => r.projetoId !== id);
    dados.projetos = dados.projetos.filter(x => x.id !== id);
    dados.usuarios.forEach(u => { if (u.projetos) u.projetos = u.projetos.filter(x => x !== id); });
    salvar();
    auditar('projeto.excluir', `Projeto ${rotuloProjeto(p)} (${qtd} registros removidos)`, autor);
  }

  // ---------- registros ----------
  function registros() { return dados.registros; }
  function enriquecer(r) {
    const p = projeto(r.projetoId);
    const c = cidade(r.cidadeId);
    const ca = cidade(r.atuacao) || null;
    const cb = r.baseContratacao ? cidade(r.baseContratacao) : null;
    // legado: atuacao = 'MOVEL' (todo o estado) — mostra base de contratação se disponível
    const atuacaoMovel = ehMovel(r.atuacao) && !cb;
    const cidadeAtuacao = ehMovel(r.atuacao) ? cb : ca;
    return { ...r, projeto: p, cidade: c, cidadeAtuacao, cidadeBase: cb, atuacaoMovel,
      distancia: c && cidadeAtuacao ? distanciaKm(c, cidadeAtuacao) : null,
      foraDoEstado: !!(p && c && c.uf !== p.uf) };
  }
  // distritoId / microId: só contratações cuja cidade de atuação (ou base, no caso de MÓVEL) está na região
  function registrosFiltrados({ projetoId = '', tipo = '', usuario = null, uf = '', distritoId = '', microId = '' } = {}) {
    const visiveis = new Set(projetosVisiveis(usuario).map(p => p.id));
    let regiao = null;
    if (microId) {
      const m = dados.distritos.flatMap(d => d.micros || []).find(x => x.id === microId);
      regiao = new Set(m ? m.cidadeIds || [] : []);
    } else if (distritoId) {
      const d = distrito(distritoId);
      regiao = new Set(d ? cidadesDoDistrito(d).map(c => c.id) : []);
    }
    return dados.registros
      .filter(r => visiveis.has(r.projetoId))
      .filter(r => !projetoId || r.projetoId === projetoId)
      .filter(r => !tipo || r.tipo === tipo)
      .map(enriquecer)
      .filter(r => r.projeto && r.cidade && (r.atuacaoMovel || r.cidadeAtuacao))
      .filter(r => !uf || r.cidade.uf === uf)
      .filter(r => !regiao || (r.cidadeAtuacao && regiao.has(r.cidadeAtuacao.id)));
  }
  function validarRegistro({ projetoId, tipo, cidadeId, atuacao, baseContratacao }) {
    if (!projeto(projetoId)) throw new Error('Projeto inválido.');
    if (!['LOCAL', 'MOVEL'].includes(tipo)) throw new Error('Tipo deve ser LOCAL ou MÓVEL.');
    if (!cidade(cidadeId)) throw new Error('Cidade de origem inválida.');
    if (!ehMovel(atuacao) && !cidade(atuacao)) throw new Error('Cidade de atuação inválida.');
    if (baseContratacao && !cidade(baseContratacao)) throw new Error('Base de contratação inválida.');
  }
  function descreverRegistro(r) {
    const c = cidade(r.cidadeId);
    const at = ehMovel(r.atuacao) ? (r.baseContratacao ? cidade(r.baseContratacao)?.nome || 'base' : 'MÓVEL') : (cidade(r.atuacao) ? cidade(r.atuacao).nome : r.atuacao);
    return `${r.tipo} — ${c ? c.nome + '/' + c.uf : r.cidadeId} → ${at}`;
  }
  function novoRegistro(l, autor) {
    return { id: uid(), projetoId: l.projetoId, tipo: l.tipo, cidadeId: l.cidadeId,
      atuacao: ehMovel(l.atuacao) ? MOVEL : l.atuacao,
      baseContratacao: l.baseContratacao || null,
      criadoEm: agora(), criadoPor: autor ? autor.login : null };
  }
  function adicionarRegistro(campos, autor) {
    validarRegistro(campos);
    const r = novoRegistro(campos, autor);
    dados.registros.push(r);
    salvar();
    auditar('registro.criar', `${descreverRegistro(r)} em ${projeto(r.projetoId).nome}`, autor);
    return enriquecer(r);
  }
  function adicionarRegistros(lista, autor) {
    lista.forEach(validarRegistro);
    const novos = lista.map(l => novoRegistro(l, autor));
    dados.registros.push(...novos);
    salvar();
    if (novos.length) auditar('registro.importar', `${novos.length} registros importados em ${projeto(novos[0].projetoId).nome}`, autor);
    return novos.length;
  }
  function atualizarRegistro(id, campos, autor) {
    const r = dados.registros.find(x => x.id === id);
    if (!r) throw new Error('Registro não encontrado.');
    const novo = { ...r, ...campos };
    validarRegistro(novo);
    Object.assign(r, { tipo: novo.tipo, cidadeId: novo.cidadeId, projetoId: novo.projetoId,
      atuacao: ehMovel(novo.atuacao) ? MOVEL : novo.atuacao,
      baseContratacao: novo.baseContratacao || null,
      atualizadoEm: agora() });
    salvar();
    auditar('registro.editar', descreverRegistro(r), autor);
    return enriquecer(r);
  }
  function excluirRegistro(id, autor) {
    const r = dados.registros.find(x => x.id === id);
    if (!r) return;
    dados.registros = dados.registros.filter(x => x.id !== id);
    salvar();
    auditar('registro.excluir', descreverRegistro(r), autor);
  }
  function excluirRegistros(ids, autor) {
    const set = new Set(ids);
    const antes = dados.registros.length;
    dados.registros = dados.registros.filter(x => !set.has(x.id));
    salvar();
    auditar('registro.excluir', `${antes - dados.registros.length} registros excluídos`, autor);
  }

  // ---------- distritos e microrregiões ----------
  // distrito = { id, nome, uf, cor, descricao, micros: [{ id, nome, cor, poloCidadeId, cidadeIds: [] }] }
  // Regra: cada cidade pertence a no máximo UMA microrregião (de qualquer distrito).
  // Cores: cada DISTRITO tem uma cor própria; as MICRORREGIÕES recebem tons dessa cor (do mais escuro ao mais claro).
  const PALETA_DISTRITOS = ['#16a34a', '#2563eb', '#dc2626', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d',
    '#ea580c', '#0d9488', '#9333ea', '#ca8a04', '#4f46e5', '#be123c', '#059669', '#b45309'];
  const corValida = c => /^#[0-9a-fA-F]{6}$/.test(String(c || ''));
  function hexParaHsl(hex) {
    let c = String(hex || '').replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16) || 0;
    const r = ((num >> 16) & 255) / 255, g = ((num >> 8) & 255) / 255, b = (num & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, sat = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [Math.round(h * 360), Math.round(sat * 100), Math.round(l * 100)];
  }
  function hslParaHex(h, sat, l) {
    h = ((h % 360) + 360) % 360;
    sat = Math.max(0, Math.min(100, sat)) / 100;
    l = Math.max(0, Math.min(100, l)) / 100;
    const c = (1 - Math.abs(2 * l - 1)) * sat;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    const hex = v => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return '#' + hex(r) + hex(g) + hex(b);
  }
  // Escala de tons da cor do distrito: mesma cor, do mais escuro ao mais claro (como num mapa de "líderes").
  // Os tons são repartidos em toda a faixa de claridade (bem escuro → bem claro) e alternam a saturação,
  // para que um tom nunca fique parecido com o vizinho.
  function gerarTons(hexBase, qtd = 12) {
    const [h, s] = hexParaHsl(corValida(hexBase) ? hexBase : '#16a34a');
    const satBase = Math.max(50, Math.min(90, s || 60));
    const n = Math.max(1, qtd);
    const L_MIN = 16, L_MAX = 86;
    return Array.from({ length: n }, (_, i) => {
      const l = n === 1 ? 40 : L_MIN + (L_MAX - L_MIN) * i / (n - 1);
      let sat = satBase + (i % 2 ? -18 : 10);       // alterna vivo / suave
      if (l > 70) sat -= 10;                         // tons claros menos "neon"
      return hslParaHex(h, Math.max(35, Math.min(95, sat)), l);
    });
  }
  // Cor do texto que fica legível sobre a cor informada
  function corTexto(hex) { return hexParaHsl(hex)[2] > 58 ? '#0f172a' : '#ffffff'; }
  // Reparte os tons da cor do distrito entre as microrregiões (em ordem alfabética: da mais escura à mais clara)
  function aplicarTons(d) {
    const micros = (d.micros || []).slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    const tons = gerarTons(d.cor, micros.length);
    micros.forEach((m, i) => { m.cor = tons[i]; });
  }
  function distritos() { return dados.distritos; }
  function distrito(id) { return dados.distritos.find(d => d.id === id) || null; }
  function micro(distritoId, microId) {
    const d = distrito(distritoId);
    return d ? (d.micros || []).find(m => m.id === microId) || null : null;
  }
  // Próxima cor da paleta ainda não usada por outro distrito
  function corSugeridaDistrito() {
    const usadas = new Set(dados.distritos.map(d => String(d.cor || '').toLowerCase()));
    return PALETA_DISTRITOS.find(c => !usadas.has(c)) || PALETA_DISTRITOS[dados.distritos.length % PALETA_DISTRITOS.length];
  }
  // Tom para uma nova microrregião: o mais diferente (em claridade) dos tons já usados no distrito
  function corSugeridaMicro(d) {
    const tons = gerarTons(d && d.cor, 12);
    const usados = ((d && d.micros) || []).map(m => hexParaHsl(m.cor)[2]);
    if (!usados.length) return tons[0];
    let melhor = tons[0], melhorDist = -1;
    for (const t of tons) {
      const l = hexParaHsl(t)[2];
      const dist = Math.min(...usados.map(u => Math.abs(u - l)));
      if (dist > melhorDist) { melhorDist = dist; melhor = t; }
    }
    return melhor;
  }
  function salvarDistrito(obj, autor) {
    const nome = String(obj.nome || '').trim();
    if (!nome) throw new Error('Informe o nome do distrito.');
    const uf = String(obj.uf || '').toUpperCase();
    if (!UFS[uf]) throw new Error('Selecione o estado (UF) das cidades do distrito.');
    if (dados.distritos.some(d => normalizar(d.nome) === normalizar(nome) && d.id !== obj.id)) throw new Error('Já existe um distrito com este nome.');
    let d = obj.id ? distrito(obj.id) : null;
    const novo = !d;
    if (!d) { d = { id: uid(), criadoEm: agora(), micros: [] }; dados.distritos.push(d); }
    if (!Array.isArray(d.micros)) d.micros = [];
    const cor = corValida(obj.cor) ? obj.cor.toLowerCase() : (d.cor || corSugeridaDistrito());
    Object.assign(d, { nome, uf, cor, descricao: String(obj.descricao || '').trim(), atualizadoEm: agora() });
    if (obj.recolorir) aplicarTons(d);
    salvar();
    auditar(novo ? 'distrito.criar' : 'distrito.editar', `Distrito ${nome}${uf ? ' (' + uf + ')' : ''} · ${d.micros.length} microrregião(ões)`, autor);
    return d;
  }
  function excluirDistrito(id, autor) {
    const d = distrito(id);
    if (!d) return;
    dados.distritos = dados.distritos.filter(x => x.id !== id);
    salvar();
    auditar('distrito.excluir', `Distrito ${d.nome} (${(d.micros || []).length} microrregiões)`, autor);
  }
  // Cidades da lista que já pertencem a outra microrregião (de qualquer distrito). microId = micro a ignorar (a que está sendo editada).
  function conflitosCidades(cidadeIds, microId = null) {
    const out = [];
    for (const id of cidadeIds) {
      for (const d of dados.distritos) {
        for (const m of (d.micros || [])) {
          if (m.id === microId) continue;
          if ((m.cidadeIds || []).includes(id)) out.push({ cidadeId: id, cidade: cidade(id), distrito: d, micro: m });
        }
      }
    }
    return out;
  }
  function removerCidadeDaMicro(m, cidadeId) {
    m.cidadeIds = (m.cidadeIds || []).filter(x => x !== cidadeId);
    if (m.poloCidadeId === cidadeId) m.poloCidadeId = m.cidadeIds[0] || null;
  }
  // opcoes.mover = ids de cidades que podem ser transferidas de outra microrregião para esta
  function salvarMicro(distritoId, obj, autor, { mover = [] } = {}) {
    const d = distrito(distritoId);
    if (!d) throw new Error('Distrito não encontrado.');
    if (!Array.isArray(d.micros)) d.micros = [];
    const nome = String(obj.nome || '').trim();
    if (!nome) throw new Error('Informe o nome da microrregião.');
    if (d.micros.some(m => normalizar(m.nome) === normalizar(nome) && m.id !== obj.id)) throw new Error(`Já existe a microrregião "${nome}" neste distrito.`);
    let m = obj.id ? d.micros.find(x => x.id === obj.id) : null;
    const novo = !m;
    const cor = corValida(obj.cor) ? obj.cor.toLowerCase() : ((m && m.cor) || corSugeridaMicro(d));
    const base = Array.isArray(obj.cidadeIds) ? obj.cidadeIds : (m ? m.cidadeIds || [] : []);
    const cidadeIds = [...new Set(base.filter(c => !!cidade(c)))];
    let poloCidadeId = obj.poloCidadeId && cidade(obj.poloCidadeId) ? obj.poloCidadeId
      : (m && cidadeIds.includes(m.poloCidadeId) ? m.poloCidadeId : (cidadeIds[0] || null));
    if (!poloCidadeId) throw new Error('Informe a cidade polo da microrregião.');
    if (!cidadeIds.includes(poloCidadeId)) cidadeIds.unshift(poloCidadeId);
    if (!UFS[d.uf]) d.uf = cidade(poloCidadeId).uf; // distrito ainda sem estado: assume o da cidade polo
    const conflitos = conflitosCidades(cidadeIds, m ? m.id : null);
    const moverSet = new Set(mover);
    const bloqueados = conflitos.filter(c => !moverSet.has(c.cidadeId));
    if (bloqueados.length) {
      const lista = bloqueados.slice(0, 4).map(c => `${c.cidade ? c.cidade.nome : c.cidadeId} (${c.distrito.nome} · ${c.micro.nome})`).join(', ');
      throw new Error(`Cidade(s) já vinculada(s) a outra microrregião: ${lista}${bloqueados.length > 4 ? ' e mais ' + (bloqueados.length - 4) : ''}. Marque a opção de mover para transferi-las.`);
    }
    conflitos.forEach(c => removerCidadeDaMicro(c.micro, c.cidadeId));
    if (!m) { m = { id: uid(), criadoEm: agora() }; d.micros.push(m); }
    Object.assign(m, { nome, cor, poloCidadeId, cidadeIds, atualizadoEm: agora() });
    d.atualizadoEm = agora();
    salvar();
    auditar(novo ? 'micro.criar' : 'micro.editar', `Microrregião ${nome} em ${d.nome} (${cidadeIds.length} cidades${conflitos.length ? ', ' + conflitos.length + ' transferida(s)' : ''})`, autor);
    return m;
  }
  function excluirMicro(distritoId, microId, autor) {
    const d = distrito(distritoId);
    if (!d || !Array.isArray(d.micros)) return;
    const m = d.micros.find(x => x.id === microId);
    if (!m) return;
    d.micros = d.micros.filter(x => x.id !== microId);
    d.atualizadoEm = agora();
    salvar();
    auditar('micro.excluir', `Microrregião ${m.nome} de ${d.nome} (${(m.cidadeIds || []).length} cidades)`, autor);
  }
  // Importa em lote a estrutura "microrregião → cidades" de um distrito.
  // itens: [{ micro: 'Casca', cidadeId: 'RS:casca', polo: true|false }]. Cria as microrregiões que faltam e acrescenta cidades às existentes.
  function importarEstrutura(distritoId, itens, autor, { mover = true } = {}) {
    const d = distrito(distritoId);
    if (!d) throw new Error('Distrito não encontrado.');
    if (!Array.isArray(d.micros)) d.micros = [];
    const grupos = new Map();
    for (const it of itens) {
      const nomeMicro = String(it.micro || '').trim();
      if (!nomeMicro || !cidade(it.cidadeId)) continue;
      const k = normalizar(nomeMicro);
      if (!grupos.has(k)) grupos.set(k, { nome: nomeMicro, cidadeIds: [], polo: null });
      const g = grupos.get(k);
      if (!g.cidadeIds.includes(it.cidadeId)) g.cidadeIds.push(it.cidadeId);
      if (it.polo && !g.polo) g.polo = it.cidadeId;
    }
    const res = { microsCriadas: 0, microsAtualizadas: 0, cidades: 0, movidas: 0, ignoradas: 0 };
    for (const [k, g] of grupos) {
      let m = d.micros.find(x => normalizar(x.nome) === k) || null;
      const existentes = m ? (m.cidadeIds || []) : [];
      const novas = g.cidadeIds.filter(id => !existentes.includes(id));
      const conflitos = conflitosCidades(novas, m ? m.id : null);
      const emConflito = new Set(conflitos.map(c => c.cidadeId));
      const aceitas = mover ? novas : novas.filter(id => !emConflito.has(id));
      res.ignoradas += novas.length - aceitas.length;
      if (mover) { conflitos.forEach(c => removerCidadeDaMicro(c.micro, c.cidadeId)); res.movidas += conflitos.length; }
      const cidadeIds = [...existentes, ...aceitas];
      if (!cidadeIds.length) continue;
      let polo = g.polo && cidadeIds.includes(g.polo) ? g.polo : (m && cidadeIds.includes(m.poloCidadeId) ? m.poloCidadeId : null);
      if (!polo) polo = cidadeIds.find(id => normalizar(cidade(id).nome) === k) || cidadeIds[0];
      if (!m) { m = { id: uid(), criadoEm: agora(), nome: g.nome, cor: corSugeridaMicro(d) }; d.micros.push(m); res.microsCriadas++; }
      else res.microsAtualizadas++;
      Object.assign(m, { poloCidadeId: polo, cidadeIds, atualizadoEm: agora() });
      if (!UFS[d.uf]) d.uf = cidade(polo).uf;
      res.cidades += aceitas.length;
    }
    d.atualizadoEm = agora();
    salvar();
    auditar('distrito.importar', `Distrito ${d.nome}: ${res.microsCriadas} microrregião(ões) criada(s), ${res.microsAtualizadas} atualizada(s), ${res.cidades} cidade(s)`, autor);
    return res;
  }
  // Cria/completa os distritos descritos em window.DISTRITOS_SEED (nome, uf, cor, micros: [{ nome, polo, cidades }])
  function aplicarSeedDistritos() {
    for (const sd of (window.DISTRITOS_SEED || [])) {
      const uf = String(sd.uf || '').toUpperCase();
      let d = dados.distritos.find(x => normalizar(x.nome) === normalizar(sd.nome));
      if (!d) {
        d = { id: uid(), criadoEm: agora(), nome: sd.nome, uf, cor: corValida(sd.cor) ? sd.cor : corSugeridaDistrito(), descricao: '', micros: [] };
        dados.distritos.push(d);
      } else {
        if (d.nome === d.nome.toUpperCase()) d.nome = sd.nome; // "LAGOA VERMELHA" -> "Lagoa Vermelha"
        if (!UFS[d.uf]) d.uf = uf;
      }
      const itens = [];
      for (const sm of (sd.micros || [])) {
        for (const nomeCid of (sm.cidades || [])) {
          const c = resolverCidade(nomeCid, uf) || cidadeAproximada(nomeCid, uf);
          if (c) itens.push({ micro: sm.nome, cidadeId: c.id, polo: normalizar(nomeCid) === normalizar(sm.polo || '') });
        }
      }
      try { importarEstrutura(d.id, itens, null, { mover: true }); } catch (e) { console.warn('Estrutura inicial do distrito não aplicada', sd.nome, e); }
      d.micros = d.micros.filter(m => (m.cidadeIds || []).length); // microrregiões que ficaram vazias após a mesclagem
      aplicarTons(d);
    }
  }
  function distritoDaCidade(cidadeId) {
    for (const d of dados.distritos) {
      for (const m of (d.micros || [])) {
        if (m.cidadeIds && m.cidadeIds.includes(cidadeId)) return { distrito: d, micro: m };
      }
    }
    return null;
  }
  function corDaCidade(cidadeId) {
    const info = distritoDaCidade(cidadeId);
    if (!info) return null;
    const cor = (info.micro && info.micro.cor) || info.distrito.cor || '#059669';
    const polo = info.micro && info.micro.poloCidadeId === cidadeId;
    return { cor, distrito: info.distrito, micro: info.micro, polo };
  }
  function cidadesDoDistrito(d) {
    const ids = new Set();
    (d.micros || []).forEach(m => (m.cidadeIds || []).forEach(id => ids.add(id)));
    return [...ids].map(id => cidade(id)).filter(Boolean);
  }
  // Cidade correspondente ao nome gravado em um ponto de mapa PDR (com cache, pois é chamado muitas vezes)
  function cidadeDoSilo(s, uf = '') {
    const nome = String(s && s.cidade || '').trim();
    if (!nome) return null;
    const k = String(uf || '') + '|' + normalizar(nome);
    if (!cacheSilos.has(k)) {
      cacheSilos.set(k, (uf ? resolverCidade(nome, uf) || cidadeAproximada(nome, uf) : null) || resolverCidade(nome) || cidadeAproximada(nome) || null);
    }
    return cacheSilos.get(k);
  }
  // Microrregião (com cor) da cidade onde fica um ponto de mapa PDR; null se a cidade não está em nenhuma
  function microDoSilo(s) {
    for (const d of dados.distritos) {
      const c = cidadeDoSilo(s, d.uf);
      if (!c) continue;
      const info = corDaCidade(c.id);
      if (info) return { ...info, cidade: c };
    }
    const c = cidadeDoSilo(s, '');
    if (c) { const info = corDaCidade(c.id); if (info) return { ...info, cidade: c }; }
    return null;
  }
  // Pontos PDR cuja cidade está no distrito / na microrregião informados (sem filtro, devolve todos)
  function silosNaRegiao(silos, distritoId = '', microId = '') {
    if (!distritoId && !microId) return silos;
    return silos.filter(s => {
      const info = microDoSilo(s);
      if (!info) return false;
      if (microId) return info.micro.id === microId;
      return info.distrito.id === distritoId;
    });
  }
  function resumoDistrito(d) {
    const cidades = cidadesDoDistrito(d);
    const ids = new Set(cidades.map(c => c.id));
    const silos = todosSilosPdr().filter(s => { const c = cidadeDoSilo(s, d.uf); return c && ids.has(c.id); }).length;
    const contratacoes = dados.registros.filter(r => ids.has(r.atuacao) || ids.has(r.baseContratacao)).length;
    return { micros: (d.micros || []).length, cidades: cidades.length, silos, contratacoes };
  }

  // ---------- anotações do RH por cidade (SINE, divulgação de vagas, contatos) ----------
  const CAMPOS_INFO = ['sineTelefone', 'sineEndereco', 'canais', 'contatos', 'observacoes'];
  function infoCidade(cidadeId) { return (dados.infoCidades || {})[cidadeId] || null; }
  function salvarInfoCidade(cidadeId, campos, autor) {
    if (!cidadeId) throw new Error('Cidade inválida.');
    if (!dados.infoCidades) dados.infoCidades = {};
    const obj = {};
    let vazio = true;
    for (const k of CAMPOS_INFO) { obj[k] = String((campos || {})[k] || '').trim(); if (obj[k]) vazio = false; }
    if (vazio) delete dados.infoCidades[cidadeId];
    else dados.infoCidades[cidadeId] = { ...obj, atualizadoEm: agora(), atualizadoPor: autor ? autor.login : null };
    salvar();
    const c = cidade(cidadeId);
    auditar('cidade.info', `Anotações de ${c ? c.nome + '/' + c.uf : cidadeId}${vazio ? ' removidas' : ''}`, autor);
    return dados.infoCidades[cidadeId] || null;
  }

  // ---------- agências do SINE (base embutida: data/sine_seed.js) ----------
  function agenciasSine() { return (window.SINE_SEED && Array.isArray(window.SINE_SEED.agencias)) ? window.SINE_SEED.agencias : []; }
  // Agências na própria cidade
  function sineDaCidade(c) {
    if (!c) return [];
    const n = normalizar(c.nome), uf = String(c.uf || '').toUpperCase();
    return agenciasSine().filter(a => String(a.uf || 'RS').toUpperCase() === uf && normalizar(a.cidade) === n);
  }
  // Agência mais próxima (em km), quando a cidade não tem uma
  function sineMaisProximo(c) {
    if (!c || c.lat == null) return null;
    let melhor = null;
    for (const a of agenciasSine()) {
      if (a.lat == null || a.lng == null) continue;
      const d = distanciaKm(c, a);
      if (d != null && (!melhor || d < melhor.distancia)) melhor = { agencia: a, distancia: d };
    }
    return melhor;
  }

  // ---------- mapas PDRs / silos de grãos ----------
  function mapasPdr() { return dados.mapasPdr || []; }
  function mapaPdr(id) { return (dados.mapasPdr || []).find(m => m.id === id) || null; }
  const CORES_PDR = ['#b45309', '#1d4ed8', '#7c3aed', '#db2777', '#0f766e', '#dc2626', '#0891b2', '#65a30d', '#9333ea', '#ea580c'];
  function corSugeridaMapaPdr() {
    const usadas = new Set((dados.mapasPdr || []).map(m => String(m.cor || '').toLowerCase()));
    return CORES_PDR.find(c => !usadas.has(c)) || CORES_PDR[(dados.mapasPdr || []).length % CORES_PDR.length];
  }
  function adicionarMapaPdr({ nome, pontos, cor }, autor) {
    const n = String(nome || 'Mapa PDR').trim();
    if (!dados.mapasPdr) dados.mapasPdr = [];
    if (dados.mapasPdr.some(m => normalizar(m.nome) === normalizar(n))) throw new Error(`Já existe um mapa chamado "${n}". Exclua o antigo antes de importar de novo.`);
    const novo = {
      id: uid(),
      nome: n,
      cor: corValida(cor) ? cor : corSugeridaMapaPdr(),
      criadoEm: agora(),
      pontos: Array.isArray(pontos) ? pontos : []
    };
    dados.mapasPdr.push(novo);
    salvar();
    auditar('mapaPdr.adicionar', `Mapa ${n} (${novo.pontos.length} unidades/silos)`, autor);
    return novo;
  }
  function excluirMapaPdr(id, autor) {
    if (!dados.mapasPdr) return;
    const m = mapaPdr(id);
    if (!m) return;
    dados.mapasPdr = dados.mapasPdr.filter(x => x.id !== id);
    salvar();
    auditar('mapaPdr.excluir', `Mapa ${m.nome}`, autor);
  }
  function todosSilosPdr() {
    const todos = [];
    for (const m of (dados.mapasPdr || [])) {
      for (const p of (m.pontos || [])) {
        todos.push({ ...p, mapaId: m.id, mapaNome: m.nome });
      }
    }
    return todos;
  }

  // Lê um arquivo KML (Google My Maps). Devolve { nome, urlRemota, pontos }.
  // urlRemota = link de rede (arquivo exportado com "manter atualizado"): nesse caso o KML não traz os pontos.
  // Cada ponto guarda todos os campos "Nome: valor" da descrição e do ExtendedData em `campos`.
  function parseKML(textoKml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(textoKml, 'text/xml');
    const erro = doc.querySelector('parsererror');
    if (erro) throw new Error('Arquivo KML inválido: ' + erro.textContent.slice(0, 80));

    let nome = 'Mapa KML';
    const docNome = doc.querySelector('Document > name, kml > name, Folder > name, NetworkLink > name');
    if (docNome && docNome.textContent.trim()) nome = docNome.textContent.trim();

    let urlRemota = null;
    const netLink = doc.querySelector('NetworkLink Link href, NetworkLink Url href, NetworkLink href');
    if (netLink && /https?:\/\//i.test(netLink.textContent || '')) urlRemota = netLink.textContent.trim();

    const pontos = [];
    for (const p of doc.querySelectorAll('Placemark')) {
      const pNome = (p.querySelector('name') || {}).textContent || '';
      const desc = (p.querySelector('description') || {}).textContent || '';
      const coordsEl = p.querySelector('Point coordinates') || p.querySelector('coordinates');
      if (!coordsEl || !coordsEl.textContent.trim()) continue;
      const partes = coordsEl.textContent.trim().split(/[\s,]+/);
      const lng = parseFloat(partes[0]), lat = parseFloat(partes[1]);
      if (isNaN(lat) || isNaN(lng)) continue;

      const campos = {};
      const linhas = desc.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?[^>]+(>|$)/g, '').split('\n');
      for (const l of linhas) {
        const m = l.trim().match(/^([^:]{1,40}):\s*(.+)$/);
        if (m && m[2].trim()) campos[m[1].trim()] = m[2].trim();
      }
      for (const dEl of p.querySelectorAll('ExtendedData Data')) {
        const k = dEl.getAttribute('name'), v = ((dEl.querySelector('value') || {}).textContent || '').trim();
        if (k && v && !campos[k]) campos[k] = v;
      }
      const achar = re => { const k = Object.keys(campos).find(x => re.test(normalizar(x))); return k ? campos[k] : ''; };
      pontos.push({
        id: uid(), nome: pNome.trim() || 'Sem nome', lat, lng,
        cidade: achar(/^(cidade|municipio)$/), micro: achar(/micro/), distrito: achar(/^distrito$/),
        campos, desc
      });
    }
    return { nome, urlRemota, pontos };
  }
  // Campos de um ponto que valem a pena mostrar (fora os já exibidos e os internos/técnicos)
  const CAMPOS_OCULTOS = /^(cidade|municipio|micro.*|distrito|recomenda.*|modulo|horas.*|pdr id|id pod2|latitude|longitude|short|short cnpj)$/;
  function camposDoPonto(s) {
    const out = [];
    for (const [k, v] of Object.entries(s.campos || {})) if (!CAMPOS_OCULTOS.test(normalizar(k)) && v) out.push([k, v]);
    return out;
  }

  // ---------- auditoria ----------
  function auditar(acao, detalhes, usuario) {
    dados.auditoria.push({ id: uid(), quando: agora(), usuario: usuario ? usuario.login : '—', acao, detalhes: detalhes || '' });
    if (dados.auditoria.length > 3000) dados.auditoria = dados.auditoria.slice(-3000);
    salvar();
  }
  function auditoria() { return dados.auditoria.slice().reverse(); }
  function limparAuditoria(autor) { dados.auditoria = []; auditar('auditoria.limpar', 'Histórico de auditoria limpo', autor); }

  // ---------- backup ----------
  function exportar() {
    return JSON.stringify({ app: 'maparh', versao: VERSAO, exportadoEm: agora(), dados, municipiosIBGE }, null, 0);
  }
  function importar(texto, autor) {
    let obj;
    try { obj = JSON.parse(texto); } catch (e) { throw new Error('Arquivo inválido (não é um backup do Mapa RH).'); }
    if (!obj || obj.app !== 'maparh' || !obj.dados) throw new Error('Arquivo inválido (não é um backup do Mapa RH).');
    dados = obj.dados;
    for (const k of ['usuarios', 'projetos', 'cidades', 'registros', 'auditoria', 'distritos', 'mapasPdr']) if (!Array.isArray(dados[k])) dados[k] = [];
    if (!dados.infoCidades || typeof dados.infoCidades !== 'object') dados.infoCidades = {};
    if (!dados.usuarios.some(u => u.perfil === 'admin' && u.ativo)) dados.usuarios.push(dadosPadrao().usuarios[0]);
    salvar();
    if (Array.isArray(obj.municipiosIBGE) && obj.municipiosIBGE.length) {
      try { definirMunicipiosIBGE(obj.municipiosIBGE); } catch (e) { /* segue sem a lista */ }
    }
    reconstruirIndice();
    migrar();
    auditar('backup.restaurar', `Backup de ${obj.exportadoEm || '?'} restaurado`, autor);
  }
  function estatisticasArmazenamento() {
    let bytes = 0;
    for (const k of [CHAVE, CHAVE_IBGE]) bytes += (localStorage.getItem(k) || '').length * 2;
    return { bytes, registros: dados.registros.length, projetos: dados.projetos.length, usuarios: dados.usuarios.length, cidadesUsuario: dados.cidades.length,
      distritos: dados.distritos.length, micros: dados.distritos.reduce((n, d) => n + (d.micros || []).length, 0), mapasPdr: (dados.mapasPdr || []).length };
  }
  // Dados de demonstração (a planilha de exemplo informada pelo RH).
  function dadosDeExemplo(autor) {
    if (dados.projetos.length || dados.registros.length) throw new Error('Os dados de exemplo só podem ser carregados em uma base vazia.');
    const p = salvarProjeto({ nome: 'Exemplo — Contratações RS', uf: 'RS', ano: 2024, descricao: 'Projeto de demonstração. Pode ser editado ou excluído.', cor: '#2563eb' }, autor);
    const linhas = [
      ['LOCAL', 'PIRATINI', 'RS', 'PELOTAS', 'PELOTAS'], ['LOCAL', 'PELOTAS', 'RS', 'PELOTAS', 'PELOTAS'],
      ['MOVEL', 'SANTA MARIA', 'RS', 'PELOTAS', 'PELOTAS'], ['LOCAL', 'PELOTAS', 'RS', 'PELOTAS', 'PELOTAS'],
      ['MOVEL', 'SAO LOURENCO DO SUL', 'RS', 'PELOTAS', 'PELOTAS'], ['MOVEL', 'RIO PARDO', 'RS', 'PORTO ALEGRE', 'PORTO ALEGRE'],
      ['LOCAL', 'PELOTAS', 'RS', 'PELOTAS', 'PELOTAS'], ['MOVEL', 'SAO GABRIEL', 'RS', 'MOVEL', 'PORTO ALEGRE'],
      ['LOCAL', 'BAGE', 'RS', 'PELOTAS', 'PELOTAS'], ['LOCAL', 'JAGUARÃO', 'RS', 'PELOTAS', 'PELOTAS'],
      ['MOVEL', 'TEUTONIA', 'RS', 'MOVEL', 'PORTO ALEGRE'], ['MOVEL', 'BAGE', 'RS', 'MOVEL', 'PORTO ALEGRE'],
      ['MOVEL', 'SANTA MARIA', 'RS', 'MOVEL', 'PORTO ALEGRE'], ['MOVEL', 'CAXIAS DO SUL', 'RS', 'MOVEL', 'PORTO ALEGRE'],
    ];
    const regs = [];
    for (const [tipo, origem, uf, atuacaoCol, baseCol] of linhas) {
      const c = resolverCidade(origem, uf) || cidadeAproximada(origem, uf);
      const base = resolverCidade(baseCol, p.uf) || cidadeAproximada(baseCol, p.uf);
      // quando atuacao = 'MOVEL' na coluna → usar base de contratação
      const atuacaoResolvida = (ehMovel(atuacaoCol) || /^m[oó]vel/i.test(atuacaoCol))
        ? (base ? base.id : MOVEL)
        : (resolverCidade(atuacaoCol, p.uf) || cidadeAproximada(atuacaoCol, p.uf))?.id;
      if (c && atuacaoResolvida) regs.push({ projetoId: p.id, tipo, cidadeId: c.id, atuacao: atuacaoResolvida, baseContratacao: base ? base.id : null });
    }
    adicionarRegistros(regs, autor);
    return regs.length;
  }

  function init() { carregar(); }

  return { UFS, CODIGO_UF, UF_CODIGO, UF_CENTRO, PERFIS, PERMISSOES, MOVEL, ehMovel, init, salvar, uid, agora, normalizar, idCidade, distanciaKm,
    cidades, cidade, buscarCidades, resolverCidade, candidatasCidade, cidadeAproximada, salvarCidade, excluirCidade, usoCidade,
    definirMunicipiosIBGE, temIBGE, totalIBGE,
    login, logout, usuarioAtual, pode, usuarios, salvarUsuario, excluirUsuario, alterarSenha,
    projetos, projeto, projetosVisiveis, rotuloProjeto, salvarProjeto, excluirProjeto,
    registros, registrosFiltrados, adicionarRegistro, adicionarRegistros, atualizarRegistro, excluirRegistro, excluirRegistros,
    PALETA_DISTRITOS, gerarTons, corTexto, hexParaHsl, hslParaHex, distritos, distrito, micro, salvarDistrito, excluirDistrito, salvarMicro, excluirMicro,
    importarEstrutura, conflitosCidades, distritoDaCidade, corDaCidade, corSugeridaDistrito, corSugeridaMicro, cidadesDoDistrito, resumoDistrito, cidadeDoSilo, microDoSilo, silosNaRegiao,
    infoCidade, salvarInfoCidade, agenciasSine, sineDaCidade, sineMaisProximo,
    mapasPdr, mapaPdr, adicionarMapaPdr, excluirMapaPdr, todosSilosPdr, parseKML, camposDoPonto, corSugeridaMapaPdr,
    auditar, auditoria, limparAuditoria, exportar, importar, estatisticasArmazenamento, dadosDeExemplo,
    get dados() { return dados; } };
})();
