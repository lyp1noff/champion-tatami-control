import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: matchId } = await params;

    const match = await apiClient.startMatch(matchId);

    return NextResponse.json(match);
  } catch (error) {
    console.error("Error starting match:", error);
    return NextResponse.json({ error: "Failed to start match" }, { status: 500 });
  }
}
