import { useState, type ComponentProps } from 'react';
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    MenuItem,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import type { Departure, StationOption } from '../utils/departures';
import { addLeg, createTrip } from '../utils/firebaseActions';
import { formatDate, formatTime, localDate } from '../utils/time';
import { buildLeg, checkLeg, type NewLeg, type Trip } from '../utils/trips';

const NEW_TRIP = '__new__';

export interface SavedLeg {
    tripId: string;
    tripName: string;
    leg: NewLeg;
}

interface AddToTripDialogueProps {
    departure: Departure;
    trips: Trip[];
    /** Used to name stations in messages */
    stations: StationOption[];
    /** Preselects the trip the user added to last */
    defaultTripId?: string;
    onClose: () => void;
    onSaved: (saved: SavedLeg) => void;
}

// Render with key={departure.trainID} so the form resets for each train
const AddToTripDialogue = ({ departure, trips, stations, defaultTripId, onClose, onSaved }: AddToTripDialogueProps) => {
    const stops = departure.remainingStops;
    const board = departure.station;
    const boardDate = localDate(board.scheduled, board.tz);

    // Defaults: the last-used (or newest) trip, getting off at its destination
    // when this train stops there, otherwise at the end of the line
    const initialTripId = defaultTripId && trips.some((t) => t.id === defaultTripId) ? defaultTripId : (trips[0]?.id ?? NEW_TRIP);
    const initialDestination = trips.find((t) => t.id === initialTripId)?.to;
    const [alightCode, setAlightCode] = useState(
        stops.find((s) => s.code === initialDestination)?.code ?? stops.at(-1)?.code ?? '',
    );
    const [tripId, setTripId] = useState(initialTripId);
    const [newName, setNewName] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const isNewTrip = tripId === NEW_TRIP;
    const selectedTrip = trips.find((t) => t.id === tripId);
    const alight = stops.find((s) => s.code === alightCode);

    // Legs must connect: same station as the last arrival, leaving after it
    const stationName = (code: string) => stations.find((s) => s.code === code)?.name ?? code;
    const check = selectedTrip && alight ? checkLeg(selectedTrip, buildLeg(departure, alight), stationName) : {};

    const canSave = Boolean(alight) && (!isNewTrip || newName.trim().length > 0) && !check.error && !saving;

    const stopLabel = (code: string) => {
        const stop = stops.find((s) => s.code === code);
        if (!stop) return code;
        const sameDay = localDate(stop.scheduled, stop.tz) === boardDate;
        const when = sameDay ? formatTime(stop.scheduled, stop.tz) : `${formatDate(stop.scheduled, stop.tz)}, ${formatTime(stop.scheduled, stop.tz)}`;
        return `${stop.name} · arrives ${when}`;
    };

    const save: ComponentProps<'form'>['onSubmit'] = async (e) => {
        e.preventDefault();
        if (!alight || !canSave) return;

        setSaving(true);
        setError('');
        try {
            const leg = buildLeg(departure, alight);
            const id = isNewTrip ? await createTrip({ name: newName }) : tripId;
            await addLeg(id, leg);
            const tripName = isNewTrip ? newName.trim() : (trips.find((t) => t.id === id)?.name ?? 'your trip');
            onSaved({ tripId: id, tripName, leg });
        } catch (err) {
            console.error('Could not add leg:', err);
            setError('Could not save this leg. Check your connection and try again.');
            setSaving(false);
        }
    };

    return (
        <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="xs">
            <form onSubmit={save}>
                <DialogTitle>Add to trip</DialogTitle>
                <DialogContent>
                    <Stack spacing={2.5} sx={{ pt: 1 }}>
                        <div>
                            <Typography sx={{ fontWeight: 600 }}>
                                Train {departure.trainNum} · {departure.routeName}
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                Departs {board.name} {formatTime(board.scheduled, board.tz)} · {formatDate(board.scheduled, board.tz)}
                            </Typography>
                        </div>

                        <TextField
                            select
                            required
                            label="Get off at"
                            value={alightCode}
                            onChange={(e) => setAlightCode(e.target.value)}
                            slotProps={{ select: { renderValue: (code) => stopLabel(String(code)) } }}
                        >
                            {stops.map((stop) => (
                                <MenuItem key={stop.code} value={stop.code}>
                                    {stopLabel(stop.code)}
                                </MenuItem>
                            ))}
                        </TextField>

                        <TextField select label="Trip" value={tripId} onChange={(e) => setTripId(e.target.value)}>
                            {trips.map((trip) => (
                                <MenuItem key={trip.id} value={trip.id}>
                                    {trip.name}
                                </MenuItem>
                            ))}
                            <MenuItem value={NEW_TRIP}>+ New trip…</MenuItem>
                        </TextField>

                        {isNewTrip && (
                            <TextField
                                required
                                autoFocus
                                label="Trip name"
                                placeholder="e.g. Thanksgiving in Chicago"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                slotProps={{ htmlInput: { maxLength: 80 } }}
                            />
                        )}

                        {check.error && <Alert severity="error">{check.error}</Alert>}
                        {check.warning && <Alert severity="warning">{check.warning}</Alert>}
                        {error && <Alert severity="error">{error}</Alert>}
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={onClose} disabled={saving}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="contained" disabled={!canSave}>
                        {saving ? 'Saving…' : 'Add to trip'}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};

export default AddToTripDialogue;