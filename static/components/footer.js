class CustomFooter extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .footer {
          margin-top: auto;
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
.footer-links {
          display: flex;
          justify-content: center;
          gap: 1.5rem;
          margin-top: 1rem;
          margin-bottom: 1.5rem;
        }
        
        .footer-link {
          color: #34d399;
          text-decoration: none;
          font-weight: 500;
          font-size: 0.875rem;
          transition: color 0.2s ease;
        }
        
        .footer-link:active {
          color: #10b981;
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
          
          .footer-links {
            flex-wrap: wrap;
            gap: 1rem 1.5rem;
          }
        }

        .bottom-spacer {
          height: 76px;
        }

        .bottom-nav {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(255, 255, 255, 0.98);
          border-top: 1px solid #e2e8f0;
          box-shadow: 0 -6px 20px rgba(15, 23, 42, 0.08);
          padding: 0.5rem 1rem 0.75rem;
          z-index: 40;
        }

        .bottom-nav__inner {
          max-width: 420px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
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
        }

        .bottom-link__icon {
          font-size: 1.15rem;
          line-height: 1;
        }

        .bottom-link--active {
          color: #047857;
          background: #ecfdf3;
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

      <div class="bottom-spacer" aria-hidden="true"></div>
      
      <footer class="footer">
        <div class="footer-content">
          <p class="footer-text">
            🌱 Посадите здоровье сегодня, расцветёте завтра. Делайте маленькие шаги каждый день к более здоровому себе.
          </p>
<div class="footer-links">
            <a href="/profile" class="footer-link" data-link="home">Главная</a>
            <a href="/questionnaire" class="footer-link" data-link="questionnaire">Опрос</a>
            <a href="/resume" class="footer-link" data-link="resume">Сводка</a>
            <a href="/profile" class="footer-link" data-link="profile">Профиль</a>
</div>
          <div class="copyright">
            © ${new Date().getFullYear()} Health Bloom • Сделано с ❤️ для здоровой жизни
          </div>
</div>
      </footer>

      <nav class="bottom-nav" aria-label="Основная навигация">
        <div class="bottom-nav__inner">
          <a href="/profile" class="bottom-link" data-bottom-link="profile">
            <span class="bottom-link__icon" aria-hidden="true">👤</span>
            <span>Профиль</span>
          </a>
          <a href="/diary?mode=summary" class="bottom-link" data-bottom-link="diary">
            <span class="bottom-link__icon" aria-hidden="true">🍽️</span>
            <span>Дневник</span>
          </a>
          <a href="/meal-plan" class="bottom-link" data-bottom-link="meal-plan">
            <span class="bottom-link__icon" aria-hidden="true">📋</span>
            <span>Рацион</span>
          </a>
          <a href="/profile#profile-month-grid-section" class="bottom-link" data-bottom-link="progress">
            <span class="bottom-link__icon" aria-hidden="true">📊</span>
            <span>Прогресс</span>
          </a>
        </div>
      </nav>
    `;

    const links = {
      home: this.shadowRoot.querySelector('[data-link="home"]'),
      questionnaire: this.shadowRoot.querySelector('[data-link="questionnaire"]'),
      resume: this.shadowRoot.querySelector('[data-link="resume"]'),
      profile: this.shadowRoot.querySelector('[data-link="profile"]'),
    };

    const isProfileCompleted = () => {
      try {
        const raw = localStorage.getItem('user_profile');
        if (!raw) {
          return false;
        }
        const profile = JSON.parse(raw);
        if (!profile || typeof profile !== 'object') {
          return false;
        }
        return profile.completed === true;
      } catch (error) {
        return false;
      }
    };

    const hasCompletedProfile = isProfileCompleted();

    if (links.home) {
      links.home.href = '/profile';
    }
    if (links.resume) {
      links.resume.href = '/resume';
    }
    if (links.profile) {
      links.profile.href = '/profile';
    }
      if (links.questionnaire) {
        if (hasCompletedProfile) {
          links.questionnaire.textContent = 'Редактировать данные';
          links.questionnaire.href = '/questionnaire?edit=1';
        } else {
          links.questionnaire.textContent = 'Опрос';
          links.questionnaire.href = '/questionnaire';
      }
    }

    const bottomLinks = {
      profile: this.shadowRoot.querySelector('[data-bottom-link="profile"]'),
      diary: this.shadowRoot.querySelector('[data-bottom-link="diary"]'),
      mealPlan: this.shadowRoot.querySelector('[data-bottom-link="meal-plan"]'),
      progress: this.shadowRoot.querySelector('[data-bottom-link="progress"]'),
    };

    const currentPath = window.location.pathname || '/';
    const currentHash = window.location.hash || '';
    let activeKey = 'profile';
    if (currentPath.startsWith('/diary')) {
      activeKey = 'diary';
    } else if (currentPath.startsWith('/meal-plan')) {
      activeKey = 'meal-plan';
    } else if (currentHash.includes('progress') || currentHash.includes('month')) {
      activeKey = 'progress';
    } else if (currentPath.startsWith('/profile')) {
      activeKey = 'profile';
    }

    Object.entries(bottomLinks).forEach(([key, link]) => {
      if (!link) {
        return;
      }
      link.classList.toggle('bottom-link--active', key === activeKey);
    });
  }
}

customElements.define('custom-footer', CustomFooter);
