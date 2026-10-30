// PokePixel - ginasio do dia
//
// Sai da cacada, troca para o time de ginasio, desafia o ginasio marcado HOJE, volta para o time de
// cacada e reentra na mesma cacada de onde saiu.
//
// MEDIDO NO JOGO (sessao de 2026-10-05, conta de nivel 239):
//
// - sair da cacada ......................... botao VOLTAR A CIDADE, imediato
// - abrir o ginasio ........................ NPC "GYM" no mapa, ~2,5 s ate' a janela
// - combate contra o Brock ................. 67 s (o relogio da tela marcava 15 min)
// - trocar de time ......................... 20-30 s, pelo Times
//
// TRES COISAS QUE SO' APARECERAM FAZENDO, e que explicam o desenho inteiro:
//
// 1. NAO E' PRECISO ANDAR. O pedido original falava em "correr para o ginasio". Nao e' preciso: o
//    "Conversar" do NPC GYM foi clicado com o NPC **fora da tela** e a janela abriu. Nenhum passo
//    desta ferramenta move o personagem.
//
// 2. O F5 E' OBRIGATORIO entre trocar o time e desafiar. Sem ele o painel do ginasio continua
//    vendo a equipe antiga — medido: seis Pokemon no HUD e "Pokemon equipados 1/3" na janela,
//    mesmo fechando e reabrindo. So' a recarga acerta. Desafiar assim entregaria um ginasio
//    reforcado por uma condicao que o jogador de facto cumpria.
//
//    E' por causa deste F5 que existe a maquina de estados guardada no armazenamento: a recarga
//    mata tudo o que estiver so' na memoria, e a tarefa precisa continuar do outro lado.
//
//    HA' UMA SEGUNDA RECARGA, e ela nao tem a mesma natureza. Esta nao conserta uma leitura
//    errada do jogo: e' precaucao antes de montar o time da cacada. Depois do combate a pagina
//    passou por um cinema, uma tela de resumo e os banners que nascem por cima dela, e era ali
//    que apareciam erros na troca de equipe. Comecar essa parte de uma pagina limpa custa uns
//    segundos num orcamento de dois a tres minutos, e a maquina de estados que o primeiro F5
//    obrigou a existir ja' paga o custo de atravessar a recarga.
//
// 3. O COMBATE E' AUTOMATICO e o cronometro da tela e' um **teto**, nao a duracao. Esperar ele
//    zerar seria esperar 15 minutos por algo que levou 67 segundos. Quem diz que acabou e' o
//    titulo do resumo, que ja' vem com o resultado dentro. Ver `esperarOCombate`.

PPX.modulo(
  {
    id: 'gym',
    nome: 'Ginásio do dia',
    atalhos: 'Alt+G esconde · Alt+H mostra',
  },
  () => {
    'use strict';

    const CHAVE_TAREFA = 'lioncode:gym:tarefa';
    const CHAVE_ESCOLHAS = 'lioncode:gym:escolhas';
    const CHAVE_POS = 'lioncode:gym:posicao';
    /** A ultima cacada vista a correr, para o botao de voltar funcionar fora de uma tarefa. */
    const CHAVE_ULTIMA = 'lioncode:gym:ultima-cacada';
    const CHAVE_MIN = 'lioncode:gym:minimizado';
    const CHAVE_AGENDA = 'lioncode:gym:agenda';
    const CHAVE_PLACAR = 'lioncode:gym:placar';
    const CHAVE_ELITE4 = 'lioncode:gym:elite4';
    /**
     * Os ginasios que a ferramenta aprendeu do jogo, por regiao.
     *
     * Chave propria, e **de proposito fora do export**: isto e' o que ela descobriu sozinha, nao
     * uma escolha de ninguem. Levar o catalogo para outra janela seria levar o palpite de uma
     * conta para outra, e quando o jogo mudar os ginasios o catalogo velho venceria o jogo.
     */
    const CHAVE_GINASIOS = 'lioncode:gym:ginasios';

    /**
     * As regioes com Desafio dos Gyms, na ordem em que o jogo as poe nas abas.
     *
     * Hoenn entrou em 30/10/2026, quando o jogo a acrescentou. Medido na janela antes de entrar
     * aqui: as abas sao botoes de texto `KANTO`, `JOHTO` e `HOENN`, e o mapa do Hoenn traz os
     * mesmos sete `gym-hotspot` mais o `--league`, com o mesmo `is-active` e o mesmo rotulo
     * `HOJE`. Nada do que a ferramenta le' no jogo mudou: o que faltava era ela so' conhecer duas.
     *
     * Por isso tudo o que se repete por regiao — as abas do painel, os botoes da Elite 4, as
     * linhas da agenda — passou a ser desenhado a partir desta lista. Quando Sinnoh chegar, e'
     * uma linha.
     */
    const REGIOES = ['KANTO', 'JOHTO', 'HOENN'];
    const NOMES = { KANTO: 'Kanto', JOHTO: 'Johto', HOENN: 'Hoenn' };
    /** O nome bonito da regiao. Sem nome escrito mostra o proprio codigo, e nao 'Johto'. */
    const nomeDe = (regiao) => NOMES[regiao] || regiao;
    /** So' o texto cinzento da caixa de horas: horarios diferentes dizem que cada uma tem a sua. */
    const EXEMPLOS = ['08:00-09:00', '19:00-20:00', '13:00-14:00'];

    // ------------------------------------------------------------- os dois ciclos
    //
    // O tempo nao e' enfeite: a parte que se parece com um jogador nao e' a forma do clique, e' o
    // ritmo. Sair da cacada, trocar seis Pokemon e desafiar em oito segundos nao se parece com
    // ninguem, por mais fiel que seja cada evento de rato.
    //
    // Sao dois orcamentos porque sao dois momentos diferentes: antes do ginasio ha' pressa de quem
    // vai lutar; depois ha' a calma de quem ja' lutou, arruma a equipe e volta ao que fazia.
    //
    // Como no Times, o alvo e' sorteado a cada corrida e o espacamento sai dele: divide-se o que
    // resta pelos passos que faltam. Se o jogo estiver lento, as pausas encolhem sozinhas em vez de
    // a corrida estourar o prazo.

    const CICLO_PRE = [60000, 120000];
    const CICLO_SAIDA = [120000, 180000];
    /**
     * O chao de **qualquer** clique da sequencia, mesmo com o orcamento ja' estourado.
     *
     * Um segundo e meio nao e' realismo nenhum por si so'; e' a garantia de que nunca saem dois
     * cliques no mesmo instante, que foi o que se viu na tela da vitoria.
     */
    const PAUSA_ENTRE_CLIQUES = 1500;
    const PAUSA_MAXIMA = 40000;

    /** Dez minutos, como pedido: o intervalo entre uma tentativa que falhou e a seguinte. */
    const ESPERA_APOS_FALHA = 10 * 60 * 1000;

    /**
     * Quantas tentativas antes de desistir.
     *
     * Sem este teto a tarefa reagendava-se para sempre: um erro que nao passa sozinho — o time
     * apagado, o ginasio ja' feito hoje, a conta deslogada — virava uma tentativa de dez em dez
     * minutos, para sempre, a mexer no jogo sem ninguem a olhar. Tres e' o que cobre o que de
     * facto passa com o tempo (um anuncio preso, a pagina lenta); o que nao passa em tres nao
     * passa em trinta.
     */
    const MAX_TENTATIVAS = 3;

    /**
     * Teto da espera pelo combate. O relogio do jogo marca 15 min; isto e' rede de seguranca para o
     * caso de a tela de combate ficar presa, nao o tempo que se espera de facto.
     */
    const TETO_DO_COMBATE = 17 * 60 * 1000;

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
    const apagar = (chave) => {
      try {
        localStorage.removeItem(chave);
      } catch {
        /* idem. */
      }
    };

    const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
    const sorteio = (de, ate) => de + Math.random() * (ate - de);

    /**
     * Uma pausa do tamanho do que resta do orcamento, dividido pelos passos que faltam.
     *
     * `avisar` existe porque estas pausas sao longas — podem passar de meio minuto. Sem dizer na
     * tela que se esta' a esperar de proposito, a ferramenta pareceria travada, e o utilizador
     * carregaria no botão outra vez.
     */
    const dormir = async (ms, avisar) => {
      const fim = Date.now() + ms;
      while (Date.now() < fim) {
        if (parar) return;
        if (avisar) {
          const faltam = Math.ceil((fim - Date.now()) / 1000);
          avisar(faltam > 1 ? `Esperando um pouco… ${faltam} s` : 'Esperando um pouco…');
        }
        await espera(Math.min(1000, fim - Date.now()));
      }
    };

    /**
     * O ritmo corrente: um alvo no relogio e quantos **cliques** ainda faltam ate' la'.
     *
     * Antes o orcamento era repartido por etapas, e dentro de cada etapa os cliques saiam todos
     * juntos: a ferramenta ficava parada um bom bocado e depois disparava quatro cliques num
     * segundo. Relatado assim: "mal entrou a pagina de vitoria ja' disparou a troca de times".
     * Um jogador nao faz isso — o tempo dele esta' **entre** os cliques, nao antes deles.
     *
     * Agora quem respira e' o proprio clique: cada um leva o que resta do orcamento a dividir
     * pelos cliques que ainda faltam. Se o jogo demorar, as pausas encolhem sozinhas; se sobrar
     * tempo, o ultimo clique da fase fica com ele todo.
     */
    const ritmo = { alvo: 0, cliques: 0 };
    const abrirRitmo = (alvo, cliques) => {
      ritmo.alvo = alvo || 0;
      ritmo.cliques = cliques;
    };
    const fecharRitmo = () => {
      ritmo.alvo = 0;
      ritmo.cliques = 0;
    };

    const respirarAntesDoClique = async (avisar) => {
      if (!ritmo.alvo) return;
      const faltam = Math.max(1, ritmo.cliques);
      ritmo.cliques = Math.max(0, ritmo.cliques - 1);
      const justo = (ritmo.alvo - Date.now()) / faltam;
      await dormir(
        Math.round(
          Math.min(PAUSA_MAXIMA, Math.max(PAUSA_ENTRE_CLIQUES, justo * sorteio(0.65, 1.35))),
        ),
        avisar || ((t) => dizer(t)),
      );
    };

    const ate = async (condicao, limite) => {
      const inicio = Date.now();
      for (;;) {
        const valor = condicao();
        if (valor) return valor;
        if (Date.now() - inicio >= limite) return null;
        await espera(300);
      }
    };

    const visivel = (el) => Boolean(el) && el.getBoundingClientRect().width > 0;

    // ---------------------------------------------------------------- o jogo

    /**
     * Um clique com a sequencia inteira de ponteiro.
     *
     * O `✕` das janelas do jogo e' um `div` de caixa 0x0 e nao responde a `element.click()`. Esta
     * licao e os seus custos estao escritos em `times.js`, em `fechar`.
     *
     * `desvio` espalha o ponto de contacto dentro do elemento: ninguem acerta o centro exacto do
     * botao duas vezes seguidas.
     */
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

    /**
     * Fecha uma janela do jogo. **Um clique, nunca dois** — ver `times.js`, `fechar`.
     *
     * Clicar no `✕` de uma janela que ja' saiu da tela convence o jogo de que ha' uma janela
     * aberta, e dali em diante ele recusa qualquer abertura ate' um F5.
     */
    const fecharJanela = async (janela) => {
      if (!visivel(janela)) return true;
      const botao = janela.querySelector('.pokeidle-panel__close');
      if (!botao) return false;
      clicar(botao);
      return (await ate(() => !visivel(janela), 2500)) !== null;
    };

    /**
     * Um clique de gente: o ponteiro chega, hesita um instante, e so' entao carrega.
     *
     * A pausa entre o ponteiro chegar e o botao ser carregado e' curta mas existe sempre — e' o
     * tempo de quem viu o alvo antes de clicar.
     */
    const clicarHumano = async (el) => {
      // Primeiro o tempo de quem esta' a olhar para a tela, so' depois a mao.
      await respirarAntesDoClique();
      if (parar) return;
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
     * A reserva existe por uma medicao desta mesma sessao: a sequencia completa de ponteiro nos
     * botoes da **barra de cima** impedia o inventario de abrir — a barra reage a mais de um dos
     * eventos e abria e fechava na mesma rajada. Onde o clique humano nao funcionar, o simples
     * funciona, e e' melhor uma segunda tentativa do que uma ferramenta que para por elegancia.
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

    /** Fecha qualquer menu da barra de cima: um menu aberto faz o jogo recusar abrir janelas. */
    const fecharMenus = async () => {
      for (let volta = 0; volta < 4; volta += 1) {
        const gatilho = document.querySelector('.pokeidle-top-toolbar__btn[aria-expanded="true"]');
        if (!gatilho) return true;
        gatilho.click();
        await espera(250);
      }
      return !document.querySelector('.pokeidle-top-toolbar__btn[aria-expanded="true"]');
    };

    /** Os botoes de fechar dos aneuncios que o jogo poe por cima de tudo. */
    const FECHOS = ['.pokeidle-promo-banner__close', '.expedition-alert-banner__dismiss'];

    /**
     * Ha' alguma coisa grande por cima do jogo?
     *
     * Rede para o que nao esta' na lista acima: qualquer caixa que cubra boa parte da tela com
     * `z-index` de modal. As janelas do jogo e os paineis deste pacote ficam de fora — sao
     * legitimas, e o painel do ginasio seria o primeiro falso positivo.
     */
    const haSobreposto = () =>
      [...document.querySelectorAll('div, section, aside, dialog')].some((e) => {
        if (e.closest('.pokeidle-panel') || e.id.startsWith('lioncode-')) return false;
        const caixa = e.getBoundingClientRect();
        if (caixa.width < innerWidth * 0.4 || caixa.height < innerHeight * 0.4) return false;
        return Number(getComputedStyle(e).zIndex || 0) >= 10000;
      });

    const fecharBanners = async () => {
      let quantos = 0;
      for (let volta = 0; volta < 5; volta += 1) {
        const botao = FECHOS.map((s) => document.querySelector(s)).find(visivel);
        if (!botao) break;
        clicar(botao);
        quantos += 1;
        await espera(Math.round(sorteio(400, 900)));
      }
      return quantos;
    };

    /**
     * Espera a tela ficar sem aneuncios por cima, fechando os que forem aparecendo.
     *
     * **Este e' o conserto do "nao consegui abrir a janela do ginasio".** O seletor de fechar
     * sempre esteve certo; o problema era o momento. O aneuncio do Discord nasce alguns segundos
     * **depois** da recarga, e a ferramenta fechava os banners antes de ele existir — encontrava a
     * tela limpa, seguia em frente, e o aneuncio aparecia mesmo a tempo de o jogo recusar abrir a
     * janela. Fechar uma vez nao basta: e' preciso insistir ate' a tela ficar quieta.
     *
     * "Quieta" sao tres voltas seguidas sem nada a fechar e sem nada grande por cima.
     */
    const esperarTelaLimpa = async (prazo = 15000, avisar) => {
      const fim = Date.now() + prazo;
      let quieto = 0;
      while (Date.now() < fim) {
        const fechou = await fecharBanners();
        if (!fechou && !haSobreposto()) {
          quieto += 1;
          if (quieto >= 3) return true;
        } else {
          quieto = 0;
          if (avisar) avisar('Fechando os anúncios do jogo…');
        }
        await espera(600);
      }
      return !haSobreposto();
    };

    /**
     * A cacada em curso: nome, regiao e modo.
     *
     * E' o que permite devolver o jogador exactamente a' cacada de onde saiu. Nao ha' identificador
     * no DOM — nem na cacada activa nem nas linhas da lista —, entao a identificacao e' pelo nome
     * visivel, que e' o mesmo texto nos dois lados ("Caca de Ralts").
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
     * Guarda a cacada que esta' a correr, sempre que houver uma.
     *
     * Serve ao botão "Voltar para a caçada" fora de uma corrida: sem isto ele so' saberia voltar
     * durante uma tarefa, que e' justamente quando nao faz falta. O nome da cacada so' existe no
     * DOM enquanto ela corre — depois de sair, nao ha' de onde o tirar.
     */
    const lembrarCacada = () => {
      const agora = cacadaAtiva();
      if (agora?.nome) gravar(CHAVE_ULTIMA, agora);
      return agora;
    };

    /** O botao de sair da cacada, quando ele estiver na tela. */
    const botaoVoltarACidade = () =>
      [...document.querySelectorAll('.pokeidle-map-action-bar__button')].find(
        (b) => visivel(b) && /VOLTAR .{1,2} CIDADE/i.test((b.textContent || '').trim()),
      );

    /** Abre a janela do Desafio dos Gyms pelo NPC do mapa. Nao e' preciso andar ate' ele. */
    const abrirOGinasio = async () => {
      const ja = janelaPorTitulo(/DESAFIO DOS GYMS/i);
      if (ja) return ja;
      const npc = [...document.querySelectorAll('.pokeidle-npc-label')].find(
        (l) => (l.querySelector('b')?.textContent || '').trim() === 'GYM',
      );
      if (!npc) return null;
      return clicarEEsperar(
        npc.querySelector('span') || npc,
        () => janelaPorTitulo(/DESAFIO DOS GYMS/i),
        8000,
      );
    };

    /** Poe a janela na regiao pedida. As abas sao botoes de texto, e a activa tem `is-active`. */
    const escolherRegiao = async (janela, regiao) => {
      const aba = [...janela.querySelectorAll('button')].find(
        (b) => (b.textContent || '').trim().toUpperCase() === regiao.toUpperCase(),
      );
      if (!aba) return false;
      if (!aba.className.includes('is-active')) {
        await clicarEEsperar(aba, () => aba.className.includes('is-active'), 4000);
        await espera(Math.round(sorteio(600, 1400)));
      }
      return true;
    };

    /**
     * Abre a janela do ginasio ja' na aba da regiao pedida, com a segunda tentativa que a
     * experiencia obrigou a ter.
     *
     * Duas etapas precisam exactamente disto — a que vai ver qual e' o ginasio de hoje e a que
     * desafia. Escrever o mesmo duas vezes seria ter dois caminhos a envelhecer em separado, e
     * foi esse o erro que a propria ferramenta evita em `comecar`.
     */
    const abrirNaRegiao = async (regiao) => {
      // A tela limpa e os menus fechados sao garantia **de quem abre**. Deixa-los a cargo de cada
      // chamador faz com que um chamador esquecido seja um defeito que so' aparece com anuncio na
      // tela — e o jogo recusa abrir janelas com um menu da barra aberto.
      await esperarTelaLimpa(8000, (t) => dizer(t));
      await fecharMenus();
      let janela = await abrirOGinasio();
      if (!janela) {
        // Segunda tentativa: se um aneuncio apareceu entre a limpeza e o clique, a janela nao
        // abriu por causa dele, e nao porque o NPC sumiu.
        await esperarTelaLimpa(8000, (t) => dizer(t));
        await fecharMenus();
        janela = await abrirOGinasio();
      }
      if (!janela)
        return {
          erro: haSobreposto()
            ? 'há um anúncio do jogo por cima que não consegui fechar'
            : 'não consegui abrir a janela do ginásio',
        };
      if (!(await escolherRegiao(janela, regiao)))
        return { erro: `a janela do ginásio não tem a aba ${regiao}` };
      return { janela };
    };

    const hotspots = (janela) =>
      [...janela.querySelectorAll('.gym-hotspot')].filter(
        (h) => !h.className.includes('gym-hotspot--league'),
      );

    /**
     * O ginasio marcado HOJE — **esperando por ele**.
     *
     * A janela entra no DOM antes do conteudo dela. Esta e' a terceira vez que esta licao aparece
     * neste pacote: a loja do Mark desenha as abas ~285 ms depois da janela, o inventario pinta a
     * grade em etapas, e aqui o mapa do desafio e' uma imagem grande com os ginasios por cima.
     * Procurar uma unica vez, no instante em que a janela existe, da' "nao ha' ginasio marcado
     * HOJE" com o HOJE bem visivel na tela — foi o que o utilizador relatou, com captura.
     *
     * Aceita as duas marcas: a classe `is-active` e o texto `HOJE` do rotulo. Sao a mesma coisa no
     * jogo, mas custa pouco nao depender de uma so'.
     *
     * A Elite Four e' um hotspot como os outros, distinguida pela classe `gym-hotspot--league`, e
     * fica **de fora** por pedido explicito.
     */
    const ginasioDeHoje = (janela) =>
      ate(
        () =>
          hotspots(janela).find(
            (h) => h.className.includes('is-active') || /^HOJE/i.test((h.textContent || '').trim()),
          ),
        12000,
      );

    /**
     * **Ha' dois cinemas, e nao um.** Medido no jogo, com a captura do DOM durante uma corrida:
     *
     *   1. antes da luta: titulo "Desafio de ginásio", botao `.regional-cinema__skip` =
     *      "Entrar na arena";
     *   2. depois dela: titulo "Vitória!" ou "Derrota!", com o botao de confirmar.
     *
     * Os dois usam as **mesmas classes**. Tomar o primeiro pelo segundo era a raiz do defeito que
     * passou tres versoes por consertar: a ferramenta via o titulo da entrada, concluia que a
     * partida tinha acabado, marcava **derrota** (porque "Desafio de ginásio" nao casa com
     * "vitória") e ia montar o time de volta — enquanto a luta ainda nem tinha comecado. A tela
     * de vitória chegava depois, sem ninguem para a confirmar.
     *
     * Por isso o resultado e' reconhecido pelo **texto**, e nao pela presenca do elemento.
     */
    const RESULTADO = /(vit[óo]ria|derrota|empate)/i;
    const cinema = () => document.querySelector('.regional-cinema__title');
    const textoDoCinema = () => (cinema()?.textContent || '').trim();
    const tituloDoResultado = () => (RESULTADO.test(textoDoCinema()) ? cinema() : null);
    /** O cinema de entrada: ha' um cinema na tela, e ele ainda nao e' o do resultado. */
    const noCinemaDeEntrada = () => Boolean(cinema()) && !RESULTADO.test(textoDoCinema());
    const combateEmCurso = () => Boolean(document.querySelector('.pvp-battle-clock'));
    const relogioDoCombate = () =>
      document.querySelector('.pvp-battle-clock')?.textContent?.trim() || '';

    /**
     * Espera o combate acabar e devolve o que aconteceu.
     *
     * Quem decide **nao** e' o cronometro: ele marcava 15 min num combate que durou 67 s. Quem
     * decide e' o titulo do resumo, que ja' traz "Vitoria!" ou "Derrota!" — uma espera so', que
     * entrega a resposta junto com o fim.
     *
     * Os dois casos tristes importam tanto quanto o feliz: o combate sumir sem resumo (uma queda,
     * um F5 dado a' mao) nao pode deixar a ferramenta presa para sempre, e por isso ha' tambem um
     * teto de tempo.
     */
    /**
     * O cinema de entrada pede um clique para a luta comecar: "Entrar na arena".
     *
     * Se ele nao aparecer, nao e' erro — pode haver desafio que va' direto para a arena. O que
     * nao pode e' tratar este botao como se fosse o de confirmar o resultado.
     */
    const entrarNaArena = async (avisar) => {
      const botao = await ate(() => {
        if (!noCinemaDeEntrada()) return null;
        const b = document.querySelector('.regional-cinema__skip');
        return b && visivel(b) && !b.disabled ? b : null;
      }, 15000);
      if (!botao) return false;
      avisar(`“${textoDoCinema()}” — entrando na arena…`);
      await espera(Math.round(sorteio(1200, 2600)));
      await clicarHumano(botao);
      return true;
    };

    /** Nada na tela — nem cinema, nem cronometro, nem resultado — por tanto tempo e' desistir. */
    const PACIENCIA_SEM_SINAL = 90000;

    const esperarOCombate = async (avisar) => {
      const inicio = Date.now();
      let viuOCombate = false;
      let semSinalDesde = Date.now();
      for (;;) {
        const titulo = tituloDoResultado();
        if (titulo) {
          const texto = (titulo.textContent || '').trim();
          return { acabou: true, venceu: /vit[óo]ria/i.test(texto), texto };
        }
        const lutando = combateEmCurso();
        if (lutando) viuOCombate = true;
        if (lutando || noCinemaDeEntrada()) semSinalDesde = Date.now();
        else if (viuOCombate)
          return { acabou: false, erro: 'o combate saiu da tela sem mostrar o resultado' };
        else if (Date.now() - semSinalDesde >= PACIENCIA_SEM_SINAL)
          return { acabou: false, erro: 'a arena não abriu depois do desafio' };
        if (Date.now() - inicio >= TETO_DO_COMBATE)
          return {
            acabou: false,
            erro: `o combate passou de ${Math.round(TETO_DO_COMBATE / 60000)} min sem acabar`,
          };
        avisar(lutando ? `Lutando… ${relogioDoCombate()}` : 'Esperando a arena…');
        await espera(1000);
      }
    };

    /**
     * Um controlo esta' mesmo clicavel? Nao basta estar na tela.
     *
     * **Esta e' a parte que faltava.** O `Continuar` do resumo nasce desligado enquanto o jogo
     * confirma o resultado — e' o que diz a propria tela, mesmo por cima dele: "Resultado e
     * recompensas confirmados". Clicar nele nesse intervalo nao faz nada, e a ferramenta ia-se
     * embora convencida de que tinha clicado.
     */
    const clicavel = (el) => {
      if (!visivel(el)) return false;
      if (el.disabled) return false;
      if (el.getAttribute('aria-disabled') === 'true') return false;
      if (el.className.includes('is-disabled') || el.className.includes('is-loading')) return false;
      const estilo = getComputedStyle(el);
      return estilo.pointerEvents !== 'none' && estilo.visibility !== 'hidden';
    };

    /** Tudo o que se parece com o botao de confirmar o resumo, clicavel ou nao. */
    const candidatosDoResumo = () => {
      const porClasse = [...document.querySelectorAll('.regional-cinema__skip')];
      const porTexto = [...document.querySelectorAll('button, [role="button"], a')].filter((e) =>
        /^(continuar|confirmar|ok|fechar)$/i.test((e.textContent || '').trim()),
      );
      return [...new Set([...porClasse, ...porTexto])].filter(visivel);
    };

    const botaoDoResumo = () => candidatosDoResumo().find(clicavel) || null;

    /**
     * Fecha o resumo do combate — **esperando o botao nascer**.
     *
     * O titulo "Vitória!" entra na tela antes do resto do resumo: as caixas de duração, insígnia
     * e drops ainda estao a ser desenhadas, e o botão Continuar e' o ultimo a chegar. Procurar uma
     * unica vez, no instante em que o titulo aparece, nao encontrava nada — e a ferramenta seguia
     * para a troca de times com o resumo aberto por cima. Relatado com captura, e e' a **quarta**
     * vez que esta mesma licao aparece no pacote.
     *
     * Antes de clicar ha' uma pausa de gente a ler o que ganhou: ninguem confirma um resumo no
     * instante em que ele acaba de aparecer.
     */
    const continuarDoResumo = async (avisar) => {
      if (avisar) avisar('Lendo o resumo da partida…');
      // Espera **ligar**, nao so' aparecer. Trinta segundos porque o que se espera aqui nao e' o
      // desenho da tela, e' a confirmacao do resultado do outro lado.
      const botao = await ate(botaoDoResumo, 30000);
      if (!botao) return { ok: false, visto: candidatosDoResumo() };

      // Ninguem confirma um resumo no instante em que ele fica clicavel.
      await dormir(Math.round(sorteio(3000, 7000)), avisar);
      if (parar) return { ok: false, visto: [] };

      // Ate' quatro tentativas: o botao pode voltar a desligar-se entre o olhar e a mao, e um
      // clique a mais num botao de fechar nao estraga nada — a tela ja' nao existe depois do
      // primeiro que pegar.
      for (let volta = 0; volta < 4; volta += 1) {
        const agora = botaoDoResumo();
        if (!agora) return { ok: !tituloDoResultado(), visto: candidatosDoResumo() };
        if (avisar && volta) avisar(`Confirmando o resumo… (${volta + 1}ª)`);
        await clicarHumano(agora);
        if (await ate(() => !tituloDoResultado(), 4000)) return { ok: true };
        agora.click(); // a reserva de sempre, para onde o ponteiro completo nao serve
        if (await ate(() => !tituloDoResultado(), 3000)) return { ok: true };
        await espera(Math.round(sorteio(1500, 3000)));
      }
      return { ok: false, visto: candidatosDoResumo() };
    };

    /**
     * Devolve o jogador a' cacada guardada.
     *
     * A janela das cacadas reabre na ultima regiao usada — a mesma licao que a loja rapida e o
     * inventario ja' tinham ensinado neste pacote —, entao a regiao e' escolhida de proposito antes
     * de procurar a linha.
     */
    const voltarACacada = async (cacada, avisar) => {
      if (!cacada?.nome) return { ok: false, erro: 'não guardei de qual caçada você saiu' };
      await esperarTelaLimpa(10000, avisar);
      // A barra de cima leva `click()` cru — a sequencia completa de ponteiro abre e fecha o menu
      // na mesma rajada —, entao a pausa de gente tem de ser pedida a' mao aqui.
      await respirarAntesDoClique(avisar);
      if (parar) return { ok: false, erro: 'parado a pedido' };
      avisar('Abrindo as caçadas…');
      document.querySelector('.pokeidle-top-toolbar__btn[data-menu-id="hunts"]')?.click();
      const janela = await ate(() => janelaPorTitulo(/CA[ÇC]ADAS/i), 8000);
      if (!janela) return { ok: false, erro: 'não consegui abrir a janela das caçadas' };
      await espera(1200);

      if (cacada.regiao) {
        const aba = [...janela.querySelectorAll('.hunt-list-world-tab')].find(
          (b) => (b.textContent || '').trim().toLowerCase() === cacada.regiao.toLowerCase(),
        );
        if (aba && !aba.className.includes('is-active')) {
          await clicarEEsperar(aba, () => aba.className.includes('is-active'), 4000);
          await espera(Math.round(sorteio(800, 1800)));
        }
      }

      const linha = [...janela.querySelectorAll('.hunt-list-row')].find((l) =>
        (l.innerText || '').includes(cacada.nome),
      );
      if (!linha) {
        await fecharJanela(janela);
        return {
          ok: false,
          erro: `não achei "${cacada.nome}" na lista de ${cacada.regiao || 'caçadas'}`,
        };
      }
      const botao = [...linha.querySelectorAll('button')].find((b) =>
        /^Caçar$/i.test((b.textContent || '').trim()),
      );
      if (!botao) {
        await fecharJanela(janela);
        return { ok: false, erro: `a linha de "${cacada.nome}" não tem o botão Caçar` };
      }
      if (!(await clicarEEsperar(botao, () => naCacada(), 10000)))
        return { ok: false, erro: 'cliquei em Caçar e a caçada não começou' };
      return { ok: true };
    };

    // ------------------------------------------------------- a tarefa em curso
    //
    // Guardada no armazenamento, e nao numa variavel, porque o passo 4 e' um F5: a recarga leva
    // consigo tudo o que estiver so' na memoria. Cada etapa e' escrita **antes** de ser executada,
    // para que uma recarga no meio volte a tentar aquela etapa em vez de pular para a seguinte.

    const ETAPAS = [
      'sair',
      // Ver **antes** de montar: o time de cada ginasio so' se pode escolher sabendo qual e' o
      // ginasio de hoje, e a janela do ginasio e' a unica que o diz. Esta etapa abre-a, aprende
      // os ginasios da regiao, guarda o de hoje e fecha-a outra vez.
      'ver-ginasio',
      'time-gym',
      'recarregar',
      'desafiar',
      'recarregar-volta',
      'time-volta',
      'voltar',
    ];
    /** As etapas de cada orcamento. O combate fica fora: dura o que durar. */
    const DA_ENTRADA = ['sair', 'ver-ginasio', 'time-gym', 'recarregar', 'desafiar'];
    const DA_SAIDA = ['recarregar-volta', 'time-volta', 'voltar'];
    /**
     * As duas recargas da sequencia, com a razao de cada uma na propria mensagem.
     *
     * A primeira e' tecnica e obrigatoria: sem ela o painel do ginasio continua a ver a equipe
     * antiga (ver o cabecalho deste ficheiro). A segunda e' outra coisa — a pagina chega ao fim do
     * combate depois de um cinema, uma tela de resumo e os banners que nascem por cima, e e' ali
     * que apareciam erros ao montar o time da cacada. Recomecar de uma pagina limpa antes de
     * mexer na equipe custa uns segundos de um orcamento de dois a tres minutos.
     *
     * Quem decide a etapa seguinte e' a ordem em `ETAPAS`, e nao um nome escrito aqui: com duas
     * recargas, um destino cravado em cada uma seria duas oportunidades de o par sair trocado.
     */
    const RECARGAS = {
      recarregar: 'Recarregando — o ginásio só enxerga a equipe nova depois disto…',
      'recarregar-volta': 'Atualizando a página antes de montar o time da caçada…',
    };
    /**
     * Quantos cliques cada etapa ainda vai dar. E' a conta que reparte o orcamento.
     *
     * Nao precisa de ser exacta — serve para espalhar o tempo. As trocas de time valem zero
     * porque quem clica la' e' o Times, com o ritmo de 20–30 s dele.
     */
    const CLIQUES = {
      sair: 1,
      // Abrir a janela, trocar para a aba da regiao e fechar.
      'ver-ginasio': 3,
      // As trocas de time nao clicam nada aqui — quem clica e' o Times, com o ritmo de 20–30 s
      // dele. O 1 e' o tempo **antes** de abrir a mochila: ninguem sai de um combate e abre a
      // mochila no mesmo instante, que foi exactamente a queixa da tela da vitoria.
      'time-gym': 1,
      recarregar: 0,
      desafiar: 4,
      'recarregar-volta': 0,
      'time-volta': 1,
      voltar: 3,
    };
    const cliquesQueFaltam = (fase, etapa) =>
      fase.slice(fase.indexOf(etapa)).reduce((n, e) => n + (CLIQUES[e] || 0), 0);

    const tarefa = () => ler(CHAVE_TAREFA, null);
    const guardarTarefa = (dados) => gravar(CHAVE_TAREFA, dados);
    const limparTarefa = () => apagar(CHAVE_TAREFA);

    /**
     * As escolhas, **uma por regiao**.
     *
     * Kanto e Johto pedem times diferentes — foi o pedido original desta ferramenta. Com um par
     * unico, agendar as duas regioes seria agendar a mesma equipe duas vezes.
     *
     * A forma antiga (um par so', na raiz) e' lida e atribuida a' regiao que estava escolhida na
     * altura: quem ja' usava a ferramenta nao perde o que tinha configurado.
     */
    const PADRAO_REGIAO = { timeGym: '', timeVolta: 'Hunt' };

    const escolhas = () => {
      const bruto = ler(CHAVE_ESCOLHAS, null) || {};
      // Uma regiao guardada que nao exista mais — ou que ainda nao exista — cai no Kanto.
      const regiao = REGIOES.includes(bruto.regiao) ? bruto.regiao : 'KANTO';
      const por = { ...(bruto.porRegiao || {}) };
      if (!bruto.porRegiao && (bruto.timeGym || bruto.timeVolta))
        por[regiao] = { timeGym: bruto.timeGym || '', timeVolta: bruto.timeVolta || 'Hunt' };
      return {
        regiao,
        porRegiao: Object.fromEntries(
          REGIOES.map((r) => [r, { ...PADRAO_REGIAO, ...(por[r] || {}) }]),
        ),
        // O time de cada ginasio, pela id do jogo (`kanto_brock`). Quem nao tiver um aqui usa o
        // da regiao: a escolha fina e' um acrescento, nao uma troca de regime.
        porGinasio: { ...(bruto.porGinasio || {}) },
      };
    };

    const timesDe = (regiao) => escolhas().porRegiao[regiao] || { ...PADRAO_REGIAO };

    // ------------------------------------------------- os ginasios, e o time de cada um
    //
    // O jogo da' a cada ginasio uma id estavel — `kanto_brock`, `johto_chuck`, `hoenn_norman` —
    // no `data-gym-id` do hotspot, com a regiao no prefixo. Medido na janela em 30/10/2026: 21
    // ginasios, sete por regiao, e o `aria-label` traz "Lider · Cidade" (com "HOJE · " a' frente
    // no do dia). E' por essa id que o time de cada ginasio se guarda: pelo nome partia-se no
    // primeiro acento, na primeira traducao e no primeiro "Tate & Liza".
    //
    // O catalogo nao esta' escrito aqui de proposito. Ele e' aprendido do jogo quando a janela
    // esta' aberta — o mesmo caminho das cacadas, que aprendem em que aba moram. Uma lista
    // escrita a mao fica errada no dia em que o jogo acrescentar um ginasio, e fica errada **em
    // silencio**.

    /** O catalogo aprendido: `{ KANTO: [{ id, rotulo }], ... }`. */
    const ginasiosSabidos = () => {
      const bruto = ler(CHAVE_GINASIOS, null) || {};
      return Object.fromEntries(
        REGIOES.map((r) => [r, Array.isArray(bruto[r]) ? bruto[r] : []]),
      );
    };

    /**
     * Guarda os ginasios de uma regiao, lidos da janela aberta.
     *
     * **Le' sempre do documento, e nunca de um no' guardado de antes.** Medido em 30/10/2026: ao
     * trocar de aba o jogo redesenha o mapa inteiro, e um elemento apanhado antes da troca
     * continua a responder — com os ginasios da aba anterior. Foi assim que a primeira medicao
     * deu Hoenn nas tres regioes.
     */
    const aprenderGinasios = (janela, regiao) => {
      if (!REGIOES.includes(regiao)) return [];
      const lista = hotspots(janela)
        .map((h) => ({
          id: h.dataset?.gymId || '',
          rotulo: (h.getAttribute('aria-label') || h.textContent || '')
            .replace(/^\s*HOJE\s*·?\s*/i, '')
            .replace(/\s+/g, ' ')
            .trim(),
        }))
        .filter((g) => g.id);
      // Uma leitura vazia nao apaga o que se sabia: a janela desenha o mapa depois de existir, e
      // apagar aqui seria trocar um catalogo bom por nada.
      if (!lista.length) return ginasiosSabidos()[regiao];
      // So' se grava o que mudou. Isto e' lido de 3 em 3 segundos enquanto a janela estiver a'
      // vista, e gravar sempre seria escrever no armazenamento a cada batida, para sempre, para
      // guardar exactamente o mesmo.
      const sabidos = ginasiosSabidos();
      if (JSON.stringify(sabidos[regiao]) === JSON.stringify(lista)) return lista;
      gravar(CHAVE_GINASIOS, { ...sabidos, [regiao]: lista });
      return lista;
    };

    /**
     * O time para um ginasio: o dele, se tiver; senao o da regiao.
     *
     * A regiao continua a ser a rede. Quem nunca mexer nisto nao ve' diferenca nenhuma.
     */
    const timeDoGinasio = (regiao, id) => {
      const guardado = escolhas();
      const proprio = id ? guardado.porGinasio[id] : '';
      return proprio || (guardado.porRegiao[regiao] || PADRAO_REGIAO).timeGym || '';
    };

    /** Ha' com que trabalhar nesta regiao? O da regiao, ou o de algum ginasio dela. */
    const temAlgumTime = (regiao) => {
      const guardado = escolhas();
      if ((guardado.porRegiao[regiao] || PADRAO_REGIAO).timeGym) return true;
      const prefixo = `${regiao.toLowerCase()}_`;
      return Object.entries(guardado.porGinasio).some(
        ([id, time]) => time && id.startsWith(prefixo),
      );
    };

    // ------------------------------------------------------------- a agenda
    //
    // O formato e a logica sao os da venda e da loja rapidas, de proposito: "08:00-09:00", uma
    // janela por virgula, instante sorteado dentro da janela e **uma rodada por janela**. Foi o
    // pedido — "igual ao do de vendas e compras" — e e' codigo ja' usado, nao um desenho novo.

    const agenda = () => {
      const bruto = ler(CHAVE_AGENDA, null) || {};
      // O `reset` viaja junto: `guardarAgenda(agenda())` e' o caminho de toda a gravacao, e um
      // campo que nao estivesse aqui seria apagado na primeira mudanca de horario.
      return Object.assign(
        { reset: String(bruto.reset ?? '00:00') },
        Object.fromEntries(
          REGIOES.map((r) => [
            r,
            {
              ligado: bruto[r]?.ligado === true,
              horarios: String(bruto[r]?.horarios ?? ''),
              // Vazio quer dizer todo dia — e' como esta agenda sempre se comportou, e e' o que o
              // ginasio do dia pede na maioria das vezes.
              dias: String(bruto[r]?.dias ?? ''),
              ultima: Number(bruto[r]?.ultima) || 0,
            },
          ]),
        ),
      );
    };

    const guardarAgenda = (nova) => gravar(CHAVE_AGENDA, nova);

    /**
     * Quanto falta ate' o instante sorteado da proxima ocorrencia — ou `null` se nao ha' nenhuma.
     *
     * A conta inteira mora em `agenda.js`, partilhada com a venda e com a compra: as tres tinham
     * esta mesma logica copiada linha por linha, e acrescentar "toda semana" e "todo mes" em tres
     * copias seria acrescentar o mesmo defeito em tres lugares. Ver o cabecalho de `agenda.js`.
     *
     * Sem o calendario — alguem com uma mistura de versoes do pacote —, a agenda simplesmente nao
     * marca nada, em vez de marcar errado.
     */
    const calendario = () => globalThis.PPX?.agenda || null;
    const esperaDaJanela = (horarios, dias, ultima, agora = new Date()) =>
      calendario()?.esperaDaAgenda({ horarios, dias }, ultima, agora) ?? null;

    // -------------------------------------------------------------- o placar
    //
    // Um sinal por regiao: verde ganhou, vermelho perdeu, laranja deu erro, cinza ainda nao foi
    // feito hoje. Nao e' enfeite — com o ginasio a correr sozinho, e' a unica forma de saber o
    // que aconteceu enquanto voce nao estava olhando.

    const CORES = {
      vitoria: ['#3fb950', 'Vitória'],
      derrota: ['#f85149', 'Derrota'],
      erro: ['#d29922', 'Deu erro'],
      vazio: ['#424a57', 'Ainda não foi feito hoje'],
    };

    /**
     * O "dia" do placar, contado a partir da hora em que o servidor reseta.
     *
     * **Nao sei a que horas o PokePixel reseta o ginásio do dia**, e inventar um numero seria pior
     * do que perguntar: o sinal ficaria verde depois do reset, ou cinza antes dele. Por isso a
     * hora e' um campo, com meia-noite local por padrao. Mudar o campo acerta tudo sem publicar
     * versao nova.
     */
    const horaDoReset = () => {
      const casa = /^\s*(\d{1,2}):?(\d{2})?\s*$/.exec(
        String((ler(CHAVE_AGENDA, null) || {}).reset ?? '00:00'),
      );
      if (!casa) return 0;
      return (Number(casa[1]) % 24) * 60 + (Number(casa[2] ?? 0) % 60);
    };

    const diaDoServidor = (quando = Date.now()) => {
      const d = new Date(quando);
      d.setMinutes(d.getMinutes() - horaDoReset());
      return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    };

    const placar = () => ler(CHAVE_PLACAR, {}) || {};

    /** Como esta' hoje a regiao: o resultado de ontem nao conta, porque o ginásio reseta. */
    const estadoDe = (regiao) => {
      const linha = placar()[regiao];
      if (!linha || linha.dia !== diaDoServidor()) return { estado: 'vazio' };
      // Um estado em branco e' o que `marcarAMao` deixa quando se roda ate' "ainda nao foi feito":
      // guarda-se a linha, para a marca de ontem nao voltar, mas ela conta como vazia.
      return linha.estado ? linha : { ...linha, estado: 'vazio' };
    };

    /**
     * A ordem em que o clique do dono roda as marcas do placar.
     *
     * **"Deu erro" nao entra na roda**: ninguem quer marcar um erro a mao — quem marca um erro e'
     * a corrida que falhou. Partindo de um erro, o clique seguinte e' "Vitória", que e' o caso que
     * o dono descreveu: deu erro, ele foi ver, e o ginasio ja' estava ganho.
     */
    const VOLTA = ['vazio', 'vitoria', 'derrota'];

    /**
     * Marca a mao o que aconteceu num ginasio hoje.
     *
     * O placar e' memoria, e nao mandante: nada aqui faz o ginasio correr nem deixar de correr —
     * a agenda e' que manda nisso. O que se corrige e' o que o painel **diz**, que depois de um
     * erro, ou de uma vitoria ganha com as proprias maos, estava a mentir. Pedido do dono em
     * 12/10/2026: "as vezes da erro e eu vou manualmente e vejo que ja ganhou".
     *
     * O texto fica a dizer que foi a mao, para ninguem mais tarde ler aquilo como medida.
     */
    const marcarAMao = (regiao) => {
      const agora = estadoDe(regiao).estado || 'vazio';
      const i = VOLTA.indexOf(agora);
      const proximo = VOLTA[(i + 1) % VOLTA.length];
      anotarPlacar(
        regiao,
        proximo === 'vazio' ? '' : proximo,
        proximo === 'vazio' ? '' : 'marcado à mão',
      );
      dizer(
        proximo === 'vazio'
          ? `${regiao}: marquei como ainda não feito hoje.`
          : `${regiao}: marquei ${CORES[proximo][1].toLowerCase()} à mão.`,
      );
    };

    const anotarPlacar = (regiao, estado, texto) => {
      const todos = placar();
      todos[regiao] = { dia: diaDoServidor(), estado, texto: texto || '', quando: Date.now() };
      gravar(CHAVE_PLACAR, todos);
      pintarPlacar();
    };

    // A Elite 4 fica fora da automação de ginásios. Estes dois estados são somente uma memória
    // diária que o dono corrige à mão; não iniciam luta, não alteram agenda e respeitam o mesmo
    // horário de reset usado pelo placar.
    const elite4 = () => ler(CHAVE_ELITE4, {}) || {};
    const elite4Feita = (regiao) => elite4()[regiao]?.dia === diaDoServidor();
    const marcarElite4 = (regiao) => {
      const todos = elite4();
      const feita = !elite4Feita(regiao);
      if (feita) todos[regiao] = { dia: diaDoServidor(), quando: Date.now() };
      else delete todos[regiao];
      gravar(CHAVE_ELITE4, todos);
      pintarElite4();
      pintarResumo();
      dizer(`Elite 4 de ${nomeDe(regiao)}: ${feita ? 'marcada como feita' : 'marcada como não feita'}.`);
    };

    // ------------------------------------------------------------------ painel

    const painel = document.createElement('div');
    painel.id = 'lioncode-gym';
    painel.innerHTML = `
      <header>
        <strong data-titulo>Ginásio do dia</strong>
        <button type="button" data-recarregar title="Atualizar a lista de times">↻</button>
        <button type="button" data-minimizar title="Minimizar">–</button>
        <button type="button" data-fechar title="Esconder (Alt+G)">×</button>
      </header>
      <div class="resumo" data-resumo></div>
      <div class="corpo">
        <label>Região
          <select data-regiao>
            ${REGIOES.map((r) => `<option value="${r}">${nomeDe(r)}</option>`).join('')}
          </select>
        </label>
        <label>Time do ginásio
          <select data-time-gym></select>
        </label>
        <details class="porginasio">
          <summary>Time por ginásio <span data-conta-ginasios></span></summary>
          <div data-ginasios></div>
        </details>
        <label>Voltar com
          <select data-time-volta></select>
        </label>
        <button type="button" class="ir" data-ir>Fazer o ginásio de hoje</button>
        <button type="button" class="volta" data-voltar>Voltar para a caçada</button>
        <div class="elite4">
          <span>Elite 4 feita hoje</span>
          <div>
            ${REGIOES.map(
              (r) => `<button type="button" data-elite4="${r}">○ ${nomeDe(r)}</button>`,
            ).join('')}
          </div>
        </div>
        <div class="agenda">
          ${REGIOES.map(
            (r, i) => `
          <div class="linha">
            <span class="sinal" data-sinal="${r}" data-marcar="${r}"></span>
            <label class="liga"><input type="checkbox" data-auto="${r}"> ${nomeDe(r)}</label>
            <input type="text" data-horas="${r}" placeholder="${EXEMPLOS[i] || '12:00-13:00'}"
              title="Uma janela por vírgula. Dentro de cada uma ele age uma única vez.">
            <span data-agenda="${r}"></span>
            <button type="button" class="ja" data-ir-regiao="${r}"
              title="Fazer o ginásio de ${nomeDe(r)} agora">▶</button>
          </div>`,
          ).join('')}
          <div class="linha reset">
            <span>servidor reseta às</span>
            <input type="text" data-reset placeholder="00:00"
              title="A hora em que o ginásio do dia reseta. É por ela que os sinais voltam a cinza.">
          </div>
          <p class="proxima" data-proxima></p>
        </div>
        <p class="estado" data-estado></p>
        <button type="button" class="parar" data-parar hidden>Parar</button>
      </div>`;

    const estilo = document.createElement('style');
    estilo.textContent = `
      #lioncode-gym, #lioncode-gym * { box-sizing: border-box; }
      #lioncode-gym {
        position: fixed; z-index: 2147483000; width: 240px;
        background: var(--ppx-fundo); color: var(--ppx-texto);
        border: 1px solid var(--ppx-borda); border-radius: var(--ppx-raio);
        font: var(--ppx-fonte); box-shadow: var(--ppx-sombra);
        /* O painel nao pode passar da tela. Com tres regioes, a agenda aberta e os ginasios a'
           vista ele mediu 1185 px numa tela de 785: o fim ficava inalcancavel, e com ele o campo
           do reset e o botao de parar. Coluna para o cabecalho ficar preso e so' o corpo rolar —
           quem rolasse o painel inteiro perdia de vista o botao de fechar. */
        display: flex; flex-direction: column; max-height: var(--ppx-teto);
      }
      /* O cabecalho nao encolhe: numa caixa flex ele cederia altura antes de o corpo rolar. */
      #lioncode-gym > header { flex: 0 0 auto; }
      #lioncode-gym .corpo { overflow-y: auto; overscroll-behavior: contain;
        scrollbar-width: thin; scrollbar-color: var(--ppx-borda) transparent; }
      /* ESTA REGRA TEM DE EXISTIR, e com o id. O painel poe uma regra de label com id, e isso
         GANHA a' regra label[hidden] da agenda partilhada, que so' tem classes — o painel
         desfazia o esconder do componente. Medido em 30/10/2026: com "repetir: todo dia", as duas
         listas de dias estavam marcadas hidden e mediam 147 e 164 px, a' vista. Nenhum outro
         painel do pacote tem uma regra de label tao larga, por isso o defeito era so' deste. */
      #lioncode-gym [hidden] { display: none; }
      #lioncode-gym header {
        display: flex; align-items: center; gap: 8px; padding: 8px 10px;
        border-bottom: 1px solid #2a3244; cursor: move;
      }
      #lioncode-gym header strong { flex: 1; font-size: 13px; }
      #lioncode-gym header button {
        background: none; border: 0; color: #8b97a8; font-size: 16px; cursor: pointer; padding: 0 2px;
      }
      #lioncode-gym .corpo { display: flex; flex-direction: column; gap: 8px; padding: 10px; }
      #lioncode-gym label { display: flex; flex-direction: column; gap: 3px; color: #9aa6b8; font-size: 12px; }
      #lioncode-gym select {
        background: #1a2130; color: #e7edf6; border: 1px solid #2a3244; border-radius: 6px;
        padding: 5px 6px; font: inherit;
      }
      #lioncode-gym button.ir, #lioncode-gym button.parar, #lioncode-gym button.volta {
        background: #1f2a3d; color: #e7edf6; border: 1px solid #33405a; border-radius: 6px;
        padding: 7px; font: inherit; cursor: pointer;
      }
      #lioncode-gym button.ir:hover, #lioncode-gym button.volta:hover { background: #26344c; }
      #lioncode-gym button.volta { border-color: #2a3244; color: #9aa6b8; }
      #lioncode-gym .porginasio { font-size: 12px; color: #9aa6b8; }
      #lioncode-gym .porginasio > summary { cursor: pointer; padding: 4px 0; }
      /* A direccao TEM DE ESTAR ESCRITA: estas linhas sao label, e o painel ja' poe
         label { flex-direction: column }. Sem a declaracao, a linha empilha o nome por cima da
         lista e o flex-basis passa a valer como ALTURA — cada ginasio virava um quadro de 96 px
         de alto, sete deles a encher a tela. (Sem crases neste comentario: o CSS vive dentro de
         um template literal, e uma crase aqui fecha a string a meio.) */
      #lioncode-gym .porginasio .ginasio { display: flex; flex-direction: row;
        align-items: center; gap: 6px; padding: 1px 0; }
      #lioncode-gym .porginasio .ginasio > span { flex: 1 1 auto; min-width: 0; overflow: hidden;
        text-overflow: ellipsis; white-space: nowrap; }
      #lioncode-gym .porginasio .ginasio select { flex: 0 0 108px; width: 108px; min-width: 0;
        padding: 3px 4px; font-size: 11px; }
      #lioncode-gym .porginasio .vazio { margin: 4px 0; opacity: .8; }
      #lioncode-gym .elite4 { display: grid; gap: 5px; padding: 7px 0;
        border-top: 1px solid #202835; border-bottom: 1px solid #202835; color: #9aa6b8;
        font-size: 12px; }
      #lioncode-gym .elite4 > div { display: flex; gap: 6px; }
      #lioncode-gym .elite4 button { flex: 1; background: #1a2130; color: #9aa6b8;
        border: 1px solid #2a3244; border-radius: 6px; padding: 5px; font: inherit; cursor: pointer; }
      #lioncode-gym .elite4 button.feita { background: #173522; border-color: #327343;
        color: #7ddba0; font-weight: 600; }
      #lioncode-gym button:disabled { opacity: .5; cursor: default; }
      #lioncode-gym .agenda { display: flex; flex-direction: column; gap: 5px;
        border-top: 1px solid #202835; padding-top: 7px; }
      #lioncode-gym .agenda .linha { display: flex; align-items: center; gap: 6px; }
      #lioncode-gym .agenda .liga { flex-direction: row; align-items: center; gap: 4px;
        color: #e7edf6; font-size: 12px; white-space: nowrap; }
      #lioncode-gym .agenda input[type="text"] {
        flex: 1; min-width: 0; background: #0d1219; color: #e7edf6; border: 1px solid #2a3244;
        border-radius: 5px; padding: 3px 5px; font: inherit; font-size: 12px;
      }
      /* Campo que o calendario nao entendeu: marcado, porque aceitar em silencio deixaria a
         agenda ligada sem nenhum dia marcado. */
      #lioncode-gym .agenda input.erro { border-color: #7a3b3b; color: #f3b9b9; }
      /* O editor da agenda ocupa a linha inteira: fechado e' um botao, aberto sao listas. */
      #lioncode-gym .agenda [data-agenda] { flex: 1; min-width: 0; display: flex; }
      #lioncode-gym .agenda [data-agenda] .ppx-ag { flex: 1; min-width: 0; }
      /* O botao de ir de cada regiao: pequeno, porque a linha ja' esta' cheia, e presente nas
         duas casas em que a regiao aparece — na linha da agenda e no resumo minimizado. */
      #lioncode-gym .ja {
        flex: 0 0 auto; background: #1f2a3d; color: #e7edf6; border: 1px solid #33405a;
        border-radius: 5px; padding: 0 6px; font: inherit; font-size: 11px; line-height: 18px;
        cursor: pointer;
      }
      #lioncode-gym .ja:hover:not(:disabled) { background: #26344c; }
      #lioncode-gym .ja:disabled { opacity: .35; cursor: default; }
      #lioncode-gym .agenda .reset { color: #8b97a8; font-size: 12px; }
      #lioncode-gym .agenda .reset input { max-width: 64px; flex: 0 0 auto; }
      #lioncode-gym .agenda .proxima { margin: 0; color: #8b97a8; font-size: 12px; min-height: 1.2em; }
      /* O sinal: um ponto por regiao. Verde ganhou, vermelho perdeu, laranja deu erro, cinza
         ainda nao foi feito hoje. Com o ginasio a correr sozinho, e' o unico jeito de saber o que
         aconteceu enquanto ninguem estava olhando. */
      #lioncode-gym .sinal { width: 10px; height: 10px; border-radius: 50%; flex: 0 0 auto;
        background: #424a57; box-shadow: 0 0 0 1px #0006 inset; }
      /* Um ponto de dez pixels e' pouco para acertar com o rato: a area de clique cresce com uma
         borda transparente, que nao mexe no desenho nem empurra a linha. */
      #lioncode-gym [data-marcar] { cursor: pointer; border: 4px solid transparent;
        background-clip: padding-box; width: 18px; height: 18px; margin: -4px; }
      #lioncode-gym .quando[data-marcar] { width: auto; height: auto; border-radius: 0;
        box-shadow: none; }
      #lioncode-gym .estado { margin: 0; color: #9aa6b8; min-height: 1.4em; }
      #lioncode-gym .estado.ruim { color: #ff9b9b; }
      #lioncode-gym .estado.bom { color: #7ddba0; font-weight: 600; }

      /* Minimizado: a etiqueta GYM, o sinal de cada regiao, como foi hoje e o proximo horario.
         Era so' a etiqueta ate' este pedido, e estava errado: minimizado e' justamente o estado em
         que o ginasio corre sozinho, e abrir o painel inteiro so' para ver se o ponto ja' esta'
         verde desfazia o motivo de o ter minimizado. O resto — as listas, os campos — continua
         escondido, que e' o que tapava o jogo. */
      #lioncode-gym .resumo { display: none; }
      #lioncode-gym.minimizado .resumo {
        display: flex; flex-direction: column; gap: 4px; padding: 0 8px 7px;
        font-size: 12px; color: #9aa6b8;
      }
      #lioncode-gym.minimizado .resumo .linha { display: flex; align-items: center; gap: 6px; }
      #lioncode-gym.minimizado .resumo .linha b { color: #e7edf6; font-weight: 600; }
      #lioncode-gym.minimizado .resumo .linha .quando { margin-left: auto; white-space: nowrap; }
      #lioncode-gym.minimizado .resumo .elite4-resumo { border-top: 1px solid #202835;
        margin-top: 2px; padding-top: 4px; }
      #lioncode-gym.minimizado .resumo .elite4-resumo .elite4-mini { background: none;
        color: #8b97a8; border: 0; padding: 0 2px; font: inherit; cursor: pointer; }
      #lioncode-gym.minimizado .resumo .elite4-resumo .elite4-mini.feita { color: #7ddba0;
        font-weight: 700; }
      #lioncode-gym.minimizado .resumo .proxima { margin: 1px 0 0; color: #8b97a8; }
      /* Largura pelo conteudo, com um minimo: "Vitória 22:24" e' a linha mais comprida que aqui
         aparece, e uma etiqueta que muda de largura a cada resultado saltaria na tela. */
      #lioncode-gym.minimizado { width: auto; min-width: 162px; }
      #lioncode-gym.minimizado .corpo { display: none; }
      #lioncode-gym.minimizado header { border-bottom: 0; padding: 6px 8px; }
      #lioncode-gym.minimizado header strong { font-size: 12px; letter-spacing: .06em; }
      /* Minimizado e' para nao tapar o jogo: o botao de atualizar a lista nao tem sentido sem a
         lista a' vista. */
      #lioncode-gym.minimizado [data-recarregar] { display: none; }
    `;
    painel.append(estilo);
    document.body.append(painel);

    const campo = (seletor) => painel.querySelector(seletor);
    const estado = campo('[data-estado]');

    const dizer = (texto, ruim) => {
      estado.textContent = texto;
      estado.classList.toggle('ruim', !!ruim);
      estado.classList.remove('bom');
    };
    const celebrar = (texto) => {
      dizer(texto);
      estado.classList.add('bom');
    };

    /**
     * Enche as duas listas de times com o que o Times tem guardado.
     *
     * Os nomes vem de `PPX.times`, a porta que o Times abre para as outras ferramentas do pacote.
     * Sem ela — Times desligado, por exemplo — as listas ficam vazias e o botao explica porque.
     */
    const encherTimes = (forcar = false) => {
      const nomes = globalThis.PPX?.times?.nomes?.() || [];
      const guardado = escolhas();
      const daRegiao = guardado.porRegiao[guardado.regiao];
      for (const [seletor, escolhido] of [
        ['[data-time-gym]', daRegiao.timeGym],
        ['[data-time-volta]', daRegiao.timeVolta],
      ]) {
        const lista = campo(seletor);
        // O que esta' na tela vale mais do que o que esta' guardado: encher as listas outra vez
        // nao pode desfazer uma escolha que o utilizador acabou de fazer.
        //
        // Com `forcar`, nao: ao trocar de regiao e' preciso mostrar os times **daquela** regiao,
        // e o que esta' na tela e' justamente o da regiao anterior.
        const naTela = forcar ? '' : lista.value;
        const manter = nomes.includes(naTela) ? naTela : escolhido;
        lista.innerHTML = '';
        if (!nomes.length) {
          const vazio = document.createElement('option');
          vazio.value = '';
          vazio.textContent = '— nenhum time guardado —';
          lista.append(vazio);
          continue;
        }
        for (const nome of nomes) {
          const opcao = document.createElement('option');
          opcao.value = nome;
          opcao.textContent = nome;
          if (nome === manter) opcao.selected = true;
          lista.append(opcao);
        }
      }
      campo('[data-regiao]').value = guardado.regiao;
      pintarGinasios(nomes);
      return nomes;
    };

    /**
     * Uma linha por ginasio da regiao escolhida, cada uma com o seu time.
     *
     * A primeira opcao de cada lista e' **usar o da regiao**, e e' ela que fica escolhida por
     * omissao: quem nunca mexer aqui continua a ter o comportamento de sempre, e a escolha fina
     * e' um acrescento e nao um regime novo. Por isso o bloco tambem nasce fechado.
     */
    function pintarGinasios(nomesConhecidos) {
      const caixa = campo('[data-ginasios]');
      if (!caixa) return;
      const nomes = nomesConhecidos || globalThis.PPX?.times?.nomes?.() || [];
      const guardado = escolhas();
      const lista = ginasiosSabidos()[guardado.regiao] || [];
      const conta = campo('[data-conta-ginasios]');
      if (conta)
        conta.textContent = lista.length
          ? `(${lista.filter((g) => guardado.porGinasio[g.id]).length}/${lista.length})`
          : '';
      caixa.textContent = '';
      if (!lista.length) {
        const aviso = document.createElement('p');
        aviso.className = 'vazio';
        // Diz-se o que fazer, e nao so' que falta: a lista aprende-se do jogo, e o jogador nao
        // tem como adivinhar que basta abrir a janela.
        aviso.textContent = `Abra o Desafio dos Gyms na aba ${nomeDe(guardado.regiao)} uma vez e os ginásios aparecem aqui.`;
        caixa.append(aviso);
        return;
      }
      for (const ginasio of lista) {
        const linha = document.createElement('label');
        linha.className = 'ginasio';
        const nome = document.createElement('span');
        // So' o lider na linha: o painel tem 240 px e "Lt. Surge · Vermilion" nao cabe ao lado de
        // uma lista. A cidade continua inteira no `title`, que e' onde ha' espaco para ela.
        const rotulo = ginasio.rotulo || ginasio.id;
        nome.textContent = rotulo.split('·')[0].trim() || rotulo;
        linha.title = rotulo;
        const sel = document.createElement('select');
        sel.dataset.ginasio = ginasio.id;
        const padrao = document.createElement('option');
        padrao.value = '';
        padrao.textContent = '— usar o da região —';
        sel.append(padrao);
        for (const n of nomes) {
          const opcao = document.createElement('option');
          opcao.value = n;
          opcao.textContent = n;
          sel.append(opcao);
        }
        // Um time escolhido que ja' nao exista no Times nao pode desaparecer em silencio: fica
        // na lista, marcado, para o dono ver que aquilo deixou de valer.
        const escolhido = guardado.porGinasio[ginasio.id] || '';
        if (escolhido && !nomes.includes(escolhido)) {
          const sumido = document.createElement('option');
          sumido.value = escolhido;
          sumido.textContent = `${escolhido} (não existe mais)`;
          sel.append(sumido);
        }
        sel.value = escolhido;
        linha.append(nome, sel);
        caixa.append(linha);
      }
    }

    /** Grava o time de um ginasio. Vazio quer dizer "usar o da regiao", e por isso apaga-se. */
    const guardarGinasio = (id, time) => {
      const guardado = escolhas();
      const porGinasio = { ...guardado.porGinasio };
      if (time) porGinasio[id] = time;
      else delete porGinasio[id];
      gravar(CHAVE_ESCOLHAS, { ...guardado, porGinasio });
      pintarGinasios();
    };

    /** Grava os times **na regiao que esta' escolhida**, sem tocar na outra. */
    const guardarEscolhas = () => {
      const guardado = escolhas();
      const regiao = campo('[data-regiao]').value;
      gravar(CHAVE_ESCOLHAS, {
        // `porGinasio` tem de vir junto: este objecto e' gravado inteiro por cima do anterior, e
        // sem esta linha mexer no time da regiao apagava os times de todos os ginasios.
        ...guardado,
        regiao,
        porRegiao: {
          ...guardado.porRegiao,
          [regiao]: {
            timeGym: campo('[data-time-gym]').value,
            timeVolta: campo('[data-time-volta]').value,
          },
        },
      });
    };

    for (const seletor of ['[data-time-gym]', '[data-time-volta]'])
      campo(seletor).addEventListener('change', guardarEscolhas);

    // Delegado: as linhas sao refeitas a cada pintura, e um ouvinte por linha morria com ela.
    campo('[data-ginasios]').addEventListener('change', (evento) => {
      const sel = evento.target?.closest?.('[data-ginasio]');
      if (sel) guardarGinasio(sel.dataset.ginasio, sel.value);
    });

    // Trocar de regiao nao e' mudar uma escolha, e' mudar de pagina: grava-se so' a regiao e as
    // listas passam a mostrar os times dela. Gravar aqui como nas outras escreveria os times da
    // regiao anterior por cima dos desta.
    campo('[data-regiao]').addEventListener('change', () => {
      const guardado = escolhas();
      gravar(CHAVE_ESCOLHAS, { ...guardado, regiao: campo('[data-regiao]').value });
      encherTimes(true);
    });

    // ------------------------------------------------- a agenda, na tela

    const horaCurta = (quando) => new Date(quando).toTimeString().slice(0, 5);

    /** O que se sabe de uma regiao hoje: a cor, a palavra, a hora e a frase inteira do title. */
    const legendaDe = (regiao) => {
      const linha = estadoDe(regiao);
      const [cor, rotulo] = CORES[linha.estado] || CORES.vazio;
      const hora = linha.quando ? horaCurta(linha.quando) : '';
      return {
        feito: linha.estado && linha.estado !== 'vazio',
        cor,
        rotulo,
        hora,
        titulo:
          `${regiao}: ${rotulo}${hora ? ` às ${hora}` : ''}` +
          `${linha.texto ? ` — ${linha.texto}` : ''}`,
      };
    };

    const pintarPlacar = () => {
      for (const regiao of REGIOES) {
        const ponto = campo(`[data-sinal="${regiao}"]`);
        if (!ponto) continue;
        const { cor, titulo } = legendaDe(regiao);
        ponto.style.background = cor;
        ponto.title = titulo;
      }
      pintarResumo();
    };

    const pintarElite4 = () => {
      for (const regiao of REGIOES) {
        const botao = campo(`[data-elite4="${regiao}"]`);
        if (!botao) continue;
        const feita = elite4Feita(regiao);
        botao.classList.toggle('feita', feita);
        botao.textContent = `${feita ? '✓' : '○'} ${nomeDe(regiao)}`;
        botao.title = feita ? 'Clique para marcar como não feita' : 'Clique para marcar como feita';
      }
    };

    /**
     * O resumo que o painel minimizado mostra.
     *
     * Mesmo placar, mesmas cores: o que muda e' que aqui a palavra esta' escrita, em vez de viver
     * so' no `title` do ponto. Minimizado ninguem vai parar o mouse em cima de um ponto de dez
     * pixels para descobrir se o ginasio de hoje ja' foi feito.
     */
    /**
     * Ha' uma corrida em andamento?
     *
     * A tarefa guardada conta tanto quanto a variavel: a sequencia do ginasio passa por F5 no
     * meio, e depois de um deles `correndo` e' falso numa pagina onde o ginasio ainda esta' a
     * meio caminho.
     */
    const emCorrida = () => correndo || Boolean(tarefa());

    const pintarResumo = () => {
      const caixa = campo('[data-resumo]');
      if (!caixa) return;
      caixa.textContent = '';
      for (const regiao of REGIOES) {
        const { cor, rotulo, hora, titulo, feito } = legendaDe(regiao);
        const linha = document.createElement('div');
        linha.className = 'linha';
        linha.title = titulo;
        const ponto = document.createElement('span');
        ponto.className = 'sinal';
        ponto.dataset.marcar = regiao;
        ponto.title = 'Clique para corrigir: ainda não feito → Vitória → Derrota';
        ponto.style.background = cor;
        const nome = document.createElement('b');
        nome.textContent = nomeDe(regiao);
        const diz = document.createElement('span');
        diz.className = 'quando';
        // A palavra tambem corrige: e' nela que o dono esta' olhando quando ve' que ela mente.
        diz.dataset.marcar = regiao;
        diz.title = ponto.title;
        // Cinza dispensa palavra: o ponto ja' diz que nao foi feito, e a hora de um ginasio que
        // nao aconteceu nao existe.
        const emAndamento = tarefa()?.regiao === regiao;
        diz.textContent = emAndamento ? 'indo…' : feito ? `${rotulo}${hora ? ` ${hora}` : ''}` : '—';
        // **O botao de ir tambem aqui, e nao so' no painel aberto.** Minimizado e' o estado em que
        // este painel vive: mandar abrir tudo para clicar num botao desfaz o motivo de o ter
        // minimizado — era esse o pedido.
        const ja = document.createElement('button');
        ja.type = 'button';
        ja.className = 'ja';
        ja.dataset.irRegiao = regiao;
        ja.textContent = '\u25b6';
        ja.title = `Fazer o ginásio de ${nome.textContent} agora`;
        ja.disabled = emCorrida();
        linha.append(ponto, nome, diz, ja);
        caixa.append(linha);
      }
      const elite = document.createElement('div');
      elite.className = 'linha elite4-resumo';
      const tituloElite = document.createElement('b');
      tituloElite.textContent = 'Elite 4';
      elite.append(tituloElite);
      for (const regiao of REGIOES) {
        const feita = elite4Feita(regiao);
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = `elite4-mini${feita ? ' feita' : ''}`;
        botao.dataset.elite4 = regiao;
        // A inicial, para caber no painel minimizado. Vem do nome, para nao haver uma terceira
        // lista de regioes a manter.
        botao.textContent = `${nomeDe(regiao)[0].toUpperCase()} ${feita ? '✓' : '○'}`;
        botao.title = `Elite 4 de ${nomeDe(regiao)}: ${feita ? 'feita' : 'não feita'}. Clique para alterar.`;
        elite.append(botao);
      }
      caixa.append(elite);
      const proxima = campo('[data-proxima]')?.textContent || '';
      if (!proxima) return;
      const p = document.createElement('p');
      p.className = 'proxima';
      p.textContent = proxima;
      caixa.append(p);
    };

    /** Os relogios da agenda, um por regiao, e o instante que cada um esta' a marcar. */
    const relogios = {};
    const proximos = {};

    const pintarAgenda = () => {
      const marcados = REGIOES.filter((r) => proximos[r]).sort((a, b) => proximos[a] - proximos[b]);
      if (!marcados.length) {
        // Dizer **o que** falta, e nao so' que falta: com dois campos por regiao, "nenhum horario
        // valido" manda olhar para o campo errado metade das vezes.
        const cal = calendario();
        const quebrada = REGIOES.map((r) => [r, agenda()[r]]).find(([, c]) => {
          if (!c.ligado) return false;
          return !cal || !cal.valida({ modo: 'horarios', horarios: c.horarios, dias: c.dias });
        });
        if (!quebrada) campo('[data-proxima]').textContent = '';
        else {
          const [regiao, c] = quebrada;
          const sobrou = cal?.diasNaoEntendidos(c.dias) || [];
          campo('[data-proxima]').textContent = !cal
            ? 'o calendário não carregou'
            : sobrou.length
              ? `${regiao}: não entendi "${sobrou[0]}" nos dias`
              : `${regiao}: nenhum horário válido`;
        }
        pintarResumo();
        return;
      }
      const primeiro = marcados[0];
      const quando = new Date(proximos[primeiro]);
      const dois = (n) => String(n).padStart(2, '0');
      // **"amanha" deixou de ser verdade.** Com o campo de dias, o proximo ginasio pode ser daqui
      // a tres semanas, e esta linha dizia "amanha" para qualquer coisa que nao fosse hoje. Passada
      // a vespera, a data por extenso e' a unica resposta honesta.
      const meiaNoite = new Date();
      meiaNoite.setHours(0, 0, 0, 0);
      const diasAte = Math.floor((quando - meiaNoite) / 86400000);
      const dia =
        diasAte === 0
          ? 'hoje'
          : diasAte === 1
            ? 'amanhã'
            : `${dois(quando.getDate())}/${dois(quando.getMonth() + 1)}`;
      campo('[data-proxima]').textContent =
        `próximo: ${nomeDe(primeiro)} ${dia} às ` +
        `${dois(quando.getHours())}:${dois(quando.getMinutes())}`;
      pintarResumo();
    };

    /**
     * Reler os times sem recarregar a pagina.
     *
     * As listas sao enchidas uma vez, quando o painel sobe. Um time guardado **depois** disso nao
     * aparecia aqui ate' um F5 — e um F5 e' caro no meio de uma caçada. O botao `↻` no cabecalho
     * volta a perguntar ao Times, e so' isso: nada no jogo é tocado.
     */
    campo('[data-recarregar]').addEventListener('click', () => {
      if (!globalThis.PPX?.times?.nomes) {
        dizer('A ferramenta Times não está ligada — ligue-a no menu (Alt+Q).', true);
        return;
      }
      const antes = [...campo('[data-time-gym]').options].map((o) => o.value).filter(Boolean);
      const nomes = encherTimes();
      guardarEscolhas();
      const novos = nomes.filter((n) => !antes.includes(n));
      if (!nomes.length) dizer('O Times não tem nenhum time guardado ainda.', true);
      else if (novos.length) celebrar(`Lista atualizada: ${novos.join(', ')}.`);
      else dizer(`Lista atualizada — ${nomes.length} times, nenhum novo.`);
    });

    // ------------------------------------------------------------- a sequencia

    let correndo = false;
    let parar = false;
    let agendado = 0;
    /** O relogio que espera a expedicao acabar. Ver `naExpedicao`, no `comecar`. */
    let esperandoExpedicao = 0;

    /**
     * Se o jogador esta' dentro da expedição diaria.
     *
     * **MEDIDO NO JOGO DO DONO EM 13/10/2026, em tres janelas ao mesmo tempo:** a caçada em escada
     * passou a manha a tentar sair da expedição, e o ginasio tinha o mesmo buraco — pior, porque
     * ele nao falha, ele consegue. O primeiro passo dele e' guardar de onde saiu e clicar em
     * "Voltar à cidade": dentro da expedição isso guardaria a **expedição** como caçada de origem
     * e arrastaria o dono para fora dela, que e' desfazer uma escolha que ele pagou com CAPTCHA.
     *
     * Quem responde e' a porta das Caçadas, pelo tipo — a expedição nao tem zona, e comparar nomes
     * de mapa nunca da' igual.
     */
    const naExpedicao = () => globalThis.PPX?.cacadas?.atual?.()?.tipo === 'expedicao';

    /**
     * De quanto em quanto tempo se volta a ver se a expedição acabou.
     *
     * Ela dura duas horas, e o ginasio tem o dia inteiro: cinco minutos sao baratos de esperar e
     * folgados de sobra para nao perder o dia. Mais curto so' encheria o painel de recados.
     */
    const ESPERA_EXPEDICAO = 300000;

    const travarBotoes = (sim) => {
      campo('[data-ir]').disabled = sim;
      campo('[data-voltar]').disabled = sim;
      campo('[data-parar]').hidden = !sim;
      campo('[data-recarregar]').disabled = sim;
      for (const s of ['[data-regiao]', '[data-time-gym]', '[data-time-volta]'])
        campo(s).disabled = sim;
      // Os botoes de ir de cada regiao travam junto: duas corridas ao mesmo tempo nao existe, e um
      // botao que aceita o clique e nao faz nada e' pior do que um botao apagado.
      for (const b of painel.querySelectorAll('[data-ir-regiao]')) b.disabled = sim;
      // O resumo minimizado tem os seus proprios botoes, feitos a cada desenho: e' ele que os
      // apaga, e de passagem troca o resultado de hoje por "indo…".
      pintarResumo();
    };

    /** Troca de time pelo Times, e devolve o que ele respondeu. */
    const trocarTime = async (nome) => {
      if (!nome) return { ok: false, erro: 'nenhum time escolhido' };
      const times = globalThis.PPX?.times;
      if (!times?.usar)
        return { ok: false, erro: 'a ferramenta Times não está ligada — ligue-a no menu (Alt+Q)' };
      return times.usar(nome);
    };

    /**
     * Executa a tarefa guardada, da etapa em que ela estiver.
     *
     * Chamada tanto pelo botao como na carga da pagina: depois do F5 do passo `recarregar` e' esta
     * mesma funcao que retoma, sem saber que houve uma recarga pelo meio.
     */
    // ------------------------------------------------------------- a vez
    //
    // O ginasio e' o vizinho mais pesado do pacote: ele sai da cacada, fecha menus e janelas, troca
    // a equipe inteira e da' **dois F5**. Qualquer venda ou compra a meio caminho morre nessas
    // recargas sem dizer nada. Por isso ele pede a vez antes de sair da cacada, e so' a solta no
    // fim — inclusive atravessando as proprias recargas, porque do outro lado a vez ainda e' dele.
    let soltarVez = null;
    const pegarVez = async () => {
      const vez = globalThis.PPX?.vez;
      if (!vez?.pedir) return true; // nucleo antigo: segue como antes, sem fila
      const dono = vez.dono();
      if (dono && dono.id !== 'gym') dizer(`Esperando o ${vez.nome(dono.id)} terminar…`);
      soltarVez = await vez.pedir('gym');
      return Boolean(soltarVez);
    };
    const largarVez = () => {
      if (!soltarVez) return;
      soltarVez();
      soltarVez = null;
    };

    async function continuarTarefa() {
      if (correndo) return;
      const dados = tarefa();
      if (!dados) return;
      correndo = true;
      parar = false;
      travarBotoes(true);
      // **A vez nao e' solta no `finally` quando a pagina vai recarregar.** Do outro lado do F5 a
      // tarefa continua, e soltar aqui abriria exactamente a fresta que esta fila existe para
      // fechar: a venda entrando entre a recarga e a retomada.
      let recarregando = false;
      try {
        if (!(await pegarVez())) {
          await falhou(dados, 'o jogo ficou ocupado tempo demais');
          return;
        }
        for (;;) {
          if (parar) {
            limparTarefa();
            dizer('Parado. O jogo ficou como estava no último passo.', true);
            return;
          }
          const etapa = dados.etapa;
          if (!ETAPAS.includes(etapa)) {
            limparTarefa();
            return;
          }
          const passo = await executarEtapa(etapa, dados);
          if (passo.recarregou) {
            recarregando = true;
            return; // a pagina vai embora; quem segue e' a carga seguinte
          }
          if (!passo.ok) {
            await falhou(dados, passo.erro);
            return;
          }
          if (passo.fim) {
            limparTarefa();
            // O sinal guarda o que aconteceu: derrota nao e' erro, e as duas coisas tem de ficar
            // distinguiveis depois, quando ninguem estava a olhar.
            anotarPlacar(
              dados.regiao,
              dados.venceu === false ? 'derrota' : 'vitoria',
              dados.resultado || '',
            );
            celebrar(passo.mensagem);
            return;
          }
          const seguinte = ETAPAS[ETAPAS.indexOf(etapa) + 1];
          dados.etapa = seguinte;
          // O orcamento da saida comeca quando se entra nela, e nao no inicio da corrida: entre as
          // duas fases ha' o combate, que dura o que durar e nao se pode descontar de nada.
          if (seguinte === DA_SAIDA[0] && !dados.alvoSaida) {
            dados.alvoSaida = Date.now() + sorteio(CICLO_SAIDA[0], CICLO_SAIDA[1]);
          }
          guardarTarefa(dados);
          // Nao ha' pausa aqui: o tempo esta' todo **entre os cliques**, dentro das etapas.
        }
      } finally {
        if (!recarregando) largarVez();
        fecharRitmo();
        correndo = false;
        travarBotoes(Boolean(tarefa()));
      }
    }

    /** Um passo da sequencia. Devolve `{ok}`, e `{recarregou}` quando a pagina vai ser trocada. */
    async function executarEtapa(etapa, dados) {
      // O orcamento da fase a que esta etapa pertence, repartido pelos cliques que ainda faltam
      // nela. Refeito a cada etapa porque o F5 do meio leva consigo tudo o que estiver na memoria.
      if (DA_ENTRADA.includes(etapa))
        abrirRitmo(dados.alvoPre, cliquesQueFaltam(DA_ENTRADA, etapa));
      else if (DA_SAIDA.includes(etapa))
        abrirRitmo(dados.alvoSaida, cliquesQueFaltam(DA_SAIDA, etapa));
      else fecharRitmo();

      if (etapa === 'sair') {
        if (!naCacada()) return { ok: true }; // ja' estava na cidade
        dizer('Saindo da caçada…');
        const botao = botaoVoltarACidade();
        if (!botao) return { ok: false, erro: 'não achei o botão "Voltar à cidade"' };
        if (!(await clicarEEsperar(botao, () => !naCacada(), 10000)))
          return { ok: false, erro: 'cliquei em "Voltar à cidade" e nada mudou' };
        return { ok: true };
      }

      if (etapa === 'ver-ginasio') {
        await respirarAntesDoClique((t) => dizer(t));
        if (parar) return { ok: true };
        dizer(`Vendo qual é o ginásio de hoje em ${nomeDe(dados.regiao)}…`);
        const aberta = await abrirNaRegiao(dados.regiao);
        if (aberta.erro) return { ok: false, erro: aberta.erro };
        aprenderGinasios(aberta.janela, dados.regiao);
        const hoje = await ginasioDeHoje(aberta.janela);
        // Sem saber qual e', fica o time da regiao: nao se desiste do dia por causa da escolha
        // fina. Quem nao usa time por ginasio nao pode perder o ginasio por uma leitura falhada.
        const id = hoje?.dataset?.gymId || '';
        const nome = hoje
          ? (hoje.getAttribute('aria-label') || '').replace(/^\s*HOJE\s*·?\s*/i, '').trim()
          : '';
        await fecharJanela(aberta.janela);
        const time = timeDoGinasio(dados.regiao, id);
        if (!time)
          return {
            ok: false,
            erro: nome
              ? `hoje é ${nome} e não há time escolhido para ele nem para ${nomeDe(dados.regiao)}`
              : `não há time escolhido para ${nomeDe(dados.regiao)}`,
          };
        dados.ginasioId = id;
        dados.ginasioNome = nome;
        dados.timeGym = time;
        guardarTarefa(dados);
        if (nome) dizer(`Hoje é ${nome}. Time: "${time}".`);
        return { ok: true };
      }

      if (etapa === 'time-gym') {
        await respirarAntesDoClique((t) => dizer(t));
        if (parar) return { ok: true };
        dizer(`Montando o time "${dados.timeGym}"…`);
        const r = await trocarTime(dados.timeGym);
        return r.ok ? { ok: true } : { ok: false, erro: `não montei o time do ginásio: ${r.erro}` };
      }

      if (RECARGAS[etapa]) {
        // A etapa seguinte ja' esta' gravada antes da recarga, senao a pagina voltaria e repetiria
        // esta, num ciclo de F5 sem fim.
        //
        // Nao se espera a tela limpar aqui: quem faz isso e' a carga seguinte, que ja' comeca por
        // `esperarTelaLimpa` antes de retomar a tarefa. O aneuncio que interessa e' o que nasce
        // **depois** da recarga, e esse ainda nao existe deste lado.
        dizer(RECARGAS[etapa]);
        dados.etapa = ETAPAS[ETAPAS.indexOf(etapa) + 1];
        guardarTarefa(dados);
        await espera(600);
        location.reload();
        return { recarregou: true };
      }

      if (etapa === 'desafiar') {
        // Esta etapa vem logo depois de uma recarga, que e' exactamente quando o aneuncio nasce.
        await esperarTelaLimpa(15000, (t) => dizer(t));
        await fecharMenus();
        dizer('Abrindo o ginásio…');
        const aberta = await abrirNaRegiao(dados.regiao);
        if (aberta.erro) return { ok: false, erro: aberta.erro };
        const janela = aberta.janela;

        dizer(`Procurando o ginásio de hoje em ${dados.regiao}…`);
        const hoje = await ginasioDeHoje(janela);
        if (!hoje) {
          // A mensagem diz o que **foi visto**, e nao so' o que faltou: foi a falta disto que
          // transformou um problema de espera num mistério. Com a lista na mao, a proxima falha
          // ja' se explica sozinha.
          const todos = hotspots(janela);
          const diagnostico = todos.length
            ? `vi ${todos.length} ginásios e nenhum marcado HOJE: ${todos
                .map((h) => (h.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 18))
                .join(' | ')}`
            : 'a janela abriu mas os ginásios não chegaram a aparecer';
          await fecharJanela(janela);
          return { ok: false, erro: `em ${dados.regiao}, ${diagnostico}` };
        }
        await clicarHumano(hoje);
        await espera(Math.round(sorteio(800, 1800)));

        const desafiar = [...janela.querySelectorAll('button')].find(
          (b) => visivel(b) && /DESAFIAR AGORA/i.test(b.textContent || ''),
        );
        if (!desafiar || desafiar.disabled) {
          await fecharJanela(janela);
          return {
            ok: false,
            erro: 'o botão "Desafiar agora" não está disponível (tentativas do dia?)',
          };
        }

        // Este e' o ultimo clique da fase de entrada, entao a pausa dele leva o que sobrou do
        // orcamento: e' o momento em que um jogador leria as condicoes antes de carregar no botao.
        dizer('Desafiando…');
        // O cinema de entrada tambem conta como "o desafio pegou": e' ele que vem primeiro.
        if (
          !(await clicarEEsperar(
            desafiar,
            () => combateEmCurso() || noCinemaDeEntrada() || tituloDoResultado(),
            15000,
          ))
        )
          return { ok: false, erro: 'cliquei em "Desafiar agora" e o combate não começou' };

        // O cinema de entrada vem primeiro, e e' preciso carregar nele para a luta comecar.
        await entrarNaArena((t) => dizer(t));

        const luta = await esperarOCombate((t) => dizer(t));
        if (!luta.acabou) return { ok: false, erro: luta.erro };
        dados.resultado = luta.texto;
        dados.venceu = luta.venceu;
        guardarTarefa(dados);

        // O combate nao sai de orcamento nenhum: o resumo e' lido e confirmado no seu proprio
        // tempo, sem o relogio da entrada a empurrar.
        fecharRitmo();
        const resumo = await continuarDoResumo((t) => dizer(t));
        if (!resumo.ok) {
          // Nao se para a corrida por isto. Parar deixaria a tarefa na etapa `desafiar`, e a nova
          // tentativa daqui a dez minutos iria **desafiar outra vez** um ginasio ja' feito.
          //
          // Mas diz-se o que **se viu**, como nos ginasios: foi a falta disto que fez perder uma
          // publicacao inteira a adivinhar porque e' que o clique nao pegava.
          const visto = (resumo.visto || [])
            .map(
              (e) =>
                `${(e.textContent || '?').trim().slice(0, 12)}${clicavel(e) ? '' : ' (desligado)'}`,
            )
            .join(' | ');
          dizer(
            `Não consegui confirmar o resumo${visto ? ` — vi: ${visto}` : ' — não achei o botão'}; sigo mesmo assim.`,
            true,
          );
          await espera(Math.round(sorteio(1500, 3000)));
        }
        await fecharBanners();
        return { ok: true };
      }

      if (etapa === 'time-volta') {
        // A pausa que faltava: entre confirmar o resumo da partida e abrir a mochila.
        await respirarAntesDoClique((t) => dizer(t));
        if (parar) return { ok: true };
        dizer(`Montando o time "${dados.timeVolta}"…`);
        const r = await trocarTime(dados.timeVolta);
        // Uma falha aqui nao apaga o ginasio que ja' foi feito, mas tem de ser dita: seguir para a
        // cacada com o time de ginasio seria pior do que parar.
        return r.ok
          ? { ok: true }
          : {
              ok: false,
              erro: `o ginásio foi feito, mas não voltei ao time "${dados.timeVolta}": ${r.erro}`,
            };
      }

      if (etapa === 'voltar') {
        const r = await voltarACacada(dados.cacada, (t) => dizer(t));
        if (!r.ok) return { ok: false, erro: r.erro };
        const fim = dados.venceu === false ? 'Derrota' : 'Vitória';
        return {
          ok: true,
          fim: true,
          mensagem: `${fim} no ginásio e de volta à "${dados.cacada.nome}".`,
        };
      }

      return { ok: false, erro: `etapa desconhecida: ${etapa}` };
    }

    /**
     * O que fazer quando um passo falha: dizer, e marcar nova tentativa para daqui a dez minutos.
     *
     * A tarefa **nao** e' apagada entre tentativas — ela fica guardada na etapa em que parou, e a
     * nova tentativa continua dali em vez de refazer tudo. Sair da cacada duas vezes, por exemplo,
     * nao faria sentido nenhum.
     *
     * **NA TERCEIRA, DESISTE.** E a tarefa e' descartada, nao so' o relogio: enquanto ela existe,
     * `emCorrida()` responde que sim, os botoes ficam travados e a agenda do dia nao arranca. Uma
     * tarefa morta guardada deixaria o painel preso para sempre, que e' pior que o laco.
     */
    async function falhou(dados, erro) {
      dados.tentativas = (dados.tentativas || 0) + 1;
      if (dados.tentativas >= MAX_TENTATIVAS) {
        clearTimeout(agendado);
        limparTarefa();
        anotarPlacar(dados.regiao, 'erro', erro);
        travarBotoes(false);
        dizer(
          `Desisti depois de ${MAX_TENTATIVAS} tentativas: ${erro}. Confira no jogo em que pé ficou a equipe.`,
          true,
        );
        return;
      }
      dados.proxima = Date.now() + ESPERA_APOS_FALHA;
      guardarTarefa(dados);
      // Laranja enquanto a tentativa seguinte nao chega. Se ela correr bem, o sinal vira verde —
      // o que fica no fim e' o que aconteceu de facto.
      anotarPlacar(dados.regiao, 'erro', erro);
      dizer(`Parei: ${erro}. Tento de novo em ${faltaPara(dados.proxima)}.`, true);
      agendar();
    }

    /**
     * Marca a proxima tentativa, inclusive depois de uma recarga no meio da espera.
     *
     * Os botoes ficam travados enquanto se espera, e o `Parar` a' vista. Sem isto o `Fazer o
     * ginasio de hoje` continuava clicavel durante os dez minutos e nao fazia nada ao ser clicado —
     * um botao que ignora o utilizador em silencio e' pior do que um botao desligado.
     */
    function agendar() {
      clearTimeout(agendado);
      const dados = tarefa();
      if (!dados?.proxima) return;
      travarBotoes(true);
      const falta = Math.max(0, dados.proxima - Date.now());
      agendado = setTimeout(() => {
        const atual = tarefa();
        if (!atual) return;
        delete atual.proxima;
        guardarTarefa(atual);
        void continuarTarefa();
      }, falta);
    }

    /** Quanto falta para a proxima tentativa, em palavras. */
    const faltaPara = (quando) => {
      const segundos = Math.max(0, Math.round((quando - Date.now()) / 1000));
      if (segundos >= 90) return `${Math.round(segundos / 60)} min`;
      return `${segundos} s`;
    };

    /**
     * Comeca uma corrida numa regiao. E' o mesmo caminho para o botao e para a agenda — o
     * automatico nao pode ser um segundo fluxo, com os seus proprios enganos.
     */
    const comecar = (regiao) => {
      // **NA EXPEDIÇÃO O GINASIO ESPERA.** Nao se recusa o dia — marca-se outra tentativa: a
      // expedição dura duas horas e o ginasio tem ate' ao reset. Perder a ocorrencia aqui seria
      // ficar sem ginasio por causa de uma coisa que acaba sozinha.
      if (naExpedicao()) {
        clearTimeout(esperandoExpedicao);
        esperandoExpedicao = setTimeout(() => void comecar(regiao), ESPERA_EXPEDICAO);
        dizer('Você está na expedição — faço o ginásio quando ela acabar.');
        return false;
      }
      const times = timesDe(regiao);
      // Chega haver **algum** time util nesta regiao: o dela, ou o de um ginasio dela. Exigir o
      // da regiao a quem so' usa times por ginasio seria pedir uma escolha que nao vai ser usada.
      // Qual deles vale decide-se na etapa `ver-ginasio`, que e' quando se sabe o ginasio de hoje.
      if (!temAlgumTime(regiao)) {
        dizer(
          `Escolha o time do ginásio de ${nomeDe(regiao)} — o da região ou o do ginásio de hoje. ` +
            'Guarde um no Times primeiro, se não houver.',
          true,
        );
        return false;
      }
      // A cacada e' guardada **agora**, antes de qualquer passo: depois de sair dela, ja' nao ha'
      // como saber de onde se saiu.
      guardarTarefa({
        etapa: 'sair',
        regiao,
        timeGym: times.timeGym,
        timeVolta: times.timeVolta,
        cacada: cacadaAtiva() || ler(CHAVE_ULTIMA, null),
        desde: Date.now(),
        // Sorteado agora e guardado: o F5 do meio do caminho levaria consigo um alvo que so'
        // existisse em memoria, e a segunda metade da entrada correria sem ritmo nenhum.
        alvoPre: Date.now() + sorteio(CICLO_PRE[0], CICLO_PRE[1]),
      });
      void continuarTarefa();
      return true;
    };

    campo('[data-ir]').addEventListener('click', () => {
      if (correndo || tarefa()) return;
      comecar(campo('[data-regiao]').value);
    });

    /**
     * Ir agora numa regiao, pelo botao da linha dela.
     *
     * O "Fazer o ginásio de hoje" vai na regiao que a lista mostra; estes vao na regiao da propria
     * linha, que e' o que se quer quando se esta' a olhar para o placar e se ve' que um dos dois
     * ainda nao foi feito.
     *
     * A lista acompanha, em vez de ficar apontando para a outra: ela manda no "Voltar para a
     * caçada" e nos times a' vista, e deixa-la para tras faria o proximo clique agir noutro lugar.
     * Quem grava e enche as listas e' o proprio `change` que ja' existia.
     */
    // Corrigir o placar a mao, pelo sinal — aberto ou minimizado, e' o mesmo clique.
    painel.addEventListener('click', (evento) => {
      const marca = evento.target.closest?.('[data-marcar]');
      if (marca) marcarAMao(marca.dataset.marcar);
    });

    painel.addEventListener('click', (evento) => {
      const botao = evento.target.closest?.('[data-elite4]');
      if (botao) marcarElite4(botao.dataset.elite4);
    });

    painel.addEventListener('click', (evento) => {
      const botao = evento.target.closest?.('[data-ir-regiao]');
      if (!botao) return;
      const regiao = botao.dataset.irRegiao;
      // **Uma recusa nao pode passar calada.** Minimizado, a linha de estado esta' escondida: sem
      // isto, clicar sem ter time escolhido pareceria um botao que nao faz nada. A frase ja' existe
      // — o que faltava era abrir o painel onde ela esta' escrita.
      const mostrarOMotivo = () => {
        if (!minimizado) return;
        minimizado = false;
        gravar(CHAVE_MIN, false);
        aplicarMinimo();
      };
      if (emCorrida()) {
        dizer('Já há uma corrida em andamento — espere ela acabar ou pare.', true);
        mostrarOMotivo();
        return;
      }
      const lista = campo('[data-regiao]');
      if (lista.value !== regiao) {
        lista.value = regiao;
        lista.dispatchEvent(new Event('change'));
      }
      if (!comecar(regiao)) mostrarOMotivo();
    });

    /**
     * A hora chegou numa regiao.
     *
     * A janela e' marcada como usada **antes** de comecar, e nao no fim: a corrida passa por um F5
     * no meio, e um relogio que so' existisse em memoria voltaria a disparar na mesma janela —
     * desafiando outra vez um ginasio ja' feito.
     */
    const dispararAuto = (regiao) => {
      const nova = agenda();
      nova[regiao].ultima = Date.now();
      guardarAgenda(nova);
      if (correndo || tarefa()) {
        dizer(`A hora de ${regiao} chegou, mas há uma corrida em andamento.`, true);
      } else if (!comecar(regiao)) {
        anotarPlacar(regiao, 'erro', 'não havia time escolhido');
      } else {
        dizer(`Hora de ${regiao}: começando sozinho.`);
      }
      agendarRegiao(regiao);
    };

    function agendarRegiao(regiao) {
      clearTimeout(relogios[regiao]);
      relogios[regiao] = 0;
      proximos[regiao] = 0;
      const config = agenda()[regiao];
      if (config.ligado) {
        const ms = esperaDaJanela(config.horarios, config.dias, config.ultima);
        if (ms !== null) {
          proximos[regiao] = Date.now() + ms;
          relogios[regiao] = setTimeout(() => dispararAuto(regiao), ms);
        }
      }
      pintarAgenda();
    }

    for (const regiao of REGIOES) {
      const liga = campo(`[data-auto="${regiao}"]`);
      const horas = campo(`[data-horas="${regiao}"]`);
      // ---- a agenda da regiao, fechada ate' alguem querer configurar -------
      //
      // Uma lista de sete dias e outra de trinta e um nao cabem numa linha deste painel — mas nao
      // precisam de caber: ficam atras de um botao que mostra o que ja' esta' combinado. Configurar
      // isto e' coisa de poucas vezes; ler o que foi combinado e' de todo dia.
      //
      // O horario muda-se de casa para dentro do editor junto com os dias: a agenda da regiao abre
      // e fecha inteira, em vez de meia dentro e meia fora.
      const editor = calendario()?.montarControles({
        resumoDe: (texto) => calendario().resumo({ dias: texto, horarios: horas.value.trim() }),
      });
      const dias = editor ? editor.campo : document.createElement('input');
      if (editor) {
        campo(`[data-agenda="${regiao}"]`).append(editor.el);
        editor.corpo.prepend(horas);
      }
      const guardado = agenda()[regiao];
      liga.checked = guardado.ligado;
      horas.value = guardado.horarios;
      if (editor) editor.escrever(guardado.dias);
      else dias.value = guardado.dias;
      const mudou = () => {
        const nova = agenda();
        nova[regiao] = {
          ...nova[regiao],
          ligado: liga.checked,
          horarios: horas.value.trim(),
          dias: dias.value.trim(),
        };
        guardarAgenda(nova);
        // Um pedaco que nao se entendeu fica marcado. Ignora-lo seria pior do que recusa-lo: quem
        // escreveu "ultima quarta" com um engano ficaria sem nenhum dia marcado, achando que tem.
        const sobrou = calendario()?.diasNaoEntendidos(dias.value) || [];
        dias.classList.toggle('erro', sobrou.length > 0);
        // O resumo no botao fechado acompanha o horario tambem, e nao so' os dias.
        editor?.resumir();
        agendarRegiao(regiao);
      };
      liga.addEventListener('change', mudou);
      horas.addEventListener('change', mudou);
      dias.addEventListener('change', mudou);
    }

    const campoReset = campo('[data-reset]');
    campoReset.value = agenda().reset;
    campoReset.addEventListener('change', () => {
      const nova = agenda();
      nova.reset = campoReset.value.trim() || '00:00';
      guardarAgenda(nova);
      // A hora do reset muda o que conta como "hoje": os sinais podem acender ou apagar com isto.
      pintarPlacar();
      pintarElite4();
    });

    for (const regiao of REGIOES) agendarRegiao(regiao);
    pintarPlacar();
    pintarElite4();
    // Um minuto: a linha do "próximo" tem de envelhecer sozinha, e os sinais tem de voltar a
    // cinza na hora do reset mesmo com a aba aberta a noite toda.
    setInterval(() => {
      pintarAgenda();
      pintarPlacar();
      pintarElite4();
    }, 60000);

    /**
     * Leva o jogador de volta a' cacada, sozinho, sem ginasio nenhum.
     *
     * Pedido a' parte, e util por si: depois de uma corrida que parou a meio, ou de uma ida ao
     * ginasio feita a' mao, isto devolve o jogador ao que ele estava a fazer sem o obrigar a
     * procurar a cacada certa numa lista de 125.
     */
    campo('[data-voltar]').addEventListener('click', async () => {
      if (correndo || tarefa()) return;
      const cacada = ler(CHAVE_ULTIMA, null);
      const paraOTime = campo('[data-time-volta]').value;
      const jaNaCacada = naCacada();
      if (!jaNaCacada && !cacada?.nome) {
        dizer('Não sei de qual caçada você saiu — entre numa e eu passo a lembrar.', true);
        return;
      }
      correndo = true;
      parar = false;
      travarBotoes(true);
      try {
        // O orcamento da saida tambem vale aqui: e' a mesma sequencia do fim de um ginasio, feita
        // a' mao. Sorteado agora porque este botao nao passa pela maquina de estados.
        const alvo = Date.now() + sorteio(CICLO_SAIDA[0], CICLO_SAIDA[1]);

        // **Trocar o time faz parte.** O painel mostra "Voltar com" mesmo por cima deste botao;
        // voltar a' cacada sem usar esse campo era a interface prometer uma coisa e fazer outra.
        // Relatado assim: "cliquei em voltar para a cacada e ele nao trocou meu time".
        if (paraOTime) {
          dizer(`Montando o time "${paraOTime}"…`);
          const troca = await trocarTime(paraOTime);
          if (!troca.ok) {
            dizer(`Parei: não montei o time "${paraOTime}": ${troca.erro}`, true);
            return;
          }
        }

        if (jaNaCacada) {
          celebrar(
            paraOTime
              ? `Time "${paraOTime}" montado. Você já estava na caçada.`
              : 'Você já está numa caçada.',
          );
          return;
        }

        if (parar) return;
        // Os tres cliques da volta repartem entre si o que resta do orcamento, como na maquina de
        // estados: abrir as cacadas, escolher a regiao, carregar em Caçar.
        abrirRitmo(alvo, CLIQUES.voltar);
        await fecharMenus();
        const r = await voltarACacada(cacada, (t) => dizer(t));
        if (r.ok) celebrar(`De volta à "${cacada.nome}" com o time "${paraOTime}".`);
        else dizer(`Parei: ${r.erro}`, true);
      } finally {
        fecharRitmo();
        correndo = false;
        travarBotoes(false);
      }
    });

    campo('[data-parar]').addEventListener('click', () => {
      clearTimeout(agendado);
      if (correndo) {
        // No meio de um passo nao se abandona o jogo a meio: marca-se, e o laco para a seguir.
        parar = true;
        dizer('Parando depois do passo atual…');
        return;
      }
      // Parado durante a espera dos dez minutos: aqui nao ha' laco nenhum para ler a marca, entao
      // a tarefa e' descartada na hora.
      limparTarefa();
      travarBotoes(false);
      dizer('Cancelado. Confira no jogo em que pé ficou a equipe.');
    });

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

    /**
     * Minimizar: ficam a etiqueta GYM, o sinal de cada regiao e o proximo horario.
     *
     * As listas e os campos saem — sao eles que tapam o jogo, e sao uma ordem que se da' uma vez
     * por dia. O placar fica: minimizado e' o estado em que o ginasio corre sozinho, e e' ai' que
     * saber se ja' foi feito, e como acabou, vale mais. A mensagem do que esta' a acontecer agora
     * continua so' no painel inteiro.
     */
    let minimizado = ler(CHAVE_MIN, false) === true;

    const aplicarMinimo = () => {
      painel.classList.toggle('minimizado', minimizado);
      campo('[data-titulo]').textContent = minimizado ? 'GYM' : 'Ginásio do dia';
      const botao = campo('[data-minimizar]');
      botao.textContent = minimizado ? '□' : '–';
      botao.title = minimizado ? 'Mostrar tudo' : 'Minimizar';
      if (minimizado) pintarResumo();
      recolocar();
    };

    campo('[data-minimizar]').addEventListener('click', () => {
      minimizado = !minimizado;
      gravar(CHAVE_MIN, minimizado);
      aplicarMinimo();
    });

    campo('[data-fechar]').addEventListener('click', () => {
      mostrarPainel(false);
      globalThis.PPX?.anotar?.('gym', false);
    });

    // Arrasto pelo cabecalho, guardando o canto mais proximo — o mesmo desenho de `times.js`, pela
    // mesma razao: pixels contados do canto de cima a esquerda nao sobrevivem a uma janela menor.
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
      if (evento.code === 'KeyG') {
        evento.preventDefault();
        mostrarPainel(false);
        globalThis.PPX?.anotar?.('gym', false);
      } else if (evento.code === 'KeyH') {
        evento.preventDefault();
        mostrarPainel(true);
        globalThis.PPX?.anotar?.('gym', true);
      }
    });

    encherTimes();
    aplicarMinimo();
    recolocar();
    pintar();
    lembrarCacada();
    // De dez em dez segundos: a cacada pode comecar a qualquer momento, pela mao do utilizador, e
    // o botão de voltar precisa de a ter visto pelo menos uma vez.
    setInterval(lembrarCacada, 10000);

    /**
     * Aprender os ginasios **do que o jogador faz**, e nao de uma visita nossa.
     *
     * O painel precisa da lista para mostrar uma linha por ginasio, e a lista so' existe dentro
     * da janela do Desafio dos Gyms. A alternativa era abrir a janela por nossa conta so' para
     * ler — tres cliques no jogo, para encher um menu. Isto nao clica em nada: quando a janela
     * esta' aberta, seja por quem for, le'-se a aba que estiver a' vista.
     *
     * A regiao vem da **aba activa**, e nao da que o painel mostra: quem abriu a janela pode
     * estar a ver outra. Guardar a lista de Hoenn debaixo de 'KANTO' seria pior do que nao ter
     * lista nenhuma — e foi exactamente o engano que a primeira medicao deste trabalho cometeu.
     */
    const espreitarGinasios = () => {
      const seletor = document.querySelector('.gym-selector');
      // **Existir nao e' estar aberta.** Medido no jogo em 30/10/2026: ao fechar a janela o jogo
      // deixa o no' no documento, escondido — zero por zero, `offsetParent` nulo — e com os
      // hotspots todos la' dentro. Sem esta linha, lia-se uma janela fantasma para sempre.
      if (!visivel(seletor)) return;
      const aba = [...seletor.querySelectorAll('button')].find(
        (b) => b.className.includes('is-active') && REGIOES.includes((b.textContent || '').trim().toUpperCase()),
      );
      if (!aba) return;
      const regiao = (aba.textContent || '').trim().toUpperCase();
      const antes = JSON.stringify(ginasiosSabidos()[regiao]);
      if (JSON.stringify(aprenderGinasios(seletor, regiao)) !== antes) pintarGinasios();
    };
    setInterval(espreitarGinasios, 3000);

    if (globalThis.PPX) {
      globalThis.PPX.controlar?.('gym', mostrarPainel);
      mostrarPainel(globalThis.PPX.visivel?.('gym') !== false);

      /**
       * A porta por onde o Times avisa que um time mudou de nome.
       *
       * O Ginasio guarda as duas escolhas **pelo nome** — e' o que o jogo tem, nao ha' id nenhum.
       * Sem este aviso, renomear um time no Times partia a escolha daqui em silencio: a lista
       * passava a ter o nome novo e a escolha guardada apontava para um nome que ja' nao existe,
       * e so' se descobriria no meio de uma corrida.
       */
      globalThis.PPX.gym = {
        timeRenomeado: (velho, novo) => {
          const guardado = escolhas();
          const trocar = (nome) => (nome === velho ? novo : nome);
          gravar(CHAVE_ESCOLHAS, {
            ...guardado,
            // **As duas regioes**, e nao so' a que esta' a' vista: o mesmo time pode estar
            // escolhido em Kanto e em Johto, e a que nao estivesse na tela ficaria partida.
            porRegiao: Object.fromEntries(
              REGIOES.map((r) => [
                r,
                {
                  timeGym: trocar(guardado.porRegiao[r].timeGym),
                  timeVolta: trocar(guardado.porRegiao[r].timeVolta),
                },
              ]),
            ),
            // E os times por ginasio, pela mesma razao: eles tambem guardam o **nome** do time,
            // e um renomear que nao passasse por aqui deixava-os a apontar para um time que ja'
            // nao existe — descoberto so' no meio de uma corrida.
            porGinasio: Object.fromEntries(
              Object.entries(guardado.porGinasio).map(([id, time]) => [id, trocar(time)]),
            ),
          });
          encherTimes(true);
        },
      };
    }

    // Retomar depois de uma recarga. O `Times` e' outro content script e pode ainda nao ter
    // montado a sua porta, entao espera-se por ela antes de pedir uma troca de equipe.
    if (tarefa()) {
      const retomar = async () => {
        await ate(() => globalThis.PPX?.times?.usar, 10000);
        const dados = tarefa();
        if (!dados) return;
        if (dados.proxima) {
          dizer(
            `Tentativa ${dados.tentativas || 1} de ${MAX_TENTATIVAS} parou em "${dados.etapa}". Retomo em ${faltaPara(dados.proxima)}.`,
            true,
          );
          agendar();
          return;
        }
        travarBotoes(true);
        // A pagina acabou de carregar: da'-se tempo ao aneuncio de nascer, para poder fecha-lo,
        // em vez de o encontrar a meio do passo seguinte.
        await esperarTelaLimpa(15000, (t) => dizer(t));
        void continuarTarefa();
      };
      void retomar();
    }
  },
);
