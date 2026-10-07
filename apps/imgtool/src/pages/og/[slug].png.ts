import type { APIRoute } from "astro";
import { og, ogPaths, type OgPage } from "@kmra/ui/lib/routes";

export const getStaticPaths = () => ogPaths("imgtool");
export const GET: APIRoute = ({ props }) =>
  og("imgtool", (props as { page: OgPage }).page);
