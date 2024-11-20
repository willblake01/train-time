import React from 'react';
import { Card, CardContent } from '@mui/material';

const Jumbotron = () => (
  <Card className='jumbotron' sx={{ borderRadius: '25px', justifyContent: 'center', width: '100%' }}>
    <CardContent sx={{ textAlign: 'center' }}>
      <h1>TRAIN TIME</h1>
      <h4>Railroad schedule management</h4>
    </CardContent>
  </Card>
)

export default Jumbotron;
