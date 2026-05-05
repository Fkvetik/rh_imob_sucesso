# RH IMOB

Site estático para Vercel/GitHub.

## Estrutura

- `index.html`: tela inicial com dois caminhos, área "Preciso contratar", área "Vagas" e formulários.
- `styles.css`: identidade visual, responsividade e componentes.
- `script.js`: menu, filtros de vagas, modal de candidatura e mensagens para WhatsApp.
- `assets/`: logos, favicon, ícones e imagem social, todos locais.
- `site.webmanifest`, `robots.txt`, `sitemap.xml`, `vercel.json`: publicação e SEO.

## Contatos configurados

- Empresas / contratação: Fernando — `+55 11 97872-5515`
- Vagas / candidatura: Mariana — `+55 11 95397-3268`

## Como adicionar novas vagas

No arquivo `script.js`, edite a lista `JOBS`. Cada vaga possui:
`id`, `title`, `category`, `location`, `contract`, `pay`, `summary`, `highlights`, `details` e `badge`.

A identidade visual usa apenas arquivos locais do próprio projeto.


## Atualização - Banco Confidencial de Talentos

Esta versão inclui uma área discreta na seção Vagas para corretores ativos e profissionais do mercado imobiliário que desejam receber propostas de empresas parceiras. O cadastro abre uma mensagem pronta no WhatsApp da Mariana, mantendo o site estático, leve e sem dependência de backend.
