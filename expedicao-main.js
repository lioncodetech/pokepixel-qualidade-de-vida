// A ponte da expedicao, no mundo da pagina.
//
// ATE' ONDE ELA VAI, E ONDE ELA PARA. A expedicao do jogo tem quatro passos: entrar no grupo,
// **resolver a verificacao**, marcar pronto, e o lider iniciar. Esta ponte faz o primeiro e para
// ali. A verificacao e' um CAPTCHA — `expedition.captcha.prompt` do proprio jogo e' "Clique em
// {species}", com a dica "Cada integrante resolve o proprio desafio antes de marcar pronto" — e
// resolve-la e' do dono, nao desta extensao.
//
// **O `setExpeditionReady` NAO E' CHAMADO AQUI, E NAO PODE PASSAR A SER.** No cliente do jogo ele
// recebe `(ready, captcha)`: o pronto e o comprovativo da verificacao viajam juntos, de proposito.
// Uma ferramenta que o chamasse estaria a afirmar que houve uma pessoa quando nao houve. Se um dia
// alguem acrescentar essa chamada a este ficheiro, o teste `testes/expedicao.test.mjs` cai — e e'
// para cair.
//
// O QUE ESTA PONTE PASSOU A FAZER EM 04/11/2026, E PORQUE ISSO NAO MEXE NA LINHA ACIMA. Abrir a
// janela de expedicoes (`ExpeditionWindow.open`), perguntar se a corrida ja' comecou
// (`ExpeditionStore.inRun`) e **sair do grupo** (`Api.leaveExpedition`). Abrir a janela e' preciso
// porque o botao da verificacao so' existe no DOM com ela aberta; sair e' o pedido do dono para
// quando ele nao responder a tempo — nao ficar a prender um lugar num grupo que vai comecar sem
// ele. Nenhuma das tres toca na verificacao, e o `setExpeditionReady` continua a nao existir aqui.
//
// O QUE FOI MEDIDO NA CONTA DO DONO EM 03/11/2026:
//
//   PokeIdle.Api.getExpeditionState()
//     -> { enabled, window: { status, opens_at, closes_at, remaining_seconds },
//          lobby, public_lobbies: [...], runs_left, extra_runs, rules, items }
//   PokeIdle.Api.autoJoinExpedition()      // sem corpo: o servidor escolhe o grupo
//   PokeIdle.Api.joinExpeditionLobby({ code })
//
// e as regras daquela janela: `captcha_required: true`, 1 corrida por janela, grupo de 1 a 4,
// 30 minutos de expedicao, e `unique_ip_required: true` — que importa a quem joga em varias
// janelas no mesmo computador.

(() => {
  'use strict';

  const PEDIDO = 'lioncode:expedicao:pedido';
  const RESPOSTA = 'lioncode:expedicao:resposta';

  /** Limite para o mapa confirmar que a cidade terminou de carregar. Mesmo numero da escada. */
  const ATE_CIDADE = 15000;
  const ESPERA_DA_API = 12000;

  const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const esperarAte = async (condicao, limite) => {
    const fim = Date.now() + limite;
    while (Date.now() < fim) {
      if (condicao()) return true;
      await espera(200);
    }
    return condicao();
  };

  const esperarApi = async () => {
    const fim = Date.now() + ESPERA_DA_API;
    for (;;) {
      const api = globalThis.PokeIdle?.Api;
      if (typeof api?.getExpeditionState === 'function') return api;
      if (Date.now() >= fim) return null;
      await espera(200);
    }
  };

  const naCidade = () => {
    const cidade = globalThis.PokeIdle?.Nav?.CITY_MAP_ID;
    const agora = globalThis.$gameMap?.mapId?.();
    return Number.isFinite(agora) && agora === cidade;
  };

  /** Parar a caçada e ir para a cidade. Sem cura: equipe derrotada e' assunto de outra ferramenta. */
  const irParaCidade = async () => {
    const api = globalThis.PokeIdle?.Api;
    const nav = globalThis.PokeIdle?.Nav;
    if (naCidade()) return { ok: true, jaEstava: true };
    if (typeof api?.stopHunt === 'function') {
      try {
        await api.stopHunt();
      } catch {
        // Nao estar em caçada nenhuma e' o destino, nao um obstaculo.
      }
    }
    if (typeof nav?.goToCity !== 'function') return { erro: 'não achei o caminho para a cidade' };
    try {
      await nav.goToCity();
    } catch (e) {
      return { erro: `não consegui ir para a cidade: ${String(e?.message || e)}` };
    }
    if (!(await esperarAte(naCidade, ATE_CIDADE))) return { erro: 'a cidade não terminou de carregar' };
    return { ok: true };
  };

  /**
   * So' o que o painel mostra ou decide.
   *
   * O estado cru traz as regras inteiras — trinta e cinco fragmentos lendarios com as suas
   * probabilidades, entre outras coisas — e nada disso atravessa para o outro mundo so' para ser
   * descartado. O que viaja e' o que aparece na tela.
   */
  const doGrupo = (l) =>
    l
      ? {
          id: String(l.id || ''),
          codigo: String(l.code || ''),
          estado: String(l.status || ''),
          publico: l.is_public === true,
          membros: Array.isArray(l.members) ? l.members.length : 0,
          lugares: Number(l.max_members) || 0,
          instancia: Number(l.instance_level) || 0,
          nivelMinimo: Number(l.min_creature_level) || 0,
        }
      : null;

  const estado = async (api) => {
    const r = await api.getExpeditionState();
    const s = r && r.data ? r.data : r;
    const janela = s?.window || null;
    return {
      ligada: s?.enabled === true,
      aberta: String(janela?.status || '') === 'open',
      restantes: Number(janela?.remaining_seconds) || 0,
      abre: String(janela?.opens_at || ''),
      fecha: String(janela?.closes_at || ''),
      corridas: Number(s?.runs_left) || 0,
      extras: Number(s?.extra_runs) || 0,
      grupo: doGrupo(s?.lobby),
      publicos: (Array.isArray(s?.public_lobbies) ? s.public_lobbies : []).map(doGrupo),
      // O painel diz que a verificacao existe **porque o servidor diz que existe**, e nao porque
      // esta' escrito aqui. No dia em que o jogo a tirar, a frase sai sozinha.
      exigeVerificacao: s?.rules?.captcha_required === true,
      minimo: Number(s?.rules?.min_team_members) || 1,
      maximo: Number(s?.rules?.max_team_members) || 0,
      minutos: Number(s?.rules?.expedition_duration_minutes) || 0,
      umPorIp: s?.rules?.unique_ip_required === true,
    };
  };

  /**
   * Entrar num grupo: pelo codigo, se o dono escreveu um; senao o servidor escolhe.
   *
   * `autoJoinExpedition()` vai sem corpo — e' assim que o proprio jogo a chama (`autoJoin()` no
   * `ExpeditionStore.js`). Entrar e' tudo o que ela faz: a partir daqui, quem age e' a pessoa.
   */
  const entrar = async (api, pedido) => {
    const codigo = String(pedido?.codigo || '')
      .trim()
      .toUpperCase();
    if (codigo) {
      if (typeof api.joinExpeditionLobby !== 'function') return { erro: 'este jogo não aceita código' };
      await api.joinExpeditionLobby({ code: codigo });
    } else {
      if (typeof api.autoJoinExpedition !== 'function')
        return { erro: 'este jogo não tem entrada automática em grupo público' };
      await api.autoJoinExpedition();
    }
    const depois = await estado(api);
    if (!depois.grupo) return { erro: 'entrei e o jogo não me devolveu nenhum grupo' };
    return { ok: true, ...depois };
  };

  /**
   * Abrir a janela de expedicoes do jogo, e dizer se ela ficou aberta.
   *
   * Nao e' enfeite. Medido em 04/11/2026: o "Estou pronto" e a propria verificacao **so existem no
   * DOM enquanto aquela janela esta' aberta**. Quem responde pelo telefone nao esta' ca' para a
   * abrir, entao quem a abre e' isto — e quem a mantem aberta ate' a corrida comecar tambem, porque
   * uma janela que se fecha no meio leva com ela o botao em que se ia clicar.
   */
  const janela = () => {
    const w = globalThis.PokeIdle?.ExpeditionWindow;
    if (typeof w?.open !== 'function') return { erro: 'este jogo não tem a janela de expedições' };
    if (w.isOpen?.() !== true) w.open();
    return { ok: true, aberta: w.isOpen?.() === true };
  };

  /**
   * A corrida ja' comecou — ou seja, ja' se entrou no mapa da expedicao?
   *
   * `ExpeditionStore.inRun()` e' do proprio jogo. E' o sinal de parar de vigiar a janela: dali em
   * diante quem manda e' a corrida.
   */
  const naCorrida = () => ({ ok: true, correndo: globalThis.PokeIdle?.ExpeditionStore?.inRun?.() === true });

  /**
   * Sair do grupo.
   *
   * Existe por um pedido do dono em 04/11/2026: se ele nao responder a' verificacao a tempo, nao
   * quer ficar la' dentro a prender um lugar de um grupo que vai comecar sem ele. `leaveExpedition`
   * e' a mesma porta do botao vermelho "Sair do grupo".
   */
  const sair = async (api) => {
    if (typeof api.leaveExpedition !== 'function') return { erro: 'este jogo não tem saída de grupo' };
    await api.leaveExpedition();
    return { ok: true, ...(await estado(api)) };
  };

  addEventListener(PEDIDO, async (evento) => {
    const eco = evento?.detail?.eco;
    const responder = (detalhe) => dispatchEvent(new CustomEvent(RESPOSTA, { detail: { eco, ...detalhe } }));
    try {
      const api = await esperarApi();
      if (!api) {
        responder({ erro: 'o jogo ainda não publicou a API — espere a tela carregar', semApi: true });
        return;
      }
      const acao = evento?.detail?.acao;
      if (acao === 'estado') return void responder(await estado(api));
      if (acao === 'cidade') return void responder(await irParaCidade());
      if (acao === 'entrar') return void responder(await entrar(api, evento?.detail));
      if (acao === 'janela') return void responder(janela());
      if (acao === 'corrida') return void responder(naCorrida());
      if (acao === 'sair') return void responder(await sair(api));
      responder({ erro: 'não sei fazer isso' });
    } catch (erro) {
      responder({
        erro: String(erro?.message || erro || 'falhou'),
        code: String(erro?.code || ''),
        status: Number(erro?.status) || 0,
      });
    }
  });
  document.documentElement.dataset.lioncodeExpedicao = 'pronto';
})();
