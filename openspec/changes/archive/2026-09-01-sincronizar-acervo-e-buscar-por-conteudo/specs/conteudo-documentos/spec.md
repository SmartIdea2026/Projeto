# conteudo-documentos Specification

## MODIFIED Requirements

### Requirement: Ingestão sob demanda e em segundo plano

O sistema SHALL obter o conteúdo de um documento sob demanda, quando algum recurso do sistema precisar do seu texto e ele ainda não estiver armazenado.

O sistema SHALL executar, além disso, uma ingestão do acervo que percorre os documentos do inventário ainda sem texto armazenado vigente. Essa ingestão SHALL ser iniciada automaticamente na abertura da aplicação.

O usuário SHALL poder reexecutar a ingestão do acervo sob comando. A reexecução SHALL reaproveitar o texto já armazenado e vigente e obter apenas o que falta ou o que a fonte indica ter mudado — é a mesma operação iniciada na abertura, agora sob comando.

NÃO SHALL haver duas execuções da ingestão do acervo em andamento ao mesmo tempo: um comando de sincronização emitido enquanto a ingestão da abertura ainda corre NÃO SHALL iniciar uma segunda varredura concorrente.

A ingestão SHALL ser incremental e retomável: interrompê-la NÃO SHALL exigir recomeçar, e o que já foi extraído permanece utilizável.

A ingestão NÃO SHALL bloquear a busca nem atrasar uma consulta feita pelo usuário.

#### Scenario: Ingestão sob demanda

- **GIVEN** que um recurso do sistema precisa do texto de um documento ainda não armazenado
- **WHEN** o texto é solicitado
- **THEN** o sistema obtém o conteúdo, extrai o texto e o armazena
- **AND** entrega o texto ao recurso que o solicitou

#### Scenario: Ingestão iniciada na abertura

- **GIVEN** que a aplicação foi aberta
- **WHEN** a rotina de inicialização termina
- **THEN** a ingestão do acervo é iniciada sem bloquear a abertura
- **AND** percorre os documentos do inventário ainda sem texto armazenado vigente

#### Scenario: Sincronização sob comando reaproveita o já armazenado

- **GIVEN** que parte dos documentos já tem texto armazenado e vigente
- **WHEN** o usuário aciona o comando de sincronização
- **THEN** o sistema obtém apenas o texto que falta ou que a fonte indica ter mudado
- **AND** não volta a obter o conteúdo dos documentos cujo texto continua vigente

#### Scenario: Comando durante ingestão em andamento

- **GIVEN** que a ingestão do acervo iniciada na abertura ainda está em andamento
- **WHEN** o usuário aciona o comando de sincronização
- **THEN** nenhuma segunda varredura concorrente é iniciada

#### Scenario: Ingestão de segundo plano retomada

- **GIVEN** que a ingestão do acervo processou parte dos documentos e foi interrompida
- **WHEN** ela é retomada
- **THEN** apenas os documentos ainda sem texto armazenado vigente são processados
- **AND** o que já havia sido extraído permanece armazenado

#### Scenario: Busca durante a ingestão

- **GIVEN** que a ingestão do acervo está em andamento
- **WHEN** o usuário realiza uma busca
- **THEN** a busca é atendida normalmente
- **AND** o tempo de resposta da busca não depende do término da ingestão

#### Scenario: Limite de requisições da fonte atingido

- **GIVEN** que a ingestão está em andamento
- **WHEN** a fonte recusa uma requisição por limite de requisições excedido
- **THEN** a ingestão é suspensa sem perder o que já foi extraído
- **AND** a busca continua funcionando

## ADDED Requirements

### Requirement: Progresso e estados da sincronização

O sistema SHALL apresentar ao usuário o andamento da ingestão do acervo em **contagens**: total de documentos, quantos tiveram texto obtido agora, quantos foram reaproveitados, quantos ficaram sem texto e quantas falhas ocorreram. O texto dos documentos NÃO SHALL acompanhar essa informação — apenas contagens e estado.

A apresentação da sincronização SHALL distinguir os estados: **parada** (nenhuma sincronização em andamento), **em andamento**, **concluída** e **suspensa**. O estado suspensa SHALL informar o motivo — limite de requisições da fonte, limite de armazenamento atingido, credencial do GitHub ausente, ou falha ao obter o inventário.

O comando de sincronização SHALL ser apresentado no cabeçalho da aplicação, junto ao acesso às configurações. SHALL ser alcançável por teclado, assinalar o foco visualmente e ser identificado por rótulo acessível.

Enquanto uma sincronização estiver em andamento, acionar o comando NÃO SHALL iniciar uma segunda varredura, e a interface SHALL refletir que já há uma em curso.

A falha ou suspensão de uma sincronização NÃO SHALL impedir o uso da busca nem da lista de resultados.

#### Scenario: Progresso durante a sincronização

- **GIVEN** que uma sincronização do acervo está em andamento
- **WHEN** a interface é apresentada
- **THEN** o andamento é apresentado em contagens
- **AND** nenhum texto de documento acompanha essas contagens

#### Scenario: Sincronização concluída

- **GIVEN** que uma sincronização percorreu todo o inventário sem ser suspensa
- **WHEN** ela termina
- **THEN** a interface apresenta o estado concluída
- **AND** o comando de sincronização volta a ficar disponível

#### Scenario: Sincronização suspensa

- **GIVEN** que uma sincronização está em andamento
- **WHEN** a fonte recusa requisições por limite excedido
- **THEN** a interface apresenta o estado suspensa
- **AND** informa que o motivo foi o limite de requisições da fonte

#### Scenario: Sincronização sem credencial configurada

- **GIVEN** que a credencial do GitHub não está configurada
- **WHEN** o usuário aciona o comando de sincronização
- **THEN** a interface apresenta o estado suspensa
- **AND** informa que a credencial do GitHub não está configurada

#### Scenario: Comando de sincronização acionado durante uma sincronização

- **GIVEN** que uma sincronização já está em andamento
- **WHEN** o usuário aciona o comando de sincronização novamente
- **THEN** nenhuma segunda varredura é iniciada
- **AND** a interface reflete que já há uma sincronização em curso

#### Scenario: Comando de sincronização alcançado por teclado

- **GIVEN** que o cabeçalho da aplicação está apresentado
- **WHEN** o usuário percorre a tela pelo teclado
- **THEN** o comando de sincronização recebe o foco
- **AND** o foco é assinalado visualmente e o comando é identificado por rótulo acessível

### Requirement: Registro do inventário e da autoria na sincronização

Ao percorrer o acervo, a sincronização SHALL gravar localmente um **snapshot do inventário** — a identificação e os metadados de cada documento existente na fonte — e SHALL removê-lo para os documentos que saíram do inventário, na mesma varredura em que descarta o texto correspondente.

A sincronização SHALL resolver a **autoria e a data real da última alteração** de cada documento do inventário e gravá-las nesse snapshot. A resolução SHALL reaproveitar a autoria já gravada quando a identidade de conteúdo do documento (o `sha` do blob) não tiver mudado, do mesmo modo que o texto é reaproveitado.

A falha ao resolver a autoria de um documento NÃO SHALL contar como falha da varredura nem interrompê-la; o documento fica no snapshot sem autoria e continua encontrável pelo nome.

O snapshot e a autoria nele gravada SHALL permanecer confinados ao processo principal no que toca ao texto — nenhum texto de documento acompanha o snapshot. Autoria e data seguem a mesma exposição que já têm nos resultados de busca.

#### Scenario: Snapshot do inventário gravado na sincronização

- **GIVEN** que a sincronização obteve o inventário da fonte
- **WHEN** a varredura percorre os documentos
- **THEN** cada documento do inventário fica registrado no snapshot local com seus metadados

#### Scenario: Autoria resolvida e reaproveitada

- **GIVEN** que um documento teve a autoria resolvida em uma sincronização anterior
- **AND** que o `sha` do blob do documento não mudou
- **WHEN** uma nova sincronização o alcança
- **THEN** a autoria gravada é reaproveitada sem nova requisição à fonte

#### Scenario: Documento removido da fonte sai do snapshot

- **GIVEN** que um documento constava do snapshot local
- **WHEN** uma sincronização não o encontra mais no inventário
- **THEN** ele é removido do snapshot
- **AND** o texto correspondente também é descartado

#### Scenario: Falha ao resolver autoria não interrompe a varredura

- **GIVEN** que a sincronização está resolvendo a autoria dos documentos
- **WHEN** a fonte não devolve a autoria de um documento
- **THEN** a varredura segue para os demais
- **AND** o documento permanece no snapshot sem autoria
