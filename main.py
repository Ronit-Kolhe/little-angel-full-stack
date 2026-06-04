import os
from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from supabase import create_client, Client
from dotenv import load_dotenv
import jwt
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm

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