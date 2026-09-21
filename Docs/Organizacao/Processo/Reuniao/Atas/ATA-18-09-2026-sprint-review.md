### **ATA — Reunião de Acompanhamento e Apresentação dos Resultados da Sprint**

* **Data:** 18/09/2026  
* **Horário:** 15:00 às 16:30  
* **Local/Modalidade:** Presencial — Laboratório de Desenvolvimento  
* **Participantes:**  
  * Moisés — Orientador  
  * Felipe — Orientador  
  * André — Integrante da Equipe / Desenvolvedor  
  * Gabriela — Integrante da Equipe / Desenvolvedora  
  * Pedro — Integrante da Equipe / Desenvolvedor  
  * Gustavo — Integrante da Equipe / Desenvolvedor  
  * Isabela — Integrante da Equipe / Desenvolvedora  
  * Vitória — Integrante da Equipe / Desenvolvedora

---

#### **1\. Objetivo da reunião**

**Apresentar as entregas e resultados das tarefas da Sprint**, discutir o estudo sobre a metodologia de desenvolvimento assistido por IA (AI DLC), **avaliar a unificação dos modelos conceituais das bases de dados (Horizon, SRC e Diretoria)** e alinhar encaminhamentos para os impedimentos de conexão encontrados.

#### **2\. Assuntos discutidos**

* **Apresentação dos Resultados da Sprint:** A equipe relatou a conclusão das tarefas mapeadas no backlog, incluindo a confecção da ata anterior, o estudo da metodologia AI DLC, os testes de ligação entre bases via IA, a criação dos modelos conceituais individuais (Horizon, Editais, Diretoria, Egressos e SRC), a pesquisa dos fluxos de ETL e a consolidação do modelo conceitual unificado.  
* **Estudo da Metodologia AI DLC / EA IDLC:** Pedro detalhou o estudo sobre a metodologia baseada na documentação da Amazon, cobrindo as fases de *Inception*, *Construction* e *Operations*. Registrou-se que a ferramenta/plugin testado é bastante verboso e consome um volume alto de tokens.  
* **Unificação dos Modelos Conceituais:** Apresentação da proposta de modelo conceitual integrando as bases Horizon, SRC e Diretoria. Explicou-se que a base de Egressos foi removida do modelo unificado nesta etapa por limitações de conexão.  
* **Desafios no Mapeamento entre Bases:** Apresentação da ausência de chaves primárias, códigos ou identificadores diretos entre as bases. Destacou-se que o Horizon consolida dados do Lattes, SIGPESC e Grupos de Pesquisa, enquanto o SRC e a Diretoria cobrem ações de extensão, resultando em origens distintas.  
* **Proposta de Resolução por Probabilidade e Similaridade:** Discutiu-se a possibilidade de implementar um algoritmo para calcular um índice de probabilidade (de 0 a 1), avaliando similaridade de nomes e dados correlacionados (como grupos de pesquisa e ações) para cruzar registros.  
* **Aprimoramento Visual do Diagrama:** Recomendação dos orientadores para inclusão de legendas, rótulos ou identificadores de origem (SRC, Horizon, Diretoria) em cada tabela e atributo do diagrama Mermaid.

#### **3\. Problemas ou pontos levantados**

* **Desconexão Extrema entre as Bases:** As bases públicas acessíveis possuem fontes de dados heterogêneas (ex: SIGPESC/Lattes vs. SRC), sem chaves diretas para integração automática.  
* **Inconsistência de Informações:** Identificação de divergências em datas, nomes de participantes e composição de equipes para uma mesma iniciativa entre o Horizon e o SRC.  
* **Limitação de Identificadores Públicos:** Ausência de dados sensíveis ou únicos (como CPF ou e-mail) nas bases abertas para facilitar o cruzamento de alunos.  
* **Consumo Excessivo de Tokens no AI DLC:** O plugin de AI DLC avaliado apresentou um fluxo muito extenso e dispendioso, mostrando-se inadequado para a fase atual do projeto.

#### **4\. Decisões tomadas**

* **Escopo Reduzido do Modelo Conceitual:** Restringir a integração aos dados das bases SRC, Horizon e Diretoria, mantendo bases com baixa viabilidade (como Egressos) fora do escopo no momento.  
* **Substituição da Ferramenta de AI DLC:** Interromper os testes com a ferramenta atual e testar uma metodologia/ferramenta de AI SDLC mais leve sugerida pelo orientador na próxima sprint.  
* **Foco no Mapeamento de Pessoas:** Priorizar o cruzamento de dados na entidade Pessoa/Professor/Aluno, onde o alinhamento de nomes apresenta maior viabilidade.  
* **Rotulagem de Fontes no Diagrama:** Adicionar prefixos ou identificações nas tabelas e atributos do modelo conceitual para indicar a base de origem de cada dado.

#### **5\. Tarefas e encaminhamentos**

| Tarefa | Responsável | Prazo |
| ----- | ----- | ----- |
| Adicionar identificadores de origem (SRC, Horizon, Diretoria) no modelo conceitual e focar no detalhamento do perfil Pessoa | Integrantes da Equipe / Desenvolvedores | Próxima Sprint |
| Compartilhar e testar o novo método/plugin de AI SDLC mais leve | Felipe / Pedro / Equipe | Próxima Sprint |
| Esboçar a proposta de cruzamento por índice de probabilidade e similaridade | Equipe de Desenvolvedores / Orientadores | Reunião de Planning (Segunda-feira) |

**Responsáveis pela elaboração da ata:** Vitória e Isabela

