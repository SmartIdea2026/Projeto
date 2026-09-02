import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Cartao } from '../../src/renderer/componentes/Cartao';
import type { Documento } from '../../src/compartilhado/tipos';

/**
 * Marca "encontrado no conteúdo" no cartão de resultado.
 *
 * Assinala por que o documento está no resultado quando o termo casou só com o
 * texto — com ícone e rótulo, nunca só por cor —, e nunca traz o trecho onde o
 * termo ocorreu (ADR-0005).
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

describe('cartão com correspondência pelo conteúdo', () => {
  it('mostra a marca com ícone e rótulo textual quando apenasConteudo', () => {
    render(
      <Cartao documento={{ ...base, apenasConteudo: true }} aoAbrir={vi.fn()} />
    );

    const marca = screen.getByText('Encontrado no conteúdo');
    expect(marca).toBeInTheDocument();
    // O rótulo é textual — não depende de cor — e a classe própria o distingue.
    expect(marca.closest('.etiqueta--conteudo')).not.toBeNull();
    // Ícone decorativo, escondido do leitor de tela.
    expect(marca.closest('span')?.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('não mostra a marca quando o documento casou por nome ou autor', () => {
    render(<Cartao documento={base} aoAbrir={vi.fn()} />);

    expect(screen.queryByText('Encontrado no conteúdo')).toBeNull();
  });

  it('não apresenta trecho algum do texto do documento', () => {
    const { container } = render(
      <Cartao documento={{ ...base, apenasConteudo: true }} aoAbrir={vi.fn()} />
    );

    // A marca é a única coisa nova; nada do conteúdo do documento acompanha o cartão.
    expect(container.textContent).not.toMatch(/trecho|"texto"/i);
    expect(container.textContent).toContain('Encontrado no conteúdo');
  });
});
