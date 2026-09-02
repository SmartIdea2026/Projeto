# Viabilidade do Playwright na AncorAI

PoC de viabilidade — não uma decisão de arquitetura, nem cobertura de teste. Contexto completo em `openspec/changes/poc-viabilidade-playwright/`.

## Pergunta

Conseguimos pegar uma funcionalidade real do sistema (busca sobre um snapshot local pré-semeado) e testá-la com Playwright, simulando um usuário utilizando a aplicação real (Electron, não um mock)?

**Resposta: sim.** O teste roda, é estável nas execuções feitas, e valida um caminho real — do preload/IPC até a renderização — que a suíte Vitest atual não cobre (ela mocka a ponte `window.ancorai`).

## O que foi montado

- `AncorAI/e2e/playwright.config.ts` — config mínima, sem `webServer`/`baseURL`.
- `AncorAI/e2e/semear.ts` — semeia dois documentos de exemplo em `acervo_documentos` via `banco/repositorio.ts`, sem passar pelo GitHub.
- `AncorAI/e2e/busca-local.spec.ts` — dois casos: um termo que casa com um documento do snapshot, e um termo sem correspondência.
- `npm run test:e2e` (builda com `electron-vite build` e roda `playwright test`).

## Facilidade de configuração

Instalar `@playwright/test` e escrever a config foi trivial — nenhuma dificuldade ali. A parte não trivial foi tudo que é específico de testar **Electron**, não Playwright em si:

- `_electron` (o driver que controla um app Electron real) não é exportado por `@playwright/test` — vem de `playwright-core`, que já está disponível como dependência transitiva. Não documentado de forma óbvia no fluxo padrão de "getting started" do Playwright, que é voltado a browsers comuns.
- `playwright install` baixa browsers geridos pelo Playwright (Chromium, Firefox, WebKit) — irrelevante aqui, já que `_electron.launch()` usa o próprio Electron do projeto. Não foi preciso instalar nada nesse sentido.

## Dificuldades específicas do Electron (e desta máquina)

Duas dificuldades reais apareceram, nenhuma delas do Playwright em si — ambas específicas de rodar Electron neste ambiente:

1. **`ELECTRON_RUN_AS_NODE=1` no ambiente.** Com essa variável definida, o binário do Electron roda como Node puro, sem `app`/`BrowserWindow` — o app falha com `Cannot read properties of undefined (reading 'whenReady')`. O próprio projeto já conhece esse problema: `iniciar.sh` limpa a variável antes do modo dev. O teste Playwright precisou fazer o mesmo antes de repassar `process.env` para `_electron.launch()`. Isso é uma pegadinha de ambiente, não do Playwright — mas quem for rodar os testes E2E (localmente ou, futuramente, em CI) precisa saber disso.

2. **Crash (`SIGSEGV`) do Electron ao criar a janela, com o backend Wayland do Ozone.** Esta máquina roda Wayland nativo (Ubuntu 26.04); o Electron detectou isso e tentou usar o Ozone/Wayland diretamente, e travou na criação da superfície da janela. Passar `--ozone-platform=x11` (usando XWayland, já disponível via `DISPLAY`) resolveu — o app abre e funciona normalmente. Isso não é um problema do Playwright, é um problema de compatibilidade Electron/Chromium com Wayland nesta versão/distro, mas é exatamente o tipo de coisa que só aparece ao rodar a janela de verdade — nenhum teste Vitest (jsdom) jamais encontraria isso.

Nenhuma das duas exigiu mudança de código de produção além do redirecionamento de `userData` (que já estava previsto no design). Ambas foram resolvidas com flags/env passados só ao processo de teste.

## Workarounds necessários

- Remover `ELECTRON_RUN_AS_NODE` do `env` passado a `_electron.launch()`.
- Passar `--ozone-platform=x11` nos `args` do `_electron.launch()`.
- Locators precisam ser específicos o bastante para não colidir com outras partes da tela: o nome de um documento aparece tanto no cartão da lista quanto no painel de resumo (que passa a acompanhar o primeiro resultado automaticamente) — `getByText(nome)` sozinho deu "strict mode violation" de forma intermitente (várias execuções passaram antes de uma pegar o painel ainda não renderizado). Precisou escopar o locator ao `.cartao`.
- Sem credencial do GitHub configurada (deliberado, fora do escopo desta PoC), o estado vazio "Nenhum documento encontrado" nunca aparece — ele é condicionado a `temCredencial` em `App.tsx`, e o aviso "Configure o acesso ao GitHub" aparece por cima independente do resultado da busca. Não é um bug: é um comportamento real do app que só ficou visível ao rodar contra a UI de verdade (a suíte Vitest mockada testa esse estado vazio com `temCredencial` simulado como verdadeiro). Para "sem resultado", o teste passou a checar ausência de `.cartao` em vez de uma mensagem específica.
- A execução **isolada** do módulo de seed (fora do teste, via `node` puro) esbarrou em resolução de módulo: os imports do projeto (`../banco/repositorio`, sem extensão) resolvem sob "bundler" (Vite/TS), mas não sob a resolução ESM padrão do Node. O próprio executor de teste do Playwright resolve isso sem problema (mesma classe de transformação que o Vite já faz para os testes Vitest existentes) — a limitação é só para quem tentar rodar o módulo fora do Playwright/Vite.

## Estabilidade observada

3 execuções seguidas de `npm run test:e2e`, todas verdes, depois de corrigido o locator ambíguo do painel de resumo. Antes da correção, a instabilidade era real e intermitente (passou em algumas execuções, falhou em outra por colisão de locator) — não foi um evento único.

## Limitações desta PoC (não avaliadas)

- Nenhuma chamada de rede (GitHub/Gemini) foi exercida — o fluxo escolhido não passa por elas de propósito.
- Nenhum fluxo que dependa de credencial (`safeStorage`) foi testado — não sabemos ainda se `safeStorage` funciona headless/sem sessão gráfica real nesta máquina ou em CI.
- Um único teste, sem qualquer estrutura de reutilização (page objects, fixtures customizadas) — não valida como isso escalaria para múltiplos fluxos.
- Não foi testado em CI (não existe pipeline no projeto); os dois problemas de ambiente encontrados (env var, Wayland) são exatamente o tipo de coisa que pode se comportar diferente numa máquina/container de CI.

## Conclusão

Playwright é viável para testar a AncorAI via `_electron`. As dificuldades encontradas foram inteiramente de ambiente (variável de ambiente conhecida do projeto, e um problema de Wayland desta distro) e de especificidade de locator — nada aponta para uma limitação fundamental do Playwright com esta arquitetura Electron. Os workarounds são pequenos, documentáveis, e não exigiram tocar em código de produção além do que já estava previsto no design da PoC.

Antes de adotar de forma mais ampla, valeria a pena investigar especificamente: (1) se `safeStorage` funciona de forma confiável fora de uma sessão gráfica real (relevante para testar o fluxo de credenciais e para uma futura esteira de CI), e (2) se os dois workarounds de ambiente encontrados aqui se repetem — ou mudam — num runner de CI real.
