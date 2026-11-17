// Colaboradores: quem está (ou já esteve) na empresa em cada projeto. Uma linha por passagem da pessoa (vínculo).
// A admissão vem de Candidatos (etapa Documentação → Admitir); aqui se acompanha transferência, mudança de cargo ou de gestor e o desligamento.
// Os dados ficam em tabelas próprias do banco (maparh_vinculos / maparh_vinculo_eventos / maparh_desligamentos),
// fora da cópia local do navegador, e só aparecem para administrador ou para quem o administrador liberou.
// Toda gravação passa pelas funções do banco (Nuvem.colab), que guardam o histórico com a data de vigência.
Paginas.colaboradores = {
  titulo: 'Colaboradores',
  semFiltros: true,
  render(el) {
    const projetos = App.projetosVisiveis();
    if (!projetos.length) {
      el.innerHTML = '<div class="card"><h2>Nenhum projeto disponível</h2><p>Crie um projeto em Cadastros → Projetos antes de acompanhar colaboradores.</p></div>';
      return;
    }
    if (!App.nuvem()) {
      el.innerHTML = '<div class="card"><h2>Colaboradores precisa do banco central</h2><p>Esta tela guarda dados pessoais e só funciona com o sistema conectado ao banco.</p></div>';
      return;
    }
    const TIPO_DESL = { pedido: 'Pedido de demissão', sem_justa_causa: 'Dispensa sem justa causa', justa_causa: 'Dispensa por justa causa', termino_contrato: 'Término de contrato', acordo: 'Acordo entre as partes', outro: 'Outro' };
    const MOTIVOS = ['Melhor proposta de trabalho', 'Salário ou benefícios', 'Mudança de cidade', 'Motivo pessoal ou familiar', 'Saúde', 'Não se adaptou ao trabalho', 'Desempenho', 'Conduta ou faltas', 'Fim da safra ou do contrato', 'Redução de quadro', 'Outro'];
    const REPOSICAO = { nao_iniciada: 'Reposição não iniciada', em_andamento: 'Reposição em andamento', reposta: 'Vaga reposta', nao_vai_repor: 'Não vai repor' };
    const EVENTO = { admissao: 'Admissão', transferencia: 'Transferência', cargo: 'Mudança de cargo', gestor: 'Mudança de gestor', afastamento: 'Afastamento', retorno: 'Retorno', desligamento: 'Desligamento' };
    const CAMPO = { cargo: 'Cargo', tipo_vinculo: 'Tipo de vínculo', unidade: 'Unidade', cidade_atuacao_id: 'Cidade de trabalho', tipo: 'Tipo', gestor: 'Gestor' };
    const podeEditar = App.podeEditar();
    const salvo = localStorage.getItem('maparh:colab-projeto');
    let projetoId = projetos.some(p => p.id === salvo) ? salvo : (projetos.some(p => p.id === App.filtros.projetoId) ? App.filtros.projetoId : projetos[0].id);
    let linhas = [], situacao = 'ativos', cargo = '', unidade = '', busca = '', ativo = true, pedido = 0, carregou = false;
    const projeto = () => Store.projeto(projetoId);
    const cidade = id => id ? Store.cidade(id) : null;
    const nomeCidade = id => { const c = cidade(id); return c ? `${c.nome}/${c.uf}` : ''; };
    const esc = UI.esc, v2 = x => esc(x == null ? '' : x);
    const plural = (n, um, varios) => `${UI.fmtNum(n)} ${n === 1 ? um : varios}`;
    const opcoes = (mapa, sel) => Object.entries(mapa).map(([k, r]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${r}</option>`).join('');
    const estaAtivo = v => !v.desligamento;
    const tempo = (v, hoje) => Colab.tempoDeCasa(v.admissao, v.desligamento || hoje);
    const nomeMes = mes => { const n = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']; return `${n[+mes.slice(5, 7) - 1]} de ${mes.slice(0, 4)}`; };

    el.innerHTML = `
      <div class="card sem-padding">
        <div class="cad-barra">
          <label class="cad-proj">Projeto<select id="col-projeto">${projetos.map(p => `<option value="${p.id}" ${p.id === projetoId ? 'selected' : ''}>${esc(Store.rotuloProjeto(p))}</option>`).join('')}</select></label>
          <label class="cad-proj">Situação<select id="col-situacao" class="col-filtro">
            <option value="ativos">Ativos</option><option value="desligados">Desligados</option><option value="todos">Todos</option></select></label>
          <label class="cad-proj">Cargo<select id="col-cargo" class="col-filtro"></select></label>
          <label class="cad-proj">Unidade<select id="col-unidade" class="col-filtro"></select></label>
          <span class="espaco"></span>
          <div class="linha nao-imprimir">
            <button class="btn" id="col-indicadores">Ver indicadores por mês</button>
            <button class="btn" id="col-exportar">Exportar CSV</button>
          </div>
        </div>
        <div class="pre-resumo" id="col-resumo"></div>
        <div class="cad-lista-cab">
          <b id="col-titulo">Colaboradores</b>
          <input class="busca nao-imprimir" id="col-busca" placeholder="Procurar por nome, CPF, cargo, unidade ou cidade…">
        </div>
        <div class="tabela-wrap" id="col-tabela"><div class="vazio">Carregando…</div></div>
      </div>`;
    const q = s => el.querySelector(s);

    async function carregar() {
      const meu = ++pedido;
      try {
        const l = await Nuvem.colab.listar(projetoId);
        if (!ativo || meu !== pedido) return;
        linhas = l; carregou = true; desenhar();
      } catch (e) {
        if (!ativo || meu !== pedido) return;
        linhas = []; carregou = false; q('#col-resumo').innerHTML = ''; q('#col-titulo').textContent = 'Colaboradores';
        q('#col-tabela').innerHTML = `<div class="vazio erro">Não foi possível carregar: ${esc(e.message)} <button class="btn-link" id="col-tentar">Tentar de novo</button></div>`;
        q('#col-tentar').addEventListener('click', () => { q('#col-tabela').innerHTML = '<div class="vazio">Carregando…</div>'; carregar(); });
      }
    }
    function filtradas() {
      let l = linhas;
      if (situacao === 'ativos') l = l.filter(estaAtivo); else if (situacao === 'desligados') l = l.filter(v => !estaAtivo(v));
      if (cargo === '(sem)') l = l.filter(v => !v.cargo); else if (cargo) l = l.filter(v => Store.normalizar(v.cargo) === cargo);
      if (unidade === '(sem)') l = l.filter(v => !v.unidade); else if (unidade) l = l.filter(v => Store.normalizar(v.unidade) === unidade);
      if (busca) {
        const b = Store.normalizar(busca), bd = RH.soDigitos(busca);
        l = l.filter(v => Store.normalizar([v.pessoa.nome, v.cargo, v.unidade, v.gestor, nomeCidade(v.cidade_atuacao_id)].join(' ')).includes(b) || (bd.length >= 3 && String(v.pessoa.cpf || '').includes(bd)));
      }
      return l;
    }
    // preenche um filtro (cargo ou unidade) com o que existe no projeto; devolve o valor que continua válido
    function desenharFiltro(sel, campo, atual, todos, semRotulo) {
      const cont = new Map(); let sem = 0;
      for (const v of linhas) { if (!v[campo]) { sem++; continue; } const k = Store.normalizar(v[campo]); const a = cont.get(k) || { nome: v[campo], n: 0 }; a.n++; cont.set(k, a); }
      if (atual && atual !== '(sem)' && !cont.has(atual)) atual = '';
      if (atual === '(sem)' && !sem) atual = '';
      q(sel).innerHTML = `<option value="">${todos}</option>` +
        [...cont.entries()].sort((a, b) => a[1].nome.localeCompare(b[1].nome, 'pt-BR')).map(([k, a]) => `<option value="${esc(k)}" ${k === atual ? 'selected' : ''}>${esc(a.nome)} (${a.n})</option>`).join('') +
        (sem ? `<option value="(sem)" ${atual === '(sem)' ? 'selected' : ''}>${semRotulo} (${sem})</option>` : '');
      return atual;
    }
    function desenharResumo(hoje) {
      // tudo aqui sai dos vínculos carregados do projeto; sem vínculo nenhum, não há número para mostrar
      if (!linhas.length) { q('#col-resumo').innerHTML = ''; return; }
      const mes = Colab.turnoverMensal(linhas, hoje.slice(0, 7), hoje);
      const item = (n, rotulo, dica) => `<span${dica ? ` title="${esc(dica)}"` : ''}><b>${n}</b> ${rotulo}</span>`;
      q('#col-resumo').innerHTML = item(UI.fmtNum(Colab.headcount(linhas, hoje)), Colab.headcount(linhas, hoje) === 1 ? 'ativo hoje' : 'ativos hoje') +
        item(UI.fmtNum(mes.admissoes), `${mes.admissoes === 1 ? 'admissão' : 'admissões'} em ${nomeMes(hoje)}`) +
        item(UI.fmtNum(mes.desligamentos), `${mes.desligamentos === 1 ? 'desligamento' : 'desligamentos'} em ${nomeMes(hoje)}`) +
        (mes.turnover == null ? '' : item(UI.fmtPct(mes.turnover), 'de turnover no mês, até hoje',
          `${plural(mes.desligamentos, 'desligamento', 'desligamentos')} ÷ quadro médio de ${mes.medio.toLocaleString('pt-BR')} (${mes.headcountInicio} no dia 1º e ${mes.headcountFim} hoje) × 100`));
    }
    function desenhar() {
      const hoje = Colab.hoje();
      cargo = desenharFiltro('#col-cargo', 'cargo', cargo, 'Todos', 'Sem cargo');
      unidade = desenharFiltro('#col-unidade', 'unidade', unidade, 'Todas', 'Sem unidade');
      desenharResumo(hoje);
      const lista = filtradas();
      q('#col-titulo').innerHTML = `Colaboradores <span class="aba-num">${UI.fmtNum(lista.length)}</span>`;
      if (!lista.length) {
        q('#col-tabela').innerHTML = `<div class="vazio">${linhas.length ? 'Ninguém neste filtro.' : 'Ainda não há colaboradores neste projeto. Eles aparecem aqui quando a pessoa é admitida em <b>Candidatos</b>.'}</div>`;
        return;
      }
      q('#col-tabela').innerHTML = `<table class="tabela col-tabela"><thead><tr>
        <th>Pessoa</th><th>Cargo e unidade</th><th>Onde trabalha</th><th>Admissão</th><th>Tempo de casa</th><th>Situação</th><th class="acoes-col"></th></tr></thead><tbody>` +
        lista.map(v => {
          const pe = v.pessoa, tel = RH.soDigitos(pe.telefone), d = v.desligamento_reg, futuro = v.admissao > hoje;
          const sit = estaAtivo(v)
            ? (futuro ? '<span class="badge badge-azul">Admissão futura</span>' : '<span class="badge badge-verde">Ativo</span>')
            : `<span class="badge badge-cinza">Desligado</span><div class="muted small">em ${RH.fmtDataBR(v.desligamento)}${d ? ' · ' + esc(TIPO_DESL[d.tipo] || d.tipo) : ''}</div>
               ${d && d.precisa_repor && d.reposicao_situacao !== 'reposta' ? `<div class="col-repor">${esc(REPOSICAO[d.reposicao_situacao] || '')}</div>` : ''}`;
          return `<tr data-id="${v.id}" class="${estaAtivo(v) ? '' : 'col-desligado'}">
            <td class="col-c-pessoa"><button class="btn-link col-nome" data-acao="ficha">${esc(pe.nome)}</button>
              <div class="muted small">${RH.fmtCPF(pe.cpf)}${pe.telefone ? ` · ${tel.length >= 10 ? `<a href="https://wa.me/55${tel}" target="_blank" rel="noopener">${esc(pe.telefone)}</a>` : esc(pe.telefone)}` : ''}</div></td>
            <td>${v.cargo ? esc(v.cargo) : '<span class="muted">Sem cargo</span>'}<div class="muted small">${v.unidade ? esc(v.unidade) : 'Sem unidade'}${v.gestor ? ' · gestor: ' + esc(v.gestor) : ''}</div></td>
            <td><div class="nowrap">${nomeCidade(v.cidade_atuacao_id) ? esc(nomeCidade(v.cidade_atuacao_id)) : '<span class="muted">Sem cidade</span>'}</div><div class="small">${UI.badgeTipo(v.tipo)}</div></td>
            <td class="nowrap">${RH.fmtDataBR(v.admissao)}</td>
            <td class="nowrap">${futuro ? '<span class="muted">—</span>' : esc(Colab.fmtTempo(tempo(v, hoje)))}</td>
            <td>${sit}</td>
            <td class="acoes-col nao-imprimir nowrap"><button class="btn-link" data-acao="ficha">Abrir ficha</button>${podeEditar && estaAtivo(v) ? '<button class="btn-link" data-acao="movimentar">Transferir ou mudar cargo</button><button class="btn-link perigo" data-acao="desligar">Desligar</button>' : ''}</td></tr>`;
        }).join('') + '</tbody></table>';
    }

    q('#col-tabela').addEventListener('click', e => {
      const b = e.target.closest('[data-acao]'); if (!b) return;
      const v = linhas.find(x => x.id === b.closest('tr').dataset.id); if (!v) return;
      if (b.dataset.acao === 'ficha') ficha(v);
      else if (b.dataset.acao === 'movimentar') movimentar(v);
      else if (b.dataset.acao === 'desligar') desligar(v);
    });
    // depois de gravar: recarrega a lista e reabre a ficha já com o histórico novo
    async function recarregarEAbrir(id) {
      await carregar();
      const v = linhas.find(x => x.id === id);
      if (v && ativo) ficha(v);
    }

    // ---------- ficha do colaborador (dados + histórico em ordem cronológica) ----------
    function descreverEvento(ev) {
      const para = ev.para || {}, de = ev.de || {};
      const valor = (k, x) => x == null || x === '' ? 'não informado' : k === 'cidade_atuacao_id' ? (nomeCidade(x) || x) : k === 'tipo' && ev.tipo !== 'desligamento' ? UI.rotuloTipo(x) : x;
      if (ev.tipo === 'admissao') return [para.cargo, para.unidade, nomeCidade(para.cidade_atuacao_id), para.tipo ? UI.rotuloTipo(para.tipo) : ''].filter(Boolean).map(esc).join(' · ');
      if (ev.tipo === 'desligamento') return [TIPO_DESL[para.tipo] || para.tipo, para.motivo_categoria, para.precisa_repor ? 'precisa repor' : ''].filter(Boolean).map(esc).join(' · ');
      return Object.keys(para).map(k => `${esc(CAMPO[k] || k)}: ${esc(valor(k, de[k]))} <span class="muted">→</span> <b>${esc(valor(k, para[k]))}</b>`).join('<br>');
    }
    function ficha(v) {
      const pe = v.pessoa, d = v.desligamento_reg, hoje = Colab.hoje(), origem = nomeCidade(pe.cidade_origem_id);
      const dado = (rotulo, valor) => `<div><span class="col-rotulo">${rotulo}</span>${valor || '<span class="muted">—</span>'}</div>`;
      const corpo = `
        <div class="pre-form-titulo">Quem é</div>
        <div class="col-dados">
          ${dado('CPF', RH.fmtCPF(pe.cpf))}${dado('Telefone', v2(pe.telefone))}${dado('E-mail', v2(pe.email))}${dado('Cidade de origem', esc(origem))}
        </div>
        <div class="pre-form-titulo">Vínculo${estaAtivo(v) ? ' atual' : ' encerrado'}</div>
        <div class="col-dados">
          ${dado('Projeto', esc(Store.rotuloProjeto(projeto())))}${dado('Admissão', RH.fmtDataBR(v.admissao))}
          ${dado('Tempo de casa', v.admissao > hoje ? '' : esc(Colab.fmtTempo(tempo(v, hoje))))}${dado('Tipo de vínculo', v2(v.tipo_vinculo))}
          ${dado('Cargo', v2(v.cargo))}${dado('Unidade', v2(v.unidade))}
          ${dado('Onde trabalha', `${esc(nomeCidade(v.cidade_atuacao_id))} ${UI.badgeTipo(v.tipo)}`)}${dado('Gestor', v2(v.gestor))}
        </div>
        ${d ? `<div class="pre-form-titulo">Desligamento</div>
        <div class="col-dados">
          ${dado('Data', RH.fmtDataBR(d.data))}${dado('Tipo', esc(TIPO_DESL[d.tipo] || d.tipo))}
          ${dado('Motivo', v2(d.motivo_categoria))}${dado('Precisa repor', d.precisa_repor ? 'Sim' : 'Não')}
          ${d.precisa_repor ? dado('Reposição', podeEditar ? `<select id="fc-reposicao">${opcoes(REPOSICAO, d.reposicao_situacao)}</select>` : esc(REPOSICAO[d.reposicao_situacao] || '')) : ''}
          ${d.observacao ? `<div class="col-largo"><span class="col-rotulo">Observação (uso restrito)</span>${esc(d.observacao)}</div>` : ''}
        </div>` : ''}
        <div class="pre-form-titulo">Histórico</div>
        <div id="fc-historico" class="col-historico"><div class="muted small">Carregando…</div></div>`;
      const botoes = [{ texto: 'Fechar' }];
      if (podeEditar && estaAtivo(v)) botoes.push({ texto: 'Transferir ou mudar cargo', acao: () => { movimentar(v); } }, { texto: 'Desligar', classe: 'btn-perigo', acao: () => { desligar(v); } });
      const m = UI.modal({ titulo: pe.nome, largura: '720px', corpo, botoes });
      const g = s => m.corpo.querySelector(s);
      const rep = g('#fc-reposicao');
      if (rep) rep.addEventListener('change', async () => {
        const antes = d.reposicao_situacao;
        try { await Nuvem.colab.atualizarReposicao(d.id, rep.value); d.reposicao_situacao = rep.value; desenhar(); UI.toast('Reposição atualizada.', 'sucesso'); }
        catch (err) { rep.value = antes; UI.toast(err.message, 'erro', 6000); }
      });
      Nuvem.colab.historico(v.id).then(evs => {
        if (!m.el.isConnected) return;
        g('#fc-historico').innerHTML = !evs.length ? '<div class="muted small">Nenhum evento registrado para este vínculo.</div>' : evs.map(ev => `
          <div class="col-evento col-evento-${esc(ev.tipo)}">
            <div class="col-evento-data">${RH.fmtDataBR(ev.vigencia)}</div>
            <div><b>${esc(EVENTO[ev.tipo] || ev.tipo)}</b>
              <div class="small">${descreverEvento(ev)}</div>
              ${ev.observacao ? `<div class="small muted">${esc(ev.observacao)}</div>` : ''}
              <div class="small muted">Registrado por ${esc(ev.criado_login || 'sistema')} em ${UI.fmtDataHora(ev.criado_em)}</div></div>
          </div>`).join('');
      }).catch(err => { if (m.el.isConnected) g('#fc-historico').innerHTML = `<div class="erro small">Não foi possível carregar o histórico: ${esc(err.message)}</div>`; });
    }

    // ---------- transferir / mudar cargo / mudar gestor ----------
    function movimentar(v) {
      const hoje = Colab.hoje(), ufs = Store.ufsProjeto(projeto()), ca = cidade(v.cidade_atuacao_id);
      const corpo = `
        <p class="muted small" style="margin-top:0">Altere só o que mudou. Cada mudança fica no histórico com a data em que passou a valer e o valor anterior.</p>
        <div class="form-linha">
          <label>Vale a partir de<input id="m-vigencia" type="date" value="${hoje}" min="${v.admissao}" max="${hoje}"></label>
          <span></span>
        </div>
        <div class="pre-form-titulo">Cargo</div>
        <div class="form-linha">
          <label>Cargo<input id="m-cargo" list="m-cargos" value="${v2(v.cargo)}"><datalist id="m-cargos">${Store.cargos().map(c => `<option value="${esc(c.nome)}">`).join('')}</datalist></label>
          <label>Tipo de vínculo<input id="m-vinculo" list="m-vinculos" value="${v2(v.tipo_vinculo)}" placeholder="Ex.: CLT, safra, temporário"><datalist id="m-vinculos">${['CLT', 'Safra', 'Temporário', 'Experiência', 'Estágio', 'Aprendiz'].map(o => `<option value="${o}">`).join('')}</datalist></label>
        </div>
        <div class="pre-form-titulo">Transferência</div>
        <div class="form-linha">
          <label>Unidade<input id="m-unidade" value="${v2(v.unidade)}"></label>
          <label>Cidade onde trabalha<input id="m-cidade" placeholder="Cidade em ${esc(ufs.join('/'))}" value="${ca ? v2(ca.nome) : ''}" data-cidade-id="${ca ? ca.id : ''}"></label>
          <label>Tipo<select id="m-tipo"><option value="LOCAL" ${v.tipo !== 'MOVEL' ? 'selected' : ''}>Local</option><option value="MOVEL" ${v.tipo === 'MOVEL' ? 'selected' : ''}>Móvel</option></select></label>
        </div>
        <div class="pre-form-titulo">Gestor</div>
        <div class="form-linha">
          <label>Gestor<input id="m-gestor" value="${v2(v.gestor)}"></label>
        </div>
        <label style="margin-top:12px">Observação (aparece no histórico)<textarea id="m-obs" rows="2"></textarea></label>`;
      const m = UI.modal({ titulo: `Transferir ou mudar cargo — ${v.pessoa.nome}`, largura: '640px', corpo, fecharAoClicarFora: false,
        botoes: [{ texto: 'Cancelar' }, { texto: 'Salvar mudança', classe: 'btn-primario', acao: async md => {
          const g = s => md.corpo.querySelector(s), txt = s => g(s).value.trim() || null;
          const vig = g('#m-vigencia').value;
          if (!vig) throw new Error('Informe a data em que a mudança passa a valer.');
          if (vig < v.admissao) throw new Error('A data não pode ser anterior à admissão.');
          if (vig > Colab.hoje()) throw new Error('A data não pode estar no futuro: registre a mudança quando ela passar a valer.');
          const inp = g('#m-cidade'), t = inp.value.trim();
          // cidade gravada que este navegador não reconhece e campo deixado em branco: mantém a que está, não apaga sem querer
          let cidadeId = !ca && v.cidade_atuacao_id ? v.cidade_atuacao_id : null;
          if (t) {
            const c = (inp.dataset.cidadeId && Store.cidade(inp.dataset.cidadeId)) || Store.resolverCidade(t, ufs) || Store.cidadeAproximada(t, ufs);
            if (!c) throw new Error(`Cidade de trabalho: não achei "${t}". Escolha na lista de sugestões.`);
            cidadeId = c.id;
          }
          const mudou = (novo, atual) => (novo || null) !== (atual || null);
          const grupos = [
            ['transferencia', { unidade: [txt('#m-unidade'), v.unidade], cidade_atuacao_id: [cidadeId, v.cidade_atuacao_id], tipo: [g('#m-tipo').value, v.tipo] }],
            ['cargo', { cargo: [txt('#m-cargo'), v.cargo], tipo_vinculo: [txt('#m-vinculo'), v.tipo_vinculo] }],
            ['gestor', { gestor: [txt('#m-gestor'), v.gestor] }]
          ].map(([tipo, campos]) => [tipo, Object.fromEntries(Object.entries(campos).filter(([, par]) => mudou(par[0], par[1])).map(([k, par]) => [k, par[0]]))])
            .filter(([, para]) => Object.keys(para).length);
          if (!grupos.length) throw new Error('Nada foi alterado.');
          const obs = txt('#m-obs');
          let feitos = 0;
          try {
            // um evento por tipo de mudança; cada chamada é uma transação no banco
            for (const [tipo, para] of grupos) { await Nuvem.colab.movimentar(v.id, tipo, vig, para, obs); feitos++; }
          } catch (err) {
            if (feitos) { UI.toast(`Parte da mudança foi gravada (${feitos} de ${grupos.length}). O restante falhou: ${err.message}`, 'erro', 9000); await recarregarEAbrir(v.id); return; }
            throw err;
          }
          UI.toast('Mudança registrada no histórico.', 'sucesso');
          await recarregarEAbrir(v.id);
        } }] });
      UI.autocompleteCidade(m.corpo.querySelector('#m-cidade'), { uf: () => ufs, aoSelecionar: () => {} });
    }

    // ---------- desligar ----------
    function desligar(v) {
      const hoje = Colab.hoje();
      const corpo = `
        <p class="muted small" style="margin-top:0">O vínculo é encerrado na data informada, a pessoa passa a constar como ex-colaboradora e o desligamento entra nos indicadores do mês.</p>
        <div class="form-linha">
          <label>Data do desligamento<input id="d-data" type="date" value="${hoje}" min="${v.admissao}" max="${hoje}"></label>
          <label>Tipo<select id="d-tipo"><option value="">Escolha…</option>${opcoes(TIPO_DESL, '')}</select></label>
          <label style="grid-column:1/-1">Motivo<select id="d-motivo"><option value="">Escolha…</option>${MOTIVOS.map(x => `<option>${esc(x)}</option>`).join('')}</select></label>
          <label style="grid-column:1/-1;display:flex;gap:8px;align-items:center"><input type="checkbox" id="d-repor"> Precisa repor esta vaga</label>
          <label style="grid-column:1/-1">Observação (uso restrito: não vai para o histórico nem para a exportação)<textarea id="d-obs" rows="3" maxlength="2000"></textarea></label>
        </div>`;
      UI.modal({ titulo: `Desligar ${v.pessoa.nome}`, largura: '560px', corpo, fecharAoClicarFora: false,
        botoes: [{ texto: 'Cancelar' }, { texto: 'Desligar', classe: 'btn-perigo', acao: async md => {
          const g = s => md.corpo.querySelector(s);
          const dia = g('#d-data').value, tipo = g('#d-tipo').value, motivo = g('#d-motivo').value;
          if (!dia) throw new Error('Informe a data do desligamento.');
          if (dia < v.admissao) throw new Error(`A data não pode ser anterior à admissão (${RH.fmtDataBR(v.admissao)}).`);
          if (dia > Colab.hoje()) throw new Error('A data não pode estar no futuro: registre o desligamento no dia em que acontecer.');
          if (!tipo) throw new Error('Escolha o tipo de desligamento.');
          if (!motivo) throw new Error('Escolha o motivo.');
          await Nuvem.colab.desligar(v.id, { data: dia, tipo, motivo, observacao: g('#d-obs').value.trim(), repor: g('#d-repor').checked });
          UI.toast(`${v.pessoa.nome}: desligamento registrado em ${RH.fmtDataBR(dia)}.`, 'sucesso');
          if (situacao === 'ativos') await carregar(); else await recarregarEAbrir(v.id);
        } }] });
    }

    // ---------- indicadores por mês (banco) e retenção em 90 dias (calculada dos vínculos carregados) ----------
    function indicadores() {
      const hoje = Colab.hoje(), mesAtual = hoje.slice(0, 7);
      const m = UI.modal({ titulo: `Indicadores por mês — ${projeto().nome}`, largura: '780px', botoes: [{ texto: 'Fechar' }],
        corpo: `<div id="in-meses"><div class="muted small">Carregando…</div></div>
          <div class="pre-form-titulo" style="margin-top:18px">Retenção em 90 dias, por mês de admissão</div>
          <div id="in-retencao"></div>` });
      const g = s => m.corpo.querySelector(s);
      const ret = Colab.retencao(linhas, 90, hoje).filter(r => r.avaliaveis);
      g('#in-retencao').innerHTML = !ret.length ? '<div class="muted small">Ainda não há admissão com 90 dias completos neste projeto, então não há retenção para mostrar.</div>' :
        `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Mês de admissão</th><th class="direita">Admitidos</th><th class="direita">Já teriam 90 dias</th><th class="direita">Ficaram 90 dias</th><th class="direita">Retenção</th></tr></thead><tbody>` +
        ret.map(r => `<tr><td>${nomeMes(r.mes)}</td><td class="direita">${UI.fmtNum(r.admitidos)}</td><td class="direita">${UI.fmtNum(r.avaliaveis)}</td><td class="direita">${UI.fmtNum(r.retidos)}</td><td class="direita"><b>${UI.fmtPct(r.taxa)}</b></td></tr>`).join('') +
        '</tbody></table></div><p class="muted small">Só entra na conta quem já teve tempo de completar 90 dias. Considera apenas os colaboradores deste projeto.</p>';
      Nuvem.colab.indicadores(projetoId, Colab.somarMeses(Colab.primeiroDia(hoje), -11), hoje).then(l => {
        if (!m.el.isConnected) return;
        g('#in-meses').innerHTML = !l.length ? '<div class="muted small">Este projeto ainda não tem colaboradores nos últimos 12 meses, então não há indicador para mostrar.</div>' :
          `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Mês</th><th class="direita">No dia 1º</th><th class="direita">No último dia</th><th class="direita">Admissões</th><th class="direita">Desligamentos</th><th class="direita">Turnover</th></tr></thead><tbody>` +
          l.map(r => { const mes = String(r.mes).slice(0, 7); return `<tr><td>${nomeMes(mes)}${mes === mesAtual ? ' <span class="badge badge-azul">em andamento</span>' : ''}</td><td class="direita">${UI.fmtNum(r.headcount_inicio)}</td><td class="direita">${UI.fmtNum(r.headcount_fim)}</td>
            <td class="direita">${UI.fmtNum(r.admissoes)}</td><td class="direita">${UI.fmtNum(r.desligamentos)}</td><td class="direita">${r.turnover == null ? '<span class="muted" title="Sem quadro no mês: não há como calcular">—</span>' : `<b>${UI.fmtPct(Number(r.turnover))}</b>`}</td></tr>`; }).join('') +
          `</tbody></table></div><p class="muted small">Turnover = desligamentos ÷ quadro médio × 100, onde quadro médio = (quadro no dia 1º + quadro no último dia) ÷ 2. A pessoa conta no dia da admissão e não conta no dia do desligamento.${l.some(r => String(r.mes).slice(0, 7) === mesAtual) ? ' No mês em andamento, o último dia considera o que está lançado até agora.' : ''}</p>`;
      }).catch(err => { if (m.el.isConnected) g('#in-meses').innerHTML = `<div class="erro small">Não foi possível carregar os indicadores: ${esc(err.message)}</div>`; });
    }

    function exportar() {
      const l = filtradas(), hoje = Colab.hoje();
      if (!l.length) { UI.toast('Nada para exportar neste filtro.', 'aviso'); return; }
      const c = id => cidade(id) || {};
      UI.baixarCSV(`colaboradores-${projeto().nome}.csv`.replace(/[\\/:*?"<>|]/g, '-'), [['SITUAÇÃO', 'NOME', 'CPF', 'TELEFONE', 'E-MAIL', 'CARGO', 'UNIDADE', 'GESTOR', 'TIPO DE VÍNCULO', 'CIDADE DE ATUAÇÃO', 'ESTADO', 'MOVEL/LOCAL', 'ADMISSÃO', 'TEMPO DE CASA (DIAS)',
        'DESLIGAMENTO', 'TIPO DE DESLIGAMENTO', 'MOTIVO', 'PRECISA REPOR', 'REPOSIÇÃO']]
        .concat(l.map(v => { const d = v.desligamento_reg, t = tempo(v, hoje); return [estaAtivo(v) ? 'Ativo' : 'Desligado', v.pessoa.nome, RH.fmtCPF(v.pessoa.cpf), v.pessoa.telefone || '', v.pessoa.email || '', v.cargo || '', v.unidade || '', v.gestor || '', v.tipo_vinculo || '',
          c(v.cidade_atuacao_id).nome || '', c(v.cidade_atuacao_id).uf || '', v.tipo, RH.fmtDataBR(v.admissao), t ? t.totalDias : '',
          RH.fmtDataBR(v.desligamento), d ? (TIPO_DESL[d.tipo] || d.tipo) : '', d ? (d.motivo_categoria || '') : '', d ? (d.precisa_repor ? 'SIM' : 'NÃO') : '', d && d.precisa_repor ? (REPOSICAO[d.reposicao_situacao] || '') : '']; })));
      Store.auditar('relatorio.exportar', `Colaboradores exportados (${plural(l.length, 'pessoa', 'pessoas')}, com dados pessoais)`, App.usuario);
    }

    q('#col-projeto').addEventListener('change', e => { projetoId = e.target.value; localStorage.setItem('maparh:colab-projeto', projetoId); cargo = ''; unidade = ''; linhas = []; carregou = false; q('#col-resumo').innerHTML = ''; q('#col-tabela').innerHTML = '<div class="vazio">Carregando…</div>'; carregar(); });
    q('#col-situacao').addEventListener('change', e => { situacao = e.target.value; if (carregou) desenhar(); });
    q('#col-cargo').addEventListener('change', e => { cargo = e.target.value; if (carregou) desenhar(); });
    q('#col-unidade').addEventListener('change', e => { unidade = e.target.value; if (carregou) desenhar(); });
    q('#col-busca').addEventListener('input', UI.debounce(e => { busca = e.target.value.trim(); if (carregou) desenhar(); }, 200));
    q('#col-exportar').addEventListener('click', () => { if (carregou) exportar(); else UI.toast('A lista ainda não foi carregada.', 'aviso'); });
    q('#col-indicadores').addEventListener('click', () => { if (carregou) indicadores(); else UI.toast('A lista ainda não foi carregada.', 'aviso'); });
    q('#col-cargo').innerHTML = '<option value="">Todos</option>'; q('#col-unidade').innerHTML = '<option value="">Todas</option>';
    carregar();
    return () => { ativo = false; };
  }
};
