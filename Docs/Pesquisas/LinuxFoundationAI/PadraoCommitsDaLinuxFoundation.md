# **Linux Foundation patterns**

# **Pesquisa de Padrões de Commits**

## **1\. Objetivo**

Levantar padrões, especificações e boas práticas de mercado para padronização de mensagens de commit em repositórios Git/GitHub, avaliar sua origem e finalidade, e recomendar quais devem ser adotados no projeto.

## **2\. Padrões e especificações analisados**

**2.1 Conventional Commits**  
Especificação leve que define uma estrutura fixa para mensagens de commit: `<tipo>[escopo opcional]: <descrição>`, seguida opcionalmente de corpo e rodapé. Os tipos mais comuns são `feat` (nova funcionalidade), `fix` (correção de bug), `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci` e `chore`. Sua finalidade é tornar o histórico do repositório legível por humanos e por máquinas, permitindo automatizar geração de changelog e definição de versão (integra-se diretamente com o Semantic Versioning). **Origem:** iniciativa da comunidade open source, sem vínculo institucional único; é hoje o padrão de fato mais usado no mercado.

### **2.2 Developer Certificate of Origin (DCO)**

Declaração leve, criada em 2004 pela Linux Foundation para o kernel Linux, na qual o autor do commit certifica que tem o direito de submeter aquele código sob a licença do projeto. Na prática, é aplicada adicionando uma linha `Signed-off-by: Nome <email>` ao final da mensagem de commit (o comando `git commit -s` faz isso automaticamente). É amplamente adotada por projetos hospedados pela Linux Foundation e por ferramentas como o GitHub App "DCO", que bloqueia PRs sem essa assinatura. **Origem:** Linux Foundation (governança de proveniência de contribuições, não é sobre formatação de mensagem).

### **2.3 Regras de Chris Beams para mensagens de commit**

Guia amplamente citado ("How to Write a Git Commit Message") que define sete regras práticas de formatação e estilo: separar assunto do corpo com linha em branco, limitar a linha de assunto a \~50 caracteres, iniciar com maiúscula, não terminar com ponto final, usar modo imperativo ("Adiciona X" em vez de "Adicionado X"), quebrar o corpo em \~72 caracteres e usar o corpo para explicar o quê e por quê (não o como). Essas regras são a base estilística usada dentro da descrição do Conventional Commits. **Origem:** artigo de referência da comunidade (Chris Beams), citado por guias de contribuição de inúmeros projetos open source.

### **2.4 Semantic Versioning (SemVer)**

Especificação para numeração de versões no formato `MAJOR.MINOR.PATCH`, em que MAJOR indica mudanças incompatíveis, MINOR indica novas funcionalidades compatíveis e PATCH indica correções compatíveis. Não é uma especificação de commit em si, mas é o padrão para o qual o Conventional Commits foi desenhado (`feat` → MINOR, `fix` → PATCH, `BREAKING CHANGE` → MAJOR), viabilizando versionamento e changelog automáticos. **Origem:** especificação aberta e independente (semver.org). 

### **2.5 Git Trailers e convenções de atribuição (Co-authored-by / assinaturas de IA)**

O Git suporta "trailers" — linhas estruturadas no final da mensagem de commit, como `Signed-off-by:` (usado pelo DCO) e `Co-authored-by:` (reconhecido nativamente pelo GitHub para atribuir autoria a mais de uma pessoa). Esse mesmo mecanismo passou a ser reaproveitado pela comunidade para sinalizar **participação de IA na geração do código**: ferramentas como Claude Code adicionam automaticamente `Co-Authored-By: Claude <noreply@anthropic.com>` aos commits que gera, e já existem convenções emergentes de rodapé (`Assisted-by:`, `Generated-by:`) para diferenciar o grau de participação da IA em cada commit. **Origem:** funcionalidade nativa do Git/GitHub, com convenções de uso definidas por ferramentas de IA e pela comunidade. 

### **2.6 OpenSSF Best Practices Badge**

Programa de autocertificação criado em 2015 pela **Linux Foundation** (originalmente "CII Best Practices Badge", hoje mantido pelo grupo de trabalho OpenSSF, que também é parte da Linux Foundation) para avaliar a maturidade de projetos open source. Entre os critérios avaliados (níveis passing/silver/gold) estão o uso de controle de versão público, numeração de versão única e compreensível (recomenda-se explicitamente SemVer), existência de notas de release e, em níveis mais altos, uso de commits assinados criptograficamente. Não é uma especificação de formato de commit, mas referencia diretamente boas práticas de controle de versão e histórico de mudanças.

## **3\. Padrões recomendados para o AncorAI**

|  Conventional Commits |  Sim | Já adotado pelo projeto. Permite automatizar changelog e leitura rápida do histórico.  |
| :---: | :---: | :---- |
|  Documentação Interna |  Sim | O projeto utiliza a descrição obrigatoriamente no infinitivo (ex: "adicionar", "corrigir") e exige corpo de texto obrigatório para os commits.  |
|  Semantic Versioning |  Sim, para releases/tags | Alinha-se naturalmente com os tipos do Conventional Commits e evita ambiguidade em versões futuras. |
|  Rodapé de atribuição de IA |  Sim, recomendado | O AncorAI usa ferramentas de geração assistida por IA no protótipo; registrar essa participação (ex: `Assisted-by:`) dá transparência sobre o que foi gerado por IA vs. escrito manualmente. |
|  DCO (Signed-off-by) |  Não, por hora | Pensado para múltiplos colaboradores externos. Para o estágio atual do AncorAI, o custo de processo supera o benefício. |
|  OpenSSF Best Practices |  Não como certificação | É um programa amplo, fora do escopo desta task. Vale reaproveitar apenas a recomendação pontual de versionamento (SemVer). |

### **3.1 Diferença entre o padrão atual do AncorAI e o da Linux Foundation**

É importante esclarecer a diferença de finalidade entre o modelo de commits que a equipe já utiliza e o proposto pela Linux Foundation:

* **O padrão do AncorAI (Conventional Commits):** Foca na **organização técnica e estrutural**. Ele define regras de formatação (uso de prefixos como feat e fix, verbos no infinitivo e corpo de texto obrigatório). O objetivo é facilitar a leitura do histórico pela equipe e automatizar o versionamento.  
* **O padrão da Linux Foundation (DCO):** Foca na **proteção legal**. Ele não dita regras sobre como escrever o título ou o corpo do commit, mas exige uma assinatura no rodapé (Signed-off-by: Nome \<email\>) para certificar que o autor detém os direitos autorais sobre aquele código.  
* **Veredito:** Como o AncorAI é desenvolvido por uma equipe interna pequena, o foco atual deve ser na organização técnica. Adotar a assinatura legal (DCO) da Linux Foundation agora apenas geraria burocracia sem benefício imediato, podendo ser reavaliado futuramente caso o projeto seja aberto para contribuições públicas.

## 

## 

## **4\. Proposta prática de padrão de commit para o AncorAI**

Formato unificado (Conventional Commits \+ Documentação Interna \+ Trailers de IA):

`tipo(escopo opcional): descrição breve no infinitivo`

`corpo obrigatório explicando com mais detalhes o que foi alterado e o motivo`

`rodapé: referências a issues (Refs:/Close:) e autoria de IA`

Exemplo padrão (seguindo a documentação interna): feat(busca): adicionar filtro de período na busca de documentos

Implementa seletor de intervalo de datas ao lado da barra de busca, permitindo filtrar resultados por data de última modificação.

Refs: \#64

**Exemplo com participação de IA no código gerado:**

feat(dashboard): gerar layout inicial do painel de resultados

Protótipo gerado a partir de prompt na ferramenta Lovable e ajustado manualmente para aplicar a paleta de cores do projeto.

Assisted-by: Lovable

Close: \#64

**Fontes da pesquisa:**  
[https://www.conventionalcommits.org/en/v1.0.0/](https://www.conventionalcommits.org/en/v1.0.0/)

[https://developercertificate.org/](https://developercertificate.org/)

[https://cbea.ms/git-commit/](https://cbea.ms/git-commit/)

[https://semver.org/](https://semver.org/)

[https://docs.github.com/en/pull-requests/committing-changes-to-your-project/creating-and-editing-commits/creating-a-commit-with-multiple-authors](https://docs.github.com/en/pull-requests/committing-changes-to-your-project/creating-and-editing-commits/creating-a-commit-with-multiple-authors)  
[https://www.bestpractices.dev/](https://www.bestpractices.dev/)