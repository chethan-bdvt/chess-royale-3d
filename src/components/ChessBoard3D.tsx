import { Canvas } from '@react-three/fiber/native';
import type { PieceSymbol, Square } from 'chess.js';
import { Chess } from 'chess.js';
import { Suspense, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

type BoardPiece = { square: Square; type: PieceSymbol; color: 'w' | 'b' };

function Piece({ piece, selected, onPress }:{ piece: BoardPiece; selected: boolean; onPress: () => void }) {
  const file = piece.square.charCodeAt(0) - 97;
  const rank = Number(piece.square[1]) - 1;
  const material = piece.color === 'w' ? '#F7E7CE' : '#202938';
  const accent = piece.color === 'w' ? '#B79661' : '#64748B';
  const y = selected ? 0.34 : 0.24;
  const geometries: Record<PieceSymbol, { body: [number, number, number]; crown: 'sphere' | 'box' | 'cone' }> = {
    p: { body: [0.18, 0.28, 0.18], crown: 'sphere' },
    n: { body: [0.22, 0.42, 0.18], crown: 'box' },
    b: { body: [0.18, 0.40, 0.18], crown: 'cone' },
    r: { body: [0.25, 0.36, 0.25], crown: 'box' },
    q: { body: [0.22, 0.50, 0.22], crown: 'sphere' },
    k: { body: [0.23, 0.54, 0.23], crown: 'box' },
  };
  const shape = geometries[piece.type];
  return <group position={[file - 3.5, y, rank - 3.5]} onPointerDown={(event) => { event.stopPropagation(); onPress(); }}>
    <mesh position={[0, -0.12, 0]} castShadow><cylinderGeometry args={[0.29, 0.34, 0.12, 24]} /><meshStandardMaterial color={accent} /></mesh>
    <mesh position={[0, shape.body[1] / 2, 0]} castShadow><cylinderGeometry args={[shape.body[0] * 0.65, shape.body[0], shape.body[1], 24]} /><meshStandardMaterial color={material} roughness={0.35} metalness={0.12} /></mesh>
    <mesh position={[0, shape.body[1] + 0.08, 0]} castShadow>
      {shape.crown === 'sphere' ? <sphereGeometry args={[piece.type === 'q' ? 0.19 : 0.16, 20, 16]} /> :
       shape.crown === 'cone' ? <coneGeometry args={[0.19, 0.32, 20]} /> : <boxGeometry args={[piece.type === 'n' ? 0.24 : 0.2, 0.24, 0.2]} />}
      <meshStandardMaterial color={material} roughness={0.3} />
    </mesh>
    {piece.type === 'k' && <><mesh position={[0, shape.body[1] + 0.28, 0]}><boxGeometry args={[0.08, 0.30, 0.08]} /><meshStandardMaterial color={accent}/></mesh><mesh position={[0, shape.body[1] + 0.31, 0]}><boxGeometry args={[0.26, 0.07, 0.08]} /><meshStandardMaterial color={accent}/></mesh></>}
  </group>;
}

function BoardScene({ fen, selected, legal, hint, flipped, onSquarePress }:{
  fen: string; selected: Square | null; legal: Square[]; hint: {from: Square; to: Square} | null;
  flipped: boolean; onSquarePress: (square: Square) => void;
}) {
  const pieces = useMemo(() => new Chess(fen).board().flatMap((row) => row.filter(Boolean) as BoardPiece[]), [fen]);
  const squares = useMemo(() => Array.from({ length: 64 }, (_, index) => {
    const file = index % 8; const rank = Math.floor(index / 8);
    return { file, rank, square: `${String.fromCharCode(97 + file)}${rank + 1}` as Square };
  }), []);
  return <>
    <ambientLight intensity={1.2} />
    <directionalLight position={[4, 8, 5]} intensity={2.2} castShadow />
    <group rotation-y={flipped ? Math.PI : 0}>
      <mesh position={[0, -0.16, 0]} receiveShadow><boxGeometry args={[8.6, 0.3, 8.6]} /><meshStandardMaterial color="#3B2619" roughness={0.65} /></mesh>
      {squares.map(({ file, rank, square }) => {
        const isSelected = selected === square;
        const isLegal = legal.includes(square);
        const isHint = hint?.from === square || hint?.to === square;
        const squareColor = isSelected ? colors.selection : isHint ? colors.blue : (file + rank) % 2 === 0 ? colors.darkSquare : colors.lightSquare;
        return <group key={square} position={[file - 3.5, 0, rank - 3.5]} onPointerDown={(event) => { event.stopPropagation(); onSquarePress(square); }}>
          <mesh receiveShadow><boxGeometry args={[0.98, 0.10, 0.98]} /><meshStandardMaterial color={squareColor} roughness={0.75} /></mesh>
          {isLegal && <mesh position={[0, 0.07, 0]}><cylinderGeometry args={[0.13, 0.13, 0.03, 20]} /><meshStandardMaterial color={colors.legal} transparent opacity={0.8} /></mesh>}
        </group>;
      })}
      {pieces.map((piece) => <Piece key={piece.square} piece={piece} selected={selected === piece.square} onPress={() => onSquarePress(piece.square)} />)}
    </group>
  </>;
}

export function ChessBoard3D(props: Parameters<typeof BoardScene>[0]) {
  return <View style={styles.shell}><Canvas shadows camera={{ position: [0, 8.4, 7.5], fov: 48 }}>
    <Suspense fallback={null}><BoardScene {...props} /></Suspense>
  </Canvas></View>;
}

const styles = StyleSheet.create({ shell: { width: '100%', aspectRatio: 0.88, backgroundColor: '#0E1626', borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#2B3850' } });
