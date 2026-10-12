# PokePixel — qualidade de vida

As onze ferramentas de qualidade de vida do PokePixel num pacote só, com um menu para ligar e desligar cada uma na
janela em que você está.

**Alt+Q** abre e fecha o menu. Fechado, fica só o botão `PokePixel` no canto.
**Alt+Z** esconde todas as janelas de uma vez; **Alt+X** traz de volta as que estavam à vista.

| ferramenta | o que faz | atalhos |
| --- | --- | --- |
| Ocultar popups | esconde os popups que aparecem ao passar o mouse | Alt+B esconde · Alt+N mostra |
| Sem gráfico | desliga o desenho do mapa e congela a caçada; o jogo continua rodando | Alt+G desliga · Alt+H liga |
| Senha | guarda usuário e senha e os cola no login | botões na tela de login |
| Loja rápida | compra pokébolas, poções e revives sem abrir a loja | Alt+C esconde · Alt+V mostra |
| Venda rápida | vende pokémon pelas raridades que você marcar | Alt+D esconde · Alt+F mostra |
| Layout padrão | põe as janelas do jogo no lugar que você escolheu | Alt+J esconde · Alt+K mostra · Alt+L arruma |
| Times | guarda composições de equipe e troca para uma delas num clique | Alt+T esconde · Alt+Y mostra |
| Ginásio do dia | sai da caçada, troca o time, desafia o ginásio de hoje e volta | Alt+G esconde · Alt+H mostra |
| Caçadas | guarda atalhos para as caçadas que você usa, cada uma com o seu time | Alt+W esconde · Alt+E mostra |
| Raridades | lista todos os seus Pokémon com o número da raridade, e filtra por faixa | Alt+A esconde · Alt+S mostra |
| Escada de caçadas | troca de caçada sozinha quando o aluno sobe de nível, e leva o derrotado à enfermeira | Alt+U esconde · Alt+I mostra |

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

## Alt+Z e Alt+X: limpar a tela inteira

**Alt+Z** esconde todas as janelas do pacote de uma vez. **Alt+X** traz de volta.

São dois, e não um que alterna — a mesma regra de cada ferramenta aqui, pelo mesmo motivo: com um
atalho só nunca se sabe em que estado se está sem olhar, e quem aperta duas vezes volta ao começo.
Apertar o mesmo de novo não desfaz nada.

Isso é mais que gosto neste par. Com tudo já escondido, um segundo Alt+Z refaria a lista do que
estava à vista — que a essa altura é vazia — e o Alt+X seguinte não teria o que trazer de volta. Por
isso o segundo Alt+Z simplesmente não faz nada.

**O que volta é o que estava.** A ferramenta que você já tinha escondido continua escondida: a lista
do que estava à vista fica guardada, e é por ela que a volta se faz. Sem isso, o atalho seria uma
armadilha — um Alt+Z para dar uma olhada no jogo e, na volta, quatro janelas que você não queria.

**As duas ferramentas de efeito não entram.** "Ocultar popups" e "Sem gráfico" não têm janela
nenhuma na tela; o botão delas liga e desliga o que fazem com a página. Apagá-las aqui não limparia
nada — mudaria o comportamento do jogo, que não é o que os atalhos prometem.

**A caixa da senha fica.** Ela só aparece onde há senha para digitar — a tela em que o jogo nem
começou e não há vista nenhuma a desimpedir. Um Alt+Z dado por engano ali escondia justamente o
botão de entrar, e só o menu do pacote o trazia de volta. Agora ela some apenas pelo que você
aponta: o botão de esconder dela, no menu.

**A abinha `PokePixel` fica.** Ela é o menu geral do pacote, não uma das janelas que atrapalham a
vista do jogo — o que estorva são os painéis das ferramentas. Deixá-la à vista mantém o caminho de
volta a um clique, para quem não lembrar do Alt+X. Alt+Q também continua abrindo o menu.

O estado atravessa o F5, como todo o resto do pacote. Medido em `testes/banca-sumico.html`, que
recarrega a página de verdade no meio do caminho.

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
rápidas e a barra de ferramentas, **e também as janelinhas deste pacote**: Times, Ginásio, Caçadas,
Raridades, Venda, Compra e o próprio menu.

O caminho é o mesmo que você faria à mão: arrume tudo como quiser uma vez, clique em **Salvar
layout atual**, e daí em diante é um botão. O que está salvo aparece no painel: quantas peças, de
que dia, e de que tamanho de tela.

Como funciona por dentro: o jogo posiciona cada janela escrevendo `inset`, `width` e `height` no
próprio elemento, e aceita que outro código escreva por cima — a janela vai para lá e fica, inclusive
quando é fechada e reaberta, porque o jogo reaproveita o mesmo elemento. Nada é pedido ao servidor e
nada é feito com cliques simulados.

### As janelinhas do pacote entram junto

Cada ferramenta daqui guarda o canto dela numa chave própria, todas no mesmo formato e com o mesmo
padrão de nome. É por isso que arrumá-las não exigiu uma linha em nenhuma das dez: o layout lê e
escreve essas chaves, e no fim dispara um `resize` — que é o aviso que todas elas já escutavam para
não ficar penduradas para fora quando a janela muda de tamanho. **Não precisa de F5.**

Isso vale só no clique (ou no Alt+L) e na troca de layout. O *arrumar automático*, que roda a cada
janela do jogo que abre e a cada vez que a tela muda de tamanho, não toca nos cantos do pacote: ali
ele brigaria com você arrastando um painel naquele instante, e o `resize` do fim sairia de dentro do
próprio tratador de `resize` — laço.

**A caixa de senha fica de fora.** Ela guarda a posição em `chrome.storage.local`, que é outro
armazenamento, assíncrono, e não aparece no `localStorage` onde o layout lê.

### Levar a arrumação para outra janela, em arquivo

Além do texto para copiar e colar, que continua ali e serve bem entre duas janelas abertas ao mesmo
tempo, há **Exportar** e **Importar** — os mesmos botões da venda e da compra, vindos do
`config.js`. O arquivo é para o resto: guardar a arrumação boa antes de mexer, e levá-la para uma
janela que ainda não existe.

O que chega de um arquivo é conferido duas vezes: **o nome da chave** tem de bater com o padrão das
nossas, e **o valor** tem de ser um canto que o núcleo reconheça. Um JSON montado à mão não vira
chave arbitrária no armazenamento do jogo. A mesma conferência passou a valer para as chaves do
próprio jogo, que até aqui eram escritas de volta sem olhar.

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

### Editar um time guardado

Dois caminhos, os dois na própria linha do time:

**Regravar com a equipe da tela** — o `↻`. Monte a equipe como quer no jogo e clique: aquele time
passa a ser esta equipe, sem digitar o nome outra vez. São **dois cliques** (o botão vira `?` e
espera 5 s pelo segundo), porque isto grava por cima de um time inteiro e um toque errado não pode
apagar nada. O time regravado fica **onde estava** na lista, em vez de saltar para o fim.

**Renomear** — clique no nome. Ele vira uma caixa de texto ali mesmo: Enter grava, Escape desiste,
e clicar fora grava também (quem escreveu quer o que escreveu). Dois times com o mesmo nome são
recusados — seriam indistinguíveis, e o `usar` pegaria o primeiro.

O **Ginásio guarda os times pelo nome**, porque nome é tudo o que há — não existe id de time no
jogo. Renomear aqui partiria a escolha dele em silêncio, e só se descobriria no meio de uma corrida.
Por isso o Times avisa pela porta `PPX.gym`, do mesmo jeito que o Ginásio pergunta os nomes pela
porta `PPX.times`: a escolha guardada e a lista na tela seguem o nome novo sozinhas.

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
    → aba da região → o marcado HOJE → DESAFIAR → combate → F5 → time de volta → a caçada
```

### O que só apareceu fazendo

**Não é preciso andar.** O pedido original falava em "correr para o ginásio". Não é preciso: o
"Conversar" do NPC GYM foi clicado com o NPC **fora da tela** e a janela abriu. Nenhum passo desta
ferramenta move o personagem — o que teria sido, de longe, a parte mais frágil dela.

**O F5 é obrigatório** entre trocar o time e desafiar. Sem ele o painel do ginásio continua vendo a
equipe antiga: medido, seis Pokémon no HUD e *"Pokémon equipados 1/3"* na janela, mesmo fechando e
reabrindo. Desafiar assim entregaria um ginásio reforçado por uma condição que você de facto cumpre.

**A segunda recarga é outra coisa.** O F5 acima é técnico e obrigatório; o que vem depois do
combate é precaução, pedida depois de aparecerem erros na troca de equipe ali. Faz sentido com o
que já se sabia deste ponto: a página chega ao fim da luta depois de um cinema, de uma tela de
resumo e dos banners que nascem por cima dela — é a parte mais suja da corrida. Começar a volta de
uma página limpa custa uns segundos num orçamento de dois a três minutos, e a máquina de estados
que o primeiro F5 obrigou a existir já paga o custo de atravessar uma recarga.

O resultado do combate é gravado **antes** de a página ir embora: sem isso a recarga apagaria quem
ganhou, e o placar do dia registaria uma vitória como derrota. E quem espera os anúncios nascerem
é a carga seguinte, não a etapa que recarrega — o anúncio que atrapalha é justamente o que ainda
não existe deste lado do F5.

**O combate é automático e o cronômetro é um teto.** O relógio marcava 15 minutos num combate que
durou **67 segundos**. Quem diz que acabou é o título do resumo, que já vem com "Vitória!" ou
"Derrota!" dentro — uma espera só, que entrega a resposta junto com o fim.

### A máquina de estados existe por causa do F5

A recarga leva consigo tudo o que estiver só na memória. Por isso a tarefa é guardada no
armazenamento, etapa a etapa, e a etapa seguinte é escrita **antes** da recarga — senão a página
voltaria, repetiria a etapa do F5 e recarregaria outra vez, para sempre.

Uma falha não recomeça do zero: a tarefa fica guardada na etapa em que parou, e a tentativa seguinte
continua dali. Sair da caçada duas vezes não faria sentido nenhum.

**São três tentativas, e depois para.** Antes não havia teto: um erro que não passa sozinho — o time
apagado, o ginásio já feito hoje, a conta deslogada — virava uma tentativa de dez em dez minutos,
para sempre, mexendo no jogo sem ninguém olhando. Três cobre o que de fato passa com o tempo (um
anúncio preso, a página lenta); o que não passa em três não passa em trinta.

Ao desistir, a tarefa é **descartada**, não só o relógio. Enquanto ela existisse, o painel se
consideraria em corrida: os botões ficariam travados e a agenda do dia não arrancaria. O erro fica
registrado no placar da região, para a desistência não passar despercebida a quem não estava à
frente da tela.

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

**O tempo está entre os cliques, não antes deles.** A primeira versão repartia o orçamento por
etapas, e dentro de cada etapa os cliques saíam todos juntos: a ferramenta ficava parada um bom
bocado e depois disparava quatro cliques num segundo. Relatado assim: *"mal entrou a página de
vitória já disparou a troca de times"*. Agora quem respira é o próprio clique — cada um leva o que
resta do orçamento a dividir pelos cliques que ainda faltam na fase. Se o jogo demorar, as pausas
encolhem sozinhas; se sobrar tempo, o último clique da fase fica com ele todo. E há um chão de
1,5 s por clique, mesmo com o orçamento estourado: nunca saem dois no mesmo instante.

Medido na banca, uma corrida completa: 19 s entre abrir o NPC e escolher o ginásio, 14 s até
desafiar, 14 s até confirmar o resumo — e só depois a mochila.

Onde o clique humano não funcionar, há reserva para o `click()` simples. Isso veio de uma medição:
a sequência completa de ponteiro nos botões **da barra de cima** impedia o inventário de abrir — a
barra reage a mais de um dos eventos e abria e fechava na mesma rajada.

As pausas longas dizem na tela que são propositais (*"Esperando um pouco… 24 s"*). Sem isso a
ferramenta pareceria travada, e você clicaria no botão outra vez.

### O anúncio que nasce atrasado

O primeiro erro relatado na prática foi *"não consegui abrir a janela do ginásio"*, com o anúncio do
Discord cobrindo a tela inteira (`z-index` 18000).

O seletor de fechar sempre esteve certo. **O problema era o momento.** O anúncio nasce alguns
segundos *depois* da recarga, e a ferramenta fechava os banners antes de ele existir: encontrava a
tela limpa, seguia em frente, e o anúncio aparecia mesmo a tempo de o jogo recusar abrir a janela.

Fechar uma vez não basta. Agora espera-se a tela ficar **quieta** — três voltas seguidas sem nada a
fechar e sem nada grande por cima —, e isso acontece depois da recarga, antes de abrir o ginásio e
antes de voltar à caçada. Há ainda uma segunda tentativa de abrir o ginásio, para o anúncio que
apareça entre a limpeza e o clique.

Além dos dois botões de fechar conhecidos, há uma rede: qualquer caixa que cubra boa parte da tela
com `z-index` de modal conta como anúncio. As janelas do jogo e os painéis deste pacote ficam de
fora — o próprio painel do ginásio seria o primeiro falso positivo.

### O ginásio que ainda não foi desenhado

Segundo erro relatado na prática: *"não há ginásio marcado HOJE em KANTO"* — com o **HOJE bem
visível na tela**, na captura, e o `Desafiar agora` disponível.

A janela entra no DOM antes do conteúdo dela. É a terceira vez que esta lição aparece neste
repositório: a loja do Mark desenha as abas ~285 ms depois da janela, o inventário pinta a grade em
etapas, e aqui o mapa do desafio é uma imagem grande com os ginásios por cima. Procurar uma única
vez, no instante em que a janela existe, não acha nada.

Agora espera-se por eles, e aceitam-se as duas marcas: a classe `is-active` e o texto `HOJE` do
rótulo. São a mesma coisa no jogo, mas custa pouco não depender de uma só.

E a falha passou a **dizer o que viu**: *"em KANTO, vi 7 ginásios e nenhum marcado HOJE: Brock
Pewter | Misty Cerulean | …"*, ou *"a janela abriu mas os ginásios não chegaram a aparecer"*. Foi a
falta disso que transformou um problema de espera num mistério.

A banca cobre este caso: `testes/banca-gym.html?jogo=1` monta um jogo de mentira cujos ginásios só
aparecem **4 segundos** depois da janela, e o ciclo inteiro corre contra ele — incluindo o F5, o
combate e a leitura da vitória.

### Os dois cinemas

Medido no jogo, capturando o DOM durante uma corrida de Johto — e foi esta medição que explicou
três versões de conserto errado:

| momento | `.regional-cinema__title` | `.regional-cinema__skip` |
|---|---|---|
| antes da luta | `Desafio de ginásio` | `Entrar na arena` |
| depois dela | `Vitória!` / `Derrota!` | `Continuar` |

**São as mesmas classes.** A ferramenta procurava o elemento, achava o primeiro cinema, concluía
que a partida tinha acabado e — como *"Desafio de ginásio"* não casa com *"vitória"* — marcava
**derrota**, antes de a luta começar. Depois ia montar o time de volta. A tela de vitória chegava
sem ninguém para a confirmar.

Era isto o tempo todo. As duas correções anteriores — esperar o botão nascer, esperar ele ligar —
atacavam o botão errado, e passavam na banca porque **eu tinha construído a banca com o modelo
errado na cabeça**: um cinema só. A banca confirmava a minha suposição em vez de a testar.

Agora o resultado é reconhecido pelo **texto**, nunca pela presença do elemento, e entrar na arena
é um passo próprio, com o seu clique. A banca monta os dois cinemas, com os textos reais.

### O resumo da partida, e o botão que chega por último

Terceiro erro relatado na prática: a tela de **Vitória!** apareceu e a ferramenta foi logo trocar o
time, sem clicar em `Continuar`.

Mesma lição, quarta ocorrência: o título entra na tela antes do resto do resumo. As caixas de
duração, insígnia e drops ainda estão a ser desenhadas, e o botão de confirmar é o último a chegar.
Procurar uma única vez, no instante em que o título aparece, não encontrava nada — e seguia-se com
o resumo aberto por cima.

Esperar o botão **aparecer** não chegou. Relatado outra vez, depois dessa correção: *"a tela de
confirmação quando ganha o gym não está sendo clicada"*.

A resposta estava escrita na própria tela, mesmo por cima do botão: **"Resultado e recompensas
confirmados"**. O `Continuar` nasce **desligado** enquanto o jogo confirma o resultado. Clicar nesse
intervalo não faz nada — e a ferramenta ia-se embora convencida de que tinha clicado.

Agora espera-se que ele **ligue**, não que apareça: visível, sem `disabled`, sem `aria-disabled`,
sem `is-disabled`/`is-loading`, sem `pointer-events: none`. Até 30 s, porque o que se espera aqui
não é o desenho da tela, é a confirmação do outro lado. Aceita-se pela classe **ou** pelo texto
(`Continuar`/`Confirmar`/`OK`/`Fechar`), em `button`, `[role=button]` ou `a`.

Antes de clicar há uma pausa de 3 a 7 s — o tempo de ler o que se ganhou —, e depois até quatro
tentativas, porque o botão pode voltar a desligar-se entre o olhar e a mão. Depois disso ainda há
outra pausa antes de a mochila abrir.

E a falha diz o que viu, com a marca que importa: *"vi: Continuar (desligado)"*.

Se mesmo assim o resumo não fechar, a corrida **não** pára: parar deixaria a tarefa na etapa
`desafiar`, e a tentativa dos dez minutos desafiaria outra vez um ginásio já feito. Diz-se na tela e
segue-se.

A banca cobre os dois casos: no jogo de mentira o botão `Continuar` só nasce **2,5 s** depois do
título, e nasce **desligado** por mais 6 s.

### Horário para cada região

O formato é o mesmo da venda e da loja rápidas, por pedido: `08:00-09:00`, uma janela por vírgula,
e **uma rodada por janela**. O instante é sorteado dentro da janela inteira — começar sempre às
08:00 em ponto é o padrão mais visível que existe. Uma janela que termina antes de começar
atravessa a meia-noite (`22:00-02:00`).

Kanto e Johto têm cada uma a sua caixa, o seu interruptor e, agora, **os seus próprios times**: a
região escolhida no alto manda no que as duas listas mostram, e trocar de região não escreve por
cima dos times da outra. Sem isso, agendar as duas seria agendar a mesma equipe duas vezes.

A janela é marcada como usada **antes** de a corrida começar, nunca no fim. A corrida passa por um
F5 no meio: um relógio que vivesse só na memória voltaria a disparar na mesma janela, desafiando
outra vez um ginásio já feito.

O botão e a agenda começam pelo mesmo caminho (`comecar`). O automático não pode ser um segundo
fluxo, com os seus próprios enganos.

### O sinal de cada região

Um ponto ao lado de cada linha:

| cor | o que diz |
|---|---|
| verde | venceu |
| vermelho | perdeu |
| laranja | deu erro |
| cinza | ainda não foi feito hoje |

Passar o rato diz o resto: *"KANTO: Vitória às 20:44"*, *"JOHTO: Deu erro às 20:43 — não achei o
botão Caçar"*. Com o ginásio a correr sozinho, é a única forma de saber o que aconteceu enquanto
ninguém estava a olhar — e derrota e erro ficam distinguíveis, que é a diferença entre "perdi" e
"nem cheguei a lutar".

**O placar corrige-se à mão.** Clicar no sinal (ou, minimizado, na palavra ao lado dele) roda o
que ele diz: *ainda não foi feito* → *Vitória* → *Derrota* → *ainda não foi feito*. É para o caso
que acontece de verdade: deu erro, o dono foi ver à mão e o ginásio já estava ganho — ou ele mesmo
venceu, pelo jogo, e o painel continuava a dizer que não. **"Deu erro" fica de fora da roda**:
quem marca um erro é a corrida que falhou, não a pessoa; partindo de um erro, o clique seguinte é
*Vitória*, que é justamente o caso descrito.

Marcar à mão **não manda no ginásio**: nada aqui faz uma corrida começar ou deixar de começar —
quem manda nisso é a agenda. O placar é memória, e o que se corrige é uma memória errada. Fica
escrito no texto da linha que a marca foi posta à mão, para ninguém mais tarde a ler como medida.

**A hora do reset é um campo.** Eu não sei a que horas o PokePixel reseta o ginásio do dia, e
inventar um número seria pior do que perguntar: o sinal ficaria verde depois do reset, ou cinza
antes dele. O padrão é meia-noite local; mudar o campo acerta tudo, sem versão nova.

### O botão `↻`: times novos sem recarregar a página

As duas listas de times são enchidas uma vez, quando o painel sobe. Um time guardado **depois**
disso só aparecia aqui com um F5 — e um F5 no meio de uma caçada é caro.

O `↻` no cabeçalho volta a perguntar ao Times e enche as listas outra vez. Só isso: nada no jogo
é tocado, nada é recarregado. Ele diz o que encontrou — *"Lista atualizada: Gym Hoenn."* ou
*"Lista atualizada — 4 times, nenhum novo."* —, e uma escolha já feita na tela não é desfeita se o
time continuar a existir.

Fica travado durante uma corrida, como os outros botões, e desaparece no modo minimizado.

### Minimizado: a etiqueta GYM e o placar

O botão `–` no cabeçalho recolhe o painel para uma etiqueta estreita com **GYM**, o sinal de cada
região com o resultado escrito ao lado — `Kanto  Vitória 22:24` — e a linha do próximo horário:

```
GYM                □ ×
● Kanto  Vitória 22:24  ▶
● Johto  —              ▶
próximo: Johto hoje às 19:10
```

O que sai da frente são as listas e os campos, que é o que tapa o jogo e é uma ordem que se dá uma
vez por dia. O placar fica, e de propósito: **minimizado é justamente o estado em que o ginásio
corre sozinho**, e abrir o painel inteiro só para ver se o ponto já está verde desfazia o motivo de
o ter minimizado. A palavra fica escrita porque ninguém para o mouse em cima de um ponto de dez
pixels para saber como acabou — o `title` continua lá, com a frase inteira.

Cinza não ganha palavra nenhuma, só um traço: o ponto já diz que não foi feito, e a hora de um
ginásio que não aconteceu não existe. A mensagem do que está acontecendo *agora* continua só no
painel inteiro. A escolha de minimizar fica guardada.

### O botão `▶`: ir agora, na região daquela linha

Cada região tem o seu. O `Fazer o ginásio de hoje` vai na região que a lista mostra; o `▶` vai na
região da **própria linha**, que é o que se quer quando se está olhando para o placar e se vê que um
dos dois ainda não foi feito. A lista acompanha o clique em vez de ficar apontando para a outra —
ela manda no `Voltar para a caçada` e nos times à vista, e deixá-la para trás faria o próximo clique
agir noutro lugar.

**Ele existe também no painel minimizado**, e é esse o ponto: minimizado é o estado em que este
painel vive. Mandar abrir tudo para clicar num botão desfaz o motivo de o ter minimizado.

Enquanto algo corre, os dois ficam apagados e a linha da região em andamento diz `indo…` no lugar do
resultado. Duas corridas ao mesmo tempo não existe, e um botão que aceita o clique sem fazer nada é
pior do que um botão apagado.

Uma recusa — time não escolhido, por exemplo — **abre o painel**. A linha de estado, onde a frase
está escrita, fica escondida quando o painel está minimizado: sem isso, o clique pareceria um botão
quebrado. O caminho é o mesmo do botão de sempre, com a mesma máquina de estados: o manual e o
automático não podem ser dois fluxos, cada um com os seus próprios enganos.

### Voltar para a caçada

Um botão à parte, que leva de volta sem ginásio nenhum — útil depois de uma corrida que parou no
meio, ou de uma ida ao ginásio feita à mão. A caçada em curso é lembrada de dez em dez segundos,
porque o nome dela só existe no DOM enquanto ela corre: depois de sair, não há de onde tirá-lo.

**Ele monta o time de "Voltar com" antes de reentrar.** A primeira versão não fazia isso, e o
relato foi direto: *"cliquei em voltar para a caçada e ele não trocou meu time"*. O campo está no
painel mesmo por cima do botão — ignorá-lo era a interface prometer uma coisa e fazer outra.

Se você já estiver numa caçada, ele troca o time e para por aí: não faz sentido reentrar no que já
se está. E segue o mesmo orçamento de 2 a 3 minutos do fim de um ginásio, porque é a mesma
sequência, feita à mão.

## Raridades: a coleção inteira numa tela

Lista **todos** os seus Pokémon — mochila, depósito e time — com o número da raridade de cada um,
ordenados do mais raro para o menos raro. Dois campos, `de` e `até`, filtram pela faixa que
interessa; `Copiar a lista` leva o resultado para fora do jogo.

Cada linha diz a espécie, a qualidade, o nível e onde o bicho está. Parar o mouse sobre o número
mostra a faixa daquela qualidade — é a mesma leitura que a tela do jogo faz com `×1,45 / ×1,54`:
serve para saber se um épico é um épico qualquer ou um épico quase perfeito.

### Ela não abre um Pokémon sequer

Na tela, o número da raridade só aparece abrindo um Pokémon de cada vez. Na conta em que isto foi
medido seriam **117 aberturas** — lento, barulhento e frágil.

Mas o jogo publica a própria API em `window.PokeIdle`, e `getCreatures` devolve a coleção inteira de
uma vez, com `quality_multiplier` em cada registro. A ferramenta pergunta uma vez e pronto: nenhum
clique no jogo, nenhuma janela aberta. O botão `↻` pergunta de novo, por fora do cache, para quando
você acabou de capturar alguma coisa.

### Por que ela tem duas metades

`PokeIdle` vive no mundo da página. Um content script comum roda num `globalThis` separado: de lá,
`PokeIdle` simplesmente não existe. Por isso há dois arquivos — `raridades-main.js` entra com
`world: "MAIN"` e só responde pedidos; `raridades.js` desenha o painel e nunca toca no jogo. Os dois
conversam por evento de DOM, o único canal que os dois mundos partilham.

Só atravessa a ponte o que a lista usa: espécie, apelido, raridade, qualidade, lugar, nível, brilho,
tranca e valor de venda. O registro do jogo também traz id de treinador, assinatura de captura e
zona de origem — nada disso tem por que cruzar para ser descartado do outro lado.

Cada pedido leva um eco de volta. Dois podem estar no ar ao mesmo tempo — o automático da abertura e
um clique em `↻` —, e sem o eco a resposta do primeiro passaria pela do segundo, mostrando dados
velhos sem nada na tela indicando isso. E a espera tem fim: se a outra metade não tiver entrado,
ninguém responde nunca, e um painel preso em "lendo…" não diz o que está errado.

### As faixas vêm do jogo

Fraca 0,90–0,99 · comum 1,00–1,09 · incomum 1,10–1,24 · rara 1,25–1,39 · épica 1,40–1,54 · lendária
1,55–1,69. Os números estão aqui para você, mas **não estão cravados no código**: a ferramenta
pergunta ao jogo. Um número cravado seria uma mentira silenciosa no dia em que o jogo mexesse numa
das faixas.

O filtro aceita vírgula e ponto — ninguém digita `1.45` olhando para uma tela que escreve `×1,45` —
e campo vazio significa "sem limite deste lado", não zero.

### Minimizada

Fica a contagem da faixa e o melhor da coleção: `19 de 117 na faixa` e `×1,688 Scyther`. O resto —
a lista, os campos — sai da frente.

## Caçadas: atalhos para voltar numa tecla

Guarda as caçadas que você usa e leva até qualquer uma num clique. Quantas quiser.

`Guardar a caçada atual` grava a que está correndo — nome, região e modo. Cada linha ganha um
`Ir`, e a que está acontecendo agora aparece marcada com **você está aqui**. Guardar a mesma
caçada outra vez atualiza em vez de duplicar: dois atalhos com o mesmo nome seriam
indistinguíveis.

A marca **você está aqui** é conferida de **dez em dez minutos**, e também na hora em que o painel
reaparece. Ela é uma comodidade, não um relógio: quem acabou de entrar numa caçada já a está vendo
no jogo. E repinta-se **só a marca**, nunca a lista — reconstruir as linhas fecharia um select de
time aberto na cara de quem estivesse a escolher.

### A lista inteira vem do jogo, e não de ir a uma por uma

Guardar um atalho era um ato de presença: entrar na caçada, porque **o nome só existe na tela
enquanto ela corre**. Para ter nove atalhos faziam-se nove viagens — e o nível de cada caçada, que é
a única coisa que decide se ela presta para um Pokémon, não aparecia em canto nenhum do painel.

O jogo sabia a lista inteira o tempo todo. Medido na conta real em 12/10/2026: `Api.getZones()`
devolve **377 caçadas** com nome, nível e mundo, e `Api.getWorlds()` devolve os quatro mundos
(Kanto 1–100, Johto 101–200, Hoenn 201–350, Ilhas Lendárias). Uma leitura, sem abrir janela nenhuma.

Então a lista do painel passou a ser a lista do jogo: as suas caçadas em cima, na ordem em que você
as guardou, e abaixo o resto do mapa por mundo e nível. Cada linha diz `Lv 155 · Johto`. O campo de
filtro estreita por nome, por região ou por nível, e ignora acentos — quem escreve "lendarias" quer
achar "Ilhas Lendárias". O `↻` relê a lista; ela relê-se sozinha de 24 em 24 horas, porque é uma
**cópia** da verdade do jogo e não a verdade: entra uma região nova, muda um nível.

Desenham-se **quarenta linhas** de cada vez. Não é para esconder: cada linha carrega um select de
times, e quatrocentos selects reconstruídos a cada repintura para mostrar os vinte que caberiam na
tela é um painel que trava. O rodapé diz quantas ficaram de fora, e o filtro alcança qualquer uma.

Escolher um time numa caçada **guarda-a** nos seus atalhos — dizer "aqui eu monto o time X" é
precisamente o que distingue uma caçada que você usa de uma que está no mapa. O ✕ só aparece nas
suas; o que veio da lista do jogo nunca foi guardado, e não há o que apagar. E uma região trancada
para a sua conta (as Ilhas Lendárias, até o treinador chegar lá) vem com o `Ir` apagado em vez de
falhar depois de tentar.

#### O UUID era o endereço, e ninguém sabia

A caçada em curso mostra, por região, uma coisa como
`ee6523e1-88ec-4d67-bf21-d83e23222518 · Modo plataforma` — e esse UUID é o `id` do mundo **Johto**.
A "região" que parecia lixo guardado era a chave certa para uma tabela que não existia. Agora
existe: o `label` de cada mundo é exatamente o texto da aba da janela, e a aba de cada caçada
deixou de ser adivinhada. Meia linha de UUID, essa, não volta a aparecer na etiqueta — nunca disse
nada a ninguém.

#### Nome repetido desempata pelo nível

Nos 377 registros há **um** nome repetido: "Nidorina" existe duas vezes em Kanto, Lv 10 e Lv 37. O
nome continua a ser a chave — é o único elo entre as duas telas —, e com o nome só ir para a de
Lv 37 levava à de Lv 10 **em silêncio**. A linha da lista do jogo traz o nome exato num `strong` e
uma célula que lê "Nv. 37", e é por ela que se desempata. Um atalho guardado antes desta versão não
tem nível nenhum, e esse casa com qualquer um — que é o comportamento antigo, não uma regressão.

#### A ponte lê, e não entra

`Api.prepareHunt(zoneId)` e `Nav.goToHunt(mapId)` existem, e levariam direto a qualquer caçada sem
abrir janela nem varrer abas. Ficam de fora de propósito. Ler a lista não mexe em nada; **entrar** é
a ação que mexe no jogo de quem joga, e ela continua a passar pelo caminho que você vê na tela, com
o mesmo botão "Caçar" que você clicaria. A ponte do pacote faz uma coisa só, e essa coisa é ler.

### A aba certa aprende-se, porque o jogo não diz qual é

A janela das caçadas reabre na última região usada, e a lista só desenha a aba aberta — procurar
uma caçada de Kanto com a janela em Johto não acha nada. A região que o jogo guarda no atalho
parecia resolver, e não resolve: medido na conta real em 12/10/2026, **seis dos nove atalhos tinham
por região um UUID** e um tinha "legendary". Nenhum deles casa com o texto de uma aba.

Então varria-se tudo, e a varredura — que estava escrita como excepção — era o caminho normal: com
a janela em Johto, achar a "Togetic" levou **45 segundos**, o painel ficou a dizer "Abrindo as
caçadas…" o tempo todo, e de fora isso é uma ferramenta travada.

Agora paga-se uma vez: achada a caçada, guarda-se **a aba onde ela estava**, e a ida seguinte vai
direta. A varredura fica como rede — uma caçada pode mudar de lugar, e o jogo também não avisa
disso. É a única coisa que a ferramenta escreve sozinha no atalho; nome, time e modo continuam a
ser escolha de quem joga.

Com o catálogo, a aba já vem do jogo para as 377 caçadas, e quase nenhuma ida precisa de aprender
nada. A aba aprendida continua a valer **mais** do que a do catálogo, e nessa ordem: ela foi medida
naquela conta, numa ida que funcionou.

### A expedição é um lugar, e não uma caçada

A Expedição Diária Cooperativa não aparece na janela das caçadas, não tem zona, entra-se nela por
um menu da barra de cima e **começar exige resolver um CAPTCHA**. Ou seja: é dele que ela depende,
não da ferramenta — e isso não se automatiza nem se tenta.

O que estava mal era outra coisa: lendo só a zona de caçada, estar na expedição era indistinguível
de "você não está em caçada nenhuma", e a Escada passava a tentar levá-lo para fora dela a cada
batida. Agora ela reconhece a expedição (pelo HUD da corrida), guarda-a como atalho para a
reconhecer, e o botão "Ir" dessa linha fica apagado — um botão que não pode funcionar não fica a
fingir que pode.

#### E no modo de degraus ela espera, em vez de insistir

Medido no jogo do dono em 12/10/2026, com ele **dentro** da expedição e o degrau de Lv 140 apontado
para "Togetic": o painel repetia *"Degrau 140 não deu: cliquei em Caçar e continuei em «Expedição
Diária Cooperativa»"*, batida após batida. Ela abria a janela das caçadas, clicava em Caçar, o jogo
recusava — e ela tentava outra vez.

A expedição já era respeitada, mas **só no modo de grupo**, pela lista de lugares: lá, estar na
expedição conta como estar onde o grupo fica. No modo de degraus essa lista nem é lida, e a única
regra era *"o líder não está na caçada do degrau"* — o que é verdade dentro da expedição e leva à
conclusão errada.

Agora, dentro dela, a escada de degraus **espera, e espera tudo**: não viaja, não troca de aluno,
não leva à enfermeira. A expedição dura duas horas a cada quatro, exige um CAPTCHA para entrar, e
você só está lá porque quis — arrastá-lo para fora é desfazer uma escolha sua. Acabada ela, o jogo
devolve-o à caçada anterior, e a batida seguinte continua de onde parou. Nada disso fica guardado:
o estado deriva do jogo, como em todo o resto da ferramenta.

A tela **"Expedição concluída"** entrou na lista do que sai da frente antes de qualquer acção. É um
painel com overlay que tapa tudo até alguém clicar em "Continuar", e o próprio jogo escreve lá: *ao
continuar, você volta para a sua caçada anterior*. Clicar não decide nada; não clicar é que deixava
tudo parado atrás de um vidro.

#### A expedição não se guarda: ela está sempre na lista

Guardar atalhos é para o que o jogador escolhe — ele entra numa caçada e diz "quero voltar aqui". A
expedição não é escolha dele: é uma coisa do jogo, sempre a mesma. Exigir que fosse guardada **de
dentro** era pior do que inútil, porque só se está dentro dela duas horas a cada quatro, e é
justamente **fora** dela que se quer dizê-la à Escada ("quando abrir, é ali que eu vou estar").

Por isso ela aparece sempre na lista, sem passar pelo armazém, e o ✕ dela não existe: o que é do
jogo não se esquece, estaria de volta na batida seguinte.

#### A janela é fixa, e o jogo diz que é aleatória

O lobby escreve "a próxima janela abre em um horário aleatório". É falso. As janelas são de duas em
duas horas, em hora de Brasília: **06:00, 10:00, 14:00, 18:00 e 22:00**, cada uma com duas horas.
Medido em 12/10/2026: a expedição acabou às 08:00 de Brasília e o lobby anunciou a seguinte para as
10:00 — as duas pontas da tabela.

O painel diz quando abre a próxima e quanto falta, no relógio de quem está a olhar. A conta é feita
sobre o **UTC**, nunca sobre o relógio da máquina: Brasília é UTC-3 o ano inteiro (o Brasil acabou
com o horário de verão em 2019) e quem joga da Europa muda de hora em outubro — uma tabela escrita
em hora local partia-se sozinha nesse domingo.

#### O grupo tem uma lista de lugares, em ordem

Por causa disto o modo de grupo deixou de ter *a* caçada e passou a ter uma **lista em ordem de
preferência**: ele fica na primeira onde conseguir estar. Estar na terceira basta — subir dali para
a primeira a cada batida seria trocar de caçada por nada, e cada troca custa a viagem e o risco de
um modal pelo meio. Só se viaja para onde a ferramenta consegue entrar, e por isso a expedição
nunca é destino.

O resultado é o que ele pediu: a expedição quando ele estiver no PC, e a caçada de sempre quando
não estiver.

### Um time por caçada

Cada atalho pode levar um time junto. O select fica na própria linha, e a troca acontece
**antes** de entrar: a caçada começa a lutar assim que você chega, e trocar a equipe com ela já
correndo seria lutar as primeiras batalhas com o time errado.

O time é **opcional** — a maior parte das caçadas se faz com a equipe que já está na tela, e
obrigar a escolher transformaria um atalho de um clique num formulário. Guardar a caçada outra vez
corrige a região e o modo mas **não apaga** o time: regravar é acertar o endereço, não desfazer a
configuração. E um time que deixou de existir no Times continua listado, marcado
*"(não existe mais)"*, em vez de sumir em silêncio.

A troca passa pela porta `PPX.times`, a mesma que o Ginásio usa — a lógica de troca mora num lugar
só, com os seus testes.

### Minimizado: onde estou, e as setas

O botão `–` recolhe o painel para uma etiqueta estreita com a caçada **em curso** e duas setas para
folhear as guardadas sem abrir a lista:

```
CAÇ                  □ ×
‹   Caça de Rattata  ›
você está aqui       Ir
```

A linha de baixo diz o que importa de cada uma: `você está aqui` em verde quando é a que está
correndo, `com o time "Hunt"` quando o atalho leva time, ou a região e o modo. O `Ir` leva até a que
está à mostra — e some quando ela já é a atual e não tem time para montar.

**Folhear é passageiro.** Se a caçada mudar no jogo, por sua mão ou por outro atalho, a etiqueta
volta a mostrar onde você está: minimizado, a primeira pergunta é essa, e a resposta tem de aparecer
sozinha. As setas dão a volta na lista em vez de parar nas pontas, e ficam apagadas quando há um só
atalho guardado.

A largura é fixa em 196px. Pelo conteúdo ela saltava de 176 para 184 pixels ao passar de uma caçada
para a seguinte — nome comprido agora corta com reticências.

A mensagem do que está acontecendo aparece ali também. O corpo do painel está escondido nesse
estado, e um `Ir` que não responde nada parece um botão quebrado.

### Por que o nome não se edita

Ao contrário dos Pokémon, que carregam `data-creature-id`, **as caçadas não têm identificador
nenhum no DOM** — nem a que está correndo, nem as linhas da lista. O único elo entre as duas telas
é o texto visível. O nome guardado não é um rótulo: é a chave de busca, e um apelido editável
quebraria a ida em silêncio.

### As três armadilhas do caminho

Todas já medidas noutras ferramentas deste pacote, e todas montadas na banca
(`testes/banca-cacadas.html?jogo=1`):

1. **A janela reabre na última região usada.** Procurar uma caçada de Hoenn numa aba de Kanto não
   acha nada — então a região é escolhida de propósito antes de procurar a linha.
2. **A lista chega depois da janela.** Quinta ocorrência desta lição: as abas da loja (~285 ms), a
   grade do inventário, os ginásios do mapa, o resumo do combate. Espera-se por ela, e a falha diz
   o que viu: *"não achei X entre as 4 caçadas de Hoenn"* ou *"a lista não chegou a aparecer"*.
3. **A barra de cima quebra com o ponteiro completo.** Ali vai `click()` cru; no resto, clique de
   gente, com o ponteiro chegando e hesitando antes.

Na banca, com as três ligadas ao mesmo tempo, o percurso foi:
*Abrindo as caçadas… → Indo para Hoenn… → Caçando em "Caça de Ralts".*

A ferramenta também abre a porta `PPX.cacadas` (`nomes`, `atual`, `ir`), igual à do Times — quem
chama recebe o resultado em vez de adivinhar lendo a tela.

### A janela que o jogo acha que está aberta

Medido em 11/10/2026, clicando três vezes seguidas no botão **Caçadas** da barra de cima:

```
clique 1 → CAÇADAS[largura=1482]   abre
clique 2 → CAÇADAS[largura=0]      fecha, e o painel FICA no documento
clique 3 → CAÇADAS[largura=1482]   abre
```

Até aqui o DOM acompanha — largura zero é janela fechada, e é por isso que *visível* aqui significa
*tem largura*, nunca `isConnected`. Mas na mesma sessão aconteceu o que desmente isso: depois de
aberta, **o jogo apagou o painel inteiro do documento sozinho**, e o clique seguinte não abriu nada
— do lado dele a janela continuava "aberta".

O estado de aberto/fechado do jogo **sobrevive ao painel deixar de existir**. Perguntar ao DOM se há
janela aberta responde a outra pergunta, e foi isso que produziu *"não consegui abrir a janela das
caçadas"* com o jogador vendo que ela abre num clique.

A saída não é adivinhar melhor: é não depender da adivinhação. Clica-se, espera-se, e se não
apareceu clica-se outra vez. Um clique perdido fechando o que já estava fechado não custa nada — o
que custava era desistir. Uma janela que **já está visível** continua intocada, porque aí o clique
fecharia justamente o que se queria aberto.

### Três coisas que impediam a ida, e o que se faz com cada uma

Medidas na conta real em 11/10/2026, todas com o mesmo sintoma — *"cliquei e não fui"*:

**1. O filtro fica sujo, e lista vazia parecia lista lenta.** Com `zubat` na busca e a faixa de
nível em 5–9, a lista fica com **zero** linhas. Até aqui isso era indistinguível de "a lista ainda
não pintou", e a ferramenta desistia dizendo a coisa errada. O filtro é do jogador e fica guardado
entre sessões, então chega sujo a quem automatiza. Agora o botão **Limpar** da própria janela é
clicado antes de qualquer leitura — ele apaga a busca e devolve a faixa de nível ao padrão daquela
aba (medido: 1–100 em Kanto, 100–2000 nas Ilhas Lendárias) e **não** mexe na aba aberta.

**2. A região guardada é uma pista, não um endereço.** Ela vem de `.platform-hunt__zone-meta`, que
diz o que o jogo quiser. Das quatro caçadas guardadas na conta real, as regiões eram `legendary`,
`hoenn` e **dois UUID**. Só `hoenn` casa com o texto de uma aba; `legendary` não é "Ilhas
Lendárias", e um UUID não é nada. Nesses casos a ferramenta ficava na aba em que a janela calhasse
de abrir e jurava que a caçada tinha sumido. Agora ela tenta a aba da pista e, não achando,
**varre as outras** — o que não está no DOM não é o que não existe: a lista desenha só a aba
aberta.

**3. O jogo troca os botões da barra de abas ao mudar de aba.** Depois de clicar, uma leitura nova
da barra mostra a aba certa com `is-active` — e o nó que se tinha na mão continua sem a classe,
porque foi substituído. A versão anterior esperava pela classe **no nó guardado**, nunca a via, e
por isso o clique de reserva disparava: **dois cliques por aba**, e um resultado que ninguém
conferia. Agora nenhum botão de aba é guardado: trabalha-se com os nomes e relê-se a barra a cada
pergunta.

**Mais duas, que só apareceram numa ida de verdade.** Montar o time guardado de uma caçada levou
**148 s** na conta real. Nesse tempo o jogo deu o jogador por ausente e, ao voltar, pôs o modal
**"A caçada continuou sem você"** por cima de tudo: a ida ficou parada ali, calada, até alguém
clicar à mão. O botão dele (`.hunt-absence-close`) entrou na lista de coisas a fechar — e a
varredura passou a fechar o que aparecer **a cada volta**, não só no início, porque este modal
nasce no meio. Quanto mais demorada a troca de time, mais provável ele é: não é azar, é o caso
normal da ida com time.

E depois do modal o jogo **recria o painel**. Guardar o elemento da janela numa variável, que era o
que se fazia, deixava um nó órfão: toda leitura devolvia o estado antigo, todo clique caía no
vazio, e nada reclamava — a ida varria abas que já não existiam e terminava dizendo "não achei".
Agora a janela é relida a cada pergunta, e uma janela que se fecha a meio é dita como tal em vez de
virar um "não achei".

**E mais duas, de uma ida completa.** A chegada era conferida por *"há alguma caçada a correr"* —
e quem já estava caçando responde que sim antes de o clique fazer efeito. Medido: a viagem de
"Caça de Azurill" para "Ilha Lendária de Entei" **chegou**, e a ferramenta deu-a por falhada ("o
jogo não me levou"). Agora espera-se pela caçada **certa**, e por 20 s em vez de 10 — entre o
clique e a caçada nova há um "PREPARANDO MAPA DE CAÇA…" que leva o seu tempo.

O botão da barra de cima **alterna**: com a janela já aberta — e ela fica aberta depois de uma ida
que não chegou a clicar em Caçar — o clique fechava-a, e a ida seguinte dizia "não consegui abrir
a janela das caçadas" com a janela a ter estado aberta o tempo todo. Agora só se clica se ela não
estiver aberta.

A prova contra o jogo, partindo de propósito do pior caso — aba Kanto, busca `zubat` (1 linha) e
região guardada `legendary`:

```
pista: nenhuma aba casa com "legendary"
Johto: linhas=92 achou=false
Ilhas Lendárias: linhas=19 achou=true
varridas: Kanto, Johto, Ilhas Lendárias
ACHOU em "Ilhas Lendárias", botão Caçar presente: true
```

## Escada de caçadas: trocar de caçada sozinha ao subir de nível

Um **degrau** é uma frase: *"a partir do nível N, caçar aqui"*. Você põe quantos quiser, escolhendo
entre **as 377 caçadas do jogo** — e é a ferramenta Caçadas quem viaja, com o time guardado daquela
caçada. A escada só decide **quando**.

O botão **Iniciar** liga o automático. Parada, ela não faz nada sozinha, mas o **▸** de cada degrau
continua levando você até lá num clique.

### A caçada de um degrau escolhe-se na lista do jogo, com filtro

Antes as opções de um degrau eram só as caçadas que você já tinha guardado. Mas um degrau é uma
questão de **nível**, e a caçada certa para o Lv 160 existe no jogo muito antes de alguém ter ido
até lá guardar o atalho: exigir o atalho primeiro fazia montar uma escada de dez degraus custar dez
viagens, e era por isso que as escadas ficavam curtas.

Agora cada campo de caçada oferece o catálogo inteiro, com o nível e a região em cada opção —
`Caça de Larvitar · Lv 160 · Johto`. E não é um menu de quatrocentas linhas para rolar com o rato:
é um campo com **filtro**. Clique para ver tudo, ou escreva um pedaço do nome para estreitar. Quem
escolhe lá uma caçada que nunca guardou não precisa de guardar nada — a Escada viaja igual.

A lista é **uma só** para o painel todo, e só se reconstrói quando a lista do jogo muda: são 377
nós, e o painel redesenha-se a cada batida.

Como é um campo de escrever, ele aceita qualquer coisa — então uma caçada que ninguém conhece fica
**marcada em vermelho** no próprio campo, com o motivo no `title`. Antes era um `select`, e um valor
órfão ficava lá escrito "(não guardada)"; é a mesma honestidade no campo que o substituiu, em vez de
descobrir o erro de digitação só na viagem, a dizer "não achei em nenhuma aba".

### A equipe pode subir junta, de N em N níveis

Sem isto, a escada é um aluno de cada vez do princípio ao fim: o primeiro da equipe vai do Lv 1 ao
teto enquanto os outros cinco esperam no Lv 1. É o que se quer quando há um só a formar — e não é o
que se quer quando a equipe toda tem de subir.

Por isso, debaixo do **formar em Lv** há um **subindo N níveis por vez**. Com ele, o degrau de agora
deixa de ser o teto e passa a ser o nível mais baixo da equipe mais N: com 145/145/145, teto 155 e
passo 10, todos vão ao 155; com passo 2, vão ao 147, depois 149, e assim até o 155. Cada um sobe até
o degrau de agora e passa a vez ao seguinte, e quando o último chega a conta anda outro passo.

**O teto continua a ser um fim, e isso é a parte que importa.** O degrau de agora nunca passa do
número que você escreveu — e é por essa linha que a fila de times existe: chegada a equipe inteira
ao teto, todos estão formados, o *"formados: ir à cidade e trocar de time"* acontece, e os outros
times entram. A primeira versão disto deixou o degrau fugir para sempre; ninguém se formava nunca, o
fim da escada não acontecia uma única vez, e a fila de times sumiu do painel. Durou uma hora, e foi
o dono quem a apanhou: *"não encontro onde colocar os outros times"*.

**Não há contador de rodadas, e é de propósito.** O modo de grupo guarda um, porque lá o alvo não
está escrito em lugar nenhum do jogo. Aqui está: o degrau de agora sai do **menor nível da equipe**,
e o jogo diz o nível de cada um. Um contador ao lado seria uma segunda verdade sobre a mesma coisa,
pronta a divergir no primeiro F5 — e, pior, a ficar errada no dia em que você metesse um Lv 1 na
equipe. Derivado, esse Lv 1 puxa a conta para baixo e é ele o próximo aluno, que é exatamente o que
se quer.

### Um campo no meio de um rótulo não estica

Os dois números deste par nasceram na mesma linha — *"formar em Lv [ ] e mais [ ] níveis"* —, e no
painel do dono ela partiu-se em três: o campo esticou, o "formar em Lv" caiu para duas linhas e o "e
mais" ficou órfão. Um `input` dentro de um flex cresce até caber o que sobra, e 248px não chegam
para duas palavras, dois campos e mais duas palavras.

São duas regras agora, com teste de guarda: todo campo de número dentro de um rótulo tem **largura
fixa e não cresce**, e o rótulo pode **quebrar linha** em vez de empurrar as palavras para fora.

### O grupo não arrasta ninguém para uma caçada onde não consegue trabalhar

Medido numa segunda conta do dono em 12/10/2026: o Pokémon da pedra já não estava na coleção
daquela conta e um dos times não existia lá — e mesmo assim a escada o tirou da "Caça de Kirlia" e
o levou para a "Caça de Gardevoir", para só então descobrir que não tinha grupo nenhum para montar.

A causa era a ordem. A viagem vinha antes da leitura da coleção, então a única coisa conferida antes
de andar era se havia caçada na lista e turno configurado — e não se o trabalho era possível.
Agora a coleção lê-se primeiro. Não custa nada (é a mesma leitura que já se fazia a seguir, só
mudou de lugar, e ler a coleção não mexe em nada no jogo) e muda o pior resultado possível pelo
melhor: **ficar parado e dizer o que falta**, em vez de atravessar o mapa para um trabalho que não
vai acontecer.

E um time que não existe nesta conta deixou de passar por time. É o que acontece a quem leva a
configuração de uma janela para outra: os nomes viajam no arquivo, os times ficam na conta de
origem. O painel já marcava *"(não guardado)"* na lista; faltava recusar correr com ele.

### O nível que importa é o do pokémon, não o do treinador

São dois números diferentes no mesmo HUD, e confundi-los faria a escada disparar o degrau errado
desde o primeiro minuto:

- `.pokeidle-trainer-hud__level` diz *"Nível 260"* — é o **treinador**;
- `.pokeidle-team-card__level` diz *"Nv.229"* — é **cada pokémon** da equipe.

Quem sobe de degrau é o pokémon ativo, e quem é o ativo não se adivinha pela posição na fila: o
jogo marca a caixa dele com `is-leader`. Ele até vai para a frente ao trocar, mas uma coisa que o
jogo afirma vale mais do que a mesma coisa deduzida.

### A espera de 3 segundos, e por que ela não é um erro

Medido em 11/10/2026: depois de trocar o pokémon ativo, o jogo põe **3 segundos** de espera nas
outras caixas e **recusa o clique calado** dentro dela — não troca, não avisa, e o clique *não fica
em fila*. Passada a espera, continua tudo como estava.

A ferramenta lê essa espera no `title` da própria caixa (*"Aguarde 3s para trocar de Pokémon
ativo"*) e simplesmente espera. Tratar isso como falha custaria dois minutos de castigo por três
segundos de espera.

E depois do clique ela **confere o HUD**, pelo `data-creature-id`, em vez de confiar no clique: a
troca levou 602 ms a aparecer, então não se cronometra — espreita-se de 150 em 150 ms até 3 s.

### Formatura: trocar de aluno quando ele chega ao teto

O campo **formar em Lv** é opcional. Com ele preenchido, quem passa do teto sai da fila e o próximo
da equipe que ainda não se formou vai para a frente.

Duas regras que não são óbvias:

- **a escada nunca desce com o mesmo aluno.** Um degrau abaixo do que já foi cumprido com aquele
  pokémon não é progresso — é um nível mal lido ou um degrau editado, e o castigo seria arrastar um
  Lv 19 para a caçada dos Lv 1;
- **trocar de aluno recomeça a contagem.** O degrau cumprido era do anterior, e quase sempre um
  degrau alto: guardá-lo mandaria o bicho de Lv 1 caçar onde o de Lv 229 caçava.

### Primeiro a viagem, só depois a troca — e o que custou descobrir isso

Ela fazia ao contrário, e o defeito foi medido no jogo logado em **11/10/2026**, com o rastro
inteiro guardado:

```
21:22:39  Scyther chegou ao teto. Pondo Ralts Lv 1 na frente.   → o líder já é Ralts
21:22:39  Lv 1: indo para "Magikarp".                            ← a viagem só começa agora
21:22:44  líder: Jolteon Nv.152                                  ← o Ralts morreu em 5 s
21:26:11  Cliquei em Ralts no HUD e quem continua à frente é Jolteon.
```

O Ralts Lv 1 foi posto à frente **dentro** da caçada de Nidorina, que era a caçada do pokémon que
acabara de se formar. Morreu em cinco segundos. O jogo promoveu outro da equipe, e a escada ficou em
laço a tentar pôr um morto à frente — ninguém subiu de nível nunca mais.

**A raiz não era a ordem: era o degrau ser escolhido pelo nível de quem está à frente.** Assim, a
escada era obrigada a trocar primeiro para só depois saber para onde ir. Com o degrau escolhido pelo
nível do **aluno**, sabe-se o destino antes de trocar — e a ordem certa cai por si:

1. **a enfermeira**, se o aluno estiver derrotado;
2. **a viagem**, com quem está à frente agora, que é o aluno anterior, forte;
3. **a troca**, já na caçada certa.

Uma consequência que parece restrição e é proteção: **ela não troca de aluno fora da caçada do
degrau**. Se você saiu de lá à mão, pôr o aluno fraco à frente onde você está é exatamente a morte
que esta ordem veio evitar — então ela diz isso e espera.

E a caixa lida antes da viagem não serve depois dela: a caçada guardada monta a equipe inteira e o
jogo redesenha o HUD, deixando o elemento antigo órfão. A escada lê a equipe outra vez, pelo
`data-creature-id`, antes de clicar.

### A enfermeira: o derrotado vai à cidade e volta

O jogo marca o derrotado com `is-fainted` e `title="Pokémon derrotado"`, e **recusa o clique nele tão
calado** como recusa dentro da espera de 3 s. Um morto não sobe de nível e não vai para a frente —
sem este passo a escada fica em laço, que foi o que ela fez.

A cura são três ações **em ordem**, e a ordem foi medida: chamando `healTeam()` sozinho, com a caçada
a correr, o servidor curou — devolveu HP cheio em todos — **e o HUD continuou dizendo "Pokémon
derrotado"**. A caçada guarda o próprio estado de combate. Então:

**parar a caçada → ir para a cidade → curar**, que é o caminho que você faria a pé até a enfermeira.

Ela nunca usa `reviveHunt`, que também ressuscita e **gasta um item seu**. A enfermeira é de graça;
gastar o seu inventário para poupar um passo seria decidir por você uma coisa que é sua.

Duas coisas que a banca pegou e que o código sozinho não mostrava:

- **depois de curar, ela volta.** A cura tira da caçada, então o degrau cumprido deixa de valer — a
  regra que respeita você ("saiu de lá, fique à vontade") não sabe distinguir você saindo da própria
  escada saindo para curar. Quem saiu foi ela, então é ela que volta;
- **o gatilho dela não bastava.** A peneira do observador era só o nível do líder, e a morte não muda
  nível nenhum — pior, um morto não ganha experiência, então o nível **nunca** mudaria. A assinatura
  agora leva quem está na equipe, em que nível, quem está à frente e quem está morto. Pontos de vida
  continuam de fora, que é o que a mantém barata.

### Toda espera marca a própria volta

Esta é a armadilha mais cara desta ferramenta, e apareceu três vezes em lugares diferentes antes de
ser entendida como uma só.

O gatilho da escada é o **HUD mudar** — não um relógio, de propósito, porque com a aba em segundo
plano um `setInterval` cai para uma volta por minuto. Isso basta enquanto quem mexe no HUD é o jogo.
Mas quando ela própria age, e o resultado é *esperar*, não sobra ninguém para acordá-la:

- **o jogo pediu 3 segundos entre trocas.** Medido no jogo logado: ela guardou a espera, devolveu o
  controle ao observador, e congelou **dois minutos e meio** em *"Tento de novo em 3s"* — parada na
  mesma caçada, com o mesmo líder, nada no HUD muda: nível igual, ninguém morre, ninguém troca;
- **depois de curar**, na cidade parada, idem;
- **depois do castigo** de uma viagem falhada, idem.

Guardar uma espera sem marcar a volta é prometer voltar e não voltar. Toda espera passa por um lugar
só, que agenda **uma** batida para quando ela acabar. Continua não sendo um relógio: é terminar o
próprio movimento, uma vez, por conta de uma ação que foi dela.

E a frase da espera é neutra — *"Esperando 3s para tentar de novo"* — porque por ela passam tanto o
castigo de uma viagem que falhou quanto um pedido de espera do jogo. Chamar o segundo de "tentativa
que não deu" seria mentir; o motivo verdadeiro já foi dito no momento em que aconteceu.

### Dois modos de upar, e só um corre

A listbox no topo do painel escolhe **como** ela upa:

| Modo | O que faz |
| --- | --- |
| escada de caçadas | um aluno de cada vez à frente, viajando os degraus (o resto desta secção) |
| grupo até o nível X | um Pokémon fixo com a pedra da XP e os outros a rodar, até um nível |
| grupo subindo de N em N | o mesmo, mas o alvo sobe sozinho a cada rodada fechada |

É uma escolha e não três interruptores de propósito: os três mexem na **mesma** equipe e na **mesma**
caçada, e dois a correr tirariam da equipe o que o outro acabou de pôr.

### O modo de grupo: um fixo, cinco a rodar

A pedra da XP divide o que o Pokémon ativo ganha com o resto da equipe. Então o jeito de upar muitos
Pokémon é ter **um fixo** — quem tem a pedra, e que nunca sai — e trocar os outros cinco à medida que
cada um chega onde você quer.

Você escolhe: a **caçada** onde se fica, o **fixo**, os **times** de onde vêm os que rodam, e o nível
em que eles saem do grupo. Quem chega ao alvo sai; quem ainda falta entra no lugar. Quando não falta
mais ninguém, ficam todos fora e ela **continua a farmar** com o fixo — o que você pediu: "ficam fora
do grupo até eu olhar e mudar".

No modo `subindo de N em N`, o alvo de cada rodada é **mínimo + N × rodada**. Com o seu exemplo —
três Pokémon em Lv 10, 13 e 16, mínimo 20 e 5 níveis — as rodadas são **25, 30, 35**: o mínimo é o
chão de onde se parte, não o primeiro alvo. Fechada a rodada (todos no alvo), ela sobe o alvo e
recomeça do primeiro.

#### Três regras que vêm do jogo, não desta ferramenta

- **A equipe trava em 6**, então é o fixo mais cinco.
- **Espécie não repete na equipe**: o jogo recusa calado. Um rodante da espécie de alguém que já está
  no grupo é **saltado** em vez de tentado, e o painel diz quantos saltou. Ele volta à vez quando o
  outro da mesma espécie sair.
- **O Pokémon ativo não pode ser removido**, por isso o fixo vai como líder: pôr a liderança em quem
  roda daria uma troca travada a cada volta.

#### Uma pedra de cada vez: o rodízio

Cada pedra da XP só divide com Pokémon da sua região — hoje há a de Kanto e a de Johto — e **só o
Pokémon ativo divide**, medido pelo dono em 12/10/2026. Essas duas coisas juntas decidem o desenho:
duas pedras na equipe ao mesmo tempo seriam um slot gasto à toa, porque só uma delas estaria a
trabalhar. Elas têm de se revezar.

Por isso o modo de grupo tem **turnos**, em ordem: cada turno é uma pedra com os seus times. Corre o
primeiro que ainda tenha alguém abaixo do alvo; acabado esse, entra o seguinte; acabados todos, a
rodada fecha e tudo recomeça do primeiro com o alvo novo. O alvo é o mesmo para todas as pedras.

**Qual turno está a correr não se guarda.** O nível dos Pokémon já diz — guardar "vai no turno 2"
seria uma segunda verdade, pronta a mentir depois de um F5 ou de uma troca feita à mão. É a mesma
regra que já valia para "quem já upou".

A **região não é conferida**, e de propósito: quem diz qual Pokémon pertence a qual pedra é o dono,
ao pôr os times certos no turno certo. Adivinhar a região pelo `species_id` seria apostar que o jogo
numera como a Pokédex nacional, e isso não foi medido. E enganar-se custa XP perdida, não estraga
nada: quem não é da região apenas não recebe.

A pedra de um turno escolhe-se entre **a equipe de agora e os Pokémon dos times desse turno**. Só a
equipe não chegava: a pedra do segundo turno costuma estar na mochila enquanto o primeiro corre, e
era justamente aí que ela tinha de ser escolhida. A coleção inteira também não serve — 223 linhas
não são uma escolha, são uma busca.

#### Quem fica no grupo é uma composição, não uma fila de entradas e saídas

A cada batida calcula-se do zero quem deveria estar no grupo — o fixo mais os que ainda não chegaram
ao alvo — e a troca é a **diferença** entre isso e o HUD. Pensar em "quem entra no lugar de quem"
exigiria guardar de quem era cada vaga, e um F5 no meio deixaria essa conta a mentir.

Pelo mesmo motivo **não há lista de "já upados"**: o nível do Pokémon já diz. Uma lista ao lado seria
uma segunda verdade sobre a mesma coisa, pronta a divergir. O único estado que este modo guarda é
quantas rodadas de `N em N` já fecharam, e é porque isso o jogo não tem.

Quem mexe na equipe é a ferramenta **Times**, pela porta `montar`: ela conhece as três regras acima,
replaneja contra o HUD a cada passo e já custou um Pokémon de time para ficar assim. Uma segunda
rotina de equipar, pela API da página, divergiria dela no primeiro mês.

O nível de quem **não** está na equipe vem da API do jogo (`getCreatures`), pela ponte — 223 Pokémon
na conta real, sem abrir janela nenhuma. Abrir janelas é a operação que mais falha no jogo.

#### Pausar não é parar, e este modo é sempre o último da fila

**Parar** esquece o que ia fazer. **Pausar** guarda o lugar: a rodada, a fila e o degrau cumprido
ficam, a caçada continua a correr, e ela é que não mexe em nada. São dois botões porque são duas
coisas, e quem pausa a noite inteira não quer perder a rodada por clicar no errado.

E o modo de grupo **cede a vez a qualquer outra ferramenta**: se alguém está com a vez — ou só à
espera dela — ele para e diz por quem espera. Não entra na fila, porque entrar na fila é disputar: o
Ginásio do dia ficaria atrás de uma troca de equipe de 30 segundos que ninguém tinha pressa de fazer.

Quem cede tem de ser acordado, e isso custou um defeito em cada ferramenta desta família: o gatilho
normal é o HUD mudar, e quem está a ceder não mexe no HUD — a ferramenta à frente pode nem mexer. Por
isso ele ouve `PPX.vez.aoMudar` e volta quando a fila esvazia.

### O fim da escada: quatro saídas, e todas são sua escolha

Quando a equipe inteira passa do teto, não há mais aluno. O que acontece aí é você quem decide:

| Escolha | O que ela faz |
| --- | --- |
| ficar onde estiver | nada — e diz que é isso que está escolhido |
| ir para uma caçada | viaja para a caçada escolhida e para ali |
| trocar de time | volta para a cidade, monta lá o time seguinte da fila e recomeça a escada com quem chegou |
| voltar para a cidade | para a caçada, volta para a cidade e cura a equipe |

Trocar de time esquece o aluno e o degrau cumprido de propósito: a equipe é outra, e guardá-los
mandaria um bicho novo de Lv 1 para a caçada do Lv 200 que saiu.

#### A fila de times: formado o 1, passa ao 2, depois ao 3

Pedido em **12/10/2026**. O fim "trocar de time" não recebe um time, recebe uma **fila**: a escada
sobe o time 1 até o teto, troca para o 2 e sobe esse, troca para o 3 e sobe esse. Quando o último se
forma, ela **pergunta o que fazer** (ver abaixo) — voltar ao primeiro por conta própria seria
desfazer o trabalho todo e montar time atrás de time para sempre, a 20-30 segundos cada.

Um time da fila que já esteja todo acima do teto não para nada: ela monta-o, vê que não há aluno e
passa ao seguinte, gastando os 20-30 segundos da montagem.

A fila é uma lista no painel, com a forma dos degraus (`+ time`, `×`), e a linha do time que vem a
seguir fica marcada.

**A fila não guarda contador de onde está, e essa é a decisão que importa.** Quem diz em que ponto
da fila se está é a equipe que está na tela: os **Times** sabem dizer qual dos times guardados está
montado, comparando por id — nem a ordem nem o líder contam, porque a escada troca o líder a cada
aluno. Um índice em `localStorage` teria três formas de mentir — o F5, uma troca de time à mão, uma
reordenação da lista — e cada uma delas mandaria montar o time errado por cima do trabalho feito.

Sem essa porta ela **não adivinha**: diz que não sabe em que ponto da fila está e não monta. Montar
"o primeiro" por desencargo seria o laço de ontem com mais passos — monta o 1, ele já está formado,
chega-se ao fim, monta o 1 de novo.

E depois de montar, ela **confere**: se a equipe na tela não for o time pedido, para e diz. Os Times
já relataram sucesso com um time que não montaram, e aqui isso custaria mais do que um aviso errado
— a fila anda pelo time montado, então um time meio montado faria a escada perder o lugar na fila.

#### Acabada a fila, ela pergunta — e espera

Pedido em **12/10/2026**, e é o **único estado desta ferramenta em que ela espera por você**. Acabada
a fila, aparece uma listbox no painel com as quatro respostas que ela sabe cumprir:

| Resposta | O que ela faz |
| --- | --- |
| fico aqui, caçando | nada — a equipe formada continua onde está |
| volto para a cidade e curo | para a caçada, volta para a cidade, passa pela enfermeira |
| recomeço a fila de times | monta o primeiro time da fila, e a escada segue daí sozinha |
| paro a escada | desliga-se; o ▸ de cada degrau continua a funcionar |

Por que não é uma quinta opção do "formados:"? Porque as outras quatro escolhem-se **antes**, de
noite, para ela cumprir sozinha. Esta faz-se **depois**, com a equipe toda formada na tela — e nessa
hora o que você quer depende do que aconteceu.

Três detalhes que custaram uma medição cada:

- **Quem age é a resposta, não a batida.** Uma acção guardada para "a próxima batida" seria refeita
  em cada batida, e voltar para a cidade três vezes não é voltar uma vez.
- **A pergunta é nova a cada volta.** Guardar a resposta de ontem seria responder por você.
- **O painel minimizado abre-se, uma vez.** Minimizado, o corpo do painel está escondido e a
  listbox com ele: ficaria a dizer "escolha aí embaixo" sem haver embaixo. Abre uma vez por
  pergunta; minimize outra vez à vontade, que ela não insiste.

#### Um "já cumpri" de ontem não trava a fila

`formados` existe para ela não arrastar a equipe de volta ao fim que já cumpriu. Na fila de times
isso **travava tudo**, e de duas maneiras, as duas medidas na banca em 12/10/2026: um "já cumpri" de
uma volta anterior deixava a fila a repetir "falta montar o 1º de 3" sem nunca montar; e montar um
time do meio da fila marcava o fim como cumprido, então um time que já chegasse todo ao teto parava
a escada em vez de a fazer passar ao seguinte.

Na fila, quem diz se há trabalho por fazer é a própria fila, pelo time que está montado. Quem para é
o fim dela, e mais nada.

#### A troca de time passa pela cidade, e só lá troca

Pedido em **12/10/2026**, e é a mesma correção da ordem invertida da batida, um degrau acima. O time
que entra é de bichos novos — Lv 1, nos dois times que ele montou para medir isto. Trocar a equipe
inteira **dentro** da caçada é pôr três recém-nascidos no lugar de quem acabou de se formar, no
mesmo combate, contra o bicho que o formado estava a aguentar. Nenhuma espera resolve isso.

Então a ordem é: **para a caçada → cidade → monta o time → volta ao degrau do time novo.** A ida
ainda passa pela enfermeira, que é a mesma ponte da cura, e a escada marca a própria volta — parada
na cidade, com o HUD já mexido por ela mesma, mais nada a acordaria.

A vez da fila é pedida uma vez para o movimento inteiro, não uma por ação: a montagem demora 20-30
segundos, e os **Times** são uma peça que conta com quem chama já ter a vez. As três saídas que
agem no jogo passam pela fila; a quarta não age.

#### "Trocar de time" exige caçadas sem time guardado

As duas regras se atropelam, e o atropelo dava laço. Medido no seu jogo em **12/10/2026**:

```
fim da escada → monta o time "novo" (com o Dratini Lv 1)   ✓
a escada reinicia e viaja para o degrau de Lv 1
a viagem monta o time guardado NA CAÇADA, que era "Hunt"   ← apaga o "novo"
ninguém tem nível para subir → a escada chega ao fim de novo → monta "novo" outra vez
```

Para sempre, a 20-30 segundos de montagem e uma viagem por volta.

A regra atropelada já estava escrita e continua valendo: **`PPX.cacadas.ir` monta sempre o time
guardado na própria caçada**. A saída não é a escada passar a mandar no time também — seriam duas
donas da mesma coisa, divergindo no primeiro dia. A saída é recusar **antes** de agir, porque dá
para saber antes:

> O time "novo" não ia durar: a caçada "Magikarp" do degrau de Lv 1 monta o time "Hunt" ao chegar e
> apagaria o meu. Tire o time dessa caçada nas Caçadas.

Então, para usar **trocar de time**, as caçadas dos degraus têm de estar guardadas **sem time** —
é o seletor de time de cada linha no painel das Caçadas, na opção vazia. Aí a viagem não mexe na
equipe, e o time que a escada montou no fim sobrevive ao recomeço.

### Ela diz o que está esperando

Automação parada e calada é indistinguível de automação quebrada. Cada impasse tem uma frase com o
sujeito, o que falta e como sair dele — *"Tyranitar está no Lv 229, abaixo do primeiro degrau (Lv
250). Ponha um degrau em Lv 1 para começar já."*

A caixa **deixar trocar de caçada** separa duas perguntas que parecem uma: a escada pode estar
correndo — formando o aluno, dizendo em que degrau ele deveria estar — sem ter licença para
arrastar você para outro mapa.

### O painel rola

Com nove degraus, dois times na fila e o bloco do fim, este painel passa da altura da tela e o
`+ time` fica abaixo do rodapé do monitor. O **corpo** rola; o título, o resumo e os botões de
comando ficam parados, onde a mão já os procura.

O teto escrito no CSS é só o chão — ele supõe o painel no lugar de sempre. Quem manda é uma medida
feita de onde o corpo **está** na tela, refeita a cada desenho, a cada arrasto e a cada mudança de
tamanho da janela: o painel arrasta-se, e um número fixo deixaria passar do rodapé quem o tivesse
posto mais abaixo.

### Minimizada, os comandos ficam

Minimizada, a Escada é uma etiqueta com o alvo e a frase do que está acontecendo — e, **debaixo
dela, os dois botões**: `Iniciar`/`Parar` e `Pausar`/`Retomar`.

Eles não são uma cópia. O que o `–` esconde é o **corpo** do painel, e os botões simplesmente
deixaram de morar lá dentro: são os mesmos, com os mesmos cliques, um nível acima na marcação. Uma
segunda cópia seria uma segunda verdade — dois botões a dizer coisas diferentes sobre o mesmo
estado no dia em que um deles deixasse de ser repintado.

Minimizada é como ela vive: quem a minimiza quer o jogo à vista, e mandar abrir tudo para parar
uma escada desfaz o motivo de a ter minimizado.

### O que ela não faz

No pacote do Poke Idle World cada degrau escolhe um time. Aqui não: `PPX.cacadas.ir` monta sempre o
time guardado **na própria caçada**. Duas formas de escolher o time para a mesma viagem seriam duas
verdades divergindo no primeiro dia — quem quer time diferente por degrau guarda a caçada duas
vezes.

**Nada do que ela lê vem do mundo da página.** `PokeIdle.TeamLeaderCooldown.remainingMs()` seria o
caminho óbvio para a espera, e custaria uma ponte. O `title` da caixa traz a mesma informação deste
lado, e o mesmo vale para o morto.

Há **uma** ponte (`escada-main.js`, em `world: MAIN`), e é só para a enfermeira: curar não é uma
leitura, são três ações do jogo em ordem, e nenhuma delas tem botão que a ferramenta consiga achar e
clicar com honestidade. Ela só **age**, e só nisso.

## Agenda: toda semana, todo mês, ou um dia por mês

As automações sempre souberam duas formas de marcar hora: **a cada tantos minutos** e **uma vez
entre tais horários**. Agora a agenda inteira vive atrás de um botão que mostra o que já ficou
combinado:

```
[Parar · 24d 0h] vender   última sexta do mês · 20:00-21:00   ▾
```

Clicando nele, a parte de configurar abre — e tudo o que ela pede é escolher em listas:

| repetir | o que aparece |
| --- | --- |
| todo dia | nada mais: é o que já era |
| dias da semana | a lista dos sete, marque quantos quiser |
| dias do mês | a lista de 1 a 31, mais **último dia** |
| um dia por mês | *primeira / segunda / terceira / quarta / última* + o dia da semana |

"Uma vez por semana" é um dia marcado na lista; "vários dias na semana" são vários. Fechada, a
agenda volta a ser uma linha de texto que diz o combinado.

### Fechada por padrão, e por isso pode ser larga

A primeira versão disto pedia os dias num campo de texto — `última sexta`, `1, 15` — e o argumento
era o espaço: três painéis apertados não cabem sete caixinhas e dois seletores.

O argumento caiu quando a parte passou a ficar **fechada**. Quem configura uma agenda o faz poucas
vezes por ano; quem a lê, lê todo dia. Decorar uma sintaxe para usar três vezes por ano é o pior dos
dois mundos — e, com a configuração escondida atrás de um botão, não havia mais nada a economizar.

O texto continua sendo o formato guardado, só que agora quem o escreve são as listas. Isso tem uma
consequência boa: **o calendário não mudou nada**, os testes de mesa continuam valendo, e quem já
tinha escrito à mão não perde nada — as listas leem de volta. Uma mistura que as listas não sabem
representar (`seg, 15`, escrito à mão numa versão anterior) não é sobrescrita: apagar em silêncio o
que a pessoa montou seria pior do que não oferecer o controle.

O campo de horários continua sendo texto, como sempre foi: `20:00-21:00`, e aceita mais de uma
janela por vírgula.

### O calendário é um só

As três ferramentas tinham a leitura de horários copiada linha por linha, uma da outra. Acrescentar
semana e mês em três cópias seria acrescentar o mesmo defeito em três lugares e corrigi-lo em dois.
Agora a conta inteira mora em `agenda.js`, e as funções são puras de propósito — é o que permite
exercitar virada de mês, ano bissexto e "dia 31" em `testes/agenda.test.mjs`, em vez de esperar o
calendário chegar lá para descobrir.

### As decisões que custaram pensar

**O dia que o mês não tem simplesmente não acontece.** `31` não existe em novembro nem em
fevereiro. Arrastar para o dia 1 seguinte seria agir num dia que ninguém pediu; recuar para o 30
seria o mesmo. Quem quer dizer "o fim do mês" escreve `último`.

**A última não é a quinta.** Um mês tem quatro ou cinco sextas. `última sexta` é a última de cada
mês, não um número fixo que às vezes não existe.

**O que não foi entendido fica marcado, e o relógio não liga.** Com as listas isto deixou de
acontecer — elas só escrevem o que o calendário entende —, mas a defesa ficou de pé para quem tem
texto de uma versão anterior. A primeira versão ignorava o pedaço ruim e, sem nenhuma regra válida,
"todo dia" era o resultado: quem escrevesse `última quarta` com um engano teria a automação rodando
**trinta vezes por mês** em vez de uma. Não agir é recuperável; agir trinta vezes não é.

**Ocorrência perdida fica perdida.** Computador desligado na segunda à noite: ao ligar na terça, a
automação não dispara "o que ficou devendo". Ela espera a próxima segunda. Disparar o atrasado seria
agir numa hora que ninguém escolheu, que é justamente o que estas janelas evitam.

**A distância passou a ser dita em dias.** Com `última sexta`, o botão mostrava
*"Parar · 576:29:43"* — isso não é um relógio, é um número. Acima de um dia conta-se em dias, e a
data aparece quando deixa de ser óbvia: *"30/10 às 20:43"*. O ginásio tinha o mesmo problema ao
contrário — dizia *"amanhã"* para qualquer coisa que não fosse hoje, inclusive para daqui a três
semanas.

Quem já tem uma agenda montada não perde nada: campo de dias vazio é todo dia, que é exatamente
como as três ferramentas se comportavam antes.

## A fila: uma ferramenta de cada vez

Três relógios automáticos vivem neste pacote — a venda, a compra e o ginásio. Até aqui cada
ferramenta só se protegia **de si mesma**: a venda não começava duas vendas, o ginásio não começava
dois ginásios, e nenhuma sabia que as outras existiam. Com três relógios no ar, o cruzamento não era
hipótese, era questão de tempo. E o pior deles é calado:

- o ginásio dá **dois F5** no meio da corrida. Uma venda a meio caminho morre ali sem dizer nada, e
  só volta a ser tentada no intervalo seguinte;
- o ginásio fecha os menus da barra de cima e as janelas abertas para conseguir abrir a dele. A
  janela que ele fecha pode ser a loja que a compra estava usando;
- venda e compra disputam a mesma loja do Mark, cada uma lendo uma mochila que a outra está mudando.

Agora há uma fila. Quem quer agir pede a vez, e espera a sua — em ordem de chegada. O painel que
espera diz por quem: *"Esperando o Ginásio do dia terminar…"*, porque um painel que espera é
indistinguível de um painel travado.

### Por que a vez mora na `sessionStorage`

Duas exigências ao mesmo tempo, e só ela atende as duas.

**Tem de atravessar o F5.** O ginásio recarrega a página de propósito, duas vezes por corrida, e a
vez tem de continuar sendo dele do outro lado — senão a venda entra entre a recarga e a retomada,
que é exatamente a fresta que a fila existe para fechar.

**Tem de ser por aba.** O LionMultInstance abre várias janelas do jogo ao mesmo tempo. Uma fila
guardada no `localStorage` seria compartilhada, e a instância A ficaria esperando pela B sem razão
nenhuma.

### E se alguém morrer segurando a vez

Quem está com ela bate de dois em dois segundos. Sem batida por 45 segundos, a vez é dada por
abandonada e a próxima entra. O número não é arbitrário: tem de ser maior que a recarga mais lenta
do ginásio — durante o F5 ninguém bate, e ele ainda espera a tela limpar, até 15 segundos. Curto
demais, a venda rouba a vez no meio da recarga; longo demais, um erro segura a fila.

Medido em `testes/banca-vez.html`, que atravessa um F5 de verdade — e que acusa a falha nos dois
sentidos: tirando a proteção da travessia, a banca diz *"é de: ninguém"* e uma venda nova entra no
meio da recarga.

## Levar a configuração para outra conta

A venda, a compra, a Arena e as **Caçadas** têm **Exportar** e **Importar** no rodapé. O mesmo jogo corre em várias
janelas do LionMultInstance, uma por conta, e cada janela tem o seu próprio armazenamento: deixar a
venda do jeito certo numa conta e repetir a mão em todas as outras — raridades, teto, lote, horários,
dias — é trabalho que ninguém quer fazer duas vezes, e é trabalho em que se erra. Exporta de uma,
importa nas outras. De quebra, é a única cópia de segurança que estas configurações têm.

O arquivo é um JSON com a data no nome: `venda-rapida-config-2026-10-06.json`. Se o navegador
recusar o download, a configuração vai para a área de transferência, que entre duas janelas do
LionMultInstance serve igual.

### O que viaja, e o que fica

Viaja o que **você** escolheu: as raridades marcadas, o teto, o lote, as caixinhas, o modo e a
agenda; na compra, os alvos de cada item e a variação.

Fica o que a extensão descobriu sozinha — o catálogo da loja, o estoque, o saldo, a contagem da
última lista. São retratos do jogo **daquela** conta, e levar o retrato de uma para a outra seria
mostrar números que não são dela. A próxima atualização da mochila os refaz.

E fica o carimbo da última rodada. Ele é estado do relógio, não configuração: importá-lo faria a
janela de hoje passar por já usada, e a rodada de hoje simplesmente não aconteceria — sem erro
nenhum na tela.

### Nas Caçadas, o que viaja são os atalhos

Viaja a lista que você guardou: nome, nível, aba, região, modo, tipo e o time de cada atalho. Era
exatamente para isto que a lista inteira do jogo passou a ser lida — guardar nove atalhos à mão numa
conta nova são nove viagens pelo mapa.

Fica o **catálogo**: ele é o retrato que a extensão tirou do jogo, não escolha de ninguém, e cada
janela relê o seu sozinha a cada 24 horas (ou no `↻`). Fica também a **Expedição**, que é uma
entrada fixa e aparece sozinha em qualquer conta — exportá-la seria mandar uma cópia que envelhece.

Na entrada, um atalho sem nome não é atalho, um nome repetido não vira dois e o arquivo para nas
cem primeiras caçadas. O **nome do time** que não existir na conta que recebe **não é apagado**: a
lista já o marca com *(não guardado)* ao lado, e apagar em silêncio seria pior do que mostrar o que
falta.

### As duas recusas

**Um arquivo da compra não entra na venda.** São duas configurações com campos parecidos e
significados diferentes; aplicar uma na outra passaria calado e só apareceria no dia em que a
automação agisse na hora errada. O pacote carrega o nome da ferramenta, e a mensagem diz de qual
ele é — *"arquivo errado"* manda procurar no escuro.

**Só entra o que a ferramenta reconhece.** Quem aplica é ela, campo a campo, e não o importador
escrevendo no armazenamento o que vier escrito: um JSON editado à mão não vira um teto de `abc`, nem
uma raridade que esta extensão não vende, nem um alvo negativo, nem uma chave qualquer no
`localStorage` do jogo.

E não se importa no meio de uma rodada: trocar o teto, o lote ou os alvos com a automação já
correndo por eles seria mudar as regras no meio do jogo — e a venda não tem desfazer.

Medido em `testes/banca-config.html`, que exporta, mexe em tudo, importa de volta e confere a tela,
o armazenamento e as recusas — sem baixar nada: o clique do download é interceptado e o conteúdo é
lido do próprio `blob:` que a extensão criou.

## Senha: quando a extensão é recarregada por baixo da aba

Recarregar a extensão — em `chrome://extensions`, ou reinstalando o pacote pela loja — **não mexe
nas abas já abertas**. O script antigo continua a correr, com os botões na tela, mas perde a
ligação à extensão. Dali em diante toda ida ao `chrome.storage` atira `Extension context
invalidated.`, e era isso que aparecia no botão: um erro em jargão, a senha digitada a não ir para
lado nenhum — e os campos a fechar por cima, levando embora o que tinha acabado de ser escrito.

Três consertos, todos medidos em `testes/banca-senha.html`, que tem um `chrome.storage` de mentira
que se pode estragar de propósito:

- **a ligação caída é reconhecida**, por `chrome.runtime.id`, que é o sinal que o próprio navegador
  usa. O aviso chega quando a caixa aparece, antes de alguém digitar, e diz o que fazer —
  *"recarregue a página (F5)"* — em vez de citar o erro. Esse aviso **não some sozinho**: nada
  naquela aba volta a funcionar até o F5, e um aviso que desaparece convida a tentar de novo;
- **um erro não fecha mais os campos.** A senha ficava sem ser guardada *e* sumia da tela;
- **calado também é falha.** Com a ligação caída há chamadas que não atiram nada: simplesmente
  nunca respondem. Sem prazo o botão ficava mudo para sempre. Agora há cinco segundos e, passados
  eles, *"o armazenamento não respondeu"*.

Nada se perde num desses episódios: o que já estava guardado continua guardado, do outro lado do
F5. O que se perdia era o que fosse digitado **depois** do erro.

### Por que não cair para o localStorage

Pareceria resiliência e seriam duas coisas ruins ao mesmo tempo. O `chrome.storage` é da extensão;
o localStorage é da origem, e a página do jogo lê tudo o que estiver lá — a senha passaria a ser
legível pelo próprio jogo. E a carga seguinte, já com a extensão viva, leria do `chrome.storage` e
diria *"nada guardado"*: guardar num lugar e ler de outro é pior do que dizer que falhou.

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

## Arena de Defesa: os cinco ataques do dia, sozinha

As cinco tentativas diárias da arena rendem pontos e acabam à meia-noite de Brasília. A ferramenta
faz a rodada inteira dentro de uma **janela de horário** que você marca — 13h-15h, por exemplo —, num
instante sorteado lá dentro, e aí dá os cinco ataques seguidos, com um **intervalo sorteado entre
dois valores em segundos** que também são seus.

O ciclo é o da tela, clique por clique: abre a janela da arena pela barra de cima, escolhe um rival
da lista, carrega na tela de preparação o **ataque salvo** que você nomeou no painel (`pvp1`, ou só
o número do slot), confirma, assiste à batalha e clica em "Voltar ao local anterior" no fim. Quando
os rivais da lista acabam, ela **atualiza a lista de graça** e continua, que é exatamente o que você
faria: três ataques, um refresh, mais dois.

### Ela não compra nada, e isso está no código em três lugares

O jogo vende entrada extra a 25 diamantes e cobra pela atualização depois das três grátis. Nada
disso é alcançável daqui:

- a **ponte não sabe atacar**. `attackPvPDefense` e `refreshPvPDefenseOpponents` existem na mesma
  API que ela lê, e ficam de fora: uma ponte que soubesse atacar punha a ação mais cara do jogo a um
  evento de distância de qualquer engano. Ela só lê;
- a licença para atualizar é o `payment` da API, lido **antes** do clique — e nunca o texto do
  botão. Ler "grátis" de uma string para decidir se uma coisa custa diamante é apostar numa tradução;
- as entradas compradas não existem no código: a palavra `extra_` não aparece nele.

Acabou o de graça, ela para e diz por quê.

### Quem te vence fica de fora até a temporada virar

Você pediu para pular a defesa que te ganhou e não entrar mais nela. Guarda-se o `trainer_id` — o
nome de um treinador muda, o id não — e a lista limpa-se sozinha quando a `season.id` muda, que é o
único momento em que o jogo recomeça de verdade (a temporada é `reset_mode: "hard"`). No painel ela
aparece inteira, com um `×` em cada um para dar outra chance a quem você quiser, e um botão de
limpar tudo.

Quando a lista nova vem cheia de gente que já te venceu, ela atualiza outra vez — **enquanto for de
graça**. Desistir na primeira deixaria tentativas por usar com atualizações grátis ainda na mão.

### Ganhou ou perdeu, quem diz é o placar

A tela traz `.pvp-result.is-win` na vitória, e seria o sinal óbvio. Mas a classe da derrota não foi
medida, e tratar "não é `is-win`" como derrota faria uma classe renomeada barrar a lista inteira de
rivais, uma por rodada, em silêncio. Por isso quem decide é a **diferença de pontos do perfil**,
lida pela API antes e depois do combate: subiu, ganhou. A classe entra só como segunda opinião, para
o caso improvável de os pontos não se mexerem.

### Na expedição ela espera, e a rodada fica a dever

A expedição dura duas horas a cada quatro, tem CAPTCHA para entrar e você só está lá porque quis.
Uma janela de 13h-15h cai dentro dela com facilidade — e um combate de arena no meio podia tirá-lo
de lá, coisa que eu não medi e não vou medir às suas custas.

Então a Arena faz o que a Escada já fazia: espera. Mas espera de um jeito que não lhe custa o dia —
quando a expedição acaba, ela faz a rodada **mesmo que a janela de horário já tenha fechado**. As
tentativas só se perdem à meia-noite de Brasília, então o dia ainda dá para recuperar.

O prazo dessa dívida é o `resets_at` da própria arena, guardado como instante na hora de adiar.
Assim a batida seguinte decide com um `Date.now()` e sem perguntar nada à API — e a dívida morre
sozinha quando o dia vira, em vez de disparar de madrugada e gastar a rodada do dia seguinte sem
ninguém pedir. É a mesma regra do calendário: ocorrência perdida fica perdida.

A expedição é conferida no início da rodada **e antes de cada ataque**, porque ela abre de quatro em
quatro horas e você pode entrar nela no meio de uma rodada de quinze minutos. Nesse caso o que sobra
fica a dever, como a rodada inteira ficaria.

### A vez é pedida por ataque, e não pela rodada inteira

A batalha joga-se sozinha — os golpes saem sem ninguém clicar e o pokémon derrotado é substituído
sem input — mas **demora**: 30 segundos de contagem e até 210 de combate, medidos no jogo. Cinco
ataques com os seus intervalos passam facilmente dos quinze minutos.

Segurar a fila esse tempo todo pararia a Escada, o ginásio e a venda por uma coisa que não tem pressa
nenhuma. Então ela pede a vez para **cada ataque** e solta-a antes do intervalo: entre um combate e
outro, a fila fica livre para quem precisar.

### Duas coisas medidas que não se adivinham

**Entrar na tela de preparação não gasta tentativa.** Conferido com a API antes e depois: quem gasta
é o "Atacar" de lá dentro. É o que permite à ferramenta conferir a tela — e sair pelo "Voltar" sem
custo nenhum quando o ataque salvo que você escolheu não dá para carregar. Atacar com outra equipe
gastaria a tentativa na mesma, e você pediu aquele time por algum motivo.

**O `✕` da janela da arena não é um botão.** É um `<div>`, e `click()` nele não fecha nada — o jogo
escuta o `pointerdown`. Nos botões o `click()` basta, e é o que se usa; só ali vai a sequência
inteira que um rato faz.

**A janela tem quatro abas, e só uma delas tem rivais.** `Atacar`, `Defesa e formações`,
`Histórico` e `Ranking` — e fora da primeira não existe um único cartão de rival no DOM. O jogo
larga a janela no **Histórico** assim que uma batalha acaba, então a ferramenta voltava ao ataque
seguinte a procurar cartões numa tela que não os tem; e, com a janela já aberta ali, o `abrirJanela`
dava-a por fechada e mexia no menu de cima, que a fecharia de verdade.

Agora ela garante a aba `Atacar` **logo depois de cada resultado** e **antes de cada ataque**, e a
aba escolhe-se pelo endereço (`data-defense-view="opponents"`), não pelo texto do botão: "Atacar" é
também o que diz o botão que gasta a tentativa na tela de preparação. Nas telas sem barra de abas —
preparação e batalha — não há o que trocar, e medir isso foi o que mostrou que ali não há `nav`.

**A tela de preparação reconhece-se pelo que tem, e não pelo que diz.** A primeira versão
confirmava a abertura procurando *"Ataque contra <nome>"* no `h3` do cabeçalho — e falhava sempre,
com a tela aberta à frente dela: no jogo aquele título é um `h2`, e o `h3` daquele cabeçalho é o
`ESCOLHIDOS · 6/6`. Trocar um seletor de título por outro era repetir o erro. O que vale é haver os
ataques salvos para carregar e o botão que confirma — que é exatamente o que os passos seguintes
vão usar — e já não haver a lista de rivais, que é a outra tela da mesma janela.

### Minimizada, os comandos ficam

Como na Escada: o `–` esconde o **corpo** do painel, e `Iniciar`/`Parar` e `Atacar agora` deixaram
de morar lá dentro. São os mesmos botões, não uma cópia — duas cópias seriam duas verdades sobre o
mesmo estado. Minimizada, a etiqueta fica assim:

```
ARE                □ ×
● em 42 min
[ Parar ] [ Atacar agora ]
```

### O atalho é Alt+M, com Shift para mostrar

É a única ferramenta do pacote que usa a mesma tecla para as duas coisas, e não por gosto: de A a Z
não sobrava mais nenhum par. As outras onze levaram vinte e tantas letras, o menu tem o Alt+Q, o
Alt+R é do próprio LionMultInstance e o Alt+Z/Alt+X esconde tudo de uma vez.

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

### A caçada é cortada de outro jeito

O mapa é desenho do motor, e some escondendo o `_spriteset`. A caçada **não é**: ela é feita de
elementos comuns da página, animados por CSS — os lutadores são `span.platform-hunt__sprite` com a
figura em `background-position`, e o fundo é um `div.platform-hunt__backdrop` com um parallax que
nunca para. Esconder o `_spriteset` não os alcança, e era por isso que o Alt+G parecia não fazer
nada dentro de uma caçada.

Agora a ferramenta também põe um estilo na página, e ele é deliberadamente desigual:

- **o fundo sai** (`display:none`). É a maior área de pixels da tela e a única coisa que se mexia
  sozinha o tempo todo;
- **os pokémon ficam, parados**. A animação do jogo é um `steps(2)`, então tirá-la congela a figura
  no quadro em que está. Quem está farmando precisa ver se o pokémon morreu, o HP e a pokébola — e
  isso continua na tela.

Medido numa máquina pequena em 08/10/2026, com uma caçada em andamento: com tudo animado a CPU
ociosa ficava entre 9% e 18%; com o corte, entre 28% e 71%. Numa máquina folgada a diferença não
aparece — isto é para quem joga em hardware apertado.

## O que o pacote acessa

O mesmo que as cinco acessavam, nada a mais: a página do jogo, para achar a loja do Mark, os
campos de login e os popups; e o armazenamento local, para guardar as suas escolhas. Nenhuma
chamada de rede, nenhum servidor, nenhuma conta.

A senha continua guardada em texto puro, como antes. Serve para este jogo e nada mais.

## Onde funciona

`pokepixel.nietore.com`, e só.

Até a 1.10.0 o pacote também se declarava em `poke.idleworld.online`. Saiu na 1.11.0: aquilo é
outro jogo — feito em Next.js, sem o motor nem a API de que estas ferramentas vivem —, e o que
carregava lá era um menu que não fazia nada. Cada jogo passa a ter o seu pacote, declarando só o
seu site. É isso que impede dois pacotes de se injetarem na mesma página e disputarem os atalhos.

As cinco extensões avulsas continuam publicadas e funcionando para quem já as usa; elas é que não
recebem mais novidades. Não instale as duas coisas na mesma janela: cada ferramenta apareceria duas
vezes.

## Instalação

Pela loja de extensões do LionMultInstance, ou à mão: baixe o `.zip` da
[última release](../../releases/latest), descompacte numa pasta e aponte a extensão da janela para
ela.

Ao lado do `.zip` há um arquivo `.sha256`, para conferir que o pacote baixado é exatamente o que
foi publicado aqui.
