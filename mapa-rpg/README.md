# Atlas do Reino

Site separado para os jogadores explorarem um mapa publicado pelo mestre. A área pública permite mover, ampliar e rotacionar a imagem. A área administrativa exige uma sessão segura no servidor e é a única que pode trocar o mapa.

## Publicar na Vercel

1. Crie um **novo projeto** na Vercel com a pasta `mapa-rpg` como *Root Directory*.
2. Em **Storage**, crie e conecte um Vercel Blob ao projeto. A Vercel cria `BLOB_READ_WRITE_TOKEN` automaticamente.
3. Em **Settings → Environment Variables**, defina `ADMIN_PASSWORD` com uma senha forte e `ADMIN_SESSION_SECRET` com uma sequência aleatória longa (32 caracteres ou mais). Configure ambas para Production, Preview e Development.
4. Faça o deploy. Abra o novo endereço, entre em **Administração** e publique a imagem exportada pelo Aether Atlas.

O editor atual exporta a imagem pelo botão **Exportar imagem**. Publique PNG, JPG ou WebP com até 4 MB. O projeto JSON é opcional e fica privado no Blob, apenas como cópia de trabalho do mestre; jogadores recebem somente a imagem pública.

Não use o domínio atual do editor para este projeto. A Vercel permite criar um projeto novo apontando para a mesma conta ou repositório, desde que o *Root Directory* seja `mapa-rpg`.

## Segurança e limites

- A senha nunca é enviada ao navegador como configuração e a sessão é um cookie `HttpOnly`, assinado e válido por 12 horas.
- Os endpoints de publicar e remover exigem essa sessão.
- Arquivos de imagem têm limite de 4 MB para caber com segurança na função de upload. Para mapas maiores, exporte em resolução menor ou comprima antes de enviar.
- A remoção apenas tira o mapa da visualização pública. Os arquivos armazenados continuam no Blob para recuperação; remova-os no painel Storage da Vercel quando não precisar mais deles.
