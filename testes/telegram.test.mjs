// Guardas do recado no Telegram.
//
// Ele existe por uma objeção do dono, em 03/11/2026: um aviso na tela não serve a quem não está no
// computador. Então o aviso sai do computador — e é só isso que ele faz. A verificação da expedição
// continua a ser dele, e há aqui um teste que cai se alguém acrescentar um caminho que a responda.
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

const fonte = ler('telegram.js');
const codigo = semComentarios(fonte);
const painel = semComentarios(ler('expedicao.js'));

/** O módulo, exercitado de mesa: o ficheiro publica-se em `module.exports` para isto. */
const carregar = () => {
  const mod = { exports: {} };
  new Function('module', 'globalThis', fonte)(mod, {});
  return mod.exports;
};

test('o pedido sai sem preflight, e nao de um service worker', () => {
  // MEDIDO EM 03/11/2026, e as duas medições juntas decidem o desenho:
  //   - `api.telegram.org` responde `Access-Control-Allow-Origin: *` → o fetch pode sair do content
  //     script, sem service worker. Isso importa porque o pacote corre dentro do LionMultInstance,
  //     que é Electron, e Electron não corre service workers de extensão: um fundo MV3 funcionaria
  //     no Chrome e calaria-se exatamente na janela onde o dono joga.
  //   - o **preflight** daquele servidor devolve `501 Not Implemented` → um POST com
  //     `application/json` morre antes de sair. Com `x-www-form-urlencoded` é pedido simples.
  assert.match(codigo, /'Content-Type': 'application\/x-www-form-urlencoded'/);
  assert.ok(!/application\/json/.test(codigo), 'JSON pediria preflight, e o preflight dá 501');
  assert.match(codigo, /new URLSearchParams\(\{/);
  const manifest = JSON.parse(ler('manifest.json'));
  assert.ok(!manifest.background, 'nada de service worker: Electron não o corre');
  assert.ok(!manifest.host_permissions, 'o CORS do Telegram já permite; não se pede permissão a mais');
  // E ela carrega antes de quem a usa.
  const isolado = manifest.content_scripts.find((b) => b.js.includes('expedicao.js'));
  assert.ok(isolado.js.indexOf('telegram.js') < isolado.js.indexOf('expedicao.js'));
});

test('o token e um segredo: nao vai para o localStorage nem para o exportar', () => {
  // O `localStorage` é da origem do jogo, e o JavaScript da página lê-o. Com o token manda-se
  // mensagem em nome do bot: é senha, e mora onde mora a do login — `chrome.storage.local`.
  assert.match(codigo, /chrome\.storage && chrome\.storage\.local/);
  assert.ok(!/localStorage/.test(codigo));
  // E não viaja no arquivo de configuração: só o liga-desliga viaja.
  const coletar = painel.slice(painel.indexOf('coletar: () => ({'), painel.indexOf('aplicar: (d)'));
  assert.match(coletar, /recado: cfg\.recado === true,/);
  assert.ok(!/token|chat/.test(coletar), 'o token não entra no exportar');
  // O campo nunca é repovoado com o valor guardado: um campo de senha reescrito é um segredo que
  // qualquer print lê de novo.
  assert.match(painel, /token\.value = '';/);
  assert.match(painel, /guardado — escreva outro para trocar/);
});

test('o token nunca aparece numa mensagem de erro', () => {
  // O Telegram devolve a URL em alguns erros, e a URL tem o token dentro. Escrever isso no painel
  // entregava o segredo a quem passasse pelo ecrã.
  const { semSegredo } = carregar();
  const token = '123456789:AAbbccddeeffgghhiijjkkllmmnnoopp';
  assert.equal(
    semSegredo(`falhou https://api.telegram.org/bot${token}/sendMessage`, token),
    'falhou https://api.telegram.org/bot…/sendMessage',
  );
  // Com caracteres que valem num regex: o token é escapado antes de virar padrão.
  assert.equal(semSegredo('erro a-b.c+d', 'a-b.c+d'), 'erro …');
});

test('a forma do token e conferida antes de guardar', () => {
  const { FORMA } = carregar();
  assert.ok(FORMA.test('123456789:AAbbccddeeffgghhiijjkkllmmnnoopp'));
  assert.ok(!FORMA.test('123456789'), 'sem a parte secreta não é token');
  assert.ok(!FORMA.test('cole aqui o token'));
  assert.match(codigo, /não tem a forma de um token de bot/);
  // Token vazio **apaga**: sem isso, um campo que nunca mostra o valor seria um segredo que entra
  // e não sai.
  assert.match(codigo, /token: String\(token \?\? ''\)\.trim\(\),/);
});

test('o recado avisa e nao responde nada', () => {
  // A linha onde esta ferramenta para. O recado diz que a janela abriu e que a verificação espera;
  // não existe aqui nenhum caminho que a resolva, e é isso que este teste guarda — o mesmo guarda
  // que está no `expedicao.test.mjs` para o `setExpeditionReady`.
  assert.ok(!/captcha|setExpeditionReady|ready/i.test(codigo), 'o recado não toca na verificação');
  assert.match(painel, /é com você/);
  // Um recado por janela, e não um a cada batida de meio minuto.
  assert.match(painel, /janelaAvisada !== r\.fecha/);
  assert.match(painel, /janelaAvisada = r\.fecha \|\| '';/);
  // Ligar de novo não reaproveita o "já avisei" de uma janela que ele não viu.
  const liga = painel.slice(painel.indexOf("campo('[data-recado]').addEventListener"));
  assert.match(liga.slice(0, 400), /janelaAvisada = '';/);
  // E não pede a vez: nada aqui toca no jogo, e um recado não pode ficar atrás de uma caçada.
  assert.ok(!/PPX\?\.vez|esperarAVez/.test(codigo));
});
