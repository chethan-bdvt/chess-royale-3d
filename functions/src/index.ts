import { Chess } from 'chess.js';
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

initializeApp();
const db = getFirestore();
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = () => Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
const uid = (request: { auth?: { uid: string } }) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to play online.');
  return request.auth.uid;
};

export const createRoom = onCall(async (request) => {
  const player = uid(request);
  let roomId = code();
  while ((await db.doc(`rooms/${roomId}`).get()).exists) roomId = code();
  const game = new Chess();
  await db.doc(`rooms/${roomId}`).create({ fen: game.fen(), pgn: '', hostId: player, whiteId: player, status: 'waiting', turn: 'w', updatedAt: FieldValue.serverTimestamp() });
  return { roomId };
});

export const joinRoom = onCall(async (request) => {
  const player = uid(request);
  const roomId = String(request.data?.roomId ?? '').toUpperCase();
  if (!/^[A-Z2-9]{6}$/.test(roomId)) throw new HttpsError('invalid-argument', 'Invalid room code.');
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`rooms/${roomId}`);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Room not found.');
    const room = snap.data()!;
    if (room.guestId && room.guestId !== player) throw new HttpsError('already-exists', 'Room is full.');
    if (room.hostId === player) throw new HttpsError('failed-precondition', 'Share this code with another player.');
    tx.update(ref, { guestId: player, status: 'playing', updatedAt: FieldValue.serverTimestamp() });
  });
  return { ok: true };
});

export const submitMove = onCall(async (request) => {
  const player = uid(request);
  const roomId = String(request.data?.roomId ?? '').toUpperCase();
  const input = request.data?.move;
  if (!input || typeof input.from !== 'string' || typeof input.to !== 'string') throw new HttpsError('invalid-argument', 'Invalid move.');
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`rooms/${roomId}`);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Room not found.');
    const room = snap.data()!;
    const color = room.whiteId === player ? 'w' : room.guestId === player ? 'b' : null;
    if (!color) throw new HttpsError('permission-denied', 'You are not in this room.');
    if (room.status !== 'playing' || room.turn !== color) throw new HttpsError('failed-precondition', 'It is not your turn.');
    const game = new Chess(room.fen);
    let played;
    try { played = game.move({ from: input.from, to: input.to, promotion: input.promotion ?? 'q' }); }
    catch { throw new HttpsError('invalid-argument', 'Illegal move.'); }
    tx.update(ref, {
      fen: game.fen(), pgn: game.pgn(), turn: game.turn(), status: game.isGameOver() ? 'finished' : 'playing',
      result: game.isCheckmate() ? `${color === 'w' ? 'White' : 'Black'} wins` : game.isDraw() ? 'Draw' : null,
      lastMove: { from: played.from, to: played.to, promotion: played.promotion ?? null }, updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return { ok: true };
});
