"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function SignUp() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await authClient.signUp.email({ email, password, name });
    if (error) {
      setError(error.message ?? "sign-up failed");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <main>
      <h1>Sign up</h1>
      <form onSubmit={onSubmit}>
        <label>
          Name{" "}
          <input data-testid="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <br />
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
            minLength={8}
          />
        </label>
        <br />
        <button data-testid="submit" type="submit">Sign up</button>
        {error ? <p data-testid="error" style={{ color: "red" }}>{error}</p> : null}
      </form>
    </main>
  );
}
