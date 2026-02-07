class CustomNavbar extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    const appName = document.documentElement?.dataset?.appName || 'BreeLife';
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .navbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.25rem 1.5rem;
          background: white;
          position: sticky;
          top: 0;
          z-index: 50;
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
          border-bottom: 1px solid #f1f5f9;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        
        .logo {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          text-decoration: none;
        }
        
        .logo-icon {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          background: linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 800;
          font-size: 18px;
        }
        .logo-text {
          font-weight: 700;
          font-size: 1.25rem;
          background: linear-gradient(135deg, #34d399 0%, #3b82f6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .nav-actions {
          display: flex;
          gap: 0.75rem;
          align-items: center;
        }
        
        .nav-button {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .nav-button--active {
          background: #ecfdf3;
          border-color: #34d399;
          color: #047857;
        }

        .menu-wrapper {
          position: relative;
        }

        .menu-wrapper.is-hidden {
          display: none;
        }

        .menu-panel {
          position: absolute;
          right: 0;
          top: calc(100% + 0.75rem);
          width: 220px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 0.75rem;
          box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
          padding: 0.5rem;
          display: none;
          visibility: hidden;
          opacity: 0;
          pointer-events: none;
          transform: translateY(-4px);
          transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s ease;
          z-index: 20;
        }

        .menu-section {
          padding: 0.5rem 0.75rem 0.25rem;
          color: #94a3b8;
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .menu-panel.is-open {
          display: block;
          visibility: visible;
          opacity: 1;
          pointer-events: auto;
          transform: translateY(0);
        }

        .menu-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          color: #0f172a;
          text-decoration: none;
          font-size: 0.875rem;
        }

        .menu-link:hover {
          background: #f1f5f9;
        }

        .nav-emoji {
          font-size: 20px;
          line-height: 1;
        }

        .nav-button:hover {
          background: #f1f5f9;
          color: #334155;
        }
        
        .nav-button:active {
          transform: scale(0.95);
          background: #e2e8f0;
        }

        @media (max-width: 640px) {
          .nav-actions {
            gap: 0.5rem;
          }

          .nav-button {
            width: 44px;
            height: 44px;
          }

          .menu-panel {
            width: min(240px, 90vw);
          }
        }
        
        @media (max-width: 640px) {
          .navbar {
            padding: 1rem 1.25rem;
          }
          
          .logo-text {
            font-size: 1.125rem;
          }
          
          .logo-icon {
            width: 32px;
            height: 32px;
            font-size: 16px;
          }
        }
      </style>
      
      <nav class="navbar">
        <a href="/profile" class="logo">
          <div class="logo-icon">🌿</div>
          <div class="logo-text">${appName}</div>
</a>
        
        <div class="nav-actions">
          <a href="/resume" class="nav-button" data-nav="profile" aria-label="Профиль" title="Профиль">
            <span class="nav-emoji" aria-hidden="true">👤</span>
          </a>
          <div class="menu-wrapper">
            <button type="button" class="nav-button" data-nav="menu" aria-label="Настройки" title="Настройки">
              <span class="nav-emoji" aria-hidden="true">⚙️</span>
            </button>
            <div class="menu-panel" id="menu-panel">
              <a href="/settings/reminders" class="menu-link">Напоминания</a>
              <a href="/menu#plans" class="menu-link">Тарифы</a>
              <a href="/menu#support" class="menu-link">Помощь</a>
            </div>
          </div>
        </div>
      </nav>
    `;

    const setActiveLink = () => {
      const path = window.location.pathname || '/';
      const profileLink = this.shadowRoot.querySelector('[data-nav="profile"]');
      const menuButton = this.shadowRoot.querySelector('[data-nav="menu"]');
      const menuPanel = this.shadowRoot.getElementById('menu-panel');
      const menuWrapper = this.shadowRoot.querySelector('.menu-wrapper');

      const applyMenuVisibility = (profileCompleted) => {
        if (!menuWrapper) {
          return;
        }
        const shouldShowMenu = profileCompleted === true;
        menuWrapper.classList.toggle('is-hidden', !shouldShowMenu);
        if (!shouldShowMenu) {
          menuPanel?.classList.remove('is-open');
        }
      };

      if (profileLink && path.startsWith('/resume')) {
        profileLink.classList.add('nav-button--active');
      }
      if (menuWrapper) {
        const initialProfileCompleted = window.profileCompleted === true
          || (typeof window.getUserProfile === 'function' && window.getUserProfile()?.completed === true);
        applyMenuVisibility(initialProfileCompleted);
        window.addEventListener('profile-status-updated', (event) => {
          applyMenuVisibility(event?.detail?.profileCompleted);
        });
      }
      if (menuButton && menuPanel) {
        menuButton.addEventListener('click', () => {
          menuPanel.classList.toggle('is-open');
        });
        document.addEventListener('click', (event) => {
          const clickInside = event.composedPath().includes(this);
          if (!clickInside) {
            menuPanel.classList.remove('is-open');
          }
        });

        const menuLinks = menuPanel.querySelectorAll('a[href]');
        menuLinks.forEach((link) => {
          link.addEventListener('click', (event) => {
            // Явная навигация, чтобы исключить блокировку кликов в шадоу-доме.
            event.preventDefault();
            menuPanel.classList.remove('is-open');
            const target = link.getAttribute('href');
            if (target) {
              window.location.assign(target);
            }
          });
        });
      }
    };

    setActiveLink();
  }
}

customElements.define('custom-navbar', CustomNavbar);
