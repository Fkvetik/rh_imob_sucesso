RH IMOB • Site completo com Plataforma Novos Talentos
Versão: V2_COMERCIAL_HOTFIX_PUBLICO_LOGIN_2026_05_07

O QUE ESTE ZIP CONTÉM
- Site completo atualizado.
- Home com entrada comercial para Plataforma Novos Talentos.
- Página /novos-talentos.html com prévia pública protegida.
- CSS e JS atualizados.
- SQL para liberar prévia pública protegida.
- Script Apps Script para reset de senha no Supabase Auth pela planilha.
- Script Apps Script para criar empresas, usuários e logins pela planilha.

ARQUIVOS ALTERADOS
- index.html
- styles.css
- sitemap.xml
- novos-talentos.html
- novos-talentos.css
- novos-talentos.js

ARQUIVOS IMPORTANTES ADICIONADOS/MANTIDOS
- 05_SQL_PREVIEW_PUBLICO_NOVOS_TALENTOS.sql
- 05_Resetar_Senha_Auth_Novos_Talentos.gs
- 04_Admin_Empresas_Usuarios_Novos_Talentos.gs

VISÃO COMERCIAL APLICADA
- A plataforma foi posicionada como solução de prospecção e captação de talentos comerciais.
- Evitei termos técnicos visíveis para o cliente.
- Reforcei prévia protegida, consumo por plano, controle por empresa e mensagens prontas.
- Mantive separação clara entre Plataforma Corretores e Novos Talentos.

ANTES DE TESTAR
1. Rode no Supabase:
   05_SQL_PREVIEW_PUBLICO_NOVOS_TALENTOS.sql

2. Suba o ZIP no GitHub/Vercel.

3. Acesse:
   /novos-talentos.html

4. Sem login:
   deve mostrar prévia pública protegida.

5. Para login:
   se aparecer "E-mail ou senha não conferem", redefina a senha usando:
   05_Resetar_Senha_Auth_Novos_Talentos.gs
   função: processarResetSenhaNovosTalentos

SEGURANÇA
- Nenhuma service_role foi colocada em HTML, JS ou GitHub.
- A prévia pública mostra apenas dados públicos/protegidos.
- Telefone, e-mail e contato completo ficam atrás do login e consumo.
