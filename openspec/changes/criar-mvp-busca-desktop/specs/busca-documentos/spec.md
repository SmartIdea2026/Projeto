# Especificação — Busca de documentos

**Issue:** #65

## Requirement: Busca por termo

O sistema SHALL permitir que o usuário informe um termo e retorne os documentos cujo nome corresponda a esse termo.

A comparação SHALL considerar apenas o nome do arquivo. O conteúdo interno dos documentos NÃO SHALL ser considerado nesta versão.

#### Scenario: Termo com correspondência

- **GIVEN** que existem documentos cujo nome contém o termo informado
- **WHEN** o usuário informa o termo e confirma a busca
- **THEN** o sistema apresenta os documentos correspondentes
- **AND** cada resultado exibe nome completo, extensão, data e fonte

#### Scenario: Termo sem correspondência

- **GIVEN** que nenhum documento possui nome correspondente ao termo
- **WHEN** a busca é concluída
- **THEN** o sistema informa que nenhum documento foi encontrado

#### Scenario: Busca em andamento

- **GIVEN** que o usuário confirmou uma busca
- **WHEN** o sistema aguarda a resposta das fontes
- **THEN** o sistema apresenta um indicador de carregamento
- **AND** o indicador é removido quando os resultados são apresentados

## Requirement: Filtro por tipo de documento

O sistema SHALL permitir restringir os resultados por tipo de documento, determinado pela extensão do arquivo.

Os tipos aceitos SHALL ser: `.md`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.pdf`, `.epub` e `.txt`. Arquivos de código-fonte e de configuração NÃO SHALL ser retornados.

#### Scenario: Filtro de tipo aplicado

- **GIVEN** que existem documentos de diferentes extensões
- **WHEN** o usuário seleciona uma extensão específica
- **THEN** apenas documentos daquela extensão são apresentados

#### Scenario: Arquivo de tipo não suportado

- **GIVEN** que uma fonte contém arquivos de código-fonte cujo nome corresponde ao termo
- **WHEN** a busca é realizada
- **THEN** esses arquivos não aparecem entre os resultados

## Requirement: Filtro por fonte

O sistema SHALL permitir selecionar GitHub, Google Drive ou ambos como fonte da busca.

#### Scenario: Nenhuma fonte selecionada

- **GIVEN** que o usuário não selecionou nenhuma fonte
- **WHEN** a busca é realizada
- **THEN** o sistema consulta GitHub e Google Drive

#### Scenario: Uma única fonte selecionada

- **GIVEN** que o usuário selecionou apenas uma fonte
- **WHEN** a busca é realizada
- **THEN** o sistema consulta exclusivamente a fonte selecionada

## Requirement: Filtro por período

O sistema SHALL permitir definir um período por meio de data inicial e data final, restringindo os resultados aos documentos cuja data esteja dentro do intervalo.

#### Scenario: Período informado

- **GIVEN** que o usuário definiu data inicial e data final
- **WHEN** a busca é realizada
- **THEN** apenas documentos com data dentro do intervalo são apresentados

## Requirement: Nova consulta ao alterar filtros

Qualquer alteração de filtro após uma busca SHALL resultar em nova consulta às fontes, independentemente de qual filtro foi alterado.

#### Scenario: Filtro alterado após a busca

- **GIVEN** que resultados já estão sendo exibidos
- **WHEN** o usuário altera qualquer filtro
- **THEN** o sistema realiza nova consulta às fontes conforme os filtros vigentes
- **AND** apresenta o indicador de carregamento durante a consulta

## Requirement: Ordenação dos resultados

O sistema SHALL permitir ordenar os resultados por A–Z, Z–A, data crescente e data decrescente.

A alteração da ordenação SHALL reorganizar os resultados já obtidos, sem realizar nova consulta às fontes.

#### Scenario: Ordenação alterada

- **GIVEN** que resultados estão sendo exibidos
- **WHEN** o usuário seleciona outro critério de ordenação
- **THEN** os resultados são reorganizados conforme o critério
- **AND** nenhuma nova consulta às fontes é realizada

## Requirement: Acesso ao documento na fonte original

Cada resultado SHALL disponibilizar um link que direcione o usuário ao documento em sua fonte original.

O sistema SHALL registrar localmente os documentos cujos links foram acessados.

#### Scenario: Usuário acessa um documento

- **GIVEN** que um resultado está sendo exibido
- **WHEN** o usuário aciona o link do documento
- **THEN** o documento é aberto em sua fonte original
- **AND** o sistema registra o acesso no armazenamento local

#### Scenario: Conteúdo não é armazenado

- **GIVEN** que um documento foi acessado
- **WHEN** o registro do acesso é gravado
- **THEN** apenas identificação, nome, fonte, link e data do acesso são armazenados
- **AND** o conteúdo do documento não é armazenado

## Requirement: Falha na comunicação com as fontes

O sistema SHALL informar o usuário quando ocorrer falha na comunicação com uma fonte, apresentando os resultados obtidos das fontes que responderam.

#### Scenario: Falha em apenas uma fonte

- **GIVEN** que a busca foi realizada nas duas fontes
- **WHEN** apenas uma delas falha
- **THEN** o sistema apresenta os documentos da fonte que respondeu
- **AND** informa ao usuário qual fonte falhou

#### Scenario: Falha nas duas fontes

- **GIVEN** que a busca foi realizada nas duas fontes
- **WHEN** ambas falham
- **THEN** o sistema informa que não foi possível realizar a busca
