// ============================================================
// helpers/parseId.js - Μετατροπή ID για MongoDB Queries
// ============================================================
// Η βάση μας έχει έγγραφα με δύο διαφορετικούς τύπους _id:
//
//   Παλιά έγγραφα: _id = 1, 2, 3 (Number)
//     → Δημιουργήθηκαν πριν χρησιμοποιούμε το POST endpoint
//
//   Νέα έγγραφα: _id = "64abc123def..." (MongoDB ObjectId, 24χαρ hex)
//     → Δημιουργούνται αυτόματα από τη MongoDB μέσω insertOne()
//
// Το πρόβλημα:
//   Όταν το frontend στέλνει ένα id στο URL (π.χ. PUT /api/users/3),
//   το Express το παίρνει ως STRING "3". Αν προσπαθήσουμε να
//   ψάξουμε { _id: "3" } στη MongoDB, δεν θα βρούμε το έγγραφο
//   που έχει { _id: 3 } (Number). Πρέπει να μετατρέψουμε σωστά.
//
// Παράμετροι:
//   id: string (όπως έρχεται από το req.params.id)
//
// Επιστρέφει:
//   ObjectId | Number | string (ο κατάλληλος τύπος για MongoDB query)
// ============================================================

import { ObjectId } from "mongodb";

function parseId(id) {
  // Αν είναι 24χαρακτήρο hex string → είναι MongoDB ObjectId
  // Το ObjectId.isValid() ελέγχει τη μορφή, το length === 24
  // διασφαλίζει ότι δεν είναι κάποιο άλλο valid format
  if (ObjectId.isValid(id) && id.length === 24) {
    return new ObjectId(id);
  }

  // Αν είναι αριθμός σε string μορφή (π.χ. "1", "2", "3")
  // → το μετατρέπουμε σε Number για να ταιριάξει με παλιά έγγραφα
  if (!isNaN(Number(id))) {
    return Number(id);
  }

  // Αλλιώς → το επιστρέφουμε ως string (για κάθε άλλη περίπτωση)
  return id;
}

export { parseId };
