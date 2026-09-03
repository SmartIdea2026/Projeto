## Why

A pasta `AncorAI/e2e/` hoje contém uma única PoC de viabilidade (`busca-local.spec.ts`, ver `openspec/changes/archive/2026-09-02-poc-viabilidade-playwright/`), cobrindo só o fluxo de busca sobre dados locais pré-semeados. Ela provou que o Playwright consegue dirigir a janela Electron real da AncorAI, mas deixou de fora todos os demais fluxos de UI — configuração de credenciais/LLM, sincronização do acervo, resumo por IA e documentos relacionados —, que hoje só têm cobertura via Vitest/jsdom contra uma ponte IPC mockada, nunca contra a janela real integrando preload, `contextBridge` e handlers do processo main. Precisamos fechar essa lacuna com uma suíte E2E que cubra os fluxos principais mapeados para o usuário final, sem repetir o padrão de "um único arquivo solto" da PoC nem tocar credenciais/rede reais.

## What Changes

- Adicionar testes E2E (Playwright) em `AncorAI/e2e/` para os fluxos principais de UI já mapeados, além do que a PoC já cobre:
  - Configuração de credenciais do GitHub e da chave do Gemini (salvar/remover, estados de conexão exibidos).
  - Sincronização do acervo (disparo manual, progresso, conclusão).
  - Resumo por IA (consentimento, geração, exibição do resumo).
  - Documentos relacionados / pilha (navegação lateral entre documentos).
  - Abertura de documento (redirecionamento externo simulado).
  - Busca por termo já é coberta pela PoC existente (`busca-local.spec.ts`); esta mudança não a duplica.
- Adicionar um teste E2E dedicado para **cada filtro** de `Filtros.tsx`, exercitado sobre um snapshot local pré-semeado próprio: alternância "Buscar no conteúdo", seletor de extensão, período (data inicial/data final) e cada critério de ordenação — cada um com um caso que resulta em subconjunto/ordem esperada e, quando aplicável, um caso de filtro sem correspondência. Sem mock de rede: alterar extensão/período só reconsulta automaticamente com uma credencial validada (`App.tsx` - `aoAlterarFiltros`), então cada teste ajusta o filtro pela UI e reenvia o formulário de busca (`aoSubmeter`, incondicional) para aplicá-lo — ver design.md - Decisão 2.
- Introduzir um mecanismo de **injeção de endpoint de rede para teste**, análogo ao já existente `ANCORAI_E2E_USER_DATA_DIR`: variáveis de ambiente lidas no bootstrap do processo main (`src/main/index.ts`) que, quando definidas, sobrepõem as constantes `BASE` hoje hardcoded em `src/main/fontes/github.ts` e `src/main/llm/gemini.ts`. Fora desse cenário de teste, o comportamento é idêntico ao atual.
- Adicionar um servidor HTTP local mínimo (subido dentro dos próprios testes, via `node:http`) que simula as respostas do GitHub e do Gemini necessárias a cada fluxo, para que nenhum teste E2E dependa de rede real nem de credenciais verdadeiras.
- Extrair fixtures/helpers reutilizáveis para a pasta `AncorAI/e2e/` (lançamento do app, semeadura do acervo, servidor mock), evitando duplicar a lógica de setup em cada arquivo de teste — diferente da PoC original, que deliberadamente não criou abstrações por ser um teste único e exploratório.
- Adicionar os novos arquivos de teste ao script `test:e2e` já existente no `package.json` (nenhuma mudança de script é necessária, `playwright test` já roda todos os arquivos de `e2e/`).

**Fora de escopo**:
- Configurar CI (GitHub Actions) para rodar a suíte E2E.
- Substituir ou remover a cobertura Vitest existente (`test/interface/*.test.tsx`), que continua sendo a primeira linha de defesa para lógica de UI.
- Testar o fluxo de `safeStorage` contra um keyring real do SO — ver design.md para a decisão sobre como o fluxo de credenciais é exercitado sem depender disso.

## Capabilities

Esta mudança é puramente de ferramental de teste: não altera nenhum requisito ou comportamento observável descrito nas specs existentes (`busca-documentos`, `configuracao-credenciais`, `resumos-por-ia`, `analise-relacoes`, etc.) — ela adiciona uma forma nova de testar comportamentos que já existem, incluindo o pequeno ponto de injeção de endpoint de rede, que só é ativado sob variáveis de ambiente de teste e não muda o comportamento observável em produção. Por isso, nenhuma capability nova ou modificada é declarada, e a mudança usa `skip_specs: true` em `.openspec.yaml`, seguindo o mesmo precedente da PoC.

### New Capabilities
(nenhuma)

### Modified Capabilities
(nenhuma)

## Impact

- **Novo código de produção (mínimo)**: leitura de duas variáveis de ambiente adicionais no bootstrap do processo main (ex.: `ANCORAI_E2E_GITHUB_BASE_URL`, `ANCORAI_E2E_GEMINI_BASE_URL`) e um pequeno ajuste em `github.ts`/`gemini.ts` para permitir que a constante `BASE` seja sobrescrita por essas variáveis quando definidas. Sem impacto em produção fora do cenário de teste.
- **Novo código de teste**: múltiplos novos arquivos em `AncorAI/e2e/` (specs por fluxo + fixtures/helpers compartilhados), reaproveitando `semear.ts` já existente e estendendo-o conforme necessário.
- **Dependências**: nenhuma nova dependência além do `@playwright/test` já presente; o servidor mock usa apenas `node:http`, já disponível no runtime Node.
- **`package.json`**: nenhuma mudança de script necessária.
- **Sem impacto** nos testes Vitest existentes (permanecem intactos) nem em CI (não existe e não é criado aqui).
