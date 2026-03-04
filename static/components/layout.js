class CustomLayout extends HTMLElement {
  connectedCallback() {
    // Помечаем корневой scroll-контейнер для принудительного сброса прокрутки при старте.
    this.classList.add('app-content');
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          height: 100%;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }

        .app-layout {
          min-height: 100%;
          display: flex;
          flex-direction: column;
          background: var(--tg-bg-color, #f8fafc);
          color: var(--tg-text-color, #0f172a);
          padding-top: var(--header-height, 72px);
          padding-bottom: 0;
        }
        
        .main-content {
          flex: 1;
          width: 100%;
          max-width: 420px;
          margin: 0 auto;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
        }
        
        @media (max-width: 640px) {
          .main-content {
            padding: 1.25rem;
          }
        }
      </style>
      
      <div class="app-layout">
        <slot></slot>
      </div>
    `;
    
    // Layout doesn't need content, it's just a wrapper
  }
}

customElements.define('custom-layout', CustomLayout);

(function installLegacyNotificationBridge() {
  if (typeof window.showNotification === 'function') {
    return;
  }

  const getCssPxVariable = (name, fallback = 0) => {
    const value = window.getComputedStyle(document.documentElement).getPropertyValue(name);
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const computeTopOffset = () => {
    const safeTop = getCssPxVariable('--tg-safe-top', 0);
    const uiTop = getCssPxVariable('--tg-ui-top', 0);
    const rawTop = Math.round(72 + safeTop + uiTop + 12);
    const maxTop = Math.max(12, window.innerHeight - 96);
    return Math.min(Math.max(rawTop, 12), maxTop);
  };

  const applyContainerStyles = (container) => {
    container.style.setProperty('position', 'fixed', 'important');
    container.style.setProperty('top', `${computeTopOffset()}px`, 'important');
    container.style.setProperty('right', '12px', 'important');
    container.style.setProperty('left', 'auto', 'important');
    container.style.setProperty('bottom', 'auto', 'important');
    container.style.setProperty('z-index', '2147483647', 'important');
    container.style.setProperty('width', 'min(320px, calc(100vw - 24px))', 'important');
    container.style.setProperty('display', 'flex', 'important');
    container.style.setProperty('flex-direction', 'column', 'important');
    container.style.setProperty('align-items', 'flex-end', 'important');
    container.style.setProperty('pointer-events', 'none', 'important');
    container.style.setProperty('visibility', 'visible', 'important');
    container.style.setProperty('opacity', '1', 'important');
    container.style.setProperty('isolation', 'isolate', 'important');
  };

  const ensureContainer = () => {
    let container = document.getElementById('notification-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'notification-container';
      (document.documentElement || document.body).appendChild(container);
    }
    applyContainerStyles(container);
    return container;
  };

  window.showNotification = (message, type = 'success') => {
    const text = String(message || '').trim();
    if (!text) {
      return;
    }

    const tone = type === 'error' || type === 'warning' ? type : 'success';
    const bgColor = tone === 'success' ? '#10b981' : (tone === 'warning' ? '#f59e0b' : '#ef4444');
    const container = ensureContainer();
    window.__lastSpaNotification = { message: text, tone, at: Date.now() };

    const toast = document.createElement('div');
    toast.textContent = text;
    toast.style.background = bgColor;
    toast.style.color = '#ffffff';
    toast.style.padding = '14px 16px';
    toast.style.borderRadius = '14px';
    toast.style.marginBottom = '10px';
    toast.style.maxWidth = '100%';
    toast.style.boxShadow = '0 10px 26px rgba(15, 23, 42, 0.28)';
    toast.style.pointerEvents = 'auto';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-8px)';
    toast.style.transition = 'transform 180ms ease, opacity 180ms ease';
    toast.style.wordBreak = 'break-word';
    toast.style.display = 'block';
    toast.style.visibility = 'visible';

    container.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-6px)';
      setTimeout(() => {
        toast.remove();
      }, 180);
    }, 3000);
  };

  if (window.__notificationLogBridgeInstalled !== true) {
    const originalConsoleLog = console.log.bind(console);
    console.log = (...args) => {
      try {
        const first = typeof args[0] === 'string' ? args[0].trim() : '';
        if (first === 'Приём пищи сохранён.' || first === 'Вода сохранена.' || first === 'Добавьте хотя бы один продукт.') {
          window.showNotification(first, first === 'Добавьте хотя бы один продукт.' ? 'error' : 'success');
        }
      } catch (_) {
      }
      return originalConsoleLog(...args);
    };
    window.__notificationLogBridgeInstalled = true;
  }

  window.addEventListener('resize', () => {
    const container = document.getElementById('notification-container');
    if (container) {
      applyContainerStyles(container);
    }
  }, { passive: true });
})();
