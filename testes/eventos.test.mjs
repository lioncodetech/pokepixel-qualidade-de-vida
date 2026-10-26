import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Lido sem os \r: a arvore de trabalho do Windows vem em CRLF e a da CI em LF, e um guarda que
// casa duas linhas seguidas da' fonte so' falhava de um dos lados. Oito deles, em 26/10/2026.
const ler = (nome) =>
  readFileSync(new URL(`../${nome}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const codigo = ler('eventos.js');
const ponte = ler('eventos-main.js');
const manifest = JSON.parse(ler('manifest.json'));

test('Eventos entra no pacote e a ponte carrega no mundo da pagina', () => {
  const isolado = manifest.content_scripts.find((b) => b.js.includes('eventos.js'));
  const principal = manifest.content_scripts.find((b) => b.world === 'MAIN');
  assert.ok(isolado, 'eventos.js está no pacote');
  assert.ok(principal?.js.includes('eventos-main.js'), 'a ponte de eventos está no mundo MAIN');
  assert.ok(isolado.js.indexOf('agenda.js') < isolado.js.indexOf('eventos.js'), 'o calendário carrega antes');
  assert.match(ler('nucleo.js'), /id: 'eventos', nome: 'Eventos'/);
});

test('o Halloween resgata todas as metas concluidas e ainda nao resgatadas', () => {
  for (const meta of ['kills', 'captures', 'costume_captures']) assert.match(ponte, new RegExp(`['"]${meta}['"]`));
  assert.match(ponte, /!resgatadas\.has\(meta\).*Number\(dia\?\.\[meta\]\) >= LIMITES\[meta\]/s);
  assert.match(ponte, /evento\.open\(\)/);
  assert.match(ponte, /\/missões\|missions\/i/);
  assert.match(ponte, /\^resgatar\$\/i/);
  assert.match(ponte, /botao\.click\(\)/);
});

test('cada clique espera a tela redesenhar antes de procurar o proximo', () => {
  assert.match(ponte, /await espera\(intervalo\)/);
  assert.match(ponte, /b\.disabled && \/\^resgatar\$\/i/);
  assert.match(codigo, /pausa entre cliques/);
});

test('o proximo evento entra como adaptador no mesmo painel e relogio', () => {
  assert.match(ponte, /const EVENTOS = \[halloween\]/);
  assert.match(ponte, /for \(const evento of EVENTOS\)/);
  assert.match(ponte, /id: 'halloween-2026'/);
});

test('a hora diaria usa o calendario compartilhado e so um minuto de janela', () => {
  assert.match(codigo, /PPX\?\.agenda/);
  assert.match(codigo, /esperaDaAgenda\(\{ horarios: janelaDaHora\(cfg\.hora\) \}, cfg\.ultima\)/);
  assert.match(codigo, /const fim = \(minutos \+ 1\) % 1440/);
  assert.match(codigo, /cfg\.ultima = Date\.now\(\)/);
});

test('a automacao pede e solta a fila', () => {
  assert.match(codigo, /const MINHA_VEZ = 'eventos'/);
  assert.match(codigo, /soltar = await esperarAVez\(dizer\)/);
  assert.match(codigo, /if \(soltar\) soltar\(\)/);
});

test('exporta a escolha, mas nao o carimbo da ultima rodada', () => {
  assert.match(codigo, /coletar: \(\) => \(\{/);
  assert.match(codigo, /worldBossTime: cfg\.worldBossTime/);
  assert.doesNotMatch(codigo, /coletar:.*ultima/);
});

test('World Boss usa o estado oficial e entra pelo botao mapeado', () => {
  assert.match(ponte, /getWorldBoss\(true\)/);
  assert.match(ponte, /live_raid_v2/);
  assert.match(ponte, /\.worldboss-live-entry \.wb-live-scene__enter/);
  assert.match(ponte, /botao\.click\(\)/);
  assert.match(codigo, /estadoWorldBoss/);
  assert.match(codigo, /entrarWorldBoss/);
});

test('World Boss pausa a cacada e confirma a cidade antes de abrir a raid', () => {
  const corpo = ponte.slice(ponte.indexOf('const entrarWorldBoss'), ponte.indexOf('const FAZ'));
  const cidade = corpo.indexOf('await irParaCidade()');
  const abrir = corpo.indexOf('SceneManager.push');
  assert.ok(cidade >= 0 && abrir > cidade, 'a cidade vem antes da tela da raid');
  assert.doesNotMatch(ponte, /api\.stopHunt\s*\(/);
  assert.match(ponte, /await nav\.goToCity\(\)/);
  assert.match(ponte, /await ate\(naCidade, 15000\)/);
});

test('ao terminar o World Boss restaura o time e retoma a cacada de origem', () => {
  assert.match(codigo, /CHAVE_WB_RETORNO/);
  assert.match(codigo, /const origem = globalThis\.PPX\?\.cacadas\?\.atual/);
  assert.match(codigo, /const timeOrigem = globalThis\.PPX\?\.times\?\.qual/);
  const corpo = codigo.slice(codigo.indexOf('const retomarDepoisDoWorldBoss'), codigo.indexOf('const verificarWorldBoss'));
  const time = corpo.indexOf('times?.usar?.(retorno.time)');
  const cacada = corpo.indexOf('cacadas?.ir?.(retorno.cacada)');
  assert.ok(time >= 0 && cacada > time, 'restaura o time antes de retomar a caçada');
  assert.match(codigo, /retornoWorldBoss\(\) && !lido\?\.emRaid/);
});

test('World Boss monta o time escolhido somente depois de chegar a cidade', () => {
  assert.match(codigo, /data-world-boss-time/);
  assert.match(codigo, /PPX\?\.times\?\.nomes\?\.\(\)/);
  const corpo = codigo.slice(codigo.indexOf("linha.textContent = 'World Boss: voltando"), codigo.indexOf("const entrou = await ponte('entrarWorldBoss')"));
  const cidade = corpo.indexOf('await pausarCacadaEIrParaCidade()');
  const time = corpo.indexOf('await times.usar(cfg.worldBossTime)');
  assert.ok(cidade >= 0 && time > cidade, 'chega à cidade antes de montar o time');
  assert.match(ponte, /irCidadeWorldBoss: irParaCidade/);
});

test('World Boss nao repete entrada confirmada nem posicao na fila', () => {
  assert.match(codigo, /if \(lido\.participando\)/);
  assert.match(codigo, /if \(lido\.fila > 0\)/);
  assert.match(codigo, /setTimeout\(\(\) => void verificarWorldBoss\(\), 30000\)/);
});

test('a ponte espera haver quem ouca antes de falar', () => {
  // **MEDIDO NO JOGO LOGADO EM 26/10/2026, E FALHAVA EM TODO CARREGAMENTO.** O manifest corre o
  // bloco ISOLATED inteiro antes do bloco MAIN — os dois em `document_idle` —, então o pedido do
  // arranque (`void atualizar()`) era disparado antes de `eventos-main.js` instalar o
  // `addEventListener(PEDIDO)`. Um `CustomEvent` sem ninguém a escutar **não fica em fila**:
  // perde-se. O painel esperava os 60 s, dizia "Nenhum evento suportado respondeu" e só tentava
  // outra vez na hora marcada. Encontrado com onze dias de recompensas por resgatar no jogo.
  //
  // Reproduzido assim: recarregar a página dava sempre a falha; disparar o mesmo pedido à mão
  // segundos depois respondia na hora, com a lista completa.
  assert.match(
    codigo,
    /const pontePronta = \(\) =>\s+ate\(\(\) => document\.documentElement\.dataset\.lioncodeEventos === 'pronto', \d+\)/,
  );
  // **A marca fica no DOM, e não num evento.** Um "já estou aqui" disparado como evento teria o
  // mesmo defeito ao contrário — perder-se-ia se o outro lado ainda não escutasse. Um atributo
  // fica posto: quem chegar depois lê-o na mesma.
  assert.match(ponte, /document\.documentElement\.dataset\.lioncodeEventos = 'pronto';/);
  const fim = ponte.slice(ponte.indexOf('addEventListener(PEDIDO'));
  assert.ok(
    fim.indexOf("dataset.lioncodeEventos = 'pronto'") > 0,
    'a marca é posta DEPOIS de o ouvinte existir, senão ela mente',
  );
  // E todo pedido passa pela espera — inclusive o `resgatar`. Por isso a correção é esperar, e
  // nunca re-disparar: um `resgatar` repetido resgataria duas vezes.
  assert.match(codigo, /const ponte = async \(acao, dados = \{\}\) => \{\s+if \(!\(await pontePronta\(\)\)\)/);
  assert.match(codigo, /return pedirAoJogo\(acao, dados\);/);
});

test('sem ter lido os eventos o painel nao diz zero', () => {
  // Era o que escondia o defeito da ponte: "0 recompensa(s) pronta(s)" com onze dias de
  // recompensas lá dentro. Zero e "ainda não sei" são coisas diferentes, e só uma delas é
  // verdade quando a leitura falhou. É a mesma regra das outras ferramentas: o número que se
  // mostra é o que se leu, e o que não se leu não se inventa.
  const bloco = codigo.slice(codigo.indexOf('const desenhar = () => {'));
  const corpo = bloco.slice(0, bloco.indexOf('\n    };'));
  assert.match(corpo, /const pendentes = estadoVisto\s+\? \(estadoVisto\.eventos \|\| \[\]\)\.reduce/);
  assert.match(corpo, /: null;/);
  assert.match(corpo, /pendentes === null\s+\? `ainda não li os eventos/);
});

test('a aba das missoes e procurada com paciencia, porque chega depois da janela', () => {
  // **MEDIDO NO JOGO LOGADO EM 26/10/2026**, com a janela fechada e reaberta para cronometrar: a
  // `.seasonal-window` aparece aos **46 ms** e o primeiro `.seasonal-nav button` só aos **409 ms**.
  // O código procurava a aba na volta seguinte à janela, não achava nada, e o resgate morria com
  // "não achei a aba Missões diárias" — com onze dias de recompensas por resgatar no jogo. O
  // seletor estava certo o tempo todo; o que faltava era esperar.
  //
  // Sexta ocorrência desta lição nesta extensão: a loja do Mark, o inventário e as caçadas já
  // tinham passado por ela. Este adaptador nasceu sem ela.
  const abrir = ponte.slice(ponte.indexOf('async abrir()'));
  const corpo = abrir.slice(0, abrir.indexOf('async resgatarVisivel'));
  assert.match(
    corpo,
    /const missoes = await ate\(\(\) =>\s+\[\.\.\.janela\.querySelectorAll\('\.seasonal-nav button'\)\]\.find/,
  );
  // A janela e o conteúdo já esperavam; a aba, no meio dos dois, é que não esperava.
  assert.match(corpo, /const janela = await ate\(\(\) => document\.querySelector\('\.seasonal-window'\)\)/);
  assert.match(corpo, /const conteudo = await ate\(\(\) => janela\.querySelector\('\.seasonal-content'\)\)/);
});
