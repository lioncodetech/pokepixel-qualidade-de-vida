import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Lido sem os \r: a arvore de trabalho do Windows vem em CRLF e a da CI em LF, e um guarda que
// casa duas linhas seguidas da' fonte so' falhava de um dos lados. Oito deles, em 26/10/2026.
const ler = (nome) =>
  readFileSync(new URL(`../${nome}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const codigo = ler('rampage.js');
const ponte = ler('rampage-main.js');

test('Rampage entra no pacote e na fila compartilhada', () => {
  const manifest = JSON.parse(ler('manifest.json'));
  const isolado = manifest.content_scripts.find((b) => b.js.includes('arena.js'));
  const principal = manifest.content_scripts.find((b) => b.world === 'MAIN');
  assert.ok(isolado.js.includes('rampage.js'));
  assert.ok(principal.js.includes('rampage-main.js'));
  assert.match(ler('nucleo.js'), /id: 'rampage', nome: 'Rampage'/);
  assert.match(codigo, /const MINHA_VEZ = 'rampage';/);
  assert.match(codigo, /soltar = await esperarAVez\(dizer\);/);
  assert.match(codigo, /if \(soltar\) soltar\(\);/);
});

test('estado e disponibilidade vêm da API do jogo', () => {
  assert.match(ponte, /getRampage\(true\)/);
  assert.match(ponte, /restantes: Math\.max\(0, Number\(d\.attempts_remaining\)/);
  assert.match(codigo, /estadoVisto\.restantes < 1/);
  assert.doesNotMatch(codigo, /2\s*\*\s*24\s*\*\s*60/);
  assert.match(codigo, /modo === 'live_v1' \|\| modo === 'cinematic_v1'/);
  assert.match(codigo, /\.worldboss-map-result/);
  assert.match(codigo, /pokeidle-worldboss-map/);
});

test('o time é montado antes de gastar a tentativa', () => {
  const trecho = codigo.slice(codigo.indexOf('const executar = async'));
  assert.ok(trecho.indexOf('times.usar(cfg.time)') < trecho.indexOf('entrar.click()'));
  assert.match(trecho, /const entrar = await ate/);
  assert.match(trecho, /\.worldboss-mmo__enter/);
});

test('vai para a cidade antes de montar o time e entrar no Rampage', () => {
  const cidade = codigo.indexOf('await irParaCidade()');
  const time = codigo.indexOf('times.usar(cfg.time)');
  const entrar = codigo.indexOf('entrar.click()');
  assert.ok(cidade >= 0 && cidade < time && time < entrar);
  assert.match(codigo, /VOLTAR .{1,2} CIDADE/i);
});

test('placar por evento pode ser corrigido e é marcado após o resultado', () => {
  assert.match(codigo, /lioncode:rampage:placar/);
  assert.match(codigo, /data-status/);
  assert.match(codigo, /marcarAtacado\(!foiAtacado\(\), true\)/);
  assert.match(codigo, /marcarAtacado\(true, false\)/);
  assert.match(codigo, /Este Rampage está marcado como atacado/);
});

test('espera o mapa cinematográfico terminar antes de restaurar time e caçada', () => {
  const esperaVolta = codigo.indexOf('await esperarVoltaDoRampage(estadoVisto.modo)');
  const restauraTime = codigo.indexOf('times?.usar?.(timeOrigem)');
  const restauraCacada = codigo.indexOf('cacadas?.ir?.(origem.nome)');
  assert.ok(esperaVolta >= 0 && esperaVolta < restauraTime && restauraTime < restauraCacada);
  assert.match(codigo, /!document\.body\.classList\.contains\('pokeidle-worldboss-map'\)/);
  assert.match(codigo, /document\.querySelector\('\.worldboss-mmo'\)/);
});

test('expedição não é interrompida e a luta tem parada segura', () => {
  assert.match(codigo, /if \(naExpedicao\(\)\) return dizer/);
  assert.match(codigo, /if \(correndo\) \{ parar = true;/);
  assert.match(codigo, /mover', ligado: false/);
});

test('configuração exportada não leva estado da conta', () => {
  const coleta = codigo.slice(codigo.indexOf('coletar: () =>'));
  const fim = coleta.slice(0, coleta.indexOf('aplicar:'));
  assert.match(fim, /horarios/);
  assert.match(fim, /time/);
  assert.doesNotMatch(fim, /ultimoEvento|estadoVisto|restantes/);
});

test('a ponte espera haver quem ouca antes de falar', () => {
  // **A MESMA CORRIDA DOS EVENTOS, ENCONTRADA NO JOGO LOGADO EM 26/10/2026.** O manifest corre o
  // bloco ISOLATED inteiro antes do bloco MAIN — os dois em `document_idle` —, então o pedido do
  // arranque sai antes de a outra ponta instalar o `addEventListener(PEDIDO)`. Um `CustomEvent`
  // sem ninguém a escutar **não fica em fila**: perde-se, e o painel culpava o jogo por uma coisa
  // que era de ordem de carregamento.
  //
  // **A marca fica no DOM, e não num evento**, porque o DOM é a única coisa que os dois mundos
  // partilham; um "já estou aqui" disparado como evento teria o mesmo defeito ao contrário.
  // **Espera-se, nunca se re-dispara**: re-disparar serviria a leitura e estragaria uma ação.
  assert.match(codigo, /dataset\.lioncodeRampage === 'pronto'/);
  assert.match(ponte, /document\.documentElement\.dataset\.lioncodeRampage = 'pronto';/);
  const fim = ponte.slice(ponte.indexOf('addEventListener(PEDIDO'));
  assert.ok(
    fim.indexOf("dataset.lioncodeRampage = 'pronto'") > 0,
    'a marca é posta DEPOIS de o ouvinte existir, senão ela mente',
  );
  assert.match(codigo, /a ponte com o jogo não carregou — recarregue a página \(F5\)/);
});

test('o dano de um ataque e a diferenca, porque o jogo nao da o do ataque', () => {
  // **MEDIDO NA CONTA DO DONO EM 26/10/2026, NO ARTICUNO.** A API do Rampage dá `personal_damage`
  // — o acumulado do dono NAQUELE evento — e `attempts_used`; não existe histórico por ataque.
  // Na medição: `personal_damage` 0 antes do ataque e 575 depois, `attempts_used` 0 → 1, e o HP do
  // chefe caiu **exatamente 575** no mesmo intervalo. Logo a diferença entre duas leituras é o
  // dano daquele ataque, e é a única medida que existe.
  //
  // O `RampageLiveArena.result` foi considerado e **não serve**: naquele evento o modo era
  // `cinematic_v1` e a arena ao vivo ficou inativa do princípio ao fim, com `result` nulo.
  assert.match(ponte, /dano: Math\.max\(0, Number\(d\.personal_damage\) \|\| 0\),/);
  assert.match(codigo, /const danoAntes = Number\(estadoVisto\?\.dano\);/);
  // A leitura de ANTES fica antes de abrir o Rampage: daí para a frente todo caminho que acabe em
  // ataque passa pelo mesmo ponto, e um ataque sem par de leituras fica sem dano em vez de ficar
  // com um número errado.
  const corpo = codigo.slice(codigo.indexOf('const danoAntes'), codigo.indexOf("dizer('Ataque registrado.')"));
  assert.ok(
    corpo.indexOf('const danoAntes') < corpo.indexOf("dizer('Abrindo o Rampage…')"),
    'a leitura de antes acontece antes de abrir',
  );
  assert.match(corpo, /dano: mediu === null \? null : depois - danoAntes,/);
});

test('o numero pode demorar, entao espera-se por ele em vez de ler uma vez', () => {
  // Medido: o `personal_damage` sobe depois de a luta fechar, não no instante do último golpe. Ler
  // uma vez só daria zero de vez em quando — e um zero guardado como dano seria pior do que não
  // guardar nada, porque ficaria no histórico a dizer que o ataque não fez nada.
  const corpo = codigo.slice(codigo.indexOf('const danoAntes'), codigo.indexOf("dizer('Ataque registrado.')"));
  assert.match(corpo, /const mediu = await ate\(async \(\) => \{/);
  // **E relê-se o estado a cada volta.** Olhar sempre para a mesma leitura faria a espera passar o
  // tempo todo a perguntar a uma fotografia.
  assert.match(corpo, /const lido = await estado\(\);/);
  assert.match(corpo, /if \(lido\?\.ok\) estadoVisto = lido;/);
  // E o ajudante tem de aguardar a condição: uma Promise é sempre verdadeira, e sem o `await` a
  // espera dava por cumprida a primeira pergunta que fizesse.
  assert.match(codigo, /const r = await fn\(\);/);
});

test('um ataque sem medida fica "nao medi", e nunca zero', () => {
  // Zero e "não sei" são coisas diferentes, e só uma delas é verdade quando a leitura não veio. É
  // a mesma regra que o painel dos Eventos passou a seguir no mesmo dia, depois de ele ter dito
  // "0 recompensas prontas" com onze dias por resgatar.
  assert.match(codigo, /a\.dano === null \|\| a\.dano === undefined \? 'não medi' : danoEmTexto\(a\.dano\)/);
  assert.match(codigo, /quanto\.className = 'semMedida'/);
});

test('o historico guarda dez, e nao cresce sem fim', () => {
  // Dez é o que cabe no painel sem o tornar uma lista de rolar. O corte é feito **na escrita e na
  // leitura**: só na escrita, uma chave que viesse de outra janela com cinquenta entradas passaria.
  assert.match(codigo, /const QUANTOS_GUARDO = 10;/);
  assert.match(codigo, /return Array\.isArray\(lido\) \? lido\.slice\(0, QUANTOS_GUARDO\) : \[\];/);
  assert.match(codigo, /\[registo, \.\.\.historico\(\)\]\.slice\(0, QUANTOS_GUARDO\)/);
  // O mais recente entra na frente: é o que se quer ver primeiro.
  assert.match(codigo, /const todos = \[registo, \.\.\.historico\(\)\]/);
});
