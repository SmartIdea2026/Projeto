### **ATA – Reunião de Sprint Review e Definição de Novo Desafio Técnico**

* **Data:** 04/09/2026  
* **Horário:** 14:00 às 14:36 e 14:51 às 16:30  
* **Local/Modalidade:** Online — Google Meet  
* **Participantes:**  
  * André Fernandes — Integrante do SmartIdea  
  * Felipe Frechiani — Orientador do SmartIdea  
  * Gabriela Prajo — Integrante do SmartIdea  
  * Gustavo Mairinck — Integrante do SmartIdea / Scrum Master da semana  
  * Isabela Pereira — Integrante do SmartIdea  
  * Moisés Omena — Orientador do SmartIdea  
  * Pedro Lino — Integrante do SmartIdea  
  * Tadeu — Integrante do Oráculo  
  * Vitória Lima — Integrante do SmartIdea

#### **1\. Objetivo da reunião**

Realizar a Sprint Review do projeto SmartIdea, com a demonstração das funcionalidades concluídas do Âncora Dinâmico, avaliar as práticas de testes automatizados e o licenciamento de ferramentas de Inteligência Artificial, e estruturar as diretrizes do novo desafio técnico do grupo voltado à integração de dados públicos.

#### **2\. Assuntos discutidos**

* **Sprint Review (Apresentação de Entregas):** Gustavo, Scrum Master, liderou a apresentação das metas atingidas na sprint.  
  * ***Introdução ao OpenSpec e Claude Code:*** Alinhamento inicial da equipe ocorrido na terça-feira.  
  * ***Indexação de texto e busca por conteúdo:*** Conclusão da funcionalidade de indexação textual que realiza buscas internas nos arquivos de forma fidedigna.  
  * ***Categorias por IA:*** Organização restrita a 14 categorias geradas automaticamente por IA para evitar a criação de tags redundantes.  
  * ***Sugestão de Documentos Relacionados:*** Implementação de campo de correlação entre os arquivos. Felipe recomendou a inclusão de uma breve justificativa lógica com o motivo de um arquivo se relacionar com o outro.  
  * ***Interface e Cabeçalho:*** Compactação e refinamento estético da barra superior, com substituição por um botão de configurações.  
  * ***Busca por Voz:*** Desenvolvida utilizando a API Whisper, oferecendo ativação opcional sob limitações de transcrição.  
  * ***Testes Automatizados com Playwright:*** Pedro apresentou a estrutura dos 19 testes automatizados de ponta a ponta (*E2E*) em ambiente desktop (Electron). Os testes validam cenários de sucesso e falhas (como ausência de credenciais do GitHub). Foi discutida a possibilidade de migrar para o padrão BDD (Gherkin/Cucumber) em ciclos futuros para melhor organização.  
* **Golden Plating e Processos de Apresentação:** Felipe advertiu a equipe contra a prática de *Golden Plating* (adicionar funcionalidades extras de forma empolgada, como a integração com Google Drive que havia sido removida do escopo), destacando a importância de focar no planejamento acordado com o cliente. Recomendou também que as demonstrações de testes sejam preparadas/gravadas previamente para otimizar o tempo de reunião.  
* **Discussão de Licenciamento (Gemini Pro vs. Claude):** Discussão sobre os limites de tokens e custos de uso. Avaliou-se migrar para a licença Pro do Gemini (aproximadamente R$ 30/mês por usuário), considerada financeiramente mais viável que os custos de faturamento individual do Claude. A equipe confirmou a criação bem-sucedida dos e-mails institucionais.  
* **Definição do Novo Desafio (Integração de Dados):** Apresentação técnica do novo projeto para integrar diversas bases de dados descentralizadas (formato JSON no GitHub) do Ifes Campus Serra. Os dados compreendem registros de extensionistas, egressos, editais, pessoal e pesquisa. A aplicação local gerará um dashboard e sincronizará novos cadastros e atualizações de volta para o GitHub.

#### **3\. Problemas ou pontos levantados**

* **Limitação do teste gratuito do Claude Code:** O link promocional de acesso gratuito por 7 dias ao Claude Code era restrito a apenas 3 usuários ativos, o que gerou um gargalo técnico e exigiu reorganização e nova divisão de tarefas no meio da semana.  
* **Bug de Busca Identificado:** Constatou-se que buscas realizadas por termo de conteúdo que batiam com nomes de autores forçavam incorretamente o filtro por autor prioritariamente; o erro foi corrigido por Gustavo antes da homologação.  
* **Instalação Física do Laboratório (LEDs):** O quadro branco foi instalado na metade da parede e fora do ponto idealmente planejado. Há também a necessidade de abrir um chamado burocrático e gerenciar a desmontagem e montagem das novas mesas de trabalho.

#### **4\. Decisões tomadas**

* **Sprints e Calendário:** Devido ao feriado de segunda-feira, a reunião de planejamento (*Sprint Planning*) ocorrerá na terça-feira (08/09) às 13:00.  
* **Uso do Git:** A equipe gerará uma tag formal de versão (*release* V0.1) no repositório do GitHub para congelar o progresso finalizado no AncorAI antes de iniciar o novo desafio técnico de dados.  
* **Integração de Novo Membro:** Tadeu (integrante do projeto Oráculo) será formalmente adicionado ao grupo de comunicação do SmartIdea para apoiar no desenvolvimento e na futura integração da base OLAP com o sistema do Oráculo.  
* **Escopo da Próximas Tarefas:** O foco principal da sprint que se inicia será a exploração preliminar de dados, saneamento, tratamento de inconsistências e a estruturação de um dicionário de dados formalizado.

#### **5\. Tarefas e encaminhamentos**

| Tarefa | Responsável | Prazo |
| :---- | :---- | :---- |
| Gerar tag de versão release (V0.1) do SmartIdea no GitHub | Equipe | 04/09/2026 |
| Adicionar Tadeu ao grupo de trabalho do SmartIdea | Gustavo | 04/09/2026 |
| Conduzir a Sprint Planning da nova sprint focada em dados | Equipe | 08/09/2026 |
| Pesquisar "Top 5" ferramentas de visualização, mapeamento e qualidade de dados | Equipe | Próximas Sprints |
| Mapear a semântica das bases públicas e construir o dicionário de dados | Equipe | Próxima Sprint |
| Avaliar compatibilidade e performance entre Electron e Tauri para desktop | Equipe | Próximas Sprints |

#### **6\. Observações**

Os orientadores reforçaram que, independentemente do uso intensivo de assistentes de Inteligência Artificial para acelerar o desenvolvimento, a equipe precisa revisar e entender o que está sendo feito, dominar completamente a infraestrutura, a semântica e a segurança dos dados manipulados. Esse conhecimento técnico aprofundado é indispensável para transmitir confiabilidade ao cliente final.

**Responsáveis pela elaboração da ata:** André Fernandes e Gabriela Prajo