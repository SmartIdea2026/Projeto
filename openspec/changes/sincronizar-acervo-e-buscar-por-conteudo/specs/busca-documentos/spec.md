# busca-documentos Specification

## MODIFIED Requirements

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

## ADDED Requirements

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
