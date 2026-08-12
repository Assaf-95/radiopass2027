#!/bin/bash
# Double-click this file to start the RadioPass Anatomy website.
#
# Why this exists: the site cannot be opened by double-clicking index.html.
# The app is an ES module, and browsers refuse to load modules from a file://
# path — you get a blank page and a console error. It has to be served over
# http, which is what this does.
#
# It also has to run from inside frcr-anatomy/, not the folder above it.
# "Run in terminal" on the parent folder is what showed you just a folder.

cd "$(dirname "$0")/frcr-anatomy" || {
  echo "Could not find the frcr-anatomy folder next to this file."
  echo "Press any key to close."; read -r -n 1; exit 1
}

echo "════════════════════════════════════════════"
echo "  RadioPass Anatomy"
echo "════════════════════════════════════════════"
echo "  Folder: $(pwd)"
echo

if ! command -v npm >/dev/null 2>&1; then
  echo "  npm is not installed. Install Node.js from nodejs.org, then try again."
  echo; echo "  Press any key to close."; read -r -n 1; exit 1
fi

if [ ! -d node_modules ]; then
  echo "  First run — installing. This takes a minute or two."
  npm install || { echo "  Install failed."; read -r -n 1; exit 1; }
  echo
fi

echo "  Starting. Your browser will open by itself in a moment."
echo "  Leave this window open while you use the site."
echo "  Press Ctrl+C here to stop it."
echo "════════════════════════════════════════════"
echo

# Vite prints the address it settled on — which is not always 5173, since it
# moves up if the port is busy. Watch for that line and open exactly it,
# rather than guessing a URL that might belong to nothing.
opened=""
npm run dev 2>&1 | while IFS= read -r line; do
  printf '%s\n' "$line"
  if [ -z "$opened" ]; then
    clean=$(printf '%s' "$line" | sed $'s/\033\\[[0-9;]*[a-zA-Z]//g')
    case "$clean" in
      *Local:*http*)
        url=$(printf '%s' "$clean" | sed -E 's|.*(https?://[^[:space:]/]+/?).*|\1|')
        if [ -n "$url" ]; then
          sleep 1
          open "$url" 2>/dev/null
          opened="yes"
        fi
        ;;
    esac
  fi
done
