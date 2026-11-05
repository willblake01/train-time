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

// Split-flap board palette
const board = {
  bg: '#101214',
  row: '#16191c',
  border: '#2a2e33',
  amber: '#ffb000',
  green: '#4cd964',
  red: '#ff5a4f',
  dim: '#8a8f96',
  font: '"Courier New", ui-monospace, SFMono-Regular, Menlo, monospace',
};

const cellSx = {
  color: board.amber,
  fontFamily: board.font,
  fontSize: '0.95rem',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  borderBottom: `1px solid ${board.border}`,
  whiteSpace: 'nowrap',
} as const;

const headCellSx = { ...cellSx, bgcolor: board.bg, color: board.dim, fontSize: '0.75rem' } as const;

const StatusText = ({ departure }: { departure: Departure }) => {
  if (departure.status === 'boarding') return <Box component="span" sx={{ color: board.green }}>Boarding</Box>;
  if (departure.status === 'delayed') {
    const { estimated, tz } = departure.station;
    return (
      <Box component="span" sx={{ color: departure.delayMinutes > 15 ? board.red : board.amber }}>
        Delayed · {formatTime(estimated, tz)}
      </Box>
    );
  }
  return <Box component="span" sx={{ color: board.green }}>On time</Box>;
};

interface DepartureBoardProps {
  stations: StationOption[];
  initialStation: string;
  initialDepartures: Departure[];
  /** Shows a Select button on each row, used when adding a leg to a trip */
  onSelect?: (departure: Departure) => void;
}

const DepartureBoard = ({ stations, initialStation, initialDepartures, onSelect }: DepartureBoardProps) => {
  const [station, setStation] = useState(initialStation);
  const [departures, setDepartures] = useState(initialDepartures);
  const [status, setStatus] = useState<'ready' | 'loading' | 'error'>('ready');

  // If the station isn't in today's list (e.g. data failed to load), still show it
  const { selected, options } = useMemo(() => {
    const match = stations.find((s) => s.code === station);
    const current = match ?? { code: station, name: station };
    return { selected: current, options: match ? stations : [current, ...stations] };
  }, [stations, station]);

  // Keep the board current; refetch on station change and every minute
  useEffect(() => {
    let cancelled = false;

    const load = () => {
      fetch(`/api/departures?station=${station}`)
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
  }, [station]);

  const changeStation = (code: string) => {
    setStation(code);
    setDepartures([]);
    setStatus('loading');
  };

  const columns = onSelect ? 6 : 5;

  return (
    <Box sx={{ bgcolor: board.bg, borderRadius: '25px', p: { xs: 2, sm: 3 }, border: `1px solid ${board.border}` }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2 }}>
        <Typography component="h2" sx={{ color: board.amber, fontFamily: board.font, fontSize: '1.5rem', letterSpacing: '0.12em' }}>
          DEPARTURES
        </Typography>

        <Autocomplete
          disableClearable
          options={options}
          value={selected}
          onChange={(_, option) => changeStation(option.code)}
          getOptionLabel={(option) => `${option.name} (${option.code})`}
          isOptionEqualToValue={(option, value) => option.code === value.code}
          sx={{ minWidth: { xs: '100%', sm: 320 } }}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              label="Station"
              sx={{
                '& .MuiInputBase-root': { color: board.amber, fontFamily: board.font, bgcolor: board.row },
                '& .MuiInputLabel-root, & .MuiAutocomplete-popupIndicator': { color: board.dim },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: board.border },
              }}
            />
          )}
        />
      </Box>

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
              <TableRow key={d.trainID} sx={{ bgcolor: board.row }}>
                <TableCell sx={cellSx}>{formatTime(d.station.scheduled, d.station.tz)}</TableCell>
                <TableCell sx={cellSx}>
                  {d.trainNum}{' '}
                  <Box component="span" sx={{ color: board.dim }}>{d.routeName}</Box>
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
                      sx={{ color: board.amber, borderColor: board.amber, fontFamily: board.font }}
                    >
                      Select
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}

            {departures.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns} align="center" sx={{ ...cellSx, color: board.dim, py: 4 }}>
                  {status === 'loading' && 'Loading departures…'}
                  {status === 'error' && 'Departure data unavailable. Retrying shortly.'}
                  {status === 'ready' && 'No upcoming departures'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="caption" sx={{ display: 'block', mt: 1, textAlign: 'right', color: board.dim }}>
        Times shown in station local time · Live data from{' '}
        <Link href="https://amtraker.com" target="_blank" rel="noreferrer" sx={{ color: board.amber }}>
          Amtraker
        </Link>
      </Typography>
    </Box>
  );
};

export default DepartureBoard;
