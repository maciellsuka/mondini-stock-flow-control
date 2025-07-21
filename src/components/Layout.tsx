import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Erro ao sair:", error);
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50 flex items-center px-4">
            <SidebarTrigger className="-ml-1" />
            <div className="flex-1" />
            <div className="text-sm text-muted-foreground">
              Sistema de Controle e Pedidos
            </div>
            <button
              onClick={handleLogout}
              className="ml-4 px-3 py-1 text-sm border rounded hover:bg-red-600 hover:text-white transition"
              title="Sair"
            >
              Logout
            </button>
          </header>
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
