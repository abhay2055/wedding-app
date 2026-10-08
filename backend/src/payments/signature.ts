import crypto from "crypto";

// Razorpay's documented HMAC-SHA256 signing scheme, factored out so both
// RazorpayPaymentProvider and StubPaymentProvider use the exact same
// verification math - the stub's whole purpose is to exercise this real
// cryptographic check without needing network access to Razorpay's API.
export function computeHmacSignature(secret: string, payload: string | Buffer): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function timingSafeEqualHex(expectedHex: string, actualHex: string): boolean {
  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(actualHex, "hex");
  if (expected.length !== actual.length) return false;
  try {
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
