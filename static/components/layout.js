class CustomLayout extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        .app-layout {
          position: fixed;
          inset: 0;
          display: block;
          background: var(--tg-bg-color, #f8fafc);
          color: var(--tg-text-color, #0f172a);
          overflow: hidden;
          padding-bottom: env(safe-area-inset-bottom);
        }

        ::slotted(custom-navbar) {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
        }

        ::slotted(main) {
          position: absolute;
          top: var(--header-height, 88px);
          bottom: var(--bottom-height, 96px);
          left: 0;
          right: 0;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          width: 100%;
          max-width: 420px;
          margin: 0 auto;
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
