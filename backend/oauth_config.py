"""
Google OAuth Configuration for LCNC App
"""
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Google OAuth settings
GOOGLE_OAUTH_SETTINGS = {
    'CLIENT_ID': os.getenv('GOOGLE_CLIENT_ID', 'auth_google_iapp_test'),
    'CLIENT_SECRET': os.getenv('GOOGLE_CLIENT_SECRET', '844891853332-s785qgm7br1io04pbvtpsic4kqce8d7o.apps.googleusercontent.com'),
    'REDIRECT_URI': os.getenv('GOOGLE_REDIRECT_URI', 'http://localhost:8000/api/auth/acs'),
    'SCOPE': 'openid email profile',
    'RESPONSE_TYPE': 'code',
    'AUTH_URI': 'https://accounts.google.com/o/oauth2/auth',
    'TOKEN_URI': 'https://oauth2.googleapis.com/token',
    'USER_INFO_URI': 'https://www.googleapis.com/oauth2/v3/userinfo',
} 