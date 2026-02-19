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
          padding: calc(1.25rem + max(env(safe-area-inset-top), var(--tg-safe-top, 0px))) 1.5rem 1.25rem;
          background: white;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
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
          font-weight: 700;
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
          align-items: center;
          position: relative;
        }

        .menu-wrapper {
          position: relative;
        }

        .profile-toggle {
          border: 0;
          background: transparent;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.25rem 0.5rem;
          border-radius: 999px;
          transition: background-color 0.2s ease, box-shadow 0.2s ease;
        }

        .profile-toggle:hover {
          background: #f8fafc;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
        }

        .profile-toggle:focus-visible {
          outline: 2px solid #34d399;
          outline-offset: 2px;
        }

        .profile-avatar {
          width: 34px;
          height: 34px;
          border-radius: 999px;
          overflow: hidden;
          background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%);
          border: 1px solid #e2e8f0;
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.12);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .profile-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .profile-avatar-fallback {
          color: #0f172a;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
        }

        .profile-first-name {
          max-width: 120px;
          font-size: 0.78rem;
          font-weight: 600;
          color: #0f172a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-align: left;
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

        .menu-link__status {
          margin-left: auto;
          font-size: 0.7rem;
          font-weight: 600;
          color: #64748b;
          white-space: nowrap;
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

          .profile-avatar {
            width: 32px;
            height: 32px;
          }

          .profile-first-name {
            max-width: 90px;
          }

          .menu-panel {
            width: min(240px, 90vw);
          }
        }
      </style>

      <nav class="navbar">
        <a href="/profile" class="logo" aria-label="На главную">
          <div class="logo-icon">🌿</div>
          <div class="logo-text">${appName}</div>
        </a>

        <div class="nav-actions">
          <div class="menu-wrapper">
            <button type="button" class="profile-toggle" data-nav="menu" aria-label="Открыть меню профиля" title="Профиль">
              <span class="profile-first-name" id="navbar-user-first-name" aria-live="polite">Профиль</span>
              <span class="profile-avatar" id="navbar-avatar" aria-hidden="true">
                <span class="profile-avatar-fallback" id="navbar-avatar-fallback">U</span>
              </span>
            </button>
            <div class="menu-panel" id="menu-panel">
              <a href="/settings/reminders" class="menu-link">Напоминания <span id="navbar-reminders-status" class="menu-link__status">Проверяем...</span></a>
              <a href="/plans" class="menu-link">Тарифы</a>
              <a href="/references" class="menu-link">Справочники</a>
              <a href="/support" class="menu-link">Помощь</a>
            </div>
          </div>
        </div>
      </nav>
    `;


    const updateHeaderHeight = () => {
      const navbar = this.shadowRoot.querySelector('.navbar');
      if (!navbar) {
        return;
      }
      // Высоту шапки сохраняем в CSS-переменную, чтобы контент корректно отступал сверху.
      document.documentElement.style.setProperty('--header-height', `${navbar.offsetHeight}px`);
    };

    updateHeaderHeight();
    window.addEventListener('resize', updateHeaderHeight);

    const getTelegramFallback = () => {
      const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
      if (!user || typeof user !== 'object') {
        return { first_name: '', username: '', photo_url: '' };
      }
      return {
        first_name: typeof user.first_name === 'string' ? user.first_name.trim() : '',
        username: typeof user.username === 'string' ? user.username.trim() : '',
        photo_url: typeof user.photo_url === 'string' ? user.photo_url.trim() : ''
      };
    };

    const buildFirstName = (status) => {
      const firstName = typeof status?.first_name === 'string' ? status.first_name.trim() : '';
      const username = typeof status?.username === 'string' ? status.username.trim() : '';
      return firstName || username || 'Профиль';
    };

    const buildAvatarUrl = (status) => {
      return typeof status?.photo_url === 'string' ? status.photo_url.trim() : '';
    };

    const applyUserIdentity = (status) => {
      const nameElement = this.shadowRoot.getElementById('navbar-user-first-name');
      const avatarContainer = this.shadowRoot.getElementById('navbar-avatar');
      const avatarFallback = this.shadowRoot.getElementById('navbar-avatar-fallback');
      if (!nameElement || !avatarContainer || !avatarFallback) {
        return;
      }

      const fallback = getTelegramFallback();
      const identity = {
        first_name: status?.first_name || fallback.first_name,
        username: status?.username || fallback.username,
        photo_url: status?.photo_url || fallback.photo_url
      };

      const firstName = buildFirstName(identity);
      const avatarUrl = buildAvatarUrl(identity);

      nameElement.textContent = firstName;
      avatarFallback.textContent = (firstName[0] || 'U').toUpperCase();

      const oldImage = avatarContainer.querySelector('img');
      if (oldImage) {
        oldImage.remove();
      }

      if (avatarUrl) {
        const image = document.createElement('img');
        image.src = avatarUrl;
        image.alt = `Аватар ${firstName}`;
        image.loading = 'lazy';
        image.referrerPolicy = 'no-referrer';
        avatarContainer.appendChild(image);
        avatarFallback.style.display = 'none';
      } else {
        avatarFallback.style.display = 'inline';
      }
    };

    const loadUserIdentity = async () => {
      try {
        const response = await fetch('/api/me/status');
        if (!response.ok) {
          applyUserIdentity({});
          return;
        }
        const status = await response.json();
        applyUserIdentity(status);
      } catch (error) {
        // Ошибку получения Telegram-профиля в шапке игнорируем.
        applyUserIdentity({});
      }
    };


    const renderRemindersStatus = () => {
      const statusElement = this.shadowRoot.getElementById('navbar-reminders-status');
      if (!statusElement) {
        return;
      }

      const profile = typeof window.getUserProfile === 'function' ? window.getUserProfile() : {};
      const settings = profile?.reminder_settings && typeof profile.reminder_settings === 'object'
        ? profile.reminder_settings
        : {};

      const enabledCount = ['water', 'sleep', 'activity']
        .filter((key) => settings?.[key]?.enabled === true)
        .length;

      if (enabledCount > 0) {
        statusElement.textContent = `Вкл: ${enabledCount}`;
        statusElement.style.color = '#059669';
      } else {
        statusElement.textContent = 'Выкл';
        statusElement.style.color = '#64748b';
      }
    };

    const bindMenu = () => {
      const menuButton = this.shadowRoot.querySelector('[data-nav="menu"]');
      const menuPanel = this.shadowRoot.getElementById('menu-panel');
      if (!menuButton || !menuPanel) {
        return;
      }

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
    };

    if (window.serverUser && typeof window.serverUser === 'object') {
      applyUserIdentity(window.serverUser);
    } else {
      applyUserIdentity({});
    }
    loadUserIdentity();
    window.addEventListener('profile-status-updated', (event) => {
      if (event?.detail) {
        applyUserIdentity(event.detail);
      }
      renderRemindersStatus();
    });

    window.addEventListener('focus', () => {
      renderRemindersStatus();
    });

    bindMenu();
    renderRemindersStatus();
  }
}

customElements.define('custom-navbar', CustomNavbar);
