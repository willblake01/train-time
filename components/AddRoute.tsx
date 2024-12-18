import React from 'react';
import firebase from "firebase/compat/app";
import moment from 'moment';
import { Box, Button, Card, CardContent, CardHeader, TextField } from '@mui/material';
import { addRoute } from '../utils/firebaseActions';

const AddRoute = () => {
  interface FormElements extends HTMLFormControlsCollection {
    nameInput: HTMLInputElement;
    destinationInput: HTMLInputElement;
    firstServiceInput: HTMLInputElement;
    frequencyInput: HTMLInputElement;
  }

  interface TrainFormElement extends HTMLFormElement {
    elements: FormElements;
  }

  const submitForm = (e: React.FormEvent<TrainFormElement>) => {
    e.preventDefault();

    // Calculate next arrival time and minutes away using moment.js
    const firstService = e.currentTarget.elements.firstServiceInput.value
    const frequency = parseInt(e.currentTarget.elements.frequencyInput.value, 10);
    const firstTrainTimeConverted = moment(firstService, "hh:mm").subtract(1, "years");
    const diffTime = moment().diff(moment(firstTrainTimeConverted), "minutes");
    const tRemainder = diffTime % frequency;
    const minutesAway = frequency - tRemainder;
    const nextArrival = moment().add(minutesAway, "minutes").format("hh:mm A");
    const newRoute = {
      name: e.currentTarget.elements.nameInput.value,
      destination: e.currentTarget.elements.destinationInput.value,
      firstService,
      frequency,
      minutesAway,
      nextArrival,
      timeAdded: firebase.database.ServerValue.TIMESTAMP
    };
    addRoute(newRoute);
    
    (e.target as HTMLFormElement).reset();
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <Card sx={{ borderRadius: '25px' }}>
        <CardHeader align='center' title="Add Route" titleTypographyProps={{ fontFamily: 'Train One',
        fontWeight: '400',
        fontStyle: 'normal'
      }} />
      <CardContent>
        <form role={"form"} onSubmit={submitForm}>
          <Box component="section" sx={{ p: 1, display: 'flex', flexDirection: 'column', width: 'maxContent' }}>
            <label htmlFor="nameInput" style={{ marginBottom: '12px' }}><h4>Route</h4></label>
            <TextField required id="nameInput" variant="outlined" />
          </Box>
          <Box component="section" sx={{ p: 1, display: 'flex', flexDirection: 'column', width: 'maxContent' }}>
            <label htmlFor="destinationInput" style={{ marginBottom: '12px' }}><h4>Destination</h4></label>
            <TextField required id="destinationInput" variant="outlined" />
          </Box>
          <Box component="section" sx={{ p: 1, display: 'flex', flexDirection: 'column', width: 'maxContent' }}>
            <label htmlFor="firstServiceInput" style={{ marginBottom: '12px' }}><h4>First Service (HH:mm - military time)</h4></label>
            <TextField required id="firstServiceInput" variant="outlined" />
          </Box>
          <Box component="section" sx={{ p: 1, display: 'flex', flexDirection: 'column', width: 'maxContent' }}>
            <label htmlFor="frequencyInput" style={{ marginBottom: '12px' }}><h4>Frequency (min)</h4></label>
            <TextField required id="frequencyInput" variant="outlined" />
          </Box>
          <Box component="section" sx={{ marginLeft: 2, display: 'flex', width: 'maxContent' }}>
            <Button type="submit" variant='outlined' size='large' sx={{ display: 'flex', marginTop: '20px', width: 'maxContent' }}>Submit</Button>
          </Box>
        </form>
      </CardContent>
    </Card>
    </Box>
  )
}

export default AddRoute;
