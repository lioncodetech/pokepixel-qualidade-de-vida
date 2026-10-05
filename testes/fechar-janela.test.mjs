// Guarda contra o defeito que travava o gerenciador de janelas do jogo.
//
// Nada aqui exercita o jogo: `fechar` so' existe contra o DOM dele. O que se protege e' a decisao,
// porque esta' custou caro. O pacote **ja' sabia** a medicao, escrita no comentario de
// `fecharPopups` em `venda-rapida.js` e `loja-rapida.js`: clicar no X de uma janela que ja' nao
// esta' na tela deixa o jogo convencido de que ha' uma janela aberta, e dali em diante ele recusa
// qualquer abertura ate' um F5. `times.js` nasceu conferindo o fechamento por `isConnected` — que
// continua verdadeiro numa janela fechada — e por isso clicava de novo, e de novo, ate' travar o
// jogo do usuario \"depois de usar umas tres vezes\".
//
// Rode com: node --test testes/*.test.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const ler = (arquivo) => readFileSync(new URL(`../${arquivo}`, import.meta.url), 'utf8');
const times = ler('times.js');

// Os comentarios citam `isConnected` de proposito, para explicar por que ele nao serve. Quem nao
// pode conte-lo e' o codigo.
const codigo = times
  .split('\n')
  .filter((linha) => !/^\s*(\/\/|\*|\/\*)/.test(linha))
  .join('\n');

test('o fechamento e conferido pela tela, nunca por isConnected', () => {
  // `isConnected` e' a armadilha inteira: ele nao distingue janela fechada de janela aberta.
  assert.doesNotMatch(codigo, /isConnected/);
  assert.match(times, /const visivel = \(el\) =>.*getBoundingClientRect\(\)\.width > 0/s);
  assert.match(times, /await ate\(\(\) => !visivel\(janela\), \d+\)/);
});

test('fechar da um clique so, sem laco de tentativas', () => {
  // Um segundo clique e' justamente o que adoece o jogo. Se o primeiro nao fechou, insistir e' pior
  // do que falhar.
  const corpo = times.slice(times.indexOf('const fechar = async (janela)'));
  const fim = corpo.indexOf('\n    };');
  const fechar = corpo.slice(0, fim);
  assert.ok(fechar.length > 0, 'nao achei o corpo de `fechar`');
  assert.doesNotMatch(fechar, /for \(|while \(|tentativa/);
  assert.equal(fechar.match(/clicar\(/g)?.length, 1, 'mais de um clique em `fechar`');
});

test('a troca inteira e espacada entre 20 e 30 s', () => {
  // Pedido do usuario, e pela mesma razao tecnica: foi a rajada sem respiro que derrubou a pagina.
  assert.match(times, /const ALVO_MINIMO = 20000;/);
  assert.match(times, /const ALVO_MAXIMO = 30000;/);
  // O orcamento e' sorteado a cada uso, nao fixo: duas trocas iguais nao duram o mesmo.
  assert.match(times, /fimPrevisto = Date\.now\(\) \+ sorteio\(ALVO_MINIMO, ALVO_MAXIMO\)/);
  // E o espacamento sai do que resta dividido pelos passos que faltam, nao de um numero cravado.
  assert.match(times, /const justo = resta \/ Math\.max\(1, passosQueFaltam\)/);
  assert.match(times, /await respirar\(passos\.length\)/);
});

test('equipar e desequipar sao acoes escritas, nunca um duplo clique que alterna', () => {
  // Dois defeitos no mesmo lugar. No Ditto o duplo clique abre o menu de transformacao e nao
  // equipa — relatado pelo usuario, e invisivel no levantamento porque a conta nao tinha Ditto.
  // E o duplo clique **alterna**: nao existe "poe" nem "tira", existe "inverte", entao uma leitura
  // errada do estado custava o passo contrario. Foi assim que um Ivysaur saiu da equipe.
  assert.doesNotMatch(codigo, /duploClique|dblclick/);
  assert.match(codigo, /const botaoDireito = \(el\)/);
  assert.match(codigo, /new MouseEvent\('contextmenu', base\)/);
  // A acao pedida e' explicita: pedir "equipar" nao pode tirar ninguem.
  assert.match(codigo, /entrar \? '\.pokemon-card__action\.is-equip' : '\.pokemon-card__action\.is-unequip'/);
  // Sem a acao no cartao, nada acontece e o erro diz o que havia ali.
  assert.match(codigo, /if \(!acao\) \{/);
});

test('so um cartao por vez, porque o cartao nao diz de quem e', () => {
  // O cartao traz `data-element`, nunca o `data-creature-id`. Com dois na tela nao ha' como saber
  // em qual se clica — e com dois Tyranitar na conta o erro seria invisivel.
  assert.match(codigo, /const CARTAO = 'aside\.pokemon-card--pinned'/);
  assert.match(codigo, /const fecharCartoes = async \(\)/);
  assert.match(codigo, /document\.querySelectorAll\(CARTAO\)\.length === 1/);
});

test('o inventario e levado para a aba dos Pokemon antes de ser lido', () => {
  // A mochila reabre na ultima categoria usada. Deixada em "Boosters", nao tem uma celula de
  // Pokemon — e a ferramenta dizia que o time guardado tinha sumido da mochila.
  assert.match(codigo, /const abaDePokemon = async \(janela\)/);
  assert.match(codigo, /alvoComTexto\(janela, 'Pokémon'\) \|\| alvoComTexto\(janela, 'Todos'\)/);
  assert.match(codigo, /if \(!\(await abaDePokemon\(janela\)\)\) return false;/);
  // E a janela ja' aberta nao e' reaberta: o botao da barra alterna, e um clique ali a fecharia.
  assert.match(codigo, /if \(!visivel\(janela\)\) \{/);
});

test('a contagem sai do mesmo orcamento que espaca os passos, e nunca mostra negativo', () => {
  // Se a tela tivesse um prazo proprio, ela mostraria um numero que nada no codigo persegue.
  assert.match(codigo, /const falta = fimPrevisto - Date\.now\(\);/);
  // O jogo pode passar do orcamento: as pausas sao nossas, os ~1,2 s por troca nao.
  assert.match(codigo, /falta > 0 \? .+ : 'terminando…'/);
  // Zerado ao comecar, senao a primeira pintura mostra o prazo da troca anterior.
  assert.match(codigo, /const comecarRelogio = \(\) => \{\s*\n[^}]*fimPrevisto = 0;/);
  // E parado no `finally`, inclusive quando a troca falhou no meio.
  assert.match(codigo, /pararRelogio\(\);/);
  assert.match(codigo, /clearInterval\(relogio\)/);
});

test('o relogio para antes de a tela anunciar o fim', () => {
  // A limpeza final leva ate' um segundo (`fecharMenus`). Com o `pararRelogio` so' no `finally`, a
  // tela dizia "Pronto" com a barra correndo e "faltam ~1 s" ao lado: duas afirmacoes contrarias.
  const corpo = times.slice(times.indexOf('const resultado = await aplicar(time'));
  const anuncio = corpo.indexOf('celebrar(');
  const parada = corpo.indexOf('pararRelogio()');
  assert.ok(parada >= 0 && parada < anuncio, 'o relogio para depois de anunciar o fim');
});

test('o modo compacto some com o que nao e nome nem Usar, e e lembrado', () => {
  assert.match(codigo, /#lioncode-times\.compacto \.salvar,/);
  assert.match(codigo, /#lioncode-times\.compacto li small,/);
  assert.match(codigo, /#lioncode-times\.compacto li \[data-apagar\],/);
  // Regravar e esquecer sao os dois botoes de administrar a lista: os dois somem no compacto.
  assert.match(codigo, /#lioncode-times\.compacto li \[data-atualizar\] \{ display: none; \}/);
  // O tamanho proprio do modo compacto esta' no teste do retrair, logo abaixo.
  assert.match(codigo, /gravar\(CHAVE_COMPACTO, compacto\)/);
});

test('retrair encolhe o painel, e cada modo guarda o seu tamanho', () => {
  // Retrair tem de deixar o painel menor, nao so' tirar o que estava escrito nele: a largura e a
  // altura do modo cheio sobrariam em volta de uma lista de tres linhas curtas.
  assert.match(codigo, /#lioncode-times\.compacto \{ width: \d+px; height: auto;/);
  // Dois painEis diferentes, dois tamanhos. Um so' serviria mal aos dois, e alternar ficaria preso
  // ao maior. Medido na banca: 260x320 no cheio, 186x207 no compacto.
  assert.match(codigo, /const modoAtual = \(\) => \(compacto \? 'compacto' : 'cheio'\)/);
  assert.match(codigo, /const tam = tamanhos\(\)\[modoAtual\(\)\]/);
  assert.match(codigo, /\[modoAtual\(\)\]: \{/);
  // O estilo em linha do outro modo e' limpo antes, senao ele vence as regras da folha.
  assert.match(codigo, /painel\.style\.width = '';\s*\n\s*painel\.style\.height = '';/);
  // E o formato antigo, de quando so' havia um modo, continua valendo como o tamanho do cheio.
  assert.match(codigo, /if \(bruto\.largura \|\| bruto\.altura\) return \{ cheio: bruto \};/);
});

test('a barra do relogio respeita o atributo hidden', () => {
  // `display: flex` vence o `display: none` que o navegador da' a `[hidden]`: sem esta regra a
  // barra fica na tela o tempo todo, parada em 0%, como se houvesse uma troca em curso.
  assert.match(codigo, /#lioncode-times \.restante\[hidden\] \{ display: none; \}/);
});

test('aplicarModo so e chamado depois de recolocar existir', () => {
  // `const` nao sobe. Chamado junto do botao que o alterna, `aplicarModo` estourava
  // "Cannot access 'recolocar' before initialization" e derrubava o resto do modulo — o painel
  // subia sem lista nenhuma. `no-undef` nao ve este caso, porque o nome existe.
  assert.ok(
    codigo.indexOf('const recolocar = () => {') < codigo.lastIndexOf('aplicarModo();'),
    'aplicarModo() e chamado antes de `recolocar` ser inicializado',
  );
});

test('encolher a janela nao apaga o tamanho que o usuario escolheu', () => {
  // O caminho do defeito: a janela encolhe, `redimensionar` encaixa o painel no teto da tela nova,
  // essa mudanca acorda o `ResizeObserver`, e ele grava o tamanho limitado por cima do escolhido.
  // Ao voltar para a tela grande o painel fica pequeno para sempre, e nenhuma peca parece errada.
  assert.match(codigo, /let ultimoAplicado = null;/);
  assert.match(codigo, /ultimoAplicado = \{ largura: Math\.round\(caixa\.width\)/);
  // O observador compara antes de gravar, e desiste quando a mudanca foi do proprio codigo.
  const obs = codigo.slice(codigo.indexOf('marca = setTimeout('));
  const guarda = obs.indexOf('ultimoAplicado &&');
  const grava = obs.indexOf('gravar(CHAVE_TAM');
  assert.ok(guarda >= 0 && guarda < grava, 'a guarda vem depois da gravacao, ou nao existe');
});

test('a janela que encolhe mantem o painel dentro da tela', () => {
  // O teto e' da tela de agora, nao do tamanho guardado: 92% da largura e 88% da altura.
  assert.match(codigo, /Math\.min\(largura, Math\.round\(innerWidth \* 0\.92\)\)/);
  assert.match(codigo, /Math\.min\(altura, Math\.round\(innerHeight \* 0\.88\)\)/);
  // E e' refeito a cada mudanca de janela, senao o painel so' se ajustaria na proxima carga.
  assert.match(codigo, /addEventListener\('resize', recolocar\)/);
});

test('a medicao que originou tudo isto continua escrita nas duas extensoes de origem', () => {
  // Se este comentario desaparecer de la', a proxima ferramenta do pacote repete o erro — foi
  // exatamente o que aconteceu com `times.js`.
  for (const arquivo of ['venda-rapida.js', 'loja-rapida.js'])
    assert.match(
      ler(arquivo),
      /Nao foi possivel abrir esta janela/,
      `${arquivo} perdeu a medicao sobre o X de janela ja' fechada`,
    );
});

test('um time guardado pode ser regravado sem sair do lugar na lista', () => {
  // "Eu quero poder editar um time já existente." Regravar não é guardar outro: o time regravado
  // fica onde estava, em vez de saltar para o fim como se fosse novo.
  assert.match(codigo, /async function salvarAtual\(nomeForcado\)/);
  assert.match(codigo, /const onde = guardados\.findIndex\(\(t\) => t\.nome === nome\)/);
  assert.match(codigo, /if \(onde >= 0\) guardados\[onde\] = time;/);
  // E é em dois cliques: uma gravação por cima apaga um time inteiro, não pode sair de um toque.
  assert.match(codigo, /atualizar\.textContent = '\?';/);
  assert.match(codigo, /Clique no \? outra vez para regravar/);
});

test('renomear avisa o ginasio, que guarda os times pelo nome', () => {
  assert.match(codigo, /const renomear = \(elemento, velho\) =>/);
  // Enter grava, Escape desiste, e sair da caixa grava também.
  assert.match(codigo, /if \(e\.key === 'Enter'\)/);
  assert.match(codigo, /else if \(e\.key === 'Escape'\)/);
  assert.match(codigo, /caixa\.addEventListener\('blur', gravarNome\)/);
  // Dois times com o mesmo nome seriam indistinguíveis — e o "usar" pegaria o primeiro.
  assert.match(codigo, /if \(times\(\)\.some\(\(t\) => t\.nome === novo\)\)/);
  // O Ginásio guarda as escolhas pelo nome: sem este aviso, renomear partia a escolha dele em
  // silêncio, e só se descobriria no meio de uma corrida.
  assert.match(codigo, /globalThis\.PPX\?\.gym\?\.timeRenomeado\?\.\(velho, novo\)/);
  const gym = ler('gym.js');
  assert.match(gym, /timeRenomeado: \(velho, novo\) =>/);
  // As duas regioes, e nao so' a que esta' a' vista: o mesmo time pode estar escolhido nas duas.
  assert.match(gym, /const trocar = \(nome\) => \(nome === velho \? novo : nome\)/);
  assert.match(gym, /timeGym: trocar\(guardado\.porRegiao\[r\]\.timeGym\)/);
  assert.match(gym, /timeVolta: trocar\(guardado\.porRegiao\[r\]\.timeVolta\)/);
});
