class CustomNavbar extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
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
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
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
          background: #f8fafc;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s ease;
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
          <div class="logo-text">Health Bloom</div>
</a>
        
        <div class="nav-actions">
          <a href="/profile" class="nav-button">
            <i data-feather="user"></i>
          </a>
          <button class="nav-button" onclick="this.dispatchEvent(new CustomEvent('menu-toggle'))">
            <i data-feather="menu"></i>
          </button>
        </div>
      </nav>
    `;

    // Заглушка обработчика для кнопки меню
    const menuButton = this.shadowRoot.querySelector('button.nav-button');
    if (menuButton) {
      menuButton.addEventListener('click', () => {
        console.log('Меню в разработке');
      });
    }
  }
}

customElements.define('custom-navbar', CustomNavbar);
