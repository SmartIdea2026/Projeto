# documentos-recentes Specification

## Purpose
Apresentar os documentos modificados recentemente já na abertura da aplicação, sem exigir uma busca do usuário.

## Requirements

### Requirement: Rotina de inicialização

Ao ser iniciado, o sistema SHALL apresentar, abaixo da barra de busca, os documentos adicionados ou modificados mais recentemente em cada fonte configurada.

A rotina SHALL ser executada somente para as fontes cuja credencial for válida.

#### Scenario: Duas fontes configuradas e válidas

- **GIVEN** que as credenciais das fontes configuradas são válidas
- **WHEN** o sistema é iniciado
- **THEN** o sistema apresenta os documentos recentes de cada fonte configurada
- **AND** cada documento indica sua fonte de origem

#### Scenario: Apenas uma fonte válida

- **GIVEN** que somente uma credencial é válida
- **WHEN** o sistema é iniciado
- **THEN** o sistema apresenta os documentos recentes apenas dessa fonte
- **AND** informa que a outra fonte não está disponível

#### Scenario: Nenhuma credencial configurada

- **GIVEN** que nenhuma credencial foi configurada
- **WHEN** o sistema é iniciado
- **THEN** o sistema não consulta nenhuma fonte
- **AND** orienta o usuário a configurar as credenciais

#### Scenario: Falha ao obter documentos recentes

- **GIVEN** que uma credencial é válida
- **WHEN** a consulta à fonte falha
- **THEN** o sistema informa que não foi possível obter os documentos recentes daquela fonte
- **AND** a barra de busca permanece utilizável

### Requirement: Critério de recência

Os documentos recentes SHALL ser ordenados pela data de modificação, do mais recente para o mais antigo.

Somente documentos dos tipos aceitos pelo sistema SHALL ser apresentados.

#### Scenario: Ordenação da lista de recentes

- **GIVEN** que documentos recentes foram obtidos das fontes configuradas
- **WHEN** a lista é apresentada
- **THEN** os documentos aparecem do mais recentemente modificado para o mais antigo
- **AND** documentos de tipos não suportados não são apresentados

### Requirement: Apresentação imediata a partir de resultado anterior

Quando houver resultado de uma execução anterior, o sistema SHALL apresentá-lo imediatamente e atualizá-lo em segundo plano, sem bloquear a interface.

#### Scenario: Abertura com resultado anterior disponível

- **GIVEN** que o sistema foi aberto anteriormente e obteve documentos recentes
- **WHEN** o sistema é iniciado novamente
- **THEN** a lista anterior é apresentada imediatamente
- **AND** o sistema busca a versão atualizada em segundo plano
- **AND** substitui a lista quando a atualização for concluída

#### Scenario: Atualização em segundo plano falha

- **GIVEN** que uma lista anterior está sendo apresentada
- **WHEN** a atualização em segundo plano falha
- **THEN** a lista anterior permanece visível
- **AND** o sistema sinaliza que os dados podem estar desatualizados

### Requirement: Substituição pela busca

A lista de documentos recentes SHALL ocupar a área de resultados enquanto o campo de busca estiver vazio, sendo substituída pelos resultados quando uma busca for realizada.

#### Scenario: Usuário realiza uma busca

- **GIVEN** que a lista de documentos recentes está sendo apresentada
- **WHEN** o usuário realiza uma busca
- **THEN** a lista de recentes é substituída pelos resultados da busca

#### Scenario: Usuário limpa o campo de busca

- **GIVEN** que resultados de busca estão sendo apresentados
- **WHEN** o usuário limpa o campo de busca
- **THEN** a lista de documentos recentes volta a ser apresentada
- **AND** nenhuma nova consulta às fontes é necessária se a lista já estiver disponível
