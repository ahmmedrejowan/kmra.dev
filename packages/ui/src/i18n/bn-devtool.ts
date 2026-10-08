/**
 * Bangla interface text used only by devtool (its tools and pages), keyed by the English string.
 * Shared site text lives in ./bn.ts; don't repeat keys from there or the other app files.
 * Each tool group adds its keys under its own marker.
 */
export const BN_DEVTOOL: Record<string, string> = {
  // -- workspace and home --
  "2 spaces": "২ স্পেস",
  "4 spaces": "৪ স্পেস",
  "A string has a raw line break or tab. Use \\n or \\t instead.":
    "একটি স্ট্রিংয়ে সরাসরি লাইন ব্রেক বা ট্যাব আছে। এর বদলে \\n বা \\t ব্যবহার করুন।",
  "All developer tools": "সব ডেভেলপার টুল",
  "All {n} developer tools": "সব {n}টি ডেভেলপার টুল",
  Color: "রং",
  "Couldn't read the clipboard. Paste with Ctrl+V or ⌘V.":
    "ক্লিপবোর্ড পড়া গেল না। Ctrl+V বা ⌘V দিয়ে পেস্ট করুন।",
  "Cron expression": "ক্রন এক্সপ্রেশন",
  "Developer tools": "ডেভেলপার টুল",
  "Developer tools that stay on your device": "আপনার ডিভাইসেই চলা ডেভেলপার টুল",
  "Does my data leave my device?": "আমার ডেটা কি ডিভাইসের বাইরে যায়?",
  "Encoded URL": "এনকোড করা URL",
  "Encoded text": "এনকোড করা লেখা",
  "Everything stays in your browser.": "সবকিছু আপনার ব্রাউজারেই থাকে।",
  "File permissions": "ফাইলের অনুমতি",
  "Free developer tools in your browser": "ব্রাউজারেই বিনামূল্যের ডেভেলপার টুল",
  "Free, private, and nothing you paste leaves your browser.":
    "বিনামূল্যে, ব্যক্তিগত, আর আপনি যা পেস্ট করেন তা আপনার ব্রাউজারেই থাকে।",
  Indent: "ইন্ডেন্ট",
  "Invalid JSON": "JSON ঠিক নেই",
  "Is there a size limit?": "সাইজের কোনো সীমা আছে?",
  "JSON (with an error)": "JSON (একটি ভুলসহ)",
  "JSON needs double quotes, not single quotes.":
    "JSON-এ সিঙ্গেল নয়, ডাবল কোট লাগে।",
  "Keys must be in double quotes.": "কি-গুলো ডাবল কোটের মধ্যে থাকতে হবে।",
  "Line {l}, column {c}: ": "লাইন {l}, কলাম {c}: ",
  "Looks like {what}.": "মনে হচ্ছে এটি {what}।",
  Minify: "মিনিফাই",
  "More tools for everyday coding.": "প্রতিদিনের কোডিংয়ের আরও টুল।",
  "Not sure what this is. Pick a tool below.":
    "এটি কী বোঝা গেল না। নিচ থেকে একটি টুল বেছে নিন।",
  "Open file": "ফাইল খুলুন",
  "Open the right tool": "ঠিক টুলটি খুলুন",
  "Open {tool}": "{tool} খুলুন",
  Paste: "পেস্ট",
  "Paste JSON here": "এখানে JSON পেস্ট করুন",
  "Paste JSON to start. Errors show the line and column.":
    "শুরু করতে JSON পেস্ট করুন। ভুল থাকলে লাইন আর কলাম দেখাবে।",
  "Paste anything": "যেকোনো কিছু পেস্ট করুন",
  "Sort keys": "কি সাজান",
  Tabs: "ট্যাব",
  "The JSON ends too early. A bracket or quote isn't closed.":
    "JSON আগেই শেষ হয়ে গেছে। কোনো ব্র্যাকেট বা কোট বন্ধ হয়নি।",
  "There's a comma before a closing bracket. Remove the trailing comma.":
    "বন্ধ ব্র্যাকেটের আগে একটি কমা আছে। শেষের কমাটি মুছুন।",
  "This isn't valid JSON. Check the marked line.":
    "এটি সঠিক JSON নয়। চিহ্নিত লাইনটি দেখুন।",
  Tree: "ট্রি",
  "Unix timestamp": "ইউনিক্স টাইমস্ট্যাম্প",
  "Valid JSON": "JSON ঠিক আছে",
  Validate: "যাচাই",
  "cURL command": "cURL কমান্ড",
  "depth {n}": "গভীরতা {n}",
  "{n} keys": "{n}টি কি",
  "Paste JSON, a JWT, a timestamp, Base64, a cURL command, a color…":
    "JSON, JWT, টাইমস্ট্যাম্প, Base64, cURL কমান্ড, রং… যেকোনো কিছু পেস্ট করুন",
  "Format JSON, decode tokens, hash files and convert data. Paste anything below and the right tool opens.":
    "JSON ফরম্যাট, টোকেন ডিকোড, ফাইল হ্যাশ আর ডেটা রূপান্তর। নিচে যেকোনো কিছু পেস্ট করুন, ঠিক টুলটি খুলে যাবে।",
  "No. Everything you paste or open is processed in your browser and stays on your device.":
    "না। আপনি যা পেস্ট করেন বা খোলেন, সবই আপনার ব্রাউজারে প্রক্রিয়া হয় আর আপনার ডিভাইসেই থাকে।",
  "No limits from us. Very large inputs can be slow because the work uses your device's memory.":
    "আমাদের দিক থেকে কোনো সীমা নেই। খুব বড় ইনপুট ধীর হতে পারে, কারণ কাজটি আপনার ডিভাইসের মেমরি ব্যবহার করে।",
  Formatted: "ফরম্যাট করা",
  Minified: "মিনিফাই করা",

  // -- json --

  // -- encode --
  Encode: "এনকোড",
  Decode: "ডিকোড",
  Alphabet: "বর্ণমালা",
  Standard: "স্ট্যান্ডার্ড",
  "URL-safe": "URL-নিরাপদ",
  "Padding (=)": "প্যাডিং (=)",
  "Line length": "লাইনের দৈর্ঘ্য",
  "One line": "এক লাইনে",
  "Show as file": "ফাইল হিসেবে দেখান",
  Swap: "উল্টে দিন",
  "Type text or open a file to encode it.":
    "এনকোড করতে টেক্সট লিখুন বা একটি ফাইল খুলুন।",
  "Paste Base64 or a data URI to decode it.":
    "ডিকোড করতে Base64 বা একটি data URI পেস্ট করুন।",
  "Not valid Base64": "সঠিক Base64 নয়",
  "File encoded": "ফাইল এনকোড হয়েছে",
  "Text encoded": "টেক্সট এনকোড হয়েছে",
  "Valid Base64": "সঠিক Base64",
  "Text or file": "টেক্সট বা ফাইল",
  "Type or paste text, or open a file":
    "টেক্সট লিখুন বা পেস্ট করুন, অথবা একটি ফাইল খুলুন",
  "Paste Base64 here": "এখানে Base64 পেস্ট করুন",
  "Remove file": "ফাইল সরান",
  "Save as file": "ফাইল হিসেবে সেভ করুন",
  "Treat as": "যেভাবে ধরা হবে",
  "Part of a URL": "URL-এর অংশ",
  "Full URL": "পুরো URL",
  "Spaces as +": "স্পেসের জায়গায় +",
  "+ means space": "+ মানে স্পেস",
  "Line by line": "লাইন ধরে ধরে",
  "Type text to percent-encode it for a URL.":
    "URL-এর জন্য পার্সেন্ট-এনকোড করতে টেক্সট লিখুন।",
  "Paste an encoded URL or text to decode it.":
    "ডিকোড করতে এনকোড করা URL বা টেক্সট পেস্ট করুন।",
  "Can't convert this text": "এই টেক্সট রূপান্তর করা গেল না",
  Encoded: "এনকোড করা",
  Decoded: "ডিকোড করা",
  "Some bytes aren't valid UTF-8 and show as �":
    "কিছু বাইট সঠিক UTF-8 নয়, সেগুলো � হিসেবে দেখাচ্ছে",
  "{n} escapes": "{n}টি এস্কেপ",
  "{a} → {b} characters": "{a} → {b}টি অক্ষর",
  "Type or paste text": "টেক্সট লিখুন বা পেস্ট করুন",
  "Paste a URL or encoded text": "একটি URL বা এনকোড করা টেক্সট পেস্ট করুন",
  Escape: "এস্কেপ",
  Unescape: "আনএস্কেপ",
  Characters: "অক্ষর",
  "Only & < > \" '": "শুধু & < > \" '",
  "Also non-ASCII": "ASCII-এর বাইরেরগুলোও",
  Style: "ধরন",
  Named: "নামসহ",
  Decimal: "দশমিক",
  "Paste text to make it safe to put in HTML.":
    "HTML-এ নিরাপদে বসাতে টেক্সট পেস্ট করুন।",
  "Paste HTML with entities like &amp; or &#233; to read it.":
    "পড়তে &amp; বা &#233;-এর মতো এনটিটিসহ HTML পেস্ট করুন।",
  "{n} characters escaped": "{n}টি অক্ষর এস্কেপ হয়েছে",
  "{n} entities decoded": "{n}টি এনটিটি ডিকোড হয়েছে",
  "Paste HTML with entities": "এনটিটিসহ HTML পেস্ট করুন",
  Escaped: "এস্কেপ করা",
  Unescaped: "আনএস্কেপ করা",
  "Expired {when}": "মেয়াদ শেষ হয়েছে {when}",
  "Valid for {d}": "আরও {d} বৈধ",
  "Not valid yet, starts {when}": "এখনও বৈধ নয়, শুরু হবে {when}",
  "Paste a token to read it. Signatures are checked on your device.":
    "পড়তে একটি টোকেন পেস্ট করুন। সিগনেচার আপনার ডিভাইসেই যাচাই হয়।",
  "Paste a JWT to start.": "শুরু করতে একটি JWT পেস্ট করুন।",
  "Not a valid JWT": "সঠিক JWT নয়",
  "Not valid yet": "এখনও বৈধ নয়",
  "Signature verified": "সিগনেচার মিলেছে",
  "Signature doesn't match": "সিগনেচার মেলেনি",
  Token: "টোকেন",
  "Paste a JWT (eyJ…)": "একটি JWT পেস্ট করুন (eyJ…)",
  Header: "হেডার",
  "This token isn't signed, so anyone could have changed it.":
    "এই টোকেনে সিগনেচার নেই, তাই যে কেউ এটি বদলে থাকতে পারে।",
  "Checking this kind of signature isn't supported here.":
    "এই ধরনের সিগনেচার এখানে যাচাই করা যায় না।",
  Secret: "সিক্রেট",
  "The secret the token was signed with":
    "যে সিক্রেট দিয়ে টোকেনটি সাইন করা হয়েছে",
  "Secret is Base64": "সিক্রেটটি Base64-এ",
  "This token is signed with a private key. Paste the matching public key (PEM, certificate or JWK) to check the signature.":
    "এই টোকেন একটি প্রাইভেট কী দিয়ে সাইন করা। সিগনেচার যাচাই করতে মিলিয়ে থাকা পাবলিক কী (PEM, সার্টিফিকেট বা JWK) পেস্ট করুন।",
  "Public key": "পাবলিক কী",
  "Signature doesn't match. The secret is wrong or the token was changed.":
    "সিগনেচার মেলেনি। সিক্রেটটি ভুল, অথবা টোকেনটি বদলানো হয়েছে।",
  "Signature doesn't match. The key is wrong or the token was changed.":
    "সিগনেচার মেলেনি। কীটি ভুল, অথবা টোকেনটি বদলানো হয়েছে।",
  "Couldn't use this key.": "এই কী ব্যবহার করা গেল না।",
  "Enter the secret to check the signature.":
    "সিগনেচার যাচাই করতে সিক্রেটটি দিন।",
  "Without the public key the signature can't be checked.":
    "পাবলিক কী ছাড়া সিগনেচার যাচাই করা যায় না।",
  Payload: "পেলোড",
  "JSON string": "JSON স্ট্রিং",
  "Escape ASCII too": "ASCII-ও এস্কেপ করুন",
  "Uppercase hex": "বড় হাতের হেক্স",
  "Type text to turn it into escapes.": "এস্কেপে বদলাতে টেক্সট লিখুন।",
  "Paste \\u, \\u{…}, U+, \\x or &#…; escapes to read them. Every form works at once.":
    "পড়তে \\u, \\u{…}, U+, \\x বা &#…; এস্কেপ পেস্ট করুন। সব ধরন একসঙ্গে চলে।",
  "{n} escapes read": "{n}টি এস্কেপ পড়া হয়েছে",
  "{n} outside the basic plane (emoji and rare symbols)":
    "{n}টি বেসিক প্লেনের বাইরে (ইমোজি ও বিরল চিহ্ন)",
  Escapes: "এস্কেপ",
  "Paste escaped text": "এস্কেপ করা টেক্সট পেস্ট করুন",
  Binary: "বাইনারি",
  "Text to bytes": "টেক্সট থেকে বাইট",
  "Bytes to text": "বাইট থেকে টেক্সট",
  Space: "স্পেস",
  Comma: "কমা",
  "New line": "নতুন লাইন",
  "0x prefix": "0x উপসর্গ",
  "Read as": "যেভাবে পড়া হবে",
  "Type text to see its UTF-8 bytes.": "UTF-8 বাইট দেখতে টেক্সট লিখুন।",
  "Paste bytes in hex, binary or decimal. Spaces, commas and 0x are fine.":
    "হেক্স, বাইনারি বা দশমিকে বাইট পেস্ট করুন। স্পেস, কমা ও 0x থাকলেও চলবে।",
  "Can't read these bytes": "এই বাইটগুলো পড়া গেল না",
  "Read as {f}": "{f} হিসেবে পড়া হয়েছে",
  "{n} bytes": "{n} বাইট",
  Bytes: "বাইট",
  "Paste hex, binary or decimal bytes":
    "হেক্স, বাইনারি বা দশমিক বাইট পেস্ট করুন",
  "Not valid Base64: unexpected character":
    "সঠিক Base64 নয়: অপ্রত্যাশিত অক্ষর",
  "Not valid Base64: padding (=) can only come at the end":
    "সঠিক Base64 নয়: প্যাডিং (=) শুধু শেষে থাকতে পারে",
  "Not valid Base64: the last group has only one character. Part of it may be missing.":
    "সঠিক Base64 নয়: শেষ গ্রুপে মাত্র একটি অক্ষর। কিছু অংশ হয়তো বাদ পড়েছে।",
  "The text has a broken character (half of an emoji or symbol) that can't be encoded":
    "টেক্সটে একটি ভাঙা অক্ষর (ইমোজি বা চিহ্নের অর্ধেক) আছে, যা এনকোড করা যায় না",
  "The text has a broken character (half of an emoji or symbol)":
    "টেক্সটে একটি ভাঙা অক্ষর (ইমোজি বা চিহ্নের অর্ধেক) আছে",
  "Not valid percent-encoding: % must be followed by two hex digits":
    "সঠিক পার্সেন্ট-এনকোডিং নয়: % এর পরে দুটি হেক্স অঙ্ক থাকতে হবে",
  "Incomplete escape": "অসম্পূর্ণ এস্কেপ",
  "Code point out of range (the highest is U+10FFFF)":
    "কোড পয়েন্ট সীমার বাইরে (সর্বোচ্চ U+10FFFF)",
  "Not valid hex: unexpected character": "সঠিক হেক্স নয়: অপ্রত্যাশিত অক্ষর",
  "Odd number of hex digits. Each byte is two digits.":
    "হেক্স অঙ্কের সংখ্যা বিজোড়। প্রতিটি বাইট দুই অঙ্কের।",
  "Not valid binary: only 0 and 1 are allowed":
    "সঠিক বাইনারি নয়: শুধু 0 ও 1 চলবে",
  "Binary bytes are groups of 8 bits. Separate them with spaces.":
    "বাইনারি বাইট হলো ৮ বিটের গ্রুপ। স্পেস দিয়ে আলাদা করুন।",
  "Not valid decimal: unexpected character":
    "সঠিক দশমিক নয়: অপ্রত্যাশিত অক্ষর",
  "Not a byte (bytes go from 0 to 255)": "বাইট নয় (বাইট ০ থেকে ২৫৫ পর্যন্ত)",
  "This is an encrypted token (JWE). Only signed tokens can be read without the key.":
    "এটি একটি এনক্রিপ্ট করা টোকেন (JWE)। কী ছাড়া শুধু সাইন করা টোকেন পড়া যায়।",
  "A JWT has three parts separated by dots (header.payload.signature).":
    "একটি JWT-তে ডট দিয়ে আলাদা তিনটি অংশ থাকে (header.payload.signature)।",
  "The header isn't JSON.": "হেডারটি JSON নয়।",
  "The key set is empty.": "কী সেটটি খালি।",
  "Paste a public key as PEM (-----BEGIN PUBLIC KEY-----) or JWK.":
    "PEM (-----BEGIN PUBLIC KEY-----) বা JWK হিসেবে একটি পাবলিক কী পেস্ট করুন।",
  "This is a private key. Paste the public key instead.":
    "এটি একটি প্রাইভেট কী। এর বদলে পাবলিক কী পেস্ট করুন।",
  "The header isn't valid Base64url.": "হেডারটি সঠিক Base64url নয়।",
  "The payload isn't valid Base64url.": "পেলোডটি সঠিক Base64url নয়।",
  "The signature isn't valid Base64url.": "সিগনেচারটি সঠিক Base64url নয়।",
  Issuer: "ইস্যুকারী",
  Audience: "প্রাপক",
  Expires: "মেয়াদ শেষ",
  "Not before": "যার আগে নয়",
  Issued: "ইস্যুর সময়",
  "Token ID": "টোকেন আইডি",
  "PNG image": "PNG ছবি",
  "JPEG image": "JPEG ছবি",
  "GIF image": "GIF ছবি",
  "PDF document": "PDF ডকুমেন্ট",
  "ZIP archive": "ZIP আর্কাইভ",
  "Gzip archive": "Gzip আর্কাইভ",
  "7-Zip archive": "7-Zip আর্কাইভ",
  "RAR archive": "RAR আর্কাইভ",
  "XZ archive": "XZ আর্কাইভ",
  "Bzip2 archive": "Bzip2 আর্কাইভ",
  "BMP image": "BMP ছবি",
  Icon: "আইকন",
  "TIFF image": "TIFF ছবি",
  "Photoshop file": "Photoshop ফাইল",
  "MP3 audio": "MP3 অডিও",
  "Ogg audio": "Ogg অডিও",
  "FLAC audio": "FLAC অডিও",
  "WebM video": "WebM ভিডিও",
  "WebAssembly module": "WebAssembly মডিউল",
  "WOFF font": "WOFF ফন্ট",
  "WOFF2 font": "WOFF2 ফন্ট",
  "TrueType font": "TrueType ফন্ট",
  "OpenType font": "OpenType ফন্ট",
  "SQLite database": "SQLite ডেটাবেস",
  "Linux program": "Linux প্রোগ্রাম",
  "Windows program": "Windows প্রোগ্রাম",
  "Java class": "Java ক্লাস",
  "WebP image": "WebP ছবি",
  "WAV audio": "WAV অডিও",
  "AVI video": "AVI ভিডিও",
  "AVIF image": "AVIF ছবি",
  "HEIC image": "HEIC ছবি",
  "QuickTime video": "QuickTime ভিডিও",
  "M4A audio": "M4A অডিও",
  "MP4 video": "MP4 ভিডিও",
  "SVG image": "SVG ছবি",
  XML: "XML",
  "Binary data": "বাইনারি ডেটা",

  // -- generate --
  "Nil UUID (all zeros)": "Nil UUID (সব শূন্য)",
  "Max UUID (all ones)": "Max UUID (সব এক)",
  Variant: "ভ্যারিয়েন্ট",
  "Standard form": "স্ট্যান্ডার্ড রূপ",
  Created: "তৈরির সময়",
  "Unix ms": "ইউনিক্স মিলিসেকেন্ড",
  "How many": "কয়টি",
  Uppercase: "বড় হাতের অক্ষর",
  "No dashes": "ড্যাশ ছাড়া",
  Braces: "বন্ধনী { }",
  "Make new ones": "নতুন বানান",
  "v4 is fully random.": "v4 পুরোপুরি র‍্যান্ডম।",
  "v7 starts with the time, so new IDs sort after old ones.":
    "v7 শুরু হয় সময় দিয়ে, তাই নতুন আইডি পুরোনোগুলোর পরে সাজানো থাকে।",
  "ULIDs start with the time and sort in order.":
    "ULID শুরু হয় সময় দিয়ে, তাই ক্রম অনুযায়ী সাজানো থাকে।",
  "Inspect an ID": "আইডি যাচাই",
  "Paste a UUID or ULID": "একটি UUID বা ULID পেস্ট করুন",
  "This isn't a UUID or a ULID.": "এটি UUID বা ULID নয়।",
  "See the version and variant of any UUID, and the time inside v7 UUIDs and ULIDs.":
    "যেকোনো UUID-এর ভার্সন ও ভ্যারিয়েন্ট দেখুন, আর v7 UUID ও ULID-এর ভেতরের সময়ও।",
  "{n} ID": "{n}টি আইডি",
  "{n} IDs": "{n}টি আইডি",
  "Time and MAC address": "সময় ও MAC ঠিকানা",
  "DCE security": "DCE সিকিউরিটি",
  "Name-based, MD5": "নামভিত্তিক, MD5",
  Random: "র‍্যান্ডম",
  "Name-based, SHA-1": "নামভিত্তিক, SHA-1",
  "Reordered time": "পুনর্বিন্যস্ত সময়",
  "Unix time and random": "ইউনিক্স সময় ও র‍্যান্ডম",
  Custom: "কাস্টম",
  Make: "বানান",
  Passphrase: "পাসফ্রেজ",
  Passwords: "পাসওয়ার্ড",
  Passphrases: "পাসফ্রেজ",
  Symbols: "চিহ্ন",
  "Skip look-alikes": "একই রকম দেখতে অক্ষর বাদ",
  "At least one of each": "প্রতিটি থেকে অন্তত একটি",
  Words: "শব্দ",
  Separator: "বিভাজক",
  Capitalise: "প্রথম অক্ষর বড়",
  "Add a number": "একটি সংখ্যা যোগ",
  "Made with your browser's secure random generator.":
    "আপনার ব্রাউজারের নিরাপদ র‍্যান্ডম জেনারেটর দিয়ে বানানো।",
  "They stay on your device until you copy them.":
    "কপি না করা পর্যন্ত এগুলো শুধু আপনার ডিভাইসেই থাকে।",
  "Try a sample": "একটি নমুনা দেখুন",
  "Pick at least one set of characters.": "অন্তত এক ধরনের অক্ষর বেছে নিন।",
  "{n} bits of entropy": "{n} বিট এনট্রপি",
  "Characters to pick from": "যত অক্ষর থেকে বাছাই",
  "Words in the list": "তালিকায় শব্দ",
  "Guesses to try them all": "সবগুলো চেষ্টা করতে যত অনুমান",
  "Each extra character or word multiplies the guesses an attacker needs. 60 bits or more is strong for most accounts; use a password manager to keep them.":
    "প্রতিটি বাড়তি অক্ষর বা শব্দ আক্রমণকারীর প্রয়োজনীয় অনুমান বহুগুণ বাড়ায়। বেশিরভাগ অ্যাকাউন্টের জন্য ৬০ বিট বা তার বেশি শক্তিশালী; মনে রাখতে পাসওয়ার্ড ম্যানেজার ব্যবহার করুন।",
  "Very weak": "খুব দুর্বল",
  Weak: "দুর্বল",
  Fair: "মোটামুটি",
  "Very strong": "খুব শক্তিশালী",
  Matches: "মিলেছে",
  Output: "আউটপুট",
  Hex: "হেক্স",
  "HMAC key": "HMAC কী",
  Optional: "ঐচ্ছিক",
  "Compare with": "মিলিয়ে দেখুন",
  "Paste a checksum": "চেকসাম পেস্ট করুন",
  "Hashing… {n}%": "হ্যাশ হচ্ছে… {n}%",
  "Couldn't hash this. Try again.": "হ্যাশ করা গেল না। আবার চেষ্টা করুন।",
  "The checksum matches:": "চেকসাম মিলেছে:",
  "No hash matches the checksum.": "কোনো হ্যাশ চেকসামের সঙ্গে মেলেনি।",
  "HMAC with your key": "আপনার কী দিয়ে HMAC",
  "Back to text": "টেক্সটে ফিরুন",
  "Hashed on your device.": "আপনার ডিভাইসেই হ্যাশ করা হয়েছে।",
  "Type or paste text, or drop a file":
    "টেক্সট লিখুন বা পেস্ট করুন, অথবা ফাইল ছাড়ুন",
  Hashes: "হ্যাশ",
  "These are the hashes of empty text. Type something to hash it.":
    "এগুলো খালি টেক্সটের হ্যাশ। হ্যাশ করতে কিছু লিখুন।",
  "MD5 and SHA-1 are fine for checksums, but don't use them for passwords or signatures.":
    "চেকসামের জন্য MD5 ও SHA-1 ঠিক আছে, তবে পাসওয়ার্ড বা সিগনেচারের জন্য এগুলো ব্যবহার করবেন না।",
  "Choose another file": "অন্য ফাইল বাছুন",
  "Hash a file": "ফাইল হ্যাশ করুন",
  Paragraphs: "অনুচ্ছেদ",
  Sentences: "বাক্য",
  "Start with “Lorem ipsum”": "“Lorem ipsum” দিয়ে শুরু",
  "Plain text": "সাধারণ টেক্সট",
  "Make new text": "নতুন টেক্সট বানান",
  "{n} words": "{n}টি শব্দ",
  "{n} characters": "{n}টি অক্ষর",
  "Placeholder text": "নমুনা টেক্সট",
  "In {zone}": "{zone}-এ",
  "ISO 8601 (UTC)": "ISO 8601 (UTC)",
  "ISO 8601 (zone)": "ISO 8601 (টাইম জোন)",
  Relative: "এখন থেকে",
  "Day of the week": "সপ্তাহের দিন",
  Week: "সপ্তাহ",
  "Week {w} of {y}, day {d} of the year":
    "{y} সালের {w} নম্বর সপ্তাহ, বছরের {d} নম্বর দিন",
  "Unix seconds": "ইউনিক্স সেকেন্ড",
  "Unix milliseconds": "ইউনিক্স মিলিসেকেন্ড",
  Unit: "একক",
  Detect: "নিজে বুঝে নিক",
  Seconds: "সেকেন্ড",
  Milliseconds: "মিলিসেকেন্ড",
  "Time zone": "টাইম জোন",
  "Use the current time": "এখনকার সময় নিন",
  "Showing the current time. Paste a timestamp to convert it.":
    "এখনকার সময় দেখানো হচ্ছে। রূপান্তর করতে একটি টাইমস্ট্যাম্প পেস্ট করুন।",
  "Read as a date": "তারিখ হিসেবে পড়া হয়েছে",
  "Read as {unit}": "{unit} হিসেবে পড়া হয়েছে",
  "{n} digits": "{n} অঙ্ক",
  seconds: "সেকেন্ড",
  milliseconds: "মিলিসেকেন্ড",
  microseconds: "মাইক্রোসেকেন্ড",
  nanoseconds: "ন্যানোসেকেন্ড",
  "This isn't a timestamp or a date JavaScript can read.":
    "এটি টাইমস্ট্যাম্প বা JavaScript পড়তে পারে এমন তারিখ নয়।",
  Timestamp: "টাইমস্ট্যাম্প",
  "Unix timestamp or date": "ইউনিক্স টাইমস্ট্যাম্প বা তারিখ",
  "Or pick a date and time ({zone})": "অথবা তারিখ ও সময় বেছে নিন ({zone})",
  "Date and time": "তারিখ ও সময়",
  "Now, seconds": "এখন, সেকেন্ডে",
  "Now, milliseconds": "এখন, মিলিসেকেন্ডে",
  "Ten digits are seconds, thirteen milliseconds, sixteen microseconds and nineteen nanoseconds. ISO dates like 2024-05-01T12:00Z work too.":
    "দশ অঙ্ক মানে সেকেন্ড, তেরো মিলিসেকেন্ড, ষোলো মাইক্রোসেকেন্ড আর উনিশ ন্যানোসেকেন্ড। 2024-05-01T12:00Z-এর মতো ISO তারিখও চলে।",
  Converted: "রূপান্তরিত",
  "Each line is converted on its own.": "প্রতিটি লাইন আলাদাভাবে রূপান্তর হয়।",
  "Paste names or text to see every case.":
    "সব কেস দেখতে নাম বা টেক্সট পেস্ট করুন।",
  "Paste names or text, one per line":
    "নাম বা টেক্সট পেস্ট করুন, প্রতি লাইনে একটি",
  Cases: "কেস",
  "camelCase, snake_case, kebab-case and nine more appear here.":
    "camelCase, snake_case, kebab-case সহ আরও নয়টি এখানে দেখাবে।",
  "{n} line": "{n}টি লাইন",
  "{n} lines": "{n}টি লাইন",
  "Title Case": "Title Case (প্রতি শব্দ বড় হাতে শুরু)",
  "Sentence case": "Sentence case (বাক্যের মতো)",
  "lower case": "lower case (সব ছোট হাতের)",
  "UPPER CASE": "UPPER CASE (সব বড় হাতের)",

  // -- convert --

  // -- text --

  // -- format --

  // -- reference --
};
