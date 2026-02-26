import { createApp } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { installWindowBridge } from './legacyBridge/windowBridge';
import { useAppStateStore } from './stores/appStateStore';

type SpaNavigationWindow = Window & {
  spaNavigate?: (path: string) => Promise<unknown> | void;
  spaReplace?: (path: string) => Promise<unknown> | void;
};

const app = createApp(App);

const pinia = createPinia();
app.use(pinia);

// Router guards and the legacy bridge use Pinia stores outside component setup.
setActivePinia(pinia);

const appStateStore = useAppStateStore();
appStateStore.hydrateFromLegacyWindow(window as any);
installWindowBridge(window, { preserveExisting: true });
app.use(router);

const runtimeWindow = window as SpaNavigationWindow;
runtimeWindow.spaNavigate = (path: string) => router.push(path);
runtimeWindow.spaReplace = (path: string) => router.replace(path);

app.mount('#app');
