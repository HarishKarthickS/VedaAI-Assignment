import PdfPrinter from "pdfmake";
import { UTFile } from "uploadthing/server";
import { existsSync } from "node:fs";
import { AssessmentRevision, Assignment, PdfExport, Workspace } from "../models/index.js";
import { uploadPrivateFile } from "./file.service.js";
import { ApiError } from "../utils/http.js";
import { normalizePaperForAssignment } from "./paper-integrity.service.js";

const fontCandidates = [
  {
    name: "ExamSans",
    normal: "C:/Windows/Fonts/arial.ttf",
    bold: "C:/Windows/Fonts/arialbd.ttf",
    italics: "C:/Windows/Fonts/ariali.ttf",
    bolditalics: "C:/Windows/Fonts/arialbi.ttf",
  },
  {
    name: "ExamSans",
    normal: "/usr/share/fonts/dejavu/DejaVuSans.ttf",
    bold: "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
    italics: "/usr/share/fonts/dejavu/DejaVuSans-Oblique.ttf",
    bolditalics: "/usr/share/fonts/dejavu/DejaVuSans-BoldOblique.ttf",
  },
];

function resolveFonts() {
  const candidate = fontCandidates.find((item) => existsSync(item.normal) && existsSync(item.bold));
  if (!candidate) {
    return {
      fontName: "Helvetica",
      fonts: {
        Helvetica: {
          normal: "Helvetica",
          bold: "Helvetica-Bold",
          italics: "Helvetica-Oblique",
          bolditalics: "Helvetica-BoldOblique",
        },
      },
    };
  }

  return {
    fontName: candidate.name,
    fonts: {
      [candidate.name]: {
        normal: candidate.normal,
        bold: candidate.bold,
        italics: existsSync(candidate.italics) ? candidate.italics : candidate.normal,
        bolditalics: existsSync(candidate.bolditalics) ? candidate.bolditalics : candidate.bold,
      },
    },
  };
}

const resolvedFonts = resolveFonts();
const printer = new PdfPrinter(resolvedFonts.fonts);

const symbolMap: Record<string, string> = {
  "\u03b1": "alpha",
  "\u03b2": "beta",
  "\u03b3": "gamma",
  "\u03b4": "delta",
  "\u03b8": "theta",
  "\u03bb": "lambda",
  "\u03bc": "mu",
  "\u03c0": "pi",
  "\u03c3": "sigma",
  "\u03c6": "phi",
  "\u03c9": "omega",
  "\u0394": "Delta",
  "\u03a9": "Omega",
  "\u00b2": "^2",
  "\u00b3": "^3",
  "\u2074": "^4",
  "\u2075": "^5",
  "\u2076": "^6",
  "\u2077": "^7",
  "\u2078": "^8",
  "\u2079": "^9",
  "\u2070": "^0",
  "\u207b": "^-",
  "\u2212": "-",
  "\u2010": "-",
  "\u2011": "-",
  "\u2012": "-",
  "\u2013": "-",
  "\u2014": "-",
  "\u2018": "'",
  "\u2019": "'",
  "\u201c": "\"",
  "\u201d": "\"",
  "\u00d7": "x",
  "\u00f7": "/",
};

function pdfText(value: unknown) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/[αβγδθλμπσφωΔΩ²³⁴⁵⁶⁷⁸⁹⁰⁻−‐‑‒–—‘’“”×÷]/g, (match) => symbolMap[match] || match)
    .replace(/\s+/g, " ")
    .trim();
}

function questionOptions(question: any) {
  if (question.type !== "Multiple Choice Questions" || !Array.isArray(question.options) || !question.options.length) {
    return [];
  }
  return question.options.map((option: string, index: number) => ({
    text: `${String.fromCharCode(65 + index)}. ${pdfText(option)}`,
    margin: [22, 1, 0, index === question.options.length - 1 ? 8 : 1],
    color: "#333333",
  }));
}

function questionStack(question: any, index: number, teacherCopy: boolean) {
  return {
    margin: [0, 0, 0, teacherCopy ? 9 : 11],
    stack: [
      {
        columns: [
          { text: `${index + 1}.`, width: 24, bold: true },
          {
            width: "*",
            text: [
              { text: pdfText(question.questionText) },
              { text: ` [${question.marks} ${question.marks === 1 ? "mark" : "marks"}]`, bold: true },
            ],
          },
        ],
      },
      ...questionOptions(question),
      ...(teacherCopy
        ? [
            {
              table: {
                widths: ["*", "*"],
                body: [
                  [
                    { text: `Answer: ${pdfText(question.answerKey)}`, border: [false, false, false, false] },
                    {
                      text: `Bloom: ${pdfText(question.bloomsLevel)} | ${question.difficulty} | Confidence: ${Math.round(question.confidenceScore * 100)}%`,
                      border: [false, false, false, false],
                      alignment: "right",
                      color: "#666666",
                    },
                  ],
                ],
              },
              layout: "noBorders",
              fontSize: 9,
              margin: [24, 2, 0, 0],
            },
          ]
        : []),
    ],
  };
}

function createPdfBuffer(definition: any) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const document = printer.createPdfKitDocument(definition);
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
    document.end();
  });
}

export async function buildAndStorePdf(exportId: string) {
  const artifact = await PdfExport.findById(exportId);
  if (!artifact) throw new ApiError(404, "PDF request not found.");
  artifact.status = "processing";
  await artifact.save();

  try {
    const [assignment, revision, workspace] = (await Promise.all([
      Assignment.findById(artifact.assignmentId).lean(),
      AssessmentRevision.findById(artifact.revisionId).lean(),
      Workspace.findById(artifact.workspaceId).lean(),
    ])) as any[];
    if (!assignment || !revision || !workspace) throw new ApiError(404, "PDF source assessment not found.");

    const teacherCopy = artifact.variant === "teacher";
    const paper = normalizePaperForAssignment({ sections: revision.sections }, assignment);
    const sectionContent = paper.sections.flatMap((section: any, sectionIndex: number) => [
      {
        text: pdfText(section.title),
        style: "section",
        margin: [0, sectionIndex === 0 ? 16 : 14, 0, 4],
        pageBreak: sectionIndex > 0 && section.questions.length > 5 ? "before" : undefined,
      },
      { text: pdfText(section.instruction), italics: true, color: "#555555", margin: [0, 0, 0, 8] },
      ...section.questions.map((question: any, index: number) => questionStack(question, index, teacherCopy)),
    ]);

    const document = {
      pageMargins: [44, 44, 44, 54],
      defaultStyle: { font: resolvedFonts.fontName, fontSize: 10.5, color: "#242424", lineHeight: 1.22 },
      styles: {
        title: { fontSize: 20, bold: true, alignment: "center" },
        subtitle: { fontSize: 13, bold: true, alignment: "center" },
        metadata: { fontSize: 10, bold: true },
        section: { fontSize: 14, bold: true, alignment: "center" },
      },
      footer: (page: number, pages: number) => ({
        text: `${teacherCopy ? "Teacher Answer Key" : "Student Question Paper"}  |  Page ${page} of ${pages}`,
        alignment: "center",
        fontSize: 9,
        color: "#777777",
        margin: [0, 14, 0, 0],
      }),
      content: [
        { text: pdfText(workspace.name), style: "title" },
        { text: pdfText(assignment.name), style: "subtitle", margin: [0, 4, 0, 4] },
        { text: `${pdfText(assignment.subject)} | ${pdfText(assignment.grade)}`, alignment: "center", margin: [0, 0, 0, 14] },
        {
          table: {
            widths: ["*", "*"],
            body: [
              [
                { text: `Time Allowed: ${assignment.timeLimit} minutes`, style: "metadata", border: [true, true, true, true] },
                { text: `Maximum Marks: ${assignment.totalMarks}`, alignment: "right", style: "metadata", border: [true, true, true, true] },
              ],
            ],
          },
          layout: {
            hLineColor: () => "#d6d6d6",
            vLineColor: () => "#d6d6d6",
            paddingLeft: () => 8,
            paddingRight: () => 8,
            paddingTop: () => 5,
            paddingBottom: () => 5,
          },
        },
        {
          canvas: [{ type: "line", x1: 0, y1: 0, x2: 507, y2: 0, lineWidth: 0.7, lineColor: "#777777" }],
          margin: [0, 14, 0, 12],
        },
        ...(teacherCopy
          ? [{ text: "Answer Key", style: "subtitle", margin: [0, 0, 0, 4] }]
          : [
              {
                table: {
                  widths: ["*", 150, 130],
                  body: [
                    [
                      { text: "Name: ______________________________", border: [true, true, true, true] },
                      { text: "Roll No: ______________", border: [true, true, true, true] },
                      { text: "Section: __________", border: [true, true, true, true] },
                    ],
                  ],
                },
                layout: {
                  hLineColor: () => "#d6d6d6",
                  vLineColor: () => "#d6d6d6",
                  paddingLeft: () => 8,
                  paddingRight: () => 8,
                  paddingTop: () => 6,
                  paddingBottom: () => 6,
                },
                margin: [0, 0, 0, 12],
              },
            ]),
        ...sectionContent,
      ],
    };

    const bytes = await createPdfBuffer(document);
    const fileName = `${assignment.name.replace(/\W+/g, "-").toLowerCase()}-${artifact.variant}.pdf`;
    const upload = await uploadPrivateFile(
      new UTFile([new Uint8Array([...bytes])], fileName, {
        type: "application/pdf",
        customId: `${artifact.id}:${artifact.variant}`,
      }),
      {
        acl: "public-read",
        contentDisposition: "attachment",
      },
    );
    if (upload.error || !upload.data) throw new ApiError(502, "PDF could not be stored.");
    artifact.status = "completed";
    artifact.error = undefined;
    artifact.fileKey = upload.data.key;
    artifact.fileName = fileName;
    await artifact.save();
    return artifact;
  } catch (error) {
    artifact.status = "failed";
    artifact.error = error instanceof Error ? error.message : "PDF export failed.";
    await artifact.save();
    throw error;
  }
}
