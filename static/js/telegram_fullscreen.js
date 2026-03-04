(() => {
  try {
    const root = document.documentElement;
    const telegram = window.Telegram;
    const tg = telegram && telegram.WebApp ? telegram.WebApp : null;

    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta && typeof viewportMeta.getAttribute === 'function') {
      const currentContent = viewportMeta.getAttribute('content') || 'width=device-width, initial-scale=1.0';
      const normalized = currentContent
        .replace(/,\s*maximum-scale\s*=\s*[^,]+/gi, '')
        .replace(/,\s*user-scalable\s*=\s*[^,]+/gi, '')
        .trim();
      viewportMeta.setAttribute('content', `${normalized}, maximum-scale=1, user-scalable=no`);
    }

    let lastTouchEndAt = 0;
    document.addEventListener(
      'touchend',
      (event) => {
        const now = Date.now();
        if (now - lastTouchEndAt <= 300) {
          event.preventDefault();
        }
        lastTouchEndAt = now;
      },
      { passive: false },
    );
    document.addEventListener(
      'dblclick',
      (event) => {
        event.preventDefault();
      },
      { passive: false },
    );

    if (!tg) {
      return;
    }
    const applySafeInsets = () => {
      const viewportHeight = Number(tg.viewportHeight);
      const viewportStableHeight = Number(tg.viewportStableHeight);
      const viewportDeltaTop = Number.isFinite(viewportHeight) && Number.isFinite(viewportStableHeight)
        ? Math.max(viewportHeight - viewportStableHeight, 0)
        : 0;
      const safeAreaTop = Number(tg.safeAreaInset?.top);
      const contentSafeAreaTop = Number(tg.contentSafeAreaInset?.top);
      const safeTopCandidates = [viewportDeltaTop, safeAreaTop, contentSafeAreaTop]
        .filter((value) => Number.isFinite(value) && value >= 0);
      const safeTop = safeTopCandidates.length > 0 ? Math.max(...safeTopCandidates) : 0;
      root.style.setProperty('--tg-safe-top', `${safeTop}px`);

      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      const isExpanded = Boolean(tg.isExpanded || tg.isFullscreen);
      root.style.setProperty('--tg-ui-top', isIOS && isExpanded ? '48px' : '0px');
    };

    applySafeInsets();

    if (typeof tg.ready === 'function') {
      tg.ready();
    }
    if (typeof tg.expand === 'function') {
      tg.expand();
    }
    if (
      typeof tg.requestFullscreen === 'function'
      && typeof tg.isVersionAtLeast === 'function'
      && tg.isVersionAtLeast('8.0')
    ) {
      tg.requestFullscreen();
    }
    applySafeInsets();

    if (typeof tg.onEvent === 'function') {
      ['viewport_changed', 'safe_area_changed', 'content_safe_area_changed', 'fullscreen_changed'].forEach((eventName) => {
        tg.onEvent(eventName, applySafeInsets);
      });
    }
  } catch (_error) {
    // no-op
  }
})();
