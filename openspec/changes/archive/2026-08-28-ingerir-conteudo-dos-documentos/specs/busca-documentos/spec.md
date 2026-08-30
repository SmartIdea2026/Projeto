# Especificação — Busca de documentos (delta)

**Issue:** #65

## MODIFIED Requirements

### Requirement: Acesso ao documento na fonte original

Cada resultado SHALL disponibilizar um link que direcione o usuário ao documento em sua fonte original.

O sistema SHALL registrar localmente os documentos cujos links foram acessados.

O registro de acesso NÃO SHALL conter o conteúdo do documento. O sistema mantém o texto dos documentos em armazenamento próprio, descrito na capacidade `conteudo-documentos`, e essa manutenção é independente do registro de acesso: um documento pode ter seu texto armazenado sem nunca ter sido acessado, e ser acessado sem que seu texto esteja armazenado.

A forma de visualizar um documento NÃO SHALL depender do texto que o sistema armazena. O usuário é sempre direcionado à fonte original.

#### Scenario: Usuário acessa um documento

- **GIVEN** que um resultado está sendo exibido
- **WHEN** o usuário aciona o link do documento
- **THEN** o documento é aberto em sua fonte original
- **AND** o sistema registra o acesso no armazenamento local

#### Scenario: Conteúdo não é armazenado

- **GIVEN** que um documento foi acessado
- **WHEN** o registro do acesso é gravado
- **THEN** apenas identificação, nome, fonte, link e data do acesso são armazenados no registro de acesso
- **AND** o conteúdo do documento não é gravado nesse registro

#### Scenario: Documento com texto armazenado é acessado da mesma forma

- **GIVEN** que o sistema já armazenou o texto de um documento apresentado como resultado
- **WHEN** o usuário aciona o link do documento
- **THEN** ele é direcionado ao documento na fonte original, como qualquer outro
- **AND** o texto armazenado não é apresentado ao usuário
