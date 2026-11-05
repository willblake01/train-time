import { Card, CardContent, Typography } from '@mui/material';
import { RAIL_FONT } from '../styles/theme';

const Jumbotron = () => (
    <Card sx={{ borderRadius: '25px', width: '100%' }}>
        <CardContent sx={{ textAlign: 'center' }}>
            <Typography
                variant="h1"
                sx={{ fontFamily: RAIL_FONT, fontWeight: 400, fontSize: { xs: '2.5rem', md: '4rem' } }}
            >
                TRAIN TIME
            </Typography>
            <Typography variant="subtitle1" component="p" sx={{ color: 'text.secondary' }}>
                Live Amtrak departures &amp; trip tracking
            </Typography>
        </CardContent>
    </Card>
);

export default Jumbotron;