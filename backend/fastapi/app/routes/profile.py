# =====================================================
# PROFILE ROUTES - FASTAPI
# =====================================================
# User profile management endpoints
# =====================================================

from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from app.models import ProfileUpdate, SuccessResponse, ErrorResponse
from app.utils.supabase import get_supabase_client
from app.utils.encryption import decrypt_phone_number

router = APIRouter(prefix="/api/v1/profile", tags=["Profile"])

def verify_token(authorization: str) -> str:
    """
    Verify JWT token and return user ID
    """
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = authorization[7:]  # Remove 'Bearer ' prefix
    
    try:
        supabase = get_supabase_client()
        user = supabase.auth.get_user(token)
        
        if not user or not user.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        
        return user.user.id
    except Exception as e:
        raise HTTPException(status_code=401, detail="Authentication failed")

@router.get("/{user_id}")
async def get_profile(
    user_id: str,
    authorization: str = Header(None)
):
    """
    Get user profile
    
    Args:
        user_id: User ID
        authorization: Bearer token
        
    Returns:
        User profile data
    """
    # Verify token
    authenticated_user_id = verify_token(authorization)
    
    # Verify user is accessing their own profile
    if authenticated_user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        supabase = get_supabase_client()
        
        # Get user data
        user_result = supabase.table('users').select('*').eq('user_id', user_id).single().execute()
        
        if not user_result.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_data = user_result.data
        
        # Get profile data
        profile_result = supabase.table('user_profiles').select('*').eq('user_id', user_id).single().execute()
        profile_data = profile_result.data if profile_result.data else {}
        
        # Get preferences
        prefs_result = supabase.table('user_preferences').select('*').eq('user_id', user_id).single().execute()
        preferences = prefs_result.data if prefs_result.data else {}
        
        # Decrypt phone number
        phone_number = None
        if user_data.get('phone_number_encrypted') and user_data.get('phone_number_iv'):
            try:
                phone_number = decrypt_phone_number(
                    user_data['phone_number_encrypted'],
                    user_data['phone_number_iv'],
                    user_data.get('phone_number_auth_tag', '')
                )
            except Exception as e:
                print(f"Failed to decrypt phone number: {e}")
        
        return {
            "success": True,
            "data": {
                "user": {
                    "id": user_id,
                    "full_name": user_data.get('full_name'),
                    "phone_number": phone_number,
                    "is_active": user_data.get('is_active'),
                    "created_at": user_data.get('created_at'),
                    "last_login": user_data.get('last_login')
                },
                "profile": profile_data,
                "preferences": preferences
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get profile error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get profile")

@router.put("/{user_id}")
async def update_profile(
    user_id: str,
    profile_update: ProfileUpdate,
    authorization: str = Header(None)
):
    """
    Update user profile
    
    Args:
        user_id: User ID
        profile_update: Profile update data
        authorization: Bearer token
        
    Returns:
        Updated profile data
    """
    # Verify token
    authenticated_user_id = verify_token(authorization)
    
    # Verify user is updating their own profile
    if authenticated_user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        supabase = get_supabase_client()
        
        # Update full name in users table if provided
        if profile_update.full_name:
            supabase.table('users').update({
                'full_name': profile_update.full_name
            }).eq('user_id', user_id).execute()
        
        # Prepare profile update
        profile_data = {}
        if profile_update.bio is not None:
            profile_data['bio'] = profile_update.bio
        if profile_update.location is not None:
            profile_data['location'] = profile_update.location
        if profile_update.date_of_birth is not None:
            profile_data['date_of_birth'] = profile_update.date_of_birth
        if profile_update.gender is not None:
            profile_data['gender'] = profile_update.gender
        if profile_update.blood_group is not None:
            profile_data['blood_group'] = profile_update.blood_group
        if profile_update.medical_conditions is not None:
            profile_data['medical_conditions'] = profile_update.medical_conditions
        if profile_update.allergies is not None:
            profile_data['allergies'] = profile_update.allergies
        if profile_update.avatar_url is not None:
            profile_data['avatar_url'] = profile_update.avatar_url
        
        # Update profile if there's data to update
        updated_profile = None
        if profile_data:
            result = supabase.table('user_profiles').update(profile_data).eq('user_id', user_id).execute()
            updated_profile = result.data[0] if result.data else None
        
        # Log audit event
        supabase.table('audit_logs').insert({
            'user_id': user_id,
            'action': 'profile_updated',
            'resource_type': 'user_profile',
            'resource_id': user_id,
            'metadata': {'updated_fields': list(profile_data.keys())}
        }).execute()
        
        return {
            "success": True,
            "message": "Profile updated successfully",
            "data": {
                "profile": updated_profile
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Update profile error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update profile")