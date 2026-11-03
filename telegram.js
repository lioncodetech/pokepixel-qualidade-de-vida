// PokePixel - qualidade de vida: o recado no Telegram, partilhado.
//
// POR QUE ISTO EXISTE. A Expedicao abre uma janela curta — 30 minutos, uma corrida — e quem nao
// esta' ao computador nao a perde por nao querer: perde-a por nao saber. Um aviso na tela ou um som
// no painel nao servem a quem esta' na rua, e foi essa a objecao do dono em 03/11/2026: *"esse tipo
// de aviso nao adianta para alguem que nao esta no pc"*. Entao o aviso sai do computador.
//
// O QUE ELE NAO E'. Isto **manda um recado**, e nao resolve nada. A verificacao da expedicao
// continua a ser do dono, e nao ha' aqui nenhum caminho que a responda — ver o cabecalho do
// `expedicao-main.js`. Saber que a janela abriu e decidir ir ao computador e' a decisao que este
// ficheiro serve.
//
// POR QUE NAO HA' SERVICE WORKER, E PORQUE E' `x-www-form-urlencoded`. Duas medicoes, em
// 03/11/2026, que juntas decidiram o desenho inteiro:
//
//   1. `api.telegram.org` responde `Access-Control-Allow-Origin: *`. Ou seja, o `fetch` pode sair
//      daqui, do mundo isolado do content script, sem service worker e sem `host_permissions`. Isso
//      importa mais do que parece: o pacote corre dentro do LionMultInstance, que e' Electron, e
//      Electron nao corre service workers de extensao. Um fundo MV3 funcionaria no Chrome e
//      calaria-se exactamente na janela onde o dono joga.
//   2. O **preflight** daquele servidor devolve `501 Not Implemented`. Um POST com
//      `Content-Type: application/json` pede preflight, leva 501 e o pedido morre antes de sair.
//      Com `application/x-www-form-urlencoded` o pedido e' "simples" para o CORS, nao ha' preflight
//      e passa. **Nao troque o Content-Type por JSON**: ha' teste que guarda isto.
//
// ONDE MORA O TOKEN, E PORQUE NAO E' NO `localStorage`. Um token de bot e' uma senha: com ele
// manda-se mensagem em nome do bot. O `localStorage` e' da origem do jogo, e **o JavaScript da
// pagina le-o**. Entao o token vive no `chrome.storage.local`, que e' da extensao, pela mesma razao
// que a senha do login vive la' — ver `senha.js`. O campo do painel e' de senha, nunca e' repovoado
// com o valor guardado, e o token nao entra no exportar nem em mensagem de erro nenhuma.

(() => {
  'use strict';

  const CHAVE = 'lioncode-telegram';
  /** Prazo de qualquer ida ao armazenamento, e de qualquer ida ao Telegram. */
  const PACIENCIA = 5000;
  const PRAZO_REDE = 12000;
  /** `123456789:AA...` — o numero do bot, dois pontos, e o segredo. */
  const FORMA = /^\d{5,}:[A-Za-z0-9_-]{20,}$/;

  const api = globalThis.chrome && chrome.storage && chrome.storage.local;
  /**
   * A extensao morreu por baixo desta aba?
   *
   * Mesma licao do `senha.js`: recarregar a extensao deixa o content script a correr sem ligacao, e
   * dai' em diante toda chamada ao `chrome.storage` atira "context invalidated".
   */
  const extensaoMorta = () => Boolean(api) && !globalThis.chrome?.runtime?.id;

  // O `chrome.storage` do Electron responde por **callback**, e nao por promessa. Chamar so' a
  // forma moderna deixava o guardar pendurado sem erro nenhum na tela — medido no `senha.js`.
  const pedir = (metodo, arg) =>
    new Promise((ok, falhou) => {
      if (!api) return ok(null);
      if (extensaoMorta()) return falhou(new Error('a extensão foi recarregada: atualize a página (F5)'));
      const prazo = setTimeout(() => falhou(new Error('o armazenamento não respondeu')), PACIENCIA);
      const pronto = (valor) => {
        clearTimeout(prazo);
        ok(valor);
      };
      const ruim = (e) => {
        clearTimeout(prazo);
        falhou(e);
      };
      try {
        const r = api[metodo](arg, (valor) => {
          const erro = globalThis.chrome?.runtime?.lastError;
          if (erro) return ruim(new Error(erro.message || 'o armazenamento recusou'));
          pronto(valor);
        });
        if (r && typeof r.then === 'function') r.then(pronto, ruim);
      } catch (e) {
        ruim(e);
      }
    });

  const ler = async () => {
    try {
      const caixa = await pedir('get', CHAVE);
      const d = caixa?.[CHAVE] || null;
      return { token: String(d?.token || ''), chat: String(d?.chat || '') };
    } catch {
      return { token: '', chat: '' };
    }
  };

  /**
   * Guardar o que o dono escreveu. Token vazio **apaga**, e nao "mantem o de antes".
   *
   * Sem isso nao havia como desligar: um campo de senha que nunca mostra o valor e que ignora o
   * vazio e' um segredo que entra e nao sai.
   */
  const guardar = async ({ token, chat }) => {
    const limpo = {
      token: String(token ?? '').trim(),
      chat: String(chat ?? '')
        .trim()
        .slice(0, 32),
    };
    if (limpo.token && !FORMA.test(limpo.token))
      return { erro: 'esse token não tem a forma de um token de bot (123456789:AA…)' };
    try {
      await pedir('set', { [CHAVE]: limpo });
      return { ok: true, tem: Boolean(limpo.token && limpo.chat) };
    } catch (e) {
      return { erro: String(e?.message || e) };
    }
  };

  /** Configurado? E' o que o painel usa para dizer "ligado" sem nunca ler o segredo de volta. */
  const pronto = async () => {
    const d = await ler();
    return Boolean(d.token && d.chat);
  };

  /**
   * O token nunca sai numa mensagem de erro.
   *
   * O Telegram devolve a URL em alguns erros de rede, e a URL **tem o token dentro**. Uma extensao
   * que escrevesse isso na tela entregava o segredo a quem passasse pelo ecra — ou a um print.
   */
  const semSegredo = (texto, token) =>
    String(texto || '')
      .replace(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '…')
      .slice(0, 300);

  /**
   * Mandar o recado. Devolve `{ ok }` ou `{ erro }` — nunca atira.
   *
   * Nao pede a vez (`PPX.vez`): nada aqui toca no jogo, e um recado nao pode ficar atras de uma
   * caçada na fila. Ver o AGENTS.md: a fila e' para quem age no jogo.
   */
  const avisar = async (texto) => {
    const { token, chat } = await ler();
    if (!token || !chat) return { erro: 'falta o token do bot ou o chat id' };
    const corpo = new URLSearchParams({
      chat_id: chat,
      text: String(texto || '').slice(0, 3500),
      disable_web_page_preview: 'true',
    });
    const corta = new AbortController();
    const prazo = setTimeout(() => corta.abort(), PRAZO_REDE);
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        // **Nao troque para JSON.** Ver o cabecalho: o preflight daquele servidor da' 501.
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: corpo.toString(),
      });
      const d = await r.json().catch(() => null);
      if (d?.ok === true) return { ok: true };
      return { erro: semSegredo(d?.description || `o Telegram respondeu ${r.status}`, token) };
    } catch (e) {
      return { erro: semSegredo(e?.name === 'AbortError' ? 'o Telegram não respondeu' : e?.message || e, token) };
    } finally {
      clearTimeout(prazo);
    }
  };

  const API = { ler, guardar, pronto, avisar, FORMA, semSegredo };
  if (typeof globalThis.PPX === 'object' && globalThis.PPX) globalThis.PPX.telegram = API;
  // Para o teste de mesa: `new Function('module', fonte)`. Ver `testes/telegram.test.mjs`.
  if (typeof module === 'object' && module) module.exports = API;
})();
