#!/usr/bin/env bash

set -euo pipefail

appimage_path="${1:?Usage: patch-appimage.sh <path-to-appimage>}"
appimage_path="$(realpath "$appimage_path")"
script_dir="$(dirname "$(realpath "$0")")"

if [[ ! -f "$appimage_path" ]]; then
	echo "AppImage not found: $appimage_path" >&2
	exit 1
fi

if ! command -v appimagetool >/dev/null; then
	echo "appimagetool must be available on PATH" >&2
	exit 1
fi

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

(
	cd "$work_dir"
	"$appimage_path" --appimage-extract >/dev/null

	# These libraries are supplied by the host. Keeping the build host's copies
	# makes Mesa's libEGL load an incompatible Wayland client on newer systems.
	rm -f \
		squashfs-root/usr/lib/libwayland-client.so* \
		squashfs-root/usr/lib/libwayland-cursor.so* \
		squashfs-root/usr/lib/libwayland-egl.so* \
		squashfs-root/usr/lib/libwayland-server.so*

	# WebKitGTK loads GStreamer plugins from the host, so its GStreamer core
	# libraries must come from the same host installation. Mixing the bundled
	# Ubuntu core with newer Arch/CachyOS plugins makes even basic elements such
	# as appsrc and autoaudiosink unavailable.
	find squashfs-root/usr/lib -maxdepth 1 \( \
		-name 'libgstreamer-1.0.so*' -o \
		-name 'libgst*.so*' \
	\) -delete
	rm -rf \
		squashfs-root/usr/lib/gstreamer-1.0 \
		squashfs-root/usr/libexec/gstreamer-1.0

	# A hook points GStreamer at the host plugins and, when the host GLib is
	# newer, switches to it (see the hook for why). linuxdeploy's AppRun
	# sources hooks by name, so add it after the GTK hook, which sets APPDIR.
	cp "$script_dir/appimage/host-gstreamer.sh" \
		squashfs-root/apprun-hooks/host-gstreamer.sh
	grep -q 'apprun-hooks/"linuxdeploy-plugin-gtk.sh"' squashfs-root/AppRun
	sed -i '/apprun-hooks\/"linuxdeploy-plugin-gtk.sh"/a source "$this_dir"/apprun-hooks/"host-gstreamer.sh"' \
		squashfs-root/AppRun

	# The extracted tree keeps owner-only modes on some folders, and
	# appimagetool refuses to pack anything other users can't read or run.
	chmod -R a+rX squashfs-root
	chmod a+rx squashfs-root/AppRun

	ARCH=x86_64 appimagetool squashfs-root patched.AppImage >/dev/null
)

mv "$work_dir/patched.AppImage" "$appimage_path"
