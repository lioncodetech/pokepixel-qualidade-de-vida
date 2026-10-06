// A ponte da lista de raridades, no mundo da pagina.
//
// POR QUE EXISTE UM ARQUIVO SO' PARA ISTO. O jogo publica a propria API em `window.PokeIdle`, e e'
// de la' que sai tudo o que esta ferramenta mostra — inclusive o numero da raridade, que na tela
// so' aparece abrindo um Pokemon de cada vez. Mas um content script comum roda num `globalThis`
// separado do da pagina: de la' `PokeIdle` simplesmente nao existe. Por isso este arquivo entra com
// `world: "MAIN"`, como `sem-grafico.js` ja' fazia para alcancar o desenho do jogo.
//
// O QUE ELE FAZ, E SO' ISSO: responde a um pedido com a lista. Nao desenha nada, nao clica em nada,
// nao guarda nada. Quem desenha e' `raridades.js`, no mundo da extensao, e os dois conversam por
// evento de DOM — o unico canal que os dois mundos partilham.
//
// MEDIDO NA CONTA REAL (06/10/2026), com 117 Pokemon:
//
//   PokeIdle.Api.getCreatures()          -> { data: [...], next_cursor: '', paginated: false }
//   PokeIdle.Api.getCreatures('storage') -> so' o deposito
//
// e cada bicho traz `quality_multiplier` (1.4228...), `quality` ('epic'), `species_name`,
// `location` ('inventory' | 'storage' | 'team'), `level`, `is_shiny`, `locked` e `sell_value`.
// Sem location vem tudo: 16 da mochila + 100 do deposito + 1 do time = os 117. E' por isso que esta
// ferramenta nao precisa abrir janela nenhuma no jogo.

(() => {
  'use strict';

  const PEDIDO = 'lioncode:raridades:pedido';
  const RESPOSTA = 'lioncode:raridades:resposta';

  /**
   * So' os campos que a lista usa.
   *
   * O resto do registro e' do jogador — id do treinador, assinatura de captura, zona, movimentos —
   * e nao tem por que atravessar para o outro mundo so' para ser descartado. Menos dados cruzando
   * e' menos coisa para dar errado, e nada aqui identifica ninguem.
   */
  const reduzir = (c) => ({
    especie: String(c?.species_name || c?.species_id || '?'),
    apelido: String(c?.nickname || ''),
    raridade: Number(c?.quality_multiplier),
    qualidade: String(c?.quality || ''),
    onde: String(c?.location || ''),
    nivel: Number(c?.level) || 0,
    brilhante: c?.is_shiny === true,
    trancado: c?.locked === true,
    venda: Number(c?.sell_value) || 0,
  });

  /**
   * As faixas de cada qualidade, perguntadas ao jogo.
   *
   * Medidas na conta real: fraca 0,90-0,99, comum 1,00-1,09, incomum 1,10-1,24, rara 1,25-1,39,
   * epica 1,40-1,54, lendaria 1,55-1,69. Nao sao cravadas aqui de proposito — se o jogo mexer numa
   * delas, a lista acompanha sozinha, e um numero cravado seria uma mentira silenciosa.
   */
  const faixas = () => {
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

  addEventListener(PEDIDO, (evento) => {
    const eco = evento?.detail?.eco;
    const fresco = evento?.detail?.fresco === true;
    const responder = (detalhe) =>
      dispatchEvent(new CustomEvent(RESPOSTA, { detail: { eco, ...detalhe } }));

    const api = globalThis.PokeIdle?.Api;
    // `getCreaturesFresh` existe para o botao de atualizar: a outra responde do cache do jogo, que
    // e' o que se quer na abertura do painel e nao e' o que se quer depois de capturar algo.
    const buscar = fresco ? api?.getCreaturesFresh : api?.getCreatures;
    if (typeof buscar !== 'function') {
      responder({ erro: 'o jogo ainda não publicou a API — espere a tela carregar e tente de novo' });
      return;
    }

    Promise.resolve()
      .then(() => buscar.call(api))
      .then((resposta) => {
        const lista = Array.isArray(resposta) ? resposta : resposta?.data;
        if (!Array.isArray(lista)) {
          responder({ erro: 'o jogo respondeu uma coisa que não é uma lista' });
          return;
        }
        // `next_cursor` vem vazio numa coleção inteira — medido com 117. Se um dia vier preenchido,
        // o que esta' na tela e' uma parte, e dizer isso e' melhor do que mostrar uma lista curta
        // como se fosse tudo.
        const resto = resposta?.next_cursor ? String(resposta.next_cursor) : '';
        responder({ lista: lista.map(reduzir), parcial: Boolean(resto), faixas: faixas() });
      })
      .catch((erro) => responder({ erro: String(erro?.message || erro || 'falhou') }));
  });
})();
