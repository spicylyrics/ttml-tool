---
type: fix
impact: 2
highlight: false
---
Linux file dialogs use your desktop's picker

Open and save dialogs go through the desktop portal, so KDE shows its own file picker and GNOME shows its own. Without a portal running, the tool falls back to **zenity**.
