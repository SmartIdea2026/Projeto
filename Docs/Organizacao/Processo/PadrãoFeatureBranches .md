# **Padrão de Feature Branches — SmartIdea2026/Projeto**

## **Convenção de Nomenclatura**

Estrutura geral:

\<tipo\>/\<numero-da-issue\>-\<descricao-curta\>

### **Tipos de branch**

| Prefixo | Uso |
| ----- | ----- |
| feature/ | Novas funcionalidades |
| fix/ | Correção de bugs |
| hotfix/ | Correção urgente em produção |
| refactor/ | Refatoração sem mudança de comportamento |
| docs/ | Alterações de documentação |
| test/ | Criação ou ajuste de testes |
| chore/ | Tarefas de manutenção (configs, dependências, build) |

### **Regras de nomenclatura**

* Letras minúsculas  
* Palavras separadas por hífen   
* Sem acentos, espaços ou caracteres especiais  
* Incluir o número da issue relacionada, quando existir  
* Descrição curta e objetiva (3 a 5 palavras)

### **Exemplos**

* `feature/79-padrao-feature-branch`  
* `fix/82-erro-login-usuario`  
* `docs/85-documentacao-api`  
* `refactor/90-otimizar-consulta-usuarios`  
* `chore/91-atualizar-dependencias`

## **Fluxo de Criação e Utilização**

1. Atualizar a branch principal loca:

   `git checkout main`

   `git pull`

2. Criar a nova branch a partir dela, seguindo o padrão de nome:  
    	`git checkout -b feature/79-padrao-feature-branch`  
3. Desenvolver e commitar as alterações (recomenda-se seguir Conventional Commits: `feat:`, `fix:`, `docs:`, etc.)  
4. Enviar a branch para o repositório remoto:  
    	`git push origin feature/79-padrao-feature-branch`  
5. Abrir um Pull Request referenciando a issue correspondente (ex.: `Closes #79`)  
6. Após revisão e aprovação da equipe, realizar o merge na branch principal  
7. Excluir a branch após o merge, mantendo o repositório organizado

## **Aplicação ao Fluxo de Desenvolvimento do Projeto**

* Cada issue do GitHub deve originar uma branch própria, seguindo o padrão acima  
* O número da issue no nome da branch garante rastreabilidade direta entre código e tarefa  
* Pull Requests devem referenciar a issue para fechamento automático ao serem mesclados  
* O padrão é compatível tanto com um fluxo simples (branch única `main`) quanto com fluxos que usem uma branch de integração (`develop`), caso o grupo venha a adotar esse modelo

## **Observações**

Caso o projeto venha a adotar um fluxo específico como Git Flow ou Trunk-Based Development, este padrão de nomenclatura pode ser mantido normalmente, adaptando apenas a origem/destino das branches.

