import * as Haptics from 'expo-haptics';
import { Chess, type Move, type Square } from 'chess.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Button } from './src/components/Button';
import { ChessBoard3D } from './src/components/ChessBoard3D';
import { bestMove, gameResult, getHint, legalTargets } from './src/game/engine';
import { clearSavedGame, defaultSettings, loadGame, loadSettings, saveGame, saveSettings } from './src/game/storage';
import { cloudEnabled } from './src/services/firebase';
import { createRoom, joinRoom, submitMove, watchRoom } from './src/services/online';
import { showRewardedHint } from './src/services/rewards';
import { colors } from './src/theme';
import type { Difficulty, GameMode, GameSettings, Hint, OnlineRoom, SavedGame } from './src/types';

type Screen = 'home' | 'lobby' | 'game' | 'settings' | 'rules';

const titleForTurn = (game: Chess) => game.isCheck() ? `${game.turn() === 'w' ? 'White' : 'Black'} is in check` : `${game.turn() === 'w' ? 'White' : 'Black'} to move`;
const restoreChess = (saved?: Pick<SavedGame, 'fen' | 'pgn'> | null) => {
  const restored = new Chess();
  if (saved?.pgn) {
    try { restored.loadPgn(saved.pgn); return restored; } catch { /* fall back to FEN */ }
  }
  return new Chess(saved?.fen);
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [mode, setMode] = useState<GameMode>('computer');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [settings, setSettings] = useState<GameSettings>(defaultSettings);
  const [resume, setResume] = useState<SavedGame | null>(null);
  const [roomInput, setRoomInput] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void Promise.all([loadSettings(), loadGame()]).then(([s, g]) => { setSettings(s); setResume(g); }); }, []);
  const updateSettings = (next: GameSettings) => { setSettings(next); void saveSettings(next); };

  const start = (nextMode: GameMode, saved?: SavedGame) => {
    setMode(nextMode); setRoomId(null); setUserId(null); setOnlineError(null);
    if (nextMode === 'online') setScreen('lobby'); else { setResume(saved ?? null); setScreen('game'); }
  };

  const host = async () => {
    setBusy(true); setOnlineError(null);
    try { const room = await createRoom(); setRoomId(room.roomId); setUserId(room.userId); setScreen('game'); }
    catch (error) { setOnlineError(error instanceof Error ? error.message : 'Could not create room.'); }
    finally { setBusy(false); }
  };
  const join = async () => {
    setBusy(true); setOnlineError(null);
    try { const room = await joinRoom(roomInput); setRoomId(room.roomId); setUserId(room.userId); setScreen('game'); }
    catch (error) { setOnlineError(error instanceof Error ? error.message : 'Could not join room.'); }
    finally { setBusy(false); }
  };

  return <SafeAreaView style={styles.safe}><StatusBar barStyle="light-content" backgroundColor={colors.background} />
    {screen === 'home' && <Home resume={resume} onStart={start} onSettings={() => setScreen('settings')} onRules={() => setScreen('rules')} />}
    {screen === 'lobby' && <Lobby roomInput={roomInput} setRoomInput={setRoomInput} busy={busy} error={onlineError} onHost={host} onJoin={join} onBack={() => setScreen('home')} />}
    {screen === 'settings' && <Settings settings={settings} update={updateSettings} onBack={() => setScreen('home')} />}
    {screen === 'rules' && <Rules onBack={() => setScreen('home')} />}
    {screen === 'game' && <Game key={`${mode}-${roomId ?? resume?.updatedAt ?? 'new'}`} mode={mode} difficulty={difficulty} setDifficulty={setDifficulty} settings={settings} initial={resume} roomId={roomId} userId={userId} onExit={(saved) => { setResume(saved); setScreen('home'); }} />}
  </SafeAreaView>;
}

function Home({ resume, onStart, onSettings, onRules }:{ resume: SavedGame | null; onStart: (mode: GameMode, save?: SavedGame) => void; onSettings: () => void; onRules: () => void }) {
  return <ScrollView contentContainerStyle={styles.home}>
    <View style={styles.brandMark}><Text style={styles.king}>♚</Text></View>
    <Text style={styles.eyebrow}>THE ROYAL GAME</Text><Text style={styles.title}>Chess Royale</Text><Text style={styles.subtitle}>A timeless battle, rendered in 3D.</Text>
    <View style={styles.menu}>
      {resume && <Button label="Continue game" onPress={() => onStart(resume.mode, resume)} />}
      <Button label="Play computer" onPress={() => onStart('computer')} variant={resume ? 'secondary' : 'primary'} />
      <Button label="Pass & play" onPress={() => onStart('local')} variant="secondary" />
      <Button label="Online with friend" onPress={() => onStart('online')} variant="secondary" />
      <View style={styles.row}><Button label="Settings" onPress={onSettings} variant="secondary" style={styles.flex} /><Button label="How to play" onPress={onRules} variant="secondary" style={styles.flex} /></View>
    </View>
    <Text style={styles.footer}>Offline-first • Private rooms • Fair-play chess</Text>
  </ScrollView>;
}

function Lobby({ roomInput, setRoomInput, busy, error, onHost, onJoin, onBack }:{ roomInput:string; setRoomInput:(v:string)=>void; busy:boolean; error:string|null; onHost:()=>void; onJoin:()=>void; onBack:()=>void }) {
  return <View style={styles.page}><TopBar title="Play online" onBack={onBack} /><View style={styles.centerCard}>
    <Text style={styles.cardIcon}>♞</Text><Text style={styles.sectionTitle}>Private match</Text><Text style={styles.body}>Create a room and share its six-character code, or enter a friend's code.</Text>
    {!cloudEnabled && <Text style={styles.warning}>Firebase is not configured yet. Add the values from .env.example to enable online play.</Text>}
    <Button label="Create room" onPress={onHost} disabled={busy || !cloudEnabled} />
    <View style={styles.divider}><View style={styles.line}/><Text style={styles.muted}>OR JOIN</Text><View style={styles.line}/></View>
    <TextInput value={roomInput} onChangeText={(value) => setRoomInput(value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0,6))} autoCapitalize="characters" maxLength={6} placeholder="ROOM CODE" placeholderTextColor="#64748B" style={styles.codeInput} />
    <Button label="Join room" onPress={onJoin} variant="secondary" disabled={busy || roomInput.length !== 6 || !cloudEnabled} />
    {busy && <ActivityIndicator color={colors.gold} />} {error && <Text style={styles.error}>{error}</Text>}
  </View></View>;
}

function Game({ mode, difficulty, setDifficulty, settings, initial, roomId, userId, onExit }:{ mode:GameMode; difficulty:Difficulty; setDifficulty:(d:Difficulty)=>void; settings:GameSettings; initial:SavedGame|null; roomId:string|null; userId:string|null; onExit:(saved:SavedGame|null)=>void }) {
  const gameRef = useRef(restoreChess(initial));
  const [fen, setFen] = useState(gameRef.current.fen());
  const [selected, setSelected] = useState<Square | null>(null);
  const [legal, setLegal] = useState<Square[]>([]);
  const [hint, setHint] = useState<Hint | null>(null);
  const [thinking, setThinking] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [room, setRoom] = useState<OnlineRoom | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const game = gameRef.current;
  const result = gameResult(game);
  const onlineColor = room && userId ? room.whiteId === userId ? 'w' : room.guestId === userId ? 'b' : null : null;
  const canMove = !result && !thinking && (mode !== 'computer' || game.turn() === 'w') && (mode !== 'online' || (room?.status === 'playing' && onlineColor === game.turn()));

  useEffect(() => {
    if (mode !== 'online' || !roomId) return;
    return watchRoom(roomId, (next) => {
      setRoom(next); gameRef.current = restoreChess(next); setFen(next.fen); setSelected(null); setLegal([]);
      if (userId) setFlipped(next.whiteId !== userId);
    }, setNotice);
  }, [mode, roomId, userId]);

  useEffect(() => {
    if (mode === 'online') return;
    const saved: SavedGame = { fen, pgn: gameRef.current.pgn(), mode, difficulty, updatedAt: Date.now() };
    void saveGame(saved);
  }, [fen, mode, difficulty]);

  const vibrate = () => { if (settings.haptics) void Haptics.selectionAsync(); };
  const sync = () => { setFen(gameRef.current.fen()); setSelected(null); setLegal([]); setHint(null); vibrate(); };
  const commit = useCallback(async (move: {from:Square; to:Square; promotion?:string}) => {
    try {
      if (mode === 'online' && roomId && userId) { await submitMove(roomId, userId, move as Pick<Move,'from'|'to'|'promotion'>); return; }
      gameRef.current.move(move); sync();
      if (mode === 'local' && settings.autoRotate) setTimeout(() => setFlipped((value) => !value), 260);
      if (mode === 'computer' && !gameRef.current.isGameOver()) {
        setThinking(true);
        setTimeout(() => { const reply = bestMove(gameRef.current.fen(), difficulty); if (reply) gameRef.current.move(reply); sync(); setThinking(false); }, 420);
      }
    } catch { setNotice('That move is not legal.'); }
  }, [mode, roomId, userId, difficulty, settings.autoRotate]);

  const chooseMove = (from: Square, to: Square) => {
    const candidate = gameRef.current.moves({ square: from, verbose: true }).find((move) => move.to === to);
    if (!candidate) return;
    if (candidate.flags.includes('p')) {
      Alert.alert('Promote pawn', 'Choose a piece', [
        { text: 'Queen', onPress: () => void commit({ from, to, promotion:'q' }) }, { text: 'Rook', onPress: () => void commit({ from, to, promotion:'r' }) },
        { text: 'Bishop', onPress: () => void commit({ from, to, promotion:'b' }) }, { text: 'Knight', onPress: () => void commit({ from, to, promotion:'n' }) },
      ]); return;
    }
    void commit({ from, to });
  };

  const pressSquare = (square: Square) => {
    if (!canMove) return;
    if (selected && legal.includes(square)) { chooseMove(selected, square); return; }
    const piece = gameRef.current.get(square);
    if (piece?.color === gameRef.current.turn()) { setSelected(square); setLegal(settings.showLegalMoves ? legalTargets(gameRef.current, square) : []); setHint(null); vibrate(); }
    else { setSelected(null); setLegal([]); }
  };

  const requestHint = async () => {
    if (!canMove) return;
    setNotice('Loading rewarded hint…');
    const reward = await showRewardedHint();
    if (reward === 'closed') { setNotice('Watch the full ad to unlock the hint.'); return; }
    const next = getHint(gameRef.current.fen()); setHint(next); setNotice(next ? `${next.san} is a strong move${reward === 'unavailable' ? ' (practice hint)' : ''}.` : 'No moves available.');
  };

  const undo = () => {
    if (mode === 'online' || thinking) return;
    gameRef.current.undo(); if (mode === 'computer') gameRef.current.undo(); sync();
  };
  const exit = () => {
    const saved = mode === 'online' || result ? null : { fen: gameRef.current.fen(), pgn: gameRef.current.pgn(), mode, difficulty, updatedAt: Date.now() } as SavedGame;
    if (result) void clearSavedGame(); onExit(saved);
  };
  const resign = () => Alert.alert('Resign game?', 'This game will end immediately.', [{text:'Cancel', style:'cancel'}, {text:'Resign', style:'destructive', onPress:() => { void clearSavedGame(); onExit(null); }}]);
  const moves = gameRef.current.history();

  return <View style={styles.gamePage}>
    <TopBar title={mode === 'online' ? `Room ${roomId}` : mode === 'computer' ? `Computer · ${difficulty}` : 'Pass & play'} onBack={exit} action={<Pressable onPress={() => setHistoryOpen(true)}><Text style={styles.topAction}>Moves</Text></Pressable>} />
    {mode === 'online' && room?.status === 'waiting' && <View style={styles.waiting}><ActivityIndicator color={colors.gold}/><Text style={styles.body}>Share code <Text style={styles.gold}>{roomId}</Text> — waiting for your friend…</Text></View>}
    <View style={styles.playerBar}><View><Text style={styles.playerName}>{flipped ? 'White' : mode === 'computer' ? 'Computer' : 'Black'}</Text><Text style={styles.muted}>{thinking ? 'Thinking…' : 'Opponent'}</Text></View><Text style={styles.pieceBadge}>{flipped ? '♔' : '♚'}</Text></View>
    <ChessBoard3D fen={fen} selected={selected} legal={legal} hint={hint} flipped={flipped} onSquarePress={pressSquare} />
    <View style={styles.playerBar}><View><Text style={styles.playerName}>{flipped ? (mode === 'computer' ? 'Computer' : 'Black') : mode === 'computer' ? 'You' : 'White'}</Text><Text style={[styles.muted, canMove && styles.green]}>{result ?? titleForTurn(gameRef.current)}</Text></View><Text style={styles.pieceBadge}>{flipped ? '♚' : '♔'}</Text></View>
    {notice && <Pressable onPress={() => setNotice(null)}><Text style={styles.notice}>{notice}</Text></Pressable>}
    {mode === 'computer' && <View style={styles.pills}>{(['easy','medium','hard'] as Difficulty[]).map((level)=><Pressable key={level} disabled={moves.length>0} onPress={()=>setDifficulty(level)} style={[styles.pill,difficulty===level&&styles.pillActive]}><Text style={styles.pillText}>{level}</Text></Pressable>)}</View>}
    <View style={styles.gameActions}><Button label="Undo" onPress={undo} variant="secondary" disabled={mode==='online'||!moves.length} style={styles.flex}/><Button label="Hint · Ad" onPress={()=>void requestHint()} variant="secondary" disabled={!canMove} style={styles.flex}/><Button label="Resign" onPress={resign} variant="danger" style={styles.flex}/></View>
    {result && <View style={styles.result}><Text style={styles.resultTitle}>{result}</Text><Button label="Return home" onPress={exit}/></View>}
    <Modal visible={historyOpen} transparent animationType="slide" onRequestClose={()=>setHistoryOpen(false)}><Pressable style={styles.modalShade} onPress={()=>setHistoryOpen(false)}><Pressable style={styles.sheet} onPress={()=>undefined}><Text style={styles.sectionTitle}>Move history</Text><ScrollView><Text style={styles.history}>{moves.length ? moves.map((move,index)=>`${index%2===0 ? `${Math.floor(index/2)+1}. ` : ''}${move}${index%2===1 ? '\n' : '  '}`).join('') : 'No moves yet.'}</Text></ScrollView><Button label="Close" onPress={()=>setHistoryOpen(false)} variant="secondary"/></Pressable></Pressable></Modal>
  </View>;
}

function Settings({settings,update,onBack}:{settings:GameSettings;update:(s:GameSettings)=>void;onBack:()=>void}) {
  const toggle = (key:keyof GameSettings)=><Switch value={settings[key]} onValueChange={(value)=>update({...settings,[key]:value})} trackColor={{false:'#334155',true:colors.goldDark}} thumbColor={settings[key]?colors.gold:'#CBD5E1'}/>;
  return <View style={styles.page}><TopBar title="Settings" onBack={onBack}/><View style={styles.settingsCard}>{([['haptics','Haptic feedback'],['showLegalMoves','Show legal moves'],['autoRotate','Rotate for pass & play']] as [keyof GameSettings,string][]).map(([key,label])=><View key={key} style={styles.settingRow}><Text style={styles.playerName}>{label}</Text>{toggle(key)}</View>)}</View><Text style={styles.body}>Rewarded ads are shown only when you request a hint. In production, consent and privacy choices must be presented before personalized advertising.</Text></View>;
}

function Rules({onBack}:{onBack:()=>void}) { return <ScrollView contentContainerStyle={styles.page}><TopBar title="How to play" onBack={onBack}/><Text style={styles.sectionTitle}>Win the crown</Text><Text style={styles.body}>Checkmate the opposing king: attack it so there is no legal escape. Tap a piece, then a highlighted square. Castling, en passant, promotion, repetition, stalemate and the fifty-move rule are enforced automatically.</Text><Text style={styles.sectionTitle}>Game modes</Text><Text style={styles.body}>Play the computer offline at three levels, share one device in Pass & Play, or create a private online room. Online games validate every move again in the room transaction.</Text><Text style={styles.sectionTitle}>Hints & fair play</Text><Text style={styles.body}>A rewarded video unlocks an engine suggestion. Hints are intended for casual games; agree with your friend before using them online.</Text></ScrollView>; }

function TopBar({title,onBack,action}:{title:string;onBack:()=>void;action?:React.ReactNode}) { return <View style={styles.topBar}><Pressable accessibilityLabel="Go back" onPress={onBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><Text numberOfLines={1} style={styles.topTitle}>{title}</Text><View style={styles.topSlot}>{action}</View></View>; }

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.background}, home:{flexGrow:1,alignItems:'center',justifyContent:'center',padding:24,gap:8}, brandMark:{width:88,height:88,borderRadius:28,backgroundColor:colors.panel,borderWidth:1,borderColor:colors.goldDark,alignItems:'center',justifyContent:'center',marginBottom:8}, king:{fontSize:54,color:colors.gold}, eyebrow:{color:colors.gold,fontSize:12,fontWeight:'900',letterSpacing:3}, title:{color:colors.text,fontSize:40,fontWeight:'900',letterSpacing:-1.5}, subtitle:{color:colors.muted,fontSize:15,marginBottom:26}, menu:{width:'100%',maxWidth:500,gap:12}, row:{flexDirection:'row',gap:12}, flex:{flex:1}, footer:{color:'#536176',fontSize:12,marginTop:24},
  page:{flex:1,padding:20,gap:20,backgroundColor:colors.background}, topBar:{height:52,flexDirection:'row',alignItems:'center'}, back:{width:44,height:44,alignItems:'center',justifyContent:'center',borderRadius:14,backgroundColor:colors.panel}, backText:{color:colors.text,fontSize:34,lineHeight:37}, topTitle:{flex:1,textAlign:'center',color:colors.text,fontWeight:'800',fontSize:18}, topSlot:{width:64,alignItems:'flex-end'}, topAction:{color:colors.gold,fontWeight:'800'}, centerCard:{marginTop:40,backgroundColor:colors.panel,borderRadius:24,padding:22,gap:16,borderWidth:1,borderColor:'#26334A'}, cardIcon:{fontSize:50,color:colors.gold,textAlign:'center'}, sectionTitle:{color:colors.text,fontSize:22,fontWeight:'900',marginTop:8}, body:{color:colors.muted,fontSize:15,lineHeight:23}, warning:{color:'#FCD34D',fontSize:13,lineHeight:19,backgroundColor:'#3A2B0B',padding:12,borderRadius:12}, divider:{flexDirection:'row',alignItems:'center',gap:10}, line:{height:1,backgroundColor:'#334155',flex:1}, muted:{color:colors.muted,fontSize:12}, codeInput:{height:58,borderRadius:15,borderWidth:1,borderColor:'#40506A',backgroundColor:'#0B1220',color:colors.text,textAlign:'center',fontSize:22,fontWeight:'900',letterSpacing:8}, error:{color:colors.red,textAlign:'center'}, gold:{color:colors.gold,fontWeight:'900'},
  gamePage:{flex:1,paddingHorizontal:12,backgroundColor:colors.background}, playerBar:{minHeight:58,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:8}, playerName:{color:colors.text,fontWeight:'800',fontSize:15}, pieceBadge:{fontSize:30,color:colors.gold}, green:{color:colors.green}, waiting:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:colors.panel,padding:10,borderRadius:12}, notice:{color:colors.blue,textAlign:'center',paddingVertical:5,fontWeight:'700'}, pills:{flexDirection:'row',justifyContent:'center',gap:8,marginBottom:8}, pill:{paddingVertical:6,paddingHorizontal:14,borderRadius:99,backgroundColor:colors.panel}, pillActive:{backgroundColor:colors.goldDark}, pillText:{color:colors.text,textTransform:'capitalize',fontSize:12,fontWeight:'700'}, gameActions:{flexDirection:'row',gap:8,paddingBottom:8}, result:{position:'absolute',left:24,right:24,top:'38%',padding:24,borderRadius:24,backgroundColor:'#111827F2',borderWidth:1,borderColor:colors.gold,gap:18}, resultTitle:{color:colors.text,fontSize:24,fontWeight:'900',textAlign:'center'}, modalShade:{flex:1,justifyContent:'flex-end',backgroundColor:'#000000A0'}, sheet:{maxHeight:'65%',backgroundColor:colors.panel,padding:24,borderTopLeftRadius:28,borderTopRightRadius:28,gap:18}, history:{color:colors.text,fontFamily:'monospace',lineHeight:26,fontSize:16},
  settingsCard:{backgroundColor:colors.panel,borderRadius:20,paddingHorizontal:18}, settingRow:{minHeight:62,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:'#26334A'},
});
