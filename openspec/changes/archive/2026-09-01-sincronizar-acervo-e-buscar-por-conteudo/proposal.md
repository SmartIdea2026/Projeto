# Proposta — Sincronização do acervo e busca pelo conteúdo

**Issue:** #93
**Status:** Proposto
**Data:** 01/09/2026

## Why

O sistema já baixa e guarda o texto dos documentos no banco local, mas isso acontece de forma invisível: quem usa não sabe se o acervo está completo, não tem como forçar uma atualização, e a busca continua ignorando tudo o que foi guardado — encontra um documento pelo nome, nunca pelo que está escrito dentro dele. A ata de 28/08 pediu explicitamente uma sincronização única do acervo com botão manual na interface; e as issues #49 e #55 pedem que a busca alcance o conteúdo. As duas coisas dependem do mesmo texto já armazenado e se entregam juntas.

## What Changes

- **Sincronização visível na abertura.** A ingestão do conteúdo, que já roda ao abrir a aplicação, passa a ter progresso apresentado ao usuário (quantos documentos, quantos já tinham texto, quantos sem texto, quantas falhas) e um estado final — concluída ou suspensa, com o motivo.
- **Botão "Sincronizar" no cabeçalho**, ao lado do acesso às configurações. Aciona uma nova varredura do acervo: reaproveita o texto já gravado e vigente, e só busca o que falta ou o que mudou na fonte. É a mesma operação que corre na abertura, agora sob comando.
- **A sincronização passa a alimentar a busca inteira, não só a busca pelo conteúdo.** Além do texto, a varredura grava no banco local um **snapshot do inventário** (quais documentos existem e seus metadados) e resolve a **autoria e a data real** de cada documento. A busca com termo ou período passa a ser servida desse snapshot local, em vez de consultar o GitHub uma vez por documento a cada consulta — o que a tornava lenta em proporção ao tamanho do acervo. **Trade-off:** a busca passa a refletir a última sincronização; um documento criado, renomeado ou removido na fonte só entra ou sai da busca depois de sincronizar. A sincronização roda na abertura e pelo botão; enquanto o snapshot não existe, a busca cai numa consulta ao vivo, como hoje.
- **A busca pode alcançar o conteúdo dos documentos.** Uma caixa **"Buscar no conteúdo"** (desligada por padrão) faz o termo corresponder também ao texto já armazenado, de forma **aditiva**: um documento entra no resultado se o termo casar com o nome, com o autor **ou** com o conteúdo — num resultado único. Ligada sob demanda porque a correspondência pelo texto alcança quase todo documento para termos comuns; a caixa não é um seletor de campo, só amplia o alcance. No conteúdo o termo casa como palavra inteira.
- **Sem trecho nem realce.** O resultado que casou pelo conteúdo é assinalado como tal, mas o texto onde a correspondência ocorreu **não** é apresentado. O conteúdo permanece confinado ao processo principal (ADR-0005); nenhum canal passa a devolver texto ao renderer.
- **Visualização inalterada.** O documento continua sendo aberto por redirecionamento à fonte original. O sistema possuir o texto segue invisível para quem usa.
- **NÃO BREAKING.** Nada de novo sai da máquina: a busca pelo conteúdo lê o texto que já está no banco local, e nenhuma submissão a serviço externo é introduzida aqui. A fronteira que a mudança `painel-de-resumo-por-ia` atravessa não é atravessada por esta.

## Capabilities

### New Capabilities

_Nenhuma._ A sincronização é a mesma capacidade de ingestão que já existe, ganhando um gatilho e um progresso visíveis; a busca pelo conteúdo é uma extensão da correspondência de termo já especificada.

### Modified Capabilities

- `busca-documentos`: o requisito **Busca por termo** deixa de excluir o conteúdo interno dos documentos. A correspondência passa a considerar nome, autor **e** texto armazenado, permanecendo aditiva. Um resultado que casou apenas pelo conteúdo é assinalado. Documentos ainda sem texto armazenado continuam encontráveis por nome e autor, e a busca informa quando o alcance pelo conteúdo cobriu apenas parte do acervo. Acrescenta-se o requisito de **origem dos resultados**: a busca com termo ou período é servida do snapshot local da última sincronização, refletindo o estado da fonte àquele momento, e cai numa consulta ao vivo enquanto o snapshot não existe.
- `conteudo-documentos`: o requisito **Ingestão sob demanda e em segundo plano** passa a declarar explicitamente que a ingestão do acervo é iniciada na abertura da aplicação e pode ser reexecutada sob comando do usuário. Acrescenta-se o requisito de **progresso e estados da sincronização** apresentados na interface (default, em andamento, concluída, suspensa/erro), sem que o texto ingerido deixe o processo principal. Acrescenta-se o requisito de **registro do inventário e da autoria**: a varredura grava o snapshot do inventário e resolve autoria e data real de cada documento, reaproveitando o já resolvido pelo `sha` do blob.

## Impact

**Confidencialidade — sem mudança de postura.** Diferente das mudanças de IA propostas, esta não envia conteúdo a lugar nenhum. A ADR-0005 já autoriza o texto a repousar no disco; a busca pelo conteúdo apenas o consulta. Não exige ADR.

**Alcance parcial da busca pelo conteúdo.** Enquanto a sincronização não terminou — ou para documentos de formato sem extração (`xls`, `xlsx`, `.doc`), grandes demais, ou sem texto extraível —, não há texto a consultar. Esses documentos continuam encontráveis por nome e autor; a correspondência pelo conteúdo simplesmente não os alcança. Quando isso deixa resultados de fora, o sistema avisa, reaproveitando o canal de `avisos` já usado para resultado parcial.

**Custo em cota do GitHub.** A sincronização sob comando repete a varredura do inventário e baixa o que falta. Reaproveitar o texto vigente pelo `sha` do blob mantém o custo proporcional ao que mudou, não ao número de sincronizações. A varredura continua serial, cedendo a vez a qualquer busca em andamento (`prioridade.ts`). A resolução de autoria segue a mesma regra: só é refeita para o documento cujo `sha` do blob mudou, então a partir da segunda sincronização custa proporcional ao que mudou. Em troca, a busca deixa de gastar ~1 requisição por documento **a cada consulta** — o custo migra da busca (repetido, com o usuário esperando) para a sincronização (uma vez, em segundo plano).

**Defasagem da busca.** A busca com termo ou período passa a responder pelo snapshot local, não pelo estado do GitHub no instante da consulta. Um documento novo na fonte não aparece até a próxima sincronização; um documento apagado continua aparecendo até lá. → Mitigação: a sincronização roda na abertura e está a um clique no cabeçalho, com o estado (concluída / há quanto tempo) visível ali. Para o acervo do MVP a varredura completa é rápida. Enquanto o snapshot não existe, a busca usa a consulta ao vivo de hoje.

**Não confundir com o índice local.** A mudança `resumos-e-indice-por-ia` — índice de documentos, classificação por IA de todo o acervo, busca por assunto/etiquetas — permanece separada e não é tocada aqui. O teto de 10 documentos para inferência de tags decidido na ata de 28/08 é daquela frente e não incide sobre a busca por conteúdo literal, que não usa LLM.

**Código:**
- `src/main/conteudo/ingestao.ts` — a varredura já existe (`ingerirAcervo`); ganha emissão de progresso ao renderer, guarda de execução única entre o disparo da abertura e o do botão, gravação do snapshot do inventário e resolução da autoria de cada documento.
- `src/main/busca/servico.ts` e `src/main/busca/regras.ts` — a correspondência de termo passa a consultar o texto em `conteudo_documentos`; a marcação de "encontrado no conteúdo" entra no resultado; a busca com termo ou período passa a ser servida do snapshot local quando ele existe, sem `coletar` nem `enriquecerParaBusca` no GitHub.
- `src/main/banco/repositorio.ts` — leitura do texto para correspondência, no processo principal, sem expô-lo; coleção `acervo_documentos` com o snapshot do inventário e a autoria resolvida.
- `src/compartilhado/canais.ts` e `src/main/ipc.ts` — canal de progresso da sincronização; o `conteudo:indexar` já existe e passa a ser acionado pelo botão.
- `src/preload/index.ts` — a ponte já expõe `indexarConteudo`; acrescenta a assinatura de progresso.
- `src/renderer` — botão "Sincronizar" e indicador de progresso no cabeçalho; marca de "encontrado no conteúdo" no cartão de resultado.
- `test/seguranca/fronteira-conteudo.test.ts` — continua valendo sem exceção: nenhum canal novo devolve texto, inclusive o de progresso e o da busca.

**Dependências:** nenhuma nova.
