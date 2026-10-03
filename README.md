# PokePixel — qualidade de vida

As cinco ferramentas de qualidade de vida do PokePixel num pacote só, com um menu para ligar e desligar cada uma na
janela em que você está.

**Alt+Q** abre e fecha o menu. Fechado, fica só o botão `PokePixel` no canto.

| ferramenta | o que faz | atalhos |
| --- | --- | --- |
| Ocultar popups | esconde os popups que aparecem ao passar o mouse | Alt+B esconde · Alt+N mostra |
| Sem gráfico | desliga o desenho do mapa; o jogo continua rodando | Alt+G desliga · Alt+H liga |
| Senha | guarda usuário e senha e os cola no login | botões na tela de login |
| Loja rápida | compra pokébolas, poções e revives sem abrir a loja | Alt+C esconde · Alt+V mostra |
| Venda rápida | vende pokémon pelas raridades que você marcar | Alt+D esconde · Alt+F mostra |

Cada uma é a mesma de sempre, com as mesmas telas e as mesmas configurações — inclusive as que você
já tinha. As escolhas continuam guardadas nas mesmas chaves, então raridades, teto de nível, lote,
quantidades da loja, posições dos painéis, usuário e senha atravessam a troca sem se perder.

## Os dois comandos de cada linha

Cada ferramenta tem **dois** comandos no menu, e eles não são a mesma coisa:

- **O botão do meio** mostra e esconde a janela daquela ferramenta (`à vista` / `oculta`). Nas duas
  que não têm janela — ocultar popups e sem gráfico — ele liga e desliga o efeito delas
  (`ligado` / `desligado`), que é tudo o que elas fazem.
- **A chave verde** ativa ou desativa a ferramenta inteira nesta janela. Desativada, ela nem carrega.

O que você escolher no botão do meio **atravessa o F5**: a janela que você mandou sumir continua
sumida na próxima carga, e os atalhos de cada ferramenta (Alt+C, Alt+D…) gravam do mesmo jeito.

Quando uma ferramenta ainda não se anunciou — porque está desativada, ou porque não carregou — o
botão do meio mostra `—` e fica apagado, em vez de prometer uma ação que não aconteceria.

## Mover o menu

Arraste pelo **⠿**. Minimizado, o botão `PokePixel` também se arrasta: puxe direto por ele. Andou
mais que alguns pixels, é arrasto e o menu não abre; foi um toque parado, o menu abre. Os dois
dividem o mesmo canto, então mover um leva o outro.

## Ativar e desativar

A chave verde vale **para esta janela**, como antes valia escolher quais extensões carregar nela.

- **Ligar** acontece na hora.
- **Desligar** vale a partir da próxima carga da página, e o menu oferece um `recarregar agora`.
  Não é preguiça: as ferramentas montam interface, prendem atalhos e deixam relógios rodando.
  Desfazer tudo isso na ordem certa seria uma segunda implementação de cada uma — e é exatamente
  aí que nasceriam os bugs. Recarregar faz isso de graça e sem engano.

Quem nunca mexeu no menu fica com as cinco ligadas.

## A caixa de confirmação

Quando você deixa marcado "Confirmar sozinho", a extensão clica em **Vender** na caixa que o jogo
abre. Até a venda rápida 1.2.2 ela não clicava: procurava a caixa no lugar errado — este código foi
escrito sem nunca ter visto uma de perto —, não a reconhecia e ficava esperando uma lista que
nunca encolhia. Agora é a caixa de verdade: "Confirmar venda", com os botões Vender e Cancelar.

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
