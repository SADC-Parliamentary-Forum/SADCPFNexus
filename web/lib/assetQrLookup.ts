import { assetQrApi, publicAssetQrApi } from "@/lib/api";
import { parseAssetQrToken } from "@/lib/assetQrToken";

export type AssetScanAction = { key: string; label: string; label_key?: string; href: string };

export type AssetScanHit =
  | {
      kind: "register";
      id: number;
      tag: string;
      name: string;
      status?: string | null;
      location?: string | null;
      custodian?: string | null;
      condition?: string | null;
      actions: AssetScanAction[];
    }
  | {
      kind: "public";
      tag: string;
      name: string;
      notice: string;
    };

export type AssetScanResult =
  | { ok: true; token: string; hit: AssetScanHit }
  | { ok: false; reason: "invalid" | "not_found" };

export async function lookupAssetFromQrRaw(raw: string): Promise<AssetScanResult> {
  const token = parseAssetQrToken(raw);
  if (!token) {
    return { ok: false, reason: "invalid" };
  }

  try {
    const auth = await assetQrApi.lookup(token);
    const data = auth.data.data;
    const id = data?.id;
    if (id) {
      return {
        ok: true,
        token,
        hit: {
          kind: "register",
          id,
          tag: data.asset_tag || token,
          name: data.name,
          status: data.status,
          location: data.location?.name ?? null,
          custodian: data.custodian?.name ?? null,
          condition: data.condition,
          actions: data.allowed_actions ?? [],
        },
      };
    }
  } catch {
    // Staff lookup failed — try the public payload (no serial, custodian, or finance).
  }

  try {
    const pub = await publicAssetQrApi.show(token);
    return {
      ok: true,
      token,
      hit: {
        kind: "public",
        tag: pub.data.data.asset_tag || pub.data.data.assetNumber || token,
        name: pub.data.data.asset_name,
        notice: pub.data.data.notice,
      },
    };
  } catch {
    return { ok: false, reason: "not_found" };
  }
}
