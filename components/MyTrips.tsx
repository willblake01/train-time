import React, { Fragment, useEffect, useState } from 'react';
import { deleteLeg, deleteTrip, useLiveRefresh, useLiveStatus, useTrips, formatDate, formatDuration, formatTime, localDate, connections, findLiveRun, type Connection, type Leg, type Trip } from '../utils';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import TrainStatusChip from './TrainStatusChip';
import LinkDeviceDialog from './LinkDeviceDialog';

// Today's date in a time zone, kept current if the page stays open past midnight
function useToday(timeZone: string) {
  const [today, setToday] = useState(() => localDate(new Date().toISOString(), timeZone));
  useEffect(() => {
    const interval = setInterval(() => setToday(localDate(new Date().toISOString(), timeZone)), 60_000);
    return () => clearInterval(interval);
  }, [timeZone]);
  return today;
}

// Live status for the exact run this leg is on; "Scheduled" until travel day
const LiveStatusChip = ({ leg }: { leg: Leg }) => {
  const train = findLiveRun(useLiveStatus(leg.trainNum), leg);
  const today = useToday(leg.from.tz);
  if (!train && leg.date > today) return <Chip size="small" variant="outlined" label="Scheduled" />;
  return <TrainStatusChip train={train} />;
};

// Warning shown between two legs when the connection doesn't work; null when it's fine.
// `legNumber` is the number of the leg that arrives at the connecting station.
const connectionWarning = ({ status, minutes, station, nextStation }: Connection, legNumber: number) => {
  const next = legNumber + 1;
  if (status === 'missed') {
    return { color: 'error.main', text: `Can't connect: leg ${next} leaves ${formatDuration(minutes)} before leg ${legNumber} arrives in ${station}` };
  }
  if (status === 'gap') {
    return { color: 'error.main', text: `Leg ${next} starts in ${nextStation}, but leg ${legNumber} arrives in ${station}` };
  }
  if (status === 'tight') {
    return { color: 'warning.main', text: `Tight connection: only ${formatDuration(minutes)} to change trains in ${station}` };
  }
  return null;
};

// "2:45 AM · Nov 6", so legs on different days are obvious
const formatDeparture = (iso: string, tz: string) => {
  const time = formatTime(iso, tz);
  return time ? `${time} · ${formatDate(iso, tz)}` : '--';
};

const LegsTable = ({ trip }: { trip?: Trip }) => {
  const layovers = trip ? connections(trip.legs) : [];

  return (
    <TableContainer>
      <Table sx={{ minWidth: 700 }} aria-label={trip ? `${trip.name} legs` : 'My trips'}>
        <TableHead>
          <TableRow>
            <TableCell>Leg</TableCell>
            <TableCell>Train</TableCell>
            <TableCell>From</TableCell>
            <TableCell>To</TableCell>
            <TableCell>Departs</TableCell>
            <TableCell>Live Status</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {trip && trip.legs.length === 0 && (
              <TableRow>
                <TableCell>--</TableCell>
                <TableCell>--</TableCell>
                <TableCell>--</TableCell>
                <TableCell>--</TableCell>
                <TableCell>--</TableCell>
                <TableCell>--</TableCell>
                <TableCell />
              </TableRow>
          )}
          {trip?.legs.map((leg, index) => {
            const warning = layovers[index] && connectionWarning(layovers[index], index + 1);
            return (
              <Fragment key={leg.id}>
                <TableRow>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>#{leg.trainNum} {leg.routeName}</TableCell>
                  <TableCell>{leg.from.name}</TableCell>
                  <TableCell>{leg.to.name}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDeparture(leg.from.time, leg.from.tz)}</TableCell>
                  <TableCell><LiveStatusChip leg={leg} /></TableCell>
                  <TableCell>
                    <Button onClick={() => deleteLeg(trip.id, leg.id)} aria-label={`Remove leg ${index + 1} from ${trip.name}`}>
                      <DeleteIcon fontSize="small" />
                    </Button>
                  </TableCell>
                </TableRow>
                {warning && (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ color: warning.color, fontWeight: 600 }}>
                      ⚠ {warning.text}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

interface MyTripsProps {
  /** Starts adding legs to a trip: the page moves the board to where the next leg leaves from */
  onAddLeg?: (trip: Trip) => void;
  /** The trip legs are currently being added to */
  activeTripId?: string;
}

const MyTrips = ({ onAddLeg, activeTripId }: MyTripsProps) => {
  useLiveRefresh();

  const { trips } = useTrips();
  const [linkOpen, setLinkOpen] = useState(false);

  // "AUS → FLG", "from AUS", or "to FLG"
  const tripRoute = ({ from, to }: Trip) => {
    if (from && to) return `${from} → ${to}`;
    if (from) return `from ${from}`;
    if (to) return `to ${to}`;
    return '';
  };

  return (
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <Card sx={{ borderRadius: '25px' }}>
          <CardHeader
              title="My Trips"
              slotProps={{
                title: {
                  align: 'center',
                },
              }}
          />
          <CardContent>
            {/* No trips yet: show the empty table, as before */}
            {trips.length === 0 && <LegsTable />}

            {trips.map((trip) => (
                <Box key={trip.id} component="section" aria-label={trip.name} sx={{ '& + &': { mt: 4 } }}>
                  {/* Trip name above its table; this button deletes the whole trip */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, px: 2 }}>
                    <Typography component="h3" sx={{ fontWeight: 700 }}>
                      {trip.name}
                      {tripRoute(trip) && (
                        <Typography component="span" sx={{ color: 'text.secondary', fontWeight: 400, ml: 1 }}>
                          {tripRoute(trip)}
                        </Typography>
                      )}
                      {trip.id === activeTripId && (
                        <Typography component="span" variant="body2" sx={{ color: 'text.secondary', fontWeight: 400, ml: 1 }}>
                          · adding legs
                        </Typography>
                      )}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {onAddLeg && (
                        <Button size="small" variant="outlined" onClick={() => onAddLeg(trip)} aria-label={`Add a leg to ${trip.name}`}>
                          Add leg
                        </Button>
                      )}
                      <Button onClick={() => deleteTrip(trip.id)} aria-label={`Delete ${trip.name}`}>
                        <DeleteIcon fontSize="small" />
                      </Button>
                    </Box>
                  </Box>
                  <LegsTable trip={trip} />
                </Box>
            ))}

            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Button size="small" onClick={() => setLinkOpen(true)}>
                Linked devices
              </Button>
            </Box>
            <LinkDeviceDialog open={linkOpen} onClose={() => setLinkOpen(false)} />
          </CardContent>
        </Card>
      </Box>
  );
};

export default MyTrips;
