PASSO A PASSO • LOGIN E SENHA RH IMOB

1. Suba este ZIP no GitHub/Vercel.
2. Acesse /corretores.
3. O filtro Perfil/cargo agora lê a coluna cargo normalizada.
4. Para criar usuários:
   - Abra a planilha-mãe.
   - Preencha CONTAS_MODELO.
   - Preencha USUARIOS_MODELO.
   - Cole o arquivo apps_script/99_USUARIOS_SUPABASE.gs no Apps Script.
   - Rode rhiVerificarContasUsuariosPlanilha.
   - Rode rhiSincronizarContasUsuariosSupabase.
   - Rode rhiTestarLoginUsuarioModelo.
5. Depois faça login em /corretores com o e-mail e senha temporária.

Importante:
- A coluna SENHA_TEMPORARIA deve ser usada apenas para criação inicial.
- Depois de validar, recomenda-se trocar a senha ou apagar a senha da planilha.
- O consumo de leads é por conta/plano, não global.
