### ATA — Sprint Review (Modelagem de Dados e ETL)

* **Data:** 02/10/2026
* **Horário:** 14:00 - 16:30
* **Local/Modalidade:** Online (videoconferência com gravação e compartilhamento de tela)
* **Participantes:**
  * Felipe — Orientador / Revisor da Modelagem de Dados
  * Moisés — Orientador / Coordenador do Projeto
  * André — Integrante da Equipe / Desenvolvedor
  * Gabriela (Gabi) — Integrante da Equipe / Modelo Egressos (LinkedIn)
  * Gustavo — Integrante da Equipe / Modelo Sigpesq
  * Pedro — Integrante da Equipe / Desenvolvedor
  * Isabela (Isa) — Integrante da Equipe / Desenvolvedor
  * Vitória (Vivi) - Integrante da Equipe / Desenvolvedor

#### 1. Objetivo da reunião
Avaliar a evolução das modelagens conceituais de dados e dos pipelines de ETL desenvolvidos para as bases SRC, Egressos (LinkedIn), Lattes e Sigpesq, orientar a normalização e generalização dos conceitos e definir os encaminhamentos da próxima sprint focados no povoamento de tabelas com dados reais.

#### 2. Assuntos discutidos
* **Demonstração e Limitações da Base SRC:** Apresentação da extração de dados via Playwright, destacando o acesso restrito a um volume limitado de atributos e a necessidade de reestruturação do modelo conceitual.
* **Normalização e Generalização de Entidades:** Discussão orientada por Felipe e Moisés sobre a necessidade de normalizar os modelos, separando a entidade **Pessoa** de papéis específicos (extensionista, pesquisador, coordenador) e criando estruturas independentes para **Campus**, **Vínculo**, **Função** e **Alocação** para possibilitar a integração com o Sigpesq.
* **Exemplo Prático no ASTA (UML):** Demonstração realizada por Felipe utilizando o software ASTA para exemplificar a modelagem da classe **Pessoa** (nome, e-mail, CPF) e suas conexões com papéis, vínculos (servidor, aluno), funções e carga horária.
* **Modelo de Egressos (LinkedIn):** Apresentação por Gabi do modelo focado nos dados de alunos e egressos capturados via LinkedIn, abordando a remoção de listas redundantes (`listaExperiencia`), a eliminação de textos com dados sensíveis (`headline`, `sobre`) e o tratamento da localização do local de trabalho.
* **Modelo do Lattes:** Exibição por Vivi e Isa do diagrama derivado de dados públicos do Lattes (produções, orientações, projetos, eventos, bancas, financiadores), com debate sobre a diferenciação entre **composição**, **agregação** e **associação simples** em UML.
* **Modelo do Sigpesq:** Apresentação por Gustavo da estrutura das iniciativas de pesquisa, do funcionamento do crawler/ETL que consome planilhas e banco local, e alerta sobre a presença de dados sensíveis (CPF, celular, e-mail) no fluxo.
* **Metas da Próxima Sprint ("Show me the data"):** Definição de que o foco principal da próxima sprint será a criação e o povoamento de tabelas no banco de dados com instâncias reais extraídas via ETL, priorizando inicialmente as entidades **Pessoa**, **Organização** e **Ação/Iniciativa**.

#### 3. Problemas ou pontos levantados
* **Desnormalização no SRC:** Atributos aglutinados na estrutura atual impedem a integração com sistemas como Sigpesq e Lattes.
* **Trânsito de Dados Sensíveis:** Exposição de dados pessoais (CPF, e-mail, telefone celular) durante as rotinas e arquivos públicos do ETL.
* **Restrição de Credenciais Privadas:** Ausência de acesso direto às credenciais privadas do LinkedIn e do Sigpesq por parte da equipe.
* **Imprecisão na Simbologia UML por IA:** Emprego inadequado do símbolo de composição (losango preenchido) em entidades que deveriam figurar como agregação ou associação simples.

#### 4. Decisões tomadas
* **Centralização da Entidade Unificada `Pessoa`:** Todos os modelos individuais extrairão atributos pessoais para uma classe central chamada **Pessoa**, associando-a a papéis, vínculos e funções.
* **Povoamento de Tabelas Reais ("Show me the data"):** Evoluir dos diagramas conceituais para a criação e preenchimento de tabelas no banco de dados com dados reais do ETL.
* **Priorização Integrada Inicial:** Unificar inicialmente três entidades compartilhadas entre as bases: **Pessoa**, **Organização** e **Ação/Iniciativa**.
* **Segurança e Anonimização:** Proibir a publicação de senhas e credenciais no repositório público e aplicar rotinas de anonimização sobre dados sensíveis imediatamente após a extração.

#### 5. Tarefas e encaminhamentos
| Tarefa | Responsável | Prazo |
| ------ | ------ | ------ |
| Refinar os modelos conceituais (SRC, Egressos, Lattes, Sigpesq), ajustando as associações UML e isolando a entidade `Pessoa` | Equipe de Desenvolvimento | Próxima Sprint |
| Instanciar e popular as tabelas no banco de dados com dados reais extraídos do ETL para a entidade **Pessoa** | Equipe de Desenvolvimento | Próxima Sprint |
| Instanciar e popular as tabelas no banco de dados para a entidade **Organização** | Equipe de Desenvolvimento | Próxima Sprint |
| Mapear e instanciar a entidade **Ação / Iniciativa** no banco de dados | Equipe de Desenvolvimento | Próxima Sprint |
| Alinhar com Rafael e Paulo o acesso seguro para demonstração e carga anonimizada dos dados do LinkedIn e Sigpesq | Moisés | Próxima Sprint |
| Estudar a diferenciação conceitual entre composição, agregação e associação simples em UML | Equipe de Desenvolvimento | Próxima Reunião |

#### 6. Observações
* A reunião foi gravada mediante consentimento prévio informado dos participantes.
* Foi fixada a data de **30 de outubro** como marco temporal para o início das atividades relacionadas ao módulo **Oráculo**.

**Responsáveis pela elaboração da ata:** Pedro Lino e Gustavo 
