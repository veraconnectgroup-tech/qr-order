"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Dashboard theme toggle — toggles `.dark` on `<html>` without next-themes script injection. */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // private browsing
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full justify-start gap-2"
      onClick={toggle}
    >
      {dark ? (
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
