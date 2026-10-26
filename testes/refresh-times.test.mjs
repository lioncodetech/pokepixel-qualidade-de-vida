import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Lido sem os \r: a arvore de trabalho do Windows vem em CRLF e a da CI em LF, e um guarda que
// casa duas linhas seguidas da' fonte so' falhava de um dos lados. Oito deles, em 26/10/2026.
const ler = (nome) =>
  readFileSync(new URL(`../${nome}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

for (const nome of ['gym.js', 'escada.js', 'cacadas.js', 'rampage.js', 'eventos.js', 'ilhas.js']) {
  test(`${nome} oferece releitura manual dos times`, () => {
    const codigo = ler(nome);
    assert.match(codigo, /data-recarregar(?:-times)?/);
    assert.match(codigo, /Atualizar a lista de times/);
    assert.match(codigo, /times\?\.nomes\?\.\(\)/);
    assert.match(codigo, /\[data-recarregar(?:-times)?\][^\n]*addEventListener\('click'/);
  });
}

test('Arena fica de fora porque escolhe ataque PvP salvo, nao um time guardado', () => {
  const codigo = ler('arena.js');
  assert.match(codigo, /ataque salvo a carregar/);
  assert.doesNotMatch(codigo, /PPX\?\.times\?\.nomes/);
});
