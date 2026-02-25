import React, { useEffect, useState, useCallback } from 'react';
import { fetchNbaNews } from '../services/gemini';
import { NewsItem } from '../types';
import { ExternalLink, RefreshCw, Newspaper } from 'lucide-react';

const NewsFeed: React.FC = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const loadNews = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError('');
    try {
      const items = await fetchNbaNews();
      if (items && items.length > 0) {
        setNews(items);
        setLastUpdated(new Date());
      }
    } catch (err) {
      if (!isSilent) setError('Failed to load news.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNews();
    
    // Set up real-time auto-refresh every 5 minutes
    const interval = setInterval(() => {
      loadNews(true); // Silent update in background
    }, 1000 * 60 * 5);

    return () => clearInterval(interval);
  }, [loadNews]);

  return (
    <div className="bg-nba-card rounded-xl p-6 shadow-lg border border-slate-700 h-full flex flex-col relative overflow-hidden">
      {/* Real-time Indicator */}
      <div className="absolute top-0 right-0 p-1 flex items-center gap-1.5 px-3 bg-slate-800/80 rounded-bl-lg border-b border-l border-slate-700">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">Live Feed</span>
      </div>

      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <Newspaper className="w-5 h-5 text-blue-400" />
            CourtSide X-Wire
          </h2>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Real-time Twitter & News Feed
          </p>
        </div>
        <button 
          onClick={() => loadNews()}
          disabled={loading}
          className="p-2 hover:bg-slate-700 rounded-full transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && news.length === 0 ? (
         <div className="flex-1 flex flex-col gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse space-y-2">
                <div className="h-4 bg-slate-700 rounded w-3/4"></div>
                <div className="h-3 bg-slate-800 rounded w-full"></div>
                <div className="h-3 bg-slate-800 rounded w-5/6"></div>
              </div>
            ))}
         </div>
      ) : error ? (
        <div className="text-red-400 text-sm text-center py-4">{error}</div>
      ) : (
        <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1 max-h-[500px]">
          {news.map((item, idx) => (
            <div key={idx} className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 hover:border-blue-500/50 transition-all group">
              <div className="flex justify-between items-start">
                <h3 className="text-sm font-semibold text-slate-200 group-hover:text-blue-300 transition-colors line-clamp-2">
                  {item.title}
                </h3>
                {item.url && (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-blue-400">
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 line-clamp-3">{item.snippet}</p>
              <div className="flex justify-between items-center mt-2">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded">
                  {item.source}
                </span>
              </div>
            </div>
          ))}
          {news.length === 0 && !loading && (
             <div className="text-slate-500 text-center text-sm py-4">No news found. Try refreshing.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default NewsFeed;