import type { Metadata } from "next";
import { I18nProvider } from "@/i18n/I18nProvider";
import { defaultLocale, localeAliases, localeOptions } from "@/i18n/config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://footglobe.discloud.app"),
  title: "FootGlobe — Football around the world",
  description: "Explore football matches around the world on an interactive 3D Earth.",
  openGraph: {
    type: "website",
    url: "https://footglobe.discloud.app",
    siteName: "FootGlobe",
    title: "FootGlobe — Follow Football Across the Globe",
    description: "Live matches, countries, and where to watch.",
    images: [
      {
        url: "/footglobe-social-preview.png",
        width: 1672,
        height: 941,
        alt: "FootGlobe — Follow Football Across the Globe",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FootGlobe — Follow Football Across the Globe",
    description: "Live matches, countries, and where to watch.",
    images: ["/footglobe-social-preview.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/favicon-512.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

const supportedLocales = localeOptions.map(({ code }) => code);
const rtlLocales = localeOptions.filter(({ dir }) => dir === "rtl").map(({ code }) => code);

const bootstrapScript = `(function(){try{var d=document.documentElement,t=localStorage.getItem('footglobe-theme');if(t!=='dark'&&t!=='light'){try{t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}catch(e){t='dark'}}d.dataset.theme=t;d.style.colorScheme=t;var s=${JSON.stringify(supportedLocales)},r=${JSON.stringify(rtlLocales)},m=${JSON.stringify(localeAliases)},v=localStorage.getItem('footglobe-locale'),a=v?[v]:(navigator.languages||[navigator.language||'${defaultLocale}']),l='${defaultLocale}';for(var i=0;i<a.length;i++){var n=String(a[i]).replace('_','-'),q=m[n.toLowerCase()];if(q){l=q;break}var e=s.find(function(x){return x.toLowerCase()===n.toLowerCase()}),b=n.split('-')[0].toLowerCase(),p=s.find(function(x){return x.split('-')[0].toLowerCase()===b});if(e||p){l=e||p;break}}d.lang=l;d.dir=r.indexOf(l)>=0?'rtl':'ltr'}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={defaultLocale} dir="ltr" data-theme="dark" suppressHydrationWarning>
      <head>
        <style>{"html[data-theme=dark],html[data-theme=dark] body{background:#050505;color:#f4f5f6}html[data-theme=light],html[data-theme=light] body{background:#fff;color:#16191d}"}</style>
        <script dangerouslySetInnerHTML={{ __html: bootstrapScript }} />
        <noscript><style>{"html:not([data-locale-ready]) body{visibility:visible}"}</style></noscript>
      </head>
      <body className="antialiased"><I18nProvider>{children}</I18nProvider></body>
    </html>
  );
}
