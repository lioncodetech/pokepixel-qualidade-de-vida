// Guardas do corte de grafico.
//
// A ferramenta nasceu cobrindo so' o `_spriteset` do motor. A cacada, porem, nao e' uma cena do
// motor: e' DOM animado por CSS, e foi medido na conta real em 08/10/2026 que o Alt+G nao a
// alcancava — os lutadores continuavam andando e o fundo continuava rolando.
//
// Em vez de ler o texto do arquivo, este teste **executa** o modulo contra um DOM de mentira com
// a forma minima que ele usa. E' a unica maneira de provar que ligar poe o estilo e desligar o
// tira: um guarda de texto passaria mesmo que o estilo nunca chegasse ao `head`.
//
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const fonte = readFileSync(new URL('../sem-grafico.js', import.meta.url), 'utf8');

/** DOM de mentira: so' o que o modulo toca, para nada escondido passar por funcionar. */
function montarPagina({ guardado = null } = {}) {
  const head = { filhos: [] };
  const criados = [];
  const feito = (tag) => {
    const no = {
      tagName: tag.toUpperCase(),
      id: '',
      textContent: '',
      style: { cssText: '' },
      pai: null,
      remove() {
        if (this.pai) this.pai.filhos = this.pai.filhos.filter((f) => f !== this);
        this.pai = null;
      },
    };
    criados.push(no);
    return no;
  };
  const doc = {
    head,
    documentElement: head,
    body: { appendChild: () => {} },
    createElement: feito,
    getElementById: (id) => head.filhos.find((f) => f.id === id) || null,
    addEventListener: () => {},
    dispatchEvent: () => {},
  };
  head.appendChild = (no) => {
    no.pai = head;
    head.filhos.push(no);
    return no;
  };

  const armazem = new Map();
  if (guardado !== null) armazem.set('pp-sem-grafico', guardado);

  let ronda = null;
  const meta = {};
  let corpo = null;

  const executar = new Function(
    'PPX',
    'window',
    'document',
    'localStorage',
    'setInterval',
    'addEventListener',
    'CustomEvent',
    fonte,
  );
  executar(
    {
      modulo: (m, fn) => {
        Object.assign(meta, m);
        corpo = fn;
      },
    },
    { SceneManager: null },
    doc,
    {
      getItem: (k) => (armazem.has(k) ? armazem.get(k) : null),
      setItem: (k, v) => armazem.set(k, v),
    },
    (fn) => {
      ronda = fn;
    },
    () => {},
    class {
      constructor(nome, init) {
        this.type = nome;
        Object.assign(this, init);
      }
    },
  );
  corpo();

  return {
    meta,
    head,
    estilo: () => head.filhos.find((f) => f.id === 'ppx-sem-grafico') || null,
    ronda: () => ronda(),
  };
}

test('o corte alcanca a cacada, que e DOM e nao cena do motor', () => {
  const pagina = montarPagina({ guardado: '1' });
  pagina.ronda();
  const estilo = pagina.estilo();
  assert.ok(estilo, 'ligado, um <style> entra no head');
  // Os tres alvos medidos na pagina do jogo. Perder qualquer um deixa algo se mexendo sozinho.
  assert.match(estilo.textContent, /\.platform-hunt__backdrop/, 'o fundo com parallax');
  assert.match(estilo.textContent, /\.platform-hunt__sprite/, 'os lutadores');
  assert.match(estilo.textContent, /\.platform-hunt__arena/, 'a arena e o que ela contem');
});

test('o pokemon fica na tela como imagem parada, nao desaparece', () => {
  // Quem joga precisa ver se morreu, o HP e a pokebola. O `steps(2)` do jogo congela no quadro em
  // que esta', entao tirar a animacao basta — esconder o sprite seria tirar o que se quer ver.
  const pagina = montarPagina({ guardado: '1' });
  pagina.ronda();
  const css = pagina.estilo().textContent;
  assert.match(css, /animation:\s*none/, 'a animacao do sprite para');
  assert.doesNotMatch(
    css,
    /\.platform-hunt__sprite[^{]*\{[^}]*display:\s*none/,
    'o sprite nao e escondido',
  );
});

test('desligar nao deixa residuo no head', () => {
  const pagina = montarPagina({ guardado: '1' });
  pagina.ronda();
  assert.ok(pagina.estilo(), 'entrou');
  // Desligar pela chave: a ronda seguinte tem de tirar o estilo, nao apenas parar de o repor.
  const pagina2 = montarPagina({ guardado: '0' });
  pagina2.ronda();
  assert.equal(pagina2.estilo(), null, 'desligado, o head fica limpo');
});

test('a ronda repete sem empilhar estilos', () => {
  // O jogo troca de tela sem recarregar e a ronda corre a cada 500 ms: um <style> por volta
  // encheria o head em minutos.
  const pagina = montarPagina({ guardado: '1' });
  pagina.ronda();
  pagina.ronda();
  pagina.ronda();
  const quantos = pagina.head.filhos.filter((f) => f.id === 'ppx-sem-grafico').length;
  assert.equal(quantos, 1, 'um estilo so, por mais voltas que a ronda de');
});
