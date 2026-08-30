# Especificação — Integração com as fontes (delta)

**Issue:** #65

## MODIFIED Requirements

### Requirement: Consulta às fontes externas

O sistema SHALL consultar as fontes configuradas por meio de suas respectivas APIs, conforme os parâmetros definidos para a busca.

No MVP a única fonte é o GitHub (ADR-0004).

Cada fonte SHALL oferecer, além do inventário de metadados, a obtenção do conteúdo de um documento nela identificado.

A obtenção do conteúdo SHALL ser uma operação distinta do inventário, acionada por documento e apenas quando o sistema precisar do conteúdo. Uma busca NÃO SHALL obter o conteúdo dos documentos que apresenta.

Falhar ao obter o conteúdo de um documento NÃO SHALL invalidar o inventário nem impedir que ele seja apresentado nos resultados.

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

#### Scenario: Conteúdo de um documento é solicitado à fonte

- **GIVEN** que um documento consta do inventário de uma fonte
- **WHEN** o sistema solicita o conteúdo desse documento
- **THEN** a fonte entrega o conteúdo do arquivo correspondente

#### Scenario: Busca não obtém conteúdo

- **GIVEN** que uma busca retornou documentos
- **WHEN** os resultados são montados
- **THEN** nenhuma requisição de conteúdo é feita para montá-los

#### Scenario: Falha ao obter conteúdo não afeta o inventário

- **GIVEN** que o inventário de uma fonte foi obtido com sucesso
- **WHEN** a fonte falha ao entregar o conteúdo de um dos documentos
- **THEN** o inventário permanece válido
- **AND** o documento continua sendo apresentado nos resultados
