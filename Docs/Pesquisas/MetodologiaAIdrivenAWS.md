# Estudar AI driven AWS

## **1\. Como funciona a metodologia AI-DLC?** 

O AI-DLC reimagina o ciclo de vida do software posicionando a Inteligência Artificial não apenas como um assistente de código, mas como **orquestradora central**. A metodologia permite que a IA defina seus próprios fluxos de trabalho de forma adaptativa, assumindo a liderança no planejamento, na quebra de tarefas e na execução das implementações.

## **2\. Quais os principais processos?** 

Os ciclos do AI-DLC na AWS dividem-se, essencialmente, em três etapas iterativas:

* **Planejamento Autônomo:** A IA analisa requisitos e os decompõe em tarefas menores e organizadas.  
* **Geração e Execução:** Criação autônoma de código-fonte, configurações de infraestrutura e cenários de testes baseados em critérios de aceite.  
* **Avaliação e CI/CD Integrado:** Revisões automáticas de qualidade do código e testes de segurança aplicados continuamente na esteira de integração.

  # 

## Ciclo de Vida

### 1. Initialization — Preparação
Preparação do ambiente, contexto, regras e informações necessárias para iniciar o desenvolvimento.

### 2. Ideation — Definição da intenção
A equipe apresenta o problema ou objetivo. A IA ajuda a estruturar a intenção, esclarecer ambiguidades e definir o escopo.

### 3. Inception — Entendimento e planejamento
A IA analisa o contexto e estrutura requisitos, histórias de usuário, arquitetura e *Units of Work*. A equipe responde aos questionamentos e valida os artefatos antes de avançar.

### 4. Construction — Projeto e construção
Com o planejamento validado, a IA propõe o design, requisitos não funcionais, infraestrutura, código e testes. A equipe revisa e valida os resultados, podendo retornar às etapas anteriores para refinamento.

### 5. Operations — Operação e evolução
A solução é implantada e monitorada. Os resultados, problemas e novos requisitos alimentam novas iterações do ciclo.

### Fluxo geral

**Problema / Contexto**  
↓  
**IA analisa e estrutura questionamentos**  
↓  
**Equipe responde e esclarece ambiguidades**  
↓  
**IA gera propostas e artefatos**  
↓  
**Equipe valida**  
↓  
**Próxima etapa ou retorno para refinamento**  
↓  
**Implementação → Operação → Novo ciclo**

> **Observação:** a metodologia AI-DLC originalmente é apresentada pela AWS em três fases principais — **Inception, Construction e Operations**. A implementação atual de **AI-DLC Workflows** da AWS Labs expandiu o fluxo para cinco fases, adicionando **Initialization** e **Ideation**. 

## **3\. Qual a utilidade dessa metodologia?**

A maior vantagem do AI-DLC é a **redução drástica do trabalho operacional e repetitivo**. Ao automatizar a criação mecânica de testes e infraestrutura, a equipe fica livre para focar em tarefas de alto valor,

Entre os benefícios apresentados estão:

* **Velocidade:** a IA pode gerar e refinar rapidamente requisitos, histórias, designs, código e testes.  
* **Inovação:** a redução do trabalho repetitivo permite que a equipe dedique mais tempo à exploração de soluções.  
* **Qualidade:** a interação contínua entre IA e equipe permite esclarecer o contexto e aproximar o resultado das necessidades do negócio.  
* **Responsividade:** ciclos mais rápidos permitem responder mais rapidamente a mudanças de requisitos e feedback dos usuários.  
* **Experiência do desenvolvedor:** a IA assume parte das atividades repetitivas, permitindo que os desenvolvedores se concentrem mais na resolução de problemas.

A AWS também destaca que a integração da IA ao longo do ciclo melhora a coerência e a rastreabilidade entre requisitos e deployment.

## **4\. Comparação: AI-DLC (AWS) vs. OpenSpec**

* **OpenSpec:** O desenvolvimento é guiado por **regras inegociáveis** estabelecidas antes de qualquer linha de código ser escrita.. Utiliza arquivos Markdown e YAML para criar instruções claras e previsíveis. Excelente para manter o controle, documentar o projeto de forma estrita e evitar que a IA "alucine" ou fuja do escopo.  
* **AI-DLC (AWS):** É baseado em **autonomia adaptativa**. A IA tem liberdade para alterar rotas e definir como a engenharia será feita em tempo real. Exige uma infraestrutura de nuvem altamente integrada e focada em automação extrema, mas sacrifica parte da previsibilidade e do controle humano passo a passo.


**5\. Como ela pode ser aplicada no nosso contexto?**

No nosso contexto, o **AI-DLC pode ser usado como metodologia para conduzir a construção da solução de integração das bases**. A IA analisaria os schemas e atributos, identificaria possíveis correspondências e ambiguidades, faria perguntas à equipe e proporia um modelo conceitual e relacionamentos entre os dados. A equipe validaria essas propostas, e os relacionamentos aprovados seriam incorporados à solução. Assim, o ciclo seria:

- **Bases de dados → IA analisa → identifica possíveis relações → equipe valida → modelo conceitual → implementação → nova iteração.**  
- Nesse cenário, o AI-DLC organiza o **processo de descoberta, decisão e desenvolvimento**, enquanto técnicas específicas de integração de dados, como schema mapping e entity resolution, realizam o relacionamento efetivo entre os dados.

## **6\. Kiro — Ambiente AWS para AI-DLC**

O **Kiro** é o ambiente de desenvolvimento agentic da AWS que permite aplicar, na prática, conceitos do AI-DLC. Diferentemente do AI-DLC, que é uma metodologia, o Kiro fornece **ferramentas e um ambiente de desenvolvimento para executar esse processo**.

A IA pode analisar o contexto, propor requisitos e arquitetura, decompor o trabalho e auxiliar na implementação, enquanto a equipe revisa e valida os resultados.

Além disso, o Kiro possui recursos como **agentes, Steering, Hooks e MCP**, permitindo maior automação e integração com ferramentas externas(vscode).

No contexto de integração das bases, o Kiro poderia operacionalizar o AI-DLC desde a análise dos schemas até a definição do modelo conceitual e implementação da solução.

**AI-DLC \= metodologia**  
**Kiro \= ambiente para operacionalizar o desenvolvimento orientado por IA**

Referências:

- [https://aws.amazon.com/pt/blogs/devops/open-sourcing-adaptive-workflows-for-ai-driven-development-life-cycle-ai-dlc/?utm\_source=gemini](https://aws.amazon.com/pt/blogs/devops/open-sourcing-adaptive-workflows-for-ai-driven-development-life-cycle-ai-dlc/?utm_source=gemini)  
- [https://aws.amazon.com/pt/blogs/machine-learning/ai-driven-development-lifecycle-using-amazon-bedrock-agentcore/?utm\_source=gemini](https://aws.amazon.com/pt/blogs/machine-learning/ai-driven-development-lifecycle-using-amazon-bedrock-agentcore/?utm_source=gemini)

