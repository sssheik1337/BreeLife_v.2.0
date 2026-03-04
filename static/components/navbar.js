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
          padding-top: calc(
            max(env(safe-area-inset-top), var(--tg-safe-top, 0px))
            + var(--tg-ui-top, 0px)
          );
          background: white;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
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

        .profile-summary {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          text-decoration: none;
          border-radius: 999px;
          padding: 0.25rem 0.5rem;
        }

        .profile-summary:hover {
          background: #f8fafc;
        }

        .profile-summary:focus-visible {
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

        @media (max-width: 640px) {
          .navbar {
            padding: 1rem 1.25rem;
            padding-top: calc(
              max(env(safe-area-inset-top), var(--tg-safe-top, 0px))
              + var(--tg-ui-top, 0px)
            );
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
        }
      </style>

      <nav class="navbar">
        <a href="/profile" class="logo" aria-label="Open profile">
          <div class="logo-icon">🌿</div>
          <div class="logo-text">${appName}</div>
        </a>

        <a href="/profile" class="profile-summary" data-nav-profile aria-label="Open profile">
          <span class="profile-first-name" id="navbar-user-first-name" aria-live="polite">Profile</span>
          <span class="profile-avatar" id="navbar-avatar" aria-hidden="true">
            <span class="profile-avatar-fallback" id="navbar-avatar-fallback">U</span>
          </span>
        </a>
      </nav>
    `;

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

    const getTelegramFallback = () => {
      const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
      if (!user || typeof user !== 'object') {
        return { first_name: '', username: '', photo_url: '' };
      }
      return {
        first_name: typeof user.first_name === 'string' ? user.first_name.trim() : '',
        username: typeof user.username === 'string' ? user.username.trim() : '',
        photo_url: typeof user.photo_url === 'string' ? user.photo_url.trim() : '',
      };
    };

    const buildFirstName = (status) => {
      const firstName = typeof status?.first_name === 'string' ? status.first_name.trim() : '';
      const username = typeof status?.username === 'string' ? status.username.trim() : '';
      return firstName || username || 'Profile';
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
        photo_url: status?.photo_url || fallback.photo_url,
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
        image.alt = `Avatar ${firstName}`;
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
        applyUserIdentity({});
      }
    };

    const bindNavigation = () => {
      this.shadowRoot.querySelectorAll('a[href]').forEach((link) => {
        link.addEventListener('click', (event) => {
          event.preventDefault();
          const target = link.getAttribute('href');
          navigateTo(target);
        });
      });
    };

    if (window.serverUser && typeof window.serverUser === 'object') {
      applyUserIdentity(window.serverUser);
    } else {
      applyUserIdentity({});
    }

    loadUserIdentity();
    bindNavigation();

    window.addEventListener('profile-status-updated', (event) => {
      if (event?.detail) {
        applyUserIdentity(event.detail);
      }
    });
  }
}

customElements.define('custom-navbar', CustomNavbar);
