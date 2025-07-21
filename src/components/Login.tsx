import { useState } from "react";
import { auth } from "@/lib/firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

import LogoMondini from "@/assets/Logo-Mondini.png";

// Ícone oficial Google (SVG) no estilo inline para usar no botão
const GoogleIcon = () => (
  <svg
    className="mr-2"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    width="18px"
    height="18px"
  >
    <path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.19 3.62l6.88-6.88C34.59 2.67 29.64 0 24 0 14.62 0 6.39 5.99 2.68 14.6l7.99 6.21C12.97 15.8 18.01 9.5 24 9.5z" />
    <path fill="#34A853" d="M46.5 24c0-1.63-.16-3.22-.46-4.75H24v9.02h12.66c-.55 3.06-2.47 5.65-5.25 7.39l8.04 6.24c4.71-4.36 7.05-10.74 7.05-17.9z" />
    <path fill="#FBBC05" d="M10.67 28.81c-.6-1.8-.6-3.69 0-5.49v-6.22L2.68 14.6A23.94 23.94 0 0 0 0 24c0 3.86 1.03 7.46 2.68 10.68l8-6.22z" />
    <path fill="#EA4335" d="M24 46.5c6.45 0 11.87-2.14 15.83-5.8l-7.66-5.93c-2.14 1.46-4.89 2.3-8.17 2.3-5.95 0-11.01-4.01-12.84-9.41L2.68 33.4C6.39 41.01 14.62 46.5 24 46.5z" />
    <path fill="none" d="M0 0h48v48H0z" />
  </svg>
);

export default function Login() {
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    setError("");
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      navigate("/");
    } catch (err: any) {
      setError("Erro ao entrar com Google: " + err.message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md p-10 bg-card rounded-xl shadow-lg text-center">
        {/* Logo maior */}
        <img
          src={LogoMondini}
          alt="Logo Mondini"
          className="mx-auto mb-8 w-40 h-auto"
        />

        <h2 className="text-3xl font-semibold mb-8 text-foreground">Realize o login</h2>

        <Button
          onClick={handleGoogleLogin}
          className="flex items-center justify-center mx-auto px-8 py-4 text-lg"
        >
          <GoogleIcon />
          Entrar com Google
        </Button>

        {error && <p className="mt-6 text-red-600 font-medium">{error}</p>}
      </div>
    </div>
  );
}
