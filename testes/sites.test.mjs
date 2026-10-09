// Guarda do alcance do pacote: este e o pacote do PokePixel, e so dele.
//
// Ate a 1.10.0 o manifest declarava tambem `poke.idleworld.online`. Aquilo e outro jogo — feito em
// Next.js, sem o motor nem a API de que estas ferramentas vivem — e o que carregava la era um menu
// que nao fazia nada.
//
// O guarda nao e sobre arrumacao. Dois pacotes que declarem o mesmo site injetam-se na mesma
// pagina e disputam os atalhos: Alt+Q abrindo dois menus, Alt+G com dois donos. E' o mesmo
// acidente que o README ja avisa para as extensoes avulsas, e a unica coisa que o previne e cada
// pacote declarar apenas o seu site.
//
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const manifest = JSON.parse(
  readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'),
);

const SITE = 'https://pokepixel.nietore.com/*';

test('todo bloco de content script declara o PokePixel e mais nada', () => {
  assert.ok(manifest.content_scripts.length > 0, 'ha blocos a conferir');
  for (const [i, bloco] of manifest.content_scripts.entries()) {
    assert.deepEqual(
      bloco.matches,
      [SITE],
      `o bloco ${i} tem de declarar so ${SITE}`,
    );
  }
});

test('nenhum outro jogo entra pela porta das permissoes', () => {
  // `host_permissions` e `permissions` alcancam a pagina tanto quanto `matches`: tirar um site dos
  // matches e deixa-lo aqui seria tirar com uma mao e repor com a outra.
  const texto = JSON.stringify({
    host: manifest.host_permissions ?? [],
    permissoes: manifest.permissions ?? [],
    web: manifest.web_accessible_resources ?? [],
  });
  assert.doesNotMatch(texto, /idleworld/, 'sem poke.idleworld.online');
  assert.doesNotMatch(texto, /<all_urls>|\*:\/\/\*\//, 'sem alcance a qualquer site');
});
