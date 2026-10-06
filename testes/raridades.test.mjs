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
  const campos = ponte.slice(ponte.indexOf('const reduzir'), ponte.indexOf('};', ponte.indexOf('const reduzir')));
  for (const proibido of ['trainer_id', 'capture_signature', 'captured_by', 'ivs', 'moves'])
    assert.doesNotMatch(campos, new RegExp(proibido), `${proibido} nao atravessa`);
  assert.match(campos, /quality_multiplier/);
  assert.match(campos, /species_name/);
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
  assert.match(painel, /de === null \|\| c\.raridade >= de/);
  assert.match(painel, /ate === null \|\| c\.raridade <= ate/);
});

test('uma lista cortada e denunciada em vez de parecer completa', () => {
  // `next_cursor` veio vazio com 117. Se um dia vier preenchido, o que esta' na tela e' uma parte.
  assert.match(ponte, /parcial: Boolean\(resto\)/);
  assert.match(painel, /a lista está incompleta/);
});

test('a ferramenta esta no catalogo e com atalho proprio', () => {
  const nucleo = ler('nucleo.js');
  assert.match(nucleo, /\{ id: 'raridades', nome: 'Raridades', atalhos: 'Alt\+A esconde · Alt\+S mostra' \}/);
  // O atalho nao pode colidir com os que ja' existem.
  for (const tecla of ['KeyA', 'KeyS'])
    for (const outro of ['times.js', 'gym.js', 'cacadas.js', 'layout-padrao.js', 'loja-rapida.js', 'venda-rapida.js'])
      assert.doesNotMatch(ler(outro), new RegExp(`code === '${tecla}'`), `${tecla} livre em ${outro}`);
});
