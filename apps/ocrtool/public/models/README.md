# Photo engine models

OCRTool's photo engine (`src/lib/ocr/photo*.ts`) runs PaddleOCR models with onnxruntime-web.
They are served from this folder (the CSP allows no other host), downloaded by the browser on
first use and kept in the Cache API (`kmra-runtime`). The service worker doesn't precache them.

All files are PaddleOCR models (Apache-2.0, https://github.com/PaddlePaddle/PaddleOCR) in the
ONNX conversions published by the RapidOCR project (Apache-2.0,
https://github.com/RapidAI/RapidOCR) on ModelScope, repo `RapidAI/RapidOCR`, tag `v3.10.0`:
`https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/v3.10.0/<path>`. Files were renamed;
contents are unchanged.

| File                        | Source path                                                                  |      Bytes | SHA-256                                                            |
| --------------------------- | ---------------------------------------------------------------------------- | ---------: | ------------------------------------------------------------------ |
| `ppocrv5-det.onnx`          | `onnx/PP-OCRv5/det/ch_PP-OCRv5_det_mobile.onnx`                              |  4,819,576 | `4d97c44a20d30a81aad087d6a396b08f786c4635742afc391f6621f5c6ae78ae` |
| `ppocr-cls.onnx`            | `onnx/PP-OCRv4/cls/ch_ppocr_mobile_v2.0_cls_mobile.onnx`                     |    585,532 | `e47acedf663230f8863ff1ab0e64dd2d82b838fceb5957146dab185a89d6215c` |
| `ppocrv5-rec-latin.onnx`    | `onnx/PP-OCRv5/rec/latin_PP-OCRv5_rec_mobile.onnx`                           |  7,904,513 | `b20bd37c168a570f583afbc8cd7925603890efbcdc000a59e22c269d160b5f5a` |
| `ppocrv5-rec-latin.txt`     | `paddle/PP-OCRv5/rec/latin_PP-OCRv5_rec_mobile/ppocrv5_latin_dict.txt`       |      1,634 | `3c0a8a79b612653c25f765271714f71281e4e955962c153e272b7b8c1d2b13ff` |
| `ppocrv5-rec-ch.onnx`       | `onnx/PP-OCRv5/rec/ch_PP-OCRv5_rec_mobile.onnx`                              | 16,631,306 | `5825fc7ebf84ae7a412be049820b4d86d77620f204a041697b0494669b1742c5` |
| `ppocrv5-rec-ch.txt`        | `paddle/PP-OCRv5/rec/ch_PP-OCRv5_rec_mobile/ppocrv5_dict.txt`                |     74,012 | `d1979e9f794c464c0d2e0b70a7fe14dd978e9dc644c0e71f14158cdf8342af1b` |
| `ppocrv5-rec-cyrillic.onnx` | `onnx/PP-OCRv5/rec/cyrillic_PP-OCRv5_rec_mobile.onnx`                        |  8,074,092 | `90f761b4bfcce0c8c561c0cb5c887b0971d3ec01c32164bdf7374a35b0982711` |
| `ppocrv5-rec-cyrillic.txt`  | `paddle/PP-OCRv5/rec/cyrillic_PP-OCRv5_rec_mobile/ppocrv5_cyrillic_dict.txt` |      2,781 | `db40aa52ceb112055be80c694afdf655d5d2c4f7873704524cc16a447ca913ba` |

Total: 38.1 MB. What each one does:

- **Detection** (PP-OCRv5 mobile, DBNet): finds the text lines. Multilingual.
- **Line orientation** (PP-OCR mobile v2.0 classifier): flags lines that are upside down.
- **Recognition** (PP-OCRv5 mobile, CTC), one per script, each with its character list:
  - Latin: English and Latin-script languages with all their letters in the list (French,
    German, Spanish, Portuguese, Italian, Dutch, Polish, Turkish, Czech, …). It read English
    screenshots better than the English-only model in our tests, so English uses it too.
  - Chinese: simplified and traditional Chinese, Japanese (kana and kanji), and English.
  - Cyrillic: Russian, Ukrainian, Belarusian, Bulgarian, Serbian, Macedonian, Kazakh, … and
    English.

The language → model table is `LANG_MODEL` in `src/lib/ocr/photo-models.ts`. Left out to keep the
folder under ~40 MB (the document engine covers these languages): Korean (13.5 MB), Arabic
(8.0 MB, also needs right-to-left handling), Devanagari (7.9 MB). To add one, put the `.onnx`
and its `.txt` here, add it to `REC` and `LANG_MODEL`, and record it in this table.
