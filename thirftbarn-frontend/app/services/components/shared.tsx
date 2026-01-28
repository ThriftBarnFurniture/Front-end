// app/services/components/shared.tsx
"use client";

import styles from "./serviceform.module.css";

export type Option<T extends string> = { value: T; label: string };

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>{title}</div>
        {description ? (
          <div className={styles.sectionDesc}>{description}</div>
        ) : null}
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

export function Row({ children }: { children: React.ReactNode }) {
  return <div className={styles.row}>{children}</div>;
}

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={styles.field}>
      <div className={styles.fieldLabel}>
        <span>{label}</span>
        {required ? <span className={styles.required}>Required</span> : null}
      </div>
      {hint ? <div className={styles.fieldHint}>{hint}</div> : null}
      <div className={styles.fieldControl}>{children}</div>
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={styles.input} />;
}

export function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  return <textarea {...props} className={styles.textarea} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={styles.select} />;
}

export function CheckboxGroup<T extends string>({
  options,
  value,
  onChange,
  columns = 2,
}: {
  options: Option<T>[];
  value: T[];
  onChange: (next: T[]) => void;
  columns?: 1 | 2 | 3;
}) {
  const toggle = (v: T) => {
    const has = value.includes(v);
    onChange(has ? value.filter((x) => x !== v) : [...value, v]);
  };

  return (
    <div
      className={`${styles.checkGrid} ${
        columns === 1
          ? styles.checkGrid1
          : columns === 3
          ? styles.checkGrid3
          : styles.checkGrid2
      }`}
    >
      {options.map((o) => (
        <label key={o.value} className={styles.checkItem}>
          <input
            type="checkbox"
            checked={value.includes(o.value)}
            onChange={() => toggle(o.value)}
          />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

export function RadioGroup<T extends string>({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: Option<T>[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className={styles.radioRow}>
      {options.map((o) => (
        <label key={o.value} className={styles.radioItem}>
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
          />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

export function Divider() {
  return <div className={styles.divider} />;
}

export function HelpPill({ children }: { children: React.ReactNode }) {
  return <div className={styles.helpPill}>{children}</div>;
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div role="alert" className={styles.errorBox}>
      {message}
    </div>
  );
}

export function SuccessBox({ message }: { message: string }) {
  return <div role="status" className={styles.successBox}>
    {message}
  </div>;
}
