// Teste da sincronização com um Supabase de mentira (tabela em memória). Uso, na pasta do projeto: node testes/nuvem.test.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const raiz = process.argv[2] || path.join(__dirname, '..');
const fontes = ['js/store.js', 'js/nuvem.js'].map(f => fs.readFileSync(path.join(raiz, f), 'utf8')).join('\n;\n');
const dormir = ms => new Promise(r => setTimeout(r, ms));

// ---------- banco de mentira ----------
const tabela = new Map(); let relogio = Date.parse('2026-11-16T12:00:00Z'); const membros = [];
let falharRede = false, insertsDuplicados = 0;
const embaralhar = o => (o && typeof o === 'object' && !Array.isArray(o)) ? Object.fromEntries(Object.keys(o).sort().reverse().map(k => [k, embaralhar(o[k])])) : Array.isArray(o) ? o.map(embaralhar) : o;
function consulta(nome, quem) {
  const f = []; let op = 'select', carga = null, lim = null, faixa = null, ordem = [];
  const q = {
    select() { return q; }, neq(c, v) { f.push(r => r[c] !== v); return q; }, eq(c, v) { f.push(r => r[c] === v); return q; },
    gte(c, v) { f.push(r => r[c] >= v); return q; }, order(c, o) { ordem.push([c, o && o.ascending === false ? -1 : 1]); return q; },
    range(a, b) { faixa = [a, b]; return q; }, limit(n) { lim = n; return q; },
    upsert(linhas) { op = 'upsert'; carga = linhas; return q; }, insert(linhas) { op = 'insert'; carga = linhas; return q; }, delete() { op = 'delete'; return q; },
    then(ok, erro) { return exec().then(ok, erro); }
  };
  async function exec() {
    if (falharRede) return { data: null, error: { message: 'rede caiu' } };
    if (nome === 'maparh_membros') return { data: membros.map(m => ({ ...m })), error: null };
    // como no banco: auditoria só se insere; repetida dá 23505 (o lote inteiro falha)
    if (op === 'insert') {
      if (carga.some(l => tabela.has(l.colecao + '/' + l.id))) { insertsDuplicados++; return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } }; }
      op = 'upsert';
    }
    if (op === 'upsert') {
      if (carga.some(l => l.colecao === 'auditoria' && tabela.has(l.colecao + '/' + l.id))) return { data: null, error: { code: '42501', message: 'new row violates row-level security policy' } };
      if (quem.perfil === 'leitor' && carga.some(l => l.colecao !== 'auditoria')) return { data: null, error: { message: 'RLS' } };
      for (const l of carga) { relogio += 1000; tabela.set(l.colecao + '/' + l.id, { ...l, dados: embaralhar(JSON.parse(JSON.stringify(l.dados))), atualizado_em: new Date(relogio).toISOString() }); }
      return { data: null, error: null };
    }
    let linhas = [...tabela.values()].filter(r => f.every(fn => fn(r)) && (op === 'delete' || r.colecao !== 'auditoria' || quem.perfil === 'admin'));
    if (op === 'delete') { linhas.forEach(r => tabela.delete(r.colecao + '/' + r.id)); return { data: null, error: null }; }
    linhas.sort((a, b) => { for (const [c, s] of ordem) { if (a[c] < b[c]) return -s; if (a[c] > b[c]) return s; } return 0; });
    if (faixa) linhas = linhas.slice(faixa[0], faixa[1] + 1);
    if (lim != null) linhas = linhas.slice(0, lim);
    return { data: linhas.map(r => JSON.parse(JSON.stringify(r))), error: null };
  }
  return q;
}

// ---------- um "navegador" ----------
function navegador(usuarioId, { confirmar = true } = {}) {
  const guarda = new Map(); const avisos = []; const baixados = [];
  // quem abre a página já logado tem a sessão do sistema válida (sem ela, a sessão do banco é encerrada)
  guarda.set('maparh:sessao', JSON.stringify({ usuarioId, expira: Date.now() + 3600e3 }));
  const quem = membros.find(m => m.user_id === usuarioId);
  const ctx = {
    console, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {}, Date, JSON, Math, Object, Array, Map, Set, String, Number, Promise, Error, parseInt, parseFloat, isNaN, encodeURIComponent,
    localStorage: { getItem: k => guarda.has(k) ? guarda.get(k) : null, setItem: (k, v) => guarda.set(k, String(v)), removeItem: k => guarda.delete(k), key: i => [...guarda.keys()][i], get length() { return guarda.size; } },
    navigator: { onLine: true },
    document: { hidden: false, getElementById: () => null, querySelector: () => null, addEventListener: () => {}, createElement: () => ({}), head: { appendChild: () => {} } },
    UI: { toast: (m) => avisos.push(m), baixarArquivo: (n) => baixados.push(n), confirmar: async () => confirmar },
    sha256: s => 'h' + s, fetch: async () => ({ ok: true, json: async () => ({ ok: true, temAdmin: true }) }),
    MAPARH_NUVEM: { url: 'https://falso.supabase.co', chave: 'k' },
    supabase: { createClient: () => ({ from: n => consulta(n, quem), auth: { getSession: async () => ({ data: { session: { user: { id: usuarioId }, access_token: 't' } } }), signOut: async () => ({}) } }) },
    addEventListener: () => {}
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fontes + '\n;this.Store = Store; this.Nuvem = Nuvem;', ctx);
  ctx.avisos = avisos; ctx.baixados = baixados; ctx.guarda = guarda;
  return ctx;
}
let falhas = 0;
const conferir = (nome, cond, extra = '') => { console.log((cond ? 'ok   ' : 'FALHA') + ' ' + nome + (cond ? '' : ' ' + extra)); if (!cond) falhas++; };
const cidade = (S, n, uf) => { S.salvarCidade({ nome: n, uf, lat: -28, lng: -51, origem: 'manual' }); return S.resolverCidade(n, uf); };

(async () => {
  membros.push({ user_id: 'u-admin', login: 'ana', nome: 'Ana', perfil: 'admin', projetos: null, ativo: true, criado_em: '2026-11-16' },
    { user_id: 'u-gestor', login: 'beto', nome: 'Beto', perfil: 'gestor', projetos: null, ativo: true, criado_em: '2026-11-16' },
    { user_id: 'u-leitor', login: 'caio', nome: 'Caio', perfil: 'leitor', projetos: null, ativo: true, criado_em: '2026-11-16' });

  // 1) navegador A com dados locais antigos (inclui contratação) entra numa nuvem vazia
  const A = navegador('u-admin'); A.Store.init();
  const adm0 = A.Store.usuarios()[0];
  const pA = A.Store.salvarProjeto({ nome: 'Sul 2026', uf: 'RS', ufs: ['RS', 'SC', 'PR'], ano: 2026 }, adm0);
  const lv = cidade(A.Store, 'Lagoa Vermelha', 'RS'), vac = cidade(A.Store, 'Vacaria', 'RS');
  A.Store.adicionarRegistro({ projetoId: pA.id, tipo: 'LOCAL', cidadeId: vac.id, atuacao: lv.id }, adm0);
  const vA = A.Store.salvarVaga({ titulo: 'Operador', projetoId: pA.id, cidadeId: lv.id, tipo: 'LOCAL', quantidade: 1 }, adm0);
  let recebidasA = 0; A.Nuvem.aoReceber(() => recebidasA++);
  const uA = await A.Nuvem.iniciar(); await dormir(1500);
  conferir('A entrou como admin vindo dos membros', uA && uA.perfil === 'admin' && uA.login === 'ana' && A.Store.usuarios().length === 3);
  conferir('contratação antiga NÃO subiu e backup foi baixado', ![...tabela.keys()].some(k => k.startsWith('registros/')) && A.baixados.length === 1 && A.Store.registros().length === 0);
  conferir('projeto, vaga, cidades e meta subiram', tabela.has('projetos/' + pA.id) && tabela.has('vagas/' + vA.id) && tabela.has('cidades/' + lv.id) && tabela.has('meta/seeds'));
  conferir('fila de A vazia', A.Nuvem.pendentes === 0, 'pendentes=' + A.Nuvem.pendentes);

  // 2) A grava mais coisas; eco do próprio envio não deve voltar como "mudança de outro"
  const rA = A.Store.adicionarRegistro({ projetoId: pA.id, tipo: 'MOVEL', cidadeId: vac.id, atuacao: lv.id, baseContratacao: lv.id }, uA);
  await dormir(1500); await A.Nuvem.puxar();
  conferir('nova contratação de A subiu', tabela.has('registros/' + rA.id) && !tabela.get('registros/' + rA.id).removido);
  conferir('eco do próprio envio ignorado (chaves reordenadas pelo banco)', recebidasA === 0 && A.Nuvem.pendentes === 0, `recebidas=${recebidasA} pend=${A.Nuvem.pendentes}`);

  // 3) navegador B (gestor, vazio) entra e recebe tudo
  const B = navegador('u-gestor'); B.Store.init(); let recebidasB = 0; B.Nuvem.aoReceber(() => recebidasB++);
  const uB = await B.Nuvem.iniciar(); await dormir(1300);
  conferir('B recebeu projeto, vaga e contratação', B.Store.projetos().length === 1 && B.Store.vagas().length === 1 && B.Store.registros().length === 1 && !!B.Store.cidade(lv.id));
  conferir('B não reenviou nada ao só receber', B.Nuvem.pendentes === 0, 'pend=' + B.Nuvem.pendentes);
  const antes = [...tabela.values()].map(r => r.atualizado_em).sort().pop();

  // 4) B edita o projeto e exclui a vaga → A recebe
  B.Store.salvarProjeto({ ...B.Store.projetos()[0], nome: 'Sul inteiro 2026' }, uB);
  B.Store.excluirVaga(vA.id, uB);
  await dormir(1500); await A.Nuvem.puxar();
  conferir('A recebeu o nome novo do projeto', A.Store.projetos()[0].nome === 'Sul inteiro 2026');
  conferir('A recebeu a exclusão da vaga', A.Store.vagas().length === 0 && tabela.get('vagas/' + vA.id).removido === true);
  conferir('A foi avisado para atualizar a tela', recebidasA === 1, 'recebidas=' + recebidasA);
  conferir('B só gravou o que mudou', [...tabela.values()].filter(r => r.atualizado_em > antes && r.colecao !== 'auditoria').length === 2, JSON.stringify([...tabela.values()].filter(r => r.atualizado_em > antes).map(r => r.colecao + '/' + r.id)));

  // 5) A perde a internet, grava, "fecha" e reabre: a alteração não pode se perder
  falharRede = true; A.navigator.onLine = false;
  const pA2 = A.Store.salvarProjeto({ nome: 'Offline MS', uf: 'MS', ufs: ['MS'] }, uA);
  await dormir(1300);
  conferir('offline: alteração ficou na fila', A.Nuvem.pendentes > 0 && !tabela.has('projetos/' + pA2.id));
  const A2 = navegador('u-admin'); for (const [k, v] of A.guarda) A2.guarda.set(k, v); // mesmo navegador, página recarregada
  falharRede = false; A2.Store.init();
  await A2.Nuvem.iniciar(); await dormir(1500);
  conferir('ao reabrir com internet, o projeto offline subiu', tabela.has('projetos/' + pA2.id) && A2.Store.projetos().length === 2 && A2.Nuvem.pendentes === 0, 'pend=' + A2.Nuvem.pendentes);

  // 6) visualizador: recebe tudo, não trava a fila tentando gravar
  const C = navegador('u-leitor'); C.Store.init();
  const uC = await C.Nuvem.iniciar(); await dormir(1300);
  C.Store.salvarConfig({ googleKey: 'x' }, uC); await dormir(1300);
  conferir('leitor recebeu os dados', C.Store.projetos().length === 2);
  conferir('leitor não enfileira gravação que o banco recusaria (só auditoria)', C.Nuvem.pendentes === 0 && !(tabela.get('meta/config') && tabela.get('meta/config').dados.googleKey), 'pend=' + C.Nuvem.pendentes);
  // auditoria que já está no banco (o leitor não consegue ler): reenviar não pode virar aviso em loop
  const avisosAntes = C.avisos.length, dupAntes = insertsDuplicados;
  C.Store.auditar('teste.dup', 'repetida', uC);
  const ultima = C.Store.dados.auditoria[C.Store.dados.auditoria.length - 1];
  tabela.set('auditoria/' + ultima.id, { colecao: 'auditoria', id: ultima.id, dados: { ...ultima }, removido: false, atualizado_em: new Date(relogio += 1000).toISOString() });
  await dormir(3500);
  conferir('auditoria repetida conta como enviada (sem aviso em loop)', insertsDuplicados - dupAntes === 1 && C.Nuvem.pendentes === 0 && !C.avisos.slice(avisosAntes).some(a => /não foi gravada|não foram gravadas/.test(String(a))), `dup=${insertsDuplicados - dupAntes} pend=${C.Nuvem.pendentes} avisos=${JSON.stringify(C.avisos.slice(avisosAntes))}`);

  // 7) outro navegador com dados locais próprios entra na nuvem já populada: junta (sem contratações)
  const D = navegador('u-gestor', { confirmar: true }); D.Store.init();
  const d0 = D.Store.usuarios()[0];
  const pD = D.Store.salvarProjeto({ nome: 'PR antigo', uf: 'PR', ufs: ['PR'] }, d0);
  const cas = cidade(D.Store, 'Cascavel', 'PR');
  D.Store.adicionarRegistro({ projetoId: pD.id, tipo: 'LOCAL', cidadeId: cas.id, atuacao: cas.id }, d0);
  await D.Nuvem.iniciar(); await dormir(1500);
  conferir('juntou o projeto local com os da nuvem', D.Store.projetos().length === 3 && tabela.has('projetos/' + pD.id));
  conferir('contratação local antiga descartada (backup baixado 1x)', D.Store.registros().length === 1 && D.baixados.length === 1 && [...tabela.keys()].filter(k => k.startsWith('registros/')).length === 1);

  console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK');
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('ERRO NO TESTE', e); process.exit(2); });
