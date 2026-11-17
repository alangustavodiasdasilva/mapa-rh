# Melhorias pendentes (revisão de 17/11/2026: 2 agentes de fluxo + 2 de design)

Já feito (v119–121): avisos agrupados, menus fecham com Esc/clique fora, ficha só com as etapas no topo + "Avançar/Desfazer",
Cancelar avisa alteração não salva, anotação digitada salva junto, remarcação e resultado da entrevista viram anotação,
resultado Aprovado/Reprovado já leva ao próximo passo, motivo padronizado em "Não segue" (sem apagar a observação),
vaga de outro RH não trava a admissão, excluir vaga com candidatos bloqueado, cancelar vaga avisa os candidatos,
Início com pedido x admitido por local/móvel e respeitando filtros, agenda com o que pede ação no topo, ajustes de contraste/hover/teclado.

## Lote 3 — banco (admissão completa) — FEITO em v123 (migração admissao-completa.sql)
- [x] Admitir = uma operação no banco (maparh_admitir): admissão + contratação juntas; desfazer pede motivo e tira as duas (maparh_desfazer_admissao).
- [x] Contratação da admissão (id adm-…) guarda preadmissaoId, vaga, cargo, distrito, data, RH; ninguém altera pela sincronização; sem Editar/Excluir na tela.
- [x] Cargo comparado sem acento no banco (igual à tela).
- [x] Documento "Não se aplica" (dispensado) vale como concluído; "Marcar todos como entregues" só para admin.
- [x] Admitido: chegada, hora, grupo e observação editáveis ("Salvar chegada e observação").
- [x] ASO "apto" exige data ≤ hoje (tela e banco).
- [x] Reimportar a planilha não traz de volta quem já saiu (reprovado/desistiu).
- [x] Analista enxerga a vaga em que tem candidato.
- [ ] Colaborador (vínculo) na admissão: o módulo Colaboradores não está instalado no banco — fazer quando ele for ligado.
- [ ] Avisar/bloquear admissão de quem já está admitido em outro projeto; readmissão no mesmo projeto depois de desligado.
- [ ] Ler a data da candidatura (carimbo do Forms) na importação.

## Lote 4 — fluxo do RH — FEITO em v128 (menos os itens abertos abaixo)
- [x] "Entrevistar →" abre o agendamento (data/hora/formato/local) + mensagem pronta no WhatsApp; "Remarcar" para quem faltou (conta as faltas).
- [x] Cartão da entrevista: Agendar / Marcar resultado / Remarcar / Documentação → conforme o resultado.
- [x] Agenda: conflito de horário do mesmo RH; campo Local; faixa "Hoje" no topo de Candidatos.
- [x] Triagem: WhatsApp e "há N dias" no cartão; "Liguei e não atendeu" no menu (conta as tentativas).
- [x] Alerta no cartão: vaga cancelada / já completa, RH inativo, Documentação parada há 7+ dias.
- [x] Vaga aprovada que o gestor aumenta volta para aprovação ("de X para Y"); aprovar pede o RH responsável; "aguardando há N dias".
- [x] Trocar o RH da vaga oferece passar os candidatos em andamento; responsável inativo aparece na vaga.
- [x] Anúncio: campo "Como se candidatar" (link/WhatsApp).
- [x] Desfazer admissão pede motivo.
- [ ] Direcionar: anotação automática, selo "novo", dividir pela menor carga.
- [ ] Limite LOCAL/MÓVEL (km) no projeto, não no navegador.
- [ ] Chegada confirmada (chegou/faltou) e chegadas vencidas no Início.

## Mensagens do WhatsApp — FEITO em v133 (migração mensagens-rh.sql)
- [x] Cada RH tem os modelos dele (Candidatos → Minhas mensagens): triagem, entrevista, lembrete, documentos, chegada, não seguiu; marcadores {nome}, {cargo}, {data}…
- [x] Ícone do WhatsApp no cartão e botão na ficha abrem a mensagem pronta (modelo pela etapa); o envio fica no histórico.
- [ ] (futuro) Envio automático pelo WhatsApp Business oficial (Meta): número da empresa, modelos aprovados, custo por conversa.

## Correções de 17/11 (v136)
- [x] Quadro: nenhum botão dos cartões funcionava desde a v134 (o seletor de coluna do celular pegava qualquer clique).
- [x] Triagem: botão verde "1º contato" abre o WhatsApp com a mensagem de primeiro contato; depois de enviada, o cartão mostra "1º contato dd/mm" e libera "Entrevistar". Sem telefone ou "Já falei com a pessoa" (menu ⋯) segue direto.
- [x] Lista: telefone abre a mensagem certa (antes abria o WhatsApp vazio); coluna Contato/Entrevista com a situação; Entrevista mostra Agendar / Resultado / Remarcar / Documentação conforme o caso (antes era "Documentação →" para todos).
- [x] Mensagem da entrevista marcada entra no histórico.
- [x] (v137) Contratações virou a lista das pessoas admitidas (nome, cargo, origem → onde trabalha, admitido em, chegada, RH; "Abrir" leva à pessoa em Candidatos; exportar planilha). Saiu o lançamento manual só com números.
- [x] 55 contratações antigas só com números (sem pessoa) foram retiradas do banco em 17/11 (marcadas como removidas; cópia em maparh_priv.backup_registros_20261117).

## Atualização na hora (v138, migração tempo-real.sql)
- [x] O banco avisa na hora (Supabase Realtime) quando muda vaga/cadastro ou candidato; busca de reserva a cada 15 s.
- [x] Telas atualizam só os dados (sem "Carregando…", sem voltar ao topo): Candidatos, Vagas, Contratações; Início mostra o último resultado e confere em segundo plano.
- [x] Vagas: saíram os cartões que repetiam as abas (em andamento / aguardando aprovação); aba "Aguardando aprovação" fica laranja para o admin quando há pedido.
- [ ] Vaga de TESTE no banco (teste-vaga-1, "TESTE - AUXILIAR DE CLASSIFICAÇÃO") para o Alan aprovar/recusar; apagar depois do teste.

## Lote 5 — design — FEITO em v135: Lista compacta, Planilha ▾, filtros das Vagas, Início (bloco principal), Relatórios sem rolagem, Mapa (zoom livre), barra lateral, celular (Quadro uma etapa por vez, Por RH com rótulos). Ficaram (menores):
- [ ] Lista de Candidatos em 1366px (colunas espremidas) — medir pelo cartão, não pela janela.
- [ ] Barra de filtros de Candidatos: "Planilha ▾" (importar/exportar), busca no mesmo padrão da Vagas.
- [ ] Vagas: cartões "atrasadas"/"sem divulgação" filtram de verdade; contagem por etapa leva à etapa certa.
- [ ] Celular: Quadro uma coluna por vez; Por RH e Vagas com rótulos; filtros do topo numa gaveta.
- [ ] Início: bloco principal "X de Y contratados (Z%)", esqueleto de carregando, Pendências da diretoria (prontos parados, entrevistas sem resultado, chegadas com pendência).
- [ ] Relatórios e tabelas sem rolagem lateral em 1366; Contratações editando no formulário de cima.
- [ ] Mapa: controles agrupados, zoom não coberto, avisos de rodapé num lugar só.
- [ ] Padrão único de ações nas linhas (Editar / Excluir), sidebar com contraste melhor, status da nuvem visível.
- [ ] Limpar CSS morto/duplicado (vagas.css, candidatos.css).
