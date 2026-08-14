# Padronização de Mensagens de Commit

Toda mensagem de commit deve seguir a seguinte estrutura:

```text
<tipo>(<escopo opcional>): <descrição breve>

<corpo obrigatório>

Refs: #<número da issue>
```

## 1. Componentes

* **tipo:** indica a natureza da alteração realizada (ex.: `feat`, `fix`, `docs`). É **obrigatório**.
* **escopo:** indica a parte do projeto afetada pela alteração (ex.: `login`, `cadastro`, `readme`). É **opcional**, mas recomendado quando ajuda a esclarecer o contexto da mudança.
* **descrição breve:** resume, de forma direta, o que foi feito no commit. É **obrigatória**.
* **corpo:** explica com mais detalhes o que foi alterado e, se necessário, o motivo da alteração. É **obrigatório**, especialmente para mudanças mais complexas.
* **número da issue:** utilizado para referenciar issues, tarefas do quadro Kanban ou fechar uma issue. Deve ser informado ao final do corpo utilizando `Refs:` ou `Close:`.

### Exemplo

```text
feat(cadastro): adicionar validação de CPF

Implementa a validação do campo CPF no formulário de cadastro
do estudante, impedindo o envio de dados inválidos.

Refs: #27
```

Para fechar automaticamente uma issue:

```text
fix(login): corrigir validação de credenciais

Corrige a validação das credenciais no processo de autenticação,
impedindo que usuários com dados inválidos sejam autenticados.

Close: #32
```

## 2. Tipos de Commit

| Tipo       | Quando utilizar                                                                                                                  |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `feat`     | Adição de uma nova funcionalidade ao projeto.                                                                                    |
| `fix`      | Correção de um erro (bug).                                                                                                       |
| `docs`     | Alterações apenas em documentação, como README, arquivos em `/Organizacao`, comentários, etc.                                    |
| `style`    | Alterações que não afetam o funcionamento do código, como formatação, espaçamento e indentação.                                  |
| `refactor` | Alteração no código que não corrige um erro nem adiciona uma funcionalidade, apenas reorganiza ou melhora a estrutura existente. |
| `test`     | Adição ou ajuste de testes.                                                                                                      |
| `chore`    | Tarefas de manutenção que não alteram código de produção nem testes, como configurações, dependências e arquivos de build.       |
| `perf`     | Alterações que melhoram o desempenho do sistema.                                                                                 |
| `ci`       | Alterações relacionadas a arquivos e scripts de integração contínua.                                                             |

## 3. Escopo

O escopo é opcional, mas deve ser utilizado quando ajudar a identificar qual parte do projeto foi modificada.

### Exemplos

```text
feat(login): adicionar autenticação por e-mail
fix(cadastro): corrigir validação de CPF
docs(readme): atualizar instruções de instalação
test(usuario): adicionar testes para criação de usuário
refactor(api): reorganizar estrutura dos serviços
ci(github-actions): atualizar workflow de testes
```

Quando a alteração afetar diferentes partes do sistema e não houver um escopo adequado, o escopo pode ser omitido:

```text
chore: atualizar dependências do projeto
```

## 4. Descrição

A descrição deve:

* Ser curta e objetiva.
* Informar claramente o que foi alterado.
* Evitar informações desnecessárias.
* Preferencialmente utilizar verbos no infinitivo.
* Não terminar com ponto final.

### Exemplos

```text
feat(login): adicionar autenticação de usuários
fix(api): corrigir retorno de erro 404
docs(readme): atualizar instruções de instalação
test(cadastro): adicionar testes para validação de CPF
```

## 5. Corpo do Commit

O corpo deve explicar com mais detalhes a alteração realizada e, quando necessário, seu motivo.

O corpo é **obrigatório** e deve ser separado da descrição por uma linha em branco.

### Exemplo

```text
refactor(api): reorganizar estrutura dos serviços

Separa as responsabilidades dos serviços de autenticação e
gerenciamento de usuários, facilitando a manutenção e os testes
do sistema.

Refs: #41
```

Para alterações simples, o corpo ainda deve existir:

```text
docs(readme): corrigir instruções de instalação

Corrige os comandos utilizados para configurar o ambiente local.

Refs: #18
```

## 6. Referência de Issues

Todo commit deve possuir uma referência a uma issue ou tarefa.

### Referenciar uma issue

Utilize:

```text
Refs: #27
```

Esse formato indica que o commit está relacionado à issue, mas não necessariamente a encerra.

### Fechar uma issue

Quando o commit concluir a issue, utilize:

```text
Close: #27
```

### Exemplo

```text
feat(cadastro): implementar formulário de cadastro

Implementa o formulário de cadastro de estudantes com validação
dos campos obrigatórios e integração com a API.

Close: #27
```

## 7. Exemplos por Tipo

### `feat`

```text
feat(usuario): adicionar recuperação de senha

Implementa o fluxo de recuperação de senha por e-mail, permitindo
que o usuário solicite um novo acesso.

Refs: #45
```

### `fix`

```text
fix(login): corrigir autenticação de usuário

Corrige o tratamento das credenciais inválidas durante o login,
evitando o retorno incorreto de autenticação bem-sucedida.

Close: #52
```

### `docs`

```text
docs(readme): atualizar documentação de instalação

Adiciona as instruções necessárias para configurar o ambiente
de desenvolvimento local.

Refs: #31
```

### `style`

```text
style(frontend): padronizar indentação dos componentes

Aplica o padrão de indentação definido para os arquivos do
frontend sem alterar o comportamento da aplicação.

Refs: #36
```

### `refactor`

```text
refactor(api): reorganizar camada de serviços

Move as regras de negócio para a camada de serviços e reduz a
responsabilidade dos controladores.

Refs: #48
```

### `test`

```text
test(usuario): adicionar testes de criação de usuário

Adiciona testes para validar a criação de usuários com dados
válidos e inválidos.

Refs: #55
```

### `chore`

```text
chore(dependencies): atualizar dependências do projeto

Atualiza as dependências para suas versões compatíveis mais
recentes e remove pacotes que não são mais utilizados.

Refs: #61
```

### `perf`

```text
perf(database): otimizar consulta de usuários

Adiciona índices nas colunas utilizadas nas consultas mais
frequentes, reduzindo o tempo de resposta.

Refs: #67
```

### `ci`

```text
ci(github-actions): adicionar execução automática de testes

Configura o workflow para executar os testes automaticamente
a cada push e pull request.

Refs: #72
```

## 8. Checklist

Antes de realizar um commit, verifique:

* [ ] O tipo do commit está correto.
* [ ] O escopo foi informado quando necessário.
* [ ] A descrição é breve e objetiva.
* [ ] O corpo explica a alteração realizada.
* [ ] A issue ou tarefa foi referenciada.
* [ ] `Refs:` ou `Close:` está no final do corpo.
* [ ] A mensagem segue a estrutura definida neste documento.

## 9. Estrutura para Uso

Utilize o seguinte modelo:

```text
<tipo>(<escopo opcional>): <descrição breve>

<explicação detalhada da alteração realizada e, quando necessário,
o motivo da alteração.>

Refs: #<número da issue>
```

### Exemplo completo

```text
feat(cadastro): adicionar validação de CPF

Implementa a validação do campo CPF no formulário de cadastro
do estudante, impedindo o envio de dados inválidos e fornecendo
mensagens de erro para os campos preenchidos incorretamente.

Close: #27
```
