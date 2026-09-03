# busca-por-voz Specification

## Purpose

Permitir que o usuário dite o termo de busca por voz: um controle de microfone na barra de busca captura a fala, um modelo de transcrição local a converte em texto, e esse texto preenche o campo de busca para o usuário conferir e confirmar. O áudio é processado na máquina do usuário e não sai dela.

## Requirements

### Requirement: Ditado do termo de busca por voz

O sistema SHALL oferecer, na barra de busca, um controle que capture a fala do usuário e a converta em texto no campo de busca.

O texto transcrito SHALL **substituir** o conteúdo atual do campo de busca, e o foco SHALL retornar ao campo após a transcrição, de modo que o usuário possa revisar e editar o texto antes de buscar.

O sistema NÃO SHALL disparar a busca automaticamente ao concluir a transcrição. A busca SHALL continuar sendo iniciada por um ato explícito do usuário — acionar "Buscar" ou confirmar pelo teclado —, como em uma busca digitada.

A transcrição SHALL assumir o português do Brasil e devolver a fala **literal**, sem tradução para outro idioma. O sistema NÃO SHALL apresentar seletor de idioma na interface.

O controle NÃO SHALL interpretar a fala como comando: qualquer coisa dita é tratada como texto de busca, nunca como instrução para filtrar, ordenar, abrir resultados ou navegar.

O texto transcrito SHALL conter apenas as palavras ditadas, sem a pontuação de frase que o modelo acrescenta (ponto, vírgula, "!", "?", etc.), já que um termo de busca pontuado não casa com o mesmo termo sem pontuação.

#### Scenario: Transcrição sem pontuação de frase

- **GIVEN** que a busca por voz está ativa
- **WHEN** o usuário dita "roadmap de setembro" e o modelo transcreve "Roadmap de setembro."
- **THEN** o campo de busca recebe "Roadmap de setembro", sem o ponto final

#### Scenario: Fala não é traduzida

- **GIVEN** que a busca por voz está ativa
- **WHEN** o usuário dita um termo em português
- **THEN** o campo de busca recebe o texto em português
- **AND** a fala não é vertida para outro idioma

#### Scenario: Fala convertida em termo de busca

- **GIVEN** que a busca por voz está ativa e o campo de busca está vazio
- **WHEN** o usuário dita um termo e a captura é encerrada
- **THEN** o texto transcrito aparece no campo de busca
- **AND** o foco está no campo de busca
- **AND** nenhuma busca foi realizada até o usuário confirmá-la

#### Scenario: Ditado sobre campo já preenchido

- **GIVEN** que o campo de busca já contém um texto digitado
- **WHEN** o usuário dita um novo termo e a captura é encerrada
- **THEN** o texto transcrito substitui o conteúdo anterior do campo

#### Scenario: Usuário corrige a transcrição antes de buscar

- **GIVEN** que uma transcrição preencheu o campo de busca com um erro
- **WHEN** o usuário edita o texto no campo e aciona "Buscar"
- **THEN** a busca usa o texto corrigido

#### Scenario: Fala que parece um comando

- **GIVEN** que a busca por voz está ativa
- **WHEN** o usuário diz "filtrar por contrato"
- **THEN** o campo de busca recebe o texto "filtrar por contrato"
- **AND** nenhum filtro é alterado

### Requirement: Ciclo de gravação

O usuário SHALL iniciar a captura acionando o controle de microfone uma vez.

A captura SHALL encerrar automaticamente após um intervalo de silêncio contínuo. Enquanto a captura estiver em andamento, o sistema SHALL apresentar um controle visível para encerrá-la imediatamente.

A captura SHALL ter uma duração máxima; atingido o teto, ela é encerrada e a transcrição do que foi capturado até ali prossegue.

O usuário SHALL poder descartar uma captura em andamento sem produzir transcrição.

#### Scenario: Parada automática por silêncio

- **GIVEN** que a captura está em andamento
- **WHEN** o usuário para de falar por um intervalo contínuo de silêncio
- **THEN** a captura é encerrada
- **AND** a transcrição do que foi falado começa

#### Scenario: Parada manual antes do silêncio

- **GIVEN** que a captura está em andamento
- **WHEN** o usuário aciona o controle de parar
- **THEN** a captura é encerrada imediatamente
- **AND** a transcrição do que foi falado até ali começa

#### Scenario: Teto de duração atingido

- **GIVEN** que a captura está em andamento há o tempo máximo permitido
- **WHEN** o teto é atingido
- **THEN** a captura é encerrada
- **AND** a transcrição do trecho capturado prossegue

#### Scenario: Captura descartada

- **GIVEN** que a captura está em andamento
- **WHEN** o usuário cancela a captura
- **THEN** nenhuma transcrição é produzida
- **AND** o campo de busca permanece inalterado

### Requirement: Transcrição na máquina do usuário

A conversão da fala em texto SHALL ocorrer inteiramente na máquina do usuário, por um modelo de transcrição local.

O áudio capturado NÃO SHALL ser enviado a nenhum serviço externo, nem gravado em disco após a transcrição. O sistema descarta o áudio assim que produz o texto.

O texto transcrito é a fala do próprio usuário e SHALL poder ser apresentado na camada de interface, do mesmo modo que um termo digitado. A restrição da capacidade `conteudo-documentos` — o texto dos documentos não cruza para a interface — não se aplica a ele.

A transcrição NÃO SHALL depender de acesso à rede, uma vez que o modelo já esteja disponível localmente.

#### Scenario: Transcrição sem rede

- **GIVEN** que o modelo de voz já está disponível localmente
- **AND** que a máquina está sem acesso à internet
- **WHEN** o usuário dita um termo
- **THEN** a transcrição é produzida normalmente

#### Scenario: Áudio não é retido

- **GIVEN** que o usuário concluiu um ditado
- **WHEN** a transcrição é entregue ao campo de busca
- **THEN** o áudio capturado não permanece gravado em disco

### Requirement: Ativação da busca por voz nas configurações

A tela de configurações SHALL apresentar um controle para ativar a busca por voz, **desligado por padrão**.

Enquanto a busca por voz não estiver ativa e com o modelo pronto, o controle de microfone NÃO SHALL ser apresentado na barra de busca.

A decisão do usuário SHALL ser reaproveitada entre execuções: uma vez ativada e com o modelo baixado, a busca por voz permanece disponível nas aberturas seguintes sem novo download.

Desativar a busca por voz SHALL remover o controle de microfone da barra de busca.

#### Scenario: Recurso desligado por padrão

- **GIVEN** que o usuário nunca ativou a busca por voz
- **WHEN** a tela principal é apresentada
- **THEN** a barra de busca não apresenta o controle de microfone

#### Scenario: Recurso ativado permanece disponível

- **GIVEN** que o usuário ativou a busca por voz e o modelo foi baixado
- **WHEN** o usuário fecha e reabre a aplicação
- **THEN** o controle de microfone está disponível na barra de busca
- **AND** nenhum novo download é realizado

#### Scenario: Recurso desativado

- **GIVEN** que a busca por voz está ativa
- **WHEN** o usuário desliga o controle nas configurações
- **THEN** o controle de microfone deixa de ser apresentado na barra de busca

### Requirement: Download do modelo sob demanda

Ativar a busca por voz SHALL iniciar o download do modelo de transcrição, quando ele ainda não estiver presente na máquina.

A tela de configurações SHALL apresentar o progresso do download. O controle de microfone só SHALL passar a ser apresentado na barra de busca quando o modelo estiver íntegro e pronto.

O sistema SHALL verificar a integridade do modelo baixado. Um download interrompido, incompleto ou corrompido NÃO SHALL ser usado: o arquivo parcial é descartado, o controle de ativação retorna a "desligado" e a tela informa a falha, distinguindo-a de uma recusa do usuário.

O modelo SHALL ser armazenado fora do pacote de instalação da aplicação, em área de dados do usuário.

#### Scenario: Download concluído

- **GIVEN** que o usuário ativa a busca por voz e o modelo não está presente
- **WHEN** o download é concluído e o modelo passa na verificação de integridade
- **THEN** o controle de microfone passa a ser apresentado na barra de busca

#### Scenario: Download interrompido

- **GIVEN** que o download do modelo está em andamento
- **WHEN** a conexão cai antes de concluir
- **THEN** o arquivo parcial é descartado
- **AND** o controle de ativação volta para "desligado"
- **AND** a tela informa que o download falhou

#### Scenario: Modelo corrompido

- **GIVEN** que o download terminou mas o arquivo não passa na verificação de integridade
- **WHEN** a verificação falha
- **THEN** o arquivo é descartado
- **AND** a busca por voz não é ativada
- **AND** a tela informa a falha

#### Scenario: Modelo já presente

- **GIVEN** que o modelo já foi baixado numa ativação anterior
- **WHEN** o usuário ativa a busca por voz novamente
- **THEN** nenhum download é realizado
- **AND** o controle de microfone é apresentado imediatamente

### Requirement: Permissão de microfone

O sistema SHALL solicitar a permissão de acesso ao microfone quando o usuário aciona o controle pela primeira vez.

A recusa da permissão NÃO SHALL afetar a digitação no campo de busca nem qualquer outra funcionalidade da aplicação.

Quando a permissão de microfone estiver negada de forma persistente, o controle SHALL ser apresentado em estado desabilitado, com orientação sobre onde reabilitá-la.

O sistema SHALL conceder acesso apenas ao microfone (áudio). Nenhuma permissão de câmera, tela ou outro dispositivo de mídia é solicitada.

#### Scenario: Permissão concedida no primeiro uso

- **GIVEN** que o usuário nunca autorizou o microfone
- **WHEN** ele aciona o controle de microfone e concede a permissão
- **THEN** a captura começa

#### Scenario: Permissão recusada

- **GIVEN** que o usuário aciona o controle de microfone
- **WHEN** ele recusa a permissão
- **THEN** nenhuma captura ocorre
- **AND** o campo de busca continua utilizável por digitação

#### Scenario: Permissão negada de forma persistente

- **GIVEN** que a permissão de microfone foi negada e não será perguntada de novo
- **WHEN** a barra de busca é apresentada com a busca por voz ativa
- **THEN** o controle de microfone aparece desabilitado
- **AND** apresenta orientação sobre como reabilitar o microfone

### Requirement: Consentimento explícito no primeiro uso do microfone

Ao acionar o controle de microfone pela primeira vez — antes de qualquer acesso ao microfone —, o sistema SHALL apresentar uma confirmação explícita que descreva o que o microfone será usado para fazer e afirme que o áudio não sai da máquina.

O usuário SHALL poder recusar essa confirmação; recusando, nenhuma captura ocorre e o campo de busca segue utilizável por digitação.

Concedida a confirmação, o sistema SHALL registrá-la e NÃO SHALL voltar a apresentá-la em usos seguintes, inclusive após reabrir a aplicação.

Autorizar a busca por voz nas configurações NÃO é, por si, esse consentimento: a confirmação do microfone é um passo próprio, salvo quando o usuário concede a permissão do microfone pela própria tela de configurações.

#### Scenario: Confirmação no primeiro acionamento

- **GIVEN** que a busca por voz está ativa e o usuário nunca confirmou o uso do microfone
- **WHEN** ele aciona o controle de microfone
- **THEN** o sistema apresenta uma confirmação explícita antes de acessar o microfone
- **AND** nenhuma captura começa até a confirmação ser concedida

#### Scenario: Confirmação recusada

- **GIVEN** que o sistema apresentou a confirmação de uso do microfone
- **WHEN** o usuário recusa
- **THEN** nenhuma captura ocorre
- **AND** o campo de busca continua utilizável por digitação

#### Scenario: Confirmação lembrada

- **GIVEN** que o usuário já confirmou o uso do microfone uma vez
- **WHEN** ele aciona o controle de microfone de novo, na mesma sessão ou após reabrir a aplicação
- **THEN** a captura começa sem nova confirmação

### Requirement: Escolha do microfone de captura

A tela de configurações SHALL permitir que o usuário escolha qual dispositivo de entrada de áudio a busca por voz usa, com uma opção que acompanha o microfone padrão do sistema.

Enquanto a permissão de microfone nunca tiver sido concedida, o sistema PODE não conseguir nomear os dispositivos; nesse caso a tela SHALL oferecer uma ação para conceder a permissão e então listar os microfones disponíveis.

A escolha SHALL ser reaproveitada entre execuções.

Se o dispositivo escolhido não estiver disponível no momento da captura, o sistema SHALL usar o microfone padrão do sistema em vez de falhar o ditado.

#### Scenario: Escolha de um microfone específico

- **GIVEN** que a busca por voz está ativa e a permissão de microfone foi concedida
- **WHEN** o usuário escolhe um microfone na tela de configurações
- **AND** dita um termo em seguida
- **THEN** a captura usa o microfone escolhido

#### Scenario: Escolha lembrada entre execuções

- **GIVEN** que o usuário escolheu um microfone específico
- **WHEN** ele fecha e reabre a aplicação
- **THEN** a busca por voz continua usando o microfone escolhido

#### Scenario: Dispositivo escolhido indisponível

- **GIVEN** que o usuário escolheu um microfone que foi desconectado
- **WHEN** ele dita um termo
- **THEN** a captura ocorre pelo microfone padrão do sistema
- **AND** o ditado não falha por causa da ausência do dispositivo

### Requirement: Estados e acessibilidade do controle de voz

O controle de microfone e o fluxo de ditado SHALL ser inteiramente operáveis por teclado, com foco visualmente assinalado.

O controle SHALL distinguir, sem depender apenas de cor, os estados: inativo, escutando (captura em andamento), transcrevendo, e erro.

Concluída a captura sem fala reconhecível — silêncio, ruído, ou transcrição vazia —, o sistema NÃO SHALL alterar o campo de busca e SHALL informar, de forma breve, que nada foi reconhecido.

As transições relevantes — início da escuta, início da transcrição, chegada do texto ao campo, e erros — SHALL ser anunciadas a leitores de tela.

Uma falha na transcrição NÃO SHALL alterar o campo de busca; o sistema informa a falha e o usuário pode tentar de novo ou digitar.

#### Scenario: Percurso por teclado

- **GIVEN** que a busca por voz está ativa
- **WHEN** o usuário percorre a barra de busca pelo teclado
- **THEN** o controle de microfone recebe o foco na ordem de leitura visual
- **AND** o foco é assinalado visualmente

#### Scenario: Estado de escuta comunicado além da cor

- **GIVEN** que a captura está em andamento
- **WHEN** o controle apresenta o estado de escuta
- **THEN** o estado é distinguível por forma, rótulo ou ícone, não apenas por cor
- **AND** o início da escuta é anunciado a leitores de tela

#### Scenario: Nenhuma fala reconhecida

- **GIVEN** que o usuário acionou o microfone
- **WHEN** a captura termina sem fala reconhecível
- **THEN** o campo de busca permanece inalterado
- **AND** o sistema informa que nada foi reconhecido

#### Scenario: Falha na transcrição

- **GIVEN** que o usuário ditou um termo
- **WHEN** a transcrição falha
- **THEN** o campo de busca permanece inalterado
- **AND** o sistema informa a falha
- **AND** o usuário pode acionar o microfone de novo ou digitar

### Requirement: Independência do restante da busca

A busca por voz é acessória. Sua ausência, desativação ou falha NÃO SHALL impedir a busca digitada nem qualquer outra funcionalidade.

O carregamento do modelo e a transcrição NÃO SHALL bloquear a interface: buscar, filtrar, paginar e abrir documentos continuam atendidos enquanto uma transcrição está em andamento.

#### Scenario: Aplicação plenamente utilizável sem a busca por voz

- **GIVEN** que a busca por voz nunca foi ativada
- **WHEN** o usuário usa a aplicação
- **THEN** todas as funcionalidades de busca, filtro e leitura funcionam normalmente

#### Scenario: Interface responsiva durante a transcrição

- **GIVEN** que uma transcrição está em andamento
- **WHEN** o usuário digita no campo de busca ou altera um filtro
- **THEN** a interface responde sem esperar o fim da transcrição
