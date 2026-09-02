# Especificação do Sistema e Fluxo — AncorAI

**Versão:** 1.0 (MVP)
**Data:** 27/08/2026
**Issue de origem:** #65

## Introdução

Este documento especifica o sistema **AncorAI** conforme implementado no MVP. Ele descreve a arquitetura, o comportamento observável, os fluxos de uso e as regras vigentes.

Complementa `LevantamentoRequisitosFluxo.md`, que registra o levantamento original. Onde os dois divergirem, **este documento descreve o sistema como ele é**, e o levantamento descreve o que foi planejado antes das decisões registradas nas ADRs 0001, 0002 e 0003.

## 1. Visão geral

O AncorAI é uma aplicação **desktop** de uso interno que centraliza a busca de documentos do projeto. O MVP integra o **GitHub**; o **Google Drive** foi retirado do escopo pela ADR-0004, e a arquitetura permanece preparada para múltiplas fontes.

Resolve três problemas:

| Problema | Como o sistema resolve |
| --- | --- |
| Contextualização lenta de novos integrantes | Busca única sobre as duas fontes, sem precisar saber onde o documento está |
| Dificuldade de localizar processos | Filtros por tipo, fonte e período sobre o nome dos documentos |
| Baixa visibilidade da produção documental | Lista de documentos modificados recentemente, apresentada na abertura |

### Delimitação

O sistema **não** armazena documentos: ele localiza e redireciona à fonte original. Não há login, cadastro nem perfil — a instalação delimita o usuário.

## 2. Arquitetura

A aplicação executa inteiramente no cliente. Não há servidor próprio.

```text
                    ┌──────────────────────────────┐
                    │   RENDERER                   │
                    │   React + TypeScript         │
                    │   Interface e estado de tela │
                    │   Não acessa credenciais     │
                    └──────────────┬───────────────┘
                                   │ IPC tipado
                                   │ (contextBridge)
                    ┌──────────────▼───────────────┐
                    │   MAIN                       │
                    │   Node.js + TypeScript       │
                    │   Credenciais, rede, cache   │
                    └───┬───────────┬───────────┬──┘
                        │           │           │
              ┌─────────▼──┐  ┌─────▼──────┐  ┌─▼──────────┐
              │ GitHub API │  │ Banco NoSQL│              
              └────────────┘  └────────────┘  │   local    │
                                              └────────────┘
```

### Camadas

| Camada | Responsabilidade |
| --- | --- |
| Renderer | Apresentação, filtros de tela, estados visuais |
| Preload | Fronteira tipada entre renderer e main |
| Main | Credenciais, requisições, normalização, cache, persistência |

### Stack

| Item | Tecnologia |
| --- | --- |
| Plataforma | Electron (ADR-0001) |
| Interface | React + TypeScript |
| Build | electron-vite |
| Persistência | Banco NoSQL de documentos, local (ADR-0002) |
| Testes | Vitest |
| Distribuição | electron-builder |

## 3. Fluxo principal

### 3.1 Abertura da aplicação

```text
Aplicação inicia
        ↓
Apresenta a lista guardada da execução anterior, se houver
        ↓
Verifica o estado das credenciais
        ↓
   ┌────────────────────────┐
   │ Alguma fonte conectada?│
   └───────────┬────────────┘
          SIM  │  NÃO
           ↓   │   ↓
   Consulta os │  Orienta a configurar
   recentes em │  as credenciais
   cada fonte  │
           ↓   │
   Atualiza a lista em segundo plano
           ↓
   Campo de busca recebe o foco
```

A lista guardada aparece **antes** de qualquer requisição: abrir a aplicação não significa esperar por duas APIs. Se a atualização falhar, a lista anterior permanece visível e o sistema sinaliza que os dados podem estar desatualizados.

### 3.2 Busca

```text
Usuário informa o termo e confirma
        ↓
Sistema identifica as fontes selecionadas
        ↓
Consulta cada fonte de forma independente
        ↓
   ┌───────────────────────┐
   │ Alguma fonte falhou?  │
   └───────────┬───────────┘
          SIM  │  NÃO
           ↓   │   ↓
   Apresenta o │  Apresenta todos
   que a outra │  os resultados
   respondeu e │
   avisa qual  │
   falhou      │
           ↓   │
        Normaliza, filtra e ordena
                ↓
        Resultados apresentados
```

### 3.3 Interações sobre os resultados

```text
              Resultados exibidos
                      ↓
        ┌─────────────┼─────────────┐
        ↓             ↓             ↓
    Filtrar       Ordenar      Abrir documento
        ↓             ↓             ↓
   Nova consulta  Reorganiza   Navegador abre
   às fontes      localmente   a fonte original
                                    ↓
                              Acesso registrado
                              no banco local
```

A distinção é importante: **alterar filtro consulta as fontes novamente**, enquanto **alterar a ordenação apenas reorganiza** o que já está em memória.

## 4. Requisitos funcionais

| ID | Requisito | Situação |
| --- | --- | --- |
| **RF01** | Buscar documentos a partir de um termo informado | Implementado |
| **RF02** | Comparar o termo com o nome do arquivo, sem considerar conteúdo | Implementado |
| **RF03** | Filtrar por tipo de documento, fonte e período | Implementado |
| **RF04** | Determinar o tipo pela extensão do arquivo | Implementado |
| **RF05** | Selecionar GitHub ou Google Drive como fonte | Adiado (ADR-0004) |
| **RF06** | Consultar ambas as fontes quando nenhuma for selecionada | Implementado |
| **RF07** | Consultar exclusivamente a fonte selecionada | Implementado |
| **RF08** | Definir período por data inicial e final | Implementado |
| **RF09** | Consultar as fontes por suas APIs | Implementado |
| **RF10** | Apresentar nome, extensão, data e fonte de cada resultado | Implementado |
| **RF11** | Refazer a consulta ao alterar filtros | Implementado |
| **RF12** | Ordenar por A–Z, Z–A, data crescente e decrescente | Implementado |
| **RF20** | Disponibilizar link para o documento na fonte original | Implementado |
| **RF21** | Informar quando a busca não retornar resultados | Implementado |
| **RF22** | Informar falha na comunicação com uma API | Implementado |
| **RF24** | Apresentar indicador de carregamento durante a busca | Implementado |
| **RF26** | Apresentar documentos modificados recentemente na abertura | Implementado |
| **RF27** | Configurar as credenciais pela interface | Implementado |
| **RF28** | Registrar localmente os documentos acessados | Implementado |

RF26, RF27 e RF28 são novos e não constam do levantamento original.

### Requisitos adiados

| ID | Requisito | Motivo |
| --- | --- | --- |
| RF13–RF19 | Resumos gerados por IA | Adiado. O banco já reserva os campos |
| RF23, RF25 | Erro e carregamento do resumo | Dependem dos resumos |
| — | Busca por conteúdo (full-text) | Issues #49 e #55 |
| — | Autor nos resultados | Custo de uma requisição por arquivo no GitHub |

## 5. Requisitos não funcionais

| ID | Requisito |
| --- | --- |
| **RNF01** | As integrações ocorrem por API |
| **RNF02** | As credenciais são informadas pelo usuário na interface e protegidas pelo mecanismo do sistema operacional |
| **RNF03** | A busca reaproveita resultados para responder de forma adequada |
| **RNF04** | As credenciais permanecem fora da camada de interface |
| **RNF05** | O sistema opera sem servidor centralizado |
| **RNF06** | A interface é operável por teclado e não comunica informação apenas por cor |

## 6. Regras de negócio

### Busca

* **RN01** — O termo é comparado com o nome do arquivo.
* **RN02** — O conteúdo dos documentos não é considerado.
* **RN03** — A busca ocorre em todas as fontes configuradas. No MVP há uma: o GitHub (ADR-0004).
* **RN04** — Sem seleção de fonte, ambas são consultadas.
* **RN05** — Com uma fonte selecionada, apenas ela é consultada.
* **RN06** — Alterar qualquer filtro dispara nova consulta.

### Tipos aceitos

* **RN07** — São aceitos `.md`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.pdf`, `.epub` e `.txt`. Código-fonte e arquivos de configuração são excluídos.

### Datas

* **RN08** — O período é definido por data inicial e final, ambas inclusivas.
* **RN22** — A **data de modificação** é o campo canônico de ordenação. A data de criação é exibida apenas quando a fonte a fornece — o GitHub não a expõe por arquivo.

### Ordenação

* **RN09** — Critérios: A–Z, Z–A, data crescente, data decrescente.
* **RN10** — Alterar a ordenação reorganiza os resultados sem nova consulta.

### Credenciais

* **RN23** — O GitHub é configurado por token, validado antes de ser gravado.
* **RN24** — *Adiado com a fonte (ADR-0004).* O Google Drive exigiria autorização por consentimento do usuário: uma chave isolada não alcança documentos privados, e o escopo `drive.readonly` é restrito pelo Google.
* **RN25** — Credenciais nunca são reexibidas após gravadas.
* **RN26** — Credencial inválida e falha de conexão são estados distintos, comunicados de forma diferente. O resultado da verificação é apresentado na tela de configurações; o cabeçalho não replica o estado de conexão.

### Persistência

* **RN27** — Apenas o link de redirecionamento é armazenado. O conteúdo dos documentos nunca é persistido.
* **RN28** — O resultado da verificação de credenciais é reaproveitado entre execuções.

## 7. Comportamentos e exceções

| Código | Situação | Comportamento |
| --- | --- | --- |
| **CB01** | Acesso ao documento | Abre a fonte original no navegador e registra o acesso |
| **CB02** | Busca em andamento | Apresenta indicador de carregamento; a barra permanece utilizável |
| **CB04** | Busca sem resultados | Informa que nada foi encontrado e sugere revisar termo ou filtros |
| **CB05** | Falha em uma fonte | Apresenta os resultados da outra e identifica a fonte que falhou |
| **CB06** | Falha nas duas fontes | Informa que não foi possível realizar a busca, com nova tentativa |
| **CB07** | Erro de API | Informa a ocorrência sem tornar a interface inutilizável |
| **CB09** | Limite de requisições atingido | Informa indisponibilidade temporária e reaproveita o resultado guardado |
| **CB10** | Nenhuma credencial configurada | Orienta a configurar, com acesso direto às configurações |
| **CB11** | Período inválido | Informa junto ao filtro e não dispara consulta |
| **CB12** | Autorização expirada | Informa que é necessário conectar novamente |

## 8. Estratégia de integração

### GitHub

O inventário de documentos vem da **árvore Git**, que devolve o repositório inteiro em uma única requisição.

```text
GET /user/repos                              → repositórios acessíveis
GET /repos/{o}/{r}/git/trees/{branch}?recursive=1  → inventário completo
        ↓
Filtragem por nome e extensão, em memória
```

Para os documentos recentes, a lista de commits é combinada ao detalhe dos mais recentes, onde os arquivos alterados aparecem.

> **Verificado contra a API real em 27/08/2026:** a Events API **não** serve para descobrir arquivos alterados — o `payload` de um `PushEvent` não traz a lista de commits, e os eventos são majoritariamente de issues. A árvore Git resolve o inventário completo em uma chamada.

### Google Drive — fora do MVP

Retirado pela **ADR-0004**. A API resolveria busca e recentes em uma requisição cada, mas o acesso exige **OAuth 2.0** com escopo `drive.readonly`, classificado como restrito pelo Google: publicar o aplicativo demandaria avaliação de segurança CASA, e permanecer em modo de teste imporia nova autorização a cada 7 dias.

A retomada depende de a instituição possuir Google Workspace, o que permitiria consentimento *Internal* sem qualquer dessas restrições.

### Controle de consumo

* Cache local revalidado por `ETag` nas chamadas ao GitHub.
* Resultado apresentado a partir do cache, com atualização em segundo plano.
* Concorrência limitada nas requisições por repositório.
* Tratamento explícito de HTTP 403 e 429.

## 9. Modelo de dados

Banco NoSQL local, orientado a documentos.

**Documento normalizado**, formato comum às duas fontes:

```js
{
  id: 'github:SmartIdea2026/Projeto:Docs/ADR/ADR-0001.md',
  nome: 'ADR-0001.md',
  extensao: 'md',
  fonte: 'github',            // união de fontes; hoje só 'github'
  dataModificacao: '2026-08-27T12:00:00Z',
  dataCriacao: undefined,     // ausente no GitHub
  link: 'https://github.com/…',
  caminho: 'Docs/ADR/ADR-0001.md',
  repositorio: 'SmartIdea2026/Projeto'
}
```

**Coleções persistidas:**

| Coleção | Conteúdo |
| --- | --- |
| `documentos_acessados` | Identificação, nome, fonte, link e data do acesso. Campos de resumo reservados |
| `cache_fontes` | Respostas das APIs, com `ETag` e data de atualização |

## 10. Interface

Tela única de busca, com tela de configurações acessível pelo cabeçalho.

```text
┌──────────────────────────────────────────────────────────┐
│ ⚓ AncorAI                            [Sincronizar] [⚙] │
│    WORKSPACE INTERNO                                     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│           Busque em todo o seu workspace                 │
│      Todos os documentos do seu GitHub em um só lugar    │
│                                                          │
│   ┌────────────────────────────────────────────────┐     │
│   │ 🔍 Buscar pelo nome do documento…    [Buscar]  │     │
│   └────────────────────────────────────────────────┘     │
│                                                          │
│           [Tipo: todos] [Período] [Ordenação]            │
│                                                          │
│   N documento(s) modificado(s) recentemente              │
│   ┌────────────────────────────────────────────────┐     │
│   │ 📄 ADR-0001.md   MD  ⌥ GitHub                  │     │
│   │    SmartIdea2026/Projeto · Modificado em …     │     │
│   │    ↗ Abrir em GitHub                           │     │
│   └────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────┘
```

### Identidade visual

| Elemento | Valor |
| --- | --- |
| Fundo | Creme `#F4F2EA`, aplicado também à janela |
| Primária | Verde escuro `#14432F` |
| Destaque | Verde médio `#2E7A5A` |
| Superfícies | Branco, raio 16px, borda fina, sombra suave |
| Busca e filtros | Formato pílula |
| Tipografia | Sans geométrica |

### Estados obrigatórios

*Default*, *hover*, *focus*, *loading*, *empty* de busca, *empty* de credenciais, *error* por fonte e *filtro ativo*.

### Acessibilidade

* Todos os controles alcançáveis por teclado, em ordem que segue a leitura visual.
* O campo de busca recebe foco na abertura.
* Indicador de foco visível em todo elemento acionável.
* Alterações da lista anunciadas por leitores de tela.
* Fonte do documento comunicada por texto e ícone, **nunca apenas por cor**. O estado de conexão da fonte é apresentado na tela de configurações — não no cabeçalho — e ali segue a mesma regra.
* Contraste mínimo de 4.5:1.

> **Pendente:** os contrastes precisam ser conferidos no Figma contra o protótipo. Os valores adotados no código foram calculados para atender à proporção, mas não foram validados contra o arquivo de design.

## 11. Rastreabilidade

| Decisão | Registro |
| --- | --- |
| Plataforma desktop | `Docs/ADR/ADR-0001-plataforma-desktop-electron.md` |
| Persistência NoSQL local | `Docs/ADR/ADR-0002-persistencia-local.md` |
| Credenciais pela interface | `Docs/ADR/ADR-0003-gerenciamento-credenciais-api.md` |
| Levantamento original | `Docs/Requisitos/LevantamentoRequisitosFluxo.md` |
| Padrões para agentes | `AGENTS.md` |
