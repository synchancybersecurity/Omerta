import { useCallback, useEffect, useMemo, useState } from "react";
import { payHouseCut, recordHouseTx } from "@omerta/chain";
import { formatPair, useUsdPrice } from "@omerta/money";
import { VaultImg } from "@omerta/components/Attachment";
import { useApp } from "@omerta/store/AppContext";
import { ArrowLeft, Clock, Gavel, Heart, Plus, Search, Store, Tag } from "lucide-react";

type Bid = { id: string; bidder: string; amount: number; timestamp: number };
type Listing = {
  id: string;
  seller: string;
  title: string;
  description: string;
  category: string;
  image: string | null;
  start_price: number;
  buy_now: number | null;
  ends_at: number;
  created_at: number;
  status: "live" | "sold" | "ended" | "cancelled";
  winner: string | null;
  sold_price: number | null;
  bids: Bid[];
  watchers: string[];
};

const DESKS = ["Live", "Ending", "Buy now", "Watching", "Bidding", "Selling"] as const;

function money(value: number, price: number) {
  return formatPair(value, price);
}

function highBid(lot: Listing) {
  return lot.bids.reduce((top, bid) => (bid.amount > top ? bid.amount : top), 0);
}

function priceOf(lot: Listing) {
  if (lot.status === "sold" && lot.sold_price !== null) return lot.sold_price;
  const high = highBid(lot);
  return high || lot.start_price;
}

function stepFor(amount: number) {
  if (amount < 0.001) return 0.00001;
  if (amount < 0.01) return 0.0001;
  if (amount < 0.1) return 0.001;
  return 0.01;
}

function minimumBid(lot: Listing) {
  const high = highBid(lot);
  if (!high) return lot.start_price;
  return high + stepFor(high);
}

function timeLeft(ends: number) {
  const left = ends - Date.now();
  if (left <= 0) return "Ended";
  const mins = Math.floor(left / 60000);
  if (mins < 60) return mins + "m";
  const hours = Math.floor(mins / 60);
  if (hours < 48) return hours + "h " + (mins % 60) + "m";
  return Math.floor(hours / 24) + "d " + (hours % 24) + "h";
}

function statusLine(lot: Listing) {
  if (lot.status === "sold") return "Sold";
  if (lot.status === "ended") return "Unsold";
  if (lot.status === "cancelled") return "Withdrawn";
  return timeLeft(lot.ends_at);
}

export default function MrktTab() {
  const { userHandle } = useApp();
  const price = useUsdPrice();
  const [lots, setLots] = useState<Listing[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [desk, setDesk] = useState<(typeof DESKS)[number]>("Live");
  const [openId, setOpenId] = useState<string | null>(null);
  const [selling, setSelling] = useState(false);
  const [bid, setBid] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    start_price: "",
    buy_now: "",
    days: "3",
    image: null as string | null,
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/market");
      const data = await res.json();
      if (Array.isArray(data)) setLots(data);
    } catch {
      /* the desk stays as it was */
    }
  }, []);

  useEffect(() => {
    void load();
    const tick = window.setInterval(() => { void load(); }, 4000);
    const onLive = () => { void load(); };
    window.addEventListener("omerta-live", onLive);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener("omerta-live", onLive);
    };
  }, [load]);

  const open = lots.find((lot) => lot.id === openId) || null;
  const me = userHandle.trim().toLowerCase();

  const chips = useMemo(() => {
    const names = [...new Set(lots.map((lot) => lot.category.trim()).filter(Boolean))];
    names.sort((a, b) => a.localeCompare(b));
    return ["All", ...names];
  }, [lots]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lots
      .filter((lot) => category === "All" || lot.category.trim().toLowerCase() === category.trim().toLowerCase())
      .filter((lot) => !q || lot.title.toLowerCase().includes(q) || lot.seller.toLowerCase().includes(q))
      .filter((lot) => {
        if (desk === "Live") return lot.status === "live";
        if (desk === "Ending") return lot.status === "live" && lot.ends_at - Date.now() < 86400000;
        if (desk === "Buy now") return lot.status === "live" && lot.buy_now !== null;
        if (desk === "Watching") return lot.watchers.some((name) => name.toLowerCase() === me);
        if (desk === "Bidding") return lot.bids.some((item) => item.bidder.toLowerCase() === me);
        return lot.seller.toLowerCase() === me;
      })
      .sort((a, b) => a.ends_at - b.ends_at);
  }, [lots, query, category, desk, me]);

  const placeBid = async (lot: Listing) => {
    setNotice("");
    setBusy(true);
    const amount = Number(bid || minimumBid(lot));
    const res = await fetch("/api/market/" + lot.id + "/bid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bidder: userHandle, amount }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setNotice(data.error || "The bid was refused");
      return;
    }
    setBid("");
    setNotice("Bid accepted");
    await load();
    const fee = Number((amount * 0.03).toFixed(8));
    const house = await fetch("/api/house/settings").then((response) => response.json()).catch(() => null);
    if (house?.feeWallet && fee > 0) {
      try {
        const result = await payHouseCut(house.feeWallet, fee);
        if (result.tx) {
          await recordHouseTx(lot.id, result.tx);
          setNotice("House cut sent on chain");
        } else if (result.opened) setNotice("Approve the 3 percent bitcoin transfer in your wallet");
        else if (result.error) setNotice(result.error);
      } catch {
        setNotice("The wallet refused the house cut");
      }
    }
  };

  const buyNow = async (lot: Listing) => {
    setNotice("");
    setBusy(true);
    const res = await fetch("/api/market/" + lot.id + "/buy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bidder: userHandle }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setNotice(data.error || "Buy now was refused");
      return;
    }
    setNotice("You bought this lot");
    await load();
    const house = await fetch("/api/house/settings").then((response) => response.json()).catch(() => null);
    if (house?.feeWallet && lot.buy_now) {
      const fee = Number((lot.buy_now * 0.03).toFixed(8));
      try {
        const result = await payHouseCut(house.feeWallet, fee);
        if (result.tx) {
          await recordHouseTx(lot.id, result.tx);
          setNotice("House cut sent on chain");
        } else if (result.opened) {
          setNotice("Approve the 3 percent bitcoin transfer in your wallet");
        } else if (result.error) {
          setNotice(result.error);
        }
      } catch {
        setNotice("The wallet refused the house cut");
      }
    }
  };

  const watch = async (lot: Listing) => {
    await fetch("/api/market/" + lot.id + "/watch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: userHandle }),
    });
    await load();
  };

  const withdraw = async (lot: Listing) => {
    const res = await fetch("/api/market/" + lot.id + "/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seller: userHandle }),
    });
    const data = await res.json();
    if (!res.ok) setNotice(data.error || "It could not be withdrawn");
    await load();
  };

  const publish = async () => {
    setNotice("");
    setBusy(true);
    const categoryName = form.category.trim().slice(0, 40);
    if (!categoryName) {
      setBusy(false);
      setNotice("Type a category");
      return;
    }
    const res = await fetch("/api/market", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seller: userHandle,
        title: form.title,
        description: form.description,
        category: categoryName,
        start_price: Number(form.start_price),
        buy_now: form.buy_now.trim() ? Number(form.buy_now) : null,
        days: Number(form.days),
        image: form.image,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setNotice(data.error || "The lot was not listed");
      return;
    }
    setSelling(false);
    setForm({ title: "", description: "", category: "", start_price: "", buy_now: "", days: "3", image: null });
    setOpenId(data.id);
    await load();
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setNotice("Choose a picture");
      return;
    }
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body });
    const data = await res.json();
    if (!res.ok || !data.url) {
      setNotice(data.error || "The photo was not saved");
      return;
    }
    setForm((prev) => ({ ...prev, image: data.url }));
  };

  return (
    <div className="h-full overflow-y-auto" style={{ background: "hsl(var(--background))" }}>
      <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: "hsl(var(--border))" }}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {(open || selling) && (
              <button type="button" onClick={() => { setOpenId(null); setSelling(false); setNotice(""); }} aria-label="Back">
                <ArrowLeft size={18} style={{ color: "hsl(var(--foreground))" }} />
              </button>
            )}
            <Store size={16} style={{ color: "hsl(var(--primary))" }} />
            <h2 className="font-serif text-2xl tracking-wider" style={{ color: "hsl(var(--foreground))" }}>MRKT</h2>
          </div>
          {!selling && !open && (
            <button type="button" onClick={() => { setSelling(true); setNotice(""); }} className="flex items-center gap-1 px-3 py-2 rounded-sm font-mono text-[10px] uppercase tracking-wider" style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}>
              <Plus size={12} /> Sell
            </button>
          )}
        </div>
        {!open && !selling && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-sm border" style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}>
            <Search size={14} style={{ color: "hsl(var(--muted-foreground))" }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search lots or sellers" className="flex-1 bg-transparent font-mono text-sm outline-none" style={{ color: "hsl(var(--foreground))" }} />
          </div>
        )}
      </div>

      {notice && <p className="px-4 pt-3 font-mono text-[11px] text-center" style={{ color: "hsl(var(--primary))" }}>{notice}</p>}

      {!open && !selling && (
        <>
          <div className="flex gap-2 overflow-x-auto px-4 py-3">
            {chips.map((item) => (
              <button key={item} type="button" onClick={() => setCategory(item)} className="shrink-0 px-3 py-1 rounded-full font-mono text-[10px] uppercase tracking-wider border" style={{ borderColor: category === item ? "hsl(var(--primary))" : "hsl(var(--border))", color: category === item ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}>{item}</button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto px-4 pb-2">
            {DESKS.map((item) => (
              <button key={item} type="button" onClick={() => setDesk(item)} className="shrink-0 px-3 py-1 font-mono text-[10px] uppercase tracking-wider" style={{ color: desk === item ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))", borderBottom: desk === item ? "2px solid hsl(var(--primary))" : "2px solid transparent" }}>{item}</button>
            ))}
          </div>
          <div className="px-4 pb-8 space-y-3">
            {visible.length === 0 && <p className="font-mono text-xs text-center py-10" style={{ color: "hsl(var(--muted-foreground))" }}>No lots on this desk.</p>}
            {visible.map((lot) => {
              const watching = lot.watchers.some((name) => name.toLowerCase() === me);
              return (
                <button key={lot.id} type="button" onClick={() => { setOpenId(lot.id); setNotice(""); setBid(""); }} className="w-full text-left flex gap-3 p-3 rounded-md border" style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}>
                  <Thumb lot={lot} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-serif text-base leading-tight" style={{ color: "hsl(var(--foreground))" }}>{lot.title}</p>
                      <Heart size={14} fill={watching ? "hsl(var(--primary))" : "none"} style={{ color: "hsl(var(--primary))", flexShrink: 0 }} />
                    </div>
                    <p className="font-mono text-[10px] mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>{lot.seller} · {lot.category}</p>
                    <p className="font-mono text-sm mt-2" style={{ color: "hsl(var(--primary))" }}>{money(priceOf(lot), price)} <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>{lot.bids.length ? lot.bids.length + " bids" : "opening"}</span></p>
                    <p className="font-mono text-[10px] mt-1 flex items-center gap-1" style={{ color: lot.status === "live" ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))" }}><Clock size={10} /> {statusLine(lot)}{lot.buy_now !== null && lot.status === "live" ? " · Buy now " + money(lot.buy_now, price) : ""}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {open && (
        <div className="px-4 py-4 pb-10 space-y-4">
          <div className="rounded-md overflow-hidden border" style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}>
            {open.image ? <VaultImg src={open.image} className="w-full h-56 object-cover" /> : <div className="h-40 flex items-center justify-center"><Tag size={28} style={{ color: "hsl(var(--primary))" }} /></div>}
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>{open.category} · {open.seller}</p>
            <h3 className="font-serif text-2xl mt-1" style={{ color: "hsl(var(--foreground))" }}>{open.title}</h3>
          </div>
          <div className="rounded-md border p-4" style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}>
            <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>{open.status === "sold" ? "Sold for" : open.bids.length ? "Current bid" : "Opening price"}</p>
            <p className="font-serif text-4xl mt-1" style={{ color: "hsl(var(--primary))" }}>{money(priceOf(open), price)}</p>
            <p className="font-mono text-xs mt-2" style={{ color: "hsl(var(--foreground))" }}>{statusLine(open)} · {open.bids.length} bids{open.winner ? " · " + open.winner : ""}</p>
            <p className="font-mono text-[10px] mt-2" style={{ color: "hsl(var(--muted-foreground))" }}>The house keeps 3 percent in bitcoin. A refund does not return it.</p>
          </div>
          {open.description && <p className="font-mono text-xs leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>{open.description}</p>}
          {open.status === "live" && open.seller.toLowerCase() !== me && (
            <div className="space-y-2">
              <label className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>Your bid · minimum {money(minimumBid(open), price)}</label>
              <input value={bid} onChange={(e) => setBid(e.target.value)} inputMode="decimal" placeholder={money(minimumBid(open), price)} className="w-full rounded-sm px-3 py-3 font-mono text-sm border" style={{ background: "hsl(var(--input))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }} />
              <button type="button" disabled={busy} onClick={() => placeBid(open)} className="w-full py-3 rounded-sm font-mono text-xs uppercase tracking-wider" style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}><Gavel size={14} className="inline mr-2" />Place bid</button>
              {open.buy_now !== null && (
                <button type="button" disabled={busy} onClick={() => buyNow(open)} className="w-full py-3 rounded-sm font-mono text-xs uppercase tracking-wider border" style={{ borderColor: "hsl(var(--primary))", color: "hsl(var(--primary))" }}>Buy now {money(open.buy_now, price)}</button>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => watch(open)} className="flex-1 py-2 rounded-sm font-mono text-[10px] uppercase tracking-wider border" style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}>{open.watchers.some((name) => name.toLowerCase() === me) ? "Watching" : "Watch"}</button>
            {open.seller.toLowerCase() === me && open.status === "live" && open.bids.length === 0 && (
              <button type="button" onClick={() => withdraw(open)} className="flex-1 py-2 rounded-sm font-mono text-[10px] uppercase tracking-wider border" style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>Withdraw</button>
            )}
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>Bid history</p>
            {open.bids.length === 0 && <p className="font-mono text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>No bids yet.</p>}
            {[...open.bids].reverse().map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2 border-b" style={{ borderColor: "hsl(var(--border))" }}>
                <span className="font-mono text-xs" style={{ color: "hsl(var(--foreground))" }}>{item.bidder}</span>
                <span className="font-mono text-xs" style={{ color: "hsl(var(--primary))" }}>{money(item.amount, price)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {selling && (
        <form className="px-4 py-4 pb-10 space-y-3" onSubmit={(e) => { e.preventDefault(); void publish(); }}>
          <Field label="Title" value={form.title} onChange={(title) => setForm({ ...form, title })} />
          <label className="block font-mono text-[10px] uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>Description</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} className="w-full rounded-sm px-3 py-2 font-mono text-sm border" style={{ background: "hsl(var(--input))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }} />
          <Field label="Category" value={form.category} onChange={(category) => setForm({ ...form, category: category.slice(0, 40) })} />
          <Field label="Opening price in BTC" value={form.start_price} onChange={(start_price) => setForm({ ...form, start_price })} numeric />
          {Number(form.start_price) > 0 && <p className="font-mono text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>{money(Number(form.start_price), price)}</p>}
          <Field label="Buy now in BTC, optional" value={form.buy_now} onChange={(buy_now) => setForm({ ...form, buy_now })} numeric />
          {Number(form.buy_now) > 0 && <p className="font-mono text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>{money(Number(form.buy_now), price)}</p>}
          <label className="block font-mono text-[10px] uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>Duration</label>
          <div className="flex gap-2">
            {["1", "3", "5", "7"].map((days) => (
              <button key={days} type="button" onClick={() => setForm({ ...form, days })} className="flex-1 py-2 rounded-sm font-mono text-[10px] border" style={{ borderColor: form.days === days ? "hsl(var(--primary))" : "hsl(var(--border))", color: form.days === days ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}>{days}d</button>
            ))}
          </div>
          <label className="block font-mono text-[10px] uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>Photo, optional</label>
          <input type="file" accept="image/*" onChange={(e) => onPhoto(e.target.files?.[0])} className="font-mono text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }} />
          {form.image && <VaultImg src={form.image} className="w-full h-36 object-cover rounded-sm" />}
          <button type="submit" disabled={busy} className="w-full py-3 rounded-sm font-mono text-xs uppercase tracking-wider" style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}>List this lot</button>
        </form>
      )}
    </div>
  );
}

function Thumb({ lot }: { lot: Listing }) {
  if (lot.image) return <VaultImg src={lot.image} className="w-20 h-20 rounded-sm object-cover shrink-0" />;
  return <div className="w-20 h-20 rounded-sm shrink-0 flex items-center justify-center border" style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--background))" }}><Tag size={16} style={{ color: "hsl(var(--primary))" }} /></div>;
}

function Field({ label, value, onChange, numeric }: { label: string; value: string; onChange: (value: string) => void; numeric?: boolean }) {
  return (
    <label className="block">
      <span className="block font-mono text-[10px] uppercase tracking-wider mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>{label}</span>
      <input value={value} inputMode={numeric ? "decimal" : "text"} onChange={(e) => onChange(e.target.value)} className="w-full rounded-sm px-3 py-2 font-mono text-sm border" style={{ background: "hsl(var(--input))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }} />
    </label>
  );
}
