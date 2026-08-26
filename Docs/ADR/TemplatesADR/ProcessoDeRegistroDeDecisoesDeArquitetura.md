# Processo de Registro de Decisões de Arquitetura (ADR)

## 1. Objetivo

Estabelecer um processo padronizado para identificar, discutir, registrar, revisar e manter decisões de arquitetura do projeto, garantindo rastreabilidade, transparência e preservação do contexto técnico das escolhas realizadas.

O registro deve permitir que qualquer integrante da equipe entenda não apenas **o que foi escolhido**, mas também **qual problema motivou a decisão, quais alternativas foram consideradas e quais consequências foram aceitas**.

## 2. O que é uma ADR

ADR (*Architecture Decision Record*) é um registro de uma decisão arquitetural relevante para o projeto.

Uma ADR documenta uma escolha que influencia a estrutura, tecnologias, integração, segurança, dados, desempenho, manutenção ou outros aspectos arquiteturalmente significativos do sistema.

Uma ADR não deve ser utilizada para registrar toda decisão de implementação. Ela deve ser criada quando a decisão tiver impacto relevante e puder ser útil para explicar, no futuro, por que o sistema foi construído daquela maneira.

## 3. Quando criar uma ADR

Uma ADR deve ser considerada quando uma decisão:

- define ou altera uma tecnologia ou componente arquitetural relevante;
- altera a estrutura ou organização principal do sistema;
- cria uma integração importante com outro sistema ou serviço;
- estabelece uma estratégia de segurança, persistência, comunicação ou deploy;
- possui alternativas viáveis com diferentes custos ou consequências;
- gera um compromisso técnico que poderá influenciar decisões futuras;
- é suficientemente relevante para exigir alinhamento entre os membros da equipe.

Decisões rotineiras, detalhes locais de implementação e ajustes que não alteram significativamente a arquitetura não precisam de ADR.

## 4. Processo

### 4.1 Identificar a decisão

A necessidade de uma ADR pode surgir durante o levantamento de requisitos, planejamento, desenvolvimento, revisão de código, uso do OpenSpec ou discussão técnica da equipe.

Antes do registro, deve-se formular a decisão como uma pergunta ou problema objetivo.

Exemplos:

- Qual banco de dados será utilizado?
- Como a autenticação será implementada?
- Qual estratégia de comunicação entre componentes será adotada?
- Qual ferramenta ou tecnologia será utilizada para determinada responsabilidade arquitetural?

### 4.2 Explorar o problema e as alternativas

A equipe deve analisar o contexto, restrições, requisitos e alternativas tecnicamente viáveis antes de consolidar a decisão.

### 4.3 Deliberar e aprovar

A decisão deve ser discutida com os participantes relevantes para o assunto.

Quando houver impacto arquitetural significativo, a equipe deve registrar o consenso, a aprovação ou a rejeição da proposta antes de tratá-la como decisão consolidada.

### 4.4 Registrar a ADR

Após a decisão, deve ser criado um novo arquivo Markdown no diretório de ADR do projeto:

```text
Docs/ADR/
```

O repositório atualmente mantém nesse diretório o arquivo `TemplateExemploADR.md`, que define o padrão adotado pelo projeto.

O arquivo deve seguir a estrutura do template e receber numeração sequencial:

```text
ADR-0000-titulo-curto.md
```

O título deve ser objetivo e representar a decisão registrada.

### 4.5 Preencher o registro

Cada ADR deve conter, no mínimo:

- **Status:** situação atual da decisão;
- **Data:** data do registro ou atualização;
- **Contexto/Problema:** cenário e motivo que exigem a decisão;
- **Decisão Tomada:** solução escolhida;
- **Justificativa:** motivos técnicos e de negócio que sustentam a escolha;
- **Alternativas Consideradas:** opções avaliadas e motivos para sua rejeição;
- **Consequências:** impactos positivos, negativos e riscos;
- **Referências:** Issues, especificações, documentos e demais materiais relacionados.

Essas seções correspondem ao template atualmente mantido pelo projeto.

### 4.6 Relacionar a ADR ao trabalho de desenvolvimento

A ADR deve ser relacionada à Issue, Pull Request, especificação OpenSpec ou outro artefato que tenha originado a decisão.

Quando a decisão fizer parte de uma mudança conduzida com OpenSpec, a referência deve ser adicionada tanto na ADR quanto nos artefatos pertinentes da mudança, mantendo a rastreabilidade entre:

```text
Issue → OpenSpec → ADR → Implementação
```

O OpenSpec mantém especificações como fonte de verdade do comportamento do sistema e organiza mudanças em artefatos como `proposal.md`, `specs/`, `design.md` e `tasks.md`.

### 4.7 Revisar a implementação

Durante a implementação, a equipe deve verificar se o código e os demais artefatos permanecem coerentes com a decisão registrada.

Caso a implementação revele que a decisão original precisa ser alterada, a ADR não deve ser silenciosamente sobrescrita sem preservar seu histórico.

Deve-se atualizar o status adequadamente e, quando necessário, registrar uma nova ADR que substitua a anterior.

O OpenSpec também recomenda verificar a correspondência entre os artefatos de planejamento e a implementação antes do encerramento da mudança.

### 4.8 Manter o histórico das decisões

Uma ADR pode assumir diferentes status ao longo do tempo, conforme o template adotado pelo projeto:

- **Proposto:** decisão ainda em avaliação;
- **Aceito:** decisão aprovada e vigente;
- **Rejeitado:** proposta analisada e não adotada;
- **Substituído:** a decisão deixou de ser vigente porque uma nova decisão passou a valer.

Quando uma decisão for substituída, a nova ADR deve referenciar a anterior e explicar o motivo da mudança.

## 5. Relação entre ADR e OpenSpec

ADR e OpenSpec possuem finalidades complementares.

**ADR** registra uma decisão arquitetural duradoura e seu racional. Seu foco principal é preservar o **porquê** de uma escolha arquitetural.

**OpenSpec** estrutura o trabalho de mudança do sistema antes e durante a implementação. Seu foco é alinhar intenção, requisitos, design e tarefas para definir **o que será alterado e como a mudança será executada**.

Uma mudança conduzida com OpenSpec pode, portanto, gerar uma ADR quando houver uma decisão arquitetural relevante.

Nem toda mudança OpenSpec exige uma ADR, assim como nem toda ADR precisa resultar imediatamente em uma grande mudança de código.

### Fluxo recomendado

```text
Necessidade / Problema
        ↓
Exploração e análise
        ↓
OpenSpec (quando houver mudança a planejar)
        ↓
Decisão arquitetural
        ↓
ADR registrada
        ↓
Implementação
        ↓
Revisão / validação
        ↓
Atualização de status e histórico
```

## 6. Responsabilidades

### Autor da decisão

Responsável por levantar o contexto, documentar a decisão, registrar alternativas e manter as referências atualizadas.

### Equipe / revisores

Responsáveis por avaliar a solução, questionar alternativas e validar as consequências e riscos identificados.

### Responsável pela implementação

Responsável por garantir que a implementação esteja coerente com a decisão registrada e sinalizar qualquer divergência relevante.

## 7. Boas práticas

- Registrar decisões relevantes próximas do momento em que são tomadas.
- Escrever o contexto e a justificativa de forma suficiente para entendimento futuro.
- Registrar alternativas reais, evitando criar opções apenas para preencher a seção.
- Diferenciar decisão arquitetural de detalhe de implementação.
- Manter links para Issues, OpenSpec e outros documentos relacionados.
- Não apagar decisões históricas que deixaram de ser válidas; atualizar o status ou registrar uma decisão substituta.
- Revisar ADRs quando mudanças importantes do sistema alterarem suas premissas.
- Utilizar linguagem objetiva e evitar justificativas baseadas apenas em preferência pessoal.

## 8. Localização e padrão do projeto

A documentação de ADR do repositório está atualmente organizada em:

```text
Docs/ADR/
```

O template oficial presente no projeto é:

```text
Docs/ADR/TemplatesADR/TemplateExemploADR.md
```

O template estabelece a estrutura mínima para os registros.
