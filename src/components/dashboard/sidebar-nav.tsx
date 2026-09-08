
"use client"

import Link from "next/link";
import * as React from "react";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Trophy, Shield, Users, PieChart, ChevronsLeft, BarChart3, Award, Send } from "lucide-react";
import { useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";

type UserProfile = {
  role?: 'Admin' | 'Consultant';
}

const consultantNavItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Tableau de bord", tooltip: "Tableau de bord", exact: true },
  { href: "/dashboard/defi", icon: Trophy, label: "Mon Défi", tooltip: "Mon Défi" },
  { href: "/dashboard/classement", icon: BarChart3, label: "Classement", tooltip: "Classement" },
];

const adminNavItems = [
    { href: "/dashboard/admin", icon: PieChart, label: "Aperçu Admin", tooltip: "Aperçu Admin", exact: true },
    { href: "/dashboard/admin/sessions", icon: Shield, label: "Sessions", tooltip: "Sessions" },
    { href: "/dashboard/admin/users", icon: Users, label: "Utilisateurs", tooltip: "Utilisateurs" },
    { href: "/dashboard/admin/actions", icon: Send, label: "Actions", tooltip: "Actions" },
];


export function SidebarNav() {
  const pathname = usePathname();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  // Use the useDoc hook to get the user profile reactively
  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const isLoading = isUserLoading || isProfileLoading;
  const isAdmin = userProfile?.role === 'Admin';
  
  const navItems = isLoading ? [] : isAdmin ? adminNavItems : consultantNavItems;
  
  return (
    <SidebarMenu>
      {isLoading ? (
        <>
          <SidebarMenuSkeleton showIcon />
          <SidebarMenuSkeleton showIcon />
          <SidebarMenuSkeleton showIcon />
        </>
      ) : (
        navItems.map((item) => {
          const isActive = item.exact 
            ? pathname === item.href 
            : pathname.startsWith(item.href) && !item.exact;
          
          // Special case for /dashboard when it's not exact
          const isDashboardActive = !item.exact && pathname === '/dashboard' && item.href === '/dashboard';

          return (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton asChild isActive={isActive || isDashboardActive} tooltip={item.tooltip}>
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })
      )}
    </SidebarMenu>
  );
}
