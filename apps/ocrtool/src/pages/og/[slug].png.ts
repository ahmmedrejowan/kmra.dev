import type { APIRoute } from "astro";
import { og, ogPaths, type OgPage } from "@kmra/ui/lib/routes";

export const getStaticPaths = () => ogPaths("ocrtool");
export const GET: APIRoute = ({ props }) =>
  og("ocrtool", (props as { page: OgPage }).page);
