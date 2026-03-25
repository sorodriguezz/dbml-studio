import type { Metadata } from "next";
import "./globals.css";

const basePath = process.env.NODE_ENV === "production" ? "/dbml-studio" : "";

export const metadata: Metadata = {
  title: "DBML Studio — Visualizer & Converter",
  description: "Visualize DBML schemas and convert to TypeORM, Prisma, PostgreSQL, SQL Server, MongoDB",
  icons: {
    icon: `${basePath}/favicon.svg`
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="h-screen overflow-hidden">{children}</body>
    </html>
  );
}
