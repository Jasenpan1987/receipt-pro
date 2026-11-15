# Investigation: Jev as the Receipt Checker

**Date:** 2026-11-15
**Type:** investigation
**Participants:** Builder; Claude
**Source:** TypeSafe AI documentation, read 2026-11-15 (links below). No API call was made.

## Summary

The builder asked whether Jev, a model the builder had heard of, could serve as the checker
(the builder's word: 审核官), the second AI that reviews each receipt's output after the MVP.
Jev, from TypeSafe AI, is a judgement model: it returns probabilities, not prose. It accepts
images and checks extracted values against the photo itself, which is the shape the checker
needs. Its image support is a preview feature, so it is a candidate to **test**, not a
decision. The builder: once the MVP is done and the checker is added, this is an experiment
we need to run.

## What the Builder Wants From a Checker

From the discussion; none of it is a requirement yet.

1. When the reader is unsure, another model or mechanism reviews its output afterwards.
2. If the review passes, the receipt passes. If the review is unsure, the output gets a label.
3. If the review is sure the output is wrong, the receipt is sent back to be generated again.
4. 100% accuracy is not expected: angles, light, and blur defeat any reader.
5. The builder rejected "extract the text first, then judge the text": the extraction step can itself be wrong. The checker must look at the photo.

## Findings

### What Jev is

- Maker: TypeSafe AI, San Francisco. Jev is its first "System One" model: fast, structured judgements for code to consume, not chat.
- Models: `jev-1.14.0` (from 2026-10-14; alias `jev-latest`) and `jev-1.13.0`. Endpoint `POST /v1/systemone`.
- Question types: **Noul** (probability 0–1 that a statement is true), **Choice** (one option, with probabilities and confidence), **Score** (against a rubric), **Box** (locate something in an image; 1.14 only).
- Price: "$42 / $0.042" per billion / per million **input** tokens; output tokens are free. Tokens per image are not documented.
- SDK: JavaScript `@typesafe-ai/sdk` (and Python). No Vercel AI SDK provider and no OpenAI compatibility, so it would be a separate integration beside the reader.
- Latency: not documented.

### Images

- Preview feature, off by default. Every request with an image needs the header `TypeSafe-Danger-Zone-Images: true`, or it returns `400`. The docs: images and Box are "not yet ready for production, and their request format and answers can change between releases."
- PNG or JPEG only. Each side 280–1568 px; total 78,400–2,458,624 px. Out-of-range images are rejected, never resized. 16 MiB per image, 32 MiB per request.
- EXIF orientation is **not** applied: rotate pixels upright before sending. Baseline JPEG preferred.

### The closest documented case: OCR values on phone photos of invoices

Cookbook "OCR confidence and bounding boxes", run with `jev-1.14.0` on 2026-10-15:

- Another tool (Apple Vision OCR plus a text LLM) extracted 15 values from phone photos of 2 supplier invoices. Jev did not read the text; it judged whether each value appears on the photo.
- Three requests per invoice: a whole-page Box and Noul, a zoomed re-Box, then a padded crop upscaled to about 800 px with a second Noul. Below 0.25 on either check → human review.
- Result: 3 of 15 values were misread, and all 3 were flagged. No correct value was flagged.
- Weaknesses the cookbook states: a whole-page photo shows small print in little detail, and a misread invoice number scored 0.88 on the page check. Neither check alone caught all three misreads (a wrong year scored 0.66 on the crop check). Some correct values were close to the bar (0.31, 0.35). Only two invoices were tested. Skew, rotation, and blur were not addressed.

### Text-only verification case

Cookbook "Verifying LLM answers against their source": text only, no images. 1,000 answers, 115 wrong. Flagging at risk 0.2 held back 84 of the 115 wrong answers, but also sent 189 correct answers to review. The page advises choosing the threshold on your own labelled data.

## What This Means for receipt-pro

- **Jev fits the builder's design:** a Noul probability per item maps onto pass / label as unsure / regenerate, with thresholds tuned on the builder's receipts.
- **A whole-receipt check is not enough.** Each line item needs a locate-and-crop pass, so one receipt is several requests and the checker code is more than one call.
- **The preview status conflicts with the robustness principle** (`docs/knowledge/project.md#principles`) until TypeSafe declares images production-ready.
- **A free first layer comes before any checker:** item amounts minus discounts must equal the printed `共` total. This needs the reader to return item amounts, discounts, and the total as structured data beside the output text; ADR-002 is unaffected because the text is still written by the AI.

## The Experiment to Run (when the checker is added)

1. Rerun the builder's real receipts from T-002 and T-006, plus deliberately wrong outputs (a changed price, a changed item, a changed total).
2. Measure: wrong values caught, correct values falsely flagged, requests and cost per receipt, time per receipt.
3. Compare a whole-receipt check against a per-item crop check.
4. Recheck whether Jev's image support has left preview.

## Open Design Questions for the Checker

- Where does the "unsure" label go? In the copied text, where it survives into Word but makes the text no longer clean, or only in the app?
- Check every receipt, or only suspicious ones (the arithmetic check fails, or the reader reports unreadable parts)? Every receipt costs more.

## Sources

- `https://docs.typesafe.ai/introduction`
- `https://docs.typesafe.ai/models.md`
- `https://docs.typesafe.ai/images.md`
- `https://docs.typesafe.ai/cookbooks/ocr_confidence_bounding_boxes.md`
- `https://docs.typesafe.ai/cookbooks/verify_llm_outputs.md`
- `https://docs.typesafe.ai/llms.txt` (index)
