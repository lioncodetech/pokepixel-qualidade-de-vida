// PokePixel - loja rapida
//
// Um botao por item da loja do Mark: pokebolas, pocoes e revives. Cada item guarda a sua propria
// quantidade, entao comprar vira um clique so'.
//
// Nada daqui fala com o servidor por fora: o que o botao faz e' exatamente o que voce faria a mao,
// na propria tela da loja. Abrir, achar o item, escrever a quantidade, clicar em Comprar.

PPX.modulo({ id: 'loja-rapida', nome: 'Loja rápida', atalhos: 'Alt+C esconde · Alt+V mostra' }, () => {
  'use strict';

  const CHAVE_QTD = 'lioncode:loja-rapida:quantidades';
  const CHAVE_POS = 'lioncode:loja-rapida:posicao';
  const CHAVE_TAM = 'lioncode:loja-rapida:tamanho';
  const CHAVE_CATALOGO = 'lioncode:loja-rapida:catalogo';
  const CHAVE_CONFIRMA = 'lioncode:loja-rapida:confirmar';
  const CHAVE_SALDO = 'lioncode:loja-rapida:saldo';
  const CHAVE_ESTOQUE = 'lioncode:loja-rapida:estoque';
  const CHAVE_AUTO_COMPRA = 'lioncode:loja-rapida:auto-compra';
  const CHAVE_VARIACAO = 'lioncode:loja-rapida:variacao';
  const VARIACAO_PADRAO = 3;
  const CATEGORIAS = ['Pokébolas', 'Poções', 'Revives'];

  // A loja premium usa as mesmas classes npc-shop. Sem excluir ela, o script compraria diamante.
  // O resumo da expedicao tambem se chama `npc-shop-window`, apesar de nao ser loja nenhuma: sem
  // exclui-lo, o painel acharia que a loja estava aberta e procuraria cartoes dentro de um aviso.
  const LOJA = '.npc-shop-window:not(.premium-shop-window):not(.expedition-window)';

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
      /* modo anonimo, ou armazenamento cheio: a extensao continua, so' nao lembra. */
    }
  };

  const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

  /** Separador de milhar: "1300" nao se le' tao rapido quanto "1.300" na hora de gastar. */
  const moeda = (valor) => Number(valor || 0).toLocaleString('pt-BR');

  /** Espera um elemento aparecer, porque a loja demora a montar depois do clique no menu. */
  async function aguardar(seletor, limite = 4000) {
    const fim = Date.now() + limite;
    while (Date.now() < fim) {
      const achado = document.querySelector(seletor);
      if (achado && achado.getBoundingClientRect().width > 0) return achado;
      await espera(100);
    }
    return null;
  }

  const lojaAberta = () => {
    const janela = document.querySelector(LOJA);
    return janela && janela.getBoundingClientRect().width > 0 ? janela : null;
  };

  /**
   * Abre a loja pelo menu do proprio jogo. O botao "Cidade" e' um grupo que so' mostra a lista ao
   * passar o mouse, mas os itens existem no DOM o tempo todo, entao da' para clicar direto.
   */
  async function abrirLoja() {
    if (lojaAberta()) return { janela: lojaAberta(), abriEu: false };
    const item = [...document.querySelectorAll('.pokeidle-top-toolbar__dropdown-btn')].find(
      (b) => (b.textContent || '').trim() === 'Loja do Mark',
    );
    if (!item) return { janela: null, abriEu: false };
    item.click();
    return { janela: await aguardar(LOJA), abriEu: true };
  }

  /**
   * Fecha so' pelo botao "Fechar" do rodape da loja.
   *
   * A primeira versao procurava qualquer botao de fechar dentro da janela e acabava clicando no X
   * da caixa de confirmacao, cancelando a compra que ela mesma tinha pedido.
   */
  function fecharLoja(janela) {
    if (confirmacaoNaTela()) return;
    const fechar = [...janela.querySelectorAll('button')].find(
      (b) => (b.textContent || '').trim() === 'Fechar',
    );
    if (fechar) fechar.click();
  }

  const CAIXAS = '[class*="modal"],[class*="dialog"],[class*="confirm"],[class*="panel"]';

  /**
   * A caixa de confirmacao do jogo.
   *
   * Procurada pelo que ela *e'* — texto "Confirmar compra" com os botoes Comprar e Cancelar —, e
   * nao por classe nem por posicao no DOM. A primeira versao exigia que o titulo fosse um elemento
   * sem filhos e nao achava nada, por isso a confirmacao automatica nunca disparava. Entre os
   * candidatos vence o menor: o maior seria a tela inteira, que tambem contem o texto.
   */
  function confirmacaoNaTela() {
    const candidatos = [...document.querySelectorAll('div,section,article,dialog,aside')].filter(
      (e) => {
        if (e.getBoundingClientRect().width === 0) return false;
        if (!(e.textContent || '').includes('Confirmar compra')) return false;
        const textos = [...e.querySelectorAll('button')].map((b) => (b.textContent || '').trim());
        return textos.includes('Comprar') && textos.includes('Cancelar');
      },
    );
    candidatos.sort((a, b) => a.textContent.length - b.textContent.length);
    return candidatos[0] ?? null;
  }

  const SOBREPOSTO = '.pokeidle-panel-overlay';

  /**
   * Fecha os avisos que o jogo poe por cima de tudo, antes de qualquer acao.
   *
   * O resumo da expedicao, o "a cacada continuou sem voce" e o banner do Discord aparecem sozinhos,
   * sobretudo ao entrar, e ficam na frente da loja e da mochila — com eles na tela o clique da
   * extensao nao chega a lugar nenhum. Nada aqui e' fechado as cegas: a loja e a mochila sao
   * poupadas (elas moram no mesmo tipo de janela), e com uma confirmacao de compra na tela nao se
   * fecha nada, senao cancelariamos a compra que a propria extensao acabou de pedir.
   */
  function fecharPopups() {
    if (confirmacaoNaTela()) return;
    for (const banner of document.querySelectorAll('.pokeidle-promo-banner__close')) banner.click();
    for (const sobre of document.querySelectorAll(SOBREPOSTO)) {
      // Janela ja' fechada continua no DOM, invisivel, com o botao de fechar dentro. Clicar nesse
      // botao de uma janela que ja' nao esta' na tela deixa o jogo convencido de que ha' uma janela
      // aberta, e a partir dai' ele recusa qualquer outra com "Nao foi possivel abrir esta janela
      // agora" ate' um F5. Medido no jogo: fechar o inventario e clicar no X dele de novo basta.
      if (!sobre.getBoundingClientRect().width) continue;
      if (sobre.querySelector(`${LOJA}, ${INVENTARIO}`)) continue;
      const fechar = sobre.querySelector('.pokeidle-panel__close');
      if (fechar && fechar.getBoundingClientRect().width) fechar.click();
    }
  }

  async function aguardarConfirmacao(limite = 2500) {
    const fim = Date.now() + limite;
    while (Date.now() < fim) {
      const caixa = confirmacaoNaTela();
      if (caixa) return caixa;
      await espera(80);
    }
    return null;
  }

  const cartoes = (janela) => [...janela.querySelectorAll('.npc-shop__buy-card')];

  /**
   * O elemento visivel dentro da loja cujo texto e' exatamente `rotulo`.
   *
   * Vence o mais fundo: a aba "Todos" mostra "Todos 14" no botao e "Todos" no rotulo de dentro, e
   * e' o de dentro que casa. Clicar nele serve na mesma, porque o clique sobe ate' quem escuta.
   */
  function alvoComTexto(janela, rotulo) {
    const casam = [...janela.querySelectorAll('button, a, li, div, span, p')].filter(
      (e) => (e.textContent || '').trim() === rotulo && e.getBoundingClientRect().width > 0,
    );
    return casam[casam.length - 1] ?? null;
  }

  /**
   * A aba, quando ela existir.
   *
   * A janela da loja entra no DOM antes do conteudo dela: medido no jogo, a janela aparece em
   * ~25 ms e as abas so' em ~310 ms. Procurar a aba uma unica vez, no instante em que a janela
   * existe, nao achava nada - e a compra parava com "a loja nao esta na aba de comprar itens",
   * com a loja aberta na frente, na aba errada. Por isso espera em vez de desistir na primeira.
   */
  async function aguardarAba(janela, rotulo, prazo = 5000) {
    const fim = Date.now() + prazo;
    for (;;) {
      const aba = alvoComTexto(janela, rotulo);
      if (aba) return aba;
      if (Date.now() >= fim) return null;
      await espera(100);
    }
  }

  /**
   * Poe a loja na aba onde se compra.
   *
   * A loja do Mark tem abas a esquerda — comprar itens, vender itens, vender pokemon, recomprar — e
   * guarda a ultima aberta. Fora de "Comprar itens" nao existe cartao de compra nenhum, e a compra
   * falhava dizendo que o item nao apareceu no catalogo, sem dizer o motivo de verdade.
   */
  async function prepararLoja(janela) {
    if (cartoes(janela).length) return true;
    const aba = await aguardarAba(janela, 'Comprar itens');
    if (!aba) return false;
    aba.click();
    const fim = Date.now() + 3000;
    while (Date.now() < fim) {
      if (cartoes(janela).length) return true;
      await espera(100);
    }
    return false;
  }

  /**
   * O saldo que a loja mostra no rodape.
   *
   * So' existe no DOM enquanto a loja esta' aberta, que e' justamente quando o painel nao precisa
   * dele. Por isso e' guardado com a hora: melhor um numero velho e datado do que nenhum.
   */
  function saldoNaLoja(janela) {
    const valor = [...janela.querySelectorAll('.pokeidle-currency__amount')].find((e) => {
      let pai = e.parentElement;
      for (let nivel = 0; pai && nivel < 4; nivel += 1, pai = pai.parentElement)
        if (/SEU SALDO/i.test(pai.textContent || '')) return true;
      return false;
    });
    const numero = Number((valor?.textContent || '').replace(/\D/g, ''));
    return Number.isFinite(numero) && numero > 0 ? numero : null;
  }

  function anotarSaldo() {
    const janela = lojaAberta();
    if (!janela) return false;
    const valor = saldoNaLoja(janela);
    if (valor === null) return false;
    const antes = ler(CHAVE_SALDO, null);
    gravar(CHAVE_SALDO, { valor, quando: Date.now() });
    return antes?.valor !== valor;
  }

  // ---------- inventario ----------

  const INVENTARIO = '.inventory-window';

  /**
   * Quanto de cada item existe na mochila.
   *
   * Cada slot traz o nome e a quantidade no proprio `aria-label` ("Poke Ball, 77149 unidades"),
   * que e' mais confiavel que o texto do icone: ali o numero vem abreviado com separador.
   */
  function estoqueNaTela() {
    const janela = inventarioAberto();
    if (!janela) return null;
    const achados = {};
    for (const slot of janela.querySelectorAll('.inventory-slot')) {
      const texto = slot.getAttribute('aria-label') || '';
      const partes = /^(.+),\s*(\d+)\s+unidades?$/.exec(texto);
      if (partes) achados[partes[1].trim()] = Number(partes[2]);
    }
    return Object.keys(achados).length ? achados : null;
  }

  function anotarEstoque() {
    const achados = estoqueNaTela();
    if (!achados) return false;
    gravar(CHAVE_ESTOQUE, { itens: achados, quando: Date.now() });
    return true;
  }

  /**
   * Abre o inventario, le, e fecha se foi este botao que abriu.
   *
   * O script nao abre esta tela sozinho de tempos em tempos: so' quando voce pede. Uma janela que
   * pisca na sua frente no meio do jogo e' pior do que um numero velho.
   */
  /**
   * Aberto mesmo, nao so' presente.
   *
   * O jogo deixa a janela do inventario no DOM depois de fechada, igual a' loja premium. Testar a
   * existencia dava "ja' esta' aberto" com ela fechada: o script nao abria, nao lia nada e ainda
   * reclamava. O que vale e' ter tamanho na tela.
   */
  const inventarioAberto = () => {
    const janela = document.querySelector(INVENTARIO);
    return janela && janela.getBoundingClientRect().width > 0 ? janela : null;
  };

  /** O X do cabecalho. Procurado pelo texto, pelo rotulo e pela classe, porque varia. */
  function fecharInventario() {
    const janela = inventarioAberto();
    if (!janela) return;
    const botao = [...janela.querySelectorAll('button')].find((b) => {
      if (b.classList.contains('inventory-slot') || b.classList.contains('inventory-category-tab'))
        return false;
      const texto = (b.textContent || '').trim();
      const rotulo = `${b.getAttribute('aria-label') || ''} ${b.getAttribute('title') || ''} ${b.className}`;
      return /^[✕×✖xX]$/.test(texto) || /close|fechar/i.test(rotulo);
    });
    if (botao) {
      botao.click();
      return;
    }
    // Sem botao reconhecido, Escape e' o que o jogo tambem aceita para fechar uma janela.
    for (const tipo of ['keydown', 'keyup'])
      document.dispatchEvent(
        new KeyboardEvent(tipo, { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }),
      );
  }

  /**
   * Poe a mochila na aba "Todos" antes de ler.
   *
   * O jogo reabre o inventario na ultima categoria usada, e cada categoria mostra so' os itens
   * dela: lida em "Pokebolas", a mochila parece nao ter pocao nenhuma, e a compra acha que falta
   * tudo. Com a leitura inteira valendo zero para o que nao aparece, ler na aba errada seria
   * comprar o alvo cheio de meia loja.
   */
  async function abaTodos(janela, prazo = 4000) {
    const fim = Date.now() + prazo;
    for (;;) {
      const abas = [...janela.querySelectorAll('.inventory-category-tab')];
      const todos = abas.find((t) => (t.textContent || '').trim() === 'Todos');
      if (todos) {
        if (todos.classList.contains('is-active')) return true;
        todos.click();
        await espera(400);
        if (todos.classList.contains('is-active')) return true;
      }
      // Sem as abas no DOM ainda: a janela entra antes do conteudo, como a da loja.
      if (Date.now() >= fim) return !abas.length;
      await espera(100);
    }
  }

  async function atualizarEstoque(avisar) {
    fecharPopups();
    const jaAberto = Boolean(inventarioAberto());
    if (!jaAberto) {
      const botao = document.querySelector('.pokeidle-top-toolbar__btn[data-menu-id="inventory"]');
      if (!botao) {
        avisar('nao achei o inventario');
        return;
      }
      botao.click();
      if (!(await aguardar(INVENTARIO, 8000))) {
        avisar('o inventario nao abriu');
        return;
      }
      await espera(400);
    }
    const janela = inventarioAberto();
    if (janela && !(await abaTodos(janela))) {
      avisar('a mochila nao esta na aba Todos');
      if (!jaAberto) {
        fecharInventario();
        await espera(500);
      }
      return;
    }
    const certo = anotarEstoque();
    if (!jaAberto) {
      // A mochila fica aberta de 1 a 5 segundos antes de fechar, nunca o mesmo tempo duas vezes.
      await espera(1000 + Math.random() * 4000);
      fecharInventario();
      await espera(500);
      // Se nao fechou, dizer isso e' melhor do que deixar a janela aberta sem explicacao.
      if (inventarioAberto()) {
        avisar(certo ? 'li a mochila, mas nao consegui fechar' : 'nao li nem fechei a mochila');
        desenhar();
        return;
      }
    }
    avisar(certo ? 'mochila atualizada' : 'nao li a mochila');
    desenhar();
  }

  /** "agora", "ha 7 min", "ha 2 h": a idade importa mais que o horario exato. */
  function idade(quando) {
    const minutos = Math.floor((Date.now() - quando) / 60000);
    if (minutos < 1) return 'agora';
    if (minutos < 60) return `ha ${minutos} min`;
    const horas = Math.floor(minutos / 60);
    return horas < 24 ? `ha ${horas} h` : `ha ${Math.floor(horas / 24)} d`;
  }

  const dadosDoCartao = (cartao) => ({
    nome: cartao.querySelector('b')?.textContent?.trim() ?? '',
    categoria: cartao.querySelector('.npc-shop__item-category')?.textContent?.trim() ?? '',
    preco: Number(
      cartao.querySelector('.npc-shop__purchase-button .pokeidle-currency__amount')?.textContent
        ?.replace(/\D/g, '') ?? 0,
    ),
  });

  /**
   * O campo e' controlado pelo jogo: mudar `.value` direto nao avisa ninguem e o clique seguinte
   * compraria a quantidade antiga. O setter nativo mais os eventos e' o que o jogo escuta.
   */
  function escrever(input, valor) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, String(valor));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * O cartao do item, esperando ele aparecer.
   *
   * A janela da loja fica visivel antes de a lista de produtos existir. Procurar o cartao no
   * instante seguinte ao clique nao achava nada, e era por isso que a compra precisava de dois
   * cliques: o primeiro so' abria a loja, o segundo encontrava o que o primeiro deveria ter achado.
   */
  async function aguardarCartao(janela, nome, limite = 6000) {
    const fim = Date.now() + limite;
    let tirouFiltro = false;
    while (Date.now() < fim) {
      const cartao = cartoes(janela).find((c) => dadosDoCartao(c).nome === nome);
      if (cartao && cartao.querySelector('.npc-shop__custom-button')) return cartao;
      // Em cima da lista ha' filtros por categoria. Se ja' ha' cartoes na tela mas nao o nosso, o
      // item nao esta' faltando: esta' escondido por um filtro, e "Todos" traz todos de volta.
      if (!tirouFiltro && cartoes(janela).length) {
        tirouFiltro = true;
        alvoComTexto(janela, 'Todos')?.click();
      }
      await espera(100);
    }
    return null;
  }

  /**
   * Reparte o resto da compra ao longo de 5 a 20 segundos, contados de agora.
   *
   * O relogio comeca quando a loja ja' esta' aberta, e os marcos sao absolutos: o tempo que o jogo
   * levar para montar a lista e' descontado da fatia seguinte em vez de somar no fim. Assim a
   * duracao total e' a sorteada, e nao a sorteada mais o carregamento.
   */
  function ritmo() {
    const inicio = Date.now();
    const total = 5000 + Math.random() * 15000;
    const marcos = [0.3, 0.6, 0.85, 1].map((parte) => Math.round(total * parte));
    let passo = 0;
    return () => {
      const alvo = marcos[Math.min(passo++, marcos.length - 1)];
      return espera(Math.max(0, inicio + alvo - Date.now()));
    };
  }

  /**
   * Compra um item com a loja ja' aberta.
   *
   * Separado de `comprar` porque o botao "Comprar tudo" abre a loja uma vez e passa por varios
   * itens: abrir e fechar a cada item seria lento e piscaria a tela sem motivo.
   */
  async function comprarNaLoja(janela, nome, quantidade, avisar) {
    const pausa = ritmo();
    await pausa();
    const cartao = await aguardarCartao(janela, nome, 20000);
    if (!cartao) {
      avisar(`${nome} nao apareceu no catalogo`);
      return false;
    }
    const campo = cartao.querySelector('.npc-shop__custom-purchase input[type="number"]');
    const botao = cartao.querySelector('.npc-shop__custom-button');
    if (!campo || !botao) {
      avisar('a loja mudou de formato');
      return false;
    }
    avisar(`${nome}: escrevendo ${quantidade}...`);
    await pausa();
    escrever(campo, quantidade);
    // A loja ainda redesenha depois de abrir; se o redesenho apagar o valor, escreve de novo.
    await espera(250);
    if (Number(campo.value) !== quantidade) {
      escrever(campo, quantidade);
      await espera(250);
    }
    avisar(`comprando ${quantidade}x ${nome}...`);
    await pausa();
    botao.click();

    const caixa = await aguardarConfirmacao(5000);
    if (caixa) {
      if (!ler(CHAVE_CONFIRMA, true)) {
        avisar(`confirme: ${quantidade}x ${nome}`);
        return false;
      }
      // So' confirma a caixa que corresponde ao que este clique pediu. Se o texto falar de outro
      // item ou de outra quantidade, e' outra compra e nao e' deste script confirmar.
      const texto = (caixa.textContent || '').replace(/\s+/g, ' ');
      const confere = texto.includes(nome) && texto.replace(/\s/g, '').includes(`${quantidade}×`);
      const sim = [...caixa.querySelectorAll('button')].find(
        (b) => (b.textContent || '').trim() === 'Comprar',
      );
      if (!confere || !sim) {
        avisar('confirmacao diferente do pedido');
        return false;
      }
      avisar('confirmando...');
      await pausa();
      sim.click();
      await espera(400);
    }
    avisar(`${quantidade}x ${nome}`);
    return true;
  }

  /** A margem com que o alvo e' sorteado, em porcento. Zero compra exatamente ate' o alvo. */
  function variacaoPct() {
    const guardado = Number(ler(CHAVE_VARIACAO, VARIACAO_PADRAO));
    return Number.isFinite(guardado) ? Math.min(50, Math.max(0, guardado)) : VARIACAO_PADRAO;
  }

  /**
   * Quanto comprar de um item para chegar ao alvo.
   *
   * O numero da coluna e' quanto se quer **ter**, nao quanto comprar: compra-se a diferenca. Ter
   * mais do que o alvo nao devolve nada, apenas nao compra. O alvo e' sorteado dentro da margem a
   * cada compra, senao a mochila terminaria sempre no mesmo numero redondo, compra apos compra.
   *
   * Devolve `null` quando nao ha leitura da mochila: sem saber quanto se tem, "ate' ter X" nao e'
   * uma conta que se possa fazer, e chutar compraria demais.
   */
  /**
   * Quanto se tem de um item, ou `undefined` quando nao da' para saber.
   *
   * A mochila so' lista o que existe: item com zero nao aparece nela. Tratar "nao apareceu" como
   * "nao sei" fazia justamente os itens acabados — os que mais precisam de compra — serem os
   * unicos que nunca eram comprados. Sem leitura nenhuma, porem, continua sendo "nao sei": ai
   * "nao apareceu" valeria para tudo, e o alvo inteiro seria comprado por engano.
   */
  function quantoTenho(itens, nome) {
    if (!itens || !Object.keys(itens).length) return undefined;
    return itens[nome] ?? 0;
  }

  function faltaPara(nome, alvo, itens) {
    if (!alvo) return 0;
    const tenho = quantoTenho(itens, nome);
    if (tenho === undefined) return null;
    const margem = (Math.random() * 2 - 1) * (variacaoPct() / 100);
    return Math.max(0, Math.round(alvo * (1 + margem)) - tenho);
  }

  async function comprar(nome, alvo, avisar) {
    fecharPopups();
    // A mochila e' lida antes de toda compra: o alvo so' faz sentido contra o que se tem agora.
    await atualizarEstoque(avisar);
    const falta = faltaPara(nome, alvo, ler(CHAVE_ESTOQUE, {}).itens);
    if (falta === null) {
      avisar(`nao sei quanto tenho de ${nome}`);
      return;
    }
    if (falta === 0) {
      avisar(`ja' tenho o alvo de ${nome}`);
      return;
    }
    avisar('abrindo a loja...');
    const { janela, abriEu } = await abrirLoja();
    if (!janela) {
      avisar('nao achei a loja do Mark');
      return;
    }
    if (!(await prepararLoja(janela))) {
      avisar('a loja nao esta na aba de comprar itens');
      if (abriEu) fecharLoja(janela);
      return;
    }
    // So' agora o relogio comeca: abrir a loja nao entra na conta dos 5 a 20 segundos.
    const comprou = await comprarNaLoja(janela, nome, falta, avisar);
    if (abriEu) fecharLoja(janela);
    // Releitura pelo mesmo motivo do lote: o numero da tela tem de ser o de depois da compra.
    if (comprou) await atualizarEstoque(avisar);
  }

  let parar = false;

  /** Percorre a lista comprando, de cada item com alvo acima de zero, so' o que falta para la'. */
  async function comprarTudo(avisar) {
    const quantidades = ler(CHAVE_QTD, {});
    const comAlvo = ler(CHAVE_CATALOGO, [])
      .filter((item) => CATEGORIAS.includes(item.categoria))
      .map((item) => ({ ...item, alvo: Number(quantidades[item.nome]) || 0 }))
      .filter((item) => item.alvo > 0);
    if (!comAlvo.length) {
      avisar('nada configurado acima de zero');
      return;
    }
    parar = false;
    fecharPopups();
    // Uma leitura so' da mochila serve a lista inteira: abri-la item a item seria absurdo.
    await atualizarEstoque(avisar);
    if (parar) {
      avisar('parado antes de comprar');
      return;
    }
    const itens = ler(CHAVE_ESTOQUE, {}).itens;
    // `filter(quantidade)` tambem descartava os `null`, entao o aviso de "sem leitura" nunca
    // chegava a aparecer: o item sumia do lote sem dizer nada. Zero sai aqui, `null` sobrevive.
    const pedido = comAlvo
      .map((item) => ({ ...item, quantidade: faltaPara(item.nome, item.alvo, itens) }))
      .filter((item) => item.quantidade !== 0);
    const semLeitura = pedido.filter((item) => item.quantidade === null).map((item) => item.nome);
    const aComprar = pedido.filter((item) => item.quantidade !== null);
    if (!aComprar.length) {
      avisar(semLeitura.length ? `sem leitura de ${semLeitura.length} itens` : 'tudo ja no alvo');
      return;
    }
    avisar('abrindo a loja...');
    const { janela, abriEu } = await abrirLoja();
    if (!janela) {
      avisar('nao achei a loja do Mark');
      return;
    }
    if (!(await prepararLoja(janela))) {
      avisar('a loja nao esta na aba de comprar itens');
      if (abriEu) fecharLoja(janela);
      return;
    }
    let feitos = 0;
    for (const item of aComprar) {
      if (parar) break;
      feitos += 1;
      const prefixo = `${feitos}/${aComprar.length} `;
      const ok = await comprarNaLoja(janela, item.nome, item.quantidade, (texto) =>
        avisar(prefixo + texto),
      );
      // Um item que falhou nao interrompe o resto: os outros nao tem culpa.
      if (!ok) await espera(400);
    }
    if (abriEu) fecharLoja(janela);
    const sobra = semLeitura.length ? ` (${semLeitura.length} sem leitura)` : '';
    avisar(
      parar
        ? `parado em ${feitos}/${aComprar.length}${sobra}`
        : `pronto: ${aComprar.length} itens${sobra}`,
    );
    // A mochila guardada e' a de antes da compra: sem reler, o painel continua mostrando o que
    // havia na abertura e a proxima rodada decide em cima de um numero que ja' envelheceu.
    if (feitos) await atualizarEstoque(avisar);
  }

  /** Guarda o catalogo para os botoes existirem mesmo com a loja fechada. */
  function lembrarCatalogo() {
    const janela = lojaAberta();
    if (!janela) return;
    const itens = cartoes(janela)
      .map(dadosDoCartao)
      .filter((item) => CATEGORIAS.includes(item.categoria));
    if (!itens.length) return;
    // Mesclado por nome, nao trocado: com um filtro de categoria ligado so' alguns cartoes existem,
    // e trocar a lista inteira apagaria os outros itens do painel ate' alguem reabrir sem filtro.
    const mapa = new Map(ler(CHAVE_CATALOGO, []).map((item) => [item.nome, item]));
    for (const item of itens) mapa.set(item.nome, item);
    gravar(CHAVE_CATALOGO, [...mapa.values()]);
  }

  // ---------- interface ----------

  const painel = document.createElement('div');
  painel.id = 'lioncode-loja-rapida';
  painel.innerHTML = `
    <header>
      <strong>Loja rapida</strong>
      <span data-saldo></span>
      <button type="button" data-fechar>&times;</button>
    </header>
    <div data-lista></div>
    <footer>
      <label><input type="checkbox" data-confirma> Confirmar sozinho</label>
      <button type="button" class="tudo" data-tudo></button>
      <div class="rodape">
        <button type="button" data-mochila>Atualizar mochila</button>
        <span data-aviso>Alt+C esconde, Alt+V mostra</span>
      </div>
      <div class="linhas">
        <label class="auto">
          <button type="button" class="auto-botao" data-auto>Iniciar</button>
          comprar tudo
          <select data-modo>
            <option value="minutos">a cada</option>
            <option value="horarios">uma vez entre</option>
          </select>
          <span data-campos-minutos>
            <input type="number" data-min min="1" max="1440"> a
            <input type="number" data-max min="1" max="1440"> min
          </span>
          <span class="horarios">
            <input type="text" data-horarios placeholder="08:00-09:00, 19:00-20:00"
              title="Uma janela por vírgula. Dentro de cada uma ela age uma única vez."
              spellcheck="false">
            <input type="text" data-dias placeholder="todo dia"
            title="Vazio: todo dia. Exemplos: &quot;seg, qui&quot; · &quot;1, 15&quot; · &quot;último&quot; · &quot;última sexta&quot; · &quot;primeira segunda&quot;."
            spellcheck="false">
        </span>
          <span data-proxima></span>
        </label>
        <label class="variacao">
          variar o alvo em &plusmn; <input type="number" data-variacao min="0" max="50"> %
        </label>
      </div>
    </footer>`;

  const estilo = document.createElement('style');
  estilo.textContent = `
    /* Sem isto a largura declarada nao inclui padding e borda, e o campo de quantidade ficava 14px
       mais largo que a coluna do cabecalho — os rotulos nao batiam com as colunas. */
    #lioncode-loja-rapida, #lioncode-loja-rapida * { box-sizing: border-box; }
    #lioncode-loja-rapida {
      position: fixed; z-index: 2147483000; width: 524px; max-height: 88vh; overflow: auto;
      /* Canto de arrastar do proprio navegador: a rolagem ja' existe, entao encolher nao esconde
         nada, so' passa a rolar. */
      resize: both; min-width: 330px; min-height: 150px;
      background: #10151e; color: #e6e9ef; border: 1px solid #2a3240; border-radius: 12px;
      font: 12px/1.45 system-ui, sans-serif; box-shadow: 0 14px 34px rgba(0,0,0,.55);
      scrollbar-width: thin; scrollbar-color: #2a3240 transparent;
      /* Transparente em repouso para nao tapar o jogo atras dela, e opaca assim que o mouse ou o
         teclado chega: o painel e' para ser lido de perto, nao enquanto se joga. */
      opacity: .82; transition: opacity .15s;
    }
    #lioncode-loja-rapida:hover, #lioncode-loja-rapida:focus-within { opacity: 1; }
    #lioncode-loja-rapida header {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      padding: 9px 12px; background: linear-gradient(#1b2430, #161d27); cursor: move;
      user-select: none; border-bottom: 1px solid #2a3240; position: sticky; top: 0; z-index: 2;
    }
    #lioncode-loja-rapida header strong { font-size: 12px; letter-spacing: .3px; }
    #lioncode-loja-rapida header button {
      background: none; border: 0; color: #8b93a5; font-size: 17px; cursor: pointer; line-height: 1;
      padding: 0 2px;
    }
    #lioncode-loja-rapida header button:hover { color: #e6e9ef; }
    #lioncode-loja-rapida h4 {
      margin: 9px 12px 4px; font-size: 10px; text-transform: uppercase; color: #7d8697;
      letter-spacing: 1px; font-weight: 600;
    }
    /* As colunas do cabecalho repetem as larguras das linhas, senao os rotulos sairiam do lugar. */
    #lioncode-loja-rapida .cabecalho {
      display: flex; align-items: center; gap: 8px; margin: 2px 8px 4px;
      padding: 0 10px; border: 1px solid transparent; font-size: 10px; letter-spacing: 1px;
      text-transform: uppercase; color: #6d7586;
    }
    #lioncode-loja-rapida .cabecalho span { text-align: right; }
    #lioncode-loja-rapida .col-qtd { flex: none; width: 72px; }
    #lioncode-loja-rapida .col-vazio { flex: none; width: 76px; }
    /* Uma linha por item: nome, estoque, quantidade, gasto e botao lado a lado, sem rolagem. */
    #lioncode-loja-rapida .item {
      display: flex; align-items: center; gap: 8px;
      margin: 0 8px 4px; padding: 5px 9px; border: 1px solid #222a37; border-radius: 8px;
      background: #141b26;
    }
    #lioncode-loja-rapida .item__nome {
      flex: 1; min-width: 120px; font-weight: 600; color: #f2f4f8; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap;
    }
    #lioncode-loja-rapida .item__unidade {
      flex: none; width: 86px; text-align: right; color: #7d8697; font-size: 11px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      font-variant-numeric: tabular-nums;
    }
    #lioncode-loja-rapida .item__total {
      flex: none; width: 76px; text-align: right; color: #e9c877;
      font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden;
      text-overflow: ellipsis;
    }
    #lioncode-loja-rapida input[type="number"] {
      flex: none; width: 72px; background: #0b0f16; color: #e6e9ef; border: 1px solid #2a3240;
      border-radius: 7px; padding: 4px 6px; font: inherit; text-align: right;
      font-variant-numeric: tabular-nums;
    }
    #lioncode-loja-rapida input[type="number"]:focus {
      outline: none; border-color: #3d4b63; background: #0d131c;
    }
    #lioncode-loja-rapida .item button {
      flex: none; width: 76px; background: #22304a; color: #dfe6f3; border: 1px solid #31425f;
      border-radius: 7px; padding: 4px 8px; font: inherit; font-weight: 600; cursor: pointer;
    }
    #lioncode-loja-rapida .item button:hover:not(:disabled) { background: #2c3d5c; }
    #lioncode-loja-rapida .item button:disabled { opacity: .45; cursor: default; }
    #lioncode-loja-rapida footer {
      padding: 8px 12px; border-top: 1px solid #2a3240; color: #7d8697;
      position: sticky; bottom: 0; background: #10151e; z-index: 2;
    }
    #lioncode-loja-rapida footer label {
      display: flex; align-items: center; gap: 7px; cursor: pointer; margin-bottom: 5px;
      color: #c3c9d6;
    }
    #lioncode-loja-rapida [data-aviso] { display: block; min-height: 15px; }
    #lioncode-loja-rapida [data-saldo] {
      flex: 1; text-align: right; font-size: 11px; color: #9aa3b4; white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums;
    }
    #lioncode-loja-rapida [data-saldo] b { color: #cfd6e4; font-weight: 600; }
    #lioncode-loja-rapida [data-saldo] i { font-style: normal; color: #6d7586; }
    /* Nao bloqueia a compra: o saldo pode estar velho, entao o aviso e' visual, nao uma trava. */
    #lioncode-loja-rapida .item__total--caro { color: #e38080; }
    #lioncode-loja-rapida .rodape { display: flex; align-items: center; gap: 8px; }
    #lioncode-loja-rapida footer .linhas {
      display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
    }
    #lioncode-loja-rapida footer .linhas label { margin: 0; }
    #lioncode-loja-rapida .rodape button {
      flex: none; background: #1a2230; color: #c3c9d6; border: 1px solid #2a3240;
      border-radius: 7px; padding: 3px 9px; font: inherit; cursor: pointer;
    }
    #lioncode-loja-rapida .rodape button:hover:not(:disabled) { background: #222c3d; }
    #lioncode-loja-rapida .rodape button:disabled { opacity: .45; cursor: default; }
    #lioncode-loja-rapida .rodape [data-aviso] { flex: 1; min-width: 0; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap; }
    #lioncode-loja-rapida .tudo {
      display: block; width: 100%; margin-bottom: 7px; padding: 7px; font: inherit;
      font-weight: 600; cursor: pointer; border-radius: 8px; border: 1px solid #3a5a3f;
      background: #1e3326; color: #d6efdc;
    }
    #lioncode-loja-rapida .tudo:hover:not(:disabled) { background: #26412f; }
    #lioncode-loja-rapida .tudo:disabled { opacity: .45; cursor: default; }
    #lioncode-loja-rapida .tudo.parando { border-color: #5e3a3a; background: #33201f; color: #f0cfcf; }
    #lioncode-loja-rapida .item--fora { opacity: .55; }
    #lioncode-loja-rapida .item__total--fora { color: #6d7586; }
    #lioncode-loja-rapida footer label.auto { margin: 6px 0 0; gap: 5px; color: #9aa3b4; }
    #lioncode-loja-rapida footer label.variacao { margin: 6px 0 0; gap: 5px; color: #9aa3b4; }
    #lioncode-loja-rapida .auto-botao {
      flex: none; background: #1e3326; color: #d6efdc; border: 1px solid #3a5a3f;
      border-radius: 7px; padding: 3px 9px; font: inherit; font-weight: 600; cursor: pointer;
      /* Largura minima para o rotulo virar "Parar · 42:07" sem empurrar o resto da linha. */
      min-width: 104px;
    }
    #lioncode-loja-rapida .auto-botao:hover { background: #26412f; }
    #lioncode-loja-rapida .auto-botao.parando {
      border-color: #5e3a3a; background: #33201f; color: #f0cfcf;
    }
    #lioncode-loja-rapida footer label.auto input[type="number"],
    #lioncode-loja-rapida footer label.variacao input[type="number"] {
      width: 44px; padding: 2px 4px;
    }
    #lioncode-loja-rapida .horarios { display: inline-flex; align-items: center; gap: 5px; }
    #lioncode-loja-rapida .horarios input {
      width: 150px; padding: 2px 5px; background: #0b0f16; color: #e6e9ef;
      border: 1px solid #2a3240; border-radius: 6px; font: inherit;
    }
    /* Texto que nao vira janela nenhuma: o ciclo ficaria parado sem explicacao. */
    #lioncode-loja-rapida [data-proxima] { color: #7d8697; font-size: 11px; }
    #lioncode-loja-rapida [data-modo] {
      background: #0b0f16; color: #e6e9ef; border: 1px solid #2a3240; border-radius: 6px;
      font: inherit; padding: 2px 4px;
    }
    #lioncode-loja-rapida .horarios input.erro { border-color: #7a3b3b; color: #f0b7b7; }`;

  let comprandoTudo = false;
  let emCompra = false;

  const aviso = () => painel.querySelector('[data-aviso]');
  let apagarAviso = 0;
  const mostrar = (texto) => {
    aviso().textContent = texto;
    clearTimeout(apagarAviso);
    apagarAviso = setTimeout(() => (aviso().textContent = 'Alt+C esconde, Alt+V mostra'), 3000);
  };

  function desenharSaldo() {
    const campo = painel.querySelector('[data-saldo]');
    const guardado = ler(CHAVE_SALDO, null);
    campo.textContent = '';
    if (!guardado) return;
    const valor = document.createElement('b');
    valor.textContent = moeda(guardado.valor);
    const quando = document.createElement('i');
    quando.textContent = ` ${idade(guardado.quando)}`;
    campo.append(valor, quando);
    campo.title = `Saldo visto na loja ${idade(guardado.quando)}. Pode estar desatualizado.`;
  }

  function desenhar() {
    const quantidades = ler(CHAVE_QTD, {});
    const catalogo = ler(CHAVE_CATALOGO, []);
    const estoque = ler(CHAVE_ESTOQUE, { itens: {}, quando: 0 });
    const lista = painel.querySelector('[data-lista]');
    lista.textContent = '';
    if (!catalogo.length) {
      const vazio = document.createElement('p');
      vazio.style.cssText = 'margin:10px;color:#8b93a5';
      vazio.textContent = 'Abra a loja do Mark uma vez para eu aprender o catalogo.';
      lista.append(vazio);
      return;
    }
    const cabecalho = document.createElement('div');
    cabecalho.className = 'cabecalho';
    for (const [classe, texto] of [
      ['item__nome', ''],
      ['item__unidade', 'mochila'],
      ['col-qtd', 'alvo'],
      ['item__total', 'valor'],
      ['col-vazio', ''],
    ]) {
      const celula = document.createElement('span');
      celula.className = classe;
      celula.textContent = texto;
      cabecalho.append(celula);
    }
    lista.append(cabecalho);

    for (const categoria of CATEGORIAS) {
      const doGrupo = catalogo.filter((item) => item.categoria === categoria);
      if (!doGrupo.length) continue;
      const titulo = document.createElement('h4');
      titulo.textContent = categoria;
      lista.append(titulo);
      for (const item of doGrupo) {
        const bloco = document.createElement('div');
        bloco.className = 'item';
        bloco.dataset.preco = String(item.preco);

        const nome = document.createElement('span');
        nome.className = 'item__nome';
        nome.textContent = item.nome;
        nome.title = item.nome;
        const unidade = document.createElement('span');
        unidade.className = 'item__unidade';
        const tenho = quantoTenho(estoque.itens, item.nome);
        // O rotulo saiu daqui para o cabecalho das colunas: repetir "tenho" em cada linha so'
        // roubava espaco do nome e atrapalhava comparar os numeros de cima a baixo.
        unidade.textContent = tenho === undefined ? '—' : moeda(tenho);
        unidade.title =
          tenho === undefined
            ? `${moeda(item.preco)} cada`
            : `${moeda(tenho)} na mochila (${idade(estoque.quando)}) · ${moeda(item.preco)} cada`;
        const campo = document.createElement('input');
        campo.type = 'number';
        // Zero e' uma resposta valida: significa "este nao entra na compra de tudo".
        campo.min = '0';
        campo.value = quantidades[item.nome] ?? 0;
        campo.title = `Quanto voce quer ter de ${item.nome}, nao quanto comprar.`;
        const botao = document.createElement('button');
        botao.type = 'button';
        const total = document.createElement('span');
        total.className = 'item__total';
        /**
         * O gasto aparece antes do clique, agora como estimativa.
         *
         * O campo e' o alvo, entao o que se vai gastar e' o que falta para chegar la', medido
         * contra a ultima leitura da mochila — que pode estar velha, e a variacao ainda vai
         * sortear o alvo na hora. Dai' o `~` no total do rodape.
         */
        const pedido = () => Math.max(0, Math.floor(Number(campo.value) || 0));
        const atualizarTotal = () => {
          const alvo = pedido();
          const falta = tenho === undefined ? null : Math.max(0, alvo - tenho);
          const gasto = (falta ?? 0) * item.preco;
          // O rodape soma por aqui: o valor acompanha o que esta' na tela, nao o que foi gravado.
          bloco.dataset.falta = String(falta ?? 0);
          total.textContent = !alvo
            ? 'fora'
            : falta === null
              ? '= ?'
              : falta === 0
                ? 'no alvo'
                : `= ${moeda(gasto)}`;
          const saldo = ler(CHAVE_SALDO, null)?.valor;
          total.classList.toggle('item__total--caro', Boolean(saldo) && gasto > saldo);
          total.classList.toggle('item__total--fora', !alvo || falta === 0);
          bloco.classList.toggle('item--fora', alvo === 0);
          // `emCompra` entra aqui porque ler a mochila redesenha a lista no meio de uma compra:
          // sem isto os botoes voltariam habilitados e daria para comecar outra por cima.
          botao.disabled = emCompra || alvo === 0;
          total.title = !alvo
            ? 'Alvo 0: este item nao entra na compra.'
            : falta === null
              ? 'Sem leitura da mochila; eu leio antes de comprar.'
              : `Alvo ${moeda(alvo)}, tenho ${moeda(tenho)} (${idade(estoque.quando)})` +
                (saldo ? `. Ultimo saldo: ${moeda(saldo)}` : '');
          somarPedido();
        };
        atualizarTotal();
        campo.addEventListener('input', atualizarTotal);
        campo.addEventListener('change', () => {
          campo.value = pedido();
          atualizarTotal();
          gravar(CHAVE_QTD, { ...ler(CHAVE_QTD, {}), [item.nome]: pedido() });
        });
        botao.textContent = 'Comprar';
        botao.addEventListener('click', () => {
          if (!pedido()) return;
          ocupado(true);
          void comprar(item.nome, pedido(), mostrar).finally(() => ocupado(false));
        });
        bloco.append(nome, unidade, campo, total, botao);
        lista.append(bloco);
      }
    }
  }

  // Arrastar pelo cabecalho, com a posicao lembrada: o painel fica onde voce deixou.
  function arrastavel() {
    const cabecalho = painel.querySelector('header');
    let partida = null;
    cabecalho.addEventListener('pointerdown', (evento) => {
      if (evento.target.closest('button')) return;
      // `...getBoundingClientRect()` devolve objeto vazio: as medidas vivem no prototipo, nao no
      // objeto. `partida.left` saia undefined, a conta dava NaN e o painel so' nao andava.
      const caixa = painel.getBoundingClientRect();
      partida = { x: evento.clientX, y: evento.clientY, left: caixa.left, top: caixa.top };
      cabecalho.setPointerCapture(evento.pointerId);
    });
    cabecalho.addEventListener('pointermove', (evento) => {
      if (!partida) return;
      const x = Math.max(0, Math.min(innerWidth - 60, partida.left + evento.clientX - partida.x));
      const y = Math.max(0, Math.min(innerHeight - 30, partida.top + evento.clientY - partida.y));
      painel.style.left = `${x}px`;
      painel.style.top = `${y}px`;
      painel.style.right = 'auto';
      painel.style.bottom = 'auto';
    });
    const soltar = () => {
      if (!partida) return;
      partida = null;
      gravar(CHAVE_POS, PPX.canto.medir(painel));
    };
    cabecalho.addEventListener('pointerup', soltar);
    cabecalho.addEventListener('pointercancel', soltar);
  }

  /**
   * Tamanho: proporcional a janela, nao fixo em pixels.
   *
   * O painel vive dentro de uma janela do LionMultInstance, que muda de tamanho quando as janelas
   * sao rearranjadas. Um tamanho em pixels escolhido na tela inteira transborda num quadrante — por
   * isso o que fica guardado e' a escolha junto com a janela onde foi feita. Em qualquer outra
   * janela ele volta na mesma proporcao, preso ao minimo e ao que cabe.
   *
   * O `max-height` padrao limita a altura a 88% da tela; com uma altura propria ele sai do caminho,
   * senao arrastar o canto para baixo nao teria efeito nenhum depois de certo ponto.
   */
  const LARGURA_PADRAO = 524;
  let ultimoAjuste = 0;

  function ajustarAoViewport() {
    const tam = ler(CHAVE_TAM, null);
    // Numa janela estreita demais o proprio minimo nao cabe; ai' o minimo passa a ser a janela.
    const minL = Math.min(330, innerWidth - 8);
    const minA = Math.min(150, innerHeight - 8);
    painel.style.minWidth = `${minL}px`;
    painel.style.minHeight = `${minA}px`;
    // Sem tamanho escolhido so' encolhemos o padrao para caber; a altura segue com o `max-height`.
    const alvoL = tam?.largura
      ? (tam.largura / (tam.janelaLargura || innerWidth)) * innerWidth
      : LARGURA_PADRAO;
    painel.style.width = `${Math.max(minL, Math.min(innerWidth - 8, Math.round(alvoL)))}px`;
    if (tam?.altura) {
      const alvoA = (tam.altura / (tam.janelaAltura || innerHeight)) * innerHeight;
      painel.style.height = `${Math.max(minA, Math.min(innerHeight - 8, Math.round(alvoA)))}px`;
      painel.style.maxHeight = 'none';
    }
    // Encolher a janela deixaria o painel pendurado para fora. Ele volta pela distancia ate' a
    // borda que ficou mais perto quando a pessoa o largou, e nao pelos pixels do canto de cima a
    // esquerda: assim um painel do lado direito continua do lado direito num quadrante estreito, e
    // voltar ao tamanho grande o devolve exatamente ao lugar de onde ele saiu.
    recolocar();
    ultimoAjuste = Date.now();
  }

  /**
   * Leva o painel ao canto guardado, se houver e se ele estiver a vista.
   *
   * Escondido ele nao tem medidas, e posicionar pelo zero o mandaria para o canto errado; por isso
   * `mostrarPainel` chama isto de novo quando ele reaparece. Sem nada guardado fica o padrao, preso
   * a direita e ao alto por `right`/`top` do proprio navegador, que ja' acompanham a janela.
   */
  const recolocar = () => {
    if (PPX.canto.aplicar(painel, ler(CHAVE_POS, null))) return;
    painel.style.left = 'auto';
    painel.style.bottom = 'auto';
    painel.style.right = '16px';
    painel.style.top = '110px';
  };
  recolocar();

  document.documentElement.append(estilo, painel);
  ajustarAoViewport();
  arrastavel();

  // Guarda o tamanho depois que a pessoa para de arrastar o canto, nao a cada pixel. Junto vai a
  // janela em que foi escolhido, que e' o que torna a proporcao reconstituivel depois.
  let gravarTamanho = 0;
  new ResizeObserver(() => {
    clearTimeout(gravarTamanho);
    gravarTamanho = setTimeout(() => {
      if (painel.style.display === 'none') return;
      // Um ajuste nosso tambem acorda o observador; gravar ai' trocaria a escolha da pessoa pelo
      // tamanho encolhido de um quadrante, e a proporcao iria minguando a cada rearranjo.
      if (Date.now() - ultimoAjuste < 700) return;
      painel.style.maxHeight = 'none';
      const caixa = painel.getBoundingClientRect();
      gravar(CHAVE_TAM, {
        largura: Math.round(caixa.width),
        altura: Math.round(caixa.height),
        janelaLargura: innerWidth,
        janelaAltura: innerHeight,
      });
    }, 400);
  }).observe(painel);

  // O painel acompanha a janela: rearranjar as views do LionMultInstance muda o viewport, e sem
  // isto o painel continuaria do tamanho da janela anterior, maior do que o espaco que sobrou.
  let ajusteJanela = 0;
  addEventListener('resize', () => {
    clearTimeout(ajusteJanela);
    ajusteJanela = setTimeout(ajustarAoViewport, 150);
  });
  // A idade do saldo envelhece sozinha; sem isto ficaria "agora" para sempre.
  setInterval(desenharSaldo, 30000);

  const tudo = painel.querySelector('[data-tudo]');
  const mochila = painel.querySelector('[data-mochila]');

  /** Enquanto uma compra corre, nada mais pode comecar outra; so' o "Parar" continua vivo. */
  function ocupado(estado) {
    emCompra = estado;
    for (const b of painel.querySelectorAll('.item button, [data-mochila]'))
      b.disabled = estado || b.closest('.item')?.classList.contains('item--fora') === true;
    tudo.disabled = estado && !comprandoTudo;
    tudo.classList.toggle('parando', comprandoTudo);
    tudo.textContent = comprandoTudo ? 'Parar' : rotuloTudo();
  }

  /**
   * O rotulo do botao ja' diz, por alto, o que vai sair da conta.
   *
   * A soma vem do que cada linha calculou na tela, nao do que esta' gravado: gravar so' acontece ao
   * sair do campo, e ate' la' o rodape mostraria um total que nao corresponde ao que se esta' vendo.
   * E' uma estimativa — o alvo real e' sorteado na hora da compra, sobre a mochila lida na hora.
   */
  function rotuloTudo() {
    const soma = [...painel.querySelectorAll('.item')].reduce(
      (total, bloco) => total + Number(bloco.dataset.falta || 0) * Number(bloco.dataset.preco || 0),
      0,
    );
    return soma ? `Comprar tudo · ~${moeda(soma)}` : 'Comprar tudo';
  }

  function somarPedido() {
    if (!comprandoTudo) tudo.textContent = rotuloTudo();
  }

  const MINHA_VEZ = 'loja-rapida';

  /**
   * Pede a vez e espera por ela, dizendo na tela por quem se espera.
   *
   * Sem este aviso, um painel que espera e' indistinguivel de um painel travado — e a venda pode
   * ficar parada cinco minutos enquanto o ginasio corre, que e' tempo de sobra para alguem achar
   * que a ferramenta quebrou.
   */
  const esperarAVez = async (dizer) => {
    const vez = globalThis.PPX?.vez;
    if (!vez?.pedir) return () => {}; // nucleo antigo: segue como antes, sem fila
    const dono = vez.dono();
    if (dono && dono.id !== MINHA_VEZ) dizer(`Esperando o ${vez.nome(dono.id)} terminar…`);
    return vez.pedir(MINHA_VEZ);
  };

  /** Uma passagem pela lista inteira. O botao e o relogio entram pela mesma porta. */
  async function rodarTudo() {
    comprandoTudo = true;
    ocupado(true);
    let soltar = null;
    try {
      soltar = await esperarAVez(mostrar);
      if (!soltar) return mostrar('Desisti: o jogo ficou ocupado tempo demais.', true);
      await comprarTudo(mostrar);
    } finally {
      if (soltar) soltar();
      comprandoTudo = false;
      parar = false;
      ocupado(false);
      somarPedido();
    }
  }

  tudo.addEventListener('click', () => {
    if (comprandoTudo) {
      parar = true;
      tudo.disabled = true;
      return;
    }
    void rodarTudo();
  });

  mochila.addEventListener('click', () => {
    mochila.disabled = true;
    void atualizarEstoque(mostrar).finally(() => {
      mochila.disabled = false;
    });
  });

  // Compra sozinha: desligada por padrao, e sempre pelo mesmo caminho do botao "Comprar tudo".
  const auto = painel.querySelector('[data-auto]');
  const campoMin = painel.querySelector('[data-min]');
  const campoMax = painel.querySelector('[data-max]');
  const campoHorarios = painel.querySelector('[data-horarios]');
  const campoModo = painel.querySelector('[data-modo]');
  const camposMinutos = painel.querySelector('[data-campos-minutos]');
  const campoProxima = painel.querySelector('[data-proxima]');
  // ---- a agenda, fechada ate' alguem querer configurar ---------------------
  //
  // Os controles ficam atras de um botao que mostra o que ja' ficou combinado. Configurar isto e'
  // coisa de poucas vezes por ano; **ver** o que foi combinado e' coisa de todo dia, e era so' isso
  // que o painel precisava de mostrar sempre.
  //
  // O campo de texto continua existindo, escondido dentro do editor: e' nele que o valor mora, e e'
  // por isso que toda a fiacao abaixo — gravar, validar, agendar — ficou como estava.
  const diasNaMarcacao = painel.querySelector('[data-dias]');
  const editorDias = globalThis.PPX?.agenda?.montarControles({
    resumoDe: (dias) =>
      globalThis.PPX.agenda.resumo({ dias, horarios: campoHorarios.value.trim() }),
  });
  const campoDias = editorDias ? editorDias.campo : diasNaMarcacao;
  if (editorDias) {
    // O modo, os minutos e os horarios mudam-se de casa para dentro do editor: a parte de
    // configurar abre e fecha inteira, em vez de meia dentro e meia fora.
    campoModo.parentElement.insertBefore(editorDias.el, campoModo);
    editorDias.corpo.prepend(
      campoModo,
      painel.querySelector('[data-campos-minutos]'),
      campoHorarios.parentElement,
    );
    diasNaMarcacao.remove();
  }
  let relogio = 0;
  let proxima = 0;
  /**
   * O motivo de nao haver nada marcado, quando nao ha'.
   *
   * Precisa de viver fora de `desenharAuto`, que roda de segundo em segundo: escrever a mensagem
   * direto no campo fazia ela durar **um segundo** e ser apagada pelo proximo desenho. O defeito
   * ja' existia antes do campo de dias — so' que com um campo so' era mais facil adivinhar o que
   * faltava, entao ninguem reparou.
   */
  let semAgenda = '';

  /**
   * A configuracao da compra sozinha.
   *
   * Chave propria, e nao a antiga `auto-mochila`: la' ficava a atualizacao automatica da mochila, e
   * quem a tivesse ligada passaria a comprar sozinho so' por atualizar a extensao. Dinheiro nao se
   * gasta por heranca de configuracao.
   */
  function configAuto() {
    const salvo = ler(CHAVE_AUTO_COMPRA, null) ?? {};
    const minimo = Number(salvo.min) || 60;
    const maximo = Number(salvo.max) || minimo;
    return {
      ligado: salvo.ligado === true,
      min: minimo,
      max: Math.max(minimo, maximo),
      horarios: String(salvo.horarios ?? ''),
      // Vazio quer dizer todo dia: e' como esta ferramenta sempre se comportou.
      dias: String(salvo.dias ?? ''),
      modo: salvo.modo === 'horarios' ? 'horarios' : 'minutos',
      ultima: Number(salvo.ultima) || 0,
    };
  }

  /**
   * Quanto falta, em ms, ate' o instante sorteado da proxima ocorrencia — ou `null` se nao ha'.
   *
   * A conta inteira mora em `agenda.js`, partilhada com a outra automacao e com o ginasio: as tres
   * tinham esta mesma logica copiada, e acrescentar "toda semana" e "todo mes" em tres copias seria
   * acrescentar o mesmo defeito em tres lugares. Ver o cabecalho de `agenda.js`.
   *
   * Sem o calendario — alguem com uma mistura de versoes do pacote —, o modo por horario simplesmente
   * nao agenda, em vez de agendar errado.
   */
  function esperaDaJanela(agora = new Date()) {
    const { horarios, dias, ultima } = configAuto();
    const calendario = globalThis.PPX?.agenda;
    if (!calendario) return null;
    return calendario.esperaDaAgenda({ horarios, dias }, ultima, agora);
  }

  /** A agenda esta' completa? Usado para marcar o campo, e nao para esconder o problema. */
  function agendaValida() {
    const { horarios, dias } = configAuto();
    const calendario = globalThis.PPX?.agenda;
    if (!calendario) return false;
    return calendario.valida({ modo: 'horarios', horarios, dias });
  }

  /** Mostra so' os campos do modo escolhido: dois conjuntos a' vista e' o que confundia. */
  function atualizarModo() {
    const porHorario = campoModo.value === 'horarios';
    camposMinutos.style.display = porHorario ? 'none' : '';
    campoHorarios.parentElement.style.display = porHorario ? '' : 'none';
    // "A cada tantos minutos" nao tem dia nenhum para escolher: deixar as listas a' vista ali seria
    // oferecer um controle que nao faz nada.
    editorDias?.usarDias(porHorario);
  }

  /** Cada ciclo sorteia o seu proprio tempo: um intervalo fixo e' o padrao mais obvio que existe. */
  function minutosSorteados() {
    const { min, max } = configAuto();
    return Math.max(1, min + Math.random() * (max - min));
  }

  /** O rotulo do botao e' o relogio: ligado, ele diz quanto falta para a proxima compra. */
  function desenharAuto() {
    const ligado = configAuto().ligado;
    auto.classList.toggle('parando', ligado);
    if (!ligado) {
      auto.textContent = 'Iniciar';
      campoProxima.textContent = semAgenda;
      return;
    }
    if (semAgenda) {
      auto.textContent = 'Parar';
      campoProxima.textContent = semAgenda;
      return;
    }
    if (!proxima) {
      auto.textContent = 'Parar · agora';
      campoProxima.textContent = 'em andamento';
      return;
    }
    const falta = Math.max(0, proxima - Date.now());
    const dois = (n) => String(n).padStart(2, '0');
    const DIA = 86400000;
    // A contagem sozinha nao responde "quando e' que isso acontece?". A hora por extenso responde,
    // e e' ela que mostra, no modo horario, que a rodada vai cair dentro da janela.
    const quando = new Date(proxima);
    const hora = `${dois(quando.getHours())}:${dois(quando.getMinutes())}`;
    // **A data entra quando deixa de ser obvia.** Com agenda semanal ou mensal, "proxima as 20:38"
    // sozinho e' quase uma pegadinha: a hora esta' certa e o dia pode ser daqui a tres semanas.
    const meiaNoite = new Date();
    meiaNoite.setHours(0, 0, 0, 0);
    const diasAte = Math.floor((quando - meiaNoite) / DIA);
    campoProxima.textContent =
      diasAte === 0
        ? `próxima às ${hora}`
        : diasAte === 1
          ? `amanhã às ${hora}`
          : `${dois(quando.getDate())}/${dois(quando.getMonth() + 1)} às ${hora}`;
    const horas = Math.floor(falta / 3600000);
    const mm = Math.floor((falta % 3600000) / 60000);
    const ss = Math.floor((falta % 60000) / 1000);
    // Com janelas de horario a espera passa facil de uma hora, e "115:14" nao se le' como tempo.
    // Com agenda semanal ou mensal passa de **centenas** de horas: "576:29:43" foi o que apareceu
    // na banca com "ultima sexta", e nao e' um relogio, e' um numero. Acima de um dia, conta-se em
    // dias — a precisao ao segundo nao serve para nada a essa distancia.
    const dias = Math.floor(falta / DIA);
    auto.textContent = dias
      ? `Parar · ${dias}d ${horas % 24}h`
      : horas
        ? `Parar · ${horas}:${dois(mm)}:${dois(ss)}`
        : `Parar · ${dois(mm)}:${dois(ss)}`;
  }

  function agendarCompra() {
    clearTimeout(relogio);
    // Os dois modos se separam aqui, e so' aqui: por minutagem o intervalo e' sorteado na faixa;
    // por horario e' sorteado dentro da proxima janela que ainda nao teve a sua rodada.
    const ms =
      configAuto().modo === 'horarios' ? esperaDaJanela() : minutosSorteados() * 60000;
    if (ms === null) {
      // Modo horario sem nenhuma janela legivel: nao da' para marcar nada, e dizer isso e' melhor
      // do que um ciclo ligado que nunca acontece.
      proxima = 0;
      // Dizer **o que** falta, e nao so' que falta: com dois campos, "nenhum horario valido" manda
      // a pessoa olhar para o campo errado metade das vezes.
      const { horarios, dias } = configAuto();
      const calendario = globalThis.PPX?.agenda;
      const sobrou = calendario?.diasNaoEntendidos(dias) || [];
      semAgenda = !calendario
        ? 'o calendário não carregou'
        : sobrou.length
          ? `não entendi "${sobrou[0]}" nos dias`
          : !calendario.janelasDe(horarios).length
            ? 'nenhum horário válido'
            : 'esses dias nunca chegam';
      desenharAuto();
      return;
    }
    semAgenda = '';
    proxima = Date.now() + ms;
    relogio = setTimeout(() => void rodadaAuto(), ms);
    desenharAuto();
  }

  /**
   * Uma rodada do relogio: compra o que falta e so' entao marca a proxima.
   *
   * A proxima e' marcada no fim, e nao junto com a largada, para duas compras nunca se cruzarem:
   * uma rodada que demore mais do que o intervalo empurra a seguinte em vez de disputar a loja.
   */
  async function rodadaAuto() {
    clearTimeout(relogio);
    proxima = 0;
    desenharAuto();
    // A janela fica marcada como usada antes de agir: se a rodada demorar e terminar ja' fora
    // dela, ainda assim foi a rodada daquela janela, e a proxima tem de ser a seguinte.
    gravar(CHAVE_AUTO_COMPRA, { ...ler(CHAVE_AUTO_COMPRA, {}), ultima: Date.now() });
    // Uma compra pedida a mao tem a vez: esta rodada cede e volta no proximo intervalo.
    if (!emCompra) await rodarTudo();
    if (configAuto().ligado) agendarCompra();
  }

  const salvarAuto = (ligado) => {
    const limite = (campo, padrao) => Math.min(1440, Math.max(1, Number(campo.value) || padrao));
    const minimo = limite(campoMin, 60);
    const maximo = Math.max(minimo, limite(campoMax, minimo));
    campoMin.value = minimo;
    campoMax.value = maximo;
    // O maximo nunca fica abaixo do minimo, senao a faixa nao existe.
    const horarios = campoHorarios.value.trim();
    const dias = campoDias.value.trim();
    gravar(CHAVE_AUTO_COMPRA, {
      ...ler(CHAVE_AUTO_COMPRA, {}),
      ligado,
      min: minimo,
      max: maximo,
      horarios,
      dias,
      modo: campoModo.value,
    });
    atualizarModo();
    // Texto que nao vira janela nenhuma fica marcado: aceitar em silencio faria o ciclo
    // ficar parado para sempre sem ninguem entender por que.
    const calendario = globalThis.PPX?.agenda;
    campoHorarios.classList.toggle(
      'erro',
      Boolean(horarios) && !(calendario?.janelasDe(horarios).length > 0),
    );
    // E o campo de dias tem o seu proprio aviso. Um pedaco que nao se entendeu nao pode ser
    // ignorado: "ultima quarta" com um engano viraria uma automacao sem dia nenhum marcado.
    const sobrou = calendario?.diasNaoEntendidos(dias) || [];
    campoDias.classList.toggle('erro', sobrou.length > 0);
    // Com as listas isto nao acontece — elas so' escrevem o que o calendario entende. O aviso fica
    // de pe' para quem tem o campo de texto antigo, e para o dia em que uma lista nova errar.
    campoDias.title = sobrou.length
      ? `Não entendi: ${sobrou.join(', ')}. ${calendario.DICA_DIAS}`
      : calendario?.DICA_DIAS || '';
    // O resumo no botao fechado tem de acompanhar o horario tambem, e nao so' os dias.
    editorDias?.resumir();
  };

  auto.addEventListener('click', () => {
    const ligar = !configAuto().ligado;
    salvarAuto(ligar);
    // **Nao se liga um relogio que nunca vai disparar.** Com a agenda incompleta ou com um
    // pedaco que nao se entendeu, ligar deixaria o botao dizendo "Parar" para sempre, sem
    // nada acontecer — e a pessoa so' descobriria no dia em que fosse conferir.
    if (ligar && configAuto().modo === 'horarios' && !agendaValida()) {
      salvarAuto(false);
      // Quem escreve a mensagem e' o proprio agendamento, que descobre o motivo. Redesenhar aqui
      // por cima dela era o que a apagava.
      agendarCompra();
      return;
    }
    if (ligar) {
      // Por minutagem, comecar e' comprar: a primeira rodada sai agora. Por horario nao — a graca do
      // modo e' a rodada cair dentro da janela, entao aqui so' se marca a proxima.
      if (configAuto().modo === 'horarios') agendarCompra();
      else void rodadaAuto();
      return;
    }
    clearTimeout(relogio);
    proxima = 0;
    // Parar e' parar tambem o que esta' em andamento; a compra do item corrente ainda termina.
    if (emCompra) parar = true;
    desenharAuto();
  });

  const mudouFaixa = () => {
    salvarAuto(configAuto().ligado);
    // Mudar a faixa com o relogio correndo vale para ja': o tempo que faltava era da faixa antiga.
    if (configAuto().ligado && proxima) agendarCompra();
  };
  campoModo.addEventListener('change', mudouFaixa);
  campoHorarios.addEventListener('change', mudouFaixa);
  campoDias.addEventListener('change', mudouFaixa);
  campoMin.addEventListener('change', mudouFaixa);
  campoMax.addEventListener('change', mudouFaixa);

  // Aqui, e nao junto do resto da partida: isto le' os campos, que so' existem acima.
  campoModo.value = configAuto().modo;
  atualizarModo();
  campoHorarios.value = configAuto().horarios;
  if (editorDias) editorDias.escrever(configAuto().dias);
  else campoDias.value = configAuto().dias;
  campoMin.value = configAuto().min;
  campoMax.value = configAuto().max;
  // Recarregar a pagina nao e' pedir uma compra: a compra sozinha que estava ligada volta a contar
  // o tempo, mas a primeira rodada espera o intervalo em vez de sair no ato de abrir o jogo.
  if (configAuto().ligado) agendarCompra();
  else desenharAuto();
  setInterval(desenharAuto, 1000);

  const confirma = painel.querySelector('[data-confirma]');
  confirma.checked = ler(CHAVE_CONFIRMA, true);
  confirma.addEventListener('change', () => gravar(CHAVE_CONFIRMA, confirma.checked));

  const variacao = painel.querySelector('[data-variacao]');
  variacao.value = String(variacaoPct());
  variacao.title =
    'Margem com que o alvo e sorteado a cada compra: com 3%, um alvo de 78.000 vira algo ' +
    'entre 75.660 e 80.340. Zero compra exatamente ate o alvo.';
  variacao.addEventListener('change', () => {
    const valor = Math.min(50, Math.max(0, Math.round(Number(variacao.value) || 0)));
    variacao.value = String(valor);
    gravar(CHAVE_VARIACAO, valor);
  });

  // ---- levar esta configuracao para outra conta ----------------------------
  //
  // Igual a' venda, e pelo mesmo motivo: varias janelas do LionMultInstance, um armazenamento em
  // cada uma. O que vai no arquivo sao os alvos por item e a automacao; o catalogo, o estoque e o
  // saldo ficam de fora — sao o retrato do jogo **desta** conta, e levar o retrato de uma para a
  // outra seria mostrar numeros que nao sao dela. A proxima atualizacao da mochila os refaz.

  /** Poe' os campos e a lista de acordo com o que esta' guardado. Usado depois de importar. */
  const recarregarDaConfig = () => {
    confirma.checked = ler(CHAVE_CONFIRMA, true);
    variacao.value = String(variacaoPct());
    campoModo.value = configAuto().modo;
    campoHorarios.value = configAuto().horarios;
    if (editorDias) editorDias.escrever(configAuto().dias);
    else campoDias.value = configAuto().dias;
    campoMin.value = configAuto().min;
    campoMax.value = configAuto().max;
    atualizarModo();
    desenhar();
    // O relogio tem de passar a contar pela agenda nova, e nao pela que estava em memoria.
    clearTimeout(relogio);
    proxima = 0;
    semAgenda = '';
    if (configAuto().ligado) agendarCompra();
    else desenharAuto();
  };

  const entre = (valor, menor, maior, padrao) =>
    Math.min(maior, Math.max(menor, Math.round(Number(valor)) || padrao));

  const botoesConfig = globalThis.PPX?.config?.montarBotoes({
    id: 'loja-rapida',
    nome: 'Loja rápida',
    coletar: () => {
      // `ultima` fica de fora de proposito: importar o carimbo de outra conta faria a janela de
      // hoje passar por ja' usada, e a compra de hoje nao aconteceria.
      const { ultima, ...automatico } = configAuto();
      void ultima;
      return {
        alvos: ler(CHAVE_QTD, {}),
        confirmar: ler(CHAVE_CONFIRMA, true),
        variacao: variacaoPct(),
        automatico,
      };
    },
    aplicar: (dados) => {
      // Importar no meio de uma compra trocaria os alvos com a compra ja' a correr por eles.
      if (emCompra || comprandoTudo)
        throw new Error('não dá para importar no meio de uma compra — pare primeiro');
      // Os alvos vem de fora: so' entra nome com numero, e numero inteiro que nao seja negativo.
      if (dados.alvos && typeof dados.alvos === 'object' && !Array.isArray(dados.alvos)) {
        const limpos = {};
        for (const [nome, valor] of Object.entries(dados.alvos)) {
          const alvo = Math.round(Number(valor));
          if (Number.isFinite(alvo) && alvo >= 0) limpos[nome] = alvo;
        }
        gravar(CHAVE_QTD, limpos);
      }
      if (dados.confirmar !== undefined) gravar(CHAVE_CONFIRMA, dados.confirmar === true);
      if (dados.variacao !== undefined)
        gravar(CHAVE_VARIACAO, Math.min(50, Math.max(0, Math.round(Number(dados.variacao)) || 0)));
      const auto = dados.automatico;
      if (auto && typeof auto === 'object') {
        const minimo = entre(auto.min, 1, 1440, 60);
        gravar(CHAVE_AUTO_COMPRA, {
          // O carimbo e' desta conta e fica onde estava.
          ...ler(CHAVE_AUTO_COMPRA, {}),
          ligado: auto.ligado === true,
          min: minimo,
          max: Math.max(minimo, entre(auto.max, 1, 1440, minimo)),
          horarios: String(auto.horarios ?? ''),
          dias: String(auto.dias ?? ''),
          modo: auto.modo === 'horarios' ? 'horarios' : 'minutos',
        });
      }
      recarregarDaConfig();
      const quantos = Object.values(ler(CHAVE_QTD, {})).filter((n) => n > 0).length;
      return `Configuração importada: ${quantos} ${quantos === 1 ? 'item com alvo' : 'itens com alvo'}.`;
    },
    avisar: (frase) => mostrar(frase),
  });
  if (botoesConfig) painel.querySelector('.rodape').append(botoesConfig.el);

  // Desenhar por ultimo: a lista le' `tudo` e `ocupado`, que so' existem depois da fiacao acima.
  desenhar();
  desenharSaldo();
  ocupado(false);

  // O × e' esconder, igual ao atalho: fica gravado, atravessa o F5 e o menu do pacote passa a
  // mostrar a ferramenta como oculta. Antes ele so' apagava o painel da tela — na carga seguinte
  // ele voltava sozinho, e enquanto isso o menu continuava a dizer que estava a' vista.
  painel.querySelector('[data-fechar]').addEventListener('click', () => {
    mostrarPainel(false);
    globalThis.PPX?.anotar?.('loja-rapida', false);
  });

  /**
   * Dois atalhos, nao um que alterna.
   *
   * Com um unico atalho nunca se sabe em que estado o painel esta' sem olhar, e quem aperta duas
   * vezes volta ao comeco. Alt+C esconde, Alt+V mostra — teclas vizinhas, como nas outras
   * extensoes —, e apertar o mesmo de novo nao desfaz nada.
   */
  /** Esconder tem de atravessar o F5: e' uma escolha da pessoa, nao um estado de tela. */
  const mostrarPainel = (sim) => {
    painel.style.display = sim ? '' : 'none';
    // So' agora ele tem medidas: se a janela mudou de tamanho enquanto estava escondido, e' aqui
    // que ele volta ao canto certo.
    if (sim) recolocar();
  };
  addEventListener('keydown', (evento) => {
    if (!evento.altKey || evento.ctrlKey) return;
    if (evento.code === 'KeyC') {
      evento.preventDefault();
      mostrarPainel(false);
      globalThis.PPX?.anotar?.('loja-rapida', false);
    } else if (evento.code === 'KeyV') {
      evento.preventDefault();
      mostrarPainel(true);
      globalThis.PPX?.anotar?.('loja-rapida', true);
    }
  });
  // Dentro do pacote quem manda e' o menu; sozinha, a extensao abre a vista como sempre abriu.
  if (globalThis.PPX) {
    globalThis.PPX.controlar?.('loja-rapida', mostrarPainel);
    mostrarPainel(globalThis.PPX.visivel?.('loja-rapida') !== false);
  }

  // A loja pode abrir por fora daqui: observar o DOM mantem o catalogo em dia sozinho.
  new MutationObserver(() => {
    if (!lojaAberta()) return;
    const antes = JSON.stringify(ler(CHAVE_CATALOGO, []));
    lembrarCatalogo();
    if (JSON.stringify(ler(CHAVE_CATALOGO, [])) !== antes) desenhar();
    if (anotarSaldo()) {
      desenharSaldo();
      desenhar();
    }
  }).observe(document.body, { childList: true, subtree: true });

  // Inventario aberto por voce tambem conta: o painel aproveita e anota, sem abrir nada sozinho.
  new MutationObserver(() => {
    const antes = JSON.stringify(ler(CHAVE_ESTOQUE, {}).itens ?? {});
    if (anotarEstoque() && JSON.stringify(ler(CHAVE_ESTOQUE, {}).itens) !== antes) desenhar();
  }).observe(document.body, { childList: true, subtree: true });
});
