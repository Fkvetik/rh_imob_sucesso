# RH IMOB — Site institucional para Vercel

Site estático, sem dependências externas, pronto para subir no GitHub e publicar na Vercel.

## Arquivos principais

- `index.html` — landing page principal
- `styles.css` — visual completo do site
- `script.js` — menu mobile, animações e formulário para WhatsApp
- `politica.html` — política de privacidade simples
- `assets/rhimob-mark.svg` — marca/ícone criado em SVG
- `assets/rhimob-logo.svg` — logotipo horizontal em SVG
- `vercel.json` — configuração básica da Vercel
- `robots.txt` — liberação de indexação

## Como publicar no GitHub + Vercel

1. Crie um repositório no GitHub.
2. Envie todos os arquivos deste pacote para a raiz do repositório.
3. Na Vercel, clique em **Add New Project**.
4. Selecione o repositório.
5. Framework Preset: **Other** ou **Static**.
6. Build Command: deixar vazio.
7. Output Directory: deixar vazio ou `.`.
8. Publicar.

## WhatsApp configurado

O número oficial configurado no site é:

`55 11 97872-5515`

No código está como:

```js
const WHATSAPP_NUMBER = '5511978725515';
```

Para alterar futuramente, edite a primeira constante do arquivo `script.js`.

## Formulário

O formulário não envia e-mail nesta versão. Ele monta uma mensagem com os dados preenchidos e abre o WhatsApp oficial da RH IMOB.

## E-mail reservado para versão futura

`fernandorhimob@gmail.com`

Para envio por e-mail automático será necessário configurar backend, serviço externo ou função serverless.
