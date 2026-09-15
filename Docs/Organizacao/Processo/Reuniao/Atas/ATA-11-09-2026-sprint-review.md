# **ATA — Reunião de Alinhamento e Integração de Bases de Dados do Horizon e Sistemas IF**

**Data:** 11/09/2026  
**Horário:** 14h00 às 16h30  
**Local/Modalidade:** Presencial — Laboratório de Desenvolvimento

## **Participantes**

* Moisés — Orientador  
* Felipe — Orientador  
* André — Integrante da Equipe / Desenvolvedor  
* Gabriela — Integrante da Equipe / Desenvolvedora  
* Pedro — Integrante da Equipe / Desenvolvedor  
* Gustavo — Integrante da Equipe / Desenvolvedor  
* Isabela — Integrante da Equipe / Desenvolvedora  
* Vitória — Integrante da Equipe / Desenvolvedora

## **1\. Objetivo da reunião**

O objetivo principal da reunião foi analisar a exploração inicial realizada pela equipe nas bases de dados dos sistemas do IF (Horizon, Egressos, Editais, SRC e Diretoria), identificar atributos para correlação e integração entre as bases, alinhar a validação semântica dos dados por meio de scripts de ETL e definir os próximos passos relacionados à modelagem conceitual e à adoção de metodologias de desenvolvimento orientadas por IA.

## **2\. Assuntos discutidos**

### **2.1. Mapeamento e volume das bases de dados**

A equipe revisou as estruturas encontradas, contabilizando cerca de 70 arquivos JSON/tabelas distintos, com variação entre 15 e 149 atributos por conjunto de dados.

### **2.2. Estrutura e anonimização da base de Egressos**

Foi discutido o tratamento dos dados de egressos, cujos perfis foram rotulados com identificadores de A a X, embora existam dados complementares sobre salários e trajetórias profissionais provenientes do LinkedIn.

### **2.3. Exploração dos sistemas SRC e Editais**

Foram analisadas as tabelas do SRC (Sistema de Registro de Atividades de Extensão) e de Editais, observando-se correspondências entre ações, projetos, programas e coordenadores.

### **2.4. Estratégia de validação dos dados via ETL**

Foi acordado que a conferência manual de todas as tabelas seria inviável. Dessa forma, a validação será direcionada à análise dos scripts de ETL que serão apresentados por Rafael, os quais incluem extrações de dados do CNPq, Sigpesk e Lattes.

### **2.5. Ciclo de Vida de Desenvolvimento Orientado por IA (AI DLC)**

O professor Moisés apresentou uma comparação entre o framework AI DLC, da AWS, seu framework SC Dev, o Open Spec e o Spec Kit, destacando conceitos como Mob Elaboration e a importância do gerenciamento do contexto da IA para otimizar o uso de tokens.

## **3\. Problemas ou pontos levantados**

### **3.1. Inconsistência na proteção/anonimização**

A base de egressos possui dados anonimizados por meio de identificadores em uma tela/visão, porém mantém nomes abertos e identificáveis em outra lista associada.

### **3.2. Ausência de identificadores únicos/unificados**

As bases de dados não contam com identificadores únicos ou IDs unificados, como CPF ou identificadores institucionais, exigindo tentativas de associação por meio de nomes de pessoas, datas de projetos ou títulos.

### **3.3. Atributos incompletos ou com baixa taxa de preenchimento**

Identificou-se que determinados atributos apresentam preenchimento parcial, estando presentes em apenas 10% a 20% dos registros. Esses atributos deverão ser desconsiderados no processo de integração.

### **3.4. Semana reduzida e interrupções operacionais**

A produtividade da sprint foi afetada pelo feriado e pela necessidade de realizar atividades presenciais para montagem de monitores e reorganização da sala de trabalho.

### **3.5. Perda de contexto por agentes de IA**

Foi ressaltado o desafio de manter a coerência dos requisitos e das decisões à medida que aumenta o volume de arquivos e código no desenvolvimento com IA.

## **4\. Decisões tomadas**

### **4.1. Foco no primeiro corte de integração**

A equipe concentrará esforços apenas nos conceitos centrais e nos atributos que possuem ligação direta entre as tabelas, descartando integrações genéricas ou baseadas em relações semânticas fracas.

### **4.2. Validação pelas lógicas de ETL**

A verificação da consistência dos dados será realizada por meio da análise da lógica dos scripts de extração e tratamento (ETL), e não por inspeção registro a registro.

### **4.3. Construção de modelo conceitual visual**

Decidiu-se criar um diagrama visual simples, utilizando modelo conceitual/ER em Mermaid ou ferramenta equivalente, contemplando as principais entidades: Pessoas, Editais, Projetos e Grupos de Pesquisa.

### **4.4. Inclusão do AI DLC da AWS na sprint**

O framework AI DLC será testado durante a sprint na forma de um Spike de estudo, com o objetivo de estruturar o fluxo de trabalho da equipe.

### **4.5. Gestão de tarefas no backlog**

Tarefas não concluídas durante a sprint deverão ser marcadas como pendentes/arquivadas, em vez de serem simplesmente reutilizadas, garantindo o registro histórico real do projeto.

## **5\. Tarefas e encaminhamentos**

| Tarefa | Responsável | Prazo |
| ----- | ----- | ----- |
| Apresentação do processo de ETL do Horizon, incluindo as extrações do CNPq, Sigpesk e Lattes | Rafael (com Henrique e Thiago) | Segunda-feira, 13h00 |
| Mapeamento de atributos correlacionáveis e validação semântica com base nos ETLs | Gabriela, Pedro e equipe | Próxima sprint |
| Criação do diagrama conceitual visual das entidades e relacionamentos | Gabriela, Pedro e equipe | Próxima sprint |
| Realização de Spike de estudo e aplicação do framework AI DLC (AWS) | Equipe de desenvolvimento | Próxima sprint |
| Reunião de alinhamento de requisitos com Paulo | Moisés, Felipe e equipe | Próxima sexta-feira |

## **6\. Observações**

Destacou-se que a arquitetura deve priorizar os dados distribuídos, sem a necessidade de criação de uma infraestrutura de banco de dados centralizado nesta fase inicial.

O uso dos créditos e tokens de IA disponibilizados para a equipe deverá ser realizado com controle e moderação.

O projeto prevê, futuramente, a possibilidade de evolução para um Data Warehouse (DW), com tabelas fato e dimensão para os dados integrados do Horizon.

**Responsáveis pela elaboração da ata:** André Fernandes e Vitória Lima.

&nbsp;
