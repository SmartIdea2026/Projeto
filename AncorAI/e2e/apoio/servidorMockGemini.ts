import { respostaJson, subirServidorMock, type ServidorMock } from './servidorHttp';

/**
 * Mock mínimo da API do Gemini para a suíte E2E — só `GET /models` e
 * `POST /models/{modelo}:generateContent` (ver design.md - Decisão 2 e o
 * contrato extraído de `src/main/llm/gemini.ts`). Cada teste sobe sua própria
 * instância e a fecha ao final.
 */

export interface ResumoMock {
  resumo: string;
  categoria?: string;
  assuntos: string[];
  destaques: string[];
}

export interface ConfigServidorGemini {
  /** `GET /models?pageSize=200` — catálogo de modelos disponíveis para a chave. */
  modelos?: { status?: number; nomes?: string[] };
  /** `POST /models/{modelo}:generateContent` — geração do resumo. */
  gerar?: { status?: number; resumo?: ResumoMock };
}

const MODELO_PADRAO = 'gemini-3.1-flash';

export async function subirServidorGemini(config: ConfigServidorGemini = {}): Promise<ServidorMock> {
  return subirServidorMock([
    {
      metodo: 'GET',
      caminho: '/models',
      manipulador: (_req, res) => {
        const status = config.modelos?.status ?? 200;
        if (status !== 200) {
          respostaJson(res, status, { error: { message: 'chave inválida (mock)' } });
          return;
        }
        const nomes = config.modelos?.nomes ?? [MODELO_PADRAO];
        respostaJson(res, 200, {
          models: nomes.map((nome) => ({
            name: `models/${nome}`,
            supportedGenerationMethods: ['generateContent']
          }))
        });
      }
    },
    {
      metodo: 'POST',
      caminho: /^\/models\/[^/]+:generateContent$/,
      manipulador: (_req, res) => {
        const status = config.gerar?.status ?? 200;
        if (status !== 200) {
          respostaJson(res, status, { error: { message: 'falha ao gerar o resumo (mock)' } });
          return;
        }
        const resumo = config.gerar?.resumo ?? {
          resumo: 'Resumo de exemplo gerado pelo mock.',
          categoria: 'Ata',
          assuntos: ['assunto-e2e'],
          destaques: ['Destaque de exemplo.']
        };
        respostaJson(res, 200, {
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(resumo) }]
              }
            }
          ]
        });
      }
    }
  ]);
}
