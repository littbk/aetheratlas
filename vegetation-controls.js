'use strict';
// Editor palette: each species retains its color in the project theme.
const forestPanel=document.createElement('details');forestPanel.className='brush-panel';forestPanel.open=true;
forestPanel.innerHTML='<summary>ÁRVORES E FLORESTAS</summary><label for="forestType">Vegetação do pincel</label><select id="forestType"><option value="forest">Floresta de copas</option><option value="palms">Coqueiral de praia</option><option value="pines">Floresta de pinheiros</option><option value="magic">Floresta mágica · cristais</option><option value="autumn">Floresta outonal</option><option value="jungle">Selva tropical</option><option value="snowForest">Floresta de neve · pinheiros nevados</option></select><div class="world-colors"><label>Novas copas <input id="foliageColor" type="color"></label><label>Novos troncos <input id="trunkColor" type="color"></label></div><p class="muted">Estas cores valem para as próximas árvores. Para recolorir uma árvore existente, use o Seletor.</p><button id="paintForest" type="button">♣ Pintar vegetação</button>';
$('palette').after(forestPanel);
const worldColors=$('grassColor').closest('details');worldColors.open=true;forestPanel.after(worldColors);
function syncVegetationColors(){
  const theme=Terrain.getTheme(),key=$('forestType').value==='forest'?'trees':$('forestType').value;
  $('foliageColor').value=theme[key];$('trunkColor').value=theme.trunk;
  for(const [id,k] of [['grassColor','grass'],['treeColor','trees'],['forestColor','forest'],['sandColor','sand'],['rockColor','rock'],['snowColor','snow'],['waterColor','water'],['lavaColor','lava']])$(id).value=theme[k];
  document.querySelectorAll('#palette .swatch i').forEach((el,i)=>{const key=['grass','trees','sand','rock','snow','water','lava'][i];if(!key)return;const color=theme[key],rgb=[1,3,5].map(n=>parseInt(color.slice(n,n+2),16));el.style.background=color;el.style.color=rgb[0]*.299+rgb[1]*.587+rgb[2]*.114>125?'#263b35':'#f0f3de';});
}
window.syncVegetationColors=syncVegetationColors;
function chooseForest(){selectedBiome=$('forestType').value;document.querySelector('[data-tool="brush"]').click();document.querySelectorAll('.swatch').forEach(b=>b.classList.toggle('selected',b.dataset.biome===selectedBiome));syncVegetationColors();}
$('forestType').onchange=chooseForest;$('paintForest').onclick=chooseForest;
$('foliageColor').oninput=()=>{Terrain.freezeLayers(layers);const key=$('forestType').value==='forest'?'trees':$('forestType').value;Terrain.setTheme({...Terrain.getTheme(),[key]:$('foliageColor').value});changed();};
$('trunkColor').oninput=()=>{Terrain.freezeLayers(layers);Terrain.setTheme({...Terrain.getTheme(),trunk:$('trunkColor').value});changed();};
syncVegetationColors();
