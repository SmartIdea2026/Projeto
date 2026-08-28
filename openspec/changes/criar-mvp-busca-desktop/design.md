# Design — MVP de busca de documentos (aplicação desktop)

**Issue:** #65
**Data:** 27/08/2026

## 1. Arquitetura geral

A aplicação é executada inteiramente no cliente. Não há servidor próprio.

```text
┌─────────────────────────────────────────────┐
│                  ELECTRON                   │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │   RENDERER  (React + TypeScript)      │  │
│  │   Interface, estado de tela, filtros  │  │
│  │   NUNCA recebe nem armazena chaves    │  │
│  └───────────────────┬───────────────────┘  │
│                      │ IPC (contextBridge)  │
│  ┌───────────────────▼───────────────────┐  │
│  │   MAIN  (Node.js + TypeScript)        │  │
│  │   Credenciais, chamadas HTTP, cache,  │  │
│  │   normalização, banco local           │  │
│  └───┬───────────────┬───────────────┬───┘  │
└──────┼───────────────┼───────────────┼──────┘
       ▼               ▼               ▼
       GitHub API              Banco NoSQL local
```

**Princípio central:** todo acesso a credencial e a rede acontece no processo *main*. O *renderer* comunica-se apenas por IPC tipado e recebe somente resultados já normalizados. Isso mantém a intenção da seção 13 do documento de pesquisa tecnológica — credenciais fora da camada de interface — mesmo sem um backend remoto.

## 2. Integração com o GitHub

### 2.1 Verificação realizada

As alternativas foram testadas contra a API real em 27/08/2026, na conta `SmartIdea2026`:

| Chamada | Resultado |
| --- | --- |
| `GET /orgs/SmartIdea2026/events` | **404** — a conta é do tipo `User`, não organização |
| `GET /repos/{o}/{r}/events` | Retorna 30 eventos, dos quais 21 são `IssuesEvent` e apenas 5 `PushEvent` |
| `payload` de um `PushEvent` | Contém apenas `before`, `head`, `push_id`, `ref`, `repository_id` — **sem lista de commits** |
| `GET /repos/{o}/{r}/commits` | Não inclui o campo `files` |
| `GET /repos/{o}/{r}/git/trees/{branch}?recursive=1` | **34 arquivos, 19 documentos, `truncated: false`, em uma única chamada** |

**Conclusão:** a Events API não serve para identificar arquivos alterados. A árvore Git resolve o inventário completo em uma requisição.

### 2.2 Estratégia adotada

**Busca por nome (RF01, RF02):**

```text
GET /users/{owner}/repos                      → lista de repositórios (1 chamada)
GET /repos/{o}/{r}/git/trees/{branch}?recursive=1 → inventário completo (1 chamada por repositório)
                                              → filtragem por nome e extensão em memória
```

Essa abordagem evita a Search API de código, que exige autenticação, cobre apenas conteúdo indexado e possui limites secundários agressivos.

**Documentos recentes (rotina de inicialização):**

```text
GET /repos/{o}/{r}/commits?per_page=30        → commits recentes com datas (1 chamada)
GET /repos/{o}/{r}/commits/{sha}              → arquivos alterados (para os ~10 mais recentes)
```

O resultado é persistido em cache local e reutilizado entre execuções, com revalidação por `ETag`.

### 2.3 Limitação conhecida

`GET /users/{owner}/repos` retorna **apenas repositórios públicos**. Se a conta `SmartIdea2026` possuir repositórios privados, eles não aparecerão por esse caminho. Nesse caso será necessário usar `GET /user/repos?affiliation=...` com o token do próprio usuário. Atualmente a conta possui 1 repositório público.

## 3. Integração com o Google Drive — removida do MVP

O Drive foi implementado por completo e retirado do escopo pela **ADR-0004**, antes de ser verificado contra uma conta real. O motivo não é de implementação: o escopo `drive.readonly` é classificado como **restrito** pelo Google, o que impõe avaliação de segurança CASA para publicar o aplicativo, ou expiração do *refresh token* a cada 7 dias enquanto o projeto permanecer em modo *Testing*.

A retomada depende de a instituição possuir Google Workspace, caso em que a tela de consentimento pode ser configurada como *Internal* e nenhuma das duas restrições se aplica. O código permanece recuperável no commit `0d6e6e8`.

## 4. Normalização dos resultados

As fontes convergem para um mesmo formato antes de chegar ao renderer. O formato foi desenhado para duas fontes e permanece assim com uma, porque é ele que torna barato acrescentar a próxima:

```ts
type Documento = {
  id: string;
  nome: string;
  extensao: string;
  fonte: Fonte;              // união de fontes; hoje só 'github'
  dataModificacao: string;   // ISO 8601 — campo canônico de ordenação
  dataCriacao?: string;      // ausente no GitHub
  link: string;              // URL de redirecionamento para a fonte original
};
```

**Decisão sobre datas:** `dataModificacao` é o campo canônico. O RF10 menciona data de criação, mas o GitHub não expõe data de criação por arquivo de forma barata, e a funcionalidade de recentes depende da data de modificação. `dataCriacao` é exibida apenas quando a fonte a fornece.

## 5. Tipos de documento aceitos

Conforme a ata de 24/08/2026: `.md`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.pdf`, `.epub`, `.txt`.

Arquivos de código-fonte e de configuração são excluídos, o que diverge do protótipo visual, no qual aparece um resultado `.json`.

## 6. Credenciais

**GitHub:** token informado em campo na tela de configurações, enviado ao processo *main* por IPC e **nunca** mantido no estado do renderer. Validado por `GET /user` antes de ser gravado.

O Drive exigia um desenho assimétrico — OAuth 2.0 com PKCE e redirecionamento em *loopback*, porque uma chave de API autentica o *projeto* e não o *usuário*. Saiu com a fonte (ADR-0004), e com ele a assimetria: no MVP há uma credencial, de um tipo só.

A credencial é persistida com `safeStorage`, que delega a proteção ao chaveiro do sistema operacional.

Detalhamento e alternativas descartadas em `Docs/ADR/ADR-0003-gerenciamento-credenciais-api.md`.

## 7. Persistência local

Banco NoSQL orientado a documentos (`@seald-io/nedb`), acessado pelo processo *main*. O modelo de documentos é o mesmo da escolha original pelo Firestore, o que mantém viável uma eventual volta à nuvem sem redesenhar a camada de dados.

**Coleção `documentos_acessados`:**

```js
{
  _id: 'github:SmartIdea2026/Projeto:Docs/ADR/ADR-0001.md',
  nome: 'ADR-0001.md',
  fonte: 'github',
  link: 'https://github.com/…',
  acessadoEm: '2026-08-27T18:20:00.000Z',
  resumo: undefined,      // reservado para a IA
  resumoEm: undefined
}
```

**Coleção `cache_fontes`:**

```js
{
  _id: 'github:tree:SmartIdea2026/Projeto:main',
  etag: 'W/"abc123"',
  payload: { /* resposta da API */ },
  atualizadoEm: '2026-08-27T18:20:00.000Z'
}
```

Somente o **link de redirecionamento** é armazenado — nunca o conteúdo dos documentos. Os campos de resumo existem desde já para que a inclusão futura da IA não exija migração; por ser um banco sem esquema fixo, essa inclusão não altera os registros existentes.

Todo o acesso ao banco está concentrado em `src/main/banco/indice.ts`, de modo que substituir o armazenamento afete apenas esse módulo.

## 8. Controle de limites de requisição

- Cache local com revalidação por `ETag` em todas as chamadas ao GitHub.
- Resultado da rotina de inicialização exibido imediatamente a partir do cache; atualização ocorre em segundo plano.
- Requisições por repositório executadas com limite de concorrência.
- Tratamento explícito de HTTP 403 e 429, com mensagem ao usuário conforme CB07.

## 9. Estrutura de pastas prevista

```text
AncorAI/
├── src/
│   ├── main/
│   │   ├── index.ts        ciclo de vida
│   │   ├── janela.ts       criação da janela
│   │   ├── ipc.ts          canais expostos ao renderer
│   │   ├── busca/          orquestração e regras de filtro
│   │   ├── fontes/         github.ts
│   │   ├── credenciais/    cofre e validação
│   │   └── banco/          repositório NoSQL local
│   ├── preload/
│   ├── renderer/
│   │   ├── componentes/
│   │   ├── telas/
│   │   └── estilos/        folhas por área da interface
│   └── compartilhado/
├── test/                   busca, fontes, persistência, segurança
├── package.json
└── tsconfig.json
```

## 10. Identidade visual

Extraída do protótipo. Os valores devem ser confirmados no Figma antes da implementação.

| Elemento | Valor aproximado |
| --- | --- |
| Fundo da aplicação | Creme quente `#F4F2EA` |
| Cor primária | Verde escuro `#14432F` |
| Cor de destaque | Verde médio `#2E7A5A` |
| Superfícies | Branco, raio de 16px, borda fina, sombra suave |
| Campo de busca e filtros | Formato pílula, totalmente arredondado |
| Tipografia | Sans geométrica (Poppins ou equivalente) |

**Pontos de acessibilidade a verificar:**

1. O subtítulo em verde acinzentado e as etiquetas em maiúsculas (`PRODUTO`, `FRONTEND`) sobre o fundo creme precisam ser medidos: são pequenas e de baixo contraste, e podem não atingir a proporção de 4.5:1.
2. As etiquetas de fonte GitHub e Google Drive usam a mesma cor verde, distinguindo-se apenas pelo ícone. Como a fonte é uma dimensão primária de leitura, a distinção não deve depender apenas de cor.

## 11. Ajuste de layout em relação ao protótipo

O painel lateral direito de resumo por IA é removido. Os resultados passam a ocupar a largura total.

A rotina de documentos recentes ocupa a própria área de resultados quando o campo de busca está vazio, sem exigir uma nova região de layout: ao digitar, a lista de recentes é substituída pelos resultados da busca.
