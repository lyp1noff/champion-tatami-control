import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: matchId } = await params;
    const body = await request.json();

    const match = await apiClient.finishMatch(matchId, {
      score_athlete1: body.score_athlete1,
      score_athlete2: body.score_athlete2,
      winner_id: body.winner_id,
    });

    return NextResponse.json(match);
  } catch (error) {
    console.error("Error finishing match:", error);
    return NextResponse.json({ error: "Failed to finish match" }, { status: 500 });
  }
}
