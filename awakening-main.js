// A ponte do Awakening, no mundo da pagina.
//
// O QUE E' O AWAKENING, medido na conta do dono em 03/11/2026 com a API do jogo. A Quality mora em
// centesimos — 1,49 e' `149` — e cada raridade e' uma faixa (epica 140-154, lendaria 155-169).
// Dentro da faixa ha' **cinco AWK**, cada um +3 centesimos (na fraca, +2), e o custo de cada um e'
// so' material:
//
//   AWK numero N = 1 Material Genetico **da propria especie** + N materiais de **qualquer
//   especie**, todos da **mesma raridade** do Pokemon. Nao gasta gold nem diamantes.
//
// Conferido nos bichos dele: Magikarp 2/5 pede 1+2, Crobat 3/5 pede 1+3, Ralts 4/5 pede 1+4,
// Dunsparce lendario 5/5 pede 1+5.
//
// No teto da faixa o AWK acaba e entra o **Challenge**, que promove de raridade — e esse custa
// gold ou diamantes, consome materiais **e faz perder XP** (o Pokemon cai de nivel). Depois do
// mitico vem o **God Tier**, com Material Genetico Mitico Shiny.
//
// O QUE ESTA PONTE FAZ, E O QUE ELA NAO FAZ. Ela le' a previa (que nao consome nada: "Nada e'
// consumido ao abrir, escolher ou ver a proxima etapa", diz o proprio jogo) e comete **AWK**, que
// e' o passo repetitivo e so' custa material. O `challenge`, o `challenge/complete` e o `god-tier`
// **nao sao chamados aqui** — perder nivel e gastar diamantes e' decisao de cada vez, e o painel
// mostra a conta em vez de a executar. Ha' teste que cai se alguem os acrescentar.
//
// A SELECAO DOS MATERIAIS E' A DO PROPRIO JOGO: `{ expected_quality_cents, materials: [{item_id,
// qty}] }`, onde os `materials` pagam **so'** o requisito generico. O `expected_quality_cents` e' o
// que o jogador viu — se a Quality mudou entretanto, o servidor recusa em vez de fazer outra coisa.

(() => {
  'use strict';

  const PEDIDO = 'lioncode:awakening:pedido';
  const RESPOSTA = 'lioncode:awakening:resposta';
  const LUGARES = new Set(['team', 'inventory', 'storage']);
  const ESPERA_DA_API = 12000;

  const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const esperarApi = async () => {
    const fim = Date.now() + ESPERA_DA_API;
    for (;;) {
      const api = globalThis.PokeIdle?.Api;
      if (typeof api?.getAwakeningPreview === 'function') return api;
      if (Date.now() >= fim) return null;
      await espera(200);
    }
  };

  /** So' o que a lista do painel mostra. O registo inteiro e' do jogador e nao precisa de viajar. */
  const reduzir = (c) => ({
    id: String(c?.id || ''),
    especie: String(c?.species_name || c?.species_id || '?'),
    apelido: String(c?.nickname || ''),
    nivel: Number(c?.level) || 0,
    cents: Math.round(Number(c?.quality_multiplier) * 100),
    qualidade: String(c?.quality || ''),
    onde: String(c?.location || ''),
    brilhante: c?.is_shiny === true,
  });

  const lista = async (api) => {
    const r = await api.getCreatures();
    const todos = Array.isArray(r) ? r : r?.data;
    if (!Array.isArray(todos)) return { erro: 'o jogo respondeu uma coisa que não é uma lista' };
    return { bichos: todos.filter((c) => LUGARES.has(String(c?.location || ''))).map(reduzir) };
  };

  const requisitoDe = (previa, papel) =>
    (previa?.awk?.requirements || []).find((r) => String(r?.role || '') === papel) || null;

  /**
   * Quanto do material da PROPRIA especie a escolha pode gastar.
   *
   * O requisito de especie e' pago pelo servidor com o que a escolha deixar — entao escolher o
   * proprio material e' permitido, deixar o requisito a seco nao e'. `sobra` e' o que da' para
   * tirar de la' sem o matar. E' a mesma conta que o `ownReserve` do jogo faz.
   */
  const reservaPropria = (previa) => {
    const generico = requisitoDe(previa, 'generic');
    const especie = requisitoDe(previa, 'species');
    if (!generico || !especie) return { precisa: 0, tem: 0, sobra: Infinity, ids: new Set() };
    const variantes = especie.variants || [];
    const meus = (generico.options || []).filter(
      (o) => o?.own_species && variantes.includes(o?.variant),
    );
    const tem = meus.reduce((s, o) => s + (Number(o?.available) || 0), 0);
    const precisa = Number(especie.qty) || 0;
    return { precisa, tem, sobra: Math.max(0, tem - precisa), ids: new Set(meus.map((o) => o.item_id)) };
  };

  /**
   * Escolher os materiais genericos sozinha: os mais abundantes primeiro.
   *
   * **Primeiro gasta-se o que ha' de sobra, e so' depois o que e' raro.** Quem tem 6 Ariados e 1
   * Abra nao quer ver o Abra ir primeiro: ele pode ser o unico material daquela especie, e a
   * especie e' o requisito caro do AWK seguinte. E o material do proprio Pokemon so' entra ate'
   * a `sobra` — starvar o requisito de especie seria gastar materiais para o servidor recusar.
   */
  const escolher = (previa) => {
    const generico = requisitoDe(previa, 'generic');
    if (!generico) return { picks: [], faltam: 0 };
    const reserva = reservaPropria(previa);
    const candidatos = (generico.options || [])
      .map((o) => ({
        item_id: String(o?.item_id || ''),
        tem: Number(o?.available) || 0,
        meu: reserva.ids.has(o?.item_id),
      }))
      .filter((o) => o.item_id && o.tem > 0)
      .sort((a, b) => Number(a.meu) - Number(b.meu) || b.tem - a.tem);

    let falta = Number(generico.qty) || 0;
    let doMeu = 0;
    const picks = [];
    for (const c of candidatos) {
      if (falta <= 0) break;
      const teto = c.meu ? Math.max(0, Math.min(c.tem, reserva.sobra - doMeu)) : c.tem;
      const quanto = Math.min(falta, teto);
      if (quanto <= 0) continue;
      if (c.meu) doMeu += quanto;
      picks.push({ item_id: c.item_id, qty: quanto });
      falta -= quanto;
    }
    // Ordenado por `item_id`, como o jogo faz: dois pedidos iguais tem de ser byte a byte iguais
    // para a chave de idempotencia poder valer alguma coisa.
    picks.sort((a, b) => (a.item_id < b.item_id ? -1 : a.item_id > b.item_id ? 1 : 0));
    return { picks, faltam: Math.max(0, falta) };
  };

  /**
   * A previa reduzida, mais a conta do que falta para chegar ao teto da faixa.
   *
   * A conta e' feita aqui porque a regra e' aritmetica e conhecida: do AWK de agora ate' ao
   * ultimo, cada passo N custa 1 da especie e N quaisquer. Saber "faltam 2 de Ralts e 9
   * quaisquer" antes de comecar e' o que evita ficar a meio caminho com o material no fim.
   */
  const previa = async (api, id) => {
    const r = await api.getAwakeningPreview(id);
    const d = r && r.data ? r.data : r;
    const etapa = d?.stage || null;
    if (!etapa) return { erro: 'o jogo não deu a etapa deste Pokémon' };
    const generico = requisitoDe(d, 'generic');
    const especie = requisitoDe(d, 'species');
    const escolha = escolher(d);

    let especieFaltam = 0;
    let genericoFaltam = 0;
    if (d?.awk) {
      const deEspecie = Number(especie?.available) || 0;
      const deGenerico = Number(generico?.available) || 0;
      let precisaEspecie = 0;
      let precisaGenerico = 0;
      for (let n = Number(d.awk.index) || 1; n <= (Number(d.awk.total) || 0); n += 1) {
        precisaEspecie += 1;
        precisaGenerico += n;
      }
      especieFaltam = Math.max(0, precisaEspecie - deEspecie);
      genericoFaltam = Math.max(0, precisaGenerico - deGenerico);
    }

    return {
      ligado: d?.enabled === true,
      disponivel: d?.available === true,
      restrito: d?.restricted === true,
      especieDoMaterial: String(d?.material_species_id || ''),
      gold: Number(d?.gold) || 0,
      diamantes: Number(d?.diamonds) || 0,
      etapa: {
        tier: String(etapa.tier || ''),
        cents: Number(etapa.quality_cents) || 0,
        min: Number(etapa.min_cents) || 0,
        max: Number(etapa.max_cents) || 0,
        ganho: Number(etapa.gain_cents) || 0,
        indice: Number(etapa.awk_index) || 0,
        total: Number(etapa.awk_total) || 0,
        proximo: String(etapa.next || ''),
        proximoCents: Number(etapa.next_cents) || 0,
        noTeto: etapa.at_ceiling === true,
      },
      awk: d?.awk
        ? {
            indice: Number(d.awk.index) || 0,
            total: Number(d.awk.total) || 0,
            de: Number(d.awk.from_cents) || 0,
            para: Number(d.awk.to_cents) || 0,
            podeAgora: d.awk.can_commit === true && escolha.faltam === 0,
            especie: especie ? { precisa: Number(especie.qty) || 0, tem: Number(especie.available) || 0 } : null,
            generico: generico
              ? { precisa: Number(generico.qty) || 0, tem: Number(generico.available) || 0 }
              : null,
          }
        : null,
      // O Challenge **mostra-se**, nunca se executa daqui. Ver o cabeçalho.
      challenge: d?.challenge
        ? {
            de: String(d.challenge.from_tier || ''),
            para: String(d.challenge.to_tier || ''),
            kills: Number(d.challenge.kills) || 0,
            killsPrecisa: Number(d.challenge.kills_required) || 0,
            stones: Number(d.challenge.stones) || 0,
            stonesPrecisa: Number(d.challenge.stones_required) || 0,
            gold: Number(d.challenge.gold) || 0,
            diamantes: Number(d.challenge.diamonds) || 0,
            xpPerdida: (Number(d.challenge.xp_loss_bps) || 0) / 100,
            nivelDepois: Number(d.challenge.level_after) || 0,
          }
        : null,
      ateOTeto: { especie: especieFaltam, generico: genericoFaltam },
    };
  };

  /**
   * Cometer UM AWK.
   *
   * `expected_quality_cents` e' o numero que o painel mostrou: se a Quality mudou entretanto, o
   * servidor recusa em vez de fazer outra coisa — e e' isso que se quer, com material que se
   * consome para sempre.
   */
  const awk = async (api, id, cents) => {
    const r = await api.getAwakeningPreview(id);
    const d = r && r.data ? r.data : r;
    if (!d?.awk) return { erro: 'este Pokémon não tem AWK agora' };
    const agora = Number(d?.stage?.quality_cents) || 0;
    if (Number(cents) !== agora)
      return { erro: `a Quality mudou (${cents} → ${agora}): confira a prévia antes de continuar` };
    const escolha = escolher(d);
    if (escolha.faltam > 0) return { erro: `faltam ${escolha.faltam} material(ais) de qualquer espécie` };
    const corpo = { expected_quality_cents: agora };
    if (requisitoDe(d, 'generic')) corpo.materials = escolha.picks;
    await api.awakeningAWK(id, corpo, `lioncode-awk-${id}-${agora}`);
    try {
      globalThis.PokeIdle?.Bus?.emit?.('awakening.updated', {});
      globalThis.PokeIdle?.Bus?.emit?.('creature.updated', {});
      globalThis.PokeIdle?.Bus?.emit?.('genetic_material.updated', {});
    } catch {
      /* sem barramento: o jogo acompanha no proximo F5. */
    }
    return { ok: true, de: agora, para: Number(d.awk.to_cents) || 0 };
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
      const id = String(evento?.detail?.id || '');
      if (acao === 'lista') return void responder(await lista(api));
      if (acao === 'previa') return void responder(await previa(api, id));
      if (acao === 'awk') return void responder(await awk(api, id, Number(evento?.detail?.cents)));
      responder({ erro: 'não sei fazer isso' });
    } catch (erro) {
      responder({
        erro: String(erro?.message || erro || 'falhou'),
        code: String(erro?.code || ''),
        status: Number(erro?.status) || 0,
        esperarMs: Number(erro?.retryAfterMs) || 0,
      });
    }
  });
  document.documentElement.dataset.lioncodeAwakening = 'pronto';
})();
