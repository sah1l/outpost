import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "share-html",
  description: "Share HTML and Markdown publicly.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-full antialiased">
        <div className="relative flex min-h-screen flex-col">{children}</div>
      </body>
    </html>
  );
}
