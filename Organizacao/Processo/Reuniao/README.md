# Processo de Registro de Atas de Reunião

## 1. Objetivo

Definir um processo padronizado para o registro, revisão, aprovação e armazenamento das Atas de Reunião do projeto.

O processo tem como objetivo garantir que todas as reuniões sejam documentadas de forma consistente, permitindo o acompanhamento das decisões, tarefas e encaminhamentos definidos durante os encontros.

## 2. Escopo

Este processo deve ser utilizado para registrar todas as reuniões relacionadas ao projeto, incluindo reuniões internas da equipe, reuniões com orientadores, responsáveis pelo projeto, profissionais envolvidos e demais reuniões relacionadas ao desenvolvimento do projeto.

## 3. Responsabilidades

Antes de cada reunião deverá ser definido um integrante responsável pela elaboração da ATA e outro integrante responsável pela revisão da mesma.

### 3.1 Responsável pelo registro

O responsável deverá:

* Registrar as informações discutidas durante a reunião;
* Gravar o áudio da reunião (quando permitido);
* Utilizar o formato padrão definido neste documento;
* Registrar decisões e encaminhamentos;
* Identificar os responsáveis pelas tarefas definidas;
* Gerar transcrição do áudio (quando gravado);
* Mandar prompt de geração da ATA para IA após a reunião;
* Criar o arquivo `.md`;
* Realizar os ajustes necessários após a revisão.

### 3.2 Responsável pela revisão

Após a elaboração, a ATA deverá ser revisada por outro integrante da equipe.

O revisor deverá verificar:

* Data e horário;
* Participantes;
* Assuntos discutidos;
* Decisões tomadas;
* Tarefas e responsáveis;
* Prazos definidos;
* Clareza e coerência das informações;
* Existência de informações incorretas ou faltantes.

Caso sejam identificados problemas, a ATA deverá retornar ao responsável pelo registro para correção.

## 4. Gravação de áudio

```text
OBS: 
Antes de realizar qualquer gravação, todos os participantes deverão ser informados sobre a gravação
e darem o consentimento necessário.
```

* A gravação **não substitui o registro da ATA**. Ela deverá ser utilizada apenas para auxiliar na recuperação de informações discutidas durante a reunião.

* Não é necessário transcrever integralmente o áudio na ATA.


### Armazenamento:

O arquivo de áudio deverá ser armazenado no Drive do `smartideaifes@gmail.com` e **não deverá ser armazenado, sob hipótese alguma, no repositório do projeto**.

* Caso a gravação não seja realizada, o responsável pela ATA deverá realizar o registro por meio de anotações durante a reunião.

### Transcrição de áudio

O áudio deverá ser anexado no NotebookLM, que fará automaticamente a transcrição do áudio.

## 5. Formato da ATA

### 5.1 Estrutura da ATA
Cada ATA deverá seguir o template encontrado em:

```text
templates/ata-template.md
```

Deverão ser registradas as seguintes informações:

* Data;
* Horário de início e término;
* Local ou modalidade;
* Participantes;
* Objetivo da reunião;
* Assuntos discutidos;
* Problemas ou pontos levantados;
* Decisões tomadas;
* Tarefas e encaminhamentos;
* Responsáveis pelas tarefas;
* Prazos, quando definidos.

### 5.2. Nome do arquivo

Cada reunião terá um arquivo próprio de ATA, em formato **Markdown (`.md`)**

O nome do arquivo deverá seguir o padrão:

```text
DD-MM-YYYY-descricao-curta.md
```

### Exemplos

```text
07-08-2026-reuniao-inicial.md
10-08-2026-reuniao-requisitos.md
```

### 5.3 Armazenamento da ATA

Cada ATA deverá ser armazenada no diretório `atas/`, seguindo o padrão:

```text
Organizacao/
└── Processo/
    └── Reuniao/
        ├── atas/
        │   ├── 07-08-2026-reuniao-inicial.md
        │   └── 10-08-2026-reuniao-requisitos.md
        ├── templates/
        │   └── ata-template.md
        └── README.md
```

* O diretório `atas/` armazenará todas as ATAs já registradas.
* O diretório `templates/` conterá apenas o arquivo de template que cada ATA deverá seguir.

## 6. Prompt padrão para gerar ATA

Para gerar uma nova ATA, será utilizado o [notebook] do (https://notebook.google.com/notebook/971a05bb-12ce-44cb-810a-63449fa521f4?authuser=1) NotebookLM que já possui o arquivo de template da ATA.

O usuário deverá:

* Anexar o arquivo de áudio ou as anotações da reunião.
* Copiar e colar o prompt abaixo e preencher os seguintes dados:
    * Data;
    * Horário de início e fim;
    * Local/modalidade;
    * Participantes, contendo nome e função/representação.

### Prompt

> Utilize o arquivo `ata-template.md` enviado em anexo como modelo para gerar a ATA da reunião.
>
> Preencha o template com base na transcrição ou anotações fornecidas.
>
> **Dados da reunião:**
>
> * Data: [DD/MM/YYYY]
> * Horário: [HH:MM às HH:MM]
> * Local/Modalidade: [local ou plataforma]
> * Participantes: [nome — função/representação]
>
> **Transcrição/Anotações:**
>
> [cole as anotações ou anexe a transcrição]
>
> Utilize linguagem formal, clara e objetiva. Gere a ATA em Markdown, seguindo a estrutura do template. Não invente informações que não estejam nos dados fornecidos.

## 7. Controle de alterações

As alterações realizadas nos arquivos deverão ser registradas por meio do controle de versão do Git.

ATAs não deverão ser excluídas sem justificativa.

Quando uma ATA precisar ser corrigida, deverá ser realizado um novo commit descrevendo a alteração realizada.

## 8. Critérios para considerar uma ATA registrada

Uma ATA será considerada registrada quando:

* O arquivo estiver no formato `.md`;
* O nome do arquivo seguir o padrão definido;
* Todos os tópicos do template tiverem sido preenchidos;
* As tarefas possuírem responsáveis, quando aplicável;
* A ATA tiver sido revisada;
* A ATA tiver sido aprovada;
* O arquivo estiver persistido no repositório Git conforme estrutura definida no tópico 6.

## 9. Resultado esperado

Ao seguir este processo, todas as reuniões do projeto deverão possuir um registro padronizado, revisado e versionado.

O processo permite manter um histórico das reuniões, decisões e encaminhamentos, facilitando a consulta das informações e o acompanhamento das atividades definidas pela equipe.
