import { GlobalProvider } from "../context/GlobalContext";
import { AuthProvider } from "../context/AuthContext";
import Layout from "../components/Layout";
import "./globals.css";

export const metadata = {
  title: "Lista de Presentes",
  description: "Crie sua lista de presentes e compartilhe com seus amigos",
  icons: {
    icon: '/MeuPresente.svg',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
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
