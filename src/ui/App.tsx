import { useStore } from "./store";
import { Sea } from "./components/Sea";
import { Questionnaire } from "./components/Questionnaire";
import { PhototypeResult } from "./components/PhototypeResult";
import { LocationPicker } from "./components/LocationPicker";
import { GoalPicker } from "./components/GoalPicker";
import { Dashboard } from "./components/Dashboard";

export function App() {
  const { data } = useStore();

  let screen;
  if (!data.phototype) screen = <Questionnaire />;
  else if (!data.phototypeConfirmed) screen = <PhototypeResult />;
  else if (!data.location) screen = <LocationPicker />;
  else if (!data.goalId) screen = <GoalPicker />;
  else screen = <Dashboard />;

  return (
    <>
      <Sea />
      <div className="app">
        <div className="brand">
          myTan <small>abbronzati in sicurezza</small>
        </div>
        {screen}
      </div>
    </>
  );
}
