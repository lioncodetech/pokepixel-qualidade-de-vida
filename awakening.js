// Awakening: sobe a Quality de um Pokémon dentro da raridade dele, e para no Challenge.
//
// A ESCADA DO JOGO, medida em 03/11/2026. A Quality mora em centésimos (1,49 é `149`) e cada
// raridade é uma faixa — épica 140–154, lendária 155–169. Dentro da faixa há **cinco AWK**, cada
// um +3 centésimos, e cada AWK custa só material:
//
//   AWK nº N = 1 Material Genético **da própria espécie** + **N** de qualquer espécie, todos da
//   mesma raridade. Não gasta gold nem diamantes.
//
// No teto da faixa entra o **Challenge**, que promove de raridade — e esse cobra gold ou
// diamantes, consome materiais **e faz perder XP**, derrubando o nível. Depois do mítico vem o
// **God Tier**.
//
// ONDE ELA PARA, E PORQUE. Ela faz **AWK**, que é o passo repetitivo e barato, e **mostra** o
// Challenge sem o executar. Perder nível é decisão de cada vez, não uma caixinha ligada de
// antemão — e uma ferramenta que a tomasse sozinha estaria a decidir a coisa mais cara do ecrã.
// Pedido do dono assim, em 03/11/2026, e há teste que cai se alguém acrescentar essa chamada.
//
// O GARGALO É SEMPRE O MESMO, e por isso o painel começa por ele: falta o material **da espécie
// certa**. A conta "faltam 2 de Ralts e 9 quaisquer" aparece antes de qualquer botão, porque é o
// que evita ficar a meio caminho com o material no fim.
PPX.modulo(
  { id: 'awakening', nome: 'Awakening', atalhos: 'configuração pelo menu (Alt+Q)' },
  () => {
    'use strict';

    const CHAVE = 'lioncode:awakening:config';
    const CHAVE_POS = 'lioncode:awakening:posicao';
    const CHAVE_MIN = 'lioncode:awakening:minimizado';
    const PEDIDO = 'lioncode:awakening:pedido';
    const RESPOSTA = 'lioncode:awakening:resposta';
    const MINHA_VEZ = 'awakening';

    /** Entre um AWK e o seguinte: o mesmo respiro sorteado da Genética, pelos mesmos motivos. */
    const MIN_MS = 2000;
    const MAX_MS = 5000;

    /**
     * `alvo` e' o rotulo escrito no campo; `alvoId` e' quem ele e' de verdade.
     *
     * Os dois, e nao so' o rotulo: o rotulo tem o nivel e a Quality dentro, e as duas mudam —
     * a Quality muda **por causa desta ferramenta**, a cada AWK. Guardar so' o texto fazia a
     * escolha morrer no primeiro uso e o painel voltar a "Escolha um Pokemon".
     */
    const PADRAO = { alvo: '', alvoId: '' };

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
      const inicio = Date.now();
      while (Date.now() - inicio < limite) {
        if (await fn()) return true;
        await espera(250);
      }
      return false;
    };
    const respiro = () => Math.round(MIN_MS + Math.random() * (MAX_MS - MIN_MS));

    let eco = 0;
    const pedirAoJogo = (pedido) =>
      new Promise((resolver) => {
        const id = `a${Date.now()}-${++eco}`;
        const ouvir = (e) => {
          if (e?.detail?.eco !== id) return;
          clearTimeout(limite);
          removeEventListener(RESPOSTA, ouvir);
          resolver(e.detail);
        };
        addEventListener(RESPOSTA, ouvir);
        const limite = setTimeout(() => {
          removeEventListener(RESPOSTA, ouvir);
          resolver({ erro: 'o jogo não respondeu — recarregue a página (F5)' });
        }, 45000);
        dispatchEvent(new CustomEvent(PEDIDO, { detail: { eco: id, ...pedido } }));
      });
    const ponte = async (pedido) => {
      if (!(await ate(() => document.documentElement.dataset.lioncodeAwakening === 'pronto', 20000)))
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

    const QUALIDADES = {
      weak: 'fraca',
      common: 'comum',
      uncommon: 'incomum',
      rare: 'rara',
      epic: 'épica',
      legendary: 'lendária',
      mythic: 'mítica',
    };
    /** Centésimos como o jogo os mostra: 149 vira "1,49". */
    const comoQuality = (cents) => (Number(cents) / 100).toFixed(2).replace('.', ',');

    // ------------------------------------------------------------- painel

    const painel = document.createElement('div');
    painel.id = 'lioncode-awakening';
    painel.innerHTML = `
      <header>
        <strong data-titulo>Awakening</strong>
        <button type="button" data-recarregar title="Reler a coleção">↻</button>
        <button type="button" data-minimizar title="Minimizar">–</button>
        <button type="button" data-fechar title="Esconder">×</button>
      </header>
      <div class="corpo">
        <label class="campo">
          Pokémon
          <input type="text" list="lioncode-awakening-bichos" data-alvo placeholder="nome ou apelido">
        </label>
        <datalist id="lioncode-awakening-bichos" data-bichos></datalist>
        <div class="quadro" data-etapa>Escolha um Pokémon.</div>
        <p class="conta" data-falta></p>
        <p class="aviso" data-challenge></p>
        <div class="botoes">
          <button type="button" data-um disabled>Fazer 1 AWK</button>
          <button type="button" data-teto disabled>Subir até o teto</button>
        </div>
        <div class="botoes">
          <button type="button" data-pausar disabled>Pausar</button>
          <button type="button" data-parar disabled>Parar</button>
        </div>
        <div data-config></div>
      </div>
      <p class="estado" data-estado>—</p>`;

    const estilo = document.createElement('style');
    estilo.textContent = `
      #lioncode-awakening,#lioncode-awakening *{box-sizing:border-box}
      #lioncode-awakening{position:fixed;z-index:2147483000;width:256px;background:var(--ppx-fundo);color:var(--ppx-texto);border:1px solid var(--ppx-borda);border-radius:var(--ppx-raio);font:var(--ppx-fonte);box-shadow:var(--ppx-sombra);max-height:var(--ppx-teto);overflow:auto;scrollbar-width:thin;scrollbar-color:var(--ppx-borda) transparent}
      #lioncode-awakening header{display:flex;gap:8px;align-items:center;padding:8px 10px;border-bottom:1px solid #2a3244;cursor:move}
      #lioncode-awakening header strong{flex:1;font-size:13px}
      #lioncode-awakening header button{border:0;background:none;color:#8b97a8;font-size:16px;cursor:pointer;padding:0 2px}
      #lioncode-awakening .corpo{display:grid;gap:8px;padding:10px}
      #lioncode-awakening.minimizado .corpo{display:none}
      #lioncode-awakening .campo{display:flex;align-items:center;gap:6px;color:#c3ccda;font-size:12px}
      #lioncode-awakening input{flex:1;min-width:0;border:1px solid #2a3244;border-radius:6px;background:#182030;color:#e7edf6;padding:5px}
      #lioncode-awakening .quadro{border:1px solid #2a3244;border-radius:6px;padding:7px;font-size:12px;color:#c3ccda;display:grid;gap:3px}
      #lioncode-awakening .quadro b{color:#e7edf6}
      #lioncode-awakening .quadro .ok{color:#7ee787}
      #lioncode-awakening .quadro .mau{color:#f0a0a0}
      #lioncode-awakening .botoes{display:flex;gap:6px}
      #lioncode-awakening .botoes button{flex:1;cursor:pointer;border:1px solid #2a3244;border-radius:6px;background:#182030;color:#e7edf6;padding:6px}
      #lioncode-awakening .botoes button:disabled{opacity:.45;cursor:default}
      #lioncode-awakening [data-pausar].pausado{border-color:#d29922;color:#f0c674}
      #lioncode-awakening .conta,#lioncode-awakening .estado,#lioncode-awakening .aviso{margin:0;font-size:12px;color:#8b97a8}
      #lioncode-awakening .aviso{color:#f0c674}
      #lioncode-awakening .aviso:empty,#lioncode-awakening .conta:empty{display:none}
      #lioncode-awakening .estado{padding:0 10px 10px}
      #lioncode-awakening .estado.mau{color:#f85149}`;

    const campo = (seletor) => painel.querySelector(seletor);
    const dizer = (texto, mau = false) => {
      const linha = campo('[data-estado]');
      linha.textContent = texto;
      linha.classList.toggle('mau', mau === true);
    };

    // ------------------------------------------------------------- estado

    let bichos = [];
    let visto = null;
    let correndo = false;
    let pausado = false;
    let parar = false;

    /** O rótulo que aparece na lista, e que também é o que o dono escreve no campo. */
    const rotulo = (b) =>
      `${b.apelido && b.apelido !== b.especie ? `${b.apelido} (${b.especie})` : b.especie}` +
      ` Lv ${b.nivel} · ${comoQuality(b.cents)}${b.brilhante ? ' ✨' : ''}`;

    // Pelo id primeiro; o rotulo fica como reserva para quem ja' tinha um alvo guardado antes
    // de o id passar a ser gravado.
    const escolhido = () =>
      (cfg.alvoId && bichos.find((b) => b.id === cfg.alvoId)) ||
      bichos.find((b) => rotulo(b) === cfg.alvo) ||
      null;

    const encherLista = () => {
      const lugar = campo('[data-bichos]');
      lugar.replaceChildren();
      // A equipe primeiro: é por ela que se começa, e com quase quatrocentos bichos uma lista
      // alfabética faria o dono rolar à procura do que tem à frente dos olhos.
      const ordem = { team: 0, inventory: 1, storage: 2 };
      for (const b of [...bichos].sort(
        (a, c) => (ordem[a.onde] ?? 9) - (ordem[c.onde] ?? 9) || c.cents - a.cents,
      ))
        lugar.append(new Option(rotulo(b)));
    };

    const desenharEtapa = () => {
      const quadro = campo('[data-etapa]');
      const falta = campo('[data-falta]');
      const aviso = campo('[data-challenge]');
      quadro.replaceChildren();
      falta.textContent = '';
      aviso.textContent = '';
      const linha = (texto, classe) => {
        const p = document.createElement('div');
        if (classe) p.className = classe;
        p.textContent = texto;
        quadro.append(p);
      };

      const alvo = escolhido();
      if (!alvo) return void linha('Escolha um Pokémon.');
      if (!visto || visto.erro) return void linha(visto?.erro || 'Ainda não li a prévia.', 'mau');
      if (!visto.ligado) return void linha('O Awakening está desativado agora.', 'mau');
      if (!visto.disponivel) return void linha('Este Pokémon não pode fazer Awakening.', 'mau');

      const e = visto.etapa;
      linha(`${QUALIDADES[e.tier] || e.tier} · Quality ${comoQuality(e.cents)} (faixa ${comoQuality(e.min)}–${comoQuality(e.max)})`);

      if (visto.awk) {
        const a = visto.awk;
        linha(`AWK ${a.indice} de ${a.total}: ${comoQuality(a.de)} → ${comoQuality(a.para)}`);
        if (a.especie)
          linha(
            `material de ${visto.especieDoMaterial}: ${a.especie.tem}/${a.especie.precisa}`,
            a.especie.tem >= a.especie.precisa ? 'ok' : 'mau',
          );
        if (a.generico)
          linha(
            `de qualquer espécie: ${a.generico.tem}/${a.generico.precisa}`,
            a.generico.tem >= a.generico.precisa ? 'ok' : 'mau',
          );
        // A conta que evita ficar a meio caminho com o material no fim.
        const t = visto.ateOTeto;
        falta.textContent =
          t.especie || t.generico
            ? `Até o teto (${comoQuality(e.max)}) faltam ${t.especie} de ${visto.especieDoMaterial} e ${t.generico} de qualquer espécie.`
            : `Dá para ir até o teto (${comoQuality(e.max)}) com o que você já tem.`;
      } else linha('Sem AWK agora.');

      // **O Challenge mostra-se, não se faz.** Ver o cabeçalho: perde nível e custa dinheiro.
      if (visto.challenge) {
        const c = visto.challenge;
        aviso.textContent =
          `No teto. O Challenge ${QUALIDADES[c.de] || c.de} → ${QUALIDADES[c.para] || c.para} é com você: ` +
          `${c.kills}/${c.killsPrecisa} kills ou ${c.stones}/${c.stonesPrecisa} Stones, ` +
          `custa ${c.gold} gold ou ${c.diamantes} diamantes, e perde ${c.xpPerdida}% da XP (fica no nível ${c.nivelDepois}).`;
      } else if (visto.etapa.proximo === 'challenge')
        aviso.textContent = 'No teto da raridade: daqui em diante é o Challenge, e esse é com você.';
    };

    const desenharBotoes = () => {
      const podeAwk = Boolean(visto?.awk?.podeAgora) && !correndo;
      campo('[data-um]').disabled = !podeAwk;
      campo('[data-teto]').disabled = !podeAwk;
      campo('[data-alvo]').disabled = correndo;
      const pausa = campo('[data-pausar]');
      pausa.disabled = !correndo;
      pausa.classList.toggle('pausado', pausado);
      pausa.textContent = pausado ? 'Retomar' : 'Pausar';
      campo('[data-parar]').disabled = !correndo;
    };

    const desenhar = () => {
      campo('[data-alvo]').value = cfg.alvo;
      desenharEtapa();
      desenharBotoes();
    };

    const verPrevia = async () => {
      const alvo = escolhido();
      if (!alvo) {
        visto = null;
        return desenhar();
      }
      visto = await ponte({ acao: 'previa', id: alvo.id });
      desenhar();
    };

    // --------------------------------------------------------------- agir

    /**
     * Um AWK, ou todos até o teto.
     *
     * A prévia é relida a cada passo e o `expected_quality_cents` vai com o pedido: se a Quality
     * mudou entretanto — outro separador, outra janela —, o servidor recusa em vez de fazer outra
     * coisa. Com material que se consome para sempre, recusar é a resposta certa.
     */
    const correr = async (ateOTeto) => {
      if (correndo) return;
      const alvo = escolhido();
      if (!alvo) return;
      correndo = true;
      pausado = false;
      parar = false;
      desenharBotoes();
      let soltar = null;
      let feitos = 0;
      try {
        soltar = await esperarAVez(dizer);
        if (!soltar) return dizer('Desisti: o jogo ficou ocupado tempo demais.', true);
        for (;;) {
          if (parar) break;
          if (pausado) {
            dizer(`Pausado depois de ${feitos} AWK.`);
            await espera(400);
            continue;
          }
          if (!visto?.awk?.podeAgora) break;
          const de = visto.etapa.cents;
          dizer(`AWK ${visto.awk.indice}/${visto.awk.total}: ${comoQuality(de)} → ${comoQuality(visto.awk.para)}…`);
          const r = await ponte({ acao: 'awk', id: alvo.id, cents: de });
          if (r?.erro) return dizer(`Parei: ${r.erro}`, true);
          feitos += 1;
          visto = await ponte({ acao: 'previa', id: alvo.id });
          desenhar();
          if (!ateOTeto) break;
          if (!visto?.awk?.podeAgora) break;
          await espera(respiro());
        }
        const agora = visto?.etapa?.cents;
        dizer(
          feitos
            ? `${feitos} AWK feito(s). Quality agora: ${comoQuality(agora)}.`
            : 'Nada feito: falta material.',
        );
      } finally {
        if (soltar) soltar();
        correndo = false;
        desenhar();
      }
    };

    // ------------------------------------------------------------ ouvintes

    const relerBichos = async () => {
      const r = await ponte({ acao: 'lista' });
      if (r?.erro) return dizer(r.erro, true);
      bichos = Array.isArray(r.bichos) ? r.bichos : [];
      encherLista();
      // O rotulo do alvo e' reescrito a partir de quem ele e': depois de um AWK a Quality dele
      // mudou, e o campo tem de mostrar a de agora em vez de uma que ja' nao existe.
      const alvo = escolhido();
      if (alvo) {
        cfg.alvo = rotulo(alvo);
        cfg.alvoId = alvo.id;
        gravar();
      }
      await verPrevia();
      dizer(`${bichos.length} Pokémon na lista.`);
    };

    campo('[data-alvo]').addEventListener('change', (e) => {
      cfg.alvo = String(e.target.value || '').slice(0, 120);
      cfg.alvoId = bichos.find((b) => rotulo(b) === cfg.alvo)?.id || '';
      gravar();
      void verPrevia();
    });
    campo('[data-recarregar]').addEventListener('click', () => void relerBichos());
    campo('[data-um]').addEventListener('click', () => void correr(false));
    campo('[data-teto]').addEventListener('click', () => void correr(true));
    campo('[data-pausar]').addEventListener('click', () => {
      pausado = !pausado;
      desenharBotoes();
      if (!pausado) dizer('Retomando…');
    });
    campo('[data-parar]').addEventListener('click', () => {
      parar = true;
      pausado = false;
      desenharBotoes();
      dizer('Vou parar depois deste AWK.');
    });

    const botoes = globalThis.PPX?.config?.montarBotoes({
      id: 'awakening',
      nome: 'Awakening',
      // Nem o alvo viaja: é um Pokémon DESTA conta, e o rótulo dele noutra janela ou não existe ou
      // é outro bicho. Mesma regra da pedra do modo de grupo, na Escada.
      coletar: () => ({}),
      aplicar: () => {
        if (correndo) throw new Error('espere o AWK terminar antes de importar');
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
      campo('[data-titulo]').textContent = minimizado ? 'AWK' : 'Awakening';
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
      globalThis.PPX?.anotar?.('awakening', false);
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
    globalThis.PPX?.controlar?.('awakening', mostrar);
    mostrar(globalThis.PPX?.visivel?.('awakening') !== false);
    void relerBichos();
  },
);
