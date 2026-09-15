# Aether Atlas

Abra `index.html` no Chrome, Edge, Firefox ou Safari atual. O editor não depende de bibliotecas, fontes ou imagens externas.

## Visual e câmera

- **Navegar**: arraste para mover e use a roda do mouse para ampliar.
- **Orbitar**: arraste na horizontal para girar o mundo e na vertical para inclinar. O botão direito do mouse também orbita.
- **Planta** mostra o mapa de cima; **Relevo 3D** projeta a altitude do terreno. No painel de camadas, ajuste rotação, inclinação e intensidade do relevo.
- As setas ao lado do zoom giram o mapa em passos de 30°. **Enquadrar** ajusta o mapa à tela, e **Orientar ao norte** restaura a vista de cima sem rotação.
- O pincel acompanha a posição do terreno mesmo com a câmera girada. WebGL renderiza o relevo; navegadores sem esse recurso usam a vista plana com rotação.
- Pradarias, copas de árvores, areia, rochas, neve e água têm detalhes procedurais alinhados ao mundo. Texturas, sombras e curvas de nível podem ser alternadas no painel direito.

## Construção e edição

- **Terreno**, **Elevar**, **Rebaixar**, **Suavizar** e **Platô** modificam os biomas e a altitude da camada selecionada.
- A paleta inclui **Lava**. Em **Cores do mundo**, ajuste separadamente a grama, as copas das árvores, a água e a lava; o ajuste aparece no relevo e nas texturas.
- **Túnel**: toque ou clique na entrada e depois na saída. Ajuste a largura pelo pincel e a profundidade no painel de túneis. Escape cancela a primeira entrada.
- Túneis são representados por portais conectados e uma rota subterrânea tracejada; a profundidade é uma anotação. O editor não simula escavação volumétrica ou navegação no interior. Desmarque **Mostrar rotas subterrâneas** para exibir apenas os portais.
- Casas, vilas, castelos, pontes, cavernas e outros marcadores podem ser inseridos em qualquer camada editável. Construções, marcadores e textos são objetos separados, ancorados na altitude do terreno. Seus desenhos planos ficam de frente para a câmera, com tamanho legível e legendas horizontais.
- **Rio** e **Caminho** guardam trajetos contínuos com curvas suaves; as margens são desenhadas antes do preenchimento para evitar anéis nas junções. **Cor livre** continua sendo pintura raster. Preencha o nome para inserir **Texto** ou legendas de marcadores.
- **Borracha** remove um objeto ao tocar no ícone ou legenda, recorta trechos de rios e estradas e remove pintura e relevo da camada; tocar na rota de um túnel com a borracha remove essa conexão inteira.
- Camadas aceitam visibilidade, bloqueio, reordenação e opacidade. Camadas superiores podem cobrir as inferiores.
- Ctrl+Z desfaz e Ctrl+Y refaz. O histórico guarda até 12 operações e reduz esse número conforme o tamanho do projeto para limitar a memória das cópias.

## Celular e tablet

- **Ferramentas** e **Camadas** abrem painéis recolhíveis; feche com × ou tocando fora do painel para voltar ao mapa.
- Um dedo usa a ferramenta selecionada. Dois dedos movem, ampliam e giram o mapa. Para inclinar, use **Orbitar** com um dedo ou o controle de inclinação em **Camadas**.
- Ao iniciar uma pinça, o primeiro toque não deixa uma pincelada acidental. A interface acompanha as orientações vertical e horizontal.
- Para abrir em outro aparelho, disponibilize esta pasta em uma hospedagem estática ou servidor local acessível ao celular e abra o endereço pelo navegador. Os arquivos precisam ficar juntos; um caminho de arquivo do computador não é um endereço acessível pelo telefone.

## Salvar e exportar

- **Salvar projeto** baixa um JSON com camadas, pintura, altitude, objetos, trajetos, túneis e orientação da câmera. **Abrir** restaura o arquivo. Projetos anteriores das versões 1, 2 e 3 continuam aceitos.
- **Google Drive:** informe no painel direito o *Client ID OAuth* de um aplicativo Web criado no Google Cloud, cadastre o endereço publicado do editor em "Authorized JavaScript origins" e clique em **Conectar Drive**. O primeiro salvamento cria `nomedomapa.aether-atlas.json` na sua conta; os seguintes atualizam o mesmo arquivo automaticamente após cada alteração. Nas próximas visitas, com a sessão Google ativa, o editor abre silenciosamente o último projeto salvo neste navegador. O token de acesso não é guardado no navegador; se a sessão expirar ou o navegador bloquear a autenticação silenciosa, basta conectar novamente. O ID público do cliente e o ID do arquivo ficam apenas neste dispositivo.
- O botão **Salvar JSON** continua disponível como cópia local. O formato do projeto continua na versão 4, com os novos campos opcionais de tema, e versões anteriores continuam aceitas.
- **Exportar planta (PNG)**, no painel da câmera, gera o mapa de cima em 1600 × 1100 pixels, respeitando camadas e opacidade, independentemente da câmera.
- **Exportar imagem**, no topo, salva a perspectiva, rotação, zoom e enquadramento atuais, incluindo os ícones e textos voltados à câmera, sem controles nem indicadores temporários. **Exportar esta vista**, no painel da câmera, faz a mesma exportação. A imagem usa a resolução do visor, com densidade de pixels limitada a 2.
- **Exportar mapa de altura** gera 400 × 275 pixels: preto = −500 m e branco = 3.000 m. Áreas sem altitude definida ficam transparentes.

O mapa é um campo de alturas com até 16 camadas. Novos textos e construções são objetos independentes; para reposicioná-los, desfaça e reinsira. Elementos de projetos antigos que já foram gravados na imagem continuam rasterizados: um PNG não contém as posições e os textos originais para separá-los automaticamente. O exemplo e os materiais são originais, desenhados por código.

## Publicidade no rodapé

O editor web está preparado para **Google AdSense**. **AdMob** exige um aplicativo Android/iOS com o Google Mobile Ads SDK; esta pasta não contém um projeto nativo.

A faixa fica abaixo de todo o editor, fora do canvas e das imagens exportadas. Reserva 728 × 90 px para o anúncio no desktop e 320 × 50 px em telas de até 860 px, além do rótulo e das margens. Os painéis móveis e as notificações respeitam esse espaço.

- Abrindo `index.html` localmente, a prévia aparece automaticamente, sem carregar scripts do Google. Para removê-la, altere `previewLocal` para `false` em `ads-config.js`.
- Em uma hospedagem, use `?ads=preview` na URL para conferir apenas o layout. Sem essa opção, o script da conta `ca-pub-7384003784715607` carrega de forma assíncrona e solicita o bloco **AetherAtlas**, `1897479487`.
- A integração já está ativada em `ads-config.js`, com `client`, `slot` e `enabled: true`. Cadastre e obtenha aprovação do domínio no AdSense para receber anúncios. Para desativar toda a integração, use `enabled: false`. IDs do AdMob com `/` ou `~` não servem para esta integração.
- Publique todos os arquivos juntos, incluindo `ads.txt` na raiz do domínio (`https://seu-dominio/ads.txt`); ele já contém seu ID de editor. Se a hospedagem já tiver esse arquivo, acrescente a linha sem apagar os outros registros. Siga as instruções da sua conta para privacidade e consentimento (incluindo uma CMP certificada nas regiões em que o Google a exige); essas configurações dependem do domínio, da conta e do público e ainda não foram realizadas.
- Mantenha os anúncios automáticos desligados na conta se quiser apenas esta faixa. O código insere uma única unidade, sem atualização periódica. Bloqueio do script ou resposta sem anúncio recolhem a faixa.

Valide o anúncio real no domínio aprovado. A prévia local não comprova aprovação, preenchimento nem receita; não clique nos próprios anúncios durante os testes.

Referências: [AdSense e AdMob](https://support.google.com/adsense/answer/9234653?hl=pt-BR), [dimensões responsivas](https://support.google.com/adsense/answer/9183363?hl=pt-BR), [publicar ads.txt](https://support.google.com/adsense/answer/12171612?hl=pt-BR).

## Validação do editor

`validate_browser.py` verifica o editor com Chrome headless e DevTools: câmera, escultura, construções, túneis, desfazer/refazer, exportação, compatibilidade e gestos mobile. O script de desenvolvimento usa o módulo Python `websocket-client` já disponível no ambiente de validação; ele não é necessário para usar o editor.

Os resultados ficam em `validation-results.json`. Layout e gestos foram verificados com emulação de celular; desempenho, downloads e gestos em Android/iPhone físicos ainda precisam ser conferidos no aparelho.
