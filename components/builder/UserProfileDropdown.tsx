"use client";

import { useEffect } from "react";
import Link from "next/link";
import { User, Coins, FolderOpen, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useBuilderStore } from "@/lib/store";

/**
 * User profile dropdown menu for the header
 * Shows account info, credits, navigation, and logout
 * Can be used on any page - fetches credits on mount
 */
export default function UserProfileDropdown() {
  const { user, logout } = useAuthStore();
  const { credits, refreshCredits } = useBuilderStore();

  // Fetch credits on mount so dropdown works on any page
  useEffect(() => {
    refreshCredits();
  }, [refreshCredits]);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground">
          <User className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">Account</p>
            <p className="text-xs leading-none text-muted-foreground truncate">
              {user?.email ?? "Not signed in"}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!credits.isLoading && credits.balance !== null && (
          <>
            <DropdownMenuItem disabled className="cursor-default opacity-100">
              <Coins className="mr-2 h-4 w-4 text-amber-500" />
              <span>Credits: {Math.max(credits.balance, 0).toFixed(1)}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild>
          <Link href="/project-gallery">
            <FolderOpen className="mr-2 h-4 w-4" />
            <span>My Projects</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
