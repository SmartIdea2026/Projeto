# AncorAI

Aplicação desktop que centraliza a busca de documentos do **GitHub**.

O Google Drive integrava o escopo e foi retirado do MVP pela [ADR-0004](../Docs/ADR/ADR-0004-remocao-google-drive-mvp.md): o escopo `drive.readonly` é restrito pelo Google e exigiria avaliação de segurança para publicação. A arquitetura segue preparada para múltiplas fontes.

## O que a aplicação faz

- **Busca por nome ou autor.** O termo casa com o nome do arquivo e com quem realizou a última alteração, então procurar pelo nome de um integrante encontra o que ele produziu. A busca com termo ou período é respondida a partir do **snapshot local** gravado pela última sincronização (ver *Sincronização do acervo*), sem consultar o GitHub documento a documento — o que a mantinha lenta. Um documento criado, renomeado ou removido no GitHub só entra ou sai da busca depois de sincronizar; enquanto não houver snapshot, a busca consulta o GitHub ao vivo.
- **Busca no conteúdo, opcional.** O botão de alternância **"Buscar no conteúdo"** (desligado por padrão) faz o termo casar também com o **texto já armazenado** do documento (ver *Sincronização do acervo*), de forma aditiva a nome e autor. É opcional porque a correspondência pelo texto alcança qualquer documento que mencione o termo no corpo. No conteúdo o termo casa como palavra inteira. Um resultado que casou apenas pelo conteúdo é assinalado no cartão, sem mostrar o trecho; e a busca avisa quando parte do acervo ainda não foi sincronizada.
- **Busca por voz, opcional.** Um ícone de microfone ao lado do botão "Buscar" — visível só depois de ativar a busca por voz nas configurações. Toque para falar; a captura para sozinha no silêncio (ou no botão de parar). No primeiro uso, uma confirmação dentro do app pede para usar o microfone, e você pode escolher qual microfone usar nas configurações. O que você fala é transcrito **na sua máquina**, por um modelo Whisper local, e vira texto no campo de busca para você conferir e confirmar — a busca não dispara sozinha. O áudio não é enviado a nenhum serviço externo nem gravado (ADR-0008). Ativar baixa o modelo uma vez (~250 MB) para a pasta de dados da aplicação.
- **Filtros de extensão e período.** O período fica recolhido em um painel, aberto pelo botão abaixo da barra de busca. Ele recorta pela **data real de alteração do documento**: definir um intervalo faz a aplicação percorrer o acervo — e não a janela estreita dos recentes — e resolver a data de cada candidato antes de filtrar. Documento cuja data não puder ser obtida fica de fora, e a aplicação diz quantos ficaram.
- **Ordenação** por data ou nome, com desempate por nome A–Z e, permanecendo o empate, pelo identificador do documento. O critério vale para o **resultado inteiro**, não para a página visível: trocá-lo reorganiza tudo o que foi encontrado, recalcula as páginas e devolve a primeira — sem nova consulta às fontes. O controle fica acima da lista, alinhado à direita dela.
- **Paginação** de 10 documentos por página, com o total encontrado exibido à esquerda, na mesma linha do controle de ordenação.
- **Documentos recentes** na abertura, a partir do resultado guardado da execução anterior, atualizado em segundo plano. A lista traz os mais recentes primeiro; escolher outro critério muda a ordem em que eles aparecem, nunca quais documentos são considerados recentes.
- **Autoria e data da última alteração** em cada resultado, obtidas para a página apresentada — e, quando há termo ou período, para os candidatos antes da filtragem, porque aí o dado decide quem entra no resultado. Chegada a data real, o documento é reposicionado: a ordem apresentada nunca contradiz as datas apresentadas.
- **Avisos de resultado parcial** quando a listagem foi truncada, um repositório ficou inacessível, a busca por autor excedeu o alcance de uma consulta ao vivo, o filtro de período deixou documentos de fora por não ter sido possível determinar a data deles, a correspondência pelo conteúdo alcançou apenas parte do acervo, ou o snapshot ainda tem documentos sem autoria sincronizada.
- **Pilha de documentos relacionados.** Abaixo do resumo, o painel lista até cinco documentos próximos do que está em foco, ordenados pela quantidade de `assuntos` em comum (assunto raro no acervo pesa mais; mesmo `tipo` aproxima). O cálculo é local, sobre os rótulos que a IA já gravou — sem envio a serviço externo, sem busca vetorial (ADR-0007). Acionar um item leva aquele documento ao painel, sem mexer na lista de resultados. Enquanto a classificação de todo o acervo não terminou, a pilha considera só os documentos já classificados e diz quantos ficaram fora.

### Sincronização do acervo

- **Ingestão do conteúdo.** Além dos metadados, o sistema baixa os documentos do inventário, extrai o texto e o guarda no banco local. Roda ao abrir a aplicação, é incremental e retomável, e cede a vez a qualquer busca — o trabalho de fundo nunca disputa cota do GitHub com quem está esperando na tela.
- **Snapshot do inventário e da autoria.** A mesma varredura grava localmente quais documentos existem e resolve a autoria e a data real de alteração de cada um, reaproveitando o que já resolveu (pelo `sha` do blob). É desse snapshot que a busca com termo ou período é servida — antes, cada busca resolvia a autoria consultando o GitHub uma vez por documento, e era isso que a deixava lenta.
- **Botão "Sincronizar" no cabeçalho**, ao lado do acesso às configurações. Dispara a mesma varredura sob comando: reaproveita o texto e a autoria já vigentes (pelo `sha` do blob) e busca só o que falta ou mudou. É uma varredura de cada vez — acionar o botão durante uma em andamento não inicia outra. O botão apresenta o andamento em contagens e o estado: **parada**, **em andamento**, **concluída** ou **suspensa** com o motivo (limite de requisições, limite de armazenamento, credencial ausente ou falha ao obter o inventário).
- **O texto fica acessível ao sistema, não ao usuário.** O documento continua sendo aberto por redirecionamento à fonte original, e nenhum canal devolve conteúdo ao renderer (ADR-0005): a busca pelo conteúdo roda no processo principal e só devolve a marca de correspondência, nunca o trecho. A ingestão também viabiliza resumo e classificação por IA, que virão depois.

Formatos com texto extraído: `md`, `txt`, `pdf`, `docx` e `epub`. Planilhas (`xls`, `xlsx`) e o `.doc` antigo continuam sendo encontrados pelo nome, mas têm o conteúdo registrado como não lido — o motivo está em `src/main/conteudo/extracao.ts`.

### Sobre o envio de conteúdo a um serviço externo

Até aqui, nada do conteúdo dos documentos saía da máquina — apenas metadados e o link para a fonte original (ADR-0005). Isso muda com o resumo por IA: gerar um resumo envia o **texto do documento em foco** ao Google Gemini, no plano gratuito, cuja política permite usar o conteúdo submetido para melhorar produtos do Google e revisão humana (ADR-0006). Por isso:

- O sistema pede confirmação antes do **primeiro** envio, inclusive do resumo automático do primeiro resultado, e só prossegue depois que o usuário confirma.
- A tela de configurações mantém o aviso acessível depois disso.
- Só o texto do documento a ser resumido viaja — nunca o acervo inteiro, nenhuma credencial e nenhum dado de outro documento.
- Recusar o consentimento mantém busca, filtros, paginação e abertura funcionando normalmente; apenas o painel de resumo fica indisponível.

### Sobre a busca por voz

A transcrição da busca por voz é o oposto do resumo por IA: roda **inteiramente na sua máquina**, com um modelo Whisper local (`onnx-community/whisper-small`, ADR-0008). O áudio capturado é processado e descartado; não é enviado a serviço externo nem gravado em disco.

- Ativar a busca por voz nas configurações **baixa o modelo uma vez** (~250 MB) do Hugging Face. É a única vez que o recurso usa a rede.
- O modelo fica em `<userData>/modelos/onnx-community/whisper-small/` — em Linux, `~/.config/AncorAI/modelos/`. Apagar essa pasta desfaz o download; reativar baixa de novo.
- No primeiro uso, uma confirmação dentro do app pede para usar o microfone; depois disso o clique grava direto. A permissão vale só para áudio.
- Em **Configurações → Busca por voz** dá para escolher qual microfone o ditado usa (ou deixar no padrão do sistema). Os nomes dos microfones só aparecem depois de conceder a permissão uma vez.
- O que você dita **preenche o campo de busca e não dispara a busca** — você confere e confirma.

## Requisitos

| Item | Versão |
| --- | --- |
| Node.js | `^20.19.0` ou `>=22.12.0` |
| npm | 9 ou superior |

A restrição de versão vem do Vite e do electron-vite. O `engine-strict` está ativo, então o `npm install` **falha explicitamente** em uma versão incompatível, em vez de quebrar mais adiante com um erro obscuro.

Confira sua versão com `node --version`.

## Abrir pelo terminal

Há um atalho para não rodar os comandos um a um. Da pasta `AncorAI`:

```bash
./iniciar.sh
```

Ele confere a versão do Node, instala as dependências quando faltam ou quando o `package-lock.json` mudou, e abre a aplicação. Rodar de novo pula a instalação. `./iniciar.sh build` compila e abre a versão compilada.

O script também limpa a variável `ELECTRON_RUN_AS_NODE` para esta execução. Alguns terminais embutidos em editores a definem, e com ela o Electron roda como Node puro: o comando termina sem erro e nenhuma janela aparece.

O script não instala nada no sistema e não cria atalhos — é só um atalho de terminal. É `bash`, então funciona no Linux e no macOS; no Windows, use o Git Bash ou os comandos abaixo.

## Instalação

```bash
cd AncorAI
npm install
```

O `npm install` baixa o binário do Electron, com cerca de **114 MB**. Em conexões lentas ou atrás de proxy corporativo esse é o passo demorado. Se o download falhar, é possível apontar um espelho:

```bash
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install
```

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Executa em modo de desenvolvimento, com recarga automática |
| `npm test` | Roda a suíte de testes |
| `npm run build` | Verifica os tipos e gera o build de produção |
| `npm run package` | Gera o aplicativo descompactado em `release/linux-unpacked/` |
| `npm run dist` | Gera o instalável — AppImage no Linux |

## Configuração de acesso

Ao abrir pela primeira vez, o aplicativo não tem acesso a nenhuma fonte. Configure pelo botão de configurações (ícone de engrenagem) no cabeçalho. O estado de conexão de cada fonte é mostrado nessa tela de configurações.

### GitHub

Gere um **Personal Access Token** em *Settings → Developer settings → Personal access tokens*, com permissão de **leitura** nos repositórios desejados. Prefira um *fine-grained token* restrito ao necessário. Cole o token na tela de configurações.

### Google Gemini (opcional)

Gere uma chave de API em [aistudio.google.com](https://aistudio.google.com) e cole-a na tela de configurações para habilitar o resumo por IA. Sem ela, a busca continua funcionando normalmente — apenas o painel de resumo fica indisponível.

As credenciais são cifradas pelo chaveiro do sistema operacional e nunca são reexibidas.

## Estrutura

```text
src/
├── main/                 Processo principal
│   ├── index.ts             Ciclo de vida da aplicação
│   ├── janela.ts            Criação da janela
│   ├── ipc.ts               Registro dos canais expostos ao renderer
│   ├── busca/               Orquestração das fontes e regras de filtro
│   ├── fontes/              Integração com o GitHub
│   ├── credenciais/         Cofre cifrado e cache de validação
│   ├── conteudo/            Ingestão, extração de texto e limites
│   ├── voz/                 Transcrição local (utilityProcess Whisper, ADR-0008)
│   ├── permissoes.ts        Política de permissões da sessão (só microfone)
│   └── banco/               Persistência NoSQL local
├── preload/              Fronteira tipada entre os processos
├── renderer/             Interface em React
│   ├── audio/               Captura de microfone e reamostragem para o ditado
│   ├── componentes/         Componentes reutilizáveis
│   ├── telas/               Telas completas
│   └── estilos/             Folhas divididas por área da interface
└── compartilhado/        Tipos, canais e ordenação comuns aos processos

test/
├── busca/                Filtro, ordenação, paginação, reordenação, falhas, busca pelo conteúdo e pelo snapshot
├── fontes/               Normalização das respostas das APIs e autoria
├── conteudo/             Obtenção, extração, persistência, ingestão e estado da sincronização
├── voz/                  Configuração, modelo, transcrição, permissão e canais da busca por voz
├── interface/            Componentes: tabulação, paginação, filtros, ordenação, autoria e ditado
├── persistencia/         Banco local
└── seguranca/            Fronteira entre renderer e processo principal
```

Credenciais, chamadas de rede e o conteúdo dos documentos vivem **apenas no processo main**. O renderer nunca recebe o valor de um segredo (ADR-0003) nem o texto de um documento (ADR-0005) — há teste automatizado para cada uma das duas fronteiras. O de conteúdo invoca todos os canais registrados e falha se algum devolver texto, então um canal novo é examinado sem que ninguém precise lembrar de atualizar o teste. Isso não significa que o texto nunca sai da máquina: para gerar um resumo, o processo main o envia ao Google Gemini (ADR-0006) — o que muda é que ele nunca passa pelo renderer, e o envio a um serviço externo exige a confirmação do usuário. O canal `voz:transcrever` devolve texto ao renderer, mas é a **fala do próprio usuário** transcrita localmente, da mesma natureza de um termo digitado — não conteúdo de documento (ADR-0008).

### O que fica no banco local

Quatro coleções, todas NoSQL orientadas a documentos (ADR-0002):

| Coleção | Conteúdo |
| --- | --- |
| `documentos_acessados` | identificação, nome, fonte, link e data do acesso |
| `cache_fontes` | respostas das APIs com seu `ETag` |
| `conteudo_documentos` | texto extraído de cada documento, com o `sha` do blob e o estado da extração |
| `acervo_documentos` | snapshot do inventário: metadados de cada documento e a autoria/data real quando já resolvidas, com o `sha` do blob contra o qual a autoria vale |

As duas últimas são abertas **sob demanda** — na primeira ingestão ou na primeira busca —, e não na inicialização: o NeDB lê a base inteira para a memória ao abrir uma coleção. `conteudo_documentos` é a única que pode crescer para dezenas de megabytes; `acervo_documentos` guarda só metadados. A busca com termo ou período é servida de `acervo_documentos`; a busca pelo conteúdo lê o texto de `conteudo_documentos`. Nenhum dos dois textos é devolvido ao renderer.

Os bytes originais dos arquivos não são guardados em lugar algum — o sistema guarda texto, não arquivos. O texto fica **em claro no disco**, sem cifragem: a aplicação é local e monousuário, então quem alcança o perfil do sistema operacional alcança o texto. A ADR-0005 registra esse risco e a decisão de aceitá-lo.

## Problemas conhecidos

**O AppImage não abre e reclama de `libfuse.so.2`.** Distribuições recentes trazem o FUSE 3, e o AppImage precisa do 2. Contorne com:

```bash
./release/AncorAI-0.1.0.AppImage --appimage-extract-and-run
```

Ou instale o pacote `libfuse2`.

**Após empacotar, confira `git status`.** Houve um caso em que o `package.json` foi reescrito durante o empacotamento, perdendo `scripts` e `devDependencies`. Não foi possível reproduzir depois, mas vale a conferência. Se acontecer: `git restore AncorAI/package.json`.

**O pacote ficou com dezenas de megabytes a mais.** O `pdfjs-dist` declara `@napi-rs/canvas` como dependência opcional, e o npm a instala por padrão: são ~62 MB de binários do Skia usados só para renderizar PDF em canvas, que a extração de texto não toca. O `electron-builder.yml` os exclui do empacotamento; se a exclusão sair de lá, eles voltam.

**O aplicativo encerra logo ao abrir, sem mensagem.** Verifique se a variável `ELECTRON_RUN_AS_NODE` está definida no ambiente — ela força o Electron a rodar como Node puro, e o processo termina sem erro e sem janela. O `./iniciar.sh` já a limpa; ao rodar os comandos npm direto, remova-a antes.

## Documentação

| Assunto | Documento |
| --- | --- |
| Especificação do sistema | `../Docs/Requisitos/EspecificacaoSistemaAncorAI.md` |
| Decisões de arquitetura | `../Docs/ADR/` |
| Padrões para agentes de IA | `../AGENTS.md` |
