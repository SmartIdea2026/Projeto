# indice-local Specification

## Purpose

Manter no banco local um registro dos documentos conhecidos das fontes, com seus metadados e a classificação por assunto, tipo e etiquetas produzida por IA, obtida em segundo plano sem competir com o trabalho interativo. A busca ainda não consulta este índice — ele existe como base para isso, entregue à parte.

## Requirements

### Requirement: Registro dos documentos no índice

O sistema SHALL manter no banco local um registro dos documentos conhecidos, contendo identificação, nome, caminho, fonte, link de redirecionamento e datas.

O índice NÃO SHALL duplicar o texto dos documentos. O texto é mantido pela capacidade `conteudo-documentos`, que o obtém das fontes e o armazena localmente; o índice o referencia pelo identificador do documento em vez de guardar uma segunda cópia.

A desatualização da classificação SHALL ser detectada pela identidade de conteúdo do documento (`versaoConteudo`), e não pela data de modificação. A data de modificação do GitHub é, para a maioria dos documentos, a do último *push* do repositório — igual para todos os arquivos dele — e usá-la marcaria o acervo inteiro como desatualizado a cada alteração em qualquer arquivo do mesmo repositório. Um documento sem identidade de conteúdo disponível (os que vêm dos commits) NÃO SHALL ter sua classificação marcada como desatualizada por essa via: sem uma versão para comparar, afirmar desatualização seria afirmar algo que o sistema não sabe.

#### Scenario: Documento encontrado nas fontes é registrado

- **GIVEN** que uma consulta às fontes retornou documentos
- **WHEN** o resultado é processado
- **THEN** cada documento passa a constar do índice local
- **AND** apenas seus metadados, link e classificação são gravados, sem segunda cópia do texto

#### Scenario: Documento já registrado é atualizado

- **GIVEN** que um documento já consta do índice, com identidade de conteúdo registrada
- **WHEN** ele é obtido novamente com identidade de conteúdo diferente da registrada
- **THEN** o registro é atualizado
- **AND** a classificação anterior é assinalada como desatualizada

#### Scenario: Documento sem identidade de conteúdo não é assinalado por engano

- **GIVEN** que um documento consta do índice sem identidade de conteúdo (vindo dos commits)
- **WHEN** ele é obtido novamente, com data de modificação diferente
- **THEN** a classificação existente permanece vigente
- **AND** não é assinalada como desatualizada

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
- **WHEN** a indexação o alcança novamente
- **THEN** a classificação existente é reaproveitada
- **AND** nenhuma submissão à LLM é realizada

### Requirement: Indexação incremental e retomável

A indexação SHALL ser incremental e retomável: interrompê-la NÃO SHALL exigir recomeçar do início, e o que já foi classificado permanece gravado.

O sistema SHALL informar, na interface, que a indexação está em andamento, e a busca NÃO SHALL esperar por ela: buscar, filtrar, paginar e abrir documentos seguem funcionando normalmente enquanto a indexação roda de fundo.

#### Scenario: Indexação interrompida e retomada

- **GIVEN** que a indexação classificou parte dos documentos e foi interrompida
- **WHEN** ela é retomada
- **THEN** apenas os documentos ainda não classificados são submetidos
- **AND** os já classificados permanecem gravados no índice

#### Scenario: Busca durante a indexação

- **GIVEN** que a indexação está em andamento
- **WHEN** o usuário realiza uma busca
- **THEN** a busca responde normalmente, sem esperar a indexação terminar
- **AND** a interface informa que a indexação ainda está em andamento

#### Scenario: Limite de requisições da LLM atingido

- **GIVEN** que a cota da chave da LLM foi excedida durante a indexação
- **WHEN** uma submissão é recusada por esse motivo
- **THEN** a indexação é suspensa sem perder o que já foi classificado
- **AND** o sistema informa o motivo da suspensão
