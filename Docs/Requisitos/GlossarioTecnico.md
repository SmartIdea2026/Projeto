# Glossário Técnico

Termos que aparecem nas ADRs, nas especificações e no código do AncorAI. O objetivo é que qualquer integrante leia uma decisão arquitetural sem precisar reconstruir o vocabulário por conta própria.

Organizado por assunto, e não em ordem alfabética: os termos se explicam melhor em conjunto.

## Autorização e acesso às APIs

**Chave de API (*API key*)** — credencial que identifica o **projeto** que chama uma API, não a pessoa que a utiliza. Serve para contabilizar uso e aplicar limites. Por não representar um usuário, não dá acesso a conteúdo privado — foi essa constatação que descartou o uso de chave de API para o Google Drive.

**OAuth 2.0** — protocolo pelo qual uma pessoa autoriza um aplicativo a agir em seu nome em um serviço, sem lhe entregar a senha. O aplicativo recebe um *token*, com validade e alcance limitados.

**Escopo (*scope*)** — o alcance exato do que o aplicativo pode fazer com a autorização. O Google classifica escopos em três níveis de rigor crescente: *não sensível*, *sensível* e **restrito**. Escopos restritos, como `drive.readonly`, exigem avaliação de segurança para o aplicativo ser publicado — a razão pela qual o Drive saiu do MVP (ADR-0004).

**Modo de publicação (*Testing* / *In production*)** — status do projeto no Google Cloud. Em *Testing*, o acesso limita-se a até 100 usuários cadastrados manualmente e o *refresh token* expira em 7 dias. Em *In production*, essas limitações somem, mas escopos sensíveis ou restritos passam a exigir verificação pelo Google.

**Consentimento Internal** — configuração disponível apenas para organizações com Google Workspace, que restringe o aplicativo aos membros do domínio. Dispensa verificação e não sofre a expiração de 7 dias.

**Access token** — credencial de curta duração, tipicamente uma hora, apresentada a cada chamada de API.

**Refresh token** — credencial de longa duração usada para obter novos *access tokens* sem repetir o consentimento. É o que permite que o aplicativo continue funcionando depois de fechado e reaberto.

**PKCE** (*Proof Key for Code Exchange*) — extensão do OAuth criada para aplicativos que não conseguem guardar um segredo, como os instalados na máquina do usuário: qualquer "segredo" embutido no binário distribuído pode ser extraído dele. Em vez de um segredo fixo, o aplicativo gera um valor aleatório a cada autorização e prova, na troca do código, que foi ele quem iniciou o fluxo.

**Loopback** — técnica de redirecionamento em que o aplicativo instalado sobe um servidor HTTP efêmero em `127.0.0.1` para receber a resposta da autorização, já que não possui um endereço público para onde o navegador possa retornar.

**Personal Access Token (PAT)** — no GitHub, token gerado pelo próprio usuário em substituição à senha. Os *fine-grained tokens* permitem restringir permissões e repositórios alcançados, e são a forma recomendada para o AncorAI.

## Arquitetura da aplicação

**Processo main** — no Electron, o processo com acesso ao sistema operacional e à rede. No AncorAI concentra credenciais, chamadas às APIs e banco de dados.

**Processo renderer** — o processo que desenha a interface. É onde conteúdo vindo de fora — nomes e caminhos de arquivos — é apresentado, e por isso nenhuma credencial chega até ele (ADR-0003).

**Preload** — script que roda entre os dois processos e define, via `contextBridge`, a única superfície que o *renderer* enxerga do *main*. É a fronteira de segurança em forma de código.

**IPC** (*Inter-Process Communication*) — mecanismo de troca de mensagens entre *main* e *renderer*. Cada canal é uma operação nomeada; a lista completa está em `src/compartilhado/canais.ts`.

**safeStorage** — API do Electron que cifra dados usando o mecanismo de proteção de segredos do sistema operacional (chaveiro do GNOME, Keychain, DPAPI). É como as credenciais são gravadas sem ficarem legíveis em disco.

**Fonte** — origem de documentos integrada ao sistema. O MVP tem uma, o GitHub; a arquitetura permanece plural (ADR-0004).

**Formato unificado** — a estrutura única para a qual os resultados de qualquer fonte são convertidos, definida por `Documento` em `src/compartilhado/tipos.ts`. É o que permite ordenar e filtrar resultados de origens diferentes na mesma lista.

**Normalização** — a conversão da resposta de uma API para o formato unificado.

**Resultado parcial** — resultado que chegou, mas não completo: a API truncou o inventário, um repositório não pôde ser consultado, ou a varredura parou num teto de páginas. É distinto de falha, e tem canal próprio na resposta (`avisos`), porque a interface trata as duas coisas de forma diferente — resultado nenhum e resultado incompleto não são o mesmo problema.

**Data aproximada** — data de modificação que não é a do arquivo. A árvore Git não informa data por arquivo, então cada documento da busca no GitHub herda o `pushed_at` do repositório, e todos os arquivos de um mesmo repositório ficam com a mesma data. Os documentos assim marcados carregam `dataAproximada: true`, para que a interface e o filtro de período não os tratem como exatos. A lista de recentes não tem essa limitação: vem dos commits.

**Isolamento de falhas** — regra pela qual a falha de uma fonte não impede a exibição dos resultados das demais: cada fonte é consultada de forma independente e os erros viram dado de saída, não exceção.

**ETag** — identificador que a API do GitHub devolve junto de uma resposta. Reenviado na requisição seguinte, permite que o servidor responda "nada mudou" sem retransmitir o conteúdo, e sem consumir cota.

## Conteúdo dos documentos

**Ingestão** — o percurso completo que traz o conteúdo de um documento para dentro do sistema: obter os bytes na fonte, extrair o texto e gravá-lo no banco local. Distingue-se do **inventário**, que só descobre quais documentos existem e quais são seus metadados. Inventariar é barato — uma requisição por repositório; ingerir é caro — uma requisição por arquivo.

**Extração de texto** — a conversão do arquivo para texto simples, específica de cada formato: decodificação direta em `md` e `txt`, análise da estrutura em `pdf`, `docx` e `epub`. Formatos sem extrator disponível são registrados como *sem texto*, com o motivo, e continuam encontráveis pelo nome.

**Blob** — no Git, o objeto que guarda o conteúdo de um arquivo, sem nome nem caminho. A árvore Git associa caminhos a blobs; o conteúdo em si mora no blob.

**`sha` do blob** — o identificador de um blob, que é o *hash* do próprio conteúdo. Muda exatamente quando os bytes do arquivo mudam, e não muda quando o arquivo é apenas tocado por um commit vizinho. É o que o AncorAI usa para saber se o texto guardado ainda vale, em vez da data — que, sendo o `pushed_at` do repositório (ver *data aproximada*), avançaria para todos os arquivos a cada push e forçaria rebaixar o acervo inteiro.

**Confinamento ao processo principal** — regra pela qual um dado sensível nunca é devolvido ao *renderer* por nenhum canal IPC. Vale para as credenciais desde a ADR-0003 e passa a valer para o conteúdo dos documentos com a ADR-0005: o sistema tem acesso ao texto, o usuário final não.

**Truncamento** — corte do texto extraído ao atingir o limite por documento. O registro marca que houve corte, para que quem consuma o texto não trate uma parte como se fosse o todo.

**Busca pelo conteúdo** — extensão da correspondência de termo que passa a considerar também o texto já ingerido do documento, além do nome e do autor. **Opcional**, ativada pela caixa "Buscar no conteúdo" (desligada por padrão): a correspondência pelo texto alcança qualquer documento que mencione o termo no corpo. É **aditiva** — o documento entra por qualquer uma das vias — e **literal**, sem acento nem caixa, sem busca por similaridade. No conteúdo o termo casa como **palavra inteira** (nome e autor casam por substring). Roda no processo principal e devolve apenas a marca `apenasConteudo` quando o termo casou só pelo texto — nunca o trecho (ver *confinamento ao processo principal*).

**Sincronização do acervo** — a varredura do inventário inteiro, com gatilho visível: roda ao abrir a aplicação e pode ser reexecutada pelo botão "Sincronizar" no cabeçalho. Faz três coisas por documento: baixa e extrai o **texto**, resolve **autoria e data real** da última alteração, e grava o **snapshot do inventário**. Reaproveita o que já está vigente pelo `sha` do blob e busca só o que falta ou mudou. É uma varredura de cada vez — um segundo disparo junta-se à que está em curso em vez de iniciar outra.

**Snapshot do inventário** — a coleção `acervo_documentos`, gravada pela sincronização: um registro por documento existente na fonte, com os metadados e, quando resolvidas, a autoria e a data real. A busca com termo ou período é servida dele, sem consultar a fonte documento a documento — o que a tornava lenta em proporção ao tamanho do acervo. O preço é a **defasagem**: a busca reflete a última sincronização, não a fonte no instante da consulta. Enquanto o snapshot está vazio, a busca cai numa consulta ao vivo.

**Estado da sincronização** — o retrato do andamento que o cabeçalho apresenta, em contagens e num de quatro estados: *parada* (nenhuma varredura desde a abertura), *em andamento*, *concluída* e *suspensa*. A suspensão traz o motivo — limite de requisições da fonte, limite de armazenamento, credencial do GitHub ausente ou falha ao obter o inventário. Trafega pelo canal `sincronizacao:estado`, que devolve só contagens e estado, nunca texto.

**Alcance parcial da busca pelo conteúdo** — caso de *resultado parcial* emitido quando há termo e nem todo documento do inventário tem registro de conteúdo vigente: os que ficaram fora foram procurados apenas por nome e autor. Traz a contagem do que ficou de fora e desaparece quando a sincronização cobre todo o inventário.

**Autoria pendente no snapshot** — caso análogo, emitido quando a busca é servida do *snapshot do inventário* e ainda há documentos sem autoria resolvida: eles foram procurados apenas pelo nome. Substitui, nesse caminho, o aviso de "considerou os N primeiros" da consulta ao vivo — ali há um teto por consulta; no snapshot a autoria é resolvida pela sincronização para todo o acervo. Some quando a sincronização termina.

## Processo

**ADR** (*Architecture Decision Record*) — registro de uma decisão arquitetural, com o contexto que a motivou, as alternativas descartadas e as consequências aceitas. Preserva o *porquê*, que o código sozinho não conta.

**OpenSpec** — fluxo adotado pela equipe para mudanças: proposta, especificação, design, tarefas, implementação e arquivamento.

**MVP** (*Minimum Viable Product*) — a menor versão do produto que entrega valor de ponta a ponta e permite verificar as premissas do projeto.
