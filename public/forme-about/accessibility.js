(() => {
  const dialog = document.getElementById('forme-manifesto');
  const close = document.getElementById('forme-close-manifesto');
  if (!dialog || !close) return;
  const pause = () => { window.scene?.pauseScene?.(); window.lenis?.stop?.(); };
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { if (!reduce.matches) window.scene?.resumeScene?.(); else window.scene?.pauseScene?.(); window.lenis?.start?.(); });
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce.matches) {
    dialog.showModal();
    // The existing 3D scene loads asynchronously. Pause it after initialization too.
    let checks = 0;
    const timer = window.setInterval(() => {
      if (dialog.open) pause();
      if (++checks >= 40 || !dialog.open) window.clearInterval(timer);
    }, 250);
  }
})();
