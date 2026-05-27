import { NextResponse } from "next/server";
import { getByBarcode } from "@/lib/food/providers/open-food-facts";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim();

  if (!code) {
    return NextResponse.json({ error: "Missing barcode" }, { status: 400 });
  }

  try {
    const product = await getByBarcode(code);
    if (!product) {
      return NextResponse.json({ product: null }, { status: 404 });
    }
    return NextResponse.json({ product });
  } catch {
    return NextResponse.json({ error: "Lookup failed" }, { status: 502 });
  }
}
