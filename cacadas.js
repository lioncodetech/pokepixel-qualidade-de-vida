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
    atalhos: 'Alt+W esconde · Alt+E mostra',
  },
  () => {
    'use strict';

    const CHAVE_LISTA = 'lioncode:cacadas:guardadas';
    const CHAVE_POS = 'lioncode:cacadas:posicao';
    const CHAVE_MIN = 'lioncode:cacadas:minimizado';
    const CHAVE_CATALOGO = 'lioncode:cacadas:catalogo';

    const PEDIDO = 'lioncode:cacadas:pedido';
    const RESPOSTA = 'lioncode:cacadas:resposta';
    /** Sem `cacadas-main.js` ninguem responde nunca, e um painel a dizer "lendo" para sempre
        nao diz o que esta' errado. */
    const PACIENCIA = 20000;
    /** De quanto em quanto tempo vale a pena reler a lista do jogo. */
    const VALIDADE = 24 * 3600 * 1000;

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

    let proximoEco = 0;

    /**
     * Pergunta a' ponte, e desiste com uma frase em vez de ficar a' espera para sempre.
     *
     * Mesmo desenho do que `escada.js` usa com `escada-main.js`, e repetido aqui pelo motivo que o
     * cabeçalho deste arquivo ja' da' para o caminho ate' a caçada: cada ferramenta e' um content
     * script que pode estar desligado sozinho, e partilhar um utilitario entre duas trocaria linhas
     * repetidas por uma falha calada.
     */
    const pedirPonte = (pedido) =>
      new Promise((resolver) => {
        const eco = `c${Date.now()}-${(proximoEco += 1)}`;
        let relogio = 0;
        const ouvir = (evento) => {
          if (evento?.detail?.eco !== eco) return;
          clearTimeout(relogio);
          removeEventListener(RESPOSTA, ouvir);
          resolver(evento.detail);
        };
        addEventListener(RESPOSTA, ouvir);
        relogio = setTimeout(() => {
          removeEventListener(RESPOSTA, ouvir);
          resolver({ erro: 'o jogo não respondeu — recarregue a página (F5)' });
        }, PACIENCIA);
        dispatchEvent(new CustomEvent(PEDIDO, { detail: { eco, ...pedido } }));
      });

    /** A lista inteira das caçadas do jogo. Ver o cabeçalho de `cacadas-main.js`. */
    const pedirZonas = () => pedirPonte({ acao: 'zonas' });

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

    /**
     * O que tapa a tela e tem de sair da frente antes de qualquer coisa.
     *
     * `.hunt-absence-close` e' o "A caçada continuou sem você", e ele entrou nesta lista medido:
     * montar o time guardado de uma caçada levou **148 s** na conta real, o jogo considerou o
     * jogador ausente, e ao voltar po-s esse modal por cima de tudo. A ida ficou parada ali, sem
     * nada a dizer, ate' alguem clicar a' mao — e quanto mais demorada a troca de time, mais
     * provavel e' que este modal apareça. Ou seja: ele e' o caso **normal** da ida com time, nao
     * um azar.
     */
    /*
     * `.expedition-result-window .npc-shop__close` e' o "Expedição concluída", visto no jogo em
     * 12/10/2026 no fim de uma expedição: um painel com overlay, que tapa a tela inteira e fica
     * ate' alguem clicar em "Continuar". O proprio jogo diz no rodape dele "ao continuar, você
     * volta para a sua caçada anterior" — ou seja, clicar nao decide nada, e' o caminho; nao
     * clicar e' que deixa tudo parado atras de um vidro.
     */
    const FECHOS = [
      '.pokeidle-promo-banner__close',
      '.expedition-alert-banner__dismiss',
      '.hunt-absence-close',
      '.expedition-result-window .npc-shop__close',
    ];

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
      if (nome) {
        const meta = document.querySelector('.platform-hunt__zone-meta')?.textContent?.trim() || '';
        const [regiao, modo] = meta.split('·').map((p) => p.trim());
        return { nome, regiao: regiao || '', modo: modo || '', tipo: 'cacada' };
      }
      /**
       * **A EXPEDIÇÃO NAO E' UMA CAÇADA, E MESMO ASSIM E' UM LUGAR ONDE SE ESTA'.**
       *
       * Medida no jogo em 12/10/2026, a correr: nao tem `.platform-hunt__zone-name`, nao esta' na
       * lista da janela das caçadas, e entra-se nela por um menu da barra de cima. Quem lia so' a
       * zona concluia "voce' nao esta' em caçada nenhuma" — e a Escada, a partir dai', tentava
       * levar o jogador para fora da expedição a cada batida.
       *
       * Entao ela entra aqui, com `tipo` a dizer o que e'. Guardar e reconhecer, sim; viajar para
       * la', nunca — ver `irPara`.
       */
      const correndo = document.querySelector('.expedition-run-hud');
      if (!visivel(correndo)) return null;
      const mapa = document.querySelector('.pokeidle-trainer-hud__map')?.textContent?.trim();
      return { nome: mapa || 'Expedição', regiao: '', modo: '', tipo: 'expedicao' };
    };

    const HORA = 3600000;
    /** As horas de inicio, em Brasilia. Medidas pelo dono, e conferidas duas vezes contra o jogo. */
    const EXPEDICAO_ABRE = [6, 10, 14, 18, 22];
    const EXPEDICAO_DURA = 2;

    /**
     * Quando abre (ou ate' quando dura) a janela da expedição.
     *
     * **A JANELA E' FIXA, E O JOGO DIZ QUE E' ALEATORIA.** O lobby escreve "a próxima janela abre
     * em um horário aleatório"; medido em 12/10/2026, a expedição acabou `08:00` de Brasilia e o
     * lobby anunciou a seguinte para as `10:00` — as duas pontas certas da tabela. Acreditar no
     * texto do jogo seria nao poder dizer nada.
     *
     * A conta e' sobre o **UTC**, nunca sobre o relogio da maquina: Brasilia e' UTC-3 o ano
     * inteiro (o Brasil acabou com o horario de verao em 2019), e quem joga da Europa muda de
     * hora em outubro. Uma tabela escrita em hora local partia-se sozinha nesse domingo. O que se
     * mostra, esse, vai no relogio de quem olha — a pergunta e' "a que horas, para mim".
     */
    const janelaDaExpedicao = (agora = Date.now()) => {
      const DIA = 24 * HORA;
      // O dia de Brasilia que contem `agora`, como meia-noite em tempo real.
      const meiaNoite = Math.floor((agora - 3 * HORA) / DIA) * DIA + 3 * HORA;
      for (let dia = -1; dia <= 1; dia += 1)
        for (const hora of EXPEDICAO_ABRE) {
          const abre = meiaNoite + dia * DIA + hora * HORA;
          const fecha = abre + EXPEDICAO_DURA * HORA;
          if (agora < fecha) return { aberta: agora >= abre, quando: agora >= abre ? fecha : abre };
        }
      return null;
    };

    const horaDe = (ms) =>
      new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const daquiA = (ms) => {
      const min = Math.max(0, Math.round((ms - Date.now()) / 60000));
      return min >= 60
        ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`
        : `${min}min`;
    };

    /** O que se le' na linha da expedição: ela nao tem regiao nem modo, tem horario. */
    const legendaDaExpedicao = () => {
      const j = janelaDaExpedicao();
      if (!j) return 'expedição · quem entra é você';
      return j.aberta
        ? `expedição ABERTA até ${horaDe(j.quando)} · entra você`
        : `expedição · abre ${horaDe(j.quando)} (em ${daquiA(j.quando)})`;
    };

    /** A expedição de hoje pode ter outro nome; o que nao muda e' o tipo. */
    const mesmoLugar = (a, b) =>
      Boolean(a) &&
      Boolean(b) &&
      (a.tipo === 'expedicao' ? b.tipo === 'expedicao' : a.nome === b.nome);

    const abasDa = (janela) => [...janela.querySelectorAll('.hunt-list-world-tab')];

    const nomeDaAba = (aba) => (aba.textContent || '').trim();

    /**
     * A linha da lista que e' mesmo aquela caçada.
     *
     * MEDIDO NO JOGO EM 12/10/2026, com a aba de Johto aberta (92 linhas): cada linha e' um `<tr>`
     * com o nome exacto em `.hunt-list-identity-copy strong` ("Sunkern") e uma celula que le'
     * "Nv. 101". Antes procurava-se `innerText.includes(nome)`, e isso casa com qualquer linha onde
     * o texto apareça — a lista traz tambem o nome da especie e as fraquezas.
     *
     * **E O NIVEL DESEMPATA, PORQUE HA' EMPATE.** Nos 377 registros do jogo ha' um nome repetido:
     * "Nidorina" existe duas vezes em Kanto, Lv 10 e Lv 37. Com o nome so', ir para a de Lv 37
     * levava a' de Lv 10 sem dizer nada. Sabendo o nivel, escolhe-se a certa.
     *
     * O `includes` fica como rede: se o jogo trocar o nome das classes, procura-se como se
     * procurava antes em vez de deixar de achar.
     */
    const linhaDe = (janela, nome, nivel) => {
      const linhas = [...janela.querySelectorAll('.hunt-list-row')];
      const nomeDa = (l) =>
        (l.querySelector('.hunt-list-identity-copy strong')?.textContent || '').trim();
      const exatas = linhas.filter((l) => nomeDa(l) === nome);
      const candidatas = exatas.length
        ? exatas
        : linhas.filter((l) => (l.innerText || '').includes(nome));
      if (nivel && candidatas.length > 1) {
        const certa = candidatas.find((l) =>
          new RegExp(`Nv\\.\\s*${nivel}\\b`).test(l.innerText || ''),
        );
        if (certa) return certa;
      }
      return candidatas[0];
    };

    /**
     * Limpa o filtro da lista de cacadas.
     *
     * Medido no jogo em 11/10/2026: com "zubat" na busca e a faixa de nivel em 5–9, a lista fica
     * com **zero** linhas. Ate' aqui isso era indistinguivel de "a lista ainda nao pintou", e a
     * ferramenta desistia a dizer a coisa errada — o filtro e' do jogador, fica guardado, e chega
     * sujo a quem automatiza.
     *
     * O botao "Limpar" apaga a busca e devolve a faixa de nivel ao padrao **daquela aba** (medido:
     * 1–100 em Kanto, 100–2000 nas Ilhas Lendarias). Ele **nao** mexe na aba aberta — por isso
     * corre antes de escolher a aba, e outra vez depois de cada troca.
     */
    const limparFiltro = async (janela) => {
      const botao = janela.querySelector('.hunt-list-clear');
      if (!visivel(botao)) return false;
      clicar(botao);
      await espera(Math.round(sorteio(350, 800)));
      return true;
    };

    /** O nome da aba aberta agora, relido do DOM. Nunca de um no' guardado: ver `abrirAba`. */
    const abaAberta = (janela) => {
      const aberta = abasDa(janela).find((b) => b.className.includes('is-active'));
      return aberta ? nomeDaAba(aberta) : '';
    };

    /**
     * Abre a aba `nome` e confere, relendo o DOM, que ela ficou aberta.
     *
     * **O JOGO TROCA OS BOTOES DA BARRA AO MUDAR DE ABA.** Medido em 11/10/2026: depois de clicar,
     * uma leitura nova da barra mostra a aba certa com `is-active`, mas o no' que se tinha na mao
     * continua sem a classe — ele foi substituido. Quem guarda o botao e pergunta a ele conclui
     * "nao mudou" nas quatro abas, sempre, mesmo tendo mudado nas quatro.
     *
     * Isto nao e' teorico e nao e' novo: a versao anterior esperava por
     * `aba.className.includes('is-active')` no no' guardado, nunca via a classe aparecer, e por
     * isso o `clicarEEsperar` ainda dava um segundo clique de reserva — dois cliques por aba, e um
     * resultado que ninguem conferia. Limpar o filtro, esse, **nao** troca os botoes; so' a troca
     * de aba troca.
     */
    const abrirAba = async (janela, nome) => {
      if (abaAberta(janela) === nome) return true;
      const aba = abasDa(janela).find((b) => nomeDaAba(b) === nome);
      if (!aba) return false;
      await clicarEEsperar(aba, () => abaAberta(janela) === nome, 4000);
      await espera(Math.round(sorteio(400, 900)));
      return abaAberta(janela) === nome;
    };

    /**
     * Leva ate' uma cacada guardada.
     *
     * A janela reabre na **ultima regiao usada** — a mesma licao que a loja rapida e o inventario
     * ja' tinham ensinado neste pacote —, entao a aba e' escolhida de proposito antes de procurar
     * a linha. Sem isso, procurar "Caca de Ralts" numa aba de Kanto nao acha nada.
     *
     * **A REGIAO GUARDADA E' UMA PISTA, NAO UM ENDERECO.** Ela vem de `.platform-hunt__zone-meta`,
     * que diz o que o jogo quiser: medido na conta real, as quatro cacadas guardadas tinham
     * `regiao` igual a "legendary", "hoenn" e **dois UUID**. So' "hoenn" casa com o texto de uma
     * aba ("Hoenn"); "legendary" nao e' "Ilhas Lendarias", e um UUID nao e' nada. Nesses casos a
     * ferramenta ficava na aba em que a janela calhasse de abrir e jurava que a cacada sumiu.
     *
     * Por isso: tenta-se a aba da pista, e **nao achando, varrem-se as outras**. O que nao esta'
     * no DOM nao e' o que nao existe — a lista desenha so' a aba aberta.
     */
    /**
     * Abre a janela das caçadas — **sem acreditar no DOM sobre ela estar aberta.**
     *
     * MEDIDO NO JOGO EM 11/10/2026, com o botao da barra clicado tres vezes seguidas:
     *
     *   clique 1 -> CAÇADAS[largura=1482]   abre
     *   clique 2 -> CAÇADAS[largura=0]      fecha, e o painel FICA no documento
     *   clique 3 -> CAÇADAS[largura=1482]   abre
     *
     * O botao alterna, e ate' aqui o DOM acompanha: largura zero e' fechada, e `visivel` ja' sabe
     * disso. **O problema e' outro, e foi medido na mesma sessao:** depois de aberta, o jogo
     * apagou o painel inteiro do documento por conta propria — e o clique seguinte **nao abriu
     * nada**, porque do lado dele a janela continuava "aberta". O estado de aberto/fechado do jogo
     * sobrevive ao painel deixar de existir, entao perguntar ao DOM se ha' janela aberta responde
     * a outra pergunta. E' a mesma armadilha ja' documentada em `visivel` para o ✕, ao contrario.
     *
     * A saida nao e' adivinhar melhor: e' nao depender da adivinhacao. Clica-se, espera-se, e se
     * nao apareceu clica-se outra vez. Um clique perdido a fechar o que ja' estava fechado nao
     * custa nada; o que custava era desistir a dizer que o jogo nao abre a janela.
     *
     * A barra de cima leva `click()` cru: a sequencia completa de ponteiro abre e fecha o menu na
     * mesma rajada.
     */
    const abrirJanela = async () => {
      for (let tentativa = 0; tentativa < 2; tentativa += 1) {
        if (janelaPorTitulo(/CA[ÇC]ADAS/i)) return true;
        document.querySelector('.pokeidle-top-toolbar__btn[data-menu-id="hunts"]')?.click();
        if (await ate(() => janelaPorTitulo(/CA[ÇC]ADAS/i), 5000)) return true;
      }
      return Boolean(janelaPorTitulo(/CA[ÇC]ADAS/i));
    };

    const irPara = async (bruto, avisar) => {
      if (!bruto?.nome) return { ok: false, erro: 'esse atalho não tem nome de caçada' };
      // Quem chama pode passar um atalho guardado cru, sem nivel nem aba — pelo `PPX.cacadas.ir`,
      // por exemplo. O catalogo completa-o aqui, para a ida ser igual venha ela de onde vier.
      const alvo = completar(bruto);
      // Para a expedição nao se viaja: ela nao esta' na lista da janela, entra-se por um menu da
      // barra de cima e ela so' existe enquanto dura. Guardar serve para a reconhecer, nao para
      // la' chegar.
      if (alvo.tipo === 'expedicao')
        return { ok: false, erro: 'na expedição entra você — eu só sei reconhecê-la' };

      await fecharBanners();
      await fecharMenus();
      avisar('Abrindo as caçadas…');
      if (!(await abrirJanela()))
        return { ok: false, erro: 'não consegui abrir a janela das caçadas' };
      await espera(Math.round(sorteio(700, 1400)));
      /**
       * A janela, **relida a cada pergunta**.
       *
       * Guardar o elemento numa variavel parecia obvio e e' uma armadilha: o jogo recria o painel
       * — medido depois do modal "A caçada continuou sem você" — e o que fica na mao e' um no'
       * orfao. Dali em diante toda leitura devolve o que era, todo clique cai no vazio e nada
       * reclama: a ida fica a varrer abas que nao existem mais ate' o fim, e diz que nao achou.
       */
      const jan = () => janelaPorTitulo(/CA[ÇC]ADAS/i);

      const janelaFoi = () => !jan();

      // O filtro vem antes da aba, porque ele vale para todas elas e nao e' mexido pela troca.
      await limparFiltro(jan());

      // So' os NOMES das abas, nunca os botoes: eles sao substituidos a cada troca. Ver `abrirAba`.
      const nomes = abasDa(jan()).map(nomeDaAba);
      const casa = (quem) =>
        quem ? nomes.find((n) => n.toLowerCase() === String(quem).toLowerCase()) : null;
      /**
       * **A ABA APRENDIDA VALE MAIS DO QUE A REGIAO GUARDADA.**
       *
       * Medido na conta real em 12/10/2026: das nove caçadas guardadas, **seis** tinham por regiao
       * um UUID e uma tinha "legendary" — nenhuma delas casa com o texto de uma aba. Ou seja, a
       * pista quase nunca e' pista, e quase toda ida caia na varredura: com a janela aberta na aba
       * errada, uma ida para a Togetic levou **45 segundos** so' a achar a linha.
       *
       * Varrer continua a ser a rede de seguranca, mas agora paga-se uma vez: achada a caçada,
       * guarda-se **a aba onde ela estava**, e a ida seguinte vai direta. E' o endereço que o jogo
       * nao da' a aprender-se de uma ida para a outra.
       */
      const pista = casa(alvo.aba) || casa(alvo.regiao);
      if (pista && abaAberta(jan()) !== pista) {
        avisar(`Indo para ${pista}…`);
        // Trocar de aba muda a faixa de nivel para a daquela aba; limpar outra vez poe a lista no
        // estado em que ela se le'.
        if (await abrirAba(jan(), pista)) await limparFiltro(jan());
      }

      // A lista pinta depois da janela: procurar uma unica vez, no instante em que ela existe, nao
      // acha nada. E' a mesma licao dos ginasios e das abas da loja.
      // E diz-se onde se esta' a procurar: sao oito segundos calados, e quem olha para "Abrindo as
      // caçadas…" durante oito segundos conclui que a ferramenta travou. Ela nao travou.
      avisar(`Procurando "${alvo.nome}" em ${abaAberta(jan()) || 'a lista'}…`);
      let linha = await ate(() => jan() && linhaDe(jan(), alvo.nome, alvo.nivel), 8000);

      // Nao estava na aba aberta. Varrem-se as outras — e isto e' o caminho normal, nao a excecao:
      // uma `regiao` guardada que nao casa com nenhuma aba (um UUID, "legendary") chega aqui
      // sempre. Quatro segundos por aba: a lista ja' esta' na memoria do jogo, o que demora e' o
      // desenho.
      const varridas = [abaAberta(jan())];
      for (const nome of nomes) {
        if (linha) break;
        if (varridas.includes(nome)) continue;
        // Um modal pode nascer no meio da varredura — e nasce, justamente depois de uma troca de
        // time demorada. Fechar so' no inicio deixava a ida parada sem nada a dizer.
        await fecharBanners();
        if (janelaFoi())
          return { ok: false, erro: 'a janela das caçadas fechou-se a meio da busca' };
        avisar(`Procurando "${alvo.nome}" em ${nome}…`);
        if (!(await abrirAba(jan(), nome))) continue;
        await limparFiltro(jan());
        varridas.push(nome);
        linha = await ate(() => jan() && linhaDe(jan(), alvo.nome, alvo.nivel), 4000);
      }

      if (!linha) {
        if (janelaFoi())
          return { ok: false, erro: 'a janela das caçadas fechou-se antes de eu achar a caçada' };
        const vistas = jan().querySelectorAll('.hunt-list-row').length;
        return {
          ok: false,
          erro: vistas
            ? `não achei "${alvo.nome}" em nenhuma aba (${varridas.join(', ')})`
            : 'limpei o filtro e varri as abas, e a lista continuou vazia',
        };
      }

      // Achada: a aba onde ela estava e' o endereço que faltava. Guarda-se agora, e nao no fim,
      // porque a entrada na caçada pode falhar e o endereço continua certo.
      aprenderAba(alvo.nome, abaAberta(jan()));

      const botao = [...linha.querySelectorAll('button')].find((b) =>
        /^Caçar$/i.test((b.textContent || '').trim()),
      );
      if (!botao) return { ok: false, erro: `a linha de "${alvo.nome}" não tem o botão Caçar` };

      avisar(`Entrando em "${alvo.nome}"…`);
      // **A CHEGADA E' A CAÇADA CERTA, NAO "UMA CAÇADA QUALQUER".** Ate' aqui esperava-se por
      // "ha' alguma caçada a correr" — e quem ja' estava a caçar responde que sim antes de o
      // clique sequer fazer efeito. Medido no jogo em 11/10/2026: a espera devolveu "cheguei" no
      // primeiro instante, a ferramenta deu a ida por falhada ("o jogo não me levou") e, poucos
      // segundos depois, o jogador estava em "Caça de Azurill". A viagem correu bem o tempo todo.
      //
      // Vinte segundos, e nao dez: entre o clique e a caçada nova ha' um "PREPARANDO MAPA DE
      // CAÇA…" que leva o seu tempo, e desistir no meio dele seria mentir ao contrario.
      if (!(await clicarEEsperar(botao, () => cacadaAtiva()?.nome === alvo.nome, 20000)))
        return {
          ok: false,
          erro: `cliquei em Caçar e ${
            cacadaAtiva() ? `continuei em "${cacadaAtiva().nome}"` : 'nenhuma caçada começou'
          }`,
        };
      return { ok: true };
    };

    // ------------------------------------------------------------------ painel

    const painel = document.createElement('div');
    painel.id = 'lioncode-cacadas';
    painel.innerHTML = `
      <header>
        <strong data-titulo>Caçadas</strong>
        <button type="button" data-minimizar title="Minimizar">–</button>
        <button type="button" data-fechar title="Esconder (Alt+W)">×</button>
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
        <div class="busca">
          <input type="search" data-filtro placeholder="filtrar por nome, nível ou região" />
          <button type="button" data-atualizar title="Reler a lista de caçadas do jogo">↻</button>
          <button type="button" data-recarregar-times title="Atualizar a lista de times">↻ times</button>
        </div>
        <ul data-lista></ul>
        <div data-config></div>
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
      #lioncode-cacadas .busca { display: flex; gap: 5px; }
      #lioncode-cacadas .busca input {
        flex: 1; min-width: 0; background: #1a2130; color: #e7edf6; border: 1px solid #2a3244;
        border-radius: 6px; padding: 5px 7px; font: inherit; font-size: 12px;
      }
      #lioncode-cacadas .busca input::placeholder { color: #70798a; }
      #lioncode-cacadas .busca button {
        background: #1f2a3d; color: #e7edf6; border: 1px solid #33405a; border-radius: 6px;
        padding: 3px 9px; font: inherit; cursor: pointer;
      }
      #lioncode-cacadas .busca button:hover:not(:disabled) { background: #26344c; }
      #lioncode-cacadas .conta { margin: 0; color: #70798a; font-size: 12px; }
      #lioncode-cacadas ul { list-style: none; margin: 0; padding: 0;
        display: flex; flex-direction: column; gap: 5px;
        /* Quem guarda uma dezena de cacadas tinha o painel a passar da tela, e o fim da lista
           ficava fora do alcance: nem rolagem, porque quem rola e' a pagina do jogo. Rola a
           lista, e o botao de guardar e o estado ficam sempre a' vista. */
        max-height: 46vh; overflow: auto; }
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

    /**
     * A expedição esta' sempre na lista, e nao se guarda.
     *
     * Guardar atalhos e' para o que o jogador escolhe: ele entra numa caçada e diz "quero voltar
     * aqui". A expedição nao e' escolha dele — e' uma coisa do jogo, com horario proprio e sempre
     * a mesma. Exigir que ela fosse guardada **de dentro** era pior do que inutil: so' se pode
     * estar dentro dela duas horas a cada quatro, e e' justamente **fora** dela que se quer
     * dize-la a' Escada ("quando abrir, e' ali que eu vou estar").
     *
     * Por isso ela entra aqui, sem passar pelo armazem — e `gravarLista` trata de nunca a
     * escrever. Uma entrada fixa guardada viraria uma copia que envelhece sozinha.
     */
    const EXPEDICAO = { nome: 'Expedição', tipo: 'expedicao', time: '', fixa: true };

    const guardadas = () => {
      const bruto = ler(CHAVE_LISTA, []);
      const lista = Array.isArray(bruto) ? bruto.filter((c) => c && c.nome) : [];
      if (!lista.some((c) => c.tipo === 'expedicao')) lista.push({ ...EXPEDICAO });
      return lista;
    };

    /** Guarda a lista **sem** o que nao e' do jogador. Ver `EXPEDICAO`. */
    const gravarLista = (todas) =>
      gravar(
        CHAVE_LISTA,
        todas.filter((c) => !c.fixa),
      );

    /**
     * Guarda a aba em que a caçada foi mesmo encontrada.
     *
     * E' a unica coisa que a ferramenta escreve sozinha no atalho, e escreve-a porque o jogo nao
     * a da': a `regiao` que ele mostra e', na conta real, um UUID em seis dos nove atalhos. A aba
     * descobre-se varrendo uma vez, e dai' em diante e' endereço. Ver a pista em `irPara`.
     *
     * Nao mexe em mais nada do atalho — nome, time e modo sao escolha do jogador.
     */
    const aprenderAba = (nome, aba) => {
      if (!aba) return;
      const todas = guardadas();
      const onde = todas.findIndex((c) => c.nome === nome);
      if (onde < 0 || todas[onde].aba === aba) return;
      todas[onde] = { ...todas[onde], aba };
      gravarLista(todas);
    };

    /**
     * O CATALOGO: a lista das caçadas do jogo, como ela e' lida uma vez e guardada.
     *
     * POR QUE ELE EXISTE. Guardar um atalho era um ato de presenca — entrar na caçada, ler o nome
     * do HUD, clicar em guardar — porque o nome so' existe no DOM **enquanto ela corre**. Para ter
     * nove atalhos faziam-se nove viagens, e o nivel de cada caçada nao aparecia em canto nenhum
     * do painel. O jogo sabia a lista inteira o tempo todo: 377 caçadas, com nome, nivel e mundo.
     * Ver `cacadas-main.js` para o que foi medido.
     *
     * **ELE NAO E' A VERDADE, E' UMA COPIA DELA.** O que o jogo responde hoje pode mudar amanha —
     * entra uma regiao nova, muda um nivel. Por isso guarda-se o instante junto, relê-se de 24 em
     * 24 horas, e o ↻ relê a pedido. E por isso nada do catalogo entra no atalho guardado sem
     * passar por `paraGuardar`: o que a extensao descobriu sozinha nao se escreve como se fosse
     * escolha do dono, que e' a mesma regra que o `config.js` segue para exportar.
     */
    const catalogo = () => {
      const bruto = ler(CHAVE_CATALOGO, null);
      return {
        quando: Number(bruto?.quando) || 0,
        zonas: Array.isArray(bruto?.zonas) ? bruto.zonas.filter((z) => z && z.nome) : [],
      };
    };

    /** As zonas com aquele nome — **mais de uma** quando o jogo repete o nome. Ver `linhaDe`. */
    const zonasDe = (nome) => catalogo().zonas.filter((z) => z.nome === nome);

    /**
     * Um UUID nao e' uma regiao para ninguem ler.
     *
     * `.platform-hunt__zone-meta` mostra o `id` do mundo, e seis dos nove atalhos da conta real
     * tinham isso guardado como "regiao". Hoje sabe-se o que ele e' — ver `cacadas-main.js` —, mas
     * sem catalogo nao ha' como o traduzir, e meia linha de UUID na etiqueta e' pior do que nada.
     */
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

    /**
     * Enche o atalho com o que o catalogo sabe: o nivel e a aba.
     *
     * **Nao sobrescreve nada do dono.** A aba aprendida numa ida anterior vale mais do que a do
     * catalogo, porque ela foi medida naquela conta. E nome repetido so' se resolve se o proprio
     * atalho disser de qual nivel e' — adivinhar levaria a' Nidorina errada.
     */
    const completar = (c) => {
      if (!c || c.tipo === 'expedicao') return c;
      const iguais = zonasDe(c.nome);
      const z = c.nivel
        ? iguais.find((x) => x.nivel === c.nivel)
        : iguais.length === 1
          ? iguais[0]
          : null;
      if (!z) return c;
      return { ...c, nivel: c.nivel || z.nivel, aba: c.aba || z.aba, trancado: z.trancado };
    };

    /** So' o que e' escolha do dono. O resto deriva do jogo e relê-se. */
    const paraGuardar = (c) => ({
      nome: c.nome,
      nivel: Number(c.nivel) || 0,
      aba: c.aba || '',
      regiao: c.regiao || '',
      modo: c.modo || '',
      tipo: c.tipo || 'cacada',
      time: c.time || '',
    });

    /**
     * A lista que o painel mostra: os atalhos do dono primeiro, e depois o jogo inteiro.
     *
     * Os dele em cima e na ordem em que ele os guardou, porque sao os que ele usa; o resto por
     * mundo e nivel, que e' a ordem em que o jogo os desenha. Uma caçada do catalogo desaparece
     * daqui quando passa a ser atalho dele — e **so' a de nivel igual**, para que guardar a
     * Nidorina de Lv 37 nao esconda a de Lv 10.
     */
    const todasConhecidas = () => {
      const minhas = guardadas().map(completar);
      const jaMinha = (z) =>
        minhas.some((c) => c.nome === z.nome && (!c.nivel || c.nivel === z.nivel));
      const resto = catalogo()
        .zonas.filter((z) => !jaMinha(z))
        .sort((a, b) => a.ordem - b.ordem || a.nivel - b.nivel || a.nome.localeCompare(b.nome))
        .map((z) => ({
          nome: z.nome,
          nivel: z.nivel,
          aba: z.aba,
          regiao: '',
          modo: '',
          tipo: 'cacada',
          time: '',
          trancado: z.trancado,
          doJogo: true,
        }));
      return [...minhas, ...resto];
    };

    let pedindoZonas = false;

    /**
     * Lê a lista do jogo quando ela falta ou envelheceu.
     *
     * Chamado tambem quando o painel reaparece, e nao so' ao carregar: a extensao arranca em
     * `document_idle`, que e' antes de o jogo publicar a `Api` — a primeira tentativa costuma
     * apanhar "o jogo ainda não publicou a API". Calada, se for automatica: um painel a reclamar
     * de uma coisa que ninguem pediu e' ruido. Pelo ↻, diz tudo.
     */
    const garantirCatalogo = (forcado) => {
      if (pedindoZonas) return;
      const agora = catalogo();
      if (!forcado && agora.zonas.length && Date.now() - agora.quando < VALIDADE) return;
      pedindoZonas = true;
      campo('[data-atualizar]').disabled = true;
      if (forcado) dizer('Lendo a lista de caçadas do jogo…');
      void pedirZonas()
        .then((lido) => {
          if (lido?.ok && lido.zonas?.length) {
            gravar(CHAVE_CATALOGO, { quando: Date.now(), zonas: lido.zonas });
            insistencias = 0;
            desenhar();
            if (forcado) celebrar(`${lido.zonas.length} caçadas na lista.`);
            return;
          }
          if (forcado) dizer(`Não li a lista: ${lido?.erro || 'o jogo não disse porquê'}`, true);
          else insistir();
        })
        .finally(() => {
          pedindoZonas = false;
          campo('[data-atualizar]').disabled = indo;
        });
    };

    /** Releitura imediata para eventos temporários, cujo `locked` pode mudar antes das 24 horas. */
    const relerCatalogo = async () => {
      const lido = await pedirZonas();
      if (!lido?.ok || !lido.zonas?.length)
        return { ok: false, erro: lido?.erro || 'o jogo não devolveu as caçadas' };
      gravar(CHAVE_CATALOGO, { quando: Date.now(), zonas: lido.zonas });
      insistencias = 0;
      desenhar();
      return { ok: true, quantas: lido.zonas.length };
    };

    /**
     * **A PRIMEIRA LEITURA FALHA, E ELA TEM DE INSISTIR SOZINHA.**
     *
     * Medido no jogo do dono em 12/10/2026, com a extensao recarregada e a pagina em F5: a ponte
     * respondia as 377 caçadas quando perguntada a' mao, e o catalogo estava **vazio**. Nao era a
     * ponte: a extensao corre em `document_idle`, que e' antes de o jogo publicar a `Api`, e a
     * tentativa do arranque apanhou "o jogo ainda não publicou a API".
     *
     * A unica retentativa que havia era "quando o painel reaparece" — e um painel que nunca se
     * esconde nunca reaparece. Ficava um ↻ a' espera de alguem o clicar, o que e' pedir ao dono que
     * resolva um problema de arranque que ele nao tem como adivinhar.
     *
     * Entao insiste-se, com espera crescente e um numero de vezes contado: a tela do jogo pode
     * demorar, mas nao demora para sempre, e um laço sem fim a bater na ponte seria trocar um
     * silencio por um incomodo. Esgotadas as tentativas, fica o ↻ — e ai' ele e' o que resta, nao
     * o unico caminho.
     */
    const INSISTE = [4000, 12000, 40000];
    let insistencias = 0;

    const insistir = () => {
      const espera = INSISTE[insistencias];
      if (espera === undefined) return;
      insistencias += 1;
      setTimeout(() => garantirCatalogo(false), espera);
    };

    let indo = false;

    const travar = (sim) => {
      indo = sim;
      campo('[data-salvar]').disabled = sim;
      campo('[data-atualizar]').disabled = sim || pedindoZonas;
      for (const b of lista.querySelectorAll('button')) b.disabled = sim;
      for (const b of painel.querySelectorAll('.resumo button')) b.disabled = sim;
    };

    /** So' a linha de baixo de cada item: onde fica, ou "você está aqui". */
    const pintarMarca = () => {
      pintarResumo();
      const agora = cacadaAtiva();
      for (const onde of lista.querySelectorAll('li small')) {
        if (onde.dataset.tipo === 'expedicao') onde.dataset.onde = legendaDaExpedicao();
        const aqui = mesmoLugar(agora, { nome: onde.dataset.cacada, tipo: onde.dataset.tipo });
        onde.textContent = aqui ? 'você está aqui' : onde.dataset.onde;
        onde.classList.toggle('agora', aqui);
      }
    };

    /**
     * A contagem da expedição anda de minuto a minuto, e so' ela.
     *
     * O relogio geral e' de dez minutos de proposito (reconstruir as linhas fecharia um select de
     * time aberto na cara de quem escolhe), e "abre em 1h25" parado dez minutos e' um numero
     * errado na tela. Entao este tique nao redesenha nada: reescreve o texto daquela linha.
     */
    setInterval(() => {
      for (const onde of lista.querySelectorAll('li small[data-tipo="expedicao"]'))
        if (!onde.classList.contains('agora')) onde.textContent = legendaDaExpedicao();
      pintarResumo();
    }, 60 * 1000);

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
      const aqui = mesmoLugar(agora, alvo);
      titulo.textContent = alvo.nome;
      titulo.title = alvo.nome;
      sub.textContent = aqui
        ? 'você está aqui'
        : alvo.tipo === 'expedicao'
          ? legendaDaExpedicao()
          : alvo.time
            ? `com o time "${alvo.time}"`
            : [alvo.regiao, alvo.modo].filter(Boolean).join(' · ');
      sub.classList.toggle('agora', aqui);
      // Ja' estando la', `Ir` so' teria sentido para montar o time — e para isso ha' a lista.
      ir.hidden = (aqui && !alvo.time) || alvo.tipo === 'expedicao';
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

    /** Sem acentos e em minusculas: quem escreve "lendarias" quer achar "Ilhas Lendárias". */
    const chao = (texto) =>
      String(texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

    /**
     * Quantas linhas se desenham de uma vez.
     *
     * A lista inteira do jogo sao 377 caçadas, e cada linha leva um `select` com os times:
     * desenhar tudo seria quase quatrocentos selects reconstruidos a cada repintura para mostrar
     * os vinte que caberiam na tela. O teto nao esconde nada — diz quantas ficaram de fora, e o
     * filtro alcança qualquer uma delas.
     */
    const TETO = 40;

    let filtro = '';

    /** O que fica a' vista: o filtro casa com o nome, com a regiao ou com o nivel. */
    const aMostrar = () => {
      const todas = todasConhecidas();
      const busca = chao(filtro).trim();
      if (!busca) return todas;
      return todas.filter(
        (c) =>
          chao(c.nome).includes(busca) ||
          chao(c.aba || c.regiao).includes(busca) ||
          (c.nivel ? String(c.nivel).startsWith(busca) : false),
      );
    };

    /** A linha de baixo de cada item. O UUID nao entra: ver `UUID`. */
    const legenda = (alvo) => {
      if (alvo.tipo === 'expedicao') return legendaDaExpedicao();
      const regiao = alvo.aba || (UUID.test(alvo.regiao || '') ? '' : alvo.regiao);
      return (
        [alvo.nivel ? `Lv ${alvo.nivel}` : '', regiao, alvo.modo, alvo.trancado ? 'trancada' : '']
          .filter(Boolean)
          .join(' · ') || 'sem região'
      );
    };

    /**
     * Duas linhas sao a mesma caçada.
     *
     * O nome continua a ser a chave — e' o unico elo entre as duas telas, como diz o cabeçalho —,
     * mas um nome repetido no jogo ("Nidorina", Lv 10 e Lv 37) desempata-se pelo nivel quando os
     * dois lados o sabem. Quem nao sabe o nivel casa com qualquer um, que e' o comportamento
     * antigo: um atalho guardado antes desta versao nao tem nivel nenhum.
     */
    const eMesma = (a, b) =>
      Boolean(a) &&
      Boolean(b) &&
      a.nome === b.nome &&
      (!a.nivel || !b.nivel || a.nivel === b.nivel);

    const desenhar = () => {
      // O resumo acompanha: `desenhar` corre depois de guardar, de apagar e de chegar a uma
      // cacada, e e' nessa ultima que o minimizado tem de passar a dizer "você está aqui".
      pintarResumo();
      const todas = aMostrar();
      const agora = cacadaAtiva();
      lista.innerHTML = '';
      if (!todas.length) {
        const vazio = document.createElement('p');
        vazio.className = 'vazio';
        vazio.textContent = filtro.trim()
          ? `Nada com "${filtro.trim()}".`
          : catalogo().zonas.length
            ? 'Nenhum atalho ainda. Entre numa caçada e clique em guardar.'
            : 'Ainda não li a lista de caçadas do jogo — clique em ↻.';
        lista.append(vazio);
        return;
      }
      const nomesDeTime = globalThis.PPX?.times?.nomes?.() || [];
      for (const alvo of todas.slice(0, TETO)) {
        const item = document.createElement('li');
        const cima = document.createElement('div');
        cima.className = 'cima';
        const rotulo = document.createElement('div');
        rotulo.className = 'rotulo';
        const nome = document.createElement('b');
        nome.textContent = alvo.nome;
        nome.title = alvo.nome;
        const onde = document.createElement('small');
        const aqui = mesmoLugar(agora, alvo);
        onde.dataset.cacada = alvo.nome;
        if (alvo.tipo) onde.dataset.tipo = alvo.tipo;
        onde.dataset.onde = legenda(alvo);
        onde.textContent = aqui ? 'você está aqui' : onde.dataset.onde;
        onde.classList.toggle('agora', aqui);
        rotulo.append(nome, onde);

        const ir = document.createElement('button');
        ir.type = 'button';
        ir.textContent = 'Ir';
        // Um botao que nao pode funcionar nao fica a fingir que pode: a expedição guarda-se para
        // ser reconhecida, e quem entra nela e' o jogador. As Ilhas Lendarias respondem
        // `locked: true` enquanto o treinador nao chega ao nivel delas, e a aba vem desativada.
        ir.disabled = alvo.tipo === 'expedicao' || alvo.trancado === true;
        ir.title =
          alvo.tipo === 'expedicao'
            ? 'Na expedição entra você'
            : alvo.trancado === true
              ? 'Esta região ainda está trancada para a sua conta'
              : `Ir para "${alvo.nome}"`;
        ir.addEventListener('click', () => void levar(alvo));

        const apagar = document.createElement('button');
        apagar.type = 'button';
        apagar.dataset.apagar = '';
        apagar.textContent = '×';
        // O que e' do jogo nao se esquece: a expedição estaria de volta na batida seguinte, e uma
        // caçada que veio da lista do jogo nunca foi guardada — nao ha' o que apagar.
        apagar.hidden = Boolean(alvo.fixa) || alvo.doJogo === true;
        apagar.title = `Esquecer "${alvo.nome}"`;
        apagar.addEventListener('click', () => {
          gravarLista(guardadas().filter((c) => !eMesma(c, alvo)));
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
          // **ESCOLHER UM TIME GUARDA A CAÇADA.** Ela pode ter vindo da lista do jogo, e dizer
          // "esta aqui monta o time X" e' precisamente o que distingue uma caçada que o dono usa
          // de uma que esta' no mapa. Guardar e' consequencia da escolha, nao um segundo passo.
          const todasMinhas = guardadas();
          const onde = todasMinhas.findIndex((c) => eMesma(c, alvo));
          if (onde >= 0) todasMinhas[onde] = { ...todasMinhas[onde], time: times.value };
          else todasMinhas.push(paraGuardar({ ...alvo, time: times.value }));
          gravarLista(todasMinhas);
          times.classList.toggle('sem-time', !times.value);
          dizer(
            times.value
              ? `"${alvo.nome}" passa a montar o time "${times.value}".`
              : `"${alvo.nome}" deixa de trocar o time.`,
          );
          // A linha mudou de lado — era do jogo, passou a ser atalho dele, e ganhou o ×.
          if (onde < 0) desenhar();
        });
        item.append(times);

        lista.append(item);
      }
      if (todas.length > TETO) {
        const conta = document.createElement('p');
        conta.className = 'conta';
        conta.textContent = `…e mais ${todas.length - TETO}. Escreva mais no filtro.`;
        lista.append(conta);
      }
    };

    campo('[data-filtro]').addEventListener('input', (evento) => {
      filtro = evento.target.value || '';
      desenhar();
    });

    campo('[data-atualizar]').addEventListener('click', () => garantirCatalogo(true));
    campo('[data-recarregar-times]').addEventListener('click', () => {
      desenhar();
      const quantos = globalThis.PPX?.times?.nomes?.().length || 0;
      if (quantos) celebrar(`${quantos} time(s) relido(s).`);
      else dizer('Nenhum time guardado foi encontrado.', true);
    });

    /** Guarda a cacada que esta' na tela. Regravar a mesma atualiza a regiao e o modo. */
    const guardarAtual = () => {
      const agora = cacadaAtiva();
      if (!agora) {
        dizer(
          'Você não está numa caçada nem na expedição — entre numa e eu guardo o atalho.',
          true,
        );
        return;
      }
      if (agora.tipo === 'expedicao') {
        celebrar('A expedição já está sempre na lista — não precisa de ser guardada.');
        return;
      }
      // O catalogo acrescenta o nivel e a aba ao que o HUD da'. Sem ele guarda-se como antes:
      // nome, regiao e modo bastam para achar a caçada varrendo as abas.
      const cheio = completar(agora);
      const todas = guardadas();
      const onde = todas.findIndex((c) => eMesma(c, cheio));
      // Regravar atualiza a regiao e o modo, mas **nao** mexe no time escolhido: guardar de novo e'
      // corrigir o endereco, nao desfazer a configuracao.
      if (onde >= 0) todas[onde] = paraGuardar({ ...cheio, time: todas[onde].time || '' });
      else todas.push(paraGuardar(cheio));
      gravarLista(todas);
      desenhar();
      celebrar(onde >= 0 ? `"${agora.nome}" atualizada.` : `"${agora.nome}" guardada.`);
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

    /**
     * Levar os atalhos para outra janela, num arquivo.
     *
     * Pedido do dono em 12/10/2026, e e' o caso de uso de sempre: cada janela do LionMultInstance
     * tem o seu `localStorage`, e guardar nove atalhos a mao numa conta nova e' nove viagens pelo
     * mapa — era exactamente para isso que a lista do jogo tinha sido lida.
     *
     * **O catalogo nao viaja.** Ele e' o retrato que a extensao tirou do jogo, nao escolha de
     * ninguem, e cada janela relê o seu em 24 horas (ou no ↻). E' a mesma regra que a Arena e a
     * venda seguem: entra o que a pessoa escolheu, fica o que a extensao descobriu.
     *
     * **A expedição tambem nao.** Ela e' uma entrada fixa, que `guardadas()` poe de volta sozinha
     * em qualquer conta; exporta-la seria mandar uma copia que envelhece.
     *
     * O que viaja de cada atalho e' o que `paraGuardar` deixa viver: nome, nivel, aba, regiao,
     * modo, tipo e time. O **nome do time** pode nao existir na conta que recebe — e nao se apaga
     * por isso: a lista ja' marca "(não guardado)" ao lado, e apagar em silencio seria pior do que
     * mostrar o que falta.
     */
    const botoesConfig = globalThis.PPX?.config?.montarBotoes({
      id: 'cacadas',
      nome: 'Caçadas',
      coletar: () => ({ atalhos: guardadas().filter((c) => !c.fixa).map(paraGuardar) }),
      aplicar: (dados) => {
        if (indo) throw new Error('não dá para importar no meio de uma ida — espere ela acabar');
        const vindos = Array.isArray(dados?.atalhos) ? dados.atalhos : null;
        if (!vindos) throw new Error('esse arquivo não tem lista de caçadas');
        // Cem e' muito mais do que os nove da conta real e muito menos do que um arquivo montado
        // para encher o armazenamento. Um nome vazio nao e' um atalho, e um nome repetido so'
        // existiria para confundir quem olha a lista.
        const vistos = new Set();
        const limpos = [];
        for (const c of vindos.slice(0, 100)) {
          const nome = String(c?.nome ?? '').trim().slice(0, 80);
          if (!nome || vistos.has(nome) || c?.tipo === 'expedicao') continue;
          vistos.add(nome);
          limpos.push(paraGuardar({ ...c, nome }));
        }
        if (!limpos.length) throw new Error('não achei nenhuma caçada guardada nesse arquivo');
        gravarLista(limpos);
        desenhar();
        // Quem anuncia e' o `config.js`, com o que esta funcao devolver: dizer aqui **e** la' daria
        // duas frases para a mesma importação, e a segunda apagaria a primeira.
        return limpos.length === 1
          ? 'Importei 1 caçada guardada.'
          : `Importei ${limpos.length} caçadas guardadas.`;
      },
      avisar: dizer,
    });
    if (botoesConfig) campo('[data-config]').append(botoesConfig.el);

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
      // A extensao arranca antes de o jogo publicar a `Api`: a leitura da lista costuma falhar na
      // primeira tentativa, e esta e' a segunda — sem custo, porque so' tenta se faltar.
      if (sim) garantirCatalogo(false);
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
    // Alt+W esconde, Alt+E mostra — vizinhas, como nas outras ferramentas.
    //
    // **ERA Alt+R, e deixou de ser.** O proprio LionMultInstance usa Alt+R para restaurar a grade
    // das views, e ele escuta a tecla por fora da pagina: a extensao nao tem como ganhar essa
    // disputa, e nem devia tentar. Quem escondia uma cacada rearranjava a janela inteira junto.
    addEventListener('keydown', (evento) => {
      if (!evento.altKey || evento.ctrlKey || evento.metaKey) return;
      if (evento.code === 'KeyW') {
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
    garantirCatalogo(false);
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

        /**
         * Tudo o que esta ferramenta conhece: os atalhos do dono **mais** a lista do jogo.
         *
         * Separada de `nomes()` de proposito. `nomes()` sao os atalhos dele — curta, na ordem em
         * que ele os guardou, e e' ela que serve a quem quer oferecer "as suas caçadas". Isto sao
         * as 377, e so' serve a quem tem como filtrar: despejar 377 opcoes num `select` nao e'
         * uma escolha, e' uma busca sem campo de busca.
         *
         * Cada uma diz o nivel e a regiao, porque e' por ai' que se escolhe onde upar, e diz se
         * da' para abrir — regiao trancada e expedição nao dao.
         */
        todas: () =>
          todasConhecidas().map((c) => ({
            nome: c.nome,
            nivel: c.nivel || 0,
            regiao: c.aba || (UUID.test(c.regiao || '') ? '' : c.regiao || ''),
            tipo: c.tipo || 'cacada',
            trancada: c.trancado === true,
            minha: c.doJogo !== true,
          })),
        atual: () => cacadaAtiva(),
        atualizar: relerCatalogo,

        /**
         * Que time esta caçada monta ao chegar — `''` quando ela nao monta nenhum.
         *
         * NAO E' UM SEGUNDO DONO DO TIME: quem monta continua a ser esta ferramenta, aqui, e
         * ninguem de fora escolhe time nenhum por ela. Isto so' **conta** o que esta' guardado, e
         * existe por causa de uma coisa medida no jogo em 12/10/2026: a Escada trocou o time no fim
         * da escada, reiniciou, viajou para o primeiro degrau — e a viagem remontou o time guardado
         * na caçada, apagando o que ela acabara de montar. A escada ficou a dizer "o aluno não está
         * na equipe desta caçada", que era verdade e nao dizia porque'.
         *
         * Com isto ela diz o porque' e o que fazer. Continua sem poder mudar nada disto.
         */
        timeDe: (nome) => todasConhecidas().find((c) => c.nome === nome)?.time || '',

        /**
         * Se da' para esta ferramenta levar o jogador ate' la'.
         *
         * Hoje so' a expedição diz que nao. Quem automatiza precisa de saber isto **antes** de
         * tentar, para poder escolher outro lugar da lista em vez de bater na porta e falhar.
         */
        daParaIr: (nome) => {
          const alvo = todasConhecidas().find((c) => c.nome === nome);
          return alvo?.tipo !== 'expedicao' && alvo?.trancado !== true;
        },

        /**
         * O nivel daquela caçada, ou `0` quando o catalogo ainda nao foi lido.
         *
         * Serve para quem escolhe onde upar: o nivel da caçada e' o que decide se ela presta para
         * um Pokemon ou se ela o leva a apanhar porrada. Nome repetido devolve o primeiro, e e' por
         * isso que isto nao e' endereço de nada — e' informacao para ler.
         */
        nivelDe: (nome) => todasConhecidas().find((c) => c.nome === nome)?.nivel || 0,

        /** Se o jogador esta' naquele lugar agora — a expedição casa por tipo, nao por nome. */
        estouEm: (nome) =>
          mesmoLugar(
            cacadaAtiva(),
            todasConhecidas().find((c) => c.nome === nome),
          ),
        ir: async (nome) => {
          const alvo = todasConhecidas().find((c) => c.nome === nome);
          if (!alvo) return { ok: false, erro: `não conheço nenhuma caçada chamada "${nome}"` };
          mostrarPainel(true);
          if (indo) return { ok: false, erro: 'já há uma ida em andamento' };
          travar(true);
          try {
            // Mesmo caminho do botao, inclusive o time: quem chama de fora nao pode receber um
            // comportamento diferente do que a interface mostra.
            const time = await montarTime(alvo.time, (t) => dizer(t));
            if (!time.ok)
              return { ok: false, erro: `não montei o time "${alvo.time}": ${time.erro}` };
            // **E diz-se como acabou.** Pelo botao, quem fala no fim e' o `levar`; por aqui nao
            // falava ninguem, e o painel ficava com o "Entrando em …" do meio do caminho para
            // sempre. Visto no jogo em 12/10/2026: a ida acabou bem, e o painel parecia travado.
            const r = await irPara(alvo, (t) => dizer(t));
            if (r.ok) celebrar(`Caçando em "${alvo.nome}".`);
            else dizer(`Parei: ${r.erro}`, true);
            return r;
          } finally {
            travar(false);
            desenhar();
          }
        },
      };
    }
  },
);
