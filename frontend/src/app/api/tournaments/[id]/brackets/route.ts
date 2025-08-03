import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const tournamentId = parseInt(id);

    const brackets = await apiClient.getBrackets(tournamentId);

    return NextResponse.json(brackets);
  } catch (error) {
    console.error("Error fetching brackets:", error);
    return NextResponse.json({ error: "Failed to fetch brackets" }, { status: 500 });
  }
}
