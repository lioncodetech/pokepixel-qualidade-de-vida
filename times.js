// PokePixel - times
//
// Guarda composicoes de equipe e troca para uma delas num clique.
//
// Tudo aqui passa pela interface do jogo: abre o inventario, da' duplo clique nos Pokemon e usa os
// botoes de ordem do painel de equipe. Nada e' pedido ao servidor por fora. Isso nao e' escrupulo,
// e' o que faz funcionar: o proprio jogo avisa que "o limite de nivel e a posse sao validados pelo
// servidor", entao forcar o DOM nao adiantaria nada.
//
// MEDIDO NO JOGO (sessao de 2026-10-05, conta com 17 Pokemon):
//
// - abrir o inventario ....................... 33 ms
// - abrir Jogador > Equipe ................... 1081 ms
// - tirar do time (duplo clique) ............. 1444 ms
// - por no time (duplo clique) ............... 953 ms
// - mover uma posicao na ordem ............... 7-9 ms
//
// Tirar e por passam pelo servidor e levam cerca de um segundo cada; a ordem e' instantanea, mas
// persiste (confirmado com F5). Por isso cada passo aqui espera o jogo confirmar antes do proximo.
// Clicar sem esperar nao e' so' lento: durante o levantamento, uma sequencia rapida de cliques
// derrubou a pagina com "Cannot read properties of null". Nenhum passo deste arquivo e' disparado
// as cegas.
//
// POR QUE O UUID, E NAO O NOME. Cada Pokemon carrega `data-creature-id` no inventario e no HUD, e
// e' o mesmo id nos dois. A conta onde isto foi levantado tinha **dois Tyranitar** - um Nv.203 no
// time e um Nv.151 fora. Guardar por nome teria trocado um pelo outro na primeira aplicacao.

/**
 * O caminho de passos que leva da equipe atual ate' a guardada.
 *
 * Esta funcao nao toca no DOM de proposito: ela e' a unica parte da ferramenta que pode ser
 * conferida numa mesa, e e' justamente onde mora a regra chata do jogo.
 *
 * O impasse que ela resolve e' a troca completa, seis por seis. O jogo nao deixa remover o Pokemon
 * ativo e nao deixa passar de seis. Entao, com os seis saindo e seis entrando:
 *
 *   1. ninguem do time novo esta' na equipe ainda, logo nao ha' para quem passar a lideranca;
 *   2. saem os cinco que nao sao o ativo, e a equipe fica com um so';
 *   3. entram cinco dos novos — a equipe volta a seis e **o sexto nao cabe**;
 *   4. agora ha' alguem do time novo la' dentro: ele assume a lideranca;
 *   5. o ativo antigo finalmente pode sair, e o sexto entra.
 *
 * Era o passo 4 que faltava quando a troca parava com "o ultimo nao entra".
 *
 * @param {string[]} equipeAtual ids na equipe agora
 * @param {string} chefeAtual id do Pokemon ativo
 * @param {string[]} desejados ids do time guardado
 */
const planoDeTroca = (equipeAtual, chefeAtual, desejados) => {
  const MAX = 6;
  let equipe = [...equipeAtual];
  let chefe = chefeAtual;
  const passos = [];
  const sobra = () => equipe.filter((id) => !desejados.includes(id));
  const falta = () => desejados.filter((id) => !equipe.includes(id));

  for (let volta = 0; volta < 20; volta += 1) {
    if (!sobra().length && !falta().length) break;
    let mexeu = false;

    // O ativo nao sai. Se ele esta' de saida, alguem que fica assume primeiro — e so' existe
    // alguem assim depois que a primeira leva de entradas aconteceu.
    if (sobra().includes(chefe)) {
      const herdeiro = equipe.find((id) => desejados.includes(id) && id !== chefe);
      if (herdeiro) {
        passos.push({ acao: 'lider', id: herdeiro });
        chefe = herdeiro;
        mexeu = true;
      }
    }
    for (const id of sobra())
      if (id !== chefe) {
        passos.push({ acao: 'tirar', id });
        equipe = equipe.filter((x) => x !== id);
        mexeu = true;
      }
    for (const id of falta()) {
      if (equipe.length >= MAX) break;
      passos.push({ acao: 'por', id });
      equipe = [...equipe, id];
      mexeu = true;
    }

    // Sem nenhum movimento possivel nesta volta, insistir so' repetiria a mesma conta.
    if (!mexeu) break;
  }
  return { passos, equipe, chefe, resolvido: !sobra().length && !falta().length };
};

// Exposto so' para o teste de mesa em `testes/`. No navegador `module` nao existe e esta linha
// nao faz nada.
if (typeof module !== 'undefined') module.exports = { planoDeTroca };


PPX.modulo(
  {
    id: 'times',
    nome: 'Times',
    atalhos: 'Alt+T esconde · Alt+Y mostra',
  },
  () => {
    'use strict';

    const CHAVE_TIMES = 'lioncode:times:guardados';
    const CHAVE_POS = 'lioncode:times:posicao';
    const CHAVE_TAM = 'lioncode:times:tamanho';
    const CHAVE_COMPACTO = 'lioncode:times:compacto';

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

    /** O modo compacto escolhido da ultima vez; ver `aplicarModo`. */
    let compacto = ler(CHAVE_COMPACTO, false) === true;

    const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

    // ---------------------------------------------------------------- ritmo
    //
    // A troca inteira ocupa entre 20 e 30 s, sorteados a cada uso. Sao duas razoes na mesma medida:
    // uma rajada de cliques em milissegundos nao se parece com ninguem jogando, e foi a sequencia
    // sem respiro que derrubou a pagina numa prova real.
    //
    // O espacamento e' calculado, nao fixo: a cada passo se divide o tempo que resta do orcamento
    // pelos passos que ainda faltam, com um desvio sorteado para a cadencia nao sair de metronomo.
    // Assim se adapta sozinho — o jogo leva perto de 1,2 s por troca (medido: 1444 ms para tirar,
    // 953 ms para por), e se ele estiver lento as pausas encolhem em vez de a operacao estourar.

    const ALVO_MINIMO = 20000;
    const ALVO_MAXIMO = 30000;
    /** Nunca instantaneo, nem parado tanto tempo que pareca travado. */
    const PAUSA_MINIMA = 180;
    const PAUSA_MAXIMA = 3500;

    const sorteio = (de, ate) => de + Math.random() * (ate - de);

    /** Instante em que a troca em curso deveria terminar; definido no inicio de `aplicar`. */
    let fimPrevisto = 0;

    /** Uma pausa do tamanho do tempo que resta dividido pelos passos que faltam. */
    const respirar = async (passosQueFaltam) => {
      const resta = fimPrevisto - Date.now();
      const justo = resta / Math.max(1, passosQueFaltam);
      await espera(
        Math.round(Math.min(PAUSA_MAXIMA, Math.max(PAUSA_MINIMA, justo * sorteio(0.65, 1.35)))),
      );
    };

    /**
     * Espera uma condicao virar verdadeira, devolvendo quanto demorou — ou `null` se desistiu.
     *
     * Devolver o tempo em vez de so' `true` permite que a falha diga "esperei 6 s e nada mudou",
     * que e' a diferenca entre um aviso util e um "nao funcionou".
     */
    const ate = async (condicao, limite) => {
      const inicio = Date.now();
      for (;;) {
        if (condicao()) return Date.now() - inicio;
        if (Date.now() - inicio >= limite) return null;
        await espera(60);
      }
    };

    // ---------------------------------------------------------------- o jogo

    /**
     * O elemento esta' na tela?
     *
     * Por `getBoundingClientRect`, e **nao** por `isConnected`: uma janela fechada continua no DOM,
     * invisivel, com caixa zerada. Confundir as duas coisas originou o defeito que `fechar` conserta.
     */
    const visivel = (el) => Boolean(el) && el.getBoundingClientRect().width > 0;

    /**
     * O elemento visivel dentro de `onde` cujo texto e' exatamente `rotulo`; vence o mais fundo.
     *
     * Emprestado de `loja-rapida.js`, pela mesma razao que ela o tem: a aba mostra o rotulo no
     * botao e outra vez num elemento interno, e e' o de dentro que casa exatamente. Clicar nele
     * serve igual, porque o clique sobe ate' quem escuta.
     */
    const alvoComTexto = (onde, rotulo) => {
      const casam = [...onde.querySelectorAll('button, a, li, div, span, p')].filter(
        (e) => (e.textContent || '').trim() === rotulo && visivel(e),
      );
      return casam[casam.length - 1] ?? null;
    };

    const HUD = '.pokeidle-team-card[data-creature-id]';
    const INVENTARIO = '.inventory-slot--pokemon';
    const PAINEL_EQUIPE = '.pokeidle-team-panel';

    /** A equipe como o HUD mostra: esta' sempre na tela, entao ler nao abre janela nenhuma. */
    const doHud = () =>
      [...document.querySelectorAll(HUD)].map((cartao) => ({
        id: cartao.dataset.creatureId,
        nome: (cartao.querySelector('.pokeidle-team-card__name')?.textContent || '').trim(),
        nivel: (
          cartao.querySelector('.pokeidle-team-card__level, .pokeidle-team-card__compact-level')
            ?.textContent || ''
        ).trim(),
        lider: cartao.classList.contains('is-leader'),
      }));

    const slotDoInventario = (id) =>
      document.querySelector(`${INVENTARIO}[data-creature-id="${CSS.escape(id)}"]`);

    /**
     * Quem esta' na equipe, segundo o HUD — e nao segundo o inventario.
     *
     * Esta escolha e' o conserto de um defeito que custou um Pokemon do time numa prova real. O
     * inventario pinta a grade em etapas: as celulas entram antes de a classe `is-equipped` ser
     * aplicada, e a mochila ainda reabre na ultima categoria usada, escondendo parte da lista. Ler
     * dali cedo demais fazia a ferramenta concluir que um Pokemon que ESTAVA na equipe estava fora.
     *
     * Isso seria inofensivo se o duplo clique adicionasse. Mas ele **alterna**: agir sobre essa
     * conclusao errada tirou da equipe exatamente quem deveria ficar.
     *
     * O HUD nao tem esse problema. Ele esta' sempre no DOM, nao tem abas, nao filtra, e foi
     * conferido contra o inventario no levantamento: os mesmos seis ids, o mesmo `data-creature-id`.
     * O inventario continua sendo necessario — e' onde se clica —, mas quem **manda** e' o HUD.
     */
    const idsNaEquipe = () => doHud().map((p) => p.id);
    /** O id do Pokemon ativo, ou vazio quando o HUD ainda nao desenhou. */
    const liderAgora = () => doHud().find((p) => p.lider)?.id || '';
    const noTime = (id) => idsNaEquipe().includes(id);

    /**
     * Um clique como o jogo espera receber: a sequencia inteira de ponteiro, nao so' `click()`.
     *
     * Nao e' preciosismo. O `✕` que fecha as janelas do jogo e' um `div` com caixa de **0x0** — foi
     * medido —, e um `element.click()` nele nao fecha nada. Painel que fica aberto conta para o
     * limite do jogo, e a abertura seguinte falha.
     *
     * Isto **nao** era o defeito que aparecia "depois de usar umas tres vezes": aquele era o
     * oposto — um clique a mais num `✕` de janela que ja' tinha fechado. Ver `fechar`.
     *
     * Houve aqui um `vezes` para o duplo clique do inventario. Saiu junto com ele: equipar e
     * desequipar passaram a ser acoes escritas no cartao do botao direito. Ver `alternar`.
     */
    const clicar = (el) => {
      const caixa = el.getBoundingClientRect();
      // Caixa zerada nao tem centro util; manda-se no canto que ela ocupa, que e' onde o jogo
      // posicionou o elemento.
      const x = caixa.left + caixa.width / 2;
      const y = caixa.top + caixa.height / 2;
      const base = {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        clientX: x,
        clientY: y,
        button: 0,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
      };
      el.dispatchEvent(new PointerEvent('pointerover', { ...base, buttons: 0 }));
      el.dispatchEvent(new MouseEvent('mouseover', { ...base, buttons: 0 }));
      el.dispatchEvent(new PointerEvent('pointerdown', { ...base, buttons: 1 }));
      el.dispatchEvent(new MouseEvent('mousedown', { ...base, buttons: 1, detail: 1 }));
      el.dispatchEvent(new PointerEvent('pointerup', { ...base, buttons: 0 }));
      el.dispatchEvent(new MouseEvent('mouseup', { ...base, buttons: 0, detail: 1 }));
      el.dispatchEvent(new MouseEvent('click', { ...base, buttons: 0, detail: 1 }));
    };

    /**
     * O clique com o botao direito, que abre o cartao do Pokemon fixado na tela.
     *
     * `contextmenu` sozinho nao basta: o jogo acompanha o `pointerdown`/`mousedown` com
     * `button: 2` antes dele, como faria um rato de verdade.
     */
    const botaoDireito = (el) => {
      const caixa = el.getBoundingClientRect();
      const base = {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        clientX: caixa.left + caixa.width / 2,
        clientY: caixa.top + caixa.height / 2,
        button: 2,
        buttons: 2,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
      };
      el.dispatchEvent(new PointerEvent('pointerover', { ...base, buttons: 0 }));
      el.dispatchEvent(new MouseEvent('mouseover', { ...base, buttons: 0 }));
      el.dispatchEvent(new PointerEvent('pointerdown', base));
      el.dispatchEvent(new MouseEvent('mousedown', base));
      el.dispatchEvent(new MouseEvent('contextmenu', base));
      el.dispatchEvent(new PointerEvent('pointerup', { ...base, buttons: 0 }));
      el.dispatchEvent(new MouseEvent('mouseup', { ...base, buttons: 0 }));
    };

    const CARTAO = 'aside.pokemon-card--pinned';

    /**
     * Fecha todos os cartoes fixados.
     *
     * Existe porque o cartao **nao diz de quem e'**: ele traz `data-element`, nunca o
     * `data-creature-id`. Com dois cartoes na tela nao ha' como saber em qual se vai clicar, e com
     * dois Tyranitar na conta o erro seria invisivel. Entao fecha-se tudo antes de abrir um, e
     * confere-se que ficou exatamente um.
     */
    const fecharCartoes = async () => {
      for (const cartao of document.querySelectorAll(CARTAO)) {
        const x = cartao.querySelector('.pokemon-card__control.is-close');
        if (x) {
          x.click();
          await espera(200);
        }
      }
      return document.querySelectorAll(CARTAO).length === 0;
    };

    /**
     * O jogo esta' recusando abrir janelas?
     *
     * Este estado existe: o gerenciador de janelas do jogo passa a recusar tudo, as vezes com o
     * aviso "Não foi possível abrir esta janela agora.", as vezes calado, e so' o F5 devolve.
     *
     * A causa conhecida e' clicar no `✕` de uma janela que ja' nao esta' na tela, e esta ferramenta
     * nao faz mais isso — ver `fechar`. A rede fica por dois motivos: um menu da barra aberto
     * tambem provoca a recusa, e nao ha' garantia de que estas sejam as unicas causas. Quando
     * acontecer, o certo e' nao insistir e dizer o que esta' acontecendo, em vez de falhar como se
     * o time guardado estivesse errado.
     */
    const jogoRecusandoJanelas = () =>
      document.body.innerText.includes('Não foi possível abrir esta janela');

    const janelaPorTitulo = (regex) =>
      [...document.querySelectorAll('.pokeidle-panel')].find((p) =>
        regex.test((p.querySelector('.pokeidle-panel__title')?.textContent || '').trim()),
      );

    /**
     * Poe o inventario na aba onde os Pokemon aparecem.
     *
     * A mochila guarda a ultima categoria usada e reabre nela. Com ela deixada em "Boosters" nao ha'
     * uma unica celula de Pokemon na tela, e a ferramenta concluia que o time guardado tinha sumido
     * da mochila — uma mensagem errada sobre um problema que nao existia.
     *
     * A licao e' exatamente a que `loja-rapida.js` ja' trazia sobre as abas da loja ("a loja guarda
     * a ultima aberta"), e foi ignorada aqui pela segunda vez no mesmo pacote.
     *
     * "Pokémon" e' a preferida por ser a lista curta; "Todos" fica de reserva. Trocar de aba nao
     * abre janela nenhuma, entao nao ha' risco nenhum para o gerenciador de janelas do jogo.
     */
    const abaDePokemon = async (janela) => {
      if (document.querySelector(INVENTARIO)) return true;
      const aba = alvoComTexto(janela, 'Pokémon') || alvoComTexto(janela, 'Todos');
      if (!aba) return false;
      aba.click();
      // Esperar a celula aparecer, e nao uma classe de "aba ativa": essa classe nao foi medida, e
      // o que importa e' haver Pokemon na grade.
      return (await ate(() => document.querySelectorAll(INVENTARIO).length > 0, 5000)) !== null;
    };

    /** Abre o inventario e so' devolve quando as celulas de Pokemon ja' existem. */
    const abrirInventario = async () => {
      let janela = janelaPorTitulo(/Invent/i);
      // Janela ja' aberta nao se reabre: o botao da barra alterna, e clicar nele aqui a fecharia.
      if (!visivel(janela)) {
        const botao = document.querySelector('.pokeidle-top-toolbar__btn[data-menu-id="inventory"]');
        if (!botao) return false;
        botao.click();
        // A janela aparece em ~33 ms; o conteudo dela demora mais, e e' esperado logo abaixo.
        if ((await ate(() => visivel(janelaPorTitulo(/Invent/i)), 8000)) === null) return false;
        janela = janelaPorTitulo(/Invent/i);
      }
      if (!(await abaDePokemon(janela))) return false;
      await gradeEstavel();
      return document.querySelectorAll(INVENTARIO).length > 0;
    };

    /**
     * Espera a grade da mochila parar de crescer.
     *
     * A mochila reabre na ultima categoria usada e pinta em etapas — a mesma licao que a loja
     * rapida ja' tinha aprendido e que esta ferramenta ignorou na primeira versao. Nao basta haver
     * celulas: e' preciso que tenham parado de aparecer, senao a leitura sai pela metade.
     */
    const gradeEstavel = async () => {
      let anterior = -1;
      for (let voltas = 0; voltas < 20; voltas += 1) {
        const agora = document.querySelectorAll(INVENTARIO).length;
        if (agora === anterior && agora > 0) return true;
        anterior = agora;
        await espera(200);
      }
      return false;
    };

    /**
     * Abre o painel de equipe pelo menu Jogador.
     *
     * Pelo `+` de um slot vazio tambem abre, mas so' existe `+` com o time incompleto — e o caso
     * que mais importa aqui e' justamente o time cheio. O prazo e' generoso porque os seis slots
     * so' apareceram em ~1,1 s na medicao.
     */
    const abrirEquipe = async () => {
      if (document.querySelectorAll(`${PAINEL_EQUIPE} .team-slot`).length >= 6) return true;
      const jogador = document.querySelector('.pokeidle-top-toolbar__btn[data-menu-id="player"]');
      if (!jogador) return false;
      jogador.click();
      const item = await ate(
        () => document.querySelector('.pokeidle-top-toolbar__dropdown-btn[aria-label="Equipe"]'),
        3000,
      );
      try {
        if (item === null) return false;
        document.querySelector('.pokeidle-top-toolbar__dropdown-btn[aria-label="Equipe"]').click();
        return (
          (await ate(
            () => document.querySelectorAll(`${PAINEL_EQUIPE} .team-slot`).length >= 6,
            8000,
          )) !== null
        );
      } finally {
        // Sempre, inclusive quando deu errado — ver `fecharMenus`.
        await fecharMenus();
      }
    };

    /**
     * Fecha qualquer menu da barra de cima que tenha ficado aberto.
     *
     * Esta funcao e' o conserto do defeito que aparecia "depois de usar umas tres vezes": clicar em
     * "Equipe" **nao** fecha o menu do Jogador. Com um menu aberto, o jogo recusa abrir qualquer
     * janela e responde "Não foi possível abrir esta janela agora." — medido: com o menu aberto, o
     * inventario nao abria; com ele fechado, abria.
     *
     * O sinal e' o `aria-expanded` do gatilho, e nao a presenca de `.pokeidle-top-toolbar__dropdown`
     * no DOM: cada grupo da barra tem o seu, sempre, abertos ou nao. Foi por olhar o elemento em vez
     * do atributo que eu conclui, errado, que fechar o menu nao resolvia.
     */
    const fecharMenus = async () => {
      for (let volta = 0; volta < 4; volta += 1) {
        const gatilho = document.querySelector(
          '.pokeidle-top-toolbar__btn[aria-expanded="true"]',
        );
        if (!gatilho) return true;
        gatilho.click();
        await espera(250);
      }
      return !document.querySelector('.pokeidle-top-toolbar__btn[aria-expanded="true"]');
    };

    /**
     * Fecha uma janela do jogo. **Um clique, nunca dois.**
     *
     * Aqui morava o defeito que aparecia "depois de usar umas tres vezes". A versao anterior
     * tentava ate' tres vezes e media o sucesso por `janela.isConnected` — e a janela fechada
     * **continua conectada**, invisivel, com o `✕` dentro dela. O criterio nunca se satisfazia,
     * entao vinha um segundo clique num `✕` de janela que ja' nao estava na tela, e e' exatamente
     * isso que deixa o jogo convencido de que ha' uma janela aberta: dali em diante ele recusa
     * qualquer abertura — com ou sem o aviso "Não foi possível abrir esta janela agora." — ate'
     * um F5. Era a propria ferramenta causando o travamento que depois relatava.
     *
     * A medicao nao e' nova: `venda-rapida.js` e `loja-rapida.js` ja' a traziam escrita no
     * comentario de `fecharPopups` — "fechar o inventario e clicar no X dele de novo basta". Eu
     * reinventei o defeito por nao ter lido o que o pacote ja' sabia.
     *
     * Dai' as duas regras: o criterio e' a janela **sair da tela**, nao sair do DOM; e nao existe
     * segunda tentativa. Se o clique nao fechou, insistir e' pior do que falhar.
     *
     * `Escape` fecha a loja mas **nao** fecha o painel de equipe — testado. O que fecha os dois e'
     * o `✕` da barra de titulo, que e' um `div`, nao um `button`.
     */
    const fechar = async (janela) => {
      if (!visivel(janela)) return true;
      const botao = janela.querySelector('.pokeidle-panel__close');
      if (!botao) return false;
      clicar(botao);
      return (await ate(() => !visivel(janela), 2500)) !== null;
    };

    // ------------------------------------------------------------- aplicar

    let aplicando = false;
    let cancelado = false;

    /**
     * Troca a equipe atual pela guardada.
     *
     * A ordem das operacoes nao e' estetica, e' imposta por tres regras do jogo descobertas no
     * levantamento:
     *
     * 1. **O Pokemon ativo nao pode ser removido** — o botao vem desabilitado dizendo "Escolha
     *    outro Pokemon para poder remover este". Entao a lideranca muda antes das remocoes.
     * 2. **O time trava em 6**, logo remover vem antes de adicionar. Fazer ao contrario falharia
     *    em silencio na primeira adicao.
     * 3. **Espécie nao repete.** Se o time guardado tiver uma especie que o jogo recusa, a adicao
     *    simplesmente nao acontece — por isso cada passo e' conferido e o que falhou e' nomeado.
     */
    async function aplicar(time, contar) {
      const desejados = time.membros.map((m) => m.id);
      const nomeDe = (id) =>
        time.membros.find((m) => m.id === id)?.nome ||
        (slotDoInventario(id)?.getAttribute('aria-label') || '').split(',')[0] ||
        id.slice(0, 8);

      const sobrando = () => idsNaEquipe().filter((id) => !desejados.includes(id));
      const faltam = () => desejados.filter((id) => !idsNaEquipe().includes(id));

      if (!sobrando().length && !faltam().length) {
        contar('A equipe já é essa.');
        return { trocados: 0 };
      }

      // Um menu da barra aberto — deixado por uma tentativa anterior, ou pelo proprio usuario —
      // faz o jogo recusar abrir qualquer janela. Comecar sem fechar isso daria "não consegui abrir
      // o inventário" sem dizer o verdadeiro motivo.
      await fecharMenus();

      // O prazo da operacao inteira, sorteado agora. Tudo o que vem depois se espaca contra ele.
      fimPrevisto = Date.now() + sorteio(ALVO_MINIMO, ALVO_MAXIMO);

      contar('Abrindo o inventário…');
      if (!(await abrirInventario()))
        throw new Error(
          jogoRecusandoJanelas()
            ? 'o jogo parou de abrir janelas. Recarregue a página (F5) e tente de novo — a equipe não foi alterada'
            : 'não consegui abrir o inventário',
        );
      const inventario = janelaPorTitulo(/Invent/i);

      const faltando = desejados.filter((id) => !slotDoInventario(id));
      if (faltando.length)
        throw new Error(
          `${faltando.length === 1 ? 'não está' : 'não estão'} mais na mochila: ${faltando
            .map(nomeDe)
            .join(', ')}`,
        );

      let trocados = 0;

      // O plano e' refeito a cada passo, e so' o primeiro passo dele e' executado.
      //
      // Poderia ser calculado uma vez e seguido de ponta a ponta — e seria mais curto. Mas aí
      // qualquer diferenca entre o que a ferramenta imagina e o que o jogo fez se acumularia ate' o
      // fim da fila. Replanejando contra o HUD a cada passo, um passo que nao saiu como esperado e'
      // simplesmente recalculado na volta seguinte, com o estado real.
      for (let volta = 0; volta < 40; volta += 1) {
        if (cancelado) break;
        const { passos } = planoDeTroca(idsNaEquipe(), liderAgora(), desejados);
        if (!passos.length) break;
        const passo = passos[0];
        if (passo.acao === 'lider') {
          contar(`Passando a liderança para ${nomeDe(passo.id)}…`);
          if (!(await tornarLider(passo.id)))
            throw new Error(`não consegui tornar ${nomeDe(passo.id)} ativo`);
          continue;
        }
        contar(`${passo.acao === 'por' ? 'Colocando' : 'Tirando'} ${nomeDe(passo.id)}…`);
        await alternar(passo.id, passo.acao === 'por', nomeDe);
        trocados += 1;
        // Nao se respira depois do ultimo passo: a pausa e' espacamento entre acoes, e esticar o
        // fim so' faria a tela ficar parada dizendo "pronto" com atraso.
        if (planoDeTroca(idsNaEquipe(), liderAgora(), desejados).passos.length)
          await respirar(passos.length);
      }

      const restou = cancelado ? [] : sobrando();
      const naoEntrou = cancelado ? [] : faltam();
      await fechar(inventario);
      if (cancelado) return { trocados, parado: true };

      if (restou.length) throw new Error(`não consegui tirar ${restou.map(nomeDe).join(', ')} da equipe`);
      if (naoEntrou.length)
        throw new Error(
          `não consegui colocar ${naoEntrou.map(nomeDe).join(', ')} — pode ser espécie repetida ou limite de nível`,
        );

      // A ordem exige abrir o painel de equipe, que e' mais uma janela. Como abrir janelas em
      // sequencia e' justamente o que adoece o jogo, so' se abre quando ha' o que corrigir.
      if (time.ordem?.length && !cancelado) {
        contar('Acertando a ordem de batalha…');
        await arrumarOrdem(time.ordem, contar);
      }
      if (time.lider && liderAgora() !== time.lider) {
        contar(`Deixando ${nomeDe(time.lider)} ativo…`);
        await tornarLider(time.lider);
      }
      return { trocados };
    }

    /**
     * Tira ou poe um Pokemon, pela acao escrita no cartao do botao direito.
     *
     * **Nao e' mais o duplo clique.** O duplo clique funcionava para quase todos, mas tinha dois
     * defeitos, um deles descoberto em cima da equipe de verdade:
     *
     * 1. **No Ditto ele faz outra coisa.** Abre o menu de transformacao, nao equipa. Relatado pelo
     *    usuario; a conta usada no levantamento nao tinha Ditto, entao este caminho nunca aparecia.
     * 2. **Ele alterna.** Nao existe "poe" nem "tira": existe "inverte". Uma leitura errada do
     *    estado nao custava um passo perdido, custava o passo contrario — foi assim que um Ivysaur
     *    saiu da equipe numa prova real.
     *
     * O botao direito abre um cartao com a acao **escrita**: `is-equip` em quem esta' fora,
     * `is-unequip` em quem esta' dentro. Pedir "equipar" nao pode tirar ninguem, e se a acao que
     * se espera nao estiver no cartao, nada acontece e o erro diz o que havia ali. O cartao se
     * fecha sozinho depois da acao — medido no jogo.
     */
    async function alternar(id, entrar, nomeDe) {
      if (noTime(id) === entrar) return;
      const slot = slotDoInventario(id);
      if (!slot) throw new Error(`${nomeDe(id)} sumiu da mochila no meio da troca`);

      await fecharCartoes();
      botaoDireito(slot);
      if ((await ate(() => document.querySelectorAll(CARTAO).length === 1, 4000)) === null) {
        await fecharCartoes();
        throw new Error(`o cartão de ${nomeDe(id)} não abriu com o botão direito`);
      }

      const cartao = document.querySelector(CARTAO);
      const acao = cartao.querySelector(
        entrar ? '.pokemon-card__action.is-equip' : '.pokemon-card__action.is-unequip',
      );
      if (!acao) {
        // Dizer o que o cartao oferecia e' o que separa um aviso util de um "nao funcionou": no
        // Ditto, por exemplo, e' aqui que apareceria uma acao de transformacao.
        const havia = [...cartao.querySelectorAll('.pokemon-card__action')]
          .map((a) => (a.textContent || '').replace(/[^\p{L} ]/gu, '').trim())
          .filter(Boolean)
          .join(', ');
        await fecharCartoes();
        throw new Error(
          `o cartão de ${nomeDe(id)} não tem "${entrar ? 'Equipar' : 'Desequipar'}"` +
            (havia ? ` — tem ${havia}` : ''),
        );
      }

      acao.click();
      // Tirar levou 1444 ms e por 953 ms na medicao; 8 s cobre uma conexao ruim sem travar a tela.
      const demorou = await ate(() => noTime(id) === entrar, 8000);
      if (demorou === null) {
        await fecharCartoes();
        throw new Error(
          `o jogo não ${entrar ? 'colocou' : 'tirou'} ${nomeDe(id)} depois de 8 s` +
            (entrar ? ' — pode ser espécie repetida ou limite de nível' : ''),
        );
      }
      // O cartao costuma fechar sozinho; se tiver ficado, nao se deixa um aberto para o proximo.
      await fecharCartoes();
      // A folga entre operacoes nao mora aqui: quem sabe quantos passos faltam e' o laco de
      // `aplicar`, e e' de la' que sai o espacamento. Ver `respirar`.
    }

    /**
     * Torna um Pokemon o ativo.
     *
     * Primeiro pelo HUD, que diz "Clique para tornar este Pokémon ativo" nos cartoes que nao sao o
     * lider e nao exige abrir janela nenhuma. Mas o HUD pode nao estar la': o proprio Layout padrao
     * deste pacote esconde HUDs, e o jogo tem um botao de recolher a equipe. Por isso existe a
     * reserva pelo painel de equipe, que tem o botao "Tornar Pokémon ativo" em cada slot.
     */
    async function tornarLider(id) {
      if (doHud().find((p) => p.lider)?.id === id) return true;

      const cartao = document.querySelector(`${HUD}[data-creature-id="${CSS.escape(id)}"]`);
      if (cartao && cartao.getBoundingClientRect().width > 0) {
        cartao.click();
        if ((await ate(() => doHud().find((p) => p.lider)?.id === id, 6000)) !== null) return true;
      }

      if (!(await abrirEquipe())) return false;
      const painelEquipe = document.querySelector(PAINEL_EQUIPE);
      const slot = painelEquipe.querySelector(`.team-slot[data-creature-id="${CSS.escape(id)}"]`);
      if (!slot) return false;
      slot.click();
      await espera(300);
      const botao = [...painelEquipe.querySelectorAll('button')].find(
        (b) => /tornar.*ativo/i.test(b.textContent || '') && !b.disabled,
      );
      if (!botao) return false;
      botao.click();
      const deu = (await ate(() => doHud().find((p) => p.lider)?.id === id, 6000)) !== null;
      await fechar(painelEquipe);
      return deu;
    }

    /**
     * Poe a ordem de batalha na sequencia guardada.
     *
     * A ordem de batalha e' a do painel de equipe, e **nao** a do HUD: sao duas listas diferentes,
     * e mover no painel nao mexe no HUD. O painel so' oferece "uma posicao para a esquerda/direita",
     * entao a unica forma e' levar cada um ao lugar, de tras para a frente — cada movimento custa
     * menos de 10 ms, entao a repeticao e' barata.
     */
    async function arrumarOrdem(ordem, contar) {
      if (!(await abrirEquipe())) {
        contar('A ordem ficou como estava: não consegui abrir o painel de equipe.');
        return false;
      }
      const painel = document.querySelector(PAINEL_EQUIPE);
      const posicoes = () =>
        [...painel.querySelectorAll('.team-slot[data-creature-id]')].map(
          (s) => s.dataset.creatureId,
        );
      for (let destino = 0; destino < ordem.length; destino += 1) {
        if (cancelado) break;
        const id = ordem[destino];
        let atual = posicoes().indexOf(id);
        if (atual < 0) continue;
        let voltas = 0;
        while (atual > destino && voltas < 10) {
          const slot = painel.querySelector(`.team-slot[data-creature-id="${CSS.escape(id)}"]`);
          slot.click();
          await espera(220);
          const esquerda = [...painel.querySelectorAll('.team-order-button')].find((b) =>
            /esquerda/i.test(b.getAttribute('aria-label') || ''),
          );
          if (!esquerda || esquerda.disabled) break;
          esquerda.click();
          await espera(220);
          const novo = posicoes().indexOf(id);
          if (novo === atual) break;
          atual = novo;
          voltas += 1;
        }
      }
      await fechar(painel);
      return true;
    }

    // ------------------------------------------------------------------ UI

    const painel = document.createElement('section');
    painel.id = 'lioncode-times';
    painel.innerHTML = `
      <header>
        <strong>Times</strong>
        <button type="button" data-compacto title="Modo compacto">–</button>
        <button type="button" data-fechar title="Esconder (Alt+T)">×</button>
      </header>
      <div class="corpo">
        <div class="salvar">
          <input type="text" data-nome maxlength="24" placeholder="Nome do time atual">
          <button type="button" data-salvar>Salvar</button>
        </div>
        <ul data-lista></ul>
        <p class="estado" data-estado></p>
        <div class="restante" data-restante hidden>
          <div class="barra"><i data-barra></i></div>
          <span data-conta></span>
        </div>
        <button type="button" class="parar" data-parar hidden>Parar</button>
      </div>`;

    const estilo = document.createElement('style');
    estilo.textContent = `
      #lioncode-times, #lioncode-times * { box-sizing: border-box; }
      #lioncode-times {
        position: fixed; z-index: 2147483000; width: 260px; height: 320px; overflow: auto;
        min-width: 210px; min-height: 140px; max-width: 92vw; max-height: 88vh;
        background: #10151e; color: #e6e9ef; border: 1px solid #2a3240; border-radius: 12px;
        font: 12px/1.45 system-ui, sans-serif; box-shadow: 0 14px 34px rgba(0,0,0,.55);
        opacity: .82; transition: opacity .15s;
        /* A alca nativa do canto. Depende de overflow diferente de visible e de uma altura
           explicita: so' com max-height o navegador nao desenha alca nenhuma, que era o motivo
           de o painel nao redimensionar. */
        resize: both;
      }
      #lioncode-times:hover, #lioncode-times:focus-within { opacity: 1; }
      #lioncode-times header {
        display: flex; align-items: center; justify-content: space-between; gap: 8px;
        padding: 8px 10px; border-bottom: 1px solid #222a36; cursor: move;
      }
      #lioncode-times header button {
        background: none; border: 0; color: #9aa6b8; font-size: 15px; cursor: pointer; padding: 0 2px;
      }
      #lioncode-times .corpo { padding: 10px; display: grid; gap: 8px; }
      #lioncode-times .salvar { display: flex; gap: 6px; }
      #lioncode-times input[type=text] {
        flex: 1; min-width: 0; background: #0b0f16; border: 1px solid #2a3240; border-radius: 7px;
        color: #e6e9ef; padding: 5px 7px; font: inherit;
      }
      #lioncode-times button:not(header button) {
        background: #1b2433; border: 1px solid #2a3240; border-radius: 7px; color: #e6e9ef;
        padding: 5px 8px; font: inherit; cursor: pointer;
      }
      #lioncode-times button:disabled { opacity: .5; cursor: default; }
      #lioncode-times ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 5px; }
      #lioncode-times li {
        display: flex; align-items: center; gap: 5px;
        background: #0d1219; border: 1px solid #202835; border-radius: 8px; padding: 5px 7px;
      }
      #lioncode-times li .rotulo { flex: 1; min-width: 0; }
      #lioncode-times li b { display: block; font-weight: 600; }
      #lioncode-times li small { color: #8b97a8; display: block; overflow: hidden;
        text-overflow: ellipsis; white-space: nowrap; }
      #lioncode-times .estado { margin: 0; color: #9aa6b8; min-height: 1.4em; }
      #lioncode-times .estado.ruim { color: #ff9b9b; }
      #lioncode-times .estado.bom { color: #7ddba0; font-weight: 600; }
      #lioncode-times .restante { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
      #lioncode-times .restante .barra { flex: 1; height: 4px; border-radius: 2px;
        background: #2a3244; overflow: hidden; }
      #lioncode-times .restante i { display: block; height: 100%; width: 0; background: #6ea8fe;
        transition: width .25s linear; }
      #lioncode-times .restante span { color: #8b97a8; white-space: nowrap;
        font-variant-numeric: tabular-nums; }
      /* O display flex acima vence o display none que o navegador da' a [hidden], entao a barra
         ficava na tela o tempo todo, parada em 0%, como se houvesse uma troca em curso. */
      #lioncode-times .restante[hidden] { display: none; }

      /* Modo compacto: fica o nome do time e o Usar, que e' o uso de todo dia. Some o que so'
         serve para administrar a lista — guardar um time novo, ver quem esta' nele, esquecer um.
         O estado e o relogio ficam: saber que a troca esta' andando importa nos dois modos. */
      #lioncode-times.compacto .salvar,
      #lioncode-times.compacto li small,
      #lioncode-times.compacto li [data-apagar],
      #lioncode-times.compacto li [data-atualizar] { display: none; }
      /* O nome convida a ser clicado: e' por ele que se renomeia. */
      #lioncode-times li b { cursor: text; }
      #lioncode-times li b:hover { text-decoration: underline dotted #8b97a8; }
      #lioncode-times li input.renomeando {
        width: 100%; background: #0d1219; color: #e7edf6; border: 1px solid #3b82f6;
        border-radius: 5px; padding: 2px 5px; font: inherit; font-weight: 600;
      }
      /* A confirmacao de regravar: o mesmo botao, a dizer que o proximo clique vale. */
      #lioncode-times li [data-atualizar].confirmando { color: #ffd479; border-color: #7a6227; }
      #lioncode-times.compacto li { padding: 4px 8px; }
      #lioncode-times.compacto .corpo { gap: 6px; }
      /* Retrair tem de deixar o painel **menor**, e nao so' tirar o que estava escrito nele: a
         largura e a altura do modo cheio sobrariam em volta de uma lista de tres linhas curtas.
         Cada modo tem o seu tamanho guardado, e estes sao os valores com que o compacto nasce. */
      #lioncode-times.compacto { width: 186px; height: auto; min-width: 150px; }
      #lioncode-times .vazio { color: #8b97a8; margin: 0; }
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

    /** O fim bem-sucedido, em verde: e' a unica mensagem que se quer reconhecer sem ler. */
    const celebrar = (texto) => {
      dizer(texto);
      estado.classList.add('bom');
    };

    // ------------------------------------------------------------- o relogio
    //
    // A contagem sai do mesmo orcamento que espaca os passos (`fimPrevisto`), entao ela nao e' um
    // numero inventado para a tela: e' o prazo contra o qual `respirar` calcula cada pausa.
    //
    // Ainda assim e' uma **previsao**, nao uma promessa. O orcamento manda nas pausas, nao no jogo:
    // cada troca passa pelo servidor e leva perto de 1,2 s, e numa conexao ruim leva mais. Por isso,
    // quando o tempo acaba com a troca ainda andando, o texto vira "terminando…" em vez de mostrar
    // numero negativo — que seria mentir duas vezes, sobre o prazo e sobre o que esta' acontecendo.

    const caixaRestante = campo('[data-restante]');
    const barra = campo('[data-barra]');
    const conta = campo('[data-conta]');
    let relogio = 0;
    let inicioDaTroca = 0;

    const pintarRelogio = () => {
      // O orcamento so' e' sorteado depois que os menus fecham; ate' la' nao ha' o que prever.
      if (!fimPrevisto) {
        conta.textContent = 'calculando…';
        barra.style.width = '0%';
        return;
      }
      const falta = fimPrevisto - Date.now();
      const total = fimPrevisto - inicioDaTroca;
      const feito = total > 0 ? Math.min(1, Math.max(0, 1 - falta / total)) : 0;
      barra.style.width = `${Math.round(feito * 100)}%`;
      conta.textContent = falta > 0 ? `faltam ~${Math.ceil(falta / 1000)} s` : 'terminando…';
    };

    const comecarRelogio = () => {
      // Zerado de proposito: sem isto a primeira pintura mostraria o prazo da troca anterior.
      fimPrevisto = 0;
      inicioDaTroca = Date.now();
      caixaRestante.hidden = false;
      pintarRelogio();
      relogio = setInterval(pintarRelogio, 250);
    };

    const pararRelogio = () => {
      clearInterval(relogio);
      relogio = 0;
      caixaRestante.hidden = true;
    };

    const times = () => ler(CHAVE_TIMES, []);

    const desenhar = () => {
      const guardados = times();
      lista.innerHTML = '';
      if (!guardados.length) {
        const vazio = document.createElement('p');
        vazio.className = 'vazio';
        vazio.textContent = 'Nenhum time guardado. Monte a equipe no jogo e clique em Salvar.';
        lista.append(vazio);
        return;
      }
      for (const time of guardados) {
        const item = document.createElement('li');
        const rotulo = document.createElement('div');
        rotulo.className = 'rotulo';
        const nome = document.createElement('b');
        nome.textContent = time.nome;
        nome.title = 'Clique para renomear';
        nome.addEventListener('click', () => renomear(nome, time.nome));
        const quem = document.createElement('small');
        quem.textContent = time.membros.map((m) => m.nome).join(', ');
        quem.title = quem.textContent;
        rotulo.append(nome, quem);
        const usar = document.createElement('button');
        usar.type = 'button';
        usar.textContent = 'Usar';
        usar.addEventListener('click', () => void usarTime(time));
        // Regravar este time com a equipe que esta' na tela. Em dois cliques, de proposito: e'
        // uma gravacao por cima, e um toque errado aqui apagaria um time inteiro sem aviso.
        const atualizar = document.createElement('button');
        atualizar.type = 'button';
        atualizar.dataset.atualizar = '';
        atualizar.textContent = '↻';
        atualizar.title = `Regravar "${time.nome}" com a equipe que está na tela`;
        let confirmar = 0;
        atualizar.addEventListener('click', () => {
          if (confirmar) {
            clearTimeout(confirmar);
            confirmar = 0;
            atualizar.classList.remove('confirmando');
            atualizar.textContent = '↻';
            void salvarAtual(time.nome);
            return;
          }
          atualizar.classList.add('confirmando');
          atualizar.textContent = '?';
          dizer(`Clique no ? outra vez para regravar "${time.nome}" com a equipe da tela.`);
          confirmar = setTimeout(() => {
            confirmar = 0;
            atualizar.classList.remove('confirmando');
            atualizar.textContent = '↻';
          }, 5000);
        });

        const apagar = document.createElement('button');
        apagar.type = 'button';
        apagar.dataset.apagar = '';
        apagar.textContent = '×';
        apagar.title = `Esquecer "${time.nome}"`;
        apagar.addEventListener('click', () => {
          gravar(
            CHAVE_TIMES,
            times().filter((t) => t.nome !== time.nome),
          );
          desenhar();
          dizer(`"${time.nome}" esquecido.`);
        });
        item.append(rotulo, usar, atualizar, apagar);
        lista.append(item);
      }
    };

    /**
     * Renomear no lugar: o nome vira uma caixa de texto ali mesmo.
     *
     * Enter grava, Escape desiste, e sair da caixa grava tambem — quem clica fora depois de
     * escrever quer o que escreveu, nao o que estava la' antes.
     *
     * O Ginasio guarda os times **pelo nome**, entao renomear aqui partiria a escolha dele em
     * silencio. Por isso avisa-se pela porta `PPX.gym`, do mesmo jeito que o Ginasio pergunta os
     * nomes pela porta `PPX.times`.
     */
    const renomear = (elemento, velho) => {
      if (aplicando) return;
      const caixa = document.createElement('input');
      caixa.type = 'text';
      caixa.className = 'renomeando';
      caixa.maxLength = 24;
      caixa.value = velho;
      let fechado = false;

      const desistir = () => {
        if (fechado) return;
        fechado = true;
        caixa.replaceWith(elemento);
      };

      const gravarNome = () => {
        if (fechado) return;
        const novo = caixa.value.trim();
        fechado = true;
        caixa.replaceWith(elemento);
        if (!novo || novo === velho) return;
        if (times().some((t) => t.nome === novo)) {
          dizer(`Já existe um time chamado "${novo}".`, true);
          return;
        }
        gravar(
          CHAVE_TIMES,
          times().map((t) => (t.nome === velho ? { ...t, nome: novo } : t)),
        );
        globalThis.PPX?.gym?.timeRenomeado?.(velho, novo);
        desenhar();
        celebrar(`"${velho}" agora chama-se "${novo}".`);
      };

      caixa.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          gravarNome();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          desistir();
        }
      });
      caixa.addEventListener('blur', gravarNome);
      elemento.replaceWith(caixa);
      caixa.focus();
      caixa.select();
    };

    /**
     * Guarda a equipe que esta' na tela.
     *
     * A composicao e a lideranca saem do HUD, que esta' sempre visivel. A ordem de batalha mora so'
     * no painel de equipe, entao ele e' aberto e fechado em seguida — e' o unico jeito de guardar
     * a ordem, e sem ela "usar" devolveria os Pokemon certos na sequencia errada.
     */
    async function salvarAtual(nomeForcado) {
      const atual = doHud();
      if (!atual.length) {
        dizer('Não encontrei a equipe na tela. O jogo já terminou de carregar?', true);
        return;
      }
      // Com nome dado, e' uma regravacao de um time que ja' existe — o `↻` da lista. Sem nome, e'
      // o Salvar de sempre, que le' a caixa de texto.
      const nome = nomeForcado || (campo('[data-nome]').value || '').trim() || `Time ${times().length + 1}`;
      dizer('Lendo a ordem de batalha…');
      let ordem = [];
      if (await abrirEquipe()) {
        const painelEquipe = document.querySelector(PAINEL_EQUIPE);
        ordem = [...painelEquipe.querySelectorAll('.team-slot[data-creature-id]')].map(
          (s) => s.dataset.creatureId,
        );
        await fechar(painelEquipe);
      }
      const time = {
        nome,
        membros: atual.map((p) => ({ id: p.id, nome: p.nome, nivel: p.nivel })),
        lider: atual.find((p) => p.lider)?.id || '',
        ordem,
      };
      // A ordem da lista e' preservada numa regravacao: o time regravado fica onde estava, em vez
      // de saltar para o fim como se fosse novo.
      const guardados = times();
      const onde = guardados.findIndex((t) => t.nome === nome);
      if (onde >= 0) guardados[onde] = time;
      else guardados.push(time);
      gravar(CHAVE_TIMES, guardados);
      if (!nomeForcado) campo('[data-nome]').value = '';
      desenhar();
      const verbo = onde >= 0 ? 'regravado' : 'guardado';
      celebrar(
        ordem.length
          ? `"${nome}" ${verbo} com ${time.membros.length} Pokémon e a ordem.`
          : `"${nome}" ${verbo} com ${time.membros.length} Pokémon, sem a ordem.`,
      );
    }

    /**
     * Monta um time guardado, cuidando da tela enquanto isso.
     *
     * Devolve o que aconteceu em vez de so' escrever na tela, porque o ginasio precisa **saber**:
     * uma troca que falhou no meio nao pode virar um desafio com a equipe errada.
     */
    async function usarTime(time) {
      if (aplicando) return { ok: false, erro: 'já há uma troca em andamento' };
      aplicando = true;
      cancelado = false;
      campo('[data-parar]').hidden = false;
      comecarRelogio();
      for (const b of painel.querySelectorAll('[data-salvar], li button')) b.disabled = true;
      try {
        const resultado = await aplicar(time, (texto) => dizer(texto));
        // O relogio para **aqui**, e nao so' no `finally`: entre o fim da troca e o fim da limpeza
        // ha' ate' um segundo de `fecharMenus`, e durante ele a tela dizia "Pronto" com a barra
        // ainda correndo e "faltam ~1 s" ao lado. Duas afirmacoes contrarias ao mesmo tempo.
        pararRelogio();
        const levou = Math.max(1, Math.round((Date.now() - inicioDaTroca) / 1000));
        if (resultado.parado) {
          dizer('Parado. A equipe ficou no meio da troca.', true);
          return { ok: false, parado: true, erro: 'a troca foi parada no meio' };
        }
        if (resultado.trocados === 0) celebrar(`A equipe já era "${time.nome}".`);
        else celebrar(`Pronto! "${time.nome}" montado em ${levou} s.`);
        return { ok: true, trocados: resultado.trocados, segundos: levou };
      } catch (erro) {
        // Falha com nome e motivo. Uma troca que para no meio deixa a equipe incompleta, e quem
        // esta' cacando precisa saber disso agora, nao quando o Pokemon errado desmaiar.
        dizer(`Parei: ${erro.message}. Confira a equipe no jogo.`, true);
        return { ok: false, erro: erro.message };
      } finally {
        // Nunca deixar um menu da barra aberto, nem quando a troca falhou no meio: e' o que trava o
        // jogo para a proxima vez, e foi assim que tres usos seguidos pararam de funcionar.
        await fecharMenus();
        aplicando = false;
        // Sempre, inclusive quando a troca estourou: um relogio que continua correndo depois do
        // fim diria que ainda ha' algo acontecendo.
        pararRelogio();
        campo('[data-parar]').hidden = true;
        for (const b of painel.querySelectorAll('[data-salvar], li button')) b.disabled = false;
      }
    }

    /**
     * Modo compacto: so' o nome do time e o Usar.
     *
     * Trocar a equipe e' o que se faz todo dia; guardar um time novo, quase nunca. Com a lista
     * cheia, o painel ocupava um pedaco da tela do jogo para mostrar sobretudo coisas que ja' se
     * sabe de cor — quem esta' em cada time.
     *
     * A escolha fica guardada, porque quem prefere um modo prefere sempre.
     */
    const aplicarModo = () => {
      painel.classList.toggle('compacto', compacto);
      const botao = campo('[data-compacto]');
      botao.textContent = compacto ? '□' : '–';
      botao.title = compacto ? 'Mostrar tudo' : 'Modo compacto';
      // `recolocar`, e nao so' `redimensionar`: a altura muda, e o painel ancorado por um canto de
      // baixo sairia do lugar se a posicao nao fosse refeita contra a caixa nova.
      recolocar();
    };

    campo('[data-compacto]').addEventListener('click', () => {
      compacto = !compacto;
      gravar(CHAVE_COMPACTO, compacto);
      aplicarModo();
    });


    campo('[data-salvar]').addEventListener('click', () => void salvarAtual());
    campo('[data-parar]').addEventListener('click', () => {
      cancelado = true;
      dizer('Parando depois do passo atual…');
    });

    // -------------------------------------------------------- posicao e menu

    /**
     * Devolve o tamanho que o usuario deixou.
     *
     * Vai antes de recolocar: a ancoragem pelo canto usa a caixa do painel para contar a distancia
     * ate' a borda, entao medir com o tamanho velho jogaria o painel para o lugar errado.
     */
    /**
     * Os tamanhos guardados, um por modo.
     *
     * Sao dois painEis diferentes: o cheio mostra uma lista com os nomes de seis Pokemon em cada
     * linha, o compacto mostra tres linhas de uma palavra. Um tamanho so' serviria mal aos dois, e
     * alternar entre eles ficaria preso ao maior.
     *
     * O formato antigo era um `{largura, altura}` solto, de quando so' havia um modo. Ele e' lido
     * como o tamanho do modo cheio, que e' o que ele sempre foi.
     */
    const tamanhos = () => {
      const bruto = ler(CHAVE_TAM, null);
      if (!bruto || typeof bruto !== 'object') return {};
      if (bruto.largura || bruto.altura) return { cheio: bruto };
      return bruto;
    };

    const modoAtual = () => (compacto ? 'compacto' : 'cheio');

    /**
     * O ultimo tamanho que **o codigo** aplicou, para o observador nao o confundir com um arrasto.
     *
     * Sem isto o painel esquece o tamanho que o usuario escolheu, e o caminho e' este: a janela do
     * navegador encolhe; `redimensionar` limita o painel ao teto da tela nova; essa mudanca acorda
     * o `ResizeObserver`, que grava o tamanho limitado por cima do escolhido. Ao voltar para a tela
     * grande, o painel continua pequeno — e nada no caminho parece errado, porque cada peca fez o
     * que devia.
     */
    let ultimoAplicado = null;

    const redimensionar = () => {
      // Limpar o estilo em linha antes de tudo, inclusive o do outro modo: ele vence as regras da
      // folha, e sem isto o painel retraido mantinha a largura e a altura do modo cheio.
      painel.style.width = '';
      painel.style.height = '';
      const tam = tamanhos()[modoAtual()];
      const largura = Number(tam?.largura);
      const altura = Number(tam?.altura);
      if (Number.isFinite(largura) && largura > 0)
        painel.style.width = `${Math.min(largura, Math.round(innerWidth * 0.92))}px`;
      // Sem tamanho guardado para este modo nao se escreve nada: quem manda e' a folha, e e' de la'
      // que o compacto tira a largura estreita e a altura do conteudo.
      if (Number.isFinite(altura) && altura > 0)
        painel.style.height = `${Math.min(altura, Math.round(innerHeight * 0.88))}px`;
      const caixa = painel.getBoundingClientRect();
      ultimoAplicado = { largura: Math.round(caixa.width), altura: Math.round(caixa.height) };
    };

    const recolocar = () => {
      redimensionar();
      if (globalThis.PPX?.canto?.aplicar(painel, ler(CHAVE_POS, null))) return;
      painel.style.left = 'auto';
      painel.style.top = 'auto';
      painel.style.right = '16px';
      painel.style.bottom = '196px';
    };

    let aVista = true;
    const pintar = () => {
      painel.style.display = aVista ? '' : 'none';
      if (aVista) recolocar();
    };

    const mostrarPainel = (sim) => {
      aVista = sim;
      pintar();
    };

    campo('[data-fechar]').addEventListener('click', () => {
      mostrarPainel(false);
      globalThis.PPX?.anotar?.('times', false);
    });

    // Arrasto pelo cabecalho, guardando o canto mais proximo — encolher a janela nao pode levar o
    // painel para fora da tela.
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

    // Guarda o tamanho depois que a alca para. `ResizeObserver` dispara a cada pixel arrastado;
    // gravar em todos seria uma escrita por quadro, e o que interessa e' onde parou.
    {
      let marca = null;
      let inicial = true;
      new ResizeObserver(() => {
        if (inicial) {
          inicial = false;
          return;
        }
        clearTimeout(marca);
        marca = setTimeout(() => {
          if (painel.style.display === 'none') return;
          const caixa = painel.getBoundingClientRect();
          // Esta mudanca foi do codigo, nao da alca: `redimensionar` acabou de encaixar o painel
          // no teto da janela, e grava-la apagaria o tamanho que o usuario escolheu. A folga de
          // 2 px e' de arredondamento de sub-pixel.
          if (
            ultimoAplicado &&
            Math.abs(Math.round(caixa.width) - ultimoAplicado.largura) <= 2 &&
            Math.abs(Math.round(caixa.height) - ultimoAplicado.altura) <= 2
          )
            return;
          // Cada modo guarda o seu: arrastar a alca no compacto nao pode encolher o modo cheio.
          gravar(CHAVE_TAM, {
            ...tamanhos(),
            [modoAtual()]: {
              largura: Math.round(caixa.width),
              altura: Math.round(caixa.height),
            },
          });
          // O canto guardado vale para a caixa nova: sem isto, crescer pela esquerda e depois
          // redimensionar a janela devolveria o painel para a posicao da caixa antiga.
          const pos = globalThis.PPX?.canto?.medir(painel);
          if (pos) gravar(CHAVE_POS, pos);
        }, 400);
      }).observe(painel);
    }

    addEventListener('resize', recolocar);

    addEventListener('keydown', (evento) => {
      if (!evento.altKey || evento.ctrlKey || evento.metaKey) return;
      if (evento.code === 'KeyT') {
        evento.preventDefault();
        mostrarPainel(false);
        globalThis.PPX?.anotar?.('times', false);
      } else if (evento.code === 'KeyY') {
        evento.preventDefault();
        mostrarPainel(true);
        globalThis.PPX?.anotar?.('times', true);
      }
    });

    desenhar();
    pintar();
    // Aqui, e nao junto do botao que o alterna: `aplicarModo` chama `recolocar`, que e' um `const`
    // declarado mais abaixo. Chamado cedo demais, estourava `Cannot access 'recolocar' before
    // initialization` e derrubava o resto do modulo — o painel subia sem lista nenhuma. Pego pela
    // banca de `testes/banca.html`; `no-undef` nao ve este caso, porque o nome existe.
    aplicarModo();

    if (globalThis.PPX) {
      globalThis.PPX.controlar?.('times', mostrarPainel);
      mostrarPainel(globalThis.PPX.visivel?.('times') !== false);

      /**
       * A porta para as outras ferramentas do pacote — hoje, o ginasio.
       *
       * Os content scripts de uma extensao partilham o mesmo `globalThis`, entao esta e' a forma
       * honesta de uma ferramenta pedir a troca a outra: a logica de troca mora num lugar so', com
       * os seus testes, e quem chama recebe o resultado em vez de ter de adivinhar lendo a tela.
       *
       * A alternativa seria o ginasio clicar no botão "Usar" deste painel, que pode estar
       * escondido — e um painel escondido nao e' uma interface, e' um acidente esperando.
       */
      globalThis.PPX.times = {
        nomes: () => times().map((t) => t.nome),
        usar: async (nome) => {
          const time = times().find((t) => t.nome === nome);
          if (!time) return { ok: false, erro: `não há time guardado chamado "${nome}"` };
          // Mostrar o painel: a troca demora 20-30 s e o usuario tem direito de ver o que corre.
          mostrarPainel(true);
          return usarTime(time);
        },
      };
    }
  },
);
