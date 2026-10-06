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

const ler = (arquivo) => readFileSync(new URL(`../${arquivo}`, import.meta.url), 'utf8');
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
  assert.match(codigo, /const combateEmCurso = \(\) =>\s*Boolean\(document\.querySelector\('\.pvp-battle-clock'\)\)/s);
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
  assert.match(codigo, /campo\('\[data-ir\]'\)\.addEventListener\('click', \(\) => \{\s*if \(correndo \|\| tarefa\(\)\) return;\s*comecar\(/);
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

test('uma falha nao recomeca do zero', () => {
  // A tarefa fica guardada na etapa em que parou. Sair da caçada duas vezes não faria sentido.
  const bloco = codigo.slice(codigo.indexOf('async function falhou'));
  assert.doesNotMatch(bloco.slice(0, bloco.indexOf('}')), /limparTarefa/);
  assert.match(codigo, /dados\.proxima = Date\.now\(\) \+ ESPERA_APOS_FALHA/);
  assert.match(codigo, /ESPERA_APOS_FALHA = 10 \* 60 \* 1000/);
});

test('nao se abre janela com um menu da barra aberto, nem com banner na frente', () => {
  // As duas coisas fazem o jogo recusar abrir janelas, e o banner nasce logo depois de cada
  // recarga — na prova real ele apareceu por cima da tela de combate.
  const bloco = codigo.slice(codigo.indexOf("if (etapa === 'desafiar')"));
  const limpeza = bloco.indexOf('esperarTelaLimpa');
  const menus = bloco.indexOf('fecharMenus()');
  const abre = bloco.indexOf('abrirOGinasio()');
  assert.ok(limpeza >= 0 && limpeza < abre, 'abre o ginásio sem esperar a tela limpar');
  assert.ok(menus >= 0 && menus < abre, 'abre o ginásio com um menu da barra aberto');
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
  const abre = desafiar.indexOf('abrirOGinasio()');
  assert.ok(limpa >= 0 && limpa < abre, 'abre o ginásio sem esperar a tela limpar');
  // E há segunda tentativa, para o anúncio que aparecer entre a limpeza e o clique.
  assert.match(desafiar.slice(0, desafiar.indexOf('return {')), /janela = await abrirOGinasio\(\);/);
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
  assert.match(codigo, /const clicarHumano = async \(el\) => \{\s*await respirarAntesDoClique\(\);/);
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
  const venda = ler('venda-rapida.js');
  for (const pedaço of [
    'const minuto = (hora, min) => (Number(hora) % 24) * 60 + (Number(min ?? 0) % 60);',
    'const duracao = ((fim - inicio + 1440) % 1440 || 1440) * 60000;',
    'if (fecha <= quando || abre <= ultima) continue;',
  ])
    assert.ok(venda.includes(pedaço) && codigo.includes(pedaço), `as duas tem: ${pedaço}`);
  // Uma janela por regiao, porque as regioes pedem times diferentes.
  assert.match(codigo, /const REGIOES = \['KANTO', 'JOHTO'\]/);
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
  assert.match(codigo, /if \(!linha \|\| linha\.dia !== diaDoServidor\(\)\) return \{ estado: 'vazio' \}/);
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
  assert.match(codigo, /const tituloDoResultado = \(\) => \(RESULTADO\.test\(textoDoCinema\(\)\) \? cinema\(\) : null\)/);
  assert.match(codigo, /const noCinemaDeEntrada = \(\) => Boolean\(cinema\(\)\) && !RESULTADO\.test\(textoDoCinema\(\)\)/);
  // O resultado NAO pode ser reconhecido pela mera presenca do elemento.
  assert.doesNotMatch(codigo, /tituloDoResultado = \(\) => document\.querySelector/);
  // E ha' um clique proprio para entrar na arena, que nao e' o de confirmar o resumo.
  assert.match(codigo, /const entrarNaArena = async \(avisar\)/);
  const desafiar = codigo.slice(codigo.indexOf("if (etapa === 'desafiar')"));
  const entra = desafiar.indexOf('entrarNaArena(');
  const espera = desafiar.indexOf('esperarOCombate(');
  assert.ok(entra >= 0 && entra < espera, 'entra na arena antes de esperar o combate');
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
  assert.match(codigo, /diz\.textContent = feito \? `\$\{rotulo\}/);
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
