import { AutoKeyBindingSettingsPanel } from "$/modules/keyboard/components/SettingsPanel";
import { KeyboardViewSection } from "$/modules/keyboard/view/KeyboardViewSection";

export const SettingsKeyBindingsDialog = () => {
	return (
		<>
			<KeyboardViewSection />
			<AutoKeyBindingSettingsPanel />
		</>
	);
};
