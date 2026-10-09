import type { APIRoute } from "astro";
import { og, ogPaths, type OgPage } from "@kmra/ui/lib/routes";

export const getStaticPaths = () => ogPaths("colortool");
export const GET: APIRoute = ({ props }) =>
  og("colortool", (props as { page: OgPage }).page);
