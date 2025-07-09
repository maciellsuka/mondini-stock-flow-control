import LogoMondini from "../assets/Logo-Mondini.png";
import { NavLink, useLocation } from "react-router-dom";
import {
  Package,
  FileText,
  Users,
  BarChart3,
  Home,
  ShoppingCart,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const navigation = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
  },
  {
    title: "Clientes",
    url: "/clientes",
    icon: Users,
  },
  {
    title: "Produtos",
    url: "/produtos",
    icon: Package,
  },
  {
    title: "Estoque",
    url: "/estoque",
    icon: ShoppingCart,
  },
  {
    title: "Pedidos",
    url: "/pedidos",
    icon: FileText,
  },
  {
    title: "Relatórios",
    url: "/relatorios",
    icon: BarChart3,
    disabled: true,
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => {
    if (path === "/") {
      return currentPath === "/";
    }
    return currentPath.startsWith(path);
  };

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? "bg-primary text-primary-foreground font-medium hover:bg-primary/90"
      : "hover:bg-accent hover:text-accent-foreground";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            {/* Pode adicionar ícone aqui se quiser */}
          </div>
          {state !== "collapsed" && (
            <div>
              <img src={LogoMondini} alt="Logo Mondini" />
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {item.disabled ? (
                    <div
                      className="flex items-center gap-3 px-3 py-2 text-muted-foreground cursor-not-allowed opacity-50"
                      title="Funcionalidade desativada"
                    >
                      <item.icon className="w-4 h-4" />
                      {state !== "collapsed" && <span>{item.title}</span>}
                    </div>
                  ) : (
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className={({ isActive }) => getNavCls({ isActive })}
                      >
                        <item.icon className="w-4 h-4" />
                        {state !== "collapsed" && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
