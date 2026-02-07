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
          text-decoration: none;
          box-shadow: 0 12px 24px rgba(16, 185, 129, 0.3);
          z-index: 2;
        }

        .bottom-fab:active {
          transform: scale(0.98);
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
          <a href="/resume" class="bottom-link" data-bottom-link="profile">
            <span class="bottom-link__icon" aria-hidden="true">👤</span>
            <span>Профиль</span>
          </a>
          <a href="/diary" class="bottom-link" data-bottom-link="diary">
            <span class="bottom-link__icon" aria-hidden="true">🍽️</span>
            <span>Дневник</span>
          </a>
          <a href="/diary?fab=1" class="bottom-fab" aria-label="Добавить запись">+</a>
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
    `;

    const hasCompletedProfile = window.profileCompleted === true;
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

    applyBottomNavState(hasCompletedProfile);
    window.addEventListener('profile-status-updated', (event) => {
      const profileCompleted = Boolean(event?.detail?.profileCompleted);
      applyBottomNavState(profileCompleted);
    });

    const currentPath = window.location.pathname || '/';
    const currentHash = window.location.hash || '';
    if (!hasCompletedProfile && currentPath.startsWith('/questionnaire')) {
      if (bottomNav) {
        bottomNav.style.display = 'none';
      }
      if (bottomSpacer) {
        bottomSpacer.style.height = '0';
      }
    }
    let activeKey = 'progress';
    if (currentPath.startsWith('/resume')) {
      activeKey = 'profile';
    } else if (currentPath.startsWith('/diary')) {
      activeKey = 'diary';
    } else if (currentPath.startsWith('/meal-plan')) {
      activeKey = 'mealPlan';
    } else if (currentPath.startsWith('/profile')) {
      activeKey = 'progress';
    }

    Object.entries(bottomLinks).forEach(([key, link]) => {
      if (!link) {
        return;
      }
      link.classList.toggle('bottom-link--active', key === activeKey);
    });
  }
}

customElements.define('custom-footer', CustomFooter);
