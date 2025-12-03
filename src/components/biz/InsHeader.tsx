import { Link } from "@arco-design/web-react";
import {
	IconBook2,
	IconBrandGithub,
	IconBug,
	IconLogout,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { DashBreadcrumb } from "../common/Breadcrumb";
import { Logo } from "../common/logo";
import { LangSelector } from "../common/Lang";
import { isAuthRequired, logout } from "@/lib/auth";
import { useAppStore } from "@/store";
import { ActionIcon, Tooltip } from "@mantine/core";
import { modals } from "@mantine/modals";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@douyinfe/semi-ui";

export const Header = () => {
	const { t } = useTranslation("header");
	const { t: tAuth } = useTranslation("auth");
	const navigate = useNavigate();
	const setAuthenticated = useAppStore((state) => state.setAuthenticated);

	const handleLogout = () => {
		const modalId = "logoutModal";
		modals.open({
			modalId,
			title: tAuth("logout"),
			centered: true,
			children: (
				<div className="flex flex-col gap-6">
					<p>{tAuth("logout_confirm")}</p>
					<div className="flex gap-3">
						<Button
							block
							theme="solid"
							type="danger"
							onClick={() => {
								logout();
								setAuthenticated(false);
								modals.close(modalId);
								navigate({ to: "/login" });
							}}
						>
							{tAuth("logout")}
						</Button>
						<Button
							block
							theme="solid"
							type="secondary"
							onClick={() => {
								modals.close(modalId);
							}}
						>
							Cancel
						</Button>
					</div>
				</div>
			),
		});
	};

	return (
		<header className="px-4 py-2 bg-white border-b border-neutral-600/20 overflow-hidden flex items-center gap-4 flex-shrink-0 flex-grow-0 basis-auto">
			<Logo className="size-8" />
			<DashBreadcrumb />
			<div className="ml-auto flex items-center gap-3">
				<Link
					href={"https://docs.meilisearch.com"}
					target={"_blank"}
					className={"!inline-flex items-center !no-underline !text-sky-500"}
					icon={<IconBook2 size={"1.5em"} />}
				>
					{t("meilisearch_docs")}
				</Link>
				<Link
					href={"https://github.com/riccox/meilisearch-ui/issues"}
					target={"_blank"}
					className={"!inline-flex items-center !no-underline !text-sky-500"}
					icon={<IconBug size={"1.5em"} />}
				>
					{t("issues")}
				</Link>
				<Link
					href={"https://github.com/riccox/meilisearch-ui"}
					target={"_blank"}
					className={"!inline-flex items-center !no-underline !text-sky-500"}
					icon={<IconBrandGithub size={"1.5em"} />}
				>
					{t("open_source")}
				</Link>
				<LangSelector className="text-small font-semibold" />
				{isAuthRequired() && (
					<Tooltip position="bottom" label={tAuth("logout")}>
						<ActionIcon
							variant="light"
							color="red"
							size="lg"
							onClick={handleLogout}
						>
							<IconLogout size="1.25rem" />
						</ActionIcon>
					</Tooltip>
				)}
			</div>
		</header>
	);
};
