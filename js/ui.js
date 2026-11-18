// Registro das páginas do sistema (preenchido pelos arquivos em js/pages).
const Paginas = {};

// Utilitários de interface: formatação, toasts, modais, autocomplete, CSV.
const UI = (() => {
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fmtNum(n) { return new Intl.NumberFormat('pt-BR').format(Number(n) || 0); }
  function fmtPct(n, casas = 1) {
    if (n == null || isNaN(n)) return '—';
    return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }) + '%';
  }
  function fmtKm(n) { return n == null || isNaN(n) ? '—' : fmtNum(Math.round(n)) + ' km'; }
  function fmtDataHora(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  function fmtData(iso) { return iso ? new Date(iso).toLocaleDateString('pt-BR') : '—'; }
  function rotuloTipo(t) { return t === 'MOVEL' ? 'MÓVEL' : t === 'LOCAL' ? 'LOCAL' : '?'; }
  function badgeTipo(t) { return `<span class="badge ${t === 'MOVEL' ? 'badge-movel' : 'badge-local'}">${rotuloTipo(t)}</span>`; }

  function debounce(fn, ms) {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }

  // ---------- Toast ----------
  // Avisos: o mesmo texto não empilha (vira um só, com ×N); no máximo 3 na tela; erro fica mais; passar o mouse segura.
  const toastsAtivos = new Map(), TOAST_MAX = 3;
  function toast(msg, tipo = 'info', ms = 3500, { id } = {}) {
    let area = document.getElementById('toasts');
    if (!area) { area = document.createElement('div'); area.id = 'toasts'; area.setAttribute('role', 'status'); area.setAttribute('aria-live', 'polite'); document.body.appendChild(area); }
    const chave = id || tipo + '|' + msg, ex = toastsAtivos.get(chave);
    const tempo = tipo === 'erro' ? Math.max(ms, 7000) : ms;
    if (ex) { ex.msg.textContent = msg; if (!id) { ex.n++; ex.cont.textContent = '×' + ex.n; ex.cont.hidden = false; } clearTimeout(ex.t); ex.t = setTimeout(ex.sair, tempo); return; }
    while (toastsAtivos.size >= TOAST_MAX) { const v = [...toastsAtivos.values()]; (v.find(x => x.tipo !== 'erro') || v[0]).sair(); }
    const el = document.createElement('div');
    el.className = 'toast toast-' + tipo;
    el.innerHTML = '<span class="toast-msg"></span><span class="toast-cont" hidden></span><button type="button" class="toast-x" aria-label="Fechar">×</button>';
    const it = { el, n: 1, tipo, msg: el.querySelector('.toast-msg'), cont: el.querySelector('.toast-cont') };
    it.msg.textContent = msg;
    it.sair = () => { clearTimeout(it.t); if (toastsAtivos.get(chave) === it) toastsAtivos.delete(chave); el.classList.remove('visivel'); setTimeout(() => el.remove(), 300); };
    el.querySelector('.toast-x').onclick = it.sair;
    el.onmouseenter = () => clearTimeout(it.t); el.onmouseleave = () => { it.t = setTimeout(it.sair, 2000); };
    it.t = setTimeout(it.sair, tempo);
    toastsAtivos.set(chave, it); area.appendChild(el);
    requestAnimationFrame(() => el.classList.add('visivel'));
  }

  // ---------- Modal ----------
  function modal({ titulo, corpo, botoes = [], largura = '560px', aoFechar, fecharAoClicarFora = false }) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:${largura}" role="dialog" aria-modal="true">
        <div class="modal-cabecalho">
          <h3>${esc(titulo)}</h3>
          <button class="btn-icone modal-fechar" title="Fechar" aria-label="Fechar">&times;</button>
        </div>
        <div class="modal-corpo"></div>
        <div class="modal-rodape"></div>
      </div>`;
    const corpoEl = overlay.querySelector('.modal-corpo');
    if (typeof corpo === 'string') corpoEl.innerHTML = corpo; else corpoEl.appendChild(corpo);
    const rodape = overlay.querySelector('.modal-rodape');
    const api = {
      el: overlay,
      corpo: corpoEl,
      fechar() {
        document.removeEventListener('keydown', aoTeclar);
        overlay.remove();
        if (aoFechar) aoFechar();
      }
    };
    botoes.forEach(b => {
      const btn = document.createElement('button');
      btn.className = 'btn ' + (b.classe || 'btn-secundario');
      btn.textContent = b.texto;
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try { const r = b.acao ? await b.acao(api) : true; if (r !== false) api.fechar(); }
        catch (e) { toast(e.message || String(e), 'erro'); }
        finally { btn.disabled = false; }
      });
      rodape.appendChild(btn);
    });
    if (!botoes.length) rodape.remove();
    overlay.querySelector('.modal-fechar').addEventListener('click', api.fechar);
    if (fecharAoClicarFora) overlay.addEventListener('mousedown', e => { if (e.target === overlay) api.fechar(); });
    function aoTeclar(e) {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const abertas = document.querySelectorAll('.modal-overlay');
      if (abertas[abertas.length - 1] !== overlay) return;
      if (document.querySelector('.ac-lista:not([hidden])')) return;
      e.preventDefault(); api.fechar();
    }
    document.addEventListener('keydown', aoTeclar);
    document.body.appendChild(overlay);
    const primeiro = corpoEl.querySelector('input,select,textarea,button');
    if (primeiro) setTimeout(() => primeiro.focus(), 50);
    return api;
  }

  function confirmar(mensagem, { titulo = 'Confirmação', textoOk = 'Confirmar', perigo = false, textoCancelar = 'Cancelar' } = {}) {
    return new Promise(resolve => {
      let respondido = false;
      modal({
        titulo,
        corpo: `<p>${esc(mensagem)}</p>`,
        largura: '440px',
        aoFechar: () => { if (!respondido) resolve(false); }, fecharAoClicarFora: true,
        botoes: [
          { texto: textoCancelar, classe: 'btn-secundario', acao: () => { respondido = true; resolve(false); } },
          { texto: textoOk, classe: perigo ? 'btn-perigo' : 'btn-primario', acao: () => { respondido = true; resolve(true); } }
        ]
      });
    });
  }

  // ---------- Autocomplete de cidades ----------
  // opcoes: { uf: () => 'RS' | '', aoSelecionar(cidade), aoGeocodificar(texto, uf) }
  function autocompleteCidade(input, opcoes = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'ac-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    const lista = document.createElement('div');
    lista.className = 'ac-lista';
    lista.hidden = true;
    wrap.appendChild(lista);
    let itens = [], ativo = -1;
    input.setAttribute('autocomplete', 'off');

    function fechar() { lista.hidden = true; ativo = -1; }
    function render() {
      lista.innerHTML = '';
      itens.forEach((it, i) => {
        const div = document.createElement('div');
        div.className = 'ac-item' + (i === ativo ? ' ativo' : '') + (it.geocode ? ' ac-geocode' : '');
        div.innerHTML = it.geocode
          ? `&#128269; Buscar coordenadas de <b>${esc(it.texto)}</b>${it.uf ? ' (' + esc(Array.isArray(it.uf) ? it.uf.join('/') : it.uf) + ')' : ''} na internet`
          : `${esc(it.cidade.nome)} <span class="muted">(${esc(it.cidade.uf)})</span>`;
        div.addEventListener('mousedown', e => e.preventDefault()); // mantém o foco no campo
        div.addEventListener('click', () => escolher(i));
        lista.appendChild(div);
      });
      lista.hidden = itens.length === 0;
      posicionarLista(input, lista);
    }
    async function escolher(i) {
      const it = itens[i];
      if (!it) return;
      if (it.geocode) {
        fechar();
        if (opcoes.aoGeocodificar) await opcoes.aoGeocodificar(it.texto, it.uf);
        return;
      }
      input.value = it.cidade.nome;
      input.dataset.cidadeId = it.cidade.id;
      fechar();
      if (opcoes.aoSelecionar) opcoes.aoSelecionar(it.cidade);
    }
    const buscar = debounce(() => {
      const q = input.value.trim();
      const uf = opcoes.uf ? opcoes.uf() : '';
      if (!q) { itens = []; render(); return; }
      itens = Store.buscarCidades(q, uf, 12).map(c => ({ cidade: c }));
      const exata = Store.resolverCidade(q, uf);
      if (!exata && opcoes.aoGeocodificar) itens.push({ geocode: true, texto: q, uf });
      ativo = itens.length && !itens[0].geocode ? 0 : -1;
      render();
    }, 120);
    input.addEventListener('input', () => { delete input.dataset.cidadeId; buscar(); });
    input.addEventListener('focus', () => { if (input.value.trim()) buscar(); });
    input.addEventListener('blur', () => setTimeout(fechar, 150));
    input.addEventListener('keydown', e => {
      if (lista.hidden) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); ativo = Math.min(ativo + 1, itens.length - 1); render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); ativo = Math.max(ativo - 1, 0); render(); }
      else if (e.key === 'Enter') { if (ativo >= 0) { e.preventDefault(); e.stopImmediatePropagation(); escolher(ativo); } } // 1º Enter escolhe, 2º Enter confirma
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fechar(); }
    });
    return { fechar };
  }

  // ---------- CSV / arquivos ----------
  // Campo de texto com sugestões (no lugar do <datalist> do navegador, que abre aquela caixa preta).
  // fonte() -> lista de textos ou de { valor, sub }. Mostra tudo ao focar; filtra ao digitar; aceita texto livre.
  function sugestoes(input, fonte, opcoes = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'ac-wrap ac-sug';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    const seta = document.createElement('span'); seta.className = 'ac-seta'; seta.setAttribute('aria-hidden', 'true'); wrap.appendChild(seta);
    const lista = document.createElement('div');
    lista.className = 'ac-lista'; lista.hidden = true;
    wrap.appendChild(lista);
    input.setAttribute('autocomplete', 'off');
    let itens = [], ativo = -1;
    const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    function abrir(tudo) {
      const q = tudo ? '' : norm(input.value.trim());
      const todos = (fonte() || []).map(x => typeof x === 'string' ? { valor: x } : x).filter(x => x && x.valor);
      itens = (q ? todos.filter(x => norm(x.valor + ' ' + (x.sub || '')).includes(q)) : todos).slice(0, 50);
      ativo = itens.findIndex(x => norm(x.valor) === norm(input.value.trim()));
      lista.innerHTML = itens.length ? itens.map((x, i) => `<div class="ac-item ${i === ativo ? 'ativo' : ''}" data-i="${i}">${esc(x.valor)}${x.sub ? ` <span class="muted">· ${esc(x.sub)}</span>` : ''}</div>`).join('')
        : (opcoes.vazio && !q ? `<div class="ac-vazio">${opcoes.vazio}</div>` : '');
      lista.hidden = !lista.innerHTML;
      posicionarLista(input, lista);
      const a = lista.querySelector('.ativo'); if (a) a.scrollIntoView({ block: 'nearest' });
    }
    const fechar = () => { lista.hidden = true; ativo = -1; };
    function escolher(i) { const x = itens[i]; if (!x) return; input.value = x.valor; fechar(); input.dispatchEvent(new Event('change', { bubbles: true })); if (opcoes.aoSelecionar) opcoes.aoSelecionar(x); }
    lista.addEventListener('mousedown', e => e.preventDefault());
    lista.addEventListener('click', e => { const d = e.target.closest('[data-i]'); if (d) escolher(+d.dataset.i); });
    input.addEventListener('focus', () => abrir(true));
    input.addEventListener('click', () => { if (lista.hidden) abrir(true); });
    input.addEventListener('input', () => abrir(false));
    input.addEventListener('blur', () => setTimeout(fechar, 150));
    input.addEventListener('keydown', e => {
      if (lista.hidden) { if (e.key === 'ArrowDown') { e.preventDefault(); abrir(true); } return; }
      const marcar = () => lista.querySelectorAll('.ac-item').forEach((d, i) => { d.classList.toggle('ativo', i === ativo); if (i === ativo) d.scrollIntoView({ block: 'nearest' }); });
      if (e.key === 'ArrowDown') { e.preventDefault(); ativo = Math.min(ativo + 1, itens.length - 1); marcar(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); ativo = Math.max(ativo - 1, 0); marcar(); }
      else if (e.key === 'Enter') { if (ativo >= 0) { e.preventDefault(); e.stopImmediatePropagation(); escolher(ativo); } }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fechar(); }
      else if (e.key === 'Tab') fechar();
    });
    return { abrir, fechar };
  }
  // Foto do usuário (ou as iniciais num círculo azul, quando não tem foto). u = { nome, foto }
  function iniciais(nome) { const p = String(nome || '').trim().split(/\s+/).filter(Boolean); return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
  function avatar(u, tam = 24, extra = '') {
    const nome = (u && u.nome) || '';
    const st = `width:${tam}px;height:${tam}px;font-size:${Math.max(9, Math.round(tam * 0.4))}px`;
    return u && u.foto ? `<img class="avatar ${extra}" src="${esc(u.foto)}" alt="" title="${esc(nome)}" style="${st}">`
      : `<span class="avatar avatar-ini ${extra}" title="${esc(nome)}" style="${st}">${esc(iniciais(nome))}</span>`;
  }
  // Lê uma imagem escolhida e devolve um JPEG quadrado pequeno (recorte do centro) em data URL
  function reduzirImagem(arquivo, lado = 160) {
    return new Promise((resolve, reject) => {
      if (!arquivo || !/^image\//.test(arquivo.type)) return reject(new Error('Escolha um arquivo de imagem (JPG ou PNG).'));
      const leitor = new FileReader();
      leitor.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
      leitor.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Imagem inválida.'));
        img.onload = () => {
          const c = document.createElement('canvas'); c.width = c.height = lado;
          const m = Math.min(img.width, img.height), ctx = c.getContext('2d');
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, lado, lado);
          ctx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, lado, lado);
          resolve(c.toDataURL('image/jpeg', 0.82));
        };
        img.src = leitor.result;
      };
      leitor.readAsDataURL(arquivo);
    });
  }
  // Menu "⋯": abre por cima de tudo (posição fixa na tela), embaixo do botão ou, se não couber, em cima.
  // Assim nenhuma borda de tabela, cartão ou coluna corta o menu. Fecha ao rolar a página ou mudar o tamanho.
  function abrirMenu(botao, menu) {
    document.querySelectorAll('.menu-flutuante:not([hidden])').forEach(m => { if (m !== menu) m.hidden = true; });
    menu.classList.add('menu-flutuante');
    menu.setAttribute('role', 'menu');
    menu.hidden = false;
    const r = botao.getBoundingClientRect(), w = menu.offsetWidth, h = menu.offsetHeight;
    const esq = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8));
    const cima = r.bottom + 4 + h > window.innerHeight - 8 && r.top - 4 - h > 8;
    menu.style.left = esq + 'px';
    menu.style.top = (cima ? r.top - 4 - h : r.bottom + 4) + 'px';
  }
  // lista de sugestões (cidades, cargos…) presa ao campo, mas por cima de tudo: nenhuma borda corta
  function posicionarLista(input, lista) {
    if (lista.hidden) return;
    const r = input.getBoundingClientRect(), h = Math.min(lista.scrollHeight, 260);
    const cima = r.bottom + 2 + h > window.innerHeight - 8 && r.top - 2 - h > 8;
    Object.assign(lista.style, { position: 'fixed', left: r.left + 'px', width: Math.max(240, r.width) + 'px', right: 'auto', top: (cima ? r.top - 2 - h : r.bottom + 2) + 'px', zIndex: 1300 });
  }
  window.addEventListener('scroll', e => { document.querySelectorAll('.ac-lista:not([hidden])').forEach(l => { const inp = l.parentNode.querySelector('input'); if (inp) posicionarLista(inp, l); }); }, true);
  function fecharMenus() { document.querySelectorAll('.menu-flutuante:not([hidden])').forEach(m => { m.hidden = true; }); }
  document.addEventListener('mousedown', e => { if (!e.target.closest('.menu-flutuante, [data-acao="menu"], [data-menu]')) fecharMenus(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.querySelector('.menu-flutuante:not([hidden])')) { fecharMenus(); e.stopPropagation(); } }, true);
  // altura real do topo fixo (quebra em duas linhas em telas estreitas): barras grudadas usam --topo-h
  const ajustarTopo = () => { const tp = document.querySelector('.topo'); if (tp) document.documentElement.style.setProperty('--topo-h', tp.offsetHeight + 'px'); };
  window.addEventListener('resize', ajustarTopo); window.addEventListener('hashchange', () => setTimeout(ajustarTopo, 60)); setTimeout(ajustarTopo, 300);
  window.addEventListener('scroll', fecharMenus, true);
  window.addEventListener('resize', fecharMenus);
  function csvSerializar(linhas, separador = ';') {
    return linhas.map(l => l.map(v => {
      const s = v == null ? '' : String(v);
      return /[;",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(separador)).join('\r\n');
  }
  function baixarArquivo(nome, conteudo, tipo = 'text/csv;charset=utf-8') {
    const blob = new Blob([conteudo], { type: tipo });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function baixarCSV(nome, linhas) {
    baixarArquivo(nome, '﻿' + csvSerializar(linhas));
  }
  // Converte texto (colado do Excel, CSV com ; ou ,) em matriz de células.
  function csvParse(texto, separador) {
    texto = String(texto || '').replace(/^﻿/, '');
    if (!separador) {
      // Detecta o separador pelas primeiras linhas (uma linha de título sem separador não atrapalha).
      const amostra = texto.split(/\r?\n/).filter(l => l.trim()).slice(0, 15);
      const conta = ch => amostra.reduce((n, l) => n + (l.split(ch).length - 1), 0);
      const t = conta('\t'), pv = conta(';'), v = conta(',');
      separador = t ? '\t' : pv >= v && pv ? ';' : v ? ',' : '\t';
    }
    const linhas = []; let linha = []; let celula = ''; let aspas = false;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (aspas) {
        if (c === '"') { if (texto[i + 1] === '"') { celula += '"'; i++; } else aspas = false; }
        else celula += c;
      } else if (c === '"') aspas = true;
      else if (c === separador) { linha.push(celula); celula = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && texto[i + 1] === '\n') i++;
        linha.push(celula); linhas.push(linha); linha = []; celula = '';
      } else celula += c;
    }
    if (celula !== '' || linha.length) { linha.push(celula); linhas.push(linha); }
    return linhas.map(l => l.map(v => v.trim())).filter(l => l.some(v => v !== ''));
  }
  function lerArquivo(arquivo) {
    return new Promise((resolve, reject) => {
      const nome = arquivo.name.toLowerCase();
      const leitor = new FileReader();
      leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
      if (nome.endsWith('.xlsx') || nome.endsWith('.xls')) {
        if (typeof XLSX === 'undefined') return reject(new Error('Leitura de Excel indisponível (sem internet para carregar a biblioteca). Salve como CSV ou cole os dados.'));
        leitor.onload = e => {
          try {
            const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const linhas = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
            resolve(linhas.map(l => l.map(v => String(v ?? '').trim())).filter(l => l.some(v => v !== '')));
          } catch (err) { reject(err); }
        };
        leitor.readAsArrayBuffer(arquivo);
      } else {
        leitor.onload = e => resolve(csvParse(e.target.result));
        leitor.readAsText(arquivo, 'utf-8');
      }
    });
  }

  // ---------- Tabela HTML ----------
  function tabela({ colunas, linhas, vazio = 'Nenhum dado para exibir.', classe = '' }) {
    if (!linhas.length) return `<div class="vazio">${esc(vazio)}</div>`;
    const cab = colunas.map(c => `<th class="${c.classe || ''}">${esc(c.titulo)}</th>`).join('');
    const corpo = linhas.map(l => '<tr>' + colunas.map(c => {
      const v = c.render ? c.render(l) : esc(l[c.campo]);
      return `<td class="${c.classe || ''}">${v}</td>`;
    }).join('') + '</tr>').join('');
    return `<div class="tabela-wrap"><table class="tabela ${classe}"><thead><tr>${cab}</tr></thead><tbody>${corpo}</tbody></table></div>`;
  }

  function opcoesUF(selecionada = '', comVazio = true) {
    const ufs = Object.keys(Store.UFS).sort();
    return (comVazio ? `<option value="">UF</option>` : '') +
      ufs.map(u => `<option value="${u}" ${u === selecionada ? 'selected' : ''}>${u}</option>`).join('');
  }

  // Onde procurar candidatos que moram numa cidade, sem publicar vaga: bancos de currículos das plataformas (abrem já filtrados)
  function linksBuscaCandidatos(cidade, uf, cargo = '') {
    const enc = encodeURIComponent, local = `${cidade} ${uf}`;
    const q = cargo ? `${cargo} ${local}` : local;
    return [
      { grupo: 'Gratuito', nome: 'SINE — Buscar trabalhador (Emprega Brasil)', url: 'https://empregabrasil.mte.gov.br/', dica: 'Com o cadastro da empresa como empregador, o portal lista trabalhadores cadastrados no SINE por cidade e ocupação, sem precisar anunciar.' },
      { grupo: 'Gratuito', nome: 'LinkedIn — pessoas em ' + cidade, url: `https://www.linkedin.com/search/results/people/?keywords=${enc(q)}`, dica: 'Busca de perfis por cargo e cidade; contato por mensagem.' },
      { grupo: 'Gratuito', nome: 'Google — currículos / grupos de emprego', url: `https://www.google.com/search?q=${enc('"' + cidade + '" ' + (cargo ? '"' + cargo + '" ' : '') + 'currículo OR "procuro emprego" OR "grupo de vagas"')}`, dica: 'Grupos de WhatsApp/Facebook de vagas da cidade e currículos públicos.' },
      { grupo: 'Banco de currículos (conta de empresa)', nome: 'Indeed — currículos', url: `https://resumes.indeed.com/search?q=${enc(cargo || '')}&l=${enc(local)}`, dica: 'Busca de currículos por cidade; contato pago por candidato.' },
      { grupo: 'Banco de currículos (conta de empresa)', nome: 'Catho — banco de currículos', url: 'https://www.catho.com.br/empresas/', dica: 'Plano de empresa dá acesso ao banco de currículos filtrado por cidade.' },
      { grupo: 'Banco de currículos (conta de empresa)', nome: 'InfoJobs — currículos', url: 'https://www.infojobs.com.br/empresas/', dica: 'Plano de empresa; busca por cidade e cargo.' },
      { grupo: 'Banco de currículos (conta de empresa)', nome: 'Vagas.com — currículos', url: 'https://www.vagas.com.br/empresas', dica: 'Plano de empresa; busca por cidade e cargo.' }
    ];
  }
  function modalBuscaCandidatos(cidade, uf, cargo = '') {
    const links = linksBuscaCandidatos(cidade, uf, cargo);
    const grupos = [...new Set(links.map(l => l.grupo))];
    modal({ titulo: `Procurar candidatos em ${cidade}/${uf}${cargo ? ' — ' + cargo : ''}`, largura: '640px',
      corpo: `<p class="small muted">As plataformas não deixam o sistema puxar currículos sozinho (é dado pessoal e cada uma exige login da empresa). O que dá: abrir a busca <b>já filtrada pela cidade${cargo ? ' e pelo cargo' : ''}</b> em cada lugar.</p>` +
        grupos.map(g => `<div class="etiqueta-grupo">${esc(g)}</div>` + links.filter(l => l.grupo === g).map(l => `<div class="canal"><a class="btn btn-pequeno" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.nome)}</a><div class="small muted" style="margin-top:4px">${esc(l.dica)}</div></div>`).join('')).join(''),
      botoes: [{ texto: 'Fechar' }] });
  }

  // ---------- Auxiliares das telas de cadastro (v152) ----------
  // Estado vazio que ensina o próximo passo: título, texto curto e botões (cada um com data-acao para a tela ligar).
  // botoes: [{ acao: 'novo', texto: '+ Novo', primario: true }]
  function estadoVazio({ titulo, texto = '', botoes = [], compacto = false } = {}) {
    return `<div class="card vazio-guia${compacto ? ' compacto' : ''}">
      ${titulo ? `<h3>${esc(titulo)}</h3>` : ''}${texto ? `<p>${texto}</p>` : ''}
      ${botoes.length ? `<div class="vazio-guia-acoes">${botoes.map(b => `<button type="button" class="btn ${b.primario ? 'btn-primario' : ''}" data-acao="${esc(b.acao)}">${esc(b.texto)}</button>`).join('')}</div>` : ''}
    </div>`;
  }
  // Dica curta para quem é novo na tela; some quando a pessoa clica "Entendi" (lembra neste navegador).
  function dicaNovato(chave, html) {
    let vista = false;
    try { vista = localStorage.getItem('maparh:dica:' + chave) === '1'; } catch (e) { /* sem armazenamento: mostra */ }
    if (vista) return '';
    return `<div class="dica-novato" data-dica="${esc(chave)}" role="note"><span class="dica-novato-icone" aria-hidden="true">?</span><div class="dica-novato-texto">${html}</div><button type="button" class="btn-link dica-novato-ok">Entendi</button></div>`;
  }
  function ligarDicas(raiz) {
    (raiz || document).querySelectorAll('.dica-novato').forEach(d => {
      const b = d.querySelector('.dica-novato-ok');
      if (!b || b._ligado) return;
      b._ligado = true;
      b.addEventListener('click', () => { try { localStorage.setItem('maparh:dica:' + d.dataset.dica, '1'); } catch (e) { /* segue */ } d.remove(); });
    });
  }
  // Copia um texto para a área de transferência (com plano B para navegador antigo / sem https).
  async function copiarTexto(texto) {
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(texto); return true; } } catch (e) { /* tenta o plano B */ }
    const ta = document.createElement('textarea');
    ta.value = texto; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }
  // Itens com nome igual ou muito parecido (acento, caixa, 1-2 letras trocadas, um contido no outro). Para evitar cadastro duplicado.
  // nomeDe(item) -> texto. Devolve [{ item, igual }] (igual = mesmo nome sem acento/caixa).
  function nomesParecidos(texto, itens, nomeDe = x => x.nome) {
    const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const n = norm(texto);
    if (n.length < 3) return [];
    const dist = (a, b) => {
      if (Math.abs(a.length - b.length) > 2) return 99;
      const v = Array.from({ length: b.length + 1 }, (_, i) => i);
      for (let i = 1; i <= a.length; i++) {
        let ant = v[0]; v[0] = i;
        for (let j = 1; j <= b.length; j++) { const tmp = v[j]; v[j] = Math.min(v[j] + 1, v[j - 1] + 1, ant + (a[i - 1] === b[j - 1] ? 0 : 1)); ant = tmp; }
      }
      return v[b.length];
    };
    const out = [];
    for (const it of itens || []) {
      const m = norm(nomeDe(it));
      if (!m) continue;
      if (m === n) { out.push({ item: it, igual: true }); continue; }
      const limite = n.length >= 8 ? 2 : 1;
      if ((m.length >= 4 && n.length >= 4 && (m.includes(n) || n.includes(m))) || dist(n, m) <= limite) out.push({ item: it, igual: false });
    }
    return out.sort((a, b) => b.igual - a.igual);
  }

  return { esc, fmtNum, fmtPct, fmtKm, fmtDataHora, fmtData, rotuloTipo, badgeTipo, debounce, toast, modal, confirmar, linksBuscaCandidatos, modalBuscaCandidatos,
    autocompleteCidade, sugestoes, avatar, abrirMenu, fecharMenus, reduzirImagem, csvSerializar, baixarArquivo, baixarCSV, csvParse, lerArquivo, tabela, opcoesUF,
    estadoVazio, dicaNovato, ligarDicas, copiarTexto, nomesParecidos };
})();
