# **Organização e Nomenclatura do Repositório**

---

	Este documento define os padrões utilizados para organizar e nomear arquivos e pastas no repositório do projeto **AncorAI**.

O objetivo é manter o repositório organizado, facilitar a localização dos documentos, evitar duplicações e garantir que todos os integrantes da equipe sigam uma mesma convenção durante o desenvolvimento.

Sumário

[**Estrutura atual do repositório	2**](#estrutura-atual-do-repositório)

[**Arquivos	3**](#arquivos)

# **Estrutura atual do repositório**

	A estrutura atual do projeto está organizada da seguinte forma:

Projeto/  
│  
├── .github/  
│   └── ISSUE\_TEMPLATE/  
│       └── templatekanban  
│  
├── Docs/  
│    |── ADR/  
│   │   └── TemplatesADR/  
│   │       ├── ProcessoRegistroDecisoesArquitetura.md  
│   │       └── TemplateExemploADR.md  
│   │  
│   ├── Organizacao/  
│   │   └── Processo/  
│   │       ├── OpenSpec/  
│   │       │   ├── ProcessosDeArquiteturaOpenSpect.md  
│   │       │   ├── ProcessoPropostaModificacaoPrompt.md  
│   │       │   └── ProcessoRegistroUX.md  
│   │       │  
│   │       └── Reuniao/  
│   │           ├── Atas/  
│   │           ├── Templates/  
│   │           └── README.md  
│   │  
│   ├── Pesquisas/  
│   ├── Requisitos/  
│   ├── PadronizaccaoDeCommit.md  
│   └── PadronizacaoDeRepositorio.md  
│  
├── .gitmessage  
└── [README.md](http://README.md)

| Pasta | Finalidade |
| ----- | ----- |
| .github/ | Arquivos relacionados às funcionalidades e configurações do GitHub |
| Docs/ | Documentação geral do projeto |
| Docs/ADR/ | Registros e modelos relacionados às decisões de arquitetura |
| Docs/Organizacao/ | Documentos relacionados à organização dos processos da equipe |
| Docs/Organizacao/Processo/ | Documentação dos processos utilizados no desenvolvimento |
| Docs/Organizacao/Processo/OpenSpec/ | Processos relacionados ao OpenSpec |
| Docs/Organizacao/Processo/Reuniao/ | Documentação das reuniões |
| Docs/Pesquisas/ | Resultados e documentos de pesquisas |
| Docs/Requisitos/ | Documentação relacionada aos requisitos do sistema |

# 

# 	**Arquivos**

Os arquivos criados pela equipe devem seguir um padrão de nomenclatura que permita identificar seu conteúdo sem que seja necessário abrir o arquivo para descobrir do que ele trata.

Para os arquivos de documentação, será utilizado o padrão **PascalCase**, no qual cada palavra começa com letra maiúscula e não são utilizados espaços entre as palavras.

**Exemplos:** 

ProcessoRegistroUX.md

LevantamentoDeRequisitos.md

FerramentasDePrototipacao.md

PadronizacaoDeRepositorio.md

[ProcessoDeReuniao.md](http://ProcessoDeReuniao.md)

A escolha do nome deve levar em consideração principalmente a **clareza e a finalidade do documento**. O nome deve ser suficientemente descritivo para que qualquer integrante da equipe consiga compreender, apenas pelo nome, qual é o assunto tratado no arquivo.

Por exemplo, um arquivo chamado Pesquisa.md não informa qual pesquisa foi realizada. Já PesquisaFerramentasIA.md permite identificar imediatamente o assunto do documento.

### **Clareza na nomenclatura**

Os nomes dos arquivos devem ser objetivos e relacionados diretamente ao conteúdo armazenado.

# Linux Foundation IA

AGENTS.md é um formato aberto destinado a fornecer aos agentes de codificação **instruções e contexto específicos do projeto**.

A Linux Foundation anunciou a criação da Agentic AI Foundation (AAIF) em dezembro de 2025, tendo AGENTS.md entre os projetos contribuídos para a fundação. A Linux Foundation descreve o formato como uma convenção baseada em Markdown que fornece aos agentes uma fonte consistente de orientação específica do projeto para trabalhar em diferentes repositórios e toolchains.

A documentação oficial do formato apresenta o AGENTS.md como um local previsível para informações como comandos de instalação, execução, testes, padrões de código e outras instruções relevantes para agentes. O formato não impõe campos obrigatórios, permitindo que cada projeto organize suas instruções conforme suas necessidades.

## [**AGENTS.md**](http://AGENTS.md)

O AGENTS.md é um arquivo em Markdown utilizado para fornecer **instruções específicas do projeto para agentes de codificação**.

A proposta é disponibilizar em um local previsível informações que um agente precisa conhecer antes de modificar o projeto. Entre os exemplos apresentados na documentação estão comandos para instalação, execução e testes, além de convenções e outras orientações específicas do repositório.

Um exemplo simplificado seria:

AncorAI/  
├── AGENTS.md  
├── README.md  
├── Docs/  
└── src/

O arquivo poderia informar, por exemplo:

* como executar o projeto;  
* como executar os testes;  
* quais ferramentas devem ser utilizadas;  
* quais diretórios não devem ser modificados sem análise;  
* convenções importantes do projeto;  
* procedimentos que o agente deve seguir antes de realizar alterações.

### **Por que isso é importante para o AncorAI?**

O AncorAI utiliza desenvolvimento assistido por IA. Portanto, algumas informações que atualmente podem estar espalhadas entre documentos, conversas ou conhecimento dos integrantes podem ser transformadas em **instruções explícitas para agentes**.

O AGENTS.md não substitui a documentação do projeto. Ele complementa documentos voltados aos seres humanos com informações diretamente relevantes para o trabalho dos agentes.

É o padrão pesquisado que possui relação mais direta com o uso de agentes de IA no desenvolvimento.

**README.md**

O README.md é o documento de apresentação do repositório.

Ele normalmente é utilizado para explicar o propósito do projeto, suas principais características, como começar a utilizá-lo e onde encontrar informações adicionais.

O GitHub considera o README um dos principais pontos de entrada para quem acessa um repositório.

### **Por que isso é importante para o AncorAI?**

O README funciona como **porta de entrada do projeto**.

Uma pessoa nova na equipe deve conseguir entender, a partir dele:

> "O que é o AncorAI e por onde começo?"

Além disso, o README pode ajudar a fornecer contexto inicial para ferramentas automatizadas, embora sua finalidade principal continue sendo a comunicação com pessoas.

 **.github/**

O diretório .github/ permite organizar determinados arquivos e recursos utilizados pelo GitHub.

Ele pode conter, entre outros recursos:

.github/  
├── ISSUE\_TEMPLATE/  
├── PULL\_REQUEST\_TEMPLATE.md  
└── ...

Isso permite separar arquivos relacionados ao funcionamento e à colaboração no GitHub do restante da documentação do projeto.	

O projeto utiliza GitHub para organizar Issues e Pull Requests. Isso pode manter esses recursos em .github/ evita misturar configurações e templates da plataforma com a documentação geral do projeto.

# **Pull Request Templates**

Pull Request Templates são modelos que definem quais informações devem acompanhar uma Pull Request.

Um template pode solicitar:

* descrição da alteração;  
* Issue relacionada;  
* testes realizados;  
* checklist;  
* observações para revisão.

O GitHub disponibiliza esse recurso para padronizar e facilitar a revisão das alterações.

# **CONTRIBUTING.md**

O CONTRIBUTING.md é utilizado para documentar como uma pessoa deve contribuir para o projeto.

Pode conter orientações sobre:

* preparação do ambiente;  
* criação de Issues;  
* desenvolvimento;  
* testes;  
* Pull Requests;  
* revisão;  
* outras regras específicas do projeto.

O GitHub disponibiliza orientações para projetos que desejam estabelecer diretrizes de contribuição.

**Recomendação**

Não há necessidade de criar o arquivo apenas para seguir uma lista de boas práticas. Ele deve ser adotado caso o projeto possua regras de contribuição que precisem ser formalizadas.

#  **Nomeação do repositório**

A nomeação também faz parte da organização do projeto.

O GitHub estabelece regras para os nomes dos repositórios e recomenda que eles sejam utilizados de maneira clara e consistente. A criação de um repositório também permite definir elementos como README, .gitignore e licença.

O nome deve permitir identificar rapidamente qual é o projeto sem depender de informações externas.

No caso do AncorAI, a recomendação é utilizar uma nomenclatura:

* clara;  
* curta;  
* consistente;  
* relacionada ao projeto.

---

#  **Organização atual do AncorAI**

Atualmente, a documentação do projeto está organizada da seguinte maneira:

Docs/  
├── ADR/  
├── Organizacao/  
├── Pesquisas/  
└── Requisitos/

Essa estrutura apresenta uma separação clara entre diferentes tipos de informação.

| Diretório | Finalidade |
| :---- | :---- |
| ADR/ | Registro de decisões arquiteturais |
| Organizacao/ | Documentação relacionada à organização do projeto |
| Pesquisas/ | Resultados das pesquisas realizadas |
| Requisitos/ | Documentação relacionada aos requisitos |

Essa organização **não foi identificada como uma especificação da Linux Foundation ou do GitHub**.

Ela deve ser tratada como uma **convenção interna do AncorAI**.

A pesquisa não encontrou motivo para substituir essa estrutura por outra apenas para seguir um padrão externo.

---

# 

# 

# 

# **Proposta de organização**

Considerando os padrões pesquisados e a organização que o AncorAI já possui, uma estrutura possível seria:

AncorAI/  
├── README.md  
├── AGENTS.md  
├── Docs/  
│   ├── ADR/  
│   ├── Organizacao/  
│   ├── Pesquisas/  
│   └── Requisitos/  
└── .github/  
    ├── ISSUE\_TEMPLATE/  
    └── PULL\_REQUEST\_TEMPLATE.md

### **Função de cada nível**

**README.md**  
 Apresentação geral do projeto.

**AGENTS.md**  
 Instruções específicas para agentes de IA.

**Docs/**  
 Documentação detalhada do projeto.

**ADR/**  
 Registro das decisões arquiteturais.

**Organizacao/**  
 Documentos relacionados à organização e aos processos.

**Pesquisas/**  
 Resultados de pesquisas.

**Requisitos/**  
 Requisitos e especificações do sistema.

**.github/**  
 Recursos específicos de colaboração e funcionamento no GitHub.

