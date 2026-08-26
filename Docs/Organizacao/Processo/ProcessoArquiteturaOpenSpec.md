# Processo de Especificação de Arquitetura com OpenSpec

A pergunta que tentamos responder durante o estudo é:

> **"Como o OpenSpec permite descrever e organizar a arquitetura de uma mudança antes que ela seja implementada?"**

## 1. Objetivo

O OpenSpec utiliza especificações como fonte de verdade sobre o comportamento atual do sistema e mantém as mudanças propostas separadas até que sejam implementadas e aprovadas. Para mudanças arquiteturais, o processo permite registrar **o que será alterado, como será estruturado tecnicamente e quais tarefas serão necessárias**.

## 2. Estrutura utilizada

Um projeto OpenSpec possui, de forma simplificada:

```text
openspec/
├── specs/                    # comportamento atual
│   └── <dominio>/
│       └── spec.md
│
└── changes/                  # mudanças propostas
    └── <mudanca>/
        ├── proposal.md
        ├── specs/
        │   └── <dominio>/
        │       └── spec.md
        ├── design.md
        └── tasks.md
```

As especificações são organizadas por domínio, funcionalidade ou componente. O OpenSpec também permite organizar specs por componentes como `api`, `frontend` ou `workers`.

## 3. Processo de especificação

O fluxo padrão é:

**Proposal → Specs → Design → Tasks → Implementação → Archive**

### Proposal — Por quê e o quê?

Define:

* problema ou oportunidade;
* objetivo da mudança;
* o que será alterado;
* capacidades afetadas;
* impacto em código, APIs, dependências ou outros sistemas.

O `proposal.md` deve ser conciso e concentrar-se no **porquê**, deixando detalhes de implementação para o `design.md`.

### Specs — O que o sistema deve fazer?

As specs representam o **comportamento esperado** do sistema.

Cada requisito deve seguir uma estrutura como:

```markdown
### Requirement: Nome do requisito

O sistema SHALL ...

#### Scenario: Caso específico
- GIVEN ...
- WHEN ...
- THEN ...
```

A especificação deve descrever comportamento observável e verificável, não classes, bibliotecas, tabelas ou outros detalhes internos.

### Design — Como será feito?

O `design.md` registra a **abordagem técnica e as decisões arquiteturais** necessárias para implementar a mudança.

É o local apropriado para documentar, por exemplo:

* componentes envolvidos;
* organização e responsabilidades;
* integrações entre componentes;
* decisões técnicas;
* padrões adotados;
* alterações de arquitetura;
* aspectos de implementação que não pertencem à especificação comportamental.

O próprio schema `spec-driven` define `design.md` como o artefato do **"HOW"**, enquanto a spec representa o **"WHAT"**.

### Tasks — O que precisa ser implementado?

Transforma o design em uma lista de tarefas executáveis, servindo como checklist para a implementação.

#### Comandos do OpenSpec

O fluxo pode ser executado utilizando os comandos correspondentes a cada etapa:

```text
Proposal
/openspec:proposal
       ↓
Specs
/openspec:specs
       ↓
Design
/openspec:design
       ↓
Tasks
/openspec:tasks
       ↓
Implementação
/openspec:apply
       ↓
Archive
/openspec:archive
```

De forma resumida:

| Etapa             | Comando              | Objetivo                                                     |
| ----------------- | -------------------- | ------------------------------------------------------------ |
| **Proposal**      | `/openspec:proposal` | Definir o problema, objetivo e escopo da mudança             |
| **Specs**         | `/openspec:specs`    | Definir o comportamento esperado                             |
| **Design**        | `/openspec:design`   | Definir a solução técnica e arquitetural                     |
| **Tasks**         | `/openspec:tasks`    | Decompor a solução em tarefas executáveis                    |
| **Implementação** | `/openspec:apply`    | Executar as tarefas e implementar a mudança                  |
| **Archive**       | `/openspec:archive`  | Finalizar a mudança e atualizar as especificações principais |

## 4. Boas práticas para especificação arquitetural

* **Separar comportamento de implementação:** `spec.md` descreve o que o sistema deve fazer; `design.md` descreve como será construído.
* **Especificar por domínio ou componente:** manter cada spec focada em uma capacidade.
* **Usar requisitos verificáveis:** cada requisito deve representar um comportamento que possa ser testado ou validado.
* **Usar cenários:** representar casos concretos utilizando `GIVEN / WHEN / THEN`, incluindo situações de erro e exceções.
* **Aumentar o nível de detalhe conforme o risco:** mudanças arquiteturais, alterações de contratos de API, migrações e questões de segurança justificam especificações mais rigorosas.
* **Manter as specs atualizadas:** após uma mudança ser concluída, seus deltas são incorporados às specs principais, mantendo-as como fonte de verdade do sistema.

## 5. Exemplo aplicado ao AncorAI

Supondo uma mudança para separar a integração com o GitHub em um componente específico:

**Proposal**

↓

Criar uma camada responsável pela integração com o GitHub.

**Specs**

↓

O sistema SHALL consultar o GitHub para obter documentos correspondentes à busca.

**Design**

↓

```text
Frontend
   ↓
Search Service
   ↓
GitHub Service
   ↓
GitHub API
```

**Tasks**

↓

```text
[ ] Criar GitHub Service
[ ] Implementar integração com API
[ ] Integrar ao fluxo de busca
[ ] Criar testes
```

Nesse exemplo, a **spec define o comportamento**, enquanto o **design registra a estrutura arquitetural escolhida**. Essa separação é central no processo do OpenSpec.

## 6. Conclusão

O processo de especificação arquitetural no OpenSpec pode ser resumido como:

> **Definir a necessidade → especificar o comportamento → definir a solução arquitetural → decompor em tarefas → implementar → atualizar a especificação.**

O principal benefício é permitir que decisões e mudanças arquiteturais sejam analisadas **antes da implementação**, mantendo a especificação alinhada ao sistema ao longo de sua evolução.

### Fontes consultadas

* [OpenSpec — Getting Started](https://github.com/Fission-AI/OpenSpec/blob/main/docs/getting-started.md?utm_source=chatgpt.com)
* [OpenSpec — Concepts](https://github.com/Fission-AI/OpenSpec/blob/main/docs/concepts.md?utm_source=chatgpt.com)
* [OpenSpec — Writing Good Specs](https://github.com/Fission-AI/OpenSpec/blob/main/docs/writing-specs.md?utm_source=chatgpt.com)
* [OpenSpec — Examples & Recipes](https://github.com/Fission-AI/OpenSpec/blob/main/docs/examples.md?utm_source=chatgpt.com)
* [OpenSpec — Conventions Specification](https://github.com/Fission-AI/OpenSpec/blob/main/openspec/specs/openspec-conventions/spec.md?utm_source=chatgpt.com)
* [OpenSpec — Spec-Driven Schema](https://github.com/Fission-AI/OpenSpec/blob/main/schemas/spec-driven/schema.yaml?utm_source=chatgpt.com)
