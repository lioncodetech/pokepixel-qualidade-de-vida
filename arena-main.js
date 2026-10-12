// A ponte da Arena de Defesa, no mundo da pagina: **so' le' o estado**, e nao ataca nem atualiza.
//
// POR QUE SO' LE'. O que a arena custa esta' tudo do lado de agir: cada ataque gasta uma das cinco
// tentativas do dia, e atualizar a lista de rivais e' de graça so' tres vezes — a quarta custa
// diamante. O dono foi explicito: **nunca comprar entrada nem atualizacao com cristal**. Uma ponte
// que soubesse `attackPvPDefense` punha a acao mais cara do jogo a um `CustomEvent` de distancia de
// qualquer engano. Ela fica de fora: quem ataca e' o clique no botao "Atacar" que o dono clicaria,
// em `arena.js`. Ler o estado nao gasta nada.
//
// MEDIDO NA CONTA REAL (12/10/2026), em `Api.getPvPDefenseState()`:
//
//   attempts          limit 5 · remaining · used · resets_at (meia-noite de Brasilia)
//                     extra_limit 5 · extra_diamonds 25   <- as entradas compradas. Nao se tocam.
//   opponents[]       trainer_id · name · points · power · win_points · loss_points · used
//   opponent_refresh  payment "free" · free_limit 3 · free_remaining · cost_diamonds 0
//   season            id 1 · name "Temporada 1" · ends_at 2026-10-25 · reset_mode "hard"
//   rules.battle      countdown_seconds 30 · battle_timeout_seconds 210
//
// TRES COISAS QUE MUDAM O DESENHO DA FERRAMENTA:
//
// 1. **`used` e' do jogo, e nao uma contagem daqui.** Um rival ja' atacado hoje volta na lista com
//    `used: true` (e o cartao ganha `.is-used`, com o botao desativado). Guardar "quem eu ja'
//    ataquei" deste lado seria uma segunda verdade sobre a mesma coisa — e ela diverge no primeiro
//    F5, ou quando o dono ataca a' mao.
//
// 2. **`payment` e' a licenca para atualizar.** Enquanto ele diz `"free"` e sobra `free_remaining`,
//    a atualizacao e' de graça. Assim que vira outra coisa, a ferramenta para — nao ha' confirmacao
//    nenhuma a clicar, e e' por isso que a decisao se le' antes do clique e nao depois.
//
// 3. **`season.id` e' o relogio da lista de barrados.** Quem venceu o dono fica de fora ate' a
//    temporada virar; a temporada e' `reset_mode: "hard"`, entao virar e' recomeçar de verdade.
//
// O QUE ELE NAO FAZ, E DE PROPOSITO: `attackPvPDefense`, `refreshPvPDefenseOpponents`,
// `savePvPDefenseAttackPreset` e `savePvPDefenseFormation` existem, estao ao lado destas, e ficam
// de fora. Agir e' pelo caminho que o dono ve' na tela.

(() => {
  'use strict';

  const PEDIDO = 'lioncode:arena:pedido';
  const RESPOSTA = 'lioncode:arena:resposta';

  /**
   * O estado da arena, cortado ao que esta ferramenta decide.
   *
   * O registro inteiro traz a equipe de cada rival com os quatro golpes de cada Pokemon — sao
   * dezenas de campos por rival, para serem descartados do outro lado. Atravessa o que decide:
   * quem e', quanto vale, se ja' foi atacado.
   */
  const estado = async () => {
    const api = globalThis.PokeIdle?.Api;
    if (typeof api?.getPvPDefenseState !== 'function')
      return { erro: 'o jogo ainda não publicou a API — espere a tela carregar' };
    let r = null;
    try {
      r = await api.getPvPDefenseState();
    } catch (e) {
      return { erro: `não consegui ler a arena: ${String(e?.message || e)}` };
    }
    const d = r?.data ?? r;
    if (!d || typeof d !== 'object') return { erro: 'a arena respondeu uma coisa que não entendi' };
    const a = d.attempts || {};
    const at = d.opponent_refresh || {};
    const batalha = d.rules?.battle || {};
    return {
      ok: true,
      ligada: d.enabled !== false,
      tentativas: {
        restantes: Number(a.remaining) || 0,
        feitas: Number(a.used) || 0,
        limite: Number(a.limit) || 0,
        // Quando o dia da arena vira. E' o prazo de uma rodada adiada pela expedição — ver
        // `devendo`, em `arena.js`. Atravessa em milissegundos porque do outro lado e' com
        // `Date.now()` que ele se compara, e nao com uma string.
        reinicia: Date.parse(a.resets_at) || 0,
      },
      // De graça ou nada: `cost_diamonds` atravessa so' para o painel poder dizer o preço que
      // **nao** vai pagar.
      atualizacao: {
        gratis: at.payment === 'free' && Number(at.free_remaining) > 0,
        restantes: Number(at.free_remaining) || 0,
        limite: Number(at.free_limit) || 0,
        pagamento: String(at.payment || ''),
        diamantes: Number(at.cost_diamonds) || 0,
      },
      temporada: { id: Number(d.season?.id) || 0, nome: String(d.season?.name || '') },
      pontos: Number(d.profile?.points) || 0,
      espera: {
        contagem: Number(batalha.countdown_seconds) || 0,
        limite: Number(batalha.battle_timeout_seconds) || 0,
      },
      oponentes: (Array.isArray(d.opponents) ? d.opponents : []).map((o) => ({
        id: String(o?.trainer_id || ''),
        nome: String(o?.name || ''),
        pontos: Number(o?.points) || 0,
        poder: Number(o?.power) || 0,
        ganha: Number(o?.win_points) || 0,
        perde: Number(o?.loss_points) || 0,
        usado: o?.used === true,
      })),
    };
  };

  const FAZ = { estado };

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
