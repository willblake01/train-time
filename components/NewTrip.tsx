import React, { useState } from 'react';
import { Autocomplete, Box, Button, Card, CardContent, CardHeader, TextField } from '@mui/material';
import { createTrip } from '../utils/firebaseActions';
import type { StationOption } from '../utils/departures';

interface FormElements extends HTMLFormControlsCollection {
  nameInput: HTMLInputElement;
}

interface TrainFormElement extends HTMLFormElement {
  elements: FormElements;
}

interface NewTripProps {
  stations: StationOption[];
  onCreated?: (departureCode: string, tripId: string) => void;
}

const sectionSx = { p: 1, display: 'flex', flexDirection: 'column' } as const;
const labelStyle = { marginBottom: '12px' };

const NewTrip = ({ stations, onCreated }: NewTripProps) => {
  const [departure, setDeparture] = useState<StationOption | null>(null);
  const [destination, setDestination] = useState<StationOption | null>(null);
  const sameStation = Boolean(departure && destination && departure.code === destination.code);

  const submitForm: React.ComponentProps<'form'>['onSubmit'] = (e) => {
    e.preventDefault();
    if (!departure || !destination || sameStation) return;

    const form = e.currentTarget as TrainFormElement;
    const { nameInput } = form.elements;

    createTrip({ name: nameInput.value, from: departure.code, to: destination.code })
        .then((tripId) => onCreated?.(departure.code, tripId))
        .catch((err) => console.error('Error creating trip:', err));

    form.reset();
    setDeparture(null);
    setDestination(null);
  };

  const stationProps = {
    options: stations,
    getOptionLabel: (option: StationOption) => `${option.name} (${option.code})`,
    isOptionEqualToValue: (option: StationOption, value: StationOption) => option.code === value.code,
    fullWidth: true,
  };

  return (
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <Card sx={{ borderRadius: '25px' }}>
          <CardHeader
              title="New Trip"
              slotProps={{
                title: {
                  align: 'center',
                },
              }}
          />
          <CardContent>
            <form onSubmit={submitForm}>
              <Box component="section" sx={sectionSx}>
                <label htmlFor="nameInput" style={{ ...labelStyle, fontWeight: 700 }}>Name</label>
                <TextField required id="nameInput" variant="outlined" />
              </Box>
              <Box component="section" sx={sectionSx}>
                <label htmlFor="departInput" style={{ ...labelStyle, fontWeight: 700 }}>Departure</label>
                <Autocomplete
                    {...stationProps}
                    id="departInput"
                    value={departure}
                    onChange={(_, option) => setDeparture(option)}
                    renderInput={(params) => <TextField {...params} required variant="outlined" />}
                />
              </Box>
              <Box component="section" sx={sectionSx}>
                <label htmlFor="destinationInput" style={{ ...labelStyle, fontWeight: 700 }}>Destination</label>
                <Autocomplete
                    {...stationProps}
                    id="destinationInput"
                    value={destination}
                    onChange={(_, option) => setDestination(option)}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            required
                            variant="outlined"
                            error={sameStation}
                            helperText={sameStation ? 'Choose a different destination' : undefined}
                        />
                    )}
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

export default NewTrip;