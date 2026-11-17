// Utilitários dos Candidatos: CPF, telefone, datas vindas de planilha, leitura da planilha de candidaturas (formulário)
// e da planilha "SEMANA", e a exportação no modelo da "SEMANA".
// Sem dependência de tela: roda também no Node (testes/rh.test.js).
const RH = (() => {
  const soDigitos = v => String(v == null ? '' : v).replace(/\D/g, '');
  // CPF: 11 dígitos com os dois verificadores certos. O Excel come os zeros da esquerda, por isso completa até 11.
  function limparCPF(v) {
    let d = soDigitos(typeof v === 'number' ? Math.round(v) : v);
    if (d.length >= 8 && d.length < 11) d = d.padStart(11, '0');
    return d;
  }
  function cpfValido(v) {
    const p = soDigitos(v);
    if (p.length !== 11 || /^(\d)\1{10}$/.test(p)) return false;
    const dv = n => { let s = 0; for (let i = 0; i < n; i++) s += +p[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
    return dv(9) === +p[9] && dv(10) === +p[10];
  }
  function fmtCPF(v) { const p = soDigitos(v); return p.length === 11 ? `${p.slice(0, 3)}.${p.slice(3, 6)}.${p.slice(6, 9)}-${p.slice(9)}` : String(v || ''); }
  function fmtTelefone(v) {
    const d = soDigitos(v).replace(/^55(?=\d{10,11}$)/, '');
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return String(v || '').trim();
  }
  const iso = (a, m, d) => { const dt = new Date(Date.UTC(a, m - 1, d)); return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? `${String(a).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null; };
  // Data de uma célula: número de série do Excel, "dd/mm/aaaa", "dd/mm/aa", "aaaa-mm-dd" ou Date. Devolve 'aaaa-mm-dd', '' (vazio) ou null (não entendi).
  function dataDeCelula(v) {
    if (v == null || v === '') return '';
    if (v instanceof Date) return isNaN(v) ? null : iso(v.getFullYear(), v.getMonth() + 1, v.getDate());
    if (typeof v === 'number') {
      if (v < 1 || v > 80000) return null;
      const dt = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000);
      return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
    }
    const s = String(v).trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return iso(+m[1], +m[2], +m[3]);
    m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})$/);
    if (m) { let a = +m[3]; if (a < 100) a += a > 40 ? 1900 : 2000; return iso(a, +m[2], +m[1]); } // no Brasil: dia/mês/ano
    return null;
  }
  // Hora de uma célula: fração de dia do Excel, "08:00", "8h", "14h30", "8". Devolve 'HH:MM', '' ou null.
  function horaDeCelula(v) {
    if (v == null || v === '') return '';
    const hm = (h, m) => h >= 0 && h < 24 && m >= 0 && m < 60 ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` : null;
    if (typeof v === 'number') { if (v >= 1 && v < 24 && Number.isInteger(v)) return hm(v, 0); const min = Math.round((v % 1) * 1440); return hm(Math.floor(min / 60) % 24, min % 60); }
    const m = String(v).trim().toLowerCase().match(/^(\d{1,2})\s*(?:[:h]\s*(\d{2})?)?\s*(?:h|hs|horas)?$/);
    return m ? hm(+m[1], +(m[2] || 0)) : null;
  }
  const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const simNao = v => /^(s|sim|x|ex|ja|ja foi|yes|true|1)$/.test(norm(v));

  // Colunas da planilha SEMANA (cabeçalho começando por…) -> nome interno
  const COLUNAS = [['status', 'status'], ['data do aso', 'aso_data'], ['movel', 'tipo'], ['candidato', 'nome'], ['nome', 'nome'], ['cpf', 'cpf'], ['telefone', 'telefone'],
    ['cidade de origem', 'origem'], ['estado', 'uf'], ['uf', 'uf'], ['data nascimento', 'nascimento'], ['data de nascimento', 'nascimento'], ['cidade de atua', 'atuacao'],
    ['analista', 'analista'], ['ex colaborador', 'ex'], ['e mail', 'email'], ['email', 'email'], ['base de contrata', 'base'], ['data de chegada', 'chegada_data'],
    ['horario', 'chegada_hora'], ['cnh', 'cnh'], ['grupo', 'grupo'], ['observa', 'obs'], ['cargo', 'cargo'], ['unidade', 'unidade']];
  // Planilha de respostas de formulário: o título é a pergunta ("Qual o seu nome completo?"), então vale "contém…".
  // Só entra para o campo que o modelo acima não achou. A ordem importa (a primeira coluna que serve fica com o campo).
  const SOLTAS = [['cpf', /\bcpf\b/], ['nome', /\bnome\b/], ['telefone', /telefone|whatsapp|celular|\bfone\b/], ['nascimento', /nascimento|nasceu/], ['email', /e ?mail/],
    ['cnh', /\bcnh\b|habilitacao/], ['uf', /\buf\b|\bestado\b(?! civil)/], ['origem', /cidade|municipio/], ['cargo', /\bcargo\b|\bvaga\b|funcao/], ['obs', /observa/]];
  // campos que a tela deixa o usuário apontar à mão quando o título da coluna não ajuda
  const CAMPOS = { nome: 'Nome', cpf: 'CPF', telefone: 'Telefone', origem: 'Cidade onde mora', uf: 'Estado', nascimento: 'Nascimento', email: 'E-mail', cnh: 'CNH', cargo: 'Cargo / vaga', obs: 'Observação' };
  // Acha a linha de cabeçalho e devolve { linha, mapa: {nomeInterno: índice}, desconhecidas: [títulos], titulos: [{ i, titulo }], modelo: 'semana' | 'forms' }
  function lerCabecalho(linhas) {
    for (let i = 0; i < Math.min(linhas.length, 15); i++) {
      const cab = (linhas[i] || []).map(norm);
      const mapa = {}, usados = new Set();
      cab.forEach((h, j) => {
        if (!h) return;
        const c = /^estado civil/.test(h) ? null : COLUNAS.find(([ini]) => h === ini || h.startsWith(ini));
        if (c) { usados.add(j); if (mapa[c[1]] === undefined) mapa[c[1]] = j; }
      });
      for (const [campo, re] of SOLTAS) {
        if (mapa[campo] !== undefined) continue;
        const j = cab.findIndex((h, k) => h && !usados.has(k) && re.test(h));
        if (j >= 0) { mapa[campo] = j; usados.add(j); }
      }
      if (mapa.cpf === undefined && !(mapa.nome !== undefined && Object.keys(mapa).length >= 2)) continue;
      const titulos = cab.map((h, j) => h ? { i: j, titulo: String(linhas[i][j]).trim() } : null).filter(Boolean);
      return { linha: i, mapa, desconhecidas: titulos.filter(x => !usados.has(x.i)).map(x => x.titulo), titulos,
        modelo: mapa.status !== undefined || mapa.chegada_data !== undefined || mapa.atuacao !== undefined || mapa.base !== undefined ? 'semana' : 'forms' };
    }
    return null;
  }
  const UFS = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
  const ESTADOS = { acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA', ceara: 'CE', 'distrito federal': 'DF', 'espirito santo': 'ES', goias: 'GO', maranhao: 'MA',
    'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG', para: 'PA', paraiba: 'PB', parana: 'PR', pernambuco: 'PE', piaui: 'PI', 'rio de janeiro': 'RJ',
    'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondonia: 'RO', roraima: 'RR', 'santa catarina': 'SC', 'sao paulo': 'SP', sergipe: 'SE', tocantins: 'TO' };
  // "RS", "rs", "Rio Grande do Sul" -> 'RS'; não entendi -> ''
  function ufDe(v) { const s = String(v == null ? '' : v).trim(); if (UFS.has(s.toUpperCase())) return s.toUpperCase(); return ESTADOS[norm(s)] || ''; }
  // "Passo Fundo - RS", "Passo Fundo/RS", "Passo Fundo (RS)", "Passo Fundo RS" -> ['Passo Fundo', 'RS']; sem estado -> [texto, '']
  function separarCidadeUF(v) {
    const s = String(v == null ? '' : v).trim();
    const m = s.match(/^(.+?)\s*[\/\-–,(]\s*([A-Za-z]{2})\)?\.?$/) || s.match(/^(.+?)\s+([A-Z]{2})$/);
    return m && UFS.has(m[2].toUpperCase()) ? [m[1].trim(), m[2].toUpperCase()] : [s, ''];
  }
  // Interpreta as linhas de dados. resolver = { cidade(nome, uf|[ufs]|'') -> {id, nome, uf} | null, ufsProjeto: [...] }
  // op.cpfOpcional: candidatura de formulário pode vir sem CPF (ele é pedido mais tarde, na documentação).
  // Devolve [{ n (linha na planilha), dados, erros: [], avisos: [] }]. Linha com erro não entra na importação.
  function interpretar(linhas, cab, resolver, op = {}) {
    const v = (l, k) => cab.mapa[k] === undefined ? '' : l[cab.mapa[k]];
    const txt = (l, k) => String(v(l, k) == null ? '' : v(l, k)).trim();
    const vistos = new Map(), saida = [];
    for (let i = cab.linha + 1; i < linhas.length; i++) {
      const l = linhas[i] || [];
      if (!l.some(c => String(c == null ? '' : c).trim() !== '')) continue;
      const erros = [], avisos = [], n = i + 1;
      const nome = txt(l, 'nome').replace(/\s+/g, ' ');
      let cpf = limparCPF(v(l, 'cpf'));
      const telefone = fmtTelefone(txt(l, 'telefone'));
      if (!nome) erros.push('sem nome');
      if (!cpf) { if (!op.cpfOpcional) erros.push('sem CPF'); }
      else if (!cpfValido(cpf)) { if (op.cpfOpcional) { avisos.push(`CPF inválido (${txt(l, 'cpf')}): ficou em branco`); cpf = ''; } else erros.push(`CPF inválido (${txt(l, 'cpf')})`); }
      // a mesma pessoa duas vezes na planilha: pelo CPF; sem CPF, pelo nome + telefone
      const chave = cpf || (nome && soDigitos(telefone) ? norm(nome) + '|' + soDigitos(telefone) : '');
      if (chave) { if (vistos.has(chave)) erros.push(`${cpf ? 'CPF repetido' : 'pessoa repetida'} na planilha (já está na linha ${vistos.get(chave)})`); else vistos.set(chave, n); }
      const data = (k, rotulo) => { const d = dataDeCelula(v(l, k)); if (d === null) { avisos.push(`${rotulo} não entendida (${txt(l, k)}): ficou em branco`); return ''; } return d; };
      const cidade = (k, uf, rotulo) => { const t = txt(l, k); if (!t) return ''; const c = resolver.cidade(t, uf); if (!c) { avisos.push(`${rotulo} não reconhecida (${t}): ficou em branco`); return ''; } return c.id; };
      // cidade de origem: o estado pode vir em coluna própria, junto do nome ("Passo Fundo - RS") ou não vir (tenta os estados do projeto e depois o país)
      let origemId = '';
      const origemTxt = txt(l, 'origem');
      if (origemTxt) {
        const [nomeCid, ufJunto] = separarCidadeUF(origemTxt), uf = ufDe(txt(l, 'uf')) || ufJunto;
        const c = (uf && (resolver.cidade(nomeCid, uf) || resolver.cidade(origemTxt, uf))) || (!uf && (resolver.cidade(origemTxt, resolver.ufsProjeto) || resolver.cidade(origemTxt, '')));
        if (c) origemId = c.id; else avisos.push(`cidade onde mora não reconhecida (${origemTxt}${uf ? '/' + uf : ''}): ficou em branco`);
      } else if (op.cpfOpcional) avisos.push('sem cidade: não dá para sugerir o distrito');
      const tipoTxt = norm(txt(l, 'tipo'));
      let tipo = 'LOCAL';
      if (/^movel/.test(tipoTxt)) tipo = 'MOVEL'; else if (tipoTxt && !/^local/.test(tipoTxt)) avisos.push(`tipo "${txt(l, 'tipo')}" não é MÓVEL nem LOCAL: entrou como LOCAL`);
      let hora = horaDeCelula(v(l, 'chegada_hora')); if (hora === null) { avisos.push(`horário não entendido (${txt(l, 'chegada_hora')}): ficou em branco`); hora = ''; }
      let nasc = data('nascimento', 'data de nascimento');
      if (nasc && (nasc <= '1920-01-01' || nasc > hoje())) { avisos.push(`data de nascimento impossível (${fmtDataBR(nasc)}): ficou em branco`); nasc = ''; }
      else if (nasc && idade(nasc) < 18) avisos.push(`menor de idade (${idade(nasc)} anos): não poderá ser admitido`);
      // status da planilha SEMANA: quem já foi admitido ou saiu não entra de novo; ASO e treinamento vêm do texto
      const st = norm(txt(l, 'status'));
      let situacaoPlanilha = '';
      if (/\badmitid/.test(st)) { situacaoPlanilha = 'admitido'; avisos.push('consta como ADMITIDO na planilha: não será importado'); }
      else if (/nao seguiu|desisti|reprovad|nao segue/.test(st) && !/aso|trein/.test(st)) { situacaoPlanilha = 'fora'; avisos.push('consta como fora do processo na planilha: não será importado'); }
      const mAso = st.match(/aso (apto|inapto|agendado|dispensado|pendente)/), mTre = st.match(/treinamento (feito|reprovado|agendado|dispensado|pendente)/);
      const MAP = { apto: 'ok', feito: 'ok', inapto: 'inapto', reprovado: 'reprovado', agendado: 'agendado', dispensado: 'dispensado', pendente: 'pendente' };
      saida.push({ n, erros, avisos, dados: {
        cpf, nome, nascimento: nasc, telefone, email: txt(l, 'email').toLowerCase(), cnh: txt(l, 'cnh'),
        cidade_origem_id: origemId, ex_colaborador: simNao(txt(l, 'ex')), tipo,
        cidade_atuacao_id: cidade('atuacao', resolver.ufsProjeto, 'cidade de atuação'), base_id: cidade('base', resolver.ufsProjeto, 'base de contratação'),
        analista: txt(l, 'analista'), status_texto: txt(l, 'status'), aso_data: data('aso_data', 'data do ASO'), chegada_data: data('chegada_data', 'data de chegada'),
        chegada_hora: hora, grupo_whatsapp: txt(l, 'grupo'), observacao: txt(l, 'obs'), cargo: txt(l, 'cargo'), unidade: txt(l, 'unidade'),
        situacao_planilha: situacaoPlanilha, aso: mAso ? MAP[mAso[1]] : '', treinamento: mTre ? MAP[mTre[1]] : '' } });
    }
    return saida;
  }

  // ---------- exportação no modelo da planilha "SEMANA" (mesmas 19 colunas, na mesma ordem e com as mesmas larguras) ----------
  const CAB_SEMANA = ['STATUS DINAMICA/ASO/TREINAMENTO', 'DATA DO ASO', 'MOVEL/LOCAL', 'CANDIDATO', 'CPF', 'TELEFONE', 'CIDADE DE ORIGEM', 'ESTADO', 'DATA NASCIMENTO', 'CIDADE DE ATUAÇÃO',
    'ANALISTA RESPONSÁVEL/ PENDENTE DINÂMICA', 'Ex Colaborador?', 'E-MAIL', 'BASE DE CONTRATAÇÃO', 'DATA DE CHEGADA', 'HORARIO PREVISTO', 'CNH', 'GRUPO WHATSAPP', 'OBSERVAÇÃO'];
  const LARG_SEMANA = [40, 19, 17, 35, 16, 17, 21, 11, 19, 22, 44, 18, 39, 25, 21, 21, 9, 21, 16];
  const ROT_ASO = { pendente: 'PENDENTE', agendado: 'AGENDADO', ok: 'APTO', inapto: 'INAPTO', dispensado: 'DISPENSADO' };
  const ROT_TRE = { pendente: 'PENDENTE', agendado: 'AGENDADO', ok: 'FEITO', reprovado: 'REPROVADO', dispensado: 'DISPENSADO' };
  // texto da coluna A. pendentes = nomes dos documentos que ainda faltam (a dinâmica)
  function statusSemana(p, pendentes = []) {
    if (p.situacao === 'admitido') return 'ADMITIDO';
    if (p.situacao === 'reprovado') return 'NÃO SEGUIU';
    if (p.situacao === 'desistiu') return 'DESISTIU';
    if (p.etapa === 'triagem') return 'TRIAGEM';
    if (p.etapa === 'entrevista') return 'ENTREVISTA';
    return `DINÂMICA: ${pendentes.length ? 'PENDENTE (' + pendentes.length + ')' : 'OK'} | ASO: ${ROT_ASO[p.aso] || 'PENDENTE'} | TREINAMENTO: ${ROT_TRE[p.treinamento] || 'PENDENTE'}`;
  }
  // Uma pessoa -> as 19 células. ctx = { cidade: id -> { nome, uf } | null, pendentes: p -> [nomes], distrito: id -> nome | '' }
  // Datas saem como 'aaaa-mm-dd' e a hora como 'HH:MM' (planilhaSemana transforma em data/hora de verdade do Excel).
  function linhaSemana(p, ctx) {
    const pe = p.pessoa || {}, c = id => (id && ctx.cidade(id)) || null, nome = id => { const x = c(id); return x ? x.nome : ''; };
    const pend = p.situacao === 'em_andamento' && p.etapa === 'documentos' ? (ctx.pendentes ? ctx.pendentes(p) : []) : [];
    const atuacao = nome(p.cidade_atuacao_id) || (p.distrito_id && ctx.distrito ? ctx.distrito(p.distrito_id) : '');
    return [statusSemana(p, pend), p.aso_data || '', p.tipo === 'MOVEL' ? 'MOVEL' : 'LOCAL', pe.nome || '', pe.cpf ? fmtCPF(pe.cpf) : '', pe.telefone || '', nome(pe.cidade_origem_id),
      (c(pe.cidade_origem_id) || {}).uf || '', pe.nascimento || '', atuacao, (p.analista || '') + (pend.length ? `${p.analista ? ' / ' : ''}PENDENTE: ${pend.join(', ')}` : ''),
      pe.ex_colaborador ? 'SIM' : 'NÃO', pe.email || '', nome(p.base_id), p.chegada_data || '', p.chegada_hora ? String(p.chegada_hora).slice(0, 5) : '', pe.cnh || '', p.grupo_whatsapp || '', p.observacao || ''];
  }
  const COL_DATAS = [1, 8, 14], COL_HORA = 15;
  // Monta o arquivo Excel (X = biblioteca XLSX) com a aba "SEMANA". linhas = resultado de linhaSemana para cada pessoa.
  function planilhaSemana(X, linhas) {
    const serie = d => (Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) - Date.UTC(1899, 11, 30)) / 86400000;
    const matriz = [CAB_SEMANA].concat(linhas.map(l => l.map((v, j) => {
      if (v && COL_DATAS.includes(j) && /^\d{4}-\d{2}-\d{2}/.test(v)) return { t: 'n', v: serie(v), z: 'dd/mm/yyyy' };
      if (v && j === COL_HORA && /^\d{2}:\d{2}/.test(v)) return { t: 'n', v: (+v.slice(0, 2) * 60 + +v.slice(3, 5)) / 1440, z: 'hh:mm' };
      return v;
    })));
    const ws = X.utils.aoa_to_sheet(matriz);
    ws['!cols'] = LARG_SEMANA.map(w => ({ wch: w }));
    ws['!autofilter'] = { ref: `A1:S${matriz.length}` };
    const wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, ws, 'SEMANA');
    return wb;
  }

  // segunda-feira da semana de uma data 'aaaa-mm-dd'
  function segundaDaSemana(isoData) {
    const d = new Date(isoData + 'T12:00:00Z'); const dia = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - dia); return d.toISOString().slice(0, 10);
  }
  const fmtDia = isoData => isoData ? isoData.slice(8, 10) + '/' + isoData.slice(5, 7) : '';
  const fmtDataBR = isoData => isoData ? isoData.slice(8, 10) + '/' + isoData.slice(5, 7) + '/' + isoData.slice(0, 4) : '';
  // data de hoje no fuso do computador ('aaaa-mm-dd'); toISOString daria o dia seguinte depois das 21h no Brasil
  var hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  // idade completa em anos numa data (padrão: hoje). null se não tiver nascimento.
  function idade(nasc, em = hoje()) {
    if (!nasc) return null;
    const [a, m, d] = nasc.slice(0, 10).split('-').map(Number), [A, M, D] = em.slice(0, 10).split('-').map(Number);
    return A - a - (M < m || (M === m && D < d) ? 1 : 0);
  }
  const OK = { dinamica: ['ok', 'dispensada'], aso: ['ok', 'dispensado'], treinamento: ['ok', 'dispensado'] };
  const pronto = p => OK.dinamica.includes(p.dinamica) && OK.aso.includes(p.aso) && OK.treinamento.includes(p.treinamento);

  return { soDigitos, limparCPF, cpfValido, fmtCPF, fmtTelefone, dataDeCelula, horaDeCelula, lerCabecalho, interpretar, segundaDaSemana, fmtDia, fmtDataBR, pronto, norm, hoje, idade,
    CAMPOS, ufDe, separarCidadeUF, CAB_SEMANA, statusSemana, linhaSemana, planilhaSemana };
})();
if (typeof module !== 'undefined') module.exports = RH;
