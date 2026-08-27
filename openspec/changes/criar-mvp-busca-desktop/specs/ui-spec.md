# Especificação de UX/UI — MVP de busca de documentos

**Issue:** #65

## 1. Contexto da Interface

* **Objetivo da Tela:** permitir que o usuário localize documentos do GitHub e do Google Drive a partir do nome, com filtros e ordenação, e visualize os documentos modificados recentemente sem precisar buscar.
* **Gatilho de Acesso:** abertura da aplicação. A tela de busca é a tela inicial do sistema.

## 2. ADDED Requirements (Adicionados)

* **Cabeçalho:** logotipo AncorAI à esquerda com a legenda "WORKSPACE INTERNO" em maiúsculas espaçadas. À direita, indicadores de conexão por fonte.
* **Indicadores de conexão:** uma etiqueta por fonte, com ponto colorido e rótulo. Três estados: *conectada*, *credencial inválida* e *não configurada*. Acionar a etiqueta abre a tela de configurações.
* **Título e subtítulo:** título centralizado "Busque em todo o seu workspace". O subtítulo NÃO menciona resumos por IA.
* **Barra de busca:** campo centralizado em formato pílula, com ícone de lupa à esquerda, ocupando a largura principal da tela. Recebe o foco automaticamente na abertura.
* **Filtros:** três controles abaixo da barra — tipo de documento, fonte e período, e ordenação. Cada um exibe o valor selecionado no próprio rótulo.
* **Contador de resultados:** texto discreto acima da lista, informando a quantidade de itens apresentados.
* **Cartão de resultado:** ocupa a largura total da área de conteúdo. Contém ícone do tipo de arquivo, nome do documento, etiqueta de extensão, etiqueta de fonte, data de modificação e link de acesso à fonte original.
* **Lista de documentos recentes:** ocupa a área de resultados quando o campo de busca está vazio, precedida de um título que a identifica como documentos recentes.
* **Tela de configurações:** uma seção por fonte, cada uma com indicação do estado da conexão. As seções não são simétricas, porque as fontes não autenticam da mesma forma:
  * **GitHub:** campo de token mascarado, com ações de salvar e remover. O valor nunca é reexibido depois de salvo.
  * **Google Drive:** campo para o Client ID do cliente OAuth do tipo *Desktop app*, mais um botão de conexão que abre o consentimento no navegador. Enquanto aguarda o retorno, o botão apresenta estado de espera. Uma chave isolada não alcança documentos privados nessa fonte, por isso não existe campo de "chave do Drive".

### Estados visuais

Cada estado abaixo é obrigatório e não é inferido a partir do protótipo:

* **Default:** cartões com fundo branco, borda fina e sombra suave sobre o fundo creme.
* **Hover:** cartões e filtros elevam levemente a sombra e escurecem a borda. O cursor indica elemento acionável.
* **Focus:** todo elemento acionável apresenta indicador de foco visível, com contraste suficiente contra o fundo creme e contra o branco dos cartões.
* **Loading:** durante a busca e durante a rotina de inicialização, a área de resultados apresenta espaços reservados no formato dos cartões. A barra de busca permanece utilizável.
* **Empty (busca sem resultados):** mensagem informando que nenhum documento foi encontrado, com sugestão de revisar o termo ou os filtros.
* **Empty (sem credenciais):** mensagem orientando a configurar as credenciais, com acesso direto à tela de configurações.
* **Error:** faixa de aviso acima da lista, identificando a fonte que falhou e preservando os resultados das fontes que responderam.
* **Filtro ativo:** filtro com valor diferente do padrão apresenta destaque visual distinto do estado neutro, permitindo identificar rapidamente que há filtro aplicado.

## 3. MODIFIED Requirements (Modificados)

* **Área de resultados:** deixa de dividir espaço com o painel lateral e passa a ocupar a largura total da janela.
* **Subtítulo da tela:** o texto "Documentos do GitHub e do Google Drive em um só lugar, com resumos gerados por IA" perde a menção a resumos.
* **Etiqueta de fonte:** GitHub e Google Drive deixam de ser distinguidos apenas por cor. A distinção passa a contar com ícone e rótulo textual legível, não dependendo exclusivamente de cor.
* **Data exibida no cartão:** a data de modificação passa a ser a informação principal. A data de criação é exibida apenas quando a fonte a fornece.

## 4. REMOVED Requirements (Removidos)

Os elementos abaixo existem no protótipo visual e **não** fazem parte desta entrega:

* **Painel lateral "RESUMO POR IA":** removido integralmente, incluindo título, conteúdo do resumo e a seção "Destaques principais".
* **Botão "Gerar resumo":** removido dos cartões de resultado.
* **Etiqueta "Resumo automático":** removida dos cartões de resultado.
* **Menção a IA no subtítulo:** removida.
* **Ícone de conta no canto superior direito:** removido, por não haver autenticação, login ou perfil de usuário nesta versão.
* **Etiquetas temáticas dos cartões:** as etiquetas do tipo `PRODUTO`, `FRONTEND` e `MÉTRICAS` são removidas, por dependerem de classificação de conteúdo que não existe no MVP.
* **Resultado de extensão `.json`:** removido dos exemplos, por se tratar de arquivo de configuração, excluído do escopo de busca.

## 5. Tratamento de Erros e Acessibilidade

### Regras de validação e erro

* Campo de busca vazio não dispara consulta às fontes; a tela mantém a lista de documentos recentes.
* Período com data final anterior à data inicial apresenta mensagem junto ao filtro e não dispara consulta.
* Falha em uma das fontes apresenta faixa de aviso identificando a fonte, preservando os resultados da outra.
* Falha nas duas fontes substitui a lista por mensagem informando que não foi possível realizar a busca, com ação de nova tentativa.
* Credencial inválida apresenta mensagem distinta de "não foi possível conectar", para que o usuário saiba se deve corrigir a credencial ou verificar a conexão.

### Acessibilidade (a11y)

* Todos os controles — barra de busca, filtros, cartões e links — são alcançáveis por teclado, em ordem de tabulação que segue a leitura visual da tela.
* O campo de busca recebe foco na abertura da aplicação.
* Indicador de foco visível em todos os elementos acionáveis, com contraste adequado contra o fundo creme e contra o branco dos cartões.
* Alterações na lista de resultados são anunciadas por leitores de tela, incluindo a quantidade de resultados e as mensagens de erro.
* O estado de conexão de cada fonte é comunicado por texto, e não apenas pela cor do ponto indicador.
* A fonte de cada documento é identificável sem depender de cor.

### Contraste a verificar antes da implementação

Os valores do protótipo precisam ser medidos no Figma e ajustados caso não atinjam a proporção mínima de 4.5:1:

1. Subtítulo em verde acinzentado sobre o fundo creme.
2. Texto secundário dos cartões, como as datas de criação e modificação.
3. Etiquetas de extensão e de fonte, que combinam tamanho reduzido com baixo contraste.

## 6. Identidade visual

Valores aproximados extraídos do protótipo, a confirmar no Figma:

| Elemento | Valor |
| --- | --- |
| Fundo da aplicação | Creme quente `#F4F2EA` |
| Cor primária | Verde escuro `#14432F` |
| Cor de destaque | Verde médio `#2E7A5A` |
| Superfícies | Branco, raio de 16px, borda fina, sombra suave |
| Barra de busca e filtros | Formato pílula, totalmente arredondado |
| Tipografia | Sans geométrica (Poppins ou equivalente) |

O fundo creme é o elemento característico da identidade e deve ser aplicado também à janela da aplicação, evitando que o sistema tenha aparência de página web dentro de uma moldura desktop.
