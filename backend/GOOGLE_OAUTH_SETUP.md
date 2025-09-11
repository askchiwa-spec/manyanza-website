# Google Cloud Console Setup Instructions

This guide will walk you through setting up Google OAuth 2.0 for your Manyanza website authentication system.

## Prerequisites

- Google account
- Access to Google Cloud Console
- Your application running on `http://localhost:8080`

## Step-by-Step Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Enter project details:
   - **Project name**: `Manyanza Vehicle Transit`
   - **Organization**: (optional)
   - **Location**: (optional)
4. Click **Create**

### 2. Enable Google+ API

1. In the Google Cloud Console, go to **APIs & Services** → **Library**
2. Search for "Google+ API"
3. Click on "Google+ API" and click **Enable**
4. Also enable "Google OAuth2 API" if available

### 3. Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
3. If prompted, configure the OAuth consent screen first:
   
   #### Configure OAuth Consent Screen
   
   1. Click **CONFIGURE CONSENT SCREEN**
   2. Choose **External** (unless you have a Google Workspace account)
   3. Fill in the required information:
      - **App name**: `Manyanza Vehicle Transit`
      - **User support email**: `your-email@example.com`
      - **App domain**: `http://localhost:8080` (for testing)
      - **Developer contact information**: `your-email@example.com`
   4. Click **Save and Continue**
   5. Add scopes (optional for basic setup)
   6. Add test users (add your email and any test accounts)
   7. Review and submit

4. Return to **Credentials** → **+ CREATE CREDENTIALS** → **OAuth client ID**
5. Choose **Web application**
6. Configure the OAuth client:
   - **Name**: `Manyanza Web Client`
   - **Authorized JavaScript origins**:
     ```
     http://localhost:8080
     http://127.0.0.1:8080
     ```
   - **Authorized redirect URIs**:
     ```
     http://localhost:8080/auth/google/callback
     ```
7. Click **Create**

### 4. Copy Your Credentials

After creating the OAuth client, you'll see a modal with your credentials:

1. **Client ID**: Copy this value
2. **Client Secret**: Copy this value
3. Click **OK**

### 5. Configure Your Application

1. Open your `.env` file in the backend directory:
   ```bash
   cd "/Users/baamrecs/Driver website/backend"
   nano .env
   ```

2. Update the following variables with your actual values:
   ```env
   GOOGLE_CLIENT_ID=your_actual_client_id_here
   GOOGLE_CLIENT_SECRET=your_actual_client_secret_here
   SESSION_SECRET=your_long_random_session_secret_here
   CALLBACK_URL=http://localhost:8080/auth/google/callback
   ```

3. **Generate a secure session secret**:
   ```bash
   # You can use this command to generate a random secret:
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

### 6. Domain Restrictions (Optional)

If you want to restrict access to specific email domains:

1. In your `.env` file, set:
   ```env
   ALLOWED_DOMAIN=yourcompany.com
   ```
   
2. For admin-only access, you can also set:
   ```env
   ADMIN_DOMAIN=yourcompany.com
   ADMIN_EMAILS=admin@yourcompany.com,manager@yourcompany.com
   ```

## Production Setup

When deploying to production, you'll need to:

### 1. Update OAuth Configuration

1. In Google Cloud Console, go to **Credentials**
2. Edit your OAuth 2.0 client
3. Add your production domains:
   - **Authorized JavaScript origins**:
     ```
     https://yourdomain.com
     https://www.yourdomain.com
     ```
   - **Authorized redirect URIs**:
     ```
     https://yourdomain.com/auth/google/callback
     ```

### 2. Update Environment Variables

Update your production `.env` file:
```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
SESSION_SECRET=your_production_session_secret
CALLBACK_URL=https://yourdomain.com/auth/google/callback
ALLOWED_DOMAIN=yourcompany.com  # Optional
```

### 3. Update OAuth Consent Screen

1. Go to **OAuth consent screen**
2. Update the app domain to your production URL
3. Submit for verification if needed (for external users)

## Testing Your Setup

1. Start your backend server:
   ```bash
   cd "/Users/baamrecs/Driver website/backend"
   npm start
   ```

2. Start your frontend server:
   ```bash
   cd "/Users/baamrecs/Driver website"
   python3 -m http.server 8080
   ```

3. Visit `http://localhost:8080`
4. Click the "Sign In" button
5. You should be redirected to Google's authentication page
6. After signing in, you should be redirected back to your dashboard

## Troubleshooting

### Common Issues

1. **"Error: redirect_uri_mismatch"**
   - Check that your redirect URI in Google Console exactly matches your application's callback URL
   - Ensure no trailing slashes or typos

2. **"Error: invalid_client"**
   - Verify your Client ID and Client Secret are correct
   - Check that they're properly set in your `.env` file

3. **"This app isn't verified"**
   - This is normal for development
   - Click "Advanced" → "Go to [App Name] (unsafe)" to continue
   - For production, submit your app for verification

4. **Session issues**
   - Make sure your session secret is set and secure
   - Clear your browser cookies and try again

5. **CORS issues**
   - Ensure your frontend and backend are running on the expected ports
   - Check that CORS is properly configured in your Express app

### Debug Mode

To enable debug logging, set in your `.env`:
```env
DEBUG=passport:*
NODE_ENV=development
```

## Security Best Practices

1. **Keep credentials secure**:
   - Never commit `.env` files to version control
   - Use environment variables in production
   - Rotate secrets regularly

2. **Use HTTPS in production**:
   - Google OAuth requires HTTPS for production domains
   - Use SSL certificates from Let's Encrypt or your hosting provider

3. **Limit domain access**:
   - Use `ALLOWED_DOMAIN` to restrict access
   - Implement proper role-based access control

4. **Monitor usage**:
   - Check Google Cloud Console for API usage
   - Set up quotas and alerts

## Next Steps

After successful setup:

1. Customize the user dashboard
2. Implement role-based access control
3. Add user profile management
4. Set up production deployment
5. Configure monitoring and logging

## Support

If you encounter issues:

1. Check the [Google OAuth 2.0 documentation](https://developers.google.com/identity/protocols/oauth2)
2. Review the [Passport.js Google Strategy documentation](http://www.passportjs.org/packages/passport-google-oauth20/)
3. Check your browser's developer console for errors
4. Review your server logs for authentication errors