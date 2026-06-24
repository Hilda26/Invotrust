const GENLAYER_RPC = "https://studio.genlayer.com/api";

export async function fetchGenBalance(address: string): Promise<string | null> {
  try {
    const res = await fetch(GENLAYER_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getBalance",
        params: [address, "latest"],
      }),
    });
    const json = (await res.json()) as { result?: string };
    if (!json.result) return "0";

    const wei = BigInt(json.result);
    const gen = Number(wei) / 1e18;
    return gen.toLocaleString(undefined, { maximumFractionDigits: 4 });
  } catch {
    return null;
  }
}
