# Aether Atlas

Abra `index.html` no Chrome, Edge, Firefox ou Safari atual. O editor não depende de bibliotecas, fontes ou imagens externas.

## Visual e câmera

- O editor mostra um céu estrelado atrás do planeta. Quando o mapa é publicado com rotação ativa, o visualizador inicia com a mesma orientação do eixo e gira automaticamente; o jogador pode parar ou retomar a rotação no botão próprio.

- Junto à grade e ao relevo 3D, **Polos e equador** liga ou desliga as marcações do Polo Norte, Polo Sul, eixo e equador. **Rotação do planeta** gira o globo lentamente; clique de novo para parar. A **engrenagem** nessa barra ajusta a inclinação lateral e a profundidade do eixo, com prévia imediata; a orientação é salva no JSON. A rotação para ao editar no mapa, entrar em uma região plana ou explorar com personagem.

- No editor e no visualizador, **Lado oposto** gira 180° e **Focar local** encontra o ponto atual. A órbita do planeta atravessa os polos; mapas planos aceitam inclinação de −85° a 85°.
- Clique no mapa para usar o teclado: **setas** giram e inclinam continuamente, **Q/E** giram a vista em Z, **WASD** desloca a câmera e **+/−** controla o zoom. **Espaço + arraste** ou o botão do meio desloca a vista. No modo Orbitar, dois dedos também mudam a direção e a inclinação.
- **Explorar com personagem** ativa um viajante em terceira pessoa. **WASD** anda pela superfície, **Shift** corre e as **setas** ou o botão direito ajustam a câmera. A câmera acompanha o viajante; **Esc** restaura a vista anterior. A posição da exploração é temporária e não altera o marcador LOCAL ATUAL nem o projeto publicado. O movimento é livre, sem colisão com construções ou simulação de túneis.

- O editor inicia com um planeta esférico coberto por água. A superfície virtual tem **8.000 × 4.400 pixels**, 20 vezes a área do mapa editável anterior. O editor pinta uma região de 1.600 × 1.100 pixels no centro do planeta; o restante pode receber mapas encaixados.
- Em **Encaixar mapa antigo**, importe um JSON das versões 1 a 4 ou um PNG. Ajuste longitude, latitude e escala no painel do planeta. Os encaixes ficam no JSON do projeto e aparecem no visualizador dos jogadores. O JSON antigo é composto em uma imagem antes do encaixe; seus marcadores passam a fazer parte dessa imagem.
- **Navegar**: arraste para mover e use a roda do mouse para ampliar.
- **Orbitar**: arraste na horizontal para girar o mundo e na vertical para inclinar. O botão direito do mouse também orbita.
- **Rotação Z** gira a vista em torno da direção da câmera. Use o controle no painel, Q/E, Shift + Orbitar ou a torção de dois dedos. O valor é salvo no JSON e reproduzido no visualizador.
- A ferramenta **LOCAL ATUAL** posiciona o ponto dos jogadores em qualquer parte visível do planeta, inclusive sobre um mapa encaixado. O visualizador sempre abre com esse ponto no centro e o botão de enquadramento retorna a ele.
- A ferramenta **LOCAL ATUAL** posiciona o ponto dos jogadores em qualquer parte visível do planeta, inclusive sobre um mapa encaixado. O visualizador sempre abre com esse ponto no centro e o botão de enquadramento retorna a ele.
- **Planta** mostra o mapa de cima; **Relevo 3D** projeta a altitude do terreno. No painel de camadas, ajuste rotação, inclinação e intensidade do relevo.
- As setas ao lado do zoom giram o mapa em passos de 30°. **Enquadrar** ajusta o mapa à tela, e **Orientar ao norte** restaura a vista de cima sem rotação.
- O pincel acompanha a posição do terreno mesmo com a câmera girada. WebGL renderiza o relevo; navegadores sem esse recurso usam a vista plana com rotação.
- Pradarias, copas de árvores, areia, rochas, neve e água têm detalhes procedurais alinhados ao mundo. Texturas, sombras e curvas de nível podem ser alternadas no painel direito.

## Construção e edição

- **Água:** em Terreno, selecione Água e clique no fundo de uma depressão. **Preencher até a borda** calcula o nível mais baixo de saída; desmarque para informar uma altitude manual. Preenche apenas a área conectada abaixo desse nível na região atual. O fundo é preservado, a superfície aparece em 3D e acompanha o JSON e a publicação. Use **Remover água** e clique no lago para remover toda a região conectada da camada e região atuais, preservando o terreno. Ctrl+Z desfaz a remoção.

- **Submapas planos:** a superfície não tem curvatura de planeta; relevo, árvores e arquitetura continuam em 3D, com câmera inclinada por padrão. clique em **Criar submapa plano** para criar uma cidade, dungeon ou interior vazio com suas próprias camadas, terreno, marcadores e ferramentas. Desenhe normalmente; **Salvar submapa e voltar** grava o interior como projeto plano separado. Selecione-o na lista e use **Fixar entrada no planeta** para definir o portal clicável. O JSON e a publicação incluem o pacote do planeta e todos os submapas. Pacotes antigos com interiores embutidos continuam aceitos.

- Em **Árvores e florestas**, escolha floresta de copas, coqueiral de praia, pinheiros, floresta mágica de cristais, floresta outonal ou selva tropical e pinte com **Pintar vegetação**. Cada tipo tem sua cor de copa; os troncos também aceitam qualquer cor.
- **Novas copas** e **Novos troncos** configuram as próximas árvores. As árvores já pintadas preservam suas próprias cores, inclusive após salvar, reabrir ou mudar a paleta. Projetos antigos sem cores individuais passam a preservar a paleta que tinham ao serem abertos.
- Use **Seletor** e clique em uma construção, marcador, texto, caminho, túnel ou árvore 3D. Arraste para mover, ou ajuste X/Y no painel **Objeto selecionado**. Escolha a camada de destino e clique em **Mover para camada**. Use **Excluir seleção** ou a tecla **Delete** para remover o item ou grupo selecionado. Camadas bloqueadas impedem alterações; Ctrl+Z/Ctrl+Y desfazem e refazem até **20 ações**, incluindo exclusões, movimentos e transferências.
- Para recolorir uma árvore existente, selecione-a e altere **Cor** ou **Tronco** no painel da seleção. Essa edição afeta somente a árvore escolhida. Árvores individuais podem ser movidas sem deslocar a pintura da floresta.
- Em **Cores do mundo**, personalize grama, chão da floresta, areia, rocha, neve, água e lava. A paleta também colore o terreno automático. As cores e os tipos ficam salvos no JSON e são reproduzidos no visualizador.
- A vegetação pintada gera automaticamente pequenas árvores com troncos, copas e folhas em geometria 3D. Coqueiros têm folhas abertas, pinheiros têm copas cônicas e a floresta mágica tem copas cristalinas. A vegetação acompanha o relevo e respeita a visibilidade das camadas; uma camada de terreno que cobre a floresta também cobre suas árvores. Mapas antigos encaixados como imagens mantêm sua textura original.

- **Terreno**, **Elevar**, **Rebaixar**, **Suavizar** e **Platô** modificam os biomas e a altitude da camada selecionada.
- A paleta inclui **Lava**. Em **Cores do mundo**, ajuste separadamente a grama, as copas das árvores, a água e a lava; o ajuste aparece no relevo e nas texturas.
- **Túnel**: toque ou clique na entrada e depois na saída. Ajuste a largura pelo pincel e a profundidade no painel de túneis. Escape cancela a primeira entrada.
- Túneis são representados por portais conectados e uma rota subterrânea tracejada; a profundidade é uma anotação. O editor não simula escavação volumétrica ou navegação no interior. Desmarque **Mostrar rotas subterrâneas** para exibir apenas os portais.
- Casas, vilas, castelos, pontes, cavernas e outros marcadores podem ser inseridos em qualquer camada editável. Construções, marcadores e textos são objetos separados, ancorados na altitude do terreno. Seus desenhos planos ficam de frente para a câmera e diminuem conforme o zoom se afasta; legendas muito pequenas deixam de aparecer para evitar excesso visual.
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
- **Google Drive:** na versão online, clique em **Conectar Drive**. Em **Meus mapas**, busque pelo nome, navegue pelas pastas e escolha **Abrir**. A biblioteca exibe arquivos e pastas autorizados para o aplicativo; **Nova pasta** cria uma pasta para organizar seus mapas. **Salvar no Drive** atualiza o arquivo em edição; mapas novos ou importados de JSON local criam um arquivo novo. **Salvar cópia** permite escolher nome e pasta, preservando o original. O envio mostra progresso e tenta retomar interrupções.
- **Mapa padrão do Drive:** use **Usar como padrão** na biblioteca ou **Usar atual como padrão** no painel. Somente esse mapa será aberto automaticamente ao iniciar. Abrir ou salvar outros mapas não altera essa preferência; **Remover padrão** desativa a abertura automática. Ao trocar de mapa com alterações pendentes, escolha salvar, descartar ou cancelar. O salvamento automático pode ser desligado no painel e só atua em arquivos já vinculados e editáveis.
- **Configuração da hospedagem:** os endpoints `api/drive` usam `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `DRIVE_SESSION_SECRET`. Cadastre a URL `/api/drive/callback` do domínio publicado como redirecionamento OAuth. A sessão usa cookie protegido; nenhuma chave secreta deve ser incluída no código do navegador.
- O botão **Salvar JSON** continua disponível como cópia local. O formato do projeto continua na versão 4, com os novos campos opcionais de tema, e versões anteriores continuam aceitas.
- **Exportar planta (PNG)** gera o planeta aberto em 8.000 × 4.400 pixels quando o modo esférico está ativo; no modo plano, gera 1.600 × 1.100 pixels.
- **Exportar imagem** salva a perspectiva e o enquadramento atuais, incluindo ícones e textos visíveis na face voltada à câmera. **Exportar esta vista** faz a mesma exportação. O maior lado chega a 4096 pixels, conforme o limite WebGL do dispositivo.
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

`planet_browser.py` verifica o planeta, a seleção, a ocultação dos marcadores, o encaixe de PNG, a reabertura do JSON e a exportação em alta resolução com Chrome headless. O script usa o módulo Python `websocket-client` apenas na validação.

Os resultados ficam em `validation-results.json`. Layout e gestos foram verificados com emulação de celular; desempenho, downloads e gestos em Android/iPhone físicos ainda precisam ser conferidos no aparelho.

O planeta inteiro é editável em resolução local, com regiões criadas conforme a pintura. As regiões externas guardam relevo, vegetação, marcadores e arquitetura no JSON e aparecem no visualizador. O pincel atravessa a emenda de longitude e ajusta sua largura próximo aos polos. Projetos antigos mantêm a região central na posição original.

### Região em plano temporário

Na navegação do mapa, use o ícone de seleção de região. Arraste sobre o planeta para delimitar a área ou clique para abrir uma região local. O editor permite editar esse mesmo terreno em plano; o visualizador permite explorá-lo. Clique novamente no ícone ou pressione Esc para voltar ao planeta. As edições permanecem no mundo original; essa vista não cria um submapa separado.
