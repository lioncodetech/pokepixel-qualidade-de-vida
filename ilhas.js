// Ilhas Lendarias: troca temporariamente a cacada e o time enquanto o mundo estiver liberado.
PPX.modulo(
  { id: 'ilhas', nome: 'Ilhas Lendárias', atalhos: 'configuração pelo menu (Alt+Q)' },
  () => {
    'use strict';

    const CHAVE = 'lioncode:ilhas:config';
    const CHAVE_SESSAO = 'lioncode:ilhas:sessao';
    const CHAVE_POS = 'lioncode:ilhas:posicao';
    const MINHA_VEZ = 'ilhas';
    const INTERVALO = 2 * 60 * 1000;
    const PADRAO = { ligada: false, pausada: false, time: '', cacada: '' };
    const ler = (chave, padrao) => {
      try { return JSON.parse(localStorage.getItem(chave)) ?? padrao; } catch { return padrao; }
    };
    const escrever = (chave, valor) => {
      try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* sem armazenamento */ }
    };
    let cfg = { ...PADRAO, ...(ler(CHAVE, null) || {}) };
    let sessao = ler(CHAVE_SESSAO, null);
    let correndo = false;
    let retomadaPendente = 0;
    let ultima = [];
    let texto = 'Aguardando a primeira verificação.';
    const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
    const semAcento = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const ehIlha = (c) => semAcento(c?.regiao).includes('ilhas lendarias');
    const todasIlhas = () => (globalThis.PPX?.cacadas?.todas?.() || []).filter(ehIlha);
    const abertas = () => todasIlhas().filter((c) => c.trancada !== true);
    const atual = () => globalThis.PPX?.cacadas?.atual?.() || null;
    const naExpedicao = () => atual()?.tipo === 'expedicao';
    const suspenderEscada = () => globalThis.PPX?.escada?.suspender?.(MINHA_VEZ);
    const liberarEscada = () => globalThis.PPX?.escada?.liberar?.(MINHA_VEZ);

    const painel = document.createElement('div');
    painel.id = 'lioncode-ilhas';
    painel.innerHTML = `
      <header><strong>Ilhas Lendárias</strong><button data-min>–</button><button data-fechar>×</button></header>
      <div class="resumo" data-resumo>—</div>
      <div class="botoes"><button data-ligar>Iniciar</button><button data-pausar>Pausar</button></div>
      <div class="corpo">
        <label>caçada <select data-cacada><option value="">escolha uma ilha</option></select></label>
        <label class="com-acao">time <select data-time><option value="">escolha um time</option></select><button type="button" data-recarregar-times title="Atualizar a lista de times">↻</button></label>
        <button data-verificar>Verificar agora</button>
        <p data-estado></p>
      </div>`;
    const estilo = document.createElement('style');
    estilo.textContent = `
      #lioncode-ilhas,#lioncode-ilhas *{box-sizing:border-box}#lioncode-ilhas{position:fixed;z-index:2147483000;right:20px;top:190px;width:270px;background:var(--ppx-fundo);color:var(--ppx-texto);border:1px solid var(--ppx-borda);border-radius:var(--ppx-raio);font:var(--ppx-fonte);box-shadow:var(--ppx-sombra);max-height:var(--ppx-teto);overflow:auto;scrollbar-width:thin;scrollbar-color:var(--ppx-borda) transparent}
      #lioncode-ilhas header{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid #2a3244;cursor:move;user-select:none}#lioncode-ilhas header strong{flex:1}#lioncode-ilhas header button{border:0;background:none;color:#8b97a8;cursor:pointer}#lioncode-ilhas .resumo{padding:6px 10px;color:#8b97a8;font-size:12px}#lioncode-ilhas .botoes{display:flex;gap:6px;padding:0 10px 10px}#lioncode-ilhas button,#lioncode-ilhas select{border:1px solid #2a3244;border-radius:6px;background:#182030;color:#e7edf6;padding:6px}#lioncode-ilhas .botoes button{flex:1}#lioncode-ilhas .corpo{display:grid;gap:8px;padding:0 10px 10px;min-width:0;overflow:hidden}#lioncode-ilhas label{display:grid;grid-template-columns:46px minmax(0,1fr);align-items:center;gap:6px;min-width:0;width:100%}#lioncode-ilhas label.com-acao{grid-template-columns:46px minmax(0,1fr) auto}#lioncode-ilhas label select{display:block;width:100%;min-width:0;max-width:100%;text-overflow:ellipsis}#lioncode-ilhas p{margin:0;color:#8b97a8;font-size:12px;overflow-wrap:anywhere}#lioncode-ilhas p.mau{color:#f85149}#lioncode-ilhas.minimizado .corpo{display:none}`;
    document.documentElement.append(estilo, painel);
    const campo = (s) => painel.querySelector(s);

    const gravar = () => escrever(CHAVE, cfg);
    const gravarSessao = () => escrever(CHAVE_SESSAO, sessao);
    const dizer = (s, mau = false) => {
      texto = s;
      campo('[data-estado]').textContent = s;
      campo('[data-estado]').classList.toggle('mau', mau);
      desenharResumo();
    };
    const desenharResumo = () => {
      const disponibilidade = ultima.length ? `${ultima.length} aberta(s)` : 'fechadas';
      const modo = !cfg.ligada ? 'desligado' : cfg.pausada ? 'pausado' : correndo ? 'mudando' : 'monitorando';
      campo('[data-resumo]').textContent = `${disponibilidade} · ${modo}`;
      campo('[data-ligar]').textContent = cfg.ligada ? 'Desligar' : 'Ligar';
      campo('[data-pausar]').textContent = cfg.pausada ? 'Retomar' : 'Pausar';
      campo('[data-pausar]').disabled = !cfg.ligada;
    };
    const preencher = () => {
      const hunt = campo('[data-cacada]');
      const time = campo('[data-time]');
      const huntAtual = cfg.cacada;
      const timeAtual = cfg.time;
      hunt.replaceChildren(new Option('escolha uma ilha', ''));
      for (const c of todasIlhas().sort((a, b) => a.nivel - b.nivel || a.nome.localeCompare(b.nome)))
        hunt.append(new Option(`${c.nome}${c.nivel ? ` · Lv ${c.nivel}` : ''}${c.trancada ? ' · fechada' : ' · aberta'}`, c.nome));
      time.replaceChildren(new Option('escolha um time', ''));
      for (const nome of globalThis.PPX?.times?.nomes?.() || []) time.append(new Option(nome, nome));
      hunt.value = huntAtual;
      time.value = timeAtual;
    };
    const outraAutomacao = () => {
      const vez = globalThis.PPX?.vez;
      const dono = vez?.dono?.();
      if (dono && dono.id !== MINHA_VEZ) return dono.id;
      return (vez?.esperando?.() || []).find((id) => id !== MINHA_VEZ) || '';
    };
    const esperarAVez = async () => {
      const vez = globalThis.PPX?.vez;
      if (!vez?.pedir) return () => {};
      const prioridade = outraAutomacao();
      if (prioridade) {
        dizer(`Ilhas pausadas para ${vez.nome(prioridade)}. Retomo quando terminar.`);
        return null;
      }
      return vez.pedir(MINHA_VEZ);
    };
    const ate = async (fn, limite = 20000) => {
      const inicio = Date.now();
      while (Date.now() - inicio < limite) {
        const r = fn();
        if (r) return r;
        await espera(250);
      }
      return null;
    };
    const irCidade = async () => {
      if (!atual()) return { ok: true };
      const botoes = [...document.querySelectorAll('button')];
      const voltar = botoes.find((b) => /voltar à cidade|voltar a cidade/i.test(b.textContent || ''));
      if (!voltar) return { ok: false, erro: 'não achei o botão Voltar à cidade' };
      voltar.click();
      return (await ate(() => !atual())) ? { ok: true } : { ok: false, erro: 'o jogo não voltou à cidade' };
    };
    const montar = async (nome) => {
      if (!nome) return { ok: true };
      if (globalThis.PPX?.times?.qual?.() === nome) return { ok: true };
      return globalThis.PPX?.times?.usar?.(nome) || { ok: false, erro: 'a ferramenta Times está desligada' };
    };

    const entrar = async () => {
      if (naExpedicao()) return dizer('Você está na expedição — as Ilhas esperam ela terminar.');
      const alvo = ultima.find((c) => c.nome === cfg.cacada);
      if (!alvo) return dizer(`As ilhas abriram, mas "${cfg.cacada}" não está disponível.`, true);
      const timeDaCacada = globalThis.PPX?.cacadas?.timeDe?.(alvo.nome) || '';
      if (timeDaCacada && timeDaCacada !== cfg.time)
        return dizer(`A caçada "${alvo.nome}" está ligada ao time "${timeDaCacada}" nas Caçadas. Escolha esse time aqui ou retire-o do atalho.`, true);
      const aqui = atual();
      if (aqui?.nome === alvo.nome) {
        suspenderEscada();
        return dizer(`Caçando em "${alvo.nome}" enquanto as ilhas estão abertas. Escada suspensa.`);
      }
      if (!sessao) {
        sessao = { cacada: aqui?.tipo === 'cacada' ? aqui.nome : '', time: globalThis.PPX?.times?.qual?.() || '' };
        gravarSessao();
      }
      const soltar = await esperarAVez();
      if (!soltar) return;
      correndo = true;
      desenharResumo();
      try {
        if (naExpedicao()) return dizer('Você está na expedição — as Ilhas esperam ela terminar.');
        let r = await irCidade();
        if (!r.ok) return dizer(r.erro, true);
        r = await montar(cfg.time);
        if (!r?.ok) return dizer(`Não consegui montar o time: ${r?.erro || 'falhou'}`, true);
        r = await globalThis.PPX?.cacadas?.ir?.(alvo.nome);
        if (!r?.ok) return dizer(`Não consegui entrar em "${alvo.nome}": ${r?.erro || 'falhou'}`, true);
        suspenderEscada();
        dizer(`Entrei em "${alvo.nome}" com o time "${cfg.time}".`);
      } finally { correndo = false; soltar(); desenharResumo(); }
    };

    const voltar = async () => {
      if (!sessao) return;
      if (naExpedicao()) return dizer('Você está na expedição — as Ilhas esperam ela terminar.');
      const destino = sessao;
      const soltar = await esperarAVez();
      if (!soltar) return;
      correndo = true;
      desenharResumo();
      try {
        if (naExpedicao()) return dizer('Você está na expedição — as Ilhas esperam ela terminar.');
        let r = await irCidade();
        if (!r.ok) return dizer(r.erro, true);
        r = await montar(destino.time);
        if (!r?.ok) return dizer(`Não consegui restaurar o time: ${r?.erro || 'falhou'}`, true);
        if (destino.cacada) {
          r = await globalThis.PPX?.cacadas?.ir?.(destino.cacada);
          if (!r?.ok) return dizer(`Não consegui voltar para "${destino.cacada}": ${r?.erro || 'falhou'}`, true);
        }
        sessao = null;
        gravarSessao();
        liberarEscada();
        dizer(destino.cacada ? `Voltei para "${destino.cacada}".` : 'As ilhas fecharam; fiquei na cidade.');
      } finally { correndo = false; soltar(); desenharResumo(); }
    };

    const verificar = async () => {
      if (correndo) return;
      if (cfg.ligada && !cfg.pausada && naExpedicao())
        return dizer('Você está na expedição — as Ilhas esperam ela terminar.');
      const prioridade = outraAutomacao();
      if (cfg.ligada && !cfg.pausada && prioridade) {
        return dizer(`Ilhas pausadas para ${globalThis.PPX?.vez?.nome?.(prioridade) || prioridade}. Retomo quando terminar.`);
      }
      const r = await globalThis.PPX?.cacadas?.atualizar?.();
      if (r && !r.ok) dizer(`Não consegui verificar as ilhas: ${r.erro}`, true);
      ultima = abertas();
      preencher();
      desenharResumo();
      if (!cfg.ligada || cfg.pausada) return;
      if (ultima.length) {
        if (!cfg.cacada || !cfg.time) return dizer('As ilhas estão abertas. Escolha a caçada e o time.', true);
        await entrar();
      } else if (sessao) await voltar();
      else dizer('Ilhas Lendárias fechadas. Continuo monitorando.');
    };

    campo('[data-ligar]').addEventListener('click', () => {
      cfg.ligada = !cfg.ligada;
      if (!cfg.ligada) cfg.pausada = false;
      if (!cfg.ligada) liberarEscada();
      gravar(); desenharResumo();
      dizer(cfg.ligada ? 'Monitoramento ligado.' : 'Monitoramento desligado.');
      if (cfg.ligada) void verificar();
    });
    campo('[data-pausar]').addEventListener('click', () => {
      cfg.pausada = !cfg.pausada;
      gravar(); desenharResumo();
      dizer(cfg.pausada ? 'Pausado: não troco caçada nem time.' : 'Retomado: verificando as ilhas.');
      if (!cfg.pausada) void verificar();
    });
    campo('[data-verificar]').addEventListener('click', () => void verificar());
    campo('[data-cacada]').addEventListener('change', (e) => { cfg.cacada = e.target.value; gravar(); });
    campo('[data-time]').addEventListener('change', (e) => { cfg.time = e.target.value; gravar(); });
    campo('[data-recarregar-times]').addEventListener('click', () => {
      preencher();
      const quantos = globalThis.PPX?.times?.nomes?.().length || 0;
      dizer(quantos ? `${quantos} time(s) relido(s).` : 'Nenhum time guardado foi encontrado.', !quantos);
    });
    campo('[data-min]').addEventListener('click', () => painel.classList.toggle('minimizado'));
    campo('[data-fechar]').addEventListener('click', () => { painel.style.display = 'none'; globalThis.PPX?.anotar?.('ilhas', false); });
    const recolocar = () => {
      if (globalThis.PPX?.canto?.aplicar(painel, ler(CHAVE_POS, null))) return;
      painel.style.left = 'auto'; painel.style.right = '20px'; painel.style.top = '190px';
    };
    let arrasto = null;
    painel.querySelector('header').addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      const r = painel.getBoundingClientRect();
      painel.style.left = `${r.left}px`; painel.style.top = `${r.top}px`; painel.style.right = 'auto';
      arrasto = { x: e.clientX - r.left, y: e.clientY - r.top };
    });
    addEventListener('pointermove', (e) => {
      if (!arrasto) return;
      const x = Math.max(0, Math.min(innerWidth - painel.offsetWidth, e.clientX - arrasto.x));
      const y = Math.max(0, Math.min(innerHeight - painel.offsetHeight, e.clientY - arrasto.y));
      painel.style.left = `${x}px`; painel.style.top = `${y}px`;
    });
    addEventListener('pointerup', () => {
      if (!arrasto) return;
      arrasto = null;
      const p = globalThis.PPX?.canto?.medir(painel);
      if (p) escrever(CHAVE_POS, p);
    });
    addEventListener('resize', recolocar);
    globalThis.PPX?.vez?.aoMudar?.(() => {
      if (!cfg.ligada || cfg.pausada || correndo) return;
      const prioridade = outraAutomacao();
      if (prioridade) {
        dizer(`Ilhas pausadas para ${globalThis.PPX?.vez?.nome?.(prioridade) || prioridade}. Retomo quando terminar.`);
        return;
      }
      clearTimeout(retomadaPendente);
      retomadaPendente = setTimeout(() => void verificar(), 1000);
    });
    globalThis.PPX?.controlar?.('ilhas', (sim) => { painel.style.display = sim ? 'block' : 'none'; });
    painel.style.display = globalThis.PPX?.visivel?.('ilhas') === false ? 'none' : 'block';
    recolocar();
    preencher();
    desenharResumo();
    setTimeout(() => void verificar(), 5000);
    setInterval(() => void verificar(), INTERVALO);
  },
);
