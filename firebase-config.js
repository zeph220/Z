(function () {
    const firebaseConfig = {
        apiKey: "AIzaSyDhfcjt89khZjia9cZ9kVd5lOmFhUCBABY",
        authDomain: "sitepmzm-quiz.firebaseapp.com",
        databaseURL: "https://sitepmzm-quiz-default-rtdb.firebaseio.com",
        projectId: "sitepmzm-quiz",
        storageBucket: "sitepmzm-quiz.firebasestorage.app",
        messagingSenderId: "983570150537",
        appId: "1:983570150537:web:03251c16e13d0514540258"
    };

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    window.siteFirebaseConfig = firebaseConfig;
    window.siteAuth = firebase.auth();
    window.siteDatabase = firebase.database();
})();
