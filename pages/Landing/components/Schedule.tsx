import React, { useEffect, useState } from 'react';
import moment from 'moment';
import { fetchRoutes, deleteRoute } from '../../../utils/firebaseActions';
import { Box, Button, Card, CardContent, CardHeader, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TablePagination, TableRow } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

interface Route {
  id: string;
  name: string;
  destination: string;
  firstService: string;
  frequency: number;
  nextArrival: string;
  minutesAway: number;
  timeAdded: object;
}

const calculateMinutesAwayNextArrival = (route: Route) => {
  const firstService = route.firstService
  const frequency = route.frequency
  const firstServiceConverted = moment(firstService, "hh:mm").subtract(1, "years");
  const diffTime = moment().diff(moment(firstServiceConverted), "minutes");
  const tRemainder = diffTime % frequency;
  const minutesAway = frequency - tRemainder;
  const nextArrival = moment().add(minutesAway, "minutes").format("hh:mm A");

  return { minutesAway, nextArrival }
}

const Schedule = () => {
  const [schedule, setSchedule] = useState([]);

  useEffect(() => {
    const firebaseData = fetchRoutes({setSchedule})
    setSchedule(firebaseData)
  }, [])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <Card sx={{ borderRadius: '25px' }}>
      <CardHeader align='center' title="Schedule" titleTypographyProps={{
        fontFamily: 'Train One',
        fontWeight: '400',
        fontStyle: 'normal'
      }} />
      <CardContent>
        <TableContainer>
          <Table sx={{ minWidth: 700 }} aria-label="customized table">
            <TableHead>
              <TableRow>
                <TableCell>Route</TableCell>
                <TableCell>Destination</TableCell> 
                <TableCell>Frequency (min)</TableCell>
                <TableCell>Next Arrival</TableCell>
                <TableCell>Minutes Away</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {schedule?.map((route, index) => {
                const { minutesAway, nextArrival } = calculateMinutesAwayNextArrival(route)
                return (
                  <TableRow key={`${index}-${route.timeAdded}`}>
                    <TableCell>{route.name || '--'}</TableCell>
                    <TableCell>{route.destination || '--'}</TableCell>
                    <TableCell>{route.frequency || '--'}</TableCell>
                    <TableCell>{nextArrival || '--'}</TableCell>
                    <TableCell>{minutesAway || '--'}</TableCell>
                    <TableCell>
                      <Button onClick={() => deleteRoute(route.id)}>
                        <DeleteIcon fontSize='small' />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
            <TableFooter>
              {/* <TablePagination rowsPerPageOptions={[10, 25]} /> */}
            </TableFooter>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
    </Box>
  )
}

export default Schedule;
