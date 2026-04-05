import { ref, onUnmounted } from 'vue';
import { io, type Socket } from 'socket.io-client';
import { getUserId } from './useApi';
import type {
  CellsRespawnedEvent,
  ScoreUpdateEvent,
  GameFinishedEvent,
} from '@hexawords/types';

const SOCKET_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

let socket: Socket | null = null;
const connected = ref(false);

function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket'],
      query: { userId: getUserId() },
      autoConnect: false,
    });

    socket.on('connect', () => { connected.value = true; });
    socket.on('disconnect', () => { connected.value = false; });
  }
  return socket;
}

function on<T>(s: Socket, event: string, cb: (data: T) => void) {
  s.on(event, cb);
  onUnmounted(() => s.off(event, cb));
}

export function useSocket() {
  const s = getSocket();

  return {
    connected,
    connect: () => { if (!s.connected) s.connect(); },
    disconnect: () => { if (s.connected) s.disconnect(); },
    joinGame: (gameId: string) => { s.emit('game:join', { gameId }); },
    onCellsRespawned: (cb: (data: CellsRespawnedEvent) => void) => on(s, 'cell:respawned', cb),
    onScoreUpdate: (cb: (data: ScoreUpdateEvent) => void) => on(s, 'score:update', cb),
    onGameFinished: (cb: (data: GameFinishedEvent) => void) => on(s, 'game:finished', cb),
  };
}
