import type { Metadata, Viewport } from "next";
import {
  Nunito,
  Playfair_Display,
  Lilita_One,
  Geist,
  Geist_Mono,
} from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import { ToastContainer } from "@/components/feedback/Toast";
import { QueryProvider } from "@/components/QueryProvider";

// ─── Fonts ────────────────────────────────────────────────────────────────────

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const lilitaOne = Lilita_One({
  weight: "400",
  variable: "--font-lilita-one",
  subsets: ["latin"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: {
    default: "ShiftSync — Staff Scheduling Platform",
    template: "%s | ShiftSync",
  },
  description:
    "Multi-location staff scheduling platform for Coastal Eats. Manage shifts, swaps, overtime, and fairness analytics in real-time.",
  keywords: [
    "scheduling",
    "staff management",
    "shifts",
    "workforce",
    "restaurant",
  ],
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#080e1a" },
  ],
};

// ─── Root Layout ──────────────────────────────────────────────────────────────

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <body
        className={[
          nunito.variable,
          playfairDisplay.variable,
          lilitaOne.variable,
          geistSans.variable,
          geistMono.variable,
          "font-body antialiased min-h-screen",
        ].join(" ")}
      >
        <ThemeProvider
          attribute="data-theme"
          enableSystem
          defaultTheme="dark"
          disableTransitionOnChange={false}
        >
          <QueryProvider>
            <AuthProvider>
              <ToastProvider>
                {children}
                <ToastContainer />
              </ToastProvider>
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
