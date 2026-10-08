import { useState } from "react";
import { Button } from "./Button";
import { ErrorMessage, extractErrorMessage } from "./ErrorMessage";
import * as paymentsApi from "../api/payments";
import * as devPaymentsApi from "../api/devPayments";
import { STUB_KEY_PREFIX } from "../api/devPayments";
import { openRazorpayCheckout } from "../utils/razorpay";
import { VerifyPaymentResult } from "../types/api";
import { useAuth } from "../context/AuthContext";
import { formatInr } from "../utils/format";

interface PayAdvanceButtonProps {
  bookingId: string;
  amount: number;
  bookingNumber: string;
  onSuccess: (result: VerifyPaymentResult) => void;
}

// Drives the full pay-advance flow: create the order, open Razorpay
// Checkout (or, against the dev stub provider, simulate a completed
// checkout instead - see api/devPayments.ts), then verify the result with
// the backend. The backend is the only thing that can ever mark a booking
// CONFIRMED - this component just reports what Checkout/the stub returned
// and displays whatever the backend decided.
export function PayAdvanceButton({ bookingId, amount, bookingNumber, onSuccess }: PayAdvanceButtonProps) {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingStub, setUsingStub] = useState(false);

  async function handlePay() {
    setError(null);
    setIsProcessing(true);
    try {
      const order = await paymentsApi.createPaymentOrder(bookingId);
      const isStub = order.razorpayKeyId.startsWith(STUB_KEY_PREFIX);
      setUsingStub(isStub);

      if (isStub) {
        // No real Razorpay account in this environment - simulate a
        // successful checkout via the backend's dev-only endpoint, using
        // the exact same signature-verification code path a real checkout
        // would exercise (see backend/src/payments/stubProvider.ts).
        const completion = await devPaymentsApi.simulateCheckout(order.providerOrderId, "success");
        const result = await paymentsApi.verifyPayment(completion);
        onSuccess(result);
        setIsProcessing(false);
        return;
      }

      await openRazorpayCheckout({
        key: order.razorpayKeyId,
        order_id: order.providerOrderId,
        amount: order.amount * 100, // Razorpay Checkout expects paise.
        currency: order.currency,
        name: "VivahSetu",
        description: `Advance for booking ${bookingNumber}`,
        prefill: { name: user?.name, email: user?.email, contact: user?.phone ?? undefined },
        theme: { color: "#7c3aed" },
        handler: (response) => {
          paymentsApi
            .verifyPayment({
              providerOrderId: response.razorpay_order_id,
              providerPaymentId: response.razorpay_payment_id,
              providerSignature: response.razorpay_signature,
            })
            .then(onSuccess)
            .catch((err) => setError(extractErrorMessage(err)))
            .finally(() => setIsProcessing(false));
        },
        onFailure: (message) => {
          setError(message);
          setIsProcessing(false);
        },
        modal: { ondismiss: () => setIsProcessing(false) },
      });
    } catch (err) {
      setError(extractErrorMessage(err));
      setIsProcessing(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <ErrorMessage message={error} />}
      {usingStub && isProcessing && (
        <p className="text-xs text-neutral-500">Test mode: simulating a successful Razorpay checkout...</p>
      )}
      <Button isLoading={isProcessing} onClick={handlePay}>
        Pay advance ({formatInr(amount)})
      </Button>
    </div>
  );
}
