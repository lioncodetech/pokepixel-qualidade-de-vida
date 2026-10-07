// Guardas da arrumação das janelinhas do próprio pacote, e da exportação em arquivo.
//
// O comportamento está medido em `testes/banca-layout-pacote.html`, que move painéis de verdade e
// prova que eles voltam ao lugar sem recarregar a página. O que mora aqui são as decisões que um
// refactor desfaz sem perceber — e que, desfeitas, só aparecem como "o painel sumiu" ou, pior,
// como uma chave estranha escrita no armazenamento do jogo.
//
// Rode com: node --test testes/*.test.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const ler = (nome) => readFileSync(new URL(`../${nome}`, import.meta.url), 'utf8');
const layout = ler('layout-padrao.js');

test('as janelinhas do pacote entram na fotografia', () => {
  // Cada ferramenta guarda o canto dela numa chave sua, todas no mesmo padrão. É por isso que
  // arrumar as nossas janelas não precisou de uma linha em nenhuma das dez.
  assert.match(layout, /const CHAVES_PACOTE = \/\^lioncode:/);
  assert.match(layout, /if \(CHAVES_PACOTE\.test\(chave\)\) \{/);
  // Lido, e não como texto cru: é o que permite conferir campo a campo na volta.
  assert.match(layout, /if \(cantoValido\(valor\)\) perfil\.pacote\[chave\] = valor;/);
});

test('o que vem de fora nao escolhe a chave onde se escreve', () => {
  // A regra 3 do AGENTS.md, e aqui ela pesa mais que nas outras ferramentas: este perfil já carrega
  // chaves do próprio jogo, e o arquivo pode ter sido montado à mão.
  const bloco = layout.slice(layout.indexOf('function arrumarPacote'));
  const dentro = bloco.slice(0, bloco.indexOf('\n    }'));
  assert.match(dentro, /if \(!CHAVES_PACOTE\.test\(chave\) \|\| !cantoValido\(valor\)\) continue;/);
  // E o mesmo vale para as chaves do jogo, que até aqui eram escritas de volta sem conferência.
  const jogo = layout.slice(layout.indexOf('function aplicarNoJogo'));
  assert.match(
    jogo.slice(0, jogo.indexOf('\n    }')),
    /if \(!CHAVES_JOGO\.test\(chave\) \|\| typeof valor !== 'string'\) continue;/,
  );
});

test('o automatico nao mexe nos cantos do pacote', () => {
  // `arrumar(..., { soNovos: true })` roda a cada janela do jogo que abre e a cada vez que a tela
  // muda de tamanho. Escrever os cantos ali brigaria com quem está arrastando um painel naquele
  // instante — e o `resize` do fim sairia de dentro do próprio tratador de `resize`: laço.
  const bloco = layout.slice(layout.indexOf('function arrumar(perfil'));
  assert.doesNotMatch(bloco.slice(0, bloco.indexOf('\n    }')), /arrumarPacote|CHAVES_PACOTE/);
  // Os dois únicos chamadores são o botão e a troca de layout, que são as vezes em que se pediu.
  assert.equal(layout.match(/\+ arrumarPacote\(perfil\)/g)?.length, 2);
});

test('arrumar o pacote dispensa o F5', () => {
  // As dez ferramentas já recolocam o painel quando a tela muda de tamanho. Avisar uma vez põe
  // todas no lugar; sem isto, o canto novo só valeria na carga seguinte e o botão pareceria morto.
  const bloco = layout.slice(layout.indexOf('function arrumarPacote'));
  assert.match(bloco.slice(0, bloco.indexOf('\n    }')), /if \(n\) dispatchEvent\(new Event\('resize'\)\);/);
});

test('a caixa da senha fica de fora, e o codigo diz por que', () => {
  // Ela guarda a posição em `chrome.storage.local` — outro armazenamento, assíncrono, que não
  // aparece no `localStorage`. Não há o que ler daqui, e a ausência precisa estar explicada.
  assert.doesNotMatch(layout, /pp-senha-pos/);
  assert.match(layout, /chrome\.storage\.local/);
});

test('exportar passa pelo config.js, como as outras', () => {
  // A regra do AGENTS.md: os dois botões vêm de `PPX.config`, e quem decide o que entra e o que sai
  // é a ferramenta. O texto colado continua ao lado, para quem está com as duas janelas abertas.
  assert.match(layout, /PPX\?\.config\?\.montarBotoes\(\{/);
  assert.match(layout, /id: 'layout-padrao'/);
  assert.match(layout, /throw new Error\('não há layout salvo/);
  assert.match(layout, /throw new Error\('esse arquivo não tem layout nenhum dentro'\)/);
  assert.match(layout, /\[data-copiar\]/, 'o texto colado continua existindo');
});
