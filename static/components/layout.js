class CustomLayout extends HTMLElement {
  connectedCallback() {
    // Помечаем корневой scroll-контейнер для принудительного сброса прокрутки при старте.
    this.classList.add('app-content');
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          height: 100%;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          --app-safe-top: max(env(safe-area-inset-top), var(--tg-safe-top, 0px));
        }

        .app-layout {
          min-height: 100%;
          display: flex;
          flex-direction: column;
          background: var(--tg-bg-color, #f8fafc);
          color: var(--tg-text-color, #0f172a);
          padding-top: var(--app-safe-top);
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
