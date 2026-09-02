# Tarefas — Índice local e classificação por IA

## 1. Índice local

- [ ] 1.1 Criar a coleção de índice em `banco/repositorio.ts`, com metadados, classificação e datas — verificar com teste de persistência
- [ ] 1.2 Registrar no índice os documentos obtidos das fontes, sem gravar conteúdo — verificar com teste que nenhum campo de conteúdo é persistido
- [ ] 1.3 Atualizar o registro e assinalar a classificação como desatualizada quando a fonte informar alteração posterior — verificar com teste
- [ ] 1.4 Fazer a busca consultar o índice antes das APIs, recorrendo a elas quando não houver correspondência ou o índice estiver defasado — verificar com teste que uma consulta atendida pelo índice não gera requisição
- [ ] 1.5 Emitir aviso de possível defasagem quando o resultado vier apenas do índice, reaproveitando o canal de avisos existente — verificar com teste

## 2. Classificação, reaproveitando a integração com a LLM

- [ ] 2.1 Estender a fila de submissões de concorrência um, já implementada por `painel-de-resumo-por-ia`, para aceitar também pedidos de classificação — verificar com teste que nunca há duas submissões simultâneas, somando resumo e classificação
- [ ] 2.2 Dar precedência, na fila, ao trabalho interativo (busca, resumo) sobre a classificação de fundo, reaproveitando `prioridade.ts` — verificar com teste que a classificação cede a vez
- [ ] 2.3 Implementar a classificação de um documento, consumindo o texto já armazenado por `ingerir-conteudo-dos-documentos` sem baixá-lo de novo, gravando assunto, tipo e etiquetas no índice — verificar com teste que nenhuma requisição de conteúdo é feita na submissão à LLM
- [ ] 2.4 Tratar sem erro os documentos registrados como sem texto, excedentes ou com falha de extração, deixando-os sem classificação e buscáveis pelo nome — verificar com teste dos três estados

## 3. Indexação incremental e busca por contexto

- [ ] 3.1 Implementar a indexação incremental e retomável, processando apenas o não classificado — verificar com teste que interrompe e retoma
- [ ] 3.2 Suspender a indexação sem perda quando a cota for excedida, informando o motivo — verificar com teste
- [ ] 3.3 Manter a busca utilizável durante a indexação, informando que ela não terminou — verificar com teste de componente
- [ ] 3.4 Estender a correspondência da busca a assunto, tipo e etiquetas, preservando a busca por nome dos não classificados — verificar com teste dos dois casos
- [ ] 3.5 Apresentar o progresso da indexação na interface — verificar com teste de componente

## 4. Encerramento

- [ ] 4.1 Executar a suíte completa, `tsc` nos dois projetos e o build — verificar que tudo passa
- [ ] 4.2 Percorrer cada requisito dos deltas de `indice-local` e `busca-documentos` conferindo a correspondência com o código, cenário a cenário — verificar que nenhum cenário ficou sem contrapartida implementada
- [ ] 4.3 Executar `/opsx:archive` para incorporar os deltas às especificações principais
