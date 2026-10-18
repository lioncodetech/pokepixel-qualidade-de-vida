// A ponte da escada, no mundo da pagina: parar a caçada, ir para a cidade e curar na enfermeira.
//
// POR QUE EXISTE. A escada foi escrita de proposito **sem** ponte: quem e' o lider, que nivel ele
// tem e quanto falta da espera da troca esta' todo no DOM, e o cabeçalho de `escada.js` explica
// porque' ler do DOM era preferivel. Isto nao desmente aquilo — acrescenta uma coisa que o DOM nao
// tem. Curar a equipe nao e' uma leitura: e' tres acoes do jogo em ordem, e nenhuma delas tem botao
// que esta ferramenta consiga achar e clicar com honestidade.
//
// MEDIDO NA CONTA REAL (11/10/2026), com o Ralts Lv 1 morto numa caçada:
//
//   PokeIdle.Api.healTeam()   -> POST /team/heal, devolve a equipe inteira com `hp === max_hp`
//   PokeIdle.Api.stopHunt()   -> para a caçada em curso
//   PokeIdle.Nav.goToCity()   -> async, devolve `false` se nao conseguiu sair de onde estava
//   PokeIdle.Nav.CITY_MAP_ID  -> 1
//
// E A ORDEM NAO E' ENFEITE. Chamei `healTeam()` sozinho, com a caçada a correr: **o servidor curou**
// (devolveu HP cheio em todos) **e o HUD continuou com o Ralts "Pokémon derrotado"**. A caçada
// guarda o proprio estado de combate, e a cura so' aparece depois de sair dela. Por isso para-se a
// caçada primeiro, depois vai-se para a cidade, e so' entao se cura — que e' exactamente o caminho
// que um jogador faz a pe' ate' a' enfermeira.
//
// `Api.reviveHunt(item)` tambem ressuscita, e **nao e' usada aqui de proposito**: ela gasta um item
// do jogador. A enfermeira e' de graca; gastar o inventario de alguem para poupar um passo seria
// decidir pelo dono uma coisa que e' dele.
//
// DEPOIS NASCEU A SEGUNDA ACAO, `bichos`, e pelo mesmo motivo: o modo de grupo precisa do nivel de
// Pokemon que **nao estao na equipe**, e isso o DOM so' daria abrindo o inventario. Ver `bichos`.
//
// O QUE ELE FAZ, E SO' ISSO: responde a um pedido com `ok` ou com o passo que falhou. Nao desenha,
// nao decide quando curar, nao guarda nada. Quem decide e' `escada.js`, do lado da extensao.

(() => {
  'use strict';

  const PEDIDO = 'lioncode:escada:pedido';
  const RESPOSTA = 'lioncode:escada:resposta';

  /** Limite para o mapa confirmar que a cidade terminou de carregar. */
  const ATE_CIDADE = 15000;
  /** A Nurse Joy pode aparecer depois do mapa; a cura ganha algumas tentativas curtas. */
  const TENTATIVAS_DE_CURA = 3;

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

  const estaDerrotada = (id) =>
    [...document.querySelectorAll('.pokeidle-team-card[data-creature-id]')].some(
      (el) =>
        el.getAttribute('data-creature-id') === String(id || '') &&
        (el.classList.contains('is-fainted') || /derrotado/i.test(el.getAttribute('title') || '')),
    );

  /**
   * Parar a caçada, ir para a cidade, curar.
   *
   * E' uma acao so' — `cidade` — e nao duas, porque **parar a caçada e' o que faz a cura pegar**
   * (ver em cima) e parar a caçada e' tambem tudo o que "voltar para a cidade" quer dizer. Separar
   * daria dois caminhos para o mesmo passeio, e um deles passaria a' frente da enfermeira sem
   * cumprimentar. A cura e' de graca: quem so' queria estacionar a equipe na cidade nao perde nada
   * por ela chegar la' inteira.
   *
   * Cada passo diz o que falhou com o nome do passo, e nao "falhou": a diferenca entre "nao
   * consegui parar a caçada" e "a enfermeira nao atendeu" e' a diferenca entre dois problemas
   * diferentes, e quem le' o painel e' quem vai ter de resolver um deles.
   *
   * Parar uma caçada que nao existe nao e' erro — e' o estado que se queria. Por isso o `stopHunt`
   * que estoura nao interrompe a cura: quem nao esta' em caçada nenhuma ja' esta' pronto para a
   * enfermeira.
   */
  const irParaCidadeECurar = async (pedido = {}) => {
    const api = globalThis.PokeIdle?.Api;
    const nav = globalThis.PokeIdle?.Nav;
    const criatura = String(pedido?.criatura || '');
    if (typeof api?.healTeam !== 'function')
      return {
        erro: 'o jogo ainda não publicou a API — espere a tela carregar',
      };

    if (typeof api.stopHunt === 'function') {
      try {
        await api.stopHunt();
      } catch {
        // Ver em cima: nao estar em caçada nenhuma e' o destino, nao um obstaculo.
      }
    }

    if (!naCidade()) {
      if (typeof nav?.goToCity !== 'function') return { erro: 'não achei o caminho para a cidade' };
      let foi = false;
      try {
        foi = await nav.goToCity();
      } catch (e) {
        return {
          erro: `não consegui ir para a cidade: ${String(e?.message || e)}`,
        };
      }
      // `goToCity()` pode responder antes de o mapa e os NPCs terminarem de carregar. Era aqui que
      // a escada chegava visualmente a' cidade, chamava a enfermeira cedo demais e ficava parada
      // com um derrotado. O mapa, e nao um cronometro fixo, passa a dizer quando se pode curar.
      const chegou = await esperarAte(naCidade, ATE_CIDADE);
      if (!chegou)
        return {
          erro:
            foi === false
              ? 'o jogo não me deixou sair para a cidade agora'
              : 'a cidade não terminou de carregar',
        };
    }

    let ultimaFalha = null;
    for (let tentativa = 1; tentativa <= TENTATIVAS_DE_CURA; tentativa += 1) {
      try {
        await api.healTeam();
        // A resposta HTTP pode chegar antes de o jogo redesenhar a equipe. So' terminou quando o
        // proprio HUD deixou de marcar derrotado; caso contrario a Nurse Joy ganha nova tentativa.
        if (await esperarAte(() => !estaDerrotada(criatura), 2500)) return { ok: true };
        ultimaFalha = new Error('o Pokémon continua derrotado no HUD');
      } catch (e) {
        ultimaFalha = e;
      }
      if (tentativa < TENTATIVAS_DE_CURA) await espera(750);
    }

    // Pedido do dono em 18/10/2026: se a Nurse Joy nao conseguir retirar a derrota, gasta-se um
    // Max Revive **nesse Pokemon**, e so' nesse caso. A caçada ja' foi encerrada, portanto a rota
    // correcta e' a de uso de item na criatura — `reviveHunt` exige uma caçada corrente e aqui ja'
    // nao existe. O id vem do catálogo público do próprio jogo: `revive_max`.
    if (!criatura || typeof api.useItem !== 'function')
      return { erro: `a enfermeira não atendeu: ${String(ultimaFalha?.message || ultimaFalha)}` };
    try {
      await api.useItem('revive_max', criatura, 1);
      if (await esperarAte(() => !estaDerrotada(criatura), 5000))
        return { ok: true, maxRevive: true };
      return { erro: 'usei o Max Revive, mas o Pokémon continua derrotado no HUD' };
    } catch (e) {
      return {
        erro: `a enfermeira não atendeu e não consegui usar o Max Revive: ${String(e?.message || e)}`,
      };
    }
  };

  /**
   * Todos os Pokemon da conta, com nivel — a lista de quem ainda falta upar.
   *
   * MEDIDO NA CONTA REAL (12/10/2026), com 223 Pokemon: `Api.getCreatures()` devolve
   * `{ data: [...] }` e cada registro traz `id`, `species_name`, `level` e `location`
   * (`'team' | 'inventory' | 'storage'`). **Sem abrir janela nenhuma**, que e' a razao de isto
   * existir: o nivel de quem esta' na equipe le'-se no HUD, mas o de quem esta' na mochila so'
   * apareceria abrindo o inventario — e abrir janelas no jogo e' a operacao que mais falha.
   *
   * Atravessam quatro campos, e nao o registro todo. O resto e' do jogador — ivs, natureza,
   * movimentos, valor de venda, zona de captura — e nao tem por que passar para o outro mundo so'
   * para ser descartado. `species_name` vem porque o jogo **recusa duas vezes a mesma especie na
   * equipe**, e quem escolhe quem entra tem de saber disso antes de tentar.
   */
  const bichos = async () => {
    const api = globalThis.PokeIdle?.Api;
    if (typeof api?.getCreatures !== 'function')
      return { erro: 'o jogo ainda não publicou a API — espere a tela carregar' };
    let r = null;
    try {
      r = await api.getCreatures();
    } catch (e) {
      return { erro: `não consegui ler a coleção: ${String(e?.message || e)}` };
    }
    const lista = Array.isArray(r?.data) ? r.data : [];
    return {
      ok: true,
      bichos: lista
        .map((c) => ({
          id: String(c?.id || ''),
          nome: String(c?.species_name || '?'),
          especie: String(c?.species_id || c?.species_name || '?'),
          nivel: Number(c?.level) || 0,
          onde: String(c?.location || ''),
        }))
        .filter((b) => b.id),
    };
  };

  /**
   * O mundo como o jogo o conhece: as caçadas, os golpes e os tipos das especies pedidas.
   *
   * A TERCEIRA ACAO, e a que nasceu de uma surpresa boa. Em 14/10/2026 o dono pediu que a escada
   * escolhesse a caçada sozinha — nivel proximo, sem desvantagem de tipo, com vantagem no ataque —
   * e eu fui medir de onde viriam os tipos, a contar ter de embarcar uma tabela de mil especies.
   * Nao e' preciso: **esta tudo na API do proprio jogo**, e a extensao so' tem de pedir.
   *
   *   `Api.getZones()`    377 caçadas. Medido: nas 377, `min_level`, `max_level` e
   *                       `recommended_level` sao **iguais** — o nivel de uma caçada e' um numero
   *                       so'. E todas tem `elements` preenchido e **exactamente uma** especie em
   *                       `encounters`: nao ha' excepcao a tratar, nem nome para interpretar.
   *   `Api.getMoves()`    617 golpes, com `element` e `power`.
   *   `Species.get(slug)` `elements` e `move_progression`. **E' por isto que nao se supoe STAB**:
   *                       sabe-se que golpes o bicho ja' tem naquele nivel.
   *
   * ATRAVESSAM TRES CAMPOS DE CADA COISA, E NAO O REGISTO TODO — a mesma regra do `bichos`, e aqui
   * ela pesa mais: os registos crus trazem sprites, drops, evolucoes e estatisticas base, e seriam
   * centenas de kilobytes a atravessar para serem deitados fora do outro lado.
   *
   * As especies vem **por pedido**, e nao todas: quem decide precisa dos tipos de um punhado de
   * Pokemon — os da equipe, os da piscina —, e nao do bestiario inteiro.
   */
  const mundo = async (pedido) => {
    const api = globalThis.PokeIdle?.Api;
    const Species = globalThis.PokeIdle?.Species;
    if (typeof api?.getZones !== 'function' || typeof api?.getMoves !== 'function')
      return { erro: 'o jogo ainda não publicou a API — espere a tela carregar' };

    let zonas = null;
    let golpes = null;
    try {
      [zonas, golpes] = await Promise.all([api.getZones(), api.getMoves()]);
    } catch (e) {
      return { erro: `não consegui ler o mundo do jogo: ${String(e?.message || e)}` };
    }
    const comoLista = (r) => (Array.isArray(r) ? r : r?.data || r?.zones || r?.moves || []);

    const cacadas = comoLista(zonas)
      .filter((z) => z && z.type === 'hunt' && z.name)
      .map((z) => ({
        nome: String(z.name),
        // Um numero so', medido: os tres niveis sao iguais nas 377. Guardar os tres seria convidar
        // quem vier a seguir a escolher entre eles — e a escolha nao existe.
        nivel: Number(z.recommended_level) || 0,
        elementos: Array.isArray(z.elements) ? z.elements.map(String) : [],
        mundo: String(z.world || ''),
        // A especie serve para dizer o nome na tela ("vai para a caçada do Golem"), e nao para a
        // conta: quem decide sao os tipos da zona.
        especie: String(z.encounters?.[0]?.species_id || ''),
      }));

    const lista = comoLista(golpes)
      .filter((m) => m && m.id)
      .map((m) => ({
        id: String(m.id),
        elemento: String(m.element || ''),
        poder: Number(m.power) || 0,
      }));

    const especies = {};
    for (const slug of Array.isArray(pedido?.especies) ? pedido.especies : []) {
      const r = typeof Species?.get === 'function' ? Species.get(String(slug)) : null;
      if (!r) continue;
      especies[String(slug)] = {
        nome: String(r.name || slug),
        tipos: Array.isArray(r.elements) ? r.elements.map(String) : [],
        progressao: (Array.isArray(r.move_progression) ? r.move_progression : [])
          .filter((m) => m && m.id)
          .map((m) => ({ id: String(m.id), unlock_level: Number(m.unlock_level) || 1 })),
      };
    }

    return { ok: true, cacadas, golpes: lista, especies };
  };

  const FAZ = { cidade: irParaCidadeECurar, bichos, mundo };

  addEventListener(PEDIDO, (evento) => {
    const eco = evento?.detail?.eco;
    const acao = String(evento?.detail?.acao || '');
    const responder = (detalhe) =>
      dispatchEvent(new CustomEvent(RESPOSTA, { detail: { eco, ...detalhe } }));

    const faz = Object.hasOwn(FAZ, acao) ? FAZ[acao] : null;
    if (!faz) {
      responder({ erro: `não sei fazer "${acao}"` });
      return;
    }
    // O pedido inteiro atravessa, e nao so' a acao: o `mundo` precisa de saber **que** especies lhe
    // interessam, e mandar o bestiario todo para ser deitado fora do outro lado seria pior.
    faz(evento?.detail || {})
      .then(responder)
      .catch((erro) => responder({ erro: String(erro?.message || erro || 'falhou') }));
  });
})();
