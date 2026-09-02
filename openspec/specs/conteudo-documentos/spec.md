# conteudo-documentos Specification

## Purpose
Trazer para dentro do sistema o conteúdo dos documentos das fontes integradas, extraindo seu texto e mantendo-o no armazenamento local, de modo que os recursos que dependem do que está escrito no documento possam ser construídos sobre ele. O conteúdo fica disponível ao sistema e nunca ao usuário final.

## Requirements

### Requirement: Obtenção do conteúdo junto à fonte

O sistema SHALL ser capaz de obter, junto à fonte, o conteúdo de um documento já identificado no inventário.

A obtenção do conteúdo NÃO SHALL ser condição para que o documento apareça nos resultados: um documento cujo conteúdo não pôde ser obtido continua encontrável pelo nome e continua abrindo na fonte original.

#### Scenario: Conteúdo obtido com sucesso

- **GIVEN** que um documento consta do inventário da fonte
- **WHEN** o sistema solicita seu conteúdo
- **THEN** o conteúdo do arquivo é recebido pelo processo principal

#### Scenario: Documento inacessível na fonte

- **GIVEN** que um documento consta do inventário
- **WHEN** a fonte recusa ou falha ao entregar seu conteúdo
- **THEN** o sistema registra que o conteúdo não foi obtido e o motivo
- **AND** o documento continua sendo apresentado nos resultados da busca

### Requirement: Extração do texto do documento

O sistema SHALL extrair o texto dos documentos obtidos, para cada formato aceito em que a extração seja possível.

Documentos cujo formato não permita extração, ou dos quais não se obtenha texto algum, SHALL ser registrados com o motivo, e NÃO SHALL produzir erro apresentado ao usuário.

#### Scenario: Formato com texto extraível

- **GIVEN** que o conteúdo de um documento em formato textual foi obtido
- **WHEN** a extração é executada
- **THEN** o texto do documento é produzido

#### Scenario: Formato sem extração disponível

- **GIVEN** que o conteúdo de um documento em formato não extraível foi obtido
- **WHEN** a extração é tentada
- **THEN** o documento é registrado como sem texto disponível, com o motivo
- **AND** nenhum erro é apresentado ao usuário

#### Scenario: Documento sem texto útil

- **GIVEN** que um documento foi obtido e sua extração não produziu texto algum
- **WHEN** o resultado da extração é avaliado
- **THEN** o documento é registrado como sem texto disponível
- **AND** o sistema não repete a extração enquanto o documento não for alterado na fonte

### Requirement: Armazenamento local do texto extraído

O sistema SHALL armazenar o texto extraído no armazenamento local, associado ao documento de origem, junto da data da extração e do estado do resultado.

O sistema NÃO SHALL armazenar os bytes originais do arquivo: apenas o texto extraído dele é persistido.

O registro dos documentos acessados SHALL continuar guardando apenas identificação, nome, fonte, link e data do acesso. O texto é armazenado separadamente e não integra esse registro.

#### Scenario: Texto extraído é gravado

- **GIVEN** que o texto de um documento foi extraído
- **WHEN** a extração é concluída
- **THEN** o texto é gravado no armazenamento local associado ao documento
- **AND** a data da extração é gravada junto

#### Scenario: Arquivo original não é guardado

- **GIVEN** que o conteúdo de um documento foi obtido e seu texto extraído
- **WHEN** a gravação é concluída
- **THEN** apenas o texto extraído consta do armazenamento
- **AND** os bytes originais do arquivo não são persistidos

#### Scenario: Registro de acesso permanece inalterado

- **GIVEN** que o usuário acessou um documento cujo texto o sistema possui
- **WHEN** o registro do acesso é gravado
- **THEN** esse registro contém apenas identificação, nome, fonte, link e data do acesso

### Requirement: Conteúdo confinado ao processo principal

O conteúdo dos documentos SHALL permanecer acessível apenas ao processo principal do sistema.

Nenhum canal de comunicação com a camada de interface SHALL devolver o conteúdo ou o texto extraído de um documento. A restrição é a mesma aplicada às credenciais.

A forma de visualizar um documento SHALL permanecer inalterada: o usuário é direcionado ao documento em sua fonte original, e o sistema não apresenta o conteúdo que armazena.

#### Scenario: Nenhum canal devolve conteúdo

- **GIVEN** que o sistema armazenou o texto de documentos
- **WHEN** qualquer canal disponível à camada de interface é acionado
- **THEN** nenhuma resposta contém o conteúdo ou o texto extraído de um documento

#### Scenario: Visualização do documento inalterada

- **GIVEN** que um documento é apresentado como resultado e seu texto já está armazenado
- **WHEN** o usuário aciona o documento
- **THEN** ele é direcionado ao documento na fonte original, como antes
- **AND** o sistema não apresenta o texto armazenado

### Requirement: Revalidação do conteúdo armazenado

O sistema SHALL reaproveitar o texto já armazenado enquanto a fonte indicar que o conteúdo do documento não foi alterado desde a obtenção anterior.

O sistema SHALL obter e extrair o conteúdo novamente quando a fonte indicar que o documento foi alterado, substituindo o texto armazenado.

#### Scenario: Documento inalterado na fonte

- **GIVEN** que o texto de um documento está armazenado
- **WHEN** o sistema verifica o documento e a fonte indica que o conteúdo não mudou
- **THEN** o texto armazenado é reaproveitado
- **AND** o conteúdo não é obtido novamente

#### Scenario: Documento alterado na fonte

- **GIVEN** que o texto de um documento está armazenado
- **WHEN** a fonte indica que o conteúdo do documento mudou
- **THEN** o sistema obtém o conteúdo novamente e extrai o texto
- **AND** substitui o texto armazenado pelo novo

#### Scenario: Documento removido da fonte

- **GIVEN** que o texto de um documento está armazenado
- **WHEN** o documento deixa de constar do inventário da fonte
- **THEN** o texto armazenado correspondente é descartado

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

### Requirement: Limites de tamanho da ingestão

O sistema SHALL respeitar um limite de tamanho por documento e um limite para o total de texto armazenado.

Um documento que exceda o limite por arquivo NÃO SHALL ser obtido, e SHALL ser registrado como excedente, com o motivo.

Quando o total armazenado atingir o limite, a ingestão de segundo plano SHALL ser suspensa, e os documentos já processados SHALL permanecer utilizáveis.

Documentos deixados de fora por limite SHALL continuar encontráveis pelo nome e continuar abrindo na fonte original.

#### Scenario: Documento acima do limite por arquivo

- **GIVEN** que um documento do inventário excede o limite de tamanho por arquivo
- **WHEN** a ingestão o alcança
- **THEN** seu conteúdo não é obtido
- **AND** ele é registrado como excedente, com o motivo
- **AND** continua sendo apresentado nos resultados da busca

#### Scenario: Total armazenado no limite

- **GIVEN** que o total de texto armazenado atingiu o limite definido
- **WHEN** a ingestão de segundo plano tenta processar mais um documento
- **THEN** a ingestão é suspensa
- **AND** o texto já armazenado permanece disponível ao sistema

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
