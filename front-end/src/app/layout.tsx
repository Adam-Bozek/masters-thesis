import type { Metadata, Viewport } from "next";

import { AuthProvider } from "../utilities/AuthContext";

import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";

export const metadata: Metadata = {
	title: "Diplomová práca",
	description: "Aplikácia pre testovanie komunikačných schopností u detí.",
	keywords: ["TEKOS", "TEKOS2", "Diplomová práca", "TUKE", "KEMT"],
	authors: { name: "Adam Božek", url: "https://github.com/Adam-Bozek" },
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
	userScalable: false,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
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
