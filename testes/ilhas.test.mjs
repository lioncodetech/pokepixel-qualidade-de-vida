import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Lido sem os \r: a arvore de trabalho do Windows vem em CRLF e a da CI em LF, e um guarda que
// casa duas linhas seguidas da' fonte so' falhava de um dos lados. Oito deles, em 26/10/2026.
const ler = (nome) =>
  readFileSync(new URL(`../${nome}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
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

test('ilhas cedem prioridade a qualquer outra automacao e retomam ao fim', () => {
  assert.match(codigo, /const outraAutomacao = \(\) =>/);
  assert.match(codigo, /vez\?\.dono\?\.\(\)/);
  assert.match(codigo, /vez\?\.esperando\?\.\(\)/);
  const espera = codigo.slice(codigo.indexOf('const esperarAVez = async'), codigo.indexOf('const ate = async'));
  assert.ok(espera.indexOf('outraAutomacao()') < espera.indexOf('vez.pedir(MINHA_VEZ)'));
  assert.match(codigo, /Ilhas pausadas para .* Retomo quando terminar/);
  assert.match(codigo, /vez\?\.aoMudar\?\.\(\(\) =>/);
  assert.match(codigo, /setTimeout\(\(\) => void verificar\(\), 1000\)/);
});

test('as ilhas suspendem a escada e liberam depois da volta', () => {
  assert.match(codigo, /PPX\?\.escada\?\.suspender\?\.\(MINHA_VEZ\)/);
  assert.match(codigo, /PPX\?\.escada\?\.liberar\?\.\(MINHA_VEZ\)/);
  const entrada = codigo.slice(codigo.indexOf('const entrar = async'), codigo.indexOf('const voltar = async'));
  assert.match(entrada, /suspenderEscada\(\)/);
  const volta = codigo.slice(codigo.indexOf('const voltar = async'), codigo.indexOf('const verificar = async'));
  assert.match(volta, /liberarEscada\(\)/);
  assert.match(ler('escada.js'), /const suspensoesExternas = new Set\(\)/);
  assert.match(ler('escada.js'), /suspender: \(dono\) =>/);
  assert.match(ler('escada.js'), /liberar: \(dono\) =>/);
});

test('o botao da escada espelha a suspensao temporaria das ilhas', () => {
  const escada = ler('escada.js');
  assert.match(escada, /const suspensa = suspensoesExternas\.size > 0/);
  assert.match(escada, /cfg\.pausada \|\| suspensa \? 'Retomar' : 'Pausar'/);
  assert.match(escada, /pausar\.disabled = !cfg\.ligada \|\| suspensa/);
  assert.match(escada, /será retomada automaticamente/);
  assert.match(escada, /desenhar\(false\);\s*if \(!suspensoesExternas\.size && cfg\.ligada/);
});

test('as ilhas nunca tiram o jogador da expedicao', () => {
  assert.match(codigo, /const naExpedicao = \(\) => atual\(\)\?\.tipo === 'expedicao'/);
  const entrada = codigo.slice(codigo.indexOf('const entrar = async'), codigo.indexOf('const voltar = async'));
  const volta = codigo.slice(codigo.indexOf('const voltar = async'), codigo.indexOf('const verificar = async'));
  const inicioVerificacao = codigo.indexOf('const verificar = async');
  const verificacao = codigo.slice(inicioVerificacao, codigo.indexOf("campo('[data-ligar]')", inicioVerificacao));
  assert.ok(entrada.indexOf('naExpedicao()') < entrada.indexOf('irCidade()'));
  assert.ok(volta.indexOf('naExpedicao()') < volta.indexOf('irCidade()'));
  assert.ok(verificacao.indexOf('naExpedicao()') < verificacao.indexOf('cacadas?.atualizar'));
  assert.match(codigo, /Você está na expedição — as Ilhas esperam ela terminar/);
});
