import firebase from "firebase/compat/app";
import "firebase/compat/database";
import { firebaseConfig } from "./firebaseConfig";
import { getDatabase, onValue, push, ref, remove, set } from "firebase/database";

 // Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Realtime Database and get a reference to the service
const db = getDatabase();

export const fetchRoutes = ({ setSchedule }) => {
  let schedule: Object[] = []

  // Read data from Firebase
  const routesRef = ref(db, 'routes/')
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

  const postListRef = ref(db, 'routes');
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
  const routesRef = ref(db, 'routes/' + id)
  remove(routesRef)
}
