import { useState } from 'react';
import type { StatusFonte } from '../../compartilhado/tipos';

interface Props {
  status: StatusFonte[];
  aoFechar: () => void;
  aoAtualizarStatus: (status: StatusFonte[]) => void;
}

const DESCRICAO_ESTADO: Record<string, string> = {
  conectada: 'Conectada',
  invalida: 'Credencial inválida',
  'nao-configurada': 'Não configurada',
  'sem-conexao': 'Sem conexão',
  verificando: 'Verificando…'
};

export function Configuracoes({ status, aoFechar, aoAtualizarStatus }: Props) {
  const [token, setToken] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<Record<string, string>>({});

  const github = status.find((item) => item.fonte === 'github');

  async function executar(chave: string, acao: () => Promise<StatusFonte[]>) {
    setOcupado(chave);
    setErro((atual) => ({ ...atual, [chave]: '' }));
    try {
      aoAtualizarStatus(await acao());
      if (chave === 'github') setToken('');
    } catch (falha) {
      const mensagem =
        falha instanceof Error ? falha.message.replace(/^Error: /, '') : 'Falha inesperada.';
      setErro((atual) => ({ ...atual, [chave]: mensagem }));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div
      className="modal-fundo"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-config"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) aoFechar();
      }}
    >
      <div className="modal">
        <h2 id="titulo-config">Configurações</h2>
        <p className="modal__descricao">
          As credenciais são protegidas pelo chaveiro do sistema operacional e nunca
          ficam visíveis na interface depois de salvas.
        </p>

        <section className="campo">
          <div className="campo__rotulo">
            <span>GitHub</span>
            <span>{DESCRICAO_ESTADO[github?.estado ?? 'nao-configurada']}</span>
          </div>
          <p className="campo__ajuda">
            {github?.estado === 'conectada'
              ? `Conectado como ${github.conta}. Informe um novo token para substituir.`
              : 'Informe um Personal Access Token com permissão de leitura nos repositórios.'}
          </p>
          <label>
            <span className="apenas-leitor">Token do GitHub</span>
            <input
              type="password"
              value={token}
              placeholder="ghp_…"
              autoComplete="off"
              onChange={(evento) => setToken(evento.target.value)}
            />
          </label>
          {erro['github'] && (
            <p className="erro-campo" role="alert">
              {erro['github']}
            </p>
          )}
          <div className="campo__acoes">
            <button
              type="button"
              className="botao botao--primario"
              disabled={!token.trim() || ocupado === 'github'}
              onClick={() =>
                void executar('github', () =>
                  window.ancorai.definirCredencial('github', token.trim())
                )
              }
            >
              {ocupado === 'github' ? 'Verificando…' : 'Salvar token'}
            </button>
            {github?.estado === 'conectada' && (
              <button
                type="button"
                className="botao botao--secundario"
                onClick={() =>
                  void executar('github', () => window.ancorai.removerCredencial('github'))
                }
              >
                Remover
              </button>
            )}
          </div>
        </section>

        <div className="campo__acoes">
          <button type="button" className="botao botao--secundario" onClick={aoFechar}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
