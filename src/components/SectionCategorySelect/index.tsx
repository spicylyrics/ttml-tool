import { Select } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import {
	LYRIC_SECTION_CATEGORIES,
	type LyricSectionCategory,
} from "$/types/ttml";

/** Picks a section type (verse, chorus, ...), with the names translated. */
export function SectionCategorySelect({
	value,
	onValueChange,
	open,
	onOpenChange,
	onCloseAutoFocus,
	"aria-label": ariaLabel,
	size = "2",
}: {
	value: LyricSectionCategory;
	onValueChange: (category: LyricSectionCategory) => void;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	/** Where focus goes when the list closes; call preventDefault to move it. */
	onCloseAutoFocus?: (event: Event) => void;
	"aria-label"?: string;
	size?: "1" | "2";
}) {
	const { t } = useTranslation();
	return (
		<Select.Root
			size={size}
			value={value}
			onValueChange={(category) =>
				onValueChange(category as LyricSectionCategory)
			}
			open={open}
			onOpenChange={onOpenChange}
		>
			<Select.Trigger
				aria-label={ariaLabel ?? t("sectionEditing.type", "Section type")}
			/>
			<Select.Content position="popper" onCloseAutoFocus={onCloseAutoFocus}>
				{LYRIC_SECTION_CATEGORIES.map((category) => (
					<Select.Item key={category} value={category}>
						{t(`sectionCategories.${category}`, category)}
					</Select.Item>
				))}
			</Select.Content>
		</Select.Root>
	);
}
