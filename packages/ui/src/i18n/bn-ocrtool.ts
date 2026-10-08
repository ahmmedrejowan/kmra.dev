/**
 * Bangla interface text used only by ocrtool, keyed by the English string. Shared site text lives
 * in ./bn.ts; don't repeat keys from there or the other app files. Each part adds keys under its
 * own marker.
 */
export const BN_OCRTOOL: Record<string, string> = {
  // -- pages --
  "Free OCR: copy text from images and PDFs":
    "বিনামূল্যে OCR: ছবি আর পিডিএফ থেকে টেক্সট কপি করুন",
  "Copy text from any image or scan":
    "যেকোনো ছবি বা স্ক্যান থেকে টেক্সট কপি করুন",
  "Screenshots, photos and scanned PDFs to text, in 40+ languages. Everything runs on your device.":
    "স্ক্রিনশট, ছবি আর স্ক্যান করা পিডিএফ থেকে টেক্সট, ৪০টিরও বেশি ভাষায়। সব কাজ হয় আপনার ডিভাইসে।",
  "Drop an image or PDF to read its text":
    "টেক্সট পড়তে একটি ছবি বা পিডিএফ ছেড়ে দিন",
  "Choose a file": "একটি ফাইল বেছে নিন",
  "Drop to read the text": "টেক্সট পড়তে ছেড়ে দিন",
  "OCR tools": "ওসিআর টুল",
  "Free, private, and your files stay on your device.":
    "বিনামূল্যে, ব্যক্তিগত, আর আপনার ফাইল আপনার ডিভাইসেই থাকে।",
  "All OCR tools": "সব ওসিআর টুল",
  "Every OCR tool, by category. All free, and everything runs on your device.":
    "ধরন অনুযায়ী সব ওসিআর টুল। সবই বিনামূল্যে, আর সব কাজ হয় আপনার ডিভাইসে।",
  "All {n} OCR tools": "সব {n}টি ওসিআর টুল",
  "More ways to get text out of files.": "ফাইল থেকে টেক্সট বের করার আরও উপায়।",
  "Do my files leave my device?": "আমার ফাইল কি ডিভাইসের বাইরে যায়?",
  "No. Text is read in your browser. The OCR engine and language data are downloaded once, then your files are processed and stay on your device.":
    "না। টেক্সট পড়া হয় আপনার ব্রাউজারে। OCR ইঞ্জিন আর ভাষার ডেটা একবার ডাউনলোড হয়, তারপর আপনার ফাইল প্রক্রিয়া হয় আর আপনার ডিভাইসেই থাকে।",
  "Which languages work?": "কোন কোন ভাষা কাজ করে?",
  "More than 40, including Chinese, Japanese, Korean, Arabic, Hindi and Russian. Each language downloads the first time you use it.":
    "৪০টিরও বেশি, যার মধ্যে চীনা, জাপানি, কোরীয়, আরবি, হিন্দি আর রুশ আছে। প্রতিটি ভাষা প্রথমবার ব্যবহারের সময় ডাউনলোড হয়।",
  "Does it read handwriting?": "হাতের লেখা কি পড়তে পারে?",
  "It's made for printed and on-screen text. Neat handwriting sometimes works, but results vary.":
    "এটি ছাপা আর স্ক্রিনের লেখার জন্য বানানো। পরিষ্কার হাতের লেখা কখনো কখনো কাজ করে, তবে ফল সব সময় এক রকম হয় না।",
  // -- document engine and image tools --
  "There's no image on the clipboard.": "ক্লিপবোর্ডে কোনো ছবি নেই।",
  "This image can't be opened here. Try JPEG, PNG or WebP.":
    "এই ছবিটি এখানে খোলা যাচ্ছে না। JPEG, PNG বা WebP দিয়ে চেষ্টা করুন।",
  "Couldn't read the text. Check your connection for the first download, then try again.":
    "টেক্সট পড়া যায়নি। প্রথম ডাউনলোডের জন্য ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।",
  "Open another image": "আরেকটি ছবি খুলুন",
  "{n} images dropped. This tool reads one at a time; Batch OCR reads them all.":
    "{n}টি ছবি দেওয়া হয়েছে। এই টুল একবারে একটি পড়ে; ব্যাচ OCR সবগুলো একসাথে পড়ে।",
  "Open them in Batch OCR": "ব্যাচ OCR-এ খুলুন",
  "That's a PDF. PDF to text reads every page of it.":
    "এটি একটি পিডিএফ। পিডিএফ থেকে টেক্সট টুল এর প্রতিটি পেজ পড়ে।",
  "Open in PDF to text": "পিডিএফ থেকে টেক্সটে খুলুন",
  "That's a PDF. This tool reads images: JPEG, PNG, WebP, GIF or AVIF.":
    "এটি একটি পিডিএফ। এই টুল ছবি পড়ে: JPEG, PNG, WebP, GIF বা AVIF।",
  "Drop an image, screenshot or scan":
    "একটি ছবি, স্ক্রিনশট বা স্ক্যান ছেড়ে দিন",
  "The text appears here.": "টেক্সট এখানে দেখা যাবে।",
  "Undo edits": "সম্পাদনা বাতিল করুন",
  "Download {ext}": "{ext} ডাউনলোড করুন",
  "Read with the photo engine": "ফটো ইঞ্জিন দিয়ে পড়া হয়েছে",
  "Read with the document engine": "ডকুমেন্ট ইঞ্জিন দিয়ে পড়া হয়েছে",
  "Confidence {n}%": "নিশ্চয়তা {n}%",
  "{s} s": "{s} সেকেন্ড",
  "Tinted words may be wrong": "রঙ করা শব্দগুলো ভুল হতে পারে",
  "The photo engine doesn't read these languages yet, so the document engine was used.":
    "ফটো ইঞ্জিন এখনো এই ভাষাগুলো পড়তে পারে না, তাই ডকুমেন্ট ইঞ্জিন ব্যবহার করা হয়েছে।",
  "No text found in this image.": "এই ছবিতে কোনো টেক্সট পাওয়া যায়নি।",
  "Everything runs on your device.": "সব কাজ হয় আপনার ডিভাইসে।",
  "Recognized text": "পড়া টেক্সট",
  "Those aren't images or PDFs. Try JPEG, PNG, WebP or PDF.":
    "এগুলো ছবি বা পিডিএফ নয়। JPEG, PNG, WebP বা পিডিএফ দিয়ে চেষ্টা করুন।",
  "Couldn't read the text.": "টেক্সট পড়া যায়নি।",
  "Settings changed. New files use them; read the others again to update them.":
    "সেটিংস বদলেছে। নতুন ফাইলে এগুলো ব্যবহার হবে; বাকিগুলো হালনাগাদ করতে আবার পড়ুন।",
  "Read all again": "সবগুলো আবার পড়ুন",
  "Drop images or PDFs": "ছবি বা পিডিএফ ছেড়ে দিন",
  "No text found": "কোনো টেক্সট পাওয়া যায়নি",
  "Hide text": "টেক্সট লুকান",
  "Show text": "টেক্সট দেখান",
  "Text of {name}": "{name}-এর টেক্সট",
  "Zip of .txt files": ".txt ফাইলের zip",
  "One .txt": "একটি .txt",
  "One .md": "একটি .md",
  Document: "ডকুমেন্ট",
  "Auto ({engine})": "অটো ({engine})",
  "Photo and screenshot": "ছবি ও স্ক্রিনশট",
  Engine: "ইঞ্জিন",
  "Up to {n} languages at once. Remove one first.":
    "একবারে সর্বোচ্চ {n}টি ভাষা। আগে একটি সরান।",
  Languages: "ভাষা",
  "Search languages": "ভাষা খুঁজুন",
  "Pick up to {n}. Each language downloads once, then works offline.":
    "সর্বোচ্চ {n}টি বেছে নিন। প্রতিটি ভাষা একবার ডাউনলোড হয়, তারপর অফলাইনেও কাজ করে।",
  "On this device": "এই ডিভাইসে আছে",
  "No language matches.": "কোনো ভাষা মেলেনি।",
  "Downloading the {name} language data, {size}. Only the first time. {pct}":
    "{name} ভাষার ডেটা ডাউনলোড হচ্ছে, {size}। শুধু প্রথমবার। {pct}",
  "Downloading language data for {names}, {size}. Only the first time. {pct}":
    "{names} ভাষার ডেটা ডাউনলোড হচ্ছে, {size}। শুধু প্রথমবার। {pct}",
  "Starting the OCR engine…": "OCR ইঞ্জিন চালু হচ্ছে…",
  "Preparing the language data…": "ভাষার ডেটা তৈরি করা হচ্ছে…",
  "Reading text… {pct}": "টেক্সট পড়া হচ্ছে… {pct}",
  "Downloading language data": "ভাষার ডেটা ডাউনলোড হচ্ছে",
  "Loading engine": "ইঞ্জিন লোড হচ্ছে",
  "Loading language data": "ভাষার ডেটা লোড হচ্ছে",
  "Reading text": "টেক্সট পড়া হচ্ছে",
  // Language names (English names; the native names next to them stay as they are)
  English: "ইংরেজি",
  "Chinese (Simplified)": "চীনা (সরলীকৃত)",
  "Chinese (Traditional)": "চীনা (প্রথাগত)",
  Japanese: "জাপানি",
  "Japanese (vertical)": "জাপানি (উল্লম্ব)",
  Korean: "কোরীয়",
  Arabic: "আরবি",
  Hindi: "হিন্দি",
  Bangla: "বাংলা",
  Russian: "রুশ",
  Ukrainian: "ইউক্রেনীয়",
  Bulgarian: "বুলগেরীয়",
  Spanish: "স্প্যানিশ",
  Portuguese: "পর্তুগিজ",
  French: "ফরাসি",
  German: "জার্মান",
  Italian: "ইতালীয়",
  Dutch: "ডাচ",
  Polish: "পোলিশ",
  Turkish: "তুর্কি",
  Vietnamese: "ভিয়েতনামি",
  Indonesian: "ইন্দোনেশীয়",
  Malay: "মালয়",
  Thai: "থাই",
  Hebrew: "হিব্রু",
  Persian: "ফারসি",
  Urdu: "উর্দু",
  Tamil: "তামিল",
  Telugu: "তেলুগু",
  Marathi: "মারাঠি",
  Nepali: "নেপালি",
  Gujarati: "গুজরাটি",
  Kannada: "কন্নড়",
  Malayalam: "মালয়ালম",
  Punjabi: "পাঞ্জাবি",
  Greek: "গ্রিক",
  Czech: "চেক",
  Romanian: "রোমানীয়",
  Hungarian: "হাঙ্গেরীয়",
  Swedish: "সুইডিশ",
  Norwegian: "নরওয়েজীয়",
  Danish: "ডেনিশ",
  Finnish: "ফিনিশ",
  // -- photo engine --
  "Downloading the photo engine (first time only)":
    "ফটো ইঞ্জিন ডাউনলোড হচ্ছে (শুধু প্রথমবার)",
  "Loading the photo engine": "ফটো ইঞ্জিন লোড হচ্ছে",
  "Finding lines of text": "টেক্সটের লাইন খোঁজা হচ্ছে",
  "Reading the lines": "লাইনগুলো পড়া হচ্ছে",
  "The photo engine couldn't load. Check your connection and try again.":
    "ফটো ইঞ্জিন লোড হয়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।",
  "The photo engine couldn't read this image.":
    "ফটো ইঞ্জিন এই ছবিটি পড়তে পারেনি।",
  "The photo engine doesn't read the chosen languages. Use the document engine.":
    "বেছে নেওয়া ভাষাগুলো ফটো ইঞ্জিন পড়তে পারে না। ডকুমেন্ট ইঞ্জিন ব্যবহার করুন।",
  // -- pdf tools --
  All: "সব",
  "All pages": "সব পেজ",
  "Already has text. Kept as it is.":
    "আগে থেকেই টেক্সট আছে। যেমন আছে তেমনই রাখা হয়েছে।",
  "Another PDF": "অন্য পিডিএফ",
  Checking: "দেখা হচ্ছে",
  "Copied from the text layer": "টেক্সট লেয়ার থেকে কপি করা",
  Copy: "কপি",
  "Download .txt": ".txt ডাউনলোড করুন",
  "Download searchable PDF": "সার্চযোগ্য পিডিএফ ডাউনলোড করুন",
  "Drop a PDF or images.": "একটি পিডিএফ বা ছবি ছেড়ে দিন।",
  "Drop a scanned PDF or images": "স্ক্যান করা পিডিএফ বা ছবি ছেড়ে দিন",
  Failed: "হয়নি",
  "Has text": "টেক্সট আছে",
  "Making the PDF…": "পিডিএফ তৈরি হচ্ছে…",
  "No text found on this page.": "এই পেজে কোনো টেক্সট পাওয়া যায়নি।",
  OCR: "OCR",
  "Opening…": "খোলা হচ্ছে…",
  "Other files": "অন্য ফাইল",
  "Page range, e.g. 1-3, 5": "পেজের পরিসর, যেমন 1-3, 5",
  "Page separators": "পেজ বিভাজক",
  "Page {n} couldn't be read.": "পেজ {n} পড়া যায়নি।",
  Pages: "পেজ",
  "Read 1 page": "১টি পেজ পড়ুন",
  "Read again": "আবার পড়ুন",
  "Read every page with OCR": "প্রতিটি পেজ OCR দিয়ে পড়ুন",
  "Read with OCR · {c}% confidence": "OCR দিয়ে পড়া · {c}% নিশ্চয়তা",
  "Read {n} pages": "{n}টি পেজ পড়ুন",
  "Page {p} ({n} of {t})": "পেজ {p} ({t}টির মধ্যে {n})",
  "Reading this page…": "এই পেজটি পড়া হচ্ছে…",
  "Redo pages that already have text":
    "যেসব পেজে টেক্সট আছে সেগুলোও আবার পড়ুন",
  Show: "দেখান",
  "Show found words": "পাওয়া শব্দগুলো দেখান",
  Stop: "থামান",
  Stopped: "থেমেছে",
  Text: "টেক্সট",
  "Text found: {n} words": "টেক্সট পাওয়া গেছে: {n}টি শব্দ",
  "Text layer": "টেক্সট লেয়ার",
  "The searchable PDF couldn't be made.": "সার্চযোগ্য পিডিএফ তৈরি করা যায়নি।",
  "This PDF is password-protected. Remove the password in the app that made it, then try again.":
    "এই পিডিএফ পাসওয়ার্ড দিয়ে সুরক্ষিত। যে অ্যাপে এটি তৈরি হয়েছে সেখানে পাসওয়ার্ড সরিয়ে আবার চেষ্টা করুন।",
  "This page couldn't be read.": "এই পেজটি পড়া যায়নি।",
  "This page will be read with OCR.": "এই পেজটি OCR দিয়ে পড়া হবে।",
  "Use page numbers and ranges, like 1-3, 5.":
    "পেজ নম্বর আর পরিসর লিখুন, যেমন 1-3, 5।",
  Waiting: "অপেক্ষায়",
  "{n} of {t} read": "{t}টির মধ্যে {n}টি পড়া হয়েছে",
  "{n} pages: {a} from the text layer, {b} with OCR":
    "{n}টি পেজ: {a}টি টেক্সট লেয়ার থেকে, {b}টি OCR দিয়ে",
  "{n} words found": "{n}টি শব্দ পাওয়া গেছে",
};
