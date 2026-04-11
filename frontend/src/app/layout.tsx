/**
 * @ Author: Bc. Adam Božek
 * @ Create Time: 2025-10-13 16:32:57
 * @ Description: This repository contains a full-stack application suite developed within a master’s thesis.
		 It is designed to support the screening of children using the Slovak
		 implementation of the TEKOS II screening instrument, short version. Copyright (C) 2026  Bc. Adam Božek
 * @ License: This program is free software: you can redistribute it and/or modify it under the terms of
		 the GNU Affero General Public License as published by the Free Software Foundation, either
		 version 3 of the License, or any later version. This program is distributed in the hope
		 that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty
		 of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
		 See the GNU Affero General Public License for more details.
		 You should have received a copy of the GNU Affero General Public License along with this program.
		 If not, see <https://www.gnu.org/licenses/>..
 */

import type { Metadata, Viewport } from "next";
import { AuthProvider } from "../utilities/AuthContext";

import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";

export const metadata: Metadata = {
  title: "Diplomová práca",
  description: "Aplikácia pre testovanie komunikačných schopností u detí.",
  keywords: ["TEKOS", "TEKOS2", "Diplomová práca", "TUKE", "KEMT"],
  authors: [{ name: "Adam Božek", url: "https://github.com/Adam-Bozek" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk">
      <head>
        <meta charSet="UTF-8" />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
