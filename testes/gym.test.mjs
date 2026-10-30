// Guardas da ferramenta do ginásio.
//
// Como `times.js`, ela só existe contra o DOM do jogo e não dá para exercitar fora dele — o que se
// protege aqui são as decisões, cada uma comprada com uma medição na conta real. A parte viva foi
// provada em `testes/banca-gym.html`, onde a máquina de estados atravessa um F5 de verdade.
//
// Rode com: node --test testes/*.test.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Lido sem os \r: a arvore de trabalho do Windows vem em CRLF e a da CI em LF, e um guarda que
// casa duas linhas seguidas da' fonte so' falhava de um dos lados. Oito deles, em 26/10/2026.
const ler = (arquivo) =>
  readFileSync(new URL(`../${arquivo}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const gym = ler('gym.js');
const codigo = gym
  .split('\n')
  .filter((linha) => !/^\s*(\/\/|\*|\/\*)/.test(linha))
  .join('\n');

test('o fim do combate e lido no resultado, nunca no cronometro', () => {
  // Medido: o cronômetro marcava 15 min num combate que durou 67 s. Ele é o teto, não a duração —
  // esperar ele zerar seria esperar 14 minutos depois de já ter vencido.
  assert.match(codigo, /const titulo = tituloDoResultado\(\);/);
  assert.match(codigo, /venceu: \/vit\[óo\]ria\/i\.test\(texto\)/);
  // E o cronômetro aparece só na tela, como sinal de vida.
  assert.match(codigo, /Lutando… \$\{relogioDoCombate\(\)\}/);
});

test('a espera pelo combate tem saida para os dois casos tristes', () => {
  // Uma aba que caiu, ou um F5 dado à mão, não podem deixar a ferramenta presa para sempre.
  // Só se desiste depois de **ter visto** o combate: antes dele há o cinema de entrada, e a
  // ausência do cronômetro ali é normal, não é queda.
  assert.match(codigo, /else if \(viuOCombate\)/);
  assert.match(codigo, /PACIENCIA_SEM_SINAL/);
  assert.match(codigo, /TETO_DO_COMBATE/);
  // `.pvp-battle-clock` é o marcador de "ainda lutando": `.pokeidle-gym-battle` é a raiz do jogo
  // inteiro e existe sempre, então não serve para isto.
  assert.match(
    codigo,
    /const combateEmCurso = \(\) =>\s*Boolean\(document\.querySelector\('\.pvp-battle-clock'\)\)/s,
  );
  assert.doesNotMatch(codigo, /querySelector\('\.pokeidle-gym-battle'\)/);
});

/** A lista de etapas lida do próprio ficheiro, para a ordem ser percorrida e não só casada. */
const etapas = JSON.parse(
  codigo
    .slice(codigo.indexOf('const ETAPAS = ['))
    .match(/\[[^\]]*\]/s)[0]
    .replace(/'/g, '"')
    .replace(/,(\s*])/g, '$1'),
);
/** Os nomes das recargas, também lidos do ficheiro. */
const recargas = Object.keys(
  Object.fromEntries(
    [...codigo.slice(codigo.indexOf('const RECARGAS = {')).matchAll(/'?([\w-]+)'?:/g)]
      .map((m) => [m[1], true])
      .slice(0, 2),
  ),
);

test('o F5 e uma etapa, e a seguinte e gravada antes dele', () => {
  // Medido: com seis Pokémon no HUD, o painel do ginásio insistia em "equipados 1/3" mesmo depois
  // de fechar e reabrir. Só a recarga acerta. Daí a etapa — e daí a máquina de estados guardada.
  assert.deepEqual(etapas, [
    'sair',
    // Ver antes de montar: o time de cada ginasio so' se escolhe sabendo o ginasio de hoje.
    'ver-ginasio',
    'time-gym',
    'recarregar',
    'desafiar',
    'recarregar-volta',
    'time-volta',
    'voltar',
  ]);
  const bloco = codigo.slice(codigo.indexOf('if (RECARGAS[etapa])'));
  const grava = bloco.indexOf('dados.etapa = ETAPAS[ETAPAS.indexOf(etapa) + 1]');
  const recarrega = bloco.indexOf('location.reload()');
  assert.ok(grava >= 0 && grava < recarrega, 'recarrega antes de gravar a etapa seguinte');
  // Sem isso a página voltaria, repetiria esta etapa e recarregaria outra vez, para sempre.

  // **E nenhuma recarga pode ser a última etapa.** O destino sai da ordem da lista: se uma recarga
  // ficasse no fim, `ETAPAS[i + 1]` seria `undefined`, a tarefa gravaria uma etapa que não existe
  // e a corrida morreria depois do F5, calada.
  assert.equal(recargas.length, 2);
  for (const nome of recargas) {
    const onde = etapas.indexOf(nome);
    assert.ok(onde >= 0, `${nome} está em RECARGAS mas não em ETAPAS`);
    assert.ok(onde < etapas.length - 1, `${nome} é a última etapa e não teria para onde seguir`);
  }
});

test('a pagina e atualizada antes de montar o time da cacada', () => {
  // Pedido do utilizador: "antes de montar o time para ir para a hunt atualize a página, pois
  // estou vendo dar erros". Faz sentido com o que já se sabe deste ponto da sequência — a página
  // chega ali depois do cinema, da tela de resumo e dos banners que nascem por cima dela, e é a
  // parte mais suja da corrida.
  //
  // Esta recarga não é da mesma natureza da primeira: aquela conserta uma leitura errada do jogo,
  // medida; esta é precaução. O custo é uns segundos num orçamento de 2 a 3 minutos.
  const recarga = etapas.indexOf('recarregar-volta');
  assert.equal(etapas[recarga + 1], 'time-volta', 'a recarga vem imediatamente antes do time');

  // O orçamento da saída tem de começar NA recarga, e não depois dela: `alvoSaida` é marcado ao
  // entrar em `DA_SAIDA[0]`, e se a recarga ficasse fora da fase o tempo da volta seria repartido
  // a partir de uma página que já tinha recarregado — ou não seria marcado nenhum.
  assert.match(codigo, /DA_SAIDA = \['recarregar-volta', 'time-volta', 'voltar'\]/);
  assert.match(codigo, /'recarregar-volta': 0,/);

  // **O resultado do combate é gravado antes de a página ir embora.** Sem isto a recarga apagaria
  // quem ganhou, e o placar do dia registaria uma vitória como derrota — ou nada.
  const desafiar = codigo.slice(
    codigo.indexOf("if (etapa === 'desafiar')"),
    codigo.indexOf("if (etapa === 'time-volta')"),
  );
  const gravou = desafiar.indexOf('guardarTarefa(dados);');
  assert.ok(desafiar.indexOf('dados.resultado = luta.texto') < gravou);
  assert.ok(desafiar.indexOf('dados.venceu = luta.venceu') < gravou);

  // E quem espera o anúncio nascer é a carga seguinte, não a etapa que recarrega: o anúncio que
  // atrapalha é justamente o que ainda não existe deste lado do F5.
  const retomada = codigo.slice(codigo.indexOf('const retomar = async () =>'));
  const limpa = retomada.indexOf('esperarTelaLimpa(15000');
  assert.ok(limpa >= 0 && limpa < retomada.indexOf('continuarTarefa()'));
});

test('a cacada e guardada antes do primeiro passo', () => {
  // Depois de sair dela já não há como saber de onde se saiu: o nome só existe enquanto ela corre.
  // O botão e a agenda começam pelo mesmo caminho: `comecar`. O automático não pode ser um
  // segundo fluxo, com os seus próprios enganos.
  const bloco = codigo.slice(codigo.indexOf('const comecar = (regiao)'));
  assert.match(bloco, /cacada: cacadaAtiva\(\)/);
  assert.match(
    codigo,
    /campo\('\[data-ir\]'\)\.addEventListener\('click', \(\) => \{\s*if \(correndo \|\| tarefa\(\)\) return;\s*comecar\(/,
  );
  assert.match(codigo, /\.platform-hunt__zone-name/);
  assert.match(codigo, /\.platform-hunt__zone-meta/);
});

test('espera os ginasios aparecerem, e a falha diz o que viu', () => {
  // Relatado com captura: "não há ginásio marcado HOJE em KANTO" com o HOJE bem visível na tela.
  // A janela entra no DOM antes do conteúdo — terceira vez que esta lição aparece no pacote, e a
  // primeira em que eu a ignorei num mapa que é uma imagem grande.
  assert.match(codigo, /const ginasioDeHoje = \(janela\) =>\s*\n?\s*ate\(/);
  assert.match(codigo, /const hoje = await ginasioDeHoje\(janela\)/);
  // Aceita as duas marcas: a classe e o texto do rótulo.
  assert.match(codigo, /h\.className\.includes\('is-active'\) \|\| \/\^HOJE\/i\.test/);
  // E a falha lista os ginásios que encontrou, em vez de só dizer o que faltou.
  assert.match(codigo, /vi \$\{todos\.length\} gin[áa]sios e nenhum marcado HOJE/);
  assert.match(codigo, /a janela abriu mas os gin[áa]sios n[ãa]o chegaram a aparecer/);
});

test('a Elite Four fica de fora', () => {
  // Pedido explícito. Ela é um hotspot como os outros, distinguida só pela classe da liga.
  assert.match(codigo, /!h\.className\.includes\('gym-hotspot--league'\)/);
});

test('a Elite 4 de cada regiao pode ser marcada manualmente por dia', () => {
  assert.match(codigo, /const CHAVE_ELITE4 = 'lioncode:gym:elite4';/);
  // O botao e' desenhado por regiao, a partir da lista: escrever as regioes a mao no HTML era
  // o que deixava o Hoenn de fora quando ele chegou.
  assert.match(codigo, /data-elite4="\$\{r\}"/);
  assert.match(codigo, /const elite4Feita = \(regiao\) => elite4\(\)\[regiao\]\?\.dia === diaDoServidor\(\);/);
  assert.match(codigo, /if \(feita\) todos\[regiao\] = \{ dia: diaDoServidor\(\), quando: Date\.now\(\) \};/);
  const marcar = codigo.slice(codigo.indexOf('const marcarElite4 = (regiao)'));
  const corpo = marcar.slice(0, marcar.indexOf('\n    };'));
  assert.doesNotMatch(corpo, /comecar\(|continuarTarefa|guardarAgenda/, 'a marca não inicia nem agenda combate');
  assert.match(codigo, /botao\.classList\.toggle\('feita', feita\)/);
});

test('o modo minimizado mostra e permite corrigir a Elite 4 de cada regiao', () => {
  assert.match(codigo, /elite\.className = 'linha elite4-resumo';/);
  assert.match(codigo, /tituloElite\.textContent = 'Elite 4';/);
  assert.match(codigo, /botao\.dataset\.elite4 = regiao;/);
  // A inicial sai do nome da regiao: um 'K' ou 'J' escrito a mao da' 'J' ao Hoenn.
  assert.match(codigo, /nomeDe\(regiao\)\[0\]\.toUpperCase\(\)/);
  assert.match(codigo, /\.elite4-mini\.feita/);
});

test('uma falha nao recomeca do zero', () => {
  // A tarefa fica guardada na etapa em que parou. Sair da caçada duas vezes não faria sentido.
  const bloco = codigo.slice(codigo.indexOf('async function falhou'));
  // Só a desistência apaga a tarefa; o reagendamento, não — daí a janela ser o trecho entre o
  // fim do `if` do teto e o fim da função.
  const entreTentativas = bloco.slice(bloco.indexOf('dados.proxima ='));
  assert.doesNotMatch(
    entreTentativas.slice(0, entreTentativas.indexOf('agendar();')),
    /limparTarefa/,
  );
  assert.match(codigo, /dados\.proxima = Date\.now\(\) \+ ESPERA_APOS_FALHA/);
  assert.match(codigo, /ESPERA_APOS_FALHA = 10 \* 60 \* 1000/);
});

test('tres tentativas e para, em vez de insistir para sempre', () => {
  // Era um laço sem fim: um erro que não passa sozinho — o time apagado, o ginásio já feito hoje,
  // a conta deslogada — virava uma tentativa de dez em dez minutos, para sempre, mexendo no jogo
  // sem ninguém olhando.
  assert.match(codigo, /const MAX_TENTATIVAS = 3;/);
  const bloco = codigo.slice(codigo.indexOf('async function falhou'));
  assert.match(bloco, /if \(dados\.tentativas >= MAX_TENTATIVAS\) \{/);
  const desistencia = bloco.slice(
    bloco.indexOf('MAX_TENTATIVAS) {'),
    bloco.indexOf('dados.proxima ='),
  );
  // A tarefa morta tem de sair: enquanto ela existe, `emCorrida()` responde que sim, os botões
  // ficam travados e a agenda do dia não arranca — o painel ficaria preso para sempre.
  assert.match(desistencia, /limparTarefa\(\);/);
  assert.match(desistencia, /travarBotoes\(false\);/);
  assert.match(desistencia, /clearTimeout\(agendado\);/);
  // O resultado fica no placar, senão a desistência passaria despercebida a quem não estava à
  // frente do ecrã.
  assert.match(desistencia, /anotarPlacar\(dados\.regiao, 'erro', erro\);/);
});

test('nao se abre janela com um menu da barra aberto, nem com banner na frente', () => {
  // As duas coisas fazem o jogo recusar abrir janelas, e o banner nasce logo depois de cada
  // recarga — na prova real ele apareceu por cima da tela de combate.
  // A garantia vive em quem abre, e nao em cada chamador: `abrirNaRegiao` e' o unico caminho
  // para a janela do ginasio, e e' la' que a tela e' limpa e os menus fechados. Deixa-lo a cargo
  // de quem chama faz de um chamador esquecido um defeito que so' aparece com anuncio na tela.
  const abrir = codigo.slice(codigo.indexOf('const abrirNaRegiao = async'));
  const limpeza = abrir.indexOf('esperarTelaLimpa');
  const menus = abrir.indexOf('fecharMenus()');
  const abre = abrir.indexOf('abrirOGinasio()');
  assert.ok(limpeza >= 0 && limpeza < abre, 'abre o ginásio sem esperar a tela limpar');
  assert.ok(menus >= 0 && menus < abre, 'abre o ginásio com um menu da barra aberto');
  // E nenhuma etapa pode voltar a abrir a janela por fora, passando ao lado dessa garantia.
  const etapasDoCodigo = codigo.slice(codigo.indexOf("if (etapa === 'sair')"));
  assert.doesNotMatch(
    etapasDoCodigo,
    /await abrirOGinasio\(\)/,
    'uma etapa voltou a abrir o ginásio por fora de `abrirNaRegiao`',
  );
});

test('as janelas sao fechadas com um clique so', () => {
  // A lição que custou uma sessão inteira: clicar no ✕ de uma janela que já saiu da tela convence
  // o jogo de que há uma janela aberta, e ele recusa tudo até um F5.
  assert.doesNotMatch(codigo, /isConnected/);
  const bloco = codigo.slice(codigo.indexOf('const fecharJanela'));
  const fim = bloco.indexOf('\n    };');
  assert.doesNotMatch(bloco.slice(0, fim), /for \(|while \(/);
});

test('os dois ciclos tem os tempos pedidos, e o da saida comeca depois do combate', () => {
  // Pedido: 1 a 2 min antes do ginásio, 2 a 3 min depois dele.
  assert.match(codigo, /const CICLO_PRE = \[60000, 120000\]/);
  assert.match(codigo, /const CICLO_SAIDA = \[120000, 180000\]/);
  // O orçamento da saída não pode nascer com a corrida: entre as duas fases há o combate, que
  // dura o que durar — medido, 67 s — e não se desconta de nada.
  assert.match(codigo, /if \(seguinte === DA_SAIDA\[0\] && !dados\.alvoSaida\)/);
  // E o da entrada é guardado, senão o F5 do meio do caminho levava-o consigo.
  assert.match(codigo, /alvoPre: Date\.now\(\) \+ sorteio\(CICLO_PRE\[0\], CICLO_PRE\[1\]\)/);
});

test('a espera longa diz na tela que e proposital', () => {
  // Estas pausas passam de meio minuto. Sem dizer nada, a ferramenta pareceria travada e o
  // utilizador carregaria no botão outra vez.
  assert.match(codigo, /Esperando um pouco… \$\{faltam\} s/);
  // E uma espera longa tem de poder ser interrompida.
  assert.match(codigo, /while \(Date\.now\(\) < fim\) \{\s*\n\s*if \(parar\) return;/);
});

test('os cliques sao de gente, com reserva para onde isso nao funciona', () => {
  // O ponteiro chega, hesita, e só então carrega; e o ponto de contacto não é o centro exacto.
  assert.match(codigo, /const clicarHumano = async \(el\)/);
  assert.match(codigo, /await espera\(Math\.round\(sorteio\(120, 420\)\)\);/);
  assert.match(codigo, /clicar\(el, sorteio\(-1, 1\)\)/);
  // A reserva vem de uma medição desta sessão: a sequência completa de ponteiro nos botões da
  // barra de cima impedia o inventário de abrir. Onde o humano falhar, o simples funciona.
  const bloco = codigo.slice(codigo.indexOf('const clicarEEsperar'));
  assert.match(bloco.slice(0, bloco.indexOf('};')), /el\.click\(\);/);
});

test('a ultima cacada e lembrada, para o botao de voltar funcionar sozinho', () => {
  // O nome da caçada só existe no DOM enquanto ela corre: depois de sair, não há de onde tirá-lo.
  assert.match(codigo, /const lembrarCacada = \(\)/);
  assert.match(codigo, /setInterval\(lembrarCacada, 10000\)/);
  assert.match(codigo, /cacada: cacadaAtiva\(\) \|\| ler\(CHAVE_ULTIMA, null\)/);
  // E o botão existe, com saída clara quando não há nada lembrado.
  assert.match(codigo, /campo\('\[data-voltar\]'\)\.addEventListener/);
  assert.match(gym, /Não sei de qual caçada você saiu/);
});

test('espera a tela ficar limpa, porque o anuncio nasce atrasado', () => {
  // O defeito que isto conserta: "não consegui abrir a janela do ginásio". O seletor de fechar
  // sempre esteve certo — o problema era o momento. O anúncio do Discord nasce alguns segundos
  // DEPOIS da recarga, e a ferramenta fechava os banners antes de ele existir: encontrava a tela
  // limpa, seguia, e o anúncio aparecia mesmo a tempo de o jogo recusar abrir a janela.
  assert.match(codigo, /const esperarTelaLimpa = async/);
  // Fechar uma vez não basta: insiste até a tela ficar quieta por três voltas seguidas.
  assert.match(codigo, /if \(quieto >= 3\) return true;/);
  // E há rede para o anúncio que não estiver na lista de seletores conhecidos.
  assert.match(codigo, /const haSobreposto = \(\)/);
  assert.match(codigo, /zIndex \|\| 0\) >= 10000/);
  // Os painéis deste pacote e as janelas do jogo não contam como anúncio.
  assert.match(codigo, /e\.closest\('\.pokeidle-panel'\) \|\| e\.id\.startsWith\('lioncode-'\)/);
});

test('a limpeza acontece depois da recarga e antes de cada abertura', () => {
  // A etapa `desafiar` vem logo depois do F5, que é exactamente quando o anúncio nasce.
  const desafiar = codigo.slice(codigo.indexOf("if (etapa === 'desafiar')"));
  const limpa = desafiar.indexOf('esperarTelaLimpa');
  const abre = desafiar.indexOf('abrirNaRegiao(');
  // Esta etapa vem logo a seguir ao F5 e espera 15 s, mais do que a espera de quem abre: o
  // anúncio nasce com a página, e é aqui que ele custa caro.
  assert.ok(limpa >= 0 && limpa < abre, 'abre o ginásio sem esperar a tela limpar');
  // E há segunda tentativa, para o anúncio que aparecer entre a limpeza e o clique.
  const abrirNaRegiao = codigo.slice(codigo.indexOf('const abrirNaRegiao = async'));
  assert.match(
    abrirNaRegiao.slice(0, abrirNaRegiao.indexOf('return { janela }')),
    /janela = await abrirOGinasio\(\);/,
  );
  // A retomada depois do F5 também espera, em vez de uma pausa fixa de 1,5 s.
  assert.match(codigo, /travarBotoes\(true\);\s*\n\s*await esperarTelaLimpa/);
});

test('minimizado fica so a etiqueta GYM', () => {
  // Medido na banca: 240x337 cheio, 90x32 minimizado.
  assert.match(codigo, /minimizado \? 'GYM' : 'Gin[áa]sio do dia'/);
  assert.match(codigo, /#lioncode-gym\.minimizado \.corpo \{ display: none; \}/);
  assert.match(codigo, /gravar\(CHAVE_MIN, minimizado\)/);
  // E aplicado na carga, senão a escolha guardada só valeria depois de clicar outra vez —
  // exactamente o erro cometido antes em `times.js`.
  assert.ok(
    codigo.indexOf('const recolocar = () =>') < codigo.lastIndexOf('aplicarMinimo();'),
    'aplicarMinimo() é chamado antes de `recolocar` existir',
  );
});

test('voltar para a cacada tambem troca o time', () => {
  // Relatado assim: "cliquei em voltar para a caçada e ele não trocou meu time". O painel mostra
  // "Voltar com" mesmo por cima deste botão — ignorar esse campo era a interface prometer uma
  // coisa e fazer outra.
  const bloco = codigo.slice(codigo.indexOf("campo('[data-voltar]').addEventListener"));
  const corpo = bloco.slice(0, bloco.indexOf('\n    });'));
  const troca = corpo.indexOf('await trocarTime(paraOTime)');
  const volta = corpo.indexOf('await voltarACacada(');
  assert.ok(troca >= 0, 'o botão de voltar não troca o time');
  assert.ok(troca < volta, 'volta à caçada antes de montar o time');
  // Já numa caçada, troca o time e para por aí — não faz sentido reentrar no que já se está.
  assert.match(corpo, /if \(jaNaCacada\)/);
  // E segue o mesmo orçamento do fim de um ginásio, que é a mesma sequência feita à mão.
  assert.match(corpo, /sorteio\(CICLO_SAIDA\[0\], CICLO_SAIDA\[1\]\)/);
});

test('o painel nao deixa botao clicavel que nao faz nada', () => {
  // Durante os dez minutos de espera o "Fazer o ginásio" continuava clicável e era ignorado em
  // silêncio. Um botão que ignora o utilizador é pior do que um botão desligado.
  const bloco = codigo.slice(codigo.indexOf('function agendar()'));
  assert.match(bloco.slice(0, bloco.indexOf('}')), /travarBotoes\(true\)/);
});

test('o tempo esta entre os cliques, e nao antes das etapas', () => {
  // Relatado: "mal entrou a página de vitória já disparou a troca de times". O orçamento era
  // repartido por etapa, e dentro de cada etapa os cliques saíam todos de rajada. Quem respira
  // agora é o próprio clique.
  assert.match(
    codigo,
    /const clicarHumano = async \(el\) => \{\s*await respirarAntesDoClique\(\);/,
  );
  // Nenhum clique sai no mesmo instante do anterior, nem com o orçamento estourado.
  assert.match(codigo, /const PAUSA_ENTRE_CLIQUES = 1500;/);
  assert.match(codigo, /Math\.max\(PAUSA_ENTRE_CLIQUES, justo \* sorteio\(/);
  // O orçamento da fase é reaberto a cada etapa, porque o F5 do meio leva a memória consigo.
  assert.match(codigo, /abrirRitmo\(dados\.alvoPre, cliquesQueFaltam\(DA_ENTRADA, etapa\)\)/);
  assert.match(codigo, /abrirRitmo\(dados\.alvoSaida, cliquesQueFaltam\(DA_SAIDA, etapa\)\)/);
  // E a pausa por etapa deixou de existir: tê-la junto com a do clique estouraria o orçamento.
  assert.doesNotMatch(codigo, /respirarAte\(/);
});

test('o resumo da partida e confirmado, e so depois se mexe no time', () => {
  // O título "Vitória!" entra antes do resto do resumo; o botão Continuar é o último a chegar.
  // Procurar uma vez só não encontrava nada, e a ferramenta seguia com o resumo aberto por cima.
  assert.match(codigo, /const botao = await ate\(botaoDoResumo, 30000\)/);
  // Aceita o botão pela classe ou pelo texto.
  assert.match(codigo, /\^\(continuar\|confirmar\|ok\|fechar\)\$/i);
  // E ninguém confirma um resumo no instante em que ele aparece.
  assert.match(codigo, /await dormir\(Math\.round\(sorteio\(3000, 7000\)\), avisar\)/);
  // A confirmação acontece antes da etapa do time de volta, que é a seguinte na lista.
  const ordem = ['continuarDoResumo(', "etapa === 'time-volta'"].map((t) => codigo.indexOf(t));
  assert.ok(ordem[0] > 0 && ordem[0] < ordem[1], 'o resumo tem de ser confirmado antes do time');
  // Falhar aqui não pode parar a corrida: a tarefa ficaria na etapa `desafiar` e a tentativa
  // seguinte desafiaria outra vez um ginásio já feito.
  assert.match(codigo, /sigo mesmo assim/);
});

test('entre o resumo e a mochila ha uma pausa', () => {
  // "Mal entrou a página de vitória já disparou a troca de times." A troca em si é do Times, com o
  // ritmo dele; o que faltava era o tempo ANTES de a mochila abrir.
  assert.match(codigo, /'time-volta': 1,/);
  const bloco = codigo.slice(codigo.indexOf("etapa === 'time-volta'"));
  assert.match(bloco.slice(0, 300), /await respirarAntesDoClique\(/);
});

test('a lista de times pode ser relida sem recarregar a pagina', () => {
  // Um time guardado depois de o painel subir não aparecia aqui até um F5 — e um F5 no meio de
  // uma caçada é caro.
  assert.match(codigo, /data-recarregar/);
  const bloco = codigo.slice(codigo.indexOf("campo('[data-recarregar]').addEventListener"));
  const corpo = bloco.slice(0, bloco.indexOf('\n    });'));
  assert.match(corpo, /encherTimes\(\)/);
  // Reler não pode tocar no jogo, nem recarregar nada.
  assert.doesNotMatch(corpo, /location\.reload|clicarHumano|clicar\(/);
  // E uma escolha feita na tela não pode ser desfeita por encher as listas outra vez.
  assert.match(codigo, /const manter = nomes\.includes\(naTela\) \? naTela : escolhido;/);
  // Durante uma corrida o botão fica travado, como os outros.
  assert.match(codigo, /campo\('\[data-recarregar\]'\)\.disabled = sim;/);
});

test('o botao de confirmar o resumo so serve se estiver ligado', () => {
  // Relatado na prática: "a tela de confirmação quando ganha o gym não está sendo clicada". A tela
  // diz, por cima do botão, "Resultado e recompensas confirmados" — ele nasce desligado enquanto o
  // jogo confirma. Esperar o botão APARECER não chega; tem de se esperar que ele LIGUE.
  assert.match(codigo, /if \(el\.disabled\) return false;/);
  assert.match(codigo, /aria-disabled'\) === 'true'/);
  assert.match(codigo, /const botaoDoResumo = \(\) => candidatosDoResumo\(\)\.find\(clicavel\)/);
  // E insiste: o botão pode voltar a desligar-se entre o olhar e a mão.
  assert.match(codigo, /for \(let volta = 0; volta < 4; volta \+= 1\)/);
  // Falhar aqui diz o que viu, com a marca de desligado — como nos ginásios.
  assert.match(codigo, /\(desligado\)/);
});

test('a agenda e a mesma da venda e da loja rapidas', () => {
  // Pedido assim: "vou colocar o range de horario igual ao do de vendas e compras". O formato e a
  // logica sao os de la' — janela por virgula, instante sorteado dentro da janela, UMA rodada por
  // janela —, e nao um desenho novo.
  // **Esta asserção era ao contrário, e deixou de fazer sentido.** Ela exigia que o ginásio e a
  // venda tivessem as MESMAS linhas de código de horário — a duplicação era a garantia de que o
  // comportamento era o mesmo. Com "toda semana" e "todo mês", manter três cópias seria acrescentar
  // o mesmo defeito em três lugares e corrigi-lo em dois. Agora o calendário é um só, e o que se
  // protege é isso: ninguém volta a ter a conta em casa.
  const venda = ler('venda-rapida.js');
  const loja = ler('loja-rapida.js');
  for (const [nome, fonte] of [
    ['ginásio', codigo],
    ['venda', venda],
    ['loja', loja],
  ]) {
    assert.match(fonte, /PPX\?\.agenda/, `${nome} não usa o calendário partilhado`);
    assert.doesNotMatch(
      fonte,
      /const minuto = \(hora, min\) =>/,
      `${nome} voltou a ter a leitura de horário em casa`,
    );
    assert.doesNotMatch(fonte, /abre <= ultima/, `${nome} voltou a ter a conta da janela em casa`);
  }
  // Uma janela por regiao, porque as regioes pedem times diferentes.
  assert.match(codigo, /const REGIOES = \['KANTO', 'JOHTO', 'HOENN'\]/);
  assert.match(codigo, /const timesDe = \(regiao\) => escolhas\(\)\.porRegiao\[regiao\]/);
});

test('a janela e marcada como usada antes de comecar, por causa do F5', () => {
  // A corrida passa por uma recarga no meio. Um relogio que so' existisse em memoria voltaria a
  // disparar na mesma janela — desafiando outra vez um ginasio ja' feito.
  const bloco = codigo.slice(codigo.indexOf('const dispararAuto = (regiao)'));
  const corpo = bloco.slice(0, bloco.indexOf('\n    };'));
  const marca = corpo.indexOf('guardarAgenda(nova)');
  const roda = corpo.indexOf('comecar(regiao)');
  assert.ok(marca >= 0 && roda > marca, 'marca a janela antes de comecar a corrida');
});

test('o sinal de cada regiao conta o dia do servidor, e nao o da maquina', () => {
  // Verde ganhou, vermelho perdeu, laranja deu erro, cinza ainda nao foi feito hoje.
  assert.match(codigo, /vitoria: \['#3fb950'/);
  assert.match(codigo, /derrota: \['#f85149'/);
  assert.match(codigo, /erro: \['#d29922'/);
  assert.match(codigo, /vazio: \['#424a57'/);
  // O dia e' contado a partir da hora em que o servidor reseta, que e' um campo — inventar a hora
  // deixaria o sinal verde depois do reset, ou cinza antes dele.
  assert.match(codigo, /d\.setMinutes\(d\.getMinutes\(\) - horaDoReset\(\)\)/);
  assert.match(
    codigo,
    /if \(!linha \|\| linha\.dia !== diaDoServidor\(\)\) return \{ estado: 'vazio' \}/,
  );
  // Derrota nao e' erro: sao estados diferentes, com cores diferentes.
  assert.match(codigo, /dados\.venceu === false \? 'derrota' : 'vitoria'/);
  assert.match(codigo, /anotarPlacar\(dados\.regiao, 'erro', erro\)/);
});

test('os dois cinemas sao coisas diferentes', () => {
  // Medido no jogo, com captura do DOM durante uma corrida de Johto: ANTES da luta o titulo e'
  // "Desafio de ginásio" e o `.regional-cinema__skip` e' "Entrar na arena"; DEPOIS dela vem
  // "Vitória!"/"Derrota!". Os dois usam as mesmas classes.
  //
  // Tomar o primeiro pelo segundo foi a raiz do defeito que passou tres versoes por consertar: a
  // ferramenta via o titulo da entrada, marcava DERROTA (porque "Desafio de ginásio" nao casa
  // com "vitória") e ia montar o time de volta antes de a luta comecar.
  assert.match(codigo, /const RESULTADO = \/\(vit\[óo\]ria\|derrota\|empate\)\/i/);
  assert.match(
    codigo,
    /const tituloDoResultado = \(\) => \(RESULTADO\.test\(textoDoCinema\(\)\) \? cinema\(\) : null\)/,
  );
  assert.match(
    codigo,
    /const noCinemaDeEntrada = \(\) => Boolean\(cinema\(\)\) && !RESULTADO\.test\(textoDoCinema\(\)\)/,
  );
  // O resultado NAO pode ser reconhecido pela mera presenca do elemento.
  assert.doesNotMatch(codigo, /tituloDoResultado = \(\) => document\.querySelector/);
  // E ha' um clique proprio para entrar na arena, que nao e' o de confirmar o resumo.
  assert.match(codigo, /const entrarNaArena = async \(avisar\)/);
  const desafiar = codigo.slice(codigo.indexOf("if (etapa === 'desafiar')"));
  const entra = desafiar.indexOf('entrarNaArena(');
  const espera = desafiar.indexOf('esperarOCombate(');
  assert.ok(entra >= 0 && entra < espera, 'entra na arena antes de esperar o combate');
});

test('cada regiao tem o seu botao de ir, e ele vive tambem no minimizado', () => {
  // Minimizado é o estado em que este painel vive. Mandar abrir o painel inteiro para clicar num
  // botão desfaz o motivo de o ter minimizado — era esse o pedido.
  assert.match(codigo, /data-ir-regiao="\$\{r\}"/, 'um botao por regiao, saido da lista');
  assert.match(codigo, /ja\.dataset\.irRegiao = regiao;/, 'o resumo minimizado faz o seu');

  const clique = codigo.slice(codigo.indexOf("evento.target.closest?.('[data-ir-regiao]')"));
  const corpo = clique.slice(0, clique.indexOf('\n    });'));
  // **O mesmo caminho do botão de sempre.** Um segundo fluxo de "ir ao ginásio" teria os seus
  // próprios enganos: a caçada guardada antes de sair, o alvo sorteado, a máquina de estados.
  assert.match(corpo, /comecar\(regiao\)/);
  assert.match(corpo, /emCorrida\(\)/, 'recusa enquanto algo está a correr');
  // A corrida guardada conta tanto quanto a variável: depois de um F5 no meio do ciclo, `correndo`
  // é falso numa página onde o ginásio ainda está a meio caminho.
  assert.match(codigo, /const emCorrida = \(\) => correndo \|\| Boolean\(tarefa\(\)\);/);

  const travar = codigo.slice(codigo.indexOf('const travarBotoes = (sim) => {'));
  assert.match(
    travar.slice(0, travar.indexOf('\n    };')),
    /\[data-ir-regiao\]/,
    'os botões novos travam junto com os outros',
  );
});

test('minimizado mostra o placar, e so esconde o que tapa o jogo', () => {
  // Minimizado era so' a etiqueta `GYM`. Esta' errado: minimizado e' justamente o estado em que o
  // ginasio corre sozinho, e abrir o painel inteiro so' para ver se o ponto ja' esta' verde
  // desfaz o motivo de o ter minimizado.
  assert.match(codigo, /<div class="resumo" data-resumo><\/div>/);
  assert.match(codigo, /#lioncode-gym \.resumo \{ display: none; \}/);
  assert.match(codigo, /#lioncode-gym\.minimizado \.resumo \{/);
  // O que tapa o jogo — as listas e os campos — continua escondido.
  assert.match(codigo, /#lioncode-gym\.minimizado \.corpo \{ display: none; \}/);
  // A palavra fica escrita: ninguem para o mouse em cima de um ponto de dez pixels para saber
  // como acabou o ginasio de hoje.
  assert.match(codigo, /diz\.textContent = emAndamento \? 'indo…' : feito \? `\$\{rotulo\}/);
  // Cor, palavra e title saem do mesmo lugar que o ponto da agenda: um placar so'.
  assert.match(codigo, /const legendaDe = \(regiao\) => \{/);
  const pintar = codigo.slice(codigo.indexOf('const pintarPlacar = () => {'));
  assert.match(pintar.slice(0, pintar.indexOf('\n    };')), /pintarResumo\(\);/);
  // E o proximo horario tambem se repinta ali: o resumo copia o texto da agenda.
  const agenda = codigo.slice(codigo.indexOf('const pintarAgenda = () => {'));
  assert.ok(
    (agenda.slice(0, agenda.indexOf('\n    };')).match(/pintarResumo\(\)/g) || []).length === 2,
    'os dois caminhos de pintarAgenda repintam o resumo',
  );
});

test('o placar corrige-se a mao, e a mao nunca marca erro', () => {
  // Pedido do dono em 12/10/2026: "às vezes dá erro e eu vou manualmente e vejo que já ganhou, ou
  // eu mesmo venço manualmente". O placar é memória, e uma memória errada não se discute — corrige.
  assert.match(codigo, /const VOLTA = \['vazio', 'vitoria', 'derrota'\];/);
  // "Deu erro" fica de fora da volta: quem marca um erro é a corrida que falhou, não o dono.
  assert.ok(!/VOLTA = \[[^\]]*'erro'/.test(codigo), 'ninguém marca "deu erro" à mão');
  const marcar = codigo.slice(codigo.indexOf('const marcarAMao = (regiao)'));
  const corpo = marcar.slice(0, marcar.indexOf('\n    };'));
  assert.match(corpo, /VOLTA\[\(i \+ 1\) % VOLTA\.length\]/, 'o clique roda, e volta ao princípio');
  assert.match(corpo, /marcado à mão/, 'fica escrito que foi à mão, para ninguém ler como medida');
  // E corrigir o placar não manda no ginásio: quem manda na corrida é a agenda.
  assert.ok(!/comecar\(/.test(corpo), 'marcar à mão não faz o ginásio correr');
  // O mesmo clique serve nos dois painéis: o sinal da agenda e o do resumo minimizado.
  assert.match(codigo, /data-marcar="\$\{r\}"/);
  assert.match(codigo, /ponto\.dataset\.marcar = regiao;/);
  assert.match(codigo, /diz\.dataset\.marcar = regiao;/);
  assert.match(codigo, /const marca = evento\.target\.closest\?\.\('\[data-marcar\]'\);/);
});

test('na expedicao o ginasio espera, e nao arrasta ninguem para fora dela', () => {
  // **MEDIDO NO JOGO DO DONO EM 13/10/2026, em tres janelas ao mesmo tempo.** A caçada em escada
  // passou a manhã a tentar sair da expedição; o ginásio tinha o mesmo buraco — e pior, porque ele
  // não falha, ele consegue: o primeiro passo dele é guardar de onde saiu e clicar em "Voltar à
  // cidade". Dentro da expedição isso guardaria a EXPEDIÇÃO como caçada de origem e arrastaria o
  // dono para fora dela, que é desfazer uma escolha que ele pagou com CAPTCHA.
  assert.match(
    codigo,
    /const naExpedicao = \(\) => globalThis\.PPX\?\.cacadas\?\.atual\?\.\(\)\?\.tipo === 'expedicao';/,
  );
  // A guarda é a primeira coisa do `comecar`: antes dos times, antes de guardar a tarefa, antes de
  // sair da caçada. Depois disso já não há como saber de onde se saiu.
  const bloco = codigo.slice(codigo.indexOf('const comecar = (regiao) =>'));
  const corpo = bloco.slice(0, bloco.indexOf('void continuarTarefa();'));
  // A condição é a pergunta, e não um `false` qualquer: sem esta linha o resto do bloco continua
  // escrito e nunca corre, que é a forma mais calada de este defeito voltar.
  assert.match(corpo, /if \(naExpedicao\(\)\) \{/);
  assert.ok(
    corpo.indexOf('naExpedicao()') < corpo.indexOf('const times = timesDe(regiao);'),
    'a expedição é conferida antes de qualquer passo',
  );
  // **E não se perde o dia.** A expedição dura duas horas e o ginásio tem até ao reset: marca-se
  // outra tentativa em vez de recusar a ocorrência.
  assert.match(corpo, /esperandoExpedicao = setTimeout\(\(\) => void comecar\(regiao\), ESPERA_EXPEDICAO\);/);
  assert.match(corpo, /Você está na expedição/);
  // E o relógio anterior é cancelado: dois relógios no ar fariam dois ginásios ao mesmo tempo.
  assert.ok(
    corpo.indexOf('clearTimeout(esperandoExpedicao)') < corpo.indexOf('esperandoExpedicao ='),
    'um relógio de cada vez',
  );
});

test('o Hoenn entrou, e nada no painel ficou escrito a mao para duas regioes', () => {
  // O jogo acrescentou os ginasios da terceira geracao em 30/10/2026. Medido na janela do jogo
  // antes de mexer no codigo: as abas sao `KANTO`, `JOHTO` e `HOENN`, e o mapa do Hoenn traz os
  // mesmos sete `gym-hotspot` mais o `--league`, com o mesmo `is-active` e o mesmo rotulo `HOJE`.
  // Nada do que a ferramenta le' no jogo mudou — o que faltava era ela so' conhecer duas regioes.
  assert.match(codigo, /'HOENN'/, 'o Hoenn tem de estar na lista das regioes');
  assert.match(codigo, /HOENN: 'Hoenn'/, 'e tem de ter nome, senao o painel mostra o codigo');

  // A aba do jogo e' escolhida pelo texto do botao, e `HOENN` ja' casa com isso sem mudar nada.
  const escolher = codigo.slice(codigo.indexOf('const escolherRegiao = async'));
  assert.match(
    escolher.slice(0, 400),
    /toUpperCase\(\) === regiao\.toUpperCase\(\)/,
    'a aba continua a ser achada pelo nome da regiao',
  );

  // E o que falhou quando o Hoenn chegou: regioes escritas a mao no HTML e ternarios de duas
  // pontas. Uma quarta regiao nao pode voltar a custar sete sitios.
  assert.doesNotMatch(codigo, /data-elite4="KANTO"/, 'o HTML voltou a ter regiao escrita a mao');
  assert.doesNotMatch(codigo, /data-auto="JOHTO"/, 'o HTML voltou a ter regiao escrita a mao');
  assert.doesNotMatch(
    codigo,
    /=== 'KANTO' \? '/,
    "voltou um ternario de duas pontas: ele responde 'Johto' a qualquer regiao nova",
  );
});

test('cada ginasio pode ter o seu time, e a regiao e a rede', () => {
  // Pedido do dono em 30/10/2026. O ginásio do dia roda, e um time que ganha ao Koga não é o
  // mesmo que ganha à Erika — ter um time só por região obrigava a trocá-lo à mão todo dia.
  assert.match(codigo, /const timeDoGinasio = \(regiao, id\)/);
  const escolher = codigo.slice(codigo.indexOf('const timeDoGinasio = (regiao, id)'));
  const corpo = escolher.slice(0, escolher.indexOf('\n    };'));
  // A região continua a valer quando o ginásio não tem time: quem nunca mexer nisto não vê
  // diferença nenhuma, e é por isso que isto é um acréscimo e não um regime novo.
  assert.match(corpo, /proprio \|\|/, 'o time do ginásio tem de cair no da região');
});

test('o time por ginasio e guardado pela id do jogo, e nao pelo nome', () => {
  // Medido na janela do jogo em 30/10/2026: cada hotspot tem `data-gym-id` estável, com a região
  // no prefixo — `kanto_brock`, `johto_chuck`, `hoenn_norman`. Guardar pelo nome partia-se no
  // primeiro acento, na primeira tradução e no "Tate & Liza".
  assert.match(codigo, /h\.dataset\?\.gymId/, 'a id vem do `data-gym-id` do jogo');
  assert.match(codigo, /porGinasio/, 'os times por ginásio têm de ser guardados');
  // E a lista de ginásios **não** está escrita no código: ela é aprendida do jogo.
  assert.doesNotMatch(
    codigo,
    /kanto_brock|johto_falkner|hoenn_roxanne/,
    'a lista de ginásios voltou a estar escrita à mão, e fica errada quando o jogo mudar',
  );
});

test('ver qual e o ginasio de hoje acontece antes de montar o time', () => {
  // Sem isto o time é escolhido com a janela do ginásio ainda fechada, quando ninguém sabe qual
  // é o ginásio do dia — e a escolha por ginásio nunca chegaria a ser usada.
  const ver = etapas.indexOf('ver-ginasio');
  const monta = etapas.indexOf('time-gym');
  assert.ok(ver >= 0, 'não há etapa que veja o ginásio de hoje');
  assert.ok(ver < monta, 'o time é montado antes de se saber qual é o ginásio');
  // E a etapa grava o que descobriu antes de seguir: a corrida passa por um F5, e o que só
  // existisse em memória não sobreviveria a ele.
  const bloco = codigo.slice(codigo.indexOf("if (etapa === 'ver-ginasio')"));
  const corpo = bloco.slice(0, bloco.indexOf('\n      }'));
  assert.match(corpo, /dados\.timeGym = time;/);
  assert.match(corpo, /guardarTarefa\(dados\)/);
  // A janela é fechada antes de a etapa acabar: uma janela esquecida aberta faz o jogo recusar
  // abrir as seguintes — a lição que já custou uma sessão inteira neste pacote.
  assert.match(corpo, /fecharJanela\(aberta\.janela\)/);
});

test('uma leitura falhada do ginasio de hoje nao faz perder o dia', () => {
  // A escolha fina é um acréscimo. Se não se conseguir ler qual é o ginásio, usa-se o time da
  // região e segue-se — desistir do dia por causa de um refinamento seria trocar o certo pelo
  // bonito.
  const bloco = codigo.slice(codigo.indexOf("if (etapa === 'ver-ginasio')"));
  const corpo = bloco.slice(0, bloco.indexOf('\n      }'));
  assert.match(corpo, /const id = hoje\?\.dataset\?\.gymId \|\| '';/);
  assert.match(corpo, /timeDoGinasio\(dados\.regiao, id\)/);
});

test('mexer no time da regiao nao apaga os times dos ginasios', () => {
  // `gravar` escreve o objecto inteiro por cima do anterior. Sem levar `porGinasio` junto, trocar
  // o time da região apagava, em silêncio, a escolha de todos os ginásios dela.
  const guardar = codigo.slice(codigo.indexOf('const guardarEscolhas = () => {'));
  const corpo = guardar.slice(0, guardar.indexOf('\n    };'));
  assert.match(corpo, /\.\.\.guardado,/, 'o resto das escolhas tem de viajar junto');
});

test('renomear um time no Times acerta tambem os times por ginasio', () => {
  // Eles guardam o **nome** do time, como os da região. Um renomear que não passasse por aqui
  // deixava-os a apontar para um time que já não existe — descoberto só no meio de uma corrida.
  const porta = codigo.slice(codigo.indexOf('timeRenomeado: (velho, novo)'));
  const corpo = porta.slice(0, porta.indexOf('encherTimes(true)'));
  assert.match(corpo, /porGinasio: Object\.fromEntries\(/);
  assert.match(corpo, /\[id, trocar\(time\)\]/);
});

test('o catalogo de ginasios e aprendido do jogo, e nao viaja no export', () => {
  // Regra do repositório: o que a ferramenta descobriu sozinha não viaja. Levar o catálogo para
  // outra janela seria levar o palpite de uma conta para outra, e no dia em que o jogo mudar os
  // ginásios o catálogo velho venceria o jogo.
  assert.match(codigo, /const CHAVE_GINASIOS = 'lioncode:gym:ginasios';/);
  const config = readFileSync(new URL('../config.js', import.meta.url), 'utf8');
  assert.match(config, /'lioncode:gym:escolhas'/, 'as escolhas viajam, e os times por ginásio com elas');
  assert.doesNotMatch(config, /lioncode:gym:ginasios/, 'o catálogo aprendido não pode viajar');
});

test('aprender os ginasios le sempre do documento, por causa do redesenho', () => {
  // **Medido em 30/10/2026**: ao trocar de aba o jogo redesenha o mapa inteiro, e um elemento
  // apanhado antes da troca continua a responder — com os ginásios da aba anterior. Foi assim
  // que a primeira medição deste trabalho deu Hoenn nas três regiões.
  const espreitar = codigo.slice(codigo.indexOf('const espreitarGinasios = () => {'));
  const corpo = espreitar.slice(0, espreitar.indexOf('\n    };'));
  assert.match(corpo, /document\.querySelector\('\.gym-selector'\)/);
  // E a região vem da aba activa, e não da que o painel mostra: quem abriu a janela pode estar a
  // ver outra, e guardar a lista do Hoenn debaixo de 'KANTO' é pior do que não ter lista.
  assert.match(corpo, /b\.className\.includes\('is-active'\)/);
  assert.doesNotMatch(corpo, /escolhas\(\)\.regiao/);
});

test('uma leitura vazia nao apaga o catalogo que ja se sabia', () => {
  // A janela entra no DOM antes do mapa. Gravar o que se lê nesse instante trocaria um catálogo
  // bom por nada — e o painel ficaria sem linhas, sem ninguém ter feito nada.
  const aprender = codigo.slice(codigo.indexOf('const aprenderGinasios = (janela, regiao)'));
  const corpo = aprender.slice(0, aprender.indexOf('\n    };'));
  assert.match(corpo, /if \(!lista\.length\) return ginasiosSabidos\(\)\[regiao\];/);
});

test('janela fechada nao e janela aberta: o fantasma no DOM nao conta', () => {
  // **Medido no jogo em 30/10/2026**: ao fechar o Desafio dos Gyms o jogo deixa o `.gym-selector`
  // no documento, escondido — zero por zero, `offsetParent` nulo — e com os oito hotspots lá
  // dentro. Procurar só pelo selector fazia a ferramenta ler uma janela fantasma de 3 em 3
  // segundos, para sempre, muito depois de o jogador a ter fechado.
  const espreitar = codigo.slice(codigo.indexOf('const espreitarGinasios = () => {'));
  const corpo = espreitar.slice(0, espreitar.indexOf('\n    };'));
  assert.match(corpo, /if \(!visivel\(seletor\)\) return;/, 'lê uma janela que já não está à vista');
});

test('aprender so grava o que mudou', () => {
  // Isto corre a cada batida enquanto a janela está à vista. Gravar sempre seria escrever no
  // armazenamento de 3 em 3 segundos para guardar exactamente o mesmo.
  const aprender = codigo.slice(codigo.indexOf('const aprenderGinasios = (janela, regiao)'));
  const corpo = aprender.slice(0, aprender.indexOf('\n    };'));
  const compara = corpo.indexOf('JSON.stringify(sabidos[regiao]) === JSON.stringify(lista)');
  const grava = corpo.indexOf('gravar(CHAVE_GINASIOS');
  assert.ok(compara >= 0, 'não compara com o que já sabia');
  assert.ok(compara < grava, 'grava antes de comparar');
});

test('as linhas de ginasio sao linhas, e nao quadros empilhados', () => {
  // O painel já põe `label { flex-direction: column }`, e estas linhas são `label`. Sem a
  // direcção escrita, cada ginásio empilhava o nome por cima da lista e o `flex-basis` passava a
  // valer como **altura**: sete quadros de 96 px a encher a tela. Relatado com captura em
  // 30/10/2026.
  const regra = codigo.slice(codigo.indexOf('.porginasio .ginasio {'));
  const corpo = regra.slice(0, regra.indexOf('}'));
  assert.match(corpo, /flex-direction: row/, 'a linha volta a empilhar');
  // E o `flex-basis` da lista só é largura em linha: a largura fica escrita também, para o dia em
  // que alguém mexer na direcção.
  const daLista = codigo.slice(codigo.indexOf('.porginasio .ginasio select {'));
  assert.match(daLista.slice(0, daLista.indexOf('}')), /width: \d+px/);
});

test('o CSS do painel nao pode levar crases', () => {
  // Ele vive dentro de um template literal. Uma crase num comentário fecha a string a meio, e o
  // ficheiro inteiro deixa de carregar — aconteceu ao escrever o comentário da regra acima.
  const estilo = codigo.slice(codigo.indexOf('estilo.textContent = `'));
  const corpo = estilo.slice(estilo.indexOf('`') + 1);
  assert.ok(corpo.indexOf('`') > 0, 'o estilo tem de fechar');
  assert.doesNotMatch(
    corpo.slice(0, corpo.indexOf('`')),
    /`/,
    'há uma crase dentro do CSS: o ficheiro não carrega',
  );
});

test('o painel cabe na tela e rola por dentro', () => {
  // Medido em 30/10/2026, com três regiões e a agenda aberta: 1185 px de painel numa tela de
  // 785. O fim ficava inalcançável, e com ele o campo do reset e o botão de parar.
  const raiz = codigo.slice(codigo.indexOf('#lioncode-gym {'));
  const corpoDaRegra = raiz.slice(0, raiz.indexOf('}'));
  // O tecto vem agora dos valores partilhados do `nucleo.js`, e nao de um numero escrito aqui.
  assert.match(corpoDaRegra, /max-height: var\(--ppx-teto\)/, 'o painel pode passar da tela');
  assert.match(corpoDaRegra, /flex-direction: column/, 'sem coluna, o corpo não rola sozinho');
  // Só o corpo rola: quem rolasse o painel inteiro perdia de vista o botão de fechar.
  const doCorpo = codigo.slice(codigo.indexOf('#lioncode-gym .corpo { overflow-y'));
  assert.match(doCorpo.slice(0, doCorpo.indexOf('}')), /overflow-y: auto/);
});

test('o painel nao pode desfazer o esconder da agenda partilhada', () => {
  // **Medido em 30/10/2026**: com "repetir: todo dia", as duas listas de dias da agenda estavam
  // marcadas `hidden` e mediam 147 e 164 px — à vista. A regra `#lioncode-gym label` leva **id**
  // e ganha à `.ppx-ag-corpo label[hidden]` da agenda, que só tem classes. É preciso uma regra
  // com id a devolver o esconder, senão o painel estraga um componente que não é dele.
  assert.match(codigo, /#lioncode-gym \[hidden\] \{ display: none; \}/);
  // E a agenda continua a ser de todos: a correcção é do painel, não do componente.
  const agenda = readFileSync(new URL('../agenda.js', import.meta.url), 'utf8');
  assert.match(agenda, /\.ppx-ag-corpo label\[hidden\] \{ display: none; \}/);
});
