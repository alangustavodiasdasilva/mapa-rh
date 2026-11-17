// Início: o fluxo do RH em quatro passos com os números de hoje, e abaixo os indicadores das contratações.
Paginas.dashboard = {
  titulo: 'Início',
  render(el) {
    const regs = App.regs();
    const projetos = App.projetosVisiveis().filter(p => !App.filtros.projetoId || p.id === App.filtros.projetoId);
    const r = Analise.resumo(regs);
    const graficos = [];
    const podeEditar = App.podeEditar();

    if (!Store.projetos().length) {
      el.innerHTML = `
        <div class="card boas-vindas">
          <h2>Bem-vindo ao Mapa RH</h2>
          <p>O sistema acompanha o RH do começo ao fim: <b>abrir a vaga</b>, <b>divulgar</b>, <b>selecionar os candidatos</b> e, ao admitir, <b>ver no mapa</b> de onde as pessoas vêm e onde trabalham.</p>
          <ol class="passos-inicio">
            <li><b>Crie um projeto</b> — é o estado e o ano das contratações (ex.: "Contratações RS 2026").</li>
            <li><b>Confira os distritos e microrregiões</b> — o distrito Lagoa Vermelha já vem montado.</li>
            <li><b>Abra as vagas</b> e divulgue nos canais (SINE, LinkedIn, Indeed, WhatsApp, rádio…).</li>
            <li><b>Cadastre os candidatos</b> e avance cada um até a admissão. Quem já foi contratado antes pode ser importado da planilha em Contratações.</li>
          </ol>
          <div class="linha mt">
            ${podeEditar ? `<button class="btn btn-primario" id="btn-novo-projeto">Criar o primeiro projeto</button>
            <button class="btn" id="btn-exemplo">Carregar dados de exemplo</button>` : '<span class="muted">Peça a um gestor ou administrador para cadastrar os projetos.</span>'}
          </div>
        </div>`;
      const b1 = el.querySelector('#btn-novo-projeto'); if (b1) b1.addEventListener('click', () => App.ir('projetos'));
      const b2 = el.querySelector('#btn-exemplo'); if (b2) b2.addEventListener('click', () => {
        try { const n = Store.dadosDeExemplo(App.usuario); UI.toast(`Dados de exemplo carregados (${n} contratações).`, 'sucesso'); App.recarregar(); }
        catch (e) { UI.toast(e.message, 'erro'); }
      });
      return;
    }

    const rec = Store.resumoRecrutamento(App.usuario, App.filtros.projetoId);
    const temAno = regs.some(x => x.projeto.ano);
    // pendências (refeitas depois que chega a contagem dos candidatos, para não dizer "sem candidato" sem saber)
    const textoPendencias = (rc, extra = []) => {
      const l2 = [...extra];
      if (rc.aguardandoAprovacao) l2.push(`<a href="#/vagas">${rc.aguardandoAprovacao === 1 ? '1 vaga aguardando aprovação' : rc.aguardandoAprovacao + ' vagas aguardando aprovação'}</a>`);
      if (rc.atrasadas) l2.push(`<a href="#/vagas">${rc.atrasadas === 1 ? '1 vaga atrasada' : rc.atrasadas + ' vagas atrasadas'}</a>`);
      if (rc.semDivulgacao) l2.push(`<a href="#/vagas">${rc.semDivulgacao === 1 ? '1 vaga aberta' : rc.semDivulgacao + ' vagas abertas'} sem divulgação</a>`);
      if (rc.prazoVencido) l2.push(`<a href="#/vagas">${rc.prazoVencido} vaga(s) com prazo vencido</a>`);
      if (rc.semCandidatos && rc.contagemPronta) l2.push(`<a href="#/vagas">${rc.semCandidatos} vaga(s) divulgada(s) ainda sem candidato</a>`);
      if (!Store.temIBGE()) l2.push(`<a href="#/cidades">baixar a lista de cidades do IBGE</a> (uma vez só, reconhece qualquer cidade do Brasil)`);
      return l2.length ? `<div class="caixa caixa-aviso mb" style="margin-top:0"><b>Pendências:</b> ${l2.join(' · ')}.</div>` : '';
    };
    // Recrutamento (para a diretoria): sai do andamento dos candidatos (sem dado pessoal) e das vagas.
    // Vale para todos que veem o Início; o RH (analista) vê só o que é dele. Respeita os filtros de distrito e tipo do topo.
    setTimeout(async () => {
      const v = document.getElementById('dash-cand'), s = document.getElementById('dash-cand-sub'), alvo = document.getElementById('dash-rec'); if (!v) return;
      if (typeof Nuvem === 'undefined' || !Nuvem.ativa) { v.textContent = '—'; s.textContent = 'precisa do banco central'; alvo.innerHTML = ''; return; }
      let l;
      const pid = App.filtros.projetoId || '', cache = Paginas.dashboard._cache;
      if (cache && cache.pid === pid) {
        l = cache.l;   // o que já tinha: aparece na hora; a conferência abaixo só redesenha se mudou
        Nuvem.rh.andamento(App.filtros.projetoId).then(n => { const j = JSON.stringify(n); if (j === cache.j) return; Paginas.dashboard._cache = { pid, l: n, j }; if (App.paginaAtual === 'dashboard') App.rotear(true); }).catch(() => {});
      } else try { l = await Nuvem.rh.andamento(App.filtros.projetoId); Paginas.dashboard._cache = { pid, l, j: JSON.stringify(l) }; } catch (e) {
        v.textContent = '—'; s.textContent = 'não foi possível carregar';
        alvo.innerHTML = '<div class="card vazio mb">Não foi possível carregar o recrutamento. <button class="btn btn-pequeno" id="dr-tentar">Tentar de novo</button></div>';
        document.getElementById('dr-tentar').addEventListener('click', () => App.recarregar()); return;
      }
      if (!document.body.contains(v)) return;
      if (App.filtros.distritoId) l = l.filter(p => p.distrito_id === App.filtros.distritoId);
      if (App.filtros.tipo) l = l.filter(p => p.tipo === App.filtros.tipo);
      const ab = l.filter(p => p.situacao === 'em_andamento'), n = e => ab.filter(p => p.etapa === e).length;
      v.textContent = UI.fmtNum(ab.length);
      s.textContent = ab.length ? `${n('triagem')} na triagem · ${n('entrevista')} em entrevista · ${n('documentos')} na documentação` : 'triagem, entrevista e documentação';
      if (!l.length) {
        Store.definirContagemVagas({});
        const pe = document.getElementById('dash-pend'); if (pe) pe.innerHTML = textoPendencias({ ...Store.resumoRecrutamento(App.usuario, App.filtros.projetoId), contagemPronta: true });
        alvo.innerHTML = '<div class="secao-titulo">Recrutamento</div><div class="card vazio mb">Nenhuma candidatura ainda neste filtro. Quando o RH importar ou cadastrar candidatos, o funil aparece aqui.</div>';
        return;
      }
      // contagem das vagas a partir do mesmo andamento (sem buscar de novo)
      const cont = {};
      for (const p of l) {
        if (!p.vaga_id || (p.situacao !== 'admitido' && p.situacao !== 'em_andamento')) continue;
        const c = cont[p.vaga_id] || (cont[p.vaga_id] = { candidatos: 0, admitidos: 0, emProcesso: 0, etapas: { triagem: 0, entrevista: 0, documentos: 0 }, dist: {} });
        const d = c.dist[p.distrito_id || '(sem)'] || (c.dist[p.distrito_id || '(sem)'] = { LOCAL: { adm: 0, proc: 0 }, MOVEL: { adm: 0, proc: 0 } });
        const tp = d[p.tipo === 'MOVEL' ? 'MOVEL' : 'LOCAL'];
        c.candidatos++; if (p.situacao === 'admitido') { c.admitidos++; tp.adm++; } else { c.emProcesso++; tp.proc++; c.etapas[p.etapa]++; }
      }
      Store.definirContagemVagas(cont);
      // com a contagem, o passo 1 passa a contar o que realmente falta (vaga completa sai das abertas)
      const rec2 = Store.resumoRecrutamento(App.usuario, App.filtros.projetoId), dv = document.getElementById('dash-vagas');
      // o que está travando: prontos parados, documentação parada, chegada da semana com pendência, sem RH
      const DIA2 = 86400000, parado = p => p.etapa_em ? (Date.now() - new Date(p.etapa_em).getTime()) / DIA2 : 0;
      const pronto = p => p.etapa === 'documentos' && p.dinamica === 'ok' && !p.documentos_pendentes && ['ok', 'dispensado'].includes(p.aso) && ['ok', 'dispensado'].includes(p.treinamento);
      const segH = RH.segundaDaSemana(RH.hoje()), fimH = (() => { const d = new Date(segH + 'T12:00:00'); d.setDate(d.getDate() + 6); return d.toISOString().slice(0, 10); })();
      const prParados = ab.filter(p => pronto(p) && parado(p) >= 2).length;
      const docParada = ab.filter(p => p.etapa === 'documentos' && !pronto(p) && parado(p) >= 7).length;
      const chegaPend = ab.filter(p => p.chegada_data && p.chegada_data >= segH && p.chegada_data <= fimH && !pronto(p)).length;
      const semRhN = ab.filter(p => !p.analista_login).length;
      const extra = [prParados && `<a href="#/candidatos">${prParados === 1 ? '1 pessoa pronta' : prParados + ' pessoas prontas'} para admitir há 2+ dias</a>`,
        docParada && `<a href="#/candidatos">${docParada} na documentação parada${docParada > 1 ? 's' : ''} há 7+ dias</a>`,
        chegaPend && `<a href="#/candidatos">${chegaPend} chega${chegaPend > 1 ? 'm' : ''} esta semana com pendência</a>`,
        semRhN && `<a href="#/candidatos">${semRhN} candidato${semRhN > 1 ? 's' : ''} sem RH responsável</a>`].filter(Boolean);
      const pe = document.getElementById('dash-pend'); if (pe) pe.innerHTML = textoPendencias({ ...rec2, contagemPronta: true }, extra);
      if (dv) { dv.textContent = UI.fmtNum(rec2.vagasAbertas); document.getElementById('dash-vagas-sub').innerHTML = `${UI.fmtNum(rec2.posicoes)} ${rec2.posicoes === 1 ? 'pessoa' : 'pessoas'} ainda a contratar${rec2.semDivulgacao ? ` · <span class="erro">${rec2.semDivulgacao} sem divulgar</span>` : ''}`; }
      const vagas = Store.vagasVisiveis(App.usuario, { projetoId: App.filtros.projetoId }).filter(x => x.aprovada && x.status !== 'cancelada');
      // pedido x admitido conta local e móvel separados por distrito (10 locais admitidos não cobrem 5 móveis pedidos)
      // e respeita os filtros de distrito e tipo do topo, igual aos candidatos
      const fD = App.filtros.distritoId, fT = App.filtros.tipo;
      let pedidas = 0, admV = 0;
      for (const x of vagas) {
        if (x.porDistrito && x.porDistrito.length) {
          for (const d of x.porDistrito) {
            if (fD && d.distrito.id !== fD) continue;
            if (fT !== 'MOVEL') { pedidas += d.locais; admV += Math.min(d.admLoc, d.locais); }
            if (fT !== 'LOCAL') { pedidas += d.moveis; admV += Math.min(d.admMov, d.moveis); }
          }
        } else if (!fD) { pedidas += x.quantidade; admV += Math.min(x.admitidos || 0, x.quantidade); }
      }
      const adm = l.filter(p => p.situacao === 'admitido'), fora = l.filter(p => p.situacao === 'reprovado' || p.situacao === 'desistiu');
      const DIA = 86400000, dias = adm.filter(p => p.admitido_em && p.criado_em).map(p => Math.max(0, (new Date(p.admitido_em + 'T12:00:00') - new Date(p.criado_em)) / DIA));
      const tempo = dias.length ? dias.reduce((a, b) => a + b, 0) / dias.length : null;
      // funil: até onde cada pessoa chegou (quem saiu fica na etapa em que saiu)
      const ORD = { triagem: 0, entrevista: 1, documentos: 2 };
      const chegou = k => l.filter(p => p.situacao === 'admitido' || ORD[p.etapa] >= k).length;
      const funil = [['Candidaturas', l.length], ['Chegaram à entrevista', chegou(1)], ['Chegaram à documentação', chegou(2)], ['Admitidos', adm.length]];
      const pct = (a, b) => b ? Math.round(100 * a / b) : 0;
      // por distrito: pedido x admitido (local e móvel), juntando as vagas
      const porD = new Map();
      for (const x of vagas) for (const d of x.porDistrito) {
        if (fD && d.distrito.id !== fD) continue;
        const a = porD.get(d.distrito.id) || { nome: d.distrito.nome, pl: 0, pm: 0, al: 0, am: 0, proc: 0 };
        a.pl += d.locais; a.pm += d.moveis; a.al += Math.min(d.admLoc, d.locais); a.am += Math.min(d.admMov, d.moveis); a.proc += d.procLoc + d.procMov; porD.set(d.distrito.id, a);
      }
      // por RH
      const porRh = new Map();
      for (const p of l) {
        const k = p.analista_login || p.analista || '(sem)';
        const u = Store.usuarioPorLogin(p.analista_login);
        const a = porRh.get(k) || { nome: u ? u.nome : (p.analista || 'Sem RH responsável'), u, proc: 0, adm: 0, fora: 0, total: 0 };
        a.total++; if (p.situacao === 'admitido') a.adm++; else if (p.situacao === 'em_andamento') a.proc++; else a.fora++; porRh.set(k, a);
      }
      // saídas: em que etapa e por quê
      const saiu = e => fora.filter(p => p.etapa === e).length;
      // chegadas das próximas semanas
      const hoje = RH.hoje(), seg = RH.segundaDaSemana(hoje);
      const semanas = new Map();
      for (const p of l) if (p.chegada_data && p.chegada_data >= seg && (p.situacao === 'em_andamento' || p.situacao === 'admitido')) { const w = RH.segundaDaSemana(p.chegada_data); semanas.set(w, (semanas.get(w) || 0) + 1); }
      const prox = [...semanas.entries()].sort().slice(0, 4);
      const fimSem = w => { const d = new Date(w + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 6); return RH.fmtDia(d.toISOString().slice(0, 10)); };
      const barra = (val, max, cls = '') => `<div class="dr-barra ${cls}"><i style="width:${max ? Math.max(2, Math.round(100 * val / max)) : 0}%"></i></div>`;
      const qtd = (x, um, varios) => `${UI.fmtNum(x)} ${x === 1 ? um : varios}`;
      alvo.innerHTML = `
        <div class="secao-titulo dr-titulo">Recrutamento ${App.usuario.perfil === 'analista' ? '<span class="muted small">(só o que está com você)</span>' : ''}<span class="espaco"></span><button class="btn btn-pequeno nao-imprimir" id="dr-imprimir" title="Gera uma versão para imprimir ou salvar em PDF">Imprimir / PDF</button></div>
        <section class="card dr-hero mb">
          <div>
            <div class="dr-hero-rot">Pedido preenchido${fD || fT ? ' <span class="muted small">(com o filtro do topo)</span>' : ''}</div>
            <div class="dr-hero-n"><b>${UI.fmtNum(admV)}</b> de ${UI.fmtNum(pedidas)} pessoas <span>${pct(admV, pedidas)}%</span></div>
            <div class="dr-barra dr-hero-barra dr-ok"><i style="width:${pedidas ? Math.max(1, pct(admV, pedidas)) : 0}%"></i></div>
            <div class="muted small">${qtd(vagas.length, 'vaga aprovada', 'vagas aprovadas')}${adm.length > admV ? ` · +${adm.length - admV} admitidos fora do pedido` : ''}</div>
          </div>
          <ul class="dr-hero-fatos">
            <li><b>${UI.fmtNum(Math.max(0, pedidas - admV))}</b>faltam contratar</li>
            <li><b>${UI.fmtNum(ab.length)}</b>em processo agora</li>
            <li><b>${UI.fmtNum(l.filter(p => (p.situacao === 'em_andamento' || p.situacao === 'admitido') && p.chegada_data && p.chegada_data >= seg && p.chegada_data <= (() => { const d = new Date(seg + 'T12:00:00'); d.setDate(d.getDate() + 6); return d.toISOString().slice(0, 10); })()).length)}</b>chegam esta semana</li>
            <li><b>${tempo == null ? '—' : tempo.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' d'}</b>em média até admitir</li>
          </ul>
        </section>
        <div class="grade kpis mb" hidden>
          <div class="card kpi"><div class="rotulo">Pessoas pedidas</div><div class="valor">${UI.fmtNum(pedidas)}</div><div class="sub">${qtd(vagas.length, 'vaga aprovada', 'vagas aprovadas')}${fD || fT ? ' · com o filtro do topo' : ''}</div></div>
          <div class="card kpi kpi-local"><div class="rotulo">Admitidas</div><div class="valor">${UI.fmtNum(admV)}</div><div class="sub">${pedidas ? `${pct(admV, pedidas)}% do pedido preenchido` : 'sem vaga aprovada'}${adm.length > admV ? ` · +${adm.length - admV} fora do pedido` : ''}</div></div>
          <div class="card kpi"><div class="rotulo">Faltam</div><div class="valor">${UI.fmtNum(Math.max(0, pedidas - admV))}</div><div class="sub">${UI.fmtNum(ab.length)} em processo agora</div></div>
          <div class="card kpi"><div class="rotulo">Não seguiram</div><div class="valor">${UI.fmtNum(fora.length)}</div><div class="sub">${pct(fora.length, l.length)}% das candidaturas · ${fora.filter(p => p.situacao === 'desistiu').length} desistências</div></div>
          <div class="card kpi"><div class="rotulo">Da candidatura à admissão</div><div class="valor">${tempo == null ? '—' : tempo.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' d'}</div><div class="sub">${tempo == null ? 'ainda sem admissão' : 'média de ' + qtd(dias.length, 'admissão', 'admissões')}</div></div>
        </div>
        <div class="grade dr-grade mb">
          <div class="card"><h2>Funil</h2>
            ${funil.map(([rot, val], i) => `<div class="dr-funil"><div class="dr-funil-rot"><span>${rot}</span><b>${UI.fmtNum(val)}</b>${i ? `<em>${pct(val, funil[i - 1][1])}%</em>` : ''}</div>${barra(val, funil[0][1], i === 3 ? 'dr-ok' : '')}</div>`).join('')}
            <div class="dr-nota">Saíram na triagem: <b>${saiu('triagem')}</b> · na entrevista: <b>${saiu('entrevista')}</b> · na documentação: <b>${saiu('documentos')}</b></div>
          </div>
          <div class="card"><h2>Pedido x admitido por distrito</h2>
            ${porD.size ? `<div class="dr-tab dr-tab-cab"><span>Distrito</span><span>Locais</span><span>Móveis</span><span>Preenchido</span></div>` + [...porD.values()].sort((a, b) => ((b.pl + b.pm) - (b.al + b.am)) - ((a.pl + a.pm) - (a.al + a.am)) || a.nome.localeCompare(b.nome, 'pt-BR')).map(a => { const tot = a.pl + a.pm, ad = a.al + a.am; return `<div class="dr-tab">
                <b>${UI.esc(a.nome)}</b><span class="${a.al >= a.pl ? 'ok' : ''}">${a.al}/${a.pl}</span><span class="${a.am >= a.pm ? 'ok' : ''}">${a.am}/${a.pm}</span>${barra(ad, tot, ad >= tot ? 'dr-ok' : '')}</div>`; }).join('') : '<p class="muted small">Nenhuma vaga aprovada com distritos.</p>'}
          </div>
          <div class="card"><h2>Por RH</h2>
            <div class="dr-tab dr-tab-rh dr-tab-cab"><span>RH</span><span>Em processo</span><span>Admitidos</span><span>Não seguiram</span></div>
            ${[...porRh.values()].sort((a, b) => b.adm - a.adm || a.nome.localeCompare(b.nome, 'pt-BR')).map(a => `<div class="dr-tab dr-tab-rh"><b class="com-avatar">${a.u ? UI.avatar(a.u, 22) : ''}<span>${UI.esc(a.nome)}</span></b><span>${a.proc}</span><span class="ok">${a.adm}</span><span>${a.fora}</span></div>`).join('')}
          </div>
          <div class="card"><h2>Chegadas</h2>
            ${prox.length ? prox.map(([w, n]) => `<div class="dr-tab dr-tab-sem"><b>${RH.fmtDia(w)} a ${fimSem(w)}</b><span>${qtd(n, 'pessoa', 'pessoas')}</span>${barra(n, Math.max(...prox.map(x => x[1])))}</div>`).join('') : '<p class="muted small">Nenhuma chegada marcada a partir desta semana.</p>'}
            <div class="dr-nota">Pela data de chegada marcada na Documentação.</div>
          </div>
        </div>`;
      document.getElementById('dr-imprimir').addEventListener('click', () => window.print());
    }, 0);
    el.innerHTML = `
      <div class="fluxo">
        <a class="fluxo-passo" href="#/vagas">
          <div class="fluxo-num">1</div>
          <div><div class="fluxo-titulo">Vagas abertas</div><div class="fluxo-valor" id="dash-vagas">${UI.fmtNum(rec.vagasAbertas)}</div><div class="fluxo-sub" id="dash-vagas-sub">${UI.fmtNum(rec.posicoes)} ${rec.posicoes === 1 ? 'pessoa' : 'pessoas'} ainda a contratar${rec.semDivulgacao ? ` · <span class="erro">${rec.semDivulgacao} sem divulgar</span>` : ''}</div></div>
        </a>
        <div class="fluxo-seta">→</div>
        <a class="fluxo-passo" ${Store.pode(App.usuario, 'candidatos') ? 'href="#/candidatos"' : 'aria-disabled="true"'}>
          <div class="fluxo-num">2</div>
          <div><div class="fluxo-titulo">Candidatos em processo</div><div class="fluxo-valor" id="dash-cand">…</div><div class="fluxo-sub" id="dash-cand-sub">triagem, entrevista e documentação</div></div>
        </a>
        <div class="fluxo-seta">→</div>
        <a class="fluxo-passo" href="#/cadastro">
          <div class="fluxo-num">3</div>
          <div><div class="fluxo-titulo">Contratações</div><div class="fluxo-valor">${UI.fmtNum(r.total)}</div><div class="fluxo-sub">${UI.fmtNum(r.local)} local · ${UI.fmtNum(r.movel)} móvel</div></div>
        </a>
        <div class="fluxo-seta">→</div>
        <a class="fluxo-passo" href="#/mapa">
          <div class="fluxo-num">4</div>
          <div><div class="fluxo-titulo">No mapa</div><div class="fluxo-valor">${UI.fmtNum(r.cidadesOrigem)}</div><div class="fluxo-sub">cidades de origem · ${UI.fmtNum(r.cidadesAtuacao)} de trabalho</div></div>
        </a>
      </div>
      <div id="dash-pend">${textoPendencias({ ...rec, contagemPronta: false })}</div>
      <div id="dash-rec">${Paginas.dashboard._cache && Paginas.dashboard._cache.pid === (App.filtros.projetoId || '') ? '' : '<div class="card dr-esqueleto mb"></div>'}</div>
      <div class="secao-titulo">Perfil de quem já foi contratado <span class="muted small">${UI.esc(App.descricaoFiltro())}</span></div>
      <div class="grade kpis mb">
        <div class="card kpi"><div class="rotulo">Contratações</div><div class="valor">${UI.fmtNum(r.total)}</div><div class="sub">${UI.fmtNum(r.projetos)} projeto(s)</div></div>
        <div class="card kpi kpi-local"><div class="rotulo">Local</div><div class="valor">${UI.fmtNum(r.local)}</div><div class="sub">${UI.fmtPct(r.pctLocal)} do total</div></div>
        <div class="card kpi kpi-movel"><div class="rotulo">Móvel</div><div class="valor">${UI.fmtNum(r.movel)}</div><div class="sub">${UI.fmtPct(r.pctMovel)} do total</div></div>
        <div class="card kpi"><div class="rotulo">Cidades de origem</div><div class="valor">${UI.fmtNum(r.cidadesOrigem)}</div><div class="sub">em ${UI.fmtNum(r.ufsOrigem)} estado(s)</div></div>
        <div class="card kpi"><div class="rotulo">Vêm de fora do estado</div><div class="valor">${UI.fmtNum(r.foraDoEstado)}</div><div class="sub">${UI.fmtPct(r.pctForaDoEstado)} do total</div></div>
        <div class="card kpi"><div class="rotulo">Moram onde trabalham</div><div class="valor">${UI.fmtNum(r.mesmaCidade)}</div><div class="sub">de ${UI.fmtNum(r.cidadesAtuacao)} cidades de trabalho</div></div>
        <div class="card kpi"><div class="rotulo">Distância casa → trabalho</div><div class="valor">${UI.fmtKm(r.distMedia)}</div><div class="sub">média · máx. ${UI.fmtKm(r.distMax)}</div></div>
      </div>
      <div class="grade grade-2 mb" id="graficos">
        <div class="card"><h2>De onde vêm (10 maiores cidades)</h2><div class="grafico-wrap"><canvas id="g-origem"></canvas></div></div>
        <div class="card"><h2>Onde trabalham (10 maiores cidades)</h2><div class="grafico-wrap"><canvas id="g-atuacao"></canvas></div></div>
        <div class="card"><h2>Estados de origem</h2><div class="grafico-wrap"><canvas id="g-uf"></canvas></div></div>
        <div class="card"><h2>Distância de casa até o trabalho</h2><div class="grafico-wrap"><canvas id="g-dist"></canvas></div></div>
        ${Store.distritos().length ? `<div class="card" style="grid-column:1/-1"><h2>Contratações por microrregião <span class="muted small" style="font-weight:400">(pela cidade onde trabalham)</span></h2><div class="grafico-wrap" id="g-micro-wrap"><canvas id="g-micro"></canvas></div></div>` : ''}
        ${temAno ? '<div class="card" style="grid-column:1/-1"><h2>Evolução por ano</h2><div class="grafico-wrap"><canvas id="g-ano"></canvas></div></div>' : ''}
      </div>
      <div class="card">
        <h2>Resumo por projeto</h2>
        <div id="resumo-projetos"></div>
      </div>`;

    if (!regs.length) {
      el.querySelector('#graficos').innerHTML = `<div class="card vazio" style="grid-column:1/-1">Nenhuma contratação cadastrada para o filtro atual. ${Store.pode(App.usuario, 'candidatos') ? 'As contratações nascem da admissão: <a href="#/candidatos">ir para Candidatos</a>.' : ''}</div>`;
    } else if (typeof Chart === 'undefined') {
      el.querySelectorAll('.grafico-wrap').forEach(g => g.innerHTML = '<div class="vazio">Gráficos indisponíveis sem conexão com a internet.</div>');
    } else {
      Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
      Chart.defaults.color = '#475569';
      const empilhado = (horizontal) => ({ indexAxis: horizontal ? 'y' : 'x', responsive: true, maintainAspectRatio: false,
        scales: { x: { stacked: true, ticks: { precision: 0 } }, y: { stacked: true, ticks: { precision: 0 } } }, plugins: { legend: { position: 'bottom' } } });
      const dsLM = (lista) => [
        { label: 'LOCAL', data: lista.map(c => c.local), backgroundColor: '#16a34a', stack: 's' },
        { label: 'MÓVEL', data: lista.map(c => c.movel), backgroundColor: '#ea580c', stack: 's' }];

      const origem = Analise.porCidadeOrigem(regs).slice(0, 10);
      graficos.push(new Chart(el.querySelector('#g-origem'), { type: 'bar',
        data: { labels: origem.map(c => `${c.cidade.nome}/${c.cidade.uf}`), datasets: dsLM(origem) }, options: empilhado(true) }));

      const atuacao = Analise.porCidadeAtuacao(regs).slice(0, 10);
      graficos.push(new Chart(el.querySelector('#g-atuacao'), { type: 'bar',
        data: { labels: atuacao.map(a => a.rotulo), datasets: dsLM(atuacao) }, options: empilhado(true) }));

      const ufs = Analise.porUF(regs);
      const cores = ['#1d4ed8', '#0891b2', '#7c3aed', '#db2777', '#f59e0b', '#65a30d', '#0f766e', '#9333ea', '#dc2626', '#475569'];
      graficos.push(new Chart(el.querySelector('#g-uf'), { type: 'doughnut',
        data: { labels: ufs.map(u => `${u.uf} — ${u.nome}${u.foraDoEstado ? ' (fora)' : ''}`), datasets: [{ data: ufs.map(u => u.total), backgroundColor: ufs.map((_, i) => cores[i % cores.length]) }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } } }));

      const cvMicro = el.querySelector('#g-micro');
      if (cvMicro) {
        const micros = Analise.porMicro(regs);
        const variosDistritos = new Set(micros.map(m => m.distrito).filter(Boolean)).size > 1;
        el.querySelector('#g-micro-wrap').style.height = Math.max(220, 40 + micros.length * 30) + 'px';
        graficos.push(new Chart(cvMicro, { type: 'bar',
          data: { labels: micros.map(m => m.nome + (variosDistritos && m.distrito ? ' · ' + m.distrito : '')), datasets: [
            { label: 'LOCAL', data: micros.map(m => m.local), backgroundColor: '#16a34a', stack: 's' },
            { label: 'MÓVEL', data: micros.map(m => m.movel), backgroundColor: '#ea580c', stack: 's' },
            { label: 'Moram na própria microrregião', data: micros.map(m => m.micro ? m.propria : null), type: 'line', borderColor: '#1d4ed8', backgroundColor: '#1d4ed8', showLine: false, pointStyle: 'rectRot', pointRadius: 6, stack: 'p' }] },
          options: { ...empilhado(true), plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { afterBody: itens => { const m = micros[itens[0].dataIndex]; return m.micro ? [`${m.propria} moram na própria micro (${m.pctPropria.toFixed(0)}%)`, `${m.cidadesOrigem} cidade(s) de origem · dist. média ${UI.fmtKm(m.distMedia)}`] : []; } } } } } }));
      }

      const fx = Analise.faixasDistancia(regs);
      graficos.push(new Chart(el.querySelector('#g-dist'), { type: 'bar',
        data: { labels: fx.map(f => f.faixa), datasets: dsLM(fx) }, options: empilhado(false) }));

      if (temAno) {
        const anos = Analise.porAno(regs);
        graficos.push(new Chart(el.querySelector('#g-ano'), { type: 'bar',
          data: { labels: anos.map(a => String(a.ano)), datasets: [
            { label: 'LOCAL', data: anos.map(a => a.local), backgroundColor: '#16a34a', stack: 's', yAxisID: 'y' },
            { label: 'MÓVEL', data: anos.map(a => a.movel), backgroundColor: '#ea580c', stack: 's', yAxisID: 'y' },
            { label: 'Cidades de origem', data: anos.map(a => a.cidadesOrigem), type: 'line', borderColor: '#1d4ed8', backgroundColor: '#1d4ed8', yAxisID: 'y2', tension: .3 },
            { label: 'Origem fora do estado', data: anos.map(a => a.foraDoEstado), type: 'line', borderColor: '#7c3aed', backgroundColor: '#7c3aed', yAxisID: 'y2', tension: .3, borderDash: [6, 4] }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } },
            scales: { x: { stacked: true }, y: { stacked: true, ticks: { precision: 0 }, title: { display: true, text: 'Contratações' } },
              y2: { position: 'right', grid: { drawOnChartArea: false }, ticks: { precision: 0 }, title: { display: true, text: 'Cidades' } } } } }));
      }
    }

    el.querySelector('#resumo-projetos').innerHTML = UI.tabela({
      vazio: 'Nenhum projeto para exibir.',
      colunas: [
        { titulo: 'Projeto', render: p => `<span class="ponto-cor" style="background:${UI.esc(p.projeto.cor)}"></span>${UI.esc(p.projeto.nome)}${p.projeto.ativo ? '' : ' <span class="badge badge-cinza">inativo</span>'}` },
        { titulo: 'Estado', render: p => Store.ufsProjeto(p.projeto).join('/') },
        { titulo: 'Ano', render: p => p.projeto.ano || '<span class="muted">—</span>' },
        { titulo: 'Total', classe: 'direita', render: p => `<b>${UI.fmtNum(p.total)}</b>` },
        { titulo: 'Local', classe: 'direita', render: p => UI.fmtNum(p.local) },
        { titulo: 'Móvel', classe: 'direita', render: p => UI.fmtNum(p.movel) },
        { titulo: 'Cidades de origem', classe: 'direita', render: p => `${UI.fmtNum(p.cidadesOrigem)} <span class="muted small">(${p.ufsOrigem} UF)</span>` },
        { titulo: 'Fora do estado', classe: 'direita', render: p => UI.fmtNum(p.foraDoEstado) },
        { titulo: 'Cidades de atuação', classe: 'direita', render: p => UI.fmtNum(p.cidadesAtuacao) },
        { titulo: 'Todo o estado', classe: 'direita', render: p => UI.fmtNum(p.atuacaoMovel) },
        { titulo: 'Dist. média', classe: 'direita', render: p => UI.fmtKm(p.distMedia) }
      ],
      linhas: Analise.porProjeto(regs, projetos)
    });

    return () => graficos.forEach(g => g.destroy());
  }
};
