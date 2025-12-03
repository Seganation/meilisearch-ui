import { isAuthenticated, isAuthRequired } from "@/lib/auth";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useAppStore } from "@/store";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";

interface AuthGuardProps {
	children: ReactNode;
}

/**
 * Authentication Guard Component
 *
 * Wraps protected content and ensures user is authenticated.
 * Continuously monitors session state and redirects to login if lost.
 *
 * Features:
 * - Initial authentication check on mount
 * - Continuous session monitoring (1-second interval)
 * - Storage event listener (detects logout in other tabs)
 * - Automatic redirect to login on session loss
 * - Syncs with Zustand store
 * - Allows login page to render without authentication
 *
 * Usage:
 * <AuthGuard>
 *   <ProtectedContent />
 * </AuthGuard>
 */
export const AuthGuard = ({ children }: AuthGuardProps) => {
	const navigate = useNavigate();
	const location = useLocation();
	const setAuthenticated = useAppStore((state) => state.setAuthenticated);

	// Check if we're on the login page
	const isLoginPage = location.pathname === "/login";

	// Always call the hook (React rules), but pass the login page state
	// The hook will conditionally monitor based on this
	useAuthGuard(isLoginPage);

	useEffect(() => {
		// Initial sync with store on mount
		if (isAuthRequired()) {
			const currentlyAuthenticated = isAuthenticated();
			setAuthenticated(currentlyAuthenticated);

			// Don't redirect if we're already on the login page
			if (!currentlyAuthenticated && !isLoginPage) {
				console.debug(
					"[auth-guard]",
					"User not authenticated on mount, redirecting to login",
				);
				navigate({ to: "/login", replace: true });
			}
		} else {
			// Auth not required, always set as authenticated
			setAuthenticated(true);
		}
	}, [navigate, setAuthenticated, isLoginPage]);

	// If auth is not required, always render children
	if (!isAuthRequired()) {
		return <>{children}</>;
	}

	// If on login page, always render (even if not authenticated)
	if (isLoginPage) {
		return <>{children}</>;
	}

	// If authenticated, render children
	if (isAuthenticated()) {
		return <>{children}</>;
	}

	// If not authenticated and not on login page, don't render anything (will redirect)
	// This prevents flash of protected content before redirect
	return null;
};
