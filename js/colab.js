// Utilitários de Colaboradores: tempo de casa, headcount, turnover e retenção.
// Sem dependência de tela: roda também no Node (testes/colab.test.js).
// Um "vínculo" aqui é { admissao: 'aaaa-mm-dd', desligamento: 'aaaa-mm-dd' | null }.
// Convenção (a mesma do banco, em supabase/migrations/colaboradores.sql): a pessoa conta no dia da admissão
// e NÃO conta no dia do desligamento.
const Colab = (() => {
  const p2 = n => String(n).padStart(2, '0');
  const dt = iso => new Date(iso + 'T12:00:00Z');
  const isoDe = d => d.toISOString().slice(0, 10);
  const somarDias = (iso, n) => { const d = dt(iso); d.setUTCDate(d.getUTCDate() + n); return isoDe(d); };
  const diasEntre = (a, b) => Math.round((dt(b) - dt(a)) / 86400000);
  // soma meses mantendo o dia; se o mês de destino é mais curto, fica no último dia dele (31/01 + 1 mês = 28/02)
  function somarMeses(iso, n) {
    const [a, m, d] = iso.split('-').map(Number);
    const t = a * 12 + (m - 1) + n, ano = Math.floor(t / 12), mes = t % 12;
    const ultimo = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
    return `${String(ano).padStart(4, '0')}-${p2(mes + 1)}-${p2(Math.min(d, ultimo))}`;
  }
  const primeiroDia = mes => mes.slice(0, 7) + '-01';
  const ultimoDia = mes => { const [a, m] = mes.split('-').map(Number); return `${mes.slice(0, 7)}-${p2(new Date(Date.UTC(a, m, 0)).getUTCDate())}`; };
  // data de hoje no fuso do navegador (toISOString usaria UTC e viraria o dia às 21h no Brasil)
  const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };

  // Tempo de casa entre a admissão e uma data (hoje, ou o desligamento). Devolve { anos, meses, dias, totalDias } ou null.
  function tempoDeCasa(admissao, ate) {
    if (!admissao || !ate || ate < admissao) return null;
    const [a1, m1] = admissao.split('-').map(Number), [a2, m2] = ate.split('-').map(Number);
    let total = (a2 - a1) * 12 + (m2 - m1);
    if (somarMeses(admissao, total) > ate) total--;
    return { anos: Math.floor(total / 12), meses: total % 12, dias: diasEntre(somarMeses(admissao, total), ate), totalDias: diasEntre(admissao, ate) };
  }
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  // "2 anos e 3 meses", "1 ano", "5 meses", "12 dias", "1 dia"; no próprio dia da admissão: "primeiro dia"
  function fmtTempo(t) {
    if (!t) return '—';
    if (t.anos) return plural(t.anos, 'ano', 'anos') + (t.meses ? ' e ' + plural(t.meses, 'mês', 'meses') : '');
    if (t.meses) return plural(t.meses, 'mês', 'meses');
    return t.dias ? plural(t.dias, 'dia', 'dias') : 'primeiro dia';
  }

  const ativoEm = (v, data) => !!v.admissao && v.admissao <= data && (!v.desligamento || v.desligamento > data);
  const headcount = (vinculos, data) => vinculos.filter(v => ativoEm(v, data)).length;
  const headcountMedio = (vinculos, inicio, fim) => (headcount(vinculos, inicio) + headcount(vinculos, fim)) / 2;

  // Indicadores de um mês ('aaaa-mm'). Com "ate" (ex.: hoje) o mês em andamento é fechado nessa data.
  // turnover = desligamentos ÷ headcount médio × 100; fica null quando não há headcount (não se inventa número).
  function turnoverMensal(vinculos, mes, ate) {
    const ini = primeiroDia(mes); let fim = ultimoDia(mes);
    if (ate && ate < ini) return null;
    if (ate && ate < fim) fim = ate;
    const entre = d => !!d && d >= ini && d <= fim;
    const headcountInicio = headcount(vinculos, ini), headcountFim = headcount(vinculos, fim);
    const admissoes = vinculos.filter(v => entre(v.admissao)).length, desligamentos = vinculos.filter(v => entre(v.desligamento)).length;
    const medio = (headcountInicio + headcountFim) / 2;
    return { mes: mes.slice(0, 7), inicio: ini, fim, headcountInicio, headcountFim, admissoes, desligamentos, medio,
      turnover: medio > 0 ? Math.round(desligamentos / medio * 10000) / 100 : null };
  }

  // Retenção em N dias, por mês de admissão. Só entra na conta quem já teve tempo de completar N dias até "hoje"
  // (avaliaveis); "retidos" são os que ficaram pelo menos N dias. taxa (%) é null quando ninguém do mês é avaliável.
  function retencao(vinculos, dias, hojeIso) {
    const meses = new Map();
    for (const v of vinculos) {
      if (!v.admissao || v.admissao > hojeIso) continue;
      const k = v.admissao.slice(0, 7), m = meses.get(k) || { mes: k, admitidos: 0, avaliaveis: 0, retidos: 0 };
      m.admitidos++;
      if (somarDias(v.admissao, dias) <= hojeIso) {
        m.avaliaveis++;
        if (!v.desligamento || diasEntre(v.admissao, v.desligamento) >= dias) m.retidos++;
      }
      meses.set(k, m);
    }
    return [...meses.values()].sort((a, b) => a.mes.localeCompare(b.mes))
      .map(m => ({ ...m, taxa: m.avaliaveis ? Math.round(m.retidos / m.avaliaveis * 10000) / 100 : null }));
  }

  return { hoje, somarDias, somarMeses, diasEntre, primeiroDia, ultimoDia, tempoDeCasa, fmtTempo, ativoEm, headcount, headcountMedio, turnoverMensal, retencao };
})();
if (typeof module !== 'undefined') module.exports = Colab;
