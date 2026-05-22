"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full justify-start gap-2"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {theme === "dark" ? (
        <>
          <Sun className="size-4" />
          Light mode
        </>
      ) : (
        <>
          <Moon className="size-4" />
          Dark mode
        </>
      )}
    </Button>
  );
}
