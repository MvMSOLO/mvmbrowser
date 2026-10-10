import { createFileRoute } from "@tanstack/react-router";
import { BrowserRoot } from "@/components/mvm/app";

export const Route = createFileRoute("/")({ component: BrowserRoot });
