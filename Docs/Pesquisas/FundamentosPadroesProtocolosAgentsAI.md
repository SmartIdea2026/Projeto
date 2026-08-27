# Padrões e Tecnologias Fundamentais para Agentes de IA

## 1. Objetivo

Este documento apresenta quatro tecnologias e padrões relevantes para o desenvolvimento de sistemas baseados em agentes de inteligência artificial:

* AGENTS.md;
* Model Context Protocol (MCP);
* Agent2Agent Protocol (A2A);
* AGNTCY.

O objetivo é explicar de forma direta o que cada tecnologia é, qual problema resolve, como funciona e por que se tornou relevante no ecossistema atual de agentes de IA.

É importante distinguir suas funções: **AGENTS.md fornece instruções ao agente; MCP conecta agentes a ferramentas e dados; A2A permite comunicação entre agentes; e AGNTCY fornece infraestrutura para sistemas multiagentes.**

---

# 2. O que é um agente de IA?

Um agente de IA é um sistema baseado em um modelo de inteligência artificial que, além de gerar respostas, pode receber um objetivo, tomar decisões e utilizar recursos externos para realizar uma tarefa.

Um fluxo simplificado é:

```text
Usuário
   ↓
Agente
   ↓
Analisa o objetivo
   ↓
Escolhe uma ação
   ↓
Utiliza ferramentas ou outros agentes
   ↓
Analisa os resultados
   ↓
Produz uma resposta ou realiza outra ação
```

Por exemplo, um agente do AncorAI poderia receber:

> "Verifique se o estudante atende aos requisitos de um benefício."

Para realizar essa tarefa, o agente poderia precisar consultar dados, verificar regras e analisar documentos.

É nesse ponto que surge a necessidade de padrões.

---

# 3. Por que agentes precisam de padrões?

À medida que os agentes deixam de ser apenas sistemas de perguntas e respostas e passam a utilizar ferramentas, acessar dados e colaborar com outros agentes, diferentes componentes precisam se comunicar de maneira previsível.

Sem padrões, cada empresa ou aplicação poderia criar sua própria forma de:

```text
Agente → ferramenta
Agente → banco de dados
Agente → API
Agente → outro agente
Agente → infraestrutura multiagente
```

Isso aumenta o acoplamento e dificulta a interoperabilidade.

Os padrões procuram estabelecer interfaces e comportamentos comuns.

Nesse contexto, a Linux Foundation criou a **Agentic AI Foundation (AAIF)** em dezembro de 2025 para fornecer uma base aberta e neutra para tecnologias de IA agentiva. Entre suas contribuições fundadoras estavam MCP, goose e AGENTS.md.

A importância dessa iniciativa cresceu rapidamente: em agosto de 2026, a AAIF informou possuir **247 organizações membros**, incluindo empresas de tecnologia, instituições financeiras e outras organizações.

---

# 4. AGENTS.md

## 4.1 O que é?

`AGENTS.md` é um formato aberto, baseado em Markdown, utilizado para fornecer instruções e contexto a agentes de programação que trabalham em um projeto.

A ideia é simples:

```text
AGENTS.md
     ↓
Instruções do projeto
     ↓
Agente de programação
```

O projeto oficial descreve o formato como uma maneira simples e aberta de orientar agentes de código.

---

## 4.2 O que pode existir dentro do arquivo?

Um projeto pode utilizar o arquivo para informar:

* como executar o sistema;
* como executar testes;
* qual arquitetura deve ser seguida;
* quais convenções devem ser respeitadas;
* quais arquivos ou diretórios exigem cuidado;
* como realizar alterações;
* quais ferramentas devem ser utilizadas;
* quais restrições o agente deve obedecer.

Exemplo:

```markdown
# Instruções do Projeto

## Desenvolvimento

Utilize Java 21 e Spring Boot.

## Testes

Execute os testes antes de concluir uma alteração.

## Arquitetura

Respeite a separação entre as camadas definidas no projeto.

## OpenSpec

Alterações de comportamento devem seguir o processo definido no OpenSpec.

## Restrições

Não altere arquivos fora do escopo da tarefa.
```

## 4.3 Por que se tornou relevante?

Uma das razões é sua simplicidade.

Não é necessário implementar um servidor ou adotar uma infraestrutura específica. Trata-se de um arquivo de texto versionado junto ao projeto.

Além disso, sua importância cresceu quando a Linux Foundation anunciou a criação da AAIF tendo `AGENTS.md` como uma das contribuições fundadoras, juntamente com MCP e goose.

A AAIF também passou a promover eventos especificamente voltados a AGENTS.md, MCP e goose como tecnologias centrais para agentes operarem de maneira consistente em diferentes ambientes.

---

# 5. Model Context Protocol (MCP)

## 5.1 O que é?

O **Model Context Protocol (MCP)** é um protocolo aberto que padroniza a conexão de aplicações de IA com ferramentas, dados e sistemas externos.

A ideia central é:

```text
Agente
   ↓
MCP
   ↓
Ferramentas / Dados / Sistemas
```

MCP foi originalmente criado pela Anthropic e posteriormente doado para a Agentic AI Foundation, tornando-se uma de suas contribuições fundadoras.

---

## 5.2 Qual problema ele resolve?

Um modelo de IA, sozinho, não precisa necessariamente ter acesso direto a:

* bancos de dados;
* APIs;
* sistemas empresariais;
* arquivos;
* ferramentas de desenvolvimento;
* serviços externos.

O MCP fornece uma forma padronizada de disponibilizar essas capacidades.

Uma arquitetura simplificada é:

```text
┌──────────────────────┐
│ Aplicação de IA      │
│                      │
│    MCP Client        │
└──────────┬───────────┘
           │
           │ MCP
           ↓
┌──────────────────────┐
│ MCP Server            │
│                       │
│ Tools                 │
│ Resources             │
│ Prompts               │
└──────────┬────────────┘
           ↓
   Sistema externo
```

---

## 5.3 Como o agente utiliza uma ferramenta?

Imagine que exista uma ferramenta:

```text
consultar_estudante()
```

O fluxo poderia ser:

```text
Usuário
   ↓
Agente
   ↓
Decide consultar estudante
   ↓
MCP Client
   ↓
MCP Server
   ↓
consultar_estudante()
   ↓
Banco/API
   ↓
Resultado
   ↓
Agente
```

O ponto fundamental é:

> **MCP não é um arquivo que você entrega ao agente.**

MCP é um protocolo implementado por software.

O **MCP Server** disponibiliza as capacidades e o **MCP Client** permite que a aplicação de IA utilize essas capacidades.

---

## 5.4 Tools, Resources e Prompts

MCP organiza diferentes tipos de capacidades.

### Tools

Ações que podem ser chamadas pela aplicação de IA.

Exemplo:

```text
consultar_estudante()
consultar_beneficio()
listar_documentos()
```

### Resources

Informações ou conteúdos que podem ser disponibilizados como contexto.

### Prompts

Templates estruturados para orientar interações.

---

## 5.5 Por que MCP é tão relevante no mercado?

Aqui existe uma evidência de adoção muito forte.

Em dezembro de 2025, a Anthropic informou que o MCP já tinha mais de **10.000 servidores MCP públicos** e havia sido adotado por produtos como:

* ChatGPT;
* Cursor;
* Gemini;
* Microsoft Copilot;
* Visual Studio Code.

Também informou utilização em ambientes corporativos.

A própria Linux Foundation passou a realizar MCP Dev Summits e descreveu MCP como uma das tecnologias centrais para conectar agentes a ferramentas, modelos, dados e plataformas.

Isso ajuda a explicar por que MCP é considerado hoje um dos padrões mais importantes do ecossistema de agentes.

---

# 6. Agent2Agent Protocol (A2A)

## 6.1 O que é?

O **Agent2Agent Protocol (A2A)** é um protocolo aberto voltado à comunicação e colaboração entre agentes independentes.

Seu objetivo é permitir que agentes desenvolvidos por diferentes organizações, frameworks ou fornecedores possam colaborar sem precisar conhecer a implementação interna uns dos outros.

Em sua forma mais simples:

```text
Agente A
    ↓
   A2A
    ↓
Agente B
```

---

## 6.2 O que significa "agentes conversando"?

Não significa necessariamente uma conversa semelhante àquela entre duas pessoas.

Imagine:

```text
Agente de Atendimento
        ↓
"Verifique a elegibilidade deste estudante."
        ↓
Agente de Benefícios
        ↓
"Estudante elegível."
        ↓
Agente de Atendimento
```

É uma comunicação entre sistemas.

Um agente envia uma tarefa ou solicitação e outro agente processa essa tarefa e devolve um resultado.

---

## 6.3 Por que precisamos de A2A?

MCP resolve principalmente a comunicação entre aplicações de IA e ferramentas ou recursos.

A2A resolve outro problema:

```text
MCP:
Agente → ferramenta

A2A:
Agente → agente
```

Um sistema pode combinar os dois:

```text
Agente de Atendimento
        │
        │ A2A
        ↓
Agente de Benefícios
        │
        │ MCP
        ↓
Banco / API / Ferramentas
```

---

## 6.4 O que o A2A permite?

O protocolo trabalha com aspectos como:

* descoberta das capacidades dos agentes;
* comunicação;
* colaboração em tarefas;
* troca de resultados;
* interação entre agentes independentes.

O objetivo é permitir que os agentes colaborem sem exigir que todos tenham sido desenvolvidos usando a mesma tecnologia.

---

## 6.5 Por que A2A é relevante no mercado?

A2A também apresenta evidências concretas de adoção.

O projeto foi originalmente desenvolvido pelo Google e posteriormente levado para a Linux Foundation. Em abril de 2026, a Linux Foundation informou que, em seu primeiro ano:

* mais de **150 organizações** apoiavam o projeto;
* havia integração com plataformas da Google, Microsoft e AWS;
* existiam implantações em produção;
* o projeto já era apresentado como um padrão aberto de interoperabilidade entre agentes.

Essa adoção é uma das razões pelas quais A2A é considerado um dos principais protocolos emergentes para arquiteturas multiagentes.

---

# 7. AGNTCY

## 7.1 O que é?

O **AGNTCY** é uma infraestrutura aberta para sistemas compostos por múltiplos agentes.

Seu objetivo não é simplesmente criar uma comunicação entre dois agentes.

Ele trata de problemas que aparecem quando o número de agentes cresce.

```text
Agente A
   ↕
Agente B
   ↕
Agente C
   ↕
Agente D
```

---

## 7.2 Que problemas aparecem em sistemas grandes?

Quando existem muitos agentes, surgem perguntas como:

> Quem são esses agentes?

> Como encontrar um agente específico?

> Como verificar sua identidade?

> Como trocar mensagens de forma segura?

> Como monitorar o que está acontecendo?

É nesse cenário que AGNTCY atua.

A Linux Foundation descreve o projeto como uma infraestrutura para **descoberta, identidade, mensageria e observabilidade** entre agentes de diferentes fornecedores e frameworks.

---

## 7.3 Principais componentes

### Agent Discovery

Permite descobrir agentes e entender suas capacidades.

### Agent Identity

Permite estabelecer identidade e mecanismos de controle de acesso.

### Agent Messaging

Permite comunicação entre agentes.

### Agent Observability

Permite acompanhar e analisar fluxos complexos de múltiplos agentes.

---

## 7.4 Relação com MCP e A2A

AGNTCY não deve ser entendido simplesmente como:

> "MCP + A2A."

Ele funciona como uma camada de infraestrutura que pode interoperar com essas tecnologias.

A própria Linux Foundation informa que o AGNTCY possui interoperabilidade com **A2A e MCP**, incluindo mecanismos para tornar agentes A2A e servidores MCP descobríveis em diretórios do ecossistema.

Uma representação simplificada:

```text
                    AGNTCY
                       │
          ┌────────────┼────────────┐
          ↓            ↓            ↓
      Descoberta   Identidade  Observabilidade
          │
          ↓
      Agente A ── A2A ── Agente B
                              │
                              │ MCP
                              ↓
                       Ferramentas / Dados
```

---

## 7.5 Por que AGNTCY é relevante?

A Linux Foundation informa que o projeto já contava, em julho de 2025, com mais de **65 empresas apoiadoras**, incluindo Cisco, Dell Technologies, Google Cloud, Oracle e Red Hat.

Sua relevância está principalmente no crescimento dos sistemas multiagentes e na necessidade de evitar que cada fornecedor desenvolva sua própria infraestrutura isolada.

---

# 8. Comparação direta

| Tecnologia    | Tipo                       | Principal função                   | Comunicação                                         |
| ------------- | -------------------------- | ---------------------------------- | --------------------------------------------------- |
| **AGENTS.md** | Formato de arquivo         | Instruir agentes de programação    | Não é um protocolo                                  |
| **MCP**       | Protocolo                  | Conectar IA a ferramentas e dados  | IA ↔ ferramenta/recurso                             |
| **A2A**       | Protocolo                  | Permitir colaboração entre agentes | Agente ↔ agente                                     |
| **AGNTCY**    | Infraestrutura/ecossistema | Operar sistemas multiagentes       | Descoberta, identidade, mensagens e observabilidade |

Uma forma simples de memorizar:

```text
AGENTS.md
→ "Como devo trabalhar?"

MCP
→ "Quais ferramentas e dados posso utilizar?"

A2A
→ "Como posso trabalhar com outro agente?"

AGNTCY
→ "Como podemos organizar muitos agentes?"
```

---

# 9. Por que esses quatro são importantes?

Os quatro foram selecionados porque representam **problemas fundamentais de sistemas agentivos modernos**, e não porque sejam simplesmente quatro produtos semelhantes.

Eles cobrem diferentes necessidades:

```text
               AGENTE
                  │
       ┌──────────┼──────────┐
       ↓          ↓          ↓
   Instruções   Ferramentas  Outros agentes
       │          │          │
 AGENTS.md       MCP         A2A
                              │
                              ↓
                       Sistemas maiores
                              │
                              ↓
                           AGNTCY
```

Além disso, há evidências concretas de interesse e adoção no ecossistema:

* **AGENTS.md, MCP e goose** foram escolhidos como projetos fundadores da Agentic AI Foundation.
* **MCP** alcançou adoção por diversas plataformas importantes e mais de 10 mil servidores públicos segundo a Anthropic.
* **A2A** ultrapassou 150 organizações apoiadoras e chegou a implantações em produção segundo a Linux Foundation.
* **AGNTCY** possui dezenas de empresas apoiadoras e foi incorporado à Linux Foundation para desenvolver infraestrutura aberta de sistemas multiagentes.

Por isso, é mais correto afirmar que eles estão entre os **projetos e padrões de maior destaque no ecossistema aberto de agentes de IA**, em vez de afirmar que são definitivamente "os quatro mais utilizados do mercado".

---

# 10. Relação entre os quatro

Uma arquitetura hipotética poderia utilizar os quatro em conjunto:

```text
                     AGENTS.md
                         ↓
                   Instruções do
                      projeto
                         ↓
                      Agente A
                     /        \
                    /          \
                  MCP          A2A
                  ↓              ↓
          Ferramentas        Agente B
          APIs / Dados           │
                                 │ MCP
                                 ↓
                         Ferramentas / Dados

              ←────── AGNTCY ──────→
                 infraestrutura
          descoberta / identidade /
          mensageria / observabilidade
```

Cada tecnologia possui uma responsabilidade diferente.

Não é necessário implementar todas para utilizar uma delas.

---

# 11. Resumo

| Conceito      | Em uma frase                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| **AGENTS.md** | Arquivo aberto para fornecer instruções e contexto a agentes de programação.                              |
| **MCP**       | Protocolo para conectar aplicações de IA a ferramentas, dados e recursos externos.                        |
| **A2A**       | Protocolo para permitir comunicação e colaboração entre agentes.                                          |
| **AGNTCY**    | Infraestrutura aberta para descoberta, identidade, mensageria e observabilidade em sistemas multiagentes. |

A principal diferença pode ser resumida como:

**AGENTS.md orienta o agente.**

**MCP conecta o agente às ferramentas e aos dados.**

**A2A conecta um agente a outro.**

**AGNTCY ajuda a organizar e operar ambientes com muitos agentes.**

---

# 12. Fontes

### Linux Foundation

Linux Foundation. **Linux Foundation Announces the Formation of the Agentic AI Foundation (AAIF), Anchored by New Project Contributions Including Model Context Protocol (MCP), goose and AGENTS.md.** 9 dez. 2025.

https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation

Linux Foundation. **Linux Foundation Launches the Agent2Agent Protocol Project to Enable Secure, Intelligent Communication Between AI Agents.**

https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents

Linux Foundation. **A2A Protocol Surpasses 150 Organizations, Lands in Major Cloud Platforms, and Sees Enterprise Production Use in First Year.** 9 abr. 2026.

https://www.linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year

Linux Foundation. **Linux Foundation Welcomes the AGNTCY Project to Standardize Open Multi-Agent System Infrastructure and Break Down AI Agent Silos.** 29 jul. 2025.

https://www.linuxfoundation.org/press/linux-foundation-welcomes-the-agntcy-project-to-standardize-open-multi-agent-system-infrastructure-and-break-down-ai-agent-silos

Linux Foundation. **Agentic AI Foundation Welcomes 57 New Members, Gaining Major Financial Services Players and APAC Leaders.** 13 ago. 2026.

https://www.linuxfoundation.org/press/agentic-ai-foundation-welcomes-57-new-members-gaining-major-financial-services-players-and-apac-leaders

### Projetos oficiais

AGENTS.md. **AGENTS.md — a simple, open format for guiding coding agents.**

https://github.com/agentsmd/agents.md

Model Context Protocol. **MCP Specification and Documentation.**

https://modelcontextprotocol.io/

Agent2Agent Protocol. **A2A Protocol Specification.**

https://a2a-protocol.org/

AGNTCY. **Open infrastructure for interoperable multi-agent systems.**

https://www.agntcy.org/

### Fonte complementar

Anthropic. **Donating the Model Context Protocol and establishing the Agentic AI Foundation.** 9 dez. 2025.

https://www.anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation

A fonte é utilizada principalmente para dados de adoção do MCP, enquanto as definições normativas devem ser baseadas nas especificações e projetos oficiais.
