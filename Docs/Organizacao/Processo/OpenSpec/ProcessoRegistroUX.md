# Guia de Registro de UX no OpenSpec

## 1. Visão Geral
No contexto do **OpenSpec** (Desenvolvimento Orientado a Especificações), a UX precisa ser traduzida de protótipos visuais (como Figma) para arquivos de texto estruturados em Markdown. O Processo de Registro de UX garante que agentes de IA compreendam exatamente o que codificar na interface, eliminando adivinhações e perda de contexto.

## 2. Etapas do Processo de Registro

### Passo 1: Definição do Escopo e Intenção (`proposal.md`)
Antes de descrever botões ou cores, define-se qual problema a nova interface resolve. Qual é a jornada do usuário e qual o gatilho que o leva até essa tela?

### Passo 2: Mapeamento dos Deltas (`specs/ui-spec.md`)
O OpenSpec funciona baseado no "diferencial" (Delta). Em vez de reescrever ou descrever a tela inteira, documentamos apenas o que sofre impacto:
* **ADDED Requirements:** Novos componentes ou funcionalidades que entram na tela.
* **MODIFIED Requirements:** Elementos que já existem, mas terão seu comportamento, regras ou visual alterados.
* **REMOVED Requirements:** Elementos que deixam de existir no fluxo.

### Passo 3: Tratamento de Exceções e Estados
A IA não infere estados ocultos. É obrigatório o registro explícito de:
* **Estados de Interface:** *Default*, *Hover*, *Disabled*, *Loading* (carregamento) e *Success*.
* **Estados de Erro:** Regras de validação de formulários, timeouts ou falhas de requisição.
* **Acessibilidade (a11y):** Ordem de navegação via teclado, uso de leitores de tela e contrastes críticos.

### Passo 4: Ciclo de Vida do Comando (Fluxo OPSX)
1. `/opsx:propose`: A intenção da UX é rascunhada nos artefatos.
2. `/opsx:apply`: Após a revisão humana do documento Markdown (garantindo as regras de negócio), a IA executa as tarefas e gera o código da tela.
3. `/opsx:archive`: A especificação é validada e salva no histórico permanente da aplicação como fonte da verdade.

---

## 3. Template Padrão de UX (ui-spec.md)
*Copie a estrutura abaixo ao iniciar o registro de uma nova funcionalidade de interface na sua aplicação.*

```markdown
# Especificação de UX/UI - [Nome da Feature]

## 1. Contexto da Interface
* **Objetivo da Tela:** [Ex: Permitir que o usuário atualize seu perfil e foto]
* **Gatilho de Acesso:** [Ex: Clicar no avatar do usuário no cabeçalho superior direito]

## 2. ADDED Requirements (Adicionados)
* **[Nome do Componente]:** [Descreva a funcionalidade e o layout geral. Ex: Componente de Upload de foto com preview em tempo real circular.]
* **[Estados Visuais]:** [Ex: Default (borda tracejada cinza), Hover (fundo escurecido opacidade 50%), Loading (spinner animado giratório no centro).]

## 3. MODIFIED Requirements (Modificados)
* **[Nome do Componente]:** [Ex: Botão de "Salvar Alterações".]
* **[Mudança]:** [Ex: O botão muda da cor padrão azul para verde (#28a745) temporariamente por 3 segundos após o salvamento bem-sucedido.]

## 4. REMOVED Requirements (Removidos)
* **[Nome do Componente]:** [Ex: Campo "Confirmar Nova Senha" removido do fluxo de edição rápida do perfil.]

## 5. Tratamento de Erros e Acessibilidade
* **Regras de Validação:** [Ex: Se a imagem de upload for maior que 2MB, exibir mensagem de erro em vermelho diretamente abaixo do botão de upload informando o limite de tamanho.]
* **Acessibilidade (a11y):** [Ex: Todos os campos do formulário devem ser navegáveis via tecla TAB. A imagem de perfil deve conter a tag alt descritiva com o nome do usuário.]
```

## 4. Boas Práticas para a Equipe
1. **Seja Explícito:** A IA não tem "bom senso" visual. Se um botão precisa estar alinhado à direita, escreva isso.
2. **Foque no Comportamento:** Descreva "quando o usuário clicar em X, a tela exibe Y" em vez de apenas descrever o layout estático.
3. **Mantenha o Delta Limpo:** Só adicione aos arquivos Markdown aquilo que efetivamente muda no código.
