import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { ErrorMessage, extractErrorMessage } from "../components/ErrorMessage";

// Public registration always creates a CUSTOMER account - there is no role
// selector here on purpose, matching the backend, which never allows a
// public request to create a VENDOR or ADMIN account.
export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await register({ name, email, phone: phone || undefined, password });
      navigate("/dashboard");
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold text-brand-800">Create your account</h1>
      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <ErrorMessage message={error} />}
          <Input label="Full name" required value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input label="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-xs text-neutral-500">
            At least 8 characters, with an uppercase letter, a lowercase letter and a number.
          </p>
          <Button type="submit" isLoading={isLoading}>
            Create account
          </Button>
        </form>
      </Card>
      <p className="text-center text-sm text-neutral-600">
        Already have an account?{" "}
        <Link to="/login" className="text-brand-700 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
