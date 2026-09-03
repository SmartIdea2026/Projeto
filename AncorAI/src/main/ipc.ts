import { ipcMain, shell } from 'electron';
import { CANAIS, EVENTOS_VOZ } from '../compartilhado/canais';
import type { AjusteMicrofoneVoz, Documento, Filtros, Fonte } from '../compartilhado/tipos';
import { FILTROS_PADRAO } from '../compartilhado/tipos';
import { categoriasDisponiveis, listarAcessados, registrarAcesso } from './banco/repositorio';
import * as cofre from './credenciais/cofre';
import * as servico from './busca/servico';
import { estadoDaSincronizacao, ingerirAcervo } from './conteudo/ingestao';
import * as resumos from './llm/resumos';
import * as voz from './voz/servico';
import { pilhaDe } from './relacoes/pilha';

/**
 * Registro dos canais IPC.
 *
 * Este é o único ponto por onde o renderer alcança o processo principal. Cada
 * handler devolve dados já tratados: nenhum deles retorna o valor de uma
 * credencial (ADR-0003), nem o conteúdo de um documento (ADR-0005).
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

  // Reorganiza o conjunto já obtido. Não consulta fonte alguma enquanto os
  // filtros recebidos descreverem a mesma consulta que o produziu.
  ipcMain.handle(CANAIS.reordenar, (_evento, filtros: Filtros) =>
    servico.reordenar({ ...FILTROS_PADRAO, ...filtros })
  );

  ipcMain.handle(CANAIS.detalharDocumentos, (_evento, documentos: Documento[]) =>
    servico.detalhar(documentos)
  );

  // Devolve o andamento em contagens. O texto ingerido permanece no processo
  // principal: não há canal que o entregue ao renderer (ADR-0005).
  ipcMain.handle(CANAIS.indexarConteudo, () => ingerirAcervo());

  // Retrato do andamento — estado e contagens. O texto ingerido não acompanha
  // (ADR-0005); ver a nota do canal em `compartilhado/canais.ts`.
  ipcMain.handle(CANAIS.sincronizacaoEstado, () => estadoDaSincronizacao());

  ipcMain.handle(CANAIS.llmDefinir, (_evento, valor: string) =>
    resumos.definirChave(valor)
  );

  ipcMain.handle(CANAIS.llmRemover, () => resumos.removerChave());

  ipcMain.handle(CANAIS.llmStatus, () => resumos.status());

  ipcMain.handle(CANAIS.llmConsentir, async (_evento, valor: boolean) => {
    await resumos.registrarConsentimento(valor);
    return resumos.status();
  });

  // Devolve o resumo, e nunca o texto de onde ele saiu.
  ipcMain.handle(
    CANAIS.resumoDoDocumento,
    (_evento, documento: Documento, regerar?: boolean) =>
      resumos.resumoDoDocumento(documento, regerar ?? false)
  );

  ipcMain.handle(CANAIS.resumoGravado, (_evento, documento: Documento) =>
    resumos.resumoGravado(documento)
  );

  // Devolve situação — pronto, tem resumo, motivo — e nunca o texto em si.
  ipcMain.handle(CANAIS.prepararConteudo, (_evento, documento: Documento) =>
    resumos.prepararConteudo(documento)
  );

  // Devolve a pilha de relacionados — identificação, nome, link e rótulos em
  // comum. O texto de onde os rótulos saíram não acompanha (ADR-0005).
  ipcMain.handle(CANAIS.relacionadosDoDocumento, (_evento, documento: Documento) =>
    pilhaDe(documento.id)
  );

  ipcMain.handle(CANAIS.categoriasDisponiveis, () => categoriasDisponiveis());

  ipcMain.handle(CANAIS.abrirDocumento, async (_evento, documento: Documento) => {
    await registrarAcesso(documento);
    await shell.openExternal(documento.link);
  });

  ipcMain.handle(CANAIS.documentosAcessados, () => listarAcessados());

  // Devolve o texto da fala do próprio usuário — não conteúdo de documento
  // (ver a nota do canal em `compartilhado/canais.ts`). O áudio é processado no
  // worker de voz e descartado; não sai da máquina.
  ipcMain.handle(CANAIS.vozTranscrever, (_evento, pcm: ArrayBuffer) =>
    voz.transcrever(pcm)
  );

  ipcMain.handle(CANAIS.vozModeloEstado, () => voz.estado());

  ipcMain.handle(CANAIS.vozAtivar, (evento, valor: boolean) =>
    voz.ativar(valor, (progresso) => {
      if (!evento.sender.isDestroyed()) {
        evento.sender.send(EVENTOS_VOZ.modeloProgresso, progresso);
      }
    })
  );

  // Consentimento do primeiro uso e escolha do microfone. Devolve o estado
  // atualizado — nunca áudio nem transcrição.
  ipcMain.handle(CANAIS.vozMicrofone, (_evento, ajuste: AjusteMicrofoneVoz) =>
    voz.ajustarMicrofone(ajuste ?? {})
  );
}
