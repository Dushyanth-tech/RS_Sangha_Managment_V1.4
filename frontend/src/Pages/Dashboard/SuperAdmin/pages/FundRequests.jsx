import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  HandCoins,
  RefreshCw,
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  AlertTriangle,
} from "lucide-react";

import api from "../../../../api/axiosInstance";
import { formatAppDate, formatAppDateTime } from "../../Member/settingsPreferences";
import "./FundRequests.css";

/* ====================================================================
   HELPERS
==================================================================== */

const rupees = (v) =>
  v === null || v === undefined
    ? "—"
    : `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const fmtDate = (iso) =>
  iso ? formatAppDate(iso) : "—";

const fmtDateTime = (iso) =>
  iso ? formatAppDateTime(iso) : "—";

const errorText = (err, fallback) => {
  if (err?.response?.status === 401) {
    return "Your session has expired. Please log in again.";
  }
  const detail = err?.response?.data?.detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join(", ");
  return (typeof detail === "string" && detail) || fallback;
};

const TABS = [
  { key: "pending", label: "Pending", test: (r) => r.status === "Pending" },
  { key: "review", label: "Under Review", test: (r) => r.status === "Under Review" },
  { key: "approved", label: "Approved", test: (r) => r.status === "Approved" },
  { key: "rejected", label: "Rejected", test: (r) => r.status === "Rejected" },
  { key: "all", label: "All", test: () => true },
];

const TONE = {
  Pending: "amber",
  "Under Review": "amber",
  Approved: "green",
  Rejected: "red",
  Disbursed: "blue",
  Repaying: "blue",
  Completed: "green",
};

const canDecide = (r) => r.status === "Pending" || r.status === "Under Review";

/* ====================================================================
   SMALL PIECES
==================================================================== */

const Badge = ({ status }) => (
  <span className={`fr-badge fr-badge--${TONE[status] ?? "gray"}`}>{status}</span>
);

function Modal({ title, subtitle, onClose, children }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && closeRef.current();
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div
      className="fr-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="fr-modal" role="dialog" aria-modal="true" aria-label={title}>
        <header className="fr-modal__head">
          <div>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="fr-icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="fr-modal__body">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children, wide }) {
  return (
    <div className={`fr-field ${wide ? "fr-field--wide" : ""}`}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/* ====================================================================
   REVIEW DATA (used by both the Details and the Approve screens)
==================================================================== */

function useRequestDetail(id) {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/sangha-savings/requests/${id}`);
        if (!cancelled) setD(res.data);
      } catch (err) {
        console.error("Error loading review details:", err);
        if (!cancelled) setError(errorText(err, "Unable to load the member's history."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { d, loading, error };
}

function ReviewInfo({ d }) {
  const hasDebt = d.currentOutstanding > 0;
  const c = d.contributions;

  return (
    <>
      {d.eligibility && (
        <>
          <h4 className="fr-section-title">Eligibility at submission</h4>
          <dl className="fr-grid fr-grid--tight">
            <Field label="Decision">
              <span
                className={`fr-badge fr-badge--${
                  d.eligibility.decision === "eligible"
                    ? "green"
                    : d.eligibility.decision === "manual_review"
                    ? "amber"
                    : "red"
                }`}
              >
                {d.eligibility.decision === "manual_review"
                  ? "Manual review needed"
                  : d.eligibility.decision === "eligible"
                  ? "Eligible"
                  : "Not eligible"}
              </span>
            </Field>
            <Field label="RS-Sangha Score">
              {d.eligibility.score.value != null
                ? `${d.eligibility.score.value} / ${d.eligibility.score.max} - ${
                    d.eligibility.score.status === "sufficient"
                      ? d.eligibility.score.category
                      : "Provisional"
                  }`
                : "Not available"}
            </Field>
            <Field label="Minimum Score Required">{d.eligibility.score.minimumRequired}</Field>
            <Field label="Weighted Average Balance">
              {d.eligibility.balance.weightedAverage != null
                ? `${rupees(d.eligibility.balance.weightedAverage)} (${d.eligibility.balance.daysCounted} days)`
                : "No history"}
            </Field>
            <Field label={`Balance Limit (avg x ${d.eligibility.balance.multiplier})`}>
              {d.eligibility.balance.balanceLimit != null
                ? rupees(d.eligibility.balance.balanceLimit)
                : "Not available"}
            </Field>
            <Field label="Outstanding Principal">
              {rupees(d.eligibility.obligations.outstandingPrincipal)}
            </Field>
            <Field label="Maximum Eligible Amount">{rupees(d.eligibility.maxEligibleAmount)}</Field>
            <Field label="Sangha Fund at Submission">{rupees(d.eligibility.fund.available ?? 0)}</Field>
          </dl>

          <ul className="fr-mini">
            {d.eligibility.score.factors.map((f) => (
              <li key={f.key}>
                <span>
                  {f.label} ({f.weight}%)
                </span>
                <span>{f.status === "calculated" ? `${f.score}%` : "Needs more data"}</span>
                <span className={`fr-badge fr-badge--${f.status === "calculated" ? "green" : "gray"}`}>
                  {f.status === "calculated" ? "Calculated" : "Insufficient"}
                </span>
              </li>
            ))}
          </ul>

          {d.eligibility.reasons
            .filter((r) => r.level !== "info")
            .map((r) => (
              <p key={r.code} className="fr-note">
                {r.message}
              </p>
            ))}
          <p className="fr-note">
            Internal RS-Sangha score, not an official CIBIL score. Calculated by the server when the
            request was submitted.
          </p>
        </>
      )}

      <h4 className="fr-section-title">Debt</h4>
      <div className={`fr-debt ${hasDebt ? "fr-debt--warn" : ""}`}>
        <strong>{rupees(d.currentOutstanding)}</strong>
        <span>{hasDebt ? "remaining debt this member still owes" : "No outstanding debt"}</span>
      </div>

      <dl className="fr-grid fr-grid--tight">
        <Field label="Total Borrowed">{rupees(d.totalBorrowed)}</Field>
        <Field label="Principal Repaid">{rupees(d.totalRepaidPrincipal)}</Field>
        <Field label={`Interest Due Now (${d.interestRate}%)`}>{rupees(d.interestDueNow)}</Field>
      </dl>

      {d.activeDebts.length > 0 && (
        <ul className="fr-mini">
          {d.activeDebts.map((a) => (
            <li key={a.id}>
              <span>
                Request #{a.id} · {fmtDate(a.disbursedAt)}
              </span>
              <b>
                {rupees(a.outstanding)} of {rupees(a.approvedAmount)} left
              </b>
            </li>
          ))}
        </ul>
      )}

      <h4 className="fr-section-title">Contributions to the Sangha</h4>
      <dl className="fr-grid fr-grid--tight">
        <Field label="Total Contributed">{rupees(c.totalPaid)}</Field>
        <Field label="Weeks Paid">{c.weeksPaid}</Field>
        <Field label="Contributing Since">{c.since ? fmtDate(c.since) : "No contributions yet"}</Field>
        {c.waitingAmount > 0 && (
          <Field label="Waiting for Confirmation">{rupees(c.waitingAmount)}</Field>
        )}
      </dl>

      <ul className="fr-mini">
        {c.months.map((m) => (
          <li key={m.month}>
            <span>{m.month}</span>
            <span>
              {m.paidWeeks} of {m.expectedWeeks} weeks · {rupees(m.paidAmount)}
            </span>
            <span className={`fr-badge fr-badge--${m.missedWeeks === 0 ? "green" : "red"}`}>
              {m.missedWeeks === 0 ? "On track" : `${m.missedWeeks} missed`}
            </span>
          </li>
        ))}
      </ul>

      <h4 className="fr-section-title">Interest & repayment history</h4>
      <dl className="fr-grid fr-grid--tight">
        <Field label="Previous Requests">{d.previousRequests}</Field>
        <Field label="Completed Requests">{d.completedRequests}</Field>
        <Field label="Total Interest Paid">{rupees(d.totalInterestPaid)}</Field>
        <Field label="Paid On Time" wide>
          {d.totalRepayments > 0
            ? `${d.onTimeRepayments} of ${d.totalRepayments} repayments (${d.repaymentConsistency}%)`
            : "No repayments yet"}
        </Field>
      </dl>

      {d.repayments.length > 0 && (
        <ul className="fr-mini">
          {d.repayments.map((p, i) => (
            <li key={`${p.paidAt}-${i}`}>
              <span>{fmtDate(p.paidAt)}</span>
              <span>
                {rupees(p.principal)} principal + {rupees(p.interest)} interest
              </span>
              <span className={`fr-badge fr-badge--${p.isOnTime ? "green" : "amber"}`}>
                {p.isOnTime ? "On time" : "Late"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ====================================================================
   APPROVE MODAL
==================================================================== */

function ApproveModal({ item, onClose, onConfirm }) {
  const { d, loading, error: loadError } = useRequestDetail(item.id);
  const [amount, setAmount] = useState(String(item.amount));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const n = Number(amount);
  const fund = d?.availableFund;
  const verified = d?.verification === "Verified";
  const fundShort = fund != null && n > fund;
  const hasDebt = (d?.currentOutstanding ?? 0) > 0;
  const missedThisMonth = d?.contributions?.months?.[0]?.missedWeeks ?? 0;
  const canConfirm =
    !busy && !loading && !loadError && verified && n > 0 && n <= item.amount && !fundShort;

  const confirm = async () => {
    if (!(n > 0)) {
      setError("Enter an approved amount greater than ₹0.");
      return;
    }
    if (n > item.amount) {
      setError("The approved amount cannot exceed the requested amount.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await onConfirm(n);
      onClose();
    } catch (err) {
      console.error("Approve failed:", err);
      setError(errorText(err, "Unable to approve this request."));
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Review & Approve"
      subtitle={`${item.memberName} · ${item.sanghaName}`}
      onClose={onClose}
    >
      {loading ? (
        <span className="fr-skel" style={{ height: 260 }} />
      ) : loadError ? (
        <div className="fr-alert">{loadError}</div>
      ) : (
        <>
          <h4 className="fr-section-title">Request</h4>
          <dl className="fr-grid">
            <Field label="Member">{d.memberName}</Field>
            <Field label="Sangha">{d.sangha.name} ({d.sangha.code})</Field>
            <Field label="Requested Amount">{rupees(d.amount)}</Field>
            <Field label="Monthly Salary">{rupees(d.monthlySalary)}</Field>
            <Field label="Sangha Fund Available">{rupees(d.availableFund)}</Field>
            <Field label="Verification">{d.verification}</Field>
            <Field label="Reason" wide>{d.reason}</Field>
          </dl>

          <ReviewInfo d={d} />

          <label className="fr-input fr-input--spaced">
            Approved Amount (₹)
            <input
              type="number"
              min="1"
              max={item.amount}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={busy}
            />
          </label>

          <p className="fr-note">
            Approving credits this amount to the member immediately and deducts it from the
            Sangha Savings balance. The member is notified.
          </p>

          {!verified && (
            <div className="fr-alert fr-alert--warn">
              <AlertTriangle size={16} /> The member&apos;s account must be verified before approval.
            </div>
          )}
          {fundShort && (
            <div className="fr-alert fr-alert--warn">
              <AlertTriangle size={16} /> Only {rupees(fund)} is available in Sangha Savings.
            </div>
          )}
          {hasDebt && (
            <div className="fr-alert fr-alert--warn">
              <AlertTriangle size={16} /> This member still owes {rupees(d.currentOutstanding)}. Review it before approving.
            </div>
          )}
          {missedThisMonth > 0 && (
            <div className="fr-alert fr-alert--warn">
              <AlertTriangle size={16} /> This member has missed {missedThisMonth} contribution day
              {missedThisMonth === 1 ? "" : "s"} this month.
            </div>
          )}
        </>
      )}

      {error && <div className="fr-alert">{error}</div>}

      <div className="fr-actions">
        <button type="button" className="fr-btn" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="fr-btn fr-btn--approve" onClick={confirm} disabled={!canConfirm}>
          {busy ? <Loader2 size={16} className="fr-spin" /> : <CheckCircle2 size={16} />}
          Approve &amp; Credit {n > 0 ? rupees(n) : ""}
        </button>
      </div>
    </Modal>
  );
}
/* ====================================================================
   REJECT MODAL
==================================================================== */

function RejectModal({ item, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const confirm = async () => {
    if (!reason.trim()) {
      setError("Please provide a rejection reason.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (err) {
      console.error("Reject failed:", err);
      setError(errorText(err, "Unable to reject this request."));
      setBusy(false);
    }
  };

  return (
    <Modal title="Reject Fund Request" subtitle={`${item.memberName} · ${rupees(item.amount)}`} onClose={onClose}>
      <label className="fr-input">
        Reason
        <textarea
          rows={4}
          maxLength={255}
          placeholder="Please provide rejection reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={busy}
        />
      </label>
      <p className="fr-note">The member will see this reason. The request is kept in the records.</p>

      {error && <div className="fr-alert">{error}</div>}

      <div className="fr-actions">
        <button type="button" className="fr-btn" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="fr-btn fr-btn--reject-solid" onClick={confirm} disabled={busy}>
          {busy ? <Loader2 size={16} className="fr-spin" /> : <XCircle size={16} />}
          Reject Request
        </button>
      </div>
    </Modal>
  );
}

/* ====================================================================
   DETAILS MODAL (every FundRequest column)
==================================================================== */

function DetailsModal({ item, onClose, onApprove, onReject, onStartReview, onDisburse }) {
  const detail = useRequestDetail(item.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDisburse, setConfirmDisburse] = useState(false);

  const run = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      setConfirmDisburse(false);
    } catch (err) {
      console.error("Action failed:", err);
      setError(errorText(err, "Unable to complete this action."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Fund Request #${item.id}`} subtitle={`${item.memberName} · ${item.sanghaName}`} onClose={onClose}>
      <div className="fr-detail-head">
        <Badge status={item.status} />
      </div>

      <h4 className="fr-section-title">Request</h4>
      <dl className="fr-grid">
        <Field label="Request ID">#{item.id}</Field>
        <Field label="Status">{item.status}</Field>
        <Field label="Member">{item.memberName}</Field>
        <Field label="Member ID">{item.memberId}</Field>
        <Field label="Sangha">{item.sanghaName} ({item.sanghaCode})</Field>
        <Field label="Sangha ID">{item.sanghaId}</Field>
        <Field label="Requested Amount">{rupees(item.amount)}</Field>
        <Field label="Approved Amount">{rupees(item.approvedAmount)}</Field>
        <Field label="Monthly Salary">{rupees(item.monthlySalary)}</Field>
        <Field label="Requested On">{fmtDateTime(item.requestedAt)}</Field>
        <Field label="Reviewed By">{item.reviewedBy || "—"}</Field>
        <Field label="Reviewed On">{fmtDateTime(item.reviewedAt)}</Field>
        <Field label="Disbursed On">{fmtDateTime(item.disbursedAt)}</Field>
        <Field label="Completed On">{fmtDateTime(item.completedAt)}</Field>
        <Field label="Reason" wide>{item.reason}</Field>
        {item.rejectionReason && <Field label="Rejection Reason" wide>{item.rejectionReason}</Field>}
      </dl>

      {detail.loading ? (
        <span className="fr-skel" style={{ height: 200, marginTop: 16 }} />
      ) : detail.error ? (
        <div className="fr-alert">{detail.error}</div>
      ) : (
        <ReviewInfo d={detail.d} />
      )}

      {error && <div className="fr-alert">{error}</div>}

      {canDecide(item) && (
        <div className="fr-actions">
          {item.status === "Pending" && (
            <button type="button" className="fr-btn" disabled={busy} onClick={() => run(() => onStartReview(item.id))}>
              {busy ? <Loader2 size={16} className="fr-spin" /> : "Start Review"}
            </button>
          )}
          <button type="button" className="fr-btn fr-btn--reject" onClick={() => onReject(item)} disabled={busy}>
            Reject
          </button>
          <button type="button" className="fr-btn fr-btn--approve" onClick={() => onApprove(item)} disabled={busy}>
            Approve
          </button>
        </div>
      )}

      {item.status === "Approved" && (
        <div className="fr-inline">
          <p className="fr-note">
            Approved for {rupees(item.approvedAmount)}. Disbursing records that the money was given to the
            member and deducts it from the Sangha Savings balance.
          </p>
          {!confirmDisburse ? (
            <div className="fr-actions">
              <button type="button" className="fr-btn fr-btn--primary" onClick={() => setConfirmDisburse(true)}>
                Mark as Disbursed
              </button>
            </div>
          ) : (
            <div className="fr-actions">
              <button type="button" className="fr-btn" onClick={() => setConfirmDisburse(false)} disabled={busy}>
                Cancel
              </button>
              <button
                type="button"
                className="fr-btn fr-btn--primary"
                disabled={busy}
                onClick={() => run(() => onDisburse(item.id))}
              >
                {busy ? <Loader2 size={16} className="fr-spin" /> : "Confirm Disbursement"}
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
function PaymentsToConfirm({ onChanged }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState(null);
  const [late, setLate] = useState({});
  const [rejectKey, setRejectKey] = useState(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const [p, c] = await Promise.all([
        api.get("/sangha-savings/payments/pending"),
        api.get("/sangha-savings/contributions/pending"),
      ]);

      const payments = (p.data.items ?? []).map((x) => ({
        key: `p${x.id}`,
        type: "payment",
        id: x.id,
        memberName: x.memberName,
        sanghaName: x.sanghaName,
        label: x.kind === "interest" ? "Interest" : "Principal",
        amount: x.amount,
        reference: x.reference,
        createdAt: x.createdAt,
      }));

      const contributions = (c.data.items ?? []).map((x) => ({
        key: `c${x.batchId}`,
        type: "contribution",
        id: x.batchId,
        memberName: x.memberName,
        sanghaName: x.sanghaName,
        label: `Weekly contribution (week of ${fmtDate(x.weeks[0])})`,
        weeks: x.weeks,
        amount: x.amount,
        reference: x.reference,
        createdAt: x.createdAt,
      }));

      setItems(
        [...payments, ...contributions].sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
        ),
      );
    } catch (err) {
      console.error("Error loading payments:", err);
      setError(errorText(err, "Unable to load payments to confirm."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (key, fn) => {
    setBusyKey(key);
    setError("");
    try {
      await fn();
      setRejectKey(null);
      setReason("");
      await load();
      await onChanged?.();
    } catch (err) {
      console.error("Payment action failed:", err);
      setError(errorText(err, "Unable to complete this action."));
    } finally {
      setBusyKey(null);
    }
  };

  const confirm = (p) =>
    act(p.key, () =>
      p.type === "payment"
        ? api.post(`/sangha-savings/payments/${p.id}/confirm`, { is_on_time: !late[p.key] })
        : api.post(`/sangha-savings/contributions/${p.id}/confirm`, {}),
    );

  const reject = (p) =>
    act(p.key, () =>
      api.post(
        `/sangha-savings/${p.type === "payment" ? "payments" : "contributions"}/${p.id}/reject`,
        { reason: reason.trim() },
      ),
    );

  if (loading || (!error && items.length === 0)) return null;

  return (
    <section className="fr-pay">
      <h2>Payments to confirm</h2>
      <p>
        Members say they paid these. Confirm only after the money has reached the Sangha account.
      </p>

      {error && <div className="fr-alert">{error}</div>}

      <ul className="fr-pay__list">
        {items.map((p) => (
          <li key={p.key} className="fr-pay__item">
            <div className="fr-pay__top">
              <div>
                <strong>{p.memberName}</strong>
                <span>
                  {p.sanghaName} · {fmtDate(p.createdAt)}
                </span>
              </div>
              <div className="fr-pay__amount">
                {rupees(p.amount)}
                <small>{p.label}</small>
              </div>
            </div>

            {p.weeks && (
              <div className="fr-pay__ref">
                Week of: <b>{p.weeks.map((d) => fmtDate(d)).join(", ")}</b>
              </div>
            )}

            <div className="fr-pay__ref">
              Reference: <b>{p.reference}</b>
            </div>

            {rejectKey === p.key ? (
              <div className="fr-pay__reject">
                <input
                  type="text"
                  placeholder="Why was it not received?"
                  maxLength={255}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={busyKey === p.key}
                />
                <div className="fr-actions">
                  <button type="button" className="fr-btn" onClick={() => setRejectKey(null)} disabled={busyKey === p.key}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="fr-btn fr-btn--reject-solid"
                    onClick={() => reject(p)}
                    disabled={busyKey === p.key || reason.trim().length < 3}
                  >
                    {busyKey === p.key ? <Loader2 size={16} className="fr-spin" /> : <XCircle size={16} />}
                    Reject Payment
                  </button>
                </div>
              </div>
            ) : (
              <>
                {p.type === "payment" && (
                  <label className="fr-pay__check">
                    <input
                      type="checkbox"
                      checked={!late[p.key]}
                      onChange={(e) => setLate((prev) => ({ ...prev, [p.key]: !e.target.checked }))}
                    />
                    Paid on time
                  </label>
                )}
                <div className="fr-actions">
                  <button type="button" className="fr-btn fr-btn--reject" onClick={() => setRejectKey(p.key)} disabled={busyKey === p.key}>
                    Not received
                  </button>
                  <button type="button" className="fr-btn fr-btn--approve" onClick={() => confirm(p)} disabled={busyKey === p.key}>
                    {busyKey === p.key ? <Loader2 size={16} className="fr-spin" /> : <CheckCircle2 size={16} />}
                    Confirm Received
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ====================================================================
   PAGE
==================================================================== */

export default function FundRequests({ onChanged }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState("pending");

  const [detailId, setDetailId] = useState(null);
  const [approveFor, setApproveFor] = useState(null);
  const [rejectFor, setRejectFor] = useState(null);

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError("");
      const res = await api.get("/sangha-savings/inbox");
      setItems(res.data.items ?? []);
    } catch (err) {
      console.error("Error loading fund requests:", err);
      setError(errorText(err, "Unable to load fund requests."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeTab = TABS.find((t) => t.key === tab);
  const visible = useMemo(() => items.filter(activeTab.test), [items, activeTab]);
  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.key, items.filter(t.test).length])),
    [items],
  );

  // Always read the open request from the latest list so it reflects new status after an action
  const detailItem = items.find((r) => r.id === detailId) ?? null;

  // Reload the list, then refresh the bell badge in the topbar
  const afterChange = async () => {
    await load(true);
    onChanged?.();
  };

  const review = (id, body) => api.patch(`/sangha-savings/requests/${id}/review`, body);

  const approve = async (item, approvedAmount) => {
    await review(item.id, { action: "approve", approved_amount: approvedAmount });
    await afterChange();
    setNotice(`${rupees(approvedAmount)} credited to ${item.memberName}. The member has been notified.`);
  };

  const reject = async (item, reason) => {
    await review(item.id, { action: "reject", reason });
    await afterChange();
    setNotice(`Request from ${item.memberName} was rejected. The member has been notified.`);
  };

  const startReview = async (id) => {
    await review(id, { action: "start_review" });
    await afterChange();
    setNotice("Request moved to Under Review.");
  };

  const disburse = async (id) => {
    await api.post(`/sangha-savings/requests/${id}/disburse`, {});
    await afterChange();
    setNotice("Marked as disbursed. The amount was deducted from the Sangha Savings balance.");
  };

  return (
    <div className="fr">
      <header className="fr-header">
        <span className="fr-header__icon">
          <Bell size={22} />
        </span>
        <div className="fr-header__text">
          <h1>Member Fund Requests</h1>
          <p>Emergency money requests from members, paid from the Sangha Savings Account.</p>
        </div>
        <button type="button" className="fr-btn fr-btn--ghost" onClick={() => load()} aria-label="Refresh">
          <RefreshCw size={16} /> <span>Refresh</span>
        </button>
      </header>
      <PaymentsToConfirm onChanged={afterChange} />

      <div className="fr-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`fr-tab ${tab === t.key ? "fr-tab--active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            <span className="fr-tab__count">{counts[t.key]}</span>
          </button>
        ))}
      </div>

      {notice && (
        <div className="fr-notice" role="status">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}

      {error && (
        <div className="fr-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => load()}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="fr-list">
          {[0, 1, 2].map((i) => (
            <span key={i} className="fr-skel" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="fr-empty">
          <HandCoins size={28} />
          <strong>
            {tab === "pending" ? "No pending fund requests" : "No requests in this list"}
          </strong>
          <p>
            {tab === "pending"
              ? "New requests from your members will appear here."
              : "Requests will show up here as members submit them."}
          </p>
        </div>
      ) : (
        <ul className="fr-list">
          {visible.map((r) => (
            <li key={r.id} className={`fr-card ${r.status === "Pending" ? "fr-card--new" : ""}`}>
              <div className="fr-card__top">
                <div>
                  <span className="fr-card__eyebrow">Member Fund Request #{r.id}</span>
                  <strong className="fr-card__amount">{rupees(r.amount)}</strong>
                </div>
                <Badge status={r.status} />
              </div>

              <dl className="fr-grid">
                <Field label="Member">{r.memberName}</Field>
                <Field label="Member ID">{r.memberId}</Field>
                <Field label="Sangha">{r.sanghaName}</Field>
                <Field label="Monthly Salary">{rupees(r.monthlySalary)}</Field>
                <Field label="Requested On">{fmtDate(r.requestedAt)}</Field>
                {r.approvedAmount != null && <Field label="Approved Amount">{rupees(r.approvedAmount)}</Field>}
                <Field label="Reason" wide>{r.reason}</Field>
              </dl>

              <div className="fr-card__actions">
                <button type="button" className="fr-btn fr-btn--ghost" onClick={() => setDetailId(r.id)}>
                  <Eye size={16} /> Details
                </button>
                {canDecide(r) && (
                  <>
                    <button type="button" className="fr-btn fr-btn--reject" onClick={() => setRejectFor(r)}>
                      Reject
                    </button>
                    <button type="button" className="fr-btn fr-btn--approve" onClick={() => setApproveFor(r)}>
                      Approve
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {detailItem && (
        <DetailsModal
          item={detailItem}
          onClose={() => setDetailId(null)}
          onApprove={(r) => setApproveFor(r)}
          onReject={(r) => setRejectFor(r)}
          onStartReview={startReview}
          onDisburse={disburse}
        />
      )}

      {approveFor && (
        <ApproveModal
          item={approveFor}
          onClose={() => setApproveFor(null)}
          onConfirm={(amount) => approve(approveFor, amount)}
        />
      )}

      {rejectFor && (
        <RejectModal
          item={rejectFor}
          onClose={() => setRejectFor(null)}
          onConfirm={(reason) => reject(rejectFor, reason)}
        />
      )}
    </div>
  );
}