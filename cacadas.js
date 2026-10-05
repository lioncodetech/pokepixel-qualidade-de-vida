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
      <div class="resumo" data-resumo>
        <div class="cima">
          <button type="button" data-passo="-1" title="Caçada anterior da lista">‹</button>
          <b data-folheada>—</b>
          <button type="button" data-passo="1" title="Próxima caçada da lista">›</button>
        </div>
        <div class="baixo">
          <small data-sub></small>
          <button type="button" data-ir-min title="Ir para a caçada mostrada">Ir</button>
        </div>
        <p class="estado" data-estado-min></p>
      </div>
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
        display: flex; flex-direction: column; gap: 4px;
        background: #0d1219; border: 1px solid #202835; border-radius: 8px; padding: 5px 7px;
      }
      #lioncode-cacadas li .cima { display: flex; align-items: center; gap: 5px; }
      #lioncode-cacadas li .rotulo { flex: 1; min-width: 0; }
      #lioncode-cacadas li select {
        width: 100%; background: #1a2130; color: #e7edf6; border: 1px solid #2a3244;
        border-radius: 5px; padding: 3px 5px; font: inherit; font-size: 12px;
      }
      /* Sem time escolhido o select e' so' ruido: fica apagado ate' valer alguma coisa. */
      #lioncode-cacadas li select.sem-time { color: #8b97a8; }
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

      /* Minimizado: a cacada em curso, e as setas para folhear as guardadas sem abrir a lista.
         O que sai da frente e' a lista inteira com os seus selects de time — e' ela que tapa o
         jogo. Fica o que se quer saber de relance: onde estou, e o caminho para o lado. */
      #lioncode-cacadas .resumo { display: none; }
      #lioncode-cacadas.minimizado .resumo {
        display: flex; flex-direction: column; gap: 3px; padding: 0 8px 7px;
      }
      #lioncode-cacadas.minimizado .resumo .cima { display: flex; align-items: center; gap: 4px; }
      #lioncode-cacadas.minimizado .resumo .cima b {
        flex: 1; min-width: 0; text-align: center; font-size: 13px; font-weight: 600;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      #lioncode-cacadas.minimizado .resumo .cima button {
        background: none; border: 0; color: #8b97a8; font-size: 16px; line-height: 1;
        padding: 0 4px; cursor: pointer; font-family: inherit;
      }
      #lioncode-cacadas.minimizado .resumo .cima button:hover:not(:disabled) { color: #e7edf6; }
      #lioncode-cacadas.minimizado .resumo .baixo {
        display: flex; align-items: center; gap: 6px;
      }
      #lioncode-cacadas.minimizado .resumo .baixo small {
        flex: 1; min-width: 0; color: #8b97a8; font-size: 12px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      #lioncode-cacadas.minimizado .resumo .baixo small.agora { color: #7ddba0; }
      #lioncode-cacadas.minimizado .resumo .baixo button {
        background: #1f2a3d; color: #e7edf6; border: 1px solid #33405a; border-radius: 6px;
        padding: 2px 9px; font: inherit; font-size: 12px; cursor: pointer;
      }
      #lioncode-cacadas.minimizado .resumo .baixo button:hover:not(:disabled) { background: #26344c; }
      #lioncode-cacadas.minimizado .resumo .estado { font-size: 12px; min-height: 0; }
      #lioncode-cacadas.minimizado .resumo .estado:empty { display: none; }
      /* Largura fixa, menor que a do painel aberto: medido na banca, com a largura pelo conteudo
         a etiqueta saltava de 176 para 184 pixels ao passar de uma cacada para outra. Nome
         comprido corta com reticencias. */
      #lioncode-cacadas.minimizado { width: 196px; }
      #lioncode-cacadas.minimizado .corpo { display: none; }
      #lioncode-cacadas.minimizado header { border-bottom: 0; padding: 6px 8px; }
      #lioncode-cacadas.minimizado header strong { font-size: 12px; letter-spacing: .06em; }
    `;
    painel.append(estilo);
    document.body.append(painel);

    const campo = (seletor) => painel.querySelector(seletor);
    const estado = campo('[data-estado]');
    const lista = campo('[data-lista]');

    // A mensagem vai aos dois lugares: minimizado, o `.corpo` esta' escondido, e um `Ir` que nao
    // responde nada parece um botao partido.
    const ecoar = () => {
      const eco = campo('[data-estado-min]');
      if (!eco) return;
      eco.textContent = estado.textContent;
      eco.className = estado.className;
    };

    const dizer = (texto, ruim) => {
      estado.textContent = texto;
      estado.classList.toggle('ruim', !!ruim);
      estado.classList.remove('bom');
      ecoar();
    };
    const celebrar = (texto) => {
      dizer(texto);
      estado.classList.add('bom');
      ecoar();
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
      for (const b of painel.querySelectorAll('.resumo button')) b.disabled = sim;
    };

    /** So' a linha de baixo de cada item: onde fica, ou "você está aqui". */
    const pintarMarca = () => {
      pintarResumo();
      const agora = cacadaAtiva();
      for (const onde of lista.querySelectorAll('li small')) {
        const aqui = onde.dataset.cacada === agora?.nome;
        onde.textContent = aqui ? 'você está aqui' : onde.dataset.onde;
        onde.classList.toggle('agora', aqui);
      }
    };

    /**
     * O que a etiqueta minimizada mostra.
     *
     * `folheado` e' o nome escolhido a dedo com as setas; `null` significa "siga a cacada em
     * curso". Sair a folhear nao e' o estado normal: minimizado, a primeira pergunta e' onde se
     * esta', e a resposta tem de aparecer sozinha.
     */
    let folheado = null;
    let ultimoAtivo = null;

    const pintarResumo = () => {
      const todas = guardadas();
      const agora = cacadaAtiva();
      // A cacada mudou no jogo: as setas perdem a vez e volta-se a mostrar onde se esta'. Sem
      // isto, uma troca feita a mao deixava a etiqueta a apontar para outro lugar.
      if (agora?.nome !== ultimoAtivo) {
        ultimoAtivo = agora?.nome ?? null;
        folheado = null;
      }
      const titulo = campo('[data-folheada]');
      const sub = campo('[data-sub]');
      const ir = campo('[data-ir-min]');
      const setas = painel.querySelectorAll('[data-passo]');
      if (!todas.length) {
        titulo.textContent = agora?.nome || 'nenhum atalho';
        sub.textContent = agora ? 'nada guardado ainda' : '';
        sub.classList.remove('agora');
        ir.hidden = true;
        for (const seta of setas) seta.disabled = true;
        return;
      }
      let onde = todas.findIndex((c) => c.nome === (folheado ?? agora?.nome));
      if (onde < 0) onde = 0;
      const alvo = todas[onde];
      const aqui = Boolean(agora) && agora.nome === alvo.nome;
      titulo.textContent = alvo.nome;
      titulo.title = alvo.nome;
      sub.textContent = aqui
        ? 'você está aqui'
        : alvo.time
          ? `com o time "${alvo.time}"`
          : [alvo.regiao, alvo.modo].filter(Boolean).join(' · ');
      sub.classList.toggle('agora', aqui);
      // Ja' estando la', `Ir` so' teria sentido para montar o time — e para isso ha' a lista.
      ir.hidden = aqui && !alvo.time;
      ir.disabled = indo;
      for (const seta of setas) seta.disabled = indo || todas.length < 2;
    };

    for (const seta of painel.querySelectorAll('[data-passo]'))
      seta.addEventListener('click', () => {
        const todas = guardadas();
        if (todas.length < 2) return;
        let onde = todas.findIndex((c) => c.nome === (folheado ?? cacadaAtiva()?.nome));
        if (onde < 0) onde = 0;
        const passo = Number(seta.dataset.passo);
        folheado = todas[(onde + passo + todas.length) % todas.length].nome;
        pintarResumo();
      });

    campo('[data-ir-min]').addEventListener('click', () => {
      const todas = guardadas();
      if (!todas.length) return;
      let onde = todas.findIndex((c) => c.nome === (folheado ?? cacadaAtiva()?.nome));
      if (onde < 0) onde = 0;
      void levar(todas[onde]);
    });

    const desenhar = () => {
      // O resumo acompanha: `desenhar` corre depois de guardar, de apagar e de chegar a uma
      // cacada, e e' nessa ultima que o minimizado tem de passar a dizer "você está aqui".
      pintarResumo();
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
      const nomesDeTime = globalThis.PPX?.times?.nomes?.() || [];
      for (const alvo of todas) {
        const item = document.createElement('li');
        const cima = document.createElement('div');
        cima.className = 'cima';
        const rotulo = document.createElement('div');
        rotulo.className = 'rotulo';
        const nome = document.createElement('b');
        nome.textContent = alvo.nome;
        nome.title = alvo.nome;
        const onde = document.createElement('small');
        const partes = [alvo.regiao, alvo.modo].filter(Boolean);
        const aqui = agora?.nome === alvo.nome;
        onde.dataset.cacada = alvo.nome;
        onde.dataset.onde = partes.join(' · ') || 'sem região';
        onde.textContent = aqui ? 'você está aqui' : onde.dataset.onde;
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

        cima.append(rotulo, ir, apagar);
        item.append(cima);

        // O time e' **opcional**: a maior parte das cacadas se faz com a equipe que ja' esta' na
        // tela, e obrigar a escolher uma seria transformar um atalho de um clique num formulario.
        const times = document.createElement('select');
        times.dataset.time = '';
        const nenhum = document.createElement('option');
        nenhum.value = '';
        nenhum.textContent = nomesDeTime.length ? '— sem trocar o time —' : '— Times desligado —';
        times.append(nenhum);
        for (const nome of nomesDeTime) {
          const opcao = document.createElement('option');
          opcao.value = nome;
          opcao.textContent = `com o time "${nome}"`;
          times.append(opcao);
        }
        // Um time guardado que deixou de existir nao pode desaparecer em silencio: fica na lista,
        // marcado, para voce ver que ele sumiu em vez de descobrir no meio de uma troca.
        if (alvo.time && !nomesDeTime.includes(alvo.time)) {
          const perdido = document.createElement('option');
          perdido.value = alvo.time;
          perdido.textContent = `"${alvo.time}" (não existe mais)`;
          times.append(perdido);
        }
        times.value = alvo.time || '';
        times.classList.toggle('sem-time', !times.value);
        times.addEventListener('change', () => {
          gravar(
            CHAVE_LISTA,
            guardadas().map((c) => (c.nome === alvo.nome ? { ...c, time: times.value } : c)),
          );
          times.classList.toggle('sem-time', !times.value);
          dizer(
            times.value
              ? `"${alvo.nome}" passa a montar o time "${times.value}".`
              : `"${alvo.nome}" deixa de trocar o time.`,
          );
        });
        item.append(times);

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
      // Regravar atualiza a regiao e o modo, mas **nao** mexe no time escolhido: guardar de novo e'
      // corrigir o endereco, nao desfazer a configuracao.
      if (onde >= 0) todas[onde] = { ...agora, time: todas[onde].time || '' };
      else todas.push({ ...agora, time: '' });
      gravar(CHAVE_LISTA, todas);
      desenhar();
      celebrar(
        onde >= 0 ? `"${agora.nome}" atualizada.` : `"${agora.nome}" guardada.`,
      );
    };

    /**
     * Monta o time do atalho, se houver um.
     *
     * **Antes** de entrar na cacada, nunca depois: a cacada comeca a lutar assim que entra, e
     * trocar a equipe com ela ja' correndo seria lutar as primeiras batalhas com o time errado.
     */
    const montarTime = async (nome, avisar) => {
      if (!nome) return { ok: true };
      const times = globalThis.PPX?.times;
      if (!times?.usar)
        return { ok: false, erro: 'a ferramenta Times não está ligada — ligue-a no menu (Alt+Q)' };
      avisar(`Montando o time "${nome}"…`);
      return times.usar(nome);
    };

    const levar = async (alvo) => {
      if (indo) return;
      const jaAqui = cacadaAtiva()?.nome === alvo.nome;
      if (jaAqui && !alvo.time) {
        celebrar(`Você já está em "${alvo.nome}".`);
        return;
      }
      travar(true);
      try {
        const time = await montarTime(alvo.time, (t) => dizer(t));
        if (!time.ok) {
          dizer(`Parei: não montei o time "${alvo.time}": ${time.erro}`, true);
          return;
        }
        if (jaAqui) {
          celebrar(`Time "${alvo.time}" montado. Você já estava em "${alvo.nome}".`);
          return;
        }
        const r = await irPara(alvo, (t) => dizer(t));
        if (r.ok)
          celebrar(
            alvo.time
              ? `Caçando em "${alvo.nome}" com o time "${alvo.time}".`
              : `Caçando em "${alvo.nome}".`,
          );
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
      // Com o relogio em dez minutos, a marca pode estar velha quando o painel reaparece. Repintar
      // aqui nao reconstroi linha nenhuma, por isso nao fecha um select aberto.
      if (sim) pintarMarca();
    };

    let minimizado = ler(CHAVE_MIN, false) === true;
    const aplicarMinimo = () => {
      painel.classList.toggle('minimizado', minimizado);
      campo('[data-titulo]').textContent = minimizado ? 'CAÇ' : 'Caçadas';
      if (minimizado) pintarResumo();
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
    //
    // Repinta-se **so' a marca**, nunca a lista inteira: reconstruir as linhas fecharia na cara
    // de quem estivesse com um select de time aberto.
    //
    // De dez em dez minutos, a pedido: a marca e' uma comodidade, nao um relogio. Quem acabou de
    // entrar numa cacada ja' esta' a olhar para ela no jogo.
    setInterval(pintarMarca, 10 * 60 * 1000);

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
            // Mesmo caminho do botao, inclusive o time: quem chama de fora nao pode receber um
            // comportamento diferente do que a interface mostra.
            const time = await montarTime(alvo.time, (t) => dizer(t));
            if (!time.ok)
              return { ok: false, erro: `não montei o time "${alvo.time}": ${time.erro}` };
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
