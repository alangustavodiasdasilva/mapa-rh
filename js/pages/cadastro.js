// Contratações: quem foi admitido pelo RH em Candidatos (pessoa, cargo, onde trabalha, chegada).
// A contratação nasce da admissão; para mudar ou desfazer, é em Candidatos. Os números do Mapa e dos Relatórios vêm daqui.
Paginas.cadastro = {
  titulo: 'Contratações',
  filtrosUsados: ['regiao', 'tipo', 'uf'],
  render(el) {
    const projetos = App.projetosVisiveis();
    if (!projetos.length) {
      el.innerHTML = `<div class="card"><h2>Nenhum projeto disponível</h2><p>Crie um projeto (um estado, com ano opcional) antes de contratar.</p><button class="btn btn-primario" id="ir-projetos">Ir para Projetos</button></div>`;
      el.querySelector('#ir-projetos').addEventListener('click', () => App.ir('projetos'));
      return;
    }
    let projetoId = App.filtros.projetoId && projetos.some(p => p.id === App.filtros.projetoId) ? App.filtros.projetoId : projetos[0].id;
    let busca = '', pessoas = null, erro = '', limite = 100;

    el.innerHTML = `
      <div class="card sem-padding">
        <div class="cad-barra">
          <label class="cad-proj">Projeto<select id="cad-projeto"></select></label>
          <span class="espaco"></span>
          <input class="busca nao-imprimir" id="cad-busca" placeholder="Procurar por nome, CPF, cargo ou cidade…">
          <button class="btn nao-imprimir" id="btn-exportar">Exportar planilha</button>
        </div>
        <div class="ct-resumo" id="ct-resumo"></div>
        <div id="ct-corpo"><div class="vazio">Carregando…</div></div>
      </div>`;

    const q = s => el.querySelector(s);
    q('#cad-projeto').innerHTML = projetos.map(p => `<option value="${p.id}" ${p.id === projetoId ? 'selected' : ''}>${UI.esc(Store.rotuloProjeto(p))}${p.ativo ? '' : ' (inativo)'}</option>`).join('');
    q('#cad-projeto').addEventListener('change', e => {
      projetoId = e.target.value;
      App.filtros.projetoId = projetoId; try { localStorage.setItem('maparh:filtros', JSON.stringify(App.filtros)); } catch (er) { /* ok */ }
      App.atualizarFiltroProjetos(); App.atualizarFiltroDistrito(); App.atualizarFiltroUF();
      carregar();
    });
    q('#cad-busca').addEventListener('input', UI.debounce(e => { busca = e.target.value; limite = 100; desenhar(); }, 150));
    q('#btn-exportar').addEventListener('click', exportar);

    const nomeCidade = id => { const c = id && Store.cidade(id); return c ? `${c.nome}/${c.uf}` : ''; };
    const nomeRh = p => { const u = p.analista_login && Store.usuarioPorLogin(p.analista_login); return u ? u.nome : (p.analista || ''); };
    const ondeTrabalha = p => { const d = p.distrito_id && Store.distrito(p.distrito_id); const c = nomeCidade(p.cidade_atuacao_id); return [d ? d.nome : '', c].filter(Boolean).join(' · '); };
    const dia = d => d ? RH.fmtDataBR(String(d).slice(0, 10)) : '';

    async function carregar() {
      pessoas = null; erro = ''; desenhar();
      if (typeof Nuvem === 'undefined' || !Nuvem.ativa) { erro = 'As contratações vêm do banco central. Entre com seu usuário para ver.'; return desenhar(); }
      try { pessoas = (await Nuvem.rh.listar(projetoId)).filter(p => p.situacao === 'admitido'); }
      catch (e) { erro = e.message || 'Não foi possível carregar.'; }
      desenhar();
    }

    function filtradas() {
      const f = App.filtros, b = Store.normalizar(busca);
      return (pessoas || []).filter(p => {
        if (f.tipo && p.tipo !== f.tipo) return false;
        if (f.distritoId && p.distrito_id !== f.distritoId) return false;
        if (!b) return true;
        const pe = p.pessoa || {};
        return Store.normalizar([pe.nome, pe.cpf, RH.soDigitos(pe.cpf), p.cargo, nomeCidade(pe.cidade_origem_id), ondeTrabalha(p), nomeRh(p)].join(' ')).includes(b);
      }).sort((a, b2) => String(b2.admitido_em || '').localeCompare(String(a.admitido_em || '')) || a.pessoa.nome.localeCompare(b2.pessoa.nome, 'pt-BR'));
    }

    function desenhar() {
      const corpo = q('#ct-corpo'), resumo = q('#ct-resumo');
      if (erro) { resumo.innerHTML = ''; corpo.innerHTML = `<div class="vazio">${UI.esc(erro)} <button class="btn btn-pequeno" id="ct-tentar">Tentar de novo</button></div>`; q('#ct-tentar').addEventListener('click', carregar); return; }
      if (!pessoas) { resumo.innerHTML = ''; corpo.innerHTML = '<div class="vazio">Carregando…</div>'; return; }
      const l = filtradas(), local = l.filter(p => p.tipo !== 'MOVEL').length;
      const hoje = RH.hoje(), seg = RH.segundaDaSemana(hoje), fim = (() => { const d = new Date(seg + 'T12:00:00'); d.setDate(d.getDate() + 6); return d.toISOString().slice(0, 10); })();
      const chegam = l.filter(p => p.chegada_data && p.chegada_data >= seg && p.chegada_data <= fim).length;
      resumo.innerHTML = pessoas.length ? `
        <div><b>${UI.fmtNum(l.length)}</b>${l.length === 1 ? 'pessoa contratada' : 'pessoas contratadas'}</div>
        <div><b>${UI.fmtNum(local)}</b>local</div>
        <div><b>${UI.fmtNum(l.length - local)}</b>móvel</div>
        <div><b>${UI.fmtNum(chegam)}</b>chega${chegam === 1 ? '' : 'm'} esta semana</div>` : '';
      if (!pessoas.length) {
        corpo.innerHTML = `<div class="vazio ct-vazio"><b>Ninguém contratado neste projeto ainda.</b><br>Quando o RH admite um candidato em <a href="#/candidatos">Candidatos</a>, a pessoa aparece aqui, no Mapa e nos Relatórios.</div>`;
        return;
      }
      if (!l.length) { corpo.innerHTML = `<div class="vazio">Ninguém com essa busca${App.filtros.tipo || App.filtros.distritoId ? ' ou com os filtros do topo' : ''}.</div>`; return; }
      const vis = l.slice(0, limite);
      corpo.innerHTML = `<div class="ct-lista">
        <div class="ct-linha ct-cab"><span>Pessoa</span><span>Cargo</span><span>De onde vem → onde trabalha</span><span>Admitido em</span><span>Chegada</span><span>RH</span><span></span></div>
        ${vis.map(p => {
          const pe = p.pessoa || {}, origem = nomeCidade(pe.cidade_origem_id), onde = ondeTrabalha(p);
          return `<div class="ct-linha" data-id="${p.id}">
            <span class="ct-pessoa"><b>${UI.esc(pe.nome)}</b><small>${pe.cpf ? RH.fmtCPF(pe.cpf) : 'sem CPF'}${pe.telefone ? ' · ' + UI.esc(pe.telefone) : ''}</small></span>
            <span data-rot="Cargo">${UI.esc(p.cargo || '—')}</span>
            <span data-rot="Onde">${UI.badgeTipo(p.tipo || 'LOCAL')} ${origem ? UI.esc(origem) : '<span class="muted">origem?</span>'} <span class="muted">→</span> ${onde ? UI.esc(onde) : '<span class="muted">—</span>'}${p.distancia_km != null && +p.distancia_km > 0 ? ` <span class="muted small">(${UI.fmtKm(+p.distancia_km)})</span>` : ''}</span>
            <span data-rot="Admitido em">${dia(p.admitido_em) || '—'}</span>
            <span data-rot="Chegada">${p.chegada_data ? dia(p.chegada_data) + (p.chegada_hora ? ` <span class="muted">${String(p.chegada_hora).slice(0, 5)}</span>` : '') : '<span class="muted">—</span>'}</span>
            <span data-rot="RH">${UI.esc(nomeRh(p).split(' ')[0] || '—')}</span>
            <span class="ct-acao nao-imprimir"><button class="btn-link" data-abrir="${p.id}" title="Abre em Candidatos (para mudar ou desfazer a admissão)">Abrir</button></span>
          </div>`;
        }).join('')}
      </div>
      ${l.length > limite ? `<div class="vazio"><button class="btn" id="ct-mais">Mostrar mais ${Math.min(100, l.length - limite)}</button></div>` : ''}`;
      const mais = q('#ct-mais'); if (mais) mais.addEventListener('click', () => { limite += 100; desenhar(); });
    }
    q('#ct-corpo').addEventListener('click', e => {
      const b = e.target.closest('[data-abrir]'); if (!b) return;
      const p = (pessoas || []).find(x => x.id === b.dataset.abrir); if (!p) return;
      try { sessionStorage.setItem('maparh:cand-seg', 'admitido'); sessionStorage.setItem('maparh:cand-busca', p.pessoa.nome); localStorage.setItem('maparh:cand-projeto', projetoId); } catch (er) { /* ok */ }
      App.ir('candidatos');
    });

    function exportar() {
      const l = filtradas(); if (!l.length) { UI.toast('Nada para exportar.', 'aviso'); return; }
      const p = Store.projeto(projetoId);
      const linhas = [['NOME', 'CPF', 'TELEFONE', 'CARGO', 'MOVEL/LOCAL', 'CIDADE DE ORIGEM', 'DISTRITO', 'CIDADE DE ATUAÇÃO', 'DISTANCIA KM', 'ADMITIDO EM', 'CHEGADA', 'HORA CHEGADA', 'RH']];
      l.forEach(x => { const pe = x.pessoa || {}, d = x.distrito_id && Store.distrito(x.distrito_id);
        linhas.push([pe.nome, pe.cpf ? RH.fmtCPF(pe.cpf) : '', pe.telefone || '', x.cargo || '', x.tipo === 'MOVEL' ? 'MÓVEL' : 'LOCAL', nomeCidade(pe.cidade_origem_id), d ? d.nome : '', nomeCidade(x.cidade_atuacao_id),
          x.distancia_km == null ? '' : Math.round(+x.distancia_km), dia(x.admitido_em), dia(x.chegada_data), x.chegada_hora ? String(x.chegada_hora).slice(0, 5) : '', nomeRh(x)]); });
      UI.baixarCSV(`contratacoes-${Store.normalizar(p.nome).replace(/ /g, '-')}.csv`, linhas);
    }

    carregar();
  }
};
