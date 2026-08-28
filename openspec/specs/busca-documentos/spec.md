# busca-documentos Specification

## Purpose
Localizar documentos das fontes integradas pelo nome, com filtros de tipo e período, ordenação, e acesso ao documento na fonte original.

## Requirements

### Requirement: Busca por termo

O sistema SHALL permitir que o usuário informe um termo e retorne os documentos cujo **nome ou autor** corresponda a esse termo.

A comparação SHALL considerar o nome do arquivo e o nome de quem realizou a última alteração. Procurar pelo nome de um integrante deve encontrar o que ele produziu, e não apenas arquivos que o citem no nome.

O conteúdo interno dos documentos NÃO SHALL ser considerado nesta versão.

Documentos cuja autoria ainda não foi obtida SHALL permanecer encontráveis pelo nome.

#### Scenario: Termo com correspondência

- **GIVEN** que existem documentos cujo nome contém o termo informado
- **WHEN** o usuário informa o termo e confirma a busca
- **THEN** o sistema apresenta os documentos correspondentes
- **AND** cada resultado exibe nome completo, extensão, data e fonte

#### Scenario: Termo sem correspondência

- **GIVEN** que nenhum documento possui nome ou autor correspondente ao termo
- **WHEN** a busca é concluída
- **THEN** o sistema informa que nenhum documento foi encontrado

#### Scenario: Busca em andamento

- **GIVEN** que o usuário confirmou uma busca
- **WHEN** o sistema aguarda a resposta das fontes
- **THEN** o sistema apresenta um indicador de carregamento
- **AND** o indicador é removido quando os resultados são apresentados

#### Scenario: Correspondência pelo autor

- **GIVEN** que um documento foi alterado por uma pessoa cujo nome contém o termo
- **AND** que o nome do arquivo não contém o termo
- **WHEN** a busca é realizada
- **THEN** o documento aparece entre os resultados

#### Scenario: Acervo maior que o alcance da autoria

- **GIVEN** que o acervo excede o limite de documentos cuja autoria é obtida por busca
- **WHEN** o usuário realiza uma busca
- **THEN** o sistema informa que a correspondência por autor cobriu parte do acervo
- **AND** os documentos além do limite continuam sendo procurados pelo nome

### Requirement: Filtro por tipo de documento

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

### Requirement: Filtro por período

O sistema SHALL permitir definir um período por meio de data inicial e data final, restringindo os resultados aos documentos cuja data esteja dentro do intervalo.

#### Scenario: Período informado

- **GIVEN** que o usuário definiu data inicial e data final
- **WHEN** a busca é realizada
- **THEN** apenas documentos com data dentro do intervalo são apresentados

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

### Requirement: Acesso ao documento na fonte original

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

### Requirement: Falha na comunicação com as fontes

O sistema SHALL informar o usuário quando ocorrer falha na comunicação com uma fonte, apresentando os resultados obtidos das fontes que responderam.

#### Scenario: Falha em apenas uma fonte

- **GIVEN** que a busca foi realizada em todas as fontes configuradas
- **WHEN** uma delas falha e outra responde
- **THEN** o sistema apresenta os documentos da fonte que respondeu
- **AND** informa ao usuário qual fonte falhou

#### Scenario: Falha em todas as fontes

- **GIVEN** que a busca foi realizada em todas as fontes configuradas
- **WHEN** todas falham
- **THEN** o sistema informa que não foi possível realizar a busca

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
