// PokePixel - qualidade de vida: o menu que liga e desliga as ferramentas.
//
// Cada ferramenta continua sendo o seu proprio arquivo, avaliado pelo navegador por conta propria.
// Isso e' de proposito: um erro dentro de uma nao impede as outras de carregar, que era a maior
// perda ao juntar cinco extensoes separadas numa so'.
//
// Este arquivo vem antes de todos no manifest e so' publica `PPX`; quem monta a interface e' o
// `setTimeout(0)` la' embaixo, depois de todos os modulos terem se registrado.

(() => {
  'use strict';

  const CHAVE_LIGADOS = 'lioncode:pokepixel:modulos';
  const CHAVE_POS = 'lioncode:pokepixel:menu-pos';
  const CHAVE_ABERTO = 'lioncode:pokepixel:menu-aberto';

  const ler = (chave, padrao) => {
    try {
      return JSON.parse(localStorage.getItem(chave)) ?? padrao;
    } catch {
      return padrao;
    }
  };
  const gravar = (chave, valor) => {
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
    } catch {
      /* modo anonimo, ou armazenamento cheio: continua funcionando, so' nao lembra. */
    }
  };

  /**
   * As ferramentas que este pacote tem, com nome e atalho, independentemente de terem conseguido
   * se registrar.
   *
   * "Sem grafico" roda no mundo da propria pagina (`world: MAIN` no manifest), porque precisa
   * alcancar o desenho do jogo. De la' ela nao enxerga este `globalThis`, so' o `localStorage`,
   * que os dois mundos partilham. Por isso ela entra no menu por esta lista, e nao pelo registro:
   * sem ela aqui, a unica ferramenta que nao daria para desligar seria justamente a que mais pesa.
   */
  const CATALOGO = [
    { id: 'ocultar-popups', nome: 'Ocultar popups', atalhos: 'Alt+B esconde · Alt+N mostra' },
    { id: 'sem-grafico', nome: 'Sem gráfico', atalhos: 'Alt+G desliga · Alt+H liga', externo: true },
    { id: 'senha', nome: 'Senha', atalhos: 'botões na tela de login' },
    { id: 'loja-rapida', nome: 'Loja rápida', atalhos: 'Alt+C esconde · Alt+V mostra' },
    { id: 'venda-rapida', nome: 'Venda rápida', atalhos: 'Alt+D esconde · Alt+F mostra' },
  ];
  const modulos = CATALOGO.map((f) => ({ ...f, iniciar: null, vivo: false, erro: '' }));
  let montado = false;
  let relogio = 0;

  // Quem nunca escolheu nada fica com tudo ligado: trocar as cinco avulsas por este pacote nao
  // pode fazer a pessoa perder ferramenta nenhuma sem ter pedido.
  const escolhas = () => ler(CHAVE_LIGADOS, {});
  const ligado = (id) => escolhas()[id] !== false;

  globalThis.PPX = {
    /**
     * Registra uma ferramenta. `iniciar` so' roda se ela estiver ligada nesta janela, e roda uma
     * vez so': os modulos foram escritos para montar na carga da pagina, nao para ir e voltar.
     */
    modulo(info, iniciar) {
      const m = modulos.find((x) => x.id === info.id);
      if (!m) return;
      m.iniciar = iniciar;
      agendarMontagem();
    },
  };

  const iniciarModulo = (m) => {
    if (m.vivo || m.erro || !m.iniciar) return;
    try {
      m.iniciar();
      m.vivo = true;
    } catch (e) {
      // Uma ferramenta que estourou nao pode levar as outras junto, nem sumir sem explicacao: o
      // menu passa a mostrar o erro ao lado do nome dela.
      m.erro = String((e && e.message) || e).slice(0, 80);
    }
  };

  const raiz = document.createElement('div');
  for (const [prop, valor] of [
    ['all', 'initial'],
    ['position', 'fixed'],
    ['z-index', '2147483646'],
    ['font', '13px system-ui, sans-serif'],
    ['color', '#e6e9ef'],
    ['visibility', 'visible'],
  ])
    raiz.style.setProperty(prop, valor, 'important');
  const sombra = raiz.attachShadow({ mode: 'open' });
  const estilo = document.createElement('style');
  estilo.textContent = `
    * { box-sizing: border-box; }
    .menu, .aba {
      position: fixed; right: 14px; bottom: 56px;
      background: #1d2433; color: #e6e9ef; border: 1px solid #3a4152; border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
      opacity: .82; transition: opacity .15s;
    }
    .menu:hover, .menu:focus-within, .aba:hover, .aba:focus { opacity: 1; }
    .menu { display: none; flex-direction: column; min-width: 232px; }
    .menu.aberto { display: flex; }
    .cabeca {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 8px; border-bottom: 1px solid #3a4152; user-select: none;
    }
    .alca { color: #8b93a5; font-size: 15px; cursor: move; touch-action: none; }
    .titulo { flex: 1; color: #8b93a5; }
    .fechar {
      background: none; border: 0; color: #8b93a5; cursor: pointer; font: inherit;
      padding: 0 4px; border-radius: 6px;
    }
    .fechar:hover { color: #e6e9ef; background: #2a3243; }
    ul { list-style: none; margin: 0; padding: 4px; }
    li { display: flex; align-items: center; gap: 8px; padding: 5px 6px; border-radius: 7px; }
    li:hover { background: #222a39; }
    .nome { flex: 1; }
    .nome small { display: block; color: #6f7789; }
    .nome .erro { color: #f0a9a9; }
    .chave {
      flex: none; width: 34px; height: 18px; border-radius: 10px; border: 1px solid #3a4152;
      background: #11151d; cursor: pointer; padding: 0; position: relative;
    }
    .chave span {
      position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%;
      background: #6f7789; transition: left .15s, background .15s;
    }
    .chave[aria-checked="true"] { background: #1e3326; border-color: #3a5a3f; }
    .chave[aria-checked="true"] span { left: 18px; background: #9ae6a8; }
    .rodape { padding: 6px 10px; border-top: 1px solid #3a4152; color: #6f7789; }
    .rodape button {
      background: #2a3243; border: 1px solid #3a4152; color: #e6e9ef; border-radius: 7px;
      padding: 3px 8px; cursor: pointer; font: inherit; margin-left: 6px;
    }
    .aba {
      display: none; align-items: center; gap: 6px; padding: 7px 11px; cursor: pointer;
      border: 1px solid #3a4152; font: inherit; color: #e6e9ef;
    }
    .aba.aberta { display: inline-flex; }
    .aba:hover { background: #2a3243; }
  `;

  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.innerHTML = `
    <div class="cabeca">
      <span class="alca" title="Arraste daqui para mover">⠿</span>
      <span class="titulo">PokePixel</span>
      <button class="fechar" title="Fechar o menu (Alt+Q)">—</button>
    </div>
    <ul></ul>
    <div class="rodape"></div>`;
  const lista = menu.querySelector('ul');
  const rodape = menu.querySelector('.rodape');

  const aba = document.createElement('button');
  aba.className = 'aba';
  aba.textContent = 'PokePixel';
  aba.title = 'Abrir o menu das ferramentas (Alt+Q)';

  let aberto = ler(CHAVE_ABERTO, false) === true;
  const pintar = () => {
    menu.classList.toggle('aberto', aberto);
    aba.classList.toggle('aberta', !aberto);
  };
  const abrir = (sim) => {
    aberto = sim;
    pintar();
    gravar(CHAVE_ABERTO, sim);
  };
  aba.onclick = () => abrir(true);
  menu.querySelector('.fechar').onclick = () => abrir(false);

  function desenhar() {
    lista.textContent = '';
    for (const m of modulos) {
      const li = document.createElement('li');
      const nome = document.createElement('span');
      nome.className = 'nome';
      nome.textContent = m.nome;
      const sub = document.createElement('small');
      sub.textContent = m.erro ? `erro: ${m.erro}` : m.atalhos || '';
      if (m.erro) sub.className = 'erro';
      nome.appendChild(sub);
      const chave = document.createElement('button');
      chave.className = 'chave';
      chave.setAttribute('role', 'switch');
      chave.setAttribute('aria-checked', String(ligado(m.id)));
      chave.title = ligado(m.id) ? 'Desligar nesta janela' : 'Ligar nesta janela';
      chave.appendChild(document.createElement('span'));
      chave.onclick = () => alternar(m);
      li.append(nome, chave);
      lista.appendChild(li);
    }
  }

  /**
   * Ligar vale na hora; desligar so' na proxima carga.
   *
   * As ferramentas montam a interface, prendem atalhos e deixam relogios rodando. Desfazer tudo
   * isso em ordem seria uma segunda implementacao de cada uma, so' para o botao desligar — e e'
   * exatamente onde nasceriam os bugs. Recarregar a pagina faz isso de graca e sem engano.
   */
  function alternar(m) {
    const atual = escolhas();
    const novo = !ligado(m.id);
    atual[m.id] = novo;
    gravar(CHAVE_LIGADOS, atual);
    if (novo) iniciarModulo(m);
    desenhar();
    rodape.textContent = novo ? '' : 'Desligada a partir da próxima carga da página.';
    if (!novo) {
      const botao = document.createElement('button');
      botao.textContent = 'recarregar agora';
      botao.onclick = () => location.reload();
      rodape.appendChild(botao);
    }
  }

  const dentro = (el, x, y) => {
    const r = el.getBoundingClientRect();
    el.style.left = `${Math.max(0, Math.min(x, innerWidth - r.width))}px`;
    el.style.top = `${Math.max(0, Math.min(y, innerHeight - r.height))}px`;
    el.style.right = 'auto';
    el.style.bottom = 'auto';
  };
  let pos = ler(CHAVE_POS, null);
  const colocar = () => {
    if (!pos) return;
    dentro(menu, pos.x, pos.y);
    dentro(aba, pos.x, pos.y);
  };

  const alca = menu.querySelector('.alca');
  let dx = 0;
  let dy = 0;
  let arrastando = false;
  alca.addEventListener('pointerdown', (e) => {
    const r = menu.getBoundingClientRect();
    dx = e.clientX - r.left;
    dy = e.clientY - r.top;
    arrastando = true;
    alca.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  alca.addEventListener('pointermove', (e) => {
    if (arrastando) dentro(menu, e.clientX - dx, e.clientY - dy);
  });
  const soltar = (e) => {
    if (!arrastando) return;
    arrastando = false;
    try {
      alca.releasePointerCapture(e.pointerId);
    } catch {
      /* ponteiro ja solto */
    }
    pos = { x: parseFloat(menu.style.left), y: parseFloat(menu.style.top) };
    gravar(CHAVE_POS, pos);
    colocar();
  };
  alca.addEventListener('pointerup', soltar);
  alca.addEventListener('pointercancel', soltar);

  // Rearranjar as views muda o tamanho da janela; sem isto o menu ficaria pendurado para fora.
  let ajuste = 0;
  addEventListener('resize', () => {
    clearTimeout(ajuste);
    ajuste = setTimeout(colocar, 150);
  });

  // Alt+Q abre e fecha o menu. O atalho para aqui: deixar passar dispararia tambem o que o jogo
  // tiver em Alt.
  addEventListener(
    'keydown',
    (e) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.code !== 'KeyQ') return;
      e.preventDefault();
      e.stopPropagation();
      abrir(!aberto);
    },
    true,
  );

  /**
   * Monta quando o DOM existir e os registros pararem de chegar.
   *
   * Os arquivos nao entram todos ao mesmo tempo: "ocultar popups" vem em `document_start`, junto
   * com este, e os outros em `document_idle`, bem depois. Um `setTimeout(0)` montaria o menu antes
   * de metade das ferramentas existir, e elas ficariam de fora da lista.
   */
  function montar() {
    if (montado) return;
    montado = true;
    for (const m of modulos) if (ligado(m.id)) iniciarModulo(m);
    sombra.append(estilo, menu, aba);
    document.body.appendChild(raiz);
    desenhar();
    pintar();
    colocar();
  }

  function agendarMontagem() {
    if (montado) {
      // Registro atrasado: entra agora, para nao ficar fora do menu nem deixar de iniciar.
      for (const m of modulos) if (ligado(m.id)) iniciarModulo(m);
      desenhar();
      return;
    }
    if (!document.body) {
      addEventListener('DOMContentLoaded', agendarMontagem, { once: true });
      return;
    }
    clearTimeout(relogio);
    relogio = setTimeout(montar, 200);
  }

  // Sem nenhuma ferramenta registrada — todas desligadas, ou todas com erro — o menu ainda precisa
  // aparecer: e' por ele que se liga qualquer uma de volta.
  if (document.body) agendarMontagem();
  else addEventListener('DOMContentLoaded', agendarMontagem, { once: true });
})();
