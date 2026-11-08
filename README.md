<p align="center">
  <img src="public/readme-banner.svg" alt="Omertà. Black ops communications. Code of silence." width="100%">
</p>

<p align="center">
  <img src="public/logo.jpg" alt="The Omertà coin" width="140">
</p>

<p align="center">
  <a href="https://synchancybersecurity.github.io/Omerta/"><img src="https://img.shields.io/badge/Open%20the%20vault-B91C1C?style=for-the-badge&labelColor=0A0A0A&color=B91C1C" alt="Open the vault"></a>
  &nbsp;
  <img src="https://img.shields.io/badge/Pit%20black-0A0A0A?style=for-the-badge&labelColor=0A0A0A&color=0A0A0A" alt="Pit black">
  &nbsp;
  <img src="https://img.shields.io/badge/Blood-B91C1C?style=for-the-badge&labelColor=0A0A0A&color=B91C1C" alt="Blood">
  &nbsp;
  <img src="https://img.shields.io/badge/Bone-F0EBE6?style=for-the-badge&labelColor=0A0A0A&color=F0EBE6" alt="Bone">
</p>

# Omertà

Omertà is a private room for people who would rather speak in handles than in real names. You open it in the browser, you keep a passphrase, and the messages stay on that phone or computer. Nobody else is sitting on a server reading the room.

The live app is here: [synchancybersecurity.github.io/Omerta](https://synchancybersecurity.github.io/Omerta/)

## What you can do

You pick a handle and a passphrase. If that pair is new, the vault makes the account. If you have used it on this device before, the same pair lets you back in.

Inside, you get a profile, a news feed, private chat, a message box, contacts, a small escrow desk, and settings. Posts can be plain, burned after reading, or wrapped in the emoji cipher. The coin on the login screen is the mark of the house.

## Put it on your phone

The site is already a home screen app.

On an iPhone, open the link in Safari. Tap Share, then Add to Home Screen. The icon is the coin, and the name is Omertà.

On Android, open the link in Chrome. Use the browser menu and choose Add to Home screen, or Install app.

After that, launch it from the icon like any other app. If a change does not show up, close the app all the way and open it again.

## Sign in

Type the handle and the passphrase you used the first time on that device. Capital letters in the handle do not matter. Flint and flint are the same person.

If the passphrase does not match what this phone saved, the screen says so. It will not pretend you are trying to create a second account.

This copy of the vault lives in the browser. It is not the old machine in the back room. A passphrase that only ever lived on that machine will not open the phone.

## Run it yourself

If you want the same app on your own computer:

```bash
npm install
npm run dev
```

The pages build, the one GitHub publishes, is:

```bash
npm run build:pages
```

## The old server

The original Express program is kept in the `original` folder, including the database layer, Docker, and the Termux notes. GitHub Pages cannot keep that process running. It only serves the browser app. If you start the old server yourself, do it on a machine you control, and do not leave a shell open to the internet.

## The colors

The room is pit black, the mark is blood, and the type is bone. That is the whole palette. It should feel like a back room, not a toy and not a spaceship.

<p align="center">
  <img src="https://img.shields.io/badge/0A0A0A-0A0A0A?style=flat-square" alt="0A0A0A">
  <img src="https://img.shields.io/badge/B91C1C-B91C1C?style=flat-square" alt="B91C1C">
  <img src="https://img.shields.io/badge/F0EBE6-F0EBE6?style=flat-square" alt="F0EBE6">
</p>
