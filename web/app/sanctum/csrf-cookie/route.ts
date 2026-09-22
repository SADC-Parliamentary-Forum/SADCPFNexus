import { proxyLaravel } from "@/lib/apiProxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function handle(request: Request): Promise<Response> {
  return proxyLaravel(request);
}

export const GET = handle;
export const HEAD = handle;
export const OPTIONS = handle;
