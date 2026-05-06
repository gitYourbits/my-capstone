"""AI-powered spam / noise filter for incoming Issue posts.

This module is intentionally written to be *defensive*: any failure (missing
API key, network error, bad JSON, timeout, etc.) means the issue is treated as
LEGITIMATE so that legitimate citizens can never be blocked by an outage of an
external service. Spam blocking is best-effort.

The model is asked to classify with FLEXIBLE constraints: it should only flag
clear spam / nonsense / advertisement / abuse / off-topic posts and otherwise
let things through, even when the writing is broken or short.
"""

from __future__ import annotations

import json
import logging
import os
import re
import socket
import urllib.error
import urllib.request
from datetime import datetime
from typing import Any

from django.conf import settings
from django.utils import timezone

try:
    from decouple import config as _decouple_config
except Exception:
    _decouple_config = None  # type: ignore[assignment]


logger = logging.getLogger(__name__)


OPENAI_URL = "https://api.openai.com/v1/chat/completions"
DEFAULT_MODEL = "gpt-4o-mini"
HTTP_TIMEOUT_SECONDS = 12


SYSTEM_PROMPT = (
    "You are a content moderation assistant for VoiceUp, a civic grievance "
    "platform where Indian citizens raise local civic problems (roads, water, "
    "garbage, electricity, public services, safety, etc.). Your only job is to "
    "decide if a freshly submitted issue post is LEGITIMATE or SPAM/NOISE.\n\n"
    "Rules:\n"
    "1. Be FLEXIBLE. Lean towards legitimate when in doubt. Broken English, "
    "short text, vague details, casual tone, even small typos - all OK if the "
    "intent is to report a real local civic problem.\n"
    "2. Flag ONLY when the post is clearly one of: pure advertisement, "
    "promotional / money-making scheme, scam, random gibberish (eg 'asdf'), "
    "lorem-ipsum filler, hate speech / personal attacks, sexual content, "
    "harassment of an individual, off-topic content (gaming, dating, memes), "
    "test posts, or repeated junk.\n"
    "3. Use the user history hints. A brand-new account whose post is itself "
    "borderline can be flagged with lower confidence. A user with a history of "
    "being flagged should be judged a bit more strictly.\n"
    "4. Reply with ONLY a single JSON object, nothing else, in this exact "
    'shape: {"is_legitimate": true|false, "reason": "<short one-line reason>", '
    '"confidence": <float between 0 and 1>}'
)


def _read_env(name: str, default: str | None = None) -> str | None:
    """Get a value from settings, env, or python-decouple - in that order."""
    val = getattr(settings, name, None)
    if val:
        return val
    val = os.environ.get(name)
    if val:
        return val
    if _decouple_config is not None:
        try:
            v = _decouple_config(name, default=None)
            if v:
                return str(v)
        except Exception:
            pass
    return default


def _safe_truncate(text: str, limit: int) -> str:
    if not text:
        return ""
    text = str(text)
    if len(text) <= limit:
        return text
    return text[: limit - 1] + "\u2026"


def _user_signal(user) -> dict[str, Any]:
    """Build a small user-history snapshot to feed to the model."""
    try:
        from .models import Issue  # local import to avoid cycle on app load
    except Exception:
        Issue = None  # type: ignore[assignment]

    signal: dict[str, Any] = {
        "username": getattr(user, "username", None) or "(unknown)",
        "email": getattr(user, "email", None) or "",
        "is_staff": bool(getattr(user, "is_staff", False)),
    }
    date_joined = getattr(user, "date_joined", None)
    if isinstance(date_joined, datetime):
        signal["account_age_days"] = max(
            0, (timezone.now() - date_joined).days
        )
    if Issue is not None and getattr(user, "id", None):
        try:
            signal["total_posts"] = Issue.objects.filter(author_id=user.id).count()
            signal["previously_flagged_posts"] = Issue.objects.filter(
                author_id=user.id, spam_status="flagged"
            ).count()
        except Exception:
            pass
    return signal


def _build_user_payload(*, title, description, tags, category_name, user_signal):
    return (
        "Issue submitted:\n"
        f"- Title: {_safe_truncate(title, 300)}\n"
        f"- Description: {_safe_truncate(description, 4000)}\n"
        f"- Category: {category_name or '(none)'}\n"
        f"- Tags: {', '.join((tags or [])[:15]) or '(none)'}\n"
        "\nUploader info:\n"
        + json.dumps(user_signal, ensure_ascii=False, default=str)
        + "\n\nClassify this submission. Reply with the JSON object only."
    )


def _post_openai(api_key: str, payload: dict) -> tuple[bytes | None, str | None]:
    """Low-level POST to chat completions.

    Returns (body_bytes, error_string). On success error_string is None. On
    failure body_bytes may still hold the server's error response so the caller
    can decide to retry with a simpler payload.
    """
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        OPENAI_URL,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT_SECONDS) as resp:
            return resp.read(), None
    except urllib.error.HTTPError as exc:
        # Read the error response body so we can log the actual reason from OpenAI.
        err_body = b""
        try:
            err_body = exc.read()
        except Exception:
            pass
        snippet = err_body.decode("utf-8", errors="replace")[:600] if err_body else ""
        logger.warning(
            "Spam filter HTTP %s from OpenAI: %s | body=%s",
            exc.code, exc.reason, snippet,
        )
        return err_body or None, f"http_{exc.code}"
    except (urllib.error.URLError, socket.timeout, ConnectionError) as exc:
        logger.warning("Spam filter network failure: %s", exc)
        return None, "network"
    except Exception as exc:  # pragma: no cover - safety net
        logger.exception("Spam filter unexpected error: %s", exc)
        return None, "unexpected"


def _call_openai(api_key: str, model: str, system: str, user: str) -> str | None:
    """Make a chat completion call. Returns assistant text or None on failure.

    Retries once *without* `response_format` if the first call fails with a
    400 - some accounts / older variants reject the JSON-mode parameter.
    """
    base_payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0,
    }

    # First try with strict json_object response_format.
    payload = dict(base_payload)
    payload["response_format"] = {"type": "json_object"}
    data, err = _post_openai(api_key, payload)

    # Retry without response_format on a 400 (common cause of HTTP 400 here).
    if err == "http_400":
        logger.info("Spam filter retrying without response_format after 400")
        data, err = _post_openai(api_key, base_payload)

    if err or not data:
        return None

    try:
        parsed = json.loads(data.decode("utf-8"))
    except Exception:
        logger.warning("Spam filter could not decode OpenAI response")
        return None

    try:
        return parsed["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        logger.warning("Spam filter OpenAI response had unexpected shape")
        return None


_JSON_RE = re.compile(r"\{[\s\S]*\}", re.MULTILINE)


def _coerce_decision(raw: str | None) -> dict[str, Any]:
    """Parse the model's JSON response defensively.

    On any failure we default to legitimate so we never block real users.
    """
    if not raw:
        return {"is_legitimate": True, "reason": "", "confidence": 0.0}

    text = raw.strip()
    parsed: dict[str, Any] | None = None
    try:
        parsed = json.loads(text)
    except Exception:
        match = _JSON_RE.search(text)
        if match:
            try:
                parsed = json.loads(match.group(0))
            except Exception:
                parsed = None
    if not isinstance(parsed, dict):
        return {"is_legitimate": True, "reason": "", "confidence": 0.0}

    is_legit_raw = parsed.get("is_legitimate")
    if isinstance(is_legit_raw, bool):
        is_legit = is_legit_raw
    elif isinstance(is_legit_raw, str):
        is_legit = is_legit_raw.strip().lower() not in {
            "false", "0", "no", "spam", "flagged",
        }
    else:
        is_legit = True

    reason = parsed.get("reason") or ""
    if not isinstance(reason, str):
        reason = str(reason)
    reason = reason.strip()[:500]

    try:
        confidence = float(parsed.get("confidence", 0.0))
    except (TypeError, ValueError):
        confidence = 0.0
    if confidence < 0:
        confidence = 0.0
    if confidence > 1:
        confidence = 1.0

    return {
        "is_legitimate": is_legit,
        "reason": reason,
        "confidence": confidence,
    }


def assess_issue_for_spam(
    *,
    title: str,
    description: str,
    tags: list[str] | None,
    category_name: str | None,
    user,
) -> dict[str, Any]:
    """Run the spam check.

    Returns a dict with keys:
        is_legitimate (bool)
        reason (str)
        confidence (float between 0 and 1)
        ran (bool)             - whether the AI was actually called
        skip_reason (str)      - why the call was skipped, if applicable
    """
    out_skipped = lambda reason: {
        "is_legitimate": True,
        "reason": "",
        "confidence": 0.0,
        "ran": False,
        "skip_reason": reason,
    }

    if getattr(user, "is_staff", False):
        return out_skipped("staff_user")

    api_key = _read_env("OPENAI_API_KEY")
    if not api_key:
        return out_skipped("no_api_key")

    model = _read_env("OPENAI_SPAM_MODEL", DEFAULT_MODEL) or DEFAULT_MODEL

    user_payload = _build_user_payload(
        title=title or "",
        description=description or "",
        tags=tags or [],
        category_name=category_name,
        user_signal=_user_signal(user),
    )

    raw_reply = _call_openai(api_key, model, SYSTEM_PROMPT, user_payload)
    decision = _coerce_decision(raw_reply)
    decision["ran"] = bool(raw_reply)
    decision["skip_reason"] = "" if raw_reply else "ai_call_failed"
    return decision
