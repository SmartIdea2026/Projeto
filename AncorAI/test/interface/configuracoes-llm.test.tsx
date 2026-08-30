import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/renderer/App';
import type { ResultadoBusca } from '../../src/compartilhado/tipos';
import { LLM_AUSENTE, montarApi, instalarApi } from './apoio';

/**
 * Configuração da chave de IA e independência da busca em relação a ela.
 *
 * A chave da LLM não é uma fonte de documentos, e o teste que mais importa
 * aqui é o negativo: sem ela, a busca precisa continuar inteira. Tratá-la como
 * fonte faria a ausência da chave desligar o produto.
 */

const RESULTADO: ResultadoBusca = {
  documentos: [
    {
      id: 'github:org/repo:ata.md',
      nome: 'ata.md',
      extensao: 'md',
      fonte: 'github',
      dataModificacao: '2026-08-27T12:00:00Z',
      link: 'https://github.com/org/repo/blob/main/ata.md',
      repositorio: 'org/repo',
      versaoConteudo: 'sha-1'
    }
  ],
  total: 1,
  pagina: 1,
  falhas: [],
  avisos: [],
  doCache: false
};

async function abrirConfiguracoes() {
  await waitFor(() => expect(document.querySelector('.cartao__nome')).not.toBeNull());
  fireEvent.click(screen.getByRole('button', { name: /GitHub conectada/i }));
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
}

beforeEach(() => vi.clearAllMocks());

describe('campo da chave de IA', () => {
  it('grava a chave informada e passa a oferecer resumos', async () => {
    const api = montarApi(RESULTADO, {
      statusLLM: vi.fn(async () => LLM_AUSENTE)
    });
    instalarApi(api);
    render(<App />);
    await abrirConfiguracoes();

    fireEvent.change(screen.getByLabelText('Chave da API do Gemini'), {
      target: { value: 'AQ.Ab8RChaveDeTeste' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar chave' }));

    await waitFor(() =>
      expect(api.definirChaveLLM).toHaveBeenCalledWith('AQ.Ab8RChaveDeTeste')
    );
  });

  it('apresenta o motivo quando a chave é recusada, sem persistir nada', async () => {
    const api = montarApi(RESULTADO, {
      statusLLM: vi.fn(async () => LLM_AUSENTE),
      definirChaveLLM: vi.fn(async () => {
        throw new Error('A chave da API de IA não foi aceita.');
      })
    });
    instalarApi(api);
    render(<App />);
    await abrirConfiguracoes();

    fireEvent.change(screen.getByLabelText('Chave da API do Gemini'), {
      target: { value: 'chave-errada' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar chave' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'A chave da API de IA não foi aceita.'
      )
    );
  });

  it('mantém o aviso sobre envio de conteúdo acessível na tela', async () => {
    instalarApi(montarApi(RESULTADO));
    render(<App />);
    await abrirConfiguracoes();

    // O aviso fica na tela, e não só no primeiro uso: quem configura hoje pode
    // não ser quem confirmou o envio.
    expect(
      screen.getByText(/texto dos documentos é enviado a esse serviço externo/)
    ).toBeInTheDocument();
  });

  it('a chave nunca é reexibida: o campo é de senha e começa vazio', async () => {
    instalarApi(montarApi(RESULTADO));
    render(<App />);
    await abrirConfiguracoes();

    const campo = screen.getByLabelText('Chave da API do Gemini') as HTMLInputElement;
    expect(campo.type).toBe('password');
    expect(campo.value).toBe('');
  });
});

describe('a busca não depende da chave de IA', () => {
  it('lista os resultados normalmente sem chave configurada', async () => {
    instalarApi(
      montarApi(RESULTADO, {
        statusLLM: vi.fn(async () => LLM_AUSENTE),
        resumoGravado: vi.fn(async () => null),
        prepararConteudo: vi.fn(async () => ({ pronto: true, temResumo: false })),
        resumoDoDocumento: vi.fn(async () => ({
          resumo: null,
          motivo: 'sem-credencial',
          mensagem: 'Configure a chave da API de IA para gerar resumos.'
        }))
      })
    );
    render(<App />);

    await waitFor(() => expect(document.querySelectorAll('.cartao')).toHaveLength(1));
    // Consultado dentro do cartão: o painel também apresenta o nome, e uma
    // busca global casaria com os dois sem provar que a lista veio.
    expect(document.querySelector('.cartao .cartao__nome')?.textContent).toBe('ata.md');
  });

  it('a lista continua utilizável enquanto uma geração está pendente', async () => {
    const api = montarApi(RESULTADO, {
      resumoGravado: vi.fn(async () => null),
      prepararConteudo: vi.fn(async () => ({ pronto: true, temResumo: false })),
      // Nunca resolve: se a lista dependesse da geração, ela travaria aqui.
      resumoDoDocumento: vi.fn(() => new Promise(() => {}))
    });
    instalarApi(api);
    render(<App />);

    await waitFor(() => expect(screen.getByText('Gerando o resumo…')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Buscar pelo nome do documento'), {
      target: { value: 'ata' }
    });
    fireEvent.submit(screen.getByRole('search'));

    await waitFor(() => expect(api.buscar).toHaveBeenCalled());
    expect(document.querySelectorAll('.cartao')).toHaveLength(1);
  });
});

describe('o painel identifica a origem do documento', () => {
  it('apresenta o crachá da fonte junto ao nome', async () => {
    instalarApi(montarApi(RESULTADO));
    render(<App />);

    await waitFor(() => expect(document.querySelector('.painel')).not.toBeNull());
    const painel = document.querySelector('.painel') as HTMLElement;

    expect(painel.querySelector('.painel__nome')?.textContent).toBe('ata.md');
    expect(painel.querySelector('.painel__fonte')?.textContent).toBe('GitHub');
  });
});
