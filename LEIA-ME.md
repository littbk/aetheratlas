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
- Não há salvamento automático. Salve antes de fechar a aba. Os projetos novos usam a versão 4 e requerem este editor atualizado.
- **Exportar planta (PNG)**, no painel da câmera, gera o mapa de cima em 1600 × 1100 pixels, respeitando camadas e opacidade, independentemente da câmera.
- **Exportar imagem**, no topo, salva a perspectiva, rotação, zoom e enquadramento atuais, incluindo os ícones e textos voltados à câmera, sem controles nem indicadores temporários. **Exportar esta vista**, no painel da câmera, faz a mesma exportação. A imagem usa a resolução do visor, com densidade de pixels limitada a 2.
- **Exportar mapa de altura** gera 400 × 275 pixels: preto = −500 m e branco = 3.000 m. Áreas sem altitude definida ficam transparentes.

O mapa é um campo de alturas com até 16 camadas. Novos textos e construções são objetos independentes; para reposicioná-los, desfaça e reinsira. Elementos de projetos antigos que já foram gravados na imagem continuam rasterizados: um PNG não contém as posições e os textos originais para separá-los automaticamente. O exemplo e os materiais são originais, desenhados por código.

## Validação

`validate_browser.py` verifica o editor com Chrome headless e DevTools: câmera, escultura, construções, túneis, desfazer/refazer, exportação, compatibilidade e gestos mobile. O script de desenvolvimento usa o módulo Python `websocket-client` já disponível no ambiente de validação; ele não é necessário para usar o editor.

Os resultados ficam em `validation-results.json`. Layout e gestos foram verificados com emulação de celular; desempenho, downloads e gestos em Android/iPhone físicos ainda precisam ser conferidos no aparelho.
