import { createFileRoute } from "@tanstack/react-router";
import { MinutaApp } from "@/components/minuta-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <MinutaApp />;
}
