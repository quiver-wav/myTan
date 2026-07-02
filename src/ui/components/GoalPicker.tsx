import { goalsForPhototype } from "../../core/index";
import { useStore } from "../store";

export function GoalPicker() {
  const { data, update } = useStore();
  const phototype = data.phototype!.phototype;
  const goals = goalsForPhototype(phototype);

  return (
    <div className="card">
      <div className="step-label">
        Passo 3 di 3 · {data.phototype?.label} · {data.location?.name}
      </div>
      <h1>Che abbronzatura vuoi raggiungere?</h1>
      <p className="muted">
        Gli obiettivi non adatti al tuo fototipo sono disattivati: con la tua pelle
        ti scotteresti senza ottenerli.
      </p>
      {goals.map(({ goal, reachable }) => (
        <button
          key={goal.id}
          className="option"
          disabled={!reachable}
          onClick={() => update({ goalId: goal.id })}
        >
          {goal.label}
          <span className="desc">{goal.description}</span>
        </button>
      ))}
      <button className="ghost" onClick={() => update({ location: null })}>
        ← Cambia località
      </button>
    </div>
  );
}
