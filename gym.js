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
        (p) => visivel(p) && regex.test((p.querySelector('.pokeidle-panel__title')?.textContent || '').trim()),
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

    const tituloDoResultado = () => document.querySelector('.regional-cinema__title');
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
    const esperarOCombate = async (avisar) => {
      const inicio = Date.now();
      for (;;) {
        const titulo = tituloDoResultado();
        if (titulo) {
          const texto = (titulo.textContent || '').trim();
          return { acabou: true, venceu: /vit[óo]ria/i.test(texto), texto };
        }
        if (!combateEmCurso())
          return { acabou: false, erro: 'o combate saiu da tela sem mostrar o resultado' };
        if (Date.now() - inicio >= TETO_DO_COMBATE)
          return { acabou: false, erro: `o combate passou de ${Math.round(TETO_DO_COMBATE / 60000)} min sem acabar` };
        avisar(`Lutando… ${relogioDoCombate()}`);
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
        return { ok: false, erro: `não achei "${cacada.nome}" na lista de ${cacada.regiao || 'caçadas'}` };
      }
      const botao = [...linha.querySelectorAll('button')].find(
        (b) => /^Caçar$/i.test((b.textContent || '').trim()),
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

    const ETAPAS = ['sair', 'time-gym', 'recarregar', 'desafiar', 'time-volta', 'voltar'];
    /** As etapas de cada orcamento. O combate fica fora: dura o que durar. */
    const DA_ENTRADA = ['sair', 'time-gym', 'recarregar', 'desafiar'];
    const DA_SAIDA = ['time-volta', 'voltar'];
    /**
     * Quantos cliques cada etapa ainda vai dar. E' a conta que reparte o orcamento.
     *
     * Nao precisa de ser exacta — serve para espalhar o tempo. As trocas de time valem zero
     * porque quem clica la' e' o Times, com o ritmo de 20–30 s dele.
     */
    const CLIQUES = {
      sair: 1,
      // As trocas de time nao clicam nada aqui — quem clica e' o Times, com o ritmo de 20–30 s
      // dele. O 1 e' o tempo **antes** de abrir a mochila: ninguem sai de um combate e abre a
      // mochila no mesmo instante, que foi exactamente a queixa da tela da vitoria.
      'time-gym': 1,
      recarregar: 0,
      desafiar: 4,
      'time-volta': 1,
      voltar: 3,
    };
    const cliquesQueFaltam = (fase, etapa) =>
      fase.slice(fase.indexOf(etapa)).reduce((n, e) => n + (CLIQUES[e] || 0), 0);

    const tarefa = () => ler(CHAVE_TAREFA, null);
    const guardarTarefa = (dados) => gravar(CHAVE_TAREFA, dados);
    const limparTarefa = () => apagar(CHAVE_TAREFA);

    const escolhas = () =>
      ler(CHAVE_ESCOLHAS, { regiao: 'KANTO', timeGym: '', timeVolta: 'Hunt' });

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
      <div class="corpo">
        <label>Região
          <select data-regiao>
            <option value="KANTO">Kanto</option>
            <option value="JOHTO">Johto</option>
          </select>
        </label>
        <label>Time do ginásio
          <select data-time-gym></select>
        </label>
        <label>Voltar com
          <select data-time-volta></select>
        </label>
        <button type="button" class="ir" data-ir>Fazer o ginásio de hoje</button>
        <button type="button" class="volta" data-voltar>Voltar para a caçada</button>
        <p class="estado" data-estado></p>
        <button type="button" class="parar" data-parar hidden>Parar</button>
      </div>`;

    const estilo = document.createElement('style');
    estilo.textContent = `
      #lioncode-gym, #lioncode-gym * { box-sizing: border-box; }
      #lioncode-gym {
        position: fixed; z-index: 2147483000; width: 240px;
        background: #11161f; color: #e7edf6; border: 1px solid #2a3244; border-radius: 10px;
        font: 13px/1.45 system-ui, sans-serif; box-shadow: 0 8px 24px #0008;
      }
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
      #lioncode-gym button:disabled { opacity: .5; cursor: default; }
      #lioncode-gym .estado { margin: 0; color: #9aa6b8; min-height: 1.4em; }
      #lioncode-gym .estado.ruim { color: #ff9b9b; }
      #lioncode-gym .estado.bom { color: #7ddba0; font-weight: 600; }

      /* Minimizado: fica a etiqueta GYM e mais nada. E' um painel de dar uma ordem e sair da
         frente, nao de ficar a olhar — com o jogo por tras, o que importa e' nao tapar o jogo. */
      #lioncode-gym.minimizado { width: auto; }
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
    const encherTimes = () => {
      const nomes = globalThis.PPX?.times?.nomes?.() || [];
      const guardado = escolhas();
      for (const [seletor, escolhido] of [
        ['[data-time-gym]', guardado.timeGym],
        ['[data-time-volta]', guardado.timeVolta],
      ]) {
        const lista = campo(seletor);
        // O que esta' na tela vale mais do que o que esta' guardado: encher as listas outra vez
        // nao pode desfazer uma escolha que o utilizador acabou de fazer.
        const naTela = lista.value;
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
      campo('[data-regiao]').value = guardado.regiao || 'KANTO';
      return nomes;
    };

    const guardarEscolhas = () =>
      gravar(CHAVE_ESCOLHAS, {
        regiao: campo('[data-regiao]').value,
        timeGym: campo('[data-time-gym]').value,
        timeVolta: campo('[data-time-volta]').value,
      });

    for (const seletor of ['[data-regiao]', '[data-time-gym]', '[data-time-volta]'])
      campo(seletor).addEventListener('change', guardarEscolhas);

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

    const travarBotoes = (sim) => {
      campo('[data-ir]').disabled = sim;
      campo('[data-voltar]').disabled = sim;
      campo('[data-parar]').hidden = !sim;
      campo('[data-recarregar]').disabled = sim;
      for (const s of ['[data-regiao]', '[data-time-gym]', '[data-time-volta]'])
        campo(s).disabled = sim;
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
    async function continuarTarefa() {
      if (correndo) return;
      const dados = tarefa();
      if (!dados) return;
      correndo = true;
      parar = false;
      travarBotoes(true);
      try {
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
          if (passo.recarregou) return; // a pagina vai embora; quem segue e' a carga seguinte
          if (!passo.ok) {
            await falhou(dados, passo.erro);
            return;
          }
          if (passo.fim) {
            limparTarefa();
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

      if (etapa === 'time-gym') {
        await respirarAntesDoClique((t) => dizer(t));
        if (parar) return { ok: true };
        dizer(`Montando o time "${dados.timeGym}"…`);
        const r = await trocarTime(dados.timeGym);
        return r.ok ? { ok: true } : { ok: false, erro: `não montei o time do ginásio: ${r.erro}` };
      }

      if (etapa === 'recarregar') {
        // A etapa seguinte ja' esta' gravada antes da recarga, senao a pagina voltaria e repetiria
        // esta, num ciclo de F5 sem fim.
        dizer('Recarregando — o ginásio só enxerga a equipe nova depois disto…');
        dados.etapa = 'desafiar';
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
            ok: false,
            erro: haSobreposto()
              ? 'há um anúncio do jogo por cima que não consegui fechar'
              : 'não consegui abrir a janela do ginásio',
          };
        if (!(await escolherRegiao(janela, dados.regiao)))
          return { ok: false, erro: `a janela do ginásio não tem a aba ${dados.regiao}` };

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
          return { ok: false, erro: 'o botão "Desafiar agora" não está disponível (tentativas do dia?)' };
        }

        // Este e' o ultimo clique da fase de entrada, entao a pausa dele leva o que sobrou do
        // orcamento: e' o momento em que um jogador leria as condicoes antes de carregar no botao.
        dizer('Desafiando…');
        if (!(await clicarEEsperar(desafiar, () => combateEmCurso() || tituloDoResultado(), 15000)))
          return { ok: false, erro: 'cliquei em "Desafiar agora" e o combate não começou' };

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
            .map((e) => `${(e.textContent || '?').trim().slice(0, 12)}${clicavel(e) ? '' : ' (desligado)'}`)
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
        return r.ok ? { ok: true } : { ok: false, erro: `o ginásio foi feito, mas não voltei ao time "${dados.timeVolta}": ${r.erro}` };
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
     * A tarefa **nao** e' apagada — ela fica guardada na etapa em que parou, e a nova tentativa
     * continua dali em vez de refazer tudo. Sair da cacada duas vezes, por exemplo, nao faria
     * sentido nenhum.
     */
    async function falhou(dados, erro) {
      dados.tentativas = (dados.tentativas || 0) + 1;
      dados.proxima = Date.now() + ESPERA_APOS_FALHA;
      guardarTarefa(dados);
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

    campo('[data-ir]').addEventListener('click', () => {
      if (correndo || tarefa()) return;
      const escolha = {
        regiao: campo('[data-regiao]').value,
        timeGym: campo('[data-time-gym]').value,
        timeVolta: campo('[data-time-volta]').value,
      };
      if (!escolha.timeGym) {
        dizer('Escolha o time do ginásio. Guarde um no Times primeiro, se não houver.', true);
        return;
      }
      // A cacada e' guardada **agora**, antes de qualquer passo: depois de sair dela, ja' nao ha'
      // como saber de onde se saiu.
      guardarTarefa({
        etapa: 'sair',
        regiao: escolha.regiao,
        timeGym: escolha.timeGym,
        timeVolta: escolha.timeVolta,
        cacada: cacadaAtiva() || ler(CHAVE_ULTIMA, null),
        desde: Date.now(),
        // Sorteado agora e guardado: o F5 do meio do caminho levaria consigo um alvo que so'
        // existisse em memoria, e a segunda metade da entrada correria sem ritmo nenhum.
        alvoPre: Date.now() + sorteio(CICLO_PRE[0], CICLO_PRE[1]),
      });
      void continuarTarefa();
    });

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
            paraOTime ? `Time "${paraOTime}" montado. Você já estava na caçada.` : 'Você já está numa caçada.',
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
     * Minimizar: fica so' a etiqueta GYM.
     *
     * Diferente do modo compacto do Times, que ainda mostra a lista: aqui esconde-se tudo. O
     * ginasio e' uma ordem que se da' uma vez por dia — depois disso o painel so' esta' a tapar o
     * jogo. O estado em curso continua a ser escrito, e basta restaurar para o ver.
     */
    let minimizado = ler(CHAVE_MIN, false) === true;

    const aplicarMinimo = () => {
      painel.classList.toggle('minimizado', minimizado);
      campo('[data-titulo]').textContent = minimizado ? 'GYM' : 'Ginásio do dia';
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

    if (globalThis.PPX) {
      globalThis.PPX.controlar?.('gym', mostrarPainel);
      mostrarPainel(globalThis.PPX.visivel?.('gym') !== false);
    }

    // Retomar depois de uma recarga. O `Times` e' outro content script e pode ainda nao ter
    // montado a sua porta, entao espera-se por ela antes de pedir uma troca de equipe.
    if (tarefa()) {
      const retomar = async () => {
        await ate(() => globalThis.PPX?.times?.usar, 10000);
        const dados = tarefa();
        if (!dados) return;
        if (dados.proxima) {
          dizer(`Tentativa ${dados.tentativas || 1} parou em "${dados.etapa}". Retomo em ${faltaPara(dados.proxima)}.`, true);
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
