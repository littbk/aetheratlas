const $ = id => document.getElementById(id);
const stage = $('stage'), image = $('mapImage');
const state = { scale: 1, rotation: 0, x: 0, y: 0, base: 1, pointers: new Map(), drag: null };
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function apply() {
  image.style.transform = `translate(calc(-50% + ${state.x}px), calc(-50% + ${state.y}px)) rotate(${state.rotation}deg) scale(${state.scale})`;
  $('zoomRead').textContent = `${Math.round(state.scale * 100)}%`;
}
function fit() {
  if (!image.naturalWidth || !stage.clientWidth) return;
  state.base = Math.min(stage.clientWidth / image.naturalWidth, stage.clientHeight / image.naturalHeight) * .9;
  state.scale = clamp(state.base, .1, 3); state.x = 0; state.y = 0; state.rotation = 0; apply();
}
function zoom(delta) { state.scale = clamp(state.scale * delta, state.base * .45, Math.max(state.base * 5, 3)); apply(); }
function pointerDistance() { const points = [...state.pointers.values()]; return points.length > 1 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0; }

stage.addEventListener('wheel', event => { event.preventDefault(); zoom(event.deltaY > 0 ? .88 : 1.14); }, { passive: false });
stage.addEventListener('pointerdown', event => { stage.setPointerCapture(event.pointerId); state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); state.drag = { x: event.clientX, y: event.clientY, mapX: state.x, mapY: state.y, distance: pointerDistance(), scale: state.scale }; stage.classList.add('dragging'); });
stage.addEventListener('pointermove', event => { if (!state.pointers.has(event.pointerId) || !state.drag) return; state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); if (state.pointers.size > 1) { const distance = pointerDistance(); state.scale = clamp(state.drag.scale * distance / Math.max(1, state.drag.distance), state.base * .45, Math.max(state.base * 5, 3)); } else { state.x = state.drag.mapX + event.clientX - state.drag.x; state.y = state.drag.mapY + event.clientY - state.drag.y; } apply(); });
function endPointer(event) { state.pointers.delete(event.pointerId); state.drag = null; stage.classList.remove('dragging'); }
stage.addEventListener('pointerup', endPointer); stage.addEventListener('pointercancel', endPointer);
$('zoomIn').onclick = () => zoom(1.2); $('zoomOut').onclick = () => zoom(.82); $('reset').onclick = fit;
$('rotateLeft').onclick = () => { state.rotation -= 15; apply(); }; $('rotateRight').onclick = () => { state.rotation += 15; apply(); };

async function request(url, options) { const response = await fetch(url, options); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a operação.'); return data; }
function showAdmin(admin) { $('loginPanel').hidden = admin; $('publishPanel').hidden = !admin; }
async function loadMap() {
  try {
    const { map } = await request('/api/map');
    $('viewer').hidden = !map; $('empty').hidden = !!map;
    if (!map) return;
    $('mapTitle').textContent = map.title; $('mapNote').textContent = map.note; $('updated').textContent = `ATUALIZADO EM ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(map.updatedAt))}`;
    image.alt = map.title; image.onload = fit; image.src = `${map.imageUrl}${map.imageUrl.includes('?') ? '&' : '?'}v=${encodeURIComponent(map.updatedAt)}`;
  } catch { $('viewer').hidden = true; $('empty').hidden = false; }
}
$('help').onclick = () => $('guide').showModal();
document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => $(button.dataset.close).close());
$('adminOpen').onclick = async () => { $('adminDialog').showModal(); try { showAdmin((await request('/api/session')).admin); } catch { showAdmin(false); } };
$('loginForm').onsubmit = async event => { event.preventDefault(); const button = event.submitter; button.disabled = true; try { await request('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('password').value }) }); $('password').value = ''; showAdmin(true); } catch (error) { alert(error.message); } finally { button.disabled = false; } };
$('logout').onclick = async () => { await request('/api/logout', { method: 'POST' }); showAdmin(false); };
$('publishForm').onsubmit = async event => { event.preventDefault(); const button = $('publish'); button.disabled = true; $('adminStatus').textContent = 'Enviando e publicando o mapa…'; try { await request('/api/map', { method: 'POST', body: new FormData(event.currentTarget) }); $('adminStatus').textContent = 'Mapa publicado para os jogadores.'; event.currentTarget.reset(); await loadMap(); } catch (error) { $('adminStatus').textContent = error.message; } finally { button.disabled = false; } };
$('removeMap').onclick = async () => { if (!confirm('Remover o mapa público? A imagem continuará guardada na biblioteca privada da Vercel.')) return; try { await request('/api/map', { method: 'DELETE' }); $('adminDialog').close(); await loadMap(); } catch (error) { $('adminStatus').textContent = error.message; } };
new ResizeObserver(fit).observe(stage); loadMap();
