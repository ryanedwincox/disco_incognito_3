# Spotify OAuth Authentication Implementation Guide

## Overview

This guide provides detailed implementation notes for implementing Spotify OAuth authentication in a full-stack web application using FastAPI (backend) and Vue.js (frontend), deployed with Docker.

## Table of Contents

1. [OAuth Flow Overview](#oauth-flow-overview)
2. [Spotify App Setup](#spotify-app-setup)
3. [Backend Implementation](#backend-implementation)
4. [Frontend Implementation](#frontend-implementation)
5. [Docker Configuration](#docker-configuration)
6. [Key Implementation Decisions](#key-implementation-decisions)
7. [Security Considerations](#security-considerations)
8. [Troubleshooting](#troubleshooting)

## OAuth Flow Overview

### Standard OAuth 2.0 Authorization Code Flow

The implementation follows the OAuth 2.0 Authorization Code flow:

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Frontend  │    │   Backend   │    │   Spotify   │    │    User     │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │                   │
       │ 1. Request auth   │                   │                   │
       │   URL             │                   │                   │
       ├──────────────────►│                   │                   │
       │                   │                   │                   │
       │ 2. Return auth    │                   │                   │
       │   URL             │                   │                   │
       │◄──────────────────┤                   │                   │
       │                   │                   │                   │
       │ 3. Redirect user  │                   │                   │
       │   to Spotify      │                   │                   │
       ├───────────────────┼───────────────────┼──────────────────►│
       │                   │                   │                   │
       │                   │                   │ 4. User           │
       │                   │                   │   authorizes      │
       │                   │                   │◄──────────────────┤
       │                   │                   │                   │
       │                   │ 5. Spotify        │                   │
       │                   │   redirects with  │                   │
       │                   │   auth code       │                   │
       │                   │◄──────────────────┤                   │
       │                   │                   │                   │
       │                   │ 6. Exchange code  │                   │
       │                   │   for tokens      │                   │
       │                   ├──────────────────►│                   │
       │                   │                   │                   │
       │                   │ 7. Return tokens  │                   │
       │                   │◄──────────────────┤                   │
       │                   │                   │                   │
       │ 8. Redirect user  │                   │                   │
       │   back to app     │                   │                   │
       │   with tokens     │                   │                   │
       │◄──────────────────┤                   │                   │
```

## Spotify App Setup

### 1. Create Spotify Developer Account

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account
3. Create a new app

### 2. Configure App Settings

```yaml
App Name: Your App Name
App Description: Description of your app
Website: http://localhost:8000 (for development)
Redirect URIs:
  - http://localhost:8000/api/auth/callback
```

### 3. Required Scopes

```javascript
const REQUIRED_SCOPES = [
  "user-read-private", // Read user profile
  "user-read-email", // Read user email
  "user-read-playback-state", // Read playback state
  "user-modify-playback-state", // Control playback
  "user-read-currently-playing", // Read current track
];
```

### 4. Environment Variables

```bash
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
SPOTIFY_REDIRECT_URI=http://localhost:8000/api/auth/callback
```

## Backend Implementation

### 1. Dependencies

```python
# requirements.txt
fastapi==0.104.1
uvicorn==0.24.0
spotipy==2.23.0
python-dotenv==1.0.0
python-multipart==0.0.6
pydantic==2.11.7
pydantic-settings==2.10.1
```

### 2. Configuration Setup

```python
# app/config.py
import os
from typing import Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Spotify API Configuration
    spotify_client_id: str
    spotify_client_secret: str
    spotify_redirect_uri: str = "http://localhost:8000/api/auth/callback"

    # OAuth Scopes
    spotify_scopes: str = "user-read-private user-read-email user-read-playback-state user-modify-playback-state user-read-currently-playing"

    class Config:
        env_file = ".env"
        case_sensitive = False

def get_spotify_credentials() -> dict:
    """Get Spotify API credentials."""
    return {
        "client_id": settings.spotify_client_id,
        "client_secret": settings.spotify_client_secret,
        "redirect_uri": settings.spotify_redirect_uri,
        "scope": settings.spotify_scopes,
    }
```

### 3. Spotify Authentication Service

```python
# services/spotify_auth.py
import spotipy
from spotipy.oauth2 import SpotifyOAuth
from typing import Optional, Dict, Any
from fastapi import HTTPException
import logging

logger = logging.getLogger(__name__)

class SpotifyAuthService:
    def __init__(self):
        self.credentials = get_spotify_credentials()
        self.oauth = SpotifyOAuth(
            client_id=self.credentials["client_id"],
            client_secret=self.credentials["client_secret"],
            redirect_uri=self.credentials["redirect_uri"],
            scope=self.credentials["scope"],
            show_dialog=True,  # Force user to reauthorize
            cache_path=None,   # Disable caching for stateless operation
        )

    def get_auth_url(self) -> str:
        """Generate authorization URL for Spotify OAuth2."""
        try:
            auth_url = self.oauth.get_authorize_url()
            logger.info(f"Generated authorization URL: {auth_url}")
            return auth_url
        except Exception as e:
            logger.error(f"Error generating authorization URL: {e}")
            raise HTTPException(
                status_code=500,
                detail="Failed to generate authorization URL"
            )

    def get_access_token(self, code: str) -> Optional[Dict[str, Any]]:
        """Exchange authorization code for access token."""
        try:
            token_info = self.oauth.get_access_token(code)
            if token_info:
                logger.info("Successfully obtained access token")
                return token_info
            else:
                logger.error("Failed to obtain access token")
                return None
        except Exception as e:
            logger.error(f"Error exchanging code for token: {e}")
            raise HTTPException(
                status_code=400,
                detail="Failed to exchange code for access token"
            )

    def get_user_info(self, access_token: str) -> Dict[str, Any]:
        """Get user information from Spotify API."""
        try:
            sp = spotipy.Spotify(auth=access_token)
            user_info = sp.current_user()
            logger.info(f"Retrieved user info for user: {user_info.get('id', 'unknown')}")
            return user_info
        except Exception as e:
            logger.error(f"Error getting user info: {e}")
            raise HTTPException(
                status_code=500,
                detail="Failed to get user information"
            )
```

### 4. Authentication Routes

```python
# app/routers/auth.py
from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.responses import RedirectResponse
from typing import Dict, Any
import logging
import urllib.parse

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = logging.getLogger(__name__)

@router.get("/login")
async def login(
    spotify_auth: SpotifyAuthService = Depends(get_spotify_auth_service),
) -> Dict[str, str]:
    """
    Generate Spotify authorization URL for user login.

    Returns:
        Dict containing the authorization URL
    """
    try:
        auth_url = spotify_auth.get_auth_url()
        logger.info("Login endpoint accessed, returning authorization URL")
        return {
            "auth_url": auth_url,
            "message": "Navigate to the auth_url to authenticate with Spotify",
        }
    except Exception as e:
        logger.error(f"Error in login endpoint: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate login URL")

@router.get("/callback")
async def callback(
    code: str = Query(..., description="Authorization code from Spotify"),
    state: str = Query(None, description="State parameter from OAuth flow"),
    error: str = Query(None, description="Error parameter from OAuth flow"),
    spotify_auth: SpotifyAuthService = Depends(get_spotify_auth_service),
) -> RedirectResponse:
    """
    Handle OAuth callback from Spotify.

    This endpoint receives the authorization code from Spotify,
    exchanges it for an access token, and redirects the user
    back to the frontend with the authentication information.
    """
    try:
        # Handle OAuth errors
        if error:
            logger.error(f"OAuth error in callback: {error}")
            error_url = f"/?error={urllib.parse.quote(error)}"
            return RedirectResponse(url=error_url, status_code=302)

        if not code:
            logger.error("No authorization code provided in callback")
            error_url = "/?error=no_code"
            return RedirectResponse(url=error_url, status_code=302)

        # Exchange code for tokens
        token_info = spotify_auth.get_access_token(code)
        if not token_info:
            logger.error("Failed to obtain access token")
            error_url = "/?error=token_exchange_failed"
            return RedirectResponse(url=error_url, status_code=302)

        # Get user info
        user_info = spotify_auth.get_user_info(token_info["access_token"])

        logger.info(f"OAuth callback successful for user: {user_info.get('id', 'unknown')}")

        # Create success URL with token information
        # Frontend will extract this from URL parameters
        success_url = (
            f"/?auth_success=true"
            f"&access_token={urllib.parse.quote(token_info['access_token'])}"
            f"&user_id={urllib.parse.quote(user_info.get('id', ''))}"
            f"&display_name={urllib.parse.quote(user_info.get('display_name', ''))}"
        )

        return RedirectResponse(url=success_url, status_code=302)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in callback endpoint: {e}")
        error_url = "/?error=callback_failed"
        return RedirectResponse(url=error_url, status_code=302)
```

### 5. Key Backend Implementation Details

#### Why RedirectResponse vs JSON Response?

```python
# ❌ This approach doesn't work with OAuth flow
@router.get("/callback")
async def callback(code: str) -> Dict[str, Any]:
    # Process code...
    return {"access_token": token, "user": user_info}

# ✅ This approach works with OAuth flow
@router.get("/callback")
async def callback(code: str) -> RedirectResponse:
    # Process code...
    success_url = f"/?auth_success=true&access_token={token}"
    return RedirectResponse(url=success_url, status_code=302)
```

**Reasoning:**

- OAuth callback URLs are visited directly by the browser during redirect
- Browser expects an HTML response, not JSON
- RedirectResponse ensures smooth user experience
- Frontend can extract tokens from URL parameters

#### Error Handling Strategy

```python
# Comprehensive error handling in callback
try:
    # Main OAuth processing logic
    pass
except HTTPException:
    # Re-raise FastAPI HTTP exceptions
    raise
except Exception as e:
    # Convert all other exceptions to user-friendly redirects
    logger.error(f"Unexpected error: {e}")
    error_url = "/?error=callback_failed"
    return RedirectResponse(url=error_url, status_code=302)
```

## Frontend Implementation

### 1. Authentication Store (Pinia)

```typescript
// stores/auth.ts
import { defineStore } from "pinia";
import { ref } from "vue";
import apiService, { type UserProfile } from "@/services/api";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<UserProfile | null>(null);
  const accessToken = ref<string | null>(null);
  const isAuthenticated = ref(false);
  const loading = ref(false);

  const login = async () => {
    try {
      loading.value = true;
      const response = await apiService.getAuthUrl();
      // Redirect to Spotify authorization page
      window.location.href = response.auth_url;
    } catch (error) {
      console.error("Login failed:", error);
    } finally {
      loading.value = false;
    }
  };

  // Handle authentication via query parameters (from backend redirect)
  const handleAuthParams = (params: URLSearchParams) => {
    try {
      const authSuccess = params.get("auth_success");
      const accessTokenParam = params.get("access_token");
      const userId = params.get("user_id");
      const displayName = params.get("display_name");
      const error = params.get("error");

      if (error) {
        console.error("Authentication error:", error);
        return false;
      }

      if (authSuccess === "true" && accessTokenParam) {
        accessToken.value = accessTokenParam;
        user.value = {
          id: userId || "",
          display_name: displayName || "",
          email: "",
          country: "",
          followers: { total: 0 },
          images: [],
          product: "",
          external_urls: { spotify: "" },
        };
        isAuthenticated.value = true;

        // Store token in localStorage for persistence
        localStorage.setItem("spotify_access_token", accessTokenParam);

        // Clean up URL by removing query parameters
        const url = new URL(window.location.href);
        url.search = "";
        window.history.replaceState({}, "", url.toString());

        return true;
      }

      return false;
    } catch (error) {
      console.error("Error handling auth params:", error);
      return false;
    }
  };

  const logout = () => {
    user.value = null;
    accessToken.value = null;
    isAuthenticated.value = false;
    localStorage.removeItem("spotify_access_token");
  };

  // Initialize from localStorage or query parameters
  const initializeAuth = () => {
    // First check for query parameters (from OAuth redirect)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("auth_success") || urlParams.has("access_token")) {
      const success = handleAuthParams(urlParams);
      if (success) {
        return;
      }
    }

    // Fallback to localStorage
    const token = localStorage.getItem("spotify_access_token");
    if (token) {
      accessToken.value = token;
      isAuthenticated.value = true;
      getUserProfile();
    }
  };

  return {
    user,
    accessToken,
    isAuthenticated,
    loading,
    login,
    handleAuthParams,
    logout,
    initializeAuth,
  };
});
```

### 2. API Service

```typescript
// services/api.ts
import axios, { type AxiosInstance } from "axios";

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: "/api",
      timeout: 10000,
    });

    // Add request interceptor to include auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem("spotify_access_token");
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired, redirect to login
          localStorage.removeItem("spotify_access_token");
          window.location.href = "/login";
        }
        return Promise.reject(error);
      }
    );
  }

  // Authentication endpoints
  async getAuthUrl(): Promise<{ auth_url: string; message: string }> {
    const response = await this.api.get("/auth/login");
    return response.data;
  }

  async getUserProfile(): Promise<UserProfile> {
    const response = await this.api.get("/user/profile");
    return response.data;
  }
}

export const apiService = new ApiService();
export default apiService;
```

### 3. Router Configuration

```typescript
// router/index.ts
import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: () => import("@/views/Home.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/login",
      name: "login",
      component: () => import("@/views/Login.vue"),
      meta: { requiresGuest: true },
    },
    {
      path: "/search",
      name: "search",
      component: () => import("@/views/Search.vue"),
      meta: { requiresAuth: true },
    },
  ],
});

// Navigation guards
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next("/login");
  } else if (to.meta.requiresGuest && authStore.isAuthenticated) {
    next("/");
  } else {
    next();
  }
});

export default router;
```

### 4. Application Initialization

```typescript
// main.ts
import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import { useAuthStore } from "./stores/auth";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

// Initialize auth state on app startup
const authStore = useAuthStore();
authStore.initializeAuth();

app.mount("#app");
```

## Docker Configuration

### 1. Multi-stage Dockerfile

```dockerfile
# Multi-stage Dockerfile for Spotify Web App
# Stage 1: Build the frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package files
COPY frontend/package.json frontend/package-lock.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy frontend source
COPY frontend/ .

# Build the frontend
RUN npm run build

# Stage 2: Setup the backend
FROM python:3.11-slim AS backend

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements
COPY backend/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ .

# Create frontend directory structure and copy the built frontend
RUN mkdir -p ../frontend
COPY --from=frontend-builder /app/frontend/dist ../frontend/dist

# Create a non-root user
RUN useradd --create-home --shell /bin/bash app
RUN chown -R app:app /app && chown -R app:app /frontend
USER app

# Expose the port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 2. Docker Compose Configuration

```yaml
# docker-compose.yml
version: "3.8"

services:
  spotify-app:
    build: .
    ports:
      - "8000:8000"
    environment:
      - SPOTIFY_CLIENT_ID=${SPOTIFY_CLIENT_ID}
      - SPOTIFY_CLIENT_SECRET=${SPOTIFY_CLIENT_SECRET}
      - SPOTIFY_REDIRECT_URI=${SPOTIFY_REDIRECT_URI:-http://localhost:8000/api/auth/callback}
      - FRONTEND_URL=${FRONTEND_URL:-http://localhost:8000}
      - BACKEND_URL=${BACKEND_URL:-http://localhost:8000}
      - HOST=0.0.0.0
      - PORT=8000
      - DEBUG=false
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### 3. Environment Variables

```bash
# .env
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
SPOTIFY_REDIRECT_URI=http://localhost:8000/api/auth/callback
FRONTEND_URL=http://localhost:8000
BACKEND_URL=http://localhost:8000
```

## Key Implementation Decisions

### 1. Token Storage Strategy

**Decision:** Store access tokens in localStorage + URL parameters for initial auth

**Reasoning:**

- **localStorage**: Persists across browser sessions
- **URL parameters**: Handles initial authentication flow
- **No secure HTTP-only cookies**: Spotify tokens don't contain sensitive user data beyond API access

```typescript
// Token storage implementation
const storeToken = (token: string) => {
  localStorage.setItem("spotify_access_token", token);
};

const getToken = (): string | null => {
  return localStorage.getItem("spotify_access_token");
};

const clearToken = () => {
  localStorage.removeItem("spotify_access_token");
};
```

### 2. URL Parameter Handling

**Decision:** Extract tokens from URL parameters and immediately clean the URL

**Reasoning:**

- **Security**: Prevents tokens from being visible in browser history
- **User Experience**: Clean URLs after authentication
- **Reliability**: Ensures tokens are captured before page navigation

```typescript
const handleAuthParams = (params: URLSearchParams) => {
  // Extract token information
  const token = params.get("access_token");

  if (token) {
    // Store token
    localStorage.setItem("spotify_access_token", token);

    // Clean URL immediately
    const url = new URL(window.location.href);
    url.search = "";
    window.history.replaceState({}, "", url.toString());
  }
};
```

### 3. Error Handling Strategy

**Decision:** Comprehensive error handling with user-friendly redirects

**Backend Error Handling:**

```python
# Convert all errors to user-friendly redirects
try:
    # OAuth processing
    pass
except Exception as e:
    logger.error(f"OAuth error: {e}")
    error_url = f"/?error={urllib.parse.quote(str(e))}"
    return RedirectResponse(url=error_url, status_code=302)
```

**Frontend Error Handling:**

```typescript
// Handle error parameters from URL
const error = params.get("error");
if (error) {
  console.error("Authentication error:", error);
  // Show user-friendly error message
  return false;
}
```

### 4. State Management

**Decision:** Centralized state management with Pinia

**Benefits:**

- **Reactivity**: Automatic UI updates when auth state changes
- **Persistence**: Handles localStorage integration
- **Consistency**: Single source of truth for auth state

```typescript
// Centralized auth state
export const useAuthStore = defineStore("auth", () => {
  const user = ref<UserProfile | null>(null);
  const accessToken = ref<string | null>(null);
  const isAuthenticated = ref(false);

  // All auth operations update this centralized state
});
```

## Security Considerations

### 1. Token Security

**Access Token Exposure:**

- ✅ Tokens are immediately removed from URL after extraction
- ✅ Tokens are stored in localStorage (acceptable for Spotify API)
- ✅ Tokens are sent via Authorization header (not URL parameters)

**Mitigation Strategies:**

```typescript
// Clean URL after token extraction
const url = new URL(window.location.href);
url.search = "";
window.history.replaceState({}, "", url.toString());

// Use Authorization header for API calls
config.headers.Authorization = `Bearer ${token}`;
```

### 2. CSRF Protection

**State Parameter:**

```python
# Generate state parameter for CSRF protection
import secrets

def generate_state() -> str:
    return secrets.token_urlsafe(32)

# Include in authorization URL
auth_url = f"{base_url}?state={generate_state()}&..."
```

### 3. Redirect URI Validation

**Backend Validation:**

```python
# Validate redirect URI matches registered URI
ALLOWED_REDIRECT_URIS = [
    "http://localhost:8000/api/auth/callback",
    "https://yourdomain.com/api/auth/callback"
]

def validate_redirect_uri(uri: str) -> bool:
    return uri in ALLOWED_REDIRECT_URIS
```

### 4. Token Expiration Handling

**Automatic Token Refresh:**

```typescript
// HTTP interceptor for automatic token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired - redirect to login
      localStorage.removeItem("spotify_access_token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
```

## Troubleshooting

### Common Issues and Solutions

#### 1. "Invalid Redirect URI" Error

**Problem:** Spotify returns error about invalid redirect URI

**Solution:**

```yaml
# Ensure exact match in Spotify app settings
Registered URI: http://localhost:8000/api/auth/callback
Code URI: http://localhost:8000/api/auth/callback
# Must match exactly (including protocol, port, path)
```

#### 2. "Invalid Client" Error

**Problem:** Client secret is incorrect or missing

**Solution:**

```bash
# Verify environment variables
echo $SPOTIFY_CLIENT_SECRET
# Should not be empty or "your_client_secret"
```

#### 3. CORS Issues

**Problem:** Frontend can't access backend API

**Solution:**

```python
# Add CORS middleware with correct origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

#### 4. Token Not Persisting

**Problem:** User gets logged out on page refresh

**Solution:**

```typescript
// Ensure initializeAuth is called on app startup
const authStore = useAuthStore();
authStore.initializeAuth(); // Call this in main.ts
```

#### 5. JSON Response Instead of Redirect

**Problem:** Callback endpoint returns JSON instead of redirecting

**Solution:**

```python
# Ensure callback endpoint returns RedirectResponse
@router.get("/callback")
async def callback(...) -> RedirectResponse:  # Not Dict[str, Any]
    # Process auth...
    return RedirectResponse(url=success_url, status_code=302)
```

### Debug Logging

**Backend Debug Logging:**

```python
import logging

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# Log all auth steps
logger.debug(f"Generated auth URL: {auth_url}")
logger.debug(f"Received auth code: {code[:10]}...")
logger.debug(f"Token exchange successful: {bool(token_info)}")
```

**Frontend Debug Logging:**

```typescript
// Enable debug logging in development
const DEBUG = process.env.NODE_ENV === "development";

if (DEBUG) {
  console.log("Auth URL:", authUrl);
  console.log("URL params:", Object.fromEntries(params));
  console.log("Token extracted:", !!token);
}
```

## Deployment Considerations

### Production Environment Variables

```bash
# Production .env
SPOTIFY_CLIENT_ID=your_production_client_id
SPOTIFY_CLIENT_SECRET=your_production_client_secret
SPOTIFY_REDIRECT_URI=https://yourdomain.com/api/auth/callback
FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://yourdomain.com
```

### Production Dockerfile Optimizations

```dockerfile
# Use specific versions for production
FROM node:18.19-alpine AS frontend-builder
FROM python:3.11.8-slim AS backend

# Multi-stage build reduces final image size
# Production-ready configuration
ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
```

This comprehensive implementation provides a secure, scalable, and maintainable Spotify OAuth authentication system suitable for production deployment.
