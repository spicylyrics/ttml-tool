import { Box, Flex } from "@radix-ui/themes";
import { Toolbar } from "radix-ui";
import { type FC, useEffect, useState } from "react";
import {
	cmdAutoSegmentDialog,
	cmdRedoAlternate,
} from "$/modules/keyboard/commands";
import { MenuActionShortcuts } from "$/modules/menu-actions/MenuActionShortcuts";
import {
	keyAutoSegmentAtom,
	keyDeleteSelectionAtom,
	keyNewFileAtom,
	keyOpenFileAtom,
	keyRedoAtom,
	keySaveFileAtom,
	keySelectAllAtom,
	keyUndoAtom,
	keyUnselectAllAtom,
} from "$/states/keybindings";
import { useKeyBindingAtom } from "$/utils/keybindings";
import { HeaderFileInfo } from "./HeaderFileInfo";
import { EditMenu } from "./modals/EditMenu";
import { FileMenu } from "./modals/FileMenu";
import { HelpMenu } from "./modals/HelpMenu";
import { HomeMenu } from "./modals/HomeMenu";
import { ToolMenu } from "./modals/ToolMenu";
import { useTopMenuActions } from "./useTopMenuActions";

// top menu actions are used inside individual menu components

const useWindowSize = () => {
	const [windowSize, setWindowSize] = useState({
		width: window.innerWidth,
		height: window.innerHeight,
	});

	useEffect(() => {
		const handleResize = () => {
			setWindowSize({
				width: window.innerWidth,
				height: window.innerHeight,
			});
		};

		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	return windowSize;
};

export const TopMenu: FC = () => {
	const { width } = useWindowSize();
	const showHomeButton = width < 800;
	const menu = useTopMenuActions();

	useKeyBindingAtom(keyNewFileAtom, menu.onNewFile, [menu.onNewFile]);
	useKeyBindingAtom(keyOpenFileAtom, menu.onOpenFile, [menu.onOpenFile]);
	useKeyBindingAtom(keySaveFileAtom, menu.onSaveFile, [menu.onSaveFile]);
	useKeyBindingAtom(keyUndoAtom, menu.onUndo, [menu.onUndo]);
	useKeyBindingAtom(keyRedoAtom, menu.onRedo, [menu.onRedo]);
	useKeyBindingAtom(cmdRedoAlternate.atom, menu.onRedo, [menu.onRedo]);
	useKeyBindingAtom(keyUnselectAllAtom, menu.onUnselectAll, [
		menu.onUnselectAll,
	]);
	useKeyBindingAtom(keySelectAllAtom, menu.onSelectAll, [menu.onSelectAll]);
	useKeyBindingAtom(keyDeleteSelectionAtom, menu.onDeleteSelection, [
		menu.onDeleteSelection,
	]);
	// Waits for a second press when Auto segment is set to "Press twice to run".
	useKeyBindingAtom(keyAutoSegmentAtom, menu.onQuickAutoSegment, [
		menu.onQuickAutoSegment,
	]);
	useKeyBindingAtom(cmdAutoSegmentDialog.atom, menu.onAutoSegment, [
		menu.onAutoSegment,
	]);

	return (
		<Flex
			p="2"
			pr="0"
			align="center"
			gap="2"
			style={{
				whiteSpace: "nowrap",
			}}
		>
			<MenuActionShortcuts menu={menu} />
			{showHomeButton ? (
				<HomeMenu />
			) : (
				<Toolbar.Root>
					<FileMenu
						variant="toolbar"
						buttonStyle={{
							borderTopRightRadius: "0",
							borderBottomRightRadius: "0",
							marginRight: "0px",
						}}
					/>
					<EditMenu
						variant="toolbar"
						triggerStyle={{
							borderRadius: "0",
							marginRight: "0px",
						}}
					/>
					<ToolMenu
						variant="toolbar"
						triggerStyle={{
							borderRadius: "0",
							marginRight: "0px",
						}}
					/>
					<HelpMenu
						variant="toolbar"
						buttonStyle={{
							borderTopLeftRadius: "0",
							borderBottomLeftRadius: "0",
						}}
					/>
				</Toolbar.Root>
			)}
			<Box style={{ marginLeft: "16px" }}>
				<HeaderFileInfo />
			</Box>
		</Flex>
	);
};
