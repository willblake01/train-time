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


      // Code for handling the push
      database.ref().push({
        trainName: trainName,
        destination: destination,
        firstTrainTime: firstTrainTime,
        frequency: frequency,
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

      // Change the HTML to reflect new train data
      $("#train-table").prepend("<tr>" + "<td>" + sv.trainName + "</td>" + "<td>" + sv.destination + "</td>" + "<td>" + sv.frequency + "</td>" + "<td>" + "nextArrival" + "</td>" + "<td>" + "minutesAway" + "</td>" + "</tr>");

      // Handle the errors
    }, function(errorObject) {
      console.log("Errors handled: " + errorObject.code);
    });

});