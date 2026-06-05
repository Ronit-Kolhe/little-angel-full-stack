import os
from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from supabase import create_client, Client
from dotenv import load_dotenv
import jwt
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from datetime import date
from typing import Optional
import datetime
import io
from fastapi.responses import StreamingResponse
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4

# Import the security helpers we built earlier
from security import verify_password, create_access_token

load_dotenv()

URL = os.environ.get("SUPABASE_URL")
KEY = os.environ.get("SUPABASE_KEY")

if not URL or not KEY:
    raise ValueError("Missing Supabase URL or Key. Please check your .env file.")

supabase: Client = create_client(URL, KEY)

app = FastAPI(title="School Portal API")

# Define what a Login Request looks like using Pydantic
class LoginRequest(BaseModel):
    username: str
    password: str

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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Handles logging in for Admins, Teachers, and Students using Form Data.
    """
    try:
        # 1. Look up the user in Supabase by username (Notice we use form_data.username now)
        response = supabase.table("app_users").select("*").eq("username", form_data.username).execute()
        
        # If user doesn't exist
        if not response.data:
            raise HTTPException(status_code=401, detail="Invalid username or password")
        
        user = response.data[0]
        
        # 2. Check if the user account is active
        if not user.get("is_active"):
            raise HTTPException(status_code=400, detail="User account is deactivated")

        # 3. Verify the typed password against the scrambled database hash (Notice form_data.password)
        is_valid = verify_password(form_data.password, user["password_hash"])
        if not is_valid:
            raise HTTPException(status_code=401, detail="Invalid username or password")

        # 4. Password is correct! Issue a secure JWT token badge...
        token_data = {
            "user_id": user["id"],
            "username": user["username"],
            "role": user["role"],
            "student_id": user.get("student_id"),
            "teacher_id": user.get("teacher_id")
        }
        
        token = create_access_token(data=token_data)

        # 5. Send the token back to the user's browser
        return {
            "access_token": token,
            "token_type": "bearer",
            "role": user["role"],
            "username": user["username"]
        }

    except HTTPException as http_ex:
        raise http_ex
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

def get_current_user(token: str = Depends(oauth2_scheme)):
    """
    The 'Security Guard'. This runs automatically on protected routes.
    It intercepts the user's token badge, decodes it, and checks if it's fake or expired.
    """
    try:
        # Grab the secret key to decode the badge
        secret = os.environ.get("JWT_SECRET_KEY")
        # Decode the token
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        
        # If successful, return the user's data (like their role and username)
        return payload 
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired. Please log in again.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token.")

# Define what data is required to create a new student
class StudentCreate(BaseModel):
    full_name: str
    grade_level: str
    fee_status: str = "Pending"
    contact_number: Optional[str] = None
    mother_name: Optional[str] = None
    father_name: Optional[str] = None
    dob: Optional[date] = None
    address: Optional[str] = None
    custom_notes: Optional[str] = None
    total_fee: float = 0.00
    paid_amount: float = 0.00
    advance_balance: float = 0.00  # If they don't provide a status, it defaults to Pending
# Define what data is required to create a new teacher
class TeacherCreate(BaseModel):
    full_name: str
    subject: str
    is_active: bool = True  # Defaults to True for new hires
class PaymentCreate(BaseModel):
    student_id: int
    amount_paid: float
    payment_mode: str  # Cash, Online, Cheque
    installment_number: Optional[int] = None
    late_fee_charged: float = 0.00
# 2. A protected route! Notice the `Depends(get_current_user)` part.
@app.get("/api/dashboard")
def get_secure_dashboard(current_user: dict = Depends(get_current_user)):
    """
    This endpoint is locked. You CANNOT enter without a valid token.
    """
    # We can use the decoded token data to customize the response!
    if current_user["role"] == "admin":
        secret_data = "Here is the sensitive financial data for the school."
    else:
        secret_data = "Here is your basic user dashboard."

    return {
        "message": f"Access Granted! Welcome {current_user['username']}.",
        "your_role": current_user["role"],
        "secret_data": secret_data
    }
@app.get("/api/teachers")
def get_teachers(current_user: dict = Depends(get_current_user)):
    """
    Fetch a list of all active teachers. 
    Protected route: Requires a valid login token.
    """
    try:
        # Ask Supabase for all rows where is_active is True
        response = supabase.table("teachers").select("*").eq("is_active", True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/students")
def get_students(current_user: dict = Depends(get_current_user)):
    """
    Fetch a list of all students.
    Protected route: Requires a valid login token.
    """
    try:
        # Ask Supabase for all student rows
        response = supabase.table("students").select("*").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/api/students")
def create_student(student: StudentCreate, current_user: dict = Depends(get_current_user)):
    """
    Add a brand-new student to the database with full profile and fee data.
    Protected route: Requires a valid login token AND Admin role.
    """
    try:
        # 1. Security Check
        if current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Access Denied: Admin privileges required.")
        
        # 2. Convert the incoming data to a dictionary
        # exclude_none=True ensures we don't send empty 'null' values to the database if not provided
        new_student_data = student.dict(exclude_none=True)
        
        # Convert the date object to a string format the database understands, if a dob was provided
        if "dob" in new_student_data:
            new_student_data["dob"] = new_student_data["dob"].isoformat()
        
        # 3. Insert into Supabase
        response = supabase.table("students").insert(new_student_data).execute()
        
        return {
            "message": "Student successfully registered!",
            "new_student": response.data[0]
        }
    except HTTPException as http_ex:
        raise http_ex
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/api/teachers")
def create_teacher(teacher: TeacherCreate, current_user: dict = Depends(get_current_user)):
    """
    Add a brand-new teacher to the database.
    Protected route: Requires a valid login token.
    """
    try:
        if current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Access Denied: Admin privileges required.")
        new_teacher_data = {
            "full_name": teacher.full_name,
            "subject": teacher.subject,
            "is_active": teacher.is_active
        }
        
        response = supabase.table("teachers").insert(new_teacher_data).execute()
        
        return {
            "message": "Teacher successfully added!",
            "new_teacher": response.data[0]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/payments")
def create_payment(payment: PaymentCreate, current_user: dict = Depends(get_current_user)):
    """
    Process a new fee payment, generate a receipt, and recalculate student balances.
    Protected route: Requires Admin privileges.
    """
    try:
        # 1. Security Check
        if current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Access Denied: Admin privileges required.")
        
        # 2. Generate a Unique Receipt ID (e.g., RCPT-20260605143000)
        receipt_id = datetime.datetime.now().strftime("RCPT-%Y%m%d%H%M%S")
        
        # 3. Fetch the student's current financial data
        student_res = supabase.table("students").select("total_fee, paid_amount").eq("id", payment.student_id).execute()
        
        if not student_res.data:
            raise HTTPException(status_code=404, detail="Student not found in database.")
            
        student = student_res.data[0]
        
        # 4. The Math Engine: Calculate new balances
        old_paid = float(student["paid_amount"])
        total_fee = float(student["total_fee"])
        
        new_paid_amount = old_paid + payment.amount_paid
        
        # If they paid more than the total fee, store the extra as an advance
        new_advance_balance = max(0.0, new_paid_amount - total_fee)
        
        # Did they clear their dues?
        new_fee_status = "Cleared" if new_paid_amount >= total_fee else "Pending"
        
        # 5. Save the Receipt to the Payments Ledger
        payment_data = payment.dict(exclude_none=True)
        payment_data["receipt_id"] = receipt_id
        
        new_payment = supabase.table("payments").insert(payment_data).execute()
        
        # 6. Update the Student's Master Profile with the new math
        supabase.table("students").update({
            "paid_amount": new_paid_amount,
            "advance_balance": new_advance_balance,
            "fee_status": new_fee_status
        }).eq("id", payment.student_id).execute()
        
        # 7. Hand the finalized data back to the user
        return {
            "message": "Payment successfully processed!",
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
    """
    Generate an A4 PDF receipt on the fly and stream it to the browser.
    Protected route: Requires Admin privileges.
    """
    try:
        # 1. Security Check
        if current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Access Denied.")

        # 2. Fetch Payment Data
        payment_res = supabase.table("payments").select("*").eq("receipt_id", receipt_id).execute()
        if not payment_res.data:
            raise HTTPException(status_code=404, detail="Receipt not found.")
        payment_data = payment_res.data[0]

        # 3. Fetch Associated Student Data
        student_res = supabase.table("students").select("*").eq("id", payment_data["student_id"]).execute()
        student_data = student_res.data[0]

        # 4. Create an in-memory buffer to hold the PDF
        buffer = io.BytesIO()
        
        # 5. Draw the PDF using ReportLab
        c = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4

        # --- DRAW HEADER ---
        c.setFont("Helvetica-Bold", 20)
        c.drawCentredString(width / 2.0, height - 50, "Mangalam Engineering School")
        c.setFont("Helvetica", 12)
        c.drawCentredString(width / 2.0, height - 70, "Official Fee Receipt")
        c.line(50, height - 85, width - 50, height - 85)

        # --- DRAW RECEIPT DETAILS ---
        c.setFont("Helvetica-Bold", 12)
        c.drawString(50, height - 120, f"Receipt ID: {payment_data['receipt_id']}")
        # Format the timestamp nicely
        date_str = payment_data['payment_date'].split('T')[0]
        c.drawString(width - 200, height - 120, f"Date: {date_str}")

        # --- DRAW STUDENT DETAILS ---
        c.setFont("Helvetica", 12)
        c.drawString(50, height - 160, f"Student Name: {student_data['full_name']}")
        c.drawString(50, height - 180, f"Class: {student_data['grade_level']}")
        if student_data.get('contact_number'):
            c.drawString(50, height - 200, f"Contact: {student_data['contact_number']}")

        # --- DRAW PAYMENT DETAILS ---
        c.setFont("Helvetica-Bold", 14)
        c.drawString(50, height - 250, "Payment Summary")
        c.line(50, height - 255, 250, height - 255)

        c.setFont("Helvetica", 12)
        c.drawString(50, height - 280, f"Amount Paid: Rs. {payment_data['amount_paid']}")
        c.drawString(50, height - 300, f"Payment Mode: {payment_data['payment_mode']}")
        
        if payment_data['installment_number']:
            c.drawString(50, height - 320, f"Installment No: {payment_data['installment_number']}")

        # --- DRAW CURRENT BALANCES ---
        c.line(50, height - 360, width - 50, height - 360)
        c.drawString(50, height - 390, f"Total Course Fee: Rs. {student_data['total_fee']}")
        c.drawString(50, height - 410, f"Total Paid to Date: Rs. {student_data['paid_amount']}")
        
        # Calculate remaining
        remaining = float(student_data['total_fee']) - float(student_data['paid_amount'])
        if remaining > 0:
            c.setFillColorRGB(0.8, 0, 0) # Red for pending
            c.drawString(50, height - 430, f"Remaining Dues: Rs. {remaining}")
        else:
            c.setFillColorRGB(0, 0.6, 0) # Green for advance
            c.drawString(50, height - 430, f"Advance Balance: Rs. {student_data['advance_balance']}")

        # --- FINALIZE PDF ---
        c.showPage()
        c.save()

        # 6. Reset buffer pointer to the beginning
        buffer.seek(0)

        # 7. Stream the PDF to the browser
        # "inline" tells the browser to view it in a tab. (Use "attachment" to force download)
        return StreamingResponse(
            buffer, 
            media_type="application/pdf", 
            headers={"Content-Disposition": f"inline; filename={receipt_id}.pdf"}
        )

    except HTTPException as http_ex:
        raise http_ex
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/api/analytics")
def get_dashboard_analytics(current_user: dict = Depends(get_current_user)):
    """
    Fetch school-wide analytics and the recent payment ledger for the dashboard.
    Protected route: Requires a valid login token.
    """
    try:
        # 1. Fetch all student financial data
        student_res = supabase.table("students").select("fee_status, total_fee, paid_amount").execute()
        students = student_res.data

        # 2. Initialize our mathematical counters
        total_students = len(students)
        fees_cleared_count = 0
        fees_pending_count = 0
        total_collected = 0.0
        total_pending = 0.0

        # 3. Crunch the numbers row by row
        for student in students:
            total_collected += float(student.get("paid_amount", 0))
            
            # Count statuses
            if student.get("fee_status") == "Cleared":
                fees_cleared_count += 1
            else:
                fees_pending_count += 1
                
            # Calculate how much money is still owed
            remaining = float(student.get("total_fee", 0)) - float(student.get("paid_amount", 0))
            if remaining > 0:
                total_pending += remaining

        # 4. Fetch the 10 most recent payments for the Activity Ledger
        # The 'students(full_name)' syntax tells Supabase to automatically follow the foreign key and grab the name!
        ledger_res = supabase.table("payments").select(
            "id, receipt_id, amount_paid, payment_mode, payment_date, students(full_name, grade_level)"
        ).order("payment_date", desc=True).limit(10).execute()

        # 5. Package everything perfectly for the React frontend
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