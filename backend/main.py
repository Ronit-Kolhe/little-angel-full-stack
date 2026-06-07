import os
import io
import datetime
from typing import Optional
from dotenv import load_dotenv
import jwt

from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from supabase import create_client, Client
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4

# FIX (low): Moved hash_password import to top level — no longer buried inside a function
from security import verify_password, create_access_token, hash_password, SECRET_KEY, ALGORITHM

# --- 1. INITIALIZATION & DATABASE ---
load_dotenv()
URL = os.environ.get("SUPABASE_URL")
KEY = os.environ.get("SUPABASE_KEY")

if not URL or not KEY:
    raise ValueError("Missing Supabase URL or Key. Please check your .env file.")

supabase: Client = create_client(URL, KEY)

app = FastAPI(title="School Portal API")

# --- 2. CORS CONFIGURATION ---
# FIX (low): Restricted methods and headers to only what the frontend actually uses
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

# --- 3. SECURITY GUARD ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

def get_current_user(token: str = Depends(oauth2_scheme)):
    """Verifies the JWT token on every protected request."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return {
            "username": payload.get("username"),
            "role": payload.get("role"),
            "student_id": payload.get("student_id") # We are adding this!
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Login session has expired.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid login token.")

# --- 4. DATA MODELS (PYDANTIC) ---
class LoginRequest(BaseModel):
    username: str
    password: str

class StudentCreate(BaseModel):
    full_name: str
    grade_level: str
    total_fee: float = 0.00
    paid_amount: float = 0.00
    advance_balance: float = 0.00
    fee_status: str = "Pending"
    contact_number: Optional[str] = None
    mother_name: Optional[str] = None
    father_name: Optional[str] = None
    dob: Optional[str] = None
    address: Optional[str] = None
    custom_notes: Optional[str] = None

class TeacherCreate(BaseModel):
    full_name: str
    subject: str
    is_active: bool = True

class PaymentCreate(BaseModel):
    student_id: int
    amount_paid: float
    payment_mode: str
    installment_number: Optional[int] = None
    late_fee_charged: float = 0.00

class PublicRegistration(BaseModel):
    full_name: str
    grade_level: str
    contact_number: str
    mother_name: Optional[str] = None
    father_name: Optional[str] = None
    username: str  # The username the parent/student will use to log in
    password: str  # The unhashed password they want to use

# --- 5. SYSTEM ROUTES ---
@app.get("/")
def read_root():
    return {"message": "Welcome to the School Portal API!"}

@app.get("/api/settings")
def get_school_settings():
    try:
        response = supabase.table("settings").select("*").execute()
        if response.data:
            return response.data[0]
        else:
            raise HTTPException(status_code=404, detail="Settings not found")
    except HTTPException as http_ex:
        raise http_ex
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/login")
@app.post("/api/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    try:
        response = supabase.table("app_users").select("*").eq("username", form_data.username).execute()
        if not response.data:
            raise HTTPException(status_code=401, detail="Invalid username or password")

        user = response.data[0]
        if not user.get("is_active"):
            raise HTTPException(status_code=400, detail="User account is deactivated")

        is_valid = verify_password(form_data.password, user["password_hash"])
        if not is_valid:
            raise HTTPException(status_code=401, detail="Invalid username or password")

        # Check if the linked student is verified by the admin
        is_verified = True
        if user["role"] == "parent" and user.get("student_id"):
            student_res = supabase.table("students").select("is_verified").eq("id", user["student_id"]).execute()
            if student_res.data:
                is_verified = student_res.data[0].get("is_verified", False)

        token_data = {
            "user_id": user["id"],
            "username": user["username"],
            "role": user["role"],
            "student_id": user.get("student_id") # Bake the ID into the token
        }
        token = create_access_token(data=token_data)

        return {
            "access_token": token, 
            "token_type": "bearer", 
            "role": user["role"], 
            "username": user["username"],
            "is_verified": is_verified,
            "student_id": user.get("student_id")
        }
    except HTTPException as http_ex:
        raise http_ex
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/dashboard")
def get_secure_dashboard(current_user: dict = Depends(get_current_user)):
    if current_user["role"] == "admin":
        secret_data = "Here is the sensitive financial data for the school."
    else:
        secret_data = "Here is your basic user dashboard."
    return {"message": f"Access Granted! Welcome {current_user['username']}.", "your_role": current_user["role"], "secret_data": secret_data}

@app.get("/api/analytics")
def get_dashboard_analytics(current_user: dict = Depends(get_current_user)):
    try:
        student_res = supabase.table("students").select("fee_status, total_fee, paid_amount").execute()
        students = student_res.data

        total_students = len(students)
        fees_cleared_count = sum(1 for s in students if s.get("fee_status") == "Cleared")
        # FIX (medium): Count Pending students directly instead of total - cleared,
        # so students with an advance balance (overpaid) are not incorrectly counted as pending.
        fees_pending_count = sum(1 for s in students if s.get("fee_status") == "Pending")
        total_collected = sum(float(s.get("paid_amount", 0)) for s in students)
        total_pending = sum(max(0, float(s.get("total_fee", 0)) - float(s.get("paid_amount", 0))) for s in students)

        ledger_res = supabase.table("payments").select(
            "id, receipt_id, amount_paid, payment_mode, payment_date, students(full_name, grade_level)"
        ).order("payment_date", desc=True).limit(10).execute()

        return {
            "summary_cards": {
                "total_students": total_students,
                "fees_cleared_count": fees_cleared_count,
                "fees_pending_count": fees_pending_count,
                "total_collected": total_collected,
                "total_pending": total_pending
            },
            "recent_activity_ledger": ledger_res.data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- 6. STUDENT ROUTES ---
# FIX (high): Removed duplicate @app.get("/api/students") decorator and section comment.
# FastAPI silently registered both; only the second handler was ever reachable.
@app.get("/api/students")
def get_all_students(current_user: dict = Depends(get_current_user)):
    try:
        if current_user.get("role") not in ["admin", "staff"]:
            raise HTTPException(status_code=403, detail="Parents cannot view the student directory.")

        res = supabase.table("students").select("id, full_name, grade_level, fee_status, total_fee, paid_amount, is_verified").order("id").execute()
        return res.data
    except HTTPException as http_ex:
        raise http_ex
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/students/{student_id}/verify")
def verify_student(student_id: int, current_user: dict = Depends(get_current_user)):
    try:
        if current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Access Denied. Admins only.")

        supabase.table("students").update({"is_verified": True}).eq("id", student_id).execute()
        return {"message": "Student successfully verified and admitted!"}
    except HTTPException as http_ex:
        raise http_ex
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/students")
def add_new_student(student: StudentCreate, current_user: dict = Depends(get_current_user)):
    try:
        if current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Access Denied.")

        # FIX (low): Replaced deprecated .dict() with .model_dump() for Pydantic v2
        new_student_data = student.model_dump(exclude_none=True)
        new_student_data["paid_amount"] = 0
        new_student_data["advance_balance"] = 0
        new_student_data["fee_status"] = "Pending"

        res = supabase.table("students").insert(new_student_data).execute()
        return res.data[0]
    except HTTPException as http_ex:
        raise http_ex
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/students/{student_id}/report")
def get_student_report(student_id: int, current_user: dict = Depends(get_current_user)):
    try:
        # 1. Foolproof Security Check: Convert both IDs to strings to ensure they match
        is_admin_or_staff = current_user.get("role") in ["admin", "staff"]
        is_owning_parent = current_user.get("role") == "parent" and str(current_user.get("student_id")) == str(student_id)

        if not (is_admin_or_staff or is_owning_parent):
            raise HTTPException(status_code=403, detail="Access Denied. You can only view your own student's report.")

        # 2. Fetch Data
        student_res = supabase.table("students").select("*").eq("id", student_id).execute()
        if not student_res.data:
            raise HTTPException(status_code=404, detail="Student not found.")

        student_profile = student_res.data[0]
        payments_res = supabase.table("payments").select("*").eq("student_id", student_id).order("payment_date", desc=True).execute()

        total = float(student_profile.get("total_fee", 0))
        paid = float(student_profile.get("paid_amount", 0))
        remaining = max(0.0, total - paid)

        return {
            "profile": student_profile,
            "financial_summary": {
                "total_fee": total,
                "paid_amount": paid,
                "advance_balance": student_profile.get("advance_balance", 0),
                "remaining_dues": remaining,
                "status": student_profile.get("fee_status")
            },
            "payment_history": payments_res.data
        }
    except HTTPException as http_ex:
        raise http_ex
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/register")
def public_student_registration(registration: PublicRegistration):
    # FIX (high): Added explicit HTTPException re-raise so intentional errors
    # (e.g. 400 "Username already exists") are not swallowed by the outer except
    # and incorrectly returned as 500s.
    # NOTE: For production, add rate limiting to this endpoint (e.g. slowapi)
    # to prevent registration spam and username enumeration attacks.
    try:
        # 1. Check if the username is already taken
        user_check = supabase.table("app_users").select("id").eq("username", registration.username).execute()
        if user_check.data:
            raise HTTPException(status_code=400, detail="Username already exists. Please choose another.")

        # 2. Insert the unverified student profile
        student_data = {
            "full_name": registration.full_name,
            "grade_level": registration.grade_level,
            "contact_number": registration.contact_number,
            "mother_name": registration.mother_name,
            "father_name": registration.father_name,
            "total_fee": 50000,  # Default fee, Admin can change this later
            "paid_amount": 0.00,
            "fee_status": "Pending",
            "is_verified": False  # Requires Admin Approval!
        }
        student_res = supabase.table("students").insert(student_data).execute()
        new_student_id = student_res.data[0]["id"]

        # 3. Securely hash the password and create the linked Parent User Account
        # FIX (low): hash_password is now imported at the top of the file
        real_hashed_password = hash_password(registration.password)

        user_data = {
            "username": registration.username,
            "password_hash": real_hashed_password,
            "role": "parent",
            "is_active": True,
            "student_id": new_student_id
        }
        supabase.table("app_users").insert(user_data).execute()

        return {"message": "Registration successful! Pending Admin verification.", "student_id": new_student_id}
    except HTTPException as http_ex:
        raise http_ex
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- 7. TEACHER ROUTES ---
@app.get("/api/teachers")
def get_teachers(current_user: dict = Depends(get_current_user)):
    try:
        response = supabase.table("teachers").select("*").eq("is_active", True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/teachers")
def create_teacher(teacher: TeacherCreate, current_user: dict = Depends(get_current_user)):
    try:
        if current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Access Denied.")
        # FIX (low): Replaced deprecated .dict() with .model_dump() for Pydantic v2
        response = supabase.table("teachers").insert(teacher.model_dump()).execute()
        return {"message": "Teacher successfully added!", "new_teacher": response.data[0]}
    except HTTPException as http_ex:
        raise http_ex
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- 8. FINANCIAL ROUTES (PAYMENTS & RECEIPTS) ---
@app.post("/api/payments")
def create_payment(payment: PaymentCreate, current_user: dict = Depends(get_current_user)):
    try:
        if current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Access Denied.")

        receipt_id = datetime.datetime.now().strftime("RCPT-%Y%m%d%H%M%S")
        student_res = supabase.table("students").select("total_fee, paid_amount").eq("id", payment.student_id).execute()

        if not student_res.data:
            raise HTTPException(status_code=404, detail="Student not found.")

        student = student_res.data[0]
        new_paid_amount = float(student["paid_amount"]) + payment.amount_paid
        new_advance_balance = max(0.0, new_paid_amount - float(student["total_fee"]))
        new_fee_status = "Cleared" if new_paid_amount >= float(student["total_fee"]) else "Pending"

        # FIX (low): Replaced deprecated .dict() with .model_dump() for Pydantic v2
        payment_data = payment.model_dump(exclude_none=True)
        payment_data["receipt_id"] = receipt_id

        new_payment = supabase.table("payments").insert(payment_data).execute()
        supabase.table("students").update({
            "paid_amount": new_paid_amount,
            "advance_balance": new_advance_balance,
            "fee_status": new_fee_status
        }).eq("id", payment.student_id).execute()

        return {
            "message": "Payment processed!",
            "receipt_id": receipt_id,
            "new_student_status": new_fee_status,
            "transaction_details": new_payment.data[0]
        }
    except HTTPException as http_ex:
        raise http_ex
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/receipts/{receipt_id}")
def generate_receipt_pdf(receipt_id: str, current_user: dict = Depends(get_current_user)):
    try:
        if current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Access Denied.")

        payment_res = supabase.table("payments").select("*").eq("receipt_id", receipt_id).execute()
        if not payment_res.data:
            raise HTTPException(status_code=404, detail="Receipt not found.")
        payment_data = payment_res.data[0]

        student_res = supabase.table("students").select("*").eq("id", payment_data["student_id"]).execute()
        # FIX (high): Added missing guard — previously crashed with IndexError if the
        # student record had been deleted, returning an unhelpful 500 instead of a 404.
        if not student_res.data:
            raise HTTPException(status_code=404, detail="Student record not found for this receipt.")
        student_data = student_res.data[0]

        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4

        c.setFont("Helvetica-Bold", 20)
        c.drawCentredString(width / 2.0, height - 50, "LITTLE ANGELS")
        c.setFont("Helvetica", 12)
        c.drawCentredString(width / 2.0, height - 70, "Official Fee Receipt")
        c.line(50, height - 85, width - 50, height - 85)

        c.setFont("Helvetica-Bold", 12)
        c.drawString(50, height - 120, f"Receipt ID: {payment_data['receipt_id']}")
        c.drawString(width - 200, height - 120, f"Date: {payment_data['payment_date'].split('T')[0]}")

        c.setFont("Helvetica", 12)
        c.drawString(50, height - 160, f"Student Name: {student_data['full_name']}")
        c.drawString(50, height - 180, f"Class: {student_data['grade_level']}")
        if student_data.get('contact_number'):
            c.drawString(50, height - 200, f"Contact: {student_data['contact_number']}")

        c.setFont("Helvetica-Bold", 14)
        c.drawString(50, height - 250, "Payment Summary")
        c.line(50, height - 255, 250, height - 255)

        c.setFont("Helvetica", 12)
        c.drawString(50, height - 280, f"Amount Paid: Rs. {payment_data['amount_paid']}")
        c.drawString(50, height - 300, f"Payment Mode: {payment_data['payment_mode']}")

        c.line(50, height - 360, width - 50, height - 360)
        c.drawString(50, height - 390, f"Total Course Fee: Rs. {student_data['total_fee']}")
        c.drawString(50, height - 410, f"Total Paid to Date: Rs. {student_data['paid_amount']}")

        remaining = float(student_data['total_fee']) - float(student_data['paid_amount'])
        if remaining > 0:
            c.setFillColorRGB(0.8, 0, 0)
            c.drawString(50, height - 430, f"Remaining Dues: Rs. {remaining}")
        else:
            c.setFillColorRGB(0, 0.6, 0)
            c.drawString(50, height - 430, f"Advance Balance: Rs. {student_data['advance_balance']}")

        c.showPage()
        c.save()
        buffer.seek(0)

        return StreamingResponse(buffer, media_type="application/pdf", headers={"Content-Disposition": f"inline; filename={receipt_id}.pdf"})
    except HTTPException as http_ex:
        raise http_ex
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))