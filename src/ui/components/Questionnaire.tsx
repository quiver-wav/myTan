import { useState } from "react";
import { FITZPATRICK_QUESTIONS, classifyPhototype } from "../../core/index";
import { useStore } from "../store";

export function Questionnaire() {
  const { update } = useStore();
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<(number | undefined)[]>(
    () => FITZPATRICK_QUESTIONS.map(() => undefined),
  );

  const q = FITZPATRICK_QUESTIONS[idx]!;
  const total = FITZPATRICK_QUESTIONS.length;

  const choose = (score: number) => {
    const next = answers.slice();
    next[idx] = score;
    setAnswers(next);
    if (idx + 1 < total) {
      setIdx(idx + 1);
    } else {
      update({ phototype: classifyPhototype(next as number[]) });
    }
  };

  return (
    <div className="card">
      <div className="step-label">Passo 1 di 3 · Domanda {idx + 1} di {total}</div>
      <div className="bar">
        <span style={{ width: `${((idx + 1) / total) * 100}%` }} />
      </div>
      <h1>{q.text}</h1>
      {q.options.map((opt) => (
        <button
          key={opt.label}
          className={`option ${answers[idx] === opt.score ? "selected" : ""}`}
          onClick={() => choose(opt.score)}
        >
          {opt.label}
        </button>
      ))}
      {idx > 0 && (
        <button className="ghost" onClick={() => setIdx(idx - 1)}>
          ← Indietro
        </button>
      )}
    </div>
  );
}
