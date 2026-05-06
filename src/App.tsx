/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { 
  Shield, 
  Activity, 
  AlertTriangle, 
  Terminal, 
  Globe, 
  BarChart3, 
  Clock,
  Search,
  Lock,
  Cpu,
  Zap,
  Info,
  X,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { useSocket } from './hooks/useSocket';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Markdown from 'react-markdown';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const { logs, alerts, socket } = useSocket();
  const [investigation, setInvestigation] = useState<{ alert: any, report: string | null, loading: boolean } | null>(null);
  const [blockedIps, setBlockedIps] = useState<string[]>([]);

  // Fetch initial blocked IPs
  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        if (data.blockedIps) setBlockedIps(data.blockedIps);
      });
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('system_message', (msg: any) => {
        if (msg.type === 'BLOCK') {
          setBlockedIps(prev => [...new Set([...prev, msg.ip])]);
        }
      });
    }
  }, [socket]);

  const dashboardData = useMemo(() => {
    const statusDist: Record<string, number> = {};
    const ipCounts: Record<string, number> = {};
    
    logs.forEach(l => {
      statusDist[l.status] = (statusDist[l.status] || 0) + 1;
      ipCounts[l.ip] = (ipCounts[l.ip] || 0) + 1;
    });

    const topIps = Object.entries(ipCounts)
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const pieData = Object.entries(statusDist).map(([status, count]) => ({
      name: status,
      value: count
    }));

    const areaData = logs.slice(0, 20).reverse();

    return { statusDist, topIps, pieData, areaData };
  }, [logs]);

  const tackleInvestigate = async (alert: any) => {
    setInvestigation({ alert, report: null, loading: true });
    try {
      const res = await fetch('/api/investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert })
      });
      const data = await res.json();
      setInvestigation({ alert, report: data.analysis, loading: false });
    } catch (err) {
      setInvestigation(prev => prev ? { ...prev, loading: false, report: "Error performing AI investigation." } : null);
    }
  };

  const tackleQuarantine = async (ip: string) => {
    try {
      await fetch('/api/quarantine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip })
      });
    } catch (err) {
      console.error("Failed to block IP:", err);
    }
  };

  const COLORS = ['#141414', '#333333', '#666666', '#999999', '#CCCCCC'];

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-mono selection:bg-[#141414] selection:text-[#E4E3E0]">
      {/* INVESTIGATION MODAL */}
      <AnimatePresence>
        {investigation && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#E4E3E0] border-2 border-[#141414] w-full max-w-2xl shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] flex flex-col max-h-[80vh]"
            >
              <div className="p-4 border-b-2 border-[#141414] bg-[#141414] text-[#E4E3E0] flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 italic">
                  <ShieldAlert className="w-4 h-4 text-amber-500" /> AI Forensics Report: {investigation.alert.ip}
                </span>
                <button onClick={() => setInvestigation(null)} className="hover:text-red-500 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 markdown-body text-sm leading-relaxed">
                {investigation.loading ? (
                  <div className="h-40 flex flex-col items-center justify-center gap-4 opacity-50">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <p className="text-[10px] font-bold uppercase tracking-widest animate-pulse">Consulting Cyber Intelligence...</p>
                  </div>
                ) : (
                  <div className="prose prose-sm prose-slate max-w-none">
                    <Markdown>{investigation.report}</Markdown>
                  </div>
                )}
              </div>
              {!investigation.loading && (
                <div className="p-4 border-t-2 border-[#141414] bg-[#D4D3D0] flex justify-end gap-3">
                   <button 
                    onClick={() => setInvestigation(null)}
                    className="px-4 py-2 text-[10px] font-bold uppercase border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0]"
                   >
                     CLOSE
                   </button>
                   <button 
                    onClick={() => { tackleQuarantine(investigation.alert.ip); setInvestigation(null); }}
                    className="px-4 py-2 text-[10px] font-bold uppercase bg-red-600 text-white border border-[#141414] hover:bg-black"
                   >
                     EXECUTE QUARANTINE
                   </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* HEADER */}
      <header className="border-b border-[#141414] p-4 flex justify-between items-center bg-[#D4D3D0] sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8" />
          <div>
            <h1 className="text-xl font-bold tracking-tighter uppercase leading-none">Sentinel Log Analysis</h1>
            <p className="text-[10px] opacity-60 font-sans italic">CYBERSECURITY TELEMETRY v1.0.4</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] leading-none opacity-50 uppercase mb-1">Blocked Entities</p>
            <div className="flex items-center justify-end gap-2">
              <span className="text-xs font-bold uppercase tracking-widest">{blockedIps.length} IPS</span>
              <Lock className="w-3 h-3 opacity-60" />
            </div>
          </div>
          <div className="w-10 h-10 border border-[#141414] flex items-center justify-center">
             <Cpu className="w-5 h-5" />
          </div>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-0">
        {/* LEFT COLUMN: VISUALIZATIONS */}
        <div className="lg:col-span-8 border-r border-[#141414]">
          
          {/* STATS OVERVIEW */}
          <div className="grid grid-cols-1 md:grid-cols-3 border-b border-[#141414]">
            <StatCard label="Total Inbound" value={logs.length} icon={<Globe className="w-4 h-4" />} />
            <StatCard label="Active Threats" value={alerts.length} icon={<AlertTriangle className="w-4 h-4" />} intensity="high" />
            <StatCard label="System Uptime" value="00:12:45" icon={<Clock className="w-4 h-4" />} />
          </div>

          {/* MAIN CHARTS */}
          <div className="p-6 space-y-8">
            <section>
              <div className="flex justify-between items-end mb-4 border-b border-[#141414] pb-2">
                <h2 className="text-xs font-bold uppercase flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" /> Global Traffic Activity
                </h2>
                <span className="text-[10px] opacity-50 italic">WINDOW: 60s SLIDING</span>
              </div>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dashboardData.areaData}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#141414" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#141414" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.1)" />
                    <XAxis dataKey="timestamp" hide />
                    <YAxis hide />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#141414', border: 'none', borderRadius: '0', color: '#E4E3E0' }} 
                      itemStyle={{ color: '#E4E3E0' }}
                    />
                    <Area type="monotone" dataKey="bytes" stroke="#141414" fillOpacity={1} fill="url(#colorCount)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <section className="border border-[#141414] p-4 bg-white/30">
                <h3 className="text-[10px] font-bold uppercase mb-4 opacity-70">Top Victim Paths / Source IPs</h3>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboardData.topIps}>
                      <CartesianGrid strokeDasharray="1 1" stroke="rgba(0,0,0,0.05)" />
                      <XAxis dataKey="ip" fontSize={8} tick={{ fill: '#141414' }} />
                      <YAxis fontSize={8} tick={{ fill: '#141414' }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#141414" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="border border-[#141414] p-4 bg-white/30">
                <h3 className="text-[10px] font-bold uppercase mb-4 opacity-70">Status Code Distribution</h3>
                <div className="h-[200px] flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dashboardData.pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={60}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {dashboardData.pieData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>
          </div>

          <div className="border-t border-[#141414]">
             <div className="p-4 bg-[#141414] text-[#E4E3E0] flex justify-between items-center">
                <p className="text-[10px] uppercase font-bold tracking-widest">Raw Telemetry Stream</p>
                <div className="flex gap-4">
                  <span className="text-[9px] uppercase opacity-50 flex items-center gap-1"><Search className="w-3 h-3" /> Filter Log</span>
                  <span className="text-[9px] uppercase opacity-50 flex items-center gap-1"><Lock className="w-3 h-3" /> Secure Link</span>
                </div>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="bg-[#D4D3D0] border-b border-[#141414]">
                      <th className="px-4 py-2 font-bold uppercase w-8 italic opacity-50">#</th>
                      <th className="px-4 py-2 font-bold uppercase italic opacity-50">Timestamp</th>
                      <th className="px-4 py-2 font-bold uppercase italic opacity-50">IP Address</th>
                      <th className="px-4 py-2 font-bold uppercase italic opacity-50">Method</th>
                      <th className="px-4 py-2 font-bold uppercase italic opacity-50">Resource Path</th>
                      <th className="px-4 py-2 font-bold uppercase italic opacity-50 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence mode="popLayout" initial={false}>
                      {logs.map((log, i) => (
                        <motion.tr 
                          key={log.id || log.timestamp + i}
                          layout
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="border-b border-[#141414]/10 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors cursor-crosshair group"
                        >
                          <td className="px-4 py-2 font-sans opacity-40">{i + 1}</td>
                          <td className="px-4 py-2 font-medium">{log.timestamp}</td>
                          <td className="px-4 py-2 font-bold group-hover:text-amber-400">
                            <span className="flex items-center gap-2">
                              {log.ip}
                              {blockedIps.includes(log.ip) && <Lock className="w-3 h-3 text-red-500" />}
                            </span>
                          </td>
                          <td className="px-4 py-2 uppercase opacity-60">{log.method}</td>
                          <td className="px-4 py-2 opacity-80 max-w-[200px] truncate">{log.path}</td>
                          <td className={cn(
                            "px-4 py-2 text-right font-bold",
                            log.status >= 400 ? "text-red-600 group-hover:text-red-400" : "text-green-600 group-hover:text-green-400"
                          )}>{log.status}</td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
             </div>
          </div>
        </div>

        {/* RIGHT COLUMN: ALERTS & THREATS */}
        <div className="lg:col-span-4 bg-[#D4D3D0] flex flex-col h-[calc(100vh-64px)] sticky top-16">
          <div className="p-4 border-b border-[#141414] bg-[#141414] text-[#E4E3E0] flex justify-between items-center">
            <h2 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Security Events
            </h2>
            <span className="bg-amber-500 text-[#141414] px-1.5 py-0.5 text-[9px] font-black">{alerts.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {alerts.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center opacity-30 text-center">
                  <Shield className="w-12 h-12 mb-4" />
                  <p className="text-[10px] uppercase font-bold">No active threats detected</p>
                  <p className="text-[9px] mt-1 max-w-[150px]">Monitoring real-time stream for anomalous patterns...</p>
               </div>
            ) : (
              <AnimatePresence>
                {alerts.map((alert) => (
                  <motion.div 
                    key={alert.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={cn(
                      "border border-[#141414] p-3 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] bg-white",
                      alert.type === 'DDOS' ? "border-red-600" : "border-amber-600"
                    )}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={cn(
                        "text-[9px] font-black px-1 uppercase",
                        alert.type === 'DDOS' ? "bg-red-600 text-white" : "bg-amber-500 text-white"
                      )}>{alert.type} DETECTED</span>
                      <span className="text-[8px] opacity-50">{format(alert.timestamp, 'HH:mm:ss')}</span>
                    </div>
                    <p className="text-xs font-bold leading-tight mb-2 uppercase">{alert.message}</p>
                    <div className="flex justify-between items-center pt-2 border-t border-[#141414]/10">
                      <div className="flex flex-col">
                        <span className="text-[9px] opacity-60">SOURCE: {alert.ip}</span>
                        {blockedIps.includes(alert.ip) && <span className="text-[7px] text-red-600 font-bold uppercase tracking-tighter">RESTRICTED</span>}
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => tackleInvestigate(alert)}
                          className="text-[9px] font-bold uppercase bg-[#141414] text-white px-2 py-1 flex items-center gap-1"
                        >
                          <Zap className="w-3 h-3" /> Investigate
                        </button>
                        {!blockedIps.includes(alert.ip) && (
                          <button 
                            onClick={() => tackleQuarantine(alert.ip)}
                            className="text-[9px] font-bold uppercase border border-[#141414] px-2 py-1 hover:bg-[#141414] hover:text-[#E4E3E0]"
                          >
                            Block
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>

          <div className="p-4 border-t border-[#141414] bg-[#C4C3C0]">
             <div className="flex items-center gap-3 opacity-60 text-[10px] font-bold uppercase mb-4">
                <Terminal className="w-4 h-4" /> Analyst Command Center
             </div>
             <div className="bg-[#141414] p-3 text-green-500 text-[10px] space-y-1 font-mono rounded-sm min-h-[100px]">
                <p># SYSTEM_READY</p>
                <p>&gt; Ingesting stream from subprocess: log_generator.py</p>
                <p>&gt; Sliding window initialized: 60000ms</p>
                <p>&gt; AI Module Status: ONLINE (Gemini-1.5-Flash)</p>
                <p>&gt; Thresholds: DDoS &gt; 100 req/min | Probing &gt; 50% err</p>
                <p className="animate-pulse">_</p>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, icon, intensity }: { label: string, value: string | number, icon: any, intensity?: 'high' | 'normal' }) {
  return (
    <div className="p-4 flex flex-col justify-between hover:bg-white/50 transition-colors">
      <div className="flex justify-between items-start opacity-50 mb-4">
        <span className="text-[10px] font-bold uppercase tracking-tighter italic leading-none">{label}</span>
        {icon}
      </div>
      <div className={cn(
        "text-3xl font-black tracking-tighter leading-none",
        intensity === 'high' && value !== 0 && "text-red-600"
      )}>
        {value}
      </div>
    </div>
  );
}

