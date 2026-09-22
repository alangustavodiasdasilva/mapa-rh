// Estrutura da aplicação: login, menu lateral, filtros globais e navegação entre páginas.
// (Paginas é definido em ui.js, carregado antes das páginas)

const ICONES = {
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  mapa: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  cadastro: '<path d="M3 5h18v14H3z"/><path d="M3 10h18M3 15h18M9 5v14"/>',
  projetos: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  cidades: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
  distritos: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/><circle cx="6.5" cy="6.5" r="1.5" fill="currentColor"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor"/><circle cx="6.5" cy="17.5" r="1.5" fill="currentColor"/>',
  pdrs: '<path d="M7 21h10V9l-5-5-5 5v12z"/><path d="M7 9h10"/><path d="M12 4v17"/>',
  relatorios: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  usuarios: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  auditoria: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
  backup: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
  sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>'
};
function icone(nome, tam = 18) {
  return `<svg width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[nome] || ''}</svg>`;
}

const App = {
  usuario: null,
  filtros: { projetoId: '', distritoId: '', microId: '', tipo: '', uf: '' },
  paginaAtual: null,
  destruirAtual: null,
  MENU: [
    { id: 'dashboard', rotulo: 'Dashboard' },
    { id: 'mapa', rotulo: 'Mapa' },
    { id: 'cadastro', rotulo: 'Cadastro' },
    { id: 'projetos', rotulo: 'Projetos' },
    { id: 'cidades', rotulo: 'Cidades' },
    { id: 'distritos', rotulo: 'Distritos' },
    { id: 'pdrs', rotulo: 'Mapas PDRs' },
    { id: 'relatorios', rotulo: 'Relatórios' },
    { id: 'usuarios', rotulo: 'Controle de acesso' },
    { id: 'auditoria', rotulo: 'Auditoria' },
    { id: 'backup', rotulo: 'Backup' }
  ],

  init() {
    Store.init();
    if (window.Malha) Malha.limparCacheAntigo();
    try { Object.assign(this.filtros, JSON.parse(localStorage.getItem('maparh:filtros') || '{}')); } catch (e) { /* ignora */ }
    this.usuario = Store.usuarioAtual();
    if (!this.usuario) return this.renderLogin();
    this.renderShell();
    window.onhashchange = () => this.rotear();
    this.rotear();
  },

  // ---------- login ----------
  renderLogin() {
    document.getElementById('app').innerHTML = `
      <div class="login-wrap">
        <form class="login card" id="form-login" autocomplete="off">
          <div class="marca-login">${icone('mapa', 30)}<span>Mapa RH</span></div>
          <p class="muted">Controle de contratações por cidade de origem</p>
          <label>Usuário<input id="login-usuario" autocomplete="username" required></label>
          <label>Senha<input type="password" id="login-senha" autocomplete="current-password" required></label>
          <button class="btn btn-primario btn-bloco" type="submit">Entrar</button>
          <p class="erro" id="login-erro" hidden></p>
          <p class="muted small">Primeiro acesso: usuário <b>admin</b> e senha <b>admin</b>. Altere a senha depois de entrar.</p>
        </form>
      </div>`;
    document.getElementById('form-login').addEventListener('submit', e => {
      e.preventDefault();
      const u = Store.login(document.getElementById('login-usuario').value, document.getElementById('login-senha').value);
      if (!u) { const er = document.getElementById('login-erro'); er.textContent = 'Usuário ou senha inválidos (ou usuário inativo).'; er.hidden = false; return; }
      this.usuario = u;
      this.renderShell();
      window.onhashchange = () => this.rotear();
      this.rotear();
    });
    setTimeout(() => document.getElementById('login-usuario').focus(), 50);
  },

  sair() {
    Store.logout();
    this.usuario = null;
    if (this.destruirAtual) { try { this.destruirAtual(); } catch (e) { /* ignora */ } this.destruirAtual = null; }
    location.hash = '';
    this.renderLogin();
  },

  // ---------- estrutura ----------
  renderShell() {
    const u = this.usuario;
    const itens = this.MENU.filter(m => Store.pode(u, m.id))
      .map(m => `<a href="#/${m.id}" data-pagina="${m.id}">${icone(m.id)}<span>${m.rotulo}</span></a>`).join('');
    document.getElementById('app').innerHTML = `
      <div class="layout">
        <aside class="sidebar" id="sidebar">
          <div class="marca">${icone('mapa', 26)}<div><div>Mapa RH</div><small>Controle de contratações</small></div></div>
          <nav>${itens}</nav>
          <div class="rodape">
            <div class="usuario-nome">${UI.esc(u.nome)}</div>
            <div class="usuario-perfil">${UI.esc(Store.PERFIS[u.perfil])}</div>
            <div class="acoes"><a href="#" id="link-senha">Minha senha</a><a href="#" id="link-sair">${icone('sair', 14)} Sair</a></div>
            <div class="muted small" style="margin-top:6px" title="Se o número não bater com a versão publicada, aperte Ctrl+F5">versão ${UI.esc(App.versao())}</div>
          </div>
        </aside>
        <div class="sidebar-fundo" id="sidebar-fundo"></div>
        <div class="conteudo">
          <header class="topo">
            <button class="btn-icone" id="btn-menu" title="Mostrar / esconder o menu">${icone('menu', 22)}</button>
            <h1 id="titulo-pagina"></h1>
            <div class="filtros" id="filtros-wrap" title="Os filtros valem para todas as telas (mapa, dashboard, relatórios)">
              <span class="filtros-rotulo">${icone('mapa', 14)} Filtros</span>
              <div class="filtro-item" title="Projeto = estado/ano das contratações">
                <label class="filtro-label">Projeto</label>
                <select id="filtro-projeto"></select>
              </div>
              <div class="filtro-sep"></div>
              <div class="filtro-item" title="Só contratações com atuação nas cidades do distrito">
                <label class="filtro-label">Distrito</label>
                <select id="filtro-distrito"><option value="">Todos</option></select>
              </div>
              <div class="filtro-item" title="Só contratações com atuação nas cidades da microrregião">
                <label class="filtro-label">Microrregião</label>
                <select id="filtro-micro"><option value="">Todas</option></select>
              </div>
              <div class="filtro-sep"></div>
              <div class="filtro-item" title="Tipo da contratação">
                <label class="filtro-label">Local / Móvel</label>
                <select id="filtro-tipo">
                  <option value="">Todos</option>
                  <option value="LOCAL">Só LOCAL</option>
                  <option value="MOVEL">Só MÓVEL</option>
                </select>
              </div>
              <div class="filtro-item" id="filtro-item-uf" title="Estado de onde a pessoa vem">
                <label class="filtro-label">Vem de (estado)</label>
                <select id="filtro-uf">
                  <option value="">Todos</option>
                </select>
              </div>
              <button class="btn-limpar-filtros" id="btn-limpar-filtros" title="Limpar todos os filtros" style="display:none">✕ Limpar</button>
            </div>
          </header>
          <div id="banner"></div>
          <main class="pagina" id="pagina"></main>
        </div>
      </div>`;
    document.getElementById('link-sair').addEventListener('click', e => { e.preventDefault(); this.sair(); });
    document.getElementById('link-senha').addEventListener('click', e => { e.preventDefault(); this.modalSenha(); });
    // Menu lateral: em telas largas o botão recolhe/expande (lembrado); em telas pequenas abre por cima
    const telaLarga = () => window.innerWidth > 900;
    document.body.classList.toggle('menu-recolhido', localStorage.getItem('maparh:menu-recolhido') === '1');
    document.getElementById('btn-menu').addEventListener('click', () => {
      if (telaLarga()) {
        const rec = document.body.classList.toggle('menu-recolhido');
        localStorage.setItem('maparh:menu-recolhido', rec ? '1' : '0');
        if (App.mapaAtual) setTimeout(() => App.mapaAtual.invalidateSize(), 250);
      } else document.body.classList.toggle('menu-aberto');
    });
    document.getElementById('sidebar-fundo').addEventListener('click', () => document.body.classList.remove('menu-aberto'));
    document.querySelectorAll('#sidebar nav a').forEach(a => a.addEventListener('click', () => document.body.classList.remove('menu-aberto')));
    document.getElementById('filtro-tipo').value = this.filtros.tipo || '';
    document.getElementById('filtro-tipo').addEventListener('change', e => { this.filtros.tipo = e.target.value; this.aoMudarFiltros(); });
    document.getElementById('filtro-projeto').addEventListener('change', e => { this.filtros.projetoId = e.target.value; this.aoMudarFiltros(); });
    document.getElementById('filtro-distrito').addEventListener('change', e => { this.filtros.distritoId = e.target.value; this.filtros.microId = ''; this.aoMudarFiltros(); });
    document.getElementById('filtro-micro').addEventListener('change', e => {
      this.filtros.microId = e.target.value;
      const d = Store.distritos().find(x => (x.micros || []).some(m => m.id === this.filtros.microId));
      if (d) this.filtros.distritoId = d.id; // escolher a micro já define o distrito
      this.aoMudarFiltros();
    });
    document.getElementById('filtro-uf').addEventListener('change', e => { this.filtros.uf = e.target.value; this.aoMudarFiltros(); });
    document.getElementById('btn-limpar-filtros').addEventListener('click', () => {
      this.filtros.projetoId = ''; this.filtros.distritoId = ''; this.filtros.microId = ''; this.filtros.tipo = ''; this.filtros.uf = '';
      this.aoMudarFiltros();
    });
    this.atualizarFiltroProjetos();
    this.atualizarFiltroDistrito();
    this.atualizarFiltroUF();
    this.atualizarBanner();
  },

  atualizarFiltroProjetos() {
    const sel = document.getElementById('filtro-projeto');
    if (!sel) return;
    const lista = this.projetosVisiveis();
    if (this.filtros.projetoId && !lista.some(p => p.id === this.filtros.projetoId)) this.filtros.projetoId = '';
    sel.innerHTML = `<option value="">Todos os projetos</option>` +
      lista.map(p => `<option value="${p.id}" ${p.id === this.filtros.projetoId ? 'selected' : ''}>${UI.esc(Store.rotuloProjeto(p))}${p.ativo ? '' : ' (inativo)'}</option>`).join('');
  },

  atualizarFiltroDistrito() {
    const selD = document.getElementById('filtro-distrito'), selM = document.getElementById('filtro-micro');
    if (!selD || !selM) return;
    const distritos = Store.distritos().slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    if (this.filtros.distritoId && !distritos.some(d => d.id === this.filtros.distritoId)) { this.filtros.distritoId = ''; this.filtros.microId = ''; }
    selD.innerHTML = `<option value="">Todos</option>` + distritos.map(d => `<option value="${d.id}" ${d.id === this.filtros.distritoId ? 'selected' : ''}>${UI.esc(d.nome)}</option>`).join('');
    // microrregiões: as do distrito escolhido, ou todas agrupadas por distrito
    const fonte = this.filtros.distritoId ? distritos.filter(d => d.id === this.filtros.distritoId) : distritos;
    const opcoes = fonte.map(d => {
      const micros = (d.micros || []).slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        .map(m => `<option value="${m.id}" ${m.id === this.filtros.microId ? 'selected' : ''}>${UI.esc(m.nome)}</option>`).join('');
      return this.filtros.distritoId ? micros : `<optgroup label="${UI.esc(d.nome)}">${micros}</optgroup>`;
    }).join('');
    if (this.filtros.microId && !fonte.some(d => (d.micros || []).some(m => m.id === this.filtros.microId))) this.filtros.microId = '';
    selM.innerHTML = `<option value="">Todas</option>` + opcoes;
    const wrapD = selD.closest('.filtro-item'), wrapM = selM.closest('.filtro-item');
    if (wrapD) wrapD.style.display = distritos.length ? '' : 'none';
    if (wrapM) wrapM.style.display = distritos.length ? '' : 'none';
  },

  atualizarFiltroUF() {
    const sel = document.getElementById('filtro-uf');
    if (!sel) return;
    // Coleta UFs distintas dos registros visíveis (sem filtro de UF)
    const regsAll = Store.registrosFiltrados({ projetoId: this.filtros.projetoId, tipo: this.filtros.tipo, distritoId: this.filtros.distritoId, microId: this.filtros.microId, usuario: this.usuario });
    const ufs = [...new Set(regsAll.map(r => r.cidade.uf))].sort();
    sel.innerHTML = `<option value="">Todos</option>` +
      ufs.map(u => `<option value="${u}" ${u === this.filtros.uf ? 'selected' : ''}>${u} — ${UI.esc(Store.UFS[u] || u)}</option>`).join('');
    if (this.filtros.uf && !ufs.includes(this.filtros.uf)) this.filtros.uf = '';
    // só faz sentido quando há origem em mais de um estado
    const wrapUF = document.getElementById('filtro-item-uf');
    if (wrapUF) wrapUF.style.display = ufs.length > 1 || this.filtros.uf ? '' : 'none';
    // Exibe/oculta botão Limpar
    const btnLimpar = document.getElementById('btn-limpar-filtros');
    if (btnLimpar) btnLimpar.style.display = (this.filtros.projetoId || this.filtros.distritoId || this.filtros.microId || this.filtros.tipo || this.filtros.uf) ? '' : 'none';
  },

  atualizarBanner() {
    const b = document.getElementById('banner');
    if (!b) return;
    if (this.usuario.senhaPadrao) {
      b.innerHTML = `<div class="banner banner-aviso">Você ainda usa a senha padrão. <a href="#" id="banner-senha">Alterar senha agora</a>.</div>`;
      b.querySelector('#banner-senha').addEventListener('click', e => { e.preventDefault(); this.modalSenha(); });
    } else b.innerHTML = '';
  },

  aoMudarFiltros() {
    localStorage.setItem('maparh:filtros', JSON.stringify(this.filtros));
    this.atualizarFiltroDistrito();
    this.atualizarFiltroUF();
    this.rotear(true);
  },
  // nome da microrregião / distrito filtrados (para títulos e legendas)
  regiaoFiltrada() {
    const d = this.filtros.distritoId ? Store.distrito(this.filtros.distritoId) : null;
    const m = d && this.filtros.microId ? (d.micros || []).find(x => x.id === this.filtros.microId) : null;
    return { distrito: d, micro: m };
  },

  // ---------- navegação ----------
  rotear(forcar = false) {
    let nome = (location.hash || '').replace(/^#\/?/, '').split('?')[0] || 'dashboard';
    if (!Paginas[nome] || !Store.pode(this.usuario, nome)) {
      nome = this.MENU.find(m => Store.pode(this.usuario, m.id)).id;
      location.hash = '#/' + nome;
      return;
    }
    if (this.destruirAtual) { try { this.destruirAtual(); } catch (e) { console.warn(e); } this.destruirAtual = null; }
    this.paginaAtual = nome;
    document.querySelectorAll('#sidebar nav a').forEach(a => a.classList.toggle('ativo', a.dataset.pagina === nome));
    const pag = Paginas[nome];
    document.getElementById('titulo-pagina').textContent = pag.titulo;
    document.title = pag.titulo + ' · Mapa RH';
    document.querySelector('.filtros').style.display = pag.semFiltros ? 'none' : '';
    const el = document.getElementById('pagina');
    el.className = 'pagina pagina-' + nome;
    el.innerHTML = '';
    window.scrollTo(0, 0);
    try {
      const r = pag.render(el);
      if (typeof r === 'function') this.destruirAtual = r;
    } catch (e) {
      console.error(e);
      el.innerHTML = `<div class="card erro">Erro ao abrir a página: ${UI.esc(e.message)}</div>`;
    }
  },
  ir(pagina) { if (location.hash === '#/' + pagina) this.rotear(true); else location.hash = '#/' + pagina; },
  recarregar() { this.atualizarFiltroProjetos(); this.atualizarFiltroDistrito(); this.atualizarFiltroUF(); this.rotear(true); },

  // ---------- atalhos de dados ----------
  regs(extra = {}) { return Store.registrosFiltrados({ ...this.filtros, usuario: this.usuario, ...extra }); },
  projetosVisiveis() { return Store.projetosVisiveis(this.usuario); },
  podeEditar() { return this.usuario.perfil === 'admin' || this.usuario.perfil === 'gestor'; },
  descricaoFiltro() {
    const p = this.filtros.projetoId ? Store.projeto(this.filtros.projetoId) : null;
    const partes = [p ? Store.rotuloProjeto(p) : 'Todos os projetos'];
    const reg = this.regiaoFiltrada();
    if (reg.micro) partes.push('microrregião ' + reg.micro.nome + ' (' + reg.distrito.nome + ')');
    else if (reg.distrito) partes.push('distrito ' + reg.distrito.nome);
    if (this.filtros.tipo) partes.push('somente ' + UI.rotuloTipo(this.filtros.tipo));
    if (this.filtros.uf) partes.push('origem: ' + this.filtros.uf);
    return partes.join(' · ');
  },

  modalSenha() {
    UI.modal({
      titulo: 'Alterar minha senha',
      largura: '420px',
      corpo: `
        <label>Senha atual<input type="password" id="s-atual"></label>
        <label>Nova senha<input type="password" id="s-nova"></label>
        <label>Confirmar nova senha<input type="password" id="s-conf"></label>`,
      botoes: [
        { texto: 'Cancelar' },
        { texto: 'Salvar', classe: 'btn-primario', acao: (m) => {
          const atual = m.corpo.querySelector('#s-atual').value, nova = m.corpo.querySelector('#s-nova').value, conf = m.corpo.querySelector('#s-conf').value;
          if (nova !== conf) throw new Error('A confirmação não confere com a nova senha.');
          Store.alterarSenha(this.usuario, atual, nova);
          this.usuario = Store.usuarioAtual();
          this.atualizarBanner();
          UI.toast('Senha alterada com sucesso.', 'sucesso');
        } }
      ]
    });
  }
};

// versão = o "?v=" dos scripts no index.html (sobe a cada publicação)
App.versao = () => ((document.querySelector('script[src*="js/app.js"]') || {}).src || '').replace(/.*v=(\d+).*/, '$1') || '?';
document.addEventListener('DOMContentLoaded', () => App.init());
