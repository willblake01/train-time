import { initializeApp } from 'firebase/app';
import { getDatabase, onValue, push, ref, remove, set } from 'firebase/database';
import { firebaseConfig } from './firebaseConfig';
import type { LiveStatus } from './amtrak';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database and get a reference to the service
const database = getDatabase(app);

interface AddRouteProps {
  name: string;
  destination: string;
  firstService: string;
  frequency: number;
  timeAdded: object;
  trainNum?: string;
}

export interface Route {
  id: string;
  name: string;
  destination: string;
  firstService: string;
  frequency: number;
  trainNum?: string;
}

export const subscribeToRoutes = (onChange: (routes: Route[]) => void) => {
  const routesRef = ref(database, 'routes');
  return onValue(
      routesRef,
      (snapshot) => {
        const data = snapshot.val() ?? {};
        const routes = Object.entries(data).map(([id, value]) => ({
          id,
          ...(value as Omit<Route, 'id'>),
        }));
        onChange(routes);
      },
      (error) => console.error('Error reading routes:', error),
  );
};

export const subscribeToLiveStatus = (trainNum: string, onChange: (trains: LiveStatus[]) => void) =>
    onValue(
        ref(database, `liveStatus/${trainNum}`),
        (snapshot) => onChange(snapshot.val()?.trains ?? []),
        (error) => console.error('Error reading live status:', error),
    );

// Use the push() method to append data to a list in multiuser applications
export const addRoute = (newRoute: AddRouteProps) => {
  const { name, destination, firstService, frequency, timeAdded, trainNum } = newRoute;

  const postListRef = ref(database, 'routes');
  const newPostRef = push(postListRef);

  const postData = {
    name,
    destination,
    firstService,
    frequency,
    timeAdded,

    // Only include when set: Firebase rejects undefined values
    ...(trainNum && { trainNum }),
  };

  set(newPostRef, postData)
      .then(() => console.log('Route added successfully'))
      .catch((e) => console.error('Error adding route:', e));
};

export const deleteRoute = (id: string): void => {
  const routeRef = ref(database, `routes/${id}`);
  remove(routeRef)
      .then(() => console.log('Route deleted successfully'))
      .catch((e) => console.error('Error deleting route:', e));
};