## Context

AncorAI é um app desktop Electron (React 19 + TypeScript, `electron-vite`), não uma aplicação web — não existe um `baseURL` HTTP fixo para o Playwright acessar como em um app browser-based. O app é iniciado como uma janela `BrowserWindow` real (`src/main/janela.ts`), e a persistência é local via NeDB (`banco/repositorio.ts`), sem backend remoto.

Os testes atuais (Vitest) cobrem lógica de negócio isoladamente e componentes de UI contra uma ponte IPC (`window.ancorai`) totalmente mockada em jsdom (`test/interface/apoio.ts`) — nenhum deles sobe uma janela Electron real. Ver proposal.md - Why para a motivação completa desta PoC.

## Goals / Non-Goals

**Goals:**
- Validar que o Playwright consegue iniciar o binário Electron real da AncorAI e interagir com sua UI como um usuário faria.
- Validar um fluxo completo e observável (busca local) do clique/digitação até o resultado renderizado.
- Manter o app de produção praticamente intocado: o único ajuste é um ponto de redirecionamento de `userData` ativado apenas sob uma variável de ambiente de teste.
- Produzir evidência concreta (o teste passando ou falhando, e as dificuldades encontradas no caminho) para embasar uma decisão futura sobre adoção mais ampla.

**Non-Goals:**
- Não é objetivo alcançar cobertura E2E de qualquer outra funcionalidade além da busca local.
- Não é objetivo mockar GitHub/Gemini nem validar os fluxos que dependem deles (sincronização, credenciais, resumo por IA).
- Não é objetivo definir a arquitetura definitiva de testes E2E do projeto — decisões aqui podem mudar completamente se a adoção for confirmada depois.
- Não é objetivo configurar CI.

## Decisions

**1. Semear dados via `banco/repositorio.ts`, não escrevendo o arquivo NeDB na mão.**
O módulo de repositório já expõe a forma correta de gravar documentos em `acervo_documentos` (é o mesmo caminho que `test/persistencia/repositorio.test.ts` exercita). Escrever o arquivo `.db` diretamente exigiria replicar o formato de serialização do NeDB e ficaria frágil a qualquer mudança de schema. Um pequeno script de setup do teste importa o repositório e insere os documentos de exemplo antes do `_electron.launch()`.

**2. Isolamento de dados via uma única variável de ambiente lida no startup do processo main.**
Quando `ANCORAI_E2E_USER_DATA_DIR` (ou nome equivalente) estiver definida, o processo main chama `app.setPath('userData', process.env.ANCORAI_E2E_USER_DATA_DIR)` antes de qualquer leitura/escrita no banco. Fora desse cenário, o comportamento é idêntico ao atual. Alternativa descartada: passar um argumento de CLI — o env var é mais simples de configurar via `_electron.launch({ env: {...} })` do Playwright.

**3. Sem mock de rede.**
O fluxo escolhido (busca local) não chama `fetch` para GitHub nem Gemini em nenhum ponto do caminho testado, então nenhuma infraestrutura de mock (`undici` `MockAgent`, fixtures, etc.) é necessária para esta PoC. Isso foi uma decisão deliberada de escopo para manter a PoC pequena — ver proposal.md - What Changes (fora de escopo).

**4. Build leve (`electron-vite build`) em vez do `npm run build` completo.**
O `npm run build` do projeto roda dois `tsc --noEmit` antes do build — valioso para uma entrega, mas irrelevante para testar se o Playwright consegue dirigir a janela Electron. Usar só `electron-vite build` no script `test:e2e` reduz o tempo de iteração enquanto se descobre se a ferramenta funciona.

**5. `_electron.launch()` apontando para a saída buildada (`out/main/index.js`), não para o modo dev.**
Testar contra o artefato buildado é o que mais se aproxima do que um usuário final roda, e evita depender do dev-server do Vite/HMR durante o teste.

**6. Um único arquivo de teste, sem abstrações de page-object ou helpers reutilizáveis.**
Dado que o objetivo é validar viabilidade e não construir uma suíte, qualquer camada de abstração adicionada agora é esforço que pode não sobreviver a uma futura decisão de arquitetura de testes E2E. O teste é escrito da forma mais direta possível.

## Risks / Trade-offs

- **[Risco] `safeStorage` ou outras APIs do Electron podem se comportar de forma diferente/instável em ambiente headless (ex.: máquina sem sessão gráfica).** → Mitigação: o fluxo escolhido não usa `safeStorage` (não toca credenciais), então esse risco fica fora do caminho testado nesta PoC — mas deve ser registrado no documento de achados como uma limitação conhecida para fluxos futuros que o toquem.
- **[Risco] O redirecionamento de `userData` via variável de ambiente pode ser esquecido em algum ponto de leitura/escrita que já capturou o path antigo antes do `app.setPath`.** → Mitigação: o `app.setPath('userData', ...)` deve ser a primeira coisa executada no bootstrap do processo main, antes de qualquer inicialização do banco.
- **[Risco] Resultado da PoC pode ser inconclusivo (ex.: o teste é instável/flaky sem uma causa clara).** → Mitigação: é um resultado válido para o documento de achados — o objetivo é descobrir a viabilidade, não garantir sucesso.
- **[Trade-off] Sem cobertura de regressão real** — este único teste não substitui nem complementa a suíte Vitest existente em termos de proteção contra regressões; é puramente exploratório.

## Open Questions

(nenhuma — todas as decisões relevantes para esta PoC foram resolvidas acima; qualquer decisão sobre adoção mais ampla do Playwright fica para depois que o documento de achados em `Docs/Pesquisas/` for produzido.)
