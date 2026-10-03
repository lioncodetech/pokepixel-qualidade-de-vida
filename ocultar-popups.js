// Ocultar popups do PokePixel: Alt+B esconde os popups de hover, Alt+N mostra de novo.
PPX.modulo({ id: 'ocultar-popups', nome: 'Ocultar popups', atalhos: 'Alt+B esconde · Alt+N mostra' }, () => {
  // ===== Configuração =====
  // Dois atalhos vizinhos, em vez de um que alterna: com um so' nao da' para saber em que estado
  // se esta' sem apertar e ver, e apertar de novo desfazia o que a pessoa acabou de pedir.
  const ATALHO_ESCONDER = 'Alt+B'; // exemplos: 'Alt+B', 'Ctrl+Shift+H', 'F8'
  const ATALHO_MOSTRAR = 'Alt+N';
  const ESCONDER_CARTAO_DO_JOGO = true; // cartão do Pokémon (HP, IVs, genética)
  const ESCONDER_ANALISE = true; // painel "Análise" da extensão de raridades
  const ESCONDER_ITENS = true; // popup dos itens da mochila (pedras, poções...)
  // ========================

  const CHAVE = 'lmi-ocultar-popups';
  const CLASSE = 'lmi-sem-popups';
  const seletores = [
    ...(ESCONDER_CARTAO_DO_JOGO ? ['.pokemon-tooltip-card', '.pokemon-card--hover'] : []),
    ...(ESCONDER_ANALISE ? ['#pp-rt-tip', '#pp-rt-gtip'] : []),
    ...(ESCONDER_ITENS ? ['.lmi-popup-item'] : []),
  ];

  // Só esconde: o jogo e a extensão de raridades continuam rodando por baixo.
  const estilo = document.createElement('style');
  estilo.textContent =
    seletores.map((s) => `html.${CLASSE} ${s}`).join(',\n') +
    ' { visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; }';
  (document.head || document.documentElement).appendChild(estilo);

  const ler = () => {
    try {
      return localStorage.getItem(CHAVE) === '1';
    } catch {
      return false;
    }
  };
  const gravar = (valor) => {
    try {
      localStorage.setItem(CHAVE, valor ? '1' : '0');
    } catch {
      /* sem armazenamento: vale só até recarregar */
    }
  };
  const aplicar = (ligado) => document.documentElement.classList.toggle(CLASSE, ligado);
  aplicar(ler());

  const combinacao = (atalho) => {
    const partes = atalho.split('+').map((p) => p.trim().toLowerCase());
    const tecla = partes.pop();
    const quer = (mod) => partes.includes(mod);
    return (e) =>
      e.altKey === quer('alt') &&
      e.ctrlKey === quer('ctrl') &&
      e.shiftKey === quer('shift') &&
      e.metaKey === quer('meta') &&
      (e.key.toLowerCase() === tecla ||
        e.code.toLowerCase() === `key${tecla}` ||
        e.code.toLowerCase() === `digit${tecla}`);
  };
  const bateEsconder = combinacao(ATALHO_ESCONDER);
  const bateMostrar = combinacao(ATALHO_MOSTRAR);

  let aviso;
  let timer;
  const avisar = (texto) => {
    if (!aviso) {
      aviso = document.createElement('div');
      aviso.style.cssText =
        'position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:2147483647;' +
        'padding:7px 14px;border-radius:8px;background:rgba(16,16,20,.88);color:#e6e6ea;' +
        'border:1px solid #d9b665;font:600 13px/1.3 system-ui,sans-serif;pointer-events:none;' +
        'transition:opacity .25s;';
      document.documentElement.appendChild(aviso);
    }
    aviso.textContent = texto;
    aviso.style.opacity = '.88';
    clearTimeout(timer);
    timer = setTimeout(() => (aviso.style.opacity = '0'), 1400);
  };

  window.addEventListener(
    'keydown',
    (e) => {
      if (e.repeat) return;
      const esconder = bateEsconder(e);
      if (!esconder && !bateMostrar(e)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      aplicar(esconder);
      gravar(esconder);
      if (esconder && ESCONDER_ITENS) varrer();
      avisar(
        esconder ? `Popups ocultos (${ATALHO_ESCONDER})` : `Popups visíveis (${ATALHO_MOSTRAR})`,
      );
    },
    true,
  );

  // O popup de itens não tem nome conhecido: é reconhecido pelo texto que só ele tem, e a caixa
  // que o contém ganha a classe .lmi-popup-item. Menus não têm esse texto e ficam.
  const MARCAS = ['Venda ao NPC', 'Bloquear item', 'Desbloquear item', 'Sell to NPC', 'Lock item'];
  // A caixa do popup é a maior que ainda cabe nesse tamanho. Acima dela vem a mochila ou a
  // camada da tela inteira, que não podem sumir.
  const LARGURA_MAX = 560;
  const ALTURA_MAX = 700;
  // Espaço especial (nbsp) e quebras viram espaço simples antes de comparar.
  const temMarca = (texto) => {
    if (!texto) return false;
    const t = texto.replace(/\s+/g, ' ');
    return MARCAS.some((m) => t.includes(m));
  };
  const cabe = (r) => r.width <= LARGURA_MAX && r.height <= ALTURA_MAX;
  // Popup que vaza para fora do elemento de cima flutua sobre ele (por exemplo, preso ao slot do
  // item): subir mais esconderia o slot junto. Elemento sem tamanho (ainda oculto) não decide.
  const dentro = (filho, pai) =>
    (filho.width === 0 && filho.height === 0) ||
    (filho.left >= pai.left - 2 &&
      filho.top >= pai.top - 2 &&
      filho.right <= pai.right + 2 &&
      filho.bottom <= pai.bottom + 2);
  // Refaz a escolha a cada vez: um popup que existia escondido (tamanho zero) só mostra o tamanho
  // real quando aparece, e aí a caixa certa pode ser maior que a marcada antes.
  const marcar = (el) => {
    let caixa = null;
    let anterior = null;
    for (let atual = el; atual && atual !== document.body; atual = atual.parentElement) {
      const r = atual.getBoundingClientRect();
      if (!cabe(r) || (anterior && !dentro(anterior, r))) break;
      caixa = atual;
      anterior = r;
    }
    if (!caixa || caixa.classList.contains('lmi-popup-item')) return;
    // Dentro de shadow root o estilo da página não alcança: leva uma cópia para lá.
    const raiz = caixa.getRootNode();
    if (raiz instanceof ShadowRoot && !raiz.querySelector('style[data-lmi]')) {
      const copia = document.createElement('style');
      copia.dataset.lmi = '1';
      copia.textContent =
        `:host-context(html.${CLASSE}) .lmi-popup-item` +
        ' { visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; }';
      raiz.appendChild(copia);
    }
    for (const antiga of caixa.querySelectorAll('.lmi-popup-item')) antiga.classList.remove('lmi-popup-item');
    caixa.classList.add('lmi-popup-item');
  };
  const folhaComMarca = (raiz) =>
    [...raiz.querySelectorAll('*')].find((e) => e.children.length === 0 && temMarca(e.textContent));
  // Varredura da página inteira: pega o popup mesmo que ele já existisse antes de ser mostrado.
  const varrer = () => {
    for (const raiz of raizes()) {
      const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) if (temMarca(n.data)) marcar(n.parentElement);
    }
  };
  // A página e as áreas isoladas (shadow roots abertos) que houver nela.
  const raizes = () => {
    const lista = [document];
    for (let i = 0; i < lista.length; i++)
      for (const el of lista[i].querySelectorAll('*')) if (el.shadowRoot) lista.push(el.shadowRoot);
    return lista;
  };
  if (ESCONDER_ITENS) {
    new MutationObserver((registros) => {
      for (const r of registros) {
        if (r.type === 'characterData') {
          if (temMarca(r.target.data)) marcar(r.target.parentElement);
          continue;
        }
        for (const no of r.addedNodes) {
          if (!temMarca(no.textContent)) continue;
          if (no.nodeType === 1) marcar(folhaComMarca(no) || no);
          else marcar(no.parentElement);
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    // Reforço: com o bloqueio ligado, varre ao mexer o mouse (no máximo a cada 200 ms).
    let ultima = 0;
    window.addEventListener(
      'mousemove',
      () => {
        if (!document.documentElement.classList.contains(CLASSE)) return;
        const agora = Date.now();
        if (agora - ultima < 200) return;
        ultima = agora;
        varrer();
        setTimeout(varrer, 250); // popup que aparece com atraso depois do hover
      },
      true,
    );
  }

  // ===== Diagnóstico: Alt+Shift+B com o mouse sobre um item mostra como o popup é montado =====
  let mouseX = 0;
  let mouseY = 0;
  window.addEventListener(
    'mousemove',
    (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    },
    true,
  );
  const descrever = (el) => {
    if (!el || el.nodeType !== 1) return String(el);
    const r = el.getBoundingClientRect();
    const cls = [...el.classList].filter((c) => !c.startsWith('lmi-')).slice(0, 3).join('.');
    const pos = getComputedStyle(el).position;
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls ? '.' + cls : ''} [${pos} ${Math.round(r.width)}x${Math.round(r.height)}]${el.classList.contains('lmi-popup-item') ? ' MARCADO' : ''}`;
  };
  const diagnosticar = () => {
    const linhas = [];
    const todas = raizes();
    linhas.push(`iframes: ${document.querySelectorAll('iframe').length} · shadow roots: ${todas.length - 1}`);
    let achou = 0;
    for (const raiz of todas) {
      const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (!temMarca(n.data) || achou >= 2) continue;
        achou++;
        linhas.push(`texto "${n.data.trim().slice(0, 30)}"${raiz === document ? '' : ' (dentro de shadow root)'}:`);
        let el = n.parentElement;
        for (let i = 0; el && i < 9; i++, el = el.parentElement) linhas.push('  ' + descrever(el));
      }
    }
    if (!achou) linhas.push('texto "Venda ao NPC" / "Bloquear item": NÃO encontrado na página');
    linhas.push('sob o mouse:');
    for (const el of document.elementsFromPoint(mouseX, mouseY).slice(0, 6)) linhas.push('  ' + descrever(el));
    const caixa = document.createElement('pre');
    caixa.textContent = linhas.join('\n');
    caixa.style.cssText =
      'position:fixed;left:8px;bottom:8px;z-index:2147483647;max-width:70vw;max-height:60vh;overflow:auto;' +
      'margin:0;padding:10px;background:#0b0b0f;color:#9ef0a5;border:1px solid #d9b665;border-radius:6px;' +
      'font:12px/1.4 Consolas,monospace;white-space:pre-wrap;user-select:text;' +
      'opacity:.82;transition:opacity .15s;';
    // O relatorio e' para ler: fica nitido com o mouse em cima, como os paineis das outras.
    caixa.addEventListener('pointerenter', () => (caixa.style.opacity = '1'));
    caixa.addEventListener('pointerleave', () => (caixa.style.opacity = '.82'));
    caixa.title = 'clique para fechar';
    caixa.addEventListener('click', () => caixa.remove());
    document.documentElement.appendChild(caixa);
  };
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.repeat || !e.altKey || !e.shiftKey || e.ctrlKey || e.code !== 'KeyB') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      diagnosticar();
    },
    true,
  );

  // Outra aba/janela do mesmo site mudou: acompanha.
  window.addEventListener('storage', (e) => {
    if (e.key === CHAVE) aplicar(e.newValue === '1');
  });
});