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
  const CHAVE_VISIVEIS = 'lioncode:pokepixel:visiveis';

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
    // `efeito` troca o verbo do botao do meio: numa janela ele mostra e esconde, nestas duas ele
    // liga e desliga o que a ferramenta faz com a pagina, que e' tudo o que elas tem.
    {
      id: 'ocultar-popups',
      nome: 'Ocultar popups',
      atalhos: 'Alt+B esconde · Alt+N mostra',
      efeito: true,
      proprio: true,
    },
    {
      id: 'sem-grafico',
      nome: 'Sem gráfico',
      atalhos: 'Alt+G desliga · Alt+H liga',
      efeito: true,
      externo: true,
      proprio: true,
    },
    { id: 'senha', nome: 'Senha', atalhos: 'botões na tela de login' },
    { id: 'loja-rapida', nome: 'Loja rápida', atalhos: 'Alt+C esconde · Alt+V mostra' },
    { id: 'venda-rapida', nome: 'Venda rápida', atalhos: 'Alt+D esconde · Alt+F mostra' },
    {
      id: 'layout-padrao',
      nome: 'Layout padrão',
      atalhos: 'Alt+J esconde · Alt+K mostra · Alt+L arruma',
    },
    { id: 'times', nome: 'Times', atalhos: 'Alt+T esconde · Alt+Y mostra' },
    { id: 'gym', nome: 'Ginásio do dia', atalhos: 'Alt+G esconde · Alt+H mostra' },
    { id: 'cacadas', nome: 'Caçadas', atalhos: 'Alt+R esconde · Alt+E mostra' },
    { id: 'raridades', nome: 'Raridades', atalhos: 'Alt+A esconde · Alt+S mostra' },
  ];
  const modulos = CATALOGO.map((f) => ({ ...f, iniciar: null, vivo: false, erro: '' }));
  let montado = false;
  let relogio = 0;

  // Quem nunca escolheu nada fica com tudo ligado: trocar as cinco avulsas por este pacote nao
  // pode fazer a pessoa perder ferramenta nenhuma sem ter pedido.
  const escolhas = () => ler(CHAVE_LIGADOS, {});
  const ligado = (id) => escolhas()[id] !== false;

  /**
   * Mostrar e esconder atravessa o F5.
   *
   * Uma janela que a pessoa mandou sumir tem de continuar sumida na proxima carga: e' o que ela
   * pediu, e nao um estado de tela. Cada ferramenta le isto ao montar e obedece sem piscar.
   */
  const visiveis = () => ler(CHAVE_VISIVEIS, {});
  /**
   * Duas ferramentas ja' guardavam o seu estado antes deste menu existir, cada uma na sua chave, e
   * os atalhos delas continuam gravando la'. Para o menu nao virar uma segunda verdade que
   * discorda da primeira, dessas ele so' reflete o que elas informam (`proprio`).
   */
  const estaVisivel = (id) => {
    const m = modulos.find((x) => x.id === id);
    if (m && m.proprio) return m.estado === true;
    return visiveis()[id] !== false;
  };
  /** Enquanto a ferramenta nao se anuncia, o menu nao tem o que dizer sobre ela. */
  const sabido = (m) => !m.proprio || m.estado !== undefined;

  /**
   * Posicao de janelinha flutuante que sobrevive a mudar o tamanho da janela.
   *
   * Pixels contados do canto de cima a esquerda nao sobrevivem: encolher a janela — rearranjar as
   * views do LionMultInstance faz isso o tempo todo — joga a peca para fora, e o recorte que a traz
   * de volta e' definitivo, entao crescer de novo nao a devolve ao canto onde ela estava. Pior: num
   * quadrante baixo, uma peca guardada a 430px do topo simplesmente nao aparece.
   *
   * Por isso o que fica guardado e' a distancia ate' a borda mais proxima de cada eixo, e a posicao
   * e' recontada a cada tamanho de tela. Quem estava no canto de baixo a direita fica no canto de
   * baixo a direita, em qualquer quadrante, e voltar ao tamanho grande devolve tudo ao lugar.
   */
  const canto = {
    /** Le a posicao atual do elemento como distancia ate' as bordas mais proximas. */
    medir(el) {
      const c = el.getBoundingClientRect();
      const direita = c.left + c.width / 2 > innerWidth / 2;
      const baixo = c.top + c.height / 2 > innerHeight / 2;
      return {
        x: Math.round(direita ? innerWidth - c.right : c.left),
        y: Math.round(baixo ? innerHeight - c.bottom : c.top),
        direita,
        baixo,
      };
    },

    /**
     * Escreve `left`/`top` a partir do canto guardado, sempre dentro da tela.
     *
     * Devolve `false` quando nao havia o que aplicar: sem posicao guardada, ou com a peca
     * escondida — escondida ela nao tem caixa, e posicionar pelo zero a mandaria para o canto
     * errado. Quem chama reaplica quando ela volta a aparecer.
     */
    aplicar(el, guardado) {
      const pos = canto.doGuardado(guardado);
      if (!pos) return false;
      const c = el.getBoundingClientRect();
      if (!c.width && !c.height) return false;
      const x = pos.direita ? innerWidth - pos.x - c.width : pos.x;
      const y = pos.baixo ? innerHeight - pos.y - c.height : pos.y;
      const limite = (v, folga) => Math.max(0, Math.min(Math.max(0, folga), Math.round(v)));
      el.style.left = `${limite(x, innerWidth - c.width)}px`;
      el.style.top = `${limite(y, innerHeight - c.height)}px`;
      el.style.right = 'auto';
      el.style.bottom = 'auto';
      return true;
    },

    /** Aceita o formato antigo, em pixels do canto de cima a esquerda, gravado antes desta versao. */
    doGuardado(v) {
      if (!v) return null;
      if (typeof v.direita === 'boolean') return v;
      const x = parseFloat(v.x ?? v.left);
      const y = parseFloat(v.y ?? v.top);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return { x, y, direita: false, baixo: false };
    },
  };

  globalThis.PPX = {
    /** O canto guardado, partilhado por todas as janelinhas do pacote. */
    canto,

    /** A ferramenta entrega aqui como se mostra e se esconde; o menu passa a comandar isso. */
    controlar(id, aplicar) {
      const m = modulos.find((x) => x.id === id);
      if (!m) return;
      m.aplicar = aplicar;
      desenhar();
    },

    /** O que ficou gravado da ultima vez, para a ferramenta ja' montar do jeito certo. */
    visivel: estaVisivel,

    /** A ferramenta avisa que mudou sozinha — por atalho, ou porque leu a propria chave. */
    anotar(id, valor) {
      const m = modulos.find((x) => x.id === id);
      if (!m) return;
      m.estado = valor !== false;
      // O atalho da ferramenta vale tanto quanto o botao do menu: tambem tem de atravessar o F5.
      if (!m.proprio) {
        const atual = visiveis();
        atual[id] = m.estado;
        gravar(CHAVE_VISIVEIS, atual);
      }
      if (montado) desenhar();
    },

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
    .titulo { flex: 1; color: #e6e9ef; line-height: 1.1; }
    .titulo small { display: block; color: #6f7789; font-size: 11px; }
    .legenda {
      padding: 4px 10px 0; color: #6f7789; font-size: 11px; line-height: 1.35;
      border-top: 1px solid #2a3243; margin-top: 2px;
    }
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
    .olho {
      flex: none; background: #2a3243; border: 1px solid #3a4152; color: #c3c9d6;
      border-radius: 7px; padding: 2px 7px; cursor: pointer; font: inherit; font-size: 11px;
      min-width: 62px;
    }
    .olho:hover:not(:disabled) { background: #333d52; color: #e6e9ef; }
    .olho.apagado { color: #6f7789; background: #1a2030; }
    .olho:disabled { opacity: .45; cursor: default; }
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
      <span class="titulo">PokePixel<small>qualidade de vida</small></span>
      <button class="fechar" title="Fechar o menu (Alt+Q)">—</button>
    </div>
    <ul></ul>
    <div class="legenda">
      O botão do meio mostra, esconde ou liga o efeito — e fica assim no próximo F5.
      A chave verde ativa ou desativa a ferramenta inteira nesta janela.
    </div>
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
    // Quem acabou de aparecer so' agora tem medidas: e' aqui que ele vai para o canto guardado.
    if (montado) colocar();
  };
  const abrir = (sim) => {
    aberto = sim;
    pintar();
    gravar(CHAVE_ABERTO, sim);
  };
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

      // Dois comandos por ferramenta, e eles nao sao a mesma coisa: o do meio mostra e esconde
      // (ou liga e desliga o efeito) sem tirar a ferramenta do ar; a chave desinstala da janela.
      const olho = document.createElement('button');
      olho.className = 'olho';
      const vendo = estaVisivel(m.id);
      const conhecido = sabido(m);
      olho.textContent = !conhecido
        ? '—'
        : m.efeito
          ? vendo
            ? 'ligado'
            : 'desligado'
          : vendo
            ? 'à vista'
            : 'oculta';
      olho.classList.toggle('apagado', !vendo);
      // Sem a ferramenta no ar nao ha' o que mostrar nem o que esconder: o botao fica apagado em
      // vez de prometer uma acao que nao aconteceria.
      olho.disabled = !ligado(m.id) || !!m.erro || !conhecido || (!m.aplicar && !m.externo);
      olho.title = m.efeito
        ? 'Liga e desliga o efeito nesta janela'
        : 'Mostra e esconde a janela desta ferramenta';
      olho.onclick = () => alternarVisivel(m);

      const chave = document.createElement('button');
      chave.className = 'chave';
      chave.setAttribute('role', 'switch');
      chave.setAttribute('aria-checked', String(ligado(m.id)));
      chave.title = ligado(m.id)
        ? 'Desativar a ferramenta nesta janela'
        : 'Ativar a ferramenta nesta janela';
      chave.appendChild(document.createElement('span'));
      chave.onclick = () => alternar(m);

      li.append(nome, olho, chave);
      lista.appendChild(li);
    }
  }

  /**
   * Mostra ou esconde, e grava.
   *
   * A ferramenta que roda no mundo da pagina nao e' alcancavel daqui por chamada de funcao: o
   * recado vai por um evento no DOM, que os dois mundos partilham.
   */
  function alternarVisivel(m) {
    const mostrar = !estaVisivel(m.id);
    if (m.proprio) {
      // Quem guarda e' a propria ferramenta, na chave dela; aqui so' se manda aplicar.
      m.estado = mostrar;
    } else {
      const atual = visiveis();
      atual[m.id] = mostrar;
      gravar(CHAVE_VISIVEIS, atual);
    }
    if (m.aplicar) {
      try {
        m.aplicar(mostrar);
      } catch (e) {
        m.erro = String((e && e.message) || e).slice(0, 80);
      }
    } else if (m.externo) {
      document.dispatchEvent(
        new CustomEvent('ppx-visivel', { detail: JSON.stringify({ id: m.id, mostrar }) }),
      );
    }
    desenhar();
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
  // So' um dos dois esta' a vista de cada vez; o escondido nao tem caixa para medir, e por isso
  // `pintar` reaplica assim que ele aparece.
  const colocar = () => {
    canto.aplicar(menu, pos);
    canto.aplicar(aba, pos);
  };

  /**
   * Arrastar, tanto pelo ⠿ do menu aberto quanto pelo proprio botao quando ele esta' minimizado.
   *
   * No botao nao da' para ter uma alca separada — ele e' do tamanho do texto. Entao ele e' as duas
   * coisas, e quem decide e' a distancia: andou menos de 4px, foi um clique e o menu abre; andou
   * mais, foi arrasto e o clique nao conta.
   */
  function arrastavel(pegador, movido, aoClicar) {
    let dx = 0;
    let dy = 0;
    let partida = null;
    let andou = false;
    pegador.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const r = movido.getBoundingClientRect();
      dx = e.clientX - r.left;
      dy = e.clientY - r.top;
      partida = { x: e.clientX, y: e.clientY };
      andou = false;
      pegador.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    pegador.addEventListener('pointermove', (e) => {
      if (!partida) return;
      if (!andou && Math.abs(e.clientX - partida.x) + Math.abs(e.clientY - partida.y) < 4) return;
      andou = true;
      dentro(movido, e.clientX - dx, e.clientY - dy);
    });
    const soltar = (e) => {
      if (!partida) return;
      partida = null;
      try {
        pegador.releasePointerCapture(e.pointerId);
      } catch {
        /* ponteiro ja solto */
      }
      if (!andou) {
        if (aoClicar) aoClicar();
        return;
      }
      pos = canto.medir(movido);
      gravar(CHAVE_POS, pos);
      colocar();
    };
    pegador.addEventListener('pointerup', soltar);
    pegador.addEventListener('pointercancel', soltar);
  }

  arrastavel(menu.querySelector('.alca'), menu);
  // O menu e o botao partilham o mesmo canto guardado: arrastar um leva o outro junto, senao
  // minimizar faria a janelinha reaparecer longe de onde o menu estava.
  arrastavel(aba, aba, () => abrir(true));

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

  // O mundo da pagina nao alcanca este `globalThis`, so' o DOM: e' por ele que a ferramenta de la'
  // conta em que estado esta'.
  document.addEventListener('ppx-estado', (e) => {
    try {
      const { id, visivel } = JSON.parse(e.detail);
      globalThis.PPX.anotar(id, visivel);
    } catch {
      /* recado malformado: nao e' motivo para derrubar o menu */
    }
  });

  // Sem nenhuma ferramenta registrada — todas desligadas, ou todas com erro — o menu ainda precisa
  // aparecer: e' por ele que se liga qualquer uma de volta.
  if (document.body) agendarMontagem();
  else addEventListener('DOMContentLoaded', agendarMontagem, { once: true });
})();
