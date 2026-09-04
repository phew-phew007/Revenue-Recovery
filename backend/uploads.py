from fastapi import APIRouter, UploadFile, File, HTTPException
from sqlmodel import Session, select
import csv
import io
import json

from db import Recovery, engine

router = APIRouter(prefix="/api")


@router.post("/upload")
async def upload_csv(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a CSV file."
        )

    content = await file.read()

    try:
        text = content.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        rows = list(reader)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Could not read the CSV file."
        )

    if not rows:
        raise HTTPException(
            status_code=400,
            detail="CSV file is empty."
        )

    # Find the amount column
    amount_column = None

    for column in reader.fieldnames or []:
        name = column.lower().strip()

        if name in [
            "amount",
            "revenue",
            "charge",
            "claim_amount",
            "billed_amount",
            "invoice_amount"
        ]:
            amount_column = column
            break

    total_amount = 0.0
    saved_records = 0

    with Session(engine) as session:

        # Clear previous demo data before loading the new CSV
        old_records = session.exec(select(Recovery)).all()

        for old_record in old_records:
            session.delete(old_record)

        session.commit()

        # Save the new CSV rows
        for index, row in enumerate(rows):

            amount = 0.0

            if amount_column:
                try:
                    amount = float(
                        str(row.get(amount_column, "0"))
                        .replace(",", "")
                        .replace("$", "")
                    )
                except (ValueError, TypeError):
                    amount = 0.0

            total_amount += amount

            recovery = Recovery(
                external_id=str(
                    row.get("customer")
                    or row.get("invoice_id")
                    or row.get("id")
                    or f"row-{index + 1}"
                ),
                amount=amount,
                currency=str(row.get("currency") or "USD"),
                status=str(row.get("status") or "unknown"),
                raw=json.dumps(row)
            )

            session.add(recovery)
            saved_records += 1

        session.commit()

    estimated_recovery = round(total_amount * 0.15, 2)

    return {
        "filename": file.filename,
        "records": len(rows),
        "saved_records": saved_records,
        "total_amount": round(total_amount, 2),
        "estimated_recovery": estimated_recovery,
        "message": "CSV analyzed and saved to database successfully"
    }