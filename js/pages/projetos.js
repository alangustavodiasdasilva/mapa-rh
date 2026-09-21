Paginas.projetos = {
  titulo: 'Projetos',
  semFiltros: true,
  render(el) {
    const podeEditar = App.podeEditar();
    function renderLista() {
      const projetos = App.projetosVisiveis();
      const regs = Store.registrosFiltrados({ usuario: App.usuario });
      const resumo = Analise.porProjeto(regs, projetos);
      el.innerHTML = `
        <div class="linha entre mb">
          <p class="muted" style="margin:0">Cada projeto é um <b>estado</b> (com ano opcional). As contratações são cadastradas dentro do projeto, com a cidade de origem e a cidade de atuação.</p>
          ${podeEditar ? '<button class="btn btn-primario" id="btn-novo">+ Novo projeto</button>' : ''}
        </div>
        <div class="grade grade-3" id="lista"></div>`;
      const lista = el.querySelector('#lista');
      lista.innerHTML = resumo.map(r => {
        const p = r.projeto;
        return `<div class="card projeto-card ${p.ativo ? '' : 'inativo'}" style="border-top-color:${UI.esc(p.cor)}" data-id="${p.id}">
          <div class="linha entre"><h3>${UI.esc(p.nome)}</h3>${p.ativo ? '' : '<span class="badge badge-cinza">inativo</span>'}</div>
          <div class="muted">${icone('mapa', 14)} ${p.uf} — ${UI.esc(Store.UFS[p.uf] || '')}${p.ano ? ` · <b>${p.ano}</b>` : ''}</div>
          ${p.descricao ? `<div class="small">${UI.esc(p.descricao)}</div>` : ''}
          <div class="numeros">
            <span><b>${UI.fmtNum(r.total)}</b>contratações</span>
            <span style="color:var(--local)"><b>${UI.fmtNum(r.local)}</b>local</span>
            <span style="color:var(--movel)"><b>${UI.fmtNum(r.movel)}</b>móvel</span>
            <span><b>${UI.fmtNum(r.cidadesOrigem)}</b>cidades de origem</span>
          </div>
          <div class="numeros small muted">
            <span><b>${UI.fmtNum(r.cidadesAtuacao)}</b>cidades de atuação</span>
            <span><b>${UI.fmtNum(r.atuacaoMovel)}</b>todo o estado</span>
            <span><b>${UI.fmtNum(r.foraDoEstado)}</b>origem fora do estado</span>
          </div>
          <div class="linha nao-imprimir" style="margin-top:auto">
            <button class="btn btn-pequeno acao-ver">Ver no mapa</button>
            <button class="btn btn-pequeno acao-cadastro">Cadastro</button>
            ${podeEditar ? `<button class="btn btn-pequeno acao-editar">Editar</button>` : ''}
            ${App.usuario.perfil === 'admin' ? `<button class="btn btn-pequeno btn-perigo acao-excluir">Excluir</button>` : ''}
          </div>
        </div>`;
      }).join('') || '<div class="card vazio" style="grid-column:1/-1">Nenhum projeto cadastrado.</div>';

      const b = el.querySelector('#btn-novo'); if (b) b.addEventListener('click', () => abrirForm(null));
      lista.querySelectorAll('.projeto-card').forEach(card => {
        const id = card.dataset.id;
        const irCom = (pagina) => { App.filtros.projetoId = id; localStorage.setItem('maparh:filtros', JSON.stringify(App.filtros)); App.atualizarFiltroProjetos(); App.ir(pagina); };
        card.querySelector('.acao-ver').addEventListener('click', () => irCom('mapa'));
        card.querySelector('.acao-cadastro').addEventListener('click', () => irCom(Store.pode(App.usuario, 'cadastro') ? 'cadastro' : 'relatorios'));
        const e = card.querySelector('.acao-editar'); if (e) e.addEventListener('click', () => abrirForm(Store.projeto(id)));
        const x = card.querySelector('.acao-excluir'); if (x) x.addEventListener('click', async () => {
          const p = Store.projeto(id);
          const qtd = Store.registros().filter(r => r.projetoId === id).length;
          if (await UI.confirmar(`Excluir o projeto "${p.nome}" e suas ${qtd} contratação(ões)? Esta ação não pode ser desfeita.`, { textoOk: 'Excluir tudo', perigo: true })) {
            Store.excluirProjeto(id, App.usuario); UI.toast('Projeto excluído.', 'sucesso'); App.atualizarFiltroProjetos(); renderLista();
          }
        });
      });
    }

    function abrirForm(p) {
      const anoAtual = new Date().getFullYear();
      UI.modal({
        titulo: p ? 'Editar projeto' : 'Novo projeto',
        corpo: `
          <label>Nome do projeto<input id="p-nome" value="${UI.esc(p ? p.nome : '')}" placeholder="Ex.: Contratações RS 2024"></label>
          <div class="form-linha">
            <label>Estado (UF) de atuação<select id="p-uf">${UI.opcoesUF(p ? p.uf : '')}</select></label>
            <label>Ano (opcional)<input type="number" id="p-ano" min="1990" max="2100" value="${p && p.ano ? p.ano : ''}" placeholder="Ex.: ${anoAtual}"></label>
          </div>
          <label>Descrição (opcional)<input id="p-desc" value="${UI.esc(p ? p.descricao : '')}"></label>
          <div class="form-linha">
            <label>Cor no mapa<input type="color" id="p-cor" value="${UI.esc(p ? p.cor : '#2563eb')}"></label>
            <label style="display:flex;gap:8px;align-items:center;margin-top:22px"><input type="checkbox" id="p-ativo" ${!p || p.ativo ? 'checked' : ''}> Projeto ativo</label>
          </div>
          <p class="ajuda">As cidades de atuação cadastradas neste projeto devem ser do estado escolhido. "MÓVEL" na cidade de atuação significa qualquer lugar do estado.</p>`,
        botoes: [
          { texto: 'Cancelar' },
          { texto: 'Salvar', classe: 'btn-primario', acao: (m) => {
            const q = s => m.corpo.querySelector(s);
            Store.salvarProjeto({ id: p ? p.id : null, nome: q('#p-nome').value, uf: q('#p-uf').value, ano: q('#p-ano').value,
              descricao: q('#p-desc').value, cor: q('#p-cor').value, ativo: q('#p-ativo').checked }, App.usuario);
            App.usuario = Store.usuarioAtual() || App.usuario;
            UI.toast('Projeto salvo.', 'sucesso'); App.atualizarFiltroProjetos(); renderLista();
          } }
        ]
      });
    }

    renderLista();
  }
};
