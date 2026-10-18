// Ponte generica das automacoes de eventos. Cada evento novo entra como um adaptador nesta lista;
// o painel, a agenda e a fila continuam iguais.
(() => {
  'use strict';

  const PEDIDO = 'lioncode:eventos:pedido';
  const RESPOSTA = 'lioncode:eventos:resposta';
  const METAS = ['kills', 'captures', 'costume_captures'];
  const LIMITES = { kills: 100, captures: 10, costume_captures: 1 };
  const ESTADOS_WORLD_BOSS = ['scheduled', 'staging', 'awaiting_player', 'active'];

  const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const ate = async (condicao, limite = 10000) => {
    const fim = Date.now() + limite;
    while (Date.now() < fim) {
      const achado = await condicao();
      if (achado) return achado;
      await espera(200);
    }
    return await condicao();
  };

  const halloween = {
    id: 'halloween-2026',
    nome: 'Halloween 2026',
    async ler() {
      const api = globalThis.PokeIdle?.Api;
      if (typeof api?.getHalloween !== 'function') return { disponivel: false, pendentes: [] };
      const dados = await api.getHalloween();
      const agora = Date.parse(dados?.server_time || '');
      const fecha = Date.parse(dados?.closes_at || '');
      const ativo = Boolean(
        dados?.config?.enabled &&
          dados?.config?.activated_at &&
          Number.isFinite(agora) &&
          Number.isFinite(fecha) &&
          agora < fecha,
      );
      const pendentes = [];
      for (const dia of dados?.days || []) {
        const resgatadas = new Set(dia?.claimed || []);
        for (const meta of METAS)
          if (!resgatadas.has(meta) && Number(dia?.[meta]) >= LIMITES[meta])
            pendentes.push({ dia: String(dia.day), meta });
      }
      return { disponivel: ativo, pendentes };
    },
    async abrir() {
      const evento = globalThis.PokeIdle?.Halloween;
      if (typeof evento?.open !== 'function') throw new Error('a janela do Halloween não carregou');
      evento.open();
      const janela = await ate(() => document.querySelector('.seasonal-window'));
      if (!janela) throw new Error('a janela do Halloween não abriu');
      const missoes = [...janela.querySelectorAll('.seasonal-nav button')].find((b) =>
        /missões|missions/i.test((b.textContent || '').trim()),
      );
      if (!missoes) throw new Error('não achei a aba Missões diárias');
      missoes.click();
      const conteudo = await ate(() => janela.querySelector('.seasonal-content'));
      if (!conteudo) throw new Error('as missões diárias não apareceram');
      return janela;
    },
    async resgatarVisivel(janela, intervalo) {
      let feitos = 0;
      // A tela redesenha depois de cada resposta. Por isso o botão é procurado outra vez em cada
      // volta: guardar o elemento antigo seria clicar numa peça que já saiu do DOM.
      while (feitos < 100) {
        const botao = [...janela.querySelectorAll('.seasonal-content button')].find(
          (b) => !b.disabled && /^resgatar$/i.test((b.textContent || '').trim()),
        );
        if (!botao) break;
        botao.click();
        feitos += 1;
        // O atraso tem duas funções visíveis: deixa o dono acompanhar os cliques e dá tempo para a
        // resposta redesenhar a lista antes de procurar o próximo Resgatar.
        await espera(intervalo);
        await ate(
          () =>
            ![...janela.querySelectorAll('.seasonal-content button')].some(
              (b) => b.disabled && /^resgatar$/i.test((b.textContent || '').trim()),
            ),
          10000,
        );
      }
      return feitos;
    },
  };

  // Ponto unico de extensao: o proximo evento acrescenta um adaptador, sem criar outro painel ou
  // outro relogio. A ferramenta sempre percorre todos os eventos que o jogo disser que estao ativos.
  const EVENTOS = [halloween];

  const estado = async () => {
    const eventos = [];
    for (const evento of EVENTOS) {
      try {
        const lido = await evento.ler();
        eventos.push({ id: evento.id, nome: evento.nome, ...lido });
      } catch (e) {
        eventos.push({ id: evento.id, nome: evento.nome, disponivel: false, pendentes: [], erro: String(e?.message || e) });
      }
    }
    return { ok: true, eventos };
  };

  const resgatar = async (pedido = {}) => {
    let quantidade = 0;
    const detalhes = [];
    const intervalo = Math.min(10000, Math.max(500, Number(pedido?.intervalo) || 1500));
    for (const evento of EVENTOS) {
      const lido = await evento.ler();
      if (!lido.disponivel) continue;
      const janela = await evento.abrir();
      const feitos = await evento.resgatarVisivel(janela, intervalo);
      quantidade += feitos;
      detalhes.push({ id: evento.id, nome: evento.nome, feitos, encontrados: lido.pendentes.length });
    }
    if (quantidade) globalThis.PokeIdle?.Bus?.emit?.('inventory.updated', {});
    return { ok: true, quantidade, detalhes };
  };

  const estadoWorldBoss = async () => {
    const api = globalThis.PokeIdle?.Api;
    if (typeof api?.getWorldBoss !== 'function')
      return { ok: false, disponivel: false, erro: 'o World Boss ainda não carregou' };
    const resposta = await api.getWorldBoss(true);
    const dados = resposta?.data || resposta;
    const raid = dados?.mode === 'live_raid_v2' ? (dados.raid || dados) : null;
    const emRaid = Boolean(globalThis.PokeIdle?.WorldBossLiveRaid?.active);
    if (!raid?.event_id || !ESTADOS_WORLD_BOSS.includes(String(raid.state || '')))
      return { ok: true, disponivel: false, emRaid };
    return {
      ok: true,
      disponivel: true,
      evento: String(raid.event_id),
      nome: String(raid.boss_name || raid.event_name || 'World Boss'),
      estado: String(raid.state),
      participando: Boolean(raid.participating),
      participante: Boolean(raid.participant),
      fila: Number(raid.queue_position) || 0,
      emRaid,
    };
  };

  const naCidade = () => {
    const cidade = globalThis.PokeIdle?.Nav?.CITY_MAP_ID;
    const mapa = globalThis.$gameMap?.mapId?.();
    return Number.isFinite(mapa) && mapa === cidade;
  };

  const irParaCidade = async () => {
    const nav = globalThis.PokeIdle?.Nav;
    if (naCidade()) return { ok: true };
    if (typeof nav?.goToCity !== 'function') return { erro: 'não achei o caminho para a cidade' };
    let foi = false;
    try { foi = await nav.goToCity(); } catch (e) {
      return { erro: `não consegui ir para a cidade: ${String(e?.message || e)}` };
    }
    const chegou = await ate(naCidade, 15000);
    if (!chegou)
      return { erro: foi === false ? 'o jogo não permitiu voltar à cidade' : 'a cidade não terminou de carregar' };
    return { ok: true };
  };

  const entrarWorldBoss = async () => {
    const antes = await estadoWorldBoss();
    if (!antes.disponivel) return { erro: antes.erro || 'o World Boss não está disponível agora' };
    if (antes.participando && antes.estado !== 'active')
      return { ok: true, situacao: 'confirmado', nome: antes.nome };
    if (antes.fila > 0)
      return { ok: true, situacao: 'fila', fila: antes.fila, nome: antes.nome };

    // `goToCity` preserva a caçada para ela poder ser retomada depois da raid. Não se chama
    // `stopHunt`: isso encerraria a sessão que o dono pediu apenas para pausar.
    const cidade = await irParaCidade();
    if (!cidade.ok) return cidade;

    if (!globalThis.SceneManager || !globalThis.Scene_WorldBossLiveRaid)
      return { erro: 'a tela do World Boss ainda não carregou' };
    if (!(globalThis.SceneManager._scene instanceof globalThis.Scene_WorldBossLiveRaid))
      globalThis.SceneManager.push(globalThis.Scene_WorldBossLiveRaid);

    const botao = await ate(() => {
      const achado = document.querySelector('.worldboss-live-entry .wb-live-scene__enter');
      return achado && !achado.disabled ? achado : null;
    }, 15000);
    if (!botao) {
      const depois = await estadoWorldBoss();
      if (depois.participando) return { ok: true, situacao: 'confirmado', nome: depois.nome };
      return { erro: 'o botão de entrada do World Boss não ficou disponível' };
    }
    botao.click();

    const confirmou = await ate(async () => {
      const atual = await estadoWorldBoss();
      return atual.participando || atual.fila > 0 || globalThis.PokeIdle?.WorldBossLiveRaid?.active
        ? atual
        : null;
    }, 20000);
    if (!confirmou) return { erro: 'cliquei para entrar, mas o jogo não confirmou a participação' };
    return {
      ok: true,
      situacao: confirmou.participando ? (confirmou.estado === 'active' ? 'raid' : 'confirmado') : 'fila',
      fila: confirmou.fila || 0,
      nome: confirmou.nome || antes.nome,
    };
  };

  const FAZ = {
    estado,
    resgatar,
    estadoWorldBoss,
    irCidadeWorldBoss: irParaCidade,
    entrarWorldBoss,
  };
  addEventListener(PEDIDO, (evento) => {
    const eco = evento?.detail?.eco;
    const fazer = FAZ[String(evento?.detail?.acao || '')];
    const responder = (dados) => dispatchEvent(new CustomEvent(RESPOSTA, { detail: { eco, ...dados } }));
    if (!fazer) return responder({ erro: 'ação de eventos desconhecida' });
    Promise.resolve(fazer(evento.detail)).then(responder).catch((e) => responder({ erro: String(e?.message || e) }));
  });
})();
