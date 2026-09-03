# Tarefas — Categoria de documento a partir do resumo por IA

## 1. Vocabulário fechado do campo categoria

- [x] 1.1 Reescrever `instrucoes/resumo.md`: renomear o campo de `tipo` para `categoria`, listar os 14 rótulos fechados (`Ata, ADR, Especificação, Levantamento, Pesquisa, Processo, Padrão, Manual, Relatório, Contrato, Edital, Formulário, Glossário, Template`), remover o fallback genérico `"Documento"` — verificar lendo a instrução final
- [x] 1.2 Restringir o `responseSchema` em `gemini.ts` (campo `categoria`) com `enum` da lista fechada, e filtrar na interpretação da resposta qualquer valor fora dela — verificar com teste que a LLM nunca produz uma categoria fora da lista
- [x] 1.3 Renomear `tipo` para `categoria` em `ResultadoLLM`/`ResumoDocumento` (`compartilhado/tipos.ts`) e nos pontos que os consultam — verificar com `tsc`

## 2. Persistência espelhada em RegistroAcervo

- [x] 2.1 Adicionar `categoria?: string` e `categoriaVersaoConteudo?: string` a `RegistroAcervo` (`banco/repositorio.ts`) — verificar com teste de persistência
- [x] 2.2 Estender `gravarResumo()` para também escrever `categoria`/`categoriaVersaoConteudo` no registro do acervo correspondente, sempre que grava um resumo — verificar com teste que o valor aparece em `RegistroAcervo` depois de gravar um resumo
- [x] 2.3 Popular dinamicamente a lista de categorias a partir dos valores distintos já gravados no acervo — verificar com teste

## 3. Painel de resumo e cartão

- [x] 3.1 Remover a exibição de "Tipo identificado" de `PainelResumo.tsx` — verificar com teste de interface que não aparece mais
- [x] 3.2 Exibir a categoria como selo no cartão do documento (`Cartao.tsx`), reaproveitando a classe `etiqueta--categoria`, ausente quando o documento não tem categoria — verificar com teste de interface

## 4. Filtro por categoria na busca

- [x] 4.1 Implementar o filtro por categoria em `busca/regras.ts` (correspondência por igualdade, já que a categoria é um valor só) — verificar com teste
- [x] 4.2 Excluir do resultado, quando o filtro de categoria estiver aplicado, documentos sem categoria registrada — verificar com teste
- [x] 4.3 Adicionar o dropdown "Categoria" em `Filtros.tsx`, seleção única — verificar com teste de interface
- [x] 4.4 Implementar a limpeza do filtro de categoria, retornando à listagem completa — verificar com teste
- [x] 4.5 Incluir a categoria no conjunto de filtros que disparam nova consulta ao serem alterados — verificar com teste

## 5. Migração dos resumos existentes

- [x] 5.1 Escrever a migração que apaga `resumo`, `tipo`, `assuntos`, `destaques` e `resumoEm` de todo registro de `RegistroConteudo` com resumo gravado — reaproveitar o mesmo `$unset` que `gravarConteudo()` já usa quando `versaoConteudo` muda — verificar com teste que registros com resumo ficam sem esses campos, e registros sem resumo não são tocados
- [x] 5.2 Disparar a migração uma única vez, na abertura do banco (`abrirBanco()`) — verificar com teste que executá-la de novo não tem efeito colateral (idempotente)

## 6. Encerramento

- [x] 6.1 Executar a suíte completa, `tsc` nos dois projetos e o build — verificar que tudo passa
- [x] 6.2 Percorrer cada requisito dos deltas de `resumos-por-ia` e `busca-documentos` conferindo a correspondência com o código, cenário a cenário — verificar que nenhum cenário ficou sem contrapartida implementada
- [x] 6.3 Avaliar com o usuário se registra a ADR sugerida (vocabulário fechado + apagar-e-regerar em vez de migrar) — ver seção "ADR sugerida" do processo que originou esta proposta (decisão: sem ADR própria)
- [x] 6.4 Executar `/opsx:archive` para incorporar os deltas às especificações principais
