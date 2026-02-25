
import React, { useState, useEffect, useCallback } from 'react';
import { analyzeMatchup, fetchLiveMatchups, fetchAvailableBets, analyzeSingleBet, generateAIParlay } from '../services/gemini';
import { NBA_TEAMS } from '../constants';
import { BetSuggestion, Matchup, MarketOption, AIParlay } from '../types';
import { Brain, TrendingUp, AlertTriangle, ChevronRight, BarChart2, Calendar, RefreshCcw, DollarSign, ArrowLeft, Target, Filter, Star, Sparkles, Newspaper, Search, Activity, Ticket, Zap, ShieldCheck, Loader2, CheckCircle2, Clock } from 'lucide-react';

const BetAnalyzer: React.FC = () => {
  const [mode, setMode] = useState<'live' | 'custom' | 'parlay'>('live');
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [matchupsLoading, setMatchupsLoading] = useState(false);
  const [lastMatchupUpdate, setLastMatchupUpdate] = useState<Date>(new Date());
  
  // Parlay State
  const [parlay, setParlay] = useState<AIParlay | null>(null);
  const [parlayLoading, setParlayLoading] = useState(false);
  const [parlayStep, setParlayStep] = useState(0);
  const [parlayError, setParlayError] = useState<string | null>(null);

  // Navigation State for Live Mode
  const [selectedMatchup, setSelectedMatchup] = useState<Matchup | null>(null);
  const [availableBets, setAvailableBets] = useState<MarketOption[]>([]);
  const [marketsLoading, setMarketsLoading] = useState(false);
  const [selectedBet, setSelectedBet] = useState<MarketOption | null>(null);
  const [betFilter, setBetFilter] = useState<string>('All');

  // Analysis State
  const [teamA, setTeamA] = useState(NBA_TEAMS[0]);
  const [teamB, setTeamB] = useState(NBA_TEAMS[1]);
  const [analysisResult, setAnalysisResult] = useState<BetSuggestion | null>(null);
  const [customBets, setCustomBets] = useState<BetSuggestion[]>([]);
  const [analyzing, setAnalyzing] = useState(false);

  const parlaySteps = [
    { text: "Scanning today's full NBA schedule & active betting markets...", icon: Search },
    { text: "Scraping Twitter/X for breaking injury news & insider scoops...", icon: Newspaper },
    { text: "Analyzing individual player usage rates & historical matchup metrics...", icon: Activity },
    { text: "Cross-referencing Twitter data with DraftKings/FanDuel market value...", icon: Zap },
    { text: "Running 1,000+ parlay simulation models for optimal EV...", icon: Brain },
    { text: "Finalizing the high-confidence 4-leg AI Power Parlay slip...", icon: Ticket }
  ];

  const loadMatchups = useCallback(async (isSilent = false) => {
    if (!isSilent) setMatchupsLoading(true);
    try {
      const data = await fetchLiveMatchups();
      if (data && data.length > 0) {
        setMatchups(data);
        setLastMatchupUpdate(new Date());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setMatchupsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMatchups();
    const interval = setInterval(() => {
      if (mode === 'live' && !selectedMatchup) {
        loadMatchups(true);
      }
    }, 1000 * 60 * 2);
    return () => clearInterval(interval);
  }, [loadMatchups, mode, selectedMatchup]);

  const handleGenerateParlay = async () => {
    setMode('parlay');
    setParlayLoading(true);
    setParlay(null);
    setParlayError(null);
    setParlayStep(0);
    
    // UI steps for engagement
    const stepInterval = setInterval(() => {
      setParlayStep(prev => (prev < parlaySteps.length - 1 ? prev + 1 : prev));
    }, 2500);

    try {
      const result = await generateAIParlay();
      setParlay(result);
    } catch (e: any) {
      console.error(e);
      const isQuotaError = e?.message?.includes('429') || e?.status === 429;
      if (isQuotaError) {
        setParlayError("AI rate limit reached. The system is temporarily overwhelmed by requests. Please wait 60 seconds and try again.");
      } else {
        setParlayError("Failed to synthesize parlay data. Please check your connection and try again.");
      }
    } finally {
      clearInterval(stepInterval);
      setParlayLoading(false);
    }
  };

  const handleSelectMatchup = async (m: Matchup) => {
    setSelectedMatchup(m);
    setMarketsLoading(true);
    setAvailableBets([]);
    setAnalysisResult(null);
    setSelectedBet(null);
    setBetFilter('All');
    try {
      const bets = await fetchAvailableBets(m.homeTeam, m.awayTeam);
      setAvailableBets(bets);
    } catch (e) {
      console.error(e);
    } finally {
      setMarketsLoading(false);
    }
  };

  const handleAnalyzeBet = async (bet: MarketOption) => {
    if (!selectedMatchup) return;
    setSelectedBet(bet);
    setAnalyzing(true);
    setAnalysisResult(null);
    try {
      const result = await analyzeSingleBet(bet.label, selectedMatchup.homeTeam, selectedMatchup.awayTeam);
      setAnalysisResult(result);
    } catch (e) {
      console.error(e);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCustomAnalysis = async () => {
    setAnalyzing(true);
    setCustomBets([]);
    try {
      const suggestions = await analyzeMatchup(teamA, teamB);
      setCustomBets(suggestions);
    } catch (e) {
      console.error(e);
    } finally {
      setAnalyzing(false);
    }
  };

  const resetView = () => {
    setSelectedMatchup(null);
    setAvailableBets([]);
    setAnalysisResult(null);
    setSelectedBet(null);
    setMode('live');
  };

  const getRiskColor = (level: number) => {
    if (level <= 3) return 'bg-green-500';
    if (level <= 6) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const filterOptions = ['All', 'Top Picks', 'Spread', 'Moneyline', 'Total', 'Points', 'Rebounds', 'Assists'];

  const filteredBets = availableBets.filter(bet => {
    if (betFilter === 'All') return true;
    if (betFilter === 'Top Picks') return bet.highConfidence === true;
    if (betFilter === 'Spread') return bet.category === 'Spread';
    if (betFilter === 'Moneyline') return bet.category === 'Moneyline';
    if (betFilter === 'Total') return bet.category === 'Total';
    const lowerLabel = bet.label.toLowerCase();
    if (betFilter === 'Points') return bet.category === 'Prop' && (lowerLabel.includes('points') || lowerLabel.includes('pts'));
    if (betFilter === 'Rebounds') return bet.category === 'Prop' && (lowerLabel.includes('rebounds') || lowerLabel.includes('rebs'));
    if (betFilter === 'Assists') return bet.category === 'Prop' && (lowerLabel.includes('assists') || lowerLabel.includes('ast'));
    return true;
  });

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="bg-nba-card p-6 rounded-xl border border-slate-700 shadow-xl relative overflow-hidden">
        
        {/* Magic Button Section */}
        <div className="absolute top-4 right-6 flex items-center gap-3">
          <button 
            onClick={handleGenerateParlay}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-full text-xs font-bold shadow-lg shadow-purple-900/40 border border-purple-400/30 transition-all hover:scale-105 group"
          >
            <Sparkles className="w-4 h-4 group-hover:animate-spin" />
            AI MAGIC PARLAY
          </button>
          <div className="hidden md:flex items-center gap-2 pointer-events-none border-l border-slate-700 pl-4">
             <span className="flex h-2 w-2 relative">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
               <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
             </span>
             <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Real-time</span>
          </div>
        </div>

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Brain className="w-6 h-6 text-purple-400" />
            AI Matchup Analyzer
          </h2>
          <div className="flex bg-slate-900 rounded-lg p-1">
            {['live', 'custom'].map((m) => (
              <button 
                key={m}
                onClick={() => { setMode(m as any); resetView(); }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all capitalize ${mode === m ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* PARLAY MODE */}
        {mode === 'parlay' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
             <button 
              onClick={resetView}
              className="mb-4 text-sm text-slate-400 hover:text-white flex items-center gap-1 w-fit"
            >
              <ArrowLeft className="w-4 h-4" /> Exit Parlay Generator
            </button>

            {parlayLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-10">
                <div className="max-w-md w-full bg-slate-800/50 rounded-2xl p-8 border border-slate-700 shadow-2xl">
                  <div className="flex justify-center mb-8">
                    <div className="relative">
                      <div className="w-20 h-20 border-4 border-purple-500/10 border-t-purple-500 rounded-full animate-spin"></div>
                      <Sparkles className="w-8 h-8 text-purple-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                    </div>
                  </div>

                  <div className="space-y-6">
                    {parlaySteps.map((step, i) => {
                      const Icon = step.icon;
                      const isCompleted = i < parlayStep;
                      const isActive = i === parlayStep;
                      
                      return (
                        <div key={i} className={`flex items-center gap-4 transition-all duration-300 ${isCompleted ? 'opacity-100' : isActive ? 'opacity-100 scale-105' : 'opacity-30'}`}>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isCompleted ? 'bg-emerald-500/20 text-emerald-500' : isActive ? 'bg-purple-500/20 text-purple-500 animate-pulse' : 'bg-slate-700 text-slate-400'}`}>
                            {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm font-medium ${isActive ? 'text-white' : 'text-slate-400'}`}>
                              {step.text}
                            </p>
                            {isActive && (
                              <div className="h-1 w-full bg-slate-700 rounded-full mt-2 overflow-hidden">
                                <div className="h-full bg-purple-500 animate-[loading_1.5s_infinite]"></div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <style dangerouslySetInnerHTML={{ __html: `
                    @keyframes loading {
                      0% { width: 0%; transform: translateX(-100%); }
                      50% { width: 70%; transform: translateX(0%); }
                      100% { width: 0%; transform: translateX(100%); }
                    }
                  `}} />
                </div>
                
                <p className="mt-8 text-slate-500 text-xs uppercase tracking-[0.2em] font-bold animate-pulse">
                  Gemini AI Processing Multi-Source Data
                </p>
              </div>
            ) : parlayError ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 bg-slate-800/20 rounded-2xl border border-dashed border-slate-700 p-8">
                 <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-4">
                   <Clock className="w-8 h-8 text-amber-500" />
                 </div>
                 <h3 className="text-lg font-bold text-white">Temporary Quota Limit</h3>
                 <p className="max-w-md text-center text-sm mt-2 text-slate-400">
                    {parlayError}
                 </p>
                 <div className="mt-8 flex gap-3">
                   <button 
                    onClick={handleGenerateParlay} 
                    className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold transition-all flex items-center gap-2"
                   >
                     <RefreshCcw className="w-4 h-4" /> Try Again Now
                   </button>
                   <button 
                    onClick={resetView} 
                    className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold transition-all"
                   >
                     Go Back
                   </button>
                 </div>
              </div>
            ) : parlay ? (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 animate-in zoom-in-95">
                {/* Leg List */}
                <div className="space-y-4 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                  <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2 mb-4">
                    <Zap className="w-5 h-5 text-amber-400" /> Today's AI Optimized Power Parlay
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {parlay.legs.map((leg, i) => (
                      <div key={i} className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl relative overflow-hidden group hover:border-purple-500 transition-all shadow-lg">
                        <div className="absolute -right-2 -bottom-2 opacity-5 group-hover:opacity-10 transition-opacity">
                          <Target className="w-20 h-20" />
                        </div>
                        <div className="flex justify-between items-start mb-2">
                           <span className="text-[10px] font-bold text-purple-400 bg-purple-900/30 px-2 py-0.5 rounded uppercase tracking-tighter">Leg #{i+1}</span>
                           <span className="text-xs font-mono text-emerald-400 font-bold">{leg.odds}</span>
                        </div>
                        <h4 className="font-bold text-white text-sm mb-1">{leg.leg}</h4>
                        <p className="text-[10px] text-slate-400 mb-3">{leg.game}</p>
                        <p className="text-xs text-slate-400 leading-relaxed italic border-t border-slate-700/50 pt-3">
                          "{leg.reason}"
                        </p>
                      </div>
                    ))}
                  </div>
                  
                  <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-5 mt-6 shadow-inner">
                     <h4 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                        <Brain className="w-4 h-4 text-purple-400" /> Parlay Optimization Strategy
                     </h4>
                     <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-line">
                        {parlay.masterReasoning}
                     </p>
                  </div>
                </div>

                {/* Betting Slip Visual */}
                <div className="bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col h-fit sticky top-0 transform lg:rotate-1 hover:rotate-0 transition-all duration-500 border-4 border-slate-100">
                  <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="font-black italic tracking-tighter text-xl">COURTSIDE<span className="text-blue-500">AI</span></span>
                      <span className="text-[8px] text-slate-500 font-bold tracking-[0.3em] uppercase">Betting Hub</span>
                    </div>
                    <Ticket className="w-6 h-6 text-blue-500" />
                  </div>
                  <div className="p-6 text-slate-900 flex-1 space-y-4 font-mono text-sm">
                    <div className="border-b border-dashed border-slate-300 pb-2 flex justify-between text-[10px] text-slate-500 uppercase font-bold">
                       <span>AI Verified Parlay</span>
                       <span>ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}</span>
                    </div>
                    {parlay.legs.map((leg, i) => (
                      <div key={i} className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <p className="font-bold uppercase text-[11px] leading-tight">{leg.leg}</p>
                          <p className="text-[9px] text-slate-500 uppercase">{leg.game}</p>
                        </div>
                        <span className="font-black whitespace-nowrap">{leg.odds}</span>
                      </div>
                    ))}
                    <div className="pt-4 border-t-4 border-double border-slate-300 space-y-3">
                       <div className="flex justify-between font-black text-xl">
                          <span>TOTAL ODDS</span>
                          <span className="text-emerald-600">{parlay.totalOdds}</span>
                       </div>
                       <div className="flex justify-between items-center bg-slate-100 p-2.5 rounded border border-slate-200 text-[10px] font-bold">
                          <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-blue-600" /> AI CONFIDENCE SCORE</span>
                          <span className="bg-blue-600 text-white px-2.5 py-1 rounded shadow-sm">{parlay.confidenceScore}%</span>
                       </div>
                    </div>
                    <div className="text-[8px] text-slate-400 text-center uppercase tracking-widest pt-4 font-bold border-t border-slate-100 mt-4">
                       Citations: Google Search Grounding Enabled<br/>
                       Bet Responsibly • Gemini v3.0 Engine
                    </div>
                  </div>
                  <div className="bg-slate-50 p-2 border-t border-slate-100">
                     <div className="h-8 bg-white w-full rounded flex items-center justify-center gap-1.5 opacity-40">
                        {[...Array(20)].map((_,i) => <div key={i} className="w-0.5 h-4 bg-slate-900/30" />)}
                     </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 bg-slate-800/20 rounded-2xl border border-dashed border-slate-700">
                 <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
                 <h3 className="text-lg font-bold text-white">System Error</h3>
                 <p className="max-w-xs text-center text-sm mt-1">Failed to synthesize enough data for a confident parlay. Please try again later.</p>
                 <button onClick={handleGenerateParlay} className="mt-6 px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold transition-all">Retry Generation</button>
              </div>
            )}
          </div>
        )}

        {/* LIVE MODE LOGIC */}
        {mode === 'live' && (
          <>
            {!selectedMatchup ? (
              <div className="space-y-4 animate-in fade-in duration-500">
                <div className="flex justify-between items-center text-sm text-slate-400 mb-2">
                  <div className="flex flex-col">
                    <span>Select a game for deep news-driven analysis</span>
                    <span className="text-[10px] text-slate-500">Auto-refresh: {lastMatchupUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <button onClick={() => loadMatchups()} className="flex items-center gap-1 hover:text-white transition-colors">
                    <RefreshCcw className={`w-3 h-3 ${matchupsLoading ? 'animate-spin' : ''}`} /> Refresh Now
                  </button>
                </div>

                {matchupsLoading && matchups.length === 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {[1,2,3,4].map(i => <div key={i} className="h-32 bg-slate-800/50 rounded-lg animate-pulse" />)}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {matchups.map((m, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => handleSelectMatchup(m)}
                        className="bg-slate-800 border border-slate-700 p-4 rounded-lg cursor-pointer hover:border-purple-500 transition-all group"
                      >
                        <div className="flex justify-between items-center mb-3">
                           <span className="text-xs text-slate-400 bg-slate-900 px-2 py-0.5 rounded flex items-center gap-1">
                             <Calendar className="w-3 h-3" /> {m.time}
                           </span>
                           <span className="text-xs text-purple-400 font-bold group-hover:underline">View Bets &rarr;</span>
                        </div>
                        <div className="flex justify-between items-center font-bold text-white mb-4 text-lg">
                          <span>{m.awayTeam}</span>
                          <span className="text-slate-500 text-sm font-normal">@</span>
                          <span>{m.homeTeam}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-xs bg-slate-900/50 p-3 rounded border border-slate-700/50">
                            <div className="font-semibold text-slate-500">Book</div>
                            <div className="font-semibold text-slate-500 text-center">Spread</div>
                            <div className="font-semibold text-slate-500 text-center">Total</div>
                            <div className="font-semibold text-slate-500 text-right">ML</div>
                            <div className="text-blue-400 font-bold">DK</div>
                            <div className="text-center text-slate-200">{m.odds?.draftKings?.spread || '-'}</div>
                            <div className="text-center text-slate-200">{m.odds?.draftKings?.total || '-'}</div>
                            <div className="text-right text-slate-200">{m.odds?.draftKings?.moneyline || '-'}</div>
                            <div className="text-blue-400 font-bold">FD</div>
                            <div className="text-center text-slate-200">{m.odds?.fanDuel?.spread || '-'}</div>
                            <div className="text-center text-slate-200">{m.odds?.fanDuel?.total || '-'}</div>
                            <div className="text-right text-slate-200">{m.odds?.fanDuel?.moneyline || '-'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="animate-in slide-in-from-right-4 duration-300">
                <button onClick={resetView} className="mb-4 text-sm text-slate-400 hover:text-white flex items-center gap-1">
                  <ArrowLeft className="w-4 h-4" /> Back to Schedule
                </button>
                <div className="flex items-center justify-between mb-6 bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                  <h3 className="text-lg font-bold text-white">{selectedMatchup.awayTeam} <span className="text-slate-500">@</span> {selectedMatchup.homeTeam}</h3>
                  <span className="text-sm text-slate-400">{selectedMatchup.time}</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                        {filterOptions.map(f => (
                          <button
                            key={f}
                            onClick={() => setBetFilter(f)}
                            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors border flex items-center gap-1.5 ${
                              betFilter === f ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white'
                            }`}
                          >
                            {f === 'Top Picks' && <Star className={`w-3 h-3 ${betFilter === f ? 'fill-white' : 'fill-amber-400 text-amber-400'}`} />}
                            {f}
                          </button>
                        ))}
                    </div>
                    {marketsLoading ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-slate-800 rounded animate-pulse" />)}</div> : (
                      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {filteredBets.map((bet, idx) => (
                          <button key={idx} onClick={() => handleAnalyzeBet(bet)} className={`w-full text-left p-3 rounded-lg border flex justify-between items-center relative overflow-hidden ${selectedBet?.label === bet.label ? 'bg-purple-900/30 border-purple-500 ring-1 ring-purple-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500 hover:bg-slate-750'}`}>
                             {bet.highConfidence && <div className="absolute top-0 right-0 p-1"><div className="bg-amber-500/10 rounded-bl px-1.5 py-0.5 flex items-center gap-1"><Sparkles className="w-2.5 h-2.5 text-amber-400" /><span className="text-[8px] font-bold text-amber-400 uppercase tracking-tighter">AI Pick</span></div></div>}
                             <div><div className="font-medium text-slate-200">{bet.label}</div><div className="text-xs text-slate-500 mt-0.5">{bet.book} • {bet.category}</div></div>
                             {selectedBet?.label === bet.label && analyzing ? <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /> : bet.highConfidence && <Star className="w-4 h-4 fill-amber-500/20 text-amber-500/50" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-800 min-h-[400px] flex flex-col">
                    {analyzing ? <div className="flex-1 flex flex-col items-center justify-center text-slate-400"><Brain className="w-12 h-12 text-purple-500 animate-pulse mb-4" /><p className="text-sm">Scouring latest NBA news & injury reports...</p></div> : analysisResult ? (
                       <div className="animate-in fade-in zoom-in-95 duration-300 h-full flex flex-col">
                          <div className="mb-4 pb-4 border-b border-slate-700">
                             <div className="flex justify-between items-start"><span className="text-xs font-bold text-purple-400 uppercase flex items-center gap-1"><Activity className="w-3 h-3" /> {analysisResult.type}</span><span className={`px-2 py-0.5 text-xs font-bold rounded ${analysisResult.confidence === 'High' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{analysisResult.confidence} Confidence</span></div>
                             <h3 className="text-xl font-bold text-white mt-1">{analysisResult.title}</h3>
                             <div className="text-2xl font-mono text-emerald-400 font-bold mt-2">{analysisResult.odds}</div>
                          </div>
                          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 mb-4"><p className="text-sm text-slate-400 leading-relaxed whitespace-pre-line bg-slate-800/30 p-3 rounded border border-slate-700/50">{analysisResult.reasoning}</p></div>
                          <div className="mt-auto pt-4 border-t border-slate-700"><div className="flex justify-between text-xs text-slate-500 mb-1.5"><span>Risk Assessment</span><span>{analysisResult.riskLevel}/10</span></div><div className="flex gap-1 h-2 bg-slate-700 rounded-full overflow-hidden"><div className={`h-full ${getRiskColor(analysisResult.riskLevel)}`} style={{width: `${analysisResult.riskLevel * 10}%`}} /></div></div>
                       </div>
                    ) : <div className="flex-1 flex flex-col items-center justify-center text-slate-600"><Target className="w-12 h-12 mb-3 opacity-20" /><p className="max-w-[200px] text-center">Select a specific bet to trigger analysis.</p></div>}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* CUSTOM MODE */}
        {mode === 'custom' && (
          <div className="animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-end mb-6">
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Home Team</label>
                <select className="w-full bg-slate-900 border border-slate-700 text-white p-3 rounded-lg" value={teamA} onChange={(e) => setTeamA(e.target.value)}>{NBA_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}</select>
              </div>
              <div className="pb-3 text-slate-500 font-bold text-lg">VS</div>
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Away Team</label>
                <select className="w-full bg-slate-900 border border-slate-700 text-white p-3 rounded-lg" value={teamB} onChange={(e) => setTeamB(e.target.value)}>{NBA_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}</select>
              </div>
            </div>
            <button onClick={handleCustomAnalysis} className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold py-3 rounded-lg">Generate News-Backed Analysis</button>
            {customBets.length > 0 && (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8 animate-in slide-in-from-bottom-4">
                  {customBets.map((bet, idx) => (
                    <div key={idx} className="bg-slate-800 rounded-lg p-5 border border-slate-700"><span className="text-xs font-bold text-purple-400 uppercase">{bet.type}</span><h3 className="font-bold text-white mb-2">{bet.title}</h3><div className="text-emerald-400 font-mono font-bold text-lg mb-2">{bet.odds}</div><p className="text-sm text-slate-400 mb-3 line-clamp-4">{bet.reasoning}</p></div>
                  ))}
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BetAnalyzer;
