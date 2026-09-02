# busca-documentos Specification

## Purpose
Localizar documentos das fontes integradas pelo nome, com filtros de tipo e período, ordenação, e acesso ao documento na fonte original.

## Requirements

### Requirement: Busca por termo

O sistema SHALL permitir que o usuário informe um termo e retorne os documentos cujo **nome ou autor** corresponda a esse termo. Procurar pelo nome de um integrante deve encontrar o que ele produziu, e não apenas arquivos que o citem no nome.

A busca no **conteúdo armazenado** dos documentos (capacidade `conteudo-documentos`) SHALL ser ativada por um controle na interface, **desligada por padrão**. A correspondência pelo texto alcança qualquer documento que mencione o termo no corpo, e nem sempre é isso que se procura; ligá-la é uma escolha do usuário. O controle NÃO SHALL ser um seletor de campo — ele apenas amplia o alcance para incluir o texto, sem que o usuário precise adivinhar em qual campo o que procura está escrito.

Com a busca no conteúdo ligada, a correspondência SHALL ser **aditiva**: um documento entra no resultado quando o termo casa com o nome, com o autor **ou** com o texto armazenado, num resultado único. No conteúdo o termo SHALL casar como palavra inteira — um documento tem milhares de palavras, e casar por substring encontraria o termo dentro de outras palavras em quase todo arquivo.

Um resultado que correspondeu ao termo apenas pelo conteúdo SHALL ser assinalado como tal. O sistema NÃO SHALL apresentar o trecho do texto onde a correspondência ocorreu: o conteúdo permanece confinado ao processo principal, conforme a capacidade `conteudo-documentos`.

Documentos cuja autoria ainda não foi obtida SHALL permanecer encontráveis pelo nome. Documentos cujo texto ainda não foi armazenado — ou cujo formato não permite extração — SHALL permanecer encontráveis pelo nome e pelo autor; a correspondência pelo conteúdo apenas não os alcança.

Quando a busca no conteúdo estiver ligada e houver documentos sem texto armazenado no momento da busca, e isso puder ter deixado resultados de fora, o sistema SHALL informar que o alcance pelo conteúdo cobriu apenas parte do acervo, reaproveitando o canal de avisos de resultado parcial.

Quando a busca for servida do snapshot local (requisito **Origem dos resultados de busca**) e houver documentos ainda sem autoria resolvida, o sistema SHALL informar quantos, reaproveitando o mesmo canal de avisos; esses documentos permanecem encontráveis pelo nome.

#### Scenario: Termo com correspondência

- **GIVEN** que existem documentos cujo nome contém o termo informado
- **WHEN** o usuário informa o termo e confirma a busca
- **THEN** o sistema apresenta os documentos correspondentes
- **AND** cada resultado exibe nome completo, extensão, data e fonte

#### Scenario: Termo sem correspondência

- **GIVEN** que nenhum documento possui nome ou autor correspondente ao termo
- **AND** que a busca no conteúdo não está ligada, ou nenhum texto armazenado contém o termo
- **WHEN** a busca é concluída
- **THEN** o sistema informa que nenhum documento foi encontrado

#### Scenario: Busca no conteúdo desligada

- **GIVEN** que o controle de busca no conteúdo está desligado
- **AND** que um documento tem o termo apenas no texto armazenado, não no nome nem no autor
- **WHEN** a busca é realizada
- **THEN** esse documento NÃO aparece entre os resultados

#### Scenario: Busca no conteúdo ligada sob demanda

- **GIVEN** que o usuário liga o controle de busca no conteúdo
- **WHEN** a busca é refeita
- **THEN** os documentos cujo texto armazenado contém o termo passam a aparecer, assinalados

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

#### Scenario: Correspondência pelo conteúdo

- **GIVEN** que a busca no conteúdo está ligada
- **AND** que o texto de um documento está armazenado e contém o termo como palavra inteira
- **AND** que nem o nome do arquivo nem o autor contêm o termo
- **WHEN** a busca é realizada
- **THEN** o documento aparece entre os resultados
- **AND** o resultado é assinalado como tendo correspondido pelo conteúdo
- **AND** o trecho do texto onde o termo ocorre não é apresentado

#### Scenario: Documento sem texto armazenado permanece encontrável

- **GIVEN** que um documento ainda não teve seu texto armazenado
- **AND** que o nome do arquivo contém o termo
- **WHEN** a busca é realizada
- **THEN** o documento aparece entre os resultados pela correspondência de nome

#### Scenario: Alcance parcial da busca pelo conteúdo

- **GIVEN** que a busca no conteúdo está ligada
- **AND** que parte do acervo ainda não teve o texto armazenado
- **WHEN** o usuário realiza uma busca por termo
- **THEN** o sistema apresenta os documentos que corresponderam por nome, autor ou conteúdo já armazenado
- **AND** informa que a correspondência pelo conteúdo cobriu apenas parte do acervo

#### Scenario: Acervo maior que o alcance da autoria

- **GIVEN** que o acervo excede o limite de documentos cuja autoria é obtida por busca
- **AND** que a busca está sendo servida por consulta ao vivo, sem snapshot local
- **WHEN** o usuário realiza uma busca
- **THEN** o sistema informa que a correspondência por autor cobriu parte do acervo
- **AND** os documentos além do limite continuam sendo procurados pelo nome

### Requirement: Origem dos resultados de busca

Quando o usuário informa um termo ou um período, o sistema SHALL montar o resultado a partir do **snapshot local do inventário** gravado pela última sincronização (capacidade `conteudo-documentos`), sem consultar a fonte documento a documento durante a busca. O snapshot já traz a autoria e a data real de cada documento resolvidas.

O resultado SHALL, portanto, refletir o estado da fonte no momento da última sincronização: um documento criado, renomeado ou removido na fonte depois disso NÃO SHALL, respectivamente, aparecer, aparecer com o novo nome, ou desaparecer, até a sincronização seguinte.

Enquanto não houver snapshot local — nenhuma sincronização concluída ou em andamento desde a instalação —, o sistema SHALL responder à busca com uma consulta ao vivo à fonte, resolvendo autoria e data no momento da busca. A troca entre os dois caminhos NÃO SHALL ser exposta ao usuário como configuração.

A busca servida do snapshot NÃO SHALL depender de acesso à rede nem da credencial da fonte estar configurada.

#### Scenario: Busca servida do snapshot local

- **GIVEN** que uma sincronização gravou o snapshot do inventário
- **WHEN** o usuário realiza uma busca por termo
- **THEN** o sistema apresenta os resultados a partir do snapshot
- **AND** não consulta a fonte uma vez por documento durante a busca

#### Scenario: Documento novo na fonte só aparece após sincronizar

- **GIVEN** que um documento foi adicionado à fonte depois da última sincronização
- **WHEN** o usuário busca por um termo que casa com esse documento
- **THEN** o documento não aparece entre os resultados
- **AND** passa a aparecer depois que o usuário aciona a sincronização

#### Scenario: Busca sem snapshot cai na consulta ao vivo

- **GIVEN** que nenhuma sincronização gravou o snapshot ainda
- **WHEN** o usuário realiza uma busca por termo
- **THEN** o sistema consulta a fonte e resolve autoria e data no momento da busca

#### Scenario: Autoria ainda não resolvida no snapshot

- **GIVEN** que a busca é servida do snapshot local
- **AND** que alguns documentos ainda estão sem autoria resolvida
- **WHEN** o usuário realiza uma busca por termo
- **THEN** esses documentos permanecem encontráveis pelo nome
- **AND** o sistema informa quantos documentos ainda estão sem autoria sincronizada

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

O período SHALL incidir sobre a **data real da última alteração do documento**, e não sobre uma data derivada da atividade do repositório que o contém. Havendo período definido, o sistema SHALL resolver a data real dos documentos candidatos **antes** de aplicar o filtro. A distinção não é de precisão, e sim de significado: um recorte que admite documentos intocados há um ano por estarem em repositório ativo é um recorte por atividade do repositório apresentado ao usuário sob o nome de recorte por data.

Documento cuja data ainda for aproximada e cuja data real não puder ser resolvida NÃO SHALL ser apresentado enquanto houver período definido. Presumi-lo dentro do intervalo contradiz o filtro; presumi-lo fora seria igualmente arbitrário — a diferença é que a omissão pode ser comunicada ao usuário e a inclusão indevida não.

A resolução das datas SHALL ser limitada por um teto de documentos, e o sistema SHALL informar quando o acervo exceder esse teto, identificando o alcance efetivo do filtro.

O período SHALL valer sobre o acervo consultável, e não sobre o conjunto que estava apresentado no momento em que ele foi definido.

O período definido SHALL permanecer em vigor enquanto o usuário não o alterar ou limpar, inclusive ao trocar de página e ao alterar outros filtros.

#### Scenario: Período informado

- **GIVEN** que o usuário definiu data inicial e data final
- **WHEN** a busca é realizada
- **THEN** apenas documentos com data dentro do intervalo são apresentados

#### Scenario: Documento cuja data real cai fora do intervalo

- **GIVEN** que um documento pertence a um repositório com atividade dentro do intervalo
- **AND** que sua data real de última alteração é anterior à data inicial
- **WHEN** o filtro de período é aplicado
- **THEN** o documento não é apresentado
- **AND** o contador não o inclui no total

#### Scenario: Data real não resolvida com período em vigor

- **GIVEN** que há período definido
- **AND** que a data real de um documento de data aproximada não pôde ser obtida
- **WHEN** os resultados são apresentados
- **THEN** o documento não aparece entre eles
- **AND** o sistema informa que parte do acervo ficou fora do alcance do filtro

#### Scenario: Acervo maior que o teto de resolução de datas

- **GIVEN** que o acervo excede o teto de documentos cuja data é resolvida
- **WHEN** o usuário define um período
- **THEN** o sistema apresenta os documentos dentro do intervalo entre os que couberam no teto
- **AND** informa qual foi o alcance considerado

#### Scenario: Período definido sem termo de busca

- **GIVEN** que o campo de busca está vazio
- **WHEN** o usuário define um período
- **THEN** o sistema consulta o acervo e apresenta os documentos daquele intervalo
- **AND** o resultado não fica restrito ao que estava na tela antes

#### Scenario: Data final anterior à inicial

- **GIVEN** que o usuário informou uma data final anterior à data inicial
- **WHEN** o período é aplicado
- **THEN** o sistema informa o erro e não realiza a consulta
- **AND** os resultados anteriores permanecem visíveis

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

A ordenação SHALL incidir sobre o **resultado completo da consulta vigente**, e não sobre a página apresentada. Ao trocar de critério, o sistema SHALL reorganizar todos os documentos encontrados e recalcular as páginas, de modo que a primeira página passe a conter os documentos de maior precedência segundo o novo critério. Reordenar apenas o que está visível devolve a ordem alfabética de um recorte arbitrário e não a do resultado, contrariando o requisito de paginação.

A alteração da ordenação SHALL reorganizar os resultados já obtidos, sem realizar nova consulta às fontes.

Os critérios de data SHALL usar o nome do documento em ordem A–Z como desempate e, permanecendo o empate, o identificador do documento, que é único. Sem o desempate por nome, documentos que compartilham a mesma data — situação comum no GitHub, onde a busca deriva a data do repositório e não do arquivo — aparecem em ordem arbitrária; sem o desempate final por identificador, documentos de mesmo nome em repositórios diferentes, como `README.md`, continuam trocando de lugar entre consultas sucessivas.

O critério escolhido SHALL permanecer em vigor enquanto o usuário não o alterar, inclusive quando a lista for recarregada por mudança de outro filtro.

#### Scenario: Ordenação alterada

- **GIVEN** que resultados estão sendo exibidos
- **WHEN** o usuário seleciona outro critério de ordenação
- **THEN** os resultados são reorganizados conforme o critério
- **AND** nenhuma nova consulta às fontes é realizada

#### Scenario: Ordenação sobre resultado de várias páginas

- **GIVEN** que a consulta retornou mais documentos do que cabem em uma página
- **WHEN** o usuário seleciona a ordenação por nome A–Z
- **THEN** a primeira página apresenta os primeiros documentos em ordem alfabética do resultado inteiro
- **AND** não os primeiros em ordem alfabética da página que estava visível

#### Scenario: Ordenação alterada fora da primeira página

- **GIVEN** que o usuário está em uma página diferente da primeira
- **WHEN** ele troca o critério de ordenação
- **THEN** o resultado reorganizado é apresentado a partir da primeira página

#### Scenario: Documentos com a mesma data

- **GIVEN** que vários documentos compartilham a mesma data de modificação
- **WHEN** a ordenação por data é aplicada
- **THEN** esses documentos aparecem entre si em ordem alfabética de nome
- **AND** a ordem se mantém estável entre consultas sucessivas

#### Scenario: Documentos de mesma data e mesmo nome

- **GIVEN** que dois documentos de repositórios diferentes têm o mesmo nome e a mesma data
- **WHEN** a ordenação por data é aplicada duas vezes seguidas
- **THEN** eles aparecem na mesma ordem relativa nas duas vezes

#### Scenario: Ordenação preservada ao recarregar

- **GIVEN** que o usuário escolheu um critério de ordenação
- **WHEN** a lista é recarregada por alteração de outro filtro
- **THEN** o critério escolhido continua aplicado ao novo resultado

### Requirement: Ordem coerente com os dados apresentados

A ordem em que os documentos aparecem SHALL corresponder aos dados que a tela exibe sobre eles. Quando a data apresentada de um documento for substituída depois que a lista já está visível — o que ocorre ao obter a data real de uma alteração —, o sistema SHALL reposicionar o documento segundo o critério de ordenação vigente.

Uma lista rotulada "Data decrescente" cujas datas visíveis estão fora de ordem informa ao usuário duas coisas incompatíveis ao mesmo tempo, e ele não tem como saber qual delas é verdadeira.

#### Scenario: Data real chega depois da lista

- **GIVEN** que a lista está sendo apresentada ordenada por data decrescente
- **WHEN** a data real de alteração de um documento é obtida e difere da apresentada
- **THEN** o documento é reposicionado conforme a nova data
- **AND** a ordem apresentada continua correspondendo às datas exibidas

#### Scenario: Reposicionamento não recarrega a lista

- **GIVEN** que a lista está sendo apresentada
- **WHEN** os documentos são reposicionados pela chegada das datas reais
- **THEN** nenhuma nova consulta às fontes é realizada
- **AND** nenhum indicador de carregamento é apresentado

### Requirement: Posição do controle de ordenação

O controle de ordenação SHALL ser apresentado junto à lista de resultados que ele governa, alinhado à borda direita dessa lista, e NÃO SHALL ocupar a faixa correspondente ao painel de resumo.

O controle governa a lista, não o painel. Apresentá-lo alinhado à direita da página inteira o coloca acima do painel de resumo, sugerindo uma relação que não existe e afastando-o do que ele de fato altera.

O contador de resultados SHALL acompanhar o controle na mesma linha, à esquerda dela.

#### Scenario: Controle apresentado com resultados na tela

- **GIVEN** que há resultados sendo apresentados
- **WHEN** a tela é exibida
- **THEN** o controle de ordenação aparece acima da lista, alinhado à borda direita dela
- **AND** o painel de resumo permanece sem controle sobreposto

#### Scenario: Controle recebe o foco pelo teclado

- **GIVEN** que o controle de ordenação está visível
- **WHEN** o usuário o alcança pela navegação por teclado
- **THEN** o foco é visualmente assinalado
- **AND** o controle é identificado por rótulo acessível

#### Scenario: Sem resultados a ordenar

- **GIVEN** que a consulta não retornou documento algum
- **WHEN** a tela é apresentada
- **THEN** o controle de ordenação não é apresentado

#### Scenario: Consulta em andamento

- **GIVEN** que uma consulta está em andamento
- **WHEN** o indicador de carregamento é apresentado
- **THEN** o controle de ordenação não é apresentado até que haja resultado

### Requirement: Acesso ao documento na fonte original

Cada resultado SHALL disponibilizar um link que direcione o usuário ao documento em sua fonte original.

O sistema SHALL registrar localmente os documentos cujos links foram acessados.

O registro de acesso NÃO SHALL conter o conteúdo do documento. O sistema mantém o texto dos documentos em armazenamento próprio, descrito na capacidade `conteudo-documentos`, e essa manutenção é independente do registro de acesso: um documento pode ter seu texto armazenado sem nunca ter sido acessado, e ser acessado sem que seu texto esteja armazenado.

A forma de visualizar um documento NÃO SHALL depender do texto que o sistema armazena. O usuário é sempre direcionado à fonte original.

#### Scenario: Usuário acessa um documento

- **GIVEN** que um resultado está sendo exibido
- **WHEN** o usuário aciona o link do documento
- **THEN** o documento é aberto em sua fonte original
- **AND** o sistema registra o acesso no armazenamento local

#### Scenario: Conteúdo não é armazenado

- **GIVEN** que um documento foi acessado
- **WHEN** o registro do acesso é gravado
- **THEN** apenas identificação, nome, fonte, link e data do acesso são armazenados no registro de acesso
- **AND** o conteúdo do documento não é gravado nesse registro

#### Scenario: Documento com texto armazenado é acessado da mesma forma

- **GIVEN** que o sistema já armazenou o texto de um documento apresentado como resultado
- **WHEN** o usuário aciona o link do documento
- **THEN** ele é direcionado ao documento na fonte original, como qualquer outro
- **AND** o texto armazenado não é apresentado ao usuário

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
