(() => {
  const form = document.querySelector('[data-contact-form]');
  if (!form) return;

  form.addEventListener('submit', (ev) => {
    const action = form.getAttribute('action');
    if (action && action.trim().length > 0) {
      return; // let the host handle submission
    }

    ev.preventDefault();

    const mailto = form.getAttribute('data-mailto') || '';
    if (!mailto) {
      alert('Please set a contact email on the form.');
      return;
    }

    const data = new FormData(form);
    const name = String(data.get('name') || '');
    const email = String(data.get('email') || '');
    const subject = String(data.get('subject') || 'Website inquiry');
    const message = String(data.get('message') || '');

    const body = [
      `Name: ${name}`,
      `Email: ${email}`,
      '',
      message,
    ].join('\n');

    const href = `mailto:${encodeURIComponent(mailto)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
  });
})();

(() => {
  const panels = Array.from(document.querySelectorAll('[data-inspiration]'));
  if (!panels.length) return;

  panels.forEach((panel) => {
    const base = String(panel.getAttribute('data-base') || '');
    const raw = String(panel.getAttribute('data-images') || '');
    const version = String(panel.getAttribute('data-version') || '').trim();
    const files = raw.split('|').map((v) => v.trim()).filter(Boolean);
    if (!files.length) return;

    const img = panel.querySelector('[data-inspiration-image]');
    const count = panel.querySelector('[data-inspiration-count]');
    const prev = panel.querySelector('[data-inspiration-prev]');
    const next = panel.querySelector('[data-inspiration-next]');
    if (!img) return;

    const basePath = base && !base.endsWith('/') ? `${base}/` : base;
    let idx = 0;

    const render = () => {
      const file = files[idx];
      const qs = version ? `?v=${encodeURIComponent(version)}` : '';
      const src = `${basePath}${encodeURIComponent(file)}${qs}`;
      img.setAttribute('src', src);
      img.setAttribute('alt', `Inspiration ${idx + 1}`);
      if (count) count.textContent = `${idx + 1} / ${files.length}`;
    };

    const step = (dir) => {
      idx = (idx + dir + files.length) % files.length;
      render();
    };

    prev && prev.addEventListener('click', () => step(-1));
    next && next.addEventListener('click', () => step(1));

    render();
  });
})();
