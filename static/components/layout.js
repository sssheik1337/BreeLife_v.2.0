class CustomLayout extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        .app-layout {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background-color: var(--tg-bg-color, #f8fafc);
          background-image: linear-gradient(135deg, #f8fafc 0%, #f0f9ff 50%, #f0fdf4 100%);
          color: var(--tg-text-color, #0f172a);
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          padding-top: env(safe-area-inset-top);
          padding-bottom: env(safe-area-inset-bottom);
        }
        
        .main-content {
          flex: 1;
          width: 100%;
          max-width: 420px;
          margin: 0 auto;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
        }
        
        @media (max-width: 640px) {
          .main-content {
            padding: 1.25rem;
          }
        }
      </style>
      
      <div class="app-layout">
        <slot></slot>
      </div>
    `;
    
    // Layout doesn't need content, it's just a wrapper
  }
}

customElements.define('custom-layout', CustomLayout);
