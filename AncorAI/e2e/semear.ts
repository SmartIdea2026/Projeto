import { abrirBanco, fecharBanco, sincronizarInventario } from '../src/main/banco/repositorio';
import type { Documento } from '../src/compartilhado/tipos';

/**
 * Semeia o snapshot local (`acervo_documentos`) usado pela busca, sem passar
 * pelo GitHub — reaproveita o mesmo módulo de repositório que o app usa em
 * produção (o caminho já exercido por `test/persistencia/repositorio.test.ts`),
 * em vez de escrever o arquivo NeDB na mão.
 *
 * Existindo um snapshot não vazio, `buscar()` do processo main serve a busca
 * inteiramente dele (ver `src/main/busca/servico.ts`), sem tocar rede nem
 * credenciais — é isso que permite a PoC dispensar mock de GitHub/Gemini.
 */

export const TERMO_DISTINTIVO = 'zorbatrix';
export const NOME_DOCUMENTO_ALVO = 'ata-zorbatrix-planejamento.md';

const DOCUMENTOS: Documento[] = [
  {
    id: 'e2e-doc-alvo',
    nome: NOME_DOCUMENTO_ALVO,
    extensao: 'md',
    fonte: 'github',
    dataModificacao: '2026-08-20T12:00:00.000Z',
    link: 'https://github.com/exemplo/repo/blob/main/ata-zorbatrix-planejamento.md',
    repositorio: 'exemplo/repo'
  },
  {
    id: 'e2e-doc-outro',
    nome: 'roadmap-produto.md',
    extensao: 'md',
    fonte: 'github',
    dataModificacao: '2026-08-18T09:30:00.000Z',
    link: 'https://github.com/exemplo/repo/blob/main/roadmap-produto.md',
    repositorio: 'exemplo/repo'
  }
];

export async function semearAcervo(diretorioDados: string): Promise<void> {
  await abrirBanco(diretorioDados);
  await sincronizarInventario(DOCUMENTOS);
  fecharBanco();
}
