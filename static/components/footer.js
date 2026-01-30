class CustomFooter extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .footer {
          margin-top: auto;
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
          height: 96px;
        }

        .bottom-nav {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(255, 255, 255, 0.98);
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
          font-size: 32px;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 12px 24px rgba(16, 185, 129, 0.3);
          z-index: 2;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          cursor: pointer;
        }

        .bottom-fab--open {
          transform: scale(1.05);
          box-shadow: 0 16px 30px rgba(16, 185, 129, 0.35);
        }

        .bottom-fab--disabled {
          opacity: 0.6;
          cursor: default;
          pointer-events: none;
        }

        .bottom-fab:active {
          transform: scale(0.98);
        }

        .fab-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.25);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease;
          z-index: 38;
        }

        .fab-backdrop.is-open {
          opacity: 1;
          pointer-events: auto;
        }

        .fab-menu {
          position: fixed;
          left: 50%;
          bottom: 96px;
          transform: translate(-50%, 16px);
          opacity: 0;
          pointer-events: none;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          width: min(320px, calc(100% - 2rem));
          background: white;
          border-radius: 1rem;
          padding: 0.75rem;
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.12);
          border: 1px solid #e2e8f0;
          transition: opacity 0.2s ease, transform 0.2s ease;
          z-index: 39;
        }

        .fab-menu.is-open {
          opacity: 1;
          pointer-events: auto;
          transform: translate(-50%, 0);
        }

        .fab-menu__item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          padding: 0.65rem 0.85rem;
          border-radius: 0.75rem;
          background: #f8fafc;
          color: #0f172a;
          font-weight: 600;
          text-decoration: none;
          font-size: 0.85rem;
          transition: background 0.2s ease, transform 0.2s ease;
        }

        .fab-menu__item:active {
          background: #ecfdf3;
          transform: scale(0.98);
        }

        .fab-menu__meta {
          font-size: 0.75rem;
          color: #64748b;
          font-weight: 500;
        }

        @media (min-width: 768px) {
          .bottom-nav {
            left: 50%;
            transform: translateX(-50%);
            width: min(420px, 100%);
            border-radius: 1rem 1rem 0 0;
          }

          .fab-menu {
            bottom: 110px;
          }
        }
      </style>

      <div class="bottom-spacer" aria-hidden="true"></div>
      
      <footer class="footer">
        <div class="footer-content">
          <p class="footer-text">
            🌱 Посадите здоровье сегодня, расцветёте завтра. Делайте маленькие шаги каждый день к более здоровому себе.
          </p>
          <div class="copyright">
            © ${new Date().getFullYear()} Health Bloom • Сделано с ❤️ для здоровой жизни
          </div>
</div>
      </footer>

      <nav class="bottom-nav" aria-label="Основная навигация">
        <div class="bottom-nav__inner">
          <a href="/profile" class="bottom-link" data-bottom-link="profile">
            <span class="bottom-link__icon" aria-hidden="true">👤</span>
            <span>Профиль</span>
          </a>
          <a href="/diary" class="bottom-link" data-bottom-link="diary">
            <span class="bottom-link__icon" aria-hidden="true">🍽️</span>
            <span>Дневник</span>
          </a>
          <button type="button" class="bottom-fab" data-fab-toggle aria-label="Добавить запись" aria-expanded="false">+</button>
          <a href="/meal-plan" class="bottom-link" data-bottom-link="meal-plan">
            <span class="bottom-link__icon" aria-hidden="true">📋</span>
            <span>Рацион</span>
          </a>
          <a href="/profile#profile-month-grid-section" class="bottom-link" data-bottom-link="progress">
            <span class="bottom-link__icon" aria-hidden="true">📊</span>
            <span>Прогресс</span>
          </a>
        </div>
      </nav>

      <div class="fab-backdrop" data-fab-backdrop aria-hidden="true"></div>
      <div class="fab-menu" id="fab-menu" role="menu" aria-label="Быстрое добавление">
        <a class="fab-menu__item" href="/diary?meal=breakfast" role="menuitem">
          <span>Добавить завтрак</span>
          <span class="fab-menu__meta">☀️</span>
        </a>
        <a class="fab-menu__item" href="/diary?meal=lunch" role="menuitem">
          <span>Добавить обед</span>
          <span class="fab-menu__meta">🌤</span>
        </a>
        <a class="fab-menu__item" href="/diary?meal=dinner" role="menuitem">
          <span>Добавить ужин</span>
          <span class="fab-menu__meta">🌙</span>
        </a>
        <a class="fab-menu__item" href="/diary?meal=snack" role="menuitem">
          <span>Добавить перекус</span>
          <span class="fab-menu__meta">🌗</span>
        </a>
        <a class="fab-menu__item" href="/diary?mode=water" role="menuitem" data-fab-mode="water">
          <span>Добавить воду</span>
          <span class="fab-menu__meta">💧</span>
        </a>
        <a class="fab-menu__item" href="/diary?mode=sleep" role="menuitem" data-fab-mode="sleep">
          <span>Добавить сон</span>
          <span class="fab-menu__meta">🌙</span>
        </a>
      </div>
    `;

    const hasCompletedProfile = window.profileCompleted === true;

    const bottomLinks = {
      profile: this.shadowRoot.querySelector('[data-bottom-link="profile"]'),
      diary: this.shadowRoot.querySelector('[data-bottom-link="diary"]'),
      mealPlan: this.shadowRoot.querySelector('[data-bottom-link="meal-plan"]'),
      progress: this.shadowRoot.querySelector('[data-bottom-link="progress"]'),
    };
    const bottomFab = this.shadowRoot.querySelector('[data-fab-toggle]');
    const fabMenu = this.shadowRoot.getElementById('fab-menu');
    const fabBackdrop = this.shadowRoot.querySelector('[data-fab-backdrop]');

    const setFabOpenState = (isOpen) => {
      if (!bottomFab || !fabMenu || !fabBackdrop) {
        return;
      }
      bottomFab.classList.toggle('bottom-fab--open', isOpen);
      bottomFab.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      fabMenu.classList.toggle('is-open', isOpen);
      fabBackdrop.classList.toggle('is-open', isOpen);
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
              window.location.href = '/questionnaire';
            });
          }
        } else {
          link.href = link.dataset.originalHref;
          link.classList.remove('bottom-link--disabled');
        }
      });
      if (bottomFab) {
        if (shouldDisable) {
          bottomFab.classList.add('bottom-fab--disabled');
          bottomFab.setAttribute('aria-disabled', 'true');
          bottomFab.setAttribute('disabled', 'true');
          setFabOpenState(false);
        } else {
          bottomFab.classList.remove('bottom-fab--disabled');
          bottomFab.removeAttribute('aria-disabled');
          bottomFab.removeAttribute('disabled');
        }
      }
    };

    applyBottomNavState(hasCompletedProfile);
    window.addEventListener('profile-status-updated', (event) => {
      const profileCompleted = Boolean(event?.detail?.profileCompleted);
      applyBottomNavState(profileCompleted);
    });

    const currentPath = window.location.pathname || '/';
    const currentHash = window.location.hash || '';
    let activeKey = 'profile';
    if (currentPath.startsWith('/diary')) {
      activeKey = 'diary';
    } else if (currentPath.startsWith('/meal-plan')) {
      activeKey = 'meal-plan';
    } else if (currentHash.includes('progress') || currentHash.includes('month')) {
      activeKey = 'progress';
    } else if (currentPath.startsWith('/profile')) {
      activeKey = 'profile';
    }

    Object.entries(bottomLinks).forEach(([key, link]) => {
      if (!link) {
        return;
      }
      link.classList.toggle('bottom-link--active', key === activeKey);
    });

    if (bottomFab && fabMenu && fabBackdrop) {
      bottomFab.addEventListener('click', (event) => {
        event.preventDefault();
        if (bottomFab.classList.contains('bottom-fab--disabled')) {
          return;
        }
        setFabOpenState(!fabMenu.classList.contains('is-open'));
      });

      fabBackdrop.addEventListener('click', () => {
        setFabOpenState(false);
      });

      fabMenu.querySelectorAll('a[href]').forEach((link) => {
        link.addEventListener('click', (event) => {
          const mode = link.dataset.fabMode;
          if (currentPath.startsWith('/diary') && mode) {
            event.preventDefault();
            window.dispatchEvent(new CustomEvent('diary-open-panel', { detail: { mode } }));
          }
          setFabOpenState(false);
        });
      });

      document.addEventListener('click', (event) => {
        const isInside = event.composedPath().includes(this);
        if (!isInside) {
          setFabOpenState(false);
        }
      });
    }
  }
}

customElements.define('custom-footer', CustomFooter);
