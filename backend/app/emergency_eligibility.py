"""Emergency-money eligibility. Runs ON THE SERVER, from database records only.

Used by:
  * GET  /sangha-savings/eligibility  - what the "Request Emergency Money" modal displays
  * POST /sangha-savings/requests     - re-evaluated at submit time; the request row is only created
                                        when this says the member can request

The browser never supplies a score, a balance, a salary or a limit. Everything below is read from
the database for the authenticated member.

RULES
-----
Outcome is one of:
  ineligible    - at least one blocking reason. No request can be created.
  eligible      - nothing blocks. (A provisional score above the minimum is shown as a note for the
                  reviewer; it does not stop the member being eligible.)
  manual_review - only used when PROVISIONAL_SCORE_NEEDS_MANUAL_REVIEW is switched on.

Blocking reasons:
  * the existing basic checks (restricted account, not verified, no Sangha / account / funds,
    profile incomplete, a request already in progress)           -> passed in as `base_blockers`
  * no monthly salary on file                                      (required data missing)
  * RS-Sangha score cannot be calculated yet (insufficient data)   (required data missing)
  * RS-Sangha score below EMERGENCY_MIN_SCORE
  * no balance snapshot at all                                     (the limit cannot be calculated)
  * ANY existing loan debt or due: outstanding principal, interest due now, or overdue interest.
    A member must have repaid everything before asking for more emergency money.
  * requested amount above the member's limit or above the Sangha funds

LIMIT
-----
  weighted average balance = duration-weighted average of the member's saved daily balance snapshots
                             over the last BALANCE_WINDOW_DAYS days (or since the first snapshot, if
                             that is more recent). Each day counts once; a day with no new snapshot
                             carries the previous balance forward (a balance is "maintained" until
                             it changes, and every change writes a snapshot). Future records are
                             ignored and a missing snapshot is never treated as zero.
  balance-based limit      = weighted average balance x EMERGENCY_BALANCE_MULTIPLIER (3)
  max eligible amount      = min( limit , Sangha funds available )   (a member with debt is not eligible)
"""
from __future__ import annotations

import os
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app import credit_score as cs
from app.authModal import FundRequest, MemberAvailableBalanceSnapshot, User

# ---------------------------------------------------------------------------------------------
# Settings. The minimum score can be overridden with the EMERGENCY_MIN_SCORE environment variable.
# ---------------------------------------------------------------------------------------------
def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


EMERGENCY_MIN_SCORE = _env_int("EMERGENCY_MIN_SCORE", 600)   # on the 300-900 RS-Sangha scale
EMERGENCY_BALANCE_MULTIPLIER = Decimal("3")
BALANCE_WINDOW_DAYS = 28

# False: a provisional score at or above the minimum still shows "Eligible" (with a note for the admin).
# True : it shows "Manual review" instead.
PROVISIONAL_SCORE_NEEDS_MANUAL_REVIEW = False

_IST = timezone(timedelta(hours=5, minutes=30))
_PAISA = Decimal("0.01")
ZERO = Decimal(0)


def _d(value) -> Decimal:
    return Decimal(str(value if value is not None else 0))


def _rupees(value) -> str:
    return f"₹{float(value):,.2f}".replace(".00", "")


def _reason(code: str, level: str, message: str) -> dict:
    return {"code": code, "level": level, "message": message}   # level: block | review | info


# ---------------------------------------------------------------------------------------------
# Duration-weighted average balance
# ---------------------------------------------------------------------------------------------
def weighted_average_balance(db: Session, member_id: int) -> dict | None:
    """None when the member has no usable snapshot (never treated as a zero balance)."""
    today = datetime.now(_IST).date()
    filters = [
        MemberAvailableBalanceSnapshot.member_id == member_id,
        MemberAvailableBalanceSnapshot.snapshot_day <= today,
        MemberAvailableBalanceSnapshot.recorded_at <= datetime.now(timezone.utc),   # nothing from the future
    ]
    if cs.BALANCE_SNAPSHOT_VALID_FROM is not None:
        filters.append(MemberAvailableBalanceSnapshot.snapshot_day >= cs.BALANCE_SNAPSHOT_VALID_FROM)

    rows = (
        db.query(MemberAvailableBalanceSnapshot.snapshot_day, MemberAvailableBalanceSnapshot.balance)
        .filter(*filters)
        .order_by(MemberAvailableBalanceSnapshot.snapshot_day.asc())
        .all()
    )
    if not rows:
        return None

    first_day = rows[0][0]
    start = max(today - timedelta(days=BALANCE_WINDOW_DAYS - 1), first_day)

    idx = 0
    for i, (day, _) in enumerate(rows):          # last snapshot on or before the window start
        if day <= start:
            idx = i
    current = _d(rows[idx][1])

    total = ZERO
    days = 0
    lowest = highest = current
    day = start
    while day <= today:
        while idx + 1 < len(rows) and rows[idx + 1][0] <= day:
            idx += 1
            current = _d(rows[idx][1])
        total += current
        days += 1
        lowest, highest = min(lowest, current), max(highest, current)
        day += timedelta(days=1)

    return {
        "average": (total / days).quantize(_PAISA),
        "days": days,
        "first_day": first_day,
        "latest": current,
        "lowest": lowest,
        "highest": highest,
        "snapshots_in_window": sum(1 for d, _ in rows if d >= start),
    }


def _member_salary(db: Session, user: User) -> Decimal:
    """Salary already on file: the profile first, then the salary stored on the latest request."""
    salary = _d(user.salary)
    if salary > 0:
        return salary
    return _d(
        db.query(FundRequest.monthly_salary)
        .filter(FundRequest.member_id == user.id)
        .order_by(FundRequest.requested_at.desc(), FundRequest.id.desc())
        .limit(1)
        .scalar()
    )


# ---------------------------------------------------------------------------------------------
# The evaluation
# ---------------------------------------------------------------------------------------------
def evaluate_emergency_eligibility(
    db: Session,
    user: User,
    *,
    fund_balance: Decimal | None,
    base_blockers: list[dict],
    interest_rate_percent: Decimal,
    interest_due_now: Decimal = ZERO,
    debt_principal: Decimal | None = None,
    requested_amount: Decimal | None = None,
) -> dict:
    reasons: list[dict] = [_reason(b["code"], "block", b["message"]) for b in base_blockers]

    # ---- salary already stored (never asked again) ----
    salary = _member_salary(db, user)
    if salary <= 0:
        reasons.append(_reason(
            "salary_missing", "block",
            "Your employment details (monthly salary) are not on file yet. "
            "Please complete your Employment Profile first.",
        ))

    # ---- RS-Sangha internal score ----
    sc = cs.calculate_internal_score(db, user, interest_rate_percent)
    score_value = sc["score"]
    threshold = EMERGENCY_MIN_SCORE
    meets = None if score_value is None else score_value >= threshold

    if sc["status"] == "insufficient_data":
        detail = f" {sc['missing'][0]}" if sc["missing"] else ""
        reasons.append(_reason(
            "score_insufficient", "block",
            "There is not enough recorded activity to calculate your RS-Sangha score yet." + detail,
        ))
    elif not meets:
        reasons.append(_reason(
            "score_low", "block",
            f"Your RS-Sangha score is {score_value}, below the minimum of {threshold} required "
            f"for emergency money." + (" This score is provisional." if sc["status"] == "provisional" else ""),
        ))
    elif sc["status"] == "provisional":
        reasons.append(_reason(
            "score_provisional",
            "review" if PROVISIONAL_SCORE_NEEDS_MANUAL_REVIEW else "note",
            f"Your RS-Sangha score ({score_value}) is provisional because there is limited history so far. "
            "It meets the minimum, and the administrator will see that it is provisional.",
        ))

    # ---- existing debt or dues: any of them makes the member not eligible ----
    overdue = sum(l["interest_cycles_overdue"] for l in sc["loans"])
    outstanding = sum((_d(l["outstanding_principal"]) for l in sc["loans"]), ZERO)
    if debt_principal is not None:
        outstanding = max(outstanding, _d(debt_principal))      # the app's own figure (same as the Debt card)
    interest_due = _d(interest_due_now)

    if outstanding > 0 or interest_due > 0 or overdue > 0:
        parts = []
        if outstanding > 0:
            parts.append(f"{_rupees(outstanding)} principal outstanding")
        if interest_due > 0:
            parts.append(f"{_rupees(interest_due)} interest due")
        if overdue > 0:
            which = "; ".join(
                f"Loan #{l['request_id']}: {_rupees(l['interest_shortfall'])} unpaid since {l['first_overdue_due']:%d %b %Y}"
                for l in sc["loans"] if l["interest_cycles_overdue"] > 0 and l["first_overdue_due"]
            )
            parts.append(f"{overdue} interest payment(s) past the due date" + (f" ({which})" if which else ""))
        reasons.append(_reason(
            "existing_debt", "block",
            "You still have an unpaid loan: " + ", ".join(parts) + ". "
            "Please repay it in full before requesting more emergency money.",
        ))

    # ---- balance-based limit ----
    bal = weighted_average_balance(db, user.id)
    balance_limit = headroom = None
    if bal is None:
        reasons.append(_reason(
            "no_balance_history", "block",
            "No saved balance history was found, so your limit cannot be calculated yet. "
            "Open Sangha Savings again after your balance has been recorded.",
        ))
    else:
        balance_limit = (bal["average"] * EMERGENCY_BALANCE_MULTIPLIER).quantize(_PAISA)
        headroom = max(balance_limit - outstanding, ZERO)
        if headroom <= 0:
            reasons.append(_reason(
                "limit_reached", "block",
                f"Your outstanding loan principal ({_rupees(outstanding)}) already uses your limit "
                f"of {_rupees(balance_limit)}.",
            ))

    fund = _d(fund_balance) if fund_balance is not None else None
    max_eligible = ZERO
    if headroom is not None and fund is not None:
        max_eligible = max(min(headroom, fund), ZERO)

    # ---- the amount being requested (submit time) ----
    if requested_amount is not None and headroom is not None and fund is not None:
        if requested_amount > fund:
            reasons.append(_reason(
                "amount_exceeds_fund", "block",
                f"The requested amount exceeds the available Sangha funds ({_rupees(fund)}).",
            ))
        elif requested_amount > max_eligible:
            reasons.append(_reason(
                "amount_over_limit", "block",
                f"The requested amount exceeds your current limit of {_rupees(max_eligible)}.",
            ))

    # ---- explanation lines (shown to the member) ----
    if bal is not None:
        reasons.append(_reason(
            "limit_basis", "info",
            f"Limit = weighted average balance {_rupees(bal['average'])} (last {bal['days']} day(s)) x "
            f"{EMERGENCY_BALANCE_MULTIPLIER} = {_rupees(balance_limit)}, minus outstanding loan "
            f"principal {_rupees(outstanding)}, capped by Sangha funds {_rupees(fund or 0)}.",
        ))

    blocking = [r for r in reasons if r["level"] == "block"]
    review = [r for r in reasons if r["level"] == "review"]
    hard_block = any(not r["code"].startswith("amount_") for r in blocking)

    if blocking:
        decision = "ineligible"
        summary = blocking[0]["message"]
    elif review:
        decision = "manual_review"
        summary = f"You can request up to {_rupees(max_eligible)}. " + review[0]["message"]
    else:
        decision = "eligible"
        summary = f"You are eligible to request up to {_rupees(max_eligible)}."

    return {
        "decision": decision,
        "canRequest": decision != "ineligible",
        "summary": summary,
        "maxEligibleAmount": 0.0 if hard_block else float(max_eligible),
        "reasons": reasons,
        "score": {
            "value": score_value,
            "max": sc["max_score"],
            "category": sc["category"],
            "status": sc["status"],
            "minimumRequired": threshold,
            "meetsMinimum": meets,
            "factors": [
                {k: f[k] for k in ("key", "label", "weight", "status", "score")} for f in sc["factors"]
            ],
            "calculatedAt": sc["calculated_at"].isoformat(),
        },
        "balance": {
            "weightedAverage": float(bal["average"]) if bal else None,
            "windowDays": BALANCE_WINDOW_DAYS,
            "daysCounted": bal["days"] if bal else 0,
            "firstSnapshotDay": bal["first_day"].isoformat() if bal else None,
            "latest": float(bal["latest"]) if bal else None,
            "lowest": float(bal["lowest"]) if bal else None,
            "highest": float(bal["highest"]) if bal else None,
            "multiplier": float(EMERGENCY_BALANCE_MULTIPLIER),
            "balanceLimit": float(balance_limit) if balance_limit is not None else None,
        },
        "obligations": {
            "outstandingPrincipal": float(outstanding),
            "interestDueNow": float(interest_due_now),
            "overdueInterestPayments": overdue,
        },
        "fund": {"available": float(fund) if fund is not None else None},
        "salary": {"onFile": salary > 0, "monthly": float(salary) if salary > 0 else None},
        "requestedAmount": float(requested_amount) if requested_amount is not None else None,
        "evaluatedAt": datetime.now(timezone.utc).isoformat(),
    }