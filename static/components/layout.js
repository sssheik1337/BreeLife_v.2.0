class CustomLayout extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        .app-layout {
          position: fixed;
          inset: 0;
          display: flex;
          flex-direction: column;
          background: var(--tg-bg-color, #f8fafc);
          color: var(--tg-text-color, #0f172a);
          overflow: hidden;
          padding-bottom: env(safe-area-inset-bottom);
        }

        ::slotted(main) {
          flex: 1;
          width: 100%;
          max-width: 420px;
          margin: var(--header-height, 88px) auto 0;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          padding-bottom: var(--bottom-height, 96px);
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
