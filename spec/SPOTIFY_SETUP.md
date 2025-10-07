# Spotify API Setup Guide for Disco Incognito

## Overview

Disco Incognito requires Spotify API integration for:

- User authentication (OAuth 2.0)
- Music playback control
- Track searching and selection
- Device management
- A spoofable Spotify adapter so local development can run entirely in test mode

### Workflow Reminders

- Keep development in Spotify test mode (`SPOTIFY_MODE=test`) until final integration.
- After completing each setup step below, capture the changes and make a local git commit (do not push yet).
- When a step includes UI or authentication work, run automated tests and verify Puppeteer screenshots before moving on.

## Prerequisites

- Spotify account (Premium recommended for Web Playback SDK)
- Access to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)

## Step 1: Create Spotify Application

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click "Create an App"
3. Fill in the application details:
   - **App Name**: `Disco Incognito`
   - **App Description**: `Multiplayer music guessing game where players guess who heard a different song`
   - **Website**: (optional)
   - **Redirect URIs**: `http://localhost:8000/api/auth/callback`
4. Accept Terms of Service and click "Create"

## Step 2: Configure Application Settings

### Redirect URIs

Add these redirect URIs in the app settings:

- **Development**: `http://localhost:8000/api/auth/callback`
- **Production**: `https://your-domain.com/api/auth/callback`

### OAuth Scopes Required

The application requests these scopes:

- `user-read-private` - Access to user's profile information
- `user-read-email` - Access to user's email address
- `user-read-playback-state` - Read access to user's playback state
- `user-modify-playback-state` - Write access to user's playback state
- `user-read-currently-playing` - Read access to currently playing track
- `streaming` - Control playback through Web Playback SDK

### App Settings

- **Users in Development Mode**: Add test users (up to 25)
- **Request Extension**: Apply for quota extension when ready for production

## Step 3: Get API Credentials

1. Go to your app in the Spotify Developer Dashboard
2. Click "Settings"
3. Copy the **Client ID** and **Client Secret**
4. Keep these credentials secure - never commit them to version control

## Step 4: Configure Environment Variables

Create a `.env` file in the backend directory:

```env
# Copy from backend/env.template
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
SPOTIFY_REDIRECT_URI=http://localhost:8000/api/auth/callback

# Security
JWT_SECRET_KEY=your-random-secret-key-here
SESSION_SECRET=your-session-secret-here

# Storage Adapter
SESSION_STORAGE=json_file
SESSION_STORAGE_FILE=./data/disco_incognito.json

# Development
DEBUG=true
LOG_LEVEL=INFO
SPOTIFY_MODE=test
```

## Step 5: Test Configuration

1. Start the backend server:

   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # or `venv\Scripts\activate` on Windows
   pip install -r requirements.txt
   python main.py
   ```

2. Start the frontend development server:

   ```bash
   cd frontend
   npm run dev
   ```

3. Ensure `data/disco_incognito.json` exists and contains `{}` before exercising multiplayer flows.
4. Visit `http://localhost:3000`, keep `SPOTIFY_MODE=test`, and verify the login flow using the spoofed adapter.
5. Capture Puppeteer screenshots for the login experience and commit the changes locally (git commit only, no push yet).

## OAuth Flow Details

### Authorization Request

```
https://accounts.spotify.com/authorize
  ?client_id=your_client_id
  &response_type=code
  &redirect_uri=http://localhost:8000/api/auth/callback
  &scope=user-read-private user-read-email user-read-playback-state user-modify-playback-state user-read-currently-playing streaming
  &state=random_string_for_csrf_protection
```

### Token Exchange

After user authorization, Spotify redirects to your callback URL with an authorization code. Exchange this for access tokens:

```python
# Handled by backend/app/routes/auth.py
POST https://accounts.spotify.com/api/token
{
    "grant_type": "authorization_code",
    "code": "authorization_code_from_callback",
    "redirect_uri": "http://localhost:8000/api/auth/callback",
    "client_id": "your_client_id",
    "client_secret": "your_client_secret"
}
```

### Token Refresh

Access tokens expire after 1 hour. Use the refresh token to get new access tokens:

```python
POST https://accounts.spotify.com/api/token
{
    "grant_type": "refresh_token",
    "refresh_token": "your_refresh_token",
    "client_id": "your_client_id",
    "client_secret": "your_client_secret"
}
```

## Production Considerations

### Quota Extension

- Request quota extension when ready for public release
- Provide detailed information about your application
- May take several weeks for approval

### Security

- Use HTTPS in production
- Store client secret securely (environment variables, secret management)
- Implement proper CSRF protection with state parameters
- Validate redirect URIs
- Keep secrets out of git; commit only templates and placeholder JSON files

### Storage & Infrastructure

- Set `SESSION_STORAGE=json_file` and point `SESSION_STORAGE_FILE` at the mounted location (for example `/mnt/disco_incognito/disco_incognito.json`).
- Mount the shared bucket (Cloud Storage FUSE or equivalent) so every instance reads/writes the same JSON file.
- Perform atomic writes (temp file + rename) to avoid corruption when multiple instances update state.

### Rate Limits

- Spotify Web API: 100 requests per minute per application
- Plan for rate limiting and exponential backoff
- Cache responses when appropriate

## Troubleshooting

### Common Issues

**Invalid Client Error**

- Check client ID and client secret are correct
- Ensure redirect URI matches exactly (including trailing slashes)

**Invalid Scope Error**

- Verify all requested scopes are supported
- Check scope string formatting (space-separated)

**Premium Required Error**

- Web Playback SDK requires Spotify Premium
- Implement graceful fallback for free users

**CORS Errors**

- Ensure CORS is properly configured in FastAPI
- Check that frontend and backend URLs match configuration

## API Endpoints

The backend implements these authentication endpoints:

- `GET /api/auth/login` - Generate Spotify authorization URL
- `GET /api/auth/callback` - Handle OAuth callback and token exchange
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/logout` - Logout user and clear session
- `GET /api/user/profile` - Get authenticated user profile

## Web Playback SDK

For browser-based playback control:

1. Load Spotify Web Playback SDK:

   ```javascript
   <script src="https://sdk.scdn.co/spotify-player.js"></script>
   ```

2. Initialize player (handled by music store):

   ```javascript
   const player = new Spotify.Player({
     name: "Disco Incognito Web Player",
     getOAuthToken: (cb) => cb(access_token),
     volume: 0.5,
   });
   ```

3. Connect and handle events for playback state changes

## Support

- [Spotify Web API Documentation](https://developer.spotify.com/documentation/web-api/)
- [Web Playback SDK Guide](https://developer.spotify.com/documentation/web-playback-sdk/)
- [OAuth 2.0 Authorization Guide](https://developer.spotify.com/documentation/general/guides/authorization/)
