import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const ler = (nome) => readFileSync(new URL(`../${nome}`, import.meta.url), 'utf8');
const codigo = ler('rampage.js');
const ponte = ler('rampage-main.js');

test('Rampage entra no pacote e na fila compartilhada', () => {
  const manifest = JSON.parse(ler('manifest.json'));
  const isolado = manifest.content_scripts.find((b) => b.js.includes('arena.js'));
  const principal = manifest.content_scripts.find((b) => b.world === 'MAIN');
  assert.ok(isolado.js.includes('rampage.js'));
  assert.ok(principal.js.includes('rampage-main.js'));
  assert.match(ler('nucleo.js'), /id: 'rampage', nome: 'Rampage'/);
  assert.match(codigo, /const MINHA_VEZ = 'rampage';/);
  assert.match(codigo, /soltar = await esperarAVez\(dizer\);/);
  assert.match(codigo, /if \(soltar\) soltar\(\);/);
});

test('estado e disponibilidade vêm da API do jogo', () => {
  assert.match(ponte, /getRampage\(true\)/);
  assert.match(ponte, /restantes: Math\.max\(0, Number\(d\.attempts_remaining\)/);
  assert.match(codigo, /estadoVisto\.restantes < 1/);
  assert.doesNotMatch(codigo, /2\s*\*\s*24\s*\*\s*60/);
  assert.match(codigo, /modo === 'live_v1' \|\| modo === 'cinematic_v1'/);
  assert.match(codigo, /\.worldboss-map-result/);
  assert.match(codigo, /pokeidle-worldboss-map/);
});

test('o time é montado antes de gastar a tentativa', () => {
  const trecho = codigo.slice(codigo.indexOf('const executar = async'));
  assert.ok(trecho.indexOf('times.usar(cfg.time)') < trecho.indexOf('entrar.click()'));
  assert.match(trecho, /const entrar = await ate/);
  assert.match(trecho, /\.worldboss-mmo__enter/);
});

test('expedição não é interrompida e a luta tem parada segura', () => {
  assert.match(codigo, /if \(naExpedicao\(\)\) return dizer/);
  assert.match(codigo, /if \(correndo\) \{ parar = true;/);
  assert.match(codigo, /mover', ligado: false/);
});

test('configuração exportada não leva estado da conta', () => {
  const coleta = codigo.slice(codigo.indexOf('coletar: () =>'));
  const fim = coleta.slice(0, coleta.indexOf('aplicar:'));
  assert.match(fim, /horarios/);
  assert.match(fim, /time/);
  assert.doesNotMatch(fim, /ultimoEvento|estadoVisto|restantes/);
});
