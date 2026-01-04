# Google OAuth Configuration Fix

## Issue Fixed
✅ **CORS Error** - Backend now allows requests from localhost:5173
✅ **Better Error Handling** - App now shows helpful messages if Google Sign-In is not configured

## To Enable Google Sign-In (Optional)

Google Sign-In requires configuring authorized origins in Google Cloud Console. Follow these steps:

### Step 1: Go to Google Cloud Console
1. Visit: https://console.cloud.google.com/apis/credentials
2. Find your OAuth 2.0 Client ID: `274349045474-ibbfvmj65hjohoc4ltvrtah77qdvjdrs.apps.googleusercontent.com`

### Step 2: Add Authorized JavaScript Origins
Add these origins to your OAuth client:
- `http://localhost:5173`
- `http://127.0.0.1:5173`
- `http://localhost:3000` (if you use port 3000)

### Step 3: Add Authorized Redirect URIs
Add these redirect URIs:
- `http://localhost:5173`
- `http://127.0.0.1:5173`

### Step 4: Save Changes
Click "Save" and wait 5-10 minutes for changes to propagate.

## Alternative: Use Email/Password Login
If you don't want to configure Google OAuth, simply use the regular email/password login. It works perfectly!

## What Was Fixed

### 1. Backend CORS Configuration (`backend/app/main.py`)
```python
# Now allows localhost for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"https://spacexyz-.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 2. Better Google OAuth Error Handling
- Added try-catch blocks
- Shows user-friendly error messages
- Suggests using email/password login as fallback

## Testing

1. **Backend is running**: Check that `http://localhost:8000/health` returns healthy status
2. **Frontend is running**: Your app should load at `http://localhost:5173`
3. **CORS is fixed**: No more "Access-Control-Allow-Origin" errors
4. **Google Sign-In**: Shows helpful message if not configured

## Current Status
- ✅ CORS errors resolved
- ✅ Backend accepts requests from localhost
- ✅ Email/password login works perfectly
- ⚠️ Google Sign-In requires additional configuration (optional)
