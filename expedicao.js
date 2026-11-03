// Expedição: avisa quando a janela abre, prepara tudo, entra no grupo — e para na verificação.
//
// ONDE ELA PARA, E PORQUE E' ALI. A expedição tem quatro passos: entrar no grupo, **resolver a
// verificação**, marcar pronto, e o líder iniciar. Esta ferramenta faz o primeiro e para. A
// verificação é um CAPTCHA do próprio jogo — "Clique em {species}", com a dica *"Cada integrante
// resolve o próprio desafio antes de marcar pronto"* — e existe para garantir que há uma pessoa em
// cada corrida. Responder por ela é a única coisa que tornaria a resposta falsa.
//
// Pedido do dono assim, em 03/11/2026: *"quero que construa tudo, até chegar na parte de
// confirmar, eu mesmo resolvo"*. É exactamente esta a fronteira.
//
// O QUE ELA TIRA DE CIMA DELE. Vigiar o relógio da janela — que abre por horário de servidor e
// dura pouco —, trocar para o time certo, parar a caçada, ir à cidade e entrar num grupo. E, no
// fim, devolver tudo: o time de antes e a caçada de antes. O trabalho chato é dela; os dois
// segundos que o jogo quer que sejam humanos continuam dele.
PPX.modulo(
  { id: 'expedicao', nome: 'Expedição', atalhos: 'configuração pelo menu (Alt+Q)' },
  () => {
    'use strict';

    const CHAVE = 'lioncode:expedicao:config';
    const CHAVE_POS = 'lioncode:expedicao:posicao';
    const CHAVE_MIN = 'lioncode:expedicao:minimizado';
    const PEDIDO = 'lioncode:expedicao:pedido';
    const RESPOSTA = 'lioncode:expedicao:resposta';
    const MINHA_VEZ = 'expedicao';

    /** De quanto em quanto se pergunta pela janela. A janela dura pouco; meio minuto chega. */
    const BATIDA = 30000;

    const PADRAO = {
      /** Preparar sozinha quando a janela abrir. Desligada, ela só avisa. */
      ligada: false,
      /** Trocar para este time antes de entrar. Vazio = fico com a equipe que está. */
      time: '',
      /** Ir à cidade antes de entrar no grupo. */
      cidade: true,
      /** Entrar num grupo público sozinha, ou só preparar e esperar por mim. */
      entrar: true,
      /** Entrar por este código em vez de um grupo público. Vazio = público. */
      codigo: '',
      /** No fim, devolver o time e a caçada de antes. */
      voltar: true,
      /**
       * Mandar recado no Telegram quando a janela abrir.
       *
       * Aqui fica so' o liga-desliga. O token do bot e o chat id **nao** moram nesta configuracao:
       * moram no `chrome.storage.local`, pelo `PPX.telegram` — ver o cabecalho do `telegram.js`.
       * Um token no `localStorage` seria uma senha a' vista do JavaScript da pagina.
       */
      recado: false,
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

    let eco = 0;
    const pedirAoJogo = (pedido) =>
      new Promise((resolver) => {
        const id = `x${Date.now()}-${++eco}`;
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
        }, 30000);
        dispatchEvent(new CustomEvent(PEDIDO, { detail: { eco: id, ...pedido } }));
      });
    const ponte = async (pedido) => {
      if (!(await ate(() => document.documentElement.dataset.lioncodeExpedicao === 'pronto', 20000)))
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
    painel.id = 'lioncode-expedicao';
    painel.innerHTML = `
      <header>
        <strong data-titulo>Expedição</strong>
        <button type="button" data-minimizar title="Minimizar">–</button>
        <button type="button" data-fechar title="Esconder">×</button>
      </header>
      <div class="resumo" data-resumo>—</div>
      <div class="botoes">
        <button type="button" data-ligar>Preparar sozinha</button>
        <button type="button" data-agora>Preparar agora</button>
      </div>
      <p class="aviso" data-falta></p>
      <div class="corpo">
        <label class="campo">
          time
          <select data-time><option value="">equipe atual</option></select>
          <button type="button" data-recarregar-times title="Atualizar a lista de times">↻</button>
        </label>
        <label class="caixa"><input type="checkbox" data-cidade> ir à cidade antes</label>
        <label class="caixa"><input type="checkbox" data-entrar> entrar num grupo sozinha</label>
        <label class="campo" title="Vazio: entro num grupo público. Com código: entro naquele grupo">
          código <input type="text" maxlength="12" placeholder="público" data-codigo>
        </label>
        <label class="caixa"><input type="checkbox" data-voltar> devolver time e caçada no fim</label>
        <label class="caixa" title="Quando a janela abrir, mando um recado no Telegram">
          <input type="checkbox" data-recado> avisar no Telegram
        </label>
        <div class="telegram" data-telegram hidden>
          <label class="campo" title="O token que o @BotFather te deu">
            token <input type="password" autocomplete="off" placeholder="123456789:AA…" data-token>
          </label>
          <label class="campo" title="O id da conversa — fale com o bot e veja em /getUpdates">
            chat id <input type="text" inputmode="numeric" maxlength="32" data-chat>
          </label>
          <button type="button" data-testar>Mandar um recado de teste</button>
        </div>
        <p class="nota" data-regras></p>
        <div data-config></div>
      </div>
      <p class="estado" data-estado>—</p>`;

    const estilo = document.createElement('style');
    estilo.textContent = `
      #lioncode-expedicao,#lioncode-expedicao *{box-sizing:border-box}
      #lioncode-expedicao{position:fixed;z-index:2147483000;width:252px;background:var(--ppx-fundo);color:var(--ppx-texto);border:1px solid var(--ppx-borda);border-radius:var(--ppx-raio);font:var(--ppx-fonte);box-shadow:var(--ppx-sombra);max-height:var(--ppx-teto);overflow:auto;scrollbar-width:thin;scrollbar-color:var(--ppx-borda) transparent}
      #lioncode-expedicao header{display:flex;gap:8px;align-items:center;padding:8px 10px;border-bottom:1px solid #2a3244;cursor:move}
      #lioncode-expedicao header strong{flex:1;font-size:13px}
      #lioncode-expedicao header button{border:0;background:none;color:#8b97a8;font-size:16px;cursor:pointer;padding:0 2px}
      #lioncode-expedicao .resumo{padding:6px 10px;color:#8b97a8;font-size:12px}
      #lioncode-expedicao .resumo.aberta{color:#7ee787}
      #lioncode-expedicao .botoes{display:flex;gap:6px;padding:0 10px 8px}
      #lioncode-expedicao .botoes button{flex:1;cursor:pointer;border:1px solid #2a3244;border-radius:6px;background:#182030;color:#e7edf6;padding:6px}
      #lioncode-expedicao .botoes button:disabled{opacity:.45;cursor:default}
      #lioncode-expedicao [data-ligar].a-correr{border-color:#3fb950;color:#7ee787;background:#12251a}
      #lioncode-expedicao .corpo{display:grid;gap:8px;padding:0 10px 10px}
      #lioncode-expedicao.minimizado .corpo{display:none}
      #lioncode-expedicao .campo{display:flex;align-items:center;gap:6px;color:#c3ccda;font-size:12px}
      #lioncode-expedicao .caixa{display:flex;align-items:center;gap:6px;color:#c3ccda;font-size:12px}
      #lioncode-expedicao select,#lioncode-expedicao input[type=text]{flex:1;min-width:0;border:1px solid #2a3244;border-radius:6px;background:#182030;color:#e7edf6;padding:5px}
      #lioncode-expedicao [data-recarregar-times]{flex:0 0 auto;border:1px solid #2a3244;border-radius:6px;background:#182030;color:#e7edf6;cursor:pointer;padding:4px 7px}
      #lioncode-expedicao .nota,#lioncode-expedicao .estado,#lioncode-expedicao .aviso{margin:0;font-size:12px;color:#8b97a8}
      #lioncode-expedicao .estado{padding:0 10px 10px}
      #lioncode-expedicao .estado.mau{color:#f85149}
      #lioncode-expedicao .aviso{padding:0 10px 8px;color:#f0c674}
      #lioncode-expedicao .aviso:empty{display:none}
      #lioncode-expedicao .telegram{display:grid;gap:6px;border:1px solid #2a3244;border-radius:6px;padding:7px}
      #lioncode-expedicao .telegram[hidden]{display:none}
      #lioncode-expedicao .telegram button{cursor:pointer;border:1px solid #2a3244;border-radius:6px;background:#182030;color:#e7edf6;padding:5px;font-size:12px}
      #lioncode-expedicao .telegram button:disabled{opacity:.45;cursor:default}`;

    const campo = (seletor) => painel.querySelector(seletor);
    const dizer = (texto, mau = false) => {
      const linha = campo('[data-estado]');
      linha.textContent = texto;
      linha.classList.toggle('mau', mau === true);
    };

    // ------------------------------------------------------------- estado

    let visto = null;
    let correndo = false;
    /** O time e a caçada de antes, para os devolver no fim. */
    let antes = null;
    /** A janela em que já se preparou, para não se preparar duas vezes na mesma. */
    let janelaFeita = '';
    /** A janela de que já se mandou recado. Um recado por janela, e não um a cada meio minuto. */
    let janelaAvisada = '';

    const relogio = (segundos) => {
      const s = Math.max(0, Math.round(segundos));
      const m = Math.floor(s / 60);
      return m >= 1 ? `${m} min` : `${s} s`;
    };

    const resumo = () => {
      const linha = campo('[data-resumo]');
      const falta = campo('[data-falta]');
      falta.textContent = '';
      if (!visto) return void (linha.textContent = 'Ainda não perguntei ao jogo.');
      if (visto.erro) return void (linha.textContent = visto.erro);
      if (!visto.ligada) return void (linha.textContent = 'As expedições estão desativadas agora.');
      linha.classList.toggle('aberta', visto.aberta === true);
      if (!visto.aberta) {
        linha.textContent = 'Janela fechada. Aviso quando abrir.';
        return;
      }
      const corridas = visto.corridas + visto.extras;
      linha.textContent = `Janela ABERTA · fecha em ${relogio(visto.restantes)} · ${corridas} corrida(s)`;
      if (visto.grupo) {
        // **A frase que importa.** Entrar é o que esta ferramenta faz; daqui em diante é ele.
        falta.textContent = visto.exigeVerificacao
          ? `No grupo ${visto.grupo.codigo} (${visto.grupo.membros}/${visto.grupo.lugares}). Falta a verificação e o Pronto — é com você.`
          : `No grupo ${visto.grupo.codigo} (${visto.grupo.membros}/${visto.grupo.lugares}). Falta marcar Pronto.`;
      } else if (!corridas) falta.textContent = 'Você já usou as corridas desta janela.';
    };

    const regras = () => {
      const nota = campo('[data-regras]');
      if (!visto || visto.erro || !visto.ligada) return void (nota.textContent = '');
      const partes = [];
      if (visto.minutos) partes.push(`${visto.minutos} min por expedição`);
      if (visto.maximo) partes.push(`grupo de ${visto.minimo} a ${visto.maximo}`);
      // Importa a quem joga em várias janelas no mesmo computador, que é o caso do dono.
      if (visto.umPorIp) partes.push('uma conta por IP');
      if (visto.exigeVerificacao) partes.push('verificação por integrante');
      nota.textContent = partes.join(' · ');
    };

    // ------------------------------------------------------------- recado
    //
    // O recado sai do computador porque o dono **nao esta' nele** — foi a objecao dele em
    // 03/11/2026 ao aviso na tela. Ver o cabecalho do `telegram.js`.
    //
    // E o que ele diz para' onde esta ferramenta para': que a janela abriu, quanto falta e, quando
    // ela ja' entrou no grupo, que a verificacao espera. **Nunca a resolve** — ver o cabecalho do
    // `expedicao-main.js` e o teste que guarda isso.
    const recado = async (texto) => {
      if (!cfg.recado) return;
      const r = await globalThis.PPX?.telegram?.avisar?.(texto);
      if (r?.erro) dizer(`Não mandei o recado: ${r.erro}`, true);
    };

    // ---------------------------------------------------------- preparação

    /**
     * Preparar: trocar o time, ir à cidade, entrar no grupo. **E parar.**
     *
     * A vez é pedida para o caminho inteiro e solta no fim: a partir daí a expedição é dele, e as
     * outras ferramentas já sabem esperar enquanto ela durar (ver `naExpedicao`, na Escada).
     */
    const preparar = async (porMinha = false) => {
      if (correndo) return;
      correndo = true;
      desenharBotoes();
      let soltar = null;
      /**
       * Esta preparacao falhou pelo meio?
       *
       * Importa por duas razoes. Uma: quem trocou o time e nao chegou ao grupo tem de o devolver
       * aqui mesmo — o `devolver()` da batida so' corre quando um grupo **existiu** e desapareceu,
       * e numa falha nunca houve grupo nenhum. Sem isto o dono ficava com o time de expedicao
       * montado, fora da caçada, e so' com um "nao entrei" na tela. Duas: uma falha passageira nao
       * pode queimar a janela inteira no `janelaFeita`.
       */
      let falhou = false;
      const falha = (texto) => {
        falhou = true;
        return dizer(texto, true);
      };
      try {
        soltar = await esperarAVez(dizer);
        if (!soltar) return falha('Desisti: o jogo ficou ocupado tempo demais.');

        // Lido ANTES de mexer em nada: depois da troca de time e do `stopHunt` já não há o que
        // perguntar, e era assim que se devolvia o lugar errado.
        antes = {
          cacada: globalThis.PPX?.cacadas?.atual?.() || null,
          // `qual()` é o nome do time guardado que casa com a equipe de agora — por id, e não por
          // nome de espécie. Vazio quer dizer "a equipe de agora não é nenhum time guardado", e aí
          // não há o que devolver: montar um palpite seria pior do que não mexer.
          time: cfg.time ? globalThis.PPX?.times?.qual?.() || '' : '',
        };

        if (cfg.time) {
          dizer(`Montando o time “${cfg.time}”…`);
          const troca = await globalThis.PPX?.times?.usar?.(cfg.time);
          if (!troca?.ok) return falha(`Não montei o time: ${troca?.erro || 'falhou'}`);
        }

        if (cfg.cidade) {
          dizer('Indo para a cidade…');
          const ida = await ponte({ acao: 'cidade' });
          if (ida?.erro) return falha(`Não consegui ir para a cidade: ${ida.erro}`);
        }

        if (!cfg.entrar) {
          dizer('Pronto para você: time montado e na cidade. Entre no grupo quando quiser.');
          return;
        }

        dizer(cfg.codigo ? `Entrando no grupo ${cfg.codigo}…` : 'Entrando num grupo público…');
        const entrou = await ponte({ acao: 'entrar', codigo: cfg.codigo });
        if (entrou?.erro) return falha(`Não entrei: ${entrou.erro}`);
        visto = entrou;
        resumo();
        // **O fim do caminho desta ferramenta.** Não existe aqui nenhuma chamada ao `ready`, e é
        // de propósito: ver o cabeçalho, e o teste que guarda isso.
        dizer(
          entrou.exigeVerificacao
            ? 'Entrei no grupo. Agora é com você: resolva a verificação e marque Pronto.'
            : 'Entrei no grupo. Agora é com você: marque Pronto.',
        );
        await recado(
          `No grupo ${entrou.grupo?.codigo || '?'} (${entrou.grupo?.membros || 0}/${entrou.grupo?.lugares || 0}).` +
            ` A janela fecha em ${relogio(entrou.restantes)}.` +
            (entrou.exigeVerificacao ? ' Falta a verificação e o Pronto — é com você.' : ' Falta marcar Pronto.'),
        );
      } finally {
        // Desfazer antes de soltar a vez: enquanto se devolve o time ainda se esta' a mexer no
        // jogo, e quem mexe no jogo tem a vez.
        if (falhou) await desfazer();
        if (soltar) soltar();
        correndo = false;
        // So' uma janela **preparada** conta como feita. Queimar a janela por causa de um "o jogo
        // ficou ocupado" seria perder a corrida do dia por um segundo mau.
        if (porMinha && !falhou) janelaFeita = visto?.fecha || '';
        desenhar();
      }
    };

    /**
     * Devolver o que se tirou quando a preparacao **nao chegou ao fim**.
     *
     * Mesmo trabalho do `devolver()`, outra ocasiao: aqui nao houve expedicao nenhuma, e a
     * mensagem que fica na tela e' a do erro — por isso esta nao escreve nada quando corre bem.
     */
    const desfazer = async () => {
      if (!cfg.voltar || !antes) return;
      const guardado = antes;
      antes = null;
      if (guardado.time) await globalThis.PPX?.times?.usar?.(guardado.time);
      if (guardado.cacada?.nome) {
        const volta = await globalThis.PPX?.cacadas?.ir?.(guardado.cacada.nome);
        if (!volta?.ok) dizer(`${campo('[data-estado]').textContent} (e não voltei à caçada)`, true);
      }
    };

    /**
     * Devolver o que se tirou: a caçada de antes e o time de antes.
     *
     * Só acontece quando a expedição **acabou** — o grupo desapareceu do estado depois de ter
     * existido. Durante a corrida não se mexe em nada: a equipe é a que está a lutar.
     */
    const devolver = async () => {
      if (!cfg.voltar || !antes) return;
      const guardado = antes;
      antes = null;
      if (guardado.time) await globalThis.PPX?.times?.usar?.(guardado.time);
      if (guardado.cacada?.nome) {
        const volta = await globalThis.PPX?.cacadas?.ir?.(guardado.cacada.nome);
        if (!volta?.ok) return dizer(`Expedição terminada, mas não voltei à caçada: ${volta?.erro || 'falhou'}`, true);
      }
      dizer('Expedição terminada. Devolvi o time e a caçada.');
    };

    // -------------------------------------------------------------- batida

    let tinhaGrupo = false;
    const bater = async () => {
      if (correndo) return;
      const r = await ponte({ acao: 'estado' });
      visto = r;
      resumo();
      regras();
      if (r?.erro) return;

      // A expedição acabou: o grupo existia e deixou de existir. É aqui, e só aqui, que se devolve
      // o que se tirou — durante a corrida a equipe é a que está a lutar.
      const temGrupo = Boolean(r.grupo);
      if (tinhaGrupo && !temGrupo) {
        tinhaGrupo = false;
        await devolver();
        return;
      }
      tinhaGrupo = temGrupo;

      // A janela abriu: um recado por janela, e **antes** de qualquer preparação, para quem está
      // longe decidir se vale ir ao computador.
      if (r.aberta && r.ligada && cfg.recado && janelaAvisada !== r.fecha) {
        janelaAvisada = r.fecha || '';
        const quantas = r.corridas + r.extras;
        await recado(
          quantas
            ? `Expedição ABERTA. Fecha em ${relogio(r.restantes)} · ${quantas} corrida(s).` +
                (cfg.ligada ? ' Vou preparar tudo e parar na verificação.' : ' A preparação é no seu clique.')
            : `Expedição aberta, mas as corridas desta janela já foram usadas.`,
        );
      }

      if (!cfg.ligada || !r.ligada || !r.aberta) return;
      if (temGrupo) return; // já está num grupo: não há o que preparar.
      if (r.corridas + r.extras < 1) return;
      // Uma janela, uma preparação. Sem isto, sair de um grupo faria a ferramenta voltar a
      // arrastar o jogador para dentro de outro, sem ninguém ter pedido.
      if (janelaFeita && janelaFeita === r.fecha) return;
      await preparar(true);
    };

    // ------------------------------------------------------------ ouvintes

    const preencherTimes = () => {
      const select = campo('[data-time]');
      const atual = cfg.time;
      select.replaceChildren(new Option('equipe atual', ''));
      for (const nome of globalThis.PPX?.times?.nomes?.() || []) select.append(new Option(nome, nome));
      select.value = atual;
    };

    campo('[data-time]').addEventListener('change', (e) => {
      cfg.time = e.target.value;
      gravar();
    });
    campo('[data-recarregar-times]').addEventListener('click', () => {
      preencherTimes();
      const quantos = globalThis.PPX?.times?.nomes?.().length || 0;
      dizer(quantos ? `${quantos} time(s) relido(s).` : 'Nenhum time guardado foi encontrado.', !quantos);
    });
    /**
     * O que o painel mostra do Telegram: "guardado" ou "falta".
     *
     * O valor **nunca** volta para o campo. Um campo de senha repovoado e' um segredo que qualquer
     * extensao, qualquer print e qualquer ombro leem de novo — e aqui nao ha' razao para o reler:
     * o painel so' precisa de saber se esta' configurado.
     */
    const desenharTelegram = async () => {
      const caixa = campo('[data-telegram]');
      caixa.hidden = !cfg.recado;
      if (!cfg.recado) return;
      const d = (await globalThis.PPX?.telegram?.ler?.()) || { token: '', chat: '' };
      const token = campo('[data-token]');
      token.value = '';
      token.placeholder = d.token ? 'guardado — escreva outro para trocar' : '123456789:AA…';
      campo('[data-chat]').value = d.chat;
    };

    const guardarTelegram = async () => {
      const token = campo('[data-token]').value;
      const chat = campo('[data-chat]').value;
      // Token vazio com chat escrito quer dizer "fica o token de antes": e' o unico jeito de mexer
      // no chat id sem ter de reescrever o segredo inteiro.
      const antigo = (await globalThis.PPX?.telegram?.ler?.()) || { token: '' };
      const r = await globalThis.PPX?.telegram?.guardar?.({ token: token || antigo.token, chat });
      if (r?.erro) return dizer(`Não guardei: ${r.erro}`, true);
      dizer(r?.tem ? 'Telegram guardado. Mande um recado de teste.' : 'Falta o token ou o chat id.', !r?.tem);
      await desenharTelegram();
    };
    for (const seletor of ['[data-token]', '[data-chat]'])
      campo(seletor).addEventListener('change', () => void guardarTelegram());
    campo('[data-testar]').addEventListener('click', async () => {
      const botao = campo('[data-testar]');
      botao.disabled = true;
      dizer('Mandando…');
      const r = await globalThis.PPX?.telegram?.avisar?.(
        'Teste do PokePixel: o recado da expedição chega aqui. Eu aviso quando a janela abrir — a verificação continua sua.',
      );
      botao.disabled = false;
      dizer(r?.ok ? 'Chegou? Então está pronto.' : `Não deu: ${r?.erro || 'falhou'}`, !r?.ok);
    });
    campo('[data-recado]').addEventListener('change', (e) => {
      cfg.recado = e.target.checked;
      // Desligar e voltar a ligar nao pode reaproveitar o "ja' avisei" de uma janela que ele nao viu.
      janelaAvisada = '';
      gravar();
      desenhar();
      void desenharTelegram();
    });

    for (const [seletor, chave] of [
      ['[data-cidade]', 'cidade'],
      ['[data-entrar]', 'entrar'],
      ['[data-voltar]', 'voltar'],
    ])
      campo(seletor).addEventListener('change', (e) => {
        cfg[chave] = e.target.checked;
        gravar();
        desenhar();
      });
    campo('[data-codigo]').addEventListener('change', (e) => {
      cfg.codigo = String(e.target.value || '')
        .trim()
        .toUpperCase()
        .slice(0, 12);
      gravar();
      desenhar();
    });
    campo('[data-ligar]').addEventListener('click', () => {
      cfg.ligada = !cfg.ligada;
      // Ligar não pode aproveitar uma janela que já foi preparada antes de ligar.
      janelaFeita = cfg.ligada ? janelaFeita : '';
      gravar();
      desenhar();
      dizer(
        cfg.ligada
          ? 'Quando a janela abrir eu preparo tudo e paro na verificação.'
          : 'Só aviso quando a janela abrir.',
      );
    });
    campo('[data-agora]').addEventListener('click', () => void preparar(false));

    const botoes = globalThis.PPX?.config?.montarBotoes({
      id: 'expedicao',
      nome: 'Expedição',
      coletar: () => ({
        time: cfg.time,
        cidade: cfg.cidade !== false,
        entrar: cfg.entrar !== false,
        codigo: cfg.codigo,
        voltar: cfg.voltar !== false,
        // `recado` viaja; o token e o chat id **nao** — nao estao nesta configuracao e nao e'
        // descuido: um token de bot num ficheiro que se manda para outra maquina e' uma senha
        // partilhada. Quem importar liga a caixa e escreve o seu.
        recado: cfg.recado === true,
        // `ligada` não viaja: importar uma expedição ligada poria a outra janela a arrastar o
        // jogador para um grupo sem ninguém ter mandado. Ver o `config.js`.
      }),
      aplicar: (d) => {
        if (correndo) throw new Error('espere a preparação terminar antes de importar');
        cfg.time = String(d?.time || '').slice(0, 80);
        cfg.cidade = d?.cidade !== false;
        cfg.entrar = d?.entrar !== false;
        cfg.codigo = String(d?.codigo || '')
          .trim()
          .toUpperCase()
          .slice(0, 12);
        cfg.voltar = d?.voltar !== false;
        cfg.recado = d?.recado === true;
        cfg.ligada = false;
        janelaFeita = '';
        janelaAvisada = '';
        gravar();
        preencherTimes();
        desenhar();
        void desenharTelegram();
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
    const desenharBotoes = () => {
      const ligar = campo('[data-ligar]');
      ligar.textContent = cfg.ligada ? 'Não preparar' : 'Preparar sozinha';
      ligar.classList.toggle('a-correr', cfg.ligada === true);
      ligar.disabled = correndo;
      campo('[data-agora]').disabled = correndo;
    };
    const desenhar = () => {
      campo('[data-cidade]').checked = cfg.cidade !== false;
      campo('[data-entrar]').checked = cfg.entrar !== false;
      campo('[data-voltar]').checked = cfg.voltar !== false;
      campo('[data-codigo]').value = cfg.codigo;
      campo('[data-recado]').checked = cfg.recado === true;
      campo('[data-telegram]').hidden = !cfg.recado;
      campo('[data-codigo]').closest('.campo').style.display = cfg.entrar ? '' : 'none';
      preencherTimes();
      desenharBotoes();
      painel.classList.toggle('minimizado', minimizado);
      campo('[data-titulo]').textContent = minimizado ? 'EXP' : 'Expedição';
      campo('[data-minimizar]').textContent = minimizado ? '□' : '–';
      resumo();
      regras();
      recolocar();
    };
    campo('[data-minimizar]').addEventListener('click', () => {
      minimizado = !minimizado;
      gravarChave(CHAVE_MIN, minimizado);
      desenhar();
    });
    campo('[data-fechar]').addEventListener('click', () => {
      mostrar(false);
      globalThis.PPX?.anotar?.('expedicao', false);
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
    void desenharTelegram();
    globalThis.PPX?.controlar?.('expedicao', mostrar);
    mostrar(globalThis.PPX?.visivel?.('expedicao') !== false);
    void bater();
    const tique = setInterval(() => void bater(), BATIDA);
    addEventListener('pagehide', () => clearInterval(tique));
  },
);
