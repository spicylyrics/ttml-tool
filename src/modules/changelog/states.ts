import { atomWithStorage } from "jotai/utils";

/** Feature flag: the new changelog screen. Off shows the old dialog. */
export const changelogScreenAtom = atomWithStorage("changelogScreen", false);
