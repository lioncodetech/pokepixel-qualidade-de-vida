// PokePixel - qualidade de vida: a conta de tipos, e a escolha da caçada que serve a um Pokemon.
//
// POR QUE ISTO EXISTE, E POR QUE E' UM ARQUIVO A' PARTE. Pedido pelo dono em 14/10/2026: *"tem como
// eu colocar um level target de mudar de hunt e ir para uma hunt que melhor cabe naquele pokemon que
// ta upando (...) que ele nao tome 2x ou 4x e que ele tenha vantagem no ataque"*. A escada ja' sabe
// **quando** trocar de caçada; o que faltava era **para onde**. Isso e' uma conta — nao mexe no
// jogo, nao abre janela, nao clica em nada — e uma conta que mora sozinha pode ser exercitada
// sozinha. O `escada.js` ja' tem 3.300 linhas e esta' na fila para ser dividido; empilhar mais
// quatrocentas la' dentro seria dividi-lo depois, a dobrar.
//
// DE ONDE VEM CADA NUMERO — E E' TUDO DO JOGO, MEDIDO EM 14/10/2026 NA CONTA DO DONO.
//
//   `PokeIdle.Api.getZones()`      377 caçadas, cada uma com `recommended_level`, `elements` e
//                                  `encounters` (a especie). **Nas 377, `min_level`, `max_level` e
//                                  `recommended_level` sao sempre iguais**: o nivel de uma caçada e'
//                                  um numero so', e nao uma faixa para interpretar.
//   `PokeIdle.Api.getMoves()`      617 golpes, cada um com `element`, `power` e `category`.
//   `PokeIdle.Species.get(slug)`   `elements` (os tipos) e `move_progression` (golpe + nivel em que
//                                  ele abre). **Por isso nao se supoe STAB**: sabe-se que golpes o
//                                  bicho de facto ja' tem naquele nivel.
//
// Nada disto se le' aqui: quem fala com o jogo e' a ponte, em `escada-main.js`. Aqui so' entram
// numeros, e so' saem decisoes.
//
// A TABELA E' COPIA, E A COPIA FOI CONFERIDA. Ela nasceu do proprio `EncyclopediaScene.js` do jogo,
// lido na conta em 14/10/2026 — e nao de memoria nem da tabela canonica da franquia. A diferenca
// importa: o PokePixel e' um fan game e podia divergir. Nao diverge hoje, e o teste guarda isso.
//
// **E ha' uma segunda testemunha, de graca.** A janela de caçadas do jogo mostra uma coluna "GOLPES
// RECOMENDADOS" com os multiplicadores — no Pupitar (Pedra/Terra) ela diz *"Agua x4,0 · Planta x4,0
// · Gelo x2,0"*. Conferi a conta daqui contra essa coluna no jogo logado: bateu. Quem duvidar desta
// tabela tem onde olhar sem precisar de acreditar em mim.

(() => {
  'use strict';

  /** Os 18 tipos, na ordem em que o jogo os lista (`PokeIdle.ElementIcons.ORDER`). */
  const TIPOS = [
    'normal',
    'fire',
    'water',
    'electric',
    'grass',
    'ice',
    'fighting',
    'poison',
    'ground',
    'flying',
    'psychic',
    'bug',
    'rock',
    'ghost',
    'dragon',
    'dark',
    'steel',
    'fairy',
  ];

  /**
   * `TABELA[atacante][defensor]` = o multiplicador. O que nao esta' escrito e' 1.
   *
   * Copiada do `EncyclopediaScene.js` do jogo em 14/10/2026. Guardar so' o que difere de 1 e' o que
   * a torna legivel: 18x18 sao 324 casas, e 260 delas nao tem nada a dizer.
   */
  const TABELA = {
    normal: { rock: 0.5, ghost: 0, steel: 0.5 },
    fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
    water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
    electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
    grass: {
      fire: 0.5,
      water: 2,
      grass: 0.5,
      poison: 0.5,
      ground: 2,
      flying: 0.5,
      bug: 0.5,
      rock: 2,
      dragon: 0.5,
      steel: 0.5,
    },
    ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
    fighting: {
      normal: 2,
      ice: 2,
      poison: 0.5,
      flying: 0.5,
      psychic: 0.5,
      bug: 0.5,
      rock: 2,
      ghost: 0,
      dark: 2,
      steel: 2,
      fairy: 0.5,
    },
    poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
    ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
    flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
    psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
    bug: {
      fire: 0.5,
      grass: 2,
      fighting: 0.5,
      poison: 0.5,
      flying: 0.5,
      psychic: 2,
      ghost: 0.5,
      dark: 2,
      steel: 0.5,
      fairy: 0.5,
    },
    rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
    ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
    dragon: { dragon: 2, steel: 0.5, fairy: 0 },
    dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
    steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
    fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
  };

  /**
   * Quanto um golpe de `atacante` faz a quem tem os tipos `defensores`.
   *
   * Os tipos do defensor **multiplicam-se entre si**, que e' a regra do jogo e a razao de existirem
   * os 4x: grama contra Pedra/Terra e' 2 x 2. Um tipo que esta' fora da tabela vale 1 — e nao zero,
   * que seria dizer "nao faz nada" sobre uma coisa que nao se sabe.
   */
  const contra = (atacante, defensores) =>
    (defensores || []).reduce((total, d) => total * (TABELA[atacante]?.[d] ?? 1), 1);

  /**
   * O pior que ele leva: o maior multiplicador entre os tipos do **alvo** a bater nos tipos **dele**.
   *
   * E' o maior, e nao a media, porque o dono escreveu a regra assim — *"que ele nao tome 2x ou 4x"*.
   * Um alvo que bate 4x com um dos tipos e 0.5x com o outro continua a ser um alvo que bate 4x: a
   * media esconderia exactamente o caso que esta conta existe para evitar.
   *
   * Sem tipos de um lado ou do outro, a resposta e' 1: desconhecido nao e' perigo nem seguranca, e
   * inventar qualquer um dos dois seria pior do que o neutro.
   */
  const levaDe = (meusTipos, tiposDoAlvo) => {
    const alvo = (tiposDoAlvo || []).filter(Boolean);
    if (!alvo.length || !(meusTipos || []).length) return 1;
    return Math.max(...alvo.map((t) => contra(t, meusTipos)));
  };

  /**
   * O melhor que ele da': o maior multiplicador entre os golpes **dele** e os tipos do alvo.
   *
   * O maior, outra vez, e pelo mesmo motivo ao contrario: basta **um** golpe bom para a caçada valer
   * a pena. O jogo escolhe o golpe por conta propria, mas quem tem Lanca-Chamas contra um Planta vai
   * usar Lanca-Chamas — e, se nao usar, o pior que acontece e' a caçada ser so' igual a's outras.
   */
  const daCom = (meusGolpes, tiposDoAlvo) => {
    const golpes = (meusGolpes || []).filter((g) => g && g.elemento);
    if (!golpes.length) return 1;
    return Math.max(...golpes.map((g) => contra(g.elemento, tiposDoAlvo)));
  };

  /**
   * Os golpes que este Pokemon **ja' tem** neste nivel, a partir da progressao da especie.
   *
   * Tres filtros, e os tres sao sobre o que conta como golpe para esta conta:
   *
   *   1. **Ja' abriu** — `unlock_level <= nivel`. Um golpe de Lv 60 nao ajuda um Lv 40.
   *   2. **Faz dano.** Os de estado (`power` 1, "aumenta Defesa em 2 estagios") nao atacam nada, e
   *      contar o tipo deles daria vantagem onde nao ha' nenhuma.
   *   3. **Existe na lista de golpes** que o jogo mandou. Um id que nao casa e' um golpe que esta
   *      extensao nao conhece, e contar com ele seria apostar.
   */
  const golpesDe = (progressao, nivel, golpesDoJogo) => {
    const mapa = golpesDoJogo instanceof Map ? golpesDoJogo : new Map(golpesDoJogo || []);
    const saida = [];
    for (const passo of progressao || []) {
      if (!passo || !passo.id) continue;
      if (Number(passo.unlock_level) > Number(nivel)) continue;
      const golpe = mapa.get(passo.id);
      if (!golpe || !golpe.elemento) continue;
      if (!(Number(golpe.poder) > 1)) continue;
      saida.push(golpe);
    }
    return saida;
  };

  /**
   * A nota de uma caçada para este Pokemon: o que ele leva, o que ele da', e se ela passa.
   *
   * `passa` e' a regra do dono, literal: **nao levar 2x ou mais** e **dar 2x ou mais**. As duas
   * condicoes, e nao uma: uma caçada onde ele arrasa e apanha na mesma nao e' o que ele pediu.
   */
  const avaliar = (quem, cacada) => {
    const alvo = cacada?.elementos || [];
    const leva = levaDe(quem?.tipos, alvo);
    const da = daCom(quem?.golpes, alvo);
    return {
      cacada: cacada?.nome || '',
      nivel: cacada?.nivel ?? null,
      elementos: alvo,
      leva,
      da,
      passa: leva < 2 && da >= 2,
    };
  };

  /**
   * As caçadas que servem a este Pokemon, da melhor para a pior.
   *
   * `quem` e' `{ tipos, golpes, nivel }`. `cacadas` sao `{ nome, nivel, elementos, mundo }`.
   *
   * **A JANELA E' SOBRE O NIVEL DA CAÇADA, E E' SIMETRICA** — `nivel +- janela`, que e' o "5 pra
   * baixo e 5 pra cima" do pedido. Como o nivel de uma caçada e' um numero so' (medido: nas 377, o
   * minimo, o maximo e o recomendado sao iguais), nao ha' aqui nenhuma escolha escondida sobre
   * **qual** numero comparar.
   *
   * **AS LENDARIAS FICAM DE FORA POR OMISSAO.** Sao 19 das 377, e a Ilha Lendaria de Entei nao e'
   * sitio para onde mandar um Pokemon sozinho e sem aviso. Quem as quiser pede-as.
   *
   * A ordem: primeiro o que ele **da'** (e' o que faz a caçada render), e so' depois o menos que ele
   * **leva**. Empatados os dois, a mais perto do nivel dele — que entre iguais e' a escolha mais
   * conservadora, e, sobretudo, a **mesma** em duas batidas seguidas. Uma ordem que oscila faria a
   * escada viajar de um lado para o outro sem ninguem ter mudado de nivel.
   */
  const escolher = (quem, cacadas, opcoes = {}) => {
    const janela = Number(opcoes.janela) || 0;
    const nivel = Number(quem?.nivel);
    if (!janela || !Number.isFinite(nivel)) return [];
    const comLendarias = opcoes.comLendarias === true;
    const perto = (cacadas || []).filter(
      (c) =>
        c &&
        Number.isFinite(Number(c.nivel)) &&
        Number(c.nivel) >= nivel - janela &&
        Number(c.nivel) <= nivel + janela &&
        (comLendarias || c.mundo !== 'legendary'),
    );
    return perto
      .map((c) => avaliar(quem, c))
      .filter((a) => a.passa)
      .sort(
        (a, b) =>
          b.da - a.da ||
          a.leva - b.leva ||
          Math.abs(a.nivel - nivel) - Math.abs(b.nivel - nivel) ||
          a.cacada.localeCompare(b.cacada),
      );
  };

  const API = { TIPOS, TABELA, contra, levaDe, daCom, golpesDe, avaliar, escolher };

  if (typeof globalThis.PPX === 'object' && globalThis.PPX) globalThis.PPX.tipos = API;
  // Para o teste de mesa: `new Function('module', fonte)`. Ver `testes/tipos.test.mjs`.
  if (typeof module === 'object' && module) module.exports = API;
})();
