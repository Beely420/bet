export interface NewsItem {
  title: string;
  source: string;
  url: string;
  snippet: string;
  timestamp?: string;
}

export interface BetSuggestion {
  title: string;
  type: 'Spread' | 'Moneyline' | 'Over/Under' | 'Player Prop';
  odds: string;
  confidence: 'High' | 'Medium' | 'Low';
  reasoning: string;
  riskLevel: number; // 1-10
}

export interface ParlayLeg {
  game: string;
  leg: string;
  odds: string;
  reason: string;
}

export interface AIParlay {
  legs: ParlayLeg[];
  totalOdds: string;
  masterReasoning: string;
  confidenceScore: number;
}

export interface PlayerStat {
  name: string;
  points: number;
  rebounds: number;
  assists: number;
  date: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isThinking?: boolean;
}

export enum AnalysisMode {
  MATCHUP = 'MATCHUP',
  PLAYER = 'PLAYER',
  GENERAL = 'GENERAL'
}

export interface Matchup {
  homeTeam: string;
  awayTeam: string;
  time: string;
  date: string;
  odds?: {
    draftKings?: {
      spread?: string;
      moneyline?: string;
      total?: string;
    };
    fanDuel?: {
      spread?: string;
      moneyline?: string;
      total?: string;
    };
  };
}

export interface MarketOption {
  id: string;
  label: string;
  category: 'Spread' | 'Moneyline' | 'Total' | 'Prop';
  book: string;
  highConfidence?: boolean;
}