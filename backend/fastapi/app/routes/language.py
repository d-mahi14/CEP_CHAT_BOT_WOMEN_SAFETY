# =====================================================
# LANGUAGE ROUTES - FASTAPI
# =====================================================
# Language selection and management endpoints
# =====================================================

from fastapi import APIRouter, HTTPException, Header
from typing import List
from app.models import LanguageUpdate, Language
from app.utils.supabase import get_supabase_client

router = APIRouter(prefix="/api/v1", tags=["Language"])

def verify_token(authorization: str) -> str:
    """Verify JWT token and return user ID"""
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = authorization[7:]
    
    try:
        supabase = get_supabase_client()
        user = supabase.auth.get_user(token)
        
        if not user or not user.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        
        return user.user.id
    except Exception as e:
        raise HTTPException(status_code=401, detail="Authentication failed")

@router.get("/languages", response_model=dict)
async def get_languages():
    """
    Get all supported languages
    
    Returns:
        List of supported languages
    """
    try:
        supabase = get_supabase_client()
        
        result = supabase.table('supported_languages').select('*').eq('is_active', True).order('display_order').execute()
        
        languages = []
        for lang in result.data:
            languages.append({
                'id': lang['id'],
                'language_code': lang['language_code'],
                'language_name': lang['language_name'],
                'native_name': lang['native_name'],
                'is_active': lang['is_active'],
                'display_order': lang['display_order']
            })
        
        return {
            "success": True,
            "data": {
                "languages": languages
            }
        }
        
    except Exception as e:
        print(f"Get languages error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get languages")

@router.put("/user/{user_id}/language")
async def update_user_language(
    user_id: str,
    language_update: LanguageUpdate,
    authorization: str = Header(None)
):
    """
    Update user's language preference
    
    Args:
        user_id: User ID
        language_update: Language update data
        authorization: Bearer token
        
    Returns:
        Updated preferences
    """
    # Verify token
    authenticated_user_id = verify_token(authorization)
    
    # Verify user is updating their own language
    if authenticated_user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        supabase = get_supabase_client()
        
        # Verify language code exists
        lang_result = supabase.table('supported_languages').select('*').eq('language_code', language_update.language_code).eq('is_active', True).single().execute()
        
        if not lang_result.data:
            raise HTTPException(status_code=400, detail="Invalid language code")
        
        # Update user preferences
        result = supabase.table('user_preferences').update({
            'language_code': language_update.language_code,
            'language_name': language_update.language_name
        }).eq('user_id', user_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="User preferences not found")
        
        # Log audit event
        supabase.table('audit_logs').insert({
            'user_id': user_id,
            'action': 'language_updated',
            'resource_type': 'user_preferences',
            'resource_id': user_id,
            'metadata': {
                'language_code': language_update.language_code,
                'language_name': language_update.language_name
            }
        }).execute()
        
        return {
            "success": True,
            "message": "Language updated successfully",
            "data": {
                "preferences": result.data[0]
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Update language error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update language")

@router.get("/user/{user_id}/language")
async def get_user_language(
    user_id: str,
    authorization: str = Header(None)
):
    """
    Get user's current language preference
    
    Args:
        user_id: User ID
        authorization: Bearer token
        
    Returns:
        User's language preference
    """
    # Verify token
    authenticated_user_id = verify_token(authorization)
    
    # Verify user is accessing their own data
    if authenticated_user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        supabase = get_supabase_client()
        
        result = supabase.table('user_preferences').select('language_code, language_name').eq('user_id', user_id).single().execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="User preferences not found")
        
        return {
            "success": True,
            "data": {
                "language": {
                    "language_code": result.data['language_code'],
                    "language_name": result.data['language_name']
                }
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get user language error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get user language")