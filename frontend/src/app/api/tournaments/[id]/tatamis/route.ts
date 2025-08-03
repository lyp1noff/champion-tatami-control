import { NextRequest, NextResponse } from "next/server";
import { bracketService } from "@/lib/database";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const tournamentId = parseInt(id);

    // Get all brackets for this tournament and extract unique tatami numbers
    const brackets = await bracketService.getByTournamentExternalId(tournamentId);

    const tatamis = [
      ...new Set(brackets.map((bracket: any) => bracket.tatami).filter((tatami: any) => tatami !== null)),
    ];

    return NextResponse.json({ tatamis });
  } catch (error) {
    console.error("Error fetching tatamis:", error);
    return NextResponse.json({ error: "Failed to fetch tatamis" }, { status: 500 });
  }
}
