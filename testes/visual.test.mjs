// O visual dos painéis, prendido num sítio só.
//
// Os valores estavam escritos à mão em doze ficheiros e tinham derivado em duas famílias quase
// iguais — fundo #10151e contra #11161f, borda #2a3240 contra #2a3244, cantos 12 contra 10 px,
// letra 12 contra 13 px. Perto demais para parecer escolha, longe demais para passar
// despercebido: lê-se como engano. E só quatro dos doze tinham tecto de altura, por isso os
// outros oito podiam crescer para fora da tela — medido em 30/10/2026, o Ginásio chegou a
// 1185 px numa tela de 785, com o campo do reset e o botão de parar inalcançáveis.
//
// Esta banca existe para a próxima pessoa não voltar a escrever um hex no sítio errado.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ler = (nome) => readFileSync(new URL(`../${nome}`, import.meta.url), 'utf8');

/** Um painel por ficheiro, com a id que ele usa na página. */
const PAINEIS = [
  ['arena.js', 'lioncode-arena'],
  ['cacadas.js', 'lioncode-cacadas'],
  ['escada.js', 'lioncode-escada'],
  ['eventos.js', 'lioncode-eventos'],
  ['gym.js', 'lioncode-gym'],
  ['ilhas.js', 'lioncode-ilhas'],
  ['layout-padrao.js', 'lioncode-layout-padrao'],
  ['loja-rapida.js', 'lioncode-loja-rapida'],
  ['rampage.js', 'lioncode-rampage'],
  ['raridades.js', 'lioncode-raridades'],
  ['times.js', 'lioncode-times'],
  ['venda-rapida.js', 'lioncode-venda-rapida'],
];

/** A regra de raiz do painel: do `#id {` até ao `}` que a fecha. */
function regraDaRaiz(fonte, id) {
  const abre = fonte.indexOf(`#${id} {`) >= 0 ? fonte.indexOf(`#${id} {`) : fonte.indexOf(`#${id}{`);
  assert.ok(abre >= 0, `não achei a regra de raiz de #${id}`);
  const corpo = fonte.slice(abre);
  return corpo.slice(0, corpo.indexOf('}'));
}

test('o nucleo publica os valores partilhados, e no documento', () => {
  const nucleo = ler('nucleo.js');
  for (const v of ['--ppx-fundo', '--ppx-texto', '--ppx-borda', '--ppx-raio', '--ppx-fonte', '--ppx-sombra', '--ppx-teto'])
    assert.ok(nucleo.includes(v), `falta ${v}`);
  // No documento, e não no shadow root do menu: o menu é fechado e os painéis vivem na página,
  // por isso uma regra lá dentro nunca chegaria a eles.
  const bloco = nucleo.slice(nucleo.indexOf('const porValores'));
  assert.match(bloco.slice(0, bloco.indexOf('};')), /document\.head \|\| document\.documentElement/);
});

for (const [ficheiro, id] of PAINEIS) {
  test(`${id} usa os valores partilhados e tem tecto`, () => {
    const raiz = regraDaRaiz(ler(ficheiro), id);
    for (const [prop, valor] of [
      ['background', '--ppx-fundo'],
      ['color', '--ppx-texto'],
      ['border', '--ppx-borda'],
      ['border-radius', '--ppx-raio'],

      ['box-shadow', '--ppx-sombra'],
    ])
      assert.ok(
        raiz.includes(`var(${valor})`) && new RegExp(prop + ':').test(raiz),
        `${id}: ${prop} nao usa ${valor}`,
      );
    // A letra vale pelas duas: a normal e a densa. Densidade e' uma escolha — os paineis com
    // listas e tabelas sao apertados de proposito —, e o que nao pode e' ser um numero escrito a
    // mao, que e' como a deriva recomeca.
    // Sem espacos: tres dos paineis trazem o CSS minificado numa linha so'.
    const juntas = raiz.replace(/\s+/g, '');
    assert.ok(
      juntas.includes('font:var(--ppx-fonte)') || juntas.includes('font:var(--ppx-fonte-densa)'),
      `${id}: a letra nao vem dos valores partilhados`,
    );
    // Nenhum painel pode crescer para fora da tela, e o que transborda tem de rolar.
    assert.match(raiz, /max-height:\s*var\(--ppx-teto\)/, `${id} não tem tecto de altura`);
    // Duas formas de nao transbordar, e as duas valem. A raiz a rolar e' a mais simples; a
    // coluna com o corpo a rolar e' melhor, porque prende o cabecalho — quem rola o painel
    // inteiro perde de vista o botao de fechar. O que nao vale e' nenhuma das duas.
    const raizRola = /overflow(-y)?:\s*auto/.test(raiz);
    const fonte = ler(ficheiro);
    const abreCorpo = fonte.indexOf('#' + id + ' .corpo {');
    const corpoRola =
      raiz.includes('flex-direction: column') &&
      abreCorpo >= 0 &&
      fonte.slice(abreCorpo, fonte.indexOf('}', abreCorpo)).includes('overflow-y: auto');
    assert.ok(raizRola || corpoRola, `${id} transborda sem rolar`);
  });
}

test('nenhuma raiz de painel volta a escrever os valores a mao', () => {
  // As duas famílias antigas, pelos hexes que as separavam. Um deles de volta numa raiz quer
  // dizer que a deriva recomeçou.
  for (const [ficheiro, id] of PAINEIS) {
    const raiz = regraDaRaiz(ler(ficheiro), id);
    for (const hex of ['#10151e', '#11161f', '#e6e9ef', '#e7edf6', '#2a3240', '#2a3244'])
      assert.doesNotMatch(raiz, new RegExp(hex), `${id} voltou a escrever ${hex} à mão`);
  }
});
