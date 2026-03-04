class CustomFooter extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .footer {
          margin-top: 0;
          padding: 2rem 1.5rem 1.5rem;
          background: white;
          border-top: 1px solid #f1f5f9;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        
        .footer-content {
          max-width: 420px;
          margin: 0 auto;
          text-align: center;
        }
        .footer-text {
          font-size: 0.875rem;
          color: #64748b;
          line-height: 1.5;
        }
        .copyright {
          font-size: 0.75rem;
          color: #94a3b8;
          margin-top: 1.5rem;
          padding-top: 1.5rem;
          border-top: 1px solid #f1f5f9;
        }
        
        @media (max-width: 640px) {
          .footer {
            padding: 1.75rem 1.25rem 1.25rem;
          }
          
        }

        .bottom-spacer {
          height: 0;
        }

        .bottom-nav {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          background: #ffffff;
          border-top: 1px solid #e2e8f0;
          box-shadow: 0 -6px 20px rgba(15, 23, 42, 0.08);
          padding: 0.5rem 1rem 0.75rem;
          z-index: 40;
        }

        .bottom-nav__inner {
          max-width: 420px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 0.5rem;
        }

        .bottom-link {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
          padding: 0.4rem 0.25rem;
          border-radius: 0.75rem;
          color: #64748b;
          font-size: 0.7rem;
          font-weight: 600;
          text-decoration: none;
        }

        .bottom-link__icon {
          font-size: 1.15rem;
          line-height: 1;
        }

        .bottom-link--active {
          color: #047857;
          background: #ecfdf3;
        }

        .bottom-link--disabled {
          color: #cbd5e1;
          background: #f8fafc;
          opacity: 0.6;
          pointer-events: none;
        }

        .bottom-fab {
          position: relative;
          top: -28px;
          width: 56px;
          height: 56px;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, #34d399, #06b6d4);
          color: white;
          font-size: 0;
          line-height: 0;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          box-shadow: 0 12px 24px rgba(16, 185, 129, 0.3);
          isolation: isolate;
          z-index: 2;
        }

        .bottom-fab::before,
        .faq-fab::before {
          content: '';
          position: absolute;
          inset: -2px;
          border-radius: inherit;
          padding: 2px;
          pointer-events: none;
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask-composite: exclude;
          animation: fab-ring-spin 4s linear infinite;
          z-index: 0;
        }

        .bottom-fab::before {
          background: conic-gradient(
            from 180deg,
            #6ee7b7,
            #34d399,
            #22d3ee,
            #34d399,
            #6ee7b7
          );
        }

        .bottom-fab__plus {
          position: relative;
          display: inline-flex;
          width: 22px;
          height: 22px;
          align-items: center;
          justify-content: center;
          z-index: 1;
        }

        .bottom-fab__plus::before,
        .bottom-fab__plus::after {
          content: '';
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          background: #ffffff;
          border-radius: 999px;
        }

        .bottom-fab__plus::before {
          width: 18px;
          height: 3px;
        }

        .bottom-fab__plus::after {
          width: 3px;
          height: 18px;
        }

        .bottom-fab:active {
          transform: scale(0.98);
        }

        .faq-fab {
          position: fixed;
          right: max(20px, calc((100vw - 420px) / 2 + 12px));
          bottom: 104px;
          width: 52px;
          height: 52px;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, #0ea5e9, #06b6d4);
          color: #ffffff;
          font-size: 28px;
          font-weight: 700;
          line-height: 1;
          display: none;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          box-shadow: 0 10px 24px rgba(14, 165, 233, 0.28);
          isolation: isolate;
          z-index: 58;
        }

        .faq-fab::before {
          background: conic-gradient(
            from 180deg,
            #7dd3fc,
            #38bdf8,
            #22d3ee,
            #0ea5e9,
            #7dd3fc
          );
        }

        .faq-fab__icon {
          position: relative;
          z-index: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }

        .faq-fab:active {
          transform: scale(0.98);
        }

        .fab-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.35);
          z-index: 55;
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          transition: opacity 0.24s ease, visibility 0ms linear 0.24s;
        }

        .fab-overlay.hidden {
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
        }

        .fab-overlay:not(.hidden) {
          opacity: 1;
          visibility: visible;
          pointer-events: auto;
          transition-delay: 0ms;
        }

        .faq-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.35);
          z-index: 55;
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          transition: opacity 0.24s ease, visibility 0ms linear 0.24s;
        }

        .faq-overlay.hidden {
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
        }

        .faq-overlay:not(.hidden) {
          opacity: 1;
          visibility: visible;
          pointer-events: auto;
          transition-delay: 0ms;
        }

        .fab-menu {
          position: fixed;
          left: 50%;
          bottom: 90px;
          transform: translate(-50%, 24px) scale(0.86);
          z-index: 60;
          background: #ffffff;
          border-radius: 18px;
          padding: 12px;
          width: min(380px, calc(100vw - 48px));
          box-shadow: 0 16px 32px rgba(15, 23, 42, 0.18);
          display: flex;
          flex-direction: column;
          gap: 10px;
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
        }

        .fab-menu.hidden {
          transform: translate(-50%, 24px) scale(0.86);
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          animation: none;
        }

        .fab-menu:not(.hidden) {
          visibility: visible;
          pointer-events: auto;
          animation: fab-menu-show 0.3s ease forwards;
        }

        .fab-menu__item {
          border: 1px solid rgba(16, 185, 129, 0.28);
          background: linear-gradient(135deg, #34d399 0%, #3b82f6 100%);
          border-radius: 12px;
          min-height: 58px;
          width: 100%;
          padding: 14px 18px;
          text-align: center;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 600;
          line-height: 1.2;
          color: #ffffff;
          cursor: pointer;
          box-shadow: 0 8px 16px rgba(52, 211, 153, 0.24);
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, filter 0.2s ease;
        }

        .fab-menu__item:hover {
          border-color: rgba(16, 185, 129, 0.35);
          box-shadow: 0 10px 18px rgba(52, 211, 153, 0.3);
          filter: brightness(1.03);
        }

        .fab-menu__item:active {
          transform: scale(0.99);
        }

        .faq-menu {
          position: fixed;
          left: 50%;
          bottom: 90px;
          transform: translate(-50%, 24px) scale(0.86);
          z-index: 60;
          background: #ffffff;
          border-radius: 18px;
          padding: 12px;
          width: min(380px, calc(100vw - 48px));
          box-shadow: 0 16px 32px rgba(15, 23, 42, 0.18);
          display: flex;
          flex-direction: column;
          gap: 10px;
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
        }

        .faq-menu.hidden {
          transform: translate(-50%, 24px) scale(0.86);
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          animation: none;
        }

        .faq-menu:not(.hidden) {
          visibility: visible;
          pointer-events: auto;
          animation: fab-menu-show 0.3s ease forwards;
        }

        .faq-menu__item {
          border: 1px solid rgba(16, 185, 129, 0.28);
          background: linear-gradient(135deg, #34d399 0%, #3b82f6 100%);
          border-radius: 12px;
          min-height: 58px;
          width: 100%;
          padding: 14px 18px;
          text-align: center;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 600;
          line-height: 1.2;
          color: #ffffff;
          cursor: pointer;
          box-shadow: 0 8px 16px rgba(52, 211, 153, 0.24);
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, filter 0.2s ease;
        }

        .faq-menu__item:hover {
          border-color: rgba(16, 185, 129, 0.35);
          box-shadow: 0 10px 18px rgba(52, 211, 153, 0.3);
          filter: brightness(1.03);
        }

        .faq-menu__item:active {
          transform: scale(0.99);
        }

        @keyframes fab-ring-spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        @keyframes fab-menu-show {
          0% {
            transform: translate(-50%, 24px) scale(0.86);
            opacity: 0;
          }
          50% {
            transform: translate(-50%, -2px) scale(1.03);
            opacity: 1;
          }
          80% {
            transform: translate(-50%, 1px) scale(0.98);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, 0) scale(1);
            opacity: 1;
          }
        }

        @keyframes fab-menu-hide {
          0% {
            transform: translate(-50%, 0) scale(1);
            opacity: 1;
            visibility: visible;
          }
          100% {
            transform: translate(-50%, 24px) scale(0.86);
            opacity: 0;
            visibility: hidden;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .fab-overlay,
          .fab-menu,
          .faq-overlay,
          .faq-menu {
            transition: none;
            animation: none;
          }

          .bottom-fab::before,
          .faq-fab::before {
            animation: none;
          }
        }

        @media (min-width: 768px) {
          .bottom-nav {
            left: 50%;
            transform: translateX(-50%);
            width: min(420px, 100%);
            border-radius: 1rem 1rem 0 0;
          }
        }
      </style>

      <footer class="footer">
        <div class="footer-content">
          <p class="footer-text">
            🌱 Делайте маленькие шаги каждый день к более здоровому себе.
          </p>
          <div class="copyright">
            © ${new Date().getFullYear()} Health Bloom • Сделано с ❤️ для здоровой жизни
          </div>
        </div>
      </footer>

      <div class="bottom-spacer" aria-hidden="true"></div>

      <nav class="bottom-nav" aria-label="Основная навигация">
        <div class="bottom-nav__inner">
          <a href="/resume" class="bottom-link" data-bottom-link="profile">
            <span class="bottom-link__icon" aria-hidden="true">👤</span>
            <span>Профиль</span>
          </a>
          <a href="/diary" class="bottom-link" data-bottom-link="diary">
            <span class="bottom-link__icon" aria-hidden="true">🍽️</span>
            <span>Дневник</span>
          </a>
          <a href="#" class="bottom-fab" aria-label="Добавить запись">
            <span class="bottom-fab__plus" aria-hidden="true"></span>
          </a>
          <a href="/meal-plan" class="bottom-link" data-bottom-link="meal-plan">
            <span class="bottom-link__icon" aria-hidden="true">📋</span>
            <span>Рацион</span>
          </a>
          <a href="/profile" class="bottom-link" data-bottom-link="progress">
            <span class="bottom-link__icon" aria-hidden="true">📊</span>
            <span>Прогресс</span>
          </a>
        </div>
      </nav>

      <div class="fab-overlay hidden" data-fab-overlay></div>
      <div class="fab-menu hidden" data-fab-menu>
        <button type="button" class="fab-menu__item" data-fab-action="meal" data-meal="breakfast">🍳 Добавить завтрак</button>
        <button type="button" class="fab-menu__item" data-fab-action="meal" data-meal="lunch">🍲 Добавить обед</button>
        <button type="button" class="fab-menu__item" data-fab-action="meal" data-meal="dinner">🍽️ Добавить ужин</button>
        <button type="button" class="fab-menu__item" data-fab-action="meal" data-meal="snack">🍎 Добавить перекус</button>
        <button type="button" class="fab-menu__item" data-fab-action="water">💧 Добавить воду</button>
        <button type="button" class="fab-menu__item" data-fab-action="sleep">🌙 Записать сон</button>
      </div>

      <a href="#" class="faq-fab" aria-label="Открыть разделы помощи и настроек">
        <span class="faq-fab__icon" aria-hidden="true">?</span>
      </a>
      <div class="faq-overlay hidden" data-faq-overlay></div>
      <div class="faq-menu hidden" data-faq-menu>
        <button type="button" class="faq-menu__item" data-faq-href="/settings/reminders">🔔 Напоминания</button>
        <button type="button" class="faq-menu__item" data-faq-href="/plans">💳 Тарифы</button>
        <button type="button" class="faq-menu__item" data-faq-href="/references">📚 Справочники</button>
        <button type="button" class="faq-menu__item" data-faq-href="/support">🛟 Помощь</button>
      </div>
    `;

    let hasCompletedProfile = window.profileCompleted === true;
    let hasPassedTrialGate = false;
    const isDevMode = window.appIsDev === true || window.appMode === 'development';

    const bottomLinks = {
      profile: this.shadowRoot.querySelector('[data-bottom-link="profile"]'),
      diary: this.shadowRoot.querySelector('[data-bottom-link="diary"]'),
      mealPlan: this.shadowRoot.querySelector('[data-bottom-link="meal-plan"]'),
      progress: this.shadowRoot.querySelector('[data-bottom-link="progress"]'),
    };
    const bottomFab = this.shadowRoot.querySelector('.bottom-fab');
    const bottomNav = this.shadowRoot.querySelector('.bottom-nav');
    const bottomSpacer = this.shadowRoot.querySelector('.bottom-spacer');
    const fabOverlay = this.shadowRoot.querySelector('[data-fab-overlay]');
    const fabMenu = this.shadowRoot.querySelector('[data-fab-menu]');
    const faqFab = this.shadowRoot.querySelector('.faq-fab');
    const faqOverlay = this.shadowRoot.querySelector('[data-faq-overlay]');
    const faqMenu = this.shadowRoot.querySelector('[data-faq-menu]');

    const resolveProfileSnapshot = () => {
      try {
        if (typeof window.getUserProfile === 'function') {
          const profile = window.getUserProfile();
          if (profile && typeof profile === 'object') {
            return profile;
          }
        }
      } catch (error) {
        return null;
      }
      return null;
    };

    const evaluateTrialGate = (profile) => {
      if (!profile || typeof profile !== 'object') {
        return false;
      }
      if (profile.trial_welcome_seen === true) {
        return true;
      }
      if (profile.trial_started_at) {
        return true;
      }
      if (profile.subscription_until) {
        return true;
      }
      const subscriptionStatus = typeof profile.subscription_status === 'string'
        ? profile.subscription_status.trim().toLowerCase()
        : '';
      return ['trial', 'active', 'expired', 'paid'].includes(subscriptionStatus);
    };

    const syncOnboardingGateState = () => {
      const profile = resolveProfileSnapshot();
      const profileCompletedFromGetter = typeof window.getProfileCompleted === 'function'
        ? window.getProfileCompleted() === true
        : false;
      const profileCompletedFromSnapshot = Boolean(profile?.is_completed === true);
      hasCompletedProfile = Boolean(
        hasCompletedProfile
        || window.profileCompleted === true
        || profileCompletedFromGetter
        || profileCompletedFromSnapshot
      );
      hasPassedTrialGate = Boolean(hasPassedTrialGate || evaluateTrialGate(profile));
    };

    const isFaqFabUnlocked = () => (
      hasCompletedProfile
      && hasPassedTrialGate
    );

    const normalizeSpaTarget = (target) => {
      if (!target || typeof target !== 'string') {
        return null;
      }

      try {
        const resolved = new URL(target, window.location.origin);
        if (resolved.origin !== window.location.origin) {
          return null;
        }

        const resolvedPath = `${resolved.pathname}${resolved.search}${resolved.hash}`;
        if (resolvedPath === '/app') {
          return '/';
        }
        if (resolvedPath.startsWith('/app/')) {
          return resolvedPath.slice(4);
        }
        return resolvedPath;
      } catch (error) {
        return null;
      }
    };

    const navigateTo = (target, replace = false) => {
      if (!target) {
        return;
      }

      const method = replace ? window.spaReplace : window.spaNavigate;
      const spaTarget = normalizeSpaTarget(target);
      if (spaTarget && typeof method === 'function') {
        method(spaTarget);
        return;
      }

      if (replace) {
        window.location.replace(target);
      } else {
        window.location.assign(target);
      }
    };

    const closeFabMenu = () => {
      fabMenu?.classList.add('hidden');
      fabOverlay?.classList.add('hidden');
    };

    const closeFaqMenu = () => {
      faqMenu?.classList.add('hidden');
      faqOverlay?.classList.add('hidden');
    };

    const openFabMenu = () => {
      closeFaqMenu();
      fabMenu?.classList.remove('hidden');
      fabOverlay?.classList.remove('hidden');
    };

    const openFaqMenu = () => {
      closeFabMenu();
      faqMenu?.classList.remove('hidden');
      faqOverlay?.classList.remove('hidden');
    };

    const toggleFabMenu = () => {
      if (!fabMenu || !fabOverlay) {
        return;
      }
      const isHidden = fabMenu.classList.contains('hidden');
      if (isHidden) {
        openFabMenu();
      } else {
        closeFabMenu();
      }
    };

    const toggleFaqMenu = () => {
      if (!faqMenu || !faqOverlay) {
        return;
      }
      const isHidden = faqMenu.classList.contains('hidden');
      if (isHidden) {
        openFaqMenu();
      } else {
        closeFaqMenu();
      }
    };

    const applyBottomNavState = (profileCompleted) => {
      const shouldDisable = !profileCompleted;
      Object.values(bottomLinks).forEach((link) => {
        if (!link) {
          return;
        }
        if (!link.dataset.originalHref) {
          link.dataset.originalHref = link.getAttribute('href') || '/profile';
        }
        if (shouldDisable) {
          link.href = '/questionnaire';
          link.classList.add('bottom-link--disabled');
          if (!link.dataset.disableHandlerAttached) {
            link.dataset.disableHandlerAttached = 'true';
            link.addEventListener('click', (event) => {
              if (!link.classList.contains('bottom-link--disabled')) {
                return;
              }
              event.preventDefault();
              if (typeof showNotification === 'function') {
                showNotification('Сначала заполните анкету.', 'error');
              }
              navigateTo('/questionnaire');
            });
          }
        } else {
          link.href = link.dataset.originalHref;
          link.classList.remove('bottom-link--disabled');
        }
      });
      if (bottomFab) {
        if (!bottomFab.dataset.originalHref) {
          bottomFab.dataset.originalHref = bottomFab.getAttribute('href') || '/diary';
        }
        if (shouldDisable) {
          bottomFab.href = '/questionnaire';
          bottomFab.classList.add('bottom-link--disabled');
        } else {
          bottomFab.href = bottomFab.dataset.originalHref;
          bottomFab.classList.remove('bottom-link--disabled');
        }
      }
    };

    if (bottomFab) {
      bottomFab.addEventListener('click', (event) => {
        event.preventDefault();
        const isDisabled = bottomFab.classList.contains('bottom-link--disabled');
        if (isDisabled) {
          return;
        }
        // РќР° Р»СЋР±РѕР№ СЃС‚СЂР°РЅРёС†Рµ СЃРЅР°С‡Р°Р»Р° РѕС‚РєСЂС‹РІР°РµРј РёРЅС‚РµСЂР°РєС‚РёРІРЅРѕРµ РјРµРЅСЋ,
        // РЅРµ РїРµСЂРµРІРѕРґСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РЅР° СЌРєСЂР°РЅ РґРЅРµРІРЅРёРєР° Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё.
        toggleFabMenu();
      });
    }

    if (fabOverlay) {
      fabOverlay.addEventListener('click', () => {
        closeFabMenu();
      });
    }

    if (faqFab) {
      faqFab.addEventListener('click', (event) => {
        event.preventDefault();
        toggleFaqMenu();
      });
    }

    if (faqOverlay) {
      faqOverlay.addEventListener('click', () => {
        closeFaqMenu();
      });
    }

    this.shadowRoot.querySelectorAll('[data-faq-href]').forEach((item) => {
      item.addEventListener('click', () => {
        closeFaqMenu();
        const target = item.getAttribute('data-faq-href');
        if (target) {
          navigateTo(target);
        }
      });
    });

    this.shadowRoot.querySelectorAll('[data-fab-action]').forEach((item) => {
      item.addEventListener('click', () => {
        const action = item.dataset.fabAction;
        const meal = item.dataset.meal || '';
        closeFabMenu();

        const currentPath = window.location.pathname || '/';
        const isDiaryPage = currentPath.startsWith('/diary') || currentPath.startsWith('/app/diary');

        if (isDiaryPage) {
          window.dispatchEvent(new CustomEvent('diary-fab-action', {
            detail: { action, meal }
          }));
          return;
        }

        const params = new URLSearchParams();
        params.set('fab', '1');
        params.set('action', action || 'meal');
        if (meal) {
          params.set('meal', meal);
        }
        navigateTo(`/diary?${params.toString()}`);
      });
    });

    Object.values(bottomLinks).forEach((link) => {
      if (!link) {
        return;
      }

      link.addEventListener('click', (event) => {
        if (event.defaultPrevented) {
          return;
        }
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
          return;
        }
        if (link.classList.contains('bottom-link--disabled')) {
          return;
        }

        const target = link.getAttribute('href');
        if (!target || target === '#') {
          return;
        }

        const normalizedTarget = normalizeSpaTarget(target);
        if (normalizedTarget) {
          window.__SPA_CURRENT_PATH__ = normalizedTarget;
        }
        updateActiveBottomLink();
        event.preventDefault();
        navigateTo(target);
      });
    });

    applyBottomNavState(hasCompletedProfile);
    window.addEventListener('profile-status-updated', (event) => {
      const profileCompleted = Boolean(event?.detail?.profileCompleted);
      hasCompletedProfile = profileCompleted;
      if (typeof event?.detail?.trialGatePassed === 'boolean') {
        hasPassedTrialGate = event.detail.trialGatePassed === true;
      }
      applyBottomNavState(profileCompleted);
      updateBottomNavVisibility();
      updateActiveBottomLink();
    });

    const resolveCurrentPath = () => {
      const runtimePath = typeof window.__SPA_CURRENT_PATH__ === 'string' ? window.__SPA_CURRENT_PATH__ : '';
      if (runtimePath.startsWith('/')) {
        return runtimePath === '/app' ? '/' : (runtimePath.startsWith('/app/') ? runtimePath.slice(4) : runtimePath);
      }
      const rawPath = window.location.pathname || '/';
      const fromPathname = rawPath === '/app' ? '/' : (rawPath.startsWith('/app/') ? rawPath.slice(4) : rawPath);
      if (fromPathname !== '/') {
        return fromPathname;
      }
      const hash = window.location.hash || '';
      if (hash.startsWith('#/')) {
        return hash.slice(1);
      }
      return fromPathname;
    };

    const updateBottomNavVisibility = () => {
      syncOnboardingGateState();
      const currentPath = resolveCurrentPath();
      const shouldHideBottomNav = !hasCompletedProfile && currentPath.startsWith('/questionnaire');
      const shouldHideFaqFab = !isFaqFabUnlocked();
      if (bottomNav) {
        bottomNav.style.display = shouldHideBottomNav ? 'none' : '';
      }
      if (faqFab) {
        faqFab.style.display = shouldHideFaqFab ? 'none' : 'inline-flex';
      }
      if (bottomSpacer) {
        bottomSpacer.style.height = shouldHideBottomNav ? '0' : '0';
      }
      if (shouldHideBottomNav || shouldHideFaqFab) {
        closeFabMenu();
        closeFaqMenu();
      }
    };

    const updateActiveBottomLink = () => {
      const currentPath = resolveCurrentPath();
      let activeKey = '';
      if (currentPath.startsWith('/diary')) {
        activeKey = 'diary';
      } else if (
        currentPath.startsWith('/meal-plan')
        || currentPath.startsWith('/shopping-list')
        || currentPath.startsWith('/foods')
        || currentPath.startsWith('/my-products')
      ) {
        activeKey = 'mealPlan';
      } else if (currentPath.startsWith('/resume')) {
        activeKey = 'profile';
      } else if (currentPath.startsWith('/profile') || currentPath.startsWith('/progress')) {
        activeKey = 'progress';
      } else if (
        currentPath === '/'
        || currentPath.startsWith('/questionnaire')
        || currentPath.startsWith('/preferences-onboarding')
        || currentPath.startsWith('/trial-start')
      ) {
        activeKey = 'profile';
      }

      Object.entries(bottomLinks).forEach(([key, link]) => {
        if (!link) {
          return;
        }
        link.classList.toggle('bottom-link--active', key === activeKey);
      });
    };

    updateBottomNavVisibility();
    updateActiveBottomLink();
    // Profile snapshot can arrive asynchronously after component mount.
    window.setTimeout(updateBottomNavVisibility, 120);
    window.setTimeout(updateBottomNavVisibility, 500);
    window.setTimeout(updateBottomNavVisibility, 1200);
    window.addEventListener('focus', updateBottomNavVisibility);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        updateBottomNavVisibility();
      }
    });
    window.addEventListener('popstate', () => {
      updateBottomNavVisibility();
      updateActiveBottomLink();
    });
    window.addEventListener('spa-route-changed', () => {
      updateBottomNavVisibility();
      updateActiveBottomLink();
    });
  }
}

customElements.define('custom-footer', CustomFooter);
