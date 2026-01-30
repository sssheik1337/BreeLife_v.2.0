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
.footer-links {
          display: flex;
          justify-content: center;
          gap: 1.5rem;
          margin-top: 1rem;
          margin-bottom: 1.5rem;
        }
        
        .footer-link {
          color: #34d399;
          text-decoration: none;
          font-weight: 500;
          font-size: 0.875rem;
          transition: color 0.2s ease;
        }
        
        .footer-link:active {
          color: #10b981;
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
          
          .footer-links {
            flex-wrap: wrap;
            gap: 1rem 1.5rem;
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
          text-decoration: none;
          box-shadow: 0 12px 24px rgba(16, 185, 129, 0.3);
          z-index: 2;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          cursor: pointer;
        }

        .bottom-fab:active {
          transform: scale(0.98);
        }

        .bottom-fab.is-open {
          transform: scale(1.05) rotate(45deg);
          box-shadow: 0 16px 30px rgba(16, 185, 129, 0.4);
        }

        .bottom-fab:disabled,
        .bottom-fab.bottom-link--disabled {
          cursor: not-allowed;
          opacity: 0.6;
          transform: none;
          box-shadow: none;
        }

        .fab-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.35);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease;
          z-index: 45;
        }

        .fab-backdrop.is-open {
          opacity: 1;
          pointer-events: auto;
        }

        .fab-menu {
          position: fixed;
          left: 50%;
          bottom: 110px;
          transform: translateX(-50%) scale(0.96);
          opacity: 0;
          pointer-events: none;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
          padding: 0.75rem;
          background: white;
          border-radius: 1.25rem;
          box-shadow: 0 20px 40px rgba(15, 23, 42, 0.2);
          border: 1px solid #e2e8f0;
          z-index: 50;
          transition: opacity 0.2s ease, transform 0.2s ease;
          min-width: min(320px, 90vw);
        }

        .fab-menu.is-open {
          opacity: 1;
          pointer-events: auto;
          transform: translateX(-50%) scale(1);
        }

        .fab-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          padding: 0.75rem 0.9rem;
          border-radius: 0.9rem;
          border: none;
          background: #f8fafc;
          color: #0f172a;
          font-weight: 600;
          font-size: 0.95rem;
          cursor: pointer;
          transition: background 0.2s ease, transform 0.2s ease;
        }

        .fab-item:active {
          transform: scale(0.98);
        }

        .fab-item:hover {
          background: #ecfdf3;
        }

        @media (min-width: 768px) {
          .bottom-nav {
            left: 50%;
            transform: translateX(-50%);
            width: min(420px, 100%);
            border-radius: 1rem 1rem 0 0;
          }

          .fab-menu {
            bottom: 120px;
          }
        }
      </style>

      <div class="bottom-spacer" aria-hidden="true"></div>
      <div class="fab-backdrop" aria-hidden="true"></div>
      <div class="fab-menu" role="menu" aria-hidden="true">
        <button type="button" class="fab-item" data-fab-action="meal" data-meal="breakfast">➕ Завтрак</button>
        <button type="button" class="fab-item" data-fab-action="meal" data-meal="lunch">➕ Обед</button>
        <button type="button" class="fab-item" data-fab-action="meal" data-meal="dinner">➕ Ужин</button>
        <button type="button" class="fab-item" data-fab-action="meal" data-meal="snack">➕ Перекус</button>
        <button type="button" class="fab-item" data-fab-action="water">💧 Вода</button>
      </div>
      
      <footer class="footer">
        <div class="footer-content">
          <p class="footer-text">
            🌱 Посадите здоровье сегодня, расцветёте завтра. Делайте маленькие шаги каждый день к более здоровому себе.
          </p>
<div class="footer-links">
            <a href="/profile" class="footer-link" data-link="home">Главная</a>
            <a href="/questionnaire" class="footer-link" data-link="questionnaire">Опрос</a>
            <a href="/resume" class="footer-link" data-link="resume">Сводка</a>
            <a href="/profile" class="footer-link" data-link="profile">Профиль</a>
</div>
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
          <button type="button" class="bottom-fab" aria-label="Добавить запись">+</button>
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
    `;

    const links = {
      home: this.shadowRoot.querySelector('[data-link="home"]'),
      questionnaire: this.shadowRoot.querySelector('[data-link="questionnaire"]'),
      resume: this.shadowRoot.querySelector('[data-link="resume"]'),
      profile: this.shadowRoot.querySelector('[data-link="profile"]'),
    };

    const hasCompletedProfile = window.profileCompleted === true;
    const isDevMode = window.appIsDev === true || window.appMode === 'development';

    if (links.home) {
      links.home.href = '/profile';
    }
    if (links.resume) {
      links.resume.href = '/resume';
    }
    if (links.profile) {
      links.profile.href = '/profile';
    }
      if (links.questionnaire) {
        if (hasCompletedProfile) {
          links.questionnaire.textContent = 'Редактировать данные';
          links.questionnaire.href = '/questionnaire?edit=1';
        } else {
          links.questionnaire.textContent = 'Опрос';
          links.questionnaire.href = '/questionnaire';
      }
    }

    const bottomLinks = {
      profile: this.shadowRoot.querySelector('[data-bottom-link="profile"]'),
      diary: this.shadowRoot.querySelector('[data-bottom-link="diary"]'),
      mealPlan: this.shadowRoot.querySelector('[data-bottom-link="meal-plan"]'),
      progress: this.shadowRoot.querySelector('[data-bottom-link="progress"]'),
    };
    const bottomFab = this.shadowRoot.querySelector('.bottom-fab');
    const fabMenu = this.shadowRoot.querySelector('.fab-menu');
    const fabBackdrop = this.shadowRoot.querySelector('.fab-backdrop');
    const fabItems = this.shadowRoot.querySelectorAll('[data-fab-action]');

    const closeFabMenu = () => {
      if (!fabMenu || !fabBackdrop || !bottomFab) {
        return;
      }
      fabMenu.classList.remove('is-open');
      fabBackdrop.classList.remove('is-open');
      bottomFab.classList.remove('is-open');
      fabMenu.setAttribute('aria-hidden', 'true');
    };

    const openFabMenu = () => {
      if (!fabMenu || !fabBackdrop || !bottomFab) {
        return;
      }
      fabMenu.classList.add('is-open');
      fabBackdrop.classList.add('is-open');
      bottomFab.classList.add('is-open');
      fabMenu.setAttribute('aria-hidden', 'false');
    };

    const toggleFabMenu = () => {
      if (!fabMenu || !fabBackdrop) {
        return;
      }
      if (fabMenu.classList.contains('is-open')) {
        closeFabMenu();
      } else {
        openFabMenu();
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
          bottomFab.classList.add('bottom-link--disabled');
          bottomFab.disabled = true;
        } else {
          bottomFab.classList.remove('bottom-link--disabled');
          bottomFab.disabled = false;
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

    if (bottomFab) {
      bottomFab.addEventListener('click', () => {
        if (bottomFab.classList.contains('bottom-link--disabled') || bottomFab.disabled) {
          return;
        }
        toggleFabMenu();
      });
    }

    if (fabBackdrop) {
      fabBackdrop.addEventListener('click', () => {
        closeFabMenu();
      });
    }

    fabItems.forEach((item) => {
      item.addEventListener('click', () => {
        if (bottomFab?.classList.contains('bottom-link--disabled')) {
          return;
        }
        const action = item.dataset.fabAction || '';
        const meal = item.dataset.meal || '';
        closeFabMenu();
        document.dispatchEvent(
          new CustomEvent('fab:add', {
            detail: action === 'meal' ? { action, meal } : action
          })
        );
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeFabMenu();
      }
    });
  }
}

customElements.define('custom-footer', CustomFooter);
