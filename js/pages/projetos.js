Paginas.projetos = {
  titulo: 'Projetos',
  semFiltros: true,
  render(el) {
    const podeEditar = App.podeEditar();
    const ehAdmin = App.usuario.perfil === 'admin';
    let busca = '';
    let aba = 'ativos'; // ativos | encerrados | todos

    // vagas do projeto (direto do cadastro): abertas = aprovadas e ainda não fechadas; pedidos = aguardando aprovação
    const FECHADA = ['preenchida', 'cancelada', 'recusada'];
    function vagasDo(id) {
      const lista = Store.vagas().filter(v => v.projetoId === id);
      const pend = v => v.aprovacao && v.aprovacao.situacao === 'pendente';
      return {
        lista,
        abertas: lista.filter(v => !FECHADA.includes(v.status) && !pend(v)),
        pedidos: lista.filter(v => pend(v) && !FECHADA.includes(v.status))
      };
    }
    const pl = (n, um, varios) => `${UI.fmtNum(n)} ${n === 1 ? um : varios}`;
    const salvarFiltro = id => { App.filtros.projetoId = id; try { localStorage.setItem('maparh:filtros', JSON.stringify(App.filtros)); } catch (e) { /* segue */ } App.atualizarFiltroProjetos(); };

    el.innerHTML = `
      ${UI.dicaNovato('projetos', '<b>Projeto = uma safra</b> (ex.: "Safra RS 2027"). As vagas, os candidatos e as contratações ficam dentro dele. No fim da safra, use <b>Encerrar</b>: os dados e relatórios ficam, mas ele some dos lugares de pedir vaga e trabalhar candidatos. Para a próxima, <b>Nova safra a partir desta</b> copia os estados e, se quiser, os pedidos de vaga.')}
      <div class="cad-barra">
        <input class="busca" id="pj-busca" type="search" placeholder="Buscar projeto…" aria-label="Buscar projeto">
        <div class="abas cad-abas" id="pj-abas" role="tablist"></div>
        <span class="espaco"></span>
        ${podeEditar ? '<button class="btn btn-primario" id="btn-novo">+ Novo projeto</button>' : ''}
      </div>
      <div class="grade grade-3" id="lista"></div>`;
    UI.ligarDicas(el);
    el.querySelector('#pj-busca').addEventListener('input', UI.debounce(e => { busca = e.target.value; renderLista(); }, 150));
    const bNovo = el.querySelector('#btn-novo'); if (bNovo) bNovo.addEventListener('click', () => abrirForm(null));

    function renderLista() {
      const todos = App.projetosVisiveis();
      const ativos = todos.filter(p => p.ativo !== false), encerrados = todos.filter(p => p.ativo === false);
      if (aba === 'encerrados' && !encerrados.length) aba = 'ativos';
      el.querySelector('#pj-abas').innerHTML = [['ativos', 'Em andamento', ativos.length], ['encerrados', 'Encerradas', encerrados.length], ['todos', 'Todas', todos.length]]
        .filter(([k, , n]) => k !== 'encerrados' || n)
        .map(([k, t, n]) => `<button type="button" class="aba ${aba === k ? 'ativa' : ''}" data-aba="${k}" role="tab" aria-selected="${aba === k}">${t} <span class="aba-num">${n}</span></button>`).join('');
      el.querySelectorAll('#pj-abas [data-aba]').forEach(b => b.addEventListener('click', () => { aba = b.dataset.aba; renderLista(); }));

      let projetos = aba === 'ativos' ? ativos : aba === 'encerrados' ? encerrados : todos;
      const termo = Store.normalizar(busca);
      if (termo) projetos = projetos.filter(p => Store.normalizar([p.nome, p.descricao, p.ano, ...Store.ufsProjeto(p)].join(' ')).includes(termo));
      const regs = Store.registrosFiltrados({ usuario: App.usuario });
      const resumo = Analise.porProjeto(regs, projetos);
      const lista = el.querySelector('#lista');

      if (!todos.length) {
        lista.innerHTML = UI.estadoVazio({
          titulo: 'Nenhum projeto ainda',
          texto: podeEditar ? 'Comece criando a safra (ex.: <b>Safra RS 2027</b>) e marque os estados onde vai contratar. Depois cadastre os <b>distritos</b> e peça as <b>vagas</b>.' : 'Peça a um administrador ou gestor para criar o projeto da safra e liberar o seu acesso.',
          botoes: podeEditar ? [{ acao: 'novo', texto: '+ Criar o primeiro projeto', primario: true }] : []
        });
        lista.querySelector('.vazio-guia').style.gridColumn = '1/-1';
        const b = lista.querySelector('[data-acao="novo"]'); if (b) b.addEventListener('click', () => abrirForm(null));
        return;
      }
      if (!projetos.length) {
        lista.innerHTML = UI.estadoVazio({ compacto: true, titulo: termo ? `Nada encontrado para "${busca}"` : 'Nenhum projeto nesta aba',
          texto: termo ? 'Confira a grafia ou procure em <b>Todas</b>.' : '', botoes: [{ acao: 'todas', texto: 'Ver todas' }] });
        lista.querySelector('.vazio-guia').style.gridColumn = '1/-1';
        lista.querySelector('[data-acao="todas"]').addEventListener('click', () => { aba = 'todos'; busca = ''; el.querySelector('#pj-busca').value = ''; renderLista(); });
        return;
      }

      lista.innerHTML = resumo.map(r => {
        const p = r.projeto;
        const vg = vagasDo(p.id);
        const pessoasAbertas = vg.abertas.reduce((n, v) => n + (+v.quantidade || 0), 0);
        const partesVaga = [];
        if (vg.abertas.length) partesVaga.push(`${pl(vg.abertas.length, 'vaga aberta', 'vagas abertas')}${pessoasAbertas ? ` (${pl(pessoasAbertas, 'pessoa', 'pessoas')})` : ''}`);
        if (vg.pedidos.length) partesVaga.push(`<span class="pj-pedidos">${pl(vg.pedidos.length, 'pedido aguardando aprovação', 'pedidos aguardando aprovação')}</span>`);
        const vagasTxt = partesVaga.length ? `<a href="#/vagas" class="pj-vagas-link" data-ir="vagas" title="Abrir as vagas deste projeto">${partesVaga.join(' · ')}</a>`
          : vg.lista.length ? `<a href="#/vagas" class="pj-vagas-link muted" data-ir="vagas">Nenhuma vaga em aberto (${pl(vg.lista.length, 'encerrada', 'encerradas')})</a>`
          : '<span class="muted">Nenhuma vaga pedida ainda</span>';
        const menu = [];
        if (podeEditar) menu.push(`<button type="button" data-m="safra">Nova safra a partir desta…</button>`);
        if (podeEditar) menu.push(`<button type="button" data-m="${p.ativo === false ? 'reabrir' : 'encerrar'}">${p.ativo === false ? 'Reabrir safra' : 'Encerrar safra…'}</button>`);
        if (ehAdmin) menu.push(`<button type="button" data-m="excluir" class="perigo">Excluir projeto…</button>`);
        return `<div class="card projeto-card ${p.ativo === false ? 'inativo' : ''}" style="border-top-color:${UI.esc(p.cor)}" data-id="${p.id}">
          <div class="linha entre"><h3>${UI.esc(p.nome)}</h3>${p.ativo === false ? '<span class="badge badge-cinza" title="Safra encerrada: dados e relatórios continuam disponíveis">encerrada</span>' : '<span class="badge badge-verde">em andamento</span>'}</div>
          <div class="muted">${icone('mapa', 14)} ${Store.ufsProjeto(p).map(x => `${x} — ${UI.esc(Store.UFS[x] || '')}`).join(' · ')}${p.ano ? ` · <b>${p.ano}</b>` : ''}</div>
          ${p.descricao ? `<div class="small">${UI.esc(p.descricao)}</div>` : ''}
          <div class="pj-vagas small">${vagasTxt}</div>
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
          <div class="linha nao-imprimir pj-acoes" style="margin-top:auto">
            <button class="btn btn-pequeno acao-ver">Ver no mapa</button>
            <button class="btn btn-pequeno acao-cadastro">Contratações</button>
            ${podeEditar ? `<button class="btn btn-pequeno acao-editar">Editar</button>` : ''}
            ${menu.length ? `<span class="espaco"></span><button type="button" class="btn btn-pequeno" data-menu aria-haspopup="menu" aria-expanded="false" title="Mais ações">Mais ⋯</button><div class="cad-menu" hidden>${menu.join('')}</div>` : ''}
          </div>
        </div>`;
      }).join('');

      lista.querySelectorAll('.projeto-card').forEach(card => {
        const id = card.dataset.id;
        const irCom = (pagina) => { salvarFiltro(id); App.ir(pagina); };
        card.querySelector('.acao-ver').addEventListener('click', () => irCom('mapa'));
        card.querySelector('.acao-cadastro').addEventListener('click', () => irCom(Store.pode(App.usuario, 'cadastro') ? 'cadastro' : 'relatorios'));
        const lv = card.querySelector('[data-ir="vagas"]'); if (lv) lv.addEventListener('click', e => { e.preventDefault(); irCom('vagas'); });
        const e = card.querySelector('.acao-editar'); if (e) e.addEventListener('click', () => abrirForm(Store.projeto(id)));
        const mb = card.querySelector('[data-menu]');
        if (mb) {
          const mn = mb.nextElementSibling;
          mb.addEventListener('click', ev => { ev.stopPropagation(); if (mn.hidden) { UI.abrirMenu(mb, mn); mb.setAttribute('aria-expanded', 'true'); } else { mn.hidden = true; mb.setAttribute('aria-expanded', 'false'); } });
          mn.addEventListener('click', ev => {
            const b = ev.target.closest('[data-m]'); if (!b) return;
            mn.hidden = true; mb.setAttribute('aria-expanded', 'false');
            const p = Store.projeto(id);
            if (b.dataset.m === 'safra') novaSafra(p);
            else if (b.dataset.m === 'encerrar') encerrar(p);
            else if (b.dataset.m === 'reabrir') reabrir(p);
            else if (b.dataset.m === 'excluir') excluir(p);
          });
        }
      });
    }

    // grava o projeto mantendo todos os campos (só muda o que vier em `muda`)
    function regravar(p, muda) {
      return Store.salvarProjeto({ id: p.id, nome: p.nome, uf: p.uf, ufs: Store.ufsProjeto(p), ano: p.ano == null ? '' : p.ano,
        descricao: p.descricao || '', cor: p.cor, ativo: p.ativo !== false, ...muda }, App.usuario);
    }

    async function encerrar(p) {
      const vg = vagasDo(p.id);
      const pendentes = vg.abertas.length + vg.pedidos.length;
      const corpo = `<p style="margin-top:0">Ao encerrar a safra <b>${UI.esc(p.nome)}</b>:</p>
        <ul class="pj-lista-efeitos">
          <li>ela <b>sai</b> da escolha de projeto ao pedir vaga, em Candidatos e no "Seu dia";</li>
          <li>as contratações, o mapa e os relatórios <b>continuam</b> disponíveis (aba Encerradas);</li>
          <li>dá para <b>reabrir</b> depois, se precisar.</li>
        </ul>
        ${pendentes ? `<div class="caixa caixa-aviso">Ainda há ${vg.abertas.length ? `<b>${pl(vg.abertas.length, 'vaga aberta', 'vagas abertas')}</b>` : ''}${vg.abertas.length && vg.pedidos.length ? ' e ' : ''}${vg.pedidos.length ? `<b>${pl(vg.pedidos.length, 'pedido aguardando aprovação', 'pedidos aguardando aprovação')}</b>` : ''} neste projeto. Encerrar a safra não fecha isso sozinho: se acabou mesmo, cancele as vagas (e recuse os pedidos) em <b>Vagas</b>.</div>` : ''}`;
      UI.modal({ titulo: 'Encerrar safra', largura: '520px', corpo,
        botoes: [{ texto: 'Cancelar' }].concat(pendentes ? [{ texto: 'Ver as vagas', acao: () => { salvarFiltro(p.id); App.ir('vagas'); } }] : [])
          .concat([{ texto: 'Encerrar safra', classe: 'btn-primario', acao: () => {
            regravar(p, { ativo: false });
            if (App.filtros.projetoId === p.id) salvarFiltro('');
            UI.toast(`Safra "${p.nome}" encerrada. Ela continua na aba Encerradas.`, 'sucesso', 5000);
            App.atualizarFiltroProjetos(); renderLista();
          } }]) });
    }
    function reabrir(p) {
      try { regravar(p, { ativo: true }); UI.toast(`Safra "${p.nome}" reaberta.`, 'sucesso'); App.atualizarFiltroProjetos(); aba = 'ativos'; renderLista(); }
      catch (e) { UI.toast(e.message, 'erro', 7000); }
    }
    async function excluir(p) {
      const qtd = Store.registros().filter(r => r.projetoId === p.id).length;
      const nVagas = Store.vagas().filter(v => v.projetoId === p.id).length;
      if (nVagas) {
        UI.modal({ titulo: 'Não dá para excluir este projeto', largura: '480px',
          corpo: `<p style="margin-top:0"><b>${UI.esc(p.nome)}</b> tem ${pl(nVagas, 'vaga', 'vagas')} (com candidatos e histórico). Excluir apagaria esse trabalho.</p><p class="muted small" style="margin-bottom:0">Se a safra terminou, use <b>Encerrar safra</b>: ela sai do dia a dia e os dados ficam guardados.</p>`,
          botoes: [{ texto: 'Fechar' }].concat(p.ativo !== false ? [{ texto: 'Encerrar safra…', classe: 'btn-primario', acao: () => { setTimeout(() => encerrar(p), 0); } }] : []) });
        return;
      }
      if (await UI.confirmar(`Excluir o projeto "${p.nome}"${qtd ? ` e ${pl(qtd, 'contratação', 'contratações')}` : ''}? Esta ação não pode ser desfeita.${qtd ? ' Se só quer tirar do dia a dia, use "Encerrar safra".' : ''}`, { textoOk: qtd ? 'Excluir tudo' : 'Excluir', perigo: true })) {
        try { Store.excluirProjeto(p.id, App.usuario); UI.toast('Projeto excluído.', 'sucesso'); App.atualizarFiltroProjetos(); renderLista(); }
        catch (e) { UI.toast(e.message, 'erro', 7000); }
      }
    }

    // Nova safra copiando a estrutura da anterior: estados, cor, descrição e (opcional) os pedidos de vaga
    function novaSafra(p) {
      const anoNovo = p.ano ? p.ano + 1 : new Date().getFullYear() + 1;
      const nomeSug = p.ano && String(p.nome).includes(String(p.ano)) ? p.nome.replace(String(p.ano), String(anoNovo)) : `${p.nome} ${anoNovo}`;
      const vg = vagasDo(p.id);
      const copiaveis = vg.lista.filter(v => v.status !== 'recusada' && Array.isArray(v.distritos) && v.distritos.length);
      const pessoas = copiaveis.reduce((n, v) => n + (+v.quantidade || 0), 0);
      // quem tem acesso só a projetos escolhidos não vai ver a safra nova sozinho
      const restritos = Store.usuarios().filter(u => u.ativo !== false && u.perfil !== 'admin' && Array.isArray(u.projetos) && u.projetos.includes(p.id) && u.id !== App.usuario.id);
      const md = UI.modal({
        titulo: `Nova safra a partir de "${p.nome}"`, largura: '580px', fecharAoClicarFora: false,
        corpo: `
          <div class="form-linha">
            <label>Nome da nova safra<input id="ns-nome" value="${UI.esc(nomeSug)}"></label>
            <label>Ano<input type="number" id="ns-ano" min="1990" max="2100" value="${anoNovo}"></label>
          </div>
          <p class="muted small" style="margin-top:0">Copia os estados (${Store.ufsProjeto(p).join(', ')}), a cor e a descrição. Distritos, cidades e cargos já valem para todas as safras.</p>
          ${copiaveis.length ? `<label class="check ns-opcao"><input type="checkbox" id="ns-vagas"> <span>Copiar os <b>${pl(copiaveis.length, 'pedido de vaga', 'pedidos de vaga')}</b> (${pl(pessoas, 'pessoa', 'pessoas')})<br><span class="muted small">Entram como pedidos <b>aguardando aprovação</b>, com o mesmo cargo, distritos e quantidades. Sem candidatos, sem RH e sem datas — o administrador revisa e aprova.</span></span></label>` : '<p class="muted small">Esta safra não tem pedidos de vaga por distrito para copiar.</p>'}
          ${p.ativo !== false ? `<label class="check ns-opcao"><input type="checkbox" id="ns-encerrar"> <span>Encerrar a safra "${UI.esc(p.nome)}"<br><span class="muted small">Ela sai do dia a dia; dados e relatórios ficam.</span></span></label>` : ''}
          ${restritos.length ? `<div class="caixa caixa-info small">${pl(restritos.length, 'usuário tem', 'usuários têm')} acesso só a projetos escolhidos (${UI.esc(restritos.slice(0, 4).map(u => u.nome).join(', '))}${restritos.length > 4 ? '…' : ''}). Depois de criar, libere a safra nova para eles em <b>Usuários</b>.</div>` : ''}`,
        botoes: [{ texto: 'Cancelar' }, { texto: 'Criar nova safra', classe: 'btn-primario', acao: m => {
          const q = s => m.corpo.querySelector(s);
          const novo = Store.salvarProjeto({ id: null, nome: q('#ns-nome').value, uf: p.uf, ufs: Store.ufsProjeto(p), ano: q('#ns-ano').value,
            descricao: p.descricao || '', cor: p.cor, ativo: true }, App.usuario);
          App.usuario = Store.usuarioAtual() || App.usuario;
          let copiadas = 0; const falhas = [];
          if (q('#ns-vagas') && q('#ns-vagas').checked) {
            for (const v of copiaveis) {
              try {
                Store.salvarVaga({ titulo: v.titulo, projetoId: novo.id, distritos: v.distritos.map(x => ({ distritoId: x.distritoId, locais: x.locais, moveis: x.moveis })),
                  unidade: v.unidade || '', descricao: v.descricao || '', requisitos: v.requisitos || '', salario: v.salario || '', beneficios: v.beneficios || '',
                  jornada: v.jornada || '', contato: v.contato || '', prioridade: v.prioridade || 'normal', dataNecessidade: null,
                  justificativa: { tipo: 'safra', texto: '' }, recrutadorLogin: null }, App.usuario);
                copiadas++;
              } catch (e) { falhas.push(`${v.titulo}: ${e.message}`); }
            }
          }
          if (q('#ns-encerrar') && q('#ns-encerrar').checked) { try { regravar(p, { ativo: false }); } catch (e) { falhas.push('Encerrar a safra antiga: ' + e.message); } }
          salvarFiltro(novo.id);
          App.prepararBases();
          aba = 'ativos'; renderLista();
          const partes = [`Safra "${novo.nome}" criada`];
          if (copiadas) partes.push(`${pl(copiadas, 'pedido de vaga copiado', 'pedidos de vaga copiados')} (aguardando aprovação)`);
          UI.toast(partes.join(' · ') + '.', falhas.length ? 'aviso' : 'sucesso', 6000);
          if (falhas.length) UI.modal({ titulo: 'Alguns pedidos não foram copiados', largura: '520px', corpo: `<ul>${falhas.map(f => `<li>${UI.esc(f)}</li>`).join('')}</ul>`, botoes: [{ texto: 'Fechar' }] });
        } }]
      });
      return md;
    }

    function abrirForm(p) {
      const anoAtual = new Date().getFullYear();
      const md = UI.modal({
        titulo: p ? 'Editar projeto' : 'Novo projeto',
        corpo: `
          <label>Nome do projeto<input id="p-nome" value="${UI.esc(p ? p.nome : '')}" placeholder="Ex.: Safra RS ${anoAtual + 1}"></label>
          <div id="p-nome-aviso" class="ajuda-inline"></div>
          <div class="form-linha">
            <label>Ano (opcional)<input type="number" id="p-ano" min="1990" max="2100" value="${p && p.ano ? p.ano : ''}" placeholder="Ex.: ${anoAtual}"></label>
            <label>Estado principal (centro do mapa)<select id="p-uf">${UI.opcoesUF(p ? p.uf : '')}</select></label>
          </div>
          <label style="margin-bottom:4px">Estados (UF) onde o projeto contrata — marque um ou mais</label>
          <div class="linha" id="p-atalhos" style="gap:6px;margin-bottom:6px;flex-wrap:wrap">
            <span class="muted small">Atalhos:</span>
            <button type="button" class="btn btn-pequeno" data-ufs="RS,SC,PR">Sul inteiro</button>
            <button type="button" class="btn btn-pequeno" data-ufs="RS,SC,PR,SP,MS">Sul + SP e MS</button>
            <button type="button" class="btn btn-pequeno" data-ufs="*">Brasil inteiro</button>
            <button type="button" class="btn btn-pequeno" data-ufs="">Limpar</button>
          </div>
          <div class="ufs-grade" id="p-ufs">${Object.keys(Store.UFS).sort().map(u => `<label class="uf-opcao"><input type="checkbox" value="${u}" ${(p ? Store.ufsProjeto(p) : []).includes(u) ? 'checked' : ''}> ${u}</label>`).join('')}</div>
          <label>Descrição (opcional)<input id="p-desc" value="${UI.esc(p ? p.descricao : '')}"></label>
          <div class="form-linha">
            <label>Cor no mapa<input type="color" id="p-cor" value="${UI.esc(p ? p.cor : '#2563eb')}"></label>
            <label style="display:flex;gap:8px;align-items:center;margin-top:22px"><input type="checkbox" id="p-ativo" ${!p || p.ativo !== false ? 'checked' : ''}> Safra em andamento <span class="muted small">(desmarque para encerrar)</span></label>
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
            App.prepararBases(); // estados novos: carrega a base embutida ou caça as agências na internet
          } }
        ]
      });
      // nome parecido com outro projeto: avisa enquanto digita (igual o sistema já recusa ao salvar)
      const nomeInp = md.corpo.querySelector('#p-nome'), aviso = md.corpo.querySelector('#p-nome-aviso');
      const conferirNome = () => {
        const par = UI.nomesParecidos(nomeInp.value, Store.projetos().filter(x => !p || x.id !== p.id));
        aviso.innerHTML = !par.length ? '' : par[0].igual
          ? `<span class="status-erro">Já existe um projeto com este nome${par[0].item.ativo === false ? ' (encerrado)' : ''}.</span> Use outro nome ou edite o existente.`
          : `<span class="status-espera">Parecido com: ${par.slice(0, 3).map(x => `<b>${UI.esc(x.item.nome)}</b>`).join(', ')}.</span> Confira se não é o mesmo.`;
      };
      nomeInp.addEventListener('input', UI.debounce(conferirNome, 150));
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
      // atalhos: marca um grupo de estados de uma vez (Sul, Sul + vizinhos, Brasil)
      md.corpo.querySelectorAll('#p-atalhos [data-ufs]').forEach(b => b.addEventListener('click', () => {
        const alvo = b.dataset.ufs === '*' ? null : new Set(b.dataset.ufs.split(',').filter(Boolean));
        const principalAntes = selUF.value;
        md.corpo.querySelectorAll('#p-ufs input').forEach(i => { i.checked = alvo ? alvo.has(i.value) : true; });
        sincronizar();
        // o estado principal (centro do mapa) fica no primeiro do atalho quando o anterior saiu da seleção
        if (alvo && alvo.size && !alvo.has(principalAntes)) selUF.value = [...alvo][0];
      }));
      sincronizar();
    }

    renderLista();
  }
};
