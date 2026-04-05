import { ref, onUnmounted } from 'vue';
import { io, type Socket } from 'socket.io-client';
import { getUserId } from './useApi';
import type {
  ServerToClientEvents,
  CellsRespawnedEvent,
  ScoreUpdateEvent,
  WordInvalidEvent,
  GameFinishedEvent,
} from '@hexawords/types';

const SOCKET_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

type TypedSocket = Socket<ServerToClientEvents>;

let socket: TypedSocket | null = null;
const connected = ref(false);

function getSocket(): TypedSocket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket'],
      query: { userId: getUserId() },
      autoConnect: false,
    }) as TypedSocket;

    socket.on('connect', () => {
      connected.value = true;
    });

    socket.on('disconnect', () => {
      connected.value = false;
    });
  }
  return socket;
}

export function useSocket() {
  const s = getSocket();

  function connect() {
    if (!s.connected) s.connect();
  }

  function disconnect() {
    if (s.connected) s.disconnect();
  }

  function joinGame(gameId: string) {
    s.emit('game:join', { gameId });
  }

  function onCellsRespawned(cb: (data: CellsRespawnedEvent) => void) {
    s.on('cell:respawned', cb);
    onUnmounted(() => s.off('cell:respawned', cb));
  }

  function onScoreUpdate(cb: (data: ScoreUpdateEvent) => void) {
    s.on('score:update', cb);
    onUnmounted(() => s.off('score:update', cb));
  }

  function onWordInvalid(cb: (data: WordInvalidEvent) => void) {
    s.on('word:invalid', cb);
    onUnmounted(() => s.off('word:invalid', cb));
  }

  function onGameFinished(cb: (data: GameFinishedEvent) => void) {
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
    onWordInvalid,
    onGameFinished,
  };
}
