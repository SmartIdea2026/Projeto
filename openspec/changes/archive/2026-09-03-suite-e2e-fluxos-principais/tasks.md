## 1. Ponto de injeção de endpoint (produção, gated por env var de teste)

- [x] 1.1 Em `AncorAI/src/main/fontes/github.ts`, trocar a constante `BASE` fixa por `process.env['ANCORAI_E2E_GITHUB_BASE_URL'] || 'https://api.github.com'`, e verificar que `npm run test` (Vitest) continua passando sem a env var definida (comportamento padrão inalterado).
- [x] 1.2 Em `AncorAI/src/main/llm/gemini.ts`, trocar a constante `BASE` fixa por `process.env['ANCORAI_E2E_GEMINI_BASE_URL'] || 'https://generativelanguage.googleapis.com/v1beta'`, e verificar que a suíte Vitest de `test/conteudo/gemini.test.ts` continua passando.
- [x] 1.3 Confirmar por leitura de código que nenhum outro ponto do processo main lê `BASE` de `github.ts`/`gemini.ts` de forma que ignore a nova resolução (ex.: valor capturado antes do processamento das env vars).

## 2. Fixtures e helpers compartilhados em `AncorAI/e2e/apoio/`

- [x] 2.1 Criar `AncorAI/e2e/apoio/lancarApp.ts`: helper (`lancarApp(opcoes)`, não um fixture `test.extend` — ver nota de implementação) que cria o diretório `userData` temporário, lança `_electron.launch()` com os mesmos argumentos da PoC (`--ozone-platform=x11`, `ANCORAI_E2E_USER_DATA_DIR`), aceita opcionalmente URLs de mock de GitHub/Gemini a repassar como env vars, e fecha o app + remove o diretório temporário ao final — verificado com um teste trivial (`app.firstWindow()` abre) usando o helper.
- [x] 2.2 Criar `AncorAI/e2e/apoio/servidorMockGithub.ts`: função `subirServidorGithub(config)` que sobe um servidor `node:http` em porta efêmera (`listen(0)`, via `servidorHttp.ts` compartilhado) servindo `GET /user`, `GET /user/repos`, `GET /repos/:full/git/trees/:branch`, `GET /repos/:full/commits` (autoria por caminho), `GET /repos/:full/git/blobs/:sha`, configuráveis por teste; devolve `{ url, fechar() }` — verificado com um teste isolado fazendo requisições HTTP diretas a cada rota.
- [x] 2.3 Criar `AncorAI/e2e/apoio/servidorMockGemini.ts`: função `subirServidorGemini(config)` equivalente para `GET /models` e `POST /models/:modelo:generateContent`, com um handler default que devolve um catálogo de modelo válido e um resumo de exemplo — verificado do mesmo jeito que 2.2.
- [x] 2.4 Estender `AncorAI/e2e/semear.ts` com `semearComTexto(diretorioDados, { documento, texto })` (usa `gravarConteudo`, sem popular `versaoConteudo` no `Documento`) e `semearComResumo(diretorioDados, { documento, resumo, categoria, assuntos, destaques })` (usa `gravarConteudo` + `gravarResumo`) — verificado com leitura direta do NeDB (`lerConteudo`) confirmando os campos persistidos.
- [x] 2.5 Criar `AncorAI/e2e/apoio/semearFiltros.ts` com `semearParaFiltros(diretorioDados)`: 5 documentos (extensões md/pdf/txt/docx distintas, datas espaçadas de janeiro a agosto de 2026, e um 5º documento cujo termo de busca só existe no conteúdo gravado, não no nome) — verificado com leitura direta do NeDB confirmando os campos semeados.

## 3. Teste: filtros de busca (`Filtros.tsx`)

- [x] 3.1 Criar `AncorAI/e2e/filtros.spec.ts`, semeando via `semearParaFiltros` (task 2.5). Sem mock de GitHub: descoberto durante a implementação que `safeStorage` está indisponível para o app lançado via `_electron.launch()` nesta suíte (ver relato ao usuário), então nenhum teste consegue gravar uma credencial de verdade; em vez disso, cada teste ajusta o filtro pelo controle da UI (que sempre atualiza o estado local) e reenvia o formulário de busca (`aoSubmeter`, sempre incondicional) para aplicar o filtro — ver comentário no topo do arquivo.
- [x] 3.2 Cobrir o seletor de extensão: escolher uma extensão e verificar que só os documentos com aquela extensão aparecem; escolher uma extensão sem documentos correspondentes e verificar lista vazia.
- [x] 3.3 Cobrir o filtro de período: preencher data inicial/final cobrindo só um subconjunto dos documentos semeados e verificar que apenas os documentos dentro do intervalo aparecem; testar um intervalo sem nenhum documento correspondente.
- [x] 3.4 Cobrir cada critério de ordenação disponível e verificar que a lista de resultados aparece na ordem esperada para cada um (comparar a sequência de nomes/cartões renderizados).
- [x] 3.5 Cobrir a alternância "Buscar no conteúdo": com ela desligada, buscar um termo que só existe no conteúdo do documento semeado e verificar que ele NÃO aparece; com ela ligada, verificar que aparece com a marca "Encontrado no conteúdo".
- [x] 3.6 Cobrir a combinação de dois filtros ao mesmo tempo (ex.: extensão + período) e verificar que o resultado é a interseção esperada, não a união.
- [x] 3.7 Rodar o arquivo isoladamente (`playwright test filtros.spec.ts`) e confirmar execução determinística em 3 rodadas locais — 7/7 testes passando nas 3 rodadas.

## 4. Teste: configuração de credenciais (GitHub + Gemini)

- [x] 4.1 Criar `AncorAI/e2e/configuracao-credenciais.spec.ts` (usando `lancarApp`, que resolve o bloqueio de `safeStorage` — design.md Decisão 5b): abre o app sem credenciais, abre o modal de configurações (ícone ⚙), preenche e salva o token do GitHub apontando para o mock (`GET /user` retornando um login válido) — verificado que a UI mostra "Conectada" e o nome da conta, e que o campo é limpo após salvar.
- [x] 4.2 No mesmo arquivo, cobrir o caminho de token inválido: mock de `GET /user` devolvendo 401 — verificado que a UI mostra o erro de credencial inválida.
- [x] 4.3 Cobrir salvar/remover a chave do Gemini: mock de `GET /models` devolvendo um catálogo válido — verificado que a UI mostra o modelo em uso e que "Remover" limpa o estado exibido.
- [x] 4.4 Rodar o arquivo isoladamente (`playwright test configuracao-credenciais.spec.ts`) e confirmar execução determinística em 3 rodadas — 3/3 testes passando nas 3 rodadas.

## 5. Teste: sincronização do acervo

- [x] 5.1 Criar `AncorAI/e2e/sincronizacao-acervo.spec.ts`: sobe o mock GitHub com um repositório de exemplo (1 arquivo na árvore, autoria e conteúdo de blob mockados), abre o app (via `lancarApp`) e salva o token do GitHub pela tela de configurações contra o mock (`GET /user`) antes de disparar a sincronização.
- [x] 5.2 Clicar em "Sincronizar" e verificar que o botão muda para o estado "em-andamento" imediatamente (otimista, antes da conclusão) — verificado (`data-estado="em-andamento"`), determinístico em 3 rodadas.
- [x] 5.3 Verificar que o estado final exibido é "concluída", com as contagens (1 documento, 1 com texto obtido) batendo com os documentos servidos pelo mock.
- [x] 5.4 Cobrir um desfecho de suspensão (`GET /user/repos` devolvendo 401) e verificar que a UI mostra o motivo "Não foi possível obter a lista de documentos do GitHub." (`falha-inventario`).

## 6. Teste: resumo por IA

- [x] 6.1 Criar `AncorAI/e2e/resumo-ia.spec.ts`: semear um documento com texto local já extraído (`semearComTexto`) e subir o mock Gemini com `GET /models` e `POST .../generateContent` devolvendo um resumo de exemplo. Descoberto e corrigido no processo: `lancarApp` apontava para `out/main/index.js` diretamente, o que quebra `app.getAppPath()` e faz `lerInstrucao()` nunca achar `instrucoes/resumo.md` — corrigido apontando para o diretório do projeto (design.md - Decisão 5b).
- [x] 6.2 Abrir o app, salvar a chave do Gemini pela tela de configurações contra o mock, buscar o documento pelo nome (busca sobre snapshot, sem gate de credencial) e verificar que o bloco de consentimento aparece antes do primeiro resumo, avançando para o resumo ao clicar "Permitir e gerar resumos".
- [x] 6.3 Verificar que o painel mostra resumo, assuntos e destaques batendo com o que o mock devolveu.
- [x] 6.4 Cobrir o caminho de falha: mock do Gemini devolvendo 429 — verificado que o painel mostra a mensagem de cota excedida e o botão "Tentar novamente". Determinístico em 3 rodadas.

## 7. Teste: documentos relacionados

- [x] 7.1 Criar `AncorAI/e2e/documentos-relacionados.spec.ts`: semear 3 documentos via `semearComResumo` (A/B com 2 assuntos em comum, C sem nenhum). Corrigido no processo: `sincronizarInventario` substitui o inventário inteiro, então `semear.ts` passou a acrescentar em vez de substituir (design.md - Decisão 7).
- [x] 7.2 Focar o documento com relacionados esperados (após consentir — necessário mesmo para resumo já gravado, ver Decisão 7) e verificar que a pilha lista o documento com assuntos em comum e não lista o sem relação.
- [x] 7.3 Clicar em um item da pilha e verificar que o painel de resumo passa a exibir esse documento, sem alterar a lista de resultados da busca. Determinístico em 3 rodadas.

## 8. Teste: abertura de documento

- [x] 8.1 Criar `AncorAI/e2e/abertura-documento.spec.ts`: semear via `semear.ts` existente (`semearAcervo`), sem mock de rede.
- [x] 8.2 Clicar em "Abrir em GitHub" no cartão do documento e verificar o registro de acesso — descoberto que não há UI para "documentos acessados" (grep vazio em `src/renderer/`), então a verificação lê `listarAcessados()` diretamente do NeDB; `shell.openExternal` foi desligado sob a env var de teste para não abrir um navegador real (design.md - Decisão 4, revisada). Determinístico em 3 rodadas; suíte Vitest completa (451 testes) continua passando após a mudança em `ipc.ts`.

## 9. Integração e limpeza

- [x] 9.1 Rodar a suíte E2E completa (`npm run test:e2e` em `AncorAI/`) e confirmar que todos os arquivos (a PoC existente + os 6 novos) passam juntos. Corrigido no processo: `fullyParallel: false` não limita a 1 worker entre arquivos, o que expunha uma corrida real na alocação de porta entre processos Electron concorrentes — `workers: 1` adicionado a `playwright.config.ts` (design.md - Trade-offs). 19/19 testes passando em 3 execuções completas consecutivas.
- [x] 9.2 Rodar a suíte Vitest completa (`npm run test` em `AncorAI/`) e confirmar que nada foi quebrado pelas mudanças de produção (tarefa 1 + o desligamento de `shell.openExternal` sob a suíte E2E, tarefa 8.2) — 451/451 testes passando.
- [x] 9.3 Revisar que nenhum teste novo depende de rede real ou de uma credencial real: suíte completa rodada dentro de um namespace de rede isolado (`unshare --net`, sem acesso a `api.github.com`/`generativelanguage.googleapis.com`, só loopback) — 19/19 testes passando, confirmando que nenhum caminho depende de rede real.
