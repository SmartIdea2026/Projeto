import { render, renderHook, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/renderer/App';
import type { Documento, ResultadoBusca } from '../../src/compartilhado/tipos';
import {
  useEtapaProlongada,
  type EtapaResumo
} from '../../src/renderer/componentes/PainelResumo';
import { LLM_AUSENTE, montarApi, instalarApi, resumoDe } from './apoio';

/**
 * Painel de resumo por IA.
 *
 * O eixo destes testes é a honestidade do que a tela afirma. Um painel que diz
 * "Gerando…" sem nada sendo gerado, ou que mostra o resumo do documento errado
 * porque a resposta chegou atrasada, funciona sem quebrar nada — e por isso
 * nenhum outro teste apanharia o problema.
 */

function documento(indice: number): Documento {
  return {
    id: `github:org/repo:doc${indice}.md`,
    nome: `doc${indice}.md`,
    extensao: 'md',
    fonte: 'github',
    dataModificacao: '2026-08-27T12:00:00Z',
    link: `https://github.com/org/repo/blob/main/doc${indice}.md`,
    caminho: `doc${indice}.md`,
    repositorio: 'org/repo',
    versaoConteudo: `sha-${indice}`
  };
}

const RESULTADO: ResultadoBusca = {
  documentos: [documento(1), documento(2)],
  total: 2,
  pagina: 1,
  falhas: [],
  avisos: [],
  doCache: false
};

const VAZIO: ResultadoBusca = { ...RESULTADO, documentos: [], total: 0 };

/** Espera o painel aparecer com o documento indicado. */
async function painelCom(nome: string) {
  await waitFor(() => {
    const painel = document.querySelector('.painel');
    expect(painel?.querySelector('.painel__nome')?.textContent).toBe(nome);
  });
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());

describe('foco do painel', () => {
  it('apresenta o primeiro documento da página ao concluir a busca', async () => {
    instalarApi(montarApi(RESULTADO));
    render(<App />);

    await painelCom('doc1.md');
    expect(screen.getByText('Resumo de doc1.md.')).toBeInTheDocument();
  });

  it('troca para outro documento sem alterar a lista', async () => {
    instalarApi(montarApi(RESULTADO));
    render(<App />);
    await painelCom('doc1.md');

    const nomesAntes = [...document.querySelectorAll('.cartao__nome')].map(
      (n) => n.textContent
    );

    const acoes = screen.getAllByRole('button', { name: /Gerar resumo/ });
    fireEvent.click(acoes[acoes.length - 1] as HTMLElement);

    await painelCom('doc2.md');
    const nomesDepois = [...document.querySelectorAll('.cartao__nome')].map(
      (n) => n.textContent
    );
    expect(nomesDepois).toEqual(nomesAntes);
  });

  it('marca o cartão em foco por texto, e não apenas por cor', async () => {
    instalarApi(montarApi(RESULTADO));
    render(<App />);
    await painelCom('doc1.md');

    expect(screen.getByRole('button', { name: /No painel/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('não apresenta painel quando a busca não retorna documentos', async () => {
    instalarApi(montarApi(VAZIO));
    render(<App />);

    await waitFor(() => expect(document.querySelector('.vazio')).not.toBeNull());
    expect(document.querySelector('.painel')).toBeNull();
  });

  it('abre o documento pela ação do painel', async () => {
    const api = montarApi(RESULTADO);
    instalarApi(api);
    render(<App />);
    await painelCom('doc1.md');

    fireEvent.click(screen.getByRole('button', { name: /Abrir documento no GitHub/ }));

    expect(api.abrirDocumento).toHaveBeenCalledWith(
      expect.objectContaining({ nome: 'doc1.md' })
    );
  });
});

describe('progresso corresponde a trabalho real', () => {
  it('apresenta o resumo já gravado de imediato, sem indicar geração', async () => {
    const api = montarApi(RESULTADO);
    instalarApi(api);
    render(<App />);

    await painelCom('doc1.md');
    expect(screen.getByText('Resumo de doc1.md.')).toBeInTheDocument();
    // O ponto do teste: nenhuma mensagem de geração para algo que já existia.
    expect(screen.queryByText(/Gerando/)).toBeNull();
    expect(screen.queryByText(/Lendo o documento/)).toBeNull();
    expect(api.resumoDoDocumento).not.toHaveBeenCalled();
  });

  it('nomeia a etapa de leitura enquanto o texto é obtido', async () => {
    let liberar: (v: unknown) => void = () => {};
    const api = montarApi(RESULTADO, {
      resumoGravado: vi.fn(async () => null),
      prepararConteudo: vi.fn(() => new Promise((r) => { liberar = r; })),
      // Pendente de propósito: sem isso a geração terminaria no mesmo instante
      // em que começa, e a etapa que se quer observar não existiria na tela.
      resumoDoDocumento: vi.fn(() => new Promise(() => {}))
    });
    instalarApi(api);
    render(<App />);

    await waitFor(() => expect(screen.getByText('Lendo o documento…')).toBeInTheDocument());

    await act(async () => {
      liberar({ pronto: true, temResumo: false });
    });

    await waitFor(() => expect(screen.getByText('Gerando o resumo…')).toBeInTheDocument());
  });

  it('avisa que está demorando só depois que a espera se prolonga', async () => {
    // Exercitado no próprio gancho, e não pela tela inteira: o que se verifica
    // é a regra temporal, e atravessar App, IPC e painel para chegar até ela
    // só acrescentaria formas de o teste falhar por outro motivo.
    const { result, rerender } = renderHook(
      ({ etapa }: { etapa: EtapaResumo | null }) => useEtapaProlongada(etapa, 40),
      { initialProps: { etapa: 'gerando' as EtapaResumo | null } }
    );

    expect(result.current).toBe('gerando');

    await waitFor(() => expect(result.current).toBe('demorando'), { timeout: 500 });

    // Trocar de documento reinicia a contagem: a espera nova começa do zero.
    rerender({ etapa: 'lendo' });
    expect(result.current).toBe('lendo');
    rerender({ etapa: 'gerando' });
    expect(result.current).toBe('gerando');
  });

  it('descarta a resposta do documento que saiu de foco', async () => {
    const pendentes = new Map<string, (v: unknown) => void>();
    const api = montarApi(RESULTADO, {
      resumoGravado: vi.fn(async () => null),
      prepararConteudo: vi.fn(async () => ({ pronto: true, temResumo: false })),
      resumoDoDocumento: vi.fn(
        (doc: Documento) =>
          new Promise((r) => {
            pendentes.set(doc.id, r);
          })
      )
    });
    instalarApi(api);
    render(<App />);

    await waitFor(() => expect(pendentes.has('github:org/repo:doc1.md')).toBe(true));

    // Antes de doc1 responder, o usuário pede doc2.
    const acoes = screen.getAllByRole('button', { name: /Gerar resumo/ });
    fireEvent.click(acoes[acoes.length - 1] as HTMLElement);
    await painelCom('doc2.md');

    // Agora doc1 responde, atrasado.
    await act(async () => {
      pendentes.get('github:org/repo:doc1.md')?.({ resumo: resumoDe(documento(1)) });
    });

    expect(screen.queryByText('Resumo de doc1.md.')).toBeNull();
    await painelCom('doc2.md');
  });
});

describe('consentimento antes do primeiro envio', () => {
  it('pede confirmação e não envia nada antes dela', async () => {
    const api = montarApi(RESULTADO, {
      statusLLM: vi.fn(async () => ({ estado: 'nao-configurada', consentido: false }))
    });
    instalarApi(api);
    render(<App />);

    await waitFor(() =>
      expect(screen.getByText(/texto dele é enviado ao Google Gemini/)).toBeInTheDocument()
    );
    expect(api.resumoDoDocumento).not.toHaveBeenCalled();
  });

  it('mantém a lista utilizável quando o envio é recusado', async () => {
    const api = montarApi(RESULTADO, {
      statusLLM: vi.fn(async () => ({ estado: 'conectada', consentido: false })),
      consentirEnvio: vi.fn(async () => ({ estado: 'conectada', consentido: false }))
    });
    instalarApi(api);
    render(<App />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Agora não' })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole('button', { name: 'Agora não' }));

    await waitFor(() =>
      expect(document.querySelectorAll('.cartao')).toHaveLength(2)
    );
    expect(api.resumoDoDocumento).not.toHaveBeenCalled();
  });
});

describe('indisponibilidade', () => {
  it('informa e oferece configurações quando não há chave', async () => {
    const api = montarApi(RESULTADO, {
      statusLLM: vi.fn(async () => LLM_AUSENTE),
      resumoGravado: vi.fn(async () => null),
      prepararConteudo: vi.fn(async () => ({ pronto: true, temResumo: false })),
      resumoDoDocumento: vi.fn(async () => ({
        resumo: null,
        motivo: 'sem-credencial',
        mensagem: 'Configure a chave da API de IA para gerar resumos.'
      })),
      consentirEnvio: vi.fn(async () => ({ estado: 'nao-configurada', consentido: true }))
    });
    instalarApi(api);
    render(<App />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Permitir e gerar resumos' })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole('button', { name: 'Permitir e gerar resumos' }));

    await waitFor(() =>
      expect(
        screen.getByText('Configure a chave da API de IA para gerar resumos.')
      ).toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: 'Abrir configurações' })).toBeInTheDocument();
  });

  it('a lista continua apresentada quando a geração falha', async () => {
    const api = montarApi(RESULTADO, {
      resumoGravado: vi.fn(async () => null),
      prepararConteudo: vi.fn(async () => ({ pronto: true, temResumo: false })),
      resumoDoDocumento: vi.fn(async () => ({
        resumo: null,
        motivo: 'cota-excedida',
        mensagem: 'O limite de requisições da chave gratuita foi atingido.'
      }))
    });
    instalarApi(api);
    render(<App />);

    await waitFor(() =>
      expect(
        screen.getByText('O limite de requisições da chave gratuita foi atingido.')
      ).toBeInTheDocument()
    );
    expect(document.querySelectorAll('.cartao')).toHaveLength(2);
  });

  it('oferece nova tentativa quando a falha é passageira, e refaz o pedido', async () => {
    let tentativas = 0;
    const api = montarApi(RESULTADO, {
      resumoGravado: vi.fn(async () => null),
      prepararConteudo: vi.fn(async () => ({ pronto: true, temResumo: false })),
      resumoDoDocumento: vi.fn(async () => {
        tentativas += 1;
        if (tentativas === 1) {
          return {
            resumo: null,
            motivo: 'falha',
            mensagem: 'O serviço de IA está sobrecarregado no momento.'
          };
        }
        return { resumo: resumoDe(documento(1)) };
      })
    });
    instalarApi(api);
    render(<App />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    // Sem este botão, a única saída de uma sobrecarga momentânea era trocar de
    // documento e voltar — que não é uma segunda tentativa, e sim um contorno.
    await waitFor(() =>
      expect(document.querySelector('.painel__texto')).not.toBeNull()
    );
  });

  it('não oferece nova tentativa quando repetir não mudaria nada', async () => {
    const api = montarApi(RESULTADO, {
      resumoGravado: vi.fn(async () => null),
      prepararConteudo: vi.fn(async () => ({
        pronto: false,
        temResumo: false,
        motivo: 'sem-texto',
        mensagem: 'Não há texto disponível neste documento para resumir.'
      }))
    });
    instalarApi(api);
    render(<App />);

    // Um documento sem texto continuará sem texto na tentativa seguinte.
    // Oferecer o botão seria convidar a um clique que não leva a lugar algum.
    await waitFor(() =>
      expect(
        screen.getByText('Não há texto disponível neste documento para resumir.')
      ).toBeInTheDocument()
    );
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).toBeNull();
  });

  it('avisa quando o documento não tem texto a resumir', async () => {
    const api = montarApi(RESULTADO, {
      resumoGravado: vi.fn(async () => null),
      prepararConteudo: vi.fn(async () => ({
        pronto: false,
        temResumo: false,
        motivo: 'sem-texto',
        mensagem: 'Planilhas não são lidas nesta versão.'
      }))
    });
    instalarApi(api);
    render(<App />);

    await waitFor(() =>
      expect(screen.getByText('Planilhas não são lidas nesta versão.')).toBeInTheDocument()
    );
    expect(api.resumoDoDocumento).not.toHaveBeenCalled();
  });
});

describe('avisos sobre a base do resumo', () => {
  it('informa quando o resumo se baseia em texto truncado', async () => {
    const truncado = { ...resumoDe(documento(1)), baseTruncada: true };
    instalarApi(montarApi(RESULTADO, { resumoGravado: vi.fn(async () => truncado) }));
    render(<App />);

    await waitFor(() =>
      expect(screen.getByText(/apenas na primeira parte/)).toBeInTheDocument()
    );
  });

  it('oferece regeração quando o documento mudou depois do resumo', async () => {
    const api = montarApi(RESULTADO, {
      resumoGravado: vi.fn(async () => ({
        ...resumoDe(documento(1)),
        desatualizado: true
      }))
    });
    instalarApi(api);
    render(<App />);

    // Resumo desatualizado não é reaproveitado em silêncio: o painel regera.
    await waitFor(() => expect(api.resumoDoDocumento).toHaveBeenCalled());
  });
});

describe('classificação apresentada junto do resumo', () => {
  it('mostra assuntos e destaques, mas não a categoria (vira selo no cartão)', async () => {
    instalarApi(montarApi(RESULTADO));
    render(<App />);
    await painelCom('doc1.md');

    expect(screen.queryByText('Tipo identificado:')).not.toBeInTheDocument();
    expect(screen.getByText('Assuntos detectados:')).toBeInTheDocument();
    expect(screen.getByText('Destaques principais')).toBeInTheDocument();
    expect(screen.getByText('Primeiro ponto')).toBeInTheDocument();
  });

  it('anuncia a troca do conteúdo do painel', async () => {
    instalarApi(montarApi(RESULTADO));
    render(<App />);
    await painelCom('doc1.md');

    const vivo = document.querySelector('.painel [aria-live="polite"]');
    expect(vivo).not.toBeNull();
    expect(vivo).toHaveAttribute('aria-atomic', 'true');
  });
});

describe('pilha de documentos relacionados', () => {
  function itemRelacionado(nome: string) {
    return {
      id: `github:org/repo:${nome}`,
      nome,
      fonte: 'github' as const,
      link: `https://github.com/org/repo/blob/main/${nome}`,
      score: 0.5
    };
  }

  it('lista os relacionados pelo nome', async () => {
    instalarApi(
      montarApi(RESULTADO, {
        relacionadosDoDocumento: vi.fn(async () => ({
          pilha: [itemRelacionado('guia.md')],
          semClassificacao: false
        }))
      })
    );
    render(<App />);
    await painelCom('doc1.md');

    await waitFor(() =>
      expect(screen.getByText('Documentos relacionados')).toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: 'guia.md' })).toBeInTheDocument();
  });

  it('indica progresso enquanto a pilha é montada', async () => {
    instalarApi(
      montarApi(RESULTADO, {
        relacionadosDoDocumento: vi.fn(() => new Promise(() => {}))
      })
    );
    render(<App />);
    await painelCom('doc1.md');

    await waitFor(() => expect(screen.getByText('Montando a pilha…')).toBeInTheDocument());
  });

  it('informa quando não há nenhum relacionado', async () => {
    instalarApi(
      montarApi(RESULTADO, {
        relacionadosDoDocumento: vi.fn(async () => ({ pilha: [], semClassificacao: false }))
      })
    );
    render(<App />);
    await painelCom('doc1.md');

    await waitFor(() =>
      expect(
        screen.getByText('Nenhum documento relacionado encontrado.')
      ).toBeInTheDocument()
    );
  });

  it('informa a falha sem derrubar o resumo', async () => {
    instalarApi(
      montarApi(RESULTADO, {
        relacionadosDoDocumento: vi.fn(async () => {
          throw new Error('falhou');
        })
      })
    );
    render(<App />);
    await painelCom('doc1.md');

    await waitFor(() =>
      expect(
        screen.getByText('Não foi possível montar os documentos relacionados.')
      ).toBeInTheDocument()
    );
    // O resumo continua na tela, e a ação de abrir também.
    expect(screen.getByText('Resumo de doc1.md.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Abrir documento no GitHub/ })
    ).toBeInTheDocument();
  });

  it('diz que a pilha aparece depois do resumo quando o foco não tem classificação', async () => {
    instalarApi(
      montarApi(RESULTADO, {
        relacionadosDoDocumento: vi.fn(async () => ({ pilha: [], semClassificacao: true }))
      })
    );
    render(<App />);
    await painelCom('doc1.md');

    await waitFor(() =>
      expect(
        screen.getByText(/aparecem depois que este documento tem um resumo/)
      ).toBeInTheDocument()
    );
  });

  it('apresenta o aviso de cobertura parcial como resultado parcial', async () => {
    instalarApi(
      montarApi(RESULTADO, {
        relacionadosDoDocumento: vi.fn(async () => ({
          pilha: [itemRelacionado('guia.md')],
          semClassificacao: false,
          aviso: { fonte: 'github', mensagem: '4 documento(s) ficaram fora da análise.' }
        }))
      })
    );
    render(<App />);
    await painelCom('doc1.md');

    await waitFor(() =>
      expect(screen.getByText('4 documento(s) ficaram fora da análise.')).toBeInTheDocument()
    );
    expect(screen.getByText('Resultado parcial:')).toBeInTheDocument();
  });

  it('acionar um relacionado troca o foco do painel sem mexer na lista', async () => {
    instalarApi(
      montarApi(RESULTADO, {
        relacionadosDoDocumento: vi.fn(async (documento: Documento) => ({
          pilha:
            documento.id === 'github:org/repo:doc1.md'
              ? [itemRelacionado('doc2.md')]
              : [],
          semClassificacao: false
        }))
      })
    );
    render(<App />);
    await painelCom('doc1.md');

    const nomesAntes = [...document.querySelectorAll('.cartao__nome')].map((n) => n.textContent);

    const item = await screen.findByRole('button', { name: 'doc2.md' });
    fireEvent.click(item);

    await painelCom('doc2.md');
    const nomesDepois = [...document.querySelectorAll('.cartao__nome')].map((n) => n.textContent);
    expect(nomesDepois).toEqual(nomesAntes);
  });

  it('refaz a pilha ao trocar de documento em foco', async () => {
    const relacionados = vi.fn(async () => ({ pilha: [], semClassificacao: false }));
    instalarApi(montarApi(RESULTADO, { relacionadosDoDocumento: relacionados }));
    render(<App />);
    await painelCom('doc1.md');

    const acoes = screen.getAllByRole('button', { name: /Gerar resumo/ });
    fireEvent.click(acoes[acoes.length - 1] as HTMLElement);
    await painelCom('doc2.md');

    await waitFor(() =>
      expect(relacionados).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'github:org/repo:doc2.md' })
      )
    );
  });

  it('não deixa a pilha do documento anterior aparecer depois da troca de foco', async () => {
    const pendentes = new Map<string, (v: unknown) => void>();
    instalarApi(
      montarApi(RESULTADO, {
        relacionadosDoDocumento: vi.fn(
          (documento: Documento) =>
            new Promise((resolver) => {
              pendentes.set(documento.id, resolver);
            })
        )
      })
    );
    render(<App />);
    await waitFor(() => expect(pendentes.has('github:org/repo:doc1.md')).toBe(true));

    const acoes = screen.getAllByRole('button', { name: /Gerar resumo/ });
    fireEvent.click(acoes[acoes.length - 1] as HTMLElement);
    await painelCom('doc2.md');

    // doc1 responde atrasado, com uma pilha que não é mais a do foco.
    await act(async () => {
      pendentes.get('github:org/repo:doc1.md')?.({
        pilha: [itemRelacionado('fantasma.md')],
        semClassificacao: false
      });
    });

    expect(screen.queryByText('fantasma.md')).toBeNull();
  });
});
