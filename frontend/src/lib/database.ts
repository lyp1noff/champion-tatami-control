import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Tournament
export const tournamentService = {
  async createOrUpdate(data: {
    externalId: number;
    name: string;
    location: string;
    startDate?: Date;
    endDate?: Date;
    status: string; // Made required to match schema
  }) {
    return prisma.tournament.upsert({
      where: { externalId: data.externalId },
      update: data,
      create: data,
    });
  },

  async getAll() {
    return prisma.tournament.findMany({
      include: {
        brackets: {
          include: {
            matches: {
              include: {
                match: {
                  include: {
                    athlete1: true,
                    athlete2: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  },

  async getByExternalId(externalId: number) {
    return prisma.tournament.findUnique({
      where: { externalId },
      include: {
        brackets: {
          include: {
            matches: {
              include: {
                match: {
                  include: {
                    athlete1: true,
                    athlete2: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  },
};

// Bracket
export const bracketService = {
  async createOrUpdate(data: {
    externalId: number;
    tournamentExternalId: number; // Changed to use external ID
    category: string;
    type: string;
    tatami?: number;
    groupId?: number;
    startTime?: string;
    status: string;
    displayName: string;
  }) {
    // First get the tournament by external ID to get internal ID
    const tournament = await prisma.tournament.findUnique({
      where: { externalId: data.tournamentExternalId },
    });

    if (!tournament) {
      throw new Error(`Tournament with external ID ${data.tournamentExternalId} not found`);
    }

    const { tournamentExternalId, ...bracketData } = data;

    return prisma.bracket.upsert({
      where: { externalId: data.externalId },
      update: { ...bracketData, tournamentId: tournament.id },
      create: { ...bracketData, tournamentId: tournament.id },
    });
  },

  async getByTatami(tatami: number) {
    return prisma.bracket.findMany({
      where: { tatami },
      include: {
        tournament: true,
        matches: {
          include: {
            match: {
              include: {
                athlete1: true,
                athlete2: true,
              },
            },
          },
        },
      },
    });
  },

  async getByTournamentExternalId(tournamentExternalId: number) {
    const tournament = await prisma.tournament.findUnique({
      where: { externalId: tournamentExternalId },
    });

    if (!tournament) {
      throw new Error(`Tournament with external ID ${tournamentExternalId} not found`);
    }

    return prisma.bracket.findMany({
      where: { tournamentId: tournament.id },
      include: {
        matches: {
          include: {
            match: {
              include: {
                athlete1: true,
                athlete2: true,
              },
            },
          },
        },
      },
    });
  },
};

// Athlete
export const athleteService = {
  async createOrUpdate(data: { externalId: number; firstName: string; lastName: string; coachesLastName: string }) {
    return prisma.athlete.upsert({
      where: { externalId: data.externalId },
      update: data,
      create: data,
    });
  },

  async getByExternalId(externalId: number) {
    return prisma.athlete.findUnique({
      where: { externalId },
    });
  },
};

// Match
export const matchService = {
  async createOrUpdate(data: {
    externalId: string;
    athlete1ExternalId?: number; // Changed to use external IDs
    athlete2ExternalId?: number;
    winnerExternalId?: number;
    scoreAthlete1?: number;
    scoreAthlete2?: number;
    status: string;
    startedAt?: Date | null;
    endedAt?: Date | null;
  }) {
    const { externalId, athlete1ExternalId, athlete2ExternalId, winnerExternalId, ...matchData } = data;

    // Get athlete IDs from external IDs
    let athlete1Id: number | undefined;
    let athlete2Id: number | undefined;
    let winnerId: number | undefined;

    if (athlete1ExternalId) {
      const athlete1 = await prisma.athlete.findUnique({ where: { externalId: athlete1ExternalId } });
      athlete1Id = athlete1?.id;
    }

    if (athlete2ExternalId) {
      const athlete2 = await prisma.athlete.findUnique({ where: { externalId: athlete2ExternalId } });
      athlete2Id = athlete2?.id;
    }

    if (winnerExternalId) {
      const winner = await prisma.athlete.findUnique({ where: { externalId: winnerExternalId } });
      winnerId = winner?.id;
    }

    return prisma.match.upsert({
      where: { externalId },
      update: { ...matchData, athlete1Id, athlete2Id, winnerId },
      create: { externalId, ...matchData, athlete1Id, athlete2Id, winnerId },
    });
  },

  async getByExternalId(externalId: string) {
    return prisma.match.findUnique({
      where: { externalId },
      include: {
        athlete1: true,
        athlete2: true,
        matchState: true, // Fixed: was matchStates
      },
    });
  },

  async updateScores(externalId: string, score1: number, score2: number) {
    return prisma.match.update({
      where: { externalId },
      data: {
        scoreAthlete1: score1,
        scoreAthlete2: score2,
      },
    });
  },

  async updateStatus(externalId: string, status: string, winnerExternalId?: number) {
    let winnerId: number | undefined;

    if (winnerExternalId) {
      const winner = await prisma.athlete.findUnique({ where: { externalId: winnerExternalId } });
      winnerId = winner?.id;
    }

    return prisma.match.update({
      where: { externalId },
      data: { status, winnerId },
    });
  },
};

// BracketMatch
export const bracketMatchService = {
  async createOrUpdate(data: {
    externalId: string;
    bracketExternalId: number; // Changed to use external ID
    matchExternalId: string; // Changed to use external ID
    roundNumber: number;
    position: number;
    nextSlot?: number | null;
  }) {
    const { externalId, bracketExternalId, matchExternalId, ...bracketMatchData } = data;

    // Get bracket and match IDs from external IDs
    const bracket = await prisma.bracket.findUnique({ where: { externalId: bracketExternalId } });
    const match = await prisma.match.findUnique({ where: { externalId: matchExternalId } });

    if (!bracket) {
      throw new Error(`Bracket with external ID ${bracketExternalId} not found`);
    }

    if (!match) {
      throw new Error(`Match with external ID ${matchExternalId} not found`);
    }

    return prisma.bracketMatch.upsert({
      where: { externalId },
      update: { ...bracketMatchData, bracketId: bracket.id, matchId: match.id },
      create: { externalId, ...bracketMatchData, bracketId: bracket.id, matchId: match.id },
    });
  },

  async getValidMatches(bracketExternalId: number) {
    const bracket = await prisma.bracket.findUnique({ where: { externalId: bracketExternalId } });

    if (!bracket) {
      throw new Error(`Bracket with external ID ${bracketExternalId} not found`);
    }

    return prisma.bracketMatch.findMany({
      where: {
        bracketId: bracket.id,
        match: {
          athlete1Id: { not: null },
          athlete2Id: { not: null },
        },
      },
      include: {
        match: {
          include: {
            athlete1: true,
            athlete2: true,
          },
        },
      },
    });
  },
};

// MatchState
export const matchStateService = {
  async getOrCreate(matchExternalId: string) {
    const match = await prisma.match.findUnique({ where: { externalId: matchExternalId } });

    if (!match) {
      throw new Error(`Match with external ID ${matchExternalId} not found`);
    }

    const existing = await prisma.matchState.findUnique({
      where: { matchId: match.id },
    });

    if (existing) {
      return existing;
    }

    return prisma.matchState.create({
      data: {
        matchId: match.id,
        status: "idle",
        pausedElapsed: 0,
        elapsed: 0,
        durationMs: 60000,
        score1: 0,
        score2: 0,
        shido1: 0,
        shido2: 0,
      },
    });
  },

  async update(
    matchExternalId: string,
    data: Partial<{
      status: string;
      startTimestamp: Date | null;
      pausedElapsed: number;
      elapsed: number;
      durationMs: number;
      score1: number;
      score2: number;
      shido1: number;
      shido2: number;
    }>
  ) {
    const match = await prisma.match.findUnique({ where: { externalId: matchExternalId } });

    if (!match) {
      throw new Error(`Match with external ID ${matchExternalId} not found`);
    }

    return prisma.matchState.update({
      where: { matchId: match.id },
      data,
    });
  },
};

// Outbox
export const outboxService = {
  async addItem(data: {
    tournamentExternalId?: number; // Changed to use external ID
    matchExternalId?: string; // Changed to use external ID
    endpoint: string;
    method: string;
    payload?: string;
  }) {
    const { tournamentExternalId, matchExternalId, ...outboxData } = data;

    let tournamentId: number | undefined;
    let matchId: number | undefined;

    if (tournamentExternalId) {
      const tournament = await prisma.tournament.findUnique({ where: { externalId: tournamentExternalId } });
      tournamentId = tournament?.id;
    }

    if (matchExternalId) {
      const match = await prisma.match.findUnique({ where: { externalId: matchExternalId } });
      matchId = match?.id;
    }

    return prisma.outboxItem.create({
      data: {
        ...outboxData,
        tournamentId,
        matchId,
        status: "pending",
        retryCount: 0,
        maxRetries: 10,
      },
    });
  },

  async getPendingItems() {
    return prisma.outboxItem.findMany({
      where: {
        status: "pending",
        retryCount: { lt: 10 },
      },
      orderBy: { createdAt: "asc" },
      include: {
        tournament: true,
        match: true,
      },
    });
  },

  async markAsDelivered(id: number) {
    return prisma.outboxItem.update({
      where: { id },
      data: { status: "delivered" },
    });
  },

  async markAsFailed(id: number, error: string) {
    return prisma.outboxItem.update({
      where: { id },
      data: {
        status: "failed",
        error,
        retryCount: { increment: 1 },
      },
    });
  },

  async getOutboxStatus() {
    const [pending, delivered, failed] = await Promise.all([
      prisma.outboxItem.count({ where: { status: "pending" } }),
      prisma.outboxItem.count({ where: { status: "delivered" } }),
      prisma.outboxItem.count({ where: { status: "failed" } }),
    ]);

    return { pending, delivered, failed };
  },
};
