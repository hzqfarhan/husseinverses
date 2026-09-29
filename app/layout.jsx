import "./globals.css";

export const metadata = {
  title: "Husseinverse · Explore UTHM Parit Raja",
  description:
    "Walk around an interactive UTHM campus and explore authentic 360-degree views of Parit Raja.",
  icons: { icon: "/icon.svg" },
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
