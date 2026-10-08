// Thin wrapper around Razorpay's client-side Checkout script. Loaded lazily
// (only when a customer actually opens the payment sheet) rather than on
// every page load. Never used at all when the stub payment provider is
// active - see PayAdvanceButton, which simulates checkout via the backend's
// dev-only endpoint instead in that case.

export interface RazorpayCheckoutOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void;
  modal?: { ondismiss?: () => void };
  // Not a native Razorpay option - bound onto the instance's
  // 'payment.failed' event by openRazorpayCheckout below.
  onFailure?: (message: string) => void;
}

interface RazorpayCheckoutInstance {
  open(): void;
  on(event: "payment.failed", handler: (response: { error: { description?: string } }) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;
  }
}

const CHECKOUT_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

let loadPromise: Promise<void> | null = null;

function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the Razorpay Checkout script."));
    document.body.appendChild(script);
  });
  return loadPromise;
}

export async function openRazorpayCheckout(options: RazorpayCheckoutOptions): Promise<void> {
  await loadCheckoutScript();
  if (!window.Razorpay) throw new Error("Razorpay Checkout did not load correctly.");
  const checkout = new window.Razorpay(options);
  checkout.on("payment.failed", (response) => {
    options.onFailure?.(response.error.description ?? "Payment failed.");
  });
  checkout.open();
}
