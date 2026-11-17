// Teste do pedido de vaga com aprovação (só o store.js, sem banco). Uso, na pasta do projeto: node testes/vagas.test.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const raiz = process.argv[2] || path.join(__dirname, '..');
const fonte = fs.readFileSync(path.join(raiz, 'js/store.js'), 'utf8');

// ---------- um "navegador" só com o Store (mesmos stubs do nuvem.test.js, sem a nuvem) ----------
function navegador() {
  const guarda = new Map(); const avisos = [];
  const ctx = {
    console, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {}, Date, JSON, Math, Object, Array, Map, Set, String, Number, Promise, Error, parseInt, parseFloat, isNaN, encodeURIComponent,
    localStorage: { getItem: k => guarda.has(k) ? guarda.get(k) : null, setItem: (k, v) => guarda.set(k, String(v)), removeItem: k => guarda.delete(k), key: i => [...guarda.keys()][i], get length() { return guarda.size; } },
    navigator: { onLine: true },
    document: { hidden: false, getElementById: () => null, querySelector: () => null, addEventListener: () => {}, createElement: () => ({}), head: { appendChild: () => {} } },
    UI: { toast: (m) => avisos.push(m), baixarArquivo: () => {}, confirmar: async () => true },
    sha256: s => 'h' + s, fetch: async () => ({ ok: true, json: async () => ({}) }),
    addEventListener: () => {}
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fonte + '\n;this.Store = Store;', ctx);
  return ctx;
}
let falhas = 0;
const conferir = (nome, cond, extra = '') => { console.log((cond ? 'ok   ' : 'FALHA') + ' ' + nome + (cond ? '' : ' ' + extra)); if (!cond) falhas++; };
const erroDe = fn => { try { fn(); return ''; } catch (e) { return e.message || String(e); } };
const diasAtras = n => new Date(Date.now() - n * 86400000).toISOString();
const dia = n => { const d = new Date(Date.now() + n * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const S = navegador().Store; S.init();
const admin = S.usuarios()[0];
const gestor = { login: 'beto', nome: 'Beto', perfil: 'gestor' };
conferir('ambiente: primeiro usuário é administrador', admin && admin.perfil === 'admin');
const proj = S.salvarProjeto({ nome: 'Sul 2026', uf: 'RS', ufs: ['RS', 'SC', 'PR'], ano: 2026 }, admin);
S.salvarCidade({ nome: 'Lagoa Vermelha', uf: 'RS', lat: -28.2, lng: -51.5, origem: 'manual' });
S.salvarCidade({ nome: 'Vacaria', uf: 'RS', lat: -28.5, lng: -50.9, origem: 'manual' });
const lv = S.resolverCidade('Lagoa Vermelha', 'RS'), vac = S.resolverCidade('Vacaria', 'RS');
const base = { titulo: 'Operador de secador', projetoId: proj.id, cidadeId: lv.id, tipo: 'LOCAL', quantidade: 2 };
const pedido = extra => ({ ...base, solicitante: 'Carla', prioridade: 'alta', dataNecessidade: dia(30), justificativa: { tipo: 'safra', texto: 'colheita de verão' }, recrutador: 'Ana', ...extra });

// 1) vaga nova nasce pendente, com os campos do pedido
const v1 = S.salvarVaga(pedido(), gestor);
conferir('vaga nova nasce aguardando aprovação', v1.status === 'aguardando' && v1.aprovacao.situacao === 'pendente' && v1.aprovada === false && v1.situacaoAprovacao === 'pendente');
conferir('campos do pedido gravados', v1.solicitante === 'Carla' && v1.prioridade === 'alta' && v1.dataNecessidade === dia(30) && v1.justificativa.tipo === 'safra' && v1.justificativa.texto === 'colheita de verão' && v1.recrutador === 'Ana');
conferir('status pedido na criação é ignorado (não pula a aprovação)', S.salvarVaga(pedido({ status: 'aberta' }), gestor).status === 'aguardando');
const minima = S.salvarVaga(base, gestor);
conferir('chamada antiga, sem os campos novos, continua funcionando', minima.status === 'aguardando' && minima.prioridade === 'normal' && minima.solicitante === 'Beto' && minima.dataNecessidade === null);

// 2) validação dos campos novos
conferir('prioridade inválida é recusada', /Prioridade/.test(erroDe(() => S.salvarVaga(pedido({ prioridade: 'ontem' }), gestor))));
conferir('data de necessidade inválida é recusada', /inválida/.test(erroDe(() => S.salvarVaga(pedido({ dataNecessidade: '31/12/2026' }), gestor))));
conferir('motivo inválido é recusado', /Motivo/.test(erroDe(() => S.salvarVaga(pedido({ justificativa: { tipo: 'vontade' } }), gestor))));
conferir('motivo "outro" exige o texto', /Descreva/.test(erroDe(() => S.salvarVaga(pedido({ justificativa: { tipo: 'outro', texto: ' ' } }), gestor))));

// 3) não aprovada não pode ser divulgada nem receber candidato
conferir('vaga pendente não pode ser divulgada', /aprovada/.test(erroDe(() => S.marcarDivulgacao(v1.id, 'sine', true, gestor))) && !Object.keys(S.vaga(v1.id).divulgacao).length && S.vaga(v1.id).status === 'aguardando');
conferir('vaga pendente não recebe candidato', /aprovada/.test(erroDe(() => S.salvarCandidato({ nome: 'Zé', vagaId: v1.id, cidadeId: vac.id }, gestor))) && S.candidatos().length === 0);
conferir('vaga pendente não pode ser aberta à mão', /aprovada/.test(erroDe(() => S.mudarStatusVaga(v1.id, 'aberta', gestor))) && S.vaga(v1.id).status === 'aguardando');
conferir('editar vaga pendente não muda o status', S.salvarVaga(pedido({ id: v1.id, status: 'divulgada' }), gestor).status === 'aguardando');

// 4) aprovar: só administrador
conferir('gestor não aprova', /administrador/.test(erroDe(() => S.aprovarVaga(v1.id, gestor))) && S.vaga(v1.id).status === 'aguardando');
conferir('gestor não cria vaga já aprovada', /administrador/.test(erroDe(() => S.salvarVaga(pedido({ jaAprovada: true }), gestor))));
const a1 = S.aprovarVaga(v1.id, admin);
conferir('administrador aprova: vaga fica aberta', a1.status === 'aberta' && a1.aprovada && a1.aprovacao.situacao === 'aprovada' && a1.aprovacao.por === admin.login && !!a1.aprovacao.em);
conferir('aprovar duas vezes dá erro', /já está aprovada/.test(erroDe(() => S.aprovarVaga(v1.id, admin))));
S.marcarDivulgacao(v1.id, 'sine', true, admin);
conferir('vaga aprovada pode ser divulgada', S.vaga(v1.id).status === 'divulgada' && !!S.vaga(v1.id).divulgacao.sine);
const cand = S.salvarCandidato({ nome: 'Zé da Silva', vagaId: v1.id, cidadeId: vac.id }, admin);
conferir('vaga aprovada recebe candidato', S.candidatos().length === 1 && cand.vagaId === v1.id);
const direta = S.salvarVaga(pedido({ titulo: 'Auxiliar de armazém', quantidade: 1, jaAprovada: true }), admin);
conferir('administrador cria vaga já aprovada', direta.status === 'aberta' && direta.aprovada && direta.aprovacao.por === admin.login);

// 5) recusar: só administrador e com motivo
const v2 = S.salvarVaga(pedido({ titulo: 'Motorista' }), gestor);
conferir('gestor não recusa', /administrador/.test(erroDe(() => S.recusarVaga(v2.id, 'sem verba', gestor))));
conferir('recusar sem motivo dá erro', /motivo/i.test(erroDe(() => S.recusarVaga(v2.id, '   ', admin))) && S.vaga(v2.id).status === 'aguardando');
const r2 = S.recusarVaga(v2.id, 'Sem orçamento neste mês', admin);
conferir('recusar fecha a vaga como Recusada e guarda o motivo', r2.status === 'recusada' && r2.aprovacao.situacao === 'recusada' && r2.aprovacao.motivo === 'Sem orçamento neste mês' && r2.aprovacao.por === admin.login && !r2.aprovada);
conferir('vaga recusada não pode ser divulgada', /aprovada/.test(erroDe(() => S.marcarDivulgacao(v2.id, 'sine', true, admin))));
conferir('vaga aprovada não pode ser recusada', /cancele/.test(erroDe(() => S.recusarVaga(v1.id, 'mudei de ideia', admin))));
S.mudarStatusVaga(v2.id, 'aguardando', gestor);
conferir('pedido recusado pode ser reenviado para aprovação', S.vaga(v2.id).status === 'aguardando' && S.vaga(v2.id).aprovacao.situacao === 'pendente');
S.mudarStatusVaga(v2.id, 'cancelada', gestor);
conferir('pedido pendente pode ser cancelado por quem pediu', S.vaga(v2.id).status === 'cancelada');
conferir('auditoria registra aprovar e recusar', ['vaga.aprovar', 'vaga.recusar'].every(a => S.auditoria().some(x => x.acao === a)));

// 6) vaga antiga, gravada antes da aprovação existir (sem o bloco `aprovacao`), conta como aprovada
S.dados.vagas.push({ id: 'antiga', criadoEm: diasAtras(40), criadoPor: 'ana', status: 'aberta', divulgacao: {}, titulo: 'Vigia', projetoId: proj.id, cidadeId: lv.id, tipo: 'LOCAL', quantidade: 1 });
const antiga = S.vagasVisiveis(admin).find(v => v.id === 'antiga');
conferir('vaga antiga sem aprovacao conta como aprovada', antiga && antiga.aprovada === true && antiga.situacaoAprovacao === 'aprovada' && antiga.prioridade === 'normal' && antiga.atrasada === false);
S.marcarDivulgacao('antiga', 'whatsapp', true, admin);
conferir('vaga antiga pode ser divulgada e editada sem ganhar aprovação pendente', S.vaga('antiga').status === 'divulgada' && S.salvarVaga({ ...S.vaga('antiga'), status: 'selecao' }, admin).status === 'selecao' && S.vaga('antiga').aprovacao === undefined);
conferir('vaga antiga: dias em aberto contados da criação', S.vagasVisiveis(admin).find(v => v.id === 'antiga').diasAberta === 40);

// 7) atraso: aberta, com posição em aberto e data de necessidade vencida
const enr = id => S.vagasVisiveis(admin).find(v => v.id === id);
conferir('data de necessidade no futuro: não está atrasada', enr(v1.id).atrasada === false && enr(v1.id).diasAtraso === 0);
S.vaga(v1.id).dataNecessidade = dia(-5);
conferir('data de necessidade vencida com posição em aberto: atrasada', enr(v1.id).atrasada === true && enr(v1.id).diasAtraso === 5);
S.vaga(v1.id).dataNecessidade = dia(0);
conferir('data de necessidade hoje ainda não é atraso', enr(v1.id).atrasada === false);
const v3 = S.salvarVaga(pedido({ titulo: 'Eletricista', dataNecessidade: dia(-10) }), gestor);
conferir('pedido pendente com data vencida não conta como atrasado', enr(v3.id).atrasada === false && enr(v3.id).diasAberta === null);
S.vaga(v1.id).dataNecessidade = dia(-5);
let resumo = S.resumoRecrutamento(admin);
conferir('resumo: aguardando aprovação e atrasadas', resumo.aguardandoAprovacao === 3 && resumo.atrasadas === 1, JSON.stringify(resumo));
conferir('resumo: chaves antigas mantidas e pendente fora das abertas', ['vagasAbertas', 'posicoes', 'semDivulgacao', 'prazoVencido', 'semCandidatos', 'semCidade', 'candidatos', 'emDocumentos', 'admitidos'].every(k => typeof resumo[k] === 'number') && resumo.vagasAbertas === 3, JSON.stringify(resumo));

// 8) indicadores
conferir('taxa de preenchimento sem vaga aprovada é null', S.taxaPreenchimento([]) === null && S.taxaPreenchimento([S.vaga(v3.id)]) === null);
conferir('tempo médio sem dados é null', S.tempoMedioContratacao(S.vagas()) === null && S.tempoMedioContratacao([]) === null);
conferir('taxa de preenchimento 0% antes de admitir', S.taxaPreenchimento(S.vagasVisiveis(admin)) === 0);
S.moverCandidato(cand.id, 'admitido', admin);
// aprovadas e não canceladas: v1 (2 posições), direta (1), antiga (1) = 4 posições; 1 preenchida = 25%
conferir('taxa de preenchimento = preenchidas ÷ aprovadas × 100', S.taxaPreenchimento(S.vagasVisiveis(admin)) === 25 && S.taxaPreenchimento(S.vagas()) === 25, String(S.taxaPreenchimento(S.vagasVisiveis(admin))));
conferir('vaga ainda com posição em aberto continua atrasada depois de 1 admissão', enr(v1.id).atrasada === true && enr(v1.id).faltam === 1);
S.vaga(v1.id).aprovacao.em = diasAtras(12); S.candidato(cand.id).admitidoEm = diasAtras(2);
conferir('tempo médio de contratação = aprovação até admissão', S.tempoMedioContratacao(S.vagas()) === 10, String(S.tempoMedioContratacao(S.vagas())));
// admissão em vaga antiga (sem data de aprovação) não entra na média
const cand2 = S.salvarCandidato({ nome: 'Maria', vagaId: 'antiga', cidadeId: vac.id }, admin);
S.moverCandidato(cand2.id, 'admitido', admin);
conferir('admissão em vaga sem data de aprovação fica fora do tempo médio', S.tempoMedioContratacao(S.vagas()) === 10 && S.tempoMedioContratacao([S.vaga('antiga')]) === null);
conferir('vaga completa deixa de estar atrasada e de contar dias', (() => { S.vaga('antiga').dataNecessidade = dia(-3); const a = enr('antiga'); return a.status === 'preenchida' && a.atrasada === false && a.diasAberta === null; })());
const ind = S.indicadoresVagas(S.vagasVisiveis(admin));
conferir('indicadores da tela', ind.aguardandoAprovacao === 3 && ind.abertas === 2 && ind.atrasadas === 1 && ind.taxaPreenchimento === 50 && ind.tempoMedioContratacao === 10, JSON.stringify(ind));

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK');
process.exit(falhas ? 1 : 0);
