from fastapi import APIRouter, HTTPException
from sqlmodel import Session, select

from db import Recovery, RecoveryAction, engine


router = APIRouter()


# ============================================================
# RECOVERY RISK ANALYSIS
# ============================================================

def analyze_recovery_risk(record):
    """
    Deterministic and explainable recovery-risk analysis.
    """

    amount = float(record.amount or 0)
    status = str(record.status or "").strip().lower()

    # Payment failed
    if status == "failed":
        return {
            "risk_level": "high",
            "risk_score": 90,
            "reason": "Payment attempt failed",
            "recommended_action": "Retry payment",
            "recovery_probability": 0.75,
            "confidence": 0.90,
        }

    # Invoice overdue
    if status == "overdue":
        return {
            "risk_level": "high",
            "risk_score": 85,
            "reason": "Invoice is overdue",
            "recommended_action": "Priority payment follow-up",
            "recovery_probability": 0.70,
            "confidence": 0.85,
        }

    # Payment pending
    if status == "pending":
        return {
            "risk_level": "medium",
            "risk_score": 65,
            "reason": "Payment is still pending",
            "recommended_action": "Send payment reminder",
            "recovery_probability": 0.65,
            "confidence": 0.80,
        }

    # High-value unpaid invoice
    if status == "unpaid" and amount >= 200000:
        return {
            "risk_level": "high",
            "risk_score": 80,
            "reason": "High-value unpaid invoice",
            "recommended_action": "Priority payment recovery",
            "recovery_probability": 0.70,
            "confidence": 0.85,
        }

    # Medium-value unpaid invoice
    if status == "unpaid" and amount >= 100000:
        return {
            "risk_level": "medium",
            "risk_score": 60,
            "reason": "Medium-value unpaid invoice",
            "recommended_action": "Send payment reminder",
            "recovery_probability": 0.60,
            "confidence": 0.75,
        }

    # Lower-value unpaid invoice
    if status == "unpaid":
        return {
            "risk_level": "low",
            "risk_score": 40,
            "reason": "Unpaid invoice",
            "recommended_action": "Automated payment reminder",
            "recovery_probability": 0.50,
            "confidence": 0.70,
        }

    # Unknown status
    return {
        "risk_level": "low",
        "risk_score": 30,
        "reason": "Payment status requires review",
        "recommended_action": "Review payment status",
        "recovery_probability": 0.40,
        "confidence": 0.50,
    }


# ============================================================
# GET RECOVERY OPPORTUNITIES
# ============================================================

@router.get("/recovery")
def get_recovery_opportunities():

    with Session(engine) as session:

        records = session.exec(
            select(Recovery)
        ).all()

        opportunities = []

        active_revenue_at_risk = 0.0
        recovered_revenue = 0.0
        expected_recovery = 0.0

        for record in records:

            amount = float(record.amount or 0)

            status = str(
                record.status or ""
            ).strip().lower()

            # Recovered revenue
            if status == "recovered":
                recovered_revenue += amount
                continue

            # Paid revenue is not at risk
            if status == "paid":
                continue

            analysis = analyze_recovery_risk(record)

            active_revenue_at_risk += amount

            expected = round(
                amount * analysis["recovery_probability"],
                2
            )

            expected_recovery += expected

            opportunities.append({
                "id": record.id,
                "customer": record.external_id,
                "amount": amount,
                "currency": record.currency or "INR",
                "status": record.status,

                "risk": analysis["risk_level"],
                "risk_level": analysis["risk_level"],
                "risk_score": analysis["risk_score"],

                "reason": analysis["reason"],

                "recommended_action": (
                    analysis["recommended_action"]
                ),

                "recovery_probability": (
                    analysis["recovery_probability"]
                ),

                "confidence": (
                    analysis["confidence"]
                ),

                "expected_recovery": expected,
            })

        total_recoverable = (
            active_revenue_at_risk +
            recovered_revenue
        )

        if total_recoverable > 0:
            recovery_rate = (
                recovered_revenue /
                total_recoverable
            )
        else:
            recovery_rate = 0

        metrics = {
            "revenue_at_risk": round(
                total_recoverable,
                2
            ),

            "active_revenue_at_risk": round(
                active_revenue_at_risk,
                2
            ),

            "recovered_revenue": round(
                recovered_revenue,
                2
            ),

            "recovery_rate": round(
                recovery_rate,
                4
            ),

            "expected_recovery": round(
                expected_recovery,
                2
            ),

            "opportunity_count": len(
                opportunities
            ),
        }

        return {
            "success": True,
            "opportunities": opportunities,
            "metrics": metrics,

            "revenue_at_risk": metrics[
                "revenue_at_risk"
            ],

            "active_revenue_at_risk": metrics[
                "active_revenue_at_risk"
            ],

            "recovered_revenue": metrics[
                "recovered_revenue"
            ],

            "recovery_rate": metrics[
                "recovery_rate"
            ],

            "expected_recovery": metrics[
                "expected_recovery"
            ],

            "opportunity_count": metrics[
                "opportunity_count"
            ],
        }


# ============================================================
# RECOVERY HISTORY
# ============================================================

@router.get("/recovery/history")
def get_recovery_history():

    with Session(engine) as session:

        actions = session.exec(
            select(RecoveryAction)
            .order_by(
                RecoveryAction.executed_at.desc()
            )
        ).all()

        history = []

        for action in actions:

            history.append({
                "id": action.id,
                "recovery_id": action.recovery_id,
                "customer": action.customer,
                "action_type": action.action_type,
                "amount": action.amount,
                "status": action.status,
                "executed_at": action.executed_at,
            })

        return {
            "success": True,
            "history": history,
            "count": len(history),
        }


# ============================================================
# BATCH RECOVERY
# ============================================================

@router.post("/recovery/batch-execute")
def batch_execute_recovery(recovery_ids: list[int]):

    results = []

    with Session(engine) as session:

        for recovery_id in recovery_ids:

            record = session.get(
                Recovery,
                recovery_id
            )

            if not record:
                results.append({
                    "id": recovery_id,
                    "success": False,
                    "message": "Recovery record not found",
                })
                continue

            status = str(
                record.status or ""
            ).strip().lower()

            if status == "recovered":
                results.append({
                    "id": recovery_id,
                    "success": False,
                    "message": "Revenue already recovered",
                })
                continue

            amount = float(
                record.amount or 0
            )

            action = RecoveryAction(
                recovery_id=record.id,
                customer=record.external_id,
                action_type="Recovery action executed",
                amount=amount,
                status="completed",
            )

            session.add(action)

            record.status = "recovered"

            session.add(record)

            results.append({
                "id": recovery_id,
                "customer": record.external_id,
                "amount": amount,
                "success": True,
                "message": "Recovery action completed",
            })

        session.commit()

    return {
        "success": True,
        "results": results,
        "processed": len(results),
    }


# ============================================================
# SINGLE RECOVERY
# ============================================================

@router.post("/recovery/{recovery_id}/execute")
def execute_recovery(recovery_id: int):

    with Session(engine) as session:

        record = session.get(
            Recovery,
            recovery_id
        )

        if not record:
            raise HTTPException(
                status_code=404,
                detail="Recovery opportunity not found"
            )

        status = str(
            record.status or ""
        ).strip().lower()

        if status == "recovered":
            raise HTTPException(
                status_code=400,
                detail="Revenue has already been recovered"
            )

        amount = float(
            record.amount or 0
        )

        action = RecoveryAction(
            recovery_id=record.id,
            customer=record.external_id,
            action_type="Recovery action executed",
            amount=amount,
            status="completed",
        )

        session.add(action)

        record.status = "recovered"

        session.add(record)

        session.commit()
        session.refresh(action)

        return {
            "success": True,
            "message": "Recovery action completed",
            "recovery": {
                "id": record.id,
                "customer": record.external_id,
                "amount": amount,
                "status": record.status,
            },
            "action": {
                "id": action.id,
                "action_type": action.action_type,
                "status": action.status,
                "executed_at": action.executed_at,
            },
        }


# ============================================================
# AI RECOVERY INSIGHTS
# ============================================================

@router.get("/recovery/insights")
def get_recovery_insights():

    with Session(engine) as session:

        records = session.exec(
            select(Recovery)
        ).all()

        opportunities = []

        total_active_risk = 0.0
        total_expected_recovery = 0.0
        recovered_revenue = 0.0

        high_risk_count = 0
        medium_risk_count = 0
        low_risk_count = 0

        for record in records:

            amount = float(
                record.amount or 0
            )

            status = str(
                record.status or ""
            ).strip().lower()

            if status == "recovered":
                recovered_revenue += amount
                continue

            if status == "paid":
                continue

            analysis = analyze_recovery_risk(
                record
            )

            expected = round(
                amount *
                analysis["recovery_probability"],
                2
            )

            total_active_risk += amount
            total_expected_recovery += expected

            opportunity = {
                "id": record.id,
                "customer": record.external_id,
                "amount": amount,

                "risk": analysis["risk_level"],
                "risk_score": analysis["risk_score"],

                "reason": analysis["reason"],

                "recommended_action": (
                    analysis["recommended_action"]
                ),

                "recovery_probability": (
                    analysis["recovery_probability"]
                ),

                "confidence": (
                    analysis["confidence"]
                ),

                "expected_recovery": expected,
            }

            opportunities.append(opportunity)

            if analysis["risk_level"] == "high":
                high_risk_count += 1

            elif analysis["risk_level"] == "medium":
                medium_risk_count += 1

            else:
                low_risk_count += 1

        if not opportunities:

            return {
                "success": True,
                "has_opportunities": False,

                "summary": (
                    "No active recovery opportunities "
                    "remain. All identified revenue has "
                    "been recovered or marked as paid."
                ),

                "priority": "none",

                "metrics": {
                    "active_revenue_at_risk": 0,
                    "expected_recovery": 0,
                    "recovered_revenue": round(
                        recovered_revenue,
                        2
                    ),
                    "opportunity_count": 0,
                    "high_risk_count": 0,
                    "medium_risk_count": 0,
                    "low_risk_count": 0,
                },

                "top_opportunity": None,
                "highest_risk_opportunity": None,
                "recommended_action": None,
            }

        highest_value = max(
            opportunities,
            key=lambda item: item["amount"]
        )

        highest_risk = max(
            opportunities,
            key=lambda item: (
                item["risk_score"],
                item["amount"]
            )
        )

        if high_risk_count > 0:
            priority = "high"
        elif medium_risk_count > 0:
            priority = "medium"
        else:
            priority = "low"

        summary = (
            f"₹{total_active_risk:,.0f} remains at risk "
            f"across {len(opportunities)} active "
            f"recovery opportunities. "
            f"{highest_value['customer']} represents "
            f"the largest remaining opportunity at "
            f"₹{highest_value['amount']:,.0f}, with an "
            f"estimated recovery of "
            f"₹{highest_value['expected_recovery']:,.0f}. "
            f"Prioritize "
            f"{highest_value['recommended_action'].lower()}."
        )

        return {
            "success": True,
            "has_opportunities": True,
            "summary": summary,
            "priority": priority,

            "metrics": {
                "active_revenue_at_risk": round(
                    total_active_risk,
                    2
                ),

                "expected_recovery": round(
                    total_expected_recovery,
                    2
                ),

                "recovered_revenue": round(
                    recovered_revenue,
                    2
                ),

                "opportunity_count": len(
                    opportunities
                ),

                "high_risk_count": high_risk_count,
                "medium_risk_count": medium_risk_count,
                "low_risk_count": low_risk_count,
            },

            "top_opportunity": highest_value,
            "highest_risk_opportunity": highest_risk,

            "recommended_action": (
                highest_value[
                    "recommended_action"
                ]
            ),
        }


# ============================================================
# RESET DEMO DATA
# ============================================================

@router.post("/recovery/reset-demo")
def reset_demo():

    # Original hackathon demo dataset
    demo_data = [
        {
            "customer": "Apex Manufacturing",
            "amount": 1250000,
            "status": "unpaid",
        },
        {
            "customer": "Nova Retail Group",
            "amount": 875000,
            "status": "overdue",
        },
        {
            "customer": "Zenith Technologies",
            "amount": 640000,
            "status": "failed",
        },
        {
            "customer": "GreenMart Industries",
            "amount": 480000,
            "status": "pending",
        },
        {
            "customer": "Urban Logistics",
            "amount": 325000,
            "status": "unpaid",
        },
        {
            "customer": "Bright Services",
            "amount": 185000,
            "status": "unpaid",
        },
        {
            "customer": "Metro Supplies",
            "amount": 95000,
            "status": "pending",
        },
        {
            "customer": "Sunrise Traders",
            "amount": 65000,
            "status": "unpaid",
        },
    ]

    with Session(engine) as session:

        # Delete existing recovery actions
        actions = session.exec(
            select(RecoveryAction)
        ).all()

        for action in actions:
            session.delete(action)

        # Delete existing recovery records
        records = session.exec(
            select(Recovery)
        ).all()

        for record in records:
            session.delete(record)

        session.commit()

        # Insert original demo records
        for item in demo_data:

            record = Recovery(
                external_id=item["customer"],
                amount=item["amount"],
                currency="INR",
                status=item["status"],
                raw=None,
            )

            session.add(record)

        session.commit()

    return {
        "success": True,
        "message": "Demo data reset successfully",
        "records_restored": len(demo_data),
    }
@router.post("/recovery/reset-demo")
def reset_demo_data():
    demo_records = [
        {
            "external_id": "Acme Corp",
            "amount": 245000,
            "currency": "INR",
            "status": "failed",
        },
        {
            "external_id": "Globex Industries",
            "amount": 180000,
            "currency": "INR",
            "status": "overdue",
        },
        {
            "external_id": "NovaTech Solutions",
            "amount": 125000,
            "currency": "INR",
            "status": "pending",
        },
        {
            "external_id": "Vertex Systems",
            "amount": 95000,
            "currency": "INR",
            "status": "unpaid",
        },
        {
            "external_id": "BrightPath Ltd",
            "amount": 72000,
            "currency": "INR",
            "status": "paid",
        },
    ]

    with Session(engine) as session:
        # Remove existing recovery opportunities
        existing_records = session.exec(select(Recovery)).all()
        for record in existing_records:
            session.delete(record)

        # Remove previous recovery action history
        existing_actions = session.exec(select(RecoveryAction)).all()
        for action in existing_actions:
            session.delete(action)

        session.commit()

        # Create the clean demo dataset
        for item in demo_records:
            record = Recovery(**item)
            session.add(record)

        session.commit()

    return {
        "success": True,
        "message": "Demo data has been reset successfully",
        "count": len(demo_records),
    }