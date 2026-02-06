# =====================================================
# SUPABASE CLIENT UTILITY
# =====================================================
# Supabase client for FastAPI backend
# =====================================================

from supabase import create_client, Client
from app.config import settings

# Initialize Supabase client
supabase: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_KEY
)

async def test_connection() -> bool:
    """
    Test Supabase database connection
    """
    try:
        result = supabase.table('supported_languages').select('count').execute()
        print('✅ Supabase connection successful')
        return True
    except Exception as e:
        print(f'❌ Supabase connection failed: {str(e)}')
        return False

def get_supabase_client() -> Client:
    """
    Get Supabase client instance
    """
    return supabase