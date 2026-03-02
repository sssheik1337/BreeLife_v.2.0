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
void ensureTelegramAuthSession({ reason: 'app-start' });
const runtimeWindow = window as SpaNavigationWindow;

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

app.mount('#app');
