(() => {
  'use strict';
  const config = window.ATLAS_ADS || {};
  const banner = document.getElementById('adBanner');
  const content = document.getElementById('adContent');
  if (!banner || !content) return;

  const local = location.protocol === 'file:' ||
    ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const preview = new URLSearchParams(location.search).get('ads') === 'preview' ||
    (local && config.previewLocal);
  const updateSpace = () => document.documentElement.style.setProperty(
    '--ad-space', `${banner.hidden ? 0 : banner.getBoundingClientRect().height}px`);
  const hide = () => { banner.hidden = true; updateSpace(); };
  new ResizeObserver(updateSpace).observe(banner);

  if (preview) {
    content.classList.add('ad-preview');
    content.textContent = 'Prévia do espaço publicitário';
    banner.hidden = false;
    updateSpace();
    return;
  }

  // Não requisitar anúncios reais em arquivos locais ou sem configuração válida.
  if (local || !['http:', 'https:'].includes(location.protocol) || !config.enabled) return;
  if (!/^ca-pub-\d{16}$/.test(config.client)) {
    console.warn('AdSense: configure client em ads-config.js.');
    return;
  }
  let unit, observer;
  // O script da conta pode carregar antes de o ID do bloco ser fornecido.
  // A menor unidade precisa de 320 px, além das margens laterais.
  if (/^\d+$/.test(config.slot) && window.innerWidth >= 344) {
    unit = document.createElement('ins');
    unit.className = 'adsbygoogle atlas_ad_unit';
    unit.dataset.adClient = config.client;
    unit.dataset.adSlot = config.slot;
    content.append(unit);
    banner.hidden = false;
    updateSpace();
    observer = new MutationObserver(() => {
      if (unit.dataset.adStatus === 'unfilled') {
        observer.disconnect();
        hide();
      }
    });
    observer.observe(unit, { attributes: true, attributeFilter: ['data-ad-status'] });
  }

  const script = document.createElement('script');
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.client}`;
  script.onload = () => {
    if (!unit) return;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); }
    catch (error) { observer?.disconnect(); hide(); console.warn('AdSense indisponível.', error); }
  };
  script.onerror = () => { observer?.disconnect(); hide(); };
  document.head.append(script);
})();
