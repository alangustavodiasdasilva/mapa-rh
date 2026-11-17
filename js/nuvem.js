// Banco central (Supabase): login de verdade e os dados compartilhados entre todos os computadores.
// O Store continua trabalhando em memória + localStorage (que vira um cache); este módulo:
//   - autentica (login simples vira um e-mail interno) e carrega a lista de usuários (membros)
//   - a cada gravação compara os dados com o que está na nuvem e envia só o que mudou (item por item)
//   - de tempos em tempos busca o que os outros mudaram
// Sem js/nuvem-config.js preenchido o sistema funciona como antes, só no navegador.
const Nuvem = (() => {
  const cfg = window.MAPARH_NUVEM || {};
  const ativa = !!(cfg.url && cfg.chave && window.supabase);
  const CHAVE_FILA = 'maparh:nuvem-fila', CHAVE_VINC = 'maparh:nuvem-vinculado', CHAVE_ESPELHO = 'maparh:nuvem-espelho';
  const COLECOES = ['projetos', 'registros', 'vagas', 'candidatos', 'distritos', 'mapasPdr', 'cidades', 'auditoria'];
  const META = ['config', 'sineExtra', 'sineBusca', 'sineBuscaUF'];
  const SEEDS = ['seedPdrCarregado', 'seedDistritosAplicados', 'seedDistritosCarregado', 'versao'];
  const INTERVALO_MS = 30000;

  let sb = null, eu = null, perfil = null, pronta = false;
  let espelho = new Map();   // chave -> marca (hash do conteúdo) do que está na nuvem; guardado no navegador para funcionar sem internet
  let fila = new Map();      // chave -> 'u' (enviar) | 'd' (remover)
  let cursor = null, enviando = false, puxando = false, timerEnvio = null, timerDiff = null, timerPoll = null;
  let estado = 'parada', ultimoErro = '', aoMudarRemoto = () => {};

  // ---------- utilitários ----------
  // texto com as chaves em ordem: o Postgres (jsonb) devolve as chaves reordenadas
  function canon(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  }
  // marca curta do conteúdo (cyrb53): basta para saber se o item mudou
  function marca(v) {
    const s = canon(v); let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36) + ':' + s.length;
  }
  let timerEspelho = null;
  function salvarEspelho() { clearTimeout(timerEspelho); timerEspelho = setTimeout(() => { try { localStorage.setItem(CHAVE_ESPELHO, JSON.stringify([...espelho])); } catch (e) { /* sem espaço */ } }, 500); }
  function lerEspelho() { try { return new Map(JSON.parse(localStorage.getItem(CHAVE_ESPELHO) || '[]')); } catch (e) { return new Map(); } }
  const partes = chave => { const i = chave.indexOf('/'); return [chave.slice(0, i), chave.slice(i + 1)]; };
  function itensDe(d) {
    const m = new Map();
    for (const col of COLECOES) for (const it of (d[col] || [])) if (it && it.id != null) m.set(col + '/' + it.id, it);
    for (const [id, v] of Object.entries(d.infoCidades || {})) m.set('infoCidades/' + id, v);
    for (const k of META) if (d[k] != null) m.set('meta/' + k, d[k]);
    const seeds = {}; for (const k of SEEDS) if (d[k] !== undefined) seeds[k] = d[k];
    m.set('meta/seeds', seeds);
    return m;
  }
  function vazio() { const d = { infoCidades: {} }; for (const c of COLECOES) d[c] = []; return d; }
  function porNoLugar(d, chave, valor) {
    const [col, id] = partes(chave);
    if (col === 'meta') { if (id === 'seeds') Object.assign(d, valor || {}); else d[id] = valor; return; }
    if (col === 'infoCidades') { if (!d.infoCidades) d.infoCidades = {}; d.infoCidades[id] = valor; return; }
    if (!Array.isArray(d[col])) d[col] = [];
    const i = d[col].findIndex(x => x && String(x.id) === id);
    if (i >= 0) d[col][i] = valor; else d[col].push(valor);
  }
  function tirarDoLugar(d, chave) {
    const [col, id] = partes(chave);
    if (col === 'meta') { if (id !== 'seeds') delete d[id]; return; }
    if (col === 'infoCidades') { if (d.infoCidades) delete d.infoCidades[id]; return; }
    if (Array.isArray(d[col])) d[col] = d[col].filter(x => !(x && String(x.id) === id));
  }
  function ordenar(d) {
    const porData = (a, b) => String(a.criadoEm || a.quando || '').localeCompare(String(b.criadoEm || b.quando || ''));
    for (const c of COLECOES) if (Array.isArray(d[c])) d[c].sort(porData);
  }
  function salvarFila() { try { localStorage.setItem(CHAVE_FILA, JSON.stringify([...fila])); } catch (e) { /* sem espaço */ } }
  function lerFila() { try { return new Map(JSON.parse(localStorage.getItem(CHAVE_FILA) || '[]')); } catch (e) { return new Map(); } }
  function mudarEstado(novo, erro = '') {
    estado = novo; ultimoErro = erro;
    const el = document.getElementById('nuvem-status');
    if (el) { el.textContent = textoEstado(); el.title = erro || 'Os dados ficam no banco central e são os mesmos em todos os computadores.'; el.classList.toggle('erro', novo === 'erro'); }
  }
  function textoEstado() {
    const n = fila.size;
    if (estado === 'offline') return `sem internet${n ? ` — ${n} alteração(ões) aguardando` : ''}`;
    if (estado === 'erro') return `falha ao sincronizar${n ? ` — ${n} pendente(s)` : ''}`;
    if (estado === 'enviando' || n) return 'salvando na nuvem…';
    return 'salvo na nuvem';
  }

  // ---------- nuvem → local ----------
  async function buscarTudo() {
    const linhas = [];
    for (let de = 0; ; de += 1000) {
      const { data, error } = await sb.from('maparh_itens').select('colecao,id,dados,removido,atualizado_em')
        .neq('colecao', 'auditoria').eq('removido', false).order('colecao').order('id').range(de, de + 999);
      if (error) throw error;
      linhas.push(...data);
      if (data.length < 1000) break;
    }
    const { data: aud, error: e2 } = await sb.from('maparh_itens').select('colecao,id,dados,removido,atualizado_em')
      .eq('colecao', 'auditoria').eq('removido', false).order('atualizado_em', { ascending: false }).limit(1000);
    if (e2) throw e2;
    return linhas.concat(aud);
  }
  function avancarCursor(linhas) { for (const l of linhas) if (!cursor || l.atualizado_em > cursor) cursor = l.atualizado_em; }
  // Busca o que mudou desde a última vez e aplica nos dados em uso
  async function puxar() {
    if (!pronta || puxando || !navigator.onLine) return;
    puxando = true;
    try {
      const desde = cursor ? new Date(new Date(cursor).getTime() - 5000).toISOString() : '1970-01-01T00:00:00Z';
      const { data, error } = await sb.from('maparh_itens').select('colecao,id,dados,removido,atualizado_em').gte('atualizado_em', desde).order('atualizado_em').limit(1000);
      if (error) throw error;
      avancarCursor(data);
      let mudou = 0;
      const d = Store.dados;
      for (const l of data) {
        const chave = l.colecao + '/' + l.id;
        if (fila.has(chave)) continue; // há alteração local ainda não enviada: ela vale
        if (l.removido) { if (espelho.has(chave)) { espelho.delete(chave); tirarDoLugar(d, chave); mudou++; } continue; }
        const txt = marca(l.dados);
        if (espelho.get(chave) === txt) continue;
        espelho.set(chave, txt); porNoLugar(d, chave, l.dados); mudou++;
      }
      if (mudou) { ordenar(d); Store.reindexar(); salvarEspelho(); aoMudarRemoto(mudou); }
      if (estado === 'offline' || estado === 'erro') mudarEstado('ok');
      if (fila.size) agendarEnvio(200);
    } catch (e) {
      console.warn('Nuvem: falha ao buscar', e);
      mudarEstado(navigator.onLine ? 'erro' : 'offline', e.message || String(e));
    } finally { puxando = false; }
  }

  // ---------- local → nuvem ----------
  function comparar() {
    timerDiff = null;
    if (!pronta) return;
    const atual = itensDe(Store.dados);
    let mudou = false;
    for (const [chave, obj] of atual) {
      if (perfil === 'leitor' && !chave.startsWith('auditoria/')) continue; // visualizador só registra auditoria
      if (espelho.get(chave) !== marca(obj)) { if (fila.get(chave) !== 'u') mudou = true; fila.set(chave, 'u'); }
      else if (fila.has(chave)) { fila.delete(chave); mudou = true; }
    }
    if (perfil !== 'leitor') for (const chave of espelho.keys()) {
      if (!atual.has(chave) && !chave.startsWith('auditoria/') && fila.get(chave) !== 'd') { fila.set(chave, 'd'); mudou = true; }
    }
    if (mudou) salvarFila();
    if (fila.size) { mudarEstado(navigator.onLine ? 'enviando' : 'offline'); agendarEnvio(); }
  }
  // chamado pelo Store a cada gravação: várias gravações seguidas viram uma comparação só
  function mudou() { if (pronta && !timerDiff) timerDiff = setTimeout(comparar, 0); }
  function agendarEnvio(ms = 900) { clearTimeout(timerEnvio); timerEnvio = setTimeout(enviar, ms); }
  async function enviar() {
    if (!pronta || enviando || !fila.size) return;
    if (!navigator.onLine) { mudarEstado('offline'); return; }
    enviando = true; mudarEstado('enviando');
    try {
      await liberandoProjeto;
      const atual = itensDe(Store.dados);
      const lote = [...fila].slice(0, 400).map(([chave, op]) => {
        const [colecao, id] = partes(chave);
        const obj = atual.get(chave);
        if (op === 'u' && obj !== undefined) return { chave, txt: marca(obj), tam: JSON.stringify(obj).length, linha: { colecao, id, dados: obj, removido: false } };
        return { chave, txt: null, tam: 0, linha: { colecao, id, dados: null, removido: true } };
      });
      // lotes pequenos: um mapa PDR grande pode passar de 300 KB sozinho
      let grupo = [], tam = 0; const grupos = [];
      for (const it of lote) { const t = it.tam; if (grupo.length && (grupo.length >= 100 || tam + t > 900000)) { grupos.push(grupo); grupo = []; tam = 0; } grupo.push(it); tam += t; }
      if (grupo.length) grupos.push(grupo);
      for (const g of grupos) {
        const { error } = await sb.from('maparh_itens').upsert(g.map(x => x.linha), { onConflict: 'colecao,id' });
        if (error) throw error;
        for (const it of g) {
          if (it.txt === null) espelho.delete(it.chave); else espelho.set(it.chave, it.txt);
          fila.delete(it.chave);
        }
        salvarFila(); salvarEspelho();
      }
      enviando = false;
      comparar(); // algo pode ter mudado enquanto enviava
      if (!fila.size) mudarEstado('ok');
    } catch (e) {
      enviando = false;
      console.warn('Nuvem: falha ao enviar', e);
      mudarEstado(navigator.onLine ? 'erro' : 'offline', e.message || String(e));
      agendarEnvio(15000);
    }
  }
  async function enviarAgora() { clearTimeout(timerEnvio); if (timerDiff) { clearTimeout(timerDiff); comparar(); } for (let i = 0; i < 20 && fila.size && navigator.onLine && estado !== 'erro'; i++) await enviar(); }

  // ---------- usuários (membros) ----------
  const emailDe = login => { login = String(login || '').trim().toLowerCase(); return login.includes('@') ? login : login + '@maparh.local'; };
  async function funcao(corpo) {
    const { data: s } = await sb.auth.getSession();
    const r = await fetch(cfg.url + '/functions/v1/maparh-usuarios', { method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: cfg.chave, Authorization: 'Bearer ' + ((s.session && s.session.access_token) || cfg.chave) },
      body: JSON.stringify(corpo) });
    let j = null; try { j = await r.json(); } catch (e) { /* resposta sem corpo */ }
    if (!r.ok || !j) throw new Error('O servidor não respondeu (HTTP ' + r.status + '). Tente de novo.');
    if (j.erro) throw new Error(j.erro);
    return j;
  }
  async function carregarMembros() {
    const { data, error } = await sb.from('maparh_membros').select('*').order('nome');
    if (error) throw error;
    const lista = data.map(m => ({ id: m.user_id, nome: m.nome, login: m.login, perfil: m.perfil, ativo: m.ativo, projetos: m.projetos, criadoEm: m.criado_em, senhaPadrao: false }));
    const meu = lista.find(u => u.id === eu);
    if (!meu || !meu.ativo) return null;
    perfil = meu.perfil;
    Store.definirUsuarios(lista);
    return meu;
  }
  async function temAdmin() { return (await funcao({ acao: 'status' })).temAdmin; }
  async function criarPrimeiroAdmin({ nome, login, senha }) { await funcao({ acao: 'primeiro', nome, login, senha }); return entrar(login, senha); }
  async function salvarUsuario(obj) {
    await funcao({ acao: obj.id ? 'atualizar' : 'criar', id: obj.id, nome: obj.nome, login: obj.login, senha: obj.senha, perfil: obj.perfil, projetos: obj.projetos, ativo: obj.ativo });
    await carregarMembros();
    Store.auditar(obj.id ? 'usuario.editar' : 'usuario.criar', `Usuário ${String(obj.login || '').toLowerCase()} (${Store.PERFIS[obj.perfil]})`, Store.usuarioAtual());
  }
  async function excluirUsuario(u) {
    await funcao({ acao: 'excluir', id: u.id });
    await carregarMembros();
    Store.auditar('usuario.excluir', `Usuário ${u.login}`, Store.usuarioAtual());
  }
  async function alterarSenha(atual, nova) {
    if (!nova || nova.length < 6) throw new Error('A nova senha deve ter pelo menos 6 caracteres.');
    const u = Store.usuarioAtual();
    const { error } = await sb.auth.signInWithPassword({ email: emailDe(u.login), password: atual });
    if (error) throw new Error('Senha atual incorreta.');
    const { error: e2 } = await sb.auth.updateUser({ password: nova });
    if (e2) throw new Error(e2.message);
    Store.auditar('usuario.senha', 'Alterou a própria senha', u);
  }
  // Gestor restrito que cria um projeto: o banco só aceita o projeto novo depois de ele entrar na lista do gestor,
  // por isso o envio espera esta chamada terminar.
  let liberandoProjeto = Promise.resolve();
  function incluirProjeto(projetoId) { liberandoProjeto = funcao({ acao: 'incluirProjeto', projetoId }).catch(e => console.warn(e)); }
  // Registro de alterações gravado pelo próprio banco (só administrador lê)
  async function auditoriaBanco(limite = 300) {
    const { data, error } = await sb.from('maparh_auditoria').select('quando,login,operacao,tabela,colecao,item_id,antes,depois').order('quando', { ascending: false }).limit(limite);
    if (error) throw new Error(error.message);
    return data;
  }
  async function limparAuditoria() {
    for (const k of [...espelho.keys()]) if (k.startsWith('auditoria/')) espelho.delete(k);
    for (const k of [...fila.keys()]) if (k.startsWith('auditoria/')) fila.delete(k);
    const { error } = await sb.from('maparh_itens').delete().eq('colecao', 'auditoria');
    if (error) console.warn('Nuvem: não limpou a auditoria', error);
  }

  // ---------- entrada ----------
  // Primeira carga: a nuvem manda. Se ela está vazia, sobe o que este navegador tem.
  async function sincronizarInicial() {
    const linhas = await buscarTudo();
    avancarCursor(linhas);
    const local = Store.dados;
    const vinculado = localStorage.getItem(CHAVE_VINC) === cfg.url;
    fila = vinculado ? lerFila() : new Map();
    espelho = new Map();
    // Navegador entrando no banco pela primeira vez: as contratações antigas (de antes do banco central) não sobem —
    // decisão do RH em nov/2026: começar limpo. Um backup completo é baixado antes de descartar.
    let backupBaixado = false;
    if (!vinculado && (local.registros || []).length) {
      UI.baixarArquivo(`backup-antes-da-nuvem-${new Date().toISOString().slice(0, 10)}.json`, Store.exportar(), 'application/json');
      backupBaixado = true;
      const n = local.registros.length;
      local.registros = [];
      (local.candidatos || []).forEach(c => { if (c.registroId) { c.registroId = null; } });
      Store.salvar(true);
      UI.toast(`${n} contratação(ões) antigas deste navegador não foram levadas para o banco (ficaram no backup baixado).`, 'aviso', 9000);
    }
    if (linhas.length) {
      const novo = vazio();
      for (const l of linhas) { const chave = l.colecao + '/' + l.id; espelho.set(chave, marca(l.dados)); porNoLugar(novo, chave, l.dados); }
      const locais = itensDe(local);
      if (vinculado) {
        // alterações feitas aqui que não chegaram a ser enviadas (fechou a aba / estava sem internet)
        for (const [chave, op] of fila) { if (op === 'd') tirarDoLugar(novo, chave); else if (locais.has(chave)) porNoLugar(novo, chave, locais.get(chave)); }
      } else if ((local.projetos || []).length || (local.registros || []).length || (local.vagas || []).length || (local.candidatos || []).length) {
        // navegador com dados próprios entrando numa nuvem que já tem dados
        const resumo = `${(local.projetos || []).length} projeto(s), ${(local.registros || []).length} contratação(ões), ${(local.vagas || []).length} vaga(s) e ${(local.candidatos || []).length} candidato(s)`;
        if (!backupBaixado) UI.baixarArquivo(`backup-antes-da-nuvem-${new Date().toISOString().slice(0, 10)}.json`, Store.exportar(), 'application/json');
        const juntar = await UI.confirmar(`Este navegador tem dados que não estão no banco central: ${resumo}. Enviar para o banco e juntar com o que já está lá? (Um backup deste navegador acabou de ser baixado. Se cancelar, ficam valendo só os dados do banco.)`, { titulo: 'Dados deste navegador', textoOk: 'Enviar e juntar' });
        if (juntar) {
          const nomesDist = new Set(novo.distritos.map(x => Store.normalizar(x.nome))), nomesPdr = new Set(novo.mapasPdr.map(x => Store.normalizar(x.nome)));
          for (const [chave, obj] of locais) {
            if (espelho.has(chave) || chave.startsWith('meta/') || chave.startsWith('auditoria/')) continue;
            if (chave.startsWith('distritos/') && nomesDist.has(Store.normalizar(obj.nome))) continue;
            if (chave.startsWith('mapasPdr/') && nomesPdr.has(Store.normalizar(obj.nome))) continue;
            porNoLugar(novo, chave, obj);
          }
        }
      }
      ordenar(novo);
      Store.adotarDados(novo);
    }
    localStorage.setItem(CHAVE_VINC, cfg.url);
    salvarEspelho();
    pronta = true;
    comparar();
    if (!fila.size) mudarEstado('ok');
  }
  async function aposLogin(usuarioId) {
    eu = usuarioId;
    let meu;
    try { meu = await carregarMembros(); }
    catch (e) {
      // sem internet: segue com o que está guardado neste navegador e sincroniza quando voltar
      const cache = Store.usuarios().find(u => u.id === eu && u.ativo);
      if (!cache) throw new Error('Sem conexão com o banco de dados. Verifique a internet e tente de novo.');
      perfil = cache.perfil; Store.abrirSessao(eu);
      fila = lerFila(); espelho = lerEspelho(); pronta = true; // o que for alterado agora fica na fila e sobe quando a internet voltar
      mudarEstado('offline', e.message || String(e));
      iniciarRelogio(true);
      return Store.usuarioAtual();
    }
    if (!meu) { await sb.auth.signOut(); Store.fecharSessao(); throw new Error('Seu usuário não tem acesso ao Mapa RH (ou foi desativado). Fale com o administrador.'); }
    Store.abrirSessao(eu);
    await sincronizarInicial();
    iniciarRelogio(false);
    return Store.usuarioAtual();
  }
  let ouvindo = false, tiqueAtual = () => {};
  function iniciarRelogio(precisaCargaInicial) {
    clearInterval(timerPoll);
    let pendenteInicial = precisaCargaInicial;
    const tique = async () => {
      if (document.hidden || !navigator.onLine) return;
      if (pendenteInicial) { // entrou sem internet: faz a carga completa quando a conexão voltar
        try { if (!(await carregarMembros())) return App.sair(); await sincronizarInicial(); pendenteInicial = false; aoMudarRemoto(1); } catch (e) { return; }
      }
      await puxar();
    };
    tiqueAtual = tique;
    timerPoll = setInterval(tique, INTERVALO_MS);
    if (ouvindo) return;
    ouvindo = true;
    window.addEventListener('online', () => { if (eu) { tiqueAtual(); agendarEnvio(300); } });
    window.addEventListener('offline', () => { if (eu) mudarEstado('offline'); });
    document.addEventListener('visibilitychange', () => { if (eu && !document.hidden) tiqueAtual(); });
  }
  // Ao abrir a página: retoma a sessão guardada, se houver. Devolve o usuário ou null.
  async function iniciar() {
    sb = window.supabase.createClient(cfg.url, cfg.chave);
    const { data } = await sb.auth.getSession();
    if (!data.session) { Store.fecharSessao(); return null; }
    return aposLogin(data.session.user.id);
  }
  async function entrar(login, senha) {
    if (!sb) sb = window.supabase.createClient(cfg.url, cfg.chave);
    const { data, error } = await sb.auth.signInWithPassword({ email: emailDe(login), password: senha });
    if (error) throw new Error(/invalid login/i.test(error.message) ? 'Usuário ou senha inválidos.' : (navigator.onLine ? error.message : 'Sem internet: não foi possível entrar.'));
    const u = await aposLogin(data.user.id);
    Store.auditar('login', 'Entrou no sistema', u);
    return u;
  }
  async function sair() {
    try { await enviarAgora(); } catch (e) { /* segue saindo */ }
    clearInterval(timerPoll); pronta = false; eu = null; perfil = null;
    try { await sb.auth.signOut(); } catch (e) { /* sem internet */ }
  }
  function aoReceber(fn) { aoMudarRemoto = fn; }

  if (ativa) Store.definirGanchoSalvar(mudou);

  return { ativa, iniciar, entrar, sair, temAdmin, criarPrimeiroAdmin, salvarUsuario, excluirUsuario, alterarSenha, incluirProjeto, limparAuditoria,
    carregarMembros, puxar, enviarAgora, aoReceber, auditoriaBanco, textoEstado, get pendentes() { return fila.size; } };
})();
