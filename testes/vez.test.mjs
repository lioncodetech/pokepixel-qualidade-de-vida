// Guardas da fila (`PPX.vez`).
//
// A parte viva está em `testes/banca-vez.html`, que atravessa um F5 de verdade — é lá que a
// travessia foi medida, nos dois sentidos: com a proteção, a vez continua do ginásio; sem ela, a
// banca acusa "é de: ninguém" e uma venda nova entra no meio da recarga.
//
// Rode com: node --test testes/*.test.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const ler = (arquivo) => readFileSync(new URL(`../${arquivo}`, import.meta.url), 'utf8');
const semComentarios = (texto) =>
  texto
    .split('\n')
    .filter((linha) => !/^\s*(\/\/|\*|\/\*)/.test(linha))
    .join('\n');

const nucleo = semComentarios(ler('nucleo.js'));
const gym = semComentarios(ler('gym.js'));
const venda = semComentarios(ler('venda-rapida.js'));
const loja = semComentarios(ler('loja-rapida.js'));

test('as tres ferramentas que agem sozinhas passam pela fila', () => {
  // Antes disto cada uma só se protegia de si mesma — a venda não começava duas vendas, o ginásio
  // não começava dois ginásios — e nenhuma sabia que as outras existiam. Com três relógios no ar,
  // o cruzamento não era hipótese: era questão de tempo.
  assert.match(nucleo, /vez: VEZ,/);
  for (const [nome, codigo, id] of [
    ['venda', venda, 'venda-rapida'],
    ['loja', loja, 'loja-rapida'],
  ]) {
    assert.match(codigo, new RegExp(`const MINHA_VEZ = '${id}'`), `${nome} não declara a sua vez`);
    assert.match(codigo, /soltar = await esperarAVez\(mostrar\)/, `${nome} não pede a vez`);
    assert.match(codigo, /if \(soltar\) soltar\(\);/, `${nome} não solta a vez`);
  }
  assert.match(gym, /soltarVez = await vez\.pedir\('gym'\)/);
});

test('a vez mora na sessionStorage, e isso nao e detalhe', () => {
  // Duas exigências ao mesmo tempo, e só a sessionStorage atende as duas: tem de sobreviver aos
  // dois F5 do ginásio (senão a venda entra no meio da recarga, que é o buraco a tapar) e tem de
  // ser por aba (o LionMultInstance abre várias janelas do jogo, e uma fila partilhada faria a
  // instância A esperar pela B sem razão nenhuma).
  const bloco = nucleo.slice(nucleo.indexOf('const lerVez ='), nucleo.indexOf('const fila = []'));
  assert.match(bloco, /sessionStorage\.getItem\(CHAVE_VEZ\)/);
  assert.match(bloco, /sessionStorage\.setItem\(CHAVE_VEZ/);
  assert.doesNotMatch(bloco, /localStorage/, 'a vez no localStorage faria uma janela esperar pela outra');
});

test('o ginasio nao solta a vez quando a pagina vai recarregar', () => {
  // **O ponto inteiro da fila.** O ginásio dá dois F5 por corrida. Soltar a vez ali abriria
  // exatamente a fresta que ela existe para fechar: a venda entrando entre a recarga e a retomada,
  // para morrer no F5 seguinte sem dizer nada.
  assert.match(gym, /recarregando = true;\s*\n\s*return;/);
  assert.match(gym, /if \(!recarregando\) largarVez\(\);/);
  // E o núcleo não limpa a vez ao sair da página quando há tarefa do ginásio a atravessar.
  assert.match(nucleo, /if \(vez && !localStorage\.getItem\('lioncode:gym:tarefa'\)\) gravarVez\(null\);/);
});

test('a vez abandonada nao prende a fila para sempre', () => {
  // Uma ferramenta que estourou no meio seguraria a fila até o fim da sessão. O sinal de vida é
  // uma batida; sem batida por tempo demais, a vez é dada por abandonada.
  //
  // O prazo tem de ser maior do que a recarga mais lenta do ginásio — durante o F5 ninguém bate, e
  // ele ainda espera a tela limpar (até 15 s). Curto demais, a venda rouba a vez no meio da
  // recarga; longo demais, um erro segura a fila.
  assert.match(nucleo, /const BATIDA = 2000;/);
  assert.match(nucleo, /const ABANDONO = 45000;/);
  assert.match(nucleo, /Date\.now\(\) - Number\(vez\.batida \|\| 0\) > ABANDONO/);
});

test('quem espera diz por quem espera', () => {
  // Um painel que espera é indistinguível de um painel travado. A venda pode ficar parada cinco
  // minutos enquanto o ginásio corre — tempo de sobra para alguém achar que a ferramenta quebrou.
  for (const codigo of [venda, loja])
    assert.match(codigo, /dizer\(`Esperando o \$\{vez\.nome\(dono\.id\)\} terminar…`\)/);
  assert.match(gym, /dizer\(`Esperando o \$\{vez\.nome\(dono\.id\)\} terminar…`\)/);
  // E o nome é o de mostrar, não o identificador interno: "esperando gym" não é frase nenhuma.
  assert.match(nucleo, /nome: \(id\) => CATALOGO\.find\(\(f\) => f\.id === id\)\?\.nome \|\| id/);
});

test('um nucleo sem fila nao impede as ferramentas de funcionar', () => {
  // As ferramentas são arquivos separados de propósito, e alguém pode ficar com uma mistura de
  // versões. Sem `PPX.vez`, cada uma segue como seguia antes — sem fila, mas viva.
  for (const codigo of [venda, loja])
    assert.match(codigo, /if \(!vez\?\.pedir\) return \(\) => \{\};/);
  assert.match(gym, /if \(!vez\?\.pedir\) return true;/);
});

// ---------------------------------------------------------------------------
// O guarda da regra, e não só do código que ela gerou.
//
// Elder pediu a fila como regra permanente: vale para qualquer automação daqui para a frente, não
// só para as três que existiam no dia. Uma regra que vive só no README é uma regra que a próxima
// ferramenta esquece — então ela vive aqui, onde o teste quebra.

import { readdirSync } from 'node:fs';

/** Ferramentas que agem no jogo por conta própria: estas TÊM de passar pela fila. */
const NA_FILA = ['venda-rapida.js', 'loja-rapida.js', 'gym.js'];

/**
 * Ferramentas que não agem sozinhas, com o motivo de cada uma.
 *
 * Não é uma lista de exceções: é uma lista de decisões. Pôr um arquivo aqui é afirmar que ele não
 * mexe no jogo sem alguém mandando — e quem afirmar isso errado vai descobrir pelo atropelo, não
 * por este teste.
 */
const FORA = {
  'nucleo.js': 'é a própria fila, e o menu',
  'nucleo-main.js': 'ponte para o mundo da página, não age',
  'agenda.js': 'calendário puro: diz quando, nunca age',
  'senha.js': 'só preenche campos quando a pessoa clica',
  'sem-grafico.js': 'esconde o desenho do jogo, não interage com ele',
  'ocultar-popups.js': 'fecha popups, não abre janela nem clica em ação do jogo',
  'layout-padrao.js': 'arruma as janelinhas, a pedido',
  'raridades.js': 'só lê a coleção pela API, não clica em nada',
  'raridades-main.js': 'só lê a coleção pela API, não clica em nada',
  'times.js': 'peça: quem chama (o ginásio) já tem a vez — pedir de novo daria impasse',
  'cacadas.js': 'peça: quem chama (o ginásio) já tem a vez — pedir de novo daria impasse',
};

test('toda ferramenta nova escolhe um lado da fila', () => {
  const arquivos = readdirSync(new URL('../', import.meta.url)).filter(
    (nome) => nome.endsWith('.js') && nome !== 'eslint.config.mjs',
  );
  for (const nome of arquivos) {
    if (NA_FILA.includes(nome)) {
      assert.match(
        ler(nome),
        /PPX\?\.vez|PPX\.vez/,
        `${nome} age sozinha no jogo e não pede a vez — ver AGENTS.md`,
      );
      continue;
    }
    assert.ok(
      FORA[nome],
      `${nome} é novo: declare-o em NA_FILA (se agir sozinho no jogo) ou em FORA, com o motivo. ` +
        'A fila vale para qualquer automação, não só para as três que existiam. Ver AGENTS.md.',
    );
  }
});

test('a regra esta escrita onde quem mexe no codigo tropeca nela', () => {
  // O README explica para quem usa; o AGENTS.md manda em quem escreve. A regra é permanente, e
  // deixá-la só numa conversa seria deixá-la sumir na próxima.
  const agentes = ler('AGENTS.md');
  assert.match(agentes, /Toda automação passa pela fila/);
  assert.match(agentes, /vale para toda automação\s+daqui para a frente/);
  assert.match(agentes, /não solta a vez antes do F5/);
  assert.match(ler('README.md'), /## A fila: uma ferramenta de cada vez/);
});
