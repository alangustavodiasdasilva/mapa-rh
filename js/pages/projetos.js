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
          <p class="muted" style="margin:0">Cada projeto tem um ou mais <b>estados</b> (com ano opcional). As contratações são cadastradas dentro do projeto, com a cidade de origem e a cidade de atuação.</p>
          ${podeEditar ? '<button class="btn btn-primario" id="btn-novo">+ Novo projeto</button>' : ''}
        </div>
        <div class="grade grade-3" id="lista"></div>`;
      const lista = el.querySelector('#lista');
      lista.innerHTML = resumo.map(r => {
        const p = r.projeto;
        return `<div class="card projeto-card ${p.ativo ? '' : 'inativo'}" style="border-top-color:${UI.esc(p.cor)}" data-id="${p.id}">
          <div class="linha entre"><h3>${UI.esc(p.nome)}</h3>${p.ativo ? '' : '<span class="badge badge-cinza">inativo</span>'}</div>
          <div class="muted">${icone('mapa', 14)} ${Store.ufsProjeto(p).map(x => `${x} — ${UI.esc(Store.UFS[x] || '')}`).join(' · ')}${p.ano ? ` · <b>${p.ano}</b>` : ''}</div>
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
      const md = UI.modal({
        titulo: p ? 'Editar projeto' : 'Novo projeto',
        corpo: `
          <label>Nome do projeto<input id="p-nome" value="${UI.esc(p ? p.nome : '')}" placeholder="Ex.: Contratações RS 2024"></label>
          <div class="form-linha">
            <label>Ano (opcional)<input type="number" id="p-ano" min="1990" max="2100" value="${p && p.ano ? p.ano : ''}" placeholder="Ex.: ${anoAtual}"></label>
            <label>Estado principal (centro do mapa)<select id="p-uf">${UI.opcoesUF(p ? p.uf : '')}</select></label>
          </div>
          <label style="margin-bottom:4px">Estados (UF) onde o projeto contrata — marque um ou mais</label>
          <div class="ufs-grade" id="p-ufs">${Object.keys(Store.UFS).sort().map(u => `<label class="uf-opcao"><input type="checkbox" value="${u}" ${(p ? Store.ufsProjeto(p) : []).includes(u) ? 'checked' : ''}> ${u}</label>`).join('')}</div>
          <label>Descrição (opcional)<input id="p-desc" value="${UI.esc(p ? p.descricao : '')}"></label>
          <div class="form-linha">
            <label>Cor no mapa<input type="color" id="p-cor" value="${UI.esc(p ? p.cor : '#2563eb')}"></label>
            <label style="display:flex;gap:8px;align-items:center;margin-top:22px"><input type="checkbox" id="p-ativo" ${!p || p.ativo ? 'checked' : ''}> Projeto ativo</label>
          </div>
          <p class="ajuda">As cidades onde as pessoas trabalham (atuação) precisam estar em um dos estados marcados. A cidade de origem pode ser de qualquer lugar; quem vem de fora desses estados conta como "fora do estado".</p>`,
        botoes: [
          { texto: 'Cancelar' },
          { texto: 'Salvar', classe: 'btn-primario', acao: (m) => {
            const q = s => m.corpo.querySelector(s);
            const ufs = [...m.corpo.querySelectorAll('#p-ufs input:checked')].map(i => i.value);
            Store.salvarProjeto({ id: p ? p.id : null, nome: q('#p-nome').value, uf: q('#p-uf').value, ufs, ano: q('#p-ano').value,
              descricao: q('#p-desc').value, cor: q('#p-cor').value, ativo: q('#p-ativo').checked }, App.usuario);
            App.usuario = Store.usuarioAtual() || App.usuario;
            UI.toast('Projeto salvo.', 'sucesso'); App.atualizarFiltroProjetos(); renderLista();
          } }
        ]
      });
      const selUF = md.corpo.querySelector('#p-uf');
      const sincronizar = () => {
        const marcadas = [...md.corpo.querySelectorAll('#p-ufs input:checked')].map(i => i.value);
        const atual = selUF.value;
        selUF.innerHTML = marcadas.length ? marcadas.map(u => `<option value="${u}" ${u === atual ? 'selected' : ''}>${u} — ${UI.esc(Store.UFS[u])}</option>`).join('') : '<option value="">(marque um estado)</option>';
        md.corpo.querySelectorAll('.uf-opcao').forEach(l => l.classList.toggle('marcada', l.querySelector('input').checked));
      };
      md.corpo.querySelectorAll('#p-ufs input').forEach(i => i.addEventListener('change', () => {
        // marcar o estado principal quando ainda não há nenhum
        sincronizar();
      }));
      sincronizar();
    }

    renderLista();
  }
};
