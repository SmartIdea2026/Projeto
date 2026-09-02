# Proposta — Pilha de documentos relacionados

**Issue:** #89
**Status:** Proposto
**Data:** 02/09/2026

## Why

Encontrar um documento não diz quais outros documentos tratam do mesmo assunto. Quem abre uma ata sobre um tema não tem como saber, sem re-buscar termo a termo, que há três ADRs e um documento de requisitos sobre o mesmo ponto. O resumo por IA já extrai `assuntos` e `tipo` de cada documento; hoje esses rótulos ficam presos ao documento em foco e nunca são cruzados entre documentos.

## Objetivo

A partir do documento em foco no painel de resumo, apresentar uma pilha de até cinco documentos relacionados, ordenados por proximidade de assunto, para que o usuário percorra o acervo seguindo o tema e não só o nome do arquivo.

Esta é a camada de cima de duas mudanças. A classificação por IA de **todo** o acervo — que preenche `assuntos`/`tipo`/etiquetas para documentos ainda não abertos — é a mudança `resumos-e-indice-por-ia`, em desenvolvimento em branch própria, a ser mesclada antes desta. Esta mudança **depende** dela para cobertura total e a reaproveita; onde a classificação ainda não passou, a pilha é parcial e diz isso.

## What Changes

- **Bloco "Documentos relacionados" no painel de resumo**, abaixo do resumo, dos assuntos e dos destaques. Lista até 5 documentos pelo nome. Vazio, informa que não há relacionados; enquanto monta, indica progresso; em falha, informa sem derrubar o resto do painel.
- **Clique num item da pilha troca o foco do painel** para aquele documento — a mesma ação de acionar um resultado da lista. A pilha do novo foco é montada em seguida. A ação de abrir na fonte continua sendo o botão que já existe, separada.
- **Proximidade por sobreposição de rótulos, sem vetores.** A pilha é ordenada por similaridade de Jaccard sobre o conjunto `assuntos` já gravado por documento, com bônus fixo quando o `tipo` coincide e peso maior para assuntos raros no acervo. Um documento só entra com pelo menos dois assuntos em comum, ou um assunto raro. Nada é submetido a serviço externo — o cálculo é local, sobre rótulos que a IA já produziu.
- **Cálculo sob demanda, sem persistência.** A pilha é montada no processo principal a cada troca de foco e refeita quando o resumo do documento em foco é regerado. Não há coleção nova no banco nem cache da pilha.
- **Aviso de cobertura parcial.** Enquanto a classificação por IA não cobriu todo o acervo, a pilha considera apenas os documentos já classificados e acrescenta um `aviso` com a contagem do que ficou de fora — o mesmo canal usado hoje para resultado parcial da busca.
- **NÃO BREAKING.** Nada novo sai da máquina. Nenhum canal passa a devolver texto de documento: a pilha carrega `{ id, nome, fonte, link, score }`, nunca trecho.

## Capabilities

### New Capabilities

- `analise-relacoes`: a montagem, a ordenação e a apresentação da pilha de documentos relacionados ao documento em foco, a partir da sobreposição dos rótulos de classificação, e o aviso de cobertura parcial enquanto o acervo não está todo classificado.

### Modified Capabilities

- `resumos-por-ia`: o requisito **Painel de resumo** passa a incluir o bloco de documentos relacionados e a navegação por clique num item da pilha. O requisito **Alcance do painel por teclado e por leitores de tela** estende-se à pilha: itens alcançáveis por teclado na ordem de leitura visual, troca de foco anunciada.

## Impact

**Confidencialidade — sem mudança de postura.** A pilha é calculada sobre `assuntos` e `tipo` já gravados; nenhuma submissão nova a serviço externo é introduzida. A ADR-0006 não é ampliada. Não há envio de pares de documentos ao Gemini para "explicar" a relação — isso é non-goal.

**Fronteira da ADR-0005.** O canal novo devolve identificação, nome e rótulos em comum — nunca texto. `assuntos` são termos gerados pela IA, não trechos do documento, e o painel já os recebe hoje pelo resumo. `test/seguranca/fronteira-conteudo.test.ts` é estendido para cobrir o canal da pilha.

**ADR nova (ADR-0007).** "Busca vetorial ou por similaridade semântica" é hoje non-goal explícito em `resumos-e-indice-por-ia/design.md`, no design arquivado de `sincronizar-acervo-e-buscar-por-conteudo` e no `GlossarioTecnico.md`. Relacionar documentos por sobreposição de rótulos contorna esse não-objetivo por um caminho diferente — rótulos, não vetores — e merece registro: a ADR-0007 autoriza a relação por rótulos e mantém a similaridade vetorial fora do escopo até decisão própria.

**Dependência de `resumos-e-indice-por-ia`.** A pilha só é tão boa quanto a cobertura da classificação. Enquanto só os documentos abertos manualmente têm `assuntos`, a pilha é rasa e o aviso de cobertura parcial aparece quase sempre. A classificação em massa é pré-requisito para o valor pleno desta mudança, e as duas devem ser sequenciadas.

**NeDB em memória.** Montar a pilha percorre `conteudo_documentos` inteira para reunir os `assuntos` de cada documento e calcular a frequência de cada assunto no acervo. A coleção já é carregada inteira em memória (ADR-0002); para o acervo atual o custo é irrelevante. Quando crescer, a resposta é o índice invertido já previsto em `resumos-e-indice-por-ia`, não um remendo aqui — o mesmo racional das ADR-0002 e 0005.

**Código:**
- `src/main/relacoes/` (novo) — reunião dos rótulos por documento, cálculo de Jaccard + bônus de `tipo` + peso por raridade, limiar e teto. Constantes nomeadas e comentadas.
- `src/main/banco/repositorio.ts` — leitura dos `assuntos`/`tipo` de todos os documentos para o cálculo, no processo principal, sem expô-los como texto.
- `src/compartilhado/canais.ts` e `src/main/ipc.ts` — canal de leitura novo (`relacoes:documento`), devolve a pilha do documento indicado.
- `src/preload/index.ts` — assinatura da ponte para a pilha.
- `src/compartilhado/tipos.ts` — tipo do item da pilha (`{ id, nome, fonte, link, score }`) e do aviso de cobertura parcial.
- `src/renderer/componentes/PainelResumo.tsx` — bloco "Documentos relacionados" com os seis estados de interface.
- `src/renderer/App.tsx` — clique num item da pilha reaproveita a troca de foco já usada pelos resultados.
- `test/seguranca/fronteira-conteudo.test.ts` — cobre o canal novo.

**Documentação a acertar na mesma entrega:**
- `Docs/ADR/ADR-0007-relacoes-entre-documentos-por-rotulos.md` (novo).
- `Docs/Requisitos/GlossarioTecnico.md` — entrada para "documentos relacionados"; a nota "sem busca por similaridade" ganha a ressalva da relação por rótulos.
- `AncorAI/README.md` — o painel apresenta documentos relacionados.
- `AGENTS.md` — seções 6 e 9 refletindo a capacidade nova e a ADR-0007.

**Dependências:** nenhuma biblioteca nova.
