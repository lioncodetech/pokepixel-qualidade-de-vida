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

  /**
   * A hora do servidor, para o relogio do menu.
   *
   * **E' MEDIDA, NAO CALCULADA A PARTIR DO RELOGIO DA MAQUINA.** `getGameConfig()` devolve
   * `server_time` em UTC — medido em 27/10/2026, `2026-10-27T21:03:45Z` — e `getDailyLogin()`
   * devolve o fuso civil do servidor, `America/Sao_Paulo`. Sao esses dois que mandam: um fuso
   * cravado aqui seria uma mentira silenciosa no dia em que o jogo mudasse de casa, e Sao Paulo
   * nao tem horario de verao desde 2019, entao nao ha' o que corrigir a' mao.
   *
   * **A VIAGEM DO PEDIDO ENTRA NA CONTA.** O `server_time` chega ja' velho: foi carimbado algures
   * entre o pedido sair e a resposta voltar. Tomar o instante da chegada como o do carimbo erraria
   * por uma viagem inteira, sempre para o mesmo lado. Por isso vai daqui tambem o meio do intervalo
   * — e a viagem, para quem le' poder desconfiar de uma medicao feita num momento mau de rede.
   */
  /**
   * Espera o jogo publicar a API em vez de olhar uma vez e desistir.
   *
   * **ESTE DEFEITO JA' TINHA SIDO CONSERTADO NAS RARIDADES NO MESMO DIA, E EU REPETI-O AQUI.** O
   * menu monta-se cedo, a API do jogo chega depois, e um "ainda nao publicou" escrito uma vez fica
   * na tela depois de deixar de ser verdade. O limite fica abaixo da paciencia de quem pergunta,
   * senao o outro lado desiste primeiro e culpa a falha errada.
   */
  const ESPERA_DA_API = 12000;
  const esperarApi = async () => {
    const fim = Date.now() + ESPERA_DA_API;
    for (;;) {
      const api = globalThis.PokeIdle?.Api;
      if (typeof api?.getGameConfig === 'function') return api;
      if (Date.now() >= fim) return null;
      await new Promise((ok) => setTimeout(ok, 200));
    }
  };

  const horaDoServidor = async () => {
    const api = await esperarApi();
    if (!api)
      return {
        erro: 'o jogo ainda não publicou a API — espere a tela carregar',
        // **`semApi` e' o que deixa quem perguntou saber que vale a pena insistir.** As outras
        // falhas daqui nao melhoram por serem repetidas.
        semApi: true,
      };
    try {
      const antes = Date.now();
      const r = await api.getGameConfig();
      const depois = Date.now();
      const servidor = Date.parse((r?.data ?? r)?.server_time || '');
      if (!Number.isFinite(servidor)) return { erro: 'o jogo não disse que horas são' };

      // O fuso e' so' para escrever a hora; sem ele mostra-se UTC e diz-se que e' UTC. Um relogio
      // que erra de fuso calado e' pior do que um relogio que admite estar em UTC.
      let fuso = '';
      try {
        const l = await api.getDailyLogin?.();
        fuso = String((l?.data ?? l)?.timezone || '');
      } catch {
        // Sem o fuso ainda ha' hora; sem a hora nao ha' relogio.
      }
      return { ok: true, servidor, medidoEm: Math.round((antes + depois) / 2), viagem: depois - antes, fuso };
    } catch (e) {
      return { erro: `não consegui ler a hora do servidor: ${String(e?.message || e)}` };
    }
  };

  /**
   * A MARCA FICA NO DOM, PORQUE O DOM E' A UNICA COISA QUE OS DOIS MUNDOS PARTILHAM.
   *
   * Posta DEPOIS do ouvinte, de proposito: antes dele, ela mentiria.
   */
  addEventListener('lioncode:nucleo:pedido', async (evento) => {
    const eco = evento?.detail?.eco;
    const responder = (detalhe) =>
      dispatchEvent(new CustomEvent('lioncode:nucleo:resposta', { detail: { eco, ...detalhe } }));
    if (String(evento?.detail?.acao || '') !== 'hora') return responder({ erro: 'não sei fazer isso' });
    responder(await horaDoServidor());
  });
  document.documentElement.dataset.lioncodeNucleo = 'pronto';

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
