import type { CreateAssignmentInput } from "@veda/contracts";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const defaultAssignment: CreateAssignmentInput = {
  name: "",
  subject: "",
  grade: "",
  dueDate: "",
  timeLimit: 45,
  questionGroups: [
    { type: "Multiple Choice Questions", count: 4, marks: 1 },
    { type: "Short Questions", count: 3, marks: 2 },
  ],
  difficultyPreference: "mixed",
  bloomsLevel: "Mixed",
  instructions: "",
};

type DraftState = {
  draft: CreateAssignmentInput;
  setDraft: (draft: CreateAssignmentInput) => void;
  clearDraft: () => void;
};

export const useAssignmentDraft = create<DraftState>()(
  persist(
    (set) => ({
      draft: defaultAssignment,
      setDraft: (draft) => set({ draft }),
      clearDraft: () => set({ draft: defaultAssignment }),
    }),
    { name: "vedaai-assignment-draft" },
  ),
);
