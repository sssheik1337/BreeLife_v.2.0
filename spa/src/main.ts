import feather from 'feather-icons';
import './assets/tailwind.css';
import { createApp } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { installStorageBridge } from './legacyBridge/storageBridge';
import { ensureTelegramAuthSession } from './platform/telegramAuth';
import { useAppStateStore } from './stores/appStateStore';
import { useStorageStore } from './stores/storageStore';

type SpaNavigationWindow = Window & {
  spaNavigate?: (path: string) => Promise<unknown> | void;
  spaReplace?: (path: string) => Promise<unknown> | void;
  resetWindowScrollPosition?: () => void;
  __SPA_CURRENT_PATH__?: string;
  __SPA_DOUBLE_TAP_ZOOM_PROTECTION_INSTALLED__?: boolean;
  __SPA_NOTIFICATION_BRIDGE_INSTALLED__?: boolean;
  showNotification?: (message: string, tone?: string) => void;
};

// Let legacy scripts detect that they are running inside the SPA shell.
(window as any).__SPA_MODE__ = true;
(window as any).__SPA_BASE__ = '/app';
(window as any).feather = (window as any).feather || feather;

const app = createApp(App);

const pinia = createPinia();
app.use(pinia);

// Router guards and the legacy bridge use Pinia stores outside component setup.
setActivePinia(pinia);

const appStateStore = useAppStateStore();
appStateStore.hydrateFromLegacyWindow(window as any);
const storageStore = useStorageStore();
installStorageBridge(window, storageStore);

const buildTimezonePayload = (): { tz_name: string | null; tz_offset_minutes: number } => {
  const tzNameRaw = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tzName = typeof tzNameRaw === 'string' && tzNameRaw.trim().length > 0 ? tzNameRaw.trim() : null;
  return {
    tz_name: tzName,
    tz_offset_minutes: new Date().getTimezoneOffset(),
  };
};

const syncUserTimezone = async (): Promise<void> => {
  try {
    await storageStore.apiFetch('/api/user/timezone', {
      method: 'POST',
      body: JSON.stringify(buildTimezonePayload()),
    });
  } catch {
    // Ignore timezone sync errors; reminders service has UTC fallback.
  }
};

void ensureTelegramAuthSession({ reason: 'app-start' }).finally(() => {
  void syncUserTimezone();
});
const runtimeWindow = window as SpaNavigationWindow;

const installNotificationBridge = (): void => {
  if (runtimeWindow.__SPA_NOTIFICATION_BRIDGE_INSTALLED__ === true) {
    return;
  }

  const getCssPxVariable = (name: string, fallback = 0): number => {
    const value = window.getComputedStyle(document.documentElement).getPropertyValue(name);
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const computeTopOffset = (): number => {
    const navbarHost = document.querySelector('custom-navbar') as HTMLElement | null;
    const navbarRoot = navbarHost?.shadowRoot ?? null;
    const navbarElement = navbarRoot?.querySelector('.navbar') as HTMLElement | null;
    if (navbarElement) {
      const rect = navbarElement.getBoundingClientRect();
      if (Number.isFinite(rect.bottom) && rect.bottom > 0) {
        return Math.round(rect.bottom + 12);
      }
    }

    const headerHeight = getCssPxVariable('--header-height', 0);
    if (headerHeight > 0) {
      return Math.round(headerHeight + 12);
    }

    const safeTop = getCssPxVariable('--tg-safe-top', 0);
    const uiTop = getCssPxVariable('--tg-ui-top', 0);
    return Math.round(72 + safeTop + uiTop + 12);
  };

  const applyContainerStyles = (container: HTMLDivElement): void => {
    const rawTop = computeTopOffset();
    const maxTop = Math.max(12, window.innerHeight - 96);
    const top = Math.min(Math.max(rawTop, 12), maxTop);

    container.style.setProperty('position', 'fixed', 'important');
    container.style.setProperty('top', `${top}px`, 'important');
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

  const ensureContainer = (): HTMLDivElement => {
    let container = document.getElementById('notification-container') as HTMLDivElement | null;
    if (!container) {
      container = document.createElement('div');
      container.id = 'notification-container';
      (document.documentElement || document.body).appendChild(container);
    }
    applyContainerStyles(container);
    return container;
  };

  const repositionContainer = (): void => {
    const container = document.getElementById('notification-container') as HTMLDivElement | null;
    if (!container) {
      return;
    }
    applyContainerStyles(container);
  };

  runtimeWindow.showNotification = (message: string, tone = 'success'): void => {
    const text = String(message ?? '').trim();
    if (!text) {
      return;
    }

    const type = tone === 'error' || tone === 'warning' ? tone : 'success';
    const container = ensureContainer();
    (runtimeWindow as Window & { __lastSpaNotification?: { message: string; tone: string; at: number } }).__lastSpaNotification = {
      message: text,
      tone: type,
      at: Date.now(),
    };
    requestAnimationFrame(repositionContainer);
    window.setTimeout(repositionContainer, 120);

    const notification = document.createElement('div');
    notification.style.background = type === 'success'
      ? '#10b981'
      : (type === 'warning' ? '#f59e0b' : '#ef4444');
    notification.style.color = '#ffffff';
    notification.style.padding = '14px 16px';
    notification.style.borderRadius = '14px';
    notification.style.marginBottom = '10px';
    notification.style.boxShadow = '0 8px 24px rgba(15, 23, 42, 0.22)';
    notification.style.pointerEvents = 'auto';
    notification.style.maxWidth = '100%';
    notification.style.wordBreak = 'break-word';
    notification.style.transform = 'translateY(-8px)';
    notification.style.opacity = '0';
    notification.style.transition = 'transform 180ms ease, opacity 180ms ease';
    notification.textContent = text;

    container.appendChild(notification);
    requestAnimationFrame(() => {
      notification.style.transform = 'translateY(0)';
      notification.style.opacity = '1';
    });

    window.setTimeout(() => {
      notification.style.transform = 'translateY(-6px)';
      notification.style.opacity = '0';
      window.setTimeout(() => {
        notification.remove();
      }, 180);
    }, 3000);
  };

  window.addEventListener('resize', repositionContainer, { passive: true });
  window.addEventListener('spa-route-changed', repositionContainer);
  runtimeWindow.__SPA_NOTIFICATION_BRIDGE_INSTALLED__ = true;
};

const installDoubleTapZoomProtection = (): void => {
  if (runtimeWindow.__SPA_DOUBLE_TAP_ZOOM_PROTECTION_INSTALLED__ === true) {
    return;
  }

  let lastTouchEndAt = 0;
  const isEditableTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) {
      return false;
    }
    return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
  };

  document.addEventListener('touchend', (event) => {
    if (event.touches && event.touches.length > 0) {
      return;
    }
    if (isEditableTarget(event.target)) {
      return;
    }

    const now = Date.now();
    if (now - lastTouchEndAt <= 300) {
      event.preventDefault();
    }
    lastTouchEndAt = now;
  }, { passive: false });

  document.addEventListener('dblclick', (event) => {
    if (isEditableTarget(event.target)) {
      return;
    }
    event.preventDefault();
  }, { passive: false });

  runtimeWindow.__SPA_DOUBLE_TAP_ZOOM_PROTECTION_INSTALLED__ = true;
};
app.use(router);
runtimeWindow.__SPA_CURRENT_PATH__ = router.currentRoute.value.path;
router.afterEach(() => {
  runtimeWindow.__SPA_CURRENT_PATH__ = router.currentRoute.value.path;
  window.dispatchEvent(new CustomEvent('spa-route-changed'));
});

runtimeWindow.resetWindowScrollPosition = () => {
  if (typeof window.scrollTo === 'function') {
    window.scrollTo(0, 0);
  }
  const scroller = document.querySelector('.app-content') as HTMLElement | null;
  if (scroller) {
    scroller.scrollTop = 0;
  }
};
runtimeWindow.spaNavigate = (path: string) => router.push(path);
runtimeWindow.spaReplace = (path: string) => router.replace(path);
installDoubleTapZoomProtection();
installNotificationBridge();

app.mount('#app');
