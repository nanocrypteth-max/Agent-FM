import "./globals.css";
import Navbar from "@/components/ui/Navbar";
import { FootballSVG } from "@/components/ui/FootballIcon";
import PrivyProvider from "@/components/auth/PrivyProvider";
import { APP_NAME, APP_DESCRIPTION } from "@/lib/config";

export const metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="ws-bg" aria-hidden="true">
          <div className="ws-orb ws-orb-1" />
          <div className="ws-orb ws-orb-2" />
          <div className="ws-orb ws-orb-3" />
          <div className="ws-ball ws-ball-1">
            <FootballSVG size={60} />
          </div>
          <div className="ws-ball ws-ball-2">
            <FootballSVG size={36} />
          </div>
          <div className="ws-ball ws-ball-3">
            <FootballSVG size={80} />
          </div>
          <div className="ws-ball ws-ball-4">
            <FootballSVG size={44} />
          </div>
          <div className="ws-ball ws-ball-5">
            <FootballSVG size={28} />
          </div>
        </div>
        <PrivyProvider>
          <Navbar />
          <main style={{ paddingTop: "64px" }}>{children}</main>
        </PrivyProvider>
      </body>
    </html>
  );
}
