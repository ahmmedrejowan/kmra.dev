/**
 * Bangla interface text used only by vidtool (and the shared media engine), keyed by the English
 * string. Shared site text lives in ./bn.ts; don't repeat keys from there or the other app files.
 * Each part adds keys under its own marker.
 */
export const BN_VIDTOOL: Record<string, string> = {
  // -- pages --
  "Free video tools in your browser": "ব্রাউজারেই বিনামূল্যের ভিডিও টুল",
  "Edit videos in your browser": "ব্রাউজারেই ভিডিও এডিট করুন",
  "Compress, convert, trim and make GIFs. Your videos stay on your device: nothing to upload, no waiting in a queue.":
    "কম্প্রেস, কনভার্ট, ট্রিম আর GIF বানানো। আপনার ভিডিও আপনার ডিভাইসেই থাকে: আপলোডের ঝামেলা নেই, লাইনে অপেক্ষাও নেই।",
  "Drop a video to compress it": "কম্প্রেস করতে একটি ভিডিও ছেড়ে দিন",
  "Or pick a tool below. Your video stays on your device.":
    "অথবা নিচ থেকে একটি টুল বেছে নিন। আপনার ভিডিও আপনার ডিভাইসেই থাকে।",
  "Choose a video": "একটি ভিডিও বেছে নিন",
  "Drop to compress": "কম্প্রেস করতে ছেড়ে দিন",
  "Video tools": "ভিডিও টুল",
  "All video tools": "সব ভিডিও টুল",
  "Every video tool, by category. All free, and everything runs on your device.":
    "ধরন অনুযায়ী সব ভিডিও টুল। সবই বিনামূল্যে, আর সব কাজ হয় আপনার ডিভাইসে।",
  "All {n} video tools": "সব {n}টি ভিডিও টুল",
  "More ways to work with videos.": "ভিডিও নিয়ে কাজের আরও উপায়।",
  "Do my videos leave my device?": "আমার ভিডিও কি ডিভাইসের বাইরে যায়?",
  "No. Videos are processed in your browser, on your device. There's no upload, so even large files start right away.":
    "না। ভিডিও প্রক্রিয়া হয় আপনার ব্রাউজারে, আপনার ডিভাইসেই। আপলোড নেই, তাই বড় ফাইলও সঙ্গে সঙ্গে শুরু হয়।",
  "No limits from us. Long or 4K videos need more memory and time; phones manage smaller files best.":
    "আমাদের দিক থেকে কোনো সীমা নেই। লম্বা বা 4K ভিডিওতে বেশি মেমরি আর সময় লাগে; ফোনে ছোট ফাইল সবচেয়ে ভালো চলে।",
  "Once the page and the video engine have loaded, it keeps working without an internet connection.":
    "পেজ আর ভিডিও ইঞ্জিন একবার লোড হলে ইন্টারনেট ছাড়াও কাজ চলতে থাকে।",
  "Yes. Once the page and the video engine have loaded, it keeps working without an internet connection.":
    "হ্যাঁ। পেজ আর ভিডিও ইঞ্জিন একবার লোড হলে ইন্টারনেট ছাড়াও কাজ চলতে থাকে।",
  // -- engine and core tools --
  "Add videos": "ভিডিও যোগ করুন",
  Better: "আরও ভালো",
  Smaller: "ছোট",
  Cancel: "বাতিল",
  Cancelled: "বাতিল হয়েছে",
  "Change a setting to make a new video.":
    "নতুন ভিডিও বানাতে একটি সেটিং বদলান।",
  "Change video": "ভিডিও বদলান",
  "Choose videos": "ভিডিও বেছে নিন",
  "Common sizes": "প্রচলিত সাইজ",
  "Compatible (slower)": "সামঞ্জস্যপূর্ণ (ধীর)",
  "Hardware (fast)": "হার্ডওয়্যার (দ্রুত)",
  "Lossless copy (instant)": "মান না হারিয়ে কপি (তাৎক্ষণিক)",
  Convert: "কনভার্ট",
  Copying: "কপি হচ্ছে",
  Cut: "কাটার ধরন",
  "Cuts on the exact frame. The kept part is encoded again, which takes a moment.":
    "ঠিক ফ্রেমেই কাটে। রাখা অংশটি আবার এনকোড হয়, তাই একটু সময় লাগে।",
  "Instant and keeps the original quality. The start moves back to the nearest keyframe, up to a few seconds.":
    "তাৎক্ষণিক, আর মূল মান ঠিক থাকে। শুরুটা সবচেয়ে কাছের কি-ফ্রেমে পিছিয়ে যায়, কয়েক সেকেন্ড পর্যন্ত।",
  "Depends on the cut": "কাটার ওপর নির্ভর করে",
  Done: "শেষ",
  "Download all ({n}) as zip": "সব ({n}) zip হিসেবে ডাউনলোড",
  "Download each file": "প্রতিটি ফাইল আলাদা ডাউনলোড",
  "Drag the handles under the video to choose the part to keep.":
    "কোন অংশ রাখবেন তা বেছে নিতে ভিডিওর নিচের হ্যান্ডেল টানুন।",
  "Drop a video here": "এখানে একটি ভিডিও ছেড়ে দিন",
  "Drop a video to resize it": "রিসাইজ করতে একটি ভিডিও ছেড়ে দিন",
  "Drop a video to trim it": "ট্রিম করতে একটি ভিডিও ছেড়ে দিন",
  "Drop videos to convert": "কনভার্ট করতে ভিডিও ছেড়ে দিন",
  "Drop videos to get their sound": "শব্দ বের করতে ভিডিও ছেড়ে দিন",
  "Drop videos to remove the sound": "শব্দ সরাতে ভিডিও ছেড়ে দিন",
  Encoding: "এনকোড হচ্ছে",
  Start: "শুরু",
  End: "শেষ সময়",
  Time: "সময়",
  "Estimated size": "আনুমানিক সাইজ",
  Files: "ফাইল",
  "Fine-tune": "সূক্ষ্ম সমন্বয়",
  "GIFs are made with the compatible engine":
    "GIF বানানো হয় সামঞ্জস্যপূর্ণ ইঞ্জিনে",
  "It can still be converted. Convert it to MP4 to watch it here.":
    "তবু এটি কনভার্ট করা যায়। এখানে দেখতে MP4-এ কনভার্ট করুন।",
  Joining: "জোড়া লাগানো হচ্ছে",
  "Joining clips uses the compatible engine":
    "ক্লিপ জোড়া লাগাতে সামঞ্জস্যপূর্ণ ইঞ্জিন লাগে",
  "Large files may be too much for this browser's memory. If it stops, try a shorter part.":
    "বড় ফাইল এই ব্রাউজারের মেমরির জন্য বেশি হতে পারে। থেমে গেলে ছোট একটি অংশ দিয়ে চেষ্টা করুন।",
  "Largest resolution": "সর্বোচ্চ রেজোলিউশন",
  "Loading the video engine": "ভিডিও ইঞ্জিন লোড হচ্ছে",
  Lossless: "মান না হারিয়ে",
  Precise: "নিখুঁত",
  "M4A (AAC) is smaller than MP3 for the same sound, and what most videos already use.":
    "একই শব্দে M4A (AAC) MP3-এর চেয়ে ছোট, আর বেশিরভাগ ভিডিও এটাই ব্যবহার করে।",
  "MOV is QuickTime's format, for Apple devices and editors.":
    "MOV হলো QuickTime-এর ফরম্যাট, Apple ডিভাইস আর এডিটরের জন্য।",
  "MP3 plays everywhere. 192k sounds right for most videos.":
    "MP3 সব জায়গায় চলে। বেশিরভাগ ভিডিওর জন্য 192k ঠিকঠাক শোনায়।",
  "MP4 plays on every phone, computer and website.":
    "MP4 সব ফোন, কম্পিউটার আর ওয়েবসাইটে চলে।",
  "WebM is made for websites. Some phones and editors can't open it.":
    "WebM ওয়েবসাইটের জন্য তৈরি। কিছু ফোন আর এডিটর এটি খুলতে পারে না।",
  "WAV is uncompressed: the best for editing, but about ten times bigger.":
    "WAV কম্প্রেস করা নয়: এডিটিংয়ের জন্য সেরা, তবে প্রায় দশ গুণ বড়।",
  "When the video already fits the new format, it's copied as it is: fast and lossless.":
    "ভিডিও আগে থেকেই নতুন ফরম্যাটে মানালে যেমন আছে তেমন কপি হয়: দ্রুত আর মান না হারিয়ে।",
  "Make it smaller by": "ছোট করার উপায়",
  "Target size": "লক্ষ্য সাইজ",
  Pad: "প্যাড",
  "Padding colour": "প্যাডের রং",
  "Pick a resolution or a shape.": "একটি রেজোলিউশন বা আকার বেছে নিন।",
  "Reading the video": "ভিডিও পড়া হচ্ছে",
  "Remove sound": "শব্দ সরান",
  Same: "একই",
  "Save the sound": "শব্দ সেভ করুন",
  "Some files couldn't be processed": "কিছু ফাইল প্রক্রিয়া করা যায়নি",
  Sound: "শব্দ",
  "That isn't a video. Try MP4, MOV, WebM, MKV or AVI.":
    "এটি ভিডিও নয়। MP4, MOV, WebM, MKV বা AVI দিয়ে চেষ্টা করুন।",
  "That's very small for this length: the picture will be blurry. Trim the video first for a sharper result.":
    "এই দৈর্ঘ্যের জন্য এটি খুব ছোট: ছবি ঝাপসা হবে। আরও পরিষ্কার ফলের জন্য আগে ভিডিও ট্রিম করুন।",
  "The picture is copied as it is, so it's quick and keeps its quality.":
    "ছবি যেমন আছে তেমন কপি হয়, তাই দ্রুত হয় আর মান ঠিক থাকে।",
  "The video's sound": "ভিডিওর শব্দ",
  "This browser has no fast video encoder":
    "এই ব্রাউজারে দ্রুত ভিডিও এনকোডার নেই",
  "This effect uses the compatible engine":
    "এই ইফেক্টে সামঞ্জস্যপূর্ণ ইঞ্জিন লাগে",
  "This format needs the compatible engine":
    "এই ফরম্যাটে সামঞ্জস্যপূর্ণ ইঞ্জিন লাগে",
  "This file couldn't be read. It may be damaged or not a video.":
    "ফাইলটি পড়া যায়নি। এটি নষ্ট হতে পারে বা ভিডিও নাও হতে পারে।",
  "This is a very large file. If the page runs out of memory, trim it first or pick a smaller size.":
    "এটি খুব বড় ফাইল। পেজের মেমরি ফুরিয়ে গেলে আগে ট্রিম করুন বা ছোট সাইজ বেছে নিন।",
  "This is bigger than the original: it won't add detail, only size.":
    "এটি মূলের চেয়ে বড়: বিস্তারিত বাড়বে না, শুধু সাইজ বাড়বে।",
  "This video can't play in the browser": "এই ভিডিও ব্রাউজারে চলে না",
  "This video couldn't be processed.": "ভিডিওটি প্রক্রিয়া করা যায়নি।",
  "This video has no sound already.": "এই ভিডিওতে আগে থেকেই কোনো শব্দ নেই।",
  "This video has no sound to save.": "এই ভিডিওতে সেভ করার মতো কোনো শব্দ নেই।",
  "This video has no sound": "এই ভিডিওতে কোনো শব্দ নেই",
  "This video is already under {size}.": "এই ভিডিও আগে থেকেই {size}-এর নিচে।",
  Trim: "ট্রিম",
  "Trying a smaller size": "আরও ছোট সাইজে চেষ্টা হচ্ছে",
  Video: "ভিডিও",
  "Video details": "ভিডিওর বিবরণ",
  "Wait for the current job to finish, or cancel it.":
    "চলতি কাজ শেষ হওয়া পর্যন্ত অপেক্ষা করুন, বা বাতিল করুন।",
  "made in {s} s": "{s} সেকেন্ডে তৈরি",
  mono: "মনো",
  stereo: "স্টেরিও",
  "{action} {n} videos": "{n}টি ভিডিও: {action}",
  // -- more tools --
  // -- record and info --
};
