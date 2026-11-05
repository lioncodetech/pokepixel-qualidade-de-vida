// Genética: extrai material genético dos épicos de raridade baixa, pelo NPC Geneticista.
//
// O QUE ELA FAZ. Varre a coleção, separa o que cai nas **faixas de raridade** que o dono escreveu
// — uma por raridade, com mínimo e máximo — e troca-os por Material Genético da própria espécie. O jogo apaga esses Pokémon, e não há
// desfazer — por isso tudo aqui é desenhado à volta dessa frase.
//
// POR QUE ELA É EM DUAS PARTES. "Procurar" só lê e conta; "Extrair" é o que apaga. Entre os dois
// há uma confirmação no próprio botão, e durante a corrida há "Pausar". O pedido do dono em
// 03/11/2026 foi exatamente esse: *"coloca um botão de pausa, para caso eu clique sem querer e não
// queira fazer nada"*. Então um clique sem querer custa zero: o primeiro só conta, o segundo pede
// confirmação, e a pausa trava o resto.
//
// ONDE A PAUSA PEGA, E ONDE NÃO PEGA. Uma espécie é **uma chamada** ao servidor, que apaga todos
// os dela de uma vez; não dá para parar no meio dessa chamada, e fingir que dava seria a pior
// espécie de botão. A pausa pega **entre espécies** — e é por isso que o painel diz quantas faltam
// em vez de quantos Pokémon faltam.
//
// O PLANO É CONGELADO NO "PROCURAR". Os ids ficam do lado da página (`genetica-main.js`) e o
// painel só manda o índice da espécie. Assim o que se apaga é exatamente o que foi contado na
// tela: nada de uma releitura esperta entre o "vi 248" e o "apaguei 251".
PPX.modulo(
  { id: 'genetica', nome: 'Genética', atalhos: 'configuração pelo menu (Alt+Q)' },
  () => {
    'use strict';

    const CHAVE = 'lioncode:genetica:config';
    const CHAVE_POS = 'lioncode:genetica:posicao';
    const CHAVE_MIN = 'lioncode:genetica:minimizado';
    const PEDIDO = 'lioncode:genetica:pedido';
    const RESPOSTA = 'lioncode:genetica:resposta';
    const MINHA_VEZ = 'genetica';

    /**
     * As raridades, na ordem do jogo, e o nome de mostrar de cada uma.
     *
     * A ordem importa: uma lista alfabética poria "comum" ao lado de "épica" e faria o dono
     * procurar. As faixas de cada uma **não** estão aqui — vêm do jogo, ver `bandas`.
     */
    const RARIDADES = [
      ['weak', 'fraca'],
      ['common', 'comum'],
      ['uncommon', 'incomum'],
      ['rare', 'rara'],
      ['epic', 'épica'],
      ['legendary', 'lendária'],
      ['mythic', 'mítica'],
    ];

    const PADRAO = {
      /**
       * Uma faixa por raridade: `{ liga, min, max }`.
       *
       * Nasce com a épica ligada em 1,40–1,49, que é o pedido original do dono. As outras nascem
       * desligadas: ligar lendária é uma caixa que se marca de propósito, e não um dígito que
       * escorrega num campo de número.
       */
      faixas: { epic: { liga: true, min: 1.4, max: 1.49 } },
      /** Ir à cidade antes de extrair. Ver `irParaCidade`, na ponte. */
      cidade: true,
      /** Voltar à caçada de onde se saiu, quando acabar. */
      voltar: true,
      /** O intervalo entre espécies, em segundos: sorteia-se entre os dois. */
      minSeg: 3,
      maxSeg: 8,
      /** A agenda: vazia quer dizer "só quando eu clicar". */
      ligada: false,
      horarios: '',
      dias: '',
      /** Carimbo da última corrida agendada. **Não é configuração** — ver o `config.js`. */
      ultima: 0,
    };
    /** O intervalo entre espécies anda entre estes dois, e o painel prende o que for escrito. */
    const PAUSA_MIN = 1;
    const PAUSA_MAX = 120;
    /**
     * O servidor tem um intervalo entre rituais, e ele NAO esta' escrito no cliente do jogo.
     *
     * MEDIDO NA CONTA DO DONO EM 03/11/2026, na primeira corrida de verdade: a primeira especie
     * passou e a segunda voltou com *"Aguarde um instante antes de iniciar outro ritual."* — uma
     * frase que nao existe em nenhum dos ficheiros de idioma, logo veio do servidor. A ferramenta
     * tratava qualquer erro como definitivo e parava ali: extraiu uma especie e desistiu das 60.
     *
     * Entao esperar passou a ser **parte do trabalho**, e nao uma falha. Quando o jogo diz quanto
     * esperar (`retryAfterMs`), espera-se isso; quando nao diz, comeca-se em 3 s e dobra.
     */
    const ESPERA_INICIAL = 3000;
    const ESPERA_MAXIMA = 60000;
    /** Quantas esperas seguidas antes de desistir desta especie. Ao dobrar, da' perto de 2 min. */
    const TENTATIVAS = 8;
    /**
     * O respiro entre especies: sorteado entre o minimo e o maximo escritos no painel.
     *
     * Duas razoes, e as duas do dono. A primeira e' tecnica: sem respiro nenhum, cada especie
     * gastava uma tentativa a levar com o "aguarde" do servidor antes de passar. A segunda e' dele
     * — pedida em 03/11/2026 — e e' sobre ritmo: um relogio que dispara sempre com o mesmo
     * intervalo nao se parece com ninguem a jogar. O sorteio e' o mesmo principio que a agenda ja'
     * usa para escolher o instante dentro da janela.
     */
    const respiro = () => {
      const min = Math.min(cfg.minSeg, cfg.maxSeg) * 1000;
      const max = Math.max(cfg.minSeg, cfg.maxSeg) * 1000;
      return Math.round(min + Math.random() * (max - min));
    };
    /**
     * As faixas do jogo, lidas na ponte. Vazio até a primeira resposta — e então o painel desenha
     * as linhas com os limites de cada raridade.
     *
     * O fallback é deliberadamente nenhum: inventar 1,40–1,54 aqui seria cravar um número que o
     * jogo pode mudar, que é exatamente o que as Raridades aprenderam a não fazer.
     */
    let bandas = {};
    const duasCasas = (n) => Math.round(Number(n) * 100) / 100;

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
    /**
     * As faixas que vêm de fora, lidas campo a campo.
     *
     * O que chega do arquivo é lido como se viesse de fora, porque vem: nunca se escreve no
     * armazenamento a chave que vier lá dentro. Ver o `config.js`.
     */
    const limparFaixas = (bruto) => {
      const fora = {};
      if (!bruto || typeof bruto !== 'object') return { ...PADRAO.faixas };
      for (const [chave] of RARIDADES) {
        const f = bruto[chave];
        if (!f || typeof f !== 'object') continue;
        const min = Number(f.min);
        const max = Number(f.max);
        if (!Number.isFinite(min) || !Number.isFinite(max)) continue;
        fora[chave] = { liga: f.liga === true, min: duasCasas(min), max: duasCasas(max) };
      }
      return Object.keys(fora).length ? fora : { ...PADRAO.faixas };
    };

    const cfg = { ...PADRAO, ...(ler(CHAVE, null) || {}) };
    cfg.faixas = limparFaixas(cfg.faixas);
    // **Quem já tinha um teto escolhido não perde a escolha por ter nascido um campo novo.** O
    // teto era "épicos até N", que é exatamente a faixa épica de 1,40 até N.
    if (Number.isFinite(Number(cfg.teto))) {
      cfg.faixas = { ...cfg.faixas, epic: { liga: true, min: 1.4, max: duasCasas(cfg.teto) } };
      delete cfg.teto;
    }
    const gravar = () => gravarChave(CHAVE, cfg);

    const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
    const ate = async (fn, limite) => {
      const inicio = Date.now();
      while (Date.now() - inicio < limite) {
        if (await fn()) return true;
        await espera(250);
      }
      return false;
    };

    // ------------------------------------------------------------ a ponte
    //
    // Mesma lição dos Eventos e do Rampage: o bloco ISOLATED corre inteiro antes do MAIN, e um
    // `CustomEvent` sem ninguém a escutar não fica em fila — perde-se. Espera-se pela marca.
    let eco = 0;
    const pedirAoJogo = (pedido) =>
      new Promise((resolver) => {
        const id = `g${Date.now()}-${++eco}`;
        const ouvir = (e) => {
          if (e?.detail?.eco !== id) return;
          clearTimeout(limite);
          removeEventListener(RESPOSTA, ouvir);
          resolver(e.detail);
        };
        addEventListener(RESPOSTA, ouvir);
        // Generoso de propósito: uma varredura passa por dezenas de espécies, uma página de cada
        // vez. O prazo curto daqui mataria a leitura a meio e diria "o jogo não respondeu".
        const limite = setTimeout(() => {
          removeEventListener(RESPOSTA, ouvir);
          resolver({ erro: 'o jogo não respondeu — recarregue a página (F5)' });
        }, 120000);
        dispatchEvent(new CustomEvent(PEDIDO, { detail: { eco: id, ...pedido } }));
      });
    const ponte = async (pedido) => {
      if (!(await ate(() => document.documentElement.dataset.lioncodeGenetica === 'pronto', 20000)))
        return { erro: 'a ponte com o jogo não carregou — recarregue a página (F5)' };
      return pedirAoJogo(pedido);
    };

    const esperarAVez = async (avisar) => {
      const vez = globalThis.PPX?.vez;
      if (!vez?.pedir) return () => {};
      const dono = vez.dono();
      if (dono && dono.id !== MINHA_VEZ) avisar(`Esperando o ${vez.nome(dono.id)} terminar…`);
      return vez.pedir(MINHA_VEZ);
    };

    // ------------------------------------------------------------- painel

    const painel = document.createElement('div');
    painel.id = 'lioncode-genetica';
    painel.innerHTML = `
      <header>
        <strong data-titulo>Genética</strong>
        <button type="button" data-minimizar title="Minimizar">–</button>
        <button type="button" data-fechar title="Esconder">×</button>
      </header>
      <div class="corpo">
        <ul class="faixas" data-faixas></ul>
        <p class="nota">
          Shiny, travado e o que está na equipe ficam de fora sempre. <b>Este jogo só oferece
          épico para cima</b> — as outras podem ser escritas, mas não vem nada.
        </p>
        <label class="caixa" title="A janela do Geneticista só abre na cidade">
          <input type="checkbox" data-cidade> ir à cidade antes de extrair
        </label>
        <label class="caixa" title="Voltar para a caçada de onde saí, quando acabar">
          <input type="checkbox" data-voltar> voltar à caçada no fim
        </label>
        <label class="campo" title="Entre uma espécie e a seguinte, sorteio um tempo entre estes dois">
          entre espécies
          <input type="number" min="${PAUSA_MIN}" max="${PAUSA_MAX}" data-min> a
          <input type="number" min="${PAUSA_MIN}" max="${PAUSA_MAX}" data-max> s
        </label>
        <div data-agenda></div>
        <div class="botoes">
          <button type="button" data-procurar>Procurar</button>
          <button type="button" data-extrair disabled>Extrair</button>
        </div>
        <button type="button" class="agenda" data-ligar>Iniciar pela agenda</button>
        <div class="botoes">
          <button type="button" data-pausar disabled>Pausar</button>
          <button type="button" data-parar disabled>Parar</button>
        </div>
        <p class="aviso">Extrair <b>apaga</b> os Pokémon. Não há desfazer.</p>
        <ul data-lista></ul>
        <div data-config></div>
      </div>
      <p class="estado" data-estado>Clique em Procurar: isso só conta, não apaga nada.</p>`;

    const estilo = document.createElement('style');
    estilo.textContent = `
      #lioncode-genetica,#lioncode-genetica *{box-sizing:border-box}
      #lioncode-genetica{position:fixed;z-index:2147483000;width:252px;background:var(--ppx-fundo);color:var(--ppx-texto);border:1px solid var(--ppx-borda);border-radius:var(--ppx-raio);font:var(--ppx-fonte);box-shadow:var(--ppx-sombra);max-height:var(--ppx-teto);overflow:auto;scrollbar-width:thin;scrollbar-color:var(--ppx-borda) transparent}
      #lioncode-genetica header{display:flex;gap:8px;align-items:center;padding:8px 10px;border-bottom:1px solid #2a3244;cursor:move}
      #lioncode-genetica header strong{flex:1;font-size:13px}
      #lioncode-genetica header button{border:0;background:none;color:#8b97a8;font-size:16px;cursor:pointer;padding:0 2px}
      #lioncode-genetica .corpo{display:grid;grid-template-columns:minmax(0,1fr);gap:8px;padding:10px}
      #lioncode-genetica.minimizado .corpo{display:none}
      #lioncode-genetica .campo{display:flex;align-items:center;gap:6px;color:#c3ccda}
      #lioncode-genetica .caixa{display:flex;align-items:center;gap:6px;color:#c3ccda;font-size:12px}
      #lioncode-genetica .faixas{list-style:none;margin:0;padding:0;display:grid;gap:3px}
      #lioncode-genetica .faixas li{display:flex;align-items:center;gap:4px;font-size:12px;color:#c3ccda}
      #lioncode-genetica .faixas li.desligada{opacity:.55}
      #lioncode-genetica .faixas .nome{flex:1;min-width:0}
      #lioncode-genetica .faixas input[type=number]{width:52px;flex:0 0 auto;padding:3px}
      #lioncode-genetica .faixas input[type=checkbox]{flex:0 0 auto}
      #lioncode-genetica .faixas li.nunca .nome{text-decoration:line-through}
      #lioncode-genetica .caixa input{flex:0 0 auto}
      #lioncode-genetica [data-ligar]{cursor:pointer;border:1px solid #2a3244;border-radius:6px;background:#182030;color:#e7edf6;padding:6px}
      #lioncode-genetica [data-ligar].a-correr{border-color:#3fb950;color:#7ee787;background:#12251a}
      #lioncode-genetica label{color:#c3ccda}
      #lioncode-genetica input{flex:1;min-width:0;border:1px solid #2a3244;border-radius:6px;background:#182030;color:#e7edf6;padding:6px}
      #lioncode-genetica .botoes{display:flex;gap:6px}
      #lioncode-genetica .botoes button{flex:1;cursor:pointer;border:1px solid #2a3244;border-radius:6px;background:#182030;color:#e7edf6;padding:6px}
      #lioncode-genetica .botoes button:disabled{opacity:.45;cursor:default}
      #lioncode-genetica [data-extrair].confirmar{border-color:#f85149;color:#ffb3ae;background:#2a1414;font-weight:700}
      #lioncode-genetica [data-pausar].pausado{border-color:#d29922;color:#f0c674}
      #lioncode-genetica .nota,#lioncode-genetica .aviso,#lioncode-genetica .estado{margin:0;font-size:12px;color:#8b97a8}
      #lioncode-genetica .aviso{color:#f0a0a0}
      #lioncode-genetica .estado{padding:0 10px 10px}
      #lioncode-genetica .estado.mau{color:#f85149}
      #lioncode-genetica [data-lista]{list-style:none;margin:0;padding:0;display:grid;gap:2px;max-height:150px;overflow:auto;font-size:12px;color:#c3ccda}
      #lioncode-genetica [data-lista] li{display:flex;justify-content:space-between;gap:8px}
      #lioncode-genetica [data-lista] li.feita{color:#7ee787}
      #lioncode-genetica [data-lista] li.vazio{color:#8b97a8;justify-content:flex-start}`;

    const campo = (seletor) => painel.querySelector(seletor);
    const calendario = () => globalThis.PPX?.agenda || null;
    const dizer = (texto, mau = false) => {
      const linha = campo('[data-estado]');
      linha.textContent = texto;
      linha.classList.toggle('mau', mau === true);
    };

    // O calendário é o mesmo de todas as outras: listas de dias atrás de um botão, e o horário
    // num campo de texto. Nenhum painel deste pacote desenha controles de dia próprios — ver o
    // AGENTS.md, "Toda agenda passa pelo calendário".
    const horas = document.createElement('input');
    horas.type = 'text';
    horas.placeholder = '03:00-06:00';
    const rotulo = document.createElement('label');
    rotulo.append('extrair entre ', horas);
    const editor = calendario()?.montarControles({
      resumoDe: (dias) => calendario().resumo({ dias, horarios: horas.value.trim() }),
    });
    const campoDias = editor ? editor.campo : document.createElement('input');
    if (editor) {
      campo('[data-agenda]').append(editor.el);
      editor.corpo.prepend(rotulo);
    } else campo('[data-agenda]').append(rotulo);
    horas.value = cfg.horarios;
    if (editor) editor.escrever(cfg.dias);
    else campoDias.value = cfg.dias;

    // ------------------------------------------------------------- estado
    //
    // `plano` é só o retrato para a tela — os ids vivem do outro lado da ponte. `feitas` conta as
    // espécies já extraídas desta varredura, e é o que permite retomar de onde a pausa parou.
    let plano = [];
    let feitas = 0;
    let correndo = false;
    let pausado = false;
    let parar = false;
    let confirmando = false;
    /** A caçada de onde se saiu, para se poder voltar. `null` = não saí de nenhuma. */
    let origem = null;
    /** O instante sorteado da próxima corrida agendada. Zero = ainda por sortear. */
    let proxima = 0;

    const desenharLista = () => {
      const lista = campo('[data-lista]');
      lista.innerHTML = '';
      if (!plano.length) {
        const vazio = document.createElement('li');
        vazio.className = 'vazio';
        vazio.textContent = 'Nada procurado ainda.';
        lista.append(vazio);
        return;
      }
      for (const [i, e] of plano.entries()) {
        const li = document.createElement('li');
        li.classList.toggle('feita', i < feitas);
        const nome = document.createElement('span');
        nome.textContent = e.nome;
        const quantos = document.createElement('span');
        quantos.textContent = i < feitas ? `${e.quantos} ✓` : String(e.quantos);
        li.append(nome, quantos);
        lista.append(li);
      }
    };

    const total = () => plano.reduce((n, e) => n + e.quantos, 0);
    const faltam = () => plano.slice(feitas).reduce((n, e) => n + e.quantos, 0);

    const desenharBotoes = () => {
      const temPlano = feitas < plano.length;
      campo('[data-procurar]').disabled = correndo;
      for (const el of painel.querySelectorAll('[data-faixas] input')) el.disabled = correndo;
      const extrair = campo('[data-extrair]');
      extrair.disabled = correndo || !temPlano;
      extrair.classList.toggle('confirmar', confirmando);
      extrair.textContent = confirmando ? `Confirmar: apagar ${faltam()}` : 'Extrair';
      const pausa = campo('[data-pausar]');
      pausa.disabled = !correndo;
      pausa.classList.toggle('pausado', pausado);
      pausa.textContent = pausado ? 'Retomar' : 'Pausar';
      campo('[data-parar]').disabled = !correndo;
    };

    /**
     * As faixas que valem para a varredura: só as ligadas, já com os números presos à banda.
     *
     * É isto que viaja para a ponte, e não `cfg.faixas` inteiro: uma raridade desligada não pode
     * chegar lá como um intervalo vazio e depender de o outro lado a ignorar.
     */
    const faixasLigadas = () => {
      const fora = {};
      for (const [chave] of RARIDADES) {
        const f = cfg.faixas[chave];
        if (!f?.liga) continue;
        fora[chave] = { min: Math.min(f.min, f.max), max: Math.max(f.min, f.max) };
      }
      return fora;
    };

    const desenharFaixas = () => {
      const lugar = campo('[data-faixas]');
      lugar.replaceChildren();
      for (const [chave, nome] of RARIDADES) {
        const banda = bandas[chave];
        // Uma raridade que este jogo não tem (a mítica, hoje) não vira linha: um campo que não
        // corresponde a nada é um convite a escrever um número que nunca pega.
        if (!banda && !cfg.faixas[chave]) continue;
        const f = cfg.faixas[chave] || { liga: false, min: banda.min, max: banda.max };
        const li = document.createElement('li');
        li.classList.toggle('desligada', !f.liga);
        // O jogo não oferece nada abaixo de épico — medido. Dizê-lo aqui, riscado, é mais honesto
        // do que deixar o dono escrever uma faixa e esperar por um zero.
        li.classList.toggle('nunca', ['weak', 'common', 'uncommon', 'rare'].includes(chave));

        const liga = document.createElement('input');
        liga.type = 'checkbox';
        liga.checked = f.liga === true;
        liga.title = `Extrair ${nome}`;
        liga.addEventListener('change', () => {
          cfg.faixas[chave] = { ...f, liga: liga.checked };
          mudouAFaixa();
        });

        const rotulo = document.createElement('span');
        rotulo.className = 'nome';
        rotulo.textContent = nome;
        if (banda) rotulo.title = `O jogo dá esta raridade entre ${banda.min} e ${banda.max}`;

        const campos = [];
        for (const qual of ['min', 'max']) {
          const n = document.createElement('input');
          n.type = 'number';
          n.step = '0.01';
          if (banda) {
            n.min = String(banda.min);
            n.max = String(banda.max);
          }
          n.value = f[qual];
          n.addEventListener('change', () => {
            const v = Number(n.value);
            // Preso à banda do jogo: uma "épica até 1,60" apanharia lendário, e o dono nunca mais
            // saberia qual foi. A raridade é uma chave, e não um intervalo que escorrega.
            const preso = Number.isFinite(v)
              ? banda
                ? Math.min(banda.max, Math.max(banda.min, v))
                : v
              : f[qual];
            // Parte-se do `f` DESENHADO, e nao de `cfg.faixas[chave]`: numa raridade que o dono
            // ainda nao ligou essa chave nao existe, e o spread de `undefined` gravava uma faixa
            // com um limite so' — campo em branco no redesenho, e `Math.min(undefined, x)` a dar
            // NaN na varredura, que nao casa com nada e nao explica porque.
            cfg.faixas[chave] = { liga: false, ...f, [qual]: duasCasas(preso) };
            mudouAFaixa();
          });
          campos.push(n);
        }
        li.append(liga, rotulo, campos[0], document.createTextNode('a'), campos[1]);
        lugar.append(li);
      }
    };

    const desenhar = () => {
      desenharFaixas();
      campo('[data-cidade]').checked = cfg.cidade !== false;
      campo('[data-voltar]').checked = cfg.voltar !== false;
      campo('[data-min]').value = cfg.minSeg;
      campo('[data-max]').value = cfg.maxSeg;
      const ligar = campo('[data-ligar]');
      ligar.textContent = cfg.ligada ? 'Parar a agenda' : 'Iniciar pela agenda';
      ligar.classList.toggle('a-correr', cfg.ligada === true);
      desenharLista();
      desenharBotoes();
    };

    /** Desarma a confirmação. Qualquer outra coisa que se mexa cancela o "tem a certeza?". */
    const desarmar = () => {
      if (!confirmando) return;
      confirmando = false;
      desenharBotoes();
    };

    // ----------------------------------------------------------- procurar

    const procurar = async () => {
      if (correndo) return;
      desarmar();
      correndo = true;
      desenharBotoes();
      dizer('Procurando… isto só lê, não apaga nada.');
      try {
        const escolhidas = faixasLigadas();
        if (!Object.keys(escolhidas).length) {
          plano = [];
          feitas = 0;
          return dizer('Nenhuma raridade marcada. Marque pelo menos uma.', true);
        }
        const r = await ponte({ acao: 'listar', faixas: escolhidas });
        if (r?.erro) {
          plano = [];
          feitas = 0;
          dizer(r.erro, true);
          return;
        }
        plano = Array.isArray(r?.especies) ? r.especies : [];
        feitas = 0;
        if (!plano.length) {
          // Dizer o que o jogo OFERECEU separa duas perguntas diferentes: "a minha faixa não
          // pegou" e "esta raridade o jogo nunca dá". Sem isto, as duas são o mesmo zero mudo.
          const ofereceu = Object.entries(r?.vistos || {})
            .map(([q, n]) => `${nomeDaRaridade(q)} ${n}`)
            .join(', ');
          dizer(
            `Nada nas faixas marcadas, entre ${r?.olhados || 0} extraíveis.` +
              (ofereceu ? ` O jogo ofereceu: ${ofereceu}.` : ''),
          );
          return;
        }
        dizer(`${total()} Pokémon em ${plano.length} espécie(s). Nada foi apagado — confira a lista.`);
      } finally {
        correndo = false;
        desenhar();
      }
    };

    // ------------------------------------------------------------ extrair

    /**
     * Este erro quer dizer "ainda nao", e nao "nao pode"?
     *
     * Tres sinais, em ordem de confianca: o jogo dizer quanto esperar, o 429 de sempre, e a frase
     * do servidor. A frase entra por ultimo de proposito — e' a unica que se perde numa traducao,
     * e e' tambem a unica que existia no dia em que isto foi medido.
     *
     * O que NAO entra aqui: `SELECTION_CHANGED` e `NO_ELIGIBLE_CREATURES`. Esses querem dizer que
     * a coleção mudou debaixo do plano, e repetir um plano velho e' exatamente o que nao se faz
     * quando o que esta' em jogo e' apagar bicho.
     */
    const podeEsperar = (r) =>
      Number(r?.esperarMs) > 0 ||
      Number(r?.status) === 429 ||
      /aguarde|instante|ritual/i.test(String(r?.erro || ''));

    const dormir = async (ms) => {
      // Dorme aos bocados: uma espera de 60 s inteiriça faria o Pausar e o Parar parecerem
      // mortos durante um minuto, que é a mesma queixa que este botão existe para não ter.
      const fim = Date.now() + ms;
      while (Date.now() < fim && !parar && !pausado) await espera(Math.min(300, fim - Date.now()));
    };

    /**
     * De volta à caçada de onde se saiu, se o dono quis e se havia uma.
     *
     * Não é erro não haver: quem já estava na cidade quando começou continua na cidade, que é
     * exatamente onde ele estava.
     */
    const voltarACacada = async () => {
      if (!cfg.voltar || !origem?.nome) return;
      const volta = await globalThis.PPX?.cacadas?.ir?.(origem.nome);
      origem = null;
      if (!volta?.ok) dizer(`Extração feita, mas não voltei à caçada: ${volta?.erro || 'falhou'}`, true);
    };

    const extrair = async () => {
      if (correndo) return;
      correndo = true;
      pausado = false;
      parar = false;
      confirmando = false;
      desenharBotoes();
      let soltar = null;
      try {
        soltar = await esperarAVez(dizer);
        if (!soltar) return dizer('Desisti: o jogo ficou ocupado tempo demais.', true);

        // A caçada de onde se saiu lê-se ANTES de sair dela: depois do `stopHunt` já não há o que
        // perguntar, e era assim que se voltava para lugar nenhum.
        if (cfg.cidade) {
          origem = globalThis.PPX?.cacadas?.atual?.() || null;
          dizer('Indo para a cidade…');
          const ida = await ponte({ acao: 'cidade' });
          if (ida?.erro) return dizer(`Não consegui ir para a cidade: ${ida.erro}`, true);
          if (!ida?.jaEstava) await dormir(respiro());
        }

        let tentativas = 0;
        let atraso = ESPERA_INICIAL;
        while (feitas < plano.length) {
          // A pausa pega **aqui**, entre espécies: uma espécie é uma chamada só, e o servidor
          // apaga todos os dela de uma vez. Parar no meio dela não existe.
          if (parar) return dizer(`Parado. ${feitas} de ${plano.length} espécie(s) feitas.`);
          if (pausado) {
            dizer(`Pausado em ${feitas}/${plano.length}. Faltam ${faltam()} Pokémon.`);
            await espera(400);
            continue;
          }
          const alvo = plano[feitas];
          dizer(`Extraindo ${alvo.nome} (${alvo.quantos})… ${feitas + 1} de ${plano.length}.`);
          const r = await ponte({ acao: 'extrair', indice: feitas });
          if (r?.erro) {
            // Esperar nao e' falhar. **E repetir com a MESMA chave de idempotencia e' seguro**: se
            // o servidor recusou, nada aconteceu; se tinha acontecido, a chave impede a segunda.
            if (!podeEsperar(r)) return dizer(`Parei em ${alvo.nome}: ${r.erro}`, true);
            if (++tentativas > TENTATIVAS)
              return dizer(`Parei em ${alvo.nome}: ${r.erro} (tentei ${TENTATIVAS} vezes)`, true);
            const quanto = Math.min(ESPERA_MAXIMA, Number(r.esperarMs) || atraso);
            atraso = Math.min(ESPERA_MAXIMA, (Number(r.esperarMs) || atraso) * 2);
            dizer(
              `${alvo.nome}: o jogo pediu para esperar ${Math.ceil(quanto / 1000)}s. ` +
                `Tentativa ${tentativas} de ${TENTATIVAS}. Pausar e Parar continuam a valer.`,
            );
            await dormir(quanto);
            continue;
          }
          feitas++;
          tentativas = 0;
          atraso = ESPERA_INICIAL;
          desenharLista();
          if (feitas < plano.length) await dormir(respiro());
        }
        dizer(`Pronto: ${total()} Pokémon extraídos em ${plano.length} espécie(s).`);
      } finally {
        // A volta acontece por **todos** os caminhos de saída — acabou, parou, falhou. Deixar o
        // treinador plantado na cidade depois de um "Parar" é o mesmo que a Raridades aprendeu com
        // a mochila: quem mexe no jogo tem de saber desfazer.
        await voltarACacada();
        if (soltar) soltar();
        correndo = false;
        desenhar();
      }
    };

    /**
     * Mexer numa faixa invalida o plano, sempre.
     *
     * Um plano contado com outra pergunta não pode ficar na tela a convidar o clique em Extrair —
     * os números mudaram, a conta é outra, e o que se apaga é para sempre.
     */
    const mudouAFaixa = () => {
      gravar();
      plano = [];
      feitas = 0;
      desarmar();
      desenhar();
      dizer('Faixas mudadas. Procure de novo.');
    };

    const nomeDaRaridade = (chave) =>
      (RARIDADES.find(([k]) => k === chave) || [chave, chave])[1];

    for (const [seletor, chave] of [
      ['[data-cidade]', 'cidade'],
      ['[data-voltar]', 'voltar'],
    ])
      campo(seletor).addEventListener('change', (e) => {
        cfg[chave] = e.target.checked;
        gravar();
      });

    for (const [seletor, chave] of [
      ['[data-min]', 'minSeg'],
      ['[data-max]', 'maxSeg'],
    ])
      campo(seletor).addEventListener('change', (e) => {
        const v = Number(e.target.value);
        cfg[chave] = Math.round(
          Math.min(PAUSA_MAX, Math.max(PAUSA_MIN, Number.isFinite(v) ? v : PADRAO[chave])),
        );
        gravar();
        desenhar();
      });

    const agendaMudou = () => {
      cfg.horarios = horas.value.trim();
      cfg.dias = campoDias.value.trim();
      // Mudou a janela: o instante sorteado era da janela antiga.
      proxima = 0;
      gravar();
      const ok = calendario()?.valida({ horarios: cfg.horarios, dias: cfg.dias }) ?? true;
      horas.classList.toggle('campo-mau', Boolean(cfg.horarios) && !ok);
      editor?.resumir?.();
    };
    horas.addEventListener('change', agendaMudou);
    campoDias.addEventListener('change', agendaMudou);

    campo('[data-ligar]').addEventListener('click', () => {
      cfg.ligada = !cfg.ligada;
      proxima = 0;
      if (!cfg.ligada && correndo) parar = true;
      gravar();
      desarmar();
      desenhar();
      dizer(
        cfg.ligada
          ? 'Agenda ligada. Dentro da janela eu procuro e extraio sozinha — sem perguntar.'
          : 'Agenda parada. Só extraio se você clicar.',
      );
    });

    campo('[data-procurar]').addEventListener('click', () => void procurar());

    campo('[data-extrair]').addEventListener('click', () => {
      if (correndo || feitas >= plano.length) return;
      // O primeiro clique **não apaga nada**: arma a confirmação e diz o que vai acontecer.
      if (!confirmando) {
        confirmando = true;
        desenharBotoes();
        dizer(`Clique de novo para apagar ${faltam()} Pokémon. Qualquer outra coisa cancela.`);
        return;
      }
      void extrair();
    });

    campo('[data-pausar]').addEventListener('click', () => {
      pausado = !pausado;
      desenharBotoes();
      if (!pausado) dizer('Retomando…');
    });

    campo('[data-parar]').addEventListener('click', () => {
      parar = true;
      pausado = false;
      desenharBotoes();
      dizer('Vou parar depois desta espécie.');
    });

    /**
     * Quanto falta até a próxima corrida agendada, ou `null` se não há agenda.
     *
     * O instante é sorteado **dentro** da janela pelo próprio calendário, e não na abertura dela:
     * agir sempre às 03:00 em ponto é o padrão mais visível que existe. O `ultima` é o que impede
     * duas corridas na mesma janela — e é também o motivo de ele não viajar no exportar: o relógio
     * de uma conta não é configuração de outra.
     */
    const falta = () => {
      if (!cfg.ligada) return null;
      if (!proxima) {
        const ms = calendario()?.esperaDaAgenda({ horarios: cfg.horarios, dias: cfg.dias }, cfg.ultima);
        if (ms === null || ms === undefined) return null;
        proxima = Date.now() + Math.max(0, ms);
      }
      return Math.max(0, proxima - Date.now());
    };

    /**
     * A corrida da agenda: procura e extrai, sem perguntar.
     *
     * **A confirmação aqui foi dada quando a agenda foi ligada**, e não cabe pedi-la outra vez às
     * 04:00 com ninguém à frente do ecrã. É por isso que o botão diz "sem perguntar" com todas as
     * letras: ligar isto é uma decisão diferente de clicar em Extrair.
     *
     * Procura-se SEMPRE antes de extrair. Um plano de ontem é uma lista de Pokémon que podem já
     * não existir — ou, pior, outros que entretanto entraram e que ninguém viu.
     */
    const rodadaAgendada = async () => {
      cfg.ultima = Date.now();
      proxima = 0;
      gravar();
      await procurar();
      if (!plano.length) return;
      await extrair();
    };

    const bater = () => {
      if (correndo || !cfg.ligada) return;
      const f = falta();
      if (f !== null && f <= 0) void rodadaAgendada();
    };

    const botoes = globalThis.PPX?.config?.montarBotoes({
      id: 'genetica',
      nome: 'Genética',
      // O plano não viaja: é o retrato da coleção **desta** conta, e levá-lo para outra janela
      // seria mostrar uma conta que não é dela — a mesma regra das outras ferramentas.
      coletar: () => ({
        faixas: cfg.faixas,
        cidade: cfg.cidade !== false,
        voltar: cfg.voltar !== false,
        minSeg: cfg.minSeg,
        maxSeg: cfg.maxSeg,
        horarios: cfg.horarios,
        dias: cfg.dias,
        // `ligada` e `ultima` ficam de fora: a primeira poria outra janela a apagar Pokémon sem
        // ninguém ter mandado, e a segunda é o relógio DESTA conta — importá-lo faria a janela de
        // hoje passar por já usada. Ver o `config.js`.
      }),
      aplicar: (d) => {
        if (correndo) throw new Error('pare a extração antes de importar');
        cfg.faixas = limparFaixas(d?.faixas);
        cfg.cidade = d?.cidade !== false;
        cfg.voltar = d?.voltar !== false;
        for (const chave of ['minSeg', 'maxSeg']) {
          const n = Number(d?.[chave]);
          cfg[chave] = Number.isFinite(n)
            ? Math.round(Math.min(PAUSA_MAX, Math.max(PAUSA_MIN, n)))
            : PADRAO[chave];
        }
        cfg.horarios = String(d?.horarios || '').slice(0, 120);
        cfg.dias = String(d?.dias || '').slice(0, 120);
        // O que chega de fora vale como escolha, não como relógio: a agenda nasce parada e a
        // janela de hoje continua por usar.
        cfg.ligada = false;
        cfg.ultima = 0;
        proxima = 0;
        plano = [];
        feitas = 0;
        gravar();
        horas.value = cfg.horarios;
        if (editor) editor.escrever(cfg.dias);
        else campoDias.value = cfg.dias;
        desenhar();
      },
      avisar: dizer,
    });
    if (botoes) campo('[data-config]').append(botoes.el);

    // ------------------------------------------------------- janela e lugar

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
      campo('[data-titulo]').textContent = minimizado ? 'GEN' : 'Genética';
      campo('[data-minimizar]').textContent = minimizado ? '□' : '–';
      recolocar();
    };
    campo('[data-minimizar]').addEventListener('click', () => {
      minimizado = !minimizado;
      gravarChave(CHAVE_MIN, minimizado);
      desenharJanela();
    });
    campo('[data-fechar]').addEventListener('click', () => {
      // Fechar o painel com uma extração a andar seria perdê-la de vista sem a parar. Para-se.
      if (correndo) parar = true;
      mostrar(false);
      globalThis.PPX?.anotar?.('genetica', false);
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
    globalThis.PPX?.controlar?.('genetica', mostrar);
    mostrar(globalThis.PPX?.visivel?.('genetica') !== false);
    // As faixas de cada raridade são do jogo, não desta ferramenta — nunca um número inventado
    // aqui. Mas perguntar **uma vez só** era uma aposta, e ela falhou: em 05/11/2026 o painel do
    // dono mostrava a épica sozinha, sem lendária nenhuma, porque a resposta veio vazia. O
    // `PokemonCardData` do jogo pode ainda não estar montado quando a extensão sobe, e sem nova
    // pergunta a lendária não aparecia mais — nem reabrindo o painel, nem no dia seguinte.
    //
    // Então pergunta-se até o jogo responder: de dois em dois segundos, por dois minutos. Quem
    // responde vazio não é erro, é "ainda não"; quem nunca responder deixa o painel exactamente
    // como estava, com o que o dono já tinha escolhido.
    void (async () => {
      for (let tentativa = 0; tentativa < 60; tentativa += 1) {
        const r = await ponte({ acao: 'bandas' });
        if (r?.bandas && typeof r.bandas === 'object' && Object.keys(r.bandas).length) {
          bandas = r.bandas;
          desenhar();
          return;
        }
        await new Promise((pronto) => setTimeout(pronto, 2000));
      }
    })();
    if (cfg.ligada) dizer('Agenda ligada. Dentro da janela eu procuro e extraio sozinha.');
    const relogio = setInterval(bater, 30000);
    addEventListener('pagehide', () => clearInterval(relogio));
  },
);
