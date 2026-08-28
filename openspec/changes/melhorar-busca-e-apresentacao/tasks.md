# Tarefas — Busca e apresentação dos resultados

## 1. Ordenação correta e estável

- [x] 1.1 Acrescentar desempate por nome A–Z aos critérios de data em `compartilhado/ordenacao.ts` — verificar com teste que documentos de mesma data saem em ordem alfabética e que a ordem se repete entre chamadas
- [x] 1.2 Fazer `prepararRecentes` aplicar `filtros.ordenacao` em vez da constante `'data-desc'` em `busca/servico.ts` — verificar com teste que a lista de recentes sai no critério pedido
- [x] 1.3 Definir `'data-desc'` como padrão inicial em `FILTROS_PADRAO`, sem impô-lo depois — verificar com teste que a escolha do usuário sobrevive a uma recarga por mudança de tipo ou período
- [x] 1.4 Confirmar que a reordenação local do renderer e a do processo principal produzem a mesma ordem para a mesma entrada — verificar com teste comparando as duas saídas

## 2. Paginação e contador

- [x] 2.1 Acrescentar a `ResultadoBusca` o total encontrado e a página apresentada, mantendo `documentos` como a fatia visível — verificar com `tsc` e teste de que o total difere do tamanho da página quando há mais de 10 resultados
- [x] 2.2 Aplicar a paginação em `busca/servico.ts` depois de filtrar e ordenar, com 10 por página — verificar com teste que a primeira página traz os 10 de maior precedência segundo o critério vigente
- [x] 2.3 Reiniciar para a primeira página a cada nova busca ou alteração de filtro de consulta — verificar com teste de componente
- [x] 2.4 Implementar a navegação entre páginas no renderer, ocultando-a quando o resultado couber em uma página — verificar com teste de componente nos dois casos
- [x] 2.5 Apresentar o contador com o total encontrado, ocultando-o quando não houver termo nem filtro aplicado — verificar com teste de componente nos três cenários da especificação

## 3. Autoria e data real da última alteração

- [x] 3.1 Acrescentar `autor` e a marcação de data real ao tipo `Documento` — verificar com `tsc` nos dois projetos
- [x] 3.2 Implementar em `fontes/github.ts` a consulta de autoria por arquivo via `commits?path=`, com cache por `ETag` — verificar com teste que usa resposta simulada
- [x] 3.3 Limitar a consulta aos documentos da página apresentada, reaproveitando a concorrência limitada existente — verificar com teste que documentos fora da página não geram requisição
- [x] 3.4 Apresentar a lista antes de a autoria chegar e preencher os campos quando chegar, sem bloquear — verificar com teste de componente
- [x] 3.5 Tratar falha na consulta de autoria apresentando o documento sem os campos e sem erro — verificar com teste que simula falha
- [x] 3.6 Substituir a data aproximada pela real quando obtida, removendo a marcação `dataAproximada` daquele documento — verificar com teste

- [x] 3.7 Fazer o termo de busca casar com o autor além do nome do arquivo — verificar com teste que um documento é encontrado pelo autor sem o nome conter o termo
- [x] 3.8 Preencher a autoria antes de filtrar quando há termo, com teto e concorrência limitada, avisando quando o acervo excede o teto — verificar com teste do teto, do aviso e do pico de concorrência

## 4. Disposição da interface

- [x] 4.1 Posicionar os filtros abaixo da barra de busca conforme o protótipo, com o período recolhido em painel suspenso — verificar visualmente contra os prints fornecidos e com teste de componente
- [x] 4.2 Posicionar contador à esquerda e ordenação à direita na linha acima da lista — verificar visualmente contra os prints
- [x] 4.3 Apresentar autor e data de modificação no cartão de resultado, rotulados como última alteração — verificar visualmente e com teste de componente
- [x] 4.4 Manter a ordem de tabulação seguindo a leitura visual após o rearranjo, sem `tabindex` positivo — verificar com o teste de tabulação existente

## 5. Especificações e encerramento

- [ ] 5.1 Confirmar na revisão que a reinterpretação de `Nova consulta ao alterar filtros` está correta, já que reescreve um requisito vigente — verificar com aprovação explícita no Pull Request
- [x] 5.2 Executar a suíte completa, `tsc` nos dois projetos e o build — verificar que tudo passa
- [x] 5.3 Verificar a correspondência entre as especificações e o código implementado — verificar percorrendo cada requisito dos deltas
- [ ] 5.4 Executar `/opsx:archive` para incorporar os deltas às especificações principais
