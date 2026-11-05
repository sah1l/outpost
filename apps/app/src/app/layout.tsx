import "./globals.css";
import type { Metadata } from "next";
import { JetBrains_Mono, Mona_Sans } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";

const sans = Mona_Sans({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Outpost", template: "%s | Outpost" },
  description:
    "Turn the HTML and Markdown your AI writes into a link. Keep it private, share it with your team, or make it public.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
