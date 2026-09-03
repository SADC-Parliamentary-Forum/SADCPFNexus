import assert from "node:assert/strict";
import test from "node:test";
import {
  firstTimesheetRowErrorMessage,
  normalizeTimesheetEntry,
  timesheetRowError,
  timesheetRowErrors,
} from "./timesheetRowValidation.ts";

test("manual row without project is valid when the catalog is empty", () => {
  assert.equal(
    timesheetRowError(
      { work_date: "2026-09-01", hours: 8, work_bucket: "delivery", project_id: null },
      { projectCount: 0 },
    ),
    null,
  );
});

test("manual row without project is invalid when charge codes exist", () => {
  assert.equal(
    timesheetRowError(
      { work_date: "2026-09-01", hours: 8, work_bucket: "delivery", project_id: null },
      { projectCount: 3 },
    ),
    "Select a project",
  );
});

test("nested project id satisfies the project requirement", () => {
  assert.equal(
    timesheetRowError(
      {
        work_date: "2026-09-01",
        hours: 8,
        work_bucket: "delivery",
        project_id: null,
        project: { id: 12, label: "EU Governance" },
      },
      { projectCount: 2 },
    ),
    null,
  );
});

test("leave travel and holiday rows do not require project or bucket", () => {
  for (const source_type of ["leave", "travel", "holiday"] as const) {
    assert.equal(
      timesheetRowError(
        { work_date: "2026-09-01", hours: 8, source_type, project_id: null, work_bucket: null },
        { projectCount: 4 },
      ),
      null,
      source_type,
    );
  }
});

test("missing hours and out-of-range hours still fail", () => {
  assert.equal(
    timesheetRowError({ work_date: "2026-09-01", hours: null, work_bucket: "delivery" }, { projectCount: 0 }),
    "Hours required",
  );
  assert.equal(
    timesheetRowError({ work_date: "2026-09-01", hours: 25, work_bucket: "delivery" }, { projectCount: 0 }),
    "Hours must be 0–24",
  );
});

test("normalize copies nested project id, defaults bucket, and trims ISO dates", () => {
  const normalized = normalizeTimesheetEntry(
    {
      work_date: "2026-09-01T00:00:00.000000Z",
      hours: 8,
      project_id: null,
      project: { id: 7, label: "Core" },
      work_bucket: null,
    },
    { defaultProjectId: 99, defaultBucket: "delivery" },
  );
  assert.equal(normalized.work_date, "2026-09-01");
  assert.equal(normalized.project_id, 7);
  assert.equal(normalized.work_bucket, "delivery");
});

test("normalize fills missing project from the default when catalog has a fallback", () => {
  const normalized = normalizeTimesheetEntry(
    { work_date: "2026-09-01", hours: 8, project_id: null, work_bucket: "meeting" },
    { defaultProjectId: 4, defaultBucket: "delivery" },
  );
  assert.equal(normalized.project_id, 4);
});

test("submit banner names the first failing row", () => {
  const errors = timesheetRowErrors(
    [
      { work_date: "2026-09-01", hours: 8, work_bucket: "delivery", project_id: 1 },
      { work_date: "2026-09-02", hours: 8, work_bucket: "delivery", project_id: null },
    ],
    { projectCount: 2 },
  );
  assert.equal(errors[1], "Select a project");
  assert.equal(firstTimesheetRowErrorMessage(errors), "Row 2: Select a project");
});
