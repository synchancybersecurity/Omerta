<p align="center">
  <img src="public/readme-banner.svg" alt="Omertà. Black ops communications. Code of silence." width="100%">
</p>

<p align="center">
  <img src="public/logo.jpg" alt="The Omertà coin" width="140">
</p>

<p align="center">
  <a href="https://synchancybersecurity.github.io/Omerta/"><img src="https://img.shields.io/badge/Open%20the%20vault-B91C1C?style=for-the-badge&labelColor=0A0A0A&color=B91C1C" alt="Open the vault"></a>
  &nbsp;
  <img src="https://img.shields.io/badge/AES%20sealed-B91C1C?style=for-the-badge&labelColor=0A0A0A&color=B91C1C" alt="AES sealed">
  &nbsp;
  <img src="https://img.shields.io/badge/Home%20screen%20app-F0EBE6?style=for-the-badge&labelColor=0A0A0A&color=F0EBE6" alt="Home screen app">
</p>

# Omertà

Omertà is a private communications app for people who use a handle instead of a real name. It runs in the browser. Messages remain on the device. The stored vault is sealed with AES.

**Live app:** [synchancybersecurity.github.io/Omerta](https://synchancybersecurity.github.io/Omerta/)

## Overview

Each person signs in with a handle and a passphrase. A new pair creates an account on that device. The same pair opens it again later. Capitalization of the handle does not matter. The passphrase is case sensitive.

The interface is a single dark room with a bottom bar. Each section stays available without a page reload. When a message, post, or room changes, the open screen updates on its own.

| Section | What it is for |
|---|---|
| Profile | Your handle, portrait, and the posts you publish. |
| News | The shared feed for this device. Posts can be liked, answered, or shared into a room. |
| Chat | The Lounge and any rooms you create. |
| Message | Private conversations between two handles. |
| Contacts | Search for a handle and start a private thread. |
| Escrow | Hold an amount between two handles until it is released, disputed, or cancelled. |
| MRKT | An auction desk. List a lot, bid, buy now, or watch it until the clock ends. |
| Settings | Display, notification, and account preferences for this device. |

## Chat rooms

The Lounge is open to every handle on the device. Any member may create an additional room and name it. A room may be left open, or locked with its own passphrase.

The creator can always return to a room they locked. Everyone else must enter the passphrase. A locked room does not hide the room name. It only keeps the conversation behind the passphrase.

All chat rooms, including locked rooms and the Lounge, are cleared every 48 hours. The room names remain. The messages do not. Private conversations are not part of that clear.

Inside a room you can reply to a message, or wrap the text in the emoji cipher before it is sent. The cipher is a disguise for the text. It is separate from the AES seal on the stored vault.

## Messages and posts

Private messages appear in the thread as soon as they are sent. You do not need to leave the screen and come back. The same is true for the Lounge, custom rooms, and the news feed.

A post or a private message can be marked to burn after it is read. A burned message is replaced with a burned notice. It is not restored.

A member can also turn on end to end encryption for a private thread. That option encrypts the message for the other handle before it is stored. It is optional. The vault seal still covers everything on disk either way.

## Security

The browser vault is encrypted with AES 256 GCM before it is written to device storage. Someone reading the saved file sees ciphertext, not the messages, handles, or passphrases.

The key that opens that vault stays on the same device. It is not published in this repository. Clearing the browser site data removes both the vault and the key. There is no recovery from another machine.

The published site does not run a shared server. Two phones do not share one vault. A passphrase that exists only on another machine will not open this one.

## Install

Omertà can be added to a phone home screen.

| Platform | Steps |
|---|---|
| iPhone | Open the link in Safari. Tap Share, then Add to Home Screen. |
| Android | Open the link in Chrome. Use the browser menu, then Add to Home screen or Install app. |

The icon is the coin. The name is Omertà. After an update, close the app completely and open it again.

## Accounts

Sign in with the handle and passphrase saved on that device. If the passphrase does not match, the screen reports that directly. It does not treat the attempt as a new account.

## Local development

```bash
npm install
npm run dev
```

The build published to GitHub Pages:

```bash
npm run build:pages
```

## Legacy server

The original Express program is preserved in the `original` folder, including the database layer, Docker, and the Termux notes. Its database is also sealed with AES. The key remains on the machine that runs the server and is not stored in this repository.

GitHub Pages serves the browser app only. It does not keep that process running. If you start the legacy server, run it on a machine you control and do not expose the shell to the public internet.
