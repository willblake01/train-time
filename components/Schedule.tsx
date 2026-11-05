import React, { useEffect, useState } from 'react';
import { calculateNextArrival } from '../utils/schedule';
import { deleteRoute, subscribeToRoutes, type Route } from '../utils/firebaseActions';
import { useLiveRefresh, useLiveStatus } from '../utils/useLiveStatus';
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
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';

const LiveStatusChip = ({ trainNum }: { trainNum: string }) => {
  const [train] = useLiveStatus(trainNum);
  if (!train) return <Chip size="small" label="No live data" />;

  const stop = train.nextStop;
  if (!stop) return <Chip size="small" label={train.state} />;

  const eta = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: stop.tz,
  }).format(new Date(stop.estimated));
  const late = stop.delayMinutes;

  return (
      <Chip
          size="small"
          color={late > 5 ? 'warning' : 'success'}
          label={`${stop.name} ${eta} · ${late > 0 ? `${late} min late` : 'on time'}`}
      />
  );
};

const Schedule = () => {
  useLiveRefresh();

  const [schedule, setSchedule] = useState<Route[]>([]);
  useEffect(() => subscribeToRoutes(setSchedule), []);

  // Re-render every 30s so "Minutes Away" counts down instead of freezing
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <Card sx={{ borderRadius: '25px' }}>
          <CardHeader
              title="Schedule"
              slotProps={{
                title: {
                  align: 'center',
                  sx: { fontFamily: 'Train One', fontWeight: 400, fontStyle: 'normal' },
                },
              }}
          />
          <CardContent>
            <TableContainer>
              <Table sx={{ minWidth: 700 }} aria-label="Train schedule">
                <TableHead>
                  <TableRow>
                    <TableCell>Route</TableCell>
                    <TableCell>Destination</TableCell>
                    <TableCell>Frequency (min)</TableCell>
                    <TableCell>Next Arrival</TableCell>
                    <TableCell>Minutes Away</TableCell>
                    <TableCell>Live Status</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {schedule.map((route) => {
                    const arrival = calculateNextArrival(route.firstService, route.frequency);

                    return (
                        <TableRow key={route.id}>
                          <TableCell>{route.name || '--'}</TableCell>
                          <TableCell>{route.destination || '--'}</TableCell>
                          <TableCell>{route.frequency || '--'}</TableCell>
                          <TableCell>{arrival?.nextArrival || '--'}</TableCell>
                          <TableCell>{arrival?.minutesAway || '--'}</TableCell>
                          <TableCell>{route.trainNum ? <LiveStatusChip trainNum={route.trainNum} /> : '--'}</TableCell>
                          <TableCell>
                            <Button onClick={() => deleteRoute(route.id)} aria-label={`Delete ${route.name}`}>
                              <DeleteIcon fontSize="small" />
                            </Button>
                          </TableCell>
                        </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Box>
  );
};

export default Schedule;