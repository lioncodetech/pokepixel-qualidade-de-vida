// Ponte de leitura do Rampage. Entrar continua sendo um clique no botão visível do jogo.
(() => {
  'use strict';

  const PEDIDO = 'lioncode:rampage:pedido';
  const RESPOSTA = 'lioncode:rampage:resposta';
  let patrulha = 0;
  let passo = 0;

  const valor = (r) => r?.data ?? r;
  const estado = async () => {
    const api = globalThis.PokeIdle?.Api;
    if (typeof api?.getRampage !== 'function')
      return { erro: 'o jogo ainda não publicou o Rampage — espere a tela carregar' };
    try {
      const d = valor(await api.getRampage(true));
      if (!d || typeof d !== 'object') return { erro: 'o Rampage respondeu algo que não entendi' };
      const evento = d.event || {};
      return {
        ok: true,
        ativo: d.active === true,
        modo: String(d.mode || ''),
        evento: String(evento.id || d.event_id || ''),
        nome: String(evento.species_name || evento.name || 'Rampage'),
        nivel: Number(evento.boss_level) || 0,
        termina: Date.parse(evento.ends_at || d.ends_at) || 0,
        restantes: Math.max(0, Number(d.attempts_remaining) || 0),
        maximo: Math.max(0, Number(d.max_attempts) || 0),
        lutando: Boolean(d.active_attempt?.attempt_id),
        tentativa: String(d.active_attempt?.attempt_id || ''),
      };
    } catch (e) {
      return { erro: `não consegui ler o Rampage: ${String(e?.message || e)}` };
    }
  };

  const abrir = async () => {
    if (!globalThis.SceneManager || !globalThis.Scene_Rampage)
      return { erro: 'a tela do Rampage ainda não carregou' };
    const cena = globalThis.SceneManager._scene;
    if (!(cena instanceof globalThis.Scene_Rampage)) globalThis.SceneManager.push(globalThis.Scene_Rampage);
    return { ok: true };
  };

  const pararMovimento = () => {
    clearInterval(patrulha);
    patrulha = 0;
    return { ok: true };
  };

  const mover = async ({ ligado }) => {
    pararMovimento();
    if (!ligado) return { ok: true };
    const direcoes = [6, 2, 4, 8];
    patrulha = setInterval(() => {
      const arena = globalThis.PokeIdle?.RampageLiveArena;
      const jogador = globalThis.$gamePlayer;
      if (!arena?.active || arena.result || !jogador?.moveStraight) {
        if (!arena?.active || arena?.result) pararMovimento();
        return;
      }
      jogador.moveStraight(direcoes[passo++ % direcoes.length]);
    }, 850);
    return { ok: true };
  };

  const FAZ = { estado, abrir, mover };
  addEventListener(PEDIDO, (evento) => {
    const eco = evento?.detail?.eco;
    const acao = String(evento?.detail?.acao || '');
    const responder = (detalhe) =>
      dispatchEvent(new CustomEvent(RESPOSTA, { detail: { eco, ...detalhe } }));
    const faz = Object.hasOwn(FAZ, acao) ? FAZ[acao] : null;
    if (!faz) return responder({ erro: `não sei fazer "${acao}"` });
    Promise.resolve(faz(evento.detail || {})).then(responder).catch((e) =>
      responder({ erro: String(e?.message || e || 'falhou') }),
    );
  });
  addEventListener('pagehide', pararMovimento);
})();
