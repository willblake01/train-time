import { Chip } from '@mui/material';
import type { LiveStatus } from '../utils/amtrak';
import { formatTime } from '../utils/time';

// Presentational only: give it a train, it renders the status
const TrainStatusChip = ({ train }: { train?: LiveStatus }) => {
  if (!train) return <Chip size="small" label="No live data" />;

  const stop = train.nextStop;
  if (!stop) return <Chip size="small" label={train.state === 'Predeparture' ? 'Not departed' : train.state} />;

  const late = stop.delayMinutes;
  // Times use the station's own time zone, so server and browser render the same text
  const eta = stop.estimated ? formatTime(stop.estimated, stop.tz) : '';

  return (
    <Chip
      size="small"
      color={late > 15 ? 'error' : late > 5 ? 'warning' : 'success'}
      label={`${stop.name}${eta ? ` ${eta}` : ''} · ${late > 0 ? `${late} min late` : 'on time'}`}
    />
  );
};

export default TrainStatusChip;
