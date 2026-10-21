/**
 * XMP (editing data, an XML packet) as fields: list each property of every rdf:Description, drop
 * some, and write the packet back. Uses the browser's DOMParser, so it runs on the page.
 */

export interface XmpProp {
  /** "xmp:" + the property's qualified name, e.g. "xmp:xmp:CreatorTool" */
  id: string;
  /** The qualified name, e.g. "photoshop:City" */
  name: string;
  value: string;
}

const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const XMLNS = "http://www.w3.org/2000/xmlns/";

function descriptions(doc: Document): Element[] {
  return [...doc.getElementsByTagNameNS(RDF, "Description")];
}

function parse(xml: string): Document | null {
  if (typeof DOMParser === "undefined") return null;
  // The packet's processing instructions and padding are fine for an XML parser; trailing junk isn't
  const end = xml.lastIndexOf(">");
  const doc = new DOMParser().parseFromString(xml.slice(0, end + 1), "application/xml");
  return doc.getElementsByTagName("parsererror").length ? null : doc;
}

const valueOf = (el: Element) => {
  const items = [...el.getElementsByTagNameNS(RDF, "li")].map((li) => li.textContent?.trim() ?? "").filter(Boolean);
  return items.length ? items.join(", ") : (el.textContent ?? "").trim().replace(/\s+/g, " ");
};

/** Every property, or null when the packet can't be read (then it's handled as one block) */
export function readXmp(xml: string): XmpProp[] | null {
  const doc = parse(xml);
  if (!doc) return null;
  const out: XmpProp[] = [];
  for (const d of descriptions(doc)) {
    for (const a of [...d.attributes]) {
      if (a.namespaceURI === XMLNS || a.namespaceURI === RDF || a.name.startsWith("xmlns")) continue;
      out.push({ id: `xmp:${a.name}`, name: a.name, value: a.value });
    }
    for (const el of [...d.children]) out.push({ id: `xmp:${el.tagName}`, name: el.tagName, value: valueOf(el) });
  }
  return out;
}

/** The packet without the given properties, or null when nothing is left */
export function writeXmp(xml: string, remove: (id: string) => boolean): string | null {
  const doc = parse(xml);
  if (!doc) return null;
  let left = 0;
  for (const d of descriptions(doc)) {
    for (const a of [...d.attributes]) {
      if (a.namespaceURI === XMLNS || a.namespaceURI === RDF || a.name.startsWith("xmlns")) continue;
      if (remove(`xmp:${a.name}`)) d.removeAttributeNode(a);
      else left++;
    }
    for (const el of [...d.children]) {
      if (remove(`xmp:${el.tagName}`)) el.remove();
      else left++;
    }
  }
  return left ? new XMLSerializer().serializeToString(doc) : null;
}
