import { describe, expect, it } from "vitest";
import { splitMentions } from "../utils/mentions";
import {
  isReviewStatus,
  reviewStatusClasses,
  reviewStatusLabel,
  REVIEW_STATUSES,
} from "../utils/reviewStatus";
import {
  buildPassageLink,
  parseLineAnchorFromUrl,
} from "../services/driveState";

describe("splitMentions", () => {
  it("returns plain text unchanged when no mention exists", () => {
    expect(splitMentions("plain comment body")).toEqual([
      { text: "plain comment body", isMention: false },
    ]);
  });

  it("splits a mention surrounded by text", () => {
    expect(splitMentions("hey @anna please check")).toEqual([
      { text: "hey ", isMention: false },
      { text: "@anna", isMention: true },
      { text: " please check", isMention: false },
    ]);
  });

  it("handles several mentions and punctuation edges", () => {
    expect(splitMentions("@a.b-c and @d_e")).toEqual([
      { text: "@a.b-c", isMention: true },
      { text: " and ", isMention: false },
      { text: "@d_e", isMention: true },
    ]);
  });

  it("leaves a bare @ and emails without a leading name intact", () => {
    expect(splitMentions("no one @ here")).toEqual([
      { text: "no one @ here", isMention: false },
    ]);
  });
});

describe("review status helpers", () => {
  it("validates the known statuses", () => {
    expect(REVIEW_STATUSES).toContain("in-review");
    expect(isReviewStatus("in-review")).toBe(true);
    expect(isReviewStatus("bogus")).toBe(false);
    expect(isReviewStatus(42)).toBe(false);
  });

  it("labels and colors each status distinctly", () => {
    expect(reviewStatusLabel("in-review")).toBe("In review");
    expect(reviewStatusLabel("approved")).toBe("Approved");
    expect(reviewStatusLabel("draft")).toBe("Draft");
    expect(reviewStatusLabel("custom")).toBe("Draft");

    expect(reviewStatusClasses("in-review")).toContain("amber");
    expect(reviewStatusClasses("approved")).toContain("emerald");
    expect(reviewStatusClasses("draft")).toContain("slate");
  });
});

describe("passage deep links", () => {
  it("parses #line=N anchors", () => {
    expect(parseLineAnchorFromUrl("#line=12")).toBe(12);
    expect(parseLineAnchorFromUrl("#line=1")).toBe(1);
  });

  it("rejects malformed or out-of-range anchors", () => {
    expect(parseLineAnchorFromUrl("")).toBeNull();
    expect(parseLineAnchorFromUrl("#heading")).toBeNull();
    expect(parseLineAnchorFromUrl("#line=0")).toBeNull();
    expect(parseLineAnchorFromUrl("#line=-4")).toBeNull();
    expect(parseLineAnchorFromUrl("#line=abc")).toBeNull();
    expect(parseLineAnchorFromUrl("#line=12345678")).toBeNull();
  });

  it("builds a link with the file id and line hash", () => {
    const link = buildPassageLink("abc123", 7);
    expect(link).toContain("fileId=abc123");
    expect(link).toContain("#line=7");
  });
});
