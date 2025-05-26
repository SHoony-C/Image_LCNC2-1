# Authentication and SSO Configuration

# OAuth/SSO Configuration
IDP_Config = {
    'ClientId': '844891853332-s785qgm7br1io04pbvtpsic4kqce8d7o.apps.googleusercontent.com',  # Google OAuth Client ID
    'ClientSecret': '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',  # Google OAuth Client Secret
    'RedirectUri': 'http://localhost:8000/api/auth/acs',  # Callback URL
    'AuthorizeUrl': 'https://accounts.google.com/o/oauth2/v2/auth',  # Google OAuth endpoint
    'Idp.AuthUrl': 'https://accounts.google.com/o/oauth2/v2/auth',  # Google OAuth endpoint
    'Idp.SignoutUrl': 'https://accounts.google.com/logout',  # Google logout URL
    'CertFile_Path': './certificates/',  # Directory where certificates are stored
    'CertFile_Name': 'public_key.pem',  # Public key file name for JWT verification
    'Frontend_Redirect_Uri': 'http://localhost:8080/',  # Frontend URL to redirect after auth
    'Scopes': 'openid email profile',  # OAuth scopes
    'ResponseType': 'id_token token',  # OAuth response type
}

# Authentication settings
AUTH_SETTINGS = {
    'SECRET_KEY': 'your-secret-key-here',
    'TOKEN_EXPIRE_MINUTES': 60,
    'REFRESH_TOKEN_EXPIRE_DAYS': 7,
    'ALGORITHM': 'HS256',
}

# 관리자 권한이 부여될 이메일 도메인 리스트
# 이 도메인의 이메일로 SSO 로그인 시 자동으로 admin 권한 부여
ADMIN_DOMAINS = [
    "admin.com",
    "admin.org",
    # "gmail.com",  # 테스트를 위해 gmail.com 추가 (실제 운영 환경에서는 제거 필요)
    "example.com"
]

# MongoDB settings
MONGODB_SETTINGS = {
    'HOST': 'localhost',
    'PORT': 27017,
    'DATABASE': 'lcnc',
    'lcnc_COLLECTION': 'lcnc_result',    
}

# Available user roles
USER_ROLES = ['admin', 'manager', 'user']

# MySQL settings for SQL database
MYSQL_SETTINGS = {
    'HOST': 'localhost',
    'PORT': 3306,
    'USER': 'root',
    'PASSWORD': 'root',
    'DATABASE': 'lcnc_app',
    'CHARSET': 'utf8mb4'
} 