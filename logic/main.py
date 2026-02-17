"""
SalinTayo Logic Layer — Python FastAPI service.

Called by Firebase Cloud Functions after auth verification.
Handles all business logic; Cloud Functions handle API, auth, CORS.
"""

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="SalinTayo Logic", version="1.0.0")


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
