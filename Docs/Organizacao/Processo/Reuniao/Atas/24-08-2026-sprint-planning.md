### ATA — Reunião de Planejamento da Sprint (Projeto Âncora)

*   **Data:** 24/08/2026
*   **Horário:** 13:00 às 14:30
*   **Local/Modalidade:** Presencial (SmartIdea)
*   **Participantes:** 
    *   Felipe — Orientador / Cliente
    *   Moisés — Coorientador / Cliente
    *   Gabi — Desenvolvedora / Responsável pelas Anotações
    *   André — Desenvolvedor / Scrum Master
    *   Gustavo — Desenvolvedor
    *   Vitória — Desenvolvedor
    *   Isabela — Desenvolvedor
      
#### 1. Objetivo da reunião

O objetivo principal da reunião foi realizar o planejamento da Sprint (Planning) para o aplicativo Âncora, revisando os requisitos do sistema, estimando o tempo de execução com auxílio de IA, definindo papéis na equipe, e estruturando as tarefas de desenvolvimento no Hub.

#### 2. Assuntos discutidos

*   **Mudança de Arquitetura (Web para Desktop):** Discussão sobre a alteração do escopo do aplicativo do formato web para desktop, visando simplificar os processos de deploy e apresentação futura da ferramenta.
*   **Conversão do Banco de Dados:** Análise de viabilidade para converter o banco de dados em nuvem (Firebase) para um banco de dados local ou utilizar o armazenamento local do navegador (*local storage*), eliminando a necessidade de implementação de um fluxo complexo de login neste estágio do projeto.
*   **Estudo e Quebra do Open Spec:** Alinhamento sobre o estudo do Open Spec (proposta de modificação por prompt, especificação de arquitetura, registro de decisões de arquitetura - ADR e processo de UX), dividindo-o em subtarefas de estudo e posterior geração de documentação e arquivos de especificação.
*   **Uso da IA e Antigravity:** Instalação e verificação de uso da ferramenta Antigravity integrada ao plano Gemini Plus para possibilitar que as alterações no código do sistema sejam aplicadas pela inteligência artificial a partir de prompts baseados no padrão do Open Spec.
*   **Escopo de Busca e Filtros do Sistema:** Definição de que a funcionalidade de busca do aplicativo deve ser restrita a arquivos de documentação (como `.md`, `.doc`, `.xls`, `.pdf`, `.epub`) e reuniões, sem abranger código-fonte. A busca exibirá metadados como data da última edição, autor, fonte (Git ou Drive) e resumos e relações gerados por IA.
*   **Organização e Gestão de Tarefas:** Definição de critérios de aceitação para as tarefas de estudo, as quais deverão resultar em apresentações curtas para compartilhamento de conhecimento entre a equipe durante as sessões de Review.
*   **Infraestrutura e Trabalho Remoto:** Comunicação recebida sobre a pintura das salas do laboratório físico a partir de quarta-feira de manhã, demandando a organização da equipe para retirada das máquinas e realização da sprint inteiramente online.

#### 3. Problemas ou pontos levantados

*   **Papel do Scrum Master:** Foi levantada uma dúvida sobre as atribuições exatas e responsabilidade prática do papel de Scrum Master no projeto.
*   **Estimativa de Tempo para Novas Tecnologias:** Dificuldade inicial da equipe em estimar com precisão o tempo para tarefas de tecnologias desconhecidas (como o Open Spec).
*   **Inconsistência de Patrimônio:** Divergência identificada entre as mesas presentes fisicamente no laboratório e os números registrados no relatório oficial de patrimônio para envio ao IFES.
*   **Deslocamento de Orientadores:** Felipe apontou que reuniões presenciais na sexta-feira geram grandes dificuldades de trânsito para seu retorno do IFES.

#### 4. Decisões tomadas

*   **Migração para Desktop:** O aplicativo Âncora será desenvolvido como uma aplicação desktop (com sugestão de uso do Electron) em vez de web.
*   **Persistência de Dados Local:** O banco de dados do sistema será convertido para uma versão local ou usará o *local storage* do navegador, operando no modo *client-side* sem necessidade de servidor centralizado ou login neste momento.
*   **Definição do Scrum Master:** André foi definido como o novo Scrum Master da equipe, sendo responsável por guiar e organizar as apresentações de Review e Retrospectiva.
*   **Atividades Remotas:** A partir de quarta-feira de manhã, a equipe trabalhará de forma totalmente remota (online) devido à pintura agendada para o laboratório físico.
*   **Apoio de IA na Estimativa:** Decidiu-se utilizar ferramentas de IA para apoiar a equipe na mensuração de tempo, critérios de aceitação, dependências e priorização de tarefas no Hub.
*   **Mudança no Cronograma de Reuniões:** A partir da próxima semana, as reuniões de planejamento (Planning) e revisão semanais serão transferidas de sexta-feira para as quintas-feiras. Excepcionalmente nesta semana, a reunião permanece agendada para sexta-feira.
*   **Entrega de Estudos:** Toda tarefa focada em estudo técnico deverá obrigatoriamente produzir uma apresentação de slides estruturada com exemplos práticos como critério de aceitação.
*   **Lançamento no Hub:** Todas as tarefas da sprint deverão estar lançadas no Hub até o fim do dia, contendo responsáveis associados, tamanho (esforço) estimado e critérios de aceitação definidos.

#### 5. Tarefas e encaminhamentos

| Tarefa | Responsável | Prazo |
| ------ | ------ | ------ |
| Cadastrar todas as tarefas no Hub com responsáveis, tamanho e critérios de aceitação | Toda a equipe | 24/08/2026 |
| Organizar equipamentos e levar máquinas para casa para o trabalho remoto | Integrantes que necessitarem | 25/08/2026 |
| Reunião inicial com Felipe para definir layout e funcionalidades da tela do aplicativo | Equipe de Prototipação / Dupla | 24/08/2026 |
| Estudo das tecnologias de desenvolvimento via spec e tópicos do Open Spec (dividido em duplas) | Duplas de Estudo | 28/08/2026 |
| Elaboração de apresentações de slides sobre os processos de estudo do Open Spec para a Review | Duplas de Estudo | 28/08/2026 |
| Instalação e verificação de possibilidade de uso do Antigravity com plano Gemini Plus | Equipe de Desenvolvimento | 28/08/2026 |
| Converter/analisar a migração do banco Firebase em nuvem para um banco de dados local | Equipe de Desenvolvimento | 28/08/2026 |
| Criar especificações padrão Open Spec (modificação via prompt, arquitetura, decisões - ADR e UX) | Equipe de Desenvolvimento | 28/08/2026 |
| Testar aplicação das especificações padrão Open Spec dentro do Antigravity no sistema Âncora | Equipe de Desenvolvimento | 28/08/2026 |
| Aplicar modificações no protótipo (Figma), enviar para Felipe/Moisés para feedback e iterar | Equipe de Prototipação | 28/08/2026 |
| Atualizar relatório de numeração de mesas do patrimônio físico para envio ao IFES | Moisés / Integrante designado | 28/08/2026 |
| Registrar as atividades e métodos de apoio da IA no planejamento como critério da próxima planning | Gabi / Equipe | 28/08/2026 |

#### 6. Observações

*   A gravação do áudio da reunião foi efetuada para fins de resgate de informações e alinhamento, mas seu uso é acessório e não substitui a necessidade de elaboração e controle desta ata em formato Markdown.
*   Felipe reforçou que a reunião diária (Daily) é a ferramenta ideal para entender o andamento das tarefas e realizar replanejamentos rápidos, evitando discussões prolongadas sobre redistribuição de tarefas no momento da Daily.

**Responsáveis pela elaboração da ata:** Pedro / Gustavo
