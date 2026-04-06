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
let currentUserId = '';
const connected = ref(false);

function ensureSocket(): Socket {
  const userId = getUserId();

  if (socket && currentUserId !== userId) {
    socket.disconnect();
    socket = null;
  }

  if (!socket) {
    currentUserId = userId;
    socket = io(SOCKET_URL, {
      transports: ['websocket'],
      query: { userId },
      autoConnect: false,
    });
    socket.on('connect', () => { connected.value = true; });
    socket.on('disconnect', () => { connected.value = false; });
  }
  return socket;
}

export function useSocket() {
  function connect() {
    const s = ensureSocket();
    if (!s.connected) s.connect();
  }

  function disconnect() {
    socket?.disconnect();
  }

  function joinGame(gameId: string) {
    ensureSocket().emit('game:join', { gameId });
  }

  function onCellsRespawned(cb: (data: CellsRespawnedEvent) => void) {
    const s = ensureSocket();
    s.on('cell:respawned', cb);
    onUnmounted(() => s.off('cell:respawned', cb));
  }

  function onScoreUpdate(cb: (data: ScoreUpdateEvent) => void) {
    const s = ensureSocket();
    s.on('score:update', cb);
    onUnmounted(() => s.off('score:update', cb));
  }

  function onGameFinished(cb: (data: GameFinishedEvent) => void) {
    const s = ensureSocket();
    s.on('game:finished', cb);
    onUnmounted(() => s.off('game:finished', cb));
  }

  return {
    connected,
    connect,
    disconnect,
    joinGame,
    onCellsRespawned,
    onScoreUpdate,
    onGameFinished,
  };
}
