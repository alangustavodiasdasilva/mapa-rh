// Distritos e microrregiões: cadastro da estrutura regional que pinta o mapa.
//   distrito (ex.: Lagoa Vermelha) -> microrregiões (ex.: Casca, Nova Prata…) -> cidade polo + cidades atendidas
// Cada cidade pertence a uma única microrregião. As cores aparecem no mapa sobre os limites dos municípios.
Paginas.distritos = {
  titulo: 'Distritos e microrregiões',
  semFiltros: true,
  render(el) {
    const podeEditar = App.podeEditar();
    let busca = '';
    const recolhidos = new Set(JSON.parse(sessionStorage.getItem('maparh:dist-recolhidos') || '[]'));
    const expandidas = new Set(); // micros com a lista completa de cidades aberta
    const LIMITE_CHIPS = 30;

    // Resolve um nome digitado: nome exato, grafia aproximada ou, por último, único município que começa com o texto
    function resolverTexto(texto, uf) {
      const t = String(texto || '').trim();
      if (!t) return null;
      const c = Store.resolverCidade(t, uf) || Store.cidadeAproximada(t, uf);
      if (c) return c;
      const lista = Store.buscarCidades(t, uf, 2);
      return lista.length === 1 ? lista[0] : null;
    }
    // UF sugerida para novos distritos: a do projeto filtrado, senão a do primeiro projeto, senão RS
    function ufPadrao() {
      const p = App.filtros.projetoId ? Store.projeto(App.filtros.projetoId) : null;
      return (p && p.uf) || (Store.projetos()[0] || {}).uf || 'RS';
    }

    el.innerHTML = `
      <div class="dist-topo">
        <p class="muted">Um <b>distrito</b> reúne <b>microrregiões</b>; cada microrregião tem uma <b>cidade polo</b> (sede) e as cidades atendidas.
          Cada cidade pertence a uma única microrregião. As cores aparecem no <a href="#/mapa">mapa</a>, pintando os limites dos municípios.</p>
        <div class="linha nao-imprimir">
          <input class="busca" id="dist-busca" placeholder="Buscar distrito, microrregião ou cidade…">
          ${podeEditar ? '<button class="btn" id="btn-importar" title="Cole uma planilha com as colunas MICRORREGIÃO e CIDADE">Importar planilha</button>' : ''}
          <button class="btn" id="btn-exportar" title="Baixa a estrutura completa em CSV">Exportar CSV</button>
          ${podeEditar ? '<button class="btn btn-primario" id="btn-novo">+ Novo distrito</button>' : ''}
        </div>
      </div>
      <div class="dist-resumo" id="dist-resumo"></div>
      <div id="dist-lista"></div>`;

    el.querySelector('#dist-busca').addEventListener('input', UI.debounce(e => { busca = e.target.value; renderLista(); }, 150));
    el.querySelector('#btn-exportar').addEventListener('click', exportarCSV);
    const bNovo = el.querySelector('#btn-novo'); if (bNovo) bNovo.addEventListener('click', () => abrirFormDistrito(null));
    const bImp = el.querySelector('#btn-importar'); if (bImp) bImp.addEventListener('click', abrirImportacao);

    // ---------- lista ----------
    function renderLista() {
      const lista = Store.distritos().slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      const cont = el.querySelector('#dist-lista');
      const totalMicros = lista.reduce((n, d) => n + (d.micros || []).length, 0);
      const totalCidades = lista.reduce((n, d) => n + Store.cidadesDoDistrito(d).length, 0);
      el.querySelector('#dist-resumo').innerHTML = lista.length
        ? `<span><b>${lista.length}</b> distrito(s)</span><span><b>${totalMicros}</b> microrregião(ões)</span><span><b>${UI.fmtNum(totalCidades)}</b> cidade(s) vinculada(s)</span>`
        : '';
      if (!lista.length) {
        cont.innerHTML = `
          <div class="card vazio" style="padding:36px 18px">
            <h3 style="margin-bottom:8px">Nenhum distrito cadastrado</h3>
            <p class="muted small">Crie o distrito (ex.: <b>Lagoa Vermelha</b>) e adicione suas microrregiões com a cidade polo e as cidades atendidas.
              Se já tem a estrutura em planilha, importe tudo de uma vez.</p>
            ${podeEditar ? `<div class="linha" style="justify-content:center;margin-top:14px">
              <button class="btn btn-primario" id="vazio-novo">+ Criar o primeiro distrito</button>
              <button class="btn" id="vazio-importar">Importar de planilha</button></div>` : ''}
          </div>`;
        const a = cont.querySelector('#vazio-novo'); if (a) a.addEventListener('click', () => abrirFormDistrito(null));
        const b = cont.querySelector('#vazio-importar'); if (b) b.addEventListener('click', abrirImportacao);
        return;
      }
      const termo = Store.normalizar(busca);
      const visiveis = lista.map(d => filtrarDistrito(d, termo)).filter(Boolean);
      if (!visiveis.length) {
        cont.innerHTML = `<div class="card vazio">Nada encontrado para "${UI.esc(busca)}".</div>`;
        return;
      }
      cont.innerHTML = visiveis.map(v => renderDistrito(v.distrito, v.micros, !!termo)).join('');
    }

    function filtrarDistrito(d, termo) {
      const micros = (d.micros || []);
      if (!termo || Store.normalizar(d.nome).includes(termo)) return { distrito: d, micros };
      const achadas = micros.filter(m => Store.normalizar(m.nome).includes(termo) ||
        (m.cidadeIds || []).some(id => { const c = Store.cidade(id); return c && Store.normalizar(c.nome).includes(termo); }));
      return achadas.length ? { distrito: d, micros: achadas } : null;
    }

    function renderDistrito(d, micros, filtrado) {
      const r = Store.resumoDistrito(d);
      const recolhido = recolhidos.has(d.id) && !filtrado;
      return `
        <div class="card dist-card ${recolhido ? 'recolhido' : ''}" data-id="${d.id}" style="--cor:${UI.esc(d.cor || '#2563eb')}">
          <div class="dist-cab">
            <button class="btn-icone dist-toggle" title="${recolhido ? 'Mostrar microrregiões' : 'Recolher'}">${recolhido ? '&#9656;' : '&#9662;'}</button>
            <span class="dist-cor"></span>
            <div class="dist-titulo">
              <h3>${UI.esc(d.nome)}</h3>
              ${d.uf ? `<span class="badge badge-cinza" title="${UI.esc(Store.UFS[d.uf] || d.uf)}">${d.uf}</span>` : '<span class="badge badge-amarelo" title="Defina o estado em Editar">sem UF</span>'}
              ${d.descricao ? `<span class="muted small">${UI.esc(d.descricao)}</span>` : ''}
            </div>
            <div class="dist-numeros">
              <span><b>${r.micros}</b> microrregião(ões)</span>
              <span><b>${r.cidades}</b> cidade(s)</span>
              ${r.silos ? `<span title="Unidades dos mapas PDR situadas nas cidades deste distrito"><b>${r.silos}</b> silo(s) PDR</span>` : ''}
              ${r.contratacoes ? `<span title="Contratações com atuação ou base nas cidades deste distrito"><b>${r.contratacoes}</b> contratação(ões)</span>` : ''}
            </div>
            <div class="dist-acoes nao-imprimir">
              <button class="btn btn-pequeno acao-mapa" title="Ver este distrito no mapa">${icone('mapa', 14)} Mapa</button>
              ${podeEditar ? `
              <button class="btn btn-primario btn-pequeno acao-nova-micro">+ Microrregião</button>
              <button class="btn btn-pequeno acao-editar">Editar</button>
              <button class="btn-icone perigo acao-excluir" title="Excluir distrito">&#128465;</button>` : ''}
            </div>
          </div>
          <div class="dist-micros">
            ${micros.length ? micros.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(m => renderMicro(d, m)).join('')
              : `<div class="dist-vazio">Nenhuma microrregião ainda.${podeEditar ? ' Clique em <b>+ Microrregião</b> para cadastrar a primeira, ou use <b>Importar planilha</b>.' : ''}</div>`}
          </div>
        </div>`;
    }

    function renderMicro(d, m) {
      const polo = Store.cidade(m.poloCidadeId);
      const outras = (m.cidadeIds || []).map(id => Store.cidade(id)).filter(c => c && (!polo || c.id !== polo.id))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      const mostrar = expandidas.has(m.id) ? outras : outras.slice(0, LIMITE_CHIPS);
      const sufixo = c => c.uf !== d.uf ? '/' + c.uf : '';
      const chips = (polo ? `<span class="chip-cidade chip-polo" style="color:${Store.corTexto(m.cor || d.cor)}" title="Cidade polo (sede)">&#128081; ${UI.esc(polo.nome)}${sufixo(polo)}</span>` : '') +
        mostrar.map(c => `<span class="chip-cidade">${UI.esc(c.nome)}${sufixo(c)}</span>`).join('') +
        (outras.length > mostrar.length ? `<button type="button" class="btn-link chip-mais acao-mais">+${outras.length - mostrar.length} cidades</button>` : '');
      return `
        <div class="micro-linha" data-micro="${m.id}" style="--cor:${UI.esc(m.cor || d.cor || '#2563eb')}">
          <span class="micro-cor"></span>
          <div class="micro-corpo">
            <div class="micro-cab">
              <b>${UI.esc(m.nome)}</b>
              <span class="muted small">${(m.cidadeIds || []).length} cidade(s)${polo ? '' : ' · <span class="status-erro">sem cidade polo</span>'}</span>
              ${podeEditar ? `<span class="micro-acoes nao-imprimir">
                <button class="btn-icone acao-editar-micro" title="Editar microrregião e cidades">&#9998;</button>
                <button class="btn-icone perigo acao-excluir-micro" title="Excluir microrregião">&#128465;</button></span>` : ''}
            </div>
            <div class="chips-wrap">${chips || '<span class="muted small">Nenhuma cidade.</span>'}</div>
          </div>
        </div>`;
    }

    // Um único ouvinte para todos os botões da lista
    el.querySelector('#dist-lista').addEventListener('click', async e => {
      const card = e.target.closest('.dist-card');
      if (!card) return;
      const d = Store.distrito(card.dataset.id);
      if (!d) return;
      const alvo = sel => e.target.closest(sel);
      const linhaMicro = e.target.closest('.micro-linha');
      const m = linhaMicro ? (d.micros || []).find(x => x.id === linhaMicro.dataset.micro) : null;
      if (m && alvo('.acao-editar-micro')) return abrirFormMicro(d, m);
      if (m && alvo('.acao-excluir-micro')) return excluirMicro(d, m);
      if (m && alvo('.acao-mais')) { expandidas.add(m.id); return renderLista(); }
      if (alvo('.dist-toggle')) {
        if (recolhidos.has(d.id)) recolhidos.delete(d.id); else recolhidos.add(d.id);
        sessionStorage.setItem('maparh:dist-recolhidos', JSON.stringify([...recolhidos]));
        return renderLista();
      }
      if (alvo('.acao-mapa')) return verNoMapa(d);
      if (alvo('.acao-nova-micro')) return abrirFormMicro(d, null);
      if (alvo('.acao-editar')) return abrirFormDistrito(d);
      if (alvo('.acao-excluir')) return excluirDistrito(d);
    });

    function verNoMapa(d) {
      sessionStorage.setItem('maparh:mapa-foco', JSON.stringify({ distritoId: d.id }));
      App.ir('mapa');
    }
    async function excluirDistrito(d) {
      const n = Store.cidadesDoDistrito(d).length;
      if (await UI.confirmar(`Excluir o distrito "${d.nome}" com ${(d.micros || []).length} microrregião(ões) e ${n} cidade(s) vinculada(s)? As cidades continuam cadastradas; só deixam de ser coloridas no mapa.`, { textoOk: 'Excluir distrito', perigo: true })) {
        Store.excluirDistrito(d.id, App.usuario);
        UI.toast(`Distrito "${d.nome}" excluído.`, 'sucesso');
        renderLista();
      }
    }
    async function excluirMicro(d, m) {
      if (await UI.confirmar(`Excluir a microrregião "${m.nome}" (${(m.cidadeIds || []).length} cidades) do distrito "${d.nome}"?`, { textoOk: 'Excluir', perigo: true })) {
        Store.excluirMicro(d.id, m.id, App.usuario);
        UI.toast(`Microrregião "${m.nome}" excluída.`, 'sucesso');
        renderLista();
      }
    }

    // ---------- paleta de cores ----------
    function paletaHTML(cores, atual, id = '') {
      return `<div class="paleta" ${id ? `id="${id}"` : ''}>${cores.map(c =>
        `<button type="button" class="paleta-cor ${c === String(atual).toLowerCase() ? 'ativo' : ''}" data-cor="${c}" style="background:${c}" title="${c}"></button>`).join('')}</div>`;
    }
    function ligarPaleta(corpo, inputSel) {
      const inp = corpo.querySelector(inputSel);
      const marcar = () => corpo.querySelectorAll('.paleta-cor').forEach(b => b.classList.toggle('ativo', b.dataset.cor === inp.value.toLowerCase()));
      corpo.querySelectorAll('.paleta-cor').forEach(b => b.addEventListener('click', () => { inp.value = b.dataset.cor; marcar(); inp.dispatchEvent(new Event('change')); }));
      inp.addEventListener('input', marcar);
    }

    // ---------- formulário do distrito ----------
    function abrirFormDistrito(d) {
      const corIni = d ? d.cor : Store.corSugeridaDistrito();
      const corpo = document.createElement('div');
      corpo.innerHTML = `
        <label>Nome do distrito<input id="d-nome" value="${UI.esc(d ? d.nome : '')}" placeholder="Ex.: Lagoa Vermelha"></label>
        <div class="form-linha">
          <label>Estado (UF) das cidades<select id="d-uf">${UI.opcoesUF(d ? d.uf : ufPadrao())}</select>
            <span class="ajuda-inline">As cidades das microrregiões são buscadas neste estado.</span></label>
          <label>Cor do distrito<div class="linha" style="gap:8px;margin-top:4px"><input type="color" id="d-cor" value="${UI.esc(corIni)}">${paletaHTML(Store.PALETA_DISTRITOS, corIni)}</div></label>
        </div>
        <div style="margin:-2px 0 12px"><span class="muted small">Tons que as microrregiões recebem (do mais escuro ao mais claro):</span>
          <div class="paleta" id="d-tons" style="margin-top:4px"></div></div>
        <label>Descrição (opcional)<input id="d-desc" value="${UI.esc(d ? d.descricao || '' : '')}" placeholder="Ex.: Regional Serra / Campos de Cima da Serra"></label>
        ${d && (d.micros || []).length ? `<label class="check"><input type="checkbox" id="d-recolorir"> Recolorir as ${d.micros.length} microrregiões com os tons desta cor (da mais escura à mais clara, em ordem alfabética)</label>` : ''}`;
      ligarPaleta(corpo, '#d-cor');
      const qtdTons = Math.max(6, d ? (d.micros || []).length : 0);
      const mostrarTons = () => { corpo.querySelector('#d-tons').innerHTML = Store.gerarTons(corpo.querySelector('#d-cor').value, qtdTons).map(c => `<span class="paleta-cor" style="background:${c};cursor:default" title="${c}"></span>`).join(''); };
      mostrarTons();
      // mudou a cor base: sugere recolorir as microrregiões (os tons antigos deixariam de combinar)
      const aoMudarCor = () => { mostrarTons(); const ch = corpo.querySelector('#d-recolorir'); if (ch && d && corpo.querySelector('#d-cor').value.toLowerCase() !== String(d.cor).toLowerCase()) ch.checked = true; };
      corpo.querySelector('#d-cor').addEventListener('input', aoMudarCor);
      corpo.querySelector('#d-cor').addEventListener('change', aoMudarCor);
      UI.modal({
        titulo: d ? `Editar distrito — ${d.nome}` : 'Novo distrito',
        corpo, largura: '540px', fecharAoClicarFora: false,
        botoes: [
          { texto: 'Cancelar' },
          { texto: d ? 'Salvar' : 'Criar distrito', classe: 'btn-primario', acao: () => {
            const q = s => corpo.querySelector(s);
            const salvo = Store.salvarDistrito({ id: d ? d.id : null, nome: q('#d-nome').value, uf: q('#d-uf').value, cor: q('#d-cor').value,
              descricao: q('#d-desc').value, recolorir: q('#d-recolorir') ? q('#d-recolorir').checked : false }, App.usuario);
            UI.toast(`Distrito "${salvo.nome}" ${d ? 'atualizado' : 'criado'}.`, 'sucesso');
            renderLista();
            if (!d) setTimeout(() => abrirFormMicro(salvo, null), 150); // já emenda o cadastro da primeira microrregião
          } }
        ]
      });
    }

    // ---------- formulário da microrregião ----------
    // Interpreta uma linha colada: "Casca", "Casca/RS", "Casca - RS", "Casca;RS", "Casca<TAB>RS", ou vários nomes separados por ; ou ,
    function interpretarLinhas(texto) {
      const itens = [];
      for (const linha of String(texto || '').split(/\r?\n/)) {
        const t = linha.trim();
        if (!t) continue;
        const celulas = t.split('\t').map(x => x.trim()).filter(Boolean);
        const ufCel = celulas.slice(1).find(x => /^[A-Za-z]{2}$/.test(x) && Store.UFS[x.toUpperCase()]);
        if (celulas.length > 1 && ufCel) { itens.push({ nome: celulas[0], uf: ufCel.toUpperCase() }); continue; }
        const base = celulas.length > 1 ? celulas[0] : t;
        const mt = base.match(/^(.*?)\s*[\/;,\-–]\s*([A-Za-z]{2})$/);
        if (mt && Store.UFS[mt[2].toUpperCase()]) { itens.push({ nome: mt[1].trim(), uf: mt[2].toUpperCase() }); continue; }
        base.split(/[;,]/).map(x => x.trim()).filter(Boolean).forEach(nome => itens.push({ nome, uf: null }));
      }
      return itens;
    }

    function abrirFormMicro(d, m) {
      const ufDist = d.uf || ufPadrao();
      let selecionadas = (m ? (m.cidadeIds || []) : []).map(id => Store.cidade(id)).filter(Boolean);
      let poloId = m && m.poloCidadeId && Store.cidade(m.poloCidadeId) ? m.poloCidadeId : (selecionadas[0] ? selecionadas[0].id : null);
      let pendentes = [];            // nomes não encontrados: [{ texto, uf }]
      const mover = new Set();       // cidades a transferir de outra microrregião
      const poloIni = poloId ? Store.cidade(poloId) : null;
      const corIni = m ? m.cor : Store.corSugeridaMicro(d);
      let nomeAutomatico = !m || (poloIni && m.nome === poloIni.nome); // o nome acompanha a polo até o usuário digitar outro

      const corpo = document.createElement('div');
      corpo.innerHTML = `
        <div class="form-contexto"><span class="ponto-cor" style="background:${UI.esc(d.cor)}"></span>Distrito <b>&nbsp;${UI.esc(d.nome)}</b>${d.uf ? `&nbsp;· ${d.uf}` : ''}
          ${m ? `<span class="muted">&nbsp;· editando <b>${UI.esc(m.nome)}</b></span>` : ''}</div>

        <div class="passo">
          <div class="passo-titulo"><span class="passo-num">1</span> Cidade polo (sede da microrregião)</div>
          <div class="linha" style="gap:8px;align-items:flex-start">
            <div style="flex:1;min-width:220px"><input id="mi-polo" placeholder="Digite o nome e escolha na lista…" value="${poloIni ? UI.esc(poloIni.nome) : ''}" ${poloId ? `data-cidade-id="${poloId}"` : ''}></div>
            <select id="mi-uf" style="width:84px" title="Estado das cidades desta microrregião">${UI.opcoesUF(poloIni ? poloIni.uf : ufDist, false)}</select>
          </div>
          <div id="mi-polo-info" class="ajuda-inline"></div>
        </div>

        <div class="passo">
          <div class="passo-titulo"><span class="passo-num">2</span> Nome e cor</div>
          <div class="form-linha">
            <label>Nome da microrregião<input id="mi-nome" value="${m ? UI.esc(m.nome) : ''}" placeholder="Preenchido com o nome da cidade polo"></label>
            <label>Tom no mapa <span class="muted" style="font-weight:400">(tons da cor do distrito)</span><div class="linha" style="gap:8px;margin-top:4px"><input type="color" id="mi-cor" value="${UI.esc(corIni)}">${paletaHTML(Store.gerarTons(d.cor, 12), corIni)}</div></label>
          </div>
        </div>

        <div class="passo">
          <div class="passo-titulo"><span class="passo-num">3</span> Cidades atendidas <span class="muted small" id="mi-qtd"></span></div>
          <div class="form-linha">
            <div>
              <label style="margin:0">Colar lista (uma por linha, ou separadas por ; ou ,)<textarea id="mi-lote" rows="4" placeholder="CASCA&#10;ITAPUCA&#10;MONTAURI&#10;SÃO DOMINGOS DO SUL"></textarea></label>
              <button type="button" class="btn btn-pequeno" id="mi-add-lote" style="margin-top:6px">Adicionar da lista</button>
            </div>
            <label>Ou digite uma cidade por vez<input id="mi-cidade" placeholder="Digite e escolha na lista…">
              <span class="ajuda-inline">Ao escolher na lista (ou teclar Enter) a cidade entra na microrregião. Clique em &#9733; para tornar polo, &times; para remover.</span></label>
          </div>
          <div id="mi-chips" class="chips-wrap chips-caixa" style="margin-top:10px"></div>
          <div id="mi-pendentes"></div>
          <div id="mi-conflitos"></div>
        </div>`;

      const q = s => corpo.querySelector(s);
      const poloInp = q('#mi-polo'), ufSel = q('#mi-uf'), nomeInp = q('#mi-nome'), corInp = q('#mi-cor'), cidInp = q('#mi-cidade');
      const uf = () => ufSel.value;
      ligarPaleta(corpo, '#mi-cor');
      corInp.addEventListener('change', renderChips);
      corInp.addEventListener('input', renderChips);
      nomeInp.addEventListener('input', () => { nomeAutomatico = !nomeInp.value.trim(); });

      function definirPolo(c) {
        poloId = c.id;
        poloInp.value = c.nome; poloInp.dataset.cidadeId = c.id;
        if (Store.UFS[c.uf]) ufSel.value = c.uf;
        if (!selecionadas.some(x => x.id === c.id)) selecionadas.unshift(c);
        if (nomeAutomatico || !nomeInp.value.trim()) { nomeInp.value = c.nome; nomeAutomatico = true; }
        atualizar();
      }
      const geocodificar = async (texto, ufv, depois) => {
        try {
          const c = await Geo.geocodificarESalvar(texto, ufv);
          UI.toast(`${c.nome}/${c.uf} encontrada na internet e adicionada à base de cidades.`, 'sucesso', 4000);
          depois(c);
        } catch (e) { UI.toast(e.message, 'erro', 6000); }
      };
      UI.autocompleteCidade(poloInp, { uf, aoSelecionar: definirPolo, aoGeocodificar: (t, u) => geocodificar(t, u, definirPolo) });
      // digitou o nome e saiu do campo sem escolher na lista: tenta resolver sozinho
      poloInp.addEventListener('blur', () => setTimeout(() => {
        if (poloInp.dataset.cidadeId && poloInp.dataset.cidadeId === poloId) return;
        const t = poloInp.value.trim();
        if (!t) return;
        const c = resolverTexto(t, uf());
        if (c) definirPolo(c); else atualizarPoloInfo(t);
      }, 200));
      poloInp.addEventListener('input', () => { if (!poloInp.value.trim()) atualizarPoloInfo(); });

      function adicionarCidade(c) {
        if (!selecionadas.some(x => x.id === c.id)) selecionadas.push(c);
        if (!poloId) definirPolo(c); else atualizar();
      }
      function adicionarNomes(itens) {
        let add = 0, rep = 0;
        const naoAchadas = [];
        for (const it of itens) {
          const ufItem = it.uf || uf();
          const c = resolverTexto(it.nome, ufItem);
          if (!c) { naoAchadas.push({ texto: it.nome, uf: ufItem }); continue; }
          if (selecionadas.some(x => x.id === c.id)) { rep++; continue; }
          selecionadas.push(c); add++;
        }
        for (const p of naoAchadas) if (!pendentes.some(x => Store.normalizar(x.texto) === Store.normalizar(p.texto) && x.uf === p.uf)) pendentes.push(p);
        if (!poloId && selecionadas.length) {
          // sem polo ainda: usa a cidade com o nome da microrregião, senão a primeira da lista
          const nomeMicro = Store.normalizar(nomeInp.value);
          definirPolo(selecionadas.find(c => nomeMicro && Store.normalizar(c.nome) === nomeMicro) || selecionadas[0]);
        } else atualizar();
        const partes = [];
        if (add) partes.push(`${add} adicionada(s)`);
        if (rep) partes.push(`${rep} já estava(m) na lista`);
        if (naoAchadas.length) partes.push(`${naoAchadas.length} não encontrada(s)`);
        if (partes.length) UI.toast(partes.join(' · '), naoAchadas.length ? 'aviso' : 'sucesso');
      }
      q('#mi-add-lote').addEventListener('click', () => {
        const itens = interpretarLinhas(q('#mi-lote').value);
        if (!itens.length) { UI.toast('Cole ao menos uma cidade.', 'aviso'); return; }
        adicionarNomes(itens);
        q('#mi-lote').value = '';
      });
      q('#mi-lote').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); q('#mi-add-lote').click(); } });
      UI.autocompleteCidade(cidInp, {
        uf,
        aoSelecionar(c) { cidInp.value = ''; delete cidInp.dataset.cidadeId; adicionarCidade(c); setTimeout(() => cidInp.focus(), 30); },
        aoGeocodificar: (t, u) => geocodificar(t, u, c => { cidInp.value = ''; adicionarCidade(c); })
      });
      cidInp.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const t = cidInp.value.trim();
        if (!t) return;
        adicionarNomes(interpretarLinhas(t));
        cidInp.value = '';
      });

      function atualizarPoloInfo(textoNaoAchado) {
        const info = q('#mi-polo-info');
        const polo = poloId ? Store.cidade(poloId) : null;
        if (polo) {
          const conf = Store.conflitosCidades([polo.id], m ? m.id : null)[0];
          info.innerHTML = `&#128081; Polo: <b>${UI.esc(polo.nome)}/${polo.uf}</b> — dá nome à microrregião e recebe destaque no mapa.` +
            (conf ? ` <span class="status-erro">Esta cidade está em ${UI.esc(conf.distrito.nome)} · ${UI.esc(conf.micro.nome)}; marque "mover" abaixo.</span>` : '');
        } else if (textoNaoAchado) {
          info.innerHTML = `<span class="status-erro">"${UI.esc(textoNaoAchado)}" não foi encontrada em ${uf()}.</span> Confira a grafia, troque o estado ou use a opção "buscar na internet" da lista.`;
        } else info.textContent = 'A cidade principal da microrregião. Ela dá o nome à microrregião e recebe destaque no mapa.';
      }
      function renderChips() {
        const wrap = q('#mi-chips');
        q('#mi-qtd').textContent = selecionadas.length ? `(${selecionadas.length})` : '';
        if (!selecionadas.length) { wrap.innerHTML = '<span class="muted small">Nenhuma cidade ainda. Escolha a cidade polo no passo 1 ou cole a lista.</span>'; return; }
        const polo = selecionadas.find(c => c.id === poloId);
        const outras = selecionadas.filter(c => c.id !== poloId).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        wrap.innerHTML = (polo ? `<span class="chip-cidade chip-polo" style="--cor:${UI.esc(corInp.value)};color:${Store.corTexto(corInp.value)}" title="Cidade polo">&#128081; ${UI.esc(polo.nome)}/${polo.uf}</span>` : '') +
          outras.map(c => `<span class="chip-cidade chip-editavel" data-id="${c.id}">${UI.esc(c.nome)}/${c.uf}
            <button type="button" class="chip-btn chip-polo-btn" title="Tornar cidade polo">&#9733;</button><button type="button" class="chip-btn chip-x" title="Remover da microrregião">&times;</button></span>`).join('');
        wrap.querySelectorAll('.chip-polo-btn').forEach(b => b.addEventListener('click', () => { const c = Store.cidade(b.closest('.chip-cidade').dataset.id); if (c) definirPolo(c); }));
        wrap.querySelectorAll('.chip-x').forEach(b => b.addEventListener('click', () => { const id = b.closest('.chip-cidade').dataset.id; selecionadas = selecionadas.filter(c => c.id !== id); mover.delete(id); atualizar(); }));
      }
      function renderPendentes() {
        const box = q('#mi-pendentes');
        if (!pendentes.length) { box.innerHTML = ''; return; }
        box.innerHTML = `<div class="caixa caixa-aviso"><b>${pendentes.length} nome(s) não encontrado(s)</b> — confira a grafia e o estado, ou busque as coordenadas na internet.
          ${Store.temIBGE() ? '' : ' A lista completa do IBGE (5.570 municípios) resolve a maioria dos casos: <button type="button" class="btn btn-pequeno" id="pend-ibge">Baixar lista do IBGE agora</button>'}
          <ul>${pendentes.map((p, i) => `<li><span>${UI.esc(p.texto)} <span class="muted">(${p.uf})</span></span>
            <span class="linha" style="gap:4px"><button type="button" class="btn btn-pequeno pend-buscar" data-i="${i}">Buscar na internet</button>
            <button type="button" class="btn-icone pend-remover" data-i="${i}" title="Descartar este nome">&times;</button></span></li>`).join('')}</ul></div>`;
        box.querySelectorAll('.pend-buscar').forEach(b => b.addEventListener('click', async () => {
          const p = pendentes[+b.dataset.i];
          b.disabled = true; b.textContent = 'Buscando…';
          await geocodificar(p.texto, p.uf, c => { pendentes = pendentes.filter(x => x !== p); adicionarCidade(c); });
          if (pendentes.includes(p)) { b.disabled = false; b.textContent = 'Buscar na internet'; }
        }));
        box.querySelectorAll('.pend-remover').forEach(b => b.addEventListener('click', () => { pendentes.splice(+b.dataset.i, 1); renderPendentes(); }));
        const bi = box.querySelector('#pend-ibge');
        if (bi) bi.addEventListener('click', async () => {
          bi.disabled = true;
          try {
            const n = await Geo.importarIBGE(t => bi.textContent = t);
            Store.auditar('cidades.ibge', `Lista IBGE carregada (${n} municípios)`, App.usuario);
            UI.toast(`${UI.fmtNum(n)} municípios carregados. Tentando de novo os nomes pendentes…`, 'sucesso');
            const antigos = pendentes; pendentes = [];
            adicionarNomes(antigos.map(p => ({ nome: p.texto, uf: p.uf })));
          } catch (e) { UI.toast(e.message, 'erro', 7000); bi.disabled = false; bi.textContent = 'Baixar lista do IBGE agora'; }
        });
      }
      function renderConflitos() {
        const box = q('#mi-conflitos');
        const conflitos = Store.conflitosCidades(selecionadas.map(c => c.id), m ? m.id : null);
        for (const id of [...mover]) if (!conflitos.some(c => c.cidadeId === id)) mover.delete(id);
        if (!conflitos.length) { box.innerHTML = ''; return; }
        box.innerHTML = `<div class="caixa caixa-conflito"><b>${conflitos.length} cidade(s) já pertence(m) a outra microrregião.</b>
          Cada cidade fica em uma só: marque as que devem ser transferidas para esta; as não marcadas ficam onde estão e não serão salvas aqui.
          <ul>${conflitos.map(c => `<li><label class="check"><input type="checkbox" class="conf-mover" value="${c.cidadeId}" ${mover.has(c.cidadeId) ? 'checked' : ''}>
            Mover <b>&nbsp;${UI.esc(c.cidade ? c.cidade.nome : c.cidadeId)}&nbsp;</b> <span class="muted">de ${UI.esc(c.distrito.nome)} · ${UI.esc(c.micro.nome)}</span></label></li>`).join('')}</ul>
          <button type="button" class="btn-link small" id="conf-todas" style="margin-top:6px">Marcar todas</button></div>`;
        box.querySelectorAll('.conf-mover').forEach(ch => ch.addEventListener('change', () => { if (ch.checked) mover.add(ch.value); else mover.delete(ch.value); atualizarPoloInfo(); }));
        box.querySelector('#conf-todas').addEventListener('click', () => { conflitos.forEach(c => mover.add(c.cidadeId)); renderConflitos(); atualizarPoloInfo(); });
      }
      function atualizar() { renderChips(); renderPendentes(); renderConflitos(); atualizarPoloInfo(); }
      atualizar();

      UI.modal({
        titulo: m ? `Editar microrregião — ${m.nome}` : `Nova microrregião em ${d.nome}`,
        corpo, largura: '760px', fecharAoClicarFora: false,
        botoes: [
          { texto: 'Cancelar' },
          { texto: m ? 'Salvar alterações' : 'Criar microrregião', classe: 'btn-primario', acao: () => {
            if (!poloId && poloInp.value.trim()) {
              const c = resolverTexto(poloInp.value, uf());
              if (c) definirPolo(c);
            }
            if (!poloId) throw new Error('Escolha a cidade polo da microrregião (passo 1).');
            const nome = nomeInp.value.trim() || Store.cidade(poloId).nome;
            const conflitos = Store.conflitosCidades(selecionadas.map(c => c.id), m ? m.id : null);
            const bloqueadas = new Set(conflitos.filter(c => !mover.has(c.cidadeId)).map(c => c.cidadeId));
            if (bloqueadas.has(poloId)) throw new Error('A cidade polo pertence a outra microrregião. Marque "Mover" para transferi-la, ou escolha outra polo.');
            const cidadeIds = selecionadas.filter(c => !bloqueadas.has(c.id)).map(c => c.id);
            Store.salvarMicro(d.id, { id: m ? m.id : null, nome, cor: corInp.value, poloCidadeId: poloId, cidadeIds }, App.usuario, { mover: [...mover] });
            const avisos = [];
            if (bloqueadas.size) avisos.push(`${bloqueadas.size} cidade(s) de outra microrregião não foram incluídas`);
            if (pendentes.length) avisos.push(`${pendentes.length} nome(s) não encontrado(s) foram descartados`);
            UI.toast(`Microrregião "${nome}" salva com ${cidadeIds.length} cidade(s).${avisos.length ? ' ' + avisos.join('; ') + '.' : ''}`, avisos.length ? 'aviso' : 'sucesso', avisos.length ? 6000 : 3000);
            renderLista();
          } }
        ]
      });
    }

    // ---------- importação de planilha ----------
    // Lista simples (uma coluna): o nome da microrregião na 1ª linha do bloco e as cidades nas linhas seguintes.
    // Começa um bloco novo: linha em branco, linha terminada em ":" ou linha em CAIXA ALTA (quando o resto está em minúsculas).
    // A linha do nome também vale como cidade polo, se existir uma cidade com esse nome.
    function interpretarBlocos(linhasTexto) {
      const itens = [];
      const TITULOS = new Set(['cidade', 'cidades', 'municipio', 'municipios', 'microrregiao', 'microrregioes', 'micro']);
      const temMinusculas = linhasTexto.some(l => /[a-zà-ú]/.test(l));
      let micro = '', novoBloco = true;
      linhasTexto.forEach((bruta, i) => {
        const t = String(bruta || '').trim();
        if (!t) { novoBloco = true; return; }
        const nome = t.replace(/\s*:\s*$/, '');
        if (TITULOS.has(Store.normalizar(nome))) return; // título de coluna copiado junto
        const letras = nome.replace(/[^A-Za-zÀ-ÿ]/g, '');
        const caixaAlta = temMinusculas && letras.length >= 3 && letras === letras.toUpperCase();
        if (novoBloco || /:\s*$/.test(t) || caixaAlta) {
          micro = nome; novoBloco = false;
          itens.push({ linha: i + 1, distrito: '', micro, cidade: nome, ufCidade: null, polo: true, cabecalho: true, status: 'pendente', cidadeObj: null, erro: '', ajuste: '' });
          return;
        }
        const it = interpretarLinhas(t)[0] || { nome: t, uf: null };
        itens.push({ linha: i + 1, distrito: '', micro, cidade: it.nome, ufCidade: it.uf, polo: false, status: 'pendente', cidadeObj: null, erro: '', ajuste: '' });
      });
      return itens;
    }

    // Colunas: [DISTRITO] | MICRORREGIÃO | CIDADE | [POLO]. Cabeçalho reconhecido automaticamente.
    // textoBruto (quando colado) preserva as linhas em branco, que separam os blocos da lista simples.
    function interpretarPlanilha(matriz, textoBruto = null) {
      const n = s => Store.normalizar(s);
      const ehPolo = v => /^(sim|s|x|polo|sede|1|true|verdadeiro)$/.test(n(v));
      const ehMarcaPolo = v => v === '' || ehPolo(v) || /^(nao|n|0|false|falso)$/.test(n(v));
      const largura = Math.max(0, ...matriz.map(l => l.filter(v => v !== '').length));
      if (largura <= 1) {
        return interpretarBlocos(textoBruto != null ? textoBruto.split(/\r?\n/) : matriz.map(l => l.find(v => v !== '') || ''));
      }
      let iDist = -1, iMicro = -1, iCid = -1, iPolo = -1, inicio = 0;
      for (let i = 0; i < Math.min(matriz.length, 3); i++) {
        const cab = matriz[i].map(n);
        const mi = cab.findIndex(h => /micro/.test(h));
        const ci = cab.findIndex(h => /cidade|municipio/.test(h) && !/polo|sede/.test(h));
        if (mi >= 0 && ci >= 0) {
          iMicro = mi; iCid = ci;
          iDist = cab.findIndex(h => /distrito|regional/.test(h));
          iPolo = cab.findIndex(h => /polo|sede/.test(h));
          inicio = i + 1;
          break;
        }
      }
      if (iMicro < 0) {
        // sem cabeçalho: deduz pela quantidade de colunas
        if (largura >= 4) { iDist = 0; iMicro = 1; iCid = 2; iPolo = 3; }
        else if (largura === 3) {
          const terceiraEhPolo = matriz.every(l => ehMarcaPolo(l[2] || ''));
          if (terceiraEhPolo) { iMicro = 0; iCid = 1; iPolo = 2; } else { iDist = 0; iMicro = 1; iCid = 2; }
        } else { iMicro = 0; iCid = 1; }
      }
      const linhas = [];
      let ultimaMicro = '', ultimoDist = '';
      for (let i = inicio; i < matriz.length; i++) {
        const cel = matriz[i];
        if (!cel.some(v => v)) continue;
        // célula de microrregião vazia = repete a de cima (planilhas "mescladas")
        const micro = String(iMicro >= 0 ? cel[iMicro] || '' : '').trim() || ultimaMicro;
        const dist = String(iDist >= 0 ? cel[iDist] || '' : '').trim() || ultimoDist;
        const cidadeTxt = String(iCid >= 0 ? cel[iCid] || '' : '').trim();
        if (micro) ultimaMicro = micro;
        if (dist) ultimoDist = dist;
        if (!cidadeTxt) continue;
        const it = interpretarLinhas(cidadeTxt)[0] || { nome: cidadeTxt, uf: null };
        linhas.push({ linha: i + 1, distrito: dist, micro, cidade: it.nome, ufCidade: it.uf, polo: iPolo >= 0 ? ehPolo(cel[iPolo] || '') : false, status: 'pendente', cidadeObj: null, erro: '', ajuste: '' });
      }
      return linhas;
    }

    function abrirImportacao() {
      const distritos = Store.distritos().slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      const corpo = document.createElement('div');
      corpo.innerHTML = `
        <p class="muted small">Aceita dois formatos: <b>lista simples</b> — o nome da microrregião na primeira linha e as cidades nas linhas abaixo (separe as microrregiões com uma linha em branco, ou escreva o nome em MAIÚSCULAS) — ou <b>planilha</b> com as colunas <b>MICRORREGIÃO</b> e <b>CIDADE</b> (opcionais: <b>POLO</b> com "sim"/"x" e <b>DISTRITO</b>, para vários distritos de uma vez), colada ou em arquivo .xlsx/.csv.
          Microrregiões que não existem são criadas; nas existentes as cidades são acrescentadas. A cidade com o nome da microrregião vira a polo.</p>
        <div class="form-linha">
          <label>Colar a lista ou a planilha<textarea class="colar" id="imp-texto" placeholder="DAVID CANABARRO&#10;David Canabarro&#10;Caseiros&#10;Ciríaco&#10;&#10;NOVA PRATA&#10;Nova Prata&#10;Guaporé&#10;Veranópolis&#10;&#10;(ou colunas: MICRORREGIÃO · CIDADE · POLO)"></textarea></label>
          <div>
            <label>Ou arquivo (.xlsx, .xls, .csv, .txt)<input type="file" id="imp-arquivo" accept=".xlsx,.xls,.csv,.txt"></label>
            <label>Distrito de destino<select id="imp-distrito">
              ${distritos.map(d => `<option value="${d.id}">${UI.esc(d.nome)}${d.uf ? ' (' + d.uf + ')' : ''}</option>`).join('')}
              <option value="__novo__" ${distritos.length ? '' : 'selected'}>Criar novo distrito…</option>
              <option value="__coluna__">Usar a coluna DISTRITO da planilha</option></select></label>
            <label id="imp-novo-wrap" ${distritos.length ? 'hidden' : ''}>Nome do novo distrito<input id="imp-novo-nome" placeholder="Ex.: Lagoa Vermelha"></label>
            <label>Estado (UF) das cidades<select id="imp-uf">${UI.opcoesUF(distritos[0] && distritos[0].uf ? distritos[0].uf : ufPadrao(), false)}</select></label>
            <label class="check"><input type="checkbox" id="imp-mover" checked> Transferir cidades que já estejam em outra microrregião</label>
            <button class="btn btn-primario" id="imp-analisar">Analisar linhas</button>
          </div>
        </div>
        <div id="imp-resultado" class="mt"></div>`;
      const q = s => corpo.querySelector(s);
      const selDist = q('#imp-distrito');
      selDist.addEventListener('change', () => {
        q('#imp-novo-wrap').hidden = selDist.value !== '__novo__';
        const d = Store.distrito(selDist.value);
        if (d && d.uf) q('#imp-uf').value = d.uf;
      });
      let linhas = [], matrizArquivo = null;
      q('#imp-arquivo').addEventListener('change', async e => {
        const arq = e.target.files[0]; if (!arq) return;
        try { matrizArquivo = await UI.lerArquivo(arq); UI.toast(`${matrizArquivo.length} linha(s) lida(s) do arquivo.`, 'sucesso'); }
        catch (err) { UI.toast(err.message, 'erro', 6000); matrizArquivo = null; }
      });
      const modal = UI.modal({
        titulo: 'Importar distritos e microrregiões de planilha',
        corpo, largura: '920px', fecharAoClicarFora: false,
        botoes: [{ texto: 'Fechar' }, { texto: 'Importar linhas válidas', classe: 'btn-primario', acao: importar }]
      });
      const btnImportar = modal.el.querySelector('.modal-rodape .btn-primario');
      btnImportar.disabled = true;

      q('#imp-analisar').addEventListener('click', async () => {
        const texto = q('#imp-texto').value;
        const matriz = texto.trim() ? UI.csvParse(texto) : matrizArquivo;
        if (!matriz || !matriz.length) { UI.toast('Cole as linhas ou escolha um arquivo.', 'aviso'); return; }
        linhas = interpretarPlanilha(matriz, texto.trim() ? texto : null);
        if (!linhas.length) { UI.toast('Não encontrei linhas com microrregião e cidade. Coloque o nome da microrregião na primeira linha e as cidades abaixo.', 'aviso', 6000); return; }
        await resolverLinhas();
      });
      function destinoLinha(l) {
        const modo = selDist.value;
        if (modo === '__coluna__') return l.distrito || '';
        if (modo === '__novo__') return q('#imp-novo-nome').value.trim();
        const d = Store.distrito(modo);
        return d ? d.nome : '';
      }
      const ehValida = l => l.status === 'ok' && !!destinoLinha(l);
      function situacao(l) {
        if (l.status === 'buscando') return '<span class="status-espera">buscando na internet…</span>';
        if (l.status !== 'ok') return `<span class="status-erro">${UI.esc(l.erro || 'não encontrada')}</span>`;
        if (!destinoLinha(l)) return '<span class="status-erro">informe o distrito de destino</span>';
        const conf = Store.conflitosCidades([l.cidadeObj.id])[0];
        let txt = `<span class="status-ok">OK</span> <span class="muted small">${UI.esc(l.cidadeObj.nome)}/${l.cidadeObj.uf}${l.ajuste ? ' · ajustado: ' + UI.esc(l.ajuste) : ''}`;
        if (conf && !(Store.normalizar(conf.micro.nome) === Store.normalizar(l.micro) && Store.normalizar(conf.distrito.nome) === Store.normalizar(destinoLinha(l)))) {
          txt += q('#imp-mover').checked ? ` · <span class="status-espera">será movida de ${UI.esc(conf.distrito.nome)} · ${UI.esc(conf.micro.nome)}</span>` : ` · <span class="status-erro">já está em ${UI.esc(conf.distrito.nome)} · ${UI.esc(conf.micro.nome)} (será ignorada)</span>`;
        }
        return txt + '</span>';
      }
      function renderResultado(msg) {
        const validas = linhas.filter(ehValida).length;
        const micros = new Set(linhas.filter(ehValida).map(l => Store.normalizar(destinoLinha(l)) + '|' + Store.normalizar(l.micro))).size;
        const res = q('#imp-resultado');
        res.innerHTML = `<div class="linha entre mb"><b>${linhas.length} linha(s) · ${validas} válida(s) · ${micros} microrregião(ões)</b><span class="muted small">${UI.esc(msg || '')}</span></div>` +
          (linhas.some(l => l.status === 'erro') && !Store.temIBGE() ? `<div class="banner banner-aviso mb" style="border-radius:8px">Algumas cidades não foram encontradas. Baixar a lista completa de municípios resolve a maioria dos casos. <button class="btn btn-pequeno" id="imp-ibge">Baixar agora</button></div>` : '') +
          `<div style="max-height:320px;overflow:auto">` + UI.tabela({
            colunas: [
              { titulo: 'Linha', render: l => l.linha },
              { titulo: 'Distrito', render: l => UI.esc(destinoLinha(l)) || '<span class="status-erro">?</span>' },
              { titulo: 'Microrregião', render: l => UI.esc(l.micro) },
              { titulo: 'Cidade', render: l => UI.esc(l.cidade) + (l.ufCidade ? '/' + l.ufCidade : '') },
              { titulo: 'Polo', render: l => l.polo ? '&#128081; polo' : '' },
              { titulo: 'Situação', render: situacao }
            ], linhas
          }) + '</div>';
        const b = res.querySelector('#imp-ibge');
        if (b) b.addEventListener('click', async () => {
          b.disabled = true; b.textContent = 'Baixando…';
          try { const n = await Geo.importarIBGE(t => b.textContent = t); Store.auditar('cidades.ibge', `Lista IBGE carregada (${n} municípios)`, App.usuario); UI.toast(`${n} municípios carregados.`, 'sucesso'); await resolverLinhas(); }
          catch (e) { UI.toast(e.message, 'erro', 6000); b.disabled = false; b.textContent = 'Baixar agora'; }
        });
        btnImportar.disabled = validas === 0;
      }
      q('#imp-mover').addEventListener('change', () => { if (linhas.length) renderResultado(); });
      selDist.addEventListener('change', () => { if (linhas.length) renderResultado(); });
      q('#imp-novo-nome').addEventListener('input', UI.debounce(() => { if (linhas.length) renderResultado(); }, 200));
      async function resolverLinhas() {
        const ufPad = q('#imp-uf').value;
        const pendencias = [];
        for (const l of linhas) {
          l.cidadeObj = null; l.erro = ''; l.ajuste = ''; l.status = 'ok';
          if (!l.micro) { l.status = 'erro'; l.erro = 'microrregião não informada (coloque o nome dela na 1ª linha do bloco)'; continue; }
          const ufL = l.ufCidade || ufPad;
          l.cidadeObj = Store.resolverCidade(l.cidade, ufL);
          if (!l.cidadeObj) { const c = Store.cidadeAproximada(l.cidade, ufL); if (c) { l.cidadeObj = c; l.ajuste = `${l.cidade} → ${c.nome}`; } }
          if (!l.cidadeObj && l.cabecalho) { l.status = 'oculta'; continue; } // nome da microrregião que não é uma cidade: não é erro
          if (!l.cidadeObj) { l.status = 'buscando'; pendencias.push({ l, uf: ufL }); }
        }
        // nome da microrregião com grafia bonita: o da cidade polo (ex.: "DAVID CANABARRO" -> "David Canabarro")
        const nomesMicro = new Map();
        for (const l of linhas) {
          if (!l.cabecalho) continue;
          const k = Store.normalizar(l.micro);
          if (l.cidadeObj) nomesMicro.set(k, l.cidadeObj.nome);
          else if (l.micro === l.micro.toUpperCase()) nomesMicro.set(k, Geo.capitalizar(l.micro));
        }
        for (const l of linhas) { const bonito = nomesMicro.get(Store.normalizar(l.micro)); if (bonito) l.micro = bonito; }
        linhas = linhas.filter(l => l.status !== 'oculta');
        renderResultado();
        const distintas = [...new Set(pendencias.map(x => Store.normalizar(x.l.cidade) + '|' + x.uf))];
        let feitas = 0;
        for (const chave of distintas) {
          const grupo = pendencias.filter(x => Store.normalizar(x.l.cidade) + '|' + x.uf === chave);
          renderResultado(`Buscando coordenadas ${++feitas} de ${distintas.length}…`);
          try {
            const c = await Geo.geocodificarESalvar(grupo[0].l.cidade, grupo[0].uf);
            grupo.forEach(x => { x.l.cidadeObj = c; x.l.status = 'ok'; });
          } catch (e) {
            grupo.forEach(x => { x.l.status = 'erro'; x.l.erro = `"${x.l.cidade}" (${x.uf}) não encontrada`; });
          }
        }
        renderResultado(distintas.length ? 'Busca concluída.' : '');
      }
      async function importar() {
        const validas = linhas.filter(ehValida);
        if (!validas.length) throw new Error('Nenhuma linha válida para importar.');
        const invalidas = linhas.length - validas.length;
        if (invalidas && !(await UI.confirmar(`${invalidas} linha(s) com problema serão ignoradas. Importar as ${validas.length} válidas?`))) return false;
        const mover = q('#imp-mover').checked;
        const ufPad = q('#imp-uf').value;
        // agrupa por distrito (cria os que não existem)
        const grupos = new Map();
        for (const l of validas) {
          const nomeDist = destinoLinha(l);
          const k = Store.normalizar(nomeDist);
          if (!grupos.has(k)) grupos.set(k, { nome: nomeDist, itens: [] });
          grupos.get(k).itens.push({ micro: l.micro, cidadeId: l.cidadeObj.id, polo: l.polo });
        }
        const total = { distritosCriados: 0, microsCriadas: 0, microsAtualizadas: 0, cidades: 0, movidas: 0, ignoradas: 0 };
        for (const g of grupos.values()) {
          let d = Store.distritos().find(x => Store.normalizar(x.nome) === Store.normalizar(g.nome));
          if (!d) { d = Store.salvarDistrito({ nome: g.nome, uf: ufPad }, App.usuario); total.distritosCriados++; }
          else if (!d.uf) Store.salvarDistrito({ id: d.id, nome: d.nome, uf: ufPad, cor: d.cor, descricao: d.descricao }, App.usuario);
          const r = Store.importarEstrutura(d.id, g.itens, App.usuario, { mover });
          total.microsCriadas += r.microsCriadas; total.microsAtualizadas += r.microsAtualizadas; total.cidades += r.cidades; total.movidas += r.movidas; total.ignoradas += r.ignoradas;
        }
        const partes = [];
        if (total.distritosCriados) partes.push(`${total.distritosCriados} distrito(s) criado(s)`);
        partes.push(`${total.microsCriadas} microrregião(ões) criada(s)`, `${total.microsAtualizadas} atualizada(s)`, `${total.cidades} cidade(s) vinculada(s)`);
        if (total.movidas) partes.push(`${total.movidas} transferida(s)`);
        if (total.ignoradas) partes.push(`${total.ignoradas} ignorada(s) por já estarem em outra microrregião`);
        UI.toast('Importação concluída: ' + partes.join(', ') + '.', 'sucesso', 7000);
        renderLista();
      }
    }

    // ---------- exportação ----------
    function exportarCSV() {
      const linhas = [['DISTRITO', 'UF', 'MICRORREGIAO', 'CIDADE', 'UF CIDADE', 'POLO', 'COR MICRORREGIAO']];
      for (const d of Store.distritos()) {
        for (const m of (d.micros || [])) {
          for (const id of (m.cidadeIds || [])) {
            const c = Store.cidade(id); if (!c) continue;
            linhas.push([d.nome, d.uf || '', m.nome, c.nome, c.uf, m.poloCidadeId === c.id ? 'SIM' : 'NAO', m.cor || '']);
          }
        }
      }
      if (linhas.length === 1) { UI.toast('Nenhuma cidade vinculada para exportar.', 'aviso'); return; }
      UI.baixarCSV('distritos-microrregioes.csv', linhas);
      Store.auditar('relatorio.exportar', 'Distritos e microrregiões (CSV)', App.usuario);
    }

    renderLista();
  }
};
