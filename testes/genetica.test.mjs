// Guardas da décima sexta ferramenta: a extração genética.
//
// Ela apaga Pokémon **permanentemente**, e isso muda o que um teste aqui tem de fazer. Não há
// banca: o que se protege são as decisões que impedem um clique sem querer de custar a coleção, e
// cada uma foi comprada com uma medição na conta do dono em 03/11/2026, com a API do jogo.
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

const painel = semComentarios(ler('genetica.js'));
const ponte = semComentarios(ler('genetica-main.js'));

test('a raridade e uma chave, e nao um intervalo de numeros', () => {
  // MEDIDO: dos 387 extraíveis da conta, 383 eram `epic` e **4 eram `legendary`** (1,6147 a
  // 1,6811). Quem escrevesse "1,40 a 1,60" num campo só apanharia lendário pelo meio e nunca mais
  // saberia qual foi — e não há desfazer. Por isso cada raridade tem a sua faixa, e ligar uma é
  // uma caixa que se marca.
  const bloco = ponte.slice(ponte.indexOf('const entra ='), ponte.indexOf('const listar ='));
  assert.match(bloco, /const faixa = faixas\[String\(c\?\.quality \|\| ''\)\];/);
  assert.match(bloco, /if \(!faixa\) return false;/);
  assert.match(bloco, /m >= faixa\.min/);
  assert.match(bloco, /m <= faixa\.max/);
  // E as outras três peneiras ficam, mesmo sendo redundantes com o servidor: o que elas protegem
  // é irreversível.
  assert.match(bloco, /c\?\.locked !== true/);
  assert.match(bloco, /c\?\.is_shiny !== true/);
  assert.match(bloco, /LUGARES\.has\(String\(c\?\.location \|\| ''\)\)/);
  assert.match(ponte, /const LUGARES = new Set\(\['inventory', 'storage'\]\);/);
  assert.match(ponte, /includeLocked: false/);
  // Uma raridade desligada não pode chegar à ponte como intervalo vazio e depender de lá ser
  // ignorada: o painel manda só as ligadas.
  assert.match(painel, /const faixasLigadas = \(\) => \{/);
  assert.match(painel, /if \(!f\?\.liga\) continue;/);
  assert.match(painel, /ponte\(\{ acao: 'listar', faixas: escolhidas \}\)/);
});

test('as faixas de cada raridade vem do jogo, e nunca sao cravadas aqui', () => {
  // Mesma lição das Raridades: um número escrito aqui seria uma mentira silenciosa no dia em que o
  // jogo mexesse na faixa. Medidas em 03/11/2026: épica 1,40–1,54, lendária 1,55–1,69.
  assert.match(ponte, /const band = globalThis\.PokeIdle\?\.PokemonCardData\?\.qualityBand;/);
  assert.match(ponte, /if \(acao === 'bandas'\)/);
  assert.match(painel, /ponte\(\{ acao: 'bandas' \}\)/);
  // E o painel prende cada campo à banda da sua raridade: uma "épica até 1,60" apanharia lendário.
  assert.match(painel, /Math\.min\(banda\.max, Math\.max\(banda\.min, v\)\)/);
  // Nada de fallback inventado: sem resposta do jogo, não se desenha número nenhum.
  assert.match(painel, /let bandas = \{\};/);
});

test('o jogo so extrai de epico para cima, e o painel diz isso', () => {
  // O caso que fecha a questão, medido em 03/11/2026: um Charmander FRACO (0,923), destravado, no
  // depósito, da MESMA espécie de dois épicos extraíveis, não aparece na lista de extraíveis.
  // Então "a minha faixa não pegou" e "esta raridade o jogo nunca dá" são perguntas diferentes, e
  // um zero mudo responderia as duas igual.
  assert.match(ponte, /const vistos = \{\};/);
  assert.match(ponte, /vistos\[q\] = \(vistos\[q\] \|\| 0\) \+ 1;/);
  assert.match(ponte, /vistos,/);
  // Ancorado no `procurar`: o `if (!plano.length)` do desenho da lista é outro, e mais acima.
  const busca = painel.slice(painel.indexOf('const procurar ='));
  const vazio = busca.slice(busca.indexOf('if (!plano.length) {'));
  assert.match(vazio.slice(0, 800), /O jogo ofereceu/);
  // E as quatro que não vêm aparecem riscadas, em vez de parecerem uma opção como as outras.
  assert.match(painel, /\['weak', 'common', 'uncommon', 'rare'\]\.includes\(chave\)/);
});

test('o plano e congelado, e os ids nao atravessam para o painel', () => {
  // O painel manda o ÍNDICE da espécie, nunca uma lista de ids. Assim o que se apaga é
  // exatamente o que foi contado na tela — nada de uma releitura esperta entre o "vi 248" e o
  // "apaguei 251".
  assert.match(ponte, /especies: novo\.map\(\(e\) => \(\{ nome: e\.nome, quantos: e\.ids\.length \}\)\)/);
  assert.match(ponte, /const alvo = plano\[indice\];/);
  assert.match(painel, /ponte\(\{ acao: 'extrair', indice: feitas \}\)/);
  assert.ok(
    !/creature_ids/.test(painel),
    'o painel não pode montar a seleção: os ids vivem do lado da página',
  );
});

test('a selecao e o lote sao os do proprio jogo', () => {
  // Medido no `NpcInteraction.js`: `{ species_id, selection: { mode: 'ids', creature_ids } }`, em
  // lotes de 500 (`EXTRACTION_BATCH_SIZE`). Inventar formato aqui seria uma segunda verdade sobre
  // a mesma chamada.
  assert.match(ponte, /selection: \{ mode: 'ids', creature_ids: lote \}/);
  assert.match(ponte, /const LOTE = 500;/);
  // A chave de idempotência nasce com a VARREDURA, e não com a chamada: uma repetição depois de
  // uma resposta ambígua tem de ser o mesmo pedido, e não um segundo pedido igual.
  assert.match(ponte, /`\$\{chave\}:\$\{indice\}:\$\{i \/ LOTE\}`/);
  assert.match(ponte, /chave = `lioncode-genetica-/);
});

test('um clique sem querer nao apaga nada', () => {
  // O pedido do dono, em 03/11/2026: "coloca um botão de pausa, para caso eu clique sem querer e
  // não queira fazer nada". São três travões, e os três têm de existir.
  //
  // 1. O primeiro clique em Extrair só ARMA a confirmação.
  const clique = painel.slice(painel.indexOf("campo('[data-extrair]').addEventListener"));
  const corpo = clique.slice(0, clique.indexOf('\n    });'));
  assert.match(corpo, /if \(!confirmando\) \{/);
  assert.match(corpo, /confirmando = true;/);
  assert.ok(
    corpo.indexOf('confirmando = true;') < corpo.indexOf('void extrair()'),
    'armar vem antes de extrair: o primeiro clique nunca pode cair no segundo caminho',
  );
  // 2. Mexer em qualquer outra coisa desarma.
  assert.match(painel, /const desarmar = \(\) => \{/);
  // 3. Procurar não apaga: é só leitura, e diz isso.
  const procura = painel.slice(painel.indexOf('const procurar ='), painel.indexOf('const extrair ='));
  assert.ok(!/acao: 'extrair'/.test(procura), 'Procurar nunca chama a extração');
});

test('a pausa pega entre especies, e o painel nao promete mais do que isso', () => {
  // Uma espécie é uma chamada só, e o servidor apaga todos os dela de uma vez: parar no meio dela
  // não existe. Um botão que fingisse o contrário seria pior do que não haver botão.
  const laco = painel.slice(painel.indexOf('while (feitas < plano.length)'));
  const corpo = laco.slice(0, laco.indexOf('desenharLista();'));
  assert.match(corpo, /if \(parar\) return dizer/);
  assert.match(corpo, /if \(pausado\) \{/);
  assert.ok(
    corpo.indexOf('if (parar)') < corpo.indexOf("acao: 'extrair'"),
    'os dois travões são lidos ANTES da chamada que apaga, nunca depois',
  );
  // Pausado não é parado: continua no laço, à espera, em vez de perder o lugar.
  assert.match(corpo, /await espera\(400\);\n\s+continue;/);
  // E fechar o painel com uma corrida a andar para-a, em vez de a perder de vista.
  const fechar = painel.slice(painel.indexOf("campo('[data-fechar]')"));
  assert.match(fechar.slice(0, 300), /if \(correndo\) parar = true;/);
});

test('o intervalo do servidor e uma espera, e nao uma paragem', () => {
  // MEDIDO NA CONTA DO DONO EM 03/11/2026, na primeira corrida de verdade: a primeira espécie
  // passou e a segunda voltou com "Aguarde um instante antes de iniciar outro ritual." — frase que
  // não existe em ficheiro de idioma nenhum, logo veio do servidor. A ferramenta tratava qualquer
  // erro como definitivo: extraiu UMA espécie e desistiu das outras 60, dizendo que tinha parado.
  //
  // A causa foi atirar fora os campos do erro. O cliente do jogo levanta `Error` com `code`,
  // `status` e `retryAfterMs` — medido com uma chamada de sonda — e a ponte só mandava a frase.
  assert.match(ponte, /const comoErro = \(erro\) => \(\{/);
  assert.match(ponte, /esperarMs: Number\(erro\?\.retryAfterMs\) \|\| 0,/);
  assert.match(ponte, /status: Number\(erro\?\.status\) \|\| 0,/);
  // E a extração tem o seu próprio catch: o geral lá de baixo só sabe a frase.
  const trecho = ponte.slice(ponte.indexOf("if (acao === 'extrair')"));
  assert.match(trecho.slice(0, 400), /responder\(comoErro\(erro\)\);/);

  // No painel: espera e tenta a MESMA espécie de novo, sem avançar o `feitas`.
  const laco = painel.slice(painel.indexOf('while (feitas < plano.length)'));
  const corpo = laco.slice(0, laco.indexOf('dizer(`Pronto:'));
  assert.match(corpo, /if \(!podeEsperar\(r\)\) return dizer/);
  assert.match(corpo, /await dormir\(quanto\);\n\s+continue;/);
  assert.ok(
    corpo.indexOf('await dormir(quanto)') < corpo.indexOf('feitas++;'),
    'a espera repete a espécie: nunca pode cair no `feitas++` e saltá-la',
  );
  // Repetir é seguro porque a chave de idempotência é a mesma — a do plano, não a da chamada.
  assert.match(ponte, /`\$\{chave\}:\$\{indice\}:\$\{i \/ LOTE\}`/);

  // Mas só espera o que é "ainda não". Uma coleção que mudou debaixo do plano não se repete.
  const quem = painel.slice(painel.indexOf('const podeEsperar ='));
  const regra = quem.slice(0, quem.indexOf('\n    const dormir'));
  assert.match(regra, /Number\(r\?\.esperarMs\) > 0/);
  assert.match(regra, /Number\(r\?\.status\) === 429/);
  assert.ok(
    !/SELECTION_CHANGED|NO_ELIGIBLE/.test(regra.replace(/\/\/.*/g, '')),
    'esses dois dizem que a coleção mudou: repetir um plano velho é o que não se faz aqui',
  );

  // E a espera não pode engolir os botões: dorme aos bocados, de olho nos dois.
  const dormir = painel.slice(painel.indexOf('const dormir = async'));
  assert.match(dormir.slice(0, 400), /!parar && !pausado/);
});

test('mexer numa faixa invalida o plano, e quem tinha teto nao perde a escolha', () => {
  // Um plano contado com outra pergunta não pode ficar na tela a convidar o clique em Extrair: os
  // números mudaram, a conta é outra, e o que se apaga é para sempre.
  const bloco = painel.slice(painel.indexOf('const mudouAFaixa ='));
  const corpo = bloco.slice(0, bloco.indexOf('const nomeDaRaridade'));
  assert.match(corpo, /plano = \[\];/);
  assert.match(corpo, /feitas = 0;/);
  assert.match(corpo, /desarmar\(\);/);
  // O padrão continua a ser o pedido original: épica, 1,40 a 1,49, e as outras desligadas.
  assert.match(painel, /faixas: \{ epic: \{ liga: true, min: 1\.4, max: 1\.49 \} \},/);
  // E quem já tinha um teto escolhido não perde a escolha por ter nascido um campo novo: "épicos
  // até N" é exatamente a faixa épica de 1,40 até N.
  assert.match(painel, /if \(Number\.isFinite\(Number\(cfg\.teto\)\)\) \{/);
  assert.match(painel, /max: duasCasas\(cfg\.teto\) \}/);
  assert.match(painel, /delete cfg\.teto;/);
  // O que chega de fora é lido campo a campo, nunca escrito direto no armazenamento.
  assert.match(painel, /const limparFaixas = \(bruto\) => \{/);
});

test('vai a cidade antes de extrair, e volta a cacada depois', () => {
  // O servidor NÃO exige isto — medido em 03/11/2026, a extração correu com a caçada a andar. Quem
  // exige é o dono, e a razão é boa: a janela do Geneticista só abre na cidade, então uma extração
  // no meio do mato não é uma coisa que ele pudesse ter feito à mão.
  assert.match(ponte, /const irParaCidade = async \(\) => \{/);
  assert.match(ponte, /if \(naCidade\(\)\) return \{ ok: true, jaEstava: true \};/);
  // Quem diz que se chegou é o mapa, não um cronómetro: `goToCity()` responde antes de carregar.
  assert.match(ponte, /await esperarAte\(naCidade, ATE_CIDADE\)/);

  const corrida = painel.slice(painel.indexOf('const extrair = async'));
  const corpo = corrida.slice(0, corrida.indexOf('const dormir') + 1 || undefined);
  // A caçada de onde se saiu lê-se ANTES de sair dela: depois do `stopHunt` já não há o que
  // perguntar, e era assim que se voltava para lugar nenhum.
  assert.ok(
    corpo.indexOf('PPX?.cacadas?.atual') < corpo.indexOf("acao: 'cidade'"),
    'a origem é lida antes da ida, nunca depois',
  );
  assert.ok(
    corpo.indexOf("acao: 'cidade'") < corpo.indexOf("acao: 'extrair'"),
    'a cidade vem antes da primeira extração',
  );
  // E a volta acontece no `finally`: acabou, parou ou falhou, não se deixa o treinador plantado.
  const fim = corrida.slice(corrida.indexOf('} finally {'));
  assert.match(fim.slice(0, 400), /await voltarACacada\(\);/);
  assert.match(painel, /if \(!cfg\.voltar \|\| !origem\?\.nome\) return;/);
});

test('o intervalo entre especies e sorteado, e configuravel', () => {
  // Pedido do dono em 03/11/2026. Além do ritmo, isto é o que evita bater no intervalo do servidor
  // a cada passo — era uma tentativa gasta por espécie.
  assert.match(painel, /const respiro = \(\) => \{/);
  const corpo = painel.slice(painel.indexOf('const respiro ='), painel.indexOf('const ler ='));
  const bloco = painel.slice(painel.indexOf('const respiro ='));
  assert.match(bloco.slice(0, 500), /Math\.round\(min \+ Math\.random\(\) \* \(max - min\)\)/);
  // Sorteado de verdade: um valor fixo aqui seria o padrão mais visível que existe.
  assert.ok(!/const RESPIRO = \d+/.test(painel), 'o respiro fixo foi substituído pelo sorteio');
  assert.match(painel, /minSeg: 3,/);
  assert.match(painel, /maxSeg: 8,/);
  // Os dois campos prendem-se, como o teto: um "0" faria disto um martelo.
  assert.match(painel, /const PAUSA_MIN = 1;/);
  assert.match(painel, /Math\.min\(PAUSA_MAX, Math\.max\(PAUSA_MIN,/);
  assert.ok(corpo.length >= 0);
});

test('a agenda usa o calendario de sempre, e nao pergunta de madrugada', () => {
  // Nenhum painel deste pacote desenha controles de dia próprios. Ver o AGENTS.md.
  assert.match(painel, /calendario\(\)\?\.montarControles\(\{/);
  assert.match(painel, /calendario\(\)\?\.esperaDaAgenda\(\{ horarios: cfg\.horarios, dias: cfg\.dias \}, cfg\.ultima\)/);
  // Procura SEMPRE antes de extrair: um plano de ontem é uma lista de Pokémon que podem já não
  // existir — ou, pior, outros que entretanto entraram e que ninguém viu.
  const rodada = painel.slice(painel.indexOf('const rodadaAgendada ='));
  const corpo = rodada.slice(0, rodada.indexOf('const bater ='));
  assert.ok(
    corpo.indexOf('await procurar()') < corpo.indexOf('await extrair()'),
    'a agenda procura antes de extrair, sempre',
  );
  assert.match(corpo, /if \(!plano\.length\) return;/);
  // O carimbo é gravado ANTES da corrida: uma falha a meio não pode devolver a mesma janela e
  // pôr a ferramenta a tentar em laço.
  assert.ok(corpo.indexOf('cfg.ultima = Date.now()') < corpo.indexOf('await procurar()'));
  // E o carimbo não viaja no exportar: é o relógio desta conta. Ver o config.js.
  const coletar = painel.slice(painel.indexOf('coletar: () => ({'));
  const dentro = coletar.slice(0, coletar.indexOf('}),'));
  assert.ok(!/ultima|ligada/.test(dentro), 'nem o carimbo nem o "ligada" viajam');
});

test('ela esta no catalogo, no manifest e pede a vez', () => {
  assert.match(ler('nucleo.js'), /\{ id: 'genetica', nome: 'Genética', atalhos: 'configuração pelo menu \(Alt\+Q\)' \}/);
  const manifest = JSON.parse(ler('manifest.json'));
  const isolado = manifest.content_scripts.find((b) => b.js.includes('raridades.js'));
  const pagina = manifest.content_scripts.find((b) => b.world === 'MAIN');
  assert.ok(isolado.js.includes('genetica.js'), 'o painel entra no mundo da extensão');
  assert.ok(pagina.js.includes('genetica-main.js'), 'a ponte entra no mundo da página');
  // A fila vale para toda automação. Ver AGENTS.md.
  assert.match(painel, /const MINHA_VEZ = 'genetica';/);
  const corrida = painel.slice(painel.indexOf('const extrair = async'));
  assert.ok(
    corrida.indexOf('esperarAVez') < corrida.indexOf("acao: 'extrair'"),
    'a vez é pedida antes da primeira chamada que apaga',
  );
});

test('escrever um numero numa raridade desligada nao parte a faixa', () => {
  // O BUG, achado na revisão de 03/11/2026: o campo gravava `{ ...cfg.faixas[chave], [qual]: v }`,
  // e numa raridade que o dono nunca ligou essa chave não existe. O spread de `undefined` gravava
  // uma faixa com um limite só: o outro campo ficava em branco no redesenho e, se a caixa fosse
  // marcada, `faixasLigadas` fazia `Math.min(undefined, x)` → NaN, que não casa com nada e não
  // explica porque. Parte-se do `f` desenhado, que tem sempre os dois limites e o `liga`.
  const bloco = painel.slice(painel.indexOf('const desenharFaixas ='), painel.indexOf('const desenhar ='));
  assert.match(bloco, /cfg\.faixas\[chave\] = \{ liga: false, \.\.\.f, \[qual\]: duasCasas\(preso\) \};/);
  assert.ok(
    !/\.\.\.cfg\.faixas\[chave\], \[qual\]/.test(bloco),
    'o spread não parte de uma chave que pode não existir',
  );
});
