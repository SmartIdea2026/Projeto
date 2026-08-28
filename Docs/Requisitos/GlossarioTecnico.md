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

## Processo

**ADR** (*Architecture Decision Record*) — registro de uma decisão arquitetural, com o contexto que a motivou, as alternativas descartadas e as consequências aceitas. Preserva o *porquê*, que o código sozinho não conta.

**OpenSpec** — fluxo adotado pela equipe para mudanças: proposta, especificação, design, tarefas, implementação e arquivamento.

**MVP** (*Minimum Viable Product*) — a menor versão do produto que entrega valor de ponta a ponta e permite verificar as premissas do projeto.
