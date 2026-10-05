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
  assert.match(codigo, /if \(!combateEmCurso\(\)\)/);
  assert.match(codigo, /TETO_DO_COMBATE/);
  // `.pvp-battle-clock` é o marcador de "ainda lutando": `.pokeidle-gym-battle` é a raiz do jogo
  // inteiro e existe sempre, então não serve para isto.
  assert.match(codigo, /const combateEmCurso = \(\) =>\s*Boolean\(document\.querySelector\('\.pvp-battle-clock'\)\)/s);
  assert.doesNotMatch(codigo, /querySelector\('\.pokeidle-gym-battle'\)/);
});

test('o F5 e uma etapa, e a seguinte e gravada antes dele', () => {
  // Medido: com seis Pokémon no HUD, o painel do ginásio insistia em "equipados 1/3" mesmo depois
  // de fechar e reabrir. Só a recarga acerta. Daí a etapa — e daí a máquina de estados guardada.
  assert.match(codigo, /ETAPAS = \['sair', 'time-gym', 'recarregar', 'desafiar', 'time-volta', 'voltar'\]/);
  const bloco = codigo.slice(codigo.indexOf("if (etapa === 'recarregar')"));
  const grava = bloco.indexOf("dados.etapa = 'desafiar'");
  const recarrega = bloco.indexOf('location.reload()');
  assert.ok(grava >= 0 && grava < recarrega, 'recarrega antes de gravar a etapa seguinte');
  // Sem isso a página voltaria, repetiria esta etapa e recarregaria outra vez, para sempre.
});

test('a cacada e guardada antes do primeiro passo', () => {
  // Depois de sair dela já não há como saber de onde se saiu: o nome só existe enquanto ela corre.
  const bloco = codigo.slice(codigo.indexOf("campo('[data-ir]').addEventListener"));
  assert.match(bloco, /cacada: cacadaAtiva\(\)/);
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
