import React from 'react';
import { serverTimestamp } from 'firebase/database';
import { Box, Button, Card, CardContent, CardHeader, TextField } from '@mui/material';
import { addRoute } from '../utils/firebaseActions';

interface FormElements extends HTMLFormControlsCollection {
  nameInput: HTMLInputElement;
  destinationInput: HTMLInputElement;
  firstServiceInput: HTMLInputElement;
  frequencyInput: HTMLInputElement;
  trainNumberInput: HTMLInputElement;
}

interface TrainFormElement extends HTMLFormElement {
  elements: FormElements;
}

const sectionSx = { p: 1, display: 'flex', flexDirection: 'column', width: 'max-content' } as const;
const labelStyle = { marginBottom: '12px' };

const AddRoute = () => {
  const submitForm: React.ComponentProps<'form'>['onSubmit'] = (e) => {
    e.preventDefault();

    const form = e.currentTarget as TrainFormElement;
    const { nameInput, destinationInput, firstServiceInput, frequencyInput, trainNumberInput } = form.elements;
    const trainNum = trainNumberInput.value.trim();

    addRoute({
      name: nameInput.value.trim(),
      destination: destinationInput.value.trim(),
      firstService: firstServiceInput.value.trim(),
      frequency: parseInt(frequencyInput.value, 10),
      timeAdded: serverTimestamp(),
      ...(trainNum && { trainNum }),
    });

    form.reset();
  };

  return (
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <Card sx={{ borderRadius: '25px' }}>
          <CardHeader
              title="Add Route"
              slotProps={{
                title: {
                  align: 'center',
                },
              }}
          />
          <CardContent>
            <form onSubmit={submitForm}>
              <Box component="section" sx={sectionSx}>
                <label htmlFor="nameInput" style={labelStyle}><h4>Route</h4></label>
                <TextField required id="nameInput" variant="outlined" />
              </Box>
              <Box component="section" sx={sectionSx}>
                <label htmlFor="destinationInput" style={labelStyle}><h4>Destination</h4></label>
                <TextField required id="destinationInput" variant="outlined" />
              </Box>
              <Box component="section" sx={sectionSx}>
                <label htmlFor="firstServiceInput" style={labelStyle}><h4>First Service (HH:mm - military time)</h4></label>
                <TextField
                    required
                    id="firstServiceInput"
                    variant="outlined"
                    placeholder="08:30"
                    slotProps={{ htmlInput: { pattern: '([01]\\d|2[0-3]):[0-5]\\d', title: 'Use 24-hour HH:mm, e.g. 08:30 or 15:45' } }}
                />
              </Box>
              <Box component="section" sx={sectionSx}>
                <label htmlFor="frequencyInput" style={labelStyle}><h4>Frequency (min)</h4></label>
                <TextField
                    required
                    id="frequencyInput"
                    variant="outlined"
                    type="number"
                    slotProps={{ htmlInput: { min: 1 } }}
                />
              </Box>
              <Box component="section" sx={sectionSx}>
                <label htmlFor="trainNumberInput" style={labelStyle}><h4>Amtrak Train # (optional)</h4></label>
                <TextField
                    id="trainNumberInput"
                    variant="outlined"
                    placeholder="e.g. 21"
                    slotProps={{ htmlInput: { inputMode: 'numeric', pattern: '\\d{1,4}', title: 'Up to 4 digits' } }}
                />
              </Box>
              <Box component="section" sx={{ marginLeft: 2, display: 'flex', width: 'max-content' }}>
                <Button type="submit" variant="outlined" size="large" sx={{ marginTop: '20px' }}>
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