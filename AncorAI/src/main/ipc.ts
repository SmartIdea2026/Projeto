import { ipcMain, shell } from 'electron';
import { CANAIS } from '../compartilhado/canais';
import type { Documento, Filtros, Fonte } from '../compartilhado/tipos';
import { FILTROS_PADRAO } from '../compartilhado/tipos';
import { listarAcessados, registrarAcesso } from './banco/repositorio';
import * as cofre from './credenciais/cofre';
import * as servico from './busca/servico';

/**
 * Registro dos canais IPC.
 *
 * Este é o único ponto por onde o renderer alcança o processo principal. Cada
 * handler devolve dados já tratados: nenhum deles retorna o valor de uma
 * credencial, conforme a ADR-0003.
 */
export function registrarCanais(): void {
  ipcMain.handle(
    CANAIS.credenciaisDefinir,
    async (_evento, _fonte: Fonte, valor: string) => {
      // Valida antes de gravar: evita persistir uma credencial que já se sabe
      // inválida e permite devolver o erro imediatamente ao usuário.
      await servico.validarTokenGithub(valor);
      cofre.definir('github.token', valor);
      return servico.status();
    }
  );

  ipcMain.handle(CANAIS.credenciaisRemover, async (_evento, _fonte: Fonte) => {
    cofre.remover('github.token');
    return servico.status();
  });

  ipcMain.handle(CANAIS.credenciaisStatus, () => servico.status());

  // A verificação manual ignora o resultado guardado e consulta as APIs.
  ipcMain.handle(CANAIS.credenciaisVerificar, () => servico.status(false));

  ipcMain.handle(CANAIS.buscar, (_evento, filtros: Filtros) =>
    servico.buscar({ ...FILTROS_PADRAO, ...filtros })
  );

  ipcMain.handle(CANAIS.recentes, (_evento, filtros?: Filtros) =>
    servico.recentes({ ...FILTROS_PADRAO, ...filtros })
  );

  ipcMain.handle(CANAIS.recentesDoCache, (_evento, filtros?: Filtros) =>
    servico.recentesDoCache({ ...FILTROS_PADRAO, ...filtros })
  );

  ipcMain.handle(CANAIS.detalharDocumentos, (_evento, documentos: Documento[]) =>
    servico.detalhar(documentos)
  );

  ipcMain.handle(CANAIS.abrirDocumento, async (_evento, documento: Documento) => {
    await registrarAcesso(documento);
    await shell.openExternal(documento.link);
  });

  ipcMain.handle(CANAIS.documentosAcessados, () => listarAcessados());
}
