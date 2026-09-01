# Design — Painel de resumo por IA

**Issue:** #65

## Context

Ver `proposal.md` — *Why*. O que importa aqui é o que já existe para apoiar isto.

A mudança `ingerir-conteudo-dos-documentos` deixou pronto o essencial: a coleção `conteudo_documentos` guarda o texto de cada documento com o `sha` do blob que o originou, e `textoDoDocumento` obtém sob demanda o que ainda falta. O texto está confinado ao processo principal, e há um teste que invoca **todos** os canais registrados e falha se algum devolver conteúdo. Existe também `prioridade.ts`, pelo qual o trabalho de fundo cede a vez ao trabalho interativo.

A ADR-0005 autorizou o texto a **repousar** na máquina. Nada até aqui autoriza o texto a **sair** dela, e é essa a fronteira que esta mudança atravessa.

A interface é uma coluna só: cabeçalho, busca, filtros e lista. Não há painel lateral nem leiaute de duas colunas.

## Goals / Non-Goals

**Goals:**

- Resumo do documento em foco visível sem sair da tela, e sem o usuário achar que o programa travou enquanto ele é produzido.
- Custo em cota proporcional aos documentos distintos resumidos, não ao número de buscas.
- A lista de resultados continua utilizável durante qualquer geração.
- O usuário sabe que o conteúdo sai da máquina antes de sair.

**Non-Goals:**

- Classificar **todo** o acervo. Aqui a classificação sai de brinde na mesma chamada do resumo, para o documento em foco. Percorrer o acervo inteiro é a mudança `resumos-e-indice-por-ia`.
- Busca por contexto. Depende da classificação de todo o acervo, e por isso segue naquela mudança.
- Resumir automaticamente todos os resultados. Só o primeiro da página, e os que o usuário pedir.
- Apresentar o texto do documento. O painel mostra o resumo; ler o documento continua sendo abrir na fonte.

## Decisions

### 1. O resumo mora junto do texto que o originou

Os campos de resumo entram no registro de `conteudo_documentos`, e não em coleção nova.

O motivo é a invalidação. O resumo é derivado do texto; os dois envelhecem no mesmo instante e pelo mesmo motivo — o `sha` do blob mudou. No mesmo registro, um único campo `versaoConteudo` governa ambos, e é **impossível** ficarem em desacordo. Separados, seria preciso manter duas datas coerentes entre si, e a primeira vez que alguém esquecesse produziria um resumo antigo apresentado ao lado de um texto novo, sem nada indicando o descompasso.

**Descartado: os campos `resumo` e `resumoEm` reservados em `documentos_acessados`.** A ADR-0002 os previu exatamente para este momento, e ainda assim não servem: aquela coleção só registra documentos que o usuário **abriu**. O painel resume o primeiro resultado de uma busca, que na maioria das vezes nunca foi aberto — não haveria registro onde gravar. Vale dizer isto em voz alta, porque a reserva foi uma decisão da equipe e ignorá-la em silêncio seria pior do que explicar por que não coube.

**Cuidado que isso exige.** `gravarConteudo` grava com `$set` dos campos nomeados, então campos não citados sobrevivem. Uma reingestão por `sha` novo escreveria texto novo e **deixaria o resumo antigo de pé**, agora descrevendo outra coisa. A gravação do conteúdo precisa limpar explicitamente os campos de resumo quando a versão muda. É uma linha de código e um teste; sem eles, o defeito é silencioso e plausível.

### 2. Uma submissão, com saída estruturada

O painel precisa de resumo em prosa, tipo, assuntos e destaques. Uma chamada devolve os quatro, usando saída estruturada da API (`responseMimeType: application/json` com um `responseSchema`).

Duas razões, e a segunda é a que decide:

1. **Cota.** Quatro chamadas custariam quatro vezes mais em um plano gratuito cujo limite é por requisição.
2. **Coerência.** Chamadas separadas podem discordar entre si — um resumo que descreve uma ata e um "tipo identificado" que diz "especificação". Vindo da mesma resposta, discordar exige que o modelo se contradiga dentro de um mesmo JSON.

**Descartado: prosa livre e extração por análise do texto.** Adivinhar o tipo e os assuntos a partir de um parágrafo é heurística sobre heurística, e quebra em silêncio quando o modelo muda de formato.

### 3. As frases de carregamento nomeiam a etapa, e não passam o tempo

O estado do painel vem do que está acontecendo:

| Situação real | O que o painel mostra |
| --- | --- |
| Resumo já gravado e vigente | o resumo, imediatamente |
| Obtendo o texto na fonte | "Lendo o documento…" |
| Aguardando a resposta da LLM | "Gerando o resumo…" |
| Aguardando há mais de ~8 s | "Ainda gerando, aguarde…" |

Só a última linha é temporal, e é honesta: ela aparece porque a espera **está** longa.

Nada disso é apresentado quando o resumo já está no banco. Um resumo pronto aparece pronto: adiar a exibição para exibir "Gerando…" faria o sistema afirmar que está gerando o que já estava gerado — e trocaria uma resposta instantânea por uma espera fabricada, que é o oposto de cuidar de quem usa.

### 4. Foco vence resposta atrasada

O usuário pede o resumo de A, muda de ideia e pede o de B antes de A responder. Se a resposta de A chegar depois, ela **não** pode substituir o painel.

O painel guarda o identificador do documento em foco; ao resolver, uma geração compara o identificador dela com o vigente e se descarta quando não coincide. É o defeito clássico de painel assíncrono, e ele se manifesta justamente quando a rede está lenta — quando o usuário mais tende a trocar de item.

O resultado descartado ainda assim é **gravado**: ele custou uma chamada de cota e é válido para aquele documento. Descartar a apresentação é diferente de jogar fora o trabalho.

### 5. Geração é trabalho interativo

A geração passa por `comoInterativa`, o mesmo mecanismo da busca. Motivo: quando o texto ainda não está no banco, a geração precisa baixá-lo, e esse download disputa cota do GitHub com a ingestão de fundo. Sendo interativa, ela tem precedência — há alguém olhando para o painel.

As submissões à própria LLM ocorrem **uma por vez**, em fila. É outro recurso, com outra cota, e o limite do plano gratuito é por minuto: disparar em paralelo transformaria três cliques rápidos em três recusas.

### 6. O consentimento é anterior ao primeiro envio, inclusive ao automático

O resumo do primeiro resultado é gerado sozinho ao fim de uma busca. Isso significa que, sem cuidado, o **primeiro** envio de conteúdo ao Google aconteceria sem que ninguém tivesse clicado em nada.

Então: enquanto não houver consentimento registrado, o painel não gera nada — apresenta o pedido de confirmação no lugar do resumo. A decisão fica gravada em uma coleção `preferencias` no banco local. Não vai para o cofre, que é para segredos, e uma preferência não é um segredo.

Recusar mantém tudo o mais funcionando: busca, filtros, paginação e abertura seguem iguais, e apenas o painel fica sem resumos.

### 7. Duas colunas, com a lista mandando na largura

Leiaute em `grid`, lista à esquerda e painel à direita, seguindo o protótipo. Abaixo de uma largura mínima o painel desce para baixo da lista, em vez de espremer as duas colunas — em janela estreita, duas colunas apertadas são piores que uma coluna inteira.

O painel é `<aside>` com região anunciável, e a troca do conteúdo é anunciada por `aria-live`. A ordem de tabulação segue a leitura visual, e há teste de tabulação no projeto que precisa ser estendido — ele já quebrou de propósito outras vezes quando o leiaute mudou, e é assim que se sabe que continua valendo.

### 8. A chave do Gemini não volta ao renderer

Mesmo tratamento do token do GitHub: `safeStorage`, gravação unidirecional, nenhum canal de leitura. O teste de fronteira de credenciais é estendido para cobrir a chave nova, e o de conteúdo já cobre o texto — que agora também transita numa chamada de rede nova, e continua não podendo voltar pela ponte.

## Risks / Trade-offs

**O conteúdo sai da máquina — o risco central.** No plano gratuito da API do Gemini, o conteúdo submetido pode ser usado para melhorar os produtos do Google e passar por revisão humana. A equipe decidiu prosseguir ciente disso. → Mitigação: a ADR nomeia o risco; o consentimento é pedido antes do primeiro envio; só o documento em foco é submetido, nunca o acervo; e a tela de configurações mantém o aviso acessível depois. Nada disso elimina o risco — apenas garante que ele seja escolhido, e não sofrido.

**Cota consumida sem clique.** O resumo do primeiro resultado é automático, então buscar consome cota mesmo sem ninguém pedir resumo algum. → Mitigação: apenas o primeiro documento da página; reuso do resumo gravado, que zera o custo da segunda vez em diante; submissões em série; e suspensão informada quando a cota estourar.

**Resumo convincente e errado.** Um modelo de linguagem erra com a mesma fluência com que acerta, e um resumo bem escrito de um documento que ele entendeu mal é indistinguível de um bom resumo. → Mitigação: o painel é rotulado como resumo por IA, o nome e a fonte do documento estão sempre visíveis, a ação de abrir o original fica ao alcance, e o arquivo de instrução manda ater-se ao texto recebido. Não há mitigação técnica que torne o resumo confiável; há como deixar claro o que ele é.

**Resumo de um texto truncado.** O registro de conteúdo já marca `truncado` quando o texto foi cortado no limite por documento. Um resumo feito sobre a primeira parte parece completo e não é. → Mitigação: o painel informa quando o resumo se baseia em texto parcial. A marca já existe; o que faltaria é usá-la.

**Resumo antigo colado em texto novo.** Descrito na decisão 1. → Mitigação: limpar os campos de resumo na gravação do conteúdo quando a versão muda, com teste que reingere com `sha` diferente e verifica que o resumo sumiu.

**Uma dependência de rede a mais no processo que guarda as credenciais.** → Mitigação: HTTP direto, sem SDK, como no GitHub; a chave viaja em cabeçalho, e não na URL, para não acabar em log de proxy ou histórico.

## Migration Plan

Aditiva. Os campos de resumo entram nos registros existentes de `conteudo_documentos` como ausentes, e ausência já significa "sem resumo" — nenhum dado precisa ser convertido. A coleção `preferencias` nasce vazia, e ausência de consentimento é o estado inicial correto.

Reverter é retirar o painel e não registrar o canal; o texto ingerido continua servindo à mudança seguinte.

A ADR precisa existir **antes** do código que faz a primeira chamada. Escrevê-la depois seria registrar um fato consumado.

## Open Questions

- **Qual modelo do Gemini.** A escolha entre os modelos rápidos do plano gratuito afeta custo e qualidade, mas não afeta especificação, desenho nem tarefas: é um identificador em um lugar só. Fica para a implementação medir com documentos reais do repositório.
- **O texto do arquivo de instrução.** A estrutura do resumo está especificada; a redação exata da instrução é justamente o que a equipe vai querer ajustar depois de ver os primeiros resultados, e é por isso que ela vive em arquivo versionado e não no código.
