# Atlas do Reino — visualização 3D da campanha

Projeto paralelo ao editor, publicado em https://aetheratlas-pnp8.vercel.app. Jogadores recebem o mapa completo salvo pelo Aether Atlas: relevo, camadas visíveis, construções, textos, rios, caminhos e túneis. A câmera oferece mover, orbitar, zoom, inclinação, planta, relevo 3D e tela cheia. A interface não possui ferramentas de edição e só uma sessão de administrador pode mudar a publicação no servidor.

## Publicar seu mundo

1. No editor original, clique em **Salvar projeto** e guarde o arquivo `.json`.
2. No site da campanha, abra **Administração** e entre com a senha.
3. Selecione o JSON (até 80 MB), preencha nome e descrição se desejar e clique em **Publicar para jogadores**.

Os visitantes recebem a nova versão ao abrir a página; páginas abertas verificam atualizações a cada minuto sem redefinir a câmera quando o projeto continua igual. Publicar outro JSON substitui o mapa exibido. **Retirar mapa da visualização** remove a publicação, preservando os arquivos no armazenamento para recuperação.

## Vercel

- Projeto: `aetheratlas-pnp8`, conta `littbks-projects`, Root Directory: `mapa-rpg`.
- Compilação: `npm run build`; saída estática: `public`; Node.js: 22.x.
- Vercel Blob **privado**, conectado aos ambientes do projeto.
- Variáveis privadas: `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` (32 caracteres ou mais), `BLOB_READ_WRITE_TOKEN`.
- O token de escrita nunca é entregue ao navegador. Uploads diretos usam tokens temporários emitidos somente para administradores; a publicação é efetivada após validar o JSON no servidor.
- As camadas precisam chegar ao navegador para a renderização 3D. O endpoint público libera somente o projeto atualmente publicado; não há lista de arquivos, escrita pública nem interface de edição. Não inclua segredos da campanha no projeto entregue aos jogadores.

A senha inicial gerada durante a configuração está em `.vercel/admin-access.json` na raiz do repositório local. Essa pasta é ignorada pelo Git e pela publicação; nunca copie esse arquivo para `public`. Para trocar a senha, altere `ADMIN_PASSWORD` no painel da Vercel e faça novo deploy. Para encerrar as sessões existentes, troque também `ADMIN_SESSION_SECRET`.

## Desenvolvimento e validação

Execute `npm install`, `npm test` e `npm run build` nesta pasta. Os quatro arquivos em `renderer/` são cópias do renderizador do editor original; o visualizador usa sua geometria de relevo e seus marcadores, sem carregar a aplicação de edição.

O Blob guarda os projetos originais privados, e as funções entregam apenas o projeto ativo aos jogadores. A leitura da publicação ignora o cache para refletir trocas e remoções. JSONs inválidos são recusados antes do upload no navegador e novamente antes de publicar no servidor. A navegação recorre à planta 2D quando WebGL não está disponível.

Referências: [funções Vercel](https://vercel.com/docs/functions/runtimes/node-js), [uploads diretos ao Blob](https://vercel.com/docs/vercel-blob/client-upload), [SDK Blob](https://vercel.com/docs/vercel-blob/using-blob-sdk).
