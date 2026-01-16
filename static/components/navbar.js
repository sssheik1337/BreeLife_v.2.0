class CustomNavbar extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
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

        .nav-button--disabled {
          background: #f8fafc;
          border-color: #e2e8f0;
          color: #cbd5f5;
          cursor: not-allowed;
          opacity: 0.7;
          pointer-events: none;
        }

        .menu-wrapper {
          position: relative;
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
          z-index: 20;
        }

        .menu-panel.is-open {
          display: block;
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

        .menu-link--disabled {
          color: #94a3b8;
          cursor: not-allowed;
        }

        .menu-link--disabled:hover {
          background: transparent;
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
          <div class="logo-text">BreeLife</div>
</a>
        
        <div class="nav-actions">
          <a href="/profile" class="nav-button" data-nav="profile" aria-label="Профиль" title="Профиль">
            <span class="nav-emoji" aria-hidden="true">👤</span>
          </a>
          <div class="menu-wrapper">
            <button type="button" class="nav-button" data-nav="menu" aria-label="Меню" title="Меню">
              <span class="nav-emoji" aria-hidden="true">📋</span>
            </button>
            <div class="menu-panel" id="menu-panel">
              <a href="/profile" class="menu-link">Профиль</a>
              <a href="/diary" class="menu-link">Дневник питания</a>
              <a href="/food-diary" class="menu-link">Дневник продуктов</a>
              <a href="/foods" class="menu-link">Список продуктов</a>
              <a href="/menu#plans" class="menu-link">Тарифы</a>
              <span class="menu-link menu-link--disabled" title="Скоро">Настройки <span>Скоро</span></span>
            </div>
          </div>
          <button type="button" class="nav-button nav-button--disabled" aria-label="Настройки" title="Скоро" disabled>
            <span class="nav-emoji" aria-hidden="true">⚙️</span>
          </button>
        </div>
      </nav>
    `;

    const setActiveLink = () => {
      const path = window.location.pathname || '/';
      const profileLink = this.shadowRoot.querySelector('[data-nav="profile"]');
      const menuButton = this.shadowRoot.querySelector('[data-nav="menu"]');
      const menuPanel = this.shadowRoot.getElementById('menu-panel');

      if (profileLink && path.startsWith('/profile')) {
        profileLink.classList.add('nav-button--active');
      }
      if (menuButton && menuPanel) {
        menuButton.addEventListener('click', () => {
          menuPanel.classList.toggle('is-open');
        });
        document.addEventListener('click', (event) => {
          if (!this.shadowRoot.contains(event.target)) {
            menuPanel.classList.remove('is-open');
          }
        });
      }
    };

    setActiveLink();
  }
}

customElements.define('custom-navbar', CustomNavbar);
