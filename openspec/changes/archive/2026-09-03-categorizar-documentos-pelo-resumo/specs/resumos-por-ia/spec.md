## MODIFIED Requirements

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

## ADDED Requirements

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
