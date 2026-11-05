import type { GetStaticProps, InferGetStaticPropsType } from 'next';
import { Box, Grid } from '@mui/material';
import Jumbotron from '../components/Jumbotron';
import DepartureBoard from '../components/DepartureBoard';
import Schedule from '../components/Schedule';
import AddRoute from '../components/AddRoute';
import { departuresFromTrains, stationsFromTrains, type Departure, type StationOption } from '../utils/departures';
import { getAllTrainsCached } from '../utils/amtrakServer';

// A busy hub, so the board always has trains on it when someone visits
const DEFAULT_STATION = 'CHI';

interface LandingProps {
    stations: StationOption[];
    initialDepartures: Departure[];
}

export const getStaticProps: GetStaticProps<LandingProps> = async () => {
    try {
        const trains = await getAllTrainsCached();
        return {
            props: {
                stations: stationsFromTrains(trains),
                initialDepartures: departuresFromTrains(trains, DEFAULT_STATION),
            },
            revalidate: 60,
        };
    } catch (e) {
        console.error('Could not load Amtrak trains:', e);
        return { props: { stations: [], initialDepartures: [] }, revalidate: 10 };
    }
};

const Landing = ({ stations, initialDepartures }: InferGetStaticPropsType<typeof getStaticProps>) => (
    <Box sx={{ minHeight: '100vh' }}>
        {/* Fixed background: stays put and covers the viewport however long the page gets */}
        <Box
            aria-hidden
            sx={{
                position: 'fixed',
                inset: 0,
                zIndex: -1,
                backgroundImage: "url('https://res.cloudinary.com/willblake01/image/upload/q_auto/f_auto/v1776874034/train-time/train.webp')",
                backgroundSize: 'cover',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                filter: 'blur(4px)',
                transform: 'scale(1.05)', // hides the soft edges the blur creates
            }}
        />

        <Box sx={{ p: 2 }}>
            <Grid container spacing={2}>
                <Grid size={12}>
                    <Jumbotron />
                </Grid>
                <Grid size={12}>
                    <DepartureBoard stations={stations} initialStation={DEFAULT_STATION} initialDepartures={initialDepartures} />
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
);

export default Landing;