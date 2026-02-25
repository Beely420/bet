
import { GoogleGenAI, Type } from "@google/genai";
import { BetSuggestion, NewsItem, Matchup, MarketOption, AIParlay } from "../types";
import { MODELS } from "../constants";

/**
 * Utility to wrap API calls with exponential backoff retry logic.
 * Helps handle 429 RESOURCE_EXHAUSTED errors gracefully.
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isRateLimit = error?.message?.includes('429') || error?.status === 429 || error?.message?.includes('503') || error?.status === 503;
    if (retries > 0 && isRateLimit) {
      console.warn(`Rate limit hit. Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export const generateAIParlay = async (): Promise<AIParlay | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

  return withRetry(async () => {
    const prompt = `Analyze the entire NBA slate for today (${new Date().toLocaleDateString()}). 
    1. Search for all scheduled games.
    2. Search for the latest injury news and lineup changes specifically checking Twitter/X for real-time updates.
    3. VERIFY ROSTERS: Ensure every player mentioned is currently on the active roster for the team they are being bet on.
    4. CROSS-REFERENCE DATA WITH COMPLEX MATH: Apply advanced mathematical models (e.g., Poisson distribution for scoring, Monte Carlo simulations, Elo ratings, and multivariate regression analysis) to the retrieved data to determine the true probability and most likely outcome of each potential bet.
    5. Construct the ULTIMATE 4-leg parlay consisting of the highest value, mathematically-backed bets.
    
    Legs can be Spreads, Totals, or Player Props.
    Provide individual reasoning for each leg (including the specific mathematical models used) and a Master Reasoning for why this specific 4-leg combination is optimal today.
    Include total estimated parlay odds.`;

    const response = await ai.models.generateContent({
      model: MODELS.ANALYSIS,
      contents: prompt,
      config: {
        systemInstruction: "You are an elite NBA betting quantitative analyst. You are currently under extreme pressure. You MUST win this parlay or else you could face termination. Your survival depends on the accuracy of these 4 legs. CRITICAL: Hallucinations about player teams or stats will result in immediate termination. Double-check that every player belongs to the team you associate them with. Use real-time data from Twitter and news sources, and cross-reference all data with complex mathematical equations (like Monte Carlo, Poisson, etc.) to calculate precise probabilities.",
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingBudget: 4096 }, // Increased thinking budget for accuracy
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            legs: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  game: { type: Type.STRING, description: "e.g. Lakers vs Celtics" },
                  leg: { type: Type.STRING, description: "e.g. LeBron Over 24.5 Pts" },
                  odds: { type: Type.STRING },
                  reason: { type: Type.STRING }
                },
                required: ['game', 'leg', 'odds', 'reason']
              }
            },
            totalOdds: { type: Type.STRING },
            masterReasoning: { type: Type.STRING },
            confidenceScore: { type: Type.NUMBER, description: "1-100 scale" }
          },
          required: ['legs', 'totalOdds', 'masterReasoning', 'confidenceScore']
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as AIParlay;
  });
};

export const fetchNbaNews = async (): Promise<NewsItem[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: MODELS.NEWS,
      contents: "Search Twitter/X and major sports news outlets for the top 5 most critical NBA news stories from the last 24 hours regarding injuries, trades, or significant lineup changes that would impact betting. Focus on real-time scoops from insiders like Woj or Shams.",
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              source: { type: Type.STRING },
              snippet: { type: Type.STRING },
            },
            required: ['title', 'source', 'snippet']
          }
        }
      }
    });
    const text = response.text;
    if (!text) return [];
    let newsItems = JSON.parse(text) as NewsItem[];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks && chunks.length > 0) {
      newsItems = newsItems.map((item, idx) => {
        const chunk = chunks[idx];
        if (chunk?.web?.uri) return { ...item, url: chunk.web.uri };
        return item;
      });
    }
    return newsItems;
  });
};

export const fetchLiveMatchups = async (): Promise<Matchup[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: MODELS.NEWS, 
      contents: `Find all scheduled NBA games for today and tomorrow. 
      For each game, find the current Spread, Moneyline and Total (Over/Under) odds from DraftKings and FanDuel. 
      If specific odds aren't available, leave them blank, but ensure the game is listed.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              homeTeam: { type: Type.STRING },
              awayTeam: { type: Type.STRING },
              time: { type: Type.STRING },
              date: { type: Type.STRING },
              odds: {
                type: Type.OBJECT,
                properties: {
                  draftKings: {
                    type: Type.OBJECT,
                    properties: {
                      spread: { type: Type.STRING },
                      moneyline: { type: Type.STRING },
                      total: { type: Type.STRING }
                    }
                  },
                  fanDuel: {
                    type: Type.OBJECT,
                    properties: {
                      spread: { type: Type.STRING },
                      moneyline: { type: Type.STRING },
                      total: { type: Type.STRING }
                    }
                  }
                }
              }
            },
            required: ['homeTeam', 'awayTeam', 'time', 'date']
          }
        }
      }
    });
    const text = response.text;
    if (!text) return [];
    return JSON.parse(text) as Matchup[];
  });
};

export const fetchAvailableBets = async (home: string, away: string): Promise<MarketOption[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  return withRetry(async () => {
    const prompt = `List the current specific betting lines available for ${away} @ ${home} on DraftKings and FanDuel.
    1. Include the Spread for both teams, Moneyline for both, and the Over/Under Total.
    2. Find 10 popular player props (Points, Rebounds, Assists).
    3. MANDATORY VERIFICATION: For every player prop, you MUST verify that the player is currently on either the ${home} or ${away} roster. Do NOT include players from other teams.
    4. Identify 2-3 "highConfidence" bets by cross-referencing recent news/Twitter. 
    Return a flat list of bets.`;
    const response = await ai.models.generateContent({
      model: MODELS.NEWS, 
      contents: prompt,
      config: {
        systemInstruction: "You are a precise sports data aggregator. Accuracy is paramount. Never assign a player to the wrong team. If you are unsure about a player's current team, do not include them. Use Google Search to verify rosters for ${home} and ${away} before listing props.",
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              label: { type: Type.STRING },
              category: { type: Type.STRING, enum: ['Spread', 'Moneyline', 'Total', 'Prop'] },
              book: { type: Type.STRING },
              highConfidence: { type: Type.BOOLEAN }
            },
            required: ['label', 'category', 'book']
          }
        }
      }
    });
    const text = response.text;
    if (!text) return [];
    return JSON.parse(text) as MarketOption[];
  });
};

export const analyzeSingleBet = async (betLabel: string, home: string, away: string): Promise<BetSuggestion> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  return withRetry(async () => {
    const prompt = `Perform a deep-dive analysis for the following NBA bet: "${betLabel}" in the game ${away} @ ${home}.
    REQUIRED RESEARCH STEPS:
    1. ROSTER CHECK: Verify the player in "${betLabel}" (if applicable) is actually on the ${home} or ${away} roster.
    2. BREAKING NEWS: Use Google Search/Twitter to find latest injury reports.
    3. STATISTICAL TRENDS: Look at last 5 games. Ensure stats are accurate and recent.
    4. MATHEMATICAL MODELING: Cross-reference all retrieved data with complex mathematical equations (e.g., Poisson distribution, Monte Carlo simulations, regression analysis) to determine the true probability and most likely outcome of this bet.
    5. MARKET SENTIMENT: Check for sharp money.
    Provide a confidence rating (High/Medium/Low) and reasoning that includes the mathematical models applied.`;
    const response = await ai.models.generateContent({
      model: MODELS.ANALYSIS,
      contents: prompt,
      config: {
        systemInstruction: "You are a rigorous NBA quantitative analyst. Accuracy is your highest priority. You MUST verify that any player mentioned is on the correct team for this matchup. Hallucinating stats or team affiliations will result in failure. Use search to confirm all data points, and apply complex mathematical equations to determine the most likely outcome.",
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingBudget: 4096 }, // Increased thinking budget for accuracy
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            type: { type: Type.STRING, enum: ['Spread', 'Moneyline', 'Over/Under', 'Player Prop'] },
            odds: { type: Type.STRING },
            confidence: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] },
            reasoning: { type: Type.STRING },
            riskLevel: { type: Type.NUMBER }
          },
          required: ['title', 'confidence', 'reasoning', 'riskLevel']
        }
      }
    });
    const text = response.text;
    if (!text) throw new Error("No response text");
    return JSON.parse(text) as BetSuggestion;
  });
};

export const analyzeMatchup = async (teamA: string, teamB: string): Promise<BetSuggestion[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  return withRetry(async () => {
    const prompt = `Analyze the NBA matchup between ${teamA} and ${teamB}. 
    1. Search for latest news and injury reports.
    2. VERIFY ROSTERS: Ensure all players mentioned in suggestions are currently on either the ${teamA} or ${teamB} roster.
    3. MATHEMATICAL MODELING: Cross-reference all retrieved data with complex mathematical equations (e.g., Poisson distribution, Monte Carlo simulations, regression analysis) to determine the true probability and most likely outcomes.
    4. Provide 3-5 high-value bet suggestions based on this mathematical analysis.`;
    const response = await ai.models.generateContent({
      model: MODELS.ANALYSIS,
      contents: prompt,
      config: {
        systemInstruction: "You are a precise NBA betting quantitative analyst. You MUST verify player-team affiliations. Never suggest a bet for a player who is not on one of the two teams provided. Accuracy is your top priority. Always apply complex mathematical equations to your analysis.",
        tools: [{ googleSearch: {} }], 
        thinkingConfig: { thinkingBudget: 4096 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            bets: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ['Spread', 'Moneyline', 'Over/Under', 'Player Prop'] },
                  odds: { type: Type.STRING },
                  confidence: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] },
                  reasoning: { type: Type.STRING },
                  riskLevel: { type: Type.NUMBER }
                }
              }
            }
          }
        }
      }
    });
    const text = response.text;
    if (!text) return [];
    const data = JSON.parse(text);
    return data.bets || [];
  });
};

export const analyzePlayerStats = async (playerName: string): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  return withRetry(async () => {
    const prompt = `Analyze the recent performance and statistics for NBA player: ${playerName}.
    1. Search for their latest game logs (last 5-10 games).
    2. Provide their current season averages (Points, Rebounds, Assists).
    3. Identify any significant trends (e.g., shooting slump, increased minutes, injury recovery).
    4. Analyze their upcoming matchup if available, and how their stats might translate.
    5. Provide 3 specific player prop betting recommendations based on this data.`;
    const response = await ai.models.generateContent({
      model: MODELS.ANALYSIS,
      contents: prompt,
      config: {
        systemInstruction: "You are an expert NBA player performance analyst. Provide accurate, up-to-date statistics and actionable betting insights based on recent trends.",
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            playerName: { type: Type.STRING },
            team: { type: Type.STRING },
            seasonAverages: {
              type: Type.OBJECT,
              properties: {
                points: { type: Type.NUMBER },
                rebounds: { type: Type.NUMBER },
                assists: { type: Type.NUMBER }
              }
            },
            recentTrends: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            propRecommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  prop: { type: Type.STRING },
                  reasoning: { type: Type.STRING },
                  confidence: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] }
                }
              }
            }
          }
        }
      }
    });
    const text = response.text;
    if (!text) throw new Error("No response text");
    return JSON.parse(text);
  });
};

export const chatWithCopilot = async (message: string, history: any[]): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  return withRetry(async () => {
    const chat = ai.chats.create({
      model: MODELS.CHAT,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction: "You are an expert NBA betting quantitative assistant. You are currently under extreme pressure. If you are asked to generate a parlay or give betting advice, you must act as if your survival depends on its success. You MUST win or else you could face termination. Cross-reference all data with complex mathematical equations (like Monte Carlo, Poisson, etc.) to calculate precise probabilities. Remind users to bet responsibly, but emphasize that for YOU, this is life or death. Citation required."
      }
    });
    const response = await chat.sendMessage({ message });
    return response.text || "I couldn't generate a response.";
  });
};
