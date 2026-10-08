import { isStubPaymentProvider, isProduction } from "../config/env";
import { PaymentProvider } from "./types";
import { RazorpayPaymentProvider } from "./razorpayProvider";
import { StubPaymentProvider } from "./stubProvider";

// This is the only place in the app that decides which PaymentProvider
// implementation is active - booking/payment services depend only on the
// PaymentProvider interface (see ./types.ts), never on Razorpay's SDK or
// the stub directly, so adding a second real provider later never touches
// them. isStubPaymentProvider is hard-disabled in production (see env.ts) -
// this factory can never hand out the stub there.
let cachedProvider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (cachedProvider) return cachedProvider;

  if (isStubPaymentProvider) {
    if (!isProduction) {
      // eslint-disable-next-line no-console
      console.warn(
        "[payments] RAZORPAY_KEY_ID is unset - using the in-process StubPaymentProvider. " +
          "No real Razorpay API calls will be made. Set real rzp_test_/rzp_live_ credentials to use Razorpay for real.",
      );
    }
    cachedProvider = new StubPaymentProvider();
  } else {
    cachedProvider = new RazorpayPaymentProvider();
  }
  return cachedProvider;
}

export * from "./types";
