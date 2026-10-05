# PokePixel — qualidade de vida

As sete ferramentas de qualidade de vida do PokePixel num pacote só, com um menu para ligar e desligar cada uma na
janela em que você está.

**Alt+Q** abre e fecha o menu. Fechado, fica só o botão `PokePixel` no canto.

| ferramenta | o que faz | atalhos |
| --- | --- | --- |
| Ocultar popups | esconde os popups que aparecem ao passar o mouse | Alt+B esconde · Alt+N mostra |
| Sem gráfico | desliga o desenho do mapa; o jogo continua rodando | Alt+G desliga · Alt+H liga |
| Senha | guarda usuário e senha e os cola no login | botões na tela de login |
| Loja rápida | compra pokébolas, poções e revives sem abrir a loja | Alt+C esconde · Alt+V mostra |
| Venda rápida | vende pokémon pelas raridades que você marcar | Alt+D esconde · Alt+F mostra |
| Layout padrão | põe as janelas do jogo no lugar que você escolheu | Alt+J esconde · Alt+K mostra · Alt+L arruma |
| Times | guarda composições de equipe e troca para uma delas num clique | Alt+T esconde · Alt+Y mostra |

As cinco primeiras são as mesmas de sempre, com as mesmas telas e as mesmas configurações — inclusive
as que você já tinha. As escolhas continuam guardadas nas mesmas chaves, então raridades, teto de nível, lote,
quantidades da loja, posições dos painéis, usuário e senha atravessam a troca sem se perder.

## Os dois comandos de cada linha

Cada ferramenta tem **dois** comandos no menu, e eles não são a mesma coisa:

- **O botão do meio** mostra e esconde a janela daquela ferramenta (`à vista` / `oculta`). Nas duas
  que não têm janela — ocultar popups e sem gráfico — ele liga e desliga o efeito delas
  (`ligado` / `desligado`), que é tudo o que elas fazem.
- **A chave verde** ativa ou desativa a ferramenta inteira nesta janela. Desativada, ela nem carrega.

O que você escolher no botão do meio **atravessa o F5**: a janela que você mandou sumir continua
sumida na próxima carga, e os atalhos de cada ferramenta (Alt+C, Alt+D…) gravam do mesmo jeito.

O **×** do canto de cada janela é o mesmo comando: ele esconde a ferramenta de verdade, fica
gravado, e o menu passa a mostrá-la como `oculta`. Antes ele só apagava o painel da tela — na carga
seguinte a janela voltava sozinha, e enquanto isso o menu continuava dizendo que ela estava à
vista.

Quando uma ferramenta ainda não se anunciou — porque está desativada, ou porque não carregou — o
botão do meio mostra `—` e fica apagado, em vez de prometer uma ação que não aconteceria.

## Mover o menu

Arraste pelo **⠿**. Minimizado, o botão `PokePixel` também se arrasta: puxe direto por ele. Andou
mais que alguns pixels, é arrasto e o menu não abre; foi um toque parado, o menu abre. Os dois
dividem o mesmo canto, então mover um leva o outro.

### Rearranjar as views não espalha as janelinhas

O que fica guardado não é "a 1764 pixels da esquerda": é **a distância até a borda mais próxima** —
16px da direita, 120px de baixo. Toda janelinha do pacote (o menu, o botão `Arrumar`, a venda e a
loja) é recolocada por essa medida sempre que a janela muda de tamanho.

Isso resolve duas coisas de uma vez. Num quadrante pequeno nada mais desaparece para fora da tela,
nem fica preso num `430px` do topo que simplesmente não existe numa janela de 290px de altura. E
voltar à tela inteira devolve cada janelinha **exatamente** ao lugar de onde ela saiu — recortar
pela borda, como era antes, é definitivo: encolhia uma vez e a posição original estava perdida.

Quem estava escondido não tem medidas para recolocar; por isso a conta é refeita no instante em que
a janelinha reaparece, e não enquanto ela está invisível.

## Ativar e desativar

A chave verde vale **para esta janela**, como antes valia escolher quais extensões carregar nela.

- **Ligar** acontece na hora.
- **Desligar** vale a partir da próxima carga da página, e o menu oferece um `recarregar agora`.
  Não é preguiça: as ferramentas montam interface, prendem atalhos e deixam relógios rodando.
  Desfazer tudo isso na ordem certa seria uma segunda implementação de cada uma — e é exatamente
  aí que nasceriam os bugs. Recarregar faz isso de graça e sem engano.

Quem nunca mexeu no menu fica com as sete ligadas.

## A caixa de confirmação

Quando você deixa marcado "Confirmar sozinho", a extensão clica em **Vender** na caixa que o jogo
abre. Até a venda rápida 1.2.2 ela não clicava: procurava a caixa no lugar errado — este código foi
escrito sem nunca ter visto uma de perto —, não a reconhecia e ficava esperando uma lista que
nunca encolhia. Agora é a caixa de verdade: "Confirmar venda", com os botões Vender e Cancelar.

## Épica, lendária e mítica não se vendem

As três raridades do topo aparecem na lista da venda rápida sempre desmarcadas e **sem poder ser
marcadas**. Sumir com as linhas faria parecer que o jogo deixou de ter essas raridades, em vez de a
extensão ter deixado de vendê-las.

A trava não é a caixa desmarcada: ela está na leitura da escolha. Uma marcação guardada por uma
versão anterior, ou escrita na chave por fora, é descartada antes de chegar ao filtro da loja — e o
filtro do jogo é explicitamente **desligado** nessas três a cada venda. É o único jeito de a trava
não depender de a tela estar certa.

## Vender itens

A venda rápida tem um **"Vender itens também"**, desmarcado de fábrica. Ligado, depois de vender os
pokémon ela troca para a aba "Vender itens" e usa o **"Selecionar todos" do próprio jogo** — quem
decide o que é vendável é ele, que já deixa de fora o que está vinculado à loja. Fazer a nossa
própria lista seria inventar uma segunda regra, que discordaria da dele no dia em que ele mudar.

Entre a venda dos pokémon e a dos itens há uma pausa de **4 a 12 segundos, sorteada a cada vez**.
São duas vendas seguidas na mesma loja, e emendar uma na outra em meio segundo não se parece com
ninguém clicando — além de não dar tempo de a tela da primeira assentar. O contador aparece no
painel (`itens em 7s...`) e o **Parar** vale durante a espera, não só depois dela.

Fica desmarcado por padrão porque "todos" é mesmo todos: na conta onde isto foi medido, eram **110
tipos por 3,4 milhões** num clique. Ligar isso é uma decisão, não um padrão que se herda sem querer.

## Layout padrão

Um botão **Arrumar tudo** (ou **Alt+L**) e a tela inteira volta para o lugar: as janelas do jogo —
Caçadas, Inventário, Loja do Mark, o que estiver aberto — mais os HUDs de equipe, chat, ações
rápidas e a barra de ferramentas.

O caminho é o mesmo que você faria à mão: arrume tudo como quiser uma vez, clique em **Salvar
layout atual**, e daí em diante é um botão. O que está salvo aparece no painel: quantas peças, de
que dia, e de que tamanho de tela.

Como funciona por dentro: o jogo posiciona cada janela escrevendo `inset`, `width` e `height` no
próprio elemento, e aceita que outro código escreva por cima — a janela vai para lá e fica, inclusive
quando é fechada e reaberta, porque o jogo reaproveita o mesmo elemento. Nada é pedido ao servidor e
nada é feito com cliques simulados.

### Minimizado, só o botão

O **–** do cabeçalho encolhe o painel até sobrar o que se usa o tempo todo: um botão **Arrumar**,
com um **⤢** ao lado para abrir o painel de volta. A bolha e o painel dividem o mesmo canto —
arrastar um leva o outro —, e arrastar a bolha não dispara o botão: andou menos de 4px é clique,
mais que isso é arrasto.

Minimizado não é escondido. Quem some com a ferramenta é a chave no menu do PokePixel (ou **Alt+J**),
e aí a bolha vai junto; **Alt+K** traz de volta. São **Alt+J** e **Alt+K**, e não o par vizinho das
outras ferramentas, porque **Alt+Z** e **Alt+X** são do caderno de anotações, que roda em qualquer
site: com as duas extensões na mesma janela, uma tecla comandava as duas. Com o painel fora de vista o resultado de cada
arrumada aparece no título da bolha, para onde o mouse já está indo.

### Arrumar ao abrir cada janela

Marcado de fábrica. É o que torna o layout *padrão* de verdade: a janela já nasce no lugar, sem
ninguém clicar em nada. Arrastar uma janela à mão continua valendo — o que já foi arrumado com o
layout atual nesta tela não é mexido de novo, senão o seu arrasto seria desfeito meio segundo depois.

### A mesma tela em janelas de tamanhos diferentes

Cada janela do LionMultInstance é uma tela de tamanho diferente, e um layout em pixels tirado da tela
inteira não cabe num quadrante. Por isso o que fica guardado é o layout **junto com a tela em que foi
tirado**, e ao aplicar tudo é reescalado na mesma proporção, preso ao que cabe. Quem preferir os
pixels crus desmarca **Ajustar ao tamanho desta janela**.

Para levar o layout de uma janela do LMI para outra, abra **Levar para outra janela**: o texto do
layout está ali, pronto para copiar e colar do outro lado. Não há sincronização automática, e isso
não é esquecimento: cada janela do LMI é um perfil com armazenamento próprio, então uma extensão não
alcança as outras. Copiar e colar é o único caminho que não promete o que não existe.

### A aparência do jogo

**Incluir a aparência do jogo** vem desmarcado. Ligado, entram no layout as preferências do próprio
jogo — escala, tamanho de texto, opacidade das janelas, tema, posição da barra — e as posições
iniciais que ele guarda. Elas são lidas por ele na carga da página, então valem a partir do próximo
F5; o painel oferece um `recarregar agora`.

### Janela fechada não é arrumada

Janela fechada continua no DOM, invisível, medindo zero. Arrumar uma dessas seria guardar um tamanho
nulo e mandá-la para um canto qualquer da próxima vez que ela abrisse — então só o que está na tela
entra no layout e só o que está na tela é movido. É a mesma lição do `✕` da janela já fechada, logo
abaixo.

## Esperar o que o jogo ainda não desenhou

Três correções da 1.1.1 são a mesma lição, medida no jogo:

- A janela da loja entra no DOM em ~25 ms, mas as abas só em ~310 ms. Procurar a aba uma vez, assim
  que a janela existe, não achava nada — e a compra parava com "a loja nao esta na aba de comprar
  itens", com a loja aberta na frente.
- Marcar a lista inteira de itens não termina num tempo fixo. O sinal de que acabou é o botão do
  jogo virar "Vender N tipo(s) por X" — é ele que a extensão espera, não um relógio.
- A mochila reabre na última categoria usada, e cada categoria esconde o resto. Lida em
  "Pokébolas", ela parece não ter poção nenhuma. Agora a extensão põe a aba **Todos** antes de ler,
  e não lê se não conseguir.

## Times: por que o UUID, e não o nome

Cada Pokémon tem um `data-creature-id` que aparece igual no inventário e no HUD da equipe. É ele que
o time guardado usa — e não o nome.

O motivo é concreto: na conta onde isto foi levantado havia **dois Tyranitar**, um Nv.203 no time e
um Nv.151 na mochila. Guardar por nome teria trocado um pelo outro na primeira aplicação, e o time
"certo" voltaria com o Pokémon errado dentro.

### As três regras do jogo que mandam na ordem das operações

Medidas no jogo, não supostas:

- **O Pokémon ativo não pode ser removido.** O botão vem desabilitado dizendo "Escolha outro Pokémon
  para poder remover este". Por isso a liderança passa para alguém que fica **antes** de qualquer
  remoção.
- **A equipe trava em 6.** Logo remover vem antes de colocar; ao contrário, a primeira adição
  falharia calada.
- **Espécie não se repete.** Se o jogo recusar uma adição, a ferramenta diz qual Pokémon não entrou
  em vez de seguir como se tivesse entrado.

### A troca completa, seis por seis

É o caso que parece simples e não é. O jogo não deixa remover o Pokémon ativo, e a equipe trava em
seis. Com os seis saindo e seis entrando:

1. ninguém do time novo está na equipe ainda, então não há para quem passar a liderança;
2. saem os cinco que não são o ativo, e a equipe fica com um só;
3. entram cinco dos novos — a equipe volta a seis e **o sexto não cabe**;
4. agora há alguém do time novo lá dentro: ele assume a liderança;
5. o ativo antigo finalmente pode sair, e o sexto entra.

Era o passo 4 que faltava quando a troca parava com "o último não entra".

Essa decisão mora numa função pura, `planoDeTroca`, separada do resto justamente para poder ser
conferida fora do navegador:

```
node --test testes/*.test.mjs   # a decisão da troca
npx eslint .                    # variável sem definição, e afins
```

A segunda linha existe por um motivo concreto. `node --check` só olha a sintaxe: um `liderAgora()`
que ficou sem definição depois de uma reescrita passa por ele sem queixa e só aparece quando alguém
clica no botão — aconteceu, em cima de uma equipe de verdade. `no-undef` pega isso antes. Os testes checam que o plano termina
com a equipe certa e, mais importante, que **cada passo é legal no instante em que acontece** — uma
varredura de 200 combinações sorteadas confirma que nenhum plano remove o ativo nem passa de seis.

### O plano é refeito a cada passo

A ferramenta calcula o plano, executa só o **primeiro** passo, e recalcula. Seguir um plano inteiro
de ponta a ponta seria mais curto, mas qualquer diferença entre o que a ferramenta imagina e o que
o jogo fez se acumularia até o fim da fila. Recalculando contra o HUD a cada passo, um passo que não
saiu como esperado é simplesmente refeito com o estado real.

### Equipar e desequipar são ações escritas, não um duplo clique

O botão direito sobre o Pokémon abre um cartão com a ação por extenso: **Equipar** em quem está
fora, **Desequipar** em quem está dentro. É esse cartão que a ferramenta usa.

A primeira versão usava duplo clique, e ele tinha dois defeitos no mesmo lugar:

- **No Ditto faz outra coisa.** Abre o menu de transformação em vez de equipar. A conta usada no
  levantamento não tinha Ditto, então esse caminho nunca apareceu — foi preciso o usuário relatar.
- **Ele alterna.** Não existe "põe" nem "tira": existe "inverte".

Pedir "equipar" não pode tirar ninguém. A ambiguidade não foi contornada com cuidado: ela deixou de
existir. Se a ação esperada não estiver no cartão, nada acontece e o erro **diz quais ações havia
ali** — é assim que um caso especial novo se anuncia em vez de virar um "não funcionou".

Um detalhe que custou atenção: o cartão traz `data-element`, **nunca o `data-creature-id`**. Com
dois cartões abertos não há como saber em qual se clica, e numa conta com dois Tyranitar o erro
seria invisível. Por isso todos são fechados antes, e confere-se que ficou exatamente um.

### Quem manda é o HUD, não o inventário

Mesmo com a ação explícita, continua valendo: uma leitura errada do estado é cara.

Foi o que aconteceu numa prova real — um Pokémon que estava na equipe foi lido como fora, e o
"colocar" tirou ele. A causa é conhecida deste repositório: a mochila pinta em etapas e reabre na
última categoria usada, exatamente a lição que a loja rápida já tinha aprendido.

Agora quem responde "quem está na equipe" é o HUD, que está sempre no DOM, não tem abas e não
filtra. O inventário continua sendo onde se clica — só deixou de ser onde se decide. E, no instante
de cada clique, o estado é conferido de novo: se já está como se quer, não se toca.

### Os tempos, e por que esperar não é opcional

Tirar do time levou ~1.440 ms e colocar ~950 ms: as duas operações vão ao servidor. Abrir o painel
de equipe levou ~1.080 ms. Já mover uma posição na ordem leva menos de 10 ms, porque é local — mas
persiste, confirmado com F5.

Cada passo espera o jogo confirmar antes do seguinte. Isso não é cautela decorativa: durante o
levantamento, uma sequência rápida de cliques derrubou a página inteira com
`Cannot read properties of null`. Nenhum passo da ferramenta é disparado às cegas.

### A ordem do HUD não é a ordem de batalha

São duas listas diferentes. Mover no painel de equipe não mexe no HUD, e recolocar um Pokémon o
devolve ao fim da lista do HUD — mas isso é desenho local, some no F5. A ordem que vale é a do
painel, e é ela que o time guarda e restaura, com os botões `←` e `→`.

### A troca inteira leva de 20 a 30 segundos

O prazo é sorteado a cada uso, e o espaçamento entre os passos sai dele: a cada passo divide-se o
tempo que resta pelos passos que faltam, com um desvio sorteado para a cadência não sair de
metrônomo. Duas trocas iguais nunca duram o mesmo.

São duas razões na mesma medida. Uma rajada de cliques em milissegundos não se parece com ninguém
jogando. E foi exatamente uma sequência sem respiro que derrubou a página numa prova real.

Como o espaçamento é calculado e não cravado, ele se adapta: o jogo leva perto de 1,2 s por troca,
e se ele estiver lento as pausas encolhem sozinhas em vez de a operação estourar o prazo.

Durante a troca o painel mostra a contagem e uma barra — *"faltam ~18 s"*. O número sai do mesmo
orçamento que espaça os passos, e não de um prazo inventado para a tela.

Mas é uma **previsão, não uma promessa**: o orçamento manda nas pausas, não no jogo. Se o servidor
demorar, o tempo acaba com a troca ainda andando, e aí o texto passa a *"terminando…"* em vez de
contar para baixo de zero.

No fim o painel diz, em verde: **`Pronto! "gym" montado em 24 s.`** O relógio para antes desse
anúncio, e não só na limpeza do `finally` — entre o fim da troca e o fim da limpeza há até um
segundo, e durante ele a tela mostrava "Pronto" com a barra ainda correndo ao lado.

### Modo compacto

O botão `–` no cabeçalho deixa só o **nome do time e o `Usar`**. Somem o campo de salvar, a lista de
quem está em cada time e o `×` de esquecer.

Trocar de equipe é o que se faz todo dia; guardar um time novo, quase nunca. Com a lista cheia, o
painel ocupava um pedaço da tela do jogo sobretudo para mostrar o que já se sabe de cor. A escolha
fica guardada, porque quem prefere um modo prefere sempre.

E o painel fica **menor**, não apenas mais vazio: medido na banca, 260×320 no modo cheio e 186×207
retraído. Tirar as informações e manter o tamanho deixaria a largura e a altura do modo cheio
sobrando em volta de uma lista de três linhas curtas.

São dois painéis diferentes, então cada modo guarda o seu tamanho. Um valor só serviria mal aos dois
e deixaria a alternância presa ao maior: arraste a alça no compacto e o modo cheio não muda.

O formato antigo, de quando havia um tamanho só, continua valendo como o tamanho do modo cheio — que
é o que ele sempre foi.

### Encolher a janela não apaga o tamanho escolhido

O painel se encaixa na tela de agora: no máximo 92% da largura e 88% da altura, refeito a cada
mudança da janela, e não só na próxima carga.

Isso abria um caminho silencioso para o painel esquecer o tamanho que você escolheu. A janela
encolhe → o painel é limitado ao teto da tela nova → essa mudança acorda o `ResizeObserver`, que
grava o tamanho limitado por cima do escolhido. De volta à tela grande, o painel fica pequeno para
sempre, e nenhuma peça do caminho parece errada: cada uma fez o que devia.

O observador agora compara a caixa com o último tamanho que **o código** aplicou. Se bate, a mudança
não foi da alça, e nada é gravado.

### A mochila reabre na categoria errada

Ela guarda a última categoria usada. Deixada em **Boosters**, abre em Boosters — sem uma única
célula de Pokémon na tela. A ferramenta lia essa grade vazia e anunciava que o time guardado tinha
sumido da mochila: mensagem errada sobre um problema que não existia.

Antes de ler qualquer coisa, o inventário é levado para a aba **Pokémon** (ou **Todos**, de
reserva). Trocar de aba não abre janela nenhuma, então não custa nada ao gerenciador de janelas.

É a mesma lição que a loja rápida já tinha aprendido sobre as abas dela, ignorada pela segunda vez
dentro do mesmo pacote.

### A banca: o painel sem o jogo

`testes/banca.html` sobe o painel do Times fora do PokePixel — um `PPX` de mentira, três times
semeados, nenhum jogo por baixo. Serve para olhar o desenho sem abrir a conta de ninguém.

Ela se pagou na primeira vez em que foi usada, pegando três defeitos que nenhuma verificação de
texto encontraria: um `ReferenceError` que derrubava o módulo inteiro e deixava o painel sem lista
(`const` não sobe, e `aplicarModo` chamava `recolocar` cedo demais — o `no-undef` não vê isso,
porque o nome existe), a barra do relógio visível o tempo todo apesar do `hidden`, e o vazio embaixo
da lista no modo compacto.

O que ela **não** prova: nada que dependa do DOM do jogo. É por isso que a decisão de troca mora
numa função pura, testada à parte.

```bash
python -m http.server 8777
```

Depois abra `http://localhost:8777/testes/banca.html`. Por `file://` não funciona: o navegador
recusa carregar `../times.js`.

## Ginásio do dia

Sai da caçada, troca para o time de ginásio, desafia o ginásio marcado **HOJE**, volta ao time de
caçada e reentra na mesma caçada de onde saiu. Uma região por vez — Kanto e Johto têm times
diferentes. A **Elite Four fica de fora**, por pedido.

```
guardar a caçada → VOLTAR À CIDADE → time do ginásio → F5 → NPC GYM
    → aba da região → o marcado HOJE → DESAFIAR → combate → time de volta → a caçada
```

### Três coisas que só apareceram fazendo

**Não é preciso andar.** O pedido original falava em "correr para o ginásio". Não é preciso: o
"Conversar" do NPC GYM foi clicado com o NPC **fora da tela** e a janela abriu. Nenhum passo desta
ferramenta move o personagem — o que teria sido, de longe, a parte mais frágil dela.

**O F5 é obrigatório** entre trocar o time e desafiar. Sem ele o painel do ginásio continua vendo a
equipe antiga: medido, seis Pokémon no HUD e *"Pokémon equipados 1/3"* na janela, mesmo fechando e
reabrindo. Desafiar assim entregaria um ginásio reforçado por uma condição que você de facto cumpre.

**O combate é automático e o cronômetro é um teto.** O relógio marcava 15 minutos num combate que
durou **67 segundos**. Quem diz que acabou é o título do resumo, que já vem com "Vitória!" ou
"Derrota!" dentro — uma espera só, que entrega a resposta junto com o fim.

### A máquina de estados existe por causa do F5

A recarga leva consigo tudo o que estiver só na memória. Por isso a tarefa é guardada no
armazenamento, etapa a etapa, e a etapa seguinte é escrita **antes** da recarga — senão a página
voltaria, repetiria a etapa do F5 e recarregaria outra vez, para sempre.

Uma falha não recomeça do zero: a tarefa fica guardada na etapa em que parou, e a tentativa seguinte
continua dali. Sair da caçada duas vezes não faria sentido nenhum.

### Derrota não é erro

O ciclo de dez minutos vale para falhas de verdade — janela que não abriu, troca que não completou.
Numa derrota o jogo funcionou: você perdeu. Repetir queimaria a segunda entrada do dia à toa.

E falhar ao devolver o time de caçada **interrompe** o ciclo em vez de seguir: entrar na caçada com
o time de ginásio seria pior do que parar e avisar.

### O ritmo, e por que são dois

Um minuto a dois antes do ginásio; dois a três depois dele. São dois orçamentos porque são dois
momentos diferentes: antes há a pressa de quem vai lutar, depois a calma de quem já lutou.

A parte que se parece com um jogador não é a forma do clique, é o ritmo — sair da caçada, trocar
seis Pokémon e desafiar em oito segundos não se parece com ninguém, por mais fiel que seja cada
evento de rato. Ainda assim os cliques também são de gente: o ponteiro chega, hesita entre 120 e
420 ms, e o ponto de contacto não é o centro exacto do botão duas vezes seguidas.

Onde o clique humano não funcionar, há reserva para o `click()` simples. Isso veio de uma medição:
a sequência completa de ponteiro nos botões **da barra de cima** impedia o inventário de abrir — a
barra reage a mais de um dos eventos e abria e fechava na mesma rajada.

As pausas longas dizem na tela que são propositais (*"Esperando um pouco… 24 s"*). Sem isso a
ferramenta pareceria travada, e você clicaria no botão outra vez.

### Voltar para a caçada

Um botão à parte, que leva de volta sem ginásio nenhum — útil depois de uma corrida que parou no
meio, ou de uma ida ao ginásio feita à mão. A caçada em curso é lembrada de dez em dez segundos,
porque o nome dela só existe no DOM enquanto ela corre: depois de sair, não há de onde tirá-lo.

## O que não aparece na mochila é zero

A mochila só lista o que existe: item zerado não aparece nela. A extensão lia essa ausência como
"não sei quanto tenho" e pulava o item — então justamente o que acabou, que é o que mais precisa de
reposição, era o único que nunca era comprado. Agora, **com a mochila lida**, o que não aparece vale
zero. Sem leitura nenhuma continua sendo "não sei": aí a ausência valeria para tudo, e o alvo
inteiro seria comprado por engano.

Depois de comprar, a mochila é lida de novo. Sem isso o painel seguiria mostrando os números de
antes da compra, e a rodada seguinte decidiria em cima deles.

## Janela já fechada não se fecha de novo

O jogo deixa a janela fechada no DOM, invisível, com o botão de fechar ainda dentro. Clicar nesse
`✕` de uma janela que já saiu da tela convence o jogo de que há uma janela aberta, e a partir daí
ele recusa qualquer outra — Caçadas, Inventário, Pacote — com *"Não foi possível abrir esta janela
agora"*, até um F5.

As duas extensões faziam isso ao limpar popups antes de agir. Agora só fecham o que está mesmo na
tela: o painel precisa ter largura, e o `✕` também.

**E o Times repetiu o erro mesmo com isto escrito aqui.** Ele conferia o fechamento por
`isConnected` — que continua verdadeiro numa janela fechada —, concluía que o clique tinha falhado e
clicava de novo, até três vezes. Era a própria ferramenta provocando o travamento que depois
relatava como defeito do jogo, e que aparecia "depois de usar umas três vezes".

Daí as duas regras, agora com teste de guarda: o critério é a janela **sair da tela**, nunca sair do
DOM; e não existe segunda tentativa. Se o clique não fechou, insistir é pior do que falhar.

## Uma quebrada não leva as outras

Cada ferramenta continua sendo o seu próprio arquivo, carregado pelo navegador por conta própria, e
é iniciada dentro de um `try`. Se uma estourar, as outras seguem funcionando e o menu mostra o erro
ao lado do nome dela, em vez de ela sumir sem explicação.

Esse era o maior risco de juntar cinco extensões numa só, e é a razão de o pacote não ser um
arquivo gigante.

## Por que "Sem gráfico" é diferente

Ela roda no mundo da própria página (`world: "MAIN"` no manifest), porque precisa alcançar o
desenho do jogo. De lá ela não enxerga o menu — são dois `globalThis` separados —, e o que os dois
lados partilham é o `localStorage`. Por isso ela lê a sua escolha na carga: **ligar e desligar essa
vale a partir da próxima carga da página**, nunca na hora.

## O que o pacote acessa

O mesmo que as cinco acessavam, nada a mais: a página do jogo, para achar a loja do Mark, os
campos de login e os popups; e o armazenamento local, para guardar as suas escolhas. Nenhuma
chamada de rede, nenhum servidor, nenhuma conta.

A senha continua guardada em texto puro, como antes. Serve para este jogo e nada mais.

## Onde funciona

`pokepixel.nietore.com` e `poke.idleworld.online`.

As cinco extensões avulsas continuam publicadas e funcionando para quem já as usa; elas é que não
recebem mais novidades. Não instale as duas coisas na mesma janela: cada ferramenta apareceria duas
vezes.

## Instalação

Pela loja de extensões do LionMultInstance, ou à mão: baixe o `.zip` da
[última release](../../releases/latest), descompacte numa pasta e aponte a extensão da janela para
ela.

Ao lado do `.zip` há um arquivo `.sha256`, para conferir que o pacote baixado é exatamente o que
foi publicado aqui.
