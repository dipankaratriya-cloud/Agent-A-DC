"use client";

import { Button } from "@/components/ui/button";
import { Shield, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModeToggleProps {
  mode: "default" | "custom";
  onChange: (mode: "default" | "custom") => void;
}

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="flex gap-2">
      <Button
        variant={mode === "default" ? "default" : "outline"}
        className={cn(
          "flex-1",
          mode === "default" &&
            "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
        )}
        onClick={() => onChange("default")}
      >
        <Shield className="w-4 h-4 mr-2" />
        Default Rules
      </Button>
      <Button
        variant={mode === "custom" ? "default" : "outline"}
        className={cn(
          "flex-1",
          mode === "custom" &&
            "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
        )}
        onClick={() => onChange("custom")}
      >
        <Wrench className="w-4 h-4 mr-2" />
        Custom Rules
      </Button>
    </div>
  );
}
