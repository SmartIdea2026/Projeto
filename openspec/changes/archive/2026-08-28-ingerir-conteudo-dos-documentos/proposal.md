# Proposta — Ingestão do conteúdo dos documentos

**Issue:** #65
**Status:** Proposto
**Data:** 28/08/2026

## Why

Hoje o sistema conhece os documentos apenas por fora: nome, caminho, data, autor e um link que devolve o usuário ao GitHub. Nada do que está *dentro* do arquivo chega à aplicação. Isso basta para buscar por nome, mas fecha a porta para tudo o que depende do texto — resumo por IA, classificação por assunto, busca por contexto —, porque nenhuma dessas coisas pode ser construída sobre um link.

Trazer o conteúdo para dentro do sistema é o degrau que falta. Ele não entrega funcionalidade visível sozinho, e é justamente por isso que vem separado: é a base sobre a qual a mudança seguinte se apoia, e a decisão de dados que ela carrega merece ser avaliada por si.

## What Changes

- **As fontes passam a entregar o arquivo, não só a referência a ele.** A integração com o GitHub ganha o download do conteúdo de um documento, além do inventário de metadados que já faz.
- **O texto dos documentos passa a ser armazenado no banco local.** De cada arquivo é extraído o texto, que é gravado em uma coleção nova. Os bytes originais não são guardados: o que interessa ao sistema é o texto.
- **BREAKING (postura de dados):** a regra vigente de que **o conteúdo dos documentos nunca é armazenado** deixa de valer. Ela está afirmada em `busca-documentos` (cenário *Conteúdo não é armazenado*) e na ADR-0002 (*"O conteúdo dos documentos **não** será armazenado; apenas o link que redireciona à fonte original"*). **Exige ADR.**
- **O conteúdo é acessível ao sistema, nunca ao usuário.** Nenhum canal IPC devolve texto de documento ao *renderer*, pela mesma disciplina que a ADR-0003 impõe às credenciais. Esta mudança não acrescenta nada à interface.
- **A visualização do documento continua exatamente como está:** o resultado segue oferecendo o link que redireciona à fonte original. O sistema ter o texto não muda o que o usuário vê nem como ele abre o arquivo.
- **Ingestão sob demanda somada a indexação de fundo,** incremental e retomável, que nunca bloqueia a busca.
- **Invalidação pelo `sha` do blob Git**, que é hash do conteúdo: enquanto o `sha` não muda, o texto guardado continua válido e nenhum download se repete.
- **Limites explícitos de tamanho** por arquivo e para o acervo, com o motivo registrado quando um documento fica de fora.

## Capabilities

### New Capabilities

- `conteudo-documentos`: obtenção do conteúdo dos documentos junto às fontes, extração do texto, seu armazenamento local, a invalidação quando o documento muda na origem e o confinamento desse conteúdo ao processo principal.

### Modified Capabilities

- `busca-documentos`: o requisito *Acesso ao documento na fonte original* afirma hoje que o conteúdo não é armazenado. A afirmação é substituída — o registro de acesso continua guardando apenas o link, mas o sistema passa a manter o texto em outro lugar, e a distinção precisa estar escrita.
- `integracao-fontes`: o requisito *Consulta às fontes externas* descreve as fontes como provedoras de metadados. Passa a incluir a obtenção do conteúdo de um documento identificado.

## Impact

**Postura de dados — o ponto central.** Até aqui o sistema guardava apenas links. Ele passa a guardar o texto dos documentos da equipe no disco da máquina de cada integrante, sem cifragem e sem autenticação, já que a aplicação é local e monousuário. Quem tiver acesso ao perfil de usuário do sistema operacional tem acesso ao texto. **Exige ADR** que nomeie o risco e registre a decisão, referenciando a ADR-0002 conforme o processo de registro de decisões.

**Relação com a ADR-0002.** Só uma cláusula dela é derrubada. A escolha por NoSQL orientado a documentos, por `@seald-io/nedb` e pelo acesso exclusivo do processo principal continua inteiramente em vigor. Se isso basta para marcar a ADR-0002 como *Substituído* ou se ela permanece *Proposto* com uma ressalva é decisão da equipe, não minha.

**Memória.** O NeDB carrega a base inteira em memória ao abrir. A própria ADR-0002 registra isso como risco e diz, textualmente, para reavaliar caso os dados cresçam além do esperado. Guardar texto de documentos **é** esse crescimento. É o momento previsto de reavaliação, e o desenho precisa responder por ele — não ignorá-lo.

**Cota do GitHub.** O inventário custa uma requisição por repositório; o conteúdo custa uma requisição por arquivo. É uma mudança de ordem de grandeza no consumo da cota, e a razão de a ingestão ser incremental, retomável e subordinada à busca interativa.

**Dependências novas.** A extração de texto de PDF, DOCX e XLSX exige bibliotecas. Todas devem ser JavaScript puro, sem módulo nativo — a mesma disciplina que levou o projeto a escolher NeDB em vez de SQLite, para não reintroduzir a etapa de recompilação para o Electron.

**Conflito com a mudança pendente.** `resumos-e-indice-por-ia` afirma no delta de `indice-local` que *"O índice NÃO SHALL armazenar o conteúdo dos documentos. O conteúdo é obtido quando necessário, usado, e descartado"*, e o design dela repete a afirmação. Esta mudança inverte isso. Como aquela ainda não foi implementada nem arquivada, seus artefatos são corrigidos junto com esta proposta, para que as duas não cheguem contraditórias ao arquivamento.

**Código:** `fontes/github.ts` (download de blob), `fontes/comum.ts`, um módulo novo de extração de texto, `banco/repositorio.ts` (coleção nova), a orquestração da ingestão no processo principal, e `ipc.ts` — que ganha o disparo da indexação e **nenhum canal que devolva conteúdo**.
