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
    !token
      ? String(texto || '').slice(0, 300)
      : String(texto || '')
      .replace(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '…')
      .slice(0, 300);

  /** O quanto se deixa o `getUpdates` ficar pendurado a' espera de mensagem nova, em segundos. */
  const ESPERA_LONGA = 20;

  /**
   * Uma ida ao Telegram, com prazo e sem nunca deixar o token escapar para o erro.
   *
   * Devolve `{ dados }` quando o Telegram disse `ok: true`, e `{ erro }` em todo o resto —
   * **nunca atira**, porque quem chama isto esta' no meio de uma corrida que nao pode morrer por
   * uma rede ruim.
   */
  const comPrazo = async (caminho, opcoes, token, prazo = PRAZO_REDE) => {
    const corta = new AbortController();
    const relogio = setTimeout(() => corta.abort(), prazo);
    try {
      const r = await fetch(`https://api.telegram.org/${caminho}`, { ...opcoes, signal: corta.signal });
      const d = await r.json().catch(() => null);
      if (d?.ok === true) return { dados: d };
      // O 409 tem nome proprio, e importa dize-lo: duas janelas com o MESMO bot nao podem ler ao
      // mesmo tempo — o Telegram corta a leitura antiga com *"terminated by other getUpdates
      // request"*. Quem apanha isto nao foi ignorado pelo dono; foi empurrado por outra janela.
      const texto = String(d?.description || `o Telegram respondeu ${r.status}`);
      const conflito = r.status === 409 || /conflict|terminated by other getupdates/i.test(texto);
      return {
        erro: semSegredo(conflito ? 'outra janela está a usar este mesmo bot' : texto, token),
        conflito,
      };
    } catch (e) {
      return { erro: semSegredo(e?.name === 'AbortError' ? 'o Telegram não respondeu' : e?.message || e, token) };
    } finally {
      clearTimeout(relogio);
    }
  };

  /**
   * Mandar o recado. Devolve `{ ok }` ou `{ erro }` — nunca atira.
   *
   * Nao pede a vez (`PPX.vez`): nada aqui toca no jogo, e um recado nao pode ficar atras de uma
   * caçada na fila. Ver o AGENTS.md: a fila e' para quem age no jogo.
   */
  const avisar = async (texto, teclado = null) => {
    const { token, chat } = await ler();
    if (!token || !chat) return { erro: 'falta o token do bot ou o chat id' };
    const corpo = new URLSearchParams({
      chat_id: chat,
      text: String(texto || '').slice(0, 3500),
      disable_web_page_preview: 'true',
      ...(teclado ? { reply_markup: teclado } : {}),
    });
    const r = await comPrazo(
      `bot${token}/sendMessage`,
      {
        method: 'POST',
        // **Nao troque para JSON.** Ver o cabecalho: o preflight daquele servidor da' 501.
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: corpo.toString(),
      },
      token,
    );
    return r?.erro ? r : { ok: true, id: r.dados?.result?.message_id || 0 };
  };

  /**
   * Mandar uma **foto**, com legenda.
   *
   * O corpo vai em `multipart/form-data`, e nao em JSON, pela mesma razao do `avisar`: multipart e'
   * um dos tipos que o CORS trata como pedido simples, entao nao ha' preflight — e o preflight
   * daquele servidor da' 501. O `Content-Type` **nao** se escreve a mao aqui de proposito: quem o
   * escreve e' o navegador, que lhe junta o `boundary`; escreve-lo a mao parte o corpo.
   */
  const foto = async (imagem, legenda, teclado = null) => {
    const { token, chat } = await ler();
    if (!token || !chat) return { erro: 'falta o token do bot ou o chat id' };
    const corpo = new FormData();
    corpo.append('chat_id', chat);
    corpo.append('caption', String(legenda || '').slice(0, 900));
    corpo.append('photo', imagem, 'verificacao.png');
    if (teclado) corpo.append('reply_markup', teclado);
    const r = await comPrazo(`bot${token}/sendPhoto`, { method: 'POST', body: corpo }, token);
    return r?.erro ? r : { ok: true, id: r.dados?.result?.message_id || 0 };
  };

  /**
   * Botoes no proprio Telegram, em vez de o dono escrever.
   *
   * Pedido dele em 04/11/2026. Cada botao leva um `callback_data` com um **selo** desta pergunta —
   * sem isso, carregar num botao de uma pergunta de ontem (as mensagens ficam la' para sempre, com
   * os botoes ainda clicaveis) contava como resposta a esta. O selo e' o que amarra o toque a'
   * figura que ele estava a ver.
   */
  const SELO = () => Math.random().toString(36).slice(2, 10);
  const teclado = (selo, linhas) =>
    JSON.stringify({
      inline_keyboard: linhas.map((linha) =>
        linha.map(({ texto, valor }) => ({ text: String(texto), callback_data: `${selo}:${valor}` })),
      ),
    });

  /** Tirar o relogio de cima do botao, e tirar os botoes da mensagem ja' respondida. */
  const fecharToque = async (token, chat, id, toque, texto) => {
    await comPrazo(
      `bot${token}/answerCallbackQuery`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ callback_query_id: String(toque), text: String(texto || '') }).toString(),
      },
      token,
    );
    if (!id) return;
    // Sem isto os botoes ficavam clicaveis para sempre numa pergunta ja' fechada.
    await comPrazo(
      `bot${token}/editMessageReplyMarkup`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ chat_id: String(chat), message_id: String(id) }).toString(),
      },
      token,
    );
  };

  /**
   * Ler as mensagens novas, e **so' as novas**.
   *
   * O `getUpdates` guarda o que ainda nao foi confirmado, entao uma resposta de ha' meia hora
   * continua la' a' espera. Se ela fosse aceite, um "3" que o dono escreveu numa janela anterior
   * clicava sozinho no quadrado 3 desta — e ele nao tinha visto esta foto nenhuma. Por isso:
   *
   *   1. antes de perguntar, **esvazia-se** a fila (o `offset` salta para depois da ultima);
   *   2. so' se aceita mensagem daquele `chat id` (o bot pode estar em mais conversas);
   *   3. so' se aceita mensagem **posterior** a' pergunta, pelo `date` do proprio Telegram.
   */
  const desdeAgora = async (token) => {
    const r = await comPrazo(`bot${token}/getUpdates?offset=-1&limit=1`, { method: 'GET' }, token);
    const ultimo = r?.dados?.result?.[0]?.update_id;
    return Number.isFinite(ultimo) ? ultimo + 1 : 0;
  };

  /**
   * Perguntar pela foto e esperar pelo numero que o dono escrever.
   *
   * Isto e' um **relé**, e e' importante o que ele nao e': a extensao nao olha para a figura, nao
   * sabe o que esta' la' dentro e nao tem opiniao nenhuma sobre qual quadrado e' o certo. Ela leva
   * a imagem ate' ao telefone, espera que uma pessoa a reconheca, e clica onde essa pessoa disse.
   * **Nada do que ele devolve e' guardado**: a resposta vive o tempo de um clique e morre ali. Um
   * ficheiro a dizer "esta figura e' Exeggutor" transformava isto noutra coisa.
   */
  const perguntar = async ({ imagem = null, legenda, segundos = 75, aceitar, botoes = null }) => {
    const { token, chat } = await ler();
    if (!token || !chat) return { erro: 'falta o token do bot ou o chat id' };
    let passo = await desdeAgora(token);
    const selo = SELO();
    const marcas = botoes ? teclado(selo, botoes) : null;
    // Sem imagem e' uma pergunta de texto — "posso entrar?" — e com imagem e' a verificacao. O
    // resto (esvaziar a fila, filtrar a conversa, exigir que seja posterior) e' igual nos dois.
    const enviada = imagem ? await foto(imagem, legenda, marcas) : await avisar(legenda, marcas);
    if (enviada?.erro) return enviada;
    const desde = Math.floor(Date.now() / 1000) - 2;
    const fim = Date.now() + segundos * 1000;
    while (Date.now() < fim) {
      const resto = Math.max(1, Math.min(ESPERA_LONGA, Math.round((fim - Date.now()) / 1000)));
      const r = await comPrazo(
        `bot${token}/getUpdates?offset=${passo}&timeout=${resto}&allowed_updates=%5B%22message%22%2C%22callback_query%22%5D`,
        { method: 'GET' },
        token,
        (resto + 8) * 1000,
      );
      if (r?.erro) return r;
      for (const u of r?.dados?.result || []) {
        if (Number.isFinite(u.update_id)) passo = u.update_id + 1;

        // Um toque num botao. O selo diz se foi NESTA pergunta: as mensagens antigas ficam na
        // conversa com os botoes ainda la', e um toque numa delas nao pode valer por esta.
        const toque = u.callback_query;
        if (toque) {
          const [seloDele, valor] = String(toque.data || '').split(':');
          if (seloDele !== selo) continue;
          if (String(toque.message?.chat?.id || '') !== String(chat)) continue;
          const escolha = aceitar(String(valor ?? ''));
          if (escolha === null || escolha === undefined) continue;
          await fecharToque(token, chat, enviada.id, toque.id, `Anotado: ${valor}`);
          return { resposta: escolha };
        }

        // E a resposta escrita continua a valer, para quem preferir o teclado do telefone.
        const m = u.message;
        if (!m || String(m.chat?.id) !== String(chat) || (m.date || 0) < desde) continue;
        const escolha = aceitar(String(m.text || ''));
        if (escolha !== null && escolha !== undefined) return { resposta: escolha };
      }
    }
    // `prazo: true` e' a unica saida que quer dizer "a pessoa nao respondeu". Todas as outras sao
    // problemas nossos — rede, token, conflito — e quem chama tem de as tratar diferente.
    return { erro: 'ninguém respondeu a tempo', prazo: true };
  };

  const API = { ler, guardar, pronto, avisar, foto, perguntar, teclado, FORMA, semSegredo };
  if (typeof globalThis.PPX === 'object' && globalThis.PPX) globalThis.PPX.telegram = API;
  // Para o teste de mesa: `new Function('module', fonte)`. Ver `testes/telegram.test.mjs`.
  if (typeof module === 'object' && module) module.exports = API;
})();
