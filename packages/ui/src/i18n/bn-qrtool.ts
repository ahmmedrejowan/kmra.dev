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
  // -- generator types (event, social, payments) --
  Event: "ইভেন্ট",
  Social: "সোশ্যাল",
  Payment: "পেমেন্ট",
  "Event name": "ইভেন্টের নাম",
  "Team meeting": "টিম মিটিং",
  "All day": "সারাদিন",
  Starts: "শুরু",
  Ends: "শেষ",
  "Place (optional)": "জায়গা (ঐচ্ছিক)",
  "Details (optional)": "বিস্তারিত (ঐচ্ছিক)",
  Platform: "প্ল্যাটফর্ম",
  "Username or profile link": "ইউজারনেম বা প্রোফাইল লিংক",
  "A username has no spaces. Check it, or paste the profile link.":
    "ইউজারনেমে কোনো ফাঁকা জায়গা থাকে না। একবার দেখে নিন, অথবা প্রোফাইল লিংক পেস্ট করুন।",
  "Payment type": "পেমেন্টের ধরন",
  "UPI ID": "UPI আইডি",
  "Payee name": "প্রাপকের নাম",
  "Amount in rupees (optional)": "পরিমাণ, রুপিতে (ঐচ্ছিক)",
  "Note (optional)": "নোট (ঐচ্ছিক)",
  "Account holder name": "অ্যাকাউন্টধারীর নাম",
  "BIC (optional)": "BIC (ঐচ্ছিক)",
  "Amount in euros (optional)": "পরিমাণ, ইউরোতে (ঐচ্ছিক)",
  "Reference (optional)": "রেফারেন্স (ঐচ্ছিক)",
  "Bitcoin address": "বিটকয়েন ঠিকানা",
  "Amount in BTC (optional)": "পরিমাণ, BTC-তে (ঐচ্ছিক)",
  "Label (optional)": "লেবেল (ঐচ্ছিক)",
  "PayPal.me username": "PayPal.me ইউজারনেম",
  "Amount (optional)": "পরিমাণ (ঐচ্ছিক)",
  "Enter a UPI ID like name@bank.": "name@bank-এর মতো একটি UPI আইডি লিখুন।",
  "This IBAN doesn't add up. Check it for typos.":
    "এই IBAN-টি মিলছে না। টাইপের ভুল আছে কি না দেখে নিন।",
  "Amounts go from 0.01 to 999,999,999.99 euros.":
    "পরিমাণ হতে পারে ০.০১ থেকে ৯৯৯,৯৯৯,৯৯৯.৯৯ ইউরো পর্যন্ত।",
  "This doesn't look like a Bitcoin address. Check it carefully: payments can't be undone.":
    "এটি বিটকয়েন ঠিকানার মতো দেখাচ্ছে না। ভালো করে দেখে নিন: পেমেন্ট ফেরত আনা যায় না।",
  "Bank transfer codes use at least Medium error correction.":
    "ব্যাংক ট্রান্সফারের কোডে অন্তত মাঝারি এরর কারেকশন লাগে।",
  "(no name)": "(নাম নেই)",
  Place: "জায়গা",
  "Add to calendar (.ics)": "ক্যালেন্ডারে যোগ করুন (.ics)",
  "Pay to": "যাকে পেমেন্ট",
  Amount: "পরিমাণ",
  Note: "নোট",
  Reference: "রেফারেন্স",
  "Anyone can write any name in a payment code. Check that your UPI app shows the payee you expect before you pay.":
    "পেমেন্ট কোডে যে কেউ যেকোনো নাম লিখে দিতে পারে। টাকা পাঠানোর আগে দেখে নিন, আপনার UPI অ্যাপে ঠিক প্রাপকের নাম দেখাচ্ছে কি না।",
  "A SEPA bank transfer code. Scan it with your banking app to fill in the transfer.":
    "এটি একটি SEPA ব্যাংক ট্রান্সফার কোড। ট্রান্সফারের তথ্য বসাতে আপনার ব্যাংকিং অ্যাপ দিয়ে স্ক্যান করুন।",
  "Check the address in your wallet before sending. Bitcoin payments can't be undone.":
    "পাঠানোর আগে ওয়ালেটে ঠিকানাটি মিলিয়ে নিন। বিটকয়েন পেমেন্ট ফেরত আনা যায় না।",

  // -- 2D codes and Wi-Fi card --
  "The code maker didn't load. Reload the page and try again.":
    "কোড তৈরির অংশটি লোড হয়নি। পেজটি রিলোড করে আবার চেষ্টা করুন।",
  "Too much text for {format}. Shorten it or pick another type.":
    "{format}-এর জন্য লেখা বেশি লম্বা। একটু ছোট করুন বা অন্য ধরন বেছে নিন।",
  "{format} can't hold some of these characters. Use plain letters and numbers, or pick another type.":
    "এর কিছু অক্ষর {format}-এ রাখা যায় না। সাধারণ ইংরেজি অক্ষর আর সংখ্যা দিন, বা অন্য ধরন বেছে নিন।",
  "This text can't be made into a {format} code.":
    "এই লেখা দিয়ে {format} কোড বানানো যায় না।",
  "Type some text first.": "আগে কিছু লেখা দিন।",
  "{format} code for {value}": "{value}-এর {format} কোড",
  "Ready. The code updates as you type.": "তৈরি। লিখতে লিখতেই কোড বদলে যায়।",
  "Example code. Type your text to make yours.":
    "নমুনা কোড। আপনার লেখা দিলে আপনার কোড তৈরি হবে।",
  "Text or number": "লেখা বা নম্বর",
  "Blank border around the code (quiet zone)":
    "কোডের চারপাশে ফাঁকা জায়গা (কোয়াইট জোন)",
  "PNG: {w} × {h} px, sharp edges": "PNG: {w} × {h} px, ধারালো কিনারা",
  "Copy SVG": "SVG কপি করুন",
  "SVG copied": "SVG কপি হয়েছে",
  "A small square that holds a lot. Parts, electronics and medicine packs.":
    "ছোট্ট বর্গ, কিন্তু অনেক তথ্য ধরে। যন্ত্রাংশ, ইলেকট্রনিকস আর ওষুধের প্যাকেটে।",
  "A wide stacked strip for long text. IDs, tickets and boarding passes.":
    "লম্বা লেখার জন্য চওড়া, স্তরে স্তরে সাজানো ফিতা। আইডি কার্ড, টিকিট আর বোর্ডিং পাসে।",
  "Reads from the centre, so it needs little border. Train and plane tickets.":
    "মাঝখান থেকে পড়া হয়, তাই চারপাশে খুব কম ফাঁকা লাগে। ট্রেন আর বিমানের টিকিটে।",
  "A tiny QR for short text: up to 35 digits or about 15 letters.":
    "ছোট লেখার জন্য খুদে কিউআর: ৩৫টি পর্যন্ত সংখ্যা বা প্রায় ১৫টি অক্ষর।",
  "A rectangular QR for narrow spaces. Most phone cameras can't read it yet; use a scanner app.":
    "সরু জায়গার জন্য আয়তাকার কিউআর। বেশিরভাগ ফোনের ক্যামেরা এখনো এটি পড়তে পারে না; স্ক্যানার অ্যাপ ব্যবহার করুন।",
  "Your network": "আপনার নেটওয়ার্ক",
  "Free Wi-Fi": "ফ্রি ওয়াই-ফাই",
  "Scan with your phone camera to join":
    "যুক্ত হতে ফোনের ক্যামেরা দিয়ে স্ক্যান করুন",
  "Type the network name first.": "আগে নেটওয়ার্কের নাম লিখুন।",
  "Couldn't open printing. Download the PDF and print that.":
    "প্রিন্ট খোলা যায়নি। PDF ডাউনলোড করে সেটি প্রিন্ট করুন।",
  "Wi-Fi card preview": "ওয়াই-ফাই কার্ডের প্রিভিউ",
  "{w} × {h} mm. Prints at real size.":
    "{w} × {h} মিমি। আসল মাপেই প্রিন্ট হয়।",
  "Example card. Type your network name to make yours.":
    "নমুনা কার্ড। নেটওয়ার্কের নাম লিখলে আপনার কার্ড তৈরি হবে।",
  Show: "দেখান",
  Hide: "লুকান",
  "Show the password on the card": "কার্ডে পাসওয়ার্ড দেখান",
  "Card title": "কার্ডের শিরোনাম",
  "Small note (optional)": "ছোট নোট (ঐচ্ছিক)",
  "Accent colour": "মূল রং",
  Print: "প্রিন্ট করুন",
  "PNG and PDF at 300 dpi, ready to print.":
    "PNG আর PDF ৩০০ ডিপিআই-তে, প্রিন্টের জন্য তৈরি।",
  "Table card (A6)": "টেবিল কার্ড (A6)",
  "Business card": "বিজনেস কার্ড",
  "A4 poster": "A4 পোস্টার",

  // -- checker, cleaner, batch scanner --
  "UPI payment": "UPI পেমেন্ট",
  "Bank transfer": "ব্যাংক ট্রান্সফার",
  Bitcoin: "বিটকয়েন",
  "No code could be read": "কোনো কোড পড়া যায়নি",
  "If there is a code in the image, it may be too blurry, too small, too low in contrast, or missing its blank margin.":
    "ছবিতে কোড থাকলে সেটা হয়তো বেশি ঝাপসা, বেশি ছোট, কনট্রাস্ট কম, অথবা চারপাশে ফাঁকা জায়গা নেই।",
  "Try the original design file or a sharper photo, taken straight on and close enough to fill a third of the picture.":
    "মূল ডিজাইন ফাইল দিন, অথবা সোজাসুজি আর কাছ থেকে তোলা আরও স্পষ্ট ছবি দিন, যাতে কোডটা ছবির অন্তত তিন ভাগের এক ভাগ জুড়ে থাকে।",
  "Checked image": "যাচাই করা ছবি",
  "Drop your QR code design or photo": "আপনার কিউআর কোডের ডিজাইন বা ছবি দিন",
  "Check another image": "আরেকটি ছবি যাচাই করুন",
  "{n} codes found. Checking:": "{n}টি কোড পাওয়া গেছে। যাচাই হচ্ছে:",
  "Code {n}": "কোড {n}",
  "Fix the items marked in red before you print.":
    "প্রিন্টের আগে লাল চিহ্নের বিষয়গুলো ঠিক করুন।",
  "It works. A few things could make it more reliable.":
    "কোডটি কাজ করে। কয়েকটি জিনিস ঠিক করলে আরও নির্ভরযোগ্য হবে।",
  "Looks good. It should scan well in print and on screens.":
    "সব ঠিক আছে। প্রিন্টে আর স্ক্রিনে ভালোভাবে স্ক্যান হওয়ার কথা।",
  "Passed:": "ঠিক আছে:",
  "Warning:": "সতর্কতা:",
  "Problem:": "সমস্যা:",
  "Fix:": "সমাধান:",
  "Redraw it sharp with QR code cleaner":
    "কিউআর কোড ক্লিনার দিয়ে স্পষ্ট করে নতুন আঁকুন",
  "Drop a QR code to see if it scans, how small it can be printed, and whether the contrast and margin are right.":
    "একটি কিউআর কোড দিন। দেখুন সেটা স্ক্যান হয় কি না, কত ছোট করে প্রিন্ট করা যায়, আর কনট্রাস্ট ও চারপাশের ফাঁকা জায়গা ঠিক আছে কি না।",
  "Scans, but it's mirrored": "স্ক্যান হয়, তবে উল্টো (আয়নার মতো)",
  Scans: "স্ক্যান হয়",
  "The code is flipped like in a mirror. Many phones won't read it.":
    "কোডটি আয়নার মতো উল্টে আছে। অনেক ফোন এটা পড়তে পারবে না।",
  "Read at full size as a {f}.": "পুরো মাপে {f} হিসেবে পড়া গেছে।",
  "Flip it back before you print or share it.":
    "প্রিন্ট বা শেয়ার করার আগে সোজা করে নিন।",
  "Not a QR code": "এটি কিউআর কোড নয়",
  "This checker is made for QR codes, so only some checks apply to this format.":
    "এই যাচাই টুলটি কিউআর কোডের জন্য, তাই এই ফরম্যাটে কয়েকটি যাচাই-ই খাটে।",
  "Testing smaller sizes…": "ছোট মাপে পরীক্ষা হচ্ছে…",
  "Size in this image": "এই ছবিতে মাপ",
  "{n} px per module": "প্রতি মডিউলে {n} পিক্সেল",
  "Smallest that reads": "সবচেয়ে ছোট যে মাপে পড়া যায়",
  "Only at full size": "শুধু পুরো মাপে",
  "Print at least": "প্রিন্টে অন্তত",
  "{n} cm wide": "{n} সেমি চওড়া",
  "File for print at 300 dpi": "৩০০ ডিপিআই প্রিন্টের ফাইল",
  "{n} px wide or more": "{n} পিক্সেল বা বেশি চওড়া",
  "On screens, show it at least": "স্ক্রিনে অন্তত",
  "{n} px wide": "{n} পিক্সেল চওড়া",
  "Breaks when smaller": "ছোট করলে আর পড়া যায় না",
  "It reads at full size but not when shrunk, so a small print may not scan.":
    "পুরো মাপে পড়া যায়, কিন্তু ছোট করলে যায় না। তাই ছোট প্রিন্ট হয়তো স্ক্যান হবে না।",
  "Use shorter content, more contrast or a wider margin, or redraw it sharp. Print it large.":
    "লেখা ছোট করুন, কনট্রাস্ট বা চারপাশের ফাঁকা জায়গা বাড়ান, অথবা স্পষ্ট করে নতুন আঁকুন। বড় করে প্রিন্ট করুন।",
  "Needs a fairly large print": "বেশ বড় করে প্রিন্ট করতে হবে",
  "It stops reading below {n} px per module, which is more than a clean code needs.":
    "প্রতি মডিউলে {n} পিক্সেলের কম হলে আর পড়া যায় না। পরিষ্কার একটি কোডের এর চেয়ে কম লাগে।",
  "Print it at the size below or larger, or redraw it sharp so it holds up when small.":
    "নিচের মাপে বা আরও বড় করে প্রিন্ট করুন, অথবা স্পষ্ট করে নতুন আঁকুন, যাতে ছোট মাপেও কাজ করে।",
  "Holds up when small": "ছোট মাপেও কাজ করে",
  "Still reads at {n} px per module. For scanning from further away, make it about a tenth of the distance: 30 cm wide for 3 m.":
    "প্রতি মডিউলে {n} পিক্সেলেও পড়া যায়। দূর থেকে স্ক্যানের জন্য দূরত্বের প্রায় দশ ভাগের এক ভাগ চওড়া করুন: ৩ মিটারের জন্য ৩০ সেমি।",
  "Contrast too low": "কনট্রাস্ট খুব কম",
  "Contrast on the low side": "কনট্রাস্ট একটু কম",
  "Good contrast": "কনট্রাস্ট ভালো",
  "Contrast {r}:1 between {a} and {b}. Aim for 4:1 or more; black on white is 21:1.":
    "{a} আর {b}-এর মধ্যে কনট্রাস্ট {r}:১। অন্তত ৪:১ রাখুন; সাদার ওপর কালো ২১:১।",
  "Use a darker code colour or a lighter background. Avoid light greys, yellows and pastels for the code.":
    "কোডের রং আরও গাঢ় করুন বা ব্যাকগ্রাউন্ড আরও হালকা করুন। কোডে হালকা ধূসর, হলুদ বা প্যাস্টেল রং এড়িয়ে চলুন।",
  "Light code on a dark background": "গাঢ় ব্যাকগ্রাউন্ডে হালকা কোড",
  "Inverted codes look stylish, but some scanners and older phones can't read them.":
    "উল্টো রঙের কোড দেখতে সুন্দর, কিন্তু কিছু স্ক্যানার আর পুরোনো ফোন এগুলো পড়তে পারে না।",
  "Use a dark code on a light background.":
    "হালকা ব্যাকগ্রাউন্ডে গাঢ় কোড ব্যবহার করুন।",
  "Dark code on a light background": "হালকা ব্যাকগ্রাউন্ডে গাঢ় কোড",
  "The way every scanner expects it.": "সব স্ক্যানার ঠিক এভাবেই আশা করে।",
  "The margin reaches the edge of the image, so keep that space clear when you place it in a design.":
    "ফাঁকা জায়গাটা ছবির কিনারা পর্যন্ত গেছে, তাই ডিজাইনে বসানোর সময় চারপাশের জায়গা ফাঁকা রাখুন।",
  "Enough blank margin": "চারপাশে যথেষ্ট ফাঁকা জায়গা",
  "Narrow blank margin": "চারপাশে ফাঁকা জায়গা কম",
  "Almost no blank margin": "চারপাশে প্রায় কোনো ফাঁকা জায়গা নেই",
  "About {n} modules of blank space around the code; {need} is the standard.":
    "কোডের চারপাশে প্রায় {n} মডিউল ফাঁকা জায়গা; নিয়ম হলো {need}।",
  "Leave at least {need} modules of plain background on every side, with no text, lines or pictures.":
    "প্রতিটি পাশে অন্তত {need} মডিউল সাদামাটা ব্যাকগ্রাউন্ড রাখুন, সেখানে কোনো লেখা, রেখা বা ছবি নয়।",
  "Low (7%)": "কম (৭%)",
  "Medium (15%)": "মাঝারি (১৫%)",
  "High (25%)": "বেশি (২৫%)",
  "Max (30%)": "সর্বোচ্চ (৩০%)",
  "{a} × {b} modules": "{a} × {b} মডিউল",
  Version: "ভার্সন",
  "A dense code": "ঘন কোড",
  "Simple enough": "যথেষ্ট সহজ",
  "Version {v} packs many small modules. Each one gets smaller at a given print size, so it's harder to scan.":
    "ভার্সন {v}-এ অনেক ছোট মডিউল থাকে। একই প্রিন্ট মাপে প্রতিটি মডিউল ছোট হয়, তাই স্ক্যান করা কঠিন।",
  "Few, large modules: easy for cameras to read.":
    "অল্প কয়েকটি বড় মডিউল: ক্যামেরা সহজে পড়তে পারে।",
  "Shorten the content: a shorter link, fewer contact fields, or no extra text.":
    "ভেতরের লেখা ছোট করুন: ছোট লিংক, কম কন্টাক্ট তথ্য, বা বাড়তি লেখা বাদ দিন।",
  "Low error correction": "এরর কারেকশন কম",
  "Only 7% of the code can be damaged or covered before it stops reading.":
    "কোডের মাত্র ৭% নষ্ট বা ঢাকা পড়লেই আর পড়া যায় না।",
  "Use Medium or higher so a smudge, fold or logo doesn't stop it.":
    "মাঝারি বা তার বেশি ব্যবহার করুন, যাতে দাগ, ভাঁজ বা লোগোতে কোড অচল না হয়।",
  "Testing with blur…": "ঝাপসা করে পরীক্ষা হচ্ছে…",
  "Copes with blur": "ঝাপসা হলেও কাজ করে",
  "Still reads when blurred, like a shaky or out-of-focus phone camera.":
    "ঝাপসা হলেও পড়া যায়, যেমন হাত কাঁপলে বা ফোকাস না হলে হয়।",
  "Copes with a little blur": "সামান্য ঝাপসায় কাজ করে",
  "Reads with a little blur, but not with more.":
    "একটু ঝাপসা হলে পড়া যায়, বেশি হলে যায় না।",
  "More contrast, a wider margin or shorter content make it sturdier.":
    "কনট্রাস্ট বাড়ালে, চারপাশে বেশি ফাঁকা রাখলে বা লেখা ছোট করলে কোড আরও মজবুত হয়।",
  "Fails with slight blur": "সামান্য ঝাপসাতেই পড়া যায় না",
  "A little camera shake or poor focus is enough to stop it reading.":
    "ক্যামেরা একটু কাঁপলে বা ফোকাস ঠিক না হলেই আর পড়া যায় না।",
  "Raise the contrast, widen the margin, shorten the content, or print it larger.":
    "কনট্রাস্ট বাড়ান, চারপাশের ফাঁকা জায়গা বাড়ান, লেখা ছোট করুন, অথবা বড় করে প্রিন্ট করুন।",
  "Original image": "মূল ছবি",
  Redrawn: "নতুন করে আঁকা",
  "Same content, clean edges. Ready to print.":
    "একই কনটেন্ট, পরিষ্কার কিনারা। প্রিন্টের জন্য তৈরি।",
  "Drop a photo or screenshot of a QR code": "কিউআর কোডের ছবি বা স্ক্রিনশট দিন",
  "{n} codes found. Redraw:": "{n}টি কোড পাওয়া গেছে। নতুন করে আঁকুন:",
  "No code could be read. Try a sharper photo, taken straight on, with the code filling more of the picture.":
    "কোনো কোড পড়া যায়নি। সোজাসুজি তোলা আরও স্পষ্ট ছবি দিন, যেখানে কোডটা ছবির বড় অংশ জুড়ে থাকে।",
  "This is a {f}, not a QR code. Its content was read; copy it, or make a fresh one from it.":
    "এটি {f}, কিউআর কোড নয়। ভেতরের লেখা পড়া গেছে; কপি করুন, অথবা এটা দিয়ে নতুন একটি বানান।",
  "Open the 2D code generator": "২ডি কোড জেনারেটর খুলুন",
  "Open the barcode generator": "বারকোড জেনারেটর খুলুন",
  "Same as the original.": "মূল কোডের মতোই।",
  "The original used {e}.": "মূল কোডে ছিল {e}।",
  "The code is redrawn from its content as plain squares. Colours, rounded dots and logos of the original design aren't kept.":
    "কোডটি এর ভেতরের লেখা থেকে সাধারণ চৌকো মডিউলে নতুন করে আঁকা হয়। মূল ডিজাইনের রং, গোল ডট আর লোগো থাকে না।",
  "Drop a blurry or low-resolution QR code to get a sharp copy you can print at any size.":
    "ঝাপসা বা কম রেজোলিউশনের কিউআর কোড দিন, পেয়ে যান স্পষ্ট একটি কপি, যা যেকোনো মাপে প্রিন্ট করা যায়।",
  "Waiting…": "অপেক্ষায়…",
  "Couldn't open this image": "এই ছবিটি খোলা যায়নি",
  "No code found": "কোনো কোড পাওয়া যায়নি",
  File: "ফাইল",
  Content: "কনটেন্ট",
  "Drop images with codes": "কোডসহ ছবিগুলো দিন",
  "Every image had a code.": "প্রতিটি ছবিতেই কোড পাওয়া গেছে।",
  "Reading {i} of {n}…": "{n}টির মধ্যে {i} নম্বর পড়া হচ্ছে…",
  "{n} images, {c} codes": "{n}টি ছবি, {c}টি কোড",
  "1 image without a code": "১টি ছবিতে কোড নেই",
  "{n} images without a code": "{n}টি ছবিতে কোড নেই",
  "Only images without a code": "শুধু কোড ছাড়া ছবিগুলো",
  "Add images": "ছবি যোগ করুন",
  "{n} codes copied": "{n}টি কোড কপি হয়েছে",
  "Copy all codes": "সব কোড কপি করুন",
  "Download CSV": "CSV ডাউনলোড করুন",
  "Clear list": "তালিকা মুছুন",
  "One code per line when copied. The CSV opens in Excel and Google Sheets.":
    "কপি করলে প্রতি লাইনে একটি কোড থাকে। CSV ফাইল এক্সেল আর গুগল শিটসে খোলা যায়।",
};
