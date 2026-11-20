"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitMove = exports.joinRoom = exports.createRoom = void 0;
const chess_js_1 = require("chess.js");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = () => Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
const uid = (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Sign in to play online.');
    return request.auth.uid;
};
exports.createRoom = (0, https_1.onCall)(async (request) => {
    const player = uid(request);
    let roomId = code();
    while ((await db.doc(`rooms/${roomId}`).get()).exists)
        roomId = code();
    const game = new chess_js_1.Chess();
    await db.doc(`rooms/${roomId}`).create({ fen: game.fen(), pgn: '', hostId: player, whiteId: player, status: 'waiting', turn: 'w', updatedAt: firestore_1.FieldValue.serverTimestamp() });
    return { roomId };
});
exports.joinRoom = (0, https_1.onCall)(async (request) => {
    const player = uid(request);
    const roomId = String(request.data?.roomId ?? '').toUpperCase();
    if (!/^[A-Z2-9]{6}$/.test(roomId))
        throw new https_1.HttpsError('invalid-argument', 'Invalid room code.');
    await db.runTransaction(async (tx) => {
        const ref = db.doc(`rooms/${roomId}`);
        const snap = await tx.get(ref);
        if (!snap.exists)
            throw new https_1.HttpsError('not-found', 'Room not found.');
        const room = snap.data();
        if (room.guestId && room.guestId !== player)
            throw new https_1.HttpsError('already-exists', 'Room is full.');
        if (room.hostId === player)
            throw new https_1.HttpsError('failed-precondition', 'Share this code with another player.');
        tx.update(ref, { guestId: player, status: 'playing', updatedAt: firestore_1.FieldValue.serverTimestamp() });
    });
    return { ok: true };
});
exports.submitMove = (0, https_1.onCall)(async (request) => {
    const player = uid(request);
    const roomId = String(request.data?.roomId ?? '').toUpperCase();
    const input = request.data?.move;
    if (!input || typeof input.from !== 'string' || typeof input.to !== 'string')
        throw new https_1.HttpsError('invalid-argument', 'Invalid move.');
    await db.runTransaction(async (tx) => {
        const ref = db.doc(`rooms/${roomId}`);
        const snap = await tx.get(ref);
        if (!snap.exists)
            throw new https_1.HttpsError('not-found', 'Room not found.');
        const room = snap.data();
        const color = room.whiteId === player ? 'w' : room.guestId === player ? 'b' : null;
        if (!color)
            throw new https_1.HttpsError('permission-denied', 'You are not in this room.');
        if (room.status !== 'playing' || room.turn !== color)
            throw new https_1.HttpsError('failed-precondition', 'It is not your turn.');
        const game = new chess_js_1.Chess(room.fen);
        let played;
        try {
            played = game.move({ from: input.from, to: input.to, promotion: input.promotion ?? 'q' });
        }
        catch {
            throw new https_1.HttpsError('invalid-argument', 'Illegal move.');
        }
        tx.update(ref, {
            fen: game.fen(), pgn: game.pgn(), turn: game.turn(), status: game.isGameOver() ? 'finished' : 'playing',
            result: game.isCheckmate() ? `${color === 'w' ? 'White' : 'Black'} wins` : game.isDraw() ? 'Draw' : null,
            lastMove: { from: played.from, to: played.to, promotion: played.promotion ?? null }, updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    });
    return { ok: true };
});
