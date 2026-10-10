import type { APIRoute } from "astro";
import { og, ogPaths, type OgPage } from "@kmra/ui/lib/routes";

export const getStaticPaths = () => ogPaths("musictool");
export const GET: APIRoute = ({ props }) =>
  og("musictool", (props as { page: OgPage }).page);
