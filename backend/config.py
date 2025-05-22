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

# MongoDB settings
MONGODB_SETTINGS = {
    'HOST': 'localhost',
    'PORT': 27017,
    'DATABASE': 'lcnc',
    'AUTH_COLLECTION': 'auth_users',
    'ROLES_COLLECTION': 'user_roles',
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