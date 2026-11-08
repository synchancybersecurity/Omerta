import { HDKey } from "@scure/bip32";
import { mnemonicToSeedSync } from "@scure/bip39";
import { Address, NETWORK, Transaction, getAddress, p2wpkh } from "@scure/btc-signer";
import { pubECDSA } from "@scure/btc-signer/utils.js";
import { Wallet } from "ethers";

const MEMPOOL = "https://mempool.space/api";

export function isBtcAddress(value: string) {
  const text = value.trim();
  if (!/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,90}$/.test(text)) return false;
  try {
    Address(NETWORK).decode(text);
    return true;
  } catch {
    return false;
  }
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value: string) {
  const clean = value.replace(/^0x/, "");
  if (!/^[a-f0-9]{64}$/i.test(clean)) throw new Error("That recovery key is not valid");
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function accountFromKey(privateKey: Uint8Array, phrase = "") {
  const address = getAddress("wpkh", privateKey);
  if (!address) throw new Error("The bitcoin address could not be made");
  return { address, key: bytesToHex(privateKey), phrase };
}

function accountFromPhrase(phrase: string) {
  const seed = mnemonicToSeedSync(phrase);
  const node = HDKey.fromMasterSeed(seed).derive("m/84'/0'/0'/0/0");
  if (!node.privateKey) throw new Error("The recovery phrase did not produce a key");
  return accountFromKey(node.privateKey, phrase);
}

export function createHouseWallet() {
  const phrase = Wallet.createRandom().mnemonic?.phrase || "";
  if (!phrase) throw new Error("The recovery phrase could not be made");
  return accountFromPhrase(phrase);
}

export function restoreHouseWallet(secret: string) {
  const text = secret.trim().toLowerCase().replace(/\s+/g, " ");
  if (/^(0x)?[a-f0-9]{64}$/.test(text)) return accountFromKey(hexToBytes(text));
  Wallet.fromPhrase(text);
  return accountFromPhrase(text);
}

export function asBitcoinWallet(wallet: { address: string; key: string; phrase?: string }) {
  if (wallet.phrase) return accountFromPhrase(wallet.phrase);
  if (wallet.key) return accountFromKey(hexToBytes(wallet.key));
  return createHouseWallet();
}

export function formatBtc(value: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0 BTC";
  const text = n.toFixed(8).replace(/\.?0+$/, "");
  return (text || "0") + " BTC";
}

async function btcPrice() {
  if (!clearnetOpen()) throw new Error("Tor only is on, so the price feed is blocked");
  const res = await fetch(MEMPOOL + "/v1/prices");
  if (!res.ok) throw new Error("The bitcoin price did not load");
  const data = await res.json();
  const usd = Number(data.USD);
  if (!(usd > 0)) throw new Error("The bitcoin price did not load");
  return usd;
}

function clearnetOpen() {
  try { return localStorage.getItem("omerta_tor_only") !== "1"; } catch { return true; }
}

export async function spotUsd() {
  return btcPrice();
}

export async function readHouseBalance(address: string) {
  if (!clearnetOpen()) throw new Error("Tor only is on, so the balance check is blocked");
  if (!isBtcAddress(address)) throw new Error("The house wallet is not a bitcoin address");
  const res = await fetch(MEMPOOL + "/address/" + address);
  if (!res.ok) throw new Error("Bitcoin did not answer");
  const data = await res.json();
  const confirmed = Number(data.chain_stats?.funded_txo_sum || 0) - Number(data.chain_stats?.spent_txo_sum || 0);
  const pending = Number(data.mempool_stats?.funded_txo_sum || 0) - Number(data.mempool_stats?.spent_txo_sum || 0);
  return { chain: "Bitcoin", btc: (confirmed + pending) / 1e8 };
}

export async function payHouseCut(address: string, btc: number): Promise<{ tx?: string; opened?: boolean; error?: string; btc?: number }> {
  if (!isBtcAddress(address)) return { error: "The house wallet is not a bitcoin address" };
  if (!(btc > 0)) return { error: "Nothing to send" };
  const sats = Math.round(btc * 1e8);
  if (sats < 546) return { error: "That cut is below the bitcoin dust limit. It stays on the books." };
  window.location.href = `bitcoin:${address}?amount=${(sats / 1e8).toFixed(8)}`;
  return { opened: true, btc: sats / 1e8 };
}

type Utxo = { txid: string; vout: number; value: number; status?: { confirmed?: boolean } };

export async function exportHouseBtc(key: string, to: string, amount?: number) {
  if (!clearnetOpen()) throw new Error("Tor only is on, so the export is blocked");
  if (!isBtcAddress(to)) throw new Error("That payout address is not a bitcoin address");
  const privateKey = hexToBytes(key);
  const from = getAddress("wpkh", privateKey);
  if (!from) throw new Error("The house wallet is not a bitcoin address");
  const [utxoRes, feeRes] = await Promise.all([
    fetch(MEMPOOL + "/address/" + from + "/utxo"),
    fetch(MEMPOOL + "/v1/fees/recommended"),
  ]);
  if (!utxoRes.ok || !feeRes.ok) throw new Error("Bitcoin did not answer");
  const utxos = ((await utxoRes.json()) as Utxo[]).filter((item) => item.status?.confirmed);
  const fees = await feeRes.json();
  const rate = BigInt(Math.max(1, Number(fees.halfHourFee) || 2));
  if (!utxos.length) throw new Error("The house wallet has no confirmed bitcoin yet");
  const spend = p2wpkh(pubECDSA(privateKey));
  const selected: Utxo[] = [];
  let total = 0n;
  const requested = amount && amount > 0 ? BigInt(Math.round(amount * 1e8)) : 0n;
  for (const utxo of utxos.sort((a, b) => b.value - a.value)) {
    selected.push(utxo);
    total += BigInt(utxo.value);
    const fee = (BigInt(selected.length) * 68n + 62n) * rate;
    if (!requested || total >= requested + fee) break;
  }
  const fee = (BigInt(selected.length) * 68n + (requested ? 93n : 31n)) * rate;
  const send = requested || (total > fee ? total - fee : 0n);
  if (send < 546n) throw new Error("The house wallet does not hold enough bitcoin to export");
  if (total < send + fee) throw new Error("The house wallet does not hold enough bitcoin to cover the network fee");
  const change = total - send - fee;
  const tx = new Transaction();
  for (const utxo of selected) {
    tx.addInput({
      txid: utxo.txid,
      index: utxo.vout,
      witnessUtxo: { script: spend.script, amount: BigInt(utxo.value) },
    });
  }
  tx.addOutputAddress(to, send, NETWORK);
  if (change > 546n) tx.addOutputAddress(from, change, NETWORK);
  tx.sign(privateKey);
  tx.finalize();
  const raw = tx.hex;
  const sent = await fetch(MEMPOOL + "/tx", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: raw,
  });
  const body = await sent.text();
  if (!sent.ok) throw new Error(body || "The export was refused");
  return body.trim();
}

export async function recordHouseTx(sourceId: string, tx: string) {
  const house = await fetch("/api/house/settings").then((response) => response.json()).catch(() => null);
  const payment = (house?.payments || []).find((row: { id: string; source_id: string; status: string }) => row.status !== "sent" && row.source_id === sourceId)
    || (house?.payments || []).find((row: { id: string; source_id: string; status: string }) => row.status !== "sent" && row.source_id.startsWith(sourceId + ":"));
  if (!payment) return;
  await fetch("/api/house/payments/" + payment.id + "/sent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tx }),
  });
}
