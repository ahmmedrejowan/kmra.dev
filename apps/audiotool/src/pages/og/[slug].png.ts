import type { APIRoute } from "astro";
import { og, ogPaths, type OgPage } from "@kmra/ui/lib/routes";

export const getStaticPaths = () => ogPaths("audiotool");
export const GET: APIRoute = ({ props }) =>
  og("audiotool", (props as { page: OgPage }).page);
