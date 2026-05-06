import { useEffect, useState, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';

export const useSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    // Initial fetch to populate history
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        if (data.recentLogs) setLogs(data.recentLogs);
        if (data.alerts) setAlerts(data.alerts);
      })
      .catch(err => console.error("Failed to fetch initial stats:", err));

    const s = io();
    setSocket(s);

    s.on('log_update', (log) => {
      setLogs((prev) => {
        // Prevent duplicates by checking ID
        if (prev.some(p => p.id === log.id)) return prev;
        return [log, ...prev].slice(0, 50);
      });
    });

    s.on('new_alert', (alert) => {
      setAlerts((prev) => {
        if (prev.some(p => p.id === alert.id)) return prev;
        return [alert, ...prev].slice(0, 50);
      });
    });

    return () => {
      s.disconnect();
    };
  }, []);

  return useMemo(() => ({ socket, logs, alerts }), [socket, logs, alerts]);
};
