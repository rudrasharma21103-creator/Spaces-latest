# Google Integration Guide

## Features Added

### 1. Sign In with Google
- **Location**: Login/Signup page
- **Description**: Users can now sign in using their Google account via OAuth 2.0
- **How to use**: Click the "Sign in with Google" button on the authentication page
- **Features**:
  - Creates new account automatically if user doesn't exist
  - Uses Google profile information (name, email)
  - Secure OAuth 2.0 authentication

### 2. Google Apps Grid Menu
- **Location**: Top navigation bar (left of "Invite Members" button)
- **Icon**: Grid icon (3x3 grid)
- **Description**: Quick access to major Google apps
- **Apps included**:
  - Gmail
  - Google Drive
  - Google Docs
  - Google Sheets
  - Google Slides
  - Google Calendar
  - Google Meet
  - Google Photos
- **How to use**: Click the grid icon to open the menu, then click any app to open it in a new tab

### 3. Documents Integration
- **Location**: Top navigation bar (left of Grid icon)
- **Icon**: Document/File icon with green dot when connected
- **Description**: View all documents from Gmail and Google Drive in one place
- **Features**:
  - First-time connection prompts for Google account authorization
  - Fetches Gmail attachments
  - Fetches Google Drive files
  - Unified view of all documents
  - Shows file metadata (type, size, modified date)
  - Direct links to open documents

#### OAuth Scopes Used
- `https://www.googleapis.com/auth/drive.readonly` - Read Google Drive files
- `https://www.googleapis.com/auth/gmail.readonly` - Read Gmail attachments

## Environment Variables

All credentials are stored in `.env` file (not `.env` in backend folder):

```
VITE_GOOGLE_CLIENT_ID=274349045474-ibbfvmj65hjohoc4ltvrtah77qdvjdrs.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_SECRET=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
VITE_GOOGLE_API_KEY=AIzaSyDqhhl5r8pJUxHGjsst9Bp0BiiWlsp4yfg
```

**Note**: These use `VITE_` prefix for Vite environment variables.

## Files Modified/Created

### New Files
1. `/src/services/google.js` - Google API integration service
2. `/.env` - Environment variables for Google credentials

### Modified Files
1. `/src/App.jsx` - Added Google features and UI components
2. `/package.json` - Added dependencies:
   - `@react-oauth/google`
   - `axios`

## Technical Implementation

### Google Sign-In Flow
1. User clicks "Sign in with Google" button
2. Google Identity Services initializes and shows account picker
3. On successful authentication, JWT token is received
4. Token is decoded to extract user information
5. User is either logged in (if exists) or new account is created

### Docs Integration Flow
1. User clicks Docs icon
2. If not connected, modal prompts to connect Google account
3. User authorizes with required OAuth scopes
4. Access token is saved in localStorage
5. App fetches:
   - Google Drive files (last 100, sorted by modified date)
   - Gmail attachments (from last 50 messages with attachments, limited to 20 for performance)
6. Documents are displayed in categorized sections

## APIs Used

### Google APIs
- **Google Identity Services** - For OAuth 2.0 authentication
- **Google Drive API v3** - For fetching Drive files
- **Gmail API v1** - For fetching email attachments

### Security Features
- Access tokens stored in localStorage
- Tokens cleared on logout
- OAuth 2.0 secure authentication
- Read-only permissions for Drive and Gmail

## Usage Instructions

### For Users
1. **Sign in with Google**: Click the button on the login page
2. **Access Google Apps**: Click the grid icon in the navbar
3. **View Documents**: 
   - Click the Docs icon
   - Connect your Google account if prompted
   - Browse your Drive files and Gmail attachments

### For Developers
1. Ensure `.env` file exists in root directory with proper credentials
2. Run `npm install` to install dependencies
3. Start the development server with `npm run dev`
4. Google API will initialize automatically on app load

## Troubleshooting

### Common Issues
1. **Google Sign-In not working**: 
   - Check if Google Client ID is correct in `.env`
   - Verify the domain is authorized in Google Cloud Console

2. **Docs not loading**:
   - Ensure OAuth scopes are properly configured
   - Check browser console for API errors
   - Verify API Key is valid

3. **Access token expired**:
   - User will need to reconnect their Google account
   - Token refresh is not implemented (tokens expire after ~1 hour)

## Future Enhancements
- Token refresh mechanism
- File preview within the app
- Document search functionality
- Google Calendar integration in the Calendar view
- Google Meet integration with video calls
