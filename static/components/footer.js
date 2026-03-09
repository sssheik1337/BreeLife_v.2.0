class CustomFooter extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .footer {
          margin-top: 0;
          padding: 2rem 1.5rem 1.5rem;
          background: white;
          border-top: 1px solid #f1f5f9;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        
        .footer-content {
          max-width: 420px;
          margin: 0 auto;
          text-align: center;
        }
        .footer-text {
          font-size: 0.875rem;
          color: #64748b;
          line-height: 1.5;
        }
        .copyright {
          font-size: 0.75rem;
          color: #94a3b8;
          margin-top: 1.5rem;
          padding-top: 1.5rem;
          border-top: 1px solid #f1f5f9;
        }
        
        @media (max-width: 640px) {
          .footer {
            padding: 1.75rem 1.25rem 1.25rem;
          }
          
        }

        .bottom-spacer {
          height: 0;
        }

        .bottom-nav {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          background: #ffffff;
          border-top: 1px solid #e2e8f0;
          box-shadow: 0 -6px 20px rgba(15, 23, 42, 0.08);
          padding: 0.5rem 1rem 0.75rem;
          z-index: 40;
        }

        .bottom-nav__inner {
          max-width: 420px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 0.5rem;
        }

        .bottom-link {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
          padding: 0.4rem 0.25rem;
          border-radius: 0.75rem;
          color: #64748b;
          font-size: 0.7rem;
          font-weight: 600;
          text-decoration: none;
          position: relative;
          isolation: isolate;
        }

        .bottom-link__icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 1.4rem;
          height: 1.4rem;
          line-height: 1;
        }

        .bottom-link__icon img,
        .faq-fab__icon img,
        .fab-menu__item-icon img,
        .faq-menu__item-icon img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .bottom-link__icon img {
          width: 1.3rem;
          height: 1.3rem;
          opacity: 0.92;
        }

        .bottom-link--active {
          color: #047857;
          background: #ecfdf3;
        }

        .bottom-link--active::before {
          content: '';
          position: absolute;
          inset: -2px;
          border-radius: inherit;
          padding: 2px;
          pointer-events: none;
          background: linear-gradient(
            120deg,
            #6ee7b7,
            #34d399,
            #22d3ee,
            #34d399,
            #6ee7b7
          );
          background-size: 220% 220%;
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask-composite: exclude;
          animation: bottom-link-ring-flow 3.2s ease-in-out infinite;
          z-index: -1;
        }

        .bottom-link--disabled {
          color: #cbd5e1;
          background: #f8fafc;
          opacity: 0.6;
          pointer-events: none;
        }

        .bottom-fab {
          position: relative;
          top: -28px;
          width: 56px;
          height: 56px;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, #34d399, #06b6d4);
          color: white;
          font-size: 0;
          line-height: 0;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          box-shadow: 0 12px 24px rgba(16, 185, 129, 0.3);
          isolation: isolate;
          z-index: 2;
        }

        .bottom-fab::before,
        .faq-fab::before {
          content: '';
          position: absolute;
          inset: -2px;
          border-radius: inherit;
          padding: 2px;
          pointer-events: none;
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask-composite: exclude;
          animation: fab-ring-spin 4s linear infinite;
          z-index: 0;
        }

        .bottom-fab::before {
          background: conic-gradient(
            from 180deg,
            #6ee7b7,
            #34d399,
            #22d3ee,
            #34d399,
            #6ee7b7
          );
        }

        .bottom-fab__plus {
          position: relative;
          display: inline-flex;
          width: 22px;
          height: 22px;
          align-items: center;
          justify-content: center;
          z-index: 1;
        }

        .bottom-fab__plus::before,
        .bottom-fab__plus::after {
          content: '';
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          background: #ffffff;
          border-radius: 999px;
        }

        .bottom-fab__plus::before {
          width: 18px;
          height: 3px;
        }

        .bottom-fab__plus::after {
          width: 3px;
          height: 18px;
        }

        .bottom-fab:active {
          transform: scale(0.98);
        }

        .faq-fab {
          position: fixed;
          right: max(20px, calc((100vw - 420px) / 2 + 12px));
          bottom: 104px;
          width: 52px;
          height: 52px;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, #0ea5e9, #06b6d4);
          color: #ffffff;
          font-size: 28px;
          font-weight: 700;
          line-height: 1;
          display: none;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          box-shadow: 0 10px 24px rgba(14, 165, 233, 0.28);
          isolation: isolate;
          z-index: 2147483002;
        }

        .faq-fab::before {
          background: conic-gradient(
            from 180deg,
            #7dd3fc,
            #38bdf8,
            #22d3ee,
            #0ea5e9,
            #7dd3fc
          );
        }

        .faq-fab__icon {
          position: relative;
          z-index: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 1.5rem;
          height: 1.5rem;
          font-size: 28px;
          font-weight: 700;
          color: #ffffff;
          line-height: 1;
        }

        .faq-fab:active {
          transform: scale(0.98);
        }

        .fab-overlay {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
          background: rgba(15, 23, 42, 0.35);
          z-index: 2147483000;
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          touch-action: none;
          overscroll-behavior: contain;
          transition: opacity 0.24s ease, visibility 0ms linear 0.24s;
        }

        .fab-overlay.hidden {
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
        }

        .fab-overlay:not(.hidden) {
          opacity: 1;
          visibility: visible;
          pointer-events: auto;
          transition-delay: 0ms;
        }

        .faq-overlay {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
          background: rgba(15, 23, 42, 0.35);
          z-index: 2147483000;
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          touch-action: none;
          overscroll-behavior: contain;
          transition: opacity 0.24s ease, visibility 0ms linear 0.24s;
        }

        .faq-overlay.hidden {
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
        }

        .faq-overlay:not(.hidden) {
          opacity: 1;
          visibility: visible;
          pointer-events: auto;
          transition-delay: 0ms;
        }

        .fab-menu {
          position: fixed;
          left: 50%;
          bottom: 90px;
          transform: translate(-50%, 24px) scale(0.86);
          z-index: 2147483001;
          background: #ffffff;
          border-radius: 18px;
          padding: 12px;
          width: min(380px, calc(100vw - 48px));
          box-shadow: 0 16px 32px rgba(15, 23, 42, 0.18);
          display: flex;
          flex-direction: column;
          gap: 10px;
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
        }

        .fab-menu__floating-logo,
        .faq-menu__floating-logo {
          position: absolute;
          left: 50%;
          top: -78px;
          transform: translateX(-50%);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 56px;
          height: 56px;
          border-radius: 18px;
          background: linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%);
          box-shadow: 0 14px 30px rgba(15, 23, 42, 0.14);
        }

        .fab-menu__floating-logo img,
        .faq-menu__floating-logo img {
          display: block;
          width: 32px;
          height: 32px;
          object-fit: contain;
        }

        .fab-menu.hidden {
          transform: translate(-50%, 24px) scale(0.86);
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          animation: none;
        }

        .fab-menu:not(.hidden) {
          visibility: visible;
          pointer-events: auto;
          animation: fab-menu-show 0.3s ease forwards;
        }

        .fab-menu__item {
          border: 1px solid rgba(16, 185, 129, 0.28);
          background: linear-gradient(135deg, #34d399 0%, #3b82f6 100%);
          border-radius: 12px;
          min-height: 58px;
          width: 100%;
          padding: 14px 18px;
          text-align: left;
          display: inline-flex;
          align-items: center;
          justify-content: flex-start;
          gap: 12px;
          font-size: 16px;
          font-weight: 600;
          line-height: 1.2;
          color: #ffffff;
          cursor: pointer;
          box-shadow: 0 8px 16px rgba(52, 211, 153, 0.24);
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, filter 0.2s ease;
        }

        .fab-menu__item:hover {
          border-color: rgba(16, 185, 129, 0.35);
          box-shadow: 0 10px 18px rgba(52, 211, 153, 0.3);
          filter: brightness(1.03);
        }

        .fab-menu__item:active {
          transform: scale(0.99);
        }

        .fab-menu__item-icon,
        .faq-menu__item-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          flex: 0 0 22px;
        }

        .faq-menu {
          position: fixed;
          left: 50%;
          bottom: 90px;
          transform: translate(-50%, 24px) scale(0.86);
          z-index: 2147483001;
          background: #ffffff;
          border-radius: 18px;
          padding: 12px;
          width: min(380px, calc(100vw - 48px));
          box-shadow: 0 16px 32px rgba(15, 23, 42, 0.18);
          display: flex;
          flex-direction: column;
          gap: 10px;
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
        }

        .faq-menu.hidden {
          transform: translate(-50%, 24px) scale(0.86);
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          animation: none;
        }

        .faq-menu:not(.hidden) {
          visibility: visible;
          pointer-events: auto;
          animation: fab-menu-show 0.3s ease forwards;
        }

        .faq-menu__item {
          border: 1px solid rgba(16, 185, 129, 0.28);
          background: linear-gradient(135deg, #34d399 0%, #3b82f6 100%);
          border-radius: 12px;
          min-height: 58px;
          width: 100%;
          padding: 14px 18px;
          text-align: left;
          display: inline-flex;
          align-items: center;
          justify-content: flex-start;
          gap: 12px;
          font-size: 16px;
          font-weight: 600;
          line-height: 1.2;
          color: #ffffff;
          cursor: pointer;
          box-shadow: 0 8px 16px rgba(52, 211, 153, 0.24);
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, filter 0.2s ease;
        }

        .faq-menu__item:hover {
          border-color: rgba(16, 185, 129, 0.35);
          box-shadow: 0 10px 18px rgba(52, 211, 153, 0.3);
          filter: brightness(1.03);
        }

        .faq-menu__item:active {
          transform: scale(0.99);
        }

        .footer-tour {
          position: fixed;
          inset: 0;
          z-index: 2147483003;
          pointer-events: none;
        }

        .footer-tour.hidden {
          display: none;
        }

        .footer-tour__shell {
          position: fixed;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          width: min(420px, calc(100vw - 48px));
          max-height: calc(100vh - 32px);
          pointer-events: none;
        }

        .footer-tour__spotlight-mask {
          position: fixed;
          left: 0;
          top: 0;
          width: 56px;
          height: 56px;
          box-sizing: border-box;
          border-radius: 20px;
          background: transparent;
          box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.46);
          pointer-events: none;
        }

        .footer-tour__spotlight-ring {
          position: fixed;
          left: 0;
          top: 0;
          width: 56px;
          height: 56px;
          box-sizing: border-box;
          border-radius: 20px;
          background: transparent;
          border: 2px solid rgba(255, 255, 255, 0.96);
          pointer-events: none;
          animation: footer-tour-spotlight-pulse 1.8s ease-in-out infinite;
        }

        .footer-tour__card {
          position: relative;
          width: 100%;
          max-height: calc(100vh - 96px);
          overflow: auto;
          box-sizing: border-box;
          border-radius: 24px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.99) 0%, rgba(248, 250, 252, 0.98) 100%);
          border: 1px solid rgba(226, 232, 240, 0.95);
          box-shadow: 0 22px 48px rgba(15, 23, 42, 0.24);
          padding: 22px 18px 16px;
          pointer-events: auto;
        }

        .footer-tour__skip {
          position: absolute;
          top: -14px;
          left: 50%;
          transform: translate(-50%, -100%);
          z-index: 1;
          pointer-events: auto;
        }

        .footer-tour__skip:hover {
          transform: translate(-50%, calc(-100% - 1px));
        }

        .footer-tour__skip:active {
          transform: translate(-50%, -100%);
        }

        .footer-tour__eyebrow {
          margin: 0 0 8px 0;
          color: #0f766e;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          text-align: center;
        }

        .footer-tour__title {
          margin: 0;
          color: #0f172a;
          font-size: 21px;
          line-height: 1.15;
          text-align: center;
        }

        .footer-tour__text {
          margin: 10px 0 0 0;
          color: #475569;
          font-size: 14px;
          line-height: 1.55;
          text-align: center;
        }

        .footer-tour__actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 16px;
        }

        .footer-tour__button {
          appearance: none;
          border: none;
          border-radius: 999px;
          padding: 11px 16px;
          font-family: inherit;
          font-size: 14px;
          font-weight: 700;
          line-height: 1;
          cursor: pointer;
          transition: transform 0.18s ease, opacity 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
        }

        .footer-tour__button:hover {
          transform: translateY(-1px);
        }

        .footer-tour__button:active {
          transform: translateY(0);
        }

        .footer-tour__button--ghost {
          background: #e2e8f0;
          color: #334155;
        }

        .footer-tour__button--secondary {
          background: #f8fafc;
          color: #475569;
          border: 1px solid #cbd5e1;
        }

        .footer-tour__button--primary {
          background: linear-gradient(135deg, #10b981, #06b6d4);
          color: #ffffff;
          box-shadow: 0 10px 20px rgba(16, 185, 129, 0.24);
        }

        @keyframes footer-tour-spotlight-pulse {
          0%,
          100% {
            box-shadow:
              0 0 0 2px rgba(255, 255, 255, 0.96),
              0 0 0 8px rgba(16, 185, 129, 0.24);
          }
          50% {
            box-shadow:
              0 0 0 2px rgba(255, 255, 255, 0.96),
              0 0 0 14px rgba(16, 185, 129, 0.16);
          }
        }

        @keyframes fab-ring-spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        @keyframes bottom-link-ring-flow {
          0% {
            background-position: 0% 50%;
            filter: saturate(0.95) brightness(0.98);
          }
          50% {
            background-position: 100% 50%;
            filter: saturate(1.08) brightness(1.04);
          }
          100% {
            background-position: 0% 50%;
            filter: saturate(0.95) brightness(0.98);
          }
        }

        @keyframes fab-menu-show {
          0% {
            transform: translate(-50%, 24px) scale(0.86);
            opacity: 0;
          }
          50% {
            transform: translate(-50%, -2px) scale(1.03);
            opacity: 1;
          }
          80% {
            transform: translate(-50%, 1px) scale(0.98);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, 0) scale(1);
            opacity: 1;
          }
        }

        @keyframes fab-menu-hide {
          0% {
            transform: translate(-50%, 0) scale(1);
            opacity: 1;
            visibility: visible;
          }
          100% {
            transform: translate(-50%, 24px) scale(0.86);
            opacity: 0;
            visibility: hidden;
          }
        }

        .fab-menu.no-flex-gap .fab-menu__item + .fab-menu__item {
          margin-top: 10px;
        }

        .faq-menu.no-flex-gap .faq-menu__item + .faq-menu__item {
          margin-top: 10px;
        }

        @media (prefers-reduced-motion: reduce) {
          .fab-overlay,
          .fab-menu,
          .faq-overlay,
          .faq-menu,
          .footer-tour__button,
          .footer-tour__spotlight-ring {
            transition: none;
            animation: none;
          }

          .bottom-fab::before,
          .faq-fab::before {
            animation: none;
          }
        }

        @media (min-width: 768px) {
          .bottom-nav {
            left: 50%;
            transform: translateX(-50%);
            width: min(420px, 100%);
            border-radius: 1rem 1rem 0 0;
          }
        }
      </style>

      <footer class="footer">
        <div class="footer-content">
          <p class="footer-text">
            🌱 Делайте маленькие шаги каждый день к более здоровому себе.
          </p>
          <div class="copyright">
            © ${new Date().getFullYear()} Health Bloom • Сделано с ❤️ для здоровой жизни
          </div>
        </div>
      </footer>

      <div class="bottom-spacer" aria-hidden="true"></div>

      <nav class="bottom-nav" aria-label="Основная навигация">
        <div class="bottom-nav__inner">
          <a href="/resume" class="bottom-link" data-bottom-link="profile">
            <span class="bottom-link__icon" aria-hidden="true"><img src="/ico/bust-in-silhouette-svgrepo-com.svg" alt="" /></span>
            <span>Профиль</span>
          </a>
          <a href="/diary" class="bottom-link" data-bottom-link="diary">
            <span class="bottom-link__icon" aria-hidden="true"><img src="/ico/fork-and-knife-with-plate-svgrepo-com.svg" alt="" /></span>
            <span>Дневник</span>
          </a>
          <a href="#" class="bottom-fab" aria-label="Добавить запись">
            <span class="bottom-fab__plus" aria-hidden="true"></span>
          </a>
          <a href="/meal-plan" class="bottom-link" data-bottom-link="meal-plan">
            <span class="bottom-link__icon" aria-hidden="true"><img src="/ico/clipboard-svgrepo-com.svg" alt="" /></span>
            <span>Рацион</span>
          </a>
          <a href="/profile" class="bottom-link" data-bottom-link="progress">
            <span class="bottom-link__icon" aria-hidden="true"><img src="/ico/bar-chart-svgrepo-com.svg" alt="" /></span>
            <span>Прогресс</span>
          </a>
        </div>
      </nav>

      <div class="fab-overlay hidden" data-fab-overlay></div>
      <div class="fab-menu hidden" data-fab-menu>
        <div class="fab-menu__floating-logo" aria-hidden="true">
          <img src="/static/emoji_u1f33f.svg" alt="" />
        </div>
        <button type="button" class="fab-menu__item" data-fab-action="meal" data-meal="breakfast"><span class="fab-menu__item-icon" aria-hidden="true"><img src="/ico/cooking-svgrepo-com.svg" alt="" /></span><span>Добавить завтрак</span></button>
        <button type="button" class="fab-menu__item" data-fab-action="meal" data-meal="lunch"><span class="fab-menu__item-icon" aria-hidden="true"><img src="/ico/pot-of-food-svgrepo-com.svg" alt="" /></span><span>Добавить обед</span></button>
        <button type="button" class="fab-menu__item" data-fab-action="meal" data-meal="dinner"><span class="fab-menu__item-icon" aria-hidden="true"><img src="/ico/fork-and-knife-with-plate-svgrepo-com.svg" alt="" /></span><span>Добавить ужин</span></button>
        <button type="button" class="fab-menu__item" data-fab-action="meal" data-meal="snack"><span class="fab-menu__item-icon" aria-hidden="true"><img src="/ico/red-apple-svgrepo-com.svg" alt="" /></span><span>Добавить перекус</span></button>
        <button type="button" class="fab-menu__item" data-fab-action="water"><span class="fab-menu__item-icon" aria-hidden="true"><img src="/ico/droplet-svgrepo-com.svg" alt="" /></span><span>Добавить воду</span></button>
        <button type="button" class="fab-menu__item" data-fab-action="sleep"><span class="fab-menu__item-icon" aria-hidden="true"><img src="/ico/crescent-moon-svgrepo-com.svg" alt="" /></span><span>Записать сон</span></button>
      </div>

      <a href="#" class="faq-fab" aria-label="Открыть разделы помощи и настроек">
        <span class="faq-fab__icon" aria-hidden="true">?</span>
      </a>
      <div class="faq-overlay hidden" data-faq-overlay></div>
      <div class="faq-menu hidden" data-faq-menu>
        <div class="faq-menu__floating-logo" aria-hidden="true">
          <img src="/static/emoji_u1f33f.svg" alt="" />
        </div>
        <button type="button" class="faq-menu__item" data-faq-action="guide"><span class="faq-menu__item-icon" aria-hidden="true"><img src="/ico/books-svgrepo-com.svg" alt="" /></span><span>Гид</span></button>
        <button type="button" class="faq-menu__item" data-faq-href="/settings/reminders"><span class="faq-menu__item-icon" aria-hidden="true"><img src="/ico/bell-svgrepo-com.svg" alt="" /></span><span>Напоминания</span></button>
        <button type="button" class="faq-menu__item" data-faq-href="/plans"><span class="faq-menu__item-icon" aria-hidden="true"><img src="/ico/credit-card-svgrepo-com.svg" alt="" /></span><span>Тарифы</span></button>
        <button type="button" class="faq-menu__item" data-faq-href="/legal"><span class="faq-menu__item-icon" aria-hidden="true"><img src="/ico/clipboard-svgrepo-com.svg" alt="" /></span><span>Оферта</span></button>
        <button type="button" class="faq-menu__item" data-faq-href="/references"><span class="faq-menu__item-icon" aria-hidden="true"><img src="/ico/books-svgrepo-com.svg" alt="" /></span><span>Справочники</span></button>
        <button type="button" class="faq-menu__item" data-faq-href="/support"><span class="faq-menu__item-icon" aria-hidden="true"><img src="/ico/megaphone-svgrepo-com.svg" alt="" /></span><span>Помощь</span></button>
      </div>

      <div class="footer-tour hidden" data-footer-tour aria-live="polite">
        <div class="footer-tour__spotlight-mask" data-footer-tour-spotlight-mask aria-hidden="true"></div>
        <div class="footer-tour__spotlight-ring" data-footer-tour-spotlight-ring aria-hidden="true"></div>
        <div class="footer-tour__shell">
          <button type="button" class="footer-tour__button footer-tour__button--ghost footer-tour__skip" data-footer-tour-skip>Пропустить</button>
          <div class="footer-tour__card" role="dialog" aria-modal="false" aria-label="Навигация по приложению">
            <p class="footer-tour__eyebrow" data-footer-tour-counter></p>
            <h3 class="footer-tour__title" data-footer-tour-title></h3>
            <p class="footer-tour__text" data-footer-tour-text></p>
            <div class="footer-tour__actions">
              <button type="button" class="footer-tour__button footer-tour__button--secondary" data-footer-tour-back>Назад</button>
              <button type="button" class="footer-tour__button footer-tour__button--primary" data-footer-tour-next>Далее</button>
            </div>
          </div>
        </div>
      </div>
    `;

    let hasCompletedProfile = window.profileCompleted === true;
    let hasPassedTrialGate = false;
    const isDevMode = window.appIsDev === true || window.appMode === 'development';

    const bottomLinks = {
      profile: this.shadowRoot.querySelector('[data-bottom-link="profile"]'),
      diary: this.shadowRoot.querySelector('[data-bottom-link="diary"]'),
      mealPlan: this.shadowRoot.querySelector('[data-bottom-link="meal-plan"]'),
      progress: this.shadowRoot.querySelector('[data-bottom-link="progress"]'),
    };
    const bottomFab = this.shadowRoot.querySelector('.bottom-fab');
    const bottomNav = this.shadowRoot.querySelector('.bottom-nav');
    const bottomSpacer = this.shadowRoot.querySelector('.bottom-spacer');
    const fabOverlay = this.shadowRoot.querySelector('[data-fab-overlay]');
    const fabMenu = this.shadowRoot.querySelector('[data-fab-menu]');
    const faqFab = this.shadowRoot.querySelector('.faq-fab');
    const faqOverlay = this.shadowRoot.querySelector('[data-faq-overlay]');
    const faqMenu = this.shadowRoot.querySelector('[data-faq-menu]');
    const faqGuideAction = this.shadowRoot.querySelector('[data-faq-action="guide"]');
    const footerTour = {
      root: this.shadowRoot.querySelector('[data-footer-tour]'),
      shell: this.shadowRoot.querySelector('.footer-tour__shell'),
      spotlightMask: this.shadowRoot.querySelector('[data-footer-tour-spotlight-mask]'),
      spotlightRing: this.shadowRoot.querySelector('[data-footer-tour-spotlight-ring]'),
      card: this.shadowRoot.querySelector('.footer-tour__card'),
      counter: this.shadowRoot.querySelector('[data-footer-tour-counter]'),
      title: this.shadowRoot.querySelector('[data-footer-tour-title]'),
      text: this.shadowRoot.querySelector('[data-footer-tour-text]'),
      next: this.shadowRoot.querySelector('[data-footer-tour-next]'),
      back: this.shadowRoot.querySelector('[data-footer-tour-back]'),
      skip: this.shadowRoot.querySelector('[data-footer-tour-skip]'),
    };
    const globalBackdropId = 'fab-faq-global-backdrop';
    const FOOTER_TOUR_START_DELAY_MS = 1100;
    const ensureGlobalBackdrop = () => {
      let backdrop = document.getElementById(globalBackdropId);
      if (backdrop) {
        return backdrop;
      }
      backdrop = document.createElement('div');
      backdrop.id = globalBackdropId;
      backdrop.style.position = 'fixed';
      backdrop.style.top = '0';
      backdrop.style.right = '0';
      backdrop.style.bottom = '0';
      backdrop.style.left = '0';
      backdrop.style.background = 'rgba(15, 23, 42, 0.35)';
      backdrop.style.opacity = '0';
      backdrop.style.visibility = 'hidden';
      backdrop.style.pointerEvents = 'none';
      backdrop.style.zIndex = '2147482999';
      backdrop.style.transition = 'opacity 0.24s ease, visibility 0ms linear 0.24s';
      document.body.appendChild(backdrop);
      return backdrop;
    };
    const globalBackdrop = ensureGlobalBackdrop();
    const detectFlexGapSupport = () => {
      const test = document.createElement('div');
      test.style.display = 'flex';
      test.style.flexDirection = 'column';
      test.style.rowGap = '1px';
      test.style.position = 'absolute';
      test.style.top = '-9999px';
      test.style.left = '-9999px';
      const childA = document.createElement('div');
      const childB = document.createElement('div');
      childA.style.height = '1px';
      childB.style.height = '1px';
      test.appendChild(childA);
      test.appendChild(childB);
      document.body.appendChild(test);
      const supported = test.scrollHeight === 3;
      test.remove();
      return supported;
    };
    if (!detectFlexGapSupport()) {
      fabMenu?.classList.add('no-flex-gap');
      faqMenu?.classList.add('no-flex-gap');
    }
    const footerTourSteps = [
      {
        key: 'profile',
        title: 'Профиль',
        text: 'Здесь хранятся ваши данные, цели и настройки. Чем точнее профиль, тем лучше BreeLife подбирает рацион, нормы и рекомендации.',
        getTarget: () => bottomLinks.profile,
      },
      {
        key: 'diary',
        title: 'Дневник',
        text: 'Это ваш ежедневный центр контроля. Добавляйте еду, воду и сон, чтобы видеть реальную картину дня, а не действовать наугад.',
        getTarget: () => bottomLinks.diary,
      },
      {
        key: 'fab',
        title: 'Быстрое добавление',
        text: 'Самая быстрая кнопка в приложении. Через неё удобно сразу внести запись, не переходя по экранам и не тратя лишние касания.',
        getTarget: () => bottomFab,
      },
      {
        key: 'mealPlan',
        title: 'Рацион',
        text: 'Здесь BreeLife собирает персональный план питания. Он опирается на ваши цели, предпочтения и выбранные продукты, чтобы рацион был жизнеспособным.',
        getTarget: () => bottomLinks.mealPlan,
      },
      {
        key: 'progress',
        title: 'Прогресс',
        text: 'Тут видно, как меняются ваши привычки и результаты со временем. Полезно заглядывать сюда регулярно, чтобы замечать реальные сдвиги.',
        getTarget: () => bottomLinks.progress,
      },
      {
        key: 'faq',
        title: 'FAQ, справка и тарифы',
        text: 'Здесь вы найдёте не только ответы на вопросы, но и справочники, помощь по функциям приложения и всё, что связано с тарифами. Раздел пригодится, если хотите быстрее разобраться в возможностях BreeLife.',
        placement: 'top-end',
        getTarget: () => faqFab,
        onNext: () => {
          stopFooterTour(true);
          scheduleFooterTourRefresh();
        },
      },
    ];
    const footerTourSkipHintStep = {
      key: 'faq-guide-hint',
      title: 'Гид можно открыть позже',
      text: 'Если захотите вернуться к подсказкам, откройте FAQ и нажмите кнопку «Гид». Она заново запустит это обучение в любой момент.',
      counter: 'Подсказка',
      nextLabel: 'Понятно',
      backLabel: 'Назад',
      showSkip: false,
      placement: 'top-end',
      getTarget: () => faqFab,
      onBack: () => {
        openFooterTourStep(footerTourSteps.length - 1);
      },
      onNext: () => {
        stopFooterTour(true);
        scheduleFooterTourRefresh();
      },
    };
    const footerTourState = {
      active: false,
      stepIndex: 0,
      currentStep: null,
      repositionFrame: 0,
      startTimer: 0,
      currentTarget: null,
      seenPersisted: false,
    };
    const scrollLockState = {
      active: false,
      scrollY: 0,
      htmlOverflow: '',
      bodyOverflow: '',
      bodyPosition: '',
      bodyTop: '',
      bodyWidth: '',
      bodyTouchAction: '',
    };

    const lockPageScroll = () => {
      if (scrollLockState.active) {
        return;
      }
      scrollLockState.active = true;
      scrollLockState.scrollY = window.scrollY || window.pageYOffset || 0;
      scrollLockState.htmlOverflow = document.documentElement.style.overflow;
      scrollLockState.bodyOverflow = document.body.style.overflow;
      scrollLockState.bodyPosition = document.body.style.position;
      scrollLockState.bodyTop = document.body.style.top;
      scrollLockState.bodyWidth = document.body.style.width;
      scrollLockState.bodyTouchAction = document.body.style.touchAction;

      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollLockState.scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.touchAction = 'none';
    };

    const unlockPageScroll = () => {
      if (!scrollLockState.active) {
        return;
      }
      document.documentElement.style.overflow = scrollLockState.htmlOverflow;
      document.body.style.overflow = scrollLockState.bodyOverflow;
      document.body.style.position = scrollLockState.bodyPosition;
      document.body.style.top = scrollLockState.bodyTop;
      document.body.style.width = scrollLockState.bodyWidth;
      document.body.style.touchAction = scrollLockState.bodyTouchAction;
      const restoreY = scrollLockState.scrollY;
      scrollLockState.active = false;
      window.scrollTo(0, restoreY);
    };

    const syncPageLockByMenuState = () => {
      const fabOpen = Boolean(fabMenu && !fabMenu.classList.contains('hidden'));
      const faqOpen = Boolean(faqMenu && !faqMenu.classList.contains('hidden'));
      const anyOpen = fabOpen || faqOpen;
      if (anyOpen) {
        lockPageScroll();
      } else {
        unlockPageScroll();
      }
      if (globalBackdrop) {
        globalBackdrop.style.opacity = anyOpen ? '1' : '0';
        globalBackdrop.style.visibility = anyOpen ? 'visible' : 'hidden';
        globalBackdrop.style.pointerEvents = anyOpen ? 'auto' : 'none';
        globalBackdrop.style.transition = anyOpen
          ? 'opacity 0.24s ease'
          : 'opacity 0.24s ease, visibility 0ms linear 0.24s';
      }
    };

    const resolveProfileSnapshot = () => {
      try {
        if (typeof window.getUserProfile === 'function') {
          const profile = window.getUserProfile();
          if (profile && typeof profile === 'object') {
            return profile;
          }
        }
      } catch (error) {
        return null;
      }
      return null;
    };

    const evaluateTrialGate = (profile) => {
      if (!profile || typeof profile !== 'object') {
        return false;
      }
      if (profile.trial_welcome_seen === true) {
        return true;
      }
      if (profile.trial_started_at) {
        return true;
      }
      if (profile.subscription_until) {
        return true;
      }
      const subscriptionStatus = typeof profile.subscription_status === 'string'
        ? profile.subscription_status.trim().toLowerCase()
        : '';
      return ['trial', 'active', 'expired', 'paid', 'lifetime'].includes(subscriptionStatus);
    };

    const syncOnboardingGateState = () => {
      const profile = resolveProfileSnapshot();
      const profileCompletedFromGetter = typeof window.getProfileCompleted === 'function'
        ? window.getProfileCompleted() === true
        : false;
      const profileCompletedFromSnapshot = Boolean(profile?.is_completed === true);
      hasCompletedProfile = Boolean(
        hasCompletedProfile
        || window.profileCompleted === true
        || profileCompletedFromGetter
        || profileCompletedFromSnapshot
      );
      hasPassedTrialGate = Boolean(hasPassedTrialGate || evaluateTrialGate(profile));
    };

    const isFaqFabUnlocked = () => (
      hasCompletedProfile
      && hasPassedTrialGate
    );

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

    const getProfileSnapshot = () => {
      try {
        if (typeof window.getUserProfile === 'function') {
          const profile = window.getUserProfile();
          if (profile && typeof profile === 'object') {
            return profile;
          }
        }
      } catch (error) {
        return null;
      }
      return null;
    };

    const hasSeenFooterTour = () => getProfileSnapshot()?.footer_navigation_tour_seen === true;

    const isFooterTourProfileReady = () => {
      if (window.serverUser?.authorized !== true) {
        return false;
      }
      const profile = getProfileSnapshot();
      if (!profile || typeof profile !== 'object') {
        return false;
      }
      if (typeof profile.footer_navigation_tour_seen === 'boolean') {
        return true;
      }
      return Boolean(
        profile.is_completed === true
        || profile.sex
        || profile.birth_date
        || profile.goal
        || profile.trial_welcome_seen === true
        || profile.trial_started_at
        || profile.subscription_status
        || profile.subscription_until
        || profile.last_updated
      );
    };

    const persistFooterTourSeen = async (seen) => {
      try {
        if (typeof window.patchUserProfile === 'function') {
          window.patchUserProfile({ footer_navigation_tour_seen: seen }, { skipBackend: true });
        }
      } catch (error) {
      }
      try {
        if (typeof window.patchUserProfileWithBackend === 'function') {
          await window.patchUserProfileWithBackend({ footer_navigation_tour_seen: seen });
        }
      } catch (error) {
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

    const closeFabMenu = () => {
      fabMenu?.classList.add('hidden');
      fabOverlay?.classList.add('hidden');
      syncPageLockByMenuState();
    };

    const closeFaqMenu = () => {
      faqMenu?.classList.add('hidden');
      faqOverlay?.classList.add('hidden');
      syncPageLockByMenuState();
    };

    const openFabMenu = () => {
      closeFaqMenu();
      fabMenu?.classList.remove('hidden');
      fabOverlay?.classList.remove('hidden');
      syncPageLockByMenuState();
    };

    const openFaqMenu = () => {
      closeFabMenu();
      faqMenu?.classList.remove('hidden');
      faqOverlay?.classList.remove('hidden');
      syncPageLockByMenuState();
    };

    const toggleFabMenu = () => {
      if (!fabMenu || !fabOverlay) {
        return;
      }
      const isHidden = fabMenu.classList.contains('hidden');
      if (isHidden) {
        openFabMenu();
      } else {
        closeFabMenu();
      }
    };

    const toggleFaqMenu = () => {
      if (!faqMenu || !faqOverlay) {
        return;
      }
      const isHidden = faqMenu.classList.contains('hidden');
      if (isHidden) {
        openFaqMenu();
      } else {
        closeFaqMenu();
      }
    };

    const clearFooterTourHighlight = () => {
      if (footerTourState.currentTarget && footerTourState.currentTarget.classList) {
        footerTourState.currentTarget.classList.remove('footer-tour-target--active');
      }
      footerTourState.currentTarget = null;
      [footerTour.spotlightMask, footerTour.spotlightRing].forEach((element) => {
        if (!element) {
          return;
        }
        element.style.width = '0px';
        element.style.height = '0px';
        element.style.left = '0px';
        element.style.top = '0px';
        element.style.borderRadius = '0px';
      });
    };

    const isVisibleForTour = (element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }
      const styles = window.getComputedStyle(element);
      if (styles.display === 'none' || styles.visibility === 'hidden' || styles.opacity === '0') {
        return false;
      }
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const hasBlockingOverlay = () => {
      const selectors = [
        '.telegram-gate',
        '.subscription-gate',
        '.offer-gate',
        '.plans-payment-overlay',
      ];
      return selectors.some((selector) => {
        const element = document.querySelector(selector);
        if (!(element instanceof HTMLElement)) {
          return false;
        }
        const styles = window.getComputedStyle(element);
        if (styles.display === 'none' || styles.visibility === 'hidden' || styles.opacity === '0') {
          return false;
        }
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
    };

    const cancelFooterTourReposition = () => {
      if (footerTourState.repositionFrame) {
        window.cancelAnimationFrame(footerTourState.repositionFrame);
        footerTourState.repositionFrame = 0;
      }
    };

    const scheduleFooterTourReposition = () => {
      if (!footerTourState.active) {
        return;
      }
      cancelFooterTourReposition();
      footerTourState.repositionFrame = window.requestAnimationFrame(() => {
        footerTourState.repositionFrame = 0;
        renderFooterTourStep();
      });
    };

    const scheduleFooterTourRefresh = () => {
      window.requestAnimationFrame(() => {
        updateBottomNavVisibility();
        updateActiveBottomLink();
      });
    };

    const closeAllFloatingMenus = () => {
      closeFabMenu();
      closeFaqMenu();
    };

    const getCurrentFooterTourStep = () => {
      if (footerTourState.currentStep && typeof footerTourState.currentStep === 'object') {
        return footerTourState.currentStep;
      }
      return footerTourSteps[footerTourState.stepIndex] || null;
    };

    const ensureFooterTourSeenPersisted = () => {
      if (footerTourState.seenPersisted || hasSeenFooterTour()) {
        return;
      }
      footerTourState.seenPersisted = true;
      void persistFooterTourSeen(true);
    };

    const stopFooterTour = (completed = true) => {
      cancelFooterTourReposition();
      if (footerTourState.startTimer) {
        window.clearTimeout(footerTourState.startTimer);
        footerTourState.startTimer = 0;
      }
      footerTourState.active = false;
      footerTourState.stepIndex = 0;
      footerTourState.currentStep = null;
      clearFooterTourHighlight();
      footerTour.root?.classList.add('hidden');
      closeAllFloatingMenus();
    };

    const openFooterTourStep = (stepOrIndex) => {
      const resolvedStep = typeof stepOrIndex === 'number'
        ? (footerTourSteps[stepOrIndex] || null)
        : (stepOrIndex && typeof stepOrIndex === 'object' ? stepOrIndex : null);
      if (!resolvedStep) {
        stopFooterTour(true);
        return;
      }
      footerTourState.active = true;
      footerTourState.stepIndex = typeof stepOrIndex === 'number' ? stepOrIndex : -1;
      footerTourState.currentStep = resolvedStep;
      closeAllFloatingMenus();
      ensureFooterTourSeenPersisted();
      renderFooterTourStep();
    };

    const goToNextFooterTourStep = () => {
      const step = getCurrentFooterTourStep();
      if (step && typeof step.onNext === 'function') {
        step.onNext();
        return;
      }
      if (footerTourState.stepIndex < 0) {
        stopFooterTour(true);
        return;
      }
      openFooterTourStep(footerTourState.stepIndex + 1);
    };

    const goToPreviousFooterTourStep = () => {
      const step = getCurrentFooterTourStep();
      if (step && typeof step.onBack === 'function') {
        step.onBack();
        return;
      }
      if (footerTourState.stepIndex <= 0) {
        return;
      }
      openFooterTourStep(footerTourState.stepIndex - 1);
    };

    function renderFooterTourStep() {
      if (!footerTourState.active || !footerTour.root || !footerTour.spotlightMask || !footerTour.spotlightRing || !footerTour.card || !footerTour.counter || !footerTour.title || !footerTour.text || !footerTour.next || !footerTour.back) {
        return;
      }

      const step = getCurrentFooterTourStep();
      if (!step) {
        stopFooterTour(true);
        return;
      }

      const target = step.getTarget();
      if (!isVisibleForTour(target)) {
        stopFooterTour(false);
        return;
      }

      clearFooterTourHighlight();
      footerTourState.currentTarget = target;

      footerTour.counter.textContent = typeof step.counter === 'string' && step.counter.trim()
        ? step.counter
        : `Навигация ${footerTourState.stepIndex + 1} из ${footerTourSteps.length}`;
      footerTour.title.textContent = step.title;
      footerTour.text.textContent = step.text;
      footerTour.next.textContent = typeof step.nextLabel === 'string' && step.nextLabel.trim()
        ? step.nextLabel
        : (footerTourState.stepIndex === footerTourSteps.length - 1 ? 'Начать' : 'Далее');
      footerTour.back.textContent = typeof step.backLabel === 'string' && step.backLabel.trim()
        ? step.backLabel
        : 'Назад';
      footerTour.back.style.display = step.showBack === false ? 'none' : '';
      footerTour.back.disabled = footerTourState.stepIndex === 0 && typeof step.onBack !== 'function';
      if (footerTour.skip) {
        footerTour.skip.style.display = step.showSkip === false ? 'none' : '';
      }
      footerTour.root.classList.remove('hidden');

      const targetRect = target.getBoundingClientRect();
      const isCircularTarget = target === bottomFab || target === faqFab;
      const spotlightPadding = isCircularTarget ? 10 : 8;
      const targetCenterX = targetRect.left + (targetRect.width / 2);
      const targetCenterY = targetRect.top + (targetRect.height / 2);
      const spotlightWidth = isCircularTarget
        ? Math.max(targetRect.width, targetRect.height) + (spotlightPadding * 2)
        : Math.max(targetRect.width + (spotlightPadding * 2), 48);
      const spotlightHeight = isCircularTarget
        ? spotlightWidth
        : Math.max(targetRect.height + (spotlightPadding * 2), 48);
      const spotlightLeft = Math.round(targetCenterX - (spotlightWidth / 2));
      const spotlightTop = Math.round(targetCenterY - (spotlightHeight / 2));

      [footerTour.spotlightMask, footerTour.spotlightRing].forEach((element) => {
        element.style.width = `${Math.round(spotlightWidth)}px`;
        element.style.height = `${Math.round(spotlightHeight)}px`;
        element.style.left = `${spotlightLeft}px`;
        element.style.top = `${spotlightTop}px`;
        element.style.borderRadius = isCircularTarget ? '999px' : '18px';
      });
    }

    const canStartFooterTour = () => (
      isVisibleForTour(bottomNav)
      && isVisibleForTour(bottomLinks.profile)
      && isVisibleForTour(bottomLinks.diary)
      && isVisibleForTour(bottomFab)
      && isVisibleForTour(bottomLinks.mealPlan)
      && isVisibleForTour(bottomLinks.progress)
      && isVisibleForTour(faqFab)
      && !hasBlockingOverlay()
    );

    const maybeStartFooterTour = (force = false) => {
      if (footerTourState.active) {
        scheduleFooterTourReposition();
        return;
      }
      if (!force && !isFooterTourProfileReady()) {
        return;
      }
      if (!force && hasSeenFooterTour()) {
        return;
      }
      if (footerTourState.startTimer) {
        window.clearTimeout(footerTourState.startTimer);
      }
      footerTourState.startTimer = window.setTimeout(() => {
        footerTourState.startTimer = 0;
        if (!canStartFooterTour()) {
          return;
        }
        openFooterTourStep(0);
      }, force ? 40 : FOOTER_TOUR_START_DELAY_MS);
    };

    const handleFooterTourTargetClick = (event) => {
      if (!footerTourState.active) {
        return;
      }
      if (event.currentTarget !== footerTourState.currentTarget) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
      goToNextFooterTourStep();
    };

    footerTour.next?.addEventListener('click', () => {
      goToNextFooterTourStep();
    });
    footerTour.back?.addEventListener('click', () => {
      goToPreviousFooterTourStep();
    });
    footerTour.skip?.addEventListener('click', () => {
      ensureFooterTourSeenPersisted();
      openFooterTourStep(footerTourSkipHintStep);
    });

    const applyBottomNavState = (profileCompleted) => {
      const shouldDisable = !profileCompleted;
      Object.values(bottomLinks).forEach((link) => {
        if (!link) {
          return;
        }
        if (!link.dataset.originalHref) {
          link.dataset.originalHref = link.getAttribute('href') || '/profile';
        }
        if (shouldDisable) {
          link.href = '/questionnaire';
          link.classList.add('bottom-link--disabled');
          if (!link.dataset.disableHandlerAttached) {
            link.dataset.disableHandlerAttached = 'true';
            link.addEventListener('click', (event) => {
              if (!link.classList.contains('bottom-link--disabled')) {
                return;
              }
              event.preventDefault();
              if (typeof showNotification === 'function') {
                showNotification('Сначала заполните анкету.', 'error');
              }
              navigateTo('/questionnaire');
            });
          }
        } else {
          link.href = link.dataset.originalHref;
          link.classList.remove('bottom-link--disabled');
        }
      });
      if (bottomFab) {
        if (!bottomFab.dataset.originalHref) {
          bottomFab.dataset.originalHref = bottomFab.getAttribute('href') || '/diary';
        }
        if (shouldDisable) {
          bottomFab.href = '/questionnaire';
          bottomFab.classList.add('bottom-link--disabled');
        } else {
          bottomFab.href = bottomFab.dataset.originalHref;
          bottomFab.classList.remove('bottom-link--disabled');
        }
      }
    };

    if (bottomFab) {
      bottomFab.addEventListener('click', (event) => {
        event.preventDefault();
        const isDisabled = bottomFab.classList.contains('bottom-link--disabled');
        if (isDisabled) {
          return;
        }
        // РќР° Р»СЋР±РѕР№ СЃС‚СЂР°РЅРёС†Рµ СЃРЅР°С‡Р°Р»Р° РѕС‚РєСЂС‹РІР°РµРј РёРЅС‚РµСЂР°РєС‚РёРІРЅРѕРµ РјРµРЅСЋ,
        // РЅРµ РїРµСЂРµРІРѕРґСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РЅР° СЌРєСЂР°РЅ РґРЅРµРІРЅРёРєР° Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё.
        toggleFabMenu();
      });
      bottomFab.addEventListener('click', handleFooterTourTargetClick, true);
    }

    if (fabOverlay) {
      fabOverlay.addEventListener('click', () => {
        closeFabMenu();
      });
      fabOverlay.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        closeFabMenu();
      });
      fabOverlay.addEventListener('touchstart', (event) => {
        event.preventDefault();
        closeFabMenu();
      }, { passive: false });
    }

    if (faqFab) {
      faqFab.addEventListener('click', (event) => {
        event.preventDefault();
        toggleFaqMenu();
      });
      faqFab.addEventListener('click', handleFooterTourTargetClick, true);
    }

    if (faqOverlay) {
      faqOverlay.addEventListener('click', () => {
        closeFaqMenu();
      });
      faqOverlay.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        closeFaqMenu();
      });
      faqOverlay.addEventListener('touchstart', (event) => {
        event.preventDefault();
        closeFaqMenu();
      }, { passive: false });
    }

    if (globalBackdrop && !globalBackdrop.dataset.menuCloseBound) {
      const closeFromBackdrop = (event) => {
        event.preventDefault();
        closeFabMenu();
        closeFaqMenu();
      };
      globalBackdrop.addEventListener('click', closeFromBackdrop);
      globalBackdrop.addEventListener('pointerdown', closeFromBackdrop);
      globalBackdrop.addEventListener('touchstart', closeFromBackdrop, { passive: false });
      globalBackdrop.dataset.menuCloseBound = 'true';
    }

    const closeMenusOnOutsideInteraction = (event) => {
      const fabOpen = Boolean(fabMenu && !fabMenu.classList.contains('hidden'));
      const faqOpen = Boolean(faqMenu && !faqMenu.classList.contains('hidden'));
      if (!fabOpen && !faqOpen) {
        return;
      }
      const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
      const clickedInsideFab =
        path.includes(bottomFab)
        || path.includes(fabMenu)
        || path.includes(fabOverlay);
      const clickedInsideFaq =
        path.includes(faqFab)
        || path.includes(faqMenu)
        || path.includes(faqOverlay);
      if (!clickedInsideFab && !clickedInsideFaq) {
        closeFabMenu();
        closeFaqMenu();
      }
    };

    document.addEventListener('pointerdown', closeMenusOnOutsideInteraction, true);
    document.addEventListener('touchstart', closeMenusOnOutsideInteraction, { capture: true, passive: true });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeFabMenu();
        closeFaqMenu();
      }
    });

    this.shadowRoot.querySelectorAll('[data-faq-href]').forEach((item) => {
      item.addEventListener('click', () => {
        closeFaqMenu();
        const target = item.getAttribute('data-faq-href');
        if (target) {
          navigateTo(target);
        }
      });
    });

    this.shadowRoot.querySelectorAll('[data-faq-action="guide"]').forEach((item) => {
      item.addEventListener('click', () => {
        closeFaqMenu();
        stopFooterTour(false);
        openFooterTourStep(0);
      });
      item.addEventListener('click', handleFooterTourTargetClick, true);
    });

    this.shadowRoot.querySelectorAll('[data-fab-action]').forEach((item) => {
      item.addEventListener('click', () => {
        const action = item.dataset.fabAction;
        const meal = item.dataset.meal || '';
        closeFabMenu();

        const currentPath = window.location.pathname || '/';
        const isDiaryPage = currentPath.startsWith('/diary') || currentPath.startsWith('/app/diary');

        if (isDiaryPage) {
          window.dispatchEvent(new CustomEvent('diary-fab-action', {
            detail: { action, meal }
          }));
          return;
        }

        const params = new URLSearchParams();
        params.set('fab', '1');
        params.set('action', action || 'meal');
        if (meal) {
          params.set('meal', meal);
        }
        navigateTo(`/diary?${params.toString()}`);
      });
    });

    Object.values(bottomLinks).forEach((link) => {
      if (!link) {
        return;
      }

      link.addEventListener('click', (event) => {
        if (event.defaultPrevented) {
          return;
        }
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
          return;
        }
        if (link.classList.contains('bottom-link--disabled')) {
          return;
        }

        const target = link.getAttribute('href');
        if (!target || target === '#') {
          return;
        }

        const normalizedTarget = normalizeSpaTarget(target);
        if (normalizedTarget) {
          window.__SPA_CURRENT_PATH__ = normalizedTarget;
        }
        updateActiveBottomLink();
        event.preventDefault();
        navigateTo(target);
      });
      link.addEventListener('click', handleFooterTourTargetClick, true);
    });

    applyBottomNavState(hasCompletedProfile);
    window.addEventListener('profile-status-updated', (event) => {
      const profileCompleted = Boolean(event?.detail?.profileCompleted);
      hasCompletedProfile = profileCompleted;
      if (typeof event?.detail?.trialGatePassed === 'boolean') {
        hasPassedTrialGate = event.detail.trialGatePassed === true;
      }
      applyBottomNavState(profileCompleted);
      updateBottomNavVisibility();
      updateActiveBottomLink();
    });

    const resolveCurrentPath = () => {
      const runtimePath = typeof window.__SPA_CURRENT_PATH__ === 'string' ? window.__SPA_CURRENT_PATH__ : '';
      if (runtimePath.startsWith('/')) {
        return runtimePath === '/app' ? '/' : (runtimePath.startsWith('/app/') ? runtimePath.slice(4) : runtimePath);
      }
      const rawPath = window.location.pathname || '/';
      const fromPathname = rawPath === '/app' ? '/' : (rawPath.startsWith('/app/') ? rawPath.slice(4) : rawPath);
      if (fromPathname !== '/') {
        return fromPathname;
      }
      const hash = window.location.hash || '';
      if (hash.startsWith('#/')) {
        return hash.slice(1);
      }
      return fromPathname;
    };

    const updateBottomNavVisibility = () => {
      syncOnboardingGateState();
      const currentPath = resolveCurrentPath();
      const shouldHideBottomNav = !hasCompletedProfile && currentPath.startsWith('/questionnaire');
      const shouldHideFaqFab = !isFaqFabUnlocked();
      if (bottomNav) {
        bottomNav.style.display = shouldHideBottomNav ? 'none' : '';
      }
      if (faqFab) {
        faqFab.style.display = shouldHideFaqFab ? 'none' : 'inline-flex';
      }
      if (bottomSpacer) {
        bottomSpacer.style.height = shouldHideBottomNav ? '0' : '0';
      }
      if (shouldHideBottomNav || shouldHideFaqFab) {
        closeFabMenu();
        closeFaqMenu();
      }
      syncPageLockByMenuState();
      if (footerTourState.active) {
        if (!canStartFooterTour()) {
          stopFooterTour(false);
        } else {
          scheduleFooterTourReposition();
        }
      } else {
        maybeStartFooterTour(false);
      }
    };

    const updateActiveBottomLink = () => {
      const currentPath = resolveCurrentPath();
      let activeKey = '';
      if (currentPath.startsWith('/diary')) {
        activeKey = 'diary';
      } else if (
        currentPath.startsWith('/meal-plan')
        || currentPath.startsWith('/shopping-list')
        || currentPath.startsWith('/foods')
        || currentPath.startsWith('/my-products')
      ) {
        activeKey = 'mealPlan';
      } else if (currentPath.startsWith('/resume')) {
        activeKey = 'profile';
      } else if (currentPath.startsWith('/profile') || currentPath.startsWith('/progress')) {
        activeKey = 'progress';
      } else if (
        currentPath === '/'
        || currentPath.startsWith('/questionnaire')
        || currentPath.startsWith('/preferences-onboarding')
        || currentPath.startsWith('/trial-start')
      ) {
        activeKey = 'profile';
      }

      Object.entries(bottomLinks).forEach(([key, link]) => {
        if (!link) {
          return;
        }
        link.classList.toggle('bottom-link--active', key === activeKey);
      });
      if (footerTourState.active) {
        scheduleFooterTourReposition();
      }
    };

    window.startFooterNavigationTour = () => {
      stopFooterTour(false);
      openFooterTourStep(0);
    };
    window.resetFooterNavigationTour = () => {
      stopFooterTour(false);
      footerTourState.seenPersisted = false;
      void persistFooterTourSeen(false).finally(() => {
        openFooterTourStep(0);
      });
    };

    updateBottomNavVisibility();
    updateActiveBottomLink();
    maybeStartFooterTour(false);
    // Profile snapshot can arrive asynchronously after component mount.
    window.setTimeout(updateBottomNavVisibility, 120);
    window.setTimeout(updateBottomNavVisibility, 500);
    window.setTimeout(updateBottomNavVisibility, 1200);
    window.addEventListener('focus', updateBottomNavVisibility);
    window.addEventListener('resize', scheduleFooterTourReposition, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        updateBottomNavVisibility();
      }
    });
    window.addEventListener('popstate', () => {
      updateBottomNavVisibility();
      updateActiveBottomLink();
    });
    window.addEventListener('spa-route-changed', () => {
      updateBottomNavVisibility();
      updateActiveBottomLink();
    });
  }
}

customElements.define('custom-footer', CustomFooter);
