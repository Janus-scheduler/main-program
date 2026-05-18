import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import CryptoJS from "crypto-js";

const app = express();
app.use(cors());
app.use(express.json()); // Allow JSON body parsing

const PORT = 3001;

// Define static secrets for demo purposes
// In a real app, these should be loaded from .env
const JWT_SECRET = "janus-super-secret-jwt-key";
const AES_SECRET = "janus-super-secret-aes-key";

// Mock DB
let eventsDB = [];

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
// 4. Endpoints
// ---------------------------------------------------------

// --- INSECURE ENDPOINT (For Demonstration Comparison) ---
app.post("/api/insecure/events", (req, res) => {
  console.log("\n[INSECURE] Received plain text event:", req.body);
  eventsDB.push(req.body);
  res.json({ success: true, event: req.body });
});

// --- SECURE ENDPOINT ---
app.post("/api/secure/events", verifyJWT, requireSecurePayload, (req, res) => {
  console.log(
    `\n[SECURE] Received encrypted request from user: ${req.user.username}`,
  );
  console.log(`[SECURE] Successfully decrypted payload:`, req.body);

  eventsDB.push(req.body);

  // We should also encrypt the response
  const responseData = { success: true, event: req.body };
  const jsonString = JSON.stringify(responseData);
  const responseCipherText = CryptoJS.AES.encrypt(
    jsonString,
    AES_SECRET,
  ).toString();

  res.json({ cipherText: responseCipherText });
});

// --- PUT ENDPOINTS ---
app.put("/api/insecure/events/:id", (req, res) => {
  console.log(
    `\n[INSECURE] Received plain text event update for ID: ${req.params.id}`,
    req.body,
  );
  const index = eventsDB.findIndex((e) => e.id === req.params.id);
  if (index !== -1) eventsDB[index] = { ...eventsDB[index], ...req.body };
  res.json({ success: true, event: req.body });
});

app.put(
  "/api/secure/events/:id",
  verifyJWT,
  requireSecurePayload,
  (req, res) => {
    console.log(
      `\n[SECURE] Received encrypted update request for ID: ${req.params.id} from user: ${req.user.username}`,
    );
    console.log(`[SECURE] Successfully decrypted update payload:`, req.body);

    const index = eventsDB.findIndex((e) => e.id === req.params.id);
    if (index !== -1) eventsDB[index] = { ...eventsDB[index], ...req.body };

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
app.delete("/api/insecure/events/:id", (req, res) => {
  console.log(`\n[INSECURE] Received delete request for ID: ${req.params.id}`);
  eventsDB = eventsDB.filter((e) => e.id !== req.params.id);
  res.json({ success: true });
});

app.delete(
  "/api/secure/events/:id",
  verifyJWT,
  requireSecurePayload,
  (req, res) => {
    console.log(
      `\n[SECURE] Received secure delete request for ID: ${req.params.id} from user: ${req.user.username}`,
    );
    eventsDB = eventsDB.filter((e) => e.id !== req.params.id);

    const responseData = { success: true };
    const jsonString = JSON.stringify(responseData);
    const responseCipherText = CryptoJS.AES.encrypt(
      jsonString,
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
