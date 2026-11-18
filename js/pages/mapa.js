Paginas.mapa = {
  titulo: 'Mapa',
  render(el) {
    el.innerHTML = `
      <div class="mapa-wrap">
        <div id="mapa"></div>
        <div class="card mapa-controles nao-imprimir" id="controles">
          <div class="painel-cab"><b>Mostrar no mapa</b><button class="btn-icone painel-toggle" title="Recolher / expandir" aria-label="Recolher ou expandir as opções do mapa" aria-expanded="true">&#8722;</button></div>
          <div class="painel-corpo">
          <div class="mpn-busca"><input id="c-busca-cidade" placeholder="Localizar cidade no mapa…" autocomplete="off" aria-label="Localizar cidade no mapa"></div>
          <details class="mpn-grupo" data-g="pessoas" data-conta open>
            <summary><span>Pessoas contratadas</span><small></small></summary>
            <label title="Losango azul com o número de pessoas que trabalham na cidade"><input type="checkbox" id="c-atuacao" checked> <span class="marc-atuacao mini"><span></span></span>Onde trabalham <span class="muted small">(atuação)</span></label>
            <label title="Cidade de origem: de onde a pessoa vem (laranja; cidades próximas se juntam no zoom baixo)"><input type="checkbox" id="c-origens" checked> <span class="ponto-cor" style="background:#ea580c"></span>De onde vêm <span class="muted small">(origem)</span></label>
            <label class="sub" style="display:block">Mostrar as origens como
              <select id="c-estilo" style="margin-top:2px">
                <option value="bolhas">Bolhas com a quantidade</option>
                <option value="pontos">Pontos pequenos</option>
                <option value="pintar">Municípios pintados (mais escuro = mais gente)</option>
              </select></label>
            <label class="sub" style="display:block">Tamanho dos marcadores
              <select id="c-tamanho" style="margin-top:2px">
                <option value="p">Pequeno</option>
                <option value="m">Médio</option>
                <option value="g">Grande</option>
              </select></label>
          </details>
          <details class="mpn-grupo" data-g="vagas" open>
            <summary><span>Vagas</span><small id="c-falta-selo"></small></summary>
            <label title="Cada distrito pintado pela parte do pedido já preenchida nas vagas aprovadas (verde = completo, vermelho = falta muito)"><input type="checkbox" id="c-falta"> <span class="ponto-cor" style="background:linear-gradient(90deg,#dc2626,#16a34a)"></span>Falta contratar <span class="muted small">(por distrito)</span></label>
            <div id="c-falta-opcoes" class="mpn-falta" hidden>
              <select id="c-falta-rh" aria-label="Filtrar as vagas por RH responsável" hidden></select>
              <select id="c-falta-vaga" aria-label="Filtrar por vaga"></select>
              <div id="c-falta-resumo" class="mpn-falta-resumo"></div>
            </div>
          </details>
          <details class="mpn-grupo" data-g="regioes" data-conta open>
            <summary><span>Regiões</span><small></small></summary>
            <label title="Municípios pintados com o tom da microrregião"><input type="checkbox" id="c-distritos" checked> <span class="ponto-cor" style="background:#16a34a"></span>Microrregiões (malha)</label>
            <label class="sub"><input type="checkbox" id="c-rotulos" checked> Nomes das microrregiões</label>
            <label class="sub" title="Etiqueta azul com o total de contratados de cada distrito (aparece com o mapa afastado)"><input type="checkbox" id="c-tot-dist" checked> Totais por distrito (etiquetas azuis)</label>
            <label title="Contorno dos estados dos projetos"><input type="checkbox" id="c-limites" checked> Limite dos estados</label>
            <label title="Contorno de todos os municípios da área que está na tela (aparece ao aproximar o zoom). Clique em qualquer cidade para abrir a ficha."><input type="checkbox" id="c-divisas" checked> Divisas dos municípios</label>
          </details>
          <details class="mpn-grupo" data-g="apoio" data-conta>
            <summary><span>Unidades e SINE</span><small></small></summary>
            <label title="Unidades importadas dos mapas KML, na cor da microrregião"><input type="checkbox" id="c-silos" checked> 🌾 Unidades PDR (<span id="qtd-silos">0</span>)</label>
            <select id="mapa-filtro-silos-mapa" class="sub" style="width:calc(100% - 18px);font-size:11px;padding:2px 4px" hidden>
              <option value="">Todos os mapas</option>
            </select>
            <label id="c-sine-wrap" title="Agências do SINE dos estados em uso (endereço e telefone na ficha da cidade)"><input type="checkbox" id="c-sine"> <span class="sine-mini">S</span>Agências do SINE (<span id="qtd-sine">0</span>)</label>
          </details>
          <details class="mpn-grupo" data-g="linhas">
            <summary><span>Linhas e mapa de calor</span><small></small></summary>
            <div class="mpn-rot">Linhas: de onde vêm → onde trabalham</div>
            <select id="c-modo-linhas">
              <option value="selecionada">Só da cidade que eu clicar</option>
              <option value="todas">Todas as linhas</option>
              <option value="nenhuma">Nenhuma linha</option>
            </select>
            <div class="muted small" id="c-aviso-linhas" style="margin:4px 0 8px"></div>
            <label><input type="checkbox" id="c-calor"> Ligar mapa de calor</label>
            <select id="c-modo-calor" class="sub" style="width:calc(100% - 18px)" hidden>
              <option value="origem">Concentração por cidade de origem</option>
              <option value="atuacao">Concentração por cidade de atuação</option>
            </select>
          </details>
          <details class="mpn-grupo" data-g="fundo">
            <summary><span>Fundo do mapa</span><small id="c-fundo-selo"></small></summary>
            <select id="c-fundo" aria-label="Fundo do mapa">
              <option value="claro">Claro (limpo)</option>
              <option value="ruas">Ruas (OpenStreetMap)</option>
              <option value="satelite">Satélite</option>
            </select>
          </details>
          <div class="mpn-botoes">
            <button class="btn btn-pequeno" id="c-ajustar" title="Enquadrar tudo, inclusive origens distantes">Ajustar zoom</button>
            <button class="btn btn-pequeno" id="c-brasil">Ver Brasil</button>
            <button class="btn btn-pequeno" id="c-tela-cheia" title="Mapa ocupando a tela inteira (Esc para sair)">Tela cheia</button>
          </div>
          </div>
        </div>
        <div class="card mapa-legenda nao-imprimir" id="legenda"></div>
        <div class="mpn-rodape nao-imprimir" aria-live="polite">
          <div class="cidade-hover" id="cidade-hover" hidden></div>
          <div class="malha-status" id="malha-status" hidden></div>
        </div>
        <div class="mapa-kpis nao-imprimir" id="mapa-kpis"></div>
        <div class="card mapa-painel" id="painel" role="dialog" aria-label="Detalhes da seleção" tabindex="-1" hidden></div>
      </div>`;

    if (typeof L === 'undefined') {
      el.querySelector('#mapa').innerHTML = '<div class="mapa-aviso">O mapa precisa de conexão com a internet para carregar. Verifique a conexão e recarregue a página.</div>';
      return;
    }

    const regs = App.regs();
    // os nomes vêm da lista de Candidatos (só quem tem acesso aos candidatos vê); busca por trás para a próxima vez que abrir um quadro
    const temNuvemRh = typeof Nuvem !== 'undefined' && Nuvem.ativa && Nuvem.rh && Nuvem.rh.emCache && Store.pode(App.usuario, 'candidatos');
    if (temNuvemRh) new Set(regs.filter(r => r.preadmissaoId).map(r => r.projetoId)).forEach(id => { if (!Nuvem.rh.emCache(id)) Nuvem.rh.listar(id).catch(() => {}); });
    const indicePessoas = new Map();   // projeto -> { lista, porId }
    const pessoaDoReg = r => {
      if (!temNuvemRh || !r.preadmissaoId) return null;
      const l = Nuvem.rh.emCache(r.projetoId); if (!l) return null;
      let ix = indicePessoas.get(r.projetoId);
      if (!ix || ix.lista !== l) { ix = { lista: l, porId: new Map(l.map(x => [x.id, x])) }; indicePessoas.set(r.projetoId, ix); }
      return ix.porId.get(r.preadmissaoId) || null;
    };
    const pes = n => n === 1 ? '1 pessoa' : `${n} pessoas`;
    const fluxos = Analise.fluxos(regs);
    const projetos = App.projetosVisiveis().filter(p => !App.filtros.projetoId || p.id === App.filtros.projetoId);
    const COR_ATUACAO = '#1d4ed8', COR_ORIGEM = '#ea580c', COR_HUB = '#7c3aed';
    // Microrregião / distrito / cor de cada cidade, montado uma vez (Store.corDaCidade percorre tudo a cada chamada)
    const infoCidade = new Map();
    for (const d of Store.distritos()) for (const m of (d.micros || [])) for (const id of (m.cidadeIds || [])) {
      if (!infoCidade.has(id)) infoCidade.set(id, { cor: (m.cor) || d.cor || '#059669', distrito: d, micro: m, polo: m.poloCidadeId === id });
    }
    const corDe = id => infoCidade.get(id) || null;
    // Cidade da base pelo código IBGE (índice montado na primeira consulta)
    let indiceIbge = null;
    function cidadePorIbge(cod) {
      if (!cod) return null;
      if (!indiceIbge) { indiceIbge = new Map(); for (const c of Store.cidades()) if (c.ibge) indiceIbge.set(String(c.ibge), c); }
      return indiceIbge.get(String(cod)) || null;
    }
    // MÓVEL antigo ("todo o estado"): vale para todos os estados do projeto ("PR/RS/SC"); o ponto fica no meio deles
    function centroUFs(ufs) {
      const cs = String(ufs || '').split('/').map(u => Store.UF_CENTRO[u]).filter(Boolean);
      if (!cs.length) return [-15.5, -52];
      return [cs.reduce((n, c) => n + c[0], 0) / cs.length, cs.reduce((n, c) => n + c[1], 0) / cs.length];
    }
    const nomeUFs = ufs => String(ufs || '').includes('/') ? ufs : (Store.UFS[ufs] || ufs);
    // Contratações que não entram no mapa porque a cidade não foi reconhecida (só dos projetos/tipo do filtro atual)
    const qtdSemCidade = (() => {
      if (typeof Store.registrosDescartados !== 'function') return 0;
      const visiveis = new Set(App.projetosVisiveis().map(p => p.id));
      return Store.registrosDescartados().filter(r => r.projeto && visiveis.has(r.projetoId) &&
        (!App.filtros.projetoId || r.projetoId === App.filtros.projetoId) && (!App.filtros.tipo || r.tipo === App.filtros.tipo)).length;
    })();

    // balão padronizado: título com bolinha colorida, linha de contexto, número e etiquetas LOCAL/MÓVEL
    function balao({ cor, titulo, tipo, sub, total, local, movel, dica }) {
      return `<div class="tt-titulo">${cor ? `<span class="ponto-cor" style="background:${UI.esc(cor)}"></span>` : ''}${titulo}${tipo ? ` <span class="tt-tipo">${tipo}</span>` : ''}</div>` +
        (sub ? `<div class="tt-sub">${sub}</div>` : '') +
        (total != null ? `<div class="tt-num"><b>${UI.fmtNum(total)}</b> contratação(ões)</div>` : '') +
        (local != null ? `<div class="tt-badges"><span class="badge badge-local">${local} LOCAL</span><span class="badge badge-movel">${movel} MÓVEL</span></div>` : '') +
        (dica ? `<div class="tt-dica">${dica}</div>` : '');
    }
    const TT = { className: 'tt-card', direction: 'top', offset: [0, -8] };
    const statusMalha = el.querySelector('#malha-status');
    function definirStatus(txt) { statusMalha.textContent = txt || ''; statusMalha.hidden = !txt; }
    const mapa = L.map('mapa', { preferCanvas: true, zoomControl: true }).setView([-15.5, -52], 4);
    // fundos: o "claro" deixa as cores das microrregiões e as bolhas em evidência
    const FUNDOS = {
      claro: () => L.layerGroup([
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxZoom: 16, attribution: 'Fundo &copy; Esri, HERE, Garmin, OpenStreetMap' }),
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { maxZoom: 16, opacity: 0.85, pane: 'tilePane' })
      ]),
      ruas: () => L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }),
      // satélite + nomes das cidades e divisas por cima (sem isso não dá para saber onde se está clicando)
      satelite: () => L.layerGroup([
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imagens &copy; Esri, Maxar, Earthstar Geographics' }),
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, pane: 'tilePane' })
      ])
    };
    let fundoAtual = null;
    function definirFundo(nome) {
      if (!FUNDOS[nome]) nome = 'claro';
      if (fundoAtual) mapa.removeLayer(fundoAtual);
      fundoAtual = FUNDOS[nome]().addTo(mapa);
      localStorage.setItem('maparh:mapa-fundo', nome);
      el.querySelector('#c-fundo').value = nome;
      if (typeof redesenharDivisas === 'function') redesenharDivisas();
    }
    let redesenharDivisas = null;
    definirFundo(localStorage.getItem('maparh:mapa-fundo') || 'claro');
    el.querySelector('#c-fundo').addEventListener('change', e => definirFundo(e.target.value));
    mapa.zoomControl.setPosition('bottomright');
    L.control.scale({ imperial: false, position: 'bottomright' }).addTo(mapa);
    App.mapaAtual = mapa; // instância do Leaflet, útil para depuração
    let ativo = true;

    const camadas = {
      silos: L.layerGroup().addTo(mapa),
      distritos: L.layerGroup().addTo(mapa),
      limites: L.layerGroup().addTo(mapa), linhas: L.layerGroup().addTo(mapa), setas: L.layerGroup().addTo(mapa), origens: L.layerGroup().addTo(mapa),
      hubs: L.layerGroup().addTo(mapa), atuacao: L.layerGroup().addTo(mapa), calor: null
    };
    const painel = el.querySelector('#painel');
    const pontos = [];

    // ---------- agregações ----------
    const porAtuacao = new Map(); // cidadeId -> { cidade, total, local, movel, fluxos: [], projetos: Set }
    const porHub = new Map();     // uf -> { uf, lat, lng, total, local, movel, fluxos: [], projetos: Set }
    const porOrigem = new Map();  // cidadeId -> { cidade, total, local, movel, fluxos: [] }
    for (const f of fluxos) {
      if (f.atuacaoMovel) {
        let h = porHub.get(f.uf);
        if (!h) { const c = centroUFs(f.uf); h = { uf: f.uf, lat: c[0], lng: c[1], total: 0, local: 0, movel: 0, fluxos: [], projetos: new Set() }; porHub.set(f.uf, h); }
        h.total += f.total; h.local += f.local; h.movel += f.movel; h.fluxos.push(f); h.projetos.add(f.projeto.id);
      } else {
        let a = porAtuacao.get(f.cidadeAtuacao.id);
        if (!a) { a = { cidade: f.cidadeAtuacao, total: 0, local: 0, movel: 0, fluxos: [], projetos: new Set() }; porAtuacao.set(f.cidadeAtuacao.id, a); }
        a.total += f.total; a.local += f.local; a.movel += f.movel; a.fluxos.push(f); a.projetos.add(f.projeto.id);
      }
      let g = porOrigem.get(f.cidadeOrigem.id);
      if (!g) { g = { cidade: f.cidadeOrigem, total: 0, local: 0, movel: 0, fluxos: [] }; porOrigem.set(f.cidadeOrigem.id, g); }
      g.total += f.total; g.local += f.local; g.movel += f.movel; g.fluxos.push(f);
    }
    // Tamanho dos marcadores (ajustável no painel) e estilo das origens (bolhas / pontos / municípios pintados)
    const FATOR_TAMANHO = { p: 0.6, m: 0.8, g: 1.05 };
    let tamanho = localStorage.getItem('maparh:mapa-tamanho') || 'm';
    let estilo = localStorage.getItem('maparh:mapa-estilo') || 'bolhas';
    if (!FATOR_TAMANHO[tamanho]) tamanho = 'm';
    if (!['bolhas', 'pontos', 'pintar'].includes(estilo)) estilo = 'bolhas';
    el.querySelector('#c-tamanho').value = tamanho;
    el.querySelector('#c-estilo').value = estilo;
    const fator = () => FATOR_TAMANHO[tamanho];
    const raioAtuacao = n => Math.round(Math.min(24, 8 + 2.2 * Math.sqrt(n)) * fator());
    const ladoAtuacao = n => Math.round(Math.max(22, raioAtuacao(n || 1) * 1.7) * fator()); // losango "trabalham aqui", com o número dentro
    const raioOrigem = n => Math.round(Math.min(20, 5 + 2.0 * Math.sqrt(n)) * fator());

    // linha curva entre dois pontos (arco leve para não sobrepor)
    function curva(a, b) {
      const pts = [];
      const mx = (a.lat + b.lat) / 2, my = (a.lng + b.lng) / 2;
      const dx = b.lng - a.lng, dy = b.lat - a.lat;
      const cx = mx - dy * 0.18, cy = my + dx * 0.18;
      for (let t = 0; t <= 1.0001; t += 1 / 24) {
        const lat = (1 - t) * (1 - t) * a.lat + 2 * (1 - t) * t * cx + t * t * b.lat;
        const lng = (1 - t) * (1 - t) * a.lng + 2 * (1 - t) * t * cy + t * t * b.lng;
        pts.push([lat, lng]);
      }
      return pts;
    }

    // ---------- linhas ----------
    // Com muitas contratações, desenhar todas as linhas vira um emaranhado: por padrão elas só aparecem
    // ao clicar em uma cidade (modo "selecionada"). O usuário pode trocar para "todas" ou "nenhuma".
    const LIMITE_LINHAS = 120;
    const todasLinhas = [];
    const linhasPorChave = new Map(); // 'A:<cidadeId>' | 'H:<uf>' | 'O:<cidadeId>' -> [polyline]
    const registrarLinha = (chave, linha) => { if (!linhasPorChave.has(chave)) linhasPorChave.set(chave, []); linhasPorChave.get(chave).push(linha); };
    const rendLinhas = L.canvas({ tolerance: 8 }); // margem para clicar na linha fina
    for (const f of fluxos) {
      const destino = f.atuacaoMovel ? porHub.get(f.uf) : f.cidadeAtuacao;
      if (!f.atuacaoMovel && f.cidadeAtuacao.id === f.cidadeOrigem.id) continue;
      const infoCor = f.cidadeAtuacao ? corDe(f.cidadeAtuacao.id) : null;
      const corLinha = f.projeto.cor || COR_ATUACAO;
      const rotuloDistrito = infoCor ? ` (${UI.esc(infoCor.distrito.nome)}${infoCor.micro ? ' · ' + UI.esc(infoCor.micro.nome) : ''})` : '';
      const linha = L.polyline(curva(destino, f.cidadeOrigem), {
        color: corLinha, weight: 1.5 + Math.log2(f.total + 1) * 1.2, opacity: 0.65, dashArray: f.atuacaoMovel ? '6 6' : null,
        renderer: rendLinhas, bubblingMouseEvents: false
      }).bindTooltip(`<b>${UI.esc(f.projeto.nome)}</b><br>Vêm de <b>${UI.esc(f.cidadeOrigem.nome)}/${f.cidadeOrigem.uf}</b> ➜ ${f.base && f.base === f.total ? 'base de contratação em' : 'trabalham em'} <b>${UI.esc(Analise.rotuloAtuacao(f))}</b>${rotuloDistrito}${f.base && f.base < f.total ? ` · ${f.base} com base de contratação aqui` : ''}<br>${f.total} contratação(ões) · ${f.local} local · ${f.movel} móvel${f.dist != null ? ' · ' + UI.fmtKm(f.dist) : ''}<br><span class="muted small">clique na linha para ver o trajeto</span>`, { sticky: true });
      linha._fluxo = f; linha._destino = destino;
      linha.on('click', () => abrirPainelFluxo(f, linha));
      todasLinhas.push(linha);
      registrarLinha(f.atuacaoMovel ? 'H:' + f.uf : 'A:' + f.cidadeAtuacao.id, linha);
      registrarLinha('O:' + f.cidadeOrigem.id, linha);
    }
    const muitasLinhas = todasLinhas.length > LIMITE_LINHAS;
    const opacidadeBase = muitasLinhas ? 0.3 : 0.65;
    const selModoLinhas = el.querySelector('#c-modo-linhas');
    selModoLinhas.value = muitasLinhas ? 'selecionada' : 'todas';
    const avisoLinhas = el.querySelector('#c-aviso-linhas');
    function atualizarAvisoLinhas() {
      const modo = selModoLinhas.value;
      avisoLinhas.textContent = modo === 'selecionada' ? `Clique em uma cidade para ver as linhas dela (${todasLinhas.length} fluxos no total).`
        : modo === 'todas' ? `${todasLinhas.length} linha(s) no mapa${muitasLinhas ? ' — pode ficar carregado; clique em uma cidade para destacar as dela' : ''}.` : '';
    }
    let linhasSelecionadas = null; // linhas da cidade clicada
    function mostrarLinhas(lista, destaque) {
      camadas.linhas.clearLayers();
      (lista || []).forEach(l => { l.setStyle({ opacity: destaque ? 0.95 : opacidadeBase }); camadas.linhas.addLayer(l); });
    }
    // Foco: conjunto de chaves ('id da cidade' ou 'H:UF') que continuam visíveis enquanto um painel está aberto; null = tudo
    let foco = null;
    function aplicarModoLinhas() {
      const modo = selModoLinhas.value;
      if (foco && linhasSelecionadas) mostrarLinhas(linhasSelecionadas, true); // em foco, só as linhas da seleção
      else if (modo === 'todas') {
        mostrarLinhas(todasLinhas, false);
        if (linhasSelecionadas) { camadas.linhas.eachLayer(l => l.setStyle({ opacity: 0.08 })); linhasSelecionadas.forEach(l => { l.setStyle({ opacity: 0.95 }); l.bringToFront(); }); }
      } else if (modo === 'selecionada') mostrarLinhas(linhasSelecionadas, true);
      else mostrarLinhas(null);
      atualizarSetas();
    }
    // Ao clicar em um ponto: realça só as linhas dele (lista = null limpa a seleção)
    function destacarLinhas(lista) { linhasSelecionadas = lista && lista.length ? lista : null; aplicarModoLinhas(); }
    selModoLinhas.addEventListener('change', () => { aplicarModoLinhas(); atualizarAvisoLinhas(); });

    // Sentido das linhas: saem da bolha laranja (de onde vêm) e a seta aponta para o losango azul (onde trabalham).
    // Como a bolha fica encostada no losango quando a cidade é origem E atuação, a ponta da linha acompanha a bolha.
    mapa.createPane('setas').style.zIndex = 420;
    function pontaOrigem(f) {
      const o = f.cidadeOrigem;
      if (estilo !== 'bolhas' || !porAtuacao.has(o.id) || !porOrigem.has(o.id)) return o;
      const d = deslocamentoOrigem(o.id, Math.round(raioOrigem(porOrigem.get(o.id).total)));
      if (!d) return o;
      const ll = mapa.layerPointToLatLng(mapa.latLngToLayerPoint([o.lat, o.lng]).add([d, 0]));
      return { lat: ll.lat, lng: ll.lng };
    }
    function criarSeta(l) {
      const f = l._fluxo, pts = l.getLatLngs();
      const recuo = (f.atuacaoMovel ? raioAtuacao((porHub.get(f.uf) || { total: 1 }).total) : ladoAtuacao((porAtuacao.get(f.cidadeAtuacao.id) || { total: 1 }).total) * 0.71) + 8;
      // anda pela curva a partir do destino (pts[0]) até a distância do recuo, para a seta ficar logo antes do losango
      let acum = 0, prev = mapa.latLngToLayerPoint(pts[0]), pos = null, ang = 0;
      for (let i = 1; i < pts.length; i++) {
        const q = mapa.latLngToLayerPoint(pts[i]), seg = q.distanceTo(prev);
        if (acum + seg >= recuo) {
          pos = prev.add(q.subtract(prev).multiplyBy((recuo - acum) / seg));
          ang = Math.atan2(prev.y - q.y, prev.x - q.x) * 180 / Math.PI; // aponta para o destino
          break;
        }
        acum += seg; prev = q;
      }
      if (!pos) return null; // linha mais curta que o recuo neste zoom
      return L.marker(mapa.layerPointToLatLng(pos), {
        pane: 'setas', interactive: false, keyboard: false, opacity: l.options.opacity,
        icon: L.divIcon({ className: 'seta-linha-wrap', html: `<div class="seta-linha" style="border-left-color:${l.options.color};transform:rotate(${ang.toFixed(1)}deg)"></div>`, iconSize: [12, 12], iconAnchor: [6, 6] })
      });
    }
    function atualizarSetas() {
      camadas.setas.clearLayers();
      camadas.linhas.eachLayer(l => {
        if (!l._fluxo) return;
        if (porAtuacao.has(l._fluxo.cidadeOrigem.id)) l.setLatLngs(curva(l._destino, pontaOrigem(l._fluxo)));
        if (l.options.opacity < 0.2) return; // linhas apagadas (fora da seleção) não ganham seta
        const s = criarSeta(l);
        if (s) camadas.setas.addLayer(s);
      });
    }
    aplicarModoLinhas(); atualizarAvisoLinhas();

    // ---------- marcadores de origem: agrupados conforme o zoom ----------
    // Cidades de origem que ficariam sobrepostas no zoom atual viram uma única bolha com o total;
    // ao aproximar o zoom elas se separam. A bolha fica sobre a cidade com mais contratações do grupo.
    // Ordem de empilhamento: malha (350) < unidades PDR (410) < cidades de atuação (430) < nomes das microrregiões (435) < bolhas de origem (440)
    mapa.createPane('silos').style.zIndex = 410;
    mapa.createPane('atuacao').style.zIndex = 430;
    mapa.createPane('origens').style.zIndex = 440;
    mapa.createPane('destaque').style.zIndex = 445;
    const camadaDestaque = L.layerGroup().addTo(mapa); // divisa do município clicado
    const pontosFoco = [];                          // área de trabalho (atuação, distritos, silos) para o enquadramento inicial
    const pontosDistritos = [];                     // só as cidades dos distritos: se existirem, são o enquadramento inicial
    const DIST_AGRUPAR = 34;                        // px
    for (const g of porOrigem.values()) pontos.push([g.cidade.lat, g.cidade.lng]);
    // Agrupa itens que ficariam a menos de `dist` px um do outro no zoom atual. O primeiro item de cada grupo dá a posição.
    function agruparPorProximidade(itens, latLng, dist) {
      const z = mapa.getZoom();
      const grupos = [];
      for (const it of itens) {
        const p = mapa.project(latLng(it), z);
        let alvo = null;
        for (const gr of grupos) { if (gr.ponto.distanceTo(p) <= dist) { alvo = gr; break; } }
        if (alvo) alvo.itens.push(it); else grupos.push({ ponto: p, latLng: latLng(it), itens: [it] });
      }
      return grupos;
    }
    function agruparOrigens() {
      const ordenadas = [...porOrigem.values()].filter(g => !foco || foco.has(g.cidade.id)).sort((a, b) => b.total - a.total);
      return agruparPorProximidade(ordenadas, g => [g.cidade.lat, g.cidade.lng], DIST_AGRUPAR).map(gr => ({
        ...gr, cidade: gr.itens[0].cidade,
        total: gr.itens.reduce((n, g) => n + g.total, 0), local: gr.itens.reduce((n, g) => n + g.local, 0), movel: gr.itens.reduce((n, g) => n + g.movel, 0)
      }));
    }
    function selecionarOrigem(g) { abrirPainelOrigem(g); destacarLinhas(linhasPorChave.get('O:' + g.cidade.id) || []); }
    function selecionarAtuacao(a) { abrirPainelAtuacao(a); destacarLinhas(linhasPorChave.get('A:' + a.cidade.id) || []); }
    const COR_CLASSES = ['#fed7aa', '#fdba74', '#fb923c', '#ea580c', '#9a3412'];
    // Faixas dos "municípios pintados": calculadas uma vez com TODAS as origens (não mudam ao selecionar uma cidade).
    // Cortes iguais ao maior valor são descartados para não sobrar faixa vazia na legenda.
    const totaisOrigem = [...porOrigem.values()].map(g => g.total).sort((a, b) => a - b);
    const minOrigem = totaisOrigem.length ? totaisOrigem[0] : 1, maxOrigem = totaisOrigem.length ? totaisOrigem[totaisOrigem.length - 1] : 1;
    const cortesCoropleto = (() => {
      if (!totaisOrigem.length) return [];
      const q = f => totaisOrigem[Math.min(totaisOrigem.length - 1, Math.floor(f * totaisOrigem.length))];
      return [...new Set([q(0.2), q(0.4), q(0.6), q(0.8)])].filter(c => c >= minOrigem && c < maxOrigem);
    })();
    function classeDe(n) { let k = 0; for (const c of cortesCoropleto) if (n > c) k++; return Math.min(k, COR_CLASSES.length - 1); }
    mapa.createPane('coropleto').style.zIndex = 360;
    let versaoCoropleto = 0;
    // Municípios de origem pintados pela quantidade de contratações (classes por quantis)
    async function desenharCoropleto() {
      const versao = ++versaoCoropleto;
      const origens = [...porOrigem.values()].filter(g => !foco || foco.has(g.cidade.id));
      if (!origens.length) return;
      const porUF = new Map();
      origens.forEach(g => { if (!porUF.has(g.cidade.uf)) porUF.set(g.cidade.uf, []); porUF.get(g.cidade.uf).push(g); });
      for (const [uf, lista] of porUF) {
        let dadosUF = null;
        definirStatus(`Carregando limites dos municípios (${uf})…`);
        try { dadosUF = await Malha.carregarUF(uf); } catch (e) { /* sem malha: cai para pontos */ }
        if (!ativo || versao !== versaoCoropleto) return;
        for (const g of lista) {
          const cor = COR_CLASSES[classeDe(g.total)];
          const tip = balao({ cor, titulo: `${UI.esc(g.cidade.nome)}/${g.cidade.uf}`, tipo: 'de onde vêm', total: g.total, local: g.local, movel: g.movel, dica: 'clique para ver onde trabalham' });
          const f = dadosUF ? Malha.featureDaCidade(g.cidade, dadosUF) : null;
          const camada = f
            ? L.geoJSON(f, { pane: 'coropleto', style: { color: '#fff', weight: 0.8, opacity: 0.9, fillColor: cor, fillOpacity: 0.8 } })
            : L.circleMarker([g.cidade.lat, g.cidade.lng], { pane: 'origens', radius: 5 * fator() + 2, color: '#fff', weight: 1.5, fillColor: cor, fillOpacity: 0.95 });
          camada.bindTooltip(tip, { ...TT, sticky: !!f });
          camada.on('click', e => { L.DomEvent.stopPropagation(e); selecionarOrigem(g); });
          camadas.origens.addLayer(camada);
        }
      }
      definirStatus('');
    }
    // Cidade que é origem E atuação: as bolas ficam ao lado do losango (direita = saíram daqui, esquerda = moram e
    // trabalham aqui), sem cobrir o losango nem o nome da microrregião. Devolve a distância horizontal do centro.
    function deslocamentoOrigem(cidadeId, r) {
      const a = porAtuacao.get(cidadeId);
      if (!a) return 0;
      const meiaDiagonal = (ladoAtuacao(a.total) + 4) * 0.71; // +4: borda branca do losango
      return Math.round(meiaDiagonal + r + 3);
    }
    // Quem vem de uma cidade se divide em quem "fica" (mora e trabalha na própria cidade) e quem "saiu" (trabalha em outra cidade)
    function saidasDe(g) {
      const fica = g.fluxos.filter(f => !f.atuacaoMovel && f.cidadeAtuacao.id === g.cidade.id);
      const proprias = fica.reduce((n, f) => n + f.total, 0);
      // destinos = cidades distintas (um fluxo é projeto + atuação + origem: dois projetos na mesma cidade contam uma vez)
      const destinos = new Set(g.fluxos.filter(f => !fica.includes(f)).map(f => f.atuacaoMovel ? 'H:' + f.uf : f.cidadeAtuacao.id)).size;
      return { proprias, foram: g.total - proprias, ficaLocal: fica.reduce((n, f) => n + f.local, 0), ficaMovel: fica.reduce((n, f) => n + f.movel, 0), destinos };
    }
    function resumoDestinos(g) {
      const s = saidasDe(g);
      return `${s.proprias ? `${s.proprias} ${s.proprias === 1 ? 'trabalha' : 'trabalham'} aqui mesmo` : ''}${s.proprias && s.foram ? ' · ' : ''}${s.foram ? `${s.foram} ${s.foram === 1 ? 'trabalha' : 'trabalham'} em outra cidade (${s.destinos} destino${s.destinos === 1 ? '' : 's'})` : ''}`;
    }
    // Bolha laranja de uma cidade: quantas pessoas SÃO daqui (as linhas partem dela). Fica à direita do losango quando a cidade também é de trabalho
    function desenharBolhasCidade(g) {
      const s = saidasDe(g);
      const r = Math.round(raioOrigem(g.total));
      const d = deslocamentoOrigem(g.cidade.id, r);
      const icone = L.divIcon({ className: 'bolha-origem-wrap', html: `<div class="bolha-origem${d ? ' encostada' : ''}" style="width:${2 * r}px;height:${2 * r}px;line-height:${2 * r - 3}px;font-size:${r >= 12 ? 11 : 10}px">${g.total}</div>`, iconSize: [2 * r, 2 * r], iconAnchor: [r - d, r] });
      const tip = balao({ cor: COR_ORIGEM, titulo: `${UI.esc(g.cidade.nome)}/${g.cidade.uf}`, tipo: 'são daqui', sub: resumoDestinos(g), total: g.total, local: g.local, movel: g.movel, dica: 'clique para ver quem são e onde trabalham' });
      const m = L.marker([g.cidade.lat, g.cidade.lng], { icon: icone, pane: 'origens', keyboard: false }).bindTooltip(tip, { ...TT, offset: [0, -r - 2] });
      m.on('click', () => selecionarOrigem(g));
      camadas.origens.addLayer(m);
    }
    function desenharOrigens() {
      camadas.origens.clearLayers();
      if (estilo === 'pintar') { desenharCoropleto(); return; }
      if (estilo === 'pontos') {
        for (const g of porOrigem.values()) {
          if (foco && !foco.has(g.cidade.id)) continue;
          const rp = Math.round(4 * fator() + 2), dp = deslocamentoOrigem(g.cidade.id, rp);
          const m = dp
            ? L.marker([g.cidade.lat, g.cidade.lng], { pane: 'origens', keyboard: false, icon: L.divIcon({ className: 'bolha-origem-wrap', html: `<div class="bolha-origem encostada" style="width:${2 * rp}px;height:${2 * rp}px"></div>`, iconSize: [2 * rp, 2 * rp], iconAnchor: [rp - dp, rp] }) })
            : L.circleMarker([g.cidade.lat, g.cidade.lng], { pane: 'origens', radius: rp, color: '#fff', weight: 1.5, fillColor: COR_ORIGEM, fillOpacity: 0.95 });
          m.bindTooltip(balao({ cor: COR_ORIGEM, titulo: `${UI.esc(g.cidade.nome)}/${g.cidade.uf}`, tipo: 'de onde vêm', sub: resumoDestinos(g), total: g.total, local: g.local, movel: g.movel, dica: 'clique para ver para onde foram' }), TT);
          m.on('click', e => { if (e && e.originalEvent) L.DomEvent.stopPropagation(e); selecionarOrigem(g); });
          camadas.origens.addLayer(m);
        }
        return;
      }
      for (const gr of agruparOrigens()) {
        const varias = gr.itens.length > 1;
        if (!varias) { desenharBolhasCidade(gr.itens[0]); continue; }
        const r = Math.round(raioOrigem(gr.total));
        const desloc = deslocamentoOrigem(gr.cidade.id, r); // evita cobrir o losango da cidade de atuação
        const icone = L.divIcon({ className: 'bolha-origem-wrap', html: `<div class="bolha-origem${varias ? ' varias' : ''}${desloc ? ' encostada' : ''}" style="width:${2 * r}px;height:${2 * r}px;line-height:${2 * r - 3}px;font-size:${r >= 12 ? 11 : 10}px">${gr.total}</div>`, iconSize: [2 * r, 2 * r], iconAnchor: [r - desloc, r] });
        const tip = varias
          ? balao({ cor: COR_ORIGEM, titulo: `${gr.itens.length} cidades de origem`, tipo: 'de onde vêm · agrupadas', sub: gr.itens.slice(0, 5).map(g => `${UI.esc(g.cidade.nome)}/${g.cidade.uf} (${g.total})`).join(' · ') + (gr.itens.length > 5 ? ' …' : ''), total: gr.total, local: gr.local, movel: gr.movel, dica: 'aproxime o zoom para separar · clique para ver a lista' })
          : balao({ cor: COR_ORIGEM, titulo: `${UI.esc(gr.cidade.nome)}/${gr.cidade.uf}`, tipo: 'de onde vêm', sub: resumoDestinos(gr.itens[0]), total: gr.total, local: gr.local, movel: gr.movel, dica: 'clique para ver para onde foram' });
        const m = L.marker([gr.cidade.lat, gr.cidade.lng], { icon: icone, pane: 'origens', keyboard: false }).bindTooltip(tip, { ...TT, offset: [0, -r - 2] });
        m.on('click', () => varias ? abrirPainelGrupoOrigem(gr) : selecionarOrigem(gr.itens[0]));
        camadas.origens.addLayer(m);
      }
    }
    desenharOrigens();

    const marcadoresHub = new Map(), marcadoresAtuacao = new Map();
    for (const h of porHub.values()) {
      pontos.push([h.lat, h.lng]); pontosFoco.push([h.lat, h.lng]);
      const m = L.circleMarker([h.lat, h.lng], { pane: 'atuacao', radius: raioAtuacao(h.total), color: COR_HUB, weight: 2, dashArray: '4 3', fillColor: COR_HUB, fillOpacity: 0.35 })
        .bindTooltip(balao({ cor: COR_HUB, titulo: `Sem cidade definida — ${UI.esc(nomeUFs(h.uf))}`, tipo: 'todo o estado', sub: `cadastro antigo (MÓVEL): podem atuar em qualquer lugar de ${UI.esc(h.uf)}`, total: h.total, local: h.local, movel: h.movel }), TT);
      m.on('click', e => { if (e && e.originalEvent) L.DomEvent.stopPropagation(e); abrirPainelHub(h); destacarLinhas(linhasPorChave.get('H:' + h.uf) || []); });
      m._total = h.total;
      marcadoresHub.set('H:' + h.uf, m);
      camadas.hubs.addLayer(m);
    }
    for (const a of porAtuacao.values()) {
      pontos.push([a.cidade.lat, a.cidade.lng]); pontosFoco.push([a.cidade.lat, a.cidade.lng]);
      const infoCor = corDe(a.cidade.id);
      const m = L.marker([a.cidade.lat, a.cidade.lng], { icon: iconeAtuacao(a.total), pane: 'atuacao', keyboard: false })
        .bindTooltip(() => {
          const proprias = a.fluxos.filter(f => f.cidadeOrigem.id === a.cidade.id).reduce((n, f) => n + f.total, 0);
          const outras = new Set(a.fluxos.map(f => f.cidadeOrigem.id).filter(id => id !== a.cidade.id)).size; // cidades distintas
          const base = a.fluxos.reduce((n, f) => n + (f.base || 0), 0);
          return balao({ cor: COR_ATUACAO, titulo: `${UI.esc(a.cidade.nome)}/${a.cidade.uf}`, tipo: base === a.total ? 'base de contratação' : 'trabalham aqui',
            sub: `${infoCor ? `${UI.esc(infoCor.micro.nome)} · ${UI.esc(infoCor.distrito.nome)} · ` : ''}${a.total - proprias ? `${a.total - proprias} vieram de ${outras} outra(s) cidade(s)` : ''}${a.total - proprias && proprias ? ' · ' : ''}${proprias ? `${proprias} são daqui mesmo` : ''}${base && base < a.total ? ` · ${base} com base de contratação aqui` : ''}`,
            total: a.total, local: a.local, movel: a.movel, dica: 'clique para ver quem são e de onde vêm' });
        }, { ...TT, offset: [0, -ladoAtuacao(a.total) * 0.71 - 4] });
      m.on('click', () => { abrirPainelAtuacao(a); destacarLinhas(linhasPorChave.get('A:' + a.cidade.id) || []); });
      m._total = a.total;
      marcadoresAtuacao.set(a.cidade.id, m);
      camadas.atuacao.addLayer(m);
    }
    function iconeAtuacao(total) {
      const lado = ladoAtuacao(total);
      return L.divIcon({ className: 'silo-marcador-div', html: `<div class="marc-atuacao" style="width:${lado}px;height:${lado}px;font-size:${lado >= 26 ? 11 : 9}px"><span>${total}</span></div>`, iconSize: [lado, lado], iconAnchor: [lado / 2, lado / 2] });
    }
    // mudança de estilo / tamanho pelo painel
    el.querySelector('#c-estilo').addEventListener('change', e => { estilo = e.target.value; localStorage.setItem('maparh:mapa-estilo', estilo); desenharOrigens(); atualizarLegendaOrigens(); atualizarSetas(); });
    el.querySelector('#c-tamanho').addEventListener('change', e => {
      tamanho = e.target.value; localStorage.setItem('maparh:mapa-tamanho', tamanho);
      for (const m of marcadoresAtuacao.values()) m.setIcon(iconeAtuacao(m._total));
      for (const m of marcadoresHub.values()) m.setRadius(raioAtuacao(m._total));
      desenharOrigens();
    });
    // Aplica o foco: esconde bolhas, cidades de atuação, hubs e unidades que não se ligam à seleção
    const polysMalha = []; // { poly, cidadeId, normal } — para apagar as outras cidades quando uma está selecionada
    const estiloMalha = (cidadeId, normal) => (!foco || foco.has(cidadeId)) ? normal : { ...normal, fillOpacity: 0.08, opacity: 0.25 };
    function aplicarFoco(chaves) {
      if (!chaves && !foco) return; // já está mostrando tudo: não redesenha
      foco = chaves ? new Set(chaves) : null;
      for (const pm of polysMalha) pm.poly.setStyle(estiloMalha(pm.cidadeId, pm.normal));
      if (typeof ajustarRotulos === 'function') ajustarRotulos();
      if (foco) { if (camadas.calor) { mapa.removeLayer(camadas.calor); camadas.calor = null; } }
      else if (typeof montarCalor === 'function') montarCalor();
      desenharOrigens();
      // com uma cidade selecionada o mapa mostra só o que é dela: as cidades ligadas a ela, as unidades e a agência do SINE dela
      camadas.atuacao.clearLayers();
      for (const [id, m] of marcadoresAtuacao) if (!foco || foco.has(id)) camadas.atuacao.addLayer(m);
      camadas.hubs.clearLayers();
      for (const [k, m] of marcadoresHub) if (!foco || foco.has(k)) camadas.hubs.addLayer(m);
      if (typeof montarCamadaSine === 'function') montarCamadaSine();
      renderSilos();
      aplicarModoLinhas();
      el.querySelector('#mapa-kpis').classList.toggle('kpis-foco', !!foco);
    }
    const destinosDe = fluxos => (fluxos || []).map(f => f.atuacaoMovel ? 'H:' + f.uf : f.cidadeAtuacao.id);

    // ---------- distritos e microrregiões (malha dos municípios do IBGE) ----------
    // Os polígonos ficam em um "pane" próprio, abaixo dos marcadores, para nunca cobrirem as bolhas de atuação/origem.
    mapa.createPane('malha').style.zIndex = 350;
    mapa.createPane('rotulos').style.zIndex = 435; // acima das unidades e dos losangos (o nome fica abaixo do losango e legível), abaixo das bolhas
    // com filtro de distrito/microrregião no topo, a malha e a legenda mostram só a região filtrada
    const regiaoFiltro = App.regiaoFiltrada();
    const distritos = App.distritosFiltrados().filter(d => !regiaoFiltro.distrito || d.id === regiaoFiltro.distrito.id)
      .map(d => regiaoFiltro.micro ? { ...d, micros: (d.micros || []).filter(m => m.id === regiaoFiltro.micro.id) } : d);
    const camadaRotulos = L.layerGroup().addTo(mapa);
    // Rótulos de distrito/micro que se sobrepõem (zoom afastado): o distrito sempre fica; das micros, some a com menos contratações
    const rotulosMapa = []; // { marcador, prioridade }
    function ajustarRotulos() {
      // zoom afastado: etiqueta do distrito só com o losango e o total, rótulos das micros menores
      mapa.getContainer().classList.toggle('mapa-longe', mapa.getZoom() < 9);
      // com uma cidade selecionada ficam só os rótulos da microrregião dela (os totais de distrito somem)
      const mostraTot = !el.querySelector('#c-tot-dist') || el.querySelector('#c-tot-dist').checked;
      const noFoco = r => (mostraTot || !r.distrito) && (!foco || (!r.distrito && (r.cidadeIds || []).some(id => foco.has(id))));
      // 1) escreve: mostra os candidatos e esconde os fora do foco
      for (const r of rotulosMapa.filter(r => r.marcador._icon && !noFoco(r))) r.marcador._icon.style.display = 'none';
      const itens = rotulosMapa.filter(r => r.marcador._icon && noFoco(r)).sort((a, b) => b.prioridade - a.prioridade);
      for (const r of itens) r.marcador._icon.style.display = '';
      // 2) lê todas as caixas de uma vez (um único cálculo de layout)
      const caixas = itens.map(r => { const span = r.marcador._icon.firstElementChild; if (!span) return null; const b = span.getBoundingClientRect(); return [b.left - 3, b.top - 2, b.right + 3, b.bottom + 2]; });
      // 3) decide e escreve
      const aceitos = [], esconder = [];
      itens.forEach((r, i) => {
        const caixa = caixas[i];
        if (!caixa) return;
        if (aceitos.some(c => caixa[0] < c[2] && caixa[2] > c[0] && caixa[1] < c[3] && caixa[3] > c[1])) esconder.push(r);
        else aceitos.push(caixa);
      });
      for (const r of esconder) r.marcador._icon.style.display = 'none';
    }
    const cidadesDaMicro = m => (m.cidadeIds || []).map(id => Store.cidade(id)).filter(Boolean);
    function limitesDe(cidades) {
      const pts = cidades.map(c => [c.lat, c.lng]);
      return pts.length ? L.latLngBounds(pts).pad(0.25) : null;
    }
    function focar(cidades) { const b = limitesDe(cidades); if (b) mapa.fitBounds(b, { maxZoom: 11 }); }

    // Totais de contratações por microrregião e por distrito: o distrito da pessoa é o da cidade onde ela trabalha (atuação)
    const totaisMicro = new Map(), totaisDistrito = new Map();
    for (const r of regs) {
      if (!r.cidadeAtuacao) continue;
      const info = corDe(r.cidadeAtuacao.id);
      if (!info || !info.micro) continue;
      totaisMicro.set(info.micro.id, (totaisMicro.get(info.micro.id) || 0) + 1);
      totaisDistrito.set(info.distrito.id, (totaisDistrito.get(info.distrito.id) || 0) + 1);
    }
    async function desenharDistritos() {
      const porUF = new Map(); // uf -> [{ cidade, distrito, micro, polo }]
      for (const d of distritos) {
        // rótulo do distrito com o total, acima da região
        const cidsDist = Store.cidadesDoDistrito(d);
        if (cidsDist.length) {
          const lats = cidsDist.map(c => c.lat), lngs = cidsDist.map(c => c.lng);
          const topo = [Math.max(...lats) + 0.06, (Math.min(...lngs) + Math.max(...lngs)) / 2];
          const totalD = totaisDistrito.get(d.id) || 0;
          const marcD = L.marker(topo, {
            icon: L.divIcon({ className: 'rotulo-micro', html: `<span class="rotulo-distrito"><i></i><em>Distrito ${UI.esc(d.nome)}</em><b>${UI.fmtNum(totalD)}</b></span>`, iconSize: [0, 0], iconAnchor: [0, 0] }),
            interactive: true, pane: 'rotulos', keyboard: false
          }).bindTooltip(balao({ cor: COR_ATUACAO, titulo: `Distrito ${UI.esc(d.nome)}`, tipo: 'total de quem trabalha nas cidades do distrito', total: totalD, dica: 'clique para ver as contratações do distrito inteiro' }), { ...TT, offset: [0, -30] });
          marcD.on('click', e => { L.DomEvent.stopPropagation(e); abrirPainelDistrito(d); });
          camadaRotulos.addLayer(marcD);
          rotulosMapa.push({ marcador: marcD, prioridade: Infinity, cidadeIds: cidsDist.map(c => c.id), distrito: true });
        }
        for (const m of (d.micros || [])) {
          const poloId = m.poloCidadeId || (m.cidadeIds || [])[0];
          const cor = m.cor || d.cor || '#2563eb';
          for (const c of cidadesDaMicro(m)) {
            pontos.push([c.lat, c.lng]); pontosFoco.push([c.lat, c.lng]); pontosDistritos.push([c.lat, c.lng]);
            if (!porUF.has(c.uf)) porUF.set(c.uf, []);
            porUF.get(c.uf).push({ cidade: c, distrito: d, micro: m, cor, polo: c.id === poloId });
          }
          // bolha e rótulo na cidade polo
          const polo = Store.cidade(poloId);
          if (polo) {
            camadas.distritos.addLayer(L.circleMarker([polo.lat, polo.lng], { radius: 5, color: '#fff', weight: 1.5, fillColor: '#0f172a', fillOpacity: 0.85 })
              .bindTooltip(balao({ cor, titulo: `👑 ${UI.esc(m.nome)}`, tipo: 'cidade polo', sub: `${UI.esc(polo.nome)}/${polo.uf} · distrito ${UI.esc(d.nome)} · ${(m.cidadeIds || []).length} município(s)` }), TT));
            const totalM = totaisMicro.get(m.id) || 0;
            const aPolo = porAtuacao.get(polo.id); // com losango na cidade polo, o nome desce para não ficar por baixo dele
            const dy = (aPolo ? Math.round((ladoAtuacao(aPolo.total) + 4) * 0.71 + 3) : 9) + 12; // mais abaixo: não fica em cima das unidades da cidade polo
            const marcM = L.marker([polo.lat, polo.lng], {
              icon: L.divIcon({ className: 'rotulo-micro', html: `<span style="background:${UI.esc(cor)};color:${Store.corTexto(cor)};transform:translate(-50%,${dy}px)">${UI.esc(m.nome)} · ${UI.fmtNum(totalM)}</span>`, iconSize: [0, 0], iconAnchor: [0, 0] }),
              interactive: true, pane: 'rotulos', keyboard: false
            }).bindTooltip(balao({ cor, titulo: UI.esc(m.nome), tipo: `microrregião · distrito ${UI.esc(d.nome)}`, sub: `${(m.cidadeIds || []).length} município(s) · polo ${UI.esc(polo.nome)}`, total: totalM, dica: 'clique para ver as contratações da microrregião' }), { ...TT, offset: [0, -8] });
            marcM.on('click', e => { L.DomEvent.stopPropagation(e); abrirPainelMicro(d, m); });
            camadaRotulos.addLayer(marcM);
            rotulosMapa.push({ marcador: marcM, prioridade: totalM, cidadeIds: m.cidadeIds || [] });
          }
        }
      }
      ajustarRotulos();
      if (!porUF.size) return;
      let semMalha = 0, ufsSemMalha = 0;
      for (const [uf, itens] of porUF) {
        definirStatus(`Carregando limites dos municípios (${uf})…`);
        let dadosUF = null;
        try { dadosUF = await Malha.carregarUF(uf); }
        catch (e) { ufsSemMalha++; console.warn('Malha do IBGE indisponível', uf, e); }
        if (!ativo) return;
        for (const it of itens) {
          const f = dadosUF ? Malha.featureDaCidade(it.cidade, dadosUF) : null;
          const tooltip = balao({ cor: it.cor, titulo: `${it.polo ? '👑 ' : ''}${UI.esc(it.cidade.nome)}/${it.cidade.uf}`, sub: `${UI.esc(it.micro.nome)} (${UI.fmtNum(totaisMicro.get(it.micro.id) || 0)} contratações) · distrito ${UI.esc(it.distrito.nome)} (${UI.fmtNum(totaisDistrito.get(it.distrito.id) || 0)})` });
          if (!f) {
            // sem contorno oficial (sem internet ou cidade não achada na malha do IBGE): mostra um círculo tracejado no lugar
            semMalha++;
            const tipSemContorno = balao({ cor: it.cor, titulo: `${it.polo ? '👑 ' : ''}${UI.esc(it.cidade.nome)}/${it.cidade.uf}`, tipo: 'município sem contorno do IBGE',
              sub: `${UI.esc(it.micro.nome)} (${UI.fmtNum(totaisMicro.get(it.micro.id) || 0)} contratações) · distrito ${UI.esc(it.distrito.nome)}`, dica: 'o círculo marca o centro da cidade · clique para abrir a ficha' });
            const circ = L.circleMarker([it.cidade.lat, it.cidade.lng], { pane: 'malha', radius: 9, color: '#0f172a', weight: 1.5, dashArray: '3 2', fillColor: it.cor, fillOpacity: 0.75 }).bindTooltip(tipSemContorno, TT);
            circ.on('click', e => { L.DomEvent.stopPropagation(e); abrirPainelCidade(it.cidade, {}); });
            camadas.distritos.addLayer(circ);
            continue;
          }
          const normal = { color: '#fff', weight: 1, opacity: 0.9, fillColor: it.cor, fillOpacity: 0.72 };
          const poly = L.geoJSON(f, { pane: 'malha', style: estiloMalha(it.cidade.id, normal) }).bindTooltip(tooltip, { ...TT, sticky: true });
          polysMalha.push({ poly, cidadeId: it.cidade.id, normal });
          poly.on('mouseover', () => { if (!foco || foco.has(it.cidade.id)) poly.setStyle({ fillOpacity: 0.9 }); });
          poly.on('mouseout', () => poly.setStyle(estiloMalha(it.cidade.id, normal)));
          poly.on('click', e => { L.DomEvent.stopPropagation(e); abrirPainelCidade(it.cidade, { feature: f }); });
          camadas.distritos.addLayer(poly);
        }
      }
      if (ufsSemMalha === porUF.size) definirStatus('Limites dos municípios indisponíveis (sem internet?). Mostrando as cidades como círculos.');
      else if (semMalha) definirStatus(`${semMalha} município(s) sem contorno do IBGE — mostrados como círculo.`);
      else definirStatus('');
      const avisoCirculo = el.querySelector('#legenda-sem-contorno');
      if (avisoCirculo) avisoCirculo.hidden = !semMalha;
      if (statusMalha.textContent) setTimeout(() => { if (ativo) definirStatus(''); }, 8000);
    }
    desenharDistritos();


    // ---------- silos de grãos / PDRs (cor = microrregião da cidade onde a unidade fica) ----------
    const COR_SILO_FORA = '#94a3b8'; // unidade em cidade que não está em nenhuma microrregião
    function glifoSilo(cor, fundo, tam) {
      return `<svg width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none">
          <path d="M7 21h10V9l-5-5-5 5v12z" fill="${cor}" stroke="${cor}" stroke-width="1.2"/>
          <path d="M7 9h10M7 13h10M7 17h10" stroke="${fundo}" stroke-width="1.2" stroke-linecap="round"/>
          <path d="M12 4v17" stroke="${fundo}" stroke-width="1.2"/>
        </svg>`;
    }
    function criarIconeSilo(cor) {
      const svg = `<div style="display:flex;align-items:center;justify-content:center;width:14px;height:14px;background:${cor};border:1.5px solid #fff;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.4);cursor:pointer">${glifoSilo(Store.corTexto(cor), cor, 9)}</div>`;
      return L.divIcon({ className: 'silo-marcador-div', html: svg, iconSize: [14, 14], iconAnchor: [7, 7] });
    }
    // microrregião (cor) de cada unidade, calculada uma vez e reaproveitada a cada zoom
    const cacheMicroSilo = new Map();
    function microDeSilo(s) {
      const k = `${s.mapaId}|${s.lat},${s.lng}|${s.nome}|${s.cidade || ''}`;
      if (!cacheMicroSilo.has(k)) cacheMicroSilo.set(k, Store.microDoSilo(s));
      return cacheMicroSilo.get(k);
    }

    function renderSilos() {
      camadas.silos.clearLayers();
      const qtdEl = el.querySelector('#qtd-silos');
      if (!el.querySelector('#c-silos').checked) { if (qtdEl) qtdEl.textContent = UI.fmtNum(App.silosFiltrados().length); return; }
      // com uma cidade selecionada ficam só as unidades que são dela (ou das cidades ligadas a ela)
      const siloEmFoco = s => { if (!foco) return true; const c = Store.cidadeDoSilo(s, s.uf || ''); return !!(c && foco.has(c.id)); };
      const mapaSel = el.querySelector('#mapa-filtro-silos-mapa').value || '';
      let silos = App.silosFiltrados().filter(siloEmFoco);
      if (mapaSel) silos = silos.filter(s => s.mapaId === mapaSel);
      if (qtdEl) qtdEl.textContent = silos.length;
      if (!silosMedidos) { silos.forEach(s => { pontos.push([s.lat, s.lng]); pontosFoco.push([s.lat, s.lng]); }); silosMedidos = true; }

      // unidades muito próximas no zoom atual viram um único marcador com a quantidade
      for (const gr of agruparPorProximidade(silos, s => [s.lat, s.lng], 30)) {
        if (gr.itens.length === 1) { desenharSilo(gr.itens[0]); continue; }
        const infos = gr.itens.map(microDeSilo);
        const contagem = new Map();
        infos.forEach(i => { const k = i ? i.cor : COR_SILO_FORA; contagem.set(k, (contagem.get(k) || 0) + 1); });
        const cor = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0][0]; // cor da microrregião predominante
        const nomes = gr.itens.slice(0, 6).map(s => UI.esc(s.nome)).join('<br>');
        const m = L.marker(gr.latLng, { icon: L.divIcon({ className: 'silo-marcador-div', html: `<div class="silo-grupo" style="background:${cor}">${glifoSilo(Store.corTexto(cor), cor, 10)}</div>`, iconSize: [18, 18], iconAnchor: [9, 9] }), pane: 'silos', keyboard: false })
          .bindTooltip(balao({ cor, titulo: `🌾 ${gr.itens.length} unidades próximas`, sub: nomes.replace(/<br>/g, ' · ') + (gr.itens.length > 6 ? ' …' : ''), dica: 'clique para aproximar' }), { ...TT, offset: [0, -16] });
        m.on('click', () => mapa.setView(gr.latLng, Math.min(mapa.getZoom() + 2, 14)));
        camadas.silos.addLayer(m);
      }
      function desenharSilo(s) {
        const info = microDeSilo(s);                           // microrregião da cidade da unidade
        const cor = info ? info.cor : COR_SILO_FORA;
        const microNome = info ? info.micro.nome : (s.micro || '');
        const distNome = info ? info.distrito.nome : (s.distrito || '');
        const local = [s.cidade, microNome].filter(Boolean).map(UI.esc).join(' · ');
        const extras = Store.camposDoPonto(s).map(([k, v]) => `<div class="small"><span class="muted">${UI.esc(k)}:</span> ${UI.esc(v)}</div>`).join('');
        let linhaMicro = '<div class="muted small">Cidade fora das microrregiões cadastradas</div>';
        if (microNome) linhaMicro = `<div><span class="ponto-cor" style="background:${UI.esc(cor)}"></span>Microrregião: <b>${UI.esc(microNome)}</b>${distNome ? ` <span class="muted">(${UI.esc(distNome)})</span>` : ''}</div>`;
        else if (distNome) linhaMicro = `<div>Distrito: <b>${UI.esc(distNome)}</b></div>`;
        const m = L.marker([s.lat, s.lng], { icon: criarIconeSilo(cor), pane: 'silos' })
          .bindTooltip(balao({ cor, titulo: `🌾 ${UI.esc(s.nome)}`, sub: local, dica: 'clique para ver os detalhes' }), { ...TT, offset: [0, -13] })
          .bindPopup(`
            <div style="min-width:220px">
              <div class="linha" style="gap:6px;margin-bottom:6px;align-items:center">
                <span style="font-size:18px">🌾</span>
                <b style="font-size:14px;color:#1e293b">${UI.esc(s.nome)}</b>
              </div>
              ${s.cidade ? `<div>Cidade: <b>${UI.esc(s.cidade)}</b></div>` : ''}
              ${linhaMicro}
              ${extras ? `<div style="margin-top:6px">${extras}</div>` : ''}
              <div class="muted small" style="margin-top:8px;border-top:1px solid #eee;padding-top:4px">Mapa: ${UI.esc(s.mapaNome)}</div>
            </div>
          `);
        camadas.silos.addLayer(m);
      }
    }
    let silosMedidos = false;

    // ---------- agências do SINE (camada opcional) ----------
    const camadaSine = L.layerGroup();
    // (re)monta a camada: as bases dos estados (PR, SC…) chegam depois do mapa abrir, então ela é refeita quando carregam
    const ZOOM_MIN_SINE = 9; // afastado demais vira uma nuvem de "S": as agências só aparecem perto
    // Estado da agência: o campo uf; sem ele (planilha importada sem a coluna), o estado da cidade com esse nome
    function ufAgencia(a) {
      if (a.uf) return String(a.uf).toUpperCase();
      const c = Store.resolverCidade(a.cidade);
      return c ? c.uf : '';
    }
    const cidadeAgencia = a => { const uf = ufAgencia(a); return Store.resolverCidade(a.cidade, uf) || Store.cidadeAproximada(a.cidade, uf); };
    function montarCamadaSine() {
      camadaSine.clearLayers();
      if (mapa.getZoom() < ZOOM_MIN_SINE && !foco) {
        const ags0 = Store.agenciasSine().filter(a => App.ufNoFiltro(ufAgencia(a)));
        el.querySelector('#qtd-sine').textContent = ags0.length;
        el.querySelector('#c-sine-wrap').style.display = ags0.length ? '' : 'none';
        el.querySelector('#c-sine-wrap').title = 'Aproxime o zoom para ver as agências (ou clique numa cidade)';
        return;
      }
      // agência sem coordenada (base de SC) fica no centro da cidade
      const ags = Store.agenciasSine().filter(a => App.ufNoFiltro(ufAgencia(a))).map(a => {
        const c = cidadeAgencia(a);
        if (foco && !(c && foco.has(c.id))) return null; // seleção ativa: só a agência da cidade selecionada
        if (a.lat != null && a.lng != null) return a;
        return c ? { ...a, lat: c.lat, lng: c.lng } : null;
      }).filter(Boolean);
      el.querySelector('#qtd-sine').textContent = ags.length;
      el.querySelector('#c-sine-wrap').style.display = ags.length ? '' : 'none';
      for (const a of ags) {
        const m = L.marker([a.lat, a.lng], { icon: L.divIcon({ className: 'silo-marcador-div', html: '<div class="sine-marcador">S</div>', iconSize: [22, 22], iconAnchor: [11, 11] }), pane: 'silos', keyboard: false })
          .bindTooltip(balao({ cor: '#0f766e', titulo: `SINE ${UI.esc(a.nome || a.cidade)}`, sub: [a.endereco, (a.telefones || []).join(' · ')].filter(Boolean).map(UI.esc).join('<br>'), dica: 'clique para abrir a ficha da cidade' }), { ...TT, offset: [0, -14] });
        m.on('click', () => { const c = cidadeAgencia(a); if (c) abrirPainelCidade(c, {}); });
        camadaSine.addLayer(m);
      }
    }
    montarCamadaSine();
    el.querySelector('#c-sine').addEventListener('change', e => { if (e.target.checked) { montarCamadaSine(); camadaSine.addTo(mapa); if (mapa.getZoom() < ZOOM_MIN_SINE) UI.toast('Aproxime o zoom para ver as agências do SINE (ou clique numa cidade).', 'info', 3500); } else mapa.removeLayer(camadaSine); });
    Store.carregarBasesSineEmUso().then(() => { if (ativo) montarCamadaSine(); });

    // ---------- falta contratar (camada opcional): cada distrito pintado pela % do pedido preenchido ----------
    // Usa as vagas aprovadas do filtro atual (projeto e distrito do topo); conta local e móvel separados, igual ao Início.
    mapa.createPane('falta').style.zIndex = 360;   // acima da malha das micros, abaixo dos marcadores
    const camadaFalta = L.layerGroup();
    const corFalta = p => `hsl(${Math.round(120 * Math.max(0, Math.min(1, p)))}, 72%, 42%)`;   // 0% vermelho → 100% verde
    let montandoFalta = 0;
    async function montarCamadaFalta() {
      const vez = ++montandoFalta;
      camadaFalta.clearLayers();
      if (typeof Nuvem !== 'undefined' && Nuvem.ativa && Nuvem.rh && Nuvem.rh.contagemVagas) {
        try { Store.definirContagemVagas(await Nuvem.rh.contagemVagas(App.filtros.projetoId)); } catch (e) { /* sem contagem: mostra só o pedido */ }
      }
      if (!ativo || vez !== montandoFalta) return;
      const fT = App.filtros.tipo;
      const porD = new Map();
      const doFiltro = opcoesFalta();
      for (const v of doFiltro) {
        for (const x of v.porDistrito) {
          const a = porD.get(x.distrito.id) || { pl: 0, pm: 0, al: 0, am: 0, vagas: [] };
          let f = 0;
          if (fT !== 'MOVEL') { a.pl += x.locais; a.al += Math.min(x.admLoc, x.locais); f += Math.max(0, x.locais - x.admLoc); }
          if (fT !== 'LOCAL') { a.pm += x.moveis; a.am += Math.min(x.admMov, x.moveis); f += Math.max(0, x.moveis - x.admMov); }
          a.vagas.push({ titulo: v.titulo, falta: f });
          porD.set(x.distrito.id, a);
        }
      }
      // 1º: as contas e o resumo no painel (sai na hora); 2º: a pintura (espera a malha dos municípios)
      const itens = [];
      for (const d of distritos) {
        const a = porD.get(d.id); if (!a || !(a.pl + a.pm)) continue;
        const cids = Store.cidadesDoDistrito(d); if (!cids.length) continue;
        const ped = a.pl + a.pm, adm = a.al + a.am, fl = a.pl - a.al, fm = a.pm - a.am;
        itens.push({ d, a, cids, ped, adm, fl, fm, falta: fl + fm, p: adm / ped, cor: corFalta(adm / ped) });
      }
      resumirFalta(itens, doFiltro.length);
      for (const { d, a, cids, ped, adm, fl, fm, falta, p, cor } of itens) {
        const quais = a.vagas.filter(x => x.falta).sort((x, y) => y.falta - x.falta);
        const tip = balao({ cor, titulo: `Distrito ${UI.esc(d.nome)}`, tipo: 'pedido das vagas aprovadas', sub: `${adm} de ${ped} admitidos (${Math.round(100 * p)}%) · locais ${a.al}/${a.pl} · móveis ${a.am}/${a.pm}` +
          (quais.length ? '<br>' + quais.slice(0, 4).map(x => `${UI.esc(x.titulo)}: faltam ${x.falta}`).join('<br>') + (quais.length > 4 ? `<br>e mais ${quais.length - 4}` : '') : ''), dica: falta ? `faltam ${falta}` : 'pedido completo' });
        const porUF = new Map(); for (const c of cids) { if (!porUF.has(c.uf)) porUF.set(c.uf, []); porUF.get(c.uf).push(c); }
        for (const [uf, lista] of porUF) {
          let dadosUF = null; try { dadosUF = await Malha.carregarUF(uf); } catch (e) { /* sem malha: círculos */ }
          if (!ativo || vez !== montandoFalta) return;
          for (const c of lista) {
            const f = dadosUF ? Malha.featureDaCidade(c, dadosUF) : null;
            camadaFalta.addLayer((f ? L.geoJSON(f, { pane: 'falta', style: { color: '#fff', weight: 0.6, opacity: 0.8, fillColor: cor, fillOpacity: 0.62 } })
              : L.circleMarker([c.lat, c.lng], { pane: 'falta', radius: 8, color: '#fff', weight: 1, fillColor: cor, fillOpacity: 0.8 })).bindTooltip(tip, { ...TT, sticky: !!f }));
          }
        }
        // rótulo no centro do distrito: faltam N (L/M)
        const lat = cids.reduce((t, c) => t + c.lat, 0) / cids.length, lng = cids.reduce((t, c) => t + c.lng, 0) / cids.length;
        camadaFalta.addLayer(L.marker([lat, lng], { pane: 'rotulos', interactive: false, keyboard: false,
          icon: L.divIcon({ className: 'rotulo-micro', html: `<span class="rotulo-falta" style="background:${cor}">${falta ? `faltam ${falta} (${fl}/${fm})` : 'completo'}</span>`, iconSize: [0, 0], iconAnchor: [0, 0] }) }));
      }
    }
    // filtros da camada: RH responsável e vaga (só as vagas aprovadas com distrito, do filtro do topo). Devolve as vagas que entram na conta.
    const selFaltaRh = el.querySelector('#c-falta-rh'), selFaltaVaga = el.querySelector('#c-falta-vaga'), resumoFalta = el.querySelector('#c-falta-resumo');
    function opcoesFalta() {
      const todas = Store.vagasVisiveis(App.usuario, { projetoId: App.filtros.projetoId }).filter(v => v.aprovada && v.status !== 'cancelada' && v.porDistrito.length);
      const rhs = new Map();
      for (const v of todas) for (const l of (v.responsaveis || [])) { const u = Store.usuarioPorLogin(l); rhs.set(l, u ? u.nome : l); }
      const rhAtual = selFaltaRh.value, vagaAtual = selFaltaVaga.value;
      selFaltaRh.innerHTML = '<option value="">Todos os RHs</option>' + [...rhs.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR')).map(([l, n]) => `<option value="${UI.esc(l)}">RH: ${UI.esc(n)}</option>`).join('');
      selFaltaRh.value = rhs.has(rhAtual) ? rhAtual : '';
      selFaltaRh.hidden = rhs.size < 2;
      const doRh = todas.filter(v => !selFaltaRh.value || (v.responsaveis || []).includes(selFaltaRh.value)).sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
      selFaltaVaga.innerHTML = `<option value="">Todas as vagas (${doRh.length})</option>` + doRh.map(v => `<option value="${UI.esc(v.id)}">${UI.esc(v.titulo)}${v.contagemCarregada ? (v.faltam ? ` · faltam ${v.faltam}` : ' · completa') : ''}</option>`).join('');
      selFaltaVaga.value = doRh.some(v => v.id === vagaAtual) ? vagaAtual : '';
      selFaltaVaga.hidden = !doRh.length;
      return doRh.filter(v => !selFaltaVaga.value || v.id === selFaltaVaga.value);
    }
    // resumo no painel: total que falta e os distritos, do que mais falta para o que menos falta (clique aproxima)
    function resumirFalta(itens, nVagas) {
      const selo = el.querySelector('#c-falta-selo');
      if (!itens.length) {
        resumoFalta.innerHTML = `<div class="muted small">${nVagas ? 'As vagas deste filtro não têm distrito na região mostrada.' : 'Nenhuma vaga aprovada com distrito neste filtro.'}</div>`;
        if (selo) selo.textContent = ''; return;
      }
      const falta = itens.reduce((n, x) => n + x.falta, 0), ped = itens.reduce((n, x) => n + x.ped, 0);
      if (selo) selo.textContent = falta ? `faltam ${UI.fmtNum(falta)}` : 'completo';
      resumoFalta.innerHTML = `<div class="mpn-falta-total">${falta ? `Faltam <b>${UI.fmtNum(falta)}</b> de ${UI.fmtNum(ped)} pessoas` : `Pedido completo: <b>${UI.fmtNum(ped)}</b> pessoas`}</div>` +
        itens.slice().sort((a, b) => b.falta - a.falta || a.d.nome.localeCompare(b.d.nome, 'pt-BR', { numeric: true })).map(x =>
          `<button type="button" class="mpn-falta-linha" data-d="${UI.esc(x.d.id)}" title="${x.adm} de ${x.ped} admitidos · locais ${x.a.al}/${x.a.pl} · móveis ${x.a.am}/${x.a.pm}. Clique para aproximar."><i style="background:${x.cor}"></i><span>${UI.esc(x.d.nome)}</span><b>${x.falta ? `faltam ${x.falta}` : 'completo'}</b></button>`).join('') +
        '<div class="mpn-escala"><span>falta tudo</span><i></i><span>completo</span></div>';
    }
    resumoFalta.addEventListener('click', e => { const b = e.target.closest('[data-d]'); if (!b) return; const d = Store.distrito(b.dataset.d); if (d) focar(Store.cidadesDoDistrito(d)); });
    selFaltaRh.addEventListener('change', () => { selFaltaVaga.value = ''; montarCamadaFalta(); });
    selFaltaVaga.addEventListener('change', montarCamadaFalta);
    el.querySelector('#c-falta').addEventListener('change', e => {
      el.querySelector('#c-falta-opcoes').hidden = !e.target.checked;
      const lg = el.querySelector('#legenda-falta'); if (lg) lg.hidden = !e.target.checked;
      if (e.target.checked) { camadaFalta.addTo(mapa); montarCamadaFalta(); } else { montandoFalta++; mapa.removeLayer(camadaFalta); const selo = el.querySelector('#c-falta-selo'); if (selo) selo.textContent = ''; }
    });
    el.querySelector('#c-falta').addEventListener('change', e => {
      if (e.target.checked) { camadaFalta.addTo(mapa); montarCamadaFalta(); } else { montandoFalta++; mapa.removeLayer(camadaFalta); }
    });

    // ---------- limites dos estados (malha do IBGE, guardada no navegador) ----------
    async function carregarLimite(uf) {
      const chave = 'maparh:malha:' + uf;
      let geo = null;
      try { geo = JSON.parse(localStorage.getItem(chave) || 'null'); } catch (e) { geo = null; }
      if (!geo) {
        const cod = Store.UF_CODIGO[uf];
        if (!cod) return null;
        const r = await fetch(`https://servicodados.ibge.gov.br/api/v3/malhas/estados/${cod}?formato=application/vnd.geo+json&qualidade=minima`);
        if (!r.ok) throw new Error('IBGE HTTP ' + r.status);
        geo = await r.json();
        try { localStorage.setItem(chave, JSON.stringify(geo)); } catch (e) { /* sem espaço: segue sem cache */ }
      }
      return geo;
    }
    const projetosComDados = projetos.filter(p => p.ativo !== false || regs.some(r => r.projetoId === p.id));
    [...new Set(projetosComDados.flatMap(p => Store.ufsProjeto(p)))].forEach(async uf => {
      try {
        const geo = await carregarLimite(uf);
        if (!geo || !ativo) return;
        const cor = (projetosComDados.find(p => Store.ufDoProjeto(p, uf)) || {}).cor || COR_ATUACAO;
        camadas.limites.addLayer(L.geoJSON(geo, { style: { color: cor, weight: 2, opacity: 0.7, dashArray: '8 6', fillColor: cor, fillOpacity: 0.05 }, interactive: false }));
      } catch (e) { console.warn('Limite do estado indisponível', uf, e); }
    });

    // ---------- painéis ----------
    // seqPainel muda a cada painel aberto/fechado: tarefas assíncronas de um painel antigo veem que mudou e não escrevem mais nada
    let seqPainel = 0;
    const wrapMapa = el.querySelector('.mapa-wrap');
    // presença: a cidade aberta no painel; os outros veem a minha foto e eu vejo a deles
    let cidadeOlhada = '';
    function olharCidade(id) { cidadeOlhada = id || ''; App.olhar(id ? 'cidade:' + id : 'pagina:mapa'); pintarOlhando(); }
    function pintarOlhando() { const box = painel.querySelector('#painel-olhando'); if (box) box.innerHTML = cidadeOlhada ? App.olhandoHtml('cidade:' + cidadeOlhada, 22, true) : ''; pintarFotosMapa(); }
    // fotos de quem está olhando cada cidade, em cima da cidade (a minha também)
    const camadaOlhando = L.layerGroup().addTo(mapa);
    function pintarFotosMapa() {
      camadaOlhando.clearLayers();
      const todos = typeof Nuvem !== 'undefined' && Nuvem.presentes ? Nuvem.presentes() : [];
      const porCidade = new Map();
      const euLogin = App.usuario && App.usuario.login;   // a minha foto não aparece no mapa: só a dos outros
      for (const x of todos) if (x.login !== euLogin && String(x.onde || '').startsWith('cidade:')) { const id = x.onde.slice(7); if (!porCidade.has(id)) porCidade.set(id, []); porCidade.get(id).push(x); }
      for (const [id, l] of porCidade) {
        const c = Store.cidade(id); if (!c || c.lat == null) continue;
        const eu = App.usuario && App.usuario.login;
        const mostrar = l.slice(0, 3), mais = l.length - mostrar.length;
        const html = `<div class="mp-olho">${mostrar.map(x => `<span class="mp-olho-foto ${x.login === eu ? 'eu' : ''}">${UI.avatar(Store.usuarioPorLogin(x.login) || { nome: x.nome || x.login }, 28)}</span>`).join('')}${mais > 0 ? `<span class="mp-olho-mais">+${mais}</span>` : ''}</div>`;
        const nomes = l.map(x => x.login === eu ? 'Você' : String(x.nome || x.login).split(' ')[0]).join(', ');
        const w = 28 + (mostrar.length - 1) * 18 + (mais > 0 ? 24 : 0) + 8;
        L.marker([c.lat, c.lng], { interactive: true, keyboard: false, zIndexOffset: 2000,
          icon: L.divIcon({ className: 'mp-olho-icone', html, iconSize: [w, 36], iconAnchor: [w / 2, 52] }) })
          .bindTooltip(`${UI.esc(nomes)} ${l.length === 1 && l[0].login !== eu ? 'está' : l.length === 1 ? 'está' : 'estão'} olhando ${UI.esc(c.nome)}`, { direction: 'top', offset: [0, -50] })
          .addTo(camadaOlhando);
      }
    }
    const aoPresenca = () => pintarOlhando();
    document.addEventListener('maparh:presenca', aoPresenca);
    function fecharPainel() {
      seqPainel++;
      olharCidade('');
      const estavaAberto = !painel.hidden;
      painel.hidden = true; painel.innerHTML = ''; camadaDestaque.clearLayers();
      wrapMapa.classList.remove('painel-aberto');
      const tinhaLinhas = !!linhasSelecionadas;
      linhasSelecionadas = null;
      if (foco) aplicarFoco(null); else if (tinhaLinhas) aplicarModoLinhas(); // nada selecionado: não redesenha
      if (estavaAberto && focoAntesPainel && document.contains(focoAntesPainel)) { try { focoAntesPainel.focus({ preventScroll: true }); } catch (e) { /* ignora */ } }
      focoAntesPainel = null;
    }
    let focoAntesPainel = null;
    function cabecalhoPainel(titulo, sub) {
      return `<h3><span>${titulo}</span><button class="btn-icone" id="painel-fechar" title="Fechar e mostrar tudo de novo (Esc)" aria-label="Fechar painel">&times;</button></h3><div id="painel-olhando"></div><div class="muted small mb">${sub}</div>` +
        `<div class="painel-foco-aviso small">Mostrando no mapa só o que se liga a esta seleção · <a href="#" id="painel-mostrar-tudo">mostrar tudo</a></div>`;
    }
    // liga os botões do painel, mostra o painel e passa o foco do teclado para ele; devolve o número desta abertura
    function ligarFechar() {
      painel.querySelector('#painel-fechar').addEventListener('click', fecharPainel);
      if (painel.hidden) focoAntesPainel = document.activeElement;
      painel.hidden = false;
      wrapMapa.classList.add('painel-aberto');
      painel.scrollTop = 0;
      try { painel.focus({ preventScroll: true }); } catch (e) { /* ignora */ }
      const mt = painel.querySelector('#painel-mostrar-tudo');
      if (mt) mt.addEventListener('click', e => { e.preventDefault(); linhasSelecionadas = null; if (foco) aplicarFoco(null); else aplicarModoLinhas(); mt.closest('.painel-foco-aviso').remove(); });
      return ++seqPainel;
    }
    // Esc fecha o painel (se não houver uma janela aberta por cima)
    function aoTeclar(e) {
      if (e.key !== 'Escape' || painel.hidden || document.querySelector('.modal-overlay')) return;
      fecharPainel();
    }
    document.addEventListener('keydown', aoTeclar);
    // ---------- painéis: sempre listam as PESSOAS (uma linha por contratação), para o número do mapa bater com a lista ----------
    const colProjeto = { titulo: 'Projeto', render: f => `<span class="ponto-cor" style="background:${UI.esc(f.projeto.cor)}"></span>${UI.esc(f.projeto.nome)}${f.projeto.ano ? ' <span class="muted small">' + f.projeto.ano + '</span>' : ''}` };
    const badgeTipo = r => UI.badgeTipo(r.tipo);
    const nomeCidade = c => c ? `${UI.esc(c.nome)}/${c.uf}` : '—';
    const regiaoCurta = id => { const i = corDe(id); return i ? `<span class="muted small"> · ${UI.esc(i.micro.nome)}</span>` : ''; };
    const rotuloMovel = r => `<span class="badge badge-roxo">Sem cidade definida · todo o estado ${UI.esc(Analise.ufsMovel(r.projeto))}</span>`;
    const seloBase = r => Analise.ehBase(r) ? ' <span class="badge badge-roxo" title="Cadastro MÓVEL: esta é a base de contratação">base de contratação</span>' : '';
    // pessoas por agrupamento (mesma regra usada nos números do mapa)
    const pessoasDeOrigem = cidadeId => regs.filter(r => r.cidadeId === cidadeId);
    const pessoasDeAtuacao = cidadeId => regs.filter(r => !r.atuacaoMovel && r.cidadeAtuacao && r.cidadeAtuacao.id === cidadeId);
    const pessoasDoHub = uf => regs.filter(r => r.atuacaoMovel && Analise.ufsMovel(r.projeto) === uf);
    const pessoasDoFluxo = f => regs.filter(r => r.projetoId === f.projeto.id && r.cidadeId === f.cidadeOrigem.id && (f.atuacaoMovel ? r.atuacaoMovel : (!r.atuacaoMovel && r.cidadeAtuacao && r.cidadeAtuacao.id === f.cidadeAtuacao.id)));
    // Lista de pessoas: de onde vem / onde trabalha (numa coluna só, para caber no painel), tipo, distância (+ projeto quando há mais de um)
    function listaPessoas(lista, { origem = true, destino = true, referencia = null, cadastro = false, limite = 300 } = {}) {
      const varios = new Set(lista.map(r => r.projetoId)).size > 1;
      const nome = c => c ? c.nome : '';
      const ordenada = lista.slice().sort((a, b) => nome(a.cidade).localeCompare(nome(b.cidade)) || nome(a.cidadeAtuacao).localeCompare(nome(b.cidadeAtuacao)) || (a.criadoEm || '').localeCompare(b.criadoEm || ''));
      const txtOrigem = r => `<a href="#" class="p-origem" data-id="${r.cidadeId}" title="Ver todos que são desta cidade">${nomeCidade(r.cidade)}</a>${regiaoCurta(r.cidadeId)}${referencia && r.cidadeId === referencia ? ' <span class="badge badge-azul">daqui mesmo</span>' : ''}${r.foraDoEstado ? ' <span class="badge badge-amarelo">fora do estado</span>' : ''}`;
      const txtDestino = r => r.atuacaoMovel ? rotuloMovel(r) : `<a href="#" class="p-destino" data-id="${r.cidadeAtuacao.id}" title="Ver todos que trabalham nesta cidade">${nomeCidade(r.cidadeAtuacao)}</a>${regiaoCurta(r.cidadeAtuacao.id)}${referencia && r.cidadeAtuacao.id === referencia ? ' <span class="badge badge-azul">aqui mesmo</span>' : ''}${seloBase(r)}`;
      const colCidades = origem && destino
        ? [{ titulo: 'De onde ➜ onde trabalha', render: r => `${txtOrigem(r)} <span class="muted">➜</span> ${txtDestino(r)}` }]
        : [...(origem ? [{ titulo: 'De onde vem', render: txtOrigem }] : []), ...(destino ? [{ titulo: 'Onde trabalha', render: txtDestino }] : [])];
      const colPessoa = { titulo: 'Pessoa', render: r => {
        const p = pessoaDoReg(r), rh = r.rhLogin ? Store.usuarioPorLogin(r.rhLogin) : null;
        const nome = p ? `<a href="#" class="p-pessoa" data-nome="${UI.esc(p.pessoa.nome)}" data-proj="${UI.esc(r.projetoId)}" title="Abrir em Candidatos">${UI.esc(p.pessoa.nome)}</a>` : r.cargo ? UI.esc(r.cargo) : '<span class="muted">sem nome (lançamento antigo)</span>';
        const sub = [p && r.cargo ? UI.esc(r.cargo) : '', r.admitidoEm ? 'entrou ' + RH.fmtDia(String(r.admitidoEm).slice(0, 10)) : '', p && p.chegada_data ? 'chega ' + RH.fmtDia(p.chegada_data) : ''].filter(Boolean).join(' · ');
        return `<div class="mp-pessoa">${rh ? `<span title="RH: ${UI.esc(rh.nome)}">${UI.avatar(rh, 24)}</span>` : ''}<div><div class="mp-pessoa-nome">${nome}</div>${sub ? `<div class="muted small">${sub}</div>` : ''}</div></div>`;
      } };
      return UI.tabela({
        vazio: 'Ninguém no filtro atual.',
        colunas: [
          colPessoa,
          ...colCidades,
          { titulo: 'Tipo', render: badgeTipo },
          ...(varios ? [colProjeto] : []),
          { titulo: 'Dist.', classe: 'direita', render: r => UI.fmtKm(r.distancia) },
          ...(cadastro ? [{ titulo: 'Cadastro', render: r => `${UI.fmtData(r.criadoEm)}${r.criadoPor ? ` <span class="muted small">${UI.esc(r.criadoPor)}</span>` : ''}` }] : [])
        ],
        linhas: ordenada.slice(0, limite)
      }) + (lista.length > limite ? `<div class="muted small" style="margin-top:6px">Mostrando ${limite} de ${lista.length}. Use os filtros do topo para reduzir.</div>` : '');
    }
    // nomes de cidade dentro das listas são clicáveis: origem → "são daqui"; trabalho → "trabalham aqui"
    function ligarListas() {
      painel.querySelectorAll('.p-origem').forEach(a => a.addEventListener('click', e => { e.preventDefault(); const g = porOrigem.get(a.dataset.id); if (g) selecionarOrigem(g); }));
      painel.querySelectorAll('.p-destino').forEach(a => a.addEventListener('click', e => { e.preventDefault(); const at = porAtuacao.get(a.dataset.id); if (at) selecionarAtuacao(at); }));
      painel.querySelectorAll('.p-pessoa').forEach(a => a.addEventListener('click', e => { e.preventDefault();
        try { sessionStorage.setItem('maparh:cand-seg', 'admitido'); sessionStorage.setItem('maparh:cand-busca', a.dataset.nome); localStorage.setItem('maparh:cand-projeto', a.dataset.proj); } catch (er) { /* ok */ }
        App.ir('candidatos'); }));
    }
    const botaoFicha = cid => `<button class="btn btn-pequeno" id="painel-ficha">Ficha de ${UI.esc(cid.nome)} (IBGE, SINE, anotações)</button>`;
    const ligarFicha = cid => { const b = painel.querySelector('#painel-ficha'); if (b) b.addEventListener('click', () => abrirPainelCidade(cid, {})); };
    const resumo = (titulo, html) => `<details style="margin-top:10px"><summary class="small" style="cursor:pointer;font-weight:600">${titulo}</summary>${html}</details>`;
    function tabelaOrigens(lista, totalRef, cidadeRef) {
      return UI.tabela({
        vazio: 'Nenhuma contratação para o filtro atual.',
        colunas: [
          { titulo: 'Cidade de origem', render: f => `${UI.esc(f.cidadeOrigem.nome)}/${f.cidadeOrigem.uf}${cidadeRef && f.cidadeOrigem.id === cidadeRef.id ? ' <span class="badge badge-azul">própria</span>' : ''}${f.foraDoEstado ? ' <span class="badge badge-amarelo">fora do estado</span>' : ''}` },
          ...(new Set(lista.map(f => f.projeto.id)).size > 1 ? [colProjeto] : []),
          { titulo: 'L', classe: 'direita', render: f => f.local },
          { titulo: 'M', classe: 'direita', render: f => f.movel },
          { titulo: 'Total', classe: 'direita', render: f => `<b>${f.total}</b>` },
          { titulo: '%', classe: 'direita', render: f => UI.fmtPct(totalRef ? f.total / totalRef * 100 : 0, 0) },
          { titulo: 'Dist.', classe: 'direita', render: f => UI.fmtKm(f.dist) }
        ],
        linhas: lista.slice().sort((a, b) => b.total - a.total)
      });
    }
    function tabelaDestinos(lista) {
      return UI.tabela({
        vazio: 'Nenhuma contratação para o filtro atual.',
        colunas: [
          { titulo: 'Onde trabalham', render: f => f.atuacaoMovel ? `<span class="badge badge-roxo">Sem cidade definida · todo o estado ${UI.esc(f.uf)}</span>` : `${UI.esc(f.cidadeAtuacao.nome)}/${f.cidadeAtuacao.uf}${regiaoCurta(f.cidadeAtuacao.id)}${f.base ? ' <span class="badge badge-roxo">base de contratação</span>' : ''}` },
          ...(new Set(lista.map(f => f.projeto.id)).size > 1 ? [colProjeto] : []),
          { titulo: 'L', classe: 'direita', render: f => f.local },
          { titulo: 'M', classe: 'direita', render: f => f.movel },
          { titulo: 'Total', classe: 'direita', render: f => `<b>${f.total}</b>` },
          { titulo: 'Dist.', classe: 'direita', render: f => UI.fmtKm(f.dist) }
        ],
        linhas: lista.slice().sort((a, b) => b.total - a.total)
      });
    }
    // Losango azul: quem TRABALHA na cidade
    function abrirPainelAtuacao(a) {
      olharCidade(a.cidade.id);   // avisa os outros antes de montar o painel
      const lista = pessoasDeAtuacao(a.cidade.id);
      const daqui = lista.filter(r => r.cidadeId === a.cidade.id).length;
      const cidades = new Set(lista.map(r => r.cidadeId)).size;
      painel.innerHTML = cabecalhoPainel(`<span class="marc-atuacao mini"><span>${lista.length}</span></span>Trabalham em ${UI.esc(a.cidade.nome)}`,
        `<b>${pes(lista.length)}</b> ${lista.length === 1 ? 'trabalha' : 'trabalham'} em ${UI.esc(a.cidade.nome)}/${a.cidade.uf}: ${daqui ? `${daqui} ${daqui === 1 ? 'é' : 'são'} daqui mesmo` : ''}${daqui && lista.length - daqui ? ' e ' : ''}${lista.length - daqui ? `${lista.length - daqui} ${lista.length - daqui === 1 ? 'veio' : 'vieram'} de ${cidades - (daqui ? 1 : 0) === 1 ? 'outra cidade' : (cidades - (daqui ? 1 : 0)) + ' outras cidades'}` : ''} · ${a.local} local · ${a.movel} móvel`) +
        `<div class="linha" style="gap:6px;margin-bottom:10px;flex-wrap:wrap">${botaoFicha(a.cidade)}</div>` +
        listaPessoas(lista, { destino: false, referencia: a.cidade.id }) +
        resumo('Resumo por cidade de origem', tabelaOrigens(a.fluxos, a.total, a.cidade));
      ligarFechar(); ligarListas(); ligarFicha(a.cidade); olharCidade(a.cidade.id);
      aplicarFoco([a.cidade.id, ...a.fluxos.map(f => f.cidadeOrigem.id)]);
    }
    // Bola laranja: quem É da cidade (e onde cada um trabalha)
    function abrirPainelOrigem(g) {
      olharCidade(g.cidade.id);
      const lista = pessoasDeOrigem(g.cidade.id);
      const s = saidasDe(g);
      painel.innerHTML = cabecalhoPainel(`<span class="bolha-origem mini">${lista.length}</span>São de ${UI.esc(g.cidade.nome)}`,
        `<b>${pes(lista.length)}</b> ${lista.length === 1 ? 'é' : 'são'} de ${UI.esc(g.cidade.nome)}/${g.cidade.uf}: ${s.proprias ? `${s.proprias} ${s.proprias === 1 ? 'trabalha' : 'trabalham'} aqui mesmo` : ''}${s.proprias && s.foram ? ' e ' : ''}${s.foram ? `${s.foram} ${s.foram === 1 ? 'trabalha' : 'trabalham'} em outra cidade (${s.destinos} destino${s.destinos === 1 ? '' : 's'})` : ''} · ${g.local} local · ${g.movel} móvel`) +
        `<div class="linha" style="gap:6px;margin-bottom:10px;flex-wrap:wrap">${botaoFicha(g.cidade)}</div>` +
        listaPessoas(lista, { origem: false, referencia: g.cidade.id }) +
        resumo('Resumo por cidade de trabalho', tabelaDestinos(g.fluxos));
      ligarFechar(); ligarListas(); ligarFicha(g.cidade); olharCidade(g.cidade.id);
      aplicarFoco([g.cidade.id, ...destinosDe(g.fluxos)]);
    }
    // Ponto roxo: atuação móvel em todo o estado
    function abrirPainelHub(h) {
      const lista = pessoasDoHub(h.uf);
      painel.innerHTML = cabecalhoPainel(`<span class="ponto-cor" style="background:${COR_HUB}"></span>Sem cidade definida — ${UI.esc(nomeUFs(h.uf))}`,
        `<b>${pes(lista.length)}</b> com cadastro antigo (MÓVEL), sem cidade de trabalho: podem atuar em qualquer lugar de ${UI.esc(h.uf)} · vêm de ${new Set(h.fluxos.map(f => f.cidadeOrigem.id)).size} cidade(s) · ${h.local} local · ${h.movel} móvel`) +
        listaPessoas(lista, { destino: false }) + resumo('Resumo por cidade de origem', tabelaOrigens(h.fluxos, h.total));
      ligarFechar(); ligarListas();
      aplicarFoco(['H:' + h.uf, ...h.fluxos.map(f => f.cidadeOrigem.id)]);
    }
    // Várias cidades de origem juntas numa bola (zoom afastado)
    function abrirPainelGrupoOrigem(gr) {
      const lista = gr.itens.flatMap(g => pessoasDeOrigem(g.cidade.id));
      painel.innerHTML = cabecalhoPainel(`<span class="bolha-origem mini varias">${lista.length}</span>${gr.itens.length} cidades próximas`,
        `<b>${pes(lista.length)}</b> ${lista.length === 1 ? 'é' : 'são'} de ${gr.itens.length} cidades vizinhas, juntas numa bola só neste zoom · aproxime para separar, ou clique no nome de uma cidade`) +
        listaPessoas(lista);
      ligarFechar(); ligarListas();
      aplicarFoco([...gr.itens.map(g => g.cidade.id), ...gr.itens.flatMap(g => destinosDe(g.fluxos))]);
    }
    // Clique em uma linha: quem faz aquele trajeto (de onde vêm ➜ onde trabalham), com as duas pontas enquadradas
    function abrirPainelFluxo(f, linha) {
      const o = f.cidadeOrigem, infoO = corDe(o.id);
      const infoA = f.atuacaoMovel ? null : corDe(f.cidadeAtuacao.id);
      const destNome = f.atuacaoMovel ? `todo o estado ${UI.esc(f.uf)} (sem cidade definida)` : `${UI.esc(f.cidadeAtuacao.nome)}/${f.cidadeAtuacao.uf}${f.base ? ' (base de contratação)' : ''}`;
      const regiao = i => i ? `${UI.esc(i.micro.nome)} · distrito ${UI.esc(i.distrito.nome)}` : 'fora das microrregiões cadastradas';
      const lista = pessoasDoFluxo(f);
      painel.innerHTML = cabecalhoPainel(`<span class="legenda-traco" style="color:${UI.esc(linha.options.color)};margin-right:8px"></span>De ${UI.esc(o.nome)} para ${destNome}`,
        `<b>${pes(lista.length)}</b> ${lista.length === 1 ? 'é' : 'são'} de ${UI.esc(o.nome)} e trabalham em ${destNome} · ${f.local} local · ${f.movel} móvel${f.dist != null ? ' · ' + UI.fmtKm(f.dist) : ''}${new Set(regs.map(r => r.projetoId)).size > 1 ? ` · ${UI.esc(f.projeto.nome)}` : ''}`) +
        `<div class="ficha-grade" style="margin-bottom:10px">
          <div class="ficha-dado"><div class="rotulo"><span class="ponto-cor" style="background:${COR_ORIGEM}"></span>De onde vêm</div><div class="valor" style="font-size:16px"><a href="#" class="p-origem" data-id="${o.id}">${UI.esc(o.nome)}/${o.uf}</a></div><div class="muted small">${regiao(infoO)}</div></div>
          <div class="ficha-dado"><div class="rotulo"><span class="marc-atuacao mini"></span>Onde trabalham</div><div class="valor" style="font-size:16px">${f.atuacaoMovel ? destNome : `<a href="#" class="p-destino" data-id="${f.cidadeAtuacao.id}">${destNome}</a>`}</div><div class="muted small">${f.atuacaoMovel ? 'cadastro antigo (MÓVEL)' : regiao(infoA)}</div></div>
        </div>
        <div class="linha" style="gap:6px;flex-wrap:wrap;margin-bottom:10px"><button class="btn btn-pequeno btn-primario" id="fluxo-enquadrar">Enquadrar os dois pontos</button></div>` +
        listaPessoas(lista, { origem: false, destino: false, cadastro: true });
      ligarFechar(); ligarListas();
      destacarLinhas([linha]);
      aplicarFoco([o.id, f.atuacaoMovel ? 'H:' + f.uf : f.cidadeAtuacao.id]);
      const enquadrar = () => mapa.fitBounds(linha.getBounds().pad(0.25), { maxZoom: 11 });
      enquadrar();
      painel.querySelector('#fluxo-enquadrar').addEventListener('click', enquadrar);
    }

    // ---------- ficha da cidade: dados do IBGE, contratações, anotações do RH e divisa ----------
    // Estados onde o ponto pode estar: os das cidades mais próximas (lista do IBGE). Vale para o Brasil inteiro,
    // não só para os estados dos projetos — a malha do estado é baixada na hora, uma vez, e fica guardada.
    function ufsDoPonto(lat, lng) {
      const perto = [];
      for (const c of Store.cidades()) { const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2; if (d < 4) perto.push([d, c.uf]); }
      perto.sort((a, b) => a[0] - b[0]);
      return [...new Set(perto.slice(0, 10).map(x => x[1]))].slice(0, 4);
    }
    async function destacarMunicipio(cid, feature, seq) {
      camadaDestaque.clearLayers();
      if (!feature) {
        try { const dadosUF = await Malha.carregarUF(cid.uf); feature = Malha.featureDaCidade(cid, dadosUF); } catch (e) { feature = null; }
      }
      // enquanto baixava, o usuário pode ter aberto outro painel ou saído da página
      if (!ativo || (seq != null && seq !== seqPainel) || !feature || painel.hidden) return null;
      camadaDestaque.clearLayers();
      const contorno = L.geoJSON(feature, { pane: 'destaque', interactive: false, style: { color: '#0f172a', weight: 3, opacity: 0.9, dashArray: '7 5', fill: true, fillColor: '#fde047', fillOpacity: 0.08 } });
      camadaDestaque.addLayer(contorno);
      return contorno;
    }
    function fmtInd(chave, v) {
      const ind = IbgeCidade.INDICADORES[chave];
      let txt;
      if (chave === 'pibPerCapita') txt = 'R$ ' + UI.fmtNum(Math.round(v.valor));
      else if (chave === 'area') txt = UI.fmtNum(Math.round(v.valor)) + ' km²';
      else if (chave === 'densidade') txt = v.valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' hab/km²';
      else if (ind.unidade === '%' || ind.unidade === '% da população') txt = UI.fmtPct(v.valor, 1);
      else if (chave === 'salarioMedio') txt = v.valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' salários mín.';
      else txt = UI.fmtNum(Math.round(v.valor)) + (ind.unidade === 'hab.' ? ' hab.' : '');
      return `<div class="ficha-dado" ${ind.ajuda ? `title="${UI.esc(ind.ajuda)}"` : ''}><div class="rotulo">${ind.rotulo} <span class="muted">(${v.ano})</span></div><div class="valor">${txt}</div></div>`;
    }
    async function abrirPainelCidade(cid, { feature = null, codigo = null, fluxosOrigem = null, aproximar = false } = {}) {
      olharCidade(cid.id);
      let meu = ++seqPainel;
      const mudou = () => !ativo || meu !== seqPainel; // outro painel foi aberto (ou a página fechada) no meio do caminho
      const info = corDe(cid.id);
      const g = porOrigem.get(cid.id), a = porAtuacao.get(cid.id);
      const fluxos = fluxosOrigem || (g ? g.fluxos : null);
      const cod = codigo || cid.ibge || null;
      const notasSalvas = Store.infoCidade(cid.id) || {};
      const editar = App.podeEditar();
      // SINE: agência(s) na cidade ou a mais próxima; os campos de anotação vêm pré-preenchidos (editáveis) quando ainda não foram salvos
      const busca = q => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
      if (Store.BASES_SINE.includes(cid.uf) && !Store.fonteBaseSine(cid.uf)) {
        try { await Store.carregarBaseSine(cid.uf); } catch (e) { /* sem a base: segue com o que tem */ }
        if (mudou()) return;
      }
      const sineLocal = Store.sineDaCidade(cid);
      const sinePerto = sineLocal.length ? null : Store.sineMaisProximo(cid);
      const fmtAg = a => `<div class="sine-card"><div class="sine-nome">${UI.esc(a.nome || a.cidade)}${a.cidade && Store.normalizar(a.cidade) !== Store.normalizar(cid.nome) ? ` <span class="muted">· ${UI.esc(a.cidade)}</span>` : ''}</div>
          ${a.endereco ? `<div>${UI.esc(a.endereco)}${a.cep ? ` · CEP ${UI.esc(a.cep)}` : ''}</div>` : ''}
          ${(a.telefones || []).length ? `<div><b>${(a.telefones || []).map(t => `<a href="tel:${t.replace(/\D/g, '')}">${UI.esc(t)}</a>`).join(' · ')}</b></div>` : '<div class="muted">telefone não informado</div>'}
          ${a.email ? `<div><a href="mailto:${UI.esc(a.email)}">${UI.esc(a.email)}</a></div>` : ''}
          ${a.horario ? `<div class="muted small">Atendimento: ${UI.esc(a.horario)}</div>` : ''}
          <div class="small linha" style="gap:10px"><a href="${UI.esc(a.url || '#')}" target="_blank" rel="noopener">página da agência</a>${a.lat != null ? `<a href="https://www.google.com/maps?q=${a.lat},${a.lng}" target="_blank" rel="noopener">ver no Google Maps</a>` : ''}</div></div>`;
      let blocoSine;
      if (sineLocal.length) blocoSine = sineLocal.map(fmtAg).join('');
      else if (sinePerto) blocoSine = `<div class="muted small" style="margin-bottom:4px">Esta cidade não tem agência própria. A mais próxima fica a <b>${UI.fmtKm(sinePerto.distancia)}</b>:</div>` + fmtAg(sinePerto.agencia);
      else {
        const portal = Store.portalSine(cid.uf);
        const temBaseUF = !!Store.coberturaSine()[cid.uf];
        blocoSine = `<div id="sine-online" class="caixa caixa-aviso small" style="margin-top:0">${temBaseUF ? `Nenhuma agência de ${UI.esc(cid.uf)} perto desta cidade na base.` : `Sem base embutida para <b>${UI.esc(Store.UFS[cid.uf] || cid.uf)}</b>.`}
          <span id="sine-online-status"> Buscando na internet…</span>
          <div class="linha" style="gap:8px;margin-top:6px"><a class="btn btn-pequeno" href="${UI.esc(portal.url)}" target="_blank" rel="noopener">${UI.esc(portal.nome)}</a>
          <a class="btn btn-pequeno" href="${busca(`SINE ${cid.nome} ${cid.uf} telefone endereço`)}" target="_blank" rel="noopener">Procurar no Google</a>
          <button class="btn btn-pequeno" id="sine-online-denovo" type="button">Buscar de novo</button></div></div>`;
      }
      const primeira = sineLocal[0] || (sinePerto && sinePerto.distancia <= 60 ? sinePerto.agencia : null);
      const notas = { ...notasSalvas };
      if (primeira && !notas.sineTelefone) notas.sineTelefone = (primeira.telefones || []).join(' / ');
      if (primeira && !notas.sineEndereco) notas.sineEndereco = [primeira.endereco, primeira.cidade && Store.normalizar(primeira.cidade) !== Store.normalizar(cid.nome) ? primeira.cidade : '', primeira.cep ? 'CEP ' + primeira.cep : ''].filter(Boolean).join(' — ');
      const campo = (k, rotulo, placeholder, area) => `<label style="margin-bottom:6px">${rotulo}${area
        ? `<textarea class="ficha-campo" data-k="${k}" rows="2" placeholder="${UI.esc(placeholder)}" ${editar ? '' : 'readonly'}>${UI.esc(notas[k] || '')}</textarea>`
        : `<input class="ficha-campo" data-k="${k}" placeholder="${UI.esc(placeholder)}" value="${UI.esc(notas[k] || '')}" ${editar ? '' : 'readonly'}>`}</label>`;
      painel.innerHTML = cabecalhoPainel(`<span class="ponto-cor" style="background:${info ? info.cor : '#64748b'}"></span>${UI.esc(cid.nome)}/${cid.uf}`,
        info ? `Microrregião <b>${UI.esc(info.micro.nome)}</b> · distrito ${UI.esc(info.distrito.nome)} <a href="#" id="ficha-micro">ver números da microrregião</a>` : 'Cidade fora das microrregiões cadastradas') +
        `<div class="ficha">
          <div class="ficha-secao">Contratações <span class="muted small">no filtro atual · clique para ver quem</span></div>
          <div class="ficha-grade" style="margin-bottom:4px">
            <button class="ficha-dado ficha-botao" id="ficha-ver-atuacao" ${a ? '' : 'disabled'}><div class="rotulo"><span class="marc-atuacao mini"></span>Trabalham aqui</div><div class="valor">${a ? UI.fmtNum(a.total) : 0}</div><div class="muted small">${a ? `vêm de ${new Set(a.fluxos.map(f => f.cidadeOrigem.id)).size} cidade(s) · ver quem` : 'ninguém trabalha aqui'}</div></button>
            <button class="ficha-dado ficha-botao" id="ficha-ver-origem" ${g ? '' : 'disabled'}><div class="rotulo"><span class="bolha-origem mini">&nbsp;</span>São daqui</div><div class="valor">${g ? UI.fmtNum(g.total) : 0}</div><div class="muted small">${g ? `${resumoDestinos(g).replace(/<[^>]+>/g, '')} · ver quem` : 'ninguém contratado daqui'}</div></button>
          </div>
          <div class="ficha-secao">Dados do município <span class="muted small">IBGE</span></div>
          <div class="ficha-grade" id="ficha-ibge"><span class="muted small">Buscando no IBGE…</span></div>
          <div class="muted small" style="margin-top:4px">O IBGE não divulga taxa de desemprego por município: use a % de população ocupada (empregos formais) como referência e confirme no SINE.</div>


          <div class="ficha-secao">SINE / agência de emprego <span class="muted small">${sineLocal.length ? ({ importada: 'planilha importada pelo RH', google: 'achado no Google', osm: 'achado no OpenStreetMap' }[sineLocal[0].origem] || 'base oficial ' + ((Store.fonteBaseSine(cid.uf) || {}).fonte || '').split(' — ')[0]) : (sinePerto ? 'agência mais próxima' : '')}</span></div>
          ${blocoSine}
          <div class="ficha-secao">Anotações do RH <span class="muted small">edite à vontade; fica salvo</span></div>
          <div class="form-linha" style="gap:8px">
            ${campo('sineTelefone', 'Telefone do SINE / agência', '(54) 0000-0000')}
            ${campo('sineEndereco', 'Endereço do SINE', 'Rua, nº — bairro')}
          </div>
          ${campo('canais', 'Onde divulgar vagas', 'Ex.: rádio local, grupo de WhatsApp da prefeitura, mural do SINE, jornal…', true)}
          ${campo('contatos', 'Contatos úteis', 'Ex.: prefeitura, sindicato, escolas técnicas…', true)}
          ${campo('observacoes', 'Observações', 'O que o RH precisa lembrar sobre esta cidade', true)}
          <div class="linha" style="gap:6px;flex-wrap:wrap">
            ${editar ? '<button class="btn btn-primario btn-pequeno" id="ficha-salvar">Salvar anotações</button>' : ''}
            ${notas.atualizadoEm ? `<span class="muted small">atualizado em ${UI.fmtData(notas.atualizadoEm)}${notas.atualizadoPor ? ' por ' + UI.esc(notas.atualizadoPor) : ''}</span>` : ''}
          </div>
          <div class="linha small" style="gap:10px;margin-top:8px;flex-wrap:wrap">
            <a href="#" id="ficha-procurar-candidatos"><b>Procurar candidatos aqui</b></a>
            <a href="${busca(`SINE ${cid.nome} ${cid.uf} telefone endereço`)}" target="_blank" rel="noopener">Procurar SINE</a>
            <a href="${UI.esc(Store.portalSine(cid.uf).url)}" target="_blank" rel="noopener">${UI.esc(Store.portalSine(cid.uf).nome)}</a>
            <a href="${busca(`prefeitura ${cid.nome} ${cid.uf} telefone`)}" target="_blank" rel="noopener">Prefeitura</a>
            <a href="${busca(`rádio ${cid.nome} ${cid.uf}`)}" target="_blank" rel="noopener">Rádios locais</a>
            <a href="${IbgeCidade.urlCidades(cid.nome, cid.uf)}" target="_blank" rel="noopener">IBGE Cidades</a>
          </div>
          ${Store.fonteBaseSine(cid.uf) ? `<div class="muted small" style="margin-top:6px">Agências do SINE: base ${UI.esc(Store.fonteBaseSine(cid.uf).fonte || '')}, de ${UI.esc(Store.fonteBaseSine(cid.uf).atualizadoEm || '')}${Store.fonteBaseSine(cid.uf).parcial ? ' (lista parcial)' : ''}. Confirme por telefone antes de divulgar.</div>` : ''}
        </div>`;
      meu = ligarFechar(); olharCidade(cid.id);
      // sem agência na base: procura na internet (Google Places se houver chave; senão OpenStreetMap) e grava o que achar
      const caixaOnline = painel.querySelector('#sine-online');
      if (caixaOnline) {
        const rodar = async (forcar) => {
          const st = painel.querySelector('#sine-online-status'); if (st) st.textContent = ' Buscando na internet…';
          try {
            const r = await Geo.buscarSineOnline(cid, { forcar });
            if (mudou() || !painel.contains(caixaOnline)) return;
            if (r.agencias.length) { abrirPainelCidade(cid, { feature, codigo, fluxosOrigem, aproximar: false }); UI.toast(`${r.agencias.length} agência(s) encontrada(s) ${r.origem === 'google' ? 'no Google' : 'no OpenStreetMap'} e salva(s) para ${cid.nome}.`, 'sucesso'); }
            else if (st) st.textContent = ' ' + (r.aviso || 'Nada encontrado na internet.') + (Store.config().googleKey ? '' : ' Dica: com a chave do Google Places (em Cidades → Agências do SINE) a busca acha muito mais.');
          } catch (e) { if (st && !mudou()) st.textContent = ' ' + e.message; }
        };
        const bd = painel.querySelector('#sine-online-denovo'); if (bd) bd.addEventListener('click', () => rodar(true));
        rodar(false);
      }
      aplicarFoco([cid.id, ...destinosDe(fluxos), ...(a ? a.fluxos.map(f => f.cidadeOrigem.id) : [])]);
      if (a && !fluxosOrigem) destacarLinhas(linhasPorChave.get('A:' + cid.id) || []);
      const bpc = painel.querySelector('#ficha-procurar-candidatos');
      if (bpc) bpc.addEventListener('click', e => { e.preventDefault(); UI.modalBuscaCandidatos(cid.nome, cid.uf); });
      const bm = painel.querySelector('#ficha-micro');
      if (bm) bm.addEventListener('click', e => { e.preventDefault(); abrirPainelMicro(info.distrito, info.micro); });
      const bva = painel.querySelector('#ficha-ver-atuacao'), bvo = painel.querySelector('#ficha-ver-origem');
      if (bva && a) bva.addEventListener('click', () => selecionarAtuacao(a));
      if (bvo && g) bvo.addEventListener('click', () => selecionarOrigem(g));
      const bs = painel.querySelector('#ficha-salvar');
      if (bs) bs.addEventListener('click', () => {
        const campos = {};
        painel.querySelectorAll('.ficha-campo').forEach(i => { campos[i.dataset.k] = i.value; });
        try { Store.salvarInfoCidade(cid.id, campos, App.usuario); UI.toast('Anotações salvas.', 'sucesso'); }
        catch (e) { UI.toast(e.message, 'erro'); }
      });
      // divisa do município
      const contorno = await destacarMunicipio(cid, feature, meu);
      if (mudou()) return;
      if (aproximar && contorno) mapa.fitBounds(contorno.getBounds().pad(0.4), { maxZoom: 11 });
      // dados do IBGE
      const alvo = painel.querySelector('#ficha-ibge');
      if (!alvo) return;
      if (!cod) { alvo.innerHTML = '<span class="muted small">Sem código IBGE para esta cidade (baixe a lista completa de municípios no menu Cidades).</span>'; return; }
      try {
        const d = await IbgeCidade.dados(cod);
        if (mudou() || !alvo.isConnected) return;
        const chaves = ['populacaoEstimada', 'populacaoCenso', 'area', 'densidade', 'popOcupada', 'salarioMedio', 'rendaMeioSM', 'pibPerCapita'].filter(k => d && d[k]);
        alvo.innerHTML = chaves.length ? chaves.map(k => fmtInd(k, d[k])).join('') : '<span class="muted small">O IBGE não retornou dados para este município.</span>';
      } catch (e) {
        if (!mudou() && alvo.isConnected) alvo.innerHTML = '<span class="muted small">Não foi possível consultar o IBGE agora (sem internet?).</span>';
      }
    }
    // Painel de uma microrregião: números das contratações com atuação nas cidades dela
    // Painel do distrito: contratações de quem trabalha nas cidades dele, por microrregião e por cidade de origem
    function abrirPainelDistrito(d) {
      const ids = new Set(Store.cidadesDoDistrito(d).map(c => c.id));
      const lista = regs.filter(r => r.cidadeAtuacao && ids.has(r.cidadeAtuacao.id));
      const local = lista.filter(r => r.tipo === 'LOCAL').length;
      const propria = lista.filter(r => ids.has(r.cidadeId)).length;
      const dists = lista.map(r => r.distancia).filter(x => x != null);
      const distMedia = dists.length ? dists.reduce((a, b) => a + b, 0) / dists.length : null;
      const unidades = App.silosFiltrados(d.id, '').length;
      const porMicro = (d.micros || []).map(m => {
        const mids = new Set(m.cidadeIds || []);
        const l = lista.filter(r => mids.has(r.cidadeAtuacao.id));
        return { m, total: l.length, local: l.filter(r => r.tipo === 'LOCAL').length, propria: l.filter(r => mids.has(r.cidadeId)).length, origens: new Set(l.map(r => r.cidadeId)).size };
      }).sort((a, b) => b.total - a.total);
      const origens = new Map();
      for (const r of lista) {
        let o = origens.get(r.cidadeId);
        if (!o) { o = { cidade: r.cidade, local: 0, movel: 0, total: 0, foraDoEstado: r.foraDoEstado, dist: r.distancia }; origens.set(r.cidadeId, o); }
        o[r.tipo === 'LOCAL' ? 'local' : 'movel']++; o.total++;
      }
      const filtrado = App.filtros.distritoId === d.id && !App.filtros.microId;
      painel.innerHTML = cabecalhoPainel(`<span class="ponto-cor" style="background:${UI.esc(d.cor)}"></span>Distrito ${UI.esc(d.nome)}`,
        `${(d.micros || []).length} microrregião(ões) · ${ids.size} município(s) · ${unidades} unidade(s) PDR · total pela cidade de atuação`) +
        `<div class="grade" style="grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">
          <div class="card kpi" style="padding:8px 10px"><div class="rotulo">Contratações</div><div class="valor" style="font-size:20px">${UI.fmtNum(lista.length)}</div><div class="sub">${local} local · ${lista.length - local} móvel</div></div>
          <div class="card kpi" style="padding:8px 10px"><div class="rotulo">Moram no distrito</div><div class="valor" style="font-size:20px">${UI.fmtNum(propria)}</div><div class="sub">${UI.fmtPct(lista.length ? propria / lista.length * 100 : 0, 0)} do total</div></div>
          <div class="card kpi" style="padding:8px 10px"><div class="rotulo">Dist. média</div><div class="valor" style="font-size:20px">${UI.fmtKm(distMedia)}</div><div class="sub">${origens.size} cidade(s) de origem</div></div>
        </div>
        <div class="linha" style="gap:6px;margin-bottom:10px">
          <button class="btn btn-pequeno" id="painel-focar">Aproximar</button>
          ${filtrado ? '<span class="badge badge-azul">filtro do topo ativo neste distrito</span>' : `<button class="btn btn-pequeno btn-primario" id="painel-filtrar">Filtrar tudo por este distrito</button>`}
        </div>
        <div class="ficha-secao">Por microrregião</div>` +
        UI.tabela({
          vazio: 'Nenhuma microrregião com contratações.',
          colunas: [
            { titulo: 'Microrregião', render: x => `<a href="#" class="painel-micro" data-m="${x.m.id}"><span class="ponto-cor" style="background:${UI.esc(x.m.cor)}"></span>${UI.esc(x.m.nome)}</a>` },
            { titulo: 'L', classe: 'direita', render: x => x.local },
            { titulo: 'M', classe: 'direita', render: x => x.total - x.local },
            { titulo: 'Total', classe: 'direita', render: x => `<b>${x.total}</b>` },
            { titulo: 'Moram na micro', classe: 'direita', render: x => x.total ? `${x.propria} <span class="muted small">(${UI.fmtPct(x.propria / x.total * 100, 0)})</span>` : '—' }
          ],
          linhas: porMicro
        }) +
        `<div class="ficha-secao">Principais cidades de origem</div>` +
        UI.tabela({
          vazio: 'Nenhuma contratação com atuação neste distrito (no filtro atual).',
          colunas: [
            { titulo: 'Cidade de origem', render: o => `${UI.esc(o.cidade.nome)}/${o.cidade.uf}${ids.has(o.cidade.id) ? ' <span class="badge badge-verde">no distrito</span>' : ''}${o.foraDoEstado ? ' <span class="badge badge-amarelo">fora do estado</span>' : ''}` },
            { titulo: 'L', classe: 'direita', render: o => o.local },
            { titulo: 'M', classe: 'direita', render: o => o.movel },
            { titulo: 'Total', classe: 'direita', render: o => `<b>${o.total}</b>` },
            { titulo: 'Dist.', classe: 'direita', render: o => UI.fmtKm(o.dist) }
          ],
          linhas: [...origens.values()].sort((a, b) => b.total - a.total).slice(0, 30)
        }) + (origens.size > 30 ? `<div class="muted small" style="margin-top:6px">Mostrando as 30 maiores de ${origens.size} cidades de origem.</div>` : '') +
        resumo(`Ver as ${lista.length} pessoas (uma por linha)`, listaPessoas(lista));
      ligarFechar(); ligarListas();
      // bolinhas e linhas de todo o distrito
      destacarLinhas([...ids].flatMap(id => linhasPorChave.get('A:' + id) || []));
      aplicarFoco([...ids, ...lista.map(r => r.cidadeId)]);
      painel.querySelector('#painel-focar').addEventListener('click', () => focar(Store.cidadesDoDistrito(d)));
      const bf = painel.querySelector('#painel-filtrar');
      if (bf) bf.addEventListener('click', () => { App.filtros.distritoId = d.id; App.filtros.microId = ''; App.aoMudarFiltros(); });
      painel.querySelectorAll('.painel-micro').forEach(a => a.addEventListener('click', e => { e.preventDefault(); const m = (d.micros || []).find(x => x.id === a.dataset.m); if (m) abrirPainelMicro(d, m); }));
    }
    function abrirPainelMicro(d, m) {
      const ids = new Set(m.cidadeIds || []);
      const lista = regs.filter(r => r.cidadeAtuacao && ids.has(r.cidadeAtuacao.id));
      const local = lista.filter(r => r.tipo === 'LOCAL').length;
      const propria = lista.filter(r => ids.has(r.cidadeId)).length;
      const dists = lista.map(r => r.distancia).filter(x => x != null);
      const distMedia = dists.length ? dists.reduce((a, b) => a + b, 0) / dists.length : null;
      const unidades = App.silosFiltrados(d.id, m.id).length;
      const origens = new Map();
      for (const r of lista) {
        let o = origens.get(r.cidadeId);
        if (!o) { o = { cidade: r.cidade, local: 0, movel: 0, total: 0, foraDoEstado: r.foraDoEstado, dist: r.distancia }; origens.set(r.cidadeId, o); }
        o[r.tipo === 'LOCAL' ? 'local' : 'movel']++; o.total++;
      }
      const filtrada = App.filtros.microId === m.id;
      painel.innerHTML = cabecalhoPainel(`<span class="ponto-cor" style="background:${UI.esc(m.cor)}"></span>${UI.esc(m.nome)} <span class="muted small" style="font-weight:400">· ${UI.esc(d.nome)}</span>`,
        `${(m.cidadeIds || []).length} município(s) · ${unidades} unidade(s) PDR`) +
        `<div class="grade" style="grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">
          <div class="card kpi" style="padding:8px 10px"><div class="rotulo">Contratações</div><div class="valor" style="font-size:20px">${UI.fmtNum(lista.length)}</div><div class="sub">${local} local · ${lista.length - local} móvel</div></div>
          <div class="card kpi" style="padding:8px 10px"><div class="rotulo">Moram na micro</div><div class="valor" style="font-size:20px">${UI.fmtNum(propria)}</div><div class="sub">${UI.fmtPct(lista.length ? propria / lista.length * 100 : 0, 0)} do total</div></div>
          <div class="card kpi" style="padding:8px 10px"><div class="rotulo">Dist. média</div><div class="valor" style="font-size:20px">${UI.fmtKm(distMedia)}</div><div class="sub">${origens.size} cidade(s) de origem</div></div>
        </div>
        <div class="linha" style="gap:6px;margin-bottom:10px">
          <button class="btn btn-pequeno" id="painel-focar">Aproximar</button>
          ${filtrada ? '<span class="badge badge-azul">filtro do topo ativo nesta microrregião</span>' : `<button class="btn btn-pequeno btn-primario" id="painel-filtrar">Filtrar tudo por esta microrregião</button>`}
        </div>` +
        UI.tabela({
          vazio: 'Nenhuma contratação com atuação nesta microrregião (no filtro atual).',
          colunas: [
            { titulo: 'Cidade de origem', render: o => `${UI.esc(o.cidade.nome)}/${o.cidade.uf}${ids.has(o.cidade.id) ? ' <span class="badge badge-verde">na micro</span>' : ''}${o.foraDoEstado ? ' <span class="badge badge-amarelo">fora do estado</span>' : ''}` },
            { titulo: 'L', classe: 'direita', render: o => o.local },
            { titulo: 'M', classe: 'direita', render: o => o.movel },
            { titulo: 'Total', classe: 'direita', render: o => `<b>${o.total}</b>` },
            { titulo: 'Dist.', classe: 'direita', render: o => UI.fmtKm(o.dist) }
          ],
          linhas: [...origens.values()].sort((a, b) => b.total - a.total).slice(0, 40)
        }) + (origens.size > 40 ? `<div class="muted small" style="margin-top:6px">Mostrando as 40 maiores de ${origens.size} cidades de origem.</div>` : '') +
        resumo(`Ver as ${lista.length} pessoas (uma por linha)`, listaPessoas(lista));
      ligarFechar(); ligarListas();
      destacarLinhas([...ids].flatMap(id => linhasPorChave.get('A:' + id) || []));
      aplicarFoco([...ids, ...lista.map(r => r.cidadeId)]);
      painel.querySelector('#painel-focar').addEventListener('click', () => focar(cidadesDaMicro(m)));
      const bf = painel.querySelector('#painel-filtrar');
      if (bf) bf.addEventListener('click', () => { App.filtros.distritoId = d.id; App.filtros.microId = m.id; App.aoMudarFiltros(); });
    }
    // Linha (visível) sob o ponto clicado. O mapa tem vários canvas empilhados (malha, hubs, destaque…) e o Leaflet só
    // testa as linhas do canvas que recebeu o clique, então o teste é feito aqui, com a tolerância do renderizador.
    function linhaNoPonto(p) {
      let achada = null;
      camadas.linhas.eachLayer(l => { if (l._fluxo && l.options.opacity >= 0.2 && l._containsPoint(p)) achada = l; });
      return achada;
    }
    // clique em qualquer lugar do mapa: numa linha, mostra o trajeto; fora, identifica o município (malha do IBGE) e abre a ficha
    let identificando = false;
    mapa.on('click', async e => {
      const l = e.layerPoint && linhaNoPonto(e.layerPoint);
      if (l) { abrirPainelFluxo(l._fluxo, l); return; }
      fecharPainel();
      if (identificando) return;
      const ufs = ufsDoPonto(e.latlng.lat, e.latlng.lng);
      if (!ufs.length) return; // mar ou fora do Brasil
      identificando = true;
      const seqClique = seqPainel;
      definirStatus('Identificando o município…');
      try {
        const m = await Malha.municipioNoPonto(e.latlng.lat, e.latlng.lng, ufs);
        if (!ativo) return;
        definirStatus('');
        if (!m || seqClique !== seqPainel) return; // o usuário já clicou em outra coisa
        // primeiro pelo código IBGE devolvido pela malha; o nome só se a cidade não tiver código na base
        let cid = cidadePorIbge(m.codigo) || Store.resolverCidade(m.nome, m.uf) || Store.cidadeAproximada(m.nome, m.uf);
        if (!cid) { // cidade ainda não está na base: usa o centro do polígono
          const b = L.geoJSON(m.feature).getBounds().getCenter();
          cid = { id: Store.idCidade(m.nome, m.uf), nome: m.nome, uf: m.uf, lat: b.lat, lng: b.lng, ibge: m.codigo };
        }
        abrirPainelCidade(cid, { feature: m.feature, codigo: m.codigo });
      } catch (err) { if (ativo) definirStatus(''); console.warn(err); }
      finally { identificando = false; }
    });

    // ---------- divisas de todos os municípios da área visível + nome da cidade sob o mouse ----------
    mapa.createPane('divisas').style.zIndex = 345;
    mapa.getPane('divisas').style.pointerEvents = 'none';
    const rendDivisas = L.canvas({ pane: 'divisas' });
    const camadaDivisas = L.layerGroup();
    const divisasPorUF = new Map(); // uf -> camada (null enquanto carrega)
    const ZOOM_MIN_DIVISAS = 7;
    function ufsNaTela() {
      const b = mapa.getBounds().pad(0.05), cont = {};
      for (const c of Store.cidades()) if (b.contains([c.lat, c.lng])) cont[c.uf] = (cont[c.uf] || 0) + 1;
      return Object.keys(cont).sort((a, b2) => cont[b2] - cont[a]).slice(0, 6);
    }
    async function atualizarDivisas() {
      const cx = el.querySelector('#c-divisas');
      if (!ativo || !cx) return;   // saiu da tela do mapa
      const ligada = cx.checked && mapa.getZoom() >= ZOOM_MIN_DIVISAS;
      if (!ligada) { if (mapa.hasLayer(camadaDivisas)) mapa.removeLayer(camadaDivisas); return; }
      if (!mapa.hasLayer(camadaDivisas)) camadaDivisas.addTo(mapa);
      const satelite = el.querySelector('#c-fundo').value === 'satelite';
      const naTela = ufsNaTela();
      // estados que saíram da tela: tira as divisas deles (antes só acumulavam e pesavam o mapa)
      for (const [uf, camada] of divisasPorUF) {
        if (naTela.includes(uf)) continue;
        if (camada) camadaDivisas.removeLayer(camada);
        divisasPorUF.delete(uf);
      }
      for (const uf of naTela) {
        if (divisasPorUF.has(uf)) continue;
        divisasPorUF.set(uf, null);
        try {
          const d = await Malha.carregarUF(uf);
          if (!ativo) return;
          if (!divisasPorUF.has(uf) || divisasPorUF.get(uf)) continue; // saiu da tela (ou foi redesenhada) enquanto carregava
          const camada = L.geoJSON({ type: 'FeatureCollection', features: [...d.features.values()] }, { renderer: rendDivisas, pane: 'divisas', interactive: false,
            style: { color: satelite ? '#ffffff' : '#475569', weight: satelite ? 0.8 : 0.6, opacity: satelite ? 0.6 : 0.5, fill: false } });
          divisasPorUF.set(uf, camada);
          camadaDivisas.addLayer(camada);
        } catch (e) { divisasPorUF.delete(uf); console.warn('Divisas indisponíveis', uf, e); }
      }
    }
    redesenharDivisas = () => { camadaDivisas.clearLayers(); divisasPorUF.clear(); atualizarDivisas(); };
    mapa.on('moveend', atualizarDivisas);
    el.querySelector('#c-divisas').addEventListener('change', e => { atualizarDivisas(); if (e.target.checked && mapa.getZoom() < ZOOM_MIN_DIVISAS) UI.toast('Aproxime o zoom para ver as divisas dos municípios.', 'info', 3500); });
    atualizarDivisas();
    // nome da cidade sob o mouse (só com a malha já carregada: não baixa nada ao mover)
    const hoverEl = el.querySelector('#cidade-hover');
    let ultimoHover = 0, hoverCodigo = '';
    mapa.on('mousemove', e => {
      const agora = Date.now(); if (agora - ultimoHover < 90) return; ultimoHover = agora;
      if (mapa.getZoom() < 6) { hoverEl.hidden = true; hoverCodigo = ''; return; }
      // só testa os estados com malha já carregada (primeiro os que estão na tela); não percorre as 5.570 cidades a cada movimento
      const ufsTeste = [...new Set([...divisasPorUF.keys(), ...Malha.ufsCarregadas()])].filter(uf => Malha.malhaPronta(uf));
      const m = ufsTeste.length ? Malha.municipioNoPontoCarregado(e.latlng.lat, e.latlng.lng, ufsTeste) : null;
      if (!m) { hoverEl.hidden = true; hoverCodigo = ''; return; }
      if (m.codigo === hoverCodigo) return;
      hoverCodigo = m.codigo;
      const c = cidadePorIbge(m.codigo) || Store.resolverCidade(m.nome, m.uf);
      const reg = c ? corDe(c.id) : null;
      hoverEl.innerHTML = `<b>${UI.esc(m.nome)}/${m.uf}</b>${reg ? ' · ' + UI.esc(reg.micro.nome) : ''} <span>clique para abrir a ficha</span>`;
      hoverEl.hidden = false;
    });
    mapa.on('mouseout', () => { hoverEl.hidden = true; hoverCodigo = ''; });

    // ---------- mapa de calor ----------
    function montarCalor() {
      if (camadas.calor) { mapa.removeLayer(camadas.calor); camadas.calor = null; }
      if (!el.querySelector('#c-calor').checked) return;
      if (typeof L.heatLayer !== 'function') { UI.toast('Mapa de calor indisponível (biblioteca não carregou).', 'aviso'); return; }
      const modo = el.querySelector('#c-modo-calor').value;
      const fonte = modo === 'atuacao'
        ? [...porAtuacao.values()].map(a => ({ lat: a.cidade.lat, lng: a.cidade.lng, total: a.total }))
        : [...porOrigem.values()].map(g => ({ lat: g.cidade.lat, lng: g.cidade.lng, total: g.total }));
      if (!fonte.length) { UI.toast(modo === 'atuacao' ? 'Não há cidades de atuação (só atuação móvel) no filtro atual.' : 'Sem dados para o mapa de calor.', 'aviso'); return; }
      const max = Math.max(...fonte.map(x => x.total));
      camadas.calor = L.heatLayer(fonte.map(x => [x.lat, x.lng, x.total / max]), { radius: 35, blur: 25, maxZoom: 9, max: 1.0, minOpacity: 0.35 }).addTo(mapa);
    }

    // ---------- legenda ----------
    const todosSilos = App.silosFiltrados();
    // unidades por mapa PDR com o MESMO filtro do total (antes contava todos os pontos do mapa, sem filtro)
    const silosPorMapa = new Map();
    for (const s of todosSilos) silosPorMapa.set(s.mapaId, (silosPorMapa.get(s.mapaId) || 0) + 1);
    const mapasComSilos = Store.mapasPdr().filter(m => silosPorMapa.get(m.id));
    // projetos que têm contratação no que está sendo mostrado
    const projetosNaTela = projetos.filter(p => regs.some(r => r.projetoId === p.id));
    const legenda = el.querySelector('#legenda');
    const item = (marca, texto) => `<div class="legenda-item">${marca}<span>${texto}</span></div>`;
    const bola = (cor, tam = 12) => `<span class="ponto-cor" style="background:${UI.esc(cor)};width:${tam}px;height:${tam}px"></span>`;
    legenda.innerHTML = `<div class="painel-cab"><b>Legenda</b><span class="linha" style="gap:6px"><button class="btn-link small" id="legenda-ajuda" title="Como ler o mapa">como ler?</button><button class="btn-icone painel-toggle" title="Recolher / expandir" aria-label="Recolher ou expandir a legenda" aria-expanded="true">&#8722;</button></span></div><div class="painel-corpo">` +
      (qtdSemCidade ? `<div class="legenda-aviso small"><b>${UI.fmtNum(qtdSemCidade)}</b> contratação(ões) sem cidade reconhecida não aparecem no mapa. Corrija a cidade no cadastro ou baixe a lista do IBGE em Cidades.</div>` : '') +
      `<div id="legenda-falta" hidden><div class="legenda-secao">Falta contratar (vagas aprovadas)</div><div class="mpn-escala"><span>falta tudo</span><i></i><span>completo</span></div>` +
      item('<span class="rotulo-falta mpn-rot-ex">faltam n (l/m)</span>', 'Distrito pintado pela parte do pedido já admitida; a etiqueta diz quantos faltam (locais/móveis)') + `</div>` +
      `<div class="legenda-secao">Em cada cidade</div>` +
      item('<span class="marc-atuacao mini"><span>n</span></span>', '<b>Trabalham aqui</b> — quantas pessoas trabalham nesta cidade. Clique: quem são e de onde vêm') +
      `<div id="legenda-origens"></div>` +
      `<div class="legenda-secao">Ligações</div>` +
      (projetosNaTela.length ? item(`<span class="legenda-traco" style="color:${UI.esc(projetosNaTela.length === 1 ? projetosNaTela[0].cor : '#475569')}"></span>`, '<b>De onde vêm ➜ onde trabalham</b>, na cor do projeto; a seta aponta para o trabalho. Clique na linha para ver o trajeto') +
        (projetosNaTela.length > 1 ? `<div class="legenda-projetos">${projetosNaTela.map(p => `<span title="${UI.esc(Store.rotuloProjeto(p))}">${bola(p.cor || COR_ATUACAO, 9)}${UI.esc(p.nome)}</span>`).join('')}</div>` : '') : '') +
      (distritos.length ? item('<span class="rotulo-distrito mini"><b>n</b></span>', '<b>Total do distrito</b> — soma de quem trabalha nas cidades dele; clique para ver tudo do distrito') : '') +
      (distritos.length ? `<div id="legenda-sem-contorno" hidden>${item('<span class="legenda-circulo"></span>', '<b>Círculo tracejado</b> — município da microrregião sem contorno do IBGE (marca o centro da cidade)')}</div>` : '') +
      (porHub.size ? item(bola(COR_HUB, 14), '<b>Sem cidade definida (todo o estado)</b> — cadastro antigo MÓVEL, sem cidade de trabalho') : '') +
      (todosSilos.length ? `<div class="legenda-secao">🌾 Unidades PDR (${todosSilos.length})</div>` +
        item(`<span class="silo-grupo" style="background:#16a34a;width:18px;height:18px;border-width:1.5px;box-shadow:none;flex-shrink:0"></span>`, 'Unidade — cor da microrregião da cidade') +
        item(bola(COR_SILO_FORA, 12), 'Fora das microrregiões cadastradas') +
        (mapasComSilos.length > 1 ? mapasComSilos.map(m => item('<span style="width:12px;flex-shrink:0"></span>', `<span class="muted">${UI.esc(m.nome)} (${silosPorMapa.get(m.id)})</span>`)).join('') : '')
      : '') +
      (distritos.length ? `<div class="legenda-secao">Distritos e microrregiões <span style="font-weight:400;text-transform:none;letter-spacing:0">· total pela cidade de atuação · clique para aproximar</span></div>` +
        distritos.map(d =>
          `<a href="#" class="legenda-micro" data-d="${d.id}" style="padding-left:2px;font-weight:600">${bola(d.cor || '#2563eb', 10)}${UI.esc(d.nome)} <span class="muted small" style="font-weight:400">· <b>${UI.fmtNum(totaisDistrito.get(d.id) || 0)}</b> contratações · ${Store.cidadesDoDistrito(d).length} cid</span></a>` +
          (d.micros || []).map(m => `<a href="#" class="legenda-micro" data-d="${d.id}" data-m="${m.id}">${bola(m.cor || d.cor, 9)}${UI.esc(m.nome)} <span class="muted small">· <b>${UI.fmtNum(totaisMicro.get(m.id) || 0)}</b> · ${(m.cidadeIds || []).length} cid</span></a>`).join('')
        ).join('') : '') +
      `<div class="muted small" style="margin-top:6px;border-top:1px solid var(--borda);padding-top:5px">${UI.esc(App.descricaoFiltro())}<br>${UI.fmtNum(regs.length)} contratação(ões) no mapa · ${porOrigem.size} cid. de origem</div></div>`;
    function atualizarLegendaOrigens() {
      const alvo = el.querySelector('#legenda-origens');
      if (!alvo) return;
      if (estilo === 'pintar') {
        // faixas fixas (todas as origens), começando no menor valor real: nenhuma fica vazia
        const faixas = [];
        let ini = minOrigem;
        cortesCoropleto.forEach(c => { faixas.push(ini === c ? `${c}` : `${ini}–${c}`); ini = c + 1; });
        faixas.push(ini >= maxOrigem ? `${maxOrigem}` : `${ini}–${maxOrigem}`);
        alvo.innerHTML = item(bola(COR_ORIGEM, 12), '<b>De onde vêm</b> (cidade de origem) — município pintado, pessoas por cidade:') +
          `<div class="legenda-item" style="gap:4px;flex-wrap:wrap;padding-left:20px">${faixas.map((f, i) => `<span class="legenda-faixa${i < 2 ? ' faixa-clara' : ''}" style="background:${COR_CLASSES[Math.min(i, COR_CLASSES.length - 1)]}">${f}</span>`).join('')}</div>`;
      } else if (estilo === 'pontos') {
        alvo.innerHTML = item(bola(COR_ORIGEM, 10), '<b>De onde vêm</b> (cidade de origem) — a quantidade aparece ao passar o mouse');
      } else {
        alvo.innerHTML = item(`<span class="bolha-origem" style="width:20px;height:20px;line-height:17px;font-size:10px;flex-shrink:0">n</span>`, '<b>São daqui</b> — quantas pessoas contratadas são desta cidade (as linhas partem daqui). Clique: quem são e onde trabalham');
      }
    }
    atualizarLegendaOrigens();
    // "Como ler o mapa": explicação curta dos símbolos e do que cada clique faz
    legenda.querySelector('#legenda-ajuda').addEventListener('click', () => {
      const simb = (marca, titulo, texto) => `<div class="legenda-item" style="align-items:flex-start;margin-bottom:10px"><span style="width:26px;display:flex;justify-content:center;flex-shrink:0;padding-top:2px">${marca}</span><span><b>${titulo}</b><br><span class="muted">${texto}</span></span></div>`;
      UI.modal({
        titulo: 'Como ler o mapa', largura: '620px',
        corpo: `<p class="muted small" style="margin-top:0">Cada pessoa contratada tem uma <b>cidade de onde vem</b> (origem) e uma <b>cidade onde trabalha</b> (atuação). O mapa mostra as duas coisas com símbolos diferentes; o número de cada símbolo é sempre <b>quantidade de pessoas</b>, e clicando aparece a lista dessas pessoas, uma por linha.</p>` +
          simb('<span class="marc-atuacao mini" style="margin:0"><span>n</span></span>', 'Losango azul — trabalham aqui', 'O número é quantas pessoas trabalham nesta cidade. Clique: a lista dessas pessoas, uma por linha, com a cidade de onde cada uma vem.') +
          simb('<span class="bolha-origem" style="width:20px;height:20px;line-height:17px;font-size:10px">n</span>', 'Bola laranja — são daqui', 'O número é quantas pessoas contratadas são desta cidade (moram / vieram daqui). Clique: a lista delas com a cidade onde cada uma trabalha. Uma mesma pessoa aparece na bola laranja da cidade de onde vem e no losango azul da cidade onde trabalha.') +
          simb('<span class="legenda-traco" style="color:#dc2626;width:22px"></span>', 'Linha com seta — o trajeto', 'Sai da bola laranja (de onde vêm) e a seta aponta para o losango azul (onde trabalham). O número no balão é quantas pessoas fazem esse trajeto. Clique: a lista delas, com os dois pontos enquadrados no mapa.') +
          simb('<span class="rotulo-distrito mini" style="margin:0"><b>n</b></span>', 'Etiqueta azul — total do distrito', 'Soma de todos os losangos (quem trabalha) nas cidades do distrito. Clique: painel do distrito com as bolas e linhas dele. O nome de cada microrregião também mostra o total dela e é clicável.') +
          `<p class="muted small" style="margin-bottom:0">Com muita gente, cidades de origem vizinhas viram uma bola só (laranja escura) — aproxime o zoom para separar. Por padrão as linhas só aparecem para a cidade clicada; mude em "Linhas" no painel do mapa. Clique em qualquer município (mesmo sem contratação) para abrir a ficha dele: IBGE, SINE e anotações do RH.</p>`,
        botoes: [{ texto: 'Entendi', classe: 'btn-primario' }]
      });
    });
    // painéis recolhíveis (estado lembrado na sessão)
    // em tela estreita (celular, < 900px) começam recolhidos, até o usuário abrir
    const telaEstreita = () => !!(window.matchMedia && window.matchMedia('(max-width: 900px)').matches);
    for (const painelEl of [el.querySelector('#controles'), legenda]) {
      const chave = 'maparh:mapa-recolhido:' + painelEl.id;
      const aplicar = () => {
        const salvo = sessionStorage.getItem(chave);
        const rec = salvo === null ? telaEstreita() : salvo === '1';
        const bt = painelEl.querySelector('.painel-toggle');
        painelEl.classList.toggle('painel-recolhido', rec);
        bt.innerHTML = rec ? '&#43;' : '&#8722;';
        bt.setAttribute('aria-expanded', rec ? 'false' : 'true');
      };
      painelEl.querySelector('.painel-toggle').addEventListener('click', () => { sessionStorage.setItem(chave, painelEl.classList.contains('painel-recolhido') ? '0' : '1'); aplicar(); });
      aplicar();
    }
    legenda.querySelectorAll('.legenda-micro').forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      const d = Store.distrito(a.dataset.d);
      if (!d) return;
      const m = a.dataset.m ? (d.micros || []).find(x => x.id === a.dataset.m) : null;
      focar(m ? cidadesDaMicro(m) : Store.cidadesDoDistrito(d));
      if (m) abrirPainelMicro(d, m); else abrirPainelDistrito(d);
    }));

    // ---------- controles ----------
    // Popular opções de mapas de silos
    const selectMapas = el.querySelector('#mapa-filtro-silos-mapa');
    if (selectMapas) {
      const mapas = Store.mapasPdr();
      selectMapas.innerHTML = '<option value="">Todos os mapas (' + todosSilos.length + ' unidades)</option>' +
        mapasComSilos.map(m => `<option value="${UI.esc(m.id)}">${UI.esc(m.nome)} (${silosPorMapa.get(m.id)})</option>`).join('');
      selectMapas.hidden = mapasComSilos.length < 2;
      selectMapas.addEventListener('change', renderSilos);
    }
    el.querySelector('#c-silos').addEventListener('change', renderSilos);

    const ligar = (id, camada) => el.querySelector(id).addEventListener('change', e => { if (e.target.checked) camada.addTo(mapa); else mapa.removeLayer(camada); });
    ligar('#c-atuacao', camadas.atuacao); ligar('#c-origens', camadas.origens); ligar('#c-limites', camadas.limites);
    function atualizarCamadaDistritos() {
      const on = el.querySelector('#c-distritos').checked, rot = el.querySelector('#c-rotulos').checked;
      if (on) camadas.distritos.addTo(mapa); else mapa.removeLayer(camadas.distritos);
      if (on && rot) { camadaRotulos.addTo(mapa); ajustarRotulos(); } else mapa.removeLayer(camadaRotulos);
      el.querySelector('#c-rotulos').disabled = !on;
    }
    el.querySelector('#c-distritos').addEventListener('change', atualizarCamadaDistritos);
    el.querySelector('#c-rotulos').addEventListener('change', atualizarCamadaDistritos);
    // totais por distrito: quem não quer as etiquetas azuis desmarca (fica lembrado neste navegador)
    { const cb = el.querySelector('#c-tot-dist'); try { if (localStorage.getItem('maparh:mapa-tot-dist') === '0') cb.checked = false; } catch (e) { /* ok */ }
      cb.addEventListener('change', () => { try { localStorage.setItem('maparh:mapa-tot-dist', cb.checked ? '1' : '0'); } catch (e) { /* ok */ } ajustarRotulos(); });
      if (!cb.checked) setTimeout(ajustarRotulos, 0); }
    el.querySelector('#c-calor').addEventListener('change', e => { el.querySelector('#c-modo-calor').hidden = !e.target.checked; montarCalor(); });
    el.querySelector('#c-modo-calor').addEventListener('change', montarCalor);
    // Lembra o que ficou ligado/desligado em "Mostrar no mapa" (ex.: unidades PDR), para não ter que desmarcar toda vez
    const CHAVE_CAMADAS = 'maparh:mapa-camadas';
    const caixasCamadas = [...el.querySelectorAll('#controles input[type=checkbox][id^="c-"]')];
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE_CAMADAS) || '{}');
      for (const cb of caixasCamadas) if (cb.id in salvo && cb.checked !== !!salvo[cb.id] && !cb.disabled) { cb.checked = !!salvo[cb.id]; cb.dispatchEvent(new Event('change')); }
    } catch (e) { /* estado salvo inválido: ignora */ }
    caixasCamadas.forEach(cb => cb.addEventListener('change', () => {
      const estado = {}; caixasCamadas.forEach(c => { estado[c.id] = c.checked; });
      localStorage.setItem(CHAVE_CAMADAS, JSON.stringify(estado));
    }));
    // grupos do painel (Pessoas, Vagas, Regiões…): lembra quais ficaram abertos e mostra quantas opções estão ligadas em cada um
    {
      const CH = 'maparh:mapa-grupos'; let salvo = {};
      try { salvo = JSON.parse(localStorage.getItem(CH) || '{}') || {}; } catch (e) { salvo = {}; }
      const grupos = [...el.querySelectorAll('#controles details[data-g]')];
      const contarLigados = () => {
        for (const g of grupos) { if (!g.hasAttribute('data-conta')) continue; const cbs = [...g.querySelectorAll('input[type=checkbox]')]; g.querySelector('summary small').textContent = `${cbs.filter(c => c.checked).length} de ${cbs.length}`; }
        const sf = el.querySelector('#c-fundo'), selo = el.querySelector('#c-fundo-selo'); if (selo && sf.selectedOptions[0]) selo.textContent = sf.selectedOptions[0].textContent.split(' (')[0].toLowerCase();
      };
      for (const g of grupos) {
        if (g.dataset.g in salvo) g.open = !!salvo[g.dataset.g];
        g.addEventListener('toggle', () => { salvo[g.dataset.g] = g.open; try { localStorage.setItem(CH, JSON.stringify(salvo)); } catch (e) { /* ok */ } });
      }
      el.querySelector('#controles').addEventListener('change', contarLigados); contarLigados();
    }
    function ajustar() { if (pontos.length) mapa.fitBounds(L.latLngBounds(pontos).pad(0.15), { maxZoom: 9 }); }
    // enquadramento inicial: distritos + cidades onde as contratações trabalham + origens dentro dos estados do projeto.
    // Origens de fora do estado ficam de fora para não "encolher" o mapa (o botão "Ajustar zoom" mostra tudo).
    function enquadrarInicial() {
      const base = pontosDistritos.slice();
      for (const a of porAtuacao.values()) base.push([a.cidade.lat, a.cidade.lng]);
      for (const g of porOrigem.values()) if (g.fluxos.some(f => !f.foraDoEstado)) base.push([g.cidade.lat, g.cidade.lng]);
      if (!base.length) for (const h of porHub.values()) base.push([h.lat, h.lng]);
      const lista = base.length ? base : (pontosFoco.length ? pontosFoco : pontos);
      if (lista.length) mapa.fitBounds(L.latLngBounds(lista).pad(0.15), { maxZoom: 10 });
    }
    el.querySelector('#c-ajustar').addEventListener('click', ajustar);
    el.querySelector('#c-brasil').addEventListener('click', () => mapa.setView([-15.5, -52], 4));
    // resumo do filtro atual no canto do mapa
    const kpis = el.querySelector('#mapa-kpis');
    {
      const r = Analise.resumo(regs);
      const reg = App.regiaoFiltrada();
      const chip = (v, t) => `<span class="kpi-chip"><b>${v}</b> ${t}</span>`;
      kpis.innerHTML = (reg.micro || reg.distrito ? `<span class="kpi-chip kpi-chip-regiao">${UI.esc(reg.micro ? reg.micro.nome : reg.distrito.nome)}</span>` : '') +
        chip(UI.fmtNum(r.total), 'contratações') + (r.total ? chip(UI.fmtPct(r.pctLocal, 0), 'local') : '') +
        chip(UI.fmtNum(r.cidadesOrigem), 'cidades de origem') + (r.distMedia != null ? chip(UI.fmtKm(r.distMedia), 'dist. média') : '') +
        (todosSilos.length ? chip(UI.fmtNum(todosSilos.length), 'unidades') : '') +
        (qtdSemCidade ? `<span class="kpi-chip kpi-chip-aviso" title="Essas contratações não têm cidade reconhecida e não aparecem no mapa"><b>${UI.fmtNum(qtdSemCidade)}</b> sem cidade (fora do mapa)</span>` : '');
    }
    // localizar cidade
    const buscaCidade = el.querySelector('#c-busca-cidade');
    let marcadorBusca = null;
    UI.autocompleteCidade(buscaCidade, {
      aoSelecionar(c) {
        if (marcadorBusca) mapa.removeLayer(marcadorBusca);
        marcadorBusca = L.circleMarker([c.lat, c.lng], { radius: 14, color: '#0f172a', weight: 2, fillColor: '#fde047', fillOpacity: 0.6, pane: 'rotulos' })
          .bindTooltip(balao({ titulo: `${UI.esc(c.nome)}/${c.uf}`, tipo: 'cidade localizada' }), { ...TT, permanent: true }).addTo(mapa);
        mapa.setView([c.lat, c.lng], Math.max(mapa.getZoom(), 10));
        buscaCidade.value = '';
        const esteMarcador = marcadorBusca;
        setTimeout(() => { if (!ativo || marcadorBusca !== esteMarcador) return; mapa.removeLayer(marcadorBusca); marcadorBusca = null; }, 8000);
        abrirPainelCidade(c, { aproximar: true });
      }
    });
    // tela cheia
    const wrap = el.querySelector('.mapa-wrap');
    el.querySelector('#c-tela-cheia').addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen(); else if (wrap.requestFullscreen) wrap.requestFullscreen();
    });
    document.addEventListener('fullscreenchange', aoMudarTelaCheia);
    function aoMudarTelaCheia() { if (!ativo) return; el.querySelector('#c-tela-cheia').textContent = document.fullscreenElement ? 'Sair da tela cheia' : 'Tela cheia'; setTimeout(() => { if (ativo) mapa.invalidateSize(); }, 100); }
    [el.querySelector('.mapa-controles'), legenda, painel, kpis].forEach(x => { L.DomEvent.disableClickPropagation(x); L.DomEvent.disableScrollPropagation(x); });

    // Renderizar silos inicialmente
    renderSilos();

    // Um único tratador de zoom, no próximo quadro de animação (antes eram 5 tratadores separados redesenhando cada um)
    let rafZoom = 0;
    mapa.on('zoomend', () => {
      if (rafZoom) cancelAnimationFrame(rafZoom);
      rafZoom = requestAnimationFrame(() => {
        rafZoom = 0;
        if (!ativo) return;
        if (estilo === 'bolhas') desenharOrigens();
        renderSilos();
        if (el.querySelector('#c-sine').checked) montarCamadaSine();
        atualizarSetas();
        ajustarRotulos();
      });
    });

    let focoInicial = null;
    try { focoInicial = JSON.parse(sessionStorage.getItem('maparh:mapa-foco') || 'null'); } catch (e) { focoInicial = null; }
    sessionStorage.removeItem('maparh:mapa-foco');
    const distritoFoco = focoInicial && focoInicial.distritoId ? Store.distrito(focoInicial.distritoId) : null;
    setTimeout(() => {
      if (!ativo) return; // saiu da página antes do mapa terminar de abrir
      mapa.invalidateSize();
      const cidadeFoco = focoInicial && focoInicial.cidadeId ? Store.cidade(focoInicial.cidadeId) : null;
      if (distritoFoco && Store.cidadesDoDistrito(distritoFoco).length) focar(Store.cidadesDoDistrito(distritoFoco));
      else if (cidadeFoco) { mapa.setView([cidadeFoco.lat, cidadeFoco.lng], 10); abrirPainelCidade(cidadeFoco, { aproximar: false }); }
      else enquadrarInicial();
      // vindo de Distritos ("Mapa" do distrito / da micro) ou com micro filtrada no topo: já abre o painel dela
      const microFocoId = (focoInicial && focoInicial.microId) || App.filtros.microId;
      if (microFocoId) {
        const dm = distritos.map(d => [d, (d.micros || []).find(x => x.id === microFocoId)]).find(([, x]) => x);
        if (dm) { const cs = (dm[1].cidadeIds || []).map(id => Store.cidade(id)).filter(Boolean); if (cs.length) focar(cs); abrirPainelMicro(dm[0], dm[1]); }
      } else if (distritoFoco && focoInicial.abrirPainel) abrirPainelDistrito(distritoFoco);
    }, 50);
    if (!regs.length && !todosSilos.length && !distritos.length) {
      UI.toast(Store.projetos().length ? 'Nenhuma contratação para o filtro atual.' : 'Cadastre um projeto e as contratações para ver o mapa.', 'aviso');
    }

    return () => {
      ativo = false;
      document.removeEventListener('maparh:presenca', aoPresenca);
      if (rafZoom) cancelAnimationFrame(rafZoom);
      document.removeEventListener('fullscreenchange', aoMudarTelaCheia);
      document.removeEventListener('keydown', aoTeclar);
      mapa.remove(); App.mapaAtual = null;
    };
  }
};
