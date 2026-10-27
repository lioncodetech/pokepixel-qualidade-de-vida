// Guardas do relogio do servidor, no topo do menu.
//
// A hora e' do **servidor**, lida do jogo, e nao do relogio da maquina. E nao ha' caixinha de
// horario de verao: o jogo diz o fuso em que vive e o `Intl` sabe sozinho em que lado do ano
// aquele fuso esta' — ver `testes/banca.html` para o menu montado.
//
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Lido sem os \r: a arvore de trabalho do Windows vem em CRLF e a da CI em LF, e um guarda que
// casa duas linhas seguidas da' fonte so' falhava de um dos lados.
const ler = (arquivo) =>
  readFileSync(new URL(`../${arquivo}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const semComentarios = (fonte) =>
  fonte
    .split('\n')
    .filter((linha) => !/^\s*(\/\/|\*|\/\*)/.test(linha))
    .join('\n');
const menu = semComentarios(ler('nucleo.js'));
const ponte = semComentarios(ler('nucleo-main.js'));

test('a hora vem do servidor, e nao do relogio de quem olha', () => {
  // `getGameConfig()` devolve `server_time` em UTC — medido em 27/10/2026, `2026-10-27T21:03:45Z`.
  assert.match(ponte, /api\.getGameConfig\(\)/);
  assert.match(ponte, /server_time/);
  assert.match(ponte, /const servidor = Date\.parse\(/);
  // E sem hora nao se inventa uma: o relogio da maquina com o rotulo "servidor" parece certo e nao e'.
  assert.match(menu, /if \(desvioDaMaquina === null\)/);
  assert.match(menu, /'perguntando a hora…'/);
});

test('a viagem do pedido entra na conta', () => {
  // O carimbo do servidor foi feito algures entre o pedido sair e a resposta voltar. Tomar a
  // chegada como o instante do carimbo erraria por uma viagem inteira, sempre para o mesmo lado.
  assert.match(ponte, /const antes = Date\.now\(\);/);
  assert.match(ponte, /const depois = Date\.now\(\);/);
  assert.match(ponte, /medidoEm: Math\.round\(\(antes \+ depois\) \/ 2\)/);
  assert.match(menu, /desvioDaMaquina = r\.servidor - r\.medidoEm;/);
});

test('o fuso vem do jogo, e nao esta cravado no codigo', () => {
  // `getDailyLogin()` devolveu `America/Sao_Paulo` em 27/10/2026. Cravar isso aqui seria uma
  // mentira silenciosa no dia em que o jogo mudasse de casa.
  assert.match(ponte, /getDailyLogin/);
  assert.match(ponte, /timezone/);
  for (const [onde, fonte] of [
    ['nucleo.js', menu],
    ['nucleo-main.js', ponte],
  ])
    assert.ok(
      !/America\/Sao_Paulo/.test(fonte),
      `${onde} crava o fuso do servidor em vez de o perguntar ao jogo`,
    );
  // Sem fuso mostra-se UTC **e diz-se que e' UTC**, em vez de errar calado.
  assert.match(menu, /fusoDoServidor \|\| 'UTC'/);
  assert.match(menu, /' UTC'/);
});

test('nao ha caixinha de horario de verao, e e por isto', () => {
  // A diferenca sai de formatar o mesmo instante nos dois fusos — nunca de somar horas a' mao.
  assert.match(menu, /new Intl\.DateTimeFormat\('en-CA', \{/);
  assert.match(menu, /Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/);
  assert.ok(
    !/\bdesvioDaMaquina \+ 3600000|\+ 60 \* 60 \* 1000/.test(menu),
    'uma hora somada a mao e exactamente o que a caixinha seria',
  );
});

test('o relogio de parede do codigo acerta nos dois lados do ano', () => {
  // **A PROVA DE QUE A CAIXINHA NAO FAZ FALTA.** A mesma funcao que vai no menu, arrancada da
  // fonte, para os dois extremos: em Janeiro, Lisboa esta' em UTC+0 e Sao Paulo em UTC-3; em
  // Julho, Lisboa passa a UTC+1 e Sao Paulo fica onde estava. A diferenca muda sozinha, sem
  // ninguem marcar nada.
  const fonte = ler('nucleo.js');
  const inicio = fonte.indexOf('const relogioDeParede =');
  assert.ok(inicio > 0, 'a funcao continua a chamar-se relogioDeParede');
  const fim = fonte.indexOf('\n  };', inicio);
  const corpo = fonte.slice(inicio, fim + 5);
  const relogioDeParede = new Function(`${corpo} return relogioDeParede;`)();

  const diferenca = (quando) =>
    Math.round(
      (relogioDeParede(quando, 'America/Sao_Paulo') - relogioDeParede(quando, 'Europe/Lisbon')) /
        60000,
    );
  assert.equal(diferenca(Date.UTC(2026, 0, 15, 12)), -180, 'em Janeiro sao 3 h');
  assert.equal(diferenca(Date.UTC(2026, 6, 15, 12)), -240, 'em Julho sao 4 h');
});

test('o relogio so anda com o menu aberto', () => {
  // Um tique por segundo com o menu fechado e' trabalho que ninguem le'.
  assert.match(menu, /const moverORelogio = \(ligar\) => \{/);
  assert.match(menu, /clearInterval\(tiqueDaHora\);/);
  assert.match(menu, /moverORelogio\(aberto\);/);
  // Mas a primeira pergunta sai sozinha: quem abre o menu quer ver a hora, nao esperar por ela.
  assert.match(menu, /void sincronizarHora\(\);/);
});

test('um relogio de maquina errado e denunciado', () => {
  // Todos os horarios do pacote sao marcados pelo relogio desta maquina. Meio minuto ja' e' muito
  // para um reset que vira a' meia-noite em ponto, e quem nao for avisado culpa a ferramenta.
  assert.match(menu, /Math\.abs\(desvioDaMaquina\) >= 30000/);
  assert.match(menu, /atrasado|adiantado/);
});
test('a ponte do nucleo espera a API, como a das Raridades', () => {
  // **ESTE DEFEITO JA' TINHA SIDO CONSERTADO NAS RARIDADES NO MESMO DIA E FOI REPETIDO AQUI**,
  // apanhado no jogo logado em 27/10/2026: o menu montou-se antes de a API existir e a linha ficou
  // em "sem a hora do servidor" depois de ja' haver hora. Este guarda existe para a terceira ponte
  // nao repetir a segunda.
  assert.match(ponte, /const esperarApi = async \(\) => \{/);
  assert.match(ponte, /semApi: true,/);

  // A espera da ponte tem de caber DENTRO da paciencia de quem pergunta, senao o menu desiste
  // primeiro e escreve "o jogo nao respondeu", que e' a mensagem de outra falha.
  const daPonte = Number(/const ESPERA_DA_API = (\d+);/.exec(ponte)?.[1]);
  const doMenu = Number(/const PACIENCIA_HORA = (\d+);/.exec(menu)?.[1]);
  assert.ok(Number.isFinite(daPonte) && Number.isFinite(doMenu), 'os dois limites estao escritos');
  assert.ok(
    daPonte < doMenu,
    `a ponte espera ${daPonte} ms e o menu so' tem ${doMenu} ms de paciencia`,
  );

  // E o arranque insiste **so'** enquanto for "ainda nao ha' API".
  assert.match(menu, /if \(\(await sincronizarHora\(\)\) !== 'semApi'\) return;/);
  assert.match(menu, /void primeiraHora\(\);/);
  assert.ok(
    !/void sincronizarHora\(\);\n\n  if \(document\.body\)/.test(ler('nucleo.js')),
    'o arranque nao pode voltar a ser uma pergunta unica que desiste calada',
  );
  // Abrir o menu sem hora tambem volta a perguntar, sem esperar a ressincronia.
  assert.match(menu, /desvioDaMaquina === null \|\| Date\.now\(\) - ultimaSincronia >= RESSINCRONIZAR/);
});
