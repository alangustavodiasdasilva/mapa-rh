// Candidatos: quadro por etapa (Triagem → Entrevista → Documentos → Admitido). Cada candidato pertence a uma vaga.
// Ao chegar em "Admitido" a contratação é criada no projeto da vaga e aparece no mapa (de onde vem → onde trabalha).
Paginas.candidatos = {
  titulo: 'Candidatos',
  filtrosUsados: ['projeto'],
  render(el) {
    const podeEditar = App.podeEditar();
    let vagaId = localStorage.getItem('maparh:cand-vaga') || '';
    let busca = '';

    function vagasDisponiveis() { return Store.vagasVisiveis(App.usuario, { projetoId: App.filtros.projetoId }); }

    function render() {
      const vagas = vagasDisponiveis();
      if (vagaId && !vagas.some(v => v.id === vagaId)) vagaId = '';
      const vagaSel = vagaId ? vagas.find(v => v.id === vagaId) : null;
      let cands = Store.candidatosVisiveis(App.usuario, { vagaId, projetoId: App.filtros.projetoId });
      if (busca) { const b = Store.normalizar(busca); cands = cands.filter(c => Store.normalizar(c.nome + ' ' + (c.cidade ? c.cidade.nome : '') + ' ' + (c.telefone || '')).includes(b)); }
      const porEtapa = {}; for (const k of Object.keys(Store.ETAPAS)) porEtapa[k] = [];
      cands.forEach(c => (porEtapa[c.etapa] || porEtapa.triagem).push(c));

      el.innerHTML = `
        <div class="pagina-cab">
          <div class="linha">
            <label style="margin:0">Vaga<select id="c-vaga" style="min-width:260px"><option value="">Todas as vagas abertas</option>
              ${vagas.map(v => `<option value="${v.id}" ${v.id === vagaId ? 'selected' : ''}>${UI.esc(v.titulo)} — ${UI.esc(v.cidade ? v.cidade.nome : '')}${['preenchida', 'cancelada'].includes(v.status) ? ' (' + Store.STATUS_VAGA[v.status].toLowerCase() + ')' : ''}</option>`).join('')}</select></label>
            <label style="margin:0">Procurar<input id="c-busca" class="busca" placeholder="Nome, cidade ou telefone" value="${UI.esc(busca)}"></label>
          </div>
          ${podeEditar ? `<button class="btn btn-primario" id="btn-novo" ${vagas.length ? '' : 'disabled title="Crie uma vaga primeiro"'}>+ Novo candidato</button>` : ''}
        </div>
        ${vagaSel ? `<div class="caixa caixa-info mb" style="margin-top:0"><b>${UI.esc(vagaSel.titulo)}</b> em ${UI.esc(vagaSel.cidade ? vagaSel.cidade.nome + '/' + vagaSel.cidade.uf : '—')} · ${UI.badgeTipo(vagaSel.tipo)} · ${vagaSel.admitidos} de ${vagaSel.quantidade} posição(ões) preenchida(s) · <span class="badge badge-cinza">${UI.esc(Store.STATUS_VAGA[vagaSel.status])}</span>
          ${vagaSel.requisitos ? `<div class="small muted" style="margin-top:4px">Requisitos: ${UI.esc(vagaSel.requisitos)}</div>` : ''}</div>` : ''}
        ${!vagas.length ? '<div class="card vazio">Nenhuma vaga cadastrada. Crie a vaga em <a href="#/vagas">Vagas</a> e depois cadastre os candidatos aqui.</div>' : `
        <div class="kanban">
          ${Store.ORDEM_ETAPAS.map((k, i) => `<div class="coluna" data-etapa="${k}">
            <div class="coluna-cab"><span class="passo-num">${i + 1}</span> ${UI.esc(Store.ETAPAS[k])} <span class="aba-num">${porEtapa[k].length}</span></div>
            <div class="coluna-dica small muted">${dicaEtapa(k)}</div>
            ${porEtapa[k].map(c => cardCandidato(c)).join('') || '<div class="coluna-vazia">—</div>'}
          </div>`).join('')}
        </div>
        ${porEtapa.reprovado.length ? `<details class="mt"><summary class="muted">Não seguiram no processo (${porEtapa.reprovado.length})</summary><div class="kanban kanban-reprovados">${porEtapa.reprovado.map(c => cardCandidato(c)).join('')}</div></details>` : ''}`}`;

      el.querySelector('#c-vaga').addEventListener('change', e => { vagaId = e.target.value; localStorage.setItem('maparh:cand-vaga', vagaId); render(); });
      el.querySelector('#c-busca').addEventListener('input', UI.debounce(e => { busca = e.target.value.trim(); render(); el.querySelector('#c-busca').focus(); }, 250));
      const bn = el.querySelector('#btn-novo'); if (bn) bn.addEventListener('click', () => formCandidato(null));
      el.querySelectorAll('.cand-card').forEach(card => {
        card.querySelectorAll('[data-mover]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); mover(card.dataset.id, b.dataset.mover); }));
        card.addEventListener('click', () => abrirCandidato(card.dataset.id));
      });
    }

    function dicaEtapa(k) {
      return { triagem: 'Currículos recebidos. Ligue e confira os requisitos.', entrevista: 'Agendados ou entrevistados. Decida quem segue.',
        documentos: 'Aprovados: confira a lista de documentos e o exame admissional.', admitido: 'Contratados. Já entraram no mapa e nos relatórios.' }[k] || '';
    }

    function cardCandidato(c) {
      const i = Store.ORDEM_ETAPAS.indexOf(c.etapa);
      const docs = c.etapa === 'documentos' || c.etapa === 'admitido' ? `<div class="barra-docs" title="${c.docsOk} de ${c.docsTotal} documentos"><i style="width:${Math.round(100 * c.docsOk / c.docsTotal)}%"></i></div><div class="small muted">${c.docsOk}/${c.docsTotal} documentos</div>` : '';
      return `<div class="cand-card" data-id="${c.id}">
        <div class="cand-nome">${UI.esc(c.nome)}</div>
        <div class="small muted">${c.cidade ? UI.esc(c.cidade.nome + '/' + c.cidade.uf) : '<span class="erro">cidade de origem não informada</span>'}${!vagaId && c.vaga ? ' · ' + UI.esc(c.vaga.titulo) : ''}</div>
        ${c.telefone ? `<div class="small">${UI.esc(c.telefone)}</div>` : ''}
        ${docs}
        ${podeEditar ? `<div class="cand-acoes">
          ${i > 0 ? `<button class="btn-icone" data-mover="${Store.ORDEM_ETAPAS[i - 1]}" title="Voltar para ${Store.ETAPAS[Store.ORDEM_ETAPAS[i - 1]]}">◀</button>` : '<span></span>'}
          ${c.etapa !== 'admitido' && c.etapa !== 'reprovado' ? `<button class="btn-icone perigo" data-mover="reprovado" title="Não seguiu no processo">✕</button>` : ''}
          ${c.etapa === 'reprovado' ? `<button class="btn-icone" data-mover="triagem" title="Voltar para a triagem">↶</button>` : ''}
          ${i >= 0 && i < Store.ORDEM_ETAPAS.length - 1 ? `<button class="btn-icone avancar" data-mover="${Store.ORDEM_ETAPAS[i + 1]}" title="Avançar para ${Store.ETAPAS[Store.ORDEM_ETAPAS[i + 1]]}">▶</button>` : ''}
        </div>` : ''}
      </div>`;
    }

    async function mover(id, etapa) {
      const c = Store.candidatosVisiveis(App.usuario).find(x => x.id === id);
      if (!c) return;
      if (etapa === 'admitido') {
        if (!c.cidadeId) { UI.toast('Informe a cidade de onde o candidato vem antes de admitir.', 'aviso'); abrirCandidato(id); return; }
        const faltam = Store.DOCUMENTOS.filter(d => !(c.documentos || {})[d.id]);
        const aviso = faltam.length ? ` Ainda faltam ${faltam.length} documento(s) na lista.` : '';
        if (!await UI.confirmar(`Admitir ${c.nome}? A contratação (${c.cidade.nome} → ${c.vaga.cidade.nome}, ${UI.rotuloTipo(c.vaga.tipo)}) será criada no projeto ${Store.rotuloProjeto(c.vaga.projeto)} e aparece no mapa.${aviso}`, { titulo: 'Confirmar admissão', textoOk: 'Admitir' })) return;
      }
      if (c.etapa === 'admitido' && etapa !== 'admitido' && !await UI.confirmar(`${c.nome} já foi admitido. Ao voltar de etapa a contratação criada será removida do mapa. Continuar?`, { perigo: true, textoOk: 'Voltar etapa' })) return;
      try { Store.moverCandidato(id, etapa, App.usuario); UI.toast(etapa === 'admitido' ? 'Admitido! A contratação já está no mapa.' : `Movido para ${Store.ETAPAS[etapa]}.`, 'sucesso'); render(); }
      catch (e) { UI.toast(e.message, 'erro'); }
    }

    // ---------- ficha do candidato (dados + documentos) ----------
    function abrirCandidato(id) {
      const c = Store.candidatosVisiveis(App.usuario).find(x => x.id === id);
      if (!c) return;
      const docs = c.documentos || {};
      const corpo = `
        <div class="ficha-cand">
          <div>
            <div class="ficha-grade">
              <div class="ficha-dado"><span>Vaga</span><b>${UI.esc(c.vaga.titulo)}</b><small>${UI.esc(c.vaga.cidade ? c.vaga.cidade.nome + '/' + c.vaga.cidade.uf : '')} · ${UI.rotuloTipo(c.vaga.tipo)}</small></div>
              <div class="ficha-dado"><span>Etapa</span><b>${UI.esc(Store.ETAPAS[c.etapa])}</b></div>
              <div class="ficha-dado"><span>Vem de</span><b>${c.cidade ? UI.esc(c.cidade.nome + '/' + c.cidade.uf) : '—'}</b>${c.cidade && c.vaga.cidade ? `<small>${UI.fmtKm(Store.distanciaKm(c.cidade, c.vaga.cidade))} até o trabalho</small>` : ''}</div>
              <div class="ficha-dado"><span>Contato</span><b>${UI.esc(c.telefone || '—')}</b><small>${UI.esc(c.email || '')}</small></div>
              <div class="ficha-dado"><span>Chegou por</span><b>${UI.esc(c.origemContato || '—')}</b></div>
              <div class="ficha-dado"><span>Cadastrado em</span><b>${UI.fmtData(c.criadoEm)}</b>${c.admitidoEm ? `<small>admitido em ${UI.fmtData(c.admitidoEm)}</small>` : ''}</div>
            </div>
            ${c.observacoes ? `<p class="small" style="margin-top:10px;white-space:pre-wrap">${UI.esc(c.observacoes)}</p>` : ''}
            ${c.telefone ? `<div class="linha mt"><a class="btn btn-pequeno" target="_blank" rel="noopener" href="https://wa.me/55${UI.esc(c.telefone.replace(/\D/g, ''))}">WhatsApp</a><a class="btn btn-pequeno" href="tel:${UI.esc(c.telefone.replace(/\D/g, ''))}">Ligar</a></div>` : ''}
          </div>
          <div>
            <h3 style="margin-bottom:6px">Documentos de admissão</h3>
            <p class="small muted">Marque conforme o candidato entrega. ${podeEditar ? '' : '(somente leitura)'}</p>
            <div class="checkbox-lista docs-lista">
              ${Store.DOCUMENTOS.map(d => `<label><input type="checkbox" data-doc="${d.id}" ${docs[d.id] ? 'checked' : ''} ${podeEditar ? '' : 'disabled'}> <span>${UI.esc(d.nome)}</span>${docs[d.id] ? `<small class="muted">${UI.fmtData(docs[d.id])}</small>` : ''}</label>`).join('')}
            </div>
          </div>
        </div>`;
      const botoes = [{ texto: 'Fechar' }];
      if (podeEditar) {
        botoes.unshift({ texto: 'Editar dados', acao: () => { setTimeout(() => formCandidato(c), 0); } });
        if (App.usuario.perfil === 'admin') botoes.unshift({ texto: 'Excluir', classe: 'btn-perigo', acao: async () => {
          if (!await UI.confirmar(`Excluir o candidato ${c.nome}?${c.registroId ? ' A contratação criada na admissão continua no mapa.' : ''}`, { perigo: true, textoOk: 'Excluir' })) return false;
          Store.excluirCandidato(c.id, App.usuario); render();
        } });
      }
      const m = UI.modal({ titulo: c.nome, largura: '820px', corpo, botoes, aoFechar: render });
      m.corpo.querySelectorAll('[data-doc]').forEach(ch => ch.addEventListener('change', () => {
        try { Store.marcarDocumento(c.id, ch.dataset.doc, ch.checked); } catch (e) { UI.toast(e.message, 'erro'); ch.checked = !ch.checked; }
      }));
    }

    // ---------- formulário ----------
    function formCandidato(c) {
      const vagas = vagasDisponiveis().filter(v => !['preenchida', 'cancelada'].includes(v.status) || (c && c.vagaId === v.id));
      if (!vagas.length) { UI.toast('Nenhuma vaga aberta. Crie a vaga primeiro.', 'aviso'); return; }
      const vagaIni = c ? c.vagaId : (vagaId || vagas[0].id);
      const corpo = `
        <div class="form-linha">
          <label style="grid-column:1/-1">Nome completo<input id="k-nome" value="${UI.esc(c ? c.nome : '')}"></label>
          <label style="grid-column:1/-1">Vaga<select id="k-vaga">${vagas.map(v => `<option value="${v.id}" ${v.id === vagaIni ? 'selected' : ''}>${UI.esc(v.titulo)} — ${UI.esc(v.cidade ? v.cidade.nome + '/' + v.cidade.uf : '')} (${UI.rotuloTipo(v.tipo)})</option>`).join('')}</select></label>
          <label>Cidade de onde vem (mora)<input id="k-cidade" placeholder="Digite e escolha" value="${UI.esc(c && c.cidade ? c.cidade.nome : '')}" data-cidade-id="${c && c.cidadeId ? c.cidadeId : ''}"><span class="muted small">Vai para o mapa como origem</span></label>
          <label>Estado da cidade<select id="k-uf">${UI.opcoesUF(c && c.cidade ? c.cidade.uf : '')}</select></label>
          <label>Telefone / WhatsApp<input id="k-telefone" value="${UI.esc(c ? c.telefone : '')}" placeholder="(54) 9 9999-9999"></label>
          <label>E-mail<input id="k-email" type="email" value="${UI.esc(c ? c.email : '')}"></label>
          <label>Chegou por qual canal<input id="k-origem" list="k-canais" value="${UI.esc(c ? c.origemContato : '')}" placeholder="SINE, indicação, WhatsApp…"><datalist id="k-canais">${Store.CANAIS.map(k => `<option value="${UI.esc(k.nome)}">`).join('')}</datalist></label>
          ${c ? `<label>Etapa<select id="k-etapa">${Object.entries(Store.ETAPAS).filter(([k]) => k !== 'admitido' || c.etapa === 'admitido').map(([k, r]) => `<option value="${k}" ${c.etapa === k ? 'selected' : ''}>${r}</option>`).join('')}</select></label>` : '<div></div>'}
          <label style="grid-column:1/-1">Observações<textarea id="k-obs" rows="3" placeholder="Experiência, disponibilidade, resultado da entrevista…">${UI.esc(c ? c.observacoes : '')}</textarea></label>
        </div>`;
      const m = UI.modal({
        titulo: c ? 'Editar candidato' : 'Novo candidato', largura: '640px', corpo,
        botoes: [{ texto: 'Cancelar' }, { texto: c ? 'Salvar' : 'Cadastrar', classe: 'btn-primario', acao: (md) => {
          const q = s => md.corpo.querySelector(s);
          const cidEl = q('#k-cidade');
          if (cidEl.value.trim() && !cidEl.dataset.cidadeId) {
            const cc = Store.resolverCidade(cidEl.value, q('#k-uf').value) || Store.cidadeAproximada(cidEl.value, q('#k-uf').value);
            if (cc) cidEl.dataset.cidadeId = cc.id; else throw new Error('Escolha a cidade na lista (digite o nome e clique na sugestão) ou deixe em branco.');
          }
          const salvo = Store.salvarCandidato({ id: c ? c.id : null, nome: q('#k-nome').value, vagaId: q('#k-vaga').value, cidadeId: cidEl.dataset.cidadeId || null,
            telefone: q('#k-telefone').value, email: q('#k-email').value, origemContato: q('#k-origem').value, observacoes: q('#k-obs').value,
            etapa: c ? q('#k-etapa').value : null }, App.usuario);
          if (c && c.etapa !== salvo.etapa && (c.etapa === 'admitido' || salvo.etapa === 'admitido')) {
            // trocar para/da admissão pelo formulário passa pela mesma regra do quadro (cria/remove a contratação)
            Store.moverCandidato(salvo.id, c.etapa, App.usuario); Store.moverCandidato(salvo.id, salvo.etapa, App.usuario);
          }
          UI.toast(c ? 'Candidato salvo.' : 'Candidato cadastrado na triagem.', 'sucesso');
          render();
        } }]
      });
      const q = s => m.corpo.querySelector(s);
      const cidEl = q('#k-cidade');
      const ufFn = () => q('#k-uf').value || (Store.vaga(q('#k-vaga').value) || {}).cidadeId && (Store.cidade(Store.vaga(q('#k-vaga').value).cidadeId) || {}).uf || '';
      if (!q('#k-uf').value) { const v = Store.vaga(vagaIni); const cv = v && Store.cidade(v.cidadeId); if (cv) q('#k-uf').value = cv.uf; }
      UI.autocompleteCidade(cidEl, { uf: ufFn, aoSelecionar: cc => { q('#k-uf').value = cc.uf; },
        aoGeocodificar: async (t, u) => { try { const cc = await Geo.geocodificarESalvar(t, u); cidEl.value = cc.nome; cidEl.dataset.cidadeId = cc.id; } catch (e) { UI.toast(e.message, 'erro'); } } });
      setTimeout(() => q('#k-nome').focus(), 60);
    }

    render();
  }
};
