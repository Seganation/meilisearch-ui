/**
 * Basic Authentication System for Meilisearch UI
 *
 * Security Notes:
 * - Uses sessionStorage (cleared on browser close) for auth state
 * - Credentials come from build-time environment variables
 * - Simple SHA-256 hashing for password comparison
 * - Rate limiting should be implemented at reverse proxy level (nginx, Caddy, etc.)
 * - For production, consider implementing OAuth2/OIDC or delegating to reverse proxy auth
 */

/**
 * Simple SHA-256 hash function using Web Crypto API
 */
async function hashPassword(password: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(password);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
	return hashHex;
}

/**
 * Session storage key for authentication state
 */
const AUTH_SESSION_KEY = "meilisearch-ui-auth";

/**
 * Check if authentication is required (env vars are set)
 */
export const isAuthRequired = (): boolean => {
	const username = import.meta.env.VITE_AUTH_USERNAME;
	const password = import.meta.env.VITE_AUTH_PASSWORD;
	return !!(username && password);
};

/**
 * Check if user is currently authenticated
 */
export const isAuthenticated = (): boolean => {
	if (!isAuthRequired()) {
		// If auth is not configured, allow access
		return true;
	}
	const authState = sessionStorage.getItem(AUTH_SESSION_KEY);
	return authState === "authenticated";
};

/**
 * Attempt to login with username and password
 *
 * @param username - Username from login form
 * @param password - Password from login form
 * @returns Promise<boolean> - true if login successful, false otherwise
 */
export const login = async (
	username: string,
	password: string,
): Promise<boolean> => {
	if (!isAuthRequired()) {
		// If auth is not configured, allow login
		sessionStorage.setItem(AUTH_SESSION_KEY, "authenticated");
		return true;
	}

	const expectedUsername = import.meta.env.VITE_AUTH_USERNAME;
	const expectedPassword = import.meta.env.VITE_AUTH_PASSWORD;

	// Hash both passwords for comparison (prevent timing attacks)
	const [providedPasswordHash, expectedPasswordHash] = await Promise.all([
		hashPassword(password),
		hashPassword(expectedPassword),
	]);

	// Compare username and hashed passwords
	const usernameMatch = username === expectedUsername;
	const passwordMatch = providedPasswordHash === expectedPasswordHash;

	if (usernameMatch && passwordMatch) {
		sessionStorage.setItem(AUTH_SESSION_KEY, "authenticated");
		console.debug("[auth]", "Login successful");
		return true;
	}

	console.debug("[auth]", "Login failed - invalid credentials");
	return false;
};

/**
 * Logout current user
 * Clears authentication state from sessionStorage
 */
export const logout = (): void => {
	sessionStorage.removeItem(AUTH_SESSION_KEY);
	console.debug("[auth]", "User logged out");
};

/**
 * Get authentication redirect URL
 * Returns the URL to redirect to after successful login
 */
export const getRedirectUrl = (): string => {
	const params = new URLSearchParams(window.location.search);
	const redirect = params.get("redirect");
	const baseUrl = import.meta.env.BASE_URL || "/";

	// Validate redirect URL to prevent open redirect vulnerabilities
	if (redirect && redirect.startsWith(baseUrl)) {
		return redirect;
	}

	return baseUrl;
};
