PPX.modulo({ id: 'senha', nome: 'Senha', atalhos: 'botões na tela de login' }, () => {
  const CHAVE = 'pp-senha';
  const CHAVE_USUARIO = 'pp-usuario';
  const CHAVE_POS = 'pp-senha-pos';
  const api = globalThis.chrome && chrome.storage && chrome.storage.local;

  /**
   * A extensao morreu por baixo desta aba?
   *
   * **E' o defeito que trouxe esta parte a ser revista.** Recarregar a extensao (em
   * `chrome://extensions`, ou reinstalando o pacote) nao mexe nas abas ja' abertas: o content
   * script continua a correr, com os seus botoes na tela, mas perde a ligacao a' extensao. A
   * partir dai' **toda** chamada a `chrome.storage` atira `Extension context invalidated.`, e era
   * isso que aparecia no botao — com a senha digitada a nao ir para lado nenhum.
   *
   * `chrome.runtime.id` e' o sinal canonico: existe enquanto a ligacao existe, e some' quando ela
   * cai. Serve para avisar **antes** de a pessoa digitar, em vez de depois.
   */
  const extensaoMorta = () => Boolean(api) && !globalThis.chrome?.runtime?.id;
  const eraOContexto = (e) => /context invalidated/i.test(String(e?.message || e));

  /** Prazo de qualquer ida ao armazenamento. Ver `pedir`. */
  const PACIENCIA = 5000;

  // O chrome.storage do Electron responde por callback, nao por promessa. Chamar so a forma
  // moderna deixava o botao travado no primeiro passo, sem erro visivel.
  const pedir = (metodo, arg) =>
    new Promise((ok, falhou) => {
      if (!api) return ok(null);
      if (extensaoMorta()) return falhou(new Error('context invalidated'));
      // Com a ligacao caida ha' chamadas que nao atiram: simplesmente nunca chamam de volta. Sem
      // prazo, o `await` ficava pendurado para sempre e o botao nao dizia nada — que e' a mesma
      // falha silenciosa que o comentario acima descreve, por outro caminho.
      const prazo = setTimeout(() => falhou(new Error('o armazenamento não respondeu')), PACIENCIA);
      const pronto = (valor) => {
        clearTimeout(prazo);
        ok(valor);
      };
      const ruim = (e) => {
        clearTimeout(prazo);
        falhou(e);
      };
      try {
        const r = api[metodo](arg, (valor) => pronto(valor));
        if (r && typeof r.then === 'function') r.then(pronto, ruim);
      } catch (e) {
        ruim(e);
      }
    });

  const guardar = async (chave, valor) => {
    if (api) return pedir('set', { [chave]: valor });
    localStorage.setItem(chave, typeof valor === 'string' ? valor : JSON.stringify(valor));
  };
  const ler = async (chave) => {
    if (api) return (await pedir('get', chave))?.[chave] ?? '';
    const bruto = localStorage.getItem(chave);
    if (bruto === null) return '';
    try {
      return chave === CHAVE_POS ? JSON.parse(bruto) : bruto;
    } catch (e) {
      return '';
    }
  };
  const apagar = async (chave) => {
    if (api) return pedir('remove', chave);
    localStorage.removeItem(chave);
  };

  const caixa = document.createElement('div');
  caixa.style.cssText =
    'position:fixed;right:14px;bottom:14px;z-index:2147483647;display:none;gap:6px;' +
    'align-items:center;font:13px system-ui,sans-serif;user-select:none;' +
    // Transparente em repouso, nitida ao chegar perto: na tela de login ela fica por cima do
    // jogo, e opaca o tempo todo tapa o que esta' atras sem precisar.
    'opacity:.82;transition:opacity .15s';
  const estiloBotao =
    'background:#1d2433;color:#e6e9ef;border:1px solid #3a4152;border-radius:8px;' +
    'padding:7px 12px;cursor:pointer';
  const estiloCampo =
    'display:none;background:#11151d;color:#e6e9ef;border:1px solid #3a4152;' +
    'border-radius:8px;padding:7px 10px;width:130px';

  const alca = document.createElement('span');
  alca.textContent = '⠿';
  alca.title = 'Arraste daqui para mover';
  alca.style.cssText =
    'color:#8b93a5;padding:4px 6px;font-size:15px;cursor:move;touch-action:none;' +
    'background:#1d2433;border:1px solid #3a4152;border-radius:8px';

  const botao = document.createElement('button');
  botao.textContent = 'Colar login';
  botao.style.cssText = estiloBotao;

  const engrenagem = document.createElement('button');
  engrenagem.textContent = 'definir';
  engrenagem.style.cssText = estiloBotao;

  const entradaUsuario = document.createElement('input');
  entradaUsuario.type = 'text';
  entradaUsuario.placeholder = 'usuário';
  entradaUsuario.autocomplete = 'off';
  entradaUsuario.spellcheck = false;
  entradaUsuario.style.cssText = estiloCampo;

  const entrada = document.createElement('input');
  entrada.type = 'password';
  entrada.placeholder = 'senha, e Enter';
  entrada.style.cssText = estiloCampo;

  let voltas = new WeakMap();
  const recado = (alvo, texto, voltarPara) => {
    alvo.textContent = texto;
    clearTimeout(voltas.get(alvo));
    voltas.set(alvo, setTimeout(() => (alvo.textContent = voltarPara), 2500));
  };

  /**
   * O aviso que **fica**, para a extensao recarregada.
   *
   * Um recado de dois segundos e meio serve para "sem campo" ou "colado": some' e a pessoa segue.
   * Nao serve aqui, porque nada nesta aba volta a funcionar ate' haver um F5 — e um aviso que
   * desaparece convida a tentar de novo, que foi exactamente o que aconteceu. Entao este nao
   * desaparece, e diz o que fazer em vez de citar o erro do navegador: "Extension context
   * invalidated" nao e' uma instrucao para ninguem.
   */
  const avisarMorta = (alvo) => {
    clearTimeout(voltas.get(alvo));
    alvo.textContent = 'recarregue a página (F5)';
    alvo.title =
      'A extensão foi recarregada e esta aba ficou sem ligação a ela. ' +
      'Nada se perdeu: o que já estava guardado continua guardado. Dê F5 nesta aba.';
  };

  // Erro visivel no proprio botao: falha silenciosa nao da pista nenhuma de onde olhar.
  const comAviso = (fn, alvo, voltarPara) => async () => {
    try {
      await fn();
    } catch (e) {
      if (extensaoMorta() || eraOContexto(e)) return avisarMorta(alvo);
      recado(alvo, 'erro: ' + String(e && e.message ? e.message : e).slice(0, 40), voltarPara);
    }
  };

  const nossos = [entrada, entradaUsuario];
  const aVista = (el) => el.offsetParent !== null && !nossos.includes(el);

  // A tela de criar conta do jogo tem dois campos de senha, os dois marcados new-password. Colar
  // ali nao faz sentido — isto serve para entrar, nao para se cadastrar —, e deixar a caixa de
  // fora dessa tela e mais honesto do que preencher so metade do cadastro.
  const campoSenha = () =>
    [...document.querySelectorAll('input[type="password"]')].find(
      (el) => aVista(el) && el.autocomplete !== 'new-password',
    ) || null;

  // So os arredores do campo de senha: a busca para tras solta pela pagina inteira achava a
  // caixa de busca do site numa tela que pedia so a senha, e escrevia o usuario la dentro.
  const arredores = (senha) => {
    const form = senha.closest('form');
    if (form) return form;
    let no = senha.parentElement || document.body;
    for (let i = 0; i < 3; i += 1) {
      const acima = no.parentElement;
      if (!acima || acima === document.body) break;
      no = acima;
    }
    return no;
  };

  // A tela do PokePixel marca o campo com autocomplete="username", que e o sinal que o proprio
  // navegador usa: vale mais do que qualquer palpite nosso. Os outros dois padroes cobrem telas
  // que nao marcam nada.
  const MARCAS = [
    'input[autocomplete="username"]',
    'input[autocomplete="email"]',
    'input[type="email"]',
  ];
  const ESCREVIVEIS = ['text', 'email', 'tel', 'url', ''];
  const campoUsuario = (senha = campoSenha()) => {
    if (!senha) return null;
    const perto = arredores(senha);
    for (const marca of MARCAS) {
      const el = [...perto.querySelectorAll(marca)].find(aVista);
      if (el) return el;
    }
    // Sem marca nenhuma, sobra a ordem, que e a unica coisa que toda tela de login respeita: o
    // usuario vem logo antes da senha. A busca anda para tras a partir dela.
    const campos = [...perto.querySelectorAll('input')];
    for (let i = campos.indexOf(senha) - 1; i >= 0; i -= 1) {
      const el = campos[i];
      if (aVista(el) && ESCREVIVEIS.includes(el.type.toLowerCase())) return el;
    }
    return null;
  };

  // React nao percebe uma atribuicao direta em .value: e preciso usar o setter nativo do
  // elemento e avisar a pagina, senao o formulario continua achando que o campo esta vazio.
  const preencher = (campo, valor) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(campo, valor);
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    campo.dispatchEvent(new Event('change', { bubbles: true }));
  };

  botao.onclick = comAviso(
    async () => {
      const campo = campoSenha();
      if (!campo) return recado(botao, 'sem campo', 'Colar login');
      const [senha, usuario] = await Promise.all([ler(CHAVE), ler(CHAVE_USUARIO)]);
      if (!senha && !usuario) return recado(botao, 'nada guardado', 'Colar login');
      // Quem instalou a versao que so guardava a senha continua com ela funcionando: o usuario
      // e preenchido apenas quando existe um guardado.
      const doUsuario = usuario ? campoUsuario(campo) : null;
      if (doUsuario) preencher(doUsuario, usuario);
      if (senha) preencher(campo, senha);
      campo.focus();
      // Dizer que faltou o campo de usuario importa: sem esse aviso, um login que entrou so com
      // a senha pareceria ter funcionado.
      recado(botao, usuario && !doUsuario ? 'sem campo de usuário' : 'colado', 'Colar login');
    },
    botao,
    'Colar login',
  );

  const fecharCampos = () => {
    entradaUsuario.style.display = 'none';
    entrada.style.display = 'none';
    entradaUsuario.value = '';
    entrada.value = '';
    engrenagem.textContent = 'definir';
  };

  // Guarda o que foi digitado e deixa em paz o que ficou vazio: assim da para trocar so a senha,
  // ou so o usuario, sem ter de digitar os dois de novo.
  const salvarCampos = async () => {
    const usuario = entradaUsuario.value.trim();
    const senha = entrada.value;
    if (!usuario && !senha) return;
    if (usuario) await guardar(CHAVE_USUARIO, usuario);
    if (senha) await guardar(CHAVE, senha);
    recado(botao, 'guardado', 'Colar login');
    fecharCampos();
  };

  engrenagem.onclick = comAviso(
    async () => {
      if (entrada.style.display === 'none') {
        entradaUsuario.style.display = 'block';
        entrada.style.display = 'block';
        // O usuario guardado aparece ja escrito, para dar para corrigir sem redigitar. A senha
        // nunca: ela nao volta para a tela depois de guardada.
        entradaUsuario.value = (await ler(CHAVE_USUARIO)) || '';
        entrada.value = '';
        entradaUsuario.focus();
        engrenagem.textContent = 'apagar';
        return;
      }
      if (!entradaUsuario.value.trim() && !entrada.value) {
        await Promise.all([apagar(CHAVE), apagar(CHAVE_USUARIO)]);
        recado(botao, 'apagado', 'Colar login');
        fecharCampos();
        return;
      }
      await salvarCampos();
    },
    engrenagem,
    'definir',
  );

  entradaUsuario.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    entrada.focus();
  });

  entrada.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    try {
      await salvarCampos();
    } catch (err) {
      // **Nao se fecham os campos aqui.** Fechar apagava o que a pessoa acabara de digitar, por
      // cima de um erro que ja' dizia que nada tinha sido guardado: a senha sumia da tela e do
      // armazenamento ao mesmo tempo, e so' restava digitar tudo de novo para falhar outra vez.
      if (extensaoMorta() || eraOContexto(err)) return avisarMorta(botao);
      recado(botao, 'erro ao guardar', 'Colar login');
    }
  });

  // Uma janela menor, ou um monitor trocado, nao pode deixar o botao fora do alcance.
  const posicionar = (x, y) => {
    const r = caixa.getBoundingClientRect();
    caixa.style.left = Math.min(Math.max(0, x), Math.max(0, innerWidth - r.width)) + 'px';
    caixa.style.top = Math.min(Math.max(0, y), Math.max(0, innerHeight - r.height)) + 'px';
    caixa.style.right = 'auto';
    caixa.style.bottom = 'auto';
  };

  let dx = 0;
  let dy = 0;
  let arrastando = false;
  alca.addEventListener('pointerdown', (e) => {
    const r = caixa.getBoundingClientRect();
    dx = e.clientX - r.left;
    dy = e.clientY - r.top;
    arrastando = true;
    alca.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  alca.addEventListener('pointermove', (e) => {
    if (arrastando) posicionar(e.clientX - dx, e.clientY - dy);
  });
  const soltar = (e) => {
    if (!arrastando) return;
    arrastando = false;
    try {
      alca.releasePointerCapture(e.pointerId);
    } catch (err) {
      /* ponteiro ja solto */
    }
    void guardar(CHAVE_POS, {
      x: parseFloat(caixa.style.left),
      y: parseFloat(caixa.style.top),
    });
  };
  alca.addEventListener('pointerup', soltar);
  alca.addEventListener('pointercancel', soltar);

  // Rearranjar as views do LionMultInstance muda o tamanho da janela; sem isto os botoes
  // ficariam pendurados fora dela, onde nao da' para clicar.
  let ajuste = 0;
  addEventListener('resize', () => {
    clearTimeout(ajuste);
    ajuste = setTimeout(() => {
      if (caixa.style.display === 'none' || !caixa.style.left) return;
      posicionar(parseFloat(caixa.style.left) || 0, parseFloat(caixa.style.top) || 0);
    }, 150);
  });

  caixa.append(alca, entradaUsuario, entrada, engrenagem, botao);
  document.body.appendChild(caixa);

  // Enquanto se digita a senha o foco segura a nitidez: so' o mouse sair nao basta para apagar o
  // campo que ainda esta' em uso.
  let sobCursor = false;
  const nitidez = () => {
    const usando = sobCursor || caixa.contains(document.activeElement);
    caixa.style.opacity = usando ? '1' : '.82';
  };
  caixa.addEventListener('pointerenter', () => ((sobCursor = true), nitidez()));
  caixa.addEventListener('pointerleave', () => ((sobCursor = false), nitidez()));
  caixa.addEventListener('focusin', nitidez);
  caixa.addEventListener('focusout', () => setTimeout(nitidez, 0));

  let salva = null;
  void ler(CHAVE_POS).then((pos) => {
    if (pos && typeof pos.x === 'number') salva = pos;
  });

  // Escondida pelo menu, a caixa nao volta sozinha quando a tela de login aparece: a escolha da
  // pessoa vale mais do que a regra de so' aparecer no login.
  let permitida = globalThis.PPX?.visivel?.('senha') !== false;
  globalThis.PPX?.controlar?.('senha', (sim) => {
    permitida = sim;
    visivel = false;
    conferir();
  });

  // O par de botoes so aparece onde ha senha para digitar, para nao atrapalhar o jogo.
  let visivel = false;
  function conferir() {
    const deveAparecer = permitida && !!campoSenha();
    if (deveAparecer === visivel) return;
    visivel = deveAparecer;
    caixa.style.display = deveAparecer ? 'flex' : 'none';
    if (deveAparecer && salva) posicionar(salva.x, salva.y);
    // O aviso tem de chegar **antes** de a pessoa digitar a senha, e nao depois de ela carregar em
    // Enter e ver o erro: na tela de login e' quando ela abre a caixa que da' para avisar a tempo.
    if (deveAparecer && extensaoMorta()) avisarMorta(botao);
    if (!deveAparecer) fecharCampos();
  }
  setInterval(conferir, 1000);
});
