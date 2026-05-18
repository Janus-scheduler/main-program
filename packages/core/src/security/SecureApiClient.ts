import CryptoJS from "crypto-js";

export class SecureApiClient {
  private jwtToken: string | null = null;
  private sharedSecret: string | null = null;

  /**
   * Initialize the secure client with the credentials needed for the session.
   * @param jwtToken - The JWT for authentication (proving identity)
   * @param sharedSecret - The AES secret for encryption and HMAC signing (proving integrity & confidentiality)
   */
  public init(jwtToken: string, sharedSecret: string): void {
    this.jwtToken = jwtToken;
    this.sharedSecret = sharedSecret;
  }

  /**
   * Clears the current credentials.
   */
  public clear(): void {
    this.jwtToken = null;
    this.sharedSecret = null;
  }

  public isReady(): boolean {
    return !!this.jwtToken && !!this.sharedSecret;
  }

  /**
   * Encrypts an object to AES-256 cipher text.
   */
  public encryptPayload(data: any): string {
    if (!this.sharedSecret)
      throw new Error("SecureApiClient: No shared secret provided.");
    const jsonString = JSON.stringify(data);
    return CryptoJS.AES.encrypt(jsonString, this.sharedSecret).toString();
  }

  /**
   * Decrypts an AES-256 cipher text back to an object.
   */
  public decryptPayload(cipherText: string): any {
    if (!this.sharedSecret)
      throw new Error("SecureApiClient: No shared secret provided.");
    const bytes = CryptoJS.AES.decrypt(cipherText, this.sharedSecret);
    const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
    if (!decryptedStr)
      throw new Error("SecureApiClient: Decryption failed or empty payload.");
    return JSON.parse(decryptedStr);
  }

  /**
   * Generates an HMAC-SHA256 signature for the given string (typically the cipher text).
   */
  public generateHMAC(dataStr: string): string {
    if (!this.sharedSecret)
      throw new Error("SecureApiClient: No shared secret provided.");
    return CryptoJS.HmacSHA256(dataStr, this.sharedSecret).toString(
      CryptoJS.enc.Hex,
    );
  }

  /**
   * A secure wrapper around the standard `fetch` API.
   * Automatically encrypts the body, attaches the JWT, and signs the payload with HMAC.
   *
   * @param url - The API endpoint
   * @param method - The HTTP method
   * @param data - The raw JSON data to send (optional)
   * @returns The decrypted JSON response
   */
  public async secureFetch(
    url: string,
    method: string = "GET",
    data?: any,
  ): Promise<any> {
    if (!this.isReady()) {
      throw new Error(
        "SecureApiClient is not initialized. Please call init() first.",
      );
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.jwtToken}`,
    };

    let body: string | undefined;

    if (data) {
      // 1. Encrypt the payload
      const cipherText = this.encryptPayload(data);
      // 2. Generate HMAC signature of the encrypted payload
      const hmacSignature = this.generateHMAC(cipherText);

      headers["X-HMAC-Signature"] = hmacSignature;
      // We send the ciphertext wrapped in a simple JSON envelope
      body = JSON.stringify({ cipherText });
    }

    const response = await fetch(url, {
      method,
      headers,
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Secure API Error (${response.status}): ${errorText}`);
    }

    const responseData = await response.json();

    // If the server returns encrypted data, we decrypt it
    if (responseData && responseData.cipherText) {
      // (Optional but recommended) Verify server HMAC here if provided
      // if (responseData.hmac) { ... }

      return this.decryptPayload(responseData.cipherText);
    }

    // Otherwise, return as is (e.g., simple success messages)
    return responseData;
  }
}

// Export a singleton instance for ease of use
export const secureApiClient = new SecureApiClient();
