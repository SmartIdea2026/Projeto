# Especificação — Documentos recentes

**Issue:** #65

## MODIFIED Requirements

### Requirement: Critério de recência

Os documentos recentes SHALL ser ordenados pela data de modificação, do mais recente para o mais antigo, usando o nome em ordem A–Z como desempate.

Somente documentos dos tipos aceitos pelo sistema SHALL ser apresentados.

Esta ordenação é o **padrão inicial**, não uma imposição: quando o usuário escolher outro critério, a lista de recentes SHALL respeitá-lo. A redação anterior descrevia apenas o padrão, e a implementação passou a fixar a ordenação por data no código, descartando silenciosamente a escolha do usuário a cada recarga da lista.

#### Scenario: Ordenação da lista de recentes

- **GIVEN** que documentos recentes foram obtidos das fontes configuradas
- **AND** que o usuário não alterou o critério de ordenação
- **WHEN** a lista é apresentada
- **THEN** os documentos aparecem do mais recentemente modificado para o mais antigo
- **AND** documentos com a mesma data aparecem entre si em ordem alfabética
- **AND** documentos de tipos não suportados não são apresentados

#### Scenario: Critério escolhido pelo usuário na tela inicial

- **GIVEN** que a lista de recentes está sendo apresentada
- **WHEN** o usuário escolhe ordenar por nome A–Z
- **THEN** a lista é reorganizada segundo o critério escolhido

#### Scenario: Critério preservado ao recarregar os recentes

- **GIVEN** que o usuário escolheu um critério de ordenação na tela inicial
- **WHEN** a lista de recentes é recarregada por alteração de tipo ou período
- **THEN** o critério escolhido continua aplicado
- **AND** a ordenação por data não é reimposta
