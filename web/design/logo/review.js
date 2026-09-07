const designs = {
  a: { name: '文字のリズム', file: 'a-wordmark.svg' },
  b: { name: 'ストックの窓', file: 'b-window.svg' },
  c: { name: '余韻の輪', file: 'c-loop.svg' },
  b1: { name: '端正な窓', file: 'b1-balance.svg' },
  b2: { name: 'やわらかな窓', file: 'b2-soft.svg' },
  b3: { name: '切り抜きの窓', file: 'b3-solid.svg' },
};
const artwork = new Map();
const frame = document.querySelector('#preview');
let selected = document.querySelector('input[name="proposal"]:checked').value;
let theme = 'light';
let device = 'desktop';

function resizePreview() {
  const available = document.querySelector('.preview-area').clientWidth;
  const width = device === 'mobile' ? 390 : 1200;
  const height = device === 'mobile' ? 844 : 760;
  const scale = Math.min(available / width, 1);
  Object.assign(frame.style, { width: `${width}px`, height: `${height}px`, transform: `scale(${scale})` });
  Object.assign(document.querySelector('.frame-wrap').style, { width: `${width * scale}px`, height: `${height * scale}px` });
}

function paintPreview() {
  const doc = frame.contentDocument;
  const brand = doc?.querySelector('.brand');
  if (!brand || !artwork.has(selected)) return;
  brand.replaceChildren(artwork.get(selected).cloneNode(true));
  const svg = brand.querySelector('svg');
  Object.assign(svg.style, { display: 'block', width: '184px', maxWidth: '100%', height: 'auto' });
  let style = doc.querySelector('#logo-review-style');
  if (!style) {
    style = doc.createElement('style');
    style.id = 'logo-review-style';
    style.textContent = '.brand { min-height: 58px; } @media(max-width:700px) { .brand > svg { width:150px !important; } }';
    doc.head.appendChild(style);
  }
  doc.documentElement.dataset.theme = theme;
  doc.documentElement.dataset.themeMode = theme;
  doc.querySelector('#theme-toggle-label').textContent = theme === 'dark' ? 'ダーク' : 'ライト';
}

frame.addEventListener('load', paintPreview);
new ResizeObserver(resizePreview).observe(document.querySelector('.preview-area'));

for (const radio of document.querySelectorAll('input[name="proposal"]')) {
  const key = radio.value;
  const design = designs[key];
  const response = await fetch(`./assets/${design.file}`);
  if (!response.ok) throw new Error(`Unable to load ${design.file}`);
  const svg = new DOMParser().parseFromString(await response.text(), 'image/svg+xml').documentElement;
  artwork.set(key, svg);
  document.querySelectorAll(`[data-logo="${key}"]`).forEach((host, index) => {
    const instance = svg.cloneNode(true);
    // Every inline copy gets its own accessible title ID.
    const title = instance.querySelector('title');
    title.id = `title-${key}-${index}`;
    instance.setAttribute('aria-labelledby', title.id);
    if (host.dataset.format === 'icon') {
      instance.querySelector('[data-part="wordmark"]')?.remove();
      instance.setAttribute('viewBox', '0 0 72 80');
    }
    host.appendChild(instance);
  });
}

for (const radio of document.querySelectorAll('input[name="proposal"]')) {
  radio.addEventListener('change', () => {
    selected = radio.value;
    document.querySelector('#selection').textContent = `${selected.toUpperCase()} — ${designs[selected].name}`;
    document.querySelector('#download').href = `./assets/${designs[selected].file}`;
    paintPreview();
  });
}
for (const button of document.querySelectorAll('[data-theme], [data-device]')) {
  button.addEventListener('click', () => {
    if (button.dataset.theme) theme = button.dataset.theme;
    else device = button.dataset.device;
    for (const peer of button.parentElement.querySelectorAll('button')) peer.setAttribute('aria-pressed', String(peer === button));
    resizePreview();
    paintPreview();
  });
}
resizePreview();
paintPreview();
