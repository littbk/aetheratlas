# Atlas do Reino — visualização 3D da campanha

Projeto paralelo ao editor, publicado em https://aetheratlas-pnp8.vercel.app. Jogadores recebem o planeta esférico de 8.000 × 4.400 pixels salvo pelo Aether Atlas: camadas visíveis, mapas antigos encaixados, construções, textos, rios, caminhos e túneis. A câmera oferece mover, orbitar, zoom, inclinação, planta, relevo 3D e tela cheia. A interface não possui ferramentas de edição e só uma sessão de administrador pode mudar a publicação no servidor.

O ponto **LOCAL ATUAL** é definido pelo mestre no editor. Ao abrir o visualizador, a câmera começa centrada nesse ponto; o botão de enquadramento volta a ele. O marcador indica a posição dos jogadores e fica oculto quando está no lado oposto do planeta.

Submapas planos podem ser associados ao planeta por portais. Cada interior é um projeto plano separado com camadas próprias. Ao abrir um portal, o visualizador descarta as texturas e a geometria do planeta e carrega o projeto do interior; ao voltar, busca novamente o mundo publicado. Pacotes antigos com submapas em imagem seguem compatíveis.


Para incorporar o mapa em outro aplicativo, use https://aetheratlas-pnp8.vercel.app/?embed=1. Esse modo ocupa toda a área disponível, oculta cabeçalho, administração, publicidade e molduras, e mantém os controles de navegação e câmera. O elemento iframe deve permitir tela cheia quando essa ferramenta for necessária. A câmera aceita rotação em Z pelo controle, Q/E, Shift + Orbitar ou torção de dois dedos. Planetas são desenhados como uma superfície esférica editável com os pincéis do mapa; os túneis ainda aparecem como portais e rota subterrânea, sem câmera em primeira pessoa para atravessá-los.

## Publicar seu mundo

1. No editor, clique em **Enviar aos jogadores**. Ele abre o visualizador e prepara um pacote incremental quando há uma base local da publicação; caso contrário, prepara o JSON completo. Se o navegador bloquear a janela, o arquivo é baixado para importação manual.
2. No visualizador, entre em **Administração** como mestre. O editor transfere o arquivo à janela e preenche o formulário; confira nome e descrição e clique em **Publicar para jogadores**. Também é possível selecionar manualmente qualquer JSON salvo.
3. Pacotes incrementais contêm somente as camadas alteradas e só são aceitos se a base publicada e a ordem das camadas ainda forem as mesmas. Inclusão, exclusão ou reordenação de camadas requer envio completo. Para começar em outro dispositivo, use **Salvar JSON** e importe o projeto completo.

Os visitantes recebem a nova versão ao abrir a página; páginas abertas verificam atualizações a cada minuto sem redefinir a câmera quando o projeto continua igual. Publicar outro JSON substitui o mapa exibido. **Retirar mapa da visualização** remove a publicação, preservando os arquivos no armazenamento para recuperação.

## Vercel

- Projeto: `aetheratlas-pnp8`, conta `littbks-projects`, Root Directory: `mapa-rpg`.
- Compilação: `npm run build`; saída estática: `public`; Node.js: 22.x.
- Vercel Blob **privado**, conectado aos ambientes do projeto.
- Variáveis privadas: `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` (32 caracteres ou mais), `BLOB_READ_WRITE_TOKEN`.
- O token de escrita nunca é entregue ao navegador. Uploads diretos usam tokens temporários emitidos somente para administradores; a publicação é efetivada após validar o JSON no servidor.
- As camadas precisam chegar ao navegador para a renderização 3D. O endpoint público libera somente o projeto atualmente publicado; não há lista de arquivos nem escrita pública. Não inclua segredos da campanha no projeto entregue aos jogadores.

A senha inicial gerada durante a configuração está em `.vercel/admin-access.json` na raiz do repositório local. Essa pasta é ignorada pelo Git e pela publicação; nunca copie esse arquivo para `public`. Para trocar a senha, altere `ADMIN_PASSWORD` no painel da Vercel e faça novo deploy. Para encerrar as sessões existentes, troque também `ADMIN_SESSION_SECRET`.

## Desenvolvimento e validação

Execute `npm install`, `npm test` e `npm run build` nesta pasta. Os quatro arquivos em `renderer/` são cópias do renderizador do editor original; o visualizador usa sua geometria de relevo e seus marcadores, sem carregar a aplicação de edição.

O Blob guarda os projetos originais privados, e as funções entregam apenas o projeto ativo aos jogadores. A leitura da publicação ignora o cache para refletir trocas e remoções. JSONs inválidos são recusados antes do upload no navegador e novamente antes de publicar no servidor. A navegação recorre à planta 2D quando WebGL não está disponível.

Referências: [funções Vercel](https://vercel.com/docs/functions/runtimes/node-js), [uploads diretos ao Blob](https://vercel.com/docs/vercel-blob/client-upload), [SDK Blob](https://vercel.com/docs/vercel-blob/using-blob-sdk).

### Região em plano temporário

Na navegação do mapa, use o ícone de seleção de região. Arraste sobre o planeta para delimitar a área ou clique para abrir uma região local. O editor permite editar esse mesmo terreno em plano; o visualizador permite explorá-lo. Clique novamente no ícone ou pressione Esc para voltar ao planeta. As edições permanecem no mundo original; essa vista não cria um submapa separado.
