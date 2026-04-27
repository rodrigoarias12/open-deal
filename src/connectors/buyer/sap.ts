import type { BuyerInventoryConnector, InventoryNeed } from "./types";

/**
 * SAP buyer-side connector — STUB for the demo, REAL contract for
 * production. Returns shape-correct data so a third-party developer can
 * see exactly what an SAP-backed implementation would emit, without
 * needing live credentials.
 *
 * To activate against a real SAP instance:
 *   - Set SAP_HOST + SAP_USER + SAP_PASSWORD + SAP_CLIENT in .env
 *   - Replace the body of `readNeeds()` with an RFC call to BAPI like
 *     `BAPI_MATERIAL_GET_DETAIL` or `MM_BPRD_TRG_PNT_GET` for low-stock
 *     materials, then map to InventoryNeed.
 *   - Or use the SAP OData Gateway (`/sap/opu/odata/sap/MM_INVENTORY_SRV`)
 *     and a fetch with X-CSRF-Token negotiation.
 *
 * The buyer agent doesn't care which transport — it consumes the same
 * `readNeeds()` shape.
 */

interface SapMaterial {
  matnr: string;     // material number = SKU
  maktx: string;     // material description
  labst: number;     // unrestricted stock
  meins: string;     // base unit of measure
  reorder_point?: number;
}

const STUB_MATERIALS: SapMaterial[] = [
  { matnr: "SAP-PAPEL-A4", maktx: "Papel A4 (resma)", labst: 3, meins: "EA", reorder_point: 8 },
  { matnr: "SAP-CART-30",  maktx: "Caja cartón 30x20", labst: 4, meins: "EA", reorder_point: 12 },
  { matnr: "SAP-TINTA-NX", maktx: "Cartucho tinta XL", labst: 1, meins: "EA", reorder_point: 5 },
];

export class SapBuyerConnector implements BuyerInventoryConnector {
  readonly id = "sap";
  readonly name: string;

  constructor(opts?: { host?: string; user?: string; client?: string }) {
    const host = opts?.host || process.env.SAP_HOST;
    this.name = host ? `SAP (${host})` : "SAP (stub — set SAP_HOST to enable)";
  }

  async healthCheck(): Promise<boolean> {
    if (!process.env.SAP_HOST) return false;
    // Production: ping the OData service root.
    return false;
  }

  async readNeeds(): Promise<InventoryNeed[]> {
    if (!process.env.SAP_HOST) {
      // Stub mode — return shape-correct data with a marker so the audit
      // log makes it obvious this came from a stub, not a live SAP.
      return STUB_MATERIALS.map((m) => ({
        sku: m.matnr,
        name: m.maktx,
        quantity: Math.max((m.reorder_point ?? 5) * 2 - m.labst, m.reorder_point ?? 5),
        current_stock: m.labst,
        max_unit_price_usd: 80,
        deadline_days: 7,
        reason: `[STUB] auto: SAP MARA/MARC (matnr=${m.matnr}) labst=${m.labst} below reorder_point ${m.reorder_point} — connect SAP_HOST to enable live RFC`,
        source: this.id,
      }));
    }

    // Production wiring lives here.
    throw new Error(
      "live SAP connector not yet implemented — see source for the contract; PRs welcome",
    );
  }
}
