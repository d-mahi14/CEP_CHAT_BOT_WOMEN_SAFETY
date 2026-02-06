# =====================================================
# PYDANTIC MODELS
# =====================================================
# Data validation models for FastAPI
# =====================================================

from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List
from datetime import datetime

# =====================================================
# USER MODELS
# =====================================================

class UserProfile(BaseModel):
    """User profile information"""
    bio: Optional[str] = None
    location: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    medical_conditions: Optional[List[str]] = None
    allergies: Optional[List[str]] = None
    avatar_url: Optional[str] = None

class UserPreferences(BaseModel):
    """User preferences"""
    language_code: Optional[str] = Field(None, max_length=10)
    language_name: Optional[str] = Field(None, max_length=50)
    notification_enabled: Optional[bool] = True
    location_sharing_enabled: Optional[bool] = False
    emergency_alert_sound: Optional[bool] = True
    data_sharing_consent: Optional[bool] = False
    analytics_consent: Optional[bool] = False
    marketing_consent: Optional[bool] = False
    theme: Optional[str] = Field('light', max_length=20)
    timezone: Optional[str] = Field('Asia/Kolkata', max_length=50)

# =====================================================
# LANGUAGE MODELS
# =====================================================

class Language(BaseModel):
    """Supported language"""
    id: str
    language_code: str
    language_name: str
    native_name: str
    is_active: bool
    display_order: int

class LanguageUpdate(BaseModel):
    """Update user language preference"""
    language_code: str = Field(..., max_length=10)
    language_name: str = Field(..., max_length=50)
    
    @validator('language_code')
    def validate_language_code(cls, v):
        allowed_codes = ['en', 'hi', 'ta', 'te', 'mr', 'bn', 'gu', 'kn', 'ml', 'pa']
        if v not in allowed_codes:
            raise ValueError(f'Language code must be one of: {", ".join(allowed_codes)}')
        return v

# =====================================================
# RESPONSE MODELS
# =====================================================

class SuccessResponse(BaseModel):
    """Standard success response"""
    success: bool = True
    message: str
    data: Optional[dict] = None

class ErrorResponse(BaseModel):
    """Standard error response"""
    success: bool = False
    error: str

# =====================================================
# PROFILE UPDATE MODELS
# =====================================================

class ProfileUpdate(BaseModel):
    """Profile update request"""
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    bio: Optional[str] = None
    location: Optional[str] = Field(None, max_length=255)
    date_of_birth: Optional[str] = None
    gender: Optional[str] = Field(None, max_length=20)
    blood_group: Optional[str] = Field(None, max_length=10)
    medical_conditions: Optional[List[str]] = None
    allergies: Optional[List[str]] = None
    avatar_url: Optional[str] = None

class PreferencesUpdate(BaseModel):
    """Preferences update request"""
    language_code: Optional[str] = Field(None, max_length=10)
    language_name: Optional[str] = Field(None, max_length=50)
    notification_enabled: Optional[bool] = None
    location_sharing_enabled: Optional[bool] = None
    emergency_alert_sound: Optional[bool] = None
    data_sharing_consent: Optional[bool] = None
    analytics_consent: Optional[bool] = None
    marketing_consent: Optional[bool] = None
    theme: Optional[str] = Field(None, max_length=20)
    timezone: Optional[str] = Field(None, max_length=50)
    
    @validator('theme')
    def validate_theme(cls, v):
        if v and v not in ['light', 'dark']:
            raise ValueError('Theme must be either "light" or "dark"')
        return v