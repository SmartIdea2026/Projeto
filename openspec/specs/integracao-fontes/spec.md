# integracao-fontes Specification

## Purpose
Consultar as APIs das fontes integradas, normalizar os resultados em formato único, conter o consumo de requisições e comunicar falhas e resultados parciais.

## Requirements

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

Cada documento apresentado SHALL identificar a **autoria da última alteração** e a **data real dessa alteração**, quando a fonte permitir obtê-las.

Obter esses dados exige uma consulta adicional por arquivo, custo que motivou o adiamento deste item no MVP. Por isso eles SHALL ser obtidos apenas para os documentos da página apresentada, e NÃO para o resultado inteiro. Enquanto não obtidos, o documento SHALL ser apresentado sem eles, sem bloquear a lista e sem apresentar erro.

Esse limite tem duas exceções, e ambas existem porque nelas o dado deixa de ser complemento e passa a decidir **quais** documentos entram no resultado — obtê-lo depois da filtragem seria obtê-lo tarde demais:

- Quando houver **termo de busca**, a autoria SHALL ser obtida para os candidatos antes da filtragem, para que o termo alcance o autor.
- Quando houver **período definido**, a data real SHALL ser obtida para os candidatos antes da filtragem, para que o recorte incida sobre a data do documento e não sobre a atividade do repositório.

Cada exceção SHALL respeitar um teto de documentos e SHALL reaproveitar resultados já obtidos, e o sistema SHALL informar o usuário quando o acervo exceder esse teto.

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
- **AND** que não há período definido
- **WHEN** os dados de autoria são obtidos
- **THEN** cada documento da página exibe quem realizou a última alteração e quando
- **AND** documentos fora da página apresentada não geram consulta

#### Scenario: Data real obtida antes do filtro de período

- **GIVEN** que o usuário definiu um período
- **WHEN** a consulta é realizada
- **THEN** a data real dos documentos candidatos é obtida antes da filtragem
- **AND** o recorte por período usa essa data

#### Scenario: Sem período definido, nada além da página é consultado

- **GIVEN** que nenhum período está definido
- **AND** que não há termo de busca
- **WHEN** a consulta é realizada
- **THEN** apenas os documentos da página apresentada geram consulta de detalhamento

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

O sistema SHALL informar o usuário quando o resultado apresentado estiver incompleto, distinguindo esse aviso de uma falha.

A distinção é necessária porque um documento ausente do resultado é indistinguível de um documento inexistente para quem observa a tela.

Quando um filtro depender de dado obtido sob teto — a autoria para o termo, a data real para o período —, o sistema SHALL informar o alcance efetivo desse filtro sempre que o acervo exceder o teto.

O aviso de que a data considerada em um filtro de período é a de atividade do repositório deixa de ser emitido: a limitação que ele descrevia desaparece quando o filtro passa a incidir sobre a data real do documento. Em seu lugar entra o aviso de alcance, que descreve uma limitação que de fato permanece — a de que a resolução das datas é contida por um teto.

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

#### Scenario: Filtro de período além do teto de resolução

- **GIVEN** que o acervo excede o teto de documentos cuja data real é obtida
- **WHEN** o usuário aplica um filtro de período
- **THEN** o sistema informa qual foi o alcance considerado pelo filtro
- **AND** apresenta o resultado sem interromper a busca

#### Scenario: Filtro de período sobre data aproximada

- **GIVEN** que os documentos de uma fonte têm data aproximada
- **WHEN** o usuário aplica um filtro de período
- **THEN** o sistema obtém a data real desses documentos antes de filtrar
- **AND** o resultado é apresentado sem interromper a busca
- **AND** o sistema não informa que a data considerada é a de atividade do repositório

#### Scenario: Período aplicado dentro do alcance

- **GIVEN** que o acervo cabe dentro do teto de resolução de datas
- **WHEN** o usuário aplica um filtro de período
- **THEN** nenhum aviso de alcance é apresentado

### Requirement: Comunicação de erro ao usuário

O sistema SHALL informar o usuário sempre que ocorrer falha na comunicação com uma API, sem interromper as funcionalidades que não dependem dela.

#### Scenario: Erro de comunicação durante a busca

- **GIVEN** que o usuário realizou uma busca
- **WHEN** ocorre falha na comunicação com uma das APIs
- **THEN** o sistema apresenta uma mensagem identificando a fonte afetada
- **AND** a interface permanece utilizável para nova tentativa
