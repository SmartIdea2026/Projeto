# **Modelo de Template**

\# ADR \[0000\]: \[Título Curto e Descritivo\]

\*\*Status:\*\* \[Proposto | Aceito | Rejeitado | Substituído\]  
\*\*Data:\*\* \[DD/MM/AAAA\]

\#\# Contexto/Problema  
\[Descreva o cenário, a necessidade técnica ou o problema de negócio que exige uma decisão.\]

\#\# Decisão Tomada  
\[Descreva claramente a solução técnica escolhida.\]

\#\# Justificativa  
\[Explique por que esta solução foi escolhida.\]

\#\# Alternativas Consideradas  
\[Liste outras opções avaliadas e por que foram descartadas.\]

\#\# Consequências  
\* \*\*Positivas:\*\* \[Benefícios gerados pela escolha.\]  
\* \*\*Negativas:\*\* \[Desvantagens, limitações ou débitos técnicos adquiridos.\]  
\* \*\*Riscos:\*\* \[Potenciais problemas futuros e como mitigá-los.\]

\#\# Referências  
\[Links para documentações, artigos ou Issues (ex: \#123).\]

**Exemplo Preenchido**

\# ADR 0001: Adoção do PostgreSQL como Banco de Dados Principal

\*\*Status:\*\* Aceito  
\*\*Data:\*\* 25/08/2026

\#\# Contexto/Problema  
Precisamos de um banco de dados relacional robusto para armazenar os dados de usuários e transações do novo sistema financeiro, cujo volume crescerá rapidamente.

\#\# Decisão Tomada  
Utilizaremos o PostgreSQL em sua versão mais recente estável.

\#\# Justificativa  
Oferece excelente suporte a transações complexas, alta confiabilidade e suporte nativo a dados geográficos e JSON, atendendo às necessidades atuais e futuras.

\#\# Alternativas Consideradas  
\* MySQL: Descartado por ter suporte inferior a operações avançadas de JSON necessárias para os logs.  
\* MongoDB: Descartado pois nossos dados são fortemente estruturados e relacionais.

\#\# Consequências  
\* \*\*Positivas:\*\* Maior integridade dos dados, ecossistema maduro e farta documentação.  
\* \*\*Negativas:\*\* Curva de aprendizado um pouco maior para desenvolvedores juniores.  
\* \*\*Riscos:\*\* Gargalos de performance se as consultas não forem otimizadas (mitigado com criação de índices adequados).

\#\# Referências  
\* Issue \#45 \- Setup inicial da infraestrutura