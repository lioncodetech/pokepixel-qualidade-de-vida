// Guardas da décima primeira ferramenta: a escada de caçadas.
//
// Como as Caçadas e o Ginásio, ela só existe contra o DOM do jogo e não dá para exercitar fora
// dele. O que se protege aqui são as **decisões** — cada uma comprada com uma medição no jogo
// logado em 11/10/2026, e cada uma do tipo que um refactor desfaz sem perceber, porque o código
// continua a ler bem depois de desfeita.
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

const codigo = semComentarios(ler('escada.js'));

test('quem e o lider e o jogo que diz, e nao a posicao na fila', () => {
  // Medido: o líder vai para a frente ao trocar, então a posição até casaria hoje. Mas `is-leader`
  // é o jogo a afirmar, e a posição é esta ferramenta a deduzir — e quem deduz erra no dia em que
  // o jogo mudar a ordem por outro motivo.
  assert.match(codigo, /classList\?\.contains\?\.\('is-leader'\) === true/);
  assert.match(
    codigo,
    /const caixaDoLider = \(\) => equipe\(\)\.find\(\(p\) => p\.lider\) \|\| null/,
  );
  // E as caixas vazias ficam de fora pelo `data-creature-id`, não por contar seis.
  assert.match(codigo, /querySelectorAll\('\.pokeidle-team-card\[data-creature-id\]'\)/);
});

test('nivel nao lido e null, e null nunca vira zero', () => {
  // Um HUD que ainda não carregou não é um líder de nível 1. Tratar os dois como a mesma coisa
  // faria a escada disparar o degrau mais baixo a cada recarga da página.
  assert.match(codigo, /return n \? Number\(n\[1\]\) : null;/);
  // Cedo no `conferir`: antes de tudo o que se faz com o nivel do aluno. A janela cresceu de 900
  // para 1100 em 13/10/2026, quando o portao de ceder a vez entrou ali acima — ele vem **antes**
  // desta leitura de proposito, e o teste dele e' o "a cacada e a ultima da fila".
  const bloco = codigo.slice(codigo.indexOf('async function conferir(aviso'));
  assert.match(bloco.slice(0, 1100), /if \(!aluno \|\| aluno\.nivel === null\) return '';/);
});

test('a espera do jogo e espera, e nao falha', () => {
  // Medido: dentro dos 3 s o clique **não troca, não avisa e não fica em fila**. Tratar isso como
  // falha custaria dois minutos de castigo por três segundos de espera.
  assert.match(codigo, /if \(!\/aguarde\/i\.test\(t\)\) return 0;/);
  const bloco = codigo.slice(codigo.indexOf('async function trocarDeAluno'));
  const corpo = bloco.slice(0, bloco.indexOf('\n    }'));
  assert.match(corpo, /if \(alvo\.espera\)/);
  assert.match(corpo, /espere: alvo\.espera/);
  // E a espera devolvida é a do jogo, não o castigo: os dois números não podem colapsar num só.
  assert.doesNotMatch(corpo, /CASTIGO/);
});

test('quem diz que trocou e o HUD, pelo id, e nunca o clique', () => {
  // O clique pode ter caído dentro da espera. Seguir como se tivesse trocado mandaria o aluno
  // errado para a caçada. E a conferência é pelo `data-creature-id`: dois pokémon com o mesmo
  // nome e o mesmo nível seriam indistinguíveis por texto.
  const bloco = codigo.slice(codigo.indexOf('async function porNaFrente'));
  const corpo = bloco.slice(0, bloco.indexOf('\n    }'));
  assert.match(corpo, /if \(caixaDoLider\(\)\?\.id === alvo\.id\) break;/);
  assert.match(corpo, /if \(agora\?\.id !== alvo\.id\)/);
  assert.match(corpo, /Não troquei de aluno/);
  // Espreita-se até um limite; não se cronometra. A troca levou 602 ms, medidos.
  assert.match(codigo, /const ATE_TROCAR = 3000;/);
  assert.match(codigo, /const ESPREITA = 150;/);
});

test('ela nunca desce com o mesmo aluno', () => {
  // Um degrau abaixo do já cumprido com ESTE aluno não é progresso: é um nível mal lido ou um
  // degrau editado, e o castigo é arrastar um Lv 19 para a caçada dos Lv 1.
  assert.match(codigo, /if \(degrau && cfg\.aplicado !== null && degrau\.nivel < cfg\.aplicado\)/);
  // E o caso oposto: aluno novo apaga o degrau cumprido, que era do anterior.
  const bloco = codigo.slice(codigo.indexOf('if (cfg.aluno !== aluno.id)'));
  assert.match(bloco.slice(0, 200), /if \(cfg\.aluno\) cfg\.aplicado = null;/);
  // A primeira leitura não é troca: sem isto, cada F5 recomeçaria a escada.
  assert.match(bloco.slice(0, 200), /if \(cfg\.aluno !== aluno\.id\)/);
  // E isto acontece ANTES da viagem. Depois dela apagaria o degrau que a viagem acabou de cumprir,
  // e a batida seguinte viajaria outra vez para o mesmo lugar.
  const conferir = codigo.slice(codigo.indexOf('async function conferir(aviso'));
  assert.ok(
    conferir.indexOf('if (cfg.aluno !== aluno.id)') < conferir.indexOf('await viajar('),
    'o aluno é apurado antes de viajar',
  );
});

test('a ordem que a cacada monta nao manda na formatura', () => {
  // A caçada guardada monta a equipe inteira, ordem incluída, e essa ordem não sabe nada de teto:
  // ela pode pôr à frente justamente quem já se formou. A caçada diz QUEM está na equipe; a
  // formatura diz QUEM está à frente, e a última palavra é dela — por isso a troca vem depois da
  // viagem e lê o HUD outra vez.
  const bloco = codigo.slice(codigo.indexOf('async function conferir(aviso'));
  const marca = bloco.indexOf('cfg.aplicado = degrau.nivel');
  const troca = bloco.indexOf('await trocarDeAluno(alvo, aviso)');
  assert.ok(marca >= 0 && troca > marca, 'marca o degrau antes de pôr o aluno à frente');
  // E a troca não mexe no degrau cumprido: ela acontece DEPOIS da viagem que o cumpriu, e apagá-lo
  // faria a batida seguinte viajar outra vez para o mesmo lugar.
  const rep = codigo.slice(codigo.indexOf('async function trocarDeAluno'));
  assert.doesNotMatch(rep.slice(0, rep.indexOf('\n    }')), /cfg\.aplicado/);
});

test('a viagem vem antes da troca, e nao o contrario', () => {
  // **O defeito que esta ordem corrige, medido no jogo em 11/10/2026.** A escada formou o Scyther
  // dentro da caçada de Nidorina, pôs o Ralts Lv 1 à frente ali mesmo, e o Ralts morreu em 5
  // segundos. O jogo promoveu outro, a escada ficou em laço a tentar pôr um morto à frente, e
  // ninguém subiu de nível nunca mais. Um Lv 1 não aguenta a caçada de quem acabou de se formar.
  const bloco = codigo.slice(codigo.indexOf('async function conferir(aviso'));
  const viagem = bloco.indexOf('await viajar(degrau.cacada)');
  const troca = bloco.indexOf('await trocarDeAluno(');
  assert.ok(viagem >= 0, 'o conferir viaja');
  assert.ok(troca >= 0, 'o conferir troca de aluno');
  assert.ok(viagem < troca, 'a viagem tem de vir antes da troca');
});

test('o degrau e do aluno, e nao de quem esta a frente', () => {
  // **A raiz do defeito da ordem.** Com o degrau escolhido pelo nível de quem está à frente, a
  // escada era obrigada a trocar primeiro para só depois saber para onde ir. Com o degrau escolhido
  // pelo nível do aluno, sabe-se o destino antes de trocar — e a ordem certa cai por si.
  assert.match(
    codigo,
    /const alunoDeAgora = \(\) => \(cfg\.teto \? proximoAluno\(\) : caixaDoLider\(\)\);/,
  );
  const bloco = codigo.slice(codigo.indexOf('async function conferir(aviso'));
  const corpo = bloco.slice(0, bloco.indexOf('\n    }'));
  assert.match(corpo, /const aluno = alunoDeAgora\(\);/);
  assert.match(corpo, /const n = aluno\.nivel;/);
  // E o nível do líder não volta a decidir degrau nenhum aqui.
  assert.doesNotMatch(corpo, /nivelLider\(\)/);
  // Sem teto não há fila nem formatura: o aluno é quem o dono pôs à frente, e isto nunca mexe nisso.
  assert.match(codigo, /cfg\.teto \? proximoAluno\(\) : caixaDoLider\(\)/);
});

test('nao se troca fora da cacada do degrau', () => {
  // Se o dono saiu da caçada do degrau à mão, pôr o aluno fraco à frente onde ele está é
  // exactamente a morte que esta ordem veio evitar. O impasse é de propósito, e é dito por extenso.
  const bloco = codigo.slice(codigo.indexOf('async function conferir(aviso'));
  const corpo = bloco.slice(0, bloco.indexOf('\n    }'));
  const troca = corpo.indexOf('await trocarDeAluno(');
  const guarda = corpo.indexOf("return 'fora do lugar';");
  assert.ok(guarda >= 0 && guarda < troca, 'a guarda do lugar vem antes da troca');
  // E a CONDIÇÃO, não só a posição da frase. Medido com mutação: trocar o `if (!chegou())` por
  // `if (false)` deixava a frase no lugar e este teste passava sobre código morto.
  assert.match(
    corpo,
    /if \(!chegou\(\)\) \{\s+aviso\(diagnostico\(\)\);\s+return 'fora do lugar';/,
  );
  assert.match(codigo, /Não ponho um aluno fraco à frente fora da caçada dele/);
});

test('a caixa lida antes da viagem nao serve depois dela', () => {
  // A caçada guardada monta a equipe inteira e o jogo redesenha o HUD: o elemento lido antes fica
  // órfão, e clicar nele não clica em nada. É o mesmo erro que o `janela` guardado das Caçadas, e
  // custou a mesma coisa: uma ferramenta a jurar que clicou.
  const bloco = codigo.slice(codigo.indexOf('async function conferir(aviso'));
  const releitura = bloco.indexOf('equipe().find((p) => p.id === aluno.id)');
  const troca = bloco.indexOf('await trocarDeAluno(alvo, aviso)');
  assert.ok(releitura >= 0, 'o aluno é lido outra vez pelo id');
  assert.ok(releitura < troca, 'a releitura vem antes da troca');
  // E quem vai para a troca é a caixa relida, nunca a de antes da viagem.
  assert.doesNotMatch(bloco, /await trocarDeAluno\(aluno,/);
});

test('o morto vai a enfermeira antes de qualquer outra coisa', () => {
  // Medido no jogo: o jogo marca `is-fainted` e recusa **calado** o clique numa caixa morta,
  // exactamente como recusa dentro da espera de 3 s. Um morto não sobe de nível e não vai para a
  // frente: sem este passo a escada fica em laço a tentar, que foi o que ela fez.
  assert.match(codigo, /morto: el\.classList\?\.contains\?\.\('is-fainted'\) === true/);
  const bloco = codigo.slice(codigo.indexOf('async function conferir(aviso'));
  const cura = bloco.indexOf('if (aluno.morto)');
  const degrau = bloco.indexOf('const degrau = degrauPara(n)');
  assert.ok(cura >= 0 && cura < degrau, 'a enfermeira vem antes do degrau');
  // E quem diz que a cura pegou é o HUD, não a resposta do servidor: a caçada guarda o próprio
  // estado de combate, e a cura só aparece depois de sair dela.
  const curar = codigo.slice(codigo.indexOf('async function curar'));
  const corpo = curar.slice(0, curar.indexOf('\n    }'));
  assert.match(corpo, /const agora = equipe\(\)\.find\(\(p\) => p\.id === alvo\.id\);/);
  assert.match(corpo, /if \(agora && !agora\.morto\) return null;/);
  assert.match(codigo, /está derrotado\. Falta levá-lo à enfermeira/);
  // E depois de curar ela VOLTA. Pego na banca em 11/10/2026: ela curava e ficava na cidade para
  // sempre, porque o degrau continuava marcado como cumprido e a regra que respeita o dono — "você
  // saiu de lá, fique à vontade" — não sabe distinguir o dono a sair da própria escada a sair para
  // curar. Quem saiu foi ela, então é ela que tem de voltar.
  const depois = bloco.slice(bloco.indexOf('await curar(aluno, aviso)'));
  const trecho = depois.slice(0, depois.indexOf("return 'curado';"));
  assert.match(trecho, /cfg\.aplicado = null;/);
  // E ela termina o próprio movimento. Pego na banca na mesma corrida: depois de a cura desmarcar o
  // degrau, nada mais mexia no HUD da cidade — o gatilho dela é o HUD mudar, e quem o mudou por
  // último foi ela própria, dentro da batida que já corria. Ficava a esperar um empurrão que não
  // vinha. Uma batida a mais, uma vez, por conta de uma acção que foi dela.
  assert.match(trecho, /retomar\(\);/);
  assert.match(codigo, /const retomar = \(\) => batidaEm\(DEPOIS_DE_AGIR\);/);
  // E continua sem relógio: uma batida por acção própria, nunca de x em x segundos.
  assert.doesNotMatch(codigo, /setInterval\(/);
});

test('o caminho a mao tambem termina o proprio movimento', () => {
  // Medido no jogo em 11/10/2026: com o aluno no Lv 8, o ▸ do degrau de Lv 1 levou-o para lá e o
  // painel ficou meio minuto em "Em Magikarp." — com a escada ligada e o degrau dele a ser outro.
  // Ninguém subiu de nível, ninguém morreu, então o HUD não mudou e nenhuma batida aconteceu: ela
  // **ia** voltar ao degrau certo, mas só no próximo nível, sem nunca o ter dito.
  const bloco = codigo.slice(codigo.indexOf('async function irAMao'));
  const corpo = bloco.slice(0, bloco.indexOf('\n    }\n'));
  assert.match(corpo, /retomar\(\);/);
  // E a batida vem depois de a frase ser dita, senão o diagnóstico apagaria o resultado da ida.
  assert.ok(
    corpo.indexOf('diz(diagnostico())') < corpo.lastIndexOf('retomar();'),
    'primeiro a frase, depois a batida',
  );
});

test('toda espera marca a propria volta', () => {
  // **Medido no jogo em 11/10/2026, e é o mesmo buraco da cura noutro sítio.** A escada pediu para
  // pôr o Ralts à frente, o jogo respondeu "Aguarde 3s", ela guardou a espera e devolveu o controlo
  // ao observador. Só que o gatilho dela é o HUD mudar, e parada na mesma caçada com o mesmo líder
  // o HUD não muda: nível igual, ninguém morre, ninguém troca. Ficou congelada dois minutos e meio
  // no "Tento de novo em 3s", com três segundos de espera a cumprir.
  assert.match(
    codigo,
    /const adiar = \(ms\) => \{\s+esperaAte = Date\.now\(\) \+ ms;\s+batidaEm\(ms \+ DEPOIS_DE_AGIR\);/,
  );
  // E **nenhuma** espera escapa: guardar uma sem marcar a volta é prometer voltar e não voltar.
  const dentro = codigo.indexOf('const adiar = (ms) =>');
  const fora = codigo.slice(0, dentro) + codigo.slice(codigo.indexOf('};', dentro));
  assert.doesNotMatch(fora, /esperaAte = Date\.now\(\) \+/);
  // Há uma batida pendente de cada vez: a segunda só chegaria para achar o trabalho já feito.
  assert.match(codigo, /clearTimeout\(proximaBatida\);/);
});

test('a cura e tres passos em ordem, e a ordem foi medida', () => {
  // Medido na conta real em 11/10/2026: `healTeam()` sozinho, com a caçada a correr, **curou no
  // servidor** (devolveu HP cheio em todos) **e o HUD continuou a dizer "Pokémon derrotado"**. A
  // caçada guarda o estado de combate dela. Parar primeiro é o que faz a cura pegar.
  const ponte = semComentarios(ler('escada-main.js'));
  const parar = ponte.indexOf('api.stopHunt()');
  const cidade = ponte.indexOf('nav.goToCity()');
  const curar = ponte.indexOf('api.healTeam()');
  assert.ok(parar >= 0 && cidade > parar && curar > cidade, 'parar, ir para a cidade, curar');
  // E os três passos têm de ser alcançáveis. Medido com mutação: pôr o `stopHunt` dentro de um
  // `if (false)` mantinha as três chamadas na ordem certa e este teste passava com a cura a não
  // pegar — que é exactamente o defeito que a ordem existe para evitar.
  assert.match(ponte, /if \(typeof api\.stopHunt === 'function'\) \{/);
  assert.match(ponte, /if \(typeof nav\?\.goToCity !== 'function'\)/);
  // E ela nunca gasta item do jogador: `reviveHunt` também ressuscita, de graça para a ferramenta
  // e caro para quem joga. A enfermeira é de graça.
  assert.doesNotMatch(ponte, /reviveHunt\(/);
  // Parar uma caçada que não existe não é erro: é o estado que se queria.
  assert.match(ponte, /await api\.stopHunt\(\);\s*\n\s*\} catch \{/);
});

test('o fim da escada tem quatro saidas, e todas sao escolha do dono', () => {
  // Pedido em 11/10/2026: com a equipe toda no teto, ou se troca de time e continua, ou se guarda a
  // equipe na cidade e para-se de vez. Eram duas saídas. O que a ferramenta não faz é escolher.
  const bloco = codigo.slice(codigo.indexOf('async function fimDaEscada'));
  const corpo = bloco.slice(0, bloco.indexOf('\n    }\n'));
  for (const saida of ["cfg.fim === 'nada'", "cfg.fim === 'cidade'", "cfg.fim === 'time'"])
    assert.ok(corpo.includes(saida), `falta a saída ${saida}`);
  assert.match(corpo, /await viajar\(cfg\.destino\)/);
  // E as quatro aparecem no painel, senão não são escolha de ninguém.
  for (const valor of ['nada', 'cacada', 'time', 'cidade'])
    assert.match(codigo, new RegExp(`<option value="${valor}">`), `o painel não oferece ${valor}`);
});

test('trocar de time recusa quando a cacada do degrau monta time', () => {
  // **O unico sitio onde duas regras desta ferramenta se atropelam, e o atropelo dava laço.**
  // Medido no jogo em 12/10/2026: o fim da escada montou o time "novo", ela reiniciou com o Dratini
  // Lv 1 e viajou para o degrau dele — e a viagem remontou o time guardado na caçada, que era
  // "Hunt", apagando o "novo". Com a equipe velha de volta ninguém tinha nível para subir, a escada
  // chegava de novo ao fim e montava o time outra vez. Para sempre, a 20-30 s de montagem e uma
  // viagem por volta.
  //
  // A regra atropelada já estava escrita e continua valendo: `PPX.cacadas.ir` monta SEMPRE o time
  // guardado na própria caçada. A saída não é esta ferramenta passar a mandar no time também — é
  // recusar antes de agir, porque dá para saber antes, e dizer qual é o conflito.
  const bloco = codigo.slice(codigo.indexOf('async function fimDaEscada'));
  const time = bloco.slice(bloco.indexOf("cfg.fim === 'time'"));
  const corpo = time.slice(0, time.indexOf('if (!cfg.destino)'));
  const recusa = corpo.indexOf('const tropeco = degrauComTime();');
  const monta = corpo.indexOf('await times.usar(vez.nome)');
  assert.ok(recusa >= 0, 'o fim "trocar de time" confere o conflito');
  assert.ok(recusa < monta, 'confere ANTES de montar, senão o laço já aconteceu');
  assert.match(corpo, /return 'tropeco';/);
  assert.match(codigo, /não ia durar: a caçada/);
  assert.match(codigo, /Tire o time dessa caçada nas Caçadas/);
  // Basta um degrau com time: a escada vai certamente viajar para um deles.
  const acha = codigo.slice(codigo.indexOf('const degrauComTime = () =>'));
  assert.match(acha.slice(0, 400), /for \(const d of cfg\.degraus\)/);
  assert.match(acha.slice(0, 400), /if \(time\) return \{ \.\.\.d, time \};/);
});

test('trocar de time passa pela cidade, e so la troca', () => {
  // Pedido em 12/10/2026, e é a ordem invertida da batida um degrau acima. O time que entra é de
  // bichos novos — Lv 1, os dois times que ele montou para medir isto — e trocar a equipe inteira
  // dentro de uma caçada é pôr três recém-nascidos no lugar de quem acabou de se formar, no mesmo
  // combate. Primeiro o lugar seguro, depois a troca: a cidade é o lugar seguro.
  const bloco = codigo.slice(codigo.indexOf('async function fimDaEscada'));
  const time = bloco.slice(bloco.indexOf("cfg.fim === 'time'"));
  const corpo = time.slice(0, time.indexOf('if (!cfg.destino)'));
  const cidade = corpo.indexOf('await pedirCidade()');
  const monta = corpo.indexOf('await times.usar(vez.nome)');
  assert.ok(cidade >= 0, 'o fim "trocar de time" volta para a cidade');
  assert.ok(cidade < monta, 'a cidade vem ANTES da montagem, e não o contrário');
  // E o laço recomeça: o time novo é de Lv 1 e está na cidade, onde mais nada mexe no HUD.
  assert.ok(corpo.indexOf('retomar();') > monta, 'depois de montar, ela tem de marcar a volta');
});

test('as saidas do fim que agem no jogo pedem a vez', () => {
  // Elas agem: vão à cidade, viajam, montam um time que leva 20-30 s. A fila vale para toda
  // automação daqui para a frente (ver AGENTS.md) — e os Times são uma peça, que conta com quem
  // chama já ter a vez. Sem isto, o fim da escada era o único buraco da fila nesta ferramenta.
  const bloco = codigo.slice(codigo.indexOf('async function fimDaEscada'));
  const corpo = bloco.slice(0, bloco.indexOf('\n    }\n'));
  const pedidos = corpo.match(/await esperarAVez\(\)/g) || [];
  assert.equal(pedidos.length, 3, 'as três saídas que agem pedem a vez; a quarta não age');
  assert.equal((corpo.match(/soltar\(\);/g) || []).length, 3, 'e as três soltam-na');
});

test('a fila de times nao guarda contador: quem diz o lugar e o time montado', () => {
  // Pedido em 12/10/2026: formado o time 1, passa ao 2, depois ao 3. A tentação é guardar um
  // índice — e ele mentiria de três formas: no F5, numa troca de time à mão e numa reordenação da
  // lista. Cada mentira dessas manda montar o time errado por cima do trabalho já feito. Quem sabe
  // onde se está na fila é a equipe que está na tela.
  assert.ok(!/proximoTime|indiceTime|cfg\.vezDoTime/.test(codigo), 'a fila não guarda contador');
  const bloco = codigo.slice(codigo.indexOf('const timeSeguinte = () =>'));
  const corpo = bloco.slice(0, bloco.indexOf('\n    };'));
  assert.match(corpo, /PPX\?\.times\?\.qual/, 'o lugar na fila vem da porta dos Times');
  // E o lugar é o do time montado DENTRO da lista: sem isto, a fila recomeçaria do primeiro a
  // cada volta, que é o laço outra vez.
  assert.match(corpo, /lista\.indexOf\(agora\)/);
  assert.match(corpo, /lista\[i \+ 1\]/, 'o seguinte é o seguinte, não o primeiro');
  // E sem a porta não se adivinha: montar "o primeiro" por desencargo é o laço de 12/10/2026 com
  // mais passos — monta o 1, ele já está formado, chega ao fim, monta o 1 de novo.
  assert.match(corpo, /erro:/);
  assert.match(codigo, /não monto às cegas/);
});

test('a fila acabada nao decide: pergunta, e com uma listbox', () => {
  // Pedido em 12/10/2026. Voltar ao primeiro time por conta própria seria desfazer o trabalho todo
  // e montar time atrás de time para sempre. E a pergunta não é uma quinta opção do `fim`: as
  // outras quatro escolhem-se ANTES, de noite, para ela cumprir sozinha — esta faz-se DEPOIS, com
  // a equipe toda formada na tela, que é quando ele sabe o que quer.
  const bloco = codigo.slice(codigo.indexOf('async function fimDaEscada'));
  const time = bloco.slice(bloco.indexOf("cfg.fim === 'time'"));
  const corpo = time.slice(0, time.indexOf('if (!cfg.destino)'));
  assert.match(corpo, /if \(!vez\.nome\) return fimDaFila\(aviso\);/);
  assert.ok(
    corpo.indexOf('if (!vez.nome) return fimDaFila(aviso);') < corpo.indexOf('await pedirCidade()'),
    'a fila acabada para ANTES de viajar para a cidade',
  );
  // A listbox existe, com as quatro respostas, e aparece só quando há pergunta.
  for (const r of ['nada', 'cidade', 'time', 'parar'])
    assert.match(codigo, new RegExp(`<option value="${r}">`), `falta a resposta ${r}`);
  assert.match(codigo, /O que faço agora\? Escolha aí embaixo\./);
  assert.match(codigo, /depois\.style\.display = perguntando \? '' : 'none';/);
  // E quem age é a resposta, não a batida: uma acção guardada para a próxima batida seria refeita
  // em cada batida, e voltar para a cidade três vezes não é voltar uma vez.
  const espera = codigo.slice(codigo.indexOf('function fimDaFila'));
  const dentro = espera.slice(0, espera.indexOf('\n    }'));
  assert.ok(!/pedirCidade|times\?\.usar|await/.test(dentro), 'quem espera não age');
  assert.match(codigo, /campo\('\[data-depois\]'\)\.addEventListener/);
});

test('um ja-cumpri de ontem nao trava a fila de times', () => {
  // **MEDIDO NA BANCA EM 12/10/2026.** `formados` existe para ela não arrastar a equipe de volta
  // para o fim que já cumpriu — mas na fila de times quem sabe se há trabalho por fazer é a própria
  // fila, pelo time que está montado. Com o portão a valer, um "já cumpri" de uma volta anterior
  // deixava a fila a dizer "falta montar o 1º de 3" para sempre, sem nunca montar. Pior: montar um
  // time do meio da fila marcava o fim como cumprido, então um time que já chegasse todo ao teto
  // parava a escada em vez de a fazer passar ao seguinte.
  const bloco = codigo.slice(codigo.indexOf('async function fimDaEscada'));
  assert.match(bloco, /if \(cfg\.formados && cfg\.fim !== 'time'\) \{/);
  // E o passo do meio da fila não cumpre o fim: não passa por `feito`.
  const time = bloco.slice(bloco.indexOf("cfg.fim === 'time'"));
  const corpo = time.slice(0, time.indexOf('if (!cfg.destino)'));
  assert.ok(!/feito\(\)/.test(corpo), 'montar um time do meio da fila não é cumprir o fim');
  assert.match(corpo, /return 'trocado';/);
});

test('parada ela nao age, mas o painel continua a ser sobre o jogo', () => {
  // **MEDIDO NO JOGO EM 12/10/2026, e é como a pergunta não aparecia.** O painel é desenhado uma vez
  // ao abrir a página — e nessa hora o jogo ainda não pintou o HUD, então não há equipe, não há fila
  // acabada e não há pergunta. Ligada, a batida redesenha; parada, `conferir` desistia na primeira
  // linha e a listbox nunca chegava a aparecer.
  const olho = codigo.slice(codigo.indexOf('new MutationObserver'));
  const corpo = olho.slice(0, olho.indexOf('olho.observe'));
  assert.match(corpo, /if \(!cfg\.ligada\) return void desenhar\(false\);/);
  // E guarda a frase que está na tela: quem acabou de usar o ▸ disse para onde foi.
  assert.ok(!/desenhar\(\)/.test(corpo), 'um redesenho não tem nada melhor a dizer');
  // Parada com a fila acabada, ela diz que há escolha a fazer — senão a listbox aparece calada.
  assert.match(codigo, /Parada — mas a fila de times acabou/);
});

test('a pergunta do fim da fila e nova a cada volta', () => {
  // Guardar a resposta de ontem seria responder por ele. A resposta vale para a volta em que foi
  // dada; começada uma volta nova, a pergunta é nova.
  const batida = codigo.slice(codigo.indexOf('async function conferir(aviso'));
  const bloco = batida.slice(batida.indexOf('if (cfg.formados) {'));
  assert.match(bloco.slice(0, 300), /cfg\.depois = '';/);
  // E uma pergunta que não se vê não é pergunta: minimizada, a listbox está escondida com o corpo.
  const espera = codigo.slice(codigo.indexOf('function fimDaFila'));
  assert.match(espera.slice(0, 1000), /if \(!cfg\.depois && minimizado && !jaAbri\)/);
  // Uma vez, e não a cada batida: abrir sempre seria discutir com quem o minimizou.
  assert.match(espera.slice(0, 1000), /jaAbri = true;/);
});

test('a escada confere se o time foi montado mesmo', () => {
  // Os Times já relataram sucesso com um time que não montaram ("montado em 148 s", com um Pokémon
  // só). Aqui isso seria pior do que um aviso errado: a fila anda pelo time que está montado, então
  // um time meio montado faria a escada perder o lugar na fila e remontar o mesmo para sempre.
  const bloco = codigo.slice(codigo.indexOf('async function fimDaEscada'));
  const time = bloco.slice(bloco.indexOf("cfg.fim === 'time'"));
  const corpo = time.slice(0, time.indexOf('if (!cfg.destino)'));
  assert.match(corpo, /const montado = globalThis\.PPX\?\.times\?\.qual\?\.\(\);/);
  assert.match(corpo, /if \(montado !== vez\.nome\)/);
  assert.ok(
    corpo.indexOf('if (montado !== vez.nome)') < corpo.indexOf("cfg.aluno = ''"),
    'confere antes de dar a troca por feita',
  );
});

test('quem sabe que time esta montado e a ferramenta Times', () => {
  // A mesma regra do time da caçada: a dona do assunto é quem responde. Os Times guardam e montam
  // time; então são eles que dizem qual está montado, com os testes deles.
  const times = semComentarios(ler('times.js'));
  assert.match(times, /qual: \(\) => \{/);
  // Compara por id, não por nome: dois Pokémon da mesma espécie são duas criaturas diferentes.
  const porta = times.slice(times.indexOf('qual: () => {'));
  const corpo = porta.slice(0, porta.indexOf('},'));
  assert.match(corpo, /doHud\(\)\.map\(\(p\) => p\.id\)/);
  assert.match(corpo, /every\(\(m\) => agora\.includes\(m\.id\)\)/);
  // E o tamanho conta: um time que é só PARTE da equipe da tela não é o time que está montado —
  // era assim que uma montagem meia-feita passava por completa.
  assert.match(corpo, /time\.membros\.length === agora\.length/);
  // E o líder não conta: a escada troca o líder a cada aluno, e o time continua o mesmo.
  assert.ok(!/lider/.test(corpo), 'o líder não entra na comparação');
});

test('o time unico de antes vira o primeiro da fila', () => {
  // Ninguém perde a escolha que fez por a pergunta ter crescido.
  // Duas condições, e não uma: o PADRÃO já entrega `times: []`, então uma config antiga chega
  // com a fila vazia e `Array.isArray` satisfeito. Pego pela banca em 12/10/2026.
  assert.match(codigo, /if \(!cfg\.times\.length && cfg\.time\) cfg\.times = \[cfg\.time\];/);
  assert.match(codigo, /delete cfg\.time;/);
  // E o painel pergunta a fila como lista, com a forma dos degraus: + e ×.
  assert.match(codigo, /data-fila/);
  assert.match(codigo, /data-mais-time/);
  assert.match(codigo, /\+ time/);
});

test('quem sabe o time de uma cacada e a ferramenta Cacadas', () => {
  // A escada **conta** o conflito, e não manda no time. Quem monta continua a ser as Caçadas, e a
  // porta só lê — duas donas do time seriam duas verdades divergindo no primeiro dia.
  const cacadas = semComentarios(ler('cacadas.js'));
  assert.match(
    cacadas,
    /timeDe: \(nome\) => todasConhecidas\(\)\.find\(\(c\) => c\.nome === nome\)\?\.time \|\| '',/,
  );
  // E a escada não lê o armazenamento das Caçadas por fora: pede pela porta.
  assert.match(codigo, /globalThis\.PPX\?\.cacadas\?\.timeDe/);
  assert.doesNotMatch(codigo, /lioncode:cacadas/);
  // Sem a porta — pacote a meio de atualizar — ela não inventa conflito nenhum.
  assert.match(codigo, /if \(typeof timeDe !== 'function'\) return null;/);
});

test('trocar de time esquece o aluno e o degrau', () => {
  // Trocar de time troca a equipe inteira: o aluno de agora é outro, e o degrau cumprido era do
  // anterior. Guardá-los mandaria um bicho novo de Lv 1 para a caçada do Lv 200 que saiu.
  const bloco = codigo.slice(codigo.indexOf('async function fimDaEscada'));
  const time = bloco.slice(bloco.indexOf("cfg.fim === 'time'"));
  const corpo = time.slice(0, time.indexOf('if (!cfg.destino)'));
  assert.match(corpo, /cfg\.aplicado = null;/);
  assert.match(corpo, /cfg\.aluno = '';/);
  // E quem monta o time é a porta dos Times, não esta ferramenta.
  assert.match(corpo, /await times\.usar\(vez\.nome\)/);
  assert.match(corpo, /A ferramenta Times está desligada/);
});

test('a ponte do mundo da pagina faz duas coisas, e as duas tem motivo', () => {
  // Tudo o que esta ferramenta lê **do que está na tela** continua a vir do DOM — líder, nível,
  // espera, morto —, e a ponte não desmente isso. Ela tem exactamente duas razões de existir:
  //
  //   `cidade`  — curar são três acções do jogo em ordem, e nenhuma tem botão que se consiga
  //               clicar com honestidade daqui;
  //   `bichos`  — o nível de quem NÃO está na equipe o DOM só daria abrindo o inventário, e abrir
  //               janelas é a operação que mais falha no jogo.
  //
  // E nada mais: **a ponte não mexe na equipe.** Quem mexe é a ferramenta Times, pelo cartão do
  // botão direito, com as três regras do jogo medidas lá — e uma segunda rotina de equipar, por
  // API, divergiria dessa no primeiro mês.
  const ponte = semComentarios(ler('escada-main.js'));
  assert.match(ponte, /const FAZ = \{ cidade: irParaCidadeECurar, bichos \};/);
  assert.doesNotMatch(ponte, /setTeamLeader|addTeamMember|removeTeamMember|reviveHunt/);
  // Só os quatro campos que o modo de grupo usa atravessam, e não o registro todo do jogador.
  const lista = ponte.slice(ponte.indexOf('const bichos'));
  assert.match(lista.slice(0, 900), /species_name/);
  assert.doesNotMatch(lista.slice(0, 900), /ivs|nature|moveset|sell_value|captured/);
  // E a escada pede as duas pelo mesmo canal, com eco e paciência.
  assert.match(codigo, /acao: 'cidade'/);
  assert.match(codigo, /acao: 'bichos'/);
  // Sem a ponte, ninguém responde nunca — e uma escada parada para sempre em "indo curar" não diz
  // o que está errado.
  assert.match(codigo, /const PACIENCIA = 20000;/);
  assert.match(codigo, /o jogo não respondeu/);
  // E ela entra no mundo da página pelo manifesto, senão não existe.
  const manifesto = JSON.parse(ler('manifest.json'));
  const principal = manifesto.content_scripts.find((b) => b.world === 'MAIN');
  assert.ok(principal.js.includes('escada-main.js'), 'escada-main.js tem de estar no mundo MAIN');
});

test('pede a vez para o clique, e nunca para a viagem', () => {
  // A fila não é reentrante entre donos: quem viaja é `PPX.cacadas.ir`, que pede a vez dele.
  // Segurar a vez aqui deixaria a viagem à espera de quem está à espera dela.
  assert.match(codigo, /return vez\.pedir\('escada'\)/);
  const porNaFrente = codigo.slice(codigo.indexOf('async function porNaFrente'));
  assert.match(porNaFrente.slice(0, 400), /const soltar = await esperarAVez\(\);/);
  const viajar = codigo.slice(codigo.indexOf('const viajar = async (nome)'));
  // Até o fecho da função, e não até o primeiro `};`: a primeira linha do corpo devolve um objeto
  // literal, e cortar ali deixava de fora justamente o resto do corpo. Medido: a mutação que põe
  // `esperarAVez` dentro do `viajar` passava por este teste.
  assert.doesNotMatch(viajar.slice(0, viajar.indexOf('\n    };')), /esperarAVez|vez\.pedir/);
});

test('o gatilho e o HUD, e nao um relogio', () => {
  // Com a aba em segundo plano — que é como se joga aqui, várias janelas — o `setInterval` cai
  // para uma volta por minuto. O HUD, que é DOM, avisa quando muda.
  assert.match(codigo, /new MutationObserver\(/);
  assert.doesNotMatch(codigo, /setInterval\(/);
  // E há uma peneira, porque o HUD bate a cada ponto de vida, várias vezes por segundo.
  const bloco = codigo.slice(codigo.indexOf('function vigiar()'));
  assert.match(bloco.slice(0, 400), /if \(n === visto\) return;/);
  // **Mas a peneira não pode ser só o nível.** Pego na banca em 11/10/2026: o aluno morreu e a
  // escada não reagiu, porque a morte não muda nível nenhum — e um morto não ganha experiência, de
  // modo que o nível nunca mudaria. Ela ficava parada para sempre com a enfermeira a um passo.
  assert.match(bloco.slice(0, 400), /const n = assinatura\(\);/);
  const peneira = codigo.slice(codigo.indexOf('const assinatura = () =>'));
  const corpo = peneira.slice(0, peneira.indexOf('.join('));
  for (const parte of ['p.id', 'p.nivel', 'p.lider', 'p.morto'])
    assert.ok(corpo.includes(parte), `a assinatura tem de levar ${parte}`);
  // E pontos de vida ficam de fora: é isso que faz a peneira ser peneira.
  assert.doesNotMatch(corpo, /hp|vida|__hp/);
});

test('aba oculta nao age', () => {
  // O jogo não desenha, as janelas dele não abrem e a viagem não tem por onde passar. O nível
  // também não sobe, então não há o que perder em esperar a aba voltar.
  assert.match(codigo, /if \(document\.visibilityState !== 'visible'\) return '';/);
});

test('o primeiro degrau nasce no Lv 1', () => {
  // O valor inicial é parte da regra: um primeiro degrau acima do líder faz a ferramenta nascer
  // sem efeito nenhum, e ela passa a noite parada sem nada estar errado.
  assert.match(
    codigo,
    /cfg\.degraus\.length \? cfg\.degraus\.reduce\(\(m, d\) => Math\.max\(m, d\.nivel\), 0\) \+ 10 : 1/,
  );
});

test('nao agir e uma decisao, e e dita', () => {
  // Automação parada e calada é indistinguível de automação quebrada. Cada estado de impasse tem
  // de dizer quem é o sujeito, o que falta e como sair dele.
  for (const frase of [
    /Parada\. Não faço nada sozinha/,
    /A ferramenta Caçadas está desligada/,
    /Não conheço caçada nenhuma\. Abra as Caçadas \(Alt\+E\) e clique no ↻/,
    /Sem degraus/,
    /Ainda não li o nível do líder/,
    /abaixo do primeiro degrau/,
    /não tem caçada escolhida/,
    /Não desço com o mesmo aluno/,
    /não tenho licença para trocar de caçada/,
    // Os impasses que nasceram com a ordem nova: cada um diz o sujeito, o que falta e como sair.
    /está derrotado\. Falta levá-lo à enfermeira/,
    /Não ponho um aluno fraco à frente fora da caçada dele/,
    /falta pô-lo à frente/,
    /não está na equipe desta caçada/,
    /A equipe toda chegou ao Lv \$\{tetoDeAgora\(\)\}/,
    // Medido na banca em 11/10/2026: durante o castigo de 2 min o painel repetia "falta ir para X"
    // e não ia. Quem olhasse só a frase concluiria que a ferramenta tinha quebrado. E a frase é
    // neutra: por ela passam o castigo de uma viagem falhada **e** os 3 s que o jogo pede entre
    // trocas, e chamar "tentativa que não deu" a um pedido de espera do jogo seria mentir.
    /Esperando \$\{faltam\}s para tentar de novo/,
    // Os impasses do modo de grupo, que nasceram em 12/10/2026 com a pedra da XP.
    /Escolha onde o grupo fica — pode ser mais de uma, em ordem de preferência/,
    // E o impasse novo: fora da lista, e sem nenhuma lá onde ela consiga entrar sozinha.
    /não consigo entrar sozinha em nenhuma delas/,
    /scolha o Pokémon que tem a pedra/,
    /scolha os times de onde vêm os que rodam/,
    // E, com mais de uma pedra no rodízio, o impasse diz de qual delas se trata.
    /Escolha quem tem a pedra e os times que ela vai upar/,
    /a caçada é a última da fila/,
    /apagaria o grupo/,
    /o Pokémon fixo não está mais na coleção/,
    /Ainda não li a coleção/,
    /Pausada\./,
  ])
    assert.match(codigo, frase, `falta o diagnóstico ${frase}`);
  // E ele é dito nos caminhos de "não fiz nada", não só guardado numa função.
  const bloco = codigo.slice(codigo.indexOf('async function conferir(aviso'));
  assert.ok(
    (bloco.match(/aviso\(diagnostico\(\)\)/g) || []).length >= 4,
    'o diagnóstico é dito em cada impasse do conferir',
  );
  // Nenhum caminho do castigo sai calado: os três `esperaAte` dizem por que estão parados.
  assert.doesNotMatch(codigo, /if \(Date\.now\(\) < esperaAte\) return/);
  // Cinco caminhos esperam o castigo — o fim da escada, a enfermeira, a viagem, a troca e a batida
  // do grupo — e os cinco dizem por que estão parados. O número cresce com a ferramenta; o que não
  // pode crescer é o número de caminhos calados, que é zero.
  assert.equal((codigo.match(/if \(Date\.now\(\) < esperaAte\) \{/g) || []).length, 5);
});

test('a licenca de trocar de cacada e so sobre viajar', () => {
  // Formar o aluno, saber em que degrau ele deveria estar e dizê-lo não são viajar. O que a
  // licença para é o arrasto para outro mapa — e o diagnóstico diz qual seria.
  const bloco = codigo.slice(codigo.indexOf('async function conferir(aviso'));
  const licenca = bloco.indexOf('if (cfg.trocar !== true)');
  // A enfermeira não é viajar: um aluno morto continua morto com ou sem licença, e deixá-lo morto
  // por falta de licença para **outra coisa** seria parar a escada por um motivo que não é o dela.
  const cura = bloco.indexOf('await curar(aluno, aviso)');
  assert.ok(cura >= 0 && cura < licenca, 'a enfermeira corre antes da licença');
  // E o fim da escada também decide antes dela — a licença só para o arrasto para outro mapa.
  const fim = bloco.indexOf('return fimDaEscada(aviso)');
  assert.ok(fim >= 0 && fim < licenca, 'o fim da escada corre antes da licença');
});

test('quem diz que chegou e a porta das Cacadas, nao uma leitura daqui', () => {
  // `PPX.cacadas.ir` só devolve `ok` depois de confirmar que a caçada em curso é a pedida. Reler o
  // DOM no instante seguinte apanha o jogo a meio do redesenho: medido em 11/10/2026, a viagem de
  // "Caça de Azurill" para "Ilha Lendária de Entei" **chegou**, e a releitura disse "o jogo não me
  // levou". Duas verdades sobre a mesma coisa divergem sempre.
  const viagem = codigo.slice(codigo.indexOf('const r = await viajar(degrau.cacada)'));
  assert.match(viagem.slice(0, 400), /if \(!r\.ok\) \{/, 'a viagem confia no resultado da porta');
  const destino = codigo.slice(codigo.indexOf('const r = await viajar(cfg.destino)'));
  assert.match(destino.slice(0, 400), /if \(r\.ok\) return feito\(\);/, 'o destino também confia');
  // Nenhuma viagem é seguida de uma releitura do lugar para decidir se deu certo.
  assert.doesNotMatch(codigo, /await viajar\([^)]*\);\s*if \(local\(\)/);
});

test('uma porta para a cacada, e e a das Cacadas', () => {
  // A ferramenta Caçadas já lê `.platform-hunt__zone-name`, com os testes dela. Uma segunda
  // leitura aqui divergiria no primeiro dia em que o jogo mudasse a tela.
  assert.match(codigo, /globalThis\.PPX\?\.cacadas\?\.atual\?\.\(\)\?\.nome \|\| ''/);
  assert.doesNotMatch(codigo, /platform-hunt__zone-name/);
  // E a viagem também: esta ferramenta decide **quando**, nunca **como**.
  assert.match(codigo, /return cacadas\.ir\(nome\)/);
  assert.doesNotMatch(codigo, /hunt-list-row|data-menu-id="hunts"/);
});

test('nao ha ponte para o mundo da pagina, porque a espera esta no DOM', () => {
  // `PokeIdle.TeamLeaderCooldown.remainingMs()` seria o caminho óbvio, e custaria um arquivo em
  // `world: MAIN` mais uma ponte de eventos. O `title` da caixa traz a mesma informação deste lado.
  assert.doesNotMatch(codigo, /PokeIdle/);
  const manifest = JSON.parse(ler('manifest.json'));
  const main = manifest.content_scripts.find((c) => c.world === 'MAIN');
  assert.ok(!main.js.includes('escada.js'), 'a escada não entra no mundo da página');
});

test('o caminho a mao vale com a escada parada, e cumpre o degrau', () => {
  // Ir à mão para onde a escada iria é cumprir o degrau. Não marcar faria a escada arrastar o
  // jogador para lá outra vez na batida seguinte.
  const bloco = codigo.slice(codigo.indexOf('async function irAMao'));
  const corpo = bloco.slice(0, bloco.indexOf('\n    }'));
  assert.doesNotMatch(corpo, /cfg\.ligada|cfg\.trocar/);
  assert.match(corpo, /cfg\.aplicado = degrau\.nivel;/);
  // E a frase do desfecho sobrevive ao redesenho. Medido no jogo em 11/10/2026: o "Não consegui ir
  // para X: …" nunca chegava a ser lido, porque o `finally` redesenhava logo a seguir e o
  // diagnóstico escrevia por cima. Primeiro o desenho, depois a frase.
  assert.match(corpo, /desenhar\(false\);/);
  const ordem = corpo.indexOf('desenhar(false)');
  assert.ok(ordem >= 0 && ordem < corpo.indexOf('diz(recado.txt'), 'desenha antes de dizer');
  // Um clique de cada vez: o segundo só atrapalharia o primeiro.
  assert.match(corpo, /if \(indoAMao \|\| correndo\) return;/);
});

test('os dois modos de upar nunca correm juntos', () => {
  // Pedido em 12/10/2026: um modo novo, com um Pokémon fixo (o da pedra da XP) e os outros a rodar.
  // Os dois mexem na MESMA equipe e na MESMA caçada — então são uma escolha numa listbox, e não dois
  // interruptores. Dois a correr tirariam da equipe o que o outro acabou de pôr.
  for (const modo of ['escada', 'grupo', 'passo'])
    assert.match(codigo, new RegExp(`<option value="${modo}">`), `falta o modo ${modo}`);
  const bloco = codigo.slice(codigo.indexOf('async function conferir(aviso'));
  assert.match(bloco, /if \(cfg\.modo !== 'escada'\) return conferirGrupo\(aviso\);/);
  // E o painel troca os campos: perguntar degraus e grupo ao mesmo tempo seria perguntar duas vezes
  // a mesma coisa, e uma delas não seria usada.
  assert.match(codigo, /campo\('\[data-escada\]'\)\.style\.display = noGrupo \? 'none' : '';/);
  assert.match(codigo, /campo\('\[data-grupo\]'\)\.style\.display = noGrupo \? '' : 'none';/);
});

test('a cacada e sempre a ultima da fila, nos dois modos, e quem cede e acordado', () => {
  // Medido pelo dono em 13/10/2026: com a escada de degraus a andar, o ginásio do dia não chegava a
  // entrar. Só o modo de grupo cedia; o de degraus disputava a vez de igual para igual — e quem
  // bate a cada mudança de HUD bate muito mais vezes do que quem roda uma vez por dia. Uma
  // prioridade que vale só num dos modos não é uma prioridade.
  //
  // Caçar é o que o jogo faz sozinho o dia inteiro; ginásio, arena, venda e compra são coisas que o
  // dono mandou fazer agora. Se alguém está com a vez OU à espera dela, a caçada para.
  const bloco = codigo.slice(codigo.indexOf('const cedendo = () =>'));
  const corpo = bloco.slice(0, bloco.indexOf('\n    };'));
  assert.match(corpo, /dono\.id !== 'escada'/, 'cede a quem está com a vez');
  assert.match(corpo, /esperando\?\.\(\)/, 'e cede também a quem está só à espera dela');
  // **E quem cede tem de ser acordado.** O gatilho normal é o HUD mudar, e quem está a ceder não
  // mexe no HUD — a ferramenta à frente pode nem mexer. Sem isto, cederia a vez para sempre.
  assert.match(codigo, /PPX\?\.vez\?\.aoMudar\?\.\(/);
  const acorda = codigo.slice(codigo.indexOf('PPX?.vez?.aoMudar?.('));
  assert.match(acorda.slice(0, 400), /if \(cedendo\(\)\) \{/);
  assert.match(acorda.slice(0, 400), /retomar\(\);/);
  // E acorda nos dois modos: o `cfg.modo === 'escada'` que saía daqui deixava a escada de degraus
  // a disputar a vez, que é exactamente o defeito que o dono viu.
  assert.ok(
    !/if \(!cfg\.ligada \|\| cfg\.pausada \|\| cfg\.modo === 'escada'\) return;/.test(acorda),
    'quem cede é a caçada, e não um dos modos dela',
  );

  // E a batida cede antes de qualquer acção, não no meio de uma — e antes de escolher o modo, que
  // é o que faz a regra valer para os dois.
  const batida = codigo.slice(codigo.indexOf('async function conferir(aviso'));
  const corte = batida.indexOf("if (cfg.modo !== 'escada') return conferirGrupo(aviso);");
  assert.ok(corte > 0);
  assert.ok(
    batida.slice(0, corte).includes('const outra = cedendo();'),
    'cede antes de escolher o modo, e portanto nos dois',
  );
  assert.match(batida.slice(0, corte), /return 'cedendo';/);

  // O mesmo no diagnóstico: um painel que cala a razão de estar parado é indistinguível de um
  // painel quebrado, e esta é a razão mais fácil de confundir com "travou".
  const diz = codigo.slice(codigo.indexOf('function diagnostico()'));
  const ate = diz.indexOf("if (cfg.modo !== 'escada') return diagnosticoGrupo();");
  assert.ok(ate > 0);
  assert.match(diz.slice(0, ate), /a caçada é a última da fila/);
});

test('o grupo e uma composicao para agora, e nao uma fila de entradas e saidas', () => {
  // Pensar em "quem entra no lugar de quem" exigiria guardar de quem era cada vaga, e um F5 no meio
  // deixaria essa conta a mentir. A composição certa calcula-se do zero a cada batida, e a troca é a
  // diferença entre ela e o HUD.
  const bloco = codigo.slice(codigo.indexOf('const montagemDoGrupo ='));
  const corpo = bloco.slice(0, bloco.indexOf('\n    };'));
  // O fixo primeiro, e é ele o líder: o jogo recusa remover o Pokémon ativo, então pôr a liderança
  // em quem roda daria uma troca travada a cada volta.
  assert.match(corpo, /const escolhidos = \[fixo\];/);
  assert.match(codigo, /m\.fixo\.id,/);
  // A equipe trava em 6, e espécie não repete na equipe — as duas regras são do jogo, medidas nos
  // Times. Um rodante de espécie já presente é SALTADO, não tentado.
  assert.match(corpo, /escolhidos\.length >= 6/);
  assert.match(corpo, /especies\.has\(bicho\.especie\)/);
  assert.match(corpo, /saltados\.push\(bicho\)/);
  // E quem chegou ao alvo não se guarda numa lista: o nível do bicho já diz.
  assert.match(corpo, /piscina\.filter\(\(b\) => b\.nivel < alvo\)/);
  assert.ok(
    !/feitos/.test(codigo),
    'uma lista de formados seria uma segunda verdade sobre o nível',
  );
});

test('o alvo do modo passo sobe de rodada em rodada', () => {
  // O exemplo dele: 3 Pokémon em Lv 10, 13 e 16, mínimo 20 e 5 níveis. As rodadas são 25, 30, 35 —
  // o mínimo é o chão de onde se parte, não o primeiro alvo ("quando chegarem no lvl 20, vai upar
  // mais 5 leveis").
  const bloco = codigo.slice(codigo.indexOf('const alvoDoGrupo ='));
  const corpo = bloco.slice(0, bloco.indexOf('\n    };'));
  assert.match(corpo, /minimo \+ passo \* \(\(Number\(g\.rodada\) \|\| 0\) \+ 1\)/);
  // A rodada fecha ANTES de a equipe ser desfeita: subir o alvo primeiro poupa tirar cinco Pokémon
  // para os pôr de volta um instante depois.
  const batida = codigo.slice(codigo.indexOf('async function conferirGrupo'));
  const fecha = batida.indexOf("if (!m.faltam.length && cfg.modo === 'passo')");
  assert.ok(fecha >= 0, 'a rodada fecha na batida do grupo');
  assert.ok(fecha < batida.indexOf('times.montar('), 'fecha antes de mexer na equipe');
  // E mexer no alvo zera as rodadas: guardá-las faria o próximo alvo sair de uma conta que ele não
  // fez.
  assert.match(codigo, /cfg\.grupo\.rodada = 0;/);
});

test('quem mexe na equipe do grupo e a ferramenta Times', () => {
  // A ponte do mundo da página sabe `addTeamMember`, e usá-la seria uma segunda rotina de equipar —
  // que divergiria da dos Times no primeiro mês. A dos Times conhece as três regras medidas no jogo
  // e replaneja contra o HUD a cada passo.
  assert.match(codigo, /globalThis\.PPX\.times\.montar\(/);
  const times = semComentarios(ler('times.js'));
  assert.match(times, /montar: async \(membros, lider, nome = 'o grupo'\) => \{/);
  assert.match(
    times,
    /if \(lista\.length > 6\) return \{ ok: false, erro: 'a equipe trava em 6' \};/,
  );
  // E ela passa pelo mesmo `usarTime` de sempre, com a ordem de batalha de fora: abrir o painel de
  // equipe é mais uma janela, e quem troca dois Pokémon não está a pedir uma formação.
  const porta = times.slice(times.indexOf("montar: async (membros, lider, nome = 'o grupo')"));
  assert.match(porta.slice(0, 500), /return usarTime\(\{/);
  assert.match(porta.slice(0, 500), /ordem: \[\],/);
  // Quem está em cada time é pergunta para os Times, como o time de uma caçada é para as Caçadas.
  assert.match(times, /membrosDe: \(nome\) =>/);
});

test('pausar guarda o lugar, parar esquece', () => {
  // São dois botões porque são duas coisas, e quem pausa a noite inteira não quer perder a rodada,
  // a fila nem o degrau cumprido por clicar no errado.
  assert.match(codigo, /data-pausar/);
  const bloco = codigo.slice(codigo.indexOf("campo('[data-pausar]').addEventListener"));
  assert.match(bloco.slice(0, 400), /cfg\.pausada = !cfg\.pausada;/);
  // Retomar não cumpre um castigo que já passou enquanto estava pausada.
  assert.match(bloco.slice(0, 400), /if \(!cfg\.pausada\) esperaAte = 0;/);
  // E a pausa cala a batida dos dois modos, dizendo que está pausada.
  const batida = codigo.slice(codigo.indexOf('async function conferir(aviso'));
  const inicio = batida.slice(0, batida.indexOf('// ------'));
  assert.match(inicio, /if \(cfg\.pausada\) \{/);
  assert.ok(
    inicio.indexOf('if (cfg.pausada)') < inicio.indexOf("cfg.modo !== 'escada'"),
    'pausada cala os dois modos, e não só um',
  );
});

test('a cacada do grupo tambem nao pode guardar time', () => {
  // Mesma colisão do fim da escada, e aqui é pior: a viagem apagaria o grupo a cada volta.
  const batida = codigo.slice(codigo.indexOf('async function conferirGrupo'));
  const recusa = batida.indexOf('const guardado = globalThis.PPX?.cacadas?.timeDe?.(lugar.ir);');
  assert.ok(recusa >= 0, 'confere o time guardado na caçada do grupo');
  assert.ok(recusa < batida.indexOf('await viajar('), 'recusa ANTES de viajar');
  assert.match(codigo, /apagaria o grupo/);
});

test('a batida do grupo tem a mesma ordem da outra: enfermeira, viagem, equipe', () => {
  // A ordem é a mesma e pelo mesmo motivo medido em 11/10/2026: chega-se primeiro ao lugar certo e
  // mexe-se na equipe depois. Aqui o morto importa ainda mais — quem caça é o fixo, e um fixo
  // derrotado não dá XP a ninguém.
  const batida = codigo.slice(codigo.indexOf('async function conferirGrupo'));
  const corpo = batida.slice(0, batida.indexOf("return 'acertado';"));
  const cura = corpo.indexOf('await curar(morto, aviso)');
  const viagem = corpo.indexOf('await viajar(lugar.ir)');
  const equipe = corpo.indexOf('times.montar(');
  assert.ok(cura >= 0 && viagem >= 0 && equipe >= 0, 'os três passos existem');
  assert.ok(cura < viagem, 'a enfermeira vem antes da viagem');
  assert.ok(viagem < equipe, 'a viagem vem antes de mexer na equipe');
});

test('a ferramenta esta no catalogo, no manifest e com atalho proprio', () => {
  const nucleo = ler('nucleo.js');
  assert.match(
    nucleo,
    /\{ id: 'escada', nome: 'Escada de caçadas', atalhos: 'Alt\+U esconde · Alt\+I mostra' \}/,
  );
  const manifest = JSON.parse(ler('manifest.json'));
  const idle = manifest.content_scripts.find((c) => c.js.includes('cacadas.js'));
  assert.ok(idle.js.includes('escada.js'), 'escada.js entra junto com as outras');
  // Alt+U e Alt+I eram as duas únicas teclas livres: o pacote já usa dezoito, o caderno de
  // anotações usa O e P em qualquer site, e o LionMultInstance escuta M, R, as setas e o 1 ao 4
  // por fora da página. O guarda contra as teclas do aplicativo está em `atalho-tudo.test.mjs`.
  for (const tecla of ['KeyU', 'KeyI'])
    for (const outro of [
      'cacadas.js',
      'times.js',
      'gym.js',
      'layout-padrao.js',
      'loja-rapida.js',
      'venda-rapida.js',
      'raridades.js',
      'ocultar-popups.js',
      'sem-grafico.js',
      'senha.js',
      'nucleo.js',
    ])
      assert.doesNotMatch(
        ler(outro),
        new RegExp(`code === '${tecla}'`),
        `Alt+${tecla.slice(3)} livre em ${outro}`,
      );
});

test('ela guarda a propria escolha, e o menu a comanda', () => {
  // Um módulo que não grava a escolha dele deixa o botão do menu virar um interruptor que esquece.
  assert.match(codigo, /globalThis\.PPX\.controlar\?\.\('escada', mostrarPainel\)/);
  assert.match(codigo, /mostrarPainel\(globalThis\.PPX\.visivel\?\.\('escada'\) !== false\)/);
  assert.match(codigo, /globalThis\.PPX\?\.anotar\?\.\('escada', false\)/);
  assert.match(codigo, /globalThis\.PPX\?\.anotar\?\.\('escada', true\)/);
  // E escondido ela não se posiciona pelo zero: sem caixa, o canto guardado manda para o lugar
  // errado. Quem volta à vista recoloca.
  const bloco = codigo.slice(codigo.indexOf('const mostrarPainel'));
  assert.match(bloco.slice(0, 300), /if \(sim\) recolocar\(\);/);
});

test('o lugar do grupo e uma lista em ordem, e estar numa delas basta', () => {
  // Pedido em 12/10/2026: a expedição diária é oportunista — abre em janelas fixas e só se entra
  // nela com um CAPTCHA, à mão. O que não pode é parar de upar quando ele não está no PC. Então o
  // grupo tem uma LISTA: fica na primeira onde consiga estar, e a expedição é só mais uma entrada.
  const bloco = codigo.slice(codigo.indexOf('const lugarDoGrupo ='));
  const corpo = bloco.slice(0, bloco.indexOf('\n    };'));
  // Estar na terceira basta: subir dali para a primeira a cada batida seria trocar de caçada por
  // nada, e cada troca custa a viagem e o risco de um modal pelo meio.
  assert.match(corpo, /const aqui = lista\.find\(\(nome\) => porta\?\.estouEm\?\.\(nome\)\);/);
  assert.match(corpo, /if \(aqui\) return \{ aqui, ir: null \};/);
  // E só se viaja para onde dá: a expedição não é destino, é um lugar que se respeita.
  assert.match(corpo, /porta\?\.daParaIr\?\.\(nome\) !== false/);
  // O time guardado confere-se na que VAI ser aberta, não na lista toda: as outras podem nunca
  // chegar a ser usadas.
  const batida = codigo.slice(codigo.indexOf('async function conferirGrupo'));
  assert.match(batida, /timeDe\?\.\(lugar\.ir\)/);
  // A caçada única de antes vira a primeira da lista, e não se perde.
  assert.match(codigo, /if \(!cfg\.grupo\.cacadas\.length && cfg\.grupo\.cacada\)/);
});

test('as pedras revezam-se, e qual esta a correr nao se guarda', () => {
  // Pedido em 12/10/2026: cada pedra da XP só divide com Pokémon da sua região (hoje Kanto e
  // Johto) e **só o Pokémon ativo divide** — medido pelo dono. Logo, duas pedras na equipe ao mesmo
  // tempo seriam um slot gasto à toa: elas têm de se revezar.
  assert.match(
    codigo,
    /const turnosDoGrupo = \(\) => \(cfg\.grupo\.turnos \|\| \[\]\)\.filter\(Boolean\);/,
  );
  // O turno a correr é o primeiro que ainda tem alguém abaixo do alvo. NÃO se guarda qual é: o
  // nível já diz, como em todo o resto deste modo. Guardar "vai no turno 2" seria uma segunda
  // verdade, pronta a mentir depois de um F5 ou de uma troca feita à mão.
  const escolha = codigo.slice(codigo.indexOf('const turnoDeAgora ='));
  assert.match(
    escolha.slice(0, 300),
    /\.find\(\(turno\) => piscinaDoTurno\(turno, todos\)\.some\(\(b\) => b\.nivel < alvo\)\)/,
  );
  assert.ok(!/grupo\.vez|turnoAtual\s*=/.test(codigo), 'nada guarda qual pedra está a correr');
  // Acabados todos, fica o primeiro: alguém tem de continuar a caçar, e a escolha tem de ser sempre
  // a mesma ou a equipe ficava a dançar entre as pedras sem ninguém a upar.
  assert.match(codigo, /const turno = correndo \|\| turnos\[0\];/);
  // A piscina de um turno não inclui a própria pedra.
  assert.match(codigo, /const vistos = new Set\(\[turno\.fixo\]\);/);
  // A região NÃO é conferida, e de propósito: quem diz qual Pokémon é de qual pedra é o dono, ao
  // pôr os times certos no turno certo. Adivinhar pelo `species_id` seria apostar que o jogo numera
  // como a Pokédex nacional, e isso não foi medido.
  assert.ok(!/species_id|regiao\s*===\s*'kanto'/i.test(codigo), 'ninguém adivinha a região');
  // O fixo e os times soltos de antes viram o primeiro turno.
  assert.match(
    codigo,
    /cfg\.grupo\.turnos = \[\{ fixo: cfg\.grupo\.fixo \|\| '', times: cfg\.grupo\.times \|\| \[\] \}\];/,
  );
});

test('a pedra de um turno escolhe-se entre a equipe e os times dele', () => {
  // Só a equipe não chega desde que há turnos: a pedra do segundo turno costuma estar na mochila
  // enquanto o primeiro corre, e era justamente aí que ela tinha de ser escolhida. A coleção
  // inteira também não serve — 223 linhas não são uma escolha, são uma busca.
  const bloco = codigo.slice(codigo.indexOf('const candidatosAPedra ='));
  const corpo = bloco.slice(0, bloco.indexOf('\n    };'));
  assert.match(corpo, /for \(const p of equipe\(\)\)/);
  assert.match(corpo, /for \(const nome of semVazios\(turno\.times \|\| \[\]\)\)/);
  // E a coleção lê-se quando o painel precisa dela: configurar faz-se com a escada PARADA, que é
  // justamente quando a batida não a leria.
  assert.match(codigo, /const garantirColecao = \(\) => \{/);
  assert.match(
    codigo,
    /if \(colecao\.size \|\| pedindoBichos \|\| cfg\.modo === 'escada'\) return;/,
  );
});

test('a cacada de um degrau escolhe-se no catalogo inteiro, e com filtro', () => {
  // Um degrau é "a partir do Lv N, caçar aqui", e a caçada certa para o Lv N é uma questão de
  // nível: ela existe no jogo muito antes de alguém ter ido lá guardar o atalho. Exigir o atalho
  // primeiro fazia montar dez degraus custar dez viagens, e era por isso que as escadas ficavam
  // curtas.
  assert.match(codigo, /const todas = globalThis\.PPX\?\.cacadas\?\.todas\?\.\(\);/);
  assert.match(codigo, /if \(Array\.isArray\(todas\) && todas\.length\) return todas;/);
  // Sem a ferramenta Caçadas, ou antes de ela ler a lista, sobra o que havia: os atalhos.
  const fonte = codigo.slice(codigo.indexOf('const cacadasConhecidas ='));
  assert.match(fonte.slice(0, 600), /return cacadasGuardadas\(\)\.map/);
  // 377 opções num `select` não são uma escolha, são uma busca sem campo de busca: o campo passou
  // a ser um `input` ligado a um `datalist`, que é o mesmo campo com filtro de graça.
  assert.match(codigo, /const DATALISTA = 'lioncode-escada-cacadas';/);
  assert.match(codigo, /c\.setAttribute\('list', DATALISTA\)/);
  assert.doesNotMatch(
    codigo,
    /const (qual|onde) = document\.createElement\('select'\);\n\s*encherCacadas/,
  );
  // E cada opção leva o nível e a região na etiqueta, que é por onde se decide onde upar.
  const lista = codigo.slice(codigo.indexOf('const encherDatalista ='));
  assert.match(lista.slice(0, 800), /Lv \$\{c\.nivel\}/);
  assert.match(lista.slice(0, 800), /c\.regiao/);
  assert.match(lista.slice(0, 800), /c\.trancada \? 'trancada' : ''/);
});

test('a lista das cacadas e uma so, e nao se refaz a cada batida', () => {
  // São 377 nós. Uma lista por campo duplicaria isso a cada degrau novo, e `desenhar` corre a cada
  // batida — refazer quatrocentos nós de segundo em segundo seria pagar por nada.
  assert.equal(codigo.match(/<datalist/g)?.length, 1);
  const lista = codigo.slice(codigo.indexOf('const encherDatalista ='));
  assert.match(lista.slice(0, 500), /if \(digital === digitalDaLista\) return;/);
  assert.match(
    lista.slice(0, 500),
    /\$\{todas\.length\}\|\$\{todas\[0\]\?\.nome \|\| ''\}\|\$\{todas\.at\(-1\)\?\.nome \|\| ''\}/,
  );
  // E o desenho enche-a antes de desenhar os campos que dependem dela.
  assert.ok(
    codigo.indexOf('encherDatalista();') < codigo.indexOf("campo('[data-fim]').value"),
    'a lista enche-se antes dos campos',
  );
});

test('uma cacada que ninguem conhece nao fica calada no campo', () => {
  // Um campo de escrever aceita qualquer coisa, e um erro de digitação só apareceria na viagem —
  // tarde, e a dizer "não achei em nenhuma aba". Antes era um `select`, e o valor órfão ficava lá
  // escrito "(não guardada)".
  const marca = codigo.slice(codigo.indexOf('const marcarCacada ='));
  const corpo = marca.slice(0, marca.indexOf('\n    };'));
  assert.match(corpo, /const sabida = !nome \|\| nomesSabidos\.has\(nome\)/);
  assert.match(corpo, /c\.classList\.toggle\('nao-existe', !sabida\)/);
  assert.match(corpo, /Não conheço nenhuma caçada chamada/);
  // E o que se guarda é o nome sem espaços nas pontas: um espaço colado ao nome não acha nada.
  assert.match(codigo, /cfg\.grupo\.cacadas\[i\] = qual\.value\.trim\(\)/);
  assert.match(codigo, /degrau\.cacada = onde\.value\.trim\(\)/);
  assert.match(codigo, /cfg\.destino = e\.target\.value\.trim\(\)/);
});

test('a lista das cacadas fica fresca no instante de escolher', () => {
  // Nao ha' `setInterval` nesta ferramenta, de proposito. Mas as Cacadas podem ler o catalogo do
  // jogo DEPOIS deste painel ter sido desenhado, e foi o que aconteceu no jogo do dono em
  // 12/10/2026: chegaram 377 cacadas e os campos da Escada continuaram com as dez de antes, ate
  // alguem mexer no painel. Enche-se ao focar, que e' quando a frescura importa.
  const segue = codigo.slice(codigo.indexOf('const seguirALista ='));
  const corpo = segue.slice(0, segue.indexOf('});'));
  assert.match(corpo, /addEventListener\('focus'/);
  assert.match(corpo, /encherDatalista\(\);/);
  assert.match(corpo, /marcarCacada\(c\);/);
  // Todos os campos de cacada seguem a lista: os que nascem num degrau e o do fim, que e' do HTML.
  assert.ok(
    codigo.includes('seguirALista(c);') &&
      codigo.indexOf('seguirALista(c);') < codigo.indexOf('const campoDeCacada') + 400,
    'o campo que nasce num degrau segue a lista',
  );
  assert.match(codigo, /seguirALista\(campo\('\[data-destino\]'\)\);/);
});

test('na expedicao a escada de degraus espera, e nao tenta sair', () => {
  // MEDIDO NO JOGO DO DONO EM 12/10/2026, com ele dentro da expedicao e o degrau de Lv 140 em
  // "Togetic": o painel repetia "Degrau 140 nao deu: cliquei em Cacar e continuei em «Expedicao
  // Diaria Cooperativa»", batida apos batida. A expedicao ja' era respeitada, mas so' no modo de
  // grupo, pela lista de lugares — e no modo de degraus essa lista nem e' lida.
  assert.match(
    codigo,
    /const naExpedicao = \(\) => globalThis\.PPX\?\.cacadas\?\.atual\?\.\(\)\?\.tipo === 'expedicao';/,
  );
  // Quem responde e' a porta das Cacadas, pelo TIPO: a expedicao nao tem zona, e comparar o nome
  // do mapa com o degrau nunca da' igual — que e' exactamente como o defeito nascia.
  const bater = codigo.slice(codigo.indexOf('async function conferir(aviso'));
  const corpo = bater.slice(0, bater.indexOf('const aluno = alunoDeAgora()'));
  assert.match(corpo, /if \(naExpedicao\(\)\) \{/);
  assert.match(corpo, /return 'na expedicao';/);
  // E espera TUDO: a guarda vem antes da equipe, da enfermeira, da viagem e da troca.
  assert.ok(
    corpo.indexOf('naExpedicao()') < corpo.indexOf("if (!equipe().length) return '';"),
    'a guarda vem antes de qualquer acao da batida',
  );
  // So' no modo de degraus: no grupo, estar na expedicao conta como estar onde o grupo fica, e
  // isso e' uma decisao tomada a pedido do dono.
  assert.ok(
    corpo.indexOf("if (cfg.modo !== 'escada') return conferirGrupo(aviso);") <
      corpo.indexOf('naExpedicao()'),
    'o grupo segue o seu proprio caminho, com a lista de lugares',
  );
  // E o painel diz o mesmo quando perguntado, em vez de inventar o que falta.
  assert.match(codigo, /espero aqui e volto ao degrau quando ela acabar/);
});

test('a equipe sobe junta de N em N, e o teto continua a ser um fim', () => {
  // Pedido pelo dono em 12/10/2026: "na escada, no modo escada de cacadas, eu quero poder colocar
  // que nem tem no modo grupo subindo N em N, onde eu nao vou colocar uma pedra em nenhum poke e
  // eles vao ficar upando sempre que todos estao no mesmo level".
  assert.match(codigo, /subida: null,/);
  const sobe = codigo.slice(codigo.indexOf('const tetoDeAgora = ()'));
  const corpo = sobe.slice(0, sobe.indexOf('const formado = (p, teto'));
  // Sem subida, o teto e' o que esta' escrito: a escada de sempre nao muda de comportamento.
  assert.match(corpo, /if \(!teto \|\| !subida\) return teto \|\| null;/);
  // O degrau de agora sai do MENOR nivel da equipe — e' o que faz a equipe subir junta.
  assert.match(corpo, /const menor = Math\.min\(\.\.\.niveis\);/);
  // **A LINHA QUE FAZ A FILA DE TIMES EXISTIR.** Sem o `Math.min`, a conta passa do teto e ninguem
  // se forma nunca: `fimDaEscada` deixa de correr e os outros times nao chegam a ter vez. Foi o
  // defeito de uma hora, apanhado pelo dono: "nao encontro onde colocar os outros times".
  assert.match(corpo, /if \(menor >= teto\) return teto;/);
  assert.match(corpo, /return Math\.min\(teto, menor \+ subida\);/);
  // NAO HA' CONTADOR DE RODADAS, ao contrario do modo de grupo: aqui o jogo diz o nivel de cada um,
  // e um contador ao lado seria uma segunda verdade — que se perderia no primeiro F5 e, pior,
  // ficaria errada quando o dono metesse um Lv 1 na equipe.
  assert.ok(!corpo.includes('rodada'), 'o degrau de agora deriva da equipe, nao de um contador');
});

test('quem se formou mede-se pelo teto de agora, e o teto le-se uma vez por batida', () => {
  assert.match(codigo, /const formado = \(p, teto = tetoDeAgora\(\)\) =>\n\s+Boolean\(teto\)/);
  // `tetoDeAgora` varre a equipe toda: perguntar por cada bicho varreria seis vezes a mesma lista
  // para dar sempre a mesma resposta.
  const proximo = codigo.slice(codigo.indexOf('const proximoAluno = ()'));
  const corpo = proximo.slice(0, proximo.indexOf('};'));
  assert.match(corpo, /const teto = tetoDeAgora\(\);/);
  assert.match(corpo, /!formado\(p, teto\)/);
  // E o painel nao anuncia um teto que ja' nao e' o de agora.
  assert.match(codigo, /A equipe toda chegou ao Lv \$\{tetoDeAgora\(\)\}/);
});

test('a subida nao esconde o fim da escada, que e onde moram os outros times', () => {
  // O defeito de uma hora: com a subida posta, o painel escondia o "formados: ..." inteiro — e com
  // ele a fila de times. O dono: "nao encontro onde colocar os outros times".
  assert.ok(!codigo.includes('tetoSobe'), 'nada no painel depende de o teto fugir');
  assert.match(codigo, /destino\.style\.display = cfg\.fim === 'cacada' \? '' : 'none';/);
  assert.match(
    codigo,
    /campo\('\[data-times\]'\)\.style\.display = cfg\.fim === 'time' \? '' : 'none';/,
  );
  assert.match(codigo, /const perguntando = filaAcabou\(\);/);
  // A unica coisa que a subida mostra e' a frase que explica o que ela faz.
  assert.match(codigo, /campo\('\[data-junta\]'\)\.style\.display = cfg\.subida \? '' : 'none';/);
  // Mexer no teto ou na subida muda quem e' o aluno: o cumprido era do aluno anterior.
  const ouve = codigo.slice(codigo.indexOf("['[data-subida]', 'subida'],"));
  assert.match(ouve.slice(0, 500), /cfg\.formados = false;/);
});

test('um rotulo com campo no meio nao empurra as palavras para fora do painel', () => {
  // Medido no painel do dono em 12/10/2026: "formar em Lv" partido em duas linhas, o campo
  // esticado e o "e mais" orfao. Um `input` dentro de um flex cresce; os numeros levam largura
  // fixa, e o rotulo pode quebrar em vez de transbordar.
  const estilo = ler('escada.js');
  assert.match(estilo, /#lioncode-escada \.caixa \{[^}]*flex-wrap: wrap;/);
  assert.match(
    estilo,
    /#lioncode-escada \.caixa input\[type="number"\] \{ width: 58px; flex: none; \}/,
  );
});

test('o grupo nao arrasta ninguem para uma cacada onde nao consegue trabalhar', () => {
  // MEDIDO NUMA SEGUNDA CONTA DO DONO EM 12/10/2026: a pedra escolhida já não estava na coleção
  // daquela conta e um dos times não existia lá, e mesmo assim a escada o tirou da "Caça de
  // Kirlia" e o levou para a "Caça de Gardevoir" — para, chegando, descobrir que não tinha grupo
  // nenhum para montar.
  const bater = codigo.slice(codigo.indexOf('async function conferirGrupo'));
  const corpo = bater.slice(0, bater.indexOf('\n    }\n'));
  // A leitura da coleção e a montagem vêm ANTES da viagem. A leitura não mexe em nada e já era
  // feita a cada batida, logo a seguir: aqui ela só mudou de lugar.
  assert.ok(
    corpo.indexOf('const m = montagemDoGrupo(colecao, alvo);') <
      corpo.indexOf('const lugar = lugarDoGrupo();'),
    'a montagem é conferida antes de a viagem ser decidida',
  );
  // `indexOf` devolve -1 para quem nao existe, e -1 e' menor do que tudo: sem esta primeira
  // asserção, apagar a linha passava no teste.
  assert.ok(corpo.includes("return 'sem montagem';"), 'a montagem impossível para a batida');
  assert.ok(
    corpo.indexOf("return 'sem montagem';") < corpo.indexOf("return 'viajou';"),
    'uma montagem impossível para a batida antes de viajar',
  );
  // E lê-se UMA vez por batida: quem chega à equipe não viajou, então os níveis são os mesmos.
  assert.equal(
    corpo.split('await pedirBichos()').length - 1,
    1,
    'a coleção é lida uma vez por batida, e não duas',
  );
});

test('um time que nao existe nesta conta nao e um time', () => {
  // Acontece a quem leva a configuração de uma janela para outra: os nomes vêm juntos, os times
  // ficam na conta de origem. O painel já marcava "(não guardado)" na lista; faltava recusar.
  const falta = codigo.slice(codigo.indexOf('const faltaNoGrupo = ()'));
  const corpo = falta.slice(0, falta.indexOf("return '';"));
  assert.match(corpo, /const sabidos = globalThis\.PPX\?\.times\?\.nomes\?\.\(\);/);
  assert.match(corpo, /const orfao = meus\.find\(\(nome\) => !sabidos\.includes\(nome\)\);/);
  assert.match(corpo, /não existe nesta conta/);
  // Sem a ferramenta Times a responder, não se inventa recusa: a lista vazia não prova nada.
  assert.match(corpo, /if \(Array\.isArray\(sabidos\) && sabidos\.length\)/);
});

test('os comandos nao se escondem junto com o corpo', () => {
  // Pedido do dono em 12/10/2026: minimizada é como ela vive, e iniciar, parar, pausar e retomar
  // são justamente o que ele quer alcançar sem abrir nada. O `.corpo` é o que o minimizar esconde,
  // então os botões saíram de lá para fora — um só par de botões, e não uma cópia a desencontrar-se.
  const html = codigo.slice(codigo.indexOf('painel.innerHTML = `'));
  const marcacao = html.slice(0, html.indexOf('`;'));
  assert.ok(
    marcacao.indexOf('data-ligar') < marcacao.indexOf('<div class="corpo">'),
    'os botões vêm antes do corpo, e por isso sobrevivem ao minimizar',
  );
  // E a caixa dos botões não leva um `hidden` de volta: escondê-la é desfazer o pedido.
  assert.match(marcacao, /<div class="botoes">/);
  assert.ok(!/class="botoes"[^>]/.test(marcacao), 'nada de atributos a esconder os comandos');
  assert.equal(marcacao.split('data-ligar').length - 1, 1, 'há um só botão de ligar');
  assert.equal(marcacao.split('data-pausar').length - 1, 1, 'há um só botão de pausar');
  assert.match(
    codigo,
    /#lioncode-escada\.minimizado \.botoes \{/,
    'minimizados, cabem no estreito',
  );
});

test('o corpo rola, e o teto e medido em vez de adivinhado', () => {
  // Com nove degraus, a fila de times e o bloco do fim, o painel passava do rodapé da tela e o
  // "+ time" ficava abaixo do monitor — visto na janela do dono em 12/10/2026.
  assert.match(codigo, /#lioncode-escada \.corpo \{[^}]*overflow-y: auto;/s);
  // O CSS traz um teto redondo, que é o chão; quem manda é a medida de onde o corpo está, porque
  // o painel arrasta-se e um número fixo deixaria passar quem o pusesse mais abaixo.
  assert.match(codigo, /max-height: calc\(100vh - 170px\);/);
  const ajuste = codigo.slice(codigo.indexOf('const ajustarAltura = ()'));
  const corpo = ajuste.slice(0, ajuste.indexOf('\n    };'));
  assert.match(corpo, /innerHeight - caixa\.top - rodape - 12/, 'o teto sai da posição real');
  assert.match(corpo, /corpo\.style\.maxHeight = '';/, 'limpa antes de medir, senão mede-se a si');
  // Aba escondida não tem viewport: tenta-se outra vez em vez de congelar um teto errado.
  assert.match(corpo, /requestAnimationFrame\(ajustarAltura\)/);
  // E remede-se quando a lista muda de tamanho, quando o painel se arrasta e quando a janela muda.
  assert.match(codigo, /addEventListener\('resize', recolocar\)/);
  assert.ok(
    codigo.indexOf('const ajustarAltura = ()') < codigo.indexOf('const desenhar = ('),
    'declarada antes de desenhar, que a chama já na subida da página',
  );
});

test('o recado nao se esconde dentro da rolagem', () => {
  // Visto na conta do dono em 13/10/2026: "Parar" aceso, nada a acontecer, e nenhuma explicação à
  // vista — a frase que explica a espera tinha ficado abaixo da rolagem que eu mesmo criei. Ela é
  // a única coisa que distingue uma escada à espera de uma escada quebrada.
  const html = codigo.slice(codigo.indexOf('painel.innerHTML = `'));
  const marcacao = html.slice(0, html.indexOf('`;'));
  const corpo = marcacao.indexOf('<div class="corpo">');
  const fimDoCorpo = marcacao.indexOf('</div>', marcacao.lastIndexOf('<datalist'));
  const recado = marcacao.indexOf('<p class="estado" data-estado>');
  assert.ok(recado > corpo, 'o recado vem depois do corpo');
  assert.ok(recado > fimDoCorpo, 'e fora dele, para não rolar junto');
  assert.match(codigo, /#lioncode-escada > \.estado \{/, 'tem o estilo de rodapé');
  // Minimizada quem fala é o eco do topo: duas cópias da mesma frase é uma a mais.
  assert.match(codigo, /#lioncode-escada\.minimizado > \.estado \{ display: none; \}/);
  // E o teto da rolagem desconta o que ficou debaixo do corpo, senão o painel passa do rodapé.
  const ajuste = codigo.slice(codigo.indexOf('const ajustarAltura = ()'));
  const miolo = ajuste.slice(0, ajuste.indexOf('\n    };'));
  assert.match(miolo, /const rodape = Math\.max\(0, painel\.getBoundingClientRect\(\)\.bottom/);
  assert.match(miolo, /innerHeight - caixa\.top - rodape - 12/);
});

test('fora de cacada nenhuma o degrau cumprido deixa de valer', () => {
  // Medido na conta do dono em 13/10/2026: Scizor Lv 34 na Cidade de Cerulean, degrau de Lv 30
  // cumprido, "você saiu de Machop — fique à vontade" na tela, e nada a acontecer. Parado numa
  // cidade ninguém ganha XP, então o Lv 40 — o degrau seguinte — nunca chegaria.
  //
  // Sair para outra caçada e sair para lugar nenhum não são a mesma coisa: a primeira é uma escolha
  // a respeitar, a segunda é o ginásio, a troca de time ou a enfermeira a deixarem o jogador na
  // cidade. É a mesma lição que a cura já tinha ensinado.
  assert.match(
    codigo,
    /const emLugarNenhum = \(\) =>\s*temPorta\(\) && globalThis\.PPX\.cacadas\.atual\(\) === null;/,
  );
  // Sem a ferramenta das Caçadas ninguém responde — e aí não se adivinha cidade nenhuma.
  assert.match(
    codigo,
    /const temPorta = \(\) => typeof globalThis\.PPX\?\.cacadas\?\.atual === 'function';/,
  );
  const conferir = codigo.slice(codigo.indexOf('async function conferir('));
  const corpo = conferir.slice(0, conferir.indexOf('\n    }'));
  assert.match(
    corpo,
    /if \(!chegou\(\) && cfg\.trocar === true && emLugarNenhum\(\)\) \{\s*cfg\.aplicado = null;/,
  );
  // E a licença de viajar continua a mandar: sem ela, ninguém arrasta ninguém para lado nenhum.
  assert.ok(
    corpo.indexOf('cfg.trocar === true && emLugarNenhum()') <
      corpo.indexOf('if (cfg.trocar !== true)'),
    'a licença é conferida na viagem, como sempre foi',
  );
});

test('o lugar entra na assinatura do HUD, senao a escada nunca repensa', () => {
  // A peneira só abre quando a assinatura muda, e sair da caçada não mexe em ninguém da equipe:
  // sem isto, a escada parada na cidade não voltaria a pensar — nem para voltar, nem para falar.
  const ass = codigo.slice(codigo.indexOf('const assinatura = () =>'));
  const corpo = ass.slice(0, ass.indexOf(';\n'));
  assert.match(corpo, /`\$\{local\(\)\}#`/);
  assert.match(corpo, /p\.morto \? 'M' : ''/, 'e continua a levar o que já levava');
});
