Paginas.cidades = {
  titulo: 'Cidades',
  semFiltros: true,
  render(el) {
    const podeEditar = App.podeEditar();
    let busca = '', uf = '', soEmUso = false;

    el.innerHTML = `
      <div class="grade grade-2 mb">
        <div class="card">
          <h2>Lista completa de municípios (IBGE)</h2>
          <p class="muted small">O sistema já traz ${UI.fmtNum((window.CIDADES_SEED || []).length)} cidades principais. Baixe a lista oficial com os 5.570 municípios e suas coordenadas para que qualquer cidade do Brasil seja reconhecida automaticamente ao digitar ou importar. É feito uma única vez e fica guardado neste navegador.</p>
          <div class="linha">
            <span id="ibge-status">${Store.temIBGE() ? `<span class="badge badge-verde">carregada — ${UI.fmtNum(Store.totalIBGE())} municípios</span>` : '<span class="badge badge-amarelo">não carregada</span>'}</span>
            ${podeEditar ? `<button class="btn btn-primario btn-pequeno" id="btn-ibge">${Store.temIBGE() ? 'Atualizar lista' : 'Baixar agora'}</button>` : ''}
          </div>
          <p class="muted small mt">Fonte: repositório público <i>municipios-brasileiros</i> (dados do IBGE). Requer internet.</p>
        </div>
        <div class="card" id="card-sine">
          <h2>Agências do SINE</h2>
          <p class="muted small" id="sine-cobertura"></p>
          <p class="muted small">Bases oficiais embutidas: <b>RS</b> (FGTAS), <b>PR</b> (Secretaria do Trabalho) e <b>SC</b> (SICOS/SAS, parcial) — carregadas sozinhas quando o estado entra num projeto. Estado <b>sem base</b>: ao cadastrar o projeto o sistema <b>caça as agências do estado inteiro na internet</b> (OpenStreetMap) em segundo plano e, ao abrir a ficha de uma cidade, busca de novo pelo <b>Google Places</b> (com chave) ou OpenStreetMap.</p>
          ${podeEditar ? `<label>Chave da API do Google Places (opcional)<input id="sine-google-key" type="password" placeholder="AIza…" value="${UI.esc(Store.config().googleKey || '')}" autocomplete="off"><span class="muted small">Google Cloud → APIs e serviços → Credenciais → Criar chave; ative "Places API (New)". Fica salva neste navegador e no backup.</span></label>
          <div class="linha"><button class="btn btn-primario btn-pequeno" id="btn-sine-estado">Caçar agências dos estados sem base agora</button><button class="btn btn-pequeno" id="btn-sine-lote">Buscar por cidade (distritos)</button><button class="btn btn-pequeno" id="btn-sine-importar">Importar planilha</button><button class="btn btn-pequeno" id="btn-sine-modelo">Modelo da planilha</button></div>
          <div id="sine-lote-status" class="small muted" style="margin-top:6px"></div>` : ''}
          <div id="sine-importadas" class="small" style="margin-top:8px"></div>
        </div>
        <div class="card">
          <h2>Cidade não encontrada?</h2>
          <p class="muted small">Ao digitar uma cidade desconhecida no cadastro, o sistema busca as coordenadas na internet (OpenStreetMap) e a guarda automaticamente. Se preferir, cadastre manualmente informando latitude e longitude.</p>
          ${podeEditar ? '<button class="btn btn-pequeno" id="btn-manual">+ Cadastrar cidade manualmente</button>' : ''}
        </div>
      </div>
      <div class="card sem-padding">
        <div class="linha" style="padding:12px 16px;border-bottom:1px solid var(--borda)">
          <input class="busca" id="cid-busca" placeholder="Buscar cidade…">
          <select id="cid-uf" style="width:auto">${UI.opcoesUF('')}</select>
          <label style="margin:0;display:flex;gap:6px;align-items:center;font-weight:500"><input type="checkbox" id="cid-uso"> Somente cidades em uso</label>
          <span class="espaco"></span><span class="muted small" id="cid-total"></span>
        </div>
        <div id="cid-lista"></div>
      </div>`;

    // ---- agências do SINE ----
    async function renderSine() {
      await Store.carregarBasesSineEmUso();
      const cob = Store.coberturaSine();
      const ufs = Object.keys(cob).sort();
      el.querySelector('#sine-cobertura').innerHTML = ufs.length ? 'Cobertura atual: ' + ufs.map(u => `<b>${u}</b> (${cob[u]})`).join(' · ') : 'Nenhuma agência na base.';
      const imp = Store.agenciasSineImportadas();
      const porUF = {}; imp.forEach(a => { porUF[a.uf] = (porUF[a.uf] || 0) + 1; });
      el.querySelector('#sine-importadas').innerHTML = Object.keys(porUF).sort().map(u => `<span class="badge badge-azul" style="margin-right:6px">${u}: ${porUF[u]} importada(s)${podeEditar ? ` <button class="chip-btn sine-remover" data-uf="${u}" title="Remover as agências importadas de ${u}">×</button>` : ''}</span>`).join('');
      el.querySelectorAll('.sine-remover').forEach(b => b.addEventListener('click', async () => {
        if (!await UI.confirmar(`Remover as agências importadas de ${b.dataset.uf}?`, { perigo: true, textoOk: 'Remover' })) return;
        Store.removerAgenciasSine(b.dataset.uf, App.usuario); renderSine();
      }));
    }
    renderSine();
    const kEl = el.querySelector('#sine-google-key');
    if (kEl) kEl.addEventListener('change', () => { Store.salvarConfig({ googleKey: kEl.value.trim() }, App.usuario); UI.toast(kEl.value.trim() ? 'Chave do Google salva.' : 'Chave removida.', 'sucesso'); });
    // busca em lote: todas as cidades dos distritos que ainda não têm agência nem busca recente
    const bEst = el.querySelector('#btn-sine-estado');
    if (bEst) bEst.addEventListener('click', async () => {
      const ufs = Store.ufsSemBaseSine();
      if (!ufs.length) { UI.toast('Todos os estados em uso já têm base oficial embutida (' + Store.BASES_SINE.join(', ') + ').', 'info', 6000); return; }
      UI.toast('Caçando agências em ' + ufs.join(', ') + ' (segundo plano)…', 'info');
      App.cacarSineEstados(true);
    });
    const bLote = el.querySelector('#btn-sine-lote');
    const stLote = el.querySelector('#sine-lote-status');
    if (stLote) stLote.textContent = App.textoStatusLote();
    if (bLote) bLote.addEventListener('click', async () => {
      if (App.loteSine && App.loteSine.ativo) { UI.toast('A busca já está rodando em segundo plano.', 'info'); return; }
      await Store.carregarBasesSineEmUso();
      // estados com base oficial embutida já estão cobertos (agência da cidade ou a mais próxima); a internet só para os outros
      const cidades = [...new Set(Store.distritos().flatMap(d => Store.cidadesDoDistrito(d)))]
        .filter(ci => !Store.BASES_SINE.includes(ci.uf) && !Store.sineDaCidade(ci).length && !Store.buscaSineRecente(ci.id));
      if (!cidades.length) { UI.toast('Todos os estados em uso já têm base oficial embutida (' + Store.BASES_SINE.join(', ') + '). Nada a buscar na internet.', 'info', 6000); return; }
      const semChave = !(Store.config().googleKey || '').trim();
      if (!await UI.confirmar(`Buscar na internet as agências de ${cidades.length} cidade(s)${semChave ? ' pelo OpenStreetMap (sem chave do Google a cobertura é menor e pode demorar)' : ' pelo Google Places'}? A busca continua em segundo plano mesmo se você trocar de tela.`, { textoOk: 'Buscar' })) return;
      App.buscarSineLote(cidades);
    });
    const bModelo = el.querySelector('#btn-sine-modelo');
    if (bModelo) bModelo.addEventListener('click', () => UI.baixarCSV('modelo_agencias_sine.csv', [
      ['UF', 'CIDADE', 'NOME', 'ENDEREÇO', 'TELEFONE', 'E-MAIL', 'HORÁRIO'],
      ['SC', 'Chapecó', 'SINE Chapecó', 'Rua Exemplo, 100 — Centro', '(49) 0000-0000 / (49) 0000-0001', 'sine@exemplo.sc.gov.br', 'Seg a sex, 8h às 17h']]));
    const bImp = el.querySelector('#btn-sine-importar');
    if (bImp) bImp.addEventListener('click', () => {
      const m = UI.modal({
        titulo: 'Importar agências do SINE', largura: '640px',
        corpo: `<p class="small muted">Cole as linhas copiadas do Excel (com o cabeçalho) ou escolha um arquivo .xlsx/.csv. Colunas: UF, CIDADE, NOME, ENDEREÇO, TELEFONE, E-MAIL, HORÁRIO. Vários telefones separados por "/".</p>
          <label>Colar<textarea id="sine-texto" rows="8" placeholder="UF\tCIDADE\tNOME\tENDEREÇO\tTELEFONE\tE-MAIL\tHORÁRIO"></textarea></label>
          <label>ou arquivo<input type="file" id="sine-arquivo" accept=".csv,.txt,.xlsx,.xls"></label>`,
        botoes: [{ texto: 'Cancelar' }, { texto: 'Importar', classe: 'btn-primario', acao: async (md) => {
          const arq = md.corpo.querySelector('#sine-arquivo').files[0];
          const linhas = arq ? await UI.lerArquivo(arq) : UI.csvParse(md.corpo.querySelector('#sine-texto').value);
          const r = Store.importarAgenciasSine(linhas, App.usuario);
          UI.toast(`${r.total} agência(s) importada(s) em ${r.ufs.join(', ')}.${r.semCidade.length ? ` ${r.semCidade.length} cidade(s) não reconhecida(s): ${r.semCidade.slice(0, 5).join(', ')}` : ''}`, r.semCidade.length ? 'aviso' : 'sucesso', 6000);
          renderSine();
        } }]
      });
    });

    const bIbge = el.querySelector('#btn-ibge');
    if (bIbge) bIbge.addEventListener('click', async () => {
      bIbge.disabled = true;
      const st = el.querySelector('#ibge-status');
      try {
        const n = await Geo.importarIBGE(t => st.innerHTML = `<span class="badge badge-amarelo">${UI.esc(t)}</span>`);
        Store.auditar('cidades.ibge', `Lista IBGE carregada (${n} municípios)`, App.usuario);
        UI.toast(`${UI.fmtNum(n)} municípios carregados.`, 'sucesso');
        App.rotear(true);
      } catch (e) { UI.toast(e.message, 'erro', 7000); bIbge.disabled = false; st.innerHTML = '<span class="badge badge-vermelho">falha ao baixar</span>'; }
    });
    const bManual = el.querySelector('#btn-manual');
    if (bManual) bManual.addEventListener('click', () => abrirForm(null));

    el.querySelector('#cid-busca').addEventListener('input', UI.debounce(e => { busca = e.target.value; renderLista(); }, 150));
    el.querySelector('#cid-uf').addEventListener('change', e => { uf = e.target.value; renderLista(); });
    el.querySelector('#cid-uso').addEventListener('change', e => { soEmUso = e.target.checked; renderLista(); });

    const ORIGENS = { seed: ['base inicial', 'badge-cinza'], ibge: ['IBGE', 'badge-verde'], geocode: ['internet', 'badge-azul'], manual: ['manual', 'badge-amarelo'] };
    function renderLista() {
      let lista = Store.cidades();
      if (uf) lista = lista.filter(c => c.uf === uf);
      if (busca.trim()) { const n = Store.normalizar(busca); lista = lista.filter(c => Store.normalizar(c.nome).includes(n)); }
      const uso = new Map();
      {
        for (const r of Store.registros()) {
          uso.set(r.cidadeId, (uso.get(r.cidadeId) || 0) + 1);
          if (!Store.ehMovel(r.atuacao)) uso.set(r.atuacao, (uso.get(r.atuacao) || 0) + 1000);
        }
      }
      if (soEmUso) lista = lista.filter(c => uso.has(c.id));
      const total = lista.length;
      lista = lista.slice(0, 200);
      el.querySelector('#cid-total').textContent = `${UI.fmtNum(total)} cidade(s)${total > 200 ? ' — mostrando as 200 primeiras' : ''}`;
      el.querySelector('#cid-lista').innerHTML = UI.tabela({
        vazio: 'Nenhuma cidade encontrada.',
        colunas: [
          { titulo: 'Cidade', render: c => UI.esc(c.nome) },
          { titulo: 'UF', render: c => c.uf },
          { titulo: 'Latitude', classe: 'direita', render: c => c.lat.toFixed(4) },
          { titulo: 'Longitude', classe: 'direita', render: c => c.lng.toFixed(4) },
          { titulo: 'Origem', render: c => `<span class="badge ${ORIGENS[c.origem][1]}">${ORIGENS[c.origem][0]}</span>` },
          { titulo: 'Uso', classe: 'direita', render: c => { const u = uso.get(c.id) || 0; const atu = Math.floor(u / 1000), regs = u % 1000; return [regs ? `${regs} como origem` : '', atu ? `${atu} como atuação` : ''].filter(Boolean).join(', ') || '<span class="muted">—</span>'; } },
          { titulo: '', classe: 'acoes-col', render: c => `<button class="btn-icone ficha" data-id="${c.id}" title="Ficha da cidade no mapa (IBGE, SINE, anotações)">&#128269;</button>` + (podeEditar ? `<button class="btn-icone ed" data-id="${c.id}" title="Ajustar coordenadas">&#9998;</button>${(c.origem === 'manual' || c.origem === 'geocode') && !uso.has(c.id) ? `<button class="btn-icone perigo ex" data-id="${c.id}" title="Excluir">&#128465;</button>` : ''}` : '') }
        ],
        linhas: lista
      });
      el.querySelectorAll('.ficha').forEach(b => b.addEventListener('click', () => { sessionStorage.setItem('maparh:mapa-foco', JSON.stringify({ cidadeId: b.dataset.id })); App.ir('mapa'); }));
      el.querySelectorAll('.ed').forEach(b => b.addEventListener('click', () => abrirForm(Store.cidade(b.dataset.id))));
      el.querySelectorAll('.ex').forEach(b => b.addEventListener('click', async () => {
        const c = Store.cidade(b.dataset.id);
        if (await UI.confirmar(`Excluir a cidade ${c.nome}/${c.uf}?`, { textoOk: 'Excluir', perigo: true })) {
          try { Store.excluirCidade(c.id); UI.toast('Cidade excluída.', 'sucesso'); renderLista(); } catch (e) { UI.toast(e.message, 'erro'); }
        }
      }));
    }

    function abrirForm(c) {
      UI.modal({
        titulo: c ? `Ajustar coordenadas — ${c.nome}/${c.uf}` : 'Cadastrar cidade manualmente',
        largura: '480px',
        corpo: `
          <div class="form-linha">
            <label>Cidade<input id="c-nome" value="${UI.esc(c ? c.nome : '')}" ${c ? 'disabled' : ''}></label>
            <label>UF<select id="c-uf" ${c ? 'disabled' : ''}>${UI.opcoesUF(c ? c.uf : '')}</select></label>
          </div>
          <div class="form-linha">
            <label>Latitude<input id="c-lat" type="number" step="0.0001" value="${c ? c.lat : ''}" placeholder="-28.5122"></label>
            <label>Longitude<input id="c-lng" type="number" step="0.0001" value="${c ? c.lng : ''}" placeholder="-50.9339"></label>
          </div>
          <p class="ajuda">Dica: no Google Maps, clique com o botão direito sobre a cidade para copiar as coordenadas. <a href="#" id="c-buscar">Buscar na internet</a></p>`,
        botoes: [
          { texto: 'Cancelar' },
          { texto: 'Salvar', classe: 'btn-primario', acao: (m) => {
            const q = s => m.corpo.querySelector(s);
            Store.salvarCidade({ nome: c ? c.nome : q('#c-nome').value, uf: c ? c.uf : q('#c-uf').value, lat: q('#c-lat').value, lng: q('#c-lng').value, origem: 'manual' });
            Store.auditar('cidade.salvar', `${c ? c.nome + '/' + c.uf : q('#c-nome').value + '/' + q('#c-uf').value} (manual)`, App.usuario);
            UI.toast('Cidade salva.', 'sucesso'); renderLista();
          } }
        ]
      });
      document.getElementById('c-buscar').addEventListener('click', async e => {
        e.preventDefault();
        const nome = c ? c.nome : document.getElementById('c-nome').value.trim(), ufv = c ? c.uf : document.getElementById('c-uf').value;
        if (!nome || !ufv) { UI.toast('Informe cidade e UF.', 'aviso'); return; }
        UI.toast('Buscando…', 'info', 1500);
        const r = await Geo.geocodificar(nome, ufv);
        if (!r) { UI.toast('Não encontrada na internet.', 'erro'); return; }
        document.getElementById('c-lat').value = r.lat.toFixed(4); document.getElementById('c-lng').value = r.lng.toFixed(4);
        UI.toast(`Encontrada: ${r.descricao}`, 'sucesso', 5000);
      });
    }

    renderLista();
  }
};
