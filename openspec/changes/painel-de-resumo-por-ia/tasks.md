# Tarefas — Painel de resumo por IA

## 1. Decisão registrada antes do código

- [ ] 1.1 Escrever a ADR que autoriza enviar o texto dos documentos a serviço externo, nomeando o tratamento do plano gratuito do Gemini e distinguindo esta fronteira da autorizada pela ADR-0005 — verificar que a ADR diz explicitamente que guardar na máquina e enviar para fora são decisões distintas
- [ ] 1.2 Recortar a mudança pendente `resumos-e-indice-por-ia`, removendo dela os deltas `resumos-por-ia` e `configuracao-credenciais` e ajustando proposta, design e tarefas ao que lhe resta — verificar com `openspec validate --strict` e com `grep` que nenhum artefato dela ainda descreve o painel
- [ ] 1.3 Registrar no `GlossarioTecnico.md` os termos introduzidos aqui (LLM, saída estruturada, resumo desatualizado) — verificar que cada termo novo usado nos artefatos tem entrada
- [ ] 1.4 Atualizar o `AGENTS.md` e o `README.md` quanto à postura de dados, que deixa de ser "o conteúdo não sai da máquina" — verificar que nenhum documento do repositório continua afirmando isso

## 2. Credencial da LLM

- [x] 2.1 Acrescentar a chave da LLM ao cofre, com gravação unidirecional e sem canal de leitura — verificar com o teste de fronteira de credenciais, estendido para a chave nova
- [x] 2.2 Implementar a validação da chave contra a API antes de persistí-la, distinguindo chave inválida, cota excedida e falha de comunicação — verificar com teste dos três casos
- [x] 2.3 Acrescentar o campo da chave à tela de configurações, com o aviso de que o texto dos documentos é enviado ao serviço externo — verificar com teste de componente
- [x] 2.4 Manter a busca inteiramente funcional sem a chave configurada — verificar com teste que a busca responde e apenas o painel fica indisponível
- [x] 2.5 Estender o teste de tabulação do diálogo de configurações ao campo novo — verificar que a ordem segue a leitura visual

## 3. Cliente do Gemini

- [x] 3.1 Implementar o cliente HTTP do Gemini no processo principal, sem SDK, com a chave em cabeçalho e não na URL — verificar com teste que a chave não aparece na URL requisitada
- [x] 3.2 Usar saída estruturada para obter resumo, tipo, assuntos e destaques em **uma** submissão — verificar com teste que uma solicitação gera exatamente uma requisição e devolve os quatro campos
- [x] 3.3 Implementar a fila de submissões com concorrência um — verificar com teste que nunca há duas submissões simultâneas
- [x] 3.4 Traduzir os modos de falha da API em credencial ausente, credencial inválida, cota excedida e falha de comunicação — verificar com teste de cada um
- [x] 3.5 Tratar resposta que não obedece ao formato pedido como falha de geração, sem derrubar o painel — verificar com teste que usa resposta malformada

## 4. Instrução de redação

- [x] 4.1 Criar o arquivo Markdown de instrução versionado no repositório, descrevendo a estrutura do resumo e o que ele deve cobrir — verificar que existe e é revisável como documento
- [x] 4.2 Ler a instrução em tempo de execução, e não embuti-la no código — verificar com teste que alterar o arquivo altera o que é enviado
- [x] 4.3 Instruir explicitamente o modelo a ater-se ao texto recebido — verificar que a instrução contém essa orientação

## 5. Geração e persistência

- [x] 5.1 Acrescentar resumo, tipo, assuntos, destaques e data ao registro de `conteudo_documentos` — verificar com teste de gravação e leitura
- [x] 5.2 Limpar os campos de resumo ao regravar o conteúdo com versão diferente — verificar com teste que reingere com `sha` novo e confirma que o resumo antigo sumiu
- [x] 5.3 Gerar o resumo a partir do texto já armazenado, sem requisitar a fonte quando ele existe — verificar com teste que nenhuma requisição ao GitHub é feita nesse caso
- [x] 5.4 Obter o texto sob demanda quando ainda não houver, antes de submeter — verificar com teste
- [x] 5.5 Reutilizar o resumo gravado quando a versão do conteúdo coincide — verificar com teste que a segunda solicitação não faz submissão alguma
- [x] 5.6 Assinalar o resumo como desatualizado quando o conteúdo mudou depois dele, permitindo regerar — verificar com teste
- [x] 5.7 Não submeter documentos registrados como sem texto, excedentes ou com falha de extração — verificar com teste dos três estados
- [x] 5.8 Executar a geração como trabalho interativo, com precedência sobre a ingestão de fundo — verificar com teste que a ingestão cede a vez
- [x] 5.9 Gravar o resultado de uma geração cujo foco mudou, sem apresentá-lo — verificar com teste que o resumo fica no banco e o painel não muda

## 6. Consentimento

- [x] 6.1 Criar a coleção `preferencias` no banco local e registrar nela o consentimento de envio — verificar com teste de persistência
- [x] 6.2 Bloquear qualquer envio, inclusive o automático do primeiro resultado, enquanto não houver consentimento — verificar com teste que nenhuma requisição à LLM ocorre antes da confirmação
- [x] 6.3 Apresentar o pedido de confirmação no painel, no lugar do resumo — verificar com teste de componente
- [x] 6.4 Manter busca, filtros, paginação e abertura funcionando quando o consentimento é recusado — verificar com teste de componente
- [x] 6.5 Não repetir o pedido depois de confirmado — verificar com teste

## 7. Painel

- [x] 7.1 Reorganizar a tela em duas colunas, com a lista à esquerda e o painel à direita — verificar com teste de componente que a lista permanece com o mesmo conteúdo
- [x] 7.2 Recolher o painel para baixo da lista abaixo da largura mínima — verificar com teste de estilo ou de componente em largura reduzida
- [x] 7.3 Montar o painel com nome do documento, crachá da fonte, resumo em prosa, destaques e ação de abrir na fonte — verificar com teste de componente contra o protótipo
- [x] 7.4 Apresentar tipo e assuntos identificados junto ao resumo — verificar com teste de componente
- [x] 7.5 Passar a apresentar o primeiro documento da página ao concluir a busca — verificar com teste de componente
- [x] 7.6 Acrescentar a cada resultado a ação de gerar resumo, que troca o painel sem alterar a lista — verificar com teste de componente que a lista e a rolagem não mudam
- [x] 7.7 Fazer a ação de abrir do painel registrar o acesso como qualquer outra abertura — verificar com teste
- [x] 7.8 Ocultar o painel quando não houver documento em foco — verificar com teste de componente
- [x] 7.9 Informar no painel quando o resumo se baseia em texto truncado — verificar com teste de componente

## 8. Estados de progresso e falha

- [x] 8.1 Apresentar mensagem de progresso que nomeia a etapa em curso, distinguindo obtenção do texto de submissão à LLM — verificar com teste de componente dos dois estados
- [x] 8.2 Trocar a mensagem quando a espera se prolonga — verificar com teste que avança o relógio
- [x] 8.3 Apresentar de imediato o resumo já gravado, sem mensagem de progresso e sem espera fabricada — verificar com teste que nenhuma indicação de geração aparece nesse caso
- [x] 8.4 Manter a lista utilizável durante a geração — verificar com teste que uma busca disparada durante a geração conclui sem esperar por ela
- [x] 8.5 Descartar a apresentação do resultado cujo foco já mudou — verificar com teste que resolve a geração antiga depois da nova
- [x] 8.6 Apresentar no painel o motivo da falha, distinguindo os quatro casos, sem afetar a lista — verificar com teste de componente dos quatro
- [x] 8.7 Oferecer acesso à tela de configurações quando a chave não estiver configurada — verificar com teste de componente

## 9. Acessibilidade

- [x] 9.1 Tornar o painel e a ação de gerar resumo alcançáveis por teclado na ordem de leitura visual — verificar com o teste de tabulação existente, estendido
- [x] 9.2 Anunciar a troca do conteúdo do painel e a conclusão da geração — verificar com teste de componente
- [x] 9.3 Garantir que nada no painel dependa apenas de cor, e conferir o contraste dos elementos novos — verificar calculando o contraste dos pares de cor introduzidos

## 10. Encerramento

- [x] 10.1 Executar a suíte completa, `tsc` nos dois projetos e o build — verificar que tudo passa
- [x] 10.2 Percorrer cada requisito dos deltas conferindo a correspondência com o código, cenário a cenário — verificar que nenhum cenário ficou sem contrapartida implementada
- [ ] 10.3 Executar `/opsx:archive` para incorporar os deltas às especificações principais
