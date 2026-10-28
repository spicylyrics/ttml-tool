---
type: fix
impact: 3
highlight: false
---
Smoother spectrogram while hovering, scrolling and playing

Moving the mouse over the spectrogram, scrolling it and playing audio now redraw only the parts that change, so the editor stays responsive on long songs. Editing one line no longer reprocesses every other line on the timeline.
