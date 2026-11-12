import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Building2,
  Check,
  ChevronDown,
  CircleHelp,
  CreditCard,
  KeyRound,
  LoaderCircle,
  Moon,
  Palette,
  Save,
  ShieldCheck,
  Sun,
  Upload,
  UserRound,
} from "lucide-react";
import api from "../../../../api/axiosInstance";
import {
  applySettingsPreferences,
  getSettingsPreferences,
  saveSettingsPreferences,
} from "../settingsPreferences";
import "./SettingsPage.css";

const NOTIFICATION_OPTIONS = [
  ["payment_reminders", "Payment reminders", "Contribution and payment confirmations"],
  ["attendance_notifications", "Attendance updates", "Attendance changes and related fines"],
  ["emergency_request_updates", "Emergency request updates", "Request decisions and disbursements"],
  ["loan_repayment_reminders", "Loan repayment updates", "Repayment and outstanding-balance updates"],
  ["account_verification_updates", "Account verification", "Verification requests and decisions"],
  ["important_announcements", "Important announcements", "Sangha and service announcements"],
];

const errorMessage = (error) =>
  error?.response?.data?.detail || error?.message || "Something went wrong. Please try again.";

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
}

function Toggle({ checked, onChange, disabled = false, label }) {
  return (
    <button
      type="button"
      className={`settings-toggle${checked ? " is-on" : ""}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

function SettingRow({ title, description, checked, onChange, disabled = false }) {
  return (
    <div className={`settings-row${disabled ? " is-disabled" : ""}`}>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <Toggle
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        label={title}
      />
    </div>
  );
}

function SettingsSection({ id, icon: Icon, title, description, children }) {
  return (
    <section className="settings-card" id={id} aria-labelledby={`${id}-title`}>
      <div className="settings-card__heading">
        <span className="settings-card__icon"><Icon size={19} /></span>
        <div>
          <h2 id={`${id}-title`}>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      <div className="settings-card__body">{children}</div>
    </section>
  );
}

export default function SettingsPage({ onLogout, onProfileUpdated, user }) {
  const [storedUser, setStoredUser] = useState(() => user || readStoredUser());
  const role = String(storedUser.role || "member").toLowerCase();
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [accountStatus, setAccountStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [statusError, setStatusError] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [photo, setPhoto] = useState("");
  const [photoSaving, setPhotoSaving] = useState(false);
  const [password, setPassword] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [preferences, setPreferences] = useState(null);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [preferencesError, setPreferencesError] = useState("");
  const [sanghas, setSanghas] = useState([]);
  const [sanghasLoading, setSanghasLoading] = useState(true);
  const [sanghaDrafts, setSanghaDrafts] = useState({});
  const [sanghaError, setSanghaError] = useState("");
  const [sanghaSaving, setSanghaSaving] = useState(null);
  const [formMessage, setFormMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [appearance, setAppearance] = useState(getSettingsPreferences);
  const [appearanceMessage, setAppearanceMessage] = useState("");

  const displayName = useMemo(
    () => profile?.profile?.fullname || storedUser.fullname || "Your account",
    [profile, storedUser.fullname],
  );

  useEffect(() => {
    let active = true;
    const fetchProfile = async () => {
      try {
        const response = await api.get("/me/profile-wizard");
        if (!active) return;
        setProfile(response.data);
        setProfileName(response.data?.profile?.fullname || "");
      } catch (error) {
        if (active) setProfileError(errorMessage(error));
      } finally {
        if (active) setProfileLoading(false);
      }
    };
    const fetchStatus = async () => {
      try {
        const response = await api.get("/me/account-status");
        if (active) setAccountStatus(response.data);
      } catch (error) {
        if (active) setStatusError(errorMessage(error));
      } finally {
        if (active) setStatusLoading(false);
      }
    };
    const fetchPreferences = async () => {
      try {
        const response = await api.get("/me/settings/notification-preferences");
        if (active) setPreferences({ ...response.data, email_notifications: false });
      } catch (error) {
        if (active) setPreferencesError(errorMessage(error));
      }
    };
    const fetchSanghas = async () => {
      try {
        const response = await api.get("/me/settings/sanghas");
        if (!active) return;
        setSanghas(response.data || []);
        setSanghaDrafts(
          Object.fromEntries((response.data || []).map((sangha) => [sangha.id, {
            name: sangha.name || "",
            address: sangha.address || "",
            city: sangha.city || "",
            state: sangha.state || "",
          }])),
        );
      } catch (error) {
        if (active) setSanghaError(errorMessage(error));
      } finally {
        if (active) setSanghasLoading(false);
      }
    };
    const fetchPhoto = async () => {
      try {
        const response = await api.get("/me/photo", { responseType: "blob" });
        if (active) setPhoto(URL.createObjectURL(response.data));
      } catch (error) {
        if (active && error.response?.status !== 404) {
          setProfileError((current) => current || errorMessage(error));
        }
      }
    };

    fetchProfile();
    fetchStatus();
    fetchPreferences();
    fetchSanghas();
    fetchPhoto();
    applySettingsPreferences();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo);
  }, [photo]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setFormMessage("");
    setFormError("");
    setProfileSaving(true);
    try {
      const response = await api.patch("/me/settings/profile", { fullname: profileName });
      setProfile((current) => ({
        ...current,
        profile: { ...current?.profile, fullname: response.data.fullname },
      }));
      const nextUser = { ...storedUser, fullname: response.data.fullname };
      try {
        localStorage.setItem("user", JSON.stringify(nextUser));
      } catch (error) {
        console.error("Unable to persist the updated profile name locally:", error);
      }
      setStoredUser(nextUser);
      onProfileUpdated?.(nextUser);
      setFormMessage("Your name was updated.");
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setProfileSaving(false);
    }
  };

  const uploadPhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFormMessage("");
    setFormError("");
    setPhotoSaving(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.post("/me/photo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const response = await api.get("/me/photo", { responseType: "blob" });
      setPhoto(URL.createObjectURL(response.data));
      setFormMessage("Your profile photo was updated.");
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setPhotoSaving(false);
      event.target.value = "";
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setFormMessage("");
    setFormError("");
    setPasswordSaving(true);
    try {
      await api.post("/me/settings/change-password", password);
      setPassword({ current_password: "", new_password: "", confirm_password: "" });
      setFormMessage("Your password was changed.");
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setPasswordSaving(false);
    }
  };

  const saveNotifications = async () => {
    setPreferencesError("");
    setFormMessage("");
    setPreferencesSaving(true);
    try {
      const response = await api.put("/me/settings/notification-preferences", {
        ...preferences,
        email_notifications: false,
      });
      setPreferences(response.data);
      setFormMessage("Notification preferences were saved.");
    } catch (error) {
      setPreferencesError(errorMessage(error));
    } finally {
      setPreferencesSaving(false);
    }
  };

  const updateSanghaDraft = (id, field, value) => {
    setSanghaDrafts((current) => ({
      ...current,
      [id]: { ...current[id], [field]: value },
    }));
  };

  const saveSangha = async (sangha) => {
    setSanghaError("");
    setSanghaSaving(sangha.id);
    const draft = sanghaDrafts[sangha.id];
    const changed = Object.fromEntries(
      Object.entries(draft).filter(([field, value]) => value !== (sangha[field] || "")),
    );
    if (!Object.keys(changed).length) {
      setSanghaSaving(null);
      return;
    }
    try {
      const response = await api.patch(`/sanghas/${sangha.id}`, changed);
      setSanghas((current) => current.map((item) =>
        item.id === sangha.id ? { ...item, ...response.data } : item,
      ));
      setSanghaDrafts((current) => ({
        ...current,
        [sangha.id]: { ...current[sangha.id], ...response.data },
      }));
    } catch (error) {
      setSanghaError(errorMessage(error));
    } finally {
      setSanghaSaving(null);
    }
  };

  const saveAppearance = (event) => {
    event.preventDefault();
    try {
      const saved = saveSettingsPreferences(appearance);
      setAppearance(saved);
      setAppearanceMessage("Appearance preferences are saved on this device.");
    } catch (error) {
      setAppearanceMessage(errorMessage(error));
    }
  };

  const statusLabel = accountStatus
    ? accountStatus.isActive === false
      ? "Inactive"
      : accountStatus.isVerified
        ? "Verified"
        : accountStatus.verificationRequested
          ? "Verification pending"
          : "Not verified"
    : "Unavailable";

  return (
    <div className="settings-page">
      <header className="settings-page__header">
        <div>
          <span className="settings-page__eyebrow">ACCOUNT</span>
          <h1>Settings</h1>
          <p>Manage your profile, security, preferences, and Sangha information.</p>
        </div>
        <span className="settings-role">{role.replace(/^./, (letter) => letter.toUpperCase())} account</span>
      </header>

      {(formMessage || formError) && (
        <div className={`settings-feedback ${formError ? "is-error" : "is-success"}`} role="status">
          {formError ? <CircleHelp size={17} /> : <Check size={17} />}
          <span>{formError || formMessage}</span>
        </div>
      )}

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {[
            ["profile", "Profile", UserRound],
            ["security", "Security", KeyRound],
            ["notifications", "Notifications", Bell],
            ["appearance", "Appearance", Palette],
            ["financial", "Financial details", CreditCard],
            ["sangha", "Sangha", Building2],
            ["account", "Account", ShieldCheck],
          ].map(([id, label, Icon]) => (
            <a key={id} href={`#settings-${id}`}><Icon size={17} />{label}</a>
          ))}
        </nav>

        <div className="settings-content">
          <SettingsSection
            id="settings-profile"
            icon={UserRound}
            title="Profile"
            description="Update your display name and profile photo."
          >
            {profileError && <p className="settings-inline-error" role="alert">{profileError}</p>}
            <div className="settings-profile">
              <div className="settings-avatar" aria-label={`${displayName} profile photo`}>
                {photo || profile?.profile?.google_picture_url || storedUser.google_picture_url ? (
                  <img
                    src={photo || profile?.profile?.google_picture_url || storedUser.google_picture_url}
                    alt=""
                    referrerPolicy="no-referrer"
                  />
                ) : displayName.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <strong>{displayName}</strong>
                <p>JPG, PNG, or WEBP. Maximum file size: 5 MB.</p>
                <label className="settings-button settings-button--quiet">
                  {photoSaving ? <LoaderCircle className="settings-spin" size={16} /> : <Upload size={16} />}
                  {photoSaving ? "Uploading…" : "Change photo"}
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} disabled={photoSaving} />
                </label>
              </div>
            </div>
            <form className="settings-form settings-profile-form" onSubmit={saveProfile}>
              <label>
                Full name
                <input value={profileName} onChange={(event) => setProfileName(event.target.value)} maxLength={50} required disabled={profileLoading} />
              </label>
              <label>
                Email
                <input value={profile?.profile?.email || storedUser.email || ""} readOnly />
                <small>Email changes require a verification workflow that is not configured.</small>
              </label>
              <label>
                Phone
                <input value={profile?.profile?.phone || storedUser.phone || ""} readOnly />
                <small>Phone changes are unavailable until verification is supported.</small>
              </label>
              <div className="settings-form__actions">
                <button className="settings-button" type="submit" disabled={profileSaving || !profileName.trim()}>
                  {profileSaving ? <LoaderCircle className="settings-spin" size={16} /> : <Save size={16} />}
                  Save profile
                </button>
              </div>
            </form>
          </SettingsSection>

          <SettingsSection
            id="settings-security"
            icon={KeyRound}
            title="Security"
            description="Change your password to keep your account protected."
          >
            <form className="settings-form settings-password-form" onSubmit={changePassword}>
              <label>
                Current password
                <input type="password" autoComplete="current-password" value={password.current_password} onChange={(event) => setPassword({ ...password, current_password: event.target.value })} required />
              </label>
              <label>
                New password
                <input type="password" autoComplete="new-password" value={password.new_password} onChange={(event) => setPassword({ ...password, new_password: event.target.value })} minLength={8} required />
                <small>Use at least 8 characters, including a lowercase letter, a number, and a special character.</small>
              </label>
              <label>
                Confirm new password
                <input type="password" autoComplete="new-password" value={password.confirm_password} onChange={(event) => setPassword({ ...password, confirm_password: event.target.value })} minLength={8} required />
              </label>
              <div className="settings-form__actions">
                <button className="settings-button" type="submit" disabled={passwordSaving}>
                  {passwordSaving ? <LoaderCircle className="settings-spin" size={16} /> : <KeyRound size={16} />}
                  Change password
                </button>
              </div>
            </form>
            <div className="settings-note">
              <ShieldCheck size={18} />
              <p>Password changes take effect immediately. Signing out other devices is unavailable because this app does not track revocable sessions.</p>
            </div>
          </SettingsSection>

          <SettingsSection
            id="settings-notifications"
            icon={Bell}
            title="Notifications"
            description="Choose which in-app updates appear in your notifications."
          >
            {preferencesError && <p className="settings-inline-error" role="alert">{preferencesError}</p>}
            {preferences ? (
              <>
                <SettingRow
                  title="In-app notifications"
                  description="Show notifications in your account."
                  checked={preferences.in_app_notifications}
                  onChange={(value) => setPreferences({ ...preferences, in_app_notifications: value })}
                />
                {NOTIFICATION_OPTIONS.map(([key, title, description]) => (
                  <SettingRow
                    key={key}
                    title={title}
                    description={description}
                    checked={preferences[key]}
                    onChange={(value) => setPreferences({ ...preferences, [key]: value })}
                  />
                ))}
                <SettingRow
                  title="Email notifications"
                  description="Email delivery is not configured for this application."
                  checked={false}
                  onChange={() => {}}
                  disabled
                />
                <div className="settings-form__actions">
                  <button className="settings-button" type="button" onClick={saveNotifications} disabled={preferencesSaving}>
                    {preferencesSaving ? <LoaderCircle className="settings-spin" size={16} /> : <Save size={16} />}
                    Save notification preferences
                  </button>
                </div>
              </>
            ) : (
              <p className="settings-muted">{preferencesError ? "Notification preferences could not be loaded." : "Loading preferences…"}</p>
            )}
          </SettingsSection>

          <SettingsSection
            id="settings-appearance"
            icon={Palette}
            title="Appearance"
            description="Choose how the application is displayed on this device."
          >
            <form className="settings-form" onSubmit={saveAppearance}>
              <label>
                Color theme
                <span className="settings-select-wrap">
                  <select value={appearance.theme} onChange={(event) => setAppearance({ ...appearance, theme: event.target.value })}>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                  {appearance.theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
                </span>
              </label>
              <label>
                Display density
                <select value={appearance.density} onChange={(event) => setAppearance({ ...appearance, density: event.target.value })}>
                  <option value="comfortable">Comfortable</option>
                  <option value="compact">Compact</option>
                </select>
              </label>
              <label>
                Date format
                <select value={appearance.dateFormat} onChange={(event) => setAppearance({ ...appearance, dateFormat: event.target.value })}>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  <option value="DD MMM YYYY">DD MMM YYYY</option>
                </select>
              </label>
              {appearanceMessage && <p className="settings-inline-success" role="status">{appearanceMessage}</p>}
              <div className="settings-form__actions">
                <button className="settings-button" type="submit"><Save size={16} />Save appearance</button>
              </div>
            </form>
          </SettingsSection>

          <SettingsSection
            id="settings-financial"
            icon={CreditCard}
            title="Financial details"
            description="Review the saved bank information associated with your profile."
          >
            <div className="settings-data-grid">
              <div><span>Account holder</span><strong>{profileLoading ? "Loading…" : profile?.banking?.account_holder_name || "Not provided"}</strong></div>
              <div><span>Bank</span><strong>{profileLoading ? "Loading…" : profile?.banking?.bank_name || "Not provided"}</strong></div>
              <div><span>Account number</span><strong>{profileLoading ? "Loading…" : profile?.banking?.account_number_masked || "Not provided"}</strong></div>
              <div><span>IFSC</span><strong>{profileLoading ? "Loading…" : profile?.banking?.ifsc_code || "Not provided"}</strong></div>
              <div><span>Account type</span><strong>{profileLoading ? "Loading…" : profile?.banking?.account_type || "Not provided"}</strong></div>
              <div><span>Branch</span><strong>{profileLoading ? "Loading…" : profile?.banking?.branch_name || "Not provided"}</strong></div>
            </div>
            <p className="settings-note settings-note--plain">
              Bank details are read-only here and account numbers remain masked. No UPI or payment-method field is stored in the current account model.
            </p>
          </SettingsSection>

          <SettingsSection
            id="settings-sangha"
            icon={Building2}
            title="Sangha"
            description={role === "member" ? "Your assigned Sangha details." : "Review or update Sangha details you are permitted to manage."}
          >
            {sanghaError && <p className="settings-inline-error" role="alert">{sanghaError}</p>}
            {sanghas.length ? sanghas.map((sangha) => (
              <div className="settings-sangha" key={sangha.id}>
                <div className="settings-sangha__title">
                  <div><strong>{sangha.name}</strong><span>Code: {sangha.code || "—"}</span></div>
                  <span>{sangha.membersCount ?? 0} members</span>
                </div>
                {sangha.canEdit ? (
                  <>
                    <div className="settings-form settings-sangha-form">
                      {["name", "address", "city", "state"].map((field) => (
                        <label key={field}>
                          {field[0].toUpperCase() + field.slice(1)}
                          <input
                            value={sanghaDrafts[sangha.id]?.[field] || ""}
                            onChange={(event) => updateSanghaDraft(sangha.id, field, event.target.value)}
                            maxLength={field === "address" ? 255 : 100}
                          />
                        </label>
                      ))}
                    </div>
                    <button className="settings-button settings-button--quiet" type="button" onClick={() => saveSangha(sangha)} disabled={sanghaSaving === sangha.id}>
                      {sanghaSaving === sangha.id ? <LoaderCircle className="settings-spin" size={16} /> : <Save size={16} />}
                      Save Sangha details
                    </button>
                  </>
                ) : (
                  <div className="settings-data-grid">
                    <div><span>Address</span><strong>{sangha.address || "Not provided"}</strong></div>
                    <div><span>City</span><strong>{sangha.city || "Not provided"}</strong></div>
                    <div><span>State</span><strong>{sangha.state || "Not provided"}</strong></div>
                  </div>
                )}
              </div>
            )) : sanghasLoading ? (
              <p className="settings-muted">Loading Sangha details…</p>
            ) : (
              <p className="settings-muted">
                {sanghaError ? "Sangha information could not be loaded." : role === "member" ? "No Sangha is currently assigned to your account." : "No Sanghas are assigned to your account."}
              </p>
            )}
          </SettingsSection>

          <SettingsSection
            id="settings-account"
            icon={ShieldCheck}
            title="Account"
            description="Review current account status and available account controls."
          >
            {statusError && <p className="settings-inline-error" role="alert">{statusError}</p>}
            <div className="settings-data-grid">
              <div><span>Account status</span><strong className={accountStatus?.isActive === false ? "settings-status is-inactive" : "settings-status"}>{statusLoading ? "Loading…" : statusLabel}</strong></div>
              <div><span>Profile</span><strong>{statusLoading ? "Loading…" : accountStatus ? (accountStatus.profileComplete ? "Complete" : "Incomplete") : "Unavailable"}</strong></div>
              <div><span>Banking setup</span><strong>{statusLoading ? "Loading…" : accountStatus ? (accountStatus.bankingAdded ? "Complete" : "Incomplete") : "Unavailable"}</strong></div>
              <div><span>Member since</span><strong>Not tracked by the current account record</strong></div>
            </div>
            <div className="settings-note">
              <CircleHelp size={18} />
              <p>Account export, deactivation, and deletion require self-service workflows that are not available. Contact your Sangha administrator for account support.</p>
            </div>
            {onLogout && (
              <button className="settings-button settings-button--quiet" type="button" onClick={onLogout}>
                Sign out
              </button>
            )}
          </SettingsSection>

          <p className="settings-footnote">
            Preferences and contact information are handled according to the existing account and verification workflows.
            <ChevronDown size={14} aria-hidden="true" />
          </p>
        </div>
      </div>
    </div>
  );
}
