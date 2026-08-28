# AGENTS.md — Guia para agentes de IA no projeto Âncora

Este documento reúne os padrões vigentes do repositório para que qualquer agente de IA trabalhe de forma coerente com as decisões já tomadas pela equipe. Ele não substitui os documentos de processo em `Docs/Organizacao/Processo/`; resume o que é obrigatório e aponta para a fonte de cada regra.

## 1. Regras que não podem ser violadas

1. **Nunca abrir um Pull Request sem consultar a equipe antes.** Prepare a branch e os commits, descreva o que foi feito e aguarde autorização explícita. Uma autorização vale para um PR específico e não se estende aos seguintes.
2. **Sempre versionar a pasta `openspec/`.** Os artefatos de planejamento entram no repositório para que a equipe os revise junto do código.
3. **Nunca gravar credenciais em texto legível** nem expô-las à camada de interface. Ver seção 6.
4. **Nunca adotar banco relacional.** A persistência do projeto é NoSQL, orientada a documentos.
5. **Nunca sobrescrever silenciosamente uma decisão de arquitetura.** Registre uma ADR. Ver seção 4.
6. **Sempre manter o `README.md` atualizado e coerente com o estado real do sistema.** Toda mudança que altere comportamento observável, comandos de uso, estrutura de pastas ou requisitos de configuração atualiza o README **na mesma entrega**, nunca em tarefa posterior. O README é a porta de entrada de quem clona o repositório: desatualizado, ele faz um integrante novo executar comandos que não existem mais, procurar pastas que mudaram de lugar, ou concluir que o sistema está quebrado quando apenas o texto envelheceu.

## 2. Contexto do projeto

O **AncorAI** (também chamado Âncora) é uma aplicação **desktop** que centraliza a busca de documentos do projeto. Serve para contextualizar novos integrantes, localizar documentos de processo e acompanhar o que os stakeholders produziram recentemente.

O MVP integra o **GitHub**. O **Google Drive** estava no escopo e foi retirado pela ADR-0004 — a arquitetura permanece multi-fonte, então trate `Fonte` como uma união que voltará a ter mais de um membro.

O código da aplicação fica em `AncorAI/`. A documentação fica em `Docs/`.

> **Atenção:** `Docs/Pesquisas/TecnologiasDesenvolvimentoAncorAI.md` descreve uma arquitetura **Web com Firebase** que **não é mais vigente**. As seções 2.3, 4.5, 12, 13, 17 e 21 foram superadas pelas ADRs 0001, 0002 e 0003. Consulte as ADRs antes daquele documento.

## 3. Padrão de commits

Definido em `Docs/Organizacao/Processo/PadronizacaoDeCommit.md`. Estrutura obrigatória:

```text
<tipo>(<escopo opcional>): <descrição breve>

<corpo obrigatório>

Refs: #<número da issue>
```

* **Tipos permitidos:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`.
* A **descrição** é curta, em verbo no infinitivo, sem ponto final.
* O **corpo é obrigatório**, mesmo em alterações simples, e explica o que mudou e por quê.
* Toda mensagem termina com `Refs: #<issue>` ou `Close: #<issue>`.
* Commits são separados por natureza: não misture documentação e implementação no mesmo commit.

### Títulos de Pull Request

* O título segue o mesmo padrão de um commit: `<tipo>(<escopo>): <descrição>`.
* **Não acrescente numeração ao título.** A única referência numérica é a issue em tratamento, informada no corpo com `Refs:` ou `Close:`. O número exibido no Pull Request é atribuído automaticamente pelo GitHub.

## 4. Decisões de arquitetura (ADR)

Processo em `Docs/ADR/TemplatesADR/ProcessoRegistroDecisoesArquitetura.md`; template em `TemplateExemploADR.md`.

* Arquivos nomeados `ADR-0000-titulo-curto.md`, em `Docs/ADR/`, com numeração sequencial.
* Seções obrigatórias: Status, Data, Contexto/Problema, Decisão Tomada, Justificativa, Alternativas Consideradas, Consequências, Referências.
* Status possíveis: `Proposto`, `Aceito`, `Rejeitado`, `Substituído`.
* Exige ADR toda decisão que altere tecnologia relevante, estrutura do sistema, integração, segurança, persistência ou deploy.
* Ao substituir uma decisão vigente, **crie uma nova ADR** referenciando a anterior — nunca reescreva o histórico. Uma ADR ainda `Proposto` e não mergeada pode ser corrigida no lugar.
* Cite nominalmente as seções dos documentos que a decisão supera.
* Decisões vigentes: **ADR-0001** desktop com Electron; **ADR-0002** persistência NoSQL local; **ADR-0003** credenciais pela interface; **ADR-0004** remoção do Google Drive do MVP.

### ADRs vigentes

| ADR | Decisão | Supera |
| --- | --- | --- |
| 0001 | Aplicação desktop com Electron | Pesquisa §2.3, §21 |
| 0002 | Banco NoSQL local no lugar do Firebase | Pesquisa §4.5, §12, §17 |
| 0003 | Credenciais configuradas pela interface | Pesquisa §13, RNF02 |

## 5. Fluxo OpenSpec

Processo em `Docs/Organizacao/Processo/OpenSpec/ProcessoArquiteturaOpenSpec.md` e `ProcessoRegistroUX.md`.

```text
Proposal → Specs → Design → Tasks → Implementação → Archive
```

* Comandos: `/opsx:propose`, `/opsx:apply`, `/opsx:archive`.
* Estrutura: `openspec/changes/<mudanca>/` com `proposal.md`, `specs/<dominio>/spec.md`, `design.md` e `tasks.md`.
* **A pasta `openspec/` é versionada.** Os artefatos acompanham o código no Pull Request, porque são eles que explicam por que a implementação ficou como ficou.
* **Specs descrevem comportamento observável** em `SHALL` com cenários `GIVEN / WHEN / THEN`. Nunca citam biblioteca, tabela ou classe — isso pertence ao `design.md`.
* Specs de UX registram deltas explícitos: **ADDED**, **MODIFIED** e **REMOVED**.
* Estados de interface são obrigatórios e não inferidos: *default*, *hover*, *focus*, *loading*, *empty* e *error*.
* Só marque uma tarefa como concluída quando o comportamento especificado estiver **integralmente** implementado. Tarefas parciais permanecem abertas, com nota explicando o que falta.

## 6. Arquitetura da aplicação

```text
┌─────────────────────────────────────────┐
│ RENDERER (React + TypeScript)           │
│ Interface. NUNCA vê credenciais.        │
└──────────────────┬──────────────────────┘
                   │ IPC (contextBridge)
┌──────────────────▼──────────────────────┐
│ MAIN (Node + TypeScript)                │
│ Credenciais, rede, cache, banco NoSQL   │
└───┬──────────────┬──────────────┬───────┘
    ▼              ▼              ▼
    GitHub API              Banco local
```

### Regras de segurança

* Toda chamada de rede e todo acesso a segredo ocorrem no processo **main**.
* Nenhum canal IPC devolve o valor de uma credencial — apenas o **estado** da conexão. Há teste automatizado garantindo isso em `AncorAI/test/seguranca/fronteira-credenciais.test.ts`.
* Credenciais são cifradas com `safeStorage`, que usa o chaveiro do sistema operacional. Se a cifragem não estiver disponível, **falhe de forma explícita** em vez de gravar em texto plano.
* `contextIsolation: true` e `nodeIntegration: false` são obrigatórios.

### Integrações

* **GitHub:** o inventário de documentos vem da **árvore Git** (`git/trees?recursive=1`), que devolve o repositório inteiro em uma requisição. A Events API **não serve** para descobrir arquivos alterados — o `payload` de `PushEvent` não traz a lista de commits. Use cache revalidado por `ETag` e trate HTTP 403 e 429.
* **Google Drive:** fora do MVP (ADR-0004). Exigiria **OAuth 2.0** — uma chave de API autentica o projeto, não o usuário — e o escopo `drive.readonly` é restrito pelo Google.
* Falha de uma fonte **nunca** impede a apresentação dos resultados das demais.
* **Resultado parcial é dito, não escondido.** Paginação além do teto, árvore truncada e repositório inacessível viram `avisos` — canal separado de `falhas`, porque houve resultado. Nunca engula uma dessas condições em `catch`.
* **Data do GitHub na busca é aproximada.** A árvore Git não traz data por arquivo, então todo documento herda o `pushed_at` do repositório e carrega `dataAproximada: true`. A lista de recentes vem dos commits e tem data real. O filtro de período avisa quando incide sobre datas aproximadas.

### Persistência

Banco NoSQL orientado a documentos, no processo main, isolado em um único módulo. Armazena apenas o **link de redirecionamento** dos documentos acessados — **nunca o conteúdo**. Os campos de resumo já existem, reservados para a IA futura.

## 7. Convenções de código

* **Idioma:** identificadores, comentários e mensagens de interface em **português**. Termos técnicos consagrados permanecem em inglês.
* **TypeScript estrito**, com `noUncheckedIndexedAccess` ativo.
* **Comentários explicam o porquê**, não o quê. Comente decisões não óbvias e armadilhas; não narre o que o código já diz.
* **Testes** com Vitest, em `AncorAI/test/`. Cubra os cenários de erro, não apenas o caminho feliz.
* Antes de concluir: `npx tsc --noEmit` nos dois projetos, `npx vitest run` e `npx electron-vite build`.

## 8. Organização do repositório

Definido em `Docs/Organizacao/Processo/PadronizacaoDeRepositorio.md`.

* Pastas e arquivos de documentação em **PascalCase** — `LevantamentoRequisitos.md`, não `levantamento_requisitos.md`.
* `README.md` e estruturas do GitHub (`.github`, `ISSUE_TEMPLATE`) são exceções.
* Ferramentas que exigem nome próprio, como `openspec/`, mantêm o nome exigido.
* Evite arquivos soltos na raiz quando houver pasta adequada.
* Atualize o `README.md` quando a estrutura mudar de forma relevante.

## 9. Escopo adiado

Não implemente sem decisão da equipe:

* **Resumos por IA** (RF13–RF19, RN12–RN21) — adiados, mas o banco já reserva os campos.
* **Autenticação, login e perfil** — fora de escopo.
* **Busca por conteúdo (full-text)** — issues #49 e #55.
* **Autor nos resultados** — custo de uma requisição adicional por arquivo no GitHub.

## 10. Referências

| Assunto | Documento |
| --- | --- |
| Commits | `Docs/Organizacao/Processo/PadronizacaoDeCommit.md` |
| Organização | `Docs/Organizacao/Processo/PadronizacaoDeRepositorio.md` |
| ADR | `Docs/ADR/TemplatesADR/ProcessoRegistroDecisoesArquitetura.md` |
| OpenSpec | `Docs/Organizacao/Processo/OpenSpec/ProcessoArquiteturaOpenSpec.md` |
| UX no OpenSpec | `Docs/Organizacao/Processo/OpenSpec/ProcessoRegistroUX.md` |
| Requisitos | `Docs/Requisitos/LevantamentoRequisitosFluxo.md` |
| Especificação vigente | `Docs/Requisitos/EspecificacaoSistemaAncorAI.md` |
