import {
	ErrorCircle16Regular,
	Info16Regular,
	Open16Regular,
	Warning16Regular,
} from "@fluentui/react-icons";
import { Flex, IconButton, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";
import styles from "./index.module.css";

export type ProblemSeverity = "error" | "warning" | "hint";

export interface ProblemListItem {
	key: string;
	severity: ProblemSeverity;
	message: string;
	/** Short "where", e.g. "Line 12 · 01:02.345". */
	location?: string;
	/** Small secondary label, e.g. the rule id. */
	detail?: string;
	/** Makes the row a button, e.g. jump to the line. */
	onSelect?: () => void;
	/** "Learn more" link shown at the end of the row. */
	href?: string;
}

const ICONS: Record<ProblemSeverity, ReactNode> = {
	error: <ErrorCircle16Regular />,
	warning: <Warning16Regular />,
	hint: <Info16Regular />,
};

const ORDER: ProblemSeverity[] = ["error", "warning", "hint"];

/**
 * Findings grouped by severity. Severity is always shown as an icon plus a
 * text heading, never by color alone.
 */
export function ProblemList({
	items,
	headings,
	linkLabel,
	hidden = [],
}: {
	items: ProblemListItem[];
	headings: Record<ProblemSeverity, (count: number) => string>;
	linkLabel: string;
	/** Severities to leave out, e.g. hints until asked for. */
	hidden?: ProblemSeverity[];
}) {
	return (
		<Flex direction="column" gap="4">
			{ORDER.filter((severity) => !hidden.includes(severity)).map(
				(severity) => {
					const group = items.filter((item) => item.severity === severity);
					if (!group.length) return null;
					return (
						<section key={severity} className={styles.group}>
							<Text
								as="div"
								size="2"
								weight="medium"
								className={styles.heading}
								data-severity={severity}
							>
								<span className={styles.icon} aria-hidden>
									{ICONS[severity]}
								</span>
								{headings[severity](group.length)}
							</Text>
							<ul className={styles.list}>
								{group.map((item) => (
									<li key={item.key} className={styles.row}>
										<ProblemRow item={item} linkLabel={linkLabel} />
									</li>
								))}
							</ul>
						</section>
					);
				},
			)}
		</Flex>
	);
}

function ProblemRow({
	item,
	linkLabel,
}: {
	item: ProblemListItem;
	linkLabel: string;
}) {
	const body = (
		<>
			<span className={styles.icon} data-severity={item.severity} aria-hidden>
				{ICONS[item.severity]}
			</span>
			<span className={styles.text}>
				{item.location && (
					<Text as="span" size="1" color="gray" className={styles.location}>
						{item.location}
					</Text>
				)}
				<Text as="span" size="2" className={styles.message}>
					{item.message}
				</Text>
				{item.detail && (
					<Text as="span" size="1" color="gray">
						{item.detail}
					</Text>
				)}
			</span>
		</>
	);
	return (
		<>
			{item.onSelect ? (
				<button
					type="button"
					className={styles.main}
					onClick={item.onSelect}
				>
					{body}
				</button>
			) : (
				<div className={styles.main}>{body}</div>
			)}
			{item.href && (
				<IconButton
					asChild
					size="1"
					variant="ghost"
					color="gray"
					className={styles.link}
				>
					<a
						href={item.href}
						target="_blank"
						rel="noreferrer"
						aria-label={linkLabel}
						title={linkLabel}
					>
						<Open16Regular />
					</a>
				</IconButton>
			)}
		</>
	);
}
