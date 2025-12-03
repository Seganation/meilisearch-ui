# Authentication System Documentation

## Overview

The Meilisearch UI now includes a basic HTTP authentication system that protects the entire UI with username and password credentials. This is a simple, build-time authentication system suitable for small deployments and development environments.

## Features

- ✅ Username and password authentication
- ✅ Session-based authentication (cleared on browser close)
- ✅ SHA-256 password hashing
- ✅ Login page with form validation
- ✅ Automatic redirect to login for unauthenticated users
- ✅ Logout functionality with confirmation modal
- ✅ Optional authentication (disabled by default)
- ✅ Compatible with singleton mode
- ✅ Internationalization support (English and Chinese)

## Quick Start

### Development Setup

1. **Create `.env.local` file**:
```bash
cp .env.example .env.local
```

2. **Edit `.env.local`**:
```bash
# Enable authentication
VITE_AUTH_USERNAME=admin
VITE_AUTH_PASSWORD=my-secure-password
```

3. **Start development server**:
```bash
pnpm run dev
```

4. **Access the UI**:
- Navigate to `http://localhost:24900`
- You'll be redirected to `/login`
- Enter your credentials to access the UI

### Docker Deployment

**With Authentication:**
```bash
docker run -p 24900:24900 \
  -e AUTH_USERNAME=admin \
  -e AUTH_PASSWORD=your-secure-password \
  riccoxie/meilisearch-ui:latest
```

**With Singleton Mode + Authentication:**
```bash
docker run -p 24900:24900 \
  -e AUTH_USERNAME=admin \
  -e AUTH_PASSWORD=your-secure-password \
  -e SINGLETON_MODE=true \
  -e SINGLETON_HOST=http://meilisearch:7700 \
  -e SINGLETON_API_KEY=your-meilisearch-key \
  riccoxie/meilisearch-ui:latest
```

**Without Authentication (Default):**
```bash
docker run -p 24900:24900 \
  riccoxie/meilisearch-ui:latest
```

## How It Works

### Authentication Flow

```
1. User visits any route (e.g., /)
   ↓
2. __root.tsx beforeLoad hook checks authentication
   ↓
3. If auth required && not authenticated
   ↓
4. Redirect to /login with return URL
   ↓
5. User enters credentials
   ↓
6. Login form validates input
   ↓
7. auth.ts:login() hashes and compares passwords
   ↓
8. If successful:
   - Set sessionStorage "authenticated"
   - Update Zustand store isAuthenticated = true
   - Redirect to original URL or home
   ↓
9. User accesses protected routes
   ↓
10. Logout button available in header (if auth enabled)
```

### Security Model

#### What's Protected
- ✅ All routes except `/login`
- ✅ Entire UI interface
- ✅ Dashboard, instances, indexes, tasks, keys
- ✅ All Meilisearch operations

#### Security Features
1. **Password Hashing**: Passwords are hashed with SHA-256 before comparison
2. **Session Storage**: Authentication state stored in sessionStorage (cleared on browser close)
3. **No Persistence**: Credentials not stored in localStorage or cookies
4. **Timing Attack Prevention**: Both passwords hashed before comparison
5. **Redirect Protection**: Return URLs validated to prevent open redirects
6. **Build-Time Secrets**: Credentials embedded at build time, not runtime

#### Security Limitations

⚠️ **Important Security Notes:**

This is a **basic authentication system** suitable for:
- Development environments
- Internal networks
- Small teams
- Proof of concept deployments

**NOT recommended for:**
- Production internet-facing deployments
- Multi-user environments
- Compliance-required systems
- High-security applications

**Recommended for Production:**
1. **Reverse Proxy Authentication**: Use nginx, Caddy, or Traefik with HTTP Basic Auth
2. **OAuth2/OIDC**: Implement OAuth2 with providers like Auth0, Keycloak, or Okta
3. **API Gateway**: Use Kong, Tyk, or AWS API Gateway with authentication
4. **VPN/Network Security**: Deploy behind VPN or private network

## Configuration

### Environment Variables

#### Development (.env.local)
```bash
# Authentication (optional)
VITE_AUTH_USERNAME=admin
VITE_AUTH_PASSWORD=your-secure-password

# Singleton Mode (optional)
VITE_SINGLETON_MODE=true
VITE_SINGLETON_HOST=http://localhost:7700
VITE_SINGLETON_API_KEY=master-key
```

#### Docker (without VITE_ prefix)
```bash
# Authentication (optional)
AUTH_USERNAME=admin
AUTH_PASSWORD=your-secure-password

# Singleton Mode (optional)
SINGLETON_MODE=true
SINGLETON_HOST=http://meilisearch:7700
SINGLETON_API_KEY=master-key
```

### Disabling Authentication

Authentication is **disabled by default**. To disable it after enabling:

**Development:**
```bash
# Remove or comment out in .env.local
# VITE_AUTH_USERNAME=admin
# VITE_AUTH_PASSWORD=your-secure-password
```

**Docker:**
```bash
# Don't pass AUTH_* environment variables
docker run -p 24900:24900 riccoxie/meilisearch-ui:latest
```

## Architecture

### File Structure

```
src/
├── lib/
│   └── auth.ts                    # Authentication logic
├── routes/
│   ├── __root.tsx                 # Route protection (beforeLoad hook)
│   └── login.tsx                  # Login page component
├── store/
│   └── index.ts                   # isAuthenticated state
├── components/
│   └── biz/
│       └── InsHeader.tsx          # Logout button
└── locales/
    ├── en/
    │   └── auth.json              # English translations
    └── zh/
        └── auth.json              # Chinese translations

scripts/
└── cmd.sh                         # Docker env var transformation

.env.example                       # Example configuration
```

### Key Functions

#### `src/lib/auth.ts`

**`isAuthRequired(): boolean`**
- Returns `true` if `VITE_AUTH_USERNAME` and `VITE_AUTH_PASSWORD` are set
- Returns `false` if either is missing (auth disabled)

**`isAuthenticated(): boolean`**
- Returns `true` if user has valid session
- Returns `false` if session doesn't exist
- Always returns `true` if auth is disabled

**`login(username, password): Promise<boolean>`**
- Hashes provided password with SHA-256
- Hashes expected password with SHA-256
- Compares hashed values
- Sets sessionStorage on success
- Returns `true` on success, `false` on failure

**`logout(): void`**
- Removes authentication from sessionStorage
- Logs debug message

**`getRedirectUrl(): string`**
- Extracts `redirect` query parameter
- Validates redirect URL (must start with BASE_URL)
- Returns validated URL or home page

### State Management

#### Zustand Store (`src/store/index.ts`)

**State:**
```typescript
interface State {
  isAuthenticated: boolean;
  setAuthenticated: (value: boolean) => void;
  // ... other state
}
```

**Usage:**
```typescript
const isAuthenticated = useAppStore((state) => state.isAuthenticated);
const setAuthenticated = useAppStore((state) => state.setAuthenticated);

// Update authentication state
setAuthenticated(true);  // User logged in
setAuthenticated(false); // User logged out
```

### Route Protection

#### `src/routes/__root.tsx`

The root route includes a `beforeLoad` hook that:
1. Checks if authentication is required
2. Checks if user is authenticated
3. Redirects to `/login` if not authenticated
4. Passes return URL as query parameter
5. Prevents authenticated users from accessing `/login`

```typescript
beforeLoad: async ({ location }) => {
  if (isAuthRequired() && !isAuthenticated()) {
    if (location.pathname === "/login") {
      return; // Allow access to login page
    }

    throw redirect({
      to: "/login",
      search: {
        redirect: location.pathname,
      },
    });
  }
}
```

## User Interface

### Login Page (`/login`)

**Features:**
- Clean, centered design matching existing UI
- Logo and branding
- Username field with icon
- Password field (masked input)
- Form validation
  - Username: minimum 3 characters, required
  - Password: minimum 3 characters, required
- Error messages on failed login
- Loading state during authentication
- Automatic redirect after successful login

**Components Used:**
- Mantine: `Paper`, `TextInput`, `PasswordInput`, `Button`, `Alert`, `Text`
- Tabler Icons: `IconUser`, `IconLock`, `IconAlertCircle`
- React Hook Form: Form validation via `useForm`

### Logout Button

**Location:** Header component (top-right)

**Features:**
- Red logout icon button
- Only visible when authentication is enabled
- Tooltip on hover
- Confirmation modal before logout
- Clears session and redirects to login

**Components Used:**
- Mantine: `ActionIcon`, `Tooltip`
- Mantine Modals: Confirmation dialog
- Tabler Icons: `IconLogout`

## Internationalization

### Supported Languages

- **English** (`en`): `src/locales/en/auth.json`
- **Chinese** (`zh`): `src/locales/zh/auth.json`

### Translation Keys

```json
{
  "login_title": "Welcome Back",
  "login_subtitle": "Sign in to access Meilisearch UI",
  "username": "Username",
  "password": "Password",
  "login_button": "Sign In",
  "invalid_credentials": "Invalid username or password",
  "logout": "Logout",
  "logout_confirm": "Are you sure you want to logout?"
}
```

### Adding Translations

1. Create new locale file: `src/locales/<lang>/auth.json`
2. Copy keys from `en/auth.json`
3. Translate values
4. Language selector in header will automatically include new language

## Testing

### Manual Testing Checklist

#### Authentication Enabled
- [ ] Visit `/` → redirects to `/login`
- [ ] Visit `/login` → shows login form
- [ ] Submit empty form → validation errors
- [ ] Submit wrong credentials → error message
- [ ] Submit correct credentials → redirects to home
- [ ] After login, visit `/` → shows dashboard
- [ ] After login, visit `/login` → redirects to home
- [ ] Click logout button → shows confirmation
- [ ] Confirm logout → redirects to login
- [ ] Close browser → session cleared, must login again
- [ ] Visit protected route directly → redirects to login with return URL
- [ ] After login, redirects to original route

#### Authentication Disabled
- [ ] Visit `/` → shows dashboard (no login)
- [ ] Visit `/login` → accessible (but no enforcement)
- [ ] No logout button in header
- [ ] All routes accessible without login

#### Singleton Mode + Authentication
- [ ] Authentication works with singleton mode
- [ ] After login, redirects to `/ins/0`
- [ ] Singleton mode validation still works
- [ ] Logout button visible in instance header

### Integration Testing

```typescript
// Test authentication functions
import { login, logout, isAuthenticated, isAuthRequired } from '@/lib/auth';

// Test login
const success = await login('admin', 'password');
console.assert(success === true, 'Login should succeed');
console.assert(isAuthenticated() === true, 'Should be authenticated');

// Test logout
logout();
console.assert(isAuthenticated() === false, 'Should not be authenticated');

// Test disabled auth
// (Remove VITE_AUTH_* from environment)
console.assert(isAuthRequired() === false, 'Auth should be disabled');
console.assert(isAuthenticated() === true, 'Should allow access');
```

## Troubleshooting

### Common Issues

#### Issue: Login page not showing
**Cause:** Authentication not enabled (env vars missing)
**Solution:** Set `VITE_AUTH_USERNAME` and `VITE_AUTH_PASSWORD` in `.env.local`

#### Issue: Always redirects to login even after successful login
**Cause:** sessionStorage not working or being cleared
**Solution:**
- Check browser console for errors
- Verify sessionStorage is not disabled
- Check browser privacy settings
- Ensure `setAuthenticated(true)` is called after login

#### Issue: "Invalid credentials" with correct password
**Cause:** Environment variables not loaded or changed after build
**Solution:**
- Restart dev server (`pnpm run dev`)
- Rebuild application (`pnpm run build`)
- Check `import.meta.env.VITE_AUTH_PASSWORD` in browser console

#### Issue: Docker authentication not working
**Cause:** Using `VITE_` prefix in Docker environment variables
**Solution:** Use unprefixed variables:
```bash
# ❌ Wrong
-e VITE_AUTH_USERNAME=admin

# ✅ Correct
-e AUTH_USERNAME=admin
```

#### Issue: Infinite redirect loop
**Cause:** Route protection logic conflict
**Solution:**
- Check browser console for errors
- Clear browser cache and cookies
- Clear sessionStorage: `sessionStorage.clear()`
- Check that `/login` route is excluded from protection

#### Issue: Logout button not visible
**Cause:** Authentication not enabled
**Solution:** Logout button only shows when `isAuthRequired()` returns `true`

### Debug Mode

Enable debug logging in browser console:

```javascript
// Check authentication state
console.log('Auth Required:', import.meta.env.VITE_AUTH_USERNAME ? 'Yes' : 'No');
console.log('Authenticated:', sessionStorage.getItem('meilisearch-ui-auth'));
console.log('Store State:', useAppStore.getState().isAuthenticated);

// Test login manually
import { login } from '@/lib/auth';
await login('admin', 'your-password');

// Check environment
console.log(import.meta.env);
```

### Debug Logs

The authentication system includes debug logging:
- `[auth] Login successful`
- `[auth] Login failed - invalid credentials`
- `[auth] User logged out`
- `[auth] User not authenticated, redirecting to login`
- `[auth] User already authenticated, redirecting to home`
- `[login] Authentication successful, redirecting...`

## Best Practices

### Development
1. Use `.env.local` for local credentials
2. Never commit `.env.local` to version control
3. Use strong passwords even in development
4. Test both authenticated and unauthenticated states

### Production
1. **Use Reverse Proxy Auth**: Nginx, Caddy, or Traefik
2. **Enable HTTPS**: Never use HTTP for authentication
3. **Use Strong Passwords**: Minimum 16 characters, random
4. **Rotate Credentials**: Change passwords regularly
5. **Monitor Access**: Log authentication attempts
6. **Rate Limiting**: Implement at reverse proxy level
7. **Network Security**: Deploy behind firewall or VPN

### Docker
1. Use Docker secrets for credentials
2. Don't hardcode passwords in Dockerfiles
3. Use environment variables at runtime
4. Rebuild containers when changing credentials

## Advanced Configuration

### Custom Password Hashing

To use a different hashing algorithm, modify `src/lib/auth.ts`:

```typescript
// Example: Using bcrypt (requires npm package)
import bcrypt from 'bcryptjs';

async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}
```

### Session Timeout

To add session timeout, modify `src/lib/auth.ts`:

```typescript
const AUTH_TIMEOUT = 30 * 60 * 1000; // 30 minutes

export const login = async (username: string, password: string): Promise<boolean> => {
  // ... existing login logic ...

  if (usernameMatch && passwordMatch) {
    const expiresAt = Date.now() + AUTH_TIMEOUT;
    sessionStorage.setItem(AUTH_SESSION_KEY, 'authenticated');
    sessionStorage.setItem('auth-expires', expiresAt.toString());
    return true;
  }

  return false;
};

export const isAuthenticated = (): boolean => {
  if (!isAuthRequired()) return true;

  const authState = sessionStorage.getItem(AUTH_SESSION_KEY);
  const expiresAt = sessionStorage.getItem('auth-expires');

  if (authState !== 'authenticated') return false;
  if (!expiresAt) return false;

  const now = Date.now();
  const expires = parseInt(expiresAt, 10);

  if (now > expires) {
    logout();
    return false;
  }

  return true;
};
```

### Multi-User Support

For multi-user support, you'll need to implement a backend authentication system:

1. Create authentication API endpoints
2. Store user credentials in database (hashed with bcrypt)
3. Use JWT tokens for authentication
4. Implement refresh tokens
5. Add user management UI

This is beyond the scope of basic authentication and requires significant architectural changes.

## Migration from No Auth

If you have an existing deployment without authentication:

1. **Plan Downtime**: Authentication requires rebuild
2. **Set Environment Variables**: Add `VITE_AUTH_USERNAME` and `VITE_AUTH_PASSWORD`
3. **Rebuild Application**: `pnpm run build` or rebuild Docker container
4. **Deploy**: Replace old deployment with new build
5. **Test**: Verify login works before users access
6. **Communicate**: Inform users of new login requirement and credentials

## Security Checklist

Before deploying with authentication:

- [ ] Changed default credentials from `.env.example`
- [ ] Using HTTPS (not HTTP)
- [ ] Strong password (16+ characters, random)
- [ ] Credentials not in version control
- [ ] Credentials not in Docker image layers
- [ ] Using Docker secrets or environment variables
- [ ] Rate limiting enabled (reverse proxy)
- [ ] Access logs enabled
- [ ] Regular security updates
- [ ] Network firewall configured
- [ ] Backup and recovery plan

## Limitations

1. **Single User**: Only one set of credentials
2. **Build-Time**: Credentials embedded at build time
3. **No User Management**: Cannot add/remove users without rebuild
4. **No Role-Based Access**: All authenticated users have full access
5. **No Audit Log**: No logging of user actions
6. **No Password Reset**: Must rebuild to change password
7. **No Multi-Factor Auth**: Username/password only
8. **Basic Security**: Not suitable for high-security environments

## Future Improvements

Potential enhancements (not implemented):
- Multi-user support with database
- Role-based access control (RBAC)
- OAuth2/OIDC integration
- Two-factor authentication (2FA)
- Session management UI
- Password reset functionality
- User activity audit log
- API key management
- Rate limiting (client-side)
- Remember me functionality
- Social login providers

## Support

For issues or questions:
- GitHub Issues: https://github.com/riccox/meilisearch-ui/issues
- Documentation: See TECHNICAL_ANALYSIS.md for architecture details

## License

Same as main project (Apache-2.0)
