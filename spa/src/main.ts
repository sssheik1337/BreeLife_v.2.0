import feather from 'feather-icons';
import './assets/tailwind.css';
import { createApp } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { installStorageBridge } from './legacyBridge/storageBridge';
import { useAppStateStore } from './stores/appStateStore';
import { useStorageStore } from './stores/storageStore';

type SpaNavigationWindow = Window & {
  spaNavigate?: (path: string) => Promise<unknown> | void;
  spaReplace?: (path: string) => Promise<unknown> | void;
  resetWindowScrollPosition?: () => void;
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
app.use(router);

const runtimeWindow = window as SpaNavigationWindow;
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

app.mount('#app');
