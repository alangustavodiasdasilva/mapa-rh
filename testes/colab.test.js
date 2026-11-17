// Testes dos utilitários de Colaboradores. Uso, na pasta do projeto: node testes/colab.test.js
const path = require('path');
const Colab = require(path.join(__dirname, '..', 'js', 'colab.js'));
let falhas = 0;
const igual = (nome, obtido, esperado) => { const ok = JSON.stringify(obtido) === JSON.stringify(esperado); console.log((ok ? 'ok   ' : 'FALHA') + ' ' + nome + (ok ? '' : ` — obtido ${JSON.stringify(obtido)}, esperado ${JSON.stringify(esperado)}`)); if (!ok) falhas++; };
const tempo = (a, b) => { const t = Colab.tempoDeCasa(a, b); return t && [t.anos, t.meses, t.dias, t.totalDias]; };

// datas
igual('último dia de fevereiro comum', Colab.ultimoDia('2026-02'), '2026-02-28');
igual('último dia de fevereiro bissexto', Colab.ultimoDia('2028-02'), '2028-02-29');
igual('último dia de dezembro', Colab.ultimoDia('2026-12'), '2026-12-31');
igual('soma dias virando o mês', Colab.somarDias('2026-01-30', 3), '2026-02-02');
igual('soma mês em dia que não existe no destino', Colab.somarMeses('2026-01-31', 1), '2026-02-28');
igual('soma meses virando o ano', Colab.somarMeses('2026-11-15', 3), '2027-02-15');
igual('dias entre duas datas', Colab.diasEntre('2026-01-10', '2026-03-20'), 69);

// tempo de casa
igual('tempo de casa: anos, meses e dias', tempo('2024-08-10', '2026-11-16'), [2, 3, 6, 828]);
igual('tempo de casa: falta um dia para fechar o mês', tempo('2026-01-15', '2026-02-14'), [0, 0, 30, 30]);
igual('tempo de casa: mês fechado', tempo('2026-01-15', '2026-02-15'), [0, 1, 0, 31]);
igual('tempo de casa: admitido no dia 31', tempo('2026-01-31', '2026-03-01'), [0, 1, 1, 29]);
igual('tempo de casa: no dia da admissão', tempo('2026-03-05', '2026-03-05'), [0, 0, 0, 0]);
igual('tempo de casa: data anterior à admissão', Colab.tempoDeCasa('2026-03-05', '2026-03-01'), null);
igual('tempo de casa: sem admissão', Colab.tempoDeCasa(null, '2026-03-01'), null);
igual('texto: anos e meses', Colab.fmtTempo({ anos: 2, meses: 3, dias: 6 }), '2 anos e 3 meses');
igual('texto: 1 ano e 1 mês (singular)', Colab.fmtTempo({ anos: 1, meses: 1, dias: 0 }), '1 ano e 1 mês');
igual('texto: ano cheio', Colab.fmtTempo({ anos: 1, meses: 0, dias: 9 }), '1 ano');
igual('texto: meses', Colab.fmtTempo({ anos: 0, meses: 5, dias: 2 }), '5 meses');
igual('texto: 1 dia (singular)', Colab.fmtTempo({ anos: 0, meses: 0, dias: 1 }), '1 dia');
igual('texto: dias', Colab.fmtTempo({ anos: 0, meses: 0, dias: 12 }), '12 dias');
igual('texto: primeiro dia', Colab.fmtTempo({ anos: 0, meses: 0, dias: 0 }), 'primeiro dia');
igual('texto: sem dado', Colab.fmtTempo(null), '—');

// headcount e turnover — o mesmo caso feito à mão do testes/regras-colaboradores.sql (março de 2026):
//   A entra 10/01 e sai 20/03 · B entra 02/02 · C entra 05/03 · E entra 10/03
//   01/03: A e B = 2 · 31/03: B, C e E = 3 · admissões 2 · desligamentos 1 · médio 2,5 · turnover 1 ÷ 2,5 × 100 = 40
const V = [
  { admissao: '2026-01-10', desligamento: '2026-03-20' },
  { admissao: '2026-02-02', desligamento: null },
  { admissao: '2026-03-05', desligamento: null },
  { admissao: '2026-03-10', desligamento: null }
];
igual('headcount antes de todo mundo', Colab.headcount(V, '2026-01-09'), 0);
igual('headcount conta no dia da admissão', Colab.headcount(V, '2026-01-10'), 1);
igual('headcount no primeiro dia do mês', Colab.headcount(V, '2026-03-01'), 2);
igual('headcount na véspera do desligamento', Colab.headcount(V, '2026-03-19'), 4);
igual('headcount não conta no dia do desligamento', Colab.headcount(V, '2026-03-20'), 3);
igual('headcount no último dia do mês', Colab.headcount(V, '2026-03-31'), 3);
igual('headcount médio', Colab.headcountMedio(V, '2026-03-01', '2026-03-31'), 2.5);
const t = Colab.turnoverMensal(V, '2026-03');
igual('turnover do mês (caso feito à mão)', [t.headcountInicio, t.headcountFim, t.admissoes, t.desligamentos, t.medio, t.turnover], [2, 3, 2, 1, 2.5, 40]);
const f = Colab.turnoverMensal(V, '2026-02');
igual('mês sem desligamento: turnover zero', [f.headcountInicio, f.headcountFim, f.admissoes, f.desligamentos, f.turnover], [1, 2, 1, 0, 0]);
igual('mês sem ninguém: turnover não é calculado', Colab.turnoverMensal(V, '2025-12').turnover, null);
igual('lista vazia: turnover não é calculado', Colab.turnoverMensal([], '2026-03').turnover, null);
const parcial = Colab.turnoverMensal(V, '2026-03', '2026-03-08');
igual('mês em andamento fecha em "hoje"', [parcial.fim, parcial.headcountInicio, parcial.headcountFim, parcial.admissoes, parcial.desligamentos, parcial.turnover], ['2026-03-08', 2, 3, 1, 0, 0]);
igual('mês que ainda não começou', Colab.turnoverMensal(V, '2026-04', '2026-03-08'), null);
igual('turnover arredonda em duas casas', Colab.turnoverMensal([{ admissao: '2026-01-01', desligamento: '2026-03-15' }, { admissao: '2026-01-01' }, { admissao: '2026-01-01' }], '2026-03').turnover, 40); // 1 ÷ 2,5
igual('turnover com dízima', Colab.turnoverMensal([{ admissao: '2026-01-01', desligamento: '2026-03-15' }, { admissao: '2026-01-01' }, { admissao: '2026-03-20' }], '2026-03').turnover, 50); // 1 ÷ ((2+2)/2)
igual('turnover 22,22',Colab.turnoverMensal([{ admissao: '2026-01-01', desligamento: '2026-03-15' }, { admissao: '2026-01-01' }, { admissao: '2026-01-01' }, { admissao: '2026-01-01' }, { admissao: '2026-03-02' }, { admissao: '2026-03-02' }], '2026-03').turnover, 22.22); // 1 ÷ ((4+5)/2)

// retenção em 90 dias, por mês de admissão
const R = [
  { admissao: '2026-01-05', desligamento: null },           // ficou
  { admissao: '2026-01-20', desligamento: '2026-03-01' },   // saiu com 40 dias
  { admissao: '2026-01-25', desligamento: '2026-04-25' },   // saiu com 90 dias: conta como retido
  { admissao: '2026-02-10', desligamento: '2026-05-10' },   // saiu com 89 dias
  { admissao: '2026-09-01', desligamento: null },           // ainda não completou 90 dias em 16/11 (76 dias)
  { admissao: '2026-09-10', desligamento: '2026-09-20' },   // idem: não é avaliável ainda
  { admissao: '2026-12-01', desligamento: null }            // admissão futura: fora
];
igual('retenção em 90 dias por mês de admissão', Colab.retencao(R, 90, '2026-11-16'), [
  { mes: '2026-01', admitidos: 3, avaliaveis: 3, retidos: 2, taxa: 66.67 },
  { mes: '2026-02', admitidos: 1, avaliaveis: 1, retidos: 0, taxa: 0 },
  { mes: '2026-09', admitidos: 2, avaliaveis: 0, retidos: 0, taxa: null }
]);
igual('retenção: completa os 90 dias exatamente hoje', Colab.retencao([{ admissao: '2026-08-18' }], 90, '2026-11-16')[0].avaliaveis, 1);
igual('retenção: lista vazia', Colab.retencao([], 90, '2026-11-16'), []);

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK');
process.exit(falhas ? 1 : 0);
