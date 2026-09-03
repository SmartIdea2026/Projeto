## 1. Instalação e configuração mínima do Playwright

- [x] 1.1 Adicionar `@playwright/test` como devDependency em `AncorAI/package.json` e verificar que `npx playwright --version` roda sem erro
- [x] 1.2 Instalar os browsers necessários (`npx playwright install`) e criar `AncorAI/e2e/playwright.config.ts` mínimo (sem `webServer`/`baseURL`, já que o alvo é o app Electron, não um browser apontando para uma URL) — os browsers do Playwright já estavam em cache nesta máquina; `_electron.launch()` usa o Electron do próprio projeto, não um browser gerenciado pelo Playwright
- [x] 1.3 Adicionar script `test:e2e` em `AncorAI/package.json` que builda (`electron-vite build`) e então roda `playwright test` a partir de `e2e/`

## 2. Isolamento de dados no processo main

- [x] 2.1 No bootstrap do processo main (antes de qualquer inicialização do banco), ler a variável de ambiente `ANCORAI_E2E_USER_DATA_DIR`; se definida, chamar `app.setPath('userData', <valor>)` antes de qualquer outro acesso a caminho de dados, e verificar manualmente que rodar o app com essa variável definida grava o banco no diretório informado em vez do `userData` padrão — confirmado pela própria execução do teste E2E (tarefa 4.1): a busca só encontra o documento semeado porque o app leu o snapshot do diretório temporário injetado

## 3. Seed de dados de teste

- [x] 3.1 Criar um script/módulo de setup em `AncorAI/e2e/` que, usando `banco/repositorio.ts`, insere alguns documentos de exemplo em `acervo_documentos` num diretório de dados temporário (um deles com um termo de busca distintivo, outro sem esse termo), e verificar rodando o script isoladamente que os documentos aparecem no arquivo NeDB gerado — a execução isolada via Node puro esbarrou em uma limitação de tooling (ver documento de achados); a verificação foi feita pela via real de uso do módulo, o teste Playwright (tarefa 4.1), que só encontra o documento porque o seed gravou corretamente no `acervo_documentos.db`

## 4. Teste E2E do fluxo de busca

- [x] 4.1 Escrever `AncorAI/e2e/busca-local.spec.ts` (nome e títulos de teste em português) que: cria um diretório temporário, roda o seed da tarefa 3.1, lança o app via `_electron.launch()` passando `ANCORAI_E2E_USER_DATA_DIR` apontando para esse diretório, digita o termo distintivo no campo de busca, e verifica que o card do documento esperado aparece na UI
- [x] 4.2 Adicionar ao mesmo teste (ou um segundo caso no mesmo arquivo) a verificação de que um termo sem correspondência não retorna nenhum resultado — ajustado para checar ausência de cartões de documento em vez da mensagem "Nenhum documento encontrado", que só aparece com uma credencial do GitHub configurada (fora do escopo desta PoC); ver documento de achados
- [x] 4.3 Rodar `npm run test:e2e` de ponta a ponta e verificar que o(s) teste(s) passam de forma repetível (rodar pelo menos 3 vezes seguidas para checar estabilidade) — 3 execuções seguidas, todas verdes; uma flakiness real foi encontrada e corrigida no caminho (locator ambíguo entre o cartão e o painel de resumo), ver documento de achados

## 5. Documentação dos achados

- [x] 5.1 Criar `Projeto/Docs/Pesquisas/ViabilidadePlaywright.md` cobrindo: facilidade/dificuldade de configuração, dificuldades específicas do Electron encontradas (se houver), workarounds necessários, estabilidade observada (resultado das 3+ execuções da tarefa 4.3), limitações identificadas, e uma conclusão sobre a viabilidade de adoção mais ampla do Playwright no projeto
- [x] 5.2 Verificar que os testes Vitest existentes continuam passando sem alteração (`npm test`), confirmando que a mudança não afetou a suíte atual — 32 arquivos, 392 testes, todos passando
