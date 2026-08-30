# Tarefas — Ingestão do conteúdo dos documentos

## 1. Decisão registrada antes do código

- [x] 1.1 Escrever a ADR que autoriza armazenar o conteúdo dos documentos no banco local, nomeando o risco do texto em claro no disco e referenciando a ADR-0002 conforme o processo — verificar que a ADR cita nominalmente a cláusula derrubada ("O conteúdo dos documentos **não** será armazenado") e não apenas o número da ADR
- [ ] 1.2 Levar à equipe a questão em aberto sobre o status da ADR-0002 (*Substituído* por inteiro ou mantida com ressalva) e registrar a decisão tomada — verificar que o status resultante consta do arquivo da ADR-0002
- [x] 1.3 Corrigir os artefatos da mudança pendente `resumos-e-indice-por-ia`, removendo do delta `indice-local` e do `design.md` dela a afirmação de que o conteúdo nunca é armazenado — verificar com `grep` que nenhum artefato daquela mudança ainda afirma que o conteúdo é descartado
- [x] 1.4 Atualizar o `GlossarioTecnico.md` com os termos introduzidos aqui (ingestão, extração de texto, `sha` de blob) — verificar que cada termo novo usado nos artefatos tem entrada

## 2. Obtenção do conteúdo na fonte

- [x] 2.1 Acrescentar `size` à interface `ArvoreApi` e propagar o `sha` e o tamanho de cada arquivo a partir do inventário — verificar com teste que ambos chegam junto ao documento inventariado
- [x] 2.2 Extrair de `requisitar` o tratamento comum de 304, 401, 403, 429 e falha de rede, de modo que uma segunda função possa reusá-lo sem duplicar — verificar que os testes existentes de falha do GitHub continuam passando sem alteração
- [x] 2.3 Implementar a obtenção de bytes pelo endpoint de blob (`git/blobs/{sha}` com mídia bruta), sobre o tratamento comum da tarefa anterior — verificar com teste que 403 por limite excedido devolve `ErroFonte` com `limiteExcedido`
- [x] 2.4 Descartar antes do download o documento cujo `size` exceda o limite por arquivo — verificar com teste que nenhuma requisição é feita nesse caso
- [x] 2.5 Garantir que falhar ao obter o conteúdo de um documento não invalida o inventário nem o remove dos resultados — verificar com teste que a busca segue apresentando o documento

## 3. Extração do texto

- [x] 3.1 Criar o módulo de extração com despacho por extensão e um resultado tipado que distinga texto extraído, ausência de texto e falha, com o motivo — verificar com teste de cada um dos três casos
- [x] 3.2 Implementar a extração de `md` e `txt` por decodificação UTF-8 — verificar com teste, incluindo arquivo com acentuação
- [x] 3.3 Adicionar `pdfjs-dist` e implementar a extração de `pdf` — verificar com teste sobre um PDF de exemplo versionado junto ao teste
- [x] 3.4 Adicionar `mammoth` e implementar a extração de `docx` — verificar com teste sobre um DOCX de exemplo versionado junto ao teste
- [x] 3.5 Adicionar `jszip` e implementar a extração de `epub` a partir dos XHTML internos — verificar com teste sobre um EPUB de exemplo versionado junto ao teste
- [x] 3.6 Registrar `xls`, `xlsx` e `doc` como sem texto disponível, com o motivo, sem produzir erro — verificar com teste dos três e que a decisão está registrada no design
- [x] 3.7 Tratar extração que devolve texto vazio como ausência de texto, e não como falha — verificar com teste
- [x] 3.8 Truncar o texto no limite por documento e marcar no resultado que houve truncamento — verificar com teste que o texto acima do limite é cortado e a marca fica gravada
- [x] 3.9 Confirmar que nenhuma das dependências novas puxa módulo nativo — verificar que `npm run package` conclui sem etapa de recompilação

## 4. Persistência do texto

- [x] 4.1 Criar a coleção `conteudo_documentos` em `banco/repositorio.ts`, com identificador, `sha`, texto, estado, motivo, marca de truncamento e data — verificar com teste de gravação e leitura
- [x] 4.2 Abrir a coleção sob demanda, e não na inicialização junto das demais — verificar com teste que iniciar a aplicação e listar acessados não carrega a coleção de conteúdo
- [x] 4.3 Garantir que os bytes originais não são persistidos em nenhum ponto — verificar com teste que percorre o registro gravado e falha se encontrar dado binário
- [x] 4.4 Manter `documentos_acessados` inalterada, guardando apenas identificação, nome, fonte, link e data — verificar com o teste existente de registro de acesso
- [x] 4.5 Descartar o texto armazenado de documentos que deixaram de constar do inventário — verificar com teste

## 5. Revalidação e ingestão

- [x] 5.1 Reaproveitar o texto armazenado quando o `sha` do inventário coincidir com o gravado — verificar com teste que nenhuma requisição de conteúdo é feita nesse caso
- [x] 5.2 Reobter e substituir o texto quando o `sha` divergir — verificar com teste que o texto antigo é substituído e o `sha` novo gravado
- [x] 5.3 Implementar a ingestão sob demanda de um documento específico, entregando o texto a quem o solicitou — verificar com teste
- [x] 5.4 Implementar a ingestão de segundo plano, percorrendo apenas os documentos sem texto vigente, em série e com concorrência um — verificar com teste que nunca há duas obtenções simultâneas
- [x] 5.5 Tornar a ingestão de fundo retomável, sem reprocessar o que já foi extraído — verificar com teste que interrompe e retoma
- [x] 5.6 Fazer a ingestão ceder a vez enquanto houver busca em andamento — verificar com teste que uma busca disparada durante a ingestão não espera por ela
- [x] 5.7 Suspender a ingestão sem perda ao receber recusa por limite de requisições — verificar com teste que o já extraído permanece e a busca continua funcionando
- [x] 5.8 Suspender a ingestão de fundo ao atingir o teto total de texto armazenado — verificar com teste

## 6. Fronteira do conteúdo

- [x] 6.1 Expor o disparo da ingestão por canal IPC que devolva apenas contagens de progresso — verificar com teste que a resposta não contém texto
- [x] 6.2 Estender o teste de fronteira existente para falhar se qualquer canal registrado devolver conteúdo ou texto de documento — verificar que o teste falha ao se introduzir deliberadamente um canal que devolva texto
- [x] 6.3 Confirmar que a apresentação e o acesso ao documento seguem idênticos, redirecionando à fonte original — verificar com os testes de componente existentes, sem alteração neles

## 7. Documentação e encerramento

- [x] 7.1 Atualizar o `README.md` com o comportamento novo, as dependências acrescentadas e o que passa a ser gravado no banco local — verificar que a seção de persistência não afirma mais que apenas links são armazenados
- [x] 7.2 Executar a suíte completa, `tsc` nos dois projetos e o build — verificar que tudo passa
- [x] 7.3 Percorrer cada requisito dos três deltas conferindo a correspondência com o código, cenário a cenário — verificar que nenhum cenário ficou sem contrapartida implementada
- [x] 7.4 Executar `/opsx:archive` para incorporar os deltas às especificações principais
