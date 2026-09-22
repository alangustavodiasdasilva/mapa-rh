Paginas.mapa = {
  titulo: 'Mapa',
  render(el) {
    el.innerHTML = `
      <div class="mapa-wrap">
        <div id="mapa"></div>
        <div class="card mapa-controles nao-imprimir" id="controles">
          <div class="painel-cab"><b>Mostrar no mapa</b><button class="btn-icone painel-toggle" title="Recolher / expandir">&#8722;</button></div>
          <div class="painel-corpo">
          <p class="muted small" style="margin:0 0 8px">Os filtros do topo escolhem <b>quais contratações</b> entram. Aqui você liga e desliga <b>o que aparece</b>.</p>
          <div style="margin-bottom:8px"><input id="c-busca-cidade" placeholder="Localizar cidade no mapa…" autocomplete="off" style="font-size:12px;padding:5px 8px"></div>
          <div class="linha" style="gap:6px;margin-bottom:8px;flex-wrap:nowrap"><span class="muted small" style="white-space:nowrap">Fundo:</span>
            <select id="c-fundo" style="font-size:12px;padding:3px 6px">
              <option value="claro">Claro (limpo)</option>
              <option value="ruas">Ruas (OpenStreetMap)</option>
              <option value="satelite">Satélite</option>
            </select></div>
          <label title="Cidade de atuação: onde a pessoa trabalha (losango azul; o total aparece no distrito)"><input type="checkbox" id="c-atuacao" checked> <span class="marc-atuacao mini"><span></span></span>Onde trabalham <span class="muted small">(atuação)</span></label>
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
          <label title="Municípios pintados com o tom da microrregião"><input type="checkbox" id="c-distritos" checked> <span class="ponto-cor" style="background:#16a34a"></span>Microrregiões (malha)</label>
          <label class="sub"><input type="checkbox" id="c-rotulos" checked> Nomes das microrregiões</label>
          <label title="Unidades importadas dos mapas KML, na cor da microrregião"><input type="checkbox" id="c-silos" checked> 🌾 Unidades PDR (<span id="qtd-silos">0</span>)</label>
          <select id="mapa-filtro-silos-mapa" class="sub" style="width:calc(100% - 18px);font-size:11px;padding:2px 4px" hidden>
            <option value="">Todos os mapas</option>
          </select>
          <label><input type="checkbox" id="c-limites" checked> Limite do estado</label>
          <label id="c-sine-wrap" title="Agências FGTAS/Sine do RS (endereço e telefone na ficha da cidade)"><input type="checkbox" id="c-sine"> <span class="sine-mini">S</span>Agências do SINE (<span id="qtd-sine">0</span>)</label>
          <div class="secao">Linhas: de onde vêm → onde trabalham</div>
          <select id="c-modo-linhas">
            <option value="selecionada">Só da cidade que eu clicar</option>
            <option value="todas">Todas as linhas</option>
            <option value="nenhuma">Nenhuma linha</option>
          </select>
          <div class="muted small" id="c-aviso-linhas" style="margin-top:4px"></div>
          <div class="secao">Mapa de calor</div>
          <label><input type="checkbox" id="c-calor"> Ligar mapa de calor</label>
          <select id="c-modo-calor" class="sub" style="width:calc(100% - 18px)" hidden>
            <option value="origem">Concentração por cidade de origem</option>
            <option value="atuacao">Concentração por cidade de atuação</option>
          </select>
          <div class="linha mt" style="gap:6px">
            <button class="btn btn-pequeno" id="c-ajustar" title="Enquadrar tudo, inclusive origens distantes">Ajustar zoom</button>
            <button class="btn btn-pequeno" id="c-brasil">Ver Brasil</button>
            <button class="btn btn-pequeno" id="c-tela-cheia" title="Mapa ocupando a tela inteira (Esc para sair)">Tela cheia</button>
          </div>
          </div>
        </div>
        <div class="card mapa-legenda nao-imprimir" id="legenda"></div>
        <div class="malha-status nao-imprimir" id="malha-status" hidden></div>
        <div class="mapa-kpis nao-imprimir" id="mapa-kpis"></div>
        <div class="card mapa-painel" id="painel" hidden></div>
      </div>`;

    if (typeof L === 'undefined') {
      el.querySelector('#mapa').innerHTML = '<div class="mapa-aviso">O mapa precisa de conexão com a internet para carregar. Verifique a conexão e recarregue a página.</div>';
      return;
    }

    const regs = App.regs();
    const fluxos = Analise.fluxos(regs);
    const projetos = App.projetosVisiveis().filter(p => !App.filtros.projetoId || p.id === App.filtros.projetoId);
    const COR_ATUACAO = '#1d4ed8', COR_ORIGEM = '#ea580c', COR_HUB = '#7c3aed';

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
      satelite: () => L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imagens &copy; Esri, Maxar, Earthstar Geographics' })
    };
    let fundoAtual = null;
    function definirFundo(nome) {
      if (!FUNDOS[nome]) nome = 'claro';
      if (fundoAtual) mapa.removeLayer(fundoAtual);
      fundoAtual = FUNDOS[nome]().addTo(mapa);
      localStorage.setItem('maparh:mapa-fundo', nome);
      el.querySelector('#c-fundo').value = nome;
    }
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
        if (!h) { const c = Store.UF_CENTRO[f.uf] || [-15.5, -52]; h = { uf: f.uf, lat: c[0], lng: c[1], total: 0, local: 0, movel: 0, fluxos: [], projetos: new Set() }; porHub.set(f.uf, h); }
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
    const ladoAtuacao = () => Math.round(20 * fator()); // losango da cidade de atuação (sem número: o total fica no distrito)
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
    for (const f of fluxos) {
      const destino = f.atuacaoMovel ? porHub.get(f.uf) : f.cidadeAtuacao;
      if (!f.atuacaoMovel && f.cidadeAtuacao.id === f.cidadeOrigem.id) continue;
      const infoCor = f.cidadeAtuacao ? Store.corDaCidade(f.cidadeAtuacao.id) : null;
      const corLinha = f.projeto.cor || COR_ATUACAO;
      const rotuloDistrito = infoCor ? ` (${UI.esc(infoCor.distrito.nome)}${infoCor.micro ? ' · ' + UI.esc(infoCor.micro.nome) : ''})` : '';
      const linha = L.polyline(curva(destino, f.cidadeOrigem), {
        color: corLinha, weight: 1.5 + Math.log2(f.total + 1) * 1.2, opacity: 0.65, dashArray: f.atuacaoMovel ? '6 6' : null
      }).bindTooltip(`<b>${UI.esc(f.projeto.nome)}</b><br>Vêm de <b>${UI.esc(f.cidadeOrigem.nome)}/${f.cidadeOrigem.uf}</b> ➜ trabalham em <b>${UI.esc(Analise.rotuloAtuacao(f))}</b>${rotuloDistrito}<br>${f.total} contratação(ões) · ${f.local} local · ${f.movel} móvel${f.dist != null ? ' · ' + UI.fmtKm(f.dist) : ''}`, { sticky: true });
      linha._fluxo = f; linha._destino = destino;
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
      const ll = mapa.layerPointToLatLng(mapa.latLngToLayerPoint([o.lat, o.lng]).add([d, -d]));
      return { lat: ll.lat, lng: ll.lng };
    }
    function criarSeta(l) {
      const f = l._fluxo, pts = l.getLatLngs();
      const recuo = (f.atuacaoMovel ? raioAtuacao((porHub.get(f.uf) || { total: 1 }).total) : ladoAtuacao() * 0.71) + 8;
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
    mapa.on('zoomend', atualizarSetas);
    aplicarModoLinhas(); atualizarAvisoLinhas();

    // ---------- marcadores de origem: agrupados conforme o zoom ----------
    // Cidades de origem que ficariam sobrepostas no zoom atual viram uma única bolha com o total;
    // ao aproximar o zoom elas se separam. A bolha fica sobre a cidade com mais contratações do grupo.
    // Ordem de empilhamento: malha (350) < unidades PDR (410) < cidades de atuação (430) < bolhas de origem (440) < nomes das microrregiões (450)
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
    function selecionarOrigem(g) { abrirPainelCidade(g.cidade, { fluxosOrigem: g.fluxos }); destacarLinhas(linhasPorChave.get('O:' + g.cidade.id) || []); }
    const COR_CLASSES = ['#fed7aa', '#fdba74', '#fb923c', '#ea580c', '#9a3412'];
    let cortesCoropleto = [];
    function classeDe(n) { let k = 0; for (const c of cortesCoropleto) if (n > c) k++; return Math.min(k, COR_CLASSES.length - 1); }
    mapa.createPane('coropleto').style.zIndex = 360;
    let versaoCoropleto = 0;
    // Municípios de origem pintados pela quantidade de contratações (classes por quantis)
    async function desenharCoropleto() {
      const versao = ++versaoCoropleto;
      const origens = [...porOrigem.values()].filter(g => !foco || foco.has(g.cidade.id));
      if (!origens.length) return;
      const totais = origens.map(g => g.total).sort((a, b) => a - b);
      const q = f => totais[Math.min(totais.length - 1, Math.floor(f * totais.length))];
      cortesCoropleto = [...new Set([q(0.2), q(0.4), q(0.6), q(0.8)])];
      atualizarLegendaOrigens();
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
    // Cidade que é origem E atuação: a marca de origem fica encostada no canto do losango, em vez de por cima dele
    function deslocamentoOrigem(cidadeId, r) {
      const a = porAtuacao.get(cidadeId);
      if (!a) return 0;
      const meiaDiagonal = ladoAtuacao() * 0.71;
      return Math.round((meiaDiagonal + r) * 0.72);
    }
    // "X trabalham na própria cidade · Y foram para outra(s) cidade(s)" — para o balão da bolha laranja
    function resumoDestinos(g) {
      const proprias = g.fluxos.filter(f => !f.atuacaoMovel && f.cidadeAtuacao.id === g.cidade.id).reduce((n, f) => n + f.total, 0);
      const foram = g.total - proprias, destinos = g.fluxos.filter(f => f.atuacaoMovel || f.cidadeAtuacao.id !== g.cidade.id).length;
      return `${foram ? `<b>${foram}</b> foram trabalhar em outro lugar (${destinos} destino${destinos === 1 ? '' : 's'})` : 'ninguém foi para outra cidade'}${proprias ? ` · ${proprias} trabalham na própria cidade` : ''}`;
    }
    function desenharOrigens() {
      camadas.origens.clearLayers();
      if (estilo === 'pintar') { desenharCoropleto(); return; }
      if (estilo === 'pontos') {
        for (const g of porOrigem.values()) {
          if (foco && !foco.has(g.cidade.id)) continue;
          const rp = Math.round(4 * fator() + 2), dp = deslocamentoOrigem(g.cidade.id, rp);
          const m = dp
            ? L.marker([g.cidade.lat, g.cidade.lng], { pane: 'origens', keyboard: false, icon: L.divIcon({ className: 'bolha-origem-wrap', html: `<div class="bolha-origem encostada" style="width:${2 * rp}px;height:${2 * rp}px"></div>`, iconSize: [2 * rp, 2 * rp], iconAnchor: [rp - dp, rp + dp] }) })
            : L.circleMarker([g.cidade.lat, g.cidade.lng], { pane: 'origens', radius: rp, color: '#fff', weight: 1.5, fillColor: COR_ORIGEM, fillOpacity: 0.95 });
          m.bindTooltip(balao({ cor: COR_ORIGEM, titulo: `${UI.esc(g.cidade.nome)}/${g.cidade.uf}`, tipo: 'de onde vêm', sub: resumoDestinos(g), total: g.total, local: g.local, movel: g.movel, dica: 'clique para ver para onde foram' }), TT);
          m.on('click', () => selecionarOrigem(g));
          camadas.origens.addLayer(m);
        }
        return;
      }
      for (const gr of agruparOrigens()) {
        const r = Math.round(raioOrigem(gr.total));
        const varias = gr.itens.length > 1;
        const desloc = deslocamentoOrigem(gr.cidade.id, r); // evita cobrir o losango da cidade de atuação
        const icone = L.divIcon({ className: 'bolha-origem-wrap', html: `<div class="bolha-origem${varias ? ' varias' : ''}${desloc ? ' encostada' : ''}" style="width:${2 * r}px;height:${2 * r}px;line-height:${2 * r - 3}px;font-size:${r >= 12 ? 11 : 9}px">${gr.total}</div>`, iconSize: [2 * r, 2 * r], iconAnchor: [r - desloc, r + desloc] });
        const tip = varias
          ? balao({ cor: COR_ORIGEM, titulo: `${gr.itens.length} cidades de origem`, tipo: 'de onde vêm · agrupadas', sub: gr.itens.slice(0, 5).map(g => `${UI.esc(g.cidade.nome)}/${g.cidade.uf} (${g.total})`).join(' · ') + (gr.itens.length > 5 ? ' …' : ''), total: gr.total, local: gr.local, movel: gr.movel, dica: 'aproxime o zoom para separar · clique para ver a lista' })
          : balao({ cor: COR_ORIGEM, titulo: `${UI.esc(gr.cidade.nome)}/${gr.cidade.uf}`, tipo: 'de onde vêm', sub: resumoDestinos(gr.itens[0]), total: gr.total, local: gr.local, movel: gr.movel, dica: 'clique para ver para onde foram' });
        const m = L.marker([gr.cidade.lat, gr.cidade.lng], { icon: icone, pane: 'origens', keyboard: false }).bindTooltip(tip, { ...TT, offset: [0, -r - 2] });
        m.on('click', () => varias ? abrirPainelGrupoOrigem(gr) : selecionarOrigem(gr.itens[0]));
        camadas.origens.addLayer(m);
      }
    }
    mapa.on('zoomend', () => { if (estilo === 'bolhas') desenharOrigens(); });
    desenharOrigens();

    const marcadoresHub = new Map(), marcadoresAtuacao = new Map();
    for (const h of porHub.values()) {
      pontos.push([h.lat, h.lng]); pontosFoco.push([h.lat, h.lng]);
      const m = L.circleMarker([h.lat, h.lng], { pane: 'atuacao', radius: raioAtuacao(h.total), color: COR_HUB, weight: 2, dashArray: '4 3', fillColor: COR_HUB, fillOpacity: 0.35 })
        .bindTooltip(balao({ cor: COR_HUB, titulo: `${h.uf} — ${UI.esc(Store.UFS[h.uf] || h.uf)}`, tipo: 'atuação móvel', sub: 'podem atuar em qualquer lugar do estado', total: h.total, local: h.local, movel: h.movel }), TT);
      m.on('click', () => { abrirPainelHub(h); destacarLinhas(linhasPorChave.get('H:' + h.uf) || []); });
      m._total = h.total;
      marcadoresHub.set('H:' + h.uf, m);
      camadas.hubs.addLayer(m);
    }
    for (const a of porAtuacao.values()) {
      pontos.push([a.cidade.lat, a.cidade.lng]); pontosFoco.push([a.cidade.lat, a.cidade.lng]);
      const infoCor = Store.corDaCidade(a.cidade.id);
      const corMarcador = COR_ATUACAO;
      const rotuloDist = infoCor ? `<br><span class="muted small">${UI.esc(infoCor.distrito.nome)}${infoCor.micro ? ' · ' + UI.esc(infoCor.micro.nome) : ''}</span>` : '';
      const m = L.marker([a.cidade.lat, a.cidade.lng], { icon: iconeAtuacao(), pane: 'atuacao', keyboard: false })
        .bindTooltip(() => {
          const proprias = a.fluxos.filter(f => f.cidadeOrigem.id === a.cidade.id).reduce((n, f) => n + f.total, 0);
          return balao({ cor: COR_ATUACAO, titulo: `${UI.esc(a.cidade.nome)}/${a.cidade.uf}`, tipo: 'onde trabalham',
            sub: infoCor ? `${UI.esc(infoCor.micro.nome)} · ${UI.esc(infoCor.distrito.nome)}` : '', total: a.total, local: a.local, movel: a.movel,
            dica: `vêm de ${a.fluxos.length} cidade(s)${proprias ? ` · ${proprias} moram na própria cidade` : ''} · clique para ver de onde vêm` });
        }, { ...TT, offset: [0, -ladoAtuacao() * 0.71 - 4] });
      m.on('click', () => { abrirPainelAtuacao(a); destacarLinhas(linhasPorChave.get('A:' + a.cidade.id) || []); });
      m._total = a.total;
      marcadoresAtuacao.set(a.cidade.id, m);
      camadas.atuacao.addLayer(m);
    }
    function iconeAtuacao() {
      const lado = ladoAtuacao();
      return L.divIcon({ className: 'silo-marcador-div', html: `<div class="marc-atuacao" style="width:${lado}px;height:${lado}px"></div>`, iconSize: [lado, lado], iconAnchor: [lado / 2, lado / 2] });
    }
    // mudança de estilo / tamanho pelo painel
    el.querySelector('#c-estilo').addEventListener('change', e => { estilo = e.target.value; localStorage.setItem('maparh:mapa-estilo', estilo); desenharOrigens(); atualizarLegendaOrigens(); atualizarSetas(); });
    el.querySelector('#c-tamanho').addEventListener('change', e => {
      tamanho = e.target.value; localStorage.setItem('maparh:mapa-tamanho', tamanho);
      for (const m of marcadoresAtuacao.values()) m.setIcon(iconeAtuacao());
      for (const m of marcadoresHub.values()) m.setRadius(raioAtuacao(m._total));
      desenharOrigens();
    });
    // Aplica o foco: esconde bolhas, cidades de atuação, hubs e unidades que não se ligam à seleção
    function aplicarFoco(chaves) {
      foco = chaves ? new Set(chaves) : null;
      desenharOrigens();
      camadas.atuacao.clearLayers();
      for (const [id, m] of marcadoresAtuacao) if (!foco || foco.has(id)) camadas.atuacao.addLayer(m);
      camadas.hubs.clearLayers();
      for (const [k, m] of marcadoresHub) if (!foco || foco.has(k)) camadas.hubs.addLayer(m);
      renderSilos();
      aplicarModoLinhas();
      el.querySelector('#mapa-kpis').classList.toggle('kpis-foco', !!foco);
    }
    const destinosDe = fluxos => (fluxos || []).map(f => f.atuacaoMovel ? 'H:' + f.uf : f.cidadeAtuacao.id);

    // ---------- distritos e microrregiões (malha dos municípios do IBGE) ----------
    // Os polígonos ficam em um "pane" próprio, abaixo dos marcadores, para nunca cobrirem as bolhas de atuação/origem.
    mapa.createPane('malha').style.zIndex = 350;
    mapa.createPane('rotulos').style.zIndex = 450;
    // com filtro de distrito/microrregião no topo, a malha e a legenda mostram só a região filtrada
    const regiaoFiltro = App.regiaoFiltrada();
    const distritos = Store.distritos().filter(d => !regiaoFiltro.distrito || d.id === regiaoFiltro.distrito.id)
      .map(d => regiaoFiltro.micro ? { ...d, micros: (d.micros || []).filter(m => m.id === regiaoFiltro.micro.id) } : d);
    const camadaRotulos = L.layerGroup().addTo(mapa);
    // Rótulos de distrito/micro que se sobrepõem (zoom afastado): o distrito sempre fica; das micros, some a com menos contratações
    const rotulosMapa = []; // { marcador, prioridade }
    function ajustarRotulos() {
      // zoom afastado: etiqueta do distrito só com o losango e o total, rótulos das micros menores
      mapa.getContainer().classList.toggle('mapa-longe', mapa.getZoom() < 9);
      const itens = rotulosMapa.filter(r => r.marcador._icon);
      for (const r of itens) r.marcador._icon.style.display = '';
      const aceitos = [];
      for (const r of itens.sort((a, b) => b.prioridade - a.prioridade)) {
        const span = r.marcador._icon.firstElementChild;
        if (!span) continue;
        const b = span.getBoundingClientRect();
        const caixa = [b.left - 3, b.top - 2, b.right + 3, b.bottom + 2];
        if (aceitos.some(c => caixa[0] < c[2] && caixa[2] > c[0] && caixa[1] < c[3] && caixa[3] > c[1])) r.marcador._icon.style.display = 'none';
        else aceitos.push(caixa);
      }
    }
    mapa.on('zoomend', ajustarRotulos);
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
      const info = Store.corDaCidade(r.cidadeAtuacao.id);
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
          rotulosMapa.push({ marcador: marcD, prioridade: Infinity });
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
            const marcM = L.marker([polo.lat, polo.lng], {
              icon: L.divIcon({ className: 'rotulo-micro', html: `<span style="background:${UI.esc(cor)};color:${Store.corTexto(cor)}">${UI.esc(m.nome)} · ${UI.fmtNum(totalM)}</span>`, iconSize: [0, 0], iconAnchor: [0, 0] }),
              interactive: true, pane: 'rotulos', keyboard: false
            }).bindTooltip(balao({ cor, titulo: UI.esc(m.nome), tipo: `microrregião · distrito ${UI.esc(d.nome)}`, sub: `${(m.cidadeIds || []).length} município(s) · polo ${UI.esc(polo.nome)}`, total: totalM, dica: 'clique para ver as contratações da microrregião' }), { ...TT, offset: [0, -8] });
            marcM.on('click', e => { L.DomEvent.stopPropagation(e); abrirPainelMicro(d, m); });
            camadaRotulos.addLayer(marcM);
            rotulosMapa.push({ marcador: marcM, prioridade: totalM });
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
            // sem limite oficial (sem internet ou nome diferente do IBGE): mostra um círculo no lugar
            semMalha++;
            camadas.distritos.addLayer(L.circleMarker([it.cidade.lat, it.cidade.lng], { pane: 'malha', radius: 10, color: '#fff', weight: 1.5, fillColor: it.cor, fillOpacity: 0.8 }).bindTooltip(tooltip, { ...TT, sticky: true }));
            continue;
          }
          const normal = { color: '#fff', weight: 1, opacity: 0.9, fillColor: it.cor, fillOpacity: 0.72 };
          const poly = L.geoJSON(f, { pane: 'malha', style: normal }).bindTooltip(tooltip, { ...TT, sticky: true });
          poly.on('mouseover', () => poly.setStyle({ fillOpacity: 0.9 }));
          poly.on('mouseout', () => poly.setStyle(normal));
          poly.on('click', e => { L.DomEvent.stopPropagation(e); abrirPainelCidade(it.cidade, { feature: f }); });
          camadas.distritos.addLayer(poly);
        }
      }
      if (ufsSemMalha === porUF.size) definirStatus('Limites dos municípios indisponíveis (sem internet?). Mostrando as cidades como pontos.');
      else if (semMalha) definirStatus(`${semMalha} município(s) sem limite na malha do IBGE — mostrados como ponto.`);
      else definirStatus('');
      if (statusMalha.textContent) setTimeout(() => { if (ativo) definirStatus(''); }, 8000);
    }
    desenharDistritos();

    // "Aproximar de…": distritos e microrregiões (mantido só se o elemento existir)
    const selFoco = el.querySelector('#c-foco');
    if (selFoco && distritos.length) {
      selFoco.style.display = '';
      selFoco.innerHTML = '<option value="">Aproximar de…</option>' + Store.distritos().map(d =>
        `<optgroup label="${UI.esc(d.nome)}"><option value="d:${d.id}">Distrito ${UI.esc(d.nome)} (todo)</option>` +
        (d.micros || []).map(m => `<option value="m:${d.id}:${m.id}">&nbsp;&nbsp;${UI.esc(m.nome)}</option>`).join('') + '</optgroup>').join('');
      selFoco.addEventListener('change', () => {
        const v = selFoco.value;
        if (!v) return;
        const [tipo, did, mid] = v.split(':');
        const d = Store.distrito(did);
        if (!d) return;
        focar(tipo === 'd' ? Store.cidadesDoDistrito(d) : cidadesDaMicro((d.micros || []).find(m => m.id === mid) || {}));
      });
    }

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
      const svg = `<div style="display:flex;align-items:center;justify-content:center;width:20px;height:20px;background:${cor};border:1.5px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.4);cursor:pointer">${glifoSilo(Store.corTexto(cor), cor, 12)}</div>`;
      return L.divIcon({ className: 'silo-marcador-div', html: svg, iconSize: [20, 20], iconAnchor: [10, 10] });
    }

    function renderSilos() {
      camadas.silos.clearLayers();
      const qtdEl = el.querySelector('#qtd-silos');
      if (!el.querySelector('#c-silos').checked) { if (qtdEl) qtdEl.textContent = '0'; return; }
      if (foco) return; // com uma cidade selecionada, as unidades saem do mapa para não poluir
      const mapaSel = el.querySelector('#mapa-filtro-silos-mapa').value || '';
      let silos = Store.silosNaRegiao(Store.todosSilosPdr(), App.filtros.distritoId, App.filtros.microId);
      if (mapaSel) silos = silos.filter(s => s.mapaId === mapaSel);
      if (qtdEl) qtdEl.textContent = silos.length;
      if (!silosMedidos) { silos.forEach(s => { pontos.push([s.lat, s.lng]); pontosFoco.push([s.lat, s.lng]); }); silosMedidos = true; }

      // unidades muito próximas no zoom atual viram um único marcador com a quantidade
      for (const gr of agruparPorProximidade(silos, s => [s.lat, s.lng], 30)) {
        if (gr.itens.length === 1) { desenharSilo(gr.itens[0]); continue; }
        const infos = gr.itens.map(s => Store.microDoSilo(s));
        const contagem = new Map();
        infos.forEach(i => { const k = i ? i.cor : COR_SILO_FORA; contagem.set(k, (contagem.get(k) || 0) + 1); });
        const cor = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0][0]; // cor da microrregião predominante
        const nomes = gr.itens.slice(0, 6).map(s => UI.esc(s.nome)).join('<br>');
        const m = L.marker(gr.latLng, { icon: L.divIcon({ className: 'silo-marcador-div', html: `<div class="silo-grupo" style="background:${cor}">${glifoSilo(Store.corTexto(cor), cor, 13)}</div>`, iconSize: [24, 24], iconAnchor: [12, 12] }), pane: 'silos', keyboard: false })
          .bindTooltip(balao({ cor, titulo: `🌾 ${gr.itens.length} unidades próximas`, sub: nomes.replace(/<br>/g, ' · ') + (gr.itens.length > 6 ? ' …' : ''), dica: 'clique para aproximar' }), { ...TT, offset: [0, -16] });
        m.on('click', () => mapa.setView(gr.latLng, Math.min(mapa.getZoom() + 2, 14)));
        camadas.silos.addLayer(m);
      }
      function desenharSilo(s) {
        const info = Store.microDoSilo(s);                     // microrregião da cidade da unidade
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
    mapa.on('zoomend', renderSilos);

    // ---------- agências do SINE (camada opcional) ----------
    const camadaSine = L.layerGroup();
    {
      const ags = Store.agenciasSine().filter(a => a.lat != null && a.lng != null);
      el.querySelector('#qtd-sine').textContent = ags.length;
      if (!ags.length) el.querySelector('#c-sine-wrap').style.display = 'none';
      for (const a of ags) {
        const m = L.marker([a.lat, a.lng], { icon: L.divIcon({ className: 'silo-marcador-div', html: '<div class="sine-marcador">S</div>', iconSize: [22, 22], iconAnchor: [11, 11] }), pane: 'silos', keyboard: false })
          .bindTooltip(balao({ cor: '#0f766e', titulo: `SINE ${UI.esc(a.nome || a.cidade)}`, sub: [a.endereco, (a.telefones || []).join(' · ')].filter(Boolean).map(UI.esc).join('<br>'), dica: 'clique para abrir a ficha da cidade' }), { ...TT, offset: [0, -14] });
        m.on('click', () => { const c = Store.resolverCidade(a.cidade, a.uf || 'RS') || Store.cidadeAproximada(a.cidade, a.uf || 'RS'); if (c) abrirPainelCidade(c, {}); });
        camadaSine.addLayer(m);
      }
      el.querySelector('#c-sine').addEventListener('change', e => { if (e.target.checked) camadaSine.addTo(mapa); else mapa.removeLayer(camadaSine); });
    }

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
    const projetosComDados = projetos.filter(p => regs.some(r => r.projetoId === p.id));
    [...new Set(projetosComDados.map(p => p.uf))].forEach(async uf => {
      try {
        const geo = await carregarLimite(uf);
        if (!geo || !ativo) return;
        const cor = (projetosComDados.find(p => p.uf === uf) || {}).cor || COR_ATUACAO;
        camadas.limites.addLayer(L.geoJSON(geo, { style: { color: cor, weight: 2, opacity: 0.7, dashArray: '8 6', fillColor: cor, fillOpacity: 0.05 }, interactive: false }));
      } catch (e) { console.warn('Limite do estado indisponível', uf, e); }
    });

    // ---------- painéis ----------
    function fecharPainel() { painel.hidden = true; painel.innerHTML = ''; camadaDestaque.clearLayers(); linhasSelecionadas = null; aplicarFoco(null); }
    function cabecalhoPainel(titulo, sub) {
      return `<h3><span>${titulo}</span><button class="btn-icone" id="painel-fechar" title="Fechar e mostrar tudo de novo">&times;</button></h3><div class="muted small mb">${sub}</div>` +
        `<div class="painel-foco-aviso small">Mostrando no mapa só o que se liga a esta seleção · <a href="#" id="painel-mostrar-tudo">mostrar tudo</a></div>`;
    }
    function ligarFechar() {
      painel.querySelector('#painel-fechar').addEventListener('click', fecharPainel);
      painel.hidden = false;
      const mt = painel.querySelector('#painel-mostrar-tudo');
      if (mt) mt.addEventListener('click', e => { e.preventDefault(); linhasSelecionadas = null; aplicarFoco(null); mt.closest('.painel-foco-aviso').remove(); });
    }
    const colProjeto = { titulo: 'Projeto', render: f => `<span class="ponto-cor" style="background:${UI.esc(f.projeto.cor)}"></span>${UI.esc(f.projeto.nome)}${f.projeto.ano ? ' <span class="muted small">' + f.projeto.ano + '</span>' : ''}` };
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
    function abrirPainelAtuacao(a) {
      painel.innerHTML = cabecalhoPainel(`<span class="ponto-cor" style="background:${COR_ATUACAO}"></span>${UI.esc(a.cidade.nome)}/${a.cidade.uf}`,
        `Cidade de atuação · ${a.total} contratação(ões) (${a.local} local, ${a.movel} móvel) · ${a.fluxos.length} cidade(s) de origem`) +
        `<div class="linha" style="gap:6px;margin-bottom:10px"><button class="btn btn-pequeno" id="painel-ficha">Ficha da cidade (IBGE, SINE, anotações)</button></div>` +
        tabelaOrigens(a.fluxos, a.total, a.cidade);
      ligarFechar();
      aplicarFoco([a.cidade.id, ...a.fluxos.map(f => f.cidadeOrigem.id)]);
      painel.querySelector('#painel-ficha').addEventListener('click', () => abrirPainelCidade(a.cidade, {}));
    }

    // ---------- ficha da cidade: dados do IBGE, contratações, anotações do RH e divisa ----------
    const ufsMalha = () => [...new Set([...Store.distritos().map(d => d.uf), ...projetos.map(p => p.uf), ...Malha.ufsCarregadas()].filter(Boolean))];
    async function destacarMunicipio(cid, feature) {
      camadaDestaque.clearLayers();
      if (!feature) {
        try { const dadosUF = await Malha.carregarUF(cid.uf); feature = Malha.featureDaCidade(cid, dadosUF); } catch (e) { feature = null; }
      }
      if (!feature || painel.hidden) return null;
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
      const info = Store.corDaCidade(cid.id);
      const g = porOrigem.get(cid.id), a = porAtuacao.get(cid.id);
      const fluxos = fluxosOrigem || (g ? g.fluxos : null);
      const cod = codigo || cid.ibge || null;
      const notasSalvas = Store.infoCidade(cid.id) || {};
      const editar = App.podeEditar();
      // SINE: agência(s) na cidade ou a mais próxima; os campos de anotação vêm pré-preenchidos (editáveis) quando ainda não foram salvos
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
      else blocoSine = `<div class="muted small">Sem agência cadastrada na base (a base embutida cobre o RS). Use "Procurar SINE" abaixo e anote o que encontrar.</div>`;
      const primeira = sineLocal[0] || (sinePerto && sinePerto.distancia <= 60 ? sinePerto.agencia : null);
      const notas = { ...notasSalvas };
      if (primeira && !notas.sineTelefone) notas.sineTelefone = (primeira.telefones || []).join(' / ');
      if (primeira && !notas.sineEndereco) notas.sineEndereco = [primeira.endereco, primeira.cidade && Store.normalizar(primeira.cidade) !== Store.normalizar(cid.nome) ? primeira.cidade : '', primeira.cep ? 'CEP ' + primeira.cep : ''].filter(Boolean).join(' — ');
      const campo = (k, rotulo, placeholder, area) => `<label style="margin-bottom:6px">${rotulo}${area
        ? `<textarea class="ficha-campo" data-k="${k}" rows="2" placeholder="${UI.esc(placeholder)}" ${editar ? '' : 'readonly'}>${UI.esc(notas[k] || '')}</textarea>`
        : `<input class="ficha-campo" data-k="${k}" placeholder="${UI.esc(placeholder)}" value="${UI.esc(notas[k] || '')}" ${editar ? '' : 'readonly'}>`}</label>`;
      const busca = q => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
      // Para onde foram os contratados desta cidade (cidade de atuação + microrregião/distrito). Clicando na bolha laranja, fica no topo da ficha
      const destaqueDestinos = !!(fluxosOrigem && fluxos && fluxos.length);
      const regiaoDe = id => { const i = Store.corDaCidade(id); return i ? ` <span class="muted small">· ${UI.esc(i.micro.nome)} · ${UI.esc(i.distrito.nome)}</span>` : ''; };
      const tabelaDestinos = fluxos && fluxos.length ? UI.tabela({ colunas: [
          { titulo: 'Para onde foram (atuação)', render: f => f.atuacaoMovel ? `<span class="badge badge-roxo">MÓVEL · todo o estado ${f.uf}</span>` : `<a href="#" class="ficha-destino" data-id="${f.cidadeAtuacao.id}">${UI.esc(f.cidadeAtuacao.nome)}/${f.cidadeAtuacao.uf}</a>${regiaoDe(f.cidadeAtuacao.id)}` },
          { titulo: 'L', classe: 'direita', render: f => f.local }, { titulo: 'M', classe: 'direita', render: f => f.movel },
          { titulo: 'Total', classe: 'direita', render: f => `<b>${f.total}</b>` }, { titulo: 'Dist.', classe: 'direita', render: f => UI.fmtKm(f.dist) }
        ], linhas: fluxos.slice().sort((x, y) => y.total - x.total) }) : '';
      painel.innerHTML = cabecalhoPainel(`<span class="ponto-cor" style="background:${info ? info.cor : '#64748b'}"></span>${UI.esc(cid.nome)}/${cid.uf}`,
        info ? `Microrregião <b>${UI.esc(info.micro.nome)}</b> · distrito ${UI.esc(info.distrito.nome)} <a href="#" id="ficha-micro">ver números da microrregião</a>` : 'Cidade fora das microrregiões cadastradas') +
        `<div class="ficha">
          ${destaqueDestinos ? `<div class="ficha-secao">Para onde foram <span class="muted small">${UI.fmtNum(g ? g.total : fluxos.reduce((n, f) => n + f.total, 0))} contratado(s) desta cidade · ${fluxos.length} destino(s) · clique no destino para ver quem mais atua lá</span></div>` + tabelaDestinos : ''}
          <div class="ficha-secao">Dados do município <span class="muted small">IBGE</span></div>
          <div class="ficha-grade" id="ficha-ibge"><span class="muted small">Buscando no IBGE…</span></div>
          <div class="muted small" style="margin-top:4px">O IBGE não divulga taxa de desemprego por município: use a % de população ocupada (empregos formais) como referência e confirme no SINE.</div>

          <div class="ficha-secao">Contratações <span class="muted small">no filtro atual</span></div>
          <div class="ficha-grade">
            <div class="ficha-dado"><div class="rotulo">Como origem</div><div class="valor">${g ? UI.fmtNum(g.total) : 0}</div><div class="muted small">${g ? `${g.local} local · ${g.movel} móvel` : 'ninguém contratado daqui'}</div></div>
            <div class="ficha-dado"><div class="rotulo">Como atuação</div><div class="valor">${a ? UI.fmtNum(a.total) : 0}</div><div class="muted small">${a ? `${a.fluxos.length} cidade(s) de origem` : 'sem contratações atuando aqui'}</div></div>
          </div>
          ${!destaqueDestinos && tabelaDestinos ? `<details style="margin-top:6px"><summary class="small" style="cursor:pointer;font-weight:600">Para onde vão os contratados daqui (${fluxos.length} destino(s))</summary>` + tabelaDestinos + '</details>' : ''}
          ${a ? `<div style="margin-top:6px"><button class="btn btn-pequeno" id="ficha-atuacao">Ver de onde vem quem atua aqui</button></div>` : ''}

          <div class="ficha-secao">SINE / agência de emprego <span class="muted small">${sineLocal.length ? 'dados oficiais da FGTAS' : (sinePerto ? 'agência mais próxima' : '')}</span></div>
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
            <a href="${busca(`SINE ${cid.nome} ${cid.uf} telefone endereço`)}" target="_blank" rel="noopener">Procurar SINE</a>
            ${cid.uf === 'RS' ? '<a href="https://fgtas.rs.gov.br/agencias-fgtas-sine" target="_blank" rel="noopener">Agências FGTAS/Sine (RS)</a>' : ''}
            <a href="${busca(`prefeitura ${cid.nome} ${cid.uf} telefone`)}" target="_blank" rel="noopener">Prefeitura</a>
            <a href="${busca(`rádio ${cid.nome} ${cid.uf}`)}" target="_blank" rel="noopener">Rádios locais</a>
            <a href="${IbgeCidade.urlCidades(cid.nome, cid.uf)}" target="_blank" rel="noopener">IBGE Cidades</a>
          </div>
          ${window.SINE_SEED ? `<div class="muted small" style="margin-top:6px">Agências do SINE: base ${UI.esc(window.SINE_SEED.fonte || 'FGTAS')}, coletada em ${UI.esc(window.SINE_SEED.atualizadoEm || '')}. Confirme por telefone antes de divulgar.</div>` : ''}
        </div>`;
      ligarFechar();
      aplicarFoco([cid.id, ...destinosDe(fluxos), ...(a ? a.fluxos.map(f => f.cidadeOrigem.id) : [])]);
      if (a && !fluxosOrigem) destacarLinhas(linhasPorChave.get('A:' + cid.id) || []);
      painel.querySelectorAll('.ficha-destino').forEach(l => l.addEventListener('click', e => {
        e.preventDefault();
        const a2 = porAtuacao.get(l.dataset.id);
        if (a2) { abrirPainelAtuacao(a2); destacarLinhas(linhasPorChave.get('A:' + a2.cidade.id) || []); }
      }));
      const bm = painel.querySelector('#ficha-micro');
      if (bm) bm.addEventListener('click', e => { e.preventDefault(); abrirPainelMicro(info.distrito, info.micro); });
      const ba = painel.querySelector('#ficha-atuacao');
      if (ba) ba.addEventListener('click', () => { abrirPainelAtuacao(a); destacarLinhas(linhasPorChave.get('A:' + a.cidade.id) || []); });
      const bs = painel.querySelector('#ficha-salvar');
      if (bs) bs.addEventListener('click', () => {
        const campos = {};
        painel.querySelectorAll('.ficha-campo').forEach(i => { campos[i.dataset.k] = i.value; });
        try { Store.salvarInfoCidade(cid.id, campos, App.usuario); UI.toast('Anotações salvas.', 'sucesso'); }
        catch (e) { UI.toast(e.message, 'erro'); }
      });
      // divisa do município
      const contorno = await destacarMunicipio(cid, feature);
      if (aproximar && contorno) mapa.fitBounds(contorno.getBounds().pad(0.4), { maxZoom: 11 });
      // dados do IBGE
      const alvo = painel.querySelector('#ficha-ibge');
      if (!alvo) return;
      if (!cod) { alvo.innerHTML = '<span class="muted small">Sem código IBGE para esta cidade (baixe a lista completa de municípios no menu Cidades).</span>'; return; }
      try {
        const d = await IbgeCidade.dados(cod);
        if (!alvo.isConnected) return;
        const chaves = ['populacaoEstimada', 'populacaoCenso', 'area', 'densidade', 'popOcupada', 'salarioMedio', 'rendaMeioSM', 'pibPerCapita'].filter(k => d && d[k]);
        alvo.innerHTML = chaves.length ? chaves.map(k => fmtInd(k, d[k])).join('') : '<span class="muted small">O IBGE não retornou dados para este município.</span>';
      } catch (e) {
        if (alvo.isConnected) alvo.innerHTML = '<span class="muted small">Não foi possível consultar o IBGE agora (sem internet?).</span>';
      }
    }
    function abrirPainelHub(h) {
      painel.innerHTML = cabecalhoPainel(`<span class="ponto-cor" style="background:${COR_HUB}"></span>${h.uf} — atuação móvel`,
        `Podem atuar em qualquer lugar de ${UI.esc(Store.UFS[h.uf] || h.uf)} · ${h.total} contratação(ões) (${h.local} local, ${h.movel} móvel) · ${h.fluxos.length} cidade(s) de origem`) + tabelaOrigens(h.fluxos, h.total, null);
      ligarFechar();
      aplicarFoco(['H:' + h.uf, ...h.fluxos.map(f => f.cidadeOrigem.id)]);
    }
    function abrirPainelOrigem(g) {
      painel.innerHTML = cabecalhoPainel(`<span class="ponto-cor" style="background:${COR_ORIGEM}"></span>${UI.esc(g.cidade.nome)}/${g.cidade.uf}`,
        `Cidade de origem · ${g.total} contratação(ões) (${g.local} local, ${g.movel} móvel)`) +
        UI.tabela({
          colunas: [
            { titulo: 'Atuação', render: f => f.atuacaoMovel ? `<span class="badge badge-roxo">MÓVEL · todo o estado ${f.uf}</span>` : `${UI.esc(f.cidadeAtuacao.nome)}/${f.cidadeAtuacao.uf}` },
            colProjeto,
            { titulo: 'L', classe: 'direita', render: f => f.local },
            { titulo: 'M', classe: 'direita', render: f => f.movel },
            { titulo: 'Total', classe: 'direita', render: f => `<b>${f.total}</b>` },
            { titulo: 'Dist.', classe: 'direita', render: f => UI.fmtKm(f.dist) }
          ],
          linhas: g.fluxos.slice().sort((a, b) => b.total - a.total)
        });
      ligarFechar();
      aplicarFoco([g.cidade.id, ...destinosDe(g.fluxos)]);
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
      const unidades = Store.silosNaRegiao(Store.todosSilosPdr(), d.id, '').length;
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
        }) + (origens.size > 30 ? `<div class="muted small" style="margin-top:6px">Mostrando as 30 maiores de ${origens.size} cidades de origem.</div>` : '');
      ligarFechar();
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
      const unidades = Store.silosNaRegiao(Store.todosSilosPdr(), d.id, m.id).length;
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
        }) + (origens.size > 40 ? `<div class="muted small" style="margin-top:6px">Mostrando as 40 maiores de ${origens.size} cidades de origem.</div>` : '');
      ligarFechar();
      destacarLinhas([...ids].flatMap(id => linhasPorChave.get('A:' + id) || []));
      aplicarFoco([...ids, ...lista.map(r => r.cidadeId)]);
      painel.querySelector('#painel-focar').addEventListener('click', () => focar(cidadesDaMicro(m)));
      const bf = painel.querySelector('#painel-filtrar');
      if (bf) bf.addEventListener('click', () => { App.filtros.distritoId = d.id; App.filtros.microId = m.id; App.aoMudarFiltros(); });
    }
    function abrirPainelGrupoOrigem(gr) {
      painel.innerHTML = cabecalhoPainel(`<span class="ponto-cor" style="background:${COR_ORIGEM}"></span>${gr.itens.length} cidades de origem próximas`,
        `${gr.total} contratação(ões) (${gr.local} local, ${gr.movel} móvel) · agrupadas neste zoom — aproxime para separar ou clique em uma cidade`) +
        UI.tabela({
          colunas: [
            { titulo: 'Cidade de origem', render: g => `<a href="#" class="painel-cidade" data-id="${g.cidade.id}">${UI.esc(g.cidade.nome)}/${g.cidade.uf}</a>` },
            { titulo: 'L', classe: 'direita', render: g => g.local },
            { titulo: 'M', classe: 'direita', render: g => g.movel },
            { titulo: 'Total', classe: 'direita', render: g => `<b>${g.total}</b>` }
          ],
          linhas: gr.itens
        });
      ligarFechar();
      aplicarFoco([...gr.itens.map(g => g.cidade.id), ...gr.itens.flatMap(g => destinosDe(g.fluxos))]);
      painel.querySelectorAll('.painel-cidade').forEach(a => a.addEventListener('click', e => { e.preventDefault(); const g = porOrigem.get(a.dataset.id); if (g) selecionarOrigem(g); }));
    }
    // clique em qualquer lugar do mapa: identifica o município (pela malha do IBGE) e abre a ficha dele
    let identificando = false;
    mapa.on('click', async e => {
      fecharPainel();
      if (identificando) return;
      const ufs = ufsMalha();
      if (!ufs.length) return;
      identificando = true;
      definirStatus('Identificando o município…');
      try {
        const m = await Malha.municipioNoPonto(e.latlng.lat, e.latlng.lng, ufs);
        definirStatus('');
        if (!m || !ativo) return;
        let cid = Store.resolverCidade(m.nome, m.uf) || Store.cidadeAproximada(m.nome, m.uf);
        if (!cid) { // cidade ainda não está na base: usa o centro do polígono
          const b = L.geoJSON(m.feature).getBounds().getCenter();
          cid = { id: Store.idCidade(m.nome, m.uf), nome: m.nome, uf: m.uf, lat: b.lat, lng: b.lng, ibge: m.codigo };
        }
        abrirPainelCidade(cid, { feature: m.feature, codigo: m.codigo });
      } catch (err) { definirStatus(''); console.warn(err); }
      finally { identificando = false; }
    });

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
    const todosSilos = Store.silosNaRegiao(Store.todosSilosPdr(), App.filtros.distritoId, App.filtros.microId);
    const legenda = el.querySelector('#legenda');
    const item = (marca, texto) => `<div class="legenda-item">${marca}<span>${texto}</span></div>`;
    const bola = (cor, tam = 12) => `<span class="ponto-cor" style="background:${UI.esc(cor)};width:${tam}px;height:${tam}px"></span>`;
    legenda.innerHTML = `<div class="painel-cab"><b>Legenda</b><button class="btn-icone painel-toggle" title="Recolher / expandir">&#8722;</button></div><div class="painel-corpo">` +
      `<div class="legenda-secao">Contratações</div>` +
      projetosComDados.map(p => item(`<span class="legenda-traco" style="color:${UI.esc(p.cor)}"></span>`, `${UI.esc(Store.rotuloProjeto(p))} <span class="muted">— linha: de onde vêm ➜ onde trabalham (a seta aponta para o trabalho)</span>`)).join('') +
      item('<span class="marc-atuacao mini"></span>', '<b>Onde trabalham</b> (cidade de atuação) — clique para ver de onde vêm') +
      (distritos.length ? item('<span class="rotulo-distrito mini"><b>n</b></span>', '<b>Total do distrito</b> — soma de quem trabalha nas cidades dele; clique para ver tudo do distrito') : '') +
      `<div id="legenda-origens"></div>` +
      (porHub.size ? item(bola(COR_HUB, 14), 'Atuação móvel em todo o estado') : '') +
      (todosSilos.length ? `<div class="legenda-secao">🌾 Unidades PDR (${todosSilos.length})</div>` +
        item(`<span class="silo-grupo" style="background:#16a34a;width:18px;height:18px;border-width:1.5px;box-shadow:none;flex-shrink:0"></span>`, 'Unidade — cor da microrregião da cidade') +
        item(bola(COR_SILO_FORA, 12), 'Fora das microrregiões cadastradas') +
        Store.mapasPdr().map(m => item('<span style="width:12px;flex-shrink:0"></span>', `<span class="muted">${UI.esc(m.nome)} (${(m.pontos || []).length})</span>`)).join('')
      : '') +
      (distritos.length ? `<div class="legenda-secao">Distritos e microrregiões <span style="font-weight:400;text-transform:none;letter-spacing:0">· total pela cidade de atuação · clique para aproximar</span></div>` +
        distritos.map(d =>
          `<a href="#" class="legenda-micro" data-d="${d.id}" style="padding-left:2px;font-weight:600">${bola(d.cor || '#2563eb', 10)}${UI.esc(d.nome)} <span class="muted small" style="font-weight:400">· <b>${UI.fmtNum(totaisDistrito.get(d.id) || 0)}</b> contratações · ${Store.cidadesDoDistrito(d).length} cid</span></a>` +
          (d.micros || []).map(m => `<a href="#" class="legenda-micro" data-d="${d.id}" data-m="${m.id}">${bola(m.cor || d.cor, 9)}${UI.esc(m.nome)} <span class="muted small">· <b>${UI.fmtNum(totaisMicro.get(m.id) || 0)}</b> · ${(m.cidadeIds || []).length} cid</span></a>`).join('')
        ).join('') : '') +
      `<div class="muted small" style="margin-top:6px;border-top:1px solid var(--borda);padding-top:5px">${UI.esc(App.descricaoFiltro())}<br>${UI.fmtNum(regs.length)} contratação(ões) · ${porOrigem.size} cid. de origem</div></div>`;
    function atualizarLegendaOrigens() {
      const alvo = el.querySelector('#legenda-origens');
      if (!alvo) return;
      if (estilo === 'pintar') {
        const faixas = [];
        let ini = 1;
        cortesCoropleto.forEach(c => { faixas.push(ini === c ? `${c}` : `${ini}–${c}`); ini = c + 1; });
        faixas.push(`${ini}+`);
        alvo.innerHTML = item(bola(COR_ORIGEM, 12), '<b>De onde vêm</b> (cidade de origem) — município pintado') +
          `<div class="legenda-item" style="gap:4px;flex-wrap:wrap;padding-left:20px">${faixas.map((f, i) => `<span class="legenda-faixa" style="background:${COR_CLASSES[Math.min(i, COR_CLASSES.length - 1)]}">${f}</span>`).join('')}</div>`;
      } else if (estilo === 'pontos') {
        alvo.innerHTML = item(bola(COR_ORIGEM, 10), '<b>De onde vêm</b> (cidade de origem) — a quantidade aparece ao passar o mouse');
      } else {
        alvo.innerHTML = item(`<span class="bolha-origem" style="width:20px;height:20px;line-height:17px;font-size:10px;flex-shrink:0">n</span>`, '<b>De onde vêm</b> (cidade de origem) — nº de pessoas');
      }
    }
    atualizarLegendaOrigens();
    // painéis recolhíveis (estado lembrado na sessão)
    for (const painelEl of [el.querySelector('#controles'), legenda]) {
      const chave = 'maparh:mapa-recolhido:' + painelEl.id;
      const aplicar = () => { const rec = sessionStorage.getItem(chave) === '1'; painelEl.classList.toggle('painel-recolhido', rec); painelEl.querySelector('.painel-toggle').innerHTML = rec ? '&#43;' : '&#8722;'; };
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
        mapas.map(m => `<option value="${UI.esc(m.id)}">${UI.esc(m.nome)} (${(m.pontos || []).length})</option>`).join('');
      selectMapas.hidden = mapas.length < 2;
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
    el.querySelector('#c-calor').addEventListener('change', e => { el.querySelector('#c-modo-calor').hidden = !e.target.checked; montarCalor(); });
    el.querySelector('#c-modo-calor').addEventListener('change', montarCalor);
    function ajustar() { if (pontos.length) mapa.fitBounds(L.latLngBounds(pontos).pad(0.15), { maxZoom: 9 }); }
    // enquadramento inicial: a área de trabalho (atuação, distritos, silos); origens distantes ficam fora, sem "encolher" o mapa
    function enquadrarInicial() {
      const base = pontosDistritos.length ? pontosDistritos : (pontosFoco.length ? pontosFoco : pontos);
      if (base.length) mapa.fitBounds(L.latLngBounds(base).pad(0.15), { maxZoom: 10 });
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
        (todosSilos.length ? chip(UI.fmtNum(todosSilos.length), 'unidades') : '');
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
        setTimeout(() => { if (marcadorBusca) { mapa.removeLayer(marcadorBusca); marcadorBusca = null; } }, 8000);
        abrirPainelCidade(c, { aproximar: true });
      }
    });
    // tela cheia
    const wrap = el.querySelector('.mapa-wrap');
    el.querySelector('#c-tela-cheia').addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen(); else if (wrap.requestFullscreen) wrap.requestFullscreen();
    });
    document.addEventListener('fullscreenchange', aoMudarTelaCheia);
    function aoMudarTelaCheia() { el.querySelector('#c-tela-cheia').textContent = document.fullscreenElement ? 'Sair da tela cheia' : 'Tela cheia'; setTimeout(() => mapa.invalidateSize(), 100); }
    [el.querySelector('.mapa-controles'), legenda, painel, kpis].forEach(x => { L.DomEvent.disableClickPropagation(x); L.DomEvent.disableScrollPropagation(x); });

    // Renderizar silos inicialmente
    renderSilos();

    let focoInicial = null;
    try { focoInicial = JSON.parse(sessionStorage.getItem('maparh:mapa-foco') || 'null'); } catch (e) { focoInicial = null; }
    sessionStorage.removeItem('maparh:mapa-foco');
    const distritoFoco = focoInicial && focoInicial.distritoId ? Store.distrito(focoInicial.distritoId) : null;
    setTimeout(() => {
      mapa.invalidateSize();
      if (distritoFoco && Store.cidadesDoDistrito(distritoFoco).length) { focar(Store.cidadesDoDistrito(distritoFoco)); if (selFoco) selFoco.value = 'd:' + distritoFoco.id; }
      else enquadrarInicial();
    }, 50);
    if (!regs.length && !todosSilos.length && !distritos.length) {
      UI.toast(Store.projetos().length ? 'Nenhuma contratação para o filtro atual.' : 'Cadastre um projeto e as contratações para ver o mapa.', 'aviso');
    }

    return () => { ativo = false; document.removeEventListener('fullscreenchange', aoMudarTelaCheia); mapa.remove(); App.mapaAtual = null; };
  }
};
