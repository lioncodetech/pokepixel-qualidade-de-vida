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

// --------------------------------------------------------------------- o relé da verificação
//
// Medido na conta do dono em 04/11/2026, com a verificação aberta: os nove estão numa única
// `<img class="expedition-captcha__image">` (`data:` URI), com nove `<button
// class="expedition-captcha__tile">` por cima, rotulados só por `aria-label="coluna N, linha N"` —
// o jogo **não** põe o nome do Pokémon no DOM. Então o relé só transporta: manda a figura, espera
// uma pessoa, clica onde ela disse. Os testes daqui para baixo guardam essa fronteira.

/** O módulo com uma rede e um armazenamento de mentira, para exercitar o `perguntar` de mesa. */
const comRede = (respostas, guardado = { token: '123456789:AAbbccddeeffgghhiijjkkllmmnnoopp', chat: '77' }, calado = false) => {
  const mod = { exports: {} };
  const chamadas = [];
  globalThis.chrome = {
    runtime: { id: 'teste' },
    storage: { local: { get: (chave, volta) => volta({ [chave]: guardado }), set: (o, volta) => volta() } },
  };
  globalThis.fetch = async (url) => {
    chamadas.push(String(url));
    const r = respostas.shift() || (calado ? { ok: true, result: [] } : null);
    if (!r) throw new Error('a prova pediu mais rede do que preparou: ' + chamadas.at(-1));
    return { status: 200, json: async () => r };
  };
  new Function('module', 'globalThis', fonte)(mod, globalThis);
  return { api: mod.exports, chamadas };
};

const agora = () => Math.floor(Date.now() / 1000);
const msg = (texto, { chat = 77, quando = agora(), id = 11 } = {}) => ({
  update_id: id,
  message: { text: texto, date: quando, chat: { id: chat } },
});

test('a foto vai em multipart, e o Content-Type nao se escreve a mao', () => {
  // Multipart é um dos tipos que o CORS trata como pedido simples: sem preflight, e o preflight
  // daquele servidor dá 501. E quem escreve o cabeçalho é o navegador, que lhe junta o `boundary` —
  // escrevê-lo à mão parte o corpo em silêncio.
  // Só o `foto`: o `fecharToque`, logo abaixo, é form-urlencoded de propósito e não entra aqui.
  const corpo = codigo.slice(codigo.indexOf('const foto ='), codigo.indexOf('const SELO'));
  assert.match(corpo, /new FormData\(\)/);
  assert.match(corpo, /corpo\.append\('photo', imagem, 'verificacao\.png'\)/);
  assert.ok(!/Content-Type/.test(corpo), 'o boundary é do navegador, não nosso');
  assert.match(corpo, /sendPhoto/);
});

test('uma resposta velha nao vira clique', async () => {
  // A armadilha que isto guarda: o `getUpdates` guarda o que não foi confirmado, então um "3" que
  // o dono escreveu numa janela de ontem continua lá. Sem esvaziar a fila primeiro, esse 3 clicava
  // sozinho num desafio que ele nunca viu.
  const { api, chamadas } = comRede([
    { ok: true, result: [{ update_id: 500 }] }, // o esvaziar
    { ok: true, result: {} }, // a foto
    { ok: true, result: [msg('3', { quando: agora() - 3600, id: 501 })] },
    { ok: true, result: [msg('7', { id: 502 })] },
  ]);
  const r = await api.perguntar({ imagem: new Blob(['x']), legenda: 'oi', segundos: 5, aceitar: (t) => (/^[1-9]$/.test(t.trim()) ? Number(t) : null) });
  assert.deepEqual(r, { resposta: 7 }, 'a de ontem foi ignorada; valeu a de agora');
  assert.match(chamadas[0], /getUpdates\?offset=-1&limit=1/, 'a fila é esvaziada ANTES de perguntar');
  assert.match(chamadas[2], /offset=501/, 'e continua dali para a frente');
});

test('resposta de outra conversa nao vira clique', async () => {
  // O mesmo bot pode estar em mais conversas. Só o `chat id` configurado manda nesta janela.
  const { api } = comRede([
    { ok: true, result: [] },
    { ok: true, result: {} },
    { ok: true, result: [msg('5', { chat: 999 })] },
    { ok: true, result: [msg('2')] },
  ]);
  const r = await api.perguntar({ imagem: new Blob(['x']), legenda: 'oi', segundos: 5, aceitar: (t) => (/^[1-9]$/.test(t.trim()) ? Number(t) : null) });
  assert.deepEqual(r, { resposta: 2 });
});

test('so um numero de 1 a 9 vira clique, e o silencio nao vira nada', async () => {
  const aceitar = (t) => (/^[1-9]$/.test(String(t).trim()) ? Number(String(t).trim()) : null);
  for (const torto of ['o 3', 'acho que 3', '0', '10', 'sim', '', '3 ou 4'])
    assert.equal(aceitar(torto), null, `"${torto}" não é uma resposta`);
  assert.equal(aceitar(' 4 '), 4);
  // E ninguém a responder termina sem clique nenhum, em vez de chutar.
  // `calado`: o Telegram responde "nada novo" para sempre, que é o que ele faz quando ninguém
  // escreve. O relé tem de desistir sozinho no prazo, e não ficar a perguntar até a janela fechar.
  const { api } = comRede([{ ok: true, result: [] }, { ok: true, result: {} }], undefined, true);
  const r = await api.perguntar({ imagem: new Blob(['x']), legenda: 'oi', segundos: 1, aceitar });
  assert.match(r.erro, /ninguém respondeu/);
});

test('o rele nao olha para a figura, nao a guarda e nao sugere nada', () => {
  const rele = painel.slice(painel.indexOf('const responderPelaFoto'), painel.indexOf('const preparar ='));
  // Não lê o que está desenhado: nada de `alt`, `title` ou `aria-label` dos quadrados — que é onde
  // um solucionador iria primeiro.
  assert.ok(!/\.alt|getAttribute\('aria-label'\)|\.title/.test(rele), 'o relé não lê rótulo nenhum dos quadrados');
  // Não guarda a resposta: ela vive até ao clique. Um ficheiro a dizer "esta figura é Exeggutor"
  // transformava o transporte noutra coisa.
  assert.ok(!/gravar\(\)|localStorage|storage\.local/.test(rele), 'nada do desafio é guardado');
  // E o número vem de fora; não há aqui nenhuma escolha nossa.
  assert.match(rele, /r\.resposta/);
  assert.ok(!/Math\.random|sort\(|probabilidade|palpite/.test(rele), 'a extensão não escolhe nem ordena');
  // O liga-desliga é do dono, e vem desligado.
  assert.match(painel, /pelaFoto: false,/);
  assert.match(painel, /cfg\.recado && cfg\.pelaFoto && entrou\.exigeVerificacao/);
});

test('nao se clica numa grade que ja nao e a da foto', () => {
  // Entre a pergunta e a resposta passam-se até 72 s. Se o desafio trocou nesse tempo, clicar no
  // número que o dono disse seria clicar às cegas num desafio que ele nunca viu.
  const rele = painel.slice(painel.indexOf('const responderPelaFoto'), painel.indexOf('const preparar ='));
  assert.match(rele, /const mesma = agora === grade && document\.querySelector\(RETRATO\)\?\.src === retrato\.src;/);
  assert.match(rele, /if \(!alvo \|\| !mesma\) \{/);
  assert.match(rele, /Não cliquei\./);
  // E o prazo pára antes do do jogo (~90 s), para não clicar em cima da expiração.
  assert.match(painel, /const ATE_RESPONDER = 72;/);
});

// ------------------------------------------- os três pedidos do dono em 04/11/2026
//
// Um: se ninguém responder no prazo, cancelar o desafio e **sair** da expedição. Dois: perguntar
// antes de entrar, e só entrar com o sim dele. Três: abrir a janela de expedições do jogo e
// deixá-la aberta até a corrida entrar no mapa.

test('sem resposta no prazo, sai do grupo em vez de ficar la dentro', () => {
  const rele = painel.slice(painel.indexOf('const responderPelaFoto'), painel.indexOf('const preparar ='));
  assert.match(rele, /await desistir\(`Ninguém respondeu em \$\{ATE_RESPONDER\}s\.`\)/);
  assert.match(rele, /return 'saiu';/);
  const desistir = painel.slice(painel.indexOf('const desistir ='), painel.indexOf('const responderPelaFoto'));
  // Fecha o desafio e sai pela porta do próprio jogo — a mesma do botão vermelho.
  assert.match(desistir, /\.pokeidle-panel__close/);
  assert.match(desistir, /ponte\(\{ acao: 'sair' \}\)/);
  // E o dono fica a saber, esteja onde estiver.
  assert.match(desistir, /await recado\(/);
  // Sair deixa o time e a caçada como estavam, igual a uma falha.
  const corrida = painel.slice(painel.indexOf('const preparar ='), painel.indexOf('const desfazer ='));
  assert.match(corrida, /if \(fim === 'saiu'\) saiu = true;/);
  assert.match(corrida, /if \(falhou \|\| saiu\) await desfazer\(\);/);
});

test('a licenca e perguntada antes de tocar no jogo, e o nao e respeitado', async () => {
  const corrida2 = painel.slice(painel.indexOf('const preparar ='), painel.indexOf('const desfazer ='));
  const corrida = painel.slice(painel.indexOf('const preparar ='), painel.indexOf('const desfazer ='));
  assert.ok(corrida.indexOf('pedirLicenca') < corrida.indexOf('esperarAVez'));
  assert.ok(corrida.indexOf('pedirLicenca') < corrida.indexOf("times?.usar"), 'ninguém troca de time antes do sim');
  const licenca = painel.slice(painel.indexOf('const pedirLicenca'), painel.indexOf('const abrirJanela'));
  assert.match(licenca, /segundos: ATE_LICENCA/);
  assert.match(licenca, /resposta\.resposta !== true/);
  assert.match(painel, /const ATE_LICENCA = 600;/);
  // A pergunta e' a PRIMEIRA coisa que chega ao telefone: quando ela vai ser feita, o aviso de
  // "Expedicao ABERTA" cala-se, em vez de anunciar antes dela que ja' ia preparar tudo.
  const batida = painel.slice(painel.indexOf('const bater ='));
  assert.match(batida, /const vaiPerguntar =/);
  assert.match(batida, /cfg\.recado && !vaiPerguntar && janelaAvisada !== r\.fecha/);
  // E uma pergunta por janela, nao uma a cada batida de meio minuto.
  assert.match(corrida2, /janelaAvisada = visto\?\.fecha \|\| janelaAvisada;/);
  assert.match(corrida2, /if \(porMinha\) janelaFeita = visto\?\.fecha \|\| '';/);
  // A pergunta vai como texto — sem imagem, o `perguntar` manda um recado em vez de uma foto.
  const { api, chamadas } = comRede([
    { ok: true, result: [] },
    { ok: true, result: {} },
    { ok: true, result: [msg('sim')] },
  ]);
  const r = await api.perguntar({ legenda: 'posso?', segundos: 5, aceitar: (t) => (/^sim$/i.test(t.trim()) ? true : null) });
  assert.deepEqual(r, { resposta: true });
  assert.match(chamadas[1], /sendMessage/, 'pergunta sem foto sai como mensagem');
});

test('a janela do jogo abre antes de entrar, e fica aberta ate a corrida comecar', () => {
  const corrida = painel.slice(painel.indexOf('const preparar ='), painel.indexOf('const desfazer ='));
  // Antes de entrar, porque é dentro dela que a verificação e o "Estou pronto" existem.
  assert.ok(corrida.indexOf('abrirJanela()') < corrida.indexOf("acao: 'entrar'"));
  // Depois do Pronto, a vigia corre **sem** ser esperada: segurar a vez quinze minutos por causa
  // de uma janela prendia a caçada.
  assert.match(corrida, /if \(fim === 'pronto'\) void vigiarJanela\(\);/);
  const vigia = painel.slice(painel.indexOf('const vigiarJanela'), painel.indexOf('const desistir'));
  assert.match(vigia, /ponte\(\{ acao: 'corrida' \}\)/);
  assert.match(vigia, /if \(r\?\.correndo\) return;/);
  assert.match(vigia, /await abrirJanela\(\);/);
  // A ponte tem as três ações novas — e continua sem a que marcaria o pronto.
  const ponte = semComentarios(ler('expedicao-main.js'));
  for (const acao of ['janela', 'corrida', 'sair']) assert.match(ponte, new RegExp(`acao === '${acao}'`));
  assert.match(ponte, /ExpeditionWindow/);
  assert.match(ponte, /leaveExpedition/);
  assert.ok(!/setExpeditionReady/.test(ponte), 'o pronto continua a não ser marcado por aqui');
});

test('espera-se pelo desafio PREENCHIDO, e nao pelo elemento vazio', () => {
  // O erro, apanhado no primeiro teste a sério do dono em 04/11/2026: a grade e a imagem aparecem
  // no DOM **vazias** e só depois são preenchidas. O relé esperava pelos elementos, lia no instante
  // seguinte, via zero quadrados e desistia — com uma mensagem a culpar o jogo ("veio com 0
  // quadrados") por uma pressa que era minha. Nada chegou ao telefone nesse dia.
  const pronto = painel.slice(painel.indexOf('const desafioPronto'), painel.indexOf('const botaoPronto'));
  assert.match(pronto, /grade\.children\.length !== 9/, 'nove quadrados, não um elemento vazio');
  assert.match(pronto, /retrato\.currentSrc \|\| retrato\.src/, 'e a figura já com fonte');
  const rele = painel.slice(painel.indexOf('const responderPelaFoto'), painel.indexOf('const preparar ='));
  // Espera-se duas vezes: ao abrir, e outra vez a cada ronda — entre rondas o jogo troca o desafio
  // e a grade fica vazia de novo.
  assert.equal((rele.match(/ate\(\(\) => Boolean\(desafioPronto\(\)\), 12000\)/g) || []).length, 2);
  // E não se volta a decidir pela simples existência dos elementos.
  assert.ok(
    !/document\.querySelector\(RETRATO\) && document\.querySelector\(GRADE\)/.test(rele),
    'existir não é estar pronto',
  );
});

test('vai-se a aba Meu Grupo antes de procurar o botao', () => {
  // Apanhado pelo dono em 04/11/2026, com um círculo à volta da aba: a janela abre na aba
  // "Expedição", e o "Estou pronto" vive na "Meu Grupo". Quem joga carrega nela sem pensar; o relé
  // ficava a procurar um botão que existe noutro ecrã, e nada chegava ao telefone.
  const aba = painel.slice(painel.indexOf('const abaDoGrupo'), painel.indexOf('const botaoPronto'));
  assert.match(aba, /\[data-tab="group"\]/);
  assert.match(aba, /is-active/, 'não se clica numa aba que já está aberta');
  assert.match(aba, /ate\(\(\) => Boolean\(botaoPronto\(\)\), 5000\)/, 'espera-se o botão aparecer');
  const rele = painel.slice(painel.indexOf('const responderPelaFoto'), painel.indexOf('const preparar ='));
  assert.ok(
    rele.indexOf('await abaDoGrupo()') < rele.indexOf('const abrir = botaoPronto()'),
    'a aba primeiro: sem ela o botão nem existe no DOM',
  );
});

test('so o fim do prazo faz sair do grupo; conflito e rede nao', async () => {
  // O defeito, visto a tempo em 04/11/2026 ao pensar em duas janelas no mesmo bot: o relé tratava
  // QUALQUER erro como "ninguém respondeu" e saía da expedição. Bastava outra janela arrancar e
  // roubar o `getUpdates` para esta desistir sozinha — sem o dono ter feito nada.
  const rele = painel.slice(painel.indexOf('const responderPelaFoto'), painel.indexOf('const preparar ='));
  assert.match(rele, /if \(r\.prazo\) \{/);
  assert.ok(
    rele.indexOf('if (r.prazo) {') < rele.indexOf('await desistir('),
    'desiste-se por prazo, e só por prazo',
  );
  assert.match(rele, /Não consegui perguntar: \$\{r\.erro\}/);
  // E o prazo é a única saída marcada como tal.
  assert.match(codigo, /return \{ erro: 'ninguém respondeu a tempo', prazo: true \};/);

  // O 409 tem nome: duas janelas com o mesmo bot não podem ler ao mesmo tempo.
  const { api } = comRede([
    { ok: true, result: [] },
    { ok: true, result: {} },
    { ok: false, description: 'Conflict: terminated by other getUpdates request' },
  ]);
  const r = await api.perguntar({ imagem: new Blob(['x']), legenda: 'oi', segundos: 5, aceitar: () => null });
  assert.equal(r.conflito, true);
  assert.match(r.erro, /outra janela está a usar este mesmo bot/);
  assert.ok(!r.prazo, 'conflito não é prazo, e por isso não faz sair do grupo');
});

test('a fila entre janelas: sorteia uma vez, conta desde que a janela abriu e cabe nela', () => {
  const espera = painel.slice(painel.indexOf('const esperaDaJanela'), painel.indexOf('const naHoraDeEntrar'));
  // Uma vez por janela: sortear a cada batida fazia a hora de entrar fugir para a frente.
  assert.match(espera, /if \(sorteado\.janela !== r\.fecha\)/);
  // E nunca passa de três minutos antes de fechar — a espera não pode comer a corrida.
  assert.match(espera, /const cabe = Math\.max\(0, \(Number\(r\.restantes\) \|\| 0\) - 180\);/);
  assert.match(espera, /Math\.min\(bruto, cabe\)/);
  // Zero desliga, e é o que está por omissão: quem não configurar nada entra como sempre entrou.
  assert.match(espera, /if \(!max\) return 0;/);
  assert.match(painel, /esperaMin: 0,/);
  assert.match(painel, /esperaMax: 0,/);

  const hora = painel.slice(painel.indexOf('const naHoraDeEntrar'), painel.indexOf('const resumo'));
  // Conta-se de `opens_at` (ISO com Z, medido em 04/11/2026) e não de quando a extensão acordou:
  // senão um F5 reiniciava a contagem e duas janelas voltavam a cair em cima uma da outra.
  assert.match(hora, /Date\.parse\(String\(r\.abre \|\| ''\)\)/);
  assert.match(hora, /if \(!Number\.isFinite\(abriu\)\) return true;/, 'sem data legível, não se adia');
  // A batida respeita a hora, e diz quanto falta em vez de ficar calada.
  const batida = painel.slice(painel.indexOf('const bater ='));
  assert.ok(batida.indexOf('naHoraDeEntrar(r)') < batida.indexOf('await preparar(true)'));
  assert.match(batida, /fila entre as janelas/);
});

test('duas janelas no mesmo bot nao se queimam uma a outra', () => {
  // A pergunta do dono em 04/11/2026: "e se eu puser duas janelas no mesmo range?". Elas sorteiam
  // minutos independentes e podem calhar juntas — e a licença segura o bot até dez minutos à
  // espera do sim, portanto o cruzamento acontece mesmo com ranges diferentes.
  const corrida = painel.slice(painel.indexOf('const preparar ='), painel.indexOf('const desfazer ='));
  // Um "não" dele encerra a janela; um conflito NÃO — senão a corrida do dia perdia-se em silêncio
  // por causa de outra janela, sem ele ter escrito nada.
  assert.match(corrida, /if \(licenca === 'nao'\) \{/);
  assert.ok(
    corrida.indexOf("if (licenca === 'nao')") < corrida.indexOf('janelaFeita = visto?.fecha'),
    'só o "não" dá a janela por tratada',
  );
  assert.match(corrida, /if \(licenca !== 'sim'\) \{/);
  assert.match(corrida, /adiadoAte = Date\.now\(\) \+ \(licenca === 'conflito' \? 60000 \+ Math\.random\(\) \* 120000 : 60000\);/);
  // O adiamento é sorteado de propósito: é o desempate. Duas janelas a tentarem de meio em meio
  // minuto roubavam a leitura uma à outra para sempre, e nenhuma chegava a perguntar.
  const batida = painel.slice(painel.indexOf('const bater ='));
  assert.match(batida, /if \(Date\.now\(\) < adiadoAte\) \{/);
  assert.ok(batida.indexOf('adiadoAte') < batida.indexOf('naHoraDeEntrar(r)'));
  // E a pergunta volta a poder ser feita: sem isto, o "uma por janela" calava a segunda tentativa.
  assert.match(corrida, /janelaAvisada = '';/);
});

test('os botoes do Telegram: o toque vale, e o toque de uma pergunta velha nao', async () => {
  // Pedido do dono em 04/11/2026: responder sem escrever. O risco próprio dos botões é que eles
  // ficam na conversa **para sempre** e continuam clicáveis — um toque no "4" de ontem não pode
  // valer como resposta de hoje. Por isso cada botão leva um selo desta pergunta.
  assert.match(codigo, /callback_data: `\$\{selo\}:\$\{valor\}`/);
  assert.match(codigo, /if \(seloDele !== selo\) continue;/);
  assert.match(codigo, /allowed_updates=%5B%22message%22%2C%22callback_query%22%5D/);

  const toque = (valor, selo, { chat = 77, id = 'cb1', update = 31 } = {}) => ({
    update_id: update,
    callback_query: { id, data: `${selo}:${valor}`, message: { chat: { id: chat } } },
  });

  // Um toque com o selo certo responde.
  let visto = null;
  const { api, chamadas } = comRede([
    { ok: true, result: [] },
    { ok: true, result: { message_id: 4242 } },
    { ok: true, result: [] },
    { ok: true, result: {} },
    { ok: true, result: {} },
  ]);
  // O selo é sorteado lá dentro; lê-se do `callback_data` que o próprio pedido enviou.
  const original = globalThis.fetch;
  globalThis.fetch = async (url, op) => {
    const u = String(url);
    if (/sendPhoto/.test(u)) {
      visto = JSON.parse(op.body.get('reply_markup'));
      return { status: 200, json: async () => ({ ok: true, result: { message_id: 4242 } }) };
    }
    if (/getUpdates\?offset=\d/.test(u)) {
      const selo = visto.inline_keyboard[0][0].callback_data.split(':')[0];
      return { status: 200, json: async () => ({ ok: true, result: [toque('9', 'selo-velho'), toque('4', selo, { update: 32 })] }) };
    }
    chamadas.push(u);
    return { status: 200, json: async () => ({ ok: true, result: {} }) };
  };
  const r = await api.perguntar({
    imagem: new Blob(['x']),
    legenda: 'oi',
    segundos: 5,
    aceitar: (t) => (/^[1-9]$/.test(String(t).trim()) ? Number(t) : null),
    botoes: [[{ texto: '1', valor: '1' }]],
  });
  globalThis.fetch = original;
  assert.deepEqual(r, { resposta: 4 }, 'valeu o toque desta pergunta, e não o da velha');
  // E a pergunta fecha-se: o relógio sai do botão e os botões saem da mensagem respondida.
  assert.ok(chamadas.some((u) => /answerCallbackQuery/.test(u)));
  assert.ok(chamadas.some((u) => /editMessageReplyMarkup/.test(u)));
});

test('os nove botoes vem arrumados como a figura, e a licenca tem dois', () => {
  const rele = painel.slice(painel.indexOf('const responderPelaFoto'), painel.indexOf('const preparar ='));
  // Três linhas de três, na mesma arrumação da grade: o dedo cai onde o olho está.
  assert.match(rele, /\[1, 2, 3\],\n\s*\[4, 5, 6\],\n\s*\[7, 8, 9\],/);
  const licenca = painel.slice(painel.indexOf('const pedirLicenca'), painel.indexOf('const abrirJanela'));
  assert.match(licenca, /valor: 'sim'/);
  assert.match(licenca, /valor: 'nao'/);
  // O escrito continua a valer: o toque é o caminho curto, não o único.
  assert.match(licenca, /ou escreva SIM ou NÃO, se preferir/);
});
