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
      backgroundImage: "url('https://upload.wikimedia.org/wikipedia/commons/2/2f/Amtrak_Auto_Train_52_Passing_Through_Guinea_Station%2C_Virginia.jpg')",
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
