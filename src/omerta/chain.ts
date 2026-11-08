import { Contract, JsonRpcProvider, Wallet } from "ethers";

export const CHAINS = {
  base: {
    id: 8453,
    hex: "0x2105",
    name: "Base",
    rpc: "https://base.publicnode.com",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    explorer: "https://basescan.org",
  },
  ethereum: {
    id: 1,
    hex: "0x1",
    name: "Ethereum",
    rpc: "https://ethereum.publicnode.com",
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    explorer: "https://etherscan.io",
  },
} as const;

export type ChainName = keyof typeof CHAINS;

type WalletProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

export function isEvmAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

function chainOf(name: string) {
  return CHAINS[(name || "base") as ChainName] || CHAINS.base;
}

async function rpc(url: string, method: string, params: unknown[]) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "The chain refused the call");
  return data.result as string;
}

export async function readHouseBalance(chainName: string, wallet: string) {
  const chain = chainOf(chainName);
  if (!isEvmAddress(wallet)) throw new Error("The house wallet must be a 0x address");
  const data = "0x70a08231" + wallet.slice(2).toLowerCase().padStart(64, "0");
  const [raw, chainId] = await Promise.all([
    rpc(chain.rpc, "eth_call", [{ to: chain.usdc, data }, "latest"]),
    rpc(chain.rpc, "eth_chainId", []),
  ]);
  return { chain: chain.name, chainId, usdc: Number(BigInt(raw)) / 1e6 };
}

function transferData(wallet: string, amount: number) {
  const units = BigInt(Math.round(amount * 1_000_000));
  const pad = (hex: string) => hex.replace(/^0x/i, "").padStart(64, "0");
  return { units, data: "0xa9059cbb" + pad(wallet) + pad(units.toString(16)) };
}

export function createHouseWallet() {
  const wallet = Wallet.createRandom();
  return { address: wallet.address, key: wallet.privateKey };
}

export async function exportHouseUsdc(key: string, chainName: string, to: string, amount?: number) {
  const chain = chainOf(chainName);
  if (!isEvmAddress(to)) throw new Error("That payout address is not a 0x address");
  const provider = new JsonRpcProvider(chain.rpc);
  const wallet = new Wallet(key, provider);
  const usdc = new Contract(
    chain.usdc,
    ["function balanceOf(address) view returns (uint256)", "function transfer(address to, uint256 amount) returns (bool)"],
    wallet,
  );
  const balance = (await usdc.balanceOf(wallet.address)) as bigint;
  const units = amount && amount > 0 ? BigInt(Math.round(amount * 1_000_000)) : balance;
  if (units <= 0n) throw new Error("The house wallet has no USDC to export");
  if (units > balance) throw new Error("The house wallet does not hold that much USDC");
  try {
    const tx = await usdc.transfer(to, units);
    return String(tx.hash);
  } catch (err) {
    const message = err instanceof Error ? err.message : "The export was refused";
    if (/insufficient funds/i.test(message)) {
      throw new Error("The house wallet needs a little ETH on this chain before it can export");
    }
    throw new Error(message);
  }
}

export async function payHouseCut(chainName: string, wallet: string, amount: number) {
  const chain = chainOf(chainName);
  if (!isEvmAddress(wallet)) return { error: "The house wallet is not a 0x address" };
  if (!(amount > 0)) return { error: "Nothing to send" };
  const { units, data } = transferData(wallet, amount);
  const ethereum = (window as Window & { ethereum?: WalletProvider }).ethereum;
  if (ethereum) {
    const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];
    try {
      await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chain.hex }] });
    } catch (err) {
      const code = (err as { code?: number }).code;
      if (code === 4902) {
        await ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: chain.hex,
            chainName: chain.name,
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: [chain.rpc],
            blockExplorerUrls: [chain.explorer],
          }],
        });
      }
    }
    const tx = await ethereum.request({
      method: "eth_sendTransaction",
      params: [{ from: accounts[0], to: chain.usdc, data, value: "0x0" }],
    });
    return { tx: String(tx) };
  }
  window.location.href = `ethereum:${chain.usdc}@${chain.id}/transfer?address=${wallet}&uint256=${units.toString()}`;
  return { opened: true };
}
