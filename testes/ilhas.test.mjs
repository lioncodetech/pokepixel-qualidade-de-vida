import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const ler = (nome) => readFileSync(new URL(`../${nome}`, import.meta.url), 'utf8');
const codigo = ler('ilhas.js');

test('o modulo esta no pacote e no menu', () => {
  assert.match(ler('manifest.json'), /"ilhas\.js"/);
  assert.match(ler('nucleo.js'), /id: 'ilhas', nome: 'Ilhas Lendárias'/);
  assert.match(codigo, /id: 'ilhas', nome: 'Ilhas Lendárias'/);
});

test('a abertura vem do locked real do jogo e e relida', () => {
  assert.match(ler('cacadas-main.js'), /trancado: mundo\.trancado === true/);
  assert.match(ler('cacadas.js'), /atualizar: relerCatalogo/);
  assert.match(codigo, /PPX\?\.cacadas\?\.atualizar\?\.\(\)/);
  assert.match(codigo, /filter\(\(c\) => c\.trancada !== true\)/);
  assert.match(codigo, /const INTERVALO = 2 \* 60 \* 1000/);
});

test('da para ligar desligar pausar e retomar', () => {
  assert.match(codigo, /cfg\.ligada = !cfg\.ligada/);
  assert.match(codigo, /cfg\.pausada = !cfg\.pausada/);
  assert.match(codigo, /cfg\.pausada \? 'Retomar' : 'Pausar'/);
  assert.match(codigo, /if \(!cfg\.ligada \|\| cfg\.pausada\) return/);
});

test('o painel pode ser movido e os campos nao escapam da caixa', () => {
  assert.match(codigo, /const CHAVE_POS = 'lioncode:ilhas:posicao'/);
  assert.match(codigo, /header'\)\.addEventListener\('pointerdown'/);
  assert.match(codigo, /addEventListener\('pointermove'/);
  assert.match(codigo, /canto\?\.medir\(painel\)/);
  assert.match(codigo, /grid-template-columns:46px minmax\(0,1fr\)/);
  assert.match(codigo, /max-width:100%;text-overflow:ellipsis/);
});

test('guarda origem usa o time escolhido e volta quando fecha', () => {
  assert.match(codigo, /sessao = \{ cacada: aqui\?\.tipo === 'cacada' \? aqui\.nome : '', time:/);
  assert.match(codigo, /await montar\(cfg\.time\)/);
  assert.match(codigo, /cacadas\?\.ir\?\.\(alvo\.nome\)/);
  assert.match(codigo, /else if \(sessao\) await voltar\(\)/);
  assert.match(codigo, /await montar\(destino\.time\)/);
  assert.match(codigo, /cacadas\?\.ir\?\.\(destino\.cacada\)/);
});

test('a automacao pede a vez e nao atropela time de atalho', () => {
  assert.match(codigo, /vez\.pedir\(MINHA_VEZ\)/);
  assert.match(codigo, /const timeDaCacada = globalThis\.PPX\?\.cacadas\?\.timeDe/);
  assert.match(codigo, /timeDaCacada && timeDaCacada !== cfg\.time/);
});
