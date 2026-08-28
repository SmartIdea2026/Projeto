# Especificação — Integração com fontes externas

**Issue:** #65

## Purpose

Consultar as APIs das fontes integradas, normalizar os resultados em formato único, conter o consumo de requisições e comunicar falhas e resultados parciais.

## ADDED Requirements
### Requirement: Consulta às fontes externas

O sistema SHALL consultar as fontes configuradas por meio de suas respectivas APIs, conforme os parâmetros definidos para a busca.

No MVP a única fonte é o GitHub (ADR-0004).

#### Scenario: Consulta com as fontes disponíveis

- **GIVEN** que as credenciais das fontes configuradas são válidas
- **WHEN** uma busca é realizada sem restrição de fonte
- **THEN** o sistema consulta ambas as fontes
- **AND** apresenta os resultados combinados em uma única lista

#### Scenario: Fonte sem credencial configurada

- **GIVEN** que a credencial de uma fonte não está configurada
- **WHEN** uma busca é realizada
- **THEN** o sistema consulta apenas a fonte com credencial válida
- **AND** informa que a outra fonte não está configurada

### Requirement: Escopo de varredura

O sistema SHALL considerar todos os repositórios da conta GitHub configurada.

#### Scenario: Conta com múltiplos repositórios

- **GIVEN** que a conta GitHub configurada possui vários repositórios
- **WHEN** uma busca é realizada
- **THEN** o sistema considera os documentos de todos os repositórios acessíveis

#### Scenario: Repositório inacessível pela credencial

- **GIVEN** que existe um repositório que a credencial informada não alcança
- **WHEN** uma busca é realizada
- **THEN** os documentos desse repositório não aparecem nos resultados
- **AND** a busca é concluída normalmente para os demais repositórios

### Requirement: Normalização dos resultados

Documentos provenientes de fontes distintas SHALL ser apresentados em formato uniforme, contendo nome, extensão, fonte, data de modificação e link de acesso.

A data de modificação SHALL ser o critério canônico de ordenação temporal. A data de criação SHALL ser exibida somente quando a fonte a fornecer.

#### Scenario: Resultados de fontes diferentes na mesma lista

- **GIVEN** que a busca retornou documentos de fontes distintas
- **WHEN** os resultados são apresentados
- **THEN** todos exibem o mesmo conjunto de informações
- **AND** cada um indica visualmente sua fonte de origem

#### Scenario: Fonte sem data de criação

- **GIVEN** que um documento provém de uma fonte que não informa data de criação
- **WHEN** o resultado é apresentado
- **THEN** o sistema exibe a data de modificação
- **AND** omite a data de criação sem apresentar erro

### Requirement: Limite de requisições das APIs

O sistema SHALL respeitar os limites de requisição das APIs externas, reaproveitando resultados já obtidos sempre que possível.

#### Scenario: Limite de requisições atingido

- **GIVEN** que uma fonte recusou a requisição por limite de uso
- **WHEN** o sistema recebe essa resposta
- **THEN** o sistema informa ao usuário que a fonte está temporariamente indisponível
- **AND** apresenta os resultados que puderem ser obtidos das demais fontes

#### Scenario: Reaproveitamento de resultado anterior

- **GIVEN** que uma consulta equivalente foi realizada recentemente
- **WHEN** o conteúdo da fonte não sofreu alteração desde então
- **THEN** o sistema reutiliza o resultado anterior sem consumir nova requisição

### Requirement: Comunicação de resultado parcial

O sistema SHALL informar o usuário quando o resultado apresentado estiver incompleto ou apoiado em data aproximada, distinguindo esse aviso de uma falha.

A distinção é necessária porque um documento ausente do resultado é indistinguível de um documento inexistente para quem observa a tela.

#### Scenario: Inventário truncado pela API

- **GIVEN** que um repositório é grande demais para ser listado em uma requisição
- **WHEN** a busca é realizada
- **THEN** o sistema apresenta os documentos obtidos
- **AND** informa que parte do repositório ficou de fora, identificando-o

#### Scenario: Repositório inacessível entre outros acessíveis

- **GIVEN** que a credencial não alcança um dos repositórios
- **WHEN** a busca é realizada
- **THEN** o sistema apresenta os documentos dos repositórios acessíveis
- **AND** nomeia o repositório que não pôde ser consultado

#### Scenario: Filtro de período sobre data aproximada

- **GIVEN** que os documentos de uma fonte têm data aproximada
- **WHEN** o usuário aplica um filtro de período
- **THEN** o sistema informa que a data considerada é a de atividade do repositório
- **AND** apresenta o resultado sem interromper a busca

### Requirement: Comunicação de erro ao usuário

O sistema SHALL informar o usuário sempre que ocorrer falha na comunicação com uma API, sem interromper as funcionalidades que não dependem dela.

#### Scenario: Erro de comunicação durante a busca

- **GIVEN** que o usuário realizou uma busca
- **WHEN** ocorre falha na comunicação com uma das APIs
- **THEN** o sistema apresenta uma mensagem identificando a fonte afetada
- **AND** a interface permanece utilizável para nova tentativa
