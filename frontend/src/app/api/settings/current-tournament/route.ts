import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { apiClient } from "@/lib/api";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const setting = await prisma.globalSettings.findUnique({
      where: { key: "current_tournament" },
    });

    return NextResponse.json({
      currentTournament: setting?.value || null,
    });
  } catch (error) {
    console.error("Error fetching current tournament:", error);
    return NextResponse.json({ error: "Failed to fetch current tournament" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { tournamentId } = await request.json();

    if (!tournamentId) {
      return NextResponse.json({ error: "Tournament ID is required" }, { status: 400 });
    }

    // Verify the tournament exists using the external API
    try {
      await apiClient.getTournament(parseInt(tournamentId));
    } catch (error) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }

    // Upsert the setting
    const setting = await prisma.globalSettings.upsert({
      where: { key: "current_tournament" },
      update: { value: tournamentId },
      create: { key: "current_tournament", value: tournamentId },
    });

    return NextResponse.json({
      currentTournament: setting.value,
    });
  } catch (error) {
    console.error("Error setting current tournament:", error);
    return NextResponse.json({ error: "Failed to set current tournament" }, { status: 500 });
  }
}
