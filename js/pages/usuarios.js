Paginas.usuarios = {
  titulo: 'Controle de acesso',
  semFiltros: true,
  render(el) {
    function renderLista() {
      const usuarios = Store.usuarios().slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      el.innerHTML = `
        <div class="grade grade-3 mb">
          <div class="card"><h3>Administrador</h3><p class="muted small">Acesso total: usuários, auditoria, backup, todos os projetos.</p></div>
          <div class="card"><h3>Gestor</h3><p class="muted small">Cadastra e edita contratações, projetos e cidades — apenas nos projetos liberados.</p></div>
          <div class="card"><h3>Visualizador</h3><p class="muted small">Somente consulta: dashboard, mapa, relatórios, distritos e mapas PDRs dos projetos liberados.</p></div>
        </div>
        <div class="card sem-padding">
          <div class="linha entre" style="padding:12px 16px;border-bottom:1px solid var(--borda)">
            <h2 style="margin:0">Usuários</h2>
            <button class="btn btn-primario" id="btn-novo">+ Novo usuário</button>
          </div>
          ${UI.tabela({
            colunas: [
              { titulo: 'Nome', render: u => `${UI.esc(u.nome)}${u.id === App.usuario.id ? ' <span class="badge badge-azul">você</span>' : ''}` },
              { titulo: 'Login', render: u => UI.esc(u.login) },
              { titulo: 'Perfil', render: u => UI.esc(Store.PERFIS[u.perfil]) },
              { titulo: 'Projetos', render: u => u.projetos == null ? '<span class="muted">todos</span>' : (u.projetos.map(id => Store.projeto(id)).filter(Boolean).map(p => UI.esc(p.nome)).join(', ') || '<span class="status-erro">nenhum</span>') },
              { titulo: 'Situação', render: u => u.ativo ? '<span class="badge badge-verde">ativo</span>' : '<span class="badge badge-cinza">inativo</span>' },
              { titulo: 'Criado em', render: u => UI.fmtData(u.criadoEm) },
              { titulo: '', classe: 'acoes-col', render: u => `<button class="btn btn-pequeno ed" data-id="${u.id}">Editar</button> ${u.id !== App.usuario.id ? `<button class="btn btn-pequeno btn-perigo ex" data-id="${u.id}">Excluir</button>` : ''}` }
            ],
            linhas: usuarios
          })}
        </div>
        <p class="muted small mt">Observação: nesta versão os dados ficam no navegador de quem usa o sistema. O controle de acesso organiza o uso, mas a proteção real dos dados depende do computador/navegador. Para vários usuários em máquinas diferentes, é preciso publicar o sistema com um servidor central.</p>`;
      el.querySelector('#btn-novo').addEventListener('click', () => abrirForm(null));
      el.querySelectorAll('.ed').forEach(b => b.addEventListener('click', () => abrirForm(Store.usuarios().find(u => u.id === b.dataset.id))));
      el.querySelectorAll('.ex').forEach(b => b.addEventListener('click', async () => {
        const u = Store.usuarios().find(x => x.id === b.dataset.id);
        if (await UI.confirmar(`Excluir o usuário ${u.nome} (${u.login})?`, { textoOk: 'Excluir', perigo: true })) {
          try { Store.excluirUsuario(u.id, App.usuario); UI.toast('Usuário excluído.', 'sucesso'); renderLista(); } catch (e) { UI.toast(e.message, 'erro'); }
        }
      }));
    }

    function abrirForm(u) {
      const projetos = Store.projetos().slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      const todos = !u || u.projetos == null;
      UI.modal({
        titulo: u ? `Editar usuário — ${u.nome}` : 'Novo usuário',
        corpo: `
          <div class="form-linha">
            <label>Nome<input id="u-nome" value="${UI.esc(u ? u.nome : '')}"></label>
            <label>Login<input id="u-login" value="${UI.esc(u ? u.login : '')}" ${u && u.id === App.usuario.id ? 'disabled' : ''}></label>
          </div>
          <div class="form-linha">
            <label>${u ? 'Nova senha (deixe em branco para manter)' : 'Senha'}<input type="password" id="u-senha" autocomplete="new-password"></label>
            <label>Perfil<select id="u-perfil" ${u && u.id === App.usuario.id ? 'disabled' : ''}>
              ${Object.entries(Store.PERFIS).map(([k, v]) => `<option value="${k}" ${u && u.perfil === k ? 'selected' : ''}>${v}</option>`).join('')}
            </select></label>
          </div>
          <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="u-ativo" ${!u || u.ativo ? 'checked' : ''} ${u && u.id === App.usuario.id ? 'disabled' : ''}> Usuário ativo</label>
          <div id="u-projetos-wrap">
            <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="u-todos" ${todos ? 'checked' : ''}> Acesso a todos os projetos</label>
            <div class="checkbox-lista" id="u-projetos" ${todos ? 'hidden' : ''}>
              ${projetos.length ? projetos.map(p => `<label><input type="checkbox" value="${p.id}" ${u && u.projetos && u.projetos.includes(p.id) ? 'checked' : ''}> ${UI.esc(p.nome)}</label>`).join('') : '<span class="muted">Nenhum projeto cadastrado ainda.</span>'}
            </div>
          </div>`,
        botoes: [
          { texto: 'Cancelar' },
          { texto: 'Salvar', classe: 'btn-primario', acao: (m) => {
            const q = s => m.corpo.querySelector(s);
            const perfil = q('#u-perfil').value;
            const todosSel = q('#u-todos').checked;
            const projSel = [...m.corpo.querySelectorAll('#u-projetos input:checked')].map(c => c.value);
            Store.salvarUsuario({ id: u ? u.id : null, nome: q('#u-nome').value, login: u && u.id === App.usuario.id ? u.login : q('#u-login').value,
              senha: q('#u-senha').value, perfil, ativo: q('#u-ativo').checked, projetos: perfil === 'admin' || todosSel ? null : projSel }, App.usuario);
            if (u && u.id === App.usuario.id) { App.usuario = Store.usuarioAtual(); App.atualizarBanner(); }
            UI.toast('Usuário salvo.', 'sucesso'); renderLista();
          } }
        ]
      });
      const perfilSel = document.getElementById('u-perfil'), todosChk = document.getElementById('u-todos'), wrap = document.getElementById('u-projetos-wrap');
      const ajustar = () => { wrap.style.display = perfilSel.value === 'admin' ? 'none' : ''; document.getElementById('u-projetos').hidden = todosChk.checked; };
      perfilSel.addEventListener('change', ajustar); todosChk.addEventListener('change', ajustar); ajustar();
    }

    renderLista();
  }
};

Paginas.auditoria = {
  titulo: 'Auditoria',
  semFiltros: true,
  render(el) {
    let filtro = '';
    const NOMES = { login: 'Login', logout: 'Logout', 'registro.criar': 'Contratação criada', 'registro.importar': 'Importação', 'registro.editar': 'Contratação editada',
      'registro.excluir': 'Contratação excluída', 'projeto.criar': 'Projeto criado', 'projeto.editar': 'Projeto editado', 'projeto.excluir': 'Projeto excluído',
      'usuario.criar': 'Usuário criado', 'usuario.editar': 'Usuário editado', 'usuario.excluir': 'Usuário excluído', 'usuario.senha': 'Senha alterada',
      'cidade.salvar': 'Cidade salva', 'cidades.ibge': 'Lista IBGE', 'backup.exportar': 'Backup exportado', 'backup.restaurar': 'Backup restaurado',
      'relatorio.exportar': 'Relatório exportado', 'auditoria.limpar': 'Auditoria limpa',
      'distrito.criar': 'Distrito criado', 'distrito.editar': 'Distrito editado', 'distrito.excluir': 'Distrito excluído', 'distrito.importar': 'Distritos importados',
      'micro.criar': 'Microrregião criada', 'micro.editar': 'Microrregião editada', 'micro.excluir': 'Microrregião excluída',
      'mapaPdr.adicionar': 'Mapa PDR adicionado', 'mapaPdr.excluir': 'Mapa PDR excluído', 'cidade.info': 'Anotações da cidade' };
    el.innerHTML = `
      <div class="card sem-padding">
        <div class="linha entre" style="padding:12px 16px;border-bottom:1px solid var(--borda)">
          <div class="linha"><input class="busca" id="aud-busca" placeholder="Filtrar por usuário, ação ou detalhe…"></div>
          <div class="linha"><button class="btn btn-pequeno" id="aud-csv">Exportar CSV</button><button class="btn btn-pequeno btn-perigo" id="aud-limpar">Limpar histórico</button></div>
        </div>
        <div id="aud-lista"></div>
      </div>`;
    function lista() {
      const f = Store.normalizar(filtro);
      return Store.auditoria().filter(a => !f || Store.normalizar(a.usuario + ' ' + (NOMES[a.acao] || a.acao) + ' ' + a.detalhes).includes(f));
    }
    function renderLista() {
      const itens = lista();
      el.querySelector('#aud-lista').innerHTML = UI.tabela({
        vazio: 'Nenhum evento registrado.',
        colunas: [
          { titulo: 'Quando', classe: 'nowrap', render: a => UI.fmtDataHora(a.quando) },
          { titulo: 'Usuário', render: a => UI.esc(a.usuario) },
          { titulo: 'Ação', render: a => `<span class="badge badge-cinza">${UI.esc(NOMES[a.acao] || a.acao)}</span>` },
          { titulo: 'Detalhes', render: a => UI.esc(a.detalhes) }
        ],
        linhas: itens.slice(0, 500)
      }) + (itens.length > 500 ? `<div class="rodape-tabela">Mostrando os 500 eventos mais recentes de ${UI.fmtNum(itens.length)}.</div>` : '');
    }
    el.querySelector('#aud-busca').addEventListener('input', UI.debounce(e => { filtro = e.target.value; renderLista(); }, 150));
    el.querySelector('#aud-csv').addEventListener('click', () => UI.baixarCSV('auditoria.csv', [['QUANDO', 'USUARIO', 'ACAO', 'DETALHES']].concat(lista().map(a => [UI.fmtDataHora(a.quando), a.usuario, NOMES[a.acao] || a.acao, a.detalhes]))));
    el.querySelector('#aud-limpar').addEventListener('click', async () => {
      if (await UI.confirmar('Limpar todo o histórico de auditoria?', { textoOk: 'Limpar', perigo: true })) { Store.limparAuditoria(App.usuario); renderLista(); }
    });
    renderLista();
  }
};

Paginas.backup = {
  titulo: 'Backup',
  semFiltros: true,
  render(el) {
    const st = Store.estatisticasArmazenamento();
    const admin = App.usuario.perfil === 'admin';
    el.innerHTML = `
      <div class="grade grade-2">
        <div class="card">
          <h2>Exportar backup</h2>
          <p class="muted small">Gera um arquivo com todos os dados (projetos, contratações, distritos e microrregiões, mapas PDR, cidades, usuários e auditoria). Guarde em local seguro ou use para levar o sistema para outro computador.</p>
          <ul class="muted small">
            <li>${UI.fmtNum(st.projetos)} projeto(s) · ${UI.fmtNum(st.registros)} contratação(ões) · ${UI.fmtNum(st.usuarios)} usuário(s)</li>
            <li>${UI.fmtNum(st.distritos)} distrito(s) · ${UI.fmtNum(st.micros)} microrregião(ões) · ${UI.fmtNum(st.mapasPdr)} mapa(s) PDR</li>
            <li>${UI.fmtNum(st.cidadesUsuario)} cidade(s) adicionada(s) · lista IBGE: ${Store.temIBGE() ? 'incluída' : 'não carregada'}</li>
            <li>Espaço usado no navegador: ${(st.bytes / 1024).toFixed(0)} KB</li>
          </ul>
          <button class="btn btn-primario" id="bk-exportar">Baixar backup (.json)</button>
        </div>
        <div class="card">
          <h2>Restaurar backup</h2>
          <p class="muted small">Substitui <b>todos</b> os dados atuais pelos do arquivo escolhido. ${admin ? '' : '<b>Somente administradores podem restaurar.</b>'}</p>
          ${admin ? '<input type="file" id="bk-arquivo" accept=".json,application/json">' : ''}
        </div>
      </div>
      <div class="card mt">
        <h2>Onde os dados ficam?</h2>
        <p class="muted small">Nesta versão os dados são gravados no armazenamento local deste navegador, neste computador. Eles não são apagados ao fechar o navegador, mas podem ser perdidos se o histórico/dados do site forem limpos ou se o computador for trocado. Por isso, faça backups periódicos. Se precisar que várias pessoas usem o sistema ao mesmo tempo em computadores diferentes, o próximo passo é publicá-lo em um servidor com banco de dados central.</p>
      </div>`;
    el.querySelector('#bk-exportar').addEventListener('click', () => {
      const data = new Date().toISOString().slice(0, 10);
      UI.baixarArquivo(`backup-mapa-rh-${data}.json`, Store.exportar(), 'application/json');
      Store.auditar('backup.exportar', 'Backup exportado', App.usuario);
      UI.toast('Backup gerado.', 'sucesso');
    });
    const arq = el.querySelector('#bk-arquivo');
    if (arq) arq.addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      if (!(await UI.confirmar(`Restaurar o backup "${f.name}"? Todos os dados atuais serão substituídos.`, { textoOk: 'Restaurar', perigo: true }))) { arq.value = ''; return; }
      try {
        const texto = await f.text();
        Store.importar(texto, App.usuario);
        UI.toast('Backup restaurado. Entre novamente.', 'sucesso', 5000);
        setTimeout(() => App.sair(), 800);
      } catch (err) { UI.toast(err.message, 'erro', 7000); arq.value = ''; }
    });
  }
};
