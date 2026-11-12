import os

from fastapi import HTTPException
from google.auth.exceptions import GoogleAuthError
from google.auth.transport.requests import Request
from google.oauth2 import id_token
from dotenv import load_dotenv

load_dotenv()

def verify_google_credential(credential: str) -> dict:
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    if not client_id:
        raise HTTPException(
            status_code=503,
            detail="Google sign-in is not configured on the server.",
        )

    try:
        claims = id_token.verify_oauth2_token(
            credential,
            Request(),
            audience=client_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired Google credential.") from exc
    except GoogleAuthError as exc:
        raise HTTPException(
            status_code=503,
            detail="Google credential verification is temporarily unavailable.",
        ) from exc

    if claims.get("iss") not in {"accounts.google.com", "https://accounts.google.com"}:
        raise HTTPException(status_code=401, detail="Invalid Google credential issuer.")
    token_audience = claims.get("aud")
    if token_audience != client_id and not (
        isinstance(token_audience, list)
        and client_id in token_audience
        and claims.get("azp") == client_id
    ):
        raise HTTPException(status_code=401, detail="Google credential audience does not match.")
    if claims.get("azp") and claims["azp"] != client_id:
        raise HTTPException(status_code=401, detail="Google credential authorized party does not match.")
    if claims.get("email_verified") is not True:
        raise HTTPException(status_code=401, detail="A verified Google email is required.")

    subject = claims.get("sub")
    email = claims.get("email")
    if not isinstance(subject, str) or not subject or len(subject) > 255:
        raise HTTPException(status_code=401, detail="Google credential is missing an account ID.")
    if not isinstance(email, str) or not email.strip() or len(email.strip()) > 254 or "@" not in email:
        raise HTTPException(status_code=401, detail="Google credential is missing an email address.")

    name = claims.get("name")
    if not isinstance(name, str) or not name.strip():
        name = email.split("@", 1)[0]

    picture = claims.get("picture")
    if not isinstance(picture, str) or not picture.startswith("https://") or len(picture) > 512:
        picture = None

    return {
        "google_id": subject,
        "email": email.strip().lower(),
        "fullname": name.strip()[:50],
        "picture_url": picture,
    }
