// Verificacao estatica do pacote.
//
// Existe por um motivo concreto: `node --check` so' olha a sintaxe. Um `liderAgora()` que ficou sem
// definicao depois de uma reescrita passa por ele sem queixa e so' aparece quando o usuario clica —
// aconteceu, em cima da equipe de verdade. `no-undef` pega isso antes.
//
// Rode com: npx eslint .

export default [
  {
    files: ['*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: {
        // O navegador. Lista explicita em vez de um pacote de globals: sao poucas, e assim um nome
        // escrito errado nao vira "global do navegador" por acidente.
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        globalThis: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        addEventListener: 'readonly',
        removeEventListener: 'readonly',
        dispatchEvent: 'readonly',
        getComputedStyle: 'readonly',
        innerWidth: 'readonly',
        innerHeight: 'readonly',
        devicePixelRatio: 'readonly',
        location: 'readonly',
        navigator: 'readonly',
        // O arquivo de configuracao exportado: um Blob com URL propria, e nada mais.
        Blob: 'readonly',
        URL: 'readonly',
        CSS: 'readonly',
        MutationObserver: 'readonly',
        ResizeObserver: 'readonly',
        IntersectionObserver: 'readonly',
        KeyboardEvent: 'readonly',
        MouseEvent: 'readonly',
        PointerEvent: 'readonly',
        CustomEvent: 'readonly',
        Event: 'readonly',
        Node: 'readonly',
        Element: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        ShadowRoot: 'readonly',
        NodeFilter: 'readonly',
        // A API da propria extensao, usada por `senha.js`.
        chrome: 'readonly',
        DOMParser: 'readonly',
        fetch: 'readonly',
        // O recado no Telegram: corpo de formulario e prazo de rede. Ver `telegram.js`.
        URLSearchParams: 'readonly',
        AbortController: 'readonly',
        // O rele da verificacao: a foto numerada numa tela, e o corpo multipart que a leva.
        Image: 'readonly',
        FormData: 'readonly',
        // O `new Option(texto, valor)` de cada lista do painel. Faltava, e os onze erros que isso
        // dava escondiam os de verdade — que e' exactamente o que esta verificacao existe para nao
        // deixar acontecer.
        Option: 'readonly',
        structuredClone: 'readonly',
        // O `module.exports` que `times.js` usa para o teste de mesa; no navegador nao existe.
        module: 'readonly',
        // O nucleo do pacote, criado por `nucleo.js` e usado por cada ferramenta.
        PPX: 'readonly',
      },
    },
    linterOptions: { reportUnusedDisableDirectives: true },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
      'no-redeclare': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-unreachable': 'error',
      'no-const-assign': 'error',
      'no-self-assign': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
    },
  },
  {
    files: ['testes/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      // `Buffer` e' do Node: `senha.test.mjs` deriva o ID da extensao da chave do manifest.
      // `Blob` e' do Node tambem: o teste do rele manda uma foto de mentira ao Telegram de mentira.
      globals: { console: 'readonly', URL: 'readonly', Buffer: 'readonly', Blob: 'readonly' },
    },
    rules: { 'no-undef': 'error', 'no-unused-vars': 'warn' },
  },
];
