// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ErroLLM,
  esquecerModelo,
  listarModelos,
  modeloEmUso,
  modeloParaResumo,
  resumir,
  verificarChave
} from '../../src/main/llm/gemini';

/**
 * Cliente da API do Gemini.
 *
 * Dois eixos: o segredo não pode escapar pela URL, e uma resposta que não
 * obedece ao formato pedido não pode ser tratada como se obedecesse. Saída
 * estruturada é um pedido feito ao modelo, não uma garantia dele.
 */

function resposta(corpo: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => corpo
  } as unknown as Response;
}

/** Envelope da API em torno do JSON que o modelo devolve. */
function comTexto(texto: string) {
  return resposta({ candidates: [{ content: { parts: [{ text: texto }] } }] });
}

const VALIDO = JSON.stringify({
  resumo: 'Ata da reunião.',
  tipo: 'Ata',
  assuntos: ['planejamento'],
  destaques: ['Decisão registrada']
});

/** Catálogo plausível, com o ruído que a API real devolve junto. */
const CATALOGO = {
  models: [
    { name: 'models/gemini-3-flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-3-pro', supportedGenerationMethods: ['generateContent'] },
    {
      name: 'models/gemini-3-flash-preview',
      supportedGenerationMethods: ['generateContent']
    },
    { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
    { name: 'models/imagen-4.0', supportedGenerationMethods: ['generateContent'] }
  ]
};

/** Responde ao catálogo e à geração, como a API faz. */
function apiCompleta(texto = VALIDO) {
  return vi.fn(async (url: string) =>
    url.includes(':generateContent') ? comTexto(texto) : resposta(CATALOGO)
  );
}

beforeEach(() => esquecerModelo());
afterEach(() => {
  esquecerModelo();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('a chave não vaza pela URL', () => {
  it('viaja em cabeçalho, e nunca no endereço requisitado', async () => {
    const chamadas: Array<{ url: string; headers: Record<string, string> }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, opcoes: { headers: Record<string, string> }) => {
        chamadas.push({ url, headers: opcoes.headers });
        return url.includes(':generateContent') ? comTexto(VALIDO) : resposta(CATALOGO);
      })
    );

    await resumir('CHAVE-SECRETA', 'instrução', { nome: 'a.md', texto: 'conteúdo' });

    // A API aceita a chave na query string. Aceitar essa forma a colocaria em
    // qualquer log de proxy, histórico ou mensagem de erro que registre a URL.
    for (const chamada of chamadas) {
      expect(chamada.url).not.toContain('CHAVE-SECRETA');
      expect(chamada.headers['x-goog-api-key']).toBe('CHAVE-SECRETA');
    }
  });
});

describe('uma submissão devolve os quatro campos', () => {
  it('faz uma requisição de geração só e interpreta a saída estruturada', async () => {
    const chamar = apiCompleta();
    vi.stubGlobal('fetch', chamar);

    const produzido = await resumir('k', 'instrução', { nome: 'a.md', texto: 'x' });

    const geracoes = chamar.mock.calls.filter(([url]) =>
      (url as string).includes(':generateContent')
    );
    expect(geracoes).toHaveLength(1);
    expect(produzido).toEqual({
      resumo: 'Ata da reunião.',
      tipo: 'Ata',
      assuntos: ['planejamento'],
      destaques: ['Decisão registrada']
    });
  });

  it('pede saída estruturada, em vez de analisar prosa livre', async () => {
    const corpos: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, opcoes: { body?: string }) => {
        if (!url.includes(':generateContent')) return resposta(CATALOGO);
        corpos.push(opcoes.body as string);
        return comTexto(VALIDO);
      })
    );

    await resumir('k', 'instrução da equipe', { nome: 'a.md', texto: 'x' });

    const enviado = JSON.parse(corpos[0] as string);
    expect(enviado.generationConfig.responseMimeType).toBe('application/json');
    expect(enviado.generationConfig.responseSchema.required).toEqual([
      'resumo',
      'tipo',
      'assuntos',
      'destaques'
    ]);
    expect(JSON.stringify(enviado.systemInstruction)).toContain('instrução da equipe');
  });
});

describe('resposta fora do formato é falha, não conteúdo', () => {
  it('recusa JSON ilegível', async () => {
    vi.stubGlobal('fetch', apiCompleta('isto não é json'));

    const erro = await resumir('k', 'i', { nome: 'a.md', texto: 'x' }).catch((e) => e);

    expect(erro).toBeInstanceOf(ErroLLM);
    expect((erro as ErroLLM).motivo).toBe('falha');
  });

  it('recusa objeto sem resumo, em vez de exibir campo vazio', async () => {
    vi.stubGlobal('fetch', apiCompleta(JSON.stringify({ tipo: 'Ata' })));

    const erro = await resumir('k', 'i', { nome: 'a.md', texto: 'x' }).catch((e) => e);

    expect(erro).toBeInstanceOf(ErroLLM);
  });

  it('recusa resposta vazia', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes(':generateContent') ? resposta({ candidates: [] }) : resposta(CATALOGO)
      )
    );

    const erro = await resumir('k', 'i', { nome: 'a.md', texto: 'x' }).catch((e) => e);

    expect(erro).toBeInstanceOf(ErroLLM);
  });

  it('tolera listas ausentes sem quebrar, desde que haja resumo', async () => {
    vi.stubGlobal('fetch', apiCompleta(JSON.stringify({ resumo: 'Texto.', tipo: 'Ata' })));

    const produzido = await resumir('k', 'i', { nome: 'a.md', texto: 'x' });

    expect(produzido.assuntos).toEqual([]);
    expect(produzido.destaques).toEqual([]);
  });
});

describe('modos de falha distinguidos', () => {
  it.each([
    [401, 'credencial-invalida'],
    [403, 'credencial-invalida'],
    [400, 'credencial-invalida'],
    [429, 'cota-excedida'],
    [500, 'falha']
  ] as const)('código %s vira motivo %s', async (status, motivo) => {
    vi.stubGlobal('fetch', vi.fn(async () => resposta(null, status)));

    const erro = await resumir('k', 'i', { nome: 'a.md', texto: 'x' }).catch((e) => e);

    expect((erro as ErroLLM).motivo).toBe(motivo);
  });

  it('queda de rede vira sem-conexao, e não credencial inválida', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      })
    );

    const erro = await resumir('k', 'i', { nome: 'a.md', texto: 'x' }).catch((e) => e);

    // A distinção decide o que a interface pede ao usuário: corrigir a chave
    // ou verificar a rede.
    expect((erro as ErroLLM).motivo).toBe('sem-conexao');
  });
});

describe('validação da chave', () => {
  it('confere sem gastar uma geração', async () => {
    const chamar = vi.fn(async () => resposta(CATALOGO));
    vi.stubGlobal('fetch', chamar);

    await verificarChave('k');

    const [url, opcoes] = chamar.mock.calls[0] as [string, { method?: string }];
    expect(opcoes.method).toBe('GET');
    expect(url).not.toContain(':generateContent');
  });

  it('recusa chave que não alcança modelo de texto algum', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        resposta({
          models: [
            { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] }
          ]
        })
      )
    );

    // Chave válida sem modelo utilizável era aceita e só falhava no primeiro
    // resumo — longe da tela onde o usuário poderia corrigir.
    await expect(verificarChave('k')).rejects.toBeInstanceOf(ErroLLM);
  });

  it('recusa chave inválida', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => resposta(null, 401)));

    await expect(verificarChave('k')).rejects.toBeInstanceOf(ErroLLM);
  });
});

describe('o modelo vem da API, não do código', () => {
  it('descarta o que não gera texto e escolhe um flash da versão mais alta', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => resposta(CATALOGO)));

    const disponiveis = await listarModelos('k');

    expect(disponiveis).not.toContain('text-embedding-004');
    expect(disponiveis).not.toContain('imagen-4.0');
    expect(await modeloParaResumo('k')).toBe('gemini-3-flash');
  });

  it('prefere estável a pré-lançamento', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        resposta({
          models: [
            {
              name: 'models/gemini-9-flash-preview',
              supportedGenerationMethods: ['generateContent']
            },
            { name: 'models/gemini-3-flash', supportedGenerationMethods: ['generateContent'] }
          ]
        })
      )
    );

    expect(await modeloParaResumo('k')).toBe('gemini-3-flash');
  });

  it('aceita o que houver quando não há flash', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        resposta({
          models: [
            { name: 'models/gemini-3-pro', supportedGenerationMethods: ['generateContent'] }
          ]
        })
      )
    );

    expect(await modeloParaResumo('k')).toBe('gemini-3-pro');
  });

  it('resolve uma vez por execução, sem consultar a cada resumo', async () => {
    const chamar = apiCompleta();
    vi.stubGlobal('fetch', chamar);

    await resumir('k', 'i', { nome: 'a.md', texto: 'x' });
    await resumir('k', 'i', { nome: 'b.md', texto: 'y' });

    const catalogos = chamar.mock.calls.filter(
      ([url]) => !(url as string).includes(':generateContent')
    );
    expect(catalogos).toHaveLength(1);
    expect(modeloEmUso()).toBe('gemini-3-flash');
  });

  it('prefere o modelo pedido pela equipe, mesmo diante de um mais novo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        resposta({
          models: [
            { name: 'models/gemini-4-flash', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/gemini-3.1-flash', supportedGenerationMethods: ['generateContent'] }
          ]
        })
      )
    );

    // A preferência vence os critérios automáticos: foi uma escolha tomada, e
    // não o resultado de uma ordenação.
    expect(await modeloParaResumo('k')).toBe('gemini-3.1-flash');
  });

  it('entre as variantes do preferido, fica com a plena e estável', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        resposta({
          models: [
            {
              name: 'models/gemini-3.1-flash-lite',
              supportedGenerationMethods: ['generateContent']
            },
            {
              name: 'models/gemini-3.1-flash-preview',
              supportedGenerationMethods: ['generateContent']
            },
            { name: 'models/gemini-3.1-flash', supportedGenerationMethods: ['generateContent'] }
          ]
        })
      )
    );

    expect(await modeloParaResumo('k')).toBe('gemini-3.1-flash');
  });

  it('cai na escolha automática quando o preferido não existe, sem quebrar', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => resposta(CATALOGO)));

    // O catálogo não tem o preferido. Exigi-lo repetiria o 404 que originou
    // toda esta descoberta de modelos; ficar sem resumo seria pior que
    // resumir com o vizinho.
    expect(await modeloParaResumo('k')).toBe('gemini-3-flash');
  });

  it('um 404 diz que o modelo não está disponível, e não só o código', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes(':generateContent') ? resposta(null, 404) : resposta(CATALOGO)
      )
    );

    const erro = await resumir('k', 'i', { nome: 'a.md', texto: 'x' }).catch((e) => e);

    expect((erro as ErroLLM).message).toContain('não está disponível para esta chave');
  });
});

describe('sobrecarga do serviço não é desistência', () => {
  /** Conta as gerações, que é o que a repetição multiplica. */
  function geracoesDe(chamar: { mock: { calls: unknown[][] } }) {
    return chamar.mock.calls.filter(([url]) => (url as string).includes(':generateContent'));
  }

  it('insiste depois de um 503 e entrega o resumo', async () => {
    vi.useFakeTimers();
    let geracoes = 0;
    const chamar = vi.fn(async (url: string) => {
      if (!url.includes(':generateContent')) return resposta(CATALOGO);
      geracoes += 1;
      // Sobrecarga momentânea: a segunda tentativa encontra o serviço livre.
      return geracoes === 1 ? resposta(null, 503) : comTexto(VALIDO);
    });
    vi.stubGlobal('fetch', chamar);

    const pendente = resumir('k', 'i', { nome: 'a.md', texto: 'x' });
    await vi.runAllTimersAsync();

    expect((await pendente).resumo).toBe('Ata da reunião.');
    expect(geracoesDe(chamar)).toHaveLength(2);
  });

  it('desiste depois das tentativas previstas, dizendo que o serviço está sobrecarregado', async () => {
    vi.useFakeTimers();
    const chamar = vi.fn(async (url: string) =>
      url.includes(':generateContent') ? resposta(null, 503) : resposta(CATALOGO)
    );
    vi.stubGlobal('fetch', chamar);

    const pendente = resumir('k', 'i', { nome: 'a.md', texto: 'x' }).catch((e) => e);
    await vi.runAllTimersAsync();
    const erro = await pendente;

    // A primeira tentativa mais as duas repetições previstas. Insistir sem
    // limite prenderia a fila de submissões em um serviço que está fora.
    expect(geracoesDe(chamar)).toHaveLength(3);
    expect((erro as ErroLLM).message).toContain('sobrecarregado');
  });

  it('não repete um 500, cuja causa documentada é a entrada e não a carga', async () => {
    vi.useFakeTimers();
    const chamar = vi.fn(async (url: string) =>
      url.includes(':generateContent') ? resposta(null, 500) : resposta(CATALOGO)
    );
    vi.stubGlobal('fetch', chamar);

    const pendente = resumir('k', 'i', { nome: 'a.md', texto: 'x' }).catch((e) => e);
    await vi.runAllTimersAsync();
    await pendente;

    // Repetir a mesma entrada só multiplicaria a espera antes da mesma recusa.
    expect(geracoesDe(chamar)).toHaveLength(1);
  });
});
