# Especificação — Integração com fontes externas

**Issue:** #65

## MODIFIED Requirements

### Requirement: Normalização dos resultados

Documentos provenientes de fontes distintas SHALL ser apresentados em formato uniforme, contendo nome, extensão, fonte, data de modificação e link de acesso.

A data de modificação SHALL ser o critério canônico de ordenação temporal. A data de criação SHALL ser exibida somente quando a fonte a fornecer.

Cada documento apresentado SHALL identificar a **autoria da última alteração** e a **data real dessa alteração**, quando a fonte permitir obtê-las.

Obter esses dados exige uma consulta adicional por arquivo, custo que motivou o adiamento deste item no MVP. Por isso eles SHALL ser obtidos apenas para os documentos da página apresentada, e NÃO para o resultado inteiro. Enquanto não obtidos, o documento SHALL ser apresentado sem eles, sem bloquear a lista e sem apresentar erro.

Quando a data real substituir a aproximação derivada do repositório, o documento SHALL deixar de ser marcado como de data aproximada.

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

#### Scenario: Autoria obtida para a página apresentada

- **GIVEN** que uma página de resultados está sendo apresentada
- **WHEN** os dados de autoria são obtidos
- **THEN** cada documento da página exibe quem realizou a última alteração e quando
- **AND** documentos fora da página apresentada não geram consulta

#### Scenario: Autoria indisponível

- **GIVEN** que a consulta de autoria de um documento falhou ou ainda não retornou
- **WHEN** o documento é apresentado
- **THEN** ele aparece normalmente, sem os dados de autoria
- **AND** nenhum erro é apresentado ao usuário

#### Scenario: Data real substitui a aproximação

- **GIVEN** que um documento foi apresentado com data aproximada do repositório
- **WHEN** a data real da última alteração é obtida
- **THEN** a data apresentada passa a ser a real
- **AND** o documento deixa de ser assinalado como de data aproximada
