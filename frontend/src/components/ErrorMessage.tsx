export function ErrorMessage({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </div>
  );
}

export function extractErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ===
      "string"
  ) {
    return (error as { response: { data: { error: { message: string } } } }).response.data.error.message;
  }
  return "Something went wrong. Please try again.";
}
