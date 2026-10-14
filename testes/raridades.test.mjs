// Guardas da decima ferramenta: a lista de raridades.
//
// O caminho ate' os dados foi medido na conta real em 06/10/2026 e esta' provado na banca
// (`testes/banca-raridades.html`), que monta um `PokeIdle` de mentira com a forma exata do de
// verdade. O que se protege aqui sao as decisoes que, desfeitas, quebram a ferramenta em silencio.
//
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const ler = (arquivo) => readFileSync(new URL(`../${arquivo}`, import.meta.url), 'utf8');
const semComentarios = (fonte) =>
  fonte
    .split('\n')
    .filter((linha) => !/^\s*(\/\/|\*|\/\*)/.test(linha))
    .join('\n');
const painel = semComentarios(ler('raridades.js'));
const ponte = semComentarios(ler('raridades-main.js'));

test('a metade que fala com o jogo entra no mundo da pagina', () => {
  // `PokeIdle` vive no `globalThis` da pagina. Um content script comum nao o alcanca — e' por isso
  // que esta ferramenta tem duas metades, e nao uma.
  const manifest = JSON.parse(ler('manifest.json'));
  const mundoDaPagina = manifest.content_scripts.find((c) => c.world === 'MAIN');
  assert.ok(mundoDaPagina, 'existe um bloco com world MAIN');
  assert.ok(mundoDaPagina.js.includes('raridades-main.js'), 'a ponte entra nele');
  const isolado = manifest.content_scripts.find((c) => c.js.includes('gym.js'));
  assert.ok(isolado.js.includes('raridades.js'), 'o painel entra com as outras ferramentas');
  // E o painel nunca pode tentar falar com o jogo direto: dali `PokeIdle` e' sempre undefined.
  assert.doesNotMatch(painel, /PokeIdle/);
});

test('a lista vem de uma chamada so, sem abrir Pokemon nenhum', () => {
  // Na tela, a raridade so' aparece abrindo um Pokemon de cada vez: seriam 117 aberturas na conta
  // medida. `getCreatures` sem filtro devolve mochila, deposito e time de uma vez.
  assert.match(ponte, /getCreaturesFresh : api\?\.getCreatures/);
  assert.doesNotMatch(ponte, /click\(\)/);
  assert.doesNotMatch(painel, /click\(\)\s*;?\s*$/m);
});

test('so atravessa a ponte o que a lista usa', () => {
  // O registro do jogo traz id de treinador, assinatura de captura, zona e movimentos. Nada disso
  // tem por que cruzar para o outro mundo so' para ser descartado.
  const campos = ponte.slice(
    ponte.indexOf('const reduzir'),
    ponte.indexOf('};', ponte.indexOf('const reduzir')),
  );
  for (const proibido of ['trainer_id', 'capture_signature', 'captured_by', 'moveset', 'nature'])
    assert.doesNotMatch(campos, new RegExp(proibido), `${proibido} nao atravessa`);
  assert.match(campos, /quality_multiplier/);
  assert.match(campos, /species_name/);
  // Os IVs **passaram a atravessar** em 15/10/2026, quando o filtro deixou de ser so' de raridade:
  // sem eles nao ha' como responder "IV total acima de 140". Sao seis numeros, e nada ali
  // identifica ninguem.
  assert.match(campos, /ivs:/);
  assert.match(campos, /spa: Number\(c\?\.ivs\?\.spa\)/);
  // E o `id`, que e' o que liga cada linha ao slot da janela do jogo.
  assert.match(campos, /id: String\(c\?\.id \|\| ''\)/);
});

test('cada pedido tem o seu eco, e a espera acaba', () => {
  // Dois pedidos podem estar no ar — o automatico da abertura e um clique em atualizar. Sem o eco,
  // a resposta do primeiro passaria pela do segundo e a tela mostraria dados velhos calada.
  assert.match(painel, /if \(evento\?\.detail\?\.eco !== eco\) return;/);
  // E se a outra metade nao tiver entrado, ninguem responde nunca: um painel presto em "lendo…"
  // nao diz o que esta' errado.
  assert.match(painel, /const PACIENCIA = \d+;/);
  assert.match(painel, /o jogo não respondeu/);
});

test('as faixas sao perguntadas ao jogo, nao cravadas', () => {
  // Medidas na conta real: fraca 0,90-0,99 … lendaria 1,55-1,69. Cravar os numeros seria uma
  // mentira silenciosa no dia em que o jogo mexesse numa delas.
  assert.match(ponte, /qualityBand/);
  assert.doesNotMatch(painel, /1\.54|1,54/);
});

test('a lista sai do mais raro para o menos raro', () => {
  // O topo da lista e' o que interessa: e' para isso que se abre esta ferramenta.
  assert.match(painel, /\.sort\(\(a, b\) => b\.raridade - a\.raridade\)/);
});

test('o filtro aceita virgula, porque o jogo escreve com virgula', () => {
  // Ninguem digita `1.45` olhando para uma tela que diz `×1,45`.
  assert.match(painel, /\.replace\(',', '\.'\)/);
  // Campo vazio nao e' zero: e' "sem limite deste lado".
  // Campo vazio nao e zero: e "sem limite deste lado". A regra vale para **todas** as faixas desde
  // 15/10/2026 — raridade, nivel, IV total e IV de um atributo —, e por isso mora numa funcao so.
  assert.match(
    painel,
    /\(faixa\.de === null \|\| valor >= faixa\.de\) && \(faixa\.ate === null \|\| valor <= faixa\.ate\)/,
  );
});

test('uma lista cortada e denunciada em vez de parecer completa', () => {
  // `next_cursor` veio vazio com 117. Se um dia vier preenchido, o que esta' na tela e' uma parte.
  assert.match(ponte, /parcial: Boolean\(resto\)/);
  assert.match(painel, /a lista está incompleta/);
});

test('a ferramenta esta no catalogo e com atalho proprio', () => {
  const nucleo = ler('nucleo.js');
  assert.match(
    nucleo,
    /\{ id: 'raridades', nome: 'Raridades', atalhos: 'Alt\+A esconde · Alt\+S mostra' \}/,
  );
  // O atalho nao pode colidir com os que ja' existem.
  for (const tecla of ['KeyA', 'KeyS'])
    for (const outro of [
      'times.js',
      'gym.js',
      'cacadas.js',
      'layout-padrao.js',
      'loja-rapida.js',
      'venda-rapida.js',
    ])
      assert.doesNotMatch(
        ler(outro),
        new RegExp(`code === '${tecla}'`),
        `${tecla} livre em ${outro}`,
      );
});

// ------------------------------------------------------- o filtro, e o espelho dele no jogo

test('todos os criterios valem juntos, e nao somados', () => {
  // É `e`, e não `ou`. Quem escreve "nível 1 a 20" **e** "IV total acima de 140" está à procura de
  // um bicho novo que valha a pena guardar, e não de duas listas somadas: com `ou`, o filtro mais
  // largo apagaria o mais estreito e o resultado seria sempre pior do que não filtrar.
  const bloco = painel.slice(painel.indexOf('const passa = (c, f)'));
  const corpo = bloco.slice(0, bloco.indexOf('\n    };'));
  // Cada critério citado inteiro: `f.iv` sozinho também casava com `f.ivUm`, e a asserção passava
  // com o filtro do IV total apagado — foi uma mutação que sobreviveu, e é por isso que elas se
  // correm.
  for (const criterio of [
    '!dentro(c.raridade, f.raridade)',
    '!dentro(c.nivel, f.nivel)',
    '!dentro(somaDosIvs(c), f.iv)',
    'f.ivUm.qual && !dentro(',
    'c.onde !== f.onde',
    '!(c.elementos || []).includes(f.elemento)',
  ])
    assert.ok(corpo.includes(criterio), `${criterio} entra no filtro`);
  // Cada um recusa sozinho: seis `return false`, e nenhuma soma de pontos.
  assert.ok((corpo.match(/return false;/g) || []).length >= 6);
  // E o apelido conta na busca por nome: quem batizou o bicho procura-o pelo nome que lhe deu.
  assert.match(corpo, /c\.apelido/);
});

test('o IV filtra-se pelo total E por atributo, que sao duas perguntas', () => {
  // Pedido assim em 15/10/2026, com as palavras dele: "os dois". "Soma ≥ 140" decide se vale a pena
  // guardar; "spa ≥ 25" serve para um bicho específico, e uma coisa não responde a outra.
  assert.match(painel, /const ATRIBUTOS = \['hp', 'atk', 'def', 'spa', 'spd', 'spe'\]/);
  assert.match(painel, /const somaDosIvs = \(c\) =>/);
  assert.match(painel, /data-iv-de/);
  assert.match(painel, /data-iv-qual/);
  assert.match(
    painel,
    /if \(f\.ivUm\.qual && !dentro\(Number\(c\?\.ivs\?\.\[f\.ivUm\.qual\]\) \|\| 0, f\.ivUm\)\)/,
  );
  // A soma **não** vem feita da ponte: quem filtra por atributo precisa dos seis separados.
  assert.doesNotMatch(ponte, /ivTotal|soma/i);
  // E o IV aparece na linha da lista: um critério que não se vê no resultado obriga a abrir cada
  // bicho no jogo para conferir o que a lista já sabia.
  assert.match(painel, /`IV \$\{somaDosIvs\(c\)\}`/);
});

test('o filtro na janela do jogo e so no inventario, e por um motivo medido', () => {
  // Medido em 15/10/2026: cada slot da mochila é um `.inventory-slot` com `data-creature-id`. O
  // **depósito** não serve: a janela dele pagina (48 páginas na conta do dono) e quem pagina é o
  // jogo — esconder quadradinhos ali filtraria só a página à vista, e pareceria completo sem ser.
  assert.match(painel, /querySelectorAll\('\.inventory-slot\[data-creature-id\]'\)/);
  const bloco = painel.slice(painel.indexOf('const filtrarNoJogo'));
  const corpo = bloco.slice(0, bloco.indexOf('\n    };'));
  assert.doesNotMatch(corpo, /storage|deposito|depósito/i, 'o depósito não é filtrado no sítio');
  // Um slot que a lista não conhece fica visível: pode ser um Pokémon apanhado depois da última
  // leitura, e esconder o que não se conhece seria esconder por ignorância.
  assert.match(corpo, /const esconder = Boolean\(c\) && !passa\(c, f\)/);
});

test('o que se esconde no jogo sabe desesconder-se, por tres caminhos', () => {
  // Uma ferramenta que esconde coisas do jogo e não sabe desfazer é uma ferramenta que o dono vai
  // acusar de ter apagado os Pokémon dele. O estado anterior fica guardado no próprio slot.
  assert.match(painel, /const MARCA = 'data-lioncode-escondido';/);
  // E ela **repõe de facto**: varre quem está marcado e devolve o `display` guardado. Afirmar só
  // que a função existe deixava passar uma que não fazia nada — outra mutação sobrevivente.
  const repoe = painel.slice(painel.indexOf('const mostrarTudoNoJogo'));
  const corpoRepoe = repoe.slice(0, repoe.indexOf('\n    };'));
  assert.match(corpoRepoe, /querySelectorAll\(`\[\$\{MARCA\}\]`\)/);
  assert.match(
    corpoRepoe,
    /slot\.style\.display = slot\.getAttribute\(MARCA\) === 'vazio' \? '' : slot\.getAttribute\(MARCA\)/,
  );
  assert.match(corpoRepoe, /slot\.removeAttribute\(MARCA\)/);
  // 1. desligar a caixinha; 2. fechar o painel; 3. o slot deixar de passar a ser escondido.
  const filtra = painel.slice(painel.indexOf('const filtrarNoJogo'));
  assert.match(
    filtra.slice(0, 400),
    /if \(!campo\('\[data-no-jogo\]'\)\.checked\) \{\s*mostrarTudoNoJogo\(\);/,
  );
  const fecha = painel.slice(painel.indexOf("campo('[data-fechar]').addEventListener"));
  assert.match(fecha.slice(0, 400), /mostrarTudoNoJogo\(\);/);
  assert.match(filtra, /slot\.removeAttribute\(MARCA\)/);
});

test('o filtro no jogo sobrevive ao jogo redesenhar a janela', () => {
  // **Não é zelo.** A mochila é React: ela refaz os slots ao abrir, ao mudar de aba, ao vender, ao
  // capturar — e cada refazer devolve os elementos limpos. Sem isto o filtro valia até ao primeiro
  // clique do dono na janela e depois deixava de valer **sem dizer nada**.
  assert.match(painel, /new MutationObserver/);
  assert.match(painel, /olho\.observe\(document\.body, \{ childList: true, subtree: true \}\)/);
  // E com peneira: o jogo mexe no DOM muitas vezes por segundo.
  assert.match(painel, /if \(agendado \|\| !campo\('\[data-no-jogo\]'\)\.checked\) return;/);
});

test('um campo vazio nunca esconde ninguem', () => {
  // Tratar vazio como zero faria o "IV total até —" apagar a coleção inteira no instante em que o
  // painel abrisse. Vazio é uma pergunta que não se fez.
  assert.match(painel, /const dentro = \(valor, faixa\) =>/);
  assert.match(painel, /if \(!limpo\) return null;/);
  // E o "tudo" limpa todos os campos de uma vez, pela mesma lista — menos a caixinha do jogo, que
  // não é um critério e sim onde o resultado aparece.
  const limpar = painel.slice(painel.indexOf("campo('[data-limpar]').addEventListener"));
  const corpo = limpar.slice(0, limpar.indexOf('\n    });'));
  assert.match(corpo, /for \(const seletor of CAMPOS\)/);
  assert.match(corpo, /if \(el\.type === 'checkbox'\) continue;/);
});

test('os campos do filtro sao uma lista so, e nao doze copias', () => {
  // Guardar, limpar, repor e ouvir são a mesma operação sobre o mesmo conjunto. Quatro cópias
  // divergiriam no dia em que entrasse o décimo terceiro campo — tipicamente ficando **um** deles
  // por limpar, que é o defeito que ninguém reproduz.
  assert.match(painel, /const CAMPOS = \[/);
  for (const qual of [
    'data-nivel-de',
    'data-iv-ate',
    'data-iv-qual',
    'data-especie',
    'data-elemento',
    'data-onde',
  ])
    assert.ok(painel.includes(`'[${qual}]'`), `${qual} está na lista`);
  // E o formato antigo continua a ser lido: quem atualiza o pacote não perde a faixa de ontem.
  assert.match(painel, /guardada\.de !== undefined \|\| guardada\.ate !== undefined/);
});

test('as escolhas vem da colecao, e nao de uma lista cravada', () => {
  // Filtrar por um tipo que ninguém na mochila tem é uma opção que só pode dar lista vazia — e uma
  // opção que nunca serve é uma opção a mais para ler.
  const bloco = painel.slice(painel.indexOf('const encherEscolhas'));
  const corpo = bloco.slice(0, bloco.indexOf('\n    };'));
  assert.match(corpo, /colecao\.flatMap\(\(c\) => c\.elementos \|\| \[\]\)/);
  assert.match(corpo, /colecao\.map\(\(c\) => c\.especie\)/);
  // E o que estava escolhido sobrevive a uma releitura, se ainda existir.
  assert.match(corpo, /sel\.value = tipos\.includes\(antes\) \? antes : '';/);
});
