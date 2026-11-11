import { useEffect, useState } from 'react';
import { subscribeToDevices, type LinkedDevice } from './firebaseActions';

// Devices linked to this rider, kept in sync live
export function useDevices() {
    const [devices, setDevices] = useState<LinkedDevice[]>([]);
    useEffect(() => subscribeToDevices(setDevices), []);
    return devices;
}
