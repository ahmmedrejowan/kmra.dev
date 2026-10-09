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
  // speed, rotate, merge, video info
  "Speed up": "দ্রুত করুন",
  "Slow down": "ধীর করুন",
  "Drop a video to change its speed": "গতি বদলাতে একটি ভিডিও ছেড়ে দিন",
  "Pick a speed other than 1×.": "১× ছাড়া অন্য কোনো গতি বেছে নিন।",
  Speed: "গতি",
  Slower: "ধীরে",
  Faster: "দ্রুত",
  "Common speeds": "প্রচলিত গতি",
  "Keep the natural pitch": "স্বাভাবিক সুর রাখুন",
  "Voices sound normal, just faster or slower.":
    "কণ্ঠ স্বাভাবিক শোনায়, শুধু দ্রুত বা ধীর।",
  "The pitch follows the speed, like a tape: higher when faster, lower when slower.":
    "টেপের মতো সুর গতির সঙ্গে বদলায়: দ্রুত হলে চড়া, ধীর হলে নিচু।",
  "New length: {new} (was {old})": "নতুন দৈর্ঘ্য: {new} (আগে ছিল {old})",
  "Frames are repeated to slow it down. Videos shot at 60 fps or more give smoother slow motion.":
    "ধীর করতে ফ্রেম পুনরাবৃত্তি করা হয়। ৬০ এফপিএস বা তার বেশিতে তোলা ভিডিওতে স্লো মোশন আরও মসৃণ হয়।",
  "Drop a video to rotate it": "ঘোরাতে একটি ভিডিও ছেড়ে দিন",
  "Pick a turn or a flip.": "ঘোরানো বা উল্টানো বেছে নিন।",
  Turn: "ঘোরান",
  "90° left": "বামে ৯০°",
  "90° right": "ডানে ৯০°",
  Horizontal: "আড়াআড়ি",
  Vertical: "খাড়াখাড়ি",
  How: "কীভাবে",
  Quick: "দ্রুত",
  "Re-encode": "আবার এনকোড",
  "Instant and lossless: only the video's rotation setting changes. Phones, browsers and most players follow it; a few older editors don't.":
    "সঙ্গে সঙ্গে আর মান না হারিয়ে: শুধু ভিডিওর ঘোরানোর সেটিং বদলায়। ফোন, ব্রাউজার আর বেশিরভাগ প্লেয়ার এটি মানে; কিছু পুরোনো এডিটর মানে না।",
  "The picture itself is turned and encoded again, so every player shows it the right way up. Takes a moment.":
    "ছবিটিই ঘুরিয়ে আবার এনকোড করা হয়, তাই সব প্লেয়ারে সোজা দেখায়। একটু সময় লাগে।",
  "The picture is turned and encoded again, so every player shows it the right way up.":
    "ছবি ঘুরিয়ে আবার এনকোড করা হয়, তাই সব প্লেয়ারে সোজা দেখায়।",
  "It can still be turned. The result plays in more places.":
    "তবুও এটি ঘোরানো যাবে। ফলাফল আরও বেশি জায়গায় চলবে।",
  Play: "চালান",
  "Drop two or more videos to join them":
    "জোড়া লাগাতে দুই বা তার বেশি ভিডিও ছেড়ে দিন",
  Clips: "ক্লিপ",
  "Total length": "মোট দৈর্ঘ্য",
  "Total size": "মোট সাইজ",
  "Fit other sizes": "অন্য সাইজ মানানো",
  "Black bars": "কালো পাড়",
  "The clips have different sizes. Each is fitted into {size}, the first clip's size, without cropping. Put the clip whose size you want first.":
    "ক্লিপগুলোর সাইজ আলাদা। প্রতিটি না কেটে প্রথম ক্লিপের সাইজ {size}-এ বসানো হয়। যে ক্লিপের সাইজ চান, সেটি প্রথমে রাখুন।",
  "Clips without sound get silence, so the sound stays in step.":
    "শব্দহীন ক্লিপে নীরবতা বসানো হয়, যাতে শব্দ ঠিক সময়ে থাকে।",
  "Clip {n}: {name}": "ক্লিপ {n}: {name}",
  "Can't be read": "পড়া যায়নি",
  "Move {name} earlier": "{name} আগে সরান",
  "Move {name} later": "{name} পরে সরান",
  "Drag the clips to change the order, or press Alt and an arrow key.":
    "ক্রম বদলাতে ক্লিপগুলো টেনে আনুন, অথবা Alt আর একটি তীর-কী চাপুন।",
  "Add at least two videos to join them.":
    "জোড়া লাগাতে অন্তত দুটি ভিডিও যোগ করুন।",
  "These clips were encoded alike, so they're joined as they are: instant and lossless.":
    "এই ক্লিপগুলো একইভাবে এনকোড করা, তাই যেমন আছে তেমনই জোড়া হয়: সঙ্গে সঙ্গে আর মান না হারিয়ে।",
  "Merge {n} videos": "{n}টি ভিডিও জোড়া লাগান",
  "These videos couldn't be joined.": "ভিডিওগুলো জোড়া লাগানো যায়নি।",
  "Overall bitrate": "মোট বিটরেট",
  Codec: "কোডেক",
  Profile: "প্রোফাইল",
  "Display aspect": "প্রদর্শনের অনুপাত",
  Rotation: "ঘোরানো",
  "Stored size": "সংরক্ষিত সাইজ",
  Bitrate: "বিটরেট",
  "Pixel format": "পিক্সেল ফরম্যাট",
  "Bit depth": "বিট ডেপথ",
  "Colour range": "রঙের পরিসর",
  Full: "পূর্ণ",
  Limited: "সীমিত",
  HDR: "HDR",
  "Sample rate": "স্যাম্পল রেট",
  Channels: "চ্যানেল",
  "Other streams": "অন্যান্য স্ট্রিম",
  Stream: "স্ট্রিম",
  Tags: "ট্যাগ",
  Encoder: "এনকোডার",
  "Camera make": "ক্যামেরার নির্মাতা",
  "Camera model": "ক্যামেরার মডেল",
  Comment: "মন্তব্য",
  Artist: "শিল্পী",
  Brand: "ব্র্যান্ড",
  "Drop videos to see their details": "বিবরণ দেখতে ভিডিও ছেড়ে দিন",
  "{n} videos": "{n}টি ভিডিও",
  "Copy as text": "লেখা হিসেবে কপি",
  "Copy as JSON": "JSON হিসেবে কপি",
  "Add a video to compare": "তুলনার জন্য ভিডিও যোগ করুন",
  "{name} has the place where it was filmed saved in it.":
    "{name}-এ কোথায় ভিডিও করা হয়েছে, সেই জায়গা সংরক্ষিত আছে।",
  "{n} of these videos have the place where they were filmed saved in them.":
    "এর মধ্যে {n}টি ভিডিওতে কোথায় ভিডিও করা হয়েছে, সেই জায়গা সংরক্ষিত আছে।",
  "Before you share it, save a copy without it:":
    "শেয়ার করার আগে এটি ছাড়া একটি কপি সেভ করুন:",
  "Videos saved here leave the location out.":
    "এখানে সেভ করা ভিডিওতে অবস্থান থাকে না।",
  Status: "অবস্থা",
  "Rows in bold differ between the videos.":
    "মোটা অক্ষরের সারিগুলো ভিডিওভেদে আলাদা।",
  // video to GIF, GIF to video, extract frames
  "Make GIF": "GIF বানান",
  "Drop a video to make a GIF": "GIF বানাতে একটি ভিডিও ছেড়ে দিন",
  "This file has no picture to make a GIF from.":
    "এই ফাইলে GIF বানানোর মতো কোনো ছবি নেই।",
  Width: "প্রস্থ",
  "The video is {w} px wide, so the GIF stays at that size.":
    "ভিডিওটি {w} px চওড়া, তাই GIF-ও সেই মাপেই থাকবে।",
  Dithering: "ডিদারিং",
  Smooth: "মসৃণ",
  "A fine pattern blends the colours. Small files.":
    "সূক্ষ্ম নকশায় রং মিশে যায়। ফাইল ছোট হয়।",
  "The smoothest gradients, but larger files.":
    "সবচেয়ে মসৃণ রঙের ঢাল, তবে ফাইল বড় হয়।",
  "Flat colours. Smallest for cartoons and screen recordings.":
    "সমতল রং। কার্টুন আর স্ক্রিন রেকর্ডিংয়ের জন্য সবচেয়ে ছোট।",
  Playback: "চালানো",
  "Loop forever": "বারবার চলবে",
  "{n} frames, {len}": "{n}টি ফ্রেম, {len}",
  "Long or large GIFs get heavy fast. A shorter part, a smaller width or fewer frames keep it light; for long clips an MP4 is far smaller.":
    "লম্বা বা বড় GIF দ্রুত ভারী হয়ে যায়। ছোট অংশ, কম প্রস্থ বা কম ফ্রেমে হালকা থাকে; লম্বা ক্লিপের জন্য MP4 অনেক ছোট।",
  "Make video": "ভিডিও বানান",
  "Drop GIFs to turn them into videos": "ভিডিও বানাতে GIF ছেড়ে দিন",
  "That isn't a GIF. Try a GIF or an animated WebP.":
    "এটি GIF নয়। একটি GIF বা অ্যানিমেটেড WebP দিন।",
  "Play it": "চালানো হবে",
  Once: "একবার",
  "Background for see-through parts": "স্বচ্ছ অংশের পটভূমি",
  "Videos don't loop by themselves like GIFs. Repeat a short animation to make it last longer.":
    "GIF-এর মতো ভিডিও নিজে থেকে বারবার চলে না। ছোট অ্যানিমেশন কয়েকবার জুড়ে দিলে সেটি বেশিক্ষণ চলে।",
  "{n} frames": "{n}টি ফ্রেম",
  "Drop a video to save frames from it": "ফ্রেম সেভ করতে একটি ভিডিও ছেড়ে দিন",
  "Save this frame": "এই ফ্রেমটি সেভ করুন",
  "Make contact sheet": "কন্টাক্ট শিট বানান",
  "Save 1 frame": "১টি ফ্রেম সেভ করুন",
  "Save {n} frames": "{n}টি ফ্রেম সেভ করুন",
  "This frame": "এই ফ্রেম",
  "Every few seconds": "কয়েক সেকেন্ড পরপর",
  "Every few frames": "কয়েক ফ্রেম পরপর",
  "Scene changes": "দৃশ্য বদলের জায়গায়",
  Every: "প্রতি",
  "Each frame": "প্রতিটি ফ্রেম",
  Sensitivity: "সংবেদনশীলতা",
  "Finds the cuts between shots. Higher sensitivity also catches big movements.":
    "শটের মাঝের কাটগুলো খুঁজে বের করে। বেশি সংবেদনশীলতায় বড় নড়াচড়াও ধরা পড়ে।",
  "Images in a zip": "zip-এ ছবিগুলো",
  "Contact sheet": "কন্টাক্ট শিট",
  "Show the times": "সময় দেখান",
  Images: "ছবি",
  "Frames on the sheet": "শিটে ফ্রেম",
  Part: "অংশ",
  "This file has no picture to save.": "এই ফাইলে সেভ করার মতো কোনো ছবি নেই।",
  "A contact sheet holds up to {n} frames. Pick a longer interval or a shorter part.":
    "একটি কন্টাক্ট শিটে সর্বোচ্চ {n}টি ফ্রেম থাকে। বেশি বিরতি বা ছোট অংশ বেছে নিন।",
  "Only the first {n} frames are saved. Pick a longer interval or a shorter part.":
    "শুধু প্রথম {n}টি ফ্রেম সেভ হবে। বেশি বিরতি বা ছোট অংশ বেছে নিন।",
  "No cuts found in this part. Try a higher sensitivity.":
    "এই অংশে কোনো কাট পাওয়া যায়নি। বেশি সংবেদনশীলতা দিয়ে দেখুন।",
  "The frames couldn't be saved.": "ফ্রেমগুলো সেভ করা যায়নি।",
  "Finding scene changes": "দৃশ্য বদল খোঁজা হচ্ছে",
  "Saving frames": "ফ্রেম সেভ হচ্ছে",
  "Frames to save": "যে ফ্রেমগুলো সেভ হবে",
  "Go to {t}": "{t}-এ যান",
  // -- record and info --
  // screen recorder
  "Sharing was cancelled or blocked. Press Start recording and choose a screen, window or tab to share.":
    "শেয়ার করা বাতিল বা বন্ধ করা হয়েছে। রেকর্ডিং শুরু করুন চেপে একটি স্ক্রিন, উইন্ডো বা ট্যাব বেছে নিন।",
  "This browser couldn't start screen sharing.":
    "এই ব্রাউজার স্ক্রিন শেয়ার শুরু করতে পারেনি।",
  "The microphone isn't allowed, so the recording has no voice.":
    "মাইক্রোফোনের অনুমতি নেই, তাই রেকর্ডিংয়ে কণ্ঠ থাকবে না।",
  "Sound from the screen or tab": "স্ক্রিন বা ট্যাবের শব্দ",
  Microphone: "মাইক্রোফোন",
  "Count down from 3": "৩ থেকে গুনে শুরু",
  "Your browser asks what to share: the whole screen, one window or a tab. Sound from the screen works best with a tab in Chrome or Edge.":
    "কী শেয়ার করবেন তা ব্রাউজার জিজ্ঞেস করবে: পুরো স্ক্রিন, একটি উইন্ডো বা একটি ট্যাব। Chrome বা Edge-এ ট্যাব শেয়ার করলে শব্দ সবচেয়ে ভালো আসে।",
  Recording: "রেকর্ডিং",
  "Finishing the recording": "রেকর্ডিং গুছিয়ে নেওয়া হচ্ছে",
  "Record your screen, a window or a tab":
    "আপনার স্ক্রিন, একটি উইন্ডো বা ট্যাব রেকর্ড করুন",
  "The recording is made on your device and stays there until you save it.":
    "রেকর্ডিং তৈরি হয় আপনার ডিভাইসে, আর সেভ না করা পর্যন্ত সেখানেই থাকে।",
  "Start recording": "রেকর্ডিং শুরু করুন",
  "This browser can't record the screen. Try Chrome, Edge, Firefox or Safari on a computer.":
    "এই ব্রাউজার স্ক্রিন রেকর্ড করতে পারে না। কম্পিউটারে Chrome, Edge, Firefox বা Safari ব্যবহার করুন।",
  Paused: "থামানো",
  Resume: "আবার চালান",
  Pause: "থামান",
  "Stop recording": "রেকর্ডিং বন্ধ করুন",
  "Convert to MP4": "MP4-এ কনভার্ট করুন",
  "MP4 plays on more phones and in more apps.":
    "MP4 বেশি ফোন আর বেশি অ্যাপে চলে।",
  "Download the WebM": "WebM ডাউনলোড করুন",
  "Record again": "আবার রেকর্ড করুন",
};
