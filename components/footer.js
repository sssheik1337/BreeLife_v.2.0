class CustomFooter extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        .footer {
          margin-top: auto;
          padding: 2rem 1.5rem 1.5rem;
          background: white;
          border-top: 1px solid #f1f5f9;
        }
        
        .footer-content {
          max-width: 420px;
          margin: 0 auto;
          text-align: center;
        }
        .footer-text {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
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
      </style>
      
      <footer class="footer">
        <div class="footer-content">
          <p class="footer-text">
            🌱 Посадите здоровье сегодня, расцветёте завтра. Делайте маленькие шаги каждый день к более здоровому себе.
          </p>
<div class="footer-links">
            <a href="index.html" class="footer-link">Главная</a>
            <a href="questionnaire.html" class="footer-link">Опрос</a>
            <a href="resume.html" class="footer-link">Сводка</a>
            <a href="profile.html" class="footer-link">Профиль</a>
</div>
          <div class="copyright">
            © ${new Date().getFullYear()} Health Bloom • Сделано с ❤️ для здоровой жизни
          </div>
</div>
      </footer>
    `;
  }
}

customElements.define('custom-footer', CustomFooter);