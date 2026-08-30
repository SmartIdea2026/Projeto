# Proposta — Painel de resumo por IA

**Issue:** #65
**Status:** Proposto
**Data:** 28/08/2026

## Why

O sistema agora tem o texto dos documentos no banco local, e não faz nada com ele. A mudança `ingerir-conteudo-dos-documentos` trouxe o conteúdo para dentro justamente para viabilizar o que vem agora — mas, sozinha, ela não entrega nada visível: a tela continua igual, e quem usa o produto não percebe diferença alguma.

Encontrar um documento pelo nome não diz o que há dentro dele. Diante de dez resultados, o usuário abre um a um até achar o que serve. O resumo responde à pergunta "é este?" sem sair da tela.

## Objetivo

Apresentar, em painel à direita da lista, um resumo do documento em foco produzido por IA a partir do texto já armazenado — e fazê-lo aparecer sem que o usuário fique olhando para uma tela parada enquanto isso acontece.

## What Changes

- **Painel de resumo à direita da lista**, com nome do documento, crachá da fonte, o resumo em prosa, os destaques principais e a ação de abrir o documento na fonte original, conforme o protótipo.
- **Resumo gerado pelo Gemini** a partir do texto que já está no banco. Uma única chamada devolve o resumo, o tipo do documento, os assuntos e os destaques — não quatro chamadas.
- **BREAKING (postura de dados):** o conteúdo dos documentos passa a ser **enviado a um serviço externo**. A ADR-0005 autorizou guardá-lo na máquina; mandá-lo para fora é outra decisão, mais grave, e **exige ADR própria**.
- **Frases de carregamento que acompanham trabalho real.** As frases nomeiam a etapa em curso — ler o documento, gerar o resumo — e nunca aparecem sem que haja algo acontecendo. Resumo já gravado aparece na hora, sem espera fabricada.
- **Resumo do primeiro resultado** apresentado assim que a busca retorna, e **ação de gerar resumo em cada resultado**, que substitui o painel sem mexer na lista.
- **Reuso do resumo gravado**, invalidado pela mesma identidade de conteúdo que invalida o texto: documento alterado na fonte, resumo desatualizado.
- **Arquivo Markdown de instrução versionado** no repositório, definindo como a LLM deve redigir — revisável em Pull Request como qualquer outro documento.
- **Chave da API do Gemini** configurável, com o mesmo tratamento das demais credenciais.

## Capabilities

### New Capabilities

- `resumos-por-ia`: geração do resumo a partir do texto armazenado, seu armazenamento e reuso, o arquivo de instrução que orienta a LLM, e o painel que apresenta tudo isso — incluindo os estados de carregamento e de falha.

### Modified Capabilities

- `configuracao-credenciais`: passa a haver uma segunda credencial, a chave da API do Gemini, com a mesma proteção da do GitHub. A tela também passa a informar que o conteúdo dos documentos é enviado a um serviço externo.

## Impact

**Confidencialidade — o ponto central, e o mais grave até aqui.** O conteúdo dos documentos passa a sair da máquina. No plano gratuito da API do Gemini, o conteúdo submetido pode ser usado para melhorar os produtos do Google e passar por revisão humana; no plano pago, não. A equipe decidiu prosseguir com a chave gratuita, ciente disso, por se tratar de documentos do próprio projeto acadêmico. **Exige ADR**, que deve nomear o risco e registrar a decisão.

Vale separar as duas fronteiras, porque elas são de gravidades diferentes: a ADR-0005 autorizou o texto a **repousar** no disco de quem já tinha acesso a ele; esta autoriza o texto a **sair** para um terceiro que não tinha. A segunda não decorre da primeira.

**Cota gratuita.** Cada resumo é uma chamada. O resumo do primeiro resultado é automático, então toda busca custa uma chamada quando o documento ainda não tem resumo — e nenhuma quando já tem. As submissões ocorrem **uma por vez**, nunca em lote paralelo.

**Onde o resumo é gravado.** A ADR-0002 reservou os campos `resumo` e `resumoEm` em `documentos_acessados` prevendo este momento. Eles não servem: aquela coleção só registra o que o usuário **abriu**, e o painel resume o primeiro resultado de uma busca, que normalmente nunca foi aberto. O resumo vai para junto do texto de que foi derivado, onde a mesma identidade de conteúdo invalida os dois de uma vez.

**Dependência entre mudanças.** Esta depende de `ingerir-conteudo-dos-documentos`, que fornece o texto. Sem ela, não há o que resumir.

**Recorte da mudança pendente.** `resumos-e-indice-por-ia` hoje contém a capacidade `resumos-por-ia` e o delta de `configuracao-credenciais` — as duas passam para cá. Aquela mudança fica com o que de fato lhe resta: o índice local, a classificação de **todo** o acervo e a busca por contexto. Seus artefatos são corrigidos junto com esta proposta, para que as duas não descrevam a mesma tela.

**Sobre o protótipo.** A imagem de referência mostra "Google Drive" no crachá e no botão. O Drive saiu do MVP pela ADR-0004; o crachá e o botão indicam a fonte real do documento, que hoje é sempre o GitHub. O restante do leiaute é seguido como está.

**Código:** módulo novo de LLM no processo principal, `banco/repositorio.ts` (resumo junto do registro de conteúdo), `credenciais/cofre.ts` e `ipc.ts` (credencial e canal novos), e no renderer o painel, o novo leiaute em duas colunas e a ação por resultado.

**Dependência nova:** API do Google Gemini por HTTP direto, sem SDK — a mesma disciplina adotada para o GitHub.
