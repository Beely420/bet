
import React, { useState, useEffect } from 'react';
import NewsFeed from './components/NewsFeed';
import BetAnalyzer from './components/BetAnalyzer';
import Copilot from './components/Copilot';
import PlayerStats from './components/PlayerStats';
import { Activity, LayoutDashboard, MessageSquare, User, Key } from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<'dashboard' | 'chat' | 'playerStats'>('dashboard');
  const [hasKey, setHasKey] = useState(true);

  useEffect(() => {
    const checkKey = async () => {
      // @ts-ignore
      if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        // @ts-ignore
        const has = await window.aistudio.hasSelectedApiKey();
        setHasKey(has);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    // @ts-ignore
    if (window.aistudio && window.aistudio.openSelectKey) {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      setHasKey(true);
    }
  };

  return (
    <div className="min-h-screen bg-nba-dark text-slate-200 font-sans selection:bg-purple-500/30">
      {/* Navbar */}
      <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-red-600 to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/50">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl tracking-tight text-white">CourtSide<span className="text-blue-400">AI</span></span>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setView('dashboard')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                  view === 'dashboard' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </button>
              <button 
                onClick={() => setView('playerStats')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                  view === 'playerStats' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">Player Stats</span>
              </button>
              <button 
                onClick={() => setView('chat')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                  view === 'chat' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span className="hidden sm:inline">Copilot</span>
              </button>
              {!hasKey && (
                <button 
                  onClick={handleSelectKey}
                  className="ml-2 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-lg shadow-blue-900/20"
                >
                  <Key className="w-4 h-4" />
                  <span className="hidden sm:inline">Select API Key</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {view === 'dashboard' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-8rem)]">
            {/* Left Column: Analyzer (8 cols) */}
            <div className="lg:col-span-8 h-full flex flex-col">
               <BetAnalyzer />
            </div>

            {/* Right Column: News & Mini Chat (4 cols) */}
            <div className="lg:col-span-4 h-full flex flex-col gap-6">
              <div className="flex-1 min-h-[400px]">
                <NewsFeed />
              </div>
              <div className="h-[300px] lg:h-1/3 hidden lg:block">
                 <Copilot />
              </div>
            </div>
          </div>
        ) : view === 'playerStats' ? (
          <div className="h-[calc(100vh-8rem)] max-w-4xl mx-auto">
            <PlayerStats />
          </div>
        ) : (
          <div className="h-[calc(100vh-8rem)]">
            <Copilot />
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
