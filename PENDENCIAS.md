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
- [x] (v139) Sem "Carregando…" ao trocar de tela: Candidatos, Contratações e Início abrem com a última lista guardada e trocam os dados por trás; os candidatos são buscados já no login; gráficos sem animação ao redesenhar.
- [x] Vaga de TESTE (teste-vaga-1) já foi excluída no sistema.

## Quem fez o quê (v140, migração responsaveis-e-historico.sql)
- [x] Banco grava quem fez a última atualização do candidato (atualizado_por) e anota sozinho: cadastro, mudança de etapa, direcionamento, admissão, desfazer, retomada.
- [x] Cartão: cor por situação (cinza sem contato, azul contatado/entrevista marcada, amarelo tentou sem resposta/faltou, verde aprovado/pronto) e foto de quem mexeu por último.
- [x] Ficha: histórico embaixo, em todas as abas, com foto, nome e hora.
- [x] Vaga com vários RHs responsáveis (o primeiro é o principal); todos veem a vaga e todos os candidatos dela (regra no banco).
- [x] Mapa: quadro da cidade mostra a pessoa (nome, cargo, entrou, chegada, foto do RH), clique abre em Candidatos; sem "pessoa(s)" e selo MÓVEL sem quebrar.
- [x] Presença: foto de quem está olhando a mesma cidade no mapa ou a mesma ficha de candidato (no cartão também).
- [x] (v141) A minha foto também ("Você e JAO estão olhando") e as fotos ficam em cima da cidade no mapa (borda azul = eu, verde = outros).
- [ ] Simulação de 17/11 no banco: 3 candidatos "TESTE - …" na vaga AUDITOR de Sarandi (JAO); o Pedro foi admitido (contratação adm-a1aa83b7-…, CPF de exemplo 529.982.247-25). Apagar depois que o Alan olhar.

## Feito em v142 (ainda não publicado)
- [x] Histórico mais completo pelo banco: "Admitido como AUDITOR · Sarandi · móvel" com quem admitiu, entrevista marcada, ASO, treinamento, documentos (N de M), chegada (migração historico-completo.sql).
- [x] Contratações: coluna "Admitido por" (foto + nome) e na planilha exportada.
- [x] Vagas: cartão mostra onde foi divulgada (SINE, Vagas.com…; quem e quando no passar do mouse).
- [x] Sessão: se outra aba sai ou entra com outro usuário, esta avisa e recarrega (antes ficava em "falha no sincronismo"); token vencido tenta renovar.

## Avaliação de 17/11 (3 agentes: RH, gestor, dados/segurança) — a fazer, por lote
### Lote A — não perder nem falsificar dado (urgente) — FEITO (migrações lote-campos-e-versao.sql, lote-a-travas.sql; testes/regras-lote-a.sql 12/12)
- [x] Ficha aberta apaga o que outro RH mudou (salvar manda tudo, sem conferir versão): mandar `atualizado_em` lido e recusar se mudou; salvar só o que mudou.
- [x] Sincronização de vagas/projetos: último que grava vence; exclusão offline apaga vaga editada depois. Mesma trava de versão.
- [x] Admitir/desfazer dá para contornar com alteração direta (registro_id gravável, travar_admitido aceita admitido→em andamento): só pelas funções; validar p_reg em apagar_registro_da_admissao.
- [x] Histórico pode ser apagado/forjado (anotacoes é coluna alterável): só acrescentar; exclusão de candidato lógica.
- [x] Regras da vaga no banco: aprovar só admin; não excluir vaga com candidatos; não admitir além do pedido (por distrito/tipo).
- [ ] "Pedido preenchido" com número diferente em cada tela; vaga com tipo trocado vira "Preenchida": um cálculo só por distrito/tipo.
### Lote B — dia a dia do RH
- [ ] Triagem: "sem resposta há N dias" + botão "Cobrar de novo"; na faixa Hoje "N aguardando resposta"; sugerir "Não segue: não respondeu".
- [ ] Mensagem em lote: na seleção da Lista, "Mandar mensagem" passo a passo (abre WhatsApp e vai para o próximo).
- [ ] Entrevista: "Confirmou?" sim/não; lembrete da véspera na faixa Hoje; não confirmados em amarelo na Agenda.
- [ ] Quem sai: oferecer avisar pelo WhatsApp (modelo "não seguiu"); lote "Não seguem" pede motivo e anota; histórico registra a saída.
- [ ] Ordenar Triagem/Entrevista pela urgência da vaga (atrasada, prioridade, prazo) e selo "vaga até dd/mm"; alerta chegada depois do prazo da vaga.
- [ ] Documentação: "sem movimento há N dias" (pela última alteração); ASO/treinamento agendados com data e local; "ASO hoje / sem resultado" na faixa Hoje.
- [ ] Avançar em lote para Documentação com enquadramento em lote (distrito sugerido, local/móvel).
### Lote C — gestor / diretoria
- [ ] Previsão por vaga: "No prazo / Em risco / Não fecha" pelo funil e pela taxa de aproveitamento; quadro "Vagas em risco" no Início.
- [ ] Tempo de contratação único (da aprovação da vaga à admissão, mediana) em Início, Vagas e relatório; e "até chegar no campo".
- [ ] Gargalo por etapa com idade (0-3 / 4-7 / 8+ dias) e Por RH com aproveitamento e "parado há" no Início.
- [ ] Motivo de saída e datas de cada etapa como campo: "Saídas por motivo" e tempo médio por etapa.
- [ ] "Copiar resumo para WhatsApp" no Início; depois, e-mail diário automático para admin/gestor quando houver algo vermelho.
- [ ] Relatório "Situação das vagas" exportável (XLSX/PDF); Relação completa com nome, cargo, admitido em, chegada.
- [ ] Distritos: falta, em processo, cobertura do funil; camada "Falta contratar" no mapa.
### Lote D — segurança, LGPD e backup — FEITO (lote-d-lgpd-presenca.sql; backup completo e limpeza LGPD em Sistema → Backup; restaurar desligado com o banco central; esquema em supabase/esquema-atual.sql). Fica: backup automático fora do Supabase (precisa de um lugar externo) e readmissão depois de desligado (módulo Colaboradores).
- [x] Versionar o esquema do banco no repositório (dump) e ligar backup automático fora do Supabase; "Restaurar" com a nuvem ligada não pode apagar o que é novo.
- [x] LGPD: anonimizar pessoa (pedido do titular) e prazo para dados de quem não foi contratado; exportação de Contratações registrada na auditoria e CPF mascarado.
- [x] Admissão da mesma pessoa em dois projetos; readmissão depois de desligado.
- [x] Testes das regras críticas num script único (admitir/desfazer, anotações, vários RHs, limite da vaga, conflito de edição).
- [x] Canal de presença privado (hoje quem tem a chave pública vê logins e ids abertos).
- [x] Apagar a simulação "TESTE - …" (pelo desfazer, para a contratação sair junto).

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
