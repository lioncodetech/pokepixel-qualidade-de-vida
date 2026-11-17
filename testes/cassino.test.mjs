// Guardas da décima nona ferramenta: o Cassino.
//
// O que se protege aqui é dinheiro, e o desenho destes testes mudou depois de comprar de verdade
// na conta do dono, em 17/11/2026. Duas suposições caíram na medição:
//
//   - supus que COMPRAR NOVAMENTE cobrava na hora. **Não cobra**: devolve a tela de escolha com a
//     quantidade anterior posta, de graça. Metade da complexidade que eu tinha escrito para me
//     defender dele era desnecessária;
//   - não sabia que **o jogo pede confirmação**. Sem tratá-la, a ferramenta ficava parada à espera
//     de um sorteio que nunca vinha — foi o que aconteceu no primeiro teste real.
//
// A proteção do dinheiro mora agora onde o dinheiro sai: na caixa de confirmação.
//
// Rode com: node --test testes/*.test.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const ler = (arquivo) =>
  readFileSync(new URL(`../${arquivo}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const semComentarios = (texto) =>
  texto
    .split('\n')
    .filter((linha) => !/^\s*(\/\/|\*|\/\*)/.test(linha))
    .join('\n');

const codigo = semComentarios(ler('cassino.js'));

/** A conta que decide gastar, extraída e executada de verdade — não é uma cópia reescrita aqui. */
const corpo = /const planoDeCompra = [\s\S]*?\n    \};/.exec(codigo)?.[0];
assert.ok(corpo, 'não achei planoDeCompra para exercitar');
const planoDeCompra = new Function(`const LOTE = 10; ${corpo} return planoDeCompra;`)();

test('compra de dez em dez enquanto houver pedido e dinheiro', () => {
  assert.equal(planoDeCompra({ faltam: 30, saldo: 15_000_000, preco: 250_000 }).quantidade, 10);
});

test('o resto final é o resto, não mais um lote cheio', () => {
  // Pedir 25 são 10, 10 e 5. Comprar 10 na última rodada deixaria o dono com 30 Eevees e
  // 1.250.000 a menos do que pediu.
  assert.equal(planoDeCompra({ faltam: 5, saldo: 15_000_000, preco: 250_000 }).quantidade, 5);
});

test('o saldo limita a rodada antes de o jogo recusar', () => {
  // Com 600.000 cabem dois, não dez. Tentar dez para ver o que acontece seria usar o erro do jogo
  // como condição de parada, e um erro no meio de uma compra é ambíguo demais para isso.
  assert.equal(planoDeCompra({ faltam: 10, saldo: 600_000, preco: 250_000 }).quantidade, 2);
});

test('sem dinheiro para um único Eevee, para e diz por quê', () => {
  const p = planoDeCompra({ faltam: 10, saldo: 249_999, preco: 250_000 });
  assert.equal(p.quantidade, 0);
  assert.equal(p.motivo, 'sem-dinheiro');
});

test('preço não lido não vira compra às cegas', () => {
  // Sem preço não há como saber quantos cabem no saldo. Seguir assim seria clicar sem conta.
  const p = planoDeCompra({ faltam: 10, saldo: 15_000_000, preco: 0 });
  assert.equal(p.quantidade, 0);
  assert.equal(p.motivo, 'preco');
});

test('só se confirma a caixa que diz a quantidade que foi pedida', () => {
  // A caixa de confirmação é a última porta antes de o dinheiro sair. Uma que diga 10 quando se
  // pediu 5 significa que a tela mudou por baixo — confirmar ali seria assinar sem ler, e cada
  // unidade são 250.000.
  assert.match(codigo, /const diz = quantidadeNaCaixa\(caixa\);/);
  assert.match(codigo, /if \(diz !== quantidade\) \{\n\s*clicarNaCaixa\(caixa, 'Cancelar'\);/);
  // E a quantidade sai do texto da própria caixa, não de uma lembrança nossa.
  assert.match(codigo, /\/Comprar\\s\+\(\\d\+\)\\s\+Eevee\/i\.exec\(caixa\.textContent/);
});

test('sem confirmação na tela, nada é dado por comprado', () => {
  assert.match(codigo, /a confirmação do jogo não apareceu/);
  assert.match(codigo, /const feito = await confirmar\(plano\.quantidade\);/);
  assert.match(codigo, /if \(!feito\.ok\) \{\n\s*parei\(feito\.motivo\);\n\s*break;/);
});

test('para sair do sorteio usa COMPRAR NOVAMENTE, nunca o FECHAR', () => {
  // Medido: COMPRAR NOVAMENTE não cobra e devolve a tela de escolha; FECHAR leva o Cassino inteiro
  // embora, e só o NPC o traz de volta — com o personagem perto dele.
  assert.match(codigo, /const outra = botaoDoSorteio\('COMPRAR NOVAMENTE'\);/);
  assert.ok(!/botaoDoSorteio\('FECHAR'\)/.test(codigo), 'o FECHAR fecha o Cassino inteiro');
});

test('pede a vez antes de agir, como toda automação deste repositório', () => {
  assert.match(codigo, /const MINHA_VEZ = 'cassino'/);
  assert.match(codigo, /vez\.pedir\(MINHA_VEZ\)/);
  // E solta no `finally`: uma compra que falhe no meio não pode deixar a fila trancada.
  assert.match(codigo, /finally \{\n\s*if \(soltar\) soltar\(\);/);
});

test('nada é procurado por texto solto na página: a loja de diamantes mora no mesmo DOM', () => {
  // `premium-product__buy` também se chama "Comprar". Procurar botões por texto em `document`
  // acharia os dela, e cada clique ali gasta moeda paga.
  assert.ok(!/premium-product/.test(codigo), 'não pode conhecer a loja de diamantes');
  // `document.querySelectorAll('button')` aparece uma única vez, para achar o NPC do Cassino no
  // mapa — que é mesmo fora da janela. Qualquer varredura nova de botões na página inteira derruba
  // isto, e é para derrubar: é por aí que um clique chega à loja de diamantes.
  assert.equal(codigo.match(/document\.querySelectorAll\('button'\)/g)?.length, 1);
  assert.match(codigo, /const dentro = \(seletor\) => janela\(\)\?\.querySelector\(seletor\)/);
});

test('a máquina de apostas continua fora do alcance', () => {
  assert.ok(!/Usar m[áa]quina|slot|aposta[r]?\(/i.test(codigo));
});

test('a contagem vem do saldo gasto, não do otimismo', () => {
  // Um clique que não cobrou não é um Eevee. Contar cliques daria um relatório que não bate com a
  // mochila — e o primeiro teste real caiu exatamente aqui: a compra aconteceu, a ferramenta não a
  // viu, e disse "parei em 0" em vez de inventar.
  assert.match(codigo, /const gasto = antes - saldoAgora\(\);/);
  assert.match(codigo, /if \(gasto <= 0\)/);
  assert.match(codigo, /comprados \+= Math\.max\(1, Math\.round\(gasto \/ ultimoPreco\)\)/);
});

test('o preço lido é o de um Eevee, não o total da quantidade escolhida', () => {
  // Medido com 10 selecionados: "10x DE 250.000 dólares" ao lado de um total de 2.500.000. Usar o
  // total faria "quantos cabem no saldo" encolher dez vezes.
  assert.match(codigo, /\/x\\s\*DE\\s\*\(\[\\d\.,\]\+\)\/i/);
});

test('o seletor é mexido pelo setter nativo, senão o jogo não fica sabendo', () => {
  assert.match(codigo, /HTMLSelectElement\.prototype, 'value'\)\.set/);
  assert.match(codigo, /dispatchEvent\(new Event\('change', \{ bubbles: true \}\)\)/);
  // E confere que pegou: um seletor que recusou o valor compraria a quantidade antiga.
  assert.match(codigo, /return sel\.value === String\(quantos\)/);
});

test('a janela conta como aberta pelo tamanho, não pela presença no DOM', () => {
  // O jogo deixa janelas fechadas no DOM. Mesma lição da mochila, na Loja rápida.
  assert.match(codigo, /getBoundingClientRect\(\)\.width > 0 \? j : null/);
});

test('está no pacote e no menu, senão não existe para quem usa', () => {
  assert.match(ler('manifest.json'), /"cassino\.js"/);
  assert.match(ler('nucleo.js'), /\{ id: 'cassino', nome: 'Cassino'/);
});
