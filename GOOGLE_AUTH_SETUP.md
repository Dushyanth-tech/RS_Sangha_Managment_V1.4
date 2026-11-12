# Google sign-in setup

Google sign-in uses Google Identity Services to return a signed OpenID Connect ID token. The frontend sends that credential to `POST /auth/google`; FastAPI verifies its signature, issuer, expiration, and audience using Google's `google-auth` library. The Google token is never used as the application's API token.

This credential-verification flow does not use a Google client secret. The client ID is public and is configured in both the Vite app and backend. Do not put a client secret in a `VITE_*` variable.

## Google Cloud Console

1. Create or select a Google Cloud project and configure the OAuth consent screen.
2. Create an OAuth client ID with application type **Web application**.
3. Add the exact frontend origins under **Authorized JavaScript origins**, for example:
   - `http://localhost:5173`
   - Your production frontend origin, such as `https://sangha.example.com`
4. No redirect URI is required for the Google Identity Services popup button.

## Environment

Set the same web client ID in `frontend/.env.local`:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_GOOGLE_CLIENT_ID=747781592478-i91sm5ld15n2b2ko5a64ev61imhdd27u.apps.googleusercontent.com
```

Set it in the existing `backend/.env` (do not overwrite the database or JWT settings already there):

```env
GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
CORS_ORIGINS=http://localhost:5173
```

For production, set `CORS_ORIGINS` to the comma-separated, exact frontend origins. Keep `GOOGLE_CLIENT_ID` server-side as well as in the frontend build configuration; never put the Google client secret in the frontend.

## Run locally

From PowerShell:

```powershell
Set-Location .\backend
.\venv\Scripts\python.exe -m pip install -r requirements.txt
.\venv\Scripts\python.exe -m alembic upgrade head
.\venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

In another terminal:

```powershell
Set-Location .\frontend
npm run dev
```

Open `http://localhost:5173/auth`, use the Google button on either the login or registration tab, and select a Google account. A new account receives only the `member` role and is routed to the existing profile wizard when required. Complete the existing profile and banking information and verification steps as usual. Google-verified email is recorded separately; it does not mark the application's account as verified.

To confirm behavior, try a new verified Google email, then sign in again with it. The same database user should be reused. Try a verified Google email that already belongs to a password account; Google is linked only when the email matches, and the existing password, role, Sangha, and application verification state are preserved.

Google-created members initially have no phone number, no Sangha assignment, and no usable local password. Their phone and other profile information must be completed through the existing onboarding flow.
