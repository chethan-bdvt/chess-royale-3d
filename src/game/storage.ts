import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GameSettings, SavedGame } from '../types';

const SAVE_KEY = 'chess-royale:active-game';
const SETTINGS_KEY = 'chess-royale:settings';
const STATS_KEY = 'chess-royale:stats';

export const defaultSettings: GameSettings = {
  haptics: true,
  showLegalMoves: true,
  autoRotate: true,
};

export interface Stats { played: number; won: number; draws: number; hints: number }

export async function saveGame(game: SavedGame) {
  await AsyncStorage.setItem(SAVE_KEY, JSON.stringify(game));
}

export async function loadGame(): Promise<SavedGame | null> {
  const value = await AsyncStorage.getItem(SAVE_KEY);
  return value ? JSON.parse(value) as SavedGame : null;
}

export async function clearSavedGame() { await AsyncStorage.removeItem(SAVE_KEY); }

export async function loadSettings(): Promise<GameSettings> {
  const value = await AsyncStorage.getItem(SETTINGS_KEY);
  return value ? { ...defaultSettings, ...JSON.parse(value) } : defaultSettings;
}

export async function saveSettings(settings: GameSettings) {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function loadStats(): Promise<Stats> {
  const value = await AsyncStorage.getItem(STATS_KEY);
  return value ? JSON.parse(value) as Stats : { played: 0, won: 0, draws: 0, hints: 0 };
}

export async function saveStats(stats: Stats) {
  await AsyncStorage.setItem(STATS_KEY, JSON.stringify(stats));
}
