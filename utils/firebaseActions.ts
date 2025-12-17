import { initializeApp } from 'firebase/app'
import { firebaseConfig } from "./firebaseConfig.ts";
import { getDatabase, onValue, push, ref, remove, set } from "firebase/database";

 // Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database and get a reference to the service
const database = getDatabase(app);

export const fetchRoutes = ({ setSchedule }) => {
  let schedule: Object[] = []

  // Read data from Firebase
  const routesRef = ref(database, 'routes/')
  onValue(routesRef, (snapshot) => {
    const database = snapshot.val() || []
    const schedule = Object.values(database)
    setSchedule(schedule)
  }, (errorObject) => {
    console.log("Errors handled: " + errorObject)
  })
  return schedule
}

  interface AddRouteProps {
  name: string;
  destination: string;
  firstService: string;
  frequency: number;
  nextArrival: string;
  minutesAway: number;
  timeAdded: object;
}

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
  
  set(newPostRef, postData);
}

export const deleteRoute = (id: String): void => {
  const routesRef = ref(database, 'routes/' + id)
  remove(routesRef)
}
