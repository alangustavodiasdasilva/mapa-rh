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
  function rotuloTipo(t) { return t === 'MOVEL' ? 'MÓVEL' : 'LOCAL'; }
  function badgeTipo(t) { return `<span class="badge ${t === 'MOVEL' ? 'badge-movel' : 'badge-local'}">${rotuloTipo(t)}</span>`; }

  function debounce(fn, ms) {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }

  // ---------- Toast ----------
  function toast(msg, tipo = 'info', ms = 3500) {
    let area = document.getElementById('toasts');
    if (!area) { area = document.createElement('div'); area.id = 'toasts'; document.body.appendChild(area); }
    const el = document.createElement('div');
    el.className = 'toast toast-' + tipo;
    el.textContent = msg;
    area.appendChild(el);
    requestAnimationFrame(() => el.classList.add('visivel'));
    setTimeout(() => { el.classList.remove('visivel'); setTimeout(() => el.remove(), 300); }, ms);
  }

  // ---------- Modal ----------
  function modal({ titulo, corpo, botoes = [], largura = '560px', aoFechar, fecharAoClicarFora = true }) {
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
    function aoTeclar(e) { if (e.key === 'Escape') api.fechar(); }
    document.addEventListener('keydown', aoTeclar);
    document.body.appendChild(overlay);
    const primeiro = corpoEl.querySelector('input,select,textarea,button');
    if (primeiro) setTimeout(() => primeiro.focus(), 50);
    return api;
  }

  function confirmar(mensagem, { titulo = 'Confirmação', textoOk = 'Confirmar', perigo = false } = {}) {
    return new Promise(resolve => {
      let respondido = false;
      modal({
        titulo,
        corpo: `<p>${esc(mensagem)}</p>`,
        largura: '440px',
        aoFechar: () => { if (!respondido) resolve(false); },
        botoes: [
          { texto: 'Cancelar', classe: 'btn-secundario', acao: () => { respondido = true; resolve(false); } },
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
          ? `&#128269; Buscar coordenadas de <b>${esc(it.texto)}</b>${it.uf ? ' (' + esc(it.uf) + ')' : ''} na internet`
          : `${esc(it.cidade.nome)} <span class="muted">(${esc(it.cidade.uf)})</span>`;
        div.addEventListener('mousedown', e => e.preventDefault()); // mantém o foco no campo
        div.addEventListener('click', () => escolher(i));
        lista.appendChild(div);
      });
      lista.hidden = itens.length === 0;
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
      else if (e.key === 'Escape') fechar();
    });
    return { fechar };
  }

  // ---------- CSV / arquivos ----------
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

  return { esc, fmtNum, fmtPct, fmtKm, fmtDataHora, fmtData, rotuloTipo, badgeTipo, debounce, toast, modal, confirmar,
    autocompleteCidade, csvSerializar, baixarArquivo, baixarCSV, csvParse, lerArquivo, tabela, opcoesUF };
})();
