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

Omertà is a private communications app for people who use a handle instead of a real name. It runs in the browser and can live on a phone home screen. Messages, files, and account records stay on the device. The stored vault is sealed with AES before it is written down.

**Live app:** [synchancybersecurity.github.io/Omerta](https://synchancybersecurity.github.io/Omerta/)

## What you get

Each person signs in with a handle and a passphrase. A new pair creates an account on that device. The same pair opens it again later. The handle is not case sensitive, including when the app looks up a conversation, a private message, or an escrow. The passphrase is case sensitive.

The interface is one dark room with a bottom bar. Sections stay available without a page reload. When a message, post, bid, or room changes, the open screen updates on its own. You do not have to leave and come back to see something new.

| Section | What it is for |
|---|---|
| Profile | Your handle, a portrait you upload, and the posts you publish. |
| News | The shared feed on this device. A post can include writing, a picture, a video, or a file. |
| Chat | The Lounge and any rooms you create. |
| Message | Private conversations between two handles. |
| Contacts | Search for a handle and start a private thread. |
| Escrow | Hold an amount between two handles until it is released, disputed, refunded, or cancelled. |
| MRKT | An auction desk in the style of a public sale. List a lot, bid, buy it now, or watch the clock. |
| Settings | Display, notification, and account preferences for this device. Administrators also find the house books here. |

## Chat rooms

The Lounge is open to every handle on the device. Any member may create another room and name it. A room may be left open, or locked with its own passphrase.

The creator can always return to a room they locked. Everyone else must enter the passphrase. A locked room does not hide the room name. It only keeps the conversation behind the passphrase.

All chat rooms, including locked rooms and the Lounge, are cleared every 48 hours. The room names remain. The messages do not. Private conversations, posts, and market lots are not part of that clear.

Inside a room you can reply to a message, attach a picture or a file, or wrap the text in the emoji cipher before it is sent. The cipher is a disguise for the text. It is separate from the AES seal on the stored vault.

## Messages, posts, and files

Private messages, room messages, and news posts appear as soon as they are sent.

A post or a private message can carry a picture, a video, or another file. There is no size cap inside the app. The phone can still run out of space, and a very large clip can take a moment while it is sealed. Profile portraits are pictures you choose yourself.

A post or a private message can be marked to burn after it is read. A burned message is replaced with a burned notice. It is not restored.

A member can also turn on end to end encryption for a private thread. That option encrypts the message for the other handle before it is stored. It is optional. The vault seal still covers everything on disk either way.

## The market

MRKT is an auction desk. A seller lists a lot with a title, a description, a category, a starting price, and an optional buy now price. A photograph can be attached to the listing. The clock shows how much time is left.

Anyone else on the device may bid, buy the lot outright when buy now is offered, or watch it. A bid must beat the current price. A seller cannot bid on their own lot. When the clock ends, the high bid wins. If nobody bids, the lot simply ends.

## Escrow and the house

Escrow holds an amount between two handles. It can be released, disputed, refunded, or cancelled.

The house keeps 3 percent of every escrow, every bid, and every auction sale. A refund or a cancelled deal does not give that cut back. The rate is fixed.

Those fees are booked to a house wallet that the app creates on the phone. When a payer approves the transfer, the 3 percent is sent as USDC on Base or on Ethereum, whichever chain the house is using. The payer still has to approve it in their own wallet. Omertà does not hold anyone else's key, and it cannot pull coins out of a wallet that has not signed.

An administrator can enter one or more payout addresses and export some or all of the USDC from the house wallet to an address they choose. Leave the amount blank to export the whole balance. The house wallet needs a little ETH on that chain to pay the network fee for the export.

## Recovery

In House Escrow, an administrator can show the recovery phrase and write it down somewhere that is not the phone. After the app is wiped, sign in as an administrator and paste that phrase into Restore house wallet. The same address comes back, and the coins that were already on the chain can be exported again.

The phrase does not bring back messages, posts, rooms, or files. Those live only in the vault on the phone where they were written. A wallet created before phrases existed shows a recovery key instead of twelve words. That key restores the same way.

## Security

The browser vault is encrypted with AES 256 GCM before it is written to device storage. Someone reading the saved file sees ciphertext, not the messages, handles, or passphrases. Pictures, clips, and other files are sealed the same way and stored beside the vault, not inside one giant text file.

The key that opens the message vault stays on the same device. It is not published in this repository, and the house recovery phrase does not open it. Clearing the browser site data removes the vault. There is no way to fetch those messages from another machine.

The published site does not run a shared server. Two phones do not share one vault. A passphrase that exists only on another machine will not open this one. The house coins are the exception: they sit on the chain, and the recovery phrase can point a phone at that same wallet.

## Install

Omertà can be added to a phone home screen.

| Platform | Steps |
|---|---|
| iPhone | Open the link in Safari. Tap Share, then Add to Home Screen. |
| Android | Open the link in Chrome. Use the browser menu, then Add to Home screen or Install app. |

The icon is the coin. The name is Omertà. After an update, close the app completely and open it again.

## Accounts

Sign in with the handle and passphrase saved on that device. If the passphrase does not match an existing handle, the screen says so. It does not pretend the attempt is a new account.

Account details are private to the device. This document does not list them.

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
