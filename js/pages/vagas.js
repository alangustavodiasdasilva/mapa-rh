// Vagas: o que o RH precisa preencher. Cada vaga tem a cidade onde a pessoa vai trabalhar, o tipo (local/móvel)
// e os canais onde foi divulgada. Daqui saem o texto do anúncio e os atalhos para as plataformas.
Paginas.vagas = {
  titulo: 'Vagas',
  filtrosUsados: ['projeto', 'regiao', 'tipo'],
  render(el) {
    const podeEditar = App.podeEditar();
    let filtroStatus = localStorage.getItem('maparh:vagas-status') || 'abertas';

    function listar() {
      let vagas = Store.vagasVisiveis(App.usuario, { projetoId: App.filtros.projetoId });
      if (App.filtros.distritoId || App.filtros.microId) {
        const reg = App.regiaoFiltrada();
        const ids = new Set(reg.micro ? reg.micro.cidadeIds || [] : Store.cidadesDoDistrito(reg.distrito).map(c => c.id));
        vagas = vagas.filter(v => ids.has(v.cidadeId));
      }
      if (App.filtros.tipo) vagas = vagas.filter(v => v.tipo === App.filtros.tipo);
      if (filtroStatus === 'abertas') vagas = vagas.filter(v => !['preenchida', 'cancelada'].includes(v.status));
      else if (filtroStatus !== 'todas') vagas = vagas.filter(v => v.status === filtroStatus);
      return vagas;
    }

    function render() {
      const vagas = listar();
      const todas = Store.vagasVisiveis(App.usuario, { projetoId: App.filtros.projetoId });
      const abertas = todas.filter(v => !['preenchida', 'cancelada'].includes(v.status));
      const semDivulgacao = abertas.filter(v => !v.canaisDivulgados).length;
      const abas = [['abertas', 'Abertas', abertas.length], ['selecao', 'Em seleção', todas.filter(v => v.status === 'selecao').length],
        ['preenchida', 'Preenchidas', todas.filter(v => v.status === 'preenchida').length], ['todas', 'Todas', todas.length]];
      el.innerHTML = `
        <div class="pagina-cab">
          <div>
            <p class="muted" style="margin:0">Uma vaga diz <b>o cargo</b>, <b>onde a pessoa vai trabalhar</b> e <b>se é local ou móvel</b>. Divulgue nos canais, cadastre quem se candidatou e, ao admitir, a contratação entra sozinha no mapa.</p>
          </div>
          ${podeEditar ? '<button class="btn btn-primario" id="btn-nova">+ Nova vaga</button>' : ''}
        </div>
        ${semDivulgacao ? `<div class="caixa caixa-aviso mb" style="margin-top:0">${semDivulgacao === 1 ? '1 vaga aberta ainda não foi divulgada' : semDivulgacao + ' vagas abertas ainda não foram divulgadas'} em nenhum canal. Abra a vaga e clique em <b>Divulgar</b>.</div>` : ''}
        <div class="abas mb">${abas.map(([id, rot, n]) => `<button class="aba ${filtroStatus === id ? 'ativa' : ''}" data-aba="${id}">${rot} <span class="aba-num">${n}</span></button>`).join('')}</div>
        <div class="grade grade-3" id="lista"></div>`;
      el.querySelectorAll('.aba').forEach(b => b.addEventListener('click', () => { filtroStatus = b.dataset.aba; localStorage.setItem('maparh:vagas-status', filtroStatus); render(); }));
      const bn = el.querySelector('#btn-nova'); if (bn) bn.addEventListener('click', () => formVaga(null));

      const lista = el.querySelector('#lista');
      if (!vagas.length) {
        lista.innerHTML = `<div class="card vazio" style="grid-column:1/-1">${todas.length ? 'Nenhuma vaga neste filtro.' : 'Nenhuma vaga cadastrada ainda.' + (podeEditar ? ' Clique em <b>+ Nova vaga</b> para começar.' : '')}</div>`;
        return;
      }
      lista.innerHTML = vagas.map(v => cardVaga(v)).join('');
      lista.querySelectorAll('[data-acao]').forEach(b => b.addEventListener('click', () => {
        const v = Store.vagasVisiveis(App.usuario).find(x => x.id === b.closest('.vaga-card').dataset.id);
        if (!v) return;
        const acao = b.dataset.acao;
        if (acao === 'divulgar') modalDivulgar(v);
        else if (acao === 'candidatos') { localStorage.setItem('maparh:cand-vaga', v.id); App.ir('candidatos'); }
        else if (acao === 'procurar') { if (v.cidade) UI.modalBuscaCandidatos(v.cidade.nome, v.cidade.uf, v.titulo); }
        else if (acao === 'editar') formVaga(v);
        else if (acao === 'mapa') { App.filtros.projetoId = v.projetoId; sessionStorage.setItem('maparh:mapa-foco', JSON.stringify({ cidadeId: v.cidadeId })); App.aoMudarFiltros(); App.ir('mapa'); }
        else if (acao === 'status') mudarStatus(v, b.dataset.status);
        else if (acao === 'excluir') excluir(v);
      }));
    }

    const CLASSE_STATUS = { aberta: 'badge-amarelo', divulgada: 'badge-azul', selecao: 'badge-roxo', preenchida: 'badge-verde', cancelada: 'badge-cinza' };
    function cardVaga(v) {
      const c = v.cidade;
      const reg = c ? Store.distritoDaCidade(c.id) : null;
      const fechada = v.status === 'preenchida' || v.status === 'cancelada';
      const canais = Store.CANAIS.filter(k => v.divulgacao && v.divulgacao[k.id]).map(k => k.nome);
      const prazo = v.prazo ? new Date(v.prazo + 'T12:00:00') : null;
      const atrasada = prazo && !fechada && prazo < new Date();
      return `<div class="card vaga-card ${fechada ? 'inativo' : ''}" data-id="${v.id}">
        <div class="linha entre" style="align-items:flex-start">
          <div>
            <h3>${UI.esc(v.titulo)}</h3>
            <div class="muted small">${UI.esc(v.projeto ? Store.rotuloProjeto(v.projeto) : '—')}</div>
          </div>
          <span class="badge ${CLASSE_STATUS[v.status] || 'badge-cinza'}">${UI.esc(Store.STATUS_VAGA[v.status] || v.status)}</span>
        </div>
        <div class="vaga-dados">
          <div><span class="muted">Trabalha em</span><b>${c ? UI.esc(c.nome + '/' + c.uf) : '—'}</b>${v.unidade ? `<span class="muted small">${UI.esc(v.unidade)}</span>` : ''}</div>
          <div><span class="muted">Região</span><b>${reg ? UI.esc(reg.micro.nome) : '<span class="muted">fora das micros</span>'}</b>${reg ? `<span class="muted small">${UI.esc(reg.distrito.nome)}</span>` : ''}</div>
          <div><span class="muted">Tipo</span>${UI.badgeTipo(v.tipo)}</div>
          <div><span class="muted">Posições</span><b>${v.admitidos} / ${v.quantidade}</b><span class="muted small">${v.faltam ? v.faltam + ' em aberto' : 'completa'}</span></div>
        </div>
        <div class="vaga-rodape small">
          <span>${v.candidatos ? `<b>${v.candidatos}</b> candidato(s), <b>${v.emProcesso}</b> em processo` : '<span class="muted">sem candidatos</span>'}</span>
          <span>${canais.length ? `divulgada em <b>${canais.length}</b> canal(is)` : '<span class="erro">não divulgada</span>'}</span>
          ${prazo ? `<span class="${atrasada ? 'erro' : 'muted'}">prazo ${prazo.toLocaleDateString('pt-BR')}${atrasada ? ' (vencido)' : ''}</span>` : ''}
        </div>
        <div class="linha nao-imprimir" style="margin-top:auto">
          ${podeEditar && !fechada ? '<button class="btn btn-pequeno btn-primario" data-acao="divulgar">Divulgar</button>' : ''}
          <button class="btn btn-pequeno" data-acao="candidatos">Candidatos</button>
          ${!fechada ? '<button class="btn btn-pequeno" data-acao="procurar" title="Bancos de currículos e buscas já filtradas pela cidade da vaga">Procurar candidatos</button>' : ''}
          <button class="btn btn-pequeno" data-acao="mapa" title="Abre o mapa na cidade da vaga">Mapa</button>
          ${podeEditar ? `<button class="btn btn-pequeno" data-acao="editar">Editar</button>` : ''}
          ${podeEditar && !fechada ? `<button class="btn btn-pequeno" data-acao="status" data-status="cancelada" title="Cancelar a vaga">Cancelar</button>` : ''}
          ${podeEditar && fechada ? `<button class="btn btn-pequeno" data-acao="status" data-status="aberta">Reabrir</button>` : ''}
          ${App.usuario.perfil === 'admin' ? `<button class="btn btn-pequeno btn-perigo" data-acao="excluir">Excluir</button>` : ''}
        </div>
      </div>`;
    }

    async function mudarStatus(v, status) {
      if (status === 'cancelada' && !await UI.confirmar(`Cancelar a vaga "${v.titulo}"? Os candidatos ficam guardados.`, { textoOk: 'Cancelar vaga', perigo: true })) return;
      try { Store.mudarStatusVaga(v.id, status, App.usuario); UI.toast('Vaga atualizada.', 'sucesso'); App.recarregar(); } catch (e) { UI.toast(e.message, 'erro'); }
    }
    async function excluir(v) {
      if (!await UI.confirmar(`Excluir a vaga "${v.titulo}" e os ${v.candidatos} candidato(s) dela? As contratações já feitas continuam no mapa.`, { textoOk: 'Excluir', perigo: true })) return;
      Store.excluirVaga(v.id, App.usuario); UI.toast('Vaga excluída.', 'sucesso'); App.recarregar();
    }

    // ---------- formulário ----------
    function formVaga(v) {
      const projetos = App.projetosVisiveis().filter(p => p.ativo || (v && v.projetoId === p.id));
      if (!projetos.length) { UI.toast('Crie primeiro um projeto (estado/ano) em Cadastros → Projetos.', 'aviso'); return; }
      const projetoIni = v ? v.projetoId : (App.filtros.projetoId || projetos[0].id);
      const corpo = `
        <div class="form-linha">
          <label style="grid-column:1/-1">Cargo / título da vaga<input id="v-titulo" placeholder="Ex.: Operador de secador, Auxiliar de armazém" value="${UI.esc(v ? v.titulo : '')}"></label>
          <label>Projeto (estado · ano)<select id="v-projeto">${projetos.map(p => `<option value="${p.id}" ${p.id === projetoIni ? 'selected' : ''}>${UI.esc(Store.rotuloProjeto(p))}</option>`).join('')}</select></label>
          <label>Quantidade de vagas<input id="v-qtd" type="number" min="1" value="${v ? v.quantidade : 1}"></label>
          <label>Cidade onde vai trabalhar<input id="v-cidade" placeholder="Digite e escolha" value="${UI.esc(v && v.cidade ? v.cidade.nome : '')}" data-cidade-id="${v ? v.cidadeId : ''}"><span class="muted small" id="v-regiao"></span></label>
          <label>Unidade / PDR (opcional)<input id="v-unidade" list="v-unidades" placeholder="Nome da unidade" value="${UI.esc(v ? v.unidade : '')}"><datalist id="v-unidades"></datalist></label>
          <div style="grid-column:1/-1">
            <label style="margin-bottom:6px">Tipo de contratação</label>
            <div class="opcoes-tipo">
              <label class="opcao ${!v || v.tipo === 'LOCAL' ? 'marcada' : ''}"><input type="radio" name="v-tipo" value="LOCAL" ${!v || v.tipo === 'LOCAL' ? 'checked' : ''}><b>Local</b><span>A pessoa trabalha fixo nessa cidade</span></label>
              <label class="opcao ${v && v.tipo === 'MOVEL' ? 'marcada' : ''}"><input type="radio" name="v-tipo" value="MOVEL" ${v && v.tipo === 'MOVEL' ? 'checked' : ''}><b>Móvel</b><span>Base nessa cidade, mas se desloca pela região</span></label>
            </div>
          </div>
          <label style="grid-column:1/-1">Atividades<textarea id="v-descricao" rows="3" placeholder="O que a pessoa vai fazer">${UI.esc(v ? v.descricao : '')}</textarea></label>
          <label style="grid-column:1/-1">Requisitos<textarea id="v-requisitos" rows="2" placeholder="Escolaridade, experiência, CNH, disponibilidade…">${UI.esc(v ? v.requisitos : '')}</textarea></label>
          <label>Salário<input id="v-salario" placeholder="Ex.: R$ 2.400 + horas extras" value="${UI.esc(v ? v.salario : '')}"></label>
          <label>Jornada<input id="v-jornada" placeholder="Ex.: 44h semanais, escala 6x1" value="${UI.esc(v ? v.jornada : '')}"></label>
          <label style="grid-column:1/-1">Benefícios<input id="v-beneficios" placeholder="Ex.: vale-alimentação, transporte, plano de saúde" value="${UI.esc(v ? v.beneficios : '')}"></label>
          <label>Contato para candidatura<input id="v-contato" placeholder="WhatsApp, e-mail ou endereço" value="${UI.esc(v ? v.contato : '')}"></label>
          <label>Prazo de inscrição<input id="v-prazo" type="date" value="${UI.esc(v && v.prazo ? v.prazo : '')}"></label>
          ${v ? `<label>Status<select id="v-status">${Object.entries(Store.STATUS_VAGA).map(([k, r]) => `<option value="${k}" ${v.status === k ? 'selected' : ''}>${r}</option>`).join('')}</select></label>` : ''}
        </div>`;
      const m = UI.modal({
        titulo: v ? 'Editar vaga' : 'Nova vaga', largura: '720px', corpo,
        botoes: [{ texto: 'Cancelar' }, { texto: v ? 'Salvar' : 'Criar vaga', classe: 'btn-primario', acao: (md) => {
          const q = s => md.corpo.querySelector(s);
          const cidEl = q('#v-cidade');
          if (!cidEl.dataset.cidadeId) {
            const c = Store.resolverCidade(cidEl.value, ufAtual());
            if (c) cidEl.dataset.cidadeId = c.id; else throw new Error('Escolha a cidade na lista (digite o nome e clique na sugestão).');
          }
          Store.salvarVaga({ id: v ? v.id : null, titulo: q('#v-titulo').value, projetoId: q('#v-projeto').value, quantidade: q('#v-qtd').value,
            cidadeId: cidEl.dataset.cidadeId, unidade: q('#v-unidade').value, tipo: (md.corpo.querySelector('input[name="v-tipo"]:checked') || {}).value,
            descricao: q('#v-descricao').value, requisitos: q('#v-requisitos').value, salario: q('#v-salario').value, jornada: q('#v-jornada').value,
            beneficios: q('#v-beneficios').value, contato: q('#v-contato').value, prazo: q('#v-prazo').value, status: v ? q('#v-status').value : 'aberta' }, App.usuario);
          UI.toast(v ? 'Vaga salva.' : 'Vaga criada. Agora clique em Divulgar.', 'sucesso');
          App.recarregar();
        } }]
      });
      const q = s => m.corpo.querySelector(s);
      const ufAtual = () => Store.ufsProjeto(Store.projeto(q('#v-projeto').value));
      const cidEl = q('#v-cidade');
      function mostrarRegiao() {
        const id = cidEl.dataset.cidadeId;
        const reg = id ? Store.distritoDaCidade(id) : null;
        q('#v-regiao').textContent = !id ? '' : reg ? `${reg.micro.nome} · distrito ${reg.distrito.nome}` : 'Cidade fora das microrregiões cadastradas';
        // unidades PDR da cidade viram sugestão
        const dl = q('#v-unidades');
        dl.innerHTML = !id ? '' : Store.todosSilosPdr().filter(s => { const c = Store.cidadeDoSilo(s, ufAtual()); return c && c.id === id; })
          .map(s => `<option value="${UI.esc(s.nome || '')}">`).join('');
      }
      UI.autocompleteCidade(cidEl, { uf: ufAtual, aoSelecionar: mostrarRegiao,
        aoGeocodificar: async (t, u) => { try { const c = await Geo.geocodificarESalvar(t, u); cidEl.value = c.nome; cidEl.dataset.cidadeId = c.id; mostrarRegiao(); } catch (e) { UI.toast(e.message, 'erro'); } } });
      cidEl.addEventListener('input', () => { if (!cidEl.dataset.cidadeId) q('#v-regiao').textContent = ''; });
      m.corpo.querySelectorAll('input[name="v-tipo"]').forEach(r => r.addEventListener('change', () => {
        m.corpo.querySelectorAll('.opcao').forEach(o => o.classList.toggle('marcada', o.querySelector('input').checked));
      }));
      mostrarRegiao();
      setTimeout(() => q('#v-titulo').focus(), 60);
    }

    // ---------- divulgação ----------
    async function modalDivulgar(v) {
      if (v.cidade && Store.BASES_SINE.includes(v.cidade.uf)) await Store.carregarBaseSine(v.cidade.uf);
      const texto = Store.textoAnuncio(v);
      const c = v.cidade;
      const sines = c ? Store.sineDaCidade(c) : [];
      const prox = !sines.length && c ? Store.sineMaisProximo(c) : null;
      const info = c ? Store.infoCidade(c.id) : null;
      const enc = encodeURIComponent;
      const nomeCidade = c ? `${c.nome} ${c.uf}` : '';
      const grupos = [...new Set(Store.CANAIS.map(k => k.grupo))];
      const botoesCanal = k => {
        const abrir = (url, rot) => `<a class="btn btn-pequeno" href="${url}" target="_blank" rel="noopener">${rot}</a>`;
        if (k.id === 'whatsapp') return abrir('https://wa.me/?text=' + enc(texto), 'Abrir WhatsApp com o texto');
        if (k.id === 'linkedin') return abrir('https://www.linkedin.com/feed/?shareActive=true&text=' + enc(texto), 'Publicar no feed') + abrir(k.url, 'Anunciar vaga');
        if (k.id === 'radio') return abrir('https://www.google.com/search?q=' + enc('rádio ' + nomeCidade + ' telefone'), 'Achar a rádio no Google');
        if (k.id === 'prefeitura') return abrir('https://www.google.com/search?q=' + enc('prefeitura ' + nomeCidade + ' assistência social telefone'), 'Achar a prefeitura no Google');
        if (k.id === 'sine') {
          const a = sines[0] || (prox && prox.agencia);
          let extra = '';
          if (a) {
            const tel = (info && info.sineTelefone) || (a.telefones || []).join(' / ');
            extra = `<div class="small muted" style="margin-top:4px">Agência ${UI.esc(a.nome)}${prox ? ` (a ${UI.fmtKm(prox.distancia)}, a mais próxima)` : ''}${tel ? ' · ' + UI.esc(tel) : ''}${a.email ? ` · <a href="mailto:${UI.esc(a.email)}?subject=${enc('Vaga: ' + v.titulo)}&body=${enc(texto)}">enviar por e-mail</a>` : ''}</div>`;
          }
          const portal = c ? Store.portalSine(c.uf) : null;
          if (!a && c) extra = `<div class="small muted" style="margin-top:4px">Sem agência na base para ${UI.esc(c.nome)}: abra a ficha da cidade no mapa (botão Mapa) — o sistema busca a agência na internet e salva.</div>`;
          return abrir(k.url, 'Abrir Emprega Brasil') + (portal ? abrir(portal.url, portal.nome) : '') + extra;
        }
        if (k.id === 'cartaz') return `<button class="btn btn-pequeno" data-imprimir>Imprimir cartaz</button>`;
        return k.url ? abrir(k.url, 'Abrir ' + k.nome) : '';
      };
      const corpo = `
        <div class="divulgar">
          <div>
            <label>Texto do anúncio (edite à vontade antes de copiar)<textarea id="d-texto" rows="14">${UI.esc(texto)}</textarea></label>
            <div class="linha"><button class="btn btn-primario" id="d-copiar">Copiar texto</button>
              <a class="btn" href="mailto:?subject=${enc('Vaga: ' + v.titulo)}&body=${enc(texto)}">Enviar por e-mail</a>
              <button class="btn" data-imprimir>Imprimir cartaz</button></div>
            ${info && (info.canais || info.contatos) ? `<div class="caixa caixa-aviso"><b>Anotações do RH sobre ${UI.esc(c.nome)}:</b><br>${UI.esc([info.canais, info.contatos].filter(Boolean).join(' · '))}</div>` : ''}
          </div>
          <div>
            <p class="muted small" style="margin-bottom:8px">Marque onde já divulgou. A vaga passa para <b>Em divulgação</b> na primeira marcação.</p>
            ${grupos.map(g => `<div class="etiqueta-grupo">${UI.esc(g)}</div>` + Store.CANAIS.filter(k => k.grupo === g).map(k => {
              const feito = v.divulgacao && v.divulgacao[k.id];
              return `<div class="canal ${feito ? 'feito' : ''}" data-canal="${k.id}">
                <label class="check"><input type="checkbox" ${feito ? 'checked' : ''}> <b>${UI.esc(k.nome)}</b>${feito ? `<span class="muted small"> · ${UI.fmtData(feito.em)}</span>` : ''}</label>
                <div class="small muted">${UI.esc(k.dica)}</div>
                <div class="linha" style="margin-top:6px;gap:6px">${botoesCanal(k)}</div>
              </div>`;
            }).join('')).join('')}
          </div>
        </div>`;
      const m = UI.modal({ titulo: `Divulgar: ${v.titulo} — ${c ? c.nome : ''}`, largura: '960px', corpo, botoes: [{ texto: 'Fechar' }], aoFechar: () => App.recarregar() });
      const ta = m.corpo.querySelector('#d-texto');
      m.corpo.querySelector('#d-copiar').addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(ta.value); UI.toast('Texto copiado. Cole na plataforma.', 'sucesso'); }
        catch (e) { ta.select(); document.execCommand('copy'); UI.toast('Texto copiado.', 'sucesso'); }
      });
      m.corpo.querySelectorAll('[data-imprimir]').forEach(b => b.addEventListener('click', () => imprimirCartaz(v, ta.value)));
      m.corpo.querySelectorAll('.canal input[type="checkbox"]').forEach(ch => ch.addEventListener('change', () => {
        const canal = ch.closest('.canal');
        try { Store.marcarDivulgacao(v.id, canal.dataset.canal, ch.checked, App.usuario); canal.classList.toggle('feito', ch.checked); }
        catch (e) { UI.toast(e.message, 'erro'); ch.checked = !ch.checked; }
      }));
    }
    function imprimirCartaz(v, texto) {
      const w = window.open('', '_blank');
      if (!w) { UI.toast('O navegador bloqueou a janela de impressão.', 'erro'); return; }
      w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${UI.esc(v.titulo)}</title>
        <style>body{font-family:Arial,sans-serif;margin:40px;color:#111}h1{font-size:40px;margin:0 0 6px;text-transform:uppercase}h2{font-size:22px;color:#1d4ed8;margin:0 0 24px}pre{white-space:pre-wrap;font:20px/1.5 Arial,sans-serif}</style></head>
        <body><h1>Estamos contratando</h1><h2>${UI.esc(v.titulo)} — ${UI.esc(v.cidade ? v.cidade.nome + '/' + v.cidade.uf : '')}</h2><pre>${UI.esc(texto)}</pre><script>window.print()<\/script></body></html>`);
      w.document.close();
    }

    render();
  }
};
