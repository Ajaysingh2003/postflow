import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { addDays, calendarRange, calendarTime, dateKey, layoutDay, localDateTime, moveCalendar, scheduleInstant, utcDate } from "../src/modules/schedule/calendarModel";
import { CalendarCard, MonthCalendar, TimeCalendar } from "../src/modules/schedule/view/ScheduleView";
import { destinationDraft, destinationRequestKey, destinationText, canSubmitDestination, submitDestinations } from "../src/modules/content/studio/publicationModel";

const noop = () => {};
const account = { id: "facebook-account", platform: "facebook", display_name: "Our Page", status: "active", account_metadata: {} };
const variant = { id: "variant", post_id: "post", platform: "facebook", connected_account_id: account.id, payload: { text: "An update for everyone", page_id: "own-page", poll: { options: ["A", "B"] } }, media_asset_ids: ["image"], publish_state: {}, status: "draft" };
const entry = (id, hour, minute = 0) => ({ post_title: "Our update", time: new Date(2026, 9, 5, hour, minute).toISOString(), variant: { ...variant, id, status: "scheduled" } });

describe("calendar times and layout", () => {
  test("UTC timestamps without an offset remain UTC", () => {
    expect(utcDate("2026-10-05T09:30:00").toISOString()).toBe("2026-10-05T09:30:00.000Z");
    expect(utcDate("2026-10-05T09:30:00+05:30").toISOString()).toBe("2026-10-05T04:00:00.000Z");
  });
  test("week starts on Monday, month contains complete weeks, and navigation crosses years", () => {
    const range = calendarRange(new Date(2026, 9, 11), "week");
    expect(dateKey(range.start)).toBe("2026-10-05");
    expect(dateKey(range.end)).toBe("2026-10-12");
    const month = calendarRange(new Date(2026, 9, 31), "month");
    expect(month.days).toHaveLength(42);
    expect(month.start.getDay()).toBe(1);
    expect(dateKey(moveCalendar(new Date(2026, 11, 31), "month", 1))).toBe("2027-01-01");
    expect(dateKey(addDays(new Date(2026, 11, 31), 1))).toBe("2027-01-01");
  });
  test("scheduling rejects past, malformed, and overflowing local dates", () => {
    const future = new Date(2027, 0, 15, 9, 30);
    expect(scheduleInstant(localDateTime(future), 0)).toBe(future.toISOString());
    expect(scheduleInstant(localDateTime(future), future.getTime())).toBeNull();
    expect(scheduleInstant("2027-02-30T09:00", 0)).toBeNull();
    expect(scheduleInstant("invalid", 0)).toBeNull();
  });
  test("simultaneous posts get separate lanes and late cards stay inside the day", () => {
    const layout = layoutDay([entry("a", 9), entry("b", 9), entry("c", 10), entry("d", 14), entry("late", 23, 59)]);
    expect(layout[0].lanes).toBe(3);
    expect(layout[1].lane).toBe(1);
    expect(layout[2].lane).toBe(2);
    expect(layout[3].lanes).toBe(1);
    expect(layout[4].minute + 100).toBeLessThanOrEqual(1440);
  });
  test("calendar cards show real status, account, copy and accessible actions", () => {
    const event = entry("a", 13, 30);
    const html = renderToStaticMarkup(<CalendarCard entry={event} account={account} onSelect={noop} />);
    expect(html).toContain("Our Page");
    expect(html).toContain("An update for everyone");
    expect(html).toContain('aria-label="Scheduled');
    expect(html).toContain('data-slot="button"');
    expect(html).not.toMatch(/<button\b(?:(?!<\/button>).)*<button\b/s);
    expect(calendarTime(event.time)).toBe("1:30 PM");
    expect(html).toContain(`<time dateTime="${event.time}"`);
    expect(html).toContain("1:30 PM");
    expect(html).toContain("More options");
    const range = calendarRange(new Date(2026, 9, 5), "month");
    const month = renderToStaticMarkup(<MonthCalendar date={new Date(2026, 9, 5)} days={range.days} entries={[event]} accounts={[account]} onSelect={noop} onDay={noop} />);
    expect(month).toContain("An update for everyone");
    const day = renderToStaticMarkup(<TimeCalendar days={[new Date(2026, 9, 5)]} entries={[event]} accounts={[account]} onSelect={noop} />);
    expect(day).toContain('aria-label="Day calendar"');
    expect(day).toContain("min-width:0");
  });
});

describe("multi-account publication", () => {
  test("copies copy/media while keeping destination settings and account identities separate", () => {
    const instagram = { ...account, id: "instagram-account", platform: "instagram" };
    const copy = destinationDraft(variant, account, instagram);
    expect(copy.payload).toEqual({ caption: "An update for everyone" });
    expect(copy.mediaIds).toEqual(["image"]);
    expect(copy.variant).toBeNull();
    const anotherPage = destinationDraft(variant, account, { ...account, id: "another-page" });
    expect(anotherPage.payload.page_id).toBeUndefined();
    anotherPage.payload.text = "Changed";
    anotherPage.mediaIds.push("new");
    expect(variant.payload.text).toBe("An update for everyone");
    expect(variant.media_asset_ids).toEqual(["image"]);
    const existing = { ...variant, id: "own-version", payload: { caption: "My version", target_id: "own-target" } };
    expect(destinationDraft(variant, account, instagram, existing).payload).toEqual(existing.payload);
  });
  test("thread edits preserve other bodies and publication keys remain stable on retries", () => {
    const source = { thread: [{ text: "First", paid_partnership: true }, { text: "Second" }] };
    const edited = destinationText(source, "x", 1, "Changed second");
    expect(edited.thread[0]).toEqual(source.thread[0]);
    expect(edited.thread[1].text).toBe("Changed second");
    expect(source.thread[1].text).toBe("Second");
    expect(destinationRequestKey("post", "account")).toBe(destinationRequestKey("post", "account"));
    expect(destinationRequestKey("post", "account")).not.toBe(destinationRequestKey("post", "another"));
  });
  test("submitted and uncertain outcomes cannot be resubmitted", () => {
    for (const status of ["scheduled", "publishing", "published", "rejected"]) expect(canSubmitDestination({ ...variant, status })).toBe(false);
    expect(canSubmitDestination({ ...variant, status: "failed", publish_state: { outcome_unknown: true } })).toBe(false);
    expect(canSubmitDestination({ ...variant, status: "failed" })).toBe(true);
  });
  test("one failing destination never blocks another", async () => {
    const sent = [];
    const results = await submitDestinations(["facebook", "instagram", "x"], async (id) => {
      sent.push(id);
      if (id === "instagram") throw new Error("Needs media");
      return { accountId: id, status: "scheduled", message: "Scheduled" };
    });
    expect(sent).toEqual(["facebook", "instagram", "x"]);
    expect(results.map((result) => result.status)).toEqual(["scheduled", "error", "scheduled"]);
    expect(results[1].message).toBe("Needs media");
  });
});
