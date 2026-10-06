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
  assert.match(codigo, /const visivel = \(el\) => Boolean\(el\) && el\.getBoundingClientRect\(\)\.width > 0/);
});

test('a regiao e escolhida antes de procurar a linha', () => {
  // A janela reabre na última região usada. Procurar "Caça de Ralts" numa aba de Kanto não acha
  // nada, e a ferramenta diria que a caçada sumiu.
  const bloco = codigo.slice(codigo.indexOf('const irPara'));
  const regiao = bloco.indexOf('hunt-list-world-tab');
  const linha = bloco.indexOf('hunt-list-row');
  assert.ok(regiao >= 0 && regiao < linha, 'escolhe a região antes de procurar a linha');
});

test('espera a lista ser pintada, e a falha diz o que viu', () => {
  // A janela entra no DOM antes do conteúdo dela. É a quinta vez que esta lição aparece no pacote:
  // as abas da loja (~285 ms), a grade do inventário, os ginásios do mapa, o resumo do combate.
  const bloco = codigo.slice(codigo.indexOf('const linha = await ate('));
  assert.match(bloco.slice(0, 400), /hunt-list-row/);
  assert.match(codigo, /a janela abriu mas a lista não chegou a aparecer/);
  assert.match(codigo, /não achei "\$\{alvo\.nome\}" entre as \$\{vistas\}/);
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
  assert.match(codigo, /const onde = todas\.findIndex\(\(c\) => c\.nome === agora\.nome\)/);
  assert.match(codigo, /if \(onde >= 0\) todas\[onde\] = \{ \.\.\.agora, time:/);
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
  assert.match(nucleo, /\{ id: 'cacadas', nome: 'Caçadas', atalhos: 'Alt\+W esconde · Alt\+E mostra' \}/);
  // Era Alt+R até a 1.8.1: o próprio LionMultInstance usa Alt+R para restaurar a grade de views, e
  // ele escuta a tecla por fora da página. Esconder uma caçada rearranjava a janela inteira junto.
  // O guarda contra as teclas do aplicativo está em `atalho-tudo.test.mjs`.
  for (const tecla of ['KeyW', 'KeyE'])
    for (const outro of ['times.js', 'gym.js', 'layout-padrao.js'])
      assert.doesNotMatch(ler(outro), new RegExp(`code === '${tecla}'`), `${tecla} livre em ${outro}`);
  const manifest = JSON.parse(ler('manifest.json'));
  const idle = manifest.content_scripts.find((c) => c.js.includes('gym.js'));
  assert.ok(idle.js.includes('cacadas.js'), 'cacadas.js entra junto com as outras');
});

test('a porta PPX.cacadas devolve o resultado, como a do Times', () => {
  // Quem chama precisa saber o que aconteceu, e não adivinhar lendo a tela.
  assert.match(codigo, /globalThis\.PPX\.cacadas = \{/);
  assert.match(codigo, /nomes: \(\) => guardadas\(\)\.map\(\(c\) => c\.nome\)/);
  assert.match(codigo, /erro: `não há atalho guardado para "\$\{nome\}"`/);
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
  assert.match(codigo, /todas\[onde\] = \{ \.\.\.agora, time: todas\[onde\]\.time \|\| '' \}/);
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
  assert.match(codigo, /for \(const b of painel\.querySelectorAll\('\.resumo button'\)\) b\.disabled = sim;/);
});
