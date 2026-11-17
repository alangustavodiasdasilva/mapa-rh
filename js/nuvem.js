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
  const COLECOES = ['projetos', 'registros', 'vagas', 'candidatos', 'distritos', 'mapasPdr', 'cidades', 'cargos', 'auditoria'];
  const META = ['config', 'sineExtra', 'sineBusca', 'sineBuscaUF'];
  const SEEDS = ['seedPdrCarregado', 'seedDistritosAplicados', 'seedDistritosCarregado', 'versao'];
  const INTERVALO_MS = 15000;   // reserva: o normal é o aviso na hora do banco (Realtime)

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
        if (fila.has(chave) && !l.removido) continue; // há alteração local ainda não enviada: ela vale (menos sobre item que alguém excluiu)
        if (fila.has(chave)) { fila.delete(chave); salvarFila(); }
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
  const recusadasFixas = new Map();   // chave → versão que o banco recusou
  function comparar() {
    timerDiff = null;
    if (!pronta) return;
    const atual = itensDe(Store.dados);
    let mudou = false;
    // o que cada perfil pode gravar: visualizador só a auditoria; RH (analista) a auditoria e as contratações que nascem da admissão
    const podeGravar = chave => perfil === 'leitor' ? chave.startsWith('auditoria/') : perfil === 'analista' ? /^(auditoria|registros)\//.test(chave) : true;
    // fila antiga com algo que este perfil não pode gravar (ex.: sobrou de outro usuário no mesmo navegador) sai da fila
    for (const chave of [...fila.keys()]) if (!podeGravar(chave)) { fila.delete(chave); mudou = true; }
    for (const [chave, obj] of atual) {
      if (!podeGravar(chave)) continue;
      if (recusadasFixas.has(chave)) { if (recusadasFixas.get(chave) === marca(obj) || !espelho.has(chave)) continue; recusadasFixas.delete(chave); }
      if (espelho.get(chave) !== marca(obj)) { if (fila.get(chave) !== 'u') mudou = true; fila.set(chave, 'u'); }
      else if (fila.has(chave)) { fila.delete(chave); mudou = true; }
    }
    for (const chave of espelho.keys()) {
      if (!atual.has(chave) && !chave.startsWith('auditoria/') && podeGravar(chave) && fila.get(chave) !== 'd') { fila.set(chave, 'd'); mudou = true; }
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
      const recusadas = [];
      const enviarGrupo = async g => {
        // auditoria: o banco só aceita inserir (ninguém altera histórico). Se a linha já está lá, conta como enviada.
        const ehAud = x => x.linha.colecao === 'auditoria' && !x.linha.removido;
        const aud = g.filter(ehAud);
        if (aud.length && aud.length < g.length) { await enviarGrupo(aud); await enviarGrupo(g.filter(x => !ehAud(x))); return; }
        let error;
        if (aud.length) {
          ({ error } = await sb.from('maparh_itens').insert(g.map(x => x.linha)));
          if (error && /23505|duplicate key/.test((error.code || '') + (error.message || ''))) {
            if (g.length > 1) { const m = Math.ceil(g.length / 2); await enviarGrupo(g.slice(0, m)); await enviarGrupo(g.slice(m)); return; }
            error = null;   // já estava no banco
          }
        } else ({ error } = await sb.from('maparh_itens').upsert(g.map(x => x.linha), { onConflict: 'colecao,id' }));
        if (error) {
          if (!/row-level security|permission denied|42501/.test((error.message || '') + (error.code || ''))) throw error;
          if (g.length > 1) { const m = Math.ceil(g.length / 2); await enviarGrupo(g.slice(0, m)); await enviarGrupo(g.slice(m)); return; }
          // sem permissão para esta: sai da fila e não volta enquanto não for alterada de novo (sem isso, fica tentando para sempre)
          const ch = g[0].chave; recusadas.push(ch); fila.delete(ch);
          recusadasFixas.set(ch, g[0].txt);
          if (espelho.has(ch)) espelho.delete(ch);              // o puxar seguinte repõe a versão do banco
          else { tirarDoLugar(Store.dados, ch); Store.reindexar(); }   // não existe no banco: some daqui
          return;
        }
        for (const it of g) {
          if (it.txt === null) espelho.delete(it.chave); else espelho.set(it.chave, it.txt);
          fila.delete(it.chave);
        }
      };
      for (const g of grupos) { await enviarGrupo(g); salvarFila(); salvarEspelho(); }
      if (recusadas.length) {
        console.warn('Nuvem: o banco recusou (sem permissão)', recusadas);
        if (!enviar.avisou || Date.now() - enviar.avisou > 60000) UI.toast(`${recusadas.length === 1 ? '1 alteração não foi gravada' : recusadas.length + ' alterações não foram gravadas'}: seu usuário não tem permissão para isso. Os dados voltam ao que está no banco.`, 'aviso', 9000);
        enviar.avisou = Date.now();
        cursor = null; setTimeout(() => puxar(), 500);   // busca de novo a versão do banco
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
    const lista = data.map(m => ({ id: m.user_id, nome: m.nome, login: m.login, perfil: m.perfil, ativo: m.ativo, projetos: m.projetos, rh: !!m.rh, foto: m.foto || null, mensagens: m.mensagens || null, criadoEm: m.criado_em, senhaPadrao: false }));
    const meu = lista.find(u => u.id === eu);
    if (!meu || !meu.ativo) return null;
    perfil = meu.perfil;
    Store.definirUsuarios(lista);
    return meu;
  }
  async function temAdmin() { return (await funcao({ acao: 'status' })).temAdmin; }
  async function criarPrimeiroAdmin({ nome, login, senha }) { await funcao({ acao: 'primeiro', nome, login, senha }); return entrar(login, senha); }
  async function salvarUsuario(obj) {
    const resp = await funcao({ acao: obj.id ? 'atualizar' : 'criar', id: obj.id, nome: obj.nome, login: obj.login, senha: obj.senha, perfil: obj.perfil, projetos: obj.projetos, ativo: obj.ativo });
    const idUsuario = obj.id || resp.id;
    // acesso à pré-admissão (dados pessoais): só administrador concede; administrador já tem
    if (idUsuario && obj.rh !== undefined && obj.perfil !== 'admin') { const { error } = await sb.rpc('maparh_definir_rh', { p_usuario: idUsuario, p_rh: !!obj.rh }); if (error) throw new Error(error.message); }
    if (idUsuario && obj.foto !== undefined) { const { error } = await sb.rpc('maparh_definir_foto', { p_usuario: idUsuario, p_foto: obj.foto || null }); if (error) throw new Error(/foto_check/.test(error.message) ? 'Foto grande demais. Escolha outra imagem.' : error.message); }
    await carregarMembros();
    Store.auditar(obj.id ? 'usuario.editar' : 'usuario.criar', `Usuário ${String(obj.login || '').toLowerCase()} (${Store.PERFIS[obj.perfil]})`, Store.usuarioAtual());
  }
  // a própria foto (qualquer usuário)
  // modelos de mensagem do WhatsApp do próprio usuário
  async function minhasMensagens(msgs) {
    const { error } = await sb.rpc('maparh_definir_mensagens', { p_msgs: msgs || null });
    if (error) throw new Error(/mensagens_check/.test(error.message) ? 'Mensagens grandes demais.' : error.message);
    return carregarMembros();
  }
  async function minhaFoto(foto) {
    const { error } = await sb.rpc('maparh_definir_foto', { p_usuario: eu, p_foto: foto || null });
    if (error) throw new Error(/foto_check/.test(error.message) ? 'Foto grande demais. Escolha outra imagem.' : error.message);
    return carregarMembros();
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

  // ---------- pré-admissão (tabelas próprias; nada disso fica na cópia local do navegador) ----------
  function erroRh(e) {
    const m = (e && e.message) || String(e);
    if (/maparh_pre_unica_aberta/.test(m)) return new Error('Esta pessoa já está em andamento neste projeto.');
    if (/maparh_pessoas_cpf_key/.test(m)) return new Error('Já existe uma pessoa com este CPF.');
    if (/maparh_pessoas_cpf_check/.test(m)) return new Error('CPF inválido.');
    if (/maparh_pessoas_nascimento_check/.test(m)) return new Error('Data de nascimento inválida (no futuro ou antes de 1920).');
    if (/ADMISSAO_BLOQUEADA: ?(.*)/.test(m)) return new Error('O banco não deixou admitir: ' + m.match(/ADMISSAO_BLOQUEADA: ?(.*)/)[1] + '.');
    if (/PESSOA_ADMITIDA_TRAVADA/.test(m)) return new Error('Esta pessoa já foi admitida: CPF e data de nascimento não podem mais mudar.');
    if (/maparh_pre_unica_admitida/.test(m)) return new Error('Esta pessoa já foi admitida neste projeto.');
    if (/ADMITIDO_TRAVADO/.test(m)) return new Error('Pessoa já admitida: para mudar documentos, ASO, treinamento ou etapa, desfaça a admissão primeiro.');
    if (/row-level security|permission denied/.test(m)) return new Error('Você não tem permissão para isso. O RH só altera os candidatos que estão no nome dele; para o resto, peça ao administrador.');
    return new Error(m);
  }
  async function paginar(montar) {
    const tudo = [];
    for (let de = 0; ; de += 1000) {
      const { data, error } = await montar().range(de, de + 999);
      if (error) throw erroRh(error);
      tudo.push(...data);
      if (data.length < 1000) break;
    }
    return tudo;
  }
  const rh = {
    // Só os campos de andamento de todos os candidatos que o usuário enxerga (sem dado pessoal): alimenta a contagem das vagas e o Início
    async andamento(projetoId) {
      // pela função do banco: sem dado pessoal, vale para qualquer membro do projeto (diretoria inclusive)
      return paginar(() => sb.rpc('maparh_andamento', { p_projeto: projetoId || null }).order('id'));
    },
    // { vagaId: { candidatos, admitidos, emProcesso } } para Store.definirContagemVagas
    async contagemVagas(projetoId) {
      // contagem pela função do banco: vale para qualquer membro (sem dado pessoal) e conta todos os RHs, não só os do usuário
      // { vagaId: { candidatos, admitidos, emProcesso, etapas: {triagem, entrevista, documentos}, dist: { distritoId|'(sem)': { LOCAL: {adm, proc}, MOVEL: {adm, proc} } } } }
      const { data, error } = await sb.rpc('maparh_contagem_vagas', { p_projeto: projetoId || null });
      if (error) throw erroRh(error);
      const mapa = {};
      for (const r of data || []) {
        const c = mapa[r.vaga_id] || (mapa[r.vaga_id] = { candidatos: 0, admitidos: 0, emProcesso: 0, etapas: { triagem: 0, entrevista: 0, documentos: 0 }, dist: {} });
        const d = c.dist[r.distrito_id || '(sem)'] || (c.dist[r.distrito_id || '(sem)'] = { LOCAL: { adm: 0, proc: 0 }, MOVEL: { adm: 0, proc: 0 } });
        const tp = d[r.tipo === 'MOVEL' ? 'MOVEL' : 'LOCAL'], n = +r.n;
        c.candidatos += n;
        if (r.situacao === 'admitido') { c.admitidos += n; tp.adm += n; } else { c.emProcesso += n; tp.proc += n; c.etapas[r.etapa] = (c.etapas[r.etapa] || 0) + n; }
      }
      return mapa;
    },
    // direciona (ou muda a etapa de) várias pessoas de uma vez
    async atualizarVarios(ids, campos) {
      let feitos = 0;
      for (let i = 0; i < ids.length; i += 200) { const { data, error } = await sb.from('maparh_preadmissoes').update(campos).in('id', ids.slice(i, i + 200)).select('id'); if (error) throw erroRh(error); feitos += (data || []).length; }
      // o banco não dá erro quando a regra de acesso esconde a linha: só não muda. Então conferimos quantas mudaram.
      if (feitos < ids.length) throw new Error(`${ids.length - feitos} de ${ids.length} não foram alterados (sem permissão ou direcionados para outro RH). Recarregue a tela.`);
    },
    async listar(projetoId) {
      const tudo = [];
      for (let de = 0; ; de += 1000) {
        const { data, error } = await sb.from('maparh_preadmissoes').select('*, pessoa:maparh_pessoas(*)').eq('projeto_id', projetoId)
          .order('chegada_data', { ascending: true, nullsFirst: false }).order('criado_em').range(de, de + 999);
        if (error) throw erroRh(error);
        tudo.push(...data);
        if (data.length < 1000) break;
      }
      return tudo.filter(p => p.pessoa);
    },
    async pessoaPorCPF(cpf) {
      // pela função do banco: o RH (analista) não lê a tabela inteira, mas precisa reaproveitar o cadastro de quem já passou pela empresa
      const { data, error } = await sb.rpc('maparh_pessoa_do_cpf', { p_cpf: cpf });
      if (error) throw erroRh(error);
      return data;
    },
    // pessoa + processo numa chamada só ao banco: ou grava tudo, ou nada
    async salvar(pessoa, pre) {
      const { data, error } = await sb.rpc('maparh_salvar_candidato', { p_pessoa: pessoa, p_pre: pre });
      if (error) throw erroRh(error);
      return data;
    },
    // anotação no histórico do candidato (autor e hora gravados pelo banco)
    async anotar(id, texto) {
      const { data, error } = await sb.rpc('maparh_anotar', { p_pre: id, p_texto: texto });
      if (error) throw erroRh(error);
      return data;
    },
    // admitir: o banco valida tudo e cria a contratação (registro do mapa) na mesma operação
    async admitir(id, atuacao, base) {
      const { data, error } = await sb.rpc('maparh_admitir', { p_pre: id, p_atuacao: atuacao, p_base: base || null });
      if (error) throw erroRh(error);
      setTimeout(() => puxar(), 300);   // a contratação nova chega no mapa
      return data;
    },
    async desfazerAdmissao(id, motivo) {
      const { error } = await sb.rpc('maparh_desfazer_admissao', { p_pre: id, p_motivo: motivo });
      if (error) throw erroRh(error);
      setTimeout(() => puxar(), 300);
    },
    async atualizar(id, campos) {
      const { data, error } = await sb.from('maparh_preadmissoes').update(campos).eq('id', id).select('id');
      if (error) throw erroRh(error);
      if (!data || !data.length) throw new Error('Não foi gravado: este candidato não está mais com você (pode ter sido direcionado para outro RH). Recarregue a tela.');
    },
    async excluir(id) { const { error } = await sb.from('maparh_preadmissoes').delete().eq('id', id); if (error) throw erroRh(error); },
    async importar(projetoId, arquivo, linhas) {
      const { data, error } = await sb.rpc('maparh_importar_preadmissoes', { p_projeto: projetoId, p_arquivo: arquivo, p_linhas: linhas });
      if (error) throw erroRh(error);
      return data;
    },
    async desfazer(lote) { const { data, error } = await sb.rpc('maparh_desfazer_importacao', { p_lote: lote }); if (error) throw erroRh(error); return data; },
    async importacoes(projetoId) {
      const { data, error } = await sb.from('maparh_importacoes').select('id, arquivo, criado_em, criado_login, importadas, ignoradas, desfeita_em').eq('projeto_id', projetoId).order('criado_em', { ascending: false }).limit(8);
      if (error) throw erroRh(error);
      return data;
    }
  };

  // ---------- colaboradores e desligamentos (tabelas próprias; gravação só pelas funções do banco) ----------
  function erroColab(e) {
    const m = (e && e.message) || String(e);
    if (/maparh_vinculos_um_ativo/.test(m)) return new Error('Esta pessoa já tem um vínculo ativo na empresa. Registre o desligamento antes de admitir de novo.');
    if (/row-level security|permission denied/.test(m)) return new Error('Você não tem permissão para isso. Peça ao administrador o acesso aos dados de colaboradores deste projeto.');
    if (/Could not find the (function|table)|schema cache|does not exist/.test(m)) return new Error('O módulo de colaboradores ainda não foi instalado no banco (falta aplicar a migração colaboradores.sql).');
    return new Error(m);
  }
  const colab = {
    // vínculos de um projeto, com a pessoa e (se houver) o desligamento embutidos
    async listar(projetoId) {
      const tudo = [];
      for (let de = 0; ; de += 1000) {
        const { data, error } = await sb.from('maparh_vinculos').select('*, pessoa:maparh_pessoas(*), desligamento_reg:maparh_desligamentos(*)').eq('projeto_id', projetoId)
          .order('admissao', { ascending: false }).order('id').range(de, de + 999);
        if (error) throw erroColab(error);
        tudo.push(...data);
        if (data.length < 1000) break;
      }
      // o desligamento é um por vínculo; dependendo da versão da API vem como objeto ou como lista de um item
      return tudo.filter(v => v.pessoa).map(v => ({ ...v, desligamento_reg: (Array.isArray(v.desligamento_reg) ? v.desligamento_reg[0] : v.desligamento_reg) || null }));
    },
    // histórico de um vínculo em ordem cronológica
    async historico(vinculoId) {
      const { data, error } = await sb.from('maparh_vinculo_eventos').select('*').eq('vinculo_id', vinculoId).order('vigencia').order('criado_em').limit(1000);
      if (error) throw erroColab(error);
      return data;
    },
    // cria o vínculo a partir de uma pré-admissão admitida; chamar de novo devolve o mesmo vínculo
    async admitir(preadmissaoId, admissao) {
      const { data, error } = await sb.rpc('maparh_admitir_colaborador', { p_preadmissao: preadmissaoId, p_admissao: admissao || null });
      if (error) throw erroColab(error);
      return data;
    },
    // apaga o vínculo de uma admissão lançada por engano (só se ainda não tem movimentação nem desligamento)
    async desfazerAdmissao(preadmissaoId) {
      const { data, error } = await sb.rpc('maparh_desfazer_admissao_colaborador', { p_preadmissao: preadmissaoId });
      if (error) throw erroColab(error);
      return data;
    },
    // tipo: 'transferencia' (unidade, cidade_atuacao_id, tipo), 'cargo' (cargo, tipo_vinculo) ou 'gestor' (gestor); para = só o que muda
    async movimentar(vinculoId, tipo, vigencia, para, obs) {
      const { data, error } = await sb.rpc('maparh_movimentar_colaborador', { p_vinculo: vinculoId, p_tipo: tipo, p_vigencia: vigencia, p_para: para, p_obs: obs || null });
      if (error) throw erroColab(error);
      return data;
    },
    async desligar(vinculoId, { data: dia, tipo, motivo, observacao, repor }) {
      const { data, error } = await sb.rpc('maparh_desligar_colaborador', { p_vinculo: vinculoId, p_data: dia, p_tipo: tipo, p_motivo: motivo || null, p_obs: observacao || null, p_repor: !!repor });
      if (error) throw erroColab(error);
      return data;
    },
    async atualizarReposicao(desligamentoId, situacao) {
      const { data, error } = await sb.from('maparh_desligamentos').update({ reposicao_situacao: situacao }).eq('id', desligamentoId).select('id');
      if (error) throw erroColab(error);
      if (!data.length) throw new Error('Você não tem permissão para alterar a reposição deste desligamento.');
    },
    // indicadores mensais (headcount no primeiro e no último dia, admissões, desligamentos, turnover); de/ate em 'aaaa-mm-dd'
    async indicadores(projetoId, de, ate) {
      const { data, error } = await sb.rpc('maparh_indicadores_colaboradores', { p_projeto: projetoId || null, p_de: de || null, p_ate: ate || null });
      if (error) throw erroColab(error);
      return data;
    }
  };

  // ---------- entrada ----------
  // Primeira carga: a nuvem manda. Se ela está vazia, sobe o que este navegador tem.
  async function sincronizarInicial() {
    const linhas = await buscarTudo();
    avancarCursor(linhas);
    const local = Store.dados;
    // vínculo = banco + usuário. Navegador que já esteve neste banco com OUTRO usuário: nada do anterior é aproveitado
    // (nem a fila, nem a cópia local), para não enviar em nome de outra pessoa nem mostrar dados que este usuário não pode ver.
    const v = localStorage.getItem(CHAVE_VINC) || '';
    const jaNaNuvem = v === cfg.url || v.startsWith(cfg.url + '|'), mesmoUsuario = v === cfg.url + '|' + eu || v === cfg.url;
    const vinculado = jaNaNuvem && mesmoUsuario;
    fila = vinculado ? lerFila() : new Map();
    if (jaNaNuvem && !mesmoUsuario) { localStorage.removeItem(CHAVE_FILA); localStorage.removeItem(CHAVE_ESPELHO); }
    espelho = new Map();
    // Navegador entrando no banco pela primeira vez: as contratações antigas (de antes do banco central) não sobem —
    // decisão do RH em nov/2026: começar limpo. Um backup completo é baixado antes de descartar.
    let backupBaixado = false;
    if (!jaNaNuvem && (local.registros || []).length) {
      UI.baixarArquivo(`backup-antes-da-nuvem-${new Date().toISOString().slice(0, 10)}.json`, Store.exportar(), 'application/json');
      backupBaixado = true;
      const n = local.registros.length;
      local.registros = [];
      (local.candidatos || []).forEach(c => { if (c.registroId) { c.registroId = null; } });
      Store.salvar(true);
      UI.toast(`${n} contratação(ões) antigas deste navegador não foram levadas para o banco (ficaram no backup baixado).`, 'aviso', 9000);
    }
    if (linhas.length || jaNaNuvem) {
      const novo = vazio();
      for (const l of linhas) { const chave = l.colecao + '/' + l.id; espelho.set(chave, marca(l.dados)); porNoLugar(novo, chave, l.dados); }
      const locais = itensDe(local);
      if (vinculado) {
        // alterações feitas aqui que não chegaram a ser enviadas (fechou a aba / estava sem internet)
        for (const [chave, op] of fila) { if (op === 'd') tirarDoLugar(novo, chave); else if (locais.has(chave)) porNoLugar(novo, chave, locais.get(chave)); }
      } else if (!jaNaNuvem && ((local.projetos || []).length || (local.registros || []).length || (local.vagas || []).length || (local.candidatos || []).length)) {
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
    localStorage.setItem(CHAVE_VINC, cfg.url + '|' + eu);
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
      if (navigator.onLine) throw new Error('Não foi possível conferir o seu acesso no banco: ' + (e.message || e) + '. Tente de novo.');
      // sem internet: segue com o que está guardado neste navegador e sincroniza quando voltar
      const cache = Store.usuarios().find(u => u.id === eu && u.ativo) && (localStorage.getItem(CHAVE_VINC) || '').endsWith('|' + eu) ? Store.usuarios().find(u => u.id === eu) : null;
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
  // Aviso na hora: o banco avisa quando algo muda (vagas, cadastros, candidatos); cada um só recebe o que pode ler.
  let canal = null, timerAviso = null, aoMudarCandidatos = () => {};
  function ouvirNaHora() {
    if (canal || !sb) return;
    const puxarLogo = () => { clearTimeout(timerAviso); timerAviso = setTimeout(() => puxar(), 250); };
    let timerRh = null;
    const candidatosLogo = () => { clearTimeout(timerRh); timerRh = setTimeout(() => aoMudarCandidatos(), 400); };
    try {
      canal = sb.channel('maparh-na-hora')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'maparh_itens' }, puxarLogo)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'maparh_preadmissoes' }, candidatosLogo)
        .subscribe();
    } catch (e) { console.warn('Nuvem: sem aviso na hora', e); canal = null; }
  }
  function pararDeOuvir() { if (canal && sb) { try { sb.removeChannel(canal); } catch (e) { /* ok */ } } canal = null; }
  function iniciarRelogio(precisaCargaInicial) {
    clearInterval(timerPoll);
    let pendenteInicial = precisaCargaInicial, voltas = 0;
    const tique = async () => {
      if (document.hidden || !navigator.onLine) return;
      if (++voltas % 10 === 0 && !pendenteInicial) {
        try { if (!(await carregarMembros())) { UI.toast('Seu usuário foi desativado ou perdeu o acesso.', 'aviso', 8000); return App.sair(); } }
        catch (e) { if (/JWT|401|refresh|session/i.test(e.message || '')) { UI.toast('Sua sessão expirou. Entre de novo.', 'aviso', 8000); return App.sair(); } }
      }
      if (pendenteInicial) { // entrou sem internet: faz a carga completa quando a conexão voltar
        try { if (!(await carregarMembros())) return App.sair(); await sincronizarInicial(); pendenteInicial = false; aoMudarRemoto(1); } catch (e) { return; }
      }
      await puxar();
    };
    tiqueAtual = tique;
    timerPoll = setInterval(tique, INTERVALO_MS);
    if (!precisaCargaInicial) ouvirNaHora();
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
    let s = null; try { s = JSON.parse(localStorage.getItem('maparh:sessao') || 'null'); } catch (e) { s = null; }
    if (!s || !s.expira || s.expira < Date.now() || s.usuarioId !== data.session.user.id) { try { await sb.auth.signOut(); } catch (e) { /* sem internet */ } Store.fecharSessao(); return null; }
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
    pararDeOuvir();
    if (fila.size) {
      try { UI.baixarArquivo(`alteracoes-nao-enviadas-${RH.hoje()}.json`, Store.exportar(), 'application/json'); } catch (e) { /* sem como baixar */ }
      UI.toast(`${fila.size} alteração(ões) não chegaram ao banco (sem internet?). Um backup foi baixado.`, 'aviso', 10000);
    }
    clearInterval(timerPoll); pronta = false; eu = null; perfil = null;
    // nada do usuário fica neste navegador: cópia dos dados, fila, espelho e filtros
    fila = new Map(); espelho = new Map(); cursor = null;
    for (const k of [CHAVE_FILA, CHAVE_ESPELHO, 'maparh:filtros']) localStorage.removeItem(k);
    Store.limparCacheLocal();
    try { await sb.auth.signOut(); } catch (e) { /* sem internet */ }
  }
  function aoReceber(fn) { aoMudarRemoto = fn; }
  function aoMudarRh(fn) { aoMudarCandidatos = fn; }

  if (ativa) Store.definirGanchoSalvar(mudou);

  return { ativa, iniciar, entrar, sair, temAdmin, criarPrimeiroAdmin, salvarUsuario, excluirUsuario, alterarSenha, incluirProjeto, limparAuditoria,
    carregarMembros, minhaFoto, minhasMensagens, puxar, enviarAgora, aoReceber, aoMudarRh, pararDeOuvir, auditoriaBanco, rh, colab, textoEstado, get pendentes() { return fila.size; } };
})();
