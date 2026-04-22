import React from 'react';
import Jumbotron from '../components/Jumbotron';
import Schedule from '../components/Schedule';
import AddRoute from '../components/AddRoute';
import { Box, Grid2 } from '@mui/material';

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
      <Grid2 container spacing={2}>
      <Grid2 size={12}>
        <Jumbotron />
      </Grid2>
      <Grid2 size={8}>
        <Schedule />
      </Grid2>
      <Grid2 size={4}>
        <AddRoute />
      </Grid2>
    </Grid2>
  </Box>
  </Box>
) 

export default Landing;
