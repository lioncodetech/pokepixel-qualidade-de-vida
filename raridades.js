// A lista de raridades: todos os seus Pokemon, com o numero da raridade, em uma tela so'.
//
// POR QUE ELA NAO CLICA EM NADA. Na tela, o numero da raridade (x1,45) so' aparece abrindo um
// Pokemon de cada vez. Varrer mochila e deposito a cliques seriam 117 aberturas no caso medido —
// lento, barulhento e fragil. Mas o jogo publica a propria API em `window.PokeIdle`, e `getCreatures`
// devolve a colecao inteira de uma vez, com `quality_multiplier` em cada registro.
//
// O PEDAGO QUE FALTA e' que `PokeIdle` vive no mundo da pagina, e um content script comum nao o
// alcanca. Por isso esta ferramenta tem duas metades: `raridades-main.js` entra com `world: "MAIN"`
// e so' responde pedidos; esta aqui desenha o painel e nunca toca no jogo. As duas conversam por
// evento de DOM, que e' o unico canal que os dois mundos partilham.
//
// MEDIDO NA CONTA REAL (06/10/2026): 117 Pokemon — 16 na mochila, 100 no deposito, 1 no time —
// numa chamada so', em menos de um segundo. As faixas vem do jogo pela mesma ponte: fraca
// 0,90-0,99, comum 1,00-1,09, incomum 1,10-1,24, rara 1,25-1,39, epica 1,40-1,54, lendaria
// 1,55-1,69.

PPX.modulo(
  {
    id: 'raridades',
    nome: 'Raridades',
    atalhos: 'Alt+A esconde · Alt+S mostra',
  },
  () => {
    'use strict';

    const CHAVE_POS = 'lioncode:raridades:posicao';
    const CHAVE_MIN = 'lioncode:raridades:minimizado';
    const CHAVE_FAIXA = 'lioncode:raridades:faixa';
    const PEDIDO = 'lioncode:raridades:pedido';
    const RESPOSTA = 'lioncode:raridades:resposta';
    const PACIENCIA = 15000;

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

    // ---------------------------------------------------------------- a ponte

    let proximoEco = 0;

    /**
     * Pede a lista a` metade que vive no mundo da pagina.
     *
     * O `eco` existe porque dois pedidos podem estar no ar — o automatico da abertura e um clique
     * no botao de atualizar. Sem ele, a resposta do primeiro seria tomada pela do segundo e a tela
     * mostraria dados velhos sem nada indicando isso.
     *
     * A paciencia nao e' enfeite: se `raridades-main.js` nao tiver entrado — outra extensao do
     * pacote desligada, pagina a meio de carregar —, ninguem responde nunca, e um painel que fica
     * para sempre em "procurando…" nao diz o que esta' errado.
     */
    const pedirLista = (fresco) =>
      new Promise((resolver) => {
        const eco = `r${Date.now()}-${(proximoEco += 1)}`;
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
          resolver({ erro: 'o jogo não respondeu — recarregue a página (F5) e tente de novo' });
        }, PACIENCIA);
        dispatchEvent(new CustomEvent(PEDIDO, { detail: { eco, fresco } }));
      });

    // ------------------------------------------------------------- vocabulario

    const QUALIDADES = {
      weak: 'Fraca',
      common: 'Comum',
      uncommon: 'Incomum',
      rare: 'Rara',
      epic: 'Épica',
      legendary: 'Lendária',
      mythic: 'Mítica',
    };
    const LOCAIS = { inventory: 'mochila', storage: 'depósito', team: 'time' };
    const CORES = {
      weak: '#8b97a8',
      common: '#9aa6b8',
      uncommon: '#4a9d6e',
      rare: '#4a86d8',
      epic: '#b06ad8',
      legendary: '#d2a022',
      mythic: '#e05a7a',
    };

    /** Duas casas, com vírgula: é assim que o jogo escreve na tela do Pokémon. */
    const numero = (valor, casas = 3) =>
      Number.isFinite(valor) ? valor.toFixed(casas).replace('.', ',') : '—';

    // ------------------------------------------------------------------ painel

    const painel = document.createElement('div');
    painel.id = 'lioncode-raridades';
    painel.innerHTML = `
      <header>
        <strong data-titulo>Raridades</strong>
        <button type="button" data-atualizar title="Perguntar de novo ao jogo">↻</button>
        <button type="button" data-minimizar title="Minimizar">–</button>
        <button type="button" data-fechar title="Esconder (Alt+A)">×</button>
      </header>
      <div class="resumo" data-resumo></div>
      <div class="corpo">
        <div class="faixa">
          <label>de <input type="text" data-de inputmode="decimal" placeholder="0,90"></label>
          <label>até <input type="text" data-ate inputmode="decimal" placeholder="1,69"></label>
          <button type="button" data-limpar title="Mostrar todos de novo">tudo</button>
        </div>
        <p class="conta" data-conta></p>
        <ul data-lista></ul>
        <div class="rodape">
          <button type="button" data-copiar>Copiar a lista</button>
        </div>
        <p class="estado" data-estado></p>
      </div>`;

    const estilo = document.createElement('style');
    estilo.textContent = `
      #lioncode-raridades, #lioncode-raridades * { box-sizing: border-box; }
      #lioncode-raridades {
        position: fixed; z-index: 2147483000; width: 290px;
        background: #11161f; color: #e7edf6; border: 1px solid #2a3244; border-radius: 10px;
        font: 13px/1.45 system-ui, sans-serif; box-shadow: 0 8px 24px #0008;
      }
      #lioncode-raridades header {
        display: flex; align-items: center; gap: 8px; padding: 8px 10px;
        border-bottom: 1px solid #2a3244; cursor: move;
      }
      #lioncode-raridades header strong { flex: 1; font-size: 13px; }
      #lioncode-raridades header button {
        background: none; border: 0; color: #8b97a8; font-size: 16px; cursor: pointer; padding: 0 2px;
      }
      #lioncode-raridades header button:hover:not(:disabled) { color: #e7edf6; }
      #lioncode-raridades .corpo { display: flex; flex-direction: column; gap: 8px; padding: 10px; }
      #lioncode-raridades .faixa { display: flex; align-items: center; gap: 6px; }
      #lioncode-raridades .faixa label {
        flex: 1; display: flex; align-items: center; gap: 4px; color: #9aa6b8; font-size: 12px;
      }
      #lioncode-raridades .faixa input {
        width: 100%; min-width: 0; background: #0d1219; color: #e7edf6; border: 1px solid #2a3244;
        border-radius: 5px; padding: 3px 5px; font: inherit; font-size: 12px;
      }
      #lioncode-raridades .faixa button {
        background: #1f2a3d; color: #e7edf6; border: 1px solid #33405a; border-radius: 6px;
        padding: 3px 8px; font: inherit; font-size: 12px; cursor: pointer;
      }
      #lioncode-raridades .conta { margin: 0; color: #8b97a8; font-size: 12px; }
      #lioncode-raridades ul {
        list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px;
        /* A lista inteira numa conta grande passa de cem linhas: ela rola, o painel nao cresce. */
        max-height: 46vh; overflow: auto;
      }
      #lioncode-raridades li {
        display: flex; align-items: center; gap: 7px;
        background: #0d1219; border: 1px solid #202835; border-radius: 7px; padding: 4px 7px;
      }
      #lioncode-raridades li .nome { flex: 1; min-width: 0; }
      #lioncode-raridades li b {
        display: block; font-weight: 600; overflow: hidden;
        text-overflow: ellipsis; white-space: nowrap;
      }
      #lioncode-raridades li small { display: block; color: #8b97a8; font-size: 11px; }
      #lioncode-raridades li .valor { font-variant-numeric: tabular-nums; font-weight: 600; }
      #lioncode-raridades .rodape { display: flex; gap: 6px; }
      #lioncode-raridades .rodape button {
        flex: 1; background: #1f2a3d; color: #e7edf6; border: 1px solid #33405a; border-radius: 6px;
        padding: 6px; font: inherit; cursor: pointer;
      }
      #lioncode-raridades .rodape button:hover:not(:disabled) { background: #26344c; }
      #lioncode-raridades button:disabled { opacity: .5; cursor: default; }
      #lioncode-raridades .estado { margin: 0; color: #9aa6b8; min-height: 1.4em; font-size: 12px; }
      #lioncode-raridades .estado.ruim { color: #ff9b9b; }
      #lioncode-raridades .estado.bom { color: #7ddba0; font-weight: 600; }
      #lioncode-raridades .vazio { color: #8b97a8; margin: 0; font-size: 12px; }

      /* Minimizado: a contagem da faixa e o melhor da coleção. O resto — a lista, os campos — sai
         da frente, que e' o que tapa o jogo. */
      #lioncode-raridades .resumo { display: none; }
      #lioncode-raridades.minimizado .resumo {
        display: flex; flex-direction: column; gap: 2px; padding: 0 8px 7px; font-size: 12px;
        color: #9aa6b8;
      }
      #lioncode-raridades.minimizado .corpo { display: none; }
      #lioncode-raridades.minimizado header { border-bottom: 0; padding: 6px 8px; }
      #lioncode-raridades.minimizado header strong { font-size: 12px; letter-spacing: .06em; }
      #lioncode-raridades.minimizado { width: 200px; }
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

    // ------------------------------------------------------------- os dados

    let colecao = [];
    let faixasDoJogo = {};
    let buscando = false;

    /** Aceita vírgula e ponto: ninguém digita `1.45` num jogo que escreve `×1,45`. */
    const comoNumero = (texto) => {
      const limpo = String(texto ?? '').trim().replace(',', '.');
      if (!limpo) return null;
      const valor = Number(limpo);
      return Number.isFinite(valor) ? valor : null;
    };

    const faixaEscolhida = () => ({
      de: comoNumero(campo('[data-de]').value),
      ate: comoNumero(campo('[data-ate]').value),
    });

    const filtrados = () => {
      const { de, ate } = faixaEscolhida();
      return colecao
        .filter((c) => Number.isFinite(c.raridade))
        .filter((c) => (de === null || c.raridade >= de) && (ate === null || c.raridade <= ate))
        // Do mais raro para o menos raro: o topo da lista é o que interessa.
        .sort((a, b) => b.raridade - a.raridade);
    };

    const linhaDeTexto = (c) => {
      const apelido = c.apelido && c.apelido !== c.especie ? ` "${c.apelido}"` : '';
      const qualidade = QUALIDADES[c.qualidade] || c.qualidade || '—';
      return `${numero(c.raridade)}\t${c.especie}${apelido}\t${qualidade}\tnv ${c.nivel}\t${
        LOCAIS[c.onde] || c.onde
      }`;
    };

    const desenhar = () => {
      const mostrados = filtrados();
      lista.innerHTML = '';
      campo('[data-conta]').textContent = colecao.length
        ? `${mostrados.length} de ${colecao.length}`
        : '';
      campo('[data-copiar]').disabled = mostrados.length === 0;
      if (!colecao.length) {
        pintarResumo();
        return;
      }
      if (!mostrados.length) {
        const vazio = document.createElement('p');
        vazio.className = 'vazio';
        vazio.textContent = 'Nenhum Pokémon nessa faixa.';
        lista.append(vazio);
        pintarResumo();
        return;
      }
      for (const c of mostrados) {
        const item = document.createElement('li');

        const valor = document.createElement('span');
        valor.className = 'valor';
        valor.textContent = `×${numero(c.raridade)}`;
        valor.style.color = CORES[c.qualidade] || '#e7edf6';
        const faixa = faixasDoJogo[c.qualidade];
        // O teto da faixa é o que diz se o bicho é um épico qualquer ou um épico quase perfeito —
        // é a mesma leitura que a tela do jogo faz com "×1,45 / ×1,54".
        valor.title = faixa
          ? `${QUALIDADES[c.qualidade] || c.qualidade}: de ${numero(faixa.min, 2)} a ${numero(faixa.max, 2)}`
          : QUALIDADES[c.qualidade] || c.qualidade;

        const nome = document.createElement('span');
        nome.className = 'nome';
        const titulo = document.createElement('b');
        titulo.textContent = c.especie + (c.brilhante ? ' ✦' : '');
        titulo.title = c.apelido && c.apelido !== c.especie ? `apelidado "${c.apelido}"` : c.especie;
        const abaixo = document.createElement('small');
        abaixo.textContent = [
          QUALIDADES[c.qualidade] || c.qualidade,
          `nv ${c.nivel}`,
          LOCAIS[c.onde] || c.onde,
          c.trancado ? 'trancado' : '',
        ]
          .filter(Boolean)
          .join(' · ');
        nome.append(titulo, abaixo);

        item.append(valor, nome);
        lista.append(item);
      }
      pintarResumo();
    };

    const pintarResumo = () => {
      const caixa = campo('[data-resumo]');
      caixa.textContent = '';
      if (!colecao.length) {
        caixa.textContent = 'ainda não perguntei ao jogo';
        return;
      }
      const mostrados = filtrados();
      const topo = mostrados[0] || null;
      const linha1 = document.createElement('div');
      linha1.textContent = `${mostrados.length} de ${colecao.length} na faixa`;
      caixa.append(linha1);
      if (!topo) return;
      const linha2 = document.createElement('div');
      linha2.innerHTML = '';
      const valor = document.createElement('b');
      valor.textContent = `×${numero(topo.raridade)}`;
      valor.style.color = CORES[topo.qualidade] || '#e7edf6';
      linha2.append(valor, document.createTextNode(` ${topo.especie}`));
      caixa.append(linha2);
    };

    const buscar = async (fresco) => {
      if (buscando) return;
      buscando = true;
      campo('[data-atualizar]').disabled = true;
      dizer(fresco ? 'Perguntando ao jogo…' : 'Lendo a sua coleção…');
      try {
        const resposta = await pedirLista(fresco);
        if (resposta.erro) {
          dizer(`Parei: ${resposta.erro}`, true);
          return;
        }
        colecao = Array.isArray(resposta.lista) ? resposta.lista : [];
        faixasDoJogo = resposta.faixas || {};
        desenhar();
        const porLocal = colecao.reduce((conta, c) => {
          conta[c.onde] = (conta[c.onde] || 0) + 1;
          return conta;
        }, {});
        const resumo = Object.entries(porLocal)
          .map(([onde, quantos]) => `${quantos} ${LOCAIS[onde] || onde}`)
          .join(' · ');
        celebrar(`${colecao.length} Pokémon: ${resumo}.`);
        // Uma lista cortada apresentada como completa seria pior do que lista nenhuma.
        if (resposta.parcial)
          dizer('O jogo devolveu só uma parte da coleção — a lista está incompleta.', true);
      } finally {
        buscando = false;
        campo('[data-atualizar]').disabled = false;
      }
    };

    // ------------------------------------------------------------- interacao

    const guardarFaixa = () => {
      gravar(CHAVE_FAIXA, {
        de: campo('[data-de]').value.trim(),
        ate: campo('[data-ate]').value.trim(),
      });
    };

    for (const seletor of ['[data-de]', '[data-ate]'])
      campo(seletor).addEventListener('input', () => {
        guardarFaixa();
        desenhar();
      });

    campo('[data-limpar]').addEventListener('click', () => {
      campo('[data-de]').value = '';
      campo('[data-ate]').value = '';
      guardarFaixa();
      desenhar();
    });

    campo('[data-atualizar]').addEventListener('click', () => void buscar(true));

    campo('[data-copiar]').addEventListener('click', async () => {
      const mostrados = filtrados();
      if (!mostrados.length) return;
      const texto = mostrados.map(linhaDeTexto).join('\n');
      try {
        await navigator.clipboard.writeText(texto);
        celebrar(`${mostrados.length} linhas copiadas.`);
      } catch {
        // Área de transferência negada — num jogo em tela cheia isso acontece. Em vez de dizer
        // "não deu", a lista vai para um campo já selecionado: copiar continua a um Ctrl+C.
        const caixa = document.createElement('textarea');
        caixa.value = texto;
        caixa.style.cssText = 'width:100%;height:80px;background:#0d1219;color:#e7edf6;border:1px solid #2a3244;border-radius:6px;font:12px monospace';
        campo('.rodape').after(caixa);
        caixa.select();
        dizer('Não consegui usar a área de transferência: a lista está aí, com Ctrl+C.', true);
        caixa.addEventListener('blur', () => caixa.remove());
      }
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

    let minimizado = ler(CHAVE_MIN, false) === true;
    const aplicarMinimo = () => {
      painel.classList.toggle('minimizado', minimizado);
      campo('[data-titulo]').textContent = minimizado ? 'RAR' : 'Raridades';
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
      globalThis.PPX?.anotar?.('raridades', false);
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
      if (evento.code === 'KeyA') {
        evento.preventDefault();
        mostrarPainel(false);
        globalThis.PPX?.anotar?.('raridades', false);
      } else if (evento.code === 'KeyS') {
        evento.preventDefault();
        mostrarPainel(true);
        globalThis.PPX?.anotar?.('raridades', true);
      }
    });

    const guardada = ler(CHAVE_FAIXA, null);
    if (guardada) {
      campo('[data-de]').value = String(guardada.de ?? '');
      campo('[data-ate]').value = String(guardada.ate ?? '');
    }

    desenhar();
    aplicarMinimo();
    recolocar();
    pintar();

    if (globalThis.PPX) {
      globalThis.PPX.controlar?.('raridades', mostrarPainel);
      mostrarPainel(globalThis.PPX.visivel?.('raridades') !== false);
    }

    // A primeira busca é automática: um painel que abre vazio e espera um clique para ter conteúdo
    // está a pedir um passo que ele mesmo podia dar.
    void buscar(false);
  },
);
