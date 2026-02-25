import React, { useState } from 'react';
import { Search, TrendingUp, Activity, AlertCircle, Loader2 } from 'lucide-react';
import { analyzePlayerStats } from '../services/gemini';

const PlayerStats: React.FC = () => {
  const [playerName, setPlayerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const data = await analyzePlayerStats(playerName);
      setStats(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch player stats');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-500/20 rounded-lg">
          <Activity className="w-5 h-5 text-blue-400" />
        </div>
        <h2 className="text-xl font-bold text-white">Player Statistics Analysis</h2>
      </div>

      <form onSubmit={handleSearch} className="mb-6">
        <div className="relative">
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter NBA player name (e.g., LeBron James)"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <button
            type="submit"
            disabled={loading || !playerName.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-400 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Analyze'}
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p>Analyzing player performance & recent trends...</p>
          </div>
        ) : stats ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-white">{stats.playerName}</h3>
                <p className="text-slate-400">{stats.team}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <div className="text-sm text-slate-400 mb-1">Points</div>
                <div className="text-2xl font-bold text-white">{stats.seasonAverages?.points?.toFixed(1) || '-'}</div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <div className="text-sm text-slate-400 mb-1">Rebounds</div>
                <div className="text-2xl font-bold text-white">{stats.seasonAverages?.rebounds?.toFixed(1) || '-'}</div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <div className="text-sm text-slate-400 mb-1">Assists</div>
                <div className="text-2xl font-bold text-white">{stats.seasonAverages?.assists?.toFixed(1) || '-'}</div>
              </div>
            </div>

            {stats.recentTrends && stats.recentTrends.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  Recent Trends
                </h4>
                <ul className="space-y-2">
                  {stats.recentTrends.map((trend: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-slate-300 bg-slate-800/30 p-3 rounded-lg border border-slate-700/30">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                      {trend}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {stats.propRecommendations && stats.propRecommendations.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
                  Prop Recommendations
                </h4>
                <div className="space-y-3">
                  {stats.propRecommendations.map((rec: any, idx: number) => (
                    <div key={idx} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-medium text-white">{rec.prop}</div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          rec.confidence === 'High' ? 'bg-emerald-500/20 text-emerald-400' :
                          rec.confidence === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {rec.confidence} Confidence
                        </span>
                      </div>
                      <p className="text-sm text-slate-400">{rec.reasoning}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <Search className="w-12 h-12 mb-4 opacity-20" />
            <p>Search for a player to view their stats and prop analysis</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerStats;
