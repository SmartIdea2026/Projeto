# Tarefas — Resumos por IA e índice local

## 1. Decisão registrada antes do código

- [ ] 1.1 Escrever a ADR que registra o envio do conteúdo dos documentos a serviço externo, nomeando o risco do plano gratuito e as afirmações das especificações vigentes que deixam de valer — verificar que a ADR cita nominalmente a ADR-0002 e a seção de persistência
- [ ] 1.2 Atualizar `AGENTS.md` e o `GlossarioTecnico.md` com a nova postura de dados — verificar que nenhum documento continua afirmando que o conteúdo nunca sai da máquina

## 2. Índice local

- [ ] 2.1 Criar a coleção de índice em `banco/repositorio.ts`, com metadados, classificação, resumo e datas — verificar com teste de persistência
- [ ] 2.2 Registrar no índice os documentos obtidos das fontes, sem gravar conteúdo — verificar com teste que nenhum campo de conteúdo é persistido
- [ ] 2.3 Atualizar o registro e assinalar a classificação como desatualizada quando a fonte informar alteração posterior — verificar com teste
- [ ] 2.4 Fazer a busca consultar o índice antes das APIs, recorrendo a elas quando não houver correspondência ou o índice estiver defasado — verificar com teste que uma consulta atendida pelo índice não gera requisição
- [ ] 2.5 Emitir aviso de possível defasagem quando o resultado vier apenas do índice, reaproveitando o canal de avisos existente — verificar com teste

## 3. Integração com a LLM

- [ ] 3.1 Acrescentar a chave da LLM ao cofre e aos canais IPC, sem devolvê-la ao renderer — verificar com o teste de fronteira de credenciais existente
- [ ] 3.2 Implementar o cliente HTTP do Gemini no processo principal, sem SDK — verificar com teste que usa resposta simulada
- [ ] 3.3 Implementar a validação da chave e a distinção entre credencial inválida, cota excedida e falha de comunicação — verificar com teste dos três casos
- [ ] 3.4 Implementar a fila de submissões com concorrência um, compartilhada por classificação e resumo — verificar com teste que nunca há duas submissões simultâneas
- [ ] 3.5 Dar precedência na fila ao resumo pedido pelo usuário sobre a classificação de fundo — verificar com teste
- [ ] 3.6 Implementar a extração de texto dos formatos aceitos, tratando os não extraíveis sem erro — verificar com teste por formato

## 4. Classificação e busca por contexto

- [ ] 4.1 Implementar a classificação de um documento, gravando assunto, tipo e etiquetas no índice — verificar com teste
- [ ] 4.2 Implementar a indexação incremental e retomável, processando apenas o não classificado — verificar com teste que interrompe e retoma
- [ ] 4.3 Suspender a indexação sem perda quando a cota for excedida, informando o motivo — verificar com teste
- [ ] 4.4 Manter a busca utilizável durante a indexação, informando que ela não terminou — verificar com teste de componente
- [ ] 4.5 Estender a correspondência da busca a assunto, tipo e etiquetas, preservando a busca por nome dos não classificados — verificar com teste dos dois casos
- [ ] 4.6 Apresentar o progresso da indexação na interface — verificar com teste de componente

## 5. Resumo e painel lateral

- [ ] 5.1 Criar o arquivo Markdown de instrução de redação do resumo, versionado no repositório — verificar que é lido em tempo de execução e não embutido no código
- [ ] 5.2 Implementar a geração do resumo aplicando a instrução vigente do arquivo — verificar com teste que a instrução é enviada junto ao conteúdo
- [ ] 5.3 Gravar o resumo e sua data no índice, sem gravar o conteúdo submetido — verificar com teste
- [ ] 5.4 Reutilizar o resumo gravado nas buscas seguintes, sem nova submissão — verificar com teste que nenhuma chamada é feita na segunda busca
- [ ] 5.5 Assinalar o resumo como desatualizado quando o documento for alterado depois, permitindo regerar — verificar com teste
- [ ] 5.6 Implementar o painel à direita com nome, fonte e resumo do documento em foco — verificar com teste de componente
- [ ] 5.7 Apresentar no painel o resumo do primeiro resultado ao concluir a busca — verificar com teste de componente
- [ ] 5.8 Acrescentar a cada resultado a ação de gerar resumo, substituindo o painel sem alterar a lista — verificar com teste de componente
- [ ] 5.9 Apresentar carregamento no painel durante a geração, mantendo a lista utilizável — verificar com teste de componente
- [ ] 5.10 Ocultar o painel quando não houver resultado em foco — verificar com teste de componente

## 6. Consentimento e estados de falha

- [ ] 6.1 Informar o usuário antes do primeiro envio de conteúdo, prosseguindo só após confirmação — verificar com teste de componente
- [ ] 6.2 Manter o aviso sobre envio de conteúdo acessível na tela de configurações — verificar com teste de componente
- [ ] 6.3 Manter a busca funcionando quando a chave da LLM não estiver configurada, indisponibilizando apenas os recursos dependentes — verificar com teste
- [ ] 6.4 Apresentar no painel o motivo da falha sem afetar a lista de resultados — verificar com teste dos três motivos distintos

## 7. Acessibilidade e encerramento

- [ ] 7.1 Tornar o painel e a ação de gerar resumo alcançáveis por teclado, na ordem de leitura visual — verificar com o teste de tabulação existente, estendido
- [ ] 7.2 Anunciar a troca do conteúdo do painel por leitores de tela — verificar com teste de componente
- [ ] 7.3 Executar a suíte completa, `tsc` nos dois projetos e o build — verificar que tudo passa
- [ ] 7.4 Verificar a correspondência entre as especificações e o código implementado — verificar percorrendo cada requisito dos deltas
- [ ] 7.5 Executar `/opsx:archive` para incorporar os deltas às especificações principais
