import "./globals.css";
import "./campus-plan.css";
import "./game.css";
import "./joystick.css";
import "./minimap.css";
import "./ios-icons.css";

export const metadata = {
  title: "Husseinverse · Explore UTHM Parit Raja",
  description:
    "Explore UTHM Parit Raja, take on campus missions, collect badges and discover authentic 360-degree views.",
  icons: { icon: [{ url: "/assets/icons/campus-ios-icon.png", type: "image/png" }, { url: "/icon.svg", type: "image/svg+xml" }], apple: "/assets/icons/campus-ios-icon.png" },
};
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#203d4d",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
