import {
  abrirBanco,
  fecharBanco,
  gravarConteudo,
  gravarResumo,
  inventarioSincronizado,
  sincronizarInventario
} from '../src/main/banco/repositorio';
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

/**
 * `sincronizarInventario` substitui o inventário inteiro pela lista recebida
 * (remove qualquer documento fora dela) — correto para uma varredura real,
 * mas armadilha para semear vários documentos em chamadas separadas: a
 * segunda chamada apagaria o que a primeira gravou. Esta função lê o
 * inventário já existente e o preserva, upsertando só o documento novo.
 */
async function sincronizarAcrescentando(documento: Documento): Promise<void> {
  const existentes = await inventarioSincronizado();
  const outros = existentes.filter((atual) => atual.id !== documento.id);
  await sincronizarInventario([...outros, documento]);
}

export async function semearAcervo(diretorioDados: string): Promise<void> {
  await abrirBanco(diretorioDados);
  await sincronizarInventario(DOCUMENTOS);
  fecharBanco();
}

/**
 * Semeia um documento com texto já extraído localmente (`conteudo_documentos`),
 * sem passar por `versaoConteudo` no inventário — o que faz `estaVigente()`
 * (`src/main/conteudo/ingestao.ts`) considerar o texto local já válido, sem
 * checar o GitHub (design.md - Decisão 3). Usado pelo teste de resumo por IA:
 * só o Gemini precisa ser mockado, nunca o GitHub.
 */
export async function semearComTexto(
  diretorioDados: string,
  opcoes: { documento: Documento; texto: string }
): Promise<void> {
  await abrirBanco(diretorioDados);
  await sincronizarAcrescentando(opcoes.documento);
  await gravarConteudo({
    _id: opcoes.documento.id,
    versaoConteudo: 'semeado-e2e',
    estado: 'extraido',
    texto: opcoes.texto,
    truncado: false
  });
  fecharBanco();
}

/**
 * Semeia um documento com resumo e rótulos (`assuntos`/`categoria`) já
 * gravados, sem passar por `versaoConteudo` no inventário — mesma lógica de
 * `semearComTexto`. Usado pelo teste de documentos relacionados: `pilha.ts`
 * opera inteiramente sobre esses rótulos, sem tocar rede alguma.
 */
export async function semearComResumo(
  diretorioDados: string,
  opcoes: {
    documento: Documento;
    resumo: string;
    categoria: string;
    assuntos: string[];
    destaques: string[];
  }
): Promise<void> {
  await abrirBanco(diretorioDados);
  await sincronizarAcrescentando(opcoes.documento);
  await gravarConteudo({
    _id: opcoes.documento.id,
    versaoConteudo: 'semeado-e2e',
    estado: 'extraido',
    texto: opcoes.resumo,
    truncado: false
  });
  await gravarResumo(
    opcoes.documento.id,
    {
      resumo: opcoes.resumo,
      categoria: opcoes.categoria,
      assuntos: opcoes.assuntos,
      destaques: opcoes.destaques
    },
    'semeado-e2e'
  );
  fecharBanco();
}
