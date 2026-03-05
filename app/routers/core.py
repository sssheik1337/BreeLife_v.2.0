import re
from pathlib import Path
from urllib.parse import urlparse
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse

from config import (
    APP_ENV,
    APP_HOST,
    APP_NAME,
    APP_PORT,
    DEBUG,
    IS_PROD,
    PUBLIC_APP_URL,
)
from app.context import TELEGRAM_SESSION_COOKIE, load_admin_config, load_plans_config
from services.storage_db import get_session_user, read_payload

router = APIRouter()

SPA_NOTIFICATION_INLINE_SCRIPT = """
<script>
(function () {
  function getCssPxVariable(name, fallback) {
    var value = window.getComputedStyle(document.documentElement).getPropertyValue(name);
    var parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function computeTopOffset() {
    var safeTop = getCssPxVariable('--tg-safe-top', 0);
    var uiTop = getCssPxVariable('--tg-ui-top', 0);
    var rawTop = Math.round(72 + safeTop + uiTop + 12);
    var maxTop = Math.max(12, window.innerHeight - 96);
    return Math.min(Math.max(rawTop, 12), maxTop);
  }

  function applyContainerStyles(container) {
    container.style.setProperty('position', 'fixed', 'important');
    container.style.setProperty('top', String(computeTopOffset()) + 'px', 'important');
    container.style.setProperty('right', '12px', 'important');
    container.style.setProperty('left', 'auto', 'important');
    container.style.setProperty('bottom', 'auto', 'important');
    container.style.setProperty('z-index', '2147483647', 'important');
    container.style.setProperty('width', 'min(320px, calc(100vw - 24px))', 'important');
    container.style.setProperty('display', 'flex', 'important');
    container.style.setProperty('flex-direction', 'column', 'important');
    container.style.setProperty('align-items', 'flex-end', 'important');
    container.style.setProperty('pointer-events', 'none', 'important');
    container.style.setProperty('visibility', 'visible', 'important');
    container.style.setProperty('opacity', '1', 'important');
    container.style.setProperty('isolation', 'isolate', 'important');
  }

  if (typeof window.showNotification !== 'function') {
    window.showNotification = function (message, type) {
      var text = String(message || '').trim();
      if (!text) return;
      var tone = (type === 'error' || type === 'warning') ? type : 'success';
      var bg = tone === 'success' ? '#10b981' : (tone === 'warning' ? '#f59e0b' : '#ef4444');
      var container = document.getElementById('notification-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        (document.documentElement || document.body).appendChild(container);
      }
      applyContainerStyles(container);
      var toast = document.createElement('div');
      toast.textContent = text;
      toast.style.background = bg;
      toast.style.color = '#fff';
      toast.style.padding = '14px 16px';
      toast.style.borderRadius = '14px';
      toast.style.marginBottom = '10px';
      toast.style.maxWidth = '100%';
      toast.style.wordBreak = 'break-word';
      toast.style.boxShadow = '0 10px 26px rgba(15,23,42,.28)';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-8px)';
      toast.style.transition = 'transform 180ms ease,opacity 180ms ease';
      toast.style.display = 'block';
      toast.style.visibility = 'visible';
      container.appendChild(toast);
      requestAnimationFrame(function () {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
      });
      setTimeout(function () {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-6px)';
        setTimeout(function () { toast.remove(); }, 180);
      }, 3000);
      window.__lastSpaNotification = { message: text, tone: tone, at: Date.now() };
    };
  }

  if (window.__notificationLogBridgeInstalled !== true) {
    var originalConsoleLog = console.log.bind(console);
    console.log = function () {
      try {
        var first = (typeof arguments[0] === 'string') ? String(arguments[0]).trim() : '';
        if (first === 'Приём пищи сохранён.' || first === 'Вода сохранена.' || first === 'Добавьте хотя бы один продукт.') {
          window.showNotification(first, first === 'Добавьте хотя бы один продукт.' ? 'error' : 'success');
        }
      } catch (e) {}
      return originalConsoleLog.apply(console, arguments);
    };
    window.__notificationLogBridgeInstalled = true;
  }

  window.addEventListener('resize', function () {
    var container = document.getElementById('notification-container');
    if (container) {
      applyContainerStyles(container);
    }
  }, { passive: true });
})();
</script>
""".strip()


def _cache_bypass_headers() -> dict[str, str]:
    return {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
    }


def _normalize_contact_text(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    cleaned = value.strip()
    return cleaned if cleaned else None


def _normalize_channel_url(value: object) -> str | None:
    raw = _normalize_contact_text(value)
    if not raw:
        return None
    candidate = raw if "://" in raw else f"https://{raw}"
    parsed = urlparse(candidate)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    return candidate


def _normalize_telegram_username(value: object) -> str | None:
    raw = _normalize_contact_text(value)
    if not raw:
        return None
    candidate = raw
    lowered = candidate.lower()
    if lowered.startswith("http://") or lowered.startswith("https://"):
        parsed = urlparse(candidate)
        host = (parsed.netloc or "").lower()
        if host.startswith("www."):
            host = host[4:]
        if host not in {"t.me", "telegram.me"}:
            return None
        candidate = parsed.path
    elif lowered.startswith("t.me/"):
        candidate = candidate[5:]
    elif lowered.startswith("telegram.me/"):
        candidate = candidate[12:]

    candidate = candidate.strip().lstrip("@")
    if "/" in candidate:
        candidate = candidate.split("/", maxsplit=1)[0]
    if "?" in candidate:
        candidate = candidate.split("?", maxsplit=1)[0]
    if not re.fullmatch(r"[A-Za-z0-9_]+", candidate):
        return None
    return candidate


def _load_support_contacts_payload(config: dict[str, object] | None) -> dict[str, str | None]:
    contacts = config.get("support_contacts") if isinstance(config, dict) else {}
    if not isinstance(contacts, dict):
        contacts = {}
    normalized_username = _normalize_telegram_username(contacts.get("username"))
    username = f"@{normalized_username}" if normalized_username else None
    username_url = f"https://t.me/{normalized_username}" if normalized_username else None
    return {
        "phone": _normalize_contact_text(contacts.get("phone")),
        "email": _normalize_contact_text(contacts.get("email")),
        "username": username,
        "username_url": username_url,
        "channel_url": _normalize_channel_url(contacts.get("channel_url")),
    }


def _render_spa_shell_index(spa_index_path: Path) -> HTMLResponse:
    html = spa_index_path.read_text(encoding="utf-8")
    if "window.showNotification" not in html:
        if "</head>" in html:
            html = html.replace("</head>", f"{SPA_NOTIFICATION_INLINE_SCRIPT}\n</head>", 1)
        else:
            html = f"{SPA_NOTIFICATION_INLINE_SCRIPT}\n{html}"
    return HTMLResponse(content=html, status_code=200, headers=_cache_bypass_headers())


@router.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return RedirectResponse(url="/app/", status_code=307)


@router.get("/index", response_class=HTMLResponse)
async def index_alias(request: Request):
    return await index(request)


@router.get("/app", response_class=HTMLResponse)
async def spa_shell(request: Request):
    spa_index_path = Path("spa/dist/index.html")
    if spa_index_path.exists():
        return _render_spa_shell_index(spa_index_path)

    # Fallback: если SPA ещё не собрана, возвращаем понятный экран без поломки legacy-страниц.
    return HTMLResponse(
        "<h1>SPA не собрана</h1><p>Соберите фронтенд командой <code>cd spa && npm install && npm run build</code>.</p>",
        status_code=503,
    )


@router.get("/app/{spa_path:path}", response_class=HTMLResponse)
async def spa_shell_with_path(spa_path: str, request: Request):
    return await spa_shell(request)


@router.get("/healthz")
async def healthz():
    return {"status": "ok"}


@router.get("/api/me/status")
async def api_me_status(request: Request):
    token = request.cookies.get(TELEGRAM_SESSION_COOKIE)
    session = get_session_user(token) if token else None
    profile_completed = False
    if session:
        profile = read_payload("profiles", int(session.get("telegram_user_id"))) or {}
        profile_completed = bool(profile.get("is_completed") or profile.get("completed") or profile.get("profile_completed"))
    return {
        "authorized": bool(session),
        "telegram_user_id": session.get("telegram_user_id") if session else None,
        "profile_completed": profile_completed,
        "first_name": session.get("first_name") if session else None,
        "last_name": session.get("last_name") if session else None,
        "username": session.get("username") if session else None,
        "photo_url": session.get("photo_url") if session else None,
    }


@router.get("/api/session")
async def api_session(request: Request):
    token = request.cookies.get(TELEGRAM_SESSION_COOKIE)
    session = get_session_user(token) if token else None
    return {
        "authorized": bool(session),
        "first_name": session.get("first_name") if session else None,
        "last_name": session.get("last_name") if session else None,
        "username": session.get("username") if session else None,
        "photo_url": session.get("photo_url") if session else None,
    }


@router.get("/api/app/public-url")
async def get_public_url():
    return {"url": PUBLIC_APP_URL}


@router.get("/api/app/config")
async def get_app_config():
    return {
        "app_env": APP_ENV,
        "app_host": APP_HOST,
        "app_port": APP_PORT,
    }


@router.get("/api/admin/config")
async def admin_config():
    if IS_PROD and not DEBUG:
        raise HTTPException(status_code=403, detail="Доступ запрещён.")
    return load_admin_config()


@router.get("/api/support/contacts")
async def support_contacts(request: Request):
    token = request.cookies.get(TELEGRAM_SESSION_COOKIE)
    session = get_session_user(token) if token else None
    if not session:
        raise HTTPException(status_code=401, detail="Требуется авторизация.")
    config = load_admin_config()
    if not isinstance(config, dict):
        config = {}
    return _load_support_contacts_payload(config)


@router.get("/api/plans")
async def plans_public():
    def parse_price(value: object) -> int:
        if isinstance(value, bool):
            return 0
        if isinstance(value, (int, float)):
            return max(0, int(value))
        digits = "".join(ch for ch in str(value) if ch.isdigit())
        return int(digits) if digits else 0

    plans = load_plans_config()
    normalized: list[dict[str, object]] = []
    for plan in plans if isinstance(plans, list) else []:
        if not isinstance(plan, dict):
            continue
        plan_id = str(plan.get("id", "")).strip().lower()
        title = str(plan.get("title", "")).strip()
        if not plan_id or not title or plan_id == "trial":
            continue
        normalized.append(
            {
                "id": plan_id,
                "title": title,
                "duration_days": int(plan.get("duration_days", 0) or 0),
                "price_current": parse_price(plan.get("price_current")),
                "price_old": parse_price(plan.get("price_old")),
                "price_old_enabled": bool(plan.get("price_old_enabled", False)),
            }
        )
    return normalized
