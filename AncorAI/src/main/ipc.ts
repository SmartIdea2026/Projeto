import { ipcMain, shell } from 'electron';
import { CANAIS } from '../compartilhado/canais';
import type { Documento, Filtros, Fonte } from '../compartilhado/tipos';
import { FILTROS_PADRAO } from '../compartilhado/tipos';
import { listarAcessados, registrarAcesso } from './banco/repositorio';
import * as cofre from './credenciais/cofre';
import * as servico from './busca/servico';
import { autorizar, esquecerAcesso } from './oauth/google';

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
    async (_evento, fonte: Fonte, valor: string) => {
      if (fonte === 'github') {
        // Valida antes de gravar: evita persistir uma credencial que já se sabe
        // inválida e permite devolver o erro imediatamente ao usuário.
        await servico.validarTokenGithub(valor);
        cofre.definir('github.token', valor);
      } else {
        cofre.definir('drive.clientId', valor);
      }
      return servico.status();
    }
  );

  ipcMain.handle(CANAIS.credenciaisRemover, async (_evento, fonte: Fonte) => {
    if (fonte === 'github') {
      cofre.remover('github.token');
    } else {
      cofre.remover('drive.clientId');
      cofre.remover('drive.refreshToken');
      esquecerAcesso();
    }
    return servico.status();
  });

  ipcMain.handle(CANAIS.credenciaisStatus, () => servico.status());

  // A verificação manual ignora o resultado guardado e consulta as APIs.
  ipcMain.handle(CANAIS.credenciaisVerificar, () => servico.status(false));

  ipcMain.handle(CANAIS.driveDefinirCliente, async (_evento, clientId: string) => {
    cofre.definir('drive.clientId', clientId);
    return servico.status();
  });

  ipcMain.handle(CANAIS.driveAutorizar, async () => {
    const clientId = cofre.obter('drive.clientId');
    if (!clientId) {
      throw new Error('Informe o Client ID do Google antes de conectar.');
    }
    const refreshToken = await autorizar(clientId);
    cofre.definir('drive.refreshToken', refreshToken);
    await servico.validarDrive(clientId, refreshToken);
    return servico.status();
  });

  ipcMain.handle(CANAIS.buscar, (_evento, filtros: Filtros) =>
    servico.buscar({ ...FILTROS_PADRAO, ...filtros })
  );

  ipcMain.handle(CANAIS.recentes, (_evento, filtros?: Filtros) =>
    servico.recentes({ ...FILTROS_PADRAO, ...filtros })
  );

  ipcMain.handle(CANAIS.recentesDoCache, (_evento, filtros?: Filtros) =>
    servico.recentesDoCache({ ...FILTROS_PADRAO, ...filtros })
  );

  ipcMain.handle(CANAIS.abrirDocumento, async (_evento, documento: Documento) => {
    await registrarAcesso(documento);
    await shell.openExternal(documento.link);
  });

  ipcMain.handle(CANAIS.documentosAcessados, () => listarAcessados());
}
