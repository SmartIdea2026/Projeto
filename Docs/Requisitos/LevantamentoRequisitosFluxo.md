# Levantamento de Requisitos e Fluxo do Sistema

## Introdução

Este documento reúne as decisões e definições realizadas pela equipe durante o levantamento de requisitos e planejamento do funcionamento do sistema. Seu objetivo é registrar o **fluxo de utilização, requisitos, regras de negócio e comportamentos** definidos para a versão inicial, além de manter documentadas decisões de escopo e funcionalidades consideradas para versões futuras.

## 1. Contexto e Escopo

A versão inicial do sistema será desenvolvida para uso exclusivo da equipe, com o objetivo de realizar **buscas por documentos armazenados no GitHub e no Google Drive e utilizar IA para gerar resumos dos documentos encontrado**s.

Nesta primeira versão, não serão implementados login, cadastro ou perfil de usuário. As integrações com GitHub, Google Drive e IA utilizarão APIs com configurações de acesso definidas estaticamente no código.

A busca será realizada a partir do nome dos arquivos e poderá considerar filtros de tipo de documento, fonte e período de data. Os resultados poderão ser ordenados e o primeiro documento listado terá seu resumo obtido ou gerado automaticamente.

A possibilidade de tornar o sistema dinâmico, permitindo seu uso por outros usuários, bem como funcionalidades dependentes da identificação do usuário, como o registro de arquivos acessados recentemente, ficam fora do escopo inicial e poderão ser consideradas em uma evolução futura.

## 2. Fluxo principal

Representa o **caminho feliz**, ou seja, quando tudo funciona normalmente.

```text
Acesso ao sistema
        ↓
Tela principal
        ↓
Usuário realiza a busca e define os filtros desejados
        ↓
Sistema consulta GitHub e/ou Google Drive via API
        ↓
Sistema processa, filtra e ordena os resultados
        ↓
Sistema identifica o primeiro resultado
        ↓
Resultados são exibidos
        ↓
Sistema verifica se já existe resumo armazenado
        ↓
             ┌───────────────┐
             │ Resumo existe?│
             └───────┬───────┘
                SIM  │  NÃO
                 ↓   │   ↓
        Recupera o   │  Solicita resumo
        resumo do    │  à IA via API
        banco        │       ↓
                 ↓   │  Indicador de resumo
                 │   │  sendo gerado
                 │   │       ↓
                 │   │  Persiste o novo
                 │   │  resumo no banco
                 └───┴───────┐
                             ↓
                    Resumo é apresentado
```

**A geração do resumo não deve impedir a apresentação dos resultados**. Quando um novo resumo precisar ser gerado pela IA, o sistema deve apresentar os resultados e indicar que o resumo está sendo gerado enquanto aguarda a resposta.

### Interações após a exibição dos resultados

A partir dos resultados apresentados, o usuário pode:

```text
                   Resultados exibidos
                          ↓
         ┌────────────────┼────────────────┐
         ↓                ↓                ↓
    Filtrar            Ordenar          Gerar resumo
    resultados         resultados       de outro
                                          documento
         ↓                ↓
   Nova busca       Reorganização dos
   nas APIs         resultados atuais
         │                │
         └────────┬───────┘
                  ↓
         Primeiro resultado
                  ↓
         Resumo obtido/gerado
```

O usuário também pode acessar o documento por meio do link disponibilizado para sua fonte original, seja GitHub ou Google Drive.

## 3. Requisitos funcionais

O que o sistema deve fazer.

| ID       | Requisito                                                                                                                                                                  | Prioridade |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **RF01** | O sistema deve permitir que o usuário realize buscas por documentos a partir de um termo informado.                                                                        | Must       |
| **RF02** | A busca deve comparar o termo informado pelo usuário com o nome dos arquivos, não sendo realizada, nesta versão, busca por palavras-chave ou pelo conteúdo dos documentos. | Must       |
| **RF03** | O sistema deve permitir definir filtros para a busca por tipo de documento, fonte e período de data.                                                                       | Must       |
| **RF04** | O filtro de tipo de documento deve considerar a extensão do arquivo.                                                                                                       | Must       |
| **RF05** | O sistema deve permitir selecionar GitHub ou Google Drive como fonte da busca.                                                                                             | Must       |
| **RF06** | Quando nenhuma fonte for selecionada, o sistema deve realizar a busca no GitHub e no Google Drive.                                                                         | Must       |
| **RF07** | Quando apenas uma fonte for selecionada, o sistema deve realizar a busca exclusivamente na fonte selecionada.                                                              | Must       |
| **RF08** | O filtro de data deve permitir definir um período por meio de data inicial e data final.                                                                                   | Must       |
| **RF09** | O sistema deve consultar o GitHub e/ou Google Drive por meio de suas respectivas APIs, conforme os parâmetros definidos para a busca.                                      | Must       |
| **RF10** | O sistema deve apresentar os resultados contendo nome completo do documento, extensão, data de criação e fonte.                                                            | Must       |
| **RF11** | O sistema deve permitir que o usuário altere os filtros após a realização da busca, realizando uma nova consulta às APIs conforme os filtros definidos.                    | Must       |
| **RF12** | O sistema deve permitir ordenar os resultados por A-Z, Z-A, data crescente e data decrescente.                                                                             | Must       |
| **RF13** | O sistema deve identificar o primeiro resultado da lista para obtenção ou geração automática de seu resumo.                                                                | Must       |
| **RF14** | O sistema deve verificar no banco de dados se já existe um resumo armazenado para o primeiro resultado.                                                                    | Must       |
| **RF15** | Caso exista um resumo armazenado, o sistema deve recuperá-lo do banco de dados.                                                                                            | Must       |
| **RF16** | Caso não exista um resumo armazenado, o sistema deve solicitar à IA, por meio de API, a geração de um resumo baseado no conteúdo completo do documento.                    | Must       |
| **RF17** | O sistema deve armazenar no banco de dados os resumos gerados pela IA.                                                                                                     | Must       |
| **RF18** | O sistema deve apresentar o resumo do primeiro resultado ao usuário.                                                                                                       | Must       |
| **RF19** | O sistema deve permitir que o usuário solicite a geração de resumo para outros documentos além do primeiro resultado.                                                      | Must       |
| **RF20** | O sistema deve disponibilizar um link para que o usuário possa acessar diretamente o documento em sua fonte original, seja GitHub ou Google Drive.                         | Must       |
| **RF21** | O sistema deve informar ao usuário quando uma busca não retornar resultados.                                                                                               | Must       |
| **RF22** | O sistema deve informar ao usuário quando ocorrer uma falha na comunicação com uma das APIs utilizadas.                                                                    | Must       |
| **RF23** | O sistema deve informar ao usuário quando ocorrer uma falha na geração de um resumo pela IA.                                                                               | Must       |
| **RF24** | O sistema deve apresentar um indicador de carregamento enquanto aguarda o retorno das APIs durante a busca.                                                                | Must       |
| **RF25** | O sistema deve apresentar um indicador de carregamento enquanto um resumo estiver sendo gerado pela IA.                                                                    | Must       |

## 4. Requisitos não funcionais e restrições técnicas

| ID        | Requisito                                                                                                                                         | Prioridade |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **RNF01** | O sistema deve realizar as integrações com GitHub, Google Drive e o serviço de IA por meio de APIs.                                               | Must       |
| **RNF02** | Na versão inicial, as configurações/credenciais de acesso às APIs serão estáticas e definidas diretamente no código da aplicação.                 | Must       |
| **RNF03** | O sistema deve realizar as operações de busca e processamento dos resultados de forma eficiente, proporcionando uma resposta adequada ao usuário. | Should     |

## 5. Regras e comportamentos do sistema
Esta seção reúne as condições e comportamentos definidos para o funcionamento do sistema.

### Busca

**RN01 — Critério da busca**  
O termo informado pelo usuário deve ser comparado com o nome do arquivo.

**RN02 — Conteúdo dos documentos**  
A busca não deve considerar palavras-chave ou o conteúdo interno dos documentos nesta versão.

**RN03 — Fontes da busca**  
A busca pode ser realizada no GitHub, no Google Drive ou em ambas as fontes.

**RN04 — Ausência de seleção de fonte**  
Quando nenhuma fonte for selecionada, o sistema deve considerar GitHub e Google Drive.

**RN05 — Seleção de uma fonte**  
Quando somente uma fonte for selecionada, a busca deve ser realizada exclusivamente nela.

**RN06 — Nova busca após alteração de filtros**  
Qualquer alteração nos filtros após a realização de uma busca deve resultar em uma nova consulta às APIs, independentemente do filtro alterado.

### Filtros

**RN07 — Tipo de documento**  
O tipo de documento é determinado pela extensão do arquivo. O sistema será utilizado para documentações em formato de texto.

**RN08 — Período**  
O filtro de data deve considerar um intervalo definido por uma data inicial e uma data final.

### Ordenação

**RN09 — Critérios de ordenação**  
Os resultados podem ser ordenados por:

- A-Z;
- Z-A;
- data crescente;
- data decrescente.

Outros critérios poderão ser definidos posteriormente.

**RN10 — Reorganização dos resultados**  
A alteração do critério de ordenação deve reorganizar os resultados conforme o critério selecionado.

**RN11 — Resumo após alteração da ordenação**  
Caso a alteração da ordenação faça outro documento ocupar a primeira posição, o sistema deve obter ou gerar o resumo desse novo primeiro resultado.

### Resumos e IA

**RN12 — Resumo do primeiro resultado**  
O primeiro documento listado deve ter seu resumo obtido ou gerado automaticamente, inclusive quando ele passar a ocupar a primeira posição após uma alteração na ordenação.

**RN13 — Verificação prévia**  
Antes de solicitar um novo resumo à IA, o sistema deve verificar no banco de dados se já existe um resumo armazenado para o documento.

**RN14 — Resumo existente**  
Caso exista um resumo armazenado, o sistema deve utilizá-lo, sem realizar uma nova solicitação à IA.

**RN15 — Resumo inexistente**  
Caso não exista um resumo armazenado, o sistema deve solicitar sua geração à IA por meio da API.

**RN16 — Conteúdo utilizado no resumo**  
A geração do resumo deve considerar o conteúdo completo do documento.

**RN17 — Persistência**  
Um resumo gerado pela IA deve ser armazenado no banco de dados para utilização futura.

**RN18 — Outros documentos**  
O resumo dos demais documentos não é gerado automaticamente. O usuário pode solicitar a geração do resumo de um documento específico.

**RN19 — Serviço de IA**  
A geração dos resumos será realizada utilizando a API gratuita do Gemini.

**RN20 — Geração sem bloqueio da exibição**  
A geração de um resumo pela IA não deve impedir a apresentação dos resultados da busca ao usuário.

**RN21 — Indicador de geração**  
Enquanto um resumo estiver sendo gerado pela IA, o sistema deve apresentar um indicador informando que o resumo está sendo gerado.

### Acesso aos documentos

**CB01 — Acesso ao documento**  
O sistema deve disponibilizar um link que direcione o usuário ao documento armazenado em sua fonte original, GitHub ou Google Drive.

### Indicadores de carregamento

**CB02 — Carregamento da busca**  
Enquanto o sistema aguarda o retorno das APIs durante uma busca, deve apresentar um indicador de carregamento dos resultados.

**CB03 — Carregamento do resumo**  
Caso o resumo do primeiro resultado precise ser gerado pela IA, o sistema deve apresentar os resultados da busca sem aguardar a conclusão da geração e exibir um indicador enquanto o resumo estiver sendo produzido.

### Cenários de exceção

**CB04 — Busca sem resultados**  
Caso nenhuma correspondência seja encontrada, o sistema deve informar o usuário de que não foram encontrados documentos.

**CB05 — Falha em uma das fontes**  
Caso a busca seja realizada no GitHub e no Google Drive e ocorra uma falha em apenas uma das fontes, o sistema deve apresentar os documentos obtidos pela fonte que funcionou e informar o usuário sobre a falha ocorrida na outra fonte.

**CB06 — Falha nas duas fontes**  
Caso ocorra uma falha na comunicação tanto com o GitHub quanto com o Google Drive durante uma busca, o sistema deve informar ao usuário que não foi possível realizar a busca.

**CB07 — Erro de API**  
Caso ocorra uma falha na comunicação com uma API utilizada pelo sistema, o usuário deve ser informado sobre a ocorrência.

**CB08 — Erro na geração do resumo**  
Caso ocorra uma falha durante a geração do resumo pela IA, o usuário deve ser informado.

## 6. Cenários principais

| Cenário                    | Comportamento esperado                                                                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Busca com resultados       | Os resultados encontrados são processados, ordenados e apresentados ao usuário, com o resumo do primeiro resultado obtido ou gerado.         |
| Busca sem resultados       | O sistema informa que nenhum documento foi encontrado.                                                                                       |
| Alteração de filtro        | O sistema realiza uma nova busca nas APIs conforme os filtros definidos.                                                                     |
| Alteração de ordenação     | Os resultados são reorganizados conforme o critério selecionado. Caso outro documento passe a ser o primeiro, seu resumo é obtido ou gerado. |
| Falha em uma das fontes    | Os resultados da fonte que funcionou são apresentados e o usuário é informado sobre a falha na outra fonte.                                  |
| Falha nas duas fontes      | O sistema informa ao usuário que não foi possível realizar a busca.                                                                          |
| Falha na geração do resumo | O sistema informa ao usuário que não foi possível gerar o resumo.                                                                            |
| Resumo já existente        | O sistema recupera o resumo armazenado, sem realizar nova solicitação à IA.                                                                  |
| Resumo inexistente         | O sistema solicita a geração à IA e apresenta um indicador enquanto aguarda o resumo.                                                        |
| Documento acessado         | O usuário utiliza o link disponibilizado para acessar o documento em sua fonte original.                                                     |
