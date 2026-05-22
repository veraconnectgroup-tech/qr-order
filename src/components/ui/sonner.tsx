"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      position="bottom-center"
      className="toaster group"
      icons={{
        success: (
          <span className="flex size-5 items-center justify-center rounded-full bg-orange-500/15">
            <CircleCheckIcon className="size-3 text-orange-500" />
          </span>
        ),
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        duration: 3000,
        classNames: {
          toast:
            "bg-zinc-900! border border-zinc-800! text-zinc-50! shadow-lg!",
          description: "text-zinc-400!",
          success: "border-l-[3px]! border-l-orange-500!",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
