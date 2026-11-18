Paginas.usuarios = {
  titulo: 'Usuários e acesso',
  semFiltros: true,
  render(el) {
    const nuvem = App.nuvem();
    if (nuvem) Nuvem.carregarMembros().then(() => { if (App.paginaAtual === 'usuarios' && !document.querySelector('.modal-overlay') && !(document.activeElement && document.activeElement.classList.contains('us-meta')) && !(document.activeElement && document.activeElement.id === 'us-busca')) renderLista(); }).catch(() => {});
    // busca e filtros da lista (ficam enquanto a tela está aberta)
    let busca = '', perfilF = '', situacaoF = 'ativos';
    function renderLista() {
      const todosUsuarios = Store.usuarios().slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      const nAtivos = todosUsuarios.filter(u => u.ativo !== false).length, nInativos = todosUsuarios.length - nAtivos;
      if (situacaoF === 'inativos' && !nInativos) situacaoF = 'ativos';
      const termo = Store.normalizar(busca);
      const usuarios = todosUsuarios
        .filter(u => situacaoF === 'todos' || (situacaoF === 'ativos' ? u.ativo !== false : u.ativo === false))
        .filter(u => !perfilF || u.perfil === perfilF)
        .filter(u => !termo || Store.normalizar(`${u.nome} ${u.login}`).includes(termo));
      el.innerHTML = `
        ${UI.dicaNovato('usuarios', 'Cada pessoa entra com o <b>próprio login</b>. Quem saiu da empresa: <b>Desativar</b> (não entra mais e o histórico fica com o nome dela) — excluir só serve para cadastro feito por engano. Depois de criar, use <b>Mensagem de acesso</b> para mandar o endereço e o login pelo WhatsApp.')}
        <div class="grade kpis mb">
          <div class="card"><h3>Administrador</h3><p class="muted small">Tudo: aprova vagas, direciona candidatos aos RHs, usuários, auditoria e backup, em todos os projetos.</p></div>
          <div class="card"><h3>Gestor</h3><p class="muted small">Pede vagas, cuida de contratações, projetos, distritos, cidades e cargos nos projetos liberados. Com "Acessa Candidatos", acompanha todos os RHs.</p></div>
          <div class="card"><h3>RH (analista)</h3><p class="muted small">Trabalha só os candidatos direcionados para ele e vê só as vagas em que é o responsável.</p></div>
          <div class="card"><h3>Visualizador</h3><p class="muted small">Só consulta: Início, vagas, mapa, relatórios, distritos e unidades dos projetos liberados. Não vê dados pessoais.</p></div>
        </div>
        <div class="card sem-padding">
          <div class="cad-barra us-barra">
            <h2 style="margin:0">Usuários</h2>
            <input class="busca" id="us-busca" type="search" placeholder="Buscar nome ou login…" aria-label="Buscar usuário" value="${UI.esc(busca)}">
            <select id="us-perfil" aria-label="Filtrar por perfil" style="width:auto"><option value="">Todos os perfis</option>${Object.entries(Store.PERFIS).map(([k, v]) => `<option value="${k}" ${perfilF === k ? 'selected' : ''}>${UI.esc(v)}</option>`).join('')}</select>
            <div class="seg-cad" role="group" aria-label="Situação">
              ${[['ativos', 'Ativos', nAtivos], ['inativos', 'Inativos', nInativos], ['todos', 'Todos', todosUsuarios.length]].filter(([k, , n]) => k !== 'inativos' || n)
                .map(([k, t, n]) => `<button type="button" data-sit="${k}" class="${situacaoF === k ? 'ativo' : ''}" aria-pressed="${situacaoF === k}">${t} <span>${n}</span></button>`).join('')}
            </div>
            <span class="espaco"></span>
            <button class="btn btn-primario" id="btn-novo">+ Novo usuário</button>
          </div>
          ${!usuarios.length ? UI.estadoVazio({ compacto: true, titulo: 'Ninguém com estes filtros', texto: termo ? `Nenhum usuário com "${UI.esc(busca)}". Confira a grafia ou procure em <b>Todos</b>.` : 'Troque o perfil ou a situação.', botoes: [{ acao: 'limpar', texto: 'Limpar filtros' }] }) : UI.tabela({
            colunas: [
              { titulo: 'Nome', render: u => `<span class="com-avatar">${UI.avatar(u, 30)}<span>${UI.esc(u.nome)}${u.id === App.usuario.id ? ' <span class="badge badge-azul">você</span>' : ''}</span></span>` },
              { titulo: 'Login', render: u => UI.esc(u.login) },
              { titulo: 'Perfil', render: u => UI.esc(Store.PERFIS[u.perfil]) + (u.rh && u.perfil === 'gestor' ? ' <span class="badge badge-azul" title="Acessa Candidatos (dados pessoais) e vê os candidatos de todos os RHs">candidatos</span>' : '') },
              { titulo: 'Projetos', render: u => u.projetos == null ? '<span class="muted">todos</span>' : (u.projetos.map(id => Store.projeto(id)).filter(Boolean).map(p => UI.esc(p.nome)).join(', ') || '<span class="status-erro">nenhum</span>') },
              // meta semanal de admissões: só para quem trabalha candidatos (RH); muda direto na linha
              ...(nuvem ? [{ titulo: 'Meta semanal (admissões)', render: u => u.ativo !== false && Store.podeRh(u)
                ? `<input type="number" class="us-meta" data-id="${u.id}" min="0" max="999" step="1" inputmode="numeric" placeholder="sem meta" value="${u.metaSemanal == null ? '' : u.metaSemanal}" aria-label="Meta semanal de admissões de ${UI.esc(u.nome)}" title="Quantas admissões por semana (segunda a domingo). Deixe vazio para ficar sem meta.">`
                : '<span class="muted" title="Só para quem trabalha candidatos">—</span>' }] : []),
              { titulo: 'Situação', render: u => u.ativo ? '<span class="badge badge-verde">ativo</span>' : '<span class="badge badge-cinza">inativo</span>' },
              { titulo: 'Criado em', render: u => UI.fmtData(u.criadoEm) },
              { titulo: '', classe: 'acoes-col us-acoes', render: u => `<button class="btn btn-pequeno ed" data-id="${u.id}">Editar</button>${u.id !== App.usuario.id
                ? (u.ativo !== false ? `<button class="btn btn-pequeno us-desativar" data-id="${u.id}" title="Não entra mais no sistema; o histórico continua com o nome">Desativar</button>` : `<button class="btn btn-pequeno us-reativar" data-id="${u.id}" title="Volta a entrar no sistema com o mesmo login">Reativar</button>`)
                : ''}<button type="button" class="btn btn-pequeno" data-menu aria-haspopup="menu" aria-expanded="false" title="Mais ações" aria-label="Mais ações de ${UI.esc(u.nome)}">⋯</button><div class="cad-menu" hidden>
                  <button type="button" data-m="acesso" data-id="${u.id}">Mensagem de acesso…</button>
                  ${u.id !== App.usuario.id ? `<button type="button" data-m="excluir" data-id="${u.id}" class="perigo">Excluir…</button>` : ''}</div>` }
            ],
            linhas: usuarios
          })}
        </div>
        <p class="muted small mt">${nuvem ? 'Os usuários e os dados ficam no banco central: cada pessoa entra com o próprio login em qualquer computador e todos veem os mesmos dados. Só quem está nesta lista (e ativo) consegue ler ou gravar; o Visualizador não grava nada.'
          : 'Observação: nesta versão os dados ficam no navegador de quem usa o sistema. O controle de acesso organiza o uso, mas a proteção real dos dados depende do computador/navegador. Para vários usuários em máquinas diferentes, é preciso publicar o sistema com um servidor central.'}</p>`;
      el.querySelector('#btn-novo').addEventListener('click', () => abrirForm(null));
      UI.ligarDicas(el);
      const bBusca = el.querySelector('#us-busca');
      bBusca.addEventListener('input', UI.debounce(() => { busca = bBusca.value; renderLista(); const n = el.querySelector('#us-busca'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 200));
      el.querySelector('#us-perfil').addEventListener('change', e => { perfilF = e.target.value; renderLista(); });
      el.querySelectorAll('[data-sit]').forEach(b => b.addEventListener('click', () => { situacaoF = b.dataset.sit; renderLista(); }));
      const bLimpar = el.querySelector('.vazio-guia [data-acao="limpar"]');
      if (bLimpar) bLimpar.addEventListener('click', () => { busca = ''; perfilF = ''; situacaoF = 'todos'; renderLista(); });
      el.querySelectorAll('.us-desativar').forEach(b => b.addEventListener('click', () => confirmarDesativar(Store.usuarios().find(u => u.id === b.dataset.id))));
      el.querySelectorAll('.us-reativar').forEach(b => b.addEventListener('click', () => reativar(Store.usuarios().find(u => u.id === b.dataset.id), b)));
      el.querySelectorAll('.us-acoes [data-menu]').forEach(mb => {
        const mn = mb.nextElementSibling;
        mb.addEventListener('click', ev => { ev.stopPropagation(); if (mn.hidden) { UI.abrirMenu(mb, mn); mb.setAttribute('aria-expanded', 'true'); } else { mn.hidden = true; mb.setAttribute('aria-expanded', 'false'); } });
        mn.addEventListener('click', ev => {
          const it = ev.target.closest('[data-m]'); if (!it) return;
          mn.hidden = true; mb.setAttribute('aria-expanded', 'false');
          const u = Store.usuarios().find(x => x.id === it.dataset.id); if (!u) return;
          if (it.dataset.m === 'acesso') mensagemAcesso(u);
          else if (it.dataset.m === 'excluir') excluirUsuario(u, mb);
        });
      });
      // meta semanal: grava ao sair do campo ou no Enter; vazio = sem meta
      el.querySelectorAll('.us-meta').forEach(inp => {
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') { const u = Store.usuarios().find(x => x.id === inp.dataset.id); inp.value = u && u.metaSemanal != null ? u.metaSemanal : ''; inp.blur(); } });
        inp.addEventListener('change', async () => {
          const u = Store.usuarios().find(x => x.id === inp.dataset.id); if (!u) return;
          const antes = u.metaSemanal == null ? null : u.metaSemanal, txt = inp.value.trim();
          const nova = txt === '' ? null : Number(txt);
          if (nova !== null && (!Number.isInteger(nova) || nova < 0 || nova > 999)) { UI.toast('A meta é um número inteiro de 0 a 999. Deixe vazio para ficar sem meta.', 'erro', 6000); inp.value = antes == null ? '' : antes; return; }
          if (nova === antes) return;
          inp.disabled = true;
          try { await Nuvem.definirMeta(u.id, nova); UI.toast(nova == null ? `${u.nome} ficou sem meta.` : `Meta de ${u.nome}: ${nova === 1 ? '1 admissão' : nova + ' admissões'} por semana.`, 'sucesso'); }
          catch (e) { UI.toast(e.message, 'erro', 6000); inp.value = antes == null ? '' : antes; }
          finally { inp.disabled = false; }
        });
      });
      el.querySelectorAll('.ed').forEach(b => b.addEventListener('click', () => abrirForm(Store.usuarios().find(u => u.id === b.dataset.id))));
    }

    // vagas (abertas) e candidatos em andamento de um usuário
    async function trabalhoDe(u) {
      const vagasDele = Store.vagas().filter(v => !['cancelada', 'recusada', 'preenchida'].includes(v.status) && (v.recrutadorLogin === u.login || (v.recrutadores || []).includes(u.login)));
      let candDele = [];
      if (nuvem && Nuvem.rh && Nuvem.rh.andamento) candDele = (await Nuvem.rh.andamento()).filter(p => p.analista_login === u.login && p.situacao === 'em_andamento');
      return { vagasDele, candDele };
    }
    async function excluirUsuario(u, b) {
      // responsável por vaga ou com candidatos: não exclui (ficariam sem dono); oferece desativar ou passar os candidatos
      if (b) b.disabled = true;
      let vagasDele = [], candDele = [];
      try { ({ vagasDele, candDele } = await trabalhoDe(u)); }
      catch (e) { if (b) b.disabled = false; UI.toast('Não consegui conferir os candidatos deste usuário agora. Tente de novo.', 'erro', 6000); return; }
      if (b) b.disabled = false;
      if (vagasDele.length || candDele.length) return bloqueioExcluir(u, vagasDele, candDele);
      if (await UI.confirmar(`Excluir o usuário ${u.nome} (${u.login})? Use só para cadastro feito por engano — para quem saiu, prefira Desativar (o histórico fica com o nome).`, { textoOk: 'Excluir', perigo: true })) {
        try { if (nuvem) await Nuvem.excluirUsuario(u); else Store.excluirUsuario(u.id, App.usuario); UI.toast('Usuário excluído.', 'sucesso'); renderLista(); } catch (e) { UI.toast(e.message, 'erro'); }
      }
    }
    // grava só a situação (ativo/inativo), mantendo o resto do usuário
    async function gravarSituacao(u, ativo) {
      const obj = { id: u.id, nome: u.nome, login: u.login, senha: '', perfil: u.perfil, ativo, projetos: u.projetos == null ? null : u.projetos };
      if (nuvem) await Nuvem.salvarUsuario(obj); else Store.salvarUsuario(obj, App.usuario);
    }
    // Desativar direto na linha: diz o que acontece e o que fica pendurado (vagas e candidatos dele)
    async function confirmarDesativar(u) {
      if (!u) return;
      let vagasDele = [], candDele = [], falhou = false;
      try { ({ vagasDele, candDele } = await trabalhoDe(u)); } catch (e) { falhou = true; }
      const qtd = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
      const outros = Store.equipeRh().filter(x => x.login !== u.login);
      const pendente = vagasDele.length || candDele.length;
      UI.modal({ titulo: `Desativar ${u.nome}?`, largura: '520px',
        corpo: `<ul class="pj-lista-efeitos" style="margin-top:0">
            <li><b>Não entra mais</b> no sistema (o login ${UI.esc(u.login)} fica bloqueado).</li>
            <li>O <b>histórico continua</b> com o nome e a foto da pessoa.</li>
            <li>Dá para <b>reativar</b> depois, com o mesmo login.</li></ul>
          ${pendente ? `<div class="caixa caixa-aviso">Ainda está com ${vagasDele.length ? `<b>${qtd(vagasDele.length, 'vaga aberta', 'vagas abertas')}</b> como responsável` : ''}${vagasDele.length && candDele.length ? ' e ' : ''}${candDele.length ? `<b>${qtd(candDele.length, 'candidato', 'candidatos')}</b> em andamento` : ''}. ${candDele.length ? 'Passe os candidatos para outro RH antes, ou eles aparecem com o aviso "RH inativo".' : ''}${vagasDele.length ? ' Troque o responsável das vagas em Vagas.' : ''}</div>` : ''}
          ${falhou ? '<p class="muted small">Não consegui conferir os candidatos dele agora.</p>' : ''}`,
        botoes: [{ texto: 'Cancelar' }]
          .concat(candDele.length && outros.length ? [{ texto: 'Passar os candidatos…', acao: () => { setTimeout(() => passarCandidatos(u, candDele, outros), 0); } }] : [])
          .concat([{ texto: 'Desativar', classe: 'btn-perigo', acao: async () => {
            await gravarSituacao(u, false);
            UI.toast(`${u.nome}: acesso desativado. Não entra mais no sistema, e o histórico continua com o nome.`, 'sucesso', 5000); renderLista();
          } }]) });
    }
    async function reativar(u, b) {
      if (!u) return;
      if (b) b.disabled = true;
      try { await gravarSituacao(u, true); UI.toast(`${u.nome} pode entrar de novo com o login ${u.login}.`, 'sucesso', 5000); renderLista(); }
      catch (e) { UI.toast(e.message, 'erro', 7000); if (b) b.disabled = false; }
    }
    // Mensagem pronta para mandar o acesso (endereço + login; a senha vai por outro caminho)
    function mensagemAcesso(u, recemCriado = false) {
      const endereco = location.origin + location.pathname;
      const primeiro = String(u.nome || '').trim().split(/\s+/)[0] || '';
      const texto = `Olá, ${primeiro}! Seu acesso ao Safra RH está pronto.\n\nEndereço: ${endereco}\nLogin: ${u.login}\nSenha: te passo em separado.\n\nPerfil: ${Store.PERFIS[u.perfil] || u.perfil}${u.projetos == null || u.perfil === 'admin' ? '' : ' · Projetos: ' + (u.projetos.map(id => Store.projeto(id)).filter(Boolean).map(p => p.nome).join(', ') || 'nenhum ainda')}.`;
      const md = UI.modal({ titulo: recemCriado ? `Acesso criado para ${u.nome}` : `Mensagem de acesso — ${u.nome}`, largura: '520px',
        corpo: `${recemCriado ? '<p style="margin-top:0">Pronto! Mande o endereço e o login para a pessoa. <b>A senha, passe por outro caminho</b> (ligação ou pessoalmente).</p>' : '<p class="muted small" style="margin-top:0">Endereço e login para mandar à pessoa. A senha não vai na mensagem.</p>'}
          <textarea id="ac-texto" rows="8" style="width:100%;font-family:inherit">${UI.esc(texto)}</textarea>`,
        botoes: [{ texto: 'Fechar' },
          { texto: 'Abrir no WhatsApp', acao: m => { window.open('https://wa.me/?text=' + encodeURIComponent(m.corpo.querySelector('#ac-texto').value), '_blank', 'noopener'); return false; } },
          { texto: 'Copiar', classe: 'btn-primario', acao: async m => { const ok = await UI.copiarTexto(m.corpo.querySelector('#ac-texto').value); UI.toast(ok ? 'Mensagem copiada.' : 'Não consegui copiar: selecione o texto e use Ctrl+C.', ok ? 'sucesso' : 'aviso'); return ok ? undefined : false; } }] });
      return md;
    }

    // usuário que ainda tem vaga ou candidatos: em vez de excluir, desativar ou passar os candidatos para outro RH
    function bloqueioExcluir(u, vagasDele, candDele) {
      const qtd = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
      const outros = Store.equipeRh().filter(x => x.login !== u.login);
      const desativar = async () => {
        const obj = { id: u.id, nome: u.nome, login: u.login, senha: '', perfil: u.perfil, ativo: false, projetos: u.projetos == null ? null : u.projetos };
        if (nuvem) await Nuvem.salvarUsuario(obj); else Store.salvarUsuario(obj, App.usuario);
        UI.toast(`${u.nome}: acesso desativado. Não entra mais no sistema, e o histórico continua com o nome.`, 'sucesso', 5000); renderLista();
      };
      UI.modal({ titulo: `Não dá para excluir ${u.nome}`, largura: '520px',
        corpo: `<p style="margin-top:0">${UI.esc(u.nome)} ainda tem:</p><ul>
            ${vagasDele.length ? `<li><b>${qtd(vagasDele.length, 'vaga', 'vagas')}</b> como responsável: ${UI.esc(vagasDele.slice(0, 5).map(v => v.titulo).join(', '))}${vagasDele.length > 5 ? '…' : ''}</li>` : ''}
            ${candDele.length ? `<li><b>${qtd(candDele.length, 'candidato', 'candidatos')}</b> em andamento</li>` : ''}</ul>
          <p class="muted small" style="margin-bottom:0">Excluir deixaria isso sem dono. Você pode <b>desativar</b> o usuário (ele não entra mais e o histórico fica) ${candDele.length ? 'ou <b>passar os candidatos</b> para outro RH' : ''}${vagasDele.length ? '. Para tirar das vagas, troque o responsável em Vagas.' : '.'}</p>`,
        botoes: [{ texto: 'Cancelar' }]
          .concat(candDele.length && outros.length ? [{ texto: 'Passar os candidatos para…', classe: 'btn-secundario', acao: () => { setTimeout(() => passarCandidatos(u, candDele, outros), 0); } }] : [])
          .concat(u.ativo !== false ? [{ texto: 'Desativar', classe: 'btn-primario', acao: desativar }] : []) });
    }
    function passarCandidatos(u, candDele, outros) {
      UI.modal({ titulo: `Passar os candidatos de ${u.nome}`, largura: '460px',
        corpo: `<label>Para qual RH<select id="pc-para"><option value="">Escolha o RH…</option>${outros.map(x => `<option value="${UI.esc(x.login)}">${UI.esc(x.nome)}</option>`).join('')}</select></label>
          <p class="muted small" style="margin-bottom:0">${candDele.length === 1 ? '1 candidato em andamento passa' : candDele.length + ' candidatos em andamento passam'} para o RH escolhido. Fica anotado no histórico de cada um.</p>`,
        botoes: [{ texto: 'Cancelar' }, { texto: 'Passar', classe: 'btn-primario', acao: async md => {
          const sel = md.corpo.querySelector('#pc-para'), para = Store.usuarioPorLogin(sel.value);
          if (!para) { sel.focus(); throw new Error('Escolha o RH.'); }
          await Nuvem.rh.atualizarVarios(candDele.map(p => p.id), { analista_login: para.login, analista: para.nome });
          UI.toast(`${candDele.length === 1 ? '1 candidato passou' : candDele.length + ' candidatos passaram'} para ${para.nome}.`, 'sucesso', 5000);
          renderLista();
        } }] });
    }

    let fotoNova;   // undefined = não mexeu; null = tirar; texto = foto nova
    function abrirForm(u) {
      fotoNova = undefined;
      const projetos = Store.projetos().slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      const todos = !u || u.projetos == null;
      UI.modal({
        titulo: u ? `Editar usuário — ${u.nome}` : 'Novo usuário',
        corpo: `
          ${nuvem ? `<div class="foto-campo"><span id="u-foto-ver">${UI.avatar(u || { nome: '?' }, 64)}</span><div><div class="linha"><label class="btn btn-pequeno" style="margin:0;cursor:pointer">Escolher foto<input type="file" id="u-foto" accept="image/*" hidden></label><button type="button" class="btn-link perigo" id="u-foto-tirar" ${u && u.foto ? '' : 'hidden'}>Tirar foto</button></div><div class="muted small" style="margin-top:4px">Aparece nos cartões, na lista e no Por RH. A imagem é recortada em quadrado.</div></div></div>` : ''}
          <div class="form-linha">
            <label>Nome<input id="u-nome" value="${UI.esc(u ? u.nome : '')}"></label>
            <label>Login<input id="u-login" value="${UI.esc(u ? u.login : '')}" ${u && u.id === App.usuario.id ? 'disabled' : ''}></label>
          </div>
          <div class="form-linha">
            <label>${u ? 'Nova senha (deixe em branco para manter)' : (nuvem ? 'Senha (mínimo 6 caracteres)' : 'Senha')}<input type="password" id="u-senha" autocomplete="new-password"></label>
            <label>Perfil<select id="u-perfil" ${u && u.id === App.usuario.id ? 'disabled' : ''}>
              ${Object.entries(Store.PERFIS).map(([k, v]) => `<option value="${k}" ${u && u.perfil === k ? 'selected' : ''}>${v}</option>`).join('')}
            </select></label>
          </div>
          <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="u-ativo" ${!u || u.ativo ? 'checked' : ''} ${u && u.id === App.usuario.id ? 'disabled' : ''}> Usuário ativo</label>
          ${nuvem ? `<label id="u-rh-wrap" style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" id="u-rh" ${u && u.rh ? 'checked' : ''} style="margin-top:3px"> <span>Acessa <b>Candidatos</b> e acompanha todos os RHs<br><span class="muted small">Vê e edita dados pessoais (CPF, nascimento, telefone) dos candidatos dos projetos liberados, de todos os RHs. Administrador sempre acessa.</span></span></label>
          <p class="muted small" id="u-perfil-nota" style="margin:0"></p>` : ''}
          <div id="u-projetos-wrap">
            <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="u-todos" ${todos ? 'checked' : ''}> Acesso a todos os projetos</label>
            <div class="checkbox-lista" id="u-projetos" ${todos ? 'hidden' : ''}>
              ${projetos.length ? projetos.map(p => `<label><input type="checkbox" value="${p.id}" ${u && u.projetos && u.projetos.includes(p.id) ? 'checked' : ''}> ${UI.esc(p.nome)}${p.ativo === false ? ' <span class="muted small">(encerrada)</span>' : ''}</label>`).join('') : '<span class="muted">Nenhum projeto cadastrado ainda.</span>'}
            </div>
          </div>
          <div id="u-resumo" class="us-resumo" aria-live="polite"></div>`,
        botoes: [
          { texto: 'Cancelar' },
          { texto: 'Salvar', classe: 'btn-primario', acao: async (m) => {
            const q = s => m.corpo.querySelector(s);
            const perfil = q('#u-perfil').value;
            const todosSel = q('#u-todos').checked;
            const projSel = [...m.corpo.querySelectorAll('#u-projetos input:checked')].map(c => c.value);
            const obj = { id: u ? u.id : null, nome: q('#u-nome').value, login: u && u.id === App.usuario.id ? u.login : q('#u-login').value,
              senha: q('#u-senha').value, perfil, ativo: q('#u-ativo').checked, projetos: perfil === 'admin' || todosSel ? null : projSel,
              rh: nuvem && q('#u-rh') ? q('#u-rh').checked : undefined, foto: fotoNova };
            const semProjeto = perfil !== 'admin' && !todosSel && !projSel.length;
            if (semProjeto && !(await UI.confirmar(`${String(obj.nome || '').trim() || 'Este usuário'} ficará sem nenhum projeto liberado e não vai ver vaga, candidato nem contratação. Salvar assim mesmo?`, { textoOk: 'Salvar sem projeto' }))) return false;
            if (nuvem) await Nuvem.salvarUsuario(obj); else Store.salvarUsuario(obj, App.usuario);
            if (u && u.id === App.usuario.id) { App.usuario = Store.usuarioAtual(); App.atualizarBanner(); }
            UI.toast('Usuário salvo.', 'sucesso'); renderLista();
            // usuário novo: já oferece a mensagem com endereço e login para mandar à pessoa
            if (!u) { const novo = Store.usuarios().find(x => x.login === String(obj.login || '').trim().toLowerCase()); if (novo) setTimeout(() => mensagemAcesso(novo, true), 0); }
          } }
        ]
      });
      // foto: reduzida no navegador (160x160) antes de ir para o banco
      const fi = document.getElementById('u-foto');
      if (fi) {
        fi.addEventListener('change', async () => {
          try { fotoNova = await UI.reduzirImagem(fi.files[0]); document.getElementById('u-foto-ver').innerHTML = UI.avatar({ nome: document.getElementById('u-nome').value, foto: fotoNova }, 64); document.getElementById('u-foto-tirar').hidden = false; }
          catch (e) { UI.toast(e.message, 'erro'); }
        });
        document.getElementById('u-foto-tirar').addEventListener('click', () => { fotoNova = null; document.getElementById('u-foto-ver').innerHTML = UI.avatar({ nome: document.getElementById('u-nome').value }, 64); document.getElementById('u-foto-tirar').hidden = true; });
      }
      const perfilSel = document.getElementById('u-perfil'), todosChk = document.getElementById('u-todos'), wrap = document.getElementById('u-projetos-wrap');
      const rhWrap = document.getElementById('u-rh-wrap');
      const ajustar = () => { wrap.style.display = perfilSel.value === 'admin' ? 'none' : ''; document.getElementById('u-projetos').hidden = todosChk.checked;
        if (rhWrap) rhWrap.style.display = perfilSel.value === 'gestor' ? 'flex' : 'none';
        const nota = document.getElementById('u-perfil-nota');
        if (nota) nota.textContent = perfilSel.value === 'analista' ? 'RH (analista): trabalha em Candidatos só com as pessoas direcionadas para ele e vê só as vagas em que é o responsável. Não pede vaga nem importa planilha.' : '';
        resumoAcesso(); };
      // Resumo do que a pessoa vai ver com este perfil e estes projetos (muda na hora, antes de salvar)
      function resumoAcesso() {
        const box = document.getElementById('u-resumo'); if (!box) return;
        const perfil = perfilSel.value;
        const rhChk = document.getElementById('u-rh');
        const falso = { perfil, rh: perfil === 'gestor' && rhChk ? rhChk.checked : perfil === 'analista' };
        const NOMES = { dashboard: 'Início', vagas: 'Vagas', candidatos: 'Candidatos', mapa: 'Mapa', cadastro: 'Contratações', relatorios: 'Relatórios', distritos: 'Distritos', pdrs: 'Mapas PDR', cidades: 'Cidades', projetos: 'Projetos', cargos: 'Cargos', usuarios: 'Usuários', auditoria: 'Auditoria', backup: 'Backup' };
        const telas = Object.keys(NOMES).filter(k => k === 'candidatos' ? Store.podeRh(falso) && perfil !== 'leitor' : Store.pode(falso, k));
        const marcados = [...document.querySelectorAll('#u-projetos input:checked')].map(i => i.value);
        const todosProj = perfil === 'admin' || todosChk.checked;
        const projTxt = todosProj ? 'todos os projetos' : marcados.length ? marcados.map(id => Store.projeto(id)).filter(Boolean).map(p => UI.esc(p.nome)).join(', ') : null;
        const obs = [];
        if (perfil === 'analista') obs.push('Vagas e candidatos: <b>só os dele</b>');
        else if (perfil === 'gestor') obs.push(falso.rh ? 'Candidatos: <b>de todos os RHs</b>, com dados pessoais' : 'Sem acesso a Candidatos (dados pessoais)');
        if (perfil === 'leitor') obs.push('<b>Só consulta</b>, não altera nada');
        if (perfil === 'admin' || perfil === 'gestor') obs.push('Pode editar cadastros (projetos, distritos, cidades, cargos)');
        if (perfil === 'admin') obs.push('Aprova vagas e cuida dos usuários');
        box.innerHTML = `<div class="us-resumo-tit">Com este acesso, a pessoa vai ver</div>
          <div class="us-resumo-telas">${telas.map(t => `<span>${NOMES[t]}</span>`).join('')}</div>
          <div class="small">${obs.join(' · ')}</div>
          <div class="small">Projetos: ${projTxt ? `<b>${projTxt}</b>` : '<span class="status-erro">nenhum marcado — não vai ver vagas nem candidatos</span>'}</div>`;
      }
      perfilSel.addEventListener('change', ajustar); todosChk.addEventListener('change', ajustar);
      document.querySelectorAll('#u-projetos input').forEach(i => i.addEventListener('change', resumoAcesso));
      const rhChkEl = document.getElementById('u-rh'); if (rhChkEl) rhChkEl.addEventListener('change', resumoAcesso);
      ajustar();
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
      'mapaPdr.adicionar': 'Mapa PDR adicionado', 'mapaPdr.excluir': 'Mapa PDR excluído', 'cidade.info': 'Anotações da cidade',
      'cargo.criar': 'Cargo criado', 'cargo.editar': 'Cargo editado', 'cargo.excluir': 'Cargo excluído',
      'vaga.criar': 'Vaga pedida', 'vaga.editar': 'Vaga editada', 'vaga.aprovar': 'Vaga aprovada', 'vaga.recusar': 'Vaga recusada', 'vaga.status': 'Situação da vaga', 'vaga.divulgar': 'Divulgação da vaga', 'vaga.excluir': 'Vaga excluída',
      'candidato.criar': 'Candidato criado', 'candidato.editar': 'Candidato editado', 'candidato.etapa': 'Etapa do candidato', 'candidato.excluir': 'Candidato excluído', 'cidade.excluir': 'Cidade excluída' };
    const nuvem = App.nuvem();
    el.innerHTML = `
      ${nuvem ? `<div class="abas mb"><button class="aba ativa" data-aud="acoes">Ações no sistema</button><button class="aba" data-aud="banco">Alterações nos dados</button></div>
      <div class="card sem-padding" id="aud-banco" hidden>
        <div style="padding:12px 16px;border-bottom:1px solid var(--borda)" class="muted small">Registro feito pelo próprio banco de dados a cada inclusão, alteração ou exclusão. Não depende do navegador de quem alterou e não pode ser apagado pela tela. Mostra as 300 alterações mais recentes.</div>
        <div id="aud-banco-lista"><div class="vazio">Carregando…</div></div>
      </div>` : ''}
      <div class="card sem-padding" id="aud-acoes">
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
    // ----- alterações nos dados (registro do banco) -----
    const TIPOS = { projetos: 'Projeto', registros: 'Contratação', vagas: 'Vaga', candidatos: 'Candidato', distritos: 'Distrito', mapasPdr: 'Mapa de unidades',
      cidades: 'Cidade', infoCidades: 'Anotação de cidade', meta: 'Configuração', usuarios: 'Usuário' };
    const VERBO = { criou: 'criou', alterou: 'alterou', removeu: 'excluiu', apagou: 'apagou' };
    function nomeDoItem(a) {
      const o = a.depois || a.antes || {};
      if (a.colecao === 'registros') { const c = Store.cidade(o.cidadeId), at = Store.cidade(o.atuacao); return `${o.tipo || ''} ${c ? c.nome + '/' + c.uf : ''}${at ? ' → ' + at.nome : ''}`.trim() || a.item_id; }
      if (a.colecao === 'infoCidades') { const c = Store.cidade(a.item_id); return c ? c.nome + '/' + c.uf : a.item_id; }
      return o.nome || o.titulo || o.login || a.item_id;
    }
    function camposAlterados(a) {
      if (a.operacao !== 'alterou' || !a.antes || !a.depois) return '';
      const ignorar = new Set(['atualizadoEm']);
      const chaves = [...new Set([...Object.keys(a.antes), ...Object.keys(a.depois)])].filter(k => !ignorar.has(k) && JSON.stringify(a.antes[k]) !== JSON.stringify(a.depois[k]));
      const curto = v => { const s = v == null ? '—' : typeof v === 'object' ? '(lista)' : String(v); return s.length > 40 ? s.slice(0, 40) + '…' : s; };
      return chaves.slice(0, 5).map(k => `${k}: ${curto(a.antes[k])} → ${curto(a.depois[k])}`).join(' · ') + (chaves.length > 5 ? ` · e mais ${chaves.length - 5}` : '');
    }
    async function carregarBanco() {
      const alvo = el.querySelector('#aud-banco-lista');
      try {
        const linhas = await Nuvem.auditoriaBanco(300);
        alvo.innerHTML = UI.tabela({
          vazio: 'Nenhuma alteração registrada ainda.',
          colunas: [
            { titulo: 'Quando', classe: 'nowrap', render: a => UI.fmtDataHora(a.quando) },
            { titulo: 'Usuário', render: a => UI.esc(a.login || '—') },
            { titulo: 'O que fez', render: a => `${UI.esc(VERBO[a.operacao] || a.operacao)} ${UI.esc((TIPOS[a.colecao] || a.colecao || '').toLowerCase())}` },
            { titulo: 'Item', render: a => UI.esc(nomeDoItem(a)) },
            { titulo: 'O que mudou', render: a => `<span class="muted small">${UI.esc(camposAlterados(a))}</span>` }
          ],
          linhas
        });
      } catch (e) { alvo.innerHTML = `<div class="vazio erro">Não foi possível carregar: ${UI.esc(e.message)}</div>`; }
    }
    el.querySelectorAll('[data-aud]').forEach(b => b.addEventListener('click', () => {
      el.querySelectorAll('[data-aud]').forEach(x => x.classList.toggle('ativa', x === b));
      const banco = b.dataset.aud === 'banco';
      el.querySelector('#aud-banco').hidden = !banco; el.querySelector('#aud-acoes').hidden = banco;
      if (banco) carregarBanco();
    }));
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
        ${App.nuvem() ? `<div class="card">
          <h2>Backup completo do banco</h2>
          <p class="muted small">Baixa tudo o que está no banco central e que você pode ver: cadastros, vagas, contratações, <b>pessoas e candidatos com o histórico</b>. Tem dados pessoais (LGPD): guarde em local seguro e não compartilhe.</p>
          <button class="btn btn-primario" id="bk-completo">Baixar backup completo (.json)</button>
          <p class="muted small" style="margin-bottom:0">Com o banco central, <b>restaurar</b> pelo arquivo fica desligado: ele substituiria os dados de todos e apagaria o que foi feito depois do backup. O banco guarda o conteúdo dos itens excluídos e o histórico de cada candidato; para recuperar algo, fale com o administrador do sistema.</p>
        </div>` : `<div class="card">
          <h2>Restaurar backup</h2>
          <p class="muted small">Substitui <b>todos</b> os dados atuais pelos do arquivo escolhido. ${admin ? '' : '<b>Somente administradores podem restaurar.</b>'}</p>
          ${admin ? '<input type="file" id="bk-arquivo" accept=".json,application/json">' : ''}
        </div>`}
      </div>
      ${App.nuvem() && admin ? `<div class="card mt">
        <h2>Dados pessoais (LGPD)</h2>
        <p class="muted small">Apaga nome, CPF, telefone, e-mail e nascimento de quem <b>não foi contratado</b> e está sem nenhum movimento há muito tempo (o histórico do processo fica, sem identificar a pessoa). Quem está em processo ou admitido não entra. Para apagar os dados de uma pessoa específica (pedido dela), abra a ficha em Candidatos.</p>
        <div class="linha" style="gap:8px;align-items:flex-end;flex-wrap:wrap">
          <label>Sem movimento há mais de<select id="lg-meses"><option value="6">6 meses</option><option value="12" selected>12 meses</option><option value="24">24 meses</option></select></label>
          <button class="btn" id="lg-contar">Ver quantas pessoas</button>
          <span id="lg-res" class="muted small"></span>
        </div>
      </div>` : ''}
      <div class="card mt">
        <h2>Onde os dados ficam?</h2>
        <p class="muted small">${App.nuvem() ? 'Os dados ficam no banco central (Supabase) e são os mesmos em qualquer computador: basta entrar com o seu usuário. Este navegador guarda uma cópia para abrir rápido e para continuar funcionando se a internet cair (as alterações sobem quando ela voltar). O backup em arquivo continua valendo como cópia de segurança. <b>Restaurar um backup substitui os dados de todos os usuários.</b>'
          : 'Nesta versão os dados são gravados no armazenamento local deste navegador, neste computador. Eles não são apagados ao fechar o navegador, mas podem ser perdidos se o histórico/dados do site forem limpos ou se o computador for trocado. Por isso, faça backups periódicos. Se precisar que várias pessoas usem o sistema ao mesmo tempo em computadores diferentes, o próximo passo é publicá-lo em um servidor com banco de dados central.'}</p>
      </div>`;
    el.querySelector('#bk-exportar').addEventListener('click', () => {
      const data = RH.hoje();
      UI.baixarArquivo(`backup-mapa-rh-${data}.json`, Store.exportar(), 'application/json');
      Store.auditar('backup.exportar', 'Backup exportado', App.usuario);
      UI.toast('Backup gerado.', 'sucesso');
    });
    const bc = el.querySelector('#bk-completo');
    if (bc) bc.addEventListener('click', async () => {
      bc.disabled = true; bc.textContent = 'Baixando…';
      try {
        const b = await Nuvem.rh.backupCompleto();
        UI.baixarArquivo(`backup-completo-mapa-rh-${RH.hoje()}.json`, JSON.stringify(b), 'application/json');
        Store.auditar('backup.exportar', `Backup completo do banco (${b.pessoas.length} pessoas, ${b.candidatos.length} candidatos)`, App.usuario);
        UI.toast('Backup completo baixado.', 'sucesso');
      } catch (err) { UI.toast(err.message, 'erro', 7000); }
      finally { bc.disabled = false; bc.textContent = 'Baixar backup completo (.json)'; }
    });
    const lc = el.querySelector('#lg-contar');
    if (lc) lc.addEventListener('click', async () => {
      const meses = +el.querySelector('#lg-meses').value, res = el.querySelector('#lg-res');
      try {
        const n = await Nuvem.rh.anonimizarAntigos(meses, true);
        if (!n) { res.textContent = 'Ninguém nessa situação.'; return; }
        res.innerHTML = `${n === 1 ? '1 pessoa' : n + ' pessoas'} sem contratação e sem movimento há mais de ${meses} meses. <button class="btn btn-perigo btn-pequeno" id="lg-apagar">Apagar os dados pessoais</button>`;
        el.querySelector('#lg-apagar').addEventListener('click', async () => {
          if (!await UI.confirmar(`Apagar nome, CPF, telefone, e-mail e nascimento de ${n === 1 ? '1 pessoa' : n + ' pessoas'}? Não dá para desfazer.`, { perigo: true, textoOk: 'Apagar' })) return;
          try { const f = await Nuvem.rh.anonimizarAntigos(meses, false); res.textContent = `Pronto: dados de ${f === 1 ? '1 pessoa apagados' : f + ' pessoas apagados'}.`; Store.auditar('lgpd.limpeza', `Dados pessoais apagados (${f}, mais de ${meses} meses)`, App.usuario); }
          catch (err) { UI.toast(err.message, 'erro', 7000); }
        });
      } catch (err) { UI.toast(err.message, 'erro', 7000); }
    });
    const arq = el.querySelector('#bk-arquivo');
    if (arq) arq.addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      if (!(await UI.confirmar(`Restaurar o backup "${f.name}"? Todos os dados atuais serão substituídos.`, { textoOk: 'Restaurar', perigo: true }))) { arq.value = ''; return; }
      try {
        const texto = await f.text();
        Store.importar(texto, App.usuario);
        if (App.nuvem()) { UI.toast('Backup restaurado e enviado para o banco central.', 'sucesso', 5000); App.recarregar(); return; }
        UI.toast('Backup restaurado. Entre novamente.', 'sucesso', 5000);
        setTimeout(() => App.sair(), 800);
      } catch (err) { UI.toast(err.message, 'erro', 7000); arq.value = ''; }
    });
  }
};
