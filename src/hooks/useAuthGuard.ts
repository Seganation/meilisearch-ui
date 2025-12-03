import { isAuthenticated, isAuthRequired, logout } from "@/lib/auth";
import { useAppStore } from "@/store";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

/**
 * Authentication Guard Hook
 *
 * Continuously monitors authentication state and redirects to login if session is lost.
 * This handles cases where:
 * - User clears sessionStorage/cookies while on a page
 * - Session expires (if timeout is implemented)
 * - Multiple tabs logout (storage event)
 * - Session is invalidated externally
 *
 * @param skipMonitoring - If true, skip session monitoring (e.g., on login page)
 *
 * Usage: Call this hook in components that require authentication
 */
export const useAuthGuard = (skipMonitoring = false) => {
	const navigate = useNavigate();
	const setAuthenticated = useAppStore((state) => state.setAuthenticated);
	const intervalRef = useRef<NodeJS.Timeout | null>(null);

	useEffect(() => {
		// Skip monitoring if requested (e.g., on login page)
		if (skipMonitoring) {
			return;
		}

		// Initial check on mount
		const checkAuth = () => {
			if (isAuthRequired() && !isAuthenticated()) {
				console.debug("[auth-guard]", "Session lost, redirecting to login");
				setAuthenticated(false);
				navigate({ to: "/login", replace: true });
			}
		};

		// Check immediately on mount
		checkAuth();

		// Set up periodic check (every 1 second)
		// This catches sessionStorage clears even without storage events
		intervalRef.current = setInterval(() => {
			checkAuth();
		}, 1000);

		// Listen for storage events (handles logout in other tabs)
		const handleStorageChange = (e: StorageEvent) => {
			// Check if sessionStorage key was removed or changed
			if (e.key === "meilisearch-ui-auth" || e.key === null) {
				console.debug(
					"[auth-guard]",
					"Storage event detected, checking auth state",
				);
				checkAuth();
			}
		};

		window.addEventListener("storage", handleStorageChange);

		// Cleanup on unmount
		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
			}
			window.removeEventListener("storage", handleStorageChange);
		};
	}, [navigate, setAuthenticated, skipMonitoring]);
};

/**
 * Check authentication state immediately (synchronous)
 * Used for quick validation without waiting for hook lifecycle
 */
export const validateSession = (): boolean => {
	if (!isAuthRequired()) {
		return true; // Auth not required, always valid
	}

	const isValid = isAuthenticated();

	if (!isValid) {
		console.debug("[auth-guard]", "Session validation failed");
		logout(); // Clean up any partial session state
	}

	return isValid;
};
