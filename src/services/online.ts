import type { Move } from 'chess.js';
import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import type { OnlineRoom } from '../types';
import { currentUserId, db, functions } from './firebase';

export async function createRoom(): Promise<{ roomId: string; userId: string }> {
  if (!functions) throw new Error('Online play is not configured.');
  const userId = await currentUserId();
  const response = await httpsCallable<undefined, { roomId: string }>(functions, 'createRoom')();
  return { roomId: response.data.roomId, userId };
}

export async function joinRoom(roomId: string): Promise<{ roomId: string; userId: string }> {
  if (!functions) throw new Error('Online play is not configured.');
  const userId = await currentUserId();
  const id = roomId.trim().toUpperCase();
  await httpsCallable<{ roomId: string }, { ok: boolean }>(functions, 'joinRoom')({ roomId: id });
  return { roomId: id, userId };
}

export function watchRoom(roomId: string, onUpdate: (room: OnlineRoom) => void, onError: (message: string) => void): Unsubscribe {
  if (!db) return () => undefined;
  return onSnapshot(doc(db, 'rooms', roomId), (snap) => {
    if (snap.exists()) onUpdate({ id: snap.id, ...snap.data() } as OnlineRoom);
  }, (error) => onError(error.message));
}

export async function submitMove(roomId: string, _userId: string, move: Pick<Move, 'from' | 'to' | 'promotion'>) {
  if (!functions) throw new Error('Online play is not configured.');
  await httpsCallable<{ roomId: string; move: Pick<Move, 'from' | 'to' | 'promotion'> }, { ok: boolean }>(functions, 'submitMove')({ roomId, move });
}
