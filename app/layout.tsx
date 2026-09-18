import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { Shell } from "@/app/Shell";
import { NekoGateProvider } from "@/app/neko/_GateProvider";
import { LabGateProvider } from "@/app/_LabGateProvider";
import { LanguageProvider } from "@/app/_i18n/LanguageProvider";
import { resolveLocale } from "@/app/_i18n/locale";
import { NEKO_COOKIE, NEKO_COOKIE_VALUE } from "@/app/neko/_gate";
import {
  LAB_GATES,
  LAB_COOKIE_VALUE,
  LAB_GROUP_KEYS,
  type LabUnlockState,
} from "@/app/_labGate";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pollar Pay",
  description: "Set the rules once. Let your money follow them.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Pollar Pay",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await resolveLocale();
  const cookieStore = await cookies();
  const nekoUnlocked =
    cookieStore.get(NEKO_COOKIE)?.value === NEKO_COOKIE_VALUE;
  const labUnlocked = LAB_GROUP_KEYS.reduce(
    (acc, key) => ({
      ...acc,
      [key]: cookieStore.get(LAB_GATES[key].cookie)?.value === LAB_COOKIE_VALUE,
    }),
    {} as LabUnlockState,
  );

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('pollar-demo-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <LanguageProvider initialLocale={locale}>
          <NekoGateProvider unlocked={nekoUnlocked}>
            <LabGateProvider unlocked={labUnlocked}>
              <Suspense>
                <Shell>{children}</Shell>
              </Suspense>
            </LabGateProvider>
          </NekoGateProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
