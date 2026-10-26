// Eventos: resgata diariamente todas as recompensas concluidas dos eventos suportados.
PPX.modulo(
  { id: 'eventos', nome: 'Eventos', atalhos: 'configuração pelo menu (Alt+Q)' },
  () => {
    'use strict';

    const CHAVE = 'lioncode:eventos:config';
    const CHAVE_POS = 'lioncode:eventos:posicao';
    const CHAVE_MIN = 'lioncode:eventos:minimizado';
    const CHAVE_WB_RETORNO = 'lioncode:eventos:world-boss-retorno';
    const PEDIDO = 'lioncode:eventos:pedido';
    const RESPOSTA = 'lioncode:eventos:resposta';
    const MINHA_VEZ = 'eventos';
    const PADRAO = { ligada: false, hora: '20:00', intervalo: 1500, ultima: 0, worldBoss: true, worldBossTime: '' };

    const ler = (chave, padrao) => {
      try { return JSON.parse(localStorage.getItem(chave)) ?? padrao; } catch { return padrao; }
    };
    const guardar = (chave, valor) => {
      try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* sem armazenamento */ }
    };
    let cfg = { ...PADRAO, ...(ler(CHAVE, null) || {}) };
    const gravar = () => guardar(CHAVE, cfg);
    const calendario = () => globalThis.PPX?.agenda || null;
    const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
    const ate = async (condicao, limite = 10000) => {
      const fim = Date.now() + limite;
      while (Date.now() < fim) {
        const achado = await condicao();
        if (achado) return achado;
        await espera(200);
      }
      return await condicao();
    };

    const janelaDaHora = (hora) => {
      const m = String(hora || '').match(/^(\d{2}):(\d{2})$/);
      if (!m) return '';
      const minutos = Number(m[1]) * 60 + Number(m[2]);
      if (minutos < 0 || minutos >= 1440) return '';
      const fim = (minutos + 1) % 1440;
      const texto = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
      return `${texto(minutos)}-${texto(fim)}`;
    };
    const horaValida = () => {
      const horarios = janelaDaHora(cfg.hora);
      return Boolean(horarios && (calendario()?.valida({ horarios }) ?? true));
    };

    /**
     * A outra ponta da ponte ja' esta' a escutar?
     *
     * **MEDIDO NO JOGO EM 26/10/2026, E FALHAVA SEMPRE.** O manifest corre o bloco ISOLATED antes
     * do bloco MAIN — os dois em `document_idle` —, entao o pedido do arranque era disparado antes
     * de `eventos-main.js` instalar o `addEventListener`. Um `CustomEvent` sem ninguem a escutar
     * nao fica em fila: perde-se. O painel esperava 60 s, dizia "nenhum evento respondeu", e so'
     * tentava outra vez na hora marcada — com onze dias de recompensas por resgatar no jogo.
     *
     * Esperar pela marca conserta **todos** os pedidos de uma vez, e sem nenhum risco de repetir
     * uma accao: nao se re-dispara nada: espera-se que haja quem ouça antes de falar.
     */
    const pontePronta = () =>
      ate(() => document.documentElement.dataset.lioncodeEventos === 'pronto', 20000);

    let eco = 0;
    const ponte = async (acao, dados = {}) => {
      if (!(await pontePronta()))
        return { erro: 'a ponte com o jogo não carregou — recarregue a página (F5)' };
      return pedirAoJogo(acao, dados);
    };
    const pedirAoJogo = (acao, dados = {}) => new Promise((resolver) => {
      const id = `ev${Date.now()}-${++eco}`;
      let limite = 0;
      const ouvir = (e) => {
        if (e?.detail?.eco !== id) return;
        clearTimeout(limite); removeEventListener(RESPOSTA, ouvir); resolver(e.detail);
      };
      addEventListener(RESPOSTA, ouvir);
      limite = setTimeout(() => {
        removeEventListener(RESPOSTA, ouvir);
        resolver({ erro: 'o jogo não respondeu — recarregue a página' });
      }, 60000);
      dispatchEvent(new CustomEvent(PEDIDO, { detail: { eco: id, acao, ...dados } }));
    });

    const esperarAVez = async (avisar) => {
      const vez = globalThis.PPX?.vez;
      if (!vez?.pedir) return () => {};
      const dono = vez.dono();
      if (dono && dono.id !== MINHA_VEZ) avisar(`Esperando o ${vez.nome(dono.id)} terminar…`);
      return vez.pedir(MINHA_VEZ);
    };

    const painel = document.createElement('div');
    painel.id = 'lioncode-eventos';
    painel.innerHTML = `
      <header><strong data-titulo>Eventos</strong><button data-minimizar>–</button><button data-fechar>×</button></header>
      <div class="resumo" data-resumo>—</div>
      <div class="botoes"><button data-ligar>Iniciar</button><button data-agora>Resgatar agora</button></div>
      <div class="corpo">
        <label>resgatar todo dia às <input type="time" data-hora></label>
        <label>pausa entre cliques <input type="number" min="0.5" max="10" step="0.5" data-intervalo> s</label>
        <label><input type="checkbox" data-world-boss> entrar no World Boss quando abrir</label>
        <label>time do World Boss <select data-world-boss-time><option value="">equipe atual</option></select><button type="button" data-recarregar-times title="Atualizar a lista de times">↻</button></label>
        <p data-world-boss-estado>World Boss: consultando…</p>
        <p data-eventos>Consultando os eventos…</p>
        <div data-config></div>
        <p data-estado></p>
      </div>`;
    const estilo = document.createElement('style');
    estilo.textContent = `
      #lioncode-eventos,#lioncode-eventos *{box-sizing:border-box}#lioncode-eventos{position:fixed;z-index:2147483000;width:270px;background:#11161f;color:#e7edf6;border:1px solid #2a3244;border-radius:10px;font:13px/1.45 system-ui,sans-serif;box-shadow:0 8px 24px #0008}
      #lioncode-eventos header{display:flex;gap:8px;align-items:center;padding:8px 10px;border-bottom:1px solid #2a3244;cursor:move}#lioncode-eventos header strong{flex:1}#lioncode-eventos header button{border:0;background:none;color:#8b97a8;cursor:pointer}
      #lioncode-eventos .resumo{padding:6px 10px;color:#8b97a8;font-size:12px}#lioncode-eventos .botoes{display:flex;gap:6px;padding:0 10px 10px}#lioncode-eventos button,#lioncode-eventos input{border:1px solid #2a3244;border-radius:6px;background:#182030;color:#e7edf6;padding:6px}#lioncode-eventos .botoes button{flex:1;cursor:pointer}#lioncode-eventos .botoes button.ativo{background:#1d3a24;border-color:#2f6b3a}
      #lioncode-eventos .corpo{display:grid;gap:8px;padding:0 10px 10px}#lioncode-eventos.minimizado .corpo{display:none}#lioncode-eventos label{display:flex;align-items:center;gap:6px;color:#c3ccda}#lioncode-eventos input{flex:1}#lioncode-eventos input.mau{border-color:#f85149}#lioncode-eventos p{margin:0;color:#8b97a8;font-size:12px}#lioncode-eventos p.erro{color:#f85149}
    `;
    document.documentElement.append(estilo, painel);
    const campo = (s) => painel.querySelector(s);
    const preencherTimesWorldBoss = () => {
      const select = campo('[data-world-boss-time]');
      const atual = cfg.worldBossTime || '';
      select.replaceChildren(new Option('equipe atual', ''));
      for (const nome of globalThis.PPX?.times?.nomes?.() || []) select.append(new Option(nome, nome));
      select.value = atual;
    };

    let correndo = false;
    let relogio = 0;
    let proxima = 0;
    let estadoVisto = null;
    let ultimo = '';
    const dizer = (texto, erro = false) => {
      ultimo = texto; campo('[data-estado]').textContent = texto;
      campo('[data-estado]').classList.toggle('erro', erro); desenhar();
    };
    const falta = () => {
      if (!cfg.ligada || !horaValida()) return null;
      if (!proxima) {
        const ms = calendario()?.esperaDaAgenda({ horarios: janelaDaHora(cfg.hora) }, cfg.ultima);
        if (ms === null || ms === undefined) return null;
        proxima = Date.now() + Math.max(0, ms);
      }
      return Math.max(0, proxima - Date.now());
    };
    const desenhar = () => {
      const f = falta();
      const quando = !cfg.ligada ? 'parado' : correndo ? 'resgatando' : f === null ? 'horário inválido' : f <= 0 ? 'agora' : `em ${Math.ceil(f / 60000)} min`;
      // **Sem leitura nenhuma, "0 pronta(s)" e' mentira, nao e' zero.** Era o que escondia o
      // defeito da ponte: o painel dizia zero com onze dias de recompensas la' dentro, e nada
      // naquela frase deixava desconfiar. Quem nao sabe diz que nao sabe.
      const pendentes = estadoVisto
        ? (estadoVisto.eventos || []).reduce((n, e) => n + (e.pendentes?.length || 0), 0)
        : null;
      campo('[data-resumo]').textContent =
        pendentes === null
          ? `ainda não li os eventos · ${quando}`
          : `${pendentes} recompensa(s) pronta(s) · ${quando}`;
      campo('[data-ligar]').textContent = cfg.ligada ? 'Parar' : 'Iniciar';
      campo('[data-ligar]').classList.toggle('ativo', cfg.ligada);
      campo('[data-agora]').disabled = correndo;
      campo('[data-hora]').value = cfg.hora;
      campo('[data-intervalo]').value = (cfg.intervalo / 1000).toFixed(1);
      campo('[data-world-boss]').checked = cfg.worldBoss !== false;
      campo('[data-world-boss-time]').value = cfg.worldBossTime || '';
      campo('[data-hora]').classList.toggle('mau', Boolean(cfg.hora) && !horaValida());
      const nomes = (estadoVisto?.eventos || []).map((e) => `${e.nome}: ${e.disponivel ? `${e.pendentes.length} pronta(s)` : 'indisponível'}`);
      campo('[data-eventos]').textContent = nomes.join(' · ') || 'Nenhum evento suportado respondeu.';
      if (ultimo) campo('[data-estado]').textContent = ultimo;
    };

    let worldBossCorrendo = false;
    let relogioWorldBoss = 0;
    const retornoWorldBoss = () => ler(CHAVE_WB_RETORNO, null);
    const guardarRetornoWorldBoss = (valor) => guardar(CHAVE_WB_RETORNO, valor);
    const limparRetornoWorldBoss = () => {
      try { localStorage.removeItem(CHAVE_WB_RETORNO); } catch { /* sem armazenamento */ }
    };
    const visivel = (el) => Boolean(el) && el.getBoundingClientRect().width > 0;
    const pausarCacadaEIrParaCidade = async () => {
      if (!globalThis.PPX?.cacadas?.atual?.()) return { ok: true };
      const botao = [...document.querySelectorAll('.pokeidle-map-action-bar__button')].find(
        (b) => visivel(b) && /VOLTAR .{1,2} CIDADE/i.test((b.textContent || '').trim()),
      );
      if (!botao) return ponte('irCidadeWorldBoss');
      botao.click();
      const chegou = await ate(() => !globalThis.PPX?.cacadas?.atual?.(), 15000);
      return chegou ? { ok: true } : { erro: 'o jogo não confirmou a chegada à cidade' };
    };
    const retomarDepoisDoWorldBoss = async (linha) => {
      const retorno = retornoWorldBoss();
      if (!retorno) return false;
      linha.textContent = 'World Boss encerrado: restaurando o time…';
      if (retorno.time) {
        const troca = await globalThis.PPX?.times?.usar?.(retorno.time);
        if (!troca?.ok) {
          linha.textContent = `World Boss encerrado, mas não restaurei o time: ${troca?.erro || 'falhou'}`;
          return true;
        }
      }
      if (retorno.cacada) {
        linha.textContent = `World Boss encerrado: retomando “${retorno.cacada}”…`;
        const voltou = await globalThis.PPX?.cacadas?.ir?.(retorno.cacada);
        if (!voltou?.ok) {
          linha.textContent = `World Boss encerrado, mas não retomei a caçada: ${voltou?.erro || 'falhou'}`;
          return true;
        }
      }
      limparRetornoWorldBoss();
      linha.textContent = retorno.cacada
        ? `World Boss encerrado: caçada “${retorno.cacada}” retomada`
        : 'World Boss encerrado: equipe restaurada';
      return true;
    };
    const verificarWorldBoss = async () => {
      clearTimeout(relogioWorldBoss);
      const novamente = () => {
        relogioWorldBoss = setTimeout(() => void verificarWorldBoss(), 30000);
      };
      if (!cfg.ligada || cfg.worldBoss === false || worldBossCorrendo) return novamente();
      const lido = await ponte('estadoWorldBoss');
      const linha = campo('[data-world-boss-estado]');
      if (lido?.erro) { linha.textContent = `World Boss: ${lido.erro}`; return novamente(); }
      if (!lido?.disponivel) {
        if (retornoWorldBoss() && !lido?.emRaid) {
          worldBossCorrendo = true;
          let soltarRetorno = null;
          try {
            soltarRetorno = await esperarAVez(dizer);
            if (soltarRetorno) await retomarDepoisDoWorldBoss(linha);
          } finally {
            if (soltarRetorno) soltarRetorno();
            worldBossCorrendo = false;
          }
        } else linha.textContent = lido?.emRaid ? 'World Boss: raid em andamento' : 'World Boss: fora do horário';
        return novamente();
      }
      if (lido.participando) {
        linha.textContent = `World Boss: ${lido.estado === 'active' ? 'na raid' : 'participação confirmada'}`;
        return novamente();
      }
      if (lido.fila > 0) { linha.textContent = `World Boss: posição ${lido.fila} na fila`; return novamente(); }

      worldBossCorrendo = true;
      let soltarWorldBoss = null;
      try {
        soltarWorldBoss = await esperarAVez(dizer);
        if (!soltarWorldBoss) { linha.textContent = 'World Boss: jogo ocupado'; return; }
        const origem = globalThis.PPX?.cacadas?.atual?.() || null;
        const timeOrigem = globalThis.PPX?.times?.qual?.() || '';
        linha.textContent = 'World Boss: voltando à cidade…';
        const cidade = await pausarCacadaEIrParaCidade();
        if (cidade?.erro) { linha.textContent = `World Boss: ${cidade.erro}`; return; }
        if (cfg.worldBossTime) {
          const times = globalThis.PPX?.times;
          if (!times?.usar) { linha.textContent = 'World Boss: ligue a ferramenta Times no menu'; return; }
          linha.textContent = `World Boss: montando o time “${cfg.worldBossTime}”…`;
          const troca = await times.usar(cfg.worldBossTime);
          if (!troca?.ok) { linha.textContent = `World Boss: não montei o time: ${troca?.erro || 'falhou'}`; return; }
        }
        linha.textContent = 'World Boss: abrindo a raid…';
        const entrou = await ponte('entrarWorldBoss');
        if (entrou?.erro) { linha.textContent = `World Boss: ${entrou.erro}`; return; }
        guardarRetornoWorldBoss({
          evento: lido.evento || '',
          cacada: origem?.nome || '',
          time: timeOrigem,
          quando: Date.now(),
        });
        linha.textContent = entrou.situacao === 'fila'
          ? `World Boss: posição ${entrou.fila} na fila`
          : entrou.situacao === 'raid' ? 'World Boss: entrada confirmada' : 'World Boss: participação confirmada';
      } finally {
        if (soltarWorldBoss) soltarWorldBoss();
        worldBossCorrendo = false;
        novamente();
      }
    };

    const atualizar = async () => {
      const r = await ponte('estado');
      if (!r?.erro) estadoVisto = r;
      desenhar();
      return r;
    };
    const executar = async (automatico = false) => {
      if (correndo) return;
      correndo = true; desenhar();
      let soltar = null;
      try {
        soltar = await esperarAVez(dizer);
        if (!soltar) return dizer('O jogo ficou ocupado tempo demais.', true);
        if (automatico) { cfg.ultima = Date.now(); proxima = 0; gravar(); }
        dizer('Procurando recompensas concluídas…');
        const r = await ponte('resgatar', { intervalo: cfg.intervalo });
        if (r?.erro) return dizer(`Não consegui resgatar: ${r.erro}`, true);
        dizer(r.quantidade ? `Resgatei ${r.quantidade} recompensa(s).` : 'Nenhuma recompensa concluída para resgatar.');
        await atualizar();
      } finally {
        if (soltar) soltar();
        correndo = false; desenhar(); agendar();
      }
    };
    function agendar() {
      clearTimeout(relogio);
      const f = falta();
      if (f === null) return desenhar();
      relogio = setTimeout(() => void executar(true), Math.min(f, 2147483647));
      desenhar();
    }

    campo('[data-ligar]').addEventListener('click', () => {
      cfg.ligada = !cfg.ligada; proxima = 0; gravar();
      dizer(cfg.ligada ? 'Ligado. Vou resgatar no horário escolhido.' : 'Parado.'); agendar();
      void verificarWorldBoss();
    });
    campo('[data-agora]').addEventListener('click', () => void executar(false));
    campo('[data-hora]').addEventListener('change', (e) => {
      cfg.hora = e.target.value; cfg.ultima = 0; proxima = 0; gravar(); desenhar(); agendar();
    });
    campo('[data-intervalo]').addEventListener('change', (e) => {
      const segundos = Number(e.target.value);
      cfg.intervalo = Math.round(Math.min(10, Math.max(0.5, Number.isFinite(segundos) ? segundos : 1.5)) * 1000);
      gravar(); desenhar();
    });
    campo('[data-world-boss]').addEventListener('change', (e) => {
      cfg.worldBoss = e.target.checked; gravar(); desenhar(); void verificarWorldBoss();
    });
    campo('[data-world-boss-time]').addEventListener('change', (e) => {
      cfg.worldBossTime = e.target.value; gravar();
    });
    campo('[data-recarregar-times]').addEventListener('click', () => {
      preencherTimesWorldBoss();
      const quantos = globalThis.PPX?.times?.nomes?.().length || 0;
      dizer(quantos ? `${quantos} time(s) relido(s).` : 'Nenhum time guardado foi encontrado.', !quantos);
    });

    const botoes = globalThis.PPX?.config?.montarBotoes({
      id: 'eventos', nome: 'Eventos', coletar: () => ({
        hora: cfg.hora,
        intervalo: cfg.intervalo,
        worldBoss: cfg.worldBoss !== false,
        worldBossTime: cfg.worldBossTime || '',
      }),
      aplicar: (d) => {
        cfg.hora = /^\d{2}:\d{2}$/.test(String(d?.hora || '')) ? String(d.hora) : PADRAO.hora;
        cfg.intervalo = Math.min(10000, Math.max(500, Number(d?.intervalo) || PADRAO.intervalo));
        cfg.worldBoss = d?.worldBoss !== false;
        cfg.worldBossTime = String(d?.worldBossTime || '').slice(0, 100);
        cfg.ultima = 0; proxima = 0; gravar(); desenhar(); agendar();
      }, avisar: dizer,
    });
    if (botoes) campo('[data-config]').append(botoes.el);

    let minimizado = ler(CHAVE_MIN, false) === true;
    const recolocar = () => {
      if (globalThis.PPX?.canto?.aplicar(painel, ler(CHAVE_POS, null))) return;
      painel.style.left = '16px'; painel.style.top = '180px';
    };
    const minimizar = () => {
      painel.classList.toggle('minimizado', minimizado);
      campo('[data-titulo]').textContent = minimizado ? 'EVT' : 'Eventos';
      campo('[data-minimizar]').textContent = minimizado ? '□' : '–'; recolocar();
    };
    campo('[data-minimizar]').addEventListener('click', () => { minimizado = !minimizado; guardar(CHAVE_MIN, minimizado); minimizar(); });
    campo('[data-fechar]').addEventListener('click', () => { painel.style.display = 'none'; globalThis.PPX?.anotar?.('eventos', false); });
    let arrasto = null;
    painel.querySelector('header').addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      const r = painel.getBoundingClientRect(); arrasto = { x: e.clientX - r.left, y: e.clientY - r.top };
    });
    addEventListener('pointermove', (e) => { if (!arrasto) return; painel.style.left = `${e.clientX - arrasto.x}px`; painel.style.top = `${e.clientY - arrasto.y}px`; });
    addEventListener('pointerup', () => { if (!arrasto) return; arrasto = null; const p = globalThis.PPX?.canto?.medir(painel); if (p) guardar(CHAVE_POS, p); });
    addEventListener('resize', recolocar);

    document.body.appendChild(painel); preencherTimesWorldBoss(); recolocar(); minimizar(); desenhar();
    void atualizar().finally(() => { agendar(); void verificarWorldBoss(); });
    globalThis.PPX?.controlar?.('eventos', (sim) => { painel.style.display = sim ? 'block' : 'none'; });
  },
);
