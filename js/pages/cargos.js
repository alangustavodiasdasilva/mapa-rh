// Cadastro de cargos: quais documentos cada cargo cobra na admissão.
// A etapa de Documentação (tela Candidatos) usa esta lista para saber o que falta de cada pessoa. Cargo sem cadastro usa a lista padrão inteira.
Paginas.cargos = {
  titulo: 'Cargos e documentos',
  semFiltros: true,
  render(el) {
    const podeEditar = App.podeEditar();
    const PADRAO = Store.DOCUMENTOS_NOMES;

    function desenhar() {
      const cargos = Store.cargos();
      el.innerHTML = `
        <div class="card sem-padding">
          <div class="cad-lista-cab">
            <div>
              <b>Cargos <span class="aba-num">${UI.fmtNum(cargos.length)}</span></b>
              <div class="muted small" style="margin-top:3px">Os documentos marcados aqui são os que a etapa de Documentação (em Candidatos) cobra de quem entra nesse cargo.</div>
            </div>
            ${podeEditar ? '<button class="btn btn-primario" id="cg-novo">+ Novo cargo</button>' : ''}
          </div>
          ${cargos.length ? `<div class="cg-grade cg-cab"><span>Cargo</span><span>Documentos cobrados</span><span></span></div>` +
            cargos.map(c => `<div class="cg-grade cg-linha" data-id="${c.id}">
              <div class="cg-nome">${UI.esc(c.nome)}</div>
              <div class="cg-docs"><b>${c.documentos.length}</b> ${c.documentos.length === 1 ? 'documento' : 'documentos'}<span>${UI.esc(c.documentos.join(' · '))}</span></div>
              <div class="cg-acoes">${podeEditar ? '<button class="btn-link" data-cg="editar">Editar</button><button class="btn-link perigo" data-cg="excluir">Excluir</button>' : ''}</div>
            </div>`).join('')
            : `<div class="vazio" style="padding:32px 18px">Nenhum cargo cadastrado ainda.${podeEditar ? ' Clique em <b>+ Novo cargo</b> para definir os documentos do primeiro.' : ''}<br><span class="small">Enquanto isso, a Documentação cobra a lista padrão de ${PADRAO.length} documentos de todo mundo.</span></div>`}
        </div>`;
      const bn = el.querySelector('#cg-novo'); if (bn) bn.addEventListener('click', () => formulario(null));
      el.querySelectorAll('[data-cg]').forEach(b => b.addEventListener('click', async () => {
        const c = Store.cargos().find(x => x.id === b.closest('[data-id]').dataset.id); if (!c) return;
        if (b.dataset.cg === 'editar') return formulario(c);
        if (await UI.confirmar(`Excluir o cargo "${c.nome}"? Quem tem esse cargo em Candidatos volta a usar a lista padrão de documentos.`, { perigo: true, textoOk: 'Excluir' })) {
          Store.excluirCargo(c.id, App.usuario); UI.toast('Cargo excluído.', 'sucesso'); desenhar();
        }
      }));
    }

    function formulario(c) {
      // cargo novo já vem com o básico marcado; CNH e conselho de classe só quando a função exige
      const marcados = c ? c.documentos : PADRAO.filter(d => !/^(CNH|Registro no conselho)/.test(d));
      const extras = c ? c.documentos.filter(d => !PADRAO.includes(d)) : [];
      const m = UI.modal({ titulo: c ? `Cargo: ${c.nome}` : 'Novo cargo', largura: '640px', fecharAoClicarFora: false,
        corpo: `<label>Nome do cargo<input id="cg-nome" value="${UI.esc(c ? c.nome : '')}" placeholder="Ex.: Operador de secador"></label>
          <div class="doc-secao" style="margin-top:14px">Documentos cobrados <span id="cg-conta"></span></div>
          <div class="doc-grupo doc-grupo-2" id="cg-docs">${PADRAO.map(d => `<div class="doc-item doc-entregue"><label><input type="checkbox" value="${UI.esc(d)}" ${marcados.includes(d) ? 'checked' : ''}> <span>${UI.esc(d)}</span></label></div>`).join('')}</div>
          <label style="margin-top:14px">Outros documentos deste cargo (separe por ponto e vírgula)<input id="cg-extras" value="${UI.esc(extras.join('; '))}" placeholder="Ex.: certificado NR-33; curso de operador de empilhadeira"></label>`,
        botoes: [{ texto: 'Cancelar' }, { texto: c ? 'Salvar' : 'Cadastrar cargo', classe: 'btn-primario', acao: md => {
          const g = s => md.corpo.querySelector(s);
          const docs = [...md.corpo.querySelectorAll('#cg-docs input:checked')].map(i => i.value).concat(g('#cg-extras').value.split(';').map(s => s.trim()).filter(Boolean));
          Store.salvarCargo({ id: c ? c.id : null, nome: g('#cg-nome').value, documentos: docs }, App.usuario);
          UI.toast('Cargo salvo.', 'sucesso'); desenhar();
        } }] });
      const conta = () => { m.corpo.querySelector('#cg-conta').textContent = m.corpo.querySelectorAll('#cg-docs input:checked').length + m.corpo.querySelector('#cg-extras').value.split(';').filter(s => s.trim()).length; };
      m.corpo.addEventListener('input', conta); m.corpo.addEventListener('change', conta); conta();
      if (!c) setTimeout(() => m.corpo.querySelector('#cg-nome').focus(), 60);
    }

    desenhar();
  }
};
