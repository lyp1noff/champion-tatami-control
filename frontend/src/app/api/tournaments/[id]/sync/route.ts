import { NextRequest, NextResponse } from "next/server";
import { SyncService } from "@/lib/sync-service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const tournamentId = parseInt(id);

    const syncService = new SyncService();
    await syncService.syncTournament(tournamentId);
    return NextResponse.json({ message: "Tournament synced successfully" });
  } catch (error) {
    console.error("Error syncing tournament:", error);
    return NextResponse.json({ error: "Failed to sync tournament" }, { status: 500 });
  }
}
