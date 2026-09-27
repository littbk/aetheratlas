# Aether Atlas em produção

O projeto Vercel `aetheratlas` atende https://aetheratlas-three.vercel.app. A raiz do repositório compila editor, contas Google e visualizador juntos. Execute `npm ci`, `npm test` e `npm run build`; saída: `public`. Node.js 22.

## Uso

- Abra o editor na página inicial. Desenhar e exportar JSON não exigem login.
- Entre com Google para usar **Salvar na conta** e **Meus mapas**.
- **Enviar aos jogadores** salva o projeto completo e publica um link individual em `/play?share=...`.
- Copie o link em **Meus mapas**. Jogadores não precisam entrar na conta.
- Salvar na conta mantém a versão publicada anterior. Envie novamente aos jogadores para atualizar a publicação.
- **Retirar publicação** invalida o link e mantém o projeto privado para edição.
- Novo mapa, arquivo local e arquivo do Drive não substituem automaticamente o projeto anterior da conta.

## Configuração

Variáveis privadas: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET` (ao menos 32 caracteres), `BLOB_READ_WRITE_TOKEN`. `SITE_ORIGIN=https://aetheratlas-three.vercel.app` fixa o domínio do login. Mantenha `DRIVE_SESSION_SECRET` para a integração opcional com Drive.

A produção reutiliza o retorno já autorizado do Drive, com `AUTH_CALLBACK_PATH=/api/drive/callback`. Os estados com prefixo `account.` são verificados pelo fluxo de login, e os demais permanecem no fluxo do Drive. Não é necessário adicionar outra URI para essa configuração.

Para um cliente OAuth novo, a URI padrão do login é:

`https://aetheratlas-three.vercel.app/api/auth/callback`

Mantenha também as URIs usadas pelo Drive. O login usa apenas `openid email profile`; conectar Drive é uma autorização separada. Configure o público do app como externo para aceitar outras contas Google. Nunca envie client secret ou tokens pelo chat ou inclua arquivos `.env` no Git.

O Blob deve ser **privado**. O servidor identifica o usuário pela identidade Google validada e verifica os caminhos de cada upload. Arquivos e metadados ficam em diretórios separados por usuário. O link público só acessa a revisão publicada; revisões privadas não são entregues aos jogadores. Arquivos completos podem ter até 80 MB. Revisões antigas sem uso há mais de uma hora são limpas quando o mapa é salvo novamente.

## Planos gratuitos

A implantação utiliza Vercel Hobby e o armazenamento privado já existente. Há limites de armazenamento, transferência e operações; não é um serviço ilimitado. Confira o uso no painel Vercel antes de abrir o acesso para muitos usuários. Não foi contratado um plano pago. Anúncios são desativados na compilação de produção para manter o uso não comercial do plano Hobby.

Esta versão mantém JSON local e Drive opcionais. Projetos locais não são migrados automaticamente; abra o arquivo e salve na conta. Publicações antigas do visualizador separado também precisam ser importadas para uma conta.

## Validação

Os testes cobrem assinaturas Google, nonce, expiração, cookies adulterados, origem das gravações, caminhos de upload por proprietário, navegação e validação de projetos. O teste de integração com Blob verifica biblioteca privada, rejeição de acesso por outra conta, publicação, leitura pública e retirada da publicação. A configuração OAuth precisa ser testada com uma conta Google real após autorizar a URI de retorno.
