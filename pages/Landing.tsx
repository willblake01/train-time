import React from 'react';
import { AddRoute, Jumbotron, Schedule } from '../components';
import { Box, Grid } from '@mui/material';

const Landing = () => (
  <Box sx={{
    height: '100vh',
    width: '100vw', 
  }}>
    <Box sx={{
      position: 'absolute',
      zIndex: -1,
      display: 'flex',
      backgroundImage: "url('https://res.cloudinary.com/willblake01/image/upload/q_auto/f_auto/v1776874034/train-time/train.webp')",
      backgroundSize: 'cover',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      filter: 'blur(4px)',
    }}></Box>
    <Box sx={{ flexGrow: 1, p: 2 }}>
      <Grid container spacing={2}>
      <Grid size={12}>
        <Jumbotron />
      </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
        <Schedule />
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <AddRoute />
      </Grid>
    </Grid>
  </Box>
  </Box>
) 

export default Landing;
