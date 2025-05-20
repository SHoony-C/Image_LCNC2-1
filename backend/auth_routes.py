from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from fastapi.responses import RedirectResponse
from typing import Dict, Any, Optional
import uuid
from jose import jwt
import json
from datetime import datetime, timedelta
from cryptography.hazmat.primitives import serialization
import x509
from cryptography.hazmat.backends import default_backend
from pymongo import MongoClient
from auth_models import SSOModel, User, UserCreate, Token
from config import IDP_Config, MONGODB_SETTINGS, AUTH_SETTINGS

# MongoDB connection
client = MongoClient(f"mongodb://{MONGODB_SETTINGS['HOST']}:{MONGODB_SETTINGS['PORT']}")
db = client[MONGODB_SETTINGS['DATABASE']]
users_collection = db[MONGODB_SETTINGS['AUTH_COLLECTION']]
roles_collection = db[MONGODB_SETTINGS['ROLES_COLLECTION']]

router = APIRouter()

def create_access_token(user_id: str):
    """Create JWT access token for authenticated user"""
    access_token_expires = timedelta(minutes=AUTH_SETTINGS['TOKEN_EXPIRE_MINUTES'])
    expire = datetime.utcnow() + access_token_expires
    to_encode = {
        "sub": user_id,
        "exp": expire
    }
    encoded_jwt = jwt.encode(to_encode, AUTH_SETTINGS['SECRET_KEY'], algorithm=AUTH_SETTINGS['ALGORITHM'])
    return encoded_jwt, int(access_token_expires.total_seconds())


@router.get("/auth_sh")
async def auth_redirect():
    """Redirect to SSO authentication server"""
    response = Response()
    
    # Caching prevention
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    response.headers["ETag"] = ""
    
    nonce = str(uuid.uuid4())
    client_request_id = str(uuid.uuid4())
    
    # Build OAuth authorization URL
    url = f"{IDP_Config['Idp.AuthUrl']}/?client_id={IDP_Config['ClientId']}"
    url += f"&redirect_uri={IDP_Config['RedirectUri']}"
    url += "&response_mode=form_post&response_type=code+id_token"
    url += f"&scope={IDP_Config['Scopes']}"
    url += f"&nonce={nonce}"
    url += f"&client-request-id={client_request_id}&pullStatus=0"
    
    print(f'\n\nURL 정보 : {url}\n\n')
    
    response = RedirectResponse(url=url)
    return response


@router.post('/acs')
async def acs(request: Request, form_data: SSOModel = Depends()):
    """Handle SSO callback with JWT token validation"""
    print('\nacs 진입\n')
    
    try:
        # Load public key for JWT verification
        with open(IDP_Config['CertFile_Path'] + IDP_Config['CertFile_Name'], "rb") as f:
            public_key = serialization.load_pem_public_key(f.read())
        
        id_token_val = form_data.id_token
        b_token = id_token_val.encode()
        
        header = jwt.get_unverified_header(b_token)
        print(f"JWT Header: {header}")
        
        # Decode and verify JWT token
        decode = jwt.decode(
            jwt=b_token,
            key=public_key,
            verify=True,
            algorithms='RS256',
            options={
                'verify_signature': True,
                'verify_exp': True,
                'verify_nbf': False,
                'verify_aud': False,
                "verify_iat": False
            }
        )
        
        json_str = json.dumps(decode)
        claim_val = json.loads(json_str)
        
        # Get user information from claims
        user_email = claim_val.get("email")
        user_name = claim_val.get("name", "").split(" ")[0]  # First name
        upn = claim_val.get("upn", "")  # User Principal Name
        
        # Create or update user in database
        user = users_collection.find_one({"username": upn})
        
        if not user:
            # Create new user if not exists
            user_id = str(uuid.uuid4())
            new_user = {
                "id": user_id,
                "username": upn,
                "email": user_email,
                "full_name": claim_val.get("name", ""),
                "sso_id": claim_val.get("oid", ""),  # Object ID from SSO
                "is_active": True,
                "created_at": datetime.utcnow()
            }
            
            users_collection.insert_one(new_user)
            
            # Assign default user role
            roles_collection.insert_one({
                "user_id": user_id,
                "role": "user",
                "assigned_at": datetime.utcnow()
            })
            
            user = new_user
        
        # Create access token
        access_token, expires_in = create_access_token(user["id"])
        
        # Store token in session
        frontend_url = f"/main?token={access_token}&user_id={user['id']}"
        
        # Redirect to frontend with access token
        return RedirectResponse(url=frontend_url, status_code=303)
        
    except Exception as e:
        print(f"Error in SSO authentication: {str(e)}")
        # Redirect to login page with error
        return RedirectResponse(url="/main?error=auth_failed", status_code=303)


@router.get('/slo')
async def slo():
    """Sign out from SSO"""
    idp_url = IDP_Config['Idp.SignoutUrl']
    response = RedirectResponse(url=idp_url)
    return response


@router.get("/check-auth")
async def check_auth(token: str = None):
    """Validate authentication token"""
    if not token:
        return {"authenticated": False}
    
    try:
        # Verify JWT token
        payload = jwt.decode(
            token,
            AUTH_SETTINGS['SECRET_KEY'],
            algorithms=[AUTH_SETTINGS['ALGORITHM']]
        )
        
        user_id = payload.get("sub")
        
        if not user_id:
            return {"authenticated": False}
        
        # Get user from database
        user = users_collection.find_one({"id": user_id})
        
        if not user:
            return {"authenticated": False}
        
        # Get user roles
        roles = []
        for role in roles_collection.find({"user_id": user_id}):
            roles.append(role["role"])
        
        return {
            "authenticated": True,
            "user": {
                "id": user["id"],
                "username": user["username"],
                "email": user.get("email"),
                "full_name": user.get("full_name"),
                "roles": roles
            }
        }
    except:
        return {"authenticated": False} 