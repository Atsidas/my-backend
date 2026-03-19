// ============================================================
// helpers/db.js - Διαχείριση Σύνδεσης με τη Βάση Δεδομένων
// ============================================================
// Αυτό το module κεντρώνει ΟΛΑ όσα σχετίζονται με τη σύνδεση
// στη MongoDB. Έτσι αν αλλάξει το όνομα της βάσης, του
// collection, ή ο τρόπος σύνδεσης, αλλάζουμε ΜΟΝΟ εδώ.
//
// Εξάγει (exports):
//   client       → ο MongoDB client (χρειάζεται για connect())
//   getCollection → επιστρέφει το collection έτοιμο για queries
// ============================================================

import { MongoClient } from "mongodb";
import dotenv from "dotenv";

// Το dotenv.config() πρέπει να καλείται ΕΔΩ και όχι μόνο στο server.js.
// Με ES Modules όλα τα imports εκτελούνται ΠΡΙΝ τον υπόλοιπο κώδικα,
// οπότε όταν το db.js τρέχει το new MongoClient(), το dotenv.config()
// στο server.js δεν έχει τρέξει ακόμα → process.env.MONGO_URI = undefined.
// Καλώντας το εδώ, διασφαλίζουμε ότι το .env έχει φορτωθεί
// πριν δημιουργηθεί ο MongoClient.
dotenv.config();

// Διαβάζουμε το URI από το .env - ποτέ δεν το γράφουμε hardcoded!
const uri = process.env.MONGO_URI;

// Δημιουργούμε τον client ΜΙΑ ΦΟΡΑ και τον επαναχρησιμοποιούμε.
// Δεν δημιουργούμε νέο client σε κάθε request — αυτό θα ήταν
// πολύ αργό και θα εξάντλούσε τις διαθέσιμες συνδέσεις.
const client = new MongoClient(uri);

// ------------------------------------------------------------
// getCollection - Επιστρέφει το collection έτοιμο για χρήση
// ------------------------------------------------------------
// Αντί να γράφουμε client.db("myapp").collection("mycollection")
// παντού στον κώδικα, χρησιμοποιούμε αυτή τη συνάρτηση.
// Αν αλλάξει το όνομα της βάσης ή του collection,
// αλλάζουμε μόνο εδώ.
function getCollection() {
  return client.db("myapp").collection("mycollection");
}

// Εξάγουμε και τα δύο για χρήση στο server.js
export { client, getCollection };
