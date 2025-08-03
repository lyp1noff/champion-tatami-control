import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const bracketId = parseInt(id);

    const matches = await apiClient.getBracketMatches(bracketId);

    return NextResponse.json(matches);
  } catch (error) {
    console.error("Error fetching matches:", error);
    return NextResponse.json({ error: "Failed to fetch matches" }, { status: 500 });
  }
}
