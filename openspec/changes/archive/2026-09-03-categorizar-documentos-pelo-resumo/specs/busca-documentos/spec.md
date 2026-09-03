## ADDED Requirements

### Requirement: Filtro por categoria (a partir do resumo por IA)

O sistema SHALL permitir restringir os resultados por categoria, onde categoria é o rótulo de vocabulário fechado atribuído a um documento pela capacidade `resumos-por-ia`.

Este filtro é distinto do requisito **Filtro por tipo de documento**, que filtra por extensão de arquivo — os dois convivem como filtros independentes.

O controle SHALL ser um dropdown de seleção única, e SHALL ser populado dinamicamente com as categorias já atribuídas a algum documento do acervo.

Documento sem categoria atribuída — ainda não resumido, ou resumido sem correspondência confiável a nenhum rótulo — NÃO SHALL aparecer quando um filtro de categoria estiver aplicado.

O sistema SHALL permitir limpar o filtro de categoria e retornar à listagem completa.

#### Scenario: Categoria selecionada filtra pela categoria correspondente

- **GIVEN** que um documento tem a categoria "Ata"
- **WHEN** o usuário seleciona a categoria "Ata" no dropdown
- **THEN** o documento aparece entre os resultados

#### Scenario: Dropdown reflete novas categorias

- **GIVEN** que um documento recebe uma categoria inédita ao ser resumido
- **WHEN** o usuário abre o dropdown de categorias novamente
- **THEN** a nova categoria aparece como opção disponível

#### Scenario: Documento sem categoria não aparece com filtro aplicado

- **GIVEN** que um documento ainda não foi resumido, ou foi resumido sem categoria atribuída
- **AND** que um filtro de categoria está aplicado
- **WHEN** os resultados são apresentados
- **THEN** esse documento não aparece entre eles

#### Scenario: Limpar o filtro de categoria

- **GIVEN** que um filtro de categoria está aplicado
- **WHEN** o usuário o limpa
- **THEN** o sistema volta a apresentar a listagem completa, sujeita aos demais filtros vigentes

## MODIFIED Requirements

### Requirement: Nova consulta ao alterar filtros

A alteração de um filtro que restringe **quais** documentos são obtidos — termo, tipo, categoria, fonte ou período — SHALL resultar em nova consulta às fontes.

A alteração da ordenação NÃO SHALL disparar consulta: ela reorganiza documentos já obtidos e é tratada separadamente. A distinção existe porque a redação anterior ("qualquer alteração de filtro") contradizia o requisito de ordenação, tornando os dois impossíveis de satisfazer ao mesmo tempo.

#### Scenario: Filtro alterado após a busca

- **GIVEN** que resultados já estão sendo exibidos
- **WHEN** o usuário altera termo, tipo, categoria, fonte ou período
- **THEN** o sistema realiza nova consulta às fontes conforme os filtros vigentes
- **AND** apresenta o indicador de carregamento durante a consulta

#### Scenario: Ordenação alterada não dispara consulta

- **GIVEN** que resultados já estão sendo exibidos
- **WHEN** o usuário altera apenas o critério de ordenação
- **THEN** nenhuma consulta às fontes é realizada
