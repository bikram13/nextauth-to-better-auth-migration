import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function Dashboard() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  return (
    <main>
      <h1>Dashboard</h1>
      <p data-testid="signed-in-as">Signed in as {session.user.email}</p>
      <p data-testid="user-id">User id: {session.user.id}</p>
      <p data-testid="session-id">Session id: {session.session.id}</p>
      <form action="/api/auth/sign-out" method="POST">
        <button data-testid="sign-out" type="submit">Sign out</button>
      </form>
    </main>
  );
}
