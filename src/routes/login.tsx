import { Footer } from "@/components/common/footer";
import { Logo } from "@/components/common/logo";
import { getRedirectUrl, login } from "@/lib/auth";
import { useAppStore } from "@/store";
import {
	Button,
	PasswordInput,
	TextInput,
	Text,
	Alert,
	Paper,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconAlertCircle, IconLock, IconUser } from "@tabler/icons-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface LoginForm {
	username: string;
	password: string;
}

function Login() {
	const { t } = useTranslation("auth");
	const navigate = useNavigate();
	const setAuthenticated = useAppStore((state) => state.setAuthenticated);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const form = useForm<LoginForm>({
		initialValues: {
			username: "",
			password: "",
		},
		validate: {
			username: (value) => {
				if (!value) return t("username_required");
				if (value.length < 3) return t("username_min_length");
				return null;
			},
			password: (value) => {
				if (!value) return t("password_required");
				if (value.length < 3) return t("password_min_length");
				return null;
			},
		},
	});

	const handleSubmit = async (values: LoginForm) => {
		setLoading(true);
		setError(null);

		try {
			const success = await login(values.username, values.password);

			if (success) {
				setAuthenticated(true);
				console.debug("[login]", "Authentication successful, redirecting...");

				// Get redirect URL from query params or default to home
				const redirectUrl = getRedirectUrl();
				navigate({ to: redirectUrl as "/", replace: true });
			} else {
				setError(t("invalid_credentials"));
				setAuthenticated(false);
			}
		} catch (err) {
			console.error("[login]", "Login error:", err);
			setError(t("login_error"));
			setAuthenticated(false);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="full-page bg-mount justify-center items-center gap-y-6">
			<div className="w-full max-w-md flex flex-col items-center gap-y-8 px-4">
				<div className="flex flex-col items-center gap-4">
					<Logo className="size-20" />
					<h1 className="text-primary-100 font-bold text-3xl">
						{t("login_title")}
					</h1>
					<Text size="sm" className="text-primary-100/80 text-center">
						{t("login_subtitle")}
					</Text>
				</div>

				<Paper
					shadow="md"
					p="xl"
					radius="md"
					className="w-full bg-white"
					withBorder
				>
					<form onSubmit={form.onSubmit(handleSubmit)} className="space-y-4">
						{error && (
							<Alert
								icon={<IconAlertCircle size="1rem" />}
								title={t("error")}
								color="red"
								variant="light"
							>
								{error}
							</Alert>
						)}

						<TextInput
							label={t("username")}
							placeholder={t("username_placeholder")}
							required
							leftSection={<IconUser size="1rem" />}
							{...form.getInputProps("username")}
							disabled={loading}
							size="md"
						/>

						<PasswordInput
							label={t("password")}
							placeholder={t("password_placeholder")}
							required
							leftSection={<IconLock size="1rem" />}
							{...form.getInputProps("password")}
							disabled={loading}
							size="md"
						/>

						<Button
							type="submit"
							fullWidth
							size="md"
							loading={loading}
							className="mt-6"
						>
							{t("login_button")}
						</Button>
					</form>
				</Paper>

				<Text size="xs" className="text-primary-100/60 text-center">
					{t("login_footer")}
				</Text>
			</div>
			<Footer className="!text-white" />
		</div>
	);
}

export const Route = createFileRoute("/login")({
	component: Login,
});
