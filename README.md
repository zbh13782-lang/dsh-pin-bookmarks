# dsh-pin-bookmarks

A right-Sidebar **reading board** for DeepSeek Harness. Pin one of the assistant's replies into the right column, read it as rendered Markdown beside the conversation, then select the part you do not understand and send it back into the main composer as a quote.

## Screenshots

A reply pinned on the right, rendered as Markdown beside the conversation — heading, numbered steps, a blockquote, a table and a labelled code block, with the card's own controls under it:

![The reading board with a pinned reply rendered as Markdown](assets/panel.png)

The entry points — the two icon actions in the row under a finished reply (each label appears on hover only, laid out like the row's other icon buttons):

![The reading-board action in a finished reply's action row](assets/action-row.png)

## Why

Long answers are easier to work through beside the chat than in it: the board keeps one reply visible while you scroll the conversation, and asking about a specific sentence is one gesture instead of retyping it.

## Use

1. **Pin.** A finished assistant reply carries two icon actions, and they are the entry points:
   - **☆ star — “Pin to the reading board”.** Pins the reply and leaves the right column alone; nothing opens. Once the reply is pinned the ☆ is filled; clicking the ★ again unpins, so the star goes back to ☆, that turn's rail marker goes back to a normal tick, and the column still does not open.
   - **→ arrow — “Pin to reading board”.** Pins the reply and opens the right column on the **Reading board** tab. On a reply that is already pinned it only opens the column, and says the reply is already on the board.
   - Or open the board from the arrow icon in the session header, and paste arbitrary text with **+ Paste text** at the bottom of the panel.
2. **Read.** Pins render as Markdown — headings, lists, blockquotes, tables, syntax-coloured fenced code, bold/italic/inline code/links — not as source. Cards are expanded in full; **Collapse** folds one back to a preview.
   Each card's head shows when its message was written — the clock alone for today, `MM-DD HH:mm` for another day, and the year too once it is not this year — and a **Jump** button scrolls the conversation back to the message the pin came from.
3. **Ask.** Drag-select a passage; a blue pill **→ Send to chat** appears once the selection is released. Clicking it puts that passage into the main composer as a Markdown quote — add your question and send. Without a selection, **Ask** on the card quotes the whole pin.

## Behaviour

- Pins live in browser `localStorage`, one set per session; a reload keeps them, clearing site data removes them. The marker appearance in **Settings → Reading board** is the one exception: those preferences are stored once for the whole device, so a change there applies to every session. That change also reaches the app's other windows and sessions on this device at once, without a reload.
- The two reply icons are the entry points: the star pins in place and toggles the pin off again, the arrow pins and opens the column.
- A pinned turn's tick on the right edge of the conversation — the turn navigator — gets longer, thicker and brightly coloured: 26 px wide by default and 4 px tall, against the 20 px the longest normal tick reaches. Each pinned turn takes its own bright colour. This colouring needs the turn to be loaded in the transcript: markers exist only for turns that are currently loaded, and several pinned replies inside one turn share that turn's single mark.
- **Settings → Reading board** is where that appearance is set, and it does nothing else: **Use one color** (with a colour picker while it is on), **Use one length** (with a 22–28 px slider while it is on), and a preview of the effect. Even the shortest pin marker is longer than a normal tick.
- Pins written before turn numbers were recorded carry none. For those the plugin reads the session history — passively, a page at a time, and only until it has what it needs — to learn which turn the pin belongs to, so its marker can be coloured. When that lookup cannot find it, the marker is simply absent.
- The label under an icon action is a bubble, and it is visible only while the pointer is on that icon; the feedback line a click produces goes as soon as the pointer leaves.
- Pins hold at most 40 entries per session; the oldest is dropped past that.
- Every write merges against what is already stored rather than the in-page cache, so a reload between two writes cannot drop a pin.
- Quotes are capped: 2000 characters from a reply (that reply is already in the session log), 6000 from a pasted excerpt. The overflow is marked `… (truncated)`.
- **Jump** finds the message through the conversation's own anchor keys. When the row is not paged in yet, it walks backwards through the chat's own *load older* control until the row appears, then centres on it. It ends in one of three ways, each with its own line: the row appears; the start of the conversation is reached and the row is not in it (the *load older* control is gone or disabled); or the walk runs out of budget — 15 seconds, 60 pages, or a column that stops growing while the control is still clickable — and it then reports only how many pages it tried, without claiming to have reached the start.
- Pins made before 0.1.3 carry the time they were pinned; from 0.1.3 on, a reply's pin carries the time the reply was written.
- Only the session on screen has a composer. Where it is unavailable, the panel copies the passage to the clipboard and says so instead.
- The Markdown renderer is the plugin's own and deliberately small: no math, no Mermaid, no raw HTML, no images. Those show as text.
- Fenced code is coloured with the theme's own shiki palette (`--shiki-token-*`), so a block reads here exactly as it does in the conversation and follows light/dark with the rest of the app. Recognised languages: `js`/`ts`/`tsx`, `python`, `go`, `rust`, `sh`/`bash`, `sql`, `json`, `yaml`. Anything else stays in plain monospace rather than guessing.

> Renamed from `dsh-ask-reader` in 0.3.0. Pins made under the old name are read once and copied to the new storage key, so nothing is lost; the old install address keeps working through GitHub's redirect.

## Install

From the repository, or from the prebuilt tarball attached to [the latest release](https://github.com/zbh13782-lang/dsh-pin-bookmarks/releases/latest):

```sh
dsh plugin --profile <profile> add github:zbh13782-lang/dsh-pin-bookmarks
# or
dsh plugin --profile <profile> add https://github.com/zbh13782-lang/dsh-pin-bookmarks/releases/latest/download/dsh-pin-bookmarks.tgz
```

Or, in DSH Desktop, **Settings → Plugins → Add plugin** and paste either address. The package declares `dsh.bundle`, ships no dependencies, no build step and no install scripts — a tarball install therefore skips the build-approval prompt.

The same two addresses work unchanged on Windows and Linux: the plugin is a browser bundle, `index.js` is empty, and nothing in it reads a path, a shell or an OS name. The tarball is plain `.tgz` (distil with `tar -xzf` if you want to read it), and `tar` ships with Windows 10 and later.

If your profile shows this plugin as a **`link:` entry pointing into a local directory** — for example `link:/Users/you/dsh-plugins/dsh-pin-bookmarks` — that row came from a directory install on another machine and cannot work here: Plugins reports it as *指向本地目录，本机不存在*. Remove that row and install from one of the two addresses above instead; nothing in the plugin needs to change.

## Layout

| Path | Role |
| --- | --- |
| `client.js` | The whole browser half: tab type, panel body, Markdown renderer, the two reply actions, the settings section, the header entry |
| `index.js` | Host half (empty — the bundle row needs a module) |
| `cordis.patch.yml` | Loader row inserted by the bundle |
| `locale/*.json` | Plugin Manager title/description |
| `docs/DETAIL.md` | The detail page shown in Plugin Manager |

## Licence

MIT.