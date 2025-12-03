# Meilisearch UI - Technical Analysis & Architecture Documentation

## Table of Contents
1. [Application Architecture](#application-architecture)
2. [Environment Variable System](#environment-variable-system)
3. [Connection & Authentication Flow](#connection--authentication-flow)
4. [Warning/Error Pages](#warningerror-pages)
5. [Build vs Runtime Behavior](#build-vs-runtime-behavior)
6. [Key Files Reference](#key-files-reference)
7. [Singleton Mode Deep Dive](#singleton-mode-deep-dive)
8. [Debugging Guide](#debugging-guide)

---

## Application Architecture

### Overview
Meilisearch UI is a React-based single-page application (SPA) built with:
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite 6
- **Router**: TanStack Router
- **State Management**: Zustand (with persistence)
- **Styling**: UnoCSS + TailwindCSS
- **Query Management**: TanStack Query (React Query)
- **UI Libraries**: Mantine, Semi-Design, Arco Design

### Project Structure

```
src/
├── main.tsx                          # Application entry point
├── routes/                           # File-based routing
│   ├── __root.tsx                   # Root layout
│   ├── index.tsx                    # Dashboard (/ route)
│   ├── warning.tsx                  # Warning/error page
│   └── ins/$insID/                  # Instance-specific routes
│       ├── _layout.tsx              # Instance layout wrapper
│       └── _layout/                 # Instance sub-routes
│           ├── index.tsx            # Instance dashboard
│           ├── keys.tsx             # API keys management
│           └── tasks.tsx            # Tasks monitoring
├── hooks/                           # React hooks
│   ├── useCurrentInstance.ts        # Instance detection & validation
│   ├── useMeiliClient.ts            # MeiliSearch client creation
│   └── useRoutePreCheck.ts          # Navigation pre-validation
├── lib/                             # Utilities
│   ├── conn.ts                      # Connection & singleton logic
│   ├── i18n.ts                      # Internationalization
│   └── toast.ts                     # Toast notifications
├── store/                           # Global state management
│   └── index.ts                     # Zustand store
├── components/                      # UI components
│   ├── biz/                         # Business components
│   └── common/                      # Shared components
└── locales/                         # Translation files
    ├── en/                          # English
    └── zh/                          # Chinese
```

### Application Entry Points

#### 1. Main Entry (`src/main.tsx`)
```typescript
// Line 30-52
const router = createRouter({
  routeTree,
  basepath: import.meta.env.BASE_URL || "/",
  context: { queryClient },
  defaultPreload: "intent",
  defaultPendingComponent: LoadingScreen,
  defaultPreloadStaleTime: 0,
  defaultNotFoundComponent: NotFound,
});
```

**Key Points:**
- Router initialized with base path from `import.meta.env.BASE_URL`
- Integrates React Query for data fetching
- Provides default loading and 404 components

#### 2. Router Flow
```
User visits URL
    ↓
main.tsx initializes router
    ↓
Route matching (TanStack Router)
    ↓
beforeLoad hook execution (if defined)
    ↓
Route component render
    ↓
Layout components render
    ↓
Page content render
```

### Singleton Mode Implementation

#### What is Singleton Mode?
Singleton mode is a deployment configuration where the UI is pre-configured to connect to a **single, specific** Meilisearch instance. Unlike multi-mode (default), users cannot add, edit, or remove instances.

#### How It Works

**Instance ID 0 is Reserved**
From `src/store/index.ts:58-59`:
```typescript
// start from 1, id 0 is reserved for singleton mode
id: (_.maxBy(get().instances, "id")?.id || 0) + 1,
```

**Detection Function**
From `src/lib/conn.ts:54-56`:
```typescript
export const isSingletonMode = (): boolean => {
  return String(import.meta.env.VITE_SINGLETON_MODE) === "true";
};
```

**Configuration Retrieval**
From `src/lib/conn.ts:60-70`:
```typescript
export const getSingletonCfg = (): false | Instance => {
  if (isSingletonMode()) {
    return {
      id: 0,
      name: "",
      host: import.meta.env.VITE_SINGLETON_HOST,
      apiKey: import.meta.env.VITE_SINGLETON_API_KEY,
    };
  }
  return false;
};
```

**Automatic Redirect**
From `src/routes/index.tsx:220-228`:
```typescript
beforeLoad: async () => {
  if (isSingletonMode()) {
    throw redirect({
      to: "/ins/$insID",
      params: {
        insID: "0",
      },
    });
  }
}
```

When singleton mode is enabled, users are immediately redirected from the dashboard (`/`) to the instance view (`/ins/0`).

---

## Environment Variable System

### How Vite Handles Environment Variables

#### Build-Time Processing
Vite processes environment variables at **build time**, not runtime. This means:
1. Environment variables are read during `vite build`
2. Values are **embedded** into the JavaScript bundle
3. The bundled code contains the actual values, not variable references

#### Variable Exposure Rules
From `vite.config.ts:26-29`:
```typescript
// Set the third parameter to "" to load all environment variables,
// regardless of whether they exist or not 'VITE_' prefix.
const env = loadEnv(mode, process.cwd(), "");
```

**Important:** Only `VITE_*` prefixed variables are exposed to client-side code via `import.meta.env`.

### Singleton Mode Environment Variables

#### Required Variables
| Variable | Purpose | Example |
|----------|---------|---------|
| `VITE_SINGLETON_MODE` | Enable singleton mode | `"true"` |
| `VITE_SINGLETON_HOST` | Meilisearch server URL | `"http://localhost:7700"` |
| `VITE_SINGLETON_API_KEY` | Master API key | `"your-master-key"` |

#### Configuration Methods

**1. Development (.env.local)**
```bash
VITE_SINGLETON_MODE=true
VITE_SINGLETON_HOST=http://localhost:7700
VITE_SINGLETON_API_KEY=your-api-key
```

**2. Docker Runtime**
From `scripts/cmd.sh:4-17`:
```bash
# Transform singleton mode environment variables
if [ ! -z "$SINGLETON_HOST" ]; then
  export VITE_SINGLETON_HOST="$SINGLETON_HOST"
fi

if [ ! -z "$SINGLETON_API_KEY" ]; then
  export VITE_SINGLETON_API_KEY="$SINGLETON_API_KEY"
fi

if [ ! -z "$SINGLETON_MODE" ]; then
  export VITE_SINGLETON_MODE="$SINGLETON_MODE"
  if [ "$SINGLETON_MODE" = "true" ]; then
    echo "Singleton mode enabled"
  fi
fi
```

**Docker Command:**
```bash
docker run -p 24900:24900 \
  -e SINGLETON_MODE=true \
  -e SINGLETON_HOST=http://meilisearch:7700 \
  -e SINGLETON_API_KEY=your-master-key \
  riccoxie/meilisearch-ui:latest
```

The `cmd.sh` script transforms user-friendly `SINGLETON_*` variables into `VITE_SINGLETON_*` variables, then runs the build and preview commands.

### Base Path Configuration

From `vite.config.ts:32`:
```typescript
base: env.BASE_PATH || "MEILI_UI_REPLACE_BASE_PATH",
```

From `scripts/post-build.js:44-46`:
```javascript
// Replace the placeholder with empty string (root path)
content = content.replace(/MEILI_UI_REPLACE_BASE_PATH\//g, "");
content = content.replace(/MEILI_UI_REPLACE_BASE_PATH/g, "");
```

**How It Works:**
1. During build, Vite sets `base` to `BASE_PATH` env var or placeholder
2. Post-build script replaces placeholder with root path (`/`) for non-Docker deployments
3. Docker deployments can set custom base paths via environment variable

---

## Connection & Authentication Flow

### Complete Initialization Sequence

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Application Starts (main.tsx)                                │
│    - Router initialized                                         │
│    - Base path set from import.meta.env.BASE_URL              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Route Matching                                               │
│    - TanStack Router matches URL to route                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. beforeLoad Hook (index.tsx:220)                             │
│    ┌────────────────────────────────────────┐                  │
│    │ if (isSingletonMode()) {               │                  │
│    │   redirect to /ins/0                   │                  │
│    │ } else {                               │                  │
│    │   show dashboard                       │                  │
│    │ }                                      │                  │
│    └────────────────────────────────────────┘                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Instance Layout Mount (ins/$insID/_layout.tsx)              │
│    - Header component renders                                   │
│    - Outlet for child routes                                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. useCurrentInstance Hook Executes                            │
│    ┌────────────────────────────────────────┐                  │
│    │ if (!isSingletonMode()) {              │                  │
│    │   // Multi-mode                        │                  │
│    │   return instances.find(i => i.id === insID)            │
│    │   if (!found) {                        │                  │
│    │     toast.error()                      │                  │
│    │     redirect to home                   │                  │
│    │   }                                    │                  │
│    │ } else {                               │                  │
│    │   // Singleton mode                    │                  │
│    │   config = getSingletonCfg()           │                  │
│    │   if (!config) {                       │                  │
│    │     setWarningPageData()               │                  │
│    │     redirect to /warning               │ ← VALIDATION 1   │
│    │   }                                    │                  │
│    │   return config                        │                  │
│    │ }                                      │                  │
│    └────────────────────────────────────────┘                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. useMeiliClient Hook Executes                                │
│    ┌────────────────────────────────────────┐                  │
│    │ if (_.isEmpty(currentInstance?.host)) { │                  │
│    │   toast.error()                        │                  │
│    │   if (isSingletonMode()) {             │                  │
│    │     setWarningPageData()               │                  │
│    │     redirect to /warning               │ ← VALIDATION 2   │
│    │   } else {                             │                  │
│    │     redirect to home                   │                  │
│    │   }                                    │                  │
│    │   return                               │                  │
│    │ }                                      │                  │
│    │                                        │                  │
│    │ const conn = new MeiliSearch(config)   │                  │
│    │ try {                                  │                  │
│    │   await conn.getStats()                │ ← CONNECTION TEST│
│    │   setClient(conn)                      │                  │
│    │ } catch (err) {                        │                  │
│    │   toast.error()                        │                  │
│    │   if (isSingletonMode()) {             │                  │
│    │     setWarningPageData()               │                  │
│    │     redirect to /warning               │ ← VALIDATION 3   │
│    │   } else {                             │                  │
│    │     redirect to home                   │                  │
│    │   }                                    │                  │
│    │ }                                      │                  │
│    └────────────────────────────────────────┘                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. Component Render                                             │
│    - Instance dashboard displays                                │
│    - Data fetching begins via React Query                      │
└─────────────────────────────────────────────────────────────────┘
```

### Validation Points

#### Validation 1: Configuration Exists
**Location:** `src/hooks/useCurrentInstance.ts:35-42`
```typescript
// singleton mode
if (!currentInstance) {
  toast.error(`${t("not_found")} 🤥`);
  console.debug("useCurrentInstance", "Singleton Instance lost");
  setWarningPageData({ prompt: t("instance:singleton_cfg_not_found") });
  // do not use useNavigate, because maybe in first render
  const baseUrl = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
  window.location.assign(`${baseUrl}/warning`);
}
```

**What It Checks:**
- `VITE_SINGLETON_HOST` is defined and not empty
- `VITE_SINGLETON_API_KEY` is defined (can be empty string)

**Failure Causes:**
- Missing `VITE_SINGLETON_MODE=true` in environment
- Missing `VITE_SINGLETON_HOST` variable
- Empty `VITE_SINGLETON_HOST` value

#### Validation 2: Host Configuration
**Location:** `src/hooks/useMeiliClient.ts:23-36`
```typescript
const connect = useCallback(async () => {
  if (_.isEmpty(currentInstance?.host)) {
    toast.error(t("connection_failed"));
    console.debug("useMeilisearchClient", "connection config lost");
    if (!isSingletonMode()) {
      window.location.assign(import.meta.env.BASE_URL ?? "/");
    } else {
      setWarningPageData({ prompt: t("instance:singleton_cfg_not_found") });
      const baseUrl = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
      window.location.assign(`${baseUrl}/warning`);
    }
    return;
  }
  // ... continues to validation 3
}, [currentInstance, setWarningPageData, t]);
```

**What It Checks:**
- Host URL is not undefined, null, or empty string

#### Validation 3: Connection Test
**Location:** `src/hooks/useMeiliClient.ts:37-53`
```typescript
const conn = new MeiliSearch({ ...currentInstance });
try {
  await conn.getStats();
  setClient(conn);
} catch (err) {
  console.warn("useMeilisearchClient", "test conn error", err);
  toast.error(t("connection_failed"));
  if (!isSingletonMode()) {
    window.location.assign(import.meta.env.BASE_URL ?? "/");
  } else {
    setWarningPageData({ prompt: t("instance:singleton_cfg_not_found") });
    const baseUrl = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
    window.location.assign(`${baseUrl}/warning`);
  }
}
```

**What It Tests:**
- Network connectivity to Meilisearch server
- Server is running and responding
- CORS is properly configured
- API endpoint is accessible

**Failure Causes:**
- Wrong host URL (typo, wrong port, wrong protocol)
- Meilisearch server is down
- Network connectivity issues
- CORS headers not configured on Meilisearch
- Firewall blocking requests

### Connection Test Function
**Location:** `src/lib/conn.ts:13-35`
```typescript
export const testConnection = async (cfg: Config) => {
  showConnectionTestLoader();
  const client = new MeiliSearch({ ...cfg });
  let stats: Stats;
  try {
    stats = await client.getStats();
    console.debug("[meilisearch connection test]", stats);
  } catch (e) {
    console.warn("[meilisearch connection test error]", e);
    toast.error(t("instance:connection_failed"));
    // stop loading when error.
    hiddenConnectionTestLoader();
    throw e;
  }
  // stop loading
  hiddenConnectionTestLoader();
  if (_.isEmpty(stats)) {
    const msg = t("instance:connection_failed");
    toast.error(msg);
    console.error(msg, stats);
    throw new Error("msg");
  }
};
```

This function is called when users click on instances in multi-mode, but in singleton mode, the connection test happens automatically in `useMeiliClient`.

### CORS Requirements

The Meilisearch server **must** have CORS enabled for the UI domain. From `src/locales/en/instance.json:48`:
```json
"tip": "Remember enable CORS in your instance server for this ui domain first"
```

**How to Enable CORS in Meilisearch:**
```bash
# Development
meilisearch --http-cors '*'

# Production (specific domain)
meilisearch --http-cors 'https://your-ui-domain.com'
```

### Authentication with API Keys

The `apiKey` field can be:
- **Master key**: Full access to all operations
- **API key**: Limited access based on key permissions
- **Empty/undefined**: Public access only (if Meilisearch allows)

**Location:** `src/lib/conn.ts:40-49`
```typescript
export const validateKeysRouteAvailable = (
  apiKey?: string,
): null | WarningPageData => {
  if (_.isEmpty(apiKey)) {
    return {
      prompt: t("instance:no_master_key_error"),
    };
  }
  return null;
};
```

When navigating to the Keys management page, the app validates that a master key is configured, as this endpoint requires authentication.

---

## Warning/Error Pages

### Warning Page Component
**Location:** `src/routes/warning.tsx`

**Route:** `/warning`

**Component Code:**
```typescript
function Warning() {
  const { history } = useRouter();
  const { t } = useTranslation("sys");
  const warningPageData = useAppStore((state) => state.warningPageData);
  return (
    <div className="full-page bg-night gap-y-10 justify-center items-center">
      <div className={"flex gap-6 items-center"}>
        <Logo />
        <h1 className={"text-4xl font-bold text-primary-100"}>
          {t("warning")}
        </h1>
      </div>
      {warningPageData?.prompt && (
        <p className="text-primary-100 font-semibold text-base whitespace-pre-line text-balance text-center">
          {warningPageData.prompt}
        </p>
      )}
      <div className="flex gap-3">
        <Button color={"orange"} onClick={() => window.location.assign(window.location.origin)}>
          {t("reload")}
        </Button>
        <Button variant={"gradient"} color={"blue"} onClick={() => history.back()}>
          {t("back")}
        </Button>
      </div>
      <Footer />
    </div>
  );
}
```

### Warning Page State Management

**Store Definition:** `src/store/index.ts:9-11`
```typescript
export interface WarningPageData {
  prompt: string;
}
```

**Store State:** `src/store/index.ts:28`
```typescript
warningPageData?: WarningPageData;
```

**Setter Function:** `src/store/index.ts:45-50`
```typescript
setWarningPageData: (data?: WarningPageData) =>
  set(
    produce((state: State) => {
      state.warningPageData = data;
    }),
  ),
```

### Error Messages

#### 1. Singleton Configuration Not Found
**Message Key:** `instance:singleton_cfg_not_found`

**English:** `src/locales/en/instance.json:35`
```json
"singleton_cfg_not_found": "Singleton mode detected! Connection fail!\nRunning with invalid instance config, you must have set correct instance env config before launch."
```

**When Displayed:**
- `VITE_SINGLETON_MODE=true` but `VITE_SINGLETON_HOST` is missing
- `VITE_SINGLETON_MODE=true` but `VITE_SINGLETON_HOST` is empty
- Connection test to configured host fails

**Trigger Locations:**
1. `src/hooks/useCurrentInstance.ts:38`
2. `src/hooks/useMeiliClient.ts:30`
3. `src/hooks/useMeiliClient.ts:48`

#### 2. Connection Failed
**Message Key:** `instance:connection_failed`

**English:** `src/locales/en/instance.json:12`
```json
"connection_failed": "Connection fail, go check your config! 🤥"
```

**When Displayed:**
- Network request to Meilisearch fails
- CORS error occurs
- Server returns error response
- Empty stats response

**Trigger Locations:**
1. `src/lib/conn.ts:22` (with toast)
2. `src/lib/conn.ts:31` (with toast)
3. `src/hooks/useMeiliClient.ts:24` (with toast)
4. `src/hooks/useMeiliClient.ts:43` (with toast)

#### 3. No Master Key Error
**Message Key:** `instance:no_master_key_error`

**English:** `src/locales/en/instance.json:34`
```json
"no_master_key_error": "Meilisearch is running without a master key.\nTo access this API endpoint, you must have set a master key at launch."
```

**When Displayed:**
- User attempts to access `/ins/$insID/keys` route
- No API key is configured for the instance

**Trigger Location:**
1. `src/routes/index.tsx:36-38` via `validateKeysRouteAvailable`

### Navigation Pre-Check System

**Location:** `src/hooks/useRoutePreCheck.ts`

**Purpose:** Validates navigation before it occurs, redirecting to warning page if validation fails.

**Implementation:**
```typescript
export const useNavigatePreCheck = (
  pre: (params: NavigateFuncParams, opt?: any) => null | WarningPageData,
): NavigateFunc => {
  const navigate = useNavigate();
  const setWarningPageData = useAppStore((state) => state.setWarningPageData);

  const ret: NavigateFunc = useCallback(
    (params: NavigateFuncParams, opt?: any) => {
      console.debug("useNavigatePreCheck", params);
      const preFuncRes = pre(params, opt);
      if (preFuncRes !== null) {
        setWarningPageData(preFuncRes);
        navigate({ to: "/warning" });
      } else {
        navigate(params ?? {});
      }
    },
    [navigate, pre, setWarningPageData],
  );

  return ret;
};
```

**Usage Example:** `src/routes/index.tsx:33-40`
```typescript
const navigate = useNavigatePreCheck((params, opt) => {
  console.debug("dashboard", "navigate", params.to, opt?.currentInstance);
  if (typeof params.to === "string" && /\/keys$/.test(params.to)) {
    // check before keys page (no masterKey will cause error)
    return validateKeysRouteAvailable(opt?.currentInstance?.apiKey);
  }
  return null;
});
```

---

## Build vs Runtime Behavior

### Build Time (Development)

**Command:** `pnpm run dev`

**Process:**
1. Vite loads `.env.local` file (if exists)
2. Reads all `VITE_*` prefixed variables
3. Injects variables into code via `import.meta.env`
4. Starts dev server on `http://localhost:24900`
5. **Variables are read in real-time** (hot reload)

**Example `.env.local`:**
```bash
VITE_SINGLETON_MODE=true
VITE_SINGLETON_HOST=http://localhost:7700
VITE_SINGLETON_API_KEY=master_key_123
```

### Build Time (Production)

**Command:** `pnpm run build`

**From `package.json:8`:**
```json
"build": "vite build && node scripts/post-build.js"
```

**Process:**
1. Vite loads environment variables from `.env.production` (if exists) or system environment
2. Reads all `VITE_*` prefixed variables
3. **Replaces** `import.meta.env.VITE_*` with actual string values in code
4. Bundles JavaScript/CSS into `dist/` directory
5. **Variables are permanently embedded** in bundle
6. Post-build script replaces `MEILI_UI_REPLACE_BASE_PATH` placeholder

**Critical Point:** Once built, the environment variables **cannot be changed** without rebuilding.

### Runtime (Docker)

**Command:** `./scripts/cmd.sh`

**From `Dockerfile:19`:**
```dockerfile
ENTRYPOINT ["./scripts/cmd.sh"]
```

**Process Flow:**
```bash
#!/bin/bash

# 1. Transform user-provided env vars to VITE_* format
if [ ! -z "$SINGLETON_HOST" ]; then
  export VITE_SINGLETON_HOST="$SINGLETON_HOST"
fi

if [ ! -z "$SINGLETON_API_KEY" ]; then
  export VITE_SINGLETON_API_KEY="$SINGLETON_API_KEY"
fi

if [ ! -z "$SINGLETON_MODE" ]; then
  export VITE_SINGLETON_MODE="$SINGLETON_MODE"
  if [ "$SINGLETON_MODE" = "true" ]; then
    echo "Singleton mode enabled"
  fi
fi

export BASE_PATH="${BASE_PATH:-/}"

# 2. Build the application (embeds env vars)
pnpm run build

# 3. Start preview server
pnpm run preview
```

**Key Insight:** Docker builds the application **at container startup**, not at image creation. This allows environment variables to be injected at runtime.

### Variable Injection Timeline

```
┌──────────────────────────────────────────────────────────────┐
│ Docker Image Build (Dockerfile)                             │
│ - Copies source code                                         │
│ - Installs dependencies                                      │
│ - Does NOT build application                                │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ Docker Container Start (docker run)                          │
│ - User provides -e SINGLETON_MODE=true                       │
│ - User provides -e SINGLETON_HOST=...                        │
│ - User provides -e SINGLETON_API_KEY=...                     │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ Entrypoint Script (scripts/cmd.sh)                          │
│ - Transforms SINGLETON_* to VITE_SINGLETON_*                 │
│ - Exports variables to shell environment                     │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ Vite Build (pnpm run build)                                 │
│ - Reads VITE_* from shell environment                        │
│ - Embeds values into JavaScript bundle                      │
│ - Output: dist/ directory with embedded values              │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ Preview Server (pnpm run preview)                           │
│ - Serves static files from dist/                            │
│ - Application runs with embedded env values                 │
└──────────────────────────────────────────────────────────────┘
```

### Static Build (Vercel, Netlify, etc.)

**Command:** `pnpm run build`

**Deployment Process:**
1. Build runs on deployment platform
2. Environment variables must be set in platform settings
3. Build creates static files with embedded variables
4. Post-build script replaces base path placeholder
5. Static files deployed to CDN
6. **Cannot change variables without redeploying**

**Important:** Unlike Docker, static deployments cannot change environment variables at runtime.

---

## Key Files Reference

### Core Configuration

#### `src/lib/conn.ts`
**Purpose:** Connection testing, singleton mode detection, and configuration retrieval

**Key Functions:**
- `isSingletonMode()`: Returns `true` if `VITE_SINGLETON_MODE === "true"`
- `getSingletonCfg()`: Returns singleton instance configuration or `false`
- `testConnection(cfg)`: Tests connection to Meilisearch server
- `validateKeysRouteAvailable(apiKey)`: Validates master key for keys page

**Lines of Interest:**
- 54-56: Singleton mode detection
- 60-70: Configuration retrieval
- 13-35: Connection test implementation

---

### Hooks

#### `src/hooks/useCurrentInstance.ts`
**Purpose:** Determines and validates current Meilisearch instance

**Validation Logic:**
```typescript
// Line 15-22: Get instance config
const currentInstance = useMemo(() => {
  if (!isSingletonMode()) {
    return instances.find((i) => i.id === Number.parseInt(insID || "1"));
  }
  return getSingletonCfg() as Instance | undefined;
}, [instances, insID]);

// Line 24-32: Multi-mode validation
if (!isSingletonMode()) {
  if (currentInstance && _.isEmpty(currentInstance)) {
    toast.error(`${t("not_found")} 🤥`);
    console.debug("useCurrentInstance", "Instance lost");
    window.location.assign(import.meta.env.BASE_URL ?? "/");
  }
  return currentInstance as Instance;
}

// Line 34-43: Singleton mode validation
if (!currentInstance) {
  toast.error(`${t("not_found")} 🤥`);
  console.debug("useCurrentInstance", "Singleton Instance lost");
  setWarningPageData({ prompt: t("instance:singleton_cfg_not_found") });
  const baseUrl = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
  window.location.assign(`${baseUrl}/warning`);
}
return currentInstance as Instance;
```

**Critical Points:**
- Uses `window.location.assign()` instead of router navigation (line 29, 41)
- Reason: Hook may execute during first render before router is ready

#### `src/hooks/useMeiliClient.ts`
**Purpose:** Creates and validates MeiliSearch client connection

**Connection Flow:**
```typescript
// Line 22-54: Connection callback
const connect = useCallback(async () => {
  // Validation 2: Check host exists
  if (_.isEmpty(currentInstance?.host)) {
    toast.error(t("connection_failed"));
    console.debug("useMeilisearchClient", "connection config lost");
    if (!isSingletonMode()) {
      window.location.assign(import.meta.env.BASE_URL ?? "/");
    } else {
      setWarningPageData({ prompt: t("instance:singleton_cfg_not_found") });
      const baseUrl = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
      window.location.assign(`${baseUrl}/warning`);
    }
    return;
  }

  // Validation 3: Test connection
  const conn = new MeiliSearch({ ...currentInstance });
  try {
    await conn.getStats();
    setClient(conn);
  } catch (err) {
    console.warn("useMeilisearchClient", "test conn error", err);
    toast.error(t("connection_failed"));
    if (!isSingletonMode()) {
      window.location.assign(import.meta.env.BASE_URL ?? "/");
    } else {
      setWarningPageData({ prompt: t("instance:singleton_cfg_not_found") });
      const baseUrl = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
      window.location.assign(`${baseUrl}/warning`);
    }
  }
}, [currentInstance, setWarningPageData, t]);

// Line 58-61: Effect hook
useEffect(() => {
  console.debug("useMeilisearchClient", "rebuilt meili client");
  connect().then();
}, [connect, currentInstance]);
```

**Critical Points:**
- Runs on every `currentInstance` change
- Performs actual network request to test connection
- Redirects to warning page on any connection failure

#### `src/hooks/useRoutePreCheck.ts`
**Purpose:** Higher-order navigation hook with pre-validation

**Usage Pattern:**
```typescript
const navigate = useNavigatePreCheck((params, opt) => {
  // Custom validation logic
  if (shouldShowWarning) {
    return { prompt: "Warning message" };
  }
  return null; // Allow navigation
});

// Later in component
navigate({ to: "/some/route" }, { currentInstance });
```

---

### Routing

#### `src/routes/index.tsx`
**Purpose:** Dashboard page with singleton mode redirect

**BeforeLoad Hook (Line 220-228):**
```typescript
beforeLoad: async () => {
  if (isSingletonMode()) {
    throw redirect({
      to: "/ins/$insID",
      params: {
        insID: "0",
      },
    });
  }
}
```

**Behavior:**
- Executes before route component renders
- Redirects to `/ins/0` in singleton mode
- Shows dashboard with instance list in multi-mode

#### `src/routes/warning.tsx`
**Purpose:** Warning/error page display

**State Source:**
```typescript
const warningPageData = useAppStore((state) => state.warningPageData);
```

**Actions:**
- **Reload Button (Line 32):** `window.location.assign(window.location.origin)`
- **Back Button (Line 39):** `history.back()`

#### `src/routes/ins/$insID/_layout.tsx`
**Purpose:** Layout wrapper for instance-specific routes

**Structure:**
```typescript
function InsLayout() {
  return (
    <div className="full-page">
      <Header />
      <Outlet />
    </div>
  );
}
```

This is where `useCurrentInstance` and `useMeiliClient` hooks are typically called by child routes.

---

### State Management

#### `src/store/index.ts`
**Purpose:** Global application state using Zustand

**Instance ID Reservation (Line 58-59):**
```typescript
// start from 1, id 0 is reserved for singleton mode
id: (_.maxBy(get().instances, "id")?.id || 0) + 1,
```

**State Interface:**
```typescript
interface State {
  warningPageData?: WarningPageData;
  instances: Instance[];
  language: SUPPORTED_LANGUAGE;
  setWarningPageData: (data?: WarningPageData) => void;
  addInstance: (cfg: Omit<Instance, "updatedTime" | "id">) => void;
  editInstance: (id: number, cfg: Omit<Instance, "updatedTime" | "id">) => void;
  removeInstance: (id: number) => void;
  removeAllInstances: () => void;
  setLanguage: (lang: SUPPORTED_LANGUAGE) => void;
}
```

**Persistence:**
```typescript
persist(
  (set, get) => ({ /* state implementation */ }),
  {
    name: "meilisearch-ui-store",
    version: 5,
  },
)
```

State is persisted to localStorage, except `warningPageData` (ephemeral).

---

### Build Configuration

#### `vite.config.ts`
**Purpose:** Vite build configuration

**Environment Variable Loading (Line 26-29):**
```typescript
// Set the third parameter to "" to load all environment variables,
// regardless of whether they exist or not 'VITE_' prefix.
const env = loadEnv(mode, process.cwd(), "");
env.BASE_PATH && console.debug("Using custom base path:", env.BASE_PATH);
```

**Base Path Configuration (Line 32):**
```typescript
base: env.BASE_PATH || "MEILI_UI_REPLACE_BASE_PATH",
```

**Key Points:**
- Loads ALL environment variables (not just VITE_*)
- Only VITE_* variables are exposed to client code
- BASE_PATH sets application base path
- Placeholder replaced by post-build script

#### `scripts/post-build.js`
**Purpose:** Replace base path placeholder in non-Docker builds

**Detection (Line 19-26):**
```javascript
const isDocker =
  process.env.BASE_PATH !== undefined && process.env.BASE_PATH !== "";

if (isDocker) {
  console.log("Docker environment detected, skipping post-build replacement");
  process.exit(0);
}
```

**Replacement (Line 44-46):**
```javascript
content = content.replace(/MEILI_UI_REPLACE_BASE_PATH\//g, "");
content = content.replace(/MEILI_UI_REPLACE_BASE_PATH/g, "");
```

#### `scripts/cmd.sh`
**Purpose:** Docker entrypoint script

**Variable Transformation:**
```bash
SINGLETON_HOST     → VITE_SINGLETON_HOST
SINGLETON_API_KEY  → VITE_SINGLETON_API_KEY
SINGLETON_MODE     → VITE_SINGLETON_MODE
```

**Execution:**
```bash
pnpm run build   # Embeds env vars into bundle
pnpm run preview # Serves static files
```

---

## Singleton Mode Deep Dive

### Why Singleton Mode Exists

**Use Case:** Organizations that want to deploy a dedicated UI instance for a single Meilisearch server without allowing users to configure connections.

**Benefits:**
- Simplified user experience (no connection management)
- Pre-configured authentication
- Reduced configuration errors
- Centralized deployment management

### Complete Validation Logic

#### Step 1: Mode Detection
```typescript
// src/lib/conn.ts:54-56
export const isSingletonMode = (): boolean => {
  return String(import.meta.env.VITE_SINGLETON_MODE) === "true";
};
```

**Validation:**
- ✅ `VITE_SINGLETON_MODE="true"`
- ✅ `VITE_SINGLETON_MODE=true`
- ❌ `VITE_SINGLETON_MODE="TRUE"` (case-sensitive)
- ❌ `VITE_SINGLETON_MODE="1"`
- ❌ `VITE_SINGLETON_MODE=undefined`

#### Step 2: Configuration Retrieval
```typescript
// src/lib/conn.ts:60-70
export const getSingletonCfg = (): false | Instance => {
  if (isSingletonMode()) {
    return {
      id: 0,
      name: "",
      host: import.meta.env.VITE_SINGLETON_HOST,
      apiKey: import.meta.env.VITE_SINGLETON_API_KEY,
    };
  }
  return false;
};
```

**Returned Object:**
```typescript
{
  id: 0,                                      // Reserved ID
  name: "",                                   // Empty name
  host: "http://localhost:7700",              // From env var
  apiKey: "your-master-key"                   // From env var (optional)
}
```

**Edge Cases:**
- If `VITE_SINGLETON_MODE !== "true"`, returns `false`
- If `VITE_SINGLETON_HOST` is undefined, host will be `undefined`
- If `VITE_SINGLETON_API_KEY` is undefined, apiKey will be `undefined`

#### Step 3: Configuration Validation
```typescript
// src/hooks/useCurrentInstance.ts:35-42
if (!currentInstance) {
  toast.error(`${t("not_found")} 🤥`);
  console.debug("useCurrentInstance", "Singleton Instance lost");
  setWarningPageData({ prompt: t("instance:singleton_cfg_not_found") });
  const baseUrl = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
  window.location.assign(`${baseUrl}/warning`);
}
```

**Checks:**
- `currentInstance` is truthy
- Triggers if `getSingletonCfg()` returned `false` or object with falsy values

#### Step 4: Host Validation
```typescript
// src/hooks/useMeiliClient.ts:23-36
if (_.isEmpty(currentInstance?.host)) {
  toast.error(t("connection_failed"));
  console.debug("useMeilisearchClient", "connection config lost");
  if (!isSingletonMode()) {
    window.location.assign(import.meta.env.BASE_URL ?? "/");
  } else {
    setWarningPageData({ prompt: t("instance:singleton_cfg_not_found") });
    const baseUrl = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
    window.location.assign(`${baseUrl}/warning`);
  }
  return;
}
```

**Lodash `_.isEmpty()` checks:**
- `undefined` → true
- `null` → true
- `""` (empty string) → true
- `"http://localhost:7700"` → false

#### Step 5: Connection Test
```typescript
// src/hooks/useMeiliClient.ts:37-53
const conn = new MeiliSearch({ ...currentInstance });
try {
  await conn.getStats();
  setClient(conn);
} catch (err) {
  console.warn("useMeilisearchClient", "test conn error", err);
  toast.error(t("connection_failed"));
  if (!isSingletonMode()) {
    window.location.assign(import.meta.env.BASE_URL ?? "/");
  } else {
    setWarningPageData({ prompt: t("instance:singleton_cfg_not_found") });
    const baseUrl = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
    window.location.assign(`${baseUrl}/warning`);
  }
}
```

**MeiliSearch Client Configuration:**
```typescript
new MeiliSearch({
  host: "http://localhost:7700",
  apiKey: "your-master-key"
})
```

**Connection Test:**
- Calls `client.getStats()` endpoint
- Endpoint: `GET http://localhost:7700/stats`
- Requires network connectivity
- May require authentication depending on Meilisearch config

### Failure Scenarios & Root Causes

#### Scenario 1: "Singleton mode detected! Connection fail!"
**Display Location:** Warning page (`/warning`)

**Possible Root Causes:**

**1. Missing VITE_SINGLETON_HOST**
```bash
# ❌ Wrong
VITE_SINGLETON_MODE=true
# Missing VITE_SINGLETON_HOST

# ✅ Correct
VITE_SINGLETON_MODE=true
VITE_SINGLETON_HOST=http://localhost:7700
```

**Debug Steps:**
1. Check console log: `"useCurrentInstance", "Singleton Instance lost"`
2. Verify environment variables are set
3. In browser console: `console.log(import.meta.env)`
4. Look for `VITE_SINGLETON_HOST` in output

**2. Empty VITE_SINGLETON_HOST**
```bash
# ❌ Wrong
VITE_SINGLETON_MODE=true
VITE_SINGLETON_HOST=

# ✅ Correct
VITE_SINGLETON_MODE=true
VITE_SINGLETON_HOST=http://localhost:7700
```

**3. Docker Environment Variable Not Transformed**
```bash
# ❌ Wrong - Using VITE_ prefix directly
docker run -e VITE_SINGLETON_MODE=true \
           -e VITE_SINGLETON_HOST=http://meilisearch:7700 \
           riccoxie/meilisearch-ui:latest

# ✅ Correct - Using unprefixed variables
docker run -e SINGLETON_MODE=true \
           -e SINGLETON_HOST=http://meilisearch:7700 \
           riccoxie/meilisearch-ui:latest
```

**Debug Steps:**
1. Check Docker logs for "Singleton mode enabled" message
2. Exec into container: `docker exec -it <container> bash`
3. Check environment: `env | grep SINGLETON`

**4. Wrong Host URL Format**
```bash
# ❌ Wrong formats
VITE_SINGLETON_HOST=localhost:7700              # Missing protocol
VITE_SINGLETON_HOST=http://localhost:7700/      # Trailing slash (may cause issues)
VITE_SINGLETON_HOST=meilisearch                 # Missing protocol and port

# ✅ Correct formats
VITE_SINGLETON_HOST=http://localhost:7700
VITE_SINGLETON_HOST=https://meilisearch.example.com
VITE_SINGLETON_HOST=http://192.168.1.100:7700
```

**5. Meilisearch Server Not Running**
```bash
# Check if Meilisearch is running
curl http://localhost:7700/health

# Expected response
{"status":"available"}
```

**Debug Steps:**
1. Check console log: `"useMeilisearchClient", "test conn error"`
2. Look at network errors in browser DevTools
3. Common errors:
   - `ERR_CONNECTION_REFUSED`: Server not running
   - `ERR_NAME_NOT_RESOLVED`: Wrong hostname
   - `CORS error`: CORS not configured

**6. CORS Not Configured**
```bash
# ❌ Meilisearch without CORS
meilisearch --master-key=your-master-key

# ✅ Meilisearch with CORS
meilisearch --master-key=your-master-key --http-cors '*'
```

**Browser Console Error:**
```
Access to fetch at 'http://localhost:7700/stats' from origin 'http://localhost:24900'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
on the requested resource.
```

**Debug Steps:**
1. Open browser DevTools → Network tab
2. Look for `/stats` request
3. Check response headers for `Access-Control-Allow-Origin`
4. If missing, restart Meilisearch with `--http-cors` flag

**7. Network Connectivity Issues**
- Docker container can't reach host machine
- Firewall blocking requests
- Wrong network configuration in Docker

**Docker Network Debug:**
```bash
# If Meilisearch on host machine, use host.docker.internal
docker run -e SINGLETON_HOST=http://host.docker.internal:7700 \
           riccoxie/meilisearch-ui:latest

# If Meilisearch in same Docker network
docker run --network=meilisearch-network \
           -e SINGLETON_HOST=http://meilisearch:7700 \
           riccoxie/meilisearch-ui:latest
```

#### Scenario 2: Warning Page Appears Briefly Then Disappears
**Cause:** Race condition in React rendering

**Why It Happens:**
1. Component renders
2. `useCurrentInstance` detects missing config
3. Sets warning data and redirects to `/warning`
4. `useMeiliClient` executes after redirect
5. If connection succeeds, might cause navigation confusion

**Solution:** This is expected behavior. The app redirects to warning and stays there.

#### Scenario 3: "Instance not found" Toast
**Display Location:** Toast notification (top-right)

**Cause:** Configuration exists but becomes falsy during render

**Debug Steps:**
1. Check console log: `"useCurrentInstance", "Singleton Instance lost"`
2. Verify environment variables didn't change mid-session (shouldn't happen)

---

## Debugging Guide

### Debug Mode Activation

#### Enable Console Logging
All singleton mode operations log to console with `console.debug()` and `console.warn()`.

**Open Browser DevTools:**
- Chrome/Edge: F12 or Ctrl+Shift+I (Windows/Linux) / Cmd+Option+I (Mac)
- Firefox: F12 or Ctrl+Shift+I (Windows/Linux) / Cmd+Option+I (Mac)
- Safari: Cmd+Option+I (Mac)

**Filter Logs:**
```javascript
// In browser console, filter by keywords:
- "useCurrentInstance"
- "useMeilisearchClient"
- "meilisearch connection test"
- "Singleton Instance"
```

### Step-by-Step Debugging

#### Step 1: Verify Environment Variables
```javascript
// In browser console
console.log({
  mode: import.meta.env.VITE_SINGLETON_MODE,
  host: import.meta.env.VITE_SINGLETON_HOST,
  apiKey: import.meta.env.VITE_SINGLETON_API_KEY,
  baseUrl: import.meta.env.BASE_URL
});
```

**Expected Output (Singleton Mode):**
```javascript
{
  mode: "true",
  host: "http://localhost:7700",
  apiKey: "your-master-key",
  baseUrl: "/"
}
```

**Expected Output (Multi Mode):**
```javascript
{
  mode: undefined,
  host: undefined,
  apiKey: undefined,
  baseUrl: "/"
}
```

#### Step 2: Test Connection Manually
```javascript
// In browser console
const { MeiliSearch } = await import('meilisearch');

const client = new MeiliSearch({
  host: import.meta.env.VITE_SINGLETON_HOST,
  apiKey: import.meta.env.VITE_SINGLETON_API_KEY
});

try {
  const stats = await client.getStats();
  console.log("✅ Connection successful:", stats);
} catch (err) {
  console.error("❌ Connection failed:", err);
}
```

**Successful Output:**
```javascript
✅ Connection successful: {
  databaseSize: 123456,
  lastUpdate: "2025-01-01T00:00:00Z",
  indexes: { ... }
}
```

**Failed Output (CORS):**
```javascript
❌ Connection failed: TypeError: Failed to fetch
```

**Failed Output (Server Down):**
```javascript
❌ Connection failed: Error: Request to http://localhost:7700/stats has failed
```

#### Step 3: Inspect Zustand Store
```javascript
// In browser console
const store = JSON.parse(localStorage.getItem('meilisearch-ui-store'));
console.log({
  instances: store.state.instances,
  warningPageData: store.state.warningPageData,
  language: store.state.language
});
```

**Expected in Multi Mode:**
```javascript
{
  instances: [
    { id: 1, name: "Local", host: "http://localhost:7700", apiKey: "..." },
    { id: 2, name: "Production", host: "https://search.example.com", apiKey: "..." }
  ],
  warningPageData: undefined,
  language: "en"
}
```

**Expected in Singleton Mode:**
```javascript
{
  instances: [],  // Empty in singleton mode
  warningPageData: undefined,
  language: "en"
}
```

#### Step 4: Check Network Requests
1. Open DevTools → Network tab
2. Reload page
3. Filter by "stats"
4. Click on `/stats` request
5. Check:
   - **Status Code**: Should be 200
   - **Response Headers**: Must include `Access-Control-Allow-Origin`
   - **Request Headers**: Check if `Authorization` is sent (if API key configured)
   - **Response Body**: Should contain stats object

**Successful Request:**
```
Status: 200 OK
Response Headers:
  Access-Control-Allow-Origin: *
  Content-Type: application/json

Request Headers:
  Authorization: Bearer your-master-key

Response Body:
{
  "databaseSize": 123456,
  "lastUpdate": "2025-01-01T00:00:00Z",
  "indexes": { ... }
}
```

**Failed Request (CORS):**
```
Status: (failed) CORS
Console Error: Access to fetch blocked by CORS policy
```

**Failed Request (Unauthorized):**
```
Status: 401 Unauthorized
Response Body:
{
  "message": "The provided API key is invalid.",
  "code": "invalid_api_key",
  "type": "auth",
  "link": "https://docs.meilisearch.com/errors#invalid_api_key"
}
```

#### Step 5: Check Docker Logs (If Using Docker)
```bash
# View logs
docker logs <container-name>

# Follow logs
docker logs -f <container-name>

# Look for these messages:
# - "Singleton mode enabled"
# - "Custom base path: ..."
# - Build output
# - Preview server startup
```

### Common Error Patterns

#### Error 1: Blank Page
**Symptoms:**
- White screen
- No error messages
- DevTools shows React errors

**Causes:**
- JavaScript bundle failed to load
- Base path misconfigured
- Critical error during initialization

**Debug:**
1. Check DevTools Console for errors
2. Check Network tab for failed asset loads
3. Verify `BASE_URL` matches deployment path

#### Error 2: Infinite Redirect Loop
**Symptoms:**
- Page keeps reloading
- URL keeps changing
- Browser stops with "Too many redirects"

**Causes:**
- Race condition in navigation hooks
- Conflicting redirects
- Storage/cache issues

**Debug:**
1. Clear localStorage: `localStorage.clear()`
2. Disable service workers
3. Check for multiple warning page redirects

#### Error 3: Warning Page with Blank Message
**Symptoms:**
- Warning page displays
- No error message text
- Just "Warning" header

**Causes:**
- `warningPageData.prompt` is undefined
- Translation key missing
- Race condition in state update

**Debug:**
```javascript
// In browser console on warning page
const store = useAppStore.getState();
console.log(store.warningPageData);

// Check if translation exists
import i18n from './lib/i18n';
console.log(i18n.t('instance:singleton_cfg_not_found'));
```

### Testing Checklist

#### Singleton Mode Setup Test
- [ ] Set `VITE_SINGLETON_MODE=true`
- [ ] Set `VITE_SINGLETON_HOST` to valid URL
- [ ] Set `VITE_SINGLETON_API_KEY` (if required)
- [ ] Start Meilisearch server
- [ ] Configure CORS on Meilisearch
- [ ] Build or start dev server
- [ ] Open browser to UI URL
- [ ] Verify automatic redirect to `/ins/0`
- [ ] Verify "Singleton Mode" badge in footer
- [ ] Verify no "Add Instance" button
- [ ] Verify indexes load successfully

#### Connection Test Checklist
- [ ] Test with correct host → Success
- [ ] Test with wrong port → Warning page
- [ ] Test with wrong protocol → Warning page
- [ ] Test with server down → Warning page
- [ ] Test without CORS → Warning page
- [ ] Test with wrong API key → 401 error
- [ ] Test with no API key (if allowed) → Success
- [ ] Test network timeout → Warning page

#### Docker Deployment Test
- [ ] Set `SINGLETON_MODE=true` (no VITE_ prefix)
- [ ] Set `SINGLETON_HOST`
- [ ] Set `SINGLETON_API_KEY`
- [ ] Run container
- [ ] Check logs for "Singleton mode enabled"
- [ ] Access UI in browser
- [ ] Verify connection works
- [ ] Test with container restart
- [ ] Test with different environment variables

---

## Summary

### Key Takeaways

1. **Singleton Mode is Stateless**
   - No instance data stored in Zustand
   - Configuration comes from environment variables
   - ID 0 is reserved for singleton instance

2. **Environment Variables are Build-Time**
   - Variables embedded into bundle during build
   - Cannot be changed after build (except in Docker)
   - Docker builds at container startup for runtime configuration

3. **Triple Validation**
   - Step 1: Configuration exists (`useCurrentInstance`)
   - Step 2: Host is not empty (`useMeiliClient`)
   - Step 3: Connection test passes (`useMeiliClient`)

4. **Warning Page is Central Error Handler**
   - All singleton mode errors redirect here
   - Message comes from `warningPageData` in store
   - Triggered by `setWarningPageData()` calls

5. **CORS is Critical**
   - Browser blocks requests without proper CORS headers
   - Meilisearch must be started with `--http-cors` flag
   - Most common cause of connection failures

### Quick Reference

**Enable Singleton Mode (Development):**
```bash
# .env.local
VITE_SINGLETON_MODE=true
VITE_SINGLETON_HOST=http://localhost:7700
VITE_SINGLETON_API_KEY=your-master-key
```

**Enable Singleton Mode (Docker):**
```bash
docker run -p 24900:24900 \
  -e SINGLETON_MODE=true \
  -e SINGLETON_HOST=http://meilisearch:7700 \
  -e SINGLETON_API_KEY=your-master-key \
  riccoxie/meilisearch-ui:latest
```

**Start Meilisearch with CORS:**
```bash
meilisearch --master-key=your-master-key --http-cors '*'
```

**Debug in Browser Console:**
```javascript
// Check environment
console.log(import.meta.env);

// Check store
console.log(useAppStore.getState());

// Test connection
const { MeiliSearch } = await import('meilisearch');
const client = new MeiliSearch({
  host: import.meta.env.VITE_SINGLETON_HOST,
  apiKey: import.meta.env.VITE_SINGLETON_API_KEY
});
await client.getStats();
```

---

**Document Version:** 1.0
**Last Updated:** 2025-01-01
**Codebase Version:** v0.14.1
