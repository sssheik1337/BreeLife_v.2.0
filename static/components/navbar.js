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

        .nav-button svg {
          width: 20px;
          height: 20px;
          stroke: currentColor;
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
        <a href="/" class="logo">
          <div class="logo-icon">🌿</div>
          <div class="logo-text">BreeLife</div>
</a>
        
        <div class="nav-actions">
          <a href="/profile" class="nav-button" aria-label="Профиль" title="Профиль">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </a>
          <a href="/menu" class="nav-button" aria-label="Меню" title="Меню">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </a>
          <a href="/profile#settings" class="nav-button" aria-label="Настройки" title="Настройки">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </a>
        </div>
      </nav>
    `;

  }
}

customElements.define('custom-navbar', CustomNavbar);
