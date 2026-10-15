// Rampage: monta um time guardado e usa as tentativas do evento dentro da janela escolhida.
PPX.modulo(
  { id: 'rampage', nome: 'Rampage', atalhos: 'configuração pelo menu (Alt+Q)' },
  () => {
    'use strict';

    const CHAVE = 'lioncode:rampage:config';
    const CHAVE_POS = 'lioncode:rampage:posicao';
    const CHAVE_MIN = 'lioncode:rampage:minimizado';
    const CHAVE_PLACAR = 'lioncode:rampage:placar';
    const PEDIDO = 'lioncode:rampage:pedido';
    const RESPOSTA = 'lioncode:rampage:resposta';
    const MINHA_VEZ = 'rampage';
    const PADRAO = {
      ligada: false,
      horarios: '',
      dias: '',
      time: '',
      movimento: true,
      voltar: true,
      ultimoEvento: '',
    };

    const ler = (chave, padrao) => {
      try { return JSON.parse(localStorage.getItem(chave)) ?? padrao; } catch { return padrao; }
    };
    const gravarChave = (chave, valor) => {
      try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* sem armazenamento */ }
    };
    let cfg = { ...PADRAO, ...(ler(CHAVE, null) || {}) };
    const gravar = () => gravarChave(CHAVE, cfg);
    const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
    const ate = async (fn, limite) => {
      const inicio = Date.now();
      while (Date.now() - inicio < limite) {
        const r = fn();
        if (r) return r;
        await espera(250);
      }
      return null;
    };

    let eco = 0;
    const ponte = (pedido) => new Promise((resolver) => {
      const id = `r${Date.now()}-${++eco}`;
      const ouvir = (e) => {
        if (e?.detail?.eco !== id) return;
        clearTimeout(limite);
        removeEventListener(RESPOSTA, ouvir);
        resolver(e.detail);
      };
      addEventListener(RESPOSTA, ouvir);
      const limite = setTimeout(() => {
        removeEventListener(RESPOSTA, ouvir);
        resolver({ erro: 'o jogo não respondeu — recarregue a página' });
      }, 20000);
      dispatchEvent(new CustomEvent(PEDIDO, { detail: { eco: id, ...pedido } }));
    });
    const estado = () => ponte({ acao: 'estado' });

    const esperarAVez = async (avisar) => {
      const vez = globalThis.PPX?.vez;
      if (!vez?.pedir) return () => {};
      const dono = vez.dono();
      if (dono && dono.id !== MINHA_VEZ) avisar(`Esperando o ${vez.nome(dono.id)} terminar…`);
      return vez.pedir(MINHA_VEZ);
    };
    const naExpedicao = () => globalThis.PPX?.cacadas?.atual?.()?.tipo === 'expedicao';
    const calendario = () => globalThis.PPX?.agenda || null;

    const painel = document.createElement('div');
    painel.id = 'lioncode-rampage';
    painel.innerHTML = `
      <header><strong data-titulo>Rampage</strong><button data-minimizar>–</button><button data-fechar>×</button></header>
      <div class="resumo" data-resumo>—</div>
      <button type="button" data-status title="Clique para corrigir: não atacado ↔ atacado">○ Não atacado</button>
      <div class="botoes"><button data-ligar>Iniciar</button><button data-agora>Atacar agora</button></div>
      <div class="corpo">
        <div data-agenda></div>
        <label>time salvo <select data-time><option value="">equipe atual</option></select></label>
        <label class="marca"><input type="checkbox" data-movimento> movimentar durante a luta</label>
        <label class="marca"><input type="checkbox" data-voltar> voltar à caçada ao terminar</label>
        <div data-config></div>
        <p data-estado></p>
      </div>`;
    const estilo = document.createElement('style');
    estilo.textContent = `
      #lioncode-rampage,#lioncode-rampage *{box-sizing:border-box}#lioncode-rampage{position:fixed;z-index:2147483000;width:260px;background:#11161f;color:#e7edf6;border:1px solid #2a3244;border-radius:10px;font:13px/1.45 system-ui,sans-serif;box-shadow:0 8px 24px #0008}
      #lioncode-rampage header{display:flex;gap:8px;align-items:center;padding:8px 10px;border-bottom:1px solid #2a3244;cursor:move}#lioncode-rampage header strong{flex:1}#lioncode-rampage header button{border:0;background:none;color:#8b97a8;cursor:pointer}
      #lioncode-rampage .resumo{padding:6px 10px;color:#8b97a8;font-size:12px}#lioncode-rampage [data-status]{margin:0 10px 8px;width:calc(100% - 20px);cursor:pointer;font-weight:700}#lioncode-rampage [data-status].feito{border-color:#3fb950;color:#7ee787;background:#12251a}#lioncode-rampage .botoes{display:flex;gap:6px;padding:0 10px 10px}#lioncode-rampage button,#lioncode-rampage select,#lioncode-rampage input{border:1px solid #2a3244;border-radius:6px;background:#182030;color:#e7edf6;padding:6px}#lioncode-rampage .botoes button{flex:1;cursor:pointer}#lioncode-rampage .corpo{display:grid;gap:8px;padding:0 10px 10px}#lioncode-rampage.minimizado .corpo{display:none}#lioncode-rampage label{display:flex;align-items:center;gap:6px;color:#c3ccda}#lioncode-rampage label select{flex:1;min-width:0}#lioncode-rampage .marca input{width:auto}#lioncode-rampage p{margin:0;color:#8b97a8;font-size:12px}#lioncode-rampage p.mau{color:#f85149}#lioncode-rampage .campo-mau{border-color:#f85149}
    `;
    document.documentElement.append(estilo, painel);
    const campo = (s) => painel.querySelector(s);

    let ultimo = '';
    const dizer = (texto, mau = false) => {
      ultimo = texto;
      campo('[data-estado]').textContent = texto;
      campo('[data-estado]').classList.toggle('mau', mau);
      resumo();
    };

    const horas = document.createElement('input');
    horas.type = 'text';
    horas.placeholder = '20:00-23:00';
    const rotulo = document.createElement('label');
    rotulo.append('atacar entre ', horas);
    const editor = calendario()?.montarControles({
      resumoDe: (dias) => calendario().resumo({ dias, horarios: horas.value.trim() }),
    });
    const campoDias = editor ? editor.campo : document.createElement('input');
    if (editor) { campo('[data-agenda]').append(editor.el); editor.corpo.prepend(rotulo); }
    else campo('[data-agenda]').append(rotulo);
    horas.value = cfg.horarios;
    if (editor) editor.escrever(cfg.dias); else campoDias.value = cfg.dias;

    const preencherTimes = () => {
      const select = campo('[data-time]');
      const atual = cfg.time;
      select.replaceChildren(new Option('equipe atual', ''));
      for (const nome of globalThis.PPX?.times?.nomes?.() || []) select.append(new Option(nome, nome));
      select.value = atual;
    };

    let correndo = false;
    let parar = false;
    let estadoVisto = null;
    let eventoVisto = '';
    let proxima = 0;
    const placar = () => ler(CHAVE_PLACAR, {}) || {};
    const foiAtacado = (evento = estadoVisto?.evento) => Boolean(evento && placar()[evento]?.atacado);
    const sincronizarPlacar = () => {
      const evento = estadoVisto?.evento;
      if (!evento || Object.hasOwn(placar(), evento)) return;
      if (estadoVisto.maximo > 0 && estadoVisto.restantes < estadoVisto.maximo) marcarAtacado(true, false);
    };
    const marcarAtacado = (sim, manual = false) => {
      const evento = estadoVisto?.evento;
      if (!evento) return dizer('Ainda não consegui identificar este evento.', true);
      const todos = placar();
      todos[evento] = { atacado: sim, quando: Date.now(), manual };
      gravarChave(CHAVE_PLACAR, todos);
      resumo();
    };
    const falta = () => {
      if (!cfg.ligada) return null;
      if (!proxima) {
        const ms = calendario()?.esperaDaAgenda({ horarios: cfg.horarios, dias: cfg.dias }, 0);
        if (ms === null || ms === undefined) return null;
        proxima = Date.now() + Math.max(0, ms);
      }
      return Math.max(0, proxima - Date.now());
    };
    function resumo() {
      const evento = estadoVisto?.ativo ? `${estadoVisto.nome} · ${estadoVisto.restantes} tentativa(s)` : 'evento indisponível';
      const f = falta();
      const quando = !cfg.ligada ? 'parado' : correndo ? 'atacando' : f === null ? 'sem horário' : f <= 0 ? 'verificando' : `em ${Math.ceil(f / 60000)} min`;
      campo('[data-resumo]').textContent = `${evento} · ${quando}`;
      const feito = foiAtacado();
      campo('[data-status]').textContent = feito ? '✓ Atacado' : '○ Não atacado';
      campo('[data-status]').classList.toggle('feito', feito);
      campo('[data-ligar]').textContent = cfg.ligada ? 'Parar' : 'Iniciar';
      campo('[data-agora]').textContent = correndo ? 'Parar ciclo' : 'Atacar agora';
    }

    const modoSuportado = (modo) => !modo || modo === 'live_v1' || modo === 'cinematic_v1';
    const lutaComecou = (modo) => modo === 'cinematic_v1'
      ? document.body.classList.contains('pokeidle-worldboss-map') || Boolean(document.querySelector('.worldboss-entry,.worldboss-map-hud'))
      : Boolean(document.querySelector('.rl-hud'));
    const resultadoApareceu = (modo) => modo === 'cinematic_v1'
      ? document.querySelector('.worldboss-map-result')
      : document.querySelector('.rl-result');
    const fecharResultado = (modo) => {
      const b = modo === 'cinematic_v1'
        ? document.querySelector('.worldboss-map-result button')
        : document.querySelector('.rl-result__actions button');
      if (b) b.click();
      return Boolean(b);
    };
    const esperarVoltaDoRampage = async (modo) => {
      if (modo !== 'cinematic_v1') {
        await espera(1200);
        return true;
      }
      return Boolean(await ate(
        () =>
          !document.body.classList.contains('pokeidle-worldboss-map') &&
          !document.querySelector('.worldboss-map-result') &&
          document.querySelector('.worldboss-mmo'),
        20000,
      ));
    };
    const fecharJanela = () => {
      const conteudo = document.querySelector('.worldboss-mmo');
      const raiz = conteudo?.closest('.pokeidle-panel, .pokeidle-window') || conteudo?.parentElement;
      const f = raiz?.querySelector('.pokeidle-panel__close');
      if (f) for (const tipo of ['pointerdown', 'mousedown', 'mouseup', 'click'])
        f.dispatchEvent(new MouseEvent(tipo, { bubbles: true, cancelable: true, view: window }));
    };
    const estaVisivel = (el) => Boolean(el) && el.getBoundingClientRect().width > 0;
    const irParaCidade = async () => {
      if (!globalThis.PPX?.cacadas?.atual?.()) return { ok: true };
      const botao = [...document.querySelectorAll('.pokeidle-map-action-bar__button')].find(
        (b) => estaVisivel(b) && /VOLTAR .{1,2} CIDADE/i.test((b.textContent || '').trim()),
      );
      if (!botao) return { ok: false, erro: 'não achei o botão “Voltar à cidade”' };
      botao.click();
      const chegou = await ate(() => !globalThis.PPX?.cacadas?.atual?.(), 10000);
      return chegou ? { ok: true } : { ok: false, erro: 'o jogo não confirmou a chegada à cidade' };
    };

    const executar = async () => {
      if (correndo) return;
      correndo = true;
      parar = false;
      let soltar = null;
      const origem = globalThis.PPX?.cacadas?.atual?.() || null;
      const timeOrigem = globalThis.PPX?.times?.qual?.() || '';
      try {
        estadoVisto = await estado();
        if (!estadoVisto?.ok) return dizer(estadoVisto?.erro || 'não consegui ler o Rampage', true);
        sincronizarPlacar();
        if (!estadoVisto.ativo) return dizer('O Rampage não está ativo agora.');
        if (!modoSuportado(estadoVisto.modo))
          return dizer(`Este Rampage usa o modo “${estadoVisto.modo}”, que ainda não foi medido.`, true);
        if (estadoVisto.restantes < 1 && !estadoVisto.lutando) return dizer('A tentativa deste Rampage já foi usada.');
        if (foiAtacado() && !estadoVisto.lutando) return dizer('Este Rampage está marcado como atacado.');
        if (naExpedicao()) return dizer('Você está na expedição — não vou tirar você dela.');
        soltar = await esperarAVez(dizer);
        if (!soltar) return dizer('Desisti: o jogo ficou ocupado tempo demais.', true);

        dizer('Voltando para a cidade antes do Rampage…');
        const cidade = await irParaCidade();
        if (!cidade.ok) return dizer(`Não fui para a cidade: ${cidade.erro}`, true);

        if (cfg.time) {
          const times = globalThis.PPX?.times;
          if (!times?.usar) return dizer('Ligue a ferramenta Times no menu.', true);
          dizer(`Montando o time “${cfg.time}”…`);
          const troca = await times.usar(cfg.time);
          if (!troca?.ok) return dizer(`Não montei o time: ${troca?.erro || 'falhou'}`, true);
        }
        if (parar) return dizer('Ciclo parado.');

        dizer('Abrindo o Rampage…');
        const abriu = await ponte({ acao: 'abrir' });
        if (!abriu?.ok) return dizer(abriu?.erro || 'não consegui abrir o Rampage', true);
        const entrar = await ate(() => {
          const b = document.querySelector('.worldboss-mmo__enter');
          return b && !b.disabled ? b : null;
        }, 12000);
        if (!entrar) return dizer('O botão de entrar não ficou disponível.', true);
        entrar.click();

        const comecou = await ate(() => lutaComecou(estadoVisto.modo), 20000);
        if (!comecou) return dizer('O jogo não confirmou o início da luta.', true);
        cfg.ultimoEvento = estadoVisto.evento;
        gravar();
        if (cfg.movimento && estadoVisto.modo === 'live_v1') await ponte({ acao: 'mover', ligado: true });
        dizer(estadoVisto.modo === 'cinematic_v1'
          ? 'Rampage em andamento. A batalha cinematográfica está sendo executada.'
          : 'Rampage em andamento. Os Pokémon atacam e o treinador está se movimentando.');

        const resultado = await ate(() => resultadoApareceu(estadoVisto.modo), 180000);
        await ponte({ acao: 'mover', ligado: false });
        if (!resultado) return dizer('A luta ainda não mostrou o resultado; parei sem clicar novamente.', true);
        fecharResultado(estadoVisto.modo);
        marcarAtacado(true, false);
        const voltouDoRampage = await esperarVoltaDoRampage(estadoVisto.modo);
        if (!voltouDoRampage)
          return dizer('Ataque registrado, mas o jogo ainda não voltou do mapa do Rampage.', true);
        estadoVisto = await estado();
        dizer('Ataque registrado.');

        if (cfg.voltar && origem?.nome) {
          fecharJanela();
          await ate(() => !document.querySelector('.worldboss-mmo'), 5000);
          if (timeOrigem && timeOrigem !== cfg.time) {
            const troca = await globalThis.PPX?.times?.usar?.(timeOrigem);
            if (!troca?.ok) return dizer(`Ataque feito, mas não restaurei o time: ${troca?.erro || 'falhou'}`, true);
          }
          const voltou = await globalThis.PPX?.cacadas?.ir?.(origem.nome);
          if (!voltou?.ok) return dizer(`Ataque feito, mas não voltei à caçada: ${voltou?.erro || 'falhou'}`, true);
          dizer(`Ataque feito e caçada “${origem.nome}” retomada.`);
        }
      } finally {
        await ponte({ acao: 'mover', ligado: false });
        if (soltar) soltar();
        correndo = false;
        resumo();
      }
    };

    const agendaMudou = () => {
      cfg.horarios = horas.value.trim();
      cfg.dias = campoDias.value.trim();
      proxima = 0;
      gravar();
      const ok = calendario()?.valida({ horarios: cfg.horarios, dias: cfg.dias }) ?? true;
      horas.classList.toggle('campo-mau', Boolean(cfg.horarios) && !ok);
      editor?.resumir?.();
      resumo();
    };
    horas.addEventListener('change', agendaMudou);
    campoDias.addEventListener('change', agendaMudou);
    campo('[data-time]').addEventListener('change', (e) => { cfg.time = e.target.value; gravar(); });
    campo('[data-movimento]').addEventListener('change', (e) => { cfg.movimento = e.target.checked; gravar(); });
    campo('[data-voltar]').addEventListener('change', (e) => { cfg.voltar = e.target.checked; gravar(); });
    campo('[data-ligar]').addEventListener('click', () => {
      cfg.ligada = !cfg.ligada;
      proxima = 0;
      if (!cfg.ligada) parar = true;
      gravar();
      dizer(cfg.ligada ? 'Ligado. Vou conferir o evento dentro do horário.' : 'Parado.');
    });
    campo('[data-agora]').addEventListener('click', () => {
      if (correndo) { parar = true; dizer('Vou parar no próximo ponto seguro.'); return; }
      void executar();
    });
    campo('[data-status]').addEventListener('click', () => {
      marcarAtacado(!foiAtacado(), true);
      dizer(foiAtacado() ? 'Marquei este Rampage como atacado.' : 'Marquei este Rampage como não atacado.');
    });

    const botoes = globalThis.PPX?.config?.montarBotoes({
      id: 'rampage', nome: 'Rampage',
      coletar: () => ({ horarios: cfg.horarios, dias: cfg.dias, time: cfg.time, movimento: cfg.movimento, voltar: cfg.voltar }),
      aplicar: (d) => {
        if (correndo) throw new Error('pare o ciclo antes de importar');
        cfg.horarios = String(d?.horarios || '').slice(0, 120);
        cfg.dias = String(d?.dias || '').slice(0, 120);
        cfg.time = String(d?.time || '').slice(0, 80);
        cfg.movimento = d?.movimento !== false;
        cfg.voltar = d?.voltar !== false;
        proxima = 0; gravar(); horas.value = cfg.horarios;
        if (editor) editor.escrever(cfg.dias); else campoDias.value = cfg.dias;
        preencherTimes(); desenhar();
      },
      avisar: dizer,
    });
    if (botoes) campo('[data-config]').append(botoes.el);

    let visivel = true;
    const mostrar = (sim) => { visivel = sim; painel.style.display = sim ? 'block' : 'none'; };
    let minimizado = ler(CHAVE_MIN, false) === true;
    const recolocar = () => {
      if (globalThis.PPX?.canto?.aplicar(painel, ler(CHAVE_POS, null))) return;
      painel.style.left = '16px'; painel.style.top = '16px'; painel.style.right = 'auto'; painel.style.bottom = 'auto';
    };
    const desenhar = () => {
      preencherTimes();
      campo('[data-movimento]').checked = cfg.movimento;
      campo('[data-voltar]').checked = cfg.voltar;
      painel.classList.toggle('minimizado', minimizado);
      campo('[data-titulo]').textContent = minimizado ? 'RAM' : 'Rampage';
      campo('[data-minimizar]').textContent = minimizado ? '□' : '–';
      resumo(); recolocar();
    };
    campo('[data-minimizar]').addEventListener('click', () => { minimizado = !minimizado; gravarChave(CHAVE_MIN, minimizado); desenhar(); });
    campo('[data-fechar]').addEventListener('click', () => { mostrar(false); globalThis.PPX?.anotar?.('rampage', false); });
    let arrasto = null;
    painel.querySelector('header').addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      const r = painel.getBoundingClientRect(); arrasto = { x: e.clientX - r.left, y: e.clientY - r.top };
    });
    addEventListener('pointermove', (e) => { if (!arrasto) return; painel.style.left = `${e.clientX - arrasto.x}px`; painel.style.top = `${e.clientY - arrasto.y}px`; });
    addEventListener('pointerup', () => { if (!arrasto) return; arrasto = null; const p = globalThis.PPX?.canto?.medir(painel); if (p) gravarChave(CHAVE_POS, p); });
    addEventListener('resize', recolocar);

    const bater = async () => {
      if (correndo) return;
      estadoVisto = await estado();
      sincronizarPlacar();
      const eventoAgora = estadoVisto?.evento || '';
      if (eventoAgora && eventoAgora !== eventoVisto) {
        eventoVisto = eventoAgora;
        // Um alvo sorteado para o evento anterior não pode disparar fora da janela neste evento.
        proxima = 0;
      }
      resumo();
      if (!cfg.ligada || !estadoVisto?.ok || !estadoVisto.ativo || estadoVisto.restantes < 1) return;
      const f = falta();
      if (f !== null && f <= 0) { proxima = 0; void executar(); }
    };

    desenhar();
    dizer(cfg.ligada ? 'Ligado. Aguardando o Rampage e o horário.' : 'Parado.');
    globalThis.PPX?.controlar?.('rampage', mostrar);
    mostrar(globalThis.PPX?.visivel?.('rampage') !== false);
    void bater();
    const relogio = setInterval(bater, 30000);
    addEventListener('pagehide', () => clearInterval(relogio));
  },
);
