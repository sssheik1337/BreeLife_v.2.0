from __future__ import annotations

from datetime import datetime, timezone

from services.storage_db import load_offer_document_kv, save_offer_document_kv


def _normalize_version_item(raw: object) -> dict[str, object] | None:
    if not isinstance(raw, dict):
        return None
    version = raw.get("version")
    if not isinstance(version, (int, float)) or isinstance(version, bool):
        return None
    normalized_version = int(version)
    if normalized_version <= 0:
        return None
    return {
        "version": normalized_version,
        "title": str(raw.get("title") or "").strip() or f"Редакция {normalized_version}",
        "summary": str(raw.get("summary") or "").strip(),
        "body_markdown": str(raw.get("body_markdown") or "").strip(),
        "published_at": str(raw.get("published_at") or "").strip(),
    }


def load_offer_document() -> dict[str, object]:
    payload = load_offer_document_kv()
    versions_raw = payload.get("versions") if isinstance(payload.get("versions"), list) else []
    versions = [item for item in (_normalize_version_item(entry) for entry in versions_raw) if item is not None]
    versions.sort(key=lambda item: int(item["version"]), reverse=True)

    current_version_raw = payload.get("current_version")
    current_version = int(current_version_raw) if isinstance(current_version_raw, (int, float)) and not isinstance(current_version_raw, bool) else None
    if current_version is None and versions:
        current_version = int(versions[0]["version"])

    current_offer = next((item for item in versions if int(item["version"]) == current_version), None)
    return {
        "current_version": current_version,
        "current_offer": current_offer,
        "versions": versions,
    }


def publish_offer_version(*, title: str, summary: str, body_markdown: str) -> dict[str, object]:
    document = load_offer_document()
    versions = list(document.get("versions") if isinstance(document.get("versions"), list) else [])
    next_version = 1 + max((int(item.get("version") or 0) for item in versions), default=0)
    version_payload = {
        "version": next_version,
        "title": str(title or "").strip() or f"Редакция {next_version}",
        "summary": str(summary or "").strip(),
        "body_markdown": str(body_markdown or "").strip(),
        "published_at": datetime.now(timezone.utc).isoformat(),
    }
    versions.insert(0, version_payload)
    save_offer_document_kv({
        "current_version": next_version,
        "versions": versions,
    })
    return version_payload


def build_offer_status(accepted_version: int | None, accepted_at: str | None) -> dict[str, object]:
    document = load_offer_document()
    current_offer = document.get("current_offer") if isinstance(document.get("current_offer"), dict) else None
    current_version = document.get("current_version")
    normalized_accepted_version = int(accepted_version) if isinstance(accepted_version, int) else None
    needs_acceptance = bool(
        current_offer
        and isinstance(current_version, int)
        and current_version > 0
        and normalized_accepted_version != current_version
    )
    return {
        "current_version": current_version,
        "current_offer": current_offer,
        "accepted_version": normalized_accepted_version,
        "accepted_at": accepted_at if isinstance(accepted_at, str) and accepted_at.strip() else None,
        "needs_acceptance": needs_acceptance,
        "has_offer": current_offer is not None,
    }
