import os
from datetime import datetime, timedelta
from typing import Optional
import jwt
from passlib.context import CryptContext
from dotenv import load_dotenv

load_dotenv()

# 1. Setup the password hashing engine (using bcrypt)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# 2. Get a secret key to sign our JWT tokens 
# (If no key is in .env, it defaults to a temporary string)
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "super_secret_school_key_change_me_in_production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60  # Logins last for 1 hour

def hash_password(password: str) -> str:
    """Takes a plain text password and returns a secure, unreadable hash."""
    # Force truncation to 72 bytes to prevent bcrypt crashes
    return pwd_context.hash(password[:72])

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Compares a typed password with the scrambled hash in the database."""
    # Force truncation to 72 bytes to prevent bcrypt crashes
    return pwd_context.verify(plain_password[:72], hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Generates a secure digital badge (JWT token) containing the user's role and ID."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # Add an expiration timestamp to the token data
    to_encode.update({"exp": expire})
    
    # Sign the token using our secret key
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


