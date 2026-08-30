import type { MotivoSemResumo } from '../../compartilhado/tipos';

/**
 * Cliente da API do Google Gemini, por HTTP direto e sem SDK.
 *
 * Mesma disciplina adotada para o GitHub: um punhado de endpoints não justifica
 * a dependência, e o tratamento de falha fica explícito em vez de escondido
 * atrás de uma camada que envelhece à parte.
 *
 * A chave viaja em cabeçalho, e **não** na URL. A API aceita as duas formas; a
 * segunda coloca o segredo em qualquer log de proxy, histórico ou mensagem de
 * erro que registre a URL requisitada.
 */

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * O modelo NÃO é fixado no código.
 *
 * Fixá-lo custou um 404 em produção: o nome escolhido na implementação já não
 * existia para a chave do usuário. O Google renomeia e aposenta modelos, e um
 * identificador chumbado aqui envelhece sem aviso — o sintoma é a geração
 * inteira parar de funcionar por um motivo que não aparece em teste algum.
 *
 * Em vez disso o sistema pergunta à API quais modelos a chave alcança e
 * escolhe entre eles. A escolha é resolvida uma vez por execução.
 */
let modeloResolvido: string | null = null;

/** Descarta o modelo resolvido, forçando nova consulta. */
export function esquecerModelo(): void {
  modeloResolvido = null;
}

/** Modelo escolhido nesta execução, se já houver. Para diagnóstico. */
export function modeloEmUso(): string | null {
  return modeloResolvido;
}

interface ModeloApi {
  name: string;
  supportedGenerationMethods?: string[];
}

/**
 * Modelos que a chave alcança e que servem para gerar texto.
 *
 * A API devolve muito mais que geradores de texto — embeddings, imagem, áudio,
 * vídeo. O filtro por `generateContent` já exclui a maioria; a lista de
 * exclusão cobre os que anunciam o método mas produzem outra coisa.
 */
export async function listarModelos(chave: string): Promise<string[]> {
  const dados = (await requisitar('/models?pageSize=200', chave)) as {
    models?: ModeloApi[];
  };

  return (dados.models ?? [])
    .filter((modelo) => modelo.supportedGenerationMethods?.includes('generateContent'))
    .map((modelo) => modelo.name.replace(/^models\//, ''))
    .filter((nome) => !/embedding|aqa|imagen|veo|tts|audio|image|vision/i.test(nome));
}

/**
 * Critérios de escolha, em ordem de prioridade.
 *
 * Valem entre as variantes do modelo preferido quando ele existe, e entre todo
 * o catálogo quando não existe.
 *
 * Uma pontuação somada não serve aqui: o peso da versão acabava anulando a
 * penalidade de pré-lançamento por coincidência aritmética, e um modelo
 * instável ganhava de um estável sem que ninguém tivesse decidido isso.
 * Critérios em ordem tornam a política explícita e impossível de empatar por
 * acidente.
 *
 * 1. **Estável antes de pré-lançamento.** O motivo desta mudança inteira é não
 *    depender de um nome que muda sem aviso.
 * 2. **Flash antes do resto.** É a família rápida e barata, que é o que um
 *    resumo pede e o que o plano gratuito comporta.
 * 3. **Completo antes de "lite".** O lite serve, mas resume pior.
 * 4. **Versão maior antes de menor.**
 */
function classificar(nome: string): number[] {
  const versao = /(\d+)(?:[.-](\d+))?/.exec(nome);
  return [
    /preview|exp|experimental/i.test(nome) ? 0 : 1,
    /flash/i.test(nome) ? 1 : 0,
    /lite/i.test(nome) ? 0 : 1,
    versao ? Number(versao[1]) * 100 + Number(versao[2] ?? 0) : 0
  ];
}

/** Compara dois modelos pelos critérios acima, do mais forte ao mais fraco. */
function comparar(a: string, b: string): number {
  const criteriosA = classificar(a);
  const criteriosB = classificar(b);
  for (let i = 0; i < criteriosA.length; i += 1) {
    const diferenca = (criteriosB[i] as number) - (criteriosA[i] as number);
    if (diferenca !== 0) return diferenca;
  }
  return a.localeCompare(b);
}

/**
 * Modelo pedido pela equipe.
 *
 * É uma **preferência**, e não uma imposição: se o catálogo da chave não o
 * tiver, a escolha automática assume. Chumbar um nome sem essa saída foi o que
 * custou um 404 — o modelo escolhido na implementação já não existia para a
 * chave do usuário, e a geração inteira parou.
 *
 * A comparação aceita as variantes do mesmo nome (`-lite`, `-preview`), e entre
 * elas valem os critérios de `classificar`: a versão plena e estável vem antes.
 */
const PREFERIDO = 'gemini-3.1-flash';

/** Melhor modelo disponível para a chave, resolvido uma vez por execução. */
export async function modeloParaResumo(chave: string): Promise<string> {
  if (modeloResolvido) return modeloResolvido;

  const disponiveis = await listarModelos(chave);
  if (disponiveis.length === 0) {
    throw new ErroLLM(
      'credencial-invalida',
      'Nenhum modelo de geração de texto está disponível para esta chave.'
    );
  }

  const pedidos = disponiveis.filter(
    (nome) => nome === PREFERIDO || nome.startsWith(`${PREFERIDO}-`)
  );

  // Sem o preferido no catálogo, escolhe entre o que há. Preferir não é exigir:
  // ficar sem resumo algum seria pior que resumir com o modelo vizinho.
  const escolhido = [...(pedidos.length > 0 ? pedidos : disponiveis)].sort(
    comparar
  )[0] as string;
  modeloResolvido = escolhido;
  return escolhido;
}

/** Falha da LLM já traduzida no motivo que a interface precisa apresentar. */
export class ErroLLM extends Error {
  constructor(
    readonly motivo: MotivoSemResumo,
    mensagem: string
  ) {
    super(mensagem);
    this.name = 'ErroLLM';
  }
}

function cabecalhos(chave: string): HeadersInit {
  return {
    'x-goog-api-key': chave,
    'Content-Type': 'application/json'
  };
}

/**
 * Traduz o código HTTP no motivo correspondente.
 *
 * A distinção não é preciosismo: cada motivo pede uma ação diferente de quem
 * está olhando a tela — corrigir a chave, esperar, ou verificar a rede.
 */
function motivoDoCodigo(status: number): MotivoSemResumo {
  if (status === 400 || status === 401 || status === 403) return 'credencial-invalida';
  if (status === 429) return 'cota-excedida';
  return 'falha';
}

/**
 * Espera entre novas tentativas, em milissegundos, uma entrada por repetição.
 *
 * O 503 do Gemini significa serviço sobrecarregado, e a documentação do Google
 * manda repetir com espera crescente. É uma falha do outro lado, momentânea e
 * alheia à chave, ao documento e à requisição — desistir na primeira transforma
 * um soluço de alguns segundos em um resumo que o usuário precisa pedir de novo.
 *
 * O 500 fica de fora de propósito: sua causa documentada é a própria entrada
 * (contexto longo demais), que não muda ao repetir. Insistir só multiplicaria a
 * espera antes da mesma recusa.
 */
const ESPERAS_MS = [1_000, 3_000];

/** Pausa entre tentativas. Isolada para o teste poder avançar o relógio. */
function pausar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mensagem do código HTTP.
 *
 * O 404 tem texto próprio porque significa uma coisa só aqui — o modelo não
 * existe para esta chave — e "respondeu com o código 404" não diz isso a
 * ninguém. Foi exatamente o que aconteceu ao fixar o nome do modelo no código.
 */
function mensagemDoCodigo(status: number, motivo: MotivoSemResumo): string {
  if (status === 503) {
    return (
      'O serviço de IA está sobrecarregado no momento. ' +
      'Isso costuma passar em alguns minutos; tente novamente.'
    );
  }
  if (status === 404) {
    return (
      'O modelo de IA não está disponível para esta chave. ' +
      'Verifique se a chave do Google AI Studio tem acesso a algum modelo de geração de texto.'
    );
  }
  if (motivo === 'credencial-invalida') return 'A chave da API de IA não foi aceita.';
  if (motivo === 'cota-excedida') {
    return 'O limite de requisições da chave gratuita foi atingido. Tente novamente mais tarde.';
  }
  return `O serviço de IA respondeu com o código ${status}.`;
}

async function requisitar(
  caminho: string,
  chave: string,
  corpo?: unknown
): Promise<unknown> {
  for (let tentativa = 0; ; tentativa += 1) {
    let resposta: Response;
    try {
      resposta = await fetch(`${BASE}${caminho}`, {
        method: corpo ? 'POST' : 'GET',
        headers: cabecalhos(chave),
        ...(corpo ? { body: JSON.stringify(corpo) } : {})
      });
    } catch {
      throw new ErroLLM('sem-conexao', 'Não foi possível alcançar o serviço de IA.');
    }

    if (resposta.ok) return resposta.json();

    // Sobrecarga momentânea do serviço: espera e insiste, enquanto houver
    // tentativa prevista. Qualquer outro código é definitivo para esta
    // requisição e vira erro na primeira vez.
    const espera = resposta.status === 503 ? ESPERAS_MS[tentativa] : undefined;
    if (espera === undefined) {
      const motivo = motivoDoCodigo(resposta.status);
      throw new ErroLLM(motivo, mensagemDoCodigo(resposta.status, motivo));
    }

    await pausar(espera);
  }
}

/**
 * Confere se a chave é aceita, sem gastar uma geração para descobrir.
 *
 * Verifica também que existe **algum** modelo de texto ao alcance dela. Antes
 * isto consultava um modelo de nome fixo: uma chave válida cujo acesso não
 * incluísse aquele nome era aceita na configuração e só falhava depois, na
 * primeira tentativa de resumo — longe da tela onde o usuário poderia agir.
 */
export async function verificarChave(chave: string): Promise<void> {
  esquecerModelo();
  await modeloParaResumo(chave);
}

/** O que uma submissão devolve, em uma resposta só. */
export interface ResultadoLLM {
  resumo: string;
  tipo: string;
  assuntos: string[];
  destaques: string[];
}

/**
 * Formato exigido da resposta.
 *
 * Pedir saída estruturada é o que permite obter os quatro campos de uma vez.
 * A alternativa — prosa livre e extração por análise do texto — seria heurística
 * sobre heurística, e quebraria em silêncio quando o modelo mudasse de estilo.
 */
const ESQUEMA = {
  type: 'object',
  properties: {
    resumo: { type: 'string' },
    tipo: { type: 'string' },
    assuntos: { type: 'array', items: { type: 'string' } },
    destaques: { type: 'array', items: { type: 'string' } }
  },
  required: ['resumo', 'tipo', 'assuntos', 'destaques']
};

interface RespostaApi {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

function extrairTexto(resposta: unknown): string {
  const partes = (resposta as RespostaApi).candidates?.[0]?.content?.parts;
  const texto = partes?.map((parte) => parte.text ?? '').join('') ?? '';
  if (!texto.trim()) {
    throw new ErroLLM('falha', 'O serviço de IA devolveu uma resposta vazia.');
  }
  return texto;
}

/**
 * Valida a resposta antes de confiar nela.
 *
 * Saída estruturada é um pedido, não uma garantia: a resposta pode vir fora do
 * formato. Tratar isso como falha de geração — e não deixar passar um objeto
 * meio preenchido — é o que impede o painel de exibir campos vazios como se
 * fossem conteúdo.
 */
function interpretar(texto: string): ResultadoLLM {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    throw new ErroLLM('falha', 'O serviço de IA devolveu uma resposta ilegível.');
  }

  const objeto = bruto as Partial<ResultadoLLM>;
  const lista = (valor: unknown): string[] =>
    Array.isArray(valor) ? valor.filter((item): item is string => typeof item === 'string') : [];

  if (typeof objeto.resumo !== 'string' || objeto.resumo.trim() === '') {
    throw new ErroLLM('falha', 'O serviço de IA devolveu um resumo vazio.');
  }

  return {
    resumo: objeto.resumo.trim(),
    tipo: typeof objeto.tipo === 'string' ? objeto.tipo.trim() : '',
    assuntos: lista(objeto.assuntos),
    destaques: lista(objeto.destaques)
  };
}

/** Produz resumo, tipo, assuntos e destaques em uma única submissão. */
export async function resumir(
  chave: string,
  instrucao: string,
  documento: { nome: string; texto: string }
): Promise<ResultadoLLM> {
  const modelo = await modeloParaResumo(chave);

  const resposta = await requisitar(`/models/${modelo}:generateContent`, chave, {
    systemInstruction: { parts: [{ text: instrucao }] },
    contents: [
      {
        role: 'user',
        parts: [{ text: `Arquivo: ${documento.nome}\n\n${documento.texto}` }]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: ESQUEMA
    }
  });

  return interpretar(extrairTexto(resposta));
}
