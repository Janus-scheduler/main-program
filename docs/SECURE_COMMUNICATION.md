# Janus Scheduler: Secure Communication Update

This document outlines the **Secure Communication Design and Implementation** features recently integrated into the `Janus-scheduler` project. This update was designed to secure data transmission between the frontend scheduler clients and backend API servers, fulfilling advanced security course project requirements.

## 🛡️ Security Architecture

The architecture guarantees the **CIA Triad** (Confidentiality, Integrity, Availability) alongside strict **Authentication** by implementing a robust three-layer cryptographic envelope around all API requests.

1. **Authentication (JWT)**: Proves _who_ is sending the data.
2. **Confidentiality (AES-256)**: Ensures the data _cannot be read_ in transit.
3. **Integrity (HMAC-SHA256)**: Ensures the data _was not tampered with_.

---

## 📦 Core Package Integration (`@janus-scheduler/core`)

Rather than hardcoding security into a specific framework demo, the cryptographic logic has been built directly into the framework-agnostic core library via the **`SecureApiClient`**.

**Location:** `packages/core/src/security/SecureApiClient.ts`

### How it works:

When a frontend framework uses `SecureApiClient.secureFetch()`, the client automatically:

1. Serializes the raw event data (e.g., patient appointments, private meetings).
2. Encrypts the payload into cipher text using **AES-256** and a shared secret.
3. Computes a cryptographic signature of the cipher text using **HMAC-SHA256**.
4. Injects a JSON Web Token (JWT) into the `Authorization: Bearer` header.
5. Injects the HMAC signature into the `X-HMAC-Signature` header.
6. Transmits the secure envelope to the backend, and automatically decrypts the server's response.

---

## 🖥️ Backend API Gateway (`demo/backend`)

A dedicated Node.js/Express API Gateway was created to serve as the "untrusted" server environment and strictly validate incoming secure requests.

**Location:** `demo/backend/server.js`

### Endpoints & Middlewares:

- **`POST /api/login`**: Authenticates users (demo credentials: `admin` / `password`) and issues a JWT alongside the AES shared secret.
- **`/api/secure/events` (POST, PUT, DELETE)**: Protected routes that enforce two strict middlewares:
  - `verifyJWT`: Rejects requests without a valid, unexpired token.
  - `requireSecurePayload`:
    1. Recomputes the HMAC-SHA256 signature of the incoming cipher text.
    2. Compares it to the `X-HMAC-Signature` header. If they don't match, it immediately rejects the request (mitigating Man-in-the-Middle attacks).
    3. Decrypts the AES payload and passes the raw JSON to the database logic.

---

## 🚀 Live Demonstration UI (`demo/react-demo`)

To easily showcase the impact of this security layer during a Viva or presentation, a visual toggle was added to the React Demo application.

**Location:** `demo/react-demo/src/App.tsx`

### How to Demonstrate:

1. **Start the applications**:
   - Backend: `cd demo/backend && npm run dev`
   - Frontend: `npm run dev:react-demo`
2. **Insecure Baseline (Toggle OFF)**:
   - Drag and drop an event on the calendar.
   - Open your browser's Developer Tools -> Network Tab.
   - **Result**: You will see raw JSON patient/event data exposed in plain text over the network.
3. **Secure Sync (Toggle ON)**:
   - Turn the toggle ON and log in.
   - Drag and drop an event on the calendar.
   - Open the Network Tab.
   - **Result**: You will see the cryptographic headers (`Authorization`, `X-HMAC-Signature`) and the payload will be completely unreadable cipher text (`U2FsdGVkX19...`). The backend terminal logs will prove the server successfully decrypted it.

---

## 🛑 Threat Mitigation Summary

| Threat / Attack Vector                 | Mitigation Strategy                                                                 |
| :------------------------------------- | :---------------------------------------------------------------------------------- |
| **Packet Sniffing / Eavesdropping**    | AES-256 encryption ensures attackers only see unreadable gibberish.                 |
| **Man-in-the-Middle (MITM) Tampering** | HMAC-SHA256 signatures immediately invalidate altered cipher text.                  |
| **Unauthorized Access**                | JWT validation blocks unauthenticated API requests.                                 |
| **Replay Attacks**                     | (Extendable) Short-lived JWT expiry times limit the damage window of stolen tokens. |
