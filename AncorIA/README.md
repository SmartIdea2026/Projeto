# AncorIA

Aplicação desktop que centraliza a busca de documentos do **GitHub** e do **Google Drive**.

## Requisitos

| Item | Versão |
| --- | --- |
| Node.js | `^20.19.0` ou `>=22.12.0` |
| npm | 9 ou superior |

A restrição de versão vem do Vite e do electron-vite. O `engine-strict` está ativo, então o `npm install` **falha explicitamente** em uma versão incompatível, em vez de quebrar mais adiante com um erro obscuro.

Confira sua versão com `node --version`.

## Instalação

O caminho mais simples é o script de setup, que confere as versões, instala as dependências e roda os testes para confirmar que ficou tudo íntegro.

**Linux e macOS:**

```bash
cd AncorIA
./setup.sh
```

**Windows (PowerShell):**

```powershell
cd AncorIA
.\setup.ps1
```

Se o PowerShell recusar a execução, libere para a sessão atual com `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`.

### Instalação manual

Preferindo fazer à mão, ou em qualquer sistema:

```bash
cd AncorIA
npm run setup     # equivale a npm install && npm test
```

O `npm install` baixa o binário do Electron, com cerca de **114 MB**. Em conexões lentas ou atrás de proxy corporativo esse é o passo demorado. Se o download falhar, é possível apontar um espelho:

```bash
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install
```

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run setup` | Instala as dependências e roda os testes |
| `npm run dev` | Executa em modo de desenvolvimento, com recarga automática |
| `npm test` | Roda a suíte de testes |
| `npm run build` | Verifica os tipos e gera o build de produção |
| `npm run package` | Gera o aplicativo descompactado em `release/linux-unpacked/` |
| `npm run dist` | Gera o instalável — AppImage no Linux |

## Configuração de acesso

Ao abrir pela primeira vez, o aplicativo não tem acesso a nenhuma fonte. Configure pelo botão de conexão no cabeçalho.

### GitHub

Gere um **Personal Access Token** em *Settings → Developer settings → Personal access tokens*, com permissão de **leitura** nos repositórios desejados. Prefira um *fine-grained token* restrito ao necessário. Cole o token na tela de configurações.

### Google Drive

O Drive exige **OAuth**, porque uma chave de API autentica o projeto e não o usuário, e por isso não alcança documentos privados.

Todo o processo é feito no [Google Cloud Console](https://console.cloud.google.com).

#### 1. Criar ou selecionar um projeto

Use o seletor de projetos no topo da página.

#### 2. Habilitar a Google Drive API

Vá em *APIs e serviços → Biblioteca*, busque por **Google Drive API** e clique em **Ativar**. Sem esse passo, as chamadas retornam erro 403 mesmo com uma autorização válida.

#### 3. Configurar a tela de consentimento

Em *APIs e serviços → Tela de permissão OAuth* — nas versões mais recentes do console, essa área aparece como **Google Auth Platform**.

* **Tipo de usuário:** escolha **Interno** se a instituição tiver Google Workspace; caso contrário, **Externo**. A escolha tem consequências importantes, descritas na seção de limitações abaixo.
* Preencha nome do aplicativo, e-mail de suporte e contato do desenvolvedor.
* Em *Escopos*, adicione `https://www.googleapis.com/auth/drive.readonly`.
* Em *Usuários de teste*, **adicione o e-mail de cada integrante que for usar o aplicativo**.

#### 4. Criar a credencial

Em *APIs e serviços → Credenciais*, escolha **Criar credenciais → ID do cliente OAuth** e selecione o tipo de aplicativo **App para computador** (*Desktop app*).

Copie o **Client ID** gerado, no formato `000000000000-xxxxxxxx.apps.googleusercontent.com`.

O *client secret* exibido junto **não é necessário**. O AncorIA usa PKCE justamente porque o segredo de um aplicativo instalado viajaria dentro do binário distribuído, e portanto não seria secreto.

#### 5. Conectar

Cole o Client ID na tela de configurações do AncorIA e acione **Conectar ao Drive**. Conceda o consentimento na janela do navegador que se abrir.

As credenciais são cifradas pelo chaveiro do sistema operacional e nunca são reexibidas.

### Limitações do OAuth do Google

Duas restrições da plataforma afetam o uso diário e não decorrem da implementação:

**A autorização expira a cada 7 dias.** Enquanto o aplicativo estiver com status de publicação **"Em teste"** e tipo de usuário **Externo**, o Google invalida os tokens de renovação semanalmente. Como o AncorIA guarda esse token para não pedir consentimento a cada abertura, na prática **seria necessário reconectar o Drive toda semana**.

Há duas saídas:

* **Tipo Interno**, disponível para instituições com Google Workspace. Remove tanto a expiração de 7 dias quanto a necessidade de verificação. É o caminho mais simples quando aplicável.
* **Publicar o aplicativo**, o que exige verificação junto ao Google. O escopo `drive.readonly` é classificado como **restrito**, e sua aprovação costuma envolver avaliação de segurança.

**Somente usuários de teste conseguem autorizar.** Com o tipo Externo em status de teste, quem não constar da lista de *usuários de teste* recebe erro de acesso negado ao tentar conceder o consentimento.

## Estrutura

```text
src/
├── main/          Processo principal: credenciais, rede, cache e banco
│   ├── credenciais/   Cofre cifrado e cache de validação
│   ├── fontes/        Integrações com GitHub e Drive
│   ├── oauth/         Fluxo OAuth do Google
│   └── banco/         Persistência NoSQL local
├── preload/       Fronteira tipada entre os processos
├── renderer/      Interface em React
└── compartilhado/ Tipos e canais comuns aos processos
```

Credenciais e chamadas de rede vivem **apenas no processo main**. O renderer nunca recebe o valor de um segredo — há teste automatizado garantindo isso.

## Problemas conhecidos

**O AppImage não abre e reclama de `libfuse.so.2`.** Distribuições recentes trazem o FUSE 3, e o AppImage precisa do 2. Contorne com:

```bash
./release/AncorIA-0.1.0.AppImage --appimage-extract-and-run
```

Ou instale o pacote `libfuse2`.

**Após empacotar, confira `git status`.** Houve um caso em que o `package.json` foi reescrito durante o empacotamento, perdendo `scripts` e `devDependencies`. Não foi possível reproduzir depois, mas vale a conferência. Se acontecer: `git restore AncorIA/package.json`.

**O aplicativo encerra logo ao abrir, sem mensagem.** Verifique se a variável `ELECTRON_RUN_AS_NODE` está definida no ambiente — ela força o Electron a rodar como Node puro. Remova-a antes de executar.

## Documentação

| Assunto | Documento |
| --- | --- |
| Especificação do sistema | `../Docs/Requisitos/EspecificacaoSistemaAncorIA.md` |
| Decisões de arquitetura | `../Docs/ADR/` |
| Padrões para agentes de IA | `../AGENTS.md` |
