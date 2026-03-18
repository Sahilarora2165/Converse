import React, { useState, useEffect, useCallback } from 'react';
import { Activity, TrendingUp, TrendingDown, Minus, Clock, Zap, BarChart3, X } from 'lucide-react';
import { getLatencyMetrics, getLatencyHistory } from '../services/api';

const MetricsDashboard = ({ isOpen, onClose }) => {
  const [currentMetrics, setCurrentMetrics] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [windowMinutes, setWindowMinutes] = useState(5);

  const fetchMetrics = useCallback(async () => {
    try {
      const [currentRes, historyRes] = await Promise.all([
        getLatencyMetrics(windowMinutes),
        getLatencyHistory(windowMinutes)
      ]);
      
      setCurrentMetrics(currentRes.data);
      setHistoryData(historyRes.data.dataPoints || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
      setError('Failed to load metrics');
    } finally {
      setLoading(false);
    }
  }, [windowMinutes]);

  useEffect(() => {
    if (isOpen) {
      fetchMetrics();
      const interval = setInterval(fetchMetrics, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [isOpen, fetchMetrics]);

  if (!isOpen) return null;

  const formatLatency = (ms) => {
    if (ms === null || ms === undefined) return '--';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getLatencyColor = (ms) => {
    if (!ms) return 'text-zinc-500';
    if (ms < 100) return 'text-emerald-400';
    if (ms < 500) return 'text-amber-400';
    return 'text-red-400';
  };

  const getLatencyTrend = () => {
    if (historyData.length < 2) return 'stable';
    const recent = historyData.slice(-5);
    const avg = recent.reduce((sum, d) => sum + d.latencyMs, 0) / recent.length;
    const last = historyData[historyData.length - 1]?.latencyMs || 0;
    
    if (last > avg * 1.2) return 'up';
    if (last < avg * 0.8) return 'down';
    return 'stable';
  };

  const maxLatency = Math.max(...historyData.map(d => d.latencyMs || 0), 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Latency Metrics</h2>
              <p className="text-xs text-zinc-500">Real-time message delivery performance</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Window Selector */}
        <div className="flex gap-2 px-6 py-3 border-b border-white/5">
          {[1, 5, 15].map((mins) => (
            <button
              key={mins}
              onClick={() => setWindowMinutes(mins)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                windowMinutes === mins
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-zinc-800/50 text-zinc-400 border border-white/5 hover:border-white/10'
              }`}
            >
              {mins}m
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Loading metrics...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          ) : (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-3 mb-6">
                {/* Average */}
                <div className="bg-zinc-800/50 rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Average</span>
                  </div>
                  <p className={`text-2xl font-black ${getLatencyColor(currentMetrics?.avgLatencyMs)}`}>
                    {formatLatency(currentMetrics?.avgLatencyMs)}
                  </p>
                </div>

                {/* Min */}
                <div className="bg-zinc-800/50 rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Min</span>
                  </div>
                  <p className="text-2xl font-black text-emerald-400">
                    {formatLatency(currentMetrics?.minLatencyMs)}
                  </p>
                </div>

                {/* Max */}
                <div className="bg-zinc-800/50 rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Max</span>
                  </div>
                  <p className="text-2xl font-black text-red-400">
                    {formatLatency(currentMetrics?.maxLatencyMs)}
                  </p>
                </div>

                {/* Count */}
                <div className="bg-zinc-800/50 rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Messages</span>
                  </div>
                  <p className="text-2xl font-black text-white">
                    {currentMetrics?.messageCount || 0}
                  </p>
                </div>
              </div>

              {/* Percentiles */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-zinc-800/30 rounded-xl p-3 border border-white/5">
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">P50</span>
                  <p className={`text-lg font-bold mt-1 ${getLatencyColor(currentMetrics?.p50LatencyMs)}`}>
                    {formatLatency(currentMetrics?.p50LatencyMs)}
                  </p>
                </div>
                <div className="bg-zinc-800/30 rounded-xl p-3 border border-white/5">
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">P95</span>
                  <p className={`text-lg font-bold mt-1 ${getLatencyColor(currentMetrics?.p95LatencyMs)}`}>
                    {formatLatency(currentMetrics?.p95LatencyMs)}
                  </p>
                </div>
                <div className="bg-zinc-800/30 rounded-xl p-3 border border-white/5">
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">P99</span>
                  <p className={`text-lg font-bold mt-1 ${getLatencyColor(currentMetrics?.p99LatencyMs)}`}>
                    {formatLatency(currentMetrics?.p99LatencyMs)}
                  </p>
                </div>
              </div>

              {/* Graph */}
              <div className="bg-zinc-800/30 rounded-2xl p-4 border border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Latency Over Time</span>
                  <div className="flex items-center gap-1.5">
                    {getLatencyTrend() === 'up' && <TrendingUp className="w-3.5 h-3.5 text-red-400" />}
                    {getLatencyTrend() === 'down' && <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />}
                    {getLatencyTrend() === 'stable' && <Minus className="w-3.5 h-3.5 text-zinc-500" />}
                  </div>
                </div>
                
                <div className="h-32 flex items-end gap-1">
                  {historyData.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                      <p className="text-xs text-zinc-600">No data yet - send some messages!</p>
                    </div>
                  ) : (
                    historyData.map((point, index) => {
                      const height = Math.max((point.latencyMs / maxLatency) * 100, 5);
                      const isRecent = index >= historyData.length - 3;
                      return (
                        <div
                          key={index}
                          className="flex-1 flex flex-col items-center gap-1 group relative"
                        >
                          <div
                            className={`w-full rounded-t transition-all ${
                              isRecent
                                ? 'bg-amber-400'
                                : 'bg-zinc-600 group-hover:bg-zinc-500'
                            }`}
                            style={{ height: `${height}%` }}
                          />
                          <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-700 px-2 py-1 rounded text-[10px] text-white whitespace-nowrap z-10">
                            {formatLatency(point.latencyMs)}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Timestamp */}
              {currentMetrics?.timestamp && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Clock className="w-3 h-3 text-zinc-600" />
                  <p className="text-[10px] text-zinc-600">
                    Last updated: {new Date(currentMetrics.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MetricsDashboard;
