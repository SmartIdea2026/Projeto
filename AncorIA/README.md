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

1. No **Google Cloud Console**, crie um projeto.
2. Habilite a **Google Drive API**.
3. Em *Credenciais*, crie um **ID do cliente OAuth** do tipo **Desktop app**.
4. Copie o **Client ID** para a tela de configurações e acione **Conectar ao Drive**.
5. Conceda o consentimento na janela do navegador que se abrir.

As credenciais são cifradas pelo chaveiro do sistema operacional e nunca são reexibidas.

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
