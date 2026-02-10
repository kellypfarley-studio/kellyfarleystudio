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

  const ensureLightbox = () => {
    let lightbox = document.querySelector('.lightbox');
    if (!lightbox) {
      lightbox = document.createElement('div');
      lightbox.className = 'lightbox';
      lightbox.innerHTML = `
        <div class="lightbox-inner">
          <img class="lightbox-img" alt="" />
          <button class="lightbox-btn prev" aria-label="Previous image">‹</button>
          <button class="lightbox-btn next" aria-label="Next image">›</button>
          <button class="lightbox-close" aria-label="Close">✕</button>
        </div>
      `;
      document.body.appendChild(lightbox);
    }
    return {
      lightbox,
      img: lightbox.querySelector('.lightbox-img'),
      prev: lightbox.querySelector('.lightbox-btn.prev'),
      next: lightbox.querySelector('.lightbox-btn.next'),
      close: lightbox.querySelector('.lightbox-close'),
    };
  };

  const { lightbox, img: lightboxImg, prev: btnPrev, next: btnNext, close: btnClose } = ensureLightbox();
  let activeList = [];
  let activeIndex = 0;
  let timer = null;

  const setImage = () => {
    const item = activeList[activeIndex];
    if (!item || !lightboxImg) return;
    lightboxImg.setAttribute('src', item.src);
    lightboxImg.setAttribute('alt', item.alt || '');
  };

  const showNext = () => {
    activeIndex = (activeIndex + 1) % activeList.length;
    setImage();
  };

  const showPrev = () => {
    activeIndex = (activeIndex - 1 + activeList.length) % activeList.length;
    setImage();
  };

  const startSlideshow = () => {
    if (timer) window.clearInterval(timer);
    timer = window.setInterval(showNext, 3500);
  };

  const stopSlideshow = () => {
    if (timer) window.clearInterval(timer);
    timer = null;
  };

  const openLightbox = (list, index) => {
    if (!list.length) return;
    activeList = list;
    activeIndex = Math.max(0, Math.min(index, list.length - 1));
    setImage();
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
    startSlideshow();
  };

  const closeLightbox = () => {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
    stopSlideshow();
  };

  btnNext?.addEventListener('click', () => {
    showNext();
    startSlideshow();
  });
  btnPrev?.addEventListener('click', () => {
    showPrev();
    startSlideshow();
  });
  btnClose?.addEventListener('click', closeLightbox);

  lightbox.addEventListener('click', (ev) => {
    if (ev.target === lightbox) closeLightbox();
  });

  lightbox.addEventListener('mouseenter', stopSlideshow);
  lightbox.addEventListener('mouseleave', () => {
    if (lightbox.classList.contains('open')) startSlideshow();
  });

  window.addEventListener('keydown', (ev) => {
    if (!lightbox.classList.contains('open')) return;
    if (ev.key === 'Escape') closeLightbox();
    if (ev.key === 'ArrowRight') showNext();
    if (ev.key === 'ArrowLeft') showPrev();
  });

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

    img.addEventListener('click', () => {
      const qs = version ? `?v=${encodeURIComponent(version)}` : '';
      const list = files.map((file, i) => ({
        src: `${basePath}${encodeURIComponent(file)}${qs}`,
        alt: `Inspiration ${i + 1}`,
      }));
      openLightbox(list, idx);
    });

    render();
  });
})();
