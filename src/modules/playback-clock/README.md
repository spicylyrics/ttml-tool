# UI playback clock

`playbackClock.getSnapshot()` returns audible position in **seconds**.
`subscribe((seconds, frameTimestamp, seeked) => ...)` drives imperative renderers.
The existing `currentTimeAtom` receives the same sample in milliseconds for editor highlights,
the timing overview, playback label and spectrogram. No component estimates time
from wall time or playback rate.

The clock owns one rAF chain during music playback and cancels it on pause.
Engine timeupdate events are coalesced into that frame. Seeks, pause, load and
unload publish synchronously, including while no preview is mounted. The engine's
own ~60Hz timer remains responsible for audible end-of-track and audition events.

## Before / after loop count

With Spicy open and music playing, the previous source scheduled **2 continuous
UI rAF chains**: AudioSlider's clock and Spicy's renderer. Animated artwork added
the app's frequency-analysis chain, giving **3**. Standard/Toxi and Timing
Overview were alternative views, so their loops are not counted here.

Afterward those jobs subscribe to **1 shared UI rAF chain**. The rendered Spicy
tests instrument rAF and assert one pending frame while playing and zero after
pause, in both normal and simple modes. The clock tests also assert one engine
read per frame with four subscribers and coalesced engine timeupdate events.
The before count is a source inventory; the after count is measured in a mocked
DOM/engine test, not a desktop profiler capture.

This count covers app-owned UI playback/frequency-analysis loops. Kawarp's own
canvas animation, third-party animation schedulers, drag/zoom animations and the
two one-shot virtual-row layout frames are separate; this change does not claim
that the whole browser has only one rAF callback.

## Shared preview scrolling

`usePreviewScroll` handles manual input, seeks, active-target deduplication,
offscreen targets, virtual-row mounting and cleanup. Placement is explicit:
Standard/Toxi uses a 40% anchor, Spicy uses the center plus 30px, and Timing
Overview uses the center. Standard/Toxi adopts Spicy's 750ms manual-scroll grace;
Timing Overview retains its 3500ms grace and Auto-Scroll setting.

Renderer-specific target selection stays local: Standard/Toxi groups background
vocals; Spicy retains adjacent-duet, separated-overlap and end-of-song choices;
Timing Overview retains chronological/textual order and upcoming-line selection
in gaps. Scroll follows explicit engine seeks even within the same active line.
It no longer guesses a seek from a 500/1000ms delta or requires the next Spicy
line to already be visible.

Spicy retains its styling, splines and visual springs. Its old +100ms playback
lead and -33.5ms simple-mode offset are removed. Simple-mode Web Animations are
paused and positioned from the shared clock, so their fill cannot drift at slow
rates or continue after music pauses. Visual springs snap to the requested
position on seek/pause, allowing paused rendering to become idle. Standard/Toxi
retains its 30/60Hz React update budget via the VSync setting while DOM progress
uses each shared frame sample.
