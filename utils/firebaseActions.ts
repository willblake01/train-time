import { initializeApp } from 'firebase/app'
import { firebaseConfig } from "./firebaseConfig";
import { getDatabase, onValue, push, ref, remove, set } from "firebase/database";

 // Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database and get a reference to the service
const database = getDatabase(app);

  interface AddRouteProps {
  name: string;
  destination: string;
  firstService: string;
  frequency: number;
  nextArrival: string;
  minutesAway: number;
  timeAdded: object;
}

export interface Route {
  id: string;
  name: string;
  destination: string;
  firstService: string;
  frequency: number;
}

export const subscribeToRoutes = (onChange: (value: (((prevState: Route[]) => Route[]) | Route[])) => void) => {
  const routesRef = ref(database, 'routes'); // use your actual path
  return onValue(routesRef, (snapshot) => {
    const data = snapshot.val() ?? {};
    const routes = Object.entries(data).map(([id, value]) => ({
      id,
      ...(value as Omit<Route, 'id'>),
    }));
    onChange(routes);
  });
};

// Use the push() method to append data to a list in multiuser applications
export const addRoute = (newRoute: AddRouteProps) => {
  const { name, destination, firstService, frequency, nextArrival, minutesAway, timeAdded } = newRoute

  const postListRef = ref(database, 'routes');
  const newPostRef = push(postListRef);

    const postData = {
    id: newPostRef.key,
    name,
    destination,
    firstService,
    frequency,
    nextArrival,
    minutesAway,
    timeAdded,
  };

  set(newPostRef, postData)
      .then(() => console.log('Route added successfully'))
      .catch((e) => console.error('Error adding route:', e));
}

export const deleteRoute = (id: string): void => {
  const routesRef = ref(database, 'routes/' + id)
  remove(routesRef).then(() => console.log('Route deleted successfully')).catch((e) => console.error('Error deleting route:', e));
}
