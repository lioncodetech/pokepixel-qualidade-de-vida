// Guardas da décima segunda ferramenta: a Arena de Defesa.
//
// Como as outras que só existem contra o DOM do jogo, o que se protege aqui são as **decisões** —
// e nesta ferramenta elas custam dinheiro de verdade: o jogo vende entradas a 25 diamantes e
// atualizações depois das três grátis. Um refactor que desfaça qualquer uma destas linhas continua
// a ler bem, e a conta do dono é que paga.
//
// O comportamento está na banca, em `testes/banca-arena.html`, que atravessa a rodada inteira com
// a batalha, a derrota, o barramento e a recusa de pagar.
//
// Rode com: node --test testes/*.test.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const ler = (arquivo) => readFileSync(new URL(`../${arquivo}`, import.meta.url), 'utf8');

// Os comentários citam de propósito as coisas que o código não pode conter.
const semComentarios = (texto) =>
  texto
    .split('\n')
    .filter((linha) => !/^\s*(\/\/|\*|\/\*)/.test(linha))
    .join('\n');

const codigo = semComentarios(ler('arena.js'));
const ponte = semComentarios(ler('arena-main.js'));

test('a ponte lê, e não ataca nem atualiza', () => {
  // `attackPvPDefense` e `refreshPvPDefenseOpponents` existem na mesma API, ao lado da leitura.
  // Pô-las na ponte deixaria a ação mais cara do jogo a um CustomEvent de distância de qualquer
  // engano — e esta ponte ouve `window`, que a página inteira alcança.
  assert.ok(!ponte.includes('attackPvPDefense'), 'a ponte não ataca');
  assert.ok(!ponte.includes('refreshPvPDefenseOpponents'), 'a ponte não atualiza');
  assert.ok(!ponte.includes('savePvPDefense'), 'a ponte não salva nada');
  assert.match(ponte, /const FAZ = \{ estado \}/);
  assert.match(ponte, /getPvPDefenseState/);
});

test('nunca se compra entrada nem atualizacao com diamante', () => {
  // O dono foi explícito, e é a razão de esta ferramenta existir com estas travas.
  // 1. as entradas extras não são tocadas: o nome delas nem aparece do lado de cá.
  assert.ok(!codigo.includes('extra_'), 'as entradas compradas não entram no código');
  // 2. a licença para atualizar vem da API, e lê-se ANTES do clique.
  const atualizar = codigo.slice(codigo.indexOf('const atualizarGratis = async'));
  const corpo = atualizar.slice(0, atualizar.indexOf('\n    };'));
  assert.match(corpo, /if \(!estado\.atualizacao\.gratis\) return false;/);
  assert.ok(
    corpo.indexOf('atualizacao.gratis') < corpo.indexOf('botao.click()'),
    'a licença lê-se antes do clique, não depois',
  );
  // 3. e a licença é o `payment` da API, nunca o texto do botão: ler "grátis" de uma string para
  // decidir se uma coisa custa diamante é apostar numa tradução.
  assert.match(ponte, /gratis: at\.payment === 'free' && Number\(at\.free_remaining\) > 0/);
  assert.ok(!corpo.includes('textContent'), 'a decisão não sai do texto do botão');
});

test('ninguem ataca sem tentativa, e quem conta e o jogo', () => {
  const rodada = codigo.slice(codigo.indexOf('const rodada = async'));
  const corpo = rodada.slice(0, rodada.indexOf('\n    };'));
  assert.match(corpo, /if \(estado\.tentativas\.restantes <= 0\)/);
  // A contagem é relida a cada volta, e a sobra depois do ataque vem do estado que o próprio
  // ataque leu. Uma contagem desta ferramenta divergia no primeiro ataque feito à mão.
  assert.match(corpo, /const sobra = r\.estado \? r\.estado\.tentativas\.restantes : 0;/);
  assert.match(corpo, /if \(sobra <= 0\)/);
});

test('a vez e pedida por ataque, e nao pela rodada inteira', () => {
  // Cinco ataques com os intervalos do dono passam dos quinze minutos. Segurar a fila esse tempo
  // todo pararia a Escada, o ginásio e a venda por uma coisa que não tem pressa nenhuma.
  const rodada = codigo.slice(codigo.indexOf('const rodada = async'));
  const corpo = rodada.slice(0, rodada.indexOf('\n    };'));
  assert.match(corpo, /soltar = await esperarAVez\(aviso\);/);
  assert.match(corpo, /} finally \{\n\s+if \(soltar\) soltar\(\);\n\s+\}/);
  // O pedido está DENTRO do laço dos ataques, e o intervalo fica de fora dele — é isso que deixa
  // a fila livre entre um ataque e outro.
  assert.ok(
    corpo.indexOf('for (let feitos') < corpo.indexOf('esperarAVez'),
    'a vez é pedida dentro do laço dos ataques',
  );
  assert.ok(
    corpo.indexOf('if (soltar) soltar();') < corpo.indexOf('Esperando ${atraso}s'),
    'a vez é solta antes do intervalo, não depois',
  );
  assert.match(codigo, /const MINHA_VEZ = 'arena';/);
});

test('ganhou ou perdeu decide-se pelos pontos, e nao pela classe da tela', () => {
  // `.pvp-result.is-win` está medido; a classe da derrota não. Tratar "não é is-win" como derrota
  // faria uma classe renomeada barrar a lista inteira de rivais, uma por rodada, em silêncio.
  const atacar = codigo.slice(codigo.indexOf('const atacar = async'));
  const corpo = atacar.slice(0, atacar.indexOf('\n    };'));
  assert.match(corpo, /const classeDizVitoria = fim\.classList\.contains\('is-win'\);/);
  assert.match(
    corpo,
    /pontosDepois === null \|\| pontosDepois === pontosAntes\n\s+\? classeDizVitoria\n\s+: pontosDepois > pontosAntes/,
  );
});

test('quem vence o dono fica de fora ate a temporada virar', () => {
  // Pedido dele: "quando perde quero que pule aquela defesa e não entre mais". Guarda-se o
  // `trainer_id` porque o nome muda e o id não.
  assert.match(codigo, /cfg\.barrados = \{ \.\.\.cfg\.barrados, \[alvo\.id\]: \{ nome: alvo\.nome/);
  assert.match(codigo, /const barrado = \(id\) => Object\.hasOwn\(cfg\.barrados, id\);/);
  const temporada = codigo.slice(codigo.indexOf('const conferirTemporada ='));
  const corpo = temporada.slice(0, temporada.indexOf('\n    };'));
  assert.match(
    corpo,
    /if \(!estado\.temporada\.id \|\| estado\.temporada\.id === cfg\.temporada\) return;/,
  );
  assert.match(corpo, /cfg\.barrados = \{\};/);
  // E o alvo escolhido nunca é um barrado.
  assert.match(codigo, /estado\.oponentes\.filter\(\(o\) => !o\.usado && !barrado\(o\.id\)\)/);
});

test('a janela da arena abre-se sozinha, em dois cliques', () => {
  // Às 13h a janela está fechada: sem isto a rodada não tinha onde clicar. O item do menu só
  // existe depois de o grupo abrir — dai' a espera no meio, em vez de dois cliques a torcer.
  const abrir = codigo.slice(codigo.indexOf('const abrirJanela = async'));
  const corpo = abrir.slice(0, abrir.indexOf('\n    };'));
  assert.match(corpo, /data-menu-id="events"/);
  assert.match(corpo, /data-menu-id="arena-defense"/);
  assert.ok(
    corpo.indexOf('grupo.click()') < corpo.indexOf('await ate('),
    'espera-se o item do menu aparecer antes de o clicar',
  );
  // O `✕` da janela é um DIV: medido, `el.click()` nele não fecha nada.
  assert.match(codigo, /for \(const tipo of \['pointerdown', 'mousedown', 'mouseup', 'click'\]\)/);
});

test('a tela de preparacao reconhece-se pelo que tem, e nao pelo que diz', () => {
  // Medido no jogo em 12/10/2026: o "Ataque contra <nome>" é um H2, e o h3 daquele cabeçalho é o
  // "ESCOLHIDOS · 6/6". A primeira versão procurava a frase no `header h3`, ficava dez segundos a
  // olhar para a tela aberta e dizia que ela não tinha aberto. Um seletor de título por outro era
  // repetir o erro: o que vale é haver os ataques salvos e o botão que os passos seguintes usam.
  const corpo = codigo.slice(codigo.indexOf('const naPreparacao ='));
  const fim = corpo.slice(0, corpo.indexOf('\n    };'));
  assert.ok(!/Ataque contra/i.test(fim), 'a tela não se reconhece por uma frase do cabeçalho');
  assert.ok(!/header h3/.test(codigo), 'ninguém lê o h3 do cabeçalho para saber onde está');
  assert.match(fim, /\.defense-slot/);
  assert.match(fim, /confirmarDe\(j\)/);
  assert.match(fim, /!naLista\(\)/, 'a lista de rivais aberta não é a tela de preparação');
});

test('o ataque salvo e carregado antes do Atacar, e sem ele nao se ataca a esmo', () => {
  const atacar = codigo.slice(codigo.indexOf('const atacar = async'));
  const corpo = atacar.slice(0, atacar.indexOf('\n    };'));
  assert.ok(
    corpo.includes('confirmarDe(janela())'),
    'o botão de confirmar sai da própria janela da arena',
  );
  assert.ok(
    corpo.indexOf('await carregarTime()') < corpo.indexOf('confirmarDe(janela())'),
    'carrega-se a equipe antes de confirmar o ataque',
  );
  // Não conseguir carregar o time pedido é sair pela porta, e não atacar com outra equipe: a
  // tentativa gasta-se na mesma, e foi por isso que ele pediu um time em especial.
  assert.match(corpo, /if \(!time\.ok\) \{/);
  assert.match(corpo, /voltarDaPreparacao\(\);\n\s+return \{ erro: time\.diz \};/);
  // Um slot vazio tem o "Carregar" desativado, e isso não é um slot para carregar.
  assert.match(codigo, /b\.textContent\.trim\(\) === 'Carregar' && !b\.disabled/);
});

test('o intervalo entre ataques e sorteado dentro da faixa do dono', () => {
  assert.match(codigo, /const sorteado = \(menor, maior\) =>/);
  const sorteia = codigo.slice(codigo.indexOf('const sorteado = (menor, maior)'));
  const corpo = sorteia.slice(0, sorteia.indexOf('\n    };'));
  assert.match(corpo, /Math\.round\(a \+ Math\.random\(\) \* \(b - a\)\)/);
  // Um mínimo acima do máximo não é uma faixa: é um engano, e corrige-se para o mais lento.
  assert.match(codigo, /if \(cfg\.atrasoMax < cfg\.atrasoMin\) cfg\.atrasoMax = cfg\.atrasoMin;/);
});

test('o horario vem do calendario, e o que nao se entende nao vira todo dia', () => {
  // A regra do AGENTS.md: sem nenhuma regra válida todo dia conta, então um engano de escrita
  // transformaria uma rodada marcada numa rodada a toda a hora.
  assert.match(codigo, /const calendario = \(\) => globalThis\.PPX\?\.agenda \|\| null;/);
  assert.match(codigo, /calendario\(\)\?\.esperaDaAgenda\(/);
  assert.match(codigo, /horas\.classList\.toggle\('campo-mau', Boolean\(cfg\.horarios\) && !bom\)/);
  // Mexer na agenda apaga o carimbo: o `ultima` era da agenda antiga, e guardá-lo faria a janela
  // nova passar por já usada.
  const mudou = codigo.slice(codigo.indexOf('const agendaMudou = ()'));
  assert.match(mudou.slice(0, 500), /cfg\.ultima = 0;/);
});

test('a ferramenta esta no catalogo, no manifest e com atalho proprio', () => {
  const manifest = JSON.parse(ler('manifest.json'));
  const blocos = manifest.content_scripts;
  const deCa = blocos.find((b) => b.js.includes('escada.js'));
  const deLa = blocos.find((b) => b.world === 'MAIN');
  assert.ok(deCa.js.includes('arena.js'), 'arena.js é carregada do lado de cá');
  assert.ok(deLa.js.includes('arena-main.js'), 'a ponte é carregada no mundo da página');
  const nucleo = ler('nucleo.js');
  assert.match(nucleo, /\{ id: 'arena', nome: 'Arena de Defesa', atalhos: '[^']+' \}/);
  // Duas ferramentas na mesma tecla seria uma a roubar a outra. Alt+M era o único par livre, e é
  // por isso que esta usa a mesma tecla com e sem Shift — e o Shift tem de ser conferido.
  assert.match(codigo, /if \(evento\.code !== 'KeyM'\) return;/);
  assert.match(codigo, /mostrarPainel\(evento\.shiftKey === true\);/);
  for (const arquivo of ['cacadas.js', 'escada.js', 'gym.js', 'times.js', 'raridades.js'])
    assert.ok(!ler(arquivo).includes("=== 'KeyM'"), `${arquivo} não usa a tecla M`);
});

test('na expedicao a arena espera, e a rodada fica a dever ate o dia virar', () => {
  // Escolha do dono em 12/10/2026, com a expedição dele a correr: perder a rodada de hoje custa
  // pontos que a meia-noite devolve; perder duas horas de expedição e um CAPTCHA, não.
  assert.match(
    codigo,
    /const naExpedicao = \(\) => globalThis\.PPX\?\.cacadas\?\.atual\?\.\(\)\?\.tipo === 'expedicao';/,
  );
  // A mesma porta que a Escada usa. Uma leitura própria do HUD seria uma segunda verdade sobre
  // onde o jogador está.
  const rodada = codigo.slice(codigo.indexOf('const rodada = async'));
  const corpo = rodada.slice(0, rodada.indexOf('\n    };'));
  // Confere-se no início E a cada ataque: a expedição abre de quatro em quatro horas, e o dono
  // pode entrar nela no meio de uma rodada de quinze minutos.
  assert.ok(
    corpo.split('if (naExpedicao()) {').length - 1 === 2,
    'a expedição é conferida no início da rodada e a cada ataque',
  );
  assert.match(corpo, /await ficarADever\(aviso\);/);
  // E a janela da arena não chega a abrir-se por cima do jogo dele.
  assert.ok(
    corpo.indexOf('if (naExpedicao()) {') < corpo.indexOf('await abrirJanela()'),
    'espera-se antes de abrir a janela, não depois',
  );
});

test('o prazo da divida vem do jogo, e ela morre quando o dia da arena vira', () => {
  // O `resets_at` da própria arena, guardado como instante: assim a batida decide com um
  // `Date.now()` e sem perguntar nada à API, e a dívida não sobrevive para uma madrugada qualquer
  // — fazê-la de madrugada seria gastar a rodada de hoje sem ninguém pedir.
  assert.match(ponte, /reinicia: Date\.parse\(a\.resets_at\) \|\| 0,/);
  const deve = codigo.slice(codigo.indexOf('const ficarADever = async'));
  const corpo = deve.slice(0, deve.indexOf('\n    };'));
  assert.match(corpo, /if \(cfg\.devendo && Date\.now\(\) < cfg\.devendo\) return;/);
  assert.match(corpo, /cfg\.devendo = estado\.tentativas\.reinicia;/);
  // Sem leitura não se inventa prazo: no máximo perde-se a rodada de hoje, que é o lado certo de
  // errar.
  assert.match(corpo, /if \(!estado\?\.ok \|\| !estado\.tentativas\.reinicia\) return;/);
  const bate = codigo.slice(codigo.indexOf('const bater = () =>'));
  const batida = bate.slice(0, bate.indexOf('\n    };'));
  assert.match(batida, /if \(cfg\.devendo && Date\.now\(\) >= cfg\.devendo\) \{/);
  // A dívida é cobrada assim que a expedição acaba — mesmo com a janela de horário já fechada.
  assert.ok(
    batida.indexOf('if (naExpedicao()) {') < batida.indexOf('if (cfg.devendo) {'),
    'primeiro espera-se a expedição, depois cobra-se a dívida',
  );
  assert.ok(
    batida.indexOf('if (cfg.devendo) {') < batida.indexOf('const falta = esperaDaJanela();'),
    'a dívida corre sem depender da janela de horário, que já pode ter fechado',
  );
});

test('os comandos nao se escondem junto com o corpo', () => {
  // O mesmo pedido da Escada, no mesmo dia: minimizada, a Arena tem de poder começar, parar e
  // atacar agora sem abrir o painel. Os botões vivem fora do `.corpo`, que é o que o minimizar
  // esconde — e são os mesmos botões, não uma segunda cópia a desencontrar-se da primeira.
  const html = codigo.slice(codigo.indexOf('painel.innerHTML = `'));
  const marcacao = html.slice(0, html.indexOf('`;'));
  assert.ok(
    marcacao.indexOf('data-ligar') < marcacao.indexOf('<div class="corpo">'),
    'os botões vêm antes do corpo, e por isso sobrevivem ao minimizar',
  );
  assert.ok(marcacao.indexOf('data-agora') < marcacao.indexOf('<div class="corpo">'));
  // E a caixa dos botões não leva um `hidden` de volta: escondê-la é desfazer o pedido.
  assert.match(marcacao, /<div class="botoes">/);
  assert.ok(!/class="botoes"[^>]/.test(marcacao), 'nada de atributos a esconder os comandos');
  assert.equal(marcacao.split('data-ligar').length - 1, 1, 'há um só botão de ligar');
  assert.equal(marcacao.split('data-agora').length - 1, 1, 'há um só "Atacar agora"');
  assert.match(codigo, /#lioncode-arena\.minimizado \.botoes \{/);
});

test('a janela tem quatro abas, e so uma delas tem rivais', () => {
  // Medido no jogo em 13/10/2026: `nav.pvp-defense-nav` com "opponents", "defense", "history" e
  // "ranking". Fora da "opponents" não existe um único `.pvp-defense-opponent` no DOM — e o jogo
  // deixa a janela no "Histórico" assim que uma batalha acaba.
  const ir = codigo.slice(codigo.indexOf('const irParaAtacar = async ()'));
  const corpo = ir.slice(0, ir.indexOf('\n    };'));
  // A aba escolhe-se pelo endereço, e não pelo texto: "Atacar" é também o botão que gasta a
  // tentativa na tela de preparação.
  const achaAba = codigo.slice(codigo.indexOf('const abaAtacar = ()'));
  assert.match(achaAba.slice(0, 200), /\[data-defense-view="opponents"\]/);
  assert.ok(!/textContent/.test(achaAba.slice(0, 200)), 'a aba não se escolhe pelo texto do botão');
  // Sem barra de abas (preparação, batalha) não há o que trocar: a janela está aberta, e é isso
  // que o chamador pergunta.
  assert.match(corpo, /if \(!aba\) return Boolean\(janela\(\)\);/);
  assert.match(corpo, /if \(!aba\.classList\.contains\('is-active'\)\) aba\.click\(\);/);

  // Aberta noutra aba é aberta: um segundo clique no menu de cima fecharia a janela que já estava lá.
  const abrir = codigo.slice(codigo.indexOf('const abrirJanela = async ()'));
  const corpoAbrir = abrir.slice(0, abrir.indexOf('\n    };'));
  assert.match(corpoAbrir, /if \(janela\(\)\) return irParaAtacar\(\);/);
  assert.match(corpoAbrir, /const abriu = await ate\(janela, ESPERA_JANELA\);/);
  assert.match(corpoAbrir, /return Boolean\(abriu\) && \(await irParaAtacar\(\)\);/);

  // E volta-se à aba de atacar logo depois do resultado, não só no ataque seguinte.
  const atacar = codigo.slice(codigo.indexOf('const atacar = async'));
  const corpoAtacar = atacar.slice(0, atacar.indexOf('\n    };'));
  assert.ok(
    corpoAtacar.indexOf('await fecharResultado();') < corpoAtacar.indexOf('await irParaAtacar()'),
    'primeiro fecha-se o resultado, depois volta-se à aba',
  );
});

test('lista vazia nao e janela fechada', () => {
  // Medido pelo dono em 13/10/2026: o painel disse "Não consegui abrir a janela da Arena de
  // Defesa" com a janela aberta na frente dele. A culpa era desta função: ela esperava oito
  // segundos por um `.pvp-defense-opponent` e devolvia `false` quando nenhum aparecia — e quem a
  // chamava só sabia dizer uma coisa quando ela dizia `false`.
  const ir = codigo.slice(codigo.indexOf('const irParaAtacar = async ()'));
  const corpo = ir.slice(0, ir.indexOf('\n    };'));
  assert.ok(!/naLista/.test(corpo), 'a espera é pela aba, não pelos rivais');
  assert.match(corpo, /await ate\(naAbaAtacar, ESPERA_JANELA\)/);
  assert.match(
    codigo,
    /const naAbaAtacar = \(\) => Boolean\(abaAtacar\(\)\?\.classList\.contains\('is-active'\)\);/,
  );

  // Quem sabe dizer "não há rival" é o `proximoAlvo`, que lê a arena pela API e ainda tem as
  // atualizações de graça na mão. E quem sabe dizer "o cartão sumiu" é o `atacar`.
  const atacar = codigo.slice(codigo.indexOf('const atacar = async'));
  assert.match(atacar.slice(0, 300), /sumiu da lista/);
});

test('uma preparacao que ficou aberta nao e a lista, e sai-se dela pelo Voltar', () => {
  // **MEDIDO NO JOGO DO DONO EM 13/10/2026:** o painel dizia "n4th: o botão de atacar n4th sumiu da
  // lista" — e não tinha sumido nada. A janela estava parada na tela de preparação de uma tentativa
  // anterior: lá não há barra de abas, então não havia aba para clicar, e a lista nunca voltava.
  //
  // São dois buracos que a 1.18.3 abriu ao trocar a espera da lista pela espera da aba, e os dois
  // se fecham aqui: sair da preparação, e depois esperar o cartão em vez de o exigir no primeiro
  // instante. Entre trocar de aba e a lista pintar há um intervalo, e ele não é zero.
  const ir = codigo.slice(codigo.indexOf('const irParaAtacar = async ()'));
  const corpo = ir.slice(0, ir.indexOf('\n    };'));
  assert.match(corpo, /if \(!abaAtacar\(\) && naPreparacao\(\) && voltarDaPreparacao\(\)\)/);
  assert.ok(
    corpo.indexOf('voltarDaPreparacao()') < corpo.indexOf('const aba = abaAtacar();'),
    'volta-se da preparacao antes de procurar a aba',
  );

  // O "Voltar" não gasta tentativa — quem gasta é o `.defense-primary` ao lado dele.
  const sair = codigo.slice(codigo.indexOf('const voltarDaPreparacao = ()'));
  const dentro = sair.slice(0, sair.indexOf('\n    };'));
  assert.match(dentro, /b\.textContent\.trim\(\) === 'Voltar'/);
  assert.ok(!/defense-primary/.test(dentro), 'sair nao e atacar');

  // E o cartão espera-se, com o mesmo prazo das outras esperas da janela.
  const atacar = codigo.slice(codigo.indexOf('const atacar = async'));
  assert.match(
    atacar.slice(0, 200),
    /const botao = await ate\(\(\) => botaoDe\(alvo\.id\), ESPERA_JANELA\);/,
  );
});

test('quem diz que o ataque aconteceu e a arena, e nao a tela', () => {
  // Pedido pelo dono em 13/10/2026: "ele ta dizendo que atacou as 5 vezes sendo que so uma vez foi
  // bem sucedida". Até aqui a prova de que houve batalha era a tela — apareceu o
  // `.pokeidle-pvp-battle`, apareceu o `.pvp-result` —, e tela é o que mais mente: um resultado da
  // batalha anterior que não se fechou responde "sim" ao primeiro olhar, e daí em diante cada volta
  // do laço marca um ataque que não aconteceu.
  //
  // O contador de tentativas da própria arena não tem como mentir: ele só anda quando o jogo gasta
  // uma. Não tendo andado, não houve ataque — e então não se marca vitória nem derrota, e sobretudo
  // NÃO SE BARRA O RIVAL, que ficaria de fora até a temporada virar por uma derrota que nunca houve.
  const atacar = codigo.slice(codigo.indexOf('const atacar = async'));
  const corpo = atacar.slice(0, atacar.indexOf('\n    };'));
  assert.match(corpo, /const atacar = async \(alvo, pontosAntes, feitasAntes, aviso\) =>/);
  assert.match(corpo, /if \(depois\?\.ok && depois\.tentativas\.feitas <= feitasAntes\)/);
  assert.match(corpo, /a arena não registrou este ataque/);
  // E quem chama passa a contagem de ANTES, lida no mesmo estado que escolheu o alvo.
  assert.match(
    codigo,
    /r = await atacar\(alvo, estado\.pontos, estado\.tentativas\.feitas, aviso\);/,
  );
  // Não se conseguindo ler o estado, não se inventa: cai no caminho de sempre, que já decide pela
  // classe da tela quando os pontos não se mexem.
  assert.match(corpo, /depois\?\.ok && /);

  // E o resultado da batalha anterior sai da frente ANTES de começar esta: fechá-lo é barato,
  // confundir os dois custa uma vitória marcada como derrota e um rival barrado por uma temporada.
  assert.ok(
    corpo.indexOf('await fecharResultado();') < corpo.indexOf('const botao = await ate('),
    'fecha-se o resultado velho antes de procurar o cartao',
  );
});
