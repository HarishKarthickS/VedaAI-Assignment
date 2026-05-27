import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NumberStepper } from "./number-stepper";

describe("NumberStepper", () => {
  it("does not request values below its minimum", () => {
    const change = vi.fn();
    render(<NumberStepper label="Marks" value={1} onChange={change} />);
    fireEvent.click(screen.getByRole("button", { name: "Decrease Marks" }));
    expect(change).toHaveBeenCalledWith(1);
  });

  it("increments an assessment value", () => {
    const change = vi.fn();
    render(<NumberStepper label="Questions" value={3} onChange={change} />);
    fireEvent.click(screen.getByRole("button", { name: "Increase Questions" }));
    expect(change).toHaveBeenCalledWith(4);
  });
});
