// Teste de mesa do arquivo de configuração: o que é empacotado, e o que é recusado na entrada.
//
// `config.js` é um content script, mas o miolo dele — montar o pacote e ler o que chega — é puro,
// e é esse miolo que decide se uma configuração entra ou não. É aqui que se prova a recusa que
// mais importa: um arquivo da compra não pode ser aplicado na venda. São duas configurações com
// campos parecidos e significados diferentes, e aplicar uma na outra passaria calado — só
// apareceria no dia em que a automação agisse na hora errada.
//
// A segunda metade do arquivo olha para o código das duas ferramentas, e não para o `config.js`:
// o que entra no pacote é escolha de cada uma, e a escolha de deixar de fora o retrato do jogo
// (catálogo, estoque, saldo, contagem) e o carimbo da última rodada não vive em lugar nenhum
// senão ali.
//
// Rode com: node --test testes/*.test.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const fonte = readFileSync(new URL('../config.js', import.meta.url), 'utf8');
const caixa = { exports: {} };
new Function('module', fonte)(caixa);
const config = caixa.exports;

const ler = (nome) => readFileSync(new URL(`../${nome}`, import.meta.url), 'utf8');
/** O corpo de uma propriedade do objeto passado a `montarBotoes`, do nome dela até o próximo. */
const trecho = (codigo, de, ate) =>
  codigo.slice(codigo.indexOf(de), codigo.indexOf(ate, codigo.indexOf(de)));

test('o que foi exportado volta inteiro', () => {
  const dados = { teto: 7, raridades: ['Fraca', 'Comum'], automatico: { modo: 'horarios' } };
  const texto = JSON.stringify(config.montarPacote('venda-rapida', 'Venda rápida', dados));
  const lido = config.lerPacote(texto, 'venda-rapida');
  assert.ok(lido.ok);
  assert.deepEqual(lido.dados, dados);
});

test('um arquivo da compra nao entra na venda, e diz de qual ferramenta e', () => {
  const texto = JSON.stringify(config.montarPacote('loja-rapida', 'Loja rápida', { alvos: {} }));
  const lido = config.lerPacote(texto, 'venda-rapida');
  assert.equal(lido.ok, false);
  // O nome na frase não é enfeite: "arquivo errado" manda procurar no escuro.
  assert.match(lido.erro, /Loja rápida/);
});

test('o que nao e' + ' uma configuracao desta extensao e recusado', () => {
  const casos = [
    ['', 'texto vazio'],
    ['isto não é json', 'texto solto'],
    ['[]', 'uma lista'],
    ['null', 'nada'],
    [JSON.stringify({ pacote: 'outro-programa', ferramenta: 'venda-rapida', dados: {} }), 'outro programa'],
    [JSON.stringify(config.montarPacote('venda-rapida', 'Venda rápida', null)), 'dados vazios'],
    [JSON.stringify(config.montarPacote('venda-rapida', 'Venda rápida', [1, 2])), 'dados em lista'],
  ];
  for (const [texto, porque] of casos) {
    const lido = config.lerPacote(texto, 'venda-rapida');
    assert.equal(lido.ok, false, `${porque} devia ser recusado`);
    assert.ok(lido.erro, `${porque} tem de explicar o motivo`);
  }
});

test('o nome do arquivo leva a data, para nao haver dois iguais sem se saber qual e qual', () => {
  assert.equal(
    config.nomeDoArquivo('venda-rapida', new Date(2026, 9, 6)),
    'venda-rapida-config-2026-10-06.json',
  );
});

test('o carimbo da ultima rodada nao viaja com a configuracao', () => {
  // Importar o `ultima` de outra conta faria a janela de hoje passar por já usada, e a rodada de
  // hoje simplesmente não aconteceria — sem erro nenhum na tela.
  for (const arquivo of ['venda-rapida.js', 'loja-rapida.js']) {
    const codigo = ler(arquivo);
    const coletar = trecho(codigo, 'coletar: () => {', 'aplicar: (dados)');
    assert.match(
      coletar,
      /const \{ ultima, \.\.\.automatico \} = configAuto\(\);/,
      `${arquivo} tem de deixar o carimbo de fora do pacote`,
    );
    const aplicar = trecho(codigo, 'aplicar: (dados)', 'avisar: (frase)');
    assert.match(aplicar, /\.\.\.ler\(CHAVE_AUTO/, `${arquivo} tem de manter o carimbo local`);
  }
});

test('o retrato do jogo fica nesta conta: so a escolha da pessoa viaja', () => {
  // Catálogo, estoque, saldo e a contagem da última lista são o que a extensão descobriu **nesta**
  // conta. Levá-los para outra seria mostrar lá números que não são de lá.
  const casos = [
    ['venda-rapida.js', ['CHAVE_LISTA'], ['CHAVE_CONFIRMA', 'CHAVE_ITENS']],
    [
      'loja-rapida.js',
      ['CHAVE_CATALOGO', 'CHAVE_ESTOQUE', 'CHAVE_SALDO'],
      ['CHAVE_QTD', 'CHAVE_CONFIRMA'],
    ],
  ];
  for (const [arquivo, foraDoPacote, dentro] of casos) {
    const coletar = trecho(ler(arquivo), 'coletar: () => {', 'aplicar: (dados)');
    for (const chave of foraDoPacote)
      assert.doesNotMatch(coletar, new RegExp(chave), `${arquivo} não exporta ${chave}`);
    for (const chave of dentro)
      assert.match(coletar, new RegExp(chave), `${arquivo} exporta ${chave}`);
  }
});

test('nao se importa configuracao no meio de uma rodada', () => {
  // Trocar o teto, o lote ou os alvos com a automação já a correr por eles seria mudar as regras
  // no meio do jogo — e a venda não tem desfazer.
  const casos = [
    ['venda-rapida.js', /if \(emVenda\) throw new Error/],
    ['loja-rapida.js', /if \(emCompra \|\| comprandoTudo\)\s*\n?\s*throw new Error/],
  ];
  for (const [arquivo, espera] of casos)
    assert.match(trecho(ler(arquivo), 'aplicar: (dados)', 'avisar: (frase)'), espera, arquivo);
});

test('o que chega de fora e lido como se viesse de fora', () => {
  // Um arquivo editado à mão não pode virar um teto de "abc", uma raridade que esta extensão não
  // vende, nem um alvo negativo.
  const venda = trecho(ler('venda-rapida.js'), 'aplicar: (dados)', 'avisar: (frase)');
  assert.match(venda, /TRAVADAS\.has\(n\)/, 'as raridades travadas não entram por arquivo');
  assert.match(venda, /entre\(dados\.teto, 1, 9999/, 'o teto é limitado na entrada');
  assert.match(venda, /entre\(dados\.lote, 1, 500/, 'o lote é limitado na entrada');
  const loja = trecho(ler('loja-rapida.js'), 'aplicar: (dados)', 'avisar: (frase)');
  assert.match(loja, /Number\.isFinite\(alvo\) && alvo >= 0/, 'alvo tem de ser número não negativo');
});
