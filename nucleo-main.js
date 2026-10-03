// O registro mínimo do mundo da página.
//
// "Sem gráfico" precisa alcançar o desenho do jogo, então roda com `world: "MAIN"` — dentro da
// própria página, e não no mundo isolado da extensão. De lá ela não enxerga o `PPX` do menu: os
// dois mundos têm `globalThis` separados. O que eles partilham é o `localStorage` da página, que é
// onde o menu grava quais ferramentas estão ligadas.
//
// Por isso aqui existe um `PPX` próprio, que só sabe responder uma coisa: iniciar, ou não. Quem
// desenha o menu é o outro núcleo; ligar e desligar esta ferramenta vale a partir da próxima carga
// da página, e o menu diz isso.

(() => {
  'use strict';

  const CHAVE_LIGADOS = 'lioncode:pokepixel:modulos';

  const ligado = (id) => {
    try {
      return (JSON.parse(localStorage.getItem(CHAVE_LIGADOS)) ?? {})[id] !== false;
    } catch {
      // Sem conseguir ler a escolha, a ferramenta roda: é como ela se comportava sozinha, e deixar
      // de rodar por causa de um armazenamento bloqueado seria sumir sem explicação.
      return true;
    }
  };

  globalThis.PPX = {
    modulo(info, iniciar) {
      if (!ligado(info.id)) return;
      try {
        iniciar();
      } catch (e) {
        // Aqui não há menu para mostrar o erro; o console é o único lugar que resta.
        console.error(`[PokePixel] ${info.id}:`, e);
      }
    },
  };
})();
