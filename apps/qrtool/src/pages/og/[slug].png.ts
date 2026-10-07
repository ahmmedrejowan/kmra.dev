import type { APIRoute } from "astro";
import { og, ogPaths, type OgPage } from "@kmra/ui/lib/routes";

export const getStaticPaths = () => ogPaths("qrtool");
export const GET: APIRoute = ({ props }) =>
  og("qrtool", (props as { page: OgPage }).page);
