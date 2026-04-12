import { requestUrl } from "obsidian";

// ── Message types ──────────────────────────────────────────────────────

export interface ChunkSegment {
	start: number;
	end: number;
	text: string;
}

export interface FinalSegment {
	timestamp: number;
	speaker: string;
	text: string;
}

export interface StartConfig {
	document_name?: string;
	document_path?: string;
	[key: string]: unknown;
}

// Outbound commands
export interface StartCommand {
	type: "start";
	config: StartConfig;
}

export interface StopCommand {
	type: "stop";
}

export interface PauseCommand {
	type: "pause";
}

export interface ResumeCommand {
	type: "resume";
}

export type OutboundMessage = StartCommand | StopCommand | PauseCommand | ResumeCommand;

// Inbound messages
export interface ChunkMessage {
	type: "chunk";
	segments: ChunkSegment[];
}

export interface SpeakingStatEntry {
	speaker: string;
	total_seconds: number;
	ratio: number;
}

export interface FinalMessage {
	type: "final";
	segments: FinalSegment[];
	speaker_map?: Record<string, string>;
	speaking_stats?: SpeakingStatEntry[];
}

export interface StatusMessage {
	type: "status";
	recording: boolean;
	processing: boolean;
}

export interface ErrorMessage {
	type: "error";
	message: string;
}

export interface ProgressMessage {
	type: "progress";
	stage: string;
	percent: number;
}

export interface PingMessage {
	type: "ping";
}

export type InboundMessage =
	| ChunkMessage
	| FinalMessage
	| StatusMessage
	| ErrorMessage
	| ProgressMessage
	| PingMessage;

// Status returned by GET /status
export interface BackendStatus {
	recording: boolean;
	processing: boolean;
}

// ── Event callbacks ────────────────────────────────────────────────────

export interface BackendClientCallbacks {
	onChunk?: (segments: ChunkSegment[]) => void;
	onFinal?: (segments: FinalSegment[], speakingStats?: SpeakingStatEntry[]) => void;
	onStatus?: (status: StatusMessage) => void;
	onError?: (message: string) => void;
	onProgress?: (stage: string, percent: number) => void;
	onConnectionChange?: (connected: boolean) => void;
}

// ── BackendClient ──────────────────────────────────────────────────────

const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const RECONNECT_BACKOFF_FACTOR = 2;

export class BackendClient {
	private serverUrl: string;
	private httpBaseUrl: string;
	private ws: WebSocket | null = null;
	private callbacks: BackendClientCallbacks = {};
	private reconnectDelay = INITIAL_RECONNECT_DELAY;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private shouldReconnect = false;
	private _connected = false;

	constructor(serverUrl: string) {
		this.serverUrl = serverUrl;
		this.httpBaseUrl = this.deriveHttpBaseUrl(serverUrl);
	}

	/** Derive the HTTP base URL from a WebSocket URL, stripping the /ws path. */
	private deriveHttpBaseUrl(wsUrl: string): string {
		let url = wsUrl.replace(/^ws(s?):\/\//, "http$1://");
		// Remove trailing /ws path segment
		url = url.replace(/\/ws\/?$/, "");
		// Remove trailing slash
		url = url.replace(/\/$/, "");
		return url;
	}

	// ── Connection state ───────────────────────────────────────────────

	get connected(): boolean {
		return this._connected;
	}

	private setConnected(value: boolean): void {
		if (this._connected !== value) {
			this._connected = value;
			this.callbacks.onConnectionChange?.(value);
		}
	}

	// ── Callback registration ──────────────────────────────────────────

	onChunk(cb: NonNullable<BackendClientCallbacks["onChunk"]>): this {
		this.callbacks.onChunk = cb;
		return this;
	}

	onFinal(cb: NonNullable<BackendClientCallbacks["onFinal"]>): this {
		this.callbacks.onFinal = cb;
		return this;
	}

	onStatus(cb: NonNullable<BackendClientCallbacks["onStatus"]>): this {
		this.callbacks.onStatus = cb;
		return this;
	}

	onError(cb: NonNullable<BackendClientCallbacks["onError"]>): this {
		this.callbacks.onError = cb;
		return this;
	}

	onProgress(cb: NonNullable<BackendClientCallbacks["onProgress"]>): this {
		this.callbacks.onProgress = cb;
		return this;
	}

	onConnectionChange(
		cb: NonNullable<BackendClientCallbacks["onConnectionChange"]>
	): this {
		this.callbacks.onConnectionChange = cb;
		return this;
	}

	// ── WebSocket lifecycle ────────────────────────────────────────────

	connect(): void {
		this.shouldReconnect = true;
		this.reconnectDelay = INITIAL_RECONNECT_DELAY;
		this.openWebSocket();
	}

	disconnect(): void {
		this.shouldReconnect = false;
		this.clearReconnectTimer();

		if (this.ws) {
			this.ws.onclose = null; // prevent reconnect from firing
			this.ws.close();
			this.ws = null;
		}

		this.setConnected(false);
	}

	/** Update the server URL and reconnect if currently connected. */
	updateServerUrl(serverUrl: string): void {
		this.serverUrl = serverUrl;
		this.httpBaseUrl = this.deriveHttpBaseUrl(serverUrl);

		if (this.shouldReconnect) {
			this.disconnect();
			this.connect();
		}
	}

	// ── Send commands ──────────────────────────────────────────────────

	sendStart(config: StartConfig): void {
		this.send({ type: "start", config });
	}

	sendStop(): void {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			console.log("[BackendClient] Sending stop via WebSocket");
			this.ws.send(JSON.stringify({ type: "stop" }));
		} else {
			console.log("[BackendClient] Sending stop via HTTP (WS unavailable)");
			this.httpStop();
		}
	}

	sendPause(): void {
		this.send({ type: "pause" });
	}

	sendResume(): void {
		this.send({ type: "resume" });
	}

	/** Send a binary audio chunk (PCM data) to the server. */
	sendAudioChunk(pcmData: ArrayBuffer): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			console.warn("[BackendClient] Cannot send audio — WebSocket not open");
			return;
		}
		this.ws.send(pcmData);
	}

	private async httpStop(): Promise<void> {
		try {
			const response = await requestUrl({
				url: `${this.httpBaseUrl}/stop`,
				method: "POST",
			});
			console.log("[BackendClient] HTTP stop response:", response.json);
		} catch (err) {
			console.error("[BackendClient] HTTP stop failed:", err);
			this.callbacks.onError?.("Failed to stop recording");
		}
	}

	private send(message: OutboundMessage): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			console.error(
				"[BackendClient] Cannot send — WebSocket is not open",
				"readyState:", this.ws?.readyState
			);
			this.callbacks.onError?.("WebSocket is not connected");
			return;
		}
		console.log("[BackendClient] Sending:", message.type);
		this.ws.send(JSON.stringify(message));
	}

	// ── HTTP methods ───────────────────────────────────────────────────

	async fetchStatus(): Promise<BackendStatus> {
		const response = await requestUrl({
			url: `${this.httpBaseUrl}/status`,
			method: "GET",
		});
		return response.json as BackendStatus;
	}

	// ── Internal WebSocket wiring ──────────────────────────────────────

	private openWebSocket(): void {
		if (this.ws) {
			this.ws.onclose = null;
			this.ws.close();
			this.ws = null;
		}

		try {
			this.ws = new WebSocket(this.serverUrl);
		} catch (err) {
			console.error("[BackendClient] Failed to create WebSocket:", err);
			this.scheduleReconnect();
			return;
		}

		this.ws.onopen = () => {
			console.log("[BackendClient] WebSocket connected");
			this.reconnectDelay = INITIAL_RECONNECT_DELAY;
			this.setConnected(true);
		};

		this.ws.onclose = () => {
			console.log("[BackendClient] WebSocket closed");
			this.setConnected(false);
			this.scheduleReconnect();
		};

		this.ws.onerror = (event) => {
			console.error("[BackendClient] WebSocket error:", event);
			// onclose will fire after onerror, triggering reconnect
		};

		this.ws.onmessage = (event) => {
			this.handleMessage(event.data);
		};
	}

	private handleMessage(raw: string | ArrayBuffer | Blob): void {
		if (typeof raw !== "string") {
			console.warn("[BackendClient] Received non-string message, ignoring");
			return;
		}

		let msg: InboundMessage;
		try {
			msg = JSON.parse(raw) as InboundMessage;
		} catch {
			console.error("[BackendClient] Failed to parse message:", raw);
			return;
		}

		switch (msg.type) {
			case "chunk":
				this.callbacks.onChunk?.(msg.segments);
				break;
			case "final": {
				const finalMsg = msg as FinalMessage;
				this.callbacks.onFinal?.(finalMsg.segments, finalMsg.speaking_stats);
				break;
			}
			case "status":
				this.callbacks.onStatus?.(msg);
				break;
			case "error":
				this.callbacks.onError?.(msg.message);
				break;
			case "progress":
				this.callbacks.onProgress?.(msg.stage, msg.percent);
				break;
			case "ping":
				// Respond to server keep-alive ping
				this.ws?.send(JSON.stringify({ type: "pong" }));
				break;
			default:
				console.warn(
					"[BackendClient] Unknown message type:",
					(msg as { type: string }).type
				);
		}
	}

	// ── Reconnection with exponential backoff ──────────────────────────

	private scheduleReconnect(): void {
		if (!this.shouldReconnect) return;

		this.clearReconnectTimer();

		console.log(
			`[BackendClient] Reconnecting in ${this.reconnectDelay}ms...`
		);

		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			this.openWebSocket();
		}, this.reconnectDelay);

		this.reconnectDelay = Math.min(
			this.reconnectDelay * RECONNECT_BACKOFF_FACTOR,
			MAX_RECONNECT_DELAY
		);
	}

	private clearReconnectTimer(): void {
		if (this.reconnectTimer !== null) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
	}
}
