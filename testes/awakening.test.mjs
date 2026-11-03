// Guardas da décima oitava ferramenta: o Awakening.
//
// Duas coisas se protegem aqui, e as duas custaram medição na conta do dono em 03/11/2026. A
// primeira é a conta do AWK — 1 material da própria espécie mais N de qualquer espécie, com N a
// subir. A segunda é a fronteira: o Challenge perde nível e cobra dinheiro, e esta ferramenta
// mostra-o em vez de o executar.
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

const painel = semComentarios(ler('awakening.js'));
const ponte = semComentarios(ler('awakening-main.js'));

test('o challenge e o god tier mostram-se, nunca se executam', () => {
  // Concluir o Challenge cobra gold ou diamantes, consome materiais e FAZ PERDER XP — o Pokémon
  // cai de nível. Isso é decisão de cada vez, e uma ferramenta que a tomasse sozinha estaria a
  // decidir a coisa mais cara do ecrã.
  for (const [nome, codigo] of [
    ['awakening.js', painel],
    ['awakening-main.js', ponte],
  ]) {
    assert.ok(
      !/awakeningStartChallenge|awakeningCompleteChallenge|awakeningGodTier/.test(codigo),
      `${nome} não pode iniciar nem concluir o Challenge, nem despertar God Tier`,
    );
    assert.ok(
      !/\/challenge|god-tier/.test(codigo),
      `${nome} não pode chamar essas rotas por outro caminho`,
    );
  }
  // Mas o painel diz a conta inteira, para a decisão ser informada: kills, stones, preço, XP.
  assert.match(painel, /kills ou \$\{c\.stones\}\/\$\{c\.stonesPrecisa\} Stones/);
  assert.match(painel, /perde \$\{c\.xpPerdida\}% da XP \(fica no nível \$\{c\.nivelDepois\}\)/);
});

test('o pedido do AWK e o do proprio jogo, com a quality que foi vista', () => {
  // `{ expected_quality_cents, materials: [{item_id, qty}] }` — e os `materials` pagam SÓ o
  // requisito genérico. Medido no `GeneticAwakening.js`.
  assert.match(ponte, /const corpo = \{ expected_quality_cents: agora \};/);
  assert.match(ponte, /corpo\.materials = escolha\.picks;/);
  // Se a Quality mudou entretanto — outro separador, outra janela — recusa-se em vez de fazer
  // outra coisa. Com material que se consome para sempre, recusar é a resposta certa.
  assert.match(ponte, /if \(Number\(cents\) !== agora\)/);
  const corpo = ponte.slice(ponte.indexOf('const awk = async'));
  assert.ok(
    corpo.indexOf('if (Number(cents) !== agora)') < corpo.indexOf('api.awakeningAWK('),
    'a conferência vem antes da chamada que consome',
  );
});

test('a escolha dos materiais gasta o abundante primeiro e nao mata o requisito de especie', () => {
  // Quem tem 6 Ariados e 1 Abra não quer ver o Abra ir primeiro: ele pode ser o único material
  // daquela espécie, e a espécie é o requisito caro do AWK seguinte.
  const bloco = ponte.slice(ponte.indexOf('const escolher ='), ponte.indexOf('const previa ='));
  assert.match(bloco, /\.sort\(\(a, b\) => Number\(a\.meu\) - Number\(b\.meu\) \|\| b\.tem - a\.tem\)/);
  // O material do próprio Pokémon só entra até a SOBRA: starvar o requisito de espécie seria
  // gastar materiais para o servidor recusar. É a mesma conta do `ownReserve` do jogo.
  assert.match(ponte, /sobra: Math\.max\(0, tem - precisa\)/);
  assert.match(bloco, /Math\.min\(c\.tem, reserva\.sobra - doMeu\)/);
  // Ordenado por item_id, como o jogo: dois pedidos iguais têm de ser byte a byte iguais para a
  // chave de idempotência valer alguma coisa.
  assert.match(bloco, /picks\.sort\(/);
});

test('a conta ate o teto e feita antes de comecar', () => {
  // O gargalo é sempre o material DA ESPÉCIE CERTA, e saber "faltam 2 de Ralts e 9 quaisquer"
  // antes de começar é o que evita ficar a meio caminho com o material no fim. A regra é
  // aritmética: do AWK de agora até o último, o passo N custa 1 da espécie e N quaisquer.
  const bloco = ponte.slice(ponte.indexOf('let especieFaltam'), ponte.indexOf('return {\n      ligado'));
  assert.match(bloco, /precisaEspecie \+= 1;/);
  assert.match(bloco, /precisaGenerico \+= n;/);
  assert.match(ponte, /ateOTeto: \{ especie: especieFaltam, generico: genericoFaltam \}/);
  assert.match(painel, /Até o teto \(\$\{comoQuality\(e\.max\)\}\) faltam/);
});

test('ela esta no catalogo, no manifest e pede a vez', () => {
  assert.match(
    ler('nucleo.js'),
    /\{ id: 'awakening', nome: 'Awakening', atalhos: 'configuração pelo menu \(Alt\+Q\)' \}/,
  );
  const manifest = JSON.parse(ler('manifest.json'));
  const isolado = manifest.content_scripts.find((b) => b.js.includes('genetica.js'));
  const pagina = manifest.content_scripts.find((b) => b.world === 'MAIN');
  assert.ok(isolado.js.includes('awakening.js'));
  assert.ok(pagina.js.includes('awakening-main.js'));
  assert.match(painel, /const MINHA_VEZ = 'awakening';/);
  const corrida = painel.slice(painel.indexOf('const correr = async'));
  assert.ok(
    corrida.indexOf('esperarAVez') < corrida.indexOf("acao: 'awk'"),
    'a vez é pedida antes do primeiro AWK',
  );
  // Pausa e parada lidas ANTES da chamada que consome, nunca depois.
  const laco = corrida.slice(corrida.indexOf('for (;;)'));
  assert.ok(laco.indexOf('if (parar) break;') < laco.indexOf("acao: 'awk'"));
  assert.ok(laco.indexOf('if (pausado)') < laco.indexOf("acao: 'awk'"));
});
