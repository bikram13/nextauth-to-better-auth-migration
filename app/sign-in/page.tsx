"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await authClient.signIn.email({ email, password });
    if (error) {
      setError(error.message ?? "sign-in failed");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <main>
      <h1>Sign in</h1>
      <form onSubmit={onSubmit}>
        <label>
          Email{" "}
          <input
            data-testid="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
        </label>
        <br />
        <label>
          Password{" "}
          <input
            data-testid="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </label>
        <br />
        <button data-testid="submit" type="submit">Sign in</button>
        {error ? <p data-testid="error" style={{ color: "red" }}>{error}</p> : null}
      </form>
      <p>
        No account? <a href="/sign-up">Sign up</a>.
      </p>
    </main>
  );
}
