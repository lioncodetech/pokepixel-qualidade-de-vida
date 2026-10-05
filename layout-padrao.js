// PokePixel - layout padrao
//
// Um botao que arruma a tela: todas as janelas e HUDs do jogo voltam para o lugar que voce
// escolheu, de uma vez.
//
// O jogo posiciona cada janela com `inset`/`width`/`height` escritos no proprio elemento, e aceita
// que outro codigo escreva por cima — a janela vai para la' e fica, inclusive quando ela e'
// fechada e reaberta, porque o jogo reaproveita o mesmo no'. E' esse o unico mecanismo usado aqui:
// nada e' pedido ao servidor, nada e' simulado com cliques.

PPX.modulo(
  {
    id: 'layout-padrao',
    nome: 'Layout padrão',
    atalhos: 'Alt+J esconde · Alt+K mostra · Alt+L arruma',
  },
  () => {
    'use strict';

    const CHAVE_PERFIL = 'lioncode:layout-padrao:perfil';
    const CHAVE_POS = 'lioncode:layout-padrao:posicao';
    const CHAVE_MINI = 'lioncode:layout-padrao:minimizado';
    const CHAVE_AUTO = 'lioncode:layout-padrao:auto';
    const CHAVE_ESCALA = 'lioncode:layout-padrao:escalar';
    const CHAVE_APARENCIA = 'lioncode:layout-padrao:aparencia';

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
     * Os HUDs, que estao sempre no DOM e nao tem titulo para serem reconhecidos.
     *
     * Sao poucos e tem classe propria e estavel, entao a lista e' explicita. O que nao estiver
     * nesta lista simplesmente nao e' arrumado — e' melhor do que varrer tudo o que parece
     * arrastavel e sair movendo pedaco de interface que o jogo posiciona por conta.
     */
    const HUDS = [
      '.pokeidle-team-hud',
      '.pokeidle-trainer-hud',
      '.pokeidle-quick-actions',
      '.pokeidle-persistent-chat',
      '.pokeidle-pokehub',
      '.pokeidle-top-toolbar',
      '.world-servers-fab',
    ];
    const PAINEL = '.pokeidle-panel';
    /** O que o proprio jogo guarda sobre posicao de janela e aparencia. */
    const CHAVES_JOGO = /^pokeidle\.(window\.|chat\.expanded-rect|interface-preferences)/;

    const naTela = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };

    /**
     * Como a janela e' reconhecida de uma carga para outra.
     *
     * Pelo titulo que aparece na barra dela — "CAÇADAS", "INVENTÁRIO" —, que e' o que o jogo
     * mostra para a pessoa e muda muito menos que as classes internas. Sem titulo, cai para a
     * classe terminada em `-window`, que ainda identifica o tipo da janela.
     */
    const nomeDoPainel = (p) => {
      const t = p.querySelector('.pokeidle-panel__title');
      const texto = t ? t.textContent.replace(/\s+/g, ' ').trim() : '';
      if (texto) return texto.slice(0, 40);
      return [...p.classList].find((c) => c.endsWith('-window')) || '';
    };

    /**
     * A medida de um elemento.
     *
     * `tam` diz se o tamanho tambem deve ser restaurado. As janelas tem largura e altura proprias,
     * escritas no elemento; ja' um HUD que so' tem posicao se encolhe e se estica sozinho conforme
     * o conteudo, e fixar o tamanho dele cortaria o que mudou desde a foto.
     */
    const medir = (el) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
        tam: !!el.style.width,
      };
    };

    const carimboDe = (perfil) => `${perfil?.quando || ''}|${innerWidth}x${innerHeight}`;

    /**
     * De que tamanho de tela veio o layout.
     *
     * Cada janela do LionMultInstance e' uma tela de tamanho diferente, e um layout em pixels
     * tirado da tela inteira nao cabe num quadrante. Por isso o perfil guarda a janela em que foi
     * tirado, e aqui as medidas sao reescaladas na mesma proporcao. Quem preferir os pixels crus
     * desliga o ajuste na caixa do painel.
     */
    const fatorDe = (perfil) => {
      if (!ler(CHAVE_ESCALA, true) || !perfil?.janela?.w || !perfil?.janela?.h)
        return { x: 1, y: 1 };
      return { x: innerWidth / perfil.janela.w, y: innerHeight / perfil.janela.h };
    };

    /**
     * Poe o elemento no lugar.
     *
     * Tudo com `important` de proposito: o jogo escreve `inset` e, num caso, `left !important` no
     * proprio elemento. Sem o `important` aqui, parte do que fosse escrito perderia para o que ja'
     * estava la', e a janela ficava a meio caminho.
     */
    function colocar(el, m, fator, carimbo) {
      const caixa = el.getBoundingClientRect();
      const largura = Math.min(
        Math.max(1, m.tam ? Math.round(m.w * fator.x) : caixa.width),
        innerWidth,
      );
      const altura = Math.min(
        Math.max(1, m.tam ? Math.round(m.h * fator.y) : caixa.height),
        innerHeight,
      );
      const x = Math.max(0, Math.min(innerWidth - largura, Math.round(m.x * fator.x)));
      const y = Math.max(0, Math.min(Math.max(0, innerHeight - altura), Math.round(m.y * fator.y)));
      const por = (k, v) => el.style.setProperty(k, v, 'important');
      por('left', `${x}px`);
      por('top', `${y}px`);
      por('right', 'auto');
      por('bottom', 'auto');
      por('transform', 'none');
      if (m.tam) {
        por('width', `${largura}px`);
        por('height', `${altura}px`);
      }
      el.dataset.lcLayout = carimbo;
      return true;
    }

    /** Fotografa o que esta' na tela agora. Janela fechada nao entra: nao ha' medida para tirar. */
    function fotografar() {
      const perfil = {
        quando: new Date().toISOString(),
        janela: { w: innerWidth, h: innerHeight },
        huds: {},
        paineis: {},
        jogo: {},
      };
      // `.pokeidle-pokehub` e `.pokeidle-top-toolbar` sao o mesmo elemento, com as duas classes.
      // Sem o conjunto, a barra entraria duas vezes no layout e o painel contaria uma peca a mais
      // do que existe.
      const vistos = new Set();
      for (const seletor of HUDS) {
        const el = document.querySelector(seletor);
        if (!el || vistos.has(el) || !naTela(el)) continue;
        vistos.add(el);
        const m = medir(el);
        if (m) perfil.huds[seletor] = m;
      }
      for (const p of document.querySelectorAll(PAINEL)) {
        if (!naTela(p)) continue;
        const nome = nomeDoPainel(p);
        if (!nome) continue;
        const m = medir(p);
        // A janela sempre tem tamanho proprio, mesmo quando o jogo ainda nao o escreveu no
        // elemento: ela e' redimensionavel pelo canto, e restaurar so' a posicao deixaria metade
        // do layout por fazer.
        if (m) perfil.paineis[nome] = { ...m, tam: true };
      }
      for (const chave of Object.keys(localStorage)) {
        if (CHAVES_JOGO.test(chave)) perfil.jogo[chave] = localStorage.getItem(chave);
      }
      return perfil;
    }

    /** Arruma tudo o que o perfil conhece e esta' na tela. Devolve quantas pecas mexeu. */
    function arrumar(perfil, { soNovos = false } = {}) {
      if (!perfil) return 0;
      const fator = fatorDe(perfil);
      const carimbo = carimboDe(perfil);
      let feitos = 0;
      // Um layout salvo por uma versao anterior pode trazer o mesmo elemento sob dois seletores.
      const vistos = new Set();
      for (const seletor of HUDS) {
        const el = document.querySelector(seletor);
        const m = perfil.huds?.[seletor];
        if (!el || !m || vistos.has(el) || !naTela(el)) continue;
        vistos.add(el);
        if (soNovos && el.dataset.lcLayout === carimbo) continue;
        if (colocar(el, m, fator, carimbo)) feitos++;
      }
      for (const p of document.querySelectorAll(PAINEL)) {
        // Janela fechada continua no DOM, invisivel. Arrumar uma dessas seria medir zero e mandar
        // a janela para um canto qualquer na proxima vez que ela abrisse.
        if (!naTela(p)) continue;
        if (soNovos && p.dataset.lcLayout === carimbo) continue;
        const m = perfil.paineis?.[nomeDoPainel(p)];
        if (m && colocar(p, m, fator, carimbo)) feitos++;
      }
      return feitos;
    }

    /** O que o jogo guarda por conta: posicao inicial das janelas dele e a aparencia. */
    function aplicarNoJogo(perfil) {
      let n = 0;
      for (const [chave, valor] of Object.entries(perfil?.jogo || {})) {
        try {
          localStorage.setItem(chave, valor);
          n++;
        } catch {
          /* armazenamento cheio: o resto do layout continua valendo. */
        }
      }
      return n;
    }

    // ------------------------------------------------------------------ interface

    const painel = document.createElement('section');
    painel.id = 'lioncode-layout-padrao';
    painel.innerHTML = `
      <header>
        <strong>Layout padrão</strong>
        <button type="button" data-minimizar title="Minimizar, deixando só o botão de arrumar">–</button>
        <button type="button" data-fechar title="Esconder (Alt+J)">×</button>
      </header>
      <div class="corpo">
        <button type="button" class="tudo" data-arrumar>Arrumar tudo</button>
        <div class="linhas">
          <button type="button" data-salvar>Salvar layout atual</button>
          <button type="button" data-esquecer>Esquecer</button>
        </div>
        <p class="estado" data-estado></p>
        <label class="linha"><input type="checkbox" data-auto> Arrumar ao abrir cada janela</label>
        <label class="linha"><input type="checkbox" data-escala> Ajustar ao tamanho desta janela</label>
        <label class="linha"><input type="checkbox" data-aparencia> Incluir a aparência do jogo</label>
        <details>
          <summary>Levar para outra janela</summary>
          <textarea data-texto spellcheck="false"
            placeholder="O layout salvo aparece aqui. Cole aqui o de outra janela e clique em usar."></textarea>
          <div class="linhas">
            <button type="button" data-copiar>Copiar</button>
            <button type="button" data-usar>Usar o colado</button>
          </div>
        </details>
        <p class="aviso" data-aviso></p>
      </div>`;

    const estilo = document.createElement('style');
    estilo.textContent = `
      #lioncode-layout-padrao, #lioncode-layout-padrao * { box-sizing: border-box; }
      #lioncode-layout-padrao {
        position: fixed; z-index: 2147483000; width: 290px; max-height: 88vh; overflow: auto;
        background: #10151e; color: #e6e9ef; border: 1px solid #2a3240; border-radius: 12px;
        font: 12px/1.45 system-ui, sans-serif; box-shadow: 0 14px 34px rgba(0,0,0,.55);
        scrollbar-width: thin; scrollbar-color: #2a3240 transparent;
        opacity: .82; transition: opacity .15s;
      }
      #lioncode-layout-padrao:hover, #lioncode-layout-padrao:focus-within { opacity: 1; }
      #lioncode-layout-padrao header {
        display: flex; align-items: center; justify-content: space-between; gap: 8px;
        padding: 9px 12px; background: linear-gradient(#1b2430, #161d27); cursor: move;
        user-select: none; border-bottom: 1px solid #2a3240; position: sticky; top: 0; z-index: 2;
      }
      #lioncode-layout-padrao header strong { font-size: 12px; letter-spacing: .3px; }
      #lioncode-layout-padrao header button {
        background: none; border: 0; color: #8b93a5; font-size: 17px; cursor: pointer;
        line-height: 1; padding: 0 2px;
      }
      #lioncode-layout-padrao header button:hover { color: #e6e9ef; }
      #lioncode-layout-padrao .corpo { padding: 10px 12px 12px; }
      #lioncode-layout-padrao .tudo {
        display: block; width: 100%; margin-bottom: 7px; padding: 8px; font: inherit;
        font-weight: 600; cursor: pointer; border-radius: 8px; border: 1px solid #3a5a3f;
        background: #1e3326; color: #d6efdc;
      }
      #lioncode-layout-padrao .tudo:hover:not(:disabled) { background: #26412f; }
      #lioncode-layout-padrao .tudo:disabled { opacity: .45; cursor: default; }
      #lioncode-layout-padrao .linhas { display: flex; gap: 6px; }
      #lioncode-layout-padrao .linhas button {
        flex: 1; background: #1a2230; color: #c3c9d6; border: 1px solid #2a3240;
        border-radius: 7px; padding: 4px 9px; font: inherit; cursor: pointer;
      }
      #lioncode-layout-padrao .linhas button:hover:not(:disabled) { background: #222c3d; }
      #lioncode-layout-padrao .linhas button:disabled { opacity: .45; cursor: default; }
      #lioncode-layout-padrao .estado {
        margin: 8px 0 6px; color: #7d8697; font-size: 11px; min-height: 15px;
      }
      #lioncode-layout-padrao .linha {
        display: flex; align-items: center; gap: 7px; cursor: pointer; margin-bottom: 5px;
        color: #c3c9d6;
      }
      #lioncode-layout-padrao details { margin-top: 8px; }
      #lioncode-layout-padrao summary {
        cursor: pointer; color: #7d8697; font-size: 11px; margin-bottom: 6px;
      }
      #lioncode-layout-padrao textarea {
        width: 100%; height: 86px; background: #0b0f16; color: #9aa3b4; border: 1px solid #2a3240;
        border-radius: 7px; padding: 6px; font: 11px/1.35 ui-monospace, monospace; resize: vertical;
        margin-bottom: 6px;
      }
      #lioncode-layout-padrao .aviso {
        margin: 8px 0 0; min-height: 15px; color: #9aa3b4; font-size: 11px;
      }
      #lioncode-layout-padrao .aviso button {
        background: #1a2230; color: #c3c9d6; border: 1px solid #2a3240; border-radius: 7px;
        padding: 2px 8px; font: inherit; cursor: pointer; margin-left: 6px;
      }
      /* Minimizado: so' o botao que importa, no mesmo canto onde o painel estava. */
      #lioncode-layout-bolha, #lioncode-layout-bolha * { box-sizing: border-box; }
      #lioncode-layout-bolha {
        position: fixed; z-index: 2147483000; display: flex; align-items: stretch;
        background: #1e3326; border: 1px solid #3a5a3f; border-radius: 9px; overflow: hidden;
        font: 12px/1.45 system-ui, sans-serif; box-shadow: 0 10px 24px rgba(0,0,0,.5);
        opacity: .82; transition: opacity .15s; touch-action: none;
      }
      #lioncode-layout-bolha:hover, #lioncode-layout-bolha:focus-within { opacity: 1; }
      #lioncode-layout-bolha button {
        background: none; border: 0; color: #d6efdc; font: inherit; font-weight: 600;
        cursor: pointer; padding: 6px 11px;
      }
      #lioncode-layout-bolha button:hover { background: #26412f; }
      #lioncode-layout-bolha [data-bolha-abrir] {
        border-left: 1px solid #3a5a3f; padding: 6px 8px; font-weight: 400; color: #9cc5a8;
      }
    `;

    const campo = (seletor) => painel.querySelector(seletor);
    const estado = campo('[data-estado]');
    const aviso = campo('[data-aviso]');
    const texto = campo('[data-texto]');
    const botaoArrumar = campo('[data-arrumar]');
    const plural = (n, palavra) => `${n} ${palavra}${n === 1 ? '' : 's'}`;

    const dizer = (msg, recarregar = false) => {
      aviso.textContent = msg;
      // Minimizado o aviso nao esta' a vista, e arrumar sem resposta nenhuma parece nao ter feito
      // nada: a mesma frase vai para o titulo da bolha, que e' onde o mouse ja' esta'.
      bolha.querySelector('[data-bolha-arrumar]').title = `${msg} · Alt+L arruma`;
      if (!recarregar) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = 'recarregar agora';
      b.onclick = () => location.reload();
      aviso.appendChild(b);
    };

    function desenhar() {
      const perfil = ler(CHAVE_PERFIL, null);
      const pecas = perfil
        ? Object.keys(perfil.paineis || {}).length + Object.keys(perfil.huds || {}).length
        : 0;
      botaoArrumar.disabled = !perfil;
      campo('[data-esquecer]').disabled = !perfil;
      if (!perfil) {
        estado.textContent = 'Nenhum layout salvo. Arrume a tela como você quer e salve.';
      } else {
        const quando = new Date(perfil.quando);
        const dia = isNaN(quando.getTime()) ? '' : ` em ${quando.toLocaleDateString()}`;
        const tela = `${perfil.janela?.w || '?'}×${perfil.janela?.h || '?'}`;
        estado.textContent = `${plural(pecas, 'peça')}${dia}, numa tela de ${tela}.`;
      }
      campo('[data-auto]').checked = ler(CHAVE_AUTO, true) !== false;
      campo('[data-escala]').checked = ler(CHAVE_ESCALA, true) !== false;
      campo('[data-aparencia]').checked = ler(CHAVE_APARENCIA, false) === true;
      texto.value = perfil ? JSON.stringify(perfil) : '';
    }

    campo('[data-salvar]').addEventListener('click', () => {
      const perfil = fotografar();
      gravar(CHAVE_PERFIL, perfil);
      desenhar();
      const abertas = Object.keys(perfil.paineis).length;
      dizer(
        abertas
          ? `Salvo com ${plural(abertas, 'janela')} aberta${abertas === 1 ? '' : 's'}.`
          : 'Salvo. Nenhuma janela estava aberta: só os HUDs entraram.',
      );
    });

    campo('[data-esquecer]').addEventListener('click', () => {
      try {
        localStorage.removeItem(CHAVE_PERFIL);
      } catch {
        /* nada a fazer: o painel ja' mostra o que ha'. */
      }
      desenhar();
      dizer('Layout esquecido. O jogo volta a abrir as janelas onde ele quiser.');
    });

    botaoArrumar.addEventListener('click', () => {
      const perfil = ler(CHAVE_PERFIL, null);
      if (!perfil) return;
      const feitos = arrumar(perfil);
      if (ler(CHAVE_APARENCIA, false) === true) {
        const n = aplicarNoJogo(perfil);
        dizer(
          `${plural(feitos, 'peça')} no lugar; ${plural(n, 'ajuste')} do jogo na próxima carga.`,
          true,
        );
        return;
      }
      dizer(
        feitos
          ? `${plural(feitos, 'peça')} no lugar.`
          : 'Nada para arrumar: o que está salvo não está na tela agora.',
      );
    });

    campo('[data-copiar]').addEventListener('click', async () => {
      texto.select();
      try {
        await navigator.clipboard.writeText(texto.value);
        dizer('Copiado. Cole na outra janela e clique em usar.');
      } catch {
        // Sem permissao de area de transferencia o texto ja' esta' selecionado: Ctrl+C resolve.
        dizer('Selecionado: use Ctrl+C.');
      }
    });

    campo('[data-usar]').addEventListener('click', () => {
      let perfil = null;
      try {
        perfil = JSON.parse(texto.value);
      } catch {
        perfil = null;
      }
      if (!perfil || typeof perfil !== 'object' || (!perfil.paineis && !perfil.huds)) {
        dizer('Isso não é um layout: cole o texto inteiro, da primeira chave à última.');
        return;
      }
      gravar(CHAVE_PERFIL, perfil);
      desenhar();
      dizer(`Layout trocado e ${plural(arrumar(perfil), 'peça')} no lugar.`);
    });

    for (const [seletor, chave] of [
      ['[data-auto]', CHAVE_AUTO],
      ['[data-escala]', CHAVE_ESCALA],
      ['[data-aparencia]', CHAVE_APARENCIA],
    ]) {
      campo(seletor).addEventListener('change', (evento) => {
        gravar(chave, evento.target.checked);
        if (chave === CHAVE_APARENCIA && evento.target.checked)
          dizer('A aparência entra no layout e vale a partir da próxima carga da página.');
      });
    }

    /**
     * Minimizado: so' o botao de arrumar.
     *
     * E' o comando que se usa o tempo todo, e o painel inteiro so' faz falta quando se muda alguma
     * coisa. Minimizado nao e' escondido: quem some com a ferramenta e' o menu do pacote (ou
     * Alt+J), e ai' a bolha vai junto.
     */
    const bolha = document.createElement('div');
    bolha.id = 'lioncode-layout-bolha';
    bolha.innerHTML = `
      <button type="button" data-bolha-arrumar title="Arrumar tudo (Alt+L)">Arrumar</button>
      <button type="button" data-bolha-abrir title="Abrir o painel">⤢</button>`;

    let minimizado = ler(CHAVE_MINI, false) === true;
    let aVista = true;

    const pintar = () => {
      painel.style.display = aVista && !minimizado ? '' : 'none';
      bolha.style.display = aVista && minimizado ? 'flex' : 'none';
      // Escondido nao tem caixa para medir: quem acabou de aparecer so' agora pode ir para o canto.
      recolocar();
    };
    const minimizar = (sim) => {
      minimizado = sim;
      gravar(CHAVE_MINI, sim);
      pintar();
    };

    /**
     * Arrastar, pelo cabecalho do painel e pela propria bolha.
     *
     * Na bolha nao cabe uma alca separada — ela e' do tamanho do texto —, entao ela e' as duas
     * coisas, e quem decide e' a distancia: andou menos de 4px, foi clique e o botao age; andou
     * mais, foi arrasto e o clique nao conta. E' o mesmo criterio do botao minimizado do menu.
     */
    function arrastavel(pegador, movido, aoGravar, aoClicar) {
      let partida = null;
      let andou = false;
      pegador.addEventListener('pointerdown', (evento) => {
        if (evento.button !== 0) return;
        // No painel o cabecalho tem botoes proprios, que nao arrastam. A bolha e' so' botao: ali
        // o arrasto comeca em qualquer ponto dela.
        if (pegador !== movido && evento.target.closest('button')) return;
        const caixa = movido.getBoundingClientRect();
        partida = {
          x: evento.clientX,
          y: evento.clientY,
          left: caixa.left,
          top: caixa.top,
          alvo: evento.target,
        };
        andou = false;
        pegador.setPointerCapture(evento.pointerId);
      });
      pegador.addEventListener('pointermove', (evento) => {
        if (!partida) return;
        const andanca =
          Math.abs(evento.clientX - partida.x) + Math.abs(evento.clientY - partida.y);
        if (!andou && andanca < 4) return;
        andou = true;
        const x = Math.max(0, Math.min(innerWidth - 60, partida.left + evento.clientX - partida.x));
        const y = Math.max(0, Math.min(innerHeight - 30, partida.top + evento.clientY - partida.y));
        movido.style.left = `${x}px`;
        movido.style.top = `${y}px`;
        movido.style.right = 'auto';
        movido.style.bottom = 'auto';
      });
      const soltar = () => {
        if (!partida) return;
        const alvo = partida.alvo;
        partida = null;
        // O clique nao serve para agir aqui: `setPointerCapture` entrega o `click` ao elemento que
        // capturou o ponteiro, e nao ao botao debaixo do dedo — foi por isso que a bolha ficou sem
        // responder a nada. Quem decide e' o fim do arrasto, pelo alvo de onde ele comecou.
        if (!andou) {
          if (aoClicar) aoClicar(alvo);
          return;
        }
        aoGravar(movido);
      };
      pegador.addEventListener('pointerup', soltar);
      pegador.addEventListener('pointercancel', soltar);
    }

    /**
     * O painel e a bolha dividem o mesmo canto guardado.
     *
     * Arrastar um leva o outro: minimizar nao pode fazer a bolha reaparecer longe de onde o painel
     * estava, nem o contrario.
     */
    const colocarNoCanto = (pos) => {
      for (const el of [painel, bolha]) {
        if (PPX.canto.aplicar(el, pos)) continue;
        // Sem canto guardado — ou com a peca escondida, que nao tem medidas. O padrao fica preso a'
        // borda de baixo a direita, acima do botao do menu, porque assim acompanha a janela
        // sozinho: um `top` em pixels desaparecia para fora de um quadrante baixo.
        el.style.left = 'auto';
        el.style.top = 'auto';
        el.style.right = '16px';
        el.style.bottom = '104px';
      }
    };
    const recolocar = () => colocarNoCanto(ler(CHAVE_POS, null));
    const gravarCanto = (movido) => {
      const pos = PPX.canto.medir(movido);
      gravar(CHAVE_POS, pos);
      colocarNoCanto(pos);
    };

    recolocar();

    document.documentElement.append(estilo, painel, bolha);
    arrastavel(painel.querySelector('header'), painel, gravarCanto);
    arrastavel(bolha, bolha, gravarCanto, (alvo) => {
      if (alvo.closest('[data-bolha-abrir]')) minimizar(false);
      else botaoArrumar.click();
    });
    desenhar();
    pintar();

    const mostrarPainel = (sim) => {
      aVista = sim;
      pintar();
    };
    campo('[data-minimizar]').addEventListener('click', () => minimizar(true));
    campo('[data-fechar]').addEventListener('click', () => {
      mostrarPainel(false);
      globalThis.PPX?.anotar?.('layout-padrao', false);
    });

    addEventListener('keydown', (evento) => {
      if (!evento.altKey || evento.ctrlKey || evento.metaKey) return;
      // Alt+J e Alt+K, e nao Alt+Z e Alt+X: estas duas sao do caderno de anotacoes, que roda em
      // qualquer site. Com as duas extensoes na mesma janela, uma tecla comandava as duas.
      if (evento.code === 'KeyJ') {
        evento.preventDefault();
        mostrarPainel(false);
        globalThis.PPX?.anotar?.('layout-padrao', false);
      } else if (evento.code === 'KeyK') {
        evento.preventDefault();
        mostrarPainel(true);
        globalThis.PPX?.anotar?.('layout-padrao', true);
      } else if (evento.code === 'KeyL') {
        // Arrumar sem precisar do painel a vista: e' o comando que mais se usa.
        evento.preventDefault();
        botaoArrumar.click();
      }
    });

    if (globalThis.PPX) {
      globalThis.PPX.controlar?.('layout-padrao', mostrarPainel);
      mostrarPainel(globalThis.PPX.visivel?.('layout-padrao') !== false);
    }

    /**
     * Arrumar ao abrir cada janela.
     *
     * E' isto que torna o layout "padrao" de verdade: a janela ja' nasce no lugar, sem ninguem
     * clicar em nada. So' vale para o que ainda nao foi arrumado com este layout nesta tela — o
     * carimbo no proprio elemento garante isso. Sem ele, arrastar uma janela a mao seria desfeito
     * no instante seguinte pelo proprio observador.
     */
    let relogio = 0;
    new MutationObserver(() => {
      if (ler(CHAVE_AUTO, true) === false) return;
      clearTimeout(relogio);
      relogio = setTimeout(() => arrumar(ler(CHAVE_PERFIL, null), { soNovos: true }), 120);
    }).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });

    // Mudar o tamanho da janela muda para onde cada peca tem de ir. O carimbo carrega a tela em que
    // foi aplicado, entao ele deixa de valer sozinho e tudo e' reescalado na medida nova.
    let aoRedimensionar = 0;
    addEventListener('resize', () => {
      // O painel e a bolha voltam ao canto deles sempre, mesmo com o arrumar automatico desligado:
      // sem isto a bolha ficava pendurada para fora e nao havia como chamar a ferramenta de volta.
      recolocar();
      if (ler(CHAVE_AUTO, true) === false) return;
      clearTimeout(aoRedimensionar);
      aoRedimensionar = setTimeout(() => arrumar(ler(CHAVE_PERFIL, null), { soNovos: true }), 250);
    });
  },
);
