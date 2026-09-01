# ATA – Reunião de Alinhamento, Retrospectiva e Planejamento (ancorAI)
 
**Data:** 28/08/2026
**Horário:** 14:30 às 15:50
**Local/Modalidade:** Online (reunião remota)
 
**Participantes:**
- André (Integrante da equipe)
- Gabi (Integrante da equipe)
- Gustavo (Integrante da equipe)
- Isa (Integrante da equipe)
- Pedro (Integrante da equipe)
- Vivi (Integrante da equipe)
- Felipe (PO/Orientador)
- Moisés (Orientador)
## 1. Objetivo da reunião
 
Apresentar a versão inicial do MVP do sistema, alinhar os parâmetros e tarefas para a última sprint de desenvolvimento focada no ancorAI, definir as novas diretrizes de escopo do projeto e estabelecer práticas técnicas padronizadas de desenvolvimento para o time.
 
## 2. Assuntos discutidos
 
- **Apresentação de MVP:** Gustavo realizou a demonstração de uma versão inicial do MVP da aplicação, contemplando funcionalidades que haviam sido especificadas pelo Product Owner (PO).
- **Transferência de Conhecimento:** Discussão sobre o compartilhamento prático que Gustavo realizará com a equipe a respeito dos aprendizados no uso das ferramentas Claude Code e OpenSpec.
- **Mudança Estratégica de Escopo:** O projeto passará por um redirecionamento de foco. Não haverá mais atuação junto ao NAPNE; em vez disso, a equipe irá construir uma ferramenta no formato de um "Oráculo" para o Instituto Federal (IF).
- **Inovações de Interface e Recursos:** debateu-se a proposta de implementar o modelo Whisper para habilitar recursos de pesquisa por comando de voz no sistema.
- **Estratégia de Sincronização Local:** Para evitar requisições constantes e diretas ao GitHub e ao Drive, foi debatida a viabilidade de realizar a busca integral dos documentos uma única vez para armazenamento local, adicionando um botão físico de sincronização manual na interface.
- **Dimensionamento de Tarefas:** Debate sobre os critérios de divisão de atividades, estabelecendo que cada tarefa complexa deve ser quebrada em subtasks menores para viabilizar o desenvolvimento em paralelo e garantir que nenhuma task ultrapasse o limite máximo de 4 horas diárias (compatível com a carga horária de trabalho da equipe).
## 3. Problemas ou pontos levantados
 
- **Limitação Tecnológica:** A ferramenta anteriormente analisada, Antigravity, demonstrou-se muito limitada para atender às necessidades reais do projeto.
- **Restrições de Custo (Tokens de IA):** A geração automática de palavras-chave e tags por IA exigiria a leitura exaustiva de cada documento inserido, o que acarretaria em um consumo de tokens superior ao limite disponível para a equipe.
- **Formato de Gravação:** O fato de a gravação da reunião online ter sido gerada sem áudio exigiu que a equipe elaborasse a documentação com base em anotações parciais e resgates de memória.
## 4. Decisões tomadas
 
- **Substituição do NAPNE pelo Oráculo do IF:** Formalização da descontinuidade das atividades com o NAPNE para focar os esforços na nova aplicação de Oráculo.
- **Controle de Consumo de Tokens:** Para mitigar o uso excessivo de tokens de IA, a inferência automática de tags ficará temporariamente restrita a um volume máximo de 10 documentos.
- **Expansão do Claude Code:** Devido à boa aceitação e viabilidade frente à limitação do Antigravity, a equipe providenciará a solicitação de licenças gratuitas de Claude Code para mais dois integrantes do grupo.
- **Gestão de Reuniões e Eventos:** Todos os eventos, agendas e reuniões de alinhamento devem ser obrigatoriamente registrados no Google Agenda, incluindo todos os integrantes envolvidos.
- **Padrões de Desenvolvimento no Git:** Adoção obrigatória de commits vinculados diretamente às respectivas issues do GitHub, além do uso de um padrão estruturado de feature-branch baseado em boas práticas de mercado.
- **Autonomia da Equipe:** Os orientadores delegaram à equipe a condução autônoma da retrospectiva desta sprint e a realização da próxima sessão de planejamento (planning), mantendo-se disponíveis para futuras validações do plano estruturado.
- **Formato de Trabalho:** As atividades de desenvolvimento continuarão em regime predominantemente remoto durante a semana corrente, com possibilidade de agendas presenciais pontuais no laboratório LEDs.
## 5. Tarefas e encaminhamentos
 
| Tarefa | Responsável | Prazo |
|---|---|---|
| Compartilhar aprendizados sobre Claude Code e OpenSpec com a equipe | Gustavo | Próxima Sprint |
| Implementar testes automatizados de ponta a ponta (E2E / end-to-end) | Equipe | Próxima Sprint |
| Registrar eventos e incluir todos os membros nas agendas do Google Agenda | Equipe | Imediato |
| Pesquisar padrões de mercado e definir o modelo de feature-branch a ser utilizado | Equipe | Próxima Sprint |
| Codificar o projeto utilizando a especificação do Open Spec | Equipe | Próxima Sprint |
| Aprofundar o estudo da API do Google Drive para integração do sistema | Equipe | Próxima Sprint |
| Solicitar acesso à ferramenta Claude Code para mais dois membros do time | Equipe / Orientadores | Próxima Sprint |
 
## 6. Observações
 
Os orientadores manifestaram satisfação com a proatividade do time ao pesquisar e propor ferramentas alternativas viáveis quando confrontados com limitações técnicas do projeto.
 
---
 
**Responsáveis pela elaboração da ata:** Gustavo e Gabi
