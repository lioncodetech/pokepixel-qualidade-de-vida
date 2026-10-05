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
  assert.match(codigo, /if \(onde >= 0\) todas\[onde\] = agora;/);
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
  assert.match(nucleo, /\{ id: 'cacadas', nome: 'Caçadas', atalhos: 'Alt\+R esconde · Alt\+E mostra' \}/);
  // O atalho não pode colidir com os que já existem.
  for (const tecla of ['KeyR', 'KeyE'])
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
