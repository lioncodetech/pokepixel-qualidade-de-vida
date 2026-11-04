// Guardas da décima sétima ferramenta: a expedição.
//
// Esta tem um guarda que não é como os outros. A expedição do jogo exige uma **verificação humana**
// por integrante — um CAPTCHA, "Clique em {species}" — antes de marcar pronto. A ferramenta vai até
// à porta e para ali, por decisão, e o teste existe para que essa decisão não seja desfeita por
// descuido num refactor. Se alguém acrescentar a chamada do `ready`, isto cai. É para cair.
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

const painel = semComentarios(ler('expedicao.js'));
const ponte = semComentarios(ler('expedicao-main.js'));

test('a verificacao e o pronto ficam com a pessoa, e o codigo nao os toca', () => {
  // No cliente do jogo, `setExpeditionReady(ready, captcha)` leva o pronto E o comprovativo da
  // verificação juntos, de propósito. Chamá-lo daqui seria afirmar que houve uma pessoa quando não
  // houve. Nenhum dos dois ficheiros pode mencionar essa chamada — nem a rota dela.
  for (const [nome, codigo] of [
    ['expedicao.js', painel],
    ['expedicao-main.js', ponte],
  ]) {
    assert.ok(
      !/setExpeditionReady|lobbies\/ready|setReady\s*\(/.test(codigo),
      `${nome} não pode marcar pronto: a verificação é da pessoa, e o pronto vai com ela`,
    );
    assert.ok(
      !/captcha\s*[:=]/i.test(codigo),
      `${nome} não pode montar nem resolver a verificação`,
    );
    assert.ok(
      !/startExpedition|lobbies\/start/.test(codigo),
      `${nome} não inicia a expedição: isso é do líder, depois de todos verificarem`,
    );
  }
  // E o painel diz onde para, em vez de deixar o dono à espera de um passo que não vem.
  assert.match(painel, /resolva a verificação e marque Pronto/);
});

test('ela vai ate a porta: time, cidade e grupo, nessa ordem', () => {
  const corrida = painel.slice(painel.indexOf('const preparar = async'));
  const corpo = corrida.slice(0, corrida.indexOf('const devolver = async'));
  // O estado de antes lê-se ANTES de mexer em nada: depois da troca de time e do `stopHunt` já não
  // há o que perguntar, e era assim que se devolvia o lugar errado.
  assert.ok(corpo.indexOf('antes = {') < corpo.indexOf('times?.usar'));
  assert.ok(corpo.indexOf('times?.usar') < corpo.indexOf("acao: 'cidade'"));
  assert.ok(corpo.indexOf("acao: 'cidade'") < corpo.indexOf("acao: 'entrar'"));
  // Entrar é opcional: quem só quer ficar preparado para entrar à mão também é servido.
  assert.match(corpo, /if \(!cfg\.entrar\) \{/);
  // A entrada é a do próprio jogo: `autoJoin()` vai sem corpo, como no `ExpeditionStore.js`.
  assert.match(ponte, /await api\.autoJoinExpedition\(\);/);
  assert.match(ponte, /await api\.joinExpeditionLobby\(\{ code: codigo \}\);/);
});

test('devolve o time e a cacada so quando a expedicao acaba', () => {
  // Durante a corrida a equipe é a que está a lutar: mexer nela ali seria tirar Pokémon do meio de
  // uma expedição. O gatilho é o grupo ter existido e deixar de existir.
  const batida = painel.slice(painel.indexOf('const bater = async'));
  assert.match(batida, /if \(tinhaGrupo && !temGrupo\) \{/);
  const devolve = batida.slice(batida.indexOf('if (tinhaGrupo && !temGrupo)'));
  assert.ok(devolve.indexOf('await devolver()') < devolve.indexOf('tinhaGrupo = temGrupo;'));
  // E uma janela, uma preparação: sem isto, sair de um grupo faria a ferramenta voltar a arrastar
  // o jogador para dentro de outro, sem ninguém ter pedido.
  assert.match(batida, /if \(janelaFeita && janelaFeita === r\.fecha\) return;/);
  // Já estando num grupo não há o que preparar.
  assert.match(batida, /if \(temGrupo\) return;/);
});

test('as regras sao lidas do servidor, e nao escritas aqui', () => {
  // A frase da verificação aparece porque o servidor diz `captcha_required`, e não porque está
  // cravada no painel: no dia em que o jogo a tirar, a frase sai sozinha. Mesma lição das faixas
  // de raridade da Genética e das Raridades.
  assert.match(ponte, /exigeVerificacao: s\?\.rules\?\.captcha_required === true,/);
  assert.match(ponte, /umPorIp: s\?\.rules\?\.unique_ip_required === true,/);
  assert.match(painel, /visto\.exigeVerificacao/);
  // O estado cru traz as regras inteiras (35 fragmentos lendários, entre outras): só atravessa o
  // que o painel mostra.
  assert.ok(!/item_drops|fragment_drop_chance/.test(painel), 'o painel não recebe o que não mostra');
});

test('ela esta no catalogo, no manifest e pede a vez', () => {
  assert.match(
    ler('nucleo.js'),
    /\{ id: 'expedicao', nome: 'Expedição', atalhos: 'configuração pelo menu \(Alt\+Q\)' \}/,
  );
  const manifest = JSON.parse(ler('manifest.json'));
  const isolado = manifest.content_scripts.find((b) => b.js.includes('genetica.js'));
  const pagina = manifest.content_scripts.find((b) => b.world === 'MAIN');
  assert.ok(isolado.js.includes('expedicao.js'));
  assert.ok(pagina.js.includes('expedicao-main.js'));
  assert.match(painel, /const MINHA_VEZ = 'expedicao';/);
  const corrida = painel.slice(painel.indexOf('const preparar = async'));
  assert.ok(
    corrida.indexOf('esperarAVez') < corrida.indexOf('times?.usar'),
    'a vez é pedida antes de mexer no jogo',
  );
});

test('uma preparacao que falha pelo meio devolve o time e a cacada', () => {
  // O BUG, achado na revisão de 03/11/2026: `preparar` trocava o time, falhava a ida à cidade e
  // saía com um "não entrei" — e o `devolver()` da batida só corre quando um grupo **existiu** e
  // desapareceu. Como nunca houve grupo, o dono ficava com o time de expedição montado e fora da
  // caçada, sem ninguém lhe dizer. E a janela ficava queimada por uma falha passageira.
  const corrida = painel.slice(painel.indexOf('const preparar = async'), painel.indexOf('const desfazer ='));
  assert.match(corrida, /let falhou = false;/);
  assert.match(corrida, /const falha = \(texto\) => \{/);
  // O único `return dizer(` que resta na preparação é o de dentro do próprio `falha`: nenhuma
  // saída de erro escapa a quem marca o desfazer.
  assert.equal(
    (corrida.match(/return dizer\(/g) || []).length,
    1,
    'nenhuma saída de erro da preparação escapa ao `falha`',
  );
  assert.equal((corrida.match(/return falha\(/g) || []).length, 4);
  // Em 04/11/2026 juntou-se a saida por prazo: quem desistiu da verificacao e saiu do grupo ficou
  // com o time de expedicao montado e fora da caçada, tal e qual quem falhou. Desfaz-se igual.
  assert.match(corrida, /if \(falhou \|\| saiu\) await desfazer\(\);/);
  // A licenca sai com um `return` solto, e pode: ela corre ANTES da vez e antes de se tocar no
  // jogo, entao nao ha' nada montado para devolver.
  assert.ok(
    corrida.indexOf('pedirLicenca') < corrida.indexOf('esperarAVez'),
    'pergunta-se antes de pedir a vez: dez minutos de espera não prendem a fila',
  );
  assert.ok(
    corrida.indexOf('if (falhou || saiu) await desfazer()') < corrida.indexOf('if (soltar) soltar()'),
    'devolve-se o time com a vez ainda na mão: quem mexe no jogo tem a vez',
  );
  assert.match(corrida, /if \(porMinha && !falhou\) janelaFeita = visto\?\.fecha \|\| '';/);
  // E o desfazer é o mesmo trabalho do devolver, calado: a mensagem que fica é a do erro.
  const desfazer = painel.slice(painel.indexOf('const desfazer ='), painel.indexOf('const devolver ='));
  assert.match(desfazer, /if \(!cfg\.voltar \|\| !antes\) return;/);
  assert.match(desfazer, /times\?\.usar\?\.\(guardado\.time\)/);
  assert.match(desfazer, /cacadas\?\.ir\?\.\(guardado\.cacada\.nome\)/);
});
