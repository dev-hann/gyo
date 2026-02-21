import { WebSocketServer, WebSocket } from 'ws';
import { logger } from './logger.js';

export class HotReloadServer {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private port: number;

  constructor(port: number = 3001) {
    this.port = port;
  }

  start(): void {
    this.wss = new WebSocketServer({ port: this.port });

    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);
      logger.verbose(`Hot reload client connected (total: ${this.clients.size})`);

      ws.on('close', () => {
        this.clients.delete(ws);
        logger.verbose(`Hot reload client disconnected (remaining: ${this.clients.size})`);
      });

      ws.on('error', (error) => {
        logger.verbose(`WebSocket client error: ${error.message}`);
        this.clients.delete(ws);
      });
    });

    this.wss.on('error', (error) => {
      logger.error(`Hot reload server error: ${error.message}`);
    });

    logger.verbose(`Hot reload server started on ws://localhost:${this.port}`);
  }

  /**
   * Notify all connected clients to reload
   */
  notifyReload(): void {
    const message = JSON.stringify({ type: 'reload' });
    let sentCount = 0;

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        sentCount++;
      }
    });

    if (sentCount > 0) {
      logger.info(`📱 Hot reload triggered (${sentCount} client${sentCount > 1 ? 's' : ''})`);
    }
  }

  stop(): void {
    if (this.wss) {
      this.clients.forEach((client) => {
        client.close();
      });
      this.clients.clear();

      this.wss.close();
      this.wss = null;
      logger.verbose('Hot reload server stopped');
    }
  }

  isRunning(): boolean {
    return this.wss !== null;
  }

  getConnectedClients(): number {
    return this.clients.size;
  }
}
