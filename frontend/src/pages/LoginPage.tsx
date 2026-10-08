import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { ErrorMessage, extractErrorMessage } from "../components/ErrorMessage";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold text-brand-800">Log in</h1>
      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <ErrorMessage message={error} />}
          <Input
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" isLoading={isLoading}>
            Log in
          </Button>
        </form>
      </Card>
      <p className="text-center text-sm text-neutral-600">
        Don&apos;t have an account?{" "}
        <Link to="/register" className="text-brand-700 hover:underline">
          Register
        </Link>
      </p>
    </div>
  );
}
