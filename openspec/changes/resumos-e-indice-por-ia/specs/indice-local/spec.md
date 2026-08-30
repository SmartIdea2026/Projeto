# Especificação — Índice local de documentos

**Issue:** #65

## Purpose

Manter no banco local um registro dos documentos conhecidos das fontes, com seus metadados e a classificação produzida por IA, de modo que a busca responda a partir dele e recorra às APIs externas apenas quando necessário.

## ADDED Requirements

### Requirement: Registro dos documentos no índice

O sistema SHALL manter no banco local um registro dos documentos conhecidos, contendo identificação, nome, caminho, fonte, link de redirecionamento e datas.

O índice NÃO SHALL duplicar o texto dos documentos. O texto é mantido pela capacidade `conteudo-documentos`, que o obtém das fontes e o armazena localmente; o índice o referencia pelo identificador do documento em vez de guardar uma segunda cópia.

#### Scenario: Documento encontrado nas fontes é registrado

- **GIVEN** que uma consulta às fontes retornou documentos
- **WHEN** o resultado é processado
- **THEN** cada documento passa a constar do índice local
- **AND** apenas seus metadados, link e classificação são gravados, sem segunda cópia do texto

#### Scenario: Documento já registrado é atualizado

- **GIVEN** que um documento já consta do índice
- **WHEN** ele é obtido novamente com data de modificação mais recente
- **THEN** o registro é atualizado
- **AND** a classificação anterior é assinalada como desatualizada

### Requirement: Precedência do índice sobre as APIs

A busca SHALL consultar o índice local antes de recorrer às APIs das fontes.

O sistema SHALL recorrer às APIs quando o índice não contiver resultado para a consulta, ou quando o índice estiver defasado em relação à fonte.

O índice NÃO SHALL ser tratado como substituto permanente da fonte: uma busca que responde apenas pelo índice deve deixar claro ao usuário que os dados podem não refletir alterações recentes.

#### Scenario: Consulta atendida pelo índice

- **GIVEN** que o índice contém documentos correspondentes à consulta
- **WHEN** a busca é realizada
- **THEN** o resultado é apresentado a partir do índice
- **AND** nenhuma requisição às APIs é necessária para montá-lo

#### Scenario: Consulta sem correspondência no índice

- **GIVEN** que o índice não contém documento correspondente à consulta
- **WHEN** a busca é realizada
- **THEN** o sistema consulta as APIs das fontes
- **AND** registra no índice os documentos obtidos

#### Scenario: Índice defasado

- **GIVEN** que a fonte registra alterações posteriores à última atualização do índice
- **WHEN** a busca é realizada
- **THEN** o sistema consulta a fonte e atualiza o índice
- **AND** apresenta o resultado atualizado

### Requirement: Classificação dos documentos por IA

O sistema SHALL submeter cada documento indexado à LLM uma única vez, obtendo assunto, tipo de documento e etiquetas, gravados no índice.

As submissões à LLM SHALL ocorrer **em série, uma por vez**, nunca em lote paralelo. A restrição atende ao limite de requisições da chave gratuita e mantém o consumo previsível.

Um documento já classificado NÃO SHALL ser reclassificado enquanto não for alterado na fonte.

#### Scenario: Documento novo é classificado

- **GIVEN** que um documento foi registrado no índice sem classificação
- **WHEN** a indexação o alcança
- **THEN** o sistema submete seu conteúdo à LLM
- **AND** grava assunto, tipo e etiquetas no índice

#### Scenario: Classificação em série

- **GIVEN** que vários documentos aguardam classificação
- **WHEN** a indexação é executada
- **THEN** as submissões à LLM ocorrem uma após a outra
- **AND** nunca há mais de uma submissão em andamento

#### Scenario: Documento já classificado

- **GIVEN** que um documento já possui classificação vigente no índice
- **WHEN** uma nova busca o alcança
- **THEN** a classificação existente é reaproveitada
- **AND** nenhuma submissão à LLM é realizada

### Requirement: Indexação incremental e retomável

A indexação SHALL ser incremental e retomável: interrompê-la NÃO SHALL exigir recomeçar do início, e o que já foi classificado permanece utilizável.

O sistema SHALL informar o progresso da indexação enquanto ela ocorre, e SHALL permitir o uso da busca durante o processo.

Documentos ainda não classificados SHALL continuar encontráveis pelo nome.

#### Scenario: Indexação interrompida e retomada

- **GIVEN** que a indexação classificou parte dos documentos e foi interrompida
- **WHEN** ela é retomada
- **THEN** apenas os documentos ainda não classificados são submetidos
- **AND** os já classificados permanecem disponíveis para busca

#### Scenario: Busca durante a indexação

- **GIVEN** que a indexação está em andamento
- **WHEN** o usuário realiza uma busca
- **THEN** o resultado é apresentado com o que já está indexado
- **AND** o sistema informa que a indexação ainda não terminou

#### Scenario: Limite de requisições da LLM atingido

- **GIVEN** que a cota da chave da LLM foi excedida durante a indexação
- **WHEN** uma submissão é recusada por esse motivo
- **THEN** a indexação é suspensa sem perder o que já foi classificado
- **AND** o sistema informa o motivo da suspensão
