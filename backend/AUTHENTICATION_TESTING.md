# Authentication System Testing Instructions

This document provides comprehensive testing instructions for the Google Sign-In authentication system integrated into your Manyanza website.

## Prerequisites

Before testing, ensure you have:

1. ✅ **Node.js packages installed**:
   ```bash
   cd "/Users/baamrecs/Driver website/backend"
   npm install
   ```

2. ✅ **Google OAuth credentials configured** (see `GOOGLE_OAUTH_SETUP.md`)

3. ✅ **Environment variables set** in `.env` file:
   ```env
   GOOGLE_CLIENT_ID=your_actual_client_id
   GOOGLE_CLIENT_SECRET=your_actual_client_secret
   SESSION_SECRET=your_long_random_secret
   CALLBACK_URL=http://localhost:8080/auth/google/callback
   ```

## Quick Start Testing

### 1. Start the Authentication Server

```bash
cd "/Users/baamrecs/Driver website/backend"
node auth-server.js
```

You should see output like:
```
🚀 ================================
🚀 MANYANZA AUTHENTICATION SERVER
🚀 ================================
📡 Server running on port: 8080
🌐 Website URL: http://localhost:8080
🔐 Login URL: http://localhost:8080/login
📊 Dashboard URL: http://localhost:8080/dashboard
⚕️ Health check: http://localhost:8080/api/health
```

### 2. Basic Functionality Tests

Open your browser and test these URLs:

#### 2.1 Health Check
- **URL**: http://localhost:8080/api/health
- **Expected**: JSON response with status "healthy"
- **Test**: Verify server is running and configured

#### 2.2 Homepage
- **URL**: http://localhost:8080
- **Expected**: Manyanza homepage with "Sign In" button in navigation
- **Test**: Check that authentication button appears

#### 2.3 Login Page (Guest Access)
- **URL**: http://localhost:8080/login
- **Expected**: Login page with Google Sign-In button
- **Test**: Verify login page loads and shows Google OAuth button

#### 2.4 Dashboard (Protected - Should Redirect)
- **URL**: http://localhost:8080/dashboard
- **Expected**: Redirects to `/login?redirect=/dashboard`
- **Test**: Verify protection works for unauthenticated users

## Complete Authentication Flow Testing

### 3. Google OAuth Flow

#### 3.1 Initiate Login
1. Visit http://localhost:8080
2. Click "Sign In" button in navigation
3. **Expected**: Redirects to `/login`
4. Click "Continue with Google" button
5. **Expected**: Redirects to Google OAuth consent screen

#### 3.2 Google Authentication
1. On Google's page, enter your credentials
2. Grant permissions to the app
3. **Expected**: Redirects back to your application
4. **Expected**: URL should be `http://localhost:8080/dashboard`

#### 3.3 Post-Login Verification
1. **Dashboard Access**: Should see user dashboard with profile info
2. **Navigation**: "Sign In" button should be replaced with user menu
3. **User Menu**: Should show user's name and profile picture
4. **Profile Data**: Should display correct user information

### 4. Session and State Testing

#### 4.1 Session Persistence
1. After logging in, close and reopen browser
2. Visit http://localhost:8080
3. **Expected**: Should still be logged in (user menu visible)
4. Visit http://localhost:8080/dashboard
5. **Expected**: Should access dashboard without re-authentication

#### 4.2 Logout Functionality
1. Click on user menu in navigation
2. Click "Logout" button
3. **Expected**: Should redirect to homepage with "Sign In" button
4. Try accessing http://localhost:8080/dashboard
5. **Expected**: Should redirect to login page

### 5. API Endpoint Testing

#### 5.1 Authentication Status API
```bash
# When not logged in
curl -c cookies.txt http://localhost:8080/auth/status

# Expected response:
{
  "isAuthenticated": false
}
```

```bash
# When logged in (after browser authentication)
curl -b cookies.txt http://localhost:8080/auth/status

# Expected response:
{
  "isAuthenticated": true,
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "profilePicture": "https://...",
    "isFirstTime": false
  }
}
```

#### 5.2 Profile API (Protected)
```bash
# Should require authentication
curl -b cookies.txt http://localhost:8080/auth/profile

# Expected: Full user profile data
```

#### 5.3 Logout API
```bash
curl -b cookies.txt -X GET http://localhost:8080/auth/logout

# Expected: Redirects to homepage, session cleared
```

## Advanced Testing Scenarios

### 6. First-Time User Experience

#### 6.1 New User Registration
1. Use a Google account that hasn't logged into your app before
2. Complete OAuth flow
3. **Expected**: Should redirect to `/dashboard?welcome=true`
4. **Expected**: Welcome banner should appear on dashboard
5. **Expected**: User should be marked as `is_first_time: 1` in database

#### 6.2 Returning User Experience
1. Use the same Google account to login again
2. **Expected**: Should redirect to `/dashboard` (no welcome parameter)
3. **Expected**: No welcome banner
4. **Expected**: Login count should increment in database

### 7. Domain Restriction Testing (Optional)

If you've configured `ALLOWED_DOMAIN` in `.env`:

#### 7.1 Allowed Domain Test
1. Login with email from allowed domain
2. **Expected**: Should authenticate successfully

#### 7.2 Restricted Domain Test
1. Login with email from different domain
2. **Expected**: Should show error "Access restricted to [domain] only"

### 8. Error Handling Testing

#### 8.1 Invalid OAuth Configuration
1. Temporarily change `GOOGLE_CLIENT_ID` in `.env` to invalid value
2. Restart server
3. Try to login
4. **Expected**: Should show OAuth error

#### 8.2 Network Error Simulation
1. Disconnect internet during OAuth flow
2. **Expected**: Should handle gracefully with error message

#### 8.3 Session Corruption
1. Manually delete session files in `./data/`
2. Try accessing protected routes
3. **Expected**: Should redirect to login

## Database Verification

### 9. User Data Storage

Check that user data is properly stored:

```bash
# Install sqlite3 command line tool if needed
# On macOS: brew install sqlite3

cd "/Users/baamrecs/Driver website/backend"
sqlite3 data/manyanza.db

# Check users table
.schema users
SELECT * FROM users;

# Verify user data structure
.exit
```

Expected user record:
- `google_id`: Google's unique user ID
- `email`: User's email address
- `name`: User's display name
- `profile_picture`: URL to user's profile picture
- `domain`: Email domain (for restrictions)
- `login_count`: Number of times user has logged in
- `last_login_at`: Timestamp of last login
- `is_first_time`: Boolean indicating first-time user

## Performance Testing

### 10. Load Testing (Optional)

#### 10.1 Concurrent Users
1. Open multiple browser tabs/windows
2. Login with different Google accounts
3. **Expected**: All should authenticate successfully

#### 10.2 Session Limits
1. Login from multiple devices with same account
2. **Expected**: Should work on all devices (sessions independent)

## Security Testing

### 11. Security Verification

#### 11.1 Session Security
1. Check that session cookies are `httpOnly`
2. Verify session data is not accessible via JavaScript
3. **Test**: Try accessing session via browser console

#### 11.2 CSRF Protection
1. Try making authenticated requests from different origin
2. **Expected**: Should be blocked by CORS policy

#### 11.3 URL Parameter Injection
1. Try accessing: `/login?redirect=http://malicious-site.com`
2. **Expected**: Should sanitize redirect parameter

## Troubleshooting Common Issues

### 12. Common Problems and Solutions

#### 12.1 "redirect_uri_mismatch"
- **Cause**: OAuth redirect URI doesn't match Google Console configuration
- **Solution**: Check Google Console OAuth client settings
- **Fix**: Ensure redirect URI is exactly `http://localhost:8080/auth/google/callback`

#### 12.2 "This app isn't verified"
- **Cause**: Normal for development apps
- **Solution**: Click "Advanced" → "Go to [App Name] (unsafe)"
- **Note**: This warning is expected during development

#### 12.3 Session not persisting
- **Cause**: Session secret not set or cookies disabled
- **Solution**: Check `.env` file has `SESSION_SECRET` set
- **Check**: Browser cookies are enabled

#### 12.4 Database errors
- **Cause**: Database schema not initialized
- **Solution**: Restart server to auto-initialize database
- **Check**: `data/` directory exists and is writable

#### 12.5 CORS errors
- **Cause**: Frontend and backend on different ports
- **Solution**: Use the integrated auth-server (runs on single port)
- **Check**: Both frontend and backend accessible on port 8080

## Test Completion Checklist

### 13. Final Verification

Mark each item as completed:

- [ ] ✅ Server starts without errors
- [ ] ✅ Health check endpoint responds correctly
- [ ] ✅ Homepage loads with authentication button
- [ ] ✅ Login page displays Google OAuth button
- [ ] ✅ Google OAuth flow completes successfully
- [ ] ✅ Dashboard loads after authentication
- [ ] ✅ User profile displays correctly
- [ ] ✅ Session persists across browser restarts
- [ ] ✅ Logout functionality works
- [ ] ✅ Protected routes redirect when not authenticated
- [ ] ✅ User data is stored correctly in database
- [ ] ✅ First-time user experience works
- [ ] ✅ Returning user experience works
- [ ] ✅ API endpoints respond correctly
- [ ] ✅ Error handling works gracefully
- [ ] ✅ Domain restrictions work (if configured)

## Success Criteria

Your authentication system is working correctly if:

1. **Users can successfully authenticate via Google OAuth**
2. **User sessions persist properly**
3. **Protected routes are properly secured**
4. **User data is correctly stored and retrieved**
5. **All UI elements update based on authentication state**
6. **Error handling provides clear feedback**
7. **Performance is acceptable for expected load**

## Next Steps After Testing

Once testing is complete:

1. **Production Setup**: Configure production Google OAuth settings
2. **SSL Certificate**: Enable HTTPS for production deployment
3. **Monitoring**: Set up logging and monitoring for authentication events
4. **Backup**: Implement database backup strategy
5. **Documentation**: Update user documentation for login process

## Getting Help

If you encounter issues:

1. Check the server console for error messages
2. Review browser developer console for client-side errors
3. Verify Google Cloud Console configuration
4. Check `.env` file configuration
5. Ensure all required packages are installed
6. Review this testing guide for missed steps

## Contact Information

For technical support or questions about this authentication system, refer to the main project documentation or create an issue in the project repository.