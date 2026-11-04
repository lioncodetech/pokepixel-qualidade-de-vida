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
// O RELÉ PELA FOTO, E PORQUE ELE NÃO MUDA ESSA FRONTEIRA. Medido na conta do dono em 04/11/2026:
// a verificação desenha os nove numa **única** `<img class="expedition-captcha__image">` — um
// `data:` URI de ~40 KB — com nove `<button class="expedition-captcha__tile">` transparentes por
// cima, rotulados só por `aria-label="coluna N, linha N"`. Não há `alt`, não há `title`, não há
// URL de sprite com o id: **o jogo não põe o nome em lado nenhum do DOM**. A resposta só existe
// nos pixels, e isso é uma decisão de quem fez o jogo.
//
// Então o relé faz só o transporte: manda essa imagem ao Telegram com os nove quadrados numerados,
// espera que **uma pessoa** a reconheça e responda 1 a 9, e clica no quadrado que ela disse. A
// extensão não olha para a figura, não a compara com nada, não guarda o que era e não sugere nem
// ordena nada. Quem reconhece continua a ser o dono; o que mudou foi só o sítio de onde ele clica.
// Tirar qualquer uma dessas três — olhar, guardar ou sugerir — passava a fronteira, e há testes
// que caem se alguém o fizer.
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
      /**
       * Deixar o dono responder a verificacao pelo Telegram.
       *
       * Desligado por omissao: isto manda uma foto e espera que ele esteja com o telefone na mao.
       * Ligado sem ninguem do outro lado, so' queima a janela a' espera.
       */
      pelaFoto: false,
      /**
       * Esperar entre `esperaMin` e `esperaMax` minutos depois de a janela abrir, antes de entrar.
       *
       * E' a fila entre as janelas do dono, pedida em 04/11/2026. A janela de expedicao e' do
       * servidor, nao da conta: abre a' MESMA hora para todas as contas dele. Sem isto, todas
       * perguntam no mesmo instante e disputam o mesmo bot. Dando a cada janela um intervalo
       * diferente — 0 a 5 numa, 5 a 10 noutra — elas passam uma de cada vez.
       *
       * Zero nos dois desliga, e entra-se assim que a janela abre, como sempre foi.
       */
      esperaMin: 0,
      esperaMax: 0,
      /**
       * Perguntar no Telegram antes de entrar no grupo, e so' entrar se o dono deixar.
       *
       * Pedido dele em 04/11/2026. A razao e' simples: entrar gasta a corrida da janela, e ele pode
       * estar no meio de outra coisa. O "sim" dele e' que faz a corrida comecar.
       */
      licenca: false,
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
        <label class="campo" title="Entro num minuto sorteado entre os dois, contado desde que a janela abriu. Zero nos dois: entro logo">
          entrar entre
          <input type="number" min="0" max="180" step="1" data-esperamin>
          e
          <input type="number" min="0" max="180" step="1" data-esperamax>
          min
        </label>
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
          <label class="caixa" title="Mando a foto da verificação numerada; você responde 1 a 9 e eu clico ali">
            <input type="checkbox" data-pelafoto> responder a verificação pela foto
          </label>
          <label class="caixa" title="Antes de entrar no grupo, pergunto no Telegram e espero o seu sim">
            <input type="checkbox" data-licenca> pedir licença antes de entrar
          </label>
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
    /** O minuto sorteado para esta janela, para não mudar a cada batida. */
    let sorteado = { janela: '', segundos: 0 };
    /** Ate' quando nao se volta a tentar, depois de a leitura do bot ter sido roubada. */
    let adiadoAte = 0;

    /**
     * Quantos segundos esperar depois de a janela abrir, nesta janela.
     *
     * Sorteia-se **uma vez por janela** — sortear a cada batida fazia a hora de entrar fugir para
     * a frente de meio em meio minuto, e nunca chegava. E o sorteio e' cortado para caber: nunca
     * passa de três minutos antes de a janela fechar, senão a espera comia a corrida do dia.
     */
    const esperaDaJanela = (r) => {
      const min = Math.max(0, Math.min(180, Number(cfg.esperaMin) || 0));
      const max = Math.max(min, Math.min(180, Number(cfg.esperaMax) || 0));
      if (!max) return 0;
      if (sorteado.janela !== r.fecha) {
        const bruto = Math.round((min + Math.random() * (max - min)) * 60);
        const cabe = Math.max(0, (Number(r.restantes) || 0) - 180);
        sorteado = { janela: r.fecha || '', segundos: Math.min(bruto, cabe) };
      }
      return sorteado.segundos;
    };

    /**
     * Ja' passou o tempo sorteado desde que a janela abriu?
     *
     * Conta-se de `opens_at` (medido em 04/11/2026: ISO com `Z`, que o `Date.parse` le'), e nao do
     * momento em que a extensao acordou — senao um F5 reiniciava a contagem e duas janelas voltavam
     * a cair em cima uma da outra. Sem `opens_at` legivel nao se adia nada: perder a corrida por
     * uma data que nao se soube ler seria pior do que entrar cedo.
     */
    const naHoraDeEntrar = (r) => {
      const espera = esperaDaJanela(r);
      if (!espera) return true;
      const abriu = Date.parse(String(r.abre || ''));
      if (!Number.isFinite(abriu)) return true;
      return Date.now() - abriu >= espera * 1000;
    };

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
    /**
     * Quem e' esta janela, para o recado dizer de quem fala.
     *
     * Pedido do dono em 04/11/2026, e e' preciso justamente porque ele joga em varias janelas: com
     * tres contas no mesmo bot, "posso entrar?" sem nome nao se sabe de quem e'. Sai do HUD do
     * proprio jogo — medido no mesmo dia: `.pokeidle-trainer-hud__name` e o servidor em
     * `.world-servers-fab__name`, porque a mesma conta pode existir em mundos diferentes.
     */
    const quem = () => {
      const texto = (s) => document.querySelector(s)?.textContent?.trim() || '';
      const nome = texto('.pokeidle-trainer-hud__name');
      const mundo = texto('.world-servers-fab__name');
      return [nome, mundo].filter(Boolean).join(' · ') || 'conta sem nome';
    };

    /** Toda mensagem que sai daqui leva o carimbo de quem a mandou. */
    const comConta = (texto) => `[${quem()}] ${texto}`;

    const recado = async (texto) => {
      if (!cfg.recado) return;
      const r = await globalThis.PPX?.telegram?.avisar?.(comConta(texto));
      if (r?.erro) dizer(`Não mandei o recado: ${r.erro}`, true);
    };

    // ------------------------------------------------------- o relé da foto

    /**
     * Os sitios medidos na conta do dono em 04/11/2026. Se o jogo mudar as classes, o relé desiste
     * e diz porque — nao tenta adivinhar outra coisa parecida e clicar nela.
     */
    const VERIFICACAO = '.expedition-captcha-window';
    const GRADE = '.expedition-captcha__grid';
    const RETRATO = '.expedition-captcha__image';
    /** As abas da janela de expedicoes. A do grupo e' `[data-tab="group"]`. */
    const ABAS = '.expedition-tab';
    /** Quanto se espera pela pessoa. O desafio do jogo expira em ~90 s; aqui para-se antes. */
    const ATE_RESPONDER = 72;
    /**
     * Quantas figuras se chega a mandar no mesmo grupo.
     *
     * Errar e' suposto poder acontecer — pedido do dono em 04/11/2026. Se o quadrado tocado nao
     * fechar a verificacao, manda-se a figura seguinte em vez de desistir: o jogo troca o desafio
     * e ele tenta de novo, como teria feito ao computador.
     */
    const RONDAS = 5;
    /** Quantos grupos diferentes se chega a tentar na mesma janela, se ele pedir outro. */
    const GRUPOS = 4;
    /** Quanto se espera pelo "sim" para entrar. Dez minutos: a janela dura bem mais do que isso. */
    const ATE_LICENCA = 600;
    /** Ate' quando se vigia a janela do jogo depois do Pronto, se a corrida nao comecar. */
    const ATE_COMECAR = 900000;

    /**
     * Pedir licenca para entrar, e esperar.
     *
     * Corre **antes** de pedir a vez na fila, de proposito: ate' dez minutos a' espera de uma
     * resposta nao podem ser dez minutos com a caçada parada atras de nos. Enquanto ele nao
     * responde, nada no jogo foi tocado — nao ha' nada para desfazer se ele disser que nao.
     */
    const pedirLicenca = async (r) => {
      const quantas = (r?.corridas || 0) + (r?.extras || 0);
      dizer('Pedi licença no Telegram. Esperando o seu sim…');
      const resposta = await globalThis.PPX?.telegram?.perguntar?.({
        legenda: comConta(
          `Expedição aberta — fecha em ${relogio(r?.restantes || 0)}, ${quantas} corrida(s).\n` +
            'Posso procurar grupo e entrar? Toque num botão — ou escreva SIM ou NÃO, se preferir.',
        ),
        segundos: ATE_LICENCA,
        // Dois botoes no proprio Telegram, pedido do dono em 04/11/2026: responder de dentro do
        // bolso, sem teclado. O escrito continua a valer — o toque e' o caminho curto, nao o unico.
        botoes: [
          [
            { texto: '✅ Procurar e entrar', valor: 'sim' },
            { texto: '✋ Agora não', valor: 'nao' },
          ],
        ],
        aceitar: (texto) => {
          const d = String(texto)
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
          if (/^(sim|s|ok|pode|vai|entra|bora)$/.test(d)) return true;
          if (/^(nao|n|negativo|deixa|para)$/.test(d)) return false;
          return null;
        },
      });
      if (resposta?.erro) {
        // **Nao e' um "nao".** Se duas janelas do dono partilham o bot, a que chega depois rouba a
        // leitura desta e ela apanha um `409` sem ele ter escrito nada. Dar isso por recusa queimava
        // a corrida do dia em silencio. Entao: diz-se o que foi, e devolve-se `'erro'` — quem chama
        // tenta mais logo, em vez de dar a janela por tratada.
        dizer(`Não perguntei: ${resposta.erro}.`, true);
        return resposta.conflito ? 'conflito' : 'erro';
      }
      if (resposta.resposta !== true) {
        dizer('Você disse que não. Não entrei.');
        await recado('Combinado: não entrei nesta janela.');
        return 'nao';
      }
      return 'sim';
    };

    /**
     * Abrir a janela de expedicoes do jogo e **deixa-la aberta** ate' a corrida comecar.
     *
     * Pedido do dono em 04/11/2026, e nao e' so' gosto: medido no mesmo dia, o "Estou pronto" e a
     * verificacao so' existem no DOM com aquela janela aberta. Quem responde pelo telefone nao
     * esta' ca' para a abrir — nem para a reabrir se alguma coisa a fechar no meio.
     *
     * Vigia **sem a vez na mao**: abrir um painel nao mexe no personagem, e segurar a fila por
     * quinze minutos para isto seria prender a caçada por causa de uma janela.
     */
    const abrirJanela = () => ponte({ acao: 'janela' });

    const vigiarJanela = async () => {
      const fim = Date.now() + ATE_COMECAR;
      while (Date.now() < fim) {
        const r = await ponte({ acao: 'corrida' });
        if (r?.correndo) return;
        await abrirJanela();
        await new Promise((ok) => setTimeout(ok, 4000));
      }
    };

    /**
     * Desistir: fechar a verificacao e sair do grupo.
     *
     * Tambem de 04/11/2026: *"se eu nao responder ate' os 72 segundos, cancela o desafio e sai da
     * expedicao"*. O porque e' do dono, e e' justo — um lugar preso num grupo de quatro e' um grupo
     * que nao comeca, e quem fica a' espera sao outras tres pessoas.
     */
    const desistir = async (motivo) => {
      const fechar = document.querySelector(`${VERIFICACAO} .pokeidle-panel__close`);
      if (fechar) fechar.click();
      const saiu = await ponte({ acao: 'sair' });
      const bem = !saiu?.erro;
      dizer(bem ? `${motivo} Saí da expedição.` : `${motivo} E não consegui sair: ${saiu.erro}`, true);
      await recado(
        bem
          ? `${motivo} Saí do grupo e devolvi o time e a caçada — o lugar não ficou preso.`
          : `${motivo} E não consegui sair do grupo: ${saiu.erro}. Veja no computador.`,
      );
      return bem;
    };

    /**
     * O desafio desenhado e **preenchido**, ou nada.
     *
     * Isto existe por um erro meu, apanhado no teste do dono em 04/11/2026: a grade e a imagem
     * aparecem no DOM **vazias** e so' depois sao preenchidas. Eu esperava pelos elementos, lia no
     * instante seguinte e via zero quadrados — e desistia a dizer que a verificacao tinha mudado
     * de formato, quando ela so' ainda nao tinha acabado de nascer. Esperar pelo conteudo, e nao
     * pelo elemento, e' a diferenca entre as duas coisas.
     */
    const desafioPronto = () => {
      const grade = document.querySelector(GRADE);
      const retrato = document.querySelector(RETRATO);
      if (!grade || !retrato || grade.children.length !== 9) return null;
      return (retrato.currentSrc || retrato.src) ? { grade, retrato } : null;
    };

    /**
     * Levar a janela do jogo a' aba **Meu Grupo**.
     *
     * Apanhado pelo dono no teste de 04/11/2026, com um circulo a volta da aba: a janela abre na
     * aba "Expedicao", e o "Estou pronto" nao esta' la' — esta' na "Meu Grupo", que ninguem abriu.
     * Quem joga carrega nela sem pensar; o rele nao, e ficava a procurar um botao que existe noutro
     * ecra. Medido no mesmo dia: as abas sao `.expedition-tab[data-tab]`, e a do grupo e' `group`.
     */
    const abaDoGrupo = async () => {
      const aba = document.querySelector(`${ABAS}[data-tab="group"]`);
      if (!aba) return false;
      if (!aba.classList.contains('is-active')) aba.click();
      return ate(() => Boolean(botaoPronto()), 5000);
    };

    /** O "Estou pronto" do jogo, achado pelo texto: a classe dele e' a de qualquer botao. */
    const botaoPronto = () =>
      [...document.querySelectorAll('button')].find(
        (b) => /estou pronto/i.test(b.textContent || '') && !b.disabled,
      ) || null;

    /**
     * Numerar os nove quadrados **na propria foto**, de 1 a 9, da esquerda para a direita.
     *
     * Sem isto o dono teria de descrever o lugar por palavras. Os quadrados sao tercos exactos da
     * imagem (medido: grade de 336x304 em tiles de 112x101), entao os numeros caem onde devem sem
     * se saber nada do que esta' desenhado. O `data:` URI nao suja a tela, por ser da propria
     * pagina — um sprite servido de outro dominio sujaria, e o `toBlob` falharia.
     */
    const numerar = (fonte) =>
      new Promise((ok) => {
        const img = new Image();
        img.onload = () => {
          try {
            const tela = document.createElement('canvas');
            tela.width = img.naturalWidth;
            tela.height = img.naturalHeight;
            const c = tela.getContext('2d');
            c.drawImage(img, 0, 0);
            const lx = tela.width / 3;
            const ly = tela.height / 3;
            const corpo = Math.max(14, Math.round(ly / 3.4));
            c.font = `bold ${corpo}px sans-serif`;
            c.textBaseline = 'top';
            for (let i = 0; i < 9; i += 1) {
              const x = (i % 3) * lx + 5;
              const y = Math.floor(i / 3) * ly + 5;
              c.fillStyle = 'rgba(0,0,0,.72)';
              c.fillRect(x, y, corpo * 0.95, corpo * 1.15);
              c.fillStyle = '#fff';
              c.fillText(String(i + 1), x + corpo * 0.22, y + corpo * 0.08);
            }
            tela.toBlob((b) => ok(b || null), 'image/png');
          } catch {
            ok(null);
          }
        };
        img.onerror = () => ok(null);
        img.src = fonte;
      });

    /**
     * Mandar a verificacao ao telefone e clicar onde o dono disser.
     *
     * Corre **com a vez na mao**, de propósito: entre mandar a foto e clicar passam-se ate' 72
     * segundos, e nesse intervalo ninguem mais pode estar a mexer no jogo — uma caçada que trocasse
     * de mapa no meio fechava a janela debaixo do clique. E' muito tempo para a fila, e e' por isso
     * que ha' um tecto: passado o prazo, larga-se.
     *
     * Devolve `'pronto'` se chegou a clicar num quadrado (e nao se a resposta estava certa — isso
     * quem diz e' o jogo), `'saiu'` se desistiu e saiu do grupo, e `'parado'` se parou e deixou a
     * verificacao para o dono resolver no computador.
     */
    const responderPelaFoto = async () => {
      // Primeiro a aba certa: sem ela, o botao que se procura a seguir nem existe no DOM.
      await abaDoGrupo();
      const abrir = botaoPronto();
      if (!abrir) {
        dizer('Não achei o “Estou pronto” na aba Meu Grupo. A verificação é com você.', true);
        await recado('Entrei no grupo, mas não achei o botão da verificação. É com você, no computador.');
        return 'parado';
      }
      abrir.click();
      if (!(await ate(() => Boolean(desafioPronto()), 12000))) {
        dizer('A verificação não abriu (ou não terminou de desenhar). É com você.', true);
        await recado('Entrei no grupo, mas a verificação não abriu sozinha. É com você, no computador.');
        return 'parado';
      }

      for (let ronda = 1; ronda <= RONDAS; ronda += 1) {
        if (!document.querySelector(VERIFICACAO)) break;
        // Outra vez a espera pelo conteudo: entre rondas o jogo troca o desafio, e por um instante
        // a grade fica vazia de novo.
        if (!(await ate(() => Boolean(desafioPronto()), 12000))) {
          dizer('A verificação não terminou de desenhar. Não mexo.', true);
          await recado('A verificação não acabou de carregar e eu não mexo nela às cegas. É com você, no computador.');
          return 'parado';
        }
        const caixa = document.querySelector(VERIFICACAO);
        const { grade, retrato } = desafioPronto();
        const imagem = await numerar(retrato.currentSrc || retrato.src);
        if (!imagem) {
          dizer('Não consegui preparar a foto. É com você.', true);
          await recado('Não consegui preparar a foto da verificação. É com você, no computador.');
          return 'parado';
        }
        // A pergunta e' do jogo ("Clique em …"), e vai como legenda para o dono a ler. A extensao
        // nao a usa para nada: ela nao sabe qual dos nove e' aquele, e e' esse o ponto.
        const pergunta =
          (caixa.innerText || '')
            .split('\n')
            .map((l) => l.trim())
            .find((l) => /^clique em/i.test(l)) || 'Resolva a verificação da expedição';

        dizer(`Mandei a verificação no Telegram (${ronda}/${RONDAS}). Responda 1 a 9.`);
        const r = await globalThis.PPX?.telegram?.perguntar?.({
          imagem,
          legenda: comConta(`${pergunta}\nToque no número do quadrado. O 1 é o de cima à esquerda.`),
          segundos: ATE_RESPONDER,
          // Os nove botoes na mesma arrumacao da figura: tres linhas de tres, para o dedo cair
          // onde o olho esta'. Uma fila de nove nao casava com a grade e convidava ao engano.
          botoes: [
            ...[
              [1, 2, 3],
              [4, 5, 6],
              [7, 8, 9],
            ].map((linha) => linha.map((n) => ({ texto: String(n), valor: String(n) }))),
            // A terceira saida, pedida em 04/11/2026: este grupo nao serve — sai e procura outro.
            [{ texto: '🔁 Sair e procurar outro grupo', valor: 'outro' }],
          ],
          // Um numero, e nada mais. Nem "o 3", nem "acho que 3": o que vier torto nao vira clique.
          aceitar: (texto) => {
            const d = String(texto).trim().toLowerCase();
            if (/^[1-9]$/.test(d)) return Number(d);
            // "outro" tambem se escreve, para quem responde pelo teclado.
            return d === 'outro' ? 'outro' : null;
          },
        });
        if (r?.erro) {
          // **So' o prazo faz sair.** Sair do grupo foi um pedido do dono para UM caso: ele nao
          // respondeu a tempo. Um erro de rede, um token recusado ou outra janela a usar o mesmo
          // bot nao sao esse caso — nesses, a verificacao fica aberta para ele, e o lugar fica.
          // Antes disto, qualquer erro mandava sair: bastava outra janela arrancar para esta
          // desistir da expedicao sozinha, sem ele ter feito nada.
          if (r.prazo) {
            await desistir(`Ninguém respondeu em ${ATE_RESPONDER}s.`);
            return 'saiu';
          }
          dizer(`Não consegui perguntar: ${r.erro}. A verificação ficou aberta para você.`, true);
          await recado(`Não consegui levar a verificação até você: ${r.erro}. Ela ficou aberta no computador.`);
          return 'parado';
        }

        if (r.resposta === 'outro') {
          // Ele viu o grupo e nao o quis. Sai-se, e quem chamou volta a' primeira pergunta — sem
          // devolver o time nem a caçada, que ainda vamos precisar deles no grupo seguinte.
          const fechar = document.querySelector(`${VERIFICACAO} .pokeidle-panel__close`);
          if (fechar) fechar.click();
          const fora = await ponte({ acao: 'sair' });
          if (fora?.erro) {
            dizer(`Você pediu outro grupo, mas não consegui sair: ${fora.erro}`, true);
            await recado(`Você pediu outro grupo, mas não consegui sair deste: ${fora.erro}`);
            return 'parado';
          }
          dizer('Saí do grupo. Vou perguntar de novo se procuro outro.');
          return 'outro';
        }

        // Entre a pergunta e a resposta passaram-se ate' 72 s: a grade de agora pode ja' nao ser
        // aquela da foto. Entao vai-se buscar o quadrado **outra vez**, e so' se clica se a
        // verificacao ainda for a mesma — clicar as cegas acertaria no quadrado errado de um
        // desafio que o dono nunca viu.
        const agora = document.querySelector(GRADE);
        const alvo = agora?.children?.[r.resposta - 1];
        const mesma = agora === grade && document.querySelector(RETRATO)?.src === retrato.src;
        if (!alvo || !mesma) {
          dizer('A verificação trocou antes da sua resposta. Não cliquei.', true);
          await recado('Cheguei tarde: o desafio trocou antes da sua resposta, e eu não cliquei em nada.');
          return 'parado';
        }
        // **O clique, e nada guardado.** O numero vive ate' aqui e acaba aqui: nao ha' ficheiro
        // nenhum a aprender que figura era esta. Ver o cabecalho.
        alvo.click();
        await ate(() => document.querySelector(GRADE) !== grade, 6000);
        if (!document.querySelector(VERIFICACAO)) {
          const marcar = botaoPronto();
          if (marcar) marcar.click();
          dizer(`Cliquei no ${r.resposta} que você disse${marcar ? ' e marquei Pronto' : ''}.`);
          await recado(
            `Cliquei no ${r.resposta}${marcar ? ' e marquei Pronto' : ''}. O resto da corrida é com o grupo.`,
          );
          return 'pronto';
        }
        // Continua aberta: ou a resposta nao foi aceite, ou o jogo trocou o desafio. Manda-se o
        // novo, em vez de insistir no mesmo numero.
        dizer(`O ${r.resposta} não foi aceito. Mandando o desafio novo…`);
        await recado(`O ${r.resposta} não foi aceito. Vai outra figura — ${RONDAS - ronda} tentativa(s) ainda.`);
      }

      dizer('A verificação continua aberta. É com você.', true);
      await recado(`Depois de ${RONDAS} tentativas a verificação continua aberta. É com você, no computador.`);
      return 'parado';
    };

    // ---------------------------------------------------------- preparação

    /**
     * Preparar: trocar o time, ir à cidade, entrar no grupo. **E parar.**
     *
     * A vez é pedida para o caminho inteiro e solta no fim: a partir daí a expedição é dele, e as
     * outras ferramentas já sabem esperar enquanto ela durar (ver `naExpedicao`, na Escada).
     */
    /**
     * Uma volta inteira: pedir licenca, montar, entrar num grupo e levar a verificacao ate' ele.
     *
     * Devolve o que aconteceu, para o laco de fora saber se ha' outra volta. `'outro'` quer dizer
     * que ele viu o grupo, nao o quis, e ja' se saiu dele.
     */
    const umaVolta = async (porMinha, volta) => {
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
      /** Saiu do grupo por ninguem ter respondido: desfaz-se tudo, mas a janela conta como usada. */
      let saiu = false;
      const falha = (texto) => {
        falhou = true;
        dizer(texto, true);
        return 'falhou';
      };
      try {
        // Antes de tudo, e antes da fila: o "sim" dele. Entrar gasta a corrida da janela.
        if (cfg.recado && cfg.licenca && cfg.entrar) {
          // Marcada ANTES de perguntar: a batida seguinte chega daqui a meio minuto, e ele ainda
          // esta' a olhar para a primeira pergunta. Uma por janela.
          janelaAvisada = visto?.fecha || janelaAvisada;
          const licenca = await pedirLicenca(visto);
          if (licenca === 'nao') {
            // Disse que nao: a janela fica dada como tratada, senao a batida seguinte pergunta
            // outra vez. Ele muda de ideias no botao `Preparar agora`, que nao passa por aqui.
            if (porMinha) janelaFeita = visto?.fecha || '';
            return 'nao';
          }
          if (licenca !== 'sim') {
            // Nao chegou a haver pergunta. A janela **nao** e' dada por tratada: tenta-se outra
            // vez mais logo. Mas nao ja': duas janelas a tentarem de meio em meio minuto roubavam
            // a leitura uma a' outra para sempre, e nenhuma chegava a perguntar. Por isso o
            // adiamento e' sorteado — e' o desempate entre elas.
            adiadoAte = Date.now() + (licenca === 'conflito' ? 60000 + Math.random() * 120000 : 60000);
            janelaAvisada = '';
            return 'adiado';
          }
        }

        soltar = await esperarAVez(dizer);
        if (!soltar) return falha('Desisti: o jogo ficou ocupado tempo demais.');

        // Lido ANTES de mexer em nada: depois da troca de time e do `stopHunt` já não há o que
        // perguntar, e era assim que se devolvia o lugar errado.
        // Na segunda volta ja' se esta' com o time de expedicao e fora da caçada: reler aqui
        // guardava **isso** como "o de antes", e no fim devolvia-se o que se queria desfazer.
        antes = antes || {
          cacada: globalThis.PPX?.cacadas?.atual?.() || null,
          // `qual()` é o nome do time guardado que casa com a equipe de agora — por id, e não por
          // nome de espécie. Vazio quer dizer "a equipe de agora não é nenhum time guardado", e aí
          // não há o que devolver: montar um palpite seria pior do que não mexer.
          time: cfg.time ? globalThis.PPX?.times?.qual?.() || '' : '',
        };
        // Da segunda volta em diante o time ja' esta' montado e ja' se esta' na cidade.
        const sóEntrar = volta > 1;

        if (cfg.time && !sóEntrar) {
          dizer(`Montando o time “${cfg.time}”…`);
          const troca = await globalThis.PPX?.times?.usar?.(cfg.time);
          if (!troca?.ok) return falha(`Não montei o time: ${troca?.erro || 'falhou'}`);
        }

        if (cfg.cidade && !sóEntrar) {
          dizer('Indo para a cidade…');
          const ida = await ponte({ acao: 'cidade' });
          if (ida?.erro) return falha(`Não consegui ir para a cidade: ${ida.erro}`);
        }

        if (!cfg.entrar) {
          dizer('Pronto para você: time montado e na cidade. Entre no grupo quando quiser.');
          return 'parado';
        }

        // A janela de expedições do jogo, aberta antes de entrar: é dentro dela que a verificação
        // e o "Estou pronto" existem. Se não abrir, segue-se mesmo assim — o relé é que não vai ter
        // onde clicar, e diz isso quando lá chegar.
        const abriu = await abrirJanela();
        if (abriu?.erro) dizer(`Não abri a janela de expedições: ${abriu.erro}`, true);

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
        // O relé, se ele o ligou: a foto vai para o telefone e o clique espera por uma pessoa.
        // Fica **dentro** do `try`, com a vez ainda na mão — ver o cabeçalho do `responderPelaFoto`.
        if (cfg.recado && cfg.pelaFoto && entrou.exigeVerificacao) {
          const fim = await responderPelaFoto();
          if (fim === 'saiu') saiu = true;
          // Clicou e marcou Pronto: dali ate' a corrida entrar no mapa, a janela do jogo fica
          // aberta — e e' por isso que isto nao e' esperado aqui dentro, com a vez na mao.
          if (fim === 'pronto') void vigiarJanela();
          return fim;
        }
        return 'parado';
      } finally {
        // Desfazer antes de soltar a vez: enquanto se devolve o time ainda se esta' a mexer no
        // jogo, e quem mexe no jogo tem a vez.
        // Uma falha desfaz; uma saida por prazo tambem — em ambos os casos ficou-se com o time de
        // expedicao montado e fora da caçada, e isso nao se deixa assim.
        if (falhou || saiu) await desfazer();
        if (soltar) soltar();
        desenhar();
      }
    };

    /**
     * O laço: enquanto ele pedir outro grupo, volta-se a' primeira pergunta.
     *
     * Pedido do dono em 04/11/2026: *"quero poder sair daquele grupo e achar outro... voltamos
     * para a primeira pergunta"*. O tecto existe para o laço nao ficar a procurar grupos sozinho
     * ate' a janela fechar — passadas as voltas, para e diz.
     */
    const preparar = async (porMinha = false, inicio = 1) => {
      if (correndo) return;
      correndo = true;
      desenharBotoes();
      let fim = 'parado';
      try {
        for (let volta = inicio; volta <= GRUPOS; volta += 1) {
          fim = await umaVolta(porMinha, volta);
          if (fim !== 'outro') break;
          if (volta === GRUPOS) {
            dizer(`Já foram ${GRUPOS} grupos. Paro por aqui.`);
            await recado(`Já tentei ${GRUPOS} grupos nesta janela e paro por aqui. O time e a caçada voltaram ao que eram.`);
            // Saiu-se do ultimo grupo e nao se volta a entrar: devolve-se o que se montou.
            await desfazer();
          }
        }
      } finally {
        correndo = false;
        // So' uma janela **preparada** conta como feita. Queimar a janela por causa de um "o jogo
        // ficou ocupado" seria perder a corrida do dia por um segundo mau. E um "outro grupo" que
        // esgotou as voltas tambem a encerra: ficar a perguntar em ciclo seria pior.
        if (porMinha && fim !== 'falhou' && fim !== 'adiado') janelaFeita = visto?.fecha || '';
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

      // O grupo existia e deixou de existir. São **duas** coisas diferentes com a mesma aparência:
      // a corrida terminou, ou o líder expulsou-nos antes de ela começar. O que as separa é o
      // `inRun` do próprio jogo — se nunca se chegou a correr, não houve expedição nenhuma.
      //
      // Pedido do dono em 04/11/2026: se o líder o remover, voltar à primeira pergunta. Devolver o
      // time e a caçada aí seria tratar um lugar perdido como uma corrida feita, e ele perdia a
      // corrida do dia por decisão de um estranho.
      const temGrupo = Boolean(r.grupo);
      if (tinhaGrupo && !temGrupo) {
        tinhaGrupo = false;
        const corrida = await ponte({ acao: 'corrida' });
        const expulso =
          !corrida?.correndo && r.aberta && r.ligada && r.corridas + r.extras > 0 && (cfg.ligada || cfg.licenca);
        if (expulso) {
          dizer('Fiquei fora do grupo antes de começar. Vou perguntar se procuro outro.');
          await recado('Fiquei fora do grupo antes de a corrida começar — o líder deve ter me removido.');
          // A janela **não** fica dada por tratada, e não se desfaz nada: o time e a cidade ainda
          // servem para o grupo seguinte. Por isso também se começa na volta 2.
          janelaFeita = '';
          janelaAvisada = '';
          await preparar(true, 2);
          return;
        }
        await devolver();
        return;
      }
      tinhaGrupo = temGrupo;

      // A janela abriu: um recado por janela, e **antes** de qualquer preparação, para quem está
      // longe decidir se vale ir ao computador.
      // A pergunta vem PRIMEIRO, e quando ela vem nao ha' aviso nenhum antes dela.
      //
      // Pedido do dono em 04/11/2026: *"tem que me perguntar primeiro se e' para entrar"*. O aviso
      // "Expedicao ABERTA" dizia o mesmo que a pergunta ja' diz — quanto falta e quantas corridas
      // ha' — e dizia-o a anunciar que ia preparar. Duas mensagens, e a primeira a dar por
      // decidido o que ele ainda nao tinha decidido. Entao quando a licenca vai ser pedida, o
      // aviso cala-se e a pergunta e' a primeira coisa que chega ao telefone.
      const vaiPerguntar =
        cfg.licenca && cfg.ligada && cfg.entrar && r.aberta && r.ligada && r.corridas + r.extras > 0;
      if (r.aberta && r.ligada && cfg.recado && !vaiPerguntar && janelaAvisada !== r.fecha) {
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
      if (Date.now() < adiadoAte) {
        dizer(`O bot estava ocupado por outra janela. Tento de novo em ${relogio((adiadoAte - Date.now()) / 1000)}.`);
        return;
      }
      if (!naHoraDeEntrar(r)) {
        const falta = esperaDaJanela(r) - Math.round((Date.now() - Date.parse(String(r.abre))) / 1000);
        dizer(`Minha vez é daqui a ${relogio(falta)} (fila entre as janelas).`);
        return;
      }
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
      campo('[data-pelafoto]').checked = cfg.pelaFoto === true;
      campo('[data-licenca]').checked = cfg.licenca === true;
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
    for (const [seletor, chave] of [
      ['[data-esperamin]', 'esperaMin'],
      ['[data-esperamax]', 'esperaMax'],
    ])
      campo(seletor).addEventListener('change', (e) => {
        const n = Math.max(0, Math.min(180, Math.round(Number(e.target.value) || 0)));
        cfg[chave] = n;
        // O maximo nunca fica abaixo do minimo: um intervalo ao contrario nao sorteia nada.
        if (cfg.esperaMax < cfg.esperaMin) cfg.esperaMax = cfg.esperaMin;
        // Mexer no intervalo manda o sorteio desta janela fora: o novo e' que vale.
        sorteado = { janela: '', segundos: 0 };
        gravar();
        desenharEspera();
        dizer(
          cfg.esperaMax
            ? `Entro entre ${cfg.esperaMin} e ${cfg.esperaMax} min depois de a janela abrir.`
            : 'Entro assim que a janela abrir.',
        );
      });

    const desenharEspera = () => {
      campo('[data-esperamin]').value = String(cfg.esperaMin || 0);
      campo('[data-esperamax]').value = String(cfg.esperaMax || 0);
    };

    campo('[data-licenca]').addEventListener('change', (e) => {
      cfg.licenca = e.target.checked;
      gravar();
      dizer(
        cfg.licenca
          ? 'Antes de entrar, pergunto no Telegram e espero o seu sim.'
          : 'Volto a entrar sem perguntar.',
      );
    });

    campo('[data-pelafoto]').addEventListener('change', (e) => {
      cfg.pelaFoto = e.target.checked;
      gravar();
      dizer(
        cfg.pelaFoto
          ? 'Quando a verificação abrir, mando a foto numerada. Responda 1 a 9 — quem reconhece é você.'
          : 'A verificação volta a ser no computador.',
      );
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
        pelaFoto: cfg.pelaFoto === true,
        licenca: cfg.licenca === true,
        esperaMin: Number(cfg.esperaMin) || 0,
        esperaMax: Number(cfg.esperaMax) || 0,
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
        cfg.pelaFoto = d?.pelaFoto === true;
        cfg.licenca = d?.licenca === true;
        cfg.esperaMin = Math.max(0, Math.min(180, Math.round(Number(d?.esperaMin) || 0)));
        cfg.esperaMax = Math.max(cfg.esperaMin, Math.min(180, Math.round(Number(d?.esperaMax) || 0)));
        sorteado = { janela: '', segundos: 0 };
        cfg.ligada = false;
        janelaFeita = '';
        janelaAvisada = '';
        gravar();
        preencherTimes();
        desenharEspera();
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
    desenharEspera();
    void desenharTelegram();
    globalThis.PPX?.controlar?.('expedicao', mostrar);
    mostrar(globalThis.PPX?.visivel?.('expedicao') !== false);
    void bater();
    const tique = setInterval(() => void bater(), BATIDA);
    addEventListener('pagehide', () => clearInterval(tique));
  },
);
