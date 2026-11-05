import { useEffect, useState } from 'react';
import type { LiveStatus } from './amtrak';
import { subscribeToLiveStatus } from './firebaseActions';

// Subscribe to one train's live status in RTD (read-only)
export function useLiveStatus(trainNum?: string) {
    const [trains, setTrains] = useState<LiveStatus[]>([]);

    useEffect(() => {
        if (!trainNum) return;
        return subscribeToLiveStatus(trainNum, setTrains);
    }, [trainNum]);

    return trains;
}

// Ask the server to refresh live data. Call this once, not per row.
export function useLiveRefresh(intervalMs = 60_000) {
    useEffect(() => {
        const refresh = () => {
            if (document.visibilityState !== 'visible') return;
            fetch('/api/refresh', { method: 'POST' }).catch(() => {});
        };
        refresh();
        const interval = setInterval(refresh, intervalMs);
        return () => clearInterval(interval);
    }, [intervalMs]);
}