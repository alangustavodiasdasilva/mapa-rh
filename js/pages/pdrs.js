// Mapas PDRs: importação de arquivos KML (Google My Maps) com as unidades/silos, listados aqui e mostrados no Mapa.
Paginas.pdrs = {
  titulo: 'Mapas PDRs',
  render(el) {
    const podeEditar = App.podeEditar();
    let busca = '', filtroMapa = '';

    el.innerHTML = `
      <div class="linha entre mb" style="flex-wrap:wrap;gap:8px">
        <div>
          <h2 style="margin-bottom:4px">Mapas PDRs e silos de grãos</h2>
          <p class="muted small" style="margin:0">Importe os mapas do Google My Maps (arquivo KML). As unidades aparecem no <a href="#/mapa">Mapa</a> com a cor da microrregião da cidade onde ficam.</p>
        </div>
        ${podeEditar ? `
        <div class="linha" style="gap:8px">
          <label class="btn btn-primario" style="margin:0;cursor:pointer">Carregar arquivo KML<input type="file" id="pdr-file-input" accept=".kml,.kmz,.xml,.txt" hidden></label>
          <button class="btn" id="btn-colar-kml">Colar KML ou link do Google</button>
        </div>` : ''}
      </div>
      <div id="pdr-lista-mapas" class="mb"></div>
      <div class="card sem-padding">
        <div class="linha entre" style="padding:12px 16px;border-bottom:1px solid var(--borda);flex-wrap:wrap;gap:8px">
          <div class="linha" style="gap:8px;flex:1;min-width:280px">
            <input id="pdr-busca" class="busca" placeholder="Buscar unidade, cidade, microrregião…" autocomplete="off">
            <select id="pdr-filtro-mapa" style="width:auto;min-width:170px"><option value="">Todos os mapas</option></select>
          </div>
          <span class="muted small" id="pdr-total-contagem"></span>
        </div>
        <div id="pdr-tabela"></div>
      </div>`;

    // ---------- importação ----------
    const fileInput = el.querySelector('#pdr-file-input');
    if (fileInput) fileInput.addEventListener('change', async e => {
      const arq = e.target.files[0];
      if (!arq) return;
      try { await importarArquivo(arq); }
      catch (err) { UI.toast(err.message, 'erro', 7000); }
      finally { fileInput.value = ''; }
    });

    async function importarArquivo(arq) {
      const buf = new Uint8Array(await arq.slice(0, 2).arrayBuffer());
      if (buf[0] === 0x50 && buf[1] === 0x4b) throw new Error('Este arquivo é KMZ (compactado). No Google My Maps, exporte marcando "Exportar como KML" e escolha o arquivo .kml.');
      await processarTextoKml(await arq.text(), arq.name.replace(/\.[^/.]+$/, ''));
    }

    // Transforma um link do Google My Maps (viewer/edit/embed) no link de download do KML
    function linkKmlDoGoogle(url) {
      const m = String(url || '').match(/[?&]mid=([A-Za-z0-9_-]+)/);
      if (m && /google\.[a-z.]+\/maps\/d\//i.test(url)) return `https://www.google.com/maps/d/kml?forcekml=1&mid=${m[1]}`;
      return null;
    }

    const btnColar = el.querySelector('#btn-colar-kml');
    if (btnColar) btnColar.addEventListener('click', () => {
      const corpo = document.createElement('div');
      corpo.innerHTML = `
        <p class="muted small">Cole o conteúdo do arquivo .kml (o texto que começa com <code>&lt;kml</code>) ou o link do mapa no Google My Maps.</p>
        <textarea id="kml-colado" class="colar" placeholder="<kml xmlns=…   ou   https://www.google.com/maps/d/viewer?mid=…" style="min-height:150px;white-space:pre-wrap"></textarea>
        <label style="margin-top:10px">Nome do mapa (opcional)<input id="kml-nome-manual" placeholder="Ex.: Mapa Canguçu"></label>`;
      UI.modal({
        titulo: 'Colar KML ou link do Google',
        corpo, largura: '600px', fecharAoClicarFora: false,
        botoes: [
          { texto: 'Cancelar' },
          { texto: 'Adicionar mapa', classe: 'btn-primario', acao: async () => {
            const texto = corpo.querySelector('#kml-colado').value.trim();
            const nomeManual = corpo.querySelector('#kml-nome-manual').value.trim();
            if (!texto) throw new Error('Cole o KML ou o link.');
            if (/^https?:\/\//i.test(texto)) {
              const url = linkKmlDoGoogle(texto) || texto;
              const ok = await tentarBaixar(url, nomeManual || 'Mapa do Google');
              if (!ok) guiaLinkDeRede(url, nomeManual || 'Mapa do Google');
              return;
            }
            await processarTextoKml(texto, nomeManual);
          } }
        ]
      });
    });

    // Tenta baixar o KML direto (normalmente o Google bloqueia; aí entra o passo a passo)
    async function tentarBaixar(url, nomePadrao) {
      let res;
      try {
        const r = await fetch(url);
        if (!r.ok) return false;
        res = Store.parseKML(await r.text());
      } catch (e) { return false; }
      if (!res.pontos.length) return false;
      const nome = res.nome && res.nome !== 'Mapa KML' ? res.nome : nomePadrao;
      Store.adicionarMapaPdr({ nome, pontos: res.pontos }, App.usuario);
      UI.toast(`Mapa "${nome}" adicionado com ${res.pontos.length} unidade(s).`, 'sucesso', 4000);
      renderizar();
      return true;
    }

    // Arquivo exportado com "manter atualizado com link de rede": só tem o link, não os pontos.
    function guiaLinkDeRede(url, nomeMapa) {
      const corpo = document.createElement('div');
      corpo.innerHTML = `
        <p>Este arquivo não traz os pontos: ele é só um <b>atalho (link de rede)</b> para o mapa <b>${UI.esc(nomeMapa)}</b> no Google My Maps, e o navegador não consegue buscar o conteúdo direto do Google.</p>
        <p style="margin-top:10px"><b>Resolve em dois cliques:</b></p>
        <ol style="padding-left:20px;line-height:1.8;margin:0 0 10px">
          <li>Clique em <b>Baixar o KML completo</b> — o Google baixa o arquivo com todos os pontos.</li>
          <li>Clique em <b>Escolher o arquivo baixado</b> e selecione esse arquivo.</li>
        </ol>
        <div class="linha" style="gap:8px">
          <a class="btn btn-primario" id="nl-baixar" href="${UI.esc(url)}" target="_blank" rel="noopener">Baixar o KML completo</a>
          <label class="btn" style="margin:0;cursor:pointer">Escolher o arquivo baixado<input type="file" id="nl-arquivo" accept=".kml,.kmz,.xml,.txt" hidden></label>
        </div>
        <p class="muted small" style="margin-top:12px">Para o arquivo já vir completo da próxima vez: no Google My Maps, ⋮ → <i>Exportar para KML/KMZ</i>, desmarque <i>"Manter os dados atualizados com KML de link de rede"</i> e marque <i>"Exportar como KML"</i>.</p>`;
      const modal = UI.modal({ titulo: 'O arquivo só tem o link para o Google', corpo, largura: '560px', fecharAoClicarFora: false, botoes: [{ texto: 'Fechar' }] });
      corpo.querySelector('#nl-arquivo').addEventListener('change', async e => {
        const arq = e.target.files[0];
        if (!arq) return;
        try { await importarArquivo(arq); modal.fechar(); }
        catch (err) { UI.toast(err.message, 'erro', 7000); }
      });
    }

    async function processarTextoKml(texto, nomePadrao) {
      const resultado = Store.parseKML(texto);
      const nome = resultado.nome && resultado.nome !== 'Mapa KML' ? resultado.nome : (nomePadrao || 'Mapa PDR');
      if (!resultado.pontos.length && resultado.urlRemota) {
        const ok = await tentarBaixar(resultado.urlRemota, nome);
        if (!ok) guiaLinkDeRede(resultado.urlRemota, nome);
        return;
      }
      if (!resultado.pontos.length) throw new Error('Nenhum ponto com coordenadas foi encontrado neste arquivo KML.');
      Store.adicionarMapaPdr({ nome, pontos: resultado.pontos }, App.usuario);
      UI.toast(`Mapa "${nome}" adicionado com ${resultado.pontos.length} unidade(s).`, 'sucesso', 4000);
      renderizar();
    }

    // ---------- lista ----------
    function iconeSiloSVG(cor, tam = 18) {
      return `<svg width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" style="vertical-align:middle">
        <path d="M7 21h10V9l-5-5-5 5v12z" fill="${cor}" stroke="${cor}" stroke-width="1.5"/>
        <path d="M7 9h10M7 13h10M7 17h10" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>
        <path d="M12 4v17" stroke="#fff" stroke-width="1.2"/>
      </svg>`;
    }

    function renderizar() {
      const mapas = Store.mapasPdr();
      const contMapas = el.querySelector('#pdr-lista-mapas');
      if (!mapas.length) {
        contMapas.innerHTML = `<div class="card vazio" style="padding:18px">Nenhum mapa PDR carregado.${podeEditar ? ' Use <b>Carregar arquivo KML</b> para importar os mapas exportados do Google My Maps.' : ''}</div>`;
      } else {
        contMapas.innerHTML = `<div class="grade grade-3" style="gap:12px">${mapas.map(m => `
          <div class="card" style="border-top:3px solid #b45309;padding:12px">
            <div class="linha entre" style="gap:6px;margin-bottom:4px">
              <div class="linha" style="gap:6px">${iconeSiloSVG('#b45309', 18)}<b style="font-size:13px;word-break:break-word">${UI.esc(m.nome)}</b></div>
              ${podeEditar ? `<button class="btn-icone perigo btn-excluir-mapa" data-id="${m.id}" title="Excluir este mapa">&#128465;</button>` : ''}
            </div>
            <div class="muted small">${(m.pontos || []).length} unidade(s) · ${UI.fmtData(m.criadoEm)}</div>
          </div>`).join('')}</div>`;
        contMapas.querySelectorAll('.btn-excluir-mapa').forEach(b => b.addEventListener('click', async () => {
          const m = Store.mapaPdr(b.dataset.id);
          if (m && await UI.confirmar(`Excluir o mapa "${m.nome}" e suas ${(m.pontos || []).length} unidades?`, { textoOk: 'Excluir', perigo: true })) {
            Store.excluirMapaPdr(m.id, App.usuario);
            UI.toast(`Mapa "${m.nome}" removido.`, 'sucesso');
            renderizar();
          }
        }));
      }

      const selMapa = el.querySelector('#pdr-filtro-mapa');
      selMapa.innerHTML = `<option value="">Todos os mapas (${mapas.length})</option>` +
        mapas.map(m => `<option value="${m.id}" ${filtroMapa === m.id ? 'selected' : ''}>${UI.esc(m.nome)}</option>`).join('');

      const reg = App.regiaoFiltrada();
      let todos = Store.silosNaRegiao(Store.todosSilosPdr(), App.filtros.distritoId, App.filtros.microId);
      if (filtroMapa) todos = todos.filter(s => s.mapaId === filtroMapa);
      if (busca) {
        const b = Store.normalizar(busca);
        todos = todos.filter(s => Store.normalizar([s.nome, s.cidade, s.micro, s.distrito, s.mapaNome, ...Object.values(s.campos || {})].join(' ')).includes(b));
      }
      el.querySelector('#pdr-total-contagem').innerHTML = `${UI.fmtNum(todos.length)} unidade(s)` +
        (reg.distrito ? ` <span class="badge badge-azul">filtro: ${UI.esc(reg.micro ? reg.micro.nome : reg.distrito.nome)}</span>` : '');

      const LIMITE = 200;
      const linhas = todos.slice(0, LIMITE).map(s => {
        const info = Store.microDoSilo(s); // microrregião cadastrada para a cidade da unidade
        return { s, info, micro: info ? info.micro.nome : (s.micro || ''), distrito: info ? info.distrito.nome : (s.distrito || ''), cor: info ? info.cor : '#94a3b8' };
      });
      const temMicro = linhas.some(l => l.micro), temDistrito = linhas.some(l => l.distrito);
      el.querySelector('#pdr-tabela').innerHTML = UI.tabela({
        vazio: mapas.length ? 'Nenhuma unidade encontrada para os filtros aplicados.' : 'Nenhuma unidade cadastrada.',
        colunas: [
          { titulo: '', render: l => `<span title="${l.info ? 'Cor da microrregião ' + UI.esc(l.micro) : 'Cidade fora das microrregiões cadastradas'}">${iconeSiloSVG(l.cor, 18)}</span>` },
          { titulo: 'Unidade / PDR', render: l => `<b>${UI.esc(l.s.nome)}</b>` },
          { titulo: 'Cidade', render: l => UI.esc(l.s.cidade || '—') },
          ...(temMicro ? [{ titulo: 'Microrregião', render: l => l.micro ? `<span class="ponto-cor" style="background:${UI.esc(l.cor)}"></span>${UI.esc(l.micro)}` : '<span class="muted">—</span>' }] : []),
          ...(temDistrito ? [{ titulo: 'Distrito', render: l => UI.esc(l.distrito || '—') }] : []),
          { titulo: 'Mapa', render: l => `<span class="muted small">${UI.esc(l.s.mapaNome)}</span>` }
        ],
        linhas
      }) + (todos.length > LIMITE ? `<div class="rodape-tabela">Mostrando as primeiras ${LIMITE} de ${UI.fmtNum(todos.length)} unidades. Use a busca para filtrar.</div>` : '');
    }

    el.querySelector('#pdr-busca').addEventListener('input', UI.debounce(e => { busca = e.target.value; renderizar(); }, 150));
    el.querySelector('#pdr-filtro-mapa').addEventListener('change', e => { filtroMapa = e.target.value; renderizar(); });
    renderizar();
  }
};
