import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { THEME_INIT_SCRIPT } from "../components/ui/ThemeSelect";
import { GlobalProvider } from "../context/GlobalContext";
import { AuthProvider } from "../context/AuthContext";
import Layout from "../components/Layout";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata = {
  title: "Meu Presente",
  description: "Crie sua lista de presentes e compartilhe com seus amigos",
  icons: {
    icon: '/icons/MeuPresente.svg',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        {/* Aplica o tema salvo antes de qualquer conteúdo ser pintado */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <GlobalProvider>
          <AuthProvider>
            <Layout>
              {children}
            </Layout>
          </AuthProvider>
        </GlobalProvider>
      </body>
    </html>
  );
}
