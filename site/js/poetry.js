(() => {
  const poems = Array.from(document.querySelectorAll('.poem-accordion details'));
  if (!poems.length) return;

  poems.forEach((poem) => {
    poem.addEventListener('toggle', () => {
      if (!poem.open) return;
      poems.forEach((other) => {
        if (other !== poem) other.removeAttribute('open');
      });
    });
  });
})();
