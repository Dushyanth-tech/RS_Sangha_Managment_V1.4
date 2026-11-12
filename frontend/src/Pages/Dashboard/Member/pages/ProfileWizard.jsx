import React, { useEffect, useRef, useState } from "react";
import {
  getProfileWizard,
  uploadProfilePhoto,
  saveProfileWizard,
  getErrorMessage,
  getMyPhoto,
  getMyPanImage,
  getMyIdProofImage,
} from "../api/profileApi";
import DocumentScan from "./DocumentScan";
import "./ProfileWizard.css";

const STEPS = [
  { key: "profile", label: "Profile Details" },
  { key: "banking", label: "Banking Details" },
];

const ACCOUNT_TYPES = [
  { value: "savings", label: "Savings" },
  { value: "current", label: "Current" },
];

export default function ProfileWizard({ onBack }) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [existing, setExisting] = useState({
    profile: null,
    banking: null,
  });

  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const fileInputRef = useRef(null);
  const [panPreviewUrl, setPanPreviewUrl] = useState(null);
  const [idProofPreviewUrl, setIdProofPreviewUrl] = useState(null);

  const [profileForm, setProfileForm] = useState({
    fullname: "",
    date_of_birth: "",
    phone: "",
    address: "",
    id_proof_number: "",
  });

  const [bankForm, setBankForm] = useState({
    pan_number: "",
    account_number: "",
    account_holder_name: "",
    bank_name: "",
    account_type: "savings",
    ifsc_code: "",
    branch_name: "",
  });

  const [email, setEmail] = useState("");

  // Actual document files
  const [panFile, setPanFile] = useState(null);
  const [idProofFile, setIdProofFile] = useState(null);

  // Aadhaar or Passport
  const [idProofType, setIdProofType] = useState("");

  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [savingStep1, setSavingStep1] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // --------------------------------------------------
  // LOAD PROFILE
  // --------------------------------------------------

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        setLoadError("");

        const res = await getProfileWizard();
        const { profile, banking } = res.data;

        setExisting({ profile, banking });
        setEmail(profile?.email || "");

        setProfileForm({
          fullname: profile?.fullname || "",
          date_of_birth: profile?.date_of_birth || "",
          phone: profile?.phone || "",
          address: profile?.address || "",
          id_proof_number: "",
        });

        if (banking) {
          setBankForm((previous) => ({
            ...previous,
            account_holder_name: banking.account_holder_name || "",
            bank_name: banking.bank_name || "",
            account_type: banking.account_type || "savings",
            ifsc_code: banking.ifsc_code || "",
            branch_name: banking.branch_name || "",
          }));
        }

        // Fetch existing images automatically — all three follow the same
        // authenticated-blob pattern, since none of them can use a plain <img src>.
        if (profile?.has_profile_photo) {
          try {
            const photoRes = await getMyPhoto();
            setPhotoUrl(URL.createObjectURL(photoRes.data));
          } catch {
            // no photo yet, or fetch failed — leave initials showing
          }
        } else if (profile?.google_picture_url) {
          setPhotoUrl(profile.google_picture_url);
        }

        if (profile?.has_pan_image) {
  try {
    const panRes = await getMyPanImage();
    const url = URL.createObjectURL(panRes.data);

    setPanPreviewUrl(url);
  } catch (error) {
    console.error("PAN FULL ERROR:", error);
    console.error("PAN MESSAGE:", error.message);
  }
}

if (profile?.has_id_proof_image) {
  try {
    const idRes = await getMyIdProofImage();

    const url = URL.createObjectURL(idRes.data);

    setIdProofPreviewUrl(url);
  } catch (error) {
    console.error("ID FULL ERROR:", error);
    console.error("ID MESSAGE:", error.message);
  }
}
      } catch (error) {
        setLoadError(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };

    loadProfile();

    // Clean up object URLs when the component unmounts, to avoid leaking memory
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      if (panPreviewUrl) URL.revokeObjectURL(panPreviewUrl);
      if (idProofPreviewUrl) URL.revokeObjectURL(idProofPreviewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------------------------------------------------
  // FORM HELPERS
  // --------------------------------------------------

  const updateProfileField = (key, value) => {
    setProfileForm((previous) => ({
      ...previous,
      [key]: value,
    }));

    setFieldErrors((previous) => ({
      ...previous,
      [key]: undefined,
    }));
  };

  const updateBankField = (key, value) => {
    setBankForm((previous) => ({
      ...previous,
      [key]: value,
    }));

    setFieldErrors((previous) => ({
      ...previous,
      [key]: undefined,
    }));
  };

  // --------------------------------------------------
  // PROFILE PHOTO
  // --------------------------------------------------

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setPhotoError("Please choose a JPEG, PNG, or WEBP image.");
      return;
    }

    try {
      setPhotoUploading(true);
      setPhotoError("");

      await uploadProfilePhoto(file);
      const photoRes = await getMyPhoto();
      setPhotoUrl(URL.createObjectURL(photoRes.data));
    } catch (error) {
      setPhotoError(getErrorMessage(error));
    } finally {
      setPhotoUploading(false);
      event.target.value = "";
    }
  };

  // --------------------------------------------------
  // OCR HANDLERS
  // --------------------------------------------------

  const handlePanExtracted = (pan) => {
    if (pan) {
      updateBankField("pan_number", pan);
    }
  };

  const handleIdExtracted = ({ idNumber, idProofType: detectedType, dob }) => {
    if (idNumber) {
      updateProfileField("id_proof_number", idNumber);
    }

    if (detectedType) {
      setIdProofType(detectedType);
    }

    if (dob) {
      updateProfileField("date_of_birth", dob);
    }
  };

  // --------------------------------------------------
  // DOCUMENT FILE HANDLERS
  // --------------------------------------------------

  const handlePanFileSelected = (file) => {
    setPanFile(file);
  };

  const handleIdFileSelected = (file) => {
    setIdProofFile(file);
  };

  // --------------------------------------------------
  // VALIDATION
  // --------------------------------------------------

  const validateProfile = () => {
    const errors = {};

    if (!profileForm.fullname.trim()) {
      errors.fullname = "Name is required.";
    }

    if (!profileForm.date_of_birth) {
      errors.date_of_birth = "Date of birth is required.";
    }

    if (!profileForm.phone.trim()) {
      errors.phone = "Phone number is required.";
    }

    if (!profileForm.address.trim()) {
      errors.address = "Address is required.";
    }

    const hasExistingId = existing.profile?.id_proof_number_masked;

    if (!profileForm.id_proof_number.trim() && !hasExistingId) {
      errors.id_proof_number = "ID proof number is required.";
    }

    if (profileForm.id_proof_number.trim() && !idProofType) {
      errors.id_proof_type = "Please select Aadhaar or Passport.";
    }

    return errors;
  };

  // --------------------------------------------------
  // GO TO BANKING STEP
  // --------------------------------------------------

  const goNext = () => {
    setFormError("");

    const errors = validateProfile();

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError("Please fix the highlighted fields.");
      return;
    }

    setFieldErrors({});
    setStep(1);
  };

  const goBack = () => {
    setFormError("");
    setStep(0);
  };

  // --------------------------------------------------
  // BUILD FORMDATA
  // --------------------------------------------------

  const buildFormData = () => {
    const formData = new FormData();

    // Profile fields
    if (profileForm.fullname.trim()) {
      formData.append("fullname", profileForm.fullname.trim());
    }

    if (profileForm.date_of_birth) {
      formData.append("date_of_birth", profileForm.date_of_birth);
    }

    if (profileForm.phone.trim()) {
      formData.append("phone", profileForm.phone.trim());
    }

    if (profileForm.address.trim()) {
      formData.append("address", profileForm.address.trim());
    }

    // ID proof details
    if (profileForm.id_proof_number.trim()) {
      formData.append("id_proof_number", profileForm.id_proof_number.trim());
    }

    if (idProofType) {
      formData.append("id_proof_type", idProofType);
    }

    if (idProofFile) {
      formData.append("id_proof_image", idProofFile);
    }

    // PAN details
    if (bankForm.pan_number.trim()) {
      formData.append("pan_number", bankForm.pan_number.trim().toUpperCase());
    }

    if (panFile) {
      formData.append("pan_image", panFile);
    }

    // Banking details
    if (bankForm.account_number.trim()) {
      formData.append("account_number", bankForm.account_number.trim());
    }

    if (bankForm.account_holder_name.trim()) {
      formData.append(
        "account_holder_name",
        bankForm.account_holder_name.trim(),
      );
    }

    if (bankForm.bank_name.trim()) {
      formData.append("bank_name", bankForm.bank_name.trim());
    }

    if (bankForm.account_type) {
      formData.append("account_type", bankForm.account_type);
    }

    if (bankForm.ifsc_code.trim()) {
      formData.append("ifsc_code", bankForm.ifsc_code.trim().toUpperCase());
    }

    if (bankForm.branch_name.trim()) {
      formData.append("branch_name", bankForm.branch_name.trim());
    }

    return formData;
  };

  // --------------------------------------------------
  // SAVE EVERYTHING
  // --------------------------------------------------

  const handleSave = async () => {
    try {
      setSaving(true);
      setFormError("");
      setFieldErrors({});

      const formData = buildFormData();

      // Sends multipart/form-data with images and fields
      await saveProfileWizard(formData);

      setSuccess(true);
      setEditMode(false);

      setTimeout(() => {
        onBack();
      }, 1200);
    } catch (error) {
      if (error?.response?.status === 422) {
        const detail = error.response.data?.detail;

        if (Array.isArray(detail)) {
          const errors = {};

          detail.forEach((item) => {
            const key = item.loc?.[item.loc.length - 1];

            if (key) {
              errors[key] = item.msg;
            }
          });

          setFieldErrors(errors);
          setFormError("Please fix the highlighted fields.");
        } else {
          setFormError(detail || "Some information is invalid.");
        }
      } else {
        setFormError(getErrorMessage(error));
      }
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------
  // INITIALS
  // --------------------------------------------------

  const initials = (profileForm.fullname || "M")
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (loading) {
    return (
      <div className="pw-page">
        <div className="pw-loading">Loading your profile...</div>
      </div>
    );
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="pw-page">
      <div className="pw-header-row">
        <h1 className="pw-title">Complete Your Profile</h1>

        <button
          type="button"
          className={`pw-edit-toggle ${
            editMode ? "pw-edit-toggle--active" : ""
          }`}
          onClick={() => setEditMode((value) => !value)}
        >
          ✎ {editMode ? "Editing" : "Edit"}
        </button>
      </div>

      <div className="pw-progress">
        {STEPS.map((item, index) => (
          <React.Fragment key={item.key}>
            <div className="pw-progress__step">
              <div
                className={`pw-progress__circle ${
                  index < step ? "pw-progress__circle--done" : ""
                } ${index === step ? "pw-progress__circle--active" : ""}`}
              >
                {index < step ? "✓" : index + 1}
              </div>

              <div
                className={`pw-progress__label ${
                  index === step ? "pw-progress__label--active" : ""
                }`}
              >
                {item.label}
              </div>
            </div>

            {index < STEPS.length - 1 && (
              <div
                className={`pw-progress__line ${
                  index < step ? "pw-progress__line--done" : ""
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {loadError && <div className="pw-error-banner">{loadError}</div>}

      {formError && <div className="pw-error-banner">{formError}</div>}

      {success && (
        <div className="pw-success-banner">
          Saved successfully — taking you back...
        </div>
      )}

      <div className="pw-card">
        {step === 0 && (
          <>
            <div className="pw-photo-row">
              <button
                className="pw-photo"
                onClick={handlePhotoClick}
                disabled={photoUploading || !editMode}
                type="button"
              >
                {photoUrl ? (
                  <img src={photoUrl} alt="Profile" />
                ) : (
                  <span className="pw-photo__initials">{initials}</span>
                )}

                <span className="pw-photo__edit">
                  {photoUploading ? "..." : "✎"}
                </span>
              </button>

              <input
                type="file"
                ref={fileInputRef}
                accept="image/jpeg,image/png,image/webp"
                style={{ display: "none" }}
                onChange={handlePhotoChange}
              />

              <div>
                <div className="pw-photo__label">Profile Photo</div>

                <div className="pw-photo__hint">
                  Click the circle to upload a profile photo.
                </div>

                {photoError && (
                  <div className="pw-field-error">{photoError}</div>
                )}
              </div>
            </div>

            {editMode && (
              <DocumentScan
                onPanExtracted={handlePanExtracted}
                onPanFileSelected={handlePanFileSelected}
                onIdExtracted={handleIdExtracted}
                onIdFileSelected={handleIdFileSelected}
              />
            )}

            <div className="pw-grid">
              <div className="pw-field">
                <label>Full Name</label>

                <input
                  className="pw-input"
                  value={profileForm.fullname}
                  onChange={(event) =>
                    updateProfileField("fullname", event.target.value)
                  }
                  disabled={!editMode}
                />

                {fieldErrors.fullname && (
                  <div className="pw-field-error">{fieldErrors.fullname}</div>
                )}
              </div>

              <div className="pw-field">
                <label>Date of Birth</label>

                <input
                  type="date"
                  className="pw-input"
                  value={profileForm.date_of_birth}
                  onChange={(event) =>
                    updateProfileField("date_of_birth", event.target.value)
                  }
                  disabled={!editMode}
                />

                {fieldErrors.date_of_birth && (
                  <div className="pw-field-error">
                    {fieldErrors.date_of_birth}
                  </div>
                )}
              </div>

              <div className="pw-field">
                <label>Email</label>

                <input className="pw-input" value={email} disabled />
              </div>

              <div className="pw-field">
                <label>Phone Number</label>

                <input
                  className="pw-input"
                  value={profileForm.phone}
                  onChange={(event) =>
                    updateProfileField("phone", event.target.value)
                  }
                  disabled={!editMode}
                />

                {fieldErrors.phone && (
                  <div className="pw-field-error">{fieldErrors.phone}</div>
                )}
              </div>

              <div className="pw-field pw-field--wide">
                <label>Address</label>

                <input
                  className="pw-input"
                  value={profileForm.address}
                  onChange={(event) =>
                    updateProfileField("address", event.target.value)
                  }
                  disabled={!editMode}
                />

                {fieldErrors.address && (
                  <div className="pw-field-error">{fieldErrors.address}</div>
                )}
              </div>

              <div className="pw-field">
                <label>ID Proof Type</label>

                <select
                  className="pw-input"
                  value={idProofType}
                  onChange={(event) => setIdProofType(event.target.value)}
                  disabled={!editMode}
                >
                  <option value="">Select ID proof</option>
                  <option value="aadhaar">Aadhaar</option>
                  <option value="passport">Passport</option>
                </select>

                {fieldErrors.id_proof_type && (
                  <div className="pw-field-error">
                    {fieldErrors.id_proof_type}
                  </div>
                )}
              </div>

              <div className="pw-field">
                <label>ID Proof Number</label>

                <input
                  className="pw-input"
                  value={profileForm.id_proof_number}
                  onChange={(event) =>
                    updateProfileField(
                      "id_proof_number",
                      event.target.value.toUpperCase(),
                    )
                  }
                  placeholder={
                    existing.profile?.id_proof_number_masked ||
                    "Aadhaar or Passport number"
                  }
                  disabled={!editMode}
                />

                {existing.profile?.id_proof_number_masked && (
                  <div className="pw-field-hint">
                    On file: {existing.profile.id_proof_number_masked}
                  </div>
                )}

                {fieldErrors.id_proof_number && (
                  <div className="pw-field-error">
                    {fieldErrors.id_proof_number}
                  </div>
                )}
              </div>

              <div className="pw-field pw-field--wide">
                <label>PAN Card Number</label>

                <input
                  className="pw-input"
                  value={bankForm.pan_number}
                  onChange={(event) =>
                    updateBankField(
                      "pan_number",
                      event.target.value.toUpperCase(),
                    )
                  }
                  placeholder={
                    existing.banking?.pan_number_masked || "ABCDE1234F"
                  }
                  disabled={!editMode}
                />

                {existing.banking?.pan_number_masked && (
                  <div className="pw-field-hint">
                    On file: {existing.banking.pan_number_masked}
                  </div>
                )}

                {fieldErrors.pan_number && (
                  <div className="pw-field-error">{fieldErrors.pan_number}</div>
                )}
              </div>
            </div>

            {(panPreviewUrl || idProofPreviewUrl) && (
              <div className="pw-doc-preview-section">
                <div className="pw-doc-preview-title">Uploaded Documents</div>

                <div className="pw-doc-preview-row">
                  {panPreviewUrl && (
                    <div className="pw-doc-preview-item">
                      <img src={panPreviewUrl} alt="PAN card on file" />
                      <span>PAN Card</span>
                    </div>
                  )}

                  {idProofPreviewUrl && (
                    <div className="pw-doc-preview-item">
                      <img src={idProofPreviewUrl} alt="ID proof on file" />
                      <span>
                        {idProofType === "passport"
                          ? "Passport"
                          : "Aadhaar Card"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="pw-actions">
              <button
                className="pw-btn-outline"
                onClick={onBack}
                disabled={savingStep1}
              >
                Cancel
              </button>

              <button
                className="pw-btn-primary"
                onClick={goNext}
                disabled={savingStep1}
              >
                Save & Next
              </button>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="pw-grid">
              <div className="pw-field">
                <label>Account Number</label>

                <input
                  className="pw-input"
                  value={bankForm.account_number}
                  onChange={(event) =>
                    updateBankField("account_number", event.target.value)
                  }
                  placeholder={
                    existing.banking?.account_number_masked ||
                    "Enter account number"
                  }
                  disabled={!editMode}
                />

                {fieldErrors.account_number && (
                  <div className="pw-field-error">
                    {fieldErrors.account_number}
                  </div>
                )}
              </div>

              <div className="pw-field">
                <label>Account Holder Name</label>

                <input
                  className="pw-input"
                  value={bankForm.account_holder_name}
                  onChange={(event) =>
                    updateBankField("account_holder_name", event.target.value)
                  }
                  disabled={!editMode}
                />
              </div>

              <div className="pw-field">
                <label>Bank Name</label>

                <input
                  className="pw-input"
                  value={bankForm.bank_name}
                  onChange={(event) =>
                    updateBankField("bank_name", event.target.value)
                  }
                  disabled={!editMode}
                />
              </div>

              <div className="pw-field">
                <label>Account Type</label>

                <select
                  className="pw-input"
                  value={bankForm.account_type}
                  onChange={(event) =>
                    updateBankField("account_type", event.target.value)
                  }
                  disabled={!editMode}
                >
                  {ACCOUNT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pw-field">
                <label>IFSC Code</label>

                <input
                  className="pw-input"
                  value={bankForm.ifsc_code}
                  onChange={(event) =>
                    updateBankField(
                      "ifsc_code",
                      event.target.value.toUpperCase(),
                    )
                  }
                  placeholder="HDFC0001234"
                  disabled={!editMode}
                />

                {fieldErrors.ifsc_code && (
                  <div className="pw-field-error">{fieldErrors.ifsc_code}</div>
                )}
              </div>

              <div className="pw-field pw-field--wide">
                <label>Branch Name</label>

                <input
                  className="pw-input"
                  value={bankForm.branch_name}
                  onChange={(event) =>
                    updateBankField("branch_name", event.target.value)
                  }
                  disabled={!editMode}
                />
              </div>
            </div>

            <p className="pw-security-note">
              🔒 Your sensitive information is handled by the secure backend.
            </p>

            <div className="pw-actions">
              <button
                className="pw-btn-outline"
                onClick={goBack}
                disabled={saving}
              >
                Back
              </button>

              <button
                className="pw-btn-outline"
                onClick={onBack}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                className="pw-btn-primary"
                onClick={handleSave}
                disabled={saving || !editMode}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
