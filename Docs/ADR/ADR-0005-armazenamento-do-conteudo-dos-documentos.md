# ADR 0005: Armazenamento local do conteúdo dos documentos

**Status:** Proposto
**Data:** 28/08/2026

## Contexto/Problema

A ADR-0002 estabeleceu a persistência local NoSQL e definiu, em uma frase explícita, o que o banco guarda e o que não guarda:

> O conteúdo dos documentos **não** será armazenado; apenas o link que redireciona à fonte original.

Essa definição foi tomada quando o sistema tinha uma única finalidade para o banco: registrar quais documentos já haviam sido acessados, com os campos de resumo reservados para o futuro. Guardar links bastava porque nada do que o sistema fazia dependia do que estava escrito dentro do arquivo.

Isso deixou de bastar. Os recursos previstos desde o levantamento de requisitos — resumo por IA, classificação por assunto, busca por contexto além do nome literal — têm todos a mesma pré-condição: o sistema precisa ter acesso ao texto do documento. Nenhum deles pode ser construído sobre um link. O sistema conhece hoje os documentos apenas por fora: nome, caminho, extensão, data, autor e a URL que devolve o usuário ao GitHub.

Há uma segunda razão, menos evidente e igualmente decisiva. Obter o conteúdo sob demanda a cada uso, sem guardar nada, faria a cota da API do GitHub ser consumida repetidamente pelo mesmo arquivo inalterado — uma requisição por documento a cada busca que o alcançasse. Guardar o texto não é apenas conveniência: é a única forma de o custo em cota ser proporcional ao que mudou, e não ao número de vezes que o usuário pesquisa.

A questão a decidir, portanto, não é se o sistema precisa do texto — precisa. É se ele pode guardá-lo, e sob quais condições.

## Decisão Tomada

O sistema **passa a armazenar localmente o texto extraído dos documentos**, em coleção própria do banco NoSQL local, junto da identificação do documento, do estado da extração e da data.

A decisão tem quatro limites, que são parte dela e não recomendações acessórias:

1. **Apenas o texto extraído é armazenado.** Os bytes originais do arquivo não são persistidos em nenhum ponto. O sistema guarda o que lê do documento, não o documento.
2. **O conteúdo permanece confinado ao processo principal.** Nenhum canal IPC devolve texto de documento à camada de interface, pela mesma disciplina que a ADR-0003 impõe às credenciais. O conteúdo fica acessível ao sistema e nunca ao usuário final.
3. **A forma de visualizar um documento não muda.** O usuário continua sendo redirecionado à fonte original. O sistema possuir o texto é invisível para quem usa.
4. **O armazenamento tem teto explícito**, por arquivo e no total, definido em um único ponto do código.

Esta decisão **derruba a cláusula da ADR-0002 citada acima**, e apenas ela. Todo o restante daquela decisão permanece em vigor: a persistência continua NoSQL orientada a documentos, continua implementada com `@seald-io/nedb`, e continua acessada exclusivamente pelo processo principal.

## Justificativa

* **A alternativa não existe.** Resumo, classificação e busca por contexto não são construíveis sobre metadados. Manter a cláusula da ADR-0002 seria manter fora do produto tudo o que o levantamento de requisitos previu para depois do MVP.
* **O custo em cota exige.** Sem armazenamento, cada busca que alcançasse um documento pagaria de novo pelo seu conteúdo. Com armazenamento e invalidação por identidade de conteúdo, um arquivo inalterado é baixado uma vez e nunca mais.
* **A ADR-0002 previu a reavaliação.** Ela registra, como risco, que o NeDB carrega os dados em memória e que isso deve ser reavaliado *"caso o histórico ou os resumos cresçam além do esperado"*. Guardar texto de documentos é exatamente esse crescimento — este é o momento previsto, e a resposta a ele são os tetos e a coleção separada, aberta sob demanda.
* **O dado já é acessível a quem usa a máquina.** O usuário do sistema é membro da equipe e já possui, pela credencial configurada, acesso de leitura aos mesmos documentos no GitHub. O armazenamento local não concede acesso novo a quem opera a aplicação; ele muda onde o dado repousa, e é sobre isso que recai o risco descrito adiante.
* **A separação entre guardar e enviar é deliberada.** Esta decisão autoriza guardar o conteúdo **dentro** da máquina. Enviá-lo a um serviço externo é uma decisão distinta, com riscos distintos, e exige ADR própria. Tomá-las juntas esconderia que a segunda é muito mais grave que a primeira.

## Alternativas Consideradas

* **Manter a cláusula da ADR-0002 e obter o conteúdo a cada uso, descartando-o em seguida:** descartada. É a postura hoje escrita nos artefatos da mudança `resumos-e-indice-por-ia`, e ela não sobrevive ao exame do custo: repetiria o download do mesmo arquivo inalterado a cada busca, consumindo cota proporcional ao uso em vez de proporcional à mudança. Além disso, inviabiliza reaproveitar resumos e classificações, que precisam estar ancorados a uma versão conhecida do texto.
* **Guardar os bytes originais do arquivo:** descartada. Multiplica o volume armazenado sem benefício — o que o sistema consome é texto — e faria o NeDB, que carrega a base em memória, receber PDFs inteiros codificados. A própria ADR-0002 aponta esse limite.
* **Guardar os arquivos originais em pasta gerenciada, fora do banco:** descartada por acrescentar uma camada de gestão de arquivos — limpeza, órfãos, espaço em disco, sincronia com o banco — para preservar bytes que nenhum recurso previsto consome. Continua disponível caso surja necessidade de reprocessar arquivos com extrator diferente.
* **Cifrar o texto armazenado:** descartada nesta decisão. A chave precisaria residir na mesma máquina e ser acessível à aplicação sem intervenção do usuário, o que a protegeria de cópia casual do arquivo do banco, mas não de quem já tem acesso ao perfil do sistema operacional — que é o cenário de risco real. Registrar o risco com clareza é mais honesto do que uma cifragem que sugere uma proteção que ela não dá.

## Consequências

* **Positivas:** viabiliza resumo, classificação e busca por contexto; torna o consumo de cota do GitHub proporcional ao que muda no repositório; permite reaproveitar processamento caro entre execuções; não altera nada do que o usuário vê ou de como ele abre um documento.
* **Negativas:** o texto dos documentos da equipe passa a residir no disco de cada máquina onde a aplicação é instalada; o volume do banco cresce em ordem de grandeza; a extração de texto introduz dependências novas no processo que guarda a credencial.
* **Riscos:**
  * **Texto em claro no disco.** O armazenamento não é cifrado e a aplicação não tem autenticação, por ser local e monousuário. Quem obtiver acesso ao perfil de usuário do sistema operacional — ou a um backup dele — obtém o texto dos documentos da equipe, inclusive de repositórios privados, sem precisar da credencial do GitHub. Este é o risco central da decisão. Mitigação parcial: apenas o texto é guardado, os limites são explícitos, e o acesso permanece confinado ao processo principal. Não há mitigação que o elimine dentro do escopo local e monousuário.
  * **Memória do NeDB.** Carregar a base inteira ao abrir deixa de ser inócuo quando ela contém texto. Mitigação: coleção separada e aberta sob demanda, de modo que a inicialização e o caminho da busca não a carreguem; tetos por arquivo, por documento e no total; e todo o acesso ao banco segue isolado em um único módulo, para que a substituição do armazenamento afete um arquivo só.
  * **Superfície das bibliotecas de extração.** Analisar arquivos vindos de fora dentro do processo que guarda o token amplia a superfície de ataque. Mitigação: apenas bibliotecas em JavaScript puro, de escopo estreito, e recusa deliberada de pacotes com aviso de segurança conhecido.

## Referências

* Issue #65 — Criação do MVP inicial do Ancora
* ADR-0002 — Adoção de banco NoSQL local em substituição ao Firebase (cláusula sobre armazenamento de conteúdo derrubada por esta)
* ADR-0003 — Gerenciamento das credenciais de API pela interface (disciplina de confinamento ao processo principal, aqui estendida ao conteúdo)
* `openspec/changes/ingerir-conteudo-dos-documentos/` — proposta, especificações e desenho desta mudança
* `Docs/Requisitos/LevantamentoRequisitosFluxo.md` — requisitos de resumo e busca por contexto
