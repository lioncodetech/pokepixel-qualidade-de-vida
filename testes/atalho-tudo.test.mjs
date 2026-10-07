// Guardas do Alt+Z e do Alt+X: esconder todas as janelas de uma vez, e trazê-las de volta.
//
// O comportamento inteiro está medido em `testes/banca-sumico.html`, que atravessa um F5 de
// verdade. O que mora aqui são as três decisões que um refactor desfaz sem perceber — e que,
// desfeitas, só aparecem no dia em que alguém aperta o atalho e perde uma janela.
//
// Rode com: node --test testes/*.test.mjs

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

const ler = (nome) => readFileSync(new URL(`../${nome}`, import.meta.url), 'utf8');
const nucleo = ler('nucleo.js');

test('a volta mostra so o que estava a vista, e nao tudo', () => {
  // Quem escondeu o Raridades ontem não o quer de volta por ter dado um Alt+X hoje. A lista do que
  // estava à vista é o que separa "trazer de volta" de "mostrar tudo".
  const volta = nucleo.slice(nucleo.indexOf('function mostrarTudo()'));
  assert.match(
    volta.slice(0, volta.indexOf('\n  }')),
    /voltam\.includes\(m\.id\)/,
    'a volta é filtrada pela lista guardada',
  );
  const esconde = nucleo.slice(nucleo.indexOf('function esconderTudo()'));
  assert.match(
    esconde.slice(0, esconde.indexOf('\n  }')),
    /gravar\(CHAVE_SUMICO, sumico\)/,
    'e a lista é gravada ao esconder',
  );
  // Gravada, e não só em memória: o F5 é o caso normal deste pacote, não a exceção.
  assert.match(nucleo, /let sumico = ler\(CHAVE_SUMICO, null\);/);
});

test('esconder duas vezes nao apaga a lista', () => {
  // É o único jeito de este par se estragar: com tudo já escondido, um segundo Alt+Z gravaria uma
  // lista vazia por cima da boa, e o Alt+X seguinte não teria o que trazer de volta.
  const esconde = nucleo.slice(nucleo.indexOf('function esconderTudo()'));
  const dentro = esconde.slice(0, esconde.indexOf('\n  }'));
  assert.match(dentro, /if \(Array\.isArray\(sumico\)\) return;/);
  // E mostrar sem nada escondido também não faz nada: apertar o mesmo de novo não desfaz.
  const volta = nucleo.slice(nucleo.indexOf('function mostrarTudo()'));
  assert.match(volta.slice(0, volta.indexOf('\n  }')), /if \(!Array\.isArray\(sumico\)\) return;/);
});

test('as ferramentas de efeito ficam de fora', () => {
  // "Ocultar popups" e "Sem gráfico" não têm janela nenhuma na tela: o botão delas liga e desliga
  // o que fazem com a página. Apagá-las aqui não limparia a tela — mudaria o jogo.
  assert.match(
    nucleo,
    /const comJanela = \(\) => modulos\.filter\(\(m\) => !m\.efeito && m\.aplicar\);/,
  );
});

test('a abinha do menu geral fica, e ha dois caminhos de volta', () => {
  // A abinha é o menu geral do pacote, não uma das janelas que atrapalham a vista do jogo. Ela
  // sumia junto até aqui, e esconder tudo virava uma porta sem maçaneta para quem não lembrasse
  // do Alt+X. O estado de "escondido tudo" não pode voltar a entrar nesta conta.
  assert.match(nucleo, /aba\.classList\.toggle\('aberta', !aberto\);/);
  assert.doesNotMatch(nucleo, /aba\.classList\.toggle\('aberta'[^)]*sumico/);
  const atalho = nucleo.slice(nucleo.indexOf("if (!e.altKey || e.ctrlKey || e.metaKey) return;"));
  // Dois atalhos, não um que alterna: a mesma regra de cada ferramenta deste pacote.
  assert.match(atalho.slice(0, 700), /if \(e\.code === 'KeyZ'\) esconderTudo\(\);/, 'Alt+Z esconde');
  assert.match(atalho.slice(0, 700), /else mostrarTudo\(\);/, 'e Alt+X mostra');
  assert.match(atalho.slice(0, 700), /e\.code !== 'KeyQ'/, 'e Alt+Q continua abrindo o menu');
});

test('nenhuma ferramenta disputa uma tecla do LionMultInstance', () => {
  // O LMI escuta estas **por fora da página**, no processo do aplicativo: a extensão não ganha essa
  // disputa, e nem deveria tentar. Alt+R era das Caçadas até a 1.8.1 — esconder uma caçada
  // rearranjava a grade de views junto.
  const DO_APP = { KeyR: 'restaurar a grade', KeyM: 'silenciar a view' };
  const arquivos = readdirSync(new URL('../', import.meta.url)).filter(
    (nome) => nome.endsWith('.js') && nome !== 'eslint.config.mjs',
  );
  for (const nome of arquivos) {
    const codigo = ler(nome);
    for (const [tecla, oQue] of Object.entries(DO_APP))
      assert.doesNotMatch(
        codigo,
        new RegExp(`code === '${tecla}'`),
        `${nome} usa Alt+${tecla.slice(3)}, que no LionMultInstance é "${oQue}"`,
      );
  }
});

test('nenhuma ferramenta disputa o Alt+Z nem o Alt+X com o nucleo', () => {
  // O pacote tem dezoito atalhos em Alt. Um atalho novo que caia em cima deste faria as duas coisas
  // ao mesmo tempo, e o relato seria "o atalho às vezes funciona".
  const outros = readdirSync(new URL('../', import.meta.url)).filter(
    (nome) => nome.endsWith('.js') && nome !== 'nucleo.js' && nome !== 'eslint.config.mjs',
  );
  for (const nome of outros) {
    const codigo = ler(nome);
    for (const tecla of ['x', 'z']) {
      assert.doesNotMatch(
        codigo,
        new RegExp(`code === 'Key${tecla.toUpperCase()}'`),
        `${nome} disputa o Alt+${tecla.toUpperCase()}`,
      );
      assert.doesNotMatch(
        codigo,
        new RegExp(`tecla === '${tecla}'`),
        `${nome} disputa o Alt+${tecla.toUpperCase()}`,
      );
    }
  }
  // E o menu diz que os atalhos existem: um atalho que ninguém descobre não serve para nada.
  assert.match(nucleo, /<b>Alt\+Z<\/b> esconde todas as janelas/);
  assert.match(nucleo, /<b>Alt\+X<\/b> traz de volta/);
});
