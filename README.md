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

Each person signs in with a handle and a passphrase. A new pair creates an account on that device. The same pair opens it again later. Capitalization of the handle does not matter.

The app includes a profile, a news feed, private messages, contacts, chat rooms, an escrow desk, and settings. New messages appear while you remain on the current screen.

## Chat rooms

The Lounge is open to every handle on the device. Any member may create an additional room. A room may be locked with a passphrase. The creator can always reenter a locked room. Other members need the passphrase.

All chat rooms, including locked rooms, are cleared every 48 hours. Private messages are not included in that clear.

Posts may be plain text, set to burn after reading, or wrapped in the emoji cipher.

## Install

Omertà can be added to a phone home screen.

| Platform | Steps |
|---|---|
| iPhone | Open the link in Safari. Tap Share, then Add to Home Screen. |
| Android | Open the link in Chrome. Use the browser menu, then Add to Home screen or Install app. |

The icon is the coin. The name is Omertà. After an update, close the app completely and open it again.

## Accounts and data

Sign in with the handle and passphrase saved on that device. If the passphrase does not match, the screen reports that directly. It does not treat the attempt as a new account.

The published site does not run a shared server. Two phones do not share one vault. A passphrase that exists only on another machine will not open this one.

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
