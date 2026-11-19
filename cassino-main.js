// Pula a animação do sorteio do Cassino — a pedido, e só ela.
//
// POR QUE ISTO EXISTE. O jogo vira as cartas uma a uma, esperando cada linha do tempo acabar:
// `casinoReveal` resolve aos 1.660 ms, e o laço em `NpcInteraction.js` faz `await` carta a carta.
// Um lote de 10 são ~17 segundos; 500 Eevees são 50 lotes, cerca de catorze minutos a olhar carta
// a virar. Pior: os botões COMPRAR NOVAMENTE e FECHAR só são criados **depois** do laço, e foi
// isso que parou a compra de 500 na primeira rodada.
//
// POR QUE ASSIM. O próprio jogo já tem este caminho: a primeira linha de `casinoReveal` é
//
//     if (!card || motionReduced()) { card.classList.add("is-revealed"); resolve(); return; }
//
// e `motionReduced()` é só `prefers-reduced-motion: reduce`. Quem liga essa preferência no Windows
// já obtém exatamente este efeito, sem extensão nenhuma. O que este arquivo faz é oferecer o mesmo
// atalho **só para o Cassino**, sem mexer numa preferência do sistema inteiro — e o que ele põe no
// lugar é a cópia fiel daquela linha, não uma invenção nossa.
//
// A LINHA QUE ISTO ATRAVESSA, DITA EM VOZ ALTA. O resto deste pacote clica onde você clicaria e
// não troca uma vírgula do jogo. Aqui, pela primeira vez, uma função do jogo é substituída. Por
// isso:
//
//   - vem **desligado**, e só age com a caixinha marcada no painel do Cassino;
//   - a original é guardada e volta a valer no instante em que a caixinha é desmarcada — a decisão
//     é lida a cada carta, não uma vez no arranque;
//   - substitui **uma** função, a do sorteio do Cassino. Evolução, shiny, nível, pesca e as outras
//     vinte continuam como o jogo as escreveu.
//
// Roda no mundo da página (`world: "MAIN"`), que é onde `window.PokeIdle` existe: do mundo isolado
// da extensão esse objeto não é alcançável. A decisão viaja pelo `localStorage`, que os dois
// mundos partilham.
(() => {
  'use strict';

  const CHAVE_LIGADOS = 'lioncode:pokepixel:modulos';
  const CHAVE = 'lioncode:cassino:config';

  const ligado = (id) => {
    try {
      return (JSON.parse(localStorage.getItem(CHAVE_LIGADOS)) ?? {})[id] !== false;
    } catch {
      return true;
    }
  };

  /**
   * Lida a cada carta, de propósito.
   *
   * Ler uma vez no arranque faria a caixinha só valer depois de um F5 — e quem a desmarca no meio
   * de uma compra está a dizer "quero ver as cartas agora", não "na próxima vez que eu abrir o
   * jogo".
   */
  const pular = () => {
    try {
      return (JSON.parse(localStorage.getItem(CHAVE)) ?? {}).pularAnimacao === true;
    } catch {
      // Sem conseguir ler a escolha, o jogo fica como o jogo é. O silêncio aqui tem de cair para o
      // lado de não mexer em nada.
      return false;
    }
  };

  if (!ligado('cassino')) return;

  let original = null;
  let nossa = null;

  const vestir = () => {
    const fx = window.PokeIdle?.AnimeFX;
    if (!fx || typeof fx.casinoReveal !== 'function') return;
    if (fx.casinoReveal === nossa) return;

    // Sempre a partir da que está lá agora: o jogo reatribui `PI.AnimeFX` inteiro ao carregar, e
    // guardar a primeira que vimos poria uma função velha de volta numa recarga parcial.
    original = fx.casinoReveal;
    nossa = function (card, shinyResult) {
      if (!pular()) return original.call(this, card, shinyResult);
      // A cópia fiel do atalho que o próprio jogo usa com movimento reduzido.
      if (card) card.classList.add('is-revealed');
      return Promise.resolve();
    };
    fx.casinoReveal = nossa;
  };

  vestir();
  // O `AnimeEffects.js` atribui `PI.AnimeFX` de uma vez, e pode fazê-lo depois de nós: olhar uma
  // vez e desistir deixaria a caixinha sem efeito conforme a ordem de carga do dia.
  setInterval(vestir, 2000);
})();
