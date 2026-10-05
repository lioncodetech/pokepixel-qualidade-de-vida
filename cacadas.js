// Atalhos para cacadas: guarda as que voce usa e volta a qualquer uma num clique.
//
// POR QUE O NOME, E NAO UM ID. Diferente dos Pokemon, que carregam `data-creature-id`, as cacadas
// nao tem identificador nenhum no DOM — nem a que esta' a correr, nem as linhas da lista. O unico
// elo entre as duas telas e' o texto visivel ("Caca de Ralts"), e e' por ele que se procura. Por
// isso o nome guardado **nao** pode ser editavel: ele nao e' um rotulo, e' a chave de busca.
//
// O CAMINHO ATE' A CACADA ja' estava medido no Ginasio (`voltarACacada`), e e' repetido aqui de
// proposito: cada ferramenta deste pacote e' um content script que pode estar desligado sozinho, e
// uma depender da outra para uma coisa tao basica seria trocar duas linhas repetidas por uma falha
// silenciosa. O que se partilha entre elas sao **decisoes** (a porta `PPX.times`), nao utilitarios.

PPX.modulo(
  {
    id: 'cacadas',
    nome: 'Caçadas',
    atalhos: 'Alt+R esconde · Alt+E mostra',
  },
  () => {
    'use strict';

    const CHAVE_LISTA = 'lioncode:cacadas:guardadas';
    const CHAVE_POS = 'lioncode:cacadas:posicao';
    const CHAVE_MIN = 'lioncode:cacadas:minimizado';

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
        /* modo anonimo, ou armazenamento cheio. */
      }
    };

    const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
    const sorteio = (de, ate) => de + Math.random() * (ate - de);

    const ate = async (condicao, limite) => {
      const inicio = Date.now();
      for (;;) {
        const valor = condicao();
        if (valor) return valor;
        if (Date.now() - inicio >= limite) return null;
        await espera(250);
      }
    };

    /**
     * Visivel e' ter largura. **Nunca `isConnected`**: uma janela fechada continua no documento, e
     * clicar no X dela deixa o jogo convencido de que ha' janela aberta — ele passa a recusar
     * qualquer abertura ate' um F5. A licao esta' escrita em `venda-rapida.js` e `loja-rapida.js`.
     */
    const visivel = (el) => Boolean(el) && el.getBoundingClientRect().width > 0;

    const clicar = (el, desvio = 0) => {
      const caixa = el.getBoundingClientRect();
      const base = {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        clientX: caixa.left + caixa.width / 2 + desvio * caixa.width * 0.3,
        clientY: caixa.top + caixa.height / 2 + desvio * caixa.height * 0.3,
        button: 0,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
      };
      el.dispatchEvent(new PointerEvent('pointerover', { ...base, buttons: 0 }));
      el.dispatchEvent(new MouseEvent('mouseover', { ...base, buttons: 0 }));
      el.dispatchEvent(new MouseEvent('mousemove', { ...base, buttons: 0 }));
      el.dispatchEvent(new PointerEvent('pointerdown', { ...base, buttons: 1 }));
      el.dispatchEvent(new MouseEvent('mousedown', { ...base, buttons: 1, detail: 1 }));
      el.dispatchEvent(new PointerEvent('pointerup', { ...base, buttons: 0 }));
      el.dispatchEvent(new MouseEvent('mouseup', { ...base, buttons: 0, detail: 1 }));
      el.dispatchEvent(new MouseEvent('click', { ...base, buttons: 0, detail: 1 }));
    };

    /** O ponteiro chega, hesita, e so' entao carrega. */
    const clicarHumano = async (el) => {
      const caixa = el.getBoundingClientRect();
      const base = {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        clientX: caixa.left + caixa.width / 2,
        clientY: caixa.top + caixa.height / 2,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        buttons: 0,
      };
      el.dispatchEvent(new PointerEvent('pointerover', base));
      el.dispatchEvent(new MouseEvent('mouseover', base));
      el.dispatchEvent(new MouseEvent('mousemove', base));
      await espera(Math.round(sorteio(120, 420)));
      clicar(el, sorteio(-1, 1));
    };

    /**
     * Clica e confere que o jogo reagiu; se nao reagiu, tenta uma vez o `click()` simples.
     *
     * A reserva vem de uma medicao: a sequencia completa de ponteiro nos botoes **da barra de
     * cima** impedia a janela de abrir — a barra reage a mais de um dos eventos e abria e fechava
     * na mesma rajada.
     */
    const clicarEEsperar = async (el, condicao, prazo = 8000) => {
      await clicarHumano(el);
      const primeiro = await ate(condicao, prazo);
      if (primeiro) return primeiro;
      el.click();
      return ate(condicao, prazo);
    };

    const janelaPorTitulo = (regex) =>
      [...document.querySelectorAll('.pokeidle-panel')].find(
        (p) =>
          visivel(p) &&
          regex.test((p.querySelector('.pokeidle-panel__title')?.textContent || '').trim()),
      );

    /** Um menu aberto na barra de cima faz o jogo recusar abrir janelas. */
    const fecharMenus = async () => {
      for (let volta = 0; volta < 4; volta += 1) {
        const gatilho = document.querySelector('.pokeidle-top-toolbar__btn[aria-expanded="true"]');
        if (!gatilho) return true;
        gatilho.click();
        await espera(250);
      }
      return !document.querySelector('.pokeidle-top-toolbar__btn[aria-expanded="true"]');
    };

    const FECHOS = ['.pokeidle-promo-banner__close', '.expedition-alert-banner__dismiss'];

    const fecharBanners = async () => {
      let quantos = 0;
      for (let volta = 0; volta < 4; volta += 1) {
        const botao = FECHOS.map((s) => document.querySelector(s)).find(visivel);
        if (!botao) break;
        clicar(botao);
        quantos += 1;
        await espera(Math.round(sorteio(350, 800)));
      }
      return quantos;
    };

    // ------------------------------------------------------------- a cacada

    /**
     * A cacada em curso: nome, regiao e modo.
     *
     * O nome so' existe no DOM **enquanto ela corre**. Depois de sair, nao ha' de onde o tirar —
     * e' por isso que guardar e' um ato explicito, feito com a cacada na tela.
     */
    const cacadaAtiva = () => {
      const nome = document.querySelector('.platform-hunt__zone-name')?.textContent?.trim();
      if (!nome) return null;
      const meta = document.querySelector('.platform-hunt__zone-meta')?.textContent?.trim() || '';
      const [regiao, modo] = meta.split('·').map((p) => p.trim());
      return { nome, regiao: regiao || '', modo: modo || '' };
    };

    const naCacada = () => Boolean(cacadaAtiva());

    /**
     * Leva ate' uma cacada guardada.
     *
     * A janela reabre na **ultima regiao usada** — a mesma licao que a loja rapida e o inventario
     * ja' tinham ensinado neste pacote —, entao a regiao e' escolhida de proposito antes de
     * procurar a linha. Sem isso, procurar "Caca de Ralts" numa aba de Kanto nao acha nada e a
     * ferramenta diria que a cacada sumiu.
     */
    const irPara = async (alvo, avisar) => {
      if (!alvo?.nome) return { ok: false, erro: 'esse atalho não tem nome de caçada' };

      await fecharBanners();
      await fecharMenus();
      avisar('Abrindo as caçadas…');
      // A barra de cima leva `click()` cru: a sequencia completa de ponteiro abre e fecha o menu
      // na mesma rajada.
      document.querySelector('.pokeidle-top-toolbar__btn[data-menu-id="hunts"]')?.click();
      const janela = await ate(() => janelaPorTitulo(/CA[ÇC]ADAS/i), 8000);
      if (!janela) return { ok: false, erro: 'não consegui abrir a janela das caçadas' };
      await espera(Math.round(sorteio(700, 1400)));

      if (alvo.regiao) {
        const aba = [...janela.querySelectorAll('.hunt-list-world-tab')].find(
          (b) => (b.textContent || '').trim().toLowerCase() === alvo.regiao.toLowerCase(),
        );
        if (aba && !aba.className.includes('is-active')) {
          avisar(`Indo para ${alvo.regiao}…`);
          await clicarEEsperar(aba, () => aba.className.includes('is-active'), 4000);
          await espera(Math.round(sorteio(600, 1300)));
        }
      }

      // A lista pinta depois da janela: procurar uma unica vez, no instante em que ela existe, nao
      // acha nada. E' a mesma licao dos ginasios e das abas da loja.
      const linha = await ate(
        () =>
          [...janela.querySelectorAll('.hunt-list-row')].find((l) =>
            (l.innerText || '').includes(alvo.nome),
          ),
        8000,
      );
      if (!linha) {
        const vistas = [...janela.querySelectorAll('.hunt-list-row')].length;
        return {
          ok: false,
          erro: vistas
            ? `não achei "${alvo.nome}" entre as ${vistas} caçadas de ${alvo.regiao || 'lá'}`
            : 'a janela abriu mas a lista não chegou a aparecer',
        };
      }

      const botao = [...linha.querySelectorAll('button')].find((b) =>
        /^Caçar$/i.test((b.textContent || '').trim()),
      );
      if (!botao) return { ok: false, erro: `a linha de "${alvo.nome}" não tem o botão Caçar` };

      avisar(`Entrando em "${alvo.nome}"…`);
      if (!(await clicarEEsperar(botao, () => naCacada(), 10000)))
        return { ok: false, erro: 'cliquei em Caçar e a caçada não começou' };
      return { ok: true };
    };

    // ------------------------------------------------------------------ painel

    const painel = document.createElement('div');
    painel.id = 'lioncode-cacadas';
    painel.innerHTML = `
      <header>
        <strong data-titulo>Caçadas</strong>
        <button type="button" data-minimizar title="Minimizar">–</button>
        <button type="button" data-fechar title="Esconder (Alt+R)">×</button>
      </header>
      <div class="corpo">
        <button type="button" class="salvar" data-salvar>Guardar a caçada atual</button>
        <ul data-lista></ul>
        <p class="estado" data-estado></p>
      </div>`;

    const estilo = document.createElement('style');
    estilo.textContent = `
      #lioncode-cacadas, #lioncode-cacadas * { box-sizing: border-box; }
      #lioncode-cacadas {
        position: fixed; z-index: 2147483000; width: 230px;
        background: #11161f; color: #e7edf6; border: 1px solid #2a3244; border-radius: 10px;
        font: 13px/1.45 system-ui, sans-serif; box-shadow: 0 8px 24px #0008;
      }
      #lioncode-cacadas header {
        display: flex; align-items: center; gap: 8px; padding: 8px 10px;
        border-bottom: 1px solid #2a3244; cursor: move;
      }
      #lioncode-cacadas header strong { flex: 1; font-size: 13px; }
      #lioncode-cacadas header button {
        background: none; border: 0; color: #8b97a8; font-size: 16px; cursor: pointer; padding: 0 2px;
      }
      #lioncode-cacadas .corpo { display: flex; flex-direction: column; gap: 8px; padding: 10px; }
      #lioncode-cacadas button.salvar {
        background: #1f2a3d; color: #e7edf6; border: 1px solid #33405a; border-radius: 6px;
        padding: 7px; font: inherit; cursor: pointer;
      }
      #lioncode-cacadas button.salvar:hover { background: #26344c; }
      #lioncode-cacadas button:disabled { opacity: .5; cursor: default; }
      #lioncode-cacadas ul { list-style: none; margin: 0; padding: 0;
        display: flex; flex-direction: column; gap: 5px; }
      #lioncode-cacadas li {
        display: flex; align-items: center; gap: 5px;
        background: #0d1219; border: 1px solid #202835; border-radius: 8px; padding: 5px 7px;
      }
      #lioncode-cacadas li .rotulo { flex: 1; min-width: 0; }
      #lioncode-cacadas li b { display: block; font-weight: 600; overflow: hidden;
        text-overflow: ellipsis; white-space: nowrap; }
      #lioncode-cacadas li small { color: #8b97a8; display: block; }
      #lioncode-cacadas li button {
        background: #1f2a3d; color: #e7edf6; border: 1px solid #33405a; border-radius: 6px;
        padding: 3px 8px; font: inherit; font-size: 12px; cursor: pointer;
      }
      #lioncode-cacadas li [data-apagar] { background: none; border-color: transparent;
        color: #8b97a8; padding: 3px 4px; }
      #lioncode-cacadas li .agora { color: #7ddba0; }
      #lioncode-cacadas .estado { margin: 0; color: #9aa6b8; min-height: 1.4em; }
      #lioncode-cacadas .estado.ruim { color: #ff9b9b; }
      #lioncode-cacadas .estado.bom { color: #7ddba0; font-weight: 600; }
      #lioncode-cacadas .vazio { color: #8b97a8; margin: 0; }

      /* Minimizado: fica a etiqueta e mais nada. O painel e' de dar uma ordem e sair da frente. */
      #lioncode-cacadas.minimizado { width: auto; }
      #lioncode-cacadas.minimizado .corpo { display: none; }
      #lioncode-cacadas.minimizado header { border-bottom: 0; padding: 6px 8px; }
      #lioncode-cacadas.minimizado header strong { font-size: 12px; letter-spacing: .06em; }
    `;
    painel.append(estilo);
    document.body.append(painel);

    const campo = (seletor) => painel.querySelector(seletor);
    const estado = campo('[data-estado]');
    const lista = campo('[data-lista]');

    const dizer = (texto, ruim) => {
      estado.textContent = texto;
      estado.classList.toggle('ruim', !!ruim);
      estado.classList.remove('bom');
    };
    const celebrar = (texto) => {
      dizer(texto);
      estado.classList.add('bom');
    };

    const guardadas = () => {
      const bruto = ler(CHAVE_LISTA, []);
      return Array.isArray(bruto) ? bruto.filter((c) => c && c.nome) : [];
    };

    let indo = false;

    const travar = (sim) => {
      indo = sim;
      campo('[data-salvar]').disabled = sim;
      for (const b of lista.querySelectorAll('button')) b.disabled = sim;
    };

    const desenhar = () => {
      const todas = guardadas();
      const agora = cacadaAtiva();
      lista.innerHTML = '';
      if (!todas.length) {
        const vazio = document.createElement('p');
        vazio.className = 'vazio';
        vazio.textContent = 'Nenhum atalho ainda. Entre numa caçada e clique em guardar.';
        lista.append(vazio);
        return;
      }
      for (const alvo of todas) {
        const item = document.createElement('li');
        const rotulo = document.createElement('div');
        rotulo.className = 'rotulo';
        const nome = document.createElement('b');
        nome.textContent = alvo.nome;
        nome.title = alvo.nome;
        const onde = document.createElement('small');
        const partes = [alvo.regiao, alvo.modo].filter(Boolean);
        const aqui = agora?.nome === alvo.nome;
        onde.textContent = aqui ? 'você está aqui' : partes.join(' · ') || 'sem região';
        onde.classList.toggle('agora', aqui);
        rotulo.append(nome, onde);

        const ir = document.createElement('button');
        ir.type = 'button';
        ir.textContent = 'Ir';
        ir.title = `Ir para "${alvo.nome}"`;
        ir.addEventListener('click', () => void levar(alvo));

        const apagar = document.createElement('button');
        apagar.type = 'button';
        apagar.dataset.apagar = '';
        apagar.textContent = '×';
        apagar.title = `Esquecer "${alvo.nome}"`;
        apagar.addEventListener('click', () => {
          gravar(
            CHAVE_LISTA,
            guardadas().filter((c) => c.nome !== alvo.nome),
          );
          desenhar();
          dizer(`"${alvo.nome}" esquecida.`);
        });

        item.append(rotulo, ir, apagar);
        lista.append(item);
      }
    };

    /** Guarda a cacada que esta' na tela. Regravar a mesma atualiza a regiao e o modo. */
    const guardarAtual = () => {
      const agora = cacadaAtiva();
      if (!agora) {
        dizer('Você não está numa caçada — entre numa e eu guardo o atalho.', true);
        return;
      }
      const todas = guardadas();
      const onde = todas.findIndex((c) => c.nome === agora.nome);
      if (onde >= 0) todas[onde] = agora;
      else todas.push(agora);
      gravar(CHAVE_LISTA, todas);
      desenhar();
      celebrar(
        onde >= 0 ? `"${agora.nome}" atualizada.` : `"${agora.nome}" guardada.`,
      );
    };

    const levar = async (alvo) => {
      if (indo) return;
      if (cacadaAtiva()?.nome === alvo.nome) {
        celebrar(`Você já está em "${alvo.nome}".`);
        return;
      }
      travar(true);
      try {
        const r = await irPara(alvo, (t) => dizer(t));
        if (r.ok) celebrar(`Caçando em "${alvo.nome}".`);
        else dizer(`Parei: ${r.erro}`, true);
      } finally {
        travar(false);
        desenhar();
      }
    };

    campo('[data-salvar]').addEventListener('click', guardarAtual);

    // ------------------------------------------------------------ posicao e menu

    const recolocar = () => {
      if (globalThis.PPX?.canto?.aplicar(painel, ler(CHAVE_POS, null))) return;
      painel.style.left = 'auto';
      painel.style.top = 'auto';
      painel.style.right = '16px';
      painel.style.bottom = '16px';
    };

    let aVista = true;
    const pintar = () => {
      painel.style.display = aVista ? 'block' : 'none';
    };
    const mostrarPainel = (sim) => {
      aVista = sim;
      pintar();
    };

    let minimizado = ler(CHAVE_MIN, false) === true;
    const aplicarMinimo = () => {
      painel.classList.toggle('minimizado', minimizado);
      campo('[data-titulo]').textContent = minimizado ? 'CAÇ' : 'Caçadas';
      const botao = campo('[data-minimizar]');
      botao.textContent = minimizado ? '□' : '–';
      botao.title = minimizado ? 'Mostrar tudo' : 'Minimizar';
      recolocar();
    };
    campo('[data-minimizar]').addEventListener('click', () => {
      minimizado = !minimizado;
      gravar(CHAVE_MIN, minimizado);
      aplicarMinimo();
    });

    campo('[data-fechar]').addEventListener('click', () => {
      mostrarPainel(false);
      globalThis.PPX?.anotar?.('cacadas', false);
    });

    {
      let movendo = null;
      painel.querySelector('header').addEventListener('pointerdown', (evento) => {
        if (evento.target.closest('button')) return;
        const caixa = painel.getBoundingClientRect();
        movendo = { dx: evento.clientX - caixa.left, dy: evento.clientY - caixa.top };
        painel.setPointerCapture?.(evento.pointerId);
      });
      addEventListener('pointermove', (evento) => {
        if (!movendo) return;
        painel.style.right = 'auto';
        painel.style.bottom = 'auto';
        painel.style.left = `${evento.clientX - movendo.dx}px`;
        painel.style.top = `${evento.clientY - movendo.dy}px`;
      });
      addEventListener('pointerup', () => {
        if (!movendo) return;
        movendo = null;
        const pos = globalThis.PPX?.canto?.medir(painel);
        if (pos) gravar(CHAVE_POS, pos);
      });
    }

    addEventListener('resize', recolocar);
    addEventListener('keydown', (evento) => {
      if (!evento.altKey || evento.ctrlKey || evento.metaKey) return;
      if (evento.code === 'KeyR') {
        evento.preventDefault();
        mostrarPainel(false);
        globalThis.PPX?.anotar?.('cacadas', false);
      } else if (evento.code === 'KeyE') {
        evento.preventDefault();
        mostrarPainel(true);
        globalThis.PPX?.anotar?.('cacadas', true);
      }
    });

    desenhar();
    aplicarMinimo();
    recolocar();
    pintar();
    // A cacada pode comecar ou acabar pela mao do utilizador: a marca "você está aqui" tem de
    // acompanhar isso sem depender de um clique neste painel.
    setInterval(desenhar, 10000);

    if (globalThis.PPX) {
      globalThis.PPX.controlar?.('cacadas', mostrarPainel);
      mostrarPainel(globalThis.PPX.visivel?.('cacadas') !== false);

      /**
       * A porta para as outras ferramentas, igual a' que o Times abre.
       *
       * Quem chama recebe o resultado em vez de ter de adivinhar lendo a tela — e o caminho ate' a
       * cacada passa a morar num lugar so', com os seus testes.
       */
      globalThis.PPX.cacadas = {
        nomes: () => guardadas().map((c) => c.nome),
        atual: () => cacadaAtiva(),
        ir: async (nome) => {
          const alvo = guardadas().find((c) => c.nome === nome);
          if (!alvo) return { ok: false, erro: `não há atalho guardado para "${nome}"` };
          mostrarPainel(true);
          if (indo) return { ok: false, erro: 'já há uma ida em andamento' };
          travar(true);
          try {
            return await irPara(alvo, (t) => dizer(t));
          } finally {
            travar(false);
            desenhar();
          }
        },
      };
    }
  },
);
