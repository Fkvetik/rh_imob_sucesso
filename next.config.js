/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  outputFileTracingIncludes: {
    '/*': [
      './index.html',
      './novos-talentos.html',
      './corretores.html',
      './vagas.html',
      './politica.html',
      './404.html',
      './styles.css',
      './script.js',
      './novos-talentos.css',
      './novos-talentos.js',
      './corretores.css',
      './corretores.js',
      './favicon.ico',
      './favicon.svg',
      './site.webmanifest',
      './assets/**/*'
    ]
  }
};
module.exports = nextConfig;
