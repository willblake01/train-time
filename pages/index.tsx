import { useRef, useState } from 'react';
import type { GetStaticProps, InferGetStaticPropsType } from 'next';
import { Box, Grid } from '@mui/material';
import { AddToTripDialogue, DepartureBoard, Jumbotron, MyTrips, NewTrip } from '../components';
import { departuresFromTrains, stationsFromTrains, type Departure, type StationOption } from '../utils/departures';
import { getAllTrainsCached } from '../utils/amtrakServer';
import { formatTime } from '../utils/time';
import { nextLegStart, type NewLeg, type Trip } from '../utils/trips';
import { useTrips } from '../utils/useTrips';

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

const Landing = ({ stations, initialDepartures }: InferGetStaticPropsType<typeof getStaticProps>) => {
    const { trips } = useTrips();
    const [boardStation, setBoardStation] = useState(DEFAULT_STATION);
    // When building a trip: only show trains leaving after the last leg arrives
    const [connection, setConnection] = useState<{ after: string; tz: string } | null>(null);
    // The train picked on the board, while the Add to trip dialog is open
    const [selected, setSelected] = useState<Departure | null>(null);
    // The trip legs are being added to; preselected in the dialog
    const [activeTripId, setActiveTripId] = useState<string>();
    const boardRef = useRef<HTMLDivElement>(null);

    const activeTrip = trips.find((t) => t.id === activeTripId);

    const changeStation = (code: string) => {
        setBoardStation(code);
        setConnection(null);
    };

    const stopAdding = () => {
        setActiveTripId(undefined);
        setConnection(null);
    };

    // "Add leg" on a trip: move the board to where its next leg has to leave from
    const startAddingLeg = (trip: Trip) => {
        setActiveTripId(trip.id);
        const start = nextLegStart(trip);
        const last = trip.legs.at(-1);
        if (start) setBoardStation(start.station);
        setConnection(start?.after && last ? { after: start.after, tz: last.to.tz } : null);
        boardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // After a leg is saved, carry on from where it arrives, unless the trip is complete
    const continueAfter = (tripId: string, leg: NewLeg) => {
        const reachedDestination = trips.find((t) => t.id === tripId)?.to === leg.to.code;
        if (reachedDestination) {
            stopAdding();
            return;
        }
        setActiveTripId(tripId);
        setBoardStation(leg.to.code);
        setConnection({ after: leg.to.time, tz: leg.to.tz });
    };

    return (
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
                        <div ref={boardRef} style={{ scrollMarginTop: 16 }}>
                            <DepartureBoard
                                key={`${boardStation}|${connection?.after ?? ''}`}
                                stations={stations}
                                station={boardStation}
                                onStationChange={changeStation}
                                after={connection?.after}
                                // The server preloads only the default station's trains, unfiltered
                                initialDepartures={boardStation === DEFAULT_STATION && !connection ? initialDepartures : undefined}
                                addingTo={
                                    activeTrip && {
                                        tripName: activeTrip.name,
                                        afterLabel: connection ? formatTime(connection.after, connection.tz) : undefined,
                                        onShowAll: () => setConnection(null),
                                        onDone: stopAdding,
                                    }
                                }
                                onSelect={setSelected}
                            />
                        </div>
                    </Grid>
                    <Grid size={{ xs: 12, md: 8 }}>
                        <MyTrips onAddLeg={startAddingLeg} activeTripId={activeTripId} />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                        <NewTrip
                            stations={stations}
                            onCreated={(departureCode, tripId) => {
                                setActiveTripId(tripId);
                                changeStation(departureCode);
                            }}
                        />
                    </Grid>
                </Grid>
            </Box>

            {selected && (
                <AddToTripDialogue
                    key={selected.trainID}
                    departure={selected}
                    trips={trips}
                    stations={stations}
                    defaultTripId={activeTripId}
                    onClose={() => setSelected(null)}
                    onSaved={({ tripId, leg }) => {
                        setSelected(null);
                        continueAfter(tripId, leg);
                    }}
                />
            )}
        </Box>
    );
};

export default Landing;