$(document).ready(function() {

  	// Initialize Firebase
  	var config = {
    	apiKey: "AIzaSyAkKPAuwpZsERSa0UXWrSDCKX-Gixlz0YI",
    	authDomain: "train-time-b9a07.firebaseapp.com",
    	databaseURL: "https://train-time-b9a07.firebaseio.com",
    	projectId: "train-time-b9a07",
    	storageBucket: "",
    	messagingSenderId: "202093288609"
  	};
  	firebase.initializeApp(config);

  	// Create a variable to reference the database.
    var database = firebase.database();

    // Initial Values
    var trainName = "";
    var destination = "";
    var firstTrainTime = "";
    var frequency = "";

    // Capture Button Click
    $("#add-train").on("click", function(event) {
      event.preventDefault();

      // Grabbed values from text boxes
      trainName = $("#train-input").val().trim();
      destination = $("#destination-input").val().trim();
      firstTrainTime = $("#first-train-time-input").val().trim();
      frequency = $("#frequency-input").val().trim();

      // Clear field input on submit
      $("#train-input").val("");
      $("#destination-input").val("");
      $("#first-train-time-input").val("");
      $("#frequency-input").val("");

      // Calculate next arrival time and minutes away using moment.js
      var firstTrainTimeConverted = moment(firstTrainTime, "hh:mm").subtract(1, "years");
      var currentTime = moment();
      var diffTime = moment().diff(moment(firstTrainTimeConverted), "minutes");
      var tRemainder = diffTime % frequency;
      var minutesAway = frequency - tRemainder;
      var nextArrival = moment().add(minutesAway, "minutes");
      var nextTrain = moment(nextArrival).format("hh:mm A");


      // Code for handling the push
      database.ref().push({
        trainName: trainName,
        destination: destination,
        firstTrainTime: firstTrainTime,
        frequency: frequency,
        nextTrain: nextTrain,
        minutesAway: minutesAway,
        dateAdded: firebase.database.ServerValue.TIMESTAMP
      });

    });

    // Firebase watcher + initial loader + order/limit HINT: .on("child_added"
    database.ref().orderByChild("dateAdded").limitToLast(10).on("child_added", function(snapshot) {
      // storing the snapshot.val() in a variable for convenience
      var sv = snapshot.val();

      // Console.loging the last train's data
      console.log(sv.trainName);
      console.log(sv.destination);
      console.log(sv.firstTrainTime);
      console.log(sv.frequency);
      console.log(sv.nextTrain);
      console.log(sv.minutesAway);

      // Change the HTML to reflect new train data
      $("#train-table").prepend("<tr>" + "<td>" + sv.trainName + "</td>" + "<td>" + sv.destination + "</td>" + "<td>" + sv.frequency + "</td>" + "<td>" + sv.nextTrain + "</td>" + "<td>" + sv.minutesAway + "</td>" + "</tr>");

      // Handle the errors
    }, function(errorObject) {
      console.log("Errors handled: " + errorObject.code);
    });

});