import "./globals.css";
import Navbar from "@/components/ui/Navbar";
import { APP_NAME, APP_DESCRIPTION } from "@/lib/config";

export const metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
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
          <div className="ws-ball ws-ball-1" />
          <div className="ws-ball ws-ball-2" />
          <div className="ws-ball ws-ball-3" />
          <div className="ws-ball ws-ball-4" />
          <div className="ws-ball ws-ball-5" />
        </div>
        <Navbar />
        <main style={{ paddingTop: "64px" }}>{children}</main>
      </body>
    </html>
  );
}
