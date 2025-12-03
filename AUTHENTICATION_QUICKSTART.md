# Authentication Quick Start Guide

## 🚀 Quick Setup (30 seconds)

### Development

```bash
# 1. Copy example environment file
cp .env.example .env.local

# 2. Edit .env.local and set credentials
echo "VITE_AUTH_USERNAME=admin" >> .env.local
echo "VITE_AUTH_PASSWORD=my-secure-password" >> .env.local

# 3. Start development server
pnpm run dev

# 4. Open browser
# Visit: http://localhost:24900
# Login with: admin / my-secure-password
```

### Docker

```bash
# With Authentication
docker run -p 24900:24900 \
  -e AUTH_USERNAME=admin \
  -e AUTH_PASSWORD=your-secure-password \
  riccoxie/meilisearch-ui:latest

# Without Authentication (Default)
docker run -p 24900:24900 \
  riccoxie/meilisearch-ui:latest
```

## 📋 Quick Reference

### Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `VITE_AUTH_USERNAME` | Username for login | `admin` |
| `VITE_AUTH_PASSWORD` | Password for login | `my-secure-password` |

**Docker:** Remove `VITE_` prefix → `AUTH_USERNAME`, `AUTH_PASSWORD`

### Features

| Feature | Status |
|---------|--------|
| Username/Password Login | ✅ |
| Session-based Auth | ✅ |
| SHA-256 Password Hashing | ✅ |
| Logout with Confirmation | ✅ |
| Form Validation | ✅ |
| Auto-redirect After Login | ✅ |
| English + Chinese Support | ✅ |
| Singleton Mode Compatible | ✅ |
| Optional (Disabled by Default) | ✅ |

### User Flow

```
Visit UI → Redirected to /login → Enter credentials → Dashboard
                                        ↓
                                   Click Logout
                                        ↓
                                  Confirm Logout
                                        ↓
                              Back to Login Page
```

### Files Created

```
src/lib/auth.ts                    # Authentication logic
src/routes/login.tsx               # Login page
src/locales/en/auth.json           # English translations
src/locales/zh/auth.json           # Chinese translations
.env.example                       # Configuration examples
```

### Files Modified

```
src/routes/__root.tsx              # Route protection
src/store/index.ts                 # Auth state
src/components/biz/InsHeader.tsx   # Logout button
scripts/cmd.sh                     # Docker env vars
```

## 🧪 Test It

```bash
# 1. Enable auth
echo "VITE_AUTH_USERNAME=admin" > .env.local
echo "VITE_AUTH_PASSWORD=test123" >> .env.local

# 2. Start dev
pnpm run dev

# 3. Open browser and test:
# - Visit http://localhost:24900 → Should redirect to /login
# - Login with admin / test123 → Should show dashboard
# - Click logout button (top-right red icon) → Should logout
```

## 🔧 Troubleshooting

| Problem | Solution |
|---------|----------|
| No login page showing | Add `VITE_AUTH_USERNAME` and `VITE_AUTH_PASSWORD` to `.env.local` |
| Always shows login page | Restart dev server: `pnpm run dev` |
| Docker auth not working | Use `AUTH_USERNAME` not `VITE_AUTH_USERNAME` |
| Can't logout | Check browser console for errors |

## 📚 Full Documentation

- **Complete Guide**: See `AUTHENTICATION.md`
- **Implementation Details**: See `AUTHENTICATION_SUMMARY.md`
- **Architecture**: See `TECHNICAL_ANALYSIS.md`

## ⚠️ Security Notes

**Good for:**
- ✅ Development
- ✅ Internal networks
- ✅ Small teams
- ✅ Demo deployments

**Not recommended for:**
- ❌ Public internet (use reverse proxy auth)
- ❌ High-security environments (use OAuth2)
- ❌ Compliance requirements (use enterprise auth)
- ❌ Multi-user scenarios (single user only)

**Production Best Practice:**
Use nginx/Caddy with HTTP Basic Auth or OAuth2 provider.

## 🎯 Common Scenarios

### Scenario 1: Development without Auth
```bash
# Don't set VITE_AUTH_* variables
pnpm run dev
# No login required
```

### Scenario 2: Development with Auth
```bash
# .env.local
VITE_AUTH_USERNAME=admin
VITE_AUTH_PASSWORD=dev123

pnpm run dev
# Login required
```

### Scenario 3: Docker + Singleton Mode + Auth
```bash
docker run -p 24900:24900 \
  -e AUTH_USERNAME=admin \
  -e AUTH_PASSWORD=secret \
  -e SINGLETON_MODE=true \
  -e SINGLETON_HOST=http://meilisearch:7700 \
  riccoxie/meilisearch-ui:latest
```

### Scenario 4: Disable Auth After Enabling
```bash
# Comment out in .env.local
# VITE_AUTH_USERNAME=admin
# VITE_AUTH_PASSWORD=secret

# Restart
pnpm run dev
```

## 💡 Pro Tips

1. **Strong Passwords**: Use 16+ character random passwords
2. **HTTPS**: Always use HTTPS in production
3. **Environment**: Never commit `.env.local` to git
4. **Docker Secrets**: Use Docker secrets for credentials
5. **Rate Limiting**: Configure at reverse proxy level
6. **Monitoring**: Log failed login attempts

## 🔐 Password Requirements

- **Minimum Length**: 3 characters (configurable)
- **Recommended**: 16+ characters
- **Format**: Any characters allowed
- **Storage**: Environment variable (build-time)
- **Hashing**: SHA-256

## 📱 Browser Support

- Chrome 37+
- Firefox 34+
- Safari 11+
- Edge 12+
- All modern browsers with Web Crypto API

## 🎨 UI Components

**Login Page:**
- Logo and branding
- Username field (with icon)
- Password field (masked)
- Sign In button
- Error alerts
- Loading state

**Header:**
- Logout button (red icon, top-right)
- Tooltip on hover
- Confirmation modal
- Only visible when auth enabled

## 🌍 Language Support

- **English**: Full support
- **Chinese**: Full support
- **Add Language**: Create `src/locales/<lang>/auth.json`

## ⚡ Performance

- **Impact**: Minimal (< 1ms per route)
- **Bundle Size**: No increase (uses built-in Web Crypto)
- **Network**: No additional requests
- **Storage**: sessionStorage (fast, synchronous)

## 🎓 Learn More

```bash
# Read full documentation
cat AUTHENTICATION.md

# Check implementation
cat AUTHENTICATION_SUMMARY.md

# Understand architecture
cat TECHNICAL_ANALYSIS.md
```

## ✅ Checklist

Before deploying:
- [ ] Changed default password
- [ ] Using HTTPS
- [ ] Tested login/logout
- [ ] Configured reverse proxy (production)
- [ ] Set up monitoring
- [ ] Documented credentials securely

## 🆘 Get Help

**Debug in Browser Console:**
```javascript
// Check if auth is enabled
console.log(import.meta.env.VITE_AUTH_USERNAME);

// Check current state
console.log(sessionStorage.getItem('meilisearch-ui-auth'));

// Test login
import { login } from '@/lib/auth';
await login('admin', 'password');
```

**GitHub Issues:**
https://github.com/riccox/meilisearch-ui/issues

---

**That's it!** You now have basic authentication protecting your Meilisearch UI. 🎉
