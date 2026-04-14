import type { Metadata } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "DC Metadata Extractor",
  description: "Automated dataset metadata extraction powered by Groq Compound + LangGraph",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-50 font-sans">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
