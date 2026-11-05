import React from 'react';
import { serverTimestamp } from 'firebase/database';
import moment from 'moment';
import { Box, Button, Card, CardContent, CardHeader, TextField } from '@mui/material';
import { addRoute } from '../utils/firebaseActions';

interface FormElements extends HTMLFormControlsCollection {
  nameInput: HTMLInputElement;
  destinationInput: HTMLInputElement;
  firstServiceInput: HTMLInputElement;
  frequencyInput: HTMLInputElement;
}

interface TrainFormElement extends HTMLFormElement {
  elements: FormElements;
}

const AddRoute = () => {
  const submitForm: React.ComponentProps<'form'>['onSubmit'] = (e) => {
    e.preventDefault();

    const form = e.currentTarget as TrainFormElement;
    const { nameInput, destinationInput, firstServiceInput, frequencyInput } = form.elements;

    // Calculate next arrival time and minutes away using moment.js
    const firstService = firstServiceInput.value;
    const frequency = parseInt(frequencyInput.value, 10);
    const firstTrainTimeConverted = moment(firstService, 'HH:mm').subtract(1, 'years');
    const diffTime = moment().diff(firstTrainTimeConverted, 'minutes');
    const tRemainder = diffTime % frequency;
    const minutesAway = frequency - tRemainder;
    const nextArrival = moment().add(minutesAway, 'minutes').format('hh:mm A');

    const newRoute = {
      name: nameInput.value,
      destination: destinationInput.value,
      firstService,
      frequency,
      minutesAway,
      nextArrival,
      timeAdded: serverTimestamp(),
    };

    addRoute(newRoute);
    form.reset();
  };

  const sectionSx = { p: 1, display: 'flex', flexDirection: 'column', width: 'max-content' } as const;

  return (
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <Card sx={{ borderRadius: '25px' }}>
          <CardHeader
              title="Add Route"
              slotProps={{
                title: {
                  align: 'center',
                  sx: { fontFamily: 'Train One', fontWeight: 400, fontStyle: 'normal' },
                },
              }}
          />
          <CardContent>
            <form onSubmit={submitForm}>
              <Box component="section" sx={sectionSx}>
                <label htmlFor="nameInput" style={{ marginBottom: '12px' }}><h4>Route</h4></label>
                <TextField required id="nameInput" variant="outlined" />
              </Box>
              <Box component="section" sx={sectionSx}>
                <label htmlFor="destinationInput" style={{ marginBottom: '12px' }}><h4>Destination</h4></label>
                <TextField required id="destinationInput" variant="outlined" />
              </Box>
              <Box component="section" sx={sectionSx}>
                <label htmlFor="firstServiceInput" style={{ marginBottom: '12px' }}><h4>First Service (HH:mm - military time)</h4></label>
                <TextField required id="firstServiceInput" variant="outlined" />
              </Box>
              <Box component="section" sx={sectionSx}>
                <label htmlFor="frequencyInput" style={{ marginBottom: '12px' }}><h4>Frequency (min)</h4></label>
                <TextField required id="frequencyInput" variant="outlined" type="number" />
              </Box>
              <Box component="section" sx={{ marginLeft: 2, display: 'flex', width: 'max-content' }}>
                <Button type="submit" variant="outlined" size="large" sx={{ display: 'flex', marginTop: '20px', width: 'max-content' }}>
                  Submit
                </Button>
              </Box>
            </form>
          </CardContent>
        </Card>
      </Box>
  );
};

export default AddRoute;