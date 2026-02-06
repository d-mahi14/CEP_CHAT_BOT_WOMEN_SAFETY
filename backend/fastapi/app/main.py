# =====================================================
# MAIN FASTAPI APPLICATION
# =====================================================
# FastAPI server for Safety App
# Handles profile and language management
# =====================================================

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn

from app.config import settings
from app.utils.supabase import test_connection
from app.routes import profile, language

# =====================================================
# LIFESPAN EVENTS
# =====================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan events for startup and shutdown
    """
    # Startup
    print("🔄 Testing Supabase connection...")
    connected = await test_connection()
    
    if not connected:
        print("❌ Failed to connect to Supabase")
    
    print("")
    print("=" * 50)
    print("🚀 Safety App FastAPI Backend Server")
    print("=" * 50)
    print(f"📡 Server running on: http://localhost:{settings.FASTAPI_PORT}")
    print(f"🌍 Environment: {settings.ENVIRONMENT}")
    print(f"📚 API Docs: http://localhost:{settings.FASTAPI_PORT}/docs")
    print(f"🔧 ReDoc: http://localhost:{settings.FASTAPI_PORT}/redoc")
    print("=" * 50)
    print("")
    
    yield
    
    # Shutdown
    print("👋 Shutting down FastAPI server...")

# =====================================================
# APPLICATION INITIALIZATION
# =====================================================

app = FastAPI(
    title="Safety App API",
    description="FastAPI backend for Safety App with profile and language management",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# =====================================================
# MIDDLEWARE
# =====================================================

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================
# ROUTES
# =====================================================

# Include routers
app.include_router(profile.router)
app.include_router(language.router)

# =====================================================
# ROOT ENDPOINTS
# =====================================================

@app.get("/")
async def root():
    """
    Root endpoint with API information
    """
    return {
        "success": True,
        "message": "Welcome to Safety App FastAPI Backend",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc",
        "endpoints": {
            "profile": {
                "get": "GET /api/v1/profile/{user_id}",
                "update": "PUT /api/v1/profile/{user_id}"
            },
            "language": {
                "list": "GET /api/v1/languages",
                "getUserLanguage": "GET /api/v1/user/{user_id}/language",
                "updateUserLanguage": "PUT /api/v1/user/{user_id}/language"
            }
        }
    }

@app.get("/health")
async def health_check():
    """
    Health check endpoint
    """
    return {
        "success": True,
        "status": "healthy",
        "service": "safety-app-fastapi",
        "environment": settings.ENVIRONMENT
    }

# =====================================================
# ERROR HANDLERS
# =====================================================

@app.exception_handler(404)
async def not_found_handler(request, exc):
    """
    Handle 404 errors
    """
    return {
        "success": False,
        "error": "Route not found",
        "path": str(request.url)
    }

@app.exception_handler(500)
async def internal_error_handler(request, exc):
    """
    Handle 500 errors
    """
    return {
        "success": False,
        "error": "Internal server error"
    }

# =====================================================
# RUN SERVER
# =====================================================

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.FASTAPI_PORT,
        reload=settings.DEBUG
    )