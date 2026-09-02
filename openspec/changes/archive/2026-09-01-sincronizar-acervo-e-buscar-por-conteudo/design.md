# Design — Sincronização do acervo e busca pelo conteúdo

**Issue:** #65

## Context

Ver `proposal.md` — *Why*. O que já existe e sustenta esta mudança:

- `conteudo/ingestao.ts` tem `ingerirAcervo()`: percorre o inventário do GitHub, baixa cada blob, extrai o texto e grava em `conteudo_documentos`. É serial, incremental, retomável, cede a vez à busca (`prioridade.ts`) e descarta o texto de documentos que saíram do inventário. `index.ts` já a dispara na abertura (`void ingerirAcervo()`).
- O canal `conteudo:indexar` já existe: aciona `ingerirAcervo()` e responde com `ProgressoIngestao` (contagens) ao final. A ponte (`preload/index.ts`) já expõe `indexarConteudo`. **Nenhum componente do renderer o aciona hoje**, e não há progresso visível.
- `busca/regras.ts` faz a correspondência de termo por nome e autor. `busca/servico.ts` mantém em memória o resultado completo da consulta vigente, para reordenar e paginar sem custo de rede.
- `conteudo_documentos` é coleção NeDB **aberta sob demanda** — a ADR-0005 pediu isso para que o caminho da busca não carregasse texto. Esta mudança altera essa premissa: a busca por conteúdo precisa do texto no caminho da busca.
- `test/seguranca/fronteira-conteudo.test.ts` invoca todo canal registrado e falha se algum devolver texto de documento.

## Goals / Non-Goals

**Goals:**

- A correspondência de termo passa a alcançar o texto armazenado, sem que o texto saia do processo principal.
- A ingestão do acervo ganha gatilho manual e progresso visível, sem deixar de rodar na abertura.
- Uma sincronização de cada vez, venha o disparo da abertura ou do botão.
- A busca continua utilizável enquanto a sincronização corre, e diz quando o alcance pelo conteúdo ficou incompleto.

**Non-Goals:**

- Índice de documentos, classificação por IA, busca por assunto/etiquetas — isso é `resumos-e-indice-por-ia`, intocada aqui.
- Trecho, realce ou qualquer apresentação do texto onde o termo casou.
- Busca vetorial ou por similaridade — a correspondência é literal, como já é por nome.
- Alterar a forma de visualizar um documento — segue por redirecionamento à fonte.
- Cancelar a sincronização pela interface. O botão dispara; não há botão de parar nesta mudança.

## Decisions

### 1. A correspondência pelo conteúdo roda no processo principal e devolve só a marca

`busca/servico.ts` lê o texto de `conteudo_documentos` e aplica o mesmo casamento literal — sem acento, sem caixa — que `regras.ts` já usa para nome e autor. O resultado de cada documento ganha um campo booleano ("casou no conteúdo"); o **texto não entra na resposta**.

**Ajuste feito na implementação:** no conteúdo o termo casa como **palavra inteira**, não como substring. Nome e autor são curtos, e substring ali é o esperado — "ata" acha `ata-template.md`. Um documento tem milhares de palavras, e "ata" como substring casa com "tr**ata**mento", "d**ata**" e "pl**ata**forma" em praticamente todo arquivo do acervo (medido: 71 de 86 documentos para o termo "ata"). Com a fronteira de palavra, cai para os documentos que de fato mencionam "ata".

O motivo é a ADR-0005: nenhum canal devolve texto ao renderer. Um trecho com realce seria texto atravessando a ponte, e exigiria ADR nova e afrouxar `fronteira-conteudo.test.ts`. A marca responde à pergunta que o usuário faria — "por que este documento está aqui?" — sem cruzar a fronteira. `fronteira-conteudo.test.ts` é estendido para cobrir o canal de busca: o resultado carrega a marca, nunca o texto.

**Descartado: trecho com realce.** Fica para uma decisão própria, com ADR, se a equipe quiser.

### 2. A correspondência é aditiva, sobre o inventário inteiro

O conjunto de candidatos já é o inventário completo. A correspondência pelo conteúdo é mais um predicado em OU: um documento entra se o termo casa com nome, autor **ou** texto. Um documento que só casa pelo conteúdo aparece como qualquer outro resultado — mesma ordenação, mesma paginação, mesmo cartão, com a marca a mais.

**Ligada sob demanda, não por padrão** (decidido na implementação, após o uso real). A intenção original era não ter "modo separado" — mas na prática a busca no conteúdo, mesmo casando por palavra inteira, alcança quase todo documento para termos comuns ("sprint" casa em 4 arquivos pelo nome e em 3 ADRs que citam a palavra). O usuário que busca por nome vê o resultado "sujo". A caixa **"Buscar no conteúdo"** (`filtros.buscarConteudo`, desligada por padrão) resolve isso sem virar um seletor de campo: ela não pede "buscar no nome" vs "buscar no autor" — apenas amplia o alcance para incluir o texto. Com ela desligada, `servico.ts` nem abre a coleção de conteúdo, e a busca é exatamente a de antes (nome e autor).

### 3. Aceitar carregar o texto no caminho da busca

A busca por conteúdo precisa do texto de `conteudo_documentos` quando há termo **e a caixa "Buscar no conteúdo" está marcada** (ver decisão 2). A coleção é aberta sob demanda; a partir daqui, uma busca nessas condições a abre. Para o acervo atual — e sob o teto de `LIMITE_CARACTERES_TOTAL` (50 MB) — isso cabe em memória sem problema.

É o preço de ter busca por conteúdo **sem** um índice invertido. O índice de verdade é `resumos-e-indice-por-ia`; enquanto ele não existe, a varredura linear do texto já carregado é suficiente e simples. A ADR-0002 e a ADR-0005 já registram "reavaliar caso cresça" — quando crescer, a resposta é aquele índice, não um remendo aqui.

**Descartado: manter a coleção fechada e obter texto documento a documento durante a busca.** Multiplicaria leituras de disco por resultado e ainda assim carregaria tudo aos poucos.

### 4. Aviso de alcance parcial reaproveita o canal de `avisos`

Quando há termo e nem todo documento do inventário tem registro de conteúdo vigente, a busca acrescenta um `aviso` dizendo que a correspondência pelo conteúdo cobriu parte do acervo, com a contagem. É o mesmo canal de "resultado parcial" já usado para árvore truncada e repositório inacessível — a situação é a mesma: veio resultado, com ressalva.

O aviso some sozinho quando a primeira sincronização completa cobre o inventário.

### 5. Uma sincronização de cada vez, com guarda de execução

`ingerirAcervo()` ganha uma guarda: se já há uma varredura em andamento, uma nova chamada **junta-se à que corre** (aguarda e devolve o mesmo progresso final) em vez de iniciar outra. O disparo da abertura em `index.ts` e o do canal `conteudo:indexar` passam os dois por essa guarda.

Sem isso, abrir a aplicação e clicar em "Sincronizar" logo em seguida dispararia duas varreduras concorrentes competindo pela mesma cota do GitHub — o oposto do que o botão promete.

### 6. Progresso por consulta, não por evento empurrado

`ingerirAcervo()` passa a manter um retrato em memória do andamento — estado (`parada` | `em-andamento` | `concluida` | `suspensa`), as contagens de `ProgressoIngestao` e o motivo de suspensão. Um canal novo de leitura (`sincronizacao:estado`, contagens apenas) devolve esse retrato. O renderer consulta esse canal ao montar e, enquanto o estado for `em-andamento`, em intervalo modesto, até concluir ou suspender.

É o modelo de request/response que o resto do código já usa — inclusive a atualização dos recentes em segundo plano é puxada pelo renderer, não empurrada. Manter a disciplina evita introduzir `webContents.send` só para isto. O canal devolve contagens e estado; `fronteira-conteudo.test.ts` o cobre como cobre os demais.

**Descartado: empurrar progresso com `webContents.send`.** Mais fluido, mas quebra o padrão e amplia a superfície do que trafega pela ponte. Pode ser adotado depois sem mexer na spec.

### 7. O botão fica no cabeçalho, ao lado das configurações

Botão de ícone com rótulo acessível, ao lado do acesso às configurações — os dois são ações sobre a aplicação, não sobre a lista. Estados: **parada** (acionável), **em andamento** (progresso em contagens, não acionável), **concluída** (volta a acionável), **suspensa** (mostra o motivo, acionável para tentar de novo). Alcançável por teclado, foco assinalado. O teste de tabulação existente é estendido.

Falha ou suspensão da sincronização não trava busca nem lista — a spec `busca-documentos` já garante que a ingestão não bloqueia a consulta, e isso continua valendo.

### 8. A busca com termo ou período é servida de um snapshot local da sincronização

**Decidido depois do uso real, na mesma mudança.** A busca com termo faz `coletar` (inventário) e depois `enriquecerParaBusca` → `detalhar`, que resolve **autoria e data real de cada documento** com uma requisição ao GitHub por documento. Mesmo com o cache por ETag — em que o GitHub responde `304` sem gastar cota —, cada uma é uma ida à rede. Para um acervo de ~95 documentos são ~95 requisições, 6 em paralelo, **a cada busca**: alguns segundos de espera, e o custo cresce com o acervo. O texto já vinha do banco local e não era o gargalo.

A sincronização já percorre o inventário inteiro em segundo plano. A decisão é fazê-la também **gravar o inventário** (`acervo_documentos`, NoSQL, aberta sob demanda como `conteudo_documentos`) e **resolver a autoria** de cada documento ali, reaproveitando o já resolvido pelo `sha` do blob — a mesma regra de vigência que o texto usa. A busca com termo ou período passa a montar o resultado desse snapshot: sem `coletar`, sem `enriquecerParaBusca`, sem rede. O conjunto retido (`vigente`), `mesmaConsulta`, a ordenação e a paginação não mudam.

**Trade-off aceito:** a busca reflete a última sincronização, não o GitHub no instante da consulta. Documento novo na fonte não aparece até sincronizar; documento apagado continua aparecendo até lá. Mitiga: a sincronização roda na abertura e está no cabeçalho, com estado visível. Enquanto `acervo_documentos` está vazia (nunca sincronizada), `inventarioSincronizado()` devolve `[]` e a busca cai no caminho ao vivo de hoje — nenhuma regressão para quem ainda não sincronizou.

**Autoria pendente vira aviso, como o alcance parcial do conteúdo.** No caminho do snapshot não há teto de 300 (a autoria já está resolvida para todos); em seu lugar, quando algum documento ainda está sem autoria sincronizada, a busca acrescenta um `aviso` com a contagem. O aviso "considerou os 300 primeiros" permanece, mas só no caminho ao vivo.

**Descartado: janela de validade / memória de sessão para a autoria, sem persistir o inventário.** Resolveria a latência das buscas repetidas com menos mudança, mas deixaria a primeira busca de cada sessão lenta e não removeria a dependência de rede da busca. Persistir o snapshot na sincronização é o que o botão "Sincronizar" já promete implicitamente — "o acervo está pronto para ser buscado".

**Descartado: servir também os recentes (sem termo) do snapshot.** Os recentes vêm dos commits, com data real e custo baixo (poucos repositórios), e é a tela de abertura — deve refletir o que acabou de ser publicado. Fica ao vivo.

## Risks / Trade-offs

**Texto carregado em memória no caminho da busca.** A partir daqui, uma busca com termo abre a coleção de conteúdo. → Mitigação: os tetos por documento e no total já existem; para o acervo atual está longe de doer; e a solução estrutural (índice invertido) já está proposta em `resumos-e-indice-por-ia`. O risco é conhecido e datado nas ADR-0002 e 0005.

**Resultado que casou só pelo conteúdo pode confundir.** Sem o trecho, o usuário vê um documento cujo nome não tem nada a ver com o que ele digitou. → Mitigação: a marca "encontrado no conteúdo" no cartão diz por que ele está ali. É menos do que um trecho, e é o máximo que a fronteira da ADR-0005 permite sem ADR nova.

**Aviso de alcance parcial repetido até a primeira sincronização terminar.** Toda busca com termo mostra a ressalva enquanto o acervo não foi coberto. → Mitigação: a primeira varredura do acervo atual termina em pouco tempo; o aviso é honesto enquanto dura; e ele traz a contagem, então o usuário vê o número encolher.

**Consulta de progresso em intervalo é repetitiva.** → Mitigação: só enquanto o estado for `em-andamento`; intervalo modesto; a resposta é minúscula (contagens).

**Guarda de execução e o sinalizador `cancelada` existente.** A guarda nova precisa conviver com o `cancelada` de `ingestao.ts` sem deixar o estado presa em `em-andamento` após uma interrupção. → Mitigação: a guarda libera no `finally` da varredura, junto com a escrita do estado final.

**Busca defasada em relação à fonte (decisão 8).** A busca com termo ou período responde pelo snapshot local, não pelo GitHub no instante da consulta. → Mitigação: sincronização na abertura e no cabeçalho, com estado visível; snapshot vazio cai no caminho ao vivo; para o acervo do MVP a varredura completa é rápida. A defasagem é a mesma natureza da lista de recentes vinda do cache na abertura, que a spec já aceita.

**Autoria resolvida na sincronização engorda a varredura.** ~1 requisição a mais por documento na primeira varredura. → Mitigação: é segundo plano, cede a vez à busca, e a partir da segunda varredura só reresolve o que teve o `sha` do blob alterado. O custo total à cota cai: a busca deixa de repetir essas requisições a cada consulta.

## Migration Plan

Aditiva. `conteudo_documentos` e `preferencias` não mudam de forma. A coleção `acervo_documentos` é nova e nasce vazia: até a primeira sincronização, `inventarioSincronizado()` devolve `[]` e a busca usa o caminho ao vivo — nenhuma migração, nenhuma regressão. Nenhum dado a converter. Reverter é retirar o botão, não registrar o canal de estado, voltar `regras.ts` a casar só por nome e autor e a busca a `coletar` + `enriquecerParaBusca` — o texto e o snapshot já gravados continuam no lugar, servindo às mudanças de IA e a uma futura reativação.

Sem ADR nova: a ADR-0005 já autoriza o texto a repousar na máquina, e esta mudança apenas o consulta localmente. Nenhuma submissão a serviço externo é introduzida.

Documentação a acertar na mesma entrega: o `README.md` (a busca alcança o conteúdo; há botão de sincronizar), o `AGENTS.md` (a "Busca por conteúdo (full-text)" sai da lista de escopo adiado) e o `GlossarioTecnico.md` (entrada para busca por conteúdo e sincronização do acervo).

## Open Questions

- **Intervalo de consulta do progresso, ou troca para evento empurrado.** É detalhe de implementação: não muda o comportamento especificado nem o canal, que devolve contagens de um jeito ou de outro.
- **Normalizar marcação Markdown antes de casar o termo.** O texto extraído já colapsa espaços, mas mantém `#`, `*` e afins. Casar "titulo" dentro de `# titulo` já funciona por substring; se a equipe quiser ignorar a sintaxe, é um ajuste na normalização que não afeta a spec.
