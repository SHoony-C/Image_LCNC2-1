# Authentication and SSO Configuration

# OAuth/SSO Configuration
IDP_Config = {
    # Auth server URL (replace with actual URL)
    'Idp.AuthUrl': 'https://your-auth-server/oauth2/authorize',
    
    # Sign out URL
    'Idp.SignoutUrl': 'https://your-auth-server/oauth2/logout',
    
    # Certificate file details for JWT verification
    'CertFile_Path': './certs/',
    'CertFile_Name': 'public_key.pem',
    
    # Client settings
    'ClientId': 'your-client-id',
    'RedirectUri': 'https://10.166.248.21/acs',
    
    # Scopes
    'Scopes': 'openid profile',
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