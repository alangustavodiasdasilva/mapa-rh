Paginas.cadastro = {
  titulo: 'Cadastro de contratações',
  render(el) {
    const projetos = App.projetosVisiveis();
    if (!projetos.length) {
      el.innerHTML = `<div class="card"><h2>Nenhum projeto disponível</h2><p>Crie um projeto (um estado, com ano opcional) antes de cadastrar as contratações.</p><button class="btn btn-primario" id="ir-projetos">Ir para Projetos</button></div>`;
      el.querySelector('#ir-projetos').addEventListener('click', () => App.ir('projetos'));
      return;
    }
    let projetoId = App.filtros.projetoId && projetos.some(p => p.id === App.filtros.projetoId) ? App.filtros.projetoId : projetos[0].id;
    const pref = JSON.parse(localStorage.getItem('maparh:cadastro-pref') || '{}');
    let tipoPadrao = pref.tipo || 'LOCAL';
    let ufPadrao = pref.uf || '';
    let busca = '';
    let pagina = 0;
    const TAM_PAGINA = 100;
    const selecionados = new Set();
    let editandoId = null;
    const MOVEL = Store.MOVEL;

    el.innerHTML = `
      <div class="card sem-padding">
        <div class="linha entre" style="padding:14px 16px;border-bottom:1px solid var(--borda)">
          <div class="linha">
            <label style="margin:0">Projeto <select id="cad-projeto" style="min-width:220px"></select></label>
            <span class="obra-info" id="obra-info"></span>
          </div>
          <div class="linha nao-imprimir">
            <input class="busca" id="cad-busca" placeholder="Buscar cidade, UF ou tipo…">
            <button class="btn btn-primario" id="btn-importar">Colar / importar planilha</button>
            <button class="btn" id="btn-exportar">Exportar CSV</button>
            <button class="btn" id="btn-modelo" title="Baixa uma planilha modelo para preencher">Modelo</button>
          </div>
        </div>
        <div class="tabela-wrap">
          <table class="tabela" id="cad-tabela">
            <thead><tr>
              <th style="width:30px"><input type="checkbox" id="sel-todos" title="Selecionar todos da página"></th>
              <th>MÓVEL/LOCAL</th><th>CIDADE DE ORIGEM</th><th>ESTADO</th>
              <th>CIDADE DE ATUAÇÃO</th>
              <th>BASE DE CONTRATAÇÃO</th>
              <th class="direita">Distância</th><th>Cadastrado</th><th class="acoes-col"></th>
            </tr></thead>
            <tbody id="cad-corpo"></tbody>
          </table>
        </div>
        <div class="rodape-tabela" id="cad-rodape"></div>
      </div>`;

    const selProjeto = el.querySelector('#cad-projeto');
    selProjeto.innerHTML = projetos.map(p => `<option value="${p.id}" ${p.id === projetoId ? 'selected' : ''}>${UI.esc(Store.rotuloProjeto(p))}${p.ativo ? '' : ' (inativo)'}</option>`).join('');
    selProjeto.addEventListener('change', () => {
      projetoId = selProjeto.value;
      App.filtros.projetoId = projetoId; localStorage.setItem('maparh:filtros', JSON.stringify(App.filtros));
      App.atualizarFiltroProjetos();
      selecionados.clear(); pagina = 0; editandoId = null; ufPadrao = projeto().uf;
      atualizarInfo(); renderLinhas();
    });
    el.querySelector('#cad-busca').addEventListener('input', UI.debounce(e => { busca = e.target.value; pagina = 0; renderLinhas(); }, 150));
    el.querySelector('#btn-exportar').addEventListener('click', exportar);
    el.querySelector('#btn-modelo').addEventListener('click', () => UI.baixarCSV('modelo-contratacoes.csv', [
      ['MOVEL/LOCAL', 'CIDADE DE ORIGEM', 'ESTADO', 'CIDADE DE ATUAÇÃO', 'BASE DE CONTRATAÇÃO'],
      ['LOCAL', 'PELOTAS', 'RS', 'PELOTAS', 'PELOTAS'],
      ['MOVEL', 'SANTA MARIA', 'RS', 'PELOTAS', 'PELOTAS'],
      ['MOVEL', 'BAGE', 'RS', 'MOVEL', 'PORTO ALEGRE']]));
    el.querySelector('#btn-importar').addEventListener('click', () => abrirImportacao());
    el.querySelector('#sel-todos').addEventListener('change', e => {
      el.querySelectorAll('#cad-corpo input.sel').forEach(c => { c.checked = e.target.checked; if (e.target.checked) selecionados.add(c.value); else selecionados.delete(c.value); });
      renderRodape();
    });

    const projeto = () => Store.projeto(projetoId);
    function atualizarInfo() {
      const p = projeto();
      el.querySelector('#obra-info').innerHTML = `${icone('mapa', 16)} Estado de atuação: ${p.uf} — ${UI.esc(Store.UFS[p.uf] || '')}${p.ano ? ' · ' + p.ano : ''}`;
      if (!ufPadrao) ufPadrao = p.uf;
    }
    function salvarPref() { localStorage.setItem('maparh:cadastro-pref', JSON.stringify({ tipo: tipoPadrao, uf: ufPadrao })); }
    function registrosDoProjeto() {
      const lista = Store.registrosFiltrados({ projetoId, tipo: App.filtros.tipo, usuario: App.usuario })
        .sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
      const b = Store.normalizar(busca);
      if (!b) return lista;
      return lista.filter(r => Store.normalizar([
        r.cidade.nome, r.cidade.uf, UI.rotuloTipo(r.tipo),
        r.cidadeAtuacao ? r.cidadeAtuacao.nome : '',
        r.cidadeBase ? r.cidadeBase.nome : ''
      ].join(' ')).includes(b));
    }
    const rotuloAtuacao = r => r.cidadeAtuacao ? UI.esc(r.cidadeAtuacao.nome) : '<span class="muted">—</span>';
    const rotuloBase = r => r.cidadeBase ? UI.esc(r.cidadeBase.nome) : '<span class="muted">—</span>';

    // Resolve a cidade digitada: seleção do autocomplete, nome exato, grafia aproximada ou busca na internet.
    async function resolverEntrada(input, uf, rotulo) {
      const texto = input.value.trim();
      if (input.dataset.cidadeId && Store.cidade(input.dataset.cidadeId)) return Store.cidade(input.dataset.cidadeId);
      if (!texto) throw new Error(`Informe a ${rotulo}.`);
      let c = Store.resolverCidade(texto, uf);
      if (c) return c;
      if (!uf) {
        const cands = Store.candidatasCidade(texto);
        if (cands.length > 1) throw new Error(`Existem ${cands.length} cidades chamadas "${texto}" (${cands.map(x => x.uf).join(', ')}). Informe o estado.`);
        throw new Error(`Cidade "${texto}" não encontrada. Informe o estado para buscar na internet.`);
      }
      c = Store.cidadeAproximada(texto, uf);
      if (c) { UI.toast(`"${texto}" entendido como ${c.nome}/${c.uf}.`, 'info', 2500); return c; }
      UI.toast(`Buscando coordenadas de ${texto}/${uf}…`, 'info', 2000);
      return Geo.geocodificarESalvar(texto, uf);
    }
    function ligarAutocomplete(cidEl, ufFn, aoSelecionar) {
      UI.autocompleteCidade(cidEl, {
        uf: ufFn, aoSelecionar,
        aoGeocodificar: async (texto, uf) => {
          if (!uf) { UI.toast('Selecione o estado antes de buscar na internet.', 'aviso'); return; }
          try { const c = await Geo.geocodificarESalvar(texto, uf); cidEl.value = c.nome; cidEl.dataset.cidadeId = c.id; UI.toast(`Cidade ${c.nome}/${c.uf} adicionada.`, 'sucesso'); }
          catch (e) { UI.toast(e.message, 'erro', 6000); }
        }
      });
    }

    function campoCidadeHTML(prefixo, sufixo, valor, cidadeId, placeholder) {
      return `<input class="${prefixo}-${sufixo}" placeholder="${placeholder}" value="${valor ? UI.esc(valor) : ''}" data-cidade-id="${cidadeId || ''}" style="min-width:130px">`;
    }

    function linhaEntradaHTML() {
      return `<tr class="linha-entrada nao-imprimir">
        <td class="muted">+</td>
        <td><select id="novo-tipo"><option value="LOCAL" ${tipoPadrao === 'LOCAL' ? 'selected' : ''}>LOCAL</option><option value="MOVEL" ${tipoPadrao === 'MOVEL' ? 'selected' : ''}>MÓVEL</option></select></td>
        <td><input id="novo-cidade" placeholder="Cidade de origem…"></td>
        <td><select id="novo-uf" style="min-width:70px">${UI.opcoesUF(ufPadrao)}</select></td>
        <td>${campoCidadeHTML('novo', 'atuacao', '', '', `Cidade em ${projeto().uf}…`)}</td>
        <td>${campoCidadeHTML('novo', 'base', '', '', `Base em ${projeto().uf}…`)}</td>
        <td class="muted small" colspan="2">Enter adiciona</td>
        <td class="acoes-col"><button class="btn btn-primario btn-pequeno" id="novo-add">Adicionar</button></td>
      </tr>`;
    }
    function ligarEntrada() {
      const tipoEl = el.querySelector('#novo-tipo'), cidEl = el.querySelector('#novo-cidade'), ufEl = el.querySelector('#novo-uf');
      if (!tipoEl) return;
      ligarAutocomplete(cidEl, () => ufEl.value, c => { ufEl.value = c.uf; });
      const atEl = el.querySelector('.novo-atuacao'), baseEl = el.querySelector('.novo-base');
      ligarAutocomplete(atEl, () => projeto().uf, () => {});
      ligarAutocomplete(baseEl, () => projeto().uf, c => { if (!atEl.value) { atEl.value = c.nome; atEl.dataset.cidadeId = c.id; } });
      async function adicionar() {
        const btn = el.querySelector('#novo-add');
        btn.disabled = true;
        try {
          tipoPadrao = tipoEl.value; ufPadrao = ufEl.value; salvarPref();
          const c = await resolverEntrada(cidEl, ufEl.value, 'cidade de origem');
          const at = await resolverEntrada(atEl, projeto().uf, 'cidade de atuação');
          const base = baseEl.value.trim() ? await resolverEntrada(baseEl, projeto().uf, 'base de contratação') : at;
          const r = Store.adicionarRegistro({ projetoId, tipo: tipoEl.value, cidadeId: c.id, atuacao: at.id, baseContratacao: base.id }, App.usuario);
          UI.toast(`${UI.rotuloTipo(r.tipo)} — ${c.nome}/${c.uf} → ${r.cidadeAtuacao ? r.cidadeAtuacao.nome : '?'} adicionado.`, 'sucesso', 1800);
          const manterAt = { valor: atEl.value, id: atEl.dataset.cidadeId };
          const manterBase = { valor: baseEl.value, id: baseEl.dataset.cidadeId };
          pagina = 0; renderLinhas();
          const nAt = el.querySelector('.novo-atuacao'), nBase = el.querySelector('.novo-base');
          if (nAt) { nAt.value = manterAt.valor; if (manterAt.id) nAt.dataset.cidadeId = manterAt.id; }
          if (nBase) { nBase.value = manterBase.valor; if (manterBase.id) nBase.dataset.cidadeId = manterBase.id; }
          const novoCid = el.querySelector('#novo-cidade'); if (novoCid) novoCid.focus();
        } catch (e) { UI.toast(e.message, 'erro', 6000); btn.disabled = false; }
      }
      el.querySelector('#novo-add').addEventListener('click', adicionar);
      [tipoEl, cidEl, ufEl, atEl, baseEl].forEach(x => x.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); adicionar(); } }));
    }

    function linhaHTML(r) {
      if (r.id === editandoId) {
        return `<tr data-id="${r.id}">
          <td></td>
          <td class="editando"><select class="ed-tipo"><option value="LOCAL" ${r.tipo === 'LOCAL' ? 'selected' : ''}>LOCAL</option><option value="MOVEL" ${r.tipo === 'MOVEL' ? 'selected' : ''}>MÓVEL</option></select></td>
          <td class="editando"><input class="ed-cidade" value="${UI.esc(r.cidade.nome)}" data-cidade-id="${r.cidade.id}"></td>
          <td class="editando"><select class="ed-uf" style="min-width:70px">${UI.opcoesUF(r.cidade.uf)}</select></td>
          <td class="editando">${campoCidadeHTML('ed', 'atuacao', r.cidadeAtuacao?.nome, r.cidadeAtuacao?.id, `Cidade em ${projeto().uf}…`)}</td>
          <td class="editando">${campoCidadeHTML('ed', 'base', r.cidadeBase?.nome, r.cidadeBase?.id, `Base em ${projeto().uf}…`)}</td>
          <td class="direita">${UI.fmtKm(r.distancia)}</td>
          <td class="muted small">${UI.fmtDataHora(r.criadoEm)}</td>
          <td class="acoes-col"><button class="btn btn-primario btn-pequeno ed-salvar">Salvar</button> <button class="btn btn-pequeno ed-cancelar">Cancelar</button></td>
        </tr>`;
      }
      return `<tr data-id="${r.id}">
        <td><input type="checkbox" class="sel" value="${r.id}" ${selecionados.has(r.id) ? 'checked' : ''}></td>
        <td>${UI.badgeTipo(r.tipo)}</td>
        <td>${UI.esc(r.cidade.nome)}${r.foraDoEstado ? ' <span class="badge badge-amarelo" title="Origem em outro estado">fora do estado</span>' : ''}</td>
        <td>${r.cidade.uf}</td>
        <td>${rotuloAtuacao(r)}</td>
        <td>${rotuloBase(r)}</td>
        <td class="direita">${UI.fmtKm(r.distancia)}</td>
        <td class="muted small" title="por ${UI.esc(r.criadoPor || '—')}">${UI.fmtDataHora(r.criadoEm)}</td>
        <td class="acoes-col nao-imprimir">${App.podeEditar() ? `<button class="btn-icone ed-editar" title="Editar">&#9998;</button><button class="btn-icone perigo ed-excluir" title="Excluir">&#128465;</button>` : ''}</td>
      </tr>`;
    }

    function renderLinhas() {
      const lista = registrosDoProjeto();
      const inicio = pagina * TAM_PAGINA;
      const fatia = lista.slice(inicio, inicio + TAM_PAGINA);
      const corpo = el.querySelector('#cad-corpo');
      corpo.innerHTML = (App.podeEditar() ? linhaEntradaHTML() : '') +
        (fatia.length ? fatia.map(linhaHTML).join('') : `<tr><td colspan="8" class="vazio">${busca ? 'Nenhum registro corresponde à busca.' : 'Nenhuma contratação cadastrada neste projeto. Use a linha acima para adicionar ou clique em "Colar / importar planilha".'}</td></tr>`);
      ligarEntrada();
      corpo.querySelectorAll('input.sel').forEach(c => c.addEventListener('change', () => { if (c.checked) selecionados.add(c.value); else selecionados.delete(c.value); renderRodape(); }));
      corpo.querySelectorAll('.ed-editar').forEach(b => b.addEventListener('click', () => { editandoId = b.closest('tr').dataset.id; renderLinhas(); }));
      corpo.querySelectorAll('.ed-excluir').forEach(b => b.addEventListener('click', async () => {
        const id = b.closest('tr').dataset.id; const r = lista.find(x => x.id === id);
        if (await UI.confirmar(`Excluir o registro ${UI.rotuloTipo(r.tipo)} — ${r.cidade.nome}/${r.cidade.uf}?`, { textoOk: 'Excluir', perigo: true })) {
          Store.excluirRegistro(id, App.usuario); selecionados.delete(id); renderLinhas();
        }
      }));
      const trEd = corpo.querySelector(`tr[data-id="${editandoId}"]`);
      if (trEd) {
        const cidEl = trEd.querySelector('.ed-cidade'), ufEl = trEd.querySelector('.ed-uf'), tipoEl = trEd.querySelector('.ed-tipo');
        const atEl = trEd.querySelector('.ed-atuacao'), baseEl = trEd.querySelector('.ed-base');
        ligarAutocomplete(cidEl, () => ufEl.value, c => { ufEl.value = c.uf; });
        ligarAutocomplete(atEl, () => projeto().uf, () => {});
        ligarAutocomplete(baseEl, () => projeto().uf, c => { if (!atEl.value) { atEl.value = c.nome; atEl.dataset.cidadeId = c.id; } });
        const salvar = async () => {
          try {
            const c = await resolverEntrada(cidEl, ufEl.value, 'cidade de origem');
            const at = await resolverEntrada(atEl, projeto().uf, 'cidade de atuação');
            const base = baseEl.value.trim() ? await resolverEntrada(baseEl, projeto().uf, 'base de contratação') : at;
            Store.atualizarRegistro(editandoId, { tipo: tipoEl.value, cidadeId: c.id, atuacao: at.id, baseContratacao: base.id }, App.usuario);
            editandoId = null; renderLinhas(); UI.toast('Registro atualizado.', 'sucesso', 1500);
          } catch (e) { UI.toast(e.message, 'erro', 6000); }
        };
        trEd.querySelector('.ed-salvar').addEventListener('click', salvar);
        trEd.querySelector('.ed-cancelar').addEventListener('click', () => { editandoId = null; renderLinhas(); });
        [cidEl, ufEl, tipoEl, atEl, baseEl].forEach(x => x.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); salvar(); } if (e.key === 'Escape') { editandoId = null; renderLinhas(); } }));
        setTimeout(() => cidEl.focus(), 30);
      }
      renderRodape(lista);
    }

    function renderRodape(lista) {
      lista = lista || registrosDoProjeto();
      const local = lista.filter(r => r.tipo === 'LOCAL').length;
      const movelEstado = lista.filter(r => r.atuacaoMovel).length;
      const fora = lista.filter(r => r.foraDoEstado).length;
      const paginas = Math.max(1, Math.ceil(lista.length / TAM_PAGINA));
      el.querySelector('#cad-rodape').innerHTML = `
        <span>Total: <b>${UI.fmtNum(lista.length)}</b></span>
        <span>LOCAL: <b>${UI.fmtNum(local)}</b> (${UI.fmtPct(lista.length ? local / lista.length * 100 : 0)})</span>
        <span>MÓVEL: <b>${UI.fmtNum(lista.length - local)}</b></span>
        <span>Atuação em todo o estado: <b>${UI.fmtNum(movelEstado)}</b></span>
        <span>Origem fora do estado: <b>${UI.fmtNum(fora)}</b></span>
        ${App.filtros.tipo ? `<span class="badge badge-amarelo">filtro: somente ${UI.rotuloTipo(App.filtros.tipo)}</span>` : ''}
        <span class="espaco"></span>
        ${selecionados.size && App.podeEditar() ? `<button class="btn btn-perigo btn-pequeno" id="excluir-sel">Excluir ${selecionados.size} selecionado(s)</button>` : ''}
        ${paginas > 1 ? `<span class="nao-imprimir"><button class="btn btn-pequeno" id="pg-ant" ${pagina === 0 ? 'disabled' : ''}>&lsaquo;</button> página ${pagina + 1} de ${paginas} <button class="btn btn-pequeno" id="pg-prox" ${pagina >= paginas - 1 ? 'disabled' : ''}>&rsaquo;</button></span>` : ''}`;
      const ex = el.querySelector('#excluir-sel');
      if (ex) ex.addEventListener('click', async () => {
        if (await UI.confirmar(`Excluir ${selecionados.size} registro(s) selecionado(s)?`, { textoOk: 'Excluir', perigo: true })) {
          Store.excluirRegistros([...selecionados], App.usuario); selecionados.clear(); renderLinhas();
        }
      });
      const ant = el.querySelector('#pg-ant'), prox = el.querySelector('#pg-prox');
      if (ant) ant.addEventListener('click', () => { pagina--; renderLinhas(); });
      if (prox) prox.addEventListener('click', () => { pagina++; renderLinhas(); });
    }

    function exportar() {
      const lista = registrosDoProjeto();
      const p = projeto();
      const linhas = [['MOVEL/LOCAL', 'CIDADE DE ORIGEM', 'ESTADO', 'CIDADE DE ATUAÇÃO', 'BASE DE CONTRATAÇÃO', 'PROJETO', 'UF PROJETO', 'ANO', 'DISTANCIA KM', 'ORIGEM FORA DO ESTADO', 'CADASTRADO EM']];
      lista.forEach(r => linhas.push([
        UI.rotuloTipo(r.tipo), r.cidade.nome, r.cidade.uf,
        r.cidadeAtuacao ? r.cidadeAtuacao.nome : '',
        r.cidadeBase ? r.cidadeBase.nome : '',
        p.nome, p.uf, p.ano || '',
        r.distancia == null ? '' : Math.round(r.distancia),
        r.foraDoEstado ? 'SIM' : 'NAO', UI.fmtDataHora(r.criadoEm)
      ]));
      UI.baixarCSV(`contratacoes-${Store.normalizar(p.nome).replace(/ /g, '-')}.csv`, linhas);
    }

    // ---------- importação (colar do Excel ou arquivo) ----------
    // Colunas: MOVEL/LOCAL | CIDADE DE ORIGEM | ESTADO | CIDADE DE ATUAÇÃO | BASE DE CONTRATAÇÃO
    // Quando CIDADE DE ATUAÇÃO = "MOVEL" → usa BASE DE CONTRATAÇÃO como atuação
    function interpretar(matriz, tipoDef, ufDef) {
      const n = s => Store.normalizar(s);
      let iTipo = -1, iCid = -1, iUF = -1, iAt = -1, iBase = -1, inicio = 0;
      for (let i = 0; i < Math.min(matriz.length, 5); i++) {
        const cab = matriz[i].map(n);
        const t = cab.findIndex(h => /movel|local|tipo/.test(h) && !/atuacao|destino/.test(h));
        const c = cab.findIndex(h => /origem|residencia|municipio/.test(h) || (/cidade/.test(h) && !/atuacao|destino|trabalho|obra|base|contrat/.test(h)));
        const u = cab.findIndex(h => /^(estado|uf)$/.test(h) || /estado|\buf\b/.test(h));
        const a = cab.findIndex(h => /atuacao|destino|trabalho|obra|lotacao/.test(h) && !/base|contrat/.test(h));
        const b = cab.findIndex(h => /base|contrat/.test(h));
        if (c >= 0 || a >= 0 || (t >= 0 && u >= 0)) { iTipo = t; iCid = c; iUF = u; iAt = a; iBase = b; inicio = i + 1; break; }
      }
      const linhas = [];
      for (let i = inicio; i < matriz.length; i++) {
        const cel = matriz[i];
        if (!cel.some(v => v)) continue;
        let tipo = '', cidade = '', uf = '', atuacao = '', base = '';
        if (iCid >= 0 || iTipo >= 0 || iAt >= 0) {
          tipo = iTipo >= 0 ? cel[iTipo] || '' : '';
          cidade = iCid >= 0 ? cel[iCid] || '' : '';
          uf = iUF >= 0 ? cel[iUF] || '' : '';
          atuacao = iAt >= 0 ? cel[iAt] || '' : '';
          base = iBase >= 0 ? cel[iBase] || '' : '';
        } else {
          const resto = [];
          for (const v of cel) {
            const nv = n(v);
            if (!nv) continue;
            if (!tipo && /^(local|movel|l|m)$/.test(nv)) tipo = v;
            else if (!uf && /^[a-z]{2}$/.test(nv) && Store.UFS[nv.toUpperCase()]) uf = v;
            else resto.push(v);
          }
          cidade = resto[0] || ''; atuacao = resto[1] || ''; base = resto[2] || '';
        }
        const nt = n(tipo);
        tipo = nt.startsWith('mov') || nt === 'm' ? 'MOVEL' : nt.startsWith('loc') || nt === 'l' ? 'LOCAL' : (tipoDef || '');
        uf = String(uf || '').trim().toUpperCase();
        if (uf && !Store.UFS[uf]) { const achou = Object.keys(Store.UFS).find(k => n(Store.UFS[k]) === n(uf)); uf = achou || uf; }
        if (!uf) uf = ufDef || '';
        atuacao = String(atuacao || '').trim();
        base = String(base || '').trim();
        if (!cidade.trim() && !tipo && !atuacao) continue;
        linhas.push({ linha: i + 1, tipo, cidade: String(cidade).trim(), uf, atuacao, base, status: 'pendente', cidadeObj: null, atuacaoObj: null, baseObj: null, erro: '', ajustes: [] });
      }
      return linhas;
    }

    function abrirImportacao() {
      const p = projeto();
      const m = UI.modal({
        titulo: 'Colar / importar planilha',
        largura: '900px',
        corpo: `
          <p class="muted small">Copie as linhas da planilha (colunas <b>MOVEL/LOCAL</b>, <b>CIDADE DE ORIGEM</b>, <b>ESTADO</b>, <b>CIDADE DE ATUAÇÃO</b>, <b>BASE DE CONTRATAÇÃO</b>) e cole abaixo, ou escolha um arquivo .xlsx / .csv. Quando CIDADE DE ATUAÇÃO for <b>MOVEL</b>, o sistema usa a BASE DE CONTRATAÇÃO como atuação. O cabeçalho é reconhecido automaticamente.</p>
          <div class="form-linha">
            <label>Colar da planilha<textarea class="colar" id="imp-texto" placeholder="LOCAL&#9;PIRATINI&#9;RS&#9;PELOTAS&#9;PELOTAS&#10;MOVEL&#9;SANTA MARIA&#9;RS&#9;PELOTAS&#9;PELOTAS&#10;MOVEL&#9;BAGE&#9;RS&#9;MOVEL&#9;PORTO ALEGRE"></textarea></label>
            <div>
              <label>Ou arquivo (.xlsx, .xls, .csv, .txt)<input type="file" id="imp-arquivo" accept=".xlsx,.xls,.csv,.txt"></label>
              <label>Tipo padrão (se a coluna faltar)<select id="imp-tipo"><option value="LOCAL">LOCAL</option><option value="MOVEL">MÓVEL</option></select></label>
              <label>Estado de origem padrão (se a coluna faltar)<select id="imp-uf">${UI.opcoesUF(p.uf)}</select></label>
              <button class="btn btn-primario" id="imp-analisar">Analisar linhas</button>
            </div>
          </div>
          <div id="imp-resultado" class="mt"></div>`,
        botoes: [{ texto: 'Fechar' }, { texto: 'Importar linhas válidas', classe: 'btn-primario', acao: importar }]
      });
      const btnImportar = m.el.querySelector('.modal-rodape .btn-primario');
      btnImportar.disabled = true;
      let linhas = [];
      let matrizArquivo = null;
      m.corpo.querySelector('#imp-arquivo').addEventListener('change', async e => {
        const arq = e.target.files[0]; if (!arq) return;
        try { matrizArquivo = await UI.lerArquivo(arq); UI.toast(`${matrizArquivo.length} linha(s) lida(s) do arquivo.`, 'sucesso'); }
        catch (err) { UI.toast(err.message, 'erro', 6000); matrizArquivo = null; }
      });
      m.corpo.querySelector('#imp-analisar').addEventListener('click', async () => {
        const texto = m.corpo.querySelector('#imp-texto').value;
        const matriz = texto.trim() ? UI.csvParse(texto) : matrizArquivo;
        if (!matriz || !matriz.length) { UI.toast('Cole as linhas ou escolha um arquivo.', 'aviso'); return; }
        linhas = interpretar(matriz, m.corpo.querySelector('#imp-tipo').value, m.corpo.querySelector('#imp-uf').value);
        await resolverLinhas();
      });
      function situacao(l) {
        if (l.status === 'ok') {
          const at = l.atuacaoObj ? UI.esc(l.atuacaoObj.nome) : '?';
          const base = l.baseObj ? ` · base: ${UI.esc(l.baseObj.nome)}` : '';
          return `<span class="status-ok">OK</span> <span class="muted small">${UI.esc(l.cidadeObj.nome)}/${l.cidadeObj.uf} → ${at}${base}${l.ajustes.length ? ' · ajustado: ' + UI.esc(l.ajustes.join(', ')) : ''}</span>`;
        }
        if (l.status === 'buscando') return '<span class="status-espera">buscando na internet…</span>';
        return `<span class="status-erro">${UI.esc(l.erro || 'não encontrada')}</span>`;
      }
      function renderResultado(msg) {
        const validas = linhas.filter(l => l.status === 'ok').length;
        const res = m.corpo.querySelector('#imp-resultado');
        res.innerHTML = `<div class="linha entre mb"><b>${linhas.length} linha(s) encontrada(s) · ${validas} válida(s)</b><span class="muted small">${UI.esc(msg || '')}</span></div>` +
          (linhas.some(l => l.status === 'erro') && !Store.temIBGE() ? `<div class="banner banner-aviso mb" style="border-radius:8px">Algumas cidades não foram encontradas. Baixar a lista completa de municípios (menu <b>Cidades</b>) resolve a maioria dos casos automaticamente. <button class="btn btn-pequeno" id="imp-ibge">Baixar agora</button></div>` : '') +
          `<div style="max-height:320px;overflow:auto">` + UI.tabela({
            colunas: [
              { titulo: 'Linha', render: l => l.linha },
              { titulo: 'Tipo', render: l => l.tipo ? UI.badgeTipo(l.tipo) : '<span class="status-erro">?</span>' },
              { titulo: 'Origem', render: l => UI.esc(l.cidade) },
              { titulo: 'UF', render: l => UI.esc(l.uf) },
              { titulo: 'Atuação', render: l => UI.esc(l.atuacao || '—') },
              { titulo: 'Base contratação', render: l => UI.esc(l.base || '—') },
              { titulo: 'Situação', render: situacao }
            ], linhas
          }) + `</div>`;
        const b = res.querySelector('#imp-ibge');
        if (b) b.addEventListener('click', async () => {
          b.disabled = true; b.textContent = 'Baixando…';
          try { const n = await Geo.importarIBGE(t => b.textContent = t); UI.toast(`${n} municípios carregados.`, 'sucesso'); await resolverLinhas(); }
          catch (e) { UI.toast(e.message, 'erro', 6000); b.disabled = false; b.textContent = 'Baixar agora'; }
        });
        btnImportar.disabled = validas === 0;
      }
      function resolverLocal(nome, uf, ajustes) {
        let c = Store.resolverCidade(nome, uf);
        if (c) return c;
        c = Store.cidadeAproximada(nome, uf);
        if (c) { ajustes.push(`${nome} → ${c.nome}`); return c; }
        return null;
      }
      async function resolverLinhas() {
        const pendencias = [];
        for (const l of linhas) {
          l.cidadeObj = null; l.atuacaoObj = null; l.baseObj = null; l.erro = ''; l.ajustes = []; l.status = 'ok';
          if (!l.cidade) { l.status = 'erro'; l.erro = 'cidade de origem vazia'; continue; }
          if (!l.tipo) { l.status = 'erro'; l.erro = 'tipo (LOCAL/MÓVEL) não informado'; continue; }
          if (!l.atuacao && !l.base) { l.status = 'erro'; l.erro = 'cidade de atuação não informada'; continue; }
          // origem
          if (!l.uf) {
            const cands = Store.candidatasCidade(l.cidade);
            if (cands.length === 1) l.cidadeObj = cands[0];
            else { l.status = 'erro'; l.erro = cands.length > 1 ? `origem ambígua (${cands.map(x => x.uf).join(', ')}) — informe a UF` : 'informe a UF de origem'; continue; }
          } else {
            l.cidadeObj = resolverLocal(l.cidade, l.uf, l.ajustes);
            if (!l.cidadeObj) { l.status = 'buscando'; pendencias.push({ l, campo: 'cidadeObj', nome: l.cidade, uf: l.uf }); }
          }
          // base de contratação (resolver primeiro pois atuação pode depender dela)
          if (l.base) {
            l.baseObj = resolverLocal(l.base, p.uf, l.ajustes);
            if (!l.baseObj) { l.status = 'buscando'; pendencias.push({ l, campo: 'baseObj', nome: l.base, uf: p.uf }); }
          }
          // atuação: se MOVEL → usa base de contratação; senão resolve normalmente
          const ehMovelAtuacao = Store.ehMovel(l.atuacao) || /^m[oó]vel/i.test(l.atuacao);
          if (ehMovelAtuacao) {
            // atuação = base de contratação (resolvido acima)
            l.atuacaoObj = l.baseObj || null;
            if (!l.atuacaoObj && !l.base) { l.status = 'erro'; l.erro = 'Atuação "MOVEL" requer BASE DE CONTRATAÇÃO'; continue; }
          } else if (l.atuacao) {
            l.atuacaoObj = resolverLocal(l.atuacao, p.uf, l.ajustes);
            if (!l.atuacaoObj) { l.status = 'buscando'; pendencias.push({ l, campo: 'atuacaoObj', nome: l.atuacao, uf: p.uf }); }
          } else {
            // sem atuação informada → usa base
            l.atuacaoObj = l.baseObj;
          }
        }
        renderResultado();
        const distintas = [...new Set(pendencias.map(x => Store.normalizar(x.nome) + '|' + x.uf))];
        let feitas = 0;
        for (const chave of distintas) {
          const grupo = pendencias.filter(x => Store.normalizar(x.nome) + '|' + x.uf === chave);
          renderResultado(`Buscando coordenadas ${feitas + 1} de ${distintas.length}…`);
          try {
            const c = await Geo.geocodificarESalvar(grupo[0].nome, grupo[0].uf);
            grupo.forEach(x => {
              x.l[x.campo] = c;
              // se atuacaoObj dependia de baseObj e baseObj acabou de resolver
              if (x.campo === 'baseObj' && (Store.ehMovel(x.l.atuacao) || /^m[oó]vel/i.test(x.l.atuacao))) x.l.atuacaoObj = c;
            });
          } catch (e) {
            grupo.forEach(x => { x.l.status = 'erro'; x.l.erro = `"${x.nome}" (${x.uf}) não encontrada na internet`; });
          }
          feitas++;
        }
        for (const l of linhas) if (l.status === 'buscando') l.status = l.cidadeObj && l.atuacaoObj ? 'ok' : 'erro';
        renderResultado(distintas.length ? 'Busca concluída.' : '');
      }
      async function importar() {
        const validas = linhas.filter(l => l.status === 'ok');
        if (!validas.length) throw new Error('Nenhuma linha válida para importar.');
        const invalidas = linhas.length - validas.length;
        if (invalidas && !(await UI.confirmar(`${invalidas} linha(s) com problema serão ignoradas. Importar as ${validas.length} válidas?`))) return false;
        const n = Store.adicionarRegistros(validas.map(l => ({
          projetoId, tipo: l.tipo, cidadeId: l.cidadeObj.id,
          atuacao: l.atuacaoObj.id,
          baseContratacao: l.baseObj ? l.baseObj.id : l.atuacaoObj.id
        })), App.usuario);
        UI.toast(`${n} contratação(ões) importada(s).`, 'sucesso');
        pagina = 0; renderLinhas();
      }
    }

    atualizarInfo();
    renderLinhas();
  }
};
