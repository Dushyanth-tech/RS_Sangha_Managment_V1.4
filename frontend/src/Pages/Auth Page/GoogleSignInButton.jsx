import { useEffect, useRef, useState } from "react";

const GOOGLE_IDENTITY_SCRIPT = "https://accounts.google.com/gsi/client";
let googleScriptPromise;

function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (!googleScriptPromise) {
    googleScriptPromise = new Promise((resolve, reject) => {
      let script = document.querySelector(`script[src="${GOOGLE_IDENTITY_SCRIPT}"]`);
      const handleLoad = () => {
        if (window.google?.accounts?.id) resolve(window.google);
        else reject(new Error("Google Sign-In could not be initialized."));
      };
      const handleError = () => {
        script.remove();
        googleScriptPromise = undefined;
        reject(new Error("Unable to load Google Sign-In. Check your connection."));
      };

      if (!script) {
        script = document.createElement("script");
        script.src = GOOGLE_IDENTITY_SCRIPT;
        script.async = true;
        script.defer = true;
      }

      script.addEventListener("load", handleLoad, { once: true });
      script.addEventListener("error", handleError, { once: true });
      if (!script.isConnected) document.head.appendChild(script);
    });
  }
  return googleScriptPromise;
}

export default function GoogleSignInButton({
  mode = "login",
  onCredential,
  disabled = false,
}) {
  const buttonRef = useRef(null);
  const [error, setError] = useState("");
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  
  useEffect(() => {
    if (!clientId) return undefined;

    let active = true;
    const buttonElement = buttonRef.current;

    loadGoogleIdentity()
      .then((google) => {
        if (!active || !buttonElement) return;
        setError("");
        buttonElement.replaceChildren();
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response.credential) onCredential(response.credential);
            else setError("Google did not return a sign-in credential.");
          },
          ux_mode: "popup",
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        google.accounts.id.renderButton(buttonElement, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: mode === "signup" ? "signup_with" : "signin_with",
          shape: "rect",
          logo_alignment: "left",
          width: Math.max(200, Math.min(400, Math.floor(buttonElement.clientWidth))),
        });
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      });

    return () => {
      active = false;
      if (buttonElement) buttonElement.replaceChildren();
    };
  }, [clientId, mode, onCredential]);

  return (
    <div className="auth__google-wrap">
      {clientId ? (
        <div
          ref={buttonRef}
          className={`auth__google-button${disabled ? " is-disabled" : ""}`}
          aria-busy={disabled}
          aria-label="Continue with Google"
        />
      ) : (
        <button type="button" className="auth__google" disabled title="Set VITE_GOOGLE_CLIENT_ID to enable Google sign-in">
          Continue with Google
        </button>
      )}
      {(error || (!clientId && "Google sign-in is not configured. Set VITE_GOOGLE_CLIENT_ID.")) && (
        <p className="auth__error auth__google-error" role="alert">
          {error || "Google sign-in is not configured. Set VITE_GOOGLE_CLIENT_ID."}
        </p>
      )}
    </div>
  );
}
