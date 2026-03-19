// ============================================================
// SERVER.JS - Κεντρικό αρχείο του Backend (Express + MongoDB)
// ============================================================
// Αυτός ο server χειρίζεται όλες τις αιτήσεις (requests) από
// το frontend και επικοινωνεί με τη βάση δεδομένων MongoDB.
// Υλοποιεί πλήρες CRUD:
//   C = Create  → POST   /api/users
//   R = Read    → GET    /api/users
//   U = Update  → PUT    /api/users/:id
//   D = Delete  → DELETE /api/users/:id
// ============================================================

const express = require("express");
const cors = require("cors");
require("dotenv").config();

// Εισάγουμε τα helpers από τον φάκελο helpers/
// Κάθε αρχείο έχει τη δική του ευθύνη (Single Responsibility)
const { client, getCollection } = require("./helpers/db");
const { validateUser } = require("./helpers/validateUser");
const { parseId } = require("./helpers/parseId");

// ------------------------------------------------------------
// 1. ΑΡΧΙΚΟΠΟΙΗΣΗ ΕΦΑΡΜΟΓΗΣ
// ------------------------------------------------------------
// Δημιουργούμε το Express app - αυτό είναι ο "σκελετός" του server μας.
const app = express();

// Middleware: επιτρέπει στο frontend (που τρέχει σε άλλο port)
// να επικοινωνεί με τον server μας χωρίς σφάλματα CORS.
app.use(cors());

// Middleware: δίνει στον server τη δυνατότητα να "διαβάζει" JSON
// που στέλνει το frontend στο body των αιτήσεων (POST, PUT κ.λπ.)
app.use(express.json());

// ------------------------------------------------------------
// 2. ΡΥΘΜΙΣΕΙΣ SERVER
// ------------------------------------------------------------
// Το PORT διαβάζεται από το .env.
// Η σύνδεση MongoDB, το getCollection(), το validateUser()
// και το parseId() έχουν μεταφερθεί στα αντίστοιχα αρχεία:
//   helpers/db.js           → client + getCollection
//   helpers/validateUser.js → validateUser
//   helpers/parseId.js      → parseId
const PORT = process.env.PORT || 4000;

// ------------------------------------------------------------
// Όριο εγγραφών
// ------------------------------------------------------------
// Ορίζουμε το μέγιστο επιτρεπτό αριθμό χρηστών στη βάση.
// Αλλάζοντας ΜΟΝΟ αυτή τη σταθερά ελέγχουμε το όριο σε όλη
// την εφαρμογή — δεν χρειάζεται να ψάχνουμε τον κώδικα.
// Χρήσιμο για το δωρεάν tier του MongoDB Atlas που έχει
// όριο 512MB αποθηκευτικού χώρου.
const MAX_USERS = 100;

// ============================================================
// 3. ROUTES - Οι διαδρομές του API
// ============================================================
// Κάθε route ορίζει:
//   - Τη μέθοδο HTTP (GET, POST, PUT, DELETE)
//   - Το path (π.χ. /api/users)
//   - Τι κάνει όταν λαμβάνει αίτηση

// ------------------------------------------------------------
// READ - Διάβασε όλους τους χρήστες
// ------------------------------------------------------------
// Μέθοδος: GET
// Path: /api/users
// Χρήση: Το frontend καλεί αυτό το endpoint για να φορτώσει τη λίστα.
app.get("/api/users", async (req, res) => {
  try {
    const collection = getCollection();

    // Βρίσκουμε όλα τα έγγραφα στο collection και τα μετατρέπουμε σε array.
    // Χωρίς φίλτρο ({}) επιστρέφονται ΟΛΟΙ οι χρήστες.
    const users = await collection.find({}).toArray();

    // Στέλνουμε τα δεδομένα ως JSON με status 200 (OK)
    res.status(200).json(users);
  } catch (error) {
    console.error("Σφάλμα κατά την ανάκτηση χρηστών:", error);
    // Status 500 = Internal Server Error (κάτι πήγε στραβά στον server)
    res
      .status(500)
      .json({ message: "Σφάλμα στον server κατά την ανάκτηση δεδομένων." });
  }
});

// ------------------------------------------------------------
// CREATE - Δημιούργησε νέο χρήστη
// ------------------------------------------------------------
// Μέθοδος: POST
// Path: /api/users
// Body (JSON): { name: "...", age: ..., email: "..." }
// Χρήση: Καλείται όταν ο χρήστης συμπληρώνει τη φόρμα και πατά "Προσθήκη".
app.post("/api/users", async (req, res) => {
  try {
    // Παίρνουμε τα δεδομένα από το body της αίτησης
    const { name, age, email } = req.body;

    // Πρώτα ελέγχουμε αν τα δεδομένα είναι έγκυρα
    const errors = validateUser({ name, age, email });
    if (errors.length > 0) {
      // Status 400 = Bad Request (τα δεδομένα που έστειλε ο χρήστης είναι λάθος)
      return res.status(400).json({ message: "Μη έγκυρα δεδομένα.", errors });
    }

    const collection = getCollection();

    // Ελέγχουμε αν έχει φτάσει το όριο εγγραφών.
    // Το countDocuments() επιστρέφει τον αριθμό των εγγράφων στο collection.
    // Αν έχουμε φτάσει το MAX_USERS, απορρίπτουμε τη νέα εγγραφή με 403.
    // Status 403 = Forbidden (επιτρεπτό αίτημα αλλά δεν επιτρέπεται αυτή τη στιγμή)
    const userCount = await collection.countDocuments();
    if (userCount >= MAX_USERS) {
      return res.status(403).json({
        message: `Έχει συμπληρωθεί το μέγιστο όριο των ${MAX_USERS} χρηστών.`,
      });
    }

    // Ελέγχουμε αν υπάρχει ήδη χρήστης με το ίδιο email
    const existingUser = await collection.findOne({
      email: email.trim().toLowerCase(),
    });
    if (existingUser) {
      return res
        .status(409)
        .json({ message: "Υπάρχει ήδη χρήστης με αυτό το email." });
    }

    // Φτιάχνουμε το νέο αντικείμενο χρήστη που θα αποθηκευτεί
    const newUser = {
      name: name.trim(),
      age: Number(age),
      email: email.trim().toLowerCase(),
      createdAt: new Date(), // Αποθηκεύουμε πότε δημιουργήθηκε
    };

    // Εισάγουμε το νέο έγγραφο στο MongoDB
    const result = await collection.insertOne(newUser);

    // Στέλνουμε πίσω τον νέο χρήστη μαζί με το _id που έδωσε η MongoDB
    res.status(201).json({
      message: "Ο χρήστης δημιουργήθηκε επιτυχώς!",
      user: { _id: result.insertedId, ...newUser },
    });
  } catch (error) {
    console.error("Σφάλμα κατά τη δημιουργία χρήστη:", error);
    res
      .status(500)
      .json({ message: "Σφάλμα στον server κατά τη δημιουργία χρήστη." });
  }
});

// ------------------------------------------------------------
// UPDATE - Ενημέρωσε έναν χρήστη
// ------------------------------------------------------------
// Μέθοδος: PUT
// Path: /api/users/:id  (το :id είναι το MongoDB _id του χρήστη)
// Body (JSON): { name: "...", age: ..., email: "..." }
// Χρήση: Καλείται όταν ο χρήστης αλλάζει στοιχεία και πατά "Αποθήκευση".
app.put("/api/users/:id", async (req, res) => {
  try {
    // Παίρνουμε το id από το URL (π.χ. /api/users/64abc123...)
    const { id } = req.params;
    const { name, age, email } = req.body;

    // Validation των νέων δεδομένων
    const errors = validateUser({ name, age, email });
    if (errors.length > 0) {
      return res.status(400).json({ message: "Μη έγκυρα δεδομένα.", errors });
    }

    // Χρησιμοποιούμε parseId() αντί για απευθείας new ObjectId() γιατί
    // τα παλιά έγγραφα έχουν _id ως αριθμό, ενώ τα νέα ως ObjectId string.
    // Η parseId() χειρίζεται και τις δύο περιπτώσεις αυτόματα.
    const queryId = parseId(id);

    const collection = getCollection();

    // Ελέγχουμε αν άλλος χρήστης έχει το ίδιο email (εκτός του τρέχοντος)
    const emailConflict = await collection.findOne({
      email: email.trim().toLowerCase(),
      _id: { $ne: queryId }, // $ne = "not equal" - εξαιρούμε τον τρέχοντα χρήστη
    });
    if (emailConflict) {
      return res
        .status(409)
        .json({ message: "Άλλος χρήστης χρησιμοποιεί αυτό το email." });
    }

    // Ενημερώνουμε τα πεδία του εγγράφου.
    // Το $set ενημερώνει ΜΟΝΟ τα πεδία που ορίζουμε, δεν διαγράφει τα υπόλοιπα.
    const result = await collection.updateOne(
      { _id: queryId }, // Φίλτρο: βρες το έγγραφο με αυτό το id
      {
        $set: {
          name: name.trim(),
          age: Number(age),
          email: email.trim().toLowerCase(),
          updatedAt: new Date(), // Αποθηκεύουμε πότε έγινε η τελευταία αλλαγή
        },
      },
    );

    // Αν το matchedCount είναι 0, δεν βρέθηκε χρήστης με αυτό το id
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Ο χρήστης δεν βρέθηκε." });
    }

    res.status(200).json({ message: "Ο χρήστης ενημερώθηκε επιτυχώς!" });
  } catch (error) {
    console.error("Σφάλμα κατά την ενημέρωση χρήστη:", error);
    res
      .status(500)
      .json({ message: "Σφάλμα στον server κατά την ενημέρωση χρήστη." });
  }
});

// ------------------------------------------------------------
// DELETE - Διέγραψε έναν χρήστη
// ------------------------------------------------------------
// Μέθοδος: DELETE
// Path: /api/users/:id
// Χρήση: Καλείται όταν ο χρήστης πατά το κουμπί "Διαγραφή".
app.delete("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Χρησιμοποιούμε parseId() για τον ίδιο λόγο με το PUT:
    // συμβατότητα με παλιά (numeric) και νέα (ObjectId) έγγραφα.
    const queryId = parseId(id);

    const collection = getCollection();

    // Διαγράφουμε το έγγραφο με το συγκεκριμένο id
    const result = await collection.deleteOne({ _id: queryId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Ο χρήστης δεν βρέθηκε." });
    }

    res.status(200).json({ message: "Ο χρήστης διαγράφηκε επιτυχώς!" });
  } catch (error) {
    console.error("Σφάλμα κατά τη διαγραφή χρήστη:", error);
    res
      .status(500)
      .json({ message: "Σφάλμα στον server κατά τη διαγραφή χρήστη." });
  }
});

// ============================================================
// 4. ΕΚΚΙΝΗΣΗ SERVER
// ============================================================
// Συνδεόμαστε πρώτα στη MongoDB και μετά "ανοίγουμε" τον server.
// Αυτή η σειρά είναι σημαντική: δεν θέλουμε ο server να δέχεται
// αιτήσεις πριν η βάση δεδομένων είναι έτοιμη.
async function startServer() {
  try {
    await client.connect();
    console.log("✅ Συνδέθηκες επιτυχώς στη MongoDB!");

    app.listen(PORT, () => {
      console.log(`🚀 Ο Server τρέχει στη θύρα ${PORT}`);
      console.log(`📋 API: http://localhost:${PORT}/api/users`);
    });
  } catch (error) {
    console.error("❌ Αποτυχία σύνδεσης στη MongoDB:", error);
    // Τερματίζουμε τη διεργασία αν δεν μπορούμε να συνδεθούμε
    process.exit(1);
  }
}

startServer();
