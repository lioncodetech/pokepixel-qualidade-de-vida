// Guardas da conta de tipos: o que um Pokémon leva, o que ele dá, e que caçada serve a ele.
//
// Ao contrário das outras ferramentas, esta é **código puro** — não lê DOM, não fala com o jogo, não
// guarda nada. Por isso aqui não se verificam linhas de código: exercita-se a decisão de verdade,
// com números, que é o que de facto protege.
//
// Rode com: node --test testes/*.test.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const fonte = readFileSync(new URL('../tipos.js', import.meta.url), 'utf8');
const modulo = { exports: {} };
new Function('module', fonte)(modulo);
const T = modulo.exports;

/** Um golpe, como a ponte o entrega. */
const golpe = (elemento, poder = 60) => ({ id: elemento, elemento, poder });

test('a tabela e a do jogo: 18 tipos, e as casas que o dono citou', () => {
  // Copiada do `EncyclopediaScene.js` do jogo em 14/10/2026, e não de memória. Estas são as casas
  // que, se estiverem erradas, mandam um Pokémon para onde ele apanha.
  assert.equal(T.TIPOS.length, 18);
  assert.equal(Object.keys(T.TABELA).length, 18);
  assert.equal(T.TABELA.water.fire, 2);
  assert.equal(T.TABELA.fire.water, 0.5);
  assert.equal(T.TABELA.electric.ground, 0, 'terra não leva nada de elétrico');
  assert.equal(T.TABELA.ghost.normal, 0);
  assert.equal(T.TABELA.dragon.fairy, 0);
  assert.equal(T.TABELA.psychic.dark, 0);
  // E o que não está escrito é 1, nunca 0: desconhecido não é imunidade.
  assert.equal(T.contra('normal', ['water']), 1);
  assert.equal(T.contra('inventado', ['water']), 1);
});

test('os dois tipos do alvo multiplicam-se, e e dai que vem o 4x', () => {
  // A conta que o jogo mostra na coluna "GOLPES RECOMENDADOS": Pupitar é Pedra/Terra, e grama
  // bate 2x em cada um. Conferido no jogo logado em 14/10/2026: ele diz "Planta ×4,0".
  assert.equal(T.contra('grass', ['rock', 'ground']), 4);
  assert.equal(T.contra('water', ['rock', 'ground']), 4);
  // Gelo não diz nada a pedra (1) e bate 2x em terra: 1 x 2. O jogo mostra "Gelo ×2,0" nessa
  // mesma linha, o que confirma que o que falta na tabela vale 1 — e não 0.5 nem 0.
  assert.equal(T.contra('ice', ['rock', 'ground']), 2);
});

test('o que ele leva e o PIOR dos tipos do alvo, e nunca a media', () => {
  // A regra é do dono, literal: *"que ele não tome 2x ou 4x"*. Um alvo que bate 4x com um tipo e
  // 0.5x com o outro continua a ser um alvo que bate 4x — a média esconderia exatamente o caso que
  // esta conta existe para evitar.
  const eu = ['grass', 'psychic'];
  // bug bate 2x em grama e 2x em psíquico; voador bate 2x em grama. O pior manda.
  assert.equal(T.levaDe(eu, ['bug', 'poison']), 4);
  assert.equal(T.levaDe(eu, ['normal']), 1);
  // E sem tipos de um dos lados a resposta é 1: desconhecido não é perigo nem segurança.
  assert.equal(T.levaDe(eu, []), 1);
  assert.equal(T.levaDe([], ['fire']), 1);
});

test('o que ele da e o MELHOR golpe dele, porque basta um', () => {
  const golpes = [golpe('grass'), golpe('psychic')];
  assert.equal(T.daCom(golpes, ['rock', 'ground']), 4, 'a grama resolve sozinha');
  assert.equal(T.daCom(golpes, ['normal']), 1);
  // Sem golpe nenhum conhecido, 1 — e não 0, que diria "ele não faz nada" sobre o que não se sabe.
  assert.equal(T.daCom([], ['normal']), 1);
});

test('so contam os golpes que ele ja tem, e que de facto batem', () => {
  const doJogo = new Map([
    ['brasa', { id: 'brasa', elemento: 'fire', poder: 40 }],
    ['lanca-chamas', { id: 'lanca-chamas', elemento: 'fire', poder: 90 }],
    ['encarar', { id: 'encarar', elemento: 'normal', poder: 1 }],
  ]);
  const progressao = [
    { id: 'brasa', unlock_level: 5 },
    { id: 'encarar', unlock_level: 10 },
    { id: 'lanca-chamas', unlock_level: 60 },
    { id: 'golpe-que-nao-existe', unlock_level: 1 },
  ];
  // Lv 40: o Lança-Chamas ainda não abriu, o Encarar não faz dano, e o inventado não existe.
  assert.deepEqual(
    T.golpesDe(progressao, 40, doJogo).map((g) => g.id),
    ['brasa'],
  );
  // Lv 60: o segundo entra.
  assert.deepEqual(
    T.golpesDe(progressao, 60, doJogo).map((g) => g.id),
    ['brasa', 'lanca-chamas'],
  );
});

test('a caca so passa se ele NAO levar 2x E der 2x — as duas', () => {
  const quem = { tipos: ['water'], golpes: [golpe('water')], nivel: 90 };
  // Dá 4x e leva 1x: passa.
  assert.equal(
    T.avaliar(quem, { nome: 'Golem', nivel: 94, elementos: ['rock', 'ground'] }).passa,
    true,
  );
  // Dá 2x mas leva 2x (elétrico bate 2x em água): não passa, por mais que renda.
  const arriscada = T.avaliar(quem, { nome: 'X', nivel: 90, elementos: ['electric', 'fire'] });
  assert.equal(arriscada.da, 2);
  assert.equal(arriscada.leva, 2);
  assert.equal(arriscada.passa, false, 'arrasar e apanhar na mesma não é o que ele pediu');
  // Seguro mas sem vantagem: também não passa.
  assert.equal(T.avaliar(quem, { nome: 'Y', nivel: 90, elementos: ['normal'] }).passa, false);
});

test('a janela e simetrica e e sobre o nivel da cacada', () => {
  const quem = { tipos: ['water'], golpes: [golpe('water')], nivel: 90 };
  const mapa = (n) => ({ nome: `Golem ${n}`, nivel: n, elementos: ['rock', 'ground'] });
  const todas = [mapa(84), mapa(85), mapa(90), mapa(95), mapa(96)];
  const nomes = T.escolher(quem, todas, { janela: 5 }).map((a) => a.cacada);
  assert.equal(nomes.length, 3, 'de 85 a 95, e nada fora disso');
  assert.ok(!nomes.includes('Golem 84') && !nomes.includes('Golem 96'));
  // Sem janela não se escolhe nada: upar às cegas num raio indefinido não é uma decisão.
  assert.deepEqual(T.escolher(quem, todas, {}), []);
});

test('as lendarias ficam de fora, a nao ser que se peca', () => {
  // São 19 das 377, e a Ilha Lendária de Entei não é sítio para onde mandar um Pokémon sozinho e
  // sem aviso.
  const quem = { tipos: ['water'], golpes: [golpe('water')], nivel: 210 };
  const lista = [
    {
      nome: 'Ilha Lendária de Entei',
      nivel: 210,
      elementos: ['rock', 'ground'],
      mundo: 'legendary',
    },
    { nome: 'Golem', nivel: 208, elementos: ['rock', 'ground'], mundo: 'hoenn' },
  ];
  assert.deepEqual(
    T.escolher(quem, lista, { janela: 5 }).map((a) => a.cacada),
    ['Golem'],
  );
  assert.equal(T.escolher(quem, lista, { janela: 5, comLendarias: true }).length, 2);
});

test('a ordem e: quem rende mais, depois quem machuca menos, depois a mais perto', () => {
  const quem = { tipos: ['water'], golpes: [golpe('water'), golpe('ice')], nivel: 90 };
  const lista = [
    { nome: 'quatro-x', nivel: 94, elementos: ['rock', 'ground'] },
    { nome: 'dois-x-seguro', nivel: 93, elementos: ['fire'] },
    { nome: 'dois-x-perto', nivel: 90, elementos: ['fire'] },
  ];
  assert.deepEqual(
    T.escolher(quem, lista, { janela: 5 }).map((a) => a.cacada),
    ['quatro-x', 'dois-x-perto', 'dois-x-seguro'],
  );
});

test('a ordem e estavel: duas voltas iguais escolhem o mesmo', () => {
  // **Isto nao e' zelo.** A escada bate a cada mudança de HUD. Uma ordem que oscilasse entre duas
  // caçadas empatadas faria a escada viajar de um lado para o outro sem ninguém ter subido de
  // nível — e, com 30 s de espera entre entradas (medido no jogo em 14/10/2026), seria uma conta
  // que nunca upa ninguém.
  const quem = { tipos: ['water'], golpes: [golpe('water')], nivel: 90 };
  const empatadas = ['Bravo', 'Alfa', 'Charlie'].map((n) => ({
    nome: n,
    nivel: 92,
    elementos: ['fire'],
  }));
  const uma = T.escolher(quem, empatadas, { janela: 5 }).map((a) => a.cacada);
  const outra = T.escolher(quem, [...empatadas].reverse(), { janela: 5 }).map((a) => a.cacada);
  assert.deepEqual(uma, outra);
  assert.deepEqual(uma, ['Alfa', 'Bravo', 'Charlie'], 'o desempate final é o nome, que não oscila');
});

test('o exemplo do dono, com os numeros do jogo', () => {
  // Medido na conta logada em 14/10/2026. O Charizard Lv 80 é fire/flying e tem Brasa, Ás dos Ares,
  // Lança-Chamas e Erupção; o Blastoise Lv 90 é water e tem a linha toda de água. As caçadas são as
  // que o jogo devolveu na janela de ±5.
  const chari = {
    tipos: ['fire', 'flying'],
    golpes: [golpe('fire'), golpe('flying')],
    nivel: 80,
  };
  const perto = [
    { nome: 'Victreebel', nivel: 76, elementos: ['grass', 'poison'] },
    { nome: 'Hitmonlee', nivel: 78, elementos: ['fighting'] },
    { nome: 'Vileplume', nivel: 84, elementos: ['grass', 'poison'] },
    { nome: 'Golem', nivel: 79, elementos: ['rock', 'ground'] },
  ];
  const dele = T.escolher(chari, perto, { janela: 5 });
  // O Hitmonlee vem à frente das duas de grama **com o mesmo 2x**: ele é a única das três onde o
  // Charizard também apanha menos (lutador bate 0.5x num fire/flying). É a segunda chave da ordem a
  // fazer o seu trabalho.
  assert.deepEqual(
    dele.map((a) => a.cacada),
    ['Hitmonlee', 'Victreebel', 'Vileplume'],
  );
  assert.deepEqual(
    dele.map((a) => a.leva),
    [0.5, 1, 1],
  );
  // O Golem fica de fora, e por um motivo que a tabela conhece: pedra bate 2x num fire/flying.
  assert.equal(T.levaDe(chari.tipos, ['rock', 'ground']), 4);

  const blasto = { tipos: ['water'], golpes: [golpe('water')], nivel: 90 };
  const perto2 = [
    { nome: 'Golem', nivel: 94, elementos: ['rock', 'ground'] },
    { nome: 'Aerodactyl', nivel: 85, elementos: ['flying', 'rock'] },
    { nome: 'Charizard', nivel: 92, elementos: ['fire'] },
  ];
  const dele2 = T.escolher(blasto, perto2, { janela: 5 });
  assert.equal(dele2[0].cacada, 'Golem');
  assert.equal(dele2[0].da, 4);
  assert.equal(dele2[0].leva, 1);
});

test('a conta bate com a coluna do proprio jogo', () => {
  // A janela de caçadas do jogo tem uma coluna "GOLPES RECOMENDADOS" com os multiplicadores. É uma
  // segunda testemunha, e de graça: quem duvidar desta tabela tem onde olhar. Estes três foram
  // lidos da tela em 14/10/2026.
  //   Pupitar (Pedra/Terra) -> Água ×4,0 · Planta ×4,0 · Gelo ×2,0
  assert.equal(T.contra('water', ['rock', 'ground']), 4);
  assert.equal(T.contra('grass', ['rock', 'ground']), 4);
  assert.equal(T.contra('ice', ['rock', 'ground']), 2);
  //   Wooper (Água/Terra) -> Planta ×4,0
  assert.equal(T.contra('grass', ['water', 'ground']), 4);
  //   Hoppip (Planta/Voador) -> Gelo ×4,0 · Fogo ×2,0 · Veneno ×2,0
  assert.equal(T.contra('ice', ['grass', 'flying']), 4);
  assert.equal(T.contra('fire', ['grass', 'flying']), 2);
  assert.equal(T.contra('poison', ['grass', 'flying']), 2);
  //   Dunsparce (Normal) -> Lutador ×2,0
  assert.equal(T.contra('fighting', ['normal']), 2);
});
