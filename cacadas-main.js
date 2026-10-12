// A ponte das caçadas, no mundo da pagina: a lista inteira das caçadas do jogo, com nivel e regiao.
//
// POR QUE EXISTE. Ate' aqui, guardar um atalho era um ato de presenca: entrava-se na caçada, lia-se
// `.platform-hunt__zone-name` e guardava-se o nome — porque **o nome so' existe no DOM enquanto a
// caçada corre**, e a lista da janela desenha uma aba de cada vez. Quem quisesse nove atalhos fazia
// nove viagens, e o nivel de cada caçada nao aparecia em lado nenhum do painel.
//
// MEDIDO NA CONTA REAL (12/10/2026):
//
//   Api.getWorlds() -> { data: [4] }    label "Kanto" | "Johto" | "Ilhas Lendárias" | "Hoenn"
//   Api.getZones()  -> { data: [377] }  name, min_level, max_level, recommended_level, world, type
//
// E TRES COISAS QUE MUDAM O DESENHO DA FERRAMENTA:
//
// 1. **O `label` do mundo e' exactamente o texto da aba.** As quatro abas da janela leem-se
//    "Kanto", "Johto", "Ilhas Lendárias", "Hoenn", e os quatro `label` sao esses mesmos. A aba
//    deixa de ser adivinhada.
//
// 2. **O UUID era o endereço, e ninguem sabia.** `.platform-hunt__zone-meta` mostra, na caçada em
//    curso, `ee6523e1-88ec-4d67-bf21-d83e23222518 · Modo plataforma` — e esse UUID e' o `id` do
//    mundo Johto. A "regiao" guardada que parecia lixo era a chave certa para a tabela errada: nao
//    havia tabela. Agora ha'.
//
// 3. **O nivel de uma caçada e' um numero so'.** Nos 377 registros, `min_level`, `max_level` e
//    `recommended_level` sao iguais — conferido um por um, nao por amostra. Por isso atravessa um
//    `nivel`, e nao uma faixa: inventar "155–155" seria desenhar uma faixa que o jogo nao tem.
//
// O QUE ELE NAO FAZ, E DE PROPOSITO: **nao entra em caçada nenhuma.** `Api.prepareHunt(zoneId)` e
// `Nav.goToHunt(mapId)` existem e levariam direto, sem abrir janela nem varrer abas — e ficam de
// fora desta ponte. Entrar e' a acao que mexe no jogo do dono; ela continua a passar pelo caminho
// que ele ve' na tela, com o botao "Caçar" que ele mesmo clicaria. Ler a lista nao mexe em nada.

(() => {
  'use strict';

  const PEDIDO = 'lioncode:cacadas:pedido';
  const RESPOSTA = 'lioncode:cacadas:resposta';

  /**
   * A lista das caçadas do jogo: nome, nivel, e em que aba ela mora.
   *
   * Atravessam cinco campos, e nao o registro todo. O resto e' do jogo e nao e' desta ferramenta —
   * `encounters`, `map_x`, `power_score`, `capture_rate_multiplier`: sao dezoito campos por caçada,
   * 377 vezes, para serem descartados do outro lado.
   *
   * `trancado` vem do mundo, nao da caçada: as Ilhas Lendarias respondem `locked: true` na conta
   * real, e e' a mesma aba que a janela desenha desativada. Um atalho para la' nao da' para abrir,
   * e dizer isso antes de tentar e' melhor do que falhar depois.
   */
  const zonas = async () => {
    const api = globalThis.PokeIdle?.Api;
    if (typeof api?.getZones !== 'function' || typeof api?.getWorlds !== 'function')
      return { erro: 'o jogo ainda não publicou a API — espere a tela carregar' };
    let mundos = null;
    let lista = null;
    try {
      mundos = await api.getWorlds();
      lista = await api.getZones();
    } catch (e) {
      return { erro: `não consegui ler a lista de caçadas: ${String(e?.message || e)}` };
    }
    const porMundo = new Map(
      (Array.isArray(mundos?.data) ? mundos.data : []).map((m) => [
        String(m?.id || ''),
        { aba: String(m?.label || ''), ordem: Number(m?.order) || 0, trancado: m?.locked === true },
      ]),
    );
    return {
      ok: true,
      zonas: (Array.isArray(lista?.data) ? lista.data : [])
        .filter((z) => z?.name && z?.type === 'hunt')
        .map((z) => {
          const mundo = porMundo.get(String(z?.world || '')) || {};
          return {
            nome: String(z.name),
            nivel: Number(z?.min_level) || 0,
            aba: mundo.aba || '',
            ordem: mundo.ordem || 0,
            trancado: mundo.trancado === true,
          };
        }),
    };
  };

  const FAZ = { zonas };

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
