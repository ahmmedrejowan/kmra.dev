/**
 * Bangla interface text used only by qrtool (its tool components and pages), keyed by the English
 * string. Shared site text lives in ./bn.ts; don't repeat keys from there.
 */
export const BN_QRTOOL: Record<string, string> = {
  // Home
  "Free QR code generator and scanner":
    "বিনামূল্যের কিউআর কোড জেনারেটর ও স্ক্যানার",
  "QR codes that never expire": "কিউআর কোড, যার মেয়াদ কখনো ফুরায় না",
  "Make QR codes and barcodes, or scan one from your camera or a screenshot. No sign-up, no tracking links.":
    "কিউআর কোড আর বারকোড বানান, অথবা ক্যামেরা বা স্ক্রিনশট থেকে স্ক্যান করুন। সাইন-আপ লাগে না, কোনো ট্র্যাকিং লিংক নেই।",
  "Drop an image to scan its code": "কোড স্ক্যান করতে একটি ছবি দিন",
  Screenshot: "স্ক্রিনশট",
  Photo: "ছবি",
  "Or paste a screenshot. Read on your device.":
    "অথবা স্ক্রিনশট পেস্ট করুন। পড়া হয় আপনার ডিভাইসেই।",
  "Drop to scan": "স্ক্যান করতে ছেড়ে দিন",
  "QR tools": "কিউআর টুল",
  "Free, private, and the codes are yours forever.":
    "বিনামূল্যে, ব্যক্তিগত, আর কোড চিরকাল আপনার।",

  // Tool pages
  "Does anything leave my device?": "কিছু কি আমার ডিভাইসের বাইরে যায়?",
  "No. Codes are made and read in your browser. Links go straight to your address, with no redirect or tracking.":
    "না। কোড তৈরি ও পড়া হয় আপনার ব্রাউজারেই। লিংক সরাসরি আপনার ঠিকানায় যায়, কোনো রিডাইরেক্ট বা ট্র্যাকিং ছাড়া।",
  "Do the codes expire?": "কোডের কি মেয়াদ ফুরায়?",
  "Never. The code holds your content directly, so it works for as long as the link or text does.":
    "কখনো না। কোডের ভেতরেই আপনার লেখা বা লিংক থাকে, তাই লিংক বা লেখা যতদিন ঠিক থাকে, কোডও ততদিন কাজ করে।",
  "More ways to make and read codes.": "কোড বানানো আর পড়ার আরও উপায়।",
  "All {n} QR tools": "সব {n}টি কিউআর টুল",
  "All QR tools": "সব কিউআর টুল",
  "Every QR tool, by category. All free, and everything runs on your device.":
    "বিভাগ অনুযায়ী সব কিউআর টুল। সবই বিনামূল্যে, আর সব কাজ হয় আপনার ডিভাইসে।",

  // Generator
  "Fill in the details first.": "আগে তথ্যগুলো লিখুন।",
  "Too much text for one QR code. Shorten it a little.":
    "একটি কিউআর কোডের জন্য লেখা বেশি লম্বা। একটু ছোট করুন।",
  "Ready to scan. It never expires and has no tracking.":
    "স্ক্যানের জন্য তৈরি। এর মেয়াদ কখনো ফুরায় না, কোনো ট্র্যাকিংও নেই।",
  "Example code. Fill in the details to make yours.":
    "এটি নমুনা কোড। আপনারটা বানাতে তথ্যগুলো লিখুন।",
  "QR code for": "কিসের কিউআর কোড",
  Link: "লিংক",
  "Wi-Fi": "ওয়াই-ফাই",
  WhatsApp: "হোয়াটসঅ্যাপ",
  Email: "ইমেইল",
  Phone: "ফোন",
  SMS: "এসএমএস",
  "Any text": "যেকোনো লেখা",
  "Network name (SSID)": "নেটওয়ার্কের নাম (SSID)",
  "Home Wi-Fi": "বাসার ওয়াই-ফাই",
  Password: "পাসওয়ার্ড",
  "Wi-Fi password": "ওয়াই-ফাই পাসওয়ার্ড",
  "First name": "নামের প্রথম অংশ",
  "Last name": "নামের শেষ অংশ",
  Company: "প্রতিষ্ঠান",
  "Job title": "পদবি",
  Website: "ওয়েবসাইট",
  Address: "ঠিকানা",
  "Email address": "ইমেইল ঠিকানা",
  Message: "মেসেজ",
  "Phone number": "ফোন নম্বর",
  "WhatsApp number with country code": "কান্ট্রি কোডসহ হোয়াটসঅ্যাপ নম্বর",
  "Message (optional)": "মেসেজ (ঐচ্ছিক)",
  Coordinates: "স্থানাঙ্ক",
  Security: "নিরাপত্তা",
  "Hidden network": "লুকানো নেটওয়ার্ক",
  "Transparent background": "স্বচ্ছ ব্যাকগ্রাউন্ড",
  Dots: "ডট",
  Rounded: "গোল",
  Fluid: "মসৃণ",
  Corners: "কোণা",
  Circle: "বৃত্ত",
  "Logo in the middle": "মাঝখানে লোগো",
  "Logo added": "লোগো যোগ হয়েছে",
  "Add a logo": "লোগো যোগ করুন",
  "Error correction is set to High so the code still scans.":
    "এরর কারেকশন বেশি করা হয়েছে, যাতে কোড ঠিকমতো স্ক্যান হয়।",
  "Error correction": "এরর কারেকশন",
  Medium: "মাঝারি",
  Max: "সর্বোচ্চ",
  "Quiet zone": "চারপাশের ফাঁকা জায়গা",
  Tight: "কম",
  Wide: "বেশি",
  "Low contrast. Use a dark code on a light background, or some phones won't read it.":
    "কনট্রাস্ট কম। হালকা ব্যাকগ্রাউন্ডে গাঢ় কোড দিন, নইলে কিছু ফোন এটি পড়তে পারবে না।",
  "PNG size": "PNG সাইজ",
  "{n} px": "{n} পিক্সেল",
  "Download PNG": "PNG ডাউনলোড",
  "Copy text": "লেখা কপি করুন",
  "Code text copied": "কোডের লেখা কপি হয়েছে",
  "Fewer options": "কম অপশন",
  "Style, logo and more in Advanced": "স্টাইল, লোগো আর আরও অপশন Advanced-এ",

  // Scanner
  "Open link": "লিংক খুলুন",
  Network: "নেটওয়ার্ক",
  "(hidden)": "(লুকানো)",
  Open: "খোলা",
  Name: "নাম",
  "Password copied": "পাসওয়ার্ড কপি হয়েছে",
  "Save contact (.vcf)": "কন্টাক্ট সেভ করুন (.vcf)",
  "Email to": "ইমেইল যাবে",
  ", subject “{s}”": ", বিষয় “{s}”",
  "Write email": "ইমেইল লিখুন",
  "Call {n}": "{n}-এ কল করুন",
  "Text {n}": "{n}-এ মেসেজ",
  "No code found. Try a sharper or closer picture.":
    "কোনো কোড পাওয়া যায়নি। আরও পরিষ্কার বা কাছ থেকে তোলা ছবি দিন।",
  "That image couldn't be read.": "ছবিটি পড়া গেল না।",
  "Camera access was blocked. Allow it in your browser's site settings, or use an image instead.":
    "ক্যামেরার অনুমতি বন্ধ আছে। ব্রাউজারের সাইট সেটিংসে অনুমতি দিন, অথবা ছবি ব্যবহার করুন।",
  "No camera found. Use an image instead.":
    "কোনো ক্যামেরা পাওয়া যায়নি। ছবি ব্যবহার করুন।",
  "The camera couldn't start. Use an image instead.":
    "ক্যামেরা চালু হলো না। ছবি ব্যবহার করুন।",
  "Code read. Scan another?": "কোড পড়া হয়েছে। আরেকটি স্ক্যান করবেন?",
  "The camera is used only on this device. Nothing is recorded or sent.":
    "ক্যামেরা শুধু এই ডিভাইসেই ব্যবহার হয়। কিছু রেকর্ড বা পাঠানো হয় না।",
  "Scan another": "আরেকটি স্ক্যান করুন",
  "Start camera": "ক্যামেরা চালু করুন",
  "Stop camera": "ক্যামেরা বন্ধ করুন",
  "Scanned image": "স্ক্যান করা ছবি",
  "Drop an image with a code": "কোডসহ একটি ছবি দিন",
  "Or paste a screenshot, or click to choose.":
    "অথবা স্ক্রিনশট পেস্ট করুন, বা ক্লিক করে বেছে নিন।",
  "Scan from": "যেখান থেকে স্ক্যান",
  "Image or screenshot": "ছবি বা স্ক্রিনশট",
  "1 code found": "১টি কোড পাওয়া গেছে",
  "{n} codes found": "{n}টি কোড পাওয়া গেছে",
  "Results appear here. Links are never opened without you.":
    "ফলাফল এখানে দেখাবে। আপনি না চাইলে কোনো লিংক খোলা হয় না।",
  "Not secure (http). Don't enter passwords on this site.":
    "নিরাপদ নয় (http)। এই সাইটে পাসওয়ার্ড দেবেন না।",
  "A short link: it hides the real address.":
    "এটি একটি ছোট লিংক: আসল ঠিকানা লুকিয়ে রাখে।",
  "The address uses look-alike characters.":
    "ঠিকানায় দেখতে একই রকম কিন্তু আলাদা অক্ষর আছে।",
  "The address is a bare IP number, not a name.":
    "ঠিকানাটি নাম নয়, শুধু একটি আইপি নম্বর।",
  "The link contains a login.": "লিংকের ভেতরে লগইনের তথ্য আছে।",

  // Barcode
  "That doesn't fit this barcode type.": "এটি এই ধরনের বারকোডে মেলে না।",
  "{format} barcode for {value}": "{value}-এর {format} বারকোড",
  Type: "ধরন",
  "Number or text": "নম্বর বা লেখা",
  Height: "উচ্চতা",
  Short: "খাটো",
  Tall: "লম্বা",
  Navy: "গাঢ় নীল",
  "Show the number under the bars": "দাগের নিচে নম্বর দেখান",
  "Download SVG": "SVG ডাউনলোড",
  "Letters and numbers. Labels, shipping, inventory.":
    "অক্ষর আর সংখ্যা। লেবেল, শিপিং, ইনভেন্টরি।",
  "Retail products. 12 digits; the 13th is added.":
    "দোকানের পণ্য। ১২টি অঙ্ক দিন; ১৩তমটি নিজে থেকে যোগ হয়।",
  "Retail in the US and Canada. 11 digits; the 12th is added.":
    "যুক্তরাষ্ট্র ও কানাডার দোকানের পণ্য। ১১টি অঙ্ক দিন; ১২তমটি নিজে থেকে যোগ হয়।",
  "Small products. 7 digits; the 8th is added.":
    "ছোট পণ্য। ৭টি অঙ্ক দিন; ৮মটি নিজে থেকে যোগ হয়।",
  "Capital letters, digits and - . $ / + %. Older systems, ID badges.":
    "বড় হাতের অক্ষর, অঙ্ক আর - . $ / + %। পুরোনো সিস্টেম, আইডি ব্যাজ।",
  "Cartons and cases. 13 digits; the 14th is added.":
    "কার্টন আর বাক্স। ১৩টি অঙ্ক দিন; ১৪তমটি নিজে থেকে যোগ হয়।",
  "Libraries and blood banks.": "লাইব্রেরি আর ব্লাড ব্যাংক।",

  // Bulk
  "Making codes…": "কোড তৈরি হচ্ছে…",
  "Code {i} of {n}…": "{n}টির মধ্যে {i} নম্বর কোড…",
  "{n} lines were too long and were skipped.":
    "{n}টি লাইন বেশি লম্বা ছিল, তাই বাদ দেওয়া হয়েছে।",
  "Too long": "বেশি লম্বা",
  "and {n} more": "আর আরও {n}টি",
  "One link or text per line": "প্রতি লাইনে একটি লিংক বা লেখা",
  "Add a file name first with “ | ”, like Table 1 | https://…":
    "ফাইলের নাম দিতে আগে নাম লিখে “ | ” দিন, যেমন Table 1 | https://…",
  "1 code": "১টি কোড",
  "{n} codes": "{n}টি কোড",
  "Download {n} as zip": "{n}টি zip হিসেবে ডাউনলোড",
};
