// Ponte de leitura da equipe. Quem monta a equipe continua sendo o DOM; quem diz QUEM ESTA' nela
// passou a ser o servidor.
//
// **MEDIDO NA CONTA DO DONO EM 26/10/2026, COM AS TRES FONTES LADO A LADO.** Depois de uma
// remocao, o HUD da tela continuou a mostrar o Alakazam na equipe durante minutos, enquanto o
// `Api.getTeam()` e o inventario ja' o tinham tirado. Nao era atraso: ele nao se acertava sozinho.
//
// O `times.js` lia o HUD de proposito — e com razao para o caso que ele conhecia: o inventario
// pinta a grade em etapas, e ler dali cedo demais dava um Pokemon da equipe por fora. So' que o
// outro lado do mesmo problema ficou por tratar: **o HUD mente DEPOIS de uma accao**, e e' logo
// depois de uma accao que a ferramenta pergunta. Dai os tres sintomas do mesmo dia:
//
//   - "o cartao de X nao tem Desequipar" — o HUD dizia que X estava na equipe, o cartao (que vem
//     do estado verdadeiro) oferecia Equipar;
//   - "o jogo nao tirou X depois de 8 s" — o jogo tinha tirado; o HUD e' que nao mudou;
//   - "nao consegui tornar X ativo" — a confirmacao da lideranca tambem era lida do HUD.
//
// O servidor nao tem esse problema: `getTeam()` devolve `member_ids` e `leader_id`, que e' o que
// a propria accao acabou de mudar.
(() => {
  'use strict';

  const PEDIDO = 'lioncode:times:pedido';
  const RESPOSTA = 'lioncode:times:resposta';

  const valor = (r) => r?.data ?? r;

  const equipe = async () => {
    const api = globalThis.PokeIdle?.Api;
    if (typeof api?.getTeam !== 'function')
      return { erro: 'o jogo ainda não publicou a equipe — espere a tela carregar' };
    try {
      const d = valor(await api.getTeam());
      const time = d?.team;
      if (!time || !Array.isArray(time.member_ids))
        return { erro: 'a equipe veio numa forma que não entendi' };
      return {
        ok: true,
        ids: time.member_ids.map(String),
        lider: String(time.leader_id || ''),
      };
    } catch (e) {
      return { erro: `não consegui ler a equipe: ${String(e?.message || e)}` };
    }
  };

  const FAZ = { equipe };
  /**
   * A MARCA FICA NO DOM, PORQUE O DOM E' A UNICA COISA QUE OS DOIS MUNDOS PARTILHAM.
   *
   * Posta DEPOIS do ouvinte, de proposito: antes dele, ela mentiria. E um "ja' estou aqui" como
   * evento teria o mesmo defeito ao contrario — perder-se-ia se o outro lado ainda nao escutasse.
   */
  addEventListener(PEDIDO, (evento) => {
    const eco = evento?.detail?.eco;
    const acao = String(evento?.detail?.acao || '');
    const responder = (detalhe) =>
      dispatchEvent(new CustomEvent(RESPOSTA, { detail: { eco, ...detalhe } }));
    const faz = Object.hasOwn(FAZ, acao) ? FAZ[acao] : null;
    if (!faz) return responder({ erro: `não sei fazer "${acao}"` });
    Promise.resolve(faz(evento.detail || {}))
      .then(responder)
      .catch((e) => responder({ erro: String(e?.message || e || 'falhou') }));
  });
  document.documentElement.dataset.lioncodeTimes = 'pronto';
})();
