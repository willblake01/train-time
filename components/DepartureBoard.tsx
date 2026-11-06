import { useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type { Departure, StationOption } from '../utils/departures';
import { formatTime } from '../utils/time';

const REFRESH_MS = 60_000;

// Monospace keeps the split-flap board look in both themes; colors come from
// the theme, so the board is black-on-white in light mode and amber-on-black in dark
const BOARD_FONT = '"Courier New", ui-monospace, SFMono-Regular, Menlo, monospace';

const cellSx = {
  color: 'text.primary',
  fontFamily: BOARD_FONT,
  fontSize: '0.95rem',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  borderBottom: 1,
  borderColor: 'divider',
  whiteSpace: 'nowrap',
} as const;

const headCellSx = { ...cellSx, bgcolor: 'background.paper', color: 'text.secondary', fontSize: '0.75rem' } as const;

const StatusText = ({ departure }: { departure: Departure }) => {
  if (departure.status === 'boarding') return <Box component="span" sx={{ color: 'success.main' }}>Boarding</Box>;
  if (departure.status === 'delayed') {
    const { estimated, tz } = departure.station;
    const eta = formatTime(estimated, tz);
    return (
      <Box component="span" sx={{ color: departure.delayMinutes > 15 ? 'error.main' : 'warning.main' }}>
        Delayed{eta ? ` · ${eta}` : ''}
      </Box>
    );
  }
  return <Box component="span" sx={{ color: 'success.main' }}>On time</Box>;
};

interface DepartureBoardProps {
  stations: StationOption[];
  /** Station shown on the board; the page owns it so New Trip can move the board */
  station: string;
  onStationChange: (code: string) => void;
  /** Only show trains leaving at or after this time (ISO), e.g. the last leg's arrival */
  after?: string;
  /** Server-rendered data for the first load; omit to fetch on mount */
  initialDepartures?: Departure[];
  /** Shown under the title while building a trip */
  addingTo?: {
    tripName: string;
    /** e.g. "7:20 PM", when only trains after the last leg's arrival are shown */
    afterLabel?: string;
    onShowAll?: () => void;
    onDone: () => void;
  };
  /** Shows an "Add to trip" button on each row */
  onSelect?: (departure: Departure) => void;
}

const DepartureBoard = ({ stations = [], station, onStationChange, after, initialDepartures, addingTo, onSelect }: DepartureBoardProps) => {
  const [departures, setDepartures] = useState(initialDepartures ?? []);
  const [status, setStatus] = useState<'ready' | 'loading' | 'error'>(initialDepartures ? 'ready' : 'loading');

  // If the station isn't in today's list (e.g. data failed to load), still show it
  const { selected, options } = useMemo(() => {
    const match = stations.find((s) => s.code === station);
    const current = match ?? { code: station, name: station };
    return { selected: current, options: match ? stations : [current, ...stations] };
  }, [stations, station]);

  // Keep the board current; refetch on station change and every minute
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ station, ...(after && { after }) });

    const load = () => {
      fetch(`/api/departures?${params.toString()}`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json() as Promise<{ departures: Departure[] }>;
        })
        .then((data) => {
          if (cancelled) return;
          setDepartures(data.departures);
          setStatus('ready');
        })
        .catch(() => {
          if (!cancelled) setStatus('error');
        });
    };

    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [station, after]);

  const columns = onSelect ? 6 : 5;

  return (
    <Box sx={{ bgcolor: 'background.paper', color: 'text.primary', borderRadius: '25px', p: { xs: 2, sm: 3 }, border: 1, borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2 }}>
        <Typography variant="h5" component="h2">
          Departures
        </Typography>

        <Autocomplete
          disableClearable
          options={options}
          value={selected}
          onChange={(_, option) => onStationChange(option.code)}
          getOptionLabel={(option) => `${option.name} (${option.code})`}
          isOptionEqualToValue={(option, value) => option.code === value.code}
          sx={{ minWidth: { xs: '100%', sm: 320 } }}
          renderInput={(params) => (
            <TextField {...params} size="small" label="Station" sx={{ '& .MuiInputBase-root': { fontFamily: BOARD_FONT } }} />
          )}
        />
      </Box>

      {addingTo && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 2 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Adding to <Box component="strong" sx={{ color: 'text.primary' }}>{addingTo.tripName}</Box>
              {addingTo.afterLabel && ` · trains leaving after ${addingTo.afterLabel}`}
            </Typography>
            {addingTo.afterLabel && addingTo.onShowAll && (
                <Button size="small" onClick={addingTo.onShowAll}>
                  Show all
                </Button>
            )}
            <Button size="small" onClick={addingTo.onDone}>
              Done
            </Button>
          </Box>
      )}

      <TableContainer sx={{ maxHeight: 520 }}>
        <Table stickyHeader size="small" aria-label={`Departures from ${selected.name}`}>
          <TableHead>
            <TableRow>
              <TableCell sx={headCellSx}>Time</TableCell>
              <TableCell sx={headCellSx}>Train</TableCell>
              <TableCell sx={headCellSx}>To</TableCell>
              <TableCell sx={headCellSx}>Track</TableCell>
              <TableCell sx={headCellSx}>Status</TableCell>
              {onSelect && <TableCell sx={headCellSx} />}
            </TableRow>
          </TableHead>
          <TableBody aria-live="polite" aria-busy={status === 'loading'}>
            {departures.map((d) => (
              <TableRow key={d.trainID} hover>
                <TableCell sx={cellSx}>{formatTime(d.station.scheduled, d.station.tz)}</TableCell>
                <TableCell sx={cellSx}>
                  {d.trainNum}{' '}
                  <Box component="span" sx={{ color: 'text.secondary' }}>{d.routeName}</Box>
                </TableCell>
                <TableCell sx={cellSx}>{d.destName}</TableCell>
                <TableCell sx={cellSx}>{d.platform || '—'}</TableCell>
                <TableCell sx={cellSx}>
                  <StatusText departure={d} />
                </TableCell>
                {onSelect && (
                  <TableCell sx={cellSx} align="right">
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={() => onSelect(d)}
                        aria-label={`Add train ${d.trainNum} to ${d.destName} to a trip`}
                        sx={{ fontFamily: BOARD_FONT }}
                    >
                      Add to trip
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}

            {departures.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns} align="center" sx={{ ...cellSx, color: 'text.secondary', py: 4 }}>
                  {status === 'loading' && 'Loading departures…'}
                  {status === 'error' && 'Departure data unavailable. Retrying shortly.'}
                  {status === 'ready' && (after ? 'No more departures after that time' : 'No upcoming departures')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="caption" sx={{ display: 'block', mt: 1, textAlign: 'right', color: 'text.secondary' }}>
        Times shown in station local time · Live data from{' '}
        <Link href="https://amtraker.com" target="_blank" rel="noreferrer">
          Amtraker
        </Link>
      </Typography>
    </Box>
  );
};

export default DepartureBoard;
