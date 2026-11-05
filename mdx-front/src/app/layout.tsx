import type { Metadata } from "next";
import { Atkinson_Hyperlegible, Poppins } from "next/font/google";
import { Toaster } from "@/components/ui/toast";
import { AuthProvider } from "@/components/auth/auth-provider";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-atkinson",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://mdx26.mermasdigitais.com.br"),
  title: {
    default: "Mermãs Digitais",
    template: "%s · Mermãs Digitais",
  },
  description: "Espaço digital das Mermãs Digitais.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${poppins.variable} ${atkinson.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <AuthProvider>
          <Toaster>{children}</Toaster>
        </AuthProvider>
      </body>
    </html>
  );
}
