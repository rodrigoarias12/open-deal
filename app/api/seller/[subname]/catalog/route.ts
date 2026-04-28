/**
 * GET /api/seller/<subname>/catalog
 *
 * HTTPS mirror for a seller's catalog. Resolves the seller's
 * `procurement.catalog-uri` text record via ENS (Sepolia) and serves
 * the catalog content over HTTPS. Lets buyer agents that don't speak
 * `0g://` natively (e.g. the Python reference buyer at apps/buyer-py)
 * still consume the protocol end-to-end.
 *
 * Per PROTOCOL.md §2: this endpoint is OPTIONAL for sellers — the
 * canonical source of truth is the catalog-uri text record itself.
 * Hosted sellers onboarded via /sell get this for free; self-hosted
 * sellers may add their own equivalent or skip it.
 */

import { NextResponse } from "next/server";
import { JsonRpcProvider } from "ethers";
import { loadCatalogFromUri } from "../../../../../src/catalog/loader";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SEPOLIA_RPC =
  process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const PARENT = process.env.ENS_PARENT || "openagents-treasury.eth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ subname: string }> },
): Promise<NextResponse> {
  const { subname: rawSubname } = await params;
  const subname = rawSubname.includes(".")
    ? rawSubname
    : `${rawSubname}.${PARENT}`;

  let catalogUri: string | null = null;
  try {
    const provider = new JsonRpcProvider(SEPOLIA_RPC);
    const resolver = await provider.getResolver(subname);
    if (!resolver) {
      return NextResponse.json(
        { error: `${subname} has no ENS resolver` },
        { status: 404 },
      );
    }
    catalogUri = await resolver.getText("catalog-uri");
  } catch (e) {
    return NextResponse.json(
      { error: `ens resolution failed: ${(e as Error).message}` },
      { status: 502 },
    );
  }
  if (!catalogUri) {
    return NextResponse.json(
      { error: `${subname} has no 'catalog-uri' text record` },
      { status: 404 },
    );
  }

  try {
    const catalog = await loadCatalogFromUri(catalogUri);
    return NextResponse.json(catalog, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60",
        "X-Catalog-Source": catalogUri,
        "X-Seller-Ens": subname,
      },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: `failed to load catalog from ${catalogUri}: ${
          (e as Error).message
        }`,
      },
      { status: 502 },
    );
  }
}
