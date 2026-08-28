import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CANAIS } from '../../src/compartilhado/canais';

/**
 * Garante a fronteira de segurança da ADR-0003.
 *
 * Estes testes existem porque o vazamento que eles previnem seria silencioso:
 * expor uma credencial ao renderer não quebra nenhuma funcionalidade, então
 * nenhum outro teste falharia por causa disso.
 */

const raiz = join(__dirname, '../..');

/**
 * Remove comentários antes da inspeção.
 *
 * Sem isso, a prosa que descreve a própria fronteira — "o renderer não tem como
 * obter um token" — seria lida como se fosse código que a viola.
 */
function semComentarios(caminho: string): string {
  return readFileSync(join(raiz, caminho), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

const preload = semComentarios('src/preload/index.ts');
const canais = semComentarios('src/main/ipc.ts');
const janela = semComentarios('src/main/janela.ts');
const tipos = semComentarios('src/compartilhado/tipos.ts');

describe('fronteira entre renderer e main', () => {
  it('não expõe nenhuma operação de leitura de credencial no preload', () => {
    // `obter` é a única função do cofre que devolve o valor de um segredo.
    expect(preload).not.toMatch(/\bobter\b/);
    expect(preload).not.toMatch(/cofre/i);
  });

  it('não importa o cofre de credenciais no processo do renderer', () => {
    expect(preload).not.toMatch(/from '.*credenciais/);
  });

  it('expõe apenas canais declarados', () => {
    const declarados = Object.values(CANAIS);
    const invocados = [...preload.matchAll(/CANAIS\.(\w+)/g)].map((achado) => achado[1]);

    for (const nome of invocados) {
      expect(declarados).toContain(CANAIS[nome as keyof typeof CANAIS]);
    }
    expect(invocados.length).toBeGreaterThan(0);
  });

  it('nenhum tipo trafegado carrega campo de credencial', () => {
    expect(tipos).not.toMatch(/\btoken\s*:/i);
    expect(tipos).not.toMatch(/\bsecret\b/i);
    expect(tipos).not.toMatch(/\bclientId\s*:/);
  });

  it('o status das fontes carrega apenas estado e identificação da conta', () => {
    const bloco = tipos.slice(
      tipos.indexOf('interface StatusFonte'),
      tipos.indexOf('interface FalhaFonte')
    );
    expect(bloco).toMatch(/estado:/);
    expect(bloco).not.toMatch(/token|refresh|secret/i);
  });

  it('mantém o isolamento de contexto e o Node fora do renderer', () => {
    expect(janela).toMatch(/contextIsolation:\s*true/);
    expect(janela).toMatch(/nodeIntegration:\s*false/);
  });

  it('o canal de gravação de credencial responde com status, não com o segredo', () => {
    // O main referencia o canal pela constante, não pela string literal.
    const inicio = canais.indexOf('CANAIS.credenciaisDefinir');
    expect(inicio).toBeGreaterThan(-1);
    const trecho = canais.slice(inicio);
    const corpo = trecho.slice(0, trecho.indexOf('ipcMain.handle', 10));
    expect(corpo).toMatch(/servico\.status\(\)/);
    expect(corpo).not.toMatch(/return\s+valor/);
  });
});
