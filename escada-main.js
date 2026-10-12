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

  /** Quanto se espera para o jogo assentar na cidade antes de falar com a enfermeira. */
  const ATE_ASSENTAR = 1500;

  const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

  const naCidade = () => {
    const cidade = globalThis.PokeIdle?.Nav?.CITY_MAP_ID;
    const agora = globalThis.$gameMap?.mapId?.();
    return Number.isFinite(agora) && agora === cidade;
  };

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
  const irParaCidadeECurar = async () => {
    const api = globalThis.PokeIdle?.Api;
    const nav = globalThis.PokeIdle?.Nav;
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
      // `goToCity` devolve `false` quando nao conseguiu sair de onde estava — pescaria a meio, por
      // exemplo. Dizer isso e' melhor do que curar fora da cidade e a cura nao pegar.
      if (foi === false) return { erro: 'o jogo não me deixou sair para a cidade agora' };
      await espera(ATE_ASSENTAR);
    }

    try {
      await api.healTeam();
    } catch (e) {
      return { erro: `a enfermeira não atendeu: ${String(e?.message || e)}` };
    }
    return { ok: true };
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

  const FAZ = { cidade: irParaCidadeECurar, bichos };

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
    faz()
      .then(responder)
      .catch((erro) => responder({ erro: String(erro?.message || erro || 'falhou') }));
  });
})();
