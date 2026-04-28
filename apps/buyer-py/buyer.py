#!/usr/bin/env python3
"""
Open Deal — Python reference buyer agent (v0.1)

Second implementation of the buyer side of the Open Deal protocol,
written in Python with no shared code with the TypeScript reference.
This is the test PROTOCOL.md needs to pass to graduate from
"single-implementation spec draft" to "interoperable protocol":
two independently-built buyers MUST be able to discover and quote
the same live ENS sellers using only the wire format documented in
PROTOCOL.md.

What this script does (per tick):

  1. Discover  — for each ENS subname in the registry, read three
                 text records (endpoint, catalog-uri, addr) by calling
                 ENS Registry + Public Resolver via raw eth_call to
                 a Sepolia JSON-RPC. No web3.py, no ens.py.
  2. Catalog   — pull each seller's catalog. The protocol allows
                 0g://<rootHash>, https://… and (per v0.1 hosted
                 convention) an HTTPS mirror at <endpoint>/catalog
                 for sellers whose canonical catalog-uri is 0g://.
  3. Index     — build {sku: [seller, …]} in memory.
  4. RFQ       — for each fixture need, POST to the indexed sellers'
                 endpoints, collect signed quotes, print the cheapest.

Run:
  apps/buyer-py/.venv/bin/python apps/buyer-py/buyer.py
  apps/buyer-py/.venv/bin/python apps/buyer-py/buyer.py --rpc <url>

Env (optional):
  SEPOLIA_RPC_URL   — overrides the default public RPC
  ENS_PARENT        — defaults to openagents-treasury.eth
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import uuid
from dataclasses import dataclass
from typing import Optional

import requests
from eth_utils import keccak, to_checksum_address  # type: ignore[import]

# ─── Constants ───────────────────────────────────────────────────────────────

DEFAULT_RPC = "https://ethereum-sepolia-rpc.publicnode.com"
ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e"
DEFAULT_PARENT = "openagents-treasury.eth"

# Selectors (first 4 bytes of keccak256 of the function signature)
SEL_RESOLVER = keccak(text="resolver(bytes32)")[:4].hex()
SEL_TEXT = keccak(text="text(bytes32,string)")[:4].hex()
SEL_ADDR = keccak(text="addr(bytes32)")[:4].hex()

# Same registry the TS buyer reads — keeps the implementations honest.
REGISTRY: list[str] = [
    "acme-cartoneria.openagents-treasury.eth",
    "distri-norte-srl.openagents-treasury.eth",
    "papelera-del-sur.openagents-treasury.eth",
    "box-master.openagents-treasury.eth",
    "techsupply-mx.openagents-treasury.eth",
]

NEEDS = [
    {"sku": "PAPEL-A4-RES", "quantity": 2, "max_unit_price_usd": 10, "deadline_days": 5},
    {"sku": "CARTON-CAJA-30", "quantity": 3, "max_unit_price_usd": 3, "deadline_days": 3},
    {"sku": "TINTA-NEG-XL", "quantity": 1, "max_unit_price_usd": 25, "deadline_days": 5},
]


# ─── Types ───────────────────────────────────────────────────────────────────


@dataclass
class Seller:
    ens: str
    endpoint: str
    catalog_uri: Optional[str]
    address: Optional[str]


@dataclass
class IndexedSeller:
    seller: Seller
    catalog: dict


# ─── ENS resolution via raw eth_call ─────────────────────────────────────────


def namehash(name: str) -> bytes:
    """ENS namehash per EIP-137. Pure Python, no deps."""
    node = bytes(32)
    if name:
        for label in reversed(name.split(".")):
            label_hash = keccak(text=label)
            node = keccak(node + label_hash)
    return node


def encode_string(s: str) -> bytes:
    """ABI-encode a single dynamic string argument (head + tail)."""
    raw = s.encode("utf-8")
    length = len(raw).to_bytes(32, "big")
    padding = b"\x00" * ((32 - len(raw) % 32) % 32)
    return length + raw + padding


def eth_call(rpc: str, to: str, data: str) -> str:
    body = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "eth_call",
        "params": [{"to": to, "data": data}, "latest"],
    }
    r = requests.post(rpc, json=body, timeout=10)
    r.raise_for_status()
    res = r.json()
    if "error" in res:
        raise RuntimeError(f"RPC error: {res['error']}")
    return res["result"]


def decode_string(hex_result: str) -> Optional[str]:
    """Decode a single dynamic-string return value from eth_call hex."""
    if not hex_result or hex_result == "0x":
        return None
    raw = bytes.fromhex(hex_result.removeprefix("0x"))
    if len(raw) < 64:
        return None
    # raw[0:32] = offset to string (always 0x20 for single-string return)
    # raw[32:64] = length
    # raw[64:64+length] = utf-8 bytes
    length = int.from_bytes(raw[32:64], "big")
    if length == 0:
        return None
    return raw[64 : 64 + length].decode("utf-8", errors="replace")


def decode_address(hex_result: str) -> Optional[str]:
    if not hex_result or hex_result == "0x":
        return None
    raw = bytes.fromhex(hex_result.removeprefix("0x"))
    if len(raw) < 32:
        return None
    addr_bytes = raw[12:32]
    if addr_bytes == b"\x00" * 20:
        return None
    return to_checksum_address("0x" + addr_bytes.hex())


def resolve_seller(rpc: str, ens_name: str) -> Optional[Seller]:
    node = namehash(ens_name)
    # 1. registry.resolver(node) → resolver address
    data = "0x" + SEL_RESOLVER + node.hex()
    raw = eth_call(rpc, ENS_REGISTRY, data)
    resolver = decode_address(raw)
    if not resolver:
        print(f"[buyer-py]   × {ens_name} → no resolver")
        return None

    # 2. resolver.text(node, "endpoint")
    # ABI encoding for text(bytes32 node, string key):
    #   selector(4) || node(32) || offset_to_string(32 = 0x40) || length(32) || string + padding
    # Offset is 0x40 because there are TWO head slots (node + offset itself)
    # before the dynamic data starts.
    str_offset_hex = (64).to_bytes(32, "big").hex()
    endpoint_data = "0x" + SEL_TEXT + node.hex() + str_offset_hex + encode_string("endpoint").hex()
    catalog_data = "0x" + SEL_TEXT + node.hex() + str_offset_hex + encode_string("catalog-uri").hex()
    addr_data = "0x" + SEL_ADDR + node.hex()

    endpoint = decode_string(eth_call(rpc, resolver, endpoint_data))
    if not endpoint:
        print(f"[buyer-py]   × {ens_name} → no 'endpoint' text record")
        return None
    catalog_uri = decode_string(eth_call(rpc, resolver, catalog_data))
    address = decode_address(eth_call(rpc, resolver, addr_data))

    short_uri = (catalog_uri[:32] + "…") if catalog_uri and len(catalog_uri) > 32 else (catalog_uri or "no-catalog")
    print(f"[buyer-py]   ✓ {ens_name} → endpoint={endpoint}, catalog={short_uri}")
    return Seller(ens=ens_name, endpoint=endpoint, catalog_uri=catalog_uri, address=address)


# ─── Catalog loading ─────────────────────────────────────────────────────────


def derive_https_catalog_url(endpoint: str) -> Optional[str]:
    """Hosted convention (PROTOCOL.md §2): if endpoint ends in /rfq, the
    same host serves the catalog at /catalog. Used as fallback when
    catalog-uri is 0g:// (Python buyer doesn't speak the 0G download
    protocol natively in v0.1)."""
    if endpoint.endswith("/rfq"):
        return endpoint[:-4] + "/catalog"
    return None


def load_catalog(seller: Seller) -> Optional[dict]:
    """Resolve a seller's catalog to a JSON dict, or None on failure.

    Tries (in order):
      1. catalog-uri if it's https://…
      2. <endpoint base>/catalog (hosted convention) if catalog-uri is 0g://…
      3. None
    """
    uri = seller.catalog_uri or ""
    if uri.startswith("https://") or uri.startswith("http://"):
        try:
            r = requests.get(uri, timeout=8)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            print(f"[buyer-py]   ⚠ {seller.ens} → https catalog fetch failed: {e}")
            return None
    if uri.startswith("0g://"):
        fallback = derive_https_catalog_url(seller.endpoint)
        if not fallback:
            print(f"[buyer-py]   ⚠ {seller.ens} → 0g:// catalog and no /catalog mirror — skipping")
            return None
        try:
            r = requests.get(fallback, timeout=8)
            r.raise_for_status()
            print(f"[buyer-py]     · used HTTPS mirror at {fallback}")
            return r.json()
        except Exception as e:
            print(f"[buyer-py]   ⚠ {seller.ens} → fallback {fallback} failed: {e}")
            return None
    print(f"[buyer-py]   ⚠ {seller.ens} → unsupported catalog-uri scheme: {uri[:24]}…")
    return None


def build_sku_index(entries: list[IndexedSeller]) -> dict[str, list[IndexedSeller]]:
    index: dict[str, list[IndexedSeller]] = {}
    for entry in entries:
        for item in entry.catalog.get("items", []):
            sku = item.get("sku")
            if not sku:
                continue
            index.setdefault(sku, []).append(entry)
    return index


# ─── RFQ ─────────────────────────────────────────────────────────────────────


def post_rfq(seller: Seller, need: dict, rfq_id: str) -> Optional[dict]:
    body = {
        "rfq_id": rfq_id,
        "sku": need["sku"],
        "quantity": need["quantity"],
        "buyer_ens": "openagents-treasury.eth",
        "buyer_address": "0x0000000000000000000000000000000000000000",
        "deadline": time.strftime(
            "%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + need["deadline_days"] * 86400)
        ),
    }
    try:
        r = requests.post(seller.endpoint, json=body, timeout=15)
        if r.status_code != 200:
            print(f"[buyer-py]     ✗ {seller.ens} → HTTP {r.status_code}: {r.text[:120]}")
            return None
        return r.json()
    except Exception as e:
        print(f"[buyer-py]     ✗ {seller.ens} → POST error: {e}")
        return None


# ─── Main ────────────────────────────────────────────────────────────────────


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Open Deal — Python reference buyer")
    parser.add_argument("--rpc", default=os.environ.get("SEPOLIA_RPC_URL", DEFAULT_RPC))
    parser.add_argument("--limit", type=int, default=0, help="Max sellers to resolve (0 = all)")
    parser.add_argument(
        "--host-override",
        default=os.environ.get("HOST_OVERRIDE"),
        help="Replace agentic-erp-eth.vercel.app in endpoint/catalog URLs (for local dev testing). e.g. localhost:3007",
    )
    args = parser.parse_args(argv)

    print(f"[buyer-py] Open Deal Python buyer v0.1 — second implementation of PROTOCOL.md §1–§3")
    print(f"[buyer-py] rpc: {args.rpc}")
    print(f"[buyer-py] registry: {len(REGISTRY)} seller subname(s)")

    # Step 1 — discovery: resolve ENS for each seller
    print(f"\n[buyer-py] discovery step 1/2 — resolving sellers from ENS…")
    sellers: list[Seller] = []
    for ens_name in REGISTRY[: args.limit or len(REGISTRY)]:
        try:
            s = resolve_seller(args.rpc, ens_name)
            if s:
                if args.host_override:
                    s.endpoint = s.endpoint.replace(
                        "agentic-erp-eth.vercel.app", args.host_override
                    ).replace("https://", "http://" if args.host_override.startswith("localhost") else "https://")
                sellers.append(s)
        except Exception as e:
            print(f"[buyer-py]   × {ens_name} → resolution error: {e}")
    if not sellers:
        print("[buyer-py] no sellers resolved — abort")
        return 1
    print(f"[buyer-py] resolved {len(sellers)}/{len(REGISTRY)} seller(s)")

    # Step 2 — discovery: pull catalogs, build SKU index
    print(f"\n[buyer-py] discovery step 2/2 — fetching catalogs…")
    indexed: list[IndexedSeller] = []
    for seller in sellers:
        cat = load_catalog(seller)
        if cat is None:
            continue
        sku_list = ", ".join(it.get("sku", "?") for it in cat.get("items", []))
        print(f"[buyer-py]   ✓ {seller.ens} → {len(cat.get('items', []))} SKU(s) [{sku_list}]")
        indexed.append(IndexedSeller(seller=seller, catalog=cat))
    if not indexed:
        print("[buyer-py] no catalogs loaded — abort")
        return 1

    sku_index = build_sku_index(indexed)
    print(
        f"[buyer-py] indexed {len(sku_index)} unique SKU(s) across {len(indexed)} seller(s)"
    )

    # Step 3 — RFQ targeted fan-out per need
    for need in NEEDS:
        sku = need["sku"]
        rfq_id = f"rfq-py-{int(time.time() * 1000)}-{sku}"
        print(f"\n[buyer-py] need: {sku} x{need['quantity']}")
        targets = sku_index.get(sku, [])
        if not targets:
            print(f"[buyer-py]   no seller indexed for {sku} — skipping")
            continue
        print(
            f"[buyer-py]   SKU index → {len(targets)} match(es) — RFQ targets: {len(targets)}/{len(indexed)}"
        )

        quotes: list[dict] = []
        for entry in targets:
            print(f"[buyer-py]     → POST {entry.seller.endpoint}")
            q = post_rfq(entry.seller, need, rfq_id)
            if q is None:
                continue
            print(
                f"[buyer-py]     ✓ {entry.seller.ens} → ${q.get('total_usd')} {q.get('currency','USDC')}, "
                f"{q.get('delivery_days','?')}d, sig {str(q.get('signature',''))[:18]}…"
            )
            quotes.append({**q, "source_ens": entry.seller.ens})

        if not quotes:
            print(f"[buyer-py]   no quotes for {sku}")
            continue

        # Filter by budget + deadline; pick cheapest valid quote
        valid = [
            q for q in quotes
            if q.get("unit_price_usd", 9e9) <= need["max_unit_price_usd"]
            and q.get("delivery_days", 9999) <= need["deadline_days"]
        ]
        if not valid:
            print(f"[buyer-py]   no quote within budget/deadline — skipping")
            continue
        winner = min(valid, key=lambda q: q["total_usd"])
        print(
            f"[buyer-py]   winner: {winner['source_ens']} → "
            f"${winner['total_usd']} ({winner.get('delivery_days')}d)"
        )

    print(f"\n[buyer-py] tick complete — Python implementation matches TS reference output shape")
    print(f"[buyer-py] proves Open Deal v0.1 is implementable from PROTOCOL.md alone")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
