# SideScroll

A tiny, always-on-top, frameless mini-browser for scrolling short-form video
(YouTube Shorts, Instagram Reels, TikTok) in a very small window. The default size is
190x340 and it can shrink to about 90x70. In video-only mode the page chrome is hidden,
so only the video shows.

Built with Electron. Developed on Windows 11.

## Run

```
npm install
npm start
```

If `npm start` crashes with `Cannot read properties of undefined (reading 'commandLine')`,
the environment variable `ELECTRON_RUN_AS_NODE` is set (the VS Code extension sets it).
Unset it first:

```
# PowerShell
$env:ELECTRON_RUN_AS_NODE = $null

# Git Bash
unset ELECTRON_RUN_AS_NODE
```

## Features

- Small frameless window that stays on top of other windows.
- Hover control panel (the "rail") beside the window: switch site, back, sign in,
  volume, toggle video-only mode.
- Video-only mode: enters automatically on YouTube Shorts/watch pages and Instagram Reels.
- Keeps playing when the window loses focus.
- Mouse wheel moves to the next or previous video.
- Only the visible site plays sound.
- Navigation is limited to a whitelist of domains.

## Keyboard and mouse

| Input | Action |
| --- | --- |
| Ctrl+Shift+V | Toggle video-only mode |
| Ctrl+Up / Ctrl+Down | Volume up / down |
| Ctrl + / Ctrl - / Ctrl 0 | Zoom |
| Alt+Left, mouse back button | Back |
| Mouse wheel | Next / previous video |

## Project layout

```
main.js          entry and wiring: window, views, IPC
lib/             config, control panel (rail), video-only mode
sites/           one module per site (YouTube, Instagram, TikTok)
preload/         page-side scripts, one per site plus shared code
index.html, renderer.js   control panel UI
```

Site-specific code stays in that site's files so a change for one site cannot break
another. See [CLAUDE.md](CLAUDE.md) for design notes and known issues.

## Status

- YouTube: working.
- Instagram: working (Reels in video-only mode, sign-in supported).
- TikTok: loads, but scrolling and video-only mode are not implemented yet.

## License

No license has been chosen yet.
