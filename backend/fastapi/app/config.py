# =====================================================
# FASTAPI CONFIGURATION
# =====================================================
# Configuration settings for FastAPI application
# Loads environment variables and validates them
# =====================================================

import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Settings(BaseSettings):
    """
    Application settings loaded from environment variables
    """
    # Supabase configuration
    SUPABASE_URL: str = os.getenv('SUPABASE_URL', '')
    SUPABASE_KEY: str = os.getenv('SUPABASE_KEY', '')
    
    # Encryption configuration
    ENCRYPTION_KEY: str = os.getenv('ENCRYPTION_KEY', '')
    
    # Server configuration
    FASTAPI_PORT: int = int(os.getenv('FASTAPI_PORT', '8000'))
    API_VERSION: str = 'v1'
    
    # CORS configuration
    ALLOWED_ORIGINS: list = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
    ]
    
    # Environment
    ENVIRONMENT: str = os.getenv('ENVIRONMENT', 'development')
    DEBUG: bool = os.getenv('DEBUG', 'True').lower() == 'true'
    
    class Config:
        env_file = '.env'
        case_sensitive = True

    def validate_settings(self):
        """
        Validate that all required settings are present
        """
        errors = []
        
        if not self.SUPABASE_URL:
            errors.append('SUPABASE_URL is not set')
        
        if not self.SUPABASE_KEY:
            errors.append('SUPABASE_KEY is not set')
        
        if not self.ENCRYPTION_KEY:
            errors.append('ENCRYPTION_KEY is not set')
        elif len(self.ENCRYPTION_KEY) != 64:  # 32 bytes in hex = 64 characters
            errors.append('ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
        
        if errors:
            raise ValueError(f"Configuration errors: {', '.join(errors)}")
        
        return True

# Create settings instance
settings = Settings()

# Validate on import
try:
    settings.validate_settings()
    print("✅ Configuration validated successfully")
except ValueError as e:
    print(f"❌ Configuration validation failed: {e}")
    raise