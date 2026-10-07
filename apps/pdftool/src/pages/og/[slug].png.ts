import type { APIRoute } from "astro";
import { og, ogPaths, type OgPage } from "@kmra/ui/lib/routes";

export const getStaticPaths = () => ogPaths("pdftool");
export const GET: APIRoute = ({ props }) =>
  og("pdftool", (props as { page: OgPage }).page);
