## Why

Hoje a AncorAI só tem cobertura de Vitest, e os testes de interface (`test/interface/*.test.tsx`) rodam em jsdom contra uma ponte IPC (`window.ancorai`) totalmente mockada — nunca contra uma janela Electron real. Isso deixa uma lacuna: nada hoje valida que o preload, o `contextBridge`, os handlers IPC do processo main e a janela real do Electron funcionam juntos como um usuário de fato experimentaria. Antes de investir em uma suíte E2E completa, precisamos saber se o Playwright é sequer viável nesta arquitetura Electron específica — se consegue iniciar o app buildado, interagir com a UI real e validar comportamento, sem workarounds proibitivos.

## What Changes

- Adicionar o Playwright como ferramenta de teste E2E no projeto `AncorAI/`, com configuração mínima (`AncorAI/e2e/`).
- Escrever **um único** teste E2E cobrindo o fluxo de busca sobre dados locais pré-semeados no NeDB (`acervo_documentos`):
  - Semear alguns documentos de exemplo antes de abrir o app, reaproveitando o módulo existente `banco/repositorio.ts` (mesma lógica já exercida por `test/persistencia/repositorio.test.ts`), sem passar pelo GitHub.
  - Abrir o app real via `_electron.launch()` do Playwright.
  - Digitar um termo de busca na UI e verificar que o card correto aparece (e, se viável, que um termo sem correspondência não retorna resultados).
- Ajustar o processo main para redirecionar `app.setPath('userData', ...)` para um diretório temporário quando uma variável de ambiente de teste estiver definida, evitando que o teste escreva sobre o banco local real do desenvolvedor.
- Adicionar um script `test:e2e` no `package.json` que builda o app (`electron-vite build`, sem o duplo `tsc --noEmit` do `npm run build` completo) e executa o teste Playwright.
- Documentar os achados da PoC em `Projeto/Docs/Pesquisas/` (novo arquivo): facilidade/dificuldade de configuração, dificuldades específicas de Electron, workarounds necessários, estabilidade observada, limitações e uma conclusão sobre viabilidade de adoção mais ampla do Playwright no projeto.

**Fora de escopo** (deliberadamente, para manter esta PoC pequena e isolada):
- Converter os testes existentes de `test/interface/*.test.tsx` para Playwright.
- Cobrir qualquer outro fluxo/funcionalidade além da busca sobre dados locais.
- Mockar chamadas de rede ao GitHub/Gemini (o fluxo escolhido não as toca).
- Criar uma suíte E2E completa ou uma arquitetura de testes definitiva.
- Criar workflow de CI (GitHub Actions) para os testes E2E.

## Capabilities

Esta mudança é puramente de ferramental de teste: não altera nenhum requisito ou comportamento observável do sistema descrito nas specs existentes (`busca-documentos`, `configuracao-credenciais`, etc.) — ela apenas adiciona uma forma nova de testar um comportamento que já existe. Por isso, nenhuma capability nova ou modificada é declarada, e a mudança usa `skip_specs: true` em `.openspec.yaml`.

### New Capabilities
(nenhuma)

### Modified Capabilities
(nenhuma)

## Impact

- **Novo código**: pequeno ajuste no processo main (leitura de variável de ambiente para redirecionar `userData`), pasta `AncorAI/e2e/` com config do Playwright e um arquivo de teste.
- **Dependências**: adiciona `@playwright/test` como devDependency.
- **`package.json`**: novo script `test:e2e`.
- **Documentação**: novo arquivo em `Projeto/Docs/Pesquisas/` com as conclusões da PoC.
- **Sem impacto** em código de produção além do redirecionamento de `userData` (que só ativa sob a variável de ambiente de teste), em CI (não existe e não é criado aqui), ou nos testes Vitest existentes (permanecem intactos).
