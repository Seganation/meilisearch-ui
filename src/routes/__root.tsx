import { isAuthenticated, isAuthRequired } from "@/lib/auth";
import { Outlet, createRootRoute, redirect } from "@tanstack/react-router";
import React from "react";

const TanStackRouterDevtools =
	process.env.NODE_ENV === "development"
		? React.lazy(() =>
				// Lazy load in development
				import("@tanstack/router-devtools").then((res) => ({
					default: res.TanStackRouterDevtools,
				})),
			)
		: () => null; // Render nothing in production;

export const Route = createRootRoute({
	component: () => (
		<>
			<Outlet />
			<TanStackRouterDevtools />
		</>
	),
	beforeLoad: async ({ location }) => {
		// Check if authentication is required and user is not authenticated
		if (isAuthRequired() && !isAuthenticated()) {
			// Allow access to login page
			if (location.pathname === "/login") {
				return;
			}

			// Redirect to login page with return URL
			console.debug(
				"[auth]",
				"User not authenticated, redirecting to login",
			);
			const baseUrl = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
			throw redirect({
				to: "/login",
				search: {
					redirect: location.pathname,
				},
			});
		}

		// If user is authenticated but on login page, redirect to home
		if (location.pathname === "/login" && isAuthenticated()) {
			console.debug(
				"[auth]",
				"User already authenticated, redirecting to home",
			);
			throw redirect({
				to: "/",
			});
		}
	},
	wrapInSuspense: true,
});
