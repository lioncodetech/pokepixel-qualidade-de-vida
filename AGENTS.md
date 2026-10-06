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

## O resto

- Reproduza antes de consertar. Uma banca construída sobre a suposição só confirma a suposição.
- Teste e documentação na mesma tarefa, nunca depois.
- Nunca commitar, taguear ou publicar sem pedido explícito.
