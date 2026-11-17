// Testes dos utilitários da Pré-admissão. Uso, na pasta do projeto: node testes/rh.test.js
const path = require('path');
const RH = require(path.join(__dirname, '..', 'js', 'rh.js'));
let falhas = 0;
const igual = (nome, obtido, esperado) => { const ok = JSON.stringify(obtido) === JSON.stringify(esperado); console.log((ok ? 'ok   ' : 'FALHA') + ' ' + nome + (ok ? '' : ` — obtido ${JSON.stringify(obtido)}, esperado ${JSON.stringify(esperado)}`)); if (!ok) falhas++; };

igual('CPF válido', RH.cpfValido('529.982.247-25'), true);
igual('CPF com dígito errado', RH.cpfValido('529.982.247-26'), false);
igual('CPF de dígitos repetidos', RH.cpfValido('111.111.111-11'), false);
igual('CPF que o Excel deixou sem o zero da frente', RH.limparCPF(1144477735 * 1 + 0) , '01144477735');
igual('CPF numérico completa zeros e valida', RH.cpfValido(RH.limparCPF(390533447.05 * 100)), true); // 39053344705
igual('formata CPF', RH.fmtCPF('52998224725'), '529.982.247-25');
igual('telefone celular', RH.fmtTelefone('54999990000'), '(54) 99999-0000');
igual('telefone com 55 na frente', RH.fmtTelefone('+55 (54) 3333-4444'), '(54) 3333-4444');
igual('data dd/mm/aaaa', RH.dataDeCelula('17/11/2026'), '2026-11-17');
igual('data dd/mm/aa', RH.dataDeCelula('05/03/90'), '1990-03-05');
igual('data em número de série do Excel', RH.dataDeCelula(46343), '2026-11-17');
igual('data ISO', RH.dataDeCelula('2026-11-17'), '2026-11-17');
igual('data impossível (31/02)', RH.dataDeCelula('31/02/2026'), null);
igual('texto que não é data', RH.dataDeCelula('a confirmar'), null);
igual('data vazia', RH.dataDeCelula(''), '');
igual('hora 08:00', RH.horaDeCelula('08:00'), '08:00');
igual('hora 8h', RH.horaDeCelula('8h'), '08:00');
igual('hora 14h30', RH.horaDeCelula('14h30'), '14:30');
igual('hora em fração de dia do Excel', RH.horaDeCelula(0.5625), '13:30');
igual('hora que não é hora', RH.horaDeCelula('de manhã'), null);
igual('segunda-feira da semana', RH.segundaDaSemana('2026-11-19'), '2026-11-16');
igual('domingo pertence à semana que começou na segunda', RH.segundaDaSemana('2026-11-22'), '2026-11-16');

// leitura da planilha SEMANA (cabeçalho real do modelo)
const CAB = ['STATUS DINAMICA/ASO/TREINAMENTO', 'DATA DO ASO', 'MOVEL/LOCAL', 'CANDIDATO', 'CPF', 'TELEFONE', 'CIDADE DE ORIGEM', 'ESTADO', 'DATA NASCIMENTO', 'CIDADE DE ATUAÇÃO',
  'ANALISTA RESPONSÁVEL/ PENDENTE DINÂMICA', 'Ex Colaborador?', 'E-MAIL', 'BASE DE CONTRATAÇÃO', 'DATA DE CHEGADA', 'HORARIO PREVISTO', 'CNH', 'GRUPO WHATSAPP', 'OBSERVAÇÃO'];
const linhas = [CAB,
  ['ASO OK', 46343, 'MOVEL', 'Fulano de Tal', 52998224725, '54999990000', 'VACARIA', 'RS', '10/05/1990', 'CHAPECO', 'Maria', 'SIM', 'F@X.COM', 'XANXERE', '23/11/2026', 0.3333333, 'B', 'Turma 1', 'obs'],
  ['', '', 'LOCAL', 'Beltrana', '111.444.777-35', '', 'Cidade Que Nao Existe', 'RS', 'ontem', 'CHAPECO', '', '', '', '', '', 'cedo', '', '', ''],
  ['', '', '', 'Repetido', '529.982.247-25', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
  ['', '', 'talvez', 'Sem Cpf', '123', '', '', '', '', '', '', '', '', '', '', '', '', '', '']];
const cidades = { 'vacaria|RS': { id: 'RS:vacaria' }, 'chapeco|SC': { id: 'SC:chapeco' }, 'xanxere|SC': { id: 'SC:xanxere' } };
const resolver = { ufsProjeto: ['PR', 'RS', 'SC'], cidade: (nome, uf) => { for (const u of [].concat(uf)) { const c = cidades[RH.norm(nome) + '|' + u]; if (c) return c; } return null; } };
const cab = RH.lerCabecalho(linhas);
igual('acha o cabeçalho e as 19 colunas', [cab.linha, Object.keys(cab.mapa).length, cab.desconhecidas.length], [0, 19, 0]);
const r = RH.interpretar(linhas, cab, resolver);
igual('ignora linha vazia', r.length, 4);
igual('linha boa: sem erro nem aviso', [r[0].erros.length, r[0].avisos.length], [0, 0]);
igual('linha boa: dados', [r[0].dados.cpf, r[0].dados.tipo, r[0].dados.aso_data, r[0].dados.nascimento, r[0].dados.cidade_origem_id, r[0].dados.cidade_atuacao_id, r[0].dados.base_id, r[0].dados.chegada_data, r[0].dados.chegada_hora, r[0].dados.ex_colaborador, r[0].dados.email],
  ['52998224725', 'MOVEL', '2026-11-17', '1990-05-10', 'RS:vacaria', 'SC:chapeco', 'SC:xanxere', '2026-11-23', '08:00', true, 'f@x.com']);
igual('linha com avisos entra (cidade, data e hora não entendidas)', [r[1].erros.length, r[1].avisos.length, r[1].dados.cidade_origem_id, r[1].dados.nascimento], [0, 3, '', '']);
igual('CPF repetido na planilha é erro', r[2].erros.length > 0 && /repetido/.test(r[2].erros[0]), true);
igual('CPF inválido é erro; tipo estranho vira aviso', [r[3].erros.some(e => /inválido/.test(e)), r[3].avisos.some(a => /LOCAL/.test(a))], [true, true]);

// planilha de respostas de formulário: títulos são perguntas, CPF pode faltar, estado pode vir junto da cidade
const forms = [['Carimbo de data/hora', 'Qual o seu nome completo?', 'Telefone com WhatsApp', 'Em qual cidade você mora?', 'Estado civil', 'Endereço de e-mail', 'Para qual vaga?', 'Tem CNH?'],
  ['17/11/2026 08:00', '  Ana   Souza ', '54 99999-0001', 'Vacaria - RS', 'Solteira', 'ANA@X.COM', 'Operador', 'B'],
  ['17/11/2026 08:05', 'Bruno Lima', '(49) 98888-0002', 'chapeco', 'Casado', '', 'Auxiliar', ''],
  ['17/11/2026 08:09', 'ana souza', '5554999990001', 'Vacaria/RS', '', '', '', ''],
  ['17/11/2026 08:12', 'Caio Sem Cidade', '', '', '', '', '', ''],
  ['17/11/2026 08:15', 'Dora', '', 'Lugar Nenhum', '', '', '', '']];
const cabF = RH.lerCabecalho(forms);
igual('formulário: acha as colunas pelas perguntas', [cabF.modelo, cabF.mapa.nome, cabF.mapa.telefone, cabF.mapa.origem, cabF.mapa.email, cabF.mapa.cargo, cabF.mapa.cnh, cabF.mapa.uf], ['forms', 1, 2, 3, 5, 6, 7, undefined]);
igual('formulário: o que sobrou vai para "colunas não usadas"', cabF.desconhecidas, ['Carimbo de data/hora', 'Estado civil']);
igual('modelo SEMANA continua reconhecido como SEMANA', cab.modelo, 'semana');
const rf = RH.interpretar(forms, cabF, resolver, { cpfOpcional: true });
igual('formulário: sem CPF entra', [rf[0].erros.length, rf[0].dados.cpf, rf[0].dados.nome, rf[0].dados.telefone, rf[0].dados.cidade_origem_id, rf[0].dados.cargo], [0, '', 'Ana Souza', '(54) 99999-0001', 'RS:vacaria', 'Operador']);
igual('formulário: cidade sem estado é procurada nos estados do projeto', rf[1].dados.cidade_origem_id, 'SC:chapeco');
igual('formulário: mesma pessoa (nome + telefone) duas vezes é erro', /repetida/.test(rf[2].erros.join()), true);
igual('formulário: sem cidade entra com aviso', [rf[3].erros.length, rf[3].avisos.length], [0, 1]);
igual('formulário: cidade desconhecida entra com aviso e sem cidade', [rf[4].erros.length, /não reconhecida/.test(rf[4].avisos.join()), rf[4].dados.cidade_origem_id], [0, true, '']);
igual('sem a opção, falta de CPF continua sendo erro', RH.interpretar(forms, cabF, resolver)[0].erros.includes('sem CPF'), true);
igual('estado por extenso e cidade com estado junto', [RH.ufDe('Rio Grande do Sul'), RH.ufDe('sc'), RH.ufDe('Brasil'), RH.separarCidadeUF('Passo Fundo (RS)'), RH.separarCidadeUF('Não-Me-Toque')], ['RS', 'SC', '', ['Passo Fundo', 'RS'], ['Não-Me-Toque', '']]);

// exportação no modelo SEMANA
const ctx = { cidade: id => ({ 'RS:vacaria': { nome: 'Vacaria', uf: 'RS' }, 'SC:chapeco': { nome: 'Chapecó', uf: 'SC' } })[id] || null, pendentes: () => ['RG e CPF', 'Foto 3x4'], distrito: () => 'Distrito Oeste' };
const pessoaX = { situacao: 'em_andamento', etapa: 'documentos', aso: 'ok', treinamento: 'agendado', aso_data: '2026-11-17', tipo: 'MOVEL', cidade_atuacao_id: 'SC:chapeco', base_id: 'SC:chapeco', analista: 'Maria',
  chegada_data: '2026-11-23', chegada_hora: '08:00:00', grupo_whatsapp: 'Turma 1', observacao: 'obs', pessoa: { nome: 'Fulano', cpf: '52998224725', telefone: '(54) 99999-0000', cidade_origem_id: 'RS:vacaria', nascimento: '1990-05-10', ex_colaborador: true, email: 'f@x.com', cnh: 'B' } };
const lx = RH.linhaSemana(pessoaX, ctx);
igual('exportação: 19 colunas, na ordem do modelo', [RH.CAB_SEMANA.length, lx.length, RH.CAB_SEMANA.join('|') === CAB.join('|')], [19, 19, true]);
igual('exportação: conteúdo da linha', lx, ['DINÂMICA: PENDENTE (2) | ASO: APTO | TREINAMENTO: AGENDADO', '2026-11-17', 'MOVEL', 'Fulano', '529.982.247-25', '(54) 99999-0000', 'Vacaria', 'RS', '1990-05-10', 'Chapecó',
  'Maria / PENDENTE: RG e CPF, Foto 3x4', 'SIM', 'f@x.com', 'Chapecó', '2026-11-23', '08:00', 'B', 'Turma 1', 'obs']);
igual('exportação: triagem sem cidade de trabalho usa o distrito e não lista pendência', [RH.linhaSemana({ situacao: 'em_andamento', etapa: 'triagem', distrito_id: 'd1', tipo: 'LOCAL', pessoa: { nome: 'X' } }, ctx).filter((v, j) => [0, 9, 10].includes(j))], [['TRIAGEM', 'Distrito Oeste', '']]);
// a exportação lida de volta pelo importador dá a mesma pessoa
const volta = RH.interpretar([RH.CAB_SEMANA, lx.map((v, j) => j === 1 || j === 8 || j === 14 ? v.slice(8, 10) + '/' + v.slice(5, 7) + '/' + v.slice(0, 4) : v)], RH.lerCabecalho([RH.CAB_SEMANA]), { ufsProjeto: ['RS', 'SC'], cidade: (nome, uf) => { for (const u of [].concat(uf)) { const c = cidades[RH.norm(nome) + '|' + u]; if (c) return c; } return null; } });
igual('exportar e importar de volta preserva a pessoa', [volta[0].erros.length, volta[0].dados.cpf, volta[0].dados.tipo, volta[0].dados.cidade_origem_id, volta[0].dados.cidade_atuacao_id, volta[0].dados.chegada_data, volta[0].dados.chegada_hora, volta[0].dados.nascimento],
  [0, '52998224725', 'MOVEL', 'RS:vacaria', 'SC:chapeco', '2026-11-23', '08:00', '1990-05-10']);

// planilha SEMANA: quem já foi admitido ou saiu não volta; ASO e treinamento saem do status; nascimento impossível fica em branco; menor de idade avisa
const ano = +RH.hoje().slice(0, 4);
const sem2 = [CAB,
  ['ADMITIDO', '', 'LOCAL', 'Ja Admitido', '529.982.247-25', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
  ['NÃO SEGUIU', '', 'LOCAL', 'Saiu', '111.444.777-35', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
  ['DINÂMICA: OK | ASO: APTO | TREINAMENTO: FEITO', '', 'LOCAL', 'Apto', '390.533.447-05', '', '', '', '10/05/1990', '', '', '', '', '', '', '', '', '', ''],
  ['', '', 'LOCAL', 'Futuro', '862.883.667-57', '', '', '', `01/01/${ano + 1}`, '', '', '', '', '', '', '', '', '', ''],
  ['', '', 'LOCAL', 'Jovem', '714.602.380-01', '', '', '', `01/01/${ano - 16}`, '', '', '', '', '', '', '', '', '', '']];
const r2 = RH.interpretar(sem2, RH.lerCabecalho(sem2), resolver);
igual('planilha: admitido e não seguiu são marcados para não entrar', [r2[0].dados.situacao_planilha, r2[1].dados.situacao_planilha], ['admitido', 'fora']);
igual('planilha: ASO e treinamento vêm do status', [r2[2].dados.aso, r2[2].dados.treinamento, r2[2].dados.situacao_planilha], ['ok', 'ok', '']);
igual('planilha: nascimento no futuro fica em branco com aviso', [r2[3].dados.nascimento, r2[3].avisos.some(a => /impossível/.test(a))], ['', true]);
igual('planilha: menor de idade avisa', r2[4].avisos.some(a => /menor de idade/.test(a)), true);
igual('idade: 18 anos completos no dia', [RH.idade('2008-11-17', '2026-11-17'), RH.idade('2008-11-18', '2026-11-17')], [18, 17]);

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK');
process.exit(falhas ? 1 : 0);
