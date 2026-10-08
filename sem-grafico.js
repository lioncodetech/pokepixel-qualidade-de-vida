PPX.modulo({ id: 'sem-grafico', nome: 'Sem gráfico', atalhos: 'Alt+G desliga · Alt+H liga' }, () => {
  const CHAVE = 'pp-sem-grafico';
  let ativo = false;
  try {
    ativo = localStorage.getItem(CHAVE) === '1';
  } catch (e) {
    ativo = false;
  }

  const mapa = () =>
    window.SceneManager && window.SceneManager._scene
      ? window.SceneManager._scene._spriteset
      : null;

  /**
   * A cacada nao e' uma cena do motor: e' DOM. Os lutadores sao `span.platform-hunt__sprite`
   * com spritesheet em `background-position` e `animation: platform-hunt-walk .82s steps(2)
   * infinite`, e o fundo e' um `div.platform-hunt__backdrop` com um parallax que nunca para.
   * Esconder o `_spriteset` nao os alcanca — foi por isso que o Alt+G parecia nao funcionar
   * dentro de uma cacada.
   *
   * O corte foi medido numa maquina pequena em 08/10/2026: com tudo animado a CPU ociosa ficava
   * entre 9% e 18%; com este estilo, entre 28% e 71%.
   *
   * Tirar a animacao em vez de esconder o sprite e' deliberado: o `steps(2)` congela no quadro
   * em que esta', entao o pokemon continua na tela como imagem parada. Quem joga precisa ver se
   * morreu, o HP e a pokebola — e isso fica. O que sai e' o fundo, que e' a maior area de pixels
   * da tela e a unica coisa que se mexia sozinha o tempo todo.
   */
  const ID_ESTILO = 'ppx-sem-grafico';
  const CSS = [
    '.platform-hunt__backdrop{display:none!important}',
    '.platform-hunt__arena{background:#10141c!important}',
    '.platform-hunt__sprite,.platform-hunt__move,.platform-hunt__arena *',
    '{animation:none!important;animation-play-state:paused!important;transition:none!important}',
  ].join('');

  const corteDaCacada = (sim) => {
    const posto = document.getElementById(ID_ESTILO);
    if (!sim) {
      if (posto) posto.remove();
      return;
    }
    if (posto) return;
    const estilo = document.createElement('style');
    estilo.id = ID_ESTILO;
    estilo.textContent = CSS;
    (document.head || document.documentElement).appendChild(estilo);
  };

  // Cada cena nova (cidade, cacada) cria o seu proprio spriteset, entao a escolha
  // e reaplicada de tempos em tempos em vez de uma vez so. O estilo da cacada entra na mesma
  // ronda: o jogo troca de tela sem recarregar, e o `head` nem sempre e' o mesmo do arranque.
  const aplicar = () => {
    const sp = mapa();
    if (sp && ativo && sp.visible) sp.visible = false;
    corteDaCacada(ativo);
  };
  setInterval(aplicar, 500);

  const aviso = (texto) => {
    const caixa = document.createElement('div');
    caixa.textContent = texto;
    caixa.style.cssText =
      'position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:2147483647;' +
      'background:#11151dE0;color:#e6e9ef;font:13px system-ui,sans-serif;padding:8px 14px;' +
      // Um aviso que some em 1,4 s nao da' para apontar o mouse: a transparencia e' fixa.
      'opacity:.88;' +
      'border:1px solid #3a4152;border-radius:8px;pointer-events:none';
    document.body.appendChild(caixa);
    setTimeout(() => caixa.remove(), 1400);
  };

  // Dois atalhos vizinhos em vez de um que alterna: Alt+G desliga o grafico, Alt+H liga. Com um
  // atalho so' nao da' para saber em que estado se esta' sem apertar e ver, e apertar de novo
  // desfazia o que a pessoa acabou de pedir.
  addEventListener(
    'keydown',
    (e) => {
      if (!e.altKey || e.ctrlKey || e.shiftKey) return;
      const tecla = e.key.toLowerCase();
      if (tecla !== 'g' && tecla !== 'h') return;
      e.preventDefault();
      e.stopPropagation();
      ligar(tecla === 'g');
      aviso(ativo ? 'Grafico desligado (Alt+G)' : 'Grafico ligado (Alt+H)');
    },
    true,
  );

  /**
   * O menu do pacote mora no mundo isolado da extensao e nao alcanca este codigo por chamada de
   * funcao. O que os dois lados partilham e' o DOM: o menu manda um evento, e este responde com
   * outro, dizendo em que estado ficou.
   */
  function ligar(sim) {
    ativo = sim;
    try {
      localStorage.setItem(CHAVE, ativo ? '1' : '0');
    } catch (err) {
      /* janela sem armazenamento: vale so para esta sessao */
    }
    const sp = mapa();
    if (sp) sp.visible = !ativo;
    corteDaCacada(ativo);
    document.dispatchEvent(
      new CustomEvent('ppx-estado', {
        detail: JSON.stringify({ id: 'sem-grafico', visivel: ativo }),
      }),
    );
  }

  document.addEventListener('ppx-visivel', (e) => {
    try {
      const pedido = JSON.parse(e.detail);
      if (pedido.id === 'sem-grafico') ligar(pedido.mostrar);
    } catch (err) {
      /* recado malformado: nao e' motivo para derrubar a ferramenta */
    }
  });

  // Conta ao menu, na carga, em que estado a chave desta ferramenta ja' estava.
  document.dispatchEvent(
    new CustomEvent('ppx-estado', { detail: JSON.stringify({ id: 'sem-grafico', visivel: ativo }) }),
  );
});
