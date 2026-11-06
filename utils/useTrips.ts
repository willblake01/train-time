import { useEffect, useState } from 'react';
import { subscribeToTrips } from './firebaseActions';
import type { Trip } from './trips';

// All trips, kept in sync live across every open session
export function useTrips() {
    const [trips, setTrips] = useState<Trip[]>([]);
    const [loaded, setLoaded] = useState(false);

    useEffect(
        () =>
            subscribeToTrips((next) => {
                setTrips(next);
                setLoaded(true);
            }),
        [],
    );

    return { trips, loaded };
}