import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
const App = initializeApp({
  apiKey: "AIzaSyDKkotc73pHhHaHCFtR_PcSSaVYEmo0Ois",
  authDomain: "callapp-c3ce9.firebaseapp.com",
  projectId: "callapp-c3ce9",
  storageBucket: "callapp-c3ce9.appspot.com",
  messagingSenderId: "445189571255",
  appId: "1:445189571255:web:3527594afe573519504332",
});
const db = getFirestore(App);
export { db };
