"use client";

import React from "react";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Copy, Pencil, Plus, RefreshCw } from "lucide-react";
import { Badge, Button, Textarea } from "@veda/ui";

type Question = {
  _id?: string;
  questionText: string;
  type: string;
  difficulty: "Easy" | "Moderate" | "Challenging";
  marks: number;
  options?: string[];
  bloomsLevel: string;
  answerKey: string;
  estimatedTime: string;
  confidenceScore: number;
  generationRationale: string;
};
export type Section = { _id?: string; title: string; instruction: string; questions: Question[] };

export function PaperView({
  assignment,
  sections,
  showAnswers,
  disabled = false,
  onRegenerateQuestion,
  onRegenerateSection,
  onSaveSections,
}: {
  assignment: { subject: string; grade: string; timeLimit: number; totalMarks: number; school: string };
  sections: Section[];
  showAnswers: boolean;
  disabled?: boolean;
  onRegenerateQuestion: (id: string) => void;
  onRegenerateSection: (id: string) => void;
  onSaveSections: (sections: Section[]) => void;
}) {
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [editing, setEditing] = useState<{ section: number; question: number }>();
  const [draft, setDraft] = useState(sections);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraft(sections);
    setDirty(false);
  }, [sections]);

  function updateQuestion(sectionIndex: number, questionIndex: number, text: string) {
    setDirty(true);
    setDraft((current) =>
      current.map((section, currentSection) =>
        currentSection !== sectionIndex
          ? section
          : {
              ...section,
              questions: section.questions.map((question, currentQuestion) =>
                currentQuestion === questionIndex ? { ...question, questionText: text } : question,
              ),
            },
      ),
    );
  }

  function addQuestion(sectionIndex: number) {
    setDirty(true);
    setDraft((current) => current.map((section, index) => index === sectionIndex ? {
      ...section,
      questions: [...section.questions, {
        questionText: "New teacher-authored question",
        type: "Short Questions",
        difficulty: "Moderate",
        marks: 2,
        options: [],
        bloomsLevel: "Understand",
        answerKey: "Add the expected answer.",
        estimatedTime: "3 minutes",
        confidenceScore: 1,
        generationRationale: "Added manually by the teacher.",
      }],
    } : section));
  }

  return (
    <article className="mt-3 rounded-[16px] bg-white px-4 py-7 text-[#373737] shadow-sm md:mt-4 md:px-8 md:py-10 lg:px-12">
      <header className="text-center">
        <h1 className="text-xl font-bold md:text-[28px]">{assignment.school}</h1>
        <p className="mt-3 text-sm font-semibold md:text-lg">Subject: {assignment.subject}</p>
        <p className="text-sm font-semibold md:text-lg">Class: {assignment.grade}</p>
      </header>
      <div className="mt-8 flex flex-col gap-2 text-sm font-semibold sm:flex-row sm:justify-between md:text-base">
        <p>Time Allowed: {assignment.timeLimit} minutes</p>
        <p>Maximum Marks: {assignment.totalMarks}</p>
      </div>
      <p className="mt-8 text-sm font-semibold md:text-base">All questions are compulsory unless stated otherwise.</p>
      <div className="mt-7 text-sm font-semibold leading-7 md:text-base">
        <p>Name: ____________________</p>
        <p>Roll Number: ______________</p>
        <p>Class: {assignment.grade} Section: __________</p>
      </div>

      {draft.map((section, sectionIndex) => {
        const key = section._id || section.title;
        const isCollapsed = collapsed.includes(key);
        return (
          <section key={key} className="mt-9">
            <div className="flex items-center justify-between">
              <h2 className="flex-1 text-center text-lg font-bold md:text-xl">{section.title}</h2>
              <div className="paper-toolbar flex gap-1">
                {section._id && <Button disabled={disabled} title="Regenerate section" variant="ghost" size="icon" onClick={() => onRegenerateSection(section._id!)}><RefreshCw size={15} /></Button>}
                <Button title={isCollapsed ? "Expand section" : "Collapse section"} variant="ghost" size="icon" onClick={() => setCollapsed((list) => list.includes(key) ? list.filter((item) => item !== key) : [...list, key])}>
                  {isCollapsed ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
                </Button>
              </div>
            </div>
            {!isCollapsed && (
              <>
                <h3 className="mt-7 text-sm font-bold md:text-base">{section.questions[0]?.type}</h3>
                <p className="mt-1 text-sm italic text-[#555]">{section.instruction}</p>
                <ol className="mt-6 space-y-4 pl-6 text-sm leading-6 md:text-base">
                  {section.questions.map((question, questionIndex) => (
                    <li key={question._id || questionIndex} className="group pl-1">
                      {editing?.section === sectionIndex && editing.question === questionIndex ? (
                        <div>
                          <Textarea value={question.questionText} onChange={(event) => updateQuestion(sectionIndex, questionIndex, event.target.value)} />
                          <div className="mt-2 flex gap-2">
                            <Button size="sm" onClick={() => { setEditing(undefined); setDirty(false); onSaveSections(draft); }}>Save question</Button>
                            <Button size="sm" variant="secondary" onClick={() => setEditing(undefined)}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2">
                          <p className="flex-1">
                            <Badge
                              tone={question.difficulty === "Easy" ? "easy" : question.difficulty === "Moderate" ? "moderate" : "hard"}
                              className="mr-2 align-middle"
                            >
                              {question.difficulty}
                            </Badge>
                            {question.questionText} <strong>[{question.marks} Marks]</strong>
                            <span className="ml-2 hidden text-xs text-[#777] md:inline">Bloom: {question.bloomsLevel}</span>
                            {question.type === "Multiple Choice Questions" && Boolean(question.options?.length) && (
                              <span className="mt-3 grid gap-2 text-sm text-[#444] sm:grid-cols-2">
                                {question.options!.map((option, optionIndex) => (
                                  <span key={`${question._id || questionIndex}-${option}`} className="rounded-[8px] border border-[#ededed] bg-[#fafafa] px-3 py-2">
                                    <strong className="mr-2">{String.fromCharCode(65 + optionIndex)}.</strong>
                                    {option}
                                  </span>
                                ))}
                              </span>
                            )}
                          </p>
                          <div className="paper-toolbar flex shrink-0 gap-1 md:hidden md:group-hover:flex md:group-focus-within:flex">
                            <Button title="Copy question" variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(question.questionText)}><Copy size={15} /></Button>
                            <Button disabled={disabled} title="Edit question" variant="ghost" size="icon" onClick={() => setEditing({ section: sectionIndex, question: questionIndex })}><Pencil size={15} /></Button>
                            {question._id && <Button disabled={disabled} title="Regenerate question" variant="ghost" size="icon" onClick={() => onRegenerateQuestion(question._id!)}><RefreshCw size={15} /></Button>}
                          </div>
                        </div>
                      )}
                      {showAnswers && <p className="mt-2 rounded-[8px] bg-[#f8f8f8] p-3 text-sm text-[#555]"><strong>Answer:</strong> {question.answerKey}</p>}
                    </li>
                  ))}
                </ol>
                <Button disabled={disabled} className="paper-toolbar mt-5" size="sm" variant="secondary" onClick={() => addQuestion(sectionIndex)}>
                  <Plus size={15} /> Add custom question
                </Button>
              </>
            )}
          </section>
        );
      })}
      {dirty && (
        <div className="paper-toolbar mt-8 flex justify-end">
          <Button onClick={() => { onSaveSections(draft); setDirty(false); }}>Save paper changes</Button>
        </div>
      )}
      <p className="mt-9 font-bold">End of Question Paper</p>
    </article>
  );
}
