# AncorAI

Aplicação desktop que centraliza a busca de documentos do **GitHub**.

O Google Drive integrava o escopo e foi retirado do MVP pela [ADR-0004](../Docs/ADR/ADR-0004-remocao-google-drive-mvp.md): o escopo `drive.readonly` é restrito pelo Google e exigiria avaliação de segurança para publicação. A arquitetura segue preparada para múltiplas fontes.

## O que a aplicação faz

- **Busca por nome ou autor.** O termo casa com o nome do arquivo e com quem realizou a última alteração, então procurar pelo nome de um integrante encontra o que ele produziu.
- **Filtros de extensão e período.** O período fica recolhido em um painel, aberto pelo botão abaixo da barra de busca.
- **Ordenação** por data ou nome, com desempate por nome A–Z. A ordenação reorganiza os resultados já obtidos, sem nova consulta às fontes.
- **Paginação** de 10 documentos por página, com o total encontrado exibido à esquerda.
- **Documentos recentes** na abertura, a partir do resultado guardado da execução anterior, atualizado em segundo plano.
- **Autoria e data da última alteração** em cada resultado, obtidas apenas para a página apresentada.
- **Avisos de resultado parcial** quando a listagem foi truncada, um repositório ficou inacessível ou a data usada é aproximada.

Os resumos por IA ainda não fazem parte desta versão; estão propostos na mudança `resumos-e-indice-por-ia`.

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
│   └── banco/               Persistência NoSQL local
├── preload/              Fronteira tipada entre os processos
├── renderer/             Interface em React
│   ├── componentes/         Componentes reutilizáveis
│   ├── telas/               Telas completas
│   └── estilos/             Folhas divididas por área da interface
└── compartilhado/        Tipos, canais e ordenação comuns aos processos

test/
├── busca/                Regras de filtro, ordenação, paginação e falhas
├── fontes/               Normalização das respostas das APIs e autoria
├── interface/            Componentes: tabulação, paginação, filtros e autoria
├── persistencia/         Banco local
└── seguranca/            Fronteira entre renderer e processo principal
```

Credenciais e chamadas de rede vivem **apenas no processo main**. O renderer nunca recebe o valor de um segredo — há teste automatizado garantindo isso.

## Problemas conhecidos

**O AppImage não abre e reclama de `libfuse.so.2`.** Distribuições recentes trazem o FUSE 3, e o AppImage precisa do 2. Contorne com:

```bash
./release/AncorAI-0.1.0.AppImage --appimage-extract-and-run
```

Ou instale o pacote `libfuse2`.

**Após empacotar, confira `git status`.** Houve um caso em que o `package.json` foi reescrito durante o empacotamento, perdendo `scripts` e `devDependencies`. Não foi possível reproduzir depois, mas vale a conferência. Se acontecer: `git restore AncorAI/package.json`.

**O aplicativo encerra logo ao abrir, sem mensagem.** Verifique se a variável `ELECTRON_RUN_AS_NODE` está definida no ambiente — ela força o Electron a rodar como Node puro, e o processo termina sem erro e sem janela. O `./iniciar.sh` já a limpa; ao rodar os comandos npm direto, remova-a antes.

## Documentação

| Assunto | Documento |
| --- | --- |
| Especificação do sistema | `../Docs/Requisitos/EspecificacaoSistemaAncorAI.md` |
| Decisões de arquitetura | `../Docs/ADR/` |
| Padrões para agentes de IA | `../AGENTS.md` |
