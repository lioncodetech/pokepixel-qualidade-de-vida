// Guardas dos botões de login.
//
// A parte viva está em `testes/banca-senha.html`, onde há um `chrome.storage` de mentira que se
// pode estragar de propósito — é lá que o defeito foi reproduzido antes de ser consertado. O que
// se protege aqui são as decisões que vieram dessa medição.
//
// Rode com: node --test testes/*.test.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const ler = (arquivo) => readFileSync(new URL(`../${arquivo}`, import.meta.url), 'utf8');
const senha = ler('senha.js');
const codigo = senha
  .split('\n')
  .filter((linha) => !/^\s*(\/\/|\*|\/\*)/.test(linha))
  .join('\n');

test('a extensao recarregada e reconhecida, e nao so sentida como um erro qualquer', () => {
  // **O defeito, reproduzido em `?api=morta`.** Recarregar a extensão não mexe nas abas já
  // abertas: o content script continua na tela e perde a ligação. Daí em diante toda chamada a
  // `chrome.storage` atira `Extension context invalidated.` — era isso que aparecia no botão,
  // com a senha digitada a não ir para lado nenhum.
  //
  // `chrome.runtime.id` é o sinal canônico: existe enquanto a ligação existe.
  assert.match(codigo, /const extensaoMorta = \(\) =>\s*Boolean\(api\) && !globalThis\.chrome\?\.runtime\?\.id/);
  assert.match(codigo, /const eraOContexto = \(e\) => \/context invalidated\/i\.test/);
  // E o pedido nem chega a ser feito quando já se sabe que vai falhar.
  assert.match(codigo, /if \(extensaoMorta\(\)\) return falhou\(/);
});

test('o aviso da extensao morta fica, e diz o que fazer', () => {
  // Um recado de 2,5 s serve para "colado" ou "sem campo": some e a pessoa segue. Não serve aqui,
  // porque nada nesta aba volta a funcionar até haver um F5 — e um aviso que desaparece convida a
  // tentar de novo, que foi o que aconteceu.
  const bloco = codigo.slice(codigo.indexOf('const avisarMorta ='), codigo.indexOf('const comAviso'));
  assert.match(bloco, /recarregue a página \(F5\)/);
  assert.match(bloco, /clearTimeout\(voltas\.get\(alvo\)\)/);
  assert.doesNotMatch(bloco, /setTimeout/, 'o aviso da extensão morta não pode ter volta');
  // E diz o que fazer em vez de citar o navegador: "Extension context invalidated" não é uma
  // instrução para ninguém.
  assert.doesNotMatch(bloco, /Extension context invalidated/);

  // Chega antes de a pessoa digitar: na tela de login é quando a caixa aparece que dá para avisar.
  assert.match(codigo, /if \(deveAparecer && extensaoMorta\(\)\) avisarMorta\(botao\);/);
  // E também quando a falha vem de uma chamada.
  assert.match(codigo, /if \(extensaoMorta\(\) \|\| eraOContexto\(e\)\) return avisarMorta\(alvo\);/);
});

test('um erro ao guardar nao leva embora o que foi digitado', () => {
  // Fechar os campos apagava a senha recém-digitada por cima de um erro que já dizia que nada
  // tinha sido guardado: ela sumia da tela e do armazenamento ao mesmo tempo, e só restava
  // digitar tudo outra vez para falhar outra vez.
  const enter = codigo.slice(codigo.indexOf("entrada.addEventListener('keydown'"));
  const bloco = enter.slice(0, enter.indexOf('});'));
  assert.match(bloco, /await salvarCampos\(\)/);
  assert.match(bloco, /catch/);
  assert.doesNotMatch(bloco, /fecharCampos\(\)/, 'o catch do Enter não pode fechar os campos');
});

test('o armazenamento tem prazo: calado tambem e uma falha', () => {
  // Com a ligação caída há chamadas que não atiram — simplesmente nunca chamam de volta. Sem
  // prazo o `await` ficava pendurado para sempre e o botão não dizia nada, que é a mesma falha
  // silenciosa que o comentário do topo do ficheiro já descrevia por outro caminho. Medido em
  // `?api=muda`: o botão passa a dizer "o armazenamento não respondeu".
  assert.match(codigo, /const PACIENCIA = 5000;/);
  assert.match(codigo, /setTimeout\(\(\) => falhou\(new Error\('o armazenamento não respondeu'\)\), PACIENCIA\)/);
  // E quem responde dentro do prazo não pode ser derrubado por ele depois.
  assert.match(codigo, /clearTimeout\(prazo\);\s*\n\s*ok\(valor\);/);
  assert.match(codigo, /clearTimeout\(prazo\);\s*\n\s*falhou\(e\);/);
});

test('a senha continua fora do alcance da pagina do jogo', () => {
  // **A regra que o conserto não podia quebrar.** `chrome.storage` é da extensão; o localStorage
  // é da origem, e a página do jogo lê tudo o que estiver lá. Cair para o localStorage quando o
  // chrome.storage falha pareceria resiliência e seria duas coisas ruins ao mesmo tempo: a senha
  // passaria a ser legível pelo jogo, e a carga seguinte — já com a extensão viva — leria do
  // chrome.storage e diria "nada guardado".
  //
  // Então o localStorage só entra onde nunca houve extensão nenhuma: a banca, e mais nada.
  const guardar = codigo.slice(codigo.indexOf('const guardar ='), codigo.indexOf('const ler ='));
  assert.match(guardar, /if \(api\) return pedir\('set'/);
  assert.match(guardar, /localStorage\.setItem/);
  // Nenhum caminho escreve nos dois.
  assert.doesNotMatch(guardar, /catch/);
});
