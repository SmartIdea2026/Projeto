import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from '../../src/renderer/App';
import type { Documento, ResultadoBusca, StatusFonte } from '../../src/compartilhado/tipos';

/**
 * Autoria preenchida sem bloquear a lista.
 *
 * Cada documento custa uma requisição ao GitHub. Segurar a tela por até dez
 * delas trocaria um incômodo pequeno — a linha de autoria aparecer com atraso —
 * por uma espera sentida em toda navegação.
 */

const base: Documento = {
  id: 'github:o/r:ata.md',
  nome: 'ata.md',
  extensao: 'md',
  fonte: 'github',
  dataModificacao: '2026-08-01T00:00:00Z',
  dataAproximada: true,
  link: 'https://exemplo/ata',
  caminho: 'Docs/ata.md',
  repositorio: 'o/r'
};

const RECENTES: ResultadoBusca = {
  documentos: [base],
  total: 1,
  pagina: 1,
  falhas: [],
  avisos: [],
  doCache: false
};

const CONECTADO: StatusFonte[] = [{ fonte: 'github', estado: 'conectada', conta: 'equipe' }];

const api = {
  status: vi.fn(async () => CONECTADO),
  recentesDoCache: vi.fn(async () => null),
  recentes: vi.fn(async () => RECENTES),
  buscar: vi.fn(async () => RECENTES),
  detalharDocumentos: vi.fn(async (docs: Documento[]) => docs),
  verificarCredenciais: vi.fn(),
  definirCredencial: vi.fn(),
  removerCredencial: vi.fn(),
  abrirDocumento: vi.fn(),
  documentosAcessados: vi.fn(async () => [])
};

beforeEach(() => {
  vi.clearAllMocks();
  api.recentes.mockResolvedValue(RECENTES);
  Object.defineProperty(window, 'ancorai', { value: api, writable: true, configurable: true });
});

describe('preenchimento da autoria', () => {
  it('apresenta a lista antes de a autoria chegar', async () => {
    let liberar: (docs: Documento[]) => void = () => {};
    api.detalharDocumentos.mockImplementation(
      () => new Promise<Documento[]>((resolver) => { liberar = resolver; })
    );

    render(<App />);

    // O documento está na tela com a consulta de autoria ainda pendente.
    await waitFor(() => expect(screen.getByText('ata.md')).toBeInTheDocument());
    expect(screen.queryByText(/Alterado por/)).not.toBeInTheDocument();

    liberar([{ ...base, autor: 'GustavoMairinck', dataModificacao: '2026-08-22T10:00:00Z' }]);

    await waitFor(() =>
      expect(screen.getByText('Alterado por GustavoMairinck')).toBeInTheDocument()
    );
  });

  it('mantém a lista utilizável quando o detalhamento falha', async () => {
    api.detalharDocumentos.mockRejectedValue(new Error('rede indisponível'));

    render(<App />);

    await waitFor(() => expect(screen.getByText('ata.md')).toBeInTheDocument());
    // Sem autoria e sem erro: os campos são complemento, não requisito.
    expect(screen.queryByText(/Alterado por/)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('descarta o detalhamento quando a lista já mudou', async () => {
    let liberar: (docs: Documento[]) => void = () => {};
    api.detalharDocumentos.mockImplementation(
      () => new Promise<Documento[]>((resolver) => { liberar = resolver; })
    );

    render(<App />);
    await waitFor(() => expect(screen.getByText('ata.md')).toBeInTheDocument());

    // Chega o detalhe de um conjunto que não é mais o exibido.
    liberar([
      { ...base, id: 'github:o/r:outro.md', nome: 'outro.md', autor: 'Fulano' },
      { ...base, id: 'github:o/r:mais.md', nome: 'mais.md', autor: 'Ciclano' }
    ]);

    await waitFor(() => expect(screen.getByText('ata.md')).toBeInTheDocument());
    expect(screen.queryByText('outro.md')).not.toBeInTheDocument();
  });
});
