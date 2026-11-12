import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axiosInstance";
import GoogleSignInButton from "./GoogleSignInButton";
import "./AuthPage.css";
import decorImage from "../../assets/buddha-sunset.png";
/* ---------- tiny inline icons (no external icon lib needed) ---------- */
const EyeIcon = ({ open }) =>
  open ? (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.4 21.4 0 0 1 5.06-5.94M9.9 4.24A10.6 10.6 0 0 1 12 4c7 0 11 7 11 7a21.4 21.4 0 0 1-3.22 4.42M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </svg>
  );

/* ---------- reusable field — label above input ---------- */
function Field({
  label,
  type = "text",
  value,
  onChange,
  name,
  required = true,
  withToggle = false,
}) {
  const [show, setShow] = useState(false);
  const inputType = withToggle ? (show ? "text" : "password") : type;

  return (
    <div className="field">
      <label htmlFor={name} className="field__label">
        {label}
      </label>
      <div className="field__wrap">
        <input
          id={name}
          name={name}
          type={inputType}
          value={value}
          onChange={onChange}
          required={required}
          className={`field__input ${withToggle ? "field__input--has-toggle" : ""}`}
          autoComplete="off"
        />
        {withToggle && (
          <button
            type="button"
            className="field__toggle"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
          >
            <EyeIcon open={show} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- main component ---------- */
export default function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login"); // "login" | "signup"

  const [login, setLogin] = useState({ email: "", password: "" });
  const [signup, setSignup] = useState({
    username: "",
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const navigateToRoleDashboard = useCallback((user, onboardingRequired = false) => {
    const rolePath = {
      superadmin: "superadmin",
      admin: "admin",
      member: "member",
      subadmin: "member",
    }[user?.role];

    if (!rolePath) {
      throw new Error("Your account does not have a supported dashboard role.");
    }

    navigate(`/dashboard/${rolePath}`, {
      replace: true,
      state: onboardingRequired && rolePath === "member"
        ? { completeProfile: true }
        : undefined,
    });
  }, [navigate]);

  const handleGoogleCredential = useCallback(async (credential) => {
    setLoginError("");
    setSignupError("");
    setGoogleLoading(true);
    try {
      const response = await api.post("/auth/google", { credential });
      const { access_token: accessToken, user } = response.data;
      if (!accessToken || !user?.role) {
        throw new Error("The server returned an incomplete sign-in response.");
      }
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("user", JSON.stringify(user));
      navigateToRoleDashboard(user, user.onboarding_required);
    } catch (error) {
      const message =
        error.response?.data?.detail ||
        error.message ||
        "Google sign-in failed. Please try again.";
      if (mode === "signup") setSignupError(message);
      else setLoginError(message);
    } finally {
      setGoogleLoading(false);
    }
  }, [mode, navigateToRoleDashboard]);

  const handleLoginChange = (e) =>
    setLogin((s) => ({ ...s, [e.target.name]: e.target.value }));

  const handleSignupChange = (e) =>
    setSignup((s) => ({ ...s, [e.target.name]: e.target.value }));

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      const res = await api.post("/auth/login", {
        email: login.email,
        password: login.password,
      });
      const { access_token, user } = res.data;

      localStorage.setItem("access_token", access_token);
      localStorage.setItem("user", JSON.stringify(user));
      navigateToRoleDashboard(user);
    } catch (err) {
      setLoginError(
        err.response?.data?.detail || "Login failed. Please try again.",
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();

    if (signup.password !== signup.confirmPassword) {
      setSignupError("Passwords do not match");
      return;
    }
    if (!/^\d{10}$/.test(signup.phone)) {
      setSignupError("Please enter a valid 10-digit phone number");
      return;
    }

    setSignupError("");
    setSignupLoading(true);
    try {
      await api.post("/auth/register", {
        username: signup.username,
        fullname: signup.fullName,
        email: signup.email,
        phone: signup.phone,
        password: signup.password,
        confirm_password: signup.confirmPassword,
      });
      setMode("login");
    } catch (err) {
      setSignupError(
        err.response?.data?.detail || "Registration failed. Please try again.",
      );
    } finally {
      setSignupLoading(false);
    }
  };

  return (
    <div className="auth">
      {/* ---------------- left — welcome slogan + form card ---------------- */}
      <div className="auth__left">
        <div className="auth__header">
          <div className="auth__mark" aria-hidden="true">
            {/* replace with your logo */}R
          </div>
        </div>

        <h1 className="auth__slogan">
          {mode === "login"
            ? "Welcome back"
            : "Hello user, welcome to R S Sangha Management"}
        </h1>
        <p className="auth__subtext">
          {mode === "login"
            ? "Sign in to pick up right where you left off."
            : "Create your account to get started with us."}
        </p>

        <div className="auth__card">
          <div
            className="auth__tabs"
            role="tablist"
            aria-label="Choose login or signup"
          >
            <button
              role="tab"
              aria-selected={mode === "login"}
              className={`auth__tab ${mode === "login" ? "is-active" : ""}`}
              onClick={() => setMode("login")}
              type="button"
            >
              Log In
            </button>
            <button
              role="tab"
              aria-selected={mode === "signup"}
              className={`auth__tab ${mode === "signup" ? "is-active" : ""}`}
              onClick={() => setMode("signup")}
              type="button"
            >
              Sign Up
            </button>
          </div>

          {mode === "login" ? (
            <form className="auth__form" onSubmit={handleLoginSubmit}>
              <Field
                label="Email"
                name="email"
                value={login.email}
                onChange={handleLoginChange}
              />
              <Field
                label="Password"
                name="password"
                value={login.password}
                onChange={handleLoginChange}
                withToggle
              />

              <div className="auth__row">
                <label className="auth__checkbox">
                  <input type="checkbox" />
                  <span>Remember me</span>
                </label>
                <a href="#forgot" className="auth__link">
                  Forgot password?
                </a>
              </div>

              {loginError && <p className="auth__error">{loginError}</p>}

              <button
                type="submit"
                className="auth__submit"
                disabled={loginLoading || googleLoading}
              >
                {loginLoading ? "Logging in..." : "Log In"}
              </button>

              <div className="auth__divider">
                <span>or</span>
              </div>

              <GoogleSignInButton
                mode="login"
                onCredential={handleGoogleCredential}
                disabled={googleLoading}
              />
              {googleLoading && <p className="auth__google-status" role="status">Signing in with Google…</p>}

              <p className="auth__foot">
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  className="auth__link auth__link--strong"
                  onClick={() => setMode("signup")}
                >
                  Sign up
                </button>
              </p>
            </form>
          ) : (
            <form className="auth__form" onSubmit={handleSignupSubmit}>
              <div className="auth__grid">
                <Field
                  label="Username"
                  name="username"
                  value={signup.username}
                  onChange={handleSignupChange}
                />
                <Field
                  label="Full Name"
                  name="fullName"
                  value={signup.fullName}
                  onChange={handleSignupChange}
                />
              </div>

              <div className="auth__grid">
                <Field
                  label="Email"
                  type="email"
                  name="email"
                  value={signup.email}
                  onChange={handleSignupChange}
                />
                <Field
                  label="Phone Number"
                  type="tel"
                  name="phone"
                  value={signup.phone}
                  onChange={handleSignupChange}
                />
              </div>

              <div className="auth__grid">
                <Field
                  label="Password"
                  name="password"
                  value={signup.password}
                  onChange={handleSignupChange}
                  withToggle
                />
                <Field
                  label="Confirm Password"
                  name="confirmPassword"
                  value={signup.confirmPassword}
                  onChange={handleSignupChange}
                  withToggle
                />
              </div>

              {signupError && <p className="auth__error">{signupError}</p>}

              <button
                type="submit"
                className="auth__submit"
                disabled={signupLoading || googleLoading}
              >
                {signupLoading ? "Creating account..." : "Create Account"}
              </button>

              <div className="auth__divider">
                <span>or</span>
              </div>

              <GoogleSignInButton
                mode="signup"
                onCredential={handleGoogleCredential}
                disabled={googleLoading}
              />
              {googleLoading && <p className="auth__google-status" role="status">Creating your account…</p>}

              <p className="auth__foot">
                Already have an account?{" "}
                <button
                  type="button"
                  className="auth__link auth__link--strong"
                  onClick={() => setMode("login")}
                >
                  Log in
                </button>
              </p>
            </form>
          )}
        </div>
      </div>

      {/* ---------------- right — decorative panel with slogans ---------------- */}
      <div className="auth__decor">
        <img
          src={decorImage}
          className="auth__decor-bg"
          alt=""
          aria-hidden="true"
        />
        <div className="auth__decor-overlay" aria-hidden="true" />

        <div className="auth__decor-content">
          <p className="auth__decor-eyebrow">R S Sangha Management</p>
          <p className="auth__decor-quote">
            "Simplicity is the ultimate sophistication."
          </p>
          <ul className="auth__decor-list">
            <li>Organised, always in one place.</li>
            <li>Built for how you actually work.</li>
            <li>Trusted by people who value their time.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
