// Guardas da nona ferramenta: atalhos para cacadas.
//
// Nada aqui exercita o jogo — o caminho ate' uma cacada so' existe contra o DOM dele, e esta'
// provado na banca (`testes/banca-cacadas.html?jogo=1`), que monta as tres armadilhas reais. O que
// se protege aqui sao as **decisoes** que custaram caro noutras ferramentas deste pacote e que
// seriam facilmente desfeitas por quem mexesse no arquivo sem as conhecer.
//
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const ler = (arquivo) => readFileSync(new URL(`../${arquivo}`, import.meta.url), 'utf8');
const fonte = ler('cacadas.js');

// Os comentarios citam de proposito as coisas que o codigo nao pode conter.
const codigo = fonte
  .split('\n')
  .filter((linha) => !/^\s*(\/\/|\*|\/\*)/.test(linha))
  .join('\n');

test('a janela e conferida por largura, nunca por isConnected', () => {
  // A lição que travou o jogo do usuário: uma janela fechada continua no documento, e clicar no ✕
  // dela deixa o jogo convencido de que há janela aberta — ele recusa tudo até um F5.
  assert.doesNotMatch(codigo, /isConnected/);
  assert.match(
    codigo,
    /const visivel = \(el\) => Boolean\(el\) && el\.getBoundingClientRect\(\)\.width > 0/,
  );
});

test('a regiao e escolhida antes de procurar a linha', () => {
  // A janela reabre na última região usada. Procurar "Caça de Ralts" numa aba de Kanto não acha
  // nada, e a ferramenta diria que a caçada sumiu.
  const bloco = codigo.slice(codigo.indexOf('const irPara'));
  const regiao = bloco.indexOf('abasDa(jan())');
  const linha = bloco.indexOf('await ate(() => jan() && linhaDe(');
  assert.ok(regiao >= 0 && regiao < linha, 'escolhe a região antes de procurar a linha');
});

test('a janela tambem nao e guardada, e o modal da ausencia sai da frente', () => {
  // Medido no jogo em 11/10/2026, numa ida real: montar o time guardado da caçada levou **148 s**,
  // o jogo deu o jogador por ausente e, ao voltar, pôs "A caçada continuou sem você" por cima de
  // tudo. A ida ficou parada ali, calada, até alguém clicar à mão. Quanto mais demorada a troca de
  // time, mais provável o modal — ele é o caso normal da ida com time, não um azar.
  assert.match(codigo, /'\.hunt-absence-close',/);
  // E depois dele o jogo recria o painel: um elemento guardado vira nó órfão, toda leitura devolve
  // o que era e todo clique cai no vazio — sem nada reclamar.
  const bloco = codigo.slice(codigo.indexOf('const irPara'));
  assert.match(bloco, /const jan = \(\) => janelaPorTitulo\(\/CA\[ÇC\]ADAS\/i\);/);
  assert.doesNotMatch(bloco, /const janela = /);
  assert.doesNotMatch(bloco, /janela\.querySelectorAll/);
  // Fechar só no início não basta: o modal nasce no meio, então a varredura fecha a cada volta.
  const varre = bloco.slice(bloco.indexOf('for (const nome of nomes)'));
  assert.match(varre.slice(0, 600), /await fecharBanners\(\);/);
  // E a janela que se fecha a meio é dita, em vez de virar "não achei".
  assert.match(codigo, /a janela das caçadas fechou-se a meio da busca/);
});

test('abrir a janela nao acredita no DOM sobre ela estar aberta', () => {
  // **Duas medições, e a segunda desmente a primeira.** O botão da barra alterna, e clicando três
  // vezes seguidas o DOM acompanha: 1482px, 0px, 1482px — largura zero é fechada, e `visivel` já
  // sabe disso. Só que na mesma sessão, em 11/10/2026, o jogo apagou o painel inteiro do documento
  // por conta própria, e o clique seguinte **não abriu nada**: do lado dele a janela continuava
  // "aberta". O estado de aberto/fechado do jogo sobrevive ao painel deixar de existir, então
  // perguntar ao DOM se há janela aberta responde a outra pergunta.
  //
  // Por isso a abertura não decide por uma leitura: tenta, espera, e tenta outra vez. Um clique
  // perdido a fechar o que já estava fechado não custa nada — o que custava era desistir dizendo
  // que o jogo não abre a janela, com o jogador a ver que abre.
  const bloco = codigo.slice(codigo.indexOf('const abrirJanela = async () =>'));
  const corpo = bloco.slice(0, bloco.indexOf('\n    };'));
  assert.match(corpo, /for \(let tentativa = 0; tentativa < 2; tentativa \+= 1\)/);
  assert.match(corpo, /data-menu-id="hunts"\]'\)\?\.click\(\);/);
  assert.match(
    corpo,
    /if \(await ate\(\(\) => janelaPorTitulo\(\/CA\[ÇC\]ADAS\/i\), 5000\)\) return true;/,
  );
  // E uma janela que já está visível não leva clique nenhum: aí o clique fecharia o que se queria
  // aberto, que foi o defeito anterior deste mesmo sítio.
  assert.ok(
    corpo.indexOf('if (janelaPorTitulo(/CA[ÇC]ADAS/i)) return true;') < corpo.indexOf('.click();'),
    'a janela visível é respeitada antes de qualquer clique',
  );
  // E a ida usa esta porta, em vez de clicar por conta própria.
  const ida = codigo.slice(codigo.indexOf('const irPara = async (bruto, avisar)'));
  assert.match(ida.slice(0, 600), /if \(!\(await abrirJanela\(\)\)\)/);
  assert.doesNotMatch(ida.slice(0, 600), /data-menu-id="hunts"/);
});

test('chegar e estar na cacada CERTA, e nao numa cacada qualquer', () => {
  // Medido numa ida real em 11/10/2026, saindo de "Ilha Lendária de Entei" para "Caça de Azurill":
  // a espera era por "há alguma caçada a correr", e quem já estava caçando responde que sim antes
  // de o clique fazer efeito. A ferramenta devolveu "o jogo não me levou" — e poucos segundos
  // depois o jogador estava em Azurill. A viagem correu bem o tempo todo; o que mentiu foi a
  // conferência.
  assert.match(
    codigo,
    /clicarEEsperar\(botao, \(\) => cacadaAtiva\(\)\?\.nome === alvo\.nome, 20000\)/,
  );
  // E "estou nalguma caçada" deixou de existir: uma pergunta que nunca é a certa não fica no
  // ficheiro à espera de ser reusada.
  assert.doesNotMatch(codigo, /naCacada/);
  // Vinte segundos e não dez: entre o clique e a caçada nova há um "PREPARANDO MAPA DE CAÇA…".
  // E a falha diz onde se ficou, que é o que separa um diagnóstico de um "cliquei e nada".
  assert.match(codigo, /continuei em "\$\{cacadaAtiva\(\)\.nome\}"/);
});

test('nenhum botao de aba e guardado, porque o jogo os troca', () => {
  // Medido em 11/10/2026: depois de mudar de aba, uma leitura nova da barra mostra a aba certa com
  // `is-active`, e o nó que se tinha na mão continua sem a classe — ele foi substituído. A versão
  // anterior esperava pela classe no nó guardado, nunca a via, e por isso dava **dois cliques por
  // aba** e seguia sem conferir nada. Limpar o filtro não troca os botões; só a troca de aba troca.
  assert.match(codigo, /const abaAberta = \(janela\) => \{/);
  assert.match(codigo, /await clicarEEsperar\(aba, \(\) => abaAberta\(janela\) === nome, 4000\)/);
  assert.match(codigo, /return abaAberta\(janela\) === nome;/);
  // E quem varre guarda **nomes**, não nós.
  const bloco = codigo.slice(codigo.indexOf('const irPara'));
  assert.match(bloco, /const nomes = abasDa\(jan\(\)\)\.map\(nomeDaAba\);/);
  assert.match(bloco, /for \(const nome of nomes\) \{/);
  assert.doesNotMatch(bloco, /for \(const aba of /);
  assert.doesNotMatch(bloco, /aba\.className/);
});

test('o filtro e limpo antes de a lista ser lida', () => {
  // Medido no jogo em 11/10/2026: com "zubat" na busca e a faixa de nível em 5–9, a lista fica com
  // **zero** linhas — indistinguível de "a lista ainda não pintou". O filtro é do jogador, fica
  // guardado entre sessões, e chega sujo a quem automatiza.
  assert.match(codigo, /janela\.querySelector\('\.hunt-list-clear'\)/);
  const bloco = codigo.slice(codigo.indexOf('const irPara'));
  const limpa = bloco.indexOf('await limparFiltro(jan())');
  // Contra `const abas`, e não contra a busca da linha: há um segundo `limparFiltro` depois da
  // troca de aba, e medir contra a busca deixava o primeiro ser removido sem nada reclamar — a
  // mutação que o apagava passava por este teste.
  const abas = bloco.indexOf('const nomes = abasDa(jan())');
  assert.ok(limpa >= 0 && limpa < abas, 'limpa o filtro antes de sequer olhar para as abas');
  // E outra vez depois de trocar de aba: a troca põe a faixa de nível da aba nova (medido: 1–100
  // em Kanto, 100–2000 nas Ilhas Lendárias), e ler sem limpar lê outra coisa.
  assert.match(bloco, /if \(await abrirAba\(jan\(\), pista\)\) await limparFiltro\(jan\(\)\);/);
  // O botão ausente não pode derrubar a ida: ele é uma comodidade, não um passo obrigatório.
  assert.match(codigo, /if \(!visivel\(botao\)\) return false;/);
});

test('a regiao guardada e uma pista, e nao achando varre as abas', () => {
  // Medido na conta real: as quatro caçadas guardadas tinham `regiao` igual a "legendary",
  // "hoenn" e **dois UUID**. Só "hoenn" casa com o texto de uma aba; "legendary" não é "Ilhas
  // Lendárias" e um UUID não é nada. Sem a varredura a ferramenta ficava na aba em que a janela
  // calhasse de abrir e jurava que a caçada tinha sumido.
  const bloco = codigo.slice(codigo.indexOf('const irPara'));
  assert.match(bloco, /casa\(alvo\.regiao\)/);
  assert.match(
    bloco,
    /linha = await ate\(\(\) => jan\(\) && linhaDe\(jan\(\), alvo\.nome, alvo\.nivel\), 4000\)/,
  );
  // A aba já aberta não é visitada de novo, e a varredura para assim que acha.
  assert.match(bloco, /const varridas = \[abaAberta\(jan\(\)\)\];/);
  assert.match(bloco, /if \(varridas\.includes\(nome\)\) continue;/);
  assert.match(bloco, /if \(linha\) break;/);
  // E o erro diz onde se procurou, em vez de culpar a região guardada.
  assert.match(
    codigo,
    /não achei "\$\{alvo\.nome\}" em nenhuma aba \(\$\{varridas\.join\(', '\)\}\)/,
  );
  assert.match(codigo, /limpei o filtro e varri as abas, e a lista continuou vazia/);
});

test('espera a lista ser pintada, e a falha diz o que viu', () => {
  // A janela entra no DOM antes do conteúdo dela. É a quinta vez que esta lição aparece no pacote:
  // as abas da loja (~285 ms), a grade do inventário, os ginásios do mapa, o resumo do combate.
  assert.match(
    codigo,
    /let linha = await ate\(\(\) => jan\(\) && linhaDe\(jan\(\), alvo\.nome, alvo\.nivel\), 8000\);/,
  );
  assert.match(codigo, /querySelectorAll\('\.hunt-list-row'\)/);
  // E a falha separa os dois casos tristes, que pedem coisas diferentes de quem lê: a lista existe
  // e a caçada não está nela, ou a lista nunca apareceu.
  assert.match(codigo, /não achei "\$\{alvo\.nome\}" em nenhuma aba/);
  assert.match(codigo, /limpei o filtro e varri as abas, e a lista continuou vazia/);
});

test('o nome guardado e a chave de busca, e por isso nao se renomeia', () => {
  // Não há `data-creature-id` para caçadas: nem na que corre, nem nas linhas da lista. O único elo
  // entre as duas telas é o texto visível — um apelido editável quebraria a busca em silêncio.
  assert.match(codigo, /\.platform-hunt__zone-name/);
  assert.match(codigo, /\.platform-hunt__zone-meta/);
  assert.doesNotMatch(codigo, /renomear|apelido/);
});

test('guardar a mesma cacada atualiza, e nao duplica', () => {
  // Dois atalhos com o mesmo nome seriam indistinguíveis, e `PPX.cacadas.ir` pegaria o primeiro.
  assert.match(codigo, /const onde = todas\.findIndex\(\(c\) => eMesma\(c, cheio\)\)/);
  assert.match(codigo, /if \(onde >= 0\) todas\[onde\] = paraGuardar\(\{ \.\.\.cheio, time:/);
});

test('a barra de cima leva clique cru, e o resto clique de gente', () => {
  // Medição desta sessão: a sequência completa de ponteiro nos botões da barra de cima abria e
  // fechava o menu na mesma rajada. Onde o clique humano não funciona, o simples funciona.
  assert.match(codigo, /data-menu-id="hunts"\]'\)\?\.click\(\)/);
  assert.match(codigo, /const clicarHumano = async \(el\)/);
  const bloco = codigo.slice(codigo.indexOf('const clicarEEsperar'));
  assert.match(bloco.slice(0, bloco.indexOf('};')), /el\.click\(\);/);
});

test('a ferramenta esta no catalogo, no manifest e com atalho proprio', () => {
  const nucleo = ler('nucleo.js');
  assert.match(
    nucleo,
    /\{ id: 'cacadas', nome: 'Caçadas', atalhos: 'Alt\+W esconde · Alt\+E mostra' \}/,
  );
  // Era Alt+R até a 1.8.1: o próprio LionMultInstance usa Alt+R para restaurar a grade de views, e
  // ele escuta a tecla por fora da página. Esconder uma caçada rearranjava a janela inteira junto.
  // O guarda contra as teclas do aplicativo está em `atalho-tudo.test.mjs`.
  for (const tecla of ['KeyW', 'KeyE'])
    for (const outro of ['times.js', 'gym.js', 'layout-padrao.js'])
      assert.doesNotMatch(
        ler(outro),
        new RegExp(`code === '${tecla}'`),
        `${tecla} livre em ${outro}`,
      );
  const manifest = JSON.parse(ler('manifest.json'));
  const idle = manifest.content_scripts.find((c) => c.js.includes('gym.js'));
  assert.ok(idle.js.includes('cacadas.js'), 'cacadas.js entra junto com as outras');
});

test('a porta PPX.cacadas devolve o resultado, como a do Times', () => {
  // Quem chama precisa saber o que aconteceu, e não adivinhar lendo a tela.
  assert.match(codigo, /globalThis\.PPX\.cacadas = \{/);
  assert.match(codigo, /nomes: \(\) => guardadas\(\)\.map\(\(c\) => c\.nome\)/);
  assert.match(codigo, /erro: `não conheço nenhuma caçada chamada "\$\{nome\}"`/);
});

test('o time do atalho e montado antes de entrar na cacada', () => {
  // A caçada começa a lutar assim que entra: trocar a equipe depois seria lutar as primeiras
  // batalhas com o time errado.
  const bloco = codigo.slice(codigo.indexOf('const levar = async (alvo)'));
  const corpo = bloco.slice(0, bloco.indexOf('\n    };'));
  const monta = corpo.indexOf('await montarTime(');
  const entra = corpo.indexOf('await irPara(');
  assert.ok(monta >= 0 && monta < entra, 'monta o time antes de ir');
  // E a porta externa segue o mesmo caminho, incluindo o time.
  const porta = codigo.slice(codigo.indexOf('ir: async (nome)'));
  assert.match(porta.slice(0, 600), /await montarTime\(alvo\.time/);
});

test('o time e opcional, e regravar o atalho nao o apaga', () => {
  // A maior parte das caçadas se faz com a equipe que já está na tela: obrigar a escolher um time
  // transformaria um atalho de um clique num formulário.
  assert.match(codigo, /— sem trocar o time —/);
  // Guardar de novo é corrigir o endereço, não desfazer a configuração.
  assert.match(
    codigo,
    /todas\[onde\] = paraGuardar\(\{ \.\.\.cheio, time: todas\[onde\]\.time \|\| '' \}\)/,
  );
  // Um time que deixou de existir não pode sumir em silêncio.
  assert.match(codigo, /\(não existe mais\)/);
});

test('o relogio repinta so a marca, nunca a lista inteira', () => {
  // Reconstruir as linhas fecharia um select de time aberto na cara de quem estivesse a escolher.
  assert.match(codigo, /setInterval\(pintarMarca, 10 \* 60 \* 1000\)/);
  assert.doesNotMatch(codigo, /setInterval\(desenhar/);
  // E porque dez minutos e' muito tempo, reabrir o painel repinta a marca na hora.
  const bloco = codigo.slice(codigo.indexOf('const mostrarPainel'));
  assert.match(bloco.slice(0, bloco.indexOf('};')), /if \(sim\) pintarMarca\(\)/);
});

test('minimizado mostra a cacada atual e folheia as guardadas', () => {
  // Minimizado era so' a etiqueta. O que tapa o jogo e' a lista com os seus selects de time; a
  // caçada em curso, nao — e' justamente o que se quer saber de relance.
  assert.match(codigo, /<div class="resumo" data-resumo>/);
  assert.match(codigo, /#lioncode-cacadas \.resumo \{ display: none; \}/);
  assert.match(codigo, /#lioncode-cacadas\.minimizado \.corpo \{ display: none; \}/);
  // Largura fixa: medido na banca, pelo conteudo a etiqueta saltava de 176 para 184 pixels ao
  // passar de uma caçada para a seguinte.
  assert.match(codigo, /#lioncode-cacadas\.minimizado \{ width: 196px; \}/);
  // As setas dao a volta, em vez de parar nas pontas.
  assert.match(codigo, /todas\[\(onde \+ passo \+ todas\.length\) % todas\.length\]\.nome/);
  // Folhear e' o estado passageiro: uma troca de caçada feita a mao devolve a etiqueta ao lugar.
  assert.match(codigo, /if \(agora\?\.nome !== ultimoAtivo\) \{/);
  assert.match(codigo, /folheado = null;/);
  // E a mensagem tem de chegar ao minimizado: la' o corpo esta' escondido, e um `Ir` calado
  // parece um botao partido.
  assert.match(codigo, /const ecoar = \(\) => \{/);
  assert.match(codigo, /eco\.textContent = estado\.textContent/);
  // Chegar a uma caçada repinta o resumo — senao o "você está aqui" so' aparecia no relogio.
  const bloco = codigo.slice(codigo.indexOf('const desenhar = () => {'));
  assert.match(bloco.slice(0, 300), /pintarResumo\(\);/);
  // E as setas param durante uma ida, como todo o resto.
  assert.match(
    codigo,
    /for \(const b of painel\.querySelectorAll\('\.resumo button'\)\) b\.disabled = sim;/,
  );
});

test('a lista de cacadas rola, e o painel nao cresce sem fim', () => {
  // Com uma dezena de caçadas guardadas o painel passava do fundo da tela e o fim da lista ficava
  // fora do alcance — e rolar ali não resolve, porque quem rola é a página do jogo.
  const bloco = codigo.slice(codigo.indexOf('#lioncode-cacadas ul {'));
  const regra = bloco.slice(0, bloco.indexOf('}'));
  assert.match(regra, /max-height: 46vh; overflow: auto;/);
  // Quem rola é a lista, e não o corpo: o botão de guardar e a linha de estado ficam à vista.
  const corpo = codigo.slice(codigo.indexOf('#lioncode-cacadas .corpo {'));
  assert.doesNotMatch(corpo.slice(0, corpo.indexOf('}')), /overflow/);
});

test('a aba certa aprende-se, porque a regiao guardada quase nunca e uma pista', () => {
  // Medido na conta real em 12/10/2026: das nove caçadas guardadas, SEIS tinham por `regiao` um
  // UUID e uma tinha "legendary" — nenhuma casa com o texto de uma aba. A varredura, que era a
  // excepção, era o caminho de quase toda ida: com a janela aberta em Johto, achar a Togetic levou
  // 45 segundos, e quem olha para o painel nesse tempo diz que ele travou.
  const bloco = codigo.slice(codigo.indexOf('const irPara ='));
  assert.match(bloco, /const pista = casa\(alvo\.aba\) \|\| casa\(alvo\.regiao\);/);
  // Aprende-se ao achar, e não ao entrar: entrar pode falhar, e o endereço continua certo.
  const achou = bloco.indexOf('aprenderAba(alvo.nome, abaAberta(jan()));');
  assert.ok(achou >= 0, 'guarda a aba onde achou');
  assert.ok(achou < bloco.indexOf('clicarEEsperar(botao'), 'guarda antes de clicar em Caçar');
  // E só isso: o resto do atalho é escolha do jogador.
  const guarda = codigo.slice(codigo.indexOf('const aprenderAba ='));
  assert.match(guarda.slice(0, 500), /todas\[onde\] = \{ \.\.\.todas\[onde\], aba \};/);
  // A varredura fica, como rede: uma caçada pode mudar de aba, e o jogo não avisa.
  assert.match(bloco, /for \(const nome of nomes\) \{/);
});

test('a ida diz como acabou, mesmo chamada de fora', () => {
  // Pelo botão quem fala no fim é o `levar`. Pela porta não falava ninguém, e o painel ficava com
  // o "Entrando em …" do meio do caminho para sempre — visto no jogo, com a ida já terminada bem.
  const porta = codigo.slice(codigo.indexOf('ir: async (nome) => {'));
  const corpo = porta.slice(0, porta.indexOf('\n        },'));
  assert.match(corpo, /if \(r\.ok\) celebrar\(/);
  assert.match(corpo, /else dizer\(`Parei: \$\{r\.erro\}`, true\);/);
  assert.match(corpo, /return r;/, 'e quem chamou continua a receber o resultado');
  // E a procura não fica calada oito segundos à espera da lista.
  assert.match(
    codigo,
    /avisar\(`Procurando "\$\{alvo\.nome\}" em \$\{abaAberta\(jan\(\)\) \|\| 'a lista'\}…`\);/,
  );
});

test('a expedicao e um lugar, e nao uma cacada', () => {
  // Medida no jogo em 12/10/2026, a correr: não tem `.platform-hunt__zone-name`, não está na lista
  // da janela das caçadas e entra-se nela por um menu da barra de cima. Quem lia só a zona concluía
  // "você não está em caçada nenhuma" — e a Escada, daí em diante, tentava tirar o jogador de lá a
  // cada batida.
  assert.match(codigo, /const correndo = document\.querySelector\('\.expedition-run-hud'\);/);
  assert.match(
    codigo,
    /return \{ nome: mapa \|\| 'Expedição', regiao: '', modo: '', tipo: 'expedicao' \};/,
  );
  // Reconhecer, sim; viajar para lá, nunca — começar exige um CAPTCHA, e a janela só existe
  // enquanto dura.
  const ida = codigo.slice(codigo.indexOf('const irPara ='));
  assert.match(ida.slice(0, 600), /if \(alvo\.tipo === 'expedicao'\)/);
  assert.match(codigo, /daParaIr: \(nome\) =>/);
  // E o botão não fica a fingir que funciona.
  assert.match(codigo, /ir\.disabled = alvo\.tipo === 'expedicao' \|\| alvo\.trancado === true;/);
  // "Estou aqui" casa por TIPO, e não por nome: a expedição de amanhã pode chamar-se outra coisa.
  assert.match(codigo, /a\.tipo === 'expedicao' \? b\.tipo === 'expedicao' : a\.nome === b\.nome/);
});

test('a tela de fim da expedicao sai da frente sozinha', () => {
  // Vista no jogo em 12/10/2026: um painel com overlay que tapa a tela inteira até alguém clicar em
  // "Continuar". O próprio jogo escreve no rodapé dela "ao continuar, você volta para a sua caçada
  // anterior" — clicar não decide nada, não clicar é que deixa tudo parado atrás de um vidro.
  assert.match(codigo, /'\.expedition-result-window \.npc-shop__close',/);
  const fechos = codigo.slice(codigo.indexOf('const FECHOS = ['));
  assert.ok(
    fechos.indexOf('expedition-result-window') < fechos.indexOf(']'),
    'está na lista do que se fecha antes de agir',
  );
});

test('a janela da expedicao e fixa, e a conta e feita sobre o UTC', () => {
  // O lobby escreve "a próxima janela abre em um horário aleatório". É falso: medido em 12/10/2026,
  // a expedição acabou 08:00 de Brasília e o lobby anunciou a seguinte para as 10:00 — as duas
  // pontas da tabela do dono.
  assert.match(codigo, /const EXPEDICAO_ABRE = \[6, 10, 14, 18, 22\];/);
  // Brasília é UTC-3 o ano inteiro (o Brasil acabou com o horário de verão em 2019) e quem joga da
  // Europa muda de hora em outubro: uma tabela escrita em hora local partia-se sozinha nesse dia.
  const conta = codigo.slice(codigo.indexOf('const janelaDaExpedicao ='));
  const corpo = conta.slice(0, conta.indexOf('\n    };'));
  assert.match(corpo, /Math\.floor\(\(agora - 3 \* HORA\) \/ DIA\) \* DIA \+ 3 \* HORA/);
  assert.doesNotMatch(corpo, /getHours|getDate\(\)/, 'nada do relógio da máquina entra na conta');
  // Mas o que se MOSTRA vai no relógio de quem olha: a pergunta é "a que horas, para mim".
  assert.match(codigo, /toLocaleTimeString\(\[\], \{ hour: '2-digit', minute: '2-digit' \}\)/);
  // E a contagem anda de minuto a minuto sem redesenhar a lista: o relógio geral é de dez minutos
  // de propósito, e "abre em 1h25" parado dez minutos é um número errado na tela.
  assert.match(
    codigo,
    /setInterval\(\(\) => \{[\s\S]{0,400}legendaDaExpedicao\(\);[\s\S]{0,120}\}, 60 \* 1000\);/,
  );
});

test('a expedicao nao se guarda: ela esta sempre la', () => {
  // Guardar atalhos é para o que o jogador escolhe. A expedição é coisa do jogo, sempre a mesma, e
  // exigir que fosse guardada DE DENTRO era pior do que inútil: só se está dentro dela duas horas a
  // cada quatro, e é justamente fora dela que se quer dizê-la à Escada.
  assert.match(
    codigo,
    /const EXPEDICAO = \{ nome: 'Expedição', tipo: 'expedicao', time: '', fixa: true \};/,
  );
  const lista = codigo.slice(codigo.indexOf('const guardadas = ()'));
  assert.match(
    lista.slice(0, 400),
    /if \(!lista\.some\(\(c\) => c\.tipo === 'expedicao'\)\) lista\.push/,
  );
  // E nunca é escrita no armazém: uma entrada fixa guardada viraria uma cópia que envelhece.
  const guarda = codigo.slice(codigo.indexOf('const gravarLista ='));
  assert.match(guarda.slice(0, 200), /todas\.filter\(\(c\) => !c\.fixa\)/);
  assert.ok(
    !/gravar\(\s*CHAVE_LISTA,\s*(?!todas\.filter)/.test(
      codigo.replace(/const gravarLista[\s\S]*?;\n/, ''),
    ),
    'ninguém escreve a lista por fora do gravarLista',
  );
  // O que é do jogo não se esquece: estaria de volta na batida seguinte.
  assert.match(codigo, /apagar\.hidden = Boolean\(alvo\.fixa\) \|\| alvo\.doJogo === true;/);
  // E guardar estando lá dentro diz isso, em vez de criar uma segunda entrada.
  assert.match(codigo, /A expedição já está sempre na lista/);
});

// ---------------------------------------------------------------- o catalogo das cacadas

const ponte = ler('cacadas-main.js');
const ponteCodigo = ponte
  .split('\n')
  .filter((linha) => !/^\s*(\/\/|\*|\/\*)/.test(linha))
  .join('\n');

test('a lista das cacadas vem do jogo, e nao de ir a uma por uma', () => {
  // Medido na conta real em 12/10/2026: `Api.getZones()` devolve 377 caçadas e `Api.getWorlds()`
  // os quatro mundos. Guardar um atalho era um ato de presença — o nome só existe no DOM enquanto
  // a caçada corre —, e o jogo sabia a lista inteira o tempo todo.
  assert.match(ponteCodigo, /api\?\.getZones !== 'function'/);
  assert.match(ponteCodigo, /await api\.getWorlds\(\)/);
  assert.match(ponteCodigo, /await api\.getZones\(\)/);
  // Só caçadas: nos 377 registros `type` era sempre 'hunt', e um `type` novo não pode entrar na
  // lista como se fosse uma caçada.
  assert.match(ponteCodigo, /z\?\.type === 'hunt'/);
  // E o `label` do mundo é exatamente o texto da aba da janela — é ele que vira endereço.
  assert.match(ponteCodigo, /aba: String\(m\?\.label \|\| ''\)/);
  assert.match(ponteCodigo, /aba: mundo\.aba \|\| ''/);
  // E o nivel e' um numero so': nos 377 registros `min_level`, `max_level` e `recommended_level`
  // sao iguais, conferidos um por um. Uma faixa "155-155" seria desenhar o que o jogo nao tem.
  assert.match(ponteCodigo, /nivel: Number\(z\?\.min_level\) \|\| 0/);
  // Atravessam cinco campos, e não os dezoito que cada zona tem.
  const volta = ponteCodigo.slice(ponteCodigo.indexOf('zonas: ('));
  assert.match(volta.slice(0, 900), /nome:[\s\S]*nivel:[\s\S]*aba:[\s\S]*ordem:[\s\S]*trancado:/);
  assert.doesNotMatch(volta.slice(0, 900), /encounters|capture_rate|power_score|map_x/);
  // Do outro lado, quem pede é a ferramenta — e pede uma coisa só.
  assert.match(codigo, /const pedirZonas = \(\) => pedirPonte\(\{ acao: 'zonas' \}\)/);
});

test('a ponte das cacadas le, e nao entra em cacada nenhuma', () => {
  // `Api.prepareHunt(zoneId)` e `Nav.goToHunt(mapId)` existem e levariam direto, sem abrir janela
  // nem varrer abas. Ficam de fora: entrar é a ação que mexe no jogo do dono, e ela continua a
  // passar pelo botão "Caçar" que ele mesmo clicaria. Ler a lista não mexe em nada.
  assert.match(ponteCodigo, /const FAZ = \{ zonas \};/);
  assert.doesNotMatch(ponteCodigo, /prepareHunt|goToHunt|stopHunt|healTeam/);
  // E o motivo fica escrito onde quem for acrescentar uma ação tropeça nele.
  assert.match(ponte, /nao entra em caçada nenhuma/);
});

test('o catalogo e uma copia da verdade, e por isso tem prazo', () => {
  // O que o jogo responde hoje muda amanhã: entra uma região nova, muda um nível. Guardar sem
  // prazo seria passar a mostrar uma lista velha para sempre, sem nunca dizer que está velha.
  assert.match(codigo, /const VALIDADE = 24 \* 3600 \* 1000;/);
  assert.match(codigo, /gravar\(CHAVE_CATALOGO, \{ quando: Date\.now\(\), zonas: lido\.zonas \}\)/);
  const garantir = codigo.slice(codigo.indexOf('const garantirCatalogo ='));
  assert.match(
    garantir.slice(0, 600),
    /if \(!forcado && agora\.zonas\.length && Date\.now\(\) - agora\.quando < VALIDADE\) return;/,
  );
  // A extensão arranca antes de o jogo publicar a `Api`: a primeira tentativa costuma falhar, e
  // por isso tenta-se outra vez quando o painel reaparece — calado, porque ninguém pediu.
  assert.match(codigo, /if \(sim\) garantirCatalogo\(false\);/);
  assert.match(
    garantir.slice(0, 900),
    /if \(forcado\) dizer\('Lendo a lista de caçadas do jogo…'\)/,
  );
});

test('nome repetido desempata-se pelo nivel, porque o jogo repete nome', () => {
  // Nos 377 registros há um nome repetido: "Nidorina" existe duas vezes em Kanto, Lv 10 e Lv 37.
  // Com o nome só, ir para a de Lv 37 levava à de Lv 10 sem dizer nada.
  const bloco = codigo.slice(codigo.indexOf('const linhaDe ='));
  const corpo = bloco.slice(0, bloco.indexOf('\n    };'));
  assert.match(corpo, /const linhaDe = \(janela, nome, nivel\)/);
  // O nome exato vem do `strong` da linha, e não de um `includes` no texto todo — a linha traz
  // também o nome da espécie e as fraquezas.
  assert.match(corpo, /\.hunt-list-identity-copy strong/);
  assert.match(corpo, /nomeDa\(l\) === nome/);
  assert.match(corpo, /if \(nivel && candidatas\.length > 1\)/);
  assert.ok(corpo.includes('new RegExp(`Nv\\\\.\\\\s*${nivel}\\\\b`)'), 'desempata pelo "Nv. N"');
  // E o `includes` fica como rede: se o jogo trocar as classes, procura-se como antes.
  assert.match(corpo, /linhas\.filter\(\(l\) => \(l\.innerText \|\| ''\)\.includes\(nome\)\)/);
  // A mesma caçada é nome **e** nível; quem não sabe o nível casa com qualquer um, que é o que
  // acontece com um atalho guardado antes desta versão.
  const mesma = codigo.slice(codigo.indexOf('const eMesma ='));
  assert.match(mesma.slice(0, 300), /a\.nome === b\.nome &&/);
  assert.match(mesma.slice(0, 300), /\(!a\.nivel \|\| !b\.nivel \|\| a\.nivel === b\.nivel\)/);
});

test('o que a extensao descobriu sozinha nao se escreve como escolha do dono', () => {
  // A mesma regra do `config.js`: catálogo, estoque e contagem são o retrato do jogo. `trancado` e
  // `doJogo` derivam da lista e relêem-se; guardá-los criaria uma segunda verdade.
  const guardar = codigo.slice(codigo.indexOf('const paraGuardar ='));
  const corpo = guardar.slice(0, guardar.indexOf('});'));
  assert.match(
    corpo,
    /nome:[\s\S]*nivel:[\s\S]*aba:[\s\S]*regiao:[\s\S]*modo:[\s\S]*tipo:[\s\S]*time:/,
  );
  assert.doesNotMatch(corpo, /trancado|doJogo|ordem/);
  // E tudo o que vai para o armazém passa por aqui.
  assert.match(codigo, /todasMinhas\.push\(paraGuardar\(\{ \.\.\.alvo, time: times\.value \}\)\)/);
  assert.match(codigo, /else todas\.push\(paraGuardar\(cheio\)\);/);
});

test('a lista inteira nao se desenha de uma vez, e o que falta diz-se', () => {
  // 377 caçadas, cada linha com um `select` de times: desenhar tudo seria quase quatrocentos
  // selects reconstruídos a cada repintura para mostrar os vinte que caberiam na tela.
  assert.match(codigo, /const TETO = 40;/);
  assert.match(codigo, /for \(const alvo of todas\.slice\(0, TETO\)\)/);
  // O teto não esconde nada: diz quantas ficaram de fora, e o filtro alcança qualquer uma.
  assert.match(codigo, /if \(todas\.length > TETO\)/);
  assert.match(codigo, /…e mais \$\{todas\.length - TETO\}\. Escreva mais no filtro\./);
  // O filtro casa com o nome, com a região ou com o nível, e sem acentos: quem escreve
  // "lendarias" quer achar "Ilhas Lendárias".
  assert.match(codigo, /\.normalize\('NFD'\)/);
  const filtra = codigo.slice(codigo.indexOf('const aMostrar ='));
  assert.match(filtra.slice(0, 700), /chao\(c\.nome\)\.includes\(busca\)/);
  assert.match(filtra.slice(0, 700), /chao\(c\.aba \|\| c\.regiao\)\.includes\(busca\)/);
  assert.match(filtra.slice(0, 700), /String\(c\.nivel\)\.startsWith\(busca\)/);
});

test('escolher um time guarda a cacada que veio da lista do jogo', () => {
  // Dizer "aqui eu monto o time X" é precisamente o que distingue uma caçada que o dono usa de uma
  // que está no mapa. Guardar é consequência da escolha, não um segundo passo que ele tem de
  // descobrir — e era esse segundo passo que custava uma viagem por caçada.
  const bloco = codigo.slice(codigo.indexOf("times.addEventListener('change'"));
  const corpo = bloco.slice(0, bloco.indexOf('item.append(times)'));
  assert.match(corpo, /const onde = todasMinhas\.findIndex\(\(c\) => eMesma\(c, alvo\)\)/);
  assert.match(corpo, /else todasMinhas\.push\(paraGuardar/);
  assert.match(corpo, /if \(onde < 0\) desenhar\(\)/);
});

test('o UUID do mundo nao vai para a etiqueta', () => {
  // `.platform-hunt__zone-meta` mostra o `id` do mundo, e seis dos nove atalhos da conta real
  // tinham isso guardado como "região". Hoje sabe-se o que ele é — é a chave do mundo —, e meia
  // linha de UUID na etiqueta nunca disse nada a ninguém.
  assert.match(codigo, /const UUID = \/\^\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\/i;/);
  const bloco = codigo.slice(codigo.indexOf('const legenda ='));
  assert.match(
    bloco.slice(0, 600),
    /alvo\.aba \|\| \(UUID\.test\(alvo\.regiao \|\| ''\) \? '' : alvo\.regiao\)/,
  );
  // E o nível entra na etiqueta, que é a pergunta que não tinha resposta nenhuma no painel.
  assert.match(bloco.slice(0, 600), /alvo\.nivel \? `Lv \$\{alvo\.nivel\}` : ''/);
});

test('a aba do catalogo e endereco, e a aprendida continua a valer mais', () => {
  // O `label` do mundo é o texto da aba. Mas a aba aprendida numa ida real foi medida naquela
  // conta, e por isso não se sobrescreve: `c.aba || z.aba`, nessa ordem.
  const bloco = codigo.slice(codigo.indexOf('const completar ='));
  const corpo = bloco.slice(0, bloco.indexOf('\n    };'));
  assert.match(corpo, /aba: c\.aba \|\| z\.aba/);
  assert.match(corpo, /nivel: c\.nivel \|\| z\.nivel/);
  // Nome repetido só se resolve se o próprio atalho disser de qual nível é.
  assert.match(corpo, /iguais\.length === 1/);
  // E a ida completa o que recebe, para ser igual venha ela do botão ou da porta.
  assert.match(codigo, /const alvo = completar\(bruto\);/);
});

test('a porta tem duas listas, e nao uma: os atalhos dele e o jogo inteiro', () => {
  // `nomes()` sao os atalhos do dono — curta, na ordem dele —, e serve a quem quer oferecer "as
  // suas cacadas". `todas()` sao as 377, e so' serve a quem tem como filtrar: despejar 377 opcoes
  // num `select` nao e' uma escolha, e' uma busca sem campo de busca. Juntar as duas numa teria
  // enchido os selects da Escada de quatrocentas linhas sem ninguem pedir.
  assert.match(codigo, /nomes: \(\) => guardadas\(\)\.map\(\(c\) => c\.nome\)/);
  const todas = codigo.slice(codigo.indexOf('todas: () =>'));
  const corpo = todas.slice(0, todas.indexOf('})),') + 4);
  assert.match(corpo, /todasConhecidas\(\)\.map/);
  // Cada uma diz o nivel e a regiao, porque e' por ai' que se escolhe onde upar, e diz se da' para
  // abrir: regiao trancada e expedicao nao dao.
  assert.match(corpo, /nivel: c\.nivel \|\| 0/);
  assert.match(corpo, /trancada: c\.trancado === true/);
  assert.match(corpo, /minha: c\.doJogo !== true/);
  // E o UUID tambem nao sai por aqui: ver `UUID`.
  assert.match(corpo, /UUID\.test\(c\.regiao \|\| ''\)/);
});

test('a primeira leitura falha, e a lista insiste sozinha', () => {
  // Medido no jogo do dono em 12/10/2026, com a extensao recarregada e a pagina em F5: a ponte
  // respondia as 377 cacadas quando perguntada a mao, e o catalogo estava vazio. A extensao corre
  // em `document_idle`, que e antes de o jogo publicar a `Api`.
  //
  // A unica retentativa era "quando o painel reaparece" — e um painel que nunca se esconde nunca
  // reaparece. Ficava um nada, com um botao a espera de alguem adivinhar que tinha de o clicar.
  assert.match(codigo, /const INSISTE = \[4000, 12000, 40000\];/);
  const insiste = codigo.slice(codigo.indexOf('const insistir ='));
  const corpo = insiste.slice(0, insiste.indexOf('\n    };'));
  // Contado, e nao um laco sem fim: a tela do jogo demora, mas nao demora para sempre.
  assert.match(corpo, /if \(espera === undefined\) return;/);
  assert.match(corpo, /insistencias \+= 1;/);
  assert.match(corpo, /setTimeout\(\(\) => garantirCatalogo\(false\), espera\)/);
  // So a tentativa automatica insiste: pelo recarregar a mao, quem decide tentar de novo e o dono.
  assert.match(codigo, /else insistir\(\);/);
  // E o sucesso zera a conta, para o proximo arranque ter as tres tentativas outra vez.
  assert.match(codigo, /insistencias = 0;/);
});
