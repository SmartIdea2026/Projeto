# Tarefas — MVP de busca de documentos

**Issue:** #65

## 1. Estrutura do projeto

- [x] Inicializar o projeto em `AncorIA/` com Electron, React, TypeScript e Vite
- [x] Configurar a separação entre processos *main*, *preload* e *renderer*
- [x] Configurar o `contextBridge` expondo apenas a API tipada de IPC ao renderer
- [x] Configurar Vitest e React Testing Library
- [x] Configurar o empacotamento da aplicação para distribuição *(AppImage de 113 MB gerado e validado: o app sobe, cria o cofre e os bancos)*

## 2. Credenciais

- [x] Implementar o armazenamento das credenciais com `safeStorage` no processo *main*
- [x] Implementar os canais IPC de gravação, remoção e consulta de estado das credenciais
- [x] Garantir que o canal de consulta retorne apenas o estado, nunca o valor da credencial
- [x] Implementar a verificação de validade de cada credencial
- [x] Persistir o resultado da verificação para reaproveitamento entre execuções
- [x] Distinguir credencial inválida de falha de conexão

## 3. Integração com o GitHub

- [x] Implementar a listagem de repositórios da conta configurada
- [x] Implementar a obtenção do inventário de arquivos pela árvore Git de cada repositório
- [x] Implementar a filtragem por nome e extensão sobre o inventário obtido
- [x] Implementar a obtenção de commits recentes e dos arquivos alterados
- [x] Implementar cache com revalidação por `ETag`
- [x] Tratar respostas de limite de requisição (HTTP 403 e 429)
- [x] Limitar a concorrência das requisições por repositório

## 4. Integração com o Google Drive

- [x] Implementar o fluxo OAuth de aplicativo instalado com PKCE e redirecionamento em loopback
- [x] Implementar a verificação do parâmetro de estado no retorno da autorização
- [x] Implementar a expiração do servidor local quando o consentimento é abandonado
- [x] Implementar a renovação do acesso a partir do token de renovação
- [x] Manter o token de acesso apenas em memória, persistindo somente o de renovação
- [x] Implementar a busca de arquivos por nome e tipo
- [x] Implementar a obtenção dos arquivos modificados recentemente
- [x] Tratar erros de cota e de credencial
- [x] Implementar cache dos resultados

## 5. Normalização e regras de busca

- [x] Implementar o formato unificado de documento para as duas fontes
- [x] Implementar a combinação dos resultados das fontes em lista única
- [x] Implementar o filtro por tipo de documento pela extensão
- [x] Implementar o filtro por fonte, incluindo o comportamento padrão sem seleção
- [x] Implementar o filtro por período
- [x] Implementar a ordenação por A–Z, Z–A, data crescente e data decrescente
- [x] Garantir que a ordenação reorganize os resultados sem nova consulta às fontes
- [x] Garantir que a alteração de filtro dispare nova consulta

## 6. Persistência local

- [x] Configurar o banco local no processo *main*
- [x] Criar o esquema de documentos acessados, com colunas de resumo reservadas
- [x] Criar o esquema de cache das fontes
- [x] Implementar o registro de acesso ao abrir um documento
- [x] Verificar que nenhum conteúdo de documento é persistido

## 7. Interface

- [x] Implementar o cabeçalho com logotipo e indicadores de conexão
- [x] Implementar a barra de busca com foco automático na abertura
- [x] Implementar os filtros de tipo, fonte, período e ordenação
- [x] Implementar o estado visual de filtro ativo
- [x] Implementar o cartão de resultado em largura total
- [x] Implementar a lista de documentos recentes na área de resultados
- [x] Implementar a exibição imediata do resultado anterior com atualização em segundo plano
- [x] Implementar a substituição entre recentes e resultados conforme o campo de busca
- [x] Implementar a tela de configurações com os dois campos de credencial
- [x] Aplicar a identidade visual, incluindo o fundo creme na janela da aplicação

## 8. Estados e tratamento de erros

- [x] Implementar o estado de carregamento da busca
- [x] Implementar o estado de carregamento da rotina de inicialização
- [x] Implementar o estado vazio de busca sem resultados
- [x] Implementar o estado vazio de credenciais não configuradas
- [x] Implementar a faixa de aviso de falha em uma das fontes
- [x] Implementar a mensagem de falha nas duas fontes, com nova tentativa
- [x] Implementar a validação do período informado
- [x] Implementar os estados de hover e foco em todos os elementos acionáveis

## 9. Acessibilidade

- [ ] Verificar a ordem de tabulação em toda a tela *(exige executar a interface)*
- [x] Implementar o anúncio das alterações da lista por leitores de tela
- [x] Garantir que estado de conexão e fonte do documento não dependam apenas de cor
- [ ] Medir no Figma os contrastes do subtítulo, do texto secundário e das etiquetas *(sem acesso ao Figma; valores acessíveis foram adotados no CSS, mas não conferidos contra o protótipo)*
- [ ] Ajustar as cores que não atingirem a proporção de 4.5:1 *(depende da medição acima)*

## 10. Testes

- [x] Testes de filtragem por nome, tipo, fonte e período
- [x] Testes de ordenação pelos quatro critérios
- [x] Testes de normalização dos resultados das duas fontes
- [x] Testes dos cenários de falha em uma e nas duas fontes
- [x] Testes dos estados de credencial válida, inválida e ausente
- [x] Teste que garanta que a credencial não é exposta ao renderer

## 11. Encerramento

- [ ] Verificar a correspondência entre as especificações e o código implementado
- [ ] Atualizar o status das ADRs de Proposto para Aceito, se confirmadas
- [ ] Executar `/opsx:archive` para incorporar os deltas às especificações principais
