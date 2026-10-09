import type { APIRoute } from "astro";
import { og, ogPaths, type OgPage } from "@kmra/ui/lib/routes";

export const getStaticPaths = () => ogPaths("calctool");
export const GET: APIRoute = ({ props }) =>
  og("calctool", (props as { page: OgPage }).page);
