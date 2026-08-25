import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AssessmentProvider } from "@/components/AssessmentProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "VedaAI — Assessment Extraction & Answer Mapping",
  description:
    "Upload a question paper and a handwritten answer sheet to extract questions, map answers, and highlight exact response regions.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#ececec] font-sans text-[#1a1a1a]">
        <AssessmentProvider>{children}</AssessmentProvider>
      </body>
    </html>
  );
}
