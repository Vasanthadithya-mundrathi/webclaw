// Claw Mesh — Zero-server, zero-config peer agent discovery using BroadcastChannel.
// Every open WebClaw tab is a named peer. They discover each other and can delegate tasks.

export interface ClawPeer {
  id: string;
  name: string;
  capabilities: string[];
  lastSeen: number;
}

export interface MeshMessage {
  type: 'ANNOUNCE' | 'DISCOVER' | 'DELEGATE' | 'RESULT' | 'HEARTBEAT' | 'GOODBYE';
  from: string;
  fromName: string;
  to?: string; // target peer ID, undefined = broadcast
  payload?: unknown;
  requestId?: string;
}

type DelegateResolver = (result: string) => void;

const CHANNEL_NAME = 'webclaw-mesh';
const HEARTBEAT_INTERVAL_MS = 5000;
const PEER_EXPIRY_MS = 15000;

class ClawMesh {
  private channel: BroadcastChannel;
  private peers: Map<string, ClawPeer> = new Map();
  private pendingRequests: Map<string, DelegateResolver> = new Map();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private onPeersChanged?: (peers: ClawPeer[]) => void;
  private onDelegationReceived?: (fromName: string, task: string, requestId: string) => Promise<string>;

  public readonly id: string;
  public name: string;

  constructor() {
    this.id = `webclaw-${crypto.randomUUID().slice(0, 8)}`;
    this.name = 'Unnamed Agent';
    this.channel = new BroadcastChannel(CHANNEL_NAME);
    this.channel.onmessage = (evt) => this.handleMessage(evt.data as MeshMessage);
  }

  start(name: string) {
    this.name = name;
    this.announce();
    // Discover existing peers
    this.broadcast({ type: 'DISCOVER' });
    // Periodic heartbeat
    this.heartbeatTimer = setInterval(() => {
      this.broadcast({ type: 'HEARTBEAT' });
      // Evict stale peers
      const now = Date.now();
      for (const [id, peer] of this.peers) {
        if (now - peer.lastSeen > PEER_EXPIRY_MS) {
          this.peers.delete(id);
          this.onPeersChanged?.(this.getPeers());
        }
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  stop() {
    this.broadcast({ type: 'GOODBYE' });
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.channel.close();
  }

  setName(name: string) {
    this.name = name;
    this.announce();
  }

  getPeers(): ClawPeer[] {
    return Array.from(this.peers.values());
  }

  onPeerListChanged(cb: (peers: ClawPeer[]) => void) {
    this.onPeersChanged = cb;
  }

  onDelegation(cb: (fromName: string, task: string, requestId: string) => Promise<string>) {
    this.onDelegationReceived = cb;
  }

  /** Ask a specific peer to handle a task. Returns a promise that resolves when the peer responds. */
  async delegate(toPeerId: string, task: string): Promise<string> {
    return new Promise((resolve) => {
      const requestId = crypto.randomUUID();
      this.pendingRequests.set(requestId, resolve);
      const toPeer = this.peers.get(toPeerId);
      this.send({
        type: 'DELEGATE',
        to: toPeerId,
        payload: { task },
        requestId,
      });
      // Timeout after 120s
      setTimeout(() => {
        const resolver = this.pendingRequests.get(requestId);
        if (resolver) {
          this.pendingRequests.delete(requestId);
          resolver(`[MESH] Request timed out after 120s. Peer "${toPeer?.name ?? toPeerId}" did not respond.`);
        }
      }, 120_000);
    });
  }

  /** Send result back to the delegating peer */
  sendResult(toPeerId: string, requestId: string, result: string) {
    this.channel.postMessage({
      type: 'RESULT',
      from: this.id,
      fromName: this.name,
      to: toPeerId,
      payload: { result },
      requestId,
    } satisfies MeshMessage);
  }

  private announce() {
    this.broadcast({
      type: 'ANNOUNCE',
      payload: { capabilities: ['chat', 'tools', 'webgpu', 'cgep'] },
    });
  }

  private broadcast(partial: Omit<MeshMessage, 'from' | 'fromName'>) {
    this.channel.postMessage({ ...partial, from: this.id, fromName: this.name } satisfies MeshMessage);
  }

  private send(partial: Omit<MeshMessage, 'from' | 'fromName'>) {
    this.channel.postMessage({ ...partial, from: this.id, fromName: this.name } satisfies MeshMessage);
  }

  private handleMessage(msg: MeshMessage) {
    if (msg.from === this.id) return; // ignore own messages

    // If message is addressed, only handle if it's for us
    if (msg.to && msg.to !== this.id) return;

    switch (msg.type) {
      case 'ANNOUNCE':
      case 'HEARTBEAT': {
        const peer: ClawPeer = {
          id: msg.from,
          name: msg.fromName,
          capabilities: (msg.payload as any)?.capabilities ?? [],
          lastSeen: Date.now(),
        };
        this.peers.set(msg.from, peer);
        this.onPeersChanged?.(this.getPeers());
        // Respond to ANNOUNCE with our presence so the new peer knows us
        if (msg.type === 'ANNOUNCE') this.announce();
        break;
      }
      case 'DISCOVER': {
        this.announce();
        break;
      }
      case 'GOODBYE': {
        this.peers.delete(msg.from);
        this.onPeersChanged?.(this.getPeers());
        break;
      }
      case 'DELEGATE': {
        if (!this.onDelegationReceived) {
          this.sendResult(msg.from, msg.requestId!, '[MESH] Peer received task but has no delegation handler set.');
          return;
        }
        const task = (msg.payload as any)?.task as string;
        this.onDelegationReceived(msg.fromName, task, msg.requestId!)
          .then((result) => this.sendResult(msg.from, msg.requestId!, result))
          .catch((err) => this.sendResult(msg.from, msg.requestId!, `[MESH] Error: ${String(err)}`));
        break;
      }
      case 'RESULT': {
        const resolver = this.pendingRequests.get(msg.requestId!);
        if (resolver) {
          this.pendingRequests.delete(msg.requestId!);
          resolver((msg.payload as any)?.result as string);
        }
        break;
      }
    }
  }
}

// Singleton mesh instance shared across the app
export const clawMesh = new ClawMesh();
