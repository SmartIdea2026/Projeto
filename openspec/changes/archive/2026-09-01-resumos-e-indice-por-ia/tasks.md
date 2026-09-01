# Tarefas — Índice local e classificação por IA

## 1. Índice local

- [x] 1.1 Criar a coleção de índice em `banco/repositorio.ts`, com metadados, classificação e datas — verificar com teste de persistência
- [x] 1.2 Registrar no índice os documentos obtidos das fontes, sem gravar conteúdo — verificar com teste que nenhum campo de conteúdo é persistido
- [x] 1.3 Atualizar o registro e assinalar a classificação como desatualizada quando a fonte informar alteração posterior — verificar com teste

## 2. Classificação, reaproveitando a integração com a LLM

- [x] 2.1 Estender a fila de submissões de concorrência um, já implementada por `painel-de-resumo-por-ia`, para aceitar também pedidos de classificação — verificar com teste que nunca há duas submissões simultâneas, somando resumo e classificação
- [x] 2.2 Dar precedência, na fila, ao trabalho interativo (busca, resumo) sobre a classificação de fundo, reaproveitando `prioridade.ts` — verificar com teste que a classificação cede a vez
- [x] 2.3 Implementar a classificação de um documento, consumindo o texto já armazenado por `ingerir-conteudo-dos-documentos` sem baixá-lo de novo, gravando assunto, tipo e etiquetas no índice — verificar com teste que nenhuma requisição de conteúdo é feita na submissão à LLM
- [x] 2.4 Tratar sem erro os documentos registrados como sem texto, excedentes ou com falha de extração, deixando-os sem classificação e buscáveis pelo nome — verificar com teste dos três estados

## 3. Indexação incremental

- [x] 3.1 Implementar a indexação incremental e retomável, processando apenas o não classificado — verificar com teste que interrompe e retoma
- [x] 3.2 Suspender a indexação sem perda quando a cota for excedida, informando o motivo — verificar com teste
- [x] 3.3 Manter a busca utilizável durante a indexação, informando que ela não terminou — verificar com teste de componente
- [x] 3.4 Apresentar o progresso da indexação na interface — verificar com teste de componente

## 4. Escopo recortado para mudança futura

- [x] 4.1 Recortar do escopo desta mudança a busca por contexto (consultar o índice, casar termo com assunto/tipo/etiquetas, precedência sobre as APIs) — decisão da equipe de entregar o índice e a classificação agora e a integração com a busca depois, à parte. Removido o delta de `busca-documentos` e o requisito "Precedência do índice sobre as APIs" de `indice-local`; proposta e design atualizados para não descrever comportamento não implementado — verificado com `openspec validate --strict`

## 5. Encerramento

- [x] 5.1 Executar a suíte completa, `tsc` nos dois projetos e o build — verificar que tudo passa
- [x] 5.2 Percorrer cada requisito do delta de `indice-local` conferindo a correspondência com o código, cenário a cenário — verificar que nenhum cenário ficou sem contrapartida implementada
- [x] 5.3 Executar `/opsx:archive` para incorporar os deltas às especificações principais
