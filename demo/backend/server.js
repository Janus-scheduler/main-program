import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import CryptoJS from "crypto-js";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Event from "./models/Event.js";
import Resource from "./models/Resource.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json()); // Allow JSON body parsing

const PORT = 3001;

// Load secrets from .env
const JWT_SECRET = process.env.JWT_SECRET || "fallback-jwt-secret";
const AES_SECRET = process.env.AES_SECRET || "fallback-aes-secret";
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("FATAL: MONGO_URI is missing from .env");
  process.exit(1);
}

// Connect to MongoDB
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ Successfully connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ---------------------------------------------------------
// 1. Authentication (Login) Endpoint
// ---------------------------------------------------------
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  if (username === "admin" && password === "password") {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "1h" });

    // We return both the JWT and the shared secret for AES/HMAC in this demo.
    // In a production E2EE setup, the AES key might be derived via Diffie-Hellman
    // or distributed via a more secure key-exchange protocol.
    return res.json({ token, sharedSecret: AES_SECRET });
  }

  return res.status(401).json({ error: "Invalid credentials" });
});

// ---------------------------------------------------------
// 2. Middleware: JWT Verification
// ---------------------------------------------------------
const verifyJWT = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader)
    return res.status(403).json({ error: "No authorization header provided" });

  const token = authHeader.split(" ")[1];
  if (!token)
    return res.status(403).json({ error: "Malformed authorization header" });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: "Invalid or expired JWT" });
    req.user = decoded;
    next();
  });
};

// ---------------------------------------------------------
// 3. Middleware: Cryptography (HMAC + AES)
// ---------------------------------------------------------
const requireSecurePayload = (req, res, next) => {
  // If the request has no body (like a GET request), just pass
  if (Object.keys(req.body).length === 0) return next();

  const clientHmac = req.headers["x-hmac-signature"];
  const { cipherText } = req.body;

  if (!clientHmac || !cipherText) {
    return res
      .status(400)
      .json({ error: "Request is missing cipherText or X-HMAC-Signature" });
  }

  // A. Verify Integrity via HMAC
  const expectedHmac = CryptoJS.HmacSHA256(cipherText, AES_SECRET).toString(
    CryptoJS.enc.Hex,
  );
  if (clientHmac !== expectedHmac) {
    console.warn(
      `[SECURE API] HMAC mismatch! Expected: ${expectedHmac}, Got: ${clientHmac}`,
    );
    return res
      .status(400)
      .json({ error: "Payload tampering detected (HMAC mismatch)" });
  }

  // B. Decrypt Confidential Payload via AES
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, AES_SECRET);
    const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
    if (!decryptedStr) throw new Error("Empty decryption result");

    // Replace the encrypted body with the decrypted data so route handlers can use it normally
    req.body = JSON.parse(decryptedStr);
    next();
  } catch (e) {
    console.error("[SECURE API] AES Decryption Failed:", e.message);
    return res.status(400).json({ error: "Failed to decrypt payload" });
  }
};

// ---------------------------------------------------------
// 4. Endpoints (MongoDB)
// ---------------------------------------------------------

// --- SEEDING LOGIC ---
async function seedDatabaseIfEmpty() {
  const count = await Resource.countDocuments();
  if (count === 0) {
    console.log("🌱 Database is empty. Seeding initial data...");

    await Resource.create([
      { id: "r1", name: "Dr. Sarah Chen", type: "person" },
      { id: "r2", name: "Dr. Michael Ross", type: "person" },
      { id: "r3", name: "Operating Room 1", type: "room" },
      { id: "r4", name: "MRI Scanner A", type: "equipment" },
    ]);

    const today = new Date().toISOString().split("T")[0];
    await Event.create([
      {
        id: "e1",
        title: "Appendectomy",
        startTime: `${today}T09:00:00.000Z`,
        endTime: `${today}T11:30:00.000Z`,
        resourceId: "r1",
        status: "confirmed",
      },
      {
        id: "e2",
        title: "Pre-op Assessment",
        startTime: `${today}T13:00:00.000Z`,
        endTime: `${today}T14:00:00.000Z`,
        resourceId: "r2",
        status: "confirmed",
      },
    ]);
    console.log("✅ Seeding complete.");
  }
}

// --- GET DATA ENDPOINT ---
app.get("/api/insecure/data", async (req, res) => {
  await seedDatabaseIfEmpty();
  const events = await Event.find({}, "-_id -__v");
  const resources = await Resource.find({}, "-_id -__v");
  res.json({ events, resources });
});

app.get("/api/secure/data", verifyJWT, async (req, res) => {
  await seedDatabaseIfEmpty();
  const events = await Event.find({}, "-_id -__v");
  const resources = await Resource.find({}, "-_id -__v");

  const responseData = { events, resources };
  const jsonString = JSON.stringify(responseData);
  const responseCipherText = CryptoJS.AES.encrypt(
    jsonString,
    AES_SECRET,
  ).toString();

  res.json({ cipherText: responseCipherText });
});

// --- INSECURE ENDPOINT (For Demonstration Comparison) ---
app.post("/api/insecure/events", async (req, res) => {
  try {
    console.log("\n[INSECURE] Received plain text event:", req.body);
    await Event.create(req.body);
    res.json({ success: true, event: req.body });
  } catch (err) {
    console.error("[INSECURE] Error creating event:", err.message);
    res.status(400).json({ error: err.message });
  }
});

// --- SECURE ENDPOINT ---
app.post(
  "/api/secure/events",
  verifyJWT,
  requireSecurePayload,
  async (req, res) => {
    try {
      console.log(
        `\n[SECURE] Received encrypted POST request from user: ${req.user.username}`,
      );
      console.log(`[SECURE] Successfully decrypted payload:`, req.body);

      await Event.create(req.body);

      const responseData = { success: true, event: req.body };
      const jsonString = JSON.stringify(responseData);
      const responseCipherText = CryptoJS.AES.encrypt(
        jsonString,
        AES_SECRET,
      ).toString();

      res.json({ cipherText: responseCipherText });
    } catch (err) {
      console.error("[SECURE] Error creating event:", err.message);
      res.status(400).json({ error: err.message });
    }
  },
);

// --- PUT ENDPOINTS ---
app.put("/api/insecure/events/:id", async (req, res) => {
  console.log(
    `\n[INSECURE] Received plain text event update for ID: ${req.params.id}`,
    req.body,
  );
  await Event.findOneAndUpdate({ id: req.params.id }, req.body, {
    upsert: true,
  });
  res.json({ success: true, event: req.body });
});

app.put(
  "/api/secure/events/:id",
  verifyJWT,
  requireSecurePayload,
  async (req, res) => {
    console.log(
      `\n[SECURE] Received encrypted update request for ID: ${req.params.id} from user: ${req.user.username}`,
    );
    console.log(`[SECURE] Successfully decrypted update payload:`, req.body);

    await Event.findOneAndUpdate({ id: req.params.id }, req.body, {
      upsert: true,
    });

    const responseData = { success: true, event: req.body };
    const jsonString = JSON.stringify(responseData);
    const responseCipherText = CryptoJS.AES.encrypt(
      jsonString,
      AES_SECRET,
    ).toString();

    res.json({ cipherText: responseCipherText });
  },
);

// --- DELETE ENDPOINTS ---
app.delete("/api/insecure/events/:id", async (req, res) => {
  console.log(`\n[INSECURE] Received delete request for ID: ${req.params.id}`);
  await Event.findOneAndDelete({ id: req.params.id });
  res.json({ success: true });
});

app.delete(
  "/api/secure/events/:id",
  verifyJWT,
  requireSecurePayload,
  async (req, res) => {
    console.log(
      `\n[SECURE] Received secure delete request for ID: ${req.params.id} from user: ${req.user.username}`,
    );
    await Event.findOneAndDelete({ id: req.params.id });

    const responseData = { success: true };
    const jsonString = JSON.stringify(responseData);
    const responseCipherText = CryptoJS.AES.encrypt(
      jsonString,
      AES_SECRET,
    ).toString();

    res.json({ cipherText: responseCipherText });
  },
);

// --- RESOURCE ENDPOINTS ---
app.post("/api/insecure/resources", async (req, res) => {
  await Resource.create(req.body);
  res.json({ success: true, resource: req.body });
});

app.post(
  "/api/secure/resources",
  verifyJWT,
  requireSecurePayload,
  async (req, res) => {
    await Resource.create(req.body);
    const responseData = { success: true, resource: req.body };
    const responseCipherText = CryptoJS.AES.encrypt(
      JSON.stringify(responseData),
      AES_SECRET,
    ).toString();
    res.json({ cipherText: responseCipherText });
  },
);

app.put("/api/insecure/resources/:id", async (req, res) => {
  await Resource.findOneAndUpdate({ id: req.params.id }, req.body, {
    upsert: true,
  });
  res.json({ success: true, resource: req.body });
});

app.put(
  "/api/secure/resources/:id",
  verifyJWT,
  requireSecurePayload,
  async (req, res) => {
    await Resource.findOneAndUpdate({ id: req.params.id }, req.body, {
      upsert: true,
    });
    const responseData = { success: true, resource: req.body };
    const responseCipherText = CryptoJS.AES.encrypt(
      JSON.stringify(responseData),
      AES_SECRET,
    ).toString();
    res.json({ cipherText: responseCipherText });
  },
);

app.delete("/api/insecure/resources/:id", async (req, res) => {
  await Resource.findOneAndDelete({ id: req.params.id });
  res.json({ success: true });
});

app.delete(
  "/api/secure/resources/:id",
  verifyJWT,
  requireSecurePayload,
  async (req, res) => {
    await Resource.findOneAndDelete({ id: req.params.id });
    const responseData = { success: true };
    const responseCipherText = CryptoJS.AES.encrypt(
      JSON.stringify(responseData),
      AES_SECRET,
    ).toString();
    res.json({ cipherText: responseCipherText });
  },
);

app.listen(PORT, () => {
  console.log(`\n==============================================`);
  console.log(`🛡️ Janus Secure Backend running on port ${PORT}`);
  console.log(`==============================================`);
});
