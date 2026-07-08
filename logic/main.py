"""
SalinTayo Logic Layer — Python FastAPI service.

Called by Firebase Cloud Functions after auth verification.
Handles all business logic; Cloud Functions handle API, auth, CORS.
"""

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import base64
import os
import tempfile
from functools import lru_cache
from typing import Any

app = FastAPI(title="SalinTayo Logic", version="1.0.0")

cors_origins_env = os.getenv("LOGIC_CORS_ORIGINS", "*")
allowed_origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health():
    """Health check for Cloud Run."""
    return {"status": "ok", "service": "salintayo-logic"}


class UserContext(BaseModel):
    """Decoded Firebase user from Cloud Functions."""
    uid: str
    email: str | None = None
    email_verified: bool = False


class GetMeResponse(BaseModel):
    """Response for getMe logic."""
    uid: str
    email: str | None = None
    email_verified: bool = False


class ValidateActionRequest(BaseModel):
    """Request for validateUserAction."""
    action: str


class ValidateActionResponse(BaseModel):
    """Response for validateUserAction."""
    success: bool
    uid: str
    action: str
    message: str


# ---- Logic Endpoints (called by Cloud Functions, not directly by clients) ----


@app.post("/logic/getMe", response_model=GetMeResponse)
def logic_get_me(user: UserContext) -> GetMeResponse:
    """
    Business logic for getMe.
    User context is passed by Cloud Functions after auth verification.
    """
    return GetMeResponse(
        uid=user.uid,
        email=user.email,
        email_verified=user.email_verified,
    )


class ValidateRequest(BaseModel):
    """Wrapper for validateUserAction from Cloud Functions."""
    user: UserContext
    body: ValidateActionRequest


@app.post("/logic/validateUserAction", response_model=ValidateActionResponse)
def logic_validate_user_action(req: ValidateRequest) -> ValidateActionResponse:
    """
    Business logic for validateUserAction.
    Server-side validation that cannot be bypassed by the client.
    """
    user = req.user
    body = req.body

    if not body.action or not body.action.strip():
        return ValidateActionResponse(
            success=False,
            uid=user.uid,
            action=body.action,
            message="Invalid action",
        )

    # Add your domain-specific validation logic here
    allowed_actions = {"submit_quiz", "submit_answer", "start_lesson"}
    if body.action.lower() not in allowed_actions:
        return ValidateActionResponse(
            success=False,
            uid=user.uid,
            action=body.action,
            message="Action not permitted",
        )

    return ValidateActionResponse(
        success=True,
        uid=user.uid,
        action=body.action,
        message="Action validated server-side",
    )


class WhisperTranscribeRequest(BaseModel):
    audio_base64: str
    mime_type: str = "audio/webm"
    whisper_model: str | None = None


class WhisperTranscribeResponse(BaseModel):
    text: str


@lru_cache(maxsize=2)
def get_whisper_model(model_name: str) -> Any:
    # Lazy import so the service starts even if the model download is slow.
    import whisper  # type: ignore

    return whisper.load_model(model_name)


@app.post("/logic/transcribeWhisper", response_model=WhisperTranscribeResponse)
def logic_transcribe_whisper(
    req: WhisperTranscribeRequest,
    x_logic_key: str | None = Header(default=None, alias="x-logic-key"),
) -> WhisperTranscribeResponse:
    # Optional shared-secret protection for cases where the logic service is exposed publicly
    # (e.g., via a free tunnel like ngrok). If LOGIC_API_KEY is NOT set, we allow the request.
    expected_key = os.getenv("LOGIC_API_KEY")
    if expected_key and x_logic_key != expected_key:
        raise HTTPException(status_code=401, detail="Unauthorized")

    if not req.audio_base64:
        return WhisperTranscribeResponse(text="")

    model_name = req.whisper_model or os.getenv("WHISPER_MODEL", "base")
    model = get_whisper_model(model_name)

    audio_bytes = base64.b64decode(req.audio_base64)
    # Whisper/ffmpeg handles different containers; we keep a consistent extension.
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        result = model.transcribe(tmp_path, language=None)
        text = (result.get("text") or "").strip()
        return WhisperTranscribeResponse(text=text)
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass
