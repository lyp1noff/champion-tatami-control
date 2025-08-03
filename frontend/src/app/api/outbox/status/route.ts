import { NextResponse } from "next/server";
import { outboxService } from "@/lib/database";

export async function GET() {
  try {
    const status = await outboxService.getOutboxStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error("Error fetching outbox status:", error);
    return NextResponse.json({ error: "Failed to fetch outbox status" }, { status: 500 });
  }
}
