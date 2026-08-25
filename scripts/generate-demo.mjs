import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const INK = rgb(0.1, 0.18, 0.45);
const RULE = rgb(0.75, 0.82, 0.9);
const PRINT = rgb(0.12, 0.12, 0.12);

function topToPdf(normalizedY, height) {
  return PAGE_HEIGHT * (1 - normalizedY - height);
}

async function questionPaper() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);

  const page1 = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  page1.drawText("VEDA PUBLIC SCHOOL", { x: 180, y: 800, size: 12, font: bold, color: PRINT });
  page1.drawText("Class 10 Science — Unit Test", { x: 170, y: 780, size: 16, font: bold, color: PRINT });
  page1.drawText("Maximum Marks: 30    Time: 1 Hour", { x: 175, y: 760, size: 11, font, color: PRINT });
  page1.drawText("Attempt all questions. Write answers in the answer booklet.", { x: 90, y: 740, size: 10, font, color: PRINT });

  const questions = [
    "1. Which blood vessel carries blood away from the heart?  [2 Marks]",
    "2. Describe the process of photosynthesis. Mention the site where it occurs.  [5 Marks]",
    "3. Explain the function of stomata in plants.  [3 Marks]",
    "4. What is the role of chlorophyll in photosynthesis?  [2 Marks]",
    "5. Draw a labelled diagram showing the process of photosynthesis in a plant.  [5 Marks]",
    "6. Differentiate between aerobic and anaerobic respiration.  [4 Marks]",
  ];
  questions.forEach((text, index) => {
    page1.drawText(text, { x: 50, y: 680 - index * 70, size: 12, font, color: PRINT, maxWidth: 500 });
  });

  const page2 = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  page2.drawText("Class 10 Science — Unit Test (continued)", { x: 150, y: 800, size: 12, font: bold, color: PRINT });
  page2.drawText("7. Answer the following:", { x: 50, y: 760, size: 12, font, color: PRINT });
  page2.drawText("(a) Define transpiration.  [2 Marks]", { x: 70, y: 730, size: 12, font, color: PRINT });
  page2.drawText("(b) List two factors that affect the rate of transpiration.  [3 Marks]", { x: 70, y: 700, size: 12, font, color: PRINT });
  page2.drawText("8. Why is the small intestine considered the site of complete digestion?  [4 Marks]", {
    x: 50,
    y: 650,
    size: 12,
    font,
    color: PRINT,
    maxWidth: 500,
  });
  page2.drawText("End of Question Paper", { x: 220, y: 80, size: 10, font, color: PRINT });
  return pdf.save();
}

function ruledPage(page) {
  for (let y = 80; y < 780; y += 22) {
    page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 0.4, color: RULE });
  }
}

async function answerSheet() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic);

  const blocks = [
    {
      page: 0,
      y: 0.1,
      h: 0.32,
      lines: [
        "Q5. Plant diagram for photosynthesis.",
        "Sunlight -> leaf. CO2 enters, water from roots.",
        "Oxygen is released. Process occurs in chloroplast.",
        "Labels: sunlight, carbon dioxide, oxygen, water.",
      ],
    },
    {
      page: 0,
      y: 0.46,
      h: 0.4,
      lines: [
        "Q2. The process mainly occurs in the chloroplast of",
        "the plant cell. Green plants make food using sunlight,",
        "carbon dioxide and water. Chlorophyll traps light.",
        "Glucose is formed and oxygen is released.",
        "6CO2 + 6H2O -> C6H12O6 + 6O2  (continued)",
      ],
    },
    {
      page: 1,
      y: 0.1,
      h: 0.3,
      lines: [
        "Q2 continued: Light reaction happens in thylakoids.",
        "Dark reaction / Calvin cycle happens in stroma.",
        "This is how autotrophs prepare their own food.",
      ],
    },
    {
      page: 1,
      y: 0.46,
      h: 0.2,
      lines: [
        "Q1. Arteries carry blood away from the heart.",
        "They have thick elastic walls.",
      ],
    },
    {
      page: 2,
      y: 0.1,
      h: 0.18,
      lines: [
        "Ans 7(a): Transpiration is loss of water vapour",
        "from aerial parts, mainly through stomata.",
      ],
    },
    {
      page: 2,
      y: 0.34,
      h: 0.22,
      lines: [
        "Q6. Aerobic uses oxygen, more energy.",
        "Anaerobic: no oxygen, lactic acid / alcohol.",
      ],
    },
    {
      page: 2,
      y: 0.64,
      h: 0.18,
      lines: [
        "Yesterday our school cricket team won the",
        "match by 4 wickets. Virat scored 62 runs.",
      ],
    },
    {
      page: 3,
      y: 0.1,
      h: 0.22,
      lines: [
        "7b) temperature and wind maybe humidity",
        "also I think  (writing is hurried)",
      ],
    },
    {
      page: 3,
      y: 0.4,
      h: 0.22,
      lines: [
        "Q3. Stomata are tiny pores on the leaf.",
        "They allow CO2 / O2 exchange and transpiration.",
      ],
    },
    {
      page: 3,
      y: 0.68,
      h: 0.2,
      lines: [
        "Q8. Small intestine has pancreatic enzymes,",
        "bile from liver, and villi to absorb food.",
      ],
    },
  ];

  const pages = [pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]), pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]), pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]), pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])];
  pages.forEach((page, index) => {
    ruledPage(page);
    page.drawText(`Student Answer Sheet  •  Page ${index + 1} of 4`, { x: 40, y: 810, size: 10, font, color: PRINT });
    page.drawText("Name: A. Sharma    Roll: 17    Class: 10-B", { x: 40, y: 792, size: 10, font, color: PRINT });
  });

  for (const block of blocks) {
    const page = pages[block.page];
    const startY = topToPdf(block.y, 0);
    block.lines.forEach((line, lineIndex) => {
      page.drawText(line, {
        x: 48,
        y: startY - 28 - lineIndex * 18,
        size: 12,
        font: italic,
        color: INK,
      });
    });
  }

  return pdf.save();
}

const outDir = path.join(process.cwd(), "public", "demo");
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "question-paper.pdf"), await questionPaper());
await writeFile(path.join(outDir, "answer-sheet.pdf"), await answerSheet());
console.log("Demo PDFs written to public/demo");
