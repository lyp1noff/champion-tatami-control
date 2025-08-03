import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: matchId } = await params;
    const body = await request.json();

    const match = await apiClient.updateMatchScores(matchId, {
      score_athlete1: body.score_athlete1,
      score_athlete2: body.score_athlete2,
    });

    return NextResponse.json(match);
  } catch (error) {
    console.error("Error updating match scores:", error);
    return NextResponse.json({ error: "Failed to update match scores" }, { status: 500 });
  }
}
