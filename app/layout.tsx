import type { ReactNode } from "react";

export const metadata = {
  title: "Better Auth Migration Reference",
  description: "Verifies the migration playbook end-to-end.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: "2rem" }}>
        {children}
      </body>
    </html>
  );
}
