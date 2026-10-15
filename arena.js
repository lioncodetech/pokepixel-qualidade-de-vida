// Arena de Defesa: faz os ataques do dia sozinha, dentro da janela de horario que o dono marcar.
//
// O QUE O JOGO DIZ, E O QUE ESTA FERRAMENTA DEDUZ. Medido na conta real em 12/10/2026, com um
// ataque de verdade (autorizado) para ver o ciclo inteiro:
//
//   abrir            .pokeidle-top-toolbar__btn[data-menu-id="events"]
//                 -> .pokeidle-top-toolbar__dropdown-btn[data-menu-id="arena-defense"]
//                 -> .defense-window, cabeçalho "Escolha uma defesa para atacar"
//   as abas          nav.pvp-defense-nav com quatro botoes [data-defense-view]:
//                    "opponents" (Atacar), "defense", "history" (Histórico), "ranking"
//                    a aberta tem .is-active; fora da "opponents" NAO HA' .pvp-defense-opponent
//   atualizar        button.pokeidle-btn.pvp-defense-refresh  ("Atualizar grátis · 3/3")
//   um rival         .pvp-defense-opponent  com [data-defense-avatar="<trainer_id>"] dentro
//                    ja' atacado hoje: .is-used, e o botao fica "Atacado" e `disabled`
//   atacar           .pvp-action-button.is-accept
//   preparacao       .defense-slot (os ataques salvos) + o botao de confirmar, e nenhum rival
//                    o cabeçalho e' <header class="defense-workshop-heading"> com um H2 "Ataque
//                    contra <nome>" e um H3 "ESCOLHIDOS · 6/6" — o H3 nao e' o titulo
//                    cada slot: .defense-slot-number, h4 com o nome, botoes Carregar/Salvar/...
//                    um slot vazio tem o "Carregar" `disabled`
//   confirmar        .pokeidle-ui-button.defense-primary ("Atacar")
//   batalha          .pokeidle-pvp-battle — contagem de 30 s e depois ate' 210 s de combate
//   fim              .pvp-result, com `.is-win` quando se ganha, e .pvp-result__button para voltar
//
// ENTRAR NA TELA DE PREPARACAO NAO GASTA TENTATIVA. Medido: `attempts.remaining` ficou em 4 antes
// e depois de abrir a preparacao e sair pelo "Voltar". Quem gasta e' o "Atacar" de la' dentro. Por
// isso esta ferramenta pode conferir a tela antes de se comprometer.
//
// A BATALHA JOGA-SE SOZINHA, E DEMORA. Os golpes saem sem ninguem clicar e o Pokemon derrotado e'
// substituido sem input nenhum; o combate medido levou perto de dois minutos, e o teto do jogo e'
// `battle_timeout_seconds: 210` depois de uma contagem de 30 s. Sao as duas razoes do desenho:
//
//  - a vez e' pedida **por ataque**, e nao pela rodada inteira. Cinco ataques com os intervalos do
//    dono passam dos quinze minutos, e segurar a fila esse tempo todo parava a Escada, o ginasio e
//    a venda por uma coisa que nao tem pressa. Entre um ataque e outro a fila fica livre;
//  - o intervalo entre ataques e' sorteado dentro de uma faixa, em segundos, como o dono pediu.
//
// NUNCA SE COMPRA NADA. O jogo vende entradas extras (`extra_diamonds: 25`) e atualizacoes depois
// das tres gratis. O dono foi explicito, e esta ferramenta nao tem caminho nenhum para la': ela so'
// clica em "Atualizar" enquanto a API disser `payment: "free"` com `free_remaining > 0`, e so' ataca
// enquanto `attempts.remaining` for maior que zero. Acabou o de graça, ela para e diz porque'.
//
// QUEM VENCE O DONO FICA DE FORA. Pedido dele: "quando perde quero que pule aquela defesa e nao
// entre mais". Guarda-se o `trainer_id` — o nome muda, o id nao —, e a lista limpa-se sozinha
// quando a temporada vira (`season.id`), que e' o unico momento em que o jogo recomeça de verdade.
// Tem botao de limpar a' mao, porque a decisao de dar outra chance e' dele e nao desta ferramenta.
//
// GANHOU OU PERDEU, QUEM DIZ E' O PLACAR. A tela traz `.pvp-result.is-win` na vitoria, e e' o sinal
// obvio — mas a derrota tem outra classe que nao foi medida, e tratar "nao e' is-win" como derrota
// faria uma classe renomeada barrar a lista inteira. Por isso quem decide e' a diferenca de pontos
// do perfil, lida pela API antes e depois: subiu, ganhou. A classe entra so' como segunda opiniao,
// para o caso de os pontos nao se mexerem.

PPX.modulo(
  {
    id: 'arena',
    nome: 'Arena de Defesa',
    atalhos: 'Alt+M esconde · Alt+Shift+M mostra',
  },
  () => {
    'use strict';

    const CHAVE = 'lioncode:arena:config';
    const CHAVE_POS = 'lioncode:arena:posicao';
    const CHAVE_MIN = 'lioncode:arena:minimizado';
    const CHAVE_PLACAR = 'lioncode:arena:placar';
    const PEDIDO = 'lioncode:arena:pedido';
    const RESPOSTA = 'lioncode:arena:resposta';
    const PACIENCIA = 20000;
    const MINHA_VEZ = 'arena';

    // Os prazos de espera. Generosos de proposito: o custo de esperar de mais e' tempo, e o de
    // esperar de menos e' uma tentativa gasta num ataque que a ferramenta deu por perdido.
    const ESPERA_JANELA = 8000;
    const ESPERA_TELA = 10000;
    const ESPERA_BATALHA = 25000;
    /** Contagem (30 s) + combate (210 s) + folga, quando a API nao disser os seus numeros. */
    const ESPERA_FIM = 330000;

    const ler = (chave, padrao) => {
      try {
        return JSON.parse(localStorage.getItem(chave)) ?? padrao;
      } catch {
        return padrao;
      }
    };
    const gravarChave = (chave, valor) => {
      try {
        localStorage.setItem(chave, JSON.stringify(valor));
      } catch {
        /* modo anonimo, ou armazenamento cheio. */
      }
    };

    // ------------------------------------------------------------- o que se guarda

    const PADRAO = {
      /** O botao Iniciar/Parar. Parada, ela nao ataca nem olha para o relogio. */
      ligada: false,
      /** A janela de horario, no formato do calendario: `"13:00-15:00"`. */
      horarios: '',
      /** Em que dias, no formato do calendario. Vazio = todo dia. */
      dias: '',
      /** O carimbo da ultima rodada. E' o que garante **uma rodada por ocorrencia**. */
      ultima: 0,
      /** O intervalo entre dois ataques, em segundos: sorteia-se entre os dois. */
      atrasoMin: 30,
      atrasoMax: 120,
      /**
       * Quantos ataques por rodada. Cinco e' o que o jogo da' por dia, e e' o que o dono pediu —
       * mas o numero e' dele: ha' dias de querer gastar tres e guardar duas.
       *
       * O teto de verdade nao e' este: e' `attempts.remaining`, que vem do jogo a cada volta.
       */
      quantos: 5,
      /**
       * Qual ataque salvo carregar antes de cada combate: o numero do slot (`"1"`) ou um pedaco do
       * nome que esta' nele (`"pvp1"`). Vazio = entra com a equipe que estiver na tela.
       */
      time: '',
      /** `trainer_id -> { nome, quando }`: quem venceu o dono e fica de fora. */
      barrados: {},
      /** De que temporada e' a lista de barrados. Virou a temporada, a lista limpa-se. */
      temporada: 0,
      /**
       * O instante em que a arena vira o dia, quando ha' uma rodada **a dever** por causa da
       * expedição. `0` = nao se deve nada.
       *
       * Escolha do dono em 12/10/2026, com a expedição dele a correr: na expedição a Arena espera,
       * como a Escada ja' esperava — e faz a rodada quando ela acabar, **mesmo que a janela de
       * horario ja' tenha fechado**. As tentativas so' se perdem a' meia-noite de Brasilia, entao
       * o dia ainda da' para recuperar; perder duas horas de expedição e um CAPTCHA, nao.
       *
       * O prazo e' o `resets_at` do proprio jogo, guardado como instante. Assim a batida seguinte
       * decide com um `Date.now()` e sem perguntar nada a' API — e a divida morre sozinha quando o
       * dia vira, em vez de ficar guardada para uma madrugada qualquer.
       */
      devendo: 0,
    };

    let cfg = { ...PADRAO, ...(ler(CHAVE, null) || {}) };
    if (!cfg.barrados || typeof cfg.barrados !== 'object') cfg.barrados = {};
    const gravar = () => gravarChave(CHAVE, cfg);

    const placar = () => {
      const p = ler(CHAVE_PLACAR, null);
      return p && Array.isArray(p.linhas) ? p : { quando: 0, linhas: [] };
    };
    const anotarPlacar = (linhas) => gravarChave(CHAVE_PLACAR, { quando: Date.now(), linhas });

    // ------------------------------------------------------------- a ponte

    const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
    let proximoEco = 0;

    const pedirPonte = (pedido) =>
      new Promise((resolver) => {
        const eco = `a${Date.now()}-${(proximoEco += 1)}`;
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

    /** O estado da arena. Ver o cabeçalho de `arena-main.js`: ele só lê. */
    const pedirEstado = () => pedirPonte({ acao: 'estado' });

    const ate = async (condicao, limite) => {
      const inicio = Date.now();
      for (;;) {
        const valor = condicao();
        if (valor) return valor;
        if (Date.now() - inicio >= limite) return null;
        await espera(250);
      }
    };

    // ------------------------------------------------------------- a tela do jogo

    /**
     * Se o jogador esta' **dentro** da expedição agora.
     *
     * Quem responde e' a porta das Caçadas, que le' o HUD da corrida — a mesma que a Escada usa.
     * Com a ferramenta Caçadas desligada ninguem sabe, e entao nao se adivinha: a Arena corre como
     * corria. E' o mesmo que ela ja' faz quando nao ha' fila.
     */
    const naExpedicao = () => globalThis.PPX?.cacadas?.atual?.()?.tipo === 'expedicao';

    const ESPERO_A_EXPEDICAO =
      'Você está na expedição — espero aqui e faço a rodada quando ela acabar.';

    const janela = () => document.querySelector('.defense-window');
    const naLista = () => Boolean(janela()?.querySelector('.pvp-defense-opponent'));

    /**
     * Se a tela de preparação — a dos seis Pokemon e dos ataques salvos — esta' aberta.
     *
     * **Reconhece-se pelo que a tela tem, e nao pelo que ela diz.** Ate' 12/10/2026 isto era um
     * `/^Ataque contra/` lido do `header h3`, e nao funcionava: o "Ataque contra <nome>" e' um H2,
     * e o H3 daquele cabeçalho e' o "ESCOLHIDOS · 6/6". A ferramenta ficava dez segundos a olhar
     * para a tela aberta e desistia a dizer que ela nao tinha aberto. Trocar um seletor de titulo
     * por outro era repetir o erro: o que importa e' haver os ataques salvos para carregar e o
     * botao para confirmar — que e' exactamente o que os passos seguintes vao usar — e nao haver
     * ja' a lista de rivais, que e' a outra tela da mesma janela.
     */
    const naPreparacao = () => {
      const j = janela();
      return Boolean(j?.querySelector('.defense-slot') && confirmarDe(j) && !naLista());
    };

    /** O botao que gasta a tentativa. Fora da preparação ele nao existe. */
    const confirmarDe = (j) => j?.querySelector('.pokeidle-ui-button.defense-primary') || null;

    /**
     * O clique que o jogo ouve, para os elementos que **nao** sao botoes.
     *
     * Medido: o `✕` da janela e' um `<div class="pokeidle-panel__close">`, e `el.click()` nele nao
     * fecha nada — o jogo escuta o `pointerdown`/`mousedown`, nao o `click`. Nos `<button>` o
     * `.click()` basta e e' o que se usa; aqui vai a sequencia inteira, que e' o que um rato faz.
     */
    const clicarDeVerdade = (el) => {
      for (const tipo of ['pointerdown', 'mousedown', 'mouseup', 'click'])
        el.dispatchEvent(new MouseEvent(tipo, { bubbles: true, cancelable: true, view: window }));
    };

    /** Fecha o menu da barra de cima que tenha ficado aberto, para nao tapar o jogo. */
    const fecharMenu = () => {
      const aberto = document.querySelector('.pokeidle-top-toolbar__dropdown-btn[data-menu-id]');
      if (aberto?.offsetParent)
        document.querySelector('.pokeidle-top-toolbar__btn[data-menu-id="events"]')?.click();
    };

    const abaAtacar = () =>
      janela()?.querySelector('.pvp-defense-nav [data-defense-view="opponents"]') || null;

    const naAbaAtacar = () => Boolean(abaAtacar()?.classList.contains('is-active'));

    /**
     * O "Voltar" da tela de preparação, que devolve a janela a' lista de rivais.
     *
     * Ele nao gasta tentativa nenhuma — quem gasta e' o `.defense-primary` ao lado dele. Sair por
     * aqui e' a unica maneira honesta de desfazer uma preparação que ficou aberta.
     */
    const voltarDaPreparacao = () => {
      const voltar = [...(janela()?.querySelectorAll('button') || [])].find(
        (b) => b.textContent.trim() === 'Voltar',
      );
      voltar?.click();
      return Boolean(voltar);
    };

    /**
     * Poe a janela na aba **Atacar**, que e' a unica onde ha' rivais.
     *
     * **ISTO E' A CORRECCAO DE UM DEFEITO, medido no jogo em 13/10/2026.** A janela tem quatro
     * abas, e o jogo deixa-a no "Histórico" depois de uma batalha. Fora da aba "Atacar" a lista de
     * rivais nao existe no DOM — zero `.pvp-defense-opponent` —, entao a ferramenta chegava ao
     * ataque seguinte sem achar o cartao de ninguem, e ate' o `abrirJanela` dava a janela por
     * fechada com ela aberta na frente.
     *
     * A aba escolhe-se pelo endereço dela (`data-defense-view`) e nao pelo texto do botao: "Atacar"
     * e' tambem o que diz o botao que gasta a tentativa na tela de preparação.
     *
     * **A pergunta e' a aba, e nao a lista.** Ate' a 1.18.2 isto esperava oito segundos por um
     * cartao de rival e devolvia `false` quando nenhum aparecia — e o chamador anunciava "Não
     * consegui abrir a janela da Arena de Defesa" com a janela aberta na frente do dono. Lista
     * vazia nao e' janela fechada: e' uma rodada sem rival a' vista, e quem sabe dizer isso e' o
     * `proximoAlvo`, que le' a arena pela API e ainda tem as atualizações de graça na mao.
     */
    const irParaAtacar = async () => {
      // **UMA PREPARAÇÃO QUE FICOU ABERTA NAO E' A LISTA, E SAI-SE DELA PELO "VOLTAR".** Medido no
      // jogo do dono em 13/10/2026: o painel dizia "o botão de atacar n4th sumiu da lista" — e nao
      // tinha sumido nada, a janela e' que estava parada na tela de preparação de uma tentativa
      // anterior. La' nao ha' barra de abas, entao nao havia o que clicar, e a lista nunca voltava.
      if (!abaAtacar() && naPreparacao() && voltarDaPreparacao())
        await ate(abaAtacar, ESPERA_JANELA);
      const aba = abaAtacar();
      // Ainda sem barra de abas: a janela esta' noutra tela sua — uma batalha a correr, por
      // exemplo. Ela abriu, que e' a pergunta; quem vier a seguir dira' o que falta.
      if (!aba) return Boolean(janela());
      if (!aba.classList.contains('is-active')) aba.click();
      return Boolean(await ate(naAbaAtacar, ESPERA_JANELA));
    };

    /**
     * Abre a janela da arena, se ela nao estiver aberta.
     *
     * Dois cliques, como o dono faria: o grupo "Eventos" da barra de cima e, dentro dele, a "Arena
     * de Defesa". O item do menu so' existe depois de o grupo abrir — dai' a espera no meio, em vez
     * de dois cliques seguidos a torcer.
     */
    const abrirJanela = async () => {
      // Aberta noutra aba conta como aberta: o que falta e' trocar de aba, nao mexer no menu de
      // cima — um segundo clique ali fecharia a janela que ja' estava la'.
      if (janela()) return irParaAtacar();
      const grupo = document.querySelector('.pokeidle-top-toolbar__btn[data-menu-id="events"]');
      if (!grupo) return false;
      grupo.click();
      const item = await ate(
        () =>
          document.querySelector(
            '.pokeidle-top-toolbar__dropdown-btn[data-menu-id="arena-defense"]',
          ),
        3000,
      );
      if (!item) return false;
      item.click();
      // Espera-se a janela, e nao a lista: ela pode abrir no "Histórico" de onde ficou.
      const abriu = await ate(janela, ESPERA_JANELA);
      fecharMenu();
      return Boolean(abriu) && (await irParaAtacar());
    };

    const fecharJanela = () => {
      const fechar = janela()?.querySelector('.pokeidle-panel__close');
      if (fechar) clicarDeVerdade(fechar);
    };

    const cartaoDe = (id) =>
      janela()?.querySelector(`[data-defense-avatar="${id}"]`)?.closest('.pvp-defense-opponent') ||
      null;

    /** O botao de atacar de um cartao, ou `null` se ele ja' foi usado (o jogo desativa-o). */
    const botaoDe = (id) => {
      const b = cartaoDe(id)?.querySelector('.pvp-action-button.is-accept');
      return b && !b.disabled ? b : null;
    };

    /** Os ataques salvos da tela de preparação, na ordem em que aparecem. */
    const timesSalvos = () =>
      [...document.querySelectorAll('.defense-slot')].map((s, i) => ({
        el: s,
        numero: Number(s.querySelector('.defense-slot-number')?.textContent) || i + 1,
        nome: (s.querySelector('h4')?.textContent || '').trim(),
        // O primeiro botao do slot e' o "Carregar", e num slot vazio ele vem `disabled`.
        carregar: [...s.querySelectorAll('button')].find(
          (b) => b.textContent.trim() === 'Carregar' && !b.disabled,
        ),
      }));

    const chao = (t) =>
      String(t || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim();

    /**
     * Carrega o ataque salvo que o dono escolheu, e diz o que fez.
     *
     * Aceita o numero do slot ou um pedaco do nome, porque as duas coisas estao na tela e exigir a
     * certa seria exigir que ele se lembrasse de qual. Sem escolha, nao se mexe na equipe: entrar
     * com o que esta' montado e' uma decisao legitima, e trocar sem pedido nao e'.
     */
    const carregarTime = async () => {
      const querido = String(cfg.time || '').trim();
      if (!querido) return { ok: true, diz: 'com a equipe que estava na tela' };
      const salvos = timesSalvos();
      if (!salvos.length) return { ok: false, diz: 'não achei os ataques salvos nesta tela' };
      const numero = Number(querido);
      const achado = Number.isFinite(numero)
        ? salvos.find((s) => s.numero === numero)
        : salvos.find((s) => chao(s.nome).includes(chao(querido)));
      if (!achado) return { ok: false, diz: `não achei o ataque salvo "${querido}"` };
      if (!achado.carregar)
        return { ok: false, diz: `o ataque salvo "${achado.nome || achado.numero}" está vazio` };
      achado.carregar.click();
      await espera(800);
      return { ok: true, diz: `com o ataque salvo "${achado.nome || achado.numero}"` };
    };

    // ------------------------------------------------------------- a fila

    /**
     * A vez, pedida **por ataque**. Ver o cabeçalho: uma rodada inteira sao mais de quinze minutos,
     * e segurar a fila todo esse tempo pararia tudo o resto por uma coisa que nao tem pressa.
     */
    const esperarAVez = async (dizer) => {
      const vez = globalThis.PPX?.vez;
      if (!vez?.pedir) return () => {};
      const dono = vez.dono();
      if (dono && dono.id !== MINHA_VEZ) dizer(`Esperando o ${vez.nome(dono.id)} terminar…`);
      return vez.pedir(MINHA_VEZ);
    };

    // ------------------------------------------------------------- um ataque

    let correndo = false;
    let parar = false;

    /**
     * Um ataque, do clique na lista ate' voltar a' caçada — e o que ele devolve e' **ganhou ou
     * nao**, com a razao por extenso quando nao deu.
     *
     * A ordem e' a da tela, e cada passo so' avança depois de o anterior aparecer: a preparação
     * demora a desenhar os seis Pokemon, e clicar no "Atacar" antes disso clica no nada.
     */
    const fecharResultado = async () => {
      const aberto = document.querySelector('.pvp-result');
      if (!aberto) return true;
      aberto.querySelector('.pvp-result__button')?.click();
      return Boolean(await ate(() => !document.querySelector('.pvp-result'), 10000));
    };

    const atacar = async (alvo, pontosAntes, feitasAntes, aviso) => {
      // **O RESULTADO DA BATALHA ANTERIOR SAI DA FRENTE ANTES DE COMEÇAR ESTA.** Ele ja' se fecha
      // no fim de cada batalha, mas um clique perdido ali deixaria-o na tela — e entao a espera
      // pelo `.pvp-result` desta batalha responderia "sim" no primeiro instante, com o resultado
      // da outra. Fechar aqui e' barato; confundir as duas custa uma vitoria marcada como derrota
      // e um rival barrado ate' a temporada virar.
      await fecharResultado();
      // **O CARTAO ESPERA-SE.** Ate' a 1.18.3 quem esperava era o `abrirJanela`, que so' dava a
      // janela por aberta quando havia ao menos um rival na tela; tirada essa espera (lista vazia
      // nao e' janela fechada), ficou esta linha a exigir o cartao no primeiro instante — e entre
      // trocar de aba e a lista pintar ha' um intervalo. Medido no jogo do dono em 13/10/2026:
      // "o botão de atacar n4th sumiu da lista", com o rival a aparecer logo a seguir.
      const botao = await ate(() => botaoDe(alvo.id), ESPERA_JANELA);
      if (!botao) return { erro: `o botão de atacar ${alvo.nome} sumiu da lista` };
      aviso(`Atacando ${alvo.nome} (vitória +${alvo.ganha} · derrota −${alvo.perde})…`);
      botao.click();

      if (!(await ate(naPreparacao, ESPERA_TELA)))
        return { erro: 'a tela de preparação não abriu' };
      const time = await carregarTime();
      if (!time.ok) {
        // Sair e' melhor do que atacar com a equipe errada: a tentativa gasta-se na mesma, e o
        // dono pediu um time em especial justamente por isto.
        voltarDaPreparacao();
        return { erro: time.diz };
      }

      const confirmar = confirmarDe(janela());
      if (!confirmar) return { erro: 'não achei o botão de atacar da tela de preparação' };
      aviso(`Atacando ${alvo.nome}, ${time.diz}…`);
      confirmar.click();

      if (!(await ate(() => document.querySelector('.pokeidle-pvp-battle'), ESPERA_BATALHA)))
        return { erro: 'a batalha não começou' };

      // A contagem antes do combate. O dono pediu para clicar no "estou pronto" se ele existir —
      // e ele pode nao existir: na batalha medida ela correu sozinha ate' ao fim. Procura-se o
      // botao durante alguns segundos; nao havendo, espera-se a contagem como quem assiste.
      const pronto = await ate(
        () =>
          [...document.querySelectorAll('.pokeidle-pvp-battle button')].find(
            (b) => /pronto|ready/i.test(b.textContent || '') && !b.disabled,
          ),
        8000,
      );
      if (pronto) pronto.click();

      const fim = await ate(() => document.querySelector('.pvp-result'), ESPERA_FIM);
      if (!fim) return { erro: 'a batalha não terminou no tempo esperado' };
      const classeDizVitoria = fim.classList.contains('is-win');

      // Quem decide e' o placar do perfil, nao a classe. Ver o cabeçalho.
      const depois = await pedirEstado();

      /**
       * **A ARENA DIZ SE O ATAQUE CONTOU, E ELA E' A UNICA QUE SABE.**
       *
       * Pedido pelo dono em 13/10/2026: *"ele ta dizendo que atacou as 5 vezes sendo que so' uma
       * vez foi bem sucedida"*. Ate' aqui a prova de que houve batalha era a tela — apareceu o
       * `.pokeidle-pvp-battle`, apareceu o `.pvp-result` — e tela e' o que mais mente: um resultado
       * da batalha anterior que nao se fechou responde "sim" ao primeiro olhar, e dai' em diante
       * cada volta do laço marca um ataque que nao aconteceu.
       *
       * O contador de tentativas da propria arena nao tem como mentir: ele so' anda quando o jogo
       * gasta uma. Se ele nao andou, nao houve ataque — e entao nao se marca vitoria nem derrota, e
       * sobretudo **nao se barra o rival**, que ficaria de fora ate' a temporada virar por causa de
       * uma derrota que nunca houve.
       *
       * Nao se conseguindo ler o estado, nao se inventa: cai-se no caminho de sempre, que ja'
       * decide pela classe da tela quando os pontos nao se mexem.
       */
      if (depois?.ok && depois.tentativas.feitas <= feitasAntes)
        return {
          erro:
            `a arena não registrou este ataque — as tentativas continuam em ` +
            `${depois.tentativas.feitas} de ${depois.tentativas.limite}`,
        };

      const pontosDepois = depois?.ok ? depois.pontos : null;
      const ganhou =
        pontosDepois === null || pontosDepois === pontosAntes
          ? classeDizVitoria
          : pontosDepois > pontosAntes;

      await fecharResultado();
      // **O jogo larga-a no "Histórico".** Medido em 13/10/2026: fechada a batalha, a aba aberta e'
      // a do historico, e o ataque seguinte procuraria os rivais numa tela que nao os tem. Volta-se
      // ja', e nao so' no proximo ataque, para o painel nao ficar a dever uma tela ao dono.
      await irParaAtacar();

      return {
        ganhou,
        pontos: pontosDepois === null ? null : pontosDepois - pontosAntes,
        estado: depois?.ok ? depois : null,
      };
    };

    /**
     * Atualiza a lista de rivais — **so' de graça**.
     *
     * A licenca le-se antes do clique e vem da API, nao do texto do botao: o botao diz "Atualizar
     * grátis · 3/3" enquanto ha' gratis e muda de cara depois, mas ler a cara de um botao para
     * decidir se uma coisa custa diamante e' apostar numa string.
     */
    const atualizarGratis = async (estado, aviso) => {
      if (!estado.atualizacao.gratis) return false;
      const botao = janela()?.querySelector('.pvp-defense-refresh');
      if (!botao || botao.disabled) return false;
      aviso(`Atualizando a lista (de graça, ${estado.atualizacao.restantes} restam)…`);
      botao.click();
      await espera(2500);
      return true;
    };

    // ------------------------------------------------------------- a rodada

    const sorteado = (menor, maior) => {
      const a = Math.max(0, Number(cfg[menor]) || 0);
      const b = Math.max(a, Number(cfg[maior]) || a);
      return Math.round(a + Math.random() * (b - a));
    };

    const barrado = (id) => Object.hasOwn(cfg.barrados, id);

    const barrar = (alvo) => {
      cfg.barrados = { ...cfg.barrados, [alvo.id]: { nome: alvo.nome, quando: Date.now() } };
      gravar();
      desenhar();
    };

    /**
     * A lista de barrados e' de uma temporada so'.
     *
     * O dono nao sabia por quanto tempo pular uma defesa — "ate' encontrar ela outra vez dando
     * refresh", disse. Encontrar outra vez nao e' um prazo: e' o acaso do sorteio da lista. A
     * temporada e', e e' o unico momento em que o jogo recomeça de verdade (`reset_mode: "hard"`).
     */
    const conferirTemporada = (estado) => {
      if (!estado.temporada.id || estado.temporada.id === cfg.temporada) return;
      cfg.temporada = estado.temporada.id;
      cfg.barrados = {};
      gravar();
      // E o painel diz logo, sem esperar o fim da rodada: uma lista de barrados que ja' nao vale
      // mas continua na tela e' a ferramenta a mentir sobre quem ela vai poupar.
      desenhar();
    };

    /** O proximo rival a atacar, ou a razao de nao haver nenhum. */
    const proximoAlvo = (estado) => {
      const livres = estado.oponentes.filter((o) => !o.usado && !barrado(o.id));
      if (livres.length) return { alvo: livres[0] };
      const porBarra = estado.oponentes.filter((o) => !o.usado && barrado(o.id)).length;
      return {
        alvo: null,
        porque: porBarra
          ? `os ${porBarra} rivais que sobram já me venceram`
          : 'já ataquei todos os rivais da lista',
      };
    };

    /**
     * Uma rodada: os ataques do dia, um atras do outro, com o intervalo do dono entre eles.
     *
     * Ela para por tres motivos, e **todos sao do jogo**: acabaram as tentativas, acabaram as
     * atualizações gratis, ou nao ha' rival que nao tenha ganho dela. Nao ha' um quarto motivo
     * escondido numa contagem desta ferramenta.
     */
    const rodada = async (aviso) => {
      if (correndo) return;
      correndo = true;
      parar = false;
      const linhas = [];
      try {
        if (naExpedicao()) {
          await ficarADever(aviso);
          return;
        }
        if (!(await abrirJanela())) {
          aviso('Não consegui abrir a janela da Arena de Defesa.', true);
          return;
        }
        for (let feitos = 0; feitos < Math.max(1, Number(cfg.quantos) || 5); feitos += 1) {
          if (parar) {
            aviso('Parei a pedido.');
            return;
          }
          // Conferido a cada ataque, e nao so' no inicio: a expedição abre de quatro em quatro
          // horas e o dono pode entrar nela no meio de uma rodada de quinze minutos. O que sobra
          // fica a dever, como a rodada inteira ficaria.
          if (naExpedicao()) {
            await ficarADever(aviso);
            return;
          }
          let estado = await pedirEstado();
          if (!estado?.ok) {
            aviso(estado?.erro || 'não consegui ler a arena', true);
            return;
          }
          conferirTemporada(estado);
          if (estado.tentativas.restantes <= 0) {
            aviso(
              `Acabaram as tentativas de hoje (${estado.tentativas.feitas} de ${estado.tentativas.limite}). Não compro mais com diamante.`,
            );
            return;
          }

          /**
           * Procurar rival, atualizando a lista **enquanto for de graça**.
           *
           * Uma atualizacao so' nao basta, e a banca mostrou porque': a lista nova pode vir cheia
           * de gente que ja' venceu o dono, e desistir ali deixaria tentativas por usar com
           * atualizacoes gratis ainda na mao. O laço acaba sozinho — cada volta gasta uma das
           * tres, e `atualizarGratis` devolve `false` assim que a API deixar de dizer "free".
           */
          let escolha = proximoAlvo(estado);
          while (!escolha.alvo) {
            if (!(await atualizarGratis(estado, aviso))) {
              aviso(
                `Parei: ${escolha.porque}, e não tenho mais atualização de graça. Não pago com diamante.`,
              );
              return;
            }
            estado = await pedirEstado();
            if (!estado?.ok) {
              aviso(estado?.erro || 'não consegui ler a arena', true);
              return;
            }
            escolha = proximoAlvo(estado);
          }

          const alvo = escolha.alvo;
          let soltar = null;
          let r = null;
          try {
            soltar = await esperarAVez(aviso);
            if (!soltar) {
              aviso('Desisti: o jogo ficou ocupado tempo demais.', true);
              return;
            }
            if (!(await abrirJanela())) {
              aviso('Não consegui abrir a janela da Arena de Defesa.', true);
              return;
            }
            r = await atacar(alvo, estado.pontos, estado.tentativas.feitas, aviso);
          } finally {
            if (soltar) soltar();
          }

          if (r.erro) {
            linhas.push({ nome: alvo.nome, estado: 'erro', texto: r.erro });
            anotarPlacar(linhas);
            aviso(`${alvo.nome}: ${r.erro}`, true);
            return;
          }
          if (r.ganhou) {
            linhas.push({ nome: alvo.nome, estado: 'vitoria', texto: pontosEmTexto(r.pontos) });
          } else {
            barrar(alvo);
            linhas.push({ nome: alvo.nome, estado: 'derrota', texto: pontosEmTexto(r.pontos) });
          }
          anotarPlacar(linhas);
          aviso(
            `${alvo.nome}: ${r.ganhou ? 'ganhei' : 'perdi — não entro mais nela'} ${pontosEmTexto(r.pontos)}`,
          );

          const sobra = r.estado ? r.estado.tentativas.restantes : 0;
          if (sobra <= 0) {
            aviso('Acabaram as tentativas de hoje. Não compro mais com diamante.');
            return;
          }
          if (feitos + 1 < Math.max(1, Number(cfg.quantos) || 5)) {
            const atraso = sorteado('atrasoMin', 'atrasoMax');
            aviso(`Esperando ${atraso}s antes do próximo ataque…`);
            for (let passou = 0; passou < atraso && !parar; passou += 1) await espera(1000);
          }
        }
        aviso('Rodada feita.');
      } finally {
        correndo = false;
        fecharJanela();
        desenhar();
      }
    };

    /**
     * Guarda a rodada que a expedição adiou, com o prazo que o jogo da'.
     *
     * Le' o estado **uma vez** so' para saber a que horas a arena vira o dia; dai' em diante a
     * batida decide sozinha. Se a leitura falhar, nao se inventa prazo nenhum: fica-se sem divida,
     * e no maximo perde-se a rodada de hoje — que e' o lado certo de errar.
     */
    const ficarADever = async (aviso) => {
      aviso(ESPERO_A_EXPEDICAO);
      if (cfg.devendo && Date.now() < cfg.devendo) return;
      const estado = await pedirEstado();
      if (!estado?.ok || !estado.tentativas.reinicia) return;
      cfg.devendo = estado.tentativas.reinicia;
      gravar();
      desenhar();
    };

    const pontosEmTexto = (pontos) =>
      pontos === null || pontos === 0 ? '' : `(${pontos > 0 ? '+' : ''}${pontos} pts)`;

    // ------------------------------------------------------------- o relogio

    const calendario = () => globalThis.PPX?.agenda || null;
    const esperaDaJanela = () =>
      calendario()?.esperaDaAgenda({ horarios: cfg.horarios, dias: cfg.dias }, cfg.ultima) ?? null;

    /**
     * O instante sorteado para esta ocorrência.
     *
     * `esperaDaAgenda` sorteia um ponto dentro da janela. Chama-la de novo em cada batida sorteava
     * sempre outro ponto a partir do novo "agora" — portanto o alvo corria vinte segundos para a
     * frente para sempre. Sorteia-se uma vez e, dali em diante, o relógio apenas se aproxima dele.
     */
    let proximaRodada = 0;
    const esquecerPlano = () => {
      proximaRodada = 0;
    };
    const faltaParaRodada = () => {
      const agora = Date.now();
      if (!proximaRodada) {
        const falta = esperaDaJanela();
        if (falta === null) return null;
        proximaRodada = agora + Math.max(0, falta);
      }
      return Math.max(0, proximaRodada - agora);
    };

    let relogio = 0;
    const bater = () => {
      if (!cfg.ligada || correndo) return;
      // A divida morre com o dia dela: a arena reseta as tentativas, e uma rodada de ontem feita
      // de madrugada seria a rodada de hoje gasta sem ninguem pedir. Ver `devendo`.
      if (cfg.devendo && Date.now() >= cfg.devendo) {
        cfg.devendo = 0;
        gravar();
        desenhar();
      }
      // A expedição e' esperada aqui tambem, e nao so' dentro da rodada: assim a batida nao abre a
      // janela da arena por cima do jogo dele a cada vinte segundos.
      if (naExpedicao()) {
        const falta = faltaParaRodada();
        if (falta !== null && falta <= 0) {
          cfg.ultima = Date.now();
          esquecerPlano();
          gravar();
          void ficarADever(dizer);
        }
        return;
      }
      if (cfg.devendo) {
        cfg.devendo = 0;
        gravar();
        void rodada(dizer);
        return;
      }
      const falta = faltaParaRodada();
      if (falta === null || falta > 0) return;
      cfg.ultima = Date.now();
      esquecerPlano();
      gravar();
      void rodada(dizer);
    };

    // ------------------------------------------------------------- o painel

    const painel = document.createElement('div');
    painel.id = 'lioncode-arena';
    painel.innerHTML = `
      <header>
        <strong data-titulo>Arena de Defesa</strong>
        <button type="button" data-minimizar title="Minimizar">–</button>
        <button type="button" data-fechar title="Esconder (Alt+M)">×</button>
      </header>
      <div class="resumo" data-resumo></div>
      <!-- Fora do corpo: o minimizar esconde o corpo, e iniciar, parar e atacar agora sao o que o
           dono quer alcançar sem abrir o painel. Ver o mesmo na Escada. -->
      <div class="botoes">
        <button type="button" class="ligar" data-ligar>Iniciar</button>
        <button type="button" data-agora title="Fazer a rodada agora, sem esperar o horário">Atacar agora</button>
      </div>
      <div class="corpo">
        <div data-agenda></div>
        <label class="caixa">intervalo entre ataques: de
          <input type="number" min="0" data-atraso-min> a
          <input type="number" min="0" data-atraso-max> s</label>
        <label class="caixa">ataques por rodada <input type="number" min="1" max="5" data-quantos></label>
        <label class="caixa">ataque salvo a carregar
          <input type="text" data-time placeholder="pvp1, ou 1"></label>
        <p class="vazio">quem me venceu, e fica de fora até a temporada virar:</p>
        <ul data-barrados></ul>
        <button type="button" class="mais" data-limpar>limpar a lista</button>
        <div data-config></div>
        <p class="estado" data-estado></p>
      </div>`;

    const estilo = document.createElement('style');
    estilo.textContent = `
      #lioncode-arena, #lioncode-arena * { box-sizing: border-box; }
      #lioncode-arena {
        position: fixed; z-index: 2147483000; width: 244px;
        background: #11161f; color: #e7edf6; border: 1px solid #2a3244; border-radius: 10px;
        font: 13px/1.45 system-ui, sans-serif; box-shadow: 0 8px 24px #0008;
      }
      #lioncode-arena header {
        display: flex; align-items: center; gap: 8px; padding: 8px 10px;
        border-bottom: 1px solid #2a3244; cursor: move;
      }
      #lioncode-arena header strong { flex: 1; font-size: 13px; }
      #lioncode-arena header button {
        background: none; border: 0; color: #8b97a8; cursor: pointer; font-size: 14px; padding: 0 2px;
      }
      #lioncode-arena .corpo { padding: 0 10px 10px; display: grid; gap: 8px; }
      #lioncode-arena.minimizado .corpo { display: none; }
      #lioncode-arena .resumo { padding: 6px 10px; color: #8b97a8; font-size: 12px; }
      #lioncode-arena .botoes { display: flex; gap: 6px; padding: 0 10px 10px; }
      #lioncode-arena.minimizado .botoes { padding: 0 9px 9px; }
      #lioncode-arena.minimizado .botoes button { padding: 4px 6px; font-size: 12px; }
      #lioncode-arena button.ligar, #lioncode-arena .botoes button, #lioncode-arena .mais {
        flex: 1; padding: 6px 8px; border-radius: 6px; border: 1px solid #2a3244;
        background: #182030; color: #e7edf6; cursor: pointer;
      }
      #lioncode-arena button.a-correr { background: #1d3a24; border-color: #2f6b3a; }
      #lioncode-arena .caixa { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; color: #c3ccda; }
      #lioncode-arena input {
        background: #0d1219; color: #e7edf6; border: 1px solid #2a3244; border-radius: 6px;
        padding: 4px 6px; min-width: 0;
      }
      #lioncode-arena input[type="number"] { width: 58px; }
      #lioncode-arena input[type="text"] { flex: 1; }
      #lioncode-arena ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; max-height: 120px; overflow: auto; }
      #lioncode-arena li { display: flex; gap: 6px; align-items: center; color: #c3ccda; font-size: 12px; }
      #lioncode-arena li button { background: none; border: 0; color: #8b97a8; cursor: pointer; }
      #lioncode-arena .vazio, #lioncode-arena .estado { color: #8b97a8; font-size: 12px; margin: 0; }
      #lioncode-arena .mau { color: #f85149; }
      #lioncode-arena .campo-mau { border-color: #f85149; }
    `;
    document.documentElement.append(estilo, painel);

    const campo = (seletor) => painel.querySelector(seletor);

    let ultimoAviso = '';
    const dizer = (texto, mau = false) => {
      ultimoAviso = texto;
      const el = campo('[data-estado]');
      el.textContent = texto;
      el.classList.toggle('mau', mau === true);
      pintarResumo();
    };

    const CORES = { vitoria: '#3fb950', derrota: '#f85149', erro: '#d29922' };

    const pintarResumo = () => {
      const linhas = placar().linhas;
      const marcas = linhas
        .map((l) => `<span style="color:${CORES[l.estado] || '#8b97a8'}">●</span>`)
        .join('');
      const falta = cfg.ligada && !cfg.devendo ? faltaParaRodada() : null;
      const quando = !cfg.ligada
        ? 'parada'
        : naExpedicao()
          ? 'depois da expedição'
          : cfg.devendo
            ? 'assim que der'
            : falta === null
              ? 'parada'
              : falta <= 0
                ? 'agora'
                : `em ${Math.ceil(falta / 60000)} min`;
      campo('[data-resumo]').innerHTML = `${marcas || '—'} <span>${quando}</span>`;
    };

    const desenhar = () => {
      const ligar = campo('[data-ligar]');
      ligar.textContent = cfg.ligada ? 'Parar' : 'Iniciar';
      ligar.classList.toggle('a-correr', cfg.ligada);
      campo('[data-atraso-min]').value = cfg.atrasoMin ?? '';
      campo('[data-atraso-max]').value = cfg.atrasoMax ?? '';
      campo('[data-quantos]').value = cfg.quantos ?? '';
      campo('[data-time]').value = cfg.time || '';

      const lista = campo('[data-barrados]');
      lista.innerHTML = '';
      const ids = Object.keys(cfg.barrados);
      for (const id of ids) {
        const li = document.createElement('li');
        const nome = document.createElement('span');
        nome.style.flex = '1';
        nome.textContent = cfg.barrados[id]?.nome || id.slice(0, 8);
        const tirar = document.createElement('button');
        tirar.type = 'button';
        tirar.textContent = '×';
        tirar.title = 'Dar outra chance a este';
        tirar.addEventListener('click', () => {
          const { [id]: fora, ...resto } = cfg.barrados;
          void fora;
          cfg.barrados = resto;
          gravar();
          desenhar();
        });
        li.append(nome, tirar);
        lista.append(li);
      }
      campo('[data-limpar]').style.display = ids.length ? '' : 'none';
      lista.previousElementSibling.textContent = ids.length
        ? 'quem me venceu, e fica de fora até a temporada virar:'
        : 'ninguém me venceu nesta temporada.';
      pintarResumo();
    };

    // -------------------------------------------------------- a agenda, do calendário

    const horas = document.createElement('input');
    horas.type = 'text';
    horas.setAttribute('data-horarios', '');
    horas.placeholder = '13:00-15:00';
    horas.title = 'A janela de horário. A rodada cai num instante sorteado dentro dela.';
    const rotuloHoras = document.createElement('label');
    rotuloHoras.className = 'caixa';
    rotuloHoras.append('entre ', horas);

    const editor = calendario()?.montarControles({
      resumoDe: (texto) => calendario().resumo({ dias: texto, horarios: horas.value.trim() }),
    });
    const campoDias = editor ? editor.campo : document.createElement('input');
    if (editor) {
      campo('[data-agenda]').append(editor.el);
      editor.corpo.prepend(rotuloHoras);
    } else {
      campo('[data-agenda]').append(rotuloHoras);
    }
    horas.value = cfg.horarios || '';
    if (editor) editor.escrever(cfg.dias || '');
    else campoDias.value = cfg.dias || '';

    const agendaMudou = () => {
      cfg.horarios = horas.value.trim();
      cfg.dias = campoDias.value.trim();
      // Mexer na agenda e' mudar de ideia sobre quando: o carimbo da ultima rodada era da agenda
      // antiga, e guarda-lo faria a janela nova passar por ja' usada.
      cfg.ultima = 0;
      esquecerPlano();
      gravar();
      // Horario que ninguem entende nao vira "todo dia" — ver o AGENTS.md. O campo fica marcado.
      const bom = calendario()
        ? calendario().valida({ horarios: cfg.horarios, dias: cfg.dias })
        : true;
      horas.classList.toggle('campo-mau', Boolean(cfg.horarios) && !bom);
      editor?.resumir?.();
      desenhar();
    };
    horas.addEventListener('change', agendaMudou);
    campoDias.addEventListener('change', agendaMudou);

    // -------------------------------------------------------- quem escuta

    for (const [qual, chave, menor, maior] of [
      ['[data-atraso-min]', 'atrasoMin', 0, 3600],
      ['[data-atraso-max]', 'atrasoMax', 0, 3600],
      ['[data-quantos]', 'quantos', 1, 5],
    ])
      campo(qual).addEventListener('change', (e) => {
        const v = Number(e.target.value);
        cfg[chave] = Number.isFinite(v)
          ? Math.min(maior, Math.max(menor, Math.round(v)))
          : PADRAO[chave];
        // Um minimo acima do maximo nao e' uma faixa: e' um engano, e corrige-se para o mais lento.
        if (cfg.atrasoMax < cfg.atrasoMin) cfg.atrasoMax = cfg.atrasoMin;
        gravar();
        desenhar();
      });

    campo('[data-time]').addEventListener('change', (e) => {
      cfg.time = e.target.value.trim();
      gravar();
    });

    campo('[data-ligar]').addEventListener('click', () => {
      cfg.ligada = !cfg.ligada;
      esquecerPlano();
      if (!cfg.ligada) parar = true;
      gravar();
      desenhar();
      dizer(cfg.ligada ? 'Ligada. Espero o horário.' : 'Parada.');
    });

    campo('[data-agora]').addEventListener('click', () => {
      if (correndo) {
        parar = true;
        dizer('Vou parar depois deste ataque.');
        return;
      }
      cfg.ultima = Date.now();
      cfg.devendo = 0;
      esquecerPlano();
      gravar();
      void rodada(dizer);
    });

    campo('[data-limpar]').addEventListener('click', () => {
      cfg.barrados = {};
      gravar();
      desenhar();
      dizer('Lista limpa: todos voltam a valer.');
    });

    const botoesConfig = globalThis.PPX?.config?.montarBotoes({
      id: 'arena',
      nome: 'Arena de Defesa',
      coletar: () => ({
        // `ultima` e os barrados ficam de fora: o carimbo faria a janela de hoje passar por usada
        // noutra conta, e a lista de quem venceu e' o retrato desta conta, não uma configuração.
        horarios: cfg.horarios,
        dias: cfg.dias,
        atrasoMin: cfg.atrasoMin,
        atrasoMax: cfg.atrasoMax,
        quantos: cfg.quantos,
        time: cfg.time,
      }),
      aplicar: (dados) => {
        if (correndo) throw new Error('não dá para importar no meio de uma rodada — pare primeiro');
        const numero = (v, menor, maior, padrao) => {
          const n = Number(v);
          return Number.isFinite(n) ? Math.min(maior, Math.max(menor, Math.round(n))) : padrao;
        };
        cfg.horarios = String(dados?.horarios ?? '').slice(0, 120);
        cfg.dias = String(dados?.dias ?? '').slice(0, 120);
        cfg.atrasoMin = numero(dados?.atrasoMin, 0, 3600, PADRAO.atrasoMin);
        cfg.atrasoMax = numero(dados?.atrasoMax, cfg.atrasoMin, 3600, PADRAO.atrasoMax);
        cfg.quantos = numero(dados?.quantos, 1, 5, PADRAO.quantos);
        cfg.time = String(dados?.time ?? '').slice(0, 60);
        cfg.ultima = 0;
        gravar();
        horas.value = cfg.horarios;
        if (editor) editor.escrever(cfg.dias);
        else campoDias.value = cfg.dias;
        desenhar();
      },
      avisar: dizer,
    });
    if (botoesConfig) campo('[data-config]').append(botoesConfig.el);

    // -------------------------------------------------------- a janelinha

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
      campo('[data-titulo]').textContent = minimizado ? 'ARE' : 'Arena de Defesa';
      const botao = campo('[data-minimizar]');
      botao.textContent = minimizado ? '□' : '–';
      botao.title = minimizado ? 'Mostrar tudo' : 'Minimizar';
      recolocar();
    };

    campo('[data-minimizar]').addEventListener('click', () => {
      minimizado = !minimizado;
      gravarChave(CHAVE_MIN, minimizado);
      aplicarMinimo();
    });

    campo('[data-fechar]').addEventListener('click', () => {
      mostrarPainel(false);
      globalThis.PPX?.anotar?.('arena', false);
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
        if (pos) gravarChave(CHAVE_POS, pos);
      });
    }

    addEventListener('resize', recolocar);
    addEventListener('keydown', (evento) => {
      if (!evento.altKey || evento.ctrlKey || evento.metaKey) return;
      if (evento.code !== 'KeyM') return;
      evento.preventDefault();
      mostrarPainel(evento.shiftKey === true);
      globalThis.PPX?.anotar?.('arena', evento.shiftKey === true);
    });

    desenhar();
    aplicarMinimo();
    recolocar();
    pintar();
    dizer(ultimoAviso || (cfg.ligada ? 'Ligada. Espero o horário.' : 'Parada.'));

    if (globalThis.PPX) {
      globalThis.PPX.controlar?.('arena', mostrarPainel);
      mostrarPainel(globalThis.PPX.visivel?.('arena') !== false);
    }

    relogio = setInterval(bater, 20000);
    addEventListener('pagehide', () => clearInterval(relogio));
  },
);
