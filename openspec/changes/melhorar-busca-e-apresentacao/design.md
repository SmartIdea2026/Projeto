# Design — Busca e apresentação dos resultados

## Context

A ordenação hoje é aplicada em dois lugares que discordam. O renderer reordena localmente quando só o critério muda — comportamento correto e testado. O processo principal, em `busca/servico.ts`, chama `prepararRecentes`, que fixa `'data-desc'` no código e ignora `filtros.ordenacao`. O resultado: na tela inicial a escolha do usuário vale até a primeira recarga da lista, e então desaparece sem aviso.

As duas fontes de verdade da especificação também discordam entre si, e por isso a correção não é apenas de código: `Nova consulta ao alterar filtros` obriga a consultar as fontes a cada filtro alterado, enquanto `Ordenação dos resultados` proíbe consultar ao ordenar. Como a ordenação é campo de `Filtros`, os dois requisitos não podem ser satisfeitos ao mesmo tempo.

Sobre autoria: a árvore Git (`git/trees?recursive=1`) devolve o inventário do repositório em uma requisição, mas **não traz autor nem data por arquivo**. É o motivo pelo qual a busca hoje atribui a todos os documentos o `pushed_at` do repositório, marcando-os com `dataAproximada`. Obter o dado real exige `GET /repos/{repo}/commits?path=<arquivo>&per_page=1` — uma chamada por arquivo. Foi exatamente esse custo que adiou o item no MVP.

## Goals / Non-Goals

**Goals:**

- A ordenação escolhida vale em todas as telas e sobrevive à recarga da lista
- Ordenação por data estável, com desempate por nome
- Paginação de 10, com contador do total encontrado
- Autoria e data real da última alteração nos documentos apresentados
- Custo de API contido e previsível

**Non-Goals:**

- Qualquer uso de IA — é a segunda mudança
- Índice local de documentos — é a segunda mudança
- Busca por conteúdo ou contexto — depende do índice
- Retomada do Google Drive, fora do escopo pela ADR-0004

## Decisions

### 1. A ordenação deixa de ser filtro de consulta

`prepararRecentes` passa a receber e aplicar `filtros.ordenacao` em vez da constante. A separação entre "filtro que muda o conjunto obtido" e "critério que muda a apresentação" passa a ser explícita na especificação, resolvendo a contradição.

O renderer mantém a reordenação local: ela evita consulta desnecessária e continua correta. A correção no processo principal garante que o critério não seja descartado quando a lista *é* legitimamente recarregada.

### 2. Desempate por nome dentro de `ordenar`

O desempate vai para `compartilhado/ordenacao.ts`, onde a função já vive e já é usada pelos dois processos. Fazê-lo ali garante que a regra valha igualmente na reordenação local e na do processo principal — colocá-lo em só um dos lados reintroduziria a divergência que esta mudança existe para eliminar.

Alternativa descartada: ordenar por chave composta apenas na camada de apresentação. Deixaria o processo principal produzindo ordem instável, visível sempre que o resultado viesse do cache.

### 3. Paginação no processo principal, sobre o resultado ordenado

A paginação incide depois de filtrar e ordenar, para que a primeira página seja de fato a de maior precedência. `ResultadoBusca` passa a carregar o total encontrado além da fatia apresentada — o contador precisa do total, não do tamanho da página.

Alternativa descartada: paginar no renderer. Simplifica o transporte, mas obriga a mandar o resultado inteiro por IPC e desperdiça a chance de limitar as consultas de autoria à página visível.

### 4. Autoria só da página visível, em segundo plano

Ao apresentar uma página, o sistema consulta `commits?path=` **apenas dos até 10 documentos visíveis**, com a concorrência já limitada que `porRepositorio` usa e com cache por `ETag`. Navegar para outra página consulta a nova página.

A consulta não bloqueia a lista: os documentos aparecem imediatamente com o que já se sabe, e autoria e data real preenchem quando chegam. Um documento cuja consulta falhe é apresentado sem esses campos, sem erro — mesma disciplina de resultado parcial já adotada.

Quando a data real chega, ela substitui a aproximação e `dataAproximada` deixa de ser marcada naquele documento. Consequência a aceitar: a ordenação por data pode reorganizar levemente a página quando as datas reais chegam. É preferível a exibir data errada.

### 5. Disposição dos filtros conforme o protótipo

Filtros abaixo da barra de busca; contador à esquerda e ordenação à direita, na linha acima da lista. O protótipo mostra também filtros de "Tipo" e "Fonte" que não fazem parte desta mudança: "Tipo" pressupõe classificação por IA (segunda mudança) e "Fonte" só faz sentido com mais de uma fonte, hoje inexistente pela ADR-0004.

## Risks / Trade-offs

**Cota do GitHub.** Até 10 chamadas adicionais por página navegada. Com o limite de 5.000 requisições/hora de um token autenticado, e com `ETag` respondendo 304 sem consumir cota, a margem é confortável. O risco real é o usuário paginar repetidamente: mitigado pelo cache, já que revisitar uma página não gera consulta nova.

**Reorganização visível.** Quando a data real substitui a aproximada, um documento pode mudar de posição sob os olhos do usuário. Alternativa seria segurar a lista até todas as datas chegarem, o que troca um incômodo pequeno por uma espera de até 10 requisições.

**Contradição resolvida por reinterpretação.** A mudança reescreve um requisito vigente em vez de criar um novo. É o caminho correto — os dois requisitos eram incompatíveis, então um deles estava errado —, mas exige que a revisão confirme a leitura antes do archive.

**Autoria no GitHub identifica o commit, não necessariamente o autor do documento.** Quem fez o último commit pode ter apenas movido ou reformatado o arquivo. O campo será rotulado como última alteração, não como autoria intelectual.
