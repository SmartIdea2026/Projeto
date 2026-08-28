# Especificação — Busca de documentos

**Issue:** #65

## MODIFIED Requirements

### Requirement: Nova consulta ao alterar filtros

A alteração de um filtro que restringe **quais** documentos são obtidos — termo, tipo, fonte ou período — SHALL resultar em nova consulta às fontes.

A alteração da ordenação NÃO SHALL disparar consulta: ela reorganiza documentos já obtidos e é tratada separadamente. A distinção existe porque a redação anterior ("qualquer alteração de filtro") contradizia o requisito de ordenação, tornando os dois impossíveis de satisfazer ao mesmo tempo.

#### Scenario: Filtro alterado após a busca

- **GIVEN** que resultados já estão sendo exibidos
- **WHEN** o usuário altera termo, tipo, fonte ou período
- **THEN** o sistema realiza nova consulta às fontes conforme os filtros vigentes
- **AND** apresenta o indicador de carregamento durante a consulta

#### Scenario: Ordenação alterada não dispara consulta

- **GIVEN** que resultados já estão sendo exibidos
- **WHEN** o usuário altera apenas o critério de ordenação
- **THEN** nenhuma consulta às fontes é realizada

### Requirement: Ordenação dos resultados

O sistema SHALL permitir ordenar os resultados por A–Z, Z–A, data crescente e data decrescente.

A alteração da ordenação SHALL reorganizar os resultados já obtidos, sem realizar nova consulta às fontes.

Os critérios de data SHALL usar o nome do documento em ordem A–Z como desempate. Sem desempate, documentos que compartilham a mesma data — situação comum no GitHub, onde a busca deriva a data do repositório e não do arquivo — aparecem em ordem arbitrária e instável entre consultas.

O critério escolhido SHALL permanecer em vigor enquanto o usuário não o alterar, inclusive quando a lista for recarregada por mudança de outro filtro.

#### Scenario: Ordenação alterada

- **GIVEN** que resultados estão sendo exibidos
- **WHEN** o usuário seleciona outro critério de ordenação
- **THEN** os resultados são reorganizados conforme o critério
- **AND** nenhuma nova consulta às fontes é realizada

#### Scenario: Documentos com a mesma data

- **GIVEN** que vários documentos compartilham a mesma data de modificação
- **WHEN** a ordenação por data é aplicada
- **THEN** esses documentos aparecem entre si em ordem alfabética de nome
- **AND** a ordem se mantém estável entre consultas sucessivas

#### Scenario: Ordenação preservada ao recarregar

- **GIVEN** que o usuário escolheu um critério de ordenação
- **WHEN** a lista é recarregada por alteração de outro filtro
- **THEN** o critério escolhido continua aplicado ao novo resultado

## ADDED Requirements

### Requirement: Paginação dos resultados

O sistema SHALL apresentar no máximo 10 documentos por página e SHALL permitir navegar entre as páginas do resultado.

A paginação SHALL incidir sobre o resultado já filtrado e ordenado, de modo que a primeira página contenha sempre os documentos de maior precedência segundo o critério vigente.

#### Scenario: Resultado maior que uma página

- **GIVEN** que a busca retornou mais de 10 documentos
- **WHEN** os resultados são apresentados
- **THEN** o sistema exibe os 10 primeiros segundo a ordenação vigente
- **AND** oferece navegação para as demais páginas

#### Scenario: Resultado cabe em uma página

- **GIVEN** que a busca retornou 10 documentos ou menos
- **WHEN** os resultados são apresentados
- **THEN** todos aparecem
- **AND** a navegação entre páginas não é apresentada

#### Scenario: Nova busca reinicia a navegação

- **GIVEN** que o usuário está em uma página diferente da primeira
- **WHEN** uma nova busca é realizada ou um filtro é alterado
- **THEN** o resultado é apresentado a partir da primeira página

### Requirement: Contador de resultados

O sistema SHALL apresentar a quantidade total de documentos encontrados na consulta vigente, e não a quantidade exibida na página atual.

O contador NÃO SHALL ser apresentado quando não houver consulta ativa — isto é, quando o campo de busca estiver vazio e nenhum filtro estiver aplicado.

#### Scenario: Busca ativa com resultados

- **GIVEN** que o usuário realizou uma busca que retornou 12 documentos
- **WHEN** a primeira página é apresentada com 10 deles
- **THEN** o contador informa 12 documentos encontrados

#### Scenario: Tela inicial sem consulta

- **GIVEN** que o campo de busca está vazio e nenhum filtro está aplicado
- **WHEN** a tela de documentos recentes é apresentada
- **THEN** o contador não é apresentado

#### Scenario: Filtro aplicado sem termo de busca

- **GIVEN** que o campo de busca está vazio mas há um filtro aplicado
- **WHEN** os resultados são apresentados
- **THEN** o contador é apresentado com o total encontrado
