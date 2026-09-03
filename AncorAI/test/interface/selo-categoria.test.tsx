import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Cartao } from '../../src/renderer/componentes/Cartao';
import type { Documento } from '../../src/compartilhado/tipos';

/**
 * Selo de categoria no cartão do documento (categorizar-documentos-pelo-resumo).
 *
 * A categoria, inferida junto do resumo por IA, deixou de aparecer no painel
 * de resumo e passou a aparecer aqui — ao lado da extensão, distinta dela.
 */

const base: Documento = {
  id: 'github:org/repo:ata.md',
  nome: 'ata.md',
  extensao: 'md',
  fonte: 'github',
  dataModificacao: '2026-08-27T12:00:00Z',
  link: 'https://github.com/org/repo/blob/main/ata.md',
  repositorio: 'org/repo'
};

describe('selo de categoria no cartão', () => {
  it('mostra a categoria quando o documento tem uma', () => {
    render(<Cartao documento={{ ...base, categoria: 'Ata' }} aoAbrir={vi.fn()} />);

    const selo = screen.getByText('Ata');
    expect(selo.closest('.etiqueta--categoria')).not.toBeNull();
  });

  it('não mostra selo algum quando o documento não tem categoria', () => {
    render(<Cartao documento={base} aoAbrir={vi.fn()} />);

    expect(document.querySelector('.etiqueta--categoria')).toBeNull();
  });

  it('categoria e extensão aparecem juntas, cada uma com sua própria etiqueta', () => {
    render(<Cartao documento={{ ...base, categoria: 'ADR' }} aoAbrir={vi.fn()} />);

    expect(screen.getByText('MD')).toBeInTheDocument();
    expect(screen.getByText('ADR')).toBeInTheDocument();
    expect(screen.getByText('MD').closest('.etiqueta--categoria')).toBeNull();
  });
});
