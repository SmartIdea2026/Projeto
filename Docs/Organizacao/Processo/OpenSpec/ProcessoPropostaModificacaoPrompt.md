# Processo de Proposta de Modificação e Novos Requisitos por Prompt

**Objetivo:** Definir como os prompts devem ser utilizados para propor novos requisitos e modificações no sistema de forma estruturada, garantindo validação, análise de impacto e documentação antes da implementação do código.

---


## Visão Geral

Este processo estabelece o fluxo de transformação de uma necessidade em linguagem natural para um requisito formalmente especificado, analisado, aprovado e testado.

---

## Fluxo do Processo

### 1. Solicitação Inicial em Linguagem Natural
O processo inicia-se com uma solicitação genérica ou em linguagem natural representando uma necessidade de mudança ou nova funcionalidade.

* **Exemplo de solicitação:** *"Precisamos permitir que o usuário pesquise documentos pelo conteúdo."*

Essa solicitação inicial apresenta a necessidade, mas possui informações que precisam ser esclarecidas antes de qualquer codificação, tais como:
- Quais formatos de arquivo serão suportados?
- A pesquisa será exata ou parcial?
- A pesquisa diferenciará letras maiúsculas e minúsculas (*case sensitivity*)?
- A pesquisa atual pelo nome do arquivo continuará funcionando?
- O resultado deverá apresentar o trecho encontrado?
- Existe limite para o tamanho dos arquivos?

A proposta de mudança visa converter essa ideia inicial em uma definição clara, objetiva e verificável.

### 2. Análise do Sistema Existente
Após receber o prompt, a IA deve analisar os artefatos disponíveis no projeto (especificações, requisitos, regras de negócio, contratos de API, código-fonte, testes e documentação).

Esta análise mapeia antecipadamente todas as partes afetadas (ex.: frontend, API, backend, processamento de arquivos e testes), evitando alterações sem a consideração de dependências existentes.

### 3. Identificação de Dúvidas e Ambiguidade
Havendo informações insuficientes ou ambíguas, a IA deve apresentar perguntas diretamente para a equipe em vez de assumir premissas.

* **Exemplo de perguntas:**
  - *"Quais formatos de arquivo serão suportados?"*
  - *"A pesquisa será exata ou parcial?"*
  - *"A busca atual pelo nome do arquivo continuará funcionando?"*
* **Exemplo de resposta da equipe:**
  - *"PDF, DOCX e TXT serão suportados. A pesquisa será parcial e a busca pelo nome continuará funcionando."*

As respostas da equipe passam a fazer parte formal da definição da mudança.

### 4. Criação da Proposta de Mudança
Com as informações alinhadas, a IA organiza o escopo na **Proposta de Mudança**, consolidando:
- Objetivo e Motivação
- Comportamento Esperado
- Restrições
- Requisitos preliminares
- Critérios de Aceitação
- Possíveis Impactos e Dúvidas Remanescentes

### 5. Identificação e Classificação das Alterações
Toda proposta deve categorizar como a especificação existente será afetada:
- `ADDED` **(Adicionado):** Novo requisito que não existia anteriormente.
- `MODIFIED` **(Modificado):** Requisito existente que precisará ser alterado.
- `REMOVED` **(Removido):** Requisito ou comportamento que deixará de existir.

### 6. Revisão da Equipe
A proposta gerada não deve ser considerada automaticamente correta. A equipe deve revisar o documento para validar se:
1. O problema foi compreendido adequadamente.
2. Os requisitos e regras de negócio estão corretos.
3. Todos os impactos foram identificados.

> **Nota:** A IA atua no auxílio da análise e organização das informações; a tomada de decisão permanece como responsabilidade da equipe.

### 7. Requisitos e Critérios de Aceitação
Após a aprovação da proposta, o escopo é detalhado em requisitos objetivos e critérios de aceitação:

* **Requisitos:** Definem **o que** o sistema deve fazer.
  - *REQ-005:* O sistema deve permitir que o usuário pesquise documentos pelo conteúdo.
  - *REQ-006:* A pesquisa deve suportar arquivos PDF, DOCX e TXT.
* **Critérios de Aceitação:** Definem **como verificar** se o comportamento foi alcançado.
  - *Exemplo:* `Dado` que existem documentos PDF e DOCX, `quando` o usuário pesquisar uma palavra presente no conteúdo, `então` o sistema deverá apresentar os documentos correspondentes.

### 8. Planejamento da Implementação
Com os requisitos consolidados, a equipe define o plano técnico (alterações em frontend, backend, banco de dados, API, workers, testes e documentação).

* **Separação Obrigatória:**
  - **Requisito:** O que o sistema deve fazer.
  - **Plano Técnico:** Como a equipe pretende implementar a mudança.

### 9. Divisão em Tarefas (Kanban)
O planejamento é fracionado em itens operacionais no Kanban:
- [ ] Atualizar a especificação da busca
- [ ] Atualizar o contrato da API
- [ ] Implementar a pesquisa no backend
- [ ] Implementar a extração de conteúdo
- [ ] Atualizar a interface do usuário
- [ ] Criar testes unitários e de integração
- [ ] Executar a validação final

### 10. Implementação Guiada
Com a proposta aprovada, requisitos definidos e tarefas planejadas, a implementação inicia-se. A IA pode ser utilizada como assistente de codificação seguindo estritamente a instrução:

> *"Implemente as tarefas aprovadas de acordo com a especificação. Não altere comportamentos que não estejam relacionados à mudança e apresente os arquivos modificados e os testes realizados ao finalizar."*

### 11. Testes e Validação
A equipe valida se o sistema corresponde à especificação, garantindo que:
- Todos os requisitos foram implementados.
- Os critérios de aceitação foram plenamente atendidos.
- Os testes foram executados com sucesso.
- Não ocorreram regressões nas funcionalidades existentes.

### 12. Atualização da Especificação Oficial
Após a aprovação da implementação, a documentação técnica oficial é atualizada no repositório. Uma tarefa não é considerada concluída (*Done*) enquanto código, testes e especificação estiverem divergentes.



## 13. Template — Prompt de Proposta de Mudança

Analise a seguinte solicitação de alteração no sistema.

### Contexto Atual
[Descreva a funcionalidade ou comportamento existente.]

### Motivação
[Explique o problema ou necessidade.]

### Mudança Desejada
[Descreva o que se deseja adicionar, modificar ou remover.]

### Comportamento Esperado
[Descreva como o sistema deverá funcionar após a mudança.]

### Restrições
[Informe o que não deve ser alterado ou quebrado.]

### Instruções para análise

Antes de implementar qualquer alteração:
1. Analise as especificações existentes.
2. Identifique requisitos relacionados.
3. Identifique possíveis impactos e dependências.
4. Identifique ambiguidades ou informações ausentes.
5. Faça perguntas quando necessário.
6. Classifique as alterações como ADDED, MODIFIED ou REMOVED.
7. Proponha os requisitos e critérios de aceitação.
8. Apresente uma proposta de mudança para revisão.
9. Não altere o código até que a proposta seja aprovada.

