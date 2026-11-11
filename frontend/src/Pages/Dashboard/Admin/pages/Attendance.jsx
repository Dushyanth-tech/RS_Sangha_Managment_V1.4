import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import api from "../../../../api/axiosInstance";
import { formatAppDate, formatAppDateTime } from "../../Member/settingsPreferences";
import "./Attendance.css";

const rupees = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

const todayISO = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(String(iso).length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? "" : formatAppDate(d);
};

const fmtTime = (iso) => {
  if (!iso) return "";
  const d = new Date(`${iso}Z`);
  return Number.isNaN(d.getTime()) ? "" : formatAppDateTime(d);
};

const errorText = (err, fallback) => err?.response?.data?.detail || fallback;

export default function Attendance() {
  const [sanghas, setSanghas] = useState([]);
  const [sanghaId, setSanghaId] = useState("");
  const [date, setDate] = useState(todayISO());

  const [sheet, setSheet] = useState(null);       // { members, session, finePerHead, date, sangha }
  const [marks, setMarks] = useState({});         // memberId -> true | false | undefined
  const [history, setHistory] = useState([]);

  const [loadingSanghas, setLoadingSanghas] = useState(true);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(""), 4000);
  };

  // ---- only the sanghas this admin manages (the server decides) ----
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/attendance/sanghas");
        setSanghas(res.data);
        if (res.data.length === 1) setSanghaId(String(res.data[0].id));
      } catch (err) {
        setError(errorText(err, "Unable to load your Sanghas."));
      } finally {
        setLoadingSanghas(false);
      }
    })();
  }, []);

  const loadHistory = useCallback(async (id) => {
    if (!id) {
      setHistory([]);
      return;
    }
    setLoadingHistory(true);
    try {
      const res = await api.get(`/attendance/sanghas/${id}/sessions`);
      setHistory(res.data);
    } catch (err) {
      setError(errorText(err, "Unable to load the attendance history."));
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // changing the Sangha closes any open list and shows that Sangha's history
  useEffect(() => {
    setSheet(null);
    setMarks({});
    setConfirming(false);
    setError("");
    loadHistory(sanghaId);
  }, [sanghaId, loadHistory]);

  const openSheet = useCallback(
    async (forDate) => {
      if (!sanghaId) return;
      setLoadingSheet(true);
      setError("");
      setConfirming(false);
      try {
        const res = await api.get(`/attendance/sanghas/${sanghaId}/members`, {
          params: { meeting_date: forDate },
        });
        setSheet(res.data);
        const initial = {};
        res.data.members.forEach((m) => {
          if (m.present !== null && m.present !== undefined) initial[m.id] = m.present;
        });
        setMarks(initial);
      } catch (err) {
        setSheet(null);
        setError(errorText(err, "Unable to load the member list."));
      } finally {
        setLoadingSheet(false);
      }
    },
    [sanghaId]
  );

  const members = sheet?.members ?? [];
  const fine = sheet?.finePerHead ?? 25;
  const isUpdate = Boolean(sheet?.session);

  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;
    members.forEach((m) => {
      if (marks[m.id] === true) present += 1;
      if (marks[m.id] === false) absent += 1;
    });
    return { present, absent, marked: present + absent };
  }, [members, marks]);

  // what would change on an existing sheet (late arrivals etc.)
  const changes = useMemo(() => {
    if (!isUpdate) return { toPresent: 0, toAbsent: 0 };
    let toPresent = 0;
    let toAbsent = 0;
    members.forEach((m) => {
      if (marks[m.id] === undefined) return;
      if (m.present !== marks[m.id]) {
        if (marks[m.id]) toPresent += 1;
        else toAbsent += 1;
      }
    });
    return { toPresent, toAbsent };
  }, [isUpdate, members, marks]);

  const allMarked = members.length > 0 && counts.marked === members.length;
  const changeCount = changes.toPresent + changes.toAbsent;
  const canSubmit = allMarked && (!isUpdate || changeCount > 0);

  const setMark = (id, value) => {
    setMarks((previous) => ({ ...previous, [id]: value }));
    setConfirming(false);
    setError("");
  };

  const markAllPresent = () => {
    const all = {};
    members.forEach((m) => {
      all[m.id] = true;
    });
    setMarks(all);
    setConfirming(false);
  };

  const submit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    setError("");

    const records = members.map((m) => ({ member_id: m.id, present: marks[m.id] === true }));

    try {
      if (isUpdate) {
        const res = await api.put(`/attendance/sessions/${sheet.session.id}`, { records });
        showToast(res.data.message);
      } else {
        await api.post(`/attendance/sanghas/${sanghaId}`, { meeting_date: date, records });
        showToast(
          counts.absent > 0
            ? `Attendance saved. ${counts.absent} absent member(s) were fined ${rupees(fine)} each and notified.`
            : "Attendance saved. Everyone was present."
        );
      }
      setConfirming(false);
      await openSheet(date);
      await loadHistory(sanghaId);
    } catch (err) {
      setError(errorText(err, "Unable to save the attendance."));
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  };

  const viewSession = (row) => {
    setDate(row.date);
    openSheet(row.date);
    window.scrollTo?.({ top: 0, behavior: "smooth" });
  };

  const selectedSangha = sanghas.find((s) => String(s.id) === String(sanghaId));

  return (
    <div className="sa-page att">
      <div className="sa-section__header">
        <h2 className="sa-section__title">Member Attendance</h2>
      </div>

      {toast && (
        <div className="att-toast" role="status">
          <CheckCircle2 size={18} /> {toast}
        </div>
      )}
      {error && (
        <div className="att-alert" role="alert">
          {error}
        </div>
      )}

      {/* ---------------- 1. choose the Sangha and the date ---------------- */}
      <section className="att-card">
        <h3 className="att-card__title">Take attendance</h3>
        <p className="att-card__hint">
          You can take attendance only for the Sanghas you manage. Every absent member is fined{" "}
          {rupees(fine)} and gets a message.
        </p>

        {loadingSanghas ? (
          <p className="att-muted">Loading your Sanghas...</p>
        ) : sanghas.length === 0 ? (
          <p className="att-muted">You do not manage any Sangha yet.</p>
        ) : (
          <div className="att-pick">
            <label>
              Sangha
              <select value={sanghaId} onChange={(e) => setSanghaId(e.target.value)}>
                <option value="">Select a Sangha</option>
                {sanghas.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.membersCount} members)
                  </option>
                ))}
              </select>
            </label>

            <label>
              Date
              <input
                type="date"
                value={date}
                max={todayISO()}
                onChange={(e) => {
                  setDate(e.target.value);
                  setSheet(null);
                  setMarks({});
                  setConfirming(false);
                }}
              />
            </label>

            <button
              type="button"
              className="sa-btn-primary"
              disabled={!sanghaId || !date || loadingSheet}
              onClick={() => openSheet(date)}
            >
              {loadingSheet ? "Loading..." : "Take Attendance"}
            </button>
          </div>
        )}
      </section>

      {/* ---------------- 2. the member list with Yes / No ---------------- */}
      {sheet && (
        <section className="att-card">
          <div className="att-sheet__head">
            <div>
              <h3 className="att-card__title">
                {sheet.sangha.name} - {fmtDate(sheet.date)}
              </h3>
              {isUpdate ? (
                <p className="att-card__hint">
                  Attendance for this date is already saved ({fmtTime(sheet.session.takenAt)}). You can
                  change it, for example for members who came late.
                </p>
              ) : (
                <p className="att-card__hint">Mark Yes or No for every member, then submit.</p>
              )}
            </div>
            {!isUpdate && members.length > 0 && (
              <button type="button" className="sa-btn-outline" onClick={markAllPresent}>
                Mark everyone present
              </button>
            )}
          </div>

          {members.length === 0 ? (
            <p className="att-muted">This Sangha has no members to mark.</p>
          ) : (
            <>
              <div className="att-summary">
                <span>
                  Marked <b>{counts.marked}</b> / {members.length}
                </span>
                <span>
                  Present <b>{counts.present}</b>
                </span>
                <span>
                  Absent <b>{counts.absent}</b>
                </span>
                <span className="att-summary__fine">
                  Fine {rupees(counts.absent * fine)} ({counts.absent} x {rupees(fine)})
                </span>
              </div>

              <ul className="att-list">
                <li className="att-row att-row--head">
                  <span>Member</span>
                  <span className="att-row__choices">
                    <span>Attendance</span>
                  </span>
                </li>
                {members.map((m, index) => {
                  const value = marks[m.id];
                  return (
                    <li
                      key={m.id}
                      className={`att-row ${value === false ? "att-row--absent" : ""}`}
                    >
                      <span className="att-row__who">
                        <b>
                          {index + 1}. {m.name}
                        </b>
                        <small>
                          {m.phone}
                          {m.role === "subadmin" ? " - Sub-admin" : ""}
                        </small>
                      </span>

                      <span
                        className="att-row__choices"
                        role="radiogroup"
                        aria-label={`Attendance for ${m.name}`}
                      >
                        <label className={`att-choice att-choice--yes ${value === true ? "is-on" : ""}`}>
                          <input
                            type="radio"
                            name={`att-${m.id}`}
                            checked={value === true}
                            onChange={() => setMark(m.id, true)}
                          />
                          Yes
                        </label>
                        <label className={`att-choice att-choice--no ${value === false ? "is-on" : ""}`}>
                          <input
                            type="radio"
                            name={`att-${m.id}`}
                            checked={value === false}
                            onChange={() => setMark(m.id, false)}
                          />
                          No
                        </label>
                      </span>
                    </li>
                  );
                })}
              </ul>

              {confirming ? (
                <div className="att-confirm">
                  {isUpdate ? (
                    <p>
                      Save {changeCount} change(s)?{" "}
                      {changes.toPresent > 0 && `${changes.toPresent} marked present (fine removed). `}
                      {changes.toAbsent > 0 &&
                        `${changes.toAbsent} marked absent (fined ${rupees(fine)} and notified).`}
                    </p>
                  ) : (
                    <p>
                      Submit attendance? {counts.present} present, {counts.absent} absent.{" "}
                      {counts.absent > 0
                        ? `Each absent member is fined ${rupees(fine)} (${rupees(counts.absent * fine)} in total) and gets a message.`
                        : "Nobody is fined."}
                    </p>
                  )}
                  <div className="att-actions">
                    <button type="button" className="sa-btn-outline" onClick={() => setConfirming(false)} disabled={saving}>
                      Back
                    </button>
                    <button type="button" className="sa-btn-primary" onClick={submit} disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 size={16} className="att-spin" /> Saving...
                        </>
                      ) : (
                        "Confirm"
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="att-actions">
                  {!allMarked && (
                    <span className="att-muted">
                      Mark every member to continue ({members.length - counts.marked} left).
                    </span>
                  )}
                  {allMarked && isUpdate && changeCount === 0 && (
                    <span className="att-muted">Change a member's answer to enable Update.</span>
                  )}
                  <button
                    type="button"
                    className="sa-btn-primary"
                    disabled={!canSubmit}
                    onClick={() => setConfirming(true)}
                  >
                    {isUpdate ? "Update Attendance" : "Submit Attendance"}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* ---------------- 3. history ---------------- */}
      {sanghaId && (
        <section className="att-card">
          <h3 className="att-card__title">Attendance history{selectedSangha ? ` - ${selectedSangha.name}` : ""}</h3>

          {loadingHistory ? (
            <p className="att-muted">Loading...</p>
          ) : history.length === 0 ? (
            <p className="att-muted">No attendance has been taken for this Sangha yet.</p>
          ) : (
            <div className="sa-scroll-table">
              <table className="sa-table att-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Present</th>
                    <th>Absent</th>
                    <th>Fines</th>
                    <th>Saved</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id}>
                      <td>{fmtDate(row.date)}</td>
                      <td>{row.present}</td>
                      <td>{row.absent}</td>
                      <td>{rupees(row.fineTotal)}</td>
                      <td>
                        {fmtTime(row.takenAt)}
                        {row.updatedAt ? " (updated)" : ""}
                      </td>
                      <td>
                        <button type="button" className="sa-btn-outline" onClick={() => viewSession(row)}>
                          View / Update
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}