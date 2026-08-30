## 1. Desempate determinístico da ordenação

- [x] 1.1 Acrescentar o identificador como desempate final em `compartilhado/ordenacao.ts`, depois do nome A–Z, e verificar por teste em `test/busca/regras.test.ts` que dois documentos de mesmo nome e mesma data em repositórios diferentes saem na mesma ordem em duas ordenações sucessivas.

## 2. Recorte dos recentes independente da ordenação

- [x] 2.1 Inverter em `prepararRecentes` (`main/busca/servico.ts`) a ordem entre recortar e ordenar: recortar os 30 por recência e só então aplicar `filtros.ordenacao`. Verificar por teste que a lista de recentes contém o mesmo conjunto de documentos com `a-z` e com `data-desc`, variando apenas a ordem.
- [x] 2.2 Verificar por teste que, sem termo e sem filtro, a primeira página traz o documento de data mais recente em primeiro lugar e os demais em ordem decrescente de data.

## 3. Período consulta o acervo

- [x] 3.1 Introduzir em `main/busca/servico.ts` a condição única que decide a rota de coleta — janela de recentes ou acervo — a partir dos filtros vigentes, passando a exigir o acervo sempre que houver período definido. Verificar por teste que `recentes` com `dataInicial` definida coleta pelo acervo e não pela janela de commits.
- [x] 3.2 Ajustar `App.tsx` para que definir um período com o campo de busca vazio consulte o acervo, e limpar o período volte à lista de recentes. Verificar em `test/interface/filtro-periodo.test.tsx` que o período aciona a consulta ao acervo e que limpá-lo restaura os recentes.
- [x] 3.3 Verificar por teste de interface que o indicador de carregamento aparece durante a consulta ao acervo disparada pelo período e é removido ao apresentar os resultados.

## 4. Data real antes do filtro de período

- [x] 4.1 Generalizar `enriquecerParaBusca` em `main/busca/servico.ts` para resolver os documentos que a consulta vigente exige — autoria quando há termo, data quando há período —, resolvendo uma única vez quando ambos estiverem presentes e poupando os documentos que já têm data real. Verificar por teste que uma consulta com termo e período chama `detalhar` uma vez só e que documentos sem `dataAproximada` não geram requisição.
- [x] 4.2 Aplicar o filtro de período sobre os documentos já resolvidos e descartar, enquanto houver período em vigor, os documentos ainda marcados como `dataAproximada`. Verificar por teste que um documento de repositório ativo cuja data real é anterior ao intervalo não é apresentado nem contabilizado no total.
- [x] 4.3 Substituir o aviso de data aproximada em `avisarSobrePeriodo` pelo aviso de alcance efetivo do filtro, emitido quando o acervo exceder o teto de resolução. Verificar por teste que o aviso antigo não é mais emitido e que o novo aparece apenas quando o teto é excedido.
- [x] 4.4 Verificar por teste que, sem período e sem termo, nenhuma resolução além da página apresentada é realizada — o custo continua contido ao caso em que o dado decide quem entra no resultado.

## 5. Ordenação sobre o resultado completo

- [x] 5.1 Reter em `main/busca/servico.ts` o conjunto filtrado da consulta vigente junto dos filtros que o produziram, substituindo-o a cada consulta nova. Verificar por teste que o conjunto retido acompanha a última consulta realizada.
- [x] 5.2 Acrescentar o canal `busca:reordenar` em `compartilhado/canais.ts`, `main/ipc.ts` e `preload/index.ts`, recebendo critério e página e devolvendo a página do conjunto retido reordenado, sem consultar fonte alguma. Verificar por teste que o canal não dispara requisição às fontes.
- [x] 5.3 Fazer o canal recair na consulta normal quando não houver conjunto retido ou quando os filtros recebidos divergirem dos retidos em qualquer campo que não seja ordenação ou página. Verificar por teste que filtros divergentes provocam consulta às fontes em vez de devolver o conjunto anterior.
- [x] 5.4 Substituir em `App.tsx` a reordenação local sobre a página pela chamada ao novo canal, voltando à primeira página. Verificar em `test/interface/ordenacao-local.test.tsx` que trocar o critério com resultado de mais de uma página apresenta os primeiros documentos do resultado inteiro, e não os da página que estava visível.
- [x] 5.5 Verificar por teste que trocar o critério fora da primeira página apresenta o resultado reorganizado a partir da primeira, e que nenhuma consulta às fontes é realizada em nenhum desses casos.
- [x] 5.6 Verificar por teste que o critério escolhido continua aplicado quando outro filtro recarrega a lista, mantendo o que `ordenacao-local.test.tsx` já cobre.

## 6. Ordem coerente com as datas apresentadas

- [x] 6.1 Aplicar `ordenar` em `detalharPagina` (`App.tsx`) depois de substituir os documentos detalhados, usando o critério vigente. Verificar por teste de interface que um documento cuja data real chega diferente da apresentada muda de posição na lista.
- [x] 6.2 Verificar por teste que o reposicionamento não dispara consulta às fontes nem apresenta indicador de carregamento.

## 7. Posição do controle de ordenação

- [x] 7.1 Mover em `App.tsx` a linha de contador e ordenação para dentro da primeira coluna de `.area-resultados`, acima da lista, removendo a condição `documentos.length > 0` que deixa de ser necessária. Verificar na aplicação em execução que o seletor fica alinhado à borda direita da lista e não sobre o painel de resumo.
- [x] 7.2 Ajustar `estilos/resultados.css` e `estilos/resumo.css` para a linha ocupar a largura da coluna de resultados, verificando que abaixo de 1080px, onde o painel desce, a linha continua acompanhando a lista.
- [x] 7.3 Verificar por teste de interface que o controle não é apresentado durante o carregamento nem quando a consulta não retorna documento algum, e que continua alcançável por teclado com rótulo acessível.

## 8. Verificação e documentação

- [x] 8.1 Executar a suíte completa com `npm test` no diretório `AncorAI` e verificar que todos os testes passam, inclusive os que foram reescritos para o novo contrato.
- [x] 8.2 Abrir a aplicação e percorrer o roteiro dos quatro defeitos — ordenar um resultado de mais de uma página, definir um período antigo na tela inicial, observar a lista após a chegada das datas reais, conferir a posição do seletor — verificando que cada um se comporta conforme as specs desta mudança.
- [x] 8.3 Atualizar `AncorAI/README.md` com o comportamento vigente de filtros, ordenação e período, verificando que nenhuma afirmação sobre a data aproximada no filtro de período permanece no texto.
