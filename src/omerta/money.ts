import { useEffect, useState } from "react";
import { formatBtc, spotUsd } from "@omerta/chain";

export function useUsdPrice() {
  const [price, setPrice] = useState(0);
  useEffect(() => {
    let dead = false;
    const load = () => {
      spotUsd().then((next) => {
        if (!dead && next > 0) setPrice(next);
      }).catch(() => {});
    };
    load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      dead = true;
      window.clearInterval(timer);
    };
  }, []);
  return price;
}

export function formatPair(btc: number, price: number) {
  const coins = formatBtc(btc);
  if (!(price > 0) || !Number.isFinite(Number(btc))) return coins;
  const dollars = (Number(btc) * price).toLocaleString("en-US", { style: "currency", currency: "USD" });
  return coins + " · " + dollars;
}
