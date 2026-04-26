import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "POPPER-PROOF COURT — Where every scientific hypothesis goes on trial",
  description:
    "Multi-agent Science Research Court. Submit a hypothesis, watch a Prosecutor, Defender, and Judge argue, walk away with a procurement-ready experiment plan in 90 seconds. Hack-Nation 5th Global AI Hackathon · Challenge 04 · Powered by Fulcrum Science.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${inter.variable} h-full`}
    >
      <body className="min-h-full bg-court-bg text-court-fg font-sans antialiased flex flex-col">
        {children}
      </body>
    </html>
  );
}
