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

  // Cada cena nova (cidade, cacada) cria o seu proprio spriteset, entao a escolha
  // e reaplicada de tempos em tempos em vez de uma vez so.
  const aplicar = () => {
    const sp = mapa();
    if (sp && ativo && sp.visible) sp.visible = false;
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
      ativo = tecla === 'g';
      try {
        localStorage.setItem(CHAVE, ativo ? '1' : '0');
      } catch (err) {
        /* janela sem armazenamento: vale so para esta sessao */
      }
      const sp = mapa();
      if (sp) sp.visible = !ativo;
      aviso(ativo ? 'Grafico do mapa desligado (Alt+G)' : 'Grafico do mapa ligado (Alt+H)');
    },
    true,
  );
});
