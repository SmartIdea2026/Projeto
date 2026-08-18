# Pesquisa e Decisões Tecnológicas — Âncora Dinâmico

## 1. Objetivo

O Âncora Dinâmico é uma aplicação interna com o objetivo de centralizar e facilitar a busca por documentos e informações distribuídos principalmente entre **GitHub** e **Google Drive**.

O sistema deverá permitir que o usuário realize uma pesquisa a partir de um texto, consulte fontes externas, localize arquivos relacionados, apresente os resultados e utilize **Inteligência Artificial (IA)** para gerar um breve resumo dos arquivos encontrados.

A pesquisa tecnológica busca definir:

- plataforma de execução: Web ou Desktop;
- tecnologias de frontend e backend;
- banco de dados;
- tecnologia de hospedagem;
- solução de IA;
- integração com GitHub e Google Drive;
- arquitetura geral da aplicação;
- limitações e custos das alternativas consideradas.

A arquitetura deve priorizar:

- baixo custo;
- simplicidade;
- rapidez de desenvolvimento;
- facilidade de manutenção;
- baixo número de tecnologias;
- segurança das credenciais;
- possibilidade de evolução futura.

Como o projeto possui orçamento limitado, foi priorizada uma arquitetura simples que aproveite as APIs já disponibilizadas pelo GitHub e pelo Google Drive, evitando a implementação inicial de um mecanismo próprio de indexação.

## 2. Plataforma: Web ou Desktop

Foram consideradas duas alternativas:

- aplicação Web utilizando React;
- aplicação Desktop utilizando React + Electron.

### 2.1 Aplicação Web

Na aplicação Web, o usuário acessa o sistema pelo navegador, sem necessidade de instalar um programa.

```text
Usuário
   ↓
Aplicação Web
   ↓
Backend
   ├── GitHub API
   ├── Google Drive API
   └── API de IA
````

**Pontos fortes:**

* desenvolvimento mais simples;
* não exige instalação;
* distribuição facilitada;
* atualização centralizada;
* boa integração com APIs Web;
* pode ser acessada por diferentes sistemas operacionais;
* menor complexidade de manutenção.

**Limitações:**

* depende de conexão com a Internet;
* possui menor integração nativa com o sistema operacional;
* acesso a arquivos locais é mais restrito pelo navegador.

### 2.2 Aplicação Desktop com Electron

Electron permite criar aplicações desktop utilizando tecnologias Web, incorporando Chromium e Node.js ao aplicativo e permitindo aplicações multiplataforma.

```text
React
  ↓
Electron
  ↓
Node.js
  ↓
APIs / Backend
```

**Pontos fortes:**

* permite criar aplicações desktop com tecnologias Web;
* maior acesso a recursos do sistema operacional;
* acesso mais direto a arquivos locais;
* possibilidade de distribuição para Windows, Linux e macOS;
* permite reaproveitar tecnologias JavaScript/TypeScript.

**Limitações:**

* exige instalação;
* distribuição e atualização são mais trabalhosas;
* adiciona uma camada tecnológica;
* aumenta a complexidade;
* não há necessidade atual de recursos específicos de desktop.

### 2.3 Decisão

Foi escolhida a **aplicação Web**.

O requisito principal é pesquisar conteúdos localizados no GitHub e no Google Drive, que já disponibilizam APIs para esse tipo de integração. Portanto, não existe atualmente uma necessidade técnica evidente de utilizar Electron.

O Electron poderá ser considerado futuramente caso surjam requisitos de acesso a arquivos locais, integração com o sistema operacional ou funcionamento como aplicativo instalado.

---

## 3. Arquiteturas consideradas

Foram analisadas duas abordagens principais.

### 3.1 Firebase + Cloud Functions

Nesta abordagem, o Firebase concentra grande parte da infraestrutura.

```text
React + Vite
     ↓
Firebase Hosting
     ↓
Cloud Functions
     ├── GitHub API
     ├── Google Drive API
     └── Gemini

Firestore
```

**Vantagens:**

* pouca infraestrutura para administrar;
* integração entre hospedagem, banco e backend;
* facilidade de autenticação;
* desenvolvimento rápido;
* possibilidade de evolução futura;
* menor quantidade de serviços externos.

**Desvantagens:**

* maior dependência do ecossistema Firebase;
* Cloud Functions adiciona uma camada serverless;
* exige associação do projeto a uma conta de faturamento;
* arquitetura serverless pode ser menos intuitiva para equipes acostumadas a backend tradicional.

### 3.2 Backend tradicional

Nesta abordagem, frontend e backend são aplicações separadas.

```text
React + Vite
     ↓
Vercel / Render
     ↓
Backend Node.js
     ├── Firestore / MongoDB
     ├── GitHub API
     ├── Google Drive API
     └── Gemini
```

**Vantagens:**

* maior controle sobre o backend;
* menor dependência do Firebase;
* facilita migração futura;
* possibilidade de utilizar Docker;
* frontend e backend podem ser desenvolvidos e testados localmente de maneira semelhante à produção;
* permite escolher diferentes tecnologias de backend.

**Desvantagens:**

* maior quantidade de configuração;
* necessidade de administrar o backend;
* frontend e backend são serviços separados;
* maior quantidade de componentes para acompanhar.

### 3.3 Comparação

| Característica                | Firebase + Functions | Backend tradicional  |
| ----------------------------- | -------------------- | -------------------- |
| Frontend                      | React/Vite           | React/Vite           |
| Backend                       | Cloud Functions      | Node.js              |
| Banco                         | Firestore            | Firestore ou MongoDB |
| Hospedagem                    | Firebase             | Vercel/Render        |
| Complexidade inicial          | Baixa                | Média                |
| Controle sobre backend        | Médio                | Alto                 |
| Dependência do Firebase       | Alta                 | Baixa                |
| Docker                        | Desnecessário        | Opcional             |
| Custo inicial                 | Baixo                | Baixo                |
| Facilidade de desenvolvimento | Alta                 | Alta                 |
| Flexibilidade futura          | Média/Alta           | Alta                 |

---

## 4. Banco de dados

Foram consideradas principalmente:

* **MongoDB**
* **Firebase Firestore**
* **Firebase Realtime Database**
* **Supabase**

Embora o Supabase não seja NoSQL — utiliza PostgreSQL — ele foi considerado como alternativa de backend/BaaS.

### 4.1 Firestore

O Firestore é um banco NoSQL orientado a documentos integrado ao ecossistema Firebase.

Pode armazenar:

* histórico de pesquisas;
* resultados;
* resumos gerados pela IA;
* cache;
* dados de usuários;
* configurações da aplicação.

**Pontos fortes:**

* integração direta com Firebase;
* estrutura baseada em documentos;
* fácil integração com aplicações Web;
* possibilidade de utilizar autenticação e outros serviços do Firebase;
* adequado para armazenar resultados e resumos;
* reduz a quantidade de serviços externos.

**Limitações:**

* modelo de consultas diferente de bancos relacionais;
* consultas complexas podem ser menos naturais que SQL;
* possui limites e cotas de utilização;
* podem existir custos quando as faixas sem custo forem ultrapassadas.

### 4.2 MongoDB Atlas

Banco NoSQL orientado a documentos.

**Pontos fortes:**

* estrutura flexível;
* boa integração com Node.js;
* ampla documentação;
* independência do Firebase;
* opção de uso gratuito.

**Limitações:**

* adiciona outro serviço à arquitetura;
* exige configuração da conexão com o backend;
* pode não trazer vantagem significativa para uma solução simples.

### 4.3 Firebase Realtime Database

Pode ser utilizado para dados em tempo real, mas não é a primeira escolha para o Âncora Dinâmico.

O modelo de documentos do Firestore é mais adequado às informações que a aplicação deverá armazenar.

### 4.4 Supabase

O Supabase é um Backend-as-a-Service baseado em PostgreSQL.

**Pontos fortes:**

* banco SQL completo;
* autenticação;
* APIs;
* armazenamento;
* boa experiência para desenvolvimento Web.

**Limitações:**

* não é NoSQL;
* adicionaria outro ecossistema ao projeto;
* não aproveitaria diretamente a infraestrutura Firebase.

### 4.5 Decisão

Foi escolhido o **Firebase Firestore**.

A escolha ocorreu principalmente porque o projeto também utiliza Firebase para hospedagem e backend serverless, permitindo centralizar parte significativa da infraestrutura.

---

## 5. Frontend

Foi escolhido:

**React + TypeScript**

### Motivos

* adequado para aplicações Web interativas;
* facilita a construção da interface de pesquisa e resultados;
* TypeScript proporciona tipagem estática;
* facilita o tratamento das respostas das APIs;
* possui grande ecossistema;
* permite desenvolvimento rápido;
* pode ser reaproveitado em uma aplicação Electron caso isso seja necessário futuramente.

### Interface conceitual

```text
┌───────────────────────────────────────────────┐
│ 🔎 Pesquisar arquivos...                     │
└───────────────────────────────────────────────┘

Filtros:
☑ GitHub
☑ Google Drive

────────────────────────────────────────────────

📄 auth_service.ts
GitHub

Resumo:
Serviço responsável pela autenticação...

[ Abrir arquivo ]

────────────────────────────────────────────────

📄 arquitetura.pdf
Google Drive

Resumo:
Documento contendo a arquitetura...
```

---

## 7. Backend

Foi escolhido:

**Node.js + TypeScript**

O backend será responsável por:

* receber pesquisas do frontend;
* consultar o GitHub;
* consultar o Google Drive;
* processar e normalizar os resultados;
* solicitar resumos à IA;
* controlar as credenciais das APIs;
* armazenar dados no Firestore;
* implementar cache;
* disponibilizar endpoints para o frontend.

Uma possível estrutura:

```text
backend/
├── src/
│   ├── controllers/
│   ├── services/
│   ├── routes/
│   ├── repositories/
│   ├── utils/
│   └── index.ts
├── package.json
└── tsconfig.json
```

### Framework HTTP

Foram consideradas alternativas como **Fastify** e **Express**.

A stack definida utiliza:

**Express.js**

O Fastify permanece como alternativa caso seja necessário utilizar uma implementação mais enxuta.

---

## 8. Integração com GitHub

O sistema utilizará a **GitHub API** para realizar as pesquisas, evitando a necessidade inicial de implementar um mecanismo próprio de indexação.

```text
Usuário pesquisa
       ↓
Backend
       ↓
GitHub API
       ↓
Resultados
       ↓
Normalização
       ↓
Frontend
```

A API possui limites de requisição, incluindo limites específicos para endpoints de pesquisa e limites secundários.

O backend deverá:

* tratar erros de rate limit;
* evitar chamadas desnecessárias;
* controlar a frequência das requisições;
* normalizar os resultados recebidos.

### Autenticação

Podem ser utilizados:

* Personal Access Token;
* Fine-grained Personal Access Token;
* OAuth, caso necessário;
* GitHub REST API;
* GitHub GraphQL API caso seja necessária maior flexibilidade.

---

## 9. Integração com Google Drive

O sistema utilizará a **Google Drive API** para pesquisar arquivos.

A API permite consultas por:

* nome;
* tipo;
* data;
* conteúdo.

Um recurso relevante para o projeto é o operador:

```text
fullText contains 'autenticação'
```

Esse recurso permite pesquisar conteúdo textual dos arquivos.

### Fluxo

```text
Usuário pesquisa
       ↓
Backend
       ↓
Google Drive API
       ↓
Resultados
       ↓
Normalização
       ↓
Frontend
```

A API possui cotas de utilização que devem ser consideradas durante a implementação.

### Autenticação

Podem ser utilizados:

* OAuth 2.0;
* Service Account, dependendo do ambiente.

---

## 10. Inteligência Artificial

### Solução escolhida

**Gemini API**

Foi escolhida uma solução da linha Gemini Flash para a tarefa de sumarização.

### Motivos

* disponibilidade de faixa gratuita para determinados modelos;
* modelos adequados para geração de resumos;
* API própria para integração com aplicações;
* integração simples com backend Node.js;
* compatibilidade com o ecossistema Google.

A IA **não será utilizada inicialmente para localizar os arquivos**.

O mecanismo será:

```text
Pesquisa
   ↓
GitHub API + Google Drive API
   ↓
Resultados
   ↓
Solicitação de resumo
   ↓
Gemini API
   ↓
Resumo
```

Essa abordagem evita enviar arquivos desnecessariamente à IA.

Os limites da Gemini API variam conforme o modelo e o nível de utilização e devem ser considerados durante a implementação.

---

## 11. Cache dos resumos

Para reduzir chamadas repetidas à IA, os resumos poderão ser armazenados no Firestore.

```text
Solicitação de resumo
        ↓
   Já existe?
    ↙       ↘
  SIM       NÃO
   ↓         ↓
Firestore  Gemini
    ↘       ↙
     Resultado
```

Assim, o mesmo arquivo não precisa necessariamente ser enviado à IA novamente.

---

## 12. Hospedagem

A solução utiliza o **Firebase** como ecossistema de infraestrutura.

### Frontend

**Firebase Hosting**

Responsável pela hospedagem da aplicação Web, oferecendo recursos como HTTPS e CDN.

### Backend

**Firebase Cloud Functions**, executando Node.js + TypeScript, preferencialmente na segunda geração.

```text
React + TypeScript
        ↓
Firebase Hosting
        ↓
Cloud Functions
        ↓
Node.js + TypeScript
```

### Modelo serverless

O backend não funciona como um servidor Node.js tradicional permanentemente ativo.

Ele é executado como uma função quando recebe uma requisição:

```text
Requisição
    ↓
Cloud Function
    ↓
Node.js executa
    ↓
Processamento
    ↓
Resposta
```

Esse modelo é adequado às operações previstas:

* pesquisar no GitHub;
* pesquisar no Google Drive;
* solicitar resumo;
* consultar o Firestore.

### Custo

Para utilizar Cloud Functions, o projeto precisa utilizar o **plano Blaze**, que exige uma conta de faturamento.

Isso não significa necessariamente cobrança. Existem cotas sem custo no Blaze, mas pode haver cobrança quando os limites forem ultrapassados.

Durante o desenvolvimento, devem ser monitorados:

* consumo;
* quotas;
* orçamento;
* chamadas às APIs.

---

## 13. Segurança

As credenciais das APIs não devem ser armazenadas no frontend.

### Incorreto

```text
React
  ↓
API Keys / Tokens
```

### Correto

```text
React
  ↓
Cloud Function
  ↓
API externa
```

As credenciais devem permanecer no backend e/ou em mecanismos apropriados de gerenciamento de segredos.

A autenticação e autorização para GitHub e Google Drive devem utilizar mecanismos adequados, preferencialmente OAuth quando aplicável, evitando solicitar tokens diretamente ao usuário pela interface.

---

## 14. Busca

Na primeira versão, não é necessário utilizar Elasticsearch, OpenSearch ou outro mecanismo especializado de busca.

A pesquisa poderá utilizar diretamente as APIs das fontes.

Os resultados podem considerar:

* título;
* conteúdo;
* categoria;
* origem;
* palavras-chave.

Busca semântica e embeddings poderão ser adicionados posteriormente.

```text
Usuário
   ↓
Pesquisa
   ↓
GitHub / Google Drive
   ↓
Resultados
```

---

## 15. Ferramentas recomendadas por categoria

| Categoria           | Escolha principal              | Alternativas              |
| ------------------- | ------------------------------ | ------------------------- |
| Frontend            | React + Vite                   | Vue, Svelte               |
| Backend             | Node.js + TypeScript + Express | Fastify, FastAPI          |
| Banco NoSQL         | Firestore                      | MongoDB Atlas             |
| Hospedagem frontend | Firebase Hosting               | Vercel, Render, Netlify   |
| Hospedagem backend  | Firebase Cloud Functions       | Render, Railway, Fly.io   |
| IA                  | Gemini                         | OpenAI                    |
| GitHub              | GitHub REST API                | GitHub GraphQL API        |
| Google Drive        | Google Drive API               | —                         |
| Prototipação        | Figma                          | —                         |
| Controle de versão  | GitHub                         | —                         |
| Documentação        | Markdown                       | GitHub Wiki, GitHub Pages |
| Testes              | Vitest, React Testing Library  | Playwright                |

---

## 16. Tecnologias não necessárias inicialmente

Para evitar overengineering, não são necessárias inicialmente:

* PostgreSQL;
* Redis;
* Elasticsearch;
* OpenSearch;
* Kafka;
* Kubernetes;
* microsserviços;
* arquitetura distribuída;
* infraestrutura cloud complexa;
* banco vetorial;
* sistema avançado de RAG;
* Docker, caso o ambiente de hospedagem execute o backend diretamente.

Essas tecnologias poderão ser avaliadas futuramente caso surjam novos requisitos.

---

## 17. Arquitetura final

A arquitetura definida para a solução é:

```text
                         ┌───────────────┐
                         │    USUÁRIO    │
                         └───────┬───────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │   React + TypeScript   │
                    │       FRONTEND         │
                    └───────────┬────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │    Firebase Hosting    │
                    └───────────┬────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │   Cloud Functions      │
                    │ Node.js + TypeScript   │
                    │        BACKEND         │
                    └──────┬────┬────┬────────┘
                           │    │    │
              ┌────────────┘    │    └────────────┐
              ▼                 ▼                 ▼
       ┌────────────┐   ┌──────────────┐   ┌───────────┐
       │ GitHub API │   │ Google Drive │   │ Gemini API│
       └────────────┘   │     API      │   └───────────┘
                        └──────┬───────┘
                               │
                               ▼
                        ┌────────────┐
                        │ Firestore  │
                        │ Histórico  │
                        │ Cache      │
                        │ Resumos    │
                        └────────────┘
```

---

## 18. Comparativo das principais alternativas

| Área                | Escolha                            | Alternativas consideradas            | Motivo principal                                            |
| ------------------- | ---------------------------------- | ------------------------------------ | ----------------------------------------------------------- |
| Plataforma          | **Web + React**                    | React + Electron                     | Menor complexidade e fácil distribuição                     |
| Banco               | **Firestore**                      | MongoDB, Supabase, Realtime Database | Integração com o ecossistema Firebase                       |
| Backend             | **Node.js + TypeScript + Express** | Fastify, FastAPI                     | Mesma linguagem principal do frontend                       |
| Hospedagem frontend | **Firebase Hosting**               | Vercel, Render, Netlify              | Integração com Firebase                                     |
| Hospedagem backend  | **Cloud Functions**                | Render, Railway, Fly.io              | Integração com Firebase e execução sob demanda              |
| IA                  | **Gemini API**                     | OpenAI                               | Adequação à sumarização e disponibilidade de faixa gratuita |
| GitHub              | **GitHub REST API**                | GraphQL API                          | Atende às necessidades iniciais                             |
| Google Drive        | **Google Drive API**               | —                                    | API oficial para pesquisa dos arquivos                      |

---

## 19. Stack tecnológica definida

| Camada                  | Tecnologia                      |
| ----------------------- | ------------------------------- |
| Interface               | React                           |
| Build                   | Vite                            |
| Linguagem               | TypeScript                      |
| Backend                 | Node.js                         |
| Framework HTTP          | Express.js                      |
| Hospedagem frontend     | Firebase Hosting                |
| Hospedagem backend      | Firebase Cloud Functions        |
| Banco de dados          | Cloud Firestore                 |
| Autenticação            | Firebase Authentication / OAuth |
| Pesquisa GitHub         | GitHub API                      |
| Pesquisa Google Drive   | Google Drive API                |
| Inteligência Artificial | Gemini API                      |
| Cache de resumos        | Firestore                       |
| Prototipação            | Figma                           |
| Controle de versão      | GitHub                          |
| Documentação            | Markdown                        |
| Testes                  | Vitest / React Testing Library  |

---

## 20. Estratégia de desenvolvimento

Para reduzir riscos e facilitar a implementação, o desenvolvimento poderá ser dividido em etapas.

### Etapa 1 — Pesquisa no GitHub

```text
React
  ↓
Backend
  ↓
GitHub API
  ↓
Resultados
```

### Etapa 2 — Pesquisa no Google Drive

```text
React
  ↓
Backend
  ├── GitHub API
  └── Google Drive API
        ↓
Resultados unificados
```

### Etapa 3 — Resumos com IA

```text
Resultado
   ↓
Solicitação de resumo
   ↓
Gemini API
   ↓
Resumo
```

### Etapa 4 — Persistência e otimização

Adicionar:

* histórico de pesquisas;
* armazenamento de resumos;
* cache;
* autenticação;
* filtros;
* tratamento de erros;
* controle de rate limits.

---

## 21. Decisão final

A solução definida para o projeto é:

> **Uma aplicação Web desenvolvida em React + TypeScript, com backend Node.js + TypeScript executado em Firebase Cloud Functions, Firestore como banco NoSQL, Firebase Hosting para o frontend, integração com GitHub API e Google Drive API e Gemini API para geração dos resumos.**

A aplicação Web foi escolhida por apresentar menor complexidade de desenvolvimento e distribuição em comparação com uma aplicação desktop.

O **Firebase** foi escolhido como ecossistema de infraestrutura para reduzir a quantidade de serviços externos. O Firestore será utilizado para persistência, histórico e cache, enquanto o Firebase Hosting hospedará o frontend e o Cloud Functions executará o backend.

O principal ponto de atenção financeiro é que **Cloud Functions exige o plano Blaze**, embora existam cotas sem custo. O consumo, as quotas e o orçamento devem ser monitorados durante o desenvolvimento.

A **Gemini API** foi definida como solução inicial de IA para sumarização. Seus limites de uso deverão ser considerados durante a implementação.

A arquitetura poderá ser revisada conforme os resultados obtidos e o surgimento de novos requisitos.

---

## 22. Fontes principais

* Firebase Pricing: [https://firebase.google.com/pricing](https://firebase.google.com/pricing)
* Firebase Hosting: [https://firebase.google.com/docs/hosting](https://firebase.google.com/docs/hosting)
* Firebase Cloud Functions: [https://firebase.google.com/docs/functions](https://firebase.google.com/docs/functions)
* Firebase App Hosting: [https://firebase.google.com/docs/app-hosting](https://firebase.google.com/docs/app-hosting)
* Gemini API Pricing: [https://ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing)
* Gemini API Rate Limits: [https://ai.google.dev/gemini-api/docs/rate-limits](https://ai.google.dev/gemini-api/docs/rate-limits)
* GitHub REST API Rate Limits: [https://docs.github.com/rest/using-the-rest-api/rate-limits-for-the-rest-api](https://docs.github.com/rest/using-the-rest-api/rate-limits-for-the-rest-api)
* Google Drive API — Pesquisa de arquivos: [https://developers.google.com/workspace/drive/api/guides/search-files](https://developers.google.com/workspace/drive/api/guides/search-files)
* Google Drive API — Limites de uso: [https://developers.google.com/workspace/drive/api/guides/limits](https://developers.google.com/workspace/drive/api/guides/limits)
* Electron Documentation: [https://www.electronjs.org/docs/latest/](https://www.electronjs.org/docs/latest/)

```
