// A ponte da extracao genetica, no mundo da pagina.
//
// POR QUE EXISTE. O NPC "Geneticista Pokemon" tem uma aba "Extrair material": cada Pokemon vira 1
// Material Genetico da propria especie e e' **apagado permanentemente**. A conta do dono tinha
// centenas de epicos de raridade baixa a ocupar deposito, e abri-los um a um no NPC e' o tipo de
// trabalho que esta extensao existe para tirar da frente.
//
// O jogo publica isto na propria API, e foi medido na conta real em 03/11/2026:
//
//   PokeIdle.Api.getGeneticSpecies()
//     -> [{ species_id, species_name, eligible_count, locked_count, material_balance, ... }]
//   PokeIdle.Api.getGeneticExtractableCreatures(speciesId, { limit, cursor, includeLocked })
//     -> [{ id, species_name, level, quality, quality_multiplier, locked, is_shiny, location }]
//   PokeIdle.Api.extractGeneticMaterial({ species_id, selection }, chaveDeIdempotencia)
//
// e a selecao que o proprio NPC manda e' `{ mode: 'ids', creature_ids: [...] }`, em lotes de 500
// (`EXTRACTION_BATCH_SIZE` do `NpcInteraction.js`). Aqui nao se inventa formato nenhum: e' o mesmo.
//
// TRES MEDIDAS QUE MUDARAM O DESENHO, todas da conta do dono em 03/11/2026:
//
//   1. **Nem tudo o que e' extraivel e' epico.** Dos 387 extraiveis, 383 eram `epic` e **4 eram
//      `legendary`** (1,6147 a 1,6811). Filtrar so' pelo numero da raridade apagaria lendario sem
//      ninguem ter pedido — por isso a qualidade e' uma chave, e nao um intervalo de numeros.
//   2. **As leituras funcionam longe do NPC**, com a caçada a correr. O servidor nao exige estar
//      na cidade. Ir a' cidade e' escolha do dono, e mora no `irParaCidade`.
//   3. **ESTE JOGO SO' EXTRAI DE EPICO PARA CIMA.** Medido com um caso que fecha a questao: um
//      Charmander FRACO (0,923), destravado, no deposito, da **mesma especie** de dois epicos
//      extraiveis, nao aparece na lista de extraiveis. Fraca, comum, incomum e rara podem ser
//      escritas no painel — simplesmente nao vem nada, e o painel diz isso com o que o jogo
//      ofereceu (`vistos`) em vez de mostrar um zero mudo.
//
// O QUE ELE NAO FAZ, E PORQUE. Nao decide nada: quem escolhe as faixas, quem confirma e quem manda
// extrair e' o painel, no outro mundo. E **nao desiste de uma varredura para refaze-la sozinho**:
// o plano e' congelado no `listar` e so' e' consumido pelo `extrair`, uma especie de cada vez. Uma
// repescagem automatica entre o "vi 248" e o "apaguei" podia apagar um bicho que o dono nunca viu
// na conta — e aqui nao ha' desfazer.

(() => {
  'use strict';

  const PEDIDO = 'lioncode:genetica:pedido';
  const RESPOSTA = 'lioncode:genetica:resposta';

  /** O lote do proprio jogo. Acima disto ele parte em varias chamadas, e nos tambem. */
  const LOTE = 500;
  /** Quantos por pagina ao ler os extraiveis. E' o limite que o NPC usa. */
  const PAGINA = 200;
  /** So' estes dois lugares entram: o que esta' na equipe nao e' candidato a ser apagado. */
  const LUGARES = new Set(['inventory', 'storage']);

  /** Limite para o mapa confirmar que a cidade terminou de carregar. Mesmo numero da escada. */
  const ATE_CIDADE = 15000;

  const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const esperarAte = async (condicao, limite) => {
    const fim = Date.now() + limite;
    while (Date.now() < fim) {
      if (condicao()) return true;
      await espera(200);
    }
    return condicao();
  };
  const naCidade = () => {
    const cidade = globalThis.PokeIdle?.Nav?.CITY_MAP_ID;
    const agora = globalThis.$gameMap?.mapId?.();
    return Number.isFinite(agora) && agora === cidade;
  };

  /**
   * Levar o treinador para a cidade, que e' onde o Geneticista mora.
   *
   * **O SERVIDOR NAO EXIGE ISTO** — medido em 03/11/2026: a extracao correu com a caçada a andar,
   * longe do NPC. Quem exige e' o dono, e a razao dele e' boa: a janela do Geneticista so' abre na
   * cidade, entao uma extracao no meio do mato nao e' uma coisa que ele pudesse ter feito a' mao.
   *
   * Parar a caçada **e'** o que "ir para a cidade" quer dizer, e nao um passo extra: e' o mesmo
   * caminho que a escada ja' faz. Nao se cura aqui — a enfermeira e' assunto de quem leva equipe
   * derrotada, e esta ferramenta nao luta com ninguem.
   */
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
    let foi = false;
    try {
      foi = await nav.goToCity();
    } catch (e) {
      return { erro: `não consegui ir para a cidade: ${String(e?.message || e)}` };
    }
    // `goToCity()` responde antes de o mapa terminar de carregar — a mesma armadilha que a escada
    // ja' pagou. Quem diz que se chegou e' o mapa, nao um cronometro.
    if (!(await esperarAte(naCidade, ATE_CIDADE)))
      return {
        erro: foi === false ? 'o jogo não me deixou sair para a cidade agora' : 'a cidade não terminou de carregar',
      };
    return { ok: true };
  };

  const ESPERA_DA_API = 12000;
  const esperarApi = async () => {
    const fim = Date.now() + ESPERA_DA_API;
    for (;;) {
      const api = globalThis.PokeIdle?.Api;
      if (typeof api?.getGeneticSpecies === 'function') return api;
      if (Date.now() >= fim) return null;
      await new Promise((ok) => setTimeout(ok, 200));
    }
  };

  /**
   * O plano congelado da ultima varredura: `[{ id, nome, ids: [...] }]`.
   *
   * Mora aqui, no mundo da pagina, e **os ids nunca atravessam para o painel**. Nao e' zelo: e' a
   * unica forma de o `extrair` nao poder receber uma lista diferente da que foi contada na tela.
   * O painel manda o indice da especie; o que se apaga e' o que foi visto.
   */
  let plano = [];
  /** A hora da varredura, para o painel poder dizer "isto foi lido ha' tanto tempo". */
  let lido = 0;
  /**
   * A chave de idempotencia desta varredura.
   *
   * O jogo aceita a mesma chave numa repeticao e **nao apaga duas vezes**. Por isso ela nasce com
   * o plano e nao com a chamada: um "tentei de novo" depois de uma resposta ambigua tem de ser o
   * mesmo pedido, e nao um segundo pedido igual.
   */
  let chave = '';

  const umaPagina = async (api, id, cursor) => {
    const r = await api.getGeneticExtractableCreatures(id, {
      limit: PAGINA,
      includeLocked: false,
      cursor: cursor || undefined,
    });
    const lista = Array.isArray(r) ? r : r?.data;
    return { lista: Array.isArray(lista) ? lista : [], proximo: (!Array.isArray(r) && r?.next_cursor) || '' };
  };

  /**
   * As faixas de cada qualidade, perguntadas ao jogo — nunca cravadas aqui.
   *
   * Mesma licao das Raridades: se o jogo mexer numa faixa, o painel acompanha sozinho, e um numero
   * escrito aqui seria uma mentira silenciosa. Medidas em 03/11/2026: fraca 0,90-0,99, comum
   * 1,00-1,09, incomum 1,10-1,24, rara 1,25-1,39, epica 1,40-1,54, lendaria 1,55-1,69. A mitica
   * **nao tem faixa** neste jogo — quem a tiver escreve os numeros a' mao.
   */
  const bandas = () => {
    const band = globalThis.PokeIdle?.PokemonCardData?.qualityBand;
    if (typeof band !== 'function') return {};
    const fora = {};
    for (const nome of ['weak', 'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']) {
      try {
        const faixa = band(nome);
        if (faixa && Number.isFinite(Number(faixa.min)) && Number.isFinite(Number(faixa.max)))
          fora[nome] = { min: Number(faixa.min), max: Number(faixa.max) };
      } catch {
        // Qualidade que este jogo nao tem: nao e' erro, e' so' nao existir.
      }
    }
    return fora;
  };

  /**
   * Quem entra: a qualidade tem faixa escolhida, o numero cai dentro dela, e o bicho esta' livre.
   *
   * **A QUALIDADE E' UMA CHAVE, E NAO UM INTERVALO DE NUMEROS.** Podia parecer que bastava um
   * minimo e um maximo globais — as faixas nao se sobrepoem, afinal. Mas quem escreve "1,40 a
   * 1,60" sem querer apanharia lendario pelo meio, e o dono nunca mais saberia qual foi. Com a
   * qualidade como chave, ligar lendario e' uma caixa que se marca, e nao um digito que escorrega.
   *
   * As tres peneiras do fim sao redundantes com o que o servidor devolve — e ficam na mesma. O
   * custo e' nenhum, e o que elas protegem e' irreversivel.
   */
  const entra = (c, faixas) => {
    const faixa = faixas[String(c?.quality || '')];
    if (!faixa) return false;
    const m = Number(c?.quality_multiplier);
    return (
      Number.isFinite(m) &&
      m >= faixa.min &&
      m <= faixa.max &&
      c?.locked !== true &&
      c?.is_shiny !== true &&
      LUGARES.has(String(c?.location || ''))
    );
  };

  const listar = async (api, faixas) => {
    const r = await api.getGeneticSpecies();
    const especies = Array.isArray(r) ? r : r?.data;
    if (!Array.isArray(especies)) return { erro: 'o jogo respondeu uma coisa que não é uma lista' };

    const novo = [];
    let olhados = 0;
    /**
     * O que o jogo OFERECEU, por qualidade.
     *
     * Sem isto, uma faixa que nao devolve nada e uma qualidade que o jogo nunca oferece parecem a
     * mesma coisa na tela — e sao perguntas diferentes. MEDIDO EM 03/11/2026: um Charmander fraco,
     * destravado, no deposito, da mesma especie de dois epicos extraiveis, **nao e' oferecido**.
     * Logo este jogo so' extrai de epico para cima, e quem escrever uma faixa de comum merece
     * ouvir isso em vez de ver um zero.
     */
    const vistos = {};
    for (const especie of especies) {
      if (!(Number(especie?.eligible_count) > 0)) continue;
      const ids = [];
      let cursor = '';
      // O cursor e' seguido ate' ao fim: parar na primeira pagina daria uma conta curta a passar
      // por completa, que e' pior do que nao contar.
      do {
        const pagina = await umaPagina(api, especie.species_id, cursor);
        for (const c of pagina.lista) {
          olhados++;
          const q = String(c?.quality || '?');
          vistos[q] = (vistos[q] || 0) + 1;
          if (entra(c, faixas)) ids.push(String(c.id));
        }
        cursor = pagina.proximo;
      } while (cursor);
      if (ids.length) novo.push({ id: especie.species_id, nome: String(especie.species_name || '?'), ids });
    }

    plano = novo;
    lido = Date.now();
    chave = `lioncode-genetica-${lido}-${Math.random().toString(36).slice(2)}`;
    return {
      lido,
      olhados,
      vistos,
      total: novo.reduce((n, e) => n + e.ids.length, 0),
      // So' nome e quantidade: o painel nao precisa dos ids, e o que nao viaja nao se perde.
      especies: novo.map((e) => ({ nome: e.nome, quantos: e.ids.length })),
    };
  };

  const extrair = async (api, indice) => {
    const alvo = plano[indice];
    if (!alvo) return { erro: 'essa espécie não está no plano desta varredura' };
    let feitos = 0;
    for (let i = 0; i < alvo.ids.length; i += LOTE) {
      const lote = alvo.ids.slice(i, i + LOTE);
      await api.extractGeneticMaterial(
        { species_id: alvo.id, selection: { mode: 'ids', creature_ids: lote } },
        `${chave}:${indice}:${i / LOTE}`,
      );
      feitos += lote.length;
    }
    // O que foi apagado saiu da coleção: quem guarda listas de bichos tem de reler.
    try {
      globalThis.PokeIdle?.Bus?.emit?.('creature.updated', {});
      globalThis.PokeIdle?.Bus?.emit?.('genetic_material.updated', {});
    } catch {
      /* sem barramento: o painel do jogo acompanha no proximo F5. */
    }
    return { nome: alvo.nome, feitos };
  };

  /**
   * O erro do jogo **com os seus campos**, e nao so' a frase.
   *
   * MEDIDO EM 03/11/2026, depois de a primeira corrida do dono parar na segunda especie: o cliente
   * do jogo levanta `Error` com `code`, `status`, `retryAfterMs` e `requestId`. Mandar so' a
   * `message` para o painel era atirar fora exatamente o que distingue "nao pode" de "ainda nao" —
   * e foi isso que transformou uma pausa do servidor numa paragem definitiva.
   */
  const comoErro = (erro) => ({
    erro: String(erro?.message || erro || 'falhou'),
    code: String(erro?.code || ''),
    status: Number(erro?.status) || 0,
    esperarMs: Number(erro?.retryAfterMs) || 0,
  });

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
      if (acao === 'bandas') {
        responder({ bandas: bandas() });
        return;
      }
      if (acao === 'listar') {
        const faixas = evento?.detail?.faixas;
        if (!faixas || typeof faixas !== 'object' || !Object.keys(faixas).length)
          return void responder({ erro: 'nenhuma raridade escolhida' });
        responder(await listar(api, faixas));
        return;
      }
      if (acao === 'cidade') {
        responder(await irParaCidade());
        return;
      }
      if (acao === 'extrair') {
        // O erro desta chamada nao e' tratado la' em baixo de proposito: o `catch` geral so' sabe
        // a frase, e aqui quem pergunta precisa de saber se vale a pena tentar outra vez.
        try {
          responder(await extrair(api, Number(evento?.detail?.indice)));
        } catch (erro) {
          responder(comoErro(erro));
        }
        return;
      }
      responder({ erro: 'não sei fazer isso' });
    } catch (erro) {
      responder({ erro: String(erro?.message || erro || 'falhou') });
    }
  });
  document.documentElement.dataset.lioncodeGenetica = 'pronto';
})();
