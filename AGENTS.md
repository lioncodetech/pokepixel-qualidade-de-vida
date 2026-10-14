# Regras deste repositório

## Toda automação passa pela fila

**Qualquer ferramenta que aja sozinha no jogo tem de pedir a vez antes de agir.** Não é só para as
três que já estão na fila (venda rápida, loja rápida, ginásio do dia): vale para toda automação
daqui para a frente. É regra permanente, pedida em 06/10/2026.

### Por quê

Até a 1.6.2 cada ferramenta se protegia **de si mesma** e só — `emVenda`, `emCompra`, `correndo`,
cada uma numa variável do seu próprio arquivo — e nenhuma sabia que as outras existiam. Com três
relógios automáticos no ar, o cruzamento não era hipótese: era questão de tempo. E o pior é calado:
o ginásio dá **dois F5** por corrida, e uma venda a meio caminho morre na recarga sem dizer nada.

Uma ferramenta nova que não entre na fila reabre exatamente esse buraco — e reabre em silêncio,
que é o que o torna caro.

### Como

```js
const MINHA_VEZ = 'id-do-modulo';

const esperarAVez = async (dizer) => {
  const vez = globalThis.PPX?.vez;
  if (!vez?.pedir) return () => {}; // núcleo antigo: segue como antes, sem fila
  const dono = vez.dono();
  if (dono && dono.id !== MINHA_VEZ) dizer(`Esperando o ${vez.nome(dono.id)} terminar…`);
  return vez.pedir(MINHA_VEZ);
};

let soltar = null;
try {
  soltar = await esperarAVez(mostrar);
  if (!soltar) return mostrar('Desisti: o jogo ficou ocupado tempo demais.', true);
  // agir no jogo
} finally {
  if (soltar) soltar();
}
```

### As quatro armadilhas

1. **Quem vai recarregar a página não solta a vez antes do F5.** É o caso do ginásio, que recarrega
   de propósito duas vezes por corrida. Soltar ali abre a fresta que a fila existe para fechar: a
   venda entrando entre a recarga e a retomada. A vez mora na `sessionStorage` justamente para
   atravessar — e o `pagehide` do núcleo só limpa quando não há tarefa do ginásio a atravessar.
2. **Quem é chamado por dentro de outra ferramenta não pede a vez.** `PPX.times.usar` e
   `PPX.cacadas.ir` são peças, não automações: quem as chama já tem a vez, e pedir de novo daria
   impasse com o próprio chamador.
3. **Um núcleo sem `PPX.vez` não pode quebrar a ferramenta.** Cada arquivo é avaliado por conta
   própria, de propósito, e alguém pode ficar com uma mistura de versões. Sem fila, segue como
   seguia antes.
4. **Painel que espera calado parece painel travado.** Diga por quem se espera, com o nome de
   mostrar (`vez.nome(id)`), nunca com o identificador interno.

A fila está em `nucleo.js`, no bloco "a vez". O que ela promete está medido em
`testes/banca-vez.html`, que atravessa um F5 de verdade — e que acusa a falha quando a proteção da
travessia é removida. Os guardas de código estão em `testes/vez.test.mjs`.

## Toda agenda passa pelo calendário

`agenda.js` é o calendário partilhado: `PPX.agenda`. Ferramenta nenhuma volta a ter a leitura de
horários ou a conta da janela em casa — eram três cópias idênticas, e foi por isso que acrescentar
"toda semana" e "todo mês" virou um trabalho só em vez de três.

As funções são puras: entra configuração e um instante, sai quanto falta. Mantenha assim — é o que
torna virada de mês, ano bissexto e horário de verão exercitáveis em `testes/agenda.test.mjs`.

A tela também é uma só: `PPX.agenda.montarControles()` devolve o editor — listas atrás de um botão
que mostra a agenda combinada, fechado por padrão. Nenhum painel desenha os próprios controles de
dia. O valor continua sendo **texto**, num `input` escondido dentro do editor: é por isso que as
listas puderam ser acrescentadas sem tocar no calendário nem nos testes dele.

Duas regras que já custaram caro:

- **o que não se entendeu não vira "todo dia".** Sem nenhuma regra válida todo dia conta, então um
  engano de escrita transformaria uma automação mensal numa diária. Texto com lixo não agenda nada,
  e o campo fica marcado;
- **ocorrência perdida fica perdida.** Nada de disparar o atrasado ao ligar o computador.

## Exportar e importar passa pelo `config.js`

`PPX.config.montarBotoes({ id, nome, coletar, aplicar, avisar })` dá os dois botões a qualquer
ferramenta. O `config.js` não sabe o que é um teto nem uma raridade: ele empacota, entrega o
arquivo, recusa o que não presta e devolve os dados. Quem decide o que entra e o que sai é a
ferramenta — e é por isso que acrescentar isto numa ferramenta nova não mexe no `config.js`.

Três regras, e cada uma já tem o seu teste em `testes/config.test.mjs`:

1. **O que a extensão descobriu sozinha não viaja.** Catálogo, estoque, saldo, contagem de lista:
   são o retrato do jogo daquela conta. Levar o retrato de uma conta para outra é mostrar números
   que não são dela.
2. **Carimbo de relógio não é configuração.** Importar o `ultima` de outra conta faz a janela de
   hoje passar por já usada, e a rodada de hoje não acontece — calada.
3. **O que chega é lido como se viesse de fora, porque vem.** Quem aplica é a ferramenta, campo a
   campo, com limite e tipo. Nunca escreva no armazenamento a chave que vier no arquivo.

## Um cache lido uma vez mente, e mente duas vezes

A coleção dos Pokémon da conta vem da API, custa uma chamada e por isso guarda-se. Em **14/10/2026**
isso produziu dois defeitos seguidos, na piscina da Escada, e os dois com a mesma raiz:

1. **O cache não viu o que a tela viu.** O aluno subiu ao nível pedido no HUD e o cache continuou a
   jurá-lo no nível antigo: aluno para sempre, e os outros à espera de uma vez que nunca chegava.
2. **O cache sobreviveu ao que o explicava.** Formado, o aluno saiu da equipe e deixou de aparecer no
   HUD — e aí o cache velho voltou a mandar. Ele era escolhido outra vez, a equipe remontava-se para
   o ir buscar, ele saía de novo: um laço que montava equipes para sempre sem ninguém subir um nível.

A regra que sobra: **onde o jogo mostra o número ao vivo, é o vivo que manda** — e o cache relê-se no
instante em que o vivo discordar dele, que é o único instante em que a releitura paga o que custa.
Um cache que só se relê "quando está vazio" está a apostar que nada muda, e aqui tudo muda.

## Meça antes de embarcar dados do jogo

Em **14/10/2026** ia embarcar uma tabela de tipos de mil espécies para a Escada poder escolher a
caçada. Fui medir primeiro, e **estava tudo na API do jogo** — caçadas com tipos e nível, golpes com
elemento e poder, e a progressão de cada espécie. O que sobrou para copiar foram 18 linhas de tabela
de eficácia, e mesmo essas foram conferidas casa a casa contra o código do jogo (324 de 324).

A regra: antes de trazer para cá uma cópia de dados que são do jogo, procure-os no jogo. Uma cópia é
uma segunda verdade — e esta extensão corre sobre um fan game, que pode divergir da tabela canónica
sem avisar ninguém.

## O resto

- Reproduza antes de consertar. Uma banca construída sobre a suposição só confirma a suposição.
- Teste e documentação na mesma tarefa, nunca depois.
- Nunca commitar, taguear ou publicar sem pedido explícito.
