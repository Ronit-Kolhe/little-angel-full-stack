import os
import io
import uuid
import datetime
from typing import Optional
from dotenv import load_dotenv
import jwt

from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from supabase import create_client, Client
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4

from security import verify_password, create_access_token, hash_password, SECRET_KEY, ALGORITHM

# ---------------------------------------------------------------------------
# 1.  INITIALISATION & DATABASE
# ---------------------------------------------------------------------------
load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing SUPABASE_URL or SUPABASE_KEY. Please check your .env file.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(title="School Portal API")

# ---------------------------------------------------------------------------
# 2.  CORS
# ---------------------------------------------------------------------------
app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"], # We will lock this down to your Vercel URL later
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# ---------------------------------------------------------------------------
# 3.  SECURITY / AUTH GUARD
# ---------------------------------------------------------------------------
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")


def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """Decodes and validates the JWT on every protected request."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return {
            "username":   payload.get("username"),
            "role":       payload.get("role"),
            "student_id": payload.get("student_id"),
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Login session has expired.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid login token.")


# ---------------------------------------------------------------------------
# 4.  DATA MODELS (PYDANTIC)
# ---------------------------------------------------------------------------
class StudentCreate(BaseModel):
    full_name:      str
    grade_level:    str
    total_fee:      float = 0.00
    contact_number: Optional[str] = None
    mother_name:    Optional[str] = None
    father_name:    Optional[str] = None
    dob:            Optional[str] = None
    address:        Optional[str] = None
    custom_notes:   Optional[str] = None


class TeacherCreate(BaseModel):
    full_name: str
    subject:   str
    is_active: bool = True


class PaymentCreate(BaseModel):
    student_id:          int
    amount_paid:         float
    payment_mode:        str
    installment_number:  Optional[int] = None
    late_fee_charged:    float = 0.00


class PublicRegistration(BaseModel):
    full_name:      str
    grade_level:    str
    contact_number: str
    mother_name:    Optional[str] = None
    father_name:    Optional[str] = None
    username:       str
    password:       str


# ---------------------------------------------------------------------------
# 5.  HELPERS
# ---------------------------------------------------------------------------
def _generate_receipt_id() -> str:
    """UUID-backed receipt ID — collision-safe even under concurrent inserts."""
    date_part   = datetime.datetime.now().strftime("%Y%m%d")
    unique_part = uuid.uuid4().hex[:8].upper()
    return f"RCPT-{date_part}-{unique_part}"


def _safe_filename(value: str) -> str:
    """Strips characters that could be used for HTTP header injection."""
    return "".join(ch for ch in value if ch.isalnum() or ch == "-")


# ---------------------------------------------------------------------------
# 6.  SYSTEM ROUTES
# ---------------------------------------------------------------------------
@app.get("/")
def read_root():
    return {"message": "Welcome to the School Portal API!"}


@app.get("/api/settings")
def get_school_settings():
    """Returns the single school-wide settings record."""
    try:
        # QUERY FIX: added .limit(1) so the endpoint is explicit about expecting
        # exactly one row; silently returning [0] of many rows is a logic hazard.
        response = supabase.table("settings").select("*").limit(1).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Settings not found.")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Authenticates a user and returns a signed JWT access token."""
    try:
        # QUERY FIX: explicit column list instead of SELECT *.
        # Avoids leaking future columns (audit fields, tokens, etc.) into the
        # token payload or response body.
        response = (
            supabase.table("app_users")
            .select("id, username, password_hash, role, is_active, student_id")
            .eq("username", form_data.username)
            .limit(1)
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=401, detail="Invalid username or password.")

        user = response.data[0]

        if not user.get("is_active"):
            raise HTTPException(status_code=400, detail="User account is deactivated.")

        if not verify_password(form_data.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid username or password.")

        # For parent accounts, check whether the linked student has been verified.
        # QUERY FIX: select only the column we actually test; no need for *.
        is_verified = True
        if user["role"] == "parent" and user.get("student_id"):
            student_res = (
                supabase.table("students")
                .select("is_verified")
                .eq("id", user["student_id"])
                .limit(1)
                .execute()
            )
            if student_res.data:
                is_verified = student_res.data[0].get("is_verified", False)

        token_data = {
            "user_id":    user["id"],
            "username":   user["username"],
            "role":       user["role"],
            "student_id": user.get("student_id"),
        }
        token = create_access_token(data=token_data)

        return {
            "access_token": token,
            "token_type":   "bearer",
            "role":         user["role"],
            "username":     user["username"],
            "is_verified":  is_verified,
            "student_id":   user.get("student_id"),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/dashboard")
def get_secure_dashboard(current_user: dict = Depends(get_current_user)):
    """Returns a role-appropriate dashboard greeting."""
    if current_user["role"] == "admin":
        data = "Here is the sensitive financial data for the school."
    else:
        data = "Here is your basic user dashboard."
    return {
        "message":   f"Access granted. Welcome, {current_user['username']}.",
        "your_role": current_user["role"],
        "data":      data,
    }


@app.get("/api/analytics")
def get_dashboard_analytics(current_user: dict = Depends(get_current_user)):
    """School-wide financial analytics. Restricted to admin and staff."""
    try:
        if current_user.get("role") not in ["admin", "staff"]:
            raise HTTPException(status_code=403, detail="Access Denied.")

        # QUERY FIX (major): was fetching every column of every student row and
        # then aggregating in Python.  Now we pull only the three columns we need.
        # For large tables, push the heavy lifting to a Supabase DB function or
        # a materialised view; this is correct and minimal for typical school sizes.
        student_res = (
            supabase.table("students")
            .select("fee_status, total_fee, paid_amount")
            .execute()
        )
        students = student_res.data

        total_students      = len(students)
        fees_cleared_count  = sum(1 for s in students if s.get("fee_status") == "Cleared")
        fees_pending_count  = sum(1 for s in students if s.get("fee_status") == "Pending")
        total_collected     = sum(float(s.get("paid_amount", 0)) for s in students)
        total_pending       = sum(
            max(0.0, float(s.get("total_fee", 0)) - float(s.get("paid_amount", 0)))
            for s in students
        )

        # QUERY FIX: use an explicit, named foreign-key embed so the join is
        # unambiguous and fails loudly if the FK relationship ever changes.
        # Format: "foreign_table!fk_column_name(col1, col2)"
        ledger_res = (
            supabase.table("payments")
            .select(
                "id, receipt_id, amount_paid, payment_mode, payment_date, "
                "students!payments_student_id_fkey(full_name, grade_level)"
            )
            .order("payment_date", desc=True)
            .limit(10)
            .execute()
        )

        return {
            "summary_cards": {
                "total_students":     total_students,
                "fees_cleared_count": fees_cleared_count,
                "fees_pending_count": fees_pending_count,
                "total_collected":    total_collected,
                "total_pending":      total_pending,
            },
            "recent_activity_ledger": ledger_res.data,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# 7.  STUDENT ROUTES
# ---------------------------------------------------------------------------
@app.get("/api/students")
def get_all_students(current_user: dict = Depends(get_current_user)):
    """Returns the student directory. Restricted to admin and staff."""
    try:
        if current_user.get("role") not in ["admin", "staff"]:
            raise HTTPException(
                status_code=403,
                detail="Access Denied. Parents cannot view the student directory.",
            )

        res = (
            supabase.table("students")
            .select("id, full_name, grade_level, fee_status, total_fee, paid_amount, is_verified")
            .order("id")
            .execute()
        )
        return res.data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/students/{student_id}/verify")
def verify_student(student_id: int, current_user: dict = Depends(get_current_user)):
    """Marks a student as verified/admitted. Admin only."""
    try:
        if current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Access Denied. Admins only.")

        # QUERY FIX: existence check before update.  Supabase returns no error
        # and empty .data on an update that matches zero rows — without this
        # guard the route would silently return 200 for a non-existent student_id.
        check = (
            supabase.table("students")
            .select("id")
            .eq("id", student_id)
            .limit(1)
            .execute()
        )
        if not check.data:
            raise HTTPException(status_code=404, detail="Student not found.")

        supabase.table("students").update({"is_verified": True}).eq("id", student_id).execute()
        return {"message": "Student successfully verified and admitted!"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/students")
def add_new_student(student: StudentCreate, current_user: dict = Depends(get_current_user)):
    """Creates a new student record (pre-verified). Admin only."""
    try:
        if current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Access Denied.")

        # model_dump(exclude_none=True) drops optional fields the caller left blank,
        # so we never insert explicit NULLs for fields the DB should default.
        new_student_data = student.model_dump(exclude_none=True)
        # Financial fields are always server-initialised; never trust caller input.
        new_student_data["paid_amount"]     = 0.0
        new_student_data["advance_balance"] = 0.0
        new_student_data["fee_status"]      = "Pending"
        new_student_data["is_verified"]     = True  # Admin-added → pre-verified.

        res = supabase.table("students").insert(new_student_data).execute()
        return res.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/students/{student_id}/report")
def get_student_report(student_id: int, current_user: dict = Depends(get_current_user)):
    """
    Full financial report for one student.
    Admins/staff can read any; parents can only read their own.
    """
    try:
        is_admin_or_staff = current_user.get("role") in ["admin", "staff"]
        # String comparison guards against int/str type mismatch in the JWT payload.
        is_owning_parent = (
            current_user.get("role") == "parent"
            and str(current_user.get("student_id")) == str(student_id)
        )

        if not (is_admin_or_staff or is_owning_parent):
            raise HTTPException(
                status_code=403,
                detail="Access Denied. You can only view your own student's report.",
            )

        # QUERY FIX: explicit column list for the student profile — avoids pulling
        # internal/sensitive columns that shouldn't be forwarded to the client.
        student_res = (
            supabase.table("students")
            .select(
                "id, full_name, grade_level, contact_number, mother_name, father_name, "
                "dob, address, custom_notes, total_fee, paid_amount, advance_balance, "
                "fee_status, is_verified"
            )
            .eq("id", student_id)
            .limit(1)
            .execute()
        )
        if not student_res.data:
            raise HTTPException(status_code=404, detail="Student not found.")

        student_profile = student_res.data[0]

        # QUERY FIX: select only the columns the front-end actually renders.
        payments_res = (
            supabase.table("payments")
            .select(
                "id, receipt_id, amount_paid, payment_mode, payment_date, "
                "installment_number, late_fee_charged"
            )
            .eq("student_id", student_id)
            .order("payment_date", desc=True)
            .execute()
        )

        total     = float(student_profile.get("total_fee", 0))
        paid      = float(student_profile.get("paid_amount", 0))
        remaining = max(0.0, total - paid)

        return {
            "profile": student_profile,
            "financial_summary": {
                "total_fee":       total,
                "paid_amount":     paid,
                "advance_balance": student_profile.get("advance_balance", 0),
                "remaining_dues":  remaining,
                "status":          student_profile.get("fee_status"),
            },
            "payment_history": payments_res.data,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/register")
def public_student_registration(registration: PublicRegistration):
    """
    Public self-registration endpoint for parents/students.
    The student account is created unverified and requires admin approval.
    NOTE: Add rate limiting (e.g. slowapi) in production to prevent spam
    and username-enumeration timing attacks.
    """
    try:
        # QUERY FIX: select only 'id' — we only need to know if the row exists.
        user_check = (
            supabase.table("app_users")
            .select("id")
            .eq("username", registration.username)
            .limit(1)
            .execute()
        )
        if user_check.data:
            raise HTTPException(
                status_code=400,
                detail="Username already taken. Please choose another.",
            )

        # QUERY FIX: build the insert dict via model_dump(exclude_none=True) so
        # optional None fields (mother_name, father_name) are omitted entirely
        # rather than being sent as explicit NULLs.
        student_data = {
            k: v for k, v in {
                "full_name":      registration.full_name,
                "grade_level":    registration.grade_level,
                "contact_number": registration.contact_number,
                "mother_name":    registration.mother_name,
                "father_name":    registration.father_name,
                "total_fee":      50000,   # Default fee; admin adjusts later.
                "paid_amount":    0.0,
                "advance_balance": 0.0,
                "fee_status":     "Pending",
                "is_verified":    False,   # Requires admin approval.
            }.items() if v is not None
        }

        student_res    = supabase.table("students").insert(student_data).execute()
        new_student_id = student_res.data[0]["id"]

        user_data = {
            "username":      registration.username,
            "password_hash": hash_password(registration.password),
            "role":          "parent",
            "is_active":     True,
            "student_id":    new_student_id,
        }
        supabase.table("app_users").insert(user_data).execute()

        return {
            "message":    "Registration successful! Pending admin verification.",
            "student_id": new_student_id,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# 8.  TEACHER ROUTES
# ---------------------------------------------------------------------------
@app.get("/api/teachers")
def get_teachers(current_user: dict = Depends(get_current_user)):
    """Returns all active teachers."""
    try:
        response = (
            supabase.table("teachers")
            .select("id, full_name, subject, is_active")   # explicit columns
            .eq("is_active", True)
            .execute()
        )
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/teachers")
def create_teacher(teacher: TeacherCreate, current_user: dict = Depends(get_current_user)):
    """Adds a new teacher. Admin only."""
    try:
        if current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Access Denied.")

        response = supabase.table("teachers").insert(teacher.model_dump()).execute()
        return {"message": "Teacher successfully added!", "new_teacher": response.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# 9.  FINANCIAL ROUTES — PAYMENTS & RECEIPTS
# ---------------------------------------------------------------------------
@app.post("/api/payments")
def create_payment(payment: PaymentCreate, current_user: dict = Depends(get_current_user)):
    """Records a fee payment and updates the student balance. Admin only."""
    try:
        if current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Access Denied.")

        # QUERY FIX: select only the two numeric fields we need for the balance
        # calculation — previously pulled all columns unnecessarily.
        student_res = (
            supabase.table("students")
            .select("total_fee, paid_amount")
            .eq("id", payment.student_id)
            .limit(1)
            .execute()
        )
        if not student_res.data:
            raise HTTPException(status_code=404, detail="Student not found.")

        student             = student_res.data[0]
        new_paid_amount     = float(student["paid_amount"]) + payment.amount_paid
        new_advance_balance = max(0.0, new_paid_amount - float(student["total_fee"]))
        new_fee_status      = "Cleared" if new_paid_amount >= float(student["total_fee"]) else "Pending"

        receipt_id   = _generate_receipt_id()
        payment_data = payment.model_dump(exclude_none=True)
        payment_data["receipt_id"] = receipt_id

        new_payment = supabase.table("payments").insert(payment_data).execute()
        supabase.table("students").update({
            "paid_amount":     new_paid_amount,
            "advance_balance": new_advance_balance,
            "fee_status":      new_fee_status,
        }).eq("id", payment.student_id).execute()

        return {
            "message":             "Payment processed successfully!",
            "receipt_id":          receipt_id,
            "new_student_status":  new_fee_status,
            "transaction_details": new_payment.data[0],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/receipts/{receipt_id}")
def generate_receipt_pdf(receipt_id: str, current_user: dict = Depends(get_current_user)):
    """Generates and streams a PDF fee receipt. Admin only."""
    try:
        if current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Access Denied.")

        # QUERY FIX (major): collapsed two sequential round-trips (payment → student)
        # into a single query using PostgREST FK embedding.  One network call instead
        # of two, and the join is evaluated inside Postgres rather than in Python.
        payment_res = (
            supabase.table("payments")
            .select(
                "receipt_id, amount_paid, payment_mode, payment_date, "
                "students!payments_student_id_fkey("
                "  full_name, grade_level, contact_number, "
                "  total_fee, paid_amount, advance_balance"
                ")"
            )
            .eq("receipt_id", receipt_id)
            .limit(1)
            .execute()
        )
        if not payment_res.data:
            raise HTTPException(status_code=404, detail="Receipt not found.")

        payment_data = payment_res.data[0]
        student_data = payment_data.get("students")

        # Guard: FK embed returns None if the linked student row was deleted.
        if not student_data:
            raise HTTPException(
                status_code=404,
                detail="Student record not found for this receipt.",
            )

        # --- Build PDF ---
        buffer = io.BytesIO()
        c      = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4

        # Header
        c.setFont("Helvetica-Bold", 20)
        c.drawCentredString(width / 2.0, height - 50, "LITTLE ANGELS")
        c.setFont("Helvetica", 12)
        c.drawCentredString(width / 2.0, height - 70, "Official Fee Receipt")
        c.line(50, height - 85, width - 50, height - 85)

        # Receipt ID & date
        c.setFont("Helvetica-Bold", 12)
        c.drawString(50,          height - 120, f"Receipt ID: {payment_data['receipt_id']}")
        c.drawString(width - 200, height - 120, f"Date: {payment_data['payment_date'].split('T')[0]}")

        # Student info
        c.setFont("Helvetica", 12)
        c.drawString(50, height - 160, f"Student Name: {student_data['full_name']}")
        c.drawString(50, height - 180, f"Class:        {student_data['grade_level']}")
        if student_data.get("contact_number"):
            c.drawString(50, height - 200, f"Contact:      {student_data['contact_number']}")

        # Payment summary
        c.setFont("Helvetica-Bold", 14)
        c.drawString(50, height - 250, "Payment Summary")
        c.line(50, height - 255, 250, height - 255)

        c.setFont("Helvetica", 12)
        c.drawString(50, height - 280, f"Amount Paid:  Rs. {payment_data['amount_paid']:.2f}")
        c.drawString(50, height - 300, f"Payment Mode: {payment_data['payment_mode']}")

        c.line(50, height - 360, width - 50, height - 360)
        c.drawString(50, height - 390, f"Total Course Fee:    Rs. {float(student_data['total_fee']):.2f}")
        c.drawString(50, height - 410, f"Total Paid to Date:  Rs. {float(student_data['paid_amount']):.2f}")

        remaining = float(student_data["total_fee"]) - float(student_data["paid_amount"])
        if remaining > 0:
            c.setFillColorRGB(0.8, 0, 0)
            c.drawString(50, height - 430, f"Remaining Dues:    Rs. {remaining:.2f}")
        else:
            c.setFillColorRGB(0, 0.6, 0)
            c.drawString(50, height - 430, f"Advance Balance:   Rs. {float(student_data['advance_balance']):.2f}")
        c.setFillColorRGB(0, 0, 0)  # always restore to black

        c.showPage()
        c.save()
        buffer.seek(0)

        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"inline; filename={_safe_filename(receipt_id)}.pdf"},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))