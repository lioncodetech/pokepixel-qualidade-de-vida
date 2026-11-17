// Cassino: compra Eevees em lote, até a quantidade pedida, e para quando o dinheiro acaba.
//
// A TELA, medida na conta do dono em 17/11/2026 — comprando de verdade, não lendo código. O
// Cassino vende uma "Eevee misteriosa" por 250.000 dólares, com a raridade sorteada na hora. O
// seletor aceita **1 a 10 por compra**, então 25 Eevees são três compras: 10, 10 e 5.
//
// O CICLO INTEIRO, com os três enganos que ele esconde:
//
//   1. **O jogo pede confirmação.** Clicar em COMPRAR EEVEE não compra: abre uma caixa dizendo
//      "Comprar 10 Eevee misteriosas por 2.500.000 dólares?". Sem tratar isso, a ferramenta fica
//      parada à espera de um sorteio que nunca vem — foi exatamente o que aconteceu no primeiro
//      teste.
//   2. **FECHAR fecha o Cassino inteiro**, não o sorteio: a janela sai do DOM e só o NPC a traz
//      de volta. É a porta errada para continuar comprando.
//   3. **COMPRAR NOVAMENTE não cobra.** Apesar do nome, ele volta à tela de escolha com a última
//      quantidade ainda selecionada. É a porta certa, e é de graça — medido: o saldo não mexeu.
//
// A CONFIRMAÇÃO É ONDE MORA A PROTEÇÃO DO DINHEIRO. Só se confirma uma caixa cuja quantidade
// escrita bate com a que este clique pediu. Uma caixa que diga 10 quando se pediu 5 é cancelada e
// a ferramenta para: ou a tela mudou por baixo, ou há outra coisa a comprar ali — e nos dois casos
// confirmar seria gastar o que não foi pedido.
//
// A CONTAGEM VEM DO SALDO, NÃO DO OTIMISMO. Cada rodada lê o saldo antes e depois e conta pelo que
// foi gasto de verdade. Um clique que não cobrou não vira Eevee comprado numa planilha imaginária
// — e é também assim que "ficou sem dinheiro" se descobre sem precisar tentar e falhar.
//
// O QUE ELA NUNCA TOCA. A loja de diamantes mora escondida no mesmo DOM, com botões cujo texto
// também é "Comprar" (`premium-product__buy`). Por isso aqui nada é procurado por texto solto na
// página nem por posição na tela: tudo é procurado **dentro de `.npc-casino-window`**, pela classe
// própria do Cassino. E a máquina de apostas continua proibida, como em todo este repositório.
PPX.modulo(
  { id: 'cassino', nome: 'Cassino', atalhos: 'configuração pelo menu (Alt+Q)' },
  () => {
    'use strict';

    const CHAVE = 'lioncode:cassino:config';
    const CHAVE_POS = 'lioncode:cassino:posicao';
    const CHAVE_MIN = 'lioncode:cassino:minimizado';
    const MINHA_VEZ = 'cassino';

    /** O teto do seletor do jogo. Não é escolha nossa: ele só oferece de 1 a 10. */
    const LOTE = 10;
    /** Entre uma compra e a seguinte: o mesmo respiro sorteado das outras ferramentas. */
    const MIN_MS = 2000;
    const MAX_MS = 5000;
    /** Pedir mais do que isto de uma vez é quase sempre um dígito a mais, e aqui o dígito custa. */
    const TETO_PEDIDO = 500;

    const JANELA = '.npc-casino-window';
    const SELETOR = '.npc-casino-quantity__select';
    const BOTAO_COMPRAR = '.npc-casino-buy';
    const SALDO = '.npc-casino-balance .pokeidle-currency__amount';
    const PRECO = '.npc-casino-price';
    const SORTEIO = '.npc-casino-results--reveal';
    const ACOES = '.npc-casino-results__actions';
    const DIALOGO = '.pokeidle-dialog-overlay';

    const PADRAO = { quantos: 10 };

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
    const cfg = { ...PADRAO, ...(ler(CHAVE, null) || {}) };
    const gravar = () => gravarChave(CHAVE, cfg);

    const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
    const ate = async (fn, limite) => {
      const fim = Date.now() + limite;
      for (;;) {
        if (fn()) return true;
        if (Date.now() >= fim) return false;
        await espera(150);
      }
    };
    const respiro = () => Math.round(MIN_MS + Math.random() * (MAX_MS - MIN_MS));

    const esperarAVez = async (avisar) => {
      const vez = globalThis.PPX?.vez;
      if (!vez?.pedir) return () => {};
      const dono = vez.dono();
      if (dono && dono.id !== MINHA_VEZ) avisar(`Esperando o ${vez.nome(dono.id)} terminar…`);
      return vez.pedir(MINHA_VEZ);
    };

    // ------------------------------------------------------- leitura da tela

    /** "12.997.726" vira 12997726. O jogo escreve com ponto de milhar. */
    const numero = (texto) => Number(String(texto ?? '').replace(/\D/g, '')) || 0;

    /**
     * Aberta mesmo, não só presente no DOM.
     *
     * Mesma lição da mochila na Loja rápida: o jogo deixa janelas fechadas no DOM, e testar a
     * existência dá "já está aberto" com a tela vazia.
     */
    const janela = () => {
      const j = document.querySelector(JANELA);
      return j && j.getBoundingClientRect().width > 0 ? j : null;
    };

    const dentro = (seletor) => janela()?.querySelector(seletor) ?? null;
    const naEscolha = () => Boolean(dentro(SELETOR));
    const noSorteio = () => Boolean(dentro(SORTEIO));
    const saldoAgora = () => numero(dentro(SALDO)?.textContent);

    /**
     * O preço de **um** Eevee.
     *
     * A linha do preço é "10x DE 250.000 dólares" com o total ao lado. O que se quer aqui é o
     * unitário, e ele está no texto, não no total — medido com 10 selecionados: o texto continua
     * dizendo 250.000 e o total passa a 2.500.000. Usar o total faria a conta de quantos cabem no
     * saldo encolher dez vezes.
     */
    const precoUnitario = () => {
      const texto = dentro(PRECO)?.textContent ?? '';
      const achado = /x\s*DE\s*([\d.,]+)/i.exec(texto);
      return achado ? numero(achado[1]) : 0;
    };

    /**
     * Um botão do Cassino, pelo texto exato, e **só** dentro da caixa de ações do sorteio.
     *
     * Nunca por texto solto na página: "Comprar" também é o texto dos botões da loja de diamantes,
     * que mora escondida no mesmo DOM.
     */
    const botaoDoSorteio = (rotulo) => {
      const caixa = dentro(ACOES);
      if (!caixa) return null;
      return (
        [...caixa.querySelectorAll('button')].find(
          (b) => (b.textContent || '').trim().toUpperCase() === rotulo,
        ) ?? null
      );
    };

    /** O "Conversar" do NPC do Cassino, que é a única porta de entrada da janela. */
    const npcDoCassino = () =>
      [...document.querySelectorAll('button')].find((b) => {
        const t = (b.textContent || '').trim();
        return t.includes('Cassino') && t.includes('Conversar');
      }) ?? null;

    /**
     * O seletor é controlado pelo jogo: mudar `.value` direto não avisa ninguém e o clique seguinte
     * compraria a quantidade antiga. O setter nativo mais os eventos é o que o jogo escuta.
     */
    const escolherQuantidade = (quantos) => {
      const sel = dentro(SELETOR);
      if (!sel) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      setter.call(sel, String(quantos));
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return sel.value === String(quantos);
    };

    // ------------------------------------------------------- a confirmação

    /** A caixa "Comprar N Eevee misteriosas por X dólares?", se estiver na tela. */
    const caixaDeConfirmacao = () => {
      const candidatos = [...document.querySelectorAll(DIALOGO)].filter((e) => {
        if (!e.getBoundingClientRect().width) return false;
        if (!/Comprar\s+\d+\s+Eevee/i.test(e.textContent || '')) return false;
        const textos = [...e.querySelectorAll('button')].map((b) => (b.textContent || '').trim());
        return textos.includes('Comprar') && textos.includes('Cancelar');
      });
      // Entre candidatos aninhados vence o menor: o maior conteria a tela toda.
      candidatos.sort((a, b) => a.textContent.length - b.textContent.length);
      return candidatos[0] ?? null;
    };

    /** Quantos Eevees a caixa diz que vai comprar. */
    const quantidadeNaCaixa = (caixa) =>
      Number(/Comprar\s+(\d+)\s+Eevee/i.exec(caixa.textContent || '')?.[1] ?? 0);

    const clicarNaCaixa = (caixa, rotulo) => {
      const botao = [...caixa.querySelectorAll('button')].find(
        (b) => (b.textContent || '').trim() === rotulo,
      );
      if (botao) botao.click();
      return Boolean(botao);
    };

    /**
     * Confirma a compra — e só a que foi pedida.
     *
     * Esta é a última porta antes de o dinheiro sair, e por isso ela desconfia: a quantidade
     * escrita na caixa tem de bater com a deste clique. Se não bater, cancela. Confirmar uma caixa
     * que diz outra coisa seria assinar um cheque sem ler, e aqui cada unidade são 250.000.
     */
    const confirmar = async (quantidade) => {
      if (!(await ate(() => caixaDeConfirmacao(), 8000)))
        return { ok: false, motivo: 'a confirmação do jogo não apareceu' };
      const caixa = caixaDeConfirmacao();
      const diz = quantidadeNaCaixa(caixa);
      if (diz !== quantidade) {
        clicarNaCaixa(caixa, 'Cancelar');
        return { ok: false, motivo: `a confirmação dizia ${diz}, e eu pedi ${quantidade}` };
      }
      if (!clicarNaCaixa(caixa, 'Comprar'))
        return { ok: false, motivo: 'não achei o botão Comprar' };
      return { ok: true, motivo: '' };
    };

    // ------------------------------------------------------------- a decisão

    /**
     * Quanto comprar nesta rodada.
     *
     * Pura de propósito: é a conta que decide gastar dinheiro, e é a única parte desta ferramenta
     * que dá para exercitar sem o jogo na frente.
     */
    const planoDeCompra = ({ faltam, saldo, preco, lote = LOTE }) => {
      if (!(preco > 0)) return { quantidade: 0, motivo: 'preco' };
      if (faltam < 1) return { quantidade: 0, motivo: 'completo' };
      const cabem = Math.floor(saldo / preco);
      if (cabem < 1) return { quantidade: 0, motivo: 'sem-dinheiro' };
      return { quantidade: Math.min(lote, faltam, cabem), motivo: '' };
    };

    // --------------------------------------------------------------- painel

    const painel = document.createElement('div');
    painel.id = 'lioncode-cassino';
    painel.innerHTML = `
      <header>
        <strong data-titulo>Cassino</strong>
        <button type="button" data-minimizar title="Minimizar">–</button>
        <button type="button" data-fechar title="Esconder">×</button>
      </header>
      <div class="corpo">
        <label class="campo">
          Eevees
          <input type="number" min="1" max="${TETO_PEDIDO}" step="1" data-quantos>
        </label>
        <div class="quadro" data-conta>Abra o Cassino para ver o preço.</div>
        <div class="botoes">
          <button type="button" data-comprar>Comprar</button>
          <button type="button" data-parar disabled>Parar</button>
        </div>
        <div data-config></div>
      </div>
      <p class="estado" data-estado>—</p>`;

    const estilo = document.createElement('style');
    estilo.textContent = `
      #lioncode-cassino,#lioncode-cassino *{box-sizing:border-box}
      #lioncode-cassino{position:fixed;z-index:2147483000;width:238px;background:var(--ppx-fundo);color:var(--ppx-texto);border:1px solid var(--ppx-borda);border-radius:var(--ppx-raio);font:var(--ppx-fonte);box-shadow:var(--ppx-sombra);max-height:var(--ppx-teto);overflow:auto;scrollbar-width:thin;scrollbar-color:var(--ppx-borda) transparent}
      #lioncode-cassino header{display:flex;gap:8px;align-items:center;padding:8px 10px;border-bottom:1px solid #2a3244;cursor:move}
      #lioncode-cassino header strong{flex:1;font-size:13px}
      #lioncode-cassino header button{border:0;background:none;color:#8b97a8;font-size:16px;cursor:pointer;padding:0 2px}
      #lioncode-cassino .corpo{display:grid;gap:8px;padding:10px}
      #lioncode-cassino.minimizado .corpo{display:none}
      #lioncode-cassino .campo{display:flex;align-items:center;gap:6px;color:#c3ccda;font-size:12px}
      #lioncode-cassino input{flex:1;min-width:0;border:1px solid #2a3244;border-radius:6px;background:#182030;color:#e7edf6;padding:5px}
      #lioncode-cassino .quadro{border:1px solid #2a3244;border-radius:6px;padding:7px;font-size:12px;color:#c3ccda;display:grid;gap:3px}
      #lioncode-cassino .quadro b{color:#e7edf6}
      #lioncode-cassino .quadro .mau{color:#f0a0a0}
      #lioncode-cassino .botoes{display:flex;gap:6px}
      #lioncode-cassino .botoes button{flex:1;cursor:pointer;border:1px solid #2a3244;border-radius:6px;background:#182030;color:#e7edf6;padding:6px}
      #lioncode-cassino .botoes button:disabled{opacity:.45;cursor:default}
      #lioncode-cassino .estado{margin:0;font-size:12px;color:#8b97a8;padding:0 10px 10px}
      #lioncode-cassino .estado.mau{color:#f85149}`;

    const campo = (seletor) => painel.querySelector(seletor);
    const dizer = (texto, mau = false) => {
      const linha = campo('[data-estado]');
      linha.textContent = texto;
      linha.classList.toggle('mau', mau === true);
    };

    let correndo = false;
    let parar = false;
    /** O último preço lido na tela de escolha: no sorteio a linha do preço não existe. */
    let ultimoPreco = 0;

    const desenhar = () => {
      // **Nunca enquanto o dono está digitando.** Este painel redesenha-se sozinho de dois em dois
      // segundos, e o campo é guardado só ao sair dele: reescrevê-lo no meio da digitação apagava
      // o que estava a ser escrito, e um "25" voltava a 10 antes de chegar ao fim. Relatado em
      // 17/11/2026, e era isto.
      const entrada = campo('[data-quantos]');
      if (document.activeElement !== entrada) entrada.value = cfg.quantos;
      campo('[data-comprar]').disabled = correndo;
      campo('[data-parar]').disabled = !correndo;
      const quadro = campo('[data-conta]');
      if (!janela()) {
        quadro.innerHTML = 'Abra o Cassino no jogo para começar.';
        return;
      }
      const preco = precoUnitario() || ultimoPreco;
      if (!preco) {
        quadro.innerHTML = 'Preço não lido — volte à tela de escolha do Cassino.';
        return;
      }
      const saldo = saldoAgora();
      const cabem = Math.floor(saldo / preco);
      const custo = cfg.quantos * preco;
      quadro.innerHTML =
        `<div>Preço: <b>${preco.toLocaleString('pt-BR')}</b> cada</div>` +
        `<div>Saldo: <b>${saldo.toLocaleString('pt-BR')}</b></div>` +
        `<div${custo > saldo ? ' class="mau"' : ''}>Custo de ${cfg.quantos}: ` +
        `<b>${custo.toLocaleString('pt-BR')}</b></div>` +
        `<div>Cabem no saldo: <b>${cabem}</b></div>`;
    };

    // ----------------------------------------------------------- as rodadas

    /**
     * Põe a janela na tela de escolha, que é a única onde se escolhe quantidade.
     *
     * Do sorteio sai-se pelo COMPRAR NOVAMENTE, que apesar do nome **não cobra**: ele devolve a
     * tela de escolha com a última quantidade posta. O FECHAR é o caminho errado — leva o Cassino
     * inteiro embora —, e por isso só se recorre ao NPC quando já não há janela nenhuma.
     */
    const voltarParaEscolha = async () => {
      if (naEscolha()) return true;
      if (noSorteio()) {
        const outra = botaoDoSorteio('COMPRAR NOVAMENTE');
        if (outra) {
          outra.click();
          if (await ate(() => naEscolha(), 6000)) return true;
        }
      }
      if (!janela()) {
        const npc = npcDoCassino();
        if (!npc) return false;
        npc.click();
        return ate(() => naEscolha(), 6000);
      }
      return naEscolha();
    };

    const comprar = async () => {
      if (correndo) return;
      const alvo = Math.max(1, Math.min(TETO_PEDIDO, Math.round(Number(cfg.quantos) || 0)));
      correndo = true;
      parar = false;
      desenhar();
      let soltar = null;
      let comprados = 0;
      let gastoTotal = 0;
      const parei = (porque, mau = true) => {
        dizer(`Parei em ${comprados} de ${alvo}: ${porque}`, mau);
      };
      try {
        soltar = await esperarAVez(dizer);
        if (!soltar) return dizer('Desisti: o jogo ficou ocupado tempo demais.', true);

        while (comprados < alvo && !parar) {
          if (!(await voltarParaEscolha())) {
            parei('não consegui chegar à tela de escolha do Cassino. Abra-o pelo NPC.');
            break;
          }
          ultimoPreco = precoUnitario() || ultimoPreco;
          const plano = planoDeCompra({
            faltam: alvo - comprados,
            saldo: saldoAgora(),
            preco: ultimoPreco,
          });
          if (plano.motivo === 'preco') {
            parei('não consegui ler o preço.');
            break;
          }
          if (plano.motivo === 'sem-dinheiro') {
            parei('o saldo não dá para mais um Eevee.', false);
            break;
          }
          if (plano.quantidade < 1) break;

          if (!escolherQuantidade(plano.quantidade)) {
            parei('o seletor não aceitou a quantidade.');
            break;
          }
          const botao = dentro(BOTAO_COMPRAR);
          if (!botao) {
            parei('não achei o botão de comprar.');
            break;
          }
          const antes = saldoAgora();
          dizer(`Comprando ${plano.quantidade}… (${comprados}/${alvo})`);
          botao.click();

          const feito = await confirmar(plano.quantidade);
          if (!feito.ok) {
            parei(feito.motivo);
            break;
          }
          if (!(await ate(() => noSorteio(), 20000))) {
            parei('o sorteio não apareceu.');
            break;
          }
          // O saldo é quem conta. Um clique que não cobrou não vira Eevee comprado.
          await ate(() => saldoAgora() !== antes, 5000);
          const gasto = antes - saldoAgora();
          if (gasto <= 0) {
            parei('o saldo não mudou, então nada foi cobrado.');
            break;
          }
          comprados += Math.max(1, Math.round(gasto / ultimoPreco));
          gastoTotal += gasto;
          desenhar();
          if (comprados < alvo && !parar) await espera(respiro());
        }

        if (comprados >= alvo)
          dizer(`Pronto: ${comprados} Eevees por ${gastoTotal.toLocaleString('pt-BR')}.`);
        else if (parar)
          dizer(
            `Parado por você em ${comprados}, com ${gastoTotal.toLocaleString('pt-BR')} gastos.`,
          );
      } finally {
        if (soltar) soltar();
        correndo = false;
        desenhar();
      }
    };

    // -------------------------------------------------------------- ouvintes

    /**
     * O que foi digitado, preso aos limites. Vazio e lixo valem 1, e nunca passa do teto.
     */
    const lerCampo = (valor) =>
      Math.max(1, Math.min(TETO_PEDIDO, Math.round(Number(valor) || 0) || 1));

    // `input` acompanha a digitação para o custo na tela ser o do número que está no campo; o
    // `change` é quem fecha a conta ao sair, e é ele que põe o valor de volta se foi escrito algo
    // impossível. Separar os dois é o que permite escrever "25" sem o "2" já virar outra coisa.
    campo('[data-quantos]').addEventListener('input', (e) => {
      if (e.target.value === '') return;
      cfg.quantos = lerCampo(e.target.value);
      gravar();
      desenhar();
    });
    campo('[data-quantos]').addEventListener('change', (e) => {
      cfg.quantos = lerCampo(e.target.value);
      gravar();
      e.target.value = cfg.quantos;
      desenhar();
    });
    campo('[data-comprar]').addEventListener('click', () => void comprar());
    campo('[data-parar]').addEventListener('click', () => {
      parar = true;
      dizer('Vou parar depois desta compra.');
    });

    const botoes = globalThis.PPX?.config?.montarBotoes({
      id: 'cassino',
      nome: 'Cassino',
      // Só a quantidade viaja. Saldo e preço são o retrato desta conta, e um retrato alheio na
      // tela é um número que não é de ninguém.
      coletar: () => ({ quantos: cfg.quantos }),
      aplicar: (dados) => {
        if (correndo) throw new Error('espere a compra terminar antes de importar');
        const n = Math.round(Number(dados?.quantos) || 0);
        if (n >= 1 && n <= TETO_PEDIDO) {
          cfg.quantos = n;
          gravar();
          desenhar();
        }
      },
      avisar: dizer,
    });
    if (botoes) campo('[data-config]').append(botoes.el);

    // --------------------------------------------------------- janela e lugar

    let minimizado = ler(CHAVE_MIN, false) === true;
    const recolocar = () => {
      if (globalThis.PPX?.canto?.aplicar(painel, ler(CHAVE_POS, null))) return;
      painel.style.left = '16px';
      painel.style.top = '16px';
      painel.style.right = 'auto';
      painel.style.bottom = 'auto';
    };
    const desenharJanela = () => {
      painel.classList.toggle('minimizado', minimizado);
      campo('[data-minimizar]').textContent = minimizado ? '□' : '–';
      recolocar();
    };
    campo('[data-minimizar]').addEventListener('click', () => {
      minimizado = !minimizado;
      gravarChave(CHAVE_MIN, minimizado);
      desenharJanela();
    });
    campo('[data-fechar]').addEventListener('click', () => {
      if (correndo) parar = true;
      mostrar(false);
      globalThis.PPX?.anotar?.('cassino', false);
    });
    let arrasto = null;
    painel.querySelector('header').addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      const r = painel.getBoundingClientRect();
      arrasto = { x: e.clientX - r.left, y: e.clientY - r.top };
    });
    addEventListener('pointermove', (e) => {
      if (!arrasto) return;
      painel.style.left = `${e.clientX - arrasto.x}px`;
      painel.style.top = `${e.clientY - arrasto.y}px`;
    });
    addEventListener('pointerup', () => {
      if (!arrasto) return;
      arrasto = null;
      const p = globalThis.PPX?.canto?.medir(painel);
      if (p) gravarChave(CHAVE_POS, p);
    });
    addEventListener('resize', recolocar);

    const mostrar = (sim) => {
      painel.style.display = sim ? 'block' : 'none';
    };

    document.documentElement.append(estilo, painel);
    desenhar();
    desenharJanela();
    globalThis.PPX?.controlar?.('cassino', mostrar);
    mostrar(globalThis.PPX?.visivel?.('cassino') !== false);
    // O preço e o saldo só existem com o Cassino aberto; redesenhar de tempos em tempos é o que
    // faz o painel deixar de mentir assim que a janela do jogo abre.
    setInterval(() => {
      if (!correndo) desenhar();
    }, 2000);
  },
);
