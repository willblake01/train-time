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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import TrainStatusChip from './TrainStatusChip';

const LiveStatusChip = ({ trainNum }: { trainNum: string }) => {
  const [train] = useLiveStatus(trainNum);
  return <TrainStatusChip train={train} />;
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