# resumos-por-ia Specification

## Purpose

Produzir, armazenar e apresentar resumos dos documentos gerados por um modelo de linguagem a partir do texto já mantido no sistema, de modo que o usuário compreenda o que há em um documento sem precisar abri-lo.

## Requirements

### Requirement: Envio do conteúdo a serviço externo

O sistema SHALL enviar o texto do documento a um serviço externo de modelo de linguagem para produzir o resumo.

O usuário SHALL ser informado disso antes do primeiro envio, e a informação SHALL permanecer acessível na tela de configurações. Até aqui todo conteúdo permanecia na máquina do usuário; a mudança dessa postura NÃO SHALL ser silenciosa.

O sistema SHALL enviar apenas o texto do documento a ser resumido. Nenhuma credencial, caminho local ou dado de outro documento acompanha a submissão.

#### Scenario: Primeiro envio de conteúdo

- **GIVEN** que nenhum conteúdo foi enviado ao serviço externo ainda
- **WHEN** um resumo é solicitado
- **THEN** o sistema informa que o conteúdo será enviado a um serviço externo
- **AND** prossegue somente após a confirmação do usuário

#### Scenario: Confirmação recusada

- **GIVEN** que o sistema pediu confirmação para o primeiro envio
- **WHEN** o usuário recusa
- **THEN** nenhum conteúdo é enviado
- **AND** a busca e a lista de resultados continuam funcionando normalmente

#### Scenario: Envios seguintes

- **GIVEN** que o usuário já confirmou o envio de conteúdo anteriormente
- **WHEN** um novo resumo é solicitado
- **THEN** o sistema prossegue sem repetir a confirmação

### Requirement: Instrução de redação versionada

A orientação enviada à LLM sobre como redigir o resumo SHALL residir em um arquivo de texto versionado no repositório, e não embutida no código.

O arquivo SHALL descrever a estrutura esperada do resumo e os pontos que ele deve cobrir, de modo que a equipe possa revisá-lo e alterá-lo como qualquer outro documento do projeto.

O sistema SHALL ler a instrução vigente em tempo de execução.

#### Scenario: Instrução aplicada à geração

- **GIVEN** que o arquivo de instrução define a estrutura do resumo
- **WHEN** um resumo é gerado
- **THEN** a instrução vigente no arquivo é enviada junto ao texto do documento

#### Scenario: Instrução alterada

- **GIVEN** que a equipe alterou o arquivo de instrução
- **WHEN** um novo resumo é gerado
- **THEN** a nova instrução é aplicada
- **AND** os resumos já existentes permanecem inalterados até serem regerados

### Requirement: Geração do resumo a partir do texto armazenado

O sistema SHALL produzir o resumo a partir do texto do documento já mantido localmente, obtendo-o sob demanda apenas quando ainda não houver.

Uma única submissão SHALL produzir o resumo em prosa, a categoria do documento, os assuntos identificados e os destaques principais. O sistema NÃO SHALL realizar submissões separadas para cada um desses elementos.

As submissões à LLM SHALL ocorrer **uma por vez**, nunca em lote paralelo.

Documentos sem texto disponível — formato não lido, sem texto extraível ou grande demais — NÃO SHALL ser submetidos, e o painel SHALL informar por que não há resumo.

#### Scenario: Documento com texto já armazenado

- **GIVEN** que o texto de um documento já está armazenado localmente
- **WHEN** seu resumo é solicitado
- **THEN** o sistema submete o texto armazenado à LLM
- **AND** nenhuma requisição à fonte do documento é realizada

#### Scenario: Documento ainda sem texto armazenado

- **GIVEN** que um documento aparece nos resultados sem texto armazenado
- **WHEN** seu resumo é solicitado
- **THEN** o sistema obtém o texto na fonte, armazena-o, e então submete à LLM

#### Scenario: Uma submissão devolve todos os elementos

- **GIVEN** que um documento foi submetido à LLM
- **WHEN** a resposta é recebida
- **THEN** ela contém o resumo em prosa, a categoria, os assuntos e os destaques
- **AND** apenas uma submissão foi realizada

#### Scenario: Submissões em série

- **GIVEN** que resumos de documentos diferentes são solicitados em sequência rápida
- **WHEN** as submissões ocorrem
- **THEN** nunca há mais de uma submissão em andamento

#### Scenario: Documento sem texto disponível

- **GIVEN** que um documento está registrado como sem texto extraível
- **WHEN** ele entra em foco no painel
- **THEN** nenhuma submissão à LLM é realizada
- **AND** o painel informa que aquele documento não tem texto a resumir

### Requirement: Categoria de vocabulário fechado

A categoria SHALL ser escolhida pela LLM a partir de uma lista fechada de rótulos definida na instrução de redação do resumo (`instrucoes/resumo.md`) — nunca um rótulo fora dela.

Quando nenhum rótulo da lista descrever o documento com confiança, a categoria SHALL ficar ausente. O sistema NÃO SHALL atribuir um rótulo genérico em seu lugar.

A categoria NÃO SHALL ser apresentada no painel de resumo — aparece como selo no cartão do documento e alimenta o filtro por categoria da busca (capacidade `busca-documentos`).

#### Scenario: Categoria escolhida da lista fechada

- **GIVEN** que o conteúdo de um documento corresponde claramente a um dos rótulos da lista fechada
- **WHEN** o resumo é gerado
- **THEN** o documento recebe esse rótulo como categoria

#### Scenario: Nenhum rótulo da lista se aplica com confiança

- **GIVEN** que o conteúdo de um documento não corresponde com confiança a nenhum rótulo da lista fechada
- **WHEN** o resumo é gerado
- **THEN** o documento fica sem categoria
- **AND** nenhum rótulo genérico é atribuído em seu lugar

#### Scenario: Categoria não aparece no painel

- **GIVEN** que um documento tem categoria atribuída
- **WHEN** seu resumo é apresentado no painel
- **THEN** a categoria não é exibida ali

### Requirement: Persistência da categoria para filtragem

A categoria produzida SHALL ser refletida, junto da versão de conteúdo em que foi atribuída, no registro do acervo consultado pela busca — não apenas no registro do resumo.

A categoria refletida SHALL ser atualizada sempre que o resumo do documento for gerado ou regerado.

#### Scenario: Categoria refletida ao gerar o resumo

- **GIVEN** que um documento recebeu categoria ao ser resumido
- **WHEN** a busca consulta o acervo
- **THEN** a categoria está disponível para o filtro por categoria, sem nova submissão à LLM

#### Scenario: Categoria atualizada ao regerar o resumo

- **GIVEN** que um documento já tem categoria refletida no acervo
- **WHEN** seu resumo é regerado com um resultado diferente
- **THEN** a categoria refletida no acervo é atualizada para o novo resultado

### Requirement: Armazenamento e reuso do resumo

O resumo produzido SHALL ser gravado localmente, associado ao documento, à versão do conteúdo que o originou e à data de geração.

Uma solicitação posterior para o mesmo documento SHALL reutilizar o resumo gravado, sem nova submissão à LLM.

O resumo SHALL ser assinalado como desatualizado quando o conteúdo do documento mudar na fonte depois de gerado, e o usuário SHALL poder solicitar a regeração.

#### Scenario: Resumo reutilizado

- **GIVEN** que um documento já possui resumo gravado para a versão vigente do seu conteúdo
- **WHEN** ele volta a entrar em foco
- **THEN** o resumo gravado é apresentado
- **AND** nenhuma submissão à LLM é realizada

#### Scenario: Documento alterado após o resumo

- **GIVEN** que um documento possui resumo gravado
- **WHEN** o conteúdo do documento muda na fonte
- **THEN** o resumo é apresentado assinalado como desatualizado
- **AND** o usuário pode solicitar a regeração

#### Scenario: Regeração solicitada

- **GIVEN** que o painel apresenta um resumo assinalado como desatualizado
- **WHEN** o usuário solicita a regeração
- **THEN** o sistema produz um resumo novo a partir do texto vigente
- **AND** substitui o resumo gravado

### Requirement: Painel de resumo

O sistema SHALL apresentar um painel à direita da lista de resultados, contendo o nome do documento, a fonte de onde ele vem, o resumo em prosa, os destaques principais, a pilha de documentos relacionados e uma ação que abre o documento na fonte original.

Ao concluir uma busca com resultados, o painel SHALL passar a apresentar o **primeiro** documento da página.

Cada resultado SHALL oferecer uma ação de gerar o resumo. Acioná-la SHALL substituir o conteúdo do painel pelo daquele documento, **sem alterar a lista de resultados** nem a posição de rolagem dela.

Acionar um item da pilha de documentos relacionados SHALL ter o mesmo efeito: substituir o conteúdo do painel pelo daquele documento, sem alterar a lista de resultados nem a posição de rolagem dela.

O painel NÃO SHALL ser apresentado quando não houver documento em foco.

A ação de abrir o documento SHALL ter o mesmo efeito do link no resultado: redirecionar o usuário à fonte original. O painel NÃO SHALL apresentar o texto integral do documento.

#### Scenario: Resumo do primeiro resultado

- **GIVEN** que uma busca retornou resultados
- **WHEN** a lista é apresentada
- **THEN** o painel passa a apresentar o primeiro documento da página

#### Scenario: Resumo solicitado em outro documento

- **GIVEN** que o painel apresenta um documento
- **WHEN** o usuário aciona a geração de resumo em outro resultado
- **THEN** o painel passa a apresentar o documento escolhido
- **AND** a lista de resultados permanece inalterada

#### Scenario: Navegação por um documento relacionado

- **GIVEN** que o painel apresenta um documento e sua pilha de relacionados
- **WHEN** o usuário aciona um item da pilha
- **THEN** o painel passa a apresentar o documento daquele item
- **AND** a lista de resultados permanece inalterada

#### Scenario: Painel identifica a origem do documento

- **GIVEN** que o painel apresenta um documento
- **WHEN** ele é exibido
- **THEN** o nome do documento e a fonte de onde ele vem são apresentados

#### Scenario: Abertura pelo painel

- **GIVEN** que o painel apresenta um documento
- **WHEN** o usuário aciona a ação de abrir
- **THEN** o documento é aberto em sua fonte original
- **AND** o acesso é registrado como em qualquer outra abertura

#### Scenario: Busca sem resultados

- **GIVEN** que a busca não retornou documentos
- **WHEN** a tela é apresentada
- **THEN** o painel de resumo não é apresentado

### Requirement: Indicação de progresso durante a geração

Enquanto uma geração estiver em andamento, o painel SHALL apresentar indicação de progresso, com mensagens que nomeiem a etapa em curso e mudem ao longo da espera.

A indicação SHALL corresponder a trabalho efetivamente em andamento. O sistema NÃO SHALL apresentar indicação de geração quando não houver geração ocorrendo, nem adiar a apresentação de um resumo já gravado para simular processamento.

A lista de resultados SHALL permanecer utilizável durante a geração: buscar, filtrar, paginar e abrir documentos NÃO SHALL depender do término dela.

#### Scenario: Geração em andamento

- **GIVEN** que o usuário solicitou um resumo ainda não gravado
- **WHEN** a obtenção do texto ou a submissão à LLM está em andamento
- **THEN** o painel apresenta indicação de progresso nomeando a etapa em curso
- **AND** a mensagem muda conforme a espera se prolonga

#### Scenario: Resumo já gravado aparece de imediato

- **GIVEN** que o documento em foco já possui resumo gravado
- **WHEN** o painel passa a apresentá-lo
- **THEN** o resumo é apresentado imediatamente
- **AND** nenhuma indicação de geração é apresentada

#### Scenario: Lista utilizável durante a geração

- **GIVEN** que uma geração está em andamento
- **WHEN** o usuário realiza uma nova busca ou muda de página
- **THEN** a operação é atendida normalmente
- **AND** não espera pelo término da geração

#### Scenario: Foco trocado durante a geração

- **GIVEN** que uma geração está em andamento para um documento
- **WHEN** o usuário solicita o resumo de outro documento
- **THEN** o painel passa a refletir o documento mais recentemente escolhido
- **AND** o resultado da geração abandonada não substitui o conteúdo do painel

### Requirement: Falha na geração do resumo

A falha ao gerar um resumo NÃO SHALL impedir a apresentação nem o uso dos resultados da busca.

O sistema SHALL distinguir credencial ausente, credencial inválida, limite de requisições excedido e falha de comunicação, informando ao usuário qual ocorreu.

#### Scenario: Falha ao gerar o resumo

- **GIVEN** que uma busca retornou resultados
- **WHEN** a geração do resumo do primeiro documento falha
- **THEN** a lista de resultados permanece apresentada e utilizável
- **AND** o painel informa o motivo da falha

#### Scenario: Cota da LLM excedida

- **GIVEN** que a cota da chave da LLM foi atingida
- **WHEN** um resumo é solicitado
- **THEN** o sistema informa que o limite foi excedido
- **AND** indica que a operação pode ser repetida mais tarde

#### Scenario: Chave da LLM não configurada

- **GIVEN** que nenhuma chave de LLM foi configurada
- **WHEN** os resultados da busca são apresentados
- **THEN** o painel informa que o recurso exige configuração
- **AND** oferece acesso à tela de configurações

#### Scenario: Chave da LLM inválida

- **GIVEN** que a chave configurada foi recusada pelo serviço
- **WHEN** um resumo é solicitado
- **THEN** o painel informa que a credencial não é válida
- **AND** distingue esse caso de uma falha de comunicação

### Requirement: Alcance do painel por teclado e por leitores de tela

O painel, a ação de gerar resumo em cada resultado e cada item da pilha de documentos relacionados SHALL ser alcançáveis por teclado, na ordem de leitura visual.

A troca do conteúdo do painel SHALL ser anunciada por leitores de tela, assim como a conclusão de uma geração.

A informação apresentada no painel NÃO SHALL depender apenas de cor para ser compreendida.

#### Scenario: Percurso por teclado

- **GIVEN** que a lista de resultados e o painel estão apresentados
- **WHEN** o usuário percorre a tela pelo teclado
- **THEN** a ação de gerar resumo de cada resultado, as ações do painel e os itens da pilha de relacionados são alcançados
- **AND** a ordem segue a leitura visual da tela

#### Scenario: Troca de conteúdo anunciada

- **GIVEN** que um leitor de tela está em uso
- **WHEN** o conteúdo do painel é substituído
- **THEN** a troca é anunciada

#### Scenario: Conclusão da geração anunciada

- **GIVEN** que uma geração estava em andamento
- **WHEN** o resumo é apresentado
- **THEN** a conclusão é anunciada
