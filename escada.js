// Escada de caçadas: troca de caçada sozinha quando o aluno sobe de nível.
//
// O QUE O JOGO DIZ, E O QUE ESTA FERRAMENTA DEDUZ. Medido em 11/10/2026, no jogo logado:
//
//  - `.pokeidle-team-card.is-leader` e' o jogo a dizer **quem esta' a subir**. Nao se deduz pela
//    posicao: ela ate' casa (o lider vai para a frente ao trocar), mas uma coisa que o jogo
//    afirma vale mais do que a mesma coisa adivinhada.
//  - `.pokeidle-team-card__level` da' "Nv.229" de cada um da equipe.
//  - `.pokeidle-trainer-hud__level` da' "Nível 260", o nivel do **treinador**. Nao e' o mesmo
//    numero e nao e' o que esta ferramenta olha: quem sobe de degrau e' o pokemon.
//
// A ESPERA DA TROCA ESTA' NO DOM, E NENHUMA LEITURA DESTA FERRAMENTA PRECISA DO MUNDO DA PAGINA. O
// jogo publica `PokeIdle.TeamLeaderCooldown.remainingMs()`, que seria o caminho obvio — mas ele
// mora em `window`, do lado da pagina. Nao e' preciso: as caixas que **nao** sao o lider trazem
// `title="Aguarde 3s para trocar de Pokémon ativo"` durante a espera. Mesma informacao, do lado de
// ca'. O mesmo vale para o morto: `is-fainted` e `title="Pokémon derrotado"`.
//
// HA' UMA PONTE, E E' SO' PARA A ENFERMEIRA. `escada-main.js` existe porque curar a equipe nao e'
// uma leitura: sao tres acoes do jogo em ordem — parar a caçada, ir para a cidade, curar — e
// nenhuma delas tem botao que esta ferramenta consiga achar e clicar com honestidade. Tudo o que
// esta ferramenta **le**' continua a vir do DOM; a ponte so' **age**, e so' nisso.
//
// E A ESPERA TEM DE SER RESPEITADA, porque o jogo recusa calado. Medido: clicar numa caixa dentro
// dos 3 s nao troca o lider, nao mostra aviso nenhum, e o clique **nao fica em fila** — passada a
// espera, continua como estava. Tratar isso como falha custaria dois minutos de castigo por tres
// segundos de espera; e nao o tratar de todo faria a ferramenta jurar que trocou.
//
// A troca em si levou **602 ms** a aparecer no DOM. Por isso nao se cronometra: espreita-se.
//
// A ORDEM E' ENFERMEIRA, VIAGEM, TROCA — E NAO O CONTRARIO. Ela ja' foi o contrario, e o defeito
// foi medido no jogo em 11/10/2026: o Scyther formou-se na caçada de Nidorina, a escada trocou para
// o Ralts Lv 1 **ali dentro**, e o Ralts morreu em 5 segundos. O jogo promoveu outro da equipe, a
// escada ficou em laço a tentar por um morto a' frente, e ninguem subiu de nivel nunca mais.
//
// A raiz nao era a ordem: era o degrau ser escolhido pelo nivel de **quem esta' a' frente**. Assim,
// a escada era obrigada a trocar primeiro para so' depois saber para onde ir. Com o degrau escolhido
// pelo nivel do **aluno** — ver `alunoDeAgora` — sabe-se o destino antes de trocar, e entao viaja-se
// com o forte ainda a' frente e troca-se so' depois de chegar. Quem esta' a' frente deixou de ser a
// pergunta e passou a ser a consequencia.
//
// ELA NAO PEDE A VEZ PARA VIAJAR. Quem viaja e' `PPX.cacadas.ir`, que pede a vez dele, e a fila
// nao e' reentrante entre donos — segurar a vez aqui deixaria a viagem a' espera de quem esta' a'
// espera dela. A vez e' pedida so' para o clique no HUD, que e' a unica acao que esta ferramenta
// faz no jogo com as proprias maos.
//
// E ELA E' A ULTIMA DA FILA, SEMPRE. Caçar e' o que o jogo faz sozinho o dia inteiro; ginasio,
// arena, venda e compra sao coisas que o dono mandou fazer agora, e qualquer uma delas vale mais
// do que um degrau que pode subir daqui a dois minutos. Entao, com alguem a segurar a vez **ou a'
// espera dela**, a caçada para onde esta' e volta sozinha quando a fila esvaziar — ver `cedendo`.
// Nao e' delicadeza: ela bate a cada mudança de HUD, e disputar a vez de igual para igual com quem
// roda uma vez por dia e' ganhar sempre.
//
// O QUE ELA NAO FAZ, E PORQUE. No pacote do Poke Idle World cada degrau pode escolher um time. Aqui
// nao: `PPX.cacadas.ir(nome)` monta sempre o time guardado **na propria caçada**, e nao aceita
// outro. Duas formas de escolher o time para a mesma viagem seriam duas verdades a divergir no
// primeiro dia; quem quer time diferente por degrau guarda a caçada duas vezes.

PPX.modulo(
  {
    id: 'escada',
    nome: 'Escada de caçadas',
    atalhos: 'Alt+U esconde · Alt+I mostra',
  },
  () => {
    'use strict';

    const CHAVE = 'lioncode:escada:config';
    const CHAVE_POS = 'lioncode:escada:posicao';
    const CHAVE_MIN = 'lioncode:escada:minimizado';

    /** Quanto se espera antes de tentar de novo, depois de uma viagem que nao deu certo. */
    const CASTIGO = 120000;

    /** Quanto se espera quando outra ferramenta esta' com a vez. Curto: ela ja' esta' a acabar. */
    const ATE_TENTAR_A_VEZ = 2000;

    /** Espreita-se a troca de 150 em 150 ms e desiste-se aos 3 s. Ela levou 602 ms, medidos. */
    const ATE_TROCAR = 3000;
    const ESPREITA = 150;

    /** A conversa com a ponte do mundo da pagina: parar a caçada, ir para a cidade, curar. */
    const PEDIDO = 'lioncode:escada:pedido';
    const RESPOSTA = 'lioncode:escada:resposta';
    /** A ponte troca mapa e fala com o servidor duas vezes; 20 s e' folgado de proposito. */
    const PACIENCIA = 20000;
    /** Quanto se espreita o HUD a' espera de a cura aparecer nele. */
    const ATE_CURAR = 12000;
    /** Quanto se espera para o jogo assentar antes de terminar o proprio movimento. Ver `retomar`. */
    const DEPOIS_DE_AGIR = 1200;
    /**
     * Ja' abri o painel por esta pergunta.
     *
     * Abrir uma vez e' avisar; abrir a cada batida seria discutir com quem o minimizou de proposito
     * — ele minimiza, a batida seguinte reabre, e ninguem ganha. Nao se guarda em disco: um F5 com
     * a pergunta no ar merece o aviso outra vez.
     */
    let jaAbri = false;
    let pedindoBichos = false;

    /**
     * Le' a coleção quando o painel precisa dela e ela ainda nao foi lida.
     *
     * A batida le'-a sozinha, mas **so' quando esta' ligada** — e configurar os turnos faz-se com
     * a escada parada, que e' justamente quando os nomes dos Pokemon dos times nao estariam la'.
     * Custa uma chamada a' API do jogo, sem abrir janela nenhuma.
     */
    const garantirColecao = () => {
      if (colecao.size || pedindoBichos || cfg.modo === 'escada') return;
      pedindoBichos = true;
      void pedirBichos()
        .then((lido) => {
          if (lido?.bichos?.length) {
            colecao = new Map(lido.bichos.map((b) => [b.id, b]));
            desenhar(false);
          }
        })
        .finally(() => {
          pedindoBichos = false;
        });
    };
    let proximoEco = 0;

    const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

    // ------------------------------------------------------------- o que se guarda

    const PADRAO = {
      /** `[{ nivel, cacada }]`, sempre ordenados por nivel. */
      degraus: [],
      /** O botao Iniciar/Parar. Parada, ela nao forma ninguem nem olha para degrau nenhum. */
      ligada: false,
      /**
       * Licenca para MUDAR DE CAÇADA sozinha. E' uma pergunta diferente de `ligada`: a escada pode
       * estar a correr — a formar o aluno, a dizer em que degrau ele deveria estar — sem ter
       * licenca para o arrastar para outro mapa.
       */
      trocar: true,
      /** O nivel do degrau que ja' foi aplicado. Sem isto, cada batida mandaria viajar de novo. */
      aplicado: null,
      /** O nivel em que um pokemon se forma e sai da fila. `null` = sem formatura. */
      teto: null,
      /**
       * De quantos em quantos niveis a equipe sobe **junta**, a caminho do teto. `null` = cada um
       * vai sozinho do nivel dele ate' o teto, que e' a escada de sempre.
       *
       * Pedido pelo dono em 12/10/2026: no modo de grupo ele ja' tinha "minimo Lv N e mais M
       * niveis", e queria o mesmo nos degraus — sem pedra em ninguem, todos a subir juntos. **E' um
       * passo, e nao um teto que foge**: ele corrigiu-me no mesmo dia, ao notar que a fila de times
       * tinha desaparecido do painel. Com o teto a fugir ninguem se formava nunca, e entao os
       * outros times nunca chegavam a vez — que e' o oposto do que ele queria. Ver `tetoDeAgora`.
       */
      subida: null,
      /**
       * O que fazer quando a equipe inteira se formar: `'nada'`, `'cacada'`, `'time'` ou `'cidade'`.
       *
       * Eram duas saidas (ir para uma caçada, ou ficar) e passaram a quatro a pedido do dono: com a
       * equipe toda no teto, o que ele quer e' trocar de time e continuar, ou guardar a equipe na
       * cidade e parar de vez.
       */
      fim: 'nada',
      /** Para onde ir quando `fim === 'cacada'`. */
      destino: '',
      /**
       * A fila de times a montar quando `fim === 'time'`, em ordem.
       *
       * Era um time so'. Virou fila a pedido do dono em 12/10/2026: formado o time 1, passa-se ao
       * 2, depois ao 3, e a escada sobe cada um deles ate' o teto. Quando o ultimo se forma, para.
       *
       * **Nao ha' contador de onde se esta' na fila, e isso e' deliberado** — ver `timeSeguinte`.
       */
      times: [],
      /**
       * Como ela upa: `'escada'` (um aluno de cada vez, viajando os degraus), `'grupo'` (um fixo
       * com a pedra e os outros a rodar, ate' um nivel) ou `'passo'` (o mesmo, subindo o alvo de
       * N em N).
       *
       * Sao tres caminhos que mexem na **mesma** equipe e na **mesma** caçada, e por isso sao uma
       * escolha e nao tres interruptores: dois a correr ao mesmo tempo tirariam da equipe o que o
       * outro acabou de por.
       */
      modo: 'escada',
      /** Pausa a pedido, ou porque outra ferramenta precisou da vez. Ver `cedendo`. */
      pausada: false,
      /** O modo de grupo. Ver `conferirGrupo`. */
      grupo: {
        /**
         * Onde o grupo fica, **em ordem de preferencia**.
         *
         * Nao e' um rodizio: fica-se na primeira da lista onde se consiga estar. A expedição
         * entra aqui no topo — enquanto ela durar, e' ali que se fica; acabada, cai-se para a
         * caçada seguinte, que esta ferramenta ja' consegue abrir sozinha.
         *
         * Nenhuma delas pode ter time guardado: a viagem apagaria o grupo.
         */
        cacadas: [],
        /**
         * Os turnos, em ordem: `{ fixo, times }`.
         *
         * Cada pedra da XP so' divide com Pokemon da sua regiao — hoje ha' a de Kanto e a de
         * Johto —, e **so' o Pokemon ativo divide** (medido pelo dono em 12/10/2026). Logo, duas
         * pedras na equipe ao mesmo tempo seriam um slot gasto a' toa: elas tem de se revezar.
         *
         * Um turno e' uma pedra com os seus times. Corre o primeiro que ainda tenha alguem abaixo
         * do alvo; acabados todos, a rodada fecha e tudo recomeça do primeiro.
         *
         * A regiao nao e' conferida aqui, e de proposito: quem diz qual Pokemon pertence a qual
         * pedra e' o dono, ao por os times certos no turno certo. Adivinhar a regiao pelo
         * `species_id` seria apostar que o jogo numera como a Pokedex nacional, e isso nao foi
         * medido. Enganar-se custa XP perdida, nao estraga nada: quem nao e' da regiao apenas nao
         * recebe.
         */
        turnos: [],
        /** O nivel em que um rodante sai do grupo, no modo `'grupo'`. */
        alvo: null,
        /** O chao da primeira rodada, no modo `'passo'`. */
        minimo: null,
        /** De quanto em quanto sobe o alvo, no modo `'passo'`. */
        passo: null,
        /**
         * Quantas rodadas de `passo` ja' fecharam. O alvo de agora sai daqui.
         *
         * E' o unico estado que o modo de grupo guarda, e e' porque o jogo nao o tem: "ja' subiram
         * 5 niveis desde que eu pedi" nao esta' escrito em parte nenhuma. **Quem chegou ao alvo
         * nao se guarda**, porque o nivel do bicho ja' diz — uma lista de "feitos" ao lado seria
         * uma segunda verdade sobre a mesma coisa, pronta a divergir no primeiro F5.
         */
        rodada: 0,
      },
      /**
       * A resposta a' pergunta do fim da fila de times: `''` (ainda nao respondeu), `'nada'`,
       * `'cidade'`, `'time'` ou `'parar'`.
       *
       * Pedido em 12/10/2026: acabada a fila, ela **pergunta** em vez de decidir. A resposta vale
       * para esta vez — comeca uma volta nova, a pergunta e' nova (ver `conferir`).
       */
      depois: '',
      /**
       * A mesma resposta, mas **guardada**: `''` pergunta todas as vezes, e qualquer uma das
       * outras quatro responde sozinha e nao pergunta mais.
       *
       * Pedido em 13/10/2026, com a pergunta na tela pela enesima vez: "sempre vai aparecer essa
       * pergunta?". A pergunta nasceu certa — acabada a fila, o que ele quer depende do que
       * aconteceu — mas quem roda a mesma volta todas as noites ja' sabe a resposta antes de ela
       * ser feita, e um painel que pergunta o que ja' foi respondido e' um painel que espera.
       *
       * Fica **ao lado** da pergunta, e nao no lugar dela: marcar a caixinha e' responder "e daqui
       * em diante tambem". Desmarcar devolve a pergunta. Um padrao escolhido por mim seria decidir
       * por ele a coisa que esta ferramenta de proposito nao decide.
       */
      sempre: '',
      /** Ja' cumpriu o fim da escada. Serve para nao arrastar a equipe de volta. */
      formados: false,
      /** De quem e' esta escada. Trocar de aluno recomeça a contagem do degrau cumprido. */
      aluno: '',
    };

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

    let cfg = { ...PADRAO, ...(ler(CHAVE, null) || {}) };
    if (!Array.isArray(cfg.degraus)) cfg.degraus = [];
    // Quem ja' tinha escolhido um destino escolheu "ir para uma caçada" antes de a pergunta
    // existir. Nao se perde a escolha de ninguem por ter nascido um campo novo.
    if (!cfg.fim) cfg.fim = cfg.destino ? 'cacada' : 'nada';
    // O time unico de antes e' o primeiro da fila de agora: ninguem perde a escolha que fez por a
    // pergunta ter crescido. O campo velho sai, para nao ficarem duas verdades sobre o mesmo.
    // Duas linhas, e a primeira nao basta: o PADRAO ja' entrega `times: []`, entao uma config
    // antiga chega aqui com uma fila vazia e `Array.isArray` satisfeito. Quem decide e' a fila
    // estar vazia **e** haver um time velho. Pego pela banca em 12/10/2026.
    if (!Array.isArray(cfg.times)) cfg.times = [];
    // Quem ja' tinha escada tinha o unico modo que existia. O modo novo nasce desligado.
    if (!cfg.modo) cfg.modo = 'escada';
    cfg.grupo = { ...PADRAO.grupo, ...(cfg.grupo || {}) };
    if (!Array.isArray(cfg.grupo.times)) cfg.grupo.times = [];
    // A caçada unica do modo de grupo virou uma lista em ordem. Mesma licao da fila de times: o
    // PADRAO ja' da' uma lista vazia, entao quem decide e' a lista estar vazia **e** haver uma
    // caçada velha.
    if (!Array.isArray(cfg.grupo.cacadas)) cfg.grupo.cacadas = [];
    if (!cfg.grupo.cacadas.length && cfg.grupo.cacada) cfg.grupo.cacadas = [cfg.grupo.cacada];
    delete cfg.grupo.cacada;
    // O fixo e os times soltos viram o primeiro turno. `.filter(Boolean)` e nao `semVazios`: a
    // migracao corre antes de o modulo ter funcoes.
    if (!Array.isArray(cfg.grupo.turnos)) cfg.grupo.turnos = [];
    if (
      !cfg.grupo.turnos.length &&
      (cfg.grupo.fixo || (cfg.grupo.times || []).filter(Boolean).length)
    )
      cfg.grupo.turnos = [{ fixo: cfg.grupo.fixo || '', times: cfg.grupo.times || [] }];
    delete cfg.grupo.fixo;
    delete cfg.grupo.times;
    if (!cfg.times.length && cfg.time) cfg.times = [cfg.time];
    delete cfg.time;
    const gravar = () => gravarChave(CHAVE, cfg);

    const ordenar = () => cfg.degraus.sort((a, b) => a.nivel - b.nivel);

    // ------------------------------------------------------------- ler o jogo

    /**
     * O numero de dentro de um texto, ou `null`.
     *
     * `null` e' diferente de zero e tem de continuar a ser: um HUD que ainda nao carregou nao e'
     * um lider de nivel 1, e tratar os dois como a mesma coisa faria a escada disparar o degrau
     * mais baixo a cada recarga da pagina.
     */
    const numero = (txt) => {
      const n = String(txt ?? '').match(/(\d+)/);
      return n ? Number(n[1]) : null;
    };

    /**
     * Quanto falta, em ms, ate' o jogo deixar trocar de pokemon ativo.
     *
     * Vem do `title` da caixa: "Aguarde 3s para trocar de Pokémon ativo". A caixa do proprio lider
     * diz "Pokémon ativo" e as outras, fora da espera, "Clique para tornar este Pokémon ativo" —
     * nenhuma das duas tem numero, e por isso nenhuma das duas e' espera.
     */
    const esperaDaCaixa = (el) => {
      const t = el?.getAttribute?.('title') || '';
      if (!/aguarde/i.test(t)) return 0;
      const s = numero(t);
      return s === null ? 0 : s * 1000;
    };

    /**
     * A equipe na ordem do HUD. As caixas vazias ("Adicionar Pokémon à equipe") nao entram: elas
     * nao tem `data-creature-id`, e e' por ai' que se separam.
     */
    const equipe = () =>
      [...document.querySelectorAll('.pokeidle-team-card[data-creature-id]')].map((el, i) => ({
        el,
        i,
        id: el.getAttribute('data-creature-id') || '',
        nome: (el.querySelector('.pokeidle-team-card__name')?.textContent || '').trim(),
        nivel: numero(el.querySelector('.pokeidle-team-card__level')?.textContent),
        lider: el.classList?.contains?.('is-leader') === true,
        // O jogo marca o derrotado com `is-fainted` e `title="Pokémon derrotado"`. Medido na conta
        // real em 11/10/2026, com o Ralts Lv 1 morto: o jogo **recusa calado** o clique numa caixa
        // morta, exactamente como recusa dentro da espera de 3 s. Um aluno morto nao e' um aluno
        // ocupado — e' um aluno que precisa de enfermeira.
        morto: el.classList?.contains?.('is-fainted') === true,
        espera: esperaDaCaixa(el),
      }));

    const caixaDoLider = () => equipe().find((p) => p.lider) || null;
    const nivelLider = () => caixaDoLider()?.nivel ?? null;
    const nomeLider = () => caixaDoLider()?.nome || '';

    /**
     * Ate' onde se sobe **agora** — que com `subida` nao e' o teto, e' o degrau seguinte.
     *
     * Sem `subida`, o aluno vai do nivel dele direito ao teto e so' entao passa a vez: o primeiro
     * da equipe chega ao 155 enquanto os outros cinco continuam no 1. Com `subida`, a equipe sobe
     * **junta** — cada um vai ate' `menor + subida`, passa a vez ao seguinte, e quando todos
     * chegam a conta anda outro passo. Com 145/145/145, teto 155 e passo 10, o degrau de agora e'
     * 155; com passo 2, e' 147, depois 149, ate' 155.
     *
     * **O TETO NUNCA FICA ABAIXO DE ONDE A EQUIPE JA' ESTA'.** Medido na conta do dono em
     * 13/10/2026: equipe com varios no 151 e dois atrasados (Lv 1 e Lv 100), teto 140, passo 2. Os
     * dois subiram de 2 em 2 ate' ao 140 — e ai' a escada deu a equipe inteira por formada e parou,
     * porque toda ela estava em 140 ou acima. So' que a equipe nao estava nivelada: faltavam onze
     * niveis para os atrasados alcançarem os outros, que e' a coisa para que este modo existe.
     *
     * Entao o fim da volta e' `max(teto, maior da equipe)`. Com os outros no 151, os atrasados
     * sobem ate' ao 151, e so' quando os seis empatam e' que a equipe se forma e a fila de times
     * entra. Um teto escrito mais baixo do que a equipe ja' esta' nao e' um fim: e' um numero
     * velho, e parar nele e' parar por causa do passado.
     *
     * **O TETO CONTINUA A SER UM FIM** quando ele esta' a' frente da equipe. O `Math.min` e' a
     * linha que faz a fila de times existir: sem ela a conta passava do 155 para o 157 e ninguem se
     * formava nunca, entao o fim da escada — ir a' cidade, trocar de time, continuar — nao
     * acontecia uma unica vez. Foi assim que isto nasceu errado, e o dono apanhou-o no mesmo dia:
     * "nao encontro onde colocar os outros times".
     *
     * **E O PASSO VALE SOZINHO, SEM TETO NENHUM.** Pedido em 13/10/2026: so' o passo preenchido
     * quer dizer "mantenha a equipe nivelada, de tantos em tantos niveis, para sempre". Ninguem se
     * forma (o fim da escada pede `cfg.teto`), e entao a fila de times nao e' chamada — que e'
     * exactamente o que "sem fim" quer dizer.
     *
     * **NAO HA' CONTADOR DE RODADAS AQUI, E E' DE PROPOSITO.** O modo de grupo guarda um, porque
     * la' o alvo nao esta' escrito em parte nenhuma do jogo. Aqui esta': o degrau de agora sai do
     * **menor nivel da equipe**, e o jogo diz o nivel de cada um. Um contador ao lado seria uma
     * segunda verdade sobre a mesma coisa, pronta a divergir no primeiro F5 — e, pior, a ficar
     * errada quando o dono mete um Lv 1 na equipe. Derivado, o Lv 1 puxa a conta para baixo e e'
     * ele o proximo aluno, que e' exactamente o que se quer.
     */
    const tetoDeAgora = () => {
      const teto = Number(cfg.teto) || 0;
      const subida = Number(cfg.subida) || 0;
      if (!subida) return teto || null;
      const niveis = equipe()
        .map((p) => p.nivel)
        .filter((n) => n !== null);
      if (!niveis.length) return teto || null;
      const menor = Math.min(...niveis);
      // Sem teto nao ha' fim: a equipe sobe nivelada enquanto a escada estiver ligada.
      const fim = teto ? Math.max(teto, ...niveis) : 0;
      if (fim && menor >= fim) return fim;
      const passo = menor + subida;
      return fim ? Math.min(fim, passo) : passo;
    };

    /** Formado = chegou ao teto de agora. Sem teto ninguem se forma, e a escada e' a de sempre. */
    const formado = (p, teto = tetoDeAgora()) =>
      Boolean(teto) && p.nivel !== null && p.nivel >= teto;

    /**
     * Quem deveria estar a subir agora: o **primeiro da equipe que ainda nao se formou**.
     *
     * Em ordem de equipe, e nao o mais baixo: a lista e' a ordem que o dono montou, e pular para o
     * menor seria inventar uma prioridade que ninguem pediu.
     */
    const proximoAluno = () => {
      // O teto le-se uma vez, e nao a cada bicho: `tetoDeAgora` varre a equipe toda, e perguntar
      // por cada um seria varrer seis vezes a mesma lista para dar sempre a mesma resposta.
      const teto = tetoDeAgora();
      return equipe().find((p) => p.nivel !== null && !formado(p, teto)) || null;
    };

    /**
     * **O ALUNO E' O SUJEITO DESTA FERRAMENTA, E NAO O LIDER.**
     *
     * Esta distincao e' a correccao de um defeito medido no jogo em 11/10/2026. Antes, o degrau era
     * escolhido pelo nivel de quem estava a' frente — e por isso a escada era obrigada a trocar
     * **primeiro** para so' depois saber para onde ir. O Scyther formou-se na caçada de Nidorina, o
     * Ralts Lv 1 foi posto a' frente ali dentro, e morreu em 5 segundos. O jogo promoveu outro, a
     * escada ficou em laço a tentar por um morto a' frente, e ninguem subiu de nivel nunca.
     *
     * Com o aluno como sujeito, a ordem certa cai por si: sabe-se o degrau **antes** de trocar, e
     * entao viaja-se com o forte ainda a' frente e troca-se so' depois de chegar. Quem esta' a'
     * frente deixa de ser a pergunta e passa a ser a consequencia.
     *
     * Sem teto nao ha' fila nem formatura: o aluno e' quem o dono poe a' frente, e esta ferramenta
     * nunca mexe nisso.
     */
    const alunoDeAgora = () => (cfg.teto ? proximoAluno() : caixaDoLider());

    /**
     * Em que caçada se esta', pela porta das Caçadas.
     *
     * Uma porta, nao duas: a ferramenta Caçadas ja' le' `.platform-hunt__zone-name`, com os testes
     * dela. Com ela desligada nao ha' de onde ler — e tambem nao haveria para onde viajar, porque
     * o `ir` e' dela. Por isso "nao sei onde estou" e "nao posso viajar" sao, aqui, o mesmo estado.
     */
    const local = () => globalThis.PPX?.cacadas?.atual?.()?.nome || '';

    /**
     * Se o jogador esta' **dentro** da expedição agora.
     *
     * Quem responde e' a porta das Caçadas, que le' o HUD da corrida — e nao uma leitura daqui.
     * A expedição nao tem zona de caçada nenhuma, entao `local()` devolve o nome do mapa e
     * compara-lo com o degrau nunca da' igual: por isso ela precisa de ser perguntada pelo tipo.
     */
    const naExpedicao = () => globalThis.PPX?.cacadas?.atual?.()?.tipo === 'expedicao';

    /** A frase da espera. Uma so': a razao de esperar e' a mesma nos tres modos. */
    const NA_EXPEDICAO = 'Você está na expedição — espero aqui e continuo quando ela acabar.';

    /**
     * Se o jogador nao esta' em caçada **nenhuma** — numa cidade, tipicamente.
     *
     * **SAIR PARA OUTRA CAÇADA E SAIR PARA LUGAR NENHUM NAO SAO A MESMA COISA**, e durante muito
     * tempo esta ferramenta tratou as duas como uma so'. "Voce' saiu de la', fique a' vontade" e'
     * uma regra para respeitar quem escolheu outra caçada; na cidade nao ha' escolha nenhuma a
     * respeitar — ha' uma equipe parada a ganhar zero XP, e o degrau seguinte, que so' chega com
     * XP, nunca chega. A escada ficava parada para sempre a dizer que estava tudo bem.
     *
     * Medido na conta do dono em 13/10/2026: Scizor Lv 34 na Cidade de Cerulean, degrau de Lv 30
     * cumprido, "fique a' vontade" na tela — e nada a acontecer, nem ali nem no Lv 40. Quem o tirou
     * da caçada foi o ginasio, a troca de time ou a propria mao dele; o resultado e' o mesmo, e
     * ficar parado nunca e' o que ele queria de uma escada ligada.
     *
     * A porta das Caçadas devolve `null` fora de caçada e de expedição. Sem a ferramenta das
     * Caçadas ninguem responde — e entao nao se adivinha: `local()` vazio por falta de porta nao e'
     * prova de cidade. Ver `temPorta`.
     */
    const temPorta = () => typeof globalThis.PPX?.cacadas?.atual === 'function';
    const emLugarNenhum = () => temPorta() && globalThis.PPX.cacadas.atual() === null;

    const cacadasDoGrupo = () => semVazios(cfg.grupo.cacadas);

    /**
     * Onde o grupo esta' e, se nao estiver em lugar nenhum da lista, para onde deve ir.
     *
     * **A ordem e' preferencia para quando se esta' fora, e nao uma ordem a cumprir.** Estar na
     * terceira da lista basta: subir dai' para a primeira a cada batida seria trocar de caçada
     * por nada, e cada troca custa a viagem e o risco de um modal pelo meio.
     *
     * E ha' lugares em que **ela nao consegue entrar** — a expedição e' um: nao esta' na lista da
     * janela das caçadas, entra-se por um menu, e so' existe enquanto dura. Por isso ela nao e'
     * um destino; e' um lugar que, estando-se la', se respeita. Acabada a expedição, o jogo
     * devolve o jogador a' caçada anterior e a lista segue para a primeira que da' para abrir.
     */
    const lugarDoGrupo = () => {
      const porta = globalThis.PPX?.cacadas;
      const lista = cacadasDoGrupo();
      const aqui = lista.find((nome) => porta?.estouEm?.(nome));
      if (aqui) return { aqui, ir: null };
      return { aqui: null, ir: lista.find((nome) => porta?.daParaIr?.(nome) !== false) || null };
    };

    /**
     * O primeiro degrau cuja caçada monta um time ao chegar, ou `null`.
     *
     * Serve so' para recusar o fim "trocar de time" quando ele nao poderia funcionar — ver
     * `fimDaEscada`. Em tudo o resto, um time guardado na caçada e' o normal e nao e' problema
     * nenhum: a escada nunca mexe no time, e a caçada monta o dela a cada ida.
     */
    const degrauComTime = () => {
      const timeDe = globalThis.PPX?.cacadas?.timeDe;
      if (typeof timeDe !== 'function') return null;
      for (const d of cfg.degraus) {
        if (!d.cacada) continue;
        const time = timeDe(d.cacada);
        if (time) return { ...d, time };
      }
      return null;
    };

    /** Uma lista de nomes sem as linhas em branco: uma linha por escolher nao e' um time. */
    const semVazios = (lista) => (lista || []).filter(Boolean);

    /** Os times da fila do fim da escada. */
    const fila = () => semVazios(cfg.times);

    /**
     * Onde se esta' na fila de times: o time montado agora e o que vem depois dele.
     *
     * **A FILA NAO TEM CONTADOR GUARDADO, E ISSO E' A DECISAO QUE IMPORTA.** Quem diz em que ponto
     * da fila se esta' e' a equipe que esta' na tela, pela porta `PPX.times.qual`. Um contador em
     * `localStorage` teria tres formas de mentir — o F5, uma troca de time a' mao, uma reordenacao
     * da lista — e cada uma delas mandaria montar o time errado por cima do trabalho feito.
     *
     * Sem a porta nao se adivinha: devolve `erro`. Montar "o primeiro" por desencargo seria o laço
     * de 12/10/2026 outra vez, com mais passos — monta o 1, ele ja' esta' formado, chega-se ao fim,
     * monta o 1 de novo.
     */
    const timeSeguinte = () => {
      const lista = fila();
      if (!lista.length) return { vazia: true };
      const qual = globalThis.PPX?.times?.qual;
      if (typeof qual !== 'function')
        return {
          erro:
            'A ferramenta Times não sabe dizer qual time está montado — recarregue a extensão. ' +
            'Sem isso eu não sei em que ponto da fila estou, e não monto às cegas.',
        };
      // Nenhum time guardado casa com a equipe da tela: comeca-se do inicio da fila, que e' a
      // unica leitura honesta de "esta equipe nao e' nenhum dos times da fila".
      const agora = qual();
      const i = agora ? lista.indexOf(agora) : -1;
      if (i < 0) return { montado: agora, nome: lista[0], posicao: 1, quantos: lista.length };
      return {
        montado: agora,
        nome: lista[i + 1] || null,
        posicao: i + 2,
        quantos: lista.length,
      };
    };

    /**
     * A mesma lista, no futuro: e' o que a resposta guardada **vai** fazer.
     *
     * Sao duas listas porque sao dois tempos. "Recomecei a fila de times" dito antes de recomecar
     * e' uma mentira pequena, e e' dita todas as noites: a resposta guardada anuncia-se antes de
     * agir, e o painel que repete uma accao ja' feita usa a outra.
     */
    const O_QUE_FAREI = {
      nada: 'fico aqui, caçando',
      cidade: 'volto para a cidade e curo',
      time: 'recomeço a fila de times',
      parar: 'paro a escada',
    };

    /** O que cada resposta da pergunta do fim da fila quer dizer, para o painel repetir. */
    const COMO_DEPOIS = {
      nada: 'Fico aqui, caçando.',
      cidade: 'Levei a equipe para a cidade e curei.',
      time: 'Recomecei a fila de times.',
      parar: 'Parei a escada.',
    };

    /**
     * A fila de times acabou e ha' uma pergunta no ar (ou uma resposta a repetir).
     *
     * Serve ao painel, para mostrar a listbox so' quando ela pergunta alguma coisa: uma listbox que
     * nao pergunta nada e' um campo a mais para quem olha de relance decifrar.
     */
    const filaAcabou = () => {
      if (cfg.fim !== 'time' || !cfg.teto) return false;
      if (!equipe().length || proximoAluno()) return false;
      const vez = timeSeguinte();
      return Boolean(!vez.vazia && !vez.erro && !vez.nome);
    };

    /**
     * A frase para quando o aluno nao esta' na equipe depois da viagem.
     *
     * MEDIDO NO JOGO EM 12/10/2026, e e' o unico sitio onde duas regras desta ferramenta se
     * atropelam. O fim da escada montou o time "novo", a escada reiniciou com o Dratini Lv 1 e
     * viajou para o degrau dele — e a viagem **remontou o time guardado na caçada**, que era
     * "Hunt", apagando o "novo" com o Dratini dentro. A escada entao procurou o aluno e nao o
     * achou. O que ela dizia era "Dratini não está na equipe desta caçada": verdade, inutil.
     *
     * A regra atropelada ja' estava escrita no cabeçalho — `PPX.cacadas.ir` monta **sempre** o time
     * guardado na propria caçada —, e continua a valer: quem manda no time da caçada e' a caçada.
     * A saida nao e' esta ferramenta passar a mandar tambem; e' dizer onde esta' o conflito e quais
     * sao as duas maneiras de o desfazer, ambas do dono.
     */
    const semOAluno = (aluno, degrau) => {
      const time = globalThis.PPX?.cacadas?.timeDe?.(degrau.cacada) || '';
      if (!time) return `${aluno.nome} não está na equipe desta caçada.`;
      return (
        `${aluno.nome} não está na equipe: a caçada "${degrau.cacada}" monta o time "${time}" ` +
        `ao chegar, e ele apagou o time que eu tinha montado. Tire o time dessa caçada nas ` +
        `Caçadas, ou ponha ${aluno.nome} no time "${time}".`
      );
    };

    /** As caçadas guardadas: as do dono, curtas, na ordem dele. */
    const cacadasGuardadas = () => globalThis.PPX?.cacadas?.nomes?.() || [];

    /**
     * Todas as caçadas que o pacote conhece — os atalhos do dono mais a lista do jogo.
     *
     * **POR QUE O CATALOGO INTEIRO, E NAO SO' OS ATALHOS.** Um degrau e' "a partir do Lv N, caçar
     * aqui", e a caçada certa para o Lv N e' uma questao de nivel: ela existe no jogo muito antes
     * de alguem ter ido la' guardar o atalho. Exigir o atalho primeiro fazia montar uma escada de
     * dez degraus custar dez viagens — e era o motivo pelo qual as escadas ficavam curtas.
     *
     * Sem a ferramenta Caçadas, ou antes de ela ler a lista, sobra o que havia: os atalhos.
     */
    const cacadasConhecidas = () => {
      const todas = globalThis.PPX?.cacadas?.todas?.();
      if (Array.isArray(todas) && todas.length) return todas;
      return cacadasGuardadas().map((nome) => ({
        nome,
        nivel: 0,
        regiao: '',
        trancada: false,
        minha: true,
      }));
    };

    /**
     * O degrau em que um lider de nivel `n` deveria estar: o mais alto que ele ja' alcancou.
     *
     * Nao e' "o degrau que acabou de passar" — e' o estado certo para aquele nivel. A diferenca
     * aparece ao ligar a escada com o lider ja' no Lv 80: o certo e' ir para o degrau de 80, e nao
     * ficar a' espera de passar pelo de 20.
     */
    const degrauPara = (n) => {
      if (n === null) return null;
      let achado = null;
      for (const d of cfg.degraus)
        if (d.nivel <= n && (!achado || d.nivel > achado.nivel)) achado = d;
      return achado;
    };

    /**
     * Em que nivel nasce o proximo degrau que se acrescentar.
     *
     * O primeiro nasce no **Lv 1**, e nao num numero redondo: uma escada cujo degrau mais baixo
     * esta' acima do lider nao faz nada, e e' assim que ela passaria a primeira noite parada.
     */
    const nivelDoProximo = () =>
      cfg.degraus.length ? cfg.degraus.reduce((m, d) => Math.max(m, d.nivel), 0) + 10 : 1;

    const primeiroDegrau = () =>
      cfg.degraus.reduce((m, d) => (!m || d.nivel < m.nivel ? d : m), null);

    // ------------------------------------------------------- o modo de grupo (a pedra da XP)

    /**
     * A colecao, como a ponte a leu na ultima batida: `id -> { id, nome, especie, nivel, onde }`.
     *
     * Fica em memoria porque o diagnostico e' **sincrono** e a leitura e' assincrona: sem cache, o
     * painel teria de dizer "espere" a cada repintura. Ninguem decide por ela sem a reler primeiro
     * — quem age usa a leitura da propria batida.
     */
    let colecao = new Map();

    /**
     * O nivel em que um rodante sai do grupo.
     *
     * No modo `'grupo'` e' um numero fixo. No `'passo'` ele **sobe**: a primeira rodada vai ao
     * minimo mais o passo, e cada rodada fechada acrescenta outro passo. Com o exemplo dele —
     * minimo 20, passo 5 — as rodadas sao 25, 30, 35. O minimo e' o chao de onde se parte, nao o
     * primeiro alvo: ele disse "quando chegarem no lvl 20, vai upar mais 5 leveis".
     */
    const alvoDoGrupo = () => {
      const g = cfg.grupo;
      if (cfg.modo === 'grupo') return Number(g.alvo) || null;
      const minimo = Number(g.minimo);
      const passo = Number(g.passo);
      if (!minimo || !passo) return null;
      return minimo + passo * ((Number(g.rodada) || 0) + 1);
    };

    /** O que falta escolher para o modo de grupo poder correr, ou `''`. */
    const faltaNoGrupo = () => {
      if (!globalThis.PPX?.times?.montar)
        return 'A ferramenta Times está desligada — é ela que mexe na equipe.';
      if (!cacadasDoGrupo().length)
        return 'Escolha onde o grupo fica — pode ser mais de uma, em ordem de preferência.';
      const turnos = turnosDoGrupo();
      if (!turnos.length) return 'Escolha quem tem a pedra e os times que ela vai upar.';
      const sabidos = globalThis.PPX?.times?.nomes?.();
      for (const [i, turno] of turnos.entries()) {
        const qual = turnos.length > 1 ? `Pedra ${i + 1}: e` : 'E';
        if (!turno.fixo) return `${qual}scolha o Pokémon que tem a pedra — ele nunca sai do grupo.`;
        const meus = semVazios(turno.times);
        if (!meus.length) return `${qual}scolha os times de onde vêm os que rodam.`;
        // **Um time que nao existe nesta conta nao e' um time.** Acontece a quem leva a configuracao
        // de uma janela para outra: os nomes vem juntos, os times ficam na conta de origem. Sem
        // isto, a escada dava o grupo por configurado, viajava, e so' entao descobria que nao tinha
        // de onde tirar ninguem. O painel ja' marcava "(nao guardado)" na lista; faltava recusar.
        if (Array.isArray(sabidos) && sabidos.length) {
          const orfao = meus.find((nome) => !sabidos.includes(nome));
          if (orfao)
            return `O time "${orfao}" não existe nesta conta — escolha outro, ou guarde-o nos Times.`;
        }
      }
      if (!alvoDoGrupo())
        return cfg.modo === 'grupo'
          ? 'Diga o nível em que eles saem do grupo.'
          : 'Diga o nível mínimo e de quantos em quantos níveis subir.';
      return '';
    };

    /**
     * Quem esta' a' frente desta ferramenta na fila — **e ela e' sempre a ultima, nos dois modos**.
     *
     * Pedido assim em 12/10/2026 para o modo de grupo, e alargado aos dois em 13/10/2026: a caçada
     * roda o dia inteiro e qualquer outra coisa que o dono mande fazer vale mais do que ela. Entao
     * ela nao disputa a vez: se alguem esta' com ela **ou a' espera dela**, a caçada para e volta
     * quando a fila esvaziar. Esperar na fila seria igualmente correcto e muito pior — o ginasio
     * pediria a vez e ficaria atras de uma troca de equipe de 30 segundos que ninguem tinha pressa
     * de fazer.
     *
     * **MEDIDO PELO DONO EM 13/10/2026:** com a escada de degraus a andar, o ginasio do dia nao
     * chegava a entrar. So' o modo de grupo cedia; o de degraus disputava a vez de igual para
     * igual, e quem bate a cada mudança de HUD bate muito mais vezes do que quem roda uma vez por
     * dia. Uma prioridade que vale so' num dos modos nao e' uma prioridade.
     *
     * Quem a acorda e' `PPX.vez.aoMudar`, la' em baixo: sem isso ela cederia e nunca voltaria.
     */
    const cedendo = () => {
      const vez = globalThis.PPX?.vez;
      if (!vez?.dono) return '';
      const nomeDe = (id) => vez.nome?.(id) || id;
      const dono = vez.dono();
      if (dono && dono.id !== 'escada') return nomeDe(dono.id);
      const outro = (vez.esperando?.() || []).find((id) => id !== 'escada');
      return outro ? nomeDe(outro) : '';
    };

    /**
     * Quem fica no grupo agora: o fixo mais os que ainda nao chegaram ao alvo.
     *
     * **Nao ha' "quem entra no lugar de quem": ha' a composicao certa para este instante**, e a
     * troca e' a diferenca entre ela e o HUD. Pensar em entradas e saidas exigiria guardar de quem
     * era cada vaga, e um F5 no meio deixaria essa conta a mentir.
     *
     * Tres regras que vem do jogo, e nao desta ferramenta:
     *
     * 1. **A equipe trava em 6**, entao o fixo mais cinco.
     * 2. **Especie nao repete na equipe** — o jogo recusa calado. Por isso um rodante da especie do
     *    fixo (ou de outro rodante ja' escolhido) e' saltado em vez de tentado.
     * 3. **Quem chegou ao alvo nao volta**, porque o nivel dele passou do alvo — nao por haver uma
     *    lista de formados.
     */
    const turnosDoGrupo = () => (cfg.grupo.turnos || []).filter(Boolean);

    /** Quem um turno upa: os membros dos times dele, menos o proprio fixo e sem repetidos. */
    const piscinaDoTurno = (turno, todos) => {
      const membrosDe = globalThis.PPX?.times?.membrosDe;
      if (typeof membrosDe !== 'function') return [];
      const vistos = new Set([turno.fixo]);
      const piscina = [];
      for (const nome of semVazios(turno.times || []))
        for (const id of membrosDe(nome)) {
          if (vistos.has(id)) continue;
          vistos.add(id);
          const bicho = todos.get(id);
          if (bicho) piscina.push(bicho);
        }
      return piscina;
    };

    /**
     * O turno a correr: o primeiro que ainda tem alguem abaixo do alvo.
     *
     * **Nao se guarda qual e'.** O nivel dos Pokemon ja' diz, como em todo o resto deste modo —
     * guardar "vai no turno 2" seria uma segunda verdade, pronta a mentir depois de um F5 ou de
     * uma troca feita a' mao. `null` quer dizer que nao falta ninguem em turno nenhum.
     */
    const turnoDeAgora = (todos, alvo) =>
      turnosDoGrupo().find((turno) => piscinaDoTurno(turno, todos).some((b) => b.nivel < alvo)) ||
      null;

    const montagemDoGrupo = (todos, alvo) => {
      const membrosDe = globalThis.PPX?.times?.membrosDe;
      if (typeof membrosDe !== 'function')
        return { erro: 'os Times não sabem dizer quem está em cada time — recarregue a extensão' };
      const turnos = turnosDoGrupo();
      const correndo = turnoDeAgora(todos, alvo);
      // Acabados todos, fica o primeiro: alguem tem de continuar a caçar, e a escolha tem de ser
      // sempre a mesma ou a equipe ficava a dançar entre as pedras sem ninguem a upar.
      const turno = correndo || turnos[0];
      if (!turno) return { erro: 'nenhuma pedra configurada' };
      const numero = turnos.indexOf(turno) + 1;

      const fixo = todos.get(turno.fixo);
      if (!fixo)
        return {
          erro:
            turnos.length > 1
              ? `o Pokémon da pedra ${numero} não está mais na coleção — escolha outro`
              : 'o Pokémon fixo não está mais na coleção — escolha outro na lista do fixo',
        };

      const piscina = piscinaDoTurno(turno, todos);
      const faltam = piscina.filter((b) => b.nivel < alvo);
      const especies = new Set([fixo.especie]);
      const escolhidos = [fixo];
      const saltados = [];
      for (const bicho of faltam) {
        if (escolhidos.length >= 6) break;
        if (especies.has(bicho.especie)) {
          saltados.push(bicho);
          continue;
        }
        especies.add(bicho.especie);
        escolhidos.push(bicho);
      }
      return {
        fixo,
        piscina,
        faltam,
        escolhidos,
        saltados,
        turno,
        numero,
        quantos: turnos.length,
        acabou: !correndo,
      };
    };

    /**
     * O que o modo de grupo esta' a fazer, ou a' espera de.
     *
     * Le' da `colecao` em cache, e diz quando ela ainda nao foi lida: um painel que inventa numeros
     * enquanto espera e' pior do que um painel que diz "ainda nao li".
     */
    const diagnosticoGrupo = () => {
      const falta = faltaNoGrupo();
      if (falta) return falta;
      const faltam = Math.ceil((esperaAte - Date.now()) / 1000);
      if (faltam > 0) return `Esperando ${faltam}s para tentar de novo.`;
      const alvo = alvoDoGrupo();
      if (!colecao.size) return `Alvo Lv ${alvo}. Ainda não li a coleção.`;
      const m = montagemDoGrupo(colecao, alvo);
      if (m.erro) return m.erro;
      const lugar = lugarDoGrupo();
      const onde = lugar.aqui ? `em "${lugar.aqui}"` : `fora da lista`;
      // Com mais de uma pedra no rodizio, dizer qual esta' a correr nao e' enfeite: e' a diferenca
      // entre "ela parou" e "ela esta' na segunda".
      const pedra = m.quantos > 1 ? `Pedra ${m.numero}/${m.quantos} (${m.fixo.nome}). ` : '';
      if (!m.faltam.length) {
        const quantos = m.acabou
          ? turnosDoGrupo().reduce((n, t) => n + piscinaDoTurno(t, colecao).length, 0)
          : m.piscina.length;
        const todos = `Todos os ${quantos} chegaram ao Lv ${alvo}`;
        return cfg.modo === 'passo'
          ? `${todos}. Rodada nova a caminho.`
          : `${todos}. Ficam fora do grupo e eu continuo a farmar ${onde}.`;
      }
      const grupo = m.escolhidos
        .slice(1)
        .map((b) => `${b.nome} Lv ${b.nivel}`)
        .join(', ');
      const fora = m.faltam.length - (m.escolhidos.length - 1);
      const resto = fora > 0 ? ` Na fila: ${fora}.` : '';
      const pulados = m.saltados.length
        ? ` Saltei ${m.saltados.length} por repetir espécie do grupo.`
        : '';
      return (
        `${pedra}Alvo Lv ${alvo}, ${onde} com ${m.fixo.nome} fixo. ` +
        `${grupo ? `Upando: ${grupo}.` : 'Grupo vazio.'}${resto}${pulados}`
      );
    };

    /**
     * Uma frase que explica a decisao de agora — mesmo quando a decisao e' nao fazer nada.
     *
     * Automacao parada e calada e' indistinguivel de automacao quebrada. Quem nao age tem de dizer
     * quem e' o sujeito, em que estado esta', que condicao falta e o que fazer para sair do impasse.
     */
    function diagnostico() {
      // A ordem destas tres respostas e' a ordem em que elas calam as outras: parada nao faz nada,
      // pausada nao faz nada agora, e so' depois importa qual dos modos esta' escolhido.
      if (!cfg.ligada) {
        if (cfg.modo !== 'escada')
          return 'Parada. Não mexo em nada — nem na equipe, nem na caçada.';
        return filaAcabou()
          ? 'Parada — mas a fila de times acabou. Escolha aí embaixo o que fazer.'
          : 'Parada. Não faço nada sozinha — mas o ▸ de cada degrau funciona.';
      }
      if (cfg.pausada)
        return cfg.modo === 'escada'
          ? 'Pausada. Clique em Retomar quando quiser.'
          : 'Pausada. A caçada continua; eu é que não mexo em nada.';
      // Antes dos dois modos, como no `conferir`: ceder a vez e esperar a expedição calam tudo o
      // resto, e calam-no igual nos tres modos.
      const outra = cedendo();
      if (outra) return `Esperando ${outra} terminar — a caçada é a última da fila.`;
      // Dentro da expedição nao falta nada, e' so' nao ser a vez dela. Ver `conferir`.
      if (naExpedicao()) return NA_EXPEDICAO;
      if (cfg.modo !== 'escada') return diagnosticoGrupo();
      // O castigo tem de ser dito. Medido na banca: depois de uma viagem falhada, o painel ficava
      // a repetir "falta ir para X" e nao ia — e quem olhasse so' a frase concluiria que ela tinha
      // quebrado. Esperar e' uma decisao como outra qualquer, e uma decisao diz-se.
      const faltam = Math.ceil((esperaAte - Date.now()) / 1000);
      // Neutra de proposito: por aqui passam tanto o castigo de uma viagem falhada quanto os 3 s
      // que o jogo pede entre trocas. Dizer "a ultima tentativa nao deu" na segunda e' falso — o
      // jogo so' pediu para esperar —, e o motivo verdadeiro ja' foi dito quando aconteceu.
      if (faltam > 0) return `Esperando ${faltam}s para tentar de novo — ou use o ▸ agora.`;
      if (!globalThis.PPX?.cacadas?.ir)
        return 'A ferramenta Caçadas está desligada — ligue-a no menu (Alt+Q). É ela que viaja.';
      if (!cacadasConhecidas().length)
        return 'Não conheço caçada nenhuma. Abra as Caçadas (Alt+E) e clique no ↻ para eu ler a lista do jogo.';
      if (!cfg.degraus.length) return 'Sem degraus. Um degrau é "a partir do nível N, caçar aqui".';

      // O fim da escada vem antes do degrau: com a equipe toda no teto nao ha' aluno, e dizer em
      // que degrau ele esta' seria responder a pergunta errada.
      if (cfg.teto && equipe().length && !proximoAluno()) {
        const todos = `A equipe toda chegou ao Lv ${tetoDeAgora()}.`;
        if (cfg.fim === 'cidade')
          return cfg.formados
            ? `${todos} Levei a equipe para a cidade e curei.`
            : `${todos} Falta voltar para a cidade.`;
        if (cfg.fim === 'time') {
          const vez = timeSeguinte();
          if (vez.vazia) return `${todos} Escolha os times da fila.`;
          if (vez.erro) return vez.erro;
          const tropeco = degrauComTime();
          if (tropeco)
            return (
              `${todos} Não monto time nenhum: a caçada "${tropeco.cacada}" do degrau ` +
              `de Lv ${tropeco.nivel} monta o time "${tropeco.time}" ao chegar e apagaria o meu. ` +
              `Tire o time dessa caçada nas Caçadas.`
            );
          if (!vez.nome) {
            const fim = `A fila de times acabou — "${vez.montado}" era o último dos ${vez.quantos}.`;
            if (!cfg.depois && !cfg.sempre)
              return `${todos} ${fim} O que faço agora? Escolha aí embaixo.`;
            return `${todos} ${fim} ${COMO_DEPOIS[cfg.depois || cfg.sempre] || ''}`.trim();
          }
          const quem = `"${vez.nome}" (${vez.posicao}º de ${vez.quantos})`;
          return `${todos} Falta ir para a cidade e montar o time ${quem}.`;
        }
        if (cfg.fim === 'cacada') {
          if (!cfg.destino) return `${todos} Escolha a caçada e eu paro lá.`;
          if (local() === cfg.destino) return `${todos} Parei a caçada em "${cfg.destino}".`;
          if (cfg.trocar !== true)
            return `${todos} Iria parar em "${cfg.destino}", mas não tenho licença para trocar de caçada.`;
          return `${todos} Falta ir para "${cfg.destino}".`;
        }
        return `${todos} Fico onde você estiver — é o que está escolhido.`;
      }

      const aluno = alunoDeAgora();
      if (!aluno || aluno.nivel === null) return 'Ainda não li o nível do líder.';
      const quem = aluno.nome || 'o líder';
      const n = aluno.nivel;

      // A enfermeira vem antes do degrau, como no motor: um morto nao sobe de nivel nenhum e o
      // jogo recusa calado o clique na caixa dele.
      if (aluno.morto) return `${quem} está derrotado. Falta levá-lo à enfermeira, na cidade.`;

      const degrau = degrauPara(n);
      if (!degrau) {
        const base = primeiroDegrau();
        return (
          `${quem} está no Lv ${n}, abaixo do primeiro degrau (Lv ${base.nivel}). ` +
          'Ponha um degrau em Lv 1 para começar já.'
        );
      }
      if (!degrau.cacada)
        return `Lv ${n}: o degrau de Lv ${degrau.nivel} não tem caçada escolhida.`;
      if (cfg.aplicado !== null && degrau.nivel < cfg.aplicado)
        return (
          `${quem} Lv ${n}: o degrau de Lv ${degrau.nivel} está abaixo do de Lv ${cfg.aplicado}, ` +
          'que já cumpri com ele. Não desço com o mesmo aluno.'
        );

      const naCacada = local() === degrau.cacada;
      // Fora do lugar e com um aluno para por a' frente: isto e' um impasse de proposito, e e' o
      // impasse que impede a morte que esta ordem veio evitar. Tem de ser dito por extenso.
      if (!naCacada && degrau.nivel === cfg.aplicado) {
        if (cfg.teto && !aluno.lider)
          return (
            `${quem} Lv ${n} deveria estar à frente, mas você saiu de "${degrau.cacada}". ` +
            'Não ponho um aluno fraco à frente fora da caçada dele — volte lá, ou use o ▸.'
          );
        if (emLugarNenhum())
          return cfg.trocar === true
            ? `${quem} Lv ${n}: fora de caçada nenhuma — vou voltar para "${degrau.cacada}".`
            : `${quem} Lv ${n}: fora de caçada nenhuma, e aqui ninguém ganha XP. Volte para ` +
                `"${degrau.cacada}", use o ▸, ou ligue "deixar trocar de caçada".`;
        return `${quem} Lv ${n}: degrau de Lv ${degrau.nivel} já cumprido. Você saiu de "${degrau.cacada}" — fique à vontade.`;
      }
      if (!naCacada) {
        if (cfg.trocar !== true)
          return `${quem} Lv ${n}: iria para "${degrau.cacada}", mas não tenho licença para trocar de caçada. Use o ▸.`;
        return `${quem} Lv ${n}: falta ir para "${degrau.cacada}".`;
      }
      if (cfg.teto && !aluno.lider)
        return `${quem} Lv ${n}: em "${degrau.cacada}" — falta pô-lo à frente.`;
      return `${quem} Lv ${n}: em "${degrau.cacada}", como manda o degrau de Lv ${degrau.nivel}.`;
    }

    // ------------------------------------------------------------- o motor

    let correndo = false;
    let esperaAte = 0;
    /** A unica batida pendente. Ver `batidaEm`. */
    let proximaBatida = 0;
    /** A ultima assinatura da equipe. So' se faz contas quando ela muda: o HUD bate a cada ponto
     * de vida, e os pontos de vida nao entram nela. */
    let visto = null;

    /**
     * Pede a vez — e so' para o clique no HUD.
     *
     * De resto a escada nao pede a vez: ver o cabeçalho deste arquivo.
     */
    const esperarAVez = async () => {
      const vez = globalThis.PPX?.vez;
      if (!vez?.pedir) return () => {};
      return vez.pedir('escada');
    };

    /**
     * Manda a ponte parar a caçada, ir para a cidade e curar.
     *
     * Isto e' a unica coisa nesta ferramenta que precisa do mundo da pagina, e o cabeçalho de
     * `escada-main.js` explica porque': a cura sao tres acoes do jogo em ordem, e nenhuma delas tem
     * botao que se possa clicar com honestidade daqui.
     *
     * A paciencia nao e' enfeite: sem `escada-main.js` — pacote a meio de carregar, arquivo
     * removido do manifesto — ninguem responde nunca, e uma escada parada para sempre em "indo
     * curar" nao diz o que esta' errado.
     */
    const pedirPonte = (pedido) =>
      new Promise((resolver) => {
        const eco = `e${Date.now()}-${(proximoEco += 1)}`;
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

    /** Parar a caçada, ir para a cidade e curar. Ver o cabeçalho de `escada-main.js`. */
    const pedirCidade = () => pedirPonte({ acao: 'cidade' });

    /**
     * Todos os Pokemon da conta, com nivel: a lista de quem ainda falta upar.
     *
     * So' o modo de grupo precisa disto, e precisa mesmo: o nivel de quem esta' na equipe le'-se no
     * HUD, mas o de quem esta' na mochila so' apareceria abrindo o inventario.
     */
    const pedirBichos = () => pedirPonte({ acao: 'bichos' });

    /**
     * Leva a equipe a' enfermeira e espera o HUD deixar de dizer que o aluno esta' morto.
     *
     * **Espreita-se, nao se cronometra**, como em toda esta ferramenta: a resposta da ponte e' do
     * servidor, e o HUD e' redesenhado depois dela.
     */
    async function curar(alvo, aviso) {
      const soltar = await esperarAVez();
      if (!soltar)
        return {
          espere: ATE_TENTAR_A_VEZ,
          diga: 'Outra ferramenta está agindo. Tento de novo.',
        };
      try {
        aviso(`${alvo.nome} está derrotado. Voltando à cidade para curar.`);
        const r = await pedirCidade();
        if (r?.erro) return { espere: CASTIGO, diga: `Não consegui curar: ${r.erro}` };
        const limite = Date.now() + ATE_CURAR;
        while (Date.now() < limite) {
          await espera(ESPREITA);
          const agora = equipe().find((p) => p.id === alvo.id);
          if (agora && !agora.morto) return null;
        }
      } finally {
        soltar();
      }
      const agora = equipe().find((p) => p.id === alvo.id);
      if (agora && !agora.morto) return null;
      return {
        espere: CASTIGO,
        diga: `Fui à enfermeira e ${alvo.nome} continua derrotado no HUD.`,
      };
    }

    /**
     * Clica em `alvo` no HUD e confere, pelo HUD, que ele ficou mesmo a' frente.
     *
     * Devolve `null` se deu certo, ou `{ espere, diga }`. **Confere o estado de depois, nao o
     * clique**: o clique pode ter caido dentro da espera de 3 s, e o jogo nao reclama. Seguir como
     * se tivesse trocado mandaria o aluno errado para a caçada.
     *
     * Dois pokemon iguais no mesmo nivel distinguem-se aqui porque a conferencia e' pelo
     * `data-creature-id`, que o jogo poe em cada caixa — nao pelo nome.
     */
    async function porNaFrente(alvo, aviso, frase) {
      const soltar = await esperarAVez();
      if (!soltar)
        return {
          espere: ATE_TENTAR_A_VEZ,
          diga: 'Outra ferramenta está agindo. Tento de novo.',
        };
      try {
        aviso(frase);
        alvo.el.click();
        const limite = Date.now() + ATE_TROCAR;
        while (Date.now() < limite) {
          await espera(ESPREITA);
          if (caixaDoLider()?.id === alvo.id) break;
        }
      } finally {
        soltar();
      }

      const agora = caixaDoLider();
      if (agora?.id !== alvo.id)
        return {
          espere: 6000,
          diga:
            `Cliquei em ${alvo.nome} no HUD e quem continua à frente é ` +
            `${agora?.nome || '(não li o HUD)'}. Não troquei de aluno.`,
        };
      return null;
    }

    /**
     * Po-e `alvo` a' frente, e **nao mexe no degrau cumprido**.
     *
     * Antes mexia: punha `aplicado` a `null`, porque a troca vinha antes da viagem e o degrau
     * guardado era do aluno anterior. Com a ordem invertida isto apagaria o degrau que a viagem
     * **acabou** de cumprir, e a batida seguinte viajaria outra vez para o mesmo lugar. Quem
     * recomeça a contagem agora e' a troca de aluno em `conferir`, que acontece antes da viagem.
     */
    async function trocarDeAluno(alvo, aviso) {
      // O jogo cala-se quando recusa. Esperar e' muito mais barato do que o castigo de dois
      // minutos, entao a espera do jogo nao e' tratada como falha — e' tratada como espera.
      if (alvo.espera)
        return {
          espere: alvo.espera,
          diga: `O jogo só deixa trocar daqui a ${Math.ceil(alvo.espera / 1000)}s.`,
        };

      const erro = await porNaFrente(
        alvo,
        aviso,
        `${nomeLider() || 'o líder'} chegou ao teto. Pondo ${alvo.nome} Lv ${alvo.nivel} na frente.`,
      );
      if (erro) return erro;
      return null;
    }

    /**
     * O fim da fila de times: ela **pergunta**, e fica a' espera.
     *
     * Pedido em 12/10/2026, e e' o unico estado desta ferramenta em que ela espera por uma pessoa.
     * Vale a pena dizer porque' a pergunta nao e' uma quinta opcao do `fim`: as outras quatro sao
     * escolhidas **antes**, de noite, para ela cumprir sozinha. Esta e' feita **depois**, com a
     * equipe toda formada na tela — e nessa hora o que ele quer depende do que aconteceu.
     *
     * Aqui nao se age. Quem age e' `responder`, no clique: uma accao guardada para "a proxima
     * batida" seria refeita em cada batida, e voltar para a cidade tres vezes nao e' voltar uma.
     */
    function fimDaFila(aviso) {
      if (!cfg.formados) {
        cfg.formados = true;
        gravar();
      }
      desenhar(false);

      // **RESPOSTA GUARDADA NAO SE PERGUNTA OUTRA VEZ.** Quem roda a mesma volta todas as noites ja'
      // sabe a resposta antes de ela ser feita, e marcar a caixinha e' dizer "e daqui em diante
      // tambem". Age-se aqui, pelo mesmo caminho do clique — `responder` — para nao haver duas
      // maneiras de fazer a mesma coisa, uma delas sem as recusas da outra.
      if (!cfg.depois && cfg.sempre) {
        // A recusa do laço vale igual, e aqui vale mais: a mao veria o time a ser remontado e
        // pararia; a resposta guardada nao ve nada e refaria a volta para sempre. Ver o `tropeco`
        // la' em cima, no caminho de quem ainda tem time seguinte.
        const tropeco = cfg.sempre === 'time' ? degrauComTime() : null;
        if (tropeco) {
          aviso(
            `A fila acabou, e eu ia recomeçá-la — mas a caçada "${tropeco.cacada}" do degrau de ` +
              `Lv ${tropeco.nivel} monta o time "${tropeco.time}" ao chegar e apagaria o meu. ` +
              `Tire o time dessa caçada nas Caçadas, ou desmarque "e daqui em diante".`,
            true,
          );
          return 'tropeco';
        }
        aviso(`A fila de times acabou — ${O_QUE_FAREI[cfg.sempre] || cfg.sempre}.`);
        void responder(cfg.sempre);
        return 'guardado';
      }

      // Uma pergunta que nao se ve nao e' uma pergunta: minimizada, o `.corpo` esta' escondido e a
      // listbox com ele — ficaria a dizer "escolha aí embaixo" sem haver embaixo. Abre-se uma vez,
      // e quem quiser volta a minimizar.
      if (!cfg.depois && minimizado && !jaAbri) {
        jaAbri = true;
        minimizado = false;
        gravarChave(CHAVE_MIN, minimizado);
        aplicarMinimo();
      }
      aviso(diagnostico());
      return cfg.depois ? 'respondido' : 'perguntando';
    }

    /**
     * O fim da escada: ninguem na equipe tem mais nivel para subir.
     *
     * Sao quatro saidas, e as quatro sao escolha do dono — ficar onde esta', ir para uma caçada,
     * trocar de time ou voltar para a cidade. Eram duas; as outras duas foram pedidas por quem usa
     * isto a noite inteira: com a equipe toda no teto, ou se troca de time e continua, ou se guarda
     * a equipe na cidade e para-se de vez. O que esta ferramenta **nao** faz e' escolher por ele.
     */
    async function fimDaEscada(aviso) {
      const feito = () => {
        if (!cfg.formados) {
          cfg.formados = true;
          gravar();
        }
        aviso(diagnostico());
        return 'formados';
      };

      if (cfg.fim === 'nada') {
        aviso(diagnostico());
        return 'sem fim';
      }
      // Ja' cumpriu uma vez: se o dono saiu de la' a' mao, o lugar dele e' escolha dele.
      //
      // **NAO VALE PARA A FILA DE TIMES, E ISSO FOI MEDIDO NA BANCA EM 12/10/2026.** La' quem diz
      // se ha' trabalho por fazer e' a propria fila, pelo time que esta' montado. Com este portao
      // a valer, um "ja' cumpri" de uma volta anterior travava a fila inteira: ela ficava a dizer
      // "falta montar o 1º de 3" sem nunca montar, porque o fim ja' tinha sido dado por cumprido.
      // Quem para a fila e' o fim dela, em `fimDaFila`, e mais nada.
      if (cfg.formados && cfg.fim !== 'time') {
        aviso(diagnostico());
        return 'formados';
      }
      if (Date.now() < esperaAte) {
        aviso(diagnostico());
        return 'esperando';
      }

      if (cfg.fim === 'cidade') {
        correndo = true;
        try {
          const soltar = await esperarAVez();
          if (!soltar) {
            adiar(ATE_TENTAR_A_VEZ);
            aviso('Outra ferramenta está agindo. Tento de novo.');
            return 'sem vez';
          }
          try {
            aviso('Equipe formada. Voltando para a cidade.');
            const r = await pedirCidade();
            if (!r?.erro) return feito();
            adiar(CASTIGO);
            aviso(`Não consegui voltar para a cidade: ${r.erro}`);
            return 'falhou';
          } finally {
            soltar();
          }
        } finally {
          correndo = false;
        }
      }

      if (cfg.fim === 'time') {
        const vez = timeSeguinte();
        if (vez.vazia) {
          aviso(diagnostico());
          return 'sem fim';
        }
        if (vez.erro) {
          aviso(vez.erro);
          return 'sem porta';
        }
        // A fila acabou: o ultimo time da lista formou-se, e nao ha' seguinte. Nao se volta ao
        // inicio por conta propria — isso seria desfazer o trabalho todo — e a partir daqui a
        // decisao e' dele, perguntada.
        if (!vez.nome) return fimDaFila(aviso);
        // **E' aqui que duas regras se atropelam, e o atropelo da' laço.** Medido no jogo em
        // 12/10/2026: montou o time "novo", reiniciou a escada, viajou para o primeiro degrau, e a
        // viagem remontou o time guardado na caçada — apagando o "novo". Com a equipe velha de
        // volta, ninguem tem nivel para subir, a escada chega outra vez ao fim e monta o time de
        // novo. Para sempre, a 20-30 s de montagem e uma viagem por volta.
        //
        // Da' para saber **antes** de agir, e por isso recusa-se antes: basta um degrau cuja caçada
        // monte time, porque a escada vai certamente viajar para um deles.
        const tropeco = degrauComTime();
        if (tropeco) {
          aviso(
            `O time "${vez.nome}" não ia durar: a caçada "${tropeco.cacada}" do degrau de ` +
              `Lv ${tropeco.nivel} monta o time "${tropeco.time}" ao chegar e apagaria o meu. ` +
              `Tire o time dessa caçada nas Caçadas.`,
          );
          return 'tropeco';
        }
        const times = globalThis.PPX?.times;
        if (!times?.usar) {
          aviso('A ferramenta Times está desligada — é ela que monta o time.');
          return 'sem porta';
        }
        correndo = true;
        try {
          // A vez e' desta ferramenta durante as duas acoes, e nao de uma delas: a ida a' cidade e a
          // montagem do time sao um unico movimento, e a montagem demora 20-30 s. Os Times sao uma
          // **peça** — quem chama e' que tem de ter a vez, e pedi-la de novo lá daria impasse.
          const soltar = await esperarAVez();
          if (!soltar) {
            adiar(ATE_TENTAR_A_VEZ);
            aviso('Outra ferramenta está agindo. Tento de novo.');
            return 'sem vez';
          }
          try {
            // A CIDADE VEM ANTES DA TROCA, E FOI PEDIDO ASSIM. O time que entra e' de bichos novos
            // — Lv 1, no caso medido — e trocar a equipe inteira dentro de uma caçada e' por tres
            // recem-nascidos no lugar de quem acabou de se formar, no mesmo combate. E' o mesmo
            // defeito da ordem invertida da batida (ver `conferir`), um degrau acima: primeiro
            // chega-se ao lugar seguro, depois troca-se. A cidade e' o lugar seguro — e a mesma
            // viagem ainda passa pela enfermeira, que e' o que a ponte faz.
            aviso(`Equipe formada. Voltando para a cidade para montar "${vez.nome}".`);
            const cidade = await pedirCidade();
            if (cidade?.erro) {
              adiar(CASTIGO);
              aviso(`Não consegui voltar para a cidade: ${cidade.erro}`);
              return 'falhou';
            }
            aviso(`Na cidade. Montando o time "${vez.nome}" (${vez.posicao}º de ${vez.quantos}).`);
            const r = await times.usar(vez.nome);
            if (r?.ok) {
              // **Confere-se o que os Times disseram.** Eles ja' relataram sucesso com um time que
              // nao montaram ("montado em 148 s", com um Pokemon so'), e aqui isso seria pior do
              // que um aviso errado: a fila anda pelo time que esta' montado, entao um time meio
              // montado faria a escada perder o lugar na fila e remontar o mesmo para sempre.
              const montado = globalThis.PPX?.times?.qual?.();
              if (montado !== vez.nome) {
                adiar(CASTIGO);
                aviso(
                  `Os Times disseram que montaram "${vez.nome}", mas a equipe na tela ` +
                    `${montado ? `é o time "${montado}"` : 'não é nenhum time guardado'}. ` +
                    `Não sigo a fila às cegas.`,
                );
                return 'nao montou';
              }
              // Trocar de time troca a equipe inteira: o aluno de agora e' outro, e o degrau
              // cumprido era do anterior. Esquecer os dois e' o que faz a escada recomeçar com quem
              // chegou — guarda-los mandaria um bicho novo de Lv 1 para a caçada do Lv 200 que saiu.
              cfg.aplicado = null;
              cfg.aluno = '';
              gravar();
              // **Montar um time do meio da fila nao e' cumprir o fim**, e marca-lo como cumprido
              // travava a fila: um time que ja' chegasse todo ao teto deixava a escada parada para
              // sempre, em vez de passar ao seguinte. Quem cumpre o fim e' o fim da fila.
              desenhar(false);
              // E o laço recomeça: o time novo esta' na cidade, e a escada tem de o levar ao degrau
              // dele. Quem mexeu no HUD agora foi ela propria, parada na cidade, onde mais nada
              // mexe — sem esta batida ficaria quieta. Ver `batidaEm`.
              aviso(`Montei o time "${vez.nome}" (${vez.posicao}º de ${vez.quantos}).`);
              retomar();
              return 'trocado';
            }
            adiar(CASTIGO);
            aviso(`Não consegui montar o time "${vez.nome}": ${r?.erro || 'o jogo não montou'}`);
            return 'falhou';
          } finally {
            soltar();
          }
        } finally {
          correndo = false;
        }
      }

      if (!cfg.destino) {
        aviso(diagnostico());
        return 'sem fim';
      }
      if (local() === cfg.destino) return feito();
      // Parar a caçada no destino e' mudar de caçada como qualquer outra, e precisa da mesma
      // licenca.
      if (cfg.trocar !== true) {
        aviso(diagnostico());
        return 'sem licenca';
      }
      correndo = true;
      try {
        const soltar = await esperarAVez();
        if (!soltar) {
          adiar(ATE_TENTAR_A_VEZ);
          aviso('Outra ferramenta está agindo. Tento de novo.');
          return 'sem vez';
        }
        try {
          aviso(`Equipe formada. Parando a caçada em "${cfg.destino}".`);
          const r = await viajar(cfg.destino);
          if (r.ok) return feito();
          adiar(CASTIGO);
          aviso(`Não consegui parar em "${cfg.destino}": ${r.erro || 'o jogo não me levou'}`);
          return 'falhou';
        } finally {
          soltar();
        }
      } finally {
        correndo = false;
      }
    }

    /**
     * Uma batida a mais, depois de uma accao desta ferramenta que deixou trabalho por fazer.
     *
     * **ISTO NAO E' UM RELOGIO, E A DIFERENCA IMPORTA.** O gatilho da escada e' o HUD mudar, e isso
     * basta enquanto quem mexe no HUD e' o jogo. Mas depois da cura quem mexeu no HUD foi ela
     * propria, dentro da batida que ja' estava a correr — e na cidade, parada, mais nada mexe. Pego
     * na banca em 11/10/2026: ela curava, o painel dizia "curado", e ficava ali a' espera de um
     * empurrao que nunca vinha. Terminar o proprio movimento nao e' ficar a bater de x em x
     * segundos: e' uma batida, uma vez, por conta de uma accao que foi dela.
     *
     * Ha' uma batida pendente de cada vez: duas nao fazem nada que uma nao faça, e a segunda so'
     * chegaria para encontrar o trabalho ja' feito.
     */
    const batidaEm = (ms) => {
      clearTimeout(proximaBatida);
      proximaBatida = setTimeout(() => void conferir(), ms);
    };

    const retomar = () => batidaEm(DEPOIS_DE_AGIR);

    /**
     * Espera `ms` — **e volta por conta propria quando a espera acabar.**
     *
     * MEDIDO NO JOGO EM 11/10/2026, E E' O MESMO BURACO DA CURA, NOUTRO SITIO. A escada pediu para
     * por o Ralts a' frente, o jogo respondeu "Aguarde 3s", ela guardou a espera e voltou para o
     * observador. So' que o gatilho dela e' o HUD mudar, e parada na mesma caçada com o mesmo lider
     * o HUD **nao muda**: nivel igual, ninguem morre, ninguem troca. Ficou congelada dois minutos e
     * meio no "Tento de novo em 3s", com tres segundos de espera a cumprir.
     *
     * Guardar uma espera sem marcar a volta e' prometer voltar e nao voltar. Toda espera desta
     * ferramenta passa por aqui, por isso, e nenhuma fica a depender de o jogo a acordar.
     */
    const adiar = (ms) => {
      esperaAte = Date.now() + ms;
      batidaEm(ms + DEPOIS_DE_AGIR);
    };

    /** A viagem e' das Caçadas, sempre. Esta ferramenta so' decide **quando**. */
    const viajar = async (nome) => {
      const cacadas = globalThis.PPX?.cacadas;
      if (!cacadas?.ir) return { ok: false, erro: 'a ferramenta Caçadas está desligada' };
      return cacadas.ir(nome);
    };

    /**
     * Uma batida do modo de grupo, na mesma ordem do outro modo: **enfermeira, viagem, equipe.**
     *
     * A ordem e' a mesma e pelo mesmo motivo, medido em 11/10/2026 no modo de escada: chega-se
     * primeiro ao lugar certo, mexe-se na equipe depois. Aqui ainda ha' uma razao extra — a viagem
     * para uma caçada com time guardado **apagaria o grupo**, e por isso se recusa antes de andar.
     *
     * Nao ha' degraus: a caçada e' uma e fica-se nela. O que roda e' a equipe.
     */
    async function conferirGrupo(aviso) {
      const g = cfg.grupo;
      const falta = faltaNoGrupo();
      if (falta) {
        aviso(falta);
        return 'sem fim';
      }

      if (Date.now() < esperaAte) {
        aviso(diagnostico());
        return 'esperando';
      }

      if (!equipe().length) return '';

      // ---------------------------------------------------------------- 1. a enfermeira
      // Aqui o morto importa mais do que no outro modo: quem caça e' o fixo, e um fixo derrotado
      // nao da' XP a ninguem — o grupo todo fica a olhar.
      const morto = equipe().find((p) => p.morto);
      if (morto) {
        correndo = true;
        try {
          const falha = await curar(morto, aviso);
          if (falha) {
            adiar(falha.espere);
            aviso(falha.diga);
            return 'sem curar';
          }
        } finally {
          correndo = false;
        }
        aviso(`${morto.nome} está curado.`);
        retomar();
        return 'curado';
      }

      // ------------------------------------------------- 2. da' para fazer o trabalho de la'?
      //
      // **A LEITURA DA COLECAO VEM ANTES DA VIAGEM, E ISSO E' A CORRECCAO DE UM DEFEITO.** Medido
      // numa segunda conta do dono em 12/10/2026: a pedra escolhida ja' nao estava na colecao
      // daquela conta e um dos times nao existia la', e mesmo assim a escada tirou-o da "Caça de
      // Kirlia" e levou-o para a "Caça de Gardevoir" — para, chegando, descobrir que nao tinha
      // grupo nenhum para montar. Arrastar alguem atraves do mapa para um trabalho que nao se vai
      // conseguir fazer e' o pior dos dois erros possiveis: o outro e' so' ficar parado.
      //
      // A leitura nao mexe em nada (e' a API da colecao) e ja' era feita a cada batida, logo a
      // seguir; aqui ela so' mudou de lugar.
      const lido = await pedirBichos();
      if (lido?.erro) {
        adiar(CASTIGO);
        aviso(`Não consegui ler a coleção: ${lido.erro}`);
        return 'sem colecao';
      }
      colecao = new Map((lido.bichos || []).map((b) => [b.id, b]));
      desenhar(false);

      const alvo = alvoDoGrupo();
      const m = montagemDoGrupo(colecao, alvo);
      if (m.erro) {
        aviso(m.erro);
        return 'sem montagem';
      }

      // ---------------------------------------------------------------- 3. a viagem
      const lugar = lugarDoGrupo();
      if (!lugar.aqui) {
        if (!lugar.ir) {
          aviso(
            'Estou fora da lista e não consigo entrar sozinha em nenhuma delas. ' +
              'Ponha na lista uma caçada guardada, ou entre você.',
          );
          return 'sem porta';
        }
        // A caçada que monta time ao chegar apagaria o grupo. Da' para saber antes de andar — e
        // confere-se **a que vai ser aberta**, nao a lista toda: as outras podem nunca ser usadas.
        const guardado = globalThis.PPX?.cacadas?.timeDe?.(lugar.ir);
        if (guardado) {
          aviso(
            `A caçada "${lugar.ir}" monta o time "${guardado}" ao chegar e apagaria o grupo. ` +
              `Tire o time dessa caçada nas Caçadas.`,
          );
          return 'tropeco';
        }
        if (cfg.trocar !== true) {
          aviso(`Falta ir para "${lugar.ir}", mas não tenho licença para trocar de caçada.`);
          return 'sem licenca';
        }
        correndo = true;
        try {
          const soltar = await esperarAVez();
          if (!soltar) {
            adiar(ATE_TENTAR_A_VEZ);
            aviso('Outra ferramenta está agindo. Tento de novo.');
            return 'sem vez';
          }
          try {
            aviso(`Indo para "${lugar.ir}".`);
            const r = await viajar(lugar.ir);
            if (!r.ok) {
              adiar(CASTIGO);
              aviso(`Não consegui ir para "${lugar.ir}": ${r.erro || 'o jogo não me levou'}`);
              return 'falhou';
            }
          } finally {
            soltar();
          }
        } finally {
          correndo = false;
        }
        retomar();
        return 'viajou';
      }

      // ---------------------------------------------------------------- 4. a equipe
      //
      // A colecao e a montagem ja' foram lidas la' em cima, antes da viagem — e nao se releem: uma
      // batida que chegue aqui nao viajou (quem viaja sai no `return 'viajou'`), entao a equipe e
      // os niveis sao os mesmos de ha' um instante.
      //
      // A rodada fecha **antes** de a equipe ser desfeita: subir o alvo primeiro poupa tirar cinco
      // Pokemon para os por de volta um instante depois.
      if (!m.faltam.length && cfg.modo === 'passo') {
        g.rodada = (Number(g.rodada) || 0) + 1;
        gravar();
        desenhar(false);
        aviso(`Todos chegaram ao Lv ${alvo}. Rodada nova: agora até o Lv ${alvoDoGrupo()}.`);
        retomar();
        return 'rodada';
      }

      const quero = m.escolhidos.map((b) => b.id);
      const tenho = equipe().map((p) => p.id);
      const igual = quero.length === tenho.length && quero.every((id) => tenho.includes(id));
      if (igual) {
        aviso(diagnostico());
        return 'em ordem';
      }

      correndo = true;
      try {
        const soltar = await esperarAVez();
        if (!soltar) {
          adiar(ATE_TENTAR_A_VEZ);
          aviso('Outra ferramenta está agindo. Tento de novo.');
          return 'sem vez';
        }
        try {
          const quantos = m.escolhidos.length - 1;
          aviso(
            quantos
              ? `Acertando o grupo: ${m.escolhidos.map((b) => b.nome).join(', ')}.`
              : `Todos chegaram ao Lv ${alvo}. Tirando-os do grupo.`,
          );
          // Quem monta e' a ferramenta Times, com as tres regras do jogo medidas la'. E o fixo vai
          // como lider de proposito: **o jogo recusa remover o Pokemon ativo**, e o fixo e' o unico
          // que nunca sai — lideranca em quem roda daria uma troca travada a cada volta.
          const r = await globalThis.PPX.times.montar(
            m.escolhidos.map((b) => ({ id: b.id, nome: b.nome })),
            m.fixo.id,
            'o grupo',
          );
          if (!r?.ok) {
            adiar(CASTIGO);
            aviso(`Não consegui acertar o grupo: ${r?.erro || 'o jogo não montou'}`);
            return 'falhou';
          }
        } finally {
          soltar();
        }
      } finally {
        correndo = false;
      }
      desenhar(false);
      aviso(diagnostico());
      retomar();
      return 'acertado';
    }

    /**
     * Uma batida da escada, na ordem que importa: **enfermeira, viagem, troca.**
     *
     * ESTA ORDEM E' A CORRECCAO DE UM DEFEITO MEDIDO NO JOGO (11/10/2026). Ela era o contrario —
     * trocava de aluno e so' depois viajava — e o resultado foi o Ralts Lv 1 posto a' frente dentro
     * da caçada de Nidorina, morto em 5 segundos, com a escada em laço a tentar por um morto a'
     * frente. Um aluno de Lv 1 nao sobrevive a' caçada do aluno que acabou de se formar, e nenhuma
     * espera resolve isso: o que resolve e' chegar primeiro ao lugar certo e trocar la'.
     */
    async function conferir(aviso = diz) {
      if (!cfg.ligada || correndo) return '';
      // Pausada e' diferente de parada: parada esquece o que ia fazer, pausada guarda o lugar. E'
      // o que permite dizer "espere" sem perder a rodada, a fila nem o degrau cumprido.
      if (cfg.pausada) {
        aviso(diagnostico());
        return 'pausada';
      }
      // Aba oculta: o jogo nao desenha, as janelas dele nao abrem e a viagem nao tem por onde
      // passar. O nivel tambem nao sobe, entao nao ha' o que perder em esperar a aba voltar.
      if (document.visibilityState !== 'visible') return '';

      // **A ULTIMA DA FILA, NOS DOIS MODOS.** Se alguem esta' com a vez ou a' espera dela, a caçada
      // para aqui — sem pedir nada, para nao se por a' frente de ninguem. Vem antes dos dois
      // caminhos de proposito: enquanto outra ferramenta corre, nao ha' decisao desta que valha a
      // pena tomar, e tomar uma seria disputar o jogo com ela. Ver `cedendo`.
      const outra = cedendo();
      if (outra) {
        aviso(`Esperando ${outra} terminar — a caçada é a última da fila.`);
        return 'cedendo';
      }

      /**
       * **NA EXPEDIÇÃO, A CAÇADA ESPERA — NOS TRES MODOS.**
       *
       * MEDIDO NO JOGO DO DONO EM 12/10/2026, com ele dentro da expedição e o degrau de Lv 140
       * apontado para "Togetic": o painel repetia *"Degrau 140 não deu: cliquei em Caçar e
       * continuei em «Expedição Diária Cooperativa»"*, batida apos batida. Ela abria a janela das
       * caçadas, clicava em Caçar, o jogo recusava — e ela tentava outra vez.
       *
       * **E MEDIDO OUTRA VEZ EM 13/10/2026, EM TRES JANELAS AO MESMO TEMPO**, com a mesma frase:
       * o conserto de 12/10 ficou **so' no modo de degraus**. Acreditei que nos outros dois a
       * lista de lugares do grupo ja' resolvia — "estar na expedição conta como estar onde o grupo
       * fica" —, e nao resolve: o `lugarDoGrupo` pergunta `estouEm(nome)` por cada lugar da lista
       * **escrita pelo dono**, e dentro da expedição nenhum deles responde que sim. Sem nenhum
       * "aqui", ele escolhe o primeiro para onde da' para ir e viaja. So' valeria se o dono
       * tivesse posto a expedição na lista a mao, que ninguem tem razao nenhuma para fazer.
       *
       * Por isso a guarda subiu para antes dos tres caminhos, ao lado da fila: dentro da expedição
       * nao ha' decisao desta ferramenta que valha a pena tomar, qualquer que seja o modo.
       *
       * Ela espera, e espera **tudo**: nao viaja, nao troca de aluno, nao leva a' enfermeira.
       * A expedição dura duas horas a cada quatro, tem CAPTCHA para entrar e o jogador so' esta'
       * la' porque quis — arrasta-lo para fora e' desfazer uma escolha dele. Acabada ela, o jogo
       * devolve-o a' caçada anterior (e' o que a propria tela do fim promete) e a batida seguinte
       * continua de onde parou, sem nada de guardado: o estado deriva do jogo, como em todo o
       * resto desta ferramenta.
       */
      if (naExpedicao()) {
        aviso(NA_EXPEDICAO);
        return 'na expedicao';
      }

      // Os dois modos mexem na mesma equipe e na mesma caçada, entao daqui em diante sao caminhos
      // separados — e so' um deles corre.
      if (cfg.modo !== 'escada') return conferirGrupo(aviso);

      if (!equipe().length) return '';

      // O fim da escada vem antes de tudo: sem aluno nenhum, perguntar em que degrau ele esta'
      // seria responder a pergunta errada.
      if (cfg.teto && !proximoAluno()) return fimDaEscada(aviso);
      if (cfg.formados) {
        cfg.formados = false;
        // Comecou uma volta nova, entao a pergunta do fim da fila e' uma pergunta nova. Guardar a
        // resposta de ontem seria responder por ele.
        cfg.depois = '';
        jaAbri = false;
        gravar();
      }

      const aluno = alunoDeAgora();
      if (!aluno || aluno.nivel === null) return '';

      // De quem e' esta escada. Primeira leitura nao e' troca: so' se apaga o degrau cumprido
      // quando havia um aluno antes e ele mudou — senao cada F5 seria uma troca de aluno, e a
      // escada recomeçaria a viajar a cada recarga da pagina.
      if (cfg.aluno !== aluno.id) {
        if (cfg.aluno) cfg.aplicado = null;
        cfg.aluno = aluno.id;
        gravar();
      }

      const n = aluno.nivel;

      // ---------------------------------------------------------------- 1. a enfermeira
      // Um aluno morto nao sobe de nivel, e o jogo recusa calado o clique numa caixa morta: sem
      // isto a escada ficaria a tentar por um morto a' frente para sempre, que foi o que ela fez.
      if (aluno.morto) {
        if (Date.now() < esperaAte) {
          aviso(diagnostico());
          return 'esperando';
        }
        correndo = true;
        try {
          const falha = await curar(aluno, aviso);
          if (falha) {
            adiar(falha.espere);
            aviso(falha.diga);
            return 'sem curar';
          }
        } finally {
          correndo = false;
        }
        // **A CURA TIRA DA CAÇADA, ENTAO O DEGRAU CUMPRIDO DEIXA DE VALER.** Pego na banca em
        // 11/10/2026: ela curava e ficava na cidade para sempre. O degrau continuava marcado como
        // cumprido, e a regra que respeita o dono — "voce' saiu de la', fique a' vontade" — nao
        // sabe distinguir o dono a sair da propria escada a sair para curar. Quem saiu aqui foi
        // ela, entao e' ela que tem de voltar. A batida seguinte viaja, com o HUD ja' assentado.
        cfg.aplicado = null;
        gravar();
        aviso(`${aluno.nome} está curado.`);
        retomar();
        return 'curado';
      }

      const degrau = degrauPara(n);
      // Ela nunca desce com o mesmo aluno. Um degrau ABAIXO do ja' cumprido com ESTE aluno nao e'
      // progresso: e' um nivel mal lido, um degrau editado, ou o jogo a por outra caixa como
      // lider — e o castigo e' arrastar um Lv 19 para a caçada dos Lv 1.
      if (degrau && cfg.aplicado !== null && degrau.nivel < cfg.aplicado) {
        aviso(diagnostico());
        return 'nao desco';
      }
      if (!degrau || !degrau.cacada) {
        aviso(diagnostico());
        return 'nada a fazer';
      }

      // ---------------------------------------------------------------- 2. a viagem
      // Viaja-se com quem esta' a' frente **agora**, que e' o aluno anterior, forte. Era aqui que
      // estava o defeito: trocar primeiro poe um Lv 1 a aguentar a caçada de um Lv 230.
      const chegou = () => local() === degrau.cacada;
      // Fora de caçada nenhuma, o degrau cumprido deixa de valer — pelo mesmo motivo que o deixa
      // de valer depois da enfermeira: quem esta' na cidade nao esta' a cumprir degrau nenhum.
      // Ver `emLugarNenhum`.
      if (!chegou() && cfg.trocar === true && emLugarNenhum()) {
        cfg.aplicado = null;
        gravar();
      }
      if (!chegou() && degrau.nivel !== cfg.aplicado) {
        // A licenca de viajar e' so' sobre viajar: formar o aluno e dizer em que degrau ele deveria
        // estar ja' aconteceu. O que para aqui e' o arrasto para outro mapa.
        if (cfg.trocar !== true) {
          aviso(diagnostico());
          return 'sem licenca';
        }
        if (Date.now() < esperaAte) {
          aviso(diagnostico());
          return 'esperando';
        }
        correndo = true;
        try {
          aviso(`${aluno.nome || 'o líder'} Lv ${n}: indo para "${degrau.cacada}".`);
          const r = await viajar(degrau.cacada);
          // **Quem diz que chegou e' a porta das Caçadas, nao uma leitura daqui.** Ela so' devolve
          // `ok` depois de confirmar que a caçada em curso e' a pedida — e reler o DOM no instante
          // seguinte apanha o jogo a meio do redesenho. Medido em 11/10/2026: a viagem de "Caça de
          // Azurill" para "Ilha Lendária de Entei" chegou, e esta leitura disse "o jogo não me
          // levou". Duas verdades sobre a mesma coisa divergem sempre; esta e' a que sobra.
          if (!r.ok) {
            // Nao marcar o degrau como feito e' de proposito: a tentativa volta a valer. O castigo
            // existe para isso nao virar um martelo.
            adiar(CASTIGO);
            aviso(`Degrau ${degrau.nivel} não deu: ${r.erro || 'o jogo não me levou'}`);
            return 'falhou';
          }
          cfg.aplicado = degrau.nivel;
          gravar();
        } finally {
          correndo = false;
        }
      } else if (chegou() && cfg.aplicado !== degrau.nivel) {
        // Ja' estar la' conta como feito: e' o caso de quem liga a escada ja' na caçada certa.
        cfg.aplicado = degrau.nivel;
        gravar();
      }

      // ---------------------------------------------------------------- 3. e so' agora a troca
      if (cfg.teto) {
        // **A caixa lida antes da viagem nao serve depois dela.** A caçada guardada monta a equipe
        // inteira e o jogo redesenha o HUD: o elemento lido antes fica orfao, e clicar nele nao
        // clica em nada. Le-se outra vez, pelo `data-creature-id`.
        const alvo = equipe().find((p) => p.id === aluno.id) || null;
        if (!alvo) {
          aviso(semOAluno(aluno, degrau));
          return 'sem aluno';
        }
        if (!alvo.lider) {
          // **Nao se troca fora do lugar.** Se o dono saiu da caçada do degrau a' mao, por o aluno
          // de Lv 1 a' frente onde ele esta' e' precisamente a morte que esta ordem veio evitar.
          if (!chegou()) {
            aviso(diagnostico());
            return 'fora do lugar';
          }
          if (Date.now() < esperaAte) {
            aviso(diagnostico());
            return 'esperando';
          }
          correndo = true;
          try {
            const falha = await trocarDeAluno(alvo, aviso);
            if (falha) {
              adiar(falha.espere);
              aviso(falha.diga);
              return 'sem trocar';
            }
          } finally {
            correndo = false;
          }
        }
      }

      desenhar(false);
      aviso(diagnostico());
      return 'ok';
    }

    /**
     * Fica de olho no HUD.
     *
     * **Nao e' um relogio.** Com a aba em segundo plano — que e' como se joga aqui, varias janelas
     * — o `setInterval` cai para uma volta por minuto. O HUD, que e' DOM, avisa quando muda.
     *
     * Ele muda a cada ponto de vida, varias vezes por segundo numa caçada. Por isso ha' uma peneira:
     * le-se do DOM uma assinatura curta (leitura barata, que `equipe()` ja' fazia) e so' se faz
     * contas quando ela muda de facto.
     *
     * **A PENEIRA ERA SO' O NIVEL DO LIDER, E ISSO ERA UM BURACO.** Pego na banca em 11/10/2026: o
     * aluno morreu e a escada nao reagiu — a morte nao muda nivel nenhum, entao a peneira nunca
     * abria. E um pokemon morto nao ganha experiencia, de modo que o nivel **nunca** mudaria: ela
     * ficaria parada para sempre, com a enfermeira a um passo. A assinatura leva o que as decisoes
     * desta ferramenta de facto dependem: quem esta' na equipe, em que nivel, quem esta' a' frente e
     * quem esta' morto. Pontos de vida continuam de fora, que e' o que torna a peneira peneira.
     */
    const assinatura = () =>
      // **E O LUGAR TAMBEM**, porque sair da caçada e' uma decisao nova sem mexer em ninguem da
      // equipe. Medido na conta do dono em 13/10/2026: parado na cidade, a equipe fica igual ao que
      // era, a peneira nunca abre e a escada nao volta a pensar — nem para voltar a' caçada, nem
      // para dizer o que esta' a acontecer. Um nome curto, lido do mesmo HUD; a leitura ja' era
      // feita a cada batida.
      `${local()}#` +
      equipe()
        .map((p) => `${p.id}:${p.nivel}:${p.lider ? 'L' : ''}${p.morto ? 'M' : ''}`)
        .join('|');

    function vigiar() {
      if (typeof MutationObserver === 'undefined' || !document.body) return null;
      const olho = new MutationObserver(() => {
        const n = assinatura();
        if (n === visto) return;
        visto = n;
        // **PARADA ELA NAO AGE, MAS O PAINEL CONTINUA A SER SOBRE O JOGO.** Medido no jogo em
        // 12/10/2026: a pergunta do fim da fila nao aparecia. O painel e' desenhado uma vez, ao
        // abrir a pagina — e nessa hora o jogo ainda nao pintou o HUD, entao nao havia equipe, nao
        // havia fila acabada e nao havia pergunta. Com a escada ligada a batida redesenha; parada,
        // `conferir` desistia na primeira linha e a listbox nunca chegava a aparecer.
        //
        // `desenhar(false)` guarda a frase que esta' na tela: quem acabou de usar o ▸ disse para
        // onde foi, e um redesenho nao tem nada melhor a dizer.
        if (!cfg.ligada) return void desenhar(false);
        void conferir();
      });
      olho.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      return olho;
    }

    // ------------------------------------------------------------- painel

    const painel = document.createElement('div');
    painel.id = 'lioncode-escada';
    painel.innerHTML = `
      <header>
        <strong data-titulo>Escada</strong>
        <button type="button" data-minimizar title="Minimizar">–</button>
        <button type="button" data-fechar title="Esconder (Alt+U)">×</button>
      </header>
      <div class="resumo" data-resumo>
        <p class="estado" data-estado-min></p>
      </div>
      <!-- **Os comandos vivem fora do corpo, e e' de proposito.** O corpo e' o que o minimizar
           esconde; iniciar, parar, pausar e retomar sao justamente o que se quer alcançar sem
           abrir nada. Pedido do dono em 12/10/2026, para esta e para a Arena. -->
      <div class="botoes">
        <button type="button" class="ligar" data-ligar>Iniciar</button>
        <button type="button" class="ligar" data-pausar>Pausar</button>
      </div>
      <div class="corpo">
        <select data-modo title="Como ela upa — os dois modos mexem na mesma equipe, então só um corre">
          <option value="escada">modo: escada de caçadas</option>
          <option value="grupo">modo: grupo até o nível X</option>
          <option value="passo">modo: grupo subindo de N em N</option>
        </select>
        <label class="caixa"><input type="checkbox" data-trocar> deixar trocar de caçada</label>
        <div data-escada>
        <ul data-lista></ul>
        <button type="button" class="mais" data-mais>+ degrau</button>
        <div class="fim">
          <label class="caixa">formar em Lv <input type="number" min="1" data-teto placeholder="—"></label>
          <label class="caixa" title="Vazio: cada um vai sozinho até o teto. Com um número, a equipe sobe junta de tantos em tantos níveis — e sozinho, sem teto, ela sobe junta sem fim">
            subindo <input type="number" min="1" data-subida placeholder="—"> níveis por vez
          </label>
          <p class="vazio" data-junta>
            Todos sobem juntos: cada um vai até o degrau de agora e passa a vez. Sem "formar em Lv",
            isso continua para sempre; com ele, até lá — e nunca abaixo do nível que a equipe já tem.
          </p>
          <select data-fim title="O que fazer quando a equipe inteira se formar">
            <option value="nada">formados: ficar onde estiver</option>
            <option value="cacada">formados: ir para uma caçada</option>
            <option value="time">formados: ir à cidade e trocar de time</option>
            <option value="cidade">formados: voltar para a cidade</option>
          </select>
          <input type="text" list="lioncode-escada-cacadas" data-destino
                 title="A caçada onde parar">
          <div class="fila" data-times>
            <ul data-fila></ul>
            <button type="button" class="mais" data-mais-time>+ time</button>
          </div>
          <select data-depois title="O que fazer agora que a fila de times acabou">
            <option value="">a fila acabou — o que faço?</option>
            <option value="nada">fico aqui, caçando</option>
            <option value="cidade">volto para a cidade e curo</option>
            <option value="time">recomeço a fila de times</option>
            <option value="parar">paro a escada</option>
          </select>
          <label class="sempre" data-sempre-linha
                 title="Responder sempre assim, sem perguntar outra vez">
            <input type="checkbox" data-sempre> e daqui em diante, sem perguntar
          </label>
        </div>
        </div>
        <div class="fim" data-grupo>
          <p class="vazio">onde o grupo fica, em ordem:</p>
          <ul data-ondes></ul>
          <button type="button" class="mais" data-mais-onde>+ caçada</button>
          <p class="vazio">quem tem a pedra, e os times que ela upa:</p>
          <ul data-turnos></ul>
          <button type="button" class="mais" data-mais-turno>+ pedra</button>
          <label class="caixa" data-so-grupo>
            sai do grupo no Lv <input type="number" min="1" data-alvo placeholder="—">
          </label>
          <label class="caixa" data-so-passo>
            mínimo Lv <input type="number" min="1" data-minimo placeholder="—">
            e mais <input type="number" min="1" data-passo placeholder="—"> níveis
          </label>
        </div>
        <datalist data-cacadas id="lioncode-escada-cacadas"></datalist>
        <div data-config></div>
      </div>
      <!-- **Fora do corpo, como os botoes — e pelo mesmo motivo, com uma razao a mais.** O corpo
           rola, e esta frase e' a unica coisa que explica uma escada que parece parada. No dia em
           que a rolagem apareceu ela foi empurrada para fora da vista junto com o resto: o dono viu
           "Parar" aceso, nada a acontecer, e nenhuma explicacao — que era justamente o que esta
           linha existia para evitar. Ver o diagnostico. -->
      <p class="estado" data-estado></p>`;

    const estilo = document.createElement('style');
    estilo.textContent = `
      #lioncode-escada, #lioncode-escada * { box-sizing: border-box; }
      #lioncode-escada {
        position: fixed; z-index: 2147483000; width: 248px;
        background: #11161f; color: #e7edf6; border: 1px solid #2a3244; border-radius: 10px;
        font: 13px/1.45 system-ui, sans-serif; box-shadow: 0 8px 24px #0008;
      }
      #lioncode-escada header {
        display: flex; align-items: center; gap: 8px; padding: 8px 10px;
        border-bottom: 1px solid #2a3244; cursor: move;
      }
      #lioncode-escada header strong { flex: 1; font-size: 13px; }
      /* Exportar e importar moram no fim do corpo: sao a ultima coisa que se faz, e so' quem
         abriu o painel as procura. */
      #lioncode-escada [data-config] { margin-top: 8px; }
      #lioncode-escada header button {
        background: none; border: 0; color: #8b97a8; font-size: 16px; cursor: pointer; padding: 0 2px;
      }
      /* **O corpo rola, e o cabeçalho nao.** Com nove degraus, dois times na fila e o bloco do fim,
         este painel passa da altura da tela e o "+ time" fica abaixo do rodape do monitor — medido
         na janela do dono em 12/10/2026, com a tela cheia de degraus. O que rola e' so' o corpo:
         o titulo, o resumo e os botoes de comando ficam parados onde a mao ja' os procura.
         O numero daqui e' o chao: supoe o painel no lugar de sempre. Quem manda e' o
         ajustarAltura(), que mede onde o corpo **esta'** — o painel arrasta-se, e um teto so' de
         CSS deixaria passar do rodape quem o tivesse posto mais abaixo. */
      #lioncode-escada .corpo { display: flex; flex-direction: column; gap: 8px;
        padding: 0 10px 10px; max-height: calc(100vh - 170px); overflow-y: auto;
        overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: #2a3244 transparent; }
      #lioncode-escada .corpo::-webkit-scrollbar { width: 8px; }
      #lioncode-escada .corpo::-webkit-scrollbar-thumb { background: #2a3244; border-radius: 4px; }
      #lioncode-escada .corpo::-webkit-scrollbar-track { background: transparent; }
      #lioncode-escada button.ligar, #lioncode-escada button.mais {
        background: #1f2a3d; color: #e7edf6; border: 1px solid #33405a; border-radius: 6px;
        padding: 7px; font: inherit; cursor: pointer;
      }
      #lioncode-escada button.ligar:hover, #lioncode-escada button.mais:hover { background: #26344c; }
      #lioncode-escada button.ligar.a-correr { background: #24402f; border-color: #35613f; }
      #lioncode-escada button:disabled { opacity: .5; cursor: default; }
      /* O flex-wrap e a largura fixa dos numeros: sem os dois, um rotulo com um campo no meio
         esticava o campo ate' empurrar as palavras para fora do painel de 248px. Medido no painel
         do dono em 12/10/2026, com "formar em Lv" partido em duas linhas. */
      #lioncode-escada .caixa { display: flex; align-items: center; gap: 6px; color: #9aa6b8;
        font-size: 12px; flex-wrap: wrap; }
      #lioncode-escada .caixa input[type="number"] { width: 58px; flex: none; }
      #lioncode-escada ul { list-style: none; margin: 0; padding: 0;
        display: flex; flex-direction: column; gap: 5px; }
      #lioncode-escada li {
        display: flex; align-items: center; gap: 5px;
        background: #0d1219; border: 1px solid #202835; border-radius: 8px; padding: 5px 7px;
      }
      #lioncode-escada li input[type=number] { width: 54px; }
      #lioncode-escada input, #lioncode-escada select {
        background: #1a2130; color: #e7edf6; border: 1px solid #2a3244;
        border-radius: 5px; padding: 3px 5px; font: inherit; font-size: 12px;
      }
      #lioncode-escada li select { flex: 1; min-width: 0; }
      #lioncode-escada input.cacada { flex: 1; min-width: 0; }
      /* Uma caçada que ninguem conhece nao fica calada: ver marcarCacada. */
      #lioncode-escada input.nao-existe { border-color: #7a3b3b; color: #ff9b9b; }
      #lioncode-escada li button {
        background: #1f2a3d; color: #e7edf6; border: 1px solid #33405a; border-radius: 6px;
        padding: 3px 7px; font: inherit; font-size: 12px; cursor: pointer;
      }
      #lioncode-escada li [data-apagar] { background: none; border-color: transparent;
        color: #8b97a8; padding: 3px 4px; }
      #lioncode-escada li.agora { border-color: #35613f; }
      /* Um turno e' uma pedra com os seus times: a pedra em cima, os times recuados por baixo. */
      #lioncode-escada li.turno { flex-direction: column; align-items: stretch; gap: 5px; }
      #lioncode-escada li.turno .cima { display: flex; align-items: center; gap: 5px; }
      #lioncode-escada li.turno .cima select { flex: 1; min-width: 0; }
      #lioncode-escada li.turno ul { padding-left: 9px; border-left: 2px solid #202835; }
      #lioncode-escada li.turno li { background: #11161f; padding: 3px 5px; }
      #lioncode-escada li.turno .mais { padding: 2px 7px; font-size: 11px; align-self: flex-start;
        margin-left: 9px; }
      #lioncode-escada li.turno .conta { color: #8b97a8; font-size: 11px; margin: 0 0 0 9px; }
      #lioncode-escada .fim { display: flex; flex-direction: column; gap: 5px;
        border-top: 1px solid #202835; padding-top: 7px; }
      #lioncode-escada .fim select { width: 100%; }
      #lioncode-escada .fila { display: flex; flex-direction: column; gap: 5px; }
      #lioncode-escada .botoes { display: flex; gap: 6px; padding: 0 10px 10px; }
      #lioncode-escada .botoes button { flex: 1; }
      #lioncode-escada [data-pausar] { background: #3a3220; border-color: #5c4e2c; }
      #lioncode-escada [data-pausar]:hover { background: #4a4028; }
      #lioncode-escada [data-pausar].a-correr { background: #24402f; border-color: #35613f; }
      #lioncode-escada [data-grupo] input[type=number] { width: 54px; }
      #lioncode-escada [data-grupo] .caixa { flex-wrap: wrap; }
      /* A pergunta tem de se distinguir de um campo de configuracao: um e' para preencher quando
         se quiser, o outro esta' a' espera de resposta agora. */
      #lioncode-escada [data-depois] { border-color: #6b5a2a; }
      #lioncode-escada.pergunta [data-depois] { border-color: #c79a3a; background: #2a2314; }
      /* A caixinha de guardar a resposta anda colada a pergunta: longe dela seria outra coisa. */
      #lioncode-escada .sempre {
        display: flex; align-items: center; gap: 6px;
        margin: -1px 0 0 2px; color: #9aa6b8; font-size: 12px; cursor: pointer;
      }
      #lioncode-escada .sempre input { margin: 0; cursor: pointer; }
      #lioncode-escada.pergunta .estado { color: #e8c470; }
      #lioncode-escada .estado { margin: 0; color: #9aa6b8; min-height: 1.4em; font-size: 12px; }
      /* A do rodape leva a margem que o corpo lhe dava, e um risco a separa da parte que rola. */
      #lioncode-escada > .estado { padding: 8px 10px; border-top: 1px solid #222a38; }
      /* Minimizada quem fala e' o eco la de cima: duas copias da mesma frase e uma a mais. */
      #lioncode-escada.minimizado > .estado { display: none; }
      #lioncode-escada .estado.ruim { color: #ff9b9b; }
      #lioncode-escada .estado.bom { color: #7ddba0; }
      #lioncode-escada .vazio { color: #8b97a8; margin: 0; font-size: 12px; }

      /* Minimizado: fica o diagnostico, que e' a unica pergunta que se faz de relance — "ela esta'
         a fazer alguma coisa, e o que?". O que sai e' a oficina: a lista de degraus e os campos. */
      #lioncode-escada .resumo { display: none; }
      #lioncode-escada.minimizado .resumo { display: block; padding: 0 9px 8px; }
      #lioncode-escada.minimizado { width: 210px; }
      #lioncode-escada.minimizado .corpo { display: none; }
      /* Os botoes ficam, e e' o que se queria. Menores, porque minimizado o painel e' estreito. */
      #lioncode-escada.minimizado .botoes { padding: 0 9px 9px; }
      #lioncode-escada.minimizado .botoes button { padding: 4px 6px; font-size: 12px; }
      #lioncode-escada.minimizado header { border-bottom: 0; padding: 6px 8px; }
      #lioncode-escada.minimizado header strong { font-size: 12px; letter-spacing: .06em; }
    `;
    painel.append(estilo);
    document.body.append(painel);

    const campo = (seletor) => painel.querySelector(seletor);
    const estado = campo('[data-estado]');
    const lista = campo('[data-lista]');

    // A mensagem vai aos dois lugares: minimizado, o `.corpo` esta' escondido, e uma escada que
    // nao responde nada parece uma escada parada.
    const ecoar = () => {
      const eco = campo('[data-estado-min]');
      if (!eco) return;
      eco.textContent = estado.textContent;
      eco.className = estado.className;
    };

    const diz = (texto, ruim) => {
      estado.textContent = texto;
      estado.classList.toggle('ruim', !!ruim);
      estado.classList.remove('bom');
      ecoar();
    };

    /**
     * A LISTA DE CAÇADAS E' UMA SO', PARTILHADA, E E' UM `datalist`.
     *
     * Com as 377 caçadas do jogo, um `select` por degrau deixou de servir: rolar quatrocentas
     * linhas com o rato para achar "Caça de Azurill" nao e' escolher. Um `datalist` e' o mesmo
     * campo com filtro de graça — clicar mostra tudo, escrever estreita, e o navegador faz a
     * busca. Cada opcao leva o nivel e a regiao na etiqueta, que e' por onde se decide.
     *
     * Uma lista para o painel todo, e nao uma por campo: sao 377 nos, e um degrau novo nao tem por
     * que duplicar isso. Ela so' se reconstroi quando a lista do jogo muda — `desenhar` corre a
     * cada batida, e refazer quatrocentos nos a cada batida seria pagar por nada.
     */
    const DATALISTA = 'lioncode-escada-cacadas';

    let nomesSabidos = new Set();
    let digitalDaLista = '';

    const encherDatalista = () => {
      const todas = cacadasConhecidas();
      const digital = `${todas.length}|${todas[0]?.nome || ''}|${todas.at(-1)?.nome || ''}`;
      nomesSabidos = new Set(todas.map((c) => c.nome));
      if (digital === digitalDaLista) return;
      digitalDaLista = digital;
      const lista = campo('[data-cacadas]');
      lista.innerHTML = '';
      for (const c of todas) {
        const o = document.createElement('option');
        o.value = c.nome;
        o.label =
          [c.nivel ? `Lv ${c.nivel}` : '', c.regiao, c.trancada ? 'trancada' : '']
            .filter(Boolean)
            .join(' · ') || (c.minha ? 'atalho seu' : '');
        lista.append(o);
      }
    };

    /**
     * Marca o campo cuja caçada ninguem conhece.
     *
     * Um campo de escrever aceita qualquer coisa, e um erro de digitação so' apareceria na viagem
     * — tarde, e a dizer "não achei em nenhuma aba". Antes era um `select`, e o valor orfao ficava
     * la' escrito "(não guardada)"; isto e' a mesma honestidade no campo que o substituiu.
     */
    const marcarCacada = (c) => {
      const nome = (c.value || '').trim();
      const sabida = !nome || nomesSabidos.has(nome);
      c.classList.toggle('nao-existe', !sabida);
      c.title = sabida
        ? 'A caçada — clique para ver a lista, ou escreva para filtrar'
        : `Não conheço nenhuma caçada chamada "${nome}"`;
    };

    /** Põe o valor no campo da caçada, e diz se ele é uma caçada que existe. */
    const encherCacadas = (campoDaCacada, valor, vazio) => {
      campoDaCacada.placeholder = vazio;
      campoDaCacada.value = valor || '';
      marcarCacada(campoDaCacada);
    };

    /**
     * Mantem a lista fresca no instante em que alguem vai escolher.
     *
     * **A ESCADA PARADA NAO REDESENHA SOZINHA** — nao ha' `setInterval` nenhum nesta ferramenta, de
     * proposito: quem avisa que o HUD mudou e' o HUD. Mas as Caçadas podem ler o catalogo do jogo
     * **depois** deste painel ter sido desenhado, e foi o que aconteceu no jogo do dono em
     * 12/10/2026: a lista do jogo chegou com 377 caçadas e os campos da Escada continuaram com as
     * dez de antes, ate' alguem mexer no painel.
     *
     * Enche-se ao focar, que e' o instante exacto em que a frescura importa e e' barato: a lista
     * so' se reconstroi se a do jogo mudou (ver `encherDatalista`).
     */
    const seguirALista = (c) =>
      c.addEventListener('focus', () => {
        encherDatalista();
        marcarCacada(c);
      });

    /** O campo de uma caçada: um `input` ligado à lista partilhada. */
    const campoDeCacada = () => {
      const c = document.createElement('input');
      c.type = 'text';
      c.setAttribute('list', DATALISTA);
      c.className = 'cacada';
      seguirALista(c);
      return c;
    };

    /**
     * Os times guardados, que sao as opcoes do fim "trocar de time".
     *
     * Vem da porta `PPX.times`, que e' quem guarda e monta time neste pacote. Com a ferramenta
     * Times desligada nao ha' lista nenhuma — e tambem nao haveria quem montasse —, e a escolha
     * guardada continua a aparecer para o dono ver que ela existe.
     */
    const encherTimes = (sel, valor) => {
      const nomes = globalThis.PPX?.times?.nomes?.() || [];
      sel.innerHTML = '';
      const nada = document.createElement('option');
      nada.value = '';
      nada.textContent = nomes.length ? 'escolha o time' : 'Times desligada';
      sel.append(nada);
      for (const nome of nomes) {
        const o = document.createElement('option');
        o.value = nome;
        o.textContent = nome;
        sel.append(o);
      }
      if (valor && !nomes.includes(valor)) {
        const o = document.createElement('option');
        o.value = valor;
        o.textContent = `${valor} (não guardado)`;
        sel.append(o);
      }
      sel.value = valor || '';
    };

    /**
     * A fila de times do fim da escada: uma linha por time, na ordem em que serao montados.
     *
     * Tem a forma dos degraus de proposito — lista, `+`, `×` — porque e' a mesma pergunta: "o que
     * vem depois disto". O que a lista nao mostra a olho e' **onde** se esta' nela, entao a linha
     * do time que vem a seguir fica marcada, e a do time montado agora di-lo no title.
     */
    const desenharFila = () => {
      const lugar = campo('[data-fila]');
      const vez = cfg.fim === 'time' ? timeSeguinte() : {};
      lugar.innerHTML = '';
      if (!cfg.times.length) {
        const vazio = document.createElement('p');
        vazio.className = 'vazio';
        vazio.textContent = 'Nenhum time na fila. Formado um, ela passa ao seguinte.';
        lugar.append(vazio);
      }
      for (const [i, nome] of cfg.times.entries()) {
        const item = document.createElement('li');
        if (nome && nome === vez.nome) item.classList.add('agora');
        if (nome && nome === vez.montado) item.title = 'é este que está montado agora';

        const qual = document.createElement('select');
        encherTimes(qual, nome);
        qual.addEventListener('change', () => {
          cfg.times[i] = qual.value;
          cfg.formados = false;
          gravar();
          desenhar();
          void conferir();
        });

        const apagar = document.createElement('button');
        apagar.type = 'button';
        apagar.dataset.apagar = '1';
        apagar.textContent = '×';
        apagar.title = 'Tirar este time da fila';
        apagar.addEventListener('click', () => {
          cfg.times.splice(i, 1);
          cfg.formados = false;
          gravar();
          desenhar();
        });

        item.append(qual, apagar);
        lugar.append(item);
      }
    };

    /**
     * A lista de quem pode ser o Pokemon fixo: quem esta' na equipe agora.
     *
     * **Da equipe, e nao da colecao inteira.** Sao 223 bichos na conta dele; uma listbox com 223
     * linhas nao e' uma escolha, e' uma busca. O fixo e' quem tem a pedra — ele esta' na equipe,
     * porque e' com ele que se caça. Um fixo guardado que saiu da equipe continua a aparecer, para
     * nao desaparecer calado.
     */
    /**
     * Quem pode ser a pedra de um turno: a equipe de agora **mais** quem esta' nos times dele.
     *
     * So' a equipe nao chega desde que ha' turnos: a pedra do segundo turno costuma estar na
     * mochila enquanto o primeiro corre, e era justamente ai' que ela tinha de ser escolhida. E a
     * coleção inteira tambem nao serve — 223 linhas nao sao uma escolha, sao uma busca.
     */
    const candidatosAPedra = (turno) => {
      const membrosDe = globalThis.PPX?.times?.membrosDe;
      const lista = [];
      const vistos = new Set();
      for (const p of equipe()) {
        vistos.add(p.id);
        lista.push({ id: p.id, nome: p.nome, nivel: p.nivel });
      }
      if (typeof membrosDe === 'function')
        for (const nome of semVazios(turno.times || []))
          for (const id of membrosDe(nome)) {
            if (vistos.has(id)) continue;
            vistos.add(id);
            const sabido = colecao.get(id);
            if (sabido) lista.push({ id, nome: sabido.nome, nivel: sabido.nivel });
          }
      return lista;
    };

    const desenharFixo = (sel, turno) => {
      const podem = candidatosAPedra(turno);
      const escolhido = turno.fixo;
      sel.innerHTML = '';
      const nada = document.createElement('option');
      nada.value = '';
      nada.textContent = podem.length ? 'quem tem a pedra' : 'equipe ainda não lida';
      sel.append(nada);
      for (const p of podem) {
        const o = document.createElement('option');
        o.value = p.id;
        o.textContent = `${p.nome} Lv ${p.nivel ?? '?'}`;
        sel.append(o);
      }
      if (escolhido && !podem.some((p) => p.id === escolhido)) {
        const o = document.createElement('option');
        o.value = escolhido;
        const sabido = colecao.get(escolhido);
        o.textContent = sabido ? `${sabido.nome} (fora da equipe)` : 'a pedra saiu da equipe';
        sel.append(o);
      }
      sel.value = escolhido || '';
    };

    /** Os times de onde vem quem roda. Mesma forma da fila do fim da escada, e pelo mesmo motivo. */
    /**
     * A lista de onde o grupo fica, em ordem de preferencia.
     *
     * E' uma lista e nao um campo so' porque ha' lugares que acabam — a expedição dura o que
     * dura, e quando ela fecha o grupo tem de ter para onde ir sem ninguem a mandar nele.
     */
    const desenharOndes = () => {
      const lugar = campo('[data-ondes]');
      lugar.innerHTML = '';
      if (!cfg.grupo.cacadas.length) {
        const vazio = document.createElement('p');
        vazio.className = 'vazio';
        vazio.textContent = 'Nenhuma. A primeira da lista onde eu puder estar é onde o grupo fica.';
        lugar.append(vazio);
      }
      for (const [i, nome] of cfg.grupo.cacadas.entries()) {
        const item = document.createElement('li');
        const qual = campoDeCacada();
        encherCacadas(qual, nome, 'escolha a caçada');
        qual.addEventListener('change', () => {
          cfg.grupo.cacadas[i] = qual.value.trim();
          gravar();
          desenhar();
          void conferir();
        });
        const apagar = document.createElement('button');
        apagar.type = 'button';
        apagar.dataset.apagar = '1';
        apagar.textContent = '\u00d7';
        apagar.title = 'Tirar esta caçada';
        apagar.addEventListener('click', () => {
          cfg.grupo.cacadas.splice(i, 1);
          gravar();
          desenhar();
        });
        item.append(qual, apagar);
        lugar.append(item);
      }
    };

    /**
     * A lista de turnos: cada pedra com os seus times, recuados por baixo dela.
     *
     * Um turno e' uma unidade — a pedra e os Pokemon com quem ela divide — e por isso desenha-se
     * junto. Duas listas lado a lado (pedras aqui, times ali) deixariam ao dono a tarefa de
     * lembrar qual linha e' de qual.
     */
    const desenharTurnos = () => {
      const lugar = campo('[data-turnos]');
      lugar.innerHTML = '';
      const turnos = turnosDoGrupo();
      if (!turnos.length) {
        const vazio = document.createElement('p');
        vazio.className = 'vazio';
        vazio.textContent = 'Nenhuma pedra. Clique em "+ pedra" para começar.';
        lugar.append(vazio);
      }
      for (const [i, turno] of turnos.entries()) {
        const item = document.createElement('li');
        item.className = 'turno';

        const cima = document.createElement('div');
        cima.className = 'cima';
        const quem = document.createElement('select');
        quem.title = 'O Pokémon que tem a pedra — ele nunca sai do grupo';
        desenharFixo(quem, turno);
        quem.addEventListener('change', () => {
          turno.fixo = quem.value;
          gravar();
          desenhar();
          void conferir();
        });
        const forada = document.createElement('button');
        forada.type = 'button';
        forada.dataset.apagar = '1';
        forada.textContent = '\u00d7';
        forada.title = 'Tirar esta pedra do rodízio';
        forada.addEventListener('click', () => {
          cfg.grupo.turnos.splice(i, 1);
          gravar();
          desenhar();
        });
        cima.append(quem, forada);

        const times = document.createElement('ul');
        if (!semVazios(turno.times).length) {
          const conta = document.createElement('p');
          conta.className = 'conta';
          conta.textContent = 'sem times: esta pedra não tem quem upar';
          item.append(cima, conta);
        } else item.append(cima);
        for (const [j, nome] of (turno.times || []).entries()) {
          const linha = document.createElement('li');
          const qual = document.createElement('select');
          encherTimes(qual, nome);
          qual.addEventListener('change', () => {
            turno.times[j] = qual.value;
            gravar();
            desenhar();
            void conferir();
          });
          const apagar = document.createElement('button');
          apagar.type = 'button';
          apagar.dataset.apagar = '1';
          apagar.textContent = '\u00d7';
          apagar.title = 'Tirar este time';
          apagar.addEventListener('click', () => {
            turno.times.splice(j, 1);
            gravar();
            desenhar();
          });
          linha.append(qual, apagar);
          times.append(linha);
        }
        const mais = document.createElement('button');
        mais.type = 'button';
        mais.className = 'mais';
        mais.textContent = '+ time';
        mais.addEventListener('click', () => {
          turno.times = turno.times || [];
          turno.times.push('');
          gravar();
          desenhar();
        });
        item.append(times, mais);
        lugar.append(item);
      }
    };

    /**
     * Repinta o painel. `dizerPorque` falso guarda a frase que ja' esta' na tela.
     *
     * Ele acaba com o diagnostico, que e' o certo quase sempre — mas quem acabou de falhar ja'
     * disse **porque** falhou, e o diagnostico apagaria isso por cima. Medido no jogo em
     * 11/10/2026: o "Não consegui ir para X: …" nunca chegava a ser lido, porque o `finally` do
     * caminho a' mao redesenhava logo a seguir.
     */
    /**
     * Quanto o corpo pode crescer antes de o painel passar do fundo da tela.
     *
     * Um teto escrito no CSS seria um palpite sobre onde o painel esta': ele arrasta-se, e um
     * painel posto mais abaixo passaria do rodape com a mesma conta. Aqui a medida sai de onde o
     * corpo **esta'** agora, e sobra um dedo de respiro por baixo.
     *
     * Chamada depois de cada desenho, de cada arrasto e de cada mudanca de tamanho da janela — e
     * nunca com o painel escondido, que nao tem caixa e daria zero.
     */
    const ajustarAltura = () => {
      const corpo = painel.querySelector('.corpo');
      if (!corpo || painel.style.display === 'none') return;
      // Limpar primeiro devolve o teto do CSS, que e' o chao desta conta: se a medida nao der, a
      // barra existe na mesma, so' que por um numero redondo em vez do exacto.
      corpo.style.maxHeight = '';
      // Janela ainda sem altura: acontece num separador escondido (medido na banca — `innerHeight`
      // e `clientHeight` sao zero com `document.hidden`). Tenta-se no quadro seguinte; escondido
      // o quadro nao vem, e quando a aba voltar o `resize` trata disto.
      if (!innerHeight) {
        requestAnimationFrame(ajustarAltura);
        return;
      }
      const caixa = corpo.getBoundingClientRect();
      // O que fica **debaixo** do corpo tambem ocupa chao: hoje e' a linha do recado, que saiu da
      // parte que rola. Mede-se em vez de se escrever um numero — amanha pode ser outra coisa, e
      // um numero ficaria a mentir sem ninguem dar por isso.
      const rodape = Math.max(0, painel.getBoundingClientRect().bottom - caixa.bottom);
      const cabe = Math.max(140, Math.round(innerHeight - caixa.top - rodape - 12));
      corpo.style.maxHeight = `${cabe}px`;
    };

    const desenhar = (dizerPorque = true) => {
      const ligar = campo('[data-ligar]');
      ligar.textContent = cfg.ligada ? 'Parar' : 'Iniciar';
      ligar.classList.toggle('a-correr', cfg.ligada);
      // Parar esquece o que ia fazer; pausar guarda o lugar. Sao dois botoes porque sao duas
      // coisas, e quem pausa a noite inteira nao quer perder a rodada por clicar no errado.
      const pausar = campo('[data-pausar]');
      pausar.textContent = cfg.pausada ? 'Retomar' : 'Pausar';
      pausar.classList.toggle('a-correr', cfg.pausada);
      pausar.disabled = !cfg.ligada;
      campo('[data-modo]').value = cfg.modo || 'escada';
      const noGrupo = cfg.modo !== 'escada';
      campo('[data-escada]').style.display = noGrupo ? 'none' : '';
      campo('[data-grupo]').style.display = noGrupo ? '' : 'none';
      if (noGrupo) {
        desenharOndes();
        garantirColecao();
        desenharTurnos();
        campo('[data-alvo]').value = cfg.grupo.alvo ?? '';
        campo('[data-minimo]').value = cfg.grupo.minimo ?? '';
        campo('[data-passo]').value = cfg.grupo.passo ?? '';
        campo('[data-so-grupo]').style.display = cfg.modo === 'grupo' ? '' : 'none';
        campo('[data-so-passo]').style.display = cfg.modo === 'passo' ? '' : 'none';
      }
      campo('[data-trocar]').checked = cfg.trocar !== false;
      campo('[data-teto]').value = cfg.teto ?? '';
      campo('[data-subida]').value = cfg.subida ?? '';
      encherDatalista();
      campo('[data-fim]').value = cfg.fim || 'nada';
      // A subida nao esconde o fim da escada — ela so' muda o caminho ate' la'. Esconde-lo foi o
      // defeito de uma hora: a fila de times sumiu do painel, e com ela o unico lugar de dizer
      // "quando estes acabarem, upa os outros".
      campo('[data-junta]').style.display = cfg.subida ? '' : 'none';
      ajustarAltura();
      // Cada fim pede uma coisa diferente, ou nenhuma. Mostrar os tres campos ao mesmo tempo faria
      // o painel perguntar duas coisas que nao vao ser usadas.
      const destino = campo('[data-destino]');
      destino.style.display = cfg.fim === 'cacada' ? '' : 'none';
      campo('[data-times]').style.display = cfg.fim === 'time' ? '' : 'none';
      encherCacadas(destino, cfg.destino, 'escolha a caçada');
      desenharFila();

      // A pergunta do fim da fila: aparece quando ha' pergunta, e nao antes.
      const depois = campo('[data-depois]');
      const perguntando = filaAcabou();
      depois.style.display = perguntando ? '' : 'none';
      // Com a resposta guardada, a listbox mostra-a: ela deixou de ser uma pergunta e passou a ser
      // uma configuracao, e uma configuracao que nao mostra o proprio valor nao se pode conferir.
      depois.value = cfg.depois || cfg.sempre || '';
      painel.classList.toggle('pergunta', perguntando && !cfg.depois && !cfg.sempre);
      // A caixinha aparece com a pergunta — **e tambem com a resposta guardada**, que e' a unica
      // maneira de a desmarcar depois. Escondida, ela guardaria uma escolha sem lugar para desfazer.
      campo('[data-sempre-linha]').style.display = perguntando || cfg.sempre ? 'flex' : 'none';
      campo('[data-sempre]').checked = Boolean(cfg.sempre);

      const n = nivelLider();
      const emCurso = degrauPara(n);
      lista.innerHTML = '';
      if (!cfg.degraus.length) {
        const vazio = document.createElement('p');
        vazio.className = 'vazio';
        vazio.textContent = 'Nenhum degrau. Um degrau é "a partir do nível N, caçar aqui".';
        lista.append(vazio);
      }
      for (const degrau of cfg.degraus) {
        const item = document.createElement('li');
        if (emCurso === degrau) item.classList.add('agora');

        const nivel = document.createElement('input');
        nivel.type = 'number';
        nivel.min = '1';
        nivel.value = degrau.nivel;
        nivel.title = 'A partir deste nível do líder';
        nivel.addEventListener('change', () => {
          const v = Number(nivel.value);
          if (!Number.isFinite(v) || v < 1) {
            nivel.value = degrau.nivel;
            return;
          }
          degrau.nivel = Math.round(v);
          ordenar();
          gravar();
          desenhar();
        });

        const onde = campoDeCacada();
        encherCacadas(onde, degrau.cacada, 'escolha a caçada');
        onde.addEventListener('change', () => {
          degrau.cacada = onde.value.trim();
          gravar();
          desenhar();
        });

        const ir = document.createElement('button');
        ir.type = 'button';
        ir.textContent = '▸';
        ir.title = 'Ir agora para esta caçada';
        ir.addEventListener('click', () => void irAMao(degrau));

        const apagar = document.createElement('button');
        apagar.type = 'button';
        apagar.dataset.apagar = '1';
        apagar.textContent = '×';
        apagar.title = 'Apagar este degrau';
        apagar.addEventListener('click', () => {
          cfg.degraus = cfg.degraus.filter((d) => d !== degrau);
          gravar();
          desenhar();
        });

        item.append(nivel, onde, ir, apagar);
        lista.append(item);
      }
      if (dizerPorque) diz(diagnostico());
    };

    /** Um clique de cada vez no ▸: o segundo so' atrapalharia o primeiro. */
    let indoAMao = false;

    /**
     * O caminho a' mao, que vale com a escada parada e sem licenca nenhuma.
     *
     * Ele marca o degrau como cumprido: ir a' mao para onde a escada iria e' cumprir o degrau, e
     * nao marcar faria a escada arrastar o jogador para la' outra vez na batida seguinte.
     *
     * E NO FIM ELE PEDE UMA BATIDA. Medido no jogo em 11/10/2026: com o aluno no Lv 8, o ▸ do
     * degrau de Lv 1 levou-o para la' e o painel ficou meio minuto a dizer "Em Magikarp." — com a
     * escada ligada e o degrau dele a ser outro. Ninguem subiu de nivel, ninguem morreu, entao o
     * HUD nao mudou e nenhuma batida aconteceu: a escada **ia** voltar para o degrau certo, so' que
     * no proximo nivel, dois minutos depois, sem nunca o ter dito.
     *
     * Com a batida, ela reavalia na hora. Se o degrau a' mao era o do aluno, fica — e' o caso
     * comum. Se era um degrau abaixo, ela volta a subir, que e' o que ela ia fazer de qualquer
     * maneira: o ▸ leva agora, a escada continua sendo a escada. A diferenca e' que agora ela diz.
     */
    async function irAMao(degrau) {
      if (indoAMao || correndo) return;
      if (!degrau.cacada) return diz('Esse degrau não tem caçada escolhida.', true);
      indoAMao = true;
      let recado = null;
      try {
        diz(`Indo para "${degrau.cacada}"…`);
        const r = await viajar(degrau.cacada);
        if (r.ok) {
          cfg.aplicado = degrau.nivel;
          gravar();
          recado = { txt: `Em "${degrau.cacada}".`, bom: true };
        } else {
          recado = {
            txt: `Não consegui ir para "${degrau.cacada}": ${r.erro || 'o jogo não me levou'}`,
            ruim: true,
          };
        }
      } finally {
        indoAMao = false;
        // Primeiro o desenho, depois a frase: ao contrario, o desenho apagava-a com o diagnostico.
        desenhar(false);
        if (recado) {
          diz(recado.txt, recado.ruim);
          if (recado.bom) {
            estado.classList.add('bom');
            ecoar();
          }
        } else diz(diagnostico());
        retomar();
      }
    }

    campo('[data-ligar]').addEventListener('click', () => {
      cfg.ligada = !cfg.ligada;
      // Ligar nao e' continuar de onde parou: quem liga quer que ela decida agora, com o nivel de
      // agora. O degrau cumprido fica, porque o aluno e' o mesmo.
      esperaAte = 0;
      gravar();
      desenhar();
      if (cfg.ligada) void conferir();
    });

    campo('[data-pausar]').addEventListener('click', () => {
      cfg.pausada = !cfg.pausada;
      // Retomar nao e' continuar de onde parou no relogio: o castigo de uma viagem falhada nao tem
      // de ser cumprido depois de uma pausa que durou mais do que ele.
      if (!cfg.pausada) esperaAte = 0;
      gravar();
      desenhar();
      if (!cfg.pausada) void conferir();
    });

    campo('[data-modo]').addEventListener('change', (e) => {
      cfg.modo = e.target.value;
      // O modo novo decide com o estado de agora. O que ficou guardado do outro modo — degrau
      // cumprido, aluno, rodada — fica onde estava: voltar ao modo anterior nao e' recomeçar.
      esperaAte = 0;
      gravar();
      desenhar();
      void conferir();
    });

    campo('[data-mais-onde]').addEventListener('click', () => {
      cfg.grupo.cacadas.push('');
      gravar();
      desenhar();
    });

    campo('[data-mais-turno]').addEventListener('click', () => {
      cfg.grupo.turnos = turnosDoGrupo();
      cfg.grupo.turnos.push({ fixo: '', times: [''] });
      gravar();
      desenhar();
    });

    for (const [campoNome, chave] of [
      ['[data-alvo]', 'alvo'],
      ['[data-minimo]', 'minimo'],
      ['[data-passo]', 'passo'],
    ])
      campo(campoNome).addEventListener('change', (e) => {
        const v = Number(e.target.value);
        cfg.grupo[chave] =
          e.target.value === '' || !Number.isFinite(v) || v < 1 ? null : Math.round(v);
        // Mexer no alvo e' mudar de ideia sobre onde se chega: as rodadas ja' fechadas nao valem
        // para o alvo novo, e guarda-las faria o proximo alvo sair de uma conta que ele nao fez.
        cfg.grupo.rodada = 0;
        gravar();
        desenhar();
        void conferir();
      });

    campo('[data-trocar]').addEventListener('change', (e) => {
      cfg.trocar = e.target.checked;
      gravar();
      desenhar();
      if (cfg.trocar) void conferir();
    });

    for (const [qual, chave] of [
      ['[data-teto]', 'teto'],
      ['[data-subida]', 'subida'],
    ])
      campo(qual).addEventListener('change', (e) => {
        const v = Number(e.target.value);
        cfg[chave] = e.target.value === '' || !Number.isFinite(v) || v < 1 ? null : Math.round(v);
        // Mudar o teto muda quem e' o aluno, e o degrau cumprido era do aluno anterior. A subida
        // muda o teto, entao muda o mesmo.
        cfg.formados = false;
        gravar();
        desenhar();
        void conferir();
      });

    // Mudar qualquer coisa do fim e' mudar de ideia sobre o fim: o que ja' foi cumprido deixa de
    // valer, senao a escolha nova nunca aconteceria.
    campo('[data-fim]').addEventListener('change', (e) => {
      cfg.fim = e.target.value;
      cfg.formados = false;
      gravar();
      desenhar();
      void conferir();
    });

    seguirALista(campo('[data-destino]'));

    campo('[data-destino]').addEventListener('change', (e) => {
      cfg.destino = e.target.value.trim();
      cfg.formados = false;
      gravar();
      desenhar();
      void conferir();
    });

    /**
     * A resposta a' pergunta do fim da fila — e **o unico sitio desta ferramenta que age por um
     * clique do dono e nao por uma batida**.
     *
     * Age aqui, e nao na batida seguinte, de proposito: uma accao guardada para "a proxima batida"
     * seria refeita em cada batida, e voltar para a cidade tres vezes nao e' voltar uma vez.
     */
    async function responder(escolha) {
      if (!escolha) return;
      if (correndo || indoAMao) {
        desenhar(false);
        return diz('Espere eu acabar o que estou fazendo.', true);
      }
      cfg.depois = escolha;
      gravar();

      // Estas duas nao tocam no jogo: nao ha' o que pedir a' fila nem o que esperar.
      if (escolha === 'parar') {
        cfg.ligada = false;
        gravar();
        return desenhar();
      }
      if (escolha === 'nada') return desenhar();

      correndo = true;
      try {
        const soltar = await esperarAVez();
        if (!soltar) {
          cfg.depois = '';
          gravar();
          desenhar(false);
          return diz('Outra ferramenta está agindo. Escolha de novo em um instante.', true);
        }
        try {
          if (escolha === 'cidade') {
            diz('Voltando para a cidade.');
            const r = await pedirCidade();
            desenhar(false);
            if (r?.erro) {
              cfg.depois = '';
              gravar();
              return diz(`Não consegui voltar para a cidade: ${r.erro}`, true);
            }
            return diz(diagnostico());
          }
          // Recomeçar a fila e' montar o primeiro time dela: dai' em diante o lugar na fila e' o
          // dele, e a escada segue sozinha como em qualquer outra volta.
          const primeiro = fila()[0];
          const usar = globalThis.PPX?.times?.usar;
          if (!usar) {
            cfg.depois = '';
            gravar();
            desenhar(false);
            return diz('A ferramenta Times está desligada — é ela que monta o time.', true);
          }
          diz(`Recomeçando a fila: montando "${primeiro}".`);
          const r = await usar(primeiro);
          const montado = globalThis.PPX?.times?.qual?.();
          if (!r?.ok || montado !== primeiro) {
            cfg.depois = '';
            gravar();
            desenhar(false);
            return diz(
              `Não consegui montar "${primeiro}": ${r?.erro || 'a equipe na tela não é esse time'}`,
              true,
            );
          }
          // A volta e' nova: aluno e degrau sao de quem chegou, e a pergunta volta a ser feita no
          // fim da proxima fila.
          cfg.aplicado = null;
          cfg.aluno = '';
          cfg.formados = false;
          cfg.depois = '';
          gravar();
          desenhar(false);
          // Parada, montar o time e' tudo o que ela faz — e dizer "recomeçada" sem dizer isso
          // deixaria-o a' espera de uma escada que nao vai subir nada.
          diz(
            cfg.ligada
              ? `Fila recomeçada com "${primeiro}".`
              : `Montei "${primeiro}", mas estou parada: clique em Iniciar.`,
          );
        } finally {
          soltar();
        }
      } finally {
        correndo = false;
        // Ela mexeu no HUD, e parada na cidade mais nada mexe. Ver `batidaEm`.
        retomar();
      }
    }

    campo('[data-depois]').addEventListener('change', (e) => {
      // Com a caixinha marcada, trocar a resposta troca a guardada: senao ele mudaria de ideia na
      // listbox e a volta seguinte faria a de ontem, sem nada na tela a dizer porque'.
      if (cfg.sempre) {
        cfg.sempre = e.target.value;
        gravar();
      }
      void responder(e.target.value);
    });

    // A caixinha guarda a resposta que esta' escolhida — e **so'** se houver uma. Marcar sem ter
    // respondido guardaria o vazio, que e' exactamente "pergunte outra vez": a caixinha ficaria
    // marcada a prometer o contrario do que faz.
    campo('[data-sempre]').addEventListener('change', (e) => {
      if (!e.target.checked) {
        cfg.sempre = '';
        gravar();
        desenhar(false);
        return diz('Volto a perguntar quando a fila de times acabar.');
      }
      const escolha = cfg.depois || campo('[data-depois]').value;
      if (!escolha) {
        e.target.checked = false;
        return diz('Escolha primeiro o que eu faço — depois marque para eu fazer sempre.', true);
      }
      cfg.sempre = escolha;
      gravar();
      desenhar(false);
      diz(`Daqui em diante, quando a fila acabar: ${O_QUE_FAREI[escolha] || escolha}.`);
    });

    campo('[data-mais-time]').addEventListener('click', () => {
      cfg.times.push('');
      cfg.formados = false;
      gravar();
      desenhar();
    });

    campo('[data-mais]').addEventListener('click', () => {
      cfg.degraus.push({ nivel: nivelDoProximo(), cacada: '' });
      ordenar();
      gravar();
      desenhar();
    });

    /**
     * Levar esta escada para outra janela.
     *
     * O MESMO JOGO CORRE NUMA JANELA POR CONTA, e montar nove degraus, os turnos da pedra e a fila
     * de times a' mao em cada uma e' trabalho que ninguem quer repetir — e em que se erra. Quem
     * empacota e' o `PPX.config`; aqui so' se diz o que e' escolha e o que e' estado.
     *
     * O QUE NAO VAI, E PORQUE.
     *   - `ligada` e `pausada`: importar uma escada ligada poria a outra janela a andar sem
     *     ninguem ter mandado. Quem liga e' quem esta' na janela.
     *   - `aplicado`: e' "ja' te levei ao degrau N" **nesta** conta. Levado para outra, ela acharia
     *     que ja' tinha viajado e ficaria parada no primeiro degrau que importasse.
     *   - `grupo.rodada`: as rodadas de passo ja' fechadas sao do relogio desta conta.
     *   - `depois`: a resposta de **hoje** a' pergunta do fim da fila. A permanente (`sempre`) vai.
     *   - `turnos[].fixo`: **a pedra e' um bicho desta conta**, guardada pelo `data-creature-id`.
     *     Noutra conta esse id nao existe — ou, pior, existe e e' outro bicho. Os turnos viajam
     *     com os times e sem a pedra, e o painel pede-a a quem importou.
     */
    const limparTexto = (v, teto) =>
      String(v ?? '')
        .trim()
        .slice(0, teto);
    const limparNivel = (v) => {
      const n = Math.round(Number(v));
      return Number.isFinite(n) && n > 0 ? Math.min(n, 9999) : null;
    };

    const botoesConfig = globalThis.PPX?.config?.montarBotoes({
      id: 'escada',
      nome: 'Escada de caçadas',
      coletar: () => ({
        degraus: cfg.degraus.map((d) => ({ nivel: d.nivel, cacada: d.cacada })),
        trocar: cfg.trocar !== false,
        teto: cfg.teto,
        subida: cfg.subida,
        modo: cfg.modo,
        fim: cfg.fim,
        destino: cfg.destino,
        times: cfg.times,
        sempre: cfg.sempre,
        grupo: {
          cacadas: cfg.grupo.cacadas,
          turnos: cfg.grupo.turnos.map((t) => ({ times: t.times })),
          alvo: cfg.grupo.alvo,
          minimo: cfg.grupo.minimo,
          passo: cfg.grupo.passo,
        },
      }),
      aplicar: (dados) => {
        // Importar com ela a correr trocaria os degraus debaixo de uma viagem a meio.
        if (cfg.ligada) throw new Error('pare a escada antes de importar');
        const lista = (v) => (Array.isArray(v) ? v : []);
        const grupo = dados?.grupo && typeof dados.grupo === 'object' ? dados.grupo : {};
        cfg.degraus = lista(dados?.degraus)
          .slice(0, 100)
          .map((d) => ({ nivel: limparNivel(d?.nivel), cacada: limparTexto(d?.cacada, 80) }))
          .filter((d) => d.nivel !== null);
        ordenar();
        cfg.trocar = dados?.trocar !== false;
        cfg.teto = limparNivel(dados?.teto);
        cfg.subida = limparNivel(dados?.subida);
        cfg.modo = ['escada', 'grupo', 'passo'].includes(dados?.modo) ? dados.modo : 'escada';
        cfg.fim = ['nada', 'cacada', 'time', 'cidade'].includes(dados?.fim) ? dados.fim : 'nada';
        cfg.destino = limparTexto(dados?.destino, 80);
        cfg.times = lista(dados?.times)
          .slice(0, 50)
          .map((t) => limparTexto(t, 60));
        cfg.sempre = ['nada', 'cidade', 'time', 'parar'].includes(dados?.sempre)
          ? dados.sempre
          : '';
        cfg.grupo.cacadas = lista(grupo.cacadas)
          .slice(0, 50)
          .map((c) => limparTexto(c, 80));
        cfg.grupo.turnos = lista(grupo.turnos)
          .slice(0, 20)
          .map((t) => ({
            fixo: '',
            times: lista(t?.times)
              .slice(0, 50)
              .map((n) => limparTexto(n, 60)),
          }));
        cfg.grupo.alvo = limparNivel(grupo.alvo);
        cfg.grupo.minimo = limparNivel(grupo.minimo);
        cfg.grupo.passo = limparNivel(grupo.passo);
        // Estado desta janela, e nao configuracao: a escada importada comeca parada e sem
        // degrau aplicado, que e' o unico comeco honesto numa conta que nao e' a de origem.
        cfg.ligada = false;
        cfg.pausada = false;
        cfg.aplicado = null;
        cfg.depois = '';
        cfg.formados = false;
        cfg.grupo.rodada = 0;
        gravar();
        desenhar(false);
        // Dizer o que **nao** veio e' parte de importar: uma pedra em falta e' calada no painel
        // de quem nao sabe que ela nao viaja.
        const pedras = cfg.grupo.turnos.length;
        if (!pedras) return 'Escada importada.';
        return pedras === 1
          ? 'Escada importada. A pedra veio sem o Pokémon: escolha quem a tem nesta conta.'
          : `Escada importada. As ${pedras} pedras vieram sem o Pokémon: escolha quem as tem aqui.`;
      },
      avisar: diz,
    });
    if (botoesConfig) campo('[data-config]').append(botoesConfig.el);

    // ------------------------------------------------------------- mostrar e esconder

    const recolocar = () => {
      if (!globalThis.PPX?.canto?.aplicar(painel, ler(CHAVE_POS, null))) {
        painel.style.left = 'auto';
        painel.style.top = '96px';
        painel.style.right = '262px';
        painel.style.bottom = 'auto';
      }
      ajustarAltura();
    };

    const mostrarPainel = (sim) => {
      painel.style.display = sim ? 'block' : 'none';
      // Escondido o painel nao tem caixa, e posicionar pelo zero mandava-o para o canto errado.
      if (sim) recolocar();
    };

    let minimizado = ler(CHAVE_MIN, false) === true;
    const aplicarMinimo = () => {
      painel.classList.toggle('minimizado', minimizado);
      campo('[data-titulo]').textContent = minimizado ? 'ESCADA' : 'Escada';
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
      globalThis.PPX?.anotar?.('escada', false);
    });

    {
      let movendo = null;
      painel.querySelector('header').addEventListener('pointerdown', (evento) => {
        if (evento.target.closest('button')) return;
        const caixa = painel.getBoundingClientRect();
        movendo = {
          dx: evento.clientX - caixa.left,
          dy: evento.clientY - caixa.top,
        };
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
        // Arrastado para baixo, o corpo tem menos chao: o teto reconta-se onde ele parou.
        ajustarAltura();
      });
    }

    addEventListener('resize', recolocar);
    // Alt+U esconde, Alt+I mostra — vizinhas, como nas outras ferramentas. Sao as duas unicas
    // teclas que sobravam: o pacote ja' usa dezoito, o caderno de anotacoes usa O e P em qualquer
    // site, e o LionMultInstance escuta M, R, as setas e o 1 ao 4 por fora da pagina.
    addEventListener('keydown', (evento) => {
      if (!evento.altKey || evento.ctrlKey || evento.metaKey) return;
      if (evento.code === 'KeyU') {
        evento.preventDefault();
        mostrarPainel(false);
        globalThis.PPX?.anotar?.('escada', false);
      } else if (evento.code === 'KeyI') {
        evento.preventDefault();
        mostrarPainel(true);
        globalThis.PPX?.anotar?.('escada', true);
      }
    });

    // **A CAÇADA CEDE A VEZ A QUALQUER OUTRA FERRAMENTA, E QUEM CEDE TEM DE SER ACORDADO.**
    // O gatilho normal e' o HUD mudar — mas quem esta' a ceder nao mexe no HUD, e a ferramenta que
    // esta' a' frente pode nem mexer. Sem isto, ela cederia a vez e ficava a' espera para sempre.
    // Vale para os dois modos desde 13/10/2026, pelo mesmo motivo que o `cedendo` vale.
    globalThis.PPX?.vez?.aoMudar?.(() => {
      if (!cfg.ligada || cfg.pausada) return;
      if (cedendo()) {
        diz(diagnostico());
        return;
      }
      retomar();
    });

    desenhar();
    aplicarMinimo();
    recolocar();
    vigiar();
    // A escada confere assim que a pagina abre: quem recarregou com o lider ja' acima do degrau
    // tem de ser levado sem esperar o proximo nivel.
    void conferir();

    if (globalThis.PPX) {
      globalThis.PPX.controlar?.('escada', mostrarPainel);
      mostrarPainel(globalThis.PPX.visivel?.('escada') !== false);
    }
  },
);
