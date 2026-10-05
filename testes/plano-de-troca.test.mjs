// Teste de mesa do plano de troca de equipe.
//
// A ferramenta inteira depende do DOM do jogo e nao da' para exercitar fora dele. A decisao, nao:
// `planoDeTroca` e' pura de proposito, e e' onde moram as regras chatas. Rode com:
//
//     node --test testes/*.test.mjs
//
// O caso que originou este arquivo e' o `troca completa`: com seis saindo e seis entrando, o
// ultimo nao entrava, porque o Pokemon ativo nao pode ser removido e a equipe trava em seis.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// `times.js` e' um content script: roda inteiro quando carregado e chama `PPX.modulo`. Aqui ele e'
// avaliado com um `PPX` de mentira e um `module` para a funcao sair pelo `module.exports` do fim.
const fonte = readFileSync(new URL('../times.js', import.meta.url), 'utf8');
const caixa = { exports: {} };
new Function('PPX', 'module', fonte)({ modulo: () => {} }, caixa);
const { planoDeTroca } = caixa.exports;

/**
 * Executa um plano contra as regras do jogo, para conferir que ele e' aplicavel de verdade.
 *
 * Nao basta o plano terminar com a equipe certa: cada passo tem de ser legal no momento em que
 * acontece. E' aqui que uma remocao do ativo ou um setimo Pokemon seriam pegos.
 */
function executar(equipeInicial, chefeInicial, passos) {
  let equipe = [...equipeInicial];
  let chefe = chefeInicial;
  for (const passo of passos) {
    if (passo.acao === 'lider') {
      assert.ok(equipe.includes(passo.id), `líder ${passo.id} não está na equipe`);
      chefe = passo.id;
    } else if (passo.acao === 'tirar') {
      assert.ok(equipe.includes(passo.id), `tirar ${passo.id}, que não está na equipe`);
      assert.notEqual(passo.id, chefe, 'o jogo não deixa remover o Pokémon ativo');
      equipe = equipe.filter((x) => x !== passo.id);
    } else {
      assert.ok(!equipe.includes(passo.id), `pôr ${passo.id}, que já está na equipe`);
      assert.ok(equipe.length < 6, 'a equipe trava em 6');
      equipe = [...equipe, passo.id];
    }
  }
  return { equipe, chefe };
}

const mesmos = (a, b) => assert.deepEqual([...a].sort(), [...b].sort());

test('a equipe que já é a guardada não gera passo nenhum', () => {
  const atual = ['a', 'b', 'c'];
  const plano = planoDeTroca(atual, 'a', ['a', 'b', 'c']);
  assert.deepEqual(plano.passos, []);
  assert.equal(plano.resolvido, true);
});

test('troca completa: seis saindo e seis entrando, com o ativo travado', () => {
  // O caso relatado. O ativo nao pode sair enquanto nao houver outro para assumir, e so' ha' outro
  // depois que a primeira leva entrar — por isso o plano precisa de duas voltas.
  const atual = ['a', 'b', 'c', 'd', 'e', 'f'];
  const novo = ['g', 'h', 'i', 'j', 'k', 'l'];
  const plano = planoDeTroca(atual, 'a', novo);

  const fim = executar(atual, 'a', plano.passos);
  mesmos(fim.equipe, novo);
  assert.equal(plano.resolvido, true);
  // O sexto entra: era exatamente ele que ficava de fora.
  assert.ok(plano.passos.some((p) => p.acao === 'por' && p.id === 'l'));
  // E a lideranca passa para alguem do time novo antes de o antigo sair.
  const passouBastao = plano.passos.findIndex((p) => p.acao === 'lider' && novo.includes(p.id));
  const saiuOAtivo = plano.passos.findIndex((p) => p.acao === 'tirar' && p.id === 'a');
  assert.ok(passouBastao >= 0 && passouBastao < saiuOAtivo);
});

test('troca completa a partir de uma equipe de um só', () => {
  // Sem ninguem para assumir e sem vaga? Ha' vaga: a equipe tem um so'. Entra alguem, assume, e o
  // antigo sai.
  const plano = planoDeTroca(['a'], 'a', ['g', 'h']);
  const fim = executar(['a'], 'a', plano.passos);
  mesmos(fim.equipe, ['g', 'h']);
  assert.equal(plano.resolvido, true);
});

test('troca parcial não mexe em quem fica, e não troca de líder à toa', () => {
  const atual = ['a', 'b', 'c', 'd', 'e', 'f'];
  const plano = planoDeTroca(atual, 'a', ['a', 'b', 'c', 'd', 'e', 'z']);
  const fim = executar(atual, 'a', plano.passos);
  mesmos(fim.equipe, ['a', 'b', 'c', 'd', 'e', 'z']);
  // O ativo continua no time novo, entao nao ha' motivo para passar a lideranca.
  assert.equal(
    plano.passos.filter((p) => p.acao === 'lider').length,
    0,
    'passou a liderança sem precisar',
  );
  assert.deepEqual(plano.passos, [
    { acao: 'tirar', id: 'f' },
    { acao: 'por', id: 'z' },
  ]);
});

test('o ativo sai quando há quem fique, sem esperar entradas', () => {
  // `a` esta' de saida e `b` fica: o bastao passa na primeira volta, sem precisar encher a equipe.
  const atual = ['a', 'b', 'c'];
  const plano = planoDeTroca(atual, 'a', ['b', 'c', 'd']);
  const fim = executar(atual, 'a', plano.passos);
  mesmos(fim.equipe, ['b', 'c', 'd']);
  assert.equal(plano.passos[0].acao, 'lider');
  assert.equal(plano.passos[0].id, 'b');
});

test('remover vem antes de colocar, sempre', () => {
  // Ao contrario, a primeira adicao bateria no teto de seis e falharia calada.
  const atual = ['a', 'b', 'c', 'd', 'e', 'f'];
  const plano = planoDeTroca(atual, 'a', ['a', 'b', 'c', 'y', 'z', 'w']);
  const primeiroPor = plano.passos.findIndex((p) => p.acao === 'por');
  const ultimoTirar = plano.passos.map((p) => p.acao).lastIndexOf('tirar');
  assert.ok(ultimoTirar < primeiroPor, 'colocou antes de terminar de tirar');
  mesmos(executar(atual, 'a', plano.passos).equipe, ['a', 'b', 'c', 'y', 'z', 'w']);
});

test('nenhum plano passa de seis nem remove o ativo, em 200 sorteios', () => {
  // Varredura: as duas regras do jogo valem em qualquer combinacao, nao so' nas escolhidas a dedo.
  const nomes = 'abcdefghijklmnop'.split('');
  let semente = 7;
  const sorteio = () => {
    semente = (semente * 1103515245 + 12345) % 2147483648;
    return semente / 2147483648;
  };
  for (let caso = 0; caso < 200; caso += 1) {
    const baralho = [...nomes].sort(() => sorteio() - 0.5);
    const tamanho = 1 + Math.floor(sorteio() * 6);
    const atual = baralho.slice(0, tamanho);
    const alvo = baralho.slice(tamanho).slice(0, 1 + Math.floor(sorteio() * 6));
    const chefe = atual[Math.floor(sorteio() * atual.length)];
    const plano = planoDeTroca(atual, chefe, alvo);
    const fim = executar(atual, chefe, plano.passos);
    mesmos(fim.equipe, alvo);
    assert.equal(plano.resolvido, true);
  }
});
