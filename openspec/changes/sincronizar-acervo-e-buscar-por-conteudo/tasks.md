# Tarefas — Sincronização do acervo e busca pelo conteúdo

## 1. Guarda de execução única da sincronização

- [x] 1.1 Acrescentar a `conteudo/ingestao.ts` uma guarda que, havendo varredura em andamento, faz uma nova chamada de `ingerirAcervo()` aguardar e devolver o progresso da que corre em vez de iniciar outra — verificar com teste que duas chamadas concorrentes resultam em uma única varredura e o mesmo resultado
- [x] 1.2 Fazer o disparo da abertura (`main/index.ts`) e o do canal `conteudo:indexar` passarem os dois pela guarda — verificar com teste que acionar o canal enquanto a varredura da abertura corre não inicia segunda varredura
- [x] 1.3 Liberar a guarda no `finally` da varredura, junto da escrita do estado final, sem deixar o estado preso em `em-andamento` após interrupção por `cancelarIngestao()` — verificar com teste que interrompe e confirma o estado final coerente

## 2. Retrato e canal de estado da sincronização

- [x] 2.1 Manter em `conteudo/ingestao.ts` um retrato em memória do andamento: estado (`parada` | `em-andamento` | `concluida` | `suspensa`), as contagens de `ProgressoIngestao` e o motivo de suspensão — verificar com teste que o retrato acompanha as transições da varredura
- [x] 2.2 Registrar o canal de leitura `sincronizacao:estado` (nome em `compartilhado/canais.ts`, handler em `main/ipc.ts`, assinatura na ponte em `preload/index.ts`) que devolve o retrato — contagens e estado apenas, nunca texto — verificar com teste do handler
- [x] 2.3 Distinguir no motivo de suspensão: limite de requisições da fonte, limite de armazenamento atingido, credencial do GitHub ausente e falha ao obter o inventário — verificar com teste de cada caso

## 3. Botão de sincronização no cabeçalho

- [x] 3.1 Acrescentar o botão de sincronização ao cabeçalho do renderer, ao lado do acesso às configurações, acionando o canal `conteudo:indexar` — verificar com teste de componente que o clique dispara a sincronização
- [x] 3.2 Apresentar os estados do botão: parada (acionável), em andamento (progresso em contagens, não acionável), concluída (acionável), suspensa (motivo visível, acionável) — verificar com teste de componente dos quatro estados
- [x] 3.3 Consultar `sincronizacao:estado` ao montar e, enquanto o estado for `em-andamento`, em intervalo modesto, parando ao concluir ou suspender — verificar com teste que avança o relógio e confirma que a consulta cessa fora de `em-andamento`
- [x] 3.4 Não iniciar segunda sincronização ao acionar o botão durante uma em andamento; refletir na interface que já há uma em curso — verificar com teste de componente
- [x] 3.5 Manter busca e lista de resultados utilizáveis quando a sincronização falha ou é suspensa — verificar com teste de componente

## 4. Correspondência pelo conteúdo no processo principal

- [x] 4.1 Ler o texto de `conteudo_documentos` em `main/banco/repositorio.ts` para uso na correspondência, sem expô-lo por canal — verificar com teste de leitura
- [x] 4.2 Estender a correspondência de termo em `busca/regras.ts` / `busca/servico.ts` para casar também com o texto armazenado, com a mesma normalização sem acento e sem caixa já usada para nome e autor — verificar com teste que um termo presente só no conteúdo traz o documento
- [x] 4.3 Manter a correspondência aditiva: nome, autor OU conteúdo, sem modo separado, resultado único — verificar com teste que um documento que casa por nome e outro que casa só por conteúdo aparecem no mesmo resultado
- [x] 4.4 Marcar no resultado quando a correspondência se deu apenas pelo conteúdo, sem incluir o texto na resposta — verificar com teste que o resultado carrega a marca e nenhum trecho
- [x] 4.5 Não quebrar a busca para documentos sem texto armazenado ou de formato sem extração: continuam encontráveis por nome e autor — verificar com teste

## 5. Aviso de alcance parcial

- [x] 5.1 Emitir um `aviso` de resultado parcial quando há termo e nem todo documento do inventário tem registro de conteúdo vigente, com a contagem do que ficou fora — verificar com teste que o aviso aparece com o acervo sincronizado pela metade e some quando a cobertura é total
- [x] 5.2 Apresentar esse aviso no renderer pelo mesmo caminho dos demais avisos de resultado parcial — verificar com teste de componente

## 6. Apresentação do resultado e acessibilidade

- [x] 6.1 Assinalar no cartão de resultado a correspondência pelo conteúdo, sem depender apenas de cor — verificar com teste de componente e conferindo o contraste do elemento novo
- [x] 6.2 Tornar o botão de sincronização alcançável por teclado, com foco assinalado e rótulo acessível — verificar com o teste de tabulação existente, estendido
- [x] 6.3 Estender `test/seguranca/fronteira-conteudo.test.ts` para cobrir o canal de busca e o de estado da sincronização — verificar que nenhum dos dois devolve texto de documento

## 7. Documentação

- [x] 7.1 Atualizar `AncorAI/README.md`: a busca alcança o conteúdo dos documentos, e há botão de sincronização no cabeçalho — verificar que o README descreve o comportamento real
- [x] 7.2 Remover "Busca por conteúdo (full-text)" da lista de escopo adiado do `AGENTS.md` — verificar que a seção 9 não a lista mais e que a seção de busca reflete a correspondência por conteúdo
- [x] 7.3 Acrescentar ao `Docs/Requisitos/GlossarioTecnico.md` entradas para busca por conteúdo e sincronização do acervo — verificar que cada termo novo usado nos artefatos tem entrada

## 8. Encerramento

- [x] 8.1 Executar a suíte completa, `npx tsc --noEmit` nos dois projetos e `npx electron-vite build` — verificar que tudo passa
- [x] 8.2 Percorrer cada requisito dos deltas `busca-documentos` e `conteudo-documentos` conferindo a correspondência com o código, cenário a cenário — verificar que nenhum cenário ficou sem contrapartida
- [ ] 8.3 Executar `/opsx:archive` para incorporar os deltas às especificações principais

## 9. Ajuste pós-uso: casamento no conteúdo

Durante o uso real, a busca no conteúdo trouxe ruído demais. Dois ajustes, com a spec `busca-documentos` e o `design.md` atualizados:

- [x] 9.1 No conteúdo, casar o termo como **palavra inteira** (`contemPalavra` em `busca/regras.ts`), não substring — "ata" deixa de casar com "tratamento", "data", "plataforma" — verificar com teste
- [x] 9.2 Tornar a busca no conteúdo **opt-in**: caixa "Buscar no conteúdo" em `Filtros.tsx` (`filtros.buscarConteudo`, desligada por padrão); `servico.ts` só abre a coleção e só avisa sobre alcance parcial quando ligada; `mesmaConsulta` considera o novo campo — verificar com teste de componente (padrão não pede conteúdo; marcar refaz a consulta) e de serviço (desligada casa só nome/autor)

## 10. Inventário e autoria servidos de um snapshot local

Durante o uso real, a busca com termo mostrou-se lenta: `enriquecerParaBusca` faz **uma requisição ao GitHub por documento** do acervo a cada consulta (autoria e data real), e mesmo revalidando ETag cada uma é uma ida à rede. Persistir o inventário e a autoria **na sincronização** e servir a busca desse snapshot local elimina essa latência. Era a intenção da mudança desde o início — a sincronização deixa de alimentar só a busca pelo conteúdo e passa a alimentar a busca inteira. **Trade-off aceito:** a busca passa a refletir a última sincronização; documento criado, renomeado ou removido na fonte só entra/sai depois de sincronizar (o que roda na abertura e pelo botão). Specs `busca-documentos` e `conteudo-documentos` e o `design.md` atualizados.

- [x] 10.1 `banco/repositorio.ts`: coleção `acervo_documentos` (NoSQL, ADR-0002), aberta sob demanda como `conteudo_documentos`. `sincronizarInventario(documentos)` faz upsert dos metadados de cada documento do inventário e remove os que saíram; `gravarAutoria(id, { autor, dataModificacao, versaoAutoria })`; `inventarioSincronizado()` devolve `Documento[]` já com `autor` e data real quando resolvidos, e `[]` quando a coleção nunca foi preenchida — verificar com teste de leitura e escrita
- [x] 10.2 `conteudo/ingestao.ts` (`varrerAcervo`): depois de obter o inventário, chamar `sincronizarInventario`. No laço, além do texto, resolver a autoria de cada documento cujo `autor` guardado falte ou cujo `versaoAutoria` não corresponda ao `versaoConteudo` vigente — `github.autoriaDoArquivo`, serial, cedendo a vez (`aguardarVez`), reaproveitando o guardado quando o `sha` do blob não mudou. Falha ao obter autoria **não** conta como falha da varredura — verificar com teste que a autoria é gravada e que o `sha` inalterado não gera nova requisição
- [x] 10.3 `busca/servico.ts` (`executarBusca`): quando `inventarioSincronizado()` traz documentos, montar o resultado a partir dele — sem `coletar` nem `enriquecerParaBusca` no GitHub. Coleção vazia → cai no caminho ao vivo atual, sem alarme. `mesmaConsulta` e o conjunto retido (`vigente`) seguem iguais — verificar com teste que a busca servida do snapshot não faz requisição de rede
- [x] 10.4 No caminho do snapshot, o filtro de período usa a data real já gravada e `avisarSobreAlcanceDoPeriodo` continua valendo para o que ficou sem data. O aviso "considerou os 300 primeiros" é do caminho ao vivo e lá permanece; no snapshot, emitir em seu lugar um aviso quando há documentos ainda sem autoria sincronizada, com a contagem — verificar com teste
- [x] 10.5 Documento fora do inventário sai das **duas** coleções na varredura seguinte: `descartarConteudoAusente` e a limpeza de `acervo_documentos` andam juntas — verificar com teste
- [x] 10.6 Atualizar `README.md`, `AGENTS.md`, `Docs/Requisitos/GlossarioTecnico.md`, `proposal.md`, `design.md` e as specs — verificar coerência com o comportamento real
- [x] 10.7 Reexecutar a suíte completa, `tsc --noEmit` nos dois projetos e `electron-vite build`; repassar os cenários das specs afetadas — verificar que tudo passa
