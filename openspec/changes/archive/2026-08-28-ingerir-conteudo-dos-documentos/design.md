# Design — Ingestão do conteúdo dos documentos

**Issue:** #65

## Context

Ver `proposal.md` — *Why*. O que importa aqui é o estado de onde se parte.

A integração com o GitHub obtém o inventário de cada repositório em **uma requisição**, pela árvore Git (`git/trees?recursive=1`). A resposta já traz, por arquivo, o `path`, o `type` e o `sha` — o `sha` inclusive já está declarado na interface `ArvoreApi` de `fontes/github.ts`, ainda que não seja usado. Toda requisição passa por `requisitar`, que cuida de `ETag`, 304, 401, 403, 429 e queda de rede, e sempre encerra com `resposta.json()`.

A data de modificação dos documentos vindos do inventário é o `pushed_at` do repositório, igual para todos os arquivos dele, marcada com `dataAproximada` justamente porque não é a data real do arquivo. Esse detalhe decide um ponto central do desenho abaixo.

A persistência é `@seald-io/nedb`, com duas coleções, e **carrega a base inteira em memória ao abrir**. A ADR-0002 registra isso como risco e diz, textualmente, para reavaliar caso os dados cresçam além do esperado.

A ADR-0003 estabelece que nada sensível atravessa o IPC de volta ao *renderer*, e há um teste automatizado que verifica isso para as credenciais.

## Goals / Non-Goals

**Goals:**

- O processo principal consegue obter o texto de qualquer documento aceito do inventário, e reaproveitá-lo sem repetir o download.
- O custo em cota do GitHub é proporcional ao que mudou, não ao tamanho do acervo.
- A busca não fica mais lenta, nem depende da ingestão para responder.
- O consumo de memória do NeDB permanece sob controle, com teto explícito.

**Non-Goals:**

- Não há apresentação do conteúdo. Nada disso aparece na interface, e nenhum canal IPC devolve texto.
- Não há busca pelo conteúdo. A correspondência continua sendo por nome e autor; estender a busca é assunto de `resumos-e-indice-por-ia`.
- Não há envio a serviço externo. Esta mudança traz o conteúdo para dentro; mandá-lo para fora é a mudança seguinte, e tem ADR própria.
- Não há guarda dos bytes originais. O sistema guarda texto, não arquivos.

## Decisions

### 1. Invalidar pelo `sha` do blob, não pela data

O `sha` de um blob Git é o hash do próprio conteúdo. Muda exatamente quando os bytes mudam, e não muda quando o arquivo é apenas tocado por um commit vizinho.

A alternativa natural seria comparar datas, e ela **não funciona aqui**: a data que o inventário atribui a um arquivo é o `pushed_at` do repositório. Um único push em qualquer arquivo avança a data de *todos* os documentos daquele repositório. Invalidar por data significaria rebaixar o acervo inteiro a cada push e rebaixar o download completo junto — o oposto do que a cota permite.

O `sha` custa zero requisições extras: já vem na árvore que o inventário busca de qualquer forma. Gravado ao lado do texto, ele responde à pergunta "isto ainda vale?" sem tocar na rede.

Descartado: `If-None-Match` no endpoint do blob. Funciona, mas gasta uma requisição por arquivo a cada verificação, enquanto o `sha` traz a resposta de todos os arquivos de um repositório em uma só.

### 2. Baixar pelo endpoint de blob, endereçando por `sha`

`GET /repos/{owner}/{repo}/git/blobs/{sha}` com `Accept: application/vnd.github.raw`.

Três razões, em ordem de peso:

1. **Já temos o `sha`.** Endereçar por caminho exigiria resolver o caminho de novo, do lado do GitHub.
2. **Endereçar por conteúdo elimina a corrida.** Entre o inventário e o download pode entrar um push. Pedindo pelo `sha`, recebemos exatamente a revisão que inventariamos — o texto guardado corresponde ao `sha` gravado, sempre. Pedindo por caminho, receberíamos outra coisa e guardaríamos com o `sha` errado.
3. **Limite de tamanho.** O endpoint de conteúdo entrega no máximo 1 MB na forma JSON; o de blob com mídia bruta vai muito além. Não é o gargalo aqui, mas remove um caso especial.

**Consequência para o código:** `requisitar` termina em `resposta.json()` e não serve para bytes. É preciso uma função irmã que devolva `ArrayBuffer` **reaproveitando o mesmo tratamento de 401, 403, 429 e falha de rede** — não duplicando-o. Duplicar essa lógica é como o tratamento de limite de requisições passa a divergir entre dois caminhos sem ninguém perceber.

### 3. Coleção própria, aberta sob demanda

Uma terceira coleção, `conteudo_documentos`, separada das duas existentes.

O motivo é o modelo de memória do NeDB: abrir uma coleção lê o arquivo inteiro para a memória. Se o texto morasse como campo de `documentos_acessados`, listar os últimos acessos — operação que roda na abertura da aplicação — carregaria o texto de todo o acervo junto. Em coleção própria, ela só é aberta quando a ingestão ou um consumidor do texto realmente precisa: a inicialização e o caminho da busca nunca pagam por ela.

Também não cabe em `cache_fontes`: aquela coleção é escrita pelo `requisitar` como cache de resposta de API, com semântica de `ETag` e vida curta. Misturar as duas faria o texto ser sobrescrito pelo caminho genérico de cache.

Cada registro guarda o identificador do documento, o `sha` correspondente, o texto, o estado (`extraido`, `sem-texto`, `excedente`, `falha`), o motivo quando houver, se o texto foi truncado, e a data.

### 4. Extração por formato, sem módulo nativo

| Formato | Estratégia |
| --- | --- |
| `md`, `txt` | decodificação UTF-8 direta, sem biblioteca |
| `pdf` | `pdfjs-dist` — zero dependências, JavaScript puro |
| `docx` | `mammoth` — JavaScript puro |
| `epub` | `jszip` sobre o pacote e extração do texto dos XHTML internos |
| `xls`, `xlsx`, `doc` | **não extraídos**, registrados como `sem-texto` com o motivo |

Nenhuma dependência exige compilação nativa, pela mesma razão que levou o projeto a escolher NeDB em vez de SQLite: não reintroduzir a recompilação para o Electron e o risco de empacotamento que vem com ela.

**Uma ressalva, encontrada ao empacotar e não ao escolher.** O `pdfjs-dist` declara `@napi-rs/canvas` como dependência **opcional**, e o npm a instala por padrão: cerca de 62 MB de binários do Skia, usados só para renderizar páginas de PDF em canvas. Não há compilação — são binários pré-construídos, então o risco original de recompilação não retorna —, mas o pacote passava a carregar código nativo que a aplicação nunca chama. O `electron-builder.yml` exclui `node_modules/@napi-rs/**` do empacotamento, com o motivo escrito ao lado da exclusão.

**Por que planilhas ficam de fora.** O pacote `xlsx` publicado no npm parou na 0.18.5 — a SheetJS mudou a distribuição para o registro próprio dela, e a última versão que restou no npm é anterior à correção do CVE-2023-30533 (poluição de protótipo), publicada na 0.19.3. Trazer uma build parada com aviso de segurança conhecido para dentro do processo que guarda o token do GitHub não compensa pelo texto de uma planilha, que é o menos aproveitável dos formatos aceitos para resumo e classificação. Se a equipe precisar de planilhas, a saída é adotar o pacote do registro da SheetJS de forma deliberada, com decisão registrada — não de passagem, aqui.

**Por que `.doc` fica de fora.** O formato binário do Word 97 não tem extrator mantido em JavaScript puro. `.docx` cobre o que a equipe produz hoje.

Ambos continuam encontráveis pelo nome e continuam abrindo na fonte original: ficar sem texto não é ficar sem documento.

### 5. Ingestão em série, subordinada à busca

Concorrência **um**, e não o conjunto de seis que `detalhar` usa.

A diferença não é arbitrária. `detalhar` roda com o usuário esperando o resultado na tela: paralelizar encurta uma espera real. A ingestão roda em segundo plano, sem ninguém esperando, e o seu único efeito colateral relevante é consumir a mesma cota do GitHub de que a busca depende. Um trabalho sem pressa não deve disputar cota com um trabalho com pressa.

Pela mesma razão, a ingestão cede a vez enquanto houver busca em andamento, e se suspende inteira ao receber 403 ou 429 — o `ErroFonte` já carrega `limiteExcedido`, então a informação já existe e só precisa ser respeitada.

### 6. Tetos explícitos, com o tamanho lido de graça

Três limites, definidos como constantes em um só lugar:

- **2 MB por arquivo.** O tamanho vem do campo `size` da árvore Git, então um arquivo grande demais é descartado **sem gastar requisição alguma** para descobrir isso. Exige acrescentar `size` à interface `ArvoreApi`, que hoje só declara `path`, `type` e `sha`.
- **200 000 caracteres de texto por documento.** Acima disso o texto é truncado e o registro marca que foi.
- **50 MB de texto no total.** Atingido o teto, a ingestão de fundo se suspende, e o que já está guardado continua servindo.

Para o acervo atual — 19 documentos — nenhum desses limites chega perto de valer. Eles existem para que o comportamento no dia em que valerem seja uma decisão escrita, e não uma surpresa.

### 7. O conteúdo não atravessa o IPC

Nenhum canal devolve texto ao *renderer*. O canal que a ingestão precisa expor devolve apenas contagens de progresso.

A garantia se apoia no teste de fronteira que já existe para credenciais, estendido: percorre as respostas de todos os canais registrados e falha se alguma carregar texto de documento. É a mesma disciplina da ADR-0003, aplicada a um segundo tipo de dado sensível.

## Risks / Trade-offs

**O NeDB em memória, agora para valer.** A ADR-0002 previu este momento e mandou reavaliar. → Mitigação em três camadas: coleção própria aberta sob demanda, de modo que os caminhos quentes não a carreguem; tetos por documento e no total; e todo o acesso ao banco continua em `banco/repositorio.ts`, para que trocar o armazenamento de texto por outro afete um arquivo só. O teto de 50 MB é a linha em que a reavaliação deixa de ser teórica.

**O texto fica no disco em claro.** Sem cifragem e sem autenticação — a aplicação é local e monousuário. Quem alcançar o perfil do sistema operacional alcança o texto dos documentos da equipe. → Não há mitigação técnica dentro do escopo desta mudança; há o dever de registrar. A ADR precisa dizer isso com todas as letras, e não deixar implícito.

**Cota do GitHub.** O inventário custa uma requisição por repositório; a ingestão custa uma por arquivo novo ou alterado. É outra ordem de grandeza. → Mitigação: `sha` como invalidação, de modo que o custo seja proporcional ao que mudou; série em vez de paralelo; suspensão em 403 e 429; descarte por tamanho antes do download.

**Três dependências novas no processo que guarda o token.** Toda biblioteca de extração analisa arquivo vindo de fora — é superfície de ataque por definição. → Mitigação: todas em JavaScript puro, de escopo estreito, e a recusa deliberada da `xlsx` parada com CVE conhecido. Vale registrar que a decisão foi de recusar, não de esquecer. A dependência opcional `@napi-rs/canvas`, que o `pdfjs-dist` arrasta, fica fora do pacote pela exclusão descrita na decisão 4 — código que não é empacotado não é superfície de ataque.

**Truncar em silêncio distorce o que vem depois.** Um resumo feito sobre um texto cortado no meio parece completo e não é. → Mitigação: o registro marca que houve truncamento, e quem consumir o texto pode saber disso. Não impede o problema, mas impede que ele seja invisível.

**Extração de baixa qualidade.** PDF gerado por digitalização devolve texto vazio ou lixo. → Mitigação: extração vazia é registrada como `sem-texto` e não é repetida enquanto o `sha` não mudar. Documento sem texto continua encontrável pelo nome.

## Migration Plan

Aditiva, sem migração de dados. A coleção nova é criada vazia na primeira abertura; `documentos_acessados` e `cache_fontes` não são tocadas, e nenhum registro existente muda de formato.

Reverter é apagar o arquivo da coleção nova e não disparar a ingestão. Nada do que já funciona depende dela.

A ADR precisa ser escrita **antes** do código, não depois: ela é o que autoriza a inversão da postura de dados, e escrevê-la depois seria registrar um fato consumado em vez de decidir.

## Open Questions

- **A ADR-0002 passa a *Substituído*?** Só uma cláusula dela é derrubada; a escolha por NoSQL, por `@seald-io/nedb` e pelo acesso exclusivo do processo principal segue inteiramente em vigor. Marcá-la como substituída por inteiro exagera o alcance; deixá-la intacta esconde que uma frase dela deixou de valer. É decisão da equipe, e a nova ADR referencia a anterior de qualquer forma, como o processo exige.
- **Planilhas precisam ser extraídas?** A decisão 4 as deixa de fora por segurança, não por indiferença. Se o acervo da equipe depender de conteúdo de planilha, isso vira uma decisão própria, com o pacote do registro da SheetJS avaliado à parte. Não muda nada do que está especificado aqui: um formato a mais é um extrator a mais.
