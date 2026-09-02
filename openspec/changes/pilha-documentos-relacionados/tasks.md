# Tarefas — Pilha de documentos relacionados

## 1. Leitura dos rótulos no processo principal

- [x] 1.1 Acrescentar a `main/banco/repositorio.ts` uma leitura em lote dos rótulos de classificação de todos os documentos com conteúdo vigente — `{ id, nome, tipo, assuntos }` por documento, sem `texto` nem `resumo` — verificar com teste de leitura que o retorno não carrega texto de documento
- [x] 1.2 Expor a contagem de documentos do inventário (`acervo_documentos`) e a de documentos já classificados, para o cálculo de cobertura parcial — verificar com teste que as duas contagens batem com o estado do banco

## 2. Cálculo da pilha

- [x] 2.1 Criar `main/relacoes/` com as constantes nomeadas e comentadas: `BONUS_MESMO_TIPO`, `MIN_ASSUNTOS_EM_COMUM = 2`, `PESO_ASSUNTO_RARO`, `TETO_PILHA = 5` — cada uma com o racional e a faixa esperada no comentário
- [x] 2.2 Implementar a tabela de frequência dos assuntos no acervo e o peso inverso à frequência (`log(total / comOAssunto)`) — verificar com teste que um assunto presente em quase todo documento pesa perto de zero e um assunto raro pesa alto
- [x] 2.3 Implementar `pilhaDe(documentoId)`: Jaccard ponderado sobre `assuntos` (interseção ponderada ÷ união ponderada) + `BONUS_MESMO_TIPO` quando o `tipo` coincide e ambos não são vazios; `destaques` não entram — verificar com teste do cálculo em casos montados
- [x] 2.4 Aplicar o limiar (`MIN_ASSUNTOS_EM_COMUM` assuntos em comum **ou** ao menos um com peso acima de `PESO_ASSUNTO_RARO`), ordenar por proximidade decrescente, cortar em `TETO_PILHA`, excluir o próprio documento em foco — verificar com teste que um candidato com um só assunto comum fica de fora e que o foco nunca aparece na própria pilha
- [x] 2.5 Devolver `aviso` de cobertura parcial com a contagem de documentos ainda sem classificação quando houver algum; nenhum aviso quando o inventário está todo classificado — verificar com teste dos dois casos
- [x] 2.6 Documento em foco sem classificação: `pilhaDe` devolve pilha vazia e a marca de "sem classificação", sem erro — verificar com teste

## 3. Canal IPC

- [x] 3.1 Registrar o canal de leitura `relacoes:documento` (nome em `compartilhado/canais.ts`, handler em `main/ipc.ts`, assinatura na ponte em `preload/index.ts`) que recebe o `Documento` em foco (usa só o `id`) e devolve `{ pilha, semClassificacao, aviso? }` — verificar com teste do handler
- [x] 3.2 Definir em `compartilhado/tipos.ts` `ItemRelacionado = { id, nome, fonte, link, score: number }` e `RespostaRelacionados` (com o aviso de cobertura parcial) — verificar com `tsc --noEmit` nos dois projetos. Nota: `link` e `fonte` acrescentados ao shape do design para a navegação por um item alcançar um documento fora da página; continuam identificação, não conteúdo (ADR-0005).
- [x] 3.3 Estender `test/seguranca/fronteira-conteudo.test.ts` para cobrir `relacoes:documento` — verificar que a resposta nunca carrega texto de documento nem trecho

## 4. Bloco no painel de resumo

- [x] 4.1 Acrescentar a `renderer/componentes/PainelResumo.tsx` o bloco "Documentos relacionados", abaixo de resumo/assuntos/destaques, listando cada documento pelo nome — verificar com teste de componente do estado default
- [x] 4.2 Cobrir os estados do bloco: hover e focus sobre um item, loading ("montando a pilha…"), empty ("nenhum documento relacionado encontrado"), error (falha na montagem) — verificar com teste de componente de cada estado
- [x] 4.3 Garantir que uma falha ao montar a pilha não impede a apresentação do resumo, assuntos, destaques e ação de abrir — verificar com teste de componente
- [x] 4.4 Documento em foco sem classificação: o bloco informa que não há pilha enquanto o documento não tiver resumo — verificar com teste de componente

## 5. Integração com o foco do painel

- [x] 5.1 Em `renderer/App.tsx`, pedir a pilha ao canal `relacoes:documento` quando o foco do painel muda e quando uma regeração de resumo conclui; descartar o resultado de um foco já trocado (disciplina de `focoVigente`) — verificar com teste que trocar de foco durante a montagem não deixa a pilha do documento anterior no painel
- [x] 5.2 Acionar um item da pilha entra na mesma rotina de troca de foco de acionar um `Cartao`: o painel passa a apresentar aquele documento (resumo + pilha), a lista de resultados não muda — verificar com teste de componente que a lista permanece inalterada
- [x] 5.3 Apresentar o `aviso` de cobertura parcial pelo mesmo caminho dos demais avisos de resultado parcial — verificar com teste de componente

## 6. Acessibilidade

- [x] 6.1 Tornar cada item da pilha alcançável por teclado, na ordem de leitura visual, com foco assinalado — verificar com o teste de tabulação existente, estendido
- [x] 6.2 Anunciar a troca de foco por um item da pilha pelo mesmo `aria-live` que já anuncia a troca de conteúdo do painel; o item em foco assinalado por borda, não só por cor — verificar com teste de componente e conferindo o contraste do item

## 7. ADR e documentação

- [x] 7.1 Escrever `Docs/ADR/ADR-0007-relacoes-entre-documentos-por-rotulos.md` (Status: Proposto): permitir relação por sobreposição de rótulos com cálculo local e sem envio externo; manter similaridade vetorial/embeddings fora até ADR própria; citar nominalmente a cláusula de non-goal em `resumos-e-indice-por-ia/design.md`, no design arquivado de `sincronizar-acervo-e-buscar-por-conteudo` e no `GlossarioTecnico.md` — verificar que as seções obrigatórias da ADR estão preenchidas
- [x] 7.2 Atualizar `AGENTS.md`: seção 4 (ADR-0007 na lista de vigentes), seção 6 (a capacidade de documentos relacionados no painel), seção 9 (o que desta frente fica adiado e o que não) — verificar coerência com o comportamento entregue
- [x] 7.3 Atualizar `AncorAI/README.md`: o painel apresenta uma pilha de documentos relacionados ao documento em foco — verificar que o README descreve o comportamento real
- [x] 7.4 Acrescentar ao `Docs/Requisitos/GlossarioTecnico.md` a entrada "documentos relacionados" e a ressalva na nota "sem busca por similaridade" (relação por rótulos é permitida; vetorial não) — verificar que cada termo novo usado nos artefatos tem entrada

## 8. Encerramento

- [x] 8.1 Executar a suíte completa, `npx tsc --noEmit` nos dois projetos e `npx electron-vite build` — verificar que tudo passa
- [x] 8.2 Percorrer cada requisito dos deltas `analise-relacoes` e `resumos-por-ia`, cenário a cenário, conferindo a contrapartida no código — verificar que nenhum cenário ficou sem cobertura
- [ ] 8.3 Executar `/opsx:archive` para incorporar os deltas às especificações principais

## 9. Ajuste pós-implementação: pilha só com nomes

Na revisão da interface, os assuntos em comum apresentados como etiquetas abaixo de cada nome foram retirados — a pilha lista só o nome do documento. Specs (`analise-relacoes`), `design.md`, `proposal.md`, a ADR-0007, o `AGENTS.md` e o `GlossarioTecnico.md` atualizados.

- [x] 9.1 Remover `assuntosEmComum` de `ItemRelacionado` (`compartilhado/tipos.ts`) e da montagem em `main/relacoes/pilha.ts` — o cálculo de `emComum` permanece local, para o limiar e a ordenação — verificar `tsc --noEmit`
- [x] 9.2 Remover do `PainelResumo.tsx` a renderização das etiquetas e do `resumo.css` as regras `.painel__pilha-assuntos` e a `.painel__etiqueta` duplicada (a original, da faixa "Resumo por IA", permanece) — verificar com teste de componente que a pilha lista só nomes
- [x] 9.3 Ajustar `fronteira-conteudo.test.ts`, `painel-resumo.test.tsx`, `tabulacao.test.tsx` e `relacoes/pilha.test.ts` ao novo shape — verificar suíte completa, `tsc` e `electron-vite build`
