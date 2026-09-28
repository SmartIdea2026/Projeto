### ATA — Reunião de Sprint Review, Normalização de Dados e Planejamento do Projeto

*   **Data:** 25/09/2026
*   **Horário:** 14:30 às 17:40 (aproximadamente)
*   **Local/Modalidade:** Presencial — Sala do SmartIdea
*   **Participantes:**
    *   Felipe Frechiani — Orientador / Professor
    *   Moisés Omena — Orientador
    *   Paulo Sérgio — Professor / Pesquisador
    *   Gustavo — Integrante da equipe (SmartIdea)
    *   Pedro — Integrante da equipe (SmartIdea)
    *   Gabriela (Gabi) — Integrante da equipe (SmartIdea)
    *   Vitória — Integrante da equipe (SmartIdea)
    *   Isabela — Integrante da equipe (SmartIdea)
    *   André — Integrante da equipe (SmartIdea)

#### 1. Objetivo da reunião
A reunião teve como objetivo apresentar a matriz de unificação das bases de dados (SRC, Horizon e Egressos), discutir a estratégia de conformidade com a LGPD e segurança de dados, avaliar modelos e ferramentas de Inteligência Artificial para auxílio no desenvolvimento, e definir o escopo e o cronograma do projeto Oráculo local.

#### 2. Assuntos discutidos
*   **Apresentação e Estrutura da Matriz de Dados:** A equipe apresentou a consolidação dos dados em uma matriz, mapeando mais de 10.000 pessoas registradas e aplicando chaves únicas (slugs e IDs) para correlacionar informações entre as bases do SRC, Horizon e Egressos.
*   **Indicadores Institucionais e Acompanhamento de Egressos:** Discutiu-se o potencial da base integrada para gerar indicadores para o IFES e órgãos de fomento (FAPES, Conif), tais como a participação de cotistas em projetos de pesquisa e o mapeamento da trajetória profissional de egressos via LinkedIn e dados salariais.
*   **Definição do Escopo e Entrega do Oráculo:** Alinhou-se que a prioridade do projeto até novembro de 2026 é estruturar uma base de dados unificada de Pessoas e Projetos para alimentar a aplicação do Oráculo.
*   **Avaliação de Ferramentas de IA e Harnessing:** A equipe compartilhou testes realizados com ferramentas de apoio ao desenvolvimento como Antigravity, Gemini Pro, ScrumAiDev, SDLC e OpenSpec, analisando o gerenciamento de contexto para redução do consumo de tokens.
*   **Periodicidade das Sprints:** Avaliou-se a possibilidade de migração de sprints semanais para quinzenais, porém decidiu-se manter os ciclos semanais para garantir checagens constantes e alinhamento próximo com os orientadores.

#### 3. Problemas ou pontos levantados
*   **Inconsistência e Campos Nulos na Matriz:** A matriz gerada apresentou elevado número de campos vazios e repetições de linhas, causados pela ausência de uma chave primária padronizada entre os sistemas legados e por limitações do formato plano.
*   **Complexidade no Mapeamento de Relacionamentos:** Identificou-se que atributos como "colaboradores" e "anos de atuação" vinham estruturados como listas/arrays isolados no formato JSON, o que dificultava o cruzamento direto sem uma normalização relacional prévia.
*   **Gestão do Consumo de Tokens de IA:** O uso de assistentes de codificação sem otimização de contexto consome limites de tokens de forma acelerada, reforçando a recomendação do plano Gemini Pro devido ao custo-benefício.

#### 4. Decisões tomadas
*   **Reestruturação para Modelo Relacional:** A equipe abandonou o formato de tabela única gigante em favor da divisão dos dados em tabelas relacionais menores e atômicas (como Pessoas, Ações e Colaborações), utilizando o ID do indivíduo como chave de união (*join*).
*   **Manutenção de Sprints Semanais:** Decidiu-se manter o formato de sprints semanais com alinhamentos regulares no laboratório LEDs.
*   **Alinhamento Técnico na Origem dos Dados:** Ficou agendada uma reunião presencial/remota com Rafael para *segunda-feira, às 13:30,* a fim de analisar diretamente os dados brutos e os scripts de extração (ETL).
*   **Congelamento do Escopo Principal:** O foco da entrega de final de ano (novembro/2026) fica estabelecido como a base integrada de Pessoas e Projetos integrada ao sistema Oráculo.

#### 5. Tarefas e encaminhamentos
| Tarefa | Responsável | Prazo |
| ------ | ------ | ------ |
| Realizar reunião técnica com Rafael para verificar a estrutura dos dados na origem (ETL) | Equipe e Rafael | 28/09/2026 |
| Refatorar a matriz de dados em tabelas relacionais atômicas e aplicar chaves por ID | Equipe | Próxima Sprint |
| Testar e adaptar as rotinas de IA no harness de desenvolvimento (ScrumAiDev / OpenSpec / Antigravity) | Equipe | Próxima Sprint |
| Consolidar a base unificada de Pessoas e Projetos para alimentação do Oráculo | Equipe | 30/11/2026 |

#### 6. Observações
As reuniões presenciais e validações com os orientadores continuarão sendo realizadas semanalmente na Sala do SmartIdea.

**Responsáveis pela elaboração da ata:** Isabela e Pedro.
