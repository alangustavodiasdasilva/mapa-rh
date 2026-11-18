// Página pública de inscrição do candidato (inscricao.html?v=<vaga> ou ?p=<projeto>).
// Sem login: usa só as funções públicas do banco (maparh_vaga_publica, maparh_vagas_publicas, maparh_inscrever).
// Toda validação é refeita no servidor; aqui é só para ajudar quem está preenchendo.
(function () {
  'use strict';
  const app = document.getElementById('ins-app');
  const cfg = window.MAPARH_NUVEM || {};
  const params = new URLSearchParams(location.search);
  let sb = null;
  try {
    if (window.supabase && cfg.url && cfg.chave) sb = window.supabase.createClient(cfg.url, cfg.chave, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  } catch (e) { sb = null; }

  // ---------- utilitários ----------
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const normalizar = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const idCidade = (nome, uf) => String(uf).toUpperCase() + ':' + normalizar(nome);
  const digitos = s => String(s || '').replace(/\D/g, '');
  const fmtData = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
  const hojeISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
  const DDDS = new Set('11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99'.split(' '));
  // mesmas chaves do campo "Como soube da vaga" do sistema (Store.CANAIS + indicação/outro)
  const FONTES = [['whatsapp', 'WhatsApp'], ['facebook', 'Facebook / Instagram'], ['indicacao', 'Indicação de alguém'], ['radio', 'Rádio'], ['cartaz', 'Cartaz'],
    ['sine', 'SINE / Emprega Brasil'], ['prefeitura', 'Prefeitura / Secretaria'], ['linkedin', 'LinkedIn'], ['indeed', 'Indeed'], ['infojobs', 'InfoJobs'],
    ['vagascom', 'Vagas.com'], ['catho', 'Catho'], ['gupy', 'Gupy'], ['outro', 'Outro']];

  function telValido(t) {
    let d = digitos(t);
    if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
    if (!(d.length === 10 || d.length === 11) || !DDDS.has(d.slice(0, 2))) return false;
    if (d.length === 11 && d[2] !== '9') return false;
    if (d.length === 10 && !'2345'.includes(d[2])) return false;
    return !/^(.)\1+$/.test(d.slice(2));
  }
  function cpfValido(c) {
    const d = digitos(c);
    if (d.length !== 11 || /^(.)\1{10}$/.test(d)) return false;
    const dv = n => { let s = 0; for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
    return dv(9) === +d[9] && dv(10) === +d[10];
  }
  const mascaraTel = v => { const d = digitos(v).slice(0, 11); if (d.length <= 2) return d.length ? '(' + d : ''; if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`; return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`; };
  const mascaraCPF = v => { const d = digitos(v).slice(0, 11); return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2'); };
  // WhatsApp do RH só se o "como se candidatar" da vaga tiver um telefone
  function zapDoContato(contato) {
    const m = String(contato || '').match(/(?:\+?55[\s.-]*)?\(?\d{2}\)?[\s.-]*9?\d{4}[\s.-]*\d{4}/);
    if (!m) return null;
    let d = digitos(m[0]); if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
    return d.length === 10 || d.length === 11 ? '55' + d : null;
  }

  // ---------- cidades: base embutida + lista completa do IBGE por estado ----------
  const seed = (window.CIDADES_SEED || []).map(a => ({ nome: a[0], uf: a[1] }));
  const cacheUF = {};
  async function cidadesDaUF(uf) {
    if (cacheUF[uf]) return cacheUF[uf];
    let lista = null;
    try { const s = sessionStorage.getItem('ins:mun:' + uf); if (s) lista = JSON.parse(s); } catch (e) { /* ok */ }
    if (!lista) {
      try {
        const r = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`);
        if (r.ok) { lista = (await r.json()).map(m => m.nome).filter(Boolean); try { sessionStorage.setItem('ins:mun:' + uf, JSON.stringify(lista)); } catch (e) { /* ok */ } }
      } catch (e) { lista = null; }
    }
    const nomes = new Map();
    seed.filter(c => c.uf === uf).forEach(c => nomes.set(normalizar(c.nome), c.nome));
    (lista || []).forEach(n => nomes.set(normalizar(n), n));
    cacheUF[uf] = [...nomes.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return cacheUF[uf];
  }
  function nomeCidadeDoId(id, reserva) {
    if (!id) return reserva || '';
    const [uf, slug] = id.split(':');
    const c = seed.find(x => x.uf === uf && normalizar(x.nome) === slug);
    return c ? c.nome : (reserva || slug.replace(/\b\w/g, l => l.toUpperCase()));
  }

  // ---------- telas ----------
  function tela(html) { app.innerHTML = html; window.scrollTo(0, 0); }
  function telaFim({ icone = '✓', neutro = false, titulo, texto, extra = '' }) {
    tela(`<section class="ins-card ins-fim"><div class="ins-fim-icone ${neutro ? 'ins-neutro' : ''}" aria-hidden="true">${icone}</div>
      <h1>${esc(titulo)}</h1>${texto ? `<p>${esc(texto)}</p>` : ''}${extra}</section>`);
  }
  function onde(v) {
    if (v.distritos && v.distritos.length) return 'Região de ' + v.distritos.map(d => d.nome).filter(Boolean).join(', ');
    const n = nomeCidadeDoId(v.cidade_id, v.cidade_nome);
    return n ? `${n}${v.uf ? '/' + v.uf : ''}${v.unidade ? ' — ' + v.unidade : ''}` : '';
  }
  const MOTIVOS = {
    cancelada: ['Vaga cancelada', 'Esta vaga foi cancelada. Obrigado pelo interesse!'],
    preenchida: ['Vagas preenchidas', 'Esta vaga já foi preenchida. Obrigado pelo interesse!'],
    completa: ['Vagas preenchidas', 'Todas as vagas já foram preenchidas. Obrigado pelo interesse!'],
    prazo: ['Inscrições encerradas', 'O prazo de inscrição desta vaga terminou.'],
    fechada: ['Inscrições fechadas', 'Esta vaga não está recebendo inscrições no momento.'],
    nao_aprovada: ['Inscrições fechadas', 'Esta vaga não está recebendo inscrições no momento.']
  };
  function telaFechada(v) {
    const [t, x] = MOTIVOS[v.motivo] || MOTIVOS.fechada;
    const outras = v.projeto_id ? `<a class="ins-btn ins-btn-sec" href="?p=${encodeURIComponent(v.projeto_id)}">Ver outras vagas abertas</a>` : '';
    telaFim({ icone: 'i', neutro: true, titulo: t, texto: x, extra: (v.titulo ? `<p class="ins-sub" style="color:var(--muted)">${esc(v.titulo)}${onde(v) ? ' · ' + esc(onde(v)) : ''}</p>` : '') + outras });
  }
  function telaErro(msg) { telaFim({ icone: '!', neutro: true, titulo: 'Não deu para abrir', texto: msg }); }

  function cartaoVaga(v) {
    const tags = [];
    if (v.quantidade > 1) tags.push(`<span class="ins-tag">${v.quantidade} vagas</span>`);
    if (v.tem_moveis || v.tipo === 'MOVEL') tags.push('<span class="ins-tag ins-tag-verde">Também para quem vem de fora</span>');
    if (v.prazo) tags.push(`<span class="ins-tag">Inscrições até ${esc(fmtData(v.prazo))}</span>`);
    const bloco = (t, x) => x ? `<div class="ins-bloco"><h2>${t}</h2><p>${esc(x)}</p></div>` : '';
    const cond = [['Salário', v.salario], ['Jornada', v.jornada], ['Benefícios', v.beneficios]].filter(x => x[1]);
    return `<section class="ins-card ins-vaga">
      <h1>${esc(v.titulo || 'Vaga')}</h1>
      ${onde(v) ? `<p class="ins-onde">${esc(onde(v))}</p>` : ''}
      ${tags.length ? `<div class="ins-tags">${tags.join('')}</div>` : ''}
      ${bloco('O que vai fazer', v.descricao)}${bloco('Requisitos', v.requisitos)}
      ${cond.length ? `<div class="ins-cond">${cond.map(([k, x]) => `<div><b>${k}</b><span>${esc(x)}</span></div>`).join('')}</div>` : ''}
    </section>`;
  }

  function formulario(v) {
    const maxNasc = (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 18); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); })();
    const ufVaga = v.uf || (v.distritos && v.distritos[0] && v.distritos[0].uf) || 'RS';
    const dists = v.distritos || [];
    return `<form class="ins-card ins-form" id="ins-form" novalidate autocomplete="on">
      <h2>Quero me inscrever</h2>
      <p class="ins-sub">Leva 1 minuto. O RH chama você no WhatsApp.</p>
      <div class="ins-aviso-geral" id="ins-aviso" hidden></div>
      <label class="ins-campo" data-campo="nome"><span>Nome completo</span>
        <input id="f-nome" name="nome" autocomplete="name" maxlength="120" required placeholder="Nome e sobrenome"></label>
      <label class="ins-campo" data-campo="telefone"><span>WhatsApp com DDD</span>
        <input id="f-tel" name="tel" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="15" required placeholder="(54) 99999-1234"></label>
      <label class="ins-campo" data-campo="nascimento"><span>Data de nascimento</span>
        <input id="f-nasc" name="nasc" type="date" min="1930-01-01" max="${maxNasc}" required autocomplete="bday"></label>
      <div class="ins-campo" data-campo="cidade"><span>Cidade onde você mora</span>
        <div class="ins-cidade">
          <select id="f-uf" aria-label="Estado">${UFS.map(u => `<option ${u === ufVaga ? 'selected' : ''}>${u}</option>`).join('')}</select>
          <input id="f-cidade" autocomplete="off" maxlength="60" placeholder="Digite o nome da cidade" aria-label="Cidade" role="combobox" aria-expanded="false" aria-controls="f-cidade-sug">
          <div class="ins-sug" id="f-cidade-sug" role="listbox" hidden></div>
        </div></div>
      ${dists.length > 1 ? `<label class="ins-campo" data-campo="distrito"><span>Onde prefere trabalhar <small>(opcional)</small></span>
        <select id="f-dist"><option value="">Tanto faz</option>${dists.map(d => `<option value="${esc(d.id)}">${esc(d.nome)}</option>`).join('')}</select></label>` : ''}
      <label class="ins-campo" data-campo="cpf"><span>CPF <small>(opcional, agiliza o cadastro)</small></span>
        <input id="f-cpf" name="cpf" inputmode="numeric" maxlength="14" placeholder="000.000.000-00" autocomplete="off"></label>
      <div class="ins-campo" data-campo="ex"><span>Já trabalhou na empresa?</span>
        <div class="ins-simnao"><label><input type="radio" name="ex" value="sim"> Sim</label><label><input type="radio" name="ex" value="nao" checked> Não</label></div></div>
      <label class="ins-campo" data-campo="fonte"><span>Como ficou sabendo da vaga?</span>
        <select id="f-fonte"><option value="">Escolha…</option>${FONTES.map(([k, r]) => `<option value="${k}">${esc(r)}</option>`).join('')}</select></label>
      <label class="ins-campo" data-campo="indicado" id="f-ind-w" hidden><span>Quem indicou?</span>
        <input id="f-ind" maxlength="120" placeholder="Nome de quem indicou"></label>
      <div class="ins-mel" aria-hidden="true"><label>Site<input id="f-site" name="site" tabindex="-1" autocomplete="off"></label></div>
      <label class="ins-lgpd" data-campo="lgpd"><input type="checkbox" id="f-lgpd">
        <span>Concordo que o RH da empresa use estes dados só para este processo seletivo e para me avisar de outras vagas. Posso pedir para apagar quando quiser, falando com o RH.</span></label>
      <button class="ins-btn" type="submit" id="f-enviar">Enviar inscrição</button>
    </form>`;
  }

  // ---------- comportamento do formulário ----------
  function ligarFormulario(v) {
    const f = document.getElementById('ins-form');
    const g = s => f.querySelector(s);
    const tel = g('#f-tel'), cpf = g('#f-cpf'), uf = g('#f-uf'), cid = g('#f-cidade'), sug = g('#f-cidade-sug'), fonte = g('#f-fonte');
    let cidadeId = '';
    tel.addEventListener('input', () => { tel.value = mascaraTel(tel.value); limparErro('telefone'); });
    cpf.addEventListener('input', () => { cpf.value = mascaraCPF(cpf.value); limparErro('cpf'); });
    fonte.addEventListener('change', () => { g('#f-ind-w').hidden = fonte.value !== 'indicacao'; if (!g('#f-ind-w').hidden) g('#f-ind').focus(); });
    f.addEventListener('input', e => { const c = e.target.closest('[data-campo]'); if (c && !['telefone', 'cpf'].includes(c.dataset.campo)) limparErro(c.dataset.campo); });

    // cidade: busca por nome dentro do estado escolhido
    let lista = [];
    const carregarUF = async () => { lista = []; lista = await cidadesDaUF(uf.value); if (document.activeElement === cid && cid.value.trim()) mostrarSug(); };
    function mostrarSug() {
      const q = normalizar(cid.value);
      if (!q) { sug.hidden = true; cid.setAttribute('aria-expanded', 'false'); return; }
      const achou = lista.filter(n => normalizar(n).startsWith(q)).concat(lista.filter(n => !normalizar(n).startsWith(q) && normalizar(n).includes(q))).slice(0, 8);
      sug.innerHTML = achou.length ? achou.map(n => `<button type="button" role="option" data-nome="${esc(n)}">${esc(n)} / ${esc(uf.value)}</button>`).join('')
        : `<div class="ins-sug-vazio">${lista.length ? 'Nenhuma cidade com esse nome neste estado. Confira o estado ao lado.' : 'Carregando cidades…'}</div>`;
      sug.hidden = false; cid.setAttribute('aria-expanded', 'true');
    }
    function escolher(nome) { cid.value = nome; cidadeId = idCidade(nome, uf.value); sug.hidden = true; cid.setAttribute('aria-expanded', 'false'); limparErro('cidade'); }
    uf.addEventListener('change', () => { cidadeId = ''; cid.value = ''; carregarUF(); cid.focus(); });
    cid.addEventListener('input', () => { cidadeId = ''; mostrarSug(); });
    cid.addEventListener('focus', () => { if (cid.value && !cidadeId) mostrarSug(); });
    cid.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { const b = sug.querySelector('button'); if (b) { e.preventDefault(); b.focus(); } }
      if (e.key === 'Enter' && !sug.hidden) { const b = sug.querySelector('button'); if (b) { e.preventDefault(); escolher(b.dataset.nome); } }
    });
    sug.addEventListener('keydown', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (e.key === 'ArrowDown' && b.nextElementSibling) { e.preventDefault(); b.nextElementSibling.focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); (b.previousElementSibling || cid).focus(); }
    });
    sug.addEventListener('mousedown', e => e.preventDefault());
    sug.addEventListener('click', e => { const b = e.target.closest('button[data-nome]'); if (b) escolher(b.dataset.nome); });
    document.addEventListener('click', e => { if (!e.target.closest('.ins-cidade')) sug.hidden = true; });
    cid.addEventListener('blur', () => setTimeout(() => {
      if (sug.contains(document.activeElement)) return;
      // digitou o nome inteiro sem clicar na sugestão: aceita se bater com uma cidade do estado
      if (!cidadeId && cid.value.trim()) { const n = lista.find(x => normalizar(x) === normalizar(cid.value)); if (n) escolher(n); }
      sug.hidden = true;
    }, 150));
    carregarUF();

    function limparErro(campo) {
      const c = f.querySelector(`[data-campo="${campo}"]`); if (!c) return;
      c.classList.remove('ins-erro'); const m = c.querySelector('.ins-msg-erro'); if (m) m.remove();
    }
    function erro(campo, msg) {
      const c = f.querySelector(`[data-campo="${campo}"]`);
      if (!c) { const a = g('#ins-aviso'); a.textContent = msg; a.hidden = false; a.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
      c.classList.add('ins-erro');
      if (!c.querySelector('.ins-msg-erro')) c.insertAdjacentHTML('beforeend', `<span class="ins-msg-erro">${esc(msg)}</span>`);
      return c;
    }

    f.addEventListener('submit', async e => {
      e.preventDefault();
      g('#ins-aviso').hidden = true;
      f.querySelectorAll('.ins-erro').forEach(c => limparErro(c.dataset.campo));
      const nome = g('#f-nome').value.trim().replace(/\s+/g, ' ');
      const nasc = g('#f-nasc').value;
      const erros = [];
      if (nome.split(' ').filter(w => w.length >= 2).length < 2 || /[0-9@#$%&*_=+<>/\\|{}[\]"!?;:]/.test(nome)) erros.push(['nome', 'Escreva seu nome completo (nome e sobrenome).']);
      if (!telValido(tel.value)) erros.push(['telefone', 'WhatsApp inválido. Use DDD + número.']);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(nasc)) erros.push(['nascimento', 'Informe sua data de nascimento.']);
      else if (nasc > g('#f-nasc').max) erros.push(['nascimento', 'Para esta vaga é preciso ter 18 anos ou mais.']);
      else if (nasc < '1930-01-01' || nasc > hojeISO()) erros.push(['nascimento', 'Data de nascimento inválida.']);
      if (!cidadeId) erros.push(['cidade', 'Escolha a cidade na lista (digite e toque no nome).']);
      if (cpf.value.trim() && !cpfValido(cpf.value)) erros.push(['cpf', 'CPF inválido. Confira ou deixe em branco.']);
      if (!g('#f-lgpd').checked) erros.push(['lgpd', 'Marque que concorda para poder enviar.']);
      if (erros.length) {
        erros.forEach(([c, m]) => erro(c, m));
        const primeiro = f.querySelector('.ins-erro');
        if (primeiro) { primeiro.scrollIntoView({ block: 'center', behavior: 'smooth' }); const i = primeiro.querySelector('input:not([type=radio]),select'); if (i) setTimeout(() => i.focus({ preventScroll: true }), 300); }
        return;
      }
      const btn = g('#f-enviar'); btn.disabled = true; btn.innerHTML = '<span class="ins-giro" aria-hidden="true"></span> Enviando…';
      try {
        const { data, error } = await sb.rpc('maparh_inscrever', {
          p_vaga: v.id, p_nome: nome, p_telefone: tel.value, p_cpf: cpf.value.trim() || null, p_nascimento: nasc, p_cidade: cidadeId,
          p_ex_colaborador: (f.querySelector('input[name="ex"]:checked') || {}).value === 'sim',
          p_fonte: fonte.value || null, p_indicado_por: fonte.value === 'indicacao' ? (g('#f-ind').value.trim() || null) : null,
          p_distrito: g('#f-dist') ? (g('#f-dist').value || null) : null, p_lgpd: g('#f-lgpd').checked, p_site: g('#f-site').value || null
        });
        if (error) throw error;
        if (!data || !data.ok) {
          if (data && data.codigo === 'fechada') { abrirVaga(v.id); return; }
          erro((data && data.campo) || '_', (data && data.mensagem) || 'Não foi possível enviar. Tente de novo.');
          const c = f.querySelector('.ins-erro'); if (c) c.scrollIntoView({ block: 'center', behavior: 'smooth' });
          return;
        }
        sucesso(v, data, nome);
      } catch (err) {
        console.warn('Inscrição falhou', err);
        erro('_', 'Não foi possível enviar agora. Confira a internet e tente de novo.');
      } finally {
        if (document.body.contains(btn)) { btn.disabled = false; btn.textContent = 'Enviar inscrição'; }
      }
    });
  }

  function sucesso(v, r, nome) {
    const zap = zapDoContato(v.contato);
    const primeiro = String(nome || '').split(' ')[0];
    const msg = `Olá! Sou ${nome} e me inscrevi pelo link na vaga de ${v.titulo}${onde(v) ? ' (' + onde(v) + ')' : ''}.`;
    const ja = r.codigo === 'ja';
    telaFim({
      titulo: ja ? 'Você já está inscrito!' : `Recebemos${primeiro ? ', ' + primeiro : ''}!`,
      texto: ja ? 'Já recebemos sua inscrição. O RH vai te chamar no WhatsApp.' : 'O RH vai te chamar no WhatsApp. Fique de olho nas mensagens.',
      extra: `<p style="color:var(--muted);font-size:14px">${esc(v.titulo)}${onde(v) ? ' · ' + esc(onde(v)) : ''}</p>`
        + (zap ? `<a class="ins-btn ins-btn-zap" href="https://wa.me/${zap}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">Falar com o RH no WhatsApp</a>` : '')
        + (v.projeto_id ? `<a class="ins-btn ins-btn-sec" href="?p=${encodeURIComponent(v.projeto_id)}">Ver outras vagas</a>` : '')
    });
  }

  // ---------- carregar ----------
  async function abrirVaga(id) {
    tela('<div class="ins-carregando"><span class="ins-giro" aria-hidden="true"></span> Carregando a vaga…</div>');
    try {
      const { data, error } = await sb.rpc('maparh_vaga_publica', { p_vaga: id });
      if (error) throw error;
      if (!data) return telaFim({ icone: '?', neutro: true, titulo: 'Vaga não encontrada', texto: 'Confira se o link está completo ou peça um novo ao RH.' });
      if (!data.aberta) return telaFechada(data);
      document.title = `${data.titulo} — Inscrição Safra RH`;
      tela(cartaoVaga(data) + formulario(data));
      ligarFormulario(data);
    } catch (e) {
      console.warn(e);
      telaErro('Não conseguimos carregar a vaga. Confira a internet e tente de novo.');
    }
  }
  async function abrirLista(projeto) {
    tela('<div class="ins-carregando"><span class="ins-giro" aria-hidden="true"></span> Carregando as vagas…</div>');
    try {
      const { data, error } = await sb.rpc('maparh_vagas_publicas', { p_projeto: projeto });
      if (error) throw error;
      const l = data || [];
      if (!l.length) return telaFim({ icone: 'i', neutro: true, titulo: 'Nenhuma vaga aberta agora', texto: 'Volte mais tarde ou fale com o RH.' });
      tela(`<h1 class="ins-lista-tit">Vagas abertas</h1><p class="ins-sub" style="color:var(--muted);margin:-6px 0 12px">Toque na vaga para ver os detalhes e se inscrever.</p>`
        + l.map(v => `<a class="ins-item" href="?v=${encodeURIComponent(v.id)}"><i>Inscrever ›</i><b>${esc(v.titulo)}</b><span>${esc(onde(v))}${v.quantidade > 1 ? ' · ' + v.quantidade + ' vagas' : ''}</span></a>`).join(''));
    } catch (e) {
      console.warn(e);
      telaErro('Não conseguimos carregar as vagas. Confira a internet e tente de novo.');
    }
  }

  const v = (params.get('v') || '').trim().slice(0, 64), p = (params.get('p') || '').trim().slice(0, 64);
  if (!sb) telaErro('Esta página está sem conexão com o sistema. Avise o RH.');
  else if (v) abrirVaga(v);
  else if (p) abrirLista(p);
  else telaFim({ icone: '?', neutro: true, titulo: 'Link incompleto', texto: 'Abra o link da vaga que o RH divulgou.' });
})();
