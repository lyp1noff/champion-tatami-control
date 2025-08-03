import { outboxService } from "./database";
import { apiClient } from "./api";

class OutboxProcessor {
  private isRunning = false;
  private interval: NodeJS.Timeout | null = null;

  async start() {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log("Outbox processor started");

    // Process immediately
    await this.processPendingItems();

    // Then process every 5 seconds
    this.interval = setInterval(async () => {
      await this.processPendingItems();
    }, 5000);
  }

  async stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    console.log("Outbox processor stopped");
  }

  private async processPendingItems() {
    try {
      const pendingItems = await outboxService.getPendingItems();

      for (const item of pendingItems) {
        await this.processItem(item);
      }
    } catch (error) {
      console.error("Error processing outbox items:", error);
    }
  }

  private async processItem(item: any) {
    try {
      console.log(`Processing outbox item ${item.id}: ${item.method} ${item.endpoint}`);

      let response;
      const options: any = {
        method: item.method,
      };

      if (item.payload) {
        options.body = item.payload;
        options.headers = {
          "Content-Type": "application/json",
        };
      }

      // Make the request to external API
      response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${item.endpoint}`, options);

      if (response.ok) {
        await outboxService.markAsDelivered(item.id);
        console.log(`Outbox item ${item.id} delivered successfully`);
      } else {
        const errorText = await response.text();
        await outboxService.markAsFailed(item.id, `HTTP ${response.status}: ${errorText}`);
        console.log(`Outbox item ${item.id} failed: HTTP ${response.status}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await outboxService.markAsFailed(item.id, errorMessage);
      console.log(`Outbox item ${item.id} failed: ${errorMessage}`);
    }
  }

  async processNow() {
    await this.processPendingItems();
  }
}

// Create singleton instance
export const outboxProcessor = new OutboxProcessor();

// Start processor when module is loaded (in development)
if (process.env.NODE_ENV === "development") {
  // Small delay to ensure database is ready
  setTimeout(() => {
    outboxProcessor.start();
  }, 1000);
}
