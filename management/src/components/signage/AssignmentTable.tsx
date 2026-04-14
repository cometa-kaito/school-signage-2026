"use client";

import type { Assignment } from "@/hooks/useSignageData";
import { calculateDaysLeft } from "@/lib/utils";
import { filterRecentAssignments } from "@/lib/data-filter";
import styles from "@/styles/signage.module.css";

function getSourceBadge(source?: string): string {
  if (source === "school") return "\u{1F3EB}";
  if (source === "grade") return "\u{1F4DA}";
  return "";
}

interface AssignmentTableProps {
  assignments: Assignment[];
}

const MIN_ROWS = 5;

export function AssignmentTable({ assignments }: AssignmentTableProps) {
  const filtered = filterRecentAssignments(assignments, 5);
  const placeholderCount = Math.max(0, MIN_ROWS - filtered.length);

  return (
    <div className={styles.assignmentSection}>
      <h2>
        <span className={styles.cardIcon}>&#x1F4DD;</span>
        提出物
      </h2>
      <div className={styles.tableWrapper}>
        <table className={styles.taskTable}>
          <thead>
            <tr>
              <th>期限</th>
              <th>科目</th>
              <th>提出物</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={3} className={styles.noAssignment}>
                  提出物はありません
                </td>
              </tr>
            ) : (
              <>
                {filtered.map((assignment, idx) => {
                  const badge = getSourceBadge(assignment._source);
                  const { days, text, cssClass } = calculateDaysLeft(
                    assignment.deadline
                  );
                  const isOverdue = days < 0;
                  const daysClassName =
                    cssClass === "days-urgent"
                      ? styles.daysUrgent
                      : styles.daysLeft;

                  return (
                    <tr
                      key={idx}
                      className={isOverdue ? styles.overdueRow : undefined}
                    >
                      <td>
                        <span className={daysClassName}>{text}</span>
                      </td>
                      <td>
                        {badge && (
                          <span className={styles.sourceBadge}>{badge}</span>
                        )}
                        {assignment.subject}
                      </td>
                      <td>{assignment.task}</td>
                    </tr>
                  );
                })}
                {Array.from({ length: placeholderCount }).map((_, idx) => (
                  <tr key={`ph-${idx}`} className={styles.assignmentPlaceholder}>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
