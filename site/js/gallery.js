(() => {
  const galleries = document.querySelectorAll('[data-gallery]');
  if (!galleries.length) return;

  const lightbox = document.createElement('div');
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

  const lightboxImg = lightbox.querySelector('.lightbox-img');
  const btnPrev = lightbox.querySelector('.lightbox-btn.prev');
  const btnNext = lightbox.querySelector('.lightbox-btn.next');
  const btnClose = lightbox.querySelector('.lightbox-close');

  let activeList = [];
  let activeIndex = 0;

  const setImage = () => {
    const item = activeList[activeIndex];
    if (!item || !lightboxImg) return;
    lightboxImg.setAttribute('src', item.src);
    lightboxImg.setAttribute('alt', item.alt || '');
  };

  const openLightbox = (list, index) => {
    if (!list.length) return;
    activeList = list;
    activeIndex = Math.max(0, Math.min(index, list.length - 1));
    setImage();
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
  };

  const showNext = () => {
    activeIndex = (activeIndex + 1) % activeList.length;
    setImage();
  };

  const showPrev = () => {
    activeIndex = (activeIndex - 1 + activeList.length) % activeList.length;
    setImage();
  };

  btnNext?.addEventListener('click', showNext);
  btnPrev?.addEventListener('click', showPrev);
  btnClose?.addEventListener('click', closeLightbox);

  lightbox.addEventListener('click', (ev) => {
    if (ev.target === lightbox) closeLightbox();
  });

  window.addEventListener('keydown', (ev) => {
    if (!lightbox.classList.contains('open')) return;
    if (ev.key === 'Escape') closeLightbox();
    if (ev.key === 'ArrowRight') showNext();
    if (ev.key === 'ArrowLeft') showPrev();
  });

  const getGalleryItems = (gallery, thumbs) => {
    const base = gallery.getAttribute('data-base') || '';
    const dataImages = gallery.getAttribute('data-images');

    if (dataImages) {
      const list = dataImages
        .split('|')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((file) => ({
          src: `${base}${encodeURIComponent(file)}`,
          alt: '',
        }));

      if (list.length) return list;
    }

    return thumbs
      .map((btn) => ({
        src: btn.getAttribute('data-src') || '',
        alt: btn.getAttribute('data-alt') || '',
      }))
      .filter((item) => item.src);
  };

  galleries.forEach((gallery) => {
    const heroImg = gallery.querySelector('[data-hero-img]');
    const heroCaption = gallery.querySelector('[data-hero-caption]');
    const thumbs = Array.from(gallery.querySelectorAll('[data-thumb]'));

    if (!heroImg || !thumbs.length) return;

    const items = getGalleryItems(gallery, thumbs);

    thumbs.forEach((btn) => {
      btn.addEventListener('click', () => {
        thumbs.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const src = btn.getAttribute('data-src') || '';
        const alt = btn.getAttribute('data-alt') || '';
        const caption = btn.getAttribute('data-caption') || '';

        if (src) heroImg.setAttribute('src', src);
        heroImg.setAttribute('alt', alt);
        if (heroCaption) heroCaption.textContent = caption;
      });
    });

    heroImg.addEventListener('click', () => {
      const currentSrc = heroImg.getAttribute('src') || '';
      const startIndex = Math.max(0, items.findIndex((item) => item.src === currentSrc));
      openLightbox(items, startIndex === -1 ? 0 : startIndex);
    });
  });
})();
