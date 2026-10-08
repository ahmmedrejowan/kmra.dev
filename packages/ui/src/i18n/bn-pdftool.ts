/**
 * Bangla interface text used only by pdftool (its tool components and pages), keyed by the English
 * string. Shared site text lives in ./bn.ts; don't repeat keys from there.
 */
export const BN_PDFTOOL: Record<string, string> = {
  // Pages
  "Free PDF tools in your browser": "ব্রাউজারেই বিনামূল্যের পিডিএফ টুল",
  "Work on PDFs in your browser": "ব্রাউজারেই পিডিএফের কাজ করুন",
  "Merge, split, compress and sign. Contracts, statements and IDs never leave your device.":
    "জোড়া দিন, ভাগ করুন, কম্প্রেস করুন আর সই করুন। চুক্তিপত্র, স্টেটমেন্ট আর আইডি কখনো আপনার ডিভাইস ছেড়ে যায় না।",
  "Drop PDFs here": "পিডিএফ এখানে ছেড়ে দিন",
  "PDF tools": "পিডিএফ টুল",
  "Every tool opens simple. Advanced shows every page.":
    "প্রতিটি টুল সহজভাবে খোলে। Advanced-এ প্রতিটি পেজ দেখা যায়।",
  "All PDF tools": "সব পিডিএফ টুল",
  "Every PDF tool, by category. All free, and everything runs on your device.":
    "সব পিডিএফ টুল, ধরন অনুযায়ী। সবই বিনামূল্যে, আর সব কাজ হয় আপনার ডিভাইসে।",
  "Does my PDF leave my device?": "আমার পিডিএফ কি ডিভাইসের বাইরে যায়?",
  "No. It's processed right in your browser, on your device.":
    "না। সব কাজ হয় আপনার ব্রাউজারে, আপনার ডিভাইসেই।",
  "No limits from us. Very large PDFs can be slow on phones because the work uses your device's memory.":
    "আমাদের দিক থেকে কোনো সীমা নেই। খুব বড় পিডিএফ ফোনে ধীরে চলতে পারে, কারণ কাজটি আপনার ডিভাইসের মেমরি ব্যবহার করে।",
  "More ways to work with PDFs.": "পিডিএফ নিয়ে কাজের আরও উপায়।",
  "All {n} PDF tools": "সব {n}টি পিডিএফ টুল",

  // Opening files
  "Drop PDFs to merge": "জোড়া দেওয়ার পিডিএফগুলো ছেড়ে দিন",
  "Drop a PDF here": "পিডিএফ এখানে ছেড়ে দিন",
  "Choose PDFs": "পিডিএফ বেছে নিন",
  "Choose a PDF": "একটি পিডিএফ বেছে নিন",
  "Opens with every page shown": "প্রতিটি পেজ দেখিয়ে খুলবে",
  "{name} is password-protected. Remove the password in the app that made it, then try again.":
    "{name} পাসওয়ার্ড দিয়ে সুরক্ষিত। যে অ্যাপে তৈরি হয়েছে সেখানে পাসওয়ার্ড সরিয়ে আবার চেষ্টা করুন।",
  "{name} couldn't be opened. It may be damaged or not a PDF.":
    "{name} খোলা যায়নি। ফাইলটি নষ্ট হতে পারে, বা এটি পিডিএফ নয়।",
  "That isn't a PDF. Drop a .pdf file.": "এটি পিডিএফ নয়। একটি .pdf ফাইল দিন।",
  "{name} is password-protected.": "{name} পাসওয়ার্ড দিয়ে সুরক্ষিত।",
  "That isn't a PDF.": "এটি পিডিএফ নয়।",
  "{name} has no pages.": "{name} ফাইলে কোনো পেজ নেই।",

  // Files and pages
  "{n} page": "{n} পেজ",
  "{n} pages": "{n} পেজ",
  "{n} file": "{n}টি ফাইল",
  "{n} files": "{n}টি ফাইল",
  "Move up": "উপরে নিন",
  "Move down": "নিচে নিন",
  "+ Add PDF": "+ পিডিএফ যোগ করুন",
  "+ Add PDFs": "+ পিডিএফ যোগ করুন",
  "+ Add another PDF": "+ আরেকটি পিডিএফ যোগ করুন",
  "Page {n}": "পেজ {n}",
  "Page {n} of {t}": "{t}-এর মধ্যে পেজ {n}",
  Blank: "ফাঁকা",
  Rotate: "ঘোরান",
  "Rotate page": "পেজ ঘোরান",
  "Insert a blank page after": "পরে একটি ফাঁকা পেজ যোগ করুন",
  "Insert blank page after": "পরে ফাঁকা পেজ যোগ করুন",
  Delete: "মুছুন",
  "Delete page": "পেজ মুছুন",
  "Click pages to remove them.": "যে পেজগুলো মুছবেন সেগুলোতে ক্লিক করুন।",
  "Click pages to pick which ones to extract.":
    "কোন পেজগুলো বের করবেন, ক্লিক করে বেছে নিন।",
  "Click pages to save only those. None picked saves all.":
    "শুধু যে পেজগুলো চান সেগুলোতে ক্লিক করুন। কিছু না বাছলে সব সেভ হবে।",
  "Picked: {n}": "বাছা হয়েছে: {n}",

  // Merge and organize
  "Files are joined in the order shown.": "ফাইলগুলো দেখানো ক্রমে জোড়া হয়।",
  "Drag pages to reorder them, rotate or delete any page.":
    "পেজ টেনে ক্রম বদলান, যেকোনো পেজ ঘোরান বা মুছুন।",
  "Switch to Advanced to arrange single pages.":
    "আলাদা পেজ সাজাতে Advanced-এ যান।",
  "Drag pages to reorder them. Rotate, delete or add blank pages, then download.":
    "পেজ টেনে ক্রম বদলান। ঘোরান, মুছুন বা ফাঁকা পেজ যোগ করুন, তারপর ডাউনলোড করুন।",

  // Remove pages and split
  "Pages to remove": "যে পেজগুলো মুছবেন",
  "e.g. {v}": "যেমন {v}",
  "Or switch to Advanced and click the pages.":
    "অথবা Advanced-এ গিয়ে পেজগুলোতে ক্লিক করুন।",
  Split: "ভাগ করুন",
  "By ranges": "রেঞ্জ ধরে",
  "Every page": "প্রতিটি পেজ",
  "Extract pages": "পেজ বের করুন",
  "Ranges (one PDF each)": "রেঞ্জ (প্রতিটি থেকে একটি পিডিএফ)",
  "Pages to keep in one PDF": "এক পিডিএফে যে পেজগুলো রাখবেন",
  "Or click pages. Picked: {n}": "অথবা পেজে ক্লিক করুন। বাছা হয়েছে: {n}",
  "Every page becomes its own PDF, saved in one zip.":
    "প্রতিটি পেজ আলাদা পিডিএফ হবে, সব একটি জিপে সেভ হবে।",
  "That would remove every page.": "এতে সব পেজ মুছে যাবে।",
  "Pick pages, or type them like 1-3, 5.":
    "পেজ বেছে নিন, অথবা 1-3, 5 এভাবে লিখুন।",
  "Type page ranges like 1-3, 4-6.": "1-3, 4-6 এভাবে পেজের রেঞ্জ লিখুন।",
  "There are no pages left.": "আর কোনো পেজ বাকি নেই।",

  // Rotate
  "Rotate every page": "সব পেজ ঘোরান",
  "Upside down": "উল্টো করে",

  // Compress and grayscale
  Strong: "বেশি",
  Smallest: "সবচেয়ে ছোট",
  "Or fit under a size": "অথবা নির্দিষ্ট সাইজের মধ্যে আনুন",
  "{n} KB": "{n} কেবি",
  "{n} MB": "{n} এমবি",
  "Pages are redrawn as images, which shrinks scans and photos a lot. Text can't be selected afterwards.":
    "পেজগুলো ছবি হিসেবে নতুন করে আঁকা হয়, তাই স্ক্যান আর ছবি অনেক ছোট হয়। পরে লেখা আর সিলেক্ট করা যায় না।",
  "Every page is redrawn in black and white. Good for printing and smaller files. Text can't be selected afterwards.":
    "প্রতিটি পেজ সাদা-কালোয় নতুন করে আঁকা হয়। প্রিন্ট আর ছোট ফাইলের জন্য ভালো। পরে লেখা আর সিলেক্ট করা যায় না।",
  "Re-saving…": "আবার সেভ হচ্ছে…",
  "Page {n} of {t}…": "{t}-এর মধ্যে পেজ {n}…",
  "{d} dpi: page {n} of {t}…": "{d} ডিপিআই: {t}-এর মধ্যে পেজ {n}…",
  "{n}% smaller": "{n}% ছোট",
  "{n}% larger": "{n}% বড়",
  "Couldn't get under the limit even at the lowest setting. This is the smallest version.":
    "সবচেয়ে কম সেটিংয়েও সীমার নিচে আনা যায়নি। এটিই সবচেয়ে ছোট সংস্করণ।",
  "This PDF is already well compressed. Keep your original.":
    "এই পিডিএফ আগেই ভালোভাবে কম্প্রেস করা। আপনার আসল ফাইলটিই রাখুন।",

  // PDF to image and text
  "Save pages as": "পেজ যেভাবে সেভ হবে",
  "Screen ({n} dpi)": "স্ক্রিন ({n} ডিপিআই)",
  "Good ({n})": "ভালো ({n})",
  "Print ({n})": "প্রিন্ট ({n})",
  "Reading page {n}…": "পেজ {n} পড়া হচ্ছে…",
  "Copies the text layer. Scanned pages (pictures of text) have none; they'd need OCR.":
    "পিডিএফের লেখার স্তর কপি করে। স্ক্যান করা পেজে (লেখার ছবি) এটি থাকে না; সেগুলোর জন্য OCR লাগবে।",
  "Copy text": "লেখা কপি করুন",
  "Text copied": "লেখা কপি হয়েছে",
  "Extracted text": "বের করা লেখা",

  // Page numbers
  "Top left": "উপরে বাঁয়ে",
  "Top centre": "উপরে মাঝখানে",
  "Top right": "উপরে ডানে",
  "Bottom left": "নিচে বাঁয়ে",
  "Bottom centre": "নিচে মাঝখানে",
  "Bottom right": "নিচে ডানে",
  "Start at": "শুরু হবে",
  "Skip the first page (cover)": "প্রথম পেজ (কভার) বাদ দিন",

  // Watermark
  "Once, centred": "একবার, মাঝখানে",
  "Repeat across the page": "পুরো পেজ জুড়ে",
  Angle: "কোণ",
  Flat: "সোজা",
  Diagonal: "কোনাকুনি",
  Upright: "খাড়া",

  // Metadata
  "Remove all document info": "ডকুমেন্টের সব তথ্য মুছুন",
  Title: "শিরোনাম",
  Author: "লেখক",
  Keywords: "কিওয়ার্ড",
  Creator: "তৈরির অ্যাপ",
  Producer: "প্রোডিউসার",
  "These fields come from the first file and are written to every file.":
    "এই ঘরগুলো প্রথম ফাইল থেকে নেওয়া, আর সব ফাইলেই লেখা হবে।",

  // Actions and results
  "Merge {n} PDFs": "{n}টি পিডিএফ জোড়া দিন",
  "Merge PDF": "পিডিএফ জোড়া দিন",
  "Save PDF": "পিডিএফ সেভ করুন",
  "Remove pages": "পেজ মুছুন",
  Compress: "কম্প্রেস করুন",
  "Make black and white": "সাদা-কালো করুন",
  "Convert to images": "ছবিতে কনভার্ট করুন",
  "Extract text": "লেখা বের করুন",
  "Add page numbers": "পেজ নম্বর দিন",
  "Add watermark": "ওয়াটারমার্ক দিন",
  "Remove info": "তথ্য মুছুন",
  "Save info": "তথ্য সেভ করুন",
  Save: "সেভ করুন",
  "Download {n} files (zip)": "{n}টি ফাইল ডাউনলোড (zip)",
  "Back to Simple": "সহজ মোডে ফিরুন",
  "See every page in Advanced": "Advanced-এ প্রতিটি পেজ দেখুন",
  "This PDF is password-protected and can't be changed here.":
    "এই পিডিএফ পাসওয়ার্ড দিয়ে সুরক্ষিত, এখানে বদলানো যাবে না।",
  "Something went wrong. The PDF may be damaged.":
    "কিছু একটা ভুল হয়েছে। পিডিএফটি নষ্ট হতে পারে।",

  // Sign
  "Drop the PDF to sign": "যে পিডিএফে সই করবেন সেটি ছেড়ে দিন",
  "Previous page": "আগের পেজ",
  "Next page": "পরের পেজ",
  Draw: "আঁকুন",
  Type: "লিখুন",
  Photo: "ছবি",
  "Draw your signature here": "এখানে আপনার সই আঁকুন",
  "Your name": "আপনার নাম",
  "A photo of your signature on white paper. The paper is removed for you.":
    "সাদা কাগজে আপনার সইয়ের একটি ছবি। কাগজটি নিজে থেকেই সরিয়ে দেওয়া হয়।",
  Ink: "কালি",
  "Choose photo and place it": "ছবি বেছে বসান",
  "Place on this page": "এই পেজে বসান",
  "Text (name, date, initials)": "লেখা (নাম, তারিখ, আদ্যক্ষর)",
  "Type text to add": "যোগ করার লেখা লিখুন",
  Date: "তারিখ",
  Tick: "টিক",
  "+ Today's date": "+ আজকের তারিখ",
  "+ Tick ✓": "+ টিক ✓",
  "Drag to move. Use the corner to resize. Everything stays on your device.":
    "সরাতে টানুন। মাপ বদলাতে কোণ ধরে টানুন। সব কিছু আপনার ডিভাইসেই থাকে।",
  "{n} item on {p} page": "{p}টি পেজে {n}টি জিনিস",
  "{n} item on {p} pages": "{p}টি পেজে {n}টি জিনিস",
  "{n} items on {p} page": "{p}টি পেজে {n}টি জিনিস",
  "{n} items on {p} pages": "{p}টি পেজে {n}টি জিনিস",
  "Download signed PDF": "সই করা পিডিএফ ডাউনলোড করুন",
  "Saving…": "সেভ হচ্ছে…",
  "Use another PDF": "অন্য পিডিএফ নিন",
  "Draw your signature in the box first.": "আগে বক্সে আপনার সই আঁকুন।",
  "Type your name first.": "আগে আপনার নাম লিখুন।",
  "Type the text first.": "আগে লেখাটি লিখুন।",
  "Saved, {size}.": "সেভ হয়েছে, {size}।",
  "This PDF is password-protected and can't be changed.":
    "এই পিডিএফ পাসওয়ার্ড দিয়ে সুরক্ষিত, বদলানো যাবে না।",
  "Couldn't save. The PDF may be damaged.":
    "সেভ করা যায়নি। পিডিএফটি নষ্ট হতে পারে।",

  // Image to PDF
  "Drop photos or scans": "ছবি বা স্ক্যান ছেড়ে দিন",
  "+ Add images": "+ ছবি যোগ করুন",
  "Drag images to change the order. Each image becomes one page.":
    "ক্রম বদলাতে ছবি টানুন। প্রতিটি ছবি একটি পেজ হবে।",
  "Page size": "পেজের মাপ",
  "Same as image": "ছবির মাপে",
  Margin: "মার্জিন",
  Small: "ছোট",
  Large: "বড়",
  "Image quality": "ছবির মান",
  Medium: "মাঝারি",
  "Small file": "ছোট ফাইল",
  "{n} image": "{n}টি ছবি",
  "{n} images": "{n}টি ছবি",
  "Make PDF and download": "পিডিএফ বানিয়ে ডাউনলোড করুন",
  "Image {n} of {t}…": "{t}টির মধ্যে ছবি {n}…",
  "{name} couldn't be read and was skipped.":
    "{name} পড়া যায়নি, তাই বাদ দেওয়া হয়েছে।",
  "Saved a {n}-page PDF, {size}.": "{n} পেজের পিডিএফ সেভ হয়েছে, {size}।",

  // Workspaces (desk)
  "Aim: under {size}": "লক্ষ্য: {size}-এর নিচে",
  "Already under {size}. It's re-saved without loss.":
    "আগে থেকেই {size}-এর নিচে। মান না কমিয়ে আবার সেভ করা হবে।",
  Compressed: "কম্প্রেস করা",
  "The new size shows here after you compress.":
    "কম্প্রেস করার পর নতুন সাইজ এখানে দেখা যাবে।",
  "Light: pages redrawn at 150 dpi, sharp text":
    "হালকা: পেজ ১৫০ dpi-তে নতুন করে আঁকা হয়, লেখা স্পষ্ট থাকে",
  "Strong: pages redrawn at 110 dpi, good for email":
    "জোরালো: পেজ ১১০ dpi-তে নতুন করে আঁকা হয়, ইমেইলের জন্য ভালো",
  "Smallest: pages redrawn at 80 dpi, for tight upload limits":
    "সবচেয়ে ছোট: পেজ ৮০ dpi-তে নতুন করে আঁকা হয়, কড়া আপলোড সীমার জন্য",
  "Black and white": "সাদাকালো",
  "The other {n} pages turn the same way.": "বাকি {n}টি পেজও একইভাবে ঘুরবে।",
  "Document properties": "ডকুমেন্টের তথ্য",
  Removed: "সরানো হয়েছে",
  "Not set": "দেওয়া নেই",
  "PDF version": "পিডিএফ সংস্করণ",
  "One PDF": "একটি পিডিএফ",
  "no number (cover)": "নম্বর নেই (কভার)",
  "Every page gets the same watermark.": "প্রতিটি পেজে একই ওয়াটারমার্ক বসবে।",
  "Click pages or type them to pick what goes in the new PDF.":
    "নতুন পিডিএফে কোন পেজ যাবে, ক্লিক করে বা লিখে বেছে নিন।",
  "Type ranges to see how the pages split.":
    "পেজগুলো কীভাবে ভাগ হবে দেখতে রেঞ্জ লিখুন।",
  "Makes {n} PDF": "{n}টি পিডিএফ হবে",
  "Makes {n} PDFs": "{n}টি পিডিএফ হবে",
  "File {n}": "ফাইল {n}",
  "Not included": "বাদ থাকবে",
  "{k} kept, {r} removed": "{k}টি থাকবে, {r}টি সরবে",
  "{n} page picked": "{n}টি পেজ বাছা হয়েছে",
  "{n} pages picked": "{n}টি পেজ বাছা হয়েছে",
  "Every page is saved. Tick pages to save only those.":
    "প্রতিটি পেজ সেভ হবে। শুধু কিছু পেজ চাইলে সেগুলোতে টিক দিন।",
  "{n} dpi": "{n} dpi",
  "No text on this page.": "এই পেজে কোনো লেখা নেই।",
  "Extract the text to read it here, page by page.":
    "লেখা বের করুন, তারপর এখানে পেজ ধরে ধরে পড়ুন।",
};
