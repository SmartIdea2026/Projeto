# AncorAI

Aplicação desktop que centraliza a busca de documentos do **GitHub**.

O Google Drive integrava o escopo e foi retirado do MVP pela [ADR-0004](../Docs/ADR/ADR-0004-remocao-google-drive-mvp.md): o escopo `drive.readonly` é restrito pelo Google e exigiria avaliação de segurança para publicação. A arquitetura segue preparada para múltiplas fontes.

## O que a aplicação faz

- **Busca por nome ou autor.** O termo casa com o nome do arquivo e com quem realizou a última alteração, então procurar pelo nome de um integrante encontra o que ele produziu.
- **Filtros de extensão e período.** O período fica recolhido em um painel, aberto pelo botão abaixo da barra de busca. Ele recorta pela **data real de alteração do documento**: definir um intervalo faz a aplicação percorrer o acervo — e não a janela estreita dos recentes — e resolver a data de cada candidato antes de filtrar. Documento cuja data não puder ser obtida fica de fora, e a aplicação diz quantos ficaram.
- **Ordenação** por data ou nome, com desempate por nome A–Z e, permanecendo o empate, pelo identificador do documento. O critério vale para o **resultado inteiro**, não para a página visível: trocá-lo reorganiza tudo o que foi encontrado, recalcula as páginas e devolve a primeira — sem nova consulta às fontes. O controle fica acima da lista, alinhado à direita dela.
- **Paginação** de 10 documentos por página, com o total encontrado exibido à esquerda, na mesma linha do controle de ordenação.
- **Documentos recentes** na abertura, a partir do resultado guardado da execução anterior, atualizado em segundo plano. A lista traz os mais recentes primeiro; escolher outro critério muda a ordem em que eles aparecem, nunca quais documentos são considerados recentes.
- **Autoria e data da última alteração** em cada resultado, obtidas para a página apresentada — e, quando há termo ou período, para os candidatos antes da filtragem, porque aí o dado decide quem entra no resultado. Chegada a data real, o documento é reposicionado: a ordem apresentada nunca contradiz as datas apresentadas.
- **Avisos de resultado parcial** quando a listagem foi truncada, um repositório ficou inacessível, a busca por autor excedeu o alcance de uma consulta, ou o filtro de período deixou documentos de fora por não ter sido possível determinar a data deles.
- **Resumo por IA no painel à direita.** Ao focar um documento, um painel mostra o resumo em prosa, o tipo, os assuntos e os destaques, gerados por um modelo de linguagem (Google Gemini) a partir do texto já ingerido — o resultado de uma única submissão, sem múltiplas chamadas. O primeiro documento de cada busca é resumido automaticamente; os demais, sob pedido, sem alterar a lista. O resumo é gravado e reaproveitado enquanto o documento não muda na fonte, e assinalado como desatualizado quando muda.

### Em segundo plano

- **Ingestão do conteúdo.** Além dos metadados, o sistema baixa os documentos do inventário, extrai o texto e o guarda no banco local. Roda em segundo plano ao abrir a aplicação, é retomável, e cede a vez a qualquer busca — o trabalho de fundo nunca disputa cota do GitHub com quem está esperando na tela.
- **O texto fica acessível ao sistema, não ao usuário.** Nada disso aparece na interface: o documento continua sendo aberto por redirecionamento à fonte original, e nenhum canal devolve conteúdo ao renderer. A ingestão existe para viabilizar resumo, e adiante classificação e busca por contexto (mudança `resumos-e-indice-por-ia`, em andamento).

Formatos com texto extraído: `md`, `txt`, `pdf`, `docx` e `epub`. Planilhas (`xls`, `xlsx`) e o `.doc` antigo continuam sendo encontrados pelo nome, mas têm o conteúdo registrado como não lido — o motivo está em `src/main/conteudo/extracao.ts`.

### Sobre o envio de conteúdo a um serviço externo

Até aqui, nada do conteúdo dos documentos saía da máquina — apenas metadados e o link para a fonte original (ADR-0005). Isso muda com o resumo por IA: gerar um resumo envia o **texto do documento em foco** ao Google Gemini, no plano gratuito, cuja política permite usar o conteúdo submetido para melhorar produtos do Google e revisão humana (ADR-0006). Por isso:

- O sistema pede confirmação antes do **primeiro** envio, inclusive do resumo automático do primeiro resultado, e só prossegue depois que o usuário confirma.
- A tela de configurações mantém o aviso acessível depois disso.
- Só o texto do documento a ser resumido viaja — nunca o acervo inteiro, nenhuma credencial e nenhum dado de outro documento.
- Recusar o consentimento mantém busca, filtros, paginação e abertura funcionando normalmente; apenas o painel de resumo fica indisponível.

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

Ao abrir pela primeira vez, o aplicativo não tem acesso a nenhuma fonte. Configure pelo botão de conexão no cabeçalho.

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
│   └── banco/               Persistência NoSQL local
├── preload/              Fronteira tipada entre os processos
├── renderer/             Interface em React
│   ├── componentes/         Componentes reutilizáveis
│   ├── telas/               Telas completas
│   └── estilos/             Folhas divididas por área da interface
└── compartilhado/        Tipos, canais e ordenação comuns aos processos

test/
├── busca/                Regras de filtro, ordenação, paginação, reordenação e falhas
├── fontes/               Normalização das respostas das APIs e autoria
├── conteudo/             Obtenção, extração, persistência e ingestão do texto
├── interface/            Componentes: tabulação, paginação, filtros, ordenação e autoria
├── persistencia/         Banco local
└── seguranca/            Fronteira entre renderer e processo principal
```

Credenciais, chamadas de rede e o conteúdo dos documentos vivem **apenas no processo main**. O renderer nunca recebe o valor de um segredo (ADR-0003) nem o texto de um documento (ADR-0005) — há teste automatizado para cada uma das duas fronteiras. O de conteúdo invoca todos os canais registrados e falha se algum devolver texto, então um canal novo é examinado sem que ninguém precise lembrar de atualizar o teste. Isso não significa que o texto nunca sai da máquina: para gerar um resumo, o processo main o envia ao Google Gemini (ADR-0006) — o que muda é que ele nunca passa pelo renderer, e o envio a um serviço externo exige a confirmação do usuário.

### O que fica no banco local

Três coleções, todas NoSQL orientadas a documentos (ADR-0002):

| Coleção | Conteúdo |
| --- | --- |
| `documentos_acessados` | identificação, nome, fonte, link e data do acesso |
| `cache_fontes` | respostas das APIs com seu `ETag` |
| `conteudo_documentos` | texto extraído de cada documento, com o `sha` do blob, o estado da extração e, quando gerado, o resumo por IA associado à mesma versão do conteúdo |

A terceira é aberta **sob demanda**, e não na inicialização: o NeDB lê a base inteira para a memória ao abrir uma coleção, e é a única que pode crescer para dezenas de megabytes.

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
