// PokePixel - qualidade de vida: exportar e importar a configuracao de uma ferramenta.
//
// POR QUE ISTO EXISTE. O mesmo jogo corre em varias janelas do LionMultInstance, uma por conta, e
// cada janela tem o seu proprio `localStorage`. Deixar a venda do jeito certo numa conta e repetir
// a mao em todas as outras — raridades, teto, lote, horarios, dias — e' trabalho que ninguem quer
// fazer duas vezes, e e' trabalho em que se erra. Um arquivo resolve: exporta de uma, importa nas
// outras. De quebra, e' a unica copia de seguranca que existe destas configuracoes.
//
// O QUE ESTE ARQUIVO **NAO** SABE. Nao sabe o que e' um teto, uma raridade ou uma janela de
// horario. Cada ferramenta entrega o que quer guardar (`coletar`) e recebe de volta o que veio no
// arquivo (`aplicar`); aqui so' mora o empacotamento, o arquivo e as recusas. E' por isso que
// acrescentar isto a uma ferramenta nova nao mexe neste arquivo.
//
// AS DUAS RECUSAS QUE IMPORTAM.
//   1. **Um arquivo da compra nao entra na venda.** Sao duas configuracoes com campos parecidos e
//      significados diferentes; aplicar uma na outra passaria calado e so' apareceria no dia em
//      que a automacao agisse na hora errada. O pacote carrega o nome da ferramenta e a entrada
//      confere.
//   2. **So' entra o que a ferramenta reconhece.** Quem aplica e' ela, campo a campo, e nao este
//      arquivo escrevendo no armazenamento o que vier escrito. Um JSON montado a mao nao vira uma
//      chave arbitraria no `localStorage` do jogo.
//
// E O QUE E' CONFIGURACAO, E O QUE NAO E'. O que a pessoa escolheu entra. O que a extensao
// descobriu sozinha — o catalogo da loja, o estoque, o saldo, a contagem da ultima lista — fica de
// fora: sao retratos do jogo **daquela** conta, e levar o retrato de uma conta para outra seria
// mostrar numeros que nao sao dela. O carimbo da ultima rodada tambem fica: e' estado do relogio,
// e importa-lo faria a janela de hoje passar por ja' usada.

(() => {
  'use strict';

  /** O nome do pacote dentro do arquivo: e' o que separa isto de qualquer outro JSON. */
  const PACOTE = 'pokepixel-qualidade-de-vida';

  /** A versao do **formato**, nao a da extensao: so' muda se o formato mudar. */
  const FORMATO = 1;

  /** Configurações que já têm coletor e importador próprios, registradas ao montar seus botões. */
  const registros = new Map();
  const FORA_DO_BACKUP_GERAL = new Set(['times', 'escada']);

  /**
   * Ferramentas simples que ainda não têm painel de Exportar/Importar. Só estas chaves reconhecidas
   * viajam. Estado da conta (placares, tarefas, catálogos) e toda a extensão Times ficam de fora.
   */
  const CHAVES_SIMPLES = [
    'lioncode:pokepixel:modulos',
    'lioncode:pokepixel:visiveis',
    'lmi-ocultar-popups',
    'pp-sem-grafico',
    'pp-senha',
    'pp-usuario',
    'lioncode:gym:escolhas',
    'lioncode:gym:agenda',
    'lioncode:raridades:faixa',
  ];

  const dois = (n) => String(n).padStart(2, '0');

  /** `venda-rapida-config-2026-10-06.json` — a data no nome poupa abrir para saber qual e' qual. */
  const nomeDoArquivo = (ferramenta, agora = new Date()) =>
    `${ferramenta}-config-${agora.getFullYear()}-${dois(agora.getMonth() + 1)}-` +
    `${dois(agora.getDate())}.json`;

  const montarPacote = (ferramenta, nome, dados, agora = new Date()) => ({
    pacote: PACOTE,
    formato: FORMATO,
    ferramenta,
    nome,
    quando: agora.toISOString(),
    dados,
  });

  /** Um objeto simples, e nao uma lista nem `null`: e' o unico formato que `dados` aceita. */
  const ehObjeto = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

  /**
   * Le' o texto de um arquivo exportado.
   *
   * Devolve `{ ok: true, dados, nome, quando }` ou `{ ok: false, erro }` com a frase pronta para a
   * tela. Nunca atira: um arquivo errado e' uma resposta, nao um acidente.
   */
  const lerPacote = (texto, ferramenta) => {
    let lido;
    try {
      lido = JSON.parse(texto);
    } catch {
      return { ok: false, erro: 'esse arquivo não é uma configuração — não consegui lê-lo' };
    }
    if (!ehObjeto(lido) || lido.pacote !== PACOTE)
      return { ok: false, erro: 'esse arquivo não é uma configuração desta extensão' };
    if (lido.ferramenta !== ferramenta)
      return {
        ok: false,
        // Dizer **de qual** ferramenta ele e': "arquivo errado" manda procurar no escuro.
        erro: `essa configuração é de outra ferramenta (${lido.nome || lido.ferramenta})`,
      };
    if (!ehObjeto(lido.dados))
      return { ok: false, erro: 'essa configuração está vazia ou corrompida' };
    return { ok: true, dados: lido.dados, nome: lido.nome || ferramenta, quando: lido.quando || '' };
  };

  /**
   * Entrega o texto como arquivo baixado.
   *
   * Devolve o que aconteceu, para a ferramenta dizer na tela. Se o navegador recusar o download —
   * a pagina do jogo tem a sua propria politica de conteudo, e ela nao e' nossa —, a configuracao
   * ainda vai para a area de transferencia, que entre duas janelas do LionMultInstance serve tao
   * bem quanto um arquivo.
   */
  const baixar = async (nome, texto) => {
    try {
      const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
      const alvo = document.createElement('a');
      alvo.href = url;
      alvo.download = nome;
      document.body.append(alvo);
      alvo.click();
      alvo.remove();
      // Revogar no ato cancelaria o download no meio em alguns navegadores.
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return { ok: true, como: 'arquivo' };
    } catch {
      try {
        await navigator.clipboard.writeText(texto);
        return { ok: true, como: 'área de transferência' };
      } catch {
        return { ok: false, como: '' };
      }
    }
  };

  /**
   * Os dois botoes, prontos para pendurar no rodape de uma ferramenta.
   *
   * `coletar()` devolve o que guardar. `aplicar(dados)` recebe o que veio e devolve a frase a
   * mostrar — ou atira, e a frase vira o erro. `avisar(frase, ruim)` escreve na tela da ferramenta,
   * que e' quem sabe onde a frase cabe.
   */
  const montarBotoes = ({ id, nome, coletar, aplicar, avisar = () => {} }) => {
    // O backup geral chama exatamente os mesmos coletores e importadores dos botões individuais.
    // Times e Escada continuam com exportação individual, mas nunca entram no arquivo geral.
    // Times carregam IDs da conta; a Escada é uma configuração operacional que o dono quer montar
    // separadamente em cada janela.
    if (!FORA_DO_BACKUP_GERAL.has(id)) registros.set(id, { id, nome, coletar, aplicar, avisar });
    const el = document.createElement('span');
    el.className = 'ppx-cfg';
    el.innerHTML = `
      <button type="button" data-cfg-exportar
        title="Guardar esta configuração num arquivo, para levá-la a outra conta">Exportar</button>
      <button type="button" data-cfg-importar
        title="Ler a configuração de um arquivo exportado — o que está aqui é substituído">Importar</button>`;
    // O seletor de arquivo mora fora do painel por um motivo simples: o painel pode estar
    // escondido (Alt+D) quando o clique acontecer, e um `input` dentro de uma arvore escondida nao
    // abre a janela de escolher arquivo.
    const arquivo = document.createElement('input');
    arquivo.type = 'file';
    arquivo.accept = 'application/json,.json';
    arquivo.style.display = 'none';
    arquivo.dataset.cfgArquivo = id;
    document.body.append(arquivo);

    const estilo = document.createElement('style');
    estilo.textContent = `
      .ppx-cfg { display: inline-flex; gap: 6px; }
      .ppx-cfg button {
        background: #19202c; color: #c8d2e0; border: 1px solid #2a3240; border-radius: 6px;
        padding: 4px 8px; font: inherit; font-size: 11px; cursor: pointer;
      }
      .ppx-cfg button:hover:not(:disabled) { background: #222c3d; }
      .ppx-cfg button:disabled { opacity: .45; cursor: default; }`;
    el.append(estilo);

    el.querySelector('[data-cfg-exportar]').addEventListener('click', async () => {
      let texto;
      try {
        texto = JSON.stringify(montarPacote(id, nome, coletar()), null, 2);
      } catch (e) {
        avisar(`não consegui montar a configuração: ${e.message}`, true);
        return;
      }
      const feito = await baixar(nomeDoArquivo(id), texto);
      avisar(
        feito.ok
          ? `Configuração exportada para a ${feito.como}.`
          : 'não consegui exportar — o navegador recusou o arquivo',
        !feito.ok,
      );
    });

    el.querySelector('[data-cfg-importar]').addEventListener('click', () => {
      // Sem isto, escolher duas vezes o mesmo arquivo nao dispara nada: o valor nao mudou.
      arquivo.value = '';
      // O painel pode ter sido reconstruido, ou o `body` trocado: garantir a casa custa uma linha.
      if (!arquivo.isConnected) document.body.append(arquivo);
      arquivo.click();
    });

    arquivo.addEventListener('change', async () => {
      const escolhido = arquivo.files?.[0];
      if (!escolhido) return;
      let texto = '';
      try {
        texto = await escolhido.text();
      } catch {
        avisar('não consegui ler esse arquivo', true);
        return;
      }
      const lido = lerPacote(texto, id);
      if (!lido.ok) {
        avisar(lido.erro, true);
        return;
      }
      try {
        avisar(aplicar(lido.dados) || 'Configuração importada.');
      } catch (e) {
        avisar(e.message || 'não consegui aplicar essa configuração', true);
      }
    });

    return { el, arquivo };
  };

  const coletarTudo = () => {
    const ferramentas = {};
    for (const [id, r] of registros) ferramentas[id] = r.coletar();
    const simples = {};
    for (const chave of CHAVES_SIMPLES) {
      const valor = localStorage.getItem(chave);
      if (valor !== null) simples[chave] = valor;
    }
    return { ferramentas, simples };
  };

  const aplicarTudo = (dados) => {
    const ferramentas = ehObjeto(dados?.ferramentas) ? dados.ferramentas : {};
    const simples = ehObjeto(dados?.simples) ? dados.simples : {};
    const erros = [];
    let aplicadas = 0;
    for (const [id, valor] of Object.entries(ferramentas)) {
      const r = registros.get(id);
      if (!r || !ehObjeto(valor)) continue;
      try {
        r.aplicar(valor);
        aplicadas += 1;
      } catch (e) {
        erros.push(`${r.nome}: ${e.message || e}`);
      }
    }
    for (const chave of CHAVES_SIMPLES) {
      if (typeof simples[chave] !== 'string') continue;
      localStorage.setItem(chave, simples[chave]);
      aplicadas += 1;
    }
    if (erros.length) throw new Error(`Importei ${aplicadas}; faltou ${erros.join(' · ')}`);
    return `Configurações importadas (${aplicadas}). Recarregue a página para aplicar tudo.`;
  };

  const montarBotoesGerais = () => {
    const el = document.createElement('div');
    el.className = 'ppx-cfg-geral';
    el.innerHTML = `
      <button type="button" data-tudo-exportar>Exportar tudo</button>
      <button type="button" data-tudo-importar>Importar tudo</button>
      <small data-tudo-aviso>Times e Escada não entram; referências pelos nomes entram.</small>`;
    const arquivo = document.createElement('input');
    arquivo.type = 'file';
    arquivo.accept = 'application/json,.json';
    arquivo.hidden = true;
    document.body.append(arquivo);
    const aviso = el.querySelector('[data-tudo-aviso]');
    el.querySelector('[data-tudo-exportar]').addEventListener('click', async () => {
      const texto = JSON.stringify(
        montarPacote('todas', 'Todas as ferramentas (sem Times e Escada)', coletarTudo()),
        null,
        2,
      );
      const feito = await baixar(nomeDoArquivo('pokepixel-todas'), texto);
      aviso.textContent = feito.ok
        ? `Tudo exportado para a ${feito.como}, sem Times e Escada.`
        : 'Não consegui exportar.';
    });
    el.querySelector('[data-tudo-importar]').addEventListener('click', () => {
      arquivo.value = '';
      if (!arquivo.isConnected) document.body.append(arquivo);
      arquivo.click();
    });
    arquivo.addEventListener('change', async () => {
      const escolhido = arquivo.files?.[0];
      if (!escolhido) return;
      const lido = lerPacote(await escolhido.text(), 'todas');
      if (!lido.ok) return void (aviso.textContent = lido.erro);
      try {
        aviso.textContent = aplicarTudo(lido.dados);
      } catch (e) {
        aviso.textContent = e.message || 'Não consegui importar tudo.';
      }
    });
    return el;
  };

  const API = {
    PACOTE,
    FORMATO,
    montarPacote,
    lerPacote,
    nomeDoArquivo,
    montarBotoes,
    coletarTudo,
    aplicarTudo,
  };

  if (typeof globalThis.PPX === 'object' && globalThis.PPX) {
    globalThis.PPX.config = API;
    globalThis.PPX.colocarConfigGeral?.(montarBotoesGerais());
  }
  // Para o teste de mesa: `new Function('module', fonte)`. Ver `testes/config.test.mjs`.
  if (typeof module === 'object' && module) module.exports = API;
})();
