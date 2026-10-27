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
    /**
     * A outra ponta da ponte ja' esta' a escutar?
     *
     * **MEDIDO NOS EVENTOS EM 26/10/2026, E A CORRIDA E' A MESMA AQUI.** O manifest corre o bloco
     * ISOLATED inteiro antes do bloco MAIN — os dois em `document_idle` —, entao o pedido do
     * arranque (`void buscar(false)`) sai antes de `raridades-main.js` instalar o ouvinte. Um
     * `CustomEvent` sem ninguem a escutar nao fica em fila: perde-se, e o painel mostrava
     * "o jogo nao respondeu — recarregue a pagina (F5)" sem o jogo ter nada de errado.
     *
     * Espera-se, nunca se re-dispara: re-disparar serviria a leitura e estragaria uma accao.
     */
    const pontePronta = async () => {
      const fim = Date.now() + PACIENCIA;
      while (Date.now() < fim) {
        if (document.documentElement.dataset.lioncodeRaridades === 'pronto') return true;
        await new Promise((ok) => setTimeout(ok, 200));
      }
      return document.documentElement.dataset.lioncodeRaridades === 'pronto';
    };

    const pedirLista = async (fresco) => {
      if (!(await pontePronta()))
        return { erro: 'a ponte com o jogo não carregou — recarregue a página (F5)' };
      return pedirAoJogo(fresco);
    };

    const pedirAoJogo = (fresco) =>
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

    /** Os tipos como o jogo os escreve na tela, para o seletor nao falar ingles no meio do resto. */
    const TIPOS_PT = {
      normal: 'Normal',
      fire: 'Fogo',
      water: 'Água',
      electric: 'Elétrico',
      grass: 'Planta',
      ice: 'Gelo',
      fighting: 'Lutador',
      poison: 'Veneno',
      ground: 'Terra',
      flying: 'Voador',
      psychic: 'Psíquico',
      bug: 'Inseto',
      rock: 'Pedra',
      ghost: 'Fantasma',
      dragon: 'Dragão',
      dark: 'Sombrio',
      steel: 'Aço',
      fairy: 'Fada',
    };
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
        <div class="filtros">
          <div class="faixa">
            <span class="rotulo">raridade</span>
            <input type="text" data-de inputmode="decimal" placeholder="0,90">
            <input type="text" data-ate inputmode="decimal" placeholder="1,69">
          </div>
          <div class="faixa">
            <span class="rotulo">nível</span>
            <input type="number" min="1" data-nivel-de placeholder="1">
            <input type="number" min="1" data-nivel-ate placeholder="—">
          </div>
          <div class="faixa">
            <span class="rotulo" title="A soma dos seis, de 0 a 186">IV total</span>
            <input type="number" min="0" max="186" data-iv-de placeholder="0">
            <input type="number" min="0" max="186" data-iv-ate placeholder="186">
          </div>
          <div class="faixa">
            <select data-iv-qual title="Um atributo em particular, de 0 a 31">
              <option value="">um IV só…</option>
              <option value="hp">HP</option>
              <option value="atk">Ataque</option>
              <option value="def">Defesa</option>
              <option value="spa">At. Esp.</option>
              <option value="spd">Def. Esp.</option>
              <option value="spe">Velocidade</option>
            </select>
            <input type="number" min="0" max="31" data-iv-um-de placeholder="0">
            <input type="number" min="0" max="31" data-iv-um-ate placeholder="31">
          </div>
          <div class="faixa">
            <input type="text" data-especie placeholder="espécie ou apelido" list="lioncode-raridades-especies">
            <select data-elemento title="O tipo do Pokémon">
              <option value="">todos os tipos</option>
            </select>
          </div>
          <div class="faixa">
            <select data-onde title="Onde ele está">
              <option value="">mochila, depósito e time</option>
              <option value="inventory">só a mochila</option>
              <option value="storage">só o depósito</option>
              <option value="team">só o time</option>
            </select>
            <button type="button" data-limpar title="Mostrar todos de novo">tudo</button>
          </div>
          <label class="caixa" title="Esconder na janela do jogo os que não passam no filtro">
            <input type="checkbox" data-no-jogo> filtrar também a janela do jogo
          </label>
        </div>
        <datalist id="lioncode-raridades-especies" data-especies></datalist>
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
      /* Os filtros sao seis linhas curtas, e nao um formulario: cada uma cabe de relance, e o
         rotulo a' esquerda da' a elas o alinhamento que um rotulo por campo nao daria. */
      #lioncode-raridades .filtros { display: flex; flex-direction: column; gap: 4px; }
      #lioncode-raridades .faixa .rotulo {
        width: 56px; flex: none; color: #9aa6b8; font-size: 12px;
      }
      #lioncode-raridades .faixa select {
        flex: 1; min-width: 0; background: #0d1219; color: #e7edf6; border: 1px solid #2a3244;
        border-radius: 5px; padding: 3px 5px; font: inherit; font-size: 12px;
      }
      #lioncode-raridades .caixa {
        display: flex; align-items: center; gap: 5px; color: #9aa6b8; font-size: 12px;
      }
      #lioncode-raridades .caixa input { width: auto; }
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
      const limpo = String(texto ?? '')
        .trim()
        .replace(',', '.');
      if (!limpo) return null;
      const valor = Number(limpo);
      return Number.isFinite(valor) ? valor : null;
    };

    /** Os seis atributos do IV, como o jogo os chama. A soma maxima possivel e' 6 x 31 = 186. */
    const ATRIBUTOS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

    /** A soma dos seis. **Nao vem somada da ponte** de proposito: ver `reduzir`, la'. */
    const somaDosIvs = (c) => ATRIBUTOS.reduce((total, k) => total + (Number(c?.ivs?.[k]) || 0), 0);

    /**
     * Tudo o que esta' escrito nos filtros, lido de uma vez.
     *
     * **UM CAMPO VAZIO NAO E' UM ZERO, E' UMA PERGUNTA QUE NAO SE FEZ.** Por isso tudo o que nao
     * foi preenchido vira `null`, e `null` nao recusa ninguem. Tratar vazio como zero faria o
     * "IV total ate' —" esconder a coleção inteira no instante em que o painel abrisse.
     */
    const filtroEscolhido = () => ({
      raridade: {
        de: comoNumero(campo('[data-de]').value),
        ate: comoNumero(campo('[data-ate]').value),
      },
      nivel: {
        de: comoNumero(campo('[data-nivel-de]').value),
        ate: comoNumero(campo('[data-nivel-ate]').value),
      },
      iv: {
        de: comoNumero(campo('[data-iv-de]').value),
        ate: comoNumero(campo('[data-iv-ate]').value),
      },
      ivUm: {
        qual: campo('[data-iv-qual]').value,
        de: comoNumero(campo('[data-iv-um-de]').value),
        ate: comoNumero(campo('[data-iv-um-ate]').value),
      },
      especie: campo('[data-especie]').value.trim().toLowerCase(),
      elemento: campo('[data-elemento]').value,
      onde: campo('[data-onde]').value,
    });

    /** `null` de um lado nao recusa ninguem: e' um limite que ninguem pediu. */
    const dentro = (valor, faixa) =>
      (faixa.de === null || valor >= faixa.de) && (faixa.ate === null || valor <= faixa.ate);

    /**
     * Um Pokemon passa em **todos** os filtros preenchidos, ou nao passa.
     *
     * E' `e`, e nao `ou`: quem escreve "nivel 1 a 20" **e** "IV total acima de 140" esta' a procurar
     * um bicho novo que valha a pena guardar, e nao duas listas somadas. Com `ou`, o filtro mais
     * largo apagaria o mais estreito, e o resultado seria sempre pior do que nao filtrar.
     */
    const passa = (c, f) => {
      if (!dentro(c.raridade, f.raridade)) return false;
      if (!dentro(c.nivel, f.nivel)) return false;
      if (!dentro(somaDosIvs(c), f.iv)) return false;
      if (f.ivUm.qual && !dentro(Number(c?.ivs?.[f.ivUm.qual]) || 0, f.ivUm)) return false;
      if (f.onde && c.onde !== f.onde) return false;
      if (f.elemento && !(c.elementos || []).includes(f.elemento)) return false;
      if (f.especie) {
        // O apelido conta: quem batizou o bicho procura-o pelo nome que lhe deu.
        const alvo = `${c.especie} ${c.apelido || ''}`.toLowerCase();
        if (!alvo.includes(f.especie)) return false;
      }
      return true;
    };

    const filtrados = () => {
      const f = filtroEscolhido();
      return (
        colecao
          .filter((c) => Number.isFinite(c.raridade))
          .filter((c) => passa(c, f))
          // Do mais raro para o menos raro: o topo da lista é o que interessa.
          .sort((a, b) => b.raridade - a.raridade)
      );
    };

    // --------------------------------------------------- o mesmo filtro, na janela do jogo

    /**
     * Esconde na janela do jogo os Pokemon que nao passam no filtro.
     *
     * **POR QUE SO' NO INVENTARIO.** Medido em 15/10/2026: cada slot da mochila e' um
     * `.inventory-slot` com `data-creature-id`, entao da' para casar cada quadradinho com o
     * registro da API e escondê-lo. O **deposito** nao serve para isto: a janela dele pagina (48
     * paginas na conta do dono) e quem pagina e' o jogo — esconder quadradinhos ali filtraria so' a
     * pagina a' vista, e pareceria completo sem ser. Para o deposito, a lista deste painel e' a
     * resposta, e ela nao pagina porque a API devolve os 216 de uma vez.
     *
     * **E ELA DESFAZ-SE SOZINHA.** O que se mexe e' so' o `display`, guardado num atributo nosso,
     * e qualquer caminho de saida — desligar a caixinha, limpar o filtro, fechar o painel — repoe
     * tudo. Uma ferramenta que esconde coisas do jogo e nao sabe desesconder e' uma ferramenta que
     * o dono vai acusar de ter apagado os Pokemon dele.
     */
    const MARCA = 'data-lioncode-escondido';

    const mostrarTudoNoJogo = () => {
      for (const slot of document.querySelectorAll(`[${MARCA}]`)) {
        slot.style.display = slot.getAttribute(MARCA) === 'vazio' ? '' : slot.getAttribute(MARCA);
        slot.removeAttribute(MARCA);
      }
    };

    const filtrarNoJogo = () => {
      if (!campo('[data-no-jogo]').checked) {
        mostrarTudoNoJogo();
        return 0;
      }
      const f = filtroEscolhido();
      const porId = new Map(colecao.map((c) => [c.id, c]));
      let escondidos = 0;
      for (const slot of document.querySelectorAll('.inventory-slot[data-creature-id]')) {
        const c = porId.get(slot.getAttribute('data-creature-id'));
        // **Um slot que a lista nao conhece fica visivel.** Pode ser um Pokemon apanhado depois da
        // ultima leitura, e esconder o que nao se conhece seria esconder por ignorancia.
        const esconder = Boolean(c) && !passa(c, f);
        if (esconder) {
          if (!slot.hasAttribute(MARCA)) slot.setAttribute(MARCA, slot.style.display || 'vazio');
          slot.style.display = 'none';
          escondidos += 1;
        } else if (slot.hasAttribute(MARCA)) {
          slot.style.display = slot.getAttribute(MARCA) === 'vazio' ? '' : slot.getAttribute(MARCA);
          slot.removeAttribute(MARCA);
        }
      }
      return escondidos;
    };

    const linhaDeTexto = (c) => {
      const apelido = c.apelido && c.apelido !== c.especie ? ` "${c.apelido}"` : '';
      const qualidade = QUALIDADES[c.qualidade] || c.qualidade || '—';
      return `${numero(c.raridade)}\t${c.especie}${apelido}\t${qualidade}\tnv ${c.nivel}\tIV ${somaDosIvs(
        c,
      )}\t${LOCAIS[c.onde] || c.onde}`;
    };

    const desenhar = () => {
      const mostrados = filtrados();
      lista.innerHTML = '';
      const naMochila = mostrados.filter((c) => c.onde === 'inventory').length;
      campo('[data-conta]').textContent = colecao.length
        ? `${mostrados.length} de ${colecao.length}` +
          (campo('[data-no-jogo]').checked ? ` · ${naMochila} à vista na mochila` : '')
        : '';
      campo('[data-copiar]').disabled = mostrados.length === 0;
      if (!colecao.length) {
        pintarResumo();
        return;
      }
      if (!mostrados.length) {
        const vazio = document.createElement('p');
        vazio.className = 'vazio';
        vazio.textContent = 'Nenhum Pokémon passa nesses filtros.';
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
        titulo.title =
          c.apelido && c.apelido !== c.especie ? `apelidado "${c.apelido}"` : c.especie;
        const abaixo = document.createElement('small');
        abaixo.textContent = [
          QUALIDADES[c.qualidade] || c.qualidade,
          `nv ${c.nivel}`,
          // O IV entra na linha porque entrou no filtro: um criterio que nao se ve' no resultado
          // obriga a abrir cada bicho no jogo para conferir o que a lista ja' sabia.
          `IV ${somaDosIvs(c)}`,
          LOCAIS[c.onde] || c.onde,
          c.trancado ? 'trancado' : '',
        ]
          .filter(Boolean)
          .join(' · ');
        abaixo.title = ATRIBUTOS.map((k) => `${k} ${Number(c?.ivs?.[k]) || 0}`).join(' · ');
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

    /**
     * Enche o seletor de tipos e a lista de especies com o que a **conta** tem.
     *
     * Nao com os 18 tipos nem com as mil especies do jogo: filtrar por um tipo que ninguem na
     * mochila tem e' uma opcao que so' pode dar lista vazia, e uma opcao que nunca serve e' uma
     * opcao a mais para ler. O que se oferece e' o que de facto esta' la'.
     */
    const encherEscolhas = () => {
      const sel = campo('[data-elemento]');
      const antes = sel.value;
      const tipos = [...new Set(colecao.flatMap((c) => c.elementos || []))].sort();
      sel.innerHTML = '<option value="">todos os tipos</option>';
      for (const t of tipos) {
        const o = document.createElement('option');
        o.value = t;
        o.textContent = TIPOS_PT[t] || t;
        sel.append(o);
      }
      sel.value = tipos.includes(antes) ? antes : '';

      const dl = campo('[data-especies]');
      dl.innerHTML = '';
      for (const nome of [...new Set(colecao.map((c) => c.especie))].sort()) {
        const o = document.createElement('option');
        o.value = nome;
        dl.append(o);
      }
    };

    /**
     * Pede a lista e diz como correu, em vez de so' pintar a tela.
     *
     * Devolve `'ok'`, `'semApi'` — o jogo ainda nao publicou a API, e isso melhora sozinho — ou
     * `'erro'`, que nao melhora. **So' o do meio merece outra tentativa**, e e' por isso que estes
     * tres nomes existem: um booleano mandaria insistir em falhas definitivas ou desistir desta.
     */
    const buscar = async (fresco) => {
      if (buscando) return 'erro';
      buscando = true;
      campo('[data-atualizar]').disabled = true;
      dizer(fresco ? 'Perguntando ao jogo…' : 'Lendo a sua coleção…');
      try {
        const resposta = await pedirLista(fresco);
        if (resposta.erro) {
          dizer(`Parei: ${resposta.erro}`, true);
          return resposta.semApi === true ? 'semApi' : 'erro';
        }
        colecao = Array.isArray(resposta.lista) ? resposta.lista : [];
        faixasDoJogo = resposta.faixas || {};
        encherEscolhas();
        desenhar();
        filtrarNoJogo();
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
        return 'ok';
      } finally {
        buscando = false;
        campo('[data-atualizar]').disabled = false;
      }
    };

    // ------------------------------------------------------------- interacao

    /**
     * Os campos do filtro, numa lista so'.
     *
     * Uma lista, e nao doze linhas repetidas: guardar, limpar, repor e ouvir sao a mesma operacao
     * sobre o mesmo conjunto, e quatro copias desse conjunto divergiriam no dia em que entrasse o
     * decimo terceiro campo — tipicamente ficando **um** deles por limpar, que e' o defeito que
     * ninguem reproduz.
     */
    const CAMPOS = [
      '[data-de]',
      '[data-ate]',
      '[data-nivel-de]',
      '[data-nivel-ate]',
      '[data-iv-de]',
      '[data-iv-ate]',
      '[data-iv-qual]',
      '[data-iv-um-de]',
      '[data-iv-um-ate]',
      '[data-especie]',
      '[data-elemento]',
      '[data-onde]',
      '[data-no-jogo]',
    ];

    const valorDe = (seletor) => {
      const el = campo(seletor);
      return el.type === 'checkbox' ? el.checked : el.value.trim();
    };

    const guardarFaixa = () => {
      const tudo = {};
      for (const seletor of CAMPOS) tudo[seletor] = valorDe(seletor);
      gravar(CHAVE_FAIXA, tudo);
    };

    /** Redesenha a lista **e** a janela do jogo: sao duas vistas do mesmo filtro. */
    const refazer = () => {
      guardarFaixa();
      desenhar();
      filtrarNoJogo();
    };

    for (const seletor of CAMPOS)
      campo(seletor).addEventListener(
        campo(seletor).tagName === 'SELECT' || campo(seletor).type === 'checkbox'
          ? 'change'
          : 'input',
        refazer,
      );

    campo('[data-limpar]').addEventListener('click', () => {
      for (const seletor of CAMPOS) {
        const el = campo(seletor);
        if (el.type === 'checkbox') continue;
        el.value = '';
      }
      // A caixinha do jogo **nao** se limpa junto: ela nao e' um criterio, e' onde o resultado
      // aparece. Desligá-la aqui faria o "tudo" parecer que quebrou o espelho na janela.
      refazer();
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
        caixa.style.cssText =
          'width:100%;height:80px;background:#0d1219;color:#e7edf6;border:1px solid #2a3244;border-radius:6px;font:12px monospace';
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
      // **Esconder o painel desfaz o filtro na janela do jogo.** Um painel fechado com slots
      // escondidos por ele seria uma mochila com buracos sem nada na tela a explicar porque'.
      mostrarTudoNoJogo();
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
      // O formato antigo guardava `{de, ate}` da raridade. Ele continua a ser lido: quem atualiza o
      // pacote nao tem por que perder a faixa que deixou escrita ontem.
      if (guardada.de !== undefined || guardada.ate !== undefined) {
        campo('[data-de]').value = String(guardada.de ?? '');
        campo('[data-ate]').value = String(guardada.ate ?? '');
      }
      for (const seletor of CAMPOS) {
        if (guardada[seletor] === undefined) continue;
        const el = campo(seletor);
        if (el.type === 'checkbox') el.checked = guardada[seletor] === true;
        else el.value = String(guardada[seletor] ?? '');
      }
    }

    desenhar();
    aplicarMinimo();
    recolocar();
    pintar();

    if (globalThis.PPX) {
      globalThis.PPX.controlar?.('raridades', mostrarPainel);
      mostrarPainel(globalThis.PPX.visivel?.('raridades') !== false);
    }

    /**
     * Repoe o filtro quando a janela do jogo se redesenha.
     *
     * **NAO E' ZELO, E' A UNICA MANEIRA DE ISTO FUNCIONAR.** A mochila e' React: ela refaz os slots
     * ao abrir, ao mudar de aba, ao vender, ao capturar — e cada refazer devolve os elementos
     * limpos, sem o `display` que tinhamos posto. Sem isto, o filtro valia ate' ao primeiro clique
     * do dono na janela, e depois deixava de valer **sem dizer nada**, que e' o pior dos dois.
     *
     * Observa-se o `body` porque a janela nem sempre existe para ser observada: ela nasce no
     * momento em que ele a abre. E peneira-se antes de agir — o jogo mexe no DOM muitas vezes por
     * segundo, e so' interessa a batida em que ha' slots por filtrar.
     */
    {
      let agendado = 0;
      const olho = new MutationObserver(() => {
        if (agendado || !campo('[data-no-jogo]').checked) return;
        agendado = setTimeout(() => {
          agendado = 0;
          filtrarNoJogo();
        }, 120);
      });
      olho.observe(document.body, { childList: true, subtree: true });
    }

    /**
     * A primeira busca e' automatica: um painel que abre vazio e espera um clique para ter
     * conteudo esta' a pedir um passo que ele mesmo podia dar.
     *
     * **E ELA INSISTE, PORQUE DESISTIR CALADO FOI O DEFEITO.** Visto na conta do dono em
     * 27/10/2026: a pagina estava aberta havia horas, a API bem viva, e o painel continuava a
     * dizer "o jogo ainda nao publicou a API" — a busca do arranque tinha chegado cedo demais e
     * nunca mais tentou. Abrir o painel com Alt+A tambem nao voltava a perguntar: so' o ↻, e quem
     * le' um erro nao tem por que adivinhar que ha' um botao que o cura.
     *
     * Insiste **so'** enquanto a resposta for "ainda nao ha' API". Um erro de verdade — uma lista
     * que nao e' lista, uma ponte que nao carregou — nao melhora por ser repetido, e repeti-lo
     * seria trocar uma mensagem errada por varias.
     */
    const TENTATIVAS_DE_ARRANQUE = 5;
    const ESPERA_ENTRE_TENTATIVAS = 3000;
    const buscaDeArranque = async () => {
      for (let tentativa = 1; tentativa <= TENTATIVAS_DE_ARRANQUE; tentativa += 1) {
        if ((await buscar(false)) !== 'semApi') return;
        if (tentativa < TENTATIVAS_DE_ARRANQUE)
          await new Promise((ok) => setTimeout(ok, ESPERA_ENTRE_TENTATIVAS));
      }
    };
    void buscaDeArranque();
  },
);
